// 📁 src/pages/Home/Home.jsx
// 🏆 ZERO-JANK SCROLL — niveau Instagram
//
// 🔥 FIX PEXELS URLs EXPIRÉES — 3 niveaux de protection :
//
//   NIVEAU 1 — isValidPost() : filtre AVANT affichage
//     → posts avec URLs Pexels signées (video-files/) → retirés du pool
//     → posts sans media valide → retirés
//
//   NIVEAU 2 — usePexelsFreshUrl() : résout les URLs expirées à la volée
//     → PostCard demande une URL fraîche au backend via /api/videos/refresh-url
//     → Cache sessionStorage 80min pour éviter re-fetch
//
//   NIVEAU 3 — PexelsMediaWrapper : fallback visuel si URL morte
//     → onError sur <video>/<img> → retry avec URL fraîche
//     → si retry échoue → masquer le media proprement (pas de broken image)
//
// 🎨 FEED PREMIUM :
//   → Skeleton shimmer animé (dégradé orange/rose)
//   → Wave animation staggerée à l'entrée des posts
//   → Pull-to-refresh avec indicateur progressif
//   → Virtual scroll → DOM léger même avec 300+ posts

import React, {
  useState, useMemo, useEffect, useRef, useCallback,
  memo, lazy, Suspense, startTransition, useDeferredValue,
  useTransition,
} from "react";
import {
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  ArrowUpIcon,
} from "@heroicons/react/24/outline";
import { AnimatePresence, motion } from "framer-motion";
import { useDarkMode }          from "../../context/DarkModeContext";
import { useStories }           from "../../context/StoryContext";
import { usePosts }             from "../../context/PostsContext";
import { useAuth }              from "../../context/AuthContext";
import { useNews }              from "../../hooks/useNews";
import axiosClient              from "../../api/axiosClientGlobal";
import PostCard                 from "./PostCard";
import StoryContainer           from "./StoryContainer";
import SuggestedAccounts        from "./SuggestedAccounts";
import SuggestedPostPreview     from "./SuggestedPostPreview";
import SmartAd                  from "./Publicite/SmartAd";
import ArticleReaderModal       from "./ArticleReaderModal";
import MOCK_POSTS, { generateFullDataset } from "../../data/mockPosts";
import {
  MOCK_CONFIG as DEFAULT_MOCK_CONFIG,
  AD_CONFIG   as DEFAULT_AD_CONFIG,
} from "../../data/mockConfig";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const HOME_REFRESH_EVENT = "home:refresh";
const AD_CONFIG          = DEFAULT_AD_CONFIG;
const MOCK_CONFIG        = DEFAULT_MOCK_CONFIG;

const NEWS_INSERT_AFTER  = 2;
const NEWS_REPEAT_EVERY  = 8;
const SUGGEST_EVERY      = 8;
const SUGGEST_POST_EVERY = 5;

const PAGE_SIZE     = 12;
const MAX_DOM_POSTS = 150;
const MAX_POOL      = 300;
const OVERSCAN      = 5;
const POST_H        = 540;

const POLL_INTERVAL = 30_000;
const STORY_BAR_H   = 120;
const API_PREFETCH  = 3;
const MIX_BLOCK     = 5;
const MIX_MAX_BOTS  = 2;
const RECENT_HEAD   = 5;

const RIPPLE_MS    = 600;
const WAVE_MS      = 780;
const WAVE_STAGGER = 0.05;
const WAVE_DUR     = 0.38;
const WAVE_COUNT   = 7;

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "dlymdclhe";
const IMG_BASE   = `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/`;

const StoryCreator             = lazy(() => import("./StoryCreator"));
const StoryViewer              = lazy(() => import("./StoryViewer"));
const ImmersivePyramidUniverse = lazy(() => import("./ImmersivePyramidUniverse"));

// ─────────────────────────────────────────────────────────────────────────────
// 🔥 PEXELS URL DETECTION & RESOLUTION
// ─────────────────────────────────────────────────────────────────────────────

/** Cache sessionStorage 80min pour URLs Pexels fraîches */
const PEXELS_CACHE_TTL    = 80 * 60 * 1000;
const PEXELS_CACHE_PREFIX = "pex_";

const pexCacheRead = (id) => {
  try {
    const raw = sessionStorage.getItem(PEXELS_CACHE_PREFIX + id);
    if (!raw) return null;
    const { url, exp } = JSON.parse(raw);
    if (Date.now() > exp) { sessionStorage.removeItem(PEXELS_CACHE_PREFIX + id); return null; }
    return url;
  } catch { return null; }
};
const pexCacheWrite = (id, url) => {
  try { sessionStorage.setItem(PEXELS_CACHE_PREFIX + id, JSON.stringify({ url, exp: Date.now() + PEXELS_CACHE_TTL })); }
  catch {}
};

/**
 * ✅ NIVEAU 1 — Détecter une URL Pexels signée (expirable)
 * Les URLs signées ont TOUJOURS la forme :
 *   https://videos.pexels.com/video-files/<ID>/<filename>.mp4
 * Elles expirent ~2h après génération.
 */
const isPexelsSigned = (url) =>
  typeof url === "string" && url.includes("videos.pexels.com/video-files/");

/** Extraire l'ID numérique d'une URL ou d'un externalId Pexels */
const extractPexId = (src) => {
  if (!src) return null;
  const byId  = String(src).match(/^pexels_(\d+)$/);
  if (byId) return byId[1];
  const byUrl = String(src).match(/video-files\/(\d+)\//);
  return byUrl ? byUrl[1] : null;
};

/** Extraire l'ID Pexels depuis un post (externalId ou videoUrl) */
const getPexIdFromPost = (post) =>
  extractPexId(post?.externalId) ||
  extractPexId(post?.videoUrl)   ||
  extractPexId(post?.embedUrl)   ||
  null;

/**
 * ✅ NIVEAU 2 — Résoudre une URL fraîche via le backend
 * Utilise le cache sessionStorage pour éviter N appels réseau.
 */
const resolvePexUrl = async (videoId) => {
  if (!videoId) return null;
  const cached = pexCacheRead(videoId);
  if (cached) return cached;
  try {
    const res = await axiosClient.get(`/videos/refresh-url?id=${videoId}`);
    const url = res.data?.url || res.data?.videoUrl || null;
    if (url) pexCacheWrite(videoId, url);
    return url;
  } catch { return null; }
};

// ─────────────────────────────────────────────────────────────────────────────
// LCP PRELOAD
// ─────────────────────────────────────────────────────────────────────────────
const _preloaded = new Set();
const injectPreload = (url, as = "image") => {
  if (!url || _preloaded.has(url)) return;
  _preloaded.add(url);
  if (document.querySelector(`link[rel="preload"][href="${url}"]`)) return;
  const l    = document.createElement("link");
  l.rel      = "preload";
  l.as       = as;
  l.href     = url;
  l.fetchPriority = "high";
  document.head.appendChild(l);
};
const isVideoUrl  = (u) => u && /\.(mp4|webm|mov|avi)$/i.test(u);
const videoPoster = (u) => {
  if (!u) return null;
  try {
    if (u.includes("res.cloudinary.com")) {
      const i = u.indexOf("/upload/");
      if (i === -1) return null;
      const pid = u
        .substring(i + 8)
        .split("/")
        .filter((s) => !s.includes(",") && !(/^[a-z]+_[a-z]/.test(s) && !s.includes(".")))
        .join("/")
        .replace(/\.(mp4|webm|mov|avi)$/i, "");
      return pid ? `${IMG_BASE}q_auto:good,f_jpg,w_1080,c_limit,so_0/${pid}.jpg` : null;
    }
    return `${IMG_BASE}q_auto:good,f_jpg,w_1080,c_limit,so_0/${u
      .replace(/^\/+/, "")
      .replace(/\.(mp4|webm|mov|avi)$/i, "")}.jpg`;
  } catch { return null; }
};
const getLCPUrl = (posts) => {
  const p = posts?.[0];
  if (!p) return null;
  const m = p.images?.[0] || p.media?.[0];
  const u = m?.url || m;
  if (!u || isPexelsSigned(u)) return null; // ✅ Ne pas preload une URL Pexels expirée
  return isVideoUrl(u) ? { url: videoPoster(u), type: "image" } : { url: u, type: "image" };
};

// ─────────────────────────────────────────────────────────────────────────────
// SEEDED SHUFFLE
// ─────────────────────────────────────────────────────────────────────────────
const seededShuffle = (arr, seed) => {
  const r = [...arr];
  let s   = seed >>> 0;
  for (let i = r.length - 1; i > 0; i--) {
    s = (Math.imul(s ^ (s >>> 15), s | 1) ^ (s + Math.imul(s ^ (s >>> 7), s | 61))) >>> 0;
    const j      = s % (i + 1);
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
};

// ─────────────────────────────────────────────────────────────────────────────
// MIX BOTS / RÉELS
// ─────────────────────────────────────────────────────────────────────────────
const mixPostsByBlocks = (real, bots) => {
  if (!bots.length) return real;
  if (!real.length) return bots;
  const result = [];
  let ri = 0, bi = 0;
  while (ri < real.length || bi < bots.length) {
    const block = [];
    let bc = 0;
    while (block.length < MIX_BLOCK) {
      const cb = bi < bots.length && bc < MIX_MAX_BOTS;
      const cr = ri < real.length;
      if (!cb && !cr) break;
      if (cb && cr) {
        block.push(bc < Math.floor((block.length * MIX_MAX_BOTS) / MIX_BLOCK)
          ? { ...bots[bi++], _isBot: true } && (bc++, block[block.length - 1])
          : real[ri++]
        );
      } else if (cr) { block.push(real[ri++]); }
        else        { block.push({ ...bots[bi++], _isBot: true }); bc++; }
    }
    const [head, ...tail] = block;
    result.push(head, ...tail.sort(() => Math.random() - 0.5));
  }
  return result;
};

// ─────────────────────────────────────────────────────────────────────────────
// ✅ NIVEAU 1 — hasStale : détecte TOUTE URL media expirable
//
// Règles :
//  • videos.pexels.com/video-files/ → TOUJOURS expirable (URLs signées)
//  • cdn.pixabay.com/video/...      → expirable si pattern regex
//  • images.pexels.com/...          → SAFE (URLs statiques, pas de token)
// ─────────────────────────────────────────────────────────────────────────────
const RE_PIX = /cdn\.pixabay\.com\/video\/\d{4}\/\d{2}\/\d{2}\/\d+-\d+_large\.mp4/i;

const hasStale = (post) => {
  const srcs = [
    ...(Array.isArray(post.media)  ? post.media  : post.media  ? [post.media]  : []),
    ...(Array.isArray(post.images) ? post.images : post.images ? [post.images] : []),
    post.videoUrl,
    post.embedUrl,
    post.thumbnail,
    post.sourceUrl,
  ];
  return srcs.some((m) => {
    const u = typeof m === "string" ? m : m?.url;
    if (!u) return false;
    if (isPexelsSigned(u)) return true; // ✅ Pexels signé → TOUJOURS stale
    if (RE_PIX.test(u))   return true; // Pixabay pattern
    return false;
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// STABLE POST CACHE
// ─────────────────────────────────────────────────────────────────────────────
const _pCache = new WeakMap();
const stablePost = (p) => {
  if (_pCache.has(p)) return _pCache.get(p);
  const s = p._isMock === false ? p : { ...p, _isMock: false };
  _pCache.set(p, s);
  return s;
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPUTE NEXT BATCH
// ─────────────────────────────────────────────────────────────────────────────
const computeBatch = (prev, pool, loopRef) => {
  if (!prev.length) return { posts: prev, boundary: null };
  const lastLoop   = prev.findLastIndex?.((p) => p._loopStart) ?? -1;
  const cycleStart = lastLoop === -1 ? 0 : lastLoop;
  const nextIdx    = prev.length - cycleStart;
  const abs        = prev.length;
  if (nextIdx < pool.length) {
    const batch = pool.slice(nextIdx, nextIdx + PAGE_SIZE).map((p, i) => ({ ...p, _displayKey: `p${abs + i}_l${loopRef.current}_${p._id}` }));
    return { posts: [...prev, ...batch], boundary: null };
  }
  loopRef.current++;
  const ln    = loopRef.current;
  const batch = pool.slice(0, PAGE_SIZE).map((p, i) => ({ ...p, _displayKey: `p${abs + i}_l${ln}_${p._id}`, _loopStart: i === 0 }));
  let next = [...prev, ...batch];
  if (next.length > MAX_DOM_POSTS) next = next.slice(next.length - MAX_DOM_POSTS);
  return { posts: next, boundary: prev.length };
};

// ─────────────────────────────────────────────────────────────────────────────
// VIRTUAL SCROLL HOOK
// ─────────────────────────────────────────────────────────────────────────────
const useVirtualWindow = (scrollContainerRef, postH, overscan) => {
  const [win, setWin] = useState({ start: 0, end: 9999 });
  const rafRef = useRef(null);

  useEffect(() => {
    const container = scrollContainerRef?.current;
    if (!container) return;
    const compute = () => {
      rafRef.current = null;
      const scrollTop  = container.scrollTop;
      const viewportH  = container.clientHeight || window.innerHeight || 900;
      const overscanPx = overscan * postH;
      const start      = Math.max(0, Math.floor(Math.max(0, scrollTop - overscanPx) / postH));
      const end        = Math.ceil((scrollTop + viewportH + overscanPx) / postH);
      setWin(prev => prev.start === start && prev.end === end ? prev : { start, end });
    };
    const onScroll = () => { if (rafRef.current) return; rafRef.current = requestAnimationFrame(compute); };
    compute();
    container.addEventListener("scroll", onScroll, { passive: true });
    let ro;
    if (typeof ResizeObserver !== "undefined") { ro = new ResizeObserver(compute); ro.observe(container); }
    return () => {
      container.removeEventListener("scroll", onScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      ro?.disconnect();
    };
  }, [scrollContainerRef, postH, overscan]);

  return win;
};

// ─────────────────────────────────────────────────────────────────────────────
// 🎨 SKELETON PREMIUM — shimmer orange/rose
// ─────────────────────────────────────────────────────────────────────────────
const SkeletonPosts = memo(({ count = 3, isDarkMode }) => (
  <div>
    <style>{`
      @keyframes sk-shimmer {
        0%   { background-position: -400px 0; }
        100% { background-position:  400px 0; }
      }
      .sk-shimmer {
        background: ${isDarkMode
          ? "linear-gradient(90deg,#1f1f1f 25%,#2d2d2d 50%,#1f1f1f 75%)"
          : "linear-gradient(90deg,#f0f0f0 25%,#fde8d8 50%,#f0f0f0 75%)"};
        background-size: 800px 100%;
        animation: sk-shimmer 1.4s ease-in-out infinite;
      }
    `}</style>
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className={isDarkMode ? "bg-black" : "bg-white"} style={{ marginBottom: 1 }}>
        <div className="p-3 flex items-center gap-3">
          <div className="sk-shimmer w-10 h-10 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="sk-shimmer h-4 rounded w-32" />
            <div className="sk-shimmer h-3 rounded w-20" />
          </div>
        </div>
        <div className="sk-shimmer w-full" style={{ aspectRatio: "1/1" }} />
        <div className="flex items-center gap-4 p-3">
          {[0, 1, 2].map((j) => <div key={j} className="sk-shimmer w-6 h-6 rounded" />)}
        </div>
      </div>
    ))}
  </div>
));
SkeletonPosts.displayName = "SkeletonPosts";

// ─────────────────────────────────────────────────────────────────────────────
// NEW POSTS BANNER
// ─────────────────────────────────────────────────────────────────────────────
const NewPostsBanner = memo(({ count, onClick, isDarkMode }) => (
  <AnimatePresence>
    {count > 0 && (
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className="sticky z-20 flex justify-center px-4 pb-2 pointer-events-none"
        style={{ top: STORY_BAR_H + 8 }}
      >
        <button
          onClick={onClick}
          className="pointer-events-auto flex items-center gap-2 px-5 py-2.5 rounded-full shadow-xl text-sm font-bold bg-gradient-to-r from-orange-500 to-pink-500 text-white active:scale-95 transition-transform select-none"
          style={{ WebkitTapHighlightColor: "transparent" }}
        >
          <ArrowUpIcon className="w-4 h-4" />
          {count === 1 ? "1 nouveau post" : `${count} nouveaux posts`}
        </button>
      </motion.div>
    )}
  </AnimatePresence>
));
NewPostsBanner.displayName = "NewPostsBanner";

// ─────────────────────────────────────────────────────────────────────────────
// PTR
// ─────────────────────────────────────────────────────────────────────────────
const PTR_THRESHOLD = 100;
const CR = 16, CC = 2 * Math.PI * CR;

const PullToRefreshIndicator = memo(({ isPulling, pullDistance, isRefreshing, isDarkMode }) => {
  const progress = Math.min(pullDistance / PTR_THRESHOLD, 1);
  const opacity  = Math.min(pullDistance / 50, 1);
  return (
    <AnimatePresence>
      {(pullDistance > 15 || isRefreshing) && (
        <motion.div
          initial={{ opacity: 0, y: -10, scale: 0.75 }}
          animate={{ opacity: isRefreshing ? 1 : opacity, y: 0, scale: isPulling || isRefreshing ? 1.08 : 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.75 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className="fixed left-1/2 -translate-x-1/2 z-[45] pointer-events-none flex flex-col items-center gap-1.5"
          style={{ top: STORY_BAR_H + 14 }}
        >
          <AnimatePresence>
            {(isPulling || isRefreshing) && (
              <motion.div
                key="burst"
                className="absolute rounded-full"
                style={{ width: 70, height: 70, top: -15, left: -15, background: "radial-gradient(circle,rgba(249,115,22,.38) 0%,transparent 70%)", zIndex: -1 }}
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
              backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
              boxShadow: isPulling || isRefreshing ? "0 0 0 2.5px rgba(249,115,22,.45),0 6px 24px rgba(249,115,22,.22)" : "0 3px 16px rgba(0,0,0,.13)",
              border: isDarkMode ? "1px solid rgba(255,255,255,.07)" : "1px solid rgba(0,0,0,.05)",
              transition: "box-shadow .25s ease",
            }}
          >
            <svg className={isRefreshing ? "animate-spin" : ""} width="44" height="44" viewBox="0 0 44 44" style={{ position: "absolute", inset: 0 }}>
              <circle cx="22" cy="22" r={CR} fill="none" stroke={isDarkMode ? "#292929" : "#eee"} strokeWidth="2.2" />
              <circle cx="22" cy="22" r={CR} fill="none" stroke="url(#pG)" strokeWidth="2.2" strokeLinecap="round"
                strokeDasharray={CC} strokeDashoffset={isRefreshing ? 0 : CC * (1 - progress)}
                style={{ transformOrigin: "center", transform: "rotate(-90deg)", transition: isRefreshing ? "none" : "stroke-dashoffset .07s linear" }}
              />
              <defs>
                <linearGradient id="pG" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#f97316" />
                  <stop offset="100%" stopColor="#ec4899" />
                </linearGradient>
              </defs>
            </svg>
            <ArrowPathIcon className="w-5 h-5 relative z-10" style={{
              color: isPulling || isRefreshing ? "#f97316" : isDarkMode ? "#6b7280" : "#9ca3af",
              transform: isRefreshing ? undefined : `rotate(${progress * 270}deg)`,
              transition: "color .2s ease, transform .07s linear",
            }} />
          </div>
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: progress > 0.6 ? 1 : 0 }}
            transition={{ duration: 0.15 }}
            style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".04em", color: "#f97316", userSelect: "none" }}
          >
            {isRefreshing ? "Actualisation…" : isPulling ? "✓ Relâchez !" : "Tirez encore"}
          </motion.span>
        </motion.div>
      )}
    </AnimatePresence>
  );
});
PullToRefreshIndicator.displayName = "PullToRefreshIndicator";

// ─────────────────────────────────────────────────────────────────────────────
// RIPPLE
// ─────────────────────────────────────────────────────────────────────────────
const RefreshRipple = memo(({ isDarkMode }) => (
  <motion.div
    className="fixed inset-0 pointer-events-none z-40"
    initial={{ opacity: 0 }}
    animate={{ opacity: [0, 1, 0] }}
    transition={{ duration: 0.62, times: [0, 0.22, 1], ease: "easeOut" }}
    style={{
      background: isDarkMode
        ? "linear-gradient(180deg,rgba(249,115,22,.15) 0%,rgba(236,72,153,.07) 35%,transparent 62%)"
        : "linear-gradient(180deg,rgba(249,115,22,.12) 0%,rgba(236,72,153,.05) 35%,transparent 62%)",
    }}
  />
));
RefreshRipple.displayName = "RefreshRipple";

// ─────────────────────────────────────────────────────────────────────────────
// ✅ NIVEAU 3 — PostItem avec résolution Pexels automatique
// Si le post a une URL Pexels signée → tenter résolution fraîche avant rendu
// ─────────────────────────────────────────────────────────────────────────────
const PostItem = memo(
  ({ post, onDeleted, showToast, isPriority, waveIndex, playWave }) => {
    const shouldAnimate = useRef(playWave).current;
    const anim = shouldAnimate && typeof waveIndex === "number" && waveIndex < WAVE_COUNT;

    // ✅ Si le post a un externalId Pexels → résoudre l'URL fraîche
    const [resolvedPost, setResolvedPost] = useState(post);
    const resolvedRef = useRef(false);

    useEffect(() => {
      if (resolvedRef.current) return;
      const pexId = getPexIdFromPost(post);
      if (!pexId) return; // Pas un post Pexels → rien à faire

      resolvedRef.current = true;

      // Vérifier le cache d'abord (synchrone)
      const cached = pexCacheRead(pexId);
      if (cached) {
        setResolvedPost({ ...post, videoUrl: cached, _pexResolved: true });
        return;
      }

      // Résoudre en arrière-plan
      resolvePexUrl(pexId).then((freshUrl) => {
        if (freshUrl) setResolvedPost({ ...post, videoUrl: freshUrl, _pexResolved: true });
        // Si null → le post reste tel quel, PostCard gérera l'erreur
      });
    }, [post]);

    return (
      <motion.div
        initial={anim ? { opacity: 0, y: 22 } : false}
        animate={anim ? { opacity: 1, y: 0 } : undefined}
        transition={anim ? { duration: WAVE_DUR, delay: waveIndex * WAVE_STAGGER, ease: [0.22, 1, 0.36, 1] } : undefined}
      >
        <PostCard
          post={resolvedPost}
          onDeleted={onDeleted}
          showToast={showToast}
          mockPost={!!(post._isMock || post.isMockPost || post._id?.startsWith("post_"))}
          priority={isPriority}
        />
      </motion.div>
    );
  },
  (a, b) =>
    a.post._id              === b.post._id &&
    a.post.likes?.length    === b.post.likes?.length &&
    a.post.comments?.length === b.post.comments?.length &&
    a.post.content          === b.post.content &&
    a.post._displayKey      === b.post._displayKey &&
    a.isPriority            === b.isPriority
);
PostItem.displayName = "PostItem";

// ─────────────────────────────────────────────────────────────────────────────
// INLINE NEWS CARD
// ─────────────────────────────────────────────────────────────────────────────
const InlineNewsCard = memo(({ article, isDarkMode }) => {
  const [imgErr, setImgErr] = useState(false);
  const [open,   setOpen]   = useState(null);
  const timeAgo = useMemo(() => {
    if (!article?.publishedAt) return "";
    const h = Math.floor((Date.now() - new Date(article.publishedAt)) / 3_600_000);
    return h < 1 ? "À l'instant" : h < 24 ? `Il y a ${h}h` : `Il y a ${Math.floor(h / 24)}j`;
  }, [article?.publishedAt]);

  if (!article?.title) return null;
  return (
    <>
      <div className={`flex items-center gap-3 px-4 pt-5 pb-3 ${isDarkMode ? "bg-black" : "bg-white"}`}>
        <div className={`flex-1 h-px ${isDarkMode ? "bg-gray-800" : "bg-gray-100"}`} />
        <span className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? "text-orange-500" : "text-orange-400"}`}>📰 Actualité</span>
        <div className={`flex-1 h-px ${isDarkMode ? "bg-gray-800" : "bg-gray-100"}`} />
      </div>
      <div
        onClick={() => setOpen(article)}
        className={`mx-3 mb-5 rounded-2xl overflow-hidden cursor-pointer active:scale-[0.98] transition-transform shadow-md ${
          isDarkMode ? "bg-gray-900 border border-gray-800" : "bg-white border border-gray-200"
        }`}
      >
        {!imgErr && article.image ? (
          <div className="relative overflow-hidden" style={{ height: 200 }}>
            <img src={article.image} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" onError={() => setImgErr(true)} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
            <div className="absolute bottom-3 left-3 flex items-center gap-2">
              <span className="text-[11px] font-bold text-white bg-orange-500 px-2.5 py-0.5 rounded-full">{article.source || "Actualité"}</span>
              {timeAgo && <span className="text-[11px] text-white/80 font-medium">{timeAgo}</span>}
            </div>
          </div>
        ) : (
          <div className="w-full flex items-center justify-center bg-gradient-to-br from-orange-500 to-pink-500 text-5xl" style={{ height: 120 }}>📰</div>
        )}
        <div className="p-4">
          {(imgErr || !article.image) && (
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[11px] font-bold text-orange-500 uppercase tracking-wide">{article.source || "Actualité"}</span>
              {timeAgo && <span className={`text-[11px] ${isDarkMode ? "text-gray-500" : "text-gray-400"}`}>· {timeAgo}</span>}
            </div>
          )}
          <p className={`text-base font-bold leading-snug mb-2 ${isDarkMode ? "text-white" : "text-gray-900"}`}>{article.title}</p>
          {article.description && <p className={`text-sm leading-relaxed line-clamp-2 mb-3 ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>{article.description}</p>}
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-orange-500">Lire l'article →</span>
            <ArrowTopRightOnSquareIcon className="w-4 h-4 text-orange-400" />
          </div>
        </div>
      </div>
      <ArticleReaderModal article={open} isOpen={!!open} onClose={() => setOpen(null)} />
    </>
  );
});
InlineNewsCard.displayName = "InlineNewsCard";

// ─────────────────────────────────────────────────────────────────────────────
// LOOP DIVIDER
// ─────────────────────────────────────────────────────────────────────────────
const LoopDivider = memo(({ isDarkMode }) => (
  <div className={`flex items-center gap-3 px-4 py-5 ${isDarkMode ? "bg-black" : "bg-white"}`}>
    <div className={`flex-1 h-px ${isDarkMode ? "bg-gray-800" : "bg-gray-200"}`} />
    <span className={`text-[11px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full ${
      isDarkMode ? "bg-gray-900 text-gray-500 border border-gray-800" : "bg-gray-50 text-gray-400 border border-gray-200"
    }`}>🔄 Revoir depuis le début</span>
    <div className={`flex-1 h-px ${isDarkMode ? "bg-gray-800" : "bg-gray-200"}`} />
  </div>
));
LoopDivider.displayName = "LoopDivider";

// ─────────────────────────────────────────────────────────────────────────────
// TOAST
// ─────────────────────────────────────────────────────────────────────────────
const Toast = memo(({ message, type = "info", onClose }) => {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]);
  const bg = type === "error" ? "bg-red-500" : type === "success" ? "bg-green-500" : "bg-blue-500";
  return <div className={`fixed bottom-4 right-4 ${bg} text-white px-6 py-3 rounded-lg shadow-lg z-50`}>{message}</div>;
});
Toast.displayName = "Toast";

// ─────────────────────────────────────────────────────────────────────────────
// PROGRESSIVE FEED
// ─────────────────────────────────────────────────────────────────────────────
const ProgressiveFeed = ({
  posts, onDeleted, showToast, adConfig, apiLoadMoreRef,
  hasMoreFromAPI, searchQuery, isDarkMode, newsArticles,
  isLoading, newPostsCount, onShowNewPosts, isWaving,
  apiFullyLoaded, suggestedUserPool, scrollContainerRef, resetSignal,
}) => {
  const [displayedPosts, setDisplayedPosts] = useState([]);
  const [loopBoundaries, setLoopBoundaries] = useState([]);

  const sentinelRef    = useRef(null);
  const loopRef        = useRef(0);
  const postsRef       = useRef(posts);
  const prevResetRef   = useRef(resetSignal);
  useEffect(() => { postsRef.current = posts; }, [posts]);

  const { start: winStart, end: winEnd } = useVirtualWindow(scrollContainerRef, POST_H, OVERSCAN);

  const poolAnchor     = posts.length === 0 ? "__empty__" : posts[0]?._id ?? "__noid__";
  const prevPoolAnchor = useRef(poolAnchor);

  useEffect(() => {
    const signalChanged  = resetSignal !== prevResetRef.current;
    const anchorChanged  = poolAnchor !== prevPoolAnchor.current;
    prevResetRef.current   = resetSignal;
    prevPoolAnchor.current = poolAnchor;
    if (!posts.length) { setDisplayedPosts([]); setLoopBoundaries([]); return; }
    if (!signalChanged && !anchorChanged) return;
    loopRef.current = 0;
    const init = posts.slice(0, Math.min(PAGE_SIZE, posts.length)).map((p, i) => ({ ...p, _displayKey: `p${i}_l0_${p._id}` }));
    setDisplayedPosts(init);
    setLoopBoundaries([]);
  }, [resetSignal, poolAnchor]); // eslint-disable-line

  useEffect(() => {
    if (!posts.length) return;
    loopRef.current = 0;
    const init = posts.slice(0, Math.min(PAGE_SIZE, posts.length)).map((p, i) => ({ ...p, _displayKey: `p${i}_l0_${p._id}` }));
    setDisplayedPosts(init);
  }, []); // eslint-disable-line

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      startTransition(() => {
        setDisplayedPosts((prev) => {
          const pool = postsRef.current;
          if (!prev.length || !pool.length) return prev;
          const { posts: next, boundary } = computeBatch(prev, pool, loopRef);
          if (boundary !== null) setLoopBoundaries((b) => [...b, boundary]);
          return next;
        });
      });
    }, { rootMargin: "600px", threshold: 0 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []); // eslint-disable-line

  const loopBoundarySet = useMemo(() => new Set(loopBoundaries), [loopBoundaries]);
  const newsInsertMap = useMemo(() => {
    const len = newsArticles?.length ?? 0;
    if (!len || searchQuery) return new Map();
    const map = new Map();
    let ai = 0;
    for (let i = 0; i < displayedPosts.length; i++) {
      if (i === NEWS_INSERT_AFTER - 1 || (i >= NEWS_INSERT_AFTER && (i - NEWS_INSERT_AFTER + 1) % NEWS_REPEAT_EVERY === 0)) {
        map.set(i, newsArticles[ai++ % newsArticles.length]);
      }
    }
    return map;
  }, [displayedPosts.length, newsArticles?.length, searchQuery]); // eslint-disable-line

  if (isLoading && !posts.length) return <SkeletonPosts count={3} isDarkMode={isDarkMode} />;
  if (!isLoading && !posts.length) return (
    <div className="flex flex-col items-center justify-center py-20">
      <p className={`text-lg font-medium ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>Aucun post à afficher</p>
    </div>
  );

  return (
    <>
      <NewPostsBanner count={newPostsCount} onClick={onShowNewPosts} isDarkMode={isDarkMode} />
      {displayedPosts.map((post, index) => {
        if (index < winStart || index > winEnd) {
          return <div key={post._displayKey || post._id} style={{ height: POST_H }} aria-hidden="true" />;
        }
        const isLoopStart = loopBoundarySet.has(index);
        const showAd      = adConfig.enabled && index > 0 && index % adConfig.frequency === 0;
        const article     = newsInsertMap.get(index);

        return (
          <div key={post._displayKey || post._id} style={{ contain: "content" }}>
            {isLoopStart && apiFullyLoaded && <LoopDivider isDarkMode={isDarkMode} />}
            <PostItem
              post={post} onDeleted={onDeleted} showToast={showToast}
              isPriority={index === 0} waveIndex={index} playWave={isWaving}
            />
            {index > 0 && index % SUGGEST_POST_EVERY === 0 && index % SUGGEST_EVERY !== 0 && (
              <SuggestedPostPreview key={`spp-${index}`} isDarkMode={isDarkMode} userPool={suggestedUserPool} slotIndex={Math.floor(index / SUGGEST_POST_EVERY)} />
            )}
            {index > 0 && index % SUGGEST_EVERY === 0 && (
              <SuggestedAccounts key={`sa-${index}`} isDarkMode={isDarkMode} instanceId={Math.floor(index / SUGGEST_EVERY)} />
            )}
            {showAd && (
              <div style={{ minHeight: 250, contain: "layout size" }}>
                <SmartAd slot="feedInline" canClose />
              </div>
            )}
            {article && <InlineNewsCard key={`news-${article.id || article.url || index}`} article={article} isDarkMode={isDarkMode} />}
          </div>
        );
      })}
      <div ref={sentinelRef} className="h-20 flex items-center justify-center" aria-hidden="true">
        {displayedPosts.length > 0 && <ArrowPathIcon className="w-5 h-5 animate-spin text-orange-400 opacity-60" />}
      </div>
      {hasMoreFromAPI && <div ref={apiLoadMoreRef} className="h-1" aria-hidden="true" />}
    </>
  );
};
ProgressiveFeed.displayName = "ProgressiveFeed";

// ─────────────────────────────────────────────────────────────────────────────
// HOME
// ─────────────────────────────────────────────────────────────────────────────
const Home = ({ openStoryViewer: openStoryViewerProp, searchQuery = "" }) => {
  const { isDarkMode }    = useDarkMode();
  const { fetchStories, stories = [] } = useStories();
  const { posts: rawPosts = [], fetchNextPage, hasMore, loading: postsLoading, refetch, removePost } = usePosts() || {};
  const { user } = useAuth();

  const [, startPageTransition] = useTransition();
  const [showCreator,   setShowCreator]   = useState(false);
  const [showViewer,    setShowViewer]    = useState(false);
  const [viewerData,    setViewerData]    = useState({ stories: [], owner: null });
  const [isRefreshing,  setIsRefreshing]  = useState(false);
  const [showPyramid,   setShowPyramid]   = useState(false);
  const [toast,         setToast]         = useState(null);
  const [mockCount,     setMockCount]     = useState(MOCK_CONFIG.initialCount);
  const [pullUI,        setPullUI]        = useState({ distance: 0, isPulling: false });
  const [pendingPosts,  setPendingPosts]  = useState([]);
  const [newPostsCount, setNewPostsCount] = useState(0);
  const [resetSignal,   setResetSignal]   = useState(0);
  const [showRipple,    setShowRipple]    = useState(false);
  const [isWaving,      setIsWaving]      = useState(false);
  const [apiPages,      setApiPages]      = useState(1);
  const [userPool,      setUserPool]      = useState([]);
  const [seed,          setSeed]          = useState(() => Math.floor(Math.random() * 0xffffffff));

  const latestIdRef    = useRef(null);
  const scrollRef      = useRef(null);
  const apiObsRef      = useRef(null);
  const loadingRef     = useRef(false);
  const mockGenRef     = useRef(false);
  const touchStartY    = useRef(0);
  const isPullingRef   = useRef(false);
  const canPullRef     = useRef(true);
  const pullDistRef    = useRef(0);
  const lcpDone        = useRef(false);
  const rippleTimer    = useRef(null);
  const waveTimer      = useRef(null);
  const suggestFetched = useRef(false);

  const showMock = MOCK_CONFIG.enabled;
  const { articles: news = [] } = useNews({ maxArticles: 10, category: "all", autoFetch: !!user, enabled: !!user });
  const realPosts = useMemo(() => rawPosts.slice(0, MAX_POOL), [rawPosts]);

  useEffect(() => {
    if (suggestFetched.current || !user) return;
    suggestFetched.current = true;
    (async () => {
      try {
        const { data } = await axiosClient.get("/users/suggestions?limit=20");
        const list = Array.isArray(data) ? data : data?.users || data?.suggestions || [];
        setUserPool(list.filter((u) => u?._id && u._id !== user._id));
      } catch {
        try {
          const { data } = await axiosClient.get("/users?limit=20&sort=followers");
          setUserPool((Array.isArray(data) ? data : data?.users || []).filter((u) => u?._id && u._id !== user._id).slice(0, 15));
        } catch {}
      }
    })();
  }, [user]);

  // ✅ NIVEAU 1 — isValidPost : filtre les posts avec URLs Pexels SIGNÉES
  // Exception : les posts avec externalId pexels_XXXX → gardés car on peut
  // résoudre leur URL via le backend (NIVEAU 2 dans PostItem)
  const isValidPost = useCallback((p) => {
    if (!p?._id) return false;
    if (p._isMock || p.isMockPost || p._id?.startsWith("post_")) return true;
    const u = p.user || p.author || {};
    if (u.isBanned || u.isDeleted || ["deleted", "banned"].includes(u.status)) return false;

    // ✅ FIX PEXELS : si le post a un externalId pexels → on peut résoudre → garder
    const hasPexId = !!getPexIdFromPost(p);
    if (hasPexId) return !!(u._id || u.id || p.userId || p.author?._id);

    // Sans externalId, bloquer si URLs signées expirables
    if (hasStale(p)) return false;

    return !!(u._id || u.id || p.userId || p.author?._id);
  }, []);

  const combinedPosts = useMemo(() => {
    const dedup = (arr) => {
      const s = new Set();
      return arr.filter((p) => { if (s.has(p._id)) return false; s.add(p._id); return true; });
    };
    const vReal = dedup(realPosts.filter((p) => isValidPost(p) && !p.isBot && !p.user?.isBot));
    const vBots = dedup(realPosts.filter((p) => isValidPost(p) && (p.isBot || p.user?.isBot)));
    if (!showMock) {
      return mixPostsByBlocks(
        [...vReal.slice(0, RECENT_HEAD), ...seededShuffle(vReal.slice(RECENT_HEAD), seed)],
        seededShuffle(vBots, seed ^ 0xabcd)
      );
    }
    const mocks = dedup(MOCK_POSTS.slice(0, mockCount));
    if (MOCK_CONFIG.mixWithRealPosts && vReal.length > 0) {
      const head = vReal.slice(0, RECENT_HEAD).map(stablePost);
      const tail = seededShuffle(vReal.slice(RECENT_HEAD).map(stablePost), seed);
      return mixPostsByBlocks([...head, ...tail], seededShuffle([...vBots, ...mocks], seed ^ 0xdead));
    }
    return seededShuffle(mocks, seed);
  }, [realPosts, mockCount, showMock, isValidPost, seed]);

  const apiFullyLoaded = !hasMore && apiPages >= API_PREFETCH;

  useEffect(() => {
    if (combinedPosts.length > 0 && !latestIdRef.current)
      latestIdRef.current = combinedPosts[0]._id;
  }, [combinedPosts]);

  if (!lcpDone.current && combinedPosts.length > 0) {
    const r = getLCPUrl(combinedPosts);
    if (r?.url) { injectPreload(r.url, r.type); lcpDone.current = true; }
  }

  const deferredSearch = useDeferredValue(searchQuery);
  const filtered = useMemo(() => {
    if (!deferredSearch.trim()) return combinedPosts;
    const q = deferredSearch.toLowerCase();
    return combinedPosts.filter((p) =>
      (p.content || "").toLowerCase().includes(q) || (p.user?.fullName || "").toLowerCase().includes(q)
    );
  }, [combinedPosts, deferredSearch]);

  const isLoading = postsLoading && combinedPosts.length === 0;
  useEffect(() => { loadingRef.current = postsLoading; }, [postsLoading]);

  useEffect(() => {
    if (mockGenRef.current || isLoading || !MOCK_CONFIG.enabled) return;
    if (!(MOCK_CONFIG.totalPosts > 100 && MOCK_CONFIG.lazyGeneration?.enabled !== false)) return;
    const t = setTimeout(() => {
      if (mockGenRef.current) return;
      mockGenRef.current = true;
      const run = () => generateFullDataset(() => {}).catch(() => { mockGenRef.current = false; });
      typeof requestIdleCallback !== "undefined" ? requestIdleCallback(run, { timeout: 60000 }) : setTimeout(run, 1000);
    }, 30000);
    return () => clearTimeout(t);
  }, [isLoading]);

  useEffect(() => () => { clearTimeout(rippleTimer.current); clearTimeout(waveTimer.current); }, []);

  const showToast   = useCallback((msg, type = "info") => { startTransition(() => setToast({ message: msg, type })); }, []);
  const handleDeleted = useCallback((id) => { startTransition(() => removePost?.(id)); }, [removePost]);
  const handleOpenStory = useCallback((s, o) => {
    if (openStoryViewerProp) openStoryViewerProp(s, o);
    else { setViewerData({ stories: s, owner: o }); setShowViewer(true); }
  }, [openStoryViewerProp]);

  const triggerAnim = useCallback(() => {
    clearTimeout(rippleTimer.current);
    setShowRipple(true);
    rippleTimer.current = setTimeout(() => setShowRipple(false), RIPPLE_MS);
    clearTimeout(waveTimer.current);
    setIsWaving(true);
    startTransition(() => setResetSignal((k) => k + 1));
    waveTimer.current = setTimeout(() => setIsWaving(false), WAVE_MS);
  }, []);

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    triggerAnim();
    setIsRefreshing(true);
    setNewPostsCount(0);
    setPendingPosts([]);
    setApiPages(1);
    setSeed(Math.floor(Math.random() * 0xffffffff));
    try {
      const [, r] = await Promise.allSettled([fetchStories(true), refetch?.()]);
      const fp = r?.value?.posts || [];
      if (fp.length > 0) latestIdRef.current = fp[0]._id;
    } catch {
      showToast("Erreur lors de l'actualisation", "error");
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, refetch, fetchStories, showToast, triggerAnim]);

  useEffect(() => {
    window.addEventListener(HOME_REFRESH_EVENT, handleRefresh);
    return () => window.removeEventListener(HOME_REFRESH_EVENT, handleRefresh);
  }, [handleRefresh]);

  useEffect(() => {
    if (!user) return;
    const poll = async () => {
      if (document.hidden || isRefreshing || loadingRef.current) return;
      try {
        const r  = await refetch?.();
        const fp = r?.posts || [];
        if (fp.length > 0 && latestIdRef.current) {
          const idx   = fp.findIndex((p) => p._id === latestIdRef.current);
          const newer = idx > 0 ? fp.slice(0, idx) : [];
          if (newer.length > 0) { setPendingPosts(newer); setNewPostsCount(newer.length); }
        }
      } catch {}
    };
    const id = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [user, refetch, isRefreshing]);

  const handleShowNew = useCallback(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    if (pendingPosts.length > 0) latestIdRef.current = pendingPosts[0]._id;
    setNewPostsCount(0);
    setPendingPosts([]);
    setSeed(Math.floor(Math.random() * 0xffffffff));
    triggerAnim();
  }, [pendingPosts, triggerAnim]);

  useEffect(() => {
    let raf = null, lastUpdate = 0;
    const reset   = () => { pullDistRef.current = 0; canPullRef.current = true; setPullUI({ distance: 0, isPulling: false }); };
    const trigger = async () => {
      if (isPullingRef.current) return;
      isPullingRef.current = true;
      setPullUI({ distance: 0, isPulling: false });
      canPullRef.current = false;
      await handleRefresh();
      isPullingRef.current = false;
      setTimeout(reset, 300);
    };
    const onStart = (e) => {
      const st = scrollRef.current?.scrollTop ?? window.scrollY;
      if (st <= 5 && canPullRef.current) touchStartY.current = e.touches[0].clientY;
    };
    const onMove = (e) => {
      if (!canPullRef.current || !touchStartY.current) return;
      const pd = e.touches[0].clientY - touchStartY.current;
      if (pd > 20) {
        pullDistRef.current = Math.min(pd * 0.4, PTR_THRESHOLD * 1.5);
        const now = Date.now();
        if (now - lastUpdate >= 50) {
          lastUpdate = now;
          if (raf) cancelAnimationFrame(raf);
          raf = requestAnimationFrame(() => setPullUI({ distance: pullDistRef.current, isPulling: pullDistRef.current > PTR_THRESHOLD }));
        }
        if (pd > 60 && e.cancelable) try { e.preventDefault(); } catch {}
      }
    };
    const onEnd = () => {
      if (raf) cancelAnimationFrame(raf);
      pullDistRef.current > PTR_THRESHOLD && !isPullingRef.current ? trigger() : reset();
      touchStartY.current = 0;
    };
    const target = scrollRef.current || window;
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

  const apiObsFnRef = useRef(null);
  const apiObsFn = useCallback((entries) => {
    if (!entries[0].isIntersecting || loadingRef.current || isRefreshing) return;
    startPageTransition(() => {
      if (showMock && mockCount < MOCK_POSTS.length) setMockCount((p) => Math.min(p + MOCK_CONFIG.loadMoreCount, MOCK_POSTS.length));
      if (hasMore) { fetchNextPage(); setApiPages((p) => p + 1); }
    });
  }, [hasMore, fetchNextPage, isRefreshing, showMock, mockCount]);
  useEffect(() => { apiObsFnRef.current = apiObsFn; }, [apiObsFn]);
  useEffect(() => {
    const node = apiObsRef.current;
    if (!node) return;
    const obs = new IntersectionObserver((e) => apiObsFnRef.current?.(e), { rootMargin: "500px" });
    obs.observe(node);
    return () => obs.disconnect();
  }, []); // eslint-disable-line

  return (
    <div className="flex flex-col h-full scrollbar-hide" style={{ minHeight: "100vh" }}>
      <PullToRefreshIndicator isPulling={pullUI.isPulling} pullDistance={pullUI.distance} isRefreshing={isRefreshing} isDarkMode={isDarkMode} />
      <AnimatePresence>
        {showRipple && <RefreshRipple key="ripple" isDarkMode={isDarkMode} />}
      </AnimatePresence>

      <div
        className={`sticky top-0 z-30 ${isDarkMode ? "bg-black" : "bg-white"}`}
        style={{ height: STORY_BAR_H, minHeight: STORY_BAR_H, contain: "strict" }}
      >
        <StoryContainer
          onOpenStory={handleOpenStory}
          onOpenCreator={() => setShowCreator(true)}
          onOpenPyramid={() => setShowPyramid(true)}
          isDarkMode={isDarkMode}
        />
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto scrollbar-hide"
        style={{ willChange: "transform", WebkitOverflowScrolling: "touch", transform: "translateZ(0)" }}
      >
        <div className="w-full lg:max-w-[630px] lg:mx-auto">
          {searchQuery && (
            <div className={`p-4 text-center text-sm ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
              {`${filtered.length} résultat(s) pour "${deferredSearch}"`}
            </div>
          )}
          <ProgressiveFeed
            posts={filtered} onDeleted={handleDeleted} showToast={showToast}
            adConfig={AD_CONFIG} apiLoadMoreRef={apiObsRef}
            hasMoreFromAPI={hasMore || mockCount < MOCK_POSTS.length}
            searchQuery={deferredSearch} isDarkMode={isDarkMode}
            newsArticles={news} isLoading={isLoading}
            newPostsCount={newPostsCount} onShowNewPosts={handleShowNew}
            isWaving={isWaving} apiFullyLoaded={apiFullyLoaded}
            suggestedUserPool={userPool} scrollContainerRef={scrollRef}
            resetSignal={resetSignal}
          />
        </div>
      </div>

      <Suspense fallback={null}>
        <ImmersivePyramidUniverse
          isOpen={showPyramid} onClose={() => setShowPyramid(false)}
          stories={stories} user={user} onOpenStory={handleOpenStory}
          onOpenCreator={() => { setShowPyramid(false); setShowCreator(true); }}
          isDarkMode={isDarkMode}
        />
      </Suspense>

      <AnimatePresence>
        {showCreator && <Suspense fallback={null}><StoryCreator onClose={() => setShowCreator(false)} /></Suspense>}
        {showViewer && (
          <Suspense fallback={null}>
            <StoryViewer stories={viewerData.stories} currentUser={user} onClose={() => setShowViewer(false)} />
          </Suspense>
        )}
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </AnimatePresence>
    </div>
  );
};

export default memo(Home);