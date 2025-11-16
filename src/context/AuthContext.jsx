// src/context/AuthContext.jsx - VERSION FINALE CORRIGÉE
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from "react";
import axios from "axios";
import { injectAuthHandlers } from "../api/axiosClientGlobal";
import { idbSet, idbGet, idbDelete } from "../utils/idbMigration";

const AuthContext = createContext();
export const useAuth = () => useContext(AuthContext);

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const CONFIG = {
  TOKEN_REFRESH_MARGIN_MS: 5 * 60 * 1000, // ✅ 5 min avant expiration (au lieu de 2)
  SESSION_TIMEOUT_MS: 7 * 24 * 60 * 60 * 1000,
  MAX_STORED_USERS: 10,
  NOTIFICATIONS_MAX: 50,
  AUTO_REFRESH_INTERVAL_MS: 60 * 1000, // ✅ Vérifier toutes les 60s (au lieu de 30s)
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_DURATION_MS: 15 * 60 * 1000,
};

const STORAGE_KEYS = {
  USERS: "chantilink_users_enc_v6",
  ACTIVE_USER: "chantilink_active_user_v6",
  LOGIN_ATTEMPTS: "chantilink_login_attempts_v6",
};

// === UTILITAIRES SÉCURISÉS ===
const secureSetItem = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (err) { console.warn("localStorage.setItem échoué:", err); }
};
const secureGetItem = (key) => {
  try { const val = localStorage.getItem(key); return val ? JSON.parse(val) : null; } catch { return null; }
};
const secureRemoveItem = (key) => { try { localStorage.removeItem(key); } catch {} };

// === GESTION AUDIO SÉCURISÉE ===
const playAudioSafe = (audioPath) => {
  setTimeout(() => {
    try {
      const audio = new Audio(audioPath);
      audio.volume = 0.3;
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {});
      }
    } catch (err) {}
  }, 0);
};

// === PROVIDER ===
export function AuthProvider({ children }) {
  const [users, setUsers] = useState(new Map());
  const [activeUserId, setActiveUserId] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState({});

  const isMounted = useRef(true);
  const refreshInterval = useRef(null);
  const isRefreshing = useRef(false); // ✅ Éviter les refresh multiples simultanés

  // === NOTIFICATIONS ===
  const addNotification = useCallback((type, message) => {
    const safeMessage = typeof message === "string" ? message : "Action effectuée";
    setNotifications(prev => [
      ...prev.slice(-CONFIG.NOTIFICATIONS_MAX + 1),
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

  // === IDB SYNC ===
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

  // === LOGOUT ===
  const logout = useCallback(async (userId = activeUserId) => {
    if (!userId) return;
    setUsers(prev => { const map = new Map(prev); map.delete(userId); return map; });
    if (activeUserId === userId) {
      setActiveUserId(null);
      await idbDelete("users", "user_active");
    }
    persistUsers();
    addNotification("info", "Déconnecté en toute sécurité");
  }, [activeUserId, persistUsers, addNotification]);

  // === REFRESH TOKEN ✅ CORRIGÉ ===
  const refreshTokenForUser = useCallback(async (userId) => {
    if (isRefreshing.current) {
      console.log("⏳ Refresh déjà en cours, attente...");
      return false;
    }

    const userData = users.get(userId);
    if (!userData) return false;

    // ✅ Ne pas refresh si encore valide pour plus de 3 minutes
    const timeLeft = userData.expiresAt - Date.now();
    if (timeLeft > 3 * 60 * 1000) {
      console.log(`✅ Token encore valide pour ${Math.floor(timeLeft / 60000)} minutes`);
      return true;
    }

    isRefreshing.current = true;
    console.log("🔄 Rafraîchissement du token...");

    try {
      const res = await axios.post(`${API_URL}/api/auth/refresh-token`, {}, { 
        withCredentials: true, 
        timeout: 10000 
      });

      if (res.status !== 200 || !res.data.token) {
        throw new Error("Refresh failed");
      }

      const { token } = res.data;
      const expiresAt = Date.now() + (14 * 60 * 1000); // ✅ Token valide 14 min (marge de sécurité)

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
      console.log("✅ Token rafraîchi avec succès");
      return true;
    } catch (err) {
      console.error("❌ Échec refresh:", err.message);
      addNotification("error", "Session expirée, reconnexion nécessaire");
      await logout(userId);
      return false;
    } finally {
      isRefreshing.current = false;
    }
  }, [users, logout, addNotification, persistUsers]);

  // === GET TOKEN ✅ CORRIGÉ ===
  const getToken = useCallback(async (userId = activeUserId) => {
    const userData = users.get(userId);
    if (!userData?.token) {
      console.warn("⚠️ Aucun token disponible");
      return null;
    }

    const timeLeft = userData.expiresAt - Date.now();
    
    // ✅ Refresh si moins de 5 minutes de validité
    if (timeLeft < CONFIG.TOKEN_REFRESH_MARGIN_MS) {
      console.log(`⚠️ Token expire bientôt (${Math.floor(timeLeft / 60000)} min), refresh...`);
      const refreshed = await refreshTokenForUser(userId);
      if (!refreshed) {
        console.error("❌ Impossible de rafraîchir le token");
        return null;
      }
      return users.get(userId)?.token || null;
    }

    return userData.token;
  }, [users, activeUserId, refreshTokenForUser]);

  // === VÉRIFICATION ADMIN ===
  const verifyAdminToken = useCallback(async () => {
    const token = await getToken();
    if (!token) return null;

    try {
      const res = await axios.get(`${API_URL}/api/admin/verify`, {
        headers: { Authorization: `Bearer ${token}` },
        withCredentials: true,
        timeout: 8000,
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
      const res = await axios.get(`${API_URL}/api/auth/verify`, {
        headers: { Authorization: `Bearer ${token}` },
        withCredentials: true,
        timeout: 8000,
      });
      return res.status === 200 && res.data.valid ? { valid: true, user: res.data.user } : { valid: false };
    } catch { return { valid: false }; }
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
            validUsers.set(id, { ...data, user, socket: null });
            await syncUserToIDB(id, user);
          }
        }
      }
    }

    if (validUsers.size === 0 && !navigator.onLine) {
      const idbUser = await idbGet("users", "user_active");
      if (idbUser?._id) {
        validUsers.set(idbUser._id, { user: idbUser, token: null, expiresAt: 0, lastActive: Date.now(), socket: null });
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
    if (!safeEmail || !password) {
      addNotification("error", "Email et mot de passe requis");
      return { success: false, message: "Champs requis" };
    }

    if (isLockedOut(safeEmail)) {
      const minutes = Math.ceil((loginAttempts[safeEmail].lockoutUntil - Date.now()) / 60000);
      addNotification("error", `Trop de tentatives. Réessayez dans ${minutes} min`);
      return { success: false, message: "Compte verrouillé" };
    }

    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/api/auth/login`, { 
        email: safeEmail, 
        password: password.toString() 
      }, {
        withCredentials: true,
        timeout: 15000,
      });

      if (res.status >= 400 || !res.data.success) {
        trackLoginAttempt(safeEmail);
        const msg = res.data?.message || "Identifiants incorrects";
        addNotification("error", msg);
        playAudioSafe('/sounds/error.mp3');
        return { success: false, message: msg };
      }

      const { user, token } = res.data;
      if (!user?._id || !token) throw new Error("Réponse invalide");

      const expiresAt = Date.now() + (14 * 60 * 1000); // ✅ 14 min de validité
      const updated = new Map(users);
      updated.set(user._id, { user, token, expiresAt, lastActive: Date.now(), socket: null });

      setUsers(updated);
      setActiveUserId(user._id);
      persistUsers(updated, user._id);
      resetLoginAttempts(safeEmail);
      await syncUserToIDB(user._id, user);
      
      playAudioSafe('/sounds/success.mp3');
      addNotification("success", "Connecté avec succès");
      return { success: true, user };
    } catch (err) {
      const msg = err.code === 'ECONNABORTED' ? "Délai dépassé" : err.response?.data?.message || err.message || "Erreur réseau";
      trackLoginAttempt(safeEmail);
      playAudioSafe('/sounds/error.mp3');
      addNotification("error", msg);
      return { success: false, message: msg };
    } finally {
      setLoading(false);
    }
  }, [users, persistUsers, addNotification, isLockedOut, trackLoginAttempt, resetLoginAttempts]);

  // === REGISTER ✅ CORRIGÉ FINAL ===
  const register = useCallback(async (fullName, email, password) => {
    const safeFullName = (fullName || "").toString().trim();
    const safeEmail = (email || "").toString().trim().toLowerCase();
    const safePassword = (password || "").toString();

    // Validation frontend
    if (!safeFullName || !safeEmail || !safePassword) {
      addNotification("error", "Tous les champs sont requis");
      return { success: false, message: "Champs manquants" };
    }

    if (safeFullName.length < 3) {
      addNotification("error", "Le nom doit contenir au moins 3 caractères");
      return { success: false, message: "Nom trop court" };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(safeEmail)) {
      addNotification("error", "Format d'email invalide");
      return { success: false, message: "Email invalide" };
    }

    if (safePassword.length < 6) {
      addNotification("error", "Le mot de passe doit contenir au moins 6 caractères");
      return { success: false, message: "Mot de passe trop court" };
    }

    setLoading(true);
    try {
      console.log("📤 Inscription:", { fullName: safeFullName, email: safeEmail });

      const res = await axios.post(`${API_URL}/api/auth/register`, {
        fullName: safeFullName,
        email: safeEmail,
        confirmEmail: safeEmail, // ✅ Nécessaire pour le backend
        password: safePassword,
      }, { 
        withCredentials: true, 
        timeout: 20000, // ✅ 20 secondes pour inscription
        headers: {
          'Content-Type': 'application/json'
        }
      });

      console.log("📥 Réponse:", res.status, res.data);

      if (!res.data.success) {
        const msg = res.data?.message || "Erreur lors de l'inscription";
        addNotification("error", msg);
        playAudioSafe('/sounds/error.mp3');
        return { success: false, message: msg };
      }

      const { user, token } = res.data;
      if (!user?._id || !token) {
        throw new Error("Réponse invalide du serveur");
      }

      const expiresAt = Date.now() + (14 * 60 * 1000);
      const updated = new Map(users);
      updated.set(user._id, { user, token, expiresAt, lastActive: Date.now(), socket: null });

      setUsers(updated);
      setActiveUserId(user._id);
      persistUsers(updated, user._id);
      await syncUserToIDB(user._id, user);
      
      playAudioSafe('/sounds/success.mp3');
      addNotification("success", "Compte créé avec succès !");
      
      return { success: true, user };
    } catch (err) {
      console.error("❌ Erreur inscription:", err);
      
      let msg;
      if (err.code === 'ECONNABORTED') {
        msg = "Délai dépassé. Vérifiez votre connexion";
      } else if (err.response?.status === 400) {
        msg = err.response.data?.message || "Données invalides";
      } else if (err.response?.status === 409) {
        msg = "Cet email est déjà utilisé";
      } else {
        msg = err.response?.data?.message || err.message || "Erreur réseau";
      }
      
      playAudioSafe('/sounds/error.mp3');
      addNotification("error", msg);
      
      return { success: false, message: msg };
    } finally {
      setLoading(false);
    }
  }, [users, persistUsers, addNotification]);

  // === UPDATE PROFILE / IMAGES ===
  const updateUserImages = useCallback(async (userId, images) => {
    if (!userId || !images || (!images.profile && !images.cover)) throw new Error("Données invalides");
    const token = await getToken(userId);
    if (!token) throw new Error("Authentification requise");

    const formData = new FormData();
    if (images.profile) formData.append("profilePhoto", images.profile);
    if (images.cover) formData.append("coverPhoto", images.cover);

    const res = await axios.put(`${API_URL}/api/users/${userId}/images`, formData, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" },
      withCredentials: true,
      timeout: 30000,
    });

    const updatedUser = res.data.user;
    if (!updatedUser?._id) throw new Error("Utilisateur non retourné");

    setUsers(prev => {
      const map = new Map(prev);
      const userData = map.get(userId);
      if (userData) map.set(userId, { ...userData, user: updatedUser });
      return map;
    });

    await syncUserToIDB(userId, updatedUser);
    return updatedUser;
  }, [getToken]);

  const updateUserProfile = useCallback(async (userId, updates) => {
    if (!userId || !updates || Object.keys(updates).length === 0) throw new Error("Données invalides");
    const token = await getToken(userId);
    if (!token) throw new Error("Authentification requise");

    const safeUpdates = {};
    if (updates.fullName !== undefined) safeUpdates.fullName = updates.fullName.trim();
    if (updates.username !== undefined) safeUpdates.username = updates.username.trim();
    if (updates.bio !== undefined) safeUpdates.bio = updates.bio.trim();
    if (updates.location !== undefined) safeUpdates.location = updates.location.trim();
    if (updates.website !== undefined) safeUpdates.website = updates.website.trim();

    const res = await axios.put(`${API_URL}/api/users/${userId}`, safeUpdates, {
      headers: { Authorization: `Bearer ${token}` },
      withCredentials: true,
      timeout: 10000,
    });

    const updatedUser = res.data.user;
    if (!updatedUser?._id) throw new Error("Utilisateur non retourné");

    setUsers(prev => {
      const map = new Map(prev);
      const userData = map.get(userId);
      if (userData) map.set(userId, { ...userData, user: updatedUser });
      return map;
    });

    await syncUserToIDB(userId, updatedUser);
    return updatedUser;
  }, [getToken]);

  // === EFFETS ===
  useEffect(() => {
    loadStoredUsers();
    return () => { isMounted.current = false; };
  }, [loadStoredUsers]);

  // ✅ INTERVALLE DE REFRESH AUTOMATIQUE CORRIGÉ
  useEffect(() => {
    if (!ready) return;
    
    refreshInterval.current = setInterval(() => {
      users.forEach((data, id) => {
        const timeLeft = data.expiresAt - Date.now();
        // ✅ Refresh si moins de 5 minutes de validité
        if (timeLeft < CONFIG.TOKEN_REFRESH_MARGIN_MS && timeLeft > 0) {
          console.log(`🔄 Auto-refresh pour user ${id}`);
          refreshTokenForUser(id);
        }
      });
    }, CONFIG.AUTO_REFRESH_INTERVAL_MS);
    
    return () => clearInterval(refreshInterval.current);
  }, [users, refreshTokenForUser, ready]);

  useEffect(() => {
    injectAuthHandlers({ getToken, logout, notify: addNotification });
  }, [getToken, logout, addNotification]);

  // === VALEUR DU CONTEXT ===
  const value = useMemo(() => {
    const active = getActiveUser();
    
    const isAdmin = () => {
      const role = active?.user?.role;
      return role === 'admin' || role === 'superadmin';
    };

    return {
      users,
      activeUserId,
      user: active?.user || null,
      token: active?.token || null,
      getActiveUser,
      getUserById,
      getToken,
      login,
      register,
      logout,
      refreshTokenForUser,
      updateUserImages,
      updateUserProfile,
      loading,
      notifications,
      ready,
      isLockedOut,
      loginAttempts,
      isAdmin,
      verifyAdminToken,
    };
  }, [
    users, activeUserId, getActiveUser, getUserById, getToken, login, register, logout,
    refreshTokenForUser, updateUserImages, updateUserProfile, loading, notifications, ready,
    isLockedOut, loginAttempts, verifyAdminToken
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}