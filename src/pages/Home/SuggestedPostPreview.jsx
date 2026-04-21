// 📁 src/pages/Home/SuggestedPostPreview.jsx
// ✨ v6 — R2 MIGRATION
//
// MIGRATION v6 (R2) :
//   → Suppression de IMG_BASE / VID_BASE Cloudinary
//   → resolveMediaUrl() simplifié : URL directe R2
//   → getVideoPoster() : plus de manipulation d'URL Cloudinary
//     → utilise post.thumbnail si disponible, Pexels/Pixabay sinon, null pour R2
//   → Avatar : URL photo directe
//   → Toute la logique de scoring, LazyLoad, MediaBlock conservée
//
// v5 (conservé) :
//   🧠 Scoring composite récence + engagement + vélocité + contexte temporel
//   ⚡ IntersectionObserver, AbortController, anti-répétition sessionStorage
//   🎨 Badge "Pertinent pour vous", stat bar, barre de pertinence

import React, {
  useState, useEffect, useRef, useCallback, useMemo, memo,
} from "react";
import { useNavigate } from "react-router-dom";
import { CheckBadgeIcon } from "@heroicons/react/24/solid";
import {
  XMarkIcon, PlayIcon, PauseIcon,
  SpeakerWaveIcon, SpeakerXMarkIcon,
  HeartIcon, ChatBubbleOvalLeftIcon, EyeIcon,
} from "@heroicons/react/24/outline";
import { motion, AnimatePresence } from "framer-motion";
import axiosClient from "../../api/axiosClientGlobal";
import { useAuth } from "../../context/AuthContext";

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG & CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
// ✅ v6 : R2_PUBLIC_URL remplace IMG_BASE / VID_BASE Cloudinary
const R2_PUBLIC_URL = import.meta.env.VITE_R2_PUBLIC_URL || "";
const URL_CACHE_PFX = "murl_";
const URL_CACHE_TTL = 80 * 60 * 1000;
const SEEN_KEY      = "spp_seen_v5";
const HIGH_SCORE    = 72;

// ─────────────────────────────────────────────────────────────────────────────
// URL HELPERS — v6 R2
// ─────────────────────────────────────────────────────────────────────────────
const urlRead  = (k) => { try { const r = sessionStorage.getItem(URL_CACHE_PFX + k); if (!r) return null; const { url, exp } = JSON.parse(r); if (Date.now() > exp) { sessionStorage.removeItem(URL_CACHE_PFX + k); return null; } return url; } catch { return null; } };
const urlWrite = (k, u) => { try { sessionStorage.setItem(URL_CACHE_PFX + k, JSON.stringify({ url: u, exp: Date.now() + URL_CACHE_TTL })); } catch {} };

const isVideoUrl    = (u) => u && /\.(mp4|webm|mov|avi)$/i.test((u || "").split("?")[0]);
const isEmbedUrl    = (u) => u && (u.includes("youtube") || u.includes("youtu.be") || u.includes("vimeo"));
const EXPIRABLE     = [(u) => u.includes("videos.pexels.com/video-files/"), (u) => /cdn\.pixabay\.com\/video\/\d{4}\/\d{2}\/\d{2}\//.test(u)];
const DEAD          = ["youtube.com/watch", "youtu.be/", "dailymotion.com/video", "tiktok.com/@"];
const isExpirable   = (u) => typeof u === "string" && EXPIRABLE.some(fn => fn(u));
const isDead        = (u) => typeof u === "string" && DEAD.some(p => u.includes(p));
const isStructValid = (u) => { if (!u || typeof u !== "string" || u.length < 10) return false; if (u.startsWith("data:") || u.startsWith("blob:") || u.startsWith("/")) return true; try { const x = new URL(u); return !!(x.hostname && x.pathname !== "/"); } catch { return false; } };
const isUsable      = (u) => u && !isExpirable(u) && !isDead(u) && isStructValid(u);

/**
 * resolveMediaUrl — v6 R2
 * URL complète → retour direct.
 * Chemin relatif → préfixe R2_PUBLIC_URL.
 */
const resolveMediaUrl = (url) => {
  if (!url || typeof url !== "string") return null;
  if (url.startsWith("data:") || url.startsWith("blob:") || url.startsWith("http")) return url;
  if (R2_PUBLIC_URL) return `${R2_PUBLIC_URL}/${url.replace(/^\/+/, "")}`;
  return url;
};

/**
 * getVideoPoster — v6 R2
 * R2 ne génère pas de thumbnails auto.
 * → post.thumbnail en priorité (stocké explicitement par le backend)
 * → Pexels / Pixabay : logique URL conservée
 * → Cloudinary legacy : logique conservée pour les anciens posts
 * → R2 : null (le lecteur vidéo affiche la première frame)
 */
const getVideoPoster = (videoUrl, postThumbnail) => {
  if (postThumbnail && postThumbnail !== videoUrl) return postThumbnail;
  if (!videoUrl) return null;
  try {
    if (videoUrl.includes("videos.pexels.com")) {
      const m = videoUrl.match(/video-files\/(\d+)\//);
      if (m) return `https://images.pexels.com/videos/${m[1]}/pictures/preview-0.jpg`;
    }
    if (videoUrl.includes("cdn.pixabay.com")) {
      return videoUrl.replace(/_large\.mp4$/i, "_tiny.jpg").replace(/_medium\.mp4$/i, "_tiny.jpg");
    }
    // Anciens posts Cloudinary legacy
    if (videoUrl.includes("res.cloudinary.com")) {
      const CLOUD_NAME_LEGACY = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "";
      if (!CLOUD_NAME_LEGACY) return null;
      const IMG_BASE_LEGACY = `https://res.cloudinary.com/${CLOUD_NAME_LEGACY}/image/upload/`;
      const idx = videoUrl.indexOf("/upload/");
      if (idx === -1) return null;
      const after = videoUrl.substring(idx + 8);
      const segs  = after.split("/").filter(s => !s.includes(",") && !(/^[a-z]+_[a-z]/.test(s) && !s.includes(".")));
      const pub   = segs.join("/").replace(/\.(mp4|webm|mov|avi)$/i, "");
      return pub ? `${IMG_BASE_LEGACY}q_auto:good,f_jpg,w_800,c_limit,so_0/${pub}.jpg` : null;
    }
  } catch {}
  // R2 : pas de thumbnail auto
  return null;
};

const extractPexelsId = (u) => { const m = (u || "").match(/video-files\/(\d+)\//) || (u || "").match(/^pexels_(\d+)$/); return m?.[1] || null; };

const resolveExpired = async (url, externalId, signal) => {
  const pexId = extractPexelsId(url) || extractPexelsId(externalId || "") || (/^\d+$/.test(externalId) ? externalId : null);
  if (!pexId) return null;
  const cached = urlRead(`pexels_${pexId}`);
  if (cached) return cached;
  try {
    const res = await axiosClient.get(`/videos/refresh-url?id=${pexId}`, { signal });
    const fresh = res.data?.url || res.data?.videoUrl || null;
    if (fresh) urlWrite(`pexels_${pexId}`, fresh);
    return fresh;
  } catch { return null; }
};

// ─────────────────────────────────────────────────────────────────────────────
// SCORING POST (inchangé)
// ─────────────────────────────────────────────────────────────────────────────
const getTimeBucket = () => {
  const h = new Date().getHours();
  if (h < 6)  return 0;
  if (h < 10) return 1;
  if (h < 14) return 2;
  if (h < 18) return 3;
  if (h < 22) return 4;
  return 5;
};

const TIME_MATRIX = {
  0: { video: 0.8,  image: 0.9,  text: 0.7  },
  1: { video: 0.9,  image: 1.0,  text: 1.3  },
  2: { video: 1.0,  image: 1.1,  text: 1.0  },
  3: { video: 1.1,  image: 1.2,  text: 0.9  },
  4: { video: 1.4,  image: 1.2,  text: 0.8  },
  5: { video: 1.2,  image: 1.0,  text: 0.8  },
};

const getUserTypePref = () => {
  try {
    const raw = localStorage.getItem("feedLTM_fallback");
    if (!raw) return {};
    const data = JSON.parse(raw);
    return { video: data.video?.score || 0, image: data.image?.score || 0, text: data.text?.score || 0 };
  } catch { return {}; }
};

const getFirstUrl = (post) => {
  const imgs = post.images || post.media;
  const arr  = Array.isArray(imgs) ? imgs : (imgs ? [imgs] : []);
  const raw  = arr[0];
  return (typeof raw === "string" ? raw : raw?.url) || post.videoUrl || post.embedUrl || null;
};

const getPostType = (post) => {
  if (post.videoUrl || isVideoUrl(getFirstUrl(post))) return "video";
  if (getFirstUrl(post) && !isEmbedUrl(getFirstUrl(post))) return "image";
  return "text";
};

const scorePostForSuggestion = (post, seenIds) => {
  let score = 0;
  if (seenIds.has(post._id)) return -1;
  const ageH = (Date.now() - new Date(post.createdAt || 0).getTime()) / 3_600_000;
  if      (ageH < 1)  score += 30;
  else if (ageH < 6)  score += 22;
  else if (ageH < 24) score += 15;
  else if (ageH < 72) score += 8;
  else                score += 2;
  const likes    = post.likesCount    || post.likes?.length    || 0;
  const comments = post.commentsCount || post.comments?.length || 0;
  const shares   = post.sharesCount   || post.shares           || 0;
  const eng      = likes + comments * 3 + shares * 5;
  const fl       = post.user?.followersCount || 1;
  const engRate  = eng / Math.max(fl, 1);
  score += Math.min(30, engRate * 1000);
  const velocity = eng / Math.max(ageH, 0.1);
  score += Math.min(20, Math.log1p(velocity) * 8);
  const bucket  = getTimeBucket();
  const type    = getPostType(post);
  const timeMul = (TIME_MATRIX[bucket] || TIME_MATRIX[2])[type] || 1.0;
  score += (timeMul - 0.7) / 0.7 * 15;
  const prefs    = getUserTypePref();
  const typePref = prefs[type] || 0;
  score += typePref * 10;
  const text = post.content || post.contenu || "";
  if (text.length > 100 && text.length < 1000) score += 8;
  const hasClickbait = /\!\!\!|[A-Z]{5,}|😱{2,}/.test(text);
  if (hasClickbait) score -= 10;
  if (post._isMock || post.isMockPost) score -= 15;
  return Math.max(0, Math.min(100, score));
};

/** pickBestPost — v6 R2 : resolveMediaUrl retourne l'URL directe */
const pickBestPost = async (posts, signal) => {
  if (!posts?.length) return null;
  let seenIds = new Set();
  try { seenIds = new Set(JSON.parse(sessionStorage.getItem(SEEN_KEY) || "[]")); } catch {}
  const scored = posts
    .map(p => ({ post: p, score: scorePostForSuggestion(p, seenIds) }))
    .filter(s => s.score >= 0)
    .sort((a, b) => b.score - a.score);
  if (!scored.length) return null;
  const best = scored[0];
  try {
    const prev = JSON.parse(sessionStorage.getItem(SEEN_KEY) || "[]");
    const next = [...prev, best.post._id].slice(-100);
    sessionStorage.setItem(SEEN_KEY, JSON.stringify(next));
  } catch {}
  const post  = best.post;
  const score = best.score;
  const type  = getPostType(post);
  const imgs   = post.images || post.media;
  const arr    = Array.isArray(imgs) ? imgs : (imgs ? [imgs] : []);
  const rawUrl = arr[0] ? (typeof arr[0] === "string" ? arr[0] : arr[0]?.url) : null;
  let videoUrl = null;
  let mediaUrl = null;
  let poster   = null;
  let embedUrl = null;

  if (type === "video") {
    const raw = post.videoUrl || (isVideoUrl(rawUrl) ? rawUrl : null);
    if (raw) {
      if (isUsable(raw)) {
        videoUrl = resolveMediaUrl(raw);
        poster   = getVideoPoster(videoUrl, post.thumbnail);
      } else if (isExpirable(raw)) {
        const fresh = await resolveExpired(raw, post.externalId, signal);
        if (fresh) { videoUrl = resolveMediaUrl(fresh); poster = getVideoPoster(videoUrl, post.thumbnail); }
      }
    }
  } else if (type === "image") {
    const raw = rawUrl;
    if (raw) {
      if (isUsable(raw)) {
        mediaUrl = resolveMediaUrl(raw);
      } else if (isExpirable(raw)) {
        const fresh = await resolveExpired(raw, post.externalId, signal);
        if (fresh) mediaUrl = resolveMediaUrl(fresh);
      }
    }
  } else if (isEmbedUrl(post.embedUrl)) {
    embedUrl = post.embedUrl;
  }

  return {
    type,
    videoUrl,
    mediaUrl,
    poster,
    embedUrl,
    text:     post.content || post.contenu || "",
    likes:    (post.likesCount || post.likes?.length || 0),
    comments: (post.commentsCount || post.comments?.length || 0),
    views:    post.viewsCount || post.views || 0,
    postId:   post._id,
    score,
    isHighRelevance: score >= HIGH_SCORE,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// FORMAT HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const fmtNum = (n) => {
  if (!n) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
};

// ─────────────────────────────────────────────────────────────────────────────
// SILHOUETTE FALLBACK SVG
// ─────────────────────────────────────────────────────────────────────────────
const SilhouetteFallback = ({ height = 220 }) => (
  <div
    className="w-full flex items-center justify-center overflow-hidden"
    style={{ height, background: "#2a2a2a" }}
  >
    <svg
      viewBox="0 0 100 100"
      style={{ width: height * 0.55, height: height * 0.55, opacity: 0.45 }}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="50" cy="36" r="21" fill="#888" />
      <ellipse cx="50" cy="86" rx="33" ry="23" fill="#888" />
    </svg>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// AVATAR — v6 R2 : URL directe
// ─────────────────────────────────────────────────────────────────────────────
const Avatar = memo(({ username, photo, size = 44 }) => {
  const [err, setErr] = useState(false);
  const initials = useMemo(() => {
    if (!username) return "?";
    const p = username.trim().split(" ");
    return p.length > 1 ? (p[0][0] + p[1][0]).toUpperCase() : username.substring(0, 2).toUpperCase();
  }, [username]);
  const bg = useMemo(() => {
    const c = ["#f97316","#ef4444","#8b5cf6","#3b82f6","#10b981","#f59e0b","#ec4899","#6366f1"];
    let h = 0;
    for (let i = 0; i < (username || "").length; i++) h = username.charCodeAt(i) + ((h << 5) - h);
    return c[Math.abs(h) % c.length];
  }, [username]);
  // ✅ v6 : URL directe R2
  const resolvedPhoto = useMemo(() => resolveMediaUrl(photo), [photo]);
  if (err || !resolvedPhoto)
    return <div className="rounded-full flex items-center justify-center text-white font-bold select-none flex-shrink-0" style={{ width: size, height: size, backgroundColor: bg, fontSize: size * 0.38 }}>{initials}</div>;
  return <img src={resolvedPhoto} alt={username} className="rounded-full object-cover flex-shrink-0" style={{ width: size, height: size }} onError={() => setErr(true)} loading="lazy" />;
});
Avatar.displayName = "Avatar";

// ─────────────────────────────────────────────────────────────────────────────
// STAT BAR (inchangé)
// ─────────────────────────────────────────────────────────────────────────────
const StatBar = memo(({ likes, comments, views, isDarkMode }) => (
  <div className={`flex items-center gap-4 px-4 py-2.5 border-t text-[12px] ${isDarkMode ? "border-gray-800 text-gray-500" : "border-gray-100 text-gray-400"}`}>
    {likes > 0 && (
      <span className="flex items-center gap-1.5 font-semibold">
        <HeartIcon className="w-3.5 h-3.5 text-red-400" /> {fmtNum(likes)}
      </span>
    )}
    {comments > 0 && (
      <span className="flex items-center gap-1.5 font-semibold">
        <ChatBubbleOvalLeftIcon className="w-3.5 h-3.5 text-blue-400" /> {fmtNum(comments)}
      </span>
    )}
    {views > 0 && (
      <span className="flex items-center gap-1.5 font-semibold">
        <EyeIcon className="w-3.5 h-3.5 text-green-400" /> {fmtNum(views)}
      </span>
    )}
  </div>
));
StatBar.displayName = "StatBar";

// ─────────────────────────────────────────────────────────────────────────────
// MEDIA BLOCK — v6 R2 : poster via getVideoPoster()
// ─────────────────────────────────────────────────────────────────────────────
const MediaBlock = memo(({ post, isDarkMode, onNavigate }) => {
  const videoRef  = useRef(null);
  const [muted,   setMuted]   = useState(true);
  const [playing, setPlaying] = useState(false);
  const [imgErr,  setImgErr]  = useState(false);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (post?.type !== "video" || !videoRef.current) return;
    const vid = videoRef.current;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { vid.play().catch(() => {}); setPlaying(true); }
      else                  { vid.pause(); setPlaying(false); }
    }, { threshold: 0.4 });
    obs.observe(vid);
    return () => obs.disconnect();
  }, [post?.type]);

  const toggleMute = useCallback((e) => {
    e.stopPropagation();
    const vid = videoRef.current;
    if (!vid) return;
    const next = !vid.muted;
    vid.muted = next; vid.volume = next ? 0 : 1;
    if (!next && vid.paused) vid.play().catch(() => {});
    setMuted(next);
  }, []);

  const togglePlay = useCallback((e) => {
    e.stopPropagation();
    const vid = videoRef.current;
    if (!vid) return;
    if (vid.paused) { vid.play().catch(() => {}); setPlaying(true); }
    else            { vid.pause(); setPlaying(false); }
  }, []);

  if (!post) return <SilhouetteFallback height={220} />;

  if (post.type === "video" && post.videoUrl) return (
    <div
      className="relative w-full bg-black"
      style={{ aspectRatio: "16/9", cursor: "pointer" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={togglePlay}
    >
      <video
        ref={videoRef}
        src={post.videoUrl}
        poster={post.poster || undefined}
        className="w-full h-full object-contain"
        muted loop playsInline preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />

      <AnimatePresence>
        {(hovered || !playing) && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
          >
            <div className="w-14 h-14 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center border border-white/30 shadow-xl">
              {playing
                ? <PauseIcon className="w-6 h-6 text-white" />
                : <PlayIcon  className="w-7 h-7 text-white ml-1" />
              }
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={toggleMute}
        className="absolute bottom-3 right-3 z-10 w-8 h-8 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white border border-white/20 hover:bg-black/80 transition-colors"
        style={{ WebkitTapHighlightColor: "transparent" }}
      >
        {muted ? <SpeakerXMarkIcon className="w-4 h-4" /> : <SpeakerWaveIcon className="w-4 h-4" />}
      </button>

      {(post.likes > 0 || post.comments > 0) && (
        <div className="absolute bottom-3 left-3 flex items-center gap-3 pointer-events-none">
          {post.likes    > 0 && <span className="text-white text-xs font-bold drop-shadow">❤️ {fmtNum(post.likes)}</span>}
          {post.comments > 0 && <span className="text-white text-xs font-bold drop-shadow">💬 {fmtNum(post.comments)}</span>}
        </div>
      )}
    </div>
  );

  if (post.type === "image" && post.mediaUrl && !imgErr) return (
    <div className="relative w-full" style={{ aspectRatio: "4/3", cursor: "pointer" }} onClick={onNavigate}>
      <img src={post.mediaUrl} alt="" className="w-full h-full object-cover" loading="lazy" onError={() => setImgErr(true)} />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none" />
      {(post.likes > 0 || post.comments > 0) && (
        <div className="absolute bottom-3 left-3 flex items-center gap-3 pointer-events-none">
          {post.likes    > 0 && <span className="text-white text-xs font-bold drop-shadow">❤️ {fmtNum(post.likes)}</span>}
          {post.comments > 0 && <span className="text-white text-xs font-bold drop-shadow">💬 {fmtNum(post.comments)}</span>}
        </div>
      )}
    </div>
  );

  return (
    <div
      className="relative w-full flex items-center justify-center p-8 cursor-pointer"
      style={{
        minHeight: 180,
        background: isDarkMode
          ? "linear-gradient(135deg,#1a1a2e,#16213e)"
          : "linear-gradient(135deg,#fff7ed,#fce7f3)",
      }}
      onClick={onNavigate}
    >
      <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ background: "radial-gradient(circle at 30% 50%,#f97316 0%,transparent 60%), radial-gradient(circle at 70% 50%,#ec4899 0%,transparent 60%)" }} />
      <p className={`relative text-[15px] leading-relaxed text-center line-clamp-5 font-medium ${isDarkMode ? "text-gray-200" : "text-gray-700"}`}>
        {post.text || "Voir ce profil"}
      </p>
      {(post.likes > 0 || post.comments > 0) && (
        <div className="absolute bottom-3 right-3 flex items-center gap-2">
          {post.likes    > 0 && <span className={`text-[10px] font-bold ${isDarkMode ? "text-gray-500" : "text-gray-400"}`}>❤️ {fmtNum(post.likes)}</span>}
          {post.comments > 0 && <span className={`text-[10px] font-bold ${isDarkMode ? "text-gray-500" : "text-gray-400"}`}>💬 {fmtNum(post.comments)}</span>}
        </div>
      )}
    </div>
  );
});
MediaBlock.displayName = "MediaBlock";

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSANT PRINCIPAL (inchangé sauf pickBestPost)
// ─────────────────────────────────────────────────────────────────────────────
const SuggestedPostPreview = memo(({ isDarkMode, userPool = [], slotIndex = 0 }) => {
  const navigate = useNavigate();
  const { user: currentUser, updateUserProfile } = useAuth();

  const [post,       setPost]       = useState(null);
  const [user,       setUser]       = useState(null);
  const [ready,      setReady]      = useState(false);
  const [following,  setFollowing]  = useState(false);
  const [loadFollow, setLoadFollow] = useState(false);
  const [hidden,     setHidden]     = useState(false);

  const containerRef = useRef(null);
  const fetchedRef   = useRef(false);
  const abortRef     = useRef(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !userPool.length) return;

    const obs = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || fetchedRef.current) return;
      obs.disconnect();
      fetchedRef.current = true;

      const picked = userPool[slotIndex % userPool.length];
      if (!picked?._id) { setReady(true); return; }
      setUser(picked);

      abortRef.current = new AbortController();
      const { signal } = abortRef.current;

      (async () => {
        try {
          const { data } = await axiosClient.get(`/posts/user/${picked._id}?limit=15&page=1`, { signal });
          const posts = Array.isArray(data) ? data : (data?.posts || []);
          const best  = await pickBestPost(posts, signal);
          setPost(best);
        } catch { setPost(null); }
        finally { setReady(true); }
      })();
    }, { rootMargin: "150px", threshold: 0 });

    obs.observe(el);
    return () => { obs.disconnect(); abortRef.current?.abort(); };
  }, [userPool, slotIndex]);

  const handleFollow = useCallback(async (e) => {
    e.stopPropagation();
    if (loadFollow || following || !user?._id) return;
    setFollowing(true); setLoadFollow(true);
    try {
      await axiosClient.post(`/follow/follow/${user._id}`);
      updateUserProfile?.(currentUser._id, {
        following: [...(currentUser?.following || []), user._id],
      });
    } catch { setFollowing(false); }
    finally { setLoadFollow(false); }
  }, [loadFollow, following, user, currentUser, updateUserProfile]);

  const goProfile  = useCallback(() => { if (user?._id) navigate(`/profile/${user._id}`); }, [navigate, user]);
  const handleHide = useCallback((e) => { e.stopPropagation(); setHidden(true); }, []);

  if (!ready) return (
    <div ref={containerRef} className={`w-full ${isDarkMode ? "bg-black" : "bg-white"}`}>
      <div className="flex items-center gap-3 px-4 pt-5 pb-3">
        <div className={`flex-1 h-px ${isDarkMode ? "bg-gray-800" : "bg-gray-100"}`} />
        <span className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? "text-orange-500" : "text-orange-400"}`}>👤 Profil suggéré</span>
        <div className={`flex-1 h-px ${isDarkMode ? "bg-gray-800" : "bg-gray-100"}`} />
      </div>
      <div className="px-4 pb-5">
        <div className={`w-full rounded-2xl animate-pulse ${isDarkMode ? "bg-gray-900" : "bg-gray-100"}`} style={{ height: 360 }} />
      </div>
    </div>
  );

  if (hidden || !user) return <div ref={containerRef} />;

  const relevancePct = post ? Math.round(Math.min(100, post.score || 0)) : 0;

  return (
    <div ref={containerRef}>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ type: "spring", damping: 28, stiffness: 260 }}
          className={`w-full ${isDarkMode ? "bg-black" : "bg-white"}`}
        >
          <div className="flex items-center gap-3 px-4 pt-5 pb-3">
            <div className={`flex-1 h-px ${isDarkMode ? "bg-gray-800" : "bg-gray-100"}`} />
            <span className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? "text-orange-500" : "text-orange-400"}`}>
              👤 Profil suggéré
            </span>
            <div className={`flex-1 h-px ${isDarkMode ? "bg-gray-800" : "bg-gray-100"}`} />
          </div>

          <div className="px-4 pb-5">
            <div
              className={`relative w-full rounded-2xl overflow-hidden
                ${isDarkMode
                  ? "bg-gray-900 border border-gray-800"
                  : "bg-white border border-gray-100"
                }`}
              style={{ boxShadow: isDarkMode ? "0 4px 32px rgba(0,0,0,0.6)" : "0 4px 24px rgba(0,0,0,0.09)" }}
            >
              {post?.isHighRelevance && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute top-3 left-3 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold text-white shadow-lg"
                  style={{ background: "linear-gradient(135deg,#f97316,#ec4899)" }}
                >
                  ⭐ Pertinent pour vous
                </motion.div>
              )}

              <button
                onClick={handleHide}
                className="absolute top-3 right-3 z-20 w-7 h-7 rounded-full flex items-center justify-center bg-black/50 backdrop-blur-sm text-white hover:bg-black/70 transition-colors"
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                <XMarkIcon className="w-4 h-4" />
              </button>

              <div onClick={goProfile} style={{ cursor: "pointer" }}>
                <MediaBlock post={post} isDarkMode={isDarkMode} onNavigate={goProfile} />
              </div>

              {post && (post.likes > 0 || post.comments > 0 || post.views > 0) && (
                <StatBar likes={post.likes} comments={post.comments} views={post.views} isDarkMode={isDarkMode} />
              )}

              <div className="p-4 flex items-center gap-3" onClick={goProfile} style={{ cursor: "pointer" }}>
                <div className={`rounded-full flex-shrink-0 ${user.isPremium || user.isVerified ? "p-[2.5px] bg-gradient-to-tr from-orange-400 via-pink-500 to-purple-500" : ""}`}>
                  <div className={`rounded-full ${(user.isPremium || user.isVerified) ? `p-[2px] ${isDarkMode ? "bg-gray-900" : "bg-white"}` : ""}`}>
                    <Avatar username={user.fullName} photo={user.profilePhoto || user.avatar || user.profilePicture} size={46} />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`text-[15px] font-bold truncate ${isDarkMode ? "text-white" : "text-gray-900"}`}>{user.fullName}</span>
                    {user.isVerified && <CheckBadgeIcon className="w-4 h-4 text-orange-500 flex-shrink-0" />}
                  </div>
                  <p className={`text-[12px] mt-0.5 truncate ${isDarkMode ? "text-gray-500" : "text-gray-400"}`}>
                    {user.bio ? `${user.bio.substring(0, 55)}${user.bio.length > 55 ? "…" : ""}` : "Suggéré pour toi"}
                  </p>
                  {relevancePct > 0 && (
                    <div className={`mt-1.5 w-full h-0.5 rounded-full overflow-hidden ${isDarkMode ? "bg-gray-800" : "bg-gray-100"}`}>
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: "linear-gradient(90deg,#f97316,#ec4899)" }}
                        initial={{ width: 0 }}
                        animate={{ width: `${relevancePct}%` }}
                        transition={{ duration: 0.8, ease: "easeOut", delay: 0.3 }}
                      />
                    </div>
                  )}
                </div>

                <button
                  onClick={handleFollow}
                  disabled={loadFollow}
                  className={`flex-shrink-0 px-4 py-2 rounded-full text-[12px] font-bold transition-all active:scale-95 flex items-center justify-center gap-1.5
                    ${following
                      ? isDarkMode
                        ? "bg-gray-800 text-gray-400 border border-gray-700"
                        : "bg-gray-100 text-gray-500 border border-gray-200"
                      : "text-white shadow-md"
                    }`}
                  style={following ? {} : { background: "linear-gradient(135deg,#f97316,#ec4899)", WebkitTapHighlightColor: "transparent" }}
                >
                  {loadFollow
                    ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : following
                      ? "✓ Suivi(e)"
                      : "Suivre"
                  }
                </button>
              </div>

              <div className="px-4 pb-4">
                <button
                  onClick={goProfile}
                  className={`w-full py-2.5 rounded-xl text-[12px] font-semibold transition-colors flex items-center justify-center gap-2
                    ${isDarkMode
                      ? "bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700"
                      : "bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200"
                    }`}
                  style={{ WebkitTapHighlightColor: "transparent" }}
                >
                  Voir le profil complet →
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
});
SuggestedPostPreview.displayName = "SuggestedPostPreview";

export default SuggestedPostPreview;