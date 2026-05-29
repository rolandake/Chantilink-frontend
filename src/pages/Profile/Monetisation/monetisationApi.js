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

export async function readMonetisationJson(response, fallbackMessage = "Réponse monétisation invalide") {
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    const text = await response.text().catch(() => "");
    const looksLikeHtml = /^\s*</.test(text);
    throw new Error(looksLikeHtml ? "Route monétisation indisponible sur le backend." : fallbackMessage);
  }

  return response.json();
}
