// src/context/AuthContext.jsx - VERSION PERSISTANTE LONGUE DURÉE ⚡
// ✅ Auto-login via cookie httpOnly (refresh token)
// ✅ Access token court (1h) en mémoire seulement — jamais en localStorage
// ✅ Refresh token longue durée (90j) dans cookie httpOnly — géré par le navigateur
// ✅ "Se souvenir de moi" → 90 jours | sinon → session navigateur
// ✅ Même appareil = connecté automatiquement | Nouvel appareil = connexion requise

import React, {
  createContext, useContext, useState, useEffect,
  useCallback, useMemo, useRef
} from "react";
import axios from "axios";
import { io } from "socket.io-client";
import { injectAuthHandlers } from "../api/axiosClientGlobal";
import { idbSet, idbGet, idbDelete } from "../utils/idbMigration";

// ============================================
// CONTEXTE PAR DÉFAUT
// ============================================
const AuthContext = createContext({
  user: null,
  token: null,
  socket: null,
  loading: false,
  ready: false,
  isAuthenticated: false,
  notifications: [],
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
// CONFIG
// ============================================
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const SOCKET_URL = API_URL.replace("/api", "");

const CONFIG = {
  // On rafraîchit l'access token 3 minutes avant expiration
  TOKEN_REFRESH_MARGIN_MS: 3 * 60 * 1000,
  // Vérification toutes les 60 secondes
  AUTO_REFRESH_INTERVAL_MS: 60 * 1000,
  MAX_NOTIFICATIONS: 50,
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_DURATION_MS: 15 * 60 * 1000,
  MAX_REFRESH_RETRIES: 3,
  REFRESH_COOLDOWN_MS: 5000,
};

// ⚠️ On ne stocke PLUS le token JWT en localStorage
// On garde seulement les infos user pour l'affichage rapide (nom, photo, etc.)
const STORAGE_KEYS = {
  USER_INFO: "chantilink_user_info_v8",   // Données user (pas le token)
  LOGIN_ATTEMPTS: "chantilink_login_attempts_v8",
};

// ============================================
// UTILITAIRES STORAGE
// ============================================
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

// ============================================
// AXIOS INSTANCE POUR AUTH (avec cookies)
// ============================================
const authAxios = axios.create({
  baseURL: API_URL.replace("/api", ""),
  timeout: 30000,
  withCredentials: true, // ✅ CRUCIAL : envoie les cookies httpOnly automatiquement
  headers: { "Content-Type": "application/json" },
});

// ============================================
// FOURNISSEUR
// ============================================
export function AuthProvider({ children }) {
  // ✅ user = objet utilisateur | token = access token court (en mémoire seulement)
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [tokenExpiresAt, setTokenExpiresAt] = useState(null);

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState({});

  const isMounted = useRef(true);
  const refreshInterval = useRef(null);
  const isRefreshing = useRef(false);
  const refreshQueue = useRef([]);
  const lastRefreshAttempt = useRef(0);
  const socketRef = useRef(null);

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
      const attempts = (prev[key]?.count || 0) + 1;
      const lockoutUntil =
        attempts >= CONFIG.MAX_LOGIN_ATTEMPTS
          ? Date.now() + CONFIG.LOCKOUT_DURATION_MS
          : null;
      const updated = { ...prev, [key]: { count: attempts, lockoutUntil } };
      secureSetItem(STORAGE_KEYS.LOGIN_ATTEMPTS, updated);
      return updated;
    });
  }, []);

  const isLockedOut = useCallback(
    (email) => {
      const key = email.toLowerCase();
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
    },
    [loginAttempts]
  );

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
  // SYNC IDB (pour mode offline)
  // ============================================
  const syncUserToIDB = useCallback(async (userData) => {
    if (!userData?._id) return;
    try {
      await Promise.all([
        idbSet("users", `user_${userData._id}`, userData),
        idbSet("users", "user_active", userData),
      ]);
    } catch (err) {
      console.warn("Échec sync IDB:", err);
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
  const logout = useCallback(
    async (silent = false) => {
      try {
        // Appel au backend pour invalider le cookie refresh token
        await authAxios.post("/api/auth/logout").catch(() => {});
      } catch {}

      cleanupSocket();
      setUser(null);
      setToken(null);
      setTokenExpiresAt(null);
      secureRemoveItem(STORAGE_KEYS.USER_INFO);
      await idbDelete("users", "user_active").catch(() => {});

      if (!silent) addNotification("info", "Déconnecté");
      console.log("🔒 [Logout] Déconnecté");
    },
    [cleanupSocket, addNotification]
  );

  // ============================================
  // REFRESH TOKEN (le cookie est envoyé automatiquement)
  // ============================================
  const refreshAccessToken = useCallback(
    async (retryCount = 0) => {
      const now = Date.now();
      if (now - lastRefreshAttempt.current < CONFIG.REFRESH_COOLDOWN_MS) {
        console.warn("⏰ [Refresh] Cooldown actif");
        return false;
      }
      lastRefreshAttempt.current = now;

      // Si un refresh est déjà en cours, mettre en file d'attente
      if (isRefreshing.current) {
        return new Promise((resolve) => {
          refreshQueue.current.push(resolve);
        });
      }

      isRefreshing.current = true;
      try {
        // ✅ Le cookie refreshToken est envoyé automatiquement par le navigateur
        const res = await authAxios.post("/api/auth/refresh-token");

        if (!res.data.success || !res.data.token) {
          throw new Error(res.data?.message || "Réponse invalide");
        }

        const { token: newToken, expiresIn, user: updatedUser } = res.data;

        // expiresIn en secondes → on soustrait la marge
        const expiresAt = Date.now() + (expiresIn || 3600) * 1000;

        setToken(newToken);
        setTokenExpiresAt(expiresAt);

        // Mettre à jour l'utilisateur si le backend l'envoie
        if (updatedUser) {
          setUser(updatedUser);
          secureSetItem(STORAGE_KEYS.USER_INFO, updatedUser);
          await syncUserToIDB(updatedUser);
        }

        console.log("✅ [Refresh] Access token renouvelé");

        // Résoudre la file d'attente
        const queue = [...refreshQueue.current];
        refreshQueue.current = [];
        queue.forEach((resolve) => resolve(true));

        return true;
      } catch (err) {
        console.error("❌ [Refresh] Erreur:", err.message);

        const isClientError =
          err.response?.status >= 400 && err.response?.status < 500;

        // Retry sur erreur réseau
        if (!isClientError && retryCount < CONFIG.MAX_REFRESH_RETRIES - 1) {
          isRefreshing.current = false;
          await new Promise((r) => setTimeout(r, 2000));
          return refreshAccessToken(retryCount + 1);
        }

        // Erreur 401 → session vraiment expirée → déconnexion silencieuse
        if (err.response?.status === 401) {
          await logout(true);
        }

        const queue = [...refreshQueue.current];
        refreshQueue.current = [];
        queue.forEach((resolve) => resolve(false));

        return false;
      } finally {
        isRefreshing.current = false;
      }
    },
    [logout, syncUserToIDB]
  );

  // ============================================
  // OBTENIR LE TOKEN (avec refresh automatique)
  // ============================================
  const getToken = useCallback(async () => {
    if (!token) return null;

    const timeLeft = (tokenExpiresAt || 0) - Date.now();

    if (timeLeft < CONFIG.TOKEN_REFRESH_MARGIN_MS) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) return null;
      // Récupérer le token mis à jour via ref (setState est async)
      return token;
    }

    return token;
  }, [token, tokenExpiresAt, refreshAccessToken]);

  // ============================================
  // CHARGEMENT INITIAL — AUTO-LOGIN via cookie
  // ============================================
  const loadSession = useCallback(async () => {
    console.log("🔍 [AuthContext] Tentative auto-login...");

    // Essayer de récupérer les infos user du localStorage pour affichage immédiat
    const cachedUser = secureGetItem(STORAGE_KEYS.USER_INFO);
    const storedAttempts = secureGetItem(STORAGE_KEYS.LOGIN_ATTEMPTS) || {};
    setLoginAttempts(storedAttempts);

    try {
      // ✅ Appel refresh-token — le cookie httpOnly est envoyé automatiquement
      // Si le cookie existe et est valide → on récupère un nouveau access token
      // Si pas de cookie (nouvel appareil) → 401 → l'utilisateur doit se connecter
      const res = await authAxios.post("/api/auth/refresh-token");

      if (res.data.success && res.data.token) {
        const { token: newToken, expiresIn, user: userData } = res.data;
        const expiresAt = Date.now() + (expiresIn || 3600) * 1000;

        setToken(newToken);
        setTokenExpiresAt(expiresAt);
        setUser(userData);

        secureSetItem(STORAGE_KEYS.USER_INFO, userData);
        await syncUserToIDB(userData);

        console.log("✅ [AutoLogin] Reconnecté automatiquement:", userData?.email);
      } else {
        // Pas de session valide → afficher les données cachées si disponibles (mode lecture seule)
        if (cachedUser) setUser(null); // On n'affiche pas de fausse session
        console.log("ℹ️ [AutoLogin] Pas de session active");
      }
    } catch (err) {
      // 401 = pas de cookie ou expiré → normal sur un nouvel appareil
      if (err.response?.status !== 401) {
        console.warn("⚠️ [AutoLogin] Erreur inattendue:", err.message);
      }

      // Fallback offline : utiliser IDB si pas de réseau
      if (!navigator.onLine) {
        const idbUser = await idbGet("users", "user_active").catch(() => null);
        if (idbUser?._id) {
          setUser(idbUser);
          console.log("📴 [Offline] Utilisateur chargé depuis IDB");
        }
      }
    } finally {
      setReady(true);
      setLoading(false);
    }
  }, [syncUserToIDB]);

  // ============================================
  // CONNEXION
  // ============================================
  const login = useCallback(
    async (email, password, rememberMe = false) => {
      const safeEmail = (email || "").toString().trim().toLowerCase();
      setLoading(true);

      try {
        const res = await authAxios.post("/api/auth/login", {
          email: safeEmail,
          password: password.toString(),
          rememberMe, // ✅ Backend pose le cookie avec la bonne durée selon ce flag
        });

        if (!res.data.success) {
          throw new Error(res.data?.message || "Erreur login");
        }

        const { token: newToken, expiresIn, user: userData } = res.data;
        const expiresAt = Date.now() + (expiresIn || 3600) * 1000;

        setToken(newToken);
        setTokenExpiresAt(expiresAt);
        setUser(userData);

        // ✅ Sauvegarder uniquement les infos user (pas le token)
        secureSetItem(STORAGE_KEYS.USER_INFO, userData);
        await syncUserToIDB(userData);
        resetLoginAttempts(safeEmail);

        console.log(`✅ [Login] Connecté (rememberMe: ${rememberMe})`);
        addNotification("success", "Connecté avec succès");

        return { success: true, user: userData };
      } catch (err) {
        trackLoginAttempt(safeEmail);
        const msg =
          err.response?.data?.message || err.message || "Erreur connexion";
        addNotification("error", msg);
        return { success: false, message: msg };
      } finally {
        setLoading(false);
      }
    },
    [addNotification, trackLoginAttempt, resetLoginAttempts, syncUserToIDB]
  );

  // ============================================
  // INSCRIPTION
  // ============================================
  const register = useCallback(
    async (fullName, email, password, rememberMe = false) => {
      setLoading(true);

      try {
        const res = await authAxios.post("/api/auth/register", {
          fullName,
          email,
          password,
          rememberMe,
        });

        if (!res.data.success) {
          throw new Error(res.data?.message || "Erreur inscription");
        }

        const { token: newToken, expiresIn, user: userData } = res.data;
        const expiresAt = Date.now() + (expiresIn || 3600) * 1000;

        setToken(newToken);
        setTokenExpiresAt(expiresAt);
        setUser(userData);

        secureSetItem(STORAGE_KEYS.USER_INFO, userData);
        await syncUserToIDB(userData);

        console.log(`✅ [Register] Inscription réussie (rememberMe: ${rememberMe})`);
        addNotification("success", "Compte créé avec succès !");

        return { success: true, user: userData };
      } catch (err) {
        const msg =
          err.response?.data?.message || err.message || "Erreur inscription";
        addNotification("error", msg);
        return { success: false, message: msg };
      } finally {
        setLoading(false);
      }
    },
    [addNotification, syncUserToIDB]
  );

  // ============================================
  // MISE À JOUR DU PROFIL
  // ============================================
  const updateUserProfile = useCallback(
    async (updates) => {
      if (!updates) return;

      setUser((prev) => {
        if (!prev) return prev;
        const updated = {
          ...prev,
          ...updates,
          following:
            updates.following !== undefined
              ? updates.following
              : prev.following,
        };
        // Persister en async
        setTimeout(() => {
          secureSetItem(STORAGE_KEYS.USER_INFO, updated);
          syncUserToIDB(updated);
        }, 0);
        return updated;
      });
    },
    [syncUserToIDB]
  );

  // ============================================
  // VÉRIFICATION ADMIN
  // ============================================
  const verifyAdminToken = useCallback(async () => {
    const currentToken = await getToken();
    if (!currentToken) return null;
    try {
      const res = await axios.get(`${API_URL}/admin/verify`, {
        headers: { Authorization: `Bearer ${currentToken}` },
        withCredentials: true,
        timeout: 10000,
      });
      if (
        res.status === 200 &&
        (res.data.user?.role === "admin" || res.data.user?.role === "superadmin")
      ) {
        return currentToken;
      }
      return null;
    } catch {
      return null;
    }
  }, [getToken]);

  // ============================================
  // SOCKET
  // ============================================
  useEffect(() => {
    if (!user?._id || !token) {
      cleanupSocket();
      return;
    }

    // Ne pas recréer si déjà connecté avec le même token
    if (
      socketRef.current?.connected &&
      socketRef.current?.auth?.token === token
    ) {
      return;
    }

    cleanupSocket();

    const newSocket = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });

    newSocket.on("connect", () =>
      console.log("✅ [Socket] Connecté:", newSocket.id)
    );
    newSocket.on("connect_error", (err) =>
      console.warn("⚠️ [Socket] Erreur:", err.message)
    );
    newSocket.on("disconnect", (reason) => {
      if (reason !== "io client disconnect")
        console.log("🔌 [Socket] Déconnecté:", reason);
    });

    socketRef.current = newSocket;
    return () => cleanupSocket();
  }, [user?._id, token, cleanupSocket]);

  // ============================================
  // REFRESH AUTOMATIQUE (toutes les 60s)
  // ============================================
  useEffect(() => {
    if (!ready || !token) return;

    refreshInterval.current = setInterval(() => {
      const timeLeft = (tokenExpiresAt || 0) - Date.now();
      if (timeLeft > 0 && timeLeft < CONFIG.TOKEN_REFRESH_MARGIN_MS) {
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
    return () => {
      isMounted.current = false;
    };
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
    const isAdmin =
      user?.role === "admin" || user?.role === "superadmin";

    return {
      user,
      token,
      socket: socketRef.current,
      loading,
      ready,
      isAuthenticated: !!user && !!token,
      notifications,
      login,
      logout,
      register,
      getToken,
      updateUserProfile,
      verifyAdminToken,
      isAdmin: () => isAdmin,
      addNotification,
      isLockedOut,
    };
  }, [
    user, token, loading, ready, notifications,
    login, logout, register, getToken,
    updateUserProfile, verifyAdminToken,
    addNotification, isLockedOut,
  ]);

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}