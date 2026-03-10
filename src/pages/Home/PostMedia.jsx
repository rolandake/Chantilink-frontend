// 📁 src/pages/Home/PostMedia.jsx
//
// ✅ GRID LAYOUT v19 — anti-flash médias défaillants
//
//  STRATÉGIE ANTI-RE-RENDER :
//  1. isMutedMap → ref pure (isMutedRef) + manipulation DOM directe sur <video>
//     → setIsMutedMap supprimé → mute/unmute ne re-render PLUS rien
//  2. Lightbox → état dans un ref + createPortal monté une seule fois
//     → ouverture/fermeture via CSS visibility/opacity, pas via setState dans PostMedia
//  3. toggleMuteRef.current → useCallback stable avec refs internes
//  4. cell() → props calculées une seule fois par useMemo stable
//  5. onCellClick → ref stable, jamais recréé
//
//  ✅ FIX v19 : useMediaValidation commence à null (pas optimiste)
//     → placeholder gris pendant la validation (~100-300ms)
//     → les médias apparaissent proprement, sans flash de retrait visible
//     → safetyTimer 300ms garantit qu'on ne bloque jamais trop longtemps
//
// ✅ Conserve : VideoManager global, Prebuffer, CORS Pexels, YouTube embed, Lightbox plein écran

import React, {
  useState, useRef, useEffect, useCallback, useMemo
} from "react";
import { createPortal } from "react-dom";
import { FaVolumeUp, FaVolumeMute, FaTimes, FaChevronLeft, FaChevronRight } from "react-icons/fa";

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "dlymdclhe";
const IMG_BASE = `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/`;
const VID_BASE = `https://res.cloudinary.com/${CLOUD_NAME}/video/upload/`;

// ─────────────────────────────────────────────
// VIDEO MANAGER GLOBAL
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
// PREBUFFER VIDÉO GLOBAL
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

const isVideoUrl       = url => url && /\.(mp4|webm|mov|avi)$/i.test(url.split('?')[0]);
const isHLSUrl         = url => url && /\.m3u8/i.test(url);
const isPexelsVideo    = url => url && url.includes('videos.pexels.com');
const isPixabayVideo   = url => url && url.includes('cdn.pixabay.com/video');
const isExternalVideo  = url => isPexelsVideo(url) || isPixabayVideo(url);
const isYouTubeUrl     = url => url && (url.includes('youtube.com') || url.includes('youtu.be'));
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
  const s = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);           if (s) return s[1];
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
      const segs = after.split('/'); const parts = [];
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
      const t = videoUrl
        .replace('_large.mp4', '_tiny.jpg')
        .replace('_medium.mp4', '_tiny.jpg')
        .replace('_small.mp4', '_tiny.jpg');
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
        const pub = (first.includes(',') || /^[a-z]_/.test(first)) ? after.substring(first.length + 1) : after;
        const vid = isVideoUrl(pub);
        const base = vid ? VID_BASE : IMG_BASE;
        if (vid)   return `${base}q_auto:good,f_auto,w_1080,c_limit/${pub}`;
        if (isLCP) return `${base}q_auto:good,f_auto,fl_progressive:steep,w_1080,c_limit/${pub}`;
        return `${base}q_auto,f_auto,fl_progressive:steep,w_1080,c_limit/${pub}`;
      }
    } catch { return url; }
  }
  const id = url.replace(/^\/+/, '');
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
const VideoSourceBadge = React.memo(({ url }) => {
  const info = useMemo(() => {
    if (isPexelsVideo(url))  return { label: 'Pexels',  bg: '#05A081' };
    if (isPixabayVideo(url)) return { label: 'Pixabay', bg: '#2EC66A' };
    if (isYouTubeUrl(url))   return { label: 'YouTube', bg: '#FF0000' };
    return null;
  }, [url]);
  if (!info) return null;
  return (
    <div style={{
      position: 'absolute', top: 8, left: 8, zIndex: 20,
      display: 'flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 9999,
      background: info.bg, color: 'white', fontSize: 10, fontWeight: 700,
      pointerEvents: 'none', boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
    }}>
      <svg viewBox="0 0 10 10" style={{ width: 8, height: 8 }} fill="white">
        <polygon points="2,1 9,5 2,9" />
      </svg>
      {info.label}
    </div>
  );
});
VideoSourceBadge.displayName = 'VideoSourceBadge';

// ─────────────────────────────────────────────
// EMBED ITEM
// ─────────────────────────────────────────────
const EmbedItem = React.memo(({ url, thumbnail, title, showBadge = true }) => {
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
    <div style={{ position: 'absolute', inset: 0, background: '#000' }}>
      {showEmbed ? (
        <iframe src={embedSrc} style={{ width: '100%', height: '100%' }} frameBorder="0"
          allow="autoplay; picture-in-picture" allowFullScreen title={title || 'Vidéo'}
          referrerPolicy="strict-origin-when-cross-origin" />
      ) : (
        <>
          {hasThumbnail ? (
            <>
              {!thumbLoaded && <div style={{ position: 'absolute', inset: 0, background: '#111' }} />}
              <img src={resolvedThumb} alt={title || 'Vidéo'}
                style={{ width: '100%', height: '100%', objectFit: 'cover',
                  opacity: thumbLoaded ? 1 : 0, transition: 'opacity 0.25s' }}
                loading="lazy" decoding="async"
                onLoad={() => setThumbLoaded(true)} onError={handleThumbError}
                referrerPolicy="no-referrer" />
            </>
          ) : (
            <div style={{ width: '100%', height: '100%', background: '#111',
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#555', fontSize: 36 }}>▶</span>
            </div>
          )}
          {hasThumbnail && thumbLoaded && (
            <div style={{ position: 'absolute', inset: 0,
              background: 'linear-gradient(to top, rgba(0,0,0,0.5), transparent)',
              pointerEvents: 'none' }} />
          )}
          <button onClick={() => setShowEmbed(true)}
            style={{ position: 'absolute', inset: 0, background: 'transparent',
              border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%',
              background: 'rgba(255,255,255,0.92)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}>
              <div style={{ width: 0, height: 0, marginLeft: 4,
                borderTop: '10px solid transparent', borderBottom: '10px solid transparent',
                borderLeft: '17px solid #111' }} />
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
    <div style={{ position: 'absolute', inset: 0, background: '#111',
      display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      {hasThumbnail ? (
        <img src={thumbnail} alt={title || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          loading="lazy" decoding="async" onError={() => setImgError(true)} />
      ) : (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
          justifyContent: 'center', background: 'linear-gradient(135deg, #1a1a2e, #0f3460)' }}>
          <svg viewBox="0 0 24 24" style={{ width: 32, height: 32 }} fill="rgba(255,69,0,0.9)">
            <path d="M8 5v14l11-7z"/>
          </svg>
        </div>
      )}
      {externalUrl && (
        <a href={externalUrl} target="_blank" rel="noopener noreferrer"
          style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => e.stopPropagation()}>
          {hasThumbnail && (
            <div style={{ width: 48, height: 48, borderRadius: '50%',
              background: 'rgba(255,69,0,0.85)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }}>
              <svg viewBox="0 0 24 24" style={{ width: 24, height: 24, marginLeft: 3 }} fill="white">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </div>
          )}
        </a>
      )}
      <div style={{ position: 'absolute', top: 8, left: 8, padding: '2px 8px', borderRadius: 9999,
        background: 'rgba(255,69,0,0.85)', color: 'white', fontSize: 10, fontWeight: 700 }}>
        Reddit
      </div>
    </div>
  );
});
HLSItem.displayName = 'HLSItem';

// ─────────────────────────────────────────────
// VIDEO ITEM
// ✅ Mute/unmute → DOM direct + innerHTML sur le bouton → ZÉRO setState, ZÉRO re-render
// ─────────────────────────────────────────────
const ICON_MUTED   = `<svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor"><path d="M16.5 12A4.5 4.5 0 0 0 14 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06A8.99 8.99 0 0 0 17.73 18l1.99 2L21 18.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>`;
const ICON_UNMUTED = `<svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`;

const VideoItem = React.memo(({ url, posterUrl, isLCP, isActive, initialMuted = true,
  onRegisterVideoEl, slotIndex, showBadge = true }) => {

  const videoRef      = useRef(null);
  const muteButtonRef = useRef(null);
  const videoUrls     = useMemo(() => getVideoUrls(url), [url]);

  const [currentSrc,    setCurrentSrc]    = useState(() => videoUrls.proxy || videoUrls.direct);
  const [videoError,    setVideoError]    = useState(false);
  const [posterVisible, setPosterVisible] = useState(true);

  const isMutedLocal  = useRef(initialMuted);
  const playAttempted = useRef(false);
  const fallbackTimer = useRef(null);
  const useCrossOrigin = useMemo(() => needsCrossOrigin(url), [url]);
  const preloadStrat   = useMemo(() => (isLCP || isExternalVideo(url)) ? 'auto' : 'metadata', [isLCP, url]);

  useEffect(() => () => clearTimeout(fallbackTimer.current), []);

  const setVideoRef = useCallback((el) => {
    videoRef.current = el;
    onRegisterVideoEl?.(slotIndex, el);
  }, [onRegisterVideoEl, slotIndex]);

  useEffect(() => {
    const vid = videoRef.current; if (!vid) return;
    if (isActive) {
      vid.muted = true; vid.volume = 0; isMutedLocal.current = true;
      if (muteButtonRef.current) muteButtonRef.current.innerHTML = ICON_MUTED;
      setVideoError(false);
      if (!playAttempted.current) { playAttempted.current = true; vid.play().catch(() => {}); }
      fallbackTimer.current = setTimeout(() => {
        if (vid?.paused) { vid.muted = true; vid.play().catch(() => {}); }
      }, 1500);
    } else {
      clearTimeout(fallbackTimer.current);
      playAttempted.current = false;
      vid.pause(); vid.currentTime = 0;
      setPosterVisible(true);
    }
    return () => clearTimeout(fallbackTimer.current);
  }, [isActive]); // eslint-disable-line

  useEffect(() => {
    const vid = videoRef.current; if (!vid || !isActive) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && e.intersectionRatio >= 0.1) {
        playAttempted.current = false; vid.muted = true; vid.play().catch(() => {});
      } else vid.pause();
    }, { threshold: [0.1, 0.5] });
    obs.observe(vid);
    return () => obs.disconnect();
  }, [isActive]);

  // ✅ Mute toggle : ZERO setState — innerHTML direct sur le bouton DOM
  const handleMuteClick = useCallback((e) => {
    e?.stopPropagation();
    const vid = videoRef.current; if (!vid) return;
    const newMuted = !vid.muted;
    vid.muted = newMuted; vid.volume = newMuted ? 0 : 1;
    isMutedLocal.current = newMuted;
    if (muteButtonRef.current)
      muteButtonRef.current.innerHTML = newMuted ? ICON_MUTED : ICON_UNMUTED;
    if (!newMuted && vid.paused)
      vid.play().catch(() => {
        vid.muted = true; vid.volume = 0; isMutedLocal.current = true;
        if (muteButtonRef.current) muteButtonRef.current.innerHTML = ICON_MUTED;
      });
  }, []);

  const handlePlay  = useCallback(() => { registerPlayingVideo(videoRef.current); setPosterVisible(false); }, []);
  const handlePause = useCallback(() => {}, []);

  const handleError = useCallback(() => {
    const { proxy, direct } = videoUrls;
    if (currentSrc === proxy && direct) {
      setCurrentSrc(direct);
      const v = videoRef.current;
      if (v) { v.load(); if (isActive) v.play().catch(() => {}); }
      return;
    }
    setVideoError(true); setPosterVisible(false);
  }, [videoUrls, currentSrc, isActive]);

  if (videoError) return (
    <div style={{ position: 'absolute', inset: 0, background: '#111',
      display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {posterUrl && <img src={posterUrl} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.3 }} />}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 32 }}>📹</span>
        <span style={{ color: '#666', fontSize: 11 }}>Vidéo indisponible</span>
      </div>
    </div>
  );

  return (
    <div style={{ position: 'absolute', inset: 0, background: '#000' }}>
      <video ref={setVideoRef} src={currentSrc}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        preload={preloadStrat} playsInline loop
        crossOrigin={useCrossOrigin ? 'anonymous' : undefined}
        onPlay={handlePlay} onPause={handlePause} onError={handleError} />

      {posterUrl && (
        <img src={posterUrl} alt=""
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
            pointerEvents: 'none', zIndex: posterVisible ? 2 : -1,
            opacity: posterVisible ? 1 : 0, transition: isLCP ? 'none' : 'opacity 0.3s ease' }}
          loading={isLCP ? 'eager' : 'lazy'} decoding={isLCP ? 'sync' : 'async'} draggable="false" />
      )}

      {showBadge && <VideoSourceBadge url={url} />}

      {isActive && (
        <button
          ref={muteButtonRef}
          onClick={handleMuteClick}
          style={{
            position: 'absolute', bottom: 8, right: 8, zIndex: 20,
            width: 30, height: 30, borderRadius: '50%',
            background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.2)',
            color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent',
          }}
          dangerouslySetInnerHTML={{ __html: ICON_MUTED }}
        />
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
    <div style={{ position: 'absolute', inset: 0, background: '#111' }}>
      <img src={url} alt=""
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block',
          userSelect: 'none', opacity: isLCP ? 1 : (loaded ? 1 : 0),
          transition: isLCP ? 'none' : 'opacity 0.2s ease' }}
        loading={isLCP ? 'eager' : 'lazy'} decoding={isLCP ? 'sync' : 'async'}
        onLoad={() => setLoaded(true)} onError={() => setLoaded(true)} draggable="false" />
    </div>
  );
});
ImageItem.displayName = 'ImageItem';

// ─────────────────────────────────────────────
// LIGHTBOX
// ✅ createPortal sur document.body
// ✅ Contrôlé via controlRef.current.open(i) / .close()
//    → PostMedia ne fait JAMAIS de setState pour ouvrir/fermer
// ─────────────────────────────────────────────
const Lightbox = React.memo(({ urls, slotTypes, posterUrls, post, controlRef }) => {
  const [index,   setIndex]   = useState(0);
  const [visible, setVisible] = useState(false);
  const total = urls.length;

  useEffect(() => {
    controlRef.current = {
      open:  (i) => { setIndex(i); setVisible(true);  document.body.style.overflow = 'hidden'; },
      close: ()  => { setVisible(false);               document.body.style.overflow = ''; },
    };
    return () => { document.body.style.overflow = ''; };
  }, [controlRef]);

  useEffect(() => {
    if (!visible) return;
    const onKey = (e) => {
      if (e.key === 'Escape')     controlRef.current?.close();
      if (e.key === 'ArrowLeft')  setIndex(i => (i - 1 + total) % total);
      if (e.key === 'ArrowRight') setIndex(i => (i + 1) % total);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [visible, total, controlRef]);

  if (!visible) return null;

  const url      = urls[index];
  const slotType = slotTypes[index];
  const poster   = posterUrls[index];
  const embedThumbnail = post?.thumbnail || getYouTubeThumbnail(url);

  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.96)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        animation: 'lbFadeIn 0.18s ease',
      }}
      onClick={() => controlRef.current?.close()}
    >
      <style>{`@keyframes lbFadeIn{from{opacity:0;transform:scale(0.97)}to{opacity:1;transform:scale(1)}}`}</style>

      {/* Fermer */}
      <button onClick={(e) => { e.stopPropagation(); controlRef.current?.close(); }} style={{
        position: 'absolute', top: 16, right: 16, zIndex: 10,
        width: 40, height: 40, borderRadius: '50%',
        background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)',
        color: 'white', fontSize: 16, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <FaTimes />
      </button>

      {/* Compteur */}
      {total > 1 && (
        <div style={{
          position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)',
          color: 'rgba(255,255,255,0.65)', fontSize: 13, fontWeight: 600,
          background: 'rgba(0,0,0,0.45)', padding: '3px 12px', borderRadius: 20,
          pointerEvents: 'none',
        }}>
          {index + 1} / {total}
        </div>
      )}

      {/* Média */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100vw',
          height: 'calc(100vh - 60px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '0 56px',
          boxSizing: 'border-box',
        }}
      >
        {slotType === 'image' && (
          <img src={url} alt=""
            style={{
              display: 'block',
              width: '100%',
              height: 'calc(100vh - 60px)',
              objectFit: 'contain',
              borderRadius: 8,
            }}
            draggable="false"
          />
        )}

        {slotType !== 'image' && (
          <div style={{
            width: '100%', height: '100%',
            position: 'relative',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              width: '100%',
              maxWidth: 'min(100%, calc((100vh - 60px) * 16 / 9))',
              aspectRatio: '16/9',
              position: 'relative',
              borderRadius: 10, overflow: 'hidden',
            }}>
              {slotType === 'embed' && (
                <EmbedItem url={url} thumbnail={embedThumbnail} title={post?.content?.substring(0, 60)} showBadge />
              )}
              {slotType === 'hls' && (
                <HLSItem thumbnail={post?.thumbnail} externalUrl={post?.sourceUrl} title={post?.content?.substring(0, 60)} />
              )}
              {slotType === 'video' && (
                <VideoItem url={url} posterUrl={poster} isLCP={false} isActive={true}
                  initialMuted={true} onRegisterVideoEl={null} slotIndex={-1} showBadge />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Flèches */}
      {total > 1 && (
        <>
          <button onClick={e => { e.stopPropagation(); setIndex(i => (i - 1 + total) % total); }}
            style={{
              position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
              width: 44, height: 44, borderRadius: '50%',
              background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)',
              color: 'white', fontSize: 18, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
            <FaChevronLeft />
          </button>
          <button onClick={e => { e.stopPropagation(); setIndex(i => (i + 1) % total); }}
            style={{
              position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)',
              width: 44, height: 44, borderRadius: '50%',
              background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)',
              color: 'white', fontSize: 18, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
            <FaChevronRight />
          </button>

          {/* Points */}
          <div style={{ position: 'absolute', bottom: 16, display: 'flex', gap: 6, alignItems: 'center' }}>
            {urls.map((_, i) => (
              <button key={i} onClick={e => { e.stopPropagation(); setIndex(i); }}
                style={{
                  width: i === index ? 10 : 7, height: i === index ? 10 : 7,
                  borderRadius: '50%',
                  background: i === index ? 'white' : 'rgba(255,255,255,0.35)',
                  border: 'none', cursor: 'pointer', padding: 0, transition: 'all 0.2s',
                }} />
            ))}
          </div>
        </>
      )}
    </div>,
    document.body
  );
});
Lightbox.displayName = 'Lightbox';

// ─────────────────────────────────────────────
// MEDIA CELL
// ✅ onCellClick stable (jamais recréé) → React.memo efficace
// ─────────────────────────────────────────────
const MediaCell = React.memo(({
  url, slotType, posterUrl, isLCP,
  onRegisterVideoEl, slotIndex,
  showBadge, post,
  paddingBottom = '75%',
  overlay = null,
  wrapperStyle = {},
  onCellClick,
}) => {
  const embedThumbnail = useMemo(
    () => post?.thumbnail || getYouTubeThumbnail(url),
    [post?.thumbnail, url]
  );

  const handleClick = useCallback(() => {
    onCellClick?.(slotIndex);
  }, [onCellClick, slotIndex]);

  return (
    <div
      style={{ position: 'relative', paddingBottom, overflow: 'hidden', background: '#111', cursor: 'pointer', ...wrapperStyle }}
      onClick={handleClick}
    >
      <div style={{ position: 'absolute', inset: 0 }}>
        {slotType === 'embed' ? (
          <EmbedItem url={url} thumbnail={embedThumbnail} title={post?.content?.substring(0, 60)} showBadge={showBadge} />
        ) : slotType === 'hls' ? (
          <HLSItem thumbnail={post?.thumbnail} externalUrl={post?.sourceUrl} title={post?.content?.substring(0, 60)} />
        ) : slotType === 'video' ? (
          <VideoItem
            url={url} posterUrl={posterUrl} isLCP={isLCP} isActive={true} initialMuted={true}
            onRegisterVideoEl={onRegisterVideoEl} slotIndex={slotIndex} showBadge={showBadge}
          />
        ) : (
          <ImageItem url={url} isLCP={isLCP} />
        )}

        {overlay && (
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10,
          }}>
            <span style={{ color: 'white', fontSize: 26, fontWeight: 800, letterSpacing: -1 }}>
              {overlay}
            </span>
          </div>
        )}
      </div>
    </div>
  );
});
MediaCell.displayName = 'MediaCell';

// ─────────────────────────────────────────────
// HOOK — ratio naturel image/vidéo
// ─────────────────────────────────────────────
const MAX_PB = 177;

const useNaturalRatio = (url, slotType, fallbackPb) => {
  const [pb, setPb] = useState(null);

  useEffect(() => {
    if (!url || slotType === 'embed' || slotType === 'hls') {
      setPb(fallbackPb); return;
    }
    if (slotType === 'image') {
      const img = new Image();
      img.onload = () => {
        const r = img.naturalWidth && img.naturalHeight
          ? Math.min((img.naturalHeight / img.naturalWidth) * 100, MAX_PB)
          : parseFloat(fallbackPb);
        setPb(`${r}%`);
      };
      img.onerror = () => setPb(fallbackPb);
      img.src = url;
      return;
    }
    if (slotType === 'video') {
      const vid = document.createElement('video');
      vid.muted = true; vid.preload = 'metadata';
      const cleanup = () => { vid.onloadedmetadata = null; vid.onerror = null; vid.src = ''; };
      vid.onloadedmetadata = () => {
        const r = vid.videoWidth && vid.videoHeight
          ? Math.min((vid.videoHeight / vid.videoWidth) * 100, MAX_PB)
          : parseFloat(fallbackPb);
        setPb(`${r}%`); cleanup();
      };
      vid.onerror = () => { setPb(fallbackPb); cleanup(); };
      vid.src = url;
    }
  }, [url, slotType]); // eslint-disable-line

  return pb ?? fallbackPb;
};

// ─────────────────────────────────────────────
// MEDIA CELL AUTO
// ─────────────────────────────────────────────
const MediaCellAuto = React.memo((props) => {
  const { url, slotType } = props;
  const isVid = slotType === 'video' || slotType === 'embed' || slotType === 'hls';
  const fallback = isVid ? '56.25%' : '100%';
  const paddingBottom = useNaturalRatio(url, slotType, fallback);
  return <MediaCell {...props} paddingBottom={paddingBottom} />;
});
MediaCellAuto.displayName = 'MediaCellAuto';

// ─────────────────────────────────────────────
// HOOK — validation des URLs media
//
// ✅ FIX v19 : STRATÉGIE "cacher puis montrer" (au lieu de "montrer puis cacher")
//
// - Commence à null → PostMedia affiche un placeholder gris
// - Valide chaque média en arrière-plan
// - Une fois tous les checks terminés → retourne les indices valides → grille s'affiche proprement
// - safetyTimer 300ms : si les checks traînent, on affiche tout quand même (évite le blocage)
// - Timeouts réduits (3s image, 4s vidéo) car on préfère afficher vite
//
// Résultat : l'utilisateur voit un rectangle gris ~100-300ms,
// puis le(s) média(s) apparaissent sans aucun flash de retrait.
// ─────────────────────────────────────────────
const useMediaValidation = (urls, slotTypes) => {
  // null = validation en cours | [] = aucun valide | [0,1,...] = indices valides
  const [validIndices, setValidIndices] = useState(null);

  useEffect(() => {
    if (!urls.length) { setValidIndices([]); return; }

    let cancelled = false;

    // Reset à null → placeholder visible pendant la validation
    setValidIndices(null);

    // ✅ Safety timer : si les checks durent trop longtemps, on affiche tout
    const safetyTimer = setTimeout(() => {
      if (!cancelled) setValidIndices(urls.map((_, i) => i));
    }, 300);

    const checks = urls.map((url, i) => {
      const type = slotTypes[i];

      // Embeds (YouTube, Vimeo) et HLS → on fait confiance, pas de probe réseau
      if (type === 'embed' || type === 'hls') return Promise.resolve({ i, ok: true });

      // blob: / data: → toujours valide
      if (!url || url.startsWith('blob:') || url.startsWith('data:')) return Promise.resolve({ i, ok: !!url });

      if (type === 'image') {
        return new Promise((resolve) => {
          const img = new Image();
          const timer = setTimeout(() => resolve({ i, ok: true }), 3000); // timeout réduit vs v18
          img.onload  = () => { clearTimeout(timer); resolve({ i, ok: true }); };
          img.onerror = () => { clearTimeout(timer); resolve({ i, ok: false }); };
          img.src = url;
        });
      }

      if (type === 'video') {
        return new Promise((resolve) => {
          const timer = setTimeout(() => resolve({ i, ok: true }), 4000); // timeout réduit vs v18
          const vid = document.createElement('video');
          vid.muted = true; vid.preload = 'metadata';
          vid.onloadedmetadata = () => { clearTimeout(timer); vid.src = ''; resolve({ i, ok: true }); };
          vid.onerror           = () => { clearTimeout(timer); vid.src = ''; resolve({ i, ok: false }); };
          vid.src = url;
        });
      }

      return Promise.resolve({ i, ok: true });
    });

    Promise.all(checks).then((results) => {
      if (cancelled) return;
      clearTimeout(safetyTimer);
      const valid = results.filter(r => r.ok).map(r => r.i);
      setValidIndices(valid);
    });

    return () => {
      cancelled = true;
      clearTimeout(safetyTimer);
    };
  }, [urls.join(','), slotTypes.join(',')]); // eslint-disable-line

  return validIndices; // null pendant la validation, tableau une fois prêt
};

// ─────────────────────────────────────────────
// MEDIA PLACEHOLDER
// Affiché pendant la validation des médias (~100-300ms)
// Rectangle gris neutre — pas de CLS car même hauteur que le futur contenu
// ─────────────────────────────────────────────
const MediaPlaceholder = React.memo(({ total }) => {
  // Reproduit la hauteur approximative de la grille finale pour éviter le CLS
  const pb = total === 1 ? '75%' : total === 2 ? '50%' : '66%';
  return (
    <div style={{
      width: '100%',
      paddingBottom: pb,
      background: 'linear-gradient(135deg, #1a1a1a 0%, #222 100%)',
      borderRadius: 4,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Shimmer subtil */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.03) 50%, transparent 100%)',
        backgroundSize: '200% 100%',
        animation: 'mediaShimmer 1.4s ease-in-out infinite',
      }} />
      <style>{`@keyframes mediaShimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}`}</style>
    </div>
  );
});
MediaPlaceholder.displayName = 'MediaPlaceholder';

// ─────────────────────────────────────────────
// POST MEDIA — composant principal
// ✅ AUCUN setState déclenché par le mute ou le lightbox
// ✅ v19 : placeholder gris pendant validation → apparition propre, zéro flash
// ─────────────────────────────────────────────
const GAP = 2;

const PostMedia = React.memo(({ mediaUrls, isFirstPost = false, priority = false, post = null }) => {
  const autoGenerated  = !!post?.autoGenerated;
  const showBadge      = !autoGenerated;

  // ✅ Lightbox contrôlé via ref pure → jamais de re-render de PostMedia
  const lightboxControl = useRef({});

  // ✅ handleCellClick stable : useCallback avec deps vides + closure sur ref
  const handleCellClick = useCallback((i) => {
    lightboxControl.current.open?.(i);
  }, []);

  // ✅ Enregistrement vidéos via ref pure
  const videoRefsMap = useRef({});
  const onRegisterVideoEl = useCallback((i, el) => {
    if (el) videoRefsMap.current[i] = el;
    else    delete videoRefsMap.current[i];
  }, []);

  // ── URLs ─────────────────────────────────────────────────────────────────
  const safeMediaUrls = useMemo(() => {
    const seen = new Set(); const result = [];
    const add = (url) => {
      if (!url || typeof url !== 'string') return;
      if (url.startsWith('blob:')) { if (!seen.has(url)) { seen.add(url); result.push(url); } return; }
      if (!url.startsWith('data:') && !isStructurallyValid(url)) return;
      if (!seen.has(url)) { seen.add(url); result.push(url); }
    };
    if (Array.isArray(mediaUrls)) mediaUrls.filter(Boolean).forEach(add);
    if (post?.embedUrl)  add(post.embedUrl);
    if (post?.videoUrl)  add(post.videoUrl);
    if (post?.sourceUrl) add(post.sourceUrl);
    return result;
  }, [mediaUrls, post?.embedUrl, post?.videoUrl, post?.sourceUrl]);

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

  // ✅ v19 : retourne null pendant la validation (placeholder affiché ci-dessous)
  const validIndices = useMediaValidation(urls, slotTypes);

  // URLs/slotTypes/posterUrls filtrés — uniquement les médias valides
  const validUrls      = validIndices ? validIndices.map(i => urls[i])      : [];
  const validSlotTypes = validIndices ? validIndices.map(i => slotTypes[i]) : [];
  const validPosters   = validIndices ? validIndices.map(i => posterUrls[i]): [];
  const validTotal     = validUrls.length;

  // ✅ Props stables par cellule — AVANT tout return conditionnel (règle des hooks)
  const cellProps = useCallback((i, extra = {}) => ({
    url:              validUrls[i],
    slotType:         validSlotTypes[i],
    posterUrl:        validPosters[i],
    isLCP:            isLCPSlot && i === 0,
    onRegisterVideoEl,
    slotIndex:        i,
    showBadge,
    post,
    onCellClick:      handleCellClick,
    ...extra,
  }), [validUrls, validSlotTypes, validPosters, isLCPSlot, onRegisterVideoEl, showBadge, post, handleCellClick]); // eslint-disable-line

  // ── Returns conditionnels APRÈS tous les hooks ────────────────────────────

  // Pas d'URLs du tout → rien à afficher
  if (!total) return null;

  // ✅ v19 : validation en cours → placeholder gris (évite le flash de retrait)
  if (validIndices === null) {
    return <MediaPlaceholder total={total} />;
  }

  // Tous les médias sont invalides → rien à afficher
  if (validTotal === 0) return null;

  const renderGrid = () => {
    if (validTotal === 1) {
      return <MediaCellAuto key="c0" {...cellProps(0)} />;
    }
    if (validTotal === 2) return (
      <div style={{ display: 'flex', gap: GAP }}>
        <MediaCell key="c0" {...cellProps(0)} paddingBottom="100%" wrapperStyle={{ flex: 1 }} />
        <MediaCell key="c1" {...cellProps(1)} paddingBottom="100%" wrapperStyle={{ flex: 1 }} />
      </div>
    );
    if (validTotal === 3) return (
      <div style={{ display: 'flex', gap: GAP, alignItems: 'stretch' }}>
        <MediaCell key="c0" {...cellProps(0)} paddingBottom="133%" wrapperStyle={{ flex: 2 }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: GAP }}>
          <MediaCell key="c1" {...cellProps(1)} paddingBottom="100%" />
          <MediaCell key="c2" {...cellProps(2)} paddingBottom="100%" />
        </div>
      </div>
    );
    if (validTotal === 4) return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: GAP }}>
        <div style={{ display: 'flex', gap: GAP }}>
          <MediaCell key="c0" {...cellProps(0)} paddingBottom="100%" wrapperStyle={{ flex: 1 }} />
          <MediaCell key="c1" {...cellProps(1)} paddingBottom="100%" wrapperStyle={{ flex: 1 }} />
        </div>
        <div style={{ display: 'flex', gap: GAP }}>
          <MediaCell key="c2" {...cellProps(2)} paddingBottom="100%" wrapperStyle={{ flex: 1 }} />
          <MediaCell key="c3" {...cellProps(3)} paddingBottom="100%" wrapperStyle={{ flex: 1 }} />
        </div>
      </div>
    );
    const hidden  = validTotal - 5;
    const overlay = hidden > 0 ? `+${hidden}` : null;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: GAP }}>
        <div style={{ display: 'flex', gap: GAP, alignItems: 'stretch' }}>
          <MediaCell key="c0" {...cellProps(0)} paddingBottom="75%" wrapperStyle={{ flex: 2 }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: GAP }}>
            <MediaCell key="c1" {...cellProps(1)} paddingBottom="75%" />
            <MediaCell key="c2" {...cellProps(2)} paddingBottom="75%" />
          </div>
        </div>
        <div style={{ display: 'flex', gap: GAP }}>
          <MediaCell key="c3" {...cellProps(3)} paddingBottom="75%" wrapperStyle={{ flex: 1 }} />
          <MediaCell key="c4" {...cellProps(4)} paddingBottom="75%" wrapperStyle={{ flex: 1 }} overlay={overlay} />
        </div>
      </div>
    );
  };

  return (
    <>
      {renderGrid()}
      {/* ✅ Lightbox avec uniquement les médias valides */}
      <Lightbox
        urls={validUrls}
        slotTypes={validSlotTypes}
        posterUrls={validPosters}
        post={post}
        controlRef={lightboxControl}
      />
    </>
  );
});

PostMedia.displayName = "PostMedia";
export default PostMedia;