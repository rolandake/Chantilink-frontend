// src/components/Header.jsx - VERSION AVEC TOKEN AUTHCONTEXT
import React, { useState, useEffect, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { useDarkMode } from "../context/DarkModeContext";
import { Compass, Bell, User, Shield, LogOut, X, Check, Moon, Sun } from "lucide-react";
import axios from "axios";

export default function Header() {
  const { user, logout, activeUserId, getToken } = useAuth(); // ✅ Ajouter getToken
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  const location = useLocation();
  const navigate = useNavigate();

  const [showDropdown, setShowDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [expandedNotif, setExpandedNotif] = useState(null);
  const [currentAvatar, setCurrentAvatar] = useState(null);

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

  // 🔐 Vérification Admin/Superadmin
  const isAdminUser = user?.role === 'admin' || user?.role === 'superadmin';

  // 🔄 Synchroniser l'avatar de l'utilisateur courant
  useEffect(() => {
    if (user?._id) {
      const avatarUrl = user?.avatar || user?.profilePicture || user?.profilePhoto || null;
      setCurrentAvatar(avatarUrl);
    }
  }, [user?._id, user?.avatar, user?.profilePicture, user?.profilePhoto]);

  // ========================================
  // 🔧 FETCH NOTIFICATIONS - VERSION CORRIGÉE AVEC AUTHCONTEXT
  // ========================================
  const fetchNotifications = useCallback(async () => {
    if (!user?._id) return;

    try {
      // ✅ Récupérer le token depuis AuthContext
      const token = await getToken(activeUserId);
      
      if (!token) {
        console.warn("⚠️ Pas de token disponible pour les notifications");
        return;
      }

      console.log('📬 Chargement notifications...');

      const res = await axios.get(`${API_URL}/api/notifications`, {
        params: { limit: 50, unreadOnly: false },
        withCredentials: true,
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      console.log('✅ Notifications reçues:', res.data);

      if (res.data?.notifications) {
        setNotifications(res.data.notifications);
        setUnreadCount(res.data.unreadCount || 0);
      }
    } catch (err) {
      // Gestion silencieuse des erreurs non critiques
      if (err.response?.status === 404) {
        console.warn("⚠️ Route notifications non disponible");
        setNotifications([]);
        setUnreadCount(0);
      } else if (err.response?.status !== 401) {
        console.error("❌ Erreur chargement notifications:", err.response?.data || err.message);
      }
    }
  }, [user?._id, API_URL, getToken, activeUserId]);

  useEffect(() => {
    fetchNotifications();
    
    // Rafraîchir toutes les 30 secondes
    const interval = setInterval(fetchNotifications, 30000);
    
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // ========================================
  // 🔧 MARQUER TOUTES COMME LUES
  // ========================================
  const markAllAsRead = async () => {
    if (!user?._id) return;

    setLoadingNotifications(true);
    try {
      const token = await getToken(activeUserId);
      
      if (!token) {
        console.warn("⚠️ Pas de token disponible");
        return;
      }

      const res = await axios.patch(
        `${API_URL}/api/notifications/read-all`,
        {},
        { 
          withCredentials: true,
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      console.log('✅ Marquage notifications:', res.data);

      if (res.data?.success) {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        setUnreadCount(0);
      }
    } catch (err) {
      console.error("❌ Erreur marquage notifications:", err.response?.data || err.message);
    } finally {
      setLoadingNotifications(false);
    }
  };

  // ========================================
  // 🔧 SUPPRIMER NOTIFICATION
  // ========================================
  const deleteNotification = async (notificationId) => {
    if (!user?._id) return;

    try {
      const token = await getToken(activeUserId);
      
      if (!token) {
        console.warn("⚠️ Pas de token disponible");
        return;
      }

      const res = await axios.delete(
        `${API_URL}/api/notifications/${notificationId}`,
        { 
          withCredentials: true,
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      console.log('🗑️ Notification supprimée:', res.data);

      if (res.data?.success) {
        setNotifications(prev => prev.filter(n => n._id !== notificationId));
        const wasUnread = notifications.find(n => n._id === notificationId && !n.read);
        if (wasUnread) {
          setUnreadCount(prev => Math.max(0, prev - 1));
        }
      }
    } catch (err) {
      console.error("❌ Erreur suppression notification:", err.response?.data || err.message);
    }
  };

  const toggleNotification = (notifId) => {
    setExpandedNotif(expandedNotif === notifId ? null : notifId);
  };

  const handleLogout = () => {
    logout(activeUserId);
    setShowDropdown(false);
    navigate("/login");
  };

  const isActive = (path) => location.pathname === path;

  // Composant Avatar personnalisé synchronisé avec AuthContext
  const UserAvatar = () => {
    const firstLetter = (user?.fullName?.[0] || user?.email?.[0] || "U").toUpperCase();
    
    return (
      <div className="relative">
        {currentAvatar ? (
          <img
            src={currentAvatar.startsWith('http') || currentAvatar.startsWith('blob:') 
              ? currentAvatar 
              : `${API_URL}${currentAvatar}`}
            alt={user?.fullName || "Avatar"}
            className="w-10 h-10 rounded-full object-cover ring-2 ring-orange-500 shadow-lg"
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'flex';
            }}
          />
        ) : null}
        <div 
          className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold text-lg ring-2 ring-orange-500 shadow-lg"
          style={{ display: currentAvatar ? 'none' : 'flex' }}
        >
          {firstLetter}
        </div>
        {/* Indicateur en ligne */}
        <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-800"></span>
      </div>
    );
  };

  return (
    <header className={`sticky top-0 z-30 backdrop-blur-xl border-b shadow-lg transition-colors duration-300 ${
      isDarkMode 
        ? 'bg-gray-900/90 border-gray-700/50' 
        : 'bg-white/80 border-gray-200/50'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          {/* Logo avec animation */}
          <Link to="/" className="flex items-center gap-3 group">
            <motion.div 
              className="relative w-12 h-12 bg-gradient-to-br from-orange-400 via-orange-500 to-orange-600 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-lg overflow-hidden"
              whileHover={{ scale: 1.05, rotate: 5 }}
              whileTap={{ scale: 0.95 }}
            >
              <motion.div
                className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/20 to-white/0"
                animate={{ x: ["-100%", "100%"] }}
                transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
              />
              <span className="relative z-10">C</span>
            </motion.div>
            <span className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-orange-500 bg-clip-text text-transparent hidden md:block">
              Chantilink
            </span>
          </Link>

          {/* Navigation */}
          {user && (
            <nav className="flex items-center gap-2 sm:gap-4">
              {/* Bouton Mode Sombre/Clair */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={toggleDarkMode}
                className={`relative p-3 rounded-xl transition-all overflow-hidden ${
                  isDarkMode
                    ? 'bg-gray-800 hover:bg-gray-700'
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
                title={isDarkMode ? "Mode clair" : "Mode sombre"}
              >
                <AnimatePresence mode="wait">
                  {isDarkMode ? (
                    <motion.div
                      key="sun"
                      initial={{ rotate: -90, opacity: 0 }}
                      animate={{ rotate: 0, opacity: 1 }}
                      exit={{ rotate: 90, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Sun size={20} className="text-yellow-400" />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="moon"
                      initial={{ rotate: 90, opacity: 0 }}
                      animate={{ rotate: 0, opacity: 1 }}
                      exit={{ rotate: -90, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Moon size={20} className="text-gray-700" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>

              {/* Bouton Explorer */}
              <Link to="/explore">
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={`relative px-4 sm:px-6 py-2.5 rounded-xl font-medium transition-all ${
                    isActive("/explore")
                      ? "bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/30"
                      : isDarkMode
                      ? "bg-gray-800 text-gray-200 hover:bg-gray-700"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Compass size={20} />
                    <span className="hidden sm:inline">Explorer</span>
                  </span>
                </motion.div>
              </Link>

              {/* Notifications */}
              <div className="relative">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setShowNotifications(!showNotifications);
                    // Rafraîchir lors de l'ouverture
                    if (!showNotifications) {
                      fetchNotifications();
                    }
                  }}
                  className={`relative p-3 rounded-xl transition-all ${
                    isDarkMode
                      ? 'bg-gray-800 hover:bg-gray-700'
                      : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  <Bell size={20} className={isDarkMode ? 'text-gray-200' : 'text-gray-700'} />
                  <AnimatePresence>
                    {unreadCount > 0 && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        className="absolute -top-1 -right-1 bg-gradient-to-r from-red-500 to-red-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold shadow-lg"
                      >
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>

                {/* Dropdown Notifications */}
                <AnimatePresence>
                  {showNotifications && (
                    <motion.div
                      initial={{ opacity: 0, y: -10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.95 }}
                      className={`absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl shadow-2xl max-h-[32rem] overflow-hidden z-50 backdrop-blur-xl ${
                        isDarkMode
                          ? 'bg-gray-800 border border-gray-700/50'
                          : 'bg-white border border-gray-200/50'
                      }`}
                    >
                      <div className="sticky top-0 bg-gradient-to-r from-orange-500 to-orange-600 px-5 py-4 flex items-center justify-between z-10">
                        <h3 className="font-bold text-white text-lg flex items-center gap-2">
                          <Bell size={20} />
                          Notifications
                          {unreadCount > 0 && (
                            <span className="text-xs bg-white/30 px-2 py-0.5 rounded-full">
                              {unreadCount}
                            </span>
                          )}
                        </h3>
                        {notifications.length > 0 && (
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={markAllAsRead}
                            disabled={loadingNotifications || unreadCount === 0}
                            className="text-xs text-white/90 hover:text-white bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm flex items-center gap-1"
                          >
                            <Check size={14} />
                            {loadingNotifications ? "..." : "Tout marquer"}
                          </motion.button>
                        )}
                      </div>

                      <div className={`max-h-[28rem] overflow-y-auto ${
                        isDarkMode ? 'divide-gray-700' : 'divide-gray-100'
                      } divide-y`}>
                        {notifications.length > 0 ? (
                          notifications.map((notif) => {
                            const isExpanded = expandedNotif === notif._id;
                            const message = notif.message || notif.text || notif.content || "";
                            const isTruncated = message.length > 100;

                            return (
                              <motion.div
                                key={notif._id || notif.createdAt}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className={`p-4 transition cursor-pointer ${
                                  !notif.read 
                                    ? "bg-orange-50/50 dark:bg-orange-900/10 border-l-4 border-orange-500" 
                                    : isDarkMode 
                                    ? "hover:bg-gray-700/50" 
                                    : "hover:bg-gray-50"
                                }`}
                                onClick={() => toggleNotification(notif._id)}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1">
                                    <p className={`font-semibold text-sm flex items-center gap-2 ${
                                      isDarkMode ? 'text-gray-100' : 'text-gray-900'
                                    }`}>
                                      {!notif.read && (
                                        <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse flex-shrink-0"></span>
                                      )}
                                      {notif.title || notif.type || "Notification"}
                                    </p>
                                    <p className={`text-xs mt-1.5 ${
                                      isDarkMode ? 'text-gray-300' : 'text-gray-600'
                                    } ${!isExpanded && isTruncated ? "line-clamp-2" : ""}`}>
                                      {message}
                                    </p>
                                    {isTruncated && (
                                      <button className="text-xs text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 mt-1 font-medium flex items-center gap-1">
                                        {isExpanded ? "Voir moins" : "Voir plus"}
                                        <motion.span
                                          animate={{ rotate: isExpanded ? 180 : 0 }}
                                          transition={{ duration: 0.2 }}
                                        >
                                          ▼
                                        </motion.span>
                                      </button>
                                    )}
                                    <p className={`text-xs mt-2 flex items-center gap-1 ${
                                      isDarkMode ? 'text-gray-500' : 'text-gray-400'
                                    }`}>
                                      <span className={`w-1 h-1 rounded-full ${
                                        isDarkMode ? 'bg-gray-500' : 'bg-gray-400'
                                      }`}></span>
                                      {new Date(notif.createdAt).toLocaleString("fr-FR", {
                                        day: "2-digit",
                                        month: "short",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })}
                                    </p>
                                  </div>
                                  <motion.button
                                    whileHover={{ scale: 1.1, rotate: 90 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteNotification(notif._id);
                                    }}
                                    className={`p-1 rounded-lg transition flex-shrink-0 ${
                                      isDarkMode
                                        ? 'text-gray-400 hover:text-red-400 hover:bg-red-900/20'
                                        : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
                                    }`}
                                  >
                                    <X size={18} />
                                  </motion.button>
                                </div>
                              </motion.div>
                            );
                          })
                        ) : (
                          <div className={`p-12 text-center ${
                            isDarkMode ? 'text-gray-400' : 'text-gray-500'
                          }`}>
                            <motion.div
                              initial={{ scale: 0.8, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                            >
                              <Bell size={48} className={`mx-auto mb-3 ${
                                isDarkMode ? 'text-gray-600' : 'text-gray-300'
                              }`} />
                              <p className="font-medium">Aucune notification</p>
                              <p className="text-xs mt-1">Vous êtes à jour !</p>
                            </motion.div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Profil utilisateur avec avatar synchronisé */}
              <div className="relative">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowDropdown(!showDropdown)}
                  className={`flex items-center gap-3 px-2 sm:px-3 py-2 rounded-xl transition-all shadow-md ${
                    isDarkMode
                      ? 'bg-gradient-to-r from-gray-800 to-gray-700 hover:from-gray-700 hover:to-gray-600'
                      : 'bg-gradient-to-r from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300'
                  }`}
                >
                  <UserAvatar />
                  <span className={`hidden lg:inline font-semibold text-sm ${
                    isDarkMode ? 'text-gray-100' : 'text-gray-800'
                  }`}>
                    {user.fullName || user.email?.split("@")[0]}
                  </span>
                  <motion.span
                    animate={{ rotate: showDropdown ? 180 : 0 }}
                    className={`text-sm hidden sm:inline ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-600'
                    }`}
                  >
                    ▼
                  </motion.span>
                </motion.button>

                {/* Dropdown Profil */}
                <AnimatePresence>
                  {showDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: -10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.95 }}
                      className={`absolute right-0 mt-2 w-56 rounded-2xl shadow-2xl py-2 z-50 overflow-hidden backdrop-blur-xl ${
                        isDarkMode
                          ? 'bg-gray-800 border border-gray-700/50'
                          : 'bg-white border border-gray-200/50'
                      }`}
                    >
                      <Link
                        to="/profile"
                        className={`flex items-center gap-3 px-5 py-3 transition-all group ${
                          isDarkMode
                            ? 'text-gray-200 hover:bg-orange-900/30'
                            : 'text-gray-700 hover:bg-orange-50'
                        }`}
                        onClick={() => setShowDropdown(false)}
                      >
                        <User size={20} className="group-hover:scale-110 transition-transform" />
                        <span className="font-medium">Mon Profil</span>
                      </Link>

                      {/* Support Admin ET Superadmin */}
                      {isAdminUser && (
                        <Link
                          to="/admin"
                          className={`flex items-center gap-3 px-5 py-3 font-semibold transition-all group relative ${
                            isDarkMode
                              ? 'text-purple-400 hover:bg-purple-900/30'
                              : 'text-purple-600 hover:bg-purple-50'
                          }`}
                          onClick={() => setShowDropdown(false)}
                        >
                          <Shield size={20} className="group-hover:scale-110 transition-transform" />
                          <span>Admin Panel</span>
                          {user.role === 'superadmin' && (
                            <span className="ml-auto text-[10px] px-2 py-0.5 bg-red-500 text-white rounded-full font-bold">
                              SUPER
                            </span>
                          )}
                        </Link>
                      )}

                      <hr className={`my-2 ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`} />

                      <motion.button
                        whileHover={{ backgroundColor: isDarkMode ? "rgba(127, 29, 29, 0.3)" : "rgba(254, 226, 226, 1)" }}
                        onClick={handleLogout}
                        className={`w-full flex items-center gap-3 px-5 py-3 transition-all group ${
                          isDarkMode
                            ? 'text-red-400 hover:bg-red-900/30'
                            : 'text-red-600 hover:bg-red-50'
                        }`}
                      >
                        <LogOut size={20} className="group-hover:scale-110 transition-transform" />
                        <span className="font-medium">Déconnexion</span>
                      </motion.button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </nav>
          )}

          {/* Boutons Connexion/Inscription */}
          {!user && (
            <div className="flex gap-3">
              <Link to="/login">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={`px-5 py-2.5 font-semibold rounded-xl transition-all border-2 ${
                    isDarkMode
                      ? 'text-orange-400 hover:bg-orange-900/20 border-orange-500/50'
                      : 'text-orange-600 hover:bg-orange-50 border-orange-200'
                  }`}
                >
                  Connexion
                </motion.button>
              </Link>
              <Link to="/register">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl font-semibold shadow-lg shadow-orange-500/30 hover:shadow-xl transition-all"
                >
                  S'inscrire
                </motion.button>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Overlay pour fermer les dropdowns */}
      <AnimatePresence>
        {(showDropdown || showNotifications) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-20 bg-black/20 backdrop-blur-sm"
            onClick={() => {
              setShowDropdown(false);
              setShowNotifications(false);
            }}
          />
        )}
      </AnimatePresence>
    </header>
  );
}