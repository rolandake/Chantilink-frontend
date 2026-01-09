// ============================================
// 📁 src/pages/Home/Home.jsx
// VERSION OPTIMISÉE LCP / CLS AVEC RECHERCHE HEADER
// ============================================
import React, {
  useState, useMemo, useEffect, useRef, useCallback, memo, lazy, Suspense
} from "react";
import { ArrowPathIcon } from "@heroicons/react/24/outline";
import { AnimatePresence } from "framer-motion";
import { useDarkMode } from "../../context/DarkModeContext";
import { useStories } from "../../context/StoryContext";
import { usePosts } from "../../context/PostsContext";
import { useAuth } from "../../context/AuthContext";

import PostCard from "./PostCard";
import StoryContainer from "./StoryContainer";
import StoryCreator from "./StoryCreator";

const StoryViewer = lazy(() => import("./StoryViewer"));
const ImmersivePyramidUniverse = lazy(() => import("./ImmersivePyramidUniverse"));

const fastTransition = { duration: 0.15, ease: "easeOut" };

// ============================================
// Skeleton LCP SAFE
// ============================================
const SkeletonPosts = ({ count = 3 }) =>
  [...Array(count)].map((_, i) => (
    <div key={i}>
      <PostCard loading />
    </div>
  ));

// ============================================
// Animated wrapper (NON-LCP)
// ============================================
const PostWrapper = ({ post, onDeleted, showToast }) => (
  <PostCard
    post={post}
    onDeleted={onDeleted}
    showToast={showToast}
  />
);

// ============================================
// Toast Simple
// ============================================
const Toast = ({ message, type = "info", onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColor = type === "error" ? "bg-red-500" : type === "success" ? "bg-green-500" : "bg-blue-500";

  return (
    <div className={`fixed bottom-4 right-4 ${bgColor} text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-slide-up`}>
      {message}
    </div>
  );
};

// ============================================
// HOME
// ============================================
const Home = ({ openStoryViewer: openStoryViewerProp, searchQuery = "" }) => {
  const { isDarkMode } = useDarkMode();
  const { fetchStories, stories = [], myStories } = useStories();
  const {
    posts = [],
    fetchNextPage,
    hasMore,
    loading: postsLoading,
    refetch,
    removePost
  } = usePosts() || {};
  const { user } = useAuth();

  const [showCreator, setShowCreator] = useState(false);
  const [showStoryViewer, setShowStoryViewer] = useState(false);
  const [viewerData, setViewerData] = useState({ stories: [], owner: null });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showPyramid, setShowPyramid] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [toast, setToast] = useState(null);

  const observerRef = useRef(null);
  const loadingRef = useRef(false);

  useEffect(() => {
    loadingRef.current = postsLoading;
    if (!postsLoading && posts.length > 0) setInitialLoad(false);
  }, [postsLoading, posts.length]);

  const showToast = useCallback((message, type = "info") => {
    setToast({ message, type });
  }, []);

  const handlePostDeleted = useCallback(
    (postId) => removePost?.(postId),
    [removePost]
  );

  const handleOpenStory = useCallback((stories, owner) => {
    if (openStoryViewerProp) openStoryViewerProp(stories, owner);
    else {
      setViewerData({ stories, owner });
      setShowStoryViewer(true);
    }
  }, [openStoryViewerProp]);

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await Promise.allSettled([
        refetch?.(),
        fetchNextPage?.(true),
        fetchStories(true),
      ]);
      showToast("Feed actualisé !", "success");
    } catch (error) {
      showToast("Erreur lors de l'actualisation", "error");
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, refetch, fetchNextPage, fetchStories, showToast]);

  const filteredPosts = useMemo(() => {
    if (!searchQuery.trim()) return posts;
    const q = searchQuery.toLowerCase();
    return posts.filter(p =>
      (p.content || "").toLowerCase().includes(q) ||
      (p.user?.fullName || "").toLowerCase().includes(q) ||
      (p.user?.username || "").toLowerCase().includes(q)
    );
  }, [posts, searchQuery]);

  const handleObserver = useCallback(
    (entries) => {
      if (
        entries[0].isIntersecting &&
        hasMore &&
        !loadingRef.current &&
        !isRefreshing
      ) {
        fetchNextPage();
      }
    },
    [hasMore, fetchNextPage, isRefreshing]
  );

  useEffect(() => {
    if (!observerRef.current) return;
    const obs = new IntersectionObserver(handleObserver, {
      rootMargin: "200px",
      threshold: 0.1,
    });
    obs.observe(observerRef.current);
    return () => obs.disconnect();
  }, [handleObserver]);

  return (
    <div className="flex flex-col h-full">
      {!showPyramid && (
        <>
          {/* STORIES - Sans bordure visible */}
          <div className={`sticky top-0 z-30 ${
            isDarkMode ? "bg-black" : "bg-white"
          }`}>
            <div className="h-full overflow-x-auto">
              <StoryContainer
                onOpenStory={handleOpenStory}
                onOpenCreator={() => setShowCreator(true)}
                onOpenPyramid={() => setShowPyramid(true)}
                isDarkMode={isDarkMode}
              />
            </div>
          </div>

          {/* FEED - Continuation fluide */}
          <div className="flex-1 overflow-y-auto">
            <div className="w-full lg:max-w-[630px] lg:mx-auto">

              {/* Message si recherche active */}
              {searchQuery && (
                <div className={`p-4 text-center ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  <p className="text-sm">
                    {filteredPosts.length} résultat{filteredPosts.length > 1 ? 's' : ''} pour "{searchQuery}"
                  </p>
                </div>
              )}

              {initialLoad && postsLoading ? (
                <SkeletonPosts />
              ) : filteredPosts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <div className={`text-6xl mb-4 ${isDarkMode ? 'opacity-20' : 'opacity-10'}`}>
                    🔍
                  </div>
                  <p className={`text-lg font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    {searchQuery ? "Aucun résultat trouvé" : "Aucun post à afficher"}
                  </p>
                </div>
              ) : (
                <>
                  {/* 🔥 PREMIER POST – LCP SAFE */}
                  {filteredPosts[0] && (
                    <PostCard
                      post={filteredPosts[0]}
                      onDeleted={handlePostDeleted}
                      showToast={showToast}
                    />
                  )}

                  {/* AUTRES POSTS ANIMÉS */}
                  <AnimatePresence>
                    {filteredPosts.slice(1).map(post => (
                      <PostWrapper
                        key={post._id}
                        post={post}
                        onDeleted={handlePostDeleted}
                        showToast={showToast}
                      />
                    ))}
                  </AnimatePresence>
                </>
              )}

              {/* Infinite Scroll Trigger */}
              {!searchQuery && hasMore && (
                <div ref={observerRef} className="h-20 flex items-center justify-center">
                  {postsLoading && (
                    <ArrowPathIcon className="w-6 h-6 animate-spin text-orange-500" />
                  )}
                </div>
              )}

              {/* Bouton Refresh */}
              {!postsLoading && posts.length > 0 && (
                <div className="py-8 flex justify-center">
                  <button
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className={`px-6 py-3 rounded-full font-semibold transition-all flex items-center gap-2 ${
                      isDarkMode 
                        ? 'bg-gray-800 text-white hover:bg-gray-700' 
                        : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                    } disabled:opacity-50`}
                  >
                    <ArrowPathIcon className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
                    {isRefreshing ? "Actualisation..." : "Actualiser le feed"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* MODALS */}
      <AnimatePresence>
        {showCreator && <StoryCreator onClose={() => setShowCreator(false)} />}
      </AnimatePresence>

      <AnimatePresence>
        {showStoryViewer && (
          <Suspense fallback={null}>
            <StoryViewer
              stories={viewerData.stories}
              currentUser={user}
              onClose={() => setShowStoryViewer(false)}
            />
          </Suspense>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPyramid && (
          <Suspense fallback={null}>
            <ImmersivePyramidUniverse
              onClose={() => setShowPyramid(false)}
              stories={stories}
              currentUser={user}
              onOpenStory={handleOpenStory}
            />
          </Suspense>
        )}
      </AnimatePresence>

      {/* TOAST */}
      <AnimatePresence>
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default memo(Home);