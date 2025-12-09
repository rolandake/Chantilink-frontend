// src/components/Header.jsx - VERSION COMPLÈTE OPTIMISÉE
import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { useDarkMode } from "../context/DarkModeContext";
import { Bell, User, Shield, LogOut, Moon, Sun, Trash2 } from "lucide-react";
import axios from "axios";

export default function Header() {
  const { user, logout, activeUserId, getToken } = useAuth();
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  const location = useLocation();
  const navigate = useNavigate();

  const [showDropdown, setShowDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [currentAvatar, setCurrentAvatar] = useState(null);
  
  const notifRef = useRef(null);
  const profileRef = useRef(null);

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
  const isAdminUser = user?.role === 'admin' || user?.role === 'superadmin';

  // ✅ Mémoriser l'URL de l'avatar pour éviter re-calculs
  const avatarUrl = useMemo(() => {
    if (!user) return null;
    const avatar = user.avatar || user.profilePicture || user.profilePhoto;
    if (!avatar) return null;
    return avatar.startsWith('http') ? avatar : `${API_URL}${avatar}`;
  }, [user?.avatar, user?.profilePicture, user?.profilePhoto, API_URL]);

  // ✅ Fermer les menus si on clique ailleurs
  useEffect(() => {
    function handleClickOutside(event) {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ✅ Synchroniser l'avatar (dépend du avatarUrl mémorisé, pas de user entier)
  useEffect(() => {
    setCurrentAvatar(avatarUrl);
  }, [avatarUrl]);

  // ✅ Fetch notifications optimisé avec useCallback
  const fetchNotifications = useCallback(async () => {
    if (!user?._id) return;
    try {
      const token = await getToken(activeUserId);
      if (!token) return;

      const res = await axios.get(`${API_URL}/api/notifications`, {
        params: { limit: 20 },
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data?.notifications) {
        setNotifications(res.data.notifications);
        setUnreadCount(res.data.unreadCount || 0);
      }
    } catch (err) {
      console.error("❌ [Header] Erreur fetchNotifications:", err.message);
    }
  }, [user?._id, activeUserId, API_URL]);

  // ✅ Polling des notifications avec cleanup
  useEffect(() => {
    if (!user?._id) return;

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    
    return () => clearInterval(interval);
  }, [user?._id, fetchNotifications]);

  // --- ACTIONS ---
  const markAllAsRead = async () => {
    if (!user?._id) return;
    setLoadingNotifications(true);
    try {
      const token = await getToken(activeUserId);
      await axios.patch(`${API_URL}/api/notifications/read-all`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error("❌ [Header] Erreur markAllAsRead:", err);
    } finally {
      setLoadingNotifications(false);
    }
  };

  const deleteNotification = async (e, id) => {
    e.stopPropagation();
    try {
      const token = await getToken(activeUserId);
      await axios.delete(`${API_URL}/api/notifications/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Recalculer le compteur avant de supprimer
      const deletedNotif = notifications.find(n => n._id === id);
      if (deletedNotif && !deletedNotif.read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
      
      setNotifications(prev => prev.filter(n => n._id !== id));
    } catch (err) {
      console.error("❌ [Header] Erreur deleteNotification:", err);
    }
  };

  const handleLogout = () => {
    logout(activeUserId);
    setShowDropdown(false);
    navigate("/login");
  };

  const isActive = (path) => location.pathname === path;

  // ✅ UserAvatar mémorisé pour éviter re-créations
  const UserAvatar = useMemo(() => {
    const firstLetter = (user?.fullName?.[0] || user?.email?.[0] || "U").toUpperCase();
    
    return () => (
      <div className="relative w-10 h-10 rounded-full overflow-hidden ring-2 ring-orange-500 shadow-md">
        {currentAvatar ? (
          <img
            src={currentAvatar}
            alt="Profil"
            className="w-full h-full object-cover"
            onError={(e) => { 
              e.target.style.display = 'none'; 
              e.target.nextSibling.style.display = 'flex'; 
            }}
          />
        ) : null}
        <div 
          className="w-full h-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold"
          style={{ display: currentAvatar ? 'none' : 'flex' }}
        >
          {firstLetter}
        </div>
      </div>
    );
  }, [currentAvatar, user?.fullName, user?.email]);

  return (
    <header className={`sticky top-0 z-40 backdrop-blur-md border-b transition-colors duration-300 ${
      isDarkMode ? 'bg-gray-900/90 border-gray-700' : 'bg-white/80 border-gray-200'
    }`}>
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        
        {/* LOGO */}
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-pink-500 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg">
            C
          </div>
          <span className="text-xl font-bold bg-gradient-to-r from-orange-600 to-pink-600 bg-clip-text text-transparent hidden sm:block">
            Chantilink
          </span>
        </Link>

        {user && (
          <div className="flex items-center gap-3">
            
            {/* Mode Sombre */}
            <button
              onClick={toggleDarkMode}
              className={`p-2.5 rounded-xl transition-colors ${
                isDarkMode ? 'bg-gray-800 text-yellow-400' : 'bg-gray-100 text-gray-600'
              }`}
              aria-label="Changer de thème"
            >
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            {/* Notifications */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  if (!showNotifications) fetchNotifications();
                }}
                className={`p-2.5 rounded-xl relative transition-colors ${
                  isDarkMode ? 'bg-gray-800 text-gray-200' : 'bg-gray-100 text-gray-600'
                }`}
                aria-label="Notifications"
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {showNotifications && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className={`absolute right-0 mt-3 w-80 sm:w-96 rounded-2xl shadow-2xl overflow-hidden border ${
                      isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'
                    }`}
                  >
                    <div className="p-4 border-b border-gray-200/10 flex justify-between items-center bg-gradient-to-r from-orange-500 to-pink-600">
                      <h3 className="text-white font-bold">Notifications</h3>
                      {unreadCount > 0 && (
                        <button 
                          onClick={markAllAsRead}
                          disabled={loadingNotifications}
                          className="text-xs bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg transition disabled:opacity-50"
                        >
                          {loadingNotifications ? "..." : "Tout lire"}
                        </button>
                      )}
                    </div>

                    <div className="max-h-[60vh] overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className={`p-8 text-center ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          <Bell className="w-12 h-12 mx-auto mb-2 opacity-20" />
                          <p>Aucune notification</p>
                        </div>
                      ) : (
                        notifications.map((notif) => (
                          <div
                            key={notif._id}
                            className={`p-4 border-b border-gray-100/10 hover:bg-gray-50/5 relative group transition-colors ${
                              !notif.read ? (isDarkMode ? 'bg-gray-700/30' : 'bg-blue-50/50') : ''
                            } ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}
                          >
                            <div className="flex gap-3">
                              <div className="mt-1">
                                {notif.type === 'like' && <span className="text-red-500">❤️</span>}
                                {notif.type === 'comment' && <span className="text-blue-500">💬</span>}
                                {notif.type === 'follow' && <span className="text-green-500">👤</span>}
                              </div>
                              <div className="flex-1">
                                <p className="text-sm">{notif.message}</p>
                                <p className="text-xs opacity-50 mt-1">
                                  {new Date(notif.createdAt).toLocaleDateString('fr-FR', {
                                    day: 'numeric',
                                    month: 'short',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </p>
                              </div>
                              <button
                                onClick={(e) => deleteNotification(e, notif._id)}
                                className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-100 hover:text-red-500 rounded transition"
                                aria-label="Supprimer"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Menu Utilisateur */}
            <div className="relative" ref={profileRef}>
              <button 
                onClick={() => setShowDropdown(!showDropdown)}
                className="focus:outline-none transition-transform active:scale-95"
                aria-label="Menu utilisateur"
              >
                <UserAvatar />
              </button>

              <AnimatePresence>
                {showDropdown && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className={`absolute right-0 mt-3 w-56 rounded-xl shadow-xl border overflow-hidden ${
                      isDarkMode ? 'bg-gray-800 border-gray-700 text-gray-200' : 'bg-white border-gray-100 text-gray-700'
                    }`}
                  >
                    <div className="p-4 border-b border-gray-200/10">
                      <p className="font-bold truncate">{user.fullName}</p>
                      <p className="text-xs opacity-60 truncate">{user.email}</p>
                    </div>

                    <div className="p-2">
                      <Link 
                        to={`/profile/${user._id}`}
                        onClick={() => setShowDropdown(false)}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                          isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'
                        }`}
                      >
                        <User size={18} /> Profil
                      </Link>

                      {isAdminUser && (
                        <Link 
                          to="/admin"
                          onClick={() => setShowDropdown(false)}
                          className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                            isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'
                          }`}
                        >
                          <Shield size={18} /> Administration
                        </Link>
                      )}

                      <div className={`h-px my-1 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`} />

                      <button
                        onClick={handleLogout}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-red-500 transition-colors ${
                          isDarkMode ? 'hover:bg-red-900/20' : 'hover:bg-red-50'
                        }`}
                      >
                        <LogOut size={18} /> Se déconnecter
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}