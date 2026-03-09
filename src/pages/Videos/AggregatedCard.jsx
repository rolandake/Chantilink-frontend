// 📁 src/pages/Videos/AggregatedCard.jsx
//
// ✅ NOUVEAUTÉS :
//   - Vidéo en BOUCLE : loop sur <video> + onEnded relance play()
//   - Barre de progression SEEKABLE : clic ou drag pour avancer/reculer
//     → pointerId capture pour drag fluide même en dehors de la barre
//
// CONSERVÉS :
//   - feedLock sur actions
//   - Modal commentaires dans createPortal
//   - onVideoError / buildVideoUrl / NoAudioBadge / VimeoEmbed
//   - Timeout 4s cohérent avec probe

import React, { useEffect, useRef, useState, memo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { lockFeed, unlockFeed } from './VideoCard';
import {
  FaHeart, FaRegHeart, FaComment, FaShare, FaExternalLinkAlt,
  FaVolumeUp, FaVolumeMute, FaPlay, FaImage,
} from 'react-icons/fa';
import { IoSend } from 'react-icons/io5';

const API_URL  = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const API_BASE = API_URL.replace(/\/api$/, '');
const USER_INTERACTED_KEY = 'vp_user_interacted';

// ── URL builder ───────────────────────────────────────────────────────────────
const buildVideoUrl = (content) => {
  if (!content) return null;
  if (content.source === 'pixabay' && content.externalId) return `${API_BASE}/api/proxy/video?id=${content.externalId}`;
  if (content.videoUrl?.includes('res.cloudinary.com')) return content.videoUrl;
  if (content.videoUrl?.includes('cdn.pixabay.com/video')) return `${API_BASE}/api/proxy/video?url=${encodeURIComponent(content.videoUrl)}`;
  return content.videoUrl || null;
};

const generateAvatar = (name = 'U') => {
  const c      = (name || 'U').charAt(0).toUpperCase();
  const colors = ['#EF4444','#3B82F6','#10B981','#F59E0B','#8B5CF6','#EC4899'];
  const color  = colors[c.charCodeAt(0) % colors.length];
  return `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="${encodeURIComponent(color)}"/><text x="50%" y="50%" font-size="50" fill="white" text-anchor="middle" dy=".3em" font-family="Arial">${c}</text></svg>`;
};

// ── useVideoPlayer ─────────────────────────────────────────────────────────────
function useVideoPlayer({ videoRef, src, isActive, muted, onMutedChange, onError }) {
  const mutedRef = useRef(muted);
  const srcRef   = useRef(null);

  useEffect(() => { mutedRef.current = muted; }, [muted]);

  useEffect(() => {
    if (!src || src === srcRef.current) return;
    const vid = videoRef.current;
    if (!vid) return;
    srcRef.current = src;
    vid.src = src; vid.muted = true; vid.volume = 1;
  }, [src, videoRef]);

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;

    if (isActive) {
      vid.muted = true; vid.volume = 1;
      let timerId = null;

      const tryPlay = () => {
        if (timerId) { clearTimeout(timerId); timerId = null; }
        vid.play()
          .then(() => {
            if (sessionStorage.getItem(USER_INTERACTED_KEY) === '1') {
              vid.muted  = mutedRef.current;
              vid.volume = mutedRef.current ? 0 : 1;
            }
          })
          .catch(err => {
            if (err.name !== 'AbortError') { vid.muted = true; onMutedChange?.(true); }
          });
      };

      if (vid.readyState >= 3) {
        tryPlay();
      } else {
        timerId = setTimeout(() => { if (vid.readyState < 1) onError?.(); }, 4000);
        const onCan = () => {
          vid.removeEventListener('canplay', onCan);
          if (timerId) { clearTimeout(timerId); timerId = null; }
          tryPlay();
        };
        vid.addEventListener('canplay', onCan);
        return () => { vid.removeEventListener('canplay', onCan); if (timerId) clearTimeout(timerId); };
      }
    } else {
      vid.pause(); vid.muted = true; vid.volume = 1;
    }
  }, [isActive]); // eslint-disable-line

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.muted = muted; vid.volume = muted ? 0 : 1;
    if (!muted && vid.paused && isActive) vid.play().catch(() => { vid.muted = true; onMutedChange?.(true); });
  }, [muted]); // eslint-disable-line

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    const fn = () => onError?.();
    vid.addEventListener('error', fn);
    return () => vid.removeEventListener('error', fn);
  }, [videoRef, onError]);
}

// ── SeekBar — barre de progression cliquable + draggable ──────────────────────
const SeekBar = memo(({ progress, videoRef, isEmbed }) => {
  const barRef    = useRef(null);
  const dragging  = useRef(false);

  const seekTo = useCallback((clientX) => {
    if (isEmbed) return;
    const vid = videoRef.current;
    const bar = barRef.current;
    if (!vid || !bar || !vid.duration) return;
    const rect   = bar.getBoundingClientRect();
    const ratio  = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    vid.currentTime = ratio * vid.duration;
  }, [videoRef, isEmbed]);

  const onPointerDown = useCallback((e) => {
    if (isEmbed) return;
    e.stopPropagation();
    dragging.current = true;
    barRef.current?.setPointerCapture(e.pointerId);
    seekTo(e.clientX);
    lockFeed();
  }, [seekTo, isEmbed]);

  const onPointerMove = useCallback((e) => {
    if (!dragging.current) return;
    e.stopPropagation();
    seekTo(e.clientX);
  }, [seekTo]);

  const onPointerUp = useCallback((e) => {
    if (!dragging.current) return;
    dragging.current = false;
    e.stopPropagation();
    unlockFeed();
  }, []);

  return (
    <div
      ref={barRef}
      className="absolute top-0 left-0 right-0 z-20"
      style={{
        height: 20,                        // zone de touch plus large que l'affichage
        cursor: isEmbed ? 'default' : 'pointer',
        touchAction: 'none',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* Piste visible */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gray-800/30">
        <div
          className="h-full bg-white/70 transition-none"
          style={{ width: `${progress}%` }}
        />
        {/* Poignée */}
        {!isEmbed && (
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-md"
            style={{ left: `calc(${progress}% - 6px)`, pointerEvents: 'none' }}
          />
        )}
      </div>
    </div>
  );
});
SeekBar.displayName = 'SeekBar';

// ── DirectVideo ────────────────────────────────────────────────────────────────
const DirectVideo = memo(({ content, isActive, muted, onMutedChange, onError, onTogglePlay, onTimeUpdate, onDoubleTap, onEnded, videoRef }) => {
  useVideoPlayer({ videoRef, src: buildVideoUrl(content), isActive, muted, onMutedChange, onError });
  return (
    <video ref={videoRef}
      className="w-full h-full object-cover"
      style={{ position:'absolute', inset:0, width:'100%', height:'100%', contain:'strict' }}
      playsInline preload="auto"
      loop                            // ✅ BOUCLE native
      poster={content.thumbnail || undefined}
      onClick={onTogglePlay} onDoubleClick={onDoubleTap}
      onTimeUpdate={onTimeUpdate} onEnded={onEnded}
    />
  );
});
DirectVideo.displayName = 'DirectVideo';

// ── HlsVideo ───────────────────────────────────────────────────────────────────
const HlsVideo = memo(({ content, isActive, muted, onMutedChange, onError, onTogglePlay, onTimeUpdate, onDoubleTap, onEnded, videoRef }) => {
  const hlsRef   = useRef(null);
  const mutedRef = useRef(muted);
  useEffect(() => { mutedRef.current = muted; }, [muted]);

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || !content.videoUrl) return;
    const setup = async () => {
      try {
        const { default: Hls } = await import('hls.js');
        if (Hls.isSupported()) {
          hlsRef.current?.destroy();
          const hls = new Hls({ enableWorker:false, maxBufferLength:30 });
          hlsRef.current = hls;
          hls.loadSource(content.videoUrl);
          hls.attachMedia(vid);
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            vid.muted = true; vid.volume = 1;
            if (isActive) vid.play().then(() => {
              if (sessionStorage.getItem(USER_INTERACTED_KEY) === '1') { vid.muted = mutedRef.current; vid.volume = mutedRef.current ? 0 : 1; }
            }).catch(() => {});
          });
          hls.on(Hls.Events.ERROR, (_, d) => { if (d.fatal) onError?.(); });
        } else if (vid.canPlayType('application/vnd.apple.mpegurl')) {
          vid.src = content.videoUrl; vid.muted = true;
        }
      } catch (e) { console.error('[HLS]', e.message); vid.src = content.videoUrl; vid.muted = true; }
    };
    setup();
    return () => { hlsRef.current?.destroy(); hlsRef.current = null; };
  }, [content.videoUrl]); // eslint-disable-line

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    if (isActive) {
      vid.muted = true;
      vid.play().then(() => {
        if (sessionStorage.getItem(USER_INTERACTED_KEY) === '1') { vid.muted = mutedRef.current; vid.volume = mutedRef.current ? 0 : 1; }
      }).catch(() => {});
    } else { vid.pause(); vid.muted = true; }
  }, [isActive]); // eslint-disable-line

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.muted = muted; vid.volume = muted ? 0 : 1;
    if (!muted && vid.paused && isActive) vid.play().catch(() => { vid.muted = true; onMutedChange?.(true); });
  }, [muted]); // eslint-disable-line

  return (
    <video ref={videoRef}
      className="w-full h-full object-cover"
      style={{ position:'absolute', inset:0, width:'100%', height:'100%', contain:'strict' }}
      playsInline preload="auto"
      loop                            // ✅ BOUCLE native
      poster={content.thumbnail || undefined}
      onClick={onTogglePlay} onDoubleClick={onDoubleTap}
      onTimeUpdate={onTimeUpdate} onEnded={onEnded}
    />
  );
});
HlsVideo.displayName = 'HlsVideo';

// ── VimeoEmbed ────────────────────────────────────────────────────────────────
const VimeoEmbed = memo(({ content, isActive, muted }) => {
  const iframeRef  = useRef(null);
  const isReadyRef = useRef(false);
  const pendingRef = useRef([]);

  const postCmd = useCallback((method, value) => {
    const payload = JSON.stringify(value !== undefined ? { method, value } : { method });
    if (isReadyRef.current) iframeRef.current?.contentWindow?.postMessage(payload, '*');
    else pendingRef.current.push(payload);
  }, []);

  useEffect(() => {
    const handle = (event) => {
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data?.event === 'ready') {
          isReadyRef.current = true;
          pendingRef.current.forEach(p => iframeRef.current?.contentWindow?.postMessage(p, '*'));
          pendingRef.current = [];
          iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ method:'setVolume', value: muted ? 0 : 1 }), '*');
          if (isActive) iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ method:'play' }), '*');
        }
        // ✅ BOUCLE Vimeo : relancer à la fin
        if (data?.event === 'finish') {
          iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ method:'seekTo', value: 0 }), '*');
          iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ method:'play' }), '*');
        }
      } catch {}
    };
    window.addEventListener('message', handle);
    return () => window.removeEventListener('message', handle);
  }, []); // eslint-disable-line

  useEffect(() => { isReadyRef.current = false; pendingRef.current = []; }, [content.videoUrl]);
  useEffect(() => { if (isActive) { postCmd('play'); postCmd('setVolume', muted ? 0 : 1); } else postCmd('pause'); }, [isActive, postCmd]); // eslint-disable-line
  useEffect(() => { postCmd('setVolume', muted ? 0 : 1); }, [muted, postCmd]);

  const src = content.videoUrl ? (content.videoUrl.includes('?') ? `${content.videoUrl}&api=1&loop=1` : `${content.videoUrl}?api=1&loop=1`) : '';
  return (
    <iframe ref={iframeRef} src={src}
      className="w-full h-full"
      style={{ position:'absolute', inset:0, width:'100%', height:'100%' }}
      allow="autoplay; fullscreen; picture-in-picture" allowFullScreen frameBorder="0"
      title={content.title || 'Vimeo video'} />
  );
});
VimeoEmbed.displayName = 'VimeoEmbed';

// ── Contenus non-vidéo ────────────────────────────────────────────────────────
const ImageContent = memo(({ content, onDoubleTap }) => {
  const [loaded, setLoaded] = useState(false);
  const [error,  setError]  = useState(false);
  return (
    <div className="w-full h-full bg-gray-900 flex items-center justify-center" onDoubleClick={onDoubleTap}>
      {!loaded && !error && <div className="absolute inset-0 flex items-center justify-center"><div className="w-10 h-10 border-4 border-gray-700 border-t-white rounded-full animate-spin" /></div>}
      {!error
        ? <img src={content.imageUrl || content.thumbnail} alt={content.title}
            className={`max-w-full max-h-full object-contain transition-opacity duration-300 ${loaded?'opacity-100':'opacity-0'}`}
            onLoad={() => setLoaded(true)} onError={() => setError(true)} />
        : <div className="flex flex-col items-center gap-3 text-gray-500"><FaImage className="text-5xl" /><p className="text-sm">Image non disponible</p></div>
      }
    </div>
  );
});
ImageContent.displayName = 'ImageContent';

const ArticleContent = memo(({ content }) => (
  <div className="w-full h-full flex flex-col bg-gray-950" style={{ borderTop:'4px solid #F26522' }}>
    {content.thumbnail && (
      <div className="flex-shrink-0 h-48 overflow-hidden">
        <img src={content.thumbnail} alt={content.title} className="w-full h-full object-cover" onError={e => { e.target.style.display='none'; }} />
      </div>
    )}
    <div className="flex-1 overflow-y-auto p-6 pt-16">
      <h2 className="text-white text-2xl font-black leading-tight mb-4">{content.title}</h2>
      <p className="text-gray-300 text-base leading-relaxed">{content.description}</p>
      {content.externalUrl && (
        <a href={content.externalUrl} target="_blank" rel="noopener noreferrer"
          className="mt-6 inline-flex items-center gap-2 text-sm font-bold py-2 px-4 rounded-full bg-orange-500 text-white">
          Lire l'article <FaExternalLinkAlt className="text-xs" />
        </a>
      )}
    </div>
  </div>
));
ArticleContent.displayName = 'ArticleContent';

const VideoError = memo(({ thumbnail }) => (
  <div className="relative w-full h-full bg-gray-900 flex flex-col items-center justify-center gap-3">
    {thumbnail && <img src={thumbnail} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20" />}
    <div className="relative z-10 flex flex-col items-center gap-2">
      <div className="text-gray-400 text-4xl">📹</div>
      <p className="text-gray-400 text-xs text-center px-6">Vidéo indisponible</p>
    </div>
  </div>
));
VideoError.displayName = 'VideoError';

const SoundHint = memo(() => (
  <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
    className="absolute bottom-32 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/20 pointer-events-none">
    <FaVolumeUp className="text-white text-sm" />
    <span className="text-white text-xs font-semibold">Appuie pour activer le son</span>
  </motion.div>
));
SoundHint.displayName = 'SoundHint';

const NoAudioBadge = memo(() => (
  <div className="absolute top-16 left-3 z-40 flex items-center gap-1.5 bg-black/50 backdrop-blur-sm px-2.5 py-1 rounded-full border border-white/10 pointer-events-none">
    <FaVolumeMute className="text-white/60 text-xs" />
    <span className="text-white/60 text-[10px] font-medium">Sans son</span>
  </div>
));
NoAudioBadge.displayName = 'NoAudioBadge';

// ── AggregatedCard ─────────────────────────────────────────────────────────────
const AggregatedCard = ({ content, isActive, onVideoEnded, onModalChange, onVideoError }) => {
  if (!content) return null;

  const { user: currentUser, getToken } = useAuth();

  const [muted,         setMuted]         = useState(true);
  const [showSoundHint, setShowSoundHint] = useState(false);
  const [isPaused,      setIsPaused]      = useState(false);
  const [showHeart,     setShowHeart]     = useState(false);
  const [showComments,  setShowComments]  = useState(false);
  const [isLiked,       setIsLiked]       = useState(false);
  const [localLikes,    setLocalLikes]    = useState(content.localLikesCount || 0);
  const [localComments, setLocalComments] = useState([]);
  const [newComment,    setNewComment]    = useState('');
  const [progress,      setProgress]      = useState(0);
  const [videoError,    setVideoError]    = useState(false);

  const videoRef        = useRef(null);
  const isEndedFiredRef = useRef(false);
  const onVideoEndedRef = useRef(onVideoEnded);
  useEffect(() => { onVideoEndedRef.current = onVideoEnded; }, [onVideoEnded]);

  const handleVideoError = useCallback(() => {
    setVideoError(true);
    setTimeout(() => onVideoError?.(), 300);
  }, [onVideoError]);

  const isHLS           = !!content.isHLS;
  const isEmbed         = !!content.isEmbed;
  const contentType     = content.contentType || 'video';
  const isShortVideo    = content.type === 'short_video';
  const isDirectVid     = contentType === 'video' && !isEmbed && !isHLS;
  const isImage         = contentType === 'image';
  const isText          = contentType === 'text' || contentType === 'article';
  const showVideoPlayer = (isShortVideo || isDirectVid || isHLS) && !videoError;
  const showEmbed       = isEmbed && !videoError;
  const showMuteBtn     = showVideoPlayer || showEmbed;
  const videoHasNoAudio = content.hasAudio !== true && !isEmbed && !isHLS
    && content.platform === 'Pexels';

  useEffect(() => { isEndedFiredRef.current = false; }, [content._id]);

  useEffect(() => {
    if (!isActive || (!showVideoPlayer && !showEmbed)) return;
    if (sessionStorage.getItem(USER_INTERACTED_KEY) !== '1') {
      setShowSoundHint(true);
      const t = setTimeout(() => setShowSoundHint(false), 3000);
      return () => clearTimeout(t);
    }
  }, [isActive, showVideoPlayer, showEmbed]);

  useEffect(() => {
    if (!isActive || !content._id) return;
    const t = setTimeout(async () => {
      try { await fetch(`${API_URL}/aggregated/${content._id}/view`, { method:'POST' }); } catch {}
    }, 3000);
    return () => clearTimeout(t);
  }, [isActive, content._id]);

  useEffect(() => {
    if (!isActive) {
      if (!videoHasNoAudio) setMuted(sessionStorage.getItem(USER_INTERACTED_KEY) === '1' ? false : true);
      setVideoError(false); setIsPaused(false); setProgress(0); setShowSoundHint(false);
    }
  }, [isActive, videoHasNoAudio]);

  const handleTimeUpdate = useCallback(e => {
    const v = e.target;
    if (v?.duration) setProgress((v.currentTime / v.duration) * 100);
  }, []);

  // ✅ BOUCLE : onEnded relance la lecture (filet de sécurité si loop ne suffit pas)
  const handleEnded = useCallback(() => {
    const vid = videoRef.current;
    if (vid && !isEmbed) {
      vid.currentTime = 0;
      vid.play().catch(() => {});
      return; // pas de onVideoEnded → on boucle
    }
    // Pour les embeds non-Vimeo, notifier le parent une seule fois
    if (isEndedFiredRef.current) return;
    isEndedFiredRef.current = true;
    onVideoEndedRef.current?.();
  }, [isEmbed]);

  const activateSound = useCallback(e => {
    e?.stopPropagation();
    sessionStorage.setItem(USER_INTERACTED_KEY, '1');
    setShowSoundHint(false); setMuted(false);
    const vid = videoRef.current;
    if (vid && !isEmbed) { vid.muted=false; vid.volume=1; if (vid.paused && isActive) vid.play().catch(() => { vid.muted=true; setMuted(true); }); }
  }, [isActive, isEmbed]);

  const handleTogglePlay = useCallback(e => {
    e?.stopPropagation();
    if (sessionStorage.getItem(USER_INTERACTED_KEY) !== '1') { activateSound(e); return; }
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play().catch(() => {}); setIsPaused(false); } else { v.pause(); setIsPaused(true); }
  }, [activateSound]);

  const handleDoubleTap = useCallback(e => {
    e?.stopPropagation();
    setShowHeart(true); setTimeout(() => setShowHeart(false), 800);
    if (!isLiked) handleLike(); // eslint-disable-line
  }, [isLiked]); // eslint-disable-line

  const handleLike = useCallback(async e => {
    e?.stopPropagation();
    if (!currentUser) return;
    const was = isLiked;
    setIsLiked(!was); setLocalLikes(p => was ? p-1 : p+1);
    try {
      const token = await getToken();
      await fetch(`${API_URL}/aggregated/${content._id}/like`, { method:'POST', headers:{ Authorization:`Bearer ${token}` } });
    } catch { setIsLiked(was); setLocalLikes(p => was ? p+1 : p-1); }
  }, [currentUser, isLiked, content._id, getToken]);

  const handleToggleMute = useCallback(e => {
    e.stopPropagation();
    if (videoHasNoAudio) return;
    sessionStorage.setItem(USER_INTERACTED_KEY, '1');
    setShowSoundHint(false);
    const nm = !muted; setMuted(nm);
    const vid = videoRef.current;
    if (vid && !isEmbed) {
      vid.muted=nm; vid.volume=nm?0:1;
      if (!nm && vid.paused && isActive) vid.play().catch(() => { vid.muted=true; setMuted(true); });
    }
  }, [muted, isActive, isEmbed, videoHasNoAudio]);

  const handleCommentSubmit = useCallback(async () => {
    if (!newComment.trim() || !currentUser) return;
    const temp = { _id: Date.now(), user: currentUser, text: newComment, createdAt: new Date().toISOString() };
    setLocalComments(p => [...p, temp]); setNewComment('');
    try {
      const token = await getToken();
      await fetch(`${API_URL}/aggregated/${content._id}/comment`, {
        method:'POST', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` },
        body: JSON.stringify({ text: temp.text }),
      });
    } catch { setLocalComments(p => p.filter(c => c._id !== temp._id)); }
  }, [newComment, currentUser, content._id, getToken]);

  const handleShare = useCallback(async e => {
    e.stopPropagation();
    const url = content.externalUrl || window.location.href;
    if (navigator.share) try { await navigator.share({ title:content.title, url }); } catch {}
    else navigator.clipboard?.writeText(url);
  }, [content.externalUrl, content.title]);

  const onActDown = useCallback(e => { e.stopPropagation(); lockFeed();   }, []);
  const onActUp   = useCallback(e => { e.stopPropagation(); unlockFeed(); }, []);

  const openComments  = useCallback(e => { e.stopPropagation(); lockFeed(); setShowComments(true);  onModalChange?.(true);  }, [onModalChange]);
  const closeComments = useCallback(()  => { unlockFeed();                  setShowComments(false); onModalChange?.(false); }, [onModalChange]);

  const commentsModal = showComments ? createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end"
      onPointerDown={e => e.stopPropagation()}
      onTouchStart={e => e.stopPropagation()}
    >
      <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeComments} />
      <motion.div initial={{ y:'100%' }} animate={{ y:0 }} exit={{ y:'100%' }}
        className="relative w-full bg-gray-900 rounded-t-3xl h-[70vh] flex flex-col shadow-2xl z-10"
        onPointerDown={e => e.stopPropagation()}
        onTouchStart={e => e.stopPropagation()}
      >
        <div className="p-4 border-b border-gray-800 flex justify-between items-center flex-shrink-0">
          <span className="font-bold text-white">Commentaires</span>
          <button onClick={closeComments} className="text-gray-400 p-2 text-lg">×</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {localComments.length === 0 && <p className="text-gray-500 text-center text-sm mt-8">Sois le premier à commenter !</p>}
          {localComments.map((c, i) => {
            const cu = c.user || c.uploadedBy;
            const cn = cu?.username || cu?.fullName || 'Utilisateur';
            return (
              <div key={c._id || i} className="flex gap-3 items-start">
                <img src={cu?.profilePhoto || cu?.profilePicture || generateAvatar(cn)}
                  width={32} height={32} style={{ aspectRatio:'1/1', flexShrink:0 }}
                  className="w-8 h-8 rounded-full bg-gray-700 object-cover"
                  onError={e => { e.target.onerror=null; e.target.src=generateAvatar(cn); }} alt={cn} />
                <div>
                  <p className="text-xs font-bold text-gray-400">{cn}</p>
                  <p className="text-sm text-gray-200">{c.text}</p>
                </div>
              </div>
            );
          })}
        </div>
        <div className="p-4 bg-gray-800 flex gap-2 items-center flex-shrink-0">
          <input value={newComment} onChange={e => setNewComment(e.target.value)}
            onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') handleCommentSubmit(); }}
            placeholder="Votre commentaire..."
            className="flex-1 bg-gray-700 text-white rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-pink-500" />
          <button onClick={handleCommentSubmit} disabled={!newComment.trim()}
            className="p-2 bg-pink-600 rounded-full text-white disabled:opacity-50"><IoSend /></button>
        </div>
      </motion.div>
    </div>,
    document.body
  ) : null;

  if (videoError && onVideoError) {
    return <div className="w-full h-full bg-black" style={{ opacity:0, transition:'opacity 0.3s' }} />;
  }

  return (
    <div className="relative w-full h-full bg-black overflow-hidden select-none">

      {showVideoPlayer && isHLS && (
        <HlsVideo content={content} isActive={isActive} muted={muted} onMutedChange={setMuted}
          onError={handleVideoError} videoRef={videoRef}
          onTogglePlay={handleTogglePlay} onTimeUpdate={handleTimeUpdate}
          onDoubleTap={handleDoubleTap} onEnded={handleEnded} />
      )}
      {showVideoPlayer && !isHLS && (
        <DirectVideo content={content} isActive={isActive} muted={muted} onMutedChange={setMuted}
          onError={handleVideoError} videoRef={videoRef}
          onTogglePlay={handleTogglePlay} onTimeUpdate={handleTimeUpdate}
          onDoubleTap={handleDoubleTap} onEnded={handleEnded} />
      )}
      {showEmbed && <VimeoEmbed content={content} isActive={isActive} muted={muted} onMutedChange={setMuted} />}

      {(isShortVideo || isDirectVid || isHLS || isEmbed) && videoError && !onVideoError && <VideoError thumbnail={content.thumbnail} />}
      {isImage && !isShortVideo && !isDirectVid && !isHLS && <ImageContent content={content} onDoubleTap={handleDoubleTap} />}
      {isText  && !isShortVideo && !isDirectVid && !isHLS && !isImage && <ArticleContent content={content} />}

      {!isText && <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/85 pointer-events-none" />}
      {videoHasNoAudio && isActive && <NoAudioBadge />}

      {/* ✅ Barre de progression seekable */}
      {showVideoPlayer && (
        <SeekBar progress={progress} videoRef={videoRef} isEmbed={false} />
      )}
      {showEmbed && (
        <SeekBar progress={progress} videoRef={videoRef} isEmbed={true} />
      )}

      {showVideoPlayer && isPaused && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <FaPlay className="text-white/50 text-6xl animate-pulse" />
        </div>
      )}

      <AnimatePresence>{showSoundHint && <SoundHint />}</AnimatePresence>
      <AnimatePresence>
        {showHeart && (
          <motion.div initial={{ scale:0, opacity:0 }} animate={{ scale:1.5, opacity:1 }} exit={{ scale:2, opacity:0 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <FaHeart className="text-red-500 text-8xl drop-shadow-2xl" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Infos auteur */}
      {!isText && (
        <div className="absolute bottom-4 left-4 right-16 z-30 pb-safe">
          <div className="flex items-center gap-3 mb-3">
            <img src={content.channelAvatar || generateAvatar(content.channelName)} alt={content.channelName}
              width={40} height={40} style={{ aspectRatio:'1/1', flexShrink:0 }}
              className="w-10 h-10 rounded-full border-2 border-white/50 object-cover bg-gray-700"
              onError={e => { e.target.onerror=null; e.target.src=generateAvatar(content.channelName); }} />
            <div style={{ minWidth:0 }}>
              <p className="font-bold text-white text-sm drop-shadow-md truncate">{content.channelName}</p>
              {content.platform && <p className="text-white/60 text-xs">{content.platform}</p>}
            </div>
            {content.externalUrl && (
              <a href={content.externalUrl} target="_blank" rel="noopener noreferrer"
                onClick={e => e.stopPropagation()} className="ml-auto text-white/70 hover:text-white p-2">
                <FaExternalLinkAlt className="text-xs" />
              </a>
            )}
          </div>
          {content.title && <p className="text-white/90 text-sm mb-2 max-w-[90%] drop-shadow-md line-clamp-2">{content.title}</p>}
          <div className="flex flex-wrap gap-1">
            {(content.hashtags || content.tags || []).slice(0, 3).map((t, i) => (
              <span key={i} className="text-xs text-white/70 bg-white/10 px-2 py-0.5 rounded-full">#{t}</span>
            ))}
          </div>
        </div>
      )}

      {/* Barre d'actions */}
      <div className="absolute right-2 bottom-20 flex flex-col items-center gap-6 z-40 pb-safe pointer-events-auto"
        onPointerDown={onActDown} onPointerUp={onActUp} onPointerCancel={onActUp}
        onTouchStart={e => e.stopPropagation()}
      >
        <div className="flex flex-col items-center gap-1">
          <motion.button whileTap={{ scale:0.8 }} onClick={handleLike}
            className={`w-10 h-10 rounded-full flex items-center justify-center text-3xl drop-shadow-xl ${isLiked?'text-red-500':'text-white'}`}>
            {isLiked ? <FaHeart /> : <FaRegHeart />}
          </motion.button>
          <span className="text-xs font-bold text-white drop-shadow-md">{localLikes}</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <motion.button whileTap={{ scale:0.8 }} onClick={openComments}
            className="w-10 h-10 rounded-full flex items-center justify-center text-white text-3xl drop-shadow-xl">
            <FaComment />
          </motion.button>
          <span className="text-xs font-bold text-white drop-shadow-md">{localComments.length + (content.localCommentsCount || 0)}</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <motion.button whileTap={{ scale:0.8 }} onClick={handleShare}
            className="w-10 h-10 rounded-full flex items-center justify-center text-white text-3xl drop-shadow-xl">
            <FaShare />
          </motion.button>
          <span className="text-xs font-bold text-white drop-shadow-md">Partager</span>
        </div>
        {showMuteBtn && !videoHasNoAudio && (
          <motion.button whileTap={{ scale:0.9 }} onClick={handleToggleMute}
            className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center text-white mt-2">
            {muted ? <FaVolumeMute /> : <FaVolumeUp />}
          </motion.button>
        )}
      </div>

      {commentsModal}
    </div>
  );
};

AggregatedCard.displayName = 'AggregatedCard';
export default memo(AggregatedCard, (prev, next) =>
  prev.isActive      === next.isActive     &&
  prev.content._id   === next.content._id  &&
  prev.onModalChange === next.onModalChange &&
  prev.onVideoError  === next.onVideoError
);