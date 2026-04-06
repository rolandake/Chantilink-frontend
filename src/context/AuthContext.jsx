// src/context/AuthContext.jsx - VERSION AVEC SYNC LANGUE ⚡
// ✅ Toutes les fonctionnalités précédentes conservées
// ✅ NOUVEAU : après login/register/refresh → applyLanguage(user.language)
//    → La langue de l'utilisateur est appliquée automatiquement à la connexion
// ✅ NOUVEAU : AuthContext exporté pour AppBridge

import React, {
  createContext, useContext, useState, useEffect,
  useCallback, useMemo, useRef
} from "react";
import axios from "axios";
import { io } from "socket.io-client";
import { injectAuthHandlers } from "../api/axiosClientGlobal";
import { idbSet, idbGet, idbDelete } from "../utils/idbMigration";
import { applyLanguage } from "../i18n"; // ← NOUVEAU

// ✅ Export nommé du contexte (pour AppLanguageBridge dans main.jsx)
export const AuthContext = createContext({
  user: null, token: null, socket: null, loading: false, ready: false,
  isAuthenticated: false, notifications: [],
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
  TOKEN_REFRESH_MARGIN_MS:  3 * 60 * 1000,
  AUTO_REFRESH_INTERVAL_MS: 60 * 1000,
  MAX_NOTIFICATIONS:        50,
  MAX_LOGIN_ATTEMPTS:       5,
  LOCKOUT_DURATION_MS:      15 * 60 * 1000,
  MAX_REFRESH_RETRIES:      3,
  REFRESH_COOLDOWN_MS:      5000,
};

const STORAGE_KEYS = {
  USER_INFO:      "chantilink_user_info_v8",
  LOGIN_ATTEMPTS: "chantilink_login_attempts_v8",
};

const secureSetItem = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); }
  catch (err) { debugLog("warn", "Storage", "setItem échec", err); }
};
const secureGetItem = (key) => {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; }
  catch { return null; }
};
const secureRemoveItem = (key) => { try { localStorage.removeItem(key); } catch {} };

const authAxios = axios.create({
  baseURL:         BACKEND_URL,
  timeout:         30000,
  withCredentials: true,
  headers:         { "Content-Type": "application/json" },
});

// ============================================
// HELPER : applique la langue du user si disponible
// ============================================
function applyUserLanguage(user) {
  if (user?.language) {
    applyLanguage(user.language);
    debugLog("log", "Language", `✅ Langue appliquée depuis user: ${user.language}`);
  }
}

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
  // TENTATIVES DE CONNEXION
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
  // SYNC IDB
  // ============================================
  const syncUserToIDB = useCallback(async (userData) => {
    if (!userData?._id) return;
    try {
      await Promise.all([
        idbSet("users", `user_${userData._id}`, userData),
        idbSet("users", "user_active", userData),
      ]);
    } catch (err) {
      debugLog("warn", "IDB", "Échec sync", err.message);
    }
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
  // DÉCONNEXION
  // ============================================
  const logout = useCallback(async (silent = false) => {
    debugLog("log", "Logout", `Déconnexion (silent: ${silent})`);
    try { await authAxios.post("/api/auth/logout").catch(() => {}); } catch {}
    cleanupSocket();
    setUser(null); setToken(null); setTokenExpiresAt(null);
    secureRemoveItem(STORAGE_KEYS.USER_INFO);
    await idbDelete("users", "user_active").catch(() => {});
    if (!silent) addNotification("info", "Déconnecté");
  }, [cleanupSocket, addNotification]);

  // ============================================
  // REFRESH TOKEN
  // ============================================
  const refreshAccessToken = useCallback(async (retryCount = 0) => {
    const now = Date.now();
    if (now - lastRefreshAttempt.current < CONFIG.REFRESH_COOLDOWN_MS) return false;
    lastRefreshAttempt.current = now;

    if (isRefreshing.current) {
      return new Promise((resolve) => { refreshQueue.current.push(resolve); });
    }

    isRefreshing.current = true;

    try {
      const res = await authAxios.post("/api/auth/refresh-token");
      if (!res.data.success || !res.data.token)
        throw new Error(res.data?.message || "Réponse invalide");

      const { token: newToken, expiresIn, user: updatedUser } = res.data;
      const expiresAt = Date.now() + (expiresIn || 3600) * 1000;

      setToken(newToken); setTokenExpiresAt(expiresAt);
      if (updatedUser) {
        setUser(updatedUser);
        secureSetItem(STORAGE_KEYS.USER_INFO, updatedUser);
        await syncUserToIDB(updatedUser);
        // ✅ NOUVEAU : appliquer la langue du user au refresh
        applyUserLanguage(updatedUser);
      }

      const queue = [...refreshQueue.current]; refreshQueue.current = [];
      queue.forEach((resolve) => resolve(true));
      return true;
    } catch (err) {
      const summary = summarizeAxiosError(err);
      debugLog("error", "Refresh", "❌ Échec refresh", summary);

      const isClientError = err.response?.status >= 400 && err.response?.status < 500;
      if (!isClientError && retryCount < CONFIG.MAX_REFRESH_RETRIES - 1) {
        isRefreshing.current = false;
        await new Promise((r) => setTimeout(r, 2000));
        return refreshAccessToken(retryCount + 1);
      }
      if (err.response?.status === 401) await logout(true);

      const queue = [...refreshQueue.current]; refreshQueue.current = [];
      queue.forEach((resolve) => resolve(false));
      return false;
    } finally {
      isRefreshing.current = false;
    }
  }, [logout, syncUserToIDB]);

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

  // ============================================
  // AUTO-LOGIN
  // ============================================
  const loadSession = useCallback(async () => {
    const storedAttempts = secureGetItem(STORAGE_KEYS.LOGIN_ATTEMPTS) || {};
    setLoginAttempts(storedAttempts);
    setReady(true); // FIX LCP : visible immédiatement

    try {
      const res = await authAxios.post("/api/auth/refresh-token");

      if (res.data.success && res.data.token) {
        const { token: newToken, expiresIn, user: userData } = res.data;
        const expiresAt = Date.now() + (expiresIn || 3600) * 1000;
        setToken(newToken); setTokenExpiresAt(expiresAt); setUser(userData);
        secureSetItem(STORAGE_KEYS.USER_INFO, userData);
        await syncUserToIDB(userData);
        // ✅ NOUVEAU : appliquer la langue sauvegardée en base
        applyUserLanguage(userData);
        debugLog("log", "AutoLogin", `✅ Reconnecté: ${userData?.email} (lang: ${userData?.language})`);
      }
    } catch (err) {
      const summary = summarizeAxiosError(err);
      if (err.response?.status !== 401) {
        debugLog("error", "AutoLogin", "❌ Erreur inattendue", summary);
      }

      if (!navigator.onLine) {
        const idbUser = await idbGet("users", "user_active").catch(() => null);
        if (idbUser?._id) {
          setUser(idbUser);
          applyUserLanguage(idbUser); // ✅ Appliquer la langue même en offline
        }
      }
    } finally {
      setSessionLoading(false);
    }
  }, [syncUserToIDB]);

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

      const { token: newToken, expiresIn, user: userData } = res.data;
      const expiresAt = Date.now() + (expiresIn || 3600) * 1000;
      setToken(newToken); setTokenExpiresAt(expiresAt); setUser(userData);
      secureSetItem(STORAGE_KEYS.USER_INFO, userData);
      await syncUserToIDB(userData);
      resetLoginAttempts(safeEmail);
      addNotification("success", "Connecté avec succès");
      // ✅ NOUVEAU : appliquer la langue préférée de l'utilisateur
      applyUserLanguage(userData);
      debugLog("log", "Login", `✅ Connecté: ${userData?.email} (lang: ${userData?.language})`);
      return { success: true, user: userData };
    } catch (err) {
      const summary = summarizeAxiosError(err);
      debugLog("error", "Login", "❌ Échec connexion", summary);
      trackLoginAttempt(safeEmail);
      const msg = err.response?.data?.message || err.message || "Erreur connexion";
      addNotification("error", msg);
      return { success: false, message: msg };
    } finally {
      setLoading(false);
    }
  }, [addNotification, trackLoginAttempt, resetLoginAttempts, syncUserToIDB]);

  // ============================================
  // INSCRIPTION
  // ============================================
  const register = useCallback(async (fullName, email, password, rememberMe = false, language = "fr") => {
    // ✅ NOUVEAU : language passé en paramètre
    setLoading(true);
    try {
      const res = await authAxios.post("/api/auth/register", {
        fullName, email, password, rememberMe, language,
      });
      if (!res.data.success) throw new Error(res.data?.message || "Erreur inscription");

      const { token: newToken, expiresIn, user: userData } = res.data;
      const expiresAt = Date.now() + (expiresIn || 3600) * 1000;
      setToken(newToken); setTokenExpiresAt(expiresAt); setUser(userData);
      secureSetItem(STORAGE_KEYS.USER_INFO, userData);
      await syncUserToIDB(userData);
      addNotification("success", "Compte créé avec succès !");
      // ✅ NOUVEAU : appliquer la langue choisie à l'inscription
      applyUserLanguage(userData);
      return { success: true, user: userData };
    } catch (err) {
      debugLog("error", "Register", "❌ Échec inscription", summarizeAxiosError(err));
      const msg = err.response?.data?.message || err.message || "Erreur inscription";
      addNotification("error", msg);
      return { success: false, message: msg };
    } finally {
      setLoading(false);
    }
  }, [addNotification, syncUserToIDB]);

  // ============================================
  // MISE À JOUR PROFIL
  // ============================================
  const updateUserProfile = useCallback(async (userIdOrUpdates, maybeUpdates) => {
    const updates = typeof userIdOrUpdates === "string" ? maybeUpdates : userIdOrUpdates;
    if (!updates) return;

    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...updates };
      setTimeout(() => {
        secureSetItem(STORAGE_KEYS.USER_INFO, updated);
        syncUserToIDB(updated);
      }, 0);
      return updated;
    });
  }, [syncUserToIDB]);

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
      reconnectionAttempts: 5,
      reconnectionDelay:    1000,
      reconnectionDelayMax: 5000,
      timeout:              10000,
    });

    newSocket.on("connect",       ()    => debugLog("log",  "Socket", `✅ Connecté: ${newSocket.id}`));
    newSocket.on("connect_error", (err) => debugLog("warn", "Socket", `⚠️ Erreur: ${err.message}`));

    socketRef.current = newSocket;
    return () => cleanupSocket();
  }, [user?._id, token, cleanupSocket]);

  // ============================================
  // REFRESH AUTOMATIQUE
  // ============================================
  useEffect(() => {
    if (!ready || !token) return;
    refreshInterval.current = setInterval(() => {
      const timeLeft = (tokenExpiresAt || 0) - Date.now();
      if (timeLeft > 0 && timeLeft < CONFIG.TOKEN_REFRESH_MARGIN_MS) refreshAccessToken();
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
      isAuthenticated: !!user && !!token, notifications,
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