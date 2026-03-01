// 📁 src/pages/Home/Home.jsx
// ✅ FIX INP : sentinel IntersectionObserver → setDisplayedPosts dans startTransition
// ✅ FIX INP : handleApiObserver aussi dans startTransition
// ✅ FIX LCP : injectPreloadLink dès le 1er render synchrone (avant useEffect)
// ✅ ImmersivePyramidUniverse → modal portal avec prop isOpen
// ✅ Le feed reste visible en arrière-plan pendant que l'univers est ouvert
//
// 🔥 FIX VIDÉOS INDISPONIBLES : hasStaleMediaUrl() filtre les URLs expirées
// 🔥 FIX REFRESH FEED : tap Home = fresh feed (Instagram/TikTok behavior)
//
// 🚀 FIX SCROLL PERFORMANCE
// ✨ PREMIUM REFRESH ANIMATIONS (Instagram/TikTok style)
//
// 🔄 FIX VARIÉTÉ DU FEED :
//    - shuffleSeed change à chaque refresh → ordre différent à chaque fois
//    - seededShuffle() déterministe par seed → stable pendant le scroll
//    - On consomme les posts depuis un offset aléatoire dans le pool
//    - Les posts API récents sont toujours mis en avant (slice HEAD)
//    - PAGE_SIZE 16, MAX_DOM_POSTS 600, API_PREFETCH_PAGES 3

import React, {
  useState, useMemo, useEffect, useRef, useCallback,
  memo, lazy, Suspense, startTransition, useDeferredValue, useTransition
} from "react";
import { ArrowPathIcon, ArrowTopRightOnSquareIcon, ArrowUpIcon } from "@heroicons/react/24/outline";
import { AnimatePresence, motion } from "framer-motion";
import { useDarkMode } from "../../context/DarkModeContext";
import { useStories } from "../../context/StoryContext";
import { usePosts } from "../../context/PostsContext";
import { useAuth } from "../../context/AuthContext";
import { useNews } from "../../hooks/useNews";
import axiosClient from "../../api/axiosClientGlobal";
import PostCard from "./PostCard";
import StoryContainer from "./StoryContainer";
import SuggestedAccounts from "./SuggestedAccounts";
import SuggestedPostPreview from "./SuggestedPostPreview";
import SmartAd from "./Publicite/SmartAd";
import ArticleReaderModal from "./ArticleReaderModal";
import MOCK_POSTS, { generateFullDataset } from "../../data/mockPosts";
import { MOCK_CONFIG as DEFAULT_MOCK_CONFIG, AD_CONFIG as DEFAULT_AD_CONFIG } from "../../data/mockConfig";

const HOME_REFRESH_EVENT = "home:refresh";

const StoryCreator             = lazy(() => import("./StoryCreator"));
const StoryViewer              = lazy(() => import("./StoryViewer"));
const ImmersivePyramidUniverse = lazy(() => import("./ImmersivePyramidUniverse"));

const AD_CONFIG   = DEFAULT_AD_CONFIG;
const MOCK_CONFIG = DEFAULT_MOCK_CONFIG;

const NEWS_INSERT_AFTER = 2;
const NEWS_REPEAT_EVERY = 8;
const SUGGEST_EVERY       = 8;  // carousel profils simples toutes les 8 publications
const SUGGEST_POST_EVERY  = 5;  // profil + publication toutes les 5 publications
const PAGE_SIZE         = 16;
const MAX_DOM_POSTS     = 600;
const POLL_INTERVAL     = 30_000;
const STORY_BAR_HEIGHT  = 120;

const API_PREFETCH_PAGES = 3;

const MIX_BLOCK_SIZE  = 5;
const MIX_MAX_BOTS    = 2;

// ─── Durées des animations de refresh ────────────────
const RIPPLE_DURATION_MS = 600;
const WAVE_DURATION_MS   = 780;
const WAVE_STAGGER_S     = 0.05;
const WAVE_POST_DURATION = 0.38;
const WAVE_POST_COUNT    = 7;
// ─────────────────────────────────────────────────────

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "dlymdclhe";
const IMG_BASE   = `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/`;

// ─────────────────────────────────────────────
// PRELOAD LCP
// ─────────────────────────────────────────────
const _preloadedUrls = new Set();
const injectPreloadLink = (url, asType = "image") => {
  if (!url || _preloadedUrls.has(url)) return;
  _preloadedUrls.add(url);
  if (document.querySelector(`link[rel="preload"][href="${url}"]`)) return;
  const link = document.createElement("link");
  link.rel = "preload"; link.as = asType; link.href = url; link.fetchPriority = "high";
  document.head.appendChild(link);
};
const isVideoUrl = url => url && /\.(mp4|webm|mov|avi)$/i.test(url);
const getVideoPosterUrlForPreload = (videoUrl) => {
  if (!videoUrl) return null;
  try {
    if (videoUrl.includes("res.cloudinary.com")) {
      const uploadIndex = videoUrl.indexOf("/upload/");
      if (uploadIndex === -1) return null;
      const afterUpload = videoUrl.substring(uploadIndex + 8);
      const segments = afterUpload.split("/");
      const publicIdSegments = [];
      for (const seg of segments) {
        const isTransform = seg.includes(",") || (/^[a-z]+_[a-z]/.test(seg) && !seg.includes("."));
        if (!isTransform) publicIdSegments.push(seg);
      }
      const publicId = publicIdSegments.join("/").replace(/\.(mp4|webm|mov|avi)$/i, "");
      if (!publicId) return null;
      return `${IMG_BASE}q_auto:good,f_jpg,w_1080,c_limit,so_0/${publicId}.jpg`;
    }
    const withoutExt = videoUrl.replace(/^\/+/, "").replace(/\.(mp4|webm|mov|avi)$/i, "");
    return `${IMG_BASE}q_auto:good,f_jpg,w_1080,c_limit,so_0/${withoutExt}.jpg`;
  } catch { return null; }
};
const getLCPImageUrl = (posts) => {
  if (!posts?.length) return null;
  const p = posts[0];
  if (!p) return null;
  const m = p.images?.[0] || p.media?.[0];
  const url = m?.url || m;
  if (!url) return null;
  if (isVideoUrl(url)) return { url: getVideoPosterUrlForPreload(url), type: "image" };
  return { url, type: "image" };
};

// ─────────────────────────────────────────────
// 🔄 SEEDED SHUFFLE — stable pendant le scroll,
// mais change d'ordre à chaque refresh (seed différente)
// ─────────────────────────────────────────────
const seededShuffle = (arr, seed) => {
  const result = [...arr];
  let s = seed >>> 0;
  for (let i = result.length - 1; i > 0; i--) {
    s = (Math.imul(s ^ (s >>> 15), s | 1) ^ (s + (Math.imul(s ^ (s >>> 7), s | 61)))) >>> 0;
    const j = s % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

// ─────────────────────────────────────────────
// 🔄 MIX BOTS + RÉELS — algorithme par blocs
// ─────────────────────────────────────────────
function mixPostsByBlocks(realPosts, botPosts) {
  if (!botPosts.length) return realPosts;
  if (!realPosts.length) return botPosts;

  const result = [];
  let ri = 0, bi = 0;

  while (ri < realPosts.length || bi < botPosts.length) {
    const block = [];
    let botsInBlock = 0;
    while (block.length < MIX_BLOCK_SIZE) {
      const canAddBot  = bi < botPosts.length && botsInBlock < MIX_MAX_BOTS;
      const canAddReal = ri < realPosts.length;
      if (!canAddReal && !canAddBot) break;

      if (canAddBot && canAddReal) {
        const botSlot = Math.floor(block.length * MIX_MAX_BOTS / MIX_BLOCK_SIZE);
        if (botsInBlock < botSlot) {
          block.push({ ...botPosts[bi++], _isBot: true });
          botsInBlock++;
        } else {
          block.push(realPosts[ri++]);
        }
      } else if (canAddReal) {
        block.push(realPosts[ri++]);
      } else {
        block.push({ ...botPosts[bi++], _isBot: true });
        botsInBlock++;
      }
    }
    const head = block[0];
    const tail = block.slice(1).sort(() => Math.random() - 0.5);
    result.push(head, ...tail);
  }

  return result;
}

// ─────────────────────────────────────────────
// SKELETON
// ─────────────────────────────────────────────
const SkeletonPosts = memo(({ count = 3, isDarkMode }) => (
  <div>
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className={isDarkMode ? "bg-black" : "bg-white"} style={{ marginBottom: 1 }}>
        <div className="p-3 flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex-shrink-0 animate-pulse ${isDarkMode ? "bg-gray-800" : "bg-gray-200"}`} />
          <div className="flex-1 space-y-2">
            <div className={`h-4 rounded w-32 animate-pulse ${isDarkMode ? "bg-gray-800" : "bg-gray-200"}`} />
            <div className={`h-3 rounded w-20 animate-pulse ${isDarkMode ? "bg-gray-700" : "bg-gray-100"}`} />
          </div>
        </div>
        <div className={`w-full aspect-square animate-pulse ${isDarkMode ? "bg-gray-800" : "bg-gray-200"}`} />
        <div className="flex items-center gap-4 p-3">
          {[0,1,2].map(j => <div key={j} className={`w-6 h-6 rounded animate-pulse ${isDarkMode ? "bg-gray-800" : "bg-gray-200"}`} />)}
        </div>
      </div>
    ))}
  </div>
));
SkeletonPosts.displayName = "SkeletonPosts";

// ─────────────────────────────────────────────
// NEW POSTS BANNER
// ─────────────────────────────────────────────
const NewPostsBanner = memo(({ count, onClick, isDarkMode }) => (
  <AnimatePresence>
    {count > 0 && (
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className="sticky z-20 flex justify-center px-4 pb-2 pointer-events-none"
        style={{ top: STORY_BAR_HEIGHT + 8 }}
      >
        <button onClick={onClick}
          className="pointer-events-auto flex items-center gap-2 px-5 py-2.5 rounded-full shadow-xl text-sm font-bold bg-gradient-to-r from-orange-500 to-pink-500 text-white active:scale-95 transition-transform select-none"
          style={{ WebkitTapHighlightColor: "transparent" }}>
          <ArrowUpIcon className="w-4 h-4" />
          {count === 1 ? "1 nouveau post" : `${count} nouveaux posts`}
        </button>
      </motion.div>
    )}
  </AnimatePresence>
));
NewPostsBanner.displayName = "NewPostsBanner";

// ─────────────────────────────────────────────
// PULL-TO-REFRESH INDICATOR
// ─────────────────────────────────────────────
const PTR_THRESHOLD = 100;
const CIRCLE_R      = 16;
const CIRCLE_C      = 2 * Math.PI * CIRCLE_R;

const PullToRefreshIndicator = memo(({ isPulling, pullDistance, isRefreshing, isDarkMode }) => {
  const progress   = Math.min(pullDistance / PTR_THRESHOLD, 1);
  const opacity    = Math.min(pullDistance / 50, 1);
  const dashOffset = CIRCLE_C * (1 - progress);
  const iconDeg    = progress * 270;

  return (
    <AnimatePresence>
      {(pullDistance > 15 || isRefreshing) && (
        <motion.div
          initial={{ opacity: 0, y: -10, scale: 0.75 }}
          animate={{
            opacity: isRefreshing ? 1 : opacity,
            y:       0,
            scale:   (isPulling || isRefreshing) ? 1.08 : 1,
          }}
          exit={{ opacity: 0, y: -10, scale: 0.75 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className="fixed left-1/2 -translate-x-1/2 z-[45] pointer-events-none flex flex-col items-center gap-1.5"
          style={{ top: STORY_BAR_HEIGHT + 14 }}
        >
          <AnimatePresence>
            {(isPulling || isRefreshing) && (
              <motion.div
                key="ptr-burst"
                className="absolute rounded-full"
                style={{
                  width: 70, height: 70,
                  top: -15, left: -15,
                  background: "radial-gradient(circle, rgba(249,115,22,0.38) 0%, transparent 70%)",
                  zIndex: -1,
                }}
                initial={{ opacity: 0.85, scale: 0.6 }}
                animate={{ opacity: 0, scale: 2.4 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.55, ease: "easeOut" }}
              />
            )}
          </AnimatePresence>
          <div
            className="relative w-11 h-11 rounded-full flex items-center justify-center"
            style={{
              background: isDarkMode ? "rgba(15,15,15,0.93)" : "rgba(255,255,255,0.96)",
              backdropFilter: "blur(14px)",
              WebkitBackdropFilter: "blur(14px)",
              boxShadow: (isPulling || isRefreshing)
                ? "0 0 0 2.5px rgba(249,115,22,0.45), 0 6px 24px rgba(249,115,22,0.22)"
                : "0 3px 16px rgba(0,0,0,0.13)",
              border: isDarkMode ? "1px solid rgba(255,255,255,0.07)" : "1px solid rgba(0,0,0,0.05)",
              transition: "box-shadow 0.25s ease",
            }}
          >
            <svg
              className={isRefreshing ? "animate-spin" : ""}
              width="44" height="44" viewBox="0 0 44 44"
              style={{ position: "absolute", inset: 0 }}
            >
              <circle cx="22" cy="22" r={CIRCLE_R} fill="none"
                stroke={isDarkMode ? "#292929" : "#eeeeee"} strokeWidth="2.2" />
              <circle cx="22" cy="22" r={CIRCLE_R} fill="none"
                stroke="url(#ptrGradient)" strokeWidth="2.2" strokeLinecap="round"
                strokeDasharray={CIRCLE_C}
                strokeDashoffset={isRefreshing ? 0 : dashOffset}
                style={{
                  transformOrigin: "center", transform: "rotate(-90deg)",
                  transition: isRefreshing ? "none" : "stroke-dashoffset 0.07s linear",
                }}
              />
              <defs>
                <linearGradient id="ptrGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%"   stopColor="#f97316" />
                  <stop offset="100%" stopColor="#ec4899" />
                </linearGradient>
              </defs>
            </svg>
            <ArrowPathIcon
              className="w-5 h-5 relative z-10"
              style={{
                color: (isPulling || isRefreshing) ? "#f97316" : isDarkMode ? "#6b7280" : "#9ca3af",
                transform: isRefreshing ? undefined : `rotate(${iconDeg}deg)`,
                transition: "color 0.2s ease, transform 0.07s linear",
              }}
            />
          </div>
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: progress > 0.6 ? 1 : 0 }}
            transition={{ duration: 0.15 }}
            style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", color: "#f97316", userSelect: "none" }}
          >
            {isRefreshing ? "Actualisation…" : isPulling ? "✓ Relâchez !" : "Tirez encore"}
          </motion.span>
        </motion.div>
      )}
    </AnimatePresence>
  );
});
PullToRefreshIndicator.displayName = "PullToRefreshIndicator";

// ─────────────────────────────────────────────
// REFRESH RIPPLE OVERLAY
// ─────────────────────────────────────────────
const RefreshRippleOverlay = memo(({ isDarkMode }) => (
  <motion.div
    key="refresh-ripple"
    className="fixed inset-0 pointer-events-none z-40"
    initial={{ opacity: 0 }}
    animate={{ opacity: [0, 1, 0] }}
    transition={{ duration: 0.62, times: [0, 0.22, 1], ease: "easeOut" }}
    style={{
      background: isDarkMode
        ? "linear-gradient(180deg, rgba(249,115,22,0.15) 0%, rgba(236,72,153,0.07) 35%, transparent 62%)"
        : "linear-gradient(180deg, rgba(249,115,22,0.12) 0%, rgba(236,72,153,0.05) 35%, transparent 62%)",
    }}
  />
));
RefreshRippleOverlay.displayName = "RefreshRippleOverlay";

// ─────────────────────────────────────────────
// POST ITEM
// ─────────────────────────────────────────────
const PostItem = memo(({ post, onDeleted, showToast, isPriority, waveIndex, isWaving }) => {
  const shouldAnimate = isWaving && typeof waveIndex === "number" && waveIndex < WAVE_POST_COUNT;
  return (
    <motion.div
      initial={shouldAnimate ? { opacity: 0, y: 22 } : false}
      animate={shouldAnimate ? { opacity: 1, y: 0 }  : undefined}
      transition={shouldAnimate ? {
        duration: WAVE_POST_DURATION,
        delay:    waveIndex * WAVE_STAGGER_S,
        ease:     [0.22, 1, 0.36, 1],
      } : undefined}
    >
      <PostCard
        post={post}
        onDeleted={onDeleted}
        showToast={showToast}
        mockPost={!!(post._isMock || post.isMockPost || post._id?.startsWith("post_"))}
        priority={isPriority}
      />
    </motion.div>
  );
}, (prev, next) =>
  prev.post._id              === next.post._id &&
  prev.post.likes?.length    === next.post.likes?.length &&
  prev.post.comments?.length === next.post.comments?.length &&
  prev.post.content          === next.post.content &&
  prev.post._displayKey      === next.post._displayKey &&
  prev.isPriority            === next.isPriority &&
  prev.isWaving              === next.isWaving &&
  prev.waveIndex             === next.waveIndex
);
PostItem.displayName = "PostItem";

// ─────────────────────────────────────────────
// INLINE NEWS CARD
// ─────────────────────────────────────────────
const InlineNewsCard = memo(({ article, isDarkMode }) => {
  const [imgErr,      setImgErr]      = useState(false);
  const [openArticle, setOpenArticle] = useState(null);

  const timeAgo = useMemo(() => {
    if (!article?.publishedAt) return "";
    const h = Math.floor((Date.now() - new Date(article.publishedAt)) / 3600000);
    return h < 1 ? "À l'instant" : h < 24 ? `Il y a ${h}h` : `Il y a ${Math.floor(h / 24)}j`;
  }, [article?.publishedAt]);

  if (!article?.title) return null;

  return (
    <>
      <div className={`flex items-center gap-3 px-4 pt-5 pb-3 ${isDarkMode ? "bg-black" : "bg-white"}`}>
        <div className={`flex-1 h-px ${isDarkMode ? "bg-gray-800" : "bg-gray-100"}`} />
        <span className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? "text-orange-500" : "text-orange-400"}`}>
          📰 Actualité
        </span>
        <div className={`flex-1 h-px ${isDarkMode ? "bg-gray-800" : "bg-gray-100"}`} />
      </div>
      <div
        onClick={() => setOpenArticle(article)}
        className={`mx-3 mb-5 rounded-2xl overflow-hidden cursor-pointer active:scale-[0.98] transition-transform shadow-md
          ${isDarkMode ? "bg-gray-900 border border-gray-800" : "bg-white border border-gray-200"}`}
      >
        {!imgErr && article.image ? (
          <div className="relative w-full overflow-hidden" style={{ height: 200 }}>
            <img src={article.image} alt="" className="w-full h-full object-cover"
              loading="lazy" decoding="async" onError={() => setImgErr(true)} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
            <div className="absolute bottom-3 left-3 flex items-center gap-2">
              <span className="text-[11px] font-bold text-white bg-orange-500 px-2.5 py-0.5 rounded-full">
                {article.source || "Actualité"}
              </span>
              {timeAgo && <span className="text-[11px] text-white/80 font-medium">{timeAgo}</span>}
            </div>
          </div>
        ) : (
          <div className="w-full flex items-center justify-center bg-gradient-to-br from-orange-500 to-pink-500 text-5xl"
            style={{ height: 120 }}>📰</div>
        )}
        <div className="p-4">
          {(imgErr || !article.image) && (
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[11px] font-bold text-orange-500 uppercase tracking-wide">
                {article.source || "Actualité"}
              </span>
              {timeAgo && <span className={`text-[11px] ${isDarkMode ? "text-gray-500" : "text-gray-400"}`}>· {timeAgo}</span>}
            </div>
          )}
          <p className={`text-base font-bold leading-snug mb-2 ${isDarkMode ? "text-white" : "text-gray-900"}`}>
            {article.title}
          </p>
          {article.description && (
            <p className={`text-sm leading-relaxed line-clamp-2 mb-3 ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
              {article.description}
            </p>
          )}
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-orange-500">Lire l'article →</span>
            <ArrowTopRightOnSquareIcon className="w-4 h-4 text-orange-400" />
          </div>
        </div>
      </div>
      <ArticleReaderModal
        article={openArticle}
        isOpen={!!openArticle}
        onClose={() => setOpenArticle(null)}
      />
    </>
  );
});
InlineNewsCard.displayName = "InlineNewsCard";

// ─────────────────────────────────────────────
// TOAST
// ─────────────────────────────────────────────
const Toast = memo(({ message, type = "info", onClose }) => {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]);
  const bg = type === "error" ? "bg-red-500" : type === "success" ? "bg-green-500" : "bg-blue-500";
  return <div className={`fixed bottom-4 right-4 ${bg} text-white px-6 py-3 rounded-lg shadow-lg z-50`}>{message}</div>;
});
Toast.displayName = "Toast";

// ─────────────────────────────────────────────
// LOOP DIVIDER
// ─────────────────────────────────────────────
const LoopDivider = memo(({ isDarkMode }) => (
  <div className={`flex items-center gap-3 px-4 py-5 ${isDarkMode ? "bg-black" : "bg-white"}`}>
    <div className={`flex-1 h-px ${isDarkMode ? "bg-gray-800" : "bg-gray-200"}`} />
    <span className={`text-[11px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full
      ${isDarkMode ? "bg-gray-900 text-gray-500 border border-gray-800" : "bg-gray-50 text-gray-400 border border-gray-200"}`}>
      🔄 Revoir depuis le début
    </span>
    <div className={`flex-1 h-px ${isDarkMode ? "bg-gray-800" : "bg-gray-200"}`} />
  </div>
));
LoopDivider.displayName = "LoopDivider";

// ─────────────────────────────────────────────
// HELPER BATCH
// ─────────────────────────────────────────────
const computeNextBatch = (prev, posts, loopCountRef) => {
  if (!prev.length) return { newPosts: prev, newBoundary: null };
  const lastLoopStart     = prev.findLastIndex?.(p => p._loopStart) ?? -1;
  const currentCycleStart = lastLoopStart === -1 ? 0 : lastLoopStart;
  const nextSourceIdx     = prev.length - currentCycleStart;
  let newPosts, newBoundary = null;
  if (nextSourceIdx < posts.length) {
    const batch = posts.slice(nextSourceIdx, nextSourceIdx + PAGE_SIZE).map(p => ({
      ...p, _displayKey: `loop${loopCountRef.current}_${p._id}`,
    }));
    newPosts = [...prev, ...batch];
  } else {
    loopCountRef.current += 1;
    const loopN = loopCountRef.current;
    const batch = posts.slice(0, PAGE_SIZE).map((p, i) => ({
      ...p, _displayKey: `loop${loopN}_${p._id}`, _loopStart: i === 0,
    }));
    newBoundary = prev.length;
    newPosts    = [...prev, ...batch];
    if (newPosts.length > MAX_DOM_POSTS) newPosts = newPosts.slice(newPosts.length - MAX_DOM_POSTS);
  }
  return { newPosts, newBoundary };
};

// ─────────────────────────────────────────────
// PROGRESSIVE FEED
// ─────────────────────────────────────────────
const ProgressiveFeed = ({
  posts, onDeleted, showToast, adConfig,
  apiLoadMoreRef, hasMoreFromAPI,
  searchQuery, isDarkMode, newsArticles, isLoading,
  newPostsCount, onShowNewPosts,
  isWaving,
  apiFullyLoaded,
  suggestedUserPool,
}) => {
  const [feedState, setFeedState] = useState({ displayedPosts: [], loopBoundaries: [] });
  const { displayedPosts, loopBoundaries } = feedState;

  const sentinelRef  = useRef(null);
  const loopCountRef = useRef(0);
  const postsRef     = useRef(posts);
  useEffect(() => { postsRef.current = posts; }, [posts]);

  useEffect(() => {
    if (!posts.length) { setFeedState({ displayedPosts: [], loopBoundaries: [] }); return; }
    loopCountRef.current = 0;
    const initial = posts.slice(0, Math.min(PAGE_SIZE, posts.length)).map(p => ({
      ...p, _displayKey: `loop0_${p._id}`,
    }));
    startTransition(() => {
      setFeedState({ displayedPosts: initial, loopBoundaries: [] });
    });
  }, [posts.length === 0 ? 0 : posts[0]?._id]); // eslint-disable-line

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      startTransition(() => {
        setFeedState(prev => {
          const currentPosts = postsRef.current;
          if (!prev.displayedPosts.length || !currentPosts.length) return prev;
          const { newPosts, newBoundary } = computeNextBatch(prev.displayedPosts, currentPosts, loopCountRef);
          return {
            displayedPosts: newPosts,
            loopBoundaries: newBoundary !== null
              ? [...prev.loopBoundaries, newBoundary]
              : prev.loopBoundaries,
          };
        });
      });
    }, { rootMargin: "300px" });
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, []); // eslint-disable-line

  const loopBoundarySet = useMemo(() => new Set(loopBoundaries), [loopBoundaries]);

  const newsInsertMap = useMemo(() => {
    if (!newsArticles?.length || searchQuery) return new Map();
    const map = new Map();
    let articleIdx = 0;
    for (let i = 0; i < displayedPosts.length; i++) {
      const isFirstSlot  = i === NEWS_INSERT_AFTER - 1;
      const isRepeatSlot = i >= NEWS_INSERT_AFTER && ((i - NEWS_INSERT_AFTER + 1) % NEWS_REPEAT_EVERY === 0);
      if (isFirstSlot || isRepeatSlot) {
        map.set(i, newsArticles[articleIdx++ % newsArticles.length]);
      }
    }
    return map;
  }, [displayedPosts.length, newsArticles, searchQuery]);

  if (isLoading && posts.length === 0) return <SkeletonPosts count={3} isDarkMode={isDarkMode} />;
  if (!isLoading && posts.length === 0) return (
    <div className="flex flex-col items-center justify-center py-20">
      <p className={`text-lg font-medium ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>Aucun post à afficher</p>
    </div>
  );

  return (
    <>
      <NewPostsBanner count={newPostsCount} onClick={onShowNewPosts} isDarkMode={isDarkMode} />
      {displayedPosts.map((post, index) => {
        const isLoopStart = loopBoundarySet.has(index);
        const showAd      = adConfig.enabled && index > 0 && index % adConfig.frequency === 0;
        const article     = newsInsertMap.get(index);
        return (
          <div key={post._displayKey || post._id} style={{ contain: "content" }}>
            {isLoopStart && apiFullyLoaded && <LoopDivider isDarkMode={isDarkMode} />}
            <PostItem
              post={post}
              onDeleted={onDeleted}
              showToast={showToast}
              isPriority={index === 0}
              waveIndex={index}
              isWaving={isWaving}
            />
            {/* Type 1 — Profil + publication (toutes les 5 publications) */}
            {index > 0 && index % SUGGEST_POST_EVERY === 0 && index % SUGGEST_EVERY !== 0 && (
              <SuggestedPostPreview
                key={`suggest-post-${index}`}
                isDarkMode={isDarkMode}
                userPool={suggestedUserPool}
                slotIndex={Math.floor(index / SUGGEST_POST_EVERY)}
              />
            )}
            {/* Type 2 — Carousel profils simples (toutes les 8 publications) */}
            {index > 0 && index % SUGGEST_EVERY === 0 && (
              <SuggestedAccounts
                key={`suggest-accounts-${Math.floor(index / SUGGEST_EVERY)}`}
                isDarkMode={isDarkMode}
                instanceId={Math.floor(index / SUGGEST_EVERY)}
              />
            )}
            {showAd && (
              <div style={{ minHeight: 250, contain: "layout size" }}>
                <SmartAd slot="feedInline" canClose={true} />
              </div>
            )}
            {article && (
              <InlineNewsCard
                key={`news-${article.id || article.url || index}`}
                article={article}
                isDarkMode={isDarkMode}
              />
            )}
          </div>
        );
      })}
      <div ref={sentinelRef} className="h-20 flex items-center justify-center" aria-hidden="true">
        {displayedPosts.length > 0 && (
          <ArrowPathIcon className="w-5 h-5 animate-spin text-orange-400 opacity-60" />
        )}
      </div>
      {hasMoreFromAPI && <div ref={apiLoadMoreRef} className="h-1" aria-hidden="true" />}
    </>
  );
};
ProgressiveFeed.displayName = "ProgressiveFeed";

// ─────────────────────────────────────────────
// STALE URL DETECTION
// ─────────────────────────────────────────────
const STALE_PIXABAY_PATTERN = /cdn\.pixabay\.com\/video\/\d{4}\/\d{2}\/\d{2}\/\d+-\d+_large\.mp4/i;
const STALE_PEXELS_PATTERN  = /videos\.pexels\.com\/video-files\/\d+\/\d+-\w+_\d+_\d+/i;

const hasStaleMediaUrl = (post) => {
  const sources = [
    ...(Array.isArray(post.media)  ? post.media  : post.media  ? [post.media]  : []),
    ...(Array.isArray(post.images) ? post.images : post.images ? [post.images] : []),
    post.videoUrl, post.embedUrl, post.thumbnail,
  ];
  return sources.some(m => {
    const url = typeof m === 'string' ? m : m?.url;
    if (!url) return false;
    return STALE_PIXABAY_PATTERN.test(url) || STALE_PEXELS_PATTERN.test(url);
  });
};

// ─────────────────────────────────────────────
// STABLE REFERENCES
// ─────────────────────────────────────────────
const _realPostCache = new WeakMap();
const stableRealPost = (post) => {
  if (_realPostCache.has(post)) return _realPostCache.get(post);
  const stable = post._isMock === false ? post : { ...post, _isMock: false };
  _realPostCache.set(post, stable);
  return stable;
};

// ─────────────────────────────────────────────
// HOME
// ─────────────────────────────────────────────
const Home = ({ openStoryViewer: openStoryViewerProp, searchQuery = "" }) => {
  const { isDarkMode } = useDarkMode();
  const { fetchStories, stories = [] } = useStories();
  const { posts: realPosts = [], fetchNextPage, hasMore, loading: postsLoading, refetch, removePost } = usePosts() || {};
  const { user } = useAuth();

  const [isPending, startPageTransition] = useTransition();
  const [showCreator,     setShowCreator]     = useState(false);
  const [showStoryViewer, setShowStoryViewer] = useState(false);
  const [viewerData,      setViewerData]      = useState({ stories: [], owner: null });
  const [isRefreshing,    setIsRefreshing]    = useState(false);
  const [showPyramid,     setShowPyramid]     = useState(false);
  const [toast,           setToast]           = useState(null);
  const [mockPostsCount,  setMockPostsCount]  = useState(MOCK_CONFIG.initialCount);
  const [pullUIState,     setPullUIState]     = useState({ distance: 0, isPulling: false });
  const [pendingPosts,    setPendingPosts]    = useState([]);
  const [newPostsCount,   setNewPostsCount]   = useState(0);
  const [feedKey,         setFeedKey]         = useState(0);
  const [showRipple,      setShowRipple]      = useState(false);
  const [isWaving,        setIsWaving]        = useState(false);
  const [apiPagesLoaded,  setApiPagesLoaded]  = useState(1);

  // Pool d'utilisateurs suggérés partagé entre les deux types de suggestions
  const [suggestedUserPool, setSuggestedUserPool] = useState([]);
  const suggestFetchedRef = useRef(false);

  // 🔄 Seed de shuffle — change à chaque refresh pour varier l'ordre du feed
  const [shuffleSeed, setShuffleSeed] = useState(() => Math.floor(Math.random() * 0xFFFFFFFF));

  const latestPostIdRef    = useRef(null);
  const scrollContainerRef = useRef(null);
  const feedTopRef         = useRef(null);
  const showMockPosts      = MOCK_CONFIG.enabled;
  const apiObserverRef     = useRef(null);
  const loadingRef         = useRef(false);
  const mockGenStarted     = useRef(false);
  const touchStartY        = useRef(0);
  const isPullingRef       = useRef(false);
  const canPullRef         = useRef(true);
  const pullDistRef        = useRef(0);
  const lcpDone            = useRef(false);
  const rippleTimerRef     = useRef(null);
  const waveTimerRef       = useRef(null);

  const { articles: newsArticles = [] } = useNews({
    maxArticles: 10, category: "all", autoFetch: !!user, enabled: !!user,
  });

  // Charger le pool de suggestions une seule fois
  useEffect(() => {
    if (suggestFetchedRef.current || !user) return;
    suggestFetchedRef.current = true;
    (async () => {
      try {
        const { data } = await axiosClient.get("/users/suggestions?limit=20");
        const list = Array.isArray(data) ? data : (data?.users || data?.suggestions || []);
        setSuggestedUserPool(list.filter(u => u?._id && u._id !== user._id));
      } catch {
        try {
          const { data } = await axiosClient.get("/users?limit=20&sort=followers");
          const list = Array.isArray(data) ? data : (data?.users || []);
          setSuggestedUserPool(list.filter(u => u?._id && u._id !== user._id).slice(0, 15));
        } catch {}
      }
    })();
  }, [user]);

  const isValidPost = useCallback((post) => {
    if (!post?._id) return false;
    if (post._isMock || post.isMockPost || post._id?.startsWith("post_")) return true;
    const u = post.user || post.author || {};
    if (u.isBanned || u.isDeleted || ["deleted","banned"].includes(u.status)) return false;
    if (hasStaleMediaUrl(post)) return false;
    return !!(u._id || u.id || post.userId || post.author?._id);
  }, []);

  // ─────────────────────────────────────────────
  // 🔄 combinedPosts — shufflé par seed au refresh
  //
  // Stratégie :
  //   1. Les N derniers posts API (récents) restent en tête (non shufflés)
  //      pour que les vraies nouveautés apparaissent toujours en premier.
  //   2. Le reste du pool (anciens posts + mocks) est shufflé avec la seed.
  //   3. On applique ensuite le mix bots/réels par blocs.
  //
  //   → À chaque refresh, shuffleSeed change → ordre différent.
  //   → Pendant le scroll, la seed est stable → pas de sauts.
  // ─────────────────────────────────────────────
  const RECENT_HEAD_COUNT = 5; // nb de posts récents gardés en tête

  const combinedPosts = useMemo(() => {
    const validReal = realPosts.filter(p => isValidPost(p) && !p.isBot && !p.user?.isBot);
    const validBots = realPosts.filter(p => isValidPost(p) && (p.isBot || p.user?.isBot));

    if (!showMockPosts) {
      // Tête : posts récents stables, queue : shufflée
      const head = validReal.slice(0, RECENT_HEAD_COUNT);
      const tail = seededShuffle(validReal.slice(RECENT_HEAD_COUNT), shuffleSeed);
      return mixPostsByBlocks([...head, ...tail], seededShuffle(validBots, shuffleSeed ^ 0xABCD));
    }

    const mockSlice = MOCK_POSTS.slice(0, mockPostsCount);

    if (MOCK_CONFIG.mixWithRealPosts && validReal.length > 0) {
      const realHead  = validReal.slice(0, RECENT_HEAD_COUNT).map(stableRealPost);
      const realTail  = seededShuffle(validReal.slice(RECENT_HEAD_COUNT).map(stableRealPost), shuffleSeed);
      const allBots   = seededShuffle([...validBots, ...mockSlice], shuffleSeed ^ 0xDEAD);
      return mixPostsByBlocks([...realHead, ...realTail], allBots);
    }

    // Que des mocks : shuffler avec la seed
    return seededShuffle(mockSlice, shuffleSeed);
  }, [realPosts.length, mockPostsCount, showMockPosts, isValidPost, shuffleSeed]); // eslint-disable-line

  const apiFullyLoaded = !hasMore && apiPagesLoaded >= API_PREFETCH_PAGES;

  useEffect(() => {
    if (combinedPosts.length > 0 && !latestPostIdRef.current)
      latestPostIdRef.current = combinedPosts[0]._id;
  }, [combinedPosts]);

  if (!lcpDone.current && combinedPosts.length > 0) {
    const result = getLCPImageUrl(combinedPosts);
    if (result?.url) { injectPreloadLink(result.url, result.type); lcpDone.current = true; }
  }

  const deferredSearch = useDeferredValue(searchQuery);
  const filteredPosts  = useMemo(() => {
    if (!deferredSearch.trim()) return combinedPosts;
    const q = deferredSearch.toLowerCase();
    return combinedPosts.filter(p =>
      (p.content || "").toLowerCase().includes(q) ||
      (p.user?.fullName || "").toLowerCase().includes(q)
    );
  }, [combinedPosts, deferredSearch]);

  const isLoading = postsLoading && combinedPosts.length === 0;
  useEffect(() => { loadingRef.current = postsLoading; }, [postsLoading]);

  useEffect(() => {
    if (mockGenStarted.current || isLoading || !MOCK_CONFIG.enabled) return;
    if (!(MOCK_CONFIG.totalPosts > 100 && MOCK_CONFIG.lazyGeneration?.enabled !== false)) return;
    const t = setTimeout(() => {
      if (mockGenStarted.current) return;
      mockGenStarted.current = true;
      const run = () => generateFullDataset(() => {}).catch(() => { mockGenStarted.current = false; });
      typeof requestIdleCallback !== "undefined"
        ? requestIdleCallback(run, { timeout: 60000 })
        : setTimeout(run, 1000);
    }, 30000);
    return () => clearTimeout(t);
  }, [isLoading]);

  useEffect(() => {
    return () => {
      clearTimeout(rippleTimerRef.current);
      clearTimeout(waveTimerRef.current);
    };
  }, []);

  const showToast = useCallback((msg, type = "info") => {
    startTransition(() => setToast({ message: msg, type }));
  }, []);

  const handlePostDeleted = useCallback((id) => {
    startTransition(() => removePost?.(id));
  }, [removePost]);

  const handleOpenStory = useCallback((s, o) => {
    if (openStoryViewerProp) openStoryViewerProp(s, o);
    else { setViewerData({ stories: s, owner: o }); setShowStoryViewer(true); }
  }, [openStoryViewerProp]);

  const triggerRefreshAnimation = useCallback(() => {
    clearTimeout(rippleTimerRef.current);
    setShowRipple(true);
    rippleTimerRef.current = setTimeout(() => setShowRipple(false), RIPPLE_DURATION_MS);
    clearTimeout(waveTimerRef.current);
    setIsWaving(true);
    startTransition(() => setFeedKey(k => k + 1));
    waveTimerRef.current = setTimeout(() => setIsWaving(false), WAVE_DURATION_MS);
  }, []);

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    triggerRefreshAnimation();
    setIsRefreshing(true);
    setNewPostsCount(0);
    setPendingPosts([]);
    setApiPagesLoaded(1);

    // 🔄 Nouvelle seed à chaque refresh → ordre du feed différent
    setShuffleSeed(Math.floor(Math.random() * 0xFFFFFFFF));

    try {
      const [, result] = await Promise.allSettled([
        fetchStories(true),
        refetch?.(),
      ]);
      const freshPosts = result?.value?.posts || [];
      if (freshPosts.length > 0) latestPostIdRef.current = freshPosts[0]._id;
    } catch {
      showToast("Erreur lors de l'actualisation", "error");
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, refetch, fetchStories, showToast, triggerRefreshAnimation]);

  useEffect(() => {
    const onHomeRefresh = () => handleRefresh();
    window.addEventListener(HOME_REFRESH_EVENT, onHomeRefresh);
    return () => window.removeEventListener(HOME_REFRESH_EVENT, onHomeRefresh);
  }, [handleRefresh]);

  useEffect(() => {
    if (!user) return;
    const poll = async () => {
      if (document.hidden || isRefreshing || loadingRef.current) return;
      try {
        const result     = await refetch?.();
        const freshPosts = result?.posts || [];
        if (freshPosts.length > 0 && latestPostIdRef.current) {
          const latestIdx = freshPosts.findIndex(p => p._id === latestPostIdRef.current);
          const newer     = latestIdx > 0 ? freshPosts.slice(0, latestIdx) : [];
          if (newer.length > 0) {
            setPendingPosts(newer);
            setNewPostsCount(newer.length);
          }
        }
      } catch {}
    };
    const interval = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [user, refetch, isRefreshing]);

  const handleShowNewPosts = useCallback(() => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    if (pendingPosts.length > 0) latestPostIdRef.current = pendingPosts[0]._id;
    setNewPostsCount(0);
    setPendingPosts([]);
    // 🔄 Nouvelle seed aussi quand on affiche les nouveaux posts
    setShuffleSeed(Math.floor(Math.random() * 0xFFFFFFFF));
    triggerRefreshAnimation();
  }, [pendingPosts, triggerRefreshAnimation]);

  useEffect(() => {
    const THRESHOLD = PTR_THRESHOLD;
    let raf = null, lastUpdate = 0;
    const reset = () => {
      pullDistRef.current = 0; canPullRef.current = true;
      setPullUIState({ distance: 0, isPulling: false });
    };
    const trigger = async () => {
      if (isPullingRef.current) return;
      isPullingRef.current = true;
      setPullUIState({ distance: 0, isPulling: false });
      canPullRef.current = false;
      await handleRefresh();
      isPullingRef.current = false;
      setTimeout(reset, 300);
    };
    const onStart = e => {
      const scrollTop = scrollContainerRef.current?.scrollTop ?? window.scrollY;
      if (scrollTop <= 5 && canPullRef.current) touchStartY.current = e.touches[0].clientY;
    };
    const onMove = e => {
      if (!canPullRef.current || !touchStartY.current) return;
      const pd = e.touches[0].clientY - touchStartY.current;
      if (pd > 20) {
        pullDistRef.current = Math.min(pd * 0.4, THRESHOLD * 1.5);
        const now = Date.now();
        if (now - lastUpdate >= 50) {
          lastUpdate = now;
          if (raf) cancelAnimationFrame(raf);
          raf = requestAnimationFrame(() =>
            setPullUIState({ distance: pullDistRef.current, isPulling: pullDistRef.current > THRESHOLD })
          );
        }
        if (pd > 60 && e.cancelable) try { e.preventDefault(); } catch {}
      }
    };
    const onEnd = () => {
      if (raf) cancelAnimationFrame(raf);
      pullDistRef.current > THRESHOLD && !isPullingRef.current ? trigger() : reset();
      touchStartY.current = 0;
    };
    const target = scrollContainerRef.current || window;
    target.addEventListener("touchstart", onStart, { passive: true });
    target.addEventListener("touchmove",  onMove,  { passive: false });
    target.addEventListener("touchend",   onEnd,   { passive: true });
    return () => {
      if (raf) cancelAnimationFrame(raf);
      target.removeEventListener("touchstart", onStart);
      target.removeEventListener("touchmove",  onMove);
      target.removeEventListener("touchend",   onEnd);
    };
  }, [handleRefresh]);

  const handleApiObserverFn = useCallback((entries) => {
    if (!entries[0].isIntersecting || loadingRef.current || isRefreshing) return;
    startPageTransition(() => {
      if (showMockPosts && mockPostsCount < MOCK_POSTS.length)
        setMockPostsCount(prev => Math.min(prev + MOCK_CONFIG.loadMoreCount, MOCK_POSTS.length));
      if (hasMore) {
        fetchNextPage();
        setApiPagesLoaded(prev => prev + 1);
      }
    });
  }, [hasMore, fetchNextPage, isRefreshing, showMockPosts, mockPostsCount]);

  const handleApiObserverRef = useRef(handleApiObserverFn);
  useEffect(() => { handleApiObserverRef.current = handleApiObserverFn; }, [handleApiObserverFn]);

  useEffect(() => {
    const node = apiObserverRef.current;
    if (!node) return;
    const obs = new IntersectionObserver(
      (entries) => handleApiObserverRef.current(entries),
      { rootMargin: "500px" }
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, []); // eslint-disable-line

  return (
    <div className="flex flex-col h-full scrollbar-hide" style={{ minHeight: "100vh" }}>

      <PullToRefreshIndicator
        isPulling={pullUIState.isPulling}
        pullDistance={pullUIState.distance}
        isRefreshing={isRefreshing}
        isDarkMode={isDarkMode}
      />

      <AnimatePresence>
        {showRipple && <RefreshRippleOverlay key="ripple" isDarkMode={isDarkMode} />}
      </AnimatePresence>

      <div className={`sticky top-0 z-30 ${isDarkMode ? "bg-black" : "bg-white"}`}
        style={{ height: STORY_BAR_HEIGHT, minHeight: STORY_BAR_HEIGHT, contain: "strict" }}>
        <StoryContainer
          onOpenStory={handleOpenStory}
          onOpenCreator={() => setShowCreator(true)}
          onOpenPyramid={() => setShowPyramid(true)}
          isDarkMode={isDarkMode}
        />
      </div>

      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto scrollbar-hide"
        style={{ willChange: "transform", WebkitOverflowScrolling: "touch" }}
      >
        <div ref={feedTopRef} />
        <div className="w-full lg:max-w-[630px] lg:mx-auto">
          {searchQuery && (
            <div className={`p-4 text-center text-sm ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
              {isPending ? "Recherche..." : `${filteredPosts.length} résultat(s) pour "${deferredSearch}"`}
            </div>
          )}
          <ProgressiveFeed
            key={`feed-${feedKey}-${newsArticles.length > 0 ? "with-news" : "no-news"}`}
            posts={filteredPosts}
            onDeleted={handlePostDeleted}
            showToast={showToast}
            adConfig={AD_CONFIG}
            apiLoadMoreRef={apiObserverRef}
            hasMoreFromAPI={hasMore || mockPostsCount < MOCK_POSTS.length}
            searchQuery={deferredSearch}
            isDarkMode={isDarkMode}
            newsArticles={newsArticles}
            isLoading={isLoading}
            newPostsCount={newPostsCount}
            onShowNewPosts={handleShowNewPosts}
            isWaving={isWaving}
            apiFullyLoaded={apiFullyLoaded}
            suggestedUserPool={suggestedUserPool}
          />
        </div>
      </div>

      <Suspense fallback={null}>
        <ImmersivePyramidUniverse
          isOpen={showPyramid}
          onClose={() => setShowPyramid(false)}
          stories={stories}
          user={user}
          onOpenStory={handleOpenStory}
          onOpenCreator={() => { setShowPyramid(false); setShowCreator(true); }}
          isDarkMode={isDarkMode}
        />
      </Suspense>

      <AnimatePresence>
        {showCreator && (
          <Suspense fallback={null}>
            <StoryCreator onClose={() => setShowCreator(false)} />
          </Suspense>
        )}
        {showStoryViewer && (
          <Suspense fallback={null}>
            <StoryViewer stories={viewerData.stories} currentUser={user} onClose={() => setShowStoryViewer(false)} />
          </Suspense>
        )}
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </AnimatePresence>
    </div>
  );
};

export default memo(Home);