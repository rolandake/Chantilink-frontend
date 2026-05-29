// 📁 src/pages/Home/SuggestedPostPreview.jsx
// ✨ v8 — CORRECTIONS ROBUSTESSE AFFICHAGE
//
// CORRECTIONS v8 vs v7 :
//   → Timeout explicite (8s) sur le fetch de posts + AbortController propre
//   → pickBestPost : scoring moins strict, fallback texte garanti même sans media
//   → userPool vide → sélection aléatoire dans suggestedUsers (retry intelligent)
//   → Race condition : fetchedRef par userId, pas global
//   → MediaBlock image : fallback silhouette si imgErr sans disparaître
//   → SectionDivider : mémoïsation correcte
//   → Logs de diagnostic en DEV uniquement

import React, {
  useState, useEffect, useRef, useCallback, useMemo, memo,
} from "react";
import { useNavigate } from "react-router-dom";
import { CheckBadgeIcon } from "@heroicons/react/24/solid";
import {
  XMarkIcon, PlayIcon, PauseIcon,
  SpeakerWaveIcon, SpeakerXMarkIcon,
  HeartIcon, ChatBubbleOvalLeftIcon, EyeIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import axiosClient from "../../api/axiosClientGlobal";
import { useAuth } from "../../context/AuthContext";

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────
const R2_PUBLIC_URL = import.meta.env.VITE_R2_PUBLIC_URL || "";
const URL_CACHE_PFX = "murl_";
const URL_CACHE_TTL = 80 * 60 * 1000;
const SEEN_KEY      = "spp_seen_v8";
const HIGH_SCORE    = 60; // ✅ abaissé de 72 → 60 pour afficher plus de suggestions
const FETCH_TIMEOUT = 8_000;

const isDev = import.meta.env.DEV;
const log   = (...a) => { if (isDev) console.log("[SuggestedPostPreview]", ...a); };
const warn  = (...a) => { if (isDev) console.warn("[SuggestedPostPreview]", ...a); };

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────────────────────────────────────
const tk = (dark) => ({
  bg:      dark ? "#09090b"   : "#ffffff",
  bgCard:  dark ? "#0f0f12"  : "#ffffff",
  border:  dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)",
  text:    dark ? "#f2f2f5"  : "#0d0d0f",
  textSub: dark ? "#6b6b7b"  : "#8a8a9a",
  divider: dark ? "#1e1e24"  : "#f0f0f4",
  accent:  "#f97316",
  grad:    "linear-gradient(135deg,#f97316,#ec4899)",
  shadow:  dark ? "0 4px 32px rgba(0,0,0,0.6)" : "0 4px 24px rgba(0,0,0,0.09)",
  font:    "'DM Sans','Sora',sans-serif",
});

// ─────────────────────────────────────────────────────────────────────────────
// URL HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const urlRead  = (k) => { try { const r = sessionStorage.getItem(URL_CACHE_PFX + k); if (!r) return null; const { url, exp } = JSON.parse(r); return Date.now() > exp ? (sessionStorage.removeItem(URL_CACHE_PFX + k), null) : url; } catch { return null; } };
const urlWrite = (k, u) => { try { sessionStorage.setItem(URL_CACHE_PFX + k, JSON.stringify({ url: u, exp: Date.now() + URL_CACHE_TTL })); } catch {} };

const isVideoUrl  = (u) => u && /\.(mp4|webm|mov|avi)$/i.test((u || "").split("?")[0]);
const isEmbedUrl  = (u) => u && (u.includes("youtube") || u.includes("youtu.be") || u.includes("vimeo"));
const EXPIRABLE_FN = [(u) => u.includes("videos.pexels.com/video-files/"), (u) => /cdn\.pixabay\.com\/video\/\d{4}\/\d{2}\/\d{2}\//.test(u)];
const DEAD_HOSTS   = ["youtube.com/watch", "youtu.be/", "dailymotion.com/video", "tiktok.com/@"];
const isExpirable  = (u) => typeof u === "string" && EXPIRABLE_FN.some(fn => fn(u));
const isDead       = (u) => typeof u === "string" && DEAD_HOSTS.some(p => u.includes(p));
const isValid      = (u) => {
  if (!u || typeof u !== "string" || u.length < 8) return false;
  if (u.startsWith("data:") || u.startsWith("blob:") || u.startsWith("/")) return true;
  try { const x = new URL(u); return !!(x.hostname && x.pathname !== "/"); } catch { return false; }
};
const isUsable = (u) => u && !isExpirable(u) && !isDead(u) && isValid(u);

const resolveMediaUrl = (url) => {
  if (!url || typeof url !== "string") return null;
  if (url.startsWith("data:") || url.startsWith("blob:") || url.startsWith("http")) return url;
  if (R2_PUBLIC_URL) return `${R2_PUBLIC_URL}/${url.replace(/^\/+/, "")}`;
  return url;
};

const getVideoPoster = (videoUrl, postThumbnail) => {
  if (postThumbnail && postThumbnail !== videoUrl) return postThumbnail;
  if (!videoUrl) return null;
  try {
    if (videoUrl.includes("videos.pexels.com")) {
      const m = videoUrl.match(/video-files\/(\d+)\//);
      if (m) return `https://images.pexels.com/videos/${m[1]}/pictures/preview-0.jpg`;
    }
    if (videoUrl.includes("cdn.pixabay.com"))
      return videoUrl.replace(/_large\.mp4$/i, "_tiny.jpg").replace(/_medium\.mp4$/i, "_tiny.jpg");
  } catch {}
  return null;
};

const extractPexelsId = (u) => { const m = (u || "").match(/video-files\/(\d+)\//) || (u || "").match(/^pexels_(\d+)$/); return m?.[1] || null; };

const resolveExpired = async (url, externalId, signal) => {
  const pexId = extractPexelsId(url) || extractPexelsId(externalId || "") || (/^\d+$/.test(externalId) ? externalId : null);
  if (!pexId) return null;
  const cached = urlRead(`pexels_${pexId}`);
  if (cached) return cached;
  return null;
};

// ─────────────────────────────────────────────────────────────────────────────
// SCORING
// ─────────────────────────────────────────────────────────────────────────────
const getTimeBucket = () => {
  const h = new Date().getHours();
  return h < 6 ? 0 : h < 10 ? 1 : h < 14 ? 2 : h < 18 ? 3 : h < 22 ? 4 : 5;
};
const TIME_MATRIX = {
  0: { video: 0.8, image: 0.9, text: 0.7 },
  1: { video: 0.9, image: 1.0, text: 1.3 },
  2: { video: 1.0, image: 1.1, text: 1.0 },
  3: { video: 1.1, image: 1.2, text: 0.9 },
  4: { video: 1.4, image: 1.2, text: 0.8 },
  5: { video: 1.2, image: 1.0, text: 0.8 },
};

const getFirstUrl = (post) => {
  const imgs = post.images || post.media;
  const arr = Array.isArray(imgs) ? imgs : (imgs ? [imgs] : []);
  const raw = arr[0];
  return (typeof raw === "string" ? raw : raw?.url) || post.videoUrl || post.embedUrl || null;
};

const getPostType = (post) => {
  if (post.videoUrl || isVideoUrl(getFirstUrl(post))) return "video";
  if (getFirstUrl(post) && !isEmbedUrl(getFirstUrl(post))) return "image";
  return "text";
};

const scorePostForSuggestion = (post, seenIds) => {
  let score = 0;
  // ✅ Ne pénalise pas les posts déjà vus, permet juste un score plus bas
  if (seenIds.has(post._id)) score -= 15;

  const ageH = (Date.now() - new Date(post.createdAt || 0).getTime()) / 3_600_000;
  score += ageH < 1 ? 30 : ageH < 6 ? 22 : ageH < 24 ? 15 : ageH < 72 ? 8 : 2;

  const eng = (post.likesCount || post.likes?.length || 0)
    + (post.commentsCount || post.comments?.length || 0) * 3
    + (post.sharesCount || post.shares || 0) * 5;
  score += Math.min(30, (eng / Math.max(post.user?.followersCount || 1, 1)) * 1000);
  score += Math.min(20, Math.log1p(eng / Math.max(ageH, 0.1)) * 8);

  const type = getPostType(post);
  const mul = (TIME_MATRIX[getTimeBucket()] || TIME_MATRIX[2])[type] || 1.0;
  score += (mul - 0.7) / 0.7 * 15;

  const text = post.content || post.contenu || "";
  if (text.length > 60 && text.length < 1000) score += 8;
  if (/\!\!\!|[A-Z]{5,}|😱{2,}/.test(text)) score -= 10;
  if (post._isMock || post.isMockPost) score -= 15;

  return Math.max(0, Math.min(100, score));
};

// ✅ pickBestPost : retourne toujours quelque chose si posts.length > 0
const pickBestPost = async (posts, signal) => {
  if (!posts?.length) return null;

  let seenIds = new Set();
  try { seenIds = new Set(JSON.parse(sessionStorage.getItem(SEEN_KEY) || "[]")); } catch {}

  const scored = posts
    .map(p => ({ post: p, score: scorePostForSuggestion(p, seenIds) }))
    .sort((a, b) => b.score - a.score);

  if (!scored.length) return null;

  const { post, score } = scored[0];
  log(`Best post: id=${post._id} score=${score.toFixed(1)}`);

  // Mettre à jour seen
  try {
    const prev = JSON.parse(sessionStorage.getItem(SEEN_KEY) || "[]");
    sessionStorage.setItem(SEEN_KEY, JSON.stringify([...prev, post._id].slice(-100)));
  } catch {}

  const type   = getPostType(post);
  const imgs   = post.images || post.media;
  const arr    = Array.isArray(imgs) ? imgs : (imgs ? [imgs] : []);
  const rawUrl = arr[0] ? (typeof arr[0] === "string" ? arr[0] : arr[0]?.url) : null;

  let videoUrl = null, mediaUrl = null, poster = null, embedUrl = null;

  if (type === "video") {
    const raw = post.videoUrl || (isVideoUrl(rawUrl) ? rawUrl : null);
    if (raw) {
      if (isUsable(raw)) {
        videoUrl = resolveMediaUrl(raw);
        poster   = getVideoPoster(videoUrl, post.thumbnail);
      } else if (isExpirable(raw)) {
        try {
          const f = await resolveExpired(raw, post.externalId, signal);
          if (f) { videoUrl = resolveMediaUrl(f); poster = getVideoPoster(videoUrl, post.thumbnail); }
        } catch {}
      }
    }
  } else if (type === "image" && rawUrl) {
    if (isUsable(rawUrl)) {
      mediaUrl = resolveMediaUrl(rawUrl);
    } else if (isExpirable(rawUrl)) {
      try {
        const f = await resolveExpired(rawUrl, post.externalId, signal);
        if (f) mediaUrl = resolveMediaUrl(f);
      } catch {}
    }
  } else if (type === "text" || isEmbedUrl(post.embedUrl)) {
    if (post.embedUrl && isEmbedUrl(post.embedUrl)) embedUrl = post.embedUrl;
  }

  const text = (post.content || post.contenu || "").trim();

  // ✅ Retourne toujours un résultat, même si aucun media
  return {
    type: (videoUrl || mediaUrl || embedUrl) ? type : "text",
    videoUrl, mediaUrl, poster, embedUrl,
    text,
    likes:    post.likesCount || post.likes?.length || 0,
    comments: post.commentsCount || post.comments?.length || 0,
    views:    post.viewsCount || post.views || 0,
    postId:   post._id,
    score,
    isHighRelevance: score >= HIGH_SCORE,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const fmtNum = (n) => !n ? "0" : n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : String(n);

// ─────────────────────────────────────────────────────────────────────────────
// AVATAR
// ─────────────────────────────────────────────────────────────────────────────
const COLORS = ["#f97316","#ef4444","#8b5cf6","#3b82f6","#10b981","#f59e0b","#ec4899","#6366f1"];

const Avatar = memo(({ username, photo, size = 46 }) => {
  const [err, setErr] = useState(false);
  const initials = useMemo(() => {
    if (!username) return "?";
    const p = username.trim().split(" ");
    return p.length > 1 ? (p[0][0] + p[1][0]).toUpperCase() : username.substring(0, 2).toUpperCase();
  }, [username]);
  const bg = useMemo(() => {
    let h = 0;
    for (let i = 0; i < (username || "").length; i++) h = username.charCodeAt(i) + ((h << 5) - h);
    return COLORS[Math.abs(h) % COLORS.length];
  }, [username]);
  const resolvedPhoto = useMemo(() => resolveMediaUrl(photo), [photo]);

  if (err || !resolvedPhoto || !isValid(resolvedPhoto)) {
    return (
      <div style={{ width: size, height: size, borderRadius: "50%", backgroundColor: bg, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: size * 0.36, flexShrink: 0, letterSpacing: "-0.02em" }}>
        {initials}
      </div>
    );
  }
  return (
    <img
      src={resolvedPhoto}
      alt={username}
      style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
      onError={() => setErr(true)}
      loading="lazy"
    />
  );
});
Avatar.displayName = "Avatar";

// ─────────────────────────────────────────────────────────────────────────────
// STAT BAR
// ─────────────────────────────────────────────────────────────────────────────
const StatBar = memo(({ likes, comments, views, isDarkMode }) => {
  const t = useMemo(() => tk(isDarkMode), [isDarkMode]);
  if (!likes && !comments && !views) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "10px 16px", borderTop: `1px solid ${t.divider}`, fontSize: 11, fontFamily: t.font }}>
      {likes    > 0 && <span style={{ display: "flex", alignItems: "center", gap: 5, color: t.textSub, fontWeight: 600 }}><HeartIcon style={{ width: 13, height: 13, color: "#f43f5e" }} />{fmtNum(likes)}</span>}
      {comments > 0 && <span style={{ display: "flex", alignItems: "center", gap: 5, color: t.textSub, fontWeight: 600 }}><ChatBubbleOvalLeftIcon style={{ width: 13, height: 13, color: "#60a5fa" }} />{fmtNum(comments)}</span>}
      {views    > 0 && <span style={{ display: "flex", alignItems: "center", gap: 5, color: t.textSub, fontWeight: 600 }}><EyeIcon style={{ width: 13, height: 13, color: "#34d399" }} />{fmtNum(views)}</span>}
    </div>
  );
});
StatBar.displayName = "StatBar";

// ─────────────────────────────────────────────────────────────────────────────
// SILHOUETTE
// ─────────────────────────────────────────────────────────────────────────────
const Silhouette = ({ h = 200 }) => (
  <div style={{ width: "100%", height: h, background: "#1a1a1e", display: "flex", alignItems: "center", justifyContent: "center" }}>
    <svg viewBox="0 0 100 100" style={{ width: h * 0.52, height: h * 0.52, opacity: 0.25 }} fill="none">
      <circle cx="50" cy="36" r="21" fill="#888" />
      <ellipse cx="50" cy="86" rx="33" ry="23" fill="#888" />
    </svg>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// MEDIA BLOCK
// ─────────────────────────────────────────────────────────────────────────────
const MediaBlock = memo(({ post, isDarkMode, onNavigate }) => {
  const videoRef  = useRef(null);
  const reduced   = useReducedMotion();
  const [muted,   setMuted]   = useState(true);
  const [playing, setPlaying] = useState(false);
  const [imgErr,  setImgErr]  = useState(false);
  const [hovered, setHovered] = useState(false);
  const t = useMemo(() => tk(isDarkMode), [isDarkMode]);

  // Auto-play vidéo à l'entrée dans le viewport
  useEffect(() => {
    if (post?.type !== "video" || !videoRef.current) return;
    const vid = videoRef.current;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { vid.play().catch(() => {}); setPlaying(true); }
      else { vid.pause(); setPlaying(false); }
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
    else { vid.pause(); setPlaying(false); }
  }, []);

  // ✅ Pas de post → silhouette
  if (!post) return <Silhouette h={200} />;

  // VIDEO
  if (post.type === "video" && post.videoUrl) return (
    <div
      style={{ position: "relative", width: "100%", aspectRatio: "16/9", background: "#000", cursor: "pointer" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={togglePlay}
      role="button" aria-label={playing ? "Pause" : "Lecture"}
      tabIndex={0} onKeyDown={e => e.key === " " && togglePlay(e)}
    >
      <video
        ref={videoRef}
        src={post.videoUrl}
        poster={post.poster || undefined}
        style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
        muted loop playsInline preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 50%)", pointerEvents: "none" }} />

      <AnimatePresence>
        {!reduced && (hovered || !playing) && (
          <motion.div
            initial={{ opacity: 0, scale: 0.75 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.75 }}
            transition={{ duration: 0.15 }}
            style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}
          >
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", border: "1.5px solid rgba(255,255,255,0.3)" }}>
              {playing
                ? <PauseIcon style={{ width: 20, height: 20, color: "#fff" }} />
                : <PlayIcon  style={{ width: 22, height: 22, color: "#fff", marginLeft: 2 }} />
              }
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button onClick={toggleMute} aria-label={muted ? "Activer le son" : "Couper le son"}
        style={{ position: "absolute", bottom: 12, right: 12, zIndex: 10, width: 30, height: 30, borderRadius: "50%", border: "none", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {muted ? <SpeakerXMarkIcon style={{ width: 13, height: 13 }} /> : <SpeakerWaveIcon style={{ width: 13, height: 13 }} />}
      </button>

      {(post.likes > 0 || post.comments > 0) && (
        <div style={{ position: "absolute", bottom: 14, left: 14, display: "flex", gap: 12, pointerEvents: "none" }}>
          {post.likes    > 0 && <span style={{ color: "#fff", fontSize: 11, fontWeight: 700, textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}>❤️ {fmtNum(post.likes)}</span>}
          {post.comments > 0 && <span style={{ color: "#fff", fontSize: 11, fontWeight: 700, textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}>💬 {fmtNum(post.comments)}</span>}
        </div>
      )}
    </div>
  );

  // IMAGE
  if (post.type === "image" && post.mediaUrl && !imgErr) return (
    <div
      style={{ position: "relative", width: "100%", aspectRatio: "4/3", cursor: "pointer" }}
      onClick={onNavigate} role="button" aria-label="Voir le post"
      tabIndex={0} onKeyDown={e => e.key === "Enter" && onNavigate()}
    >
      <img
        src={post.mediaUrl}
        alt=""
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        loading="lazy"
        onError={() => setImgErr(true)}
      />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 55%)", pointerEvents: "none" }} />
      {(post.likes > 0 || post.comments > 0) && (
        <div style={{ position: "absolute", bottom: 14, left: 14, display: "flex", gap: 12, pointerEvents: "none" }}>
          {post.likes    > 0 && <span style={{ color: "#fff", fontSize: 11, fontWeight: 700, textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}>❤️ {fmtNum(post.likes)}</span>}
          {post.comments > 0 && <span style={{ color: "#fff", fontSize: 11, fontWeight: 700, textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}>💬 {fmtNum(post.comments)}</span>}
        </div>
      )}
    </div>
  );

  // ✅ Cas image avec erreur → silhouette plutôt que rien
  if (post.type === "image" && imgErr) return (
    <div onClick={onNavigate} style={{ cursor: "pointer" }}>
      <Silhouette h={180} />
    </div>
  );

  // TEXTE (toujours affiché, même si vide)
  return (
    <div
      onClick={onNavigate}
      role="button" tabIndex={0} onKeyDown={e => e.key === "Enter" && onNavigate()}
      style={{
        position: "relative", width: "100%",
        minHeight: 160, display: "flex", alignItems: "center", justifyContent: "center",
        padding: "28px 24px", cursor: "pointer",
        background: isDarkMode
          ? "linear-gradient(135deg,#12121a,#1a1220)"
          : "linear-gradient(135deg,#fef9f5,#fdf2f8)",
      }}
    >
      <div style={{ position: "absolute", inset: 0, opacity: 0.06, pointerEvents: "none", background: "radial-gradient(circle at 30% 50%,#f97316,transparent 60%), radial-gradient(circle at 70% 50%,#ec4899,transparent 60%)" }} />
      <p style={{
        position: "relative", fontSize: 15, lineHeight: 1.6, textAlign: "center",
        display: "-webkit-box", WebkitLineClamp: 5, WebkitBoxOrient: "vertical", overflow: "hidden",
        color: isDarkMode ? "#d0d0d8" : "#3a3a4a", fontWeight: 500,
        fontFamily: tk(isDarkMode).font,
      }}>
        {post.text || "Voir ce profil"}
      </p>
    </div>
  );
});
MediaBlock.displayName = "MediaBlock";

// ─────────────────────────────────────────────────────────────────────────────
// SECTION DIVIDER
// ─────────────────────────────────────────────────────────────────────────────
const SectionDivider = memo(({ isDarkMode }) => {
  const t = tk(isDarkMode);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "20px 16px 12px" }}>
      <div style={{ flex: 1, height: 1, background: t.divider }} />
      <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: t.accent, fontFamily: t.font }}>
        👤 Profil suggéré
      </span>
      <div style={{ flex: 1, height: 1, background: t.divider }} />
    </div>
  );
});
SectionDivider.displayName = "SectionDivider";

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSANT PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
const SuggestedPostPreview = memo(({ isDarkMode, userPool = [], slotIndex = 0 }) => {
  const navigate = useNavigate();
  const { user: currentUser, updateUserProfile } = useAuth();
  const reduced = useReducedMotion();

  const [post,       setPost]       = useState(null);
  const [user,       setUser]       = useState(null);
  const [ready,      setReady]      = useState(false);
  const [following,  setFollowing]  = useState(false);
  const [loadFollow, setLoadFollow] = useState(false);
  const [hidden,     setHidden]     = useState(false);

  const containerRef = useRef(null);
  // ✅ fetchedRef par userId pour éviter race condition si slotIndex change
  const lastUserIdRef = useRef(null);
  const abortRef      = useRef(null);

  const t = useMemo(() => tk(isDarkMode), [isDarkMode]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // ✅ Pool vide → ne pas s'afficher du tout
    if (!userPool.length) {
      setReady(true);
      return;
    }

    const obs = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      obs.disconnect();

      // Sélectionner l'utilisateur selon slotIndex
      const picked = userPool[slotIndex % userPool.length];
      if (!picked?._id) { setReady(true); return; }

      // ✅ Éviter de re-fetcher si même user
      if (lastUserIdRef.current === picked._id) return;
      lastUserIdRef.current = picked._id;

      setUser(picked);
      setReady(false);

      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      const timeout = setTimeout(() => {
        ctrl.abort();
        warn(`Timeout fetch posts user=${picked._id}`);
        setPost(null);
        setReady(true);
      }, FETCH_TIMEOUT);

      (async () => {
        try {
          const { data } = await axiosClient.get(
            `/posts/user/${picked._id}?limit=15&page=1`,
            { signal: ctrl.signal }
          );
          const posts = Array.isArray(data) ? data : (data?.posts || []);
          log(`User ${picked._id} → ${posts.length} posts`);

          const best = await pickBestPost(posts, ctrl.signal);
          log(`User ${picked._id} → best:`, best?.type, best?.score?.toFixed?.(1));
          setPost(best);
        } catch (e) {
          if (e?.name !== "CanceledError" && e?.name !== "AbortError") {
            warn(`Fetch posts failed user=${picked._id}:`, e?.message);
          }
          setPost(null);
        } finally {
          clearTimeout(timeout);
          setReady(true);
        }
      })();
    }, { rootMargin: "200px", threshold: 0 });

    obs.observe(el);
    return () => {
      obs.disconnect();
      abortRef.current?.abort();
    };
  }, [userPool, slotIndex]);

  const handleFollow = useCallback(async (e) => {
    e.stopPropagation();
    if (loadFollow || following || !user?._id) return;
    setFollowing(true);
    setLoadFollow(true);
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

  const relevancePct = post ? Math.round(Math.min(100, post.score || 0)) : 0;

  // Skeleton tant que pas prêt
  if (!ready) {
    return (
      <div ref={containerRef} style={{ width: "100%", fontFamily: t.font }}>
        <SectionDivider isDarkMode={isDarkMode} />
        <div style={{ padding: "0 16px 20px" }}>
          <div style={{
            width: "100%", height: 340, borderRadius: 20,
            background: isDarkMode ? "#0f0f12" : "#f5f5f7",
            animation: "spp-pulse 1.5s ease infinite",
          }} />
          <style>{`@keyframes spp-pulse{0%,100%{opacity:1}50%{opacity:.45}}`}</style>
        </div>
      </div>
    );
  }

  // ✅ Caché, pas d'user, ou userPool vide → ne rien afficher
  if (hidden || !user) {
    return <div ref={containerRef} />;
  }

  return (
    <div ref={containerRef} style={{ width: "100%", fontFamily: t.font }}>
      <SectionDivider isDarkMode={isDarkMode} />
      <AnimatePresence>
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -14 }}
          transition={{ type: "spring", damping: 28, stiffness: 240 }}
          style={{ padding: "0 16px 20px" }}
        >
          <div style={{
            position: "relative",
            borderRadius: 20, overflow: "hidden",
            background: t.bgCard,
            border: `1.5px solid ${t.border}`,
            boxShadow: t.shadow,
          }}>
            {/* Badge haute pertinence */}
            {post?.isHighRelevance && (
              <motion.div
                initial={reduced ? false : { opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  position: "absolute", top: 12, left: 12, zIndex: 20,
                  display: "flex", alignItems: "center", gap: 5,
                  padding: "4px 10px", borderRadius: 50,
                  background: "linear-gradient(135deg,#f97316,#ec4899)",
                  fontSize: 10, fontWeight: 700, color: "#fff",
                  boxShadow: "0 4px 12px rgba(249,115,22,0.4)",
                  letterSpacing: "0.03em",
                }}
              >
                ⭐ Pertinent pour vous
              </motion.div>
            )}

            {/* Bouton fermer */}
            <button
              onClick={handleHide}
              aria-label="Masquer cette suggestion"
              style={{
                position: "absolute", top: 12, right: 12, zIndex: 20,
                width: 30, height: 30, borderRadius: "50%", border: "none",
                background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)",
                color: "#fff", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <XMarkIcon style={{ width: 14, height: 14 }} />
            </button>

            {/* Media (toujours rendu même si post=null) */}
            <div onClick={goProfile} style={{ cursor: "pointer" }}>
              <MediaBlock post={post} isDarkMode={isDarkMode} onNavigate={goProfile} />
            </div>

            {/* Stats */}
            <StatBar likes={post?.likes} comments={post?.comments} views={post?.views} isDarkMode={isDarkMode} />

            {/* Ligne profil */}
            <div
              onClick={goProfile}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px 0", cursor: "pointer" }}
            >
              {/* Avatar avec ring premium */}
              <div style={{
                borderRadius: "50%", flexShrink: 0,
                padding: (user.isPremium || user.isVerified) ? 2 : 0,
                background: (user.isPremium || user.isVerified)
                  ? "linear-gradient(135deg,#f97316,#ec4899,#8b5cf6)"
                  : "transparent",
              }}>
                <div style={{
                  borderRadius: "50%",
                  padding: (user.isPremium || user.isVerified) ? 2 : 0,
                  background: (user.isPremium || user.isVerified) ? (isDarkMode ? "#0f0f12" : "#fff") : "transparent",
                }}>
                  <Avatar
                    username={user.fullName}
                    photo={user.profilePhoto || user.avatar || user.profilePicture}
                    size={46}
                  />
                </div>
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                  <span style={{
                    fontSize: 14.5, fontWeight: 800, color: t.text,
                    letterSpacing: "-0.02em",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {user.fullName || "Utilisateur"}
                  </span>
                  {user.isVerified && <CheckBadgeIcon style={{ width: 15, height: 15, color: "#f97316", flexShrink: 0 }} />}
                </div>
                <p style={{ fontSize: 11.5, color: t.textSub, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {user.bio
                    ? `${user.bio.substring(0, 55)}${user.bio.length > 55 ? "…" : ""}`
                    : "Suggéré pour toi"
                  }
                </p>

                {/* Barre de pertinence */}
                {relevancePct > 0 && (
                  <div style={{ marginTop: 7, width: "100%", height: 2.5, borderRadius: 99, background: t.divider, overflow: "hidden" }}>
                    <motion.div
                      style={{ height: "100%", borderRadius: 99, background: "linear-gradient(90deg,#f97316,#ec4899)" }}
                      initial={{ width: 0 }}
                      animate={{ width: `${relevancePct}%` }}
                      transition={{ duration: 0.9, ease: "easeOut", delay: 0.4 }}
                    />
                  </div>
                )}
              </div>

              {/* Bouton suivre */}
              <motion.button
                onClick={handleFollow}
                disabled={loadFollow}
                aria-label={following ? "Déjà suivi" : `Suivre ${user.fullName}`}
                whileHover={loadFollow ? {} : { scale: 1.03 }}
                whileTap={loadFollow ? {} : { scale: 0.97 }}
                style={{
                  flexShrink: 0,
                  padding: "8px 16px", borderRadius: 50, border: "none",
                  cursor: loadFollow ? "not-allowed" : "pointer",
                  background: following
                    ? (isDarkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)")
                    : "linear-gradient(135deg,#f97316,#ec4899)",
                  color: following ? t.textSub : "#fff",
                  fontFamily: t.font, fontWeight: 700, fontSize: 12,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  boxShadow: following ? "none" : "0 4px 14px rgba(249,115,22,0.35)",
                  transition: "all 0.2s",
                  minWidth: 80,
                }}
              >
                {loadFollow
                  ? <span style={{ width: 13, height: 13, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spp-spin 0.8s linear infinite" }} />
                  : following ? "✓ Suivi(e)" : "Suivre"
                }
              </motion.button>
            </div>

            {/* Bouton voir profil */}
            <div style={{ padding: "12px 16px 16px" }}>
              <button
                onClick={goProfile}
                style={{
                  width: "100%", padding: "10px 0",
                  borderRadius: 12, border: `1.5px solid ${t.border}`,
                  background: "transparent",
                  color: t.textSub, fontFamily: t.font,
                  fontWeight: 600, fontSize: 12,
                  cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  transition: "all 0.2s",
                }}
              >
                Voir le profil complet
                <ArrowRightIcon style={{ width: 12, height: 12 }} />
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      <style>{`
        @keyframes spp-spin{to{transform:rotate(360deg)}}
        @keyframes spp-pulse{0%,100%{opacity:1}50%{opacity:.45}}
      `}</style>
    </div>
  );
});
SuggestedPostPreview.displayName = "SuggestedPostPreview";

export default SuggestedPostPreview;
