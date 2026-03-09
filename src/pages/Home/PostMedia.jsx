// 📁 src/pages/Home/PostMedia.jsx
//
// ✅ FIX SLIDES NOIRES v14
//    - Root cause : le wrapper flex utilisait width:${total*100}% et transform:translateX(-${index*(100/total)}%)
//      Mais chaque slide avait width:slotH (px fixe). Mélange % et px = décalage incorrect
//      sur Safari iOS / Samsung Internet avec contain:layout dans le parent.
//    - Fix : wrapper et translateX passés en px absolus → width:${total*slotH}px
//      et transform:translateX(-${index*slotH}px). Plus aucune ambiguïté CSS.
//
// ✅ FIX SLIDES NOIRES v13 (conservé)
// ✅ FIX SLIDES NOIRES v12 (conservé)
// ✅ FIX CORS PEXELS v11
// ✅ FIX YOUTUBE v7
// 🔥 PREBUFFER VIDÉO (style TikTok)
// 🎯 VIDEO MANAGER GLOBAL (style TikTok)
// 🔥 FIX SWIPE v8
// ✅ FIX URLs INVALIDES v4

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { FaVolumeUp, FaVolumeMute, FaExternalLinkAlt } from "react-icons/fa";

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "dlymdclhe";
const IMG_BASE = `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/`;
const VID_BASE = `https://res.cloudinary.com/${CLOUD_NAME}/video/upload/`;

// ─────────────────────────────────────────────
// 🎯 VIDEO MANAGER GLOBAL
// ─────────────────────────────────────────────
let currentPlayingVideo = null;
const registerPlayingVideo = (video) => {
  if (!video) return;
  if (currentPlayingVideo && currentPlayingVideo !== video) {
    try { currentPlayingVideo.pause(); } catch {}
  }
  currentPlayingVideo = video;
};

// ─────────────────────────────────────────────
// 🔥 PREBUFFER VIDÉO GLOBAL
// ─────────────────────────────────────────────
const preloadedVideos = new Set();
const preloadVideo = (src) => {
  if (!src || preloadedVideos.has(src)) return;
  if (!/\.(mp4|webm|mov|avi)/i.test(src.split('?')[0])) return;
  const video = document.createElement("video");
  video.src = src; video.preload = "auto"; video.muted = true;
  preloadedVideos.add(src);
};

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
const isStructurallyValid = (url) => {
  if (!url || typeof url !== "string" || url.length < 10) return false;
  if (url.startsWith("data:") || url.startsWith("blob:") || url.startsWith("/")) return true;
  try { const u = new URL(url); return !!(u.hostname && u.pathname && u.pathname !== "/"); }
  catch { return false; }
};

const isVideoUrl     = url => url && /\.(mp4|webm|mov|avi)$/i.test(url.split('?')[0]);
const isHLSUrl       = url => url && /\.m3u8/i.test(url);
const isPexelsVideo  = url => url && url.includes('videos.pexels.com');
const isPixabayVideo = url => url && url.includes('cdn.pixabay.com/video');
const isExternalVideo= url => isPexelsVideo(url) || isPixabayVideo(url);
const isYouTubeUrl   = url => url && (url.includes('youtube.com') || url.includes('youtu.be'));
const needsCrossOrigin = url => url && url.includes('res.cloudinary.com');

const isEmbedUrl = url => url && (
  url.includes('player.vimeo.com') || url.includes('youtube.com/embed') ||
  url.includes('youtube.com/watch') || url.includes('youtu.be/') ||
  url.includes('dailymotion.com/embed')
);

const toEmbedUrl = (url) => {
  if (!url) return url;
  if (url.includes('youtube.com/embed')) return url.split('?')[0];
  const s = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (s) return `https://www.youtube.com/embed/${s[1]}`;
  const w = url.match(/youtube\.com\/watch\?(?:.*&)?v=([a-zA-Z0-9_-]{11})/);
  if (w) return `https://www.youtube.com/embed/${w[1]}`;
  return url;
};

const getYouTubeId = (url) => {
  if (!url) return null;
  const s = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);      if (s) return s[1];
  const e = url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/); if (e) return e[1];
  const w = url.match(/youtube\.com\/watch\?(?:.*&)?v=([a-zA-Z0-9_-]{11})/); if (w) return w[1];
  return null;
};

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const getVideoUrls = (url) => {
  if (!url) return { proxy: null, direct: null };
  if (isPexelsVideo(url) || isPixabayVideo(url))
    return { proxy: `${API_BASE}/api/proxy/video?url=${encodeURIComponent(url)}`, direct: null };
  return { proxy: null, direct: url };
};

const getVideoPosterUrl = (videoUrl, postData = null) => {
  if (!videoUrl) return null;
  if (postData?.thumbnail) return postData.thumbnail;
  try {
    if (videoUrl.includes('res.cloudinary.com')) {
      const idx = videoUrl.indexOf('/upload/'); if (idx === -1) return null;
      const after = videoUrl.substring(idx + 8);
      const segs  = after.split('/');
      const parts = [];
      for (const s of segs) {
        const isTx = s.includes(',') || (/^[a-z]+_[a-z]/.test(s) && !s.includes('.'));
        if (!isTx) parts.push(s);
      }
      const pub = parts.join('/').replace(/\.(mp4|webm|mov|avi)$/i, '');
      return pub ? `${IMG_BASE}q_auto:good,f_jpg,w_1080,c_limit,so_0/${pub}.jpg` : null;
    }
    if (isPexelsVideo(videoUrl)) {
      const m = videoUrl.match(/video-files\/(\d+)\//);
      return m ? `https://images.pexels.com/videos/${m[1]}/pictures/preview-0.jpg` : null;
    }
    if (isPixabayVideo(videoUrl)) {
      const t = videoUrl.replace('_large.mp4','_tiny.jpg').replace('_medium.mp4','_tiny.jpg').replace('_small.mp4','_tiny.jpg');
      return t !== videoUrl ? t : null;
    }
    return null;
  } catch { return null; }
};

const getYouTubeThumbnail = (url) => {
  const id = getYouTubeId(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
};

const getOptimizedUrl = (url, isLCP = false) => {
  if (!url) return null;
  if (url.startsWith('data:')) return url;
  if (isEmbedUrl(url) || isHLSUrl(url)) return toEmbedUrl(url);
  if (isExternalVideo(url)) return url;
  if (url.startsWith('http') && !url.includes('res.cloudinary.com')) return url;
  if (url.includes('res.cloudinary.com')) {
    if (url.includes('q_auto') || url.includes('w_1080')) return url;
    try {
      const idx = url.indexOf('/upload/');
      if (idx !== -1) {
        const after = url.substring(idx + 8);
        const first = after.split('/')[0];
        const pub   = (first.includes(',') || /^[a-z]_/.test(first)) ? after.substring(first.length + 1) : after;
        const vid   = isVideoUrl(pub);
        const base  = vid ? VID_BASE : IMG_BASE;
        if (vid)   return `${base}q_auto:good,f_auto,w_1080,c_limit/${pub}`;
        if (isLCP) return `${base}q_auto:good,f_auto,fl_progressive:steep,w_1080,c_limit/${pub}`;
        return `${base}q_auto,f_auto,fl_progressive:steep,w_1080,c_limit/${pub}`;
      }
    } catch { return url; }
  }
  const id  = url.replace(/^\/+/, '');
  const vid = isVideoUrl(id);
  if (vid)   return `${VID_BASE}q_auto:good,f_auto,w_1080,c_limit/${id}`;
  if (isLCP) return `${IMG_BASE}q_auto:good,f_auto,fl_progressive:steep,w_1080,c_limit/${id}`;
  return `${IMG_BASE}q_auto,f_auto,fl_progressive:steep,w_1080,c_limit/${id}`;
};

const resolveSlotType = (url, postMediaType = null) => {
  if (!url) return 'unknown';
  if (postMediaType === 'youtube') return 'embed';
  if (isEmbedUrl(url))             return 'embed';
  if (isHLSUrl(url))               return 'hls';
  if (isVideoUrl(url) || isExternalVideo(url)) return 'video';
  return 'image';
};

// ─────────────────────────────────────────────
// BADGE SOURCE
// ─────────────────────────────────────────────
const VideoSourceBadge = ({ url }) => {
  const info = useMemo(() => {
    if (isPexelsVideo(url))  return { label: 'Pexels',  bg: '#05A081' };
    if (isPixabayVideo(url)) return { label: 'Pixabay', bg: '#2EC66A' };
    if (isYouTubeUrl(url))   return { label: 'YouTube', bg: '#FF0000' };
    return null;
  }, [url]);
  if (!info) return null;
  return (
    <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-white text-[11px] font-bold pointer-events-none"
      style={{ background: info.bg, backdropFilter: 'blur(4px)', boxShadow: '0 1px 6px rgba(0,0,0,0.3)' }}>
      <svg viewBox="0 0 10 10" className="w-2.5 h-2.5" fill="white"><polygon points="2,1 9,5 2,9" /></svg>
      {info.label}
    </div>
  );
};

// ─────────────────────────────────────────────
// EMBED ITEM
// ─────────────────────────────────────────────
const EmbedItem = React.memo(({ url, thumbnail, title, showBadge = true, slotH }) => {
  const [showEmbed,    setShowEmbed]    = useState(false);
  const [thumbError,   setThumbError]   = useState(false);
  const [thumbLoaded,  setThumbLoaded]  = useState(false);
  const [thumbQuality, setThumbQuality] = useState('hq');
  const normalizedUrl = useMemo(() => toEmbedUrl(url), [url]);
  const resolvedThumb = useMemo(() => {
    if (thumbnail) return thumbnail;
    const id = getYouTubeId(url); if (!id) return null;
    if (thumbQuality === 'hq') return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
    if (thumbQuality === 'mq') return `https://img.youtube.com/vi/${id}/mqdefault.jpg`;
    if (thumbQuality === 'sd') return `https://img.youtube.com/vi/${id}/sddefault.jpg`;
    return null;
  }, [url, thumbnail, thumbQuality]);
  const handleThumbError = useCallback(() => {
    if (thumbQuality === 'hq') setThumbQuality('mq');
    else if (thumbQuality === 'mq') setThumbQuality('sd');
    else { setThumbQuality('error'); setThumbError(true); }
  }, [thumbQuality]);
  const embedSrc = useMemo(() => {
    if (!showEmbed) return '';
    if (url.includes('player.vimeo.com')) return `${url.split('?')[0]}?autoplay=1&muted=0`;
    if (isYouTubeUrl(url)) return `${normalizedUrl}?autoplay=1&rel=0&modestbranding=1`;
    return url;
  }, [showEmbed, url, normalizedUrl]);
  const hasThumbnail = resolvedThumb && !thumbError;

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {showEmbed ? (
        <iframe src={embedSrc} style={{ width: '100%', height: '100%' }} frameBorder="0"
          allow="autoplay; picture-in-picture" allowFullScreen title={title || 'Vidéo'}
          referrerPolicy="strict-origin-when-cross-origin" />
      ) : (
        <>
          {hasThumbnail ? (
            <>
              {!thumbLoaded && <div style={{ position: 'absolute', inset: 0, background: '#111', animation: 'pulse 1.5s ease-in-out infinite' }} />}
              <img src={resolvedThumb} alt={title || 'Vidéo'}
                style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: thumbLoaded ? 1 : 0, transition: 'opacity 0.25s' }}
                loading="lazy" decoding="async" onLoad={() => setThumbLoaded(true)} onError={handleThumbError} referrerPolicy="no-referrer" />
            </>
          ) : (
            <div style={{ width: '100%', height: '100%', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ color: '#555', fontSize: 48 }}>▶</div>
            </div>
          )}
          {hasThumbnail && thumbLoaded && (
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.6), rgba(0,0,0,0.1), transparent)', pointerEvents: 'none' }} />
          )}
          <button onClick={() => setShowEmbed(true)}
            style={{ position: 'absolute', inset: 0, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            aria-label="Lire la vidéo">
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(255,255,255,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.4)' }}>
              <div style={{ width: 0, height: 0, marginLeft: 6, borderTop: '13px solid transparent', borderBottom: '13px solid transparent', borderLeft: '22px solid #111' }} />
            </div>
          </button>
        </>
      )}
      {showBadge && <VideoSourceBadge url={url} />}
    </div>
  );
});
EmbedItem.displayName = 'EmbedItem';

// ─────────────────────────────────────────────
// HLS ITEM
// ─────────────────────────────────────────────
const HLSItem = React.memo(({ thumbnail, externalUrl, title }) => {
  const [imgError, setImgError] = useState(false);
  const hasThumbnail = thumbnail && !imgError;
  return (
    <div style={{ position: 'absolute', inset: 0, background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      {hasThumbnail ? (
        <img src={thumbnail} alt={title || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          loading="lazy" decoding="async" onError={() => setImgError(true)} />
      ) : (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, background: 'linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)' }}>
          <div style={{ width: 80, height: 80, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,69,0,0.15)', border: '2px solid rgba(255,69,0,0.4)' }}>
            <svg viewBox="0 0 24 24" style={{ width: 40, height: 40 }} fill="rgba(255,69,0,0.9)"><path d="M8 5v14l11-7z"/></svg>
          </div>
          {title && <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, textAlign: 'center', padding: '0 24px', maxWidth: 200 }}>{title}</p>}
        </div>
      )}
      {hasThumbnail && <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.2)' }} />}
      {externalUrl && (
        <a href={externalUrl} target="_blank" rel="noopener noreferrer"
          style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => e.stopPropagation()}>
          {hasThumbnail && (
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(255,69,0,0.85)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}>
              <svg viewBox="0 0 24 24" style={{ width: 32, height: 32, marginLeft: 4 }} fill="white"><path d="M8 5v14l11-7z"/></svg>
            </div>
          )}
        </a>
      )}
      <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 9999, background: 'rgba(255,69,0,0.85)', backdropFilter: 'blur(4px)', color: 'white', fontSize: 11, fontWeight: 700 }}>
        Reddit
      </div>
    </div>
  );
});
HLSItem.displayName = 'HLSItem';

// ─────────────────────────────────────────────
// VIDEO ITEM
// ─────────────────────────────────────────────
const VideoItem = React.memo(({ url, posterUrl, isLCP, isActive, isMuted, toggleMuteRef, slotIndex, videoRefCallback, showBadge = true }) => {
  const videoRef  = useRef(null);
  const videoUrls = useMemo(() => getVideoUrls(url), [url]);

  const [currentSrc,    setCurrentSrc]    = useState(() => videoUrls.proxy || videoUrls.direct);
  const [videoError,    setVideoError]    = useState(false);
  const [isPlaying,     setIsPlaying]     = useState(false);
  const [posterVisible, setPosterVisible] = useState(true);
  const [hasInteracted, setHasInteracted] = useState(false);

  const playAttempted = useRef(false);
  const fallbackTimer = useRef(null);
  const useCrossOrigin  = useMemo(() => needsCrossOrigin(url), [url]);
  const preloadStrategy = useMemo(() => { if (isLCP || isExternalVideo(url)) return 'auto'; return 'metadata'; }, [isLCP, url]);

  useEffect(() => () => clearTimeout(fallbackTimer.current), []);

  const setVideoRef = useCallback((el) => { videoRef.current = el; videoRefCallback?.(el); }, [videoRefCallback]);

  useEffect(() => {
    const vid = videoRef.current; if (!vid || hasInteracted) return;
    vid.muted = isMuted; vid.volume = isMuted ? 0 : 1;
  }, [isMuted, hasInteracted]);

  useEffect(() => {
    const vid = videoRef.current; if (!vid) return;
    if (isActive) {
      vid.muted = true; vid.volume = 0;
      setHasInteracted(false); setVideoError(false);
      if (!playAttempted.current) { playAttempted.current = true; vid.play().catch(() => {}); }
      fallbackTimer.current = setTimeout(() => { if (vid?.paused) { vid.muted = true; vid.volume = 0; vid.play().catch(() => {}); } }, 1500);
    } else {
      clearTimeout(fallbackTimer.current);
      playAttempted.current = false; setHasInteracted(false);
      vid.pause(); vid.currentTime = 0;
      setIsPlaying(false); setPosterVisible(true);
    }
    return () => clearTimeout(fallbackTimer.current);
  }, [isActive]); // eslint-disable-line

  useEffect(() => {
    const vid = videoRef.current; if (!vid || !isActive) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && e.intersectionRatio >= 0.1) { playAttempted.current = false; vid.muted = true; vid.volume = 0; vid.play().catch(() => {}); }
      else vid.pause();
    }, { threshold: [0.1, 0.5] });
    obs.observe(vid);
    return () => obs.disconnect();
  }, [isActive]);

  const handlePlay  = useCallback(() => { registerPlayingVideo(videoRef.current); setIsPlaying(true); setPosterVisible(false); }, []);
  const handlePause = useCallback(() => setIsPlaying(false), []);
  const handleError = useCallback(() => {
    const { proxy, direct } = videoUrls;
    if (currentSrc === proxy && direct) { setCurrentSrc(direct); const v = videoRef.current; if (v) { v.load(); if (isActive) v.play().catch(() => {}); } return; }
    setVideoError(true); setPosterVisible(false);
  }, [videoUrls, currentSrc, isActive]);

  const handleMuteClick = useCallback((e) => {
    e?.stopPropagation();
    const vid = videoRef.current; if (!vid) return;
    const newMuted = !vid.muted; vid.muted = newMuted; vid.volume = newMuted ? 0 : 1;
    setHasInteracted(true);
    if (!newMuted && vid.paused) {
      vid.play().then(() => toggleMuteRef?.current?.(slotIndex, false)).catch(() => { vid.muted = true; vid.volume = 0; toggleMuteRef?.current?.(slotIndex, true); });
      return;
    }
    toggleMuteRef?.current?.(slotIndex, newMuted);
  }, [toggleMuteRef, slotIndex]);

  const showSoundBadge = isActive && isPlaying && isMuted && !hasInteracted;

  if (videoError) return (
    <div style={{ position: 'absolute', inset: 0, background: '#111', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
      {posterUrl && <img src={posterUrl} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.3 }} />}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <div style={{ fontSize: 40 }}>📹</div>
        <p style={{ color: '#666', fontSize: 12 }}>Vidéo indisponible</p>
      </div>
    </div>
  );

  return (
    <div style={{ position: 'absolute', inset: 0, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <video ref={setVideoRef} src={currentSrc}
        style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
        preload={preloadStrategy} playsInline loop
        crossOrigin={useCrossOrigin ? 'anonymous' : undefined}
        onPlay={handlePlay} onPause={handlePause} onError={handleError} />

      {posterUrl && (
        <img src={posterUrl} alt=""
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none',
            zIndex: posterVisible ? 2 : -1, opacity: isLCP ? 1 : (posterVisible ? 1 : 0), transition: isLCP ? 'none' : 'opacity 0.3s ease' }}
          loading={isLCP ? 'eager' : 'lazy'} decoding={isLCP ? 'sync' : 'async'} draggable="false" />
      )}

      {showBadge && <VideoSourceBadge url={url} />}

      {isActive && (
        <button onClick={handleMuteClick}
          style={{ position: 'absolute', bottom: 12, right: 12, zIndex: 20, width: 36, height: 36, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
          aria-label={isMuted ? 'Activer le son' : 'Couper le son'}>
          {isMuted ? <FaVolumeMute style={{ fontSize: 14 }} /> : <FaVolumeUp style={{ fontSize: 14 }} />}
        </button>
      )}

      {showSoundBadge && (
        <button onClick={handleMuteClick}
          style={{ position: 'absolute', bottom: 12, left: 12, zIndex: 20, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 9999, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer', touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}>
          <FaVolumeUp style={{ fontSize: 12 }} /> Appuyer pour le son
        </button>
      )}
    </div>
  );
});
VideoItem.displayName = 'VideoItem';

// ─────────────────────────────────────────────
// IMAGE ITEM
// ─────────────────────────────────────────────
const ImageItem = React.memo(({ url, isLCP }) => {
  const [loaded, setLoaded] = useState(isLCP);
  return (
    <div style={{ position: 'absolute', inset: 0, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {!loaded && !isLCP && <div style={{ position: 'absolute', inset: 0, background: '#111' }} />}
      <img src={url} alt=""
        style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', userSelect: 'none',
          opacity: isLCP ? 1 : (loaded ? 1 : 0), transition: isLCP ? 'none' : 'opacity 0.2s ease' }}
        loading={isLCP ? 'eager' : 'lazy'} decoding={isLCP ? 'sync' : 'async'}
        onLoad={() => setLoaded(true)} onError={() => setLoaded(true)} draggable="false" />
    </div>
  );
});
ImageItem.displayName = 'ImageItem';

// ─────────────────────────────────────────────
// POST MEDIA
//
// ✅ FIX v14 — Architecture définitive carousel :
//
//   PROBLÈME v13 :
//     Le wrapper flex utilisait width:${total*100}% mais les slides avaient width:slotH (px).
//     Mélange de % et px → le translateX(-${index*(100/total)}%) est calculé en %
//     du wrapper (qui est en %), mais les slides ont des largeurs en px.
//     Sur Safari iOS / Samsung Internet avec contain:layout dans PostCardInner,
//     ce mélange produit des slides noires car le navigateur ne peut pas résoudre
//     correctement les dimensions des éléments hors-viewport.
//
//   SOLUTION v14 :
//     Tout en px absolus :
//       - wrapper : width = total * slotH (px)
//       - transform : translateX(-${index * slotH}px)
//       - chaque slide : width = slotH, height = slotH (px)
//     → Zéro dépendance sur la cascade CSS parent, zéro ambiguïté avec contain:layout.
// ─────────────────────────────────────────────
const PostMedia = React.memo(({ mediaUrls, isFirstPost = false, priority = false, post = null }) => {
  const autoGenerated = !!post?.autoGenerated;
  const showBadge     = !autoGenerated;

  const safeMediaUrls = useMemo(() => {
    const seen = new Set(); const result = [];
    const add = (url) => {
      if (!url || typeof url !== 'string') return;
      if (url.startsWith('blob:')) { if (!seen.has(url)) { seen.add(url); result.push(url); } return; }
      if (url.includes('videos.pexels.com') || url.includes('cdn.pixabay.com/video')) return;
      if (!url.startsWith('data:') && !isStructurallyValid(url)) return;
      if (!seen.has(url)) { seen.add(url); result.push(url); }
    };
    if (Array.isArray(mediaUrls)) mediaUrls.filter(Boolean).forEach(add);
    if (post?.embedUrl)  add(post.embedUrl);
    if (post?.videoUrl)  add(post.videoUrl);
    if (post?.sourceUrl) add(post.sourceUrl);
    return result;
  }, [mediaUrls, post?.embedUrl, post?.videoUrl, post?.sourceUrl]);

  if (!safeMediaUrls.length) return null;

  const [index,      setIndex]      = useState(0);
  const [isMutedMap, setIsMutedMap] = useState({});

  const toggleMuteRef = useRef(null);
  const isMutedMapRef = useRef({});
  const videoRefsMap  = useRef({});
  const containerRef  = useRef(null);
  const touch         = useRef({ x: 0, y: 0, time: 0 });
  const dirRef        = useRef(null);
  const isDragging    = useRef(false);
  const preloadImgRef = useRef(null);

  const isLCPSlot = isFirstPost || priority;

  const urls = useMemo(() =>
    safeMediaUrls.map((url, i) => getOptimizedUrl(url, isLCPSlot && i === 0)),
    [safeMediaUrls, isLCPSlot]
  );

  const slotTypes = useMemo(() =>
    urls.map((url, i) => resolveSlotType(url, i === 0 ? post?.mediaType : null)),
    [urls, post?.mediaType]
  );

  const posterUrls = useMemo(() =>
    urls.map((url, i) => slotTypes[i] === 'video' ? getVideoPosterUrl(url, post) : null),
    [urls, slotTypes, post]
  );

  const total = urls.length;

  useEffect(() => {
    const initial = {};
    urls.forEach((_, i) => { if (slotTypes[i] === 'video') initial[i] = true; });
    isMutedMapRef.current = initial; setIsMutedMap(initial);
  }, [urls.length]); // eslint-disable-line

  useEffect(() => {
    toggleMuteRef.current = (i, newMuted) => {
      const vid = videoRefsMap.current[i];
      if (vid) {
        vid.muted = newMuted; vid.volume = newMuted ? 0 : 1;
        if (!newMuted && vid.paused) {
          vid.play().catch(() => { vid.muted = true; vid.volume = 0; isMutedMapRef.current = {...isMutedMapRef.current,[i]:true}; setIsMutedMap(p=>({...p,[i]:true})); return; });
        }
      }
      isMutedMapRef.current = {...isMutedMapRef.current,[i]:newMuted};
      setIsMutedMap(p=>({...p,[i]:newMuted}));
    };
  });

  useEffect(() => {
    const next = urls[index + 1];
    if (next && slotTypes[index + 1] === 'video') preloadVideo(next);
    if (total > 1) {
      const nu = urls[(index + 1) % total];
      if (slotTypes[(index + 1) % total] === 'image' && nu && !nu.startsWith('data:')) {
        if (preloadImgRef.current) { preloadImgRef.current.src = ''; preloadImgRef.current = null; }
        const img = new Image(); img.src = nu; preloadImgRef.current = img;
      }
    }
    return () => { if (preloadImgRef.current) { preloadImgRef.current.src = ''; preloadImgRef.current = null; } };
  }, [index, urls, slotTypes, total]);

  const registerVideoRef = useCallback((i) => (el) => {
    if (el) videoRefsMap.current[i] = el; else delete videoRefsMap.current[i];
  }, []);

  // ✅ Swipe
  useEffect(() => {
    if (total <= 1) return;
    const el = containerRef.current; if (!el) return;
    const SWIPE_THRESHOLD = 40, TIME_THRESHOLD = 500, DIR_THRESHOLD = 8;
    let lastMoveY = 0;
    const onStart = e => { const t=e.touches?.[0]||e; touch.current={x:t.clientX,y:t.clientY,time:Date.now()}; lastMoveY=t.clientY; dirRef.current=null; isDragging.current=true; };
    const onMove  = e => {
      if (!isDragging.current||!touch.current.x) return;
      const t=e.touches?.[0]||e, dx=t.clientX-touch.current.x, dy=t.clientY-touch.current.y;
      if (dirRef.current===null&&(Math.abs(dx)>DIR_THRESHOLD||Math.abs(dy)>DIR_THRESHOLD)) dirRef.current=Math.abs(dx)>Math.abs(dy)?'h':'v';
      if (dirRef.current==='h') { if(e.cancelable) try{e.preventDefault()}catch{} }
      else if (dirRef.current==='v') { window.scrollBy({top:lastMoveY-t.clientY,behavior:'instant'}); lastMoveY=t.clientY; }
    };
    const onEnd = e => {
      if (!isDragging.current||!touch.current.x) return;
      const t=e.changedTouches?.[0]||e, dx=touch.current.x-t.clientX, elapsed=Date.now()-touch.current.time;
      if (dirRef.current==='h'&&Math.abs(dx)>SWIPE_THRESHOLD&&elapsed<TIME_THRESHOLD) setIndex(p=>dx>0?(p+1)%total:(p-1+total)%total);
      touch.current={x:0,y:0,time:0}; dirRef.current=null; isDragging.current=false; lastMoveY=0;
    };
    el.addEventListener('touchstart',onStart,{passive:true}); el.addEventListener('touchmove',onMove,{passive:false}); el.addEventListener('touchend',onEnd,{passive:true});
    el.addEventListener('mousedown',onStart); el.addEventListener('mousemove',onMove); el.addEventListener('mouseup',onEnd); el.addEventListener('mouseleave',onEnd);
    return () => { el.removeEventListener('touchstart',onStart); el.removeEventListener('touchmove',onMove); el.removeEventListener('touchend',onEnd); el.removeEventListener('mousedown',onStart); el.removeEventListener('mousemove',onMove); el.removeEventListener('mouseup',onEnd); el.removeEventListener('mouseleave',onEnd); };
  }, [total]);

  const goPrev = useCallback(() => setIndex(i=>(i-1+total)%total), [total]);
  const goNext = useCallback(() => setIndex(i=>(i+1)%total),       [total]);

  // ✅ FIX v13 : slotH en px — mesure la VRAIE largeur du container
  const [slotH, setSlotH] = useState(0);
  useEffect(() => {
    const el = containerRef.current; if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      const w = rect.width || el.offsetWidth || el.clientWidth;
      if (w > 0) setSlotH(w);
    };
    update();
    const ro = new ResizeObserver(() => update());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Placeholder pendant le calcul de la hauteur
  if (slotH === 0) {
    return (
      <div ref={containerRef} style={{ width: '100%', aspectRatio: '1/1', background: '#000' }} />
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        position:   'relative',
        width:      '100%',
        // Hauteur px explicite — indépendante de contain:layout du parent
        height:     slotH,
        background: '#000',
        overflow:   'hidden',
        userSelect: 'none',
        cursor:     total > 1 ? 'grab' : 'default',
        touchAction: total > 1 ? 'none' : 'pan-y pinch-zoom',
      }}
    >
      {/*
        ✅ FIX v14 — wrapper flex entièrement en px :
          width     = total * slotH  (px)   ← était total * 100% → mélange % + px enfants
          height    = slotH          (px)
          transform = translateX(-${index * slotH}px)  ← était -(index * 100/total)%

        Chaque slide = slotH × slotH px → dimensions absolues garanties.
        Plus aucune dépendance sur la cascade CSS du parent contain:layout.
      */}
      <div
        style={{
          position:      'absolute',
          top:           0,
          left:          0,
          display:       'flex',
          flexDirection: 'row',
          // ✅ FIX CLÉ v14 : px absolus au lieu de pourcentages
          width:         `${total * slotH}px`,
          height:        slotH,
          transform:     `translateX(-${index * slotH}px)`,
          transition:    'transform 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          willChange:    total > 1 ? 'transform' : 'auto',
        }}
      >
        {urls.map((url, i) => {
          const slotType       = slotTypes[i];
          const isLCP          = isLCPSlot && i === 0;
          const isMuted        = isMutedMap[i] !== false;
          const embedThumbnail = post?.thumbnail || getYouTubeThumbnail(url);

          return (
            <div
              key={i}
              style={{
                // ✅ FIX CLÉ v14 : width et height en px absolus
                // Garantit que position:absolute inset:0 des enfants
                // se résout correctement même avec contain:layout dans le parent.
                position:   'relative',
                flexShrink: 0,
                width:      slotH,
                height:     slotH,
                background: '#000',
                overflow:   'hidden',
              }}
            >
              {slotType === 'embed' ? (
                <EmbedItem url={url} thumbnail={embedThumbnail} title={post?.content?.substring(0, 60)} showBadge={showBadge} slotH={slotH} />
              ) : slotType === 'hls' ? (
                <HLSItem thumbnail={post?.thumbnail} externalUrl={post?.sourceUrl} title={post?.content?.substring(0, 60)} />
              ) : slotType === 'video' ? (
                <VideoItem url={url} posterUrl={posterUrls[i]} isLCP={isLCP} isActive={i === index} isMuted={isMuted}
                  toggleMuteRef={toggleMuteRef} slotIndex={i} videoRefCallback={registerVideoRef(i)} showBadge={showBadge} />
              ) : (
                <ImageItem url={url} isLCP={isLCP} />
              )}
            </div>
          );
        })}
      </div>

      {/* NAVIGATION */}
      {total > 1 && (
        <>
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: 64 }} className="sm:hidden" onClick={goPrev} />
          <div style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: 64 }} className="sm:hidden" onClick={goNext} />

          <button onClick={goPrev} className="hidden sm:flex"
            style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.5)', color: 'white', border: 'none', borderRadius: '50%', width: 44, height: 44, cursor: 'pointer', display: 'none', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}
            aria-label="Précédent">
            <svg style={{ width: 24, height: 24 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <button onClick={goNext} className="hidden sm:flex"
            style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.5)', color: 'white', border: 'none', borderRadius: '50%', width: 44, height: 44, cursor: 'pointer', display: 'none', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}
            aria-label="Suivant">
            <svg style={{ width: 24, height: 24 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>

          <div style={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 6, zIndex: 10 }}>
            {urls.map((_, i) => (
              <button key={i} onClick={() => setIndex(i)}
                style={{ width: i === index ? 20 : 8, height: 8, borderRadius: 4, background: i === index ? 'white' : 'rgba(255,255,255,0.5)', border: 'none', padding: 0, cursor: 'pointer', touchAction: 'manipulation', transition: 'width 0.2s ease, background-color 0.2s ease' }}
                aria-label={`Aller à l'image ${i + 1}`} />
            ))}
          </div>

          <div style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(0,0,0,0.6)', color: 'white', padding: '4px 10px', borderRadius: 9999, fontSize: 12, fontWeight: 600, zIndex: 10 }}>
            {index + 1}/{total}
          </div>
        </>
      )}
    </div>
  );
});

PostMedia.displayName = "PostMedia";
export default PostMedia;