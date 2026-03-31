// ==========================================
// 📁 src/components/Header.jsx
// 🎨 Panneaux adaptatifs Recherche & Notifications
//    Desktop → drawer latéral | Mobile → bottom sheet
// ==========================================
import React, { useState, useEffect, useCallback, useRef, useMemo, memo } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { useDarkMode } from "../context/DarkModeContext";
import { Bell, User, Shield, LogOut, Moon, Sun, Trash2, Search, X, Loader2, CheckCheck } from "lucide-react";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const SERVER_URL = API_URL.replace('/api', '');
const MEDIA_URL = (path) => path?.startsWith("http") ? path : `${SERVER_URL}/${path?.replace(/^\/+/, "")}`;

// ─────────────────────────────────────────────
// AVATAR
// ─────────────────────────────────────────────
const UserAvatar = memo(({ user, avatarUrl, size = "md" }) => {
  const firstLetter = (user?.fullName?.[0] || user?.email?.[0] || "U").toUpperCase();
  const [imgError, setImgError] = useState(false);
  const dim = size === "sm" ? "w-8 h-8 text-sm" : "w-10 h-10 text-lg";
  return (
    <div
      className={`relative ${dim} rounded-full overflow-hidden transition-transform hover:scale-105 active:scale-95`}
      style={{ boxShadow: "0 0 0 2px #f97316, 0 0 0 4px rgba(249,115,22,0.18)" }}
    >
      {avatarUrl && !imgError ? (
        <img src={avatarUrl} alt="Profil" className="w-full h-full object-cover"
          onError={() => setImgError(true)} loading="lazy" />
      ) : (
        <div
          className={`w-full h-full flex items-center justify-center text-white font-bold ${dim} select-none`}
          style={{ background: "linear-gradient(135deg, #f97316, #ec4899)" }}
        >
          {firstLetter}
        </div>
      )}
    </div>
  );
});
UserAvatar.displayName = "UserAvatar";

// ─────────────────────────────────────────────
// RÉSULTAT DE RECHERCHE
// ─────────────────────────────────────────────
const SearchResultItem = memo(({ profile, onClick, isDarkMode }) => {
  const profileAvatar = MEDIA_URL(profile.profilePhoto || profile.avatar || profile.profilePicture);
  const [imgError, setImgError] = useState(false);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 16 }}
      onClick={() => onClick(profile._id)}
      className={`flex items-center gap-3 px-5 py-3.5 cursor-pointer transition-colors ${
        isDarkMode ? "hover:bg-white/[0.04]" : "hover:bg-gray-50"
      }`}
    >
      <div
        className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0"
        style={{ boxShadow: "0 0 0 1.5px rgba(249,115,22,0.35)" }}
      >
        {profileAvatar && !imgError ? (
          <img src={profileAvatar} alt={profile.fullName || profile.username}
            className="w-full h-full object-cover" onError={() => setImgError(true)} />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white font-bold"
            style={{ background: "linear-gradient(135deg, #f97316, #ec4899)" }}>
            {(profile.fullName?.[0] || profile.username?.[0] || "U").toUpperCase()}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`font-semibold truncate ${isDarkMode ? "text-white" : "text-gray-900"}`}>
          {profile.fullName || profile.username}
        </p>
        {profile.username && profile.fullName && (
          <p className="text-sm text-gray-500 truncate">@{profile.username}</p>
        )}
        {profile.bio && (
          <p className="text-xs text-gray-400 truncate mt-0.5">{profile.bio}</p>
        )}
      </div>
      <div className="text-xs font-semibold px-3 py-1.5 rounded-full flex-shrink-0 text-white"
        style={{ background: "linear-gradient(135deg, #f97316, #ec4899)" }}>
        Voir →
      </div>
    </motion.div>
  );
});
SearchResultItem.displayName = "SearchResultItem";

// ─────────────────────────────────────────────
// HOOK — breakpoint sm
// ─────────────────────────────────────────────
const useIsDesktop = () => {
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== "undefined" ? window.innerWidth >= 640 : false
  );
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    const handler = (e) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isDesktop;
};

// ─────────────────────────────────────────────
// PANNEAU ADAPTATIF
// Desktop → drawer latéral droit (max-w-sm)
// Mobile  → bottom sheet (92dvh)
// ─────────────────────────────────────────────
const SidePanel = memo(({ isOpen, onClose, isDarkMode, children, title, actions }) => {
  const isDesktop = useIsDesktop();

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  const variants = isDesktop
    ? { initial: { x: "100%" }, animate: { x: 0 }, exit: { x: "100%" } }
    : { initial: { y: "100%" }, animate: { y: 0  }, exit: { y: "100%" } };

  const panelClass = isDesktop
    ? `fixed top-0 right-0 h-full w-full max-w-sm z-[401] flex flex-col shadow-2xl border-l ${
        isDarkMode ? "bg-[#0d0d0d] border-white/[0.07]" : "bg-white border-gray-200"
      }`
    : `fixed bottom-0 left-0 right-0 z-[401] flex flex-col rounded-t-2xl shadow-2xl ${
        isDarkMode ? "bg-[#0d0d0d]" : "bg-white"
      }`;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key="panel-backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[400] bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.aside
            key="panel-body"
            initial={variants.initial}
            animate={variants.animate}
            exit={variants.exit}
            transition={{ type: "spring", damping: 32, stiffness: 300 }}
            className={panelClass}
            style={isDesktop ? {} : { height: "92dvh" }}
            onClick={(e) => e.stopPropagation()}
          >
            {!isDesktop && (
              <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
                <div className={`w-10 h-1 rounded-full ${isDarkMode ? "bg-white/20" : "bg-gray-300"}`} />
              </div>
            )}
            <div
              className="flex items-center justify-between px-5 py-4 flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #f97316, #ec4899)" }}
            >
              <h2 className="text-white font-bold text-base tracking-tight">{title}</h2>
              <div className="flex items-center gap-2">
                {actions}
                <button onClick={onClose}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-white transition">
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain">
              {children}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
});
SidePanel.displayName = "SidePanel";

// ─────────────────────────────────────────────
// PANNEAU RECHERCHE
// ─────────────────────────────────────────────
const SearchPanel = memo(({ isOpen, onClose, isDarkMode, onNavigate }) => {
  const { activeUserId, getToken } = useAuth();
  const [query,       setQuery]       = useState("");
  const [results,     setResults]     = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const inputRef   = useRef(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setQuery(""); setResults([]); setHasSearched(false);
      setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [isOpen]);

  const doSearch = useCallback(async (q) => {
    if (!q.trim() || q.length < 2) { setResults([]); setHasSearched(false); return; }
    setLoading(true); setHasSearched(true);
    try {
      const token = await getToken(activeUserId);
      if (!token) return;
      const res = await axios.get(`${API_URL}/users/search?q=${encodeURIComponent(q)}`,
        { headers: { Authorization: `Bearer ${token}` } });
      setResults(res.data?.users || []);
    } catch { setResults([]); }
    finally { setLoading(false); }
  }, [activeUserId, getToken]);

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(timeoutRef.current);
    if (!val.trim()) { setResults([]); setHasSearched(false); return; }
    timeoutRef.current = setTimeout(() => doSearch(val), 300);
  };

  return (
    <SidePanel isOpen={isOpen} onClose={onClose} isDarkMode={isDarkMode} title="Recherche">
      <div className={`sticky top-0 px-4 py-3 border-b backdrop-blur-md z-10 ${
        isDarkMode ? "bg-[#0d0d0d]/90 border-white/[0.07]" : "bg-white/90 border-gray-100"
      }`}>
        <div className={`flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 ${
          isDarkMode ? "bg-white/[0.06]" : "bg-gray-100"
        }`}>
          {loading
            ? <Loader2 size={16} className="text-orange-500 animate-spin flex-shrink-0" />
            : <Search size={16} className="text-gray-400 flex-shrink-0" />}
          <input ref={inputRef} type="text" value={query} onChange={handleChange}
            placeholder="Nom, pseudo…"
            className={`flex-1 text-sm bg-transparent outline-none ${
              isDarkMode ? "text-white placeholder-gray-500" : "text-gray-900 placeholder-gray-400"
            }`} />
          {query && (
            <button onClick={() => { setQuery(""); setResults([]); setHasSearched(false); }}
              className="text-gray-400 hover:text-gray-600 transition">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {!query.trim() && (
        <div className={`flex flex-col items-center justify-center py-20 gap-3 ${
          isDarkMode ? "text-gray-600" : "text-gray-400"}`}>
          <Search size={44} strokeWidth={1.2} />
          <p className="text-sm font-medium">Tapez pour rechercher</p>
          <p className="text-xs opacity-60">Minimum 2 caractères</p>
        </div>
      )}

      {hasSearched && !loading && results.length === 0 && query.trim() && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl ${
            isDarkMode ? "bg-white/[0.05]" : "bg-gray-100"}`}>🔍</div>
          <p className={`text-sm font-semibold ${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>Aucun résultat</p>
          <p className="text-xs text-gray-400">Essayez un autre terme</p>
        </div>
      )}

      {results.length > 0 && (
        <>
          <div className={`px-5 py-2.5 ${isDarkMode ? "bg-white/[0.03]" : "bg-gray-50"}`}>
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
              {results.length} résultat{results.length > 1 ? "s" : ""}
            </p>
          </div>
          <AnimatePresence mode="popLayout" initial={false}>
            {results.map((profile) => (
              <SearchResultItem key={profile._id} profile={profile}
                onClick={(id) => { onNavigate(`/profile/${id}`); onClose(); }}
                isDarkMode={isDarkMode} />
            ))}
          </AnimatePresence>
        </>
      )}
    </SidePanel>
  );
});
SearchPanel.displayName = "SearchPanel";

// ─────────────────────────────────────────────
// PANNEAU NOTIFICATIONS
// ─────────────────────────────────────────────
const NOTIF_ICONS = { like: "❤️", comment: "💬", follow: "👤", system: "⚙️" };

const NotificationsPanel = memo(({
  isOpen, onClose, isDarkMode,
  notifications, unreadCount, loadingNotifs,
  onMarkAllRead, onDelete, onClickNotif,
}) => {
  const grouped = useMemo(() => {
    const now = new Date();
    const today = now.toDateString();
    const yesterday = new Date(now - 86400000).toDateString();
    const groups = { "Aujourd'hui": [], "Hier": [], "Plus ancien": [] };
    notifications.forEach((n) => {
      const d = new Date(n.createdAt).toDateString();
      if (d === today)          groups["Aujourd'hui"].push(n);
      else if (d === yesterday) groups["Hier"].push(n);
      else                      groups["Plus ancien"].push(n);
    });
    return groups;
  }, [notifications]);

  const actions = unreadCount > 0 ? (
    <button onClick={onMarkAllRead} disabled={loadingNotifs}
      className="flex items-center gap-1.5 text-xs bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-full transition disabled:opacity-50 font-medium">
      <CheckCheck size={13} />
      <span className="hidden sm:inline">Tout lu</span>
    </button>
  ) : null;

  return (
    <SidePanel isOpen={isOpen} onClose={onClose} isDarkMode={isDarkMode}
      title={`Notifications${unreadCount > 0 ? ` (${unreadCount})` : ""}`}
      actions={actions}>
      {notifications.length === 0 ? (
        <div className={`flex flex-col items-center justify-center py-20 gap-4 ${
          isDarkMode ? "text-gray-600" : "text-gray-400"}`}>
          <div className={`w-20 h-20 rounded-2xl flex items-center justify-center text-4xl ${
            isDarkMode ? "bg-white/[0.04]" : "bg-gray-100"}`}>🔔</div>
          <div className="text-center">
            <p className="text-sm font-semibold mb-1">Tout est calme ici</p>
            <p className="text-xs opacity-60">Vos notifications apparaîtront ici</p>
          </div>
        </div>
      ) : (
        Object.entries(grouped).map(([label, items]) =>
          items.length > 0 ? (
            <div key={label}>
              <div className={`px-5 py-2.5 sticky top-0 backdrop-blur-md z-10 ${
                isDarkMode ? "bg-[#0d0d0d]/90 border-b border-white/[0.05]" : "bg-white/90 border-b border-gray-50"}`}>
                <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
              </div>
              <AnimatePresence initial={false}>
                {items.map((notif) => (
                  <motion.div key={notif._id} layout
                    initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 24, height: 0 }} transition={{ duration: 0.2 }}
                    onClick={() => onClickNotif(notif)}
                    className={`relative flex gap-3 px-5 py-4 cursor-pointer group border-b transition-colors ${
                      isDarkMode ? "border-white/[0.04] hover:bg-white/[0.03]" : "border-gray-50 hover:bg-gray-50"
                    } ${!notif.read ? (isDarkMode ? "bg-orange-500/[0.06]" : "bg-orange-50/40") : ""}`}
                  >
                    {!notif.read && (
                      <span className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full"
                        style={{ background: "linear-gradient(135deg, #f97316, #ec4899)" }} />
                    )}
                    <div className={`w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center text-lg ${
                      isDarkMode ? "bg-white/[0.06]" : "bg-gray-100"}`}>
                      {NOTIF_ICONS[notif.type] || "🔔"}
                    </div>
                    <div className="flex-1 min-w-0 pr-1">
                      <p className={`text-sm leading-snug ${isDarkMode ? "text-gray-200" : "text-gray-800"} ${
                        !notif.read ? "font-medium" : ""}`}>{notif.message}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(notif.createdAt).toLocaleDateString(undefined,
                          { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    <button onClick={(e) => onDelete(e, notif._id)}
                      className="self-start opacity-0 group-hover:opacity-100 p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg transition flex-shrink-0">
                      <Trash2 size={14} />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ) : null
        )
      )}
    </SidePanel>
  );
});
NotificationsPanel.displayName = "NotificationsPanel";

// ─────────────────────────────────────────────
// HEADER PRINCIPAL
// ─────────────────────────────────────────────
const Header = memo(function Header() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { user, logout, activeUserId, getToken } = useAuth();
  const { isDarkMode, toggleDarkMode } = useDarkMode();

  const [showDropdown,    setShowDropdown]    = useState(false);
  const [showSearchPanel, setShowSearchPanel] = useState(false);
  const [showNotifPanel,  setShowNotifPanel]  = useState(false);
  const [notifications,   setNotifications]   = useState([]);
  const [unreadCount,     setUnreadCount]     = useState(0);
  const [loadingNotifs,   setLoadingNotifs]   = useState(false);

  const profileRef  = useRef(null);
  const isAdminUser = user?.role === "admin" || user?.role === "superadmin";

  const avatarUrl = useMemo(() => {
    if (!user) return null;
    const avatar = user.avatar || user.profilePicture || user.profilePhoto;
    if (!avatar) return null;
    return avatar.startsWith("http") ? avatar : `${API_URL}${avatar}`;
  }, [user]);

  useEffect(() => {
    const handler = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) setShowDropdown(false);
    };
    document.addEventListener("mousedown", handler, { passive: true });
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const fetchNotifications = useCallback(async () => {
    if (!user?._id) return;
    try {
      const token = await getToken(activeUserId);
      if (!token) return;
      const res = await axios.get(`${API_URL}/notifications?limit=50`,
        { headers: { Authorization: `Bearer ${token}` } });
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

  const handleOpenNotifPanel = useCallback(() => {
    setShowNotifPanel(true); setShowSearchPanel(false); fetchNotifications();
  }, [fetchNotifications]);

  const handleOpenSearchPanel = useCallback(() => {
    setShowSearchPanel(true); setShowNotifPanel(false);
  }, []);

  const markAllAsRead = useCallback(async () => {
    setLoadingNotifs(true);
    try {
      const token = await getToken(activeUserId);
      await axios.patch(`${API_URL}/notifications/read-all`, {},
        { headers: { Authorization: `Bearer ${token}` } });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {}
    finally { setLoadingNotifs(false); }
  }, [activeUserId, getToken]);

  const deleteNotification = useCallback(async (e, id) => {
    e.stopPropagation();
    try {
      const token = await getToken(activeUserId);
      await axios.delete(`${API_URL}/notifications/${id}`,
        { headers: { Authorization: `Bearer ${token}` } });
      setNotifications(prev => prev.filter(n => n._id !== id));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch {}
  }, [activeUserId, getToken]);

  const handleNotificationClick = useCallback((notif) => {
    if (!notif.read) {
      getToken(activeUserId).then(token => {
        axios.patch(`${API_URL}/notifications/${notif._id}/read`, {},
          { headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
      });
      setNotifications(prev => prev.map(n => n._id === notif._id ? { ...n, read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
    setShowNotifPanel(false);
    if (notif.postId)                       navigate(`/post/${notif.postId}`);
    else if (notif.userId || notif.senderId) navigate(`/profile/${notif.userId || notif.senderId}`);
    else if (notif.link)                    navigate(notif.link);
  }, [activeUserId, getToken, navigate]);

  const handleLogout = useCallback(() => {
    setShowDropdown(false);
    logout(activeUserId);
    navigate("/auth");
  }, [activeUserId, logout, navigate]);

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
            <motion.div whileHover={{ rotate: 10, scale: 1.05 }} whileTap={{ scale: 0.92 }}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #f97316, #ec4899)" }}>C</motion.div>
            <span className="text-xl font-bold hidden sm:block bg-clip-text text-transparent"
              style={{ background: "linear-gradient(135deg, #f97316, #ec4899)", WebkitBackgroundClip: "text" }}>
              Chantilink
            </span>
          </Link>

          {/* RECHERCHE — pill sm+ / icône <sm */}
          {user && (
            <>
              <button onClick={handleOpenSearchPanel}
                className={`hidden sm:flex flex-1 max-w-md mx-4 items-center gap-2.5 rounded-full px-4 py-2.5 text-sm text-left transition-all border ${
                  showSearchPanel
                    ? isDarkMode ? "bg-orange-500/10 border-orange-500/40 text-orange-400" : "bg-orange-50 border-orange-300 text-orange-500"
                    : isDarkMode ? "bg-gray-800 border-gray-700/50 hover:border-gray-600 text-gray-500" : "bg-gray-100 border-transparent hover:border-gray-300 text-gray-400"
                }`}>
                <Search size={16} className="flex-shrink-0" />
                <span className="truncate">Rechercher des utilisateurs…</span>
              </button>
              <button onClick={handleOpenSearchPanel}
                className={`sm:hidden w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-full transition-all active:scale-90 ${
                  showSearchPanel
                    ? isDarkMode ? "bg-orange-500/20 text-orange-400" : "bg-orange-50 text-orange-500"
                    : isDarkMode ? "bg-gray-800 text-gray-300 hover:bg-gray-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
                style={{ WebkitTapHighlightColor: "transparent" }} aria-label="Rechercher">
                <Search size={18} />
              </button>
            </>
          )}

          {/* ACTIONS DROITE */}
          {user && (
            <div className="flex items-center gap-2 sm:gap-2.5">

              {/* THEME */}
              <button onClick={toggleDarkMode}
                className={`w-9 h-9 flex items-center justify-center rounded-full transition-all active:scale-90 ${
                  isDarkMode ? "bg-gray-800 text-yellow-400 hover:bg-gray-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`} style={{ WebkitTapHighlightColor: "transparent" }}>
                {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
              </button>

              {/* NOTIFICATIONS */}
              <button onClick={handleOpenNotifPanel}
                className={`w-9 h-9 flex items-center justify-center rounded-full relative transition-all active:scale-90 ${
                  showNotifPanel
                    ? isDarkMode ? "bg-orange-500/20 text-orange-400" : "bg-orange-50 text-orange-500"
                    : isDarkMode ? "bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`} style={{ WebkitTapHighlightColor: "transparent" }} aria-label="Notifications">
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center rounded-full text-white font-black border-2 text-[10px]"
                    style={{ minWidth: 17, height: 17, background: "linear-gradient(135deg, #f43f5e, #fb923c)",
                      borderColor: isDarkMode ? "#111827" : "#fff", padding: "0 3px", lineHeight: 1 }}>
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>

              {/* USER DROPDOWN */}
              <div className="relative" ref={profileRef}>
                <button onClick={() => setShowDropdown(!showDropdown)}
                  className="focus:outline-none transition-transform active:scale-90"
                  aria-label="Menu profil" style={{ WebkitTapHighlightColor: "transparent" }}>
                  <UserAvatar user={user} avatarUrl={avatarUrl} />
                </button>

                <AnimatePresence>
                  {showDropdown && (
                    <>
                      <motion.div key="dd-bg"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30"
                        onClick={() => setShowDropdown(false)} />
                      <motion.div key="dd-menu"
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        transition={{ duration: 0.15 }}
                        className={`absolute right-0 mt-4 w-60 rounded-2xl shadow-xl border overflow-hidden ring-1 ring-black/5 z-40 ${
                          isDarkMode ? "bg-gray-900 border-gray-800 text-gray-200" : "bg-white border-gray-100 text-gray-700"
                        }`}>
                        <div className={`flex items-center gap-3 p-4 border-b ${isDarkMode ? "border-gray-800" : "border-gray-100"}`}>
                          <UserAvatar user={user} avatarUrl={avatarUrl} />
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm truncate">{user.fullName}</p>
                            <p className="text-xs opacity-50 truncate">{user.email}</p>
                          </div>
                        </div>
                        <div className="p-2 space-y-0.5">
                          <Link to={`/profile/${user._id}`} onClick={() => setShowDropdown(false)}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-sm font-medium ${
                              isDarkMode ? "hover:bg-white/[0.05] hover:text-white" : "hover:bg-gray-50 hover:text-gray-900"}`}>
                            <User size={17} /> Mon Profil
                          </Link>
                          {isAdminUser && (
                            <Link to="/admin" onClick={() => setShowDropdown(false)}
                              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-sm font-medium ${
                                isDarkMode ? "hover:bg-white/[0.05] hover:text-white" : "hover:bg-gray-50 hover:text-gray-900"}`}>
                              <Shield size={17} className="text-blue-500" /> Administration
                            </Link>
                          )}
                          <div className={`h-px my-1 ${isDarkMode ? "bg-gray-800" : "bg-gray-100"}`} />
                          <button onClick={handleLogout}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-500 text-sm font-medium transition-colors ${
                              isDarkMode ? "hover:bg-red-500/10" : "hover:bg-red-50"}`}>
                            <LogOut size={17} /> Se déconnecter
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

      {/* PANNEAUX */}
      {user && (
        <>
          <SearchPanel isOpen={showSearchPanel} onClose={() => setShowSearchPanel(false)}
            isDarkMode={isDarkMode} onNavigate={navigate} />
          <NotificationsPanel isOpen={showNotifPanel} onClose={() => setShowNotifPanel(false)}
            isDarkMode={isDarkMode} notifications={notifications} unreadCount={unreadCount}
            loadingNotifs={loadingNotifs} onMarkAllRead={markAllAsRead}
            onDelete={deleteNotification} onClickNotif={handleNotificationClick} />
        </>
      )}
    </>
  );
});

export default Header;