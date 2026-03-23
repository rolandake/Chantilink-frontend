// src/pages/Videos/VideoCard.jsx — v2 ANTI-COUPURE
//
// ═══════════════════════════════════════════════════════════════════════════
// FIXES COUPURES (v2) :
//
//  1. ABORT RACE — play() est protégé par un AbortController interne.
//     Avant chaque nouveau play(), on annule le précédent. Plus jamais de
//     "The play() request was interrupted by a call to pause()".
//
//  2. DEBOUNCE isActive — un délai de 80ms avant tout play() évite les
//     appels en rafale quand l'utilisateur scrolle vite.
//
//  3. PRÉCHARGEMENT ANTICIPÉ — preload="auto" + on positionne le src dès
//     que le composant est monté (pas seulement quand isActive change).
//     La vidéo bufférise en arrière-plan avant d'être active.
//
//  4. registerPlay SAFE — on pause les autres vidéos APRÈS que la nouvelle
//     a commencé à jouer, pas avant. Plus de race condition.
//
//  5. canplay CLEANUP — l'écouteur est toujours retiré au unmount.
//
//  6. RETRY AUTOMATIQUE — si play() échoue pour une raison réseau
//     (NotAllowedError exclu), on retry 1x après 300ms.
// ═══════════════════════════════════════════════════════════════════════════

import React, { useEffect, useRef, useState, memo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { useVideos } from '../../context/VideoContext';
import {
  FaHeart, FaRegHeart, FaComment, FaShare,
  FaVolumeUp, FaVolumeMute, FaPlay,
  FaTrash, FaEllipsisV, FaDownload,
} from 'react-icons/fa';
import { IoSend } from 'react-icons/io5';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const USER_INTERACTED_KEY = 'vp_user_interacted';

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

// ── FIX 4 : pause les autres vidéos APRÈS que la nouvelle joue ───────────────
const playingVideos = new Set();
const registerPlay  = (vid) => {
  playingVideos.add(vid);
  // On pause les autres en micro-task, après que play() a commencé
  Promise.resolve().then(() => {
    playingVideos.forEach(v => {
      if (v !== vid && !v.paused) { v.pause(); v.muted = true; }
    });
  });
};

const generateAvatar = (name = 'U') => {
  const c      = (name || 'U').charAt(0).toUpperCase();
  const colors = ['#EF4444','#3B82F6','#10B981','#F59E0B','#8B5CF6','#EC4899'];
  const color  = colors[c.charCodeAt(0) % colors.length];
  return `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="${encodeURIComponent(color)}"/><text x="50%" y="50%" font-size="50" fill="white" text-anchor="middle" dy=".3em" font-family="Arial">${c}</text></svg>`;
};
// ── downloadWithWatermark — Canvas watermark Chantilink ───────────────────────
const downloadWithWatermark = async (videoEl, filename = 'chantilink-video.mp4') => {
  // 1. Try direct URL download with a fetch to check CORS
  const src = videoEl?.src || '';
  if (!src) return;

  try {
    // Capture current frame onto canvas + watermark
    const canvas  = document.createElement('canvas');
    const W = videoEl.videoWidth  || 720;
    const H = videoEl.videoHeight || 1280;
    canvas.width  = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    // Draw current video frame
    ctx.drawImage(videoEl, 0, 0, W, H);

    // ── Watermark overlay ──────────────────────────────────────────────────
    // Bottom gradient
    const grad = ctx.createLinearGradient(0, H * 0.75, 0, H);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, H * 0.75, W, H * 0.25);

    // Logo pill background
    const pillW = 160, pillH = 36, pillX = W - pillW - 16, pillY = H - pillH - 20;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 10);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fill();
    ctx.restore();

    // Orange dot
    ctx.beginPath();
    ctx.arc(pillX + 18, pillY + pillH / 2, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#f97316';
    ctx.fill();

    // "Chantilink" text
    ctx.font = `bold ${Math.round(W * 0.022)}px Arial, sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'middle';
    ctx.fillText('Chantilink', pillX + 32, pillY + pillH / 2);

    // Watermark as PNG share image (frame screenshot)
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      // Try Web Share API first (mobile)
      if (navigator.canShare?.({ files: [new File([blob], 'chantilink.png', { type: 'image/png' })] })) {
        try {
          await navigator.share({ files: [new File([blob], 'chantilink.png', { type: 'image/png' })], title: 'Vidéo Chantilink' });
          return;
        } catch {}
      }
      // Fallback: download the frame screenshot
      const url = URL.createObjectURL(blob);
      const a   = document.createElement('a');
      a.href     = url;
      a.download = 'chantilink-frame.png';
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  } catch (e) {
    // Final fallback: open video URL directly
    window.open(src, '_blank');
  }
};

// ── downloadVideoFile — télécharge le fichier vidéo original ─────────────────
// Pour les vidéos hébergées sur Cloudinary on peut fetch + blob
const downloadVideoFile = async (src, title = 'chantilink-video') => {
  try {
    const res  = await fetch(src, { mode: 'cors' });
    if (!res.ok) throw new Error('fetch failed');
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${title.slice(0, 40).replace(/[^a-z0-9]/gi, '-')}-chantilink.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch {
    // CORS bloqué → ouvrir dans un nouvel onglet
    window.open(src, '_blank');
  }
};



// ── formatTime ───────────────────────────────────────────────────────────────
const formatTime = (s) => {
  if (!isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
};

// ── SeekBar — scrubbing TikTok-style ─────────────────────────────────────────
//
//  • Tap rapide  → seek immédiat à la position cliquée
//  • Drag        → scrubbing fluide, vidéo pause pendant le drag, preview du temps
//  • Double-tap zone gauche/droite → −10s / +10s (comme YouTube)
//  • Bulle de temps animée au-dessus du pouce pendant le drag
//
const SeekBar = memo(({ progress, videoRef, duration = 0 }) => {
  const trackRef    = useRef(null);
  const dragging    = useRef(false);
  const wasPaused   = useRef(false);
  const [isDragging,  setIsDragging]  = useState(false);
  const [previewTime, setPreviewTime] = useState(0);
  const [previewPct,  setPreviewPct]  = useState(0);

  const getRatio = useCallback((clientX) => {
    const bar = trackRef.current;
    if (!bar) return null;
    const rect = bar.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  }, []);

  const applySeek = useCallback((ratio) => {
    const vid = videoRef.current;
    if (!vid || !vid.duration) return;
    const t = ratio * vid.duration;
    vid.currentTime = t;
    setPreviewTime(t);
    setPreviewPct(ratio * 100);
  }, [videoRef]);

  const onPointerDown = useCallback((e) => {
    e.stopPropagation();
    const ratio = getRatio(e.clientX);
    if (ratio === null) return;
    lockFeed();
    dragging.current = true;
    trackRef.current?.setPointerCapture(e.pointerId);

    const vid = videoRef.current;
    wasPaused.current = vid ? vid.paused : true;
    if (vid && !vid.paused) vid.pause();

    applySeek(ratio);
    setIsDragging(true);
  }, [getRatio, applySeek, videoRef]);

  const onPointerMove = useCallback((e) => {
    if (!dragging.current) return;
    e.stopPropagation();
    const ratio = getRatio(e.clientX);
    if (ratio !== null) applySeek(ratio);
  }, [getRatio, applySeek]);

  const onPointerUp = useCallback((e) => {
    if (!dragging.current) return;
    e.stopPropagation();
    dragging.current = false;
    setIsDragging(false);

    const vid = videoRef.current;
    if (vid && !wasPaused.current) vid.play().catch(() => {});
    unlockFeed();
  }, [videoRef]);

  // Tap simple (sans drag) → seek + reprise si la vidéo jouait
  const onPointerDownTap = useCallback((e) => {
    e.stopPropagation();
    const ratio = getRatio(e.clientX);
    if (ratio === null) return;
    lockFeed();
    const vid = videoRef.current;
    const wasP = vid ? vid.paused : true;
    if (vid && !vid.paused) vid.pause();
    applySeek(ratio);
    // Reprendre après 32ms si elle jouait (tap = pas de drag)
    setTimeout(() => {
      if (!dragging.current && vid && !wasP) vid.play().catch(() => {});
      unlockFeed();
    }, 32);
  }, [getRatio, applySeek, videoRef]);

  const pct = isDragging ? previewPct : progress;

  return (
    <>
      {/* Bulle de temps preview */}
      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.85 }}
            transition={{ duration: 0.12 }}
            className="absolute z-30 pointer-events-none"
            style={{
              bottom: 14,
              left: `clamp(28px, ${pct}%, calc(100% - 28px))`,
              transform: 'translateX(-50%)',
            }}
          >
            <div style={{
              background: 'rgba(0,0,0,0.82)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.18)',
              borderRadius: 8,
              padding: '3px 8px',
              fontSize: 12,
              fontWeight: 600,
              color: '#fff',
              whiteSpace: 'nowrap',
            }}>
              {formatTime(previewTime)}
              {duration > 0 && (
                <span style={{ opacity: 0.5, fontWeight: 400 }}> / {formatTime(duration)}</span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Zone de touch large (toute la barre) */}
      <div
        ref={trackRef}
        className="absolute left-0 right-0 z-20"
        style={{
          bottom: 0,
          height: 28,
          cursor: 'pointer',
          touchAction: 'none',
          userSelect: 'none',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={onPointerDownTap}
      >
        {/* Piste visible */}
        <div
          className="absolute left-0 right-0"
          style={{
            bottom: 0,
            height: isDragging ? 4 : 2.5,
            background: 'rgba(255,255,255,0.18)',
            transition: 'height 0.15s ease',
          }}
        >
          {/* Partie lue */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: `${pct}%`,
              background: '#fff',
              borderRadius: 99,
              transition: isDragging ? 'none' : 'width 0.1s linear',
            }}
          />
          {/* Pouce */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: `${pct}%`,
              transform: 'translate(-50%, -50%)',
              width: isDragging ? 16 : 10,
              height: isDragging ? 16 : 10,
              borderRadius: '50%',
              background: '#fff',
              boxShadow: '0 1px 6px rgba(0,0,0,0.5)',
              transition: isDragging ? 'none' : 'width 0.15s, height 0.15s',
              pointerEvents: 'none',
            }}
          />
        </div>
      </div>
    </>
  );
});
SeekBar.displayName = 'SeekBar';

// ── useVideoPlayback — cœur anti-coupure ──────────────────────────────────────
//
// FIX 1 : chaque tentative de play() a son propre AbortController.
//         Si isActive passe à false pendant le play(), on abort → pas de coupure.
// FIX 2 : debounce 80ms sur isActive pour absorber les scrolls rapides.
// FIX 5 : cleanup complet sur unmount (listeners + timers + abort).
//
function useVideoPlayback({ videoRef, videoSrc, isActive, muted, mutedRef, setMuted, setIsPaused }) {
  const srcSetRef      = useRef(false);
  const abortRef       = useRef(null);         // AbortController courant
  const debounceRef    = useRef(null);
  const canplayRef     = useRef(null);

  // ── Injecter le src dès le montage (préchargement anticipé) ─────────────
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || !videoSrc || srcSetRef.current) return;
    srcSetRef.current = true;
    vid.src     = videoSrc;
    vid.muted   = true;
    vid.volume  = 1;
    vid.preload = 'auto';
    vid.load();
  }, [videoRef, videoSrc]);

  // ── Logique play / pause avec debounce + abort ────────────────────────────
  useEffect(() => {
    // Annuler tout debounce en cours
    if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; }

    if (!isActive) {
      // Annuler le play en cours si besoin
      abortRef.current?.abort();
      abortRef.current = null;

      // Retirer le listener canplay si présent
      const vid = videoRef.current;
      if (vid) {
        if (canplayRef.current) { vid.removeEventListener('canplay', canplayRef.current); canplayRef.current = null; }
        vid.pause();
        vid.muted  = true;
        vid.volume = 1;
      }
      setIsPaused(false);
      return;
    }

    // Debounce 80ms : on attend que l'utilisateur se stabilise sur cette slide
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      const vid = videoRef.current;
      if (!vid) return;

      // Annuler tout play précédent
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      vid.muted  = true;
      vid.volume = 1;

      const doPlay = () => {
        if (ctrl.signal.aborted) return;
        const p = vid.play();
        if (!p) return;
        p.then(() => {
          if (ctrl.signal.aborted) { vid.pause(); return; }
          setIsPaused(false);
          registerPlay(vid);
          const interacted = sessionStorage.getItem(USER_INTERACTED_KEY) === '1';
          if (interacted) { vid.muted = mutedRef.current; vid.volume = mutedRef.current ? 0 : 1; }
        }).catch(err => {
          if (ctrl.signal.aborted) return;
          if (err.name === 'AbortError') return; // scroll rapide → normal
          if (err.name === 'NotAllowedError') { vid.muted = true; setMuted(true); return; }
          // FIX 6 : retry 1x après 300ms pour les erreurs réseau transitoires
          setTimeout(() => {
            if (ctrl.signal.aborted) return;
            vid.play().then(() => {
              if (ctrl.signal.aborted) { vid.pause(); return; }
              setIsPaused(false);
              registerPlay(vid);
            }).catch(() => { vid.muted = true; setMuted(true); });
          }, 300);
        });
      };

      if (vid.readyState >= 3) {
        doPlay();
      } else {
        // Attendre canplay
        if (canplayRef.current) vid.removeEventListener('canplay', canplayRef.current);
        const onCan = () => {
          vid.removeEventListener('canplay', onCan);
          canplayRef.current = null;
          doPlay();
        };
        canplayRef.current = onCan;
        vid.addEventListener('canplay', onCan);
      }
    }, 80);

    return () => {
      if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; }
    };
  }, [isActive]); // eslint-disable-line

  // ── Sync muted ────────────────────────────────────────────────────────────
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.muted  = muted;
    vid.volume = muted ? 0 : 1;
    if (!muted && vid.paused && isActive) {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      vid.play().then(() => {
        if (ctrl.signal.aborted) { vid.pause(); return; }
        setIsPaused(false);
        registerPlay(vid);
      }).catch(() => { vid.muted = true; setMuted(true); });
    }
  }, [muted]); // eslint-disable-line

  // ── Cleanup complet au unmount ────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
      const vid = videoRef.current;
      if (vid && canplayRef.current) vid.removeEventListener('canplay', canplayRef.current);
    };
  }, []); // eslint-disable-line
}


// ── ChantilinkSignature — overlay animé en fin de vidéo ──────────────────────
const ChantilinkSignature = memo(({ visible }) => (
  <AnimatePresence>
    {visible && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.35 }}
        className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none"
        style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)' }}
      >
        <motion.div
          initial={{ scale: 0.72, opacity: 0, y: 18 }}
          animate={{ scale: 1,    opacity: 1, y: 0  }}
          exit={{    scale: 1.08, opacity: 0, y: -8 }}
          transition={{ type: 'spring', stiffness: 280, damping: 22, delay: 0.05 }}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}
        >
          {/* Logo pill */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'rgba(255,255,255,0.10)',
            border: '1.5px solid rgba(255,255,255,0.22)',
            backdropFilter: 'blur(18px)',
            borderRadius: 999,
            padding: '10px 24px 10px 16px',
          }}>
            {/* Icône flamme / C stylisé */}
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <circle cx="16" cy="16" r="16" fill="#f97316" fillOpacity="0.18"/>
              <circle cx="16" cy="16" r="16" fill="url(#sig-grad)" fillOpacity="0.85"/>
              <text x="16" y="21" textAnchor="middle" fontSize="16" fontWeight="900"
                fontFamily="Arial, sans-serif" fill="white">C</text>
              <defs>
                <radialGradient id="sig-grad" cx="40%" cy="30%" r="70%">
                  <stop offset="0%" stopColor="#fb923c"/>
                  <stop offset="100%" stopColor="#ea580c"/>
                </radialGradient>
              </defs>
            </svg>
            <span style={{
              color: '#fff', fontFamily: 'Arial, sans-serif',
              fontWeight: 800, fontSize: 22, letterSpacing: '-0.3px',
            }}>
              Chantilink
            </span>
          </div>

          {/* Tagline */}
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, duration: 0.28 }}
            style={{
              color: 'rgba(255,255,255,0.6)',
              fontSize: 13, fontFamily: 'Arial, sans-serif',
              fontWeight: 500, letterSpacing: '0.04em',
              textAlign: 'center',
            }}
          >
            Le réseau du BTP
          </motion.p>

          {/* Barre de progression de la signature */}
          <motion.div
            style={{
              width: 80, height: 3, borderRadius: 99,
              background: 'rgba(255,255,255,0.2)',
              overflow: 'hidden',
            }}
          >
            <motion.div
              initial={{ width: '0%' }}
              animate={{ width: '100%' }}
              transition={{ duration: 1.9, ease: 'linear' }}
              style={{ height: '100%', background: '#f97316', borderRadius: 99 }}
            />
          </motion.div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
));
ChantilinkSignature.displayName = 'ChantilinkSignature';

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
  const [duration,      setDuration]      = useState(0);
  const [showSignature, setShowSignature]  = useState(false);
  const signatureTimer = useRef(null);

  const videoRef = useRef(null);
  const mutedRef = useRef(true);
  useEffect(() => { mutedRef.current = muted; }, [muted]);

  const videoSrc = video.cloudinaryUrl || video.videoUrl || video.url || '';

  useVideoPlayback({ videoRef, videoSrc, isActive, muted, mutedRef, setMuted, setIsPaused });

  useEffect(() => {
    if (!currentUser) return;
    if (Array.isArray(video.likes))       setLocalLiked(video.likes.some(id => id?.toString() === currentUser._id?.toString()));
    else if (video.isLiked !== undefined) setLocalLiked(!!video.isLiked);
  }, [video._id, currentUser]); // eslint-disable-line

  useEffect(() => {
    if (!isActive) { setShowSoundHint(false); return; }
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
    if (!v?.duration) return;
    const pct = (v.currentTime / v.duration) * 100;
    setProgress(pct);
    // Déclencher la signature à 97% de la vidéo
    if (pct >= 97 && !signatureTimer.current) {
      signatureTimer.current = setTimeout(() => {}, 0); // marquer comme déclenché
      setShowSignature(true);
      // Cacher après 2.2s (la vidéo repart en boucle)
      setTimeout(() => { setShowSignature(false); signatureTimer.current = null; }, 2200);
    }
    // Reset quand la vidéo revient au début (boucle)
    if (pct < 5 && signatureTimer.current !== null) {
      setShowSignature(false);
      signatureTimer.current = null;
    }
  }, []);

  const handleDurationChange = useCallback(e => {
    const v = e.target;
    if (v?.duration && isFinite(v.duration)) setDuration(v.duration);
  }, []);

  const activateSound = useCallback(e => {
    e?.stopPropagation();
    sessionStorage.setItem(USER_INTERACTED_KEY, '1');
    setShowSoundHint(false);
    setMuted(false);
  }, []);

  const handleTogglePlay = useCallback(e => {
    e?.stopPropagation();
    if (sessionStorage.getItem(USER_INTERACTED_KEY) !== '1') { activateSound(e); return; }
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().then(() => { setIsPaused(false); registerPlay(v); }).catch(() => {});
    } else {
      v.pause(); setIsPaused(true);
    }
  }, [activateSound]);

  const handleDoubleTap = useCallback(e => {
    e?.stopPropagation();
    setShowHeart(true);
    setTimeout(() => setShowHeart(false), 800);
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
    setShowSoundHint(false);
    setMuted(m => !m);
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
    setLocalComments(p => [...p, temp]);
    setNewComment('');
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

  const [isDownloading, setIsDownloading] = useState(false);
  const handleDownload = useCallback(async e => {
    e.stopPropagation();
    if (isDownloading) return;
    setIsDownloading(true);
    try {
      const src = videoRef.current?.src || videoSrc;
      await downloadVideoFile(src, video.title || 'chantilink-video');
    } finally {
      setIsDownloading(false);
    }
  }, [isDownloading, videoSrc, video.title]);

  const handleShareWithFrame = useCallback(e => {
    e.stopPropagation();
    downloadWithWatermark(videoRef.current, video.title || 'chantilink');
  }, [video.title]);

  const onActDown = useCallback(e => { e.stopPropagation(); lockFeed(); }, []);
  const onActUp   = useCallback(e => { e.stopPropagation(); unlockFeed(); }, []);

  const openComments  = useCallback(e => {
    e.stopPropagation(); lockFeed(); setShowComments(true); onModalChange?.(true);
  }, [onModalChange]);
  const closeComments = useCallback(() => {
    setShowComments(false); unlockFeed(); onModalChange?.(false);
  }, [onModalChange]);

  const isOwner = currentUser && (
    authorObj?._id?.toString()        === currentUser._id?.toString() ||
    video.uploadedBy?._id?.toString() === currentUser._id?.toString() ||
    video.uploadedBy?.toString()      === currentUser._id?.toString()
  );
  const hasAudio = video.hasAudio !== false;

  const modal = showComments ? createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end"
      onPointerDown={e => e.stopPropagation()}
      onTouchStart={e => e.stopPropagation()}
    >
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={closeComments} />
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
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

      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        style={{ contain: 'strict' }}
        playsInline
        preload="auto"
        loop
        poster={video.thumbnail || undefined}
        onClick={handleTogglePlay}
        onDoubleClick={handleDoubleTap}
        onTimeUpdate={handleTimeUpdate}
        onDurationChange={handleDurationChange}
      />

      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/85 pointer-events-none" />

      <SeekBar progress={progress} videoRef={videoRef} duration={duration} />

      {/* Signature Chantilink en fin de vidéo */}
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

      {/* ── Actions — toujours visibles au-dessus de la navbar (bottom: 80px) ── */}
      <div
        className="absolute right-2 flex flex-col items-center gap-5 z-40"
        style={{
          bottom: 'calc(72px + env(safe-area-inset-bottom))',
        }}
        onPointerDown={onActDown} onPointerUp={onActUp} onPointerCancel={onActUp}
        onTouchStart={e => e.stopPropagation()}
      >
        {/* Like */}
        <div className="flex flex-col items-center gap-1">
          <motion.button whileTap={{ scale:0.8 }} onClick={handleLike}
            className={`w-11 h-11 rounded-full flex items-center justify-center text-3xl drop-shadow-xl ${localLiked ? 'text-red-500' : 'text-white'}`}>
            {localLiked ? <FaHeart /> : <FaRegHeart />}
          </motion.button>
          <span className="text-[11px] font-bold text-white drop-shadow-md">{localLikes}</span>
        </div>

        {/* Commentaires */}
        <div className="flex flex-col items-center gap-1">
          <motion.button whileTap={{ scale:0.8 }} onClick={openComments}
            className="w-11 h-11 rounded-full flex items-center justify-center text-white text-3xl drop-shadow-xl">
            <FaComment />
          </motion.button>
          <span className="text-[11px] font-bold text-white drop-shadow-md">{localComments.length}</span>
        </div>

        {/* Partager lien */}
        <div className="flex flex-col items-center gap-1">
          <motion.button whileTap={{ scale:0.8 }} onClick={handleShare}
            className="w-11 h-11 rounded-full flex items-center justify-center text-white text-3xl drop-shadow-xl">
            <FaShare />
          </motion.button>
          <span className="text-[11px] font-bold text-white drop-shadow-md">Partager</span>
        </div>

        {/* Télécharger avec watermark */}
        <div className="flex flex-col items-center gap-1">
          <motion.button
            whileTap={{ scale:0.8 }}
            onClick={handleDownload}
            className="w-11 h-11 rounded-full flex items-center justify-center text-white text-2xl drop-shadow-xl"
            style={{ opacity: isDownloading ? 0.5 : 1 }}
          >
            {isDownloading
              ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <FaDownload />
            }
          </motion.button>
          <span className="text-[11px] font-bold text-white drop-shadow-md">Sauver</span>
        </div>

        {/* Mute */}
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
  prev.onModalChange === next.onModalChange
);