// ==========================================
// 📁 src/App.jsx - VERSION CORRIGÉE (ROUTING PROFIL)
// ==========================================
import React, { useState, Suspense, useEffect, useMemo, useCallback, memo } from "react";
import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Home, MessageSquare, Video, Calculator, Mail, User, Eye, Menu, X, Shield, Crown, ArrowLeft 
} from "lucide-react";

import LoadingSpinner from "./components/LoadingSpinner";
import { Header, SplashScreen } from "./imports/importsComponents";
import { useAuth } from "./imports/importsContext";
import { useStories } from "./context/StoryContext";
import { useDarkMode } from "./context/DarkModeContext";
import ProtectedAdminRoute from "./components/ProtectedAdminRoute";
import { setupIndexedDB } from "./utils/idbMigration";

// PAGES
import { 
  Home as HomePage, 
  Profile, 
  ChatPage, 
  VideosPage, 
  CalculsPage, 
  Messages, 
  VisionPage, 
  AuthPage 
} from "./imports/importsPages.js";
import AdminDashboard from "./pages/Admin/AdminDashboard.jsx";
import StoryViewer from "./pages/Home/StoryViewer";
import PremiumPage from "./pages/Premium/Premium";

export default function App() {
  const [idbReady, setIdbReady] = useState(false);

  useEffect(() => {
    setupIndexedDB().then(() => setIdbReady(true)).catch(() => setIdbReady(true));
  }, []);

  useEffect(() => {
    const meta = document.querySelector('meta[name="viewport"]');
    if (meta) {
      meta.setAttribute("content", "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover");
    }
    document.body.style.cssText = 'overflow:hidden; position:fixed; width:100%; height:100%; margin:0; padding:0; -webkit-font-smoothing: antialiased;';
    return () => { document.body.style.cssText = ''; };
  }, []);

  if (!idbReady) return <LoadingSpinner fullScreen />;

  return (
    <Suspense fallback={<LoadingSpinner fullScreen />}>
      <AppContent />
    </Suspense>
  );
}

function AppContent() {
  const { user, ready } = useAuth();
  const { isDarkMode } = useDarkMode();
  const location = useLocation();
  const navigate = useNavigate();
  const { deleteSlide } = useStories();
  const [isSplashVisible, setSplashVisible] = useState(true);

  // État Story
  const [storyViewerOpen, setStoryViewerOpen] = useState(false);
  const [storyViewerData, setStoryViewerData] = useState({ stories: [], owner: null });

  // Optimisation des calculs de route
  const { isHomePage, isAuthPage, showNavigation, isAdminUser } = useMemo(() => {
    const isHome = location.pathname === "/";
    const isAuth = location.pathname === "/auth";
    return {
      isHomePage: isHome,
      isAuthPage: isAuth,
      showNavigation: isHome && !isAuth && !storyViewerOpen,
      isAdminUser: user?.role === 'admin' || user?.role === 'superadmin'
    };
  }, [location.pathname, storyViewerOpen, user?.role]);

  // Callbacks
  const openStoryViewer = useCallback((stories, owner) => {
    setStoryViewerData({ stories, owner });
    setStoryViewerOpen(true);
  }, []);

  const closeStoryViewer = useCallback(() => {
    setStoryViewerOpen(false);
    setTimeout(() => setStoryViewerData({ stories: [], owner: null }), 300);
  }, []);

  const handleDeleteSlide = useCallback(async (storyId, slideIndex) => {
    try {
      await deleteSlide(storyId, slideIndex);
      setStoryViewerData(prev => {
          const updatedStories = prev.stories.map(s => s._id === storyId ? {...s, slides: s.slides.filter((_, i) => i !== slideIndex)} : s).filter(s => s.slides.length > 0);
          if (updatedStories.length === 0) { setTimeout(closeStoryViewer, 0); return prev; }
          return { ...prev, stories: updatedStories };
      });
    } catch (error) { console.error(error); }
  }, [deleteSlide, closeStoryViewer]);

  const mainStyle = useMemo(() => ({
    top: showNavigation ? 72 : 0,
    bottom: showNavigation ? 0 : 0,
    paddingBottom: showNavigation ? "calc(env(safe-area-inset-bottom, 0px) + 5rem)" : "0",
    willChange: "transform, opacity"
  }), [showNavigation]);

  if (!ready) return <LoadingSpinner fullScreen />;
  if (isSplashVisible) return <SplashScreen onFinish={() => setSplashVisible(false)} />;

  return (
    <div className={`fixed inset-0 overflow-hidden ${isDarkMode ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-900"} transition-colors duration-300`}>
      <BackgroundParticlesMemo isDarkMode={isDarkMode} />

      {/* HEADER */}
      <AnimatePresence>
        {showNavigation && (
          <motion.div 
            initial={{ y: -100, opacity: 0 }} 
            animate={{ y: 0, opacity: 1 }} 
            exit={{ y: -100, opacity: 0 }} 
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="z-30 relative"
          >
             <Header />
          </motion.div>
        )}
      </AnimatePresence>

      {/* BOUTON RETOUR FLOTTANT */}
      <AnimatePresence>
        {!isHomePage && !isAuthPage && !storyViewerOpen && (
          <FloatingBackButton isDarkMode={isDarkMode} onClick={() => navigate("/")} />
        )}
      </AnimatePresence>

      {/* SIDEBAR DESKTOP */}
      {showNavigation && <SidebarDesktopMemo isDarkMode={isDarkMode} isAdminUser={isAdminUser} />}

      {/* MAIN CONTENT */}
      <main
        className="absolute left-0 right-0 z-10 overflow-y-auto scroll-smooth scrollbar-thin scrollbar-thumb-orange-500"
        style={mainStyle}
      >
        <AnimatePresence mode="wait" initial={false}>
          <PageTransition key={location.pathname}>
            <Routes location={location}>
              <Route path="/auth" element={<AuthRoute redirectIfAuthenticated><AuthPage /></AuthRoute>} />
              <Route path="/" element={<AuthRoute><HomePage openStoryViewer={openStoryViewer} /></AuthRoute>} />
              <Route path="/chat" element={<AuthRoute><ChatPage /></AuthRoute>} />
              <Route path="/videos" element={<AuthRoute><VideosPage /></AuthRoute>} />
              <Route path="/vision" element={<AuthRoute><VisionPage /></AuthRoute>} />
              <Route path="/calculs" element={<AuthRoute><CalculsPage /></AuthRoute>} />
              <Route path="/messages" element={<AuthRoute><Messages /></AuthRoute>} />
              <Route path="/profile/:userId" element={<AuthRoute><Profile /></AuthRoute>} />
              <Route path="/premium" element={<AuthRoute><PremiumPage /></AuthRoute>} />
              <Route path="/admin/*" element={<AuthRoute><ProtectedAdminRoute><AdminDashboard /></ProtectedAdminRoute></AuthRoute>} />
              <Route path="*" element={<Navigate to={user ? "/" : "/auth"} replace />} />
            </Routes>
          </PageTransition>
        </AnimatePresence>
      </main>

      {/* NAVBAR MOBILE */}
      <AnimatePresence>
        {showNavigation && (
          <motion.div 
            initial={{ y: 100 }} 
            animate={{ y: 0 }} 
            exit={{ y: 100 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="z-50 relative"
          >
             {/* ✅ CORRECTION : Passage de 'user' à la navbar */}
             <NavbarMobileMemo isDarkMode={isDarkMode} isAdminUser={isAdminUser} user={user} />
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* STORY VIEWER */}
      <AnimatePresence>
        {storyViewerOpen && storyViewerData.stories.length > 0 && (
          <StoryViewer 
            stories={storyViewerData.stories}
            currentUser={user}
            onClose={closeStoryViewer}
            onDelete={handleDeleteSlide}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// --- SOUS-COMPOSANTS OPTIMISÉS ---

const FloatingBackButton = memo(({ isDarkMode, onClick }) => (
  <motion.button
    initial={{ opacity: 0, x: -15 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: -15 }}
    transition={{ duration: 0.2 }}
    onClick={onClick}
    className={`fixed top-3 left-3 z-50 p-2 rounded-full shadow-lg backdrop-blur-md border active:scale-90 transition-transform flex items-center justify-center
      ${isDarkMode 
        ? "bg-black/50 border-gray-700 text-white" 
        : "bg-white/70 border-gray-200 text-gray-800"}`}
    style={{ marginTop: 'env(safe-area-inset-top)' }}
  >
    <ArrowLeft size={22} strokeWidth={2.5} />
  </motion.button>
));

const PageTransition = ({ children }) => {
  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }} 
      transition={{ duration: 0.15, ease: "linear" }}
      className="min-h-full w-full"
      style={{ willChange: "opacity" }}
    >
      {children}
    </motion.div>
  );
};

const BackgroundParticlesMemo = memo(({ isDarkMode }) => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
    <div 
      className="absolute inset-0 transition-colors duration-700" 
      style={{ background: isDarkMode ? 'linear-gradient(to bottom, #050505, #0a0a0a)' : 'linear-gradient(to bottom, #ffffff, #f7f7f7)' }} 
    />
  </div>
));

const SidebarDesktopMemo = memo(function SidebarDesktop({ isDarkMode, isAdminUser }) {
  const navigate = useNavigate();
  const navItems = [
    { path: "/", icon: Home, label: "Accueil" },
    { path: "/chat", icon: MessageSquare, label: "Chat" },
    { path: "/videos", icon: Video, label: "Vidéos" },
    { path: "/vision", icon: Eye, label: "Vision" },
    { path: "/calculs", icon: Calculator, label: "Calculs" },
    { path: "/messages", icon: Mail, label: "Messages" },
    { path: "/premium", icon: Crown, label: "ÉLITE", premium: true },
  ];
  if (isAdminUser) navItems.push({ path: "/admin", icon: Shield, label: "Admin", adminOnly: true });

  return (
    <aside className={`hidden sm:flex fixed left-0 top-[72px] bottom-0 w-24 flex-col items-center py-6 gap-4 z-20 ${isDarkMode ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'} border-r shadow-xl`}>
      {navItems.map(({ path, icon: Icon, label, premium, adminOnly }) => (
        <motion.button key={path} onClick={() => navigate(path)} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          className={`flex flex-col items-center gap-2 p-3 rounded-2xl relative transition-colors w-16 h-16 justify-center ${isDarkMode ? "text-gray-400 hover:bg-gray-800" : "text-gray-600 hover:bg-gray-100"}`}
          title={label}>
          <Icon size={24} />
          <span className="text-xs hidden lg:block font-medium">{label}</span>
          {premium && <Crown className="absolute -top-1 -right-1 w-4 h-4 text-yellow-400" />}
          {adminOnly && <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full" />}
        </motion.button>
      ))}
    </aside>
  );
});

// ✅ CORRECTION : Ajout de la prop 'user'
const NavbarMobileMemo = memo(function NavbarMobile({ isDarkMode, isAdminUser, user }) {
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navItems = [
    { path: "/chat", icon: MessageSquare, label: "Chat" },
    { path: "/videos", icon: Video, label: "Vidéos" },
    { path: "/premium", icon: Crown, label: "ÉLITE", premium: true },
    { path: "/vision", icon: Eye, label: "Vision" },
  ];

  return (
    <>
      <AnimatePresence>
        {isMenuOpen && (
          // ✅ CORRECTION : Passage de 'user' au MenuOverlay
          <MenuOverlay isDarkMode={isDarkMode} isAdminUser={isAdminUser} user={user} onClose={() => setIsMenuOpen(false)} />
        )}
      </AnimatePresence>

      <nav className={`sm:hidden fixed bottom-0 left-0 right-0 backdrop-blur-xl border-t z-50 pb-safe transition-colors duration-300 ${isDarkMode ? "bg-gray-900/95 border-gray-700" : "bg-white/95 border-gray-200"}`}>
        <div className="flex justify-around items-center h-16 px-1">
          <div className="flex flex-col items-center gap-1 px-3 py-1 rounded-xl text-orange-500">
            <Home size={24} strokeWidth={2.5} />
            <span className="text-[10px] font-bold">Accueil</span>
            <div className="absolute -bottom-1 w-1 h-1 bg-orange-500 rounded-full" />
          </div>

          {navItems.map(({ path, icon: Icon, label, premium }) => (
            <button key={path} onClick={() => navigate(path)} className={`flex flex-col items-center gap-1 px-3 py-1 rounded-xl relative active:scale-90 transition-transform ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
              <Icon size={22} strokeWidth={2} />
              <span className="text-[10px] font-medium">{label}</span>
              {premium && <Crown className="absolute top-0 right-1 w-2.5 h-2.5 text-yellow-400" />}
            </button>
          ))}
          
          <button onClick={() => setIsMenuOpen(true)} className={`flex flex-col items-center gap-1 px-3 py-1 rounded-xl active:scale-90 transition-transform ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
            <Menu size={22} />
            <span className="text-[10px] font-medium">Plus</span>
          </button>
        </div>
      </nav>
    </>
  );
});

// ✅ CORRECTION : Ajout de la prop 'user' et correction du lien
const MenuOverlay = ({ isDarkMode, isAdminUser, user, onClose }) => {
  const navigate = useNavigate();
  const moreItems = [
    { path: "/calculs", icon: Calculator, label: "Calculs" },
    { path: "/messages", icon: Mail, label: "Messages" },
    // ✅ CORRECTION : Lien dynamique avec user._id
    { path: `/profile/${user?._id}`, icon: User, label: "Profil" },
    ...(isAdminUser ? [{ path: "/admin", icon: Shield, label: "Admin", adminOnly: true }] : [])
  ];

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="sm:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]" />
      <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 300 }} className={`sm:hidden fixed bottom-20 left-4 right-4 rounded-3xl shadow-2xl z-[70] border border-orange-500/30 ${isDarkMode ? 'bg-gray-900' : 'bg-white'} p-6`}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold bg-gradient-to-r from-orange-500 to-pink-500 bg-clip-text text-transparent">Menu</h3>
          <button onClick={onClose} className="p-2 rounded-full bg-gray-100/10"><X className="w-5 h-5" /></button>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {moreItems.map(({ path, icon: Icon, label, adminOnly }) => (
            <button key={path} onClick={() => { navigate(path); onClose(); }} className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl relative active:scale-95 transition-transform ${isDarkMode ? "bg-gray-800 text-gray-300" : "bg-gray-100 text-gray-700"}`}>
              <Icon size={20} />
              <span className="font-medium text-xs">{label}</span>
              {adminOnly && <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>}
            </button>
          ))}
        </div>
      </motion.div>
    </>
  );
};

function AuthRoute({ children, redirectIfAuthenticated = false }) {
  const { user, ready } = useAuth();
  if (!ready) return <LoadingSpinner fullScreen />;
  if (redirectIfAuthenticated && user) return <Navigate to="/" replace />;
  if (!redirectIfAuthenticated && !user) return <Navigate to="/auth" replace />;
  return children;
}