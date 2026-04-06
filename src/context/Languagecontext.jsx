// src/context/LanguageContext.jsx
// ✅ Contexte global de langue pour Chantilink
// ✅ S'intègre avec i18n/index.js
// ✅ Synchronise avec le user connecté (AuthContext)
// ✅ Sauvegarde côté backend via PATCH /api/users/language
// ✅ Fournit changeLanguage() utilisable partout dans l'app

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import {
  applyLanguage,
  getCurrentLanguage,
  SUPPORTED_LANGUAGES,
  LANG_STORAGE_KEY,
} from "../i18n";

// ============================================================
// CONTEXT
// ============================================================
const LanguageContext = createContext({
  language: "fr",
  languageInfo: SUPPORTED_LANGUAGES[0],
  supportedLanguages: SUPPORTED_LANGUAGES,
  changeLanguage: async () => {},
  isChanging: false,
});

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage doit être utilisé dans un LanguageProvider");
  return ctx;
};

// ============================================================
// PROVIDER
// ============================================================
export function LanguageProvider({ children, getToken }) {
  const [language, setLanguage]   = useState(getCurrentLanguage);
  const [isChanging, setChanging] = useState(false);
  const syncTimeoutRef            = useRef(null);

  // Infos complètes de la langue active
  const languageInfo = SUPPORTED_LANGUAGES.find((l) => l.code === language) || SUPPORTED_LANGUAGES[0];

  // ── Appliquer la langue au démarrage ──────────────────────────
  useEffect(() => {
    applyLanguage(language);
  }, []);

  // ── Sync quand localStorage change (autre onglet) ────────────
  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === LANG_STORAGE_KEY && e.newValue && e.newValue !== language) {
        setLanguage(e.newValue);
        applyLanguage(e.newValue);
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [language]);

  // ── Sauvegarder côté backend (debounced) ─────────────────────
  const syncToBackend = useCallback(
    async (langCode) => {
      // Nettoyer le timeout précédent
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);

      syncTimeoutRef.current = setTimeout(async () => {
        // On a besoin du token — si pas fourni, on skip (utilisateur non connecté)
        if (!getToken) return;

        try {
          const token = await getToken();
          if (!token) return; // Non connecté = pas de sync backend

          const API_URL = import.meta.env.PROD
            ? import.meta.env.VITE_API_URL_PROD || "https://chantilink-backend.onrender.com/api"
            : import.meta.env.VITE_API_URL_LOCAL || "http://localhost:5000/api";

          const res = await fetch(`${API_URL}/users/language`, {
            method:  "PATCH",
            headers: {
              "Content-Type":  "application/json",
              "Authorization": `Bearer ${token}`,
            },
            credentials: "include",
            body: JSON.stringify({ language: langCode }),
          });

          if (!res.ok) {
            console.warn("[LanguageContext] Échec sync backend langue:", res.status);
          } else if (import.meta.env.DEV) {
            console.log(`[LanguageContext] ✅ Langue synchronisée avec le backend: ${langCode}`);
          }
        } catch (err) {
          // Silencieux — le localStorage est déjà à jour
          if (import.meta.env.DEV) {
            console.warn("[LanguageContext] Impossible de sync la langue:", err.message);
          }
        }
      }, 800); // Debounce 800ms
    },
    [getToken]
  );

  // ── changeLanguage : point d'entrée unique ───────────────────
  /**
   * Changer la langue dans toute l'app.
   * @param {string} langCode - Code langue ("fr", "en", "ar")
   * @param {object} options
   * @param {boolean} options.sync - Synchroniser avec le backend (défaut: true)
   */
  const changeLanguage = useCallback(
    async (langCode, { sync = true } = {}) => {
      if (langCode === language) return;

      const isSupported = SUPPORTED_LANGUAGES.find((l) => l.code === langCode);
      if (!isSupported) {
        console.warn(`[LanguageContext] Langue non supportée: "${langCode}"`);
        return;
      }

      setChanging(true);
      try {
        // 1️⃣ Appliquer immédiatement (i18n + HTML + localStorage)
        applyLanguage(langCode);
        setLanguage(langCode);

        // 2️⃣ Sync backend en arrière-plan (debounced, silencieux)
        if (sync) {
          syncToBackend(langCode);
        }
      } finally {
        setChanging(false);
      }
    },
    [language, syncToBackend]
  );

  // ── Méthode pour initialiser depuis les données user ─────────
  /**
   * Appelé par AuthContext après login/refresh pour appliquer
   * la langue préférée de l'utilisateur stockée en base.
   */
  const initFromUser = useCallback(
    (userLanguage) => {
      if (!userLanguage) return;
      if (userLanguage === language) return;

      const isSupported = SUPPORTED_LANGUAGES.find((l) => l.code === userLanguage);
      if (!isSupported) return;

      // Appliquer sans sync backend (on vient justement du backend)
      applyLanguage(userLanguage);
      setLanguage(userLanguage);
    },
    [language]
  );

  return (
    <LanguageContext.Provider
      value={{
        language,
        languageInfo,
        supportedLanguages: SUPPORTED_LANGUAGES,
        changeLanguage,
        initFromUser,
        isChanging,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}