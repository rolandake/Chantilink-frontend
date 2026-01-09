// ============================================
// 📁 src/pages/Home/Home.jsx
// VERSION OPTIMISÉE LCP / CLS
// ============================================
import React, {
  useState, useMemo, useEffect, useRef, useCallback, memo, lazy, Suspense
} from "react";
import { MagnifyingGlassIcon, ArrowPathIcon } from "@heroicons/react/24/outline";
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
// HOME
// ============================================
const Home = ({ openStoryViewer: openStoryViewerProp }) => {
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

  const [searchQuery, setSearchQuery] = useState("");
  const [showCreator, setShowCreator] = useState(false);
  const [showStoryViewer, setShowStoryViewer] = useState(false);
  const [viewerData, setViewerData] = useState({ stories: [], owner: null });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showPyramid, setShowPyramid] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);

  const observerRef = useRef(null);
  const loadingRef = useRef(false);

  useEffect(() => {
    loadingRef.current = postsLoading;
    if (!postsLoading && posts.length > 0) setInitialLoad(false);
  }, [postsLoading, posts.length]);

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
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, refetch, fetchNextPage, fetchStories]);

  const filteredPosts = useMemo(() => {
    if (!searchQuery.trim()) return posts;
    const q = searchQuery.toLowerCase();
    return posts.filter(p =>
      (p.content || "").toLowerCase().includes(q) ||
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
          {/* STORIES */}
          <div className={`sticky top-0 z-30 h-[110px] min-h-[110px] ${
            isDarkMode ? "bg-black/90" : "bg-white/90"
          } backdrop-blur-xl border-b`}>
            <div className="h-full overflow-x-auto">
              <StoryContainer
                onOpenStory={handleOpenStory}
                onOpenCreator={() => setShowCreator(true)}
                isDarkMode={isDarkMode}
              />
            </div>
          </div>

          {/* FEED */}
          <div className="flex-1 overflow-y-auto">
            <div className="w-full lg:max-w-[630px] lg:mx-auto">

              {initialLoad && postsLoading ? (
                <SkeletonPosts />
              ) : (
                <>
                  {/* 🔥 PREMIER POST – LCP SAFE */}
                  {filteredPosts[0] && (
                    <PostCard
                      post={filteredPosts[0]}
                      isLCP
                      onDeleted={handlePostDeleted}
                    />
                  )}

                  {/* AUTRES POSTS ANIMÉS */}
                  <AnimatePresence>
                    {filteredPosts.slice(1).map(post => (
                      <PostWrapper
                        key={post._id}
                        post={post}
                        onDeleted={handlePostDeleted}
                      />
                    ))}
                  </AnimatePresence>
                </>
              )}

              <div ref={observerRef} className="h-4" />
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
    </div>
  );
};

export default memo(Home);
