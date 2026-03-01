// ============================================
// 📁 src/api/axiosClientGlobal.js
// ✅ VERSION FINALE CORRIGÉE AVEC EXPORTS
// ✅ Adapté aux noms de variables Vercel exacts
// ============================================
import axios from "axios";

// ✅ Base URL — lit toutes les variantes possibles dans l'ordre de priorité
const API_BASE_URL = 
  import.meta.env.VITE_API_URL ||           // nom standard
  import.meta.env['URL de l\'API VITE'] ||  // nom Vercel tel quel (peu probable)
  import.meta.env.VITE_API_URL_PROD ||      // fallback prod
  'http://localhost:5000/api';              // fallback local

// ✅ Backend URL — lit toutes les variantes possibles
const BACKEND_URL_RAW =
  import.meta.env.VITE_BACKEND_URL ||       // nom standard
  import.meta.env.URL_BACKEND_VITE ||       // nom Vercel exact
  import.meta.env.VITE_BACKEND_URL_LOCAL ||
  API_BASE_URL.replace('/api', '');

export const BACKEND_URL = BACKEND_URL_RAW;

console.log('🔧 [AxiosClient] Base URL:', API_BASE_URL);
console.log('🔧 [AxiosClient] Backend URL:', BACKEND_URL);

// ✅ API Endpoints
export const API_ENDPOINTS = {
  VIDEOS: {
    LIST: '/videos',
    DELETE: (id) => `/videos/${id}`,
    LIKE: (id) => `/videos/${id}/like`,
    COMMENT: (id) => `/videos/${id}/comment`,
    VIEW: (id) => `/videos/${id}/view`,
  },
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    REFRESH: '/auth/refresh',
  }
};

const axiosClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000,
  withCredentials: true,
  headers: { 
    "Content-Type": "application/json" 
  },
});

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
    const publicRoutes = ['/auth/login', '/auth/register', '/auth/refresh', '/health'];
    const isPublic = publicRoutes.some(r => config.url?.includes(r));

    if (!isPublic) {
      if (authHandlers?.getToken) {
        const token = await authHandlers.getToken();
        if (token) config.headers.Authorization = `Bearer ${token}`;
      } else {
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
    
    if (error.response?.status === 401 && !originalRequest._retry) {
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

    if (error.code === "ECONNABORTED" || error.code === "ERR_NETWORK") {
      console.error("❌ [AxiosClient] Erreur réseau ou timeout");
      console.error("🔍 [AxiosClient] URL tentée:", originalRequest?.url);
      console.error("🔍 [AxiosClient] Base URL:", API_BASE_URL);
      if (authHandlers?.notify) {
        authHandlers.notify("error", "Connexion instable ou serveur injoignable.");
      }
    }

    if (error.response?.status >= 500) {
      console.error("❌ [AxiosClient] Erreur Serveur", error.response.status);
      if (authHandlers?.notify) {
        authHandlers.notify("error", "Le serveur rencontre un problème momentané.");
      }
    }

    if (error.response?.status === 404) {
      console.error("❌ [AxiosClient] 404 - Route introuvable:", originalRequest?.url);
    }

    return Promise.reject(error);
  }
);

export const apiRequest = async (method, url, data = null, config = {}) => {
  try {
    const response = await axiosClient({ method, url, data, ...config });
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

export { API_BASE_URL as API_URL };
export default axiosClient;