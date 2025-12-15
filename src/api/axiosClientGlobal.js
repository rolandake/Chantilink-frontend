// ============================================
// 📁 src/api/axiosClientGlobal.js
// ✅ VERSION FINALE - COMPATIBLE AVEC .env
// ============================================
import axios from "axios";

// ============================================
// 🔧 DÉTECTION ENVIRONNEMENT ROBUSTE
// ============================================
const getEnvironment = () => {
  // 1. Vérifier NODE_ENV explicite
  if (import.meta.env.VITE_NODE_ENV === 'production') return 'production';
  if (import.meta.env.MODE === 'production') return 'production';
  
  // 2. Vérifier hostname
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') return 'development';
  
  // 3. Si déployé (domaine), c'est PROD
  return 'production';
};

const ENV = getEnvironment();
const isDevelopment = ENV === 'development';

// ============================================
// 🌐 CONFIGURATION URL SELON ENVIRONNEMENT
// ============================================
const getApiUrl = () => {
  if (isDevelopment) {
    // DEV : Utilise LOCAL
    return import.meta.env.VITE_API_URL_LOCAL || 
           import.meta.env.VITE_API_URL_DEV || 
           'http://localhost:5000/api';
  } else {
    // PROD : Utilise PROD
    return import.meta.env.VITE_API_URL_PROD || 
           import.meta.env.VITE_API_URL || 
           'https://chantilink-backend.onrender.com/api';
  }
};

const API_BASE_URL = getApiUrl();

// ✅ LOGS DE DEBUG
console.log(`🔧 [AxiosClient] Environment: ${ENV}`);
console.log(`📡 [AxiosClient] Base URL: ${API_BASE_URL}`);
console.log(`🌍 [AxiosClient] Hostname: ${window.location.hostname}`);
console.log(`📋 [AxiosClient] Variables env disponibles:`, {
  VITE_API_URL_LOCAL: import.meta.env.VITE_API_URL_LOCAL,
  VITE_API_URL_PROD: import.meta.env.VITE_API_URL_PROD,
  MODE: import.meta.env.MODE
});

// ============================================
// 📦 INSTANCE AXIOS
// ============================================
const axiosClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000,
  withCredentials: true,
  headers: { 
    "Content-Type": "application/json" 
  },
});

// Stockage des handlers d'authentification
let authHandlers = null;

export const injectAuthHandlers = (handlers) => {
  authHandlers = handlers;
  console.log("✅ [AxiosClient] Handlers Auth injectés");
};

// ============================================
// 🔑 INTERCEPTEUR REQUEST
// ============================================
axiosClient.interceptors.request.use(
  async (config) => {
    // Routes publiques (pas de token requis)
    const publicRoutes = ['/auth/login', '/auth/register', '/auth/refresh', '/health'];
    const isPublic = publicRoutes.some(r => config.url?.includes(r));

    if (!isPublic) {
      // 1. Via AuthContext
      if (authHandlers?.getToken) {
        const token = await authHandlers.getToken();
        if (token) config.headers.Authorization = `Bearer ${token}`;
      } 
      // 2. Fallback localStorage
      else {
        const token = localStorage.getItem("token");
        if (token) config.headers.Authorization = `Bearer ${token}`;
      }
    }
    
    return config;
  },
  (error) => Promise.reject(error)
);

// ============================================
// 🔄 INTERCEPTEUR RESPONSE
// ============================================
axiosClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // CAS 1 : Token Expiré (401)
    if (error.response?.status === 401 && !originalRequest._retry) {
      
      // Éviter boucle infinie sur refresh
      if (originalRequest.url?.includes('/auth/refresh')) {
        console.error("❌ [AxiosClient] Refresh token invalide - Déconnexion");
        if (authHandlers?.logout) await authHandlers.logout();
        return Promise.reject(error);
      }

      console.warn("⚠️ [AxiosClient] 401 - Tentative de refresh...");
      originalRequest._retry = true;

      try {
        if (authHandlers?.refreshTokenForUser) {
          const success = await authHandlers.refreshTokenForUser();
          if (success) {
            const newToken = await authHandlers.getToken();
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            console.log("✅ [AxiosClient] Refresh réussi, on rejoue la requête.");
            return axiosClient(originalRequest);
          }
        }
      } catch (refreshErr) {
        console.error("❌ [AxiosClient] Echec du refresh:", refreshErr);
        if (authHandlers?.logout) await authHandlers.logout();
      }
    }

    // CAS 2 : Erreur Réseau
    if (error.code === "ECONNABORTED" || error.code === "ERR_NETWORK") {
      console.error("❌ [AxiosClient] Erreur réseau:", error.message);
      console.error("🔍 [AxiosClient] URL tentée:", originalRequest?.url);
      console.error("🔍 [AxiosClient] Base URL:", API_BASE_URL);
      
      if (authHandlers?.notify) {
        authHandlers.notify("error", "Connexion instable ou serveur injoignable.");
      }
    }

    // CAS 3 : Erreur Serveur (5xx)
    if (error.response?.status >= 500) {
      console.error("❌ [AxiosClient] Erreur Serveur", error.response.status);
      if (authHandlers?.notify) {
        authHandlers.notify("error", "Le serveur rencontre un problème momentané.");
      }
    }

    // CAS 4 : 404
    if (error.response?.status === 404) {
      console.error("❌ [AxiosClient] 404 - Route introuvable:", originalRequest?.url);
    }

    return Promise.reject(error);
  }
);

// ============================================
// 🛠️ HELPERS
// ============================================

/**
 * Wrapper pour appels API simplifiés
 * IMPORTANT : N'ajoute PAS /api/ car déjà dans baseURL
 */
export const apiRequest = async (method, url, data = null, config = {}) => {
  try {
    // Ne PAS ajouter /api car déjà dans baseURL
    const response = await axiosClient({
      method,
      url, // URL tel quel (ex: /auth/login)
      data,
      ...config
    });
    return { success: true, data: response.data };
  } catch (error) {
    console.error(`❌ [apiRequest] ${method.toUpperCase()} ${url}:`, error);
    return { 
      success: false, 
      error: error.response?.data?.message || error.message,
      status: error.response?.status
    };
  }
};

/**
 * Export de l'URL pour d'autres modules
 */
export const API_URL = API_BASE_URL;

export default axiosClient;