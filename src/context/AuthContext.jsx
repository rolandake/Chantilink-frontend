// src/context/AuthContext.jsx
// ✅ VERSION PERSISTANCE MONDIALE — Session quasi-permanente
// ✅ FIX CRITIQUE : clearContactsCache(userId) appelé au logout
//    → vide le localStorage contacts de l'utilisateur déconnecté
//    → empêche un autre utilisateur de voir ses contacts

import React, {
  createContext, useContext, useState, useEffect,
  useCallback, useMemo, useRef
} from "react";
import axios from "axios";
import { io } from "socket.io-client";
import { injectAuthHandlers } from "../api/axiosClientGlobal";
import { idbSet, idbGet, idbDelete } from "../utils/idbMigration";
import { applyLanguage } from "../i18n";
// ✅ NOUVEAU : import pour vider le cache contacts au logout
import { clearContactsCache } from "../utils/contactsCache";

export const AuthContext = createContext({
  user: null, token: null, socket: null, loading: false, ready: false,
  isAuthenticated: false, notifications: [], sessionLoading: true,
  login: async () => ({ success: false, message: "Auth not ready" }),
  logout: async () => {},
  register: async () => ({ success: false, message: "Auth not ready" }),
  getToken: async () => null,
  updateUserProfile: async () => {},
  verifyAdminToken: async () => null,
  isAdmin: () => false,
  addNotification: () => {},
  isLockedOut: () => false,
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth doit être utilisé dans un AuthProvider");
  return context;
};

// ============================================
// 🔥 URL
// ============================================
const isProd = import.meta.env.PROD;

const API_URL = isProd
  ? (import.meta.env.VITE_API_URL_PROD  || "https://chantilink-backend.onrender.com/api")
  : (import.meta.env.VITE_API_URL_LOCAL || import.meta.env.VITE_API_URL || "http://localhost:5000/api");

const BACKEND_URL = API_URL.replace("/api", "");
const SOCKET_URL  = BACKEND_URL;

// ============================================
// DEBUG
// ============================================
const debugLog = (level, context, message, data = null) => {
  const prefix    = `[AuthContext:${context}]`;
  const timestamp = new Date().toISOString().slice(11, 23);
  const parts     = [`${timestamp} ${prefix} ${message}`];
  if (data !== null) parts.push(data);
  if (level === "error")     console.error(...parts);
  else if (level === "warn") console.warn(...parts);
  else                       console.log(...parts);
};

console.log(`🔧 [AuthContext] ${isProd ? "PRODUCTION" : "DÉVELOPPEMENT"} — ${API_URL}`);

const summarizeAxiosError = (err) => ({
  message:   err?.message,
  status:    err?.response?.status,
  data:      err?.response?.data,
  code:      err?.code,
  isNetwork: !err?.response && !!err?.request,
});

const CONFIG = {
  TOKEN_REFRESH_MARGIN_MS:   3 * 60 * 1000,
  AUTO_REFRESH_INTERVAL_MS:  60 * 1000,
  MAX_NOTIFICATIONS:         50,
  MAX_LOGIN_ATTEMPTS:        5,
  LOCKOUT_DURATION_MS:       15 * 60 * 1000,
  MAX_REFRESH_RETRIES:       3,
  REFRESH_COOLDOWN_MS:       3000,
  IDB_SESSION_TTL_MS:        90 * 24 * 60 * 60 * 1000,
  VISIBILITY_RECHECK_DELAY:  2000,
  BROADCAST_CHANNEL_NAME:    "chantilink_auth",
};

const STORAGE_KEYS = {
  USER_INFO:       "chantilink_user_info_v8",
  SESSION_META:    "chantilink_session_meta_v8",
  LOGIN_ATTEMPTS:  "chantilink_login_attempts_v8",
};

// ============================================
// STORAGE HELPERS
// ============================================
const secureSetItem = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); }
  catch (err) { debugLog("warn", "Storage", "setItem échec", err); }
};
const secureGetItem = (key) => {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; }
  catch { return null; }
};
const secureRemoveItem = (key) => { try { localStorage.removeItem(key); } catch {} };

// ============================================
// IDB PERSISTENCE
// ============================================
const IDB_STORE = "session";

const persistSessionToIDB = async (userData, meta = {}) => {
  if (!userData?._id) return;
  const payload = {
    user:    userData,
    meta:    { ...meta, savedAt: Date.now(), ttl: CONFIG.IDB_SESSION_TTL_MS },
    version: 8,
  };
  try {
    await Promise.all([
      idbSet("users", `user_${userData._id}`, userData),
      idbSet("users", "user_active",           userData),
      idbSet("users", "session_meta",          payload),
    ]);
    secureSetItem(STORAGE_KEYS.USER_INFO,    userData);
    secureSetItem(STORAGE_KEYS.SESSION_META, payload.meta);
    debugLog("log", "IDB", `✅ Session persistée: ${userData.email}`);
  } catch (err) {
    debugLog("warn", "IDB", "Échec persistSessionToIDB", err.message);
    secureSetItem(STORAGE_KEYS.USER_INFO, userData);
  }
};

const getSessionFromIDB = async () => {
  try {
    const session = await idbGet("users", "session_meta").catch(() => null);
    if (!session?.user) {
      const user = await idbGet("users", "user_active").catch(() => null);
      if (user?._id) {
        const meta = secureGetItem(STORAGE_KEYS.SESSION_META);
        if (meta?.savedAt && (Date.now() - meta.savedAt < CONFIG.IDB_SESSION_TTL_MS)) {
          debugLog("log", "IDB", `✅ Session récupérée (fallback user_active): ${user.email}`);
          return { user, meta };
        }
      }
      return null;
    }
    const { user, meta } = session;
    if (!meta?.savedAt) return { user, meta: {} };

    const age = Date.now() - meta.savedAt;
    if (age > CONFIG.IDB_SESSION_TTL_MS) {
      debugLog("warn", "IDB", `⚠️ Session IDB expirée (${Math.round(age / 86400000)}j)`);
      return null;
    }
    debugLog("log", "IDB", `✅ Session récupérée: ${user.email} (${Math.round(age / 3600000)}h)`);
    return { user, meta };
  } catch (err) {
    debugLog("warn", "IDB", "Erreur getSessionFromIDB", err.message);
    const user = secureGetItem(STORAGE_KEYS.USER_INFO);
    return user?._id ? { user, meta: {} } : null;
  }
};

const clearSessionFromIDB = async () => {
  try {
    await Promise.all([
      idbDelete("users", "user_active").catch(() => {}),
      idbDelete("users", "session_meta").catch(() => {}),
    ]);
  } catch {}
  secureRemoveItem(STORAGE_KEYS.USER_INFO);
  secureRemoveItem(STORAGE_KEYS.SESSION_META);
};

// ============================================
// AXIOS INSTANCE
// ============================================
const authAxios = axios.create({
  baseURL:         BACKEND_URL,
  timeout:         30000,
  withCredentials: true,
  headers:         { "Content-Type": "application/json" },
});

function applyUserLanguage(user) {
  if (user?.language) {
    applyLanguage(user.language);
    debugLog("log", "Language", `✅ Langue: ${user.language}`);
  }
}

// ============================================
// RETRY HELPER
// ============================================
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const withRetry = async (fn, retries = 3, baseDelay = 1000) => {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const isClientError = err?.response?.status >= 400 && err?.response?.status < 500;
      if (isClientError) throw err;
      if (i < retries - 1) {
        const delay = baseDelay * Math.pow(2, i);
        debugLog("warn", "Retry", `Tentative ${i + 2}/${retries} dans ${delay}ms`);
        await sleep(delay);
      }
    }
  }
  throw lastErr;
};

// ============================================
// PROVIDER
// ============================================
export function AuthProvider({ children }) {
  const [user, setUser]                     = useState(null);
  const [token, setToken]                   = useState(null);
  const [tokenExpiresAt, setTokenExpiresAt] = useState(null);
  const [notifications, setNotifications]   = useState([]);
  const [loading, setLoading]               = useState(false);
  const [ready, setReady]                   = useState(false);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [loginAttempts, setLoginAttempts]   = useState({});

  const isMounted          = useRef(true);
  const refreshInterval    = useRef(null);
  const isRefreshing       = useRef(false);
  const refreshQueue       = useRef([]);
  const lastRefreshAttempt = useRef(0);
  const socketRef          = useRef(null);
  const getTokenRef        = useRef(null);
  const broadcastRef       = useRef(null);
  const visibilityHandler  = useRef(null);
  const idbUserRef         = useRef(null);
  // ✅ Ref pour accéder à l'userId courant dans logout (évite closure stale)
  const currentUserRef     = useRef(null);

  // Garder currentUserRef à jour
  useEffect(() => {
    currentUserRef.current = user;
  }, [user]);

  // ============================================
  // BROADCAST CHANNEL
  // ============================================
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    try {
      const bc = new BroadcastChannel(CONFIG.BROADCAST_CHANNEL_NAME);
      bc.onmessage = (event) => {
        const { type, data } = event.data || {};
        if (type === "LOGOUT") {
          debugLog("log", "BC", "🔄 Logout reçu d'un autre onglet");
          setUser(null); setToken(null); setTokenExpiresAt(null);
        }
        if (type === "SESSION_UPDATE" && data?.user) {
          debugLog("log", "BC", `🔄 Session MAJ depuis un autre onglet: ${data.user.email}`);
          setUser(data.user);
          if (data.token)     setToken(data.token);
          if (data.expiresAt) setTokenExpiresAt(data.expiresAt);
        }
      };
      broadcastRef.current = bc;
      return () => bc.close();
    } catch {}
  }, []);

  const broadcastSession = useCallback((type, data = {}) => {
    try { broadcastRef.current?.postMessage({ type, data }); } catch {}
  }, []);

  // ============================================
  // NOTIFICATIONS
  // ============================================
  const addNotification = useCallback((type, message) => {
    const safeMessage = typeof message === "string" ? message : "Action effectuée";
    setNotifications((prev) => [
      ...prev.slice(-CONFIG.MAX_NOTIFICATIONS + 1),
      { id: Date.now() + Math.random(), type, message: safeMessage, time: Date.now() },
    ]);
  }, []);

  // ============================================
  // LOGIN ATTEMPTS
  // ============================================
  const trackLoginAttempt = useCallback((email) => {
    const key = email.toLowerCase();
    setLoginAttempts((prev) => {
      const attempts     = (prev[key]?.count || 0) + 1;
      const lockoutUntil = attempts >= CONFIG.MAX_LOGIN_ATTEMPTS
        ? Date.now() + CONFIG.LOCKOUT_DURATION_MS : null;
      const updated = { ...prev, [key]: { count: attempts, lockoutUntil } };
      secureSetItem(STORAGE_KEYS.LOGIN_ATTEMPTS, updated);
      return updated;
    });
  }, []);

  const isLockedOut = useCallback((email) => {
    const key     = email.toLowerCase();
    const attempt = loginAttempts[key];
    if (!attempt?.lockoutUntil) return false;
    if (Date.now() > attempt.lockoutUntil) {
      setLoginAttempts((prev) => {
        const updated = { ...prev };
        delete updated[key];
        secureSetItem(STORAGE_KEYS.LOGIN_ATTEMPTS, updated);
        return updated;
      });
      return false;
    }
    return true;
  }, [loginAttempts]);

  const resetLoginAttempts = useCallback((email) => {
    const key = email.toLowerCase();
    setLoginAttempts((prev) => {
      const updated = { ...prev };
      delete updated[key];
      secureSetItem(STORAGE_KEYS.LOGIN_ATTEMPTS, updated);
      return updated;
    });
  }, []);

  // ============================================
  // SOCKET CLEANUP
  // ============================================
  const cleanupSocket = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }, []);

  // ============================================
  // ✅ DÉCONNEXION — avec clearContactsCache
  // ============================================
  const logout = useCallback(async (silent = false) => {
    debugLog("log", "Logout", `Déconnexion (silent: ${silent})`);

    // ✅ FIX CRITIQUE : vider le cache contacts de cet utilisateur
    // AVANT de réinitialiser le state (user encore disponible via ref)
    const currentUserId = currentUserRef.current?._id || currentUserRef.current?.id;
    if (currentUserId) {
      try {
        clearContactsCache(currentUserId);
        debugLog("log", "Logout", `🧹 Cache contacts vidé pour: ${currentUserId}`);
      } catch (err) {
        debugLog("warn", "Logout", "Erreur clearContactsCache", err.message);
      }
    }

    try { await authAxios.post("/api/auth/logout").catch(() => {}); } catch {}
    cleanupSocket();
    broadcastSession("LOGOUT");
    setUser(null); setToken(null); setTokenExpiresAt(null);
    await clearSessionFromIDB();
    if (!silent) addNotification("info", "Déconnecté");
  }, [cleanupSocket, addNotification, broadcastSession]);

  // ============================================
  // APPLIQUER UNE SESSION
  // ============================================
  const applySession = useCallback(async ({ token: newToken, expiresIn, user: userData }) => {
    const expiresAt = Date.now() + (expiresIn || 3600) * 1000;
    setToken(newToken);
    setTokenExpiresAt(expiresAt);
    setUser(userData);
    await persistSessionToIDB(userData, { expiresAt, lastRefresh: Date.now() });
    applyUserLanguage(userData);
    broadcastSession("SESSION_UPDATE", { user: userData, token: newToken, expiresAt });
  }, [broadcastSession]);

  // ============================================
  // REFRESH TOKEN
  // ============================================
  const refreshAccessToken = useCallback(async () => {
    const now = Date.now();
    if (now - lastRefreshAttempt.current < CONFIG.REFRESH_COOLDOWN_MS) {
      debugLog("log", "Refresh", "⏳ Cooldown actif, skip");
      return false;
    }
    lastRefreshAttempt.current = now;

    if (isRefreshing.current) {
      return new Promise((resolve) => { refreshQueue.current.push(resolve); });
    }

    isRefreshing.current = true;
    debugLog("log", "Refresh", "🔄 Tentative refresh...");

    try {
      const res = await withRetry(
        () => authAxios.post("/api/auth/refresh-token"),
        CONFIG.MAX_REFRESH_RETRIES,
        1000
      );

      if (!res.data.success || !res.data.token)
        throw new Error(res.data?.message || "Réponse invalide");

      await applySession(res.data);
      debugLog("log", "Refresh", `✅ Token rafraîchi: ${res.data.user?.email}`);

      const queue = [...refreshQueue.current]; refreshQueue.current = [];
      queue.forEach((resolve) => resolve(true));
      return true;
    } catch (err) {
      const summary = summarizeAxiosError(err);
      debugLog("warn", "Refresh", "⚠️ Refresh échoué", summary);

      if (err.response?.status === 401) {
        debugLog("warn", "Refresh", "🚫 401 → logout silencieux");
        await logout(true);
      }

      const queue = [...refreshQueue.current]; refreshQueue.current = [];
      queue.forEach((resolve) => resolve(false));
      return false;
    } finally {
      isRefreshing.current = false;
    }
  }, [applySession, logout]);

  // ============================================
  // GET TOKEN
  // ============================================
  const getToken = useCallback(async () => {
    if (!token) return null;
    const timeLeft = (tokenExpiresAt || 0) - Date.now();
    if (timeLeft < CONFIG.TOKEN_REFRESH_MARGIN_MS) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) return null;
    }
    return token;
  }, [token, tokenExpiresAt, refreshAccessToken]);

  useEffect(() => { getTokenRef.current = getToken; }, [getToken]);

  // ============================================
  // CHARGEMENT INITIAL — IDB FIRST
  // ============================================
  const loadSession = useCallback(async () => {
    const storedAttempts = secureGetItem(STORAGE_KEYS.LOGIN_ATTEMPTS) || {};
    setLoginAttempts(storedAttempts);
    setReady(true);

    // ─── PHASE 1 : IDB first (instantané) ───
    try {
      const cached = await getSessionFromIDB();
      if (cached?.user?._id) {
        idbUserRef.current = cached.user;
        setUser(cached.user);
        applyUserLanguage(cached.user);
        debugLog("log", "AutoLogin", `⚡ IDB restauré: ${cached.user.email}`);
        setSessionLoading(false);
      }
    } catch (err) {
      debugLog("warn", "AutoLogin", "IDB phase 1 error", err.message);
    }

    // ─── PHASE 2 : Refresh en arrière-plan ───
    const doNetworkRefresh = async () => {
      try {
        const res = await withRetry(
          () => authAxios.post("/api/auth/refresh-token"),
          CONFIG.MAX_REFRESH_RETRIES,
          1000
        );

        if (res.data.success && res.data.token) {
          await applySession(res.data);
          debugLog("log", "AutoLogin", `✅ Token rafraîchi en BG: ${res.data.user?.email}`);
        }
      } catch (err) {
        const summary = summarizeAxiosError(err);

        if (err.response?.status === 401) {
          if (idbUserRef.current) {
            debugLog("warn", "AutoLogin", "🚫 401 serveur → logout (session révoquée)");
            await logout(true);
          }
        } else if (!navigator.onLine || summary.isNetwork) {
          debugLog("log", "AutoLogin", "📴 Offline → session IDB conservée");
        } else {
          debugLog("warn", "AutoLogin", "⚠️ Erreur serveur → session IDB conservée");
        }
      } finally {
        if (isMounted.current) setSessionLoading(false);
      }
    };

    if (!idbUserRef.current) {
      await doNetworkRefresh();
    } else {
      doNetworkRefresh();
    }
  }, [applySession, logout]);

  // ============================================
  // VISIBILITY API
  // ============================================
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState !== "visible") return;
      if (!user?._id) return;

      const meta = secureGetItem(STORAGE_KEYS.SESSION_META);
      const lastRefresh = meta?.lastRefresh || 0;
      const timeSinceLast = Date.now() - lastRefresh;

      const needsRefresh = timeSinceLast > 30 * 60 * 1000 ||
        (tokenExpiresAt && (tokenExpiresAt - Date.now()) < CONFIG.TOKEN_REFRESH_MARGIN_MS);

      if (needsRefresh) {
        debugLog("log", "Visibility", "👁 Retour onglet → refresh discret");
        setTimeout(() => {
          if (isMounted.current) refreshAccessToken();
        }, CONFIG.VISIBILITY_RECHECK_DELAY);
      }
    };

    visibilityHandler.current = handler;
    document.addEventListener("visibilitychange", handler, { passive: true });
    return () => document.removeEventListener("visibilitychange", handler);
  }, [user?._id, tokenExpiresAt, refreshAccessToken]);

  // ============================================
  // ONLINE RECOVERY
  // ============================================
  useEffect(() => {
    const handleOnline = () => {
      debugLog("log", "Network", "🌐 Réseau rétabli → refresh");
      if (user?._id && !token) {
        refreshAccessToken();
      } else if (user?._id) {
        const timeLeft = (tokenExpiresAt || 0) - Date.now();
        if (timeLeft < CONFIG.TOKEN_REFRESH_MARGIN_MS) refreshAccessToken();
      }
    };
    window.addEventListener("online", handleOnline, { passive: true });
    return () => window.removeEventListener("online", handleOnline);
  }, [user?._id, token, tokenExpiresAt, refreshAccessToken]);

  // ============================================
  // CONNEXION
  // ============================================
  const login = useCallback(async (email, password, rememberMe = false) => {
    const safeEmail = (email || "").toString().trim().toLowerCase();
    setLoading(true);
    try {
      const res = await authAxios.post("/api/auth/login", {
        email: safeEmail, password: password.toString(), rememberMe,
      });
      if (!res.data.success) throw new Error(res.data?.message || "Erreur login");

      await applySession(res.data);
      localStorage.setItem("cl_last_email", safeEmail);
      resetLoginAttempts(safeEmail);
      addNotification("success", "Connecté avec succès");
      debugLog("log", "Login", `✅ Connecté: ${safeEmail}`);
      return { success: true, user: res.data.user };
    } catch (err) {
      debugLog("error", "Login", "❌ Échec", summarizeAxiosError(err));
      trackLoginAttempt(safeEmail);
      const msg = err.response?.data?.message || err.message || "Erreur connexion";
      addNotification("error", msg);
      return { success: false, message: msg };
    } finally {
      setLoading(false);
    }
  }, [applySession, addNotification, trackLoginAttempt, resetLoginAttempts]);

  // ============================================
  // INSCRIPTION
  // ============================================
  const register = useCallback(async (fullName, email, password, rememberMe = false, language = "fr") => {
    setLoading(true);
    try {
      const res = await authAxios.post("/api/auth/register", {
        fullName, email, password, rememberMe, language,
      });
      if (!res.data.success) throw new Error(res.data?.message || "Erreur inscription");

      await applySession(res.data);
      localStorage.setItem("cl_last_email", email.trim().toLowerCase());
      addNotification("success", "Compte créé avec succès !");
      return { success: true, user: res.data.user };
    } catch (err) {
      debugLog("error", "Register", "❌ Échec", summarizeAxiosError(err));
      const msg = err.response?.data?.message || err.message || "Erreur inscription";
      addNotification("error", msg);
      return { success: false, message: msg };
    } finally {
      setLoading(false);
    }
  }, [applySession, addNotification]);

  // ============================================
  // MISE À JOUR PROFIL
  // ============================================
  const updateUserProfile = useCallback(async (userIdOrUpdates, maybeUpdates) => {
    const userId  = typeof userIdOrUpdates === "string" ? userIdOrUpdates : user?._id;
    const updates = typeof userIdOrUpdates === "string" ? maybeUpdates : userIdOrUpdates;
    if (!updates) return;

    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...updates };
      persistSessionToIDB(updated, { lastRefresh: Date.now() }).catch(() => {});
      return updated;
    });

    const isPhotoUpdate = !!(updates.profilePhoto || updates.coverPhoto);
    if (isPhotoUpdate) {
      debugLog("log", "UpdateProfile", "📸 Photo update — skip PUT /:id");
      return;
    }

    if (userId) {
      try {
        const currentToken = await getTokenRef.current?.();
        if (currentToken) {
          const res = await axios.put(
            `${API_URL}/users/${userId}`,
            updates,
            {
              headers:         { Authorization: `Bearer ${currentToken}` },
              withCredentials: true,
              timeout:         15000,
            }
          );
          if (res.data?.user) {
            const serverUser = res.data.user;
            setUser((prev) => {
              if (!prev) return prev;
              const synced = { ...prev, ...serverUser };
              persistSessionToIDB(synced, { lastRefresh: Date.now() }).catch(() => {});
              return synced;
            });
          }
        }
      } catch (err) {
        debugLog("warn", "UpdateProfile", "⚠️ API échouée", summarizeAxiosError(err));
      }
    }
  }, [user?._id]);

  // ============================================
  // VÉRIFICATION ADMIN
  // ============================================
  const verifyAdminToken = useCallback(async () => {
    const currentToken = await getToken();
    if (!currentToken) return null;
    try {
      const res = await axios.get(`${API_URL}/admin/verify`, {
        headers:         { Authorization: `Bearer ${currentToken}` },
        withCredentials: true,
        timeout:         10000,
      });
      if (res.status === 200 &&
        (res.data.user?.role === "admin" || res.data.user?.role === "superadmin")) {
        return currentToken;
      }
      return null;
    } catch { return null; }
  }, [getToken]);

  // ============================================
  // SOCKET
  // ============================================
  useEffect(() => {
    if (!user?._id || !token) { cleanupSocket(); return; }
    if (socketRef.current?.connected && socketRef.current?.auth?.token === token) return;

    cleanupSocket();
    const newSocket = io(SOCKET_URL, {
      auth:                 { token },
      transports:           ["websocket", "polling"],
      reconnection:         true,
      reconnectionAttempts: 10,
      reconnectionDelay:    1000,
      reconnectionDelayMax: 10000,
      timeout:              10000,
    });

    newSocket.on("connect",       () => debugLog("log",  "Socket", `✅ ${newSocket.id}`));
    newSocket.on("connect_error", (err) => debugLog("warn", "Socket", `⚠️ ${err.message}`));

    socketRef.current = newSocket;
    return () => cleanupSocket();
  }, [user?._id, token, cleanupSocket]);

  // ============================================
  // REFRESH AUTO (heartbeat)
  // ============================================
  useEffect(() => {
    if (!ready || !token) return;
    refreshInterval.current = setInterval(() => {
      const timeLeft = (tokenExpiresAt || 0) - Date.now();
      if (timeLeft > 0 && timeLeft < CONFIG.TOKEN_REFRESH_MARGIN_MS) {
        debugLog("log", "Heartbeat", `⏰ Refresh auto (${Math.round(timeLeft / 1000)}s restants)`);
        refreshAccessToken();
      }
    }, CONFIG.AUTO_REFRESH_INTERVAL_MS);
    return () => clearInterval(refreshInterval.current);
  }, [ready, token, tokenExpiresAt, refreshAccessToken]);

  // ============================================
  // CHARGEMENT INITIAL
  // ============================================
  useEffect(() => {
    loadSession();
    return () => { isMounted.current = false; };
  }, [loadSession]);

  // ============================================
  // INJECT AXIOS HANDLERS
  // ============================================
  useEffect(() => {
    injectAuthHandlers({ getToken, logout, notify: addNotification });
  }, [getToken, logout, addNotification]);

  // ============================================
  // VALEUR DU CONTEXTE
  // ============================================
  const value = useMemo(() => {
    const isAdmin = user?.role === "admin" || user?.role === "superadmin";
    return {
      user, token, socket: socketRef.current, loading, ready,
      sessionLoading,
      isAuthenticated: !!user,
      notifications,
      login, logout, register, getToken, updateUserProfile,
      verifyAdminToken, isAdmin: () => isAdmin, addNotification, isLockedOut,
    };
  }, [
    user, token, loading, ready, sessionLoading, notifications,
    login, logout, register, getToken,
    updateUserProfile, verifyAdminToken, addNotification, isLockedOut,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}