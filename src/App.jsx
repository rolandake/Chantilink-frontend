// 📁 src/App.jsx
// ✅ LCP FIX : __hideSplash() appelé EN PREMIER dans AppContent, avant tout await
// ✅ CLS FIX : mainStyle stable, pas de changement de layout après mount
// ✅ INP FIX : suppression AnimatePresence sur les routes (remount inutile)
// ✅ HOME FIX v2 : tap = scroll en haut + refresh (nouveaux posts)
// ✅ WAKEUP FIX : écran d'attente rassurant pendant le réveil du serveur Render
// ✅ FIX SCROLL HEADER v2 : useSmartScroll écoute app:scroll + window.scroll
// ✅ FIX SCROLL INFINI : main ne doit PAS avoir overflow-y sur Home (géré par Home.jsx)

import React, {
  useState, Suspense, useEffect, useMemo, useCallback, memo, useRef
} from "react";
import {
  Routes, Route, Navigate, useLocation, useNavigate
} from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home, MessageSquare, Video, Calculator, Mail, User, Menu, ArrowLeft, Shield, Bell, X
} from "lucide-react";

import LoadingSpinner    from "./components/LoadingSpinner";
import WakeUpScreen      from "./components/WakeUpScreen";
import { Header }       from "./imports/importsComponents";
import { useAuth }      from "./imports/importsContext";
import { useStories }   from "./context/StoryContext";
import { useDarkMode }  from "./context/DarkModeContext";
import { useMessagesData } from "./pages/Chat/hooks/useMessagesData";
import { usePosts }     from "./context/PostsContext";
import ProtectedAdminRoute from "./components/ProtectedAdminRoute";
import { setupIndexedDB }    from "./utils/idbMigration";
import { initializeStorage } from "./utils/idbCleanup";
import { BACKEND_URL }       from "./api/axiosClientGlobal";

import {
  Home as HomePage, Profile, ChatPage, VideosPage, CalculsPage, Messages, AuthPage
} from "./imports/importsPages.js";

import About          from "./pages/About";
import AdminDashboard from "./pages/Admin/AdminDashboard.jsx";
import StoryViewer    from "./pages/Home/StoryViewer";

export const HOME_REFRESH_EVENT    = "home:refresh";
export const HOME_SCROLL_TOP_EVENT = "home:scrollTop";

export const emitHomeRefresh = () =>
  window.dispatchEvent(new CustomEvent(HOME_REFRESH_EVENT));

// ============================================
// SKELETON
// ============================================
const PageSkeleton = memo(({ isDarkMode }) => (
  <div
    className={`flex flex-col gap-4 p-4 ${isDarkMode ? "bg-gray-900" : "bg-gray-50"}`}
    style={{ minHeight: "100%" }}
  >
    {[1, 2, 3].map((i) => (
      <div
        key={i}
        className={`rounded-2xl ${isDarkMode ? "bg-gray-800" : "bg-gray-200"}`}
        style={{
          height: 120,
          opacity: 1 - i * 0.2,
          animation: "skeleton-pulse 1.4s ease-in-out infinite",
          animationDelay: `${i * 150}ms`,
        }}
      />
    ))}
    <style>{`
      @keyframes skeleton-pulse {
        0%, 100% { opacity: 0.6; }
        50%       { opacity: 0.3; }
      }
    `}</style>
  </div>
));
PageSkeleton.displayName = "PageSkeleton";

// ============================================
// SCROLL — masque la navbar au scroll bas
// ✅ FIX v2 : écoute app:scroll (Home.jsx) + window.scroll (autres pages)
// ============================================
function useSmartScroll(threshold = 10) {
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollY     = useRef(0);
  const scrollDirection = useRef("up");
  const ticking         = useRef(false);

  useEffect(() => {
    const update = (currentScrollY) => {
      if (ticking.current) return;
      ticking.current = true;

      window.requestAnimationFrame(() => {
        if (currentScrollY < 80) {
          setIsVisible(true);
          lastScrollY.current = currentScrollY;
          ticking.current = false;
          return;
        }

        const diff = currentScrollY - lastScrollY.current;

        if (diff > threshold && scrollDirection.current !== "down") {
          scrollDirection.current = "down";
          setIsVisible(false);
        } else if (diff < -threshold && scrollDirection.current !== "up") {
          scrollDirection.current = "up";
          setIsVisible(true);
        }

        lastScrollY.current = currentScrollY;
        ticking.current = false;
      });
    };

    const onAppScroll    = (e) => update(e.detail?.scrollTop ?? 0);
    const onWindowScroll = ()  => update(window.scrollY || document.documentElement.scrollTop || 0);

    window.addEventListener("app:scroll", onAppScroll,    { passive: true });
    window.addEventListener("scroll",     onWindowScroll, { passive: true });

    return () => {
      window.removeEventListener("app:scroll", onAppScroll);
      window.removeEventListener("scroll",     onWindowScroll);
    };
  }, [threshold]);

  return isVisible;
}

// ============================================
// useBackendReady
// ============================================
function useBackendReady() {
  const [serverReady, setServerReady] = useState(false);
  const [showWakeUp,  setShowWakeUp]  = useState(false);
  const pollingRef    = useRef(null);
  const mountedRef    = useRef(true);
  const firstPingDone = useRef(false);

  useEffect(() => {
    mountedRef.current = true;

    const ping = async () => {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 4000);
        const res = await fetch(`${BACKEND_URL}/api/health`, {
          method: "GET",
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (res.ok && mountedRef.current) {
          clearInterval(pollingRef.current);
          setServerReady(true);
          setShowWakeUp(false);
        }
      } catch {
        if (!firstPingDone.current && mountedRef.current) setShowWakeUp(true);
      } finally {
        firstPingDone.current = true;
      }
    };

    const showDelay = setTimeout(() => {
      if (!firstPingDone.current && mountedRef.current) setShowWakeUp(true);
    }, 1500);

    ping();
    pollingRef.current = setInterval(ping, 3000);

    return () => {
      mountedRef.current = false;
      clearInterval(pollingRef.current);
      clearTimeout(showDelay);
    };
  }, []);

  return { serverReady, showWakeUp };
}

// ============================================
// APP
// ============================================
export default function App() {
  const [ready, setReady] = useState(false);
  const { isDarkMode } = useDarkMode();
  const { serverReady, showWakeUp } = useBackendReady();

  useEffect(() => {
    setReady(true);

    Promise.all([
      setupIndexedDB().catch(() => console.warn("IDB init failed")),
      initializeStorage().catch((err) => console.error("❌ [App] Erreur init storage:", err)),
    ]).catch(() => {});

    const fixVh = () =>
      document.documentElement.style.setProperty("--vh", `${window.innerHeight * 0.01}px`);
    fixVh();
    window.addEventListener("resize", fixVh, { passive: true });
    return () => window.removeEventListener("resize", fixVh);
  }, []);

  if (!ready) return null;
  if (showWakeUp && !serverReady) return <WakeUpScreen isDarkMode={isDarkMode} />;

  return (
    <Suspense fallback={null}>
      <AppContent />
    </Suspense>
  );
}

function AppContent() {
  const { user, token, socket, ready: authReady } = useAuth();
  const { isDarkMode }  = useDarkMode();
  const location        = useLocation();
  const navigate        = useNavigate();
  const { deleteSlide } = useStories();

  const [storyViewerOpen, setStoryViewerOpen] = useState(false);
  const [storyViewerData, setStoryViewerData] = useState({ stories: [], owner: null });
  const [liveNotifications, setLiveNotifications] = useState([]);

  const isNavVisible = useSmartScroll(10);

  useEffect(() => {
    if (typeof window.__hideSplash === "function") window.__hideSplash();
  }, []);

  const { data: messagesData } = useMessagesData(token, null);
  const unreadCount = useMemo(() => {
    if (!messagesData?.conversations) return undefined;
    return messagesData.conversations.reduce((acc, conv) => acc + (conv.unreadCount || 0), 0);
  }, [messagesData?.conversations]);

  const [liveUnreadCount, setLiveUnreadCount] = useState(null);
  useEffect(() => {
    if (liveUnreadCount === null && unreadCount !== undefined) setLiveUnreadCount(unreadCount);
  }, [unreadCount, liveUnreadCount]);

  useEffect(() => {
    if (!socket) return;
    const onMsg  = () => setLiveUnreadCount((p) => (p ?? 0) + 1);
    const onRead = (d) => setLiveUnreadCount(typeof d?.unreadCount === "number" ? d.unreadCount : 0);
    socket.on("receiveMessage", onMsg);
    socket.on("messagesRead",   onRead);
    return () => { socket.off("receiveMessage", onMsg); socket.off("messagesRead", onRead); };
  }, [socket]);

  const unreadChannel = useRef(null);
  useEffect(() => {
    if (!("BroadcastChannel" in window)) return;
    unreadChannel.current = new BroadcastChannel("chantilink_unread");
    unreadChannel.current.onmessage = (e) => {
      if (typeof e.data === "number") setLiveUnreadCount(e.data);
    };
    return () => { unreadChannel.current?.close(); unreadChannel.current = null; };
  }, []);
  useEffect(() => {
    if (!unreadChannel.current || liveUnreadCount === null) return;
    unreadChannel.current.postMessage(liveUnreadCount);
  }, [liveUnreadCount]);

  const safeUnread = Math.max(0, liveUnreadCount ?? 0);

  const notificationQueue = useRef([]);
  const notificationTimer = useRef(null);
  const addNotification = useCallback((notification) => {
    notificationQueue.current.push(notification);
    if (notificationTimer.current) clearTimeout(notificationTimer.current);
    notificationTimer.current = setTimeout(() => {
      if (!notificationQueue.current.length) return;
      const grouped = notificationQueue.current.reduce((acc, n) => {
        if (!acc[n.type]) acc[n.type] = [];
        acc[n.type].push(n);
        return acc;
      }, {});
      Object.entries(grouped).forEach(([type, notifs]) => {
        const count   = notifs.length;
        const message = count > 1
          ? `${count} nouveaux ${type === "message" ? "messages" : "stories"}`
          : notifs[0].message;
        const id = Date.now() + Math.random();
        setLiveNotifications((prev) => [...prev.slice(-4), { id, type, message, timestamp: Date.now() }]);
        setTimeout(() => setLiveNotifications((prev) => prev.filter((n) => n.id !== id)), 5000);
      });
      notificationQueue.current = [];
    }, 300);
  }, []);

  useEffect(() => {
    if (!socket) return;
    const onMsg   = (d) => { if (location.pathname !== "/messages") addNotification({ type: "message", message: `${d.senderName || "Quelqu'un"} vous a envoyé un message` }); };
    const onStory = (d) => { if (location.pathname !== "/")         addNotification({ type: "story",   message: `${d.userName  || "Quelqu'un"} a publié une story` });          };
    socket.on("new_message", onMsg);
    socket.on("new_story",   onStory);
    return () => {
      socket.off("new_message", onMsg);
      socket.off("new_story",   onStory);
      if (notificationTimer.current) clearTimeout(notificationTimer.current);
    };
  }, [socket, location.pathname, addNotification]);

  const handleCloseStory = useCallback(() => setStoryViewerOpen(false), []);

  // Ref pour éviter les refreshs en double (debounce)
  const homeRefreshPending = useRef(false);

  const handleHomeClick = useCallback(() => {
    if (location.pathname === "/") {
      // Scroll en haut immédiatement
      window.dispatchEvent(new CustomEvent(HOME_SCROLL_TOP_EVENT));

      // ✅ Refresh avec debounce : on attend 300ms que le fetch en cours
      // (déclenché au mount) soit potentiellement terminé, puis on rafraîchit.
      // Si un refresh est déjà schedulé, on ne double pas.
      if (homeRefreshPending.current) return;
      homeRefreshPending.current = true;
      setTimeout(() => {
        homeRefreshPending.current = false;
        window.dispatchEvent(new CustomEvent(HOME_REFRESH_EVENT));
      }, 300);
    } else {
      navigate("/");
    }
  }, [location.pathname, navigate]);

  const isHome     = location.pathname === "/";
  const isAuth     = location.pathname === "/auth";
  const isMessages = location.pathname === "/messages";
  // ✅ showNav = visible sur toutes les pages authentifiées sauf /auth et StoryViewer
  const showNav    = !!user && !isAuth && !storyViewerOpen;
  const isAdmin    = user?.role === "admin" || user?.role === "superadmin";

  // ✅ FIX CSS : uniquement longhands overflowX + overflowY (pas de shorthand overflow)
  // Home a overflowY:"hidden" car son data-scroll-container gère le scroll interne
  const mainStyle = useMemo(() => ({
    top:                     showNav ? 72 : 0,
    bottom:                  showNav ? 64 : 0,
    overflowX:               "hidden",
    overflowY:               isHome ? "hidden" : "auto",
    WebkitOverflowScrolling: "touch",
    paddingBottom:           isHome ? 0 : "env(safe-area-inset-bottom)",
  }), [showNav, isHome]);

  return (
    <div className={`fixed inset-0 overflow-hidden ${isDarkMode ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-900"}`}>

      <AnimatePresence>
        {liveNotifications.map((notif) => (
          <LiveNotification
            key={notif.id}
            notification={notif}
            isDarkMode={isDarkMode}
            onClose={() => setLiveNotifications((prev) => prev.filter((n) => n.id !== notif.id))}
          />
        ))}
      </AnimatePresence>

      {showNav && (
        <div
          className="fixed top-0 left-0 right-0 z-40"
          style={{
            height:     72,
            transform:  isNavVisible ? "translateY(0)" : "translateY(-100%)",
            transition: "transform 200ms ease-out",
            willChange: "transform",
          }}
        >
          <Header />
        </div>
      )}

      {/* FloatingBackButton retiré : la navbar est maintenant présente sur toutes les pages */}

      {showNav && (
        <SidebarDesktopMemo
          isDarkMode={isDarkMode}
          isAdminUser={isAdmin}
          unreadCount={safeUnread}
          onHomeClick={handleHomeClick}
        />
      )}

      <main className="absolute left-0 right-0 z-10" style={mainStyle}>
        <div className={`lg:ml-64 max-w-[630px] lg:max-w-none lg:px-8 mx-auto ${isHome ? "h-full" : ""}`}>
          <Suspense fallback={<LoadingSpinner />}>
            <Routes location={location}>
              <Route path="/auth" element={
                <AuthRoute redirectIfAuthenticated authReady={authReady} isDarkMode={isDarkMode}>
                  <AuthPage />
                </AuthRoute>
              } />
              <Route path="/" element={
                <AuthRoute authReady={authReady} isDarkMode={isDarkMode}>
                  <HomePage
                    openStoryViewer={(s, o) => {
                      setStoryViewerData({ stories: s, owner: o });
                      setStoryViewerOpen(true);
                    }}
                  />
                </AuthRoute>
              } />
              <Route path="/chat"            element={<AuthRoute authReady={authReady} isDarkMode={isDarkMode}><ChatPage /></AuthRoute>} />
              <Route path="/videos"          element={<AuthRoute authReady={authReady} isDarkMode={isDarkMode}><VideosPage /></AuthRoute>} />
              <Route path="/calculs"         element={<AuthRoute authReady={authReady} isDarkMode={isDarkMode}><CalculsPage /></AuthRoute>} />
              <Route path="/messages"        element={<AuthRoute authReady={authReady} isDarkMode={isDarkMode}><Messages /></AuthRoute>} />
              <Route path="/profile/:userId" element={<AuthRoute authReady={authReady} isDarkMode={isDarkMode}><Profile /></AuthRoute>} />
              <Route path="/admin/*"         element={
                <AuthRoute authReady={authReady} isDarkMode={isDarkMode}>
                  <ProtectedAdminRoute><AdminDashboard /></ProtectedAdminRoute>
                </AuthRoute>
              } />
              <Route path="/about" element={<About />} />
              <Route path="*"      element={<Navigate to={user ? "/" : "/auth"} replace />} />
            </Routes>
          </Suspense>
        </div>
      </main>

      {showNav && (
        <div
          className="fixed bottom-0 left-0 right-0 z-50"
          style={{
            transform:  isNavVisible ? "translateY(0)" : "translateY(100%)",
            transition: "transform 200ms ease-out",
            willChange: "transform",
          }}
        >
          <NavbarMobileMemo
            isDarkMode={isDarkMode}
            isAdminUser={isAdmin}
            user={user}
            location={location}
            unreadCount={safeUnread}
            onHomeClick={handleHomeClick}
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
// LIVE NOTIFICATION
// ============================================
const LiveNotification = memo(({ notification, isDarkMode, onClose }) => (
  <motion.div
    initial={{ opacity: 0, y: -20, x: 100 }}
    animate={{ opacity: 1, y: 0, x: 0 }}
    exit={{ opacity: 0, x: 100 }}
    transition={{ duration: 0.2, ease: "easeOut" }}
    className="fixed top-20 right-4 z-[100] max-w-sm"
    onClick={onClose}
  >
    <div className={`relative flex items-start gap-3 px-4 py-3 rounded-2xl shadow-2xl backdrop-blur-xl border cursor-pointer overflow-hidden ${
      isDarkMode ? "bg-gray-800/95 border-gray-700" : "bg-white/95 border-gray-200"
    }`}>
      <div className={`flex-shrink-0 p-2 rounded-full ${
        notification.type === "message" ? "bg-orange-500/20 text-orange-500" : "bg-blue-500/20 text-blue-500"
      }`}>
        {notification.type === "message" ? <MessageSquare size={18} /> : <Bell size={18} />}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${isDarkMode ? "text-white" : "text-gray-900"}`}>{notification.message}</p>
        <p className={`text-xs mt-0.5 ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>À l'instant</p>
      </div>
      <div
        className="absolute bottom-0 left-0 right-0 h-0.5 origin-left rounded-b-2xl"
        style={{ background: "linear-gradient(90deg, #f97316, #ec4899)", animation: "notif-progress 5s linear forwards" }}
      />
      <style>{`@keyframes notif-progress { from { transform: scaleX(1); } to { transform: scaleX(0); } }`}</style>
    </div>
  </motion.div>
));
LiveNotification.displayName = "LiveNotification";

// ============================================
// FLOATING BACK BUTTON
// ============================================
const FloatingBackButton = memo(({ isDarkMode, onClick }) => (
  <button
    onClick={onClick}
    className={`fixed top-4 left-4 z-[60] flex items-center gap-2 pl-2 pr-4 py-2 rounded-full shadow-lg backdrop-blur-md border transition-all active:scale-95 ${
      isDarkMode ? "bg-gray-900/80 border-gray-700/60 text-white" : "bg-white/90 border-gray-200 text-gray-800"
    }`}
    style={{ animation: "btn-appear 150ms ease-out" }}
  >
    <span className={`flex items-center justify-center w-7 h-7 rounded-full ${isDarkMode ? "bg-gray-800" : "bg-gray-100"}`}>
      <ArrowLeft size={16} strokeWidth={2.5} />
    </span>
    <span className="text-sm font-semibold">Retour</span>
    <style>{`@keyframes btn-appear { from { opacity:0; transform:translateX(-8px); } to { opacity:1; transform:translateX(0); } }`}</style>
  </button>
));
FloatingBackButton.displayName = "FloatingBackButton";

// ============================================
// BADGE
// ============================================
const Badge = memo(({ count }) => {
  if (!count || count <= 0) return null;
  return (
    <span
      className="absolute -top-0.5 -right-0.5 flex items-center justify-center rounded-full text-white font-black border-2"
      style={{ minWidth: 17, height: 17, fontSize: 10, background: "linear-gradient(135deg, #f43f5e, #fb923c)", borderColor: "inherit", lineHeight: 1, padding: "0 3px" }}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
});
Badge.displayName = "Badge";

// ============================================
// NAVBAR MOBILE
// ============================================
const NavBtn = memo(({ icon: Icon, label, active, onClick, badge, isDarkMode }) => (
  <button
    onClick={onClick}
    className="relative flex flex-col items-center justify-center flex-1 gap-1 py-2 select-none active:scale-95 transition-transform"
    style={{ WebkitTapHighlightColor: "transparent" }}
  >
    <span className="relative">
      <Icon
        size={24}
        strokeWidth={active ? 2.5 : 1.8}
        fill={active ? "currentColor" : "none"}
        className={`transition-all duration-150 ${
          active
            ? "text-orange-500"
            : isDarkMode ? "text-gray-400" : "text-gray-500"
        }`}
      />
      <Badge count={badge} />
    </span>
    <span className={`text-[10px] font-semibold transition-colors duration-150 ${
      active ? "text-orange-500" : isDarkMode ? "text-gray-500" : "text-gray-400"
    }`}>
      {label}
    </span>
  </button>
));
NavBtn.displayName = "NavBtn";

const NavbarMobileMemo = memo(({ isDarkMode, isAdminUser, user, location, unreadCount, onHomeClick }) => {
  const navigate  = useNavigate();
  const [isMenuOpen, setMenuOpen] = useState(false);
  const isActive  = useCallback((path) => location.pathname === path, [location.pathname]);
  const goVideos  = useCallback(() => navigate("/videos"), [navigate]);
  const goChat    = useCallback(() => navigate("/chat"),   [navigate]);
  const openMenu  = useCallback(() => setMenuOpen(true),  []);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  return (
    <>
      <nav
        className={`lg:hidden flex justify-around items-stretch border-t ${isDarkMode ? "bg-gray-900/95 border-gray-800/80" : "bg-white/95 border-gray-100"}`}
        style={{ height: 64, backdropFilter: "blur(20px) saturate(180%)", WebkitBackdropFilter: "blur(20px) saturate(180%)", paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <NavBtn icon={Home}          label="Accueil" active={isActive("/")}       onClick={onHomeClick} isDarkMode={isDarkMode} />
        <NavBtn icon={Video}         label="Vidéos"  active={isActive("/videos")} onClick={goVideos}    isDarkMode={isDarkMode} />
        <NavBtn icon={MessageSquare} label="Chat"    active={isActive("/chat")}   onClick={goChat}      isDarkMode={isDarkMode} />
        <NavBtn icon={Menu}          label="Plus"    active={false}               onClick={openMenu}    badge={unreadCount} isDarkMode={isDarkMode} />
      </nav>
      {isMenuOpen && (
        <MenuOverlay user={user} isAdminUser={isAdminUser} isDarkMode={isDarkMode} onClose={closeMenu} unreadCount={unreadCount} />
      )}
    </>
  );
});
NavbarMobileMemo.displayName = "NavbarMobileMemo";

// ============================================
// SIDEBAR DESKTOP
// ============================================
const NavItemDesktop = memo(({ icon: Icon, label, onClick, isDarkMode, active, isAdmin, badge }) => (
  <button
    onClick={onClick}
    className={`group relative flex items-center gap-3.5 w-full px-3 py-3 rounded-xl transition-all duration-150 active:scale-[0.97] ${
      isDarkMode
        ? "hover:bg-gray-800/40"
        : "hover:bg-gray-50"
    } ${isAdmin ? "!text-rose-500 hover:!text-rose-400" : ""}`}
    style={{ WebkitTapHighlightColor: "transparent" }}
  >
    <span className="relative flex-shrink-0">
      <Icon
        size={24}
        strokeWidth={active ? 2.5 : 1.8}
        fill={active && !isAdmin ? "currentColor" : "none"}
        className={`transition-all duration-150 ${
          active
            ? isAdmin ? "text-rose-500" : "text-orange-500"
            : isAdmin ? "text-rose-500" : isDarkMode ? "text-gray-400" : "text-gray-500"
        }`}
      />
      {!!badge && badge > 0 && <Badge count={badge} />}
    </span>
    <span className={`text-[15px] transition-all duration-150 ${
      active
        ? isAdmin ? "font-bold text-rose-500" : "font-bold text-orange-500"
        : isDarkMode ? "font-normal text-gray-400" : "font-normal text-gray-600"
    }`}>{label}</span>
  </button>
));
NavItemDesktop.displayName = "NavItemDesktop";

const SidebarDesktopMemo = memo(({ isDarkMode, isAdminUser, unreadCount, onHomeClick }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isActive   = useCallback((path) => location.pathname === path, [location.pathname]);
  const goChat     = useCallback(() => navigate("/chat"),    [navigate]);
  const goVideos   = useCallback(() => navigate("/videos"),  [navigate]);
  const goCalculs  = useCallback(() => navigate("/calculs"), [navigate]);
  const goMessages = useCallback(() => navigate("/messages"),[navigate]);
  const goProfile  = useCallback(() => navigate(`/profile/${location.state?.userId || "me"}`), [navigate, location.state?.userId]);
  const goAdmin    = useCallback(() => navigate("/admin"),   [navigate]);

  return (
    <aside
      className={`hidden lg:flex fixed left-0 bottom-0 w-64 flex-col py-6 px-4 gap-1 z-30 border-r ${isDarkMode ? "bg-gray-900/60 border-gray-800/60" : "bg-white border-gray-100"}`}
      style={{ top: 72, backdropFilter: "blur(20px) saturate(180%)", WebkitBackdropFilter: "blur(20px) saturate(180%)" }}
    >
      <NavItemDesktop icon={Home}          label="Accueil"    onClick={onHomeClick} isDarkMode={isDarkMode} active={isActive("/")} />
      <NavItemDesktop icon={MessageSquare} label="Chat"       onClick={goChat}      isDarkMode={isDarkMode} active={isActive("/chat")} />
      <NavItemDesktop icon={Video}         label="Vidéos"     onClick={goVideos}    isDarkMode={isDarkMode} active={isActive("/videos")} />
      <NavItemDesktop icon={Calculator}    label="Calculs"    onClick={goCalculs}   isDarkMode={isDarkMode} active={isActive("/calculs")} />
      <NavItemDesktop icon={Mail}          label="Messagerie" onClick={goMessages}  isDarkMode={isDarkMode} active={isActive("/messages")} badge={unreadCount} />
      <NavItemDesktop icon={User}          label="Profil"     onClick={goProfile}   isDarkMode={isDarkMode} active={location.pathname.includes("/profile")} />
      {isAdminUser && (
        <>
          <div className={`w-full h-px my-3 ${isDarkMode ? "bg-gray-800" : "bg-gray-100"}`} />
          <NavItemDesktop icon={Shield} label="Admin" onClick={goAdmin} isDarkMode={isDarkMode} active={location.pathname.includes("/admin")} isAdmin />
        </>
      )}
    </aside>
  );
});
SidebarDesktopMemo.displayName = "SidebarDesktopMemo";

// ============================================
// MENU OVERLAY
// ============================================
const MenuOverlay = memo(({ user, isAdminUser, isDarkMode, onClose, unreadCount }) => {
  const navigate = useNavigate();
  const items = useMemo(() => {
    const base = [
      { label: "Profil",   icon: User,       path: `/profile/${user?._id}`, color: "#8b5cf6" },
      { label: "Calculs",  icon: Calculator, path: "/calculs",              color: "#06b6d4" },
      { label: "Messages", icon: Mail,       path: "/messages",             color: "#f97316", badge: unreadCount },
    ];
    if (isAdminUser) base.push({ label: "Admin", icon: Shield, path: "/admin", color: "#f43f5e" });
    return base;
  }, [user?._id, isAdminUser, unreadCount]);

  return (
    <div className="fixed inset-0 z-[110] flex items-end">
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ duration: 0.22, ease: [0.25, 1, 0.5, 1] }}
        className={`relative w-full rounded-t-3xl pb-8 px-6 pt-4 ${isDarkMode ? "bg-gray-900" : "bg-white"}`}
        style={{ boxShadow: "0 -12px 48px rgba(0,0,0,0.25)", paddingBottom: "calc(2rem + env(safe-area-inset-bottom))" }}
      >
        <div className={`mx-auto mb-5 rounded-full ${isDarkMode ? "bg-gray-700" : "bg-gray-200"}`} style={{ width: 36, height: 4 }} />
        <button
          onClick={onClose}
          className={`absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full ${isDarkMode ? "bg-gray-800 text-gray-400" : "bg-gray-100 text-gray-500"}`}
        >
          <X size={16} />
        </button>
        <p className={`text-xs font-bold uppercase tracking-widest mb-4 ${isDarkMode ? "text-gray-500" : "text-gray-400"}`}>Navigation</p>
        <div className="grid grid-cols-3 gap-3">
          {items.map((item) => (
            <button
              key={item.path}
              onClick={() => { navigate(item.path); onClose(); }}
              className={`relative flex flex-col items-center gap-2.5 py-4 px-2 rounded-2xl transition-all active:scale-95 ${isDarkMode ? "bg-gray-800/70 hover:bg-gray-800" : "bg-gray-50 hover:bg-gray-100"}`}
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              <span className="flex items-center justify-center w-11 h-11 rounded-2xl" style={{ background: `${item.color}18` }}>
                <item.icon size={22} style={{ color: item.color }} strokeWidth={1.8} />
              </span>
              <span className={`text-xs font-semibold ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>{item.label}</span>
              {!!item.badge && item.badge > 0 && (
                <span
                  className="absolute top-2 right-2 flex items-center justify-center rounded-full text-white font-black text-[10px] border-2"
                  style={{ minWidth: 18, height: 18, background: "linear-gradient(135deg, #f43f5e, #fb923c)", borderColor: isDarkMode ? "#1f2937" : "#fff", padding: "0 3px" }}
                >
                  {item.badge > 99 ? "99+" : item.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </motion.div>
    </div>
  );
});
MenuOverlay.displayName = "MenuOverlay";

// ============================================
// AUTH ROUTE
// ============================================
function AuthRoute({ children, redirectIfAuthenticated = false, authReady, isDarkMode }) {
  const { user } = useAuth();
  if (!authReady) return <PageSkeleton isDarkMode={isDarkMode} />;
  if (redirectIfAuthenticated && user) return <Navigate to="/" replace />;
  if (!redirectIfAuthenticated && !user) return <Navigate to="/auth" replace />;
  return children;
}