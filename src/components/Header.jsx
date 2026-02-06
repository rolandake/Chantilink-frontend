// ==========================================
// 📁 src/components/Header.jsx - VERSION AVEC RECHERCHE GLOBALE DE PROFILS
// ==========================================
import React, { useState, useEffect, useCallback, useRef, useMemo, memo } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { useDarkMode } from "../context/DarkModeContext";
import { Bell, User, Shield, LogOut, Moon, Sun, Trash2, Search, X, Loader2 } from "lucide-react";
import axios from "axios";

// Configuration API sécurisée
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const SERVER_URL = API_URL.replace('/api', '');
const MEDIA_URL = (path) => path?.startsWith("http") ? path : `${SERVER_URL}/${path?.replace(/^\/+/, "")}`;

// --- SOUS-COMPOSANT AVATAR (Découplé pour la perf) ---
const UserAvatar = memo(({ user, avatarUrl }) => {
  const firstLetter = (user?.fullName?.[0] || user?.email?.[0] || "U").toUpperCase();
  const [imgError, setImgError] = useState(false);

  return (
    <div className="relative w-10 h-10 rounded-full overflow-hidden ring-2 ring-orange-500/50 shadow-md transition-transform hover:scale-105 active:scale-95">
      {avatarUrl && !imgError ? (
        <img
          src={avatarUrl}
          alt="Profil"
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold text-lg select-none">
          {firstLetter}
        </div>
      )}
    </div>
  );
});

// --- SOUS-COMPOSANT RÉSULTAT DE RECHERCHE ---
const SearchResultItem = memo(({ profile, onClick, isDarkMode }) => {
  const profileAvatar = MEDIA_URL(profile.profilePhoto || profile.avatar || profile.profilePicture);
  const [imgError, setImgError] = useState(false);
  
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      onClick={() => onClick(profile._id)}
      className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
        isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
      }`}
    >
      <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 border-2 border-gray-200 dark:border-gray-700">
        {profileAvatar && !imgError ? (
          <img
            src={profileAvatar}
            alt={profile.fullName || profile.username}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center text-white font-bold">
            {(profile.fullName?.[0] || profile.username?.[0] || "U").toUpperCase()}
          </div>
        )}
      </div>
      
      <div className="flex-1 min-w-0">
        <p className={`font-semibold truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
          {profile.fullName || profile.username}
        </p>
        {profile.username && profile.fullName && (
          <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
            @{profile.username}
          </p>
        )}
        {profile.bio && (
          <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">
            {profile.bio}
          </p>
        )}
      </div>
    </motion.div>
  );
});

// --- COMPOSANT PRINCIPAL HEADER ---
const Header = memo(function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, activeUserId, getToken } = useAuth();
  const { isDarkMode, toggleDarkMode } = useDarkMode();

  const [showDropdown, setShowDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  
  // États pour la recherche
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  
  const notifRef = useRef(null);
  const profileRef = useRef(null);
  const searchRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  const isAdminUser = user?.role === 'admin' || user?.role === 'superadmin';

  // ✅ Optimisation URL Avatar
  const avatarUrl = useMemo(() => {
    if (!user) return null;
    const avatar = user.avatar || user.profilePicture || user.profilePhoto;
    if (!avatar) return null;
    return avatar.startsWith('http') ? avatar : `${API_URL}${avatar}`;
  }, [user]);

  // ✅ Gestionnaire de clics extérieurs (Fermeture auto)
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notifRef.current && !notifRef.current.contains(event.target)) setShowNotifications(false);
      if (profileRef.current && !profileRef.current.contains(event.target)) setShowDropdown(false);
      if (searchRef.current && !searchRef.current.contains(event.target)) setShowSearchResults(false);
    };
    document.addEventListener("mousedown", handleClickOutside, { passive: true });
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ✅ Recherche de profils avec debounce
  const searchProfiles = useCallback(async (query) => {
    if (!query.trim() || query.length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    setSearchLoading(true);
    try {
      const token = await getToken(activeUserId);
      if (!token) return;

      const res = await axios.get(`${API_URL}/users/search?q=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data?.users) {
        setSearchResults(res.data.users);
        setShowSearchResults(true);
      }
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error("Search Error", err);
      }
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, [activeUserId, getToken]);

  // Debounce de la recherche
  const handleSearchChange = (value) => {
    setSearchQuery(value);
    
    // Annuler le timeout précédent
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!value.trim()) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    // Nouveau timeout pour la recherche
    searchTimeoutRef.current = setTimeout(() => {
      searchProfiles(value);
    }, 300); // Attendre 300ms après la dernière frappe
  };

  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults([]);
    setShowSearchResults(false);
  };

  const handleProfileClick = (profileId) => {
    navigate(`/profile/${profileId}`);
    clearSearch();
  };

  // ✅ Fetch Notifications Optimisé
  const fetchNotifications = useCallback(async () => {
    if (!user?._id) return;
    try {
      const token = await getToken(activeUserId);
      if (!token) return;

      const res = await axios.get(`${API_URL}/notifications?limit=15`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data?.notifications) {
        setNotifications(res.data.notifications);
        setUnreadCount(res.data.unreadCount || 0);
      }
    } catch (err) {
      if (process.env.NODE_ENV === 'development') console.error("Notif Error", err);
    }
  }, [user?._id, activeUserId, getToken]);

  // Polling intelligent
  useEffect(() => {
    if (!user?._id) return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000); 
    return () => clearInterval(interval);
  }, [fetchNotifications, user?._id]);

  // --- ACTIONS NOTIFICATIONS ---
  const markAllAsRead = async () => {
    if (!user?._id) return;
    setLoadingNotifs(true);
    try {
      const token = await getToken(activeUserId);
      await axios.patch(`${API_URL}/notifications/read-all`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (e) { console.error(e); } 
    finally { setLoadingNotifs(false); }
  };

  const deleteNotification = async (e, id) => {
    e.stopPropagation();
    try {
      const token = await getToken(activeUserId);
      await axios.delete(`${API_URL}/notifications/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      setNotifications(prev => prev.filter(n => n._id !== id));
      setUnreadCount(prev => Math.max(0, prev - 1)); 
    } catch (e) { console.error(e); }
  };

  // Navigation vers la notification
  const handleNotificationClick = (notif) => {
    // Marquer la notification comme lue
    if (!notif.read) {
      axios.patch(
        `${API_URL}/notifications/${notif._id}/read`,
        {},
        { headers: { Authorization: `Bearer ${getToken(activeUserId)}` } }
      ).catch(console.error);
      
      setNotifications(prev => 
        prev.map(n => n._id === notif._id ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    }

    setShowNotifications(false);

    // Navigation basée sur le type de notification
    if (notif.postId) {
      navigate(`/post/${notif.postId}`);
    } else if (notif.userId || notif.senderId) {
      navigate(`/profile/${notif.userId || notif.senderId}`);
    } else if (notif.link) {
      navigate(notif.link);
    }
  };

  const handleLogout = () => {
    setShowDropdown(false);
    logout(activeUserId);
    navigate("/auth");
  };

  // Nettoyage du timeout à la destruction
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  return (
    <header 
      className={`sticky top-0 z-40 backdrop-blur-xl border-b transition-colors duration-300 ${
        isDarkMode ? 'bg-gray-900/80 border-gray-800' : 'bg-white/80 border-gray-200'
      }`}
      style={{ willChange: 'transform' }}
    >
      <div className="max-w-7xl mx-auto px-4 h-[72px] flex items-center justify-between gap-4">
        
        {/* LOGO */}
        <Link to="/" className="flex items-center gap-2 group select-none flex-shrink-0">
          <motion.div 
            whileHover={{ rotate: 10 }}
            className="w-10 h-10 bg-gradient-to-br from-orange-500 to-pink-500 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg"
          >
            C
          </motion.div>
          <span className="text-xl font-bold bg-gradient-to-r from-orange-600 to-pink-600 bg-clip-text text-transparent hidden sm:block">
            Chantilink
          </span>
        </Link>

        {/* BARRE DE RECHERCHE GLOBALE */}
        {user && (
          <div className="flex-1 max-w-md mx-4 relative" ref={searchRef}>
            <div className={`relative flex items-center rounded-xl transition-all ${
              isDarkMode ? 'bg-gray-800' : 'bg-gray-100'
            }`}>
              <Search className="absolute left-3 text-gray-400" size={18} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Rechercher des utilisateurs..."
                className={`w-full pl-10 pr-10 py-2.5 rounded-xl outline-none transition-colors ${
                  isDarkMode 
                    ? 'bg-gray-800 text-white placeholder-gray-500 focus:bg-gray-700' 
                    : 'bg-gray-100 text-gray-900 placeholder-gray-400 focus:bg-gray-200'
                }`}
              />
              {searchLoading ? (
                <Loader2 className="absolute right-3 text-gray-400 animate-spin" size={18} />
              ) : searchQuery ? (
                <button
                  onClick={clearSearch}
                  className="absolute right-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  <X size={18} />
                </button>
              ) : null}
            </div>

            {/* RÉSULTATS DE RECHERCHE */}
            <AnimatePresence>
              {showSearchResults && searchResults.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.2 }}
                  className={`absolute top-full mt-2 w-full rounded-2xl shadow-2xl overflow-hidden border ring-1 ring-black/5 max-h-[400px] overflow-y-auto ${
                    isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'
                  }`}
                >
                  <div className={`px-4 py-3 border-b ${isDarkMode ? 'border-gray-700 bg-gray-750' : 'border-gray-100 bg-gray-50'}`}>
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                      {searchResults.length} résultat{searchResults.length > 1 ? 's' : ''}
                    </p>
                  </div>
                  
                  <div className="divide-y divide-gray-100 dark:divide-gray-700">
                    {searchResults.map((profile) => (
                      <SearchResultItem
                        key={profile._id}
                        profile={profile}
                        onClick={handleProfileClick}
                        isDarkMode={isDarkMode}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Message "Aucun résultat" */}
            <AnimatePresence>
              {showSearchResults && searchQuery && searchResults.length === 0 && !searchLoading && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className={`absolute top-full mt-2 w-full rounded-2xl shadow-2xl border p-8 text-center ${
                    isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'
                  }`}
                >
                  <Search className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                  <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                    Aucun utilisateur trouvé
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Essayez avec un autre nom
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {user && (
          <div className="flex items-center gap-2 sm:gap-3">
            
            {/* TOGGLE THEME */}
            <button
              onClick={toggleDarkMode}
              className={`p-2.5 rounded-xl transition-colors active:scale-95 ${
                isDarkMode ? 'bg-gray-800 text-yellow-400 hover:bg-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            {/* NOTIFICATIONS */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  if (!showNotifications) fetchNotifications();
                }}
                className={`p-2.5 rounded-xl relative transition-colors active:scale-95 ${
                  isDarkMode ? 'bg-gray-800 text-gray-200 hover:bg-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center font-bold shadow-sm border-2 border-white dark:border-gray-900">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {showNotifications && (
                  <>
                    {/* Overlay flou */}
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30"
                      onClick={() => setShowNotifications(false)}
                    />
                    
                    {/* Dropdown notifications */}
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      className={`absolute right-0 mt-4 w-80 sm:w-96 rounded-2xl shadow-2xl overflow-hidden border ring-1 ring-black/5 z-40 ${
                        isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'
                      }`}
                    >
                    <div className="p-4 flex justify-between items-center bg-gradient-to-r from-orange-500 to-pink-600">
                      <h3 className="text-white font-bold text-sm">Notifications</h3>
                      {unreadCount > 0 && (
                        <button 
                          onClick={markAllAsRead}
                          disabled={loadingNotifs}
                          className="text-xs bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-full transition disabled:opacity-50 backdrop-blur-sm"
                        >
                          {loadingNotifs ? "..." : "Tout marquer lu"}
                        </button>
                      )}
                    </div>

                    <div className="max-h-[60vh] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
                      {notifications.length === 0 ? (
                        <div className="p-8 text-center opacity-50">
                          <Bell className="w-12 h-12 mx-auto mb-2" />
                          <p className="text-sm">Rien à signaler pour l'instant</p>
                        </div>
                      ) : (
                        notifications.map((notif) => (
                          <div
                            key={notif._id}
                            onClick={() => handleNotificationClick(notif)}
                            className={`p-4 border-b border-gray-100/10 hover:bg-gray-50/5 relative group transition-colors flex gap-3 cursor-pointer ${
                              !notif.read ? (isDarkMode ? 'bg-gray-700/30' : 'bg-blue-50/50') : ''
                            }`}
                          >
                            <div className="mt-1 text-xl shrink-0">
                              {notif.type === 'like' && '❤️'}
                              {notif.type === 'comment' && '💬'}
                              {notif.type === 'follow' && '👤'}
                              {notif.type === 'system' && '⚙️'}
                              {!['like', 'comment', 'follow', 'system'].includes(notif.type) && '🔔'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>{notif.message}</p>
                              <p className="text-xs opacity-50 mt-1">
                                {new Date(notif.createdAt).toLocaleDateString(undefined, {
                                  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                                })}
                              </p>
                            </div>
                            <button
                              onClick={(e) => deleteNotification(e, notif._id)}
                              className="self-start opacity-0 group-hover:opacity-100 p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* USER DROPDOWN */}
            <div className="relative" ref={profileRef}>
              <button 
                onClick={() => setShowDropdown(!showDropdown)}
                className="focus:outline-none"
                aria-label="Menu profil"
              >
                <UserAvatar user={user} avatarUrl={avatarUrl} />
              </button>

              <AnimatePresence>
                {showDropdown && (
                  <>
                    {/* Overlay flou */}
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30"
                      onClick={() => setShowDropdown(false)}
                    />
                    
                    {/* Dropdown profil */}
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 10 }}
                      transition={{ duration: 0.15 }}
                      className={`absolute right-0 mt-4 w-60 rounded-2xl shadow-xl border overflow-hidden ring-1 ring-black/5 z-40 ${
                        isDarkMode ? 'bg-gray-800 border-gray-700 text-gray-200' : 'bg-white border-gray-100 text-gray-700'
                      }`}
                    >
                    <div className="p-4 border-b border-gray-200/10 bg-gray-50/5">
                      <p className="font-bold truncate">{user.fullName}</p>
                      <p className="text-xs opacity-60 truncate font-mono">{user.email}</p>
                    </div>

                    <div className="p-2 space-y-1">
                      <Link 
                        to={`/profile/${user._id}`}
                        onClick={() => setShowDropdown(false)}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-sm font-medium ${
                          isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                        }`}
                      >
                        <User size={18} /> Mon Profil
                      </Link>

                      {isAdminUser && (
                        <Link 
                          to="/admin"
                          onClick={() => setShowDropdown(false)}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-sm font-medium ${
                            isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                          }`}
                        >
                          <Shield size={18} className="text-blue-500" /> Administration
                        </Link>
                      )}

                      <div className={`h-px my-1 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`} />

                      <button
                        onClick={handleLogout}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-500 text-sm font-medium transition-colors ${
                          isDarkMode ? 'hover:bg-red-900/20' : 'hover:bg-red-50'
                        }`}
                      >
                        <LogOut size={18} /> Se déconnecter
                      </button>
                    </div>
                  </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

          </div>
        )}
      </div>
    </header>
  );
});

export default Header;