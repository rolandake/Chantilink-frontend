// src/context/AuthContext.jsx
// VERSION PERSISTANCE ROBUSTE v3.0
//
// CORRECTIONS vs v2 :
//   ✅ Logout uniquement sur 401 AVEC réponse serveur (pas sur erreur réseau)
//   ✅ getToken() tolère les erreurs réseau (retourne token cache, ne déconnecte pas)
//   ✅ Safety timeout étendu à 12s (Render cold start peut prendre 8-10s)
//   ✅ Retry réseau sur l'init (3 tentatives espacées de 2s)
//   ✅ refreshAccessToken : erreur réseau → retourne token actuel (pas null)
//   ✅ Pas de logout sur status 0 / null / undefined (réseau coupé)
//   ✅ isAuthenticated basé sur user ET token OU user seul (cache offline)

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
// Instance séparée pour les appels auth, sans intercepteurs de retry
const authAxios = axios.create({
  baseURL:         BACKEND_URL,
  timeout:         15000,          // ← étendu à 15s pour Render cold start
  withCredentials: true,
  headers:         { "Content-Type": "application/json" },
});

// ─── STORAGE HELPERS ──────────────────────────────────────────────────────────
const SESSION_TTL = 90 * 24 * 60 * 60 * 1000; // 90 jours

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
  // 1. sessionStorage — ultra-rapide, même onglet (survit à F5)
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

  // 2. IDB
  try {
    const s = await idbGet("users", "session_meta").catch(() => null);
    if (s?.user?._id && Date.now() - s.savedAt < SESSION_TTL) {
      return { user: s.user, token: null };
    }
  } catch {}

  // 3. localStorage — dernier recours
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

// ─── HELPER : est-ce vraiment un 401 serveur (pas un timeout/réseau) ─────────
function isServerUnauthorized(err) {
  const status = err?.response?.status;
  // Seulement si le serveur a répondu avec 401 explicitement
  return status === 401;
}

// ─── HELPER : est-ce une erreur réseau/timeout (pas une déconnexion) ─────────
function isNetworkError(err) {
  const status = err?.response?.status;
  // Pas de status = pas de réponse serveur (réseau coupé, timeout, CORS, Render cold start)
  return !status || status === 0 || status >= 500;
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

  const tokenRef        = useRef(null);
  const tokenExpiresRef = useRef(null);
  const readyRef        = useRef(false);
  const isRefreshing    = useRef(false);
  const refreshQueue    = useRef([]);

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

    const drainQueue = (token) => {
      refreshQueue.current.forEach(({ resolve }) => resolve(token));
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
        // 401 explicite du serveur → cookie révoqué → logout silencieux
        console.info("[AuthContext] Cookie 401 serveur → logout silencieux");
        setUser(null);
        setToken(null);
        tokenRef.current        = null;
        tokenExpiresRef.current = null;
        await clearSession();
        return null;
      }

      // Erreur réseau / timeout / 5xx → on ne déconnecte PAS
      // On retourne le token actuel pour ne pas bloquer les appels en cours
      console.warn("[AuthContext] Erreur réseau lors du refresh — token cache maintenu");
      return tokenRef.current;
    } finally {
      isRefreshing.current = false;
    }
  }, [applySession]);

  // ─── GET TOKEN ───────────────────────────────────────────────────────────────
  const getToken = useCallback(async () => {
    // Attendre la fin de l'init (max 12s — Render cold start)
    if (!readyRef.current) {
      await new Promise((resolve) => {
        const check = setInterval(() => {
          if (readyRef.current) { clearInterval(check); resolve(); }
        }, 50);
        setTimeout(() => { clearInterval(check); resolve(); }, 12000);
      });
    }

    const currentToken = tokenRef.current;
    if (!currentToken) return null;

    const timeLeft = (tokenExpiresRef.current || 0) - Date.now();

    // Token encore frais
    if (timeLeft > 3 * 60 * 1000) return currentToken;

    // Expire dans moins de 3 min → refresh préventif silencieux
    if (timeLeft > 0) {
      refreshAccessToken().catch(() => {});
      return currentToken;
    }

    // Expiré → refresh bloquant, mais fallback sur token cache si réseau coupé
    const newToken = await refreshAccessToken();
    return newToken || currentToken;
  }, [refreshAccessToken]);

  useEffect(() => { getTokenRef.current = getToken; }, [getToken]);

  // ─── ÉCOUTE L'EVENT "auth:token-refreshed" ────────────────────────────────
  useEffect(() => {
    const handler = async (e) => {
      const { token: tk, expiresIn, user: u } = e.detail || {};
      if (tk && u) {
        console.log("[AuthContext] 📡 Token reçu via event axiosClient");
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

    const markReady = () => {
      if (!cancelled && isMounted.current) {
        readyRef.current = true;
        setReady(true);
        setSessionLoading(false);
      }
    };

    // Safety timeout : 12s (Render cold start peut prendre 8-10s)
    const safetyTimer = setTimeout(() => {
      console.warn("⏱️ [AuthContext] Safety timeout → forçage sessionLoading=false");
      markReady();
    }, 12000);

    // Helper : tenter le refresh-token avec retry réseau
    const tryRefreshWithRetry = async (maxAttempts = 3, delayMs = 2000) => {
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const res = await authAxios.post("/api/auth/refresh-token");
          if (res.data?.success && res.data?.token) {
            return res.data;
          }
          return null; // Succès HTTP mais pas de token (ne pas retenter)
        } catch (err) {
          const status = err?.response?.status;

          if (status === 401) {
            // Cookie invalide → inutile de réessayer
            return { failed401: true };
          }

          // Erreur réseau / timeout / 5xx
          if (attempt < maxAttempts) {
            console.warn(`[AuthContext] Init refresh tentative ${attempt}/${maxAttempts} échouée — retry dans ${delayMs}ms`);
            await new Promise(r => setTimeout(r, delayMs));
          } else {
            console.warn(`[AuthContext] Init refresh : ${maxAttempts} tentatives échouées — cache maintenu`);
          }
        }
      }
      return null; // Toutes les tentatives ont échoué (réseau)
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
      const result = await tryRefreshWithRetry(3, 2000);

      if (!cancelled) {
        if (result?.failed401) {
          // Cookie révoqué ou expiré côté serveur → nettoyage
          console.info("[AuthContext] Cookie invalide (401) → nettoyage");
          setUser(null);
          setToken(null);
          tokenRef.current        = null;
          tokenExpiresRef.current = null;
          await clearSession();
        } else if (result?.token) {
          // Refresh réussi
          await applySession(result);
          console.log("✅ [AuthContext] Session validée côté serveur");
        } else {
          // Réseau coupé ou serveur indisponible → cache maintenu
          console.warn("[AuthContext] Serveur inaccessible → cache maintenu (pas de déconnexion)");
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

  // ─── HEARTBEAT (refresh préventif toutes les 4 min) ──────────────────────────
  useEffect(() => {
    if (!token) return;
    const id = setInterval(() => {
      const left = (tokenExpiresRef.current || 0) - Date.now();
      if (left > 0 && left < 5 * 60 * 1000) {
        console.log("[AuthContext] 🔄 Heartbeat refresh");
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
          console.log("[AuthContext] 🔄 Refresh au retour d'onglet");
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
        console.log("[AuthContext] 📡 Déconnexion dans un autre onglet");
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
        email:      email.trim().toLowerCase(),
        password:   String(password),
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

  // ─── SET AUTH DATA (OAuth / reset password) ──────────────────────────────────
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
    socket: socketRef.current,
    loading,
    ready,
    sessionLoading,
    // ✅ isAuthenticated = vrai si on a un user (même sans token, en mode offline cache)
    isAuthenticated: !!user,
    notifications,
    login,
    logout,
    register,
    setAuthData,
    getToken,
    updateUserProfile,
    verifyAdminToken,
    isAdmin: () => ["admin","superadmin"].includes(user?.role),
    addNotification,
    isLockedOut,
  }), [
    user, token, loading, ready, sessionLoading, notifications,
    login, logout, register, setAuthData, getToken, updateUserProfile,
    verifyAdminToken, addNotification, isLockedOut,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}