// 📁 src/pages/Home/Home.jsx - VERSION FINALE SANS ERREURS ⚡
// Pull-to-refresh corrigé + Pas d'intervention warnings

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
import SmartAd from "./Publicite/SmartAd";

import MOCK_POSTS, { generateFullDataset } from "../../data/mockPosts";
import { MOCK_CONFIG as DEFAULT_MOCK_CONFIG, AD_CONFIG as DEFAULT_AD_CONFIG } from "../../data/mockConfig";
import NewsSection from "../../info/NewsSection";

const StoryViewer = lazy(() => import("./StoryViewer"));
const ImmersivePyramidUniverse = lazy(() => import("./ImmersivePyramidUniverse"));

const AD_CONFIG = DEFAULT_AD_CONFIG;
const MOCK_CONFIG = DEFAULT_MOCK_CONFIG;

// ============================================
// OPTIMISATION LCP
// ============================================
const preloadCriticalImages = (posts) => {
  if (!posts || posts.length === 0) return;
  
  const firstImagePost = posts.find(p => {
    const media = p.images?.[0] || p.media?.[0];
    if (!media) return false;
    const url = media.url || media;
    return url && !/\.(mp4|webm|mov|avi)$/i.test(url);
  });
  
  if (!firstImagePost) return;
  
  const img = firstImagePost.images?.[0] || firstImagePost.media?.[0];
  const imgUrl = img?.url || img;
  
  if (imgUrl) {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = imgUrl;
    link.fetchPriority = 'high';
    document.head.appendChild(link);
    
    const preloadImg = new Image();
    preloadImg.fetchPriority = 'high';
    preloadImg.src = imgUrl;
  }
};

// ============================================
// Skeleton
// ============================================
const SkeletonPosts = memo(({ count = 3, isDarkMode }) => (
  <div style={{ minHeight: `${count * 700}px` }}>
    {[...Array(count)].map((_, i) => (
      <div 
        key={i} 
        className={`mb-4 rounded-xl overflow-hidden ${
          isDarkMode ? 'bg-gray-900' : 'bg-white'
        }`}
        style={{ margin: 0, padding: 0, minHeight: '600px' }}
      >
        <div className="p-3 flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full animate-pulse ${
            isDarkMode ? 'bg-gray-800' : 'bg-gray-300'
          }`} />
          <div className="flex-1 space-y-2">
            <div className={`h-4 rounded w-32 animate-pulse ${
              isDarkMode ? 'bg-gray-800' : 'bg-gray-300'
            }`} />
            <div className={`h-3 rounded w-20 animate-pulse ${
              isDarkMode ? 'bg-gray-700' : 'bg-gray-200'
            }`} />
          </div>
        </div>
        
        <div 
          className={`w-full animate-pulse ${
            isDarkMode ? 'bg-gray-800' : 'bg-gray-300'
          }`}
          style={{ aspectRatio: '1 / 1' }}
        />
        
        <div className="p-3 flex items-center gap-4">
          {[1, 2, 3].map(i => (
            <div 
              key={i}
              className={`h-6 w-6 rounded animate-pulse ${
                isDarkMode ? 'bg-gray-800' : 'bg-gray-300'
              }`}
            />
          ))}
        </div>
      </div>
    ))}
  </div>
));

SkeletonPosts.displayName = 'SkeletonPosts';

// ============================================
// Pull to Refresh - SANS ERREURS D'INTERVENTION
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
          style={{ willChange: 'transform, opacity' }}
        >
          <div className={`relative w-10 h-10 rounded-full flex items-center justify-center ${
            isDarkMode ? 'bg-gray-800/95' : 'bg-white/95'
          } backdrop-blur-md shadow-lg border ${
            isDarkMode ? 'border-gray-700' : 'border-gray-200'
          }`}>
            <svg className="absolute inset-0 -rotate-90" viewBox="0 0 40 40">
              <circle cx="20" cy="20" r="16" fill="none" stroke={isDarkMode ? '#374151' : '#e5e7eb'} strokeWidth="2" />
              <circle
                cx="20" cy="20" r="16" fill="none" stroke="#f97316" strokeWidth="2"
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

PullToRefreshIndicator.displayName = 'PullToRefreshIndicator';

// ============================================
// Post Wrapper
// ============================================
const PostWrapper = memo(({ post, onDeleted, showToast, isPriority = false, forceImageLCP = false }) => (
  <div style={{ margin: 0, padding: 0 }}>
    <PostCard
      post={post}
      onDeleted={onDeleted}
      showToast={showToast}
      mockPost={false}
      priority={isPriority}
      forcePosterForVideo={forceImageLCP}
    />
  </div>
));

PostWrapper.displayName = 'PostWrapper';

// ============================================
// Post avec Pub
// ============================================
const PostWithAd = memo(({ post, index, onDeleted, showToast, adConfig }) => {
  const shouldShowAd = adConfig.enabled && index > 0 && (index % adConfig.frequency === 0);

  return (
    <>
      <PostWrapper post={post} onDeleted={onDeleted} showToast={showToast} />
      {shouldShowAd && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          style={{ margin: 0, padding: 0, minHeight: '250px' }}
        >
          <SmartAd slot="feedInline" canClose={true} />
        </motion.div>
      )}
    </>
  );
});

PostWithAd.displayName = 'PostWithAd';

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
// HOME COMPONENT - VERSION FINALE ⚡
// ============================================
const Home = ({ openStoryViewer: openStoryViewerProp, searchQuery = "" }) => {
  const { isDarkMode } = useDarkMode();
  const { fetchStories, stories = [] } = useStories();
  const {
    posts: realPosts = [],
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

  const [mockPostsCount, setMockPostsCount] = useState(MOCK_CONFIG.initialCount);
  const showMockPosts = MOCK_CONFIG.enabled;

  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const touchStartY = useRef(0);
  const isRefreshingPull = useRef(false);
  const canPull = useRef(true);

  const observerRef = useRef(null);
  const loadingRef = useRef(false);
  const containerRef = useRef(null);
  const mockGenStarted = useRef(false);

  const showNews = !!user;

  // ============================================
  // CHARGEMENT INITIAL
  // ============================================
  useEffect(() => {
    loadingRef.current = postsLoading;
    
    if (!postsLoading && realPosts.length > 0) {
      setInitialLoad(false);
      preloadCriticalImages(realPosts);
    }
  }, [postsLoading, realPosts]);

  // ============================================
  // GÉNÉRATION LAZY OPTIMISÉE
  // ============================================
  useEffect(() => {
    if (mockGenStarted.current || initialLoad || !MOCK_CONFIG.enabled) {
      return;
    }
    
    const shouldGenerate = MOCK_CONFIG.totalPosts > 100 && 
                          MOCK_CONFIG.lazyGeneration?.enabled !== false;
    
    if (!shouldGenerate) {
      return;
    }
    
    const generationDelay = 30000; // 30s minimum
    
    const timer = setTimeout(() => {
      if (mockGenStarted.current) return;
      
      mockGenStarted.current = true;
      console.log('🚀 Démarrage génération lazy...');
      
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(() => {
          generateFullDataset((progress) => {
            if (progress.percent === 100) {
              console.log('✅ Génération terminée');
            }
          }).catch(() => {
            mockGenStarted.current = false;
          });
        }, { timeout: 60000 });
      } else {
        setTimeout(() => {
          generateFullDataset().catch(() => {
            mockGenStarted.current = false;
          });
        }, 1000);
      }
    }, generationDelay);
    
    return () => clearTimeout(timer);
  }, [initialLoad]);

  const isValidPost = useCallback((post) => {
    if (!post || !post._id) return false;
    if (post._isMock || post.isMockPost || post._id?.startsWith('post_')) return true;
    
    const user = post.user || post.author || {};
    const fullName = user.fullName || post.fullName || "";
    
    const isUnknownUser = fullName === "Utilisateur Inconnu" || 
                         fullName === "Unknown User" ||
                         fullName.trim() === "" ||
                         fullName === "undefined" ||
                         fullName === "null";
    
    const hasNoUserId = !user._id && !post.userId && !post.author?._id;
    const isBannedOrDeleted = user.isBanned || user.isDeleted || 
                              user.status === 'deleted' || user.status === 'banned';
    const isInvalidUserId = user._id === 'unknown' || user._id === 'null' || user._id === 'undefined';
    
    if ((isUnknownUser || hasNoUserId || isInvalidUserId) && !post._isMock) return false;
    if (isBannedOrDeleted) return false;
    
    return true;
  }, []);

  const combinedPosts = useMemo(() => {
    const validRealPosts = realPosts.filter(isValidPost);
    
    if (!showMockPosts) return validRealPosts;

    const mockPostsSlice = MOCK_POSTS.slice(0, mockPostsCount);
    if (MOCK_CONFIG.mixWithRealPosts && validRealPosts.length > 0) {
      const combined = [];
      let mockIndex = 0;
      let realIndex = 0;
      const ratio = MOCK_CONFIG.realPostsRatio || 2;

      while (mockIndex < mockPostsSlice.length || realIndex < validRealPosts.length) {
        for (let i = 0; i < ratio && realIndex < validRealPosts.length; i++) {
          combined.push({ ...validRealPosts[realIndex], _isMock: false });
          realIndex++;
        }
        if (mockIndex < mockPostsSlice.length) {
          combined.push({ ...mockPostsSlice[mockIndex], _isMock: true });
          mockIndex++;
        }
      }
      return combined;
    }
    return mockPostsSlice.map(post => ({ ...post, _isMock: true }));
  }, [realPosts, mockPostsCount, showMockPosts, isValidPost]);

  const showToast = useCallback((message, type = "info") => {
    setToast({ message, type });
  }, []);

  const handlePostDeleted = useCallback(
    (postId) => {
      removePost?.(postId);
    },
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
      await Promise.allSettled([fetchStories(true), refetch?.()]);
      showToast("Actualisé !", "success");
    } catch (error) {
      showToast("Erreur lors de l'actualisation", "error");
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, refetch, fetchStories, showToast]);

  // ============================================
  // ⚡ PULL-TO-REFRESH SANS ERREURS D'INTERVENTION
  // ============================================
  useEffect(() => {
    const THRESHOLD = 100;
    let lastUpdate = 0;
    const UPDATE_INTERVAL = 16; // 60fps max
    let canPreventDefault = false;

    const resetPull = () => { 
      setPullDistance(0); 
      setIsPulling(false); 
      canPull.current = true;
      canPreventDefault = false;
    };

    const triggerRefresh = async () => {
      if (isRefreshingPull.current) return;
      isRefreshingPull.current = true;
      setIsPulling(false);
      canPull.current = false;
      await handleRefresh();
      isRefreshingPull.current = false;
      setTimeout(resetPull, 300);
    };

    const handleTouchStart = (e) => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      
      if (scrollTop <= 5 && canPull.current) {
        touchStartY.current = e.touches[0].clientY;
        canPreventDefault = true; // ✅ On peut prévenir au début
      } else {
        canPreventDefault = false;
      }
    };

    const handleTouchMove = (e) => {
      if (!canPull.current || touchStartY.current === 0) return;
      
      const currentY = e.touches[0].clientY;
      const pullDown = currentY - touchStartY.current;
      
      if (pullDown > 20) {
        // ✅ NE FAIRE preventDefault() QUE SI C'EST SÛREMENT POSSIBLE
        // Et seulement au-delà d'un certain seuil
        if (pullDown > 60 && canPreventDefault && e.cancelable) {
          try {
            e.preventDefault();
          } catch (err) {
            // Silencieusement ignorer si preventDefault échoue
          }
        }
        
        // ✅ Throttle les updates (60fps max)
        const now = Date.now();
        if (now - lastUpdate < UPDATE_INTERVAL) return;
        lastUpdate = now;
        
        const distance = Math.min(pullDown * 0.4, THRESHOLD * 1.5);
        setPullDistance(distance);
        setIsPulling(distance > THRESHOLD);
      }
    };

    const handleTouchEnd = () => {
      if (pullDistance > THRESHOLD && !isRefreshingPull.current) {
        triggerRefresh();
      } else {
        resetPull();
      }
      touchStartY.current = 0;
      canPreventDefault = false;
    };

    // ✅ ÉVÉNEMENTS AVEC OPTIONS CORRECTES
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    
    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [pullDistance, handleRefresh]);

  const filteredPosts = useMemo(() => {
    if (!searchQuery.trim()) return combinedPosts;
    const q = searchQuery.toLowerCase();
    return combinedPosts.filter(p =>
      (p.content || "").toLowerCase().includes(q) ||
      (p.user?.fullName || "").toLowerCase().includes(q)
    );
  }, [combinedPosts, searchQuery]);

  const handleObserver = useCallback(
    (entries) => {
      if (entries[0].isIntersecting && !loadingRef.current && !isRefreshing) {
        if (showMockPosts && mockPostsCount < MOCK_POSTS.length) {
          setMockPostsCount(prev => Math.min(prev + MOCK_CONFIG.loadMoreCount, MOCK_POSTS.length));
        }
        if (hasMore) fetchNextPage();
      }
    },
    [hasMore, fetchNextPage, isRefreshing, showMockPosts, mockPostsCount]
  );

  useEffect(() => {
    if (!observerRef.current) return;
    const obs = new IntersectionObserver(handleObserver, { rootMargin: "200px" });
    obs.observe(observerRef.current);
    return () => obs.disconnect();
  }, [handleObserver]);

  const firstPostIsVideo = useMemo(() => {
    if (!filteredPosts[0]) return false;
    const media = filteredPosts[0].images?.[0] || filteredPosts[0].media?.[0];
    if (!media) return false;
    const url = media.url || media;
    return url && /\.(mp4|webm|mov|avi)$/i.test(url);
  }, [filteredPosts]);

  return (
    <div 
      ref={containerRef}
      className="flex flex-col h-full scrollbar-hide"
      style={{ minHeight: '100vh' }}
    >
      <PullToRefreshIndicator 
        isPulling={isPulling} 
        pullDistance={pullDistance} 
        isDarkMode={isDarkMode} 
      />

      {!showPyramid && (
        <>
          <div 
            className={`sticky top-0 z-30 ${isDarkMode ? "bg-black" : "bg-white"}`}
            style={{ height: '120px', minHeight: '120px' }}
          >
            <StoryContainer
              onOpenStory={handleOpenStory}
              onOpenCreator={() => setShowCreator(true)}
              onOpenPyramid={() => setShowPyramid(true)}
              isDarkMode={isDarkMode}
            />
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-hide">
            <div className="w-full lg:max-w-[630px] lg:mx-auto">
              
              {searchQuery && (
                <div className={`p-4 text-center ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  <p className="text-sm">{filteredPosts.length} résultat(s) pour "{searchQuery}"</p>
                </div>
              )}

              {initialLoad && postsLoading && !showMockPosts ? (
                <SkeletonPosts count={3} isDarkMode={isDarkMode} />
              ) : filteredPosts.length === 0 ? (
                <div 
                  className="flex flex-col items-center justify-center py-20"
                  style={{ minHeight: '400px' }}
                >
                  <p className={`text-lg font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Aucun post à afficher
                  </p>
                </div>
              ) : (
                <>
                  {showNews && (
                    <div className="mb-4">
                      <NewsSection 
                        maxArticles={3} 
                        showCategories={true}
                        enabled={showNews}
                      />
                    </div>
                  )}

                  {filteredPosts[0] && (
                    <div style={{ margin: 0, padding: 0 }}>
                      <PostCard
                        post={filteredPosts[0]}
                        onDeleted={handlePostDeleted}
                        showToast={showToast}
                        priority={true}
                        forcePosterForVideo={firstPostIsVideo}
                      />
                    </div>
                  )}

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
                </>
              )}

              {!searchQuery && (hasMore || mockPostsCount < MOCK_POSTS.length) && (
                <div 
                  ref={observerRef} 
                  className="h-20 flex items-center justify-center"
                  style={{ minHeight: '80px' }}
                >
                  <ArrowPathIcon className="w-6 h-6 animate-spin text-orange-500" />
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <AnimatePresence>
        {showCreator && <StoryCreator onClose={() => setShowCreator(false)} />}
        {showStoryViewer && (
          <Suspense fallback={null}>
            <StoryViewer 
              stories={viewerData.stories} 
              currentUser={user} 
              onClose={() => setShowStoryViewer(false)} 
            />
          </Suspense>
        )}
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
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </AnimatePresence>
    </div>
  );
};

export default memo(Home);