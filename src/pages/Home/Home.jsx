// src/pages/Home/Home.jsx - VERSION CORRIGÉE
import React, { useState, useMemo, useEffect, useRef, useCallback, memo, lazy, Suspense } from "react";
import { MagnifyingGlassIcon, ArrowPathIcon } from "@heroicons/react/24/outline";
import { AnimatePresence, motion } from "framer-motion";
import { useDarkMode } from "../../context/DarkModeContext";
import { useStories } from "../../context/StoryContext";
import { usePosts } from "../../context/PostsContext";

// ✅ IMPORTS DIRECTS (Pas de lazy loading pour les composants utilisant des contexts)
import PostCard from "./PostCard";
import StoryContainer from "./StoryContainer";
import StoryCreator from "./StoryCreator"; // ✅ CORRECTION: Import direct au lieu de lazy

// ✅ LAZY LOADING (Uniquement pour StoryViewer qui n'utilise pas de hook de contexte au mount)
const StoryViewer = lazy(() => import("./StoryViewer"));

// ═══════════════════════════════════════════════════════════
// STYLES GLOBAUX
// ═══════════════════════════════════════════════════════════
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
// COMPOSANTS UI
// ═══════════════════════════════════════════════════════════

const Toast = memo(({ toast }) => {
  if (!toast) return null;
  return (
    <motion.div
      initial={{ x: 100, opacity: 0, scale: 0.9 }}
      animate={{ x: 0, opacity: 1, scale: 1 }}
      exit={{ x: 100, opacity: 0, scale: 0.9 }}
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
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      className={`w-10 h-10 border-4 border-t-transparent rounded-full ${
        isDarkMode ? "border-orange-500" : "border-orange-600"
      }`}
    />
  </div>
));

const EmptyState = memo(({ searchQuery, isDarkMode, onRefresh }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }} 
    animate={{ opacity: 1, y: 0 }} 
    className="text-center py-24"
  >
    <div className="text-7xl mb-4">📭</div>
    <p className={`text-xl font-bold mb-2 ${isDarkMode ? "text-white" : "text-gray-800"}`}>
      {searchQuery ? "Aucun résultat trouvé" : "Aucun post disponible"}
    </p>
    <p className={`text-sm mb-6 ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
      {searchQuery ? "Essayez une autre recherche" : "Revenez plus tard ou rafraîchissez"}
    </p>
    <motion.button
      onClick={onRefresh}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className="px-10 py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-full font-bold shadow-xl hover:shadow-2xl transition-shadow"
    >
      Rafraîchir le feed
    </motion.button>
  </motion.div>
));

const SearchBar = memo(({ searchQuery, onSearchChange, onRefresh, isRefreshing, isDarkMode }) => (
  <div className={`sticky top-0 z-40 px-4 pt-3 pb-2 border-b transition-all ${
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
      <motion.button 
        onClick={onRefresh} 
        disabled={isRefreshing} 
        whileHover={{ scale: 1.1, rotate: 180 }} 
        whileTap={{ scale: 0.9 }}
        className="p-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <ArrowPathIcon className={`w-5 h-5 ${isRefreshing ? "animate-spin" : ""} text-orange-500`} />
      </motion.button>
    </div>
  </div>
));

// ═══════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL HOME
// ═══════════════════════════════════════════════════════════

const Home = ({ openStoryViewer: openStoryViewerProp }) => {
  const { isDarkMode } = useDarkMode();
  const { fetchStories, createStory } = useStories();
  const { posts = [], fetchNextPage, hasMore, loading: postsLoading, refetch } = usePosts() || {};

  // ════════════════════════════════════════════════════════
  // STATE
  // ════════════════════════════════════════════════════════
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreator, setShowCreator] = useState(false);
  const [showStoryViewer, setShowStoryViewer] = useState(false);
  const [viewerData, setViewerData] = useState({ stories: [], owner: null });
  const [toast, setToast] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // ════════════════════════════════════════════════════════
  // REFS
  // ════════════════════════════════════════════════════════
  const observerRef = useRef(null);
  const loadingRef = useRef(false);
  const toastTimeoutRef = useRef(null);

  // Sync loading state with ref
  useEffect(() => {
    loadingRef.current = postsLoading;
  }, [postsLoading]);

  // ════════════════════════════════════════════════════════
  // HANDLERS - STORIES
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
      
      // Refresh stories after creation
      setTimeout(() => fetchStories(true), 1000);
    } catch (err) {
      console.error("❌ [Home] Erreur création story:", err);
      setToast({ 
        message: err.message || "Échec de la publication", 
        type: "error" 
      });
    } finally {
      // Clear previous timeout
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
      // Set new timeout to clear toast
      toastTimeoutRef.current = setTimeout(() => setToast(null), 3000);
    }
  }, [createStory, fetchStories]);

  // ════════════════════════════════════════════════════════
  // HANDLERS - FEED
  // ════════════════════════════════════════════════════════

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

  // ════════════════════════════════════════════════════════
  // FILTRAGE DES POSTS
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
  // INFINITE SCROLL
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
              onOpenCreator={() => setShowCreator(true)}
              isDarkMode={isDarkMode}
            />
          </div>
        </div>
      </div>

      {/* Posts Feed */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-6">
          <AnimatePresence mode="popLayout">
            {filteredPosts.map((post) => (
              <motion.div
                key={post._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3 }}
              >
                <PostCard post={post} />
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Empty State */}
          {!postsLoading && filteredPosts.length === 0 && (
            <EmptyState 
              searchQuery={searchQuery} 
              isDarkMode={isDarkMode} 
              onRefresh={handleRefresh} 
            />
          )}

          {/* Infinite Scroll Trigger */}
          <div ref={observerRef} className="h-4 w-full" />
          
          {/* Loading Indicator */}
          {postsLoading && <LoadingSpinner isDarkMode={isDarkMode} />}
        </div>
      </div>

      {/* ✅ Story Creator Modal - Sans Suspense car import direct */}
      <AnimatePresence>
        {showCreator && (
          <StoryCreator 
            onClose={() => setShowCreator(false)} 
            onSubmit={handleCreateStory} 
          />
        )}
      </AnimatePresence>

      {/* Story Viewer Modal - Avec Suspense car lazy */}
      <AnimatePresence>
        {showStoryViewer && !openStoryViewerProp && (
          <Suspense fallback={null}>
            <StoryViewer
              stories={viewerData.stories}
              currentUser={viewerData.owner}
              onClose={() => setShowStoryViewer(false)}
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