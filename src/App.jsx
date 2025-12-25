// ============================================
// 📁 src/App.jsx
// VERSION ULTRA-OPTIMISÉE - Performances Maximales ⚡
// ============================================
import React, { useState, Suspense, useEffect, useMemo, useCallback, memo } from "react";
import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { 
  Home, MessageSquare, Video, Calculator, Mail, User, Menu, ArrowLeft, Shield
} from "lucide-react";

import LoadingSpinner from "./components/LoadingSpinner";
import { Header, SplashScreen } from "./imports/importsComponents";
import { useAuth } from "./imports/importsContext";
import { useStories } from "./context/StoryContext";
import { useDarkMode } from "./context/DarkModeContext";
import { useMessagesData } from "./pages/Chat/hooks/useMessagesData";
import ProtectedAdminRoute from "./components/ProtectedAdminRoute";
import { setupIndexedDB } from "./utils/idbMigration";

import { 
  Home as HomePage, Profile, ChatPage, VideosPage, CalculsPage, Messages, AuthPage 
} from "./imports/importsPages.js";

import AdminDashboard from "./pages/Admin/AdminDashboard.jsx";
import StoryViewer from "./pages/Home/StoryViewer";

// ✅ OPTIMISATION : Transition ultra-rapide
const fastTransition = { duration: 0.15, ease: "easeOut" };

export default function App() {
  const [ready, setReady] = useState(false);
  const { ready: authReady } = useAuth();

  useEffect(() => {
    // Init IndexedDB en background (non-bloquant)
    setupIndexedDB().catch(() => console.warn('IDB init failed'));
    
    // Viewport height fix
    const fixVh = () => document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
    fixVh();
    window.addEventListener('resize', fixVh, { passive: true });
    
    // Ready after auth
    if (authReady) setReady(true);
    
    return () => window.removeEventListener('resize', fixVh);
  }, [authReady]);

  if (!ready) return <SplashScreen onFinish={() => {}} />;
  
  return (
    <Suspense fallback={<div className="fixed inset-0 bg-black" />}>
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

  const handleCloseStory = useCallback(() => setStoryViewerOpen(false), []);

  const isHome = location.pathname === "/";
  const isAuth = location.pathname === "/auth";
  const showNav = isHome && !isAuth && !storyViewerOpen;
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  const mainStyle = useMemo(() => ({
    top: showNav ? "72px" : "0",
    height: showNav ? "calc(100% - 136px)" : "100%",
    paddingBottom: "env(safe-area-inset-bottom)",
  }), [showNav]);

  return (
    <div className={`fixed inset-0 overflow-hidden ${isDarkMode ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-900"}`}>
      
      {showNav && (
        <motion.div 
          initial={{ y: -80 }} 
          animate={{ y: 0 }} 
          transition={fastTransition}
          className="fixed top-0 left-0 right-0 z-40"
        >
          <Header />
        </motion.div>
      )}

      {!isHome && !isAuth && !storyViewerOpen && (
        <FloatingBackButton isDarkMode={isDarkMode} onClick={() => navigate("/")} />
      )}

      {showNav && <SidebarDesktopMemo isDarkMode={isDarkMode} isAdminUser={isAdmin} />}

      <main className="absolute left-0 right-0 z-10 overflow-y-auto" style={mainStyle}>
        {/* ✅ OPTIMISATION : Suppression de motion.div pour plus de rapidité */}
        <div key={location.pathname}>
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

      {showNav && (
        <div className="fixed bottom-0 left-0 right-0 z-50">
          <NavbarMobileMemo isDarkMode={isDarkMode} isAdminUser={isAdmin} user={user} location={location} />
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
// NAVBAR MOBILE OPTIMISÉE
// ✅ Chargement conditionnel des messages
// ============================================
const NavbarMobileMemo = memo(({ isDarkMode, isAdminUser, user, location }) => {
  const navigate = useNavigate();
  const [isMenuOpen, setMenuOpen] = useState(false);
  const { token } = useAuth();
  
  // ✅ OPTIMISATION CRITIQUE : Ne charger les messages que si nécessaire
  const shouldLoadMessages = useMemo(() => {
    return ['/chat', '/messages'].includes(location.pathname);
  }, [location.pathname]);
  
  // ✅ CORRECTION : Passer null comme 2ème paramètre + chargement conditionnel
  const { data } = useMessagesData(shouldLoadMessages ? token : null, null);
  
  const totalUnread = useMemo(() => {
    if (!data?.unread) return 0;
    return Object.values(data.unread).reduce((acc, count) => acc + count, 0);
  }, [data?.unread]);

  const isActive = useCallback((path) => location.pathname === path, [location.pathname]);

  return (
    <>
      <nav className={`sm:hidden h-16 flex justify-around items-center backdrop-blur-xl border-t ${isDarkMode ? "bg-gray-900/90 border-gray-800" : "bg-white/90 border-gray-200"}`}>
        <NavBtn icon={Home} label="Accueil" active={isActive("/")} onClick={() => navigate("/")} />
        <NavBtn icon={Video} label="Vidéos" active={isActive("/videos")} onClick={() => navigate("/videos")} />
        <NavBtn icon={MessageSquare} label="Chat" active={isActive("/chat")} onClick={() => navigate("/chat")} badge={totalUnread} />
        <NavBtn icon={Menu} label="Plus" onClick={() => setMenuOpen(true)} />
      </nav>
      {isMenuOpen && <MenuOverlay user={user} isAdminUser={isAdminUser} isDarkMode={isDarkMode} onClose={() => setMenuOpen(false)} />}
    </>
  );
});

// ✅ OPTIMISATION : Mémoisation du bouton de navigation
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
  return (
    <aside className={`hidden sm:flex fixed left-0 top-[72px] bottom-0 w-20 flex-col items-center py-8 gap-6 z-30 border-r ${isDarkMode ? 'bg-gray-900/50 border-gray-800' : 'bg-white border-gray-100'}`}>
      <NavIcon icon={Home} onClick={() => navigate("/")} isDarkMode={isDarkMode} />
      <NavIcon icon={MessageSquare} onClick={() => navigate("/chat")} isDarkMode={isDarkMode} />
      <NavIcon icon={Video} onClick={() => navigate("/videos")} isDarkMode={isDarkMode} />
      {isAdminUser && <NavIcon icon={Shield} onClick={() => navigate("/admin")} isDarkMode={isDarkMode} color="text-red-500" />}
    </aside>
  );
});

const NavIcon = memo(({ icon: Icon, onClick, isDarkMode, color }) => (
  <button 
    onClick={onClick} 
    className={`p-3 rounded-2xl hover:scale-110 active:scale-90 transition-transform ${isDarkMode ? "bg-gray-800 text-gray-400" : "bg-gray-100 text-gray-500"} ${color || ''}`}
  >
    <Icon size={24} />
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