// src/App.jsx - VERSION CORRIGÉE (pas de BrowserRouter ici)
import React, { useState, Suspense, useEffect, useMemo, useCallback } from "react";
import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Home, MessageSquare, Video, Calculator, Mail, User, Eye, Menu, X, Shield, Crown } from "lucide-react";

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

// ⚠️ PAS DE BrowserRouter ICI - il est dans main.jsx
export default function App() {
  const [idbReady, setIdbReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        await setupIndexedDB();
        setIdbReady(true);
      } catch {
        setIdbReady(true);
      }
    })();
  }, []);

  // === PWA: Viewport + Fullscreen + Safe Area ===
  useEffect(() => {
    const meta = document.querySelector('meta[name="viewport"]');
    if (meta) meta.setAttribute("content", "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no");
    document.documentElement.style.height = '100%';
    document.body.style.cssText = 'overflow:hidden; position:fixed; width:100%; height:100%; margin:0; padding:0;';
    return () => { document.body.style.cssText = ''; };
  }, []);

  if (!idbReady) return <LoadingSpinner fullScreen message="Initialisation..." />;

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
  const { deleteSlide } = useStories();
  const [isSplashVisible, setSplashVisible] = useState(true);

  // === STORY VIEWER ===
  const [storyViewerOpen, setStoryViewerOpen] = useState(false);
  const [storyViewerData, setStoryViewerData] = useState({ stories: [], owner: null });

  const keyboardRoutes = useMemo(() => ["/chat", "/messages", "/videos"], []);
  const isKeyboardSensitive = keyboardRoutes.includes(location.pathname);
  const isVideosPage = location.pathname === "/videos";
  const isAdminPage = location.pathname === "/admin";
  const isMessagesPage = location.pathname === "/messages";
  const isAdminUser = user?.role === 'admin' || user?.role === 'superadmin';

  // 🔥 ROUTES IMMERSIVES (sans navigation)
  const isImmersiveRoute = isMessagesPage || isVideosPage || isAdminPage;

  const openStoryViewer = useCallback((stories, owner) => {
    setStoryViewerData({ stories, owner });
    setStoryViewerOpen(true);
  }, []);

  const closeStoryViewer = useCallback(() => {
    setStoryViewerOpen(false);
    setTimeout(() => setStoryViewerData({ stories: [], owner: null }), 300);
  }, []);

  const handleDeleteSlide = async (storyId, slideIndex) => {
    try {
      await deleteSlide(storyId, slideIndex);
      const updatedStories = storyViewerData.stories.map(story => {
        if (story._id === storyId) {
          return {
            ...story,
            slides: story.slides.filter((_, idx) => idx !== slideIndex)
          };
        }
        return story;
      }).filter(story => story.slides.length > 0);
      
      if (updatedStories.length === 0) {
        closeStoryViewer();
      } else {
        setStoryViewerData({ ...storyViewerData, stories: updatedStories });
      }
    } catch (error) {
      console.error("Erreur suppression slide:", error);
    }
  };

  if (!ready) return <LoadingSpinner fullScreen message="Connexion..." />;
  if (isSplashVisible) return <SplashScreen onFinish={() => setSplashVisible(false)} />;

  return (
    <div className="fixed inset-0 overflow-hidden bg-gray-50 dark:bg-gray-900">
      <BackgroundParticles isDarkMode={isDarkMode} />

      {/* === HEADER UNIQUEMENT SUR HOME (pas sur routes immersives) === */}
      {!isImmersiveRoute && location.pathname === "/" && (
        <motion.div 
          initial={{ y: -100 }} 
          animate={{ y: 0 }} 
          className="relative z-50"
        >
          <Header />
        </motion.div>
      )}

      {/* === SIDEBAR DESKTOP (masqué sur routes immersives) === */}
      {!isImmersiveRoute && <SidebarDesktop isDarkMode={isDarkMode} isVideosPage={isVideosPage} isAdminUser={isAdminUser} />}

      {/* === MAIN CONTENT === */}
      <main
        className={`
          absolute left-0 right-0 z-10 overflow-y-auto scroll-smooth
          scrollbar-thin scrollbar-thumb-orange-500
          ${isImmersiveRoute ? "top-0 bottom-0" : isVideosPage ? "top-0 pb-20" : "top-[72px] sm:ml-24 lg:ml-28"}
          ${!isVideosPage && !isImmersiveRoute && "sm:bottom-0"}
        `}
        style={{
          paddingBottom: isKeyboardSensitive && !isImmersiveRoute ? "calc(env(safe-area-inset-bottom, 0px) + 5rem)" : "1rem",
          maxHeight: isImmersiveRoute || isVideosPage ? "100vh" : "calc(100vh - 72px)",
        }}
      >
        <AnimatePresence mode="wait">
          <PageTransition key={location.pathname}>
            <Routes location={location}>
              <Route path="/auth" element={<AuthRoute redirectIfAuthenticated><AuthPage /></AuthRoute>} />
              <Route path="/" element={<AuthRoute><HomePage openStoryViewer={openStoryViewer} /></AuthRoute>} />
              <Route path="/chat" element={<AuthRoute><ChatPage /></AuthRoute>} />
              <Route path="/videos" element={<AuthRoute><VideosPage /></AuthRoute>} />
              <Route path="/vision" element={<AuthRoute><VisionPage /></AuthRoute>} />
              <Route path="/calculs" element={<AuthRoute><CalculsPage /></AuthRoute>} />
              <Route path="/messages" element={<AuthRoute><Messages /></AuthRoute>} />
              <Route path="/profile" element={<AuthRoute><Profile /></AuthRoute>} />
              <Route path="/premium" element={<PremiumPage />} />
              <Route path="/admin" element={<AuthRoute><ProtectedAdminRoute><AdminDashboard /></ProtectedAdminRoute></AuthRoute>} />
              <Route path="*" element={<Navigate to={user ? "/" : "/auth"} replace />} />
            </Routes>
          </PageTransition>
        </AnimatePresence>
      </main>

      {/* === NAVBAR MOBILE (masqué sur routes immersives) === */}
      {!isImmersiveRoute && <NavbarMobile isDarkMode={isDarkMode} isVideosPage={isVideosPage} isAdminUser={isAdminUser} />}

      {/* === STORY VIEWER === */}
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

// === COMPOSANTS IDENTIQUES ===
function AuthRoute({ children, redirectIfAuthenticated = false }) {
  const { user, ready } = useAuth();
  if (!ready) return <LoadingSpinner fullScreen />;
  if (redirectIfAuthenticated && user) return <Navigate to="/" replace />;
  if (!redirectIfAuthenticated && !user) return <Navigate to="/auth" replace />;
  return children;
}

function PageTransition({ children }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
      {children}
    </motion.div>
  );
}

function BackgroundParticles({ isDarkMode }) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      <div className="absolute inset-0 transition-all duration-500" style={{ background: isDarkMode ? 'linear-gradient(to bottom, #000, #0a0a0a)' : 'linear-gradient(to bottom, #fff, #fafafa)' }} />
      {[...Array(12)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1.5 h-1.5 rounded-full"
          style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`, backgroundColor: isDarkMode ? 'rgba(255,107,0,0.15)' : 'rgba(255,107,0,0.08)' }}
          animate={{ y: [0, -25, 0], opacity: [0.15, 0.4, 0.15] }}
          transition={{ duration: 3 + Math.random() * 1.5, repeat: Infinity, delay: Math.random() * 1.5 }}
        />
      ))}
    </div>
  );
}

function SidebarDesktop({ isDarkMode, isVideosPage, isAdminUser }) {
  const location = useLocation();
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const navItems = [
    { path: "/", icon: Home, label: "Accueil" },
    { path: "/chat", icon: MessageSquare, label: "Chat" },
    { path: "/videos", icon: Video, label: "Vidéos" },
    { path: "/vision", icon: Eye, label: "Vision" },
    { path: "/calculs", icon: Calculator, label: "Calculs" },
    { path: "/messages", icon: Mail, label: "Messages" },
    { path: "/profile", icon: User, label: "Profil" },
    { path: "/premium", icon: Crown, label: "ÉLITE", premium: true },
  ];

  if (isAdminUser) {
    navItems.push({ path: "/admin", icon: Shield, label: "Admin", adminOnly: true });
  }

  return (
    <aside className={`hidden sm:flex fixed left-0 top-[72px] bottom-0 w-24 lg:w-28 flex-col items-center py-6 gap-4 z-20 ${isDarkMode ? 'bg-gray-900' : 'bg-white'} border-r ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} shadow-xl`}>
      {navItems.map(({ path, icon: Icon, label, premium, adminOnly }) => {
        const isActive = location.pathname === path;
        return (
          <motion.button 
            key={path} 
            onClick={() => navigate(path)} 
            whileHover={{ scale: 1.12 }} 
            whileTap={{ scale: 0.95 }}
            className={`flex flex-col items-center gap-2 p-3 rounded-2xl relative transition-all ${isActive ? "bg-gradient-to-r from-orange-500 to-pink-500 text-white shadow-lg" : isDarkMode ? "text-gray-400 hover:bg-gray-800" : "text-gray-600 hover:bg-gray-100"}`}
            title={label}>
            <Icon size={24} />
            <span className="text-xs hidden lg:block font-medium">{label}</span>
            {premium && <Crown className="absolute -top-1 -right-1 w-4 h-4 text-yellow-400 animate-pulse" />}
            {adminOnly && <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white dark:border-gray-900" />}
          </motion.button>
        );
      })}
    </aside>
  );
}

function NavbarMobile({ isDarkMode, isVideosPage, isAdminUser }) {
  const location = useLocation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = isMenuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isMenuOpen]);

  if (!user) return null;

  const navItems = [
    { path: "/", icon: Home, label: "Accueil" },
    { path: "/chat", icon: MessageSquare, label: "Chat" },
    { path: "/videos", icon: Video, label: "Vidéos" },
    { path: "/premium", icon: Crown, label: "ÉLITE", premium: true },
  ];

  const moreItems = [
    { path: "/vision", icon: Eye, label: "Vision" },
    { path: "/calculs", icon: Calculator, label: "Calculs" },
    { path: "/messages", icon: Mail, label: "Messages" },
    { path: "/profile", icon: User, label: "Profil" },
    ...(isAdminUser ? [{ path: "/admin", icon: Shield, label: "Admin", adminOnly: true }] : [])
  ];

  return (
    <>
      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsMenuOpen(false)} className="sm:hidden fixed inset-0 bg-black/70 backdrop-blur-sm z-[60]" />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className={`sm:hidden fixed bottom-16 left-0 right-0 rounded-t-3xl shadow-2xl z-[70] border-t-2 border-orange-500 ${isDarkMode ? 'bg-gray-900' : 'bg-white'} p-6`}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold bg-gradient-to-r from-orange-500 to-pink-500 bg-clip-text text-transparent">Menu</h3>
                <button onClick={() => setIsMenuOpen(false)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"><X className="w-5 h-5" /></button>
              </div>
              {moreItems.map(({ path, icon: Icon, label, adminOnly }) => (
                <motion.button key={path} onClick={() => { navigate(path); setIsMenuOpen(false); }} whileTap={{ scale: 0.98 }}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl relative mb-2 ${location.pathname === path ? "bg-gradient-to-r from-orange-500 to-pink-500 text-white shadow-lg" : isDarkMode ? "bg-gray-800 text-gray-300 hover:bg-gray-700" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>
                  <Icon size={22} />
                  <span className="font-medium">{label}</span>
                  {adminOnly && <span className="ml-auto px-2 py-1 text-xs font-bold bg-red-500 text-white rounded-full">Admin</span>}
                </motion.button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <nav className={`sm:hidden fixed bottom-0 left-0 right-0 backdrop-blur-xl border-t z-50 pb-safe ${isVideosPage ? "bg-black/80 border-gray-800" : isDarkMode ? "bg-gray-900/90 border-gray-700" : "bg-white/90 border-gray-200"}`}>
        <div className="flex justify-around items-center h-16 px-2">
          {navItems.map(({ path, icon: Icon, label, premium }) => {
            const isActive = location.pathname === path;
            return (
              <motion.button key={path} onClick={() => navigate(path)} whileTap={{ scale: 0.9 }}
                className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl relative ${isActive ? "bg-gradient-to-r from-orange-500 to-pink-500 text-white shadow-lg" : isVideosPage ? "text-gray-300" : isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
                <Icon size={22} />
                <span className="text-[10px] font-medium">{label}</span>
                {premium && <Crown className="absolute -top-1 -right-1 w-3 h-3 text-yellow-400 animate-pulse" />}
              </motion.button>
            );
          })}
          <motion.button onClick={() => setIsMenuOpen(!isMenuOpen)} whileTap={{ scale: 0.9 }}
            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl ${isMenuOpen ? "bg-gradient-to-r from-orange-500 to-pink-500 text-white shadow-lg" : isVideosPage ? "text-gray-300" : isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
            <Menu size={22} />
            <span className="text-[10px] font-medium">Plus</span>
          </motion.button>
        </div>
      </nav>
    </>
  );
}