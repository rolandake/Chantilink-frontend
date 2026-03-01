// src/pages/Profile/ProfileMenu.jsx
import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import PrivacyPolicy from "../../components/legal/PrivacyPolicy";

export default function ProfileMenu({ selectedTab, onSelectTab, isOwner, userId, stats }) {
  const tabs = ["posts", "about"];
  if (isOwner) tabs.push("settings");

  const getTabLabel = (tab) => {
    switch (tab) {
      case "posts":
        return `Publications ${stats?.posts ? `(${stats.posts})` : ""}`;
      case "about":
        return "À propos";
      case "settings":
        return "Paramètres";
      default:
        return tab;
    }
  };

  return (
    <div className="profile-menu mt-6">
      <div className="flex space-x-4 mb-4 border-b border-gray-300 dark:border-gray-700 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab}
            className={`px-4 py-2 font-semibold whitespace-nowrap transition ${
              selectedTab === tab
                ? "border-b-2 border-orange-500 text-orange-500"
                : "text-gray-600 dark:text-gray-400 hover:text-orange-500"
            }`}
            onClick={() => onSelectTab(tab)}
          >
            {getTabLabel(tab)}
          </button>
        ))}
      </div>

      {selectedTab === "about" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <PrivacyPolicy />
        </motion.div>
      )}
    </div>
  );
}