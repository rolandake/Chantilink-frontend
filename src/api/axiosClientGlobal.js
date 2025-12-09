// ============================================
// 📁 src/api/axiosClientGlobal.js
// ✅ VERSION FUSIONNÉE ET OPTIMISÉE
// ============================================
import axios from "axios";

// 1. Détection automatique de l'URL (comme dans api.js mais intégré ici)
const isDevelopment = 
  import.meta.env.DEV || 
  window.location.hostname === 'localhost';

const API_BASE_URL = isDevelopment
  ? (import.meta.env.VITE_API_URL_DEV || 'http://localhost:5000/api')
  : (import.meta.env.VITE_API_URL_PROD || 'https://chantilink-backend.onrender.com/api');

console.log(`🔧 [AxiosClient] Mode: ${isDevelopment ? 'DEV' : 'PROD'}`);
console.log(`📡 [AxiosClient] URL: ${API_BASE_URL}`);

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
    const publicRoutes = ['/auth/login', '/auth/register', '/auth/refresh'];
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
      if (originalRequest.url?.includes('/auth/refresh')) {
        // Si le refresh échoue, c'est fini -> Logout
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
      if (authHandlers?.notify) authHandlers.notify("error", msg);
      
      // Ici tu pourrais retourner des données en cache si tu utilises React Query ou similar
    }

    // ------------------------------------
    // Cas 3 : Erreurs Serveur (5xx)
    // ------------------------------------
    if (error.response?.status >= 500) {
      console.error("❌ [AxiosClient] Erreur Serveur");
      if (authHandlers?.notify) authHandlers.notify("error", "Le serveur rencontre un problème momentané.");
    }

    return Promise.reject(error);
  }
);

export default axiosClient;