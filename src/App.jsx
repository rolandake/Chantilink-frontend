// ============================================
// 📁 src/App.jsx
// VERSION OPTIMISÉE LCP AVEC SPLASH REACT
// ============================================
import React, { useState, Suspense, useEffect, useMemo, useCallback, memo, useRef } from "react";
import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Home, MessageSquare, Video, Calculator, Mail, User, Menu, ArrowLeft, Shield
} from "lucide-react";

import LoadingSpinner from "./components/LoadingSpinner";
import SplashScreen from "./components/SplashScreen"; // ⭐ NOUVEAU
import { Header } from "./imports/importsComponents";
import { useAuth } from "./imports/importsContext";
import { useStories } from "./context/StoryContext";
import { useDarkMode } from "./context/DarkModeContext";
import { useMessagesData } from "./pages/Chat/hooks/useMessagesData";
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
// 🎯 HOOK POUR DÉTECTER LE SCROLL INTELLIGENT
// ============================================
function useSmartScroll(threshold = 10) {
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollY = useRef(0);
  const scrollDirection = useRef('up');
  const ticking = useRef(false);

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
          } 
          else if (scrollDiff < -threshold) {
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
  const [showSplash, setShowSplash] = useState(true); // ⭐ NOUVEAU
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
    
    const cleanupInterval = setInterval(() => {
      console.log('🧹 [App] Nettoyage périodique...');
      initializeStorage().catch(err => {
        console.error('❌ [App] Erreur nettoyage périodique:', err);
      });
    }, 30 * 60 * 1000);
    
    const fixVh = () => document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
    fixVh();
    window.addEventListener('resize', fixVh, { passive: true });
    
    if (authReady) {
      setReady(true);
    }
    
    return () => {
      window.removeEventListener('resize', fixVh);
      clearInterval(cleanupInterval);
    };
  }, [authReady]);

  // ⭐ AFFICHER LE SPLASH REACT PENDANT LE CHARGEMENT
  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  if (!ready) {
    return null;
  }
  
  return (
    <Suspense fallback={<div className="fixed inset-0 bg-gray-900" />}>
      <AppContent />
    </Suspense>
  );
}

function AppContent() {
  const { user } = useAuth();
  const { isDarkMode } = useDarkMode();
  const location = useLocation();
  const navigate = useNavigate();
  const { deleteSlide } = useStories();
  const [storyViewerOpen, setStoryViewerOpen] = useState(false);
  const [storyViewerData, setStoryViewerData] = useState({ stories: [], owner: null });

  const isNavVisible = useSmartScroll(10);

  const handleCloseStory = useCallback(() => setStoryViewerOpen(false), []);

  const isHome = location.pathname === "/";
  const isAuth = location.pathname === "/auth";
  const showNav = isHome && !isAuth && !storyViewerOpen;
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  const mainStyle = useMemo(() => ({
    top: showNav ? "72px" : "0",
    height: showNav ? "calc(100% - 72px)" : "100%",
    paddingBottom: "env(safe-area-inset-bottom)",
  }), [showNav]);

  return (
    <div className={`fixed inset-0 overflow-hidden ${isDarkMode ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-900"}`}>
      
      <AnimatePresence>
        {showNav && isNavVisible && (
          <motion.div 
            initial={{ y: -80 }} 
            animate={{ y: 0 }} 
            exit={{ y: -80 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="fixed top-0 left-0 right-0 z-40"
          >
            <Header />
          </motion.div>
        )}
      </AnimatePresence>

      {!isHome && !isAuth && !storyViewerOpen && (
        <FloatingBackButton isDarkMode={isDarkMode} onClick={() => navigate("/")} />
      )}

      {showNav && <SidebarDesktopMemo isDarkMode={isDarkMode} isAdminUser={isAdmin} />}

      <main className="absolute left-0 right-0 z-10 overflow-y-auto lg:left-0" style={mainStyle}>
        <div className="lg:ml-64 max-w-[630px] lg:max-w-none lg:px-8 mx-auto" key={location.pathname}>
          <Suspense fallback={<LoadingSpinner />}>
            <Routes location={location}>
              <Route path="/auth" element={<AuthRoute redirectIfAuthenticated><AuthPage /></AuthRoute>} />
              <Route path="/" element={<AuthRoute><HomePage openStoryViewer={(s, o) => { setStoryViewerData({stories: s, owner: o}); setStoryViewerOpen(true); }} /></AuthRoute>} />
              <Route path="/chat" element={<AuthRoute><ChatPage /></AuthRoute>} />
              <Route path="/videos" element={<AuthRoute><VideosPage /></AuthRoute>} />
              <Route path="/calculs" element={<AuthRoute><CalculsPage /></AuthRoute>} />
              <Route path="/messages" element={<AuthRoute><Messages /></AuthRoute>} />
              <Route path="/profile/:userId" element={<AuthRoute><Profile /></AuthRoute>} />
              <Route path="/admin/*" element={<AuthRoute><ProtectedAdminRoute><AdminDashboard /></ProtectedAdminRoute></AuthRoute>} />
              <Route path="*" element={<Navigate to={user ? "/" : "/auth"} replace />} />
            </Routes>
          </Suspense>
        </div>
      </main>

      <AnimatePresence>
        {showNav && isNavVisible && (
          <motion.div 
            initial={{ y: 100 }} 
            animate={{ y: 0 }} 
            exit={{ y: 100 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="fixed bottom-0 left-0 right-0 z-50"
          >
            <NavbarMobileMemo isDarkMode={isDarkMode} isAdminUser={isAdmin} user={user} location={location} />
          </motion.div>
        )}
      </AnimatePresence>
      
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
// NAVBAR MOBILE OPTIMISÉE
// ============================================
const NavbarMobileMemo = memo(({ isDarkMode, isAdminUser, user, location }) => {
  const navigate = useNavigate();
  const [isMenuOpen, setMenuOpen] = useState(false);
  const { token } = useAuth();
  
  const shouldLoadMessages = useMemo(() => {
    return ['/chat', '/messages'].includes(location.pathname);
  }, [location.pathname]);
  
  const { data } = useMessagesData(shouldLoadMessages ? token : null, null);
  
  const totalUnread = useMemo(() => {
    if (!data?.unread) return 0;
    return Object.values(data.unread).reduce((acc, count) => acc + count, 0);
  }, [data?.unread]);

  const isActive = useCallback((path) => location.pathname === path, [location.pathname]);

  return (
    <>
      <nav className={`lg:hidden h-16 flex justify-around items-center backdrop-blur-xl border-t ${isDarkMode ? "bg-gray-900/90 border-gray-800" : "bg-white/90 border-gray-200"}`}>
        <NavBtn icon={Home} label="Accueil" active={isActive("/")} onClick={() => navigate("/")} />
        <NavBtn icon={Video} label="Vidéos" active={isActive("/videos")} onClick={() => navigate("/videos")} />
        <NavBtn icon={MessageSquare} label="Chat" active={isActive("/chat")} onClick={() => navigate("/chat")} badge={totalUnread} />
        <NavBtn icon={Menu} label="Plus" onClick={() => setMenuOpen(true)} />
      </nav>
      {isMenuOpen && <MenuOverlay user={user} isAdminUser={isAdminUser} isDarkMode={isDarkMode} onClose={() => setMenuOpen(false)} />}
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
    {badge > 0 && (
      <span className="absolute top-0 right-4 bg-red-500 text-white text-[10px] font-black min-w-[18px] h-[18px] flex items-center justify-center rounded-full border-2 border-gray-900">
        {badge > 99 ? '99+' : badge}
      </span>
    )}
  </button>
));

const FloatingBackButton = memo(({ isDarkMode, onClick }) => (
  <motion.button 
    initial={{ scale: 0 }} 
    animate={{ scale: 1 }} 
    exit={{ scale: 0 }}
    transition={fastTransition}
    onClick={onClick} 
    className={`fixed top-4 left-4 z-[60] p-3 rounded-full shadow-xl backdrop-blur-md border ${isDarkMode ? "bg-gray-800/80 border-gray-700 text-white" : "bg-white/80 border-gray-200 text-gray-800"}`}
  >
    <ArrowLeft size={24} />
  </motion.button>
));

const SidebarDesktopMemo = memo(({ isDarkMode, isAdminUser }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isActive = useCallback((path) => location.pathname === path, [location.pathname]);
  
  return (
    <aside className={`hidden lg:flex fixed left-0 top-[72px] bottom-0 w-64 flex-col py-8 px-6 gap-2 z-30 border-r ${isDarkMode ? 'bg-gray-900/50 border-gray-800' : 'bg-white border-gray-100'}`}>
      <NavItemDesktop icon={Home} label="Accueil" onClick={() => navigate("/")} isDarkMode={isDarkMode} active={isActive("/")} />
      <NavItemDesktop icon={MessageSquare} label="Messages" onClick={() => navigate("/chat")} isDarkMode={isDarkMode} active={isActive("/chat")} />
      <NavItemDesktop icon={Video} label="Vidéos" onClick={() => navigate("/videos")} isDarkMode={isDarkMode} active={isActive("/videos")} />
      <NavItemDesktop icon={Calculator} label="Calculs" onClick={() => navigate("/calculs")} isDarkMode={isDarkMode} active={isActive("/calculs")} />
      <NavItemDesktop icon={Mail} label="Messagerie" onClick={() => navigate("/messages")} isDarkMode={isDarkMode} active={isActive("/messages")} />
      <NavItemDesktop icon={User} label="Profil" onClick={() => navigate(`/profile/${location.state?.userId || 'me'}`)} isDarkMode={isDarkMode} active={location.pathname.includes("/profile")} />
      {isAdminUser && (
        <>
          <div className={`w-full h-px my-4 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-200'}`} />
          <NavItemDesktop icon={Shield} label="Admin" onClick={() => navigate("/admin")} isDarkMode={isDarkMode} active={location.pathname.includes("/admin")} isAdmin />
        </>
      )}
    </aside>
  );
});

const NavItemDesktop = memo(({ icon: Icon, label, onClick, isDarkMode, active, isAdmin }) => (
  <button 
    onClick={onClick} 
    className={`group flex items-center gap-4 w-full px-4 py-3 rounded-xl transition-all ${
      active 
        ? (isDarkMode ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900')
        : (isDarkMode ? 'text-gray-400 hover:bg-gray-800/50 hover:text-white' : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900')
    } ${isAdmin ? 'text-red-500 hover:text-red-400' : ''}`}
  >
    <Icon size={26} strokeWidth={active ? 2.5 : 2} />
    <span className={`text-base ${active ? 'font-semibold' : 'font-normal'}`}>{label}</span>
  </button>
));

const MenuOverlay = memo(({ user, isAdminUser, isDarkMode, onClose }) => {
  const navigate = useNavigate();
  const items = useMemo(() => {
    const baseItems = [
      { label: "Profil", icon: User, path: `/profile/${user?._id}` },
      { label: "Messages", icon: Mail, path: "/messages" }, 
      { label: "Calculs", icon: Calculator, path: "/calculs" }
    ];
    if (isAdminUser) baseItems.push({ label: "Admin", icon: Shield, path: "/admin" });
    return baseItems;
  }, [user?._id, isAdminUser]);
  
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
        className={`w-full p-6 rounded-t-[40px] relative ${isDarkMode ? "bg-gray-900" : "bg-white shadow-2xl"}`}
      >
        <div className="w-12 h-1.5 bg-gray-600/30 mx-auto mb-6 rounded-full" />
        <div className="grid grid-cols-3 gap-4">
          {items.map(item => (
            <button 
              key={item.path} 
              onClick={() => { navigate(item.path); onClose(); }} 
              className="flex flex-col items-center gap-2 p-4 rounded-3xl bg-gray-500/5 active:scale-95 transition-transform"
            >
              <item.icon size={24} className={isDarkMode ? "text-orange-400" : "text-orange-500"} />
              <span className="text-xs font-medium">{item.label}</span>
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