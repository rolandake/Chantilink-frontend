import React, { memo } from "react";
import { motion } from "framer-motion";
import {
  PhotoIcon,
  Cog6ToothIcon,
  RectangleStackIcon,
} from "@heroicons/react/24/outline";

const baseTabs = [
  { id: "feed", label: "Fil", icon: RectangleStackIcon },
  { id: "media", label: "Medias", icon: PhotoIcon },
  { id: "settings", label: "Parametres", icon: Cog6ToothIcon, ownerOnly: true },
];

const ProfileMenu = ({
  selectedTab = "feed",
  onTabChange,
  onSelectTab,
  isDarkMode = false,
  isOwner = false,
}) => {
  const visibleTabs = baseTabs.filter((tab) => !tab.ownerOnly || isOwner);
  const selectTab = onTabChange || onSelectTab;
  const border = isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)";
  const text = isDarkMode ? "#f8fafc" : "#0f172a";
  const muted = isDarkMode ? "#94a3b8" : "#64748b";

  return (
    <nav
      aria-label="Navigation du profil"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 10,
        background: isDarkMode ? "rgba(8,8,8,0.9)" : "rgba(255,255,255,0.92)",
        backdropFilter: "blur(18px)",
        borderTop: `1px solid ${border}`,
        borderBottom: `1px solid ${border}`,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${visibleTabs.length}, minmax(0, 1fr))`,
          minHeight: 54,
        }}
      >
        {visibleTabs.map(({ id, label, icon: Icon }) => {
          const active = selectedTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => selectTab?.(id)}
              aria-current={active ? "page" : undefined}
              style={{
                position: "relative",
                border: 0,
                background: "transparent",
                color: active ? text : muted,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 7,
                minWidth: 0,
                padding: "0 8px",
                fontFamily: "'Sora','DM Sans',sans-serif",
                fontSize: 12,
                fontWeight: active ? 800 : 650,
              }}
            >
              <Icon style={{ width: 17, height: 17, flexShrink: 0 }} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {label}
              </span>
              {active && (
                <motion.span
                  layoutId="profile-menu-active"
                  style={{
                    position: "absolute",
                    left: 12,
                    right: 12,
                    bottom: 0,
                    height: 3,
                    borderRadius: 999,
                    background: "linear-gradient(135deg,#f97316,#ec4899)",
                  }}
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
