// 📁 src/pages/Videos/AggregatedCard.jsx
// ✅ Son activé par défaut
// ✅ Badge source supprimé
import React, { useEffect, useRef, useState, memo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import {
  FaHeart, FaRegHeart, FaComment, FaShare, FaExternalLinkAlt,
  FaVolumeUp, FaVolumeMute, FaPlay, FaImage,
  FaReddit, FaVimeo, FaRss,
} from 'react-icons/fa';
import { IoSend } from 'react-icons/io5';
import Hls from 'hls.js';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const SOURCE_CONFIG = {
  reddit:   { color: '#FF4500', label: 'Reddit',   Icon: FaReddit },
  mastodon: { color: '#6364FF', label: 'Mastodon', Icon: () => <span className="text-sm font-black">M</span> },
  vimeo:    { color: '#1AB7EA', label: 'Vimeo',    Icon: FaVimeo },
  rss:      { color: '#F26522', label: 'Actualité', Icon: FaRss },
};

const generateAvatar = (name = 'U') => {
  const char = (name || 'U').charAt(0).toUpperCase();
  const colors = ['#EF4444','#3B82F6','#10B981','#F59E0B','#8B5CF6','#EC4899'];
  const color = colors[char.charCodeAt(0) % colors.length];
  return `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="${encodeURIComponent(color)}"/><text x="50%" y="50%" font-size="50" fill="white" text-anchor="middle" dy=".3em" font-family="Arial">${char}</text></svg>`;
};

// ─────────────────────────────────────────────
// DirectVideo — son activé par défaut + HLS Reddit
// ─────────────────────────────────────────────
const DirectVideo = memo(({ content, isActive, muted, onTogglePlay, onTimeUpdate, onDoubleTap, videoRef }) => {
  const hlsRef = useRef(null);
  const isHLS  = content.isHLS || content.videoUrl?.includes('.m3u8');

  // Init source (HLS ou MP4)
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;

    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }

    // Toujours démarrer muted pour autoplay, puis on active le son après
    vid.muted  = true;
    vid.volume = 1;

    if (isHLS && Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
      hls.loadSource(content.videoUrl);
      hls.attachMedia(vid);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (isActive) vid.play().then(() => { vid.muted = false; vid.volume = 1; }).catch(() => {});
      });
      hlsRef.current = hls;
    } else if (isHLS && vid.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari natif
      vid.src = content.videoUrl;
    } else {
      vid.src = content.videoUrl;
    }

    return () => { if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; } };
  }, [content.videoUrl]); // eslint-disable-line

  // Play/pause + activation son après autoplay réussi
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    if (isActive) {
      vid.muted = true; // requis pour autoplay
      vid.play()
        .then(() => {
          // ✅ Autoplay accepté → activer le son si pas muté
          if (!muted) { vid.muted = false; vid.volume = 1; }
        })
        .catch(() => {});
    } else {
      vid.pause();
      vid.muted  = true;
      vid.volume = 1;
    }
  }, [isActive]); // eslint-disable-line

  // Sync prop muted → élément vidéo
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.muted  = muted;
    vid.volume = muted ? 0 : 1;
  }, [muted]);

  return (
    <video
      ref={videoRef}
      className="w-full h-full object-cover"
      loop playsInline muted autoPlay={false}
      onClick={onTogglePlay}
      onDoubleClick={onDoubleTap}
      onTimeUpdate={onTimeUpdate}
      poster={content.thumbnail}
      preload="metadata"
    />
  );
});
DirectVideo.displayName = 'DirectVideo';

// ─────────────────────────────────────────────
// EmbedVideo (Vimeo)
// ─────────────────────────────────────────────
const EmbedVideo = memo(({ content, isActive }) => {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { if (!isActive) setLoaded(false); }, [isActive]);
  return (
    <div className="w-full h-full relative bg-black">
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          {content.thumbnail && <img src={content.thumbnail} alt="" className="w-full h-full object-cover opacity-50" />}
          <div className="absolute w-14 h-14 border-4 border-gray-600 border-t-white rounded-full animate-spin" />
        </div>
      )}
      {isActive && (
        <iframe src={content.videoUrl} className="w-full h-full border-0"
          allow="autoplay; fullscreen" allowFullScreen onLoad={() => setLoaded(true)} title={content.title} />
      )}
    </div>
  );
});
EmbedVideo.displayName = 'EmbedVideo';

// ─────────────────────────────────────────────
// ImageContent
// ─────────────────────────────────────────────
const ImageContent = memo(({ content, onDoubleTap }) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError]   = useState(false);
  return (
    <div className="w-full h-full bg-gray-900 flex items-center justify-center" onDoubleClick={onDoubleTap}>
      {!loaded && !error && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-gray-700 border-t-white rounded-full animate-spin" />
        </div>
      )}
      {!error ? (
        <img src={content.imageUrl || content.thumbnail} alt={content.title}
          className={`max-w-full max-h-full object-contain transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => setLoaded(true)} onError={() => setError(true)} />
      ) : (
        <div className="flex flex-col items-center gap-3 text-gray-500">
          <FaImage className="text-5xl" /><p className="text-sm">Image non disponible</p>
        </div>
      )}
      {content.isGallery && (
        <div className="absolute top-20 right-4 bg-black/70 text-white text-xs px-2 py-1 rounded-full">
          📷 {content.galleryCount} photos
        </div>
      )}
    </div>
  );
});
ImageContent.displayName = 'ImageContent';

// ─────────────────────────────────────────────
// ArticleContent
// ─────────────────────────────────────────────
const ArticleContent = memo(({ content }) => {
  const cfg = SOURCE_CONFIG[content.source] || SOURCE_CONFIG.rss;
  return (
    <div className="w-full h-full flex flex-col bg-gray-950" style={{ borderTop: `4px solid ${cfg.color}` }}>
      {content.thumbnail && (
        <div className="flex-shrink-0 h-48 overflow-hidden">
          <img src={content.thumbnail} alt={content.title} className="w-full h-full object-cover"
            onError={(e) => { e.target.style.display = 'none'; }} />
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-6 pt-16">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs font-bold px-2 py-1 rounded-full" style={{ backgroundColor: cfg.color, color: 'white' }}>
            {content.category?.toUpperCase() || cfg.label.toUpperCase()}
          </span>
          <span className="text-gray-500 text-xs">
            {new Date(content.publishedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
          </span>
        </div>
        <h2 className="text-white text-2xl font-black leading-tight mb-4">{content.title}</h2>
        <p className="text-gray-300 text-base leading-relaxed">{content.description}</p>
        {content.externalUrl && (
          <a href={content.externalUrl} target="_blank" rel="noopener noreferrer"
            className="mt-6 inline-flex items-center gap-2 text-sm font-bold py-2 px-4 rounded-full"
            style={{ backgroundColor: cfg.color, color: 'white' }}>
            Lire l'article complet <FaExternalLinkAlt className="text-xs" />
          </a>
        )}
      </div>
    </div>
  );
});
ArticleContent.displayName = 'ArticleContent';

// ─────────────────────────────────────────────
// AggregatedCard — composant principal
// ─────────────────────────────────────────────
const AggregatedCard = ({ content, isActive }) => {
  if (!content) return null;

  const { user: currentUser, getToken } = useAuth();

  // ✅ Son activé par défaut (false = pas muté)
  const [muted, setMuted]                 = useState(false);
  const [isPaused, setIsPaused]           = useState(false);
  const [showHeart, setShowHeart]         = useState(false);
  const [showComments, setShowComments]   = useState(false);
  const [isLiked, setIsLiked]             = useState(false);
  const [localLikes, setLocalLikes]       = useState(content.localLikesCount || 0);
  const [localComments, setLocalComments] = useState([]);
  const [newComment, setNewComment]       = useState('');
  const [progress, setProgress]           = useState(0);

  const videoRef = useRef(null);

  const cfg     = SOURCE_CONFIG[content.source] || SOURCE_CONFIG.rss;
  const isVideo = content.contentType === 'video';
  const isImage = content.contentType === 'image';
  const isText  = content.contentType === 'text' || content.contentType === 'article';

  useEffect(() => {
    if (!isActive || !content._id) return;
    const timer = setTimeout(async () => {
      try { await fetch(`${API_URL}/aggregated/${content._id}/view`, { method: 'POST' }); } catch {}
    }, 3000);
    return () => clearTimeout(timer);
  }, [isActive, content._id]);

  // Reset son au défaut (activé) quand on change de slide
  useEffect(() => {
    if (!isActive) setMuted(false);
  }, [isActive]);

  const handleTimeUpdate = useCallback((e) => {
    const vid = e.target;
    if (vid?.duration) setProgress((vid.currentTime / vid.duration) * 100);
  }, []);

  const handleTogglePlay = useCallback((e) => {
    e?.stopPropagation();
    const vid = videoRef.current;
    if (!vid) return;
    if (vid.paused) { vid.play().catch(() => {}); setIsPaused(false); }
    else            { vid.pause(); setIsPaused(true); }
  }, []);

  const handleDoubleTap = useCallback((e) => {
    e?.stopPropagation();
    setShowHeart(true);
    setTimeout(() => setShowHeart(false), 800);
    if (!isLiked) handleLike();
  }, [isLiked]); // eslint-disable-line

  const handleLike = useCallback(async (e) => {
    e?.stopPropagation();
    if (!currentUser) return alert('Connectez-vous pour aimer !');
    const wasLiked = isLiked;
    setIsLiked(!wasLiked);
    setLocalLikes(p => wasLiked ? p - 1 : p + 1);
    try {
      const token = await getToken();
      await fetch(`${API_URL}/aggregated/${content._id}/like`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      setIsLiked(wasLiked);
      setLocalLikes(p => wasLiked ? p + 1 : p - 1);
    }
  }, [currentUser, isLiked, content._id, getToken]);

  const handleToggleMute = useCallback((e) => {
    e.stopPropagation();
    const vid      = videoRef.current;
    const newMuted = !muted;
    setMuted(newMuted);
    if (!vid) return;
    if (newMuted) {
      vid.muted  = true;
      vid.volume = 0;
    } else {
      vid.pause();
      vid.muted  = false;
      vid.volume = 1;
      vid.play().catch(() => { vid.muted = true; vid.volume = 0; setMuted(true); });
    }
  }, [muted]);

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
    else { navigator.clipboard.writeText(url); alert('Lien copié !'); }
  };

  return (
    <div className="relative w-full h-full bg-black overflow-hidden select-none">

      {isVideo && content.isEmbed && <EmbedVideo content={content} isActive={isActive} />}
      {isVideo && !content.isEmbed && (
        <DirectVideo content={content} isActive={isActive} muted={muted} videoRef={videoRef}
          onTogglePlay={handleTogglePlay} onTimeUpdate={handleTimeUpdate} onDoubleTap={handleDoubleTap} />
      )}
      {isImage && <ImageContent content={content} onDoubleTap={handleDoubleTap} />}
      {isText  && <ArticleContent content={content} />}

      {!isText && <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/85 pointer-events-none" />}

      {isVideo && !content.isEmbed && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-gray-800/30 z-20">
          <div className="h-full transition-all duration-100" style={{ width: `${progress}%`, backgroundColor: cfg.color }} />
        </div>
      )}

      {isVideo && !content.isEmbed && isPaused && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <FaPlay className="text-white/50 text-6xl animate-pulse" />
        </div>
      )}

      {/* ✅ Badge source supprimé */}

      <AnimatePresence>
        {showHeart && (
          <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1.5, opacity: 1 }} exit={{ scale: 2, opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <FaHeart className="text-red-500 text-8xl drop-shadow-2xl" />
          </motion.div>
        )}
      </AnimatePresence>

      {!isText && (
        <div className="absolute bottom-4 left-4 right-16 z-30 pb-safe">
          <div className="flex items-center gap-3 mb-3">
            <img src={content.channelAvatar || generateAvatar(content.channelName)} alt={content.channelName}
              className="w-10 h-10 rounded-full border-2 border-white/50 object-cover bg-gray-700"
              onError={(e) => { e.target.onerror = null; e.target.src = generateAvatar(content.channelName); }} />
            <div>
              <p className="font-bold text-white text-sm drop-shadow-md">{content.channelName}</p>
              {content.subreddit && <p className="text-white/60 text-xs">r/{content.subreddit}</p>}
            </div>
            {content.externalUrl && (
              <a href={content.externalUrl} target="_blank" rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()} className="ml-auto text-white/70 hover:text-white p-2">
                <FaExternalLinkAlt className="text-xs" />
              </a>
            )}
          </div>
          <p className="text-white/90 text-sm mb-2 max-w-[90%] drop-shadow-md line-clamp-2">{content.title}</p>
          <div className="flex flex-wrap gap-1">
            {(content.hashtags || content.tags || []).slice(0, 3).map((t, i) => (
              <span key={i} className="text-xs text-white/70 bg-white/10 px-2 py-0.5 rounded-full">#{t}</span>
            ))}
          </div>
        </div>
      )}

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
          <span className="text-xs font-bold text-white drop-shadow-md">
            {localComments.length + (content.localCommentsCount || 0)}
          </span>
        </div>

        <div className="flex flex-col items-center gap-1">
          <motion.button whileTap={{ scale: 0.8 }} onClick={handleShare}
            className="w-10 h-10 rounded-full flex items-center justify-center text-white text-3xl drop-shadow-xl">
            <FaShare />
          </motion.button>
          <span className="text-xs font-bold text-white drop-shadow-md">Partager</span>
        </div>

        {isVideo && !content.isEmbed && (
          <motion.button whileTap={{ scale: 0.9 }} onClick={handleToggleMute}
            className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center text-white mt-2">
            {muted ? <FaVolumeMute /> : <FaVolumeUp />}
          </motion.button>
        )}
      </div>

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
                <button onClick={() => setShowComments(false)} className="text-gray-400 p-2">✕</button>
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
                  className="p-2 bg-pink-600 rounded-full text-white disabled:opacity-50"><IoSend /></button>
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