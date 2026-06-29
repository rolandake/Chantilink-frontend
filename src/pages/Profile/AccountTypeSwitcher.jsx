// src/pages/profile/AccountTypeSwitcher.jsx
// Dropdown de sélection du type de compte affiché EN HAUT de SettingsSection
// Remplace le système d'onglets séparés "Entreprise" / "Pro" par un seul sélecteur
// Quand l'utilisateur change de type, SettingsSection recharge ses onglets

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDarkMode } from "../../context/DarkModeContext";

const ACCOUNT_TYPES = [
  {
    id:    "personal",
    label: "Profil personnel",
    icon:  "👤",
    desc:  "Profil classique — posts, abonnés, bio",
    color: "#6b7280",
    badge: null,
  },
  {
    id:    "pro",
    label: "Profil professionnel",
    icon:  "💼",
    desc:  "CV, expériences, compétences, disponibilité",
    color: "#6366f1",
    badge: "Pro",
  },
  {
    id:    "business",
    label: "Page entreprise",
    icon:  "🏢",
    desc:  "Infos pro, services, offres, horaires",
    color: "#f97316",
    badge: "Biz",
  },
];

export default function AccountTypeSwitcher({ currentType = "personal", onChange }) {
  const { isDarkMode } = useDarkMode();
  const [open, setOpen]   = useState(false);
  const wrapRef           = useRef(null);

  const current = ACCOUNT_TYPES.find((t) => t.id === currentType) || ACCOUNT_TYPES[0];

  useEffect(() => {
    const h = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const bdr  = isDarkMode ? "rgba(255,255,255,0.1)"  : "rgba(0,0,0,0.1)";
  const bg   = isDarkMode ? "#111"  : "#fff";
  const text = isDarkMode ? "#f8fafc" : "#0f172a";
  const sub  = isDarkMode ? "#6b7280" : "#9ca3af";

  return (
    <div ref={wrapRef} style={{ position: "relative", fontFamily: "'Sora','DM Sans',sans-serif" }}>

      {/* ── Label ── */}
      <p style={{ fontSize: 11, fontWeight: 700, color: sub, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
        Type de compte
      </p>

      {/* ── Bouton trigger ── */}
      <motion.button
        type="button"
        onClick={() => setOpen((v) => !v)}
        whileTap={{ scale: 0.98 }}
        style={{
          width:        "100%",
          display:      "flex",
          alignItems:   "center",
          justifyContent: "space-between",
          gap:          12,
          padding:      "12px 16px",
          borderRadius: 14,
          border:       `1.5px solid ${open ? current.color : bdr}`,
          background:   bg,
          cursor:       "pointer",
          transition:   "border-color 0.2s",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{
            width:        36,
            height:       36,
            borderRadius: 10,
            background:   `${current.color}18`,
            display:      "flex",
            alignItems:   "center",
            justifyContent: "center",
            fontSize:     18,
            flexShrink:   0,
          }}>
            {current.icon}
          </span>
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: text }}>{current.label}</div>
            <div style={{ fontSize: 11, color: sub, marginTop: 1 }}>{current.desc}</div>
          </div>
        </div>

        <motion.div
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          style={{ color: sub, flexShrink: 0 }}
        >
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </motion.div>
      </motion.button>

      {/* ── Dropdown ── */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0,  scale: 1 }}
            exit={{   opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.18 }}
            style={{
              position:     "absolute",
              top:          "calc(100% + 8px)",
              left:         0,
              right:        0,
              borderRadius: 16,
              overflow:     "hidden",
              background:   bg,
              border:       `1.5px solid ${bdr}`,
              boxShadow:    isDarkMode
                ? "0 16px 48px rgba(0,0,0,0.5)"
                : "0 8px 32px rgba(0,0,0,0.12)",
              zIndex:       50,
            }}
          >
            {ACCOUNT_TYPES.map((type) => {
              const isActive = type.id === currentType;
              return (
                <motion.button
                  key={type.id}
                  type="button"
                  onClick={() => { onChange?.(type.id); setOpen(false); }}
                  whileHover={{ background: isDarkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)" }}
                  style={{
                    width:        "100%",
                    display:      "flex",
                    alignItems:   "center",
                    gap:          12,
                    padding:      "13px 16px",
                    border:       "none",
                    borderBottom: `1px solid ${bdr}`,
                    background:   isActive
                      ? isDarkMode ? `${type.color}14` : `${type.color}0a`
                      : "transparent",
                    cursor:       "pointer",
                    textAlign:    "left",
                    fontFamily:   "inherit",
                    transition:   "background 0.15s",
                  }}
                >
                  {/* Icône */}
                  <span style={{
                    width:        36,
                    height:       36,
                    borderRadius: 10,
                    background:   `${type.color}18`,
                    display:      "flex",
                    alignItems:   "center",
                    justifyContent: "center",
                    fontSize:     18,
                    flexShrink:   0,
                  }}>
                    {type.icon}
                  </span>

                  {/* Texte */}
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize:   13,
                      fontWeight: 700,
                      color:      isActive ? type.color : text,
                      display:    "flex",
                      alignItems: "center",
                      gap:        6,
                    }}>
                      {type.label}
                      {type.badge && (
                        <span style={{
                          padding:      "1px 6px",
                          borderRadius: 999,
                          fontSize:     9,
                          fontWeight:   800,
                          background:   `${type.color}20`,
                          color:        type.color,
                          border:       `1px solid ${type.color}40`,
                        }}>
                          {type.badge}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: sub, marginTop: 1 }}>{type.desc}</div>
                  </div>

                  {/* Check actif */}
                  {isActive && (
                    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={type.color} strokeWidth={2.5} strokeLinecap="round" style={{ flexShrink: 0 }}>
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </motion.button>
              );
            })}

            {/* Footer */}
            <div style={{ padding: "10px 16px", background: isDarkMode ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)" }}>
              <p style={{ fontSize: 10, color: sub, margin: 0, lineHeight: 1.5 }}>
                Tu peux changer de type à tout moment. Tes posts et abonnés sont conservés.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}