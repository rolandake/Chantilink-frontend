// 📁 src/pages/Videos/VideoCard.jsx — v3 useVideoPlayer
//
// ═══════════════════════════════════════════════════════════════════════════
// MIGRATION v3 — useVideoPlayer (source de vérité partagée avec PostMedia)
//
//  ✅ useVideoPlayback LOCAL supprimé — remplacé par useVideoPlayer()
//  ✅ src JAMAIS passé comme prop JSX — ref callback + useLayoutEffect
//  ✅ StrictMode-safe : plus de srcSetRef qui persiste entre unmounts
//  ✅ AbortController, debounce, canplay, timeout, retry, cleanup → hérités
//  ✅ Fallback proxy → direct via setCurrentSrc (re-render React propre)
//  ✅ videoEl accessible via hook.videoEl (pour seekBar, download, canvas)
//  ✅ muteButtonRef innerHTML mis à jour impérativement par le hook
//  ✅ Singleton registerPlaying → 1 seule vidéo joue globalement
//  ✅ TOUTES les features v2 conservées (SeekBar, ChantilinkSignature,
//     double-tap, commentaires, download, partage, menu propriétaire…)
// ═══════════════════════════════════════════════════════════════════════════

import React, { useEffect, useRef, useState, memo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { useVideos } from '../../context/VideoContext';
import useVideoPlayer, { USER_INTERACTED_KEY } from '../../hooks/useVideoPlayer';
import {
  FaHeart, FaRegHeart, FaComment, FaShare,
  FaVolumeUp, FaVolumeMute, FaPlay,
  FaTrash, FaEllipsisV, FaDownload,
} from 'react-icons/fa';
import { IoSend } from 'react-icons/io5';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// ── feedLock ──────────────────────────────────────────────────────────────────
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

// ─── Helpers ──────────────────────────────────────────────────────────────────
const generateAvatar = (name = 'U') => {
  const c      = (name || 'U').charAt(0).toUpperCase();
  const colors = ['#EF4444','#3B82F6','#10B981','#F59E0B','#8B5CF6','#EC4899'];
  const color  = colors[c.charCodeAt(0) % colors.length];
  return `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="${encodeURIComponent(color)}"/><text x="50%" y="50%" font-size="50" fill="white" text-anchor="middle" dy=".3em" font-family="Arial">${c}</text></svg>`;
};

const formatTime = (s) => {
  if (!isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  return `${m}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
};

const downloadWithWatermark = async (videoEl, filename = 'chantilink-video') => {
  const src = videoEl?.src || '';
  if (!src) return;
  try {
    const canvas = document.createElement('canvas');
    const W = videoEl.videoWidth || 720, H = videoEl.videoHeight || 1280;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoEl, 0, 0, W, H);
    const grad = ctx.createLinearGradient(0, H * 0.75, 0, H);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, H * 0.75, W, H * 0.25);
    const pillW = 160, pillH = 36, pillX = W - pillW - 16, pillY = H - pillH - 20;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 10);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fill();
    ctx.restore();
    ctx.beginPath();
    ctx.arc(pillX + 18, pillY + pillH / 2, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#f97316';
    ctx.fill();
    ctx.font = `bold ${Math.round(W * 0.022)}px Arial, sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'middle';
    ctx.fillText('Chantilink', pillX + 32, pillY + pillH / 2);
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      if (navigator.canShare?.({ files: [new File([blob], 'chantilink.png', { type: 'image/png' })] })) {
        try { await navigator.share({ files: [new File([blob], 'chantilink.png', { type: 'image/png' })], title: 'Vidéo Chantilink' }); return; } catch {}
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'chantilink-frame.png'; a.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  } catch { window.open(src, '_blank'); }
};

const downloadVideoFile = async (src, title = 'chantilink-video') => {
  if (!src) return;
  try {
    const res = await fetch(src, { mode: 'cors' });
    if (!res.ok) throw new Error('fetch failed');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${title.slice(0, 40).replace(/[^a-z0-9]/gi, '-')}-chantilink.mp4`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch { window.open(src, '_blank'); }
};

// ── SeekBar ───────────────────────────────────────────────────────────────────
const SeekBar = memo(({ progress, getVideoEl, duration = 0 }) => {
  const trackRef  = useRef(null);
  const dragging  = useRef(false);
  const wasPaused = useRef(false);
  const [isDragging,  setIsDragging]  = useState(false);
  const [previewTime, setPreviewTime] = useState(0);
  const [previewPct,  setPreviewPct]  = useState(0);

  const getRatio = useCallback((clientX) => {
    const bar = trackRef.current; if (!bar) return null;
    const rect = bar.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  }, []);

  const applySeek = useCallback((ratio) => {
    const vid = getVideoEl(); if (!vid?.duration) return;
    const t = ratio * vid.duration;
    vid.currentTime = t; setPreviewTime(t); setPreviewPct(ratio * 100);
  }, [getVideoEl]);

  const onPointerDown = useCallback((e) => {
    e.stopPropagation();
    const ratio = getRatio(e.clientX); if (ratio === null) return;
    lockFeed(); dragging.current = true;
    trackRef.current?.setPointerCapture(e.pointerId);
    const vid = getVideoEl();
    wasPaused.current = vid ? vid.paused : true;
    if (vid && !vid.paused) vid.pause();
    applySeek(ratio); setIsDragging(true);
  }, [getRatio, applySeek, getVideoEl]);

  const onPointerMove = useCallback((e) => {
    if (!dragging.current) return;
    e.stopPropagation();
    const ratio = getRatio(e.clientX); if (ratio !== null) applySeek(ratio);
  }, [getRatio, applySeek]);

  const onPointerUp = useCallback((e) => {
    if (!dragging.current) return;
    e.stopPropagation(); dragging.current = false; setIsDragging(false);
    const vid = getVideoEl();
    if (vid && !wasPaused.current) vid.play().catch(() => {});
    unlockFeed();
  }, [getVideoEl]);

  const pct = isDragging ? previewPct : progress;

  return (
    <>
      <AnimatePresence>
        {isDragging && (
          <motion.div initial={{ opacity:0, y:4, scale:0.85 }} animate={{ opacity:1, y:0, scale:1 }} exit={{ opacity:0, y:4, scale:0.85 }} transition={{ duration:0.12 }}
            className="absolute z-30 pointer-events-none"
            style={{ bottom:14, left:`clamp(28px, ${pct}%, calc(100% - 28px))`, transform:'translateX(-50%)' }}>
            <div style={{ background:'rgba(0,0,0,0.82)', backdropFilter:'blur(8px)', border:'1px solid rgba(255,255,255,0.18)', borderRadius:8, padding:'3px 8px', fontSize:12, fontWeight:600, color:'#fff', whiteSpace:'nowrap' }}>
              {formatTime(previewTime)}
              {duration > 0 && <span style={{ opacity:0.5, fontWeight:400 }}> / {formatTime(duration)}</span>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div ref={trackRef} className="absolute left-0 right-0 z-20"
        style={{ bottom:0, height:28, cursor:'pointer', touchAction:'none', userSelect:'none' }}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove}
        onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
        <div className="absolute left-0 right-0" style={{ bottom:0, height:isDragging?4:2.5, background:'rgba(255,255,255,0.18)', transition:'height 0.15s ease' }}>
          <div style={{ position:'absolute', left:0, top:0, bottom:0, width:`${pct}%`, background:'#fff', borderRadius:99, transition:isDragging?'none':'width 0.1s linear' }} />
          <div style={{ position:'absolute', top:'50%', left:`${pct}%`, transform:'translate(-50%,-50%)', width:isDragging?16:10, height:isDragging?16:10, borderRadius:'50%', background:'#fff', boxShadow:'0 1px 6px rgba(0,0,0,0.5)', transition:isDragging?'none':'width 0.15s, height 0.15s', pointerEvents:'none' }} />
        </div>
      </div>
    </>
  );
});
SeekBar.displayName = 'SeekBar';

// ── ChantilinkSignature ───────────────────────────────────────────────────────
const ChantilinkSignature = memo(({ visible }) => (
  <AnimatePresence>
    {visible && (
      <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} transition={{ duration:0.35 }}
        className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none"
        style={{ background:'rgba(0,0,0,0.45)', backdropFilter:'blur(2px)' }}>
        <motion.div initial={{ scale:0.72, opacity:0, y:18 }} animate={{ scale:1, opacity:1, y:0 }} exit={{ scale:1.08, opacity:0, y:-8 }}
          transition={{ type:'spring', stiffness:280, damping:22, delay:0.05 }}
          style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:14 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, background:'rgba(255,255,255,0.10)', border:'1.5px solid rgba(255,255,255,0.22)', backdropFilter:'blur(18px)', borderRadius:999, padding:'10px 24px 10px 16px' }}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <circle cx="16" cy="16" r="16" fill="#f97316" fillOpacity="0.18"/>
              <circle cx="16" cy="16" r="16" fill="url(#sg1)" fillOpacity="0.85"/>
              <text x="16" y="21" textAnchor="middle" fontSize="16" fontWeight="900" fontFamily="Arial, sans-serif" fill="white">C</text>
              <defs><radialGradient id="sg1" cx="40%" cy="30%" r="70%"><stop offset="0%" stopColor="#fb923c"/><stop offset="100%" stopColor="#ea580c"/></radialGradient></defs>
            </svg>
            <span style={{ color:'#fff', fontFamily:'Arial, sans-serif', fontWeight:800, fontSize:22, letterSpacing:'-0.3px' }}>Chantilink</span>
          </div>
          <motion.p initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.18, duration:0.28 }}
            style={{ color:'rgba(255,255,255,0.6)', fontSize:13, fontFamily:'Arial, sans-serif', fontWeight:500, textAlign:'center' }}>
            Le réseau du BTP
          </motion.p>
          <motion.div style={{ width:80, height:3, borderRadius:99, background:'rgba(255,255,255,0.2)', overflow:'hidden' }}>
            <motion.div initial={{ width:'0%' }} animate={{ width:'100%' }} transition={{ duration:1.9, ease:'linear' }}
              style={{ height:'100%', background:'#f97316', borderRadius:99 }} />
          </motion.div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
));
ChantilinkSignature.displayName = 'ChantilinkSignature';

// ─────────────────────────────────────────────────────────────────────────────
// VideoCard v3
// ─────────────────────────────────────────────────────────────────────────────
const VideoCard = ({ video, isActive, isAutoPost = false, onModalChange, onVideoError }) => {
  if (!video) return null;

  const { user: currentUser, getToken } = useAuth();
  const { deleteVideo, likeVideo }      = useVideos();

  const authorObj    = video.user || video.uploadedBy || null;
  const authorName   = authorObj?.username || authorObj?.fullName || video.username || 'Utilisateur';
  const authorAvatar = authorObj?.profilePhoto || authorObj?.profilePicture || authorObj?.avatar || generateAvatar(authorName);
  const videoSrc     = video.cloudinaryUrl || video.videoUrl || video.url || '';
  const hasAudio     = video.hasAudio !== false;

  // ── State UI ──────────────────────────────────────────────────────────────
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
  const [duration,      setDuration]      = useState(0);
  const [showSignature, setShowSignature] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const signatureTimer = useRef(null);

  // ── ✅ useVideoPlayer — remplace l'ancien useVideoPlayback local ──────────
  const player = useVideoPlayer({
    url:         videoSrc,
    thumbnail:   video.thumbnail || null,
    isActive,
    initialMuted: true,
    preload:     'auto',
    onError:     () => { onVideoError?.(); },
    onPlay:      () => setIsPaused(false),
    onMutedChange: (m) => setMuted(m),
    useIntersection: false, // contrôle externe via isActive
  });

  // Sync état muted React ↔ ref interne du hook
  // (le hook gère vid.muted impérativement, on garde juste le state pour l'UI)
  const handleToggleMute = useCallback((e) => {
    e.stopPropagation();
    sessionStorage.setItem(USER_INTERACTED_KEY, '1');
    setShowSoundHint(false);
    setMuted(m => !m);
    player.handleMuteToggle(e);
  }, [player]);

  // Son activé au premier geste
  const activateSound = useCallback((e) => {
    e?.stopPropagation();
    sessionStorage.setItem(USER_INTERACTED_KEY, '1');
    setShowSoundHint(false);
    setMuted(false);
    // Le hook gère vid.muted via muteButtonRef / handleMuteToggle ;
    // ici on force directement l'élément
    if (player.videoEl) {
      player.videoEl.muted = false;
      player.videoEl.volume = 1;
      if (player.videoEl.paused && isActive) {
        player.videoEl.play().catch(() => { player.videoEl.muted = true; setMuted(true); });
      }
    }
  }, [player, isActive]);

  const handleTogglePlay = useCallback((e) => {
    e?.stopPropagation();
    if (sessionStorage.getItem(USER_INTERACTED_KEY) !== '1') { activateSound(e); return; }
    const vid = player.videoEl; if (!vid) return;
    if (vid.paused) { vid.play().catch(() => {}); setIsPaused(false); }
    else { vid.pause(); setIsPaused(true); }
  }, [activateSound, player]);

  // Son hint
  useEffect(() => {
    if (!isActive) { setShowSoundHint(false); return; }
    if (sessionStorage.getItem(USER_INTERACTED_KEY) !== '1') {
      setShowSoundHint(true);
      const t = setTimeout(() => setShowSoundHint(false), 3000);
      return () => clearTimeout(t);
    }
  }, [isActive]);

  // Vue enregistrée après 3s
  useEffect(() => {
    if (!isActive || !video._id) return;
    const t = setTimeout(async () => {
      try { await fetch(`${API_URL}/videos/${video._id}/view`, { method: 'POST' }); } catch {}
    }, 3000);
    return () => clearTimeout(t);
  }, [isActive, video._id]);

  // Liked initial
  useEffect(() => {
    if (!currentUser) return;
    if (Array.isArray(video.likes)) setLocalLiked(video.likes.some(id => id?.toString() === currentUser._id?.toString()));
    else if (video.isLiked !== undefined) setLocalLiked(!!video.isLiked);
  }, [video._id, currentUser]); // eslint-disable-line

  const handleTimeUpdate = useCallback((e) => {
    const v = e.target; if (!v?.duration) return;
    const pct = (v.currentTime / v.duration) * 100;
    setProgress(pct);
    if (pct >= 97 && !signatureTimer.current) {
      signatureTimer.current = setTimeout(() => {}, 0);
      setShowSignature(true);
      setTimeout(() => { setShowSignature(false); signatureTimer.current = null; }, 2200);
    }
    if (pct < 5 && signatureTimer.current !== null) { setShowSignature(false); signatureTimer.current = null; }
  }, []);

  const handleDurationChange = useCallback((e) => {
    const v = e.target;
    if (v?.duration && isFinite(v.duration)) setDuration(v.duration);
  }, []);

  const handleDoubleTap = useCallback((e) => {
    e?.stopPropagation();
    setShowHeart(true);
    setTimeout(() => setShowHeart(false), 800);
    if (!localLiked) handleLike(); // eslint-disable-line
  }, [localLiked]); // eslint-disable-line

  const handleLike = useCallback(async (e) => {
    e?.stopPropagation();
    if (!currentUser) return;
    const was = localLiked;
    setLocalLiked(!was); setLocalLikes(p => was ? p - 1 : p + 1);
    try { await likeVideo(video._id); }
    catch { setLocalLiked(was); setLocalLikes(p => was ? p + 1 : p - 1); }
  }, [currentUser, localLiked, video._id, likeVideo]);

  const handleDelete = useCallback(async (e) => {
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

  const handleShare = useCallback(async (e) => {
    e.stopPropagation();
    const url = `${window.location.origin}/videos/${video._id}`;
    if (navigator.share) try { await navigator.share({ title: video.title || 'Vidéo', url }); } catch {}
    else navigator.clipboard?.writeText(url);
  }, [video._id, video.title]);

  const handleDownload = useCallback(async (e) => {
    e.stopPropagation(); if (isDownloading) return;
    setIsDownloading(true);
    try { await downloadVideoFile(player.videoEl?.src || videoSrc, video.title || 'chantilink-video'); }
    finally { setIsDownloading(false); }
  }, [isDownloading, videoSrc, video.title, player]);

  const onActDown = useCallback((e) => { e.stopPropagation(); lockFeed(); }, []);
  const onActUp   = useCallback((e) => { e.stopPropagation(); unlockFeed(); }, []);

  const openComments  = useCallback((e) => { e.stopPropagation(); lockFeed(); setShowComments(true);  onModalChange?.(true);  }, [onModalChange]);
  const closeComments = useCallback(()  => { unlockFeed(); setShowComments(false); onModalChange?.(false); }, [onModalChange]);

  const isOwner = currentUser && (
    authorObj?._id?.toString()        === currentUser._id?.toString() ||
    video.uploadedBy?._id?.toString() === currentUser._id?.toString() ||
    video.uploadedBy?.toString()      === currentUser._id?.toString()
  );

  const modal = showComments ? createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end"
      onPointerDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()}>
      <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeComments} />
      <motion.div initial={{ y:'100%' }} animate={{ y:0 }} exit={{ y:'100%' }}
        className="relative w-full bg-gray-900 rounded-t-3xl h-[70vh] flex flex-col shadow-2xl z-10"
        onPointerDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()}>
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
                <img src={cu?.profilePhoto || cu?.profilePicture || generateAvatar(cn)} width={32} height={32}
                  style={{ aspectRatio:'1/1', flexShrink:0 }}
                  className="w-8 h-8 rounded-full bg-gray-700 object-cover"
                  onError={e => { e.target.onerror=null; e.target.src=generateAvatar(cn); }} alt={cn} />
                <div>
                  <p className="text-xs font-bold text-gray-300">{cn}</p>
                  <p className="text-sm text-gray-200">{c.text}</p>
                </div>
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

      {/*
        ✅ PAS de src={} prop JSX — géré par useVideoPlayer via ref callback +
        useLayoutEffect. Seules les propriétés non-src sont passées en JSX.
        muted={true} attribut HTML initial requis pour autoplay policy navigateur.
      */}
      <video
        ref={player.videoRef}
        muted
        loop
        playsInline
        preload="auto"
        crossOrigin={player.crossOrigin}
        className="absolute inset-0 w-full h-full object-cover"
        style={{ contain: 'strict' }}
        poster={video.thumbnail || undefined}
        onClick={handleTogglePlay}
        onDoubleClick={handleDoubleTap}
        onPlay={player.handlePlay}
        onPause={player.handlePause}
        onError={player.handleError}
        onTimeUpdate={handleTimeUpdate}
        onDurationChange={handleDurationChange}
      />

      {/* Poster jusqu'au premier frame décodé */}
      {player.posterUrl && (
        <img src={player.posterUrl} alt="" draggable="false"
          style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', pointerEvents:'none', zIndex:player.posterVisible ? 2 : -1, opacity:player.posterVisible ? 1 : 0, transition:'opacity 0.3s ease' }} />
      )}

      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/85 pointer-events-none" />

      <SeekBar progress={progress} getVideoEl={() => player.videoEl} duration={duration} />
      <ChantilinkSignature visible={showSignature} />

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
      <div className="absolute left-4 right-16 z-30" style={{ bottom: 'calc(72px + env(safe-area-inset-bottom))' }}>
        <div className="flex items-center gap-3 mb-3">
          <img src={authorAvatar} alt={authorName} width={40} height={40}
            style={{ aspectRatio:'1/1', flexShrink:0 }}
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
                    <button onClick={handleDelete} className="flex items-center gap-2 px-4 py-3 text-red-400 hover:bg-gray-800 text-sm w-full">
                      <FaTrash /> Supprimer
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
        {video.title       && <p className="text-white/90 mb-2 drop-shadow-md font-medium line-clamp-2" style={{ fontSize:14 }}>{video.title}</p>}
        {video.description && <p className="text-white/70 text-xs line-clamp-2 drop-shadow-md">{video.description}</p>}
        {(video.tags || []).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {video.tags.slice(0, 3).map((t, i) => (
              <span key={i} className="text-xs text-white/70 bg-white/10 px-2 py-0.5 rounded-full">#{t}</span>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="absolute right-2 flex flex-col items-center gap-5 z-40"
        style={{ bottom: 'calc(72px + env(safe-area-inset-bottom))' }}
        onPointerDown={onActDown} onPointerUp={onActUp} onPointerCancel={onActUp}
        onTouchStart={e => e.stopPropagation()}>

        <div className="flex flex-col items-center gap-1">
          <motion.button whileTap={{ scale:0.8 }} onClick={handleLike}
            className={`w-11 h-11 rounded-full flex items-center justify-center text-3xl drop-shadow-xl ${localLiked ? 'text-red-500' : 'text-white'}`}>
            {localLiked ? <FaHeart /> : <FaRegHeart />}
          </motion.button>
          <span className="text-[11px] font-bold text-white drop-shadow-md">{localLikes}</span>
        </div>

        <div className="flex flex-col items-center gap-1">
          <motion.button whileTap={{ scale:0.8 }} onClick={openComments}
            className="w-11 h-11 rounded-full flex items-center justify-center text-white text-3xl drop-shadow-xl">
            <FaComment />
          </motion.button>
          <span className="text-[11px] font-bold text-white drop-shadow-md">{localComments.length}</span>
        </div>

        <div className="flex flex-col items-center gap-1">
          <motion.button whileTap={{ scale:0.8 }} onClick={handleShare}
            className="w-11 h-11 rounded-full flex items-center justify-center text-white text-3xl drop-shadow-xl">
            <FaShare />
          </motion.button>
          <span className="text-[11px] font-bold text-white drop-shadow-md">Partager</span>
        </div>

        <div className="flex flex-col items-center gap-1">
          <motion.button whileTap={{ scale:0.8 }} onClick={handleDownload}
            className="w-11 h-11 rounded-full flex items-center justify-center text-white text-2xl drop-shadow-xl"
            style={{ opacity: isDownloading ? 0.5 : 1 }}>
            {isDownloading
              ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <FaDownload />
            }
          </motion.button>
          <span className="text-[11px] font-bold text-white drop-shadow-md">Sauver</span>
        </div>

        {hasAudio && (
          <motion.button whileTap={{ scale:0.9 }} onClick={handleToggleMute}
            className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center text-white">
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
  prev.onModalChange === next.onModalChange &&
  prev.onVideoError  === next.onVideoError
);