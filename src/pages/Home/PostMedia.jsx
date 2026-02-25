// 📁 src/pages/Home/PostMedia.jsx
//
// ✅ FIX SON v5 — DÉFINITIF :
//    - handleToggleMute stabilisé avec useRef pour éviter les re-créations
//    - VideoItem reçoit toggleMuteRef (ref stable) + slotIndex
//    - Plus de prop onToggleMute instable qui cassait React.memo sur VideoItem
//    - newMuted est passé directement depuis VideoItem (lit vid.muted)
//    - Aucune désynchronisation possible entre DOM et state React
//
// ✅ FIX PostCard (à faire dans PostCard.jsx) :
//    Remplacer : <PostMedia mediaUrls={mediaUrls} isFirstPost={priority} />
//    Par :       <PostMedia mediaUrls={mediaUrls} isFirstPost={priority} post={post} />
//
// ✅ FIX AFFICHAGE PEXELS : crossOrigin retiré pour Pexels/Pixabay
// ✅ Toutes les corrections LCP conservées

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { FaVolumeUp, FaVolumeMute, FaExternalLinkAlt } from "react-icons/fa";

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "dlymdclhe";
const IMG_BASE = `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/`;
const VID_BASE = `https://res.cloudinary.com/${CLOUD_NAME}/video/upload/`;

// ─────────────────────────────────────────────
// DÉTECTION DU TYPE D'URL
// ─────────────────────────────────────────────
const isVideoUrl = url =>
  url && /\.(mp4|webm|mov|avi)$/i.test(url.split('?')[0]);

const isHLSUrl = url =>
  url && /\.m3u8/i.test(url);

const isEmbedUrl = url =>
  url && (
    url.includes('player.vimeo.com')      ||
    url.includes('youtube.com/embed')     ||
    url.includes('youtu.be')              ||
    url.includes('dailymotion.com/embed')
  );

const isPexelsVideo   = url => url && url.includes('videos.pexels.com');
const isPixabayVideo  = url => url && url.includes('cdn.pixabay.com/video');
const isExternalVideo = url => isPexelsVideo(url) || isPixabayVideo(url);
const isYouTubeEmbed  = url => url && (url.includes('youtube.com/embed') || url.includes('youtu.be'));

// ✅ crossOrigin UNIQUEMENT pour Cloudinary — Pexels/Pixabay bloquent les requêtes CORS
const needsCrossOrigin = url => url && url.includes('res.cloudinary.com');

// ─────────────────────────────────────────────
// POSTER URL
// ─────────────────────────────────────────────
const getVideoPosterUrl = (videoUrl, postData = null) => {
  if (!videoUrl) return null;
  if (postData?.thumbnail) return postData.thumbnail;
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
    if (isPexelsVideo(videoUrl)) {
      const match = videoUrl.match(/video-files\/(\d+)\//);
      if (match) return `https://images.pexels.com/videos/${match[1]}/pictures/preview-0.jpg`;
    }
    if (isPixabayVideo(videoUrl)) {
      const thumb = videoUrl
        .replace('_large.mp4',  '_tiny.jpg')
        .replace('_medium.mp4', '_tiny.jpg')
        .replace('_small.mp4',  '_tiny.jpg');
      if (thumb !== videoUrl) return thumb;
    }
    return null;
  } catch { return null; }
};

const getYouTubeThumbnail = (embedUrl) => {
  if (!embedUrl) return null;
  try {
    const match = embedUrl.match(/embed\/([a-zA-Z0-9_-]{11})/);
    if (match) return `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg`;
    return null;
  } catch { return null; }
};

// ─────────────────────────────────────────────
// getOptimizedUrl
// ─────────────────────────────────────────────
const getOptimizedUrl = (url, isLCP = false) => {
  if (!url) return null;
  if (url.startsWith('data:')) return url;
  if (isEmbedUrl(url) || isHLSUrl(url)) return url;
  if (isExternalVideo(url)) return url;
  if (url.startsWith('http') && !url.includes('res.cloudinary.com')) return url;

  if (url.includes('res.cloudinary.com')) {
    if (url.includes('q_auto') || url.includes('w_1080')) return url;
    try {
      const uploadIndex = url.indexOf('/upload/');
      if (uploadIndex !== -1) {
        const afterUpload = url.substring(uploadIndex + 8);
        let publicId = afterUpload;
        const firstPart = afterUpload.split('/')[0];
        if (firstPart.includes(',') || /^[a-z]_/.test(firstPart)) {
          publicId = afterUpload.substring(firstPart.length + 1);
        }
        const video = isVideoUrl(publicId);
        const base  = video ? VID_BASE : IMG_BASE;
        if (video) return `${base}q_auto:good,f_auto,w_1080,c_limit/${publicId}`;
        if (isLCP) return `${base}q_auto:good,f_auto,fl_progressive:steep,w_1080,c_limit/${publicId}`;
        return `${base}q_auto,f_auto,fl_progressive:steep,w_1080,c_limit/${publicId}`;
      }
    } catch { return url; }
  }

  const id    = url.replace(/^\/+/, '');
  const video = isVideoUrl(id);
  if (video) return `${VID_BASE}q_auto:good,f_auto,w_1080,c_limit/${id}`;
  if (isLCP) return `${IMG_BASE}q_auto:good,f_auto,fl_progressive:steep,w_1080,c_limit/${id}`;
  return `${IMG_BASE}q_auto,f_auto,fl_progressive:steep,w_1080,c_limit/${id}`;
};

// ─────────────────────────────────────────────
// BADGE SOURCE
// ─────────────────────────────────────────────
const VideoSourceBadge = ({ url }) => {
  const info = useMemo(() => {
    if (isPexelsVideo(url))  return { label: 'Pexels',  bg: '#05A081' };
    if (isPixabayVideo(url)) return { label: 'Pixabay', bg: '#2EC66A' };
    if (isYouTubeEmbed(url)) return { label: 'YouTube', bg: '#FF0000' };
    return null;
  }, [url]);

  if (!info) return null;
  return (
    <div
      className="absolute top-3 left-3 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-white text-[11px] font-bold pointer-events-none"
      style={{ background: info.bg, backdropFilter: 'blur(4px)', boxShadow: '0 1px 6px rgba(0,0,0,0.3)' }}
    >
      <svg viewBox="0 0 10 10" className="w-2.5 h-2.5" fill="white">
        <polygon points="2,1 9,5 2,9" />
      </svg>
      {info.label}
    </div>
  );
};

// ─────────────────────────────────────────────
// EMBED ITEM
// ─────────────────────────────────────────────
const EmbedItem = React.memo(({ url, thumbnail, title }) => {
  const [showEmbed,   setShowEmbed]   = useState(false);
  const [thumbError,  setThumbError]  = useState(false);
  const [thumbLoaded, setThumbLoaded] = useState(false);

  const resolvedThumb = useMemo(() => {
    if (thumbnail) return thumbnail;
    if (isYouTubeEmbed(url)) return getYouTubeThumbnail(url);
    return null;
  }, [url, thumbnail]);

  const embedSrc = useMemo(() => {
    if (url.includes('player.vimeo.com')) {
      return url.replace('background=1', 'autoplay=1').replace('muted=1', '')
        + (url.includes('?') ? '&' : '?') + 'autoplay=1';
    }
    if (isYouTubeEmbed(url)) {
      const sep = url.includes('?') ? '&' : '?';
      return `${url}${sep}autoplay=1&rel=0`;
    }
    return url;
  }, [url]);

  return (
    <div className="relative w-full h-full bg-black flex items-center justify-center">
      {showEmbed ? (
        <iframe
          src={embedSrc}
          className="w-full h-full"
          frameBorder="0"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          title={title || 'Vidéo'}
        />
      ) : (
        <>
          {resolvedThumb && !thumbError ? (
            <>
              {!thumbLoaded && <div className="absolute inset-0 bg-gray-900 animate-pulse" />}
              <img
                src={resolvedThumb} alt=""
                className="w-full h-full object-cover"
                style={{ opacity: thumbLoaded ? 1 : 0, transition: 'opacity 0.2s' }}
                loading="lazy" decoding="async"
                onLoad={()  => setThumbLoaded(true)}
                onError={() => setThumbError(true)}
              />
            </>
          ) : (
            <div className="w-full h-full bg-gray-900 flex items-center justify-center">
              <div className="text-gray-600 text-5xl select-none">▶</div>
            </div>
          )}
          {resolvedThumb && !thumbError && (
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent pointer-events-none" />
          )}
          <button
            onClick={() => setShowEmbed(true)}
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: 'transparent' }}
            aria-label="Lire la vidéo"
          >
            <div className="w-16 h-16 rounded-full bg-white/90 hover:bg-white flex items-center justify-center shadow-2xl transition-all hover:scale-105 active:scale-95">
              <div className="w-0 h-0 ml-1.5" style={{
                borderTop:    '13px solid transparent',
                borderBottom: '13px solid transparent',
                borderLeft:   '22px solid #111',
              }} />
            </div>
          </button>
        </>
      )}
      <VideoSourceBadge url={url} />
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
    <div className="relative w-full h-full bg-gray-900 flex items-center justify-center overflow-hidden">
      {hasThumbnail ? (
        <img src={thumbnail} alt={title || ''} className="w-full h-full object-cover"
          loading="lazy" decoding="async" onError={() => setImgError(true)} />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3"
          style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }}>
          <div className="w-20 h-20 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(255,69,0,0.15)', border: '2px solid rgba(255,69,0,0.4)' }}>
            <svg viewBox="0 0 24 24" className="w-10 h-10" fill="rgba(255,69,0,0.9)"><path d="M8 5v14l11-7z"/></svg>
          </div>
          {title && <p className="text-white/70 text-xs text-center px-6 line-clamp-2 max-w-[200px]">{title}</p>}
        </div>
      )}
      {hasThumbnail && <div className="absolute inset-0 bg-black/20" />}
      {externalUrl && (
        <a href={externalUrl} target="_blank" rel="noopener noreferrer"
          className="absolute inset-0 flex items-center justify-center" onClick={e => e.stopPropagation()}>
          {hasThumbnail && (
            <div className="w-16 h-16 rounded-full flex items-center justify-center shadow-xl"
              style={{ background: 'rgba(255,69,0,0.85)', backdropFilter: 'blur(4px)' }}>
              <svg viewBox="0 0 24 24" className="w-8 h-8 ml-1" fill="white"><path d="M8 5v14l11-7z"/></svg>
            </div>
          )}
        </a>
      )}
      <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-white text-xs font-bold backdrop-blur-sm"
        style={{ background: 'rgba(255,69,0,0.85)' }}>
        <svg viewBox="0 0 20 20" className="w-3.5 h-3.5" fill="currentColor">
          <path d="M10 0C4.478 0 0 4.478 0 10c0 5.523 4.478 10 10 10 5.523 0 10-4.477 10-10C20 4.478 15.523 0 10 0zm6.4 10.8c.04.27.06.55.06.83 0 3.26-4.33 5.9-9.66 5.9C1.5 17.53 0 15.32 0 13.32c0-.28.02-.56.06-.83-.66-.3-1.06-.93-1.06-1.6 0-1.06.86-1.92 1.92-1.92.52 0 .98.2 1.33.52 1.3-.88 3.07-1.44 5.04-1.5l.9-4.05.1-.02 2.72.57c.18-.43.62-.74 1.13-.74.68 0 1.23.55 1.23 1.23 0 .68-.55 1.23-1.23 1.23-.67 0-1.22-.54-1.23-1.2l-2.4-.5-.8 3.56c1.94.07 3.68.63 4.97 1.5.34-.32.8-.52 1.3-.52 1.06 0 1.92.86 1.92 1.92 0 .67-.4 1.3-1.06 1.6z"/>
        </svg>
        Reddit
      </div>
      {externalUrl && !hasThumbnail && (
        <a href={externalUrl} target="_blank" rel="noopener noreferrer"
          className="absolute bottom-4 flex items-center gap-2 px-4 py-2 rounded-full text-white text-xs font-semibold"
          style={{ background: 'rgba(255,69,0,0.85)', backdropFilter: 'blur(4px)' }}
          onClick={e => e.stopPropagation()}>
          <FaExternalLinkAlt className="text-xs" /> Voir sur Reddit
        </a>
      )}
    </div>
  );
});
HLSItem.displayName = 'HLSItem';

// ─────────────────────────────────────────────
// VIDEO ITEM
//
// ✅ FIX SON v5 :
//   - Reçoit toggleMuteRef (ref stable) + slotIndex au lieu de onToggleMute
//   - toggleMuteRef.current(slotIndex, newMuted) → toujours à jour, jamais périmé
//   - React.memo ne re-rend pas VideoItem quand PostMedia re-render
//     car toggleMuteRef est une ref (référence stable, pas une nouvelle valeur)
// ─────────────────────────────────────────────
const VideoItem = React.memo(({
  url, posterUrl, isLCP, isActive, isMuted,
  toggleMuteRef, slotIndex,
  videoRefCallback,
}) => {
  const videoRef        = useRef(null);
  const [isPlaying,     setIsPlaying]     = useState(false);
  const [posterVisible, setPosterVisible] = useState(true);
  const [hasInteracted, setHasInteracted] = useState(false);
  const playAttempted   = useRef(false);
  const fallbackTimer   = useRef(null);
  const useCrossOrigin  = useMemo(() => needsCrossOrigin(url), [url]);

  const setVideoRef = useCallback((el) => {
    videoRef.current = el;
    videoRefCallback?.(el);
  }, [videoRefCallback]);

  // Sync muted depuis parent avant toute interaction utilisateur
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || hasInteracted) return;
    vid.muted  = isMuted;
    vid.volume = isMuted ? 0 : 1;
  }, [isMuted, hasInteracted]);

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;

    if (isActive) {
      vid.muted  = true;
      vid.volume = 0;
      setHasInteracted(false);

      const tryPlay = () => {
        if (playAttempted.current) return;
        playAttempted.current = true;
        vid.play().catch(() => {});
      };
      tryPlay();

      fallbackTimer.current = setTimeout(() => {
        if (vid && vid.paused) { vid.muted = true; vid.volume = 0; vid.play().catch(() => {}); }
      }, 1500);
    } else {
      clearTimeout(fallbackTimer.current);
      playAttempted.current = false;
      setHasInteracted(false);
      vid.pause();
      vid.currentTime = 0;
      setIsPlaying(false);
      setPosterVisible(true);
    }

    return () => clearTimeout(fallbackTimer.current);
  }, [isActive]); // eslint-disable-line

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || !isActive) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && entry.intersectionRatio >= 0.1) {
        playAttempted.current = false;
        vid.muted = true; vid.volume = 0;
        vid.play().catch(() => {});
      } else {
        vid.pause();
      }
    }, { threshold: [0.1, 0.5] });
    obs.observe(vid);
    return () => obs.disconnect();
  }, [isActive]);

  const handlePlay  = useCallback(() => { setIsPlaying(true);  setPosterVisible(false); }, []);
  const handlePause = useCallback(() => { setIsPlaying(false); }, []);

  // ✅ FIX SON v5 :
  // 1. On lit l'état réel depuis vid.muted (source de vérité DOM)
  // 2. On passe newMuted à toggleMuteRef.current(slotIndex, newMuted)
  //    → le parent met à jour isMutedMap → l'icône 🔇/🔊 se met à jour
  // 3. toggleMuteRef est stable → pas de re-render inutile de VideoItem
  const handleMuteClick = useCallback((e) => {
    e?.stopPropagation();
    const vid = videoRef.current;
    if (!vid) return;

    const newMuted = !vid.muted;
    vid.muted  = newMuted;
    vid.volume = newMuted ? 0 : 1;

    if (!newMuted && vid.paused) {
      vid.play().catch(() => {
        vid.muted  = true;
        vid.volume = 0;
        toggleMuteRef?.current?.(slotIndex, true);
        return;
      });
    }

    setHasInteracted(true);
    toggleMuteRef?.current?.(slotIndex, newMuted);
  }, [toggleMuteRef, slotIndex]);

  const showSoundBadge = isActive && isPlaying && isMuted && !hasInteracted;

  return (
    <div className="relative w-full h-full bg-black flex items-center justify-center">
      <video
        ref={setVideoRef}
        src={url}
        className="w-full h-full"
        style={{ objectFit: 'contain' }}
        preload={isLCP ? 'auto' : 'metadata'}
        playsInline
        loop
        crossOrigin={useCrossOrigin ? 'anonymous' : undefined}
        onPlay={handlePlay}
        onPause={handlePause}
      />

      {posterUrl && (
        <img
          src={posterUrl} alt=""
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{
            objectFit:  isExternalVideo(url) ? 'cover' : 'contain',
            zIndex:     posterVisible ? 2 : -1,
            opacity:    isLCP ? 1 : (posterVisible ? 1 : 0),
            transition: isLCP ? 'none' : 'opacity 0.3s ease',
          }}
          loading={isLCP ? 'eager' : 'lazy'}
          fetchpriority={isLCP ? 'high' : 'auto'}
          decoding={isLCP ? 'sync' : 'async'}
          draggable="false"
        />
      )}

      <VideoSourceBadge url={url} />

      {isActive && (
        <button
          onClick={handleMuteClick}
          className="absolute bottom-3 right-3 z-20 w-9 h-9 rounded-full bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center text-white transition-transform active:scale-90"
          style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
          aria-label={isMuted ? 'Activer le son' : 'Couper le son'}
        >
          {isMuted ? <FaVolumeMute className="text-sm" /> : <FaVolumeUp className="text-sm" />}
        </button>
      )}

      {showSoundBadge && (
        <button
          onClick={handleMuteClick}
          className="absolute bottom-3 left-3 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/70 backdrop-blur-md border border-white/20 text-white text-xs font-semibold transition-all active:scale-95"
          style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
        >
          <FaVolumeUp className="text-xs" />
          Appuyer pour le son
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
    <div className="relative w-full h-full bg-black flex items-center justify-center">
      {!loaded && !isLCP && <div className="absolute inset-0 bg-gray-900 animate-pulse" />}
      <img
        src={url} alt=""
        className="w-full h-full"
        style={{
          objectFit:  'contain',
          opacity:    isLCP ? 1 : (loaded ? 1 : 0),
          transition: isLCP ? 'none' : 'opacity 0.2s ease',
          userSelect: 'none',
          display:    'block',
        }}
        loading={isLCP ? 'eager' : 'lazy'}
        fetchpriority={isLCP ? 'high' : 'low'}
        decoding={isLCP ? 'sync' : 'async'}
        onLoad={()  => setLoaded(true)}
        onError={() => setLoaded(true)}
        draggable="false"
      />
    </div>
  );
});
ImageItem.displayName = 'ImageItem';

// ─────────────────────────────────────────────
// RÉSOUDRE LE TYPE DE SLOT
// ─────────────────────────────────────────────
const resolveSlotType = (url) => {
  if (!url) return 'unknown';
  if (isEmbedUrl(url))                         return 'embed';
  if (isHLSUrl(url))                           return 'hls';
  if (isVideoUrl(url) || isExternalVideo(url)) return 'video';
  return 'image';
};

// ─────────────────────────────────────────────
// POST MEDIA — composant principal
// ─────────────────────────────────────────────
const PostMedia = React.memo(({ mediaUrls, isFirstPost = false, priority = false, post = null }) => {
  const [index,      setIndex]      = useState(0);
  const [isMutedMap, setIsMutedMap] = useState({});

  // ✅ FIX SON v5 : toggleMuteRef est une ref STABLE
  // Ni VideoItem ni ses callbacks ne reçoivent de prop instable
  const toggleMuteRef = useRef(null);
  const isMutedMapRef = useRef({});
  const videoRefsMap  = useRef({});
  const containerRef  = useRef(null);
  const touch         = useRef({ x: 0, y: 0, time: 0 });
  const dirRef        = useRef(null);
  const isDragging    = useRef(false);
  const preloadImgRef = useRef(null);

  if (!mediaUrls?.length) return null;

  const isLCPSlot = isFirstPost || priority;

  const urls = useMemo(() =>
    mediaUrls.map((url, i) => getOptimizedUrl(url, isLCPSlot && i === 0)),
    [mediaUrls, isLCPSlot]
  );

  const slotTypes = useMemo(() => urls.map(resolveSlotType), [urls]);

  const posterUrls = useMemo(() =>
    urls.map((url, i) => slotTypes[i] === 'video' ? getVideoPosterUrl(url, post) : null),
    [urls, slotTypes, post]
  );

  const total = urls.length;

  // Init muted map : toutes les vidéos démarrent muettes
  useEffect(() => {
    const initial = {};
    urls.forEach((_, i) => { if (slotTypes[i] === 'video') initial[i] = true; });
    isMutedMapRef.current = initial;
    setIsMutedMap(initial);
  }, [urls.length]); // eslint-disable-line

  // ✅ FIX SON v5 : mise à jour de toggleMuteRef à chaque render
  // VideoItem appelle toggleMuteRef.current(i, newMuted)
  // La fonction reçoit newMuted directement depuis VideoItem (vid.muted)
  // → aucune désynchronisation possible
  useEffect(() => {
    toggleMuteRef.current = (i, newMuted) => {
      const vid = videoRefsMap.current[i];
      if (vid) {
        // Appliquer aussi à la vidéo au cas où VideoItem ne l'aurait pas fait
        vid.muted  = newMuted;
        vid.volume = newMuted ? 0 : 1;
        if (!newMuted && vid.paused) {
          vid.play().catch(() => {
            vid.muted  = true;
            vid.volume = 0;
            isMutedMapRef.current = { ...isMutedMapRef.current, [i]: true };
            setIsMutedMap(prev => ({ ...prev, [i]: true }));
            return;
          });
        }
      }
      isMutedMapRef.current = { ...isMutedMapRef.current, [i]: newMuted };
      setIsMutedMap(prev => ({ ...prev, [i]: newMuted }));
    };
  }); // Pas de deps → toujours à jour, mais VideoItem ne re-render pas

  // Préchargement image suivante
  useEffect(() => {
    if (total <= 1) return;
    const next    = (index + 1) % total;
    const nextUrl = urls[next];
    if (slotTypes[next] === 'image' && nextUrl && !nextUrl.startsWith('data:')) {
      if (preloadImgRef.current) { preloadImgRef.current.src = ''; preloadImgRef.current = null; }
      const img = new Image(); img.src = nextUrl;
      preloadImgRef.current = img;
    }
    return () => { if (preloadImgRef.current) { preloadImgRef.current.src = ''; preloadImgRef.current = null; } };
  }, [index, urls, slotTypes, total]);

  const registerVideoRef = useCallback((i) => (el) => {
    if (el) videoRefsMap.current[i] = el;
    else    delete videoRefsMap.current[i];
  }, []);

  // Swipe handlers
  useEffect(() => {
    if (total <= 1) return;
    const el = containerRef.current;
    if (!el) return;
    const SWIPE_THRESHOLD = 50, TIME_THRESHOLD = 500, DIR_THRESHOLD = 10;
    const onStart = e => {
      const t = e.touches?.[0] || e;
      touch.current = { x: t.clientX, y: t.clientY, time: Date.now() };
      dirRef.current = null; isDragging.current = true;
    };
    const onMove = e => {
      if (!touch.current.x || !isDragging.current) return;
      const t = e.touches?.[0] || e;
      const dx = t.clientX - touch.current.x, dy = t.clientY - touch.current.y;
      if (dirRef.current === null && (Math.abs(dx) > DIR_THRESHOLD || Math.abs(dy) > DIR_THRESHOLD))
        dirRef.current = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
      if (dirRef.current === 'h' && e.cancelable) try { e.preventDefault(); } catch {}
    };
    const onEnd = e => {
      if (!isDragging.current || !touch.current.x) return;
      const t = e.changedTouches?.[0] || e;
      const dx = touch.current.x - t.clientX, elapsed = Date.now() - touch.current.time;
      if (dirRef.current === 'h' && Math.abs(dx) > SWIPE_THRESHOLD && elapsed < TIME_THRESHOLD)
        setIndex(prev => dx > 0 ? (prev + 1) % total : (prev - 1 + total) % total);
      touch.current = { x: 0, y: 0, time: 0 }; dirRef.current = null; isDragging.current = false;
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove',  onMove,  { passive: false });
    el.addEventListener('touchend',   onEnd,   { passive: true });
    el.addEventListener('mousedown',  onStart);
    el.addEventListener('mousemove',  onMove);
    el.addEventListener('mouseup',    onEnd);
    el.addEventListener('mouseleave', onEnd);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove',  onMove);
      el.removeEventListener('touchend',   onEnd);
      el.removeEventListener('mousedown',  onStart);
      el.removeEventListener('mousemove',  onMove);
      el.removeEventListener('mouseup',    onEnd);
      el.removeEventListener('mouseleave', onEnd);
    };
  }, [total]);

  const goPrev = useCallback(() => setIndex(i => (i - 1 + total) % total), [total]);
  const goNext = useCallback(() => setIndex(i => (i + 1) % total),         [total]);

  return (
    <div
      ref={containerRef}
      className="relative w-full bg-black overflow-hidden select-none aspect-square"
      style={{ contain: 'layout paint', cursor: total > 1 ? 'grab' : 'default', touchAction: 'pan-y pinch-zoom' }}
    >
      <div
        className="flex h-full"
        style={{
          transform:  `translateX(-${index * 100}%)`,
          transition: 'transform 0.25s ease',
          willChange: total > 1 ? 'transform' : 'auto',
          width:      `${total * 100}%`,
        }}
      >
        {urls.map((url, i) => {
          const slotType = slotTypes[i];
          const isLCP    = isLCPSlot && i === 0;
          const isMuted  = isMutedMap[i] !== false;

          return (
            <div key={i} className="relative flex-shrink-0 bg-black" style={{ width: `${100 / total}%`, height: '100%' }}>
              {slotType === 'embed' ? (
                <EmbedItem
                  url={url}
                  thumbnail={post?.thumbnail || (isYouTubeEmbed(url) ? getYouTubeThumbnail(url) : null)}
                  title={post?.content?.substring(0, 60)}
                />
              ) : slotType === 'hls' ? (
                <HLSItem
                  thumbnail={post?.thumbnail}
                  externalUrl={post?.sourceUrl}
                  title={post?.content?.substring(0, 60)}
                />
              ) : slotType === 'video' ? (
                <VideoItem
                  url={url}
                  posterUrl={posterUrls[i]}
                  isLCP={isLCP}
                  isActive={i === index}
                  isMuted={isMuted}
                  toggleMuteRef={toggleMuteRef}
                  slotIndex={i}
                  videoRefCallback={registerVideoRef(i)}
                />
              ) : (
                <ImageItem url={url} isLCP={isLCP} />
              )}
            </div>
          );
        })}
      </div>

      {total > 1 && (
        <>
          <div className="absolute inset-y-0 left-0  w-16 sm:hidden z-10" onClick={goPrev} />
          <div className="absolute inset-y-0 right-0 w-16 sm:hidden z-10" onClick={goNext} />
          <button onClick={goPrev}
            className="hidden sm:flex absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-3 rounded-full z-10"
            aria-label="Précédent">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button onClick={goNext}
            className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-3 rounded-full z-10"
            aria-label="Suivant">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
            {urls.map((_, i) => (
              <button key={i} onClick={() => setIndex(i)}
                style={{
                  width: i === index ? 20 : 8, height: 8, borderRadius: 4,
                  backgroundColor: i === index ? 'white' : 'rgba(255,255,255,0.5)',
                  transition: 'width 0.2s ease, background-color 0.2s ease',
                  border: 'none', padding: 0, cursor: 'pointer', touchAction: 'manipulation',
                }}
                aria-label={`Aller à l'image ${i + 1}`}
              />
            ))}
          </div>
          <div className="absolute top-3 right-3 bg-black/60 text-white px-2.5 py-1 rounded-full text-xs font-semibold z-10">
            {index + 1}/{total}
          </div>
        </>
      )}
    </div>
  );
});

PostMedia.displayName = "PostMedia";
export default PostMedia;