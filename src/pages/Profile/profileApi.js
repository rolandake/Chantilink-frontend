export const PROFILE_API_BASE = (
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? "https://chantilink-backend.onrender.com/api" : "http://localhost:5000/api")
).replace(/\/+$/, "");

export const PROFILE_BACKEND_BASE = PROFILE_API_BASE.replace(/\/api\/?$/, "");

export const profileApiUrl = (path = "") => {
  const cleanPath = String(path).replace(/^\/+/, "");
  return `${PROFILE_BACKEND_BASE}/${cleanPath}`;
};

export const profileApiPath = (path = "") => profileApiUrl(`api/${String(path).replace(/^\/+/, "")}`);

export const authJsonHeaders = (token) => ({
  "Content-Type": "application/json",
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});
