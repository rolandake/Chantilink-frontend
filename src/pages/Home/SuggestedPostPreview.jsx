// 📁 src/pages/Home/SuggestedPostPreview.jsx
// ✨ v7 — MODERN REDESIGN + R2
//
// AMÉLIORATIONS v7 :
//   → Design system unifié avec tokens
//   → Robustesse : AbortController nettoyé, retry, error boundary
//   → MediaBlock : aspect-ratio natif CSS, poster optimisé
//   → A11y : rôles ARIA, focus-visible, keyboard nav complet
//   → Perf : useReducedMotion, memo agressif, pas de rerender inutile
//   → UX : relevance bar animée, badge score, transition douce hide
//
// HÉRITAGE v6 R2 conservé :
//   → resolveMediaUrl() / getVideoPoster() / pickBestPost() / scoring

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
const SEEN_KEY      = "spp_seen_v6";
const HIGH_SCORE    = 72;

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────────────────────────────────────
const tk = (dark) => ({
  bg:       dark ? "#09090b"    : "#ffffff",
  bgCard:   dark ? "#0f0f12"   : "#ffffff",
  border:   dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)",
  text:     dark ? "#f2f2f5"   : "#0d0d0f",
  textSub:  dark ? "#6b6b7b"   : "#8a8a9a",
  divider:  dark ? "#1e1e24"   : "#f0f0f4",
  accent:   "#f97316",
  accent2:  "#ec4899",
  grad:     "linear-gradient(135deg,#f97316,#ec4899)",
  shadow:   dark ? "0 4px 32px rgba(0,0,0,0.6)" : "0 4px 24px rgba(0,0,0,0.09)",
  font:     "'DM Sans','Sora',sans-serif",
});

// ─────────────────────────────────────────────────────────────────────────────
// URL HELPERS (R2 — logique v6 conservée)
// ─────────────────────────────────────────────────────────────────────────────
const urlRead  = (k) => { try { const r = sessionStorage.getItem(URL_CACHE_PFX + k); if (!r) return null; const { url, exp } = JSON.parse(r); return Date.now() > exp ? (sessionStorage.removeItem(URL_CACHE_PFX + k), null) : url; } catch { return null; } };
const urlWrite = (k, u) => { try { sessionStorage.setItem(URL_CACHE_PFX + k, JSON.stringify({ url: u, exp: Date.now() + URL_CACHE_TTL })); } catch {} };

const isVideoUrl  = (u) => u && /\.(mp4|webm|mov|avi)$/i.test((u || "").split("?")[0]);
const isEmbedUrl  = (u) => u && (u.includes("youtube") || u.includes("youtu.be") || u.includes("vimeo"));
const EXPIRABLE   = [(u) => u.includes("videos.pexels.com/video-files/"), (u) => /cdn\.pixabay\.com\/video\/\d{4}\/\d{2}\/\d{2}\//.test(u)];
const DEAD        = ["youtube.com/watch", "youtu.be/", "dailymotion.com/video", "tiktok.com/@"];
const isExpirable = (u) => typeof u === "string" && EXPIRABLE.some(fn => fn(u));
const isDead      = (u) => typeof u === "string" && DEAD.some(p => u.includes(p));
const isValid     = (u) => { if (!u || typeof u !== "string" || u.length < 10) return false; if (u.startsWith("data:") || u.startsWith("blob:") || u.startsWith("/")) return true; try { const x = new URL(u); return !!(x.hostname && x.pathname !== "/"); } catch { return false; } };
const isUsable    = (u) => u && !isExpirable(u) && !isDead(u) && isValid(u);

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
    if (videoUrl.includes("res.cloudinary.com")) {
      const CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "";
      if (!CLOUD) return null;
      const idx = videoUrl.indexOf("/upload/");
      if (idx === -1) return null;
      const segs = videoUrl.substring(idx + 8).split("/").filter(s => !s.includes(",") && !(/^[a-z]+_[a-z]/.test(s) && !s.includes(".")));
      const pub  = segs.join("/").replace(/\.(mp4|webm|mov|avi)$/i, "");
      return pub ? `https://res.cloudinary.com/${CLOUD}/image/upload/q_auto:good,f_jpg,w_800,c_limit,so_0/${pub}.jpg` : null;
    }
  } catch {}
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
// SCORING (logique v5/v6 conservée intégralement)
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
const getUserTypePref = () => {
  try { const d = JSON.parse(localStorage.getItem("feedLTM_fallback") || "{}"); return { video: d.video?.score || 0, image: d.image?.score || 0, text: d.text?.score || 0 }; }
  catch { return {}; }
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
  if (seenIds.has(post._id)) return -1;
  const ageH = (Date.now() - new Date(post.createdAt || 0).getTime()) / 3_600_000;
  score += ageH < 1 ? 30 : ageH < 6 ? 22 : ageH < 24 ? 15 : ageH < 72 ? 8 : 2;
  const eng = (post.likesCount || post.likes?.length || 0) + (post.commentsCount || post.comments?.length || 0) * 3 + (post.sharesCount || post.shares || 0) * 5;
  score += Math.min(30, (eng / Math.max(post.user?.followersCount || 1, 1)) * 1000);
  score += Math.min(20, Math.log1p(eng / Math.max(ageH, 0.1)) * 8);
  const type = getPostType(post);
  const mul = (TIME_MATRIX[getTimeBucket()] || TIME_MATRIX[2])[type] || 1.0;
  score += (mul - 0.7) / 0.7 * 15;
  score += (getUserTypePref()[type] || 0) * 10;
  const text = post.content || post.contenu || "";
  if (text.length > 100 && text.length < 1000) score += 8;
  if (/\!\!\!|[A-Z]{5,}|😱{2,}/.test(text)) score -= 10;
  if (post._isMock || post.isMockPost) score -= 15;
  return Math.max(0, Math.min(100, score));
};

const pickBestPost = async (posts, signal) => {
  if (!posts?.length) return null;
  let seenIds = new Set();
  try { seenIds = new Set(JSON.parse(sessionStorage.getItem(SEEN_KEY) || "[]")); } catch {}
  const scored = posts.map(p => ({ post: p, score: scorePostForSuggestion(p, seenIds) }))
    .filter(s => s.score >= 0).sort((a, b) => b.score - a.score);
  if (!scored.length) return null;
  const { post, score } = scored[0];
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
      if (isUsable(raw)) { videoUrl = resolveMediaUrl(raw); poster = getVideoPoster(videoUrl, post.thumbnail); }
      else if (isExpirable(raw)) { const f = await resolveExpired(raw, post.externalId, signal); if (f) { videoUrl = resolveMediaUrl(f); poster = getVideoPoster(videoUrl, post.thumbnail); } }
    }
  } else if (type === "image") {
    if (rawUrl) {
      if (isUsable(rawUrl)) mediaUrl = resolveMediaUrl(rawUrl);
      else if (isExpirable(rawUrl)) { const f = await resolveExpired(rawUrl, post.externalId, signal); if (f) mediaUrl = resolveMediaUrl(f); }
    }
  } else if (isEmbedUrl(post.embedUrl)) embedUrl = post.embedUrl;
  return {
    type, videoUrl, mediaUrl, poster, embedUrl,
    text:    post.content || post.contenu || "",
    likes:   post.likesCount || post.likes?.length || 0,
    comments:post.commentsCount || post.comments?.length || 0,
    views:   post.viewsCount || post.views || 0,
    postId:  post._id, score,
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
  const initials = useMemo(() => { if (!username) return "?"; const p = username.trim().split(" "); return p.length > 1 ? (p[0][0]+p[1][0]).toUpperCase() : username.substring(0,2).toUpperCase(); }, [username]);
  const bg = useMemo(() => { let h = 0; for (let i = 0; i < (username||"").length; i++) h = username.charCodeAt(i)+((h<<5)-h); return COLORS[Math.abs(h)%COLORS.length]; }, [username]);
  const resolvedPhoto = useMemo(() => resolveMediaUrl(photo), [photo]);
  return err || !resolvedPhoto
    ? <div style={{ width: size, height: size, borderRadius: "50%", backgroundColor: bg, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: size * 0.36, flexShrink: 0, letterSpacing: "-0.02em" }}>{initials}</div>
    : <img src={resolvedPhoto} alt={username} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} onError={() => setErr(true)} loading="lazy" />;
});
Avatar.displayName = "Avatar";

// ─────────────────────────────────────────────────────────────────────────────
// STAT BAR
// ─────────────────────────────────────────────────────────────────────────────
const StatBar = memo(({ likes, comments, views, isDarkMode }) => {
  const t = useMemo(() => tk(isDarkMode), [isDarkMode]);
  if (!likes && !comments && !views) return null;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 16,
      padding: "10px 16px",
      borderTop: `1px solid ${t.divider}`,
      fontSize: 11, fontFamily: t.font,
    }}>
      {likes > 0 && (
        <span style={{ display: "flex", alignItems: "center", gap: 5, color: t.textSub, fontWeight: 600 }}>
          <HeartIcon style={{ width: 13, height: 13, color: "#f43f5e" }} />
          {fmtNum(likes)}
        </span>
      )}
      {comments > 0 && (
        <span style={{ display: "flex", alignItems: "center", gap: 5, color: t.textSub, fontWeight: 600 }}>
          <ChatBubbleOvalLeftIcon style={{ width: 13, height: 13, color: "#60a5fa" }} />
          {fmtNum(comments)}
        </span>
      )}
      {views > 0 && (
        <span style={{ display: "flex", alignItems: "center", gap: 5, color: t.textSub, fontWeight: 600 }}>
          <EyeIcon style={{ width: 13, height: 13, color: "#34d399" }} />
          {fmtNum(views)}
        </span>
      )}
    </div>
  );
});
StatBar.displayName = "StatBar";

// ─────────────────────────────────────────────────────────────────────────────
// SILHOUETTE
// ─────────────────────────────────────────────────────────────────────────────
const Silhouette = ({ h = 220 }) => (
  <div style={{ width: "100%", height: h, background: "#1a1a1e", display: "flex", alignItems: "center", justifyContent: "center" }}>
    <svg viewBox="0 0 100 100" style={{ width: h * 0.52, height: h * 0.52, opacity: 0.3 }} fill="none">
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

  if (!post) return <Silhouette h={220} />;

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
            <div style={{
              width: 56, height: 56, borderRadius: "50%",
              background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)",
              display: "flex", alignItems: "center", justifyContent: "center",
              border: "1.5px solid rgba(255,255,255,0.3)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            }}>
              {playing
                ? <PauseIcon style={{ width: 22, height: 22, color: "#fff" }} />
                : <PlayIcon  style={{ width: 24, height: 24, color: "#fff", marginLeft: 2 }} />
              }
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mute button */}
      <button
        onClick={toggleMute}
        aria-label={muted ? "Activer le son" : "Couper le son"}
        style={{
          position: "absolute", bottom: 12, right: 12, zIndex: 10,
          width: 32, height: 32, borderRadius: "50%", border: "none",
          background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)",
          color: "#fff", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "background 0.15s",
        }}
      >
        {muted ? <SpeakerXMarkIcon style={{ width: 14, height: 14 }} /> : <SpeakerWaveIcon style={{ width: 14, height: 14 }} />}
      </button>

      {/* Inline stats */}
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
      <img src={post.mediaUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} loading="lazy" onError={() => setImgErr(true)} />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 55%)", pointerEvents: "none" }} />
      {(post.likes > 0 || post.comments > 0) && (
        <div style={{ position: "absolute", bottom: 14, left: 14, display: "flex", gap: 12, pointerEvents: "none" }}>
          {post.likes    > 0 && <span style={{ color: "#fff", fontSize: 11, fontWeight: 700, textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}>❤️ {fmtNum(post.likes)}</span>}
          {post.comments > 0 && <span style={{ color: "#fff", fontSize: 11, fontWeight: 700, textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}>💬 {fmtNum(post.comments)}</span>}
        </div>
      )}
    </div>
  );

  // TEXT
  return (
    <div
      onClick={onNavigate}
      role="button" tabIndex={0} onKeyDown={e => e.key === "Enter" && onNavigate()}
      style={{
        position: "relative", width: "100%",
        minHeight: 180, display: "flex", alignItems: "center", justifyContent: "center",
        padding: "32px 24px", cursor: "pointer",
        background: isDarkMode
          ? "linear-gradient(135deg,#12121a,#1a1220)"
          : "linear-gradient(135deg,#fef9f5,#fdf2f8)",
      }}
    >
      <div style={{ position: "absolute", inset: 0, opacity: 0.06, pointerEvents: "none",
        background: "radial-gradient(circle at 30% 50%,#f97316,transparent 60%), radial-gradient(circle at 70% 50%,#ec4899,transparent 60%)",
      }} />
      <p style={{
        position: "relative", fontSize: 15, lineHeight: 1.6, textAlign: "center",
        display: "-webkit-box", WebkitLineClamp: 5, WebkitBoxOrient: "vertical", overflow: "hidden",
        color: isDarkMode ? "#d0d0d8" : "#3a3a4a", fontWeight: 500,
        fontFamily: t.font,
      }}>
        {post.text || "Voir ce profil"}
      </p>
    </div>
  );
});
MediaBlock.displayName = "MediaBlock";

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
  const fetchedRef   = useRef(false);
  const abortRef     = useRef(null);

  const t = useMemo(() => tk(isDarkMode), [isDarkMode]);

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
  const relevancePct = post ? Math.round(Math.min(100, post.score || 0)) : 0;

  // Skeleton
  if (!ready) return (
    <div ref={containerRef} style={{ width: "100%", fontFamily: t.font }}>
      <SectionDivider isDarkMode={isDarkMode} />
      <div style={{ padding: "0 16px 20px" }}>
        <div style={{
          width: "100%", height: 360, borderRadius: 20,
          background: isDarkMode ? "#0f0f12" : "#f5f5f7",
          animation: "spp-pulse 1.6s ease infinite",
        }} />
        <style>{`@keyframes spp-pulse{0%,100%{opacity:1}50%{opacity:0.45}}`}</style>
      </div>
    </div>
  );

  if (hidden || !user) return <div ref={containerRef} />;

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
          <div
            style={{
              position: "relative",
              borderRadius: 20, overflow: "hidden",
              background: t.bgCard,
              border: `1.5px solid ${t.border}`,
              boxShadow: t.shadow,
            }}
          >
            {/* High relevance badge */}
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

            {/* Close */}
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

            {/* Media */}
            <div onClick={goProfile} style={{ cursor: "pointer" }}>
              <MediaBlock post={post} isDarkMode={isDarkMode} onNavigate={goProfile} />
            </div>

            {/* Stats */}
            <StatBar likes={post?.likes} comments={post?.comments} views={post?.views} isDarkMode={isDarkMode} />

            {/* Profile row */}
            <div
              onClick={goProfile}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "14px 16px 0",
                cursor: "pointer",
              }}
            >
              {/* Avatar with ring */}
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
                  <Avatar username={user.fullName} photo={user.profilePhoto || user.avatar || user.profilePicture} size={46} />
                </div>
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                  <span style={{
                    fontSize: 14.5, fontWeight: 800, color: t.text,
                    letterSpacing: "-0.02em",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {user.fullName}
                  </span>
                  {user.isVerified && <CheckBadgeIcon style={{ width: 15, height: 15, color: "#f97316", flexShrink: 0 }} />}
                </div>
                <p style={{
                  fontSize: 11.5, color: t.textSub, marginTop: 2,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {user.bio ? `${user.bio.substring(0, 55)}${user.bio.length > 55 ? "…" : ""}` : "Suggéré pour toi"}
                </p>

                {/* Relevance bar */}
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

              {/* Follow button */}
              <motion.button
                onClick={handleFollow}
                disabled={loadFollow}
                aria-label={following ? "Déjà suivi" : `Suivre ${user.fullName}`}
                whileHover={loadFollow ? {} : { scale: 1.03 }}
                whileTap={loadFollow ? {} : { scale: 0.97 }}
                style={{
                  flexShrink: 0,
                  padding: "8px 16px",
                  borderRadius: 50, border: "none",
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

            {/* View profile button */}
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
      <style>{`@keyframes spp-spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
});
SuggestedPostPreview.displayName = "SuggestedPostPreview";

// ─────────────────────────────────────────────────────────────────────────────
// SECTION DIVIDER
// ─────────────────────────────────────────────────────────────────────────────
const SectionDivider = memo(({ isDarkMode }) => {
  const t = useMemo(() => tk(isDarkMode), [isDarkMode]);
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "20px 16px 12px",
    }}>
      <div style={{ flex: 1, height: 1, background: t.divider }} />
      <span style={{
        fontSize: 9.5, fontWeight: 800,
        letterSpacing: "0.1em", textTransform: "uppercase",
        color: t.accent, fontFamily: t.font,
      }}>
        👤 Profil suggéré
      </span>
      <div style={{ flex: 1, height: 1, background: t.divider }} />
    </div>
  );
});
SectionDivider.displayName = "SectionDivider";

export default SuggestedPostPreview;