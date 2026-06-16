// ============================================
// 📁 src/api/axiosClientGlobal.js
// ✅ VERSION DÉFINITIVE v2.1 — fusion robuste
// ✅ L'URL est 100% pilotée par VITE_API_URL dans Vercel
// 🔥 RETRY cold start Render (2s, 4s, 6s)
// ✅ RETRY 401 : refresh puis replay automatique
// ✅ File d'attente si refresh déjà en cours (0 appel parallèle)
// ✅ Langue injectée dans Accept-Language + X-User-Language
// ============================================
import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD
    ? "https://chantilink-backend.onrender.com/api"
    : "http://localhost:5000/api");

const BACKEND_URL = API_BASE_URL.replace("/api", "");

const normalizeLang = (lang) => {
  const code = String(lang || "fr").toLowerCase().split(/[-_]/)[0];
  return ["fr", "en", "ar"].includes(code) ? code : "fr";
};

export { BACKEND_URL };

console.log("🔧 [AxiosClient] Base URL:", API_BASE_URL);
console.log("🔧 [AxiosClient] Backend URL:", BACKEND_URL);

export const API_ENDPOINTS = {
  VIDEOS: {
    LIST:    "/videos",
    DELETE:  (id) => `/videos/${id}`,
    LIKE:    (id) => `/videos/${id}/like`,
    COMMENT: (id) => `/videos/${id}/comment`,
    VIEW:    (id) => `/videos/${id}/view`,
  },
  AUTH: {
    LOGIN:    "/auth/login",
    REGISTER: "/auth/register",
    REFRESH:  "/auth/refresh",
  },
};

const axiosClient = axios.create({
  baseURL:         API_BASE_URL,
  timeout:         60000,
  withCredentials: true,
  headers:         { "Content-Type": "application/json" },
});

// ─── Handlers injectés par AuthContext ───────────────────────────────────────
let authHandlers = null;

// File d'attente pour les requêtes qui arrivent pendant un refresh en cours
// Évite N appels /refresh-token parallèles qui se piétinent
let isRefreshingGlobal = false;
const waitingQueue = []; // [{ resolve, reject }]

const drainQueue = (success, newToken) => {
  waitingQueue.forEach(({ resolve, reject }) =>
    success ? resolve(newToken) : reject(new Error("Refresh échoué"))
  );
  waitingQueue.length = 0;
};

export const injectAuthHandlers = (handlers) => {
  authHandlers = handlers;
  console.log("✅ [AxiosClient] Handlers Auth injectés");
};

// ============================================
// INTERCEPTEUR REQUEST — token Bearer + langue
// ============================================
axiosClient.interceptors.request.use(
  async (config) => {
    const publicRoutes = ["/auth/login", "/auth/register", "/auth/refresh-token", "/auth/refresh", "/health"];
    const isPublic = publicRoutes.some((r) => config.url?.includes(r));

    // FormData : supprimer Content-Type (le navigateur le pose lui-même avec boundary)
    if (typeof FormData !== "undefined" && config.data instanceof FormData) {
      if (config.headers?.delete) {
        config.headers.delete("Content-Type");
      } else if (config.headers) {
        delete config.headers["Content-Type"];
        delete config.headers["content-type"];
      }
    }

    // ── Token Bearer ─────────────────────────────────────────────────
    if (!isPublic) {
      if (authHandlers?.getToken) {
        try {
          const token = await authHandlers.getToken();
          if (token) config.headers.Authorization = `Bearer ${token}`;
        } catch (e) {
          console.warn("[AxiosClient] getToken() a échoué:", e.message);
        }
      } else {
        // Fallback si handlers pas encore injectés (rare, juste après cold start)
        const token = typeof localStorage !== "undefined" ? localStorage.getItem("token") : null;
        if (token) config.headers.Authorization = `Bearer ${token}`;
      }
    }

    // ── Langue ───────────────────────────────────────────────────────
    try {
      let lang = null;
      if (authHandlers?.getLanguage) {
        try { lang = await authHandlers.getLanguage(); } catch {}
      }
      if (!lang && typeof window !== "undefined") {
        lang =
          window.localStorage?.getItem("cl_lang") ||
          (navigator?.language || navigator?.userLanguage || "fr").split("-")[0];
      }
      if (lang) {
        const normalized = normalizeLang(lang);
        config.headers["Accept-Language"] = normalized;
        config.headers["X-User-Language"]  = normalized;
      }
    } catch {}

    return config;
  },
  (error) => Promise.reject(error)
);

// ============================================
// INTERCEPTEUR RESPONSE — 401 retry + réseau + 500
// ============================================
axiosClient.interceptors.response.use(
  (response) => {
    // Le middleware auth.js backend peut pousser un nouveau token dans le header
    const freshToken = response.headers?.["x-new-access-token"];
    if (freshToken && authHandlers?.getToken) {
      // getToken() le récupérera au prochain appel via le cookie posé par le serveur
      console.log("[AxiosClient] 🔄 Nouveau token reçu via header serveur");
    }
    return response;
  },

  async (error) => {
    const originalRequest = error.config;

    // ── 401 : tentative de refresh + replay ─────────────────────────
    if (error.response?.status === 401 && !originalRequest._retry) {

      // Ne pas boucler sur les routes d'auth elles-mêmes
      if (
        originalRequest.url?.includes("/auth/refresh") ||
        originalRequest.url?.includes("/auth/login") ||
        originalRequest.url?.includes("/auth/register")
      ) {
        console.error("❌ [AxiosClient] Refresh token invalide → déconnexion");
        if (authHandlers?.logout) await authHandlers.logout(true);
        return Promise.reject(error);
      }

      console.warn("⚠️ [AxiosClient] 401 détecté → tentative de refresh...");
      originalRequest._retry = true;

      // Si un refresh est déjà en cours → on met en file d'attente
      if (isRefreshingGlobal) {
        return new Promise((resolve, reject) => {
          waitingQueue.push({
            resolve: (newToken) => {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
              resolve(axiosClient(originalRequest));
            },
            reject,
          });
        });
      }

      isRefreshingGlobal = true;

      try {
        // Demander un nouveau token via le cookie httpOnly
        // On utilise getToken() de AuthContext qui gère déjà le refresh
        let newToken = null;

        if (authHandlers?.getToken) {
          // Forcer un refresh en invalidant le token courant (trick : appel direct)
          const axios_ = axios.create({
            baseURL:         API_BASE_URL.replace("/api", ""),
            timeout:         12000,
            withCredentials: true,
            headers:         { "Content-Type": "application/json" },
          });
          const res = await axios_.post("/api/auth/refresh-token");
          if (res.data?.success && res.data?.token) {
            newToken = res.data.token;
            // Notifier AuthContext via un event custom pour qu'il mette à jour son state
            window.dispatchEvent(new CustomEvent("auth:token-refreshed", {
              detail: { token: res.data.token, expiresIn: res.data.expiresIn, user: res.data.user }
            }));
          }
        }

        if (!newToken) throw new Error("Pas de token après refresh");

        drainQueue(true, newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        console.log("✅ [AxiosClient] Refresh réussi → replay de la requête");
        return axiosClient(originalRequest);

      } catch (refreshErr) {
        console.error("❌ [AxiosClient] Refresh échoué:", refreshErr.message);
        drainQueue(false, null);
        if (authHandlers?.logout) await authHandlers.logout(true);
        return Promise.reject(refreshErr);
      } finally {
        isRefreshingGlobal = false;
      }
    }

    // ── Erreur réseau / timeout : retry cold start Render ───────────
    if (error.code === "ECONNABORTED" || error.code === "ERR_NETWORK") {
      if (originalRequest?.skipNetworkRetry) {
        if (!originalRequest?.silentNetworkError) {
          console.warn("⚠️ [AxiosClient] Appel non critique ignoré après erreur réseau:", originalRequest?.url);
        }
        return Promise.reject(error);
      }

      console.error("❌ [AxiosClient] Erreur réseau ou timeout");
      console.error("🔍 URL tentée:", originalRequest?.url);

      originalRequest._retryCount = (originalRequest._retryCount || 0) + 1;

      if (originalRequest._retryCount <= 3) {
        const delay = originalRequest._retryCount * 2000; // 2s, 4s, 6s
        console.warn(`🔁 [AxiosClient] Retry ${originalRequest._retryCount}/3 dans ${delay / 1000}s...`);
        await new Promise((res) => setTimeout(res, delay));
        return axiosClient(originalRequest);
      }

      if (authHandlers?.notify) {
        authHandlers.notify("error", "Connexion instable ou serveur injoignable.");
      }
    }

    // ── Erreur 500+ ─────────────────────────────────────────────────
    if (error.response?.status >= 500) {
      console.error("❌ [AxiosClient] Erreur Serveur", error.response.status);
      if (authHandlers?.notify) {
        authHandlers.notify("error", "Le serveur rencontre un problème momentané.");
      }
    }

    // ── 404 ─────────────────────────────────────────────────────────
    if (error.response?.status === 404) {
      console.error("❌ [AxiosClient] 404 - Route introuvable:", originalRequest?.url);
    }

    return Promise.reject(error);
  }
);

// ============================================
// HELPER apiRequest
// ============================================
export const apiRequest = async (method, url, data = null, config = {}) => {
  try {
    const response = await axiosClient({ method, url, data, ...config });
    return { success: true, data: response.data };
  } catch (error) {
    console.error(`❌ [apiRequest] ${method.toUpperCase()} ${url}:`, error);
    return {
      success: false,
      error:  error.response?.data?.message || error.message,
      status: error.response?.status,
    };
  }
};

export { API_BASE_URL as API_URL };
export default axiosClient;