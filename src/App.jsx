// 📁 src/App.jsx - NAVIGATION ULTRA-RAPIDE
// ✅ Fix: suppression animations nav (gain 300ms)
// ✅ Fix: useMessagesData centralisé (1 seul fetch au lieu de 3)
// ✅ Fix: suppression key={location.pathname} (stop remount des pages)
// ✅ Fix: navbar toggle via CSS visibility (pas AnimatePresence)
// ✅ Fix: clic sur "Accueil" quand déjà sur "/" → refresh du feed (comme Instagram)
// ✅ Fix LCP: window.__hideSplash() appelé dès que AppContent est monté
// 🔥 FIX COLD START: wake-up Render au démarrage de l'app
//
// 🔥 FIX CLS 0.56 :
//    - mainStyle utilise des valeurs CSS stables avec minHeight au lieu de height calculée
//    - FloatingBackButton retiré de l'AnimatePresence (scale 0→1 = layout shift)
//    - NavbarMobile et SidebarDesktop ont des dimensions réservées dès le premier paint
//    - LiveNotification : position fixed top-20 right-4 → ne génère plus de reflow
//
// 🔥 FIX INP 552ms :
//    - NavBtn : onClick wrappé dans useCallback stable (évite re-render inutile)
//    - MenuOverlay : React.memo + items mémorisés (évite recalcul à chaque keypress)
//    - handleHomeClick, handleCloseStory : useCallback (déjà en place, vérifiés)
//    - AnimatePresence retiré des badges (spring animation → layout thrashing)
//    - Badge : span statique avec opacity CSS au lieu de AnimatePresence/motion.span

import React, {
  useState, Suspense, useEffect, useMemo, useCallback, memo, useRef
} from "react";
import {
  Routes, Route, Navigate, useLocation, useNavigate
} from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home, MessageSquare, Video, Calculator, Mail, User, Menu, ArrowLeft, Shield, Bell
} from "lucide-react";

import LoadingSpinner    from "./components/LoadingSpinner";
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

const fastTransition = { duration: 0.15, ease: "easeOut" };

export const HOME_REFRESH_EVENT = "home:refresh";
export const emitHomeRefresh = () =>
  window.dispatchEvent(new CustomEvent(HOME_REFRESH_EVENT));

// ============================================
// SCROLL OPTIMISÉ
// ============================================
function useSmartScroll(threshold = 10) {
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollY     = useRef(0);
  const scrollDirection = useRef("up");
  const ticking         = useRef(false);

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
            if (scrollDirection.current !== "down") {
              scrollDirection.current = "down";
              setIsVisible(false);
            }
          } else if (scrollDiff < -threshold) {
            if (scrollDirection.current !== "up") {
              scrollDirection.current = "up";
              setIsVisible(true);
            }
          }

          lastScrollY.current = currentScrollY;
          ticking.current = false;
        });
        ticking.current = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [threshold]);

  return isVisible;
}

export default function App() {
  const [ready, setReady] = useState(false);
  const { ready: authReady } = useAuth();

  useEffect(() => {
    // 🔥 WAKE-UP Render
    fetch(`${BACKEND_URL}/api/health`, {
      method: "GET",
      signal: AbortSignal.timeout(20000),
    }).catch(() => {});

    const initApp = async () => {
      try {
        await setupIndexedDB().catch(() => console.warn("IDB init failed"));
        await initializeStorage().catch((err) => {
          console.error("❌ [App] Erreur init storage:", err);
        });
      } catch (err) {
        console.error("❌ [App] Erreur initialisation:", err);
      }
    };

    initApp();

    const fixVh = () =>
      document.documentElement.style.setProperty(
        "--vh",
        `${window.innerHeight * 0.01}px`
      );
    fixVh();
    window.addEventListener("resize", fixVh, { passive: true });

    if (authReady) setReady(true);

    return () => window.removeEventListener("resize", fixVh);
  }, [authReady]);

  if (!ready) return null;

  return (
    <Suspense fallback={null}>
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

  // ✅ FIX LCP
  useEffect(() => {
    if (typeof window.__hideSplash === "function") window.__hideSplash();
  }, []);

  // ✅ useMessagesData CENTRALISÉ
  const { data: messagesData } = useMessagesData(token, null);
  const unreadCount = useMemo(() => {
    if (!messagesData?.conversations) return undefined;
    return messagesData.conversations.reduce(
      (acc, conv) => acc + (conv.unreadCount || 0), 0
    );
  }, [messagesData?.conversations]);

  const [liveUnreadCount, setLiveUnreadCount] = useState(null);

  useEffect(() => {
    if (liveUnreadCount === null && unreadCount !== undefined) {
      setLiveUnreadCount(unreadCount);
    }
  }, [unreadCount, liveUnreadCount]);

  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = () => setLiveUnreadCount((prev) => (prev ?? 0) + 1);
    const handleMarkAsRead = (data) => {
      setLiveUnreadCount(typeof data?.unreadCount === "number" ? data.unreadCount : 0);
    };

    socket.on("receiveMessage", handleNewMessage);
    socket.on("messagesRead",   handleMarkAsRead);

    return () => {
      socket.off("receiveMessage", handleNewMessage);
      socket.off("messagesRead",   handleMarkAsRead);
    };
  }, [socket]);

  const unreadChannel = useRef(null);

  useEffect(() => {
    if (!("BroadcastChannel" in window)) return;
    unreadChannel.current = new BroadcastChannel("chantilink_unread");
    unreadChannel.current.onmessage = (event) => {
      if (typeof event.data === "number") setLiveUnreadCount(event.data);
    };
    return () => {
      unreadChannel.current?.close();
      unreadChannel.current = null;
    };
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
      if (notificationQueue.current.length === 0) return;

      const grouped = notificationQueue.current.reduce((acc, notif) => {
        if (!acc[notif.type]) acc[notif.type] = [];
        acc[notif.type].push(notif);
        return acc;
      }, {});

      Object.entries(grouped).forEach(([type, notifs]) => {
        const count   = notifs.length;
        const message = count > 1
          ? `${count} nouveaux ${type === "message" ? "messages" : "stories"}`
          : notifs[0].message;
        const notifId = Date.now() + Math.random();

        setLiveNotifications((prev) => [
          ...prev.slice(-4),
          { id: notifId, type, message, timestamp: Date.now() },
        ]);

        setTimeout(() => {
          setLiveNotifications((prev) => prev.filter((n) => n.id !== notifId));
        }, 5000);
      });

      notificationQueue.current = [];
    }, 300);
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (data) => {
      if (location.pathname === "/messages") return;
      addNotification({
        type:    "message",
        message: `${data.senderName || "Quelqu'un"} vous a envoyé un message`,
      });
    };

    const handleNewStory = (data) => {
      if (location.pathname === "/") return;
      addNotification({
        type:    "story",
        message: `${data.userName || "Quelqu'un"} a publié une story`,
      });
    };

    socket.on("new_message", handleNewMessage);
    socket.on("new_story",   handleNewStory);

    return () => {
      socket.off("new_message", handleNewMessage);
      socket.off("new_story",   handleNewStory);
      if (notificationTimer.current) clearTimeout(notificationTimer.current);
    };
  }, [socket, location.pathname, addNotification]);

  const handleCloseStory  = useCallback(() => setStoryViewerOpen(false), []);
  const handleHomeClick   = useCallback(() => {
    if (location.pathname === "/") emitHomeRefresh();
    else navigate("/");
  }, [location.pathname, navigate]);

  const isHome     = location.pathname === "/";
  const isAuth     = location.pathname === "/auth";
  const isMessages = location.pathname === "/messages";
  const showNav    = isHome && !isAuth && !storyViewerOpen;
  const isAdmin    = user?.role === "admin" || user?.role === "superadmin";

  // ✅ FIX SCROLL BLOQUÉ :
  // Le scroll était bloqué car minHeight ne contraint pas overflow-y-auto —
  // un élément scroll seulement si sa height est inférieure à son contenu.
  // Avec minHeight l'élément grandit avec le contenu → jamais de scrollbar.
  // Solution : top + bottom absolus → height implicite = fenêtre - navbars → scroll OK.
  // bottom réservé pour la navbar mobile (64px) uniquement sur home (showNav).
  const mainStyle = useMemo(() => ({
    top:                     showNav ? "72px" : "0",
    bottom:                  showNav ? "64px" : "0",
    overflowY:               "auto",
    overflowX:               "hidden",
    WebkitOverflowScrolling: "touch",
    paddingBottom:           "env(safe-area-inset-bottom)",
  }), [showNav]);

  return (
    <div
      className={`fixed inset-0 overflow-hidden ${
        isDarkMode ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-900"
      }`}
    >
      {/* ✅ FIX CLS : position fixed → les notifications ne poussent pas le layout */}
      <AnimatePresence>
        {liveNotifications.map((notif) => (
          <LiveNotification
            key={notif.id}
            notification={notif}
            isDarkMode={isDarkMode}
            onClose={() =>
              setLiveNotifications((prev) => prev.filter((n) => n.id !== notif.id))
            }
          />
        ))}
      </AnimatePresence>

      {showNav && (
        // ✅ FIX CLS : hauteur fixe 72px réservée → pas de reflow
        <div
          className="fixed top-0 left-0 right-0 z-40"
          style={{
            height:    72,
            transform: isNavVisible ? "translateY(0)" : "translateY(-100%)",
            // ✅ transition sur transform uniquement (composite layer)
            transition: "transform 200ms ease-out",
            willChange: "transform",
          }}
        >
          <Header />
        </div>
      )}

      {/* ✅ FIX CLS : FloatingBackButton retiré de AnimatePresence
          scale(0→1) sur un bouton fixed ne cause pas de CLS mais peut causer
          un repaint coûteux → on utilise opacity + transform à la place */}
      {!isHome && !isAuth && !storyViewerOpen && !isMessages && (
        <FloatingBackButton isDarkMode={isDarkMode} onClick={() => navigate("/")} />
      )}

      {showNav && (
        <SidebarDesktopMemo
          isDarkMode={isDarkMode}
          isAdminUser={isAdmin}
          unreadCount={safeUnread}
          onHomeClick={handleHomeClick}
        />
      )}

      <main className="absolute left-0 right-0 z-10 lg:left-0" style={mainStyle}>
        <div className="lg:ml-64 max-w-[630px] lg:max-w-none lg:px-8 mx-auto">
          <Suspense fallback={<LoadingSpinner />}>
            <Routes location={location}>
              <Route
                path="/auth"
                element={
                  <AuthRoute redirectIfAuthenticated>
                    <AuthPage />
                  </AuthRoute>
                }
              />
              <Route
                path="/"
                element={
                  <AuthRoute>
                    <HomePage
                      openStoryViewer={(s, o) => {
                        setStoryViewerData({ stories: s, owner: o });
                        setStoryViewerOpen(true);
                      }}
                    />
                  </AuthRoute>
                }
              />
              <Route path="/chat"            element={<AuthRoute><ChatPage /></AuthRoute>} />
              <Route path="/videos"          element={<AuthRoute><VideosPage /></AuthRoute>} />
              <Route path="/calculs"         element={<AuthRoute><CalculsPage /></AuthRoute>} />
              <Route path="/messages"        element={<AuthRoute><Messages /></AuthRoute>} />
              <Route path="/profile/:userId" element={<AuthRoute><Profile /></AuthRoute>} />
              <Route
                path="/admin/*"
                element={
                  <AuthRoute>
                    <ProtectedAdminRoute>
                      <AdminDashboard />
                    </ProtectedAdminRoute>
                  </AuthRoute>
                }
              />
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
// COMPOSANTS
// ============================================
const LiveNotification = memo(({ notification, isDarkMode, onClose }) => {
  // ✅ FIX INP : pas de setInterval pour la progress bar
  // On utilise une animation CSS pure → zéro JS dans la boucle de rendu
  return (
    <motion.div
      initial={{ opacity: 0, y: -20, x: 100 }}
      animate={{ opacity: 1, y: 0, x: 0 }}
      exit={{ opacity: 0, x: 100 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      // ✅ FIX CLS : fixed + top/right explicites, pas de bottom qui push le contenu
      className="fixed top-20 right-4 z-[100] max-w-sm"
      onClick={onClose}
    >
      <div
        className={`relative flex items-start gap-3 px-4 py-3 rounded-2xl shadow-2xl backdrop-blur-xl border cursor-pointer overflow-hidden ${
          isDarkMode
            ? "bg-gray-800/95 border-gray-700"
            : "bg-white/95 border-gray-200"
        }`}
      >
        <div
          className={`flex-shrink-0 p-2 rounded-full ${
            notification.type === "message"
              ? "bg-orange-500/20 text-orange-500"
              : "bg-blue-500/20 text-blue-500"
          }`}
        >
          {notification.type === "message" ? (
            <MessageSquare size={18} />
          ) : (
            <Bell size={18} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${isDarkMode ? "text-white" : "text-gray-900"}`}>
            {notification.message}
          </p>
          <p className={`text-xs mt-0.5 ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
            À l'instant
          </p>
        </div>
        {/* ✅ FIX INP : progress bar CSS pure — aucun setInterval, aucun setState */}
        <div
          className="absolute bottom-0 left-0 right-0 h-1 bg-orange-500 origin-left rounded-b-2xl"
          style={{ animation: "notif-progress 5s linear forwards" }}
        />
        <style>{`
          @keyframes notif-progress {
            from { transform: scaleX(1); }
            to   { transform: scaleX(0); }
          }
        `}</style>
      </div>
    </motion.div>
  );
});
LiveNotification.displayName = "LiveNotification";

// ✅ FIX INP : NavBtn stable — pas de recréation de fonction à chaque render parent
const NavBtn = memo(({ icon: Icon, label, active, onClick, badge }) => (
  <button
    onClick={onClick}
    className={`relative flex flex-col items-center flex-1 py-2 transition-colors ${
      active ? "text-orange-500" : "text-gray-400"
    }`}
  >
    <Icon size={20} />
    <span className="text-[10px] font-bold mt-1">{label}</span>
    {/* ✅ FIX INP : badge statique avec opacity CSS — pas d'AnimatePresence/spring
        AnimatePresence + spring sur chaque clic = layout thrashing */}
    {!!badge && badge > 0 && (
      <span
        className="absolute top-0 right-4 bg-red-500 text-white text-[10px] font-black min-w-[18px] h-[18px] flex items-center justify-center rounded-full border-2 border-gray-900 shadow-lg"
        style={{ transition: "opacity 150ms" }}
      >
        {badge > 99 ? "99+" : badge}
      </span>
    )}
  </button>
));
NavBtn.displayName = "NavBtn";

// ✅ FIX CLS : FloatingBackButton avec opacity+transform au lieu de scale 0→1
const FloatingBackButton = memo(({ isDarkMode, onClick }) => (
  <button
    onClick={onClick}
    className={`fixed top-4 left-4 z-[60] p-3 rounded-full shadow-xl backdrop-blur-md border ${
      isDarkMode
        ? "bg-gray-800/80 border-gray-700 text-white"
        : "bg-white/80 border-gray-200 text-gray-800"
    }`}
    style={{
      // ✅ pas de scale 0→1 qui cause un repaint
      animation: "btn-appear 150ms ease-out",
    }}
  >
    <ArrowLeft size={24} />
    <style>{`
      @keyframes btn-appear {
        from { opacity: 0; transform: translateX(-8px); }
        to   { opacity: 1; transform: translateX(0); }
      }
    `}</style>
  </button>
));
FloatingBackButton.displayName = "FloatingBackButton";

const NavbarMobileMemo = memo(
  ({ isDarkMode, isAdminUser, user, location, unreadCount, onHomeClick }) => {
    const navigate = useNavigate();
    const [isMenuOpen, setMenuOpen] = useState(false);
    const isActive = useCallback(
      (path) => location.pathname === path,
      [location.pathname]
    );

    // ✅ FIX INP : handlers stables avec useCallback
    const goVideos   = useCallback(() => navigate("/videos"), [navigate]);
    const goChat     = useCallback(() => navigate("/chat"),   [navigate]);
    const openMenu   = useCallback(() => setMenuOpen(true),   []);
    const closeMenu  = useCallback(() => setMenuOpen(false),  []);

    return (
      <>
        {/* ✅ FIX CLS : hauteur fixe 64px réservée → pas de reflow */}
        <nav
          className={`lg:hidden flex justify-around items-center backdrop-blur-xl border-t ${
            isDarkMode
              ? "bg-gray-900/90 border-gray-800"
              : "bg-white/90 border-gray-200"
          }`}
          style={{ height: 64 }}
        >
          <NavBtn icon={Home}          label="Accueil" active={isActive("/")}       onClick={onHomeClick} />
          <NavBtn icon={Video}         label="Vidéos"  active={isActive("/videos")} onClick={goVideos} />
          <NavBtn icon={MessageSquare} label="Chat"    active={isActive("/chat")}   onClick={goChat} />
          <NavBtn icon={Menu}          label="Plus"    onClick={openMenu}           badge={unreadCount} />
        </nav>
        {isMenuOpen && (
          <MenuOverlay
            user={user}
            isAdminUser={isAdminUser}
            isDarkMode={isDarkMode}
            onClose={closeMenu}
            unreadCount={unreadCount}
          />
        )}
      </>
    );
  }
);
NavbarMobileMemo.displayName = "NavbarMobileMemo";

const SidebarDesktopMemo = memo(
  ({ isDarkMode, isAdminUser, unreadCount, onHomeClick }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const isActive = useCallback(
      (path) => location.pathname === path,
      [location.pathname]
    );

    // ✅ FIX INP : handlers stables
    const goChat    = useCallback(() => navigate("/chat"),    [navigate]);
    const goVideos  = useCallback(() => navigate("/videos"),  [navigate]);
    const goCalculs = useCallback(() => navigate("/calculs"), [navigate]);
    const goMessages = useCallback(() => navigate("/messages"), [navigate]);
    const goProfile = useCallback(
      () => navigate(`/profile/${location.state?.userId || "me"}`),
      [navigate, location.state?.userId]
    );
    const goAdmin   = useCallback(() => navigate("/admin"),   [navigate]);

    return (
      <aside
        className={`hidden lg:flex fixed left-0 bottom-0 w-64 flex-col py-8 px-6 gap-2 z-30 border-r ${
          isDarkMode ? "bg-gray-900/50 border-gray-800" : "bg-white border-gray-100"
        }`}
        // ✅ FIX CLS : top fixe à 72px (hauteur du Header)
        style={{ top: 72 }}
      >
        <NavItemDesktop icon={Home}          label="Accueil"    onClick={onHomeClick} isDarkMode={isDarkMode} active={isActive("/")} />
        <NavItemDesktop icon={MessageSquare} label="Chat"       onClick={goChat}      isDarkMode={isDarkMode} active={isActive("/chat")} />
        <NavItemDesktop icon={Video}         label="Vidéos"     onClick={goVideos}    isDarkMode={isDarkMode} active={isActive("/videos")} />
        <NavItemDesktop icon={Calculator}    label="Calculs"    onClick={goCalculs}   isDarkMode={isDarkMode} active={isActive("/calculs")} />
        <NavItemDesktop icon={Mail}          label="Messagerie" onClick={goMessages}  isDarkMode={isDarkMode} active={isActive("/messages")} badge={unreadCount} />
        <NavItemDesktop icon={User}          label="Profil"     onClick={goProfile}   isDarkMode={isDarkMode} active={location.pathname.includes("/profile")} />
        {isAdminUser && (
          <>
            <div className={`w-full h-px my-4 ${isDarkMode ? "bg-gray-800" : "bg-gray-200"}`} />
            <NavItemDesktop icon={Shield} label="Admin" onClick={goAdmin} isDarkMode={isDarkMode} active={location.pathname.includes("/admin")} isAdmin />
          </>
        )}
      </aside>
    );
  }
);
SidebarDesktopMemo.displayName = "SidebarDesktopMemo";

// ✅ FIX INP : badge statique (pas d'AnimatePresence)
const NavItemDesktop = memo(
  ({ icon: Icon, label, onClick, isDarkMode, active, isAdmin, badge }) => (
    <button
      onClick={onClick}
      className={`group relative flex items-center gap-4 w-full px-4 py-3 rounded-xl transition-colors ${
        active
          ? isDarkMode ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-900"
          : isDarkMode ? "text-gray-400 hover:bg-gray-800/50 hover:text-white"
                       : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
      } ${isAdmin ? "text-red-500 hover:text-red-400" : ""}`}
    >
      <Icon size={26} strokeWidth={active ? 2.5 : 2} />
      <span className={`text-base ${active ? "font-semibold" : "font-normal"}`}>
        {label}
      </span>
      {!!badge && badge > 0 && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 bg-red-500 text-white text-xs font-bold min-w-[20px] h-[20px] flex items-center justify-center rounded-full">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </button>
  )
);
NavItemDesktop.displayName = "NavItemDesktop";

const MenuOverlay = memo(
  ({ user, isAdminUser, isDarkMode, onClose, unreadCount }) => {
    const navigate = useNavigate();

    const items = useMemo(() => {
      const baseItems = [
        { label: "Profil",   icon: User,       path: `/profile/${user?._id}` },
        { label: "Calculs",  icon: Calculator, path: "/calculs" },
        { label: "Messages", icon: Mail,       path: "/messages", badge: unreadCount },
      ];
      if (isAdminUser) baseItems.push({ label: "Admin", icon: Shield, path: "/admin" });
      return baseItems;
    }, [user?._id, isAdminUser, unreadCount]);

    return (
      <div className="fixed inset-0 z-[110] flex items-end">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={fastTransition}
          className="absolute inset-0 bg-black/60"
          onClick={onClose}
        />
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={fastTransition}
          className={`w-full p-6 rounded-t-[40px] relative ${
            isDarkMode ? "bg-gray-900" : "bg-white shadow-2xl"
          }`}
        >
          <div className="w-12 h-1.5 bg-gray-600/30 mx-auto mb-6 rounded-full" />
          <div className="grid grid-cols-3 gap-4">
            {items.map((item) => (
              <button
                key={item.path}
                onClick={() => { navigate(item.path); onClose(); }}
                className="relative flex flex-col items-center gap-2 p-4 rounded-3xl bg-gray-500/5 active:scale-95 transition-transform"
              >
                <item.icon
                  size={24}
                  className={isDarkMode ? "text-orange-400" : "text-orange-500"}
                />
                <span className="text-xs font-medium">{item.label}</span>
                {!!item.badge && item.badge > 0 && (
                  <span className="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold min-w-[20px] h-[20px] flex items-center justify-center rounded-full">
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </motion.div>
      </div>
    );
  }
);
MenuOverlay.displayName = "MenuOverlay";

function AuthRoute({ children, redirectIfAuthenticated = false }) {
  const { user, ready } = useAuth();
  if (!ready) return null;
  if (redirectIfAuthenticated && user) return <Navigate to="/" replace />;
  if (!redirectIfAuthenticated && !user) return <Navigate to="/auth" replace />;
  return children;
}