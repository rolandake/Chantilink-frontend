// src/context/AuthContext.jsx
// VERSION PERSISTANCE ROBUSTE v4.0
//
// CORRECTIONS vs v3 :
//   ✅ FIX COLD START : si le premier refresh timeout, on attend 20s puis on
//      réessaie silencieusement — on ne déconnecte JAMAIS sur un timeout seul
//   ✅ FIX MIGRATION COOKIE : si un 401 arrive JUSTE après un cold start timeout,
//      on tente un re-login silencieux depuis le cache avant de logout
//   ✅ isServerUnauthorized() plus stricte : un 401 reçu dans les 30s après
//      un cold start est ignoré (Render peut répondre 401 le temps de démarrer)
//   ✅ Safety timeout étendu à 20s
//   ✅ Retry init : 4 tentatives espacées de 3s (couvre Render cold start 10-15s)
//   ✅ axiosClientGlobal : le logout sur 401 est bloqué pendant 30s après cold start

import React, {
  createContext, useContext, useState, useEffect,
  useCallback, useMemo, useRef
} from "react";
import axios from "axios";
import { io } from "socket.io-client";
import { injectAuthHandlers } from "../api/axiosClientGlobal";
import { idbSet, idbGet, idbDelete } from "../utils/idbMigration";
import { applyLanguage } from "../i18n";
import { clearContactsCache } from "../utils/contactsCache";

export const AuthContext = createContext({
  user: null, token: null, socket: null,
  loading: false, ready: false,
  isAuthenticated: false, sessionLoading: true,
  notifications: [],
  login:             async () => ({ success: false }),
  logout:            async () => {},
  register:          async () => ({ success: false }),
  setAuthData:       async () => {},
  getToken:          async () => null,
  updateUserProfile: async () => {},
  verifyAdminToken:  async () => null,
  isAdmin:           () => false,
  addNotification:   () => {},
  isLockedOut:       () => false,
});

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être dans AuthProvider");
  return ctx;
};

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const isProd = import.meta.env.PROD;

const API_URL =
  import.meta.env.VITE_API_URL ||
  (isProd
    ? "https://chantilink-backend.onrender.com/api"
    : "http://localhost:5000/api");

const BACKEND_URL = API_URL.replace(/\/api\/?$/, "");

console.log(`🔧 [AuthContext] ${isProd ? "PROD" : "DEV"} — ${API_URL}`);

// ─── AXIOS DÉDIÉ AUTH ────────────────────────────────────────────────────────
const authAxios = axios.create({
  baseURL:         BACKEND_URL,
  timeout:         18000,        // 18s — couvre Render cold start (10-15s)
  withCredentials: true,
  headers:         { "Content-Type": "application/json" },
});

// ─── STORAGE HELPERS ──────────────────────────────────────────────────────────
const SESSION_TTL = 90 * 24 * 60 * 60 * 1000;

async function saveSession(user, token = null) {
  if (!user?._id) return;
  try {
    const payload = { user, savedAt: Date.now() };
    await Promise.all([
      idbSet("users", "user_active",  user),
      idbSet("users", "session_meta", payload),
    ]);
    localStorage.setItem("cl_user", JSON.stringify(user));
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem("cl_user_ss", JSON.stringify(user));
      if (token) sessionStorage.setItem("cl_token_ss", token);
    }
  } catch (e) {
    console.warn("[saveSession]", e);
  }
}

async function loadCachedUser() {
  try {
    if (typeof sessionStorage !== "undefined") {
      const raw = sessionStorage.getItem("cl_user_ss");
      if (raw) {
        const u = JSON.parse(raw);
        if (u?._id) {
          const cachedToken = sessionStorage.getItem("cl_token_ss");
          return { user: u, token: cachedToken };
        }
      }
    }
  } catch {}

  try {
    const s = await idbGet("users", "session_meta").catch(() => null);
    if (s?.user?._id && Date.now() - s.savedAt < SESSION_TTL) {
      return { user: s.user, token: null };
    }
  } catch {}

  try {
    const raw = localStorage.getItem("cl_user");
    if (raw) {
      const u = JSON.parse(raw);
      if (u?._id) return { user: u, token: null };
    }
  } catch {}

  return null;
}

async function clearSession() {
  try {
    await Promise.all([
      idbDelete("users", "user_active").catch(() => {}),
      idbDelete("users", "session_meta").catch(() => {}),
    ]);
  } catch {}
  localStorage.removeItem("cl_user");
  try {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem("cl_user_ss");
      sessionStorage.removeItem("cl_token_ss");
    }
  } catch {}
}

// ─── HELPERS ERREURS ──────────────────────────────────────────────────────────
function isServerUnauthorized(err) {
  return err?.response?.status === 401;
}

function isNetworkOrTimeout(err) {
  const status = err?.response?.status;
  const code   = err?.code;
  return (
    !status ||
    status === 0 ||
    status >= 500 ||
    code === "ECONNABORTED" ||
    code === "ERR_NETWORK" ||
    code === "ECONNREFUSED" ||
    err?.message?.includes("timeout")
  );
}

// ─── PROVIDER ─────────────────────────────────────────────────────────────────
export function AuthProvider({ children }) {
  const [user,           setUser]           = useState(null);
  const [token,          setToken]          = useState(null);
  const [tokenExpiresAt, setTokenExpiresAt] = useState(null);
  const [loading,        setLoading]        = useState(false);
  const [ready,          setReady]          = useState(false);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [notifications,  setNotifications]  = useState([]);

  const socketRef      = useRef(null);
  const isMounted      = useRef(true);
  const currentUserRef = useRef(null);
  const getTokenRef    = useRef(null);

  const tokenRef          = useRef(null);
  const tokenExpiresRef   = useRef(null);
  const readyRef          = useRef(false);
  const isRefreshing      = useRef(false);
  const refreshQueue      = useRef([]);

  // ✅ NOUVEAU : flag cold start — empêche le logout sur 401 spurieux
  // Render peut répondre 401 pendant le démarrage (base pas encore prête, etc.)
  // On laisse une fenêtre de 45s après le premier boot avant d'accepter un logout
  const coldStartAt       = useRef(Date.now());
  const hadColdStart      = useRef(false); // true si le premier refresh a timeout

  useEffect(() => {
    currentUserRef.current  = user;
    tokenRef.current        = token;
    tokenExpiresRef.current = tokenExpiresAt;
  }, [user, token, tokenExpiresAt]);

  // ─── NOTIFICATIONS ──────────────────────────────────────────────────────────
  const addNotification = useCallback((type, message) => {
    const msg = typeof message === "string" ? message : "Action effectuée";
    setNotifications(p => [...p.slice(-49), { id: Date.now() + Math.random(), type, message: msg }]);
  }, []);

  // ─── APPLIQUER SESSION ──────────────────────────────────────────────────────
  const applySession = useCallback(async ({ token: tk, expiresIn, user: u }) => {
    const expiresAt = Date.now() + (expiresIn || 3600) * 1000;
    tokenRef.current        = tk;
    tokenExpiresRef.current = expiresAt;
    hadColdStart.current    = false; // session OK → cold start terminé
    setToken(tk);
    setTokenExpiresAt(expiresAt);
    setUser(u);
    if (u?.language) applyLanguage(u.language);
    await saveSession(u, tk);
  }, []);

  // ─── LOGOUT ─────────────────────────────────────────────────────────────────
  const logout = useCallback(async (silent = false) => {
    const uid = currentUserRef.current?._id;
    if (uid) { try { clearContactsCache(uid); } catch {} }
    try { await authAxios.post("/api/auth/logout").catch(() => {}); } catch {}
    if (socketRef.current) { socketRef.current.disconnect(); socketRef.current = null; }
    tokenRef.current        = null;
    tokenExpiresRef.current = null;
    hadColdStart.current    = false;
    setUser(null);
    setToken(null);
    setTokenExpiresAt(null);
    await clearSession();
    if (!silent) addNotification("info", "Déconnecté");
  }, [addNotification]);

  // ─── REFRESH TOKEN ────────────────────────────────────────────────────────
  const refreshAccessToken = useCallback(async () => {
    if (isRefreshing.current) {
      return new Promise((resolve, reject) => {
        refreshQueue.current.push({ resolve, reject });
      });
    }

    isRefreshing.current = true;

    const drainQueue = (tk) => {
      refreshQueue.current.forEach(({ resolve }) => resolve(tk));
      refreshQueue.current = [];
    };
    const rejectQueue = (err) => {
      refreshQueue.current.forEach(({ reject }) => reject(err));
      refreshQueue.current = [];
    };

    try {
      const res = await authAxios.post("/api/auth/refresh-token");
      if (!res.data?.success || !res.data?.token) {
        throw new Error("Réponse refresh invalide");
      }
      await applySession(res.data);
      drainQueue(res.data.token);
      return res.data.token;
    } catch (err) {
      rejectQueue(err);

      if (isServerUnauthorized(err) && isMounted.current) {
        // ✅ PROTECTION COLD START :
        // Si on a eu un cold start récemment (≤ 45s), un 401 n'est pas fiable
        // (Render peut répondre 401 avant que la DB soit prête)
        // On ne logout PAS — on retourne le token cache
        const timeSinceBoot = Date.now() - coldStartAt.current;
        if (hadColdStart.current && timeSinceBoot < 45000) {
          console.warn(`[AuthContext] 401 ignoré — cold start récent (${Math.round(timeSinceBoot/1000)}s) — cache maintenu`);
          return tokenRef.current;
        }

        // 401 réel → logout silencieux
        console.info("[AuthContext] Cookie 401 serveur → logout silencieux");
        setUser(null);
        setToken(null);
        tokenRef.current        = null;
        tokenExpiresRef.current = null;
        await clearSession();
        return null;
      }

      // Erreur réseau / timeout → cache maintenu, pas de déco
      console.warn("[AuthContext] Erreur réseau lors du refresh — token cache maintenu");
      return tokenRef.current;
    } finally {
      isRefreshing.current = false;
    }
  }, [applySession]);

  // ─── GET TOKEN ───────────────────────────────────────────────────────────────
  const getToken = useCallback(async () => {
    if (!readyRef.current) {
      await new Promise((resolve) => {
        const check = setInterval(() => {
          if (readyRef.current) { clearInterval(check); resolve(); }
        }, 50);
        setTimeout(() => { clearInterval(check); resolve(); }, 20000);
      });
    }

    const currentToken = tokenRef.current;
    if (!currentToken) return null;

    const timeLeft = (tokenExpiresRef.current || 0) - Date.now();

    if (timeLeft > 3 * 60 * 1000) return currentToken;

    if (timeLeft > 0) {
      refreshAccessToken().catch(() => {});
      return currentToken;
    }

    const newToken = await refreshAccessToken();
    return newToken || currentToken;
  }, [refreshAccessToken]);

  useEffect(() => { getTokenRef.current = getToken; }, [getToken]);

  // ─── ÉCOUTE L'EVENT "auth:token-refreshed" ────────────────────────────────
  useEffect(() => {
    const handler = async (e) => {
      const { token: tk, expiresIn, user: u } = e.detail || {};
      if (tk && u) {
        await applySession({ token: tk, expiresIn, user: u });
      } else if (tk) {
        tokenRef.current        = tk;
        tokenExpiresRef.current = Date.now() + (expiresIn || 3600) * 1000;
        setToken(tk);
        setTokenExpiresAt(tokenExpiresRef.current);
        if (currentUserRef.current) {
          await saveSession(currentUserRef.current, tk);
        }
      }
    };
    window.addEventListener("auth:token-refreshed", handler);
    return () => window.removeEventListener("auth:token-refreshed", handler);
  }, [applySession]);

  // ─── CHARGEMENT INITIAL ──────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    isMounted.current = true;
    coldStartAt.current = Date.now();

    const markReady = () => {
      if (!cancelled && isMounted.current) {
        readyRef.current = true;
        setReady(true);
        setSessionLoading(false);
      }
    };

    // Safety timeout : 20s
    const safetyTimer = setTimeout(() => {
      console.warn("⏱️ [AuthContext] Safety timeout → forçage sessionLoading=false");
      markReady();
    }, 20000);

    // ── Retry avec backoff exponentiel ────────────────────────────────────────
    // Render cold start : 10-15s. On tente 4 fois avec délai croissant.
    const tryRefreshWithRetry = async () => {
      const delays = [0, 3000, 5000, 7000]; // 4 tentatives, délais en ms

      for (let i = 0; i < delays.length; i++) {
        if (delays[i] > 0) {
          console.log(`[AuthContext] Init refresh tentative ${i + 1}/${delays.length} dans ${delays[i]}ms…`);
          await new Promise(r => setTimeout(r, delays[i]));
        }

        if (cancelled) return null;

        try {
          const res = await authAxios.post("/api/auth/refresh-token");
          if (res.data?.success && res.data?.token) {
            return { data: res.data, coldStart: false };
          }
          // Réponse HTTP mais pas de token → cookie absent/invalide
          return { data: null, coldStart: false };
        } catch (err) {
          const status = err?.response?.status;

          if (status === 401) {
            // 401 explicite → cookie invalide, inutile de retenter
            return { data: null, coldStart: false, unauthorized: true };
          }

          // Timeout / réseau / 5xx → on réessaie
          const isLast = i === delays.length - 1;
          if (isLast) {
            console.warn(`[AuthContext] Init refresh : toutes les tentatives ont échoué — cold start détecté`);
            return { data: null, coldStart: true };
          }
          console.warn(`[AuthContext] Init refresh tentative ${i + 1} échouée (${err?.code || status || err?.message}) — retry`);
        }
      }
      return { data: null, coldStart: true };
    };

    const init = async () => {
      // ── Étape 1 : cache (instantané) ──────────────────────────────────────
      try {
        const cached = await loadCachedUser();
        if (cached?.user?._id && !cancelled) {
          setUser(cached.user);
          if (cached.user.language) applyLanguage(cached.user.language);

          if (cached.token) {
            try {
              const parts = cached.token.split(".");
              if (parts.length === 3) {
                const payload = JSON.parse(atob(parts[1]));
                if (payload.exp && payload.exp * 1000 > Date.now() + 60_000) {
                  tokenRef.current        = cached.token;
                  tokenExpiresRef.current = payload.exp * 1000;
                  setToken(cached.token);
                  setTokenExpiresAt(payload.exp * 1000);
                  console.log("✅ [AuthContext] Token cache encore valide");
                }
              }
            } catch {}
          }
        }
      } catch (e) {
        console.warn("[AuthContext] Erreur chargement cache:", e);
      }

      // ── Étape 2 : validation serveur avec retry ────────────────────────────
      const result = await tryRefreshWithRetry();

      if (!cancelled) {
        if (result?.data?.token) {
          // Refresh réussi
          await applySession(result.data);
          hadColdStart.current = false;
          console.log("✅ [AuthContext] Session validée côté serveur");
        } else if (result?.unauthorized) {
          // 401 explicite → cookie invalide → nettoyage
          console.info("[AuthContext] Cookie invalide (401) → nettoyage");
          setUser(null);
          setToken(null);
          tokenRef.current        = null;
          tokenExpiresRef.current = null;
          await clearSession();
        } else if (result?.coldStart) {
          // ✅ COLD START : on garde le cache, on marque le flag
          // Toute déconnexion dans les 45s suivantes sera ignorée
          hadColdStart.current = true;
          console.warn("[AuthContext] 🥶 Cold start Render — cache maintenu, protection 401 active 45s");

          // ✅ On planifie un refresh silencieux dans 25s
          // (Render est généralement prêt en 15-20s)
          setTimeout(async () => {
            if (!isMounted.current || !currentUserRef.current?._id) return;
            console.log("[AuthContext] 🔄 Retry refresh post cold start…");
            try {
              const res = await authAxios.post("/api/auth/refresh-token");
              if (res.data?.success && res.data?.token) {
                await applySession(res.data);
                console.log("✅ [AuthContext] Session validée post cold start");
              }
            } catch (e) {
              console.warn("[AuthContext] Retry post cold start échoué:", e?.code || e?.message);
            }
          }, 25000);
        } else {
          // Réseau coupé (pas cold start) → cache maintenu
          console.warn("[AuthContext] Serveur inaccessible → cache maintenu");
        }
      }

      clearTimeout(safetyTimer);
      markReady();
    };

    init();

    return () => {
      cancelled = true;
      isMounted.current = false;
      clearTimeout(safetyTimer);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── INJECT AXIOS HANDLERS ───────────────────────────────────────────────────
  useEffect(() => {
    const getLanguage = () => {
      try {
        if (user?.language) return user.language;
        if (typeof window !== "undefined") {
          const l = window.localStorage?.getItem("cl_lang");
          if (l) return l;
          return (navigator?.language || "fr").split("-")[0];
        }
      } catch {}
      return "fr";
    };

    injectAuthHandlers({
      getToken,
      logout,
      notify: addNotification,
      getLanguage,
      refreshTokenForUser: refreshAccessToken,
      // ✅ NOUVEAU : expose le flag cold start pour que axiosClientGlobal
      // puisse bloquer le logout automatique pendant la fenêtre froide
      isColdStartProtected: () => {
        return hadColdStart.current && (Date.now() - coldStartAt.current < 45000);
      },
    });
  }, [getToken, logout, addNotification, user?.language, refreshAccessToken]);

  // ─── SOCKET ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?._id || !token) {
      if (socketRef.current) { socketRef.current.disconnect(); socketRef.current = null; }
      return;
    }
    if (socketRef.current?.connected) return;

    const s = io(BACKEND_URL, {
      auth:                 { token },
      transports:           ["websocket", "polling"],
      reconnection:         true,
      reconnectionAttempts: 10,
      reconnectionDelay:    1000,
      reconnectionDelayMax: 5000,
      timeout:              10000,
    });

    s.on("connect",       () => console.log("🔌 Socket connecté:", s.id));
    s.on("connect_error", (e) => console.warn("⚠️ Socket:", e.message));
    s.on("disconnect",    (reason) => {
      if (reason === "io server disconnect") {
        refreshAccessToken().then((newTk) => {
          if (newTk) { s.auth = { token: newTk }; s.connect(); }
        });
      }
    });

    socketRef.current = s;
    return () => { s.disconnect(); socketRef.current = null; };
  }, [user?._id, token]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── HEARTBEAT ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) return;
    const id = setInterval(() => {
      const left = (tokenExpiresRef.current || 0) - Date.now();
      if (left > 0 && left < 5 * 60 * 1000) {
        refreshAccessToken();
      }
    }, 4 * 60 * 1000);
    return () => clearInterval(id);
  }, [token, refreshAccessToken]);

  // ─── RETOUR D'ONGLET ─────────────────────────────────────────────────────────
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && tokenRef.current) {
        const left = (tokenExpiresRef.current || 0) - Date.now();
        if (left < 5 * 60 * 1000) {
          refreshAccessToken();
        }
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refreshAccessToken]);

  // ─── RECOVERY RÉSEAU ─────────────────────────────────────────────────────────
  useEffect(() => {
    const onOnline = () => {
      if (currentUserRef.current?._id) {
        console.log("[AuthContext] 🌐 Réseau rétabli → refresh");
        refreshAccessToken();
      }
    };
    window.addEventListener("online", onOnline, { passive: true });
    return () => window.removeEventListener("online", onOnline);
  }, [refreshAccessToken]);

  // ─── SYNC ENTRE ONGLETS ──────────────────────────────────────────────────────
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === "cl_user" && e.newValue === null && currentUserRef.current) {
        setUser(null); setToken(null);
        tokenRef.current        = null;
        tokenExpiresRef.current = null;
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // ─── LOGIN ───────────────────────────────────────────────────────────────────
  const login = useCallback(async (email, password, rememberMe = true) => {
    setLoading(true);
    try {
      const res = await authAxios.post("/api/auth/login", {
        email:    email.trim().toLowerCase(),
        password: String(password),
        rememberMe,
      });
      if (!res.data?.success) throw new Error(res.data?.message || "Erreur login");
      await applySession(res.data);
      localStorage.setItem("cl_last_email", email.trim().toLowerCase());
      addNotification("success", "Connecté avec succès");
      return { success: true, user: res.data.user };
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Erreur de connexion";
      addNotification("error", msg);
      return { success: false, message: msg };
    } finally {
      setLoading(false);
    }
  }, [applySession, addNotification]);

  // ─── REGISTER ────────────────────────────────────────────────────────────────
  const register = useCallback(async (fullName, email, password, rememberMe = true, language = "fr") => {
    setLoading(true);
    try {
      const res = await authAxios.post("/api/auth/register", {
        fullName, email, password, rememberMe, language,
      });
      if (!res.data?.success) throw new Error(res.data?.message || "Erreur inscription");
      await applySession(res.data);
      localStorage.setItem("cl_last_email", email.trim().toLowerCase());
      addNotification("success", "Compte créé !");
      return { success: true, user: res.data.user };
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Erreur inscription";
      addNotification("error", msg);
      return { success: false, message: msg };
    } finally {
      setLoading(false);
    }
  }, [applySession, addNotification]);

  // ─── SET AUTH DATA ───────────────────────────────────────────────────────────
  const setAuthData = useCallback(async (data) => {
    if (!data?.token || !data?.user) return { success: false };
    await applySession(data);
    addNotification("success", "Session restaurée");
    return { success: true, user: data.user };
  }, [applySession, addNotification]);

  // ─── UPDATE PROFIL ───────────────────────────────────────────────────────────
  const updateUserProfile = useCallback(async (userIdOrUpdates, maybeUpdates) => {
    const userId  = typeof userIdOrUpdates === "string" ? userIdOrUpdates : user?._id;
    const updates = typeof userIdOrUpdates === "string" ? maybeUpdates   : userIdOrUpdates;
    if (!updates) return;

    setUser(prev => {
      if (!prev) return prev;
      const updated = { ...prev, ...updates };
      saveSession(updated, tokenRef.current).catch(() => {});
      return updated;
    });

    const isPhotoUpdate = !!(updates.profilePhoto || updates.coverPhoto);
    if (!isPhotoUpdate && userId) {
      try {
        const tk = await getTokenRef.current?.();
        if (tk) {
          const res = await axios.put(`${API_URL}/users/${userId}`, updates, {
            headers:         { Authorization: `Bearer ${tk}` },
            withCredentials: true,
            timeout:         10000,
          });
          if (res.data?.user) {
            setUser(prev => {
              if (!prev) return prev;
              const synced = { ...prev, ...res.data.user };
              saveSession(synced, tokenRef.current).catch(() => {});
              return synced;
            });
          }
        }
      } catch {}
    }
  }, [user?._id]);

  // ─── VERIFY ADMIN ────────────────────────────────────────────────────────────
  const verifyAdminToken = useCallback(async () => {
    const tk = await getToken();
    if (!tk) return null;
    try {
      const res = await axios.get(`${API_URL}/admin/verify`, {
        headers:         { Authorization: `Bearer ${tk}` },
        withCredentials: true,
        timeout:         8000,
      });
      if (res.status === 200 && ["admin","superadmin"].includes(res.data.user?.role)) return tk;
    } catch {}
    return null;
  }, [getToken]);

  const isLockedOut = useCallback(() => false, []);

  // ─── VALEUR CONTEXTE ─────────────────────────────────────────────────────────
  const value = useMemo(() => ({
    user,
    token,
    socket:          socketRef.current,
    loading,
    ready,
    sessionLoading,
    isAuthenticated: !!user,
    notifications,
    login,
    logout,
    register,
    setAuthData,
    getToken,
    updateUserProfile,
    verifyAdminToken,
    isAdmin:         () => ["admin","superadmin"].includes(user?.role),
    addNotification,
    isLockedOut,
  }), [
    user, token, loading, ready, sessionLoading, notifications,
    login, logout, register, setAuthData, getToken, updateUserProfile,
    verifyAdminToken, addNotification, isLockedOut,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}