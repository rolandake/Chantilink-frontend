// 📁 src/pages/Home/Home.jsx
//
// ✅ LCP FIX :
//   - injectPreloadLink sur le poster (image) du premier post vidéo
//   - getLCPImageUrl retourne le poster si le 1er media est une vidéo
//
// ✅ CLS FIX (0.23 → cible < 0.1) :
//   - StoryContainer wrapper : height + minHeight FIXES en CSS (pas calculés en JS)
//     → le navigateur réserve l'espace avant hydratation React
//   - InlineNewsCard : hauteur réservée via min-height sur le wrapper
//   - Skeleton visible UNIQUEMENT si combinedPosts.length === 0 (vrai cache miss)
//
// ✅ INP FIX :
//   - PostItem mémoïsé avec comparateur strict
//   - showToast wrappé dans startTransition pour ne pas bloquer le thread principal

import React, {
  useState, useMemo, useEffect, useRef, useCallback,
  memo, lazy, Suspense, startTransition, useDeferredValue, useTransition
} from "react";
import { ArrowPathIcon, ChevronLeftIcon, ArrowTopRightOnSquareIcon, ArrowUpIcon } from "@heroicons/react/24/outline";
import { AnimatePresence, motion } from "framer-motion";
import { useDarkMode } from "../../context/DarkModeContext";
import { useStories } from "../../context/StoryContext";
import { usePosts } from "../../context/PostsContext";
import { useAuth } from "../../context/AuthContext";
import { useNews } from "../../hooks/useNews";
import PostCard from "./PostCard";
import StoryContainer from "./StoryContainer";
import StoryCreator from "./StoryCreator";
import SmartAd from "./Publicite/SmartAd";
import MOCK_POSTS, { generateFullDataset } from "../../data/mockPosts";
import { MOCK_CONFIG as DEFAULT_MOCK_CONFIG, AD_CONFIG as DEFAULT_AD_CONFIG } from "../../data/mockConfig";

const HOME_REFRESH_EVENT = "home:refresh";

const StoryViewer              = lazy(() => import("./StoryViewer"));
const ImmersivePyramidUniverse = lazy(() => import("./ImmersivePyramidUniverse"));

const AD_CONFIG   = DEFAULT_AD_CONFIG;
const MOCK_CONFIG = DEFAULT_MOCK_CONFIG;

const NEWS_INSERT_AFTER = 2;
const NEWS_REPEAT_EVERY = 8;
const PAGE_SIZE         = 8;
const MAX_DOM_POSTS     = 200;
const POLL_INTERVAL     = 30_000;

// ✅ CLS FIX : hauteur StoryContainer définie en CONSTANTE partagée
// → même valeur en CSS (sticky wrapper) et dans le calcul de layout
// Modifier ici si le design de StoryContainer change
const STORY_BAR_HEIGHT = 120;

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "dlymdclhe";
const IMG_BASE   = `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/`;

// ─────────────────────────────────────────────
// PRELOAD LCP
// ─────────────────────────────────────────────
const _preloadedUrls = new Set();
const injectPreloadLink = (url, asType = 'image') => {
  if (!url || _preloadedUrls.has(url)) return;
  _preloadedUrls.add(url);
  if (document.querySelector(`link[rel="preload"][href="${url}"]`)) return;
  const link = document.createElement('link');
  link.rel           = 'preload';
  link.as            = asType;
  link.href          = url;
  link.fetchPriority = 'high';
  document.head.appendChild(link);
};

const isVideoUrl = url => url && /\.(mp4|webm|mov|avi)$/i.test(url);

const getVideoPosterUrlForPreload = (videoUrl) => {
  if (!videoUrl) return null;
  try {
    if (videoUrl.includes('res.cloudinary.com')) {
      const uploadIndex = videoUrl.indexOf('/upload/');
      if (uploadIndex === -1) return null;
      const afterUpload = videoUrl.substring(uploadIndex + 8);
      const segments = afterUpload.split('/');
      const publicIdSegments = [];
      for (const seg of segments) {
        const isTransform = seg.includes(',') || (/^[a-z]+_[a-z]/.test(seg) && !seg.includes('.'));
        if (!isTransform) publicIdSegments.push(seg);
      }
      const publicId = publicIdSegments.join('/').replace(/\.(mp4|webm|mov|avi)$/i, '');
      if (!publicId) return null;
      return `${IMG_BASE}q_auto:good,f_jpg,w_1080,c_limit,so_0/${publicId}.jpg`;
    }
    const withoutExt = videoUrl.replace(/^\/+/, '').replace(/\.(mp4|webm|mov|avi)$/i, '');
    return `${IMG_BASE}q_auto:good,f_jpg,w_1080,c_limit,so_0/${withoutExt}.jpg`;
  } catch { return null; }
};

const getLCPImageUrl = (posts) => {
  if (!posts?.length) return null;
  const p   = posts[0];
  if (!p) return null;
  const m   = p.images?.[0] || p.media?.[0];
  const url = m?.url || m;
  if (!url) return null;
  if (isVideoUrl(url)) return { url: getVideoPosterUrlForPreload(url), type: 'image' };
  return { url, type: 'image' };
};

// ─────────────────────────────────────────────
// SKELETON
// ─────────────────────────────────────────────
const SkeletonPosts = memo(({ count = 3, isDarkMode }) => (
  <div>
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className={isDarkMode ? 'bg-black' : 'bg-white'} style={{ marginBottom: 1 }}>
        <div className="p-3 flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex-shrink-0 animate-pulse ${isDarkMode ? 'bg-gray-800' : 'bg-gray-200'}`} />
          <div className="flex-1 space-y-2">
            <div className={`h-4 rounded w-32 animate-pulse ${isDarkMode ? 'bg-gray-800' : 'bg-gray-200'}`} />
            <div className={`h-3 rounded w-20 animate-pulse ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`} />
          </div>
        </div>
        {/*
         * ✅ CLS FIX : skeleton media avec aspect-square Tailwind
         * Évite le recalcul de hauteur quand le vrai PostCard apparaît
         */}
        <div className={`w-full aspect-square animate-pulse ${isDarkMode ? 'bg-gray-800' : 'bg-gray-200'}`} />
        <div className="flex items-center gap-4 p-3">
          {[0,1,2].map(j => <div key={j} className={`w-6 h-6 rounded animate-pulse ${isDarkMode ? 'bg-gray-800' : 'bg-gray-200'}`} />)}
        </div>
      </div>
    ))}
  </div>
));
SkeletonPosts.displayName = 'SkeletonPosts';

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
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className="sticky z-20 flex justify-center px-4 pb-2 pointer-events-none"
        style={{ top: STORY_BAR_HEIGHT + 8 }}
      >
        <button
          onClick={onClick}
          className="pointer-events-auto flex items-center gap-2 px-5 py-2.5 rounded-full shadow-xl text-sm font-bold
            bg-gradient-to-r from-orange-500 to-pink-500 text-white
            active:scale-95 transition-transform select-none"
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          <ArrowUpIcon className="w-4 h-4" />
          {count === 1 ? '1 nouveau post' : `${count} nouveaux posts`}
        </button>
      </motion.div>
    )}
  </AnimatePresence>
));
NewPostsBanner.displayName = 'NewPostsBanner';

// ─────────────────────────────────────────────
// PULL TO REFRESH INDICATOR
// ─────────────────────────────────────────────
const PullToRefreshIndicator = memo(({ isPulling, pullDistance, isDarkMode, threshold = 100 }) => {
  const progress = Math.min((pullDistance / threshold) * 100, 100);
  const opacity  = Math.min(pullDistance / 60, 1);
  return (
    <AnimatePresence>
      {pullDistance > 20 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }} transition={{ duration: 0.15 }}
          className="fixed left-1/2 -translate-x-1/2 z-[45] pointer-events-none"
          style={{ top: STORY_BAR_HEIGHT + 16 }}
        >
          <div className={`relative w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-md shadow-lg border
            ${isDarkMode ? 'bg-gray-800/95 border-gray-700' : 'bg-white/95 border-gray-200'}`}>
            <svg className="absolute inset-0 -rotate-90" viewBox="0 0 40 40">
              <circle cx="20" cy="20" r="16" fill="none" stroke={isDarkMode ? '#374151' : '#e5e7eb'} strokeWidth="2" />
              <circle cx="20" cy="20" r="16" fill="none" stroke="#f97316" strokeWidth="2"
                strokeDasharray={`${2 * Math.PI * 16}`}
                strokeDashoffset={`${2 * Math.PI * 16 * (1 - progress / 100)}`}
                strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.08s linear' }} />
            </svg>
            <ArrowPathIcon
              className={`w-5 h-5 ${isPulling ? 'text-orange-500' : 'text-gray-400'}`}
              style={{ transform: `rotate(${(pullDistance / threshold) * 360}deg)`, transition: 'transform 0.08s linear' }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});
PullToRefreshIndicator.displayName = 'PullToRefreshIndicator';

// ─────────────────────────────────────────────
// POST ITEM — mémoïsé strict
// ─────────────────────────────────────────────
const PostItem = memo(({ post, onDeleted, showToast, isPriority }) => (
  <PostCard
    post={post}
    onDeleted={onDeleted}
    showToast={showToast}
    mockPost={!!(post._isMock || post.isMockPost || post._id?.startsWith('post_'))}
    priority={isPriority}
  />
), (prev, next) =>
  prev.post._id              === next.post._id &&
  prev.post.likes?.length    === next.post.likes?.length &&
  prev.post.comments?.length === next.post.comments?.length &&
  prev.post.content          === next.post.content &&
  prev.isPriority            === next.isPriority
);
PostItem.displayName = 'PostItem';

// ─────────────────────────────────────────────
// ARTICLE READER
// ─────────────────────────────────────────────
const ArticleReader = memo(({ article, isDarkMode, onClose }) => {
  const [showFull, setShowFull] = useState(false);
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/70"
      onClick={onClose}>
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className={`relative w-full max-w-2xl rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden ${isDarkMode ? 'bg-gray-900' : 'bg-white'}`}
        style={{ maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
        <div className={`flex items-center gap-3 p-4 border-b ${isDarkMode ? 'border-gray-800' : 'border-gray-100'}`}>
          <button onClick={onClose}
            className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm font-semibold transition-colors
              ${isDarkMode ? 'bg-gray-800 text-white hover:bg-gray-700' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}>
            <ChevronLeftIcon className="w-4 h-4" /> Retour
          </button>
          <span className={`text-xs font-medium truncate ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{article.source}</span>
        </div>
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(90vh - 65px)' }}>
          {article.image && <img src={article.image} alt={article.title} className="w-full object-cover" style={{ maxHeight: 240 }} loading="lazy" />}
          <div className="p-5">
            <h1 className={`text-xl font-bold mb-2 leading-snug ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{article.title}</h1>
            <p className={`text-xs mb-4 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              {article.source}{article.publishedAt && ` · ${new Date(article.publishedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`}
            </p>
            {article.description && <p className={`text-sm leading-relaxed mb-4 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{article.description}</p>}
            <AnimatePresence>
              {showFull && article.content && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                  <p className={`text-sm leading-relaxed mb-4 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{article.content}</p>
                </motion.div>
              )}
            </AnimatePresence>
            {!showFull
              ? <button onClick={() => setShowFull(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold active:scale-95 transition-colors">
                  Lire l'article complet <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                </button>
              : <div className={`mt-2 p-3 rounded-xl text-xs flex items-center gap-2 ${isDarkMode ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-500'}`}>
                  <ArrowTopRightOnSquareIcon className="w-4 h-4 flex-shrink-0 text-orange-400" />
                  <span>Source : <a href={article.url} target="_blank" rel="noopener noreferrer" className="text-orange-500 underline" onClick={e => e.stopPropagation()}>{article.source}</a></span>
                </div>
            }
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
});
ArticleReader.displayName = 'ArticleReader';

// ─────────────────────────────────────────────
// ✅ INLINE NEWS CARD v2 — pleine largeur, bien visible
// ─────────────────────────────────────────────
const InlineNewsCard = memo(({ article, isDarkMode }) => {
  const [imgErr,     setImgErr]     = useState(false);
  const [showReader, setShowReader] = useState(false);

  const timeAgo = useMemo(() => {
    if (!article.publishedAt) return '';
    const h = Math.floor((Date.now() - new Date(article.publishedAt)) / 3600000);
    return h < 1 ? "À l'instant" : h < 24 ? `Il y a ${h}h` : `Il y a ${Math.floor(h / 24)}j`;
  }, [article.publishedAt]);

  return (
    <>
      {/* Séparateur */}
      <div className={`flex items-center gap-3 px-4 pt-5 pb-3 ${isDarkMode ? 'bg-black' : 'bg-white'}`}>
        <div className={`flex-1 h-px ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'}`} />
        <span className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-orange-500' : 'text-orange-400'}`}>
          📰 Actualité
        </span>
        <div className={`flex-1 h-px ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'}`} />
      </div>

      {/*
       * ✅ CLS FIX : min-height réservée sur la carte
       * Évite un layout shift quand l'image charge et repousse le contenu
       */}
      <div
        onClick={() => setShowReader(true)}
        className={`mx-3 mb-5 rounded-2xl overflow-hidden cursor-pointer shadow-lg active:scale-[0.98] transition-transform
          ${isDarkMode ? 'bg-gray-900 border border-gray-800' : 'bg-white border border-gray-100'}`}
        style={{ minHeight: article.image && !imgErr ? 340 : 130 }}
      >
        {/* Image pleine largeur avec hauteur fixe réservée */}
        {!imgErr && article.image ? (
          <div className="relative w-full" style={{ height: 200 }}>
            <img
              src={article.image}
              alt={article.title}
              className="w-full h-full object-cover"
              loading="lazy"
              decoding="async"
              width="630"
              height="200"
              onError={() => setImgErr(true)}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            <div className="absolute bottom-3 left-3">
              <span className="text-[11px] font-bold text-white bg-orange-500 px-2.5 py-1 rounded-full">
                {article.source}
              </span>
            </div>
            {timeAgo && (
              <div className="absolute bottom-3 right-3">
                <span className="text-[11px] text-white/80 bg-black/40 px-2 py-0.5 rounded-full backdrop-blur-sm">
                  {timeAgo}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-orange-500 to-pink-500">
            <span className="text-sm font-bold text-white">{article.source}</span>
            {timeAgo && <span className="text-xs text-white/80">{timeAgo}</span>}
          </div>
        )}

        <div className="p-4">
          <h3 className={`text-base font-bold leading-snug mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            {article.title}
          </h3>
          {article.description && (
            <p className={`text-sm leading-relaxed mb-4 line-clamp-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              {article.description}
            </p>
          )}
          <button
            onClick={e => { e.stopPropagation(); setShowReader(true); }}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-pink-500 text-white text-sm font-bold
              flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-md"
          >
            Lire l'article complet
            <ArrowTopRightOnSquareIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showReader && (
          <ArticleReader article={article} isDarkMode={isDarkMode} onClose={() => setShowReader(false)} />
        )}
      </AnimatePresence>
    </>
  );
});
InlineNewsCard.displayName = 'InlineNewsCard';

// ─────────────────────────────────────────────
// TOAST
// ─────────────────────────────────────────────
const Toast = memo(({ message, type = "info", onClose }) => {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]);
  const bg = type === "error" ? "bg-red-500" : type === "success" ? "bg-green-500" : "bg-blue-500";
  return <div className={`fixed bottom-4 right-4 ${bg} text-white px-6 py-3 rounded-lg shadow-lg z-50`}>{message}</div>;
});
Toast.displayName = 'Toast';

// ─────────────────────────────────────────────
// LOOP DIVIDER
// ─────────────────────────────────────────────
const LoopDivider = memo(({ isDarkMode }) => (
  <div className={`flex items-center gap-3 px-4 py-5 ${isDarkMode ? 'bg-black' : 'bg-white'}`}>
    <div className={`flex-1 h-px ${isDarkMode ? 'bg-gray-800' : 'bg-gray-200'}`} />
    <span className={`text-[11px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full
      ${isDarkMode ? 'bg-gray-900 text-gray-500 border border-gray-800' : 'bg-gray-50 text-gray-400 border border-gray-200'}`}>
      🔄 Revoir depuis le début
    </span>
    <div className={`flex-1 h-px ${isDarkMode ? 'bg-gray-800' : 'bg-gray-200'}`} />
  </div>
));
LoopDivider.displayName = 'LoopDivider';

// ─────────────────────────────────────────────
// PROGRESSIVE FEED
// ─────────────────────────────────────────────
const ProgressiveFeed = memo(({
  posts, onDeleted, showToast, adConfig,
  apiLoadMoreRef, hasMoreFromAPI,
  searchQuery, isDarkMode, newsArticles, isLoading,
  newPostsCount, onShowNewPosts,
}) => {
  const [displayedPosts, setDisplayedPosts] = useState([]);
  const [loopBoundaries, setLoopBoundaries] = useState([]);
  const sentinelRef  = useRef(null);
  const loopCountRef = useRef(0);

  useEffect(() => {
    if (!posts.length) { setDisplayedPosts([]); setLoopBoundaries([]); return; }
    loopCountRef.current = 0;
    const initial = posts.slice(0, Math.min(PAGE_SIZE, posts.length)).map(p => ({
      ...p,
      _displayKey: `loop0_${p._id}`,
    }));
    setDisplayedPosts(initial);
    setLoopBoundaries([]);
  }, [posts.length === 0 ? 0 : posts[0]?._id]); // eslint-disable-line

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !posts.length) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      setDisplayedPosts(prev => {
        if (!prev.length) return prev;
        const lastLoopStart       = prev.findLastIndex?.(p => p._loopStart) ?? -1;
        const currentCycleStart   = lastLoopStart === -1 ? 0 : lastLoopStart;
        const postsInCurrentCycle = prev.length - currentCycleStart;
        const nextSourceIdx       = postsInCurrentCycle;
        let newPosts;
        let newBoundary = null;
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
        if (newBoundary !== null) setLoopBoundaries(b => [...b, newBoundary]);
        return newPosts;
      });
    }, { rootMargin: '400px' });
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [posts]);

  if (isLoading && posts.length === 0) return <SkeletonPosts count={3} isDarkMode={isDarkMode} />;
  if (!isLoading && posts.length === 0) return (
    <div className="flex flex-col items-center justify-center py-20">
      <p className={`text-lg font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Aucun post à afficher</p>
    </div>
  );

  let newsIdx = 0;
  const loopBoundarySet = new Set(loopBoundaries);
  let loopDividerCount  = 0;

  return (
    <>
      <NewPostsBanner count={newPostsCount} onClick={onShowNewPosts} isDarkMode={isDarkMode} />
      {displayedPosts.map((post, index) => {
        const isLoopStart = loopBoundarySet.has(index);
        const fs       = index === NEWS_INSERT_AFTER - 1;
        const rs       = index >= NEWS_INSERT_AFTER && ((index - NEWS_INSERT_AFTER + 1) % NEWS_REPEAT_EVERY === 0);
        const showNews = !searchQuery && newsArticles.length > 0 && (fs || rs);
        const showAd   = adConfig.enabled && index > 0 && index % adConfig.frequency === 0;
        const article  = showNews ? newsArticles[newsIdx++ % newsArticles.length] : null;
        return (
          <React.Fragment key={post._displayKey}>
            {isLoopStart && <LoopDivider isDarkMode={isDarkMode} loopCount={++loopDividerCount} />}
            <PostItem post={post} onDeleted={onDeleted} showToast={showToast} isPriority={index === 0} />
            {showAd && (
              <div style={{ minHeight: 250, contain: 'layout size' }}>
                <SmartAd slot="feedInline" canClose={true} />
              </div>
            )}
            {article && <InlineNewsCard article={article} isDarkMode={isDarkMode} />}
          </React.Fragment>
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
});
ProgressiveFeed.displayName = 'ProgressiveFeed';

// ─────────────────────────────────────────────
// HOME
// ─────────────────────────────────────────────
const Home = ({ openStoryViewer: openStoryViewerProp, searchQuery = "" }) => {
  const { isDarkMode } = useDarkMode();
  const { fetchStories, stories = [] } = useStories();
  const {
    posts: realPosts = [],
    fetchNextPage,
    hasMore,
    loading: postsLoading,
    refetch,
    removePost,
  } = usePosts() || {};
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

  // News différées 3s pour ne pas bloquer le LCP
  const [newsFetchEnabled, setNewsFetchEnabled] = useState(false);
  useEffect(() => {
    if (!user) return;
    const t = setTimeout(() => setNewsFetchEnabled(true), 3000);
    return () => clearTimeout(t);
  }, [user]);
  const { articles: newsArticles = [] } = useNews({
    maxArticles: 10, category: 'all',
    autoFetch: newsFetchEnabled, enabled: newsFetchEnabled && !!user,
  });

  const isValidPost = useCallback((post) => {
    if (!post?._id) return false;
    if (post._isMock || post.isMockPost || post._id?.startsWith('post_')) return true;
    const u = post.user || post.author || {};
    if (u.isBanned || u.isDeleted || ['deleted', 'banned'].includes(u.status)) return false;
    return !!(u._id || u.id || post.userId || post.author?._id);
  }, []);

  const realPostsLength = realPosts.length;

  const combinedPosts = useMemo(() => {
    const valid = realPosts.filter(isValidPost);
    if (!showMockPosts) return valid;
    const slice = MOCK_POSTS.slice(0, mockPostsCount);
    if (MOCK_CONFIG.mixWithRealPosts && valid.length > 0) {
      const out = []; let mi = 0, ri = 0;
      const ratio = MOCK_CONFIG.realPostsRatio || 2;
      while (mi < slice.length || ri < valid.length) {
        for (let i = 0; i < ratio && ri < valid.length; i++) out.push({ ...valid[ri++], _isMock: false });
        if (mi < slice.length) out.push({ ...slice[mi++], _isMock: true });
      }
      return out;
    }
    return slice.map(p => ({ ...p, _isMock: true }));
  }, [realPostsLength, mockPostsCount, showMockPosts, isValidPost]);

  useEffect(() => {
    if (combinedPosts.length > 0 && !latestPostIdRef.current) {
      latestPostIdRef.current = combinedPosts[0]._id;
    }
  }, [combinedPosts]);

  // Preload LCP
  if (!lcpDone.current && combinedPosts.length > 0) {
    const result = getLCPImageUrl(combinedPosts);
    if (result?.url) {
      injectPreloadLink(result.url, result.type);
      lcpDone.current = true;
    }
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

  // ✅ isLoading = true SEULEMENT si 0 posts (cache miss)
  const isLoading = postsLoading && combinedPosts.length === 0;
  useEffect(() => { loadingRef.current = postsLoading; }, [postsLoading]);

  useEffect(() => {
    if (mockGenStarted.current || isLoading || !MOCK_CONFIG.enabled) return;
    if (!(MOCK_CONFIG.totalPosts > 100 && MOCK_CONFIG.lazyGeneration?.enabled !== false)) return;
    const t = setTimeout(() => {
      if (mockGenStarted.current) return;
      mockGenStarted.current = true;
      const run = () => generateFullDataset(() => {}).catch(() => { mockGenStarted.current = false; });
      typeof requestIdleCallback !== 'undefined'
        ? requestIdleCallback(run, { timeout: 60000 })
        : setTimeout(run, 1000);
    }, 30000);
    return () => clearTimeout(t);
  }, [isLoading]);

  // ✅ INP FIX : showToast dans startTransition → ne bloque pas le thread principal
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

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await fetchStories(true);
      const result     = await refetch?.();
      const freshPosts = result?.posts || [];
      if (freshPosts.length > 0 && latestPostIdRef.current) {
        const latestIdx = freshPosts.findIndex(p => p._id === latestPostIdRef.current);
        const newer     = latestIdx > 0 ? freshPosts.slice(0, latestIdx) : [];
        if (newer.length > 0) { setPendingPosts(newer); setNewPostsCount(newer.length); }
        else { setNewPostsCount(0); setPendingPosts([]); }
      }
    } catch {
      showToast("Erreur lors de l'actualisation", "error");
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, refetch, fetchStories, showToast]);

  useEffect(() => {
    const onHomeRefresh = () => {
      scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      setNewPostsCount(0);
      setPendingPosts([]);
      handleRefresh();
    };
    window.addEventListener(HOME_REFRESH_EVENT, onHomeRefresh);
    return () => window.removeEventListener(HOME_REFRESH_EVENT, onHomeRefresh);
  }, [handleRefresh]);

  // Polling 30s
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
          if (newer.length > 0) { setPendingPosts(newer); setNewPostsCount(newer.length); }
        }
      } catch {}
    };
    const interval = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [user, refetch, isRefreshing]);

  const handleShowNewPosts = useCallback(() => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    if (pendingPosts.length > 0) latestPostIdRef.current = pendingPosts[0]._id;
    setNewPostsCount(0);
    setPendingPosts([]);
  }, [pendingPosts]);

  // Pull to refresh
  useEffect(() => {
    const THRESHOLD = 100;
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
    target.addEventListener('touchstart', onStart, { passive: true });
    target.addEventListener('touchmove',  onMove,  { passive: false });
    target.addEventListener('touchend',   onEnd,   { passive: true });
    return () => {
      if (raf) cancelAnimationFrame(raf);
      target.removeEventListener('touchstart', onStart);
      target.removeEventListener('touchmove',  onMove);
      target.removeEventListener('touchend',   onEnd);
    };
  }, [handleRefresh]);

  const handleApiObserver = useCallback((entries) => {
    if (!entries[0].isIntersecting || loadingRef.current || isRefreshing) return;
    startPageTransition(() => {
      if (showMockPosts && mockPostsCount < MOCK_POSTS.length)
        setMockPostsCount(prev => Math.min(prev + MOCK_CONFIG.loadMoreCount, MOCK_POSTS.length));
      if (hasMore) fetchNextPage();
    });
  }, [hasMore, fetchNextPage, isRefreshing, showMockPosts, mockPostsCount]);

  useEffect(() => {
    if (!apiObserverRef.current) return;
    const obs = new IntersectionObserver(handleApiObserver, { rootMargin: "400px" });
    obs.observe(apiObserverRef.current);
    return () => obs.disconnect();
  }, [handleApiObserver]);

  return (
    <div className="flex flex-col h-full scrollbar-hide" style={{ minHeight: '100vh' }}>
      <PullToRefreshIndicator
        isPulling={pullUIState.isPulling}
        pullDistance={pullUIState.distance}
        isDarkMode={isDarkMode}
      />

      {!showPyramid && (
        <>
          {/*
           * ✅ CLS FIX : height ET minHeight FIXES avec STORY_BAR_HEIGHT (constante)
           * contain:'strict' → isole complètement du layout parent
           * Le navigateur réserve exactement 120px AVANT que React hydrate
           * → zéro layout shift quand StoryContainer apparaît
           */}
          <div
            className={`sticky top-0 z-30 ${isDarkMode ? "bg-black" : "bg-white"}`}
            style={{
              height:    STORY_BAR_HEIGHT,
              minHeight: STORY_BAR_HEIGHT,
              contain:   'strict',
            }}
          >
            <StoryContainer
              onOpenStory={handleOpenStory}
              onOpenCreator={() => setShowCreator(true)}
              onOpenPyramid={() => setShowPyramid(true)}
              isDarkMode={isDarkMode}
            />
          </div>

          <div ref={scrollContainerRef} className="flex-1 overflow-y-auto scrollbar-hide">
            <div ref={feedTopRef} />
            <div className="w-full lg:max-w-[630px] lg:mx-auto">
              {searchQuery && (
                <div className={`p-4 text-center text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  {isPending ? 'Recherche...' : `${filteredPosts.length} résultat(s) pour "${deferredSearch}"`}
                </div>
              )}
              <ProgressiveFeed
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
              />
            </div>
          </div>
        </>
      )}

      <AnimatePresence>
        {showCreator && <StoryCreator onClose={() => setShowCreator(false)} />}
        {showStoryViewer && (
          <Suspense fallback={null}>
            <StoryViewer stories={viewerData.stories} currentUser={user} onClose={() => setShowStoryViewer(false)} />
          </Suspense>
        )}
        {showPyramid && (
          <Suspense fallback={null}>
            <ImmersivePyramidUniverse
              onClose={() => setShowPyramid(false)} stories={stories}
              currentUser={user} onOpenStory={handleOpenStory}
            />
          </Suspense>
        )}
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </AnimatePresence>
    </div>
  );
};

export default memo(Home);