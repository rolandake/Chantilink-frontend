// src/i18n/index.js
// ✅ Configuration i18next pour Chantilink
// ✅ Détection automatique de la langue navigateur
// ✅ Fallback sur le français
// ✅ Persistance dans localStorage (clé: "cl_lang")
// ✅ Support RTL pour l'arabe

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import fr from "./locales/fr.json";
import en from "./locales/en.json";
import ar from "./locales/ar.json";

// ============================================================
// LANGUES SUPPORTÉES
// ============================================================
export const SUPPORTED_LANGUAGES = [
  { code: "fr", label: "Français",  flag: "🇫🇷", dir: "ltr" },
  { code: "en", label: "English",   flag: "🇬🇧", dir: "ltr" },
  { code: "ar", label: "العربية",   flag: "🇸🇦", dir: "rtl" },
];

export const DEFAULT_LANGUAGE = "fr";
export const LANG_STORAGE_KEY = "cl_lang";

// ============================================================
// INIT i18next
// ============================================================
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      fr: { translation: fr },
      en: { translation: en },
      ar: { translation: ar },
    },

    // Langue par défaut si rien n'est détecté
    fallbackLng: DEFAULT_LANGUAGE,

    // Langues supportées (filtre le détecteur)
    supportedLngs: SUPPORTED_LANGUAGES.map((l) => l.code),

    // Détection de langue
    detection: {
      // Ordre de priorité : localStorage > navigator
      order: ["localStorage", "navigator"],
      lookupLocalStorage: LANG_STORAGE_KEY,
      caches: ["localStorage"],
    },

    interpolation: {
      // React échappe déjà les valeurs — pas besoin de double-escape
      escapeValue: false,
    },

    // Pas de namespace (on utilise "translation" par défaut)
    defaultNS: "translation",

    // Debug en dev uniquement
    debug: import.meta.env.DEV,
  });

// ============================================================
// UTILITAIRES EXPORTÉS
// ============================================================

/**
 * Change la langue globalement
 * - Met à jour i18n
 * - Met à jour l'attribut HTML lang + dir (pour RTL)
 * - Sauvegarde dans localStorage
 */
export function applyLanguage(langCode) {
  const lang = SUPPORTED_LANGUAGES.find((l) => l.code === langCode);
  if (!lang) {
    console.warn(`[i18n] Langue inconnue: "${langCode}", fallback sur "${DEFAULT_LANGUAGE}"`);
    applyLanguage(DEFAULT_LANGUAGE);
    return;
  }

  // Changer la langue i18n
  i18n.changeLanguage(lang.code);

  // Mettre à jour les attributs HTML pour l'accessibilité et le RTL
  document.documentElement.lang = lang.code;
  document.documentElement.dir  = lang.dir;

  // Persister dans localStorage
  localStorage.setItem(LANG_STORAGE_KEY, lang.code);

  if (import.meta.env.DEV) {
    console.log(`[i18n] ✅ Langue appliquée: ${lang.code} (${lang.dir})`);
  }
}

/**
 * Retourne la langue actuellement active
 */
export function getCurrentLanguage() {
  const stored = localStorage.getItem(LANG_STORAGE_KEY);
  if (stored && SUPPORTED_LANGUAGES.find((l) => l.code === stored)) return stored;
  return DEFAULT_LANGUAGE;
}

/**
 * Retourne les infos complètes de la langue active
 */
export function getCurrentLanguageInfo() {
  const code = getCurrentLanguage();
  return SUPPORTED_LANGUAGES.find((l) => l.code === code) || SUPPORTED_LANGUAGES[0];
}

export default i18n;