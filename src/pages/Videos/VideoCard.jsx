// src/pages/Videos/VideoCard.jsx
//
// ✅ NOUVEAUTÉS :
//   - Vidéo en BOUCLE : attribut loop sur <video>
//   - Barre de progression SEEKABLE : clic ou drag pour avancer/reculer
//     → pointerId capture pour drag fluide même hors de la barre
//     → lockFeed pendant le drag pour éviter le changement de vidéo

import React, { useEffect, useRef, useState, memo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { useVideos } from '../../context/VideoContext';
import {
  FaHeart, FaRegHeart, FaComment, FaShare,
  FaVolumeUp, FaVolumeMute, FaPlay,
  FaTrash, FaEllipsisV,
} from 'react-icons/fa';
import { IoSend } from 'react-icons/io5';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const USER_INTERACTED_KEY = 'vp_user_interacted';

// ── feedLock ─────────────────────────────────────────────────────────────────
let _feedLocked    = false;
let _feedLockTimer = null;
export const lockFeed    = () => {
  _feedLocked = true;
  if (_feedLockTimer) clearTimeout(_feedLockTimer);
  _feedLockTimer = setTimeout(() => { _feedLocked = false; _feedLockTimer = null; }, 600);
};
export const unlockFeed   = () => {
  _feedLocked = false;
  if (_feedLockTimer) { clearTimeout(_feedLockTimer); _feedLockTimer = null; }
};
export const isFeedLocked = () => _feedLocked;

const playingVideos = new Set();
const registerPlay  = (vid) => {
  playingVideos.forEach(v => { if (v !== vid && !v.paused) { v.pause(); v.muted = true; } });
  playingVideos.add(vid);
};

const generateAvatar = (name = 'U') => {
  const c      = (name || 'U').charAt(0).toUpperCase();
  const colors = ['#EF4444','#3B82F6','#10B981','#F59E0B','#8B5CF6','#EC4899'];
  const color  = colors[c.charCodeAt(0) % colors.length];
  return `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="${encodeURIComponent(color)}"/><text x="50%" y="50%" font-size="50" fill="white" text-anchor="middle" dy=".3em" font-family="Arial">${c}</text></svg>`;
};

// ── SeekBar — barre de progression cliquable + draggable ──────────────────────
const SeekBar = memo(({ progress, videoRef }) => {
  const barRef   = useRef(null);
  const dragging = useRef(false);

  const seekTo = useCallback((clientX) => {
    const vid = videoRef.current;
    const bar = barRef.current;
    if (!vid || !bar || !vid.duration) return;
    const rect  = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    vid.currentTime = ratio * vid.duration;
  }, [videoRef]);

  const onPointerDown = useCallback((e) => {
    e.stopPropagation();
    dragging.current = true;
    barRef.current?.setPointerCapture(e.pointerId);
    seekTo(e.clientX);
    lockFeed();
  }, [seekTo]);

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
      style={{ height: 20, cursor: 'pointer', touchAction: 'none' }}
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
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-md"
          style={{ left: `calc(${progress}% - 6px)`, pointerEvents: 'none' }}
        />
      </div>
    </div>
  );
});
SeekBar.displayName = 'SeekBar';

// ── VideoCard ─────────────────────────────────────────────────────────────────
const VideoCard = ({ video, isActive, isAutoPost = false, onModalChange }) => {
  if (!video) return null;

  const { user: currentUser, getToken } = useAuth();
  const { deleteVideo, likeVideo }      = useVideos();

  const authorObj    = video.user || video.uploadedBy || null;
  const authorName   = authorObj?.username || authorObj?.fullName || video.username || 'Utilisateur';
  const authorAvatar = authorObj?.profilePhoto || authorObj?.profilePicture || authorObj?.avatar || generateAvatar(authorName);

  const [muted,         setMuted]         = useState(true);
  const [isPaused,      setIsPaused]      = useState(false);
  const [showSoundHint, setShowSoundHint] = useState(false);
  const [showHeart,     setShowHeart]     = useState(false);
  const [showComments,  setShowComments]  = useState(false);
  const [showMenu,      setShowMenu]      = useState(false);
  const [localLiked,    setLocalLiked]    = useState(false);
  const [localLikes,    setLocalLikes]    = useState(
    Array.isArray(video.likes) ? video.likes.length : (video.likesCount ?? video.likes ?? 0)
  );
  const [localComments, setLocalComments] = useState(video.comments || []);
  const [newComment,    setNewComment]    = useState('');
  const [progress,      setProgress]      = useState(0);

  const videoRef = useRef(null);
  const mutedRef = useRef(true);
  const srcRef   = useRef(null);

  useEffect(() => { mutedRef.current = muted; }, [muted]);

  useEffect(() => {
    if (!currentUser) return;
    if (Array.isArray(video.likes))       setLocalLiked(video.likes.some(id => id?.toString() === currentUser._id?.toString()));
    else if (video.isLiked !== undefined) setLocalLiked(!!video.isLiked);
  }, [video._id, currentUser]); // eslint-disable-line

  const videoSrc = video.cloudinaryUrl || video.videoUrl || video.url || '';
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || !videoSrc || videoSrc === srcRef.current) return;
    srcRef.current = videoSrc;
    vid.src = videoSrc; vid.muted = true; vid.volume = 1;
  }, [videoSrc]);

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    if (!isActive) {
      vid.pause(); vid.muted = true; vid.volume = 1;
      setIsPaused(false); setShowSoundHint(false);
      return;
    }
    vid.muted = true; vid.volume = 1;
    const tryPlay = () => {
      vid.play()
        .then(() => {
          setIsPaused(false); registerPlay(vid);
          const interacted = sessionStorage.getItem(USER_INTERACTED_KEY) === '1';
          if (interacted) { vid.muted = mutedRef.current; vid.volume = mutedRef.current ? 0 : 1; }
        })
        .catch(err => { if (err.name === 'NotAllowedError' || err.name === 'NotSupportedError') { vid.muted = true; setMuted(true); } });
    };
    if (vid.readyState >= 3) tryPlay();
    else {
      const onCan = () => { vid.removeEventListener('canplay', onCan); tryPlay(); };
      vid.addEventListener('canplay', onCan);
      return () => vid.removeEventListener('canplay', onCan);
    }
  }, [isActive]); // eslint-disable-line

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.muted = muted; vid.volume = muted ? 0 : 1;
    if (!muted && vid.paused && isActive)
      vid.play().then(() => { setIsPaused(false); registerPlay(vid); }).catch(() => { vid.muted = true; setMuted(true); });
  }, [muted]); // eslint-disable-line

  useEffect(() => {
    if (!isActive) return;
    if (sessionStorage.getItem(USER_INTERACTED_KEY) !== '1') {
      setShowSoundHint(true);
      const t = setTimeout(() => setShowSoundHint(false), 3000);
      return () => clearTimeout(t);
    }
  }, [isActive]);

  useEffect(() => {
    if (!isActive || !video._id) return;
    const t = setTimeout(async () => {
      try { await fetch(`${API_URL}/videos/${video._id}/view`, { method: 'POST' }); } catch {}
    }, 3000);
    return () => clearTimeout(t);
  }, [isActive, video._id]);

  const handleTimeUpdate = useCallback(e => {
    const v = e.target;
    if (v?.duration) setProgress((v.currentTime / v.duration) * 100);
  }, []);

  const activateSound = useCallback(e => {
    e?.stopPropagation();
    sessionStorage.setItem(USER_INTERACTED_KEY, '1');
    setShowSoundHint(false); setMuted(false);
  }, []);

  const handleTogglePlay = useCallback(e => {
    e?.stopPropagation();
    if (sessionStorage.getItem(USER_INTERACTED_KEY) !== '1') { activateSound(e); return; }
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().then(() => { setIsPaused(false); registerPlay(v); }).catch(() => {});
    else { v.pause(); setIsPaused(true); }
  }, [activateSound]);

  const handleDoubleTap = useCallback(e => {
    e?.stopPropagation();
    setShowHeart(true); setTimeout(() => setShowHeart(false), 800);
    if (!localLiked) handleLike(); // eslint-disable-line
  }, [localLiked]); // eslint-disable-line

  const handleLike = useCallback(async e => {
    e?.stopPropagation();
    if (!currentUser) return;
    const was = localLiked;
    setLocalLiked(!was); setLocalLikes(p => was ? p - 1 : p + 1);
    try { await likeVideo(video._id); }
    catch { setLocalLiked(was); setLocalLikes(p => was ? p + 1 : p - 1); }
  }, [currentUser, localLiked, video._id, likeVideo]);

  const handleToggleMute = useCallback(e => {
    e.stopPropagation();
    sessionStorage.setItem(USER_INTERACTED_KEY, '1');
    setShowSoundHint(false); setMuted(m => !m);
  }, []);

  const handleDelete = useCallback(async e => {
    e.stopPropagation();
    if (!window.confirm('Supprimer cette vidéo ?')) return;
    try { await deleteVideo(video._id); setShowMenu(false); }
    catch (err) { console.error(err); }
  }, [video._id, deleteVideo]);

  const handleCommentSubmit = useCallback(async () => {
    if (!newComment.trim() || !currentUser) return;
    const temp = { _id: Date.now(), user: currentUser, text: newComment, createdAt: new Date().toISOString() };
    setLocalComments(p => [...p, temp]); setNewComment('');
    try {
      const token = await getToken();
      await fetch(`${API_URL}/videos/${video._id}/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text: temp.text }),
      });
    } catch { setLocalComments(p => p.filter(c => c._id !== temp._id)); }
  }, [newComment, currentUser, video._id, getToken]);

  const handleShare = useCallback(async e => {
    e.stopPropagation();
    const url = `${window.location.origin}/videos/${video._id}`;
    if (navigator.share) try { await navigator.share({ title: video.title || 'Vidéo', url }); } catch {}
    else navigator.clipboard?.writeText(url);
  }, [video._id, video.title]);

  const onActDown = useCallback(e => { e.stopPropagation(); lockFeed();   }, []);
  const onActUp   = useCallback(e => { e.stopPropagation(); unlockFeed(); }, []);

  const openComments  = useCallback(e => {
    e.stopPropagation(); lockFeed(); setShowComments(true); onModalChange?.(true);
  }, [onModalChange]);
  const closeComments = useCallback(() => {
    setShowComments(false); unlockFeed(); onModalChange?.(false);
  }, [onModalChange]);

  const isOwner  = currentUser && (
    authorObj?._id?.toString()          === currentUser._id?.toString() ||
    video.uploadedBy?._id?.toString()   === currentUser._id?.toString() ||
    video.uploadedBy?.toString()        === currentUser._id?.toString()
  );
  const hasAudio = video.hasAudio !== false;

  const modal = showComments ? createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end"
      onPointerDown={e => e.stopPropagation()}
      onTouchStart={e => e.stopPropagation()}
    >
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={closeComments}
      />
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        className="relative w-full bg-gray-900 rounded-t-3xl h-[70vh] flex flex-col shadow-2xl z-10"
        onPointerDown={e => e.stopPropagation()}
        onTouchStart={e => e.stopPropagation()}
      >
        <div className="p-4 border-b border-gray-800 flex justify-between items-center flex-shrink-0">
          <span className="font-bold text-white">{localComments.length} commentaire{localComments.length !== 1 ? 's' : ''}</span>
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
                <div><p className="text-xs font-bold text-gray-300">{cn}</p><p className="text-sm text-gray-200">{c.text}</p></div>
              </div>
            );
          })}
        </div>
        <div className="p-4 bg-gray-800 flex gap-2 items-center flex-shrink-0">
          {currentUser && (
            <img src={currentUser.profilePhoto || currentUser.profilePicture || generateAvatar(currentUser.username)}
              width={32} height={32} style={{ aspectRatio:'1/1', flexShrink:0 }}
              className="w-8 h-8 rounded-full object-cover"
              onError={e => { e.target.onerror=null; e.target.src=generateAvatar(currentUser.username); }} alt="moi" />
          )}
          <input value={newComment} onChange={e => setNewComment(e.target.value)}
            onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') handleCommentSubmit(); }}
            placeholder="Votre commentaire..."
            className="flex-1 bg-gray-700 text-white rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500" />
          <button onClick={handleCommentSubmit} disabled={!newComment.trim()}
            className="p-2 bg-orange-500 rounded-full text-white disabled:opacity-50"><IoSend /></button>
        </div>
      </motion.div>
    </div>,
    document.body
  ) : null;

  return (
    <div className="relative w-full h-full bg-black overflow-hidden select-none">

      {/* ✅ loop ajouté */}
      <video ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        style={{ contain: 'strict' }}
        playsInline preload="auto" loop
        poster={video.thumbnail || undefined}
        onClick={handleTogglePlay}
        onDoubleClick={handleDoubleTap}
        onTimeUpdate={handleTimeUpdate}
      />

      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/85 pointer-events-none" />

      {/* ✅ Barre seekable */}
      <SeekBar progress={progress} videoRef={videoRef} />

      {isPaused && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <FaPlay className="text-white/50 text-6xl animate-pulse" />
        </div>
      )}

      <AnimatePresence>
        {showSoundHint && (
          <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
            className="absolute bottom-32 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/20 pointer-events-none">
            <FaVolumeUp className="text-white text-sm" />
            <span className="text-white text-xs font-semibold">Appuie pour activer le son</span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showHeart && (
          <motion.div initial={{ scale:0, opacity:0 }} animate={{ scale:1.5, opacity:1 }} exit={{ scale:2, opacity:0 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <FaHeart className="text-red-500 text-8xl drop-shadow-2xl" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Infos auteur */}
      <div className="absolute bottom-4 left-4 right-16 z-30 pb-safe">
        <div className="flex items-center gap-3 mb-3">
          <img src={authorAvatar} alt={authorName}
            width={40} height={40} style={{ aspectRatio:'1/1', flexShrink:0 }}
            className="w-10 h-10 rounded-full border-2 border-white/50 object-cover bg-gray-700"
            onError={e => { e.target.onerror=null; e.target.src=generateAvatar(authorName); }} />
          <div style={{ minWidth:0 }}>
            <p className="font-bold text-white drop-shadow-md" style={{ fontSize:14 }}>{authorName}</p>
            {isAutoPost && <span className="text-xs text-orange-400 font-semibold">Recommandé</span>}
          </div>
          {isOwner && (
            <div className="ml-auto relative">
              <button onClick={e => { e.stopPropagation(); setShowMenu(m => !m); }}
                onPointerDown={onActDown} onPointerUp={onActUp} onPointerCancel={onActUp}
                className="text-white/70 hover:text-white p-2"><FaEllipsisV /></button>
              <AnimatePresence>
                {showMenu && (
                  <motion.div initial={{ opacity:0, scale:0.9 }} animate={{ opacity:1, scale:1 }} exit={{ opacity:0 }}
                    className="absolute right-0 bottom-10 bg-gray-900 border border-gray-700 rounded-xl overflow-hidden shadow-2xl z-50 min-w-[140px]"
                    onPointerDown={e => e.stopPropagation()}>
                    <button onClick={handleDelete}
                      className="flex items-center gap-2 px-4 py-3 text-red-400 hover:bg-gray-800 text-sm w-full">
                      <FaTrash /> Supprimer
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
        {video.title      && <p className="text-white/90 mb-2 drop-shadow-md font-medium line-clamp-2" style={{ fontSize:14 }}>{video.title}</p>}
        {video.description && <p className="text-white/70 text-xs line-clamp-2 drop-shadow-md">{video.description}</p>}
        {(video.tags || []).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {video.tags.slice(0, 3).map((t, i) => (
              <span key={i} className="text-xs text-white/70 bg-white/10 px-2 py-0.5 rounded-full">#{t}</span>
            ))}
          </div>
        )}
      </div>

      {/* Barre d'actions */}
      <div className="absolute right-2 bottom-20 flex flex-col items-center gap-6 z-40 pb-safe"
        onPointerDown={onActDown} onPointerUp={onActUp} onPointerCancel={onActUp}
        onTouchStart={e => e.stopPropagation()}>

        <div className="flex flex-col items-center gap-1">
          <motion.button whileTap={{ scale:0.8 }} onClick={handleLike}
            className={`w-10 h-10 rounded-full flex items-center justify-center text-3xl drop-shadow-xl ${localLiked ? 'text-red-500' : 'text-white'}`}>
            {localLiked ? <FaHeart /> : <FaRegHeart />}
          </motion.button>
          <span className="text-xs font-bold text-white drop-shadow-md">{localLikes}</span>
        </div>

        <div className="flex flex-col items-center gap-1">
          <motion.button whileTap={{ scale:0.8 }} onClick={openComments}
            className="w-10 h-10 rounded-full flex items-center justify-center text-white text-3xl drop-shadow-xl">
            <FaComment />
          </motion.button>
          <span className="text-xs font-bold text-white drop-shadow-md">{localComments.length}</span>
        </div>

        <div className="flex flex-col items-center gap-1">
          <motion.button whileTap={{ scale:0.8 }} onClick={handleShare}
            className="w-10 h-10 rounded-full flex items-center justify-center text-white text-3xl drop-shadow-xl">
            <FaShare />
          </motion.button>
          <span className="text-xs font-bold text-white drop-shadow-md">Partager</span>
        </div>

        {hasAudio && (
          <motion.button whileTap={{ scale:0.9 }} onClick={handleToggleMute}
            className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center text-white mt-2">
            {muted ? <FaVolumeMute /> : <FaVolumeUp />}
          </motion.button>
        )}
      </div>

      {modal}
    </div>
  );
};

VideoCard.displayName = 'VideoCard';
export default memo(VideoCard, (prev, next) =>
  prev.isActive      === next.isActive    &&
  prev.video._id     === next.video._id   &&
  prev.onModalChange === next.onModalChange
);