// ==========================================
// 📁 src/components/Header.jsx
// ✅ Barre de recherche → résultats dans un modal portal (comme PostCommentsModal)
// ✅ Backdrop séparé avec AnimatePresence + body scroll lock
// ✅ Fermeture via backdrop click, bouton X, ou touche Escape
// ✅ Tout le reste inchangé (notifications, dropdown profil, etc.)
// ==========================================
import React, { useState, useEffect, useCallback, useRef, useMemo, memo } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { useDarkMode } from "../context/DarkModeContext";
import { Bell, User, Shield, LogOut, Moon, Sun, Trash2, Search, X, Loader2 } from "lucide-react";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const SERVER_URL = API_URL.replace('/api', '');
const MEDIA_URL = (path) => path?.startsWith("http") ? path : `${SERVER_URL}/${path?.replace(/^\/+/, "")}`;

// ─────────────────────────────────────────────
// AVATAR
// ─────────────────────────────────────────────
const UserAvatar = memo(({ user, avatarUrl }) => {
  const firstLetter = (user?.fullName?.[0] || user?.email?.[0] || "U").toUpperCase();
  const [imgError, setImgError] = useState(false);

  return (
    <div className="relative w-10 h-10 rounded-full overflow-hidden ring-2 ring-orange-500/50 shadow-md transition-transform hover:scale-105 active:scale-95">
      {avatarUrl && !imgError ? (
        <img src={avatarUrl} alt="Profil" className="w-full h-full object-cover"
          onError={() => setImgError(true)} loading="lazy" />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold text-lg select-none">
          {firstLetter}
        </div>
      )}
    </div>
  );
});

// ─────────────────────────────────────────────
// RÉSULTAT DE RECHERCHE (ligne individuelle)
// ─────────────────────────────────────────────
const SearchResultItem = memo(({ profile, onClick, isDarkMode }) => {
  const profileAvatar = MEDIA_URL(profile.profilePhoto || profile.avatar || profile.profilePicture);
  const [imgError, setImgError] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      onClick={() => onClick(profile._id)}
      className={`flex items-center gap-3 px-5 py-3.5 cursor-pointer transition-colors ${
        isDarkMode ? "hover:bg-white/[0.04]" : "hover:bg-gray-50"
      }`}
    >
      <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 border-2 border-gray-200 dark:border-gray-700">
        {profileAvatar && !imgError ? (
          <img src={profileAvatar} alt={profile.fullName || profile.username}
            className="w-full h-full object-cover" onError={() => setImgError(true)} />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center text-white font-bold">
            {(profile.fullName?.[0] || profile.username?.[0] || "U").toUpperCase()}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className={`font-semibold truncate ${isDarkMode ? "text-white" : "text-gray-900"}`}>
          {profile.fullName || profile.username}
        </p>
        {profile.username && profile.fullName && (
          <p className="text-sm text-gray-500 dark:text-gray-400 truncate">@{profile.username}</p>
        )}
        {profile.bio && (
          <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">{profile.bio}</p>
        )}
      </div>

      <div className={`text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0 ${
        isDarkMode ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-500"
      }`}>
        Voir →
      </div>
    </motion.div>
  );
});

// ─────────────────────────────────────────────
// ✅ SEARCH MODAL — portal plein écran (comme PostCommentsModal)
// ─────────────────────────────────────────────
const SearchModal = memo(({ isOpen, onClose, isDarkMode, initialQuery = "", onNavigate }) => {
  const { user, activeUserId, getToken } = useAuth();
  const [query,       setQuery]       = useState(initialQuery);
  const [results,     setResults]     = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const inputRef     = useRef(null);
  const timeoutRef   = useRef(null);

  // Sync query depuis l'extérieur à l'ouverture
  useEffect(() => {
    if (isOpen) {
      setQuery(initialQuery);
      setResults([]);
      setHasSearched(false);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [isOpen, initialQuery]);

  // Body lock
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  // Escape key
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  const doSearch = useCallback(async (q) => {
    if (!q.trim() || q.length < 2) { setResults([]); setHasSearched(false); return; }
    setLoading(true);
    setHasSearched(true);
    try {
      const token = await getToken(activeUserId);
      if (!token) return;
      const res = await axios.get(`${API_URL}/users/search?q=${encodeURIComponent(q)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setResults(res.data?.users || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [activeUserId, getToken]);

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(timeoutRef.current);
    if (!val.trim()) { setResults([]); setHasSearched(false); return; }
    timeoutRef.current = setTimeout(() => doSearch(val), 300);
  };

  const handleProfileClick = (profileId) => {
    onNavigate(`/profile/${profileId}`);
    onClose();
  };

  const content = (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="search-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[400] bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            key="search-modal"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            style={{
              position: "fixed",
              top: 72,
              left: 12,
              right: 12,
              zIndex: 401,
            }}
            className={`overflow-hidden rounded-2xl shadow-2xl mx-auto max-w-lg
              ${isDarkMode ? "bg-[#0f0f0f] border border-gray-800" : "bg-white border border-gray-200"}`}
            onClick={e => e.stopPropagation()}
          >
            {/* Barre de recherche dans le modal */}
            <div className={`flex items-center gap-3 px-4 py-3.5 border-b ${
              isDarkMode ? "border-gray-800" : "border-gray-100"
            }`}>
              {loading
                ? <Loader2 className="w-5 h-5 text-orange-500 animate-spin flex-shrink-0" />
                : <Search className="w-5 h-5 text-gray-400 flex-shrink-0" />
              }
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={handleChange}
                placeholder="Rechercher des utilisateurs…"
                className={`flex-1 text-[15px] bg-transparent outline-none ${
                  isDarkMode ? "text-white placeholder-gray-500" : "text-gray-900 placeholder-gray-400"
                }`}
              />
              <button
                onClick={onClose}
                className={`p-1.5 rounded-lg transition-colors flex-shrink-0 ${
                  isDarkMode ? "text-gray-500 hover:bg-gray-800 hover:text-gray-300" : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                }`}
              >
                <X size={18} />
              </button>
            </div>

            {/* Résultats */}
            <div className="max-h-[60vh] overflow-y-auto overscroll-contain">
              {!query.trim() && (
                <div className={`flex flex-col items-center justify-center py-12 gap-3 ${
                  isDarkMode ? "text-gray-600" : "text-gray-400"
                }`}>
                  <Search size={40} strokeWidth={1.5} />
                  <p className="text-sm font-medium">Tapez pour rechercher</p>
                </div>
              )}

              {hasSearched && !loading && results.length === 0 && query.trim() && (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl ${
                    isDarkMode ? "bg-gray-900" : "bg-gray-100"
                  }`}>🔍</div>
                  <p className={`text-sm font-medium ${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>
                    Aucun utilisateur trouvé
                  </p>
                  <p className="text-xs text-gray-400">Essayez avec un autre nom</p>
                </div>
              )}

              {results.length > 0 && (
                <>
                  <div className={`px-5 py-2.5 ${isDarkMode ? "bg-gray-900/50" : "bg-gray-50"}`}>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
                      {results.length} résultat{results.length > 1 ? "s" : ""}
                    </p>
                  </div>
                  <AnimatePresence mode="popLayout" initial={false}>
                    {results.map(profile => (
                      <SearchResultItem
                        key={profile._id}
                        profile={profile}
                        onClick={handleProfileClick}
                        isDarkMode={isDarkMode}
                      />
                    ))}
                  </AnimatePresence>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  return createPortal(content, document.body);
});
SearchModal.displayName = "SearchModal";

// ─────────────────────────────────────────────
// HEADER PRINCIPAL
// ─────────────────────────────────────────────
const Header = memo(function Header() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { user, logout, activeUserId, getToken } = useAuth();
  const { isDarkMode, toggleDarkMode } = useDarkMode();

  const [showDropdown,      setShowDropdown]      = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications,     setNotifications]     = useState([]);
  const [unreadCount,       setUnreadCount]       = useState(0);
  const [loadingNotifs,     setLoadingNotifs]     = useState(false);

  // ✅ Modal de recherche
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchBarQuery,  setSearchBarQuery]  = useState(""); // valeur de la mini barre du header

  const notifRef   = useRef(null);
  const profileRef = useRef(null);

  const isAdminUser = user?.role === "admin" || user?.role === "superadmin";

  const avatarUrl = useMemo(() => {
    if (!user) return null;
    const avatar = user.avatar || user.profilePicture || user.profilePhoto;
    if (!avatar) return null;
    return avatar.startsWith("http") ? avatar : `${API_URL}${avatar}`;
  }, [user]);

  // Fermeture dropdowns au clic extérieur
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notifRef.current   && !notifRef.current.contains(event.target))   setShowNotifications(false);
      if (profileRef.current && !profileRef.current.contains(event.target)) setShowDropdown(false);
    };
    document.addEventListener("mousedown", handleClickOutside, { passive: true });
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ── Notifications ──
  const fetchNotifications = useCallback(async () => {
    if (!user?._id) return;
    try {
      const token = await getToken(activeUserId);
      if (!token) return;
      const res = await axios.get(`${API_URL}/notifications?limit=15`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data?.notifications) {
        setNotifications(res.data.notifications);
        setUnreadCount(res.data.unreadCount || 0);
      }
    } catch {}
  }, [user?._id, activeUserId, getToken]);

  useEffect(() => {
    if (!user?._id) return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [fetchNotifications, user?._id]);

  const markAllAsRead = async () => {
    setLoadingNotifs(true);
    try {
      const token = await getToken(activeUserId);
      await axios.patch(`${API_URL}/notifications/read-all`, {}, { headers: { Authorization: `Bearer ${token}` } });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {}
    finally { setLoadingNotifs(false); }
  };

  const deleteNotification = async (e, id) => {
    e.stopPropagation();
    try {
      const token = await getToken(activeUserId);
      await axios.delete(`${API_URL}/notifications/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      setNotifications(prev => prev.filter(n => n._id !== id));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch {}
  };

  const handleNotificationClick = (notif) => {
    if (!notif.read) {
      axios.patch(`${API_URL}/notifications/${notif._id}/read`, {},
        { headers: { Authorization: `Bearer ${getToken(activeUserId)}` } }).catch(() => {});
      setNotifications(prev => prev.map(n => n._id === notif._id ? { ...n, read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
    setShowNotifications(false);
    if (notif.postId)                  navigate(`/post/${notif.postId}`);
    else if (notif.userId || notif.senderId) navigate(`/profile/${notif.userId || notif.senderId}`);
    else if (notif.link)               navigate(notif.link);
  };

  const handleLogout = () => {
    setShowDropdown(false);
    logout(activeUserId);
    navigate("/auth");
  };

  // ── Ouvrir le modal de recherche en cliquant sur la barre ──
  const handleSearchBarClick = () => {
    setShowSearchModal(true);
  };

  // ── Quand on tape dans la barre du header → ouvre aussi le modal ──
  const handleSearchBarChange = (e) => {
    setSearchBarQuery(e.target.value);
    if (!showSearchModal) setShowSearchModal(true);
  };

  const handleSearchModalClose = () => {
    setShowSearchModal(false);
    setSearchBarQuery("");
  };

  return (
    <>
      <header
        className={`sticky top-0 z-40 backdrop-blur-xl border-b transition-colors duration-300 ${
          isDarkMode ? "bg-gray-900/80 border-gray-800" : "bg-white/80 border-gray-200"
        }`}
        style={{ willChange: "transform" }}
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

          {/* ✅ BARRE DE RECHERCHE — déclenche le modal au clic/frappe */}
          {user && (
            <div className="flex-1 max-w-md mx-4">
              <div
                onClick={handleSearchBarClick}
                className={`relative flex items-center rounded-xl cursor-text transition-all ${
                  isDarkMode ? "bg-gray-800 hover:bg-gray-700" : "bg-gray-100 hover:bg-gray-200"
                }`}
              >
                <Search className="absolute left-3 text-gray-400 pointer-events-none" size={18} />
                <input
                  type="text"
                  value={searchBarQuery}
                  onChange={handleSearchBarChange}
                  onClick={handleSearchBarClick}
                  placeholder="Rechercher des utilisateurs..."
                  readOnly={showSearchModal} // modal gère la saisie réelle
                  className={`w-full pl-10 pr-4 py-2.5 rounded-xl outline-none cursor-pointer bg-transparent ${
                    isDarkMode
                      ? "text-white placeholder-gray-500"
                      : "text-gray-900 placeholder-gray-400"
                  }`}
                />
              </div>
            </div>
          )}

          {user && (
            <div className="flex items-center gap-2 sm:gap-3">

              {/* TOGGLE THEME */}
              <button
                onClick={toggleDarkMode}
                className={`p-2.5 rounded-xl transition-colors active:scale-95 ${
                  isDarkMode ? "bg-gray-800 text-yellow-400 hover:bg-gray-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>

              {/* NOTIFICATIONS */}
              <div className="relative" ref={notifRef}>
                <button
                  onClick={() => { setShowNotifications(!showNotifications); if (!showNotifications) fetchNotifications(); }}
                  className={`p-2.5 rounded-xl relative transition-colors active:scale-95 ${
                    isDarkMode ? "bg-gray-800 text-gray-200 hover:bg-gray-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
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
                      <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30"
                        onClick={() => setShowNotifications(false)}
                      />
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className={`absolute right-0 mt-4 w-80 sm:w-96 rounded-2xl shadow-2xl overflow-hidden border ring-1 ring-black/5 z-40 ${
                          isDarkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"
                        }`}
                      >
                        <div className="p-4 flex justify-between items-center bg-gradient-to-r from-orange-500 to-pink-600">
                          <h3 className="text-white font-bold text-sm">Notifications</h3>
                          {unreadCount > 0 && (
                            <button onClick={markAllAsRead} disabled={loadingNotifs}
                              className="text-xs bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-full transition disabled:opacity-50 backdrop-blur-sm">
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
                            notifications.map(notif => (
                              <div key={notif._id} onClick={() => handleNotificationClick(notif)}
                                className={`p-4 border-b border-gray-100/10 hover:bg-gray-50/5 relative group transition-colors flex gap-3 cursor-pointer ${
                                  !notif.read ? (isDarkMode ? "bg-gray-700/30" : "bg-blue-50/50") : ""
                                }`}>
                                <div className="mt-1 text-xl shrink-0">
                                  {notif.type === "like" && "❤️"}
                                  {notif.type === "comment" && "💬"}
                                  {notif.type === "follow" && "👤"}
                                  {notif.type === "system" && "⚙️"}
                                  {!["like","comment","follow","system"].includes(notif.type) && "🔔"}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm ${isDarkMode ? "text-gray-200" : "text-gray-800"}`}>{notif.message}</p>
                                  <p className="text-xs opacity-50 mt-1">
                                    {new Date(notif.createdAt).toLocaleDateString(undefined, {
                                      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                                    })}
                                  </p>
                                </div>
                                <button onClick={(e) => deleteNotification(e, notif._id)}
                                  className="self-start opacity-0 group-hover:opacity-100 p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition">
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
                <button onClick={() => setShowDropdown(!showDropdown)}
                  className="focus:outline-none" aria-label="Menu profil">
                  <UserAvatar user={user} avatarUrl={avatarUrl} />
                </button>

                <AnimatePresence>
                  {showDropdown && (
                    <>
                      <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30"
                        onClick={() => setShowDropdown(false)}
                      />
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        transition={{ duration: 0.15 }}
                        className={`absolute right-0 mt-4 w-60 rounded-2xl shadow-xl border overflow-hidden ring-1 ring-black/5 z-40 ${
                          isDarkMode ? "bg-gray-800 border-gray-700 text-gray-200" : "bg-white border-gray-100 text-gray-700"
                        }`}
                      >
                        <div className="p-4 border-b border-gray-200/10 bg-gray-50/5">
                          <p className="font-bold truncate">{user.fullName}</p>
                          <p className="text-xs opacity-60 truncate font-mono">{user.email}</p>
                        </div>
                        <div className="p-2 space-y-1">
                          <Link to={`/profile/${user._id}`} onClick={() => setShowDropdown(false)}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-sm font-medium ${
                              isDarkMode ? "hover:bg-gray-700" : "hover:bg-gray-100"
                            }`}>
                            <User size={18} /> Mon Profil
                          </Link>
                          {isAdminUser && (
                            <Link to="/admin" onClick={() => setShowDropdown(false)}
                              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-sm font-medium ${
                                isDarkMode ? "hover:bg-gray-700" : "hover:bg-gray-100"
                              }`}>
                              <Shield size={18} className="text-blue-500" /> Administration
                            </Link>
                          )}
                          <div className={`h-px my-1 ${isDarkMode ? "bg-gray-700" : "bg-gray-200"}`} />
                          <button onClick={handleLogout}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-500 text-sm font-medium transition-colors ${
                              isDarkMode ? "hover:bg-red-900/20" : "hover:bg-red-50"
                            }`}>
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

      {/* ✅ SEARCH MODAL — portal hors du header, z-index propre */}
      {user && (
        <SearchModal
          isOpen={showSearchModal}
          onClose={handleSearchModalClose}
          isDarkMode={isDarkMode}
          initialQuery={searchBarQuery}
          onNavigate={navigate}
        />
      )}
    </>
  );
});

export default Header;