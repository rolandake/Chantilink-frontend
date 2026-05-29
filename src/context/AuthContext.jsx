// src/context/AuthContext.jsx
// VERSION SIMPLIFIÉE — robuste, sans deadlock sessionLoading

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

const API_URL = isProd
  ? (import.meta.env.VITE_API_URL_PROD     || "https://chantilink-backend.onrender.com/api")
  : (import.meta.env.VITE_API_URL_LOCAL    || import.meta.env.VITE_API_URL || (import.meta.env.PROD ? "https://chantilink-backend.onrender.com/api" : "http://localhost:5000/api"));

const BACKEND_URL = API_URL.replace("/api", "");

console.log(`🔧 [AuthContext] ${isProd ? "PROD" : "DEV"} — ${API_URL}`);

// ─── AXIOS ────────────────────────────────────────────────────────────────────
const authAxios = axios.create({
  baseURL:         BACKEND_URL,
  timeout:         10000,
  withCredentials: true,
  headers:         { "Content-Type": "application/json" },
});

// ─── IDB ──────────────────────────────────────────────────────────────────────
const SESSION_TTL = 90 * 24 * 60 * 60 * 1000; // 90 jours

async function saveSession(user) {
  if (!user?._id) return;
  try {
    await Promise.all([
      idbSet("users", "user_active",  user),
      idbSet("users", "session_meta", { user, savedAt: Date.now() }),
    ]);
    localStorage.setItem("cl_user", JSON.stringify(user));
  } catch {}
}

async function loadCachedSession() {
  try {
    const s = await idbGet("users", "session_meta").catch(() => null);
    if (s?.user?._id && Date.now() - s.savedAt < SESSION_TTL) return s.user;
  } catch {}
  // fallback localStorage
  try {
    const raw = localStorage.getItem("cl_user");
    if (raw) return JSON.parse(raw);
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

  const socketRef       = useRef(null);
  const isMounted       = useRef(true);
  const isRefreshing    = useRef(false);
  const currentUserRef  = useRef(null);
  const getTokenRef     = useRef(null);

  useEffect(() => { currentUserRef.current = user; }, [user]);

  // ─── NOTIFICATIONS ──────────────────────────────────────────────────────────
  const addNotification = useCallback((type, message) => {
    const msg = typeof message === "string" ? message : "Action effectuée";
    setNotifications(p => [...p.slice(-49), { id: Date.now() + Math.random(), type, message: msg }]);
  }, []);

  // ─── APPLIQUER SESSION ──────────────────────────────────────────────────────
  const applySession = useCallback(async ({ token: tk, expiresIn, user: u }) => {
    const expiresAt = Date.now() + (expiresIn || 3600) * 1000;
    setToken(tk);
    setTokenExpiresAt(expiresAt);
    setUser(u);
    if (u?.language) applyLanguage(u.language);
    await saveSession(u);
  }, []);

  // ─── LOGOUT ─────────────────────────────────────────────────────────────────
  const logout = useCallback(async (silent = false) => {
    const uid = currentUserRef.current?._id;
    if (uid) { try { clearContactsCache(uid); } catch {} }
    try { await authAxios.post("/api/auth/logout").catch(() => {}); } catch {}
    if (socketRef.current) { socketRef.current.disconnect(); socketRef.current = null; }
    setUser(null); setToken(null); setTokenExpiresAt(null);
    await clearSession();
    if (!silent) addNotification("info", "Déconnecté");
  }, [addNotification]);

  // ─── REFRESH TOKEN ──────────────────────────────────────────────────────────
  const refreshAccessToken = useCallback(async () => {
    if (isRefreshing.current) return false;
    isRefreshing.current = true;
    try {
      const res = await authAxios.post("/api/auth/refresh-token");
      if (!res.data?.success || !res.data?.token) return false;
      await applySession(res.data);
      return true;
    } catch (err) {
      if (err?.response?.status === 401) await logout(true);
      return false;
    } finally {
      isRefreshing.current = false;
    }
  }, [applySession, logout]);

  // ─── GET TOKEN ───────────────────────────────────────────────────────────────
  const getToken = useCallback(async () => {
    if (!token) return null;
    const timeLeft = (tokenExpiresAt || 0) - Date.now();
    if (timeLeft < 3 * 60 * 1000) {
      const ok = await refreshAccessToken();
      if (!ok) return null;
    }
    return token;
  }, [token, tokenExpiresAt, refreshAccessToken]);

  useEffect(() => { getTokenRef.current = getToken; }, [getToken]);

  // ─── CHARGEMENT INITIAL ──────────────────────────────────────────────────────
  // ✅ FIX PRINCIPAL :
  //   1. isMounted.current = true  → réinitialise le flag à chaque montage (React StrictMode
  //      appelle cleanup + remount, ce qui laissait isMounted=false lors du 2e run)
  //   2. Safety timer 5 s          → filet de sécurité absolu, débloque le shimmer même si
  //      le réseau est coupé ou si une edge-case imprévue empêche le finally de setter l'état
  useEffect(() => {
    let cancelled = false;

    // ✅ FIX 1 — réinitialiser isMounted pour le cycle actuel (corrige le bug StrictMode)
    isMounted.current = true;

    // ✅ FIX 2 — safety timer : sessionLoading passe à false dans TOUS les cas sous 5 s max
    const safetyTimer = setTimeout(() => {
      if (!cancelled && isMounted.current) {
        console.warn("⏱️ [AuthContext] Safety timeout — forcing sessionLoading=false");
        setReady(true);
        setSessionLoading(false);
      }
    }, 5000);

    const init = async () => {
      // 1. Restaurer depuis cache (instantané, pas de réseau)
      try {
        const cached = await loadCachedSession();
        if (cached?._id && !cancelled) {
          setUser(cached);
          if (cached.language) applyLanguage(cached.language);
        }
      } catch {}

      // 2. Valider côté serveur (en background)
      try {
        const res = await authAxios.post("/api/auth/refresh-token");
        if (!cancelled && res.data?.success && res.data?.token) {
          await applySession(res.data);
        }
      } catch (err) {
        // 401 = session révoquée → logout silencieux
        if (err?.response?.status === 401 && !cancelled) {
          setUser(null);
          await clearSession();
        }
        // Toute autre erreur (réseau, timeout) → on garde le cache
      } finally {
        // Annule le safety timer : on a terminé normalement
        clearTimeout(safetyTimer);
        // ✅ TOUJOURS atteint — fin du blocage
        if (!cancelled && isMounted.current) {
          setReady(true);
          setSessionLoading(false);
        }
      }
    };

    init();

    return () => {
      cancelled = true;
      isMounted.current = false;
      clearTimeout(safetyTimer);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── INJECT AXIOS ────────────────────────────────────────────────────────────
  useEffect(() => {
    const getLanguage = () => {
      try {
        if (user?.language) return user.language;
        if (typeof window !== 'undefined') {
          const l = window.localStorage?.getItem('cl_lang');
          if (l) return l;
          const nav = navigator?.language || navigator?.userLanguage || 'fr';
          return String(nav).split('-')[0];
        }
      } catch (e) {}
      return 'fr';
    };

    injectAuthHandlers({ getToken, logout, notify: addNotification, getLanguage });
  }, [getToken, logout, addNotification, user?.language]);

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
      reconnectionAttempts: 5,
      timeout:              8000,
    });
    s.on("connect",       () => console.log("🔌 Socket connecté:", s.id));
    s.on("connect_error", (e) => console.warn("⚠️ Socket:", e.message));
    socketRef.current = s;
    return () => { s.disconnect(); socketRef.current = null; };
  }, [user?._id, token]);

  // ─── REFRESH AUTO (heartbeat toutes les 60s) ─────────────────────────────────
  useEffect(() => {
    if (!token) return;
    const id = setInterval(() => {
      const left = (tokenExpiresAt || 0) - Date.now();
      if (left > 0 && left < 3 * 60 * 1000) refreshAccessToken();
    }, 60_000);
    return () => clearInterval(id);
  }, [token, tokenExpiresAt, refreshAccessToken]);

  // ─── RECOVERY RÉSEAU ─────────────────────────────────────────────────────────
  useEffect(() => {
    const onOnline = () => {
      if (user?._id) refreshAccessToken();
    };
    window.addEventListener("online", onOnline, { passive: true });
    return () => window.removeEventListener("online", onOnline);
  }, [user?._id, refreshAccessToken]);

  // ─── LOGIN ───────────────────────────────────────────────────────────────────
  const login = useCallback(async (email, password, rememberMe = false) => {
    setLoading(true);
    try {
      const res = await authAxios.post("/api/auth/login", {
        email: email.trim().toLowerCase(), password: String(password), rememberMe,
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
  const register = useCallback(async (fullName, email, password, rememberMe = false, language = "fr") => {
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

  // ─── SET AUTH DATA (OAuth/reset password handoff) ────────────────────────────
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
      saveSession(updated).catch(() => {});
      return updated;
    });
    const isPhotoUpdate = !!(updates.profilePhoto || updates.coverPhoto);
    if (!isPhotoUpdate && userId) {
      try {
        const tk = await getTokenRef.current?.();
        if (tk) {
          const res = await axios.put(`${API_URL}/users/${userId}`, updates, {
            headers: { Authorization: `Bearer ${tk}` },
            withCredentials: true,
            timeout: 10000,
          });
          if (res.data?.user) {
            setUser(prev => {
              if (!prev) return prev;
              const synced = { ...prev, ...res.data.user };
              saveSession(synced).catch(() => {});
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
        headers: { Authorization: `Bearer ${tk}` }, withCredentials: true, timeout: 8000,
      });
      if (res.status === 200 && ["admin","superadmin"].includes(res.data.user?.role)) return tk;
    } catch {}
    return null;
  }, [getToken]);

  // ─── isLockedOut (stub) ───────────────────────────────────────────────────────
  const isLockedOut = useCallback(() => false, []);

  // ─── VALEUR CONTEXTE ─────────────────────────────────────────────────────────
  const value = useMemo(() => ({
    user, token, socket: socketRef.current,
    loading, ready, sessionLoading,
    isAuthenticated: !!user,
    notifications,
    login, logout, register, setAuthData, getToken, updateUserProfile,
    verifyAdminToken, isAdmin: () => ["admin","superadmin"].includes(user?.role),
    addNotification, isLockedOut,
  }), [
    user, token, loading, ready, sessionLoading, notifications,
    login, logout, register, setAuthData, getToken, updateUserProfile,
    verifyAdminToken, addNotification, isLockedOut,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
