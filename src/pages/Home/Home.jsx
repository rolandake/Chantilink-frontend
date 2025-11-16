// src/pages/Home/Home.jsx - CORRIGÉ ET COMPLET
import React, { useState, useMemo, useEffect, useRef, useCallback, memo } from "react";
import { MagnifyingGlassIcon, XMarkIcon, ArrowPathIcon } from "@heroicons/react/24/outline";
import { AnimatePresence, motion } from "framer-motion";
import StoryContainer from "./StoryContainer";
import StoryCreator from "./StoryCreator";
import StoryViewer from "./StoryViewer";
import { useAuth } from "../../context/AuthContext";
import { useDarkMode } from "../../context/DarkModeContext";
import { useStories } from "../../context/StoryContext";
import { usePosts } from "../../context/PostsContext";
import PostCard from "./PostCard";

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

const Home = ({ openStoryViewer: openStoryViewerProp }) => {
  const { user: currentUser } = useAuth();
  const { isDarkMode } = useDarkMode();
  const { stories, fetchStories, createStory, deleteStory } = useStories();
  const { posts = [], fetchNextPage, hasMore, loading: postsLoading, refetch } = usePosts() || {};

  const [searchQuery, setSearchQuery] = useState("");
  const [showCreator, setShowCreator] = useState(false);
  const [showStoryViewer, setShowStoryViewer] = useState(false);
  const [viewerData, setViewerData] = useState({ stories: [], owner: null });
  const [toast, setToast] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const observerRef = useRef();

  // ════════════════════════════════════════════════════════
  // GESTION DES STORIES
  // ════════════════════════════════════════════════════════

  // Ouvrir le viewer de stories
  const handleOpenStory = useCallback((stories, owner) => {
    console.log("🎯 [Home] Opening story viewer", { 
      storiesCount: stories.length, 
      owner: owner?.username 
    });
    
    if (openStoryViewerProp && typeof openStoryViewerProp === 'function') {
      // Utiliser le viewer externe si fourni
      openStoryViewerProp(stories, owner);
    } else {
      // Utiliser le viewer interne
      setViewerData({ stories, owner });
      setShowStoryViewer(true);
    }
  }, [openStoryViewerProp]);

  // Fermer le viewer
  const handleCloseViewer = useCallback(() => {
    console.log("✖️ [Home] Closing story viewer");
    setShowStoryViewer(false);
    setViewerData({ stories: [], owner: null });
    // Rafraîchir après fermeture pour mettre à jour les vues
    setTimeout(() => {
      fetchStories(true);
    }, 500);
  }, [fetchStories]);

  // Ouvrir le créateur
  const handleOpenCreator = useCallback(() => {
    console.log("➕ [Home] Opening story creator");
    setShowCreator(true);
  }, []);

  // Fermer le créateur
  const handleCloseCreator = useCallback(() => {
    console.log("✖️ [Home] Closing story creator");
    setShowCreator(false);
    // Rafraîchir après fermeture
    setTimeout(() => {
      console.log("🔄 [Home] Refreshing stories after creator close");
      fetchStories(true);
    }, 1000);
  }, [fetchStories]);

  // Créer une story
  const handleCreateStory = useCallback(async (formData) => {
    console.log("📤 [Home] Creating story...");
    
    try {
      await createStory(formData);
      console.log("✅ [Home] Story created successfully");
      
      setToast({ message: "Story publiée !", type: "success" });
      
      // Fermer le modal et rafraîchir
      setTimeout(() => {
        handleCloseCreator();
        fetchStories(true);
      }, 1500);
    } catch (err) {
      console.error("❌ [Home] Failed to create story:", err);
      setToast({ message: err.message || "Échec de la publication", type: "error" });
      throw err; // Le modal affichera aussi l'erreur
    }
  }, [createStory, handleCloseCreator, fetchStories]);

  // ════════════════════════════════════════════════════════
  // GESTION DU REFRESH
  // ════════════════════════════════════════════════════════

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    
    console.log("🔄 [Home] Refreshing all data...");
    setIsRefreshing(true);
    
    try {
      await Promise.all([
        refetch?.(), 
        fetchNextPage?.(), 
        fetchStories(true)
      ]);
      setToast({ message: "Actualisé ✨", type: "success" });
    } catch (err) {
      console.error("❌ [Home] Refresh error:", err);
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
    const q = searchQuery.toLowerCase();
    return posts.filter((p) =>
      [p.content, p.user?.username, p.user?.fullName].some((f) => f?.toLowerCase().includes(q))
    );
  }, [posts, searchQuery]);

  // ════════════════════════════════════════════════════════
  // INFINITE SCROLL
  // ════════════════════════════════════════════════════════

  const handleObserver = useCallback(
    ([e]) => {
      if (e.isIntersecting && hasMore && !postsLoading) {
        console.log("📥 [Home] Loading more posts...");
        fetchNextPage();
      }
    },
    [hasMore, postsLoading, fetchNextPage]
  );

  useEffect(() => {
    if (!observerRef.current) return;
    const obs = new IntersectionObserver(handleObserver, { rootMargin: "300px" });
    obs.observe(observerRef.current);
    return () => obs.disconnect();
  }, [handleObserver]);

  // ════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════

  return (
    <div className="flex flex-col h-full">
      {/* === BARRE DE RECHERCHE - STICKY === */}
      <div className={`sticky top-0 z-40 px-4 pt-3 pb-2 border-b ${isDarkMode ? "bg-black/90 border-white/10 backdrop-blur-2xl" : "bg-white/90 border-gray-200/50 backdrop-blur-xl"}`}>
        <div className="max-w-3xl mx-auto">
          <div className={`flex items-center h-12 px-4 rounded-2xl shadow-lg border-2 transition-all focus-within:ring-2 focus-within:ring-orange-500/50 ${isDarkMode ? "bg-gray-900/80 border-white/20 hover:border-orange-500/40" : "bg-gray-50 border-orange-200/50 hover:border-orange-400"}`}>
            <MagnifyingGlassIcon className="w-5 h-5 text-orange-500 flex-shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher..."
              className={`ml-3 flex-1 bg-transparent text-sm font-medium placeholder-gray-500 focus:outline-none ${isDarkMode ? "text-white" : "text-gray-800"}`}
            />
            <motion.button
              onClick={handleRefresh}
              disabled={isRefreshing}
              whileHover={{ scale: 1.1, rotate: 180 }}
              whileTap={{ scale: 0.9 }}
              className="p-2"
              type="button"
            >
              <ArrowPathIcon className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""} text-orange-500`} />
            </motion.button>
            {searchQuery && (
              <motion.button
                onClick={() => setSearchQuery("")}
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                className="p-2"
                type="button"
              >
                <XMarkIcon className="w-4 h-4 text-gray-500" />
              </motion.button>
            )}
          </div>
        </div>
      </div>

      {/* === STORIES - STICKY + SCROLL HORIZONTAL === */}
      <div className={`sticky top-[72px] z-30 ${isDarkMode ? "bg-black/90" : "bg-white/90"} backdrop-blur-xl border-b ${isDarkMode ? "border-white/10" : "border-gray-200/40"}`}>
        <div className="h-[110px] px-4 overflow-x-auto scrollbar-hide">
          <div className="flex items-center gap-3 h-full min-w-max py-2">
            <StoryContainer
              onOpenStory={handleOpenStory}
              onOpenCreator={handleOpenCreator}
              isDarkMode={isDarkMode}
            />
          </div>
        </div>
      </div>

      {/* === FEED - SCROLL NORMAL === */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-6">
          <AnimatePresence mode="popLayout">
            {filteredPosts.map((post, i) => (
              <motion.div
                key={post._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: i * 0.05, duration: 0.3 }}
              >
                <PostCard post={post} />
              </motion.div>
            ))}
          </AnimatePresence>

          {/* AUCUN POST */}
          {!postsLoading && filteredPosts.length === 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-24"
            >
              <div className="text-7xl mb-4">📭</div>
              <p className={`text-xl font-bold mb-2 ${isDarkMode ? "text-white" : "text-gray-800"}`}>
                {searchQuery ? "Aucun résultat" : "Aucun post"}
              </p>
              <p className={`text-sm mb-6 ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
                {searchQuery ? "Essayez un autre terme" : "Soyez le premier à publier"}
              </p>
              <motion.button
                onClick={handleRefresh}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-10 py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-full font-bold shadow-xl hover:shadow-2xl transition-shadow"
                type="button"
              >
                Rafraîchir
              </motion.button>
            </motion.div>
          )}

          {/* CHARGEMENT */}
          <div ref={observerRef} className="h-10" />
          {postsLoading && (
            <div className="flex justify-center py-8">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className={`w-10 h-10 border-4 border-t-transparent rounded-full ${isDarkMode ? "border-orange-500" : "border-orange-600"}`}
              />
            </div>
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          MODALS
      ════════════════════════════════════════════════════════ */}

      {/* === CRÉATEUR DE STORY === */}
      <AnimatePresence>
        {showCreator && (
          <StoryCreator
            onClose={handleCloseCreator}
            onSubmit={handleCreateStory}
          />
        )}
      </AnimatePresence>

      {/* === VIEWER DE STORY (interne) === */}
      <AnimatePresence>
        {showStoryViewer && !openStoryViewerProp && viewerData.stories.length > 0 && (
          <StoryViewer
            stories={viewerData.stories}
            currentUser={viewerData.owner}
            onClose={handleCloseViewer}
          />
        )}
      </AnimatePresence>

      {/* === TOAST PREMIUM === */}
      <AnimatePresence>
        {toast && (
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
              <span className="text-2xl">
                {toast.type === "success" ? "✅" : "❌"}
              </span>
              <p>{toast.message}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default memo(Home);