// src/context/AuthContext.jsx - VERSION CORRIGÉE
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import { injectAuthHandlers } from "../api/axiosClientGlobal";
import { idbSet, idbGet, idbDelete } from "../utils/idbMigration";

const AuthContext = createContext({
  users: new Map(),
  activeUserId: null,
  user: null,
  token: null,
  socket: null,
  loading: false,
  ready: false,
  notifications: [],
  login: async () => ({ success: false, message: 'Auth not ready' }),
  logout: async () => {},
  register: async () => ({ success: false, message: 'Auth not ready' }),
  getToken: async () => null,
  updateUserProfile: async () => {},
  verifyAdminToken: async () => null,
  isAdmin: () => false,
  addNotification: () => {},
  isLockedOut: () => false,
  getActiveUser: () => null,
  getUserById: () => null,
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth doit être utilisé dans un AuthProvider');
  return context;
};

// ✅ CORRECTION : URLs cohérentes
const getApiUrl = () => {
  const hostname = window.location.hostname;
  const isDev = hostname === 'localhost' || hostname === '127.0.0.1';
  
  if (isDev) {
    return import.meta.env.VITE_API_URL_LOCAL || 'http://localhost:5000/api';
  } else {
    return import.meta.env.VITE_API_URL_PROD || 'https://chantilink-backend.onrender.com/api';
  }
};

const API_URL = getApiUrl();
const SOCKET_URL = API_URL.replace('/api', ''); // https://chantilink-backend.onrender.com

console.log('🔧 [AuthContext] API_URL:', API_URL);
console.log('🔧 [AuthContext] SOCKET_URL:', SOCKET_URL);

const CONFIG = {
  TOKEN_REFRESH_MARGIN_MS: 10 * 60 * 1000,
  AUTO_REFRESH_INTERVAL_MS: 30 * 1000,
  SESSION_TIMEOUT_MS: 7 * 24 * 60 * 60 * 1000,
  MAX_STORED_USERS: 10,
  MAX_NOTIFICATIONS: 50,
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_DURATION_MS: 15 * 60 * 1000,
  MAX_REFRESH_RETRIES: 3,
};

const STORAGE_KEYS = {
  USERS: "chantilink_users_enc_v6",
  ACTIVE_USER: "chantilink_active_user_v6",
  LOGIN_ATTEMPTS: "chantilink_login_attempts_v6",
};

// === UTILITAIRES ===
const secureSetItem = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } 
  catch (err) { console.warn("localStorage.setItem échec:", err); }
};

const secureGetItem = (key) => {
  try { 
    const val = localStorage.getItem(key); 
    return val ? JSON.parse(val) : null; 
  } catch { return null; }
};

const secureRemoveItem = (key) => { 
  try { localStorage.removeItem(key); } catch {} 
};

// === FOURNISSEUR ===
export function AuthProvider({ children }) {
  const [users, setUsers] = useState(new Map());
  const [activeUserId, setActiveUserId] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState({});

  const isMounted = useRef(true);
  const refreshInterval = useRef(null);
  const isRefreshing = useRef(false);
  const refreshQueue = useRef([]);
  const lastRefreshAttempt = useRef(0);
  const socketRef = useRef(null);
  const REFRESH_COOLDOWN = 5000;

  // === NOTIFICATIONS ===
  const addNotification = useCallback((type, message) => {
    const safeMessage = typeof message === "string" ? message : "Action effectuée";
    console.log(`📢 [Notification] ${type.toUpperCase()}: ${safeMessage}`);
    setNotifications(prev => [
      ...prev.slice(-CONFIG.MAX_NOTIFICATIONS + 1),
      { id: Date.now() + Math.random(), type, message: safeMessage, time: Date.now() }
    ]);
  }, []);

  // === TENTATIVES DE CONNEXION ===
  const trackLoginAttempt = useCallback((email) => {
    const emailKey = email.toLowerCase();
    setLoginAttempts(prev => {
      const attempts = (prev[emailKey]?.count || 0) + 1;
      const lockoutUntil = attempts >= CONFIG.MAX_LOGIN_ATTEMPTS
        ? Date.now() + CONFIG.LOCKOUT_DURATION_MS
        : null;
      const newAttempts = { ...prev, [emailKey]: { count: attempts, lockoutUntil } };
      secureSetItem(STORAGE_KEYS.LOGIN_ATTEMPTS, newAttempts);
      return newAttempts;
    });
  }, []);

  const isLockedOut = useCallback((email) => {
    const emailKey = email.toLowerCase();
    const attempt = loginAttempts[emailKey];
    if (!attempt?.lockoutUntil) return false;
    if (Date.now() > attempt.lockoutUntil) {
      setLoginAttempts(prev => {
        const updated = { ...prev };
        delete updated[emailKey];
        secureSetItem(STORAGE_KEYS.LOGIN_ATTEMPTS, updated);
        return updated;
      });
      return false;
    }
    return true;
  }, [loginAttempts]);

  const resetLoginAttempts = useCallback((email) => {
    const emailKey = email.toLowerCase();
    setLoginAttempts(prev => {
      const updated = { ...prev };
      delete updated[emailKey];
      secureSetItem(STORAGE_KEYS.LOGIN_ATTEMPTS, updated);
      return updated;
    });
  }, []);

  // === STOCKAGE ===
  const persistUsers = useCallback((updatedUsers = users, newActiveId = activeUserId) => {
    try {
      const arr = Array.from(updatedUsers.entries())
        .map(([id, data]) => [id, {
          user: data.user,
          token: data.token,
          expiresAt: data.expiresAt,
          lastActive: data.lastActive || Date.now(),
        }])
        .sort((a, b) => b[1].lastActive - a[1].lastActive)
        .slice(0, CONFIG.MAX_STORED_USERS);

      secureSetItem(STORAGE_KEYS.USERS, Object.fromEntries(arr));
      newActiveId ? secureSetItem(STORAGE_KEYS.ACTIVE_USER, newActiveId) : secureRemoveItem(STORAGE_KEYS.ACTIVE_USER);
    } catch (err) {
      console.warn("Échec persistUsers:", err);
    }
  }, [users, activeUserId]);

  // === SYNCHRONISATION IDB ===
  const syncUserToIDB = async (userId, user) => {
    if (!userId || !user?._id) return;
    try {
      await Promise.all([
        idbSet("users", `user_${userId}`, user),
        idbSet("users", `userData_${userId}`, {
          _id: userId,
          isVerified: !!user.isVerified,
          isPremium: !!user.isPremium,
          role: user.role || "user",
          fullName: user.fullName || "",
          profilePhoto: user.profilePhoto || "",
          coverPhoto: user.coverPhoto || "",
          email: user.email || "",
          bio: user.bio || "",
          phone: user.phone || "",
          hasSeenPhoneModal: !!user.hasSeenPhoneModal,
          updatedAt: Date.now(),
        }),
        idbSet("users", "user_active", user),
      ]);
    } catch (err) {
      console.warn("Échec sync IDB:", err);
    }
  };

  // === GETTERS ===
  const getActiveUser = useCallback(() => activeUserId ? users.get(activeUserId) : null, [activeUserId, users]);
  const getUserById = useCallback((id) => users.get(id) || null, [users]);

  // === SOCKET CLEANUP ===
  const cleanupSocket = useCallback(() => {
    if (socketRef.current) {
      console.log("🛑 [AuthContext] Nettoyage Socket");
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }, []);

  // === DÉCONNEXION ===
  const logout = useCallback(async (userId = activeUserId, silent = false) => {
    if (!userId) return;

    console.log(`🔒 [Logout] Déconnexion${silent ? ' silencieuse' : ''} user:`, userId);

    cleanupSocket();

    setUsers(prev => { 
      const map = new Map(prev); 
      map.delete(userId); 
      return map; 
    });

    if (activeUserId === userId) {
      setActiveUserId(null);
      await idbDelete("users", "user_active");
    }

    persistUsers();

    if (!silent) {
      addNotification("info", "Déconnecté");
    }
  }, [activeUserId, persistUsers, addNotification, cleanupSocket]);

  // === REFRESH TOKEN ===
  const refreshTokenForUser = useCallback(async (userId, retryCount = 0) => {
    const now = Date.now();
    if (now - lastRefreshAttempt.current < REFRESH_COOLDOWN) {
      console.warn('⏰ [Refresh] Cooldown actif, requête ignorée');
      return false;
    }
    lastRefreshAttempt.current = now;

    if (isRefreshing.current) {
      return new Promise((resolve) => {
        refreshQueue.current.push({ userId, resolve });
      });
    }

    const userData = users.get(userId);
    if (!userData) return false;

    const timeLeft = userData.expiresAt - Date.now();
    if (timeLeft > 5 * 60 * 1000) return true;

    isRefreshing.current = true;
    try {
      // ✅ CORRECTION : Utiliser SOCKET_URL (sans /api)
      const res = await axios.post(`${SOCKET_URL}/api/auth/refresh-token`, {}, {
        timeout: 30000,
        withCredentials: true,
        headers: { 'Content-Type': 'application/json' }
      });

      if (!res.data.success || !res.data.token) {
        throw new Error(res.data?.message || "Réponse invalide");
      }

      const { token } = res.data;
      const expiresAt = Date.now() + (55 * 60 * 1000);

      setUsers(prev => {
        const map = new Map(prev);
        const current = map.get(userId);
        if (current) {
          map.set(userId, { ...current, token, expiresAt, lastActive: Date.now() });
        }
        return map;
      });

      persistUsers();
      
      const queue = [...refreshQueue.current];
      refreshQueue.current = [];
      queue.forEach(({ resolve }) => resolve(true));

      return true;
    } catch (err) {
      console.error(`❌ [Refresh] Erreur:`, err.message);
      
      const isClientError = err.response?.status >= 400 && err.response?.status < 500;
      
      if (!isClientError && retryCount < CONFIG.MAX_REFRESH_RETRIES - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        return refreshTokenForUser(userId, retryCount + 1);
      }
      
      addNotification("warning", "Session expirée");
      await logout(userId, true);
      
      const queue = [...refreshQueue.current];
      refreshQueue.current = [];
      queue.forEach(({ resolve }) => resolve(false));

      return false;
    } finally {
      isRefreshing.current = false;
    }
  }, [users, logout, addNotification, persistUsers]);

  // === OBTENIR TOKEN ===
  const getToken = useCallback(async (userId = activeUserId) => {
    const userData = users.get(userId);
    if (!userData?.token) return null;

    const timeLeft = userData.expiresAt - Date.now();
    if (timeLeft < CONFIG.TOKEN_REFRESH_MARGIN_MS) {
      const refreshed = await refreshTokenForUser(userId);
      if (!refreshed) return null;
      return users.get(userId)?.token || null;
    }
    return userData.token;
  }, [users, activeUserId, refreshTokenForUser]);

  // === SOCKET ===
  useEffect(() => {
    if (!activeUserId) {
      cleanupSocket();
      return;
    }

    const activeData = users.get(activeUserId);
    const token = activeData?.token;
    const userId = activeData?.user?._id;

    if (socketRef.current?.connected && socketRef.current?.auth?.token === token) {
      return;
    }

    cleanupSocket();

    if (!userId || !token) return;

    console.log(`🔌 [AuthContext] Initialisation Socket pour ${userId}...`);

    const newSocket = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });

    newSocket.on("connect", () => {
      console.log("✅ [AuthContext] Socket Connecté:", newSocket.id);
    });

    newSocket.on("connect_error", (err) => {
      console.warn("⚠️ [AuthContext] Erreur connexion socket:", err.message);
    });
    
    newSocket.on("disconnect", (reason) => {
      console.log("🔌 [AuthContext] Socket Déconnecté:", reason);
    });

    socketRef.current = newSocket;

    return () => { cleanupSocket(); };
  }, [activeUserId, users, cleanupSocket]);

  // === ADMIN VÉRIFICATION ===
  const verifyAdminToken = useCallback(async () => {
    const token = await getToken();
    if (!token) return null;
    try {
      // ✅ Déjà bon (utilise API_URL qui contient /api)
      const res = await axios.get(`${API_URL}/admin/verify`, {
        headers: { Authorization: `Bearer ${token}` },
        withCredentials: true,
        timeout: 10000,
      });
      if (res.status === 200 && (res.data.user?.role === 'admin' || res.data.user?.role === 'superadmin')) {
        return token;
      }
      return null;
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        const refreshed = await refreshTokenForUser(activeUserId);
        if (refreshed) return await getToken();
      }
      return null;
    }
  }, [getToken, refreshTokenForUser, activeUserId]);

  // === VÉRIFICATION TOKEN STOCKÉ ===
  const verifyStoredToken = useCallback(async (userId, token) => {
    if (!token) return { valid: false };
    try {
      const res = await axios.get(`${API_URL}/auth/verify`, {
        headers: { Authorization: `Bearer ${token}` },
        withCredentials: true,
        timeout: 10000,
      });
      return res.status === 200 && res.data.valid ? { valid: true, user: res.data.user } : { valid: false };
    } catch { 
      return { valid: false }; 
    }
  }, []);

  // === CHARGEMENT INITIAL ===
  const loadStoredUsers = useCallback(async () => {
    const storedUsers = secureGetItem(STORAGE_KEYS.USERS);
    const storedActive = secureGetItem(STORAGE_KEYS.ACTIVE_USER);
    const storedAttempts = secureGetItem(STORAGE_KEYS.LOGIN_ATTEMPTS) || {};
    const validUsers = new Map();

    if (storedUsers) {
      for (const [id, data] of Object.entries(storedUsers)) {
        if (data.expiresAt > Date.now()) {
          const { valid, user } = await verifyStoredToken(id, data.token);
          if (valid && user?._id === id) {
            validUsers.set(id, { ...data, user });
            await syncUserToIDB(id, user);
          }
        }
      }
    }

    if (validUsers.size === 0 && !navigator.onLine) {
      const idbUser = await idbGet("users", "user_active");
      if (idbUser?._id) {
        validUsers.set(idbUser._id, { 
          user: idbUser, 
          token: null, 
          expiresAt: 0, 
          lastActive: Date.now() 
        });
        setActiveUserId(idbUser._id);
      }
    }

    setUsers(validUsers);
    setActiveUserId(storedActive && validUsers.has(storedActive) ? storedActive : validUsers.keys().next().value || null);
    setLoginAttempts(storedAttempts);
    setReady(true);
  }, [verifyStoredToken]);

  // === LOGIN ===
  const login = useCallback(async (email, password) => {
    const safeEmail = (email || "").toString().trim().toLowerCase();
    setLoading(true);
    console.log('📤 Tentative de connexion...');
    
    try {
      // ✅ CORRECTION : Utiliser SOCKET_URL + /api/auth/login
      const res = await axios.post(`${SOCKET_URL}/api/auth/login`, 
        { email: safeEmail, password: password.toString() },
        {
          timeout: 60000,
          withCredentials: true,
          headers: { 'Content-Type': 'application/json' }
        }
      );

      console.log('📥 Résultat connexion:', res.data);

      if (!res.data.success) throw new Error(res.data?.message || "Erreur login");

      const { user, token } = res.data;
      const expiresAt = Date.now() + (55 * 60 * 1000);
      const updated = new Map(users);
      updated.set(user._id, { user, token, expiresAt, lastActive: Date.now() });

      setUsers(updated);
      setActiveUserId(user._id);
      persistUsers(updated, user._id);
      resetLoginAttempts(safeEmail);
      await syncUserToIDB(user._id, user);
      
      addNotification("success", "Connecté avec succès");
      return { success: true, user };
    } catch (err) {
      trackLoginAttempt(safeEmail);
      const msg = err.response?.data?.message || err.message || "Erreur connexion";
      addNotification("error", msg);
      console.error('❌ [Login] Erreur:', msg);
      return { success: false, message: msg };
    } finally {
      setLoading(false);
    }
  }, [users, persistUsers, addNotification, trackLoginAttempt, resetLoginAttempts]);

  // === REGISTER ===
  const register = useCallback(async (fullName, email, password) => {
    setLoading(true);
    try {
      const res = await axios.post(`${SOCKET_URL}/api/auth/register`, 
        { fullName, email, password },
        {
          timeout: 60000,
          withCredentials: true,
          headers: { 'Content-Type': 'application/json' }
        }
      );

      if (!res.data.success) throw new Error(res.data?.message || "Erreur inscription");

      const { user, token } = res.data;
      const expiresAt = Date.now() + (55 * 60 * 1000);
      const updated = new Map(users);
      updated.set(user._id, { user, token, expiresAt, lastActive: Date.now() });

      setUsers(updated);
      setActiveUserId(user._id);
      persistUsers(updated, user._id);
      await syncUserToIDB(user._id, user);
      
      addNotification("success", "Compte créé avec succès !");
      return { success: true, user };
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Erreur inscription";
      addNotification("error", msg);
      return { success: false, message: msg };
    } finally {
      setLoading(false);
    }
  }, [users, persistUsers, addNotification]);

  // === MISE À JOUR PROFIL ===
  const updateUserProfile = useCallback(async (userId, updates) => {
    if (!userId) return;

    setUsers(prev => {
      const newMap = new Map(prev);
      const currentUserData = newMap.get(userId);

      if (currentUserData) {
        const updatedUser = { ...currentUserData.user, ...updates };
        newMap.set(userId, { ...currentUserData, user: updatedUser });
        persistUsers(newMap, activeUserId);
        syncUserToIDB(userId, updatedUser);
        console.log("✅ [AuthContext] Profil mis à jour localement pour", userId);
      }
      return newMap;
    });
  }, [activeUserId, persistUsers]);

  // === EFFETS ===
  useEffect(() => { 
    loadStoredUsers(); 
    return () => { isMounted.current = false; }; 
  }, [loadStoredUsers]);

  useEffect(() => {
    if (!ready || users.size === 0) return;
    refreshInterval.current = setInterval(() => {
      users.forEach((data, id) => {
        const timeLeft = data.expiresAt - Date.now();
        if (timeLeft < CONFIG.TOKEN_REFRESH_MARGIN_MS && timeLeft > 0) {
          refreshTokenForUser(id);
        }
      });
    }, CONFIG.AUTO_REFRESH_INTERVAL_MS);
    return () => clearInterval(refreshInterval.current);
  }, [users, refreshTokenForUser, ready]);

  useEffect(() => {
    injectAuthHandlers({ getToken, logout, refreshTokenForUser: refreshTokenForUser, notify: addNotification });
  }, [getToken, logout, addNotification, refreshTokenForUser]);
  
  // === VALEUR DU CONTEXTE ===
  const value = useMemo(() => {
    const active = getActiveUser();
    const isAdmin = () => active?.user?.role === 'admin' || active?.user?.role === 'superadmin';

    return {
      users,
      activeUserId,
      user: active?.user || null,
      token: active?.token || null,
      socket: socketRef.current,
      loading,
      ready,
      notifications,
      login,
      logout,
      register,
      getToken,
      updateUserProfile,
      verifyAdminToken,
      isAdmin,
      addNotification,
      isLockedOut,
      getActiveUser,
      getUserById,
    };
  }, [
    users, activeUserId, loading, ready, notifications,
    login, logout, register, getToken, 
    updateUserProfile,
    verifyAdminToken,
    addNotification, isLockedOut, getActiveUser, getUserById
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}