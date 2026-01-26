// src/context/AuthContext.jsx - VERSION LITE AUTO-LOGIN ⚡
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
  isAuthenticated: false, // ✅ NOUVEAU
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
  if (!context) {
    throw new Error('useAuth doit être utilisé dans un AuthProvider');
  }
  return context;
};

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const SOCKET_URL = API_URL.replace('/api', '');

const CONFIG = {
  TOKEN_REFRESH_MARGIN_MS: 30 * 60 * 1000, // ✅ 30 min au lieu de 10
  AUTO_REFRESH_INTERVAL_MS: 60 * 1000, // ✅ Vérifier toutes les 60s
  SESSION_TIMEOUT_MS: 90 * 24 * 60 * 60 * 1000, // ✅ 90 jours max
  MAX_STORED_USERS: 10,
  MAX_NOTIFICATIONS: 50,
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_DURATION_MS: 15 * 60 * 1000,
  MAX_REFRESH_RETRIES: 3,
};

const STORAGE_KEYS = {
  USERS: "chantilink_users_enc_v7", // ✅ Nouvelle version
  ACTIVE_USER: "chantilink_active_user_v7",
  LOGIN_ATTEMPTS: "chantilink_login_attempts_v7",
  REMEMBER_ME: "chantilink_remember_v7", // ✅ NOUVEAU
};

// === UTILITAIRES ===
const secureSetItem = (key, value) => {
  try { 
    localStorage.setItem(key, JSON.stringify(value)); 
  } catch (err) { 
    console.warn("localStorage.setItem échec:", err); 
  }
};

const secureGetItem = (key) => {
  try { 
    const val = localStorage.getItem(key); 
    return val ? JSON.parse(val) : null; 
  } catch { 
    return null; 
  }
};

const secureRemoveItem = (key) => { 
  try { 
    localStorage.removeItem(key); 
  } catch {} 
};

// === FOURNISSEUR ===
export function AuthProvider({ children }) {
  const [users, setUsers] = useState(new Map());
  const [activeUserId, setActiveUserId] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true); // ✅ true par défaut pour vérification initiale
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
  const persistUsers = useCallback((updatedUsers, newActiveId) => {
    try {
      const usersToUse = updatedUsers || users;
      const activeToUse = newActiveId !== undefined ? newActiveId : activeUserId;
      
      const arr = Array.from(usersToUse.entries())
        .map(([id, data]) => [id, {
          user: data.user,
          token: data.token,
          expiresAt: data.expiresAt,
          lastActive: data.lastActive || Date.now(),
          rememberMe: data.rememberMe || false, // ✅ NOUVEAU
        }])
        .sort((a, b) => b[1].lastActive - a[1].lastActive)
        .slice(0, CONFIG.MAX_STORED_USERS);

      secureSetItem(STORAGE_KEYS.USERS, Object.fromEntries(arr));
      activeToUse ? secureSetItem(STORAGE_KEYS.ACTIVE_USER, activeToUse) : secureRemoveItem(STORAGE_KEYS.ACTIVE_USER);
      
      console.log("💾 [AuthContext] Users persistés:", arr.length);
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
          following: user.following || [],
          followers: user.followers || [],
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

  // === ✅ REFRESH TOKEN AMÉLIORÉ (Support tokens longue durée) ===
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

    // ✅ Marges adaptatives selon "rememberMe"
    const margin = userData.rememberMe 
      ? 2 * 60 * 60 * 1000 // 2h avant expiration si "se souvenir"
      : CONFIG.TOKEN_REFRESH_MARGIN_MS; // 30 min sinon

    const timeLeft = userData.expiresAt - Date.now();
    if (timeLeft > margin) return true;

    isRefreshing.current = true;
    try {
      const refreshAxios = axios.create({
        baseURL: API_URL.replace('/api', ''),
        timeout: 30000,
        withCredentials: true,
        headers: { 'Content-Type': 'application/json' }
      });

      const res = await refreshAxios.post('/api/auth/refresh-token');

      if (res.status !== 200 || !res.data.success || !res.data.token) {
        throw new Error(res.data?.message || "Réponse invalide");
      }

      const { token } = res.data;
      
      // ✅ Calculer expiration selon "rememberMe" (backend envoie déjà le bon token)
      const expiresAt = userData.rememberMe
        ? Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 jours
        : Date.now() + (55 * 60 * 1000); // 55 min

      setUsers(prev => {
        const map = new Map(prev);
        const current = map.get(userId);
        if (current) {
          map.set(userId, { 
            ...current, 
            token, 
            expiresAt, 
            lastActive: Date.now() 
          });
        }
        return map;
      });

      persistUsers();
      
      console.log(`✅ [Refresh] Token renouvelé (rememberMe: ${userData.rememberMe})`);
      
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
      
      if (!userData.rememberMe) {
        addNotification("warning", "Session expirée");
      }
      await logout(userId, true);
      
      const queue = [...refreshQueue.current];
      refreshQueue.current = [];
      queue.forEach(({ resolve }) => resolve(false));

      return false;
    } finally {
      isRefreshing.current = false;
    }
  }, [users, logout, addNotification, persistUsers]);

  // === OBTENIR UN JETON ===
  const getToken = useCallback(async (userId = activeUserId) => {
    const userData = users.get(userId);
    if (!userData?.token) return null;

    const timeLeft = userData.expiresAt - Date.now();
    
    // ✅ Marges adaptatives
    const margin = userData.rememberMe 
      ? 2 * 60 * 60 * 1000 
      : CONFIG.TOKEN_REFRESH_MARGIN_MS;
    
    if (timeLeft < margin) {
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
      if (reason === "io client disconnect") return;
    });

    socketRef.current = newSocket;

    return () => { cleanupSocket(); };
  }, [activeUserId, users, cleanupSocket]);

  // === ADMIN VÉRIFICATION ===
  const verifyAdminToken = useCallback(async () => {
    const token = await getToken();
    if (!token) return null;
    try {
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

  // === ✅ VÉRIFICATION TOKEN STOCKÉ (Support tokens longue durée) ===
  const verifyStoredToken = useCallback(async (userId, token, rememberMe = false) => {
    if (!token) return { valid: false };
    
    try {
      const res = await axios.get(`${API_URL}/auth/verify`, {
        headers: { Authorization: `Bearer ${token}` },
        withCredentials: true,
        timeout: 10000,
      });
      
      if (res.status === 200 && res.data.valid) {
        console.log(`✅ [Verify] Token valide pour ${userId} (rememberMe: ${rememberMe})`);
        return { valid: true, user: res.data.user };
      }
      
      return { valid: false };
    } catch (err) {
      console.warn(`⚠️ [Verify] Token invalide pour ${userId}:`, err.message);
      return { valid: false }; 
    }
  }, []);

  // === ✅ CHARGEMENT INITIAL (Support auto-login) ===
  const loadStoredUsers = useCallback(async () => {
    console.log("🔍 [AuthContext] Chargement utilisateurs stockés...");
    
    const storedUsers = secureGetItem(STORAGE_KEYS.USERS);
    const storedActive = secureGetItem(STORAGE_KEYS.ACTIVE_USER);
    const storedAttempts = secureGetItem(STORAGE_KEYS.LOGIN_ATTEMPTS) || {};
    const validUsers = new Map();

    if (storedUsers) {
      for (const [id, data] of Object.entries(storedUsers)) {
        // ✅ Tokens longue durée peuvent être valides même après plusieurs jours
        if (data.expiresAt > Date.now()) {
          const { valid, user } = await verifyStoredToken(id, data.token, data.rememberMe);
          
          if (valid && user?._id === id) {
            validUsers.set(id, { 
              ...data, 
              user,
              rememberMe: data.rememberMe || false 
            });
            await syncUserToIDB(id, user);
            console.log(`✅ [Load] User ${id} chargé (rememberMe: ${data.rememberMe})`);
          }
        } else {
          console.log(`⏰ [Load] Token expiré pour ${id}`);
        }
      }
    }

    // Fallback offline
    if (validUsers.size === 0 && !navigator.onLine) {
      const idbUser = await idbGet("users", "user_active");
      if (idbUser?._id) {
        validUsers.set(idbUser._id, { 
          user: idbUser, 
          token: null, 
          expiresAt: 0, 
          lastActive: Date.now(),
          rememberMe: false
        });
        setActiveUserId(idbUser._id);
      }
    }

    setUsers(validUsers);
    setActiveUserId(storedActive && validUsers.has(storedActive) ? storedActive : validUsers.keys().next().value || null);
    setLoginAttempts(storedAttempts);
    setReady(true);
    setLoading(false); // ✅ Fin du chargement initial
    
    console.log(`✅ [Load] ${validUsers.size} utilisateur(s) chargé(s)`);
  }, [verifyStoredToken]);

  // === ✅ CONNEXION (Support "Se souvenir") ===
  const login = useCallback(async (email, password, rememberMe = false) => {
    const safeEmail = (email || "").toString().trim().toLowerCase();
    setLoading(true);
    
    try {
      const loginAxios = axios.create({
        baseURL: API_URL.replace('/api', ''),
        timeout: 60000,
        withCredentials: true,
        headers: { 'Content-Type': 'application/json' }
      });

      const res = await loginAxios.post('/api/auth/login', { 
        email: safeEmail, 
        password: password.toString(),
        rememberMe // ✅ Envoyer au backend
      });

      if (res.status >= 400 || !res.data.success) {
        throw new Error(res.data?.message || "Erreur login");
      }

      const { user, token } = res.data;
      
      // ✅ Expiration selon "rememberMe"
      const expiresAt = rememberMe
        ? Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 jours
        : Date.now() + (55 * 60 * 1000); // 55 min
      
      const updated = new Map(users);
      updated.set(user._id, { 
        user, 
        token, 
        expiresAt, 
        lastActive: Date.now(),
        rememberMe // ✅ NOUVEAU
      });

      setUsers(updated);
      setActiveUserId(user._id);
      persistUsers(updated, user._id);
      resetLoginAttempts(safeEmail);
      await syncUserToIDB(user._id, user);
      
      console.log(`✅ [Login] Connecté (rememberMe: ${rememberMe})`);
      addNotification("success", "Connecté avec succès");
      
      return { success: true, user };
    } catch (err) {
      trackLoginAttempt(safeEmail);
      const msg = err.response?.data?.message || err.message || "Erreur connexion";
      addNotification("error", msg);
      return { success: false, message: msg };
    } finally {
      setLoading(false);
    }
  }, [users, persistUsers, addNotification, trackLoginAttempt, resetLoginAttempts]);

  // === ✅ INSCRIPTION (Support "Se souvenir") ===
  const register = useCallback(async (fullName, email, password, rememberMe = false) => {
    setLoading(true);
    
    try {
      const registerAxios = axios.create({
        baseURL: API_URL.replace('/api', ''),
        timeout: 60000,
        withCredentials: true,
        headers: { 'Content-Type': 'application/json' }
      });

      const res = await registerAxios.post('/api/auth/register', { 
        fullName, 
        email, 
        password,
        rememberMe // ✅ Envoyer au backend
      });

      if (!res.data.success) {
        throw new Error(res.data?.message || "Erreur inscription");
      }

      const { user, token } = res.data;
      
      // ✅ Expiration selon "rememberMe"
      const expiresAt = rememberMe
        ? Date.now() + (7 * 24 * 60 * 60 * 1000)
        : Date.now() + (55 * 60 * 1000);
      
      const updated = new Map(users);
      updated.set(user._id, { 
        user, 
        token, 
        expiresAt, 
        lastActive: Date.now(),
        rememberMe
      });

      setUsers(updated);
      setActiveUserId(user._id);
      persistUsers(updated, user._id);
      await syncUserToIDB(user._id, user);
      
      console.log(`✅ [Register] Inscription réussie (rememberMe: ${rememberMe})`);
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

  // === MISE À JOUR DU PROFIL ===
  const updateUserProfile = useCallback(async (userId, updates) => {
    if (!userId) return;

    console.log("🔄 [AuthContext] updateUserProfile appelé:", { userId, updates });

    setUsers(prev => {
      const newMap = new Map(prev);
      const currentUserData = newMap.get(userId);

      if (currentUserData) {
        const updatedUser = {
          ...currentUserData.user,
          ...updates,
          following: updates.following !== undefined 
            ? updates.following 
            : currentUserData.user.following
        };
        
        newMap.set(userId, { ...currentUserData, user: updatedUser });
        
        setTimeout(() => {
          persistUsers(newMap, activeUserId);
          syncUserToIDB(userId, updatedUser);
        }, 0);
        
        console.log("✅ [AuthContext] Profil mis à jour:", {
          userId,
          followingCount: updatedUser.following?.length || 0
        });
      }
      return newMap;
    });
  }, [activeUserId, persistUsers]);

  // === EFFETS ===
  useEffect(() => { 
    loadStoredUsers(); 
    return () => { isMounted.current = false; }; 
  }, [loadStoredUsers]);

  // ✅ Refresh adaptatif selon "rememberMe"
  useEffect(() => {
    if (!ready || users.size === 0) return;
    
    refreshInterval.current = setInterval(() => {
      users.forEach((data, id) => {
        const margin = data.rememberMe 
          ? 2 * 60 * 60 * 1000 
          : CONFIG.TOKEN_REFRESH_MARGIN_MS;
        
        const timeLeft = data.expiresAt - Date.now();
        if (timeLeft < margin && timeLeft > 0) {
          refreshTokenForUser(id);
        }
      });
    }, CONFIG.AUTO_REFRESH_INTERVAL_MS);
    
    return () => clearInterval(refreshInterval.current);
  }, [users, refreshTokenForUser, ready]);

  useEffect(() => {
    injectAuthHandlers({ getToken, logout, notify: addNotification });
  }, [getToken, logout, addNotification]);
  
  // === ✅ VALEUR DU CONTEXTE (avec isAuthenticated) ===
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
      isAuthenticated: !!active?.user, // ✅ NOUVEAU : true si user connecté
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
    updateUserProfile, verifyAdminToken,
    addNotification, isLockedOut, getActiveUser, getUserById
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}