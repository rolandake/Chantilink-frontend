// 📁 src/pages/profile/ProfileMediaGrid.jsx
// ✅ v7 — Miniatures robustes avec fallbacks multiples (R2 / stockage générique)
//
// CORRECTIONS v7 :
//   1. getMediaUrl — accepte toute URL R2 sans extension reconnue (fallback universel)
//   2. VideoThumbnail — suppression de crossOrigin="anonymous" qui bloque CORS sur R2
//   3. urlIsVideo — détection élargie aux chemins contenant /video/ ou /videos/
//   4. renderMedia dans GridCell — tente <img> sur toute URL disponible, même sans extension

import React, {
  useState, useEffect, useRef, useCallback, useMemo, memo
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  PlayIcon,
  PhotoIcon,
  HeartIcon,
  ChatBubbleLeftIcon,
  XMarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  BookmarkIcon,
  EllipsisHorizontalIcon,
  EyeIcon,
} from "@heroicons/react/24/solid";

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const VIDEO_EXTS = /\.(mp4|webm|mov|avi|mkv|flv|m4v)(\?|$)/i;
const IMG_EXTS   = /\.(jpe?g|png|gif|webp|avif|bmp|svg)(\?|$)/i;

const resolveItemUrl = (m) => {
  if (!m) return null;
  if (typeof m === "string") return m;
  return m.url || m.path || m.location || m.uri || m.src || null;
};

// ✅ FIX 3 : détection vidéo élargie aux chemins R2 contenant /video(s)/
const urlIsVideo = (url) => !!(url && (
  VIDEO_EXTS.test(url.split("?")[0]) ||
  /\/videos?\//i.test(url)
));

const urlIsImage = (url) => !!(url && IMG_EXTS.test(url.split("?")[0]));

// Thumbnail YouTube (si des liens YT sont embarqués dans des posts)
const youtubeThumb = (url) => {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/);
  return m ? `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg` : null;
};

// ✅ FIX 1 : getMediaUrl retourne toute URL disponible, même sans extension
// Le navigateur (et ImageThumbnail via onError) détermine si c'est chargeable
const getMediaUrl = (post) => {
  // 1. Champ thumbnail dédié (idéal : généré côté backend lors de l'upload)
  if (post?.thumbnail) return post.thumbnail;

  const mediaArr = Array.isArray(post?.media)  ? post.media
                 : Array.isArray(post?.images) ? post.images : [];

  // 2. Thumbnail explicite dans un objet media (ex: { url, thumbnail })
  for (const m of mediaArr) {
    if (typeof m === "object" && m !== null) {
      const t = m.thumbnail || m.thumb || m.poster || null;
      if (t) return t;
    }
  }

  // 3. Première URL image directe (extension reconnue)
  for (const m of mediaArr) {
    const url = resolveItemUrl(m);
    if (urlIsImage(url)) return url;
  }

  // 4. URL vidéo (extension ou chemin R2 reconnu) → VideoThumbnail capturera la frame
  for (const m of mediaArr) {
    const url = resolveItemUrl(m);
    if (urlIsVideo(url)) return url;
  }

  // 5. YouTube fallback
  for (const m of mediaArr) {
    const yt = youtubeThumb(resolveItemUrl(m) || "");
    if (yt) return yt;
  }

  // ✅ 6. Toute autre URL disponible (R2 sans extension, CDN custom, etc.)
  //    On retourne la première URL non-nulle — ImageThumbnail tentera de la charger
  for (const m of mediaArr) {
    const url = resolveItemUrl(m);
    if (url) return url;
  }

  return null;
};

const getPlayableUrl = (post) => {
  const mediaArr = Array.isArray(post?.media)  ? post.media
                 : Array.isArray(post?.images) ? post.images : [];
  if (mediaArr.length === 0) return null;
  return resolveItemUrl(mediaArr[0]);
};

const isVideo = (post) => {
  const type = post?.mediaType;
  if (type === "video" || type === "youtube") return true;
  const mediaArr = Array.isArray(post?.media)  ? post.media
                 : Array.isArray(post?.images) ? post.images : [];
  for (const m of mediaArr) {
    if (typeof m === "object" && m?.type?.startsWith("video")) return true;
    const url = resolveItemUrl(m);
    if (urlIsVideo(url)) return true;
    if (youtubeThumb(url)) return true;
  }
  return false;
};

const isMultiMedia = (post) => {
  const len = Array.isArray(post?.media)  ? post.media.length
            : Array.isArray(post?.images) ? post.images.length : 0;
  return len > 1;
};

const isTextCard = (post) => {
  if (post?.mediaType === "text-card") return true;
  const hasMedia = getMediaUrl(post);
  const content  = (post?.content || "").trim();
  return !hasMedia && content.length > 0 && content.length <= 120;
};

const formatCount = (n) => {
  if (!n) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return String(n);
};

const TEXT_PALETTES = [
  ["#1877F2","#0D5FCC"], ["#E4405F","#C13584"], ["#FF6B35","#F7C59F"],
  ["#2EC4B6","#0B7A75"], ["#6A0572","#AB83A1"], ["#1A1A2E","#16213E"],
  ["#2D6A4F","#52B788"], ["#8B2FC9","#5A108F"],
];

const FALLBACK_PALETTES = [
  ["#0f2027","#203a43","#2c5364"],
  ["#1a1a2e","#16213e","#0f3460"],
  ["#2c1810","#4a2c2a","#6b3a3a"],
  ["#0d1b2a","#1b263b","#415a77"],
  ["#1c1c1e","#2c2c2e","#3a3a3c"],
  ["#0a0a0a","#1a1a1a","#2a2a2a"],
];

const hashText = (str = "") => {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = Math.imul(31, h) + str.charCodeAt(i) | 0;
  return Math.abs(h);
};

const getTextPalette     = (str) => TEXT_PALETTES[hashText(str) % TEXT_PALETTES.length];
const getFallbackPalette = (str) => FALLBACK_PALETTES[hashText(str) % FALLBACK_PALETTES.length];

// ─────────────────────────────────────────────────────────────────────────────
// SQUELETTE
// ─────────────────────────────────────────────────────────────────────────────
const SkeletonCell = memo(({ isDarkMode }) => (
  <div
    className={`w-full ${isDarkMode ? "bg-gray-800" : "bg-gray-200"} animate-pulse`}
    style={{ aspectRatio: "9/16", borderRadius: 0 }}
  />
));
SkeletonCell.displayName = "SkeletonCell";

// ─────────────────────────────────────────────────────────────────────────────
// FALLBACK GÉNÉRIQUE
// ─────────────────────────────────────────────────────────────────────────────
const GenericFallback = memo(({ post, isVideoPost, compact = true }) => {
  const id = post?._id || post?.content || "";
  const [c1, c2, c3] = getFallbackPalette(id);
  const content   = (post?.content || "").trim();
  const shortText = content.length > 0 && content.length <= 80 ? content : null;

  return (
    <div style={{
      position: "absolute", inset: 0,
      background: `linear-gradient(160deg, ${c1} 0%, ${c2} 55%, ${c3} 100%)`,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      gap: compact ? 6 : 12, padding: compact ? 8 : 20,
      overflow: "hidden",
    }}>
      <div style={{
        position: "absolute",
        width: compact ? 80 : 160, height: compact ? 80 : 160,
        borderRadius: "50%",
        border: "1px solid rgba(255,255,255,0.07)",
        top: "10%", right: "-15%", pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute",
        width: compact ? 60 : 120, height: compact ? 60 : 120,
        borderRadius: "50%",
        border: "1px solid rgba(255,255,255,0.05)",
        bottom: "5%", left: "-10%", pointerEvents: "none",
      }} />

      {isVideoPost ? (
        <div style={{
          width: compact ? 36 : 56, height: compact ? 36 : 56,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.12)",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <PlayIcon style={{
            width: compact ? 16 : 26, height: compact ? 16 : 26,
            color: "rgba(255,255,255,0.65)", marginLeft: 2,
          }} />
        </div>
      ) : (
        <PhotoIcon style={{
          width: compact ? 22 : 40, height: compact ? 22 : 40,
          color: "rgba(255,255,255,0.2)", flexShrink: 0,
        }} />
      )}

      {shortText && (
        <p style={{
          color: "rgba(255,255,255,0.55)",
          fontSize: compact ? 9 : 13,
          fontWeight: 500,
          textAlign: "center",
          lineHeight: 1.35,
          margin: 0,
          overflow: "hidden",
          display: "-webkit-box",
          WebkitLineClamp: 3,
          WebkitBoxOrient: "vertical",
          wordBreak: "break-word",
          maxWidth: "90%",
        }}>{shortText}</p>
      )}
    </div>
  );
});
GenericFallback.displayName = "GenericFallback";

// ─────────────────────────────────────────────────────────────────────────────
// TEXT CARD MINIATURE
// ─────────────────────────────────────────────────────────────────────────────
const TextCardThumbnail = memo(({ post }) => {
  const content    = (post?.content || "").trim();
  const [from, to] = getTextPalette(content);
  return (
    <div style={{
      width: "100%", height: "100%",
      background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)`,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "8px", boxSizing: "border-box",
    }}>
      <p style={{
        color: "#fff", fontSize: "11px", fontWeight: 700,
        textAlign: "center", lineHeight: 1.3, margin: 0,
        overflow: "hidden", display: "-webkit-box",
        WebkitLineClamp: 4, WebkitBoxOrient: "vertical",
        wordBreak: "break-word",
      }}>{content}</p>
    </div>
  );
});
TextCardThumbnail.displayName = "TextCardThumbnail";

// ─────────────────────────────────────────────────────────────────────────────
// VIDEO THUMBNAIL — canvas capture 1ère frame
// ✅ FIX 2 : suppression de crossOrigin="anonymous" qui provoque des erreurs CORS sur R2
// ─────────────────────────────────────────────────────────────────────────────
const VideoThumbnail = memo(({ src, post, isDarkMode }) => {
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const [frame,  setFrame]  = useState(null);
  const [failed, setFailed] = useState(false);
  const [tried,  setTried]  = useState(false);

  useEffect(() => {
    if (!src) { setFailed(true); return; }
    const video = videoRef.current;
    if (!video) return;

    let timeout;
    const capture = () => {
      try {
        const canvas = canvasRef.current;
        if (!canvas) { setFailed(true); return; }
        canvas.width  = video.videoWidth  || 320;
        canvas.height = video.videoHeight || 568;
        canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
        // Vérifie que l'image n'est pas vide (toute noire / transparente)
        if (dataUrl.length > 5000) {
          setFrame(dataUrl);
        } else {
          setFailed(true);
        }
      } catch {
        setFailed(true);
      }
      setTried(true);
    };

    const onLoaded = () => { video.currentTime = 0.1; };
    const onSeeked = () => {
      capture();
      if (!frame) {
        setTimeout(() => {
          if (!frame && !failed) video.currentTime = 1;
        }, 300);
      }
    };
    const onError  = () => { setFailed(true); setTried(true); };

    timeout = setTimeout(() => {
      if (!tried) { setFailed(true); setTried(true); }
    }, 5000);

    video.addEventListener("loadeddata", onLoaded);
    video.addEventListener("seeked",     onSeeked);
    video.addEventListener("error",      onError);

    return () => {
      clearTimeout(timeout);
      video.removeEventListener("loadeddata", onLoaded);
      video.removeEventListener("seeked",     onSeeked);
      video.removeEventListener("error",      onError);
    };
  }, [src]);

  return (
    <>
      {/* ✅ FIX 2 : crossOrigin retiré — R2 ne l'autorise pas systématiquement */}
      <video
        ref={videoRef}
        src={src}
        muted
        playsInline
        preload="metadata"
        style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
      />
      <canvas ref={canvasRef} style={{ display: "none" }} />
      {frame ? (
        <img
          src={frame}
          alt=""
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : !failed ? (
        <div className={`absolute inset-0 animate-pulse ${isDarkMode ? "bg-gray-800" : "bg-gray-300"}`} />
      ) : (
        <GenericFallback post={post} isVideoPost compact />
      )}
    </>
  );
});
VideoThumbnail.displayName = "VideoThumbnail";

// ─────────────────────────────────────────────────────────────────────────────
// IMAGE THUMBNAIL avec chaîne de fallback
// Accepte désormais toute URL (même sans extension) grâce au fix getMediaUrl
// ─────────────────────────────────────────────────────────────────────────────
const ImageThumbnail = memo(({ post, primaryUrl, index, isDarkMode }) => {
  const [currentSrc, setCurrentSrc] = useState(primaryUrl);
  const [imgLoaded,  setImgLoaded]  = useState(false);
  const [failed,     setFailed]     = useState(false);
  const triedUrls = useRef(new Set([primaryUrl]));

  const fallbackUrls = useMemo(() => {
    const urls = [];
    const mediaArr = Array.isArray(post?.media)  ? post.media
                   : Array.isArray(post?.images) ? post.images : [];

    for (const m of mediaArr) {
      const url = resolveItemUrl(m);
      if (url && urlIsImage(url) && url !== primaryUrl) urls.push(url);
    }

    const playable = getPlayableUrl(post);
    const yt = youtubeThumb(playable || "");
    if (yt && yt !== primaryUrl) urls.push(yt);

    // ✅ Inclut toutes les URLs restantes (vidéo R2, URL sans extension…)
    for (const m of mediaArr) {
      const url = resolveItemUrl(m);
      if (url && url !== primaryUrl && !urls.includes(url)) urls.push(url);
    }

    return urls.filter((u) => u && !triedUrls.current.has(u));
  }, [post, primaryUrl]);

  const fallbackIndex = useRef(0);

  const handleError = useCallback(() => {
    const nextUrl = fallbackUrls[fallbackIndex.current];
    if (nextUrl) {
      triedUrls.current.add(nextUrl);
      fallbackIndex.current += 1;
      setCurrentSrc(nextUrl);
      setImgLoaded(false);
    } else {
      setFailed(true);
    }
  }, [fallbackUrls]);

  if (failed) {
    return <GenericFallback post={post} isVideoPost={false} compact />;
  }

  return (
    <>
      {!imgLoaded && (
        <div className={`absolute inset-0 animate-pulse ${isDarkMode ? "bg-gray-800" : "bg-gray-300"}`} />
      )}
      <img
        src={currentSrc}
        alt=""
        loading={index < 9 ? "eager" : "lazy"}
        decoding={index < 9 ? "sync" : "async"}
        style={{
          position: "absolute", inset: 0, width: "100%", height: "100%",
          objectFit: "cover", opacity: imgLoaded ? 1 : 0, transition: "opacity 0.2s ease",
        }}
        onLoad={() => setImgLoaded(true)}
        onError={handleError}
      />
    </>
  );
});
ImageThumbnail.displayName = "ImageThumbnail";

// ─────────────────────────────────────────────────────────────────────────────
// CELLULE GRILLE
// ✅ FIX 4 : renderMedia tente <img> sur toute URL disponible, même sans extension
// ─────────────────────────────────────────────────────────────────────────────
const GridCell = memo(({ post, index, onClick, isDarkMode, isLarge = false, isPinned = false }) => {
  const [isHovered, setIsHovered] = useState(false);

  const mediaUrl    = getMediaUrl(post);
  const playableUrl = getPlayableUrl(post);
  const videoPost   = isVideo(post);
  const multiMedia  = isMultiMedia(post);
  const textCard    = isTextCard(post);

  // needCanvas : seulement si c'est une vidéo avec extension reconnue
  // ✅ FIX 4 : une URL R2 sans extension va dans ImageThumbnail (pas VideoThumbnail)
  //   car le navigateur peut la charger comme image directement
  const needCanvas = videoPost && mediaUrl && urlIsVideo(mediaUrl);
  const videoSrc   = needCanvas ? mediaUrl : (videoPost ? playableUrl : null);

  const viewsCount    = Array.isArray(post?.views)    ? post.views.length    : (post?.viewsCount    || post?.views    || 0);
  const likesCount    = Array.isArray(post?.likes)    ? post.likes.length    : (post?.likesCount    || 0);
  const commentsCount = Array.isArray(post?.comments) ? post.comments.length : (post?.commentsCount || 0);

  const renderMedia = () => {
    if (textCard) {
      return <div style={{ position: "absolute", inset: 0 }}><TextCardThumbnail post={post} /></div>;
    }
    // Vidéo avec URL vidéo reconnue → capture canvas
    if (needCanvas && videoSrc) {
      return <VideoThumbnail src={videoSrc} post={post} isDarkMode={isDarkMode} />;
    }
    // ✅ Toute URL disponible (image, R2 sans extension, YouTube thumb…) → ImageThumbnail
    if (mediaUrl) {
      return <ImageThumbnail post={post} primaryUrl={mediaUrl} index={index} isDarkMode={isDarkMode} />;
    }
    return <GenericFallback post={post} isVideoPost={videoPost} compact />;
  };

  return (
    <motion.div
      className="relative overflow-hidden cursor-pointer select-none"
      style={{
        gridColumn: isLarge ? "span 2" : "span 1",
        gridRow:    isLarge ? "span 2" : "span 1",
        aspectRatio: "9 / 16",
        background: isDarkMode ? "#111" : "#f3f3f3",
      }}
      whileTap={{ scale: 0.97 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      onClick={() => onClick(post, index)}
    >
      {renderMedia()}

      {/* Gradient overlay bas */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: "40%",
        background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 100%)",
        pointerEvents: "none", zIndex: 5,
      }} />

      {isPinned && (
        <div style={{
          position: "absolute", top: 6, left: 6, zIndex: 15,
          background: "rgba(251,146,60,0.92)", borderRadius: 4, padding: "2px 6px",
        }}>
          <span style={{ fontSize: 9, fontWeight: 800, color: "white", letterSpacing: 0.5, textTransform: "uppercase" }}>
            Épinglé
          </span>
        </div>
      )}

      {videoPost && (
        <div style={{ position: "absolute", top: isPinned ? 28 : 6, right: 6, zIndex: 10, pointerEvents: "none" }}>
          <PlayIcon style={{ width: 14, height: 14, color: "white", filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.8))" }} />
        </div>
      )}

      {multiMedia && !videoPost && (
        <div style={{ position: "absolute", top: isPinned ? 28 : 6, right: 6, zIndex: 10, pointerEvents: "none" }}>
          <svg viewBox="0 0 20 20" style={{ width: 14, height: 14, filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.8))" }} fill="white">
            <rect x="2" y="2" width="8" height="8" rx="1.5" />
            <rect x="11" y="2" width="7" height="7" rx="1.5" />
            <rect x="2" y="11" width="7" height="7" rx="1.5" />
            <rect x="11" y="10" width="8" height="8" rx="1.5" />
          </svg>
        </div>
      )}

      <div style={{
        position: "absolute", bottom: 6, left: 6, zIndex: 10,
        display: "flex", alignItems: "center", gap: 3, pointerEvents: "none",
      }}>
        {videoPost ? (
          <>
            <PlayIcon style={{ width: 12, height: 12, color: "rgba(255,255,255,0.9)" }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.95)", textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>
              {formatCount(viewsCount)}
            </span>
          </>
        ) : (
          <>
            <HeartIcon style={{ width: 11, height: 11, color: "rgba(255,255,255,0.9)" }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.95)", textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>
              {formatCount(likesCount)}
            </span>
          </>
        )}
      </div>

      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{
              position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)",
              display: "flex", alignItems: "center", justifyContent: "center",
              gap: 20, zIndex: 20,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 5, color: "white" }}>
              <HeartIcon style={{ width: 18, height: 18 }} />
              <span style={{ fontSize: 13, fontWeight: 700 }}>{formatCount(likesCount)}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, color: "white" }}>
              <ChatBubbleLeftIcon style={{ width: 18, height: 18 }} />
              <span style={{ fontSize: 13, fontWeight: 700 }}>{formatCount(commentsCount)}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});
GridCell.displayName = "GridCell";

// ─────────────────────────────────────────────────────────────────────────────
// SORT TABS
// ─────────────────────────────────────────────────────────────────────────────
const SORT_TABS = [
  { key: "recent",  label: "Dernier" },
  { key: "popular", label: "Populaire" },
  { key: "oldest",  label: "Le plus ancien" },
];

const SortTabs = memo(({ activeSort, onSort, isDarkMode }) => (
  <div style={{
    display: "flex", gap: 4, padding: "8px 0 12px",
    borderBottom: isDarkMode ? "1px solid rgba(255,255,255,0.07)" : "1px solid #e5e7eb",
    marginBottom: 2,
  }}>
    {SORT_TABS.map(tab => (
      <button key={tab.key} onClick={() => onSort(tab.key)} style={{
        padding: "5px 14px", borderRadius: 20, border: "none", cursor: "pointer",
        fontSize: 13,
        fontWeight: activeSort === tab.key ? 700 : 500,
        background: activeSort === tab.key ? (isDarkMode ? "rgba(251,146,60,0.18)" : "#fff3e8") : "transparent",
        color: activeSort === tab.key ? "#fb923c" : (isDarkMode ? "#9ca3af" : "#6b7280"),
        transition: "all 0.15s ease", outline: "none",
      }}>
        {tab.label}
      </button>
    ))}
  </div>
));
SortTabs.displayName = "SortTabs";

// ─────────────────────────────────────────────────────────────────────────────
// LIGHTBOX FULLSCREEN — style TikTok
// ─────────────────────────────────────────────────────────────────────────────
const PostLightbox = memo(({ allPosts, startIndex, onClose, isDarkMode }) => {
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const touchStartY = useRef(null);
  const touchStartX = useRef(null);
  const videoRef    = useRef(null);

  const post          = allPosts[currentIndex];
  const playableUrl   = getPlayableUrl(post);
  const mediaUrl      = getMediaUrl(post);
  const videoPost     = isVideo(post);
  const textCard      = isTextCard(post);
  const likesCount    = Array.isArray(post?.likes)    ? post.likes.length    : (post?.likesCount    || 0);
  const commentsCount = Array.isArray(post?.comments) ? post.comments.length : (post?.commentsCount || 0);
  const viewsCount    = Array.isArray(post?.views)    ? post.views.length    : (post?.viewsCount    || post?.views || 0);
  const content       = (post?.content || "").trim();
  const username      = post?.user?.fullName || post?.user?.username || "Utilisateur";
  const avatar        = post?.user?.profilePhoto || null;

  const [from, to] = getTextPalette(content);

  const goNext = useCallback(() => {
    if (currentIndex < allPosts.length - 1) setCurrentIndex(i => i + 1);
  }, [currentIndex, allPosts.length]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) setCurrentIndex(i => i - 1);
  }, [currentIndex]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape")     onClose();
      if (e.key === "ArrowRight" || e.key === "ArrowDown")  goNext();
      if (e.key === "ArrowLeft"  || e.key === "ArrowUp")    goPrev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, goNext, goPrev]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const handleTouchStart = (e) => {
    touchStartY.current = e.touches[0].clientY;
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e) => {
    const dy = (touchStartY.current ?? 0) - e.changedTouches[0].clientY;
    const dx = (touchStartX.current ?? 0) - e.changedTouches[0].clientX;
    if (Math.abs(dy) > Math.abs(dx)) {
      if (dy >  50) goNext();
      if (dy < -50) goPrev();
    } else {
      if (dx >  50) goNext();
      if (dx < -50) goPrev();
    }
    touchStartY.current = null;
    touchStartX.current = null;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: "fixed", inset: 0, zIndex: 99999,
        background: "#000",
        display: "flex", flexDirection: "column",
        touchAction: "none",
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* ── HEADER ── */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0,
        zIndex: 30,
        padding: "env(safe-area-inset-top, 12px) 16px 12px",
        background: "linear-gradient(to bottom, rgba(0,0,0,0.65) 0%, transparent 100%)",
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <button onClick={onClose} style={{
          background: "none", border: "none", cursor: "pointer",
          display: "flex", alignItems: "center", gap: 6, color: "white", padding: 0,
        }}>
          <ChevronLeftIcon style={{ width: 24, height: 24, color: "white" }} />
          <span style={{ fontSize: 15, fontWeight: 600 }}>Retour</span>
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
          {avatar ? (
            <img src={avatar} alt={username} style={{
              width: 32, height: 32, borderRadius: "50%", objectFit: "cover",
              border: "2px solid rgba(255,255,255,0.6)",
            }} />
          ) : (
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              background: "linear-gradient(135deg, #fb923c, #ec4899)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "white", fontSize: 13, fontWeight: 700, flexShrink: 0,
            }}>
              {(username[0] || "?").toUpperCase()}
            </div>
          )}
          <span style={{ color: "white", fontWeight: 700, fontSize: 14 }}>{username}</span>
        </div>

        <button style={{
          background: "none", border: "none", cursor: "pointer", marginLeft: 8, color: "white",
        }}>
          <EllipsisHorizontalIcon style={{ width: 22, height: 22 }} />
        </button>
      </div>

      {/* ── MÉDIA FULLSCREEN ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.02 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          {textCard ? (
            <div style={{
              width: "100%", height: "100%",
              background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)`,
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: "40px 32px",
            }}>
              <p style={{
                color: "#fff", fontSize: "clamp(22px, 5vw, 36px)", fontWeight: 800,
                textAlign: "center", lineHeight: 1.4, margin: 0, wordBreak: "break-word",
              }}>
                {content}
              </p>
            </div>
          ) : playableUrl && videoPost ? (
            <video
              ref={videoRef}
              key={playableUrl}
              src={playableUrl}
              controls
              playsInline
              autoPlay
              style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", background: "#000" }}
            />
          ) : (playableUrl || mediaUrl) ? (
            <img
              key={playableUrl || mediaUrl}
              src={playableUrl || mediaUrl}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
            />
          ) : (
            <GenericFallback post={post} isVideoPost={videoPost} compact={false} />
          )}
        </motion.div>
      </AnimatePresence>

      {/* ── OVERLAY INFOS BAS ── */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        zIndex: 30,
        padding: "80px 16px env(safe-area-inset-bottom, 20px) 16px",
        background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 100%)",
        pointerEvents: "none",
      }}>
        {content && !textCard && (
          <p style={{
            color: "white", fontSize: 14, lineHeight: 1.5, margin: "0 0 12px",
            overflow: "hidden", display: "-webkit-box",
            WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
          }}>
            <span style={{ fontWeight: 700, marginRight: 6 }}>{username}</span>
            {content}
          </p>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 20, pointerEvents: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "white" }}>
            <HeartIcon style={{ width: 22, height: 22, color: "#ef4444" }} />
            <span style={{ fontSize: 14, fontWeight: 700 }}>{formatCount(likesCount)}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "white" }}>
            <ChatBubbleLeftIcon style={{ width: 22, height: 22 }} />
            <span style={{ fontSize: 14, fontWeight: 700 }}>{formatCount(commentsCount)}</span>
          </div>
          {viewsCount > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,0.7)" }}>
              <EyeIcon style={{ width: 20, height: 20 }} />
              <span style={{ fontSize: 13, fontWeight: 600 }}>{formatCount(viewsCount)}</span>
            </div>
          )}
          <div style={{ marginLeft: "auto" }}>
            <BookmarkIcon style={{ width: 22, height: 22, color: "rgba(255,255,255,0.8)" }} />
          </div>
        </div>
      </div>

      {/* ── NAV ── */}
      <div style={{
        position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)",
        zIndex: 30, display: "flex", flexDirection: "column", gap: 8,
      }}>
        <button
          onClick={goPrev}
          disabled={currentIndex === 0}
          style={{
            width: 44, height: 44, borderRadius: "50%",
            background: currentIndex === 0 ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.2)",
            border: "none", cursor: currentIndex === 0 ? "default" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            backdropFilter: "blur(8px)",
            opacity: currentIndex === 0 ? 0.4 : 1,
            transition: "opacity 0.2s",
          }}
        >
          <ChevronLeftIcon style={{ width: 22, height: 22, color: "white", transform: "rotate(90deg)" }} />
        </button>
        <button
          onClick={goNext}
          disabled={currentIndex === allPosts.length - 1}
          style={{
            width: 44, height: 44, borderRadius: "50%",
            background: currentIndex === allPosts.length - 1 ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.2)",
            border: "none", cursor: currentIndex === allPosts.length - 1 ? "default" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            backdropFilter: "blur(8px)",
            opacity: currentIndex === allPosts.length - 1 ? 0.4 : 1,
            transition: "opacity 0.2s",
          }}
        >
          <ChevronLeftIcon style={{ width: 22, height: 22, color: "white", transform: "rotate(-90deg)" }} />
        </button>
      </div>

      <div style={{
        position: "absolute", bottom: "calc(env(safe-area-inset-bottom, 20px) + 60px)",
        left: "50%", transform: "translateX(-50%)",
        zIndex: 30,
        background: "rgba(0,0,0,0.45)", borderRadius: 20,
        padding: "3px 10px",
        color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: 600,
      }}>
        {currentIndex + 1} / {allPosts.length}
      </div>
    </motion.div>
  );
});
PostLightbox.displayName = "PostLightbox";

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSANT PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
const ProfileMediaGrid = ({
  posts = [],
  isDarkMode = false,
  isLoading = false,
  hasMore = false,
  onLoadMore,
  featuredFirst = false,
  emptyMessage = null,
  isOwner = false,
  pinnedPostIds = [],
}) => {
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [sortKey,       setSortKey]       = useState("recent");
  const sentinelRef = useRef(null);

  useEffect(() => {
    if (!sentinelRef.current || !onLoadMore || !hasMore) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) onLoadMore(); },
      { rootMargin: "300px" }
    );
    obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  }, [hasMore, onLoadMore]);

  const handleCellClick       = useCallback((_, index) => setLightboxIndex(index), []);
  const handleCloseLightbox   = useCallback(() => setLightboxIndex(null), []);

  const sortedPosts = useMemo(() => {
    const arr = [...posts];
    if (sortKey === "popular") {
      return arr.sort((a, b) => {
        const score = (p) =>
          (Array.isArray(p.likes) ? p.likes.length : p.likesCount || 0) +
          (Array.isArray(p.views) ? p.views.length : p.viewsCount || p.views || 0);
        return score(b) - score(a);
      });
    }
    if (sortKey === "oldest") return arr.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    return arr.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [posts, sortKey]);

  const pinnedSet = useMemo(() => new Set(pinnedPostIds), [pinnedPostIds]);

  const displayPosts = useMemo(() => {
    if (sortKey !== "recent" || pinnedSet.size === 0) return sortedPosts;
    const pinned = sortedPosts.filter(p => pinnedSet.has(p._id));
    const rest   = sortedPosts.filter(p => !pinnedSet.has(p._id));
    return [...pinned, ...rest];
  }, [sortedPosts, sortKey, pinnedSet]);

  if (!isLoading && displayPosts.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "48px 24px", color: isDarkMode ? "#6b7280" : "#9ca3af" }}>
        <PhotoIcon style={{ width: 56, height: 56, margin: "0 auto 16px", opacity: 0.4 }} />
        <p style={{ fontWeight: 600, fontSize: 15, color: isDarkMode ? "#9ca3af" : "#6b7280", margin: "0 0 6px" }}>
          {isOwner ? "Aucune publication" : "Pas encore de publications"}
        </p>
        <p style={{ fontSize: 13, margin: 0 }}>
          {emptyMessage || (isOwner ? "Publie des photos et vidéos pour les voir ici." : "Les publications apparaîtront ici.")}
        </p>
      </div>
    );
  }

  return (
    <>
      <SortTabs activeSort={sortKey} onSort={setSortKey} isDarkMode={isDarkMode} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "2px", width: "100%" }}>
        {isLoading && displayPosts.length === 0
          ? Array.from({ length: 12 }).map((_, i) => <SkeletonCell key={i} isDarkMode={isDarkMode} />)
          : displayPosts.map((post, index) => (
              <GridCell
                key={post._id || index}
                post={post}
                index={index}
                onClick={handleCellClick}
                isDarkMode={isDarkMode}
                isLarge={featuredFirst && index === 0}
                isPinned={pinnedSet.has(post._id)}
              />
            ))
        }
        {isLoading && displayPosts.length > 0 &&
          Array.from({ length: 6 }).map((_, i) => <SkeletonCell key={`sk-${i}`} isDarkMode={isDarkMode} />)
        }
      </div>

      {hasMore && <div ref={sentinelRef} style={{ height: 1 }} />}

      <AnimatePresence>
        {lightboxIndex !== null && (
          <PostLightbox
            allPosts={displayPosts}
            startIndex={lightboxIndex}
            onClose={handleCloseLightbox}
            isDarkMode={isDarkMode}
          />
        )}
      </AnimatePresence>
    </>
  );
};

export default memo(ProfileMediaGrid);