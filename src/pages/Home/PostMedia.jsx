// 📁 src/pages/Home/PostMedia.jsx
// ✅ MIGRATION R2 COMPLÈTE
// ✅ FIX VIDÉOS NON AFFICHÉES v7 — CORRECTION DÉFINITIVE VideoItem :
//
//   HISTORIQUE DES BUGS :
//     v4 : useEffect async → fenêtre sans src → onerror code=4 "Empty src"
//     v5 : ref callback + srcSetRef → srcSetRef persiste entre unmount/remount
//          → src non reposé → même onerror
//     v6 : src={currentSrc} prop JSX → React ne re-set pas src si valeur JSX
//          inchangée mais DOM recréé (StrictMode unmount/remount) → même onerror
//
//   CAUSE RACINE CONFIRMÉE :
//     React StrictMode fait mount→unmount→remount en développement.
//     Au unmount : React vide vid.src = "".
//     Au remount : React compare le vdom — si src prop n'a pas changé,
//     React ne re-positionne PAS l'attribut sur le nouvel élément DOM.
//     Résultat : vid.src === "" → le navigateur résout "" en URL courante
//     → onerror code=4 "MEDIA_ELEMENT_ERROR: Empty src attribute".
//
//   SOLUTION DÉFINITIVE v7 :
//     • Pas de src={} prop JSX (React ne garantit pas la re-pose).
//     • ref callback : positionne el.src impérativement dès l'insertion DOM.
//     • useLayoutEffect sans deps : re-vérifie et re-pose vid.src si manquant,
//       synchrone avant chaque paint — couvre StrictMode et tout autre remount.
//     • Combinaison des deux = aucune fenêtre possible où vid.src est vide.
//
// ✅ Toutes les corrections v4 conservées (resolveSlotType, checkContentType,
//    useMediaValidation CAS1/2/3, suspects filter, postMediaType bypass).

import React, {
  useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo
} from "react";
import { AnimatePresence } from "framer-motion";
import MediaLightbox from "./MediaLightbox";

// ─────────────────────────────────────────────────────────────────────────────
// DEBUG HELPER — activable via localStorage.setItem('POSTMEDIA_DEBUG', '1')
// ─────────────────────────────────────────────────────────────────────────────
const DEBUG = () => typeof window !== "undefined" && window.localStorage?.getItem("POSTMEDIA_DEBUG") === "1";
const dbg     = (...args) => { if (DEBUG()) console.log("[PostMedia]",  ...args); };
const dbgWarn = (...args) => { if (DEBUG()) console.warn("[PostMedia]", ...args); };

const API_BASE      = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/api$/, "");
const R2_PUBLIC_URL = (import.meta.env.VITE_R2_PUBLIC_URL || "").replace(/\/+$/, "");

// ─────────────────────────────────────────────────────────────────────────────
// VIDEO MANAGER GLOBAL
// ─────────────────────────────────────────────────────────────────────────────
let currentPlayingVideo = null;
const registerPlayingVideo = (video) => {
  if (!video) return;
  if (currentPlayingVideo && currentPlayingVideo !== video && document.contains(currentPlayingVideo)) {
    try { currentPlayingVideo.pause(); } catch {}
  }
  currentPlayingVideo = video;
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const isStructurallyValid = (url) => {
  if (!url || typeof url !== "string" || url.length < 10) return false;
  if (url.startsWith("data:") || url.startsWith("blob:") || url.startsWith("/")) return true;
  try {
    const u = new URL(url);
    return !!(u.hostname && u.pathname && u.pathname !== "/");
  } catch { return false; }
};

const isVideoUrl = (url) => {
  if (!url) return false;
  const clean = url.split("?")[0].toLowerCase();
  if (/\.(mp4|webm|mov|avi|mkv|flv|m4v)$/.test(clean)) return true;
  if (/\/videos?\//.test(clean))  return true;
  if (/\/video[-_]/.test(clean))  return true;
  if (/[-_]video\b/.test(clean))  return true;
  return false;
};

const hasKnownVideoExtension = (url) => {
  if (!url) return false;
  return /\.(mp4|webm|mov|avi|mkv|flv|m4v)$/i.test(url.split("?")[0]);
};

const hasKnownImageExtension = (url) => {
  if (!url) return false;
  return /\.(jpg|jpeg|png|gif|webp|avif|svg)$/i.test(url.split("?")[0]);
};

const isHLSUrl        = url => url && /\.m3u8/i.test(url);
const isPexelsVideo   = url => url && url.includes("videos.pexels.com");
const isPixabayVideo  = url => url && url.includes("cdn.pixabay.com/video");
const isExternalVideo = url => isPexelsVideo(url) || isPixabayVideo(url);
const isYouTubeUrl    = url => url && (url.includes("youtube.com") || url.includes("youtu.be"));
const needsCrossOrigin = url => url && url.includes("res.cloudinary.com");

// Détecte les URLs de pages web sociales (pas des fichiers médias)
// ex: mastodon.social/@user/123, pixelfed.social/p/user/123
const isWebPageUrl = (url) => {
  if (!url) return false;
  const clean = url.split("?")[0].toLowerCase();
  // Pas d'extension fichier connue = potentiellement une page
  const hasMediaExt = /\.(mp4|webm|mov|avi|mkv|flv|m4v|jpg|jpeg|png|gif|webp|avif|svg|m3u8)$/i.test(clean);
  if (hasMediaExt) return false;
  // Patterns de pages sociales/web
  if (/@\w+\/\d+/.test(url)) return true;          // mastodon: /@user/12345
  if (/\/p\/[\w.]+\/\d+/.test(url)) return true;   // pixelfed: /p/user/12345
  if (/\/web\/statuses\//.test(url)) return true;   // mastodon web
  return false;
};

const isEmbedUrl = url => url && (
  url.includes("player.vimeo.com") || url.includes("youtube.com/embed") ||
  url.includes("youtube.com/watch") || url.includes("youtu.be/") ||
  url.includes("dailymotion.com/embed")
);

const toEmbedUrl = (url) => {
  if (!url) return url;
  if (url.includes("youtube.com/embed")) return url.split("?")[0];
  const s = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (s) return `https://www.youtube.com/embed/${s[1]}`;
  const w = url.match(/youtube\.com\/watch\?(?:.*&)?v=([a-zA-Z0-9_-]{11})/);
  if (w) return `https://www.youtube.com/embed/${w[1]}`;
  return url;
};

const getYouTubeId = (url) => {
  if (!url) return null;
  const s = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);           if (s) return s[1];
  const e = url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/); if (e) return e[1];
  const w = url.match(/youtube\.com\/watch\?(?:.*&)?v=([a-zA-Z0-9_-]{11})/); if (w) return w[1];
  return null;
};

const getVideoUrls = (url) => {
  if (!url) return { proxy: null, direct: null };
  if (isPexelsVideo(url) || isPixabayVideo(url))
    return { proxy: `${API_BASE}/api/proxy/video?url=${encodeURIComponent(url)}`, direct: null };
  return { proxy: null, direct: url };
};

const getVideoPosterUrl = (videoUrl, postData = null) => {
  if (!videoUrl) return null;
  if (postData?.thumbnail) return postData.thumbnail;
  if (isPexelsVideo(videoUrl)) {
    const m = videoUrl.match(/video-files\/(\d+)\//);
    return m ? `https://images.pexels.com/videos/${m[1]}/pictures/preview-0.jpg` : null;
  }
  if (isPixabayVideo(videoUrl)) {
    const t = videoUrl
      .replace("_large.mp4",  "_tiny.jpg")
      .replace("_medium.mp4", "_tiny.jpg")
      .replace("_small.mp4",  "_tiny.jpg");
    return t !== videoUrl ? t : null;
  }
  return null;
};

const getYouTubeThumbnail = (url) => {
  const id = getYouTubeId(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
};

const getOptimizedUrl = (url) => {
  if (!url) return null;
  if (url.startsWith("data:")) return url;
  if (url.startsWith("blob:"))  return url;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/uploads/") || url.startsWith("uploads/")) {
    const clean = url.startsWith("/") ? url : `/${url}`;
    return `${API_BASE}${clean}`;
  }
  if (R2_PUBLIC_URL) return `${R2_PUBLIC_URL}/${url.replace(/^\/+/, "")}`;
  return url;
};

// ─────────────────────────────────────────────────────────────────────────────
// resolveSlotType : postMediaType DB = priorité ABSOLUE
// ─────────────────────────────────────────────────────────────────────────────
const resolveSlotType = (url, postMediaType = null) => {
  if (!url) return "unknown";
  if (postMediaType === "youtube") { dbg(`resolveSlotType → embed (mediaType DB = youtube) url=${url}`); return "embed"; }
  if (postMediaType === "video")   { dbg(`resolveSlotType → video (mediaType DB = video) url=${url}`);   return "video"; }
  if (isEmbedUrl(url))     { dbg(`resolveSlotType → embed (isEmbedUrl) url=${url}`);    return "embed"; }
  if (isHLSUrl(url))       { dbg(`resolveSlotType → hls (isHLSUrl) url=${url}`);        return "hls";   }
  if (isVideoUrl(url))     { dbg(`resolveSlotType → video (isVideoUrl) url=${url}`);    return "video"; }
  if (isExternalVideo(url)){ dbg(`resolveSlotType → video (isExternal) url=${url}`);    return "video"; }
  dbg(`resolveSlotType → image (fallback) url=${url}`);
  return "image";
};

// ─────────────────────────────────────────────────────────────────────────────
// checkContentType : gestion CORS R2 + fallback video element
// ─────────────────────────────────────────────────────────────────────────────
const headCheckCache = new Map();

const checkContentType = async (url) => {
  if (headCheckCache.has(url)) {
    dbg(`checkContentType cache hit → ${headCheckCache.get(url)} url=${url}`);
    return headCheckCache.get(url);
  }
  if (/\/(videos?|video[-_]|[-_]video)\//i.test(url)) {
    dbg(`checkContentType path pattern → video url=${url}`);
    headCheckCache.set(url, "video");
    return "video";
  }
  try {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3000);
    const res   = await fetch(url, { method: "HEAD", signal: ctrl.signal });
    clearTimeout(timer);
    const ct   = res.headers.get("content-type") || "";
    const type = ct.startsWith("video/") ? "video" : "image";
    dbg(`checkContentType HEAD OK → ${type} (ct="${ct}") url=${url}`);
    headCheckCache.set(url, type);
    return type;
  } catch (headErr) {
    dbgWarn(`checkContentType HEAD failed (${headErr.message}) → trying video element url=${url}`);
    return new Promise((resolve) => {
      let resolved = false;
      const vid = document.createElement("video");
      vid.muted   = true;
      vid.preload = "metadata";
      const done = (type) => {
        if (resolved) return;
        resolved = true;
        try { vid.onloadedmetadata = null; vid.onerror = null; vid.src = ""; } catch {}
        dbg(`checkContentType video-element → ${type} url=${url}`);
        headCheckCache.set(url, type);
        resolve(type);
      };
      const timer = setTimeout(() => done("image"), 3000);
      vid.onloadedmetadata = () => { clearTimeout(timer); done("video"); };
      vid.onerror = () => {
        clearTimeout(timer);
        const likelyCors = url.startsWith("https://");
        dbgWarn(`checkContentType video-element onerror likelyCors=${likelyCors} url=${url}`);
        done(likelyCors ? "video" : "image");
      };
      vid.src = url;
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// TEXT ONLY CARD
// ─────────────────────────────────────────────────────────────────────────────
const TEXT_CARD_PALETTES = [
  ["#1877F2", "#0D5FCC", "#ffffff"],
  ["#E4405F", "#C13584", "#ffffff"],
  ["#FF6B35", "#F7C59F", "#ffffff"],
  ["#2EC4B6", "#0B7A75", "#ffffff"],
  ["#6A0572", "#AB83A1", "#ffffff"],
  ["#1A1A2E", "#16213E", "#ffffff"],
  ["#2D6A4F", "#52B788", "#ffffff"],
  ["#8B2FC9", "#5A108F", "#ffffff"],
];

const hashText = (str) => {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = Math.imul(31, h) + str.charCodeAt(i) | 0;
  return Math.abs(h) % TEXT_CARD_PALETTES.length;
};

const getFontSize = (len) => {
  if (len <= 60)  return { size: "32px", lineHeight: "1.25", weight: "700" };
  if (len <= 120) return { size: "26px", lineHeight: "1.30", weight: "700" };
  if (len <= 220) return { size: "22px", lineHeight: "1.35", weight: "600" };
  if (len <= 380) return { size: "18px", lineHeight: "1.40", weight: "600" };
  return            { size: "15px", lineHeight: "1.50", weight: "500" };
};

const getCardHeight = (len) => {
  if (len <= 60)  return 260;
  if (len <= 120) return 280;
  if (len <= 220) return 300;
  if (len <= 380) return 340;
  if (len <= 600) return 380;
  return 420;
};

export const TextOnlyCard = React.memo(({ content, forceIndex }) => {
  if (!content || typeof content !== "string" || !content.trim()) return null;
  const text       = content.trim();
  const paletteIdx = (typeof forceIndex === "number" && forceIndex >= 0 && forceIndex <= 7)
    ? forceIndex : hashText(text);
  const [from, to, textColor] = TEXT_CARD_PALETTES[paletteIdx];
  const { size, lineHeight, weight } = getFontSize(text.length);
  const height    = getCardHeight(text.length);
  const displayed = text.length > 500 ? text.slice(0, 497) + "…" : text;
  return (
    <div style={{
      width: "100%", minHeight: height,
      background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)`,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "28px 24px", boxSizing: "border-box",
      position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", top: -60, right: -60, width: 200, height: 200, borderRadius: "50%", background: "rgba(255,255,255,0.06)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: -40, left: -40, width: 150, height: 150, borderRadius: "50%", background: "rgba(255,255,255,0.04)", pointerEvents: "none" }} />
      <p style={{
        color: textColor, fontSize: size, lineHeight, fontWeight: weight,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        textAlign: "center", margin: 0, position: "relative", zIndex: 1,
        wordBreak: "break-word", overflowWrap: "break-word",
        letterSpacing: text.length <= 60 ? "-0.5px" : "normal",
        textShadow: "0 1px 3px rgba(0,0,0,0.15)",
      }}>
        {displayed}
      </p>
    </div>
  );
});
TextOnlyCard.displayName = "TextOnlyCard";

// ─────────────────────────────────────────────────────────────────────────────
// BADGE SOURCE
// ─────────────────────────────────────────────────────────────────────────────
const VideoSourceBadge = React.memo(({ url }) => {
  const info = useMemo(() => {
    if (isPexelsVideo(url))  return { label: "Pexels",  bg: "#05A081" };
    if (isPixabayVideo(url)) return { label: "Pixabay", bg: "#2EC66A" };
    if (isYouTubeUrl(url))   return { label: "YouTube", bg: "#FF0000" };
    return null;
  }, [url]);
  if (!info) return null;
  return (
    <div style={{
      position: "absolute", top: 8, left: 8, zIndex: 20,
      display: "flex", alignItems: "center", gap: 4,
      padding: "2px 8px", borderRadius: 9999,
      background: info.bg, color: "white", fontSize: 10, fontWeight: 700,
      pointerEvents: "none", boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
    }}>
      <svg viewBox="0 0 10 10" style={{ width: 8, height: 8 }} fill="white"><polygon points="2,1 9,5 2,9" /></svg>
      {info.label}
    </div>
  );
});
VideoSourceBadge.displayName = "VideoSourceBadge";

// ─────────────────────────────────────────────────────────────────────────────
// EMBED ITEM
// ─────────────────────────────────────────────────────────────────────────────
const EmbedItem = React.memo(({ url, thumbnail, title, showBadge = true }) => {
  const [showEmbed,    setShowEmbed]    = useState(false);
  const [thumbError,   setThumbError]   = useState(false);
  const [thumbLoaded,  setThumbLoaded]  = useState(false);
  const [thumbQuality, setThumbQuality] = useState("hq");

  const normalizedUrl = useMemo(() => toEmbedUrl(url), [url]);

  const resolvedThumb = useMemo(() => {
    if (thumbnail) return thumbnail;
    const id = getYouTubeId(url); if (!id) return null;
    if (thumbQuality === "hq") return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
    if (thumbQuality === "mq") return `https://img.youtube.com/vi/${id}/mqdefault.jpg`;
    if (thumbQuality === "sd") return `https://img.youtube.com/vi/${id}/sddefault.jpg`;
    return null;
  }, [url, thumbnail, thumbQuality]);

  const handleThumbError = useCallback(() => {
    if (thumbQuality === "hq") setThumbQuality("mq");
    else if (thumbQuality === "mq") setThumbQuality("sd");
    else { setThumbQuality("error"); setThumbError(true); }
  }, [thumbQuality]);

  const embedSrc = useMemo(() => {
    if (!showEmbed) return "";
    if (url.includes("player.vimeo.com")) return `${url.split("?")[0]}?autoplay=1&muted=0`;
    if (isYouTubeUrl(url)) return `${normalizedUrl}?autoplay=1&rel=0&modestbranding=1`;
    return url;
  }, [showEmbed, url, normalizedUrl]);

  const hasThumbnail = resolvedThumb && !thumbError;

  return (
    <div style={{ position: "absolute", inset: 0, background: "#000" }}>
      {showEmbed ? (
        <iframe src={embedSrc} style={{ width: "100%", height: "100%" }} frameBorder="0"
          allow="autoplay; picture-in-picture" allowFullScreen title={title || "Vidéo"}
          referrerPolicy="strict-origin-when-cross-origin" />
      ) : (
        <>
          {hasThumbnail ? (
            <>
              {!thumbLoaded && <div style={{ position: "absolute", inset: 0, background: "#111" }} />}
              <img src={resolvedThumb} alt={title || "Vidéo"}
                style={{ width: "100%", height: "100%", objectFit: "cover", opacity: thumbLoaded ? 1 : 0, transition: "opacity 0.25s" }}
                loading="lazy" decoding="async" onLoad={() => setThumbLoaded(true)} onError={handleThumbError} referrerPolicy="no-referrer" />
            </>
          ) : (
            <div style={{ width: "100%", height: "100%", background: "#111", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "#555", fontSize: 36 }}>▶</span>
            </div>
          )}
          {hasThumbnail && thumbLoaded && (
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.5), transparent)", pointerEvents: "none" }} />
          )}
          <button onClick={() => setShowEmbed(true)}
            style={{ position: "absolute", inset: 0, background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(255,255,255,0.92)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 20px rgba(0,0,0,0.4)" }}>
              <div style={{ width: 0, height: 0, marginLeft: 4, borderTop: "10px solid transparent", borderBottom: "10px solid transparent", borderLeft: "17px solid #111" }} />
            </div>
          </button>
        </>
      )}
      {showBadge && <VideoSourceBadge url={url} />}
    </div>
  );
});
EmbedItem.displayName = "EmbedItem";

// ─────────────────────────────────────────────────────────────────────────────
// HLS ITEM
// ─────────────────────────────────────────────────────────────────────────────
const HLSItem = React.memo(({ thumbnail, externalUrl, title }) => {
  const [imgError, setImgError] = useState(false);
  const hasThumbnail = thumbnail && !imgError;
  return (
    <div style={{ position: "absolute", inset: 0, background: "#111", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
      {hasThumbnail
        ? <img src={thumbnail} alt={title || ""} style={{ width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" decoding="async" onError={() => setImgError(true)} />
        : <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #1a1a2e, #0f3460)" }}><svg viewBox="0 0 24 24" style={{ width: 32, height: 32 }} fill="rgba(255,69,0,0.9)"><path d="M8 5v14l11-7z"/></svg></div>
      }
      {externalUrl && (
        <a href={externalUrl} target="_blank" rel="noopener noreferrer"
          style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={e => e.stopPropagation()}>
          {hasThumbnail && (
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(255,69,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 16px rgba(0,0,0,0.4)" }}>
              <svg viewBox="0 0 24 24" style={{ width: 24, height: 24, marginLeft: 3 }} fill="white"><path d="M8 5v14l11-7z"/></svg>
            </div>
          )}
        </a>
      )}
      <div style={{ position: "absolute", top: 8, left: 8, padding: "2px 8px", borderRadius: 9999, background: "rgba(255,69,0,0.85)", color: "white", fontSize: 10, fontWeight: 700 }}>Reddit</div>
    </div>
  );
});
HLSItem.displayName = "HLSItem";

// ─────────────────────────────────────────────────────────────────────────────
// VIDEO ITEM — v6 : src passé directement comme attribut JSX
//
// ✅ FIX DÉFINITIF (v6) :
//
//   v4 : useEffect async → fenêtre sans src → onerror "Empty src attribute"
//   v5 : ref callback + srcSetRef → srcSetRef reste true après unmount/remount
//        (React StrictMode double-mount, ou remount réel) → src non reposé
//        sur le nouvel élément → même onerror
//
//   v6 : on passe simplement `src={currentSrc}` comme prop JSX sur <video>.
//        React gère l'attribut src de manière synchrone lors du commit DOM,
//        avant que le navigateur ne puisse déclencher un onerror.
//        Plus de ref callback custom, plus de srcSetRef, plus de useEffect src.
//        Le ref callback simple (`setVideoRef`) sert uniquement à enregistrer
//        l'élément pour `onRegisterVideoEl` et les appels impératifs (play/pause).
//
//   Pour le fallback proxy→direct : on change `currentSrc` via setState,
//   ce qui re-render le composant avec le nouveau src= prop → React met à jour
//   l'attribut src proprement.
// ─────────────────────────────────────────────────────────────────────────────
const ICON_MUTED   = `<svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor"><path d="M16.5 12A4.5 4.5 0 0 0 14 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06A8.99 8.99 0 0 0 17.73 18l1.99 2L21 18.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>`;
const ICON_UNMUTED = `<svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`;

const VideoItem = React.memo(({ url, posterUrl, isLCP, initialMuted = true, onRegisterVideoEl, slotIndex, showBadge = true, onVideoError, onOpenLightbox }) => {
  const videoRef      = useRef(null);
  const containerRef  = useRef(null);
  const muteButtonRef = useRef(null);
  const videoUrls     = useMemo(() => getVideoUrls(url), [url]);
  const abortRef      = useRef(null);
  const debounceRef   = useRef(null);
  const canplayRef    = useRef(null);
  const timerRef      = useRef(null);
  const isVisibleRef  = useRef(false);
  const userPausedRef = useRef(false);

  const [currentSrc,    setCurrentSrc]    = useState(() => videoUrls.proxy || videoUrls.direct);
  const [videoError,    setVideoError]    = useState(false);
  const [posterVisible, setPosterVisible] = useState(true);

  const isMutedLocal   = useRef(initialMuted);
  const preloadStrat   = useMemo(() => (isLCP || isExternalVideo(url)) ? "auto" : "metadata", [isLCP, url]);
  const useCrossOrigin = useMemo(() => needsCrossOrigin(url), [url]);

  // ─── ref callback : enregistrement + src immédiat ───────────────────────
  const setVideoRef = useCallback((el) => {
    videoRef.current = el;
    onRegisterVideoEl?.(slotIndex, el);
    if (el && currentSrc) {
      dbg(`VideoItem refCallback — setting src imperatively src=${currentSrc} slotIndex=${slotIndex}`);
      el.muted   = isMutedLocal.current;
      el.volume  = isMutedLocal.current ? 0 : 1;
      el.preload = preloadStrat;
      if (el.src !== currentSrc) {
        el.src = currentSrc;
      }
    }
  }, [currentSrc, preloadStrat, onRegisterVideoEl, slotIndex]); // eslint-disable-line

  // ─── useLayoutEffect : garantit que src est correct après StrictMode remount ─
  // S'exécute uniquement quand currentSrc change (inclut le remount initial).
  // useLayoutEffect s'exécute synchronement après le commit DOM, avant le paint,
  // ce qui couvre le cas où React recrée l'élément sans re-setter src.
  useLayoutEffect(() => {
    const vid = videoRef.current;
    if (!vid || !currentSrc) return;
    if (vid.src !== currentSrc) {
      dbg(`VideoItem useLayoutEffect src mismatch → forcing src=${currentSrc} slotIndex=${slotIndex}`);
      vid.src     = currentSrc;
      vid.muted   = isMutedLocal.current;
      vid.volume  = isMutedLocal.current ? 0 : 1;
      vid.preload = preloadStrat;
    }
  }, [currentSrc, preloadStrat]); // eslint-disable-line

  useEffect(() => {
    const container = containerRef.current; if (!container) return;
    const obs = new IntersectionObserver(([entry]) => {
      isVisibleRef.current = entry.isIntersecting;
      if (entry.isIntersecting) { if (!userPausedRef.current) playVideo(); }
      else { pauseVideo(true); }
    }, { threshold: 0.4, rootMargin: "-5% 0px" });
    obs.observe(container);
    return () => { obs.disconnect(); pauseVideo(false); };
  }, []); // eslint-disable-line

  const playVideo = useCallback(() => {
    if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; }
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      const vid = videoRef.current; if (!vid) return;
      abortRef.current?.abort();
      const ctrl = new AbortController(); abortRef.current = ctrl;

      vid.muted  = isMutedLocal.current;
      vid.volume = isMutedLocal.current ? 0 : 1;
      userPausedRef.current = false;

      const doPlay = () => {
        if (ctrl.signal.aborted) return;
        if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
        registerPlayingVideo(vid);
        const p = vid.play();
        if (!p) return;
        p.then(() => {
          if (ctrl.signal.aborted) { vid.pause(); return; }
          dbg(`VideoItem play() OK slotIndex=${slotIndex}`);
          setPosterVisible(false);
        })
          .catch(err => {
            if (ctrl.signal.aborted || err.name === "AbortError") return;
            dbgWarn(`VideoItem play() error: ${err.name} ${err.message} slotIndex=${slotIndex}`);
            if (err.name === "NotAllowedError") {
              vid.muted = true; isMutedLocal.current = true;
              if (muteButtonRef.current) muteButtonRef.current.innerHTML = ICON_MUTED;
              vid.play().catch(() => {});
            } else {
              setTimeout(() => {
                if (ctrl.signal.aborted) return;
                vid.play().catch(() => { vid.muted = true; isMutedLocal.current = true; });
              }, 300);
            }
          });
      };

      if (vid.readyState >= 3) { doPlay(); }
      else {
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          if (!ctrl.signal.aborted && vid.readyState < 1) {
            dbgWarn(`VideoItem timeout readyState=${vid.readyState} src=${vid.src} slotIndex=${slotIndex}`);
            setVideoError(true);
            onVideoError?.();
          }
        }, 6000);

        if (canplayRef.current) vid.removeEventListener("canplay", canplayRef.current);
        const onCan = () => {
          vid.removeEventListener("canplay", onCan);
          canplayRef.current = null;
          if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
          dbg(`VideoItem canplay readyState=${vid.readyState} slotIndex=${slotIndex}`);
          doPlay();
        };
        canplayRef.current = onCan;
        vid.addEventListener("canplay", onCan);
      }
    }, 200);
  }, [onVideoError]); // eslint-disable-line

  const pauseVideo = useCallback((resetTime = false) => {
    if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; }
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    abortRef.current?.abort(); abortRef.current = null;
    const vid = videoRef.current;
    if (vid) {
      if (canplayRef.current) { vid.removeEventListener("canplay", canplayRef.current); canplayRef.current = null; }
      vid.pause();
      if (resetTime) { vid.currentTime = 0; setPosterVisible(true); }
    }
  }, []);

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (timerRef.current)    clearTimeout(timerRef.current);
    abortRef.current?.abort();
    const vid = videoRef.current;
    if (vid) {
      if (canplayRef.current) vid.removeEventListener("canplay", canplayRef.current);
      vid.pause(); vid.src = ""; vid.load();
    }
  }, []); // eslint-disable-line

  const handleMuteClick = useCallback((e) => {
    e?.stopPropagation();
    const vid = videoRef.current; if (!vid) return;
    const newMuted = !vid.muted;
    vid.muted = newMuted; vid.volume = newMuted ? 0 : 1;
    isMutedLocal.current = newMuted;
    if (muteButtonRef.current) muteButtonRef.current.innerHTML = newMuted ? ICON_MUTED : ICON_UNMUTED;
    if (!newMuted && vid.paused && isVisibleRef.current) {
      userPausedRef.current = false;
      vid.play().catch(() => {
        vid.muted = true; vid.volume = 0; isMutedLocal.current = true;
        if (muteButtonRef.current) muteButtonRef.current.innerHTML = ICON_MUTED;
      });
    }
  }, []);

  const handlePlay  = useCallback(() => { registerPlayingVideo(videoRef.current); setPosterVisible(false); userPausedRef.current = false; }, []);
  const handlePause = useCallback(() => { if (isVisibleRef.current) userPausedRef.current = true; }, []);

  const handleError = useCallback((e) => {
    const vid = videoRef.current;
    const errCode = vid?.error?.code;
    const errMsg  = vid?.error?.message || "unknown";
    dbgWarn(`VideoItem onerror code=${errCode} msg="${errMsg}" src=${vid?.src} slotIndex=${slotIndex}`);

    const { proxy, direct } = videoUrls;
    if (currentSrc === proxy && direct) {
      dbg(`VideoItem fallback proxy→direct slotIndex=${slotIndex}`);
      // setCurrentSrc déclenche un re-render → <video src={currentSrc}> sera mis à jour par React
      setCurrentSrc(direct);
      return;
    }
    setVideoError(true);
    onVideoError?.();
  }, [videoUrls, currentSrc, onVideoError]);

  if (videoError) return null;

  return (
    <div ref={containerRef} style={{ position: "absolute", inset: 0, background: "#000" }}>
      {/*
        ✅ FIX v7 — src géré impérativement via ref callback + useLayoutEffect.
        - PAS de src={} comme prop JSX : React ne re-set pas src si la valeur
          JSX n'a pas changé mais que le DOM a été recréé (StrictMode unmount/remount).
        - Le ref callback + useLayoutEffect (sans deps) forcent vid.src = currentSrc
          à chaque render, de façon synchrone avant le paint.
        - muted={true} en JSX sert à l'attribut HTML initial (accessibilité/autoplay),
          el.muted est ensuite géré impérativement.
      */}
      <video
        ref={setVideoRef}
        muted
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        preload={preloadStrat}
        playsInline
        loop
        crossOrigin={useCrossOrigin ? "anonymous" : undefined}
        onPlay={handlePlay}
        onPause={handlePause}
        onError={handleError}
      />
      {posterUrl && (
        <img src={posterUrl} alt=""
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none", zIndex: posterVisible ? 2 : -1, opacity: posterVisible ? 1 : 0, transition: isLCP ? "none" : "opacity 0.3s ease" }}
          loading={isLCP ? "eager" : "lazy"} decoding={isLCP ? "sync" : "async"} draggable="false" />
      )}
      {showBadge && <VideoSourceBadge url={url} />}
      {onOpenLightbox && (
        <button onClick={(e) => { e.stopPropagation(); onOpenLightbox(); }}
          style={{ position: "absolute", top: 8, right: 8, zIndex: 20, width: 30, height: 30, borderRadius: "50%", background: "rgba(0,0,0,0.55)", border: "1px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
          title="Plein écran">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="white"><path d="M3 3h6v2H5v4H3V3zm12 0h6v6h-2V5h-4V3zM3 15h2v4h4v2H3v-6zm16 4h-4v2h6v-6h-2v4z"/></svg>
        </button>
      )}
      <button ref={muteButtonRef} onClick={handleMuteClick}
        style={{ position: "absolute", bottom: 8, right: 8, zIndex: 20, width: 30, height: 30, borderRadius: "50%", background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.2)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
        dangerouslySetInnerHTML={{ __html: ICON_MUTED }} />
    </div>
  );
});
VideoItem.displayName = "VideoItem";

// ─────────────────────────────────────────────────────────────────────────────
// IMAGE ITEM
// ─────────────────────────────────────────────────────────────────────────────
const ImageItem = React.memo(({ url, isLCP, onOpenLightbox }) => {
  const [loaded, setLoaded] = useState(isLCP);
  return (
    <div style={{ position: "absolute", inset: 0, background: "#111", cursor: onOpenLightbox ? "zoom-in" : "default" }}
      onClick={onOpenLightbox ? (e) => { e.stopPropagation(); onOpenLightbox(); } : undefined}>
      <img src={url} alt=""
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", userSelect: "none", opacity: isLCP ? 1 : (loaded ? 1 : 0), transition: isLCP ? "none" : "opacity 0.2s ease" }}
        loading={isLCP ? "eager" : "lazy"} decoding={isLCP ? "sync" : "async"}
        onLoad={() => setLoaded(true)} onError={() => setLoaded(true)} draggable="false" />
    </div>
  );
});
ImageItem.displayName = "ImageItem";

// ─────────────────────────────────────────────────────────────────────────────
// MEDIA CELL
// ─────────────────────────────────────────────────────────────────────────────
const MediaCell = React.memo(({ url, slotType, posterUrl, isLCP, onRegisterVideoEl, slotIndex, showBadge, post, paddingBottom = "75%", overlay = null, wrapperStyle = {}, onVideoError, onOpenLightbox }) => {
  const embedThumbnail = useMemo(() => post?.thumbnail || getYouTubeThumbnail(url), [post?.thumbnail, url]);
  return (
    <div style={{ position: "relative", paddingBottom, overflow: "hidden", background: "#111", ...wrapperStyle }}>
      <div style={{ position: "absolute", inset: 0 }}>
        {slotType === "embed" ? (
          <EmbedItem url={url} thumbnail={embedThumbnail} title={post?.content?.substring(0, 60)} showBadge={showBadge} />
        ) : slotType === "hls" ? (
          <HLSItem thumbnail={post?.thumbnail} externalUrl={post?.sourceUrl} title={post?.content?.substring(0, 60)} />
        ) : slotType === "video" ? (
          <VideoItem url={url} posterUrl={posterUrl} isLCP={isLCP} initialMuted={true}
            onRegisterVideoEl={onRegisterVideoEl} slotIndex={slotIndex} showBadge={showBadge}
            onVideoError={onVideoError} onOpenLightbox={onOpenLightbox} />
        ) : (
          <ImageItem url={url} isLCP={isLCP} onOpenLightbox={onOpenLightbox} />
        )}
        {overlay && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10, cursor: onOpenLightbox ? "zoom-in" : "default" }}
            onClick={onOpenLightbox ? (e) => { e.stopPropagation(); onOpenLightbox(); } : undefined}>
            <span style={{ color: "white", fontSize: 26, fontWeight: 800, letterSpacing: -1 }}>{overlay}</span>
          </div>
        )}
      </div>
    </div>
  );
});
MediaCell.displayName = "MediaCell";

const MAX_PB = 177;
const useNaturalRatio = (url, slotType, fallbackPb) => {
  const [pb, setPb] = useState(null);
  useEffect(() => {
    if (!url || slotType === "embed" || slotType === "hls") { setPb(fallbackPb); return; }
    if (slotType === "image") {
      const img = new Image();
      img.onload  = () => { const r = img.naturalWidth && img.naturalHeight ? Math.min((img.naturalHeight / img.naturalWidth) * 100, MAX_PB) : parseFloat(fallbackPb); setPb(`${r}%`); };
      img.onerror = () => setPb(fallbackPb);
      img.src = url; return;
    }
    if (slotType === "video") {
      const vid = document.createElement("video"); vid.muted = true; vid.preload = "metadata";
      const cleanup = () => { vid.onloadedmetadata = null; vid.onerror = null; vid.src = ""; };
      vid.onloadedmetadata = () => { const r = vid.videoWidth && vid.videoHeight ? Math.min((vid.videoHeight / vid.videoWidth) * 100, MAX_PB) : parseFloat(fallbackPb); setPb(`${r}%`); cleanup(); };
      vid.onerror = () => { setPb(fallbackPb); cleanup(); };
      vid.src = url;
    }
  }, [url, slotType]); // eslint-disable-line
  return pb ?? fallbackPb;
};

const MediaCellAuto = React.memo((props) => {
  const { url, slotType } = props;
  const isVid    = slotType === "video" || slotType === "embed" || slotType === "hls";
  const fallback = isVid ? "56.25%" : "100%";
  const paddingBottom = useNaturalRatio(url, slotType, fallback);
  return <MediaCell {...props} paddingBottom={paddingBottom} />;
});
MediaCellAuto.displayName = "MediaCellAuto";

// ─────────────────────────────────────────────────────────────────────────────
// useMediaValidation v5 — stratégie hybride avec bypass DB complet
// ─────────────────────────────────────────────────────────────────────────────
const useMediaValidation = (urls, slotTypes, postMediaType = null) => {
  const [validIndices, setValidIndices] = useState(null);

  useEffect(() => {
    if (!urls.length) { setValidIndices([]); return; }
    let cancelled = false;
    setValidIndices(null);

    const safetyTimer = setTimeout(() => {
      dbgWarn(`useMediaValidation safety timer → all valid urls=${urls.join(",")}`);
      if (!cancelled) setValidIndices(urls.map((_, i) => i));
    }, 20000);

    const checks = urls.map((url, i) => {
      const type = slotTypes[i];
      dbg(`useMediaValidation check[${i}] type=${type} postMediaType=${postMediaType} url=${url}`);

      if (type === "embed" || type === "hls") return Promise.resolve({ i, ok: true });
      if (!url) return Promise.resolve({ i, ok: false });
      if (url.startsWith("blob:") || url.startsWith("data:")) return Promise.resolve({ i, ok: !!url });

      if (type === "image") {
        return new Promise((resolve) => {
          const img   = new Image();
          const timer = setTimeout(() => { dbgWarn(`useMediaValidation image timeout → hidden url=${url}`); resolve({ i, ok: false }); }, 5000);
          img.onload  = () => { clearTimeout(timer); dbg(`useMediaValidation image OK url=${url}`); resolve({ i, ok: true }); };
          img.onerror = () => { clearTimeout(timer); dbgWarn(`useMediaValidation image error → hidden url=${url}`); resolve({ i, ok: false }); };
          img.src = url;
        });
      }

      if (type === "video") {
        // CAS 1 — DB mediaType = "video" : confiance totale
        if (postMediaType === "video") {
          dbg(`useMediaValidation video CAS1 (DB mediaType) → valid url=${url}`);
          return Promise.resolve({ i, ok: true });
        }
        // CAS 2 — extension vidéo connue
        if (hasKnownVideoExtension(url)) {
          dbg(`useMediaValidation video CAS2 (known ext) → valid url=${url}`);
          return Promise.resolve({ i, ok: true });
        }
        // CAS 3 — URL sans extension → test canplay avec bénéfice du doute HTTPS
        dbg(`useMediaValidation video CAS3 (no ext, testing canplay) url=${url}`);
        return new Promise((resolve) => {
          let resolved = false;
          const vid    = document.createElement("video");
          vid.muted    = true;
          vid.preload  = "metadata";
          const cleanup = () => setTimeout(() => {
            try { vid.oncanplay = null; vid.onloadedmetadata = null; vid.onerror = null; vid.src = ""; } catch {}
          }, 0);
          const timer = setTimeout(() => {
            if (!resolved) {
              resolved = true;
              dbgWarn(`useMediaValidation video CAS3 timeout (10s) → valid (CDN slow) url=${url}`);
              resolve({ i, ok: true }); cleanup();
            }
          }, 10000);
          vid.oncanplay = () => {
            if (!resolved) { resolved = true; clearTimeout(timer); dbg(`useMediaValidation video CAS3 oncanplay → valid url=${url}`); resolve({ i, ok: true }); cleanup(); }
          };
          vid.onloadedmetadata = () => {
            if (!resolved) { resolved = true; clearTimeout(timer); dbg(`useMediaValidation video CAS3 onloadedmetadata → valid url=${url}`); resolve({ i, ok: true }); cleanup(); }
          };
          vid.onerror = () => {
            if (!resolved) {
              resolved = true; clearTimeout(timer);
              const isTrustedCDN = url.startsWith("https://");
              dbgWarn(`useMediaValidation video CAS3 onerror isTrustedCDN=${isTrustedCDN} → ok=${isTrustedCDN} url=${url}`);
              resolve({ i, ok: isTrustedCDN }); cleanup();
            }
          };
          vid.src = url;
        });
      }

      return Promise.resolve({ i, ok: true });
    });

    Promise.all(checks).then((results) => {
      if (cancelled) return;
      clearTimeout(safetyTimer);
      const valid = results.filter(r => r.ok).map(r => r.i);
      dbg(`useMediaValidation done valid=[${valid}] total=${urls.length}`);
      setValidIndices(valid);
    });

    return () => { cancelled = true; clearTimeout(safetyTimer); };
  }, [urls.join(","), slotTypes.join(","), postMediaType]); // eslint-disable-line

  return validIndices;
};

const MediaPlaceholder = React.memo(({ total }) => {
  const pb = total === 1 ? "75%" : total === 2 ? "50%" : "66%";
  return (
    <div style={{ width: "100%", paddingBottom: pb, background: "linear-gradient(135deg, #1a1a1a 0%, #222 100%)", borderRadius: 4, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.03) 50%, transparent 100%)", backgroundSize: "200% 100%", animation: "mediaShimmer 1.4s ease-in-out infinite" }} />
      <style>{`@keyframes mediaShimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}`}</style>
    </div>
  );
});
MediaPlaceholder.displayName = "MediaPlaceholder";

// ─────────────────────────────────────────────────────────────────────────────
// POST MEDIA — composant principal
// ─────────────────────────────────────────────────────────────────────────────
const GAP = 2;

const PostMedia = React.memo(({ mediaUrls, isFirstPost = false, priority = false, post = null }) => {
  if (post?.mediaType === "text-card") {
    const content = post.content || post.contenu || "";
    if (content.trim()) {
      return (
        <TextOnlyCard
          content={content}
          forceIndex={typeof post.textCardPalette === "number" ? post.textCardPalette : undefined}
        />
      );
    }
    return null;
  }

  const autoGenerated = !!post?.autoGenerated;
  const showBadge     = !autoGenerated;

  const videoRefsMap      = useRef({});
  const onRegisterVideoEl = useCallback((i, el) => {
    if (el) videoRefsMap.current[i] = el;
    else delete videoRefsMap.current[i];
  }, []);

  const [failedSlots,       setFailedSlots]       = useState(() => new Set());
  const [resolvedSlotTypes, setResolvedSlotTypes] = useState(null);
  const [lightboxIndex,     setLightboxIndex]     = useState(null);

  const markSlotFailed = useCallback((slotIndex) => {
    setFailedSlots(prev => { const next = new Set(prev); next.add(slotIndex); return next; });
  }, []);

  const safeMediaUrls = useMemo(() => {
    const seen = new Set(); const result = [];
    const add = (url) => {
      if (!url || typeof url !== "string") return;
      if (url.startsWith("blob:")) { if (!seen.has(url)) { seen.add(url); result.push(url); } return; }
      if (!url.startsWith("data:") && !isStructurallyValid(url)) return;
      // Filtrer les URLs de pages web sociales (mastodon/@user/id, pixelfed/p/user/id...)
      // qui ne sont pas des fichiers médias et causent des erreurs "Format error"
      if (isWebPageUrl(url)) { dbgWarn(`safeMediaUrls — filtered web page URL: ${url}`); return; }
      if (!seen.has(url)) { seen.add(url); result.push(url); }
    };
    if (Array.isArray(mediaUrls)) mediaUrls.filter(Boolean).forEach(add);
    if (post?.embedUrl)  add(post.embedUrl);
    if (post?.videoUrl)  add(post.videoUrl);
    if (post?.sourceUrl) add(post.sourceUrl);
    return result;
  }, [mediaUrls, post?.embedUrl, post?.videoUrl, post?.sourceUrl]);

  const isLCPSlot = isFirstPost || priority;
  const urls = useMemo(() => safeMediaUrls.map(getOptimizedUrl), [safeMediaUrls]);

  useEffect(() => {
    if (!urls.length) { setResolvedSlotTypes([]); return; }
    let cancelled = false;

    const initial = urls.map((url) => resolveSlotType(url, post?.mediaType));
    dbg(`PostMedia resolvedSlotTypes initial=[${initial}] postMediaType=${post?.mediaType} urls=${urls.join(",")}`);
    setResolvedSlotTypes(initial);

    const suspects = initial
      .map((type, i) => ({ type, i, url: urls[i] }))
      .filter(({ type, url }) => {
        if (post?.mediaType === "video") return false;
        if (type !== "image") return false;
        const hasKnownExt = hasKnownImageExtension(url) || hasKnownVideoExtension(url);
        return !hasKnownExt && (url || "").startsWith("http");
      });

    if (!suspects.length) return;

    dbg(`PostMedia HEAD-checking ${suspects.length} suspect(s): ${suspects.map(s => s.url).join(", ")}`);

    Promise.all(suspects.map(({ i, url }) => checkContentType(url).then(t => ({ i, type: t }))))
      .then((updates) => {
        if (cancelled) return;
        dbg(`PostMedia HEAD-check results: ${JSON.stringify(updates)}`);
        setResolvedSlotTypes(prev => {
          if (!prev) return prev;
          const next = [...prev];
          updates.forEach(({ i, type }) => {
            if (next[i] !== type) {
              dbg(`PostMedia slotType[${i}] changed: ${next[i]} → ${type} url=${urls[i]}`);
              next[i] = type;
            }
          });
          return next;
        });
      });

    return () => { cancelled = true; };
  }, [urls.join(","), post?.mediaType]); // eslint-disable-line

  const slotTypes  = resolvedSlotTypes ?? urls.map((url) => resolveSlotType(url, post?.mediaType));
  const posterUrls = useMemo(
    () => urls.map((url, i) => slotTypes[i] === "video" ? getVideoPosterUrl(url, post) : null),
    [urls, slotTypes, post]
  );

  const total = urls.length;
  const validIndices = useMediaValidation(urls, slotTypes, post?.mediaType);

  const activeIndices = useMemo(() => {
    if (!validIndices) return null;
    return validIndices.filter(i => !failedSlots.has(i));
  }, [validIndices, failedSlots]);

  const validUrls      = activeIndices ? activeIndices.map(i => urls[i])      : [];
  const validSlotTypes = activeIndices ? activeIndices.map(i => slotTypes[i]) : [];
  const validPosters   = activeIndices ? activeIndices.map(i => posterUrls[i]): [];
  const validTotal     = validUrls.length;

  const lightboxUrls = useMemo(() =>
    validUrls.filter((_, i) => validSlotTypes[i] === "image" || validSlotTypes[i] === "video"),
    [validUrls, validSlotTypes]
  );

  const getLightboxIndex = useCallback((slotIdx) => {
    const url = validUrls[slotIdx];
    return lightboxUrls.indexOf(url);
  }, [validUrls, lightboxUrls]);

  const openLightbox = useCallback((slotIdx) => {
    const lbIdx = getLightboxIndex(slotIdx);
    if (lbIdx >= 0) setLightboxIndex(lbIdx);
  }, [getLightboxIndex]);

  const cellProps = useCallback((i, extra = {}) => {
    const type = validSlotTypes[i];
    const canLightbox = type === "image" || type === "video";
    return {
      url: validUrls[i], slotType: type, posterUrl: validPosters[i],
      isLCP: isLCPSlot && i === 0, onRegisterVideoEl,
      slotIndex: activeIndices?.[i] ?? i, showBadge, post,
      onVideoError:   () => markSlotFailed(activeIndices?.[i] ?? i),
      onOpenLightbox: canLightbox ? () => openLightbox(i) : undefined,
      ...extra,
    };
  }, [validUrls, validSlotTypes, validPosters, isLCPSlot, onRegisterVideoEl, showBadge, post, activeIndices, markSlotFailed, openLightbox]); // eslint-disable-line

  if (!total) return null;
  if (activeIndices === null) return <MediaPlaceholder total={total} />;

  if (validTotal === 0) {
    const content = post?.content || post?.contenu || "";
    if (content.trim()) return <TextOnlyCard content={content} />;
    return null;
  }

  return (
    <>
      <AnimatePresence>
        {lightboxIndex !== null && lightboxUrls.length > 0 && (
          <MediaLightbox
            urls={lightboxUrls}
            initialIndex={lightboxIndex}
            onClose={() => setLightboxIndex(null)}
          />
        )}
      </AnimatePresence>

      {validTotal === 1 && <MediaCellAuto key="c0" {...cellProps(0)} />}

      {validTotal === 2 && (
        <div style={{ display: "flex", gap: GAP }}>
          <MediaCell key="c0" {...cellProps(0)} paddingBottom="100%" wrapperStyle={{ flex: 1 }} />
          <MediaCell key="c1" {...cellProps(1)} paddingBottom="100%" wrapperStyle={{ flex: 1 }} />
        </div>
      )}

      {validTotal === 3 && (
        <div style={{ display: "flex", gap: GAP, alignItems: "stretch" }}>
          <MediaCell key="c0" {...cellProps(0)} paddingBottom="133%" wrapperStyle={{ flex: 2 }} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: GAP }}>
            <MediaCell key="c1" {...cellProps(1)} paddingBottom="100%" />
            <MediaCell key="c2" {...cellProps(2)} paddingBottom="100%" />
          </div>
        </div>
      )}

      {validTotal === 4 && (
        <div style={{ display: "flex", flexDirection: "column", gap: GAP }}>
          <div style={{ display: "flex", gap: GAP }}>
            <MediaCell key="c0" {...cellProps(0)} paddingBottom="100%" wrapperStyle={{ flex: 1 }} />
            <MediaCell key="c1" {...cellProps(1)} paddingBottom="100%" wrapperStyle={{ flex: 1 }} />
          </div>
          <div style={{ display: "flex", gap: GAP }}>
            <MediaCell key="c2" {...cellProps(2)} paddingBottom="100%" wrapperStyle={{ flex: 1 }} />
            <MediaCell key="c3" {...cellProps(3)} paddingBottom="100%" wrapperStyle={{ flex: 1 }} />
          </div>
        </div>
      )}

      {validTotal >= 5 && (() => {
        const hidden  = validTotal - 5;
        const overlay = hidden > 0 ? `+${hidden}` : null;
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: GAP }}>
            <div style={{ display: "flex", gap: GAP, alignItems: "stretch" }}>
              <MediaCell key="c0" {...cellProps(0)} paddingBottom="75%" wrapperStyle={{ flex: 2 }} />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: GAP }}>
                <MediaCell key="c1" {...cellProps(1)} paddingBottom="75%" />
                <MediaCell key="c2" {...cellProps(2)} paddingBottom="75%" />
              </div>
            </div>
            <div style={{ display: "flex", gap: GAP }}>
              <MediaCell key="c3" {...cellProps(3)} paddingBottom="75%" wrapperStyle={{ flex: 1 }} />
              <MediaCell key="c4" {...cellProps(4)} paddingBottom="75%" wrapperStyle={{ flex: 1 }} overlay={overlay} />
            </div>
          </div>
        );
      })()}
    </>
  );
});

PostMedia.displayName = "PostMedia";
export default PostMedia;