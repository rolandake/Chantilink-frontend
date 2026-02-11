// ============================================
// 📁 src/pages/Home/Home.final.jsx
// VERSION FINALE - Avec système de publicités intelligent
// ============================================
import React, {
  useState, useMemo, useEffect, useRef, useCallback, memo, lazy, Suspense
} from "react";
import { ArrowPathIcon } from "@heroicons/react/24/outline";
import { AnimatePresence, motion } from "framer-motion";
import { useDarkMode } from "../../context/DarkModeContext";
import { useStories } from "../../context/StoryContext";
import { usePosts } from "../../context/PostsContext";
import { useAuth } from "../../context/AuthContext";

import PostCard from "./PostCard";
import StoryContainer from "./StoryContainer";
import StoryCreator from "./StoryCreator";
import SmartAd from "./Publicite/SmartAd"; // 🎯 Utilise SmartAd au lieu de DemoAdCard

const StoryViewer = lazy(() => import("./StoryViewer"));
const ImmersivePyramidUniverse = lazy(() => import("./ImmersivePyramidUniverse"));

// ============================================
// Configuration des publicités
// ============================================
const AD_CONFIG = {
  enabled: true, // Activer/désactiver les pubs
  frequency: 3, // Une pub tous les X posts
};

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
// Pull to Refresh Indicator
// ============================================
const PullToRefreshIndicator = memo(({ isPulling, pullDistance, isDarkMode, threshold = 100 }) => {
  const progress = Math.min((pullDistance / threshold) * 100, 100);
  const opacity = Math.min(pullDistance / 60, 1);

  return (
    <AnimatePresence>
      {pullDistance > 20 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: opacity, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.2 }}
          className="fixed top-24 left-1/2 -translate-x-1/2 z-[45] pointer-events-none"
        >
          <div className={`relative w-10 h-10 rounded-full flex items-center justify-center ${
            isDarkMode ? 'bg-gray-800/95' : 'bg-white/95'
          } backdrop-blur-md shadow-lg border ${
            isDarkMode ? 'border-gray-700' : 'border-gray-200'
          }`}>
            <svg className="absolute inset-0 -rotate-90" viewBox="0 0 40 40">
              <circle
                cx="20"
                cy="20"
                r="16"
                fill="none"
                stroke={isDarkMode ? '#374151' : '#e5e7eb'}
                strokeWidth="2"
              />
              <circle
                cx="20"
                cy="20"
                r="16"
                fill="none"
                stroke="#f97316"
                strokeWidth="2"
                strokeDasharray={`${2 * Math.PI * 16}`}
                strokeDashoffset={`${2 * Math.PI * 16 * (1 - progress / 100)}`}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 0.1s linear' }}
              />
            </svg>
            
            <ArrowPathIcon
              className={`w-5 h-5 ${isPulling ? 'text-orange-500' : 'text-gray-400'}`}
              style={{ 
                transform: `rotate(${(pullDistance / threshold) * 360}deg)`,
                transition: 'transform 0.1s linear'
              }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

// ============================================
// Post Wrapper
// ============================================
const PostWrapper = ({ post, onDeleted, showToast }) => (
  <PostCard
    post={post}
    onDeleted={onDeleted}
    showToast={showToast}
  />
);

// ============================================
// Composant pour insérer les publicités (VERSION SMART)
// ============================================
const PostWithAd = memo(({ 
  post, 
  index, 
  onDeleted, 
  showToast, 
  adConfig 
}) => {
  const shouldShowAd = adConfig.enabled && 
                       index > 0 && 
                       (index % adConfig.frequency === 0);

  return (
    <>
      <PostWrapper
        post={post}
        onDeleted={onDeleted}
        showToast={showToast}
      />
      
      {shouldShowAd && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          {/* 🎯 SmartAd choisit automatiquement entre Demo et Google */}
          <SmartAd 
            slot="feedInline" 
            canClose={true}
            autoRotate={false}
          />
        </motion.div>
      )}
    </>
  );
});

// ============================================
// Toast
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
// HOME COMPONENT
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

  // États Pull to Refresh
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const touchStartY = useRef(0);
  const touchStartTime = useRef(0);
  const isRefreshingPull = useRef(false);
  const lastScrollY = useRef(0);
  const canPull = useRef(true);

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
        fetchStories(true),
        refetch?.(),
      ]);
      showToast("Actualisé !", "success");
    } catch (error) {
      console.error('Erreur refresh:', error);
      showToast("Erreur", "error");
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, refetch, fetchStories, showToast]);

  // Pull to Refresh Logic
  useEffect(() => {
    const THRESHOLD = 100;
    const MIN_PULL_DURATION = 300;

    const resetPull = () => {
      setPullDistance(0);
      setIsPulling(false);
      canPull.current = true;
    };

    const triggerRefresh = async () => {
      if (isRefreshingPull.current) return;
      
      isRefreshingPull.current = true;
      setIsPulling(false);
      canPull.current = false;
      
      try {
        await handleRefresh();
      } catch (error) {
        console.error('❌ Erreur refresh:', error);
      } finally {
        isRefreshingPull.current = false;
        setTimeout(() => resetPull(), 500);
      }
    };

    const handleTouchStart = (e) => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      
      if (scrollTop <= 2 && canPull.current && !isRefreshingPull.current) {
        touchStartY.current = e.touches[0].clientY;
        touchStartTime.current = Date.now();
      } else {
        touchStartY.current = 0;
      }
    };

    const handleTouchMove = (e) => {
      if (isRefreshingPull.current || !canPull.current || touchStartY.current === 0) return;

      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const touchY = e.touches[0].clientY;
      const pullDown = touchY - touchStartY.current;

      if (scrollTop <= 2 && pullDown > 20) {
        if (pullDown > 40) {
          e.preventDefault();
        }
        
        const resistance = 0.4;
        const distance = Math.min(pullDown * resistance, THRESHOLD * 1.5);
        setPullDistance(distance);
        setIsPulling(distance > THRESHOLD);
      } else if (pullDown < -10) {
        resetPull();
      }
    };

    const handleTouchEnd = () => {
      const pullDuration = Date.now() - touchStartTime.current;
      
      if (
        pullDistance > THRESHOLD && 
        pullDuration >= MIN_PULL_DURATION &&
        !isRefreshingPull.current
      ) {
        triggerRefresh();
      } else {
        resetPull();
      }
      
      touchStartY.current = 0;
    };

    const handleScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      
      if (
        scrollTop === 0 && 
        lastScrollY.current > 200 && 
        !isRefreshingPull.current &&
        canPull.current
      ) {
        setTimeout(() => {
          const finalScrollTop = window.scrollY || document.documentElement.scrollTop;
          if (finalScrollTop === 0 && canPull.current) {
            triggerRefresh();
          }
        }, 150);
      }
      
      lastScrollY.current = scrollTop;
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [pullDistance, handleRefresh]);

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
    <div className="flex flex-col h-full scrollbar-hide">
      {/* Pull to Refresh Indicator */}
      <PullToRefreshIndicator 
        isPulling={isPulling} 
        pullDistance={pullDistance} 
        isDarkMode={isDarkMode}
        threshold={100}
      />

      {!showPyramid && (
        <>
          {/* STORIES */}
          <div className={`sticky top-0 z-30 ${
            isDarkMode ? "bg-black" : "bg-white"
          }`}>
            <div className="h-full overflow-x-auto scrollbar-hide">
              <StoryContainer
                onOpenStory={handleOpenStory}
                onOpenCreator={() => setShowCreator(true)}
                onOpenPyramid={() => setShowPyramid(true)}
                isDarkMode={isDarkMode}
              />
            </div>
          </div>

          {/* FEED AVEC PUBLICITÉS */}
          <div className="flex-1 overflow-y-auto scrollbar-hide">
            <div className="w-full lg:max-w-[630px] lg:mx-auto">

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
                  {/* Premier post sans pub */}
                  {filteredPosts[0] && (
                    <PostCard
                      post={filteredPosts[0]}
                      onDeleted={handlePostDeleted}
                      showToast={showToast}
                    />
                  )}

                  {/* Posts suivants avec publicités intercalées */}
                  <AnimatePresence>
                    {filteredPosts.slice(1).map((post, index) => (
                      <PostWithAd
                        key={post._id}
                        post={post}
                        index={index + 1}
                        onDeleted={handlePostDeleted}
                        showToast={showToast}
                        adConfig={AD_CONFIG}
                      />
                    ))}
                  </AnimatePresence>
                </>
              )}

              {!searchQuery && hasMore && (
                <div ref={observerRef} className="h-20 flex items-center justify-center">
                  {postsLoading && (
                    <ArrowPathIcon className="w-6 h-6 animate-spin text-orange-500" />
                  )}
                </div>
              )}

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
                    {isRefreshing ? "Actualisation..." : "Actualiser"}
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