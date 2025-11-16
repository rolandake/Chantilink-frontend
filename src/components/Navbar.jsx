// src/components/Navbar.jsx - NAVBAR UNIFIÉE (MOBILE + DESKTOP)
import React, { useState, useCallback } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { FaHome, FaComments, FaHistory, FaCalculator, FaEnvelope, FaUsers, FaUser, FaCog, FaEye } from "react-icons/fa";

const menuItems = [
  { id: "home", label: "Accueil", to: "/", icon: <FaHome /> },
  { id: "chat", label: "Assistant GPT", to: "/chat", icon: <FaComments /> },
  { id: "calculs", label: "Calculs", to: "/calculs", icon: <FaCalculator /> },
  { id: "messages", label: "Messages", to: "/messages", icon: <FaEnvelope /> },
  { id: "profile", label: "Profil", to: "/profile", icon: <FaUser /> },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeMenu = useCallback(() => setMobileOpen(false), []);

  if (!user) return null;

  return (
    <>
      {/* Desktop */}
      <nav className="hidden md:flex justify-center items-center px-6 h-16 bg-orange-600/85 backdrop-blur-md text-white shadow-lg gap-6">
        {menuItems.map(({ id, to, icon, label }) => (
          <NavLink
            key={id}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-2 transition-all ${isActive ? "font-bold underline" : "hover:underline"}`
            }
          >
            {icon} <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Mobile */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-gray-300 flex justify-around items-center h-16 z-50 text-sm shadow-inner md:hidden">
        {menuItems.map(({ id, to, icon, label }) => (
          <NavLink
            key={id}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center transition ${isActive ? "text-orange-600" : "text-gray-700"}`
            }
          >
            <span className="text-lg">{icon}</span>
            <span className="text-xs">{label}</span>
          </NavLink>
        ))}
      </nav>
    </>
  );
}