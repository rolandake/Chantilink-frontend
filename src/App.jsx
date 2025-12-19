// ==========================================================
// 📁 src/App.jsx - VERSION STABILISÉE (FIX SCROLL & JUMP) 🚀
// ==========================================================
import React, { useState, Suspense, useEffect, useMemo, useCallback, memo } from "react";
import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Home, MessageSquare, Video, Calculator, Mail, User, Menu, X, Shield, Crown, ArrowLeft 
} from "lucide-react";

import LoadingSpinner from "./components/LoadingSpinner";
import { Header, SplashScreen } from "./imports/importsComponents";
import { useAuth } from "./imports/importsContext";
import { useStories } from "./context/StoryContext";
import { useDarkMode } from "./context/DarkModeContext";
import ProtectedAdminRoute from "./components/ProtectedAdminRoute";
import { setupIndexedDB } from "./utils/idbMigration";

import { 
  Home as HomePage, Profile, ChatPage, VideosPage, CalculsPage, Messages, AuthPage 
} from "./imports/importsPages.js";

import AdminDashboard from "./pages/Admin/AdminDashboard.jsx";
import StoryViewer from "./pages/Home/StoryViewer";
import PremiumPage from "./pages/Premium/Premium";

export default function App() {
  const [idbReady, setIdbReady] = useState(false);
  const { ready: authReady } = useAuth();

  useEffect(() => {
    setupIndexedDB().finally(() => setIdbReady(true));
  }, []);

  useEffect(() => {
    const fixViewport = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };
    window.addEventListener('resize', fixViewport);
    fixViewport();
    
    // ✅ FIX SCROLL : On garde overflow:hidden sur le body mais on retire "position:fixed"
    // qui casse le défilement des conteneurs internes sur beaucoup de navigateurs.
    document.body.style.cssText = 'overflow:hidden; margin:0; padding:0; width:100%; height:100%; background: #000;';
    return () => window.removeEventListener('resize', fixViewport);
  }, []);

  return (
    <Suspense fallback={<LoadingSpinner fullScreen />}>
      {idbReady && authReady ? <AppContent /> : <SplashScreen onFinish={() => {}} />}
    </Suspense>
  );
}

function AppContent() {
  const { user } = useAuth();
  const { isDarkMode } = useDarkMode();
  const location = useLocation();
  const navigate = useNavigate();
  const { deleteSlide } = useStories();
  const [isSplashFinished, setSplashFinished] = useState(false);
  const [storyViewerOpen, setStoryViewerOpen] = useState(false);
  const [storyViewerData, setStoryViewerData] = useState({ stories: [], owner: null });

  const navStatus = useMemo(() => {
    const isHome = location.pathname === "/";
    const isAuth = location.pathname === "/auth";
    return {
      isHomePage: isHome,
      isAuthPage: isAuth,
      showNavigation: isHome && !isAuth && !storyViewerOpen,
      isAdminUser: user?.role === 'admin' || user?.role === 'superadmin'
    };
  }, [location.pathname, storyViewerOpen, user]);

  // ✅ FIX LAYOUT : Calcul de la hauteur dynamique
  const mainStyle = useMemo(() => ({
    top: navStatus.showNavigation ? "72px" : "0",
    // On s'assure que le main prend toute la place restante pour permettre le scroll
    height: navStatus.showNavigation ? "calc(100% - 72px - 64px)" : "100%",
    paddingBottom: "env(safe-area-inset-bottom)",
  }), [navStatus.showNavigation]);

  if (!isSplashFinished) return <SplashScreen onFinish={() => setSplashFinished(true)} />;

  return (
    <div className={`fixed inset-0 overflow-hidden ${isDarkMode ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-900"}`}>
      
      {/* HEADER : Hors de l'AnimatePresence des routes pour éviter les sauts */}
      {navStatus.showNavigation && (
        <motion.div initial={{ y: -80 }} animate={{ y: 0 }} className="fixed top-0 left-0 right-0 z-40">
           <Header />
        </motion.div>
      )}

      {/* BOUTON RETOUR */}
      <AnimatePresence>
        {!navStatus.isHomePage && !navStatus.isAuthPage && !storyViewerOpen && (
          <FloatingBackButton isDarkMode={isDarkMode} onClick={() => navigate("/")} />
        )}
      </AnimatePresence>

      {navStatus.showNavigation && <SidebarDesktopMemo isDarkMode={isDarkMode} isAdminUser={navStatus.isAdminUser} />}

      {/* ✅ ZONE DE SCROLL : On utilise overflow-y-auto avec une hauteur définie */}
      <main className="absolute left-0 right-0 z-10 overflow-y-auto" style={mainStyle}>
        {/* On retire popLayout ici car il cause des sauts de position sur les éléments fixes enfants */}
        <AnimatePresence mode="wait">
          <motion.div 
            key={location.pathname} 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            transition={{ duration: 0.15 }}
          >
            <Suspense fallback={<LoadingSpinner />}>
              <Routes location={location}>
                <Route path="/auth" element={<AuthRoute redirectIfAuthenticated><AuthPage /></AuthRoute>} />
                <Route path="/" element={<AuthRoute><HomePage openStoryViewer={(s, o) => { setStoryViewerData({stories: s, owner: o}); setStoryViewerOpen(true); }} /></AuthRoute>} />
                <Route path="/chat" element={<AuthRoute><ChatPage /></AuthRoute>} />
                <Route path="/videos" element={<AuthRoute><VideosPage /></AuthRoute>} />
                <Route path="/calculs" element={<AuthRoute><CalculsPage /></AuthRoute>} />
                <Route path="/messages" element={<AuthRoute><Messages /></AuthRoute>} />
                <Route path="/profile/:userId" element={<AuthRoute><Profile /></AuthRoute>} />
                <Route path="/premium" element={<AuthRoute><PremiumPage /></AuthRoute>} />
                <Route path="/admin/*" element={<AuthRoute><ProtectedAdminRoute><AdminDashboard /></ProtectedAdminRoute></AuthRoute>} />
                <Route path="*" element={<Navigate to={user ? "/" : "/auth"} replace />} />
              </Routes>
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* ✅ NAVBAR MOBILE : Placée en dehors de toute transformation pour ne pas sauter */}
      {navStatus.showNavigation && (
        <div className="fixed bottom-0 left-0 right-0 z-50">
           <NavbarMobileMemo isDarkMode={isDarkMode} isAdminUser={navStatus.isAdminUser} user={user} />
        </div>
      )}
      
      {/* STORIES */}
      <AnimatePresence>
        {storyViewerOpen && (
          <StoryViewer stories={storyViewerData.stories} currentUser={user} onClose={() => setStoryViewerOpen(false)} onDelete={async (id, idx) => await deleteSlide(id, idx)} />
        )}
      </AnimatePresence>
    </div>
  );
}

// --- MÉMOS ---
const FloatingBackButton = memo(({ isDarkMode, onClick }) => (
  <motion.button 
    initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
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

const NavIcon = ({ icon: Icon, onClick, isDarkMode, color }) => (
  <button onClick={onClick} className={`p-3 rounded-2xl hover:scale-110 active:scale-90 ${isDarkMode ? "bg-gray-800 text-gray-400" : "bg-gray-100 text-gray-500"} ${color}`}><Icon size={24} /></button>
);

const NavbarMobileMemo = memo(({ isDarkMode, isAdminUser, user }) => {
  const navigate = useNavigate();
  const [isMenuOpen, setMenuOpen] = useState(false);
  return (
    <>
      <nav className={`sm:hidden h-16 flex justify-around items-center backdrop-blur-xl border-t ${isDarkMode ? "bg-gray-900/90 border-gray-800" : "bg-white/90 border-gray-200"}`}>
        <button onClick={() => navigate("/")} className="text-orange-500 flex flex-col items-center"><Home size={22} /><span className="text-[10px] font-bold">Accueil</span></button>
        <button onClick={() => navigate("/chat")} className="text-gray-400 flex flex-col items-center"><MessageSquare size={22} /><span className="text-[10px]">Chat</span></button>
        <button onClick={() => navigate("/premium")} className="text-yellow-500 flex flex-col items-center"><Crown size={22} /><span className="text-[10px]">Élite</span></button>
        <button onClick={() => setMenuOpen(true)} className="text-gray-400 flex flex-col items-center"><Menu size={22} /><span className="text-[10px]">Plus</span></button>
      </nav>
      <AnimatePresence>
        {isMenuOpen && <MenuOverlay user={user} isAdminUser={isAdminUser} isDarkMode={isDarkMode} onClose={() => setMenuOpen(false)} />}
      </AnimatePresence>
    </>
  );
});

const MenuOverlay = ({ user, isAdminUser, isDarkMode, onClose }) => {
  const navigate = useNavigate();
  const items = [{ label: "Profil", icon: User, path: `/profile/${user?._id}` }, { label: "Messages", icon: Mail, path: "/messages" }, { label: "Vidéos", icon: Video, path: "/videos" }, { label: "Calculs", icon: Calculator, path: "/calculs" }];
  if (isAdminUser) items.push({ label: "Admin", icon: Shield, path: "/admin" });
  return (
    <div className="fixed inset-0 z-[110] flex items-end">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-black/60" onClick={onClose} />
      <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className={`w-full p-6 rounded-t-[40px] relative ${isDarkMode ? "bg-gray-900" : "bg-white shadow-2xl"}`}>
        <div className="w-12 h-1.5 bg-gray-600/30 mx-auto mb-6 rounded-full" />
        <div className="grid grid-cols-3 gap-4">
          {items.map(item => (
            <button key={item.path} onClick={() => { navigate(item.path); onClose(); }} className="flex flex-col items-center gap-2 p-4 rounded-3xl bg-gray-500/5 active:scale-95 transition-transform">
              <item.icon size={24} className={isDarkMode ? "text-orange-400" : "text-orange-500"} />
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

function AuthRoute({ children, redirectIfAuthenticated = false }) {
  const { user, ready } = useAuth();
  if (!ready) return <LoadingSpinner fullScreen />;
  if (redirectIfAuthenticated && user) return <Navigate to="/" replace />;
  if (!redirectIfAuthenticated && !user) return <Navigate to="/auth" replace />;
  return children;
}