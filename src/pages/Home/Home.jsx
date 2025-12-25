// ============================================
// 📁 src/pages/Home/Home.jsx
// VERSION ZERO MARGIN - POSTS COLLÉS ⚡
// ============================================
import React, { useState, useMemo, useEffect, useRef, useCallback, memo, lazy, Suspense } from "react";
import { MagnifyingGlassIcon, ArrowPathIcon } from "@heroicons/react/24/outline";
import { AnimatePresence, motion } from "framer-motion";
import { useDarkMode } from "../../context/DarkModeContext";
import { useStories } from "../../context/StoryContext";
import { usePosts } from "../../context/PostsContext";
import { useAuth } from "../../context/AuthContext";

// ✅ IMPORTS DIRECTS (chargement immédiat)
import PostCard from "./PostCard";
import StoryContainer from "./StoryContainer";
import StoryCreator from "./StoryCreator";

// ✅ LAZY LOADING (chargement différé)
const StoryViewer = lazy(() => import("./StoryViewer"));
const ImmersivePyramidUniverse = lazy(() => import("./ImmersivePyramidUniverse"));

// ✅ OPTIMISATION : Transitions ultra-rapides
const fastTransition = { duration: 0.15, ease: "easeOut" };

// ✅ OPTIMISATION : Styles globaux injectés une seule fois
const STYLES = `
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { 
    background: linear-gradient(180deg, rgba(249,115,22,0.4), rgba(234,88,12,0.4));
    border-radius: 10px;
  }
  .dark ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); }
  .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
  .scrollbar-hide::-webkit-scrollbar { display: none; }
`;

if (typeof document !== "undefined" && !document.getElementById("home-styles")) {
  const style = document.createElement("style");
  style.id = "home-styles";
  style.textContent = STYLES;
  document.head.appendChild(style);
}

// ═══════════════════════════════════════════════════════════
// COMPOSANTS UI MÉMORISÉS
// ═══════════════════════════════════════════════════════════

const Toast = memo(({ toast }) => {
  if (!toast) return null;
  return (
    <motion.div
      initial={{ x: 100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 100, opacity: 0 }}
      transition={fastTransition}
      className="fixed top-20 right-4 z-[9998]"
    >
      <div className={`px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 min-w-[280px] backdrop-blur-xl border-2 font-bold text-white ${
        toast.type === "success" 
          ? "bg-gradient-to-r from-emerald-500 to-green-600 border-emerald-400/50" 
          : "bg-gradient-to-r from-rose-500 to-red-600 border-rose-400/50"
      }`}>
        <span>{toast.type === "success" ? "✅" : "❌"}</span>
        <p>{toast.message}</p>
      </div>
    </motion.div>
  );
});

const LoadingSpinner = memo(({ isDarkMode }) => (
  <div className="flex justify-center py-8">
    <div className={`w-10 h-10 border-4 border-t-transparent rounded-full animate-spin ${
      isDarkMode ? "border-orange-500" : "border-orange-600"
    }`} />
  </div>
));

const EmptyState = memo(({ searchQuery, isDarkMode, onRefresh }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }} 
    animate={{ opacity: 1, y: 0 }}
    transition={fastTransition}
    className="text-center py-24"
  >
    <div className="text-7xl mb-4">📭</div>
    <p className={`text-xl font-bold mb-2 ${isDarkMode ? "text-white" : "text-gray-800"}`}>
      {searchQuery ? "Aucun résultat trouvé" : "Aucun post disponible"}
    </p>
    <p className={`text-sm mb-6 ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
      {searchQuery ? "Essayez une autre recherche" : "Revenez plus tard ou rafraîchissez"}
    </p>
    <button
      onClick={onRefresh}
      className="px-10 py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-full font-bold shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all"
    >
      Rafraîchir le feed
    </button>
  </motion.div>
));

const SearchBar = memo(({ searchQuery, onSearchChange, onRefresh, isRefreshing, isDarkMode }) => (
  <div className={`sticky top-0 z-40 px-4 pt-3 pb-2 border-b transition-colors ${
    isDarkMode 
      ? "bg-black/90 border-white/10 backdrop-blur-2xl" 
      : "bg-white/90 border-gray-200/50 backdrop-blur-xl"
  }`}>
    <div className={`max-w-3xl mx-auto flex items-center h-12 px-4 rounded-2xl shadow-lg border-2 transition-all focus-within:ring-2 focus-within:ring-orange-500/50 ${
      isDarkMode 
        ? "bg-gray-800/50 border-gray-700" 
        : "bg-white/80 border-gray-200"
    }`}>
      <MagnifyingGlassIcon className="w-5 h-5 text-orange-500 flex-shrink-0" />
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Rechercher un post ou un utilisateur..."
        className={`ml-3 flex-1 bg-transparent text-sm font-medium focus:outline-none placeholder:text-gray-500 ${
          isDarkMode ? "text-white" : "text-gray-800"
        }`}
      />
      {searchQuery && (
        <button
          onClick={() => onSearchChange("")}
          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors mr-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
      <button 
        onClick={onRefresh} 
        disabled={isRefreshing}
        className="p-2 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-110 active:scale-90 transition-transform"
      >
        <ArrowPathIcon className={`w-5 h-5 ${isRefreshing ? "animate-spin" : ""} text-orange-500`} />
      </button>
    </div>
  </div>
));

// ✅ OPTIMISATION : Wrapper de post mémorisé SANS MARGIN
const PostWrapper = memo(({ post }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, scale: 0.95 }}
    transition={fastTransition}
    className="w-full" // ✅ ZERO MARGIN/PADDING
  >
    <PostCard post={post} />
  </motion.div>
), (prev, next) => prev.post._id === next.post._id);

// ═══════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL HOME
// ═══════════════════════════════════════════════════════════

const Home = ({ openStoryViewer: openStoryViewerProp }) => {
  const { isDarkMode } = useDarkMode();
  const { fetchStories, createStory, stories = [], myStories } = useStories();
  const { posts = [], fetchNextPage, hasMore, loading: postsLoading, refetch } = usePosts() || {};
  const { user } = useAuth();

  // ════════════════════════════════════════════════════════
  // STATE
  // ════════════════════════════════════════════════════════
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreator, setShowCreator] = useState(false);
  const [showStoryViewer, setShowStoryViewer] = useState(false);
  const [viewerData, setViewerData] = useState({ stories: [], owner: null });
  const [toast, setToast] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showPyramid, setShowPyramid] = useState(false);

  // ════════════════════════════════════════════════════════
  // REFS
  // ════════════════════════════════════════════════════════
  const observerRef = useRef(null);
  const loadingRef = useRef(false);
  const toastTimeoutRef = useRef(null);

  useEffect(() => {
    loadingRef.current = postsLoading;
  }, [postsLoading]);

  // ✅ OPTIMISATION : Bloquer scroll seulement si pyramide active
  useEffect(() => {
    if (showPyramid) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = 'unset';
      };
    }
  }, [showPyramid]);

  // ════════════════════════════════════════════════════════
  // HANDLERS MÉMORISÉS
  // ════════════════════════════════════════════════════════

  const handleOpenStory = useCallback((stories, owner) => {
    if (openStoryViewerProp) {
      openStoryViewerProp(stories, owner);
    } else {
      setViewerData({ stories, owner });
      setShowStoryViewer(true);
    }
  }, [openStoryViewerProp]);

  const handleCreateStory = useCallback(async (formData) => {
    try {
      await createStory(formData);
      setToast({ message: "Story publiée avec succès !", type: "success" });
      setShowCreator(false);
      
      setTimeout(() => fetchStories(true), 1000);
    } catch (err) {
      console.error("❌ [Home] Erreur création story:", err);
      setToast({ 
        message: err.message || "Échec de la publication", 
        type: "error" 
      });
    } finally {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
      toastTimeoutRef.current = setTimeout(() => setToast(null), 3000);
    }
  }, [createStory, fetchStories]);

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    console.log("🔄 [Home] Refreshing feed...");
    
    try {
      await Promise.allSettled([
        refetch?.(),
        fetchNextPage?.(true),
        fetchStories(true)
      ]);
      
      setToast({ message: "Feed actualisé ✨", type: "success" });
    } catch (err) {
      console.error("❌ [Home] Erreur refresh:", err);
      setToast({ message: "Erreur de rafraîchissement", type: "error" });
    } finally {
      setIsRefreshing(false);
      setTimeout(() => setToast(null), 2500);
    }
  }, [isRefreshing, refetch, fetchNextPage, fetchStories]);

  const handleClosePyramid = useCallback(() => setShowPyramid(false), []);
  const handleOpenPyramid = useCallback(() => setShowPyramid(true), []);
  const handleCloseCreator = useCallback(() => setShowCreator(false), []);
  const handleOpenCreator = useCallback(() => setShowCreator(true), []);
  const handleCloseStoryViewer = useCallback(() => setShowStoryViewer(false), []);

  // ════════════════════════════════════════════════════════
  // FILTRAGE DES POSTS MÉMORISÉ
  // ════════════════════════════════════════════════════════

  const filteredPosts = useMemo(() => {
    if (!searchQuery.trim()) return posts;
    
    const query = searchQuery.toLowerCase().trim();
    return posts.filter(post => {
      const content = (post.content || "").toLowerCase();
      const username = (post.user?.username || "").toLowerCase();
      const displayName = (post.user?.displayName || "").toLowerCase();
      
      return content.includes(query) || 
             username.includes(query) || 
             displayName.includes(query);
    });
  }, [posts, searchQuery]);

  // ════════════════════════════════════════════════════════
  // INFINITE SCROLL OPTIMISÉ
  // ════════════════════════════════════════════════════════

  const handleObserver = useCallback((entries) => {
    const target = entries[0];
    
    if (target.isIntersecting && hasMore && !loadingRef.current && !isRefreshing) {
      console.log("📥 [Home] Loading more posts via infinite scroll...");
      fetchNextPage();
    }
  }, [hasMore, fetchNextPage, isRefreshing]);

  useEffect(() => {
    const currentObserver = observerRef.current;
    if (!currentObserver) return;

    const observer = new IntersectionObserver(handleObserver, { 
      rootMargin: "200px",
      threshold: 0.1 
    });

    observer.observe(currentObserver);
    
    return () => observer.disconnect();
  }, [handleObserver]);

  // ════════════════════════════════════════════════════════
  // CLEANUP
  // ════════════════════════════════════════════════════════

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  // ════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════

  return (
    <div className="flex flex-col h-full">
      {/* ✅ CONTENU PRINCIPAL (caché si pyramide active) */}
      {!showPyramid && (
        <>
          {/* Search Bar */}
          <SearchBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onRefresh={handleRefresh}
            isRefreshing={isRefreshing}
            isDarkMode={isDarkMode}
          />

          {/* Stories Section */}
          <div className={`sticky top-[72px] z-30 transition-colors ${
            isDarkMode ? "bg-black/90" : "bg-white/90"
          } backdrop-blur-xl border-b ${
            isDarkMode ? "border-white/10" : "border-gray-200/40"
          }`}>
            <div className="h-[110px] px-4 overflow-x-auto scrollbar-hide">
              <div className="flex items-center gap-3 h-full min-w-max py-2">
                <StoryContainer
                  onOpenStory={handleOpenStory}
                  onOpenCreator={handleOpenCreator}
                  onOpenPyramid={handleOpenPyramid}
                  isDarkMode={isDarkMode}
                />
              </div>
            </div>
          </div>

          {/* ✅ POSTS FEED - ZERO PADDING/MARGIN - FULL WIDTH */}
          <div className="flex-1 overflow-y-auto">
            <div className="w-full max-w-full"> {/* ✅ ZERO PADDING, FULL WIDTH */}
              
              {/* ✅ POSTS COLLÉS - ZERO GAP */}
              <AnimatePresence mode="popLayout">
                {filteredPosts.map((post) => (
                  <PostWrapper key={post._id} post={post} />
                ))}
              </AnimatePresence>

              {/* Empty State */}
              {!postsLoading && filteredPosts.length === 0 && (
                <div className="px-4">
                  <EmptyState 
                    searchQuery={searchQuery} 
                    isDarkMode={isDarkMode} 
                    onRefresh={handleRefresh} 
                  />
                </div>
              )}

              {/* Infinite Scroll Trigger */}
              <div ref={observerRef} className="h-4 w-full" />
              
              {/* Loading Indicator */}
              {postsLoading && <LoadingSpinner isDarkMode={isDarkMode} />}
            </div>
          </div>
        </>
      )}

      {/* ✅ PYRAMIDE IMMERSIVE EN FULLSCREEN */}
      <AnimatePresence>
        {showPyramid && (
          <Suspense fallback={null}>
            <ImmersivePyramidUniverse
              stories={stories}
              myStories={myStories}
              user={user}
              onClose={handleClosePyramid}
              onOpenStory={handleOpenStory}
              onOpenCreator={() => {
                handleClosePyramid();
                handleOpenCreator();
              }}
              isDarkMode={isDarkMode}
            />
          </Suspense>
        )}
      </AnimatePresence>

      {/* Story Creator Modal */}
      <AnimatePresence>
        {showCreator && (
          <StoryCreator 
            onClose={handleCloseCreator}
            onSubmit={handleCreateStory} 
          />
        )}
      </AnimatePresence>

      {/* Story Viewer Modal */}
      <AnimatePresence>
        {showStoryViewer && !openStoryViewerProp && (
          <Suspense fallback={null}>
            <StoryViewer
              stories={viewerData.stories}
              currentUser={viewerData.owner}
              onClose={handleCloseStoryViewer}
            />
          </Suspense>
        )}
      </AnimatePresence>

      {/* Toast Notifications */}
      <AnimatePresence>
        <Toast toast={toast} />
      </AnimatePresence>
    </div>
  );
};

export default memo(Home);