import { profileApiPath } from "../profileApi";

export async function getAuthToken(getToken) {
  return typeof getToken === "function" ? getToken() : null;
}

export async function monetisationFetch(path, { token, ...options } = {}) {
  const headers = {
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  return fetch(profileApiPath(`monetisation/${String(path).replace(/^\/+/, "")}`), {
    ...options,
    headers,
    credentials: "include",
  });
}
