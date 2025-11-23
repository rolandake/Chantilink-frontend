// frontend/src/api/axiosClientGlobal.js
import axios from "axios";

// ✅ Utilise VITE_API_URL (cohérent avec api.js)
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

// 🔍 Log de debug
console.log("🔧 [AxiosClient] API URL:", API_BASE_URL);

const axiosClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30s pour Render
  withCredentials: true,
  headers: { 
    "Content-Type": "application/json" 
  },
});

// Intercepteur pour injecter le token automatiquement
export const injectAuthHandlers = ({ getToken }) => {
  axiosClient.interceptors.request.use(
    async (config) => {
      try {
        const token = await getToken?.();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
          console.log("✅ [AxiosClient] Token injecté");
        }
      } catch (err) {
        console.error("❌ [AxiosClient] Erreur récupération token:", err);
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );
};

// Intercepteur global pour les erreurs
axiosClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Timeout
    if (error.code === "ECONNABORTED") {
      console.error("❌ [AxiosClient] Timeout");
      error.userMessage = "Le serveur met trop de temps à répondre (Render en veille ?).";
    }
    
    // Erreur réseau
    if (error.code === "ERR_NETWORK") {
      console.error("❌ [AxiosClient] Erreur réseau");
      error.userMessage = "Impossible de contacter le serveur.";
    }
    
    // 401 Unauthorized
    if (error.response?.status === 401) {
      console.warn("⚠️ [AxiosClient] Non authentifié");
      // Ne pas rediriger automatiquement ici si vous utilisez un context
    }
    
    // CORS
    if (error.message.includes("CORS")) {
      console.error("❌ [AxiosClient] CORS bloqué");
      error.userMessage = "Erreur de configuration serveur.";
    }
    
    return Promise.reject(error);
  }
);

export default axiosClient;