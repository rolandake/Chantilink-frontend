// ============================================
// 📁 src/api/axiosClientGlobal.js
// ✅ VERSION FUSIONNÉE ET OPTIMISÉE - CORRIGÉE
// ============================================
import axios from "axios";

// 1. Détection automatique de l'URL
const isDevelopment = 
  import.meta.env.DEV || 
  window.location.hostname === 'localhost';

// ✅ CORRECTION : On enlève /api de la baseURL car il sera ajouté dans les routes
const API_BASE_URL = isDevelopment
  ? (import.meta.env.VITE_API_URL_DEV || 'http://localhost:5000')
  : (import.meta.env.VITE_API_URL_PROD || 'https://chantilink-backend.onrender.com');

console.log(`🔧 [AxiosClient] Mode: ${isDevelopment ? 'DEV' : 'PROD'}`);
console.log(`📡 [AxiosClient] Base URL: ${API_BASE_URL}`);

const axiosClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000, // 60s pour les connexions lentes en 4G
  withCredentials: true,
  headers: { 
    "Content-Type": "application/json" 
  },
});

// Stockage des handlers d'authentification (injectés depuis AuthContext)
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
    // Liste des routes qui n'ont PAS besoin de token
    const publicRoutes = ['/api/auth/login', '/api/auth/register', '/api/auth/refresh', '/api/health'];
    const isPublic = publicRoutes.some(r => config.url?.includes(r));

    if (!isPublic) {
      // 1. Essayer via le handler injecté (le plus fiable)
      if (authHandlers?.getToken) {
        const token = await authHandlers.getToken();
        if (token) config.headers.Authorization = `Bearer ${token}`;
      } 
      // 2. Fallback localStorage (si AuthContext pas encore prêt)
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
// 🔄 INTERCEPTEUR RESPONSE (Retry & Erreurs)
// ============================================
axiosClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // ------------------------------------
    // Cas 1 : Token Expiré (401)
    // ------------------------------------
    if (error.response?.status === 401 && !originalRequest._retry) {
      
      // Éviter boucle infinie sur la route de refresh elle-même
      if (originalRequest.url?.includes('/api/auth/refresh')) {
        console.error("❌ [AxiosClient] Refresh token invalide - Déconnexion");
        if (authHandlers?.logout) await authHandlers.logout();
        return Promise.reject(error);
      }

      console.warn("⚠️ [AxiosClient] 401 - Tentative de refresh...");
      originalRequest._retry = true;

      try {
        // Tenter le refresh via AuthContext
        if (authHandlers?.refreshTokenForUser) {
          const success = await authHandlers.refreshTokenForUser();
          if (success) {
            // Récupérer le nouveau token
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

    // ------------------------------------
    // Cas 2 : Timeout / Réseau (Mode Hors Ligne)
    // ------------------------------------
    if (error.code === "ECONNABORTED" || error.code === "ERR_NETWORK") {
      console.error("❌ [AxiosClient] Erreur réseau ou timeout");
      const msg = "Connexion instable ou serveur injoignable.";
      if (authHandlers?.notify) {
        authHandlers.notify("error", msg);
      } else {
        console.warn("⚠️ Pas de système de notification disponible");
      }
    }

    // ------------------------------------
    // Cas 3 : Erreurs Serveur (5xx)
    // ------------------------------------
    if (error.response?.status >= 500) {
      console.error("❌ [AxiosClient] Erreur Serveur", error.response.status);
      if (authHandlers?.notify) {
        authHandlers.notify("error", "Le serveur rencontre un problème momentané.");
      }
    }

    // ------------------------------------
    // Cas 4 : Erreurs 404 (pour debug)
    // ------------------------------------
    if (error.response?.status === 404) {
      console.error("❌ [AxiosClient] 404 - Route introuvable:", originalRequest.url);
    }

    return Promise.reject(error);
  }
);

// ============================================
// 🛠️ HELPERS UTILES
// ============================================

/**
 * Helper pour construire des URLs avec /api automatiquement
 * Usage: buildApiUrl('/story/feed') => '/api/story/feed'
 */
export const buildApiUrl = (path) => {
  // Si le path commence déjà par /api, on ne le rajoute pas
  if (path.startsWith('/api/')) return path;
  // Sinon on l'ajoute
  return `/api${path.startsWith('/') ? '' : '/'}${path}`;
};

/**
 * Helper pour les appels API avec gestion d'erreur intégrée
 */
export const apiRequest = async (method, url, data = null, config = {}) => {
  try {
    const fullUrl = buildApiUrl(url);
    const response = await axiosClient({
      method,
      url: fullUrl,
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

export default axiosClient;