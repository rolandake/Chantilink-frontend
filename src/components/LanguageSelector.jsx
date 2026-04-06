// src/components/LanguageSelector.jsx
// ✅ Composant réutilisable — à intégrer dans la page Paramètres
// ✅ Se connecte au LanguageContext (changeLanguage global)
// ✅ Synchro backend automatique (debounce 800ms)
// ✅ Feedback visuel immédiat

import React from "react";
import { useTranslation } from "react-i18next";
import { useLanguage } from "../context/LanguageContext";

// ============================================================
// USAGE :
//   import LanguageSelector from "../components/LanguageSelector";
//
//   // Dans ta page Settings :
//   <LanguageSelector />
//
//   // Variante compacte (pills uniquement) :
//   <LanguageSelector variant="pills" />
//
//   // Variante dropdown :
//   <LanguageSelector variant="dropdown" />
// ============================================================

export default function LanguageSelector({ variant = "pills", className = "" }) {
  const { t } = useTranslation();
  const { language, supportedLanguages, changeLanguage, isChanging } = useLanguage();

  const handleChange = async (langCode) => {
    if (langCode === language || isChanging) return;
    await changeLanguage(langCode, { sync: true }); // Sync backend car utilisateur connecté
  };

  // ── Variant : pills ─────────────────────────────────────────
  if (variant === "pills") {
    return (
      <div
        className={`lang-selector-pills ${className}`}
        style={{
          display: "flex",
          gap: "8px",
          flexWrap: "wrap",
        }}
      >
        {supportedLanguages.map((lang) => (
          <button
            key={lang.code}
            type="button"
            disabled={isChanging}
            onClick={() => handleChange(lang.code)}
            style={{
              padding: "9px 14px",
              border: `1px solid ${language === lang.code ? "rgba(249,115,22,.5)" : "rgba(255,255,255,.1)"}`,
              borderRadius: "10px",
              background: language === lang.code ? "rgba(249,115,22,.12)" : "rgba(255,255,255,.03)",
              color: language === lang.code ? "#f97316" : "#888",
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "14px",
              fontWeight: language === lang.code ? 600 : 400,
              cursor: isChanging ? "not-allowed" : "pointer",
              transition: "all .2s",
              display: "flex",
              alignItems: "center",
              gap: "7px",
              opacity: isChanging ? 0.6 : 1,
            }}
          >
            <span style={{ fontSize: "16px" }}>{lang.flag}</span>
            <span>{lang.label}</span>
            {language === lang.code && (
              <span style={{ color: "#f97316", fontSize: "11px" }}>✓</span>
            )}
          </button>
        ))}
      </div>
    );
  }

  // ── Variant : dropdown ──────────────────────────────────────
  if (variant === "dropdown") {
    return (
      <div
        className={`lang-selector-dropdown ${className}`}
        style={{ position: "relative", display: "inline-block" }}
      >
        <select
          value={language}
          disabled={isChanging}
          onChange={(e) => handleChange(e.target.value)}
          style={{
            padding: "11px 40px 11px 16px",
            background: "rgba(255,255,255,.04)",
            border: "1px solid rgba(255,255,255,.1)",
            borderRadius: "12px",
            color: "#f0f0f0",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "14px",
            cursor: "pointer",
            appearance: "none",
            WebkitAppearance: "none",
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L6 7L11 1' stroke='%235c5c6e' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
            backgroundRepeat: "no-repeat",
            backgroundPosition: "right 14px center",
            outline: "none",
            transition: "border-color .2s, box-shadow .2s",
          }}
          onFocus={(e) => {
            e.target.style.borderColor = "rgba(249,115,22,.5)";
            e.target.style.boxShadow = "0 0 0 3px rgba(249,115,22,.07)";
          }}
          onBlur={(e) => {
            e.target.style.borderColor = "rgba(255,255,255,.1)";
            e.target.style.boxShadow = "none";
          }}
        >
          {supportedLanguages.map((lang) => (
            <option key={lang.code} value={lang.code} style={{ background: "#111115" }}>
              {lang.flag} {lang.label}
            </option>
          ))}
        </select>

        {isChanging && (
          <span
            style={{
              position: "absolute",
              right: "36px",
              top: "50%",
              transform: "translateY(-50%)",
              width: "14px",
              height: "14px",
              border: "2px solid rgba(249,115,22,.3)",
              borderTopColor: "#f97316",
              borderRadius: "50%",
              animation: "spin .6s linear infinite",
            }}
          />
        )}
      </div>
    );
  }

  return null;
}

// ============================================================
// EXEMPLE D'INTÉGRATION DANS LA PAGE SETTINGS
// ============================================================
//
// import { useTranslation } from "react-i18next";
// import LanguageSelector from "../../components/LanguageSelector";
//
// function SettingsPage() {
//   const { t } = useTranslation();
//
//   return (
//     <div>
//       <h2>{t("settings.title")}</h2>
//
//       <section>
//         <h3>{t("settings.language")}</h3>
//         <LanguageSelector variant="pills" />
//         {/* OU */}
//         <LanguageSelector variant="dropdown" />
//       </section>
//     </div>
//   );
// }