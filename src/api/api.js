// frontend/src/api/api.js (ou votre chemin)
import axios from "axios";

// ✅ CORRECTION : Utilise VITE_API_URL (cohérent avec votre .env)
const baseURL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

// 🔍 Log de debug (à retirer en production)
console.log("🔧 [API] Base URL:", baseURL);
console.log("🔧 [API] Env:", import.meta.env.MODE);

const api = axios.create({
  baseURL,
  timeout: 30000, // 30s pour Render (peut être lent au réveil)
  withCredentials: true, // Important pour les cookies
  headers: {
    "Content-Type": "application/json",
  },
});

// Intercepteur pour injecter le token
api.interceptors.request.use(
  (config) => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        if (user.token) {
          config.headers.Authorization = `Bearer ${user.token}`;
          console.log("✅ Token ajouté à la requête");
        }
      } catch (err) {
        console.error("❌ Erreur parsing user:", err);
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Intercepteur pour gérer les erreurs globalement
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Timeout
    if (error.code === "ECONNABORTED") {
      console.error("❌ Timeout - Render en sleep mode ?");
      error.userMessage = "Le serveur met trop de temps à répondre. Attendez 60 secondes et réessayez.";
    }
    
    // Erreur réseau
    if (error.code === "ERR_NETWORK") {
      console.error("❌ Erreur réseau - Backend inaccessible");
      error.userMessage = "Impossible de contacter le serveur. Vérifiez votre connexion.";
    }
    
    // Token expiré
    if (error.response?.status === 401) {
      console.warn("⚠️ Token expiré, déconnexion...");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    
    // CORS
    if (error.message.includes("CORS")) {
      console.error("❌ Erreur CORS - Vérifiez config backend");
      error.userMessage = "Erreur de configuration serveur (CORS).";
    }
    
    return Promise.reject(error);
  }
);

export default api;