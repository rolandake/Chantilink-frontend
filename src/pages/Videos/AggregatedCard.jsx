// 📁 src/pages/Videos/AggregatedCard.jsx
// ✅ Son activé automatiquement dès le premier tap utilisateur
// ✅ Badge source supprimé
// ✅ Auto-scroll via onVideoEnded
// ✅ Proxy backend Pexels/Pixabay

import React, { useEffect, useRef, useState, memo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import {
  FaHeart, FaRegHeart, FaComment, FaShare, FaExternalLinkAlt,
  FaVolumeUp, FaVolumeMute, FaPlay, FaImage,
} from 'react-icons/fa';
import { IoSend } from 'react-icons/io5';

const API_URL  = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const API_BASE = API_URL.replace(/\/api$/, '');

// ── Clé localStorage : "l'utilisateur a déjà interagi" ───────────────
const USER_INTERACTED_KEY = 'vp_user_interacted';

const proxyVideoUrl = (url) => {
  if (!url) return url;
  if (url.includes('videos.pexels.com') || url.includes('cdn.pixabay.com/video')) {
    return `${API_BASE}/api/proxy/video?url=${encodeURIComponent(url)}`;
  }
  return url;
};

const generateAvatar = (name = 'U') => {
  const char   = (name || 'U').charAt(0).toUpperCase();
  const colors = ['#EF4444','#3B82F6','#10B981','#F59E0B','#8B5CF6','#EC4899'];
  const color  = colors[char.charCodeAt(0) % colors.length];
  return `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="${encodeURIComponent(color)}"/><text x="50%" y="50%" font-size="50" fill="white" text-anchor="middle" dy=".3em" font-family="Arial">${char}</text></svg>`;
};

// ─────────────────────────────────────────────────────────────────────
// DirectVideo — gestion son avec activation automatique premier tap
// ─────────────────────────────────────────────────────────────────────
const DirectVideo = memo(({ content, isActive, muted, onMutedChange, onTogglePlay, onTimeUpdate, onDoubleTap, onEnded, videoRef }) => {
  const proxiedUrl = proxyVideoUrl(content.videoUrl);

  // Charger la source
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.src    = proxiedUrl || '';
    vid.muted  = true; // toujours démarrer muet (règle navigateur)
    vid.volume = 1;
    vid.load();
  }, [proxiedUrl]); // eslint-disable-line

  // Lecture / pause selon isActive
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;

    if (isActive) {
      // Vérifier si l'utilisateur a déjà interagi (tap précédent)
      const hasInteracted = sessionStorage.getItem(USER_INTERACTED_KEY) === '1';

      vid.muted  = true;
      vid.volume = 1;

      vid.play()
        .then(() => {
          // ✅ Si l'utilisateur a déjà tapé une fois → activer le son
          if (hasInteracted && !muted) {
            vid.muted  = false;
            vid.volume = 1;
          } else if (hasInteracted && muted) {
            // Il a explicitement coupé le son → respecter son choix
            vid.muted = true;
          }
          // Sinon : première vidéo, reste muet jusqu'au premier tap
        })
        .catch(() => {
          vid.muted = true;
          onMutedChange(true);
        });
    } else {
      vid.pause();
      vid.muted  = true;
      vid.volume = 1;
      try { vid.currentTime = 0; } catch {}
    }
  }, [isActive]); // eslint-disable-line

  // Sync muted state → DOM
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.muted  = muted;
    vid.volume = muted ? 0 : 1;
    if (!muted && vid.paused && isActive) {
      vid.play().catch(() => { vid.muted = true; onMutedChange(true); });
    }
  }, [muted]); // eslint-disable-line

  return (
    <video
      ref={videoRef}
      className="w-full h-full object-cover"
      playsInline
      preload="metadata"
      poster={content.thumbnail || undefined}
      onClick={onTogglePlay}
      onDoubleClick={onDoubleTap}
      onTimeUpdate={onTimeUpdate}
      onEnded={onEnded}
      // Pas de loop → onEnded déclenche l'auto-scroll
    />
  );
});
DirectVideo.displayName = 'DirectVideo';

const ImageContent = memo(({ content, onDoubleTap }) => {
  const [loaded, setLoaded] = useState(false);
  const [error,  setError]  = useState(false);
  return (
    <div className="w-full h-full bg-gray-900 flex items-center justify-center" onDoubleClick={onDoubleTap}>
      {!loaded && !error && <div className="absolute inset-0 flex items-center justify-center"><div className="w-10 h-10 border-4 border-gray-700 border-t-white rounded-full animate-spin" /></div>}
      {!error
        ? <img src={content.imageUrl || content.thumbnail} alt={content.title}
            className={`max-w-full max-h-full object-contain transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
            onLoad={() => setLoaded(true)} onError={() => setError(true)} />
        : <div className="flex flex-col items-center gap-3 text-gray-500"><FaImage className="text-5xl" /><p className="text-sm">Image non disponible</p></div>
      }
    </div>
  );
});
ImageContent.displayName = 'ImageContent';

const ArticleContent = memo(({ content }) => (
  <div className="w-full h-full flex flex-col bg-gray-950" style={{ borderTop: '4px solid #F26522' }}>
    {content.thumbnail && (
      <div className="flex-shrink-0 h-48 overflow-hidden">
        <img src={content.thumbnail} alt={content.title} className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
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

// ─────────────────────────────────────────────────────────────────────
// Overlay "Tap pour activer le son" — affiché uniquement sur la 1ère vidéo
// ─────────────────────────────────────────────────────────────────────
const SoundHint = memo(({ visible, onDismiss }) => {
  if (!visible) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="absolute bottom-32 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/20 pointer-events-none"
    >
      <FaVolumeUp className="text-white text-sm" />
      <span className="text-white text-xs font-semibold">Appuie pour activer le son</span>
    </motion.div>
  );
});
SoundHint.displayName = 'SoundHint';

// ─────────────────────────────────────────────────────────────────────
// AggregatedCard
// ─────────────────────────────────────────────────────────────────────
const AggregatedCard = ({ content, isActive, onVideoEnded }) => {
  if (!content) return null;

  const { user: currentUser, getToken } = useAuth();

  // ✅ Son : démarre muet, s'active au premier tap
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

  const videoRef = useRef(null);

  const contentType  = content.contentType || 'video';
  const isShortVideo = content.type === 'short_video';
  const isVideo      = contentType === 'video' && !content.isEmbed && !content.isHLS;
  const isImage      = contentType === 'image';
  const isText       = contentType === 'text' || contentType === 'article';
  const showVideo    = (isShortVideo || isVideo) && !videoError;

  // Afficher le hint "tap pour son" sur la première vidéo active
  useEffect(() => {
    if (!isActive || !showVideo) return;
    const hasInteracted = sessionStorage.getItem(USER_INTERACTED_KEY) === '1';
    if (!hasInteracted) {
      setShowSoundHint(true);
      // Auto-masquer après 3s
      const t = setTimeout(() => setShowSoundHint(false), 3000);
      return () => clearTimeout(t);
    }
  }, [isActive, showVideo]);

  useEffect(() => {
    if (!isActive || !content._id) return;
    const timer = setTimeout(async () => {
      try { await fetch(`${API_URL}/aggregated/${content._id}/view`, { method: 'POST' }); } catch {}
    }, 3000);
    return () => clearTimeout(timer);
  }, [isActive, content._id]);

  useEffect(() => {
    if (!isActive) { setMuted(true); setVideoError(false); setIsPaused(false); setProgress(0); setShowSoundHint(false); }
  }, [isActive]);

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || !(isShortVideo || isVideo)) return;
    const onError = () => setVideoError(true);
    vid.addEventListener('error', onError);
    return () => vid.removeEventListener('error', onError);
  }, [isShortVideo, isVideo]);

  const handleTimeUpdate = useCallback((e) => {
    const v = e.target;
    if (v?.duration) setProgress((v.currentTime / v.duration) * 100);
  }, []);

  // ✅ Premier tap → marquer l'interaction + activer le son
  const activateSound = useCallback(() => {
    sessionStorage.setItem(USER_INTERACTED_KEY, '1');
    setShowSoundHint(false);
    const vid = videoRef.current;
    if (!vid) return;
    vid.muted  = false;
    vid.volume = 1;
    setMuted(false);
    if (vid.paused && isActive) {
      vid.play().catch(() => { vid.muted = true; setMuted(true); });
    }
  }, [isActive]);

  const handleTogglePlay = useCallback((e) => {
    e?.stopPropagation();
    const hasInteracted = sessionStorage.getItem(USER_INTERACTED_KEY) === '1';

    // Premier tap → activer le son au lieu de pause/play
    if (!hasInteracted) {
      activateSound();
      return;
    }

    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play().catch(() => {}); setIsPaused(false); }
    else          { v.pause(); setIsPaused(true); }
  }, [activateSound]);

  const handleDoubleTap = useCallback((e) => {
    e?.stopPropagation();
    setShowHeart(true);
    setTimeout(() => setShowHeart(false), 800);
    if (!isLiked) handleLike();
  }, [isLiked]); // eslint-disable-line

  const handleEnded = useCallback(() => {
    if (onVideoEnded) onVideoEnded();
  }, [onVideoEnded]);

  const handleLike = useCallback(async (e) => {
    e?.stopPropagation();
    if (!currentUser) return;
    const wasLiked = isLiked;
    setIsLiked(!wasLiked);
    setLocalLikes(p => wasLiked ? p - 1 : p + 1);
    try {
      const token = await getToken();
      await fetch(`${API_URL}/aggregated/${content._id}/like`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    } catch { setIsLiked(wasLiked); setLocalLikes(p => wasLiked ? p + 1 : p - 1); }
  }, [currentUser, isLiked, content._id, getToken]);

  // ✅ Bouton mute/unmute explicite
  const handleToggleMute = useCallback((e) => {
    e.stopPropagation();

    // Marquer l'interaction même via ce bouton
    sessionStorage.setItem(USER_INTERACTED_KEY, '1');
    setShowSoundHint(false);

    const vid      = videoRef.current;
    const newMuted = !muted;
    if (vid) {
      vid.muted  = newMuted;
      vid.volume = newMuted ? 0 : 1;
      if (!newMuted && vid.paused && isActive) {
        vid.play().catch(() => { vid.muted = true; vid.volume = 0; setMuted(true); return; });
      }
    }
    setMuted(newMuted);
  }, [muted, isActive]);

  const handleCommentSubmit = async () => {
    if (!newComment.trim() || !currentUser) return;
    const temp = { _id: Date.now(), user: currentUser, text: newComment, createdAt: new Date().toISOString() };
    setLocalComments(p => [...p, temp]);
    setNewComment('');
    try {
      const token = await getToken();
      await fetch(`${API_URL}/aggregated/${content._id}/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text: temp.text }),
      });
    } catch { setLocalComments(p => p.filter(c => c._id !== temp._id)); }
  };

  const handleShare = async (e) => {
    e.stopPropagation();
    const url = content.externalUrl || window.location.href;
    if (navigator.share) { try { await navigator.share({ title: content.title, url }); } catch {} }
    else { navigator.clipboard?.writeText(url); }
  };

  return (
    <div className="relative w-full h-full bg-black overflow-hidden select-none">

      {showVideo && (
        <DirectVideo
          content={content} isActive={isActive} muted={muted} onMutedChange={setMuted}
          videoRef={videoRef} onTogglePlay={handleTogglePlay} onTimeUpdate={handleTimeUpdate}
          onDoubleTap={handleDoubleTap} onEnded={handleEnded}
        />
      )}
      {(isShortVideo || isVideo) && videoError && <VideoError thumbnail={content.thumbnail} />}
      {isImage && !isShortVideo && !isVideo && <ImageContent content={content} onDoubleTap={handleDoubleTap} />}
      {isText  && !isShortVideo && !isVideo && !isImage && <ArticleContent content={content} />}

      {!isText && <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/85 pointer-events-none" />}

      {/* Barre de progression */}
      {showVideo && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-gray-800/30 z-20">
          <div className="h-full transition-all duration-100 bg-white/70" style={{ width: `${progress}%` }} />
        </div>
      )}

      {/* Icône pause */}
      {showVideo && isPaused && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <FaPlay className="text-white/50 text-6xl animate-pulse" />
        </div>
      )}

      {/* ✅ Hint "tap pour activer le son" */}
      <AnimatePresence>
        {showSoundHint && <SoundHint visible={showSoundHint} />}
      </AnimatePresence>

      {/* Animation cœur double-tap */}
      <AnimatePresence>
        {showHeart && (
          <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1.5, opacity: 1 }} exit={{ scale: 2, opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <FaHeart className="text-red-500 text-8xl drop-shadow-2xl" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Infos bas de carte */}
      {!isText && (
        <div className="absolute bottom-4 left-4 right-16 z-30 pb-safe">
          <div className="flex items-center gap-3 mb-3">
            <img src={content.channelAvatar || generateAvatar(content.channelName)} alt={content.channelName}
              className="w-10 h-10 rounded-full border-2 border-white/50 object-cover bg-gray-700"
              onError={(e) => { e.target.onerror = null; e.target.src = generateAvatar(content.channelName); }} />
            <div>
              <p className="font-bold text-white text-sm drop-shadow-md">{content.channelName}</p>
              {content.platform && <p className="text-white/60 text-xs">{content.platform}</p>}
            </div>
            {content.externalUrl && (
              <a href={content.externalUrl} target="_blank" rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()} className="ml-auto text-white/70 hover:text-white p-2">
                <FaExternalLinkAlt className="text-xs" />
              </a>
            )}
          </div>
          {content.title && (
            <p className="text-white/90 text-sm mb-2 max-w-[90%] drop-shadow-md line-clamp-2">{content.title}</p>
          )}
          <div className="flex flex-wrap gap-1">
            {(content.hashtags || content.tags || []).slice(0, 3).map((t, i) => (
              <span key={i} className="text-xs text-white/70 bg-white/10 px-2 py-0.5 rounded-full">#{t}</span>
            ))}
          </div>
        </div>
      )}

      {/* Boutons actions droite */}
      <div className="absolute right-2 bottom-20 flex flex-col items-center gap-6 z-40 pb-safe pointer-events-auto">
        <div className="flex flex-col items-center gap-1">
          <motion.button whileTap={{ scale: 0.8 }} onClick={handleLike}
            className={`w-10 h-10 rounded-full flex items-center justify-center text-3xl drop-shadow-xl ${isLiked ? 'text-red-500' : 'text-white'}`}>
            {isLiked ? <FaHeart /> : <FaRegHeart />}
          </motion.button>
          <span className="text-xs font-bold text-white drop-shadow-md">{localLikes}</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <motion.button whileTap={{ scale: 0.8 }} onClick={(e) => { e.stopPropagation(); setShowComments(true); }}
            className="w-10 h-10 rounded-full flex items-center justify-center text-white text-3xl drop-shadow-xl">
            <FaComment />
          </motion.button>
          <span className="text-xs font-bold text-white drop-shadow-md">{localComments.length + (content.localCommentsCount || 0)}</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <motion.button whileTap={{ scale: 0.8 }} onClick={handleShare}
            className="w-10 h-10 rounded-full flex items-center justify-center text-white text-3xl drop-shadow-xl">
            <FaShare />
          </motion.button>
          <span className="text-xs font-bold text-white drop-shadow-md">Partager</span>
        </div>

        {/* ✅ Bouton mute/unmute toujours visible */}
        {showVideo && (
          <motion.button whileTap={{ scale: 0.9 }} onClick={handleToggleMute}
            className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center text-white mt-2">
            {muted ? <FaVolumeMute /> : <FaVolumeUp />}
          </motion.button>
        )}
      </div>

      {/* Drawer commentaires */}
      <AnimatePresence>
        {showComments && (
          <div className="fixed inset-0 z-50 flex items-end justify-center pointer-events-auto" onClick={(e) => e.stopPropagation()}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowComments(false)} />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              className="relative w-full max-w-md bg-gray-900 rounded-t-3xl h-[70vh] flex flex-col z-50 shadow-2xl"
              onClick={(e) => e.stopPropagation()}>
              <div className="p-4 border-b border-gray-800 flex justify-between items-center">
                <span className="font-bold text-white">Commentaires</span>
                <button onClick={() => setShowComments(false)} className="text-gray-400 p-2 text-lg">×</button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {localComments.length === 0 && (
                  <p className="text-gray-500 text-center text-sm mt-8">Sois le premier à commenter !</p>
                )}
                {localComments.map((c, i) => (
                  <div key={c._id || i} className="flex gap-3 items-start">
                    <img src={c.user?.profilePhoto || generateAvatar(c.user?.username)}
                      className="w-8 h-8 rounded-full bg-gray-700 object-cover" alt="user"
                      onError={(e) => { e.target.onerror = null; e.target.src = generateAvatar(c.user?.username); }} />
                    <div>
                      <p className="text-xs font-bold text-gray-400">{c.user?.username || 'Utilisateur'}</p>
                      <p className="text-sm text-gray-200">{c.text}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-4 bg-gray-800 flex gap-2 items-center">
                <input value={newComment} onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCommentSubmit()}
                  placeholder="Votre commentaire..."
                  className="flex-1 bg-gray-700 text-white rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-pink-500" />
                <button onClick={handleCommentSubmit} disabled={!newComment.trim()}
                  className="p-2 bg-pink-600 rounded-full text-white disabled:opacity-50">
                  <IoSend />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

AggregatedCard.displayName = 'AggregatedCard';
export default memo(AggregatedCard, (prev, next) =>
  prev.isActive === next.isActive && prev.content._id === next.content._id
);