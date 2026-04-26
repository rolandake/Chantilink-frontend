// src/pages/profile/ProfileMenu.jsx
// ✅ NOUVEAU DESIGN — Style moderne TikTok/Instagram
// Conserve toute la logique originale + nouveau rendu visuel

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import PrivacyPolicy from "../../components/legal/PrivacyPolicy";
import { useDarkMode } from "../../context/DarkModeContext";

export default function ProfileMenu({ selectedTab, onSelectTab, isOwner, userId, stats }) {
  const { isDarkMode } = useDarkMode();

  const tabs = ["posts", "photos", "about"];
  if (isOwner) tabs.push("settings");

  const getTabConfig = (tab) => {
    switch (tab) {
      case "posts":
        return {
          label: "Publications",
          badge: stats?.posts || null,
          icon: "≡",
        };
      case "photos":
        return {
          label: "Photos",
          badge: null,
          icon: "◉",
        };
      case "about":
        return {
          label: "À propos",
          badge: null,
          icon: "ℹ",
        };
      case "settings":
        return {
          label: "Paramètres",
          badge: null,
          icon: "⚙",
        };
      default:
        return { label: tab, badge: null, icon: "·" };
    }
  };

  const bg   = isDarkMode ? '#0a0a0a' : '#fff';
  const bdr  = isDarkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
  const sub  = isDarkMode ? '#6b7280' : '#9ca3af';

  return (
    <>
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .profile-menu-tab {
          position: relative;
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          padding: 12px 6px 14px;
          border: none;
          background: none;
          cursor: pointer;
          font-family: 'Sora', 'DM Sans', sans-serif;
          transition: all 0.2s;
          text-decoration: none;
          outline: none;
        }
        .profile-menu-tab:hover .tab-icon { transform: translateY(-2px); }
      `}</style>

      {/* ── TAB BAR ── */}
      <div style={{
        background: isDarkMode ? 'rgba(10,10,10,0.98)' : 'rgba(255,255,255,0.98)',
        backdropFilter: 'blur(20px)',
        borderRadius: 20,
        border: `1px solid ${bdr}`,
        overflow: 'hidden',
        boxShadow: isDarkMode
          ? '0 4px 24px rgba(0,0,0,0.4)'
          : '0 2px 16px rgba(0,0,0,0.07)',
        fontFamily: "'Sora', 'DM Sans', sans-serif",
      }}>
        <div style={{
          display: 'flex',
          borderBottom: `1px solid ${bdr}`,
          overflowX: 'auto',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}>
          {tabs.map((tab) => {
            const config    = getTabConfig(tab);
            const isActive  = selectedTab === tab;

            return (
              <button
                key={tab}
                className="profile-menu-tab"
                onClick={() => onSelectTab(tab)}
                style={{
                  color: isActive ? '#f97316' : sub,
                  fontWeight: isActive ? 700 : 400,
                }}
              >
                {/* Icon */}
                <span
                  className="tab-icon"
                  style={{
                    fontSize: 18,
                    transition: 'transform 0.2s',
                    lineHeight: 1,
                  }}
                >
                  {config.icon}
                </span>

                {/* Label + badge */}
                <span style={{
                  fontSize: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  whiteSpace: 'nowrap',
                }}>
                  {config.label}
                  {config.badge != null && (
                    <span style={{
                      padding: '1px 7px',
                      borderRadius: 999,
                      fontSize: 10,
                      fontWeight: 700,
                      background: isActive
                        ? 'linear-gradient(135deg,#f97316,#ec4899)'
                        : (isDarkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'),
                      color: isActive ? '#fff' : sub,
                    }}>
                      {config.badge}
                    </span>
                  )}
                </span>

                {/* Active underline */}
                {isActive && (
                  <motion.div
                    layoutId="tab-underline"
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: '12%',
                      right: '12%',
                      height: 3,
                      borderRadius: '3px 3px 0 0',
                      background: 'linear-gradient(90deg,#f97316,#ec4899)',
                    }}
                    transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* ── À PROPOS ── */}
        <AnimatePresence>
          {selectedTab === "about" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              style={{ overflow: 'hidden' }}
            >
              <div style={{
                padding: 24,
                background: isDarkMode ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.01)',
              }}>
                <PrivacyPolicy />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}