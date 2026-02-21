// 📁 src/App.jsx - NAVIGATION ULTRA-RAPIDE
// ✅ Fix: suppression animations nav (gain 300ms)
// ✅ Fix: useMessagesData centralisé (1 seul fetch au lieu de 3)
// ✅ Fix: suppression key={location.pathname} (stop remount des pages)
// ✅ Fix: navbar toggle via CSS visibility (pas AnimatePresence)
// ✅ Fix: clic sur "Accueil" quand déjà sur "/" → refresh du feed (comme Instagram)

import React, { useState, Suspense, useEffect, useMemo, useCallback, memo, useRef } from "react";
import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home, MessageSquare, Video, Calculator, Mail, User, Menu, ArrowLeft, Shield, Bell
} from "lucide-react";

import LoadingSpinner from "./components/LoadingSpinner";
import { Header } from "./imports/importsComponents";
import { useAuth } from "./imports/importsContext";
import { useStories } from "./context/StoryContext";
import { useDarkMode } from "./context/DarkModeContext";
import { useMessagesData } from "./pages/Chat/hooks/useMessagesData";
import { usePosts } from "./context/PostsContext";
import ProtectedAdminRoute from "./components/ProtectedAdminRoute";
import { setupIndexedDB } from "./utils/idbMigration";
import { initializeStorage } from "./utils/idbCleanup";

import {
  Home as HomePage, Profile, ChatPage, VideosPage, CalculsPage, Messages, AuthPage
} from "./imports/importsPages.js";

import AdminDashboard from "./pages/Admin/AdminDashboard.jsx";
import StoryViewer from "./pages/Home/StoryViewer";

const fastTransition = { duration: 0.15, ease: "easeOut" };

// ============================================
// ÉVÉNEMENT GLOBAL : refresh du feed Home
// Émis quand l'user clique sur "Accueil" alors qu'il y est déjà.
// Home.jsx écoute cet événement pour scroller en haut + refetch.
// ============================================
export const HOME_REFRESH_EVENT = "home:refresh";
export const emitHomeRefresh = () =>
  window.dispatchEvent(new CustomEvent(HOME_REFRESH_EVENT));

// ============================================
// SCROLL OPTIMISÉ
// ============================================
function useSmartScroll(threshold = 10) {
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollY      = useRef(0);
  const scrollDirection  = useRef('up');
  const ticking          = useRef(false);

  useEffect(() => {
    const handleScroll = () => {
      if (!ticking.current) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY || document.documentElement.scrollTop;

          if (currentScrollY < 80) {
            setIsVisible(true);
            lastScrollY.current = currentScrollY;
            ticking.current = false;
            return;
          }

          const scrollDiff = currentScrollY - lastScrollY.current;

          if (scrollDiff > threshold) {
            if (scrollDirection.current !== 'down') {
              scrollDirection.current = 'down';
              setIsVisible(false);
            }
          } else if (scrollDiff < -threshold) {
            if (scrollDirection.current !== 'up') {
              scrollDirection.current = 'up';
              setIsVisible(true);
            }
          }

          lastScrollY.current = currentScrollY;
          ticking.current = false;
        });
        ticking.current = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [threshold]);

  return isVisible;
}

export default function App() {
  const [ready, setReady] = useState(false);
  const { ready: authReady } = useAuth();

  useEffect(() => {
    const initApp = async () => {
      try {
        await setupIndexedDB().catch(() => console.warn('IDB init failed'));
        await initializeStorage().catch(err => {
          console.error('❌ [App] Erreur init storage:', err);
        });
      } catch (err) {
        console.error('❌ [App] Erreur initialisation:', err);
      }
    };

    initApp();

    const fixVh = () =>
      document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
    fixVh();
    window.addEventListener('resize', fixVh, { passive: true });

    if (authReady) setReady(true);

    return () => window.removeEventListener('resize', fixVh);
  }, [authReady]);

  if (!ready) {
    return (
      <div className="fixed inset-0 bg-gray-900 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <Suspense fallback={<div className="fixed inset-0 bg-gray-900" />}>
      <AppContent />
    </Suspense>
  );
}

function AppContent() {
  const { user, token, socket } = useAuth();
  const { isDarkMode }          = useDarkMode();
  const location                = useLocation();
  const navigate                = useNavigate();
  const { deleteSlide }         = useStories();

  const [storyViewerOpen, setStoryViewerOpen] = useState(false);
  const [storyViewerData, setStoryViewerData] = useState({ stories: [], owner: null });
  const [liveNotifications, setLiveNotifications] = useState([]);

  const isNavVisible = useSmartScroll(10);

  // ✅ useMessagesData CENTRALISÉ — 1 seul fetch pour toute l'app
  const { data: messagesData } = useMessagesData(token, null);
  const unreadCount = useMemo(() => {
    if (!messagesData?.conversations) return 0;
    return messagesData.conversations.reduce((acc, conv) => acc + (conv.unreadCount || 0), 0);
  }, [messagesData?.conversations]);

  const [liveUnreadCount, setLiveUnreadCount] = useState(0);
  useEffect(() => { setLiveUnreadCount(unreadCount); }, [unreadCount]);

  useEffect(() => {
    if (!socket) return;
    const handleNewMessage = () => setLiveUnreadCount(prev => prev + 1);
    const handleMarkAsRead = () => setLiveUnreadCount(0);
    socket.on('receiveMessage', handleNewMessage);
    socket.on('messagesRead', handleMarkAsRead);
    return () => {
      socket.off('receiveMessage', handleNewMessage);
      socket.off('messagesRead', handleMarkAsRead);
    };
  }, [socket]);

  // ✅ NOTIFICATIONS DEBOUNCÉES
  const notificationQueue = useRef([]);
  const notificationTimer = useRef(null);

  const addNotification = useCallback((notification) => {
    notificationQueue.current.push(notification);
    if (notificationTimer.current) clearTimeout(notificationTimer.current);

    notificationTimer.current = setTimeout(() => {
      if (notificationQueue.current.length === 0) return;

      const grouped = notificationQueue.current.reduce((acc, notif) => {
        if (!acc[notif.type]) acc[notif.type] = [];
        acc[notif.type].push(notif);
        return acc;
      }, {});

      Object.entries(grouped).forEach(([type, notifs]) => {
        const count   = notifs.length;
        const message = count > 1
          ? `${count} nouveaux ${type === 'message' ? 'messages' : 'stories'}`
          : notifs[0].message;
        const notifId = Date.now() + Math.random();

        setLiveNotifications(prev => [
          ...prev.slice(-4),
          { id: notifId, type, message, timestamp: Date.now() }
        ]);

        setTimeout(() => {
          setLiveNotifications(prev => prev.filter(n => n.id !== notifId));
        }, 5000);
      });

      notificationQueue.current = [];
    }, 300);
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (data) => {
      if (location.pathname === '/messages') return;
      addNotification({
        type: 'message',
        message: `${data.senderName || 'Quelqu\'un'} vous a envoyé un message`,
      });
    };

    const handleNewStory = (data) => {
      if (location.pathname === '/') return;
      addNotification({
        type: 'story',
        message: `${data.userName || 'Quelqu\'un'} a publié une story`,
      });
    };

    socket.on('new_message', handleNewMessage);
    socket.on('new_story', handleNewStory);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('new_story', handleNewStory);
      if (notificationTimer.current) clearTimeout(notificationTimer.current);
    };
  }, [socket, location.pathname, addNotification]);

  const handleCloseStory = useCallback(() => setStoryViewerOpen(false), []);

  const isHome     = location.pathname === "/";
  const isAuth     = location.pathname === "/auth";
  const isMessages = location.pathname === "/messages";
  const showNav    = isHome && !isAuth && !storyViewerOpen;
  const isAdmin    = user?.role === 'admin' || user?.role === 'superadmin';

  const mainStyle = useMemo(() => ({
    top: showNav ? "72px" : "0",
    height: showNav ? "calc(100% - 72px)" : "100%",
    paddingBottom: "env(safe-area-inset-bottom)",
  }), [showNav]);

  // ─────────────────────────────────────────────
  // Handler clic "Accueil" — comportement Instagram :
  //   • Si on est ailleurs → navigate("/")
  //   • Si on est déjà sur "/" → émet HOME_REFRESH_EVENT
  //     (Home.jsx écoute et scrolle en haut + refetch)
  // ─────────────────────────────────────────────
  const handleHomeClick = useCallback(() => {
    if (location.pathname === "/") {
      emitHomeRefresh();
    } else {
      navigate("/");
    }
  }, [location.pathname, navigate]);

  return (
    <div className={`fixed inset-0 overflow-hidden ${isDarkMode ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-900"}`}>

      {/* NOTIFICATIONS */}
      <AnimatePresence>
        {liveNotifications.map(notif => (
          <LiveNotification
            key={notif.id}
            notification={notif}
            isDarkMode={isDarkMode}
            onClose={() => setLiveNotifications(prev => prev.filter(n => n.id !== notif.id))}
          />
        ))}
      </AnimatePresence>

      {/* HEADER */}
      {showNav && (
        <div
          className="fixed top-0 left-0 right-0 z-40 transition-transform duration-200"
          style={{ transform: isNavVisible ? 'translateY(0)' : 'translateY(-100%)' }}
        >
          <Header />
        </div>
      )}

      {!isHome && !isAuth && !storyViewerOpen && !isMessages && (
        <FloatingBackButton isDarkMode={isDarkMode} onClick={() => navigate("/")} />
      )}

      {showNav && (
        <SidebarDesktopMemo
          isDarkMode={isDarkMode}
          isAdminUser={isAdmin}
          unreadCount={liveUnreadCount}
          onHomeClick={handleHomeClick}   // ✅ passé en prop
        />
      )}

      <main className="absolute left-0 right-0 z-10 overflow-y-auto lg:left-0" style={mainStyle}>
        <div className="lg:ml-64 max-w-[630px] lg:max-w-none lg:px-8 mx-auto">
          <Suspense fallback={<LoadingSpinner />}>
            <Routes location={location}>
              <Route path="/auth" element={<AuthRoute redirectIfAuthenticated><AuthPage /></AuthRoute>} />
              <Route path="/" element={
                <AuthRoute>
                  <HomePage openStoryViewer={(s, o) => {
                    setStoryViewerData({ stories: s, owner: o });
                    setStoryViewerOpen(true);
                  }} />
                </AuthRoute>
              } />
              <Route path="/chat"            element={<AuthRoute><ChatPage /></AuthRoute>} />
              <Route path="/videos"          element={<AuthRoute><VideosPage /></AuthRoute>} />
              <Route path="/calculs"         element={<AuthRoute><CalculsPage /></AuthRoute>} />
              <Route path="/messages"        element={<AuthRoute><Messages /></AuthRoute>} />
              <Route path="/profile/:userId" element={<AuthRoute><Profile /></AuthRoute>} />
              <Route path="/admin/*"         element={<AuthRoute><ProtectedAdminRoute><AdminDashboard /></ProtectedAdminRoute></AuthRoute>} />
              <Route path="*"               element={<Navigate to={user ? "/" : "/auth"} replace />} />
            </Routes>
          </Suspense>
        </div>
      </main>

      {/* NAVBAR MOBILE */}
      {showNav && (
        <div
          className="fixed bottom-0 left-0 right-0 z-50 transition-transform duration-200"
          style={{ transform: isNavVisible ? 'translateY(0)' : 'translateY(100%)' }}
        >
          <NavbarMobileMemo
            isDarkMode={isDarkMode}
            isAdminUser={isAdmin}
            user={user}
            location={location}
            unreadCount={liveUnreadCount}
            onHomeClick={handleHomeClick}   // ✅ passé en prop
          />
        </div>
      )}

      {storyViewerOpen && (
        <StoryViewer
          stories={storyViewerData.stories}
          currentUser={user}
          onClose={handleCloseStory}
          onDelete={async (id, idx) => await deleteSlide(id, idx)}
        />
      )}
    </div>
  );
}

// ============================================
// COMPOSANTS
// ============================================
const LiveNotification = memo(({ notification, isDarkMode, onClose }) => {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const duration = 5000;
    const interval = 50;
    const step     = (interval / duration) * 100;

    const timer = setInterval(() => {
      setProgress(prev => {
        const next = prev - step;
        if (next <= 0) { clearInterval(timer); return 0; }
        return next;
      });
    }, interval);

    return () => clearInterval(timer);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, x: 100 }}
      animate={{ opacity: 1, y: 0, x: 0 }}
      exit={{ opacity: 0, x: 100 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="fixed top-20 right-4 z-[100] max-w-sm"
      onClick={onClose}
    >
      <div className={`relative flex items-start gap-3 px-4 py-3 rounded-2xl shadow-2xl backdrop-blur-xl border cursor-pointer ${
        isDarkMode ? 'bg-gray-800/95 border-gray-700' : 'bg-white/95 border-gray-200'
      }`}>
        <div className={`flex-shrink-0 p-2 rounded-full ${
          notification.type === 'message'
            ? 'bg-orange-500/20 text-orange-500'
            : 'bg-blue-500/20 text-blue-500'
        }`}>
          {notification.type === 'message' ? <MessageSquare size={18} /> : <Bell size={18} />}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            {notification.message}
          </p>
          <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            À l'instant
          </p>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200/20 rounded-b-2xl overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-orange-500 to-orange-600"
            style={{ width: `${progress}%` }}
            transition={{ duration: 0.05, ease: "linear" }}
          />
        </div>
      </div>
    </motion.div>
  );
});

// ✅ onHomeClick en prop pour différencier navigate vs refresh
const NavbarMobileMemo = memo(({ isDarkMode, isAdminUser, user, location, unreadCount, onHomeClick }) => {
  const navigate     = useNavigate();
  const [isMenuOpen, setMenuOpen] = useState(false);
  const isActive = useCallback((path) => location.pathname === path, [location.pathname]);

  return (
    <>
      <nav className={`lg:hidden h-16 flex justify-around items-center backdrop-blur-xl border-t ${
        isDarkMode ? "bg-gray-900/90 border-gray-800" : "bg-white/90 border-gray-200"
      }`}>
        {/* ✅ Accueil → onHomeClick au lieu de navigate directement */}
        <NavBtn icon={Home} label="Accueil" active={isActive("/")} onClick={onHomeClick} />
        <NavBtn icon={Video}         label="Vidéos"  active={isActive("/videos")} onClick={() => navigate("/videos")} />
        <NavBtn icon={MessageSquare} label="Chat"    active={isActive("/chat")}   onClick={() => navigate("/chat")} />
        <NavBtn icon={Menu}          label="Plus"    onClick={() => setMenuOpen(true)} badge={unreadCount} />
      </nav>
      {isMenuOpen && (
        <MenuOverlay
          user={user}
          isAdminUser={isAdminUser}
          isDarkMode={isDarkMode}
          onClose={() => setMenuOpen(false)}
          unreadCount={unreadCount}
        />
      )}
    </>
  );
});

const NavBtn = memo(({ icon: Icon, label, active, onClick, badge }) => (
  <button
    onClick={onClick}
    className={`relative flex flex-col items-center flex-1 transition-colors ${active ? "text-orange-500" : "text-gray-400"}`}
  >
    <Icon size={20} />
    <span className="text-[10px] font-bold mt-1">{label}</span>
    <AnimatePresence>
      {badge > 0 && (
        <motion.span
          initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 25 }}
          className="absolute top-0 right-4 bg-red-500 text-white text-[10px] font-black min-w-[18px] h-[18px] flex items-center justify-center rounded-full border-2 border-gray-900 shadow-lg"
        >
          <motion.span animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 2 }}>
            {badge > 99 ? '99+' : badge}
          </motion.span>
        </motion.span>
      )}
    </AnimatePresence>
  </button>
));

const FloatingBackButton = memo(({ isDarkMode, onClick }) => (
  <motion.button
    initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
    transition={fastTransition}
    onClick={onClick}
    className={`fixed top-4 left-4 z-[60] p-3 rounded-full shadow-xl backdrop-blur-md border ${
      isDarkMode ? "bg-gray-800/80 border-gray-700 text-white" : "bg-white/80 border-gray-200 text-gray-800"
    }`}
  >
    <ArrowLeft size={24} />
  </motion.button>
));

// ✅ onHomeClick en prop
const SidebarDesktopMemo = memo(({ isDarkMode, isAdminUser, unreadCount, onHomeClick }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isActive = useCallback((path) => location.pathname === path, [location.pathname]);

  return (
    <aside className={`hidden lg:flex fixed left-0 top-[72px] bottom-0 w-64 flex-col py-8 px-6 gap-2 z-30 border-r ${
      isDarkMode ? 'bg-gray-900/50 border-gray-800' : 'bg-white border-gray-100'
    }`}>
      {/* ✅ Accueil → onHomeClick */}
      <NavItemDesktop icon={Home}          label="Accueil"    onClick={onHomeClick}                                      isDarkMode={isDarkMode} active={isActive("/")} />
      <NavItemDesktop icon={MessageSquare} label="Chat"       onClick={() => navigate("/chat")}                          isDarkMode={isDarkMode} active={isActive("/chat")} />
      <NavItemDesktop icon={Video}         label="Vidéos"     onClick={() => navigate("/videos")}                        isDarkMode={isDarkMode} active={isActive("/videos")} />
      <NavItemDesktop icon={Calculator}    label="Calculs"    onClick={() => navigate("/calculs")}                       isDarkMode={isDarkMode} active={isActive("/calculs")} />
      <NavItemDesktop icon={Mail}          label="Messagerie" onClick={() => navigate("/messages")}                      isDarkMode={isDarkMode} active={isActive("/messages")} badge={unreadCount} />
      <NavItemDesktop icon={User}          label="Profil"     onClick={() => navigate(`/profile/${location.state?.userId || 'me'}`)} isDarkMode={isDarkMode} active={location.pathname.includes("/profile")} />
      {isAdminUser && (
        <>
          <div className={`w-full h-px my-4 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-200'}`} />
          <NavItemDesktop icon={Shield} label="Admin" onClick={() => navigate("/admin")} isDarkMode={isDarkMode} active={location.pathname.includes("/admin")} isAdmin />
        </>
      )}
    </aside>
  );
});

const NavItemDesktop = memo(({ icon: Icon, label, onClick, isDarkMode, active, isAdmin, badge }) => (
  <button
    onClick={onClick}
    className={`group relative flex items-center gap-4 w-full px-4 py-3 rounded-xl transition-all ${
      active
        ? (isDarkMode ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900')
        : (isDarkMode ? 'text-gray-400 hover:bg-gray-800/50 hover:text-white' : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900')
    } ${isAdmin ? 'text-red-500 hover:text-red-400' : ''}`}
  >
    <Icon size={26} strokeWidth={active ? 2.5 : 2} />
    <span className={`text-base ${active ? 'font-semibold' : 'font-normal'}`}>{label}</span>
    <AnimatePresence>
      {badge > 0 && (
        <motion.span
          initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 25 }}
          className="absolute right-3 top-1/2 -translate-y-1/2 bg-red-500 text-white text-xs font-bold min-w-[20px] h-[20px] flex items-center justify-center rounded-full"
        >
          {badge > 99 ? '99+' : badge}
        </motion.span>
      )}
    </AnimatePresence>
  </button>
));

const MenuOverlay = memo(({ user, isAdminUser, isDarkMode, onClose, unreadCount }) => {
  const navigate = useNavigate();

  const items = useMemo(() => {
    const baseItems = [
      { label: "Profil",    icon: User,       path: `/profile/${user?._id}` },
      { label: "Calculs",   icon: Calculator, path: "/calculs" },
      { label: "Messages",  icon: Mail,       path: "/messages", badge: unreadCount },
    ];
    if (isAdminUser) baseItems.push({ label: "Admin", icon: Shield, path: "/admin" });
    return baseItems;
  }, [user?._id, isAdminUser, unreadCount]);

  return (
    <div className="fixed inset-0 z-[110] flex items-end">
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        transition={fastTransition}
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={fastTransition}
        className={`w-full p-6 rounded-t-[40px] relative ${isDarkMode ? "bg-gray-900" : "bg-white shadow-2xl"}`}
      >
        <div className="w-12 h-1.5 bg-gray-600/30 mx-auto mb-6 rounded-full" />
        <div className="grid grid-cols-3 gap-4">
          {items.map(item => (
            <button
              key={item.path}
              onClick={() => { navigate(item.path); onClose(); }}
              className="relative flex flex-col items-center gap-2 p-4 rounded-3xl bg-gray-500/5 active:scale-95 transition-transform"
            >
              <item.icon size={24} className={isDarkMode ? "text-orange-400" : "text-orange-500"} />
              <span className="text-xs font-medium">{item.label}</span>
              {item.badge > 0 && (
                <motion.span
                  initial={{ scale: 0 }} animate={{ scale: 1 }}
                  className="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold min-w-[20px] h-[20px] flex items-center justify-center rounded-full"
                >
                  {item.badge > 99 ? '99+' : item.badge}
                </motion.span>
              )}
            </button>
          ))}
        </div>
      </motion.div>
    </div>
  );
});

function AuthRoute({ children, redirectIfAuthenticated = false }) {
  const { user, ready } = useAuth();
  if (!ready) return <LoadingSpinner fullScreen />;
  if (redirectIfAuthenticated && user) return <Navigate to="/" replace />;
  if (!redirectIfAuthenticated && !user) return <Navigate to="/auth" replace />;
  return children;
}