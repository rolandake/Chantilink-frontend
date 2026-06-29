// src/pages/profile/ProfileMenu.jsx
// v4.0 — onglets conditionnels selon accountType (personal / business / pro)
// - Profil perso       : Fil / Médias / Paramètres (owner only)
// - Page entreprise    : Fil / Paramètres (owner only)
// - Profil pro         : CV / Posts / Paramètres (owner only)
//   ⚠️ Pas d'onglet "Projets" pour le profil pro — gestion non pertinente
//   ici, contrairement aux pages entreprise.

import React, { memo } from "react";
import { motion } from "framer-motion";
import {
  RectangleStackIcon,
  PhotoIcon,
  Cog6ToothIcon,
  DocumentTextIcon, // ✅ NOUVEAU — icône onglet CV
} from "@heroicons/react/24/outline";

// ─── onglets profil personnel ────────────────────────────────────────────────
const PERSONAL_TABS = [
  { id: "feed",     label: "Fil",        icon: RectangleStackIcon                  },
  { id: "media",    label: "Médias",     icon: PhotoIcon                           },
  { id: "settings", label: "Paramètres", icon: Cog6ToothIcon, ownerOnly: true      },
];

// ─── onglets page entreprise ─────────────────────────────────────────────────
// ✅ FIX : uniquement Fil + Paramètres (plus d'Offres / Avis / Infos)
const BUSINESS_TABS = [
  { id: "feed",     label: "Fil",        icon: RectangleStackIcon                  },
  { id: "settings", label: "Paramètres", icon: Cog6ToothIcon, ownerOnly: true      },
];

// ─── onglets profil professionnel (CV en ligne) ──────────────────────────────
// ✅ NOUVEAU — CV en premier plan, Posts en 2ème onglet, pas de "Projets"
const PRO_TABS = [
  { id: "cv",       label: "CV",         icon: DocumentTextIcon                    },
  { id: "feed",     label: "Posts",      icon: RectangleStackIcon                  },
  { id: "settings", label: "Paramètres", icon: Cog6ToothIcon, ownerOnly: true      },
];

const ProfileMenu = ({
  selectedTab = "feed",
  onTabChange,
  onSelectTab,
  isDarkMode  = false,
  isOwner     = false,
  isBusiness  = false,
  isPro       = false, // ✅ NOUVEAU
}) => {
  const allTabs     = isPro ? PRO_TABS : isBusiness ? BUSINESS_TABS : PERSONAL_TABS;
  const visibleTabs = allTabs.filter((t) => !t.ownerOnly || isOwner);
  const selectTab   = onTabChange || onSelectTab;

  const border = isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)";
  const active  = isDarkMode ? "#f8fafc"               : "#0f172a";
  const muted   = isDarkMode ? "#94a3b8"               : "#64748b";
  const bg      = isDarkMode
    ? "rgba(8,8,8,0.92)"
    : "rgba(255,255,255,0.94)";

  // ✅ Couleur d'accent : violet pour le profil pro, orange sinon
  const accent = isPro ? "#6366f1" : "#f97316";
  const accentGradient = isPro
    ? "linear-gradient(135deg,#6366f1,#8b5cf6)"
    : "linear-gradient(135deg,#f97316,#ec4899)";

  return (
    <nav
      aria-label="Navigation du profil"
      style={{
        position:       "sticky",
        top:            0,
        zIndex:         10,
        background:     bg,
        backdropFilter: "blur(18px)",
        borderTop:      `1px solid ${border}`,
        borderBottom:   `1px solid ${border}`,
      }}
    >
      <div
        style={{
          display:             "grid",
          gridTemplateColumns: `repeat(${visibleTabs.length}, minmax(0, 1fr))`,
          minHeight:           54,
        }}
      >
        {visibleTabs.map(({ id, label, icon: Icon }) => {
          const isActive = selectedTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => selectTab?.(id)}
              aria-current={isActive ? "page" : undefined}
              style={{
                position:       "relative",
                border:         0,
                background:     "transparent",
                color:          isActive ? active : muted,
                cursor:         "pointer",
                display:        "flex",
                alignItems:     "center",
                justifyContent: "center",
                gap:            6,
                minWidth:       0,
                padding:        "0 6px",
                fontFamily:     "'Sora','DM Sans',sans-serif",
                fontSize:       (isBusiness || isPro) ? 11 : 12,
                fontWeight:     isActive ? 800 : 600,
                transition:     "color 0.2s",
              }}
            >
              <Icon
                style={{
                  width:    16,
                  height:   16,
                  flexShrink: 0,
                  color:    isActive ? accent : muted,
                  transition: "color 0.2s",
                }}
              />
              <span
                style={{
                  overflow:     "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace:   "nowrap",
                }}
              >
                {label}
              </span>

              {isActive && (
                <motion.span
                  layoutId="profile-menu-active"
                  style={{
                    position:   "absolute",
                    left:       12,
                    right:      12,
                    bottom:     0,
                    height:     3,
                    borderRadius: 999,
                    background: accentGradient,
                  }}
                  transition={{ type: "spring", stiffness: 500, damping: 40 }}
                />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default memo(ProfileMenu);