// 📁 src/pages/Videos/YouTubeEmbed.jsx — v6
//
// ═══════════════════════════════════════════════════════════════════════════
// APPORTS v6 vs v5 :
//  🛡️  Gestion slot destroyed : startPlayer() ne plante plus si le slot
//      est détruit entre le montage et l'effet isActive
//  🚀  Retry de lecture si autoplay bloqué (visibilitychange + focus)
//  🚀  Cleanup propre : annule les requestIdleCallback en cours
//  🔇  Sound hint masqué si l'utilisateur a déjà activé le son global
//  📊  onError callback exposé vers le parent pour invalider la slide
//  🎯  Mémo plus strict : évite les re-renders parasites
// ═══════════════════════════════════════════════════════════════════════════

import React, {
  useEffect, useRef, useState, useCallback, memo,
} from 'react';
import YouTubePool, { setGlobalMuted, getGlobalMuted } from './YouTubePool';

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const THUMB_QUALITIES = ['maxresdefault', 'hqdefault', 'mqdefault', 'sddefault'];

const thumbUrl = (videoId, q = 'hqdefault') =>
  `https://img.youtube.com/vi/${videoId}/${q}.jpg`;

export const extractVideoId = (url = '') => {
  if (!url) return null;
  const m =
    url.match(/\/embed\/([a-zA-Z0-9_-]{11})/) ||
    url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/) ||
    url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Thumbnail avec fallback
// ─────────────────────────────────────────────────────────────────────────────
const Thumbnail = memo(({ videoId, forcedUrl, title, visible }) => {
  const [qi,     setQi]     = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const urls = forcedUrl
    ? [forcedUrl, ...THUMB_QUALITIES.map(q => thumbUrl(videoId, q))]
    : THUMB_QUALITIES.map(q => thumbUrl(videoId, q));

  const onError = useCallback(() => {
    if (qi < urls.length - 1) { setQi(i => i + 1); setLoaded(false); }
    else setFailed(true);
  }, [qi, urls.length]);

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 4,
      background: '#080810',
      opacity: visible ? 1 : 0,
      transition: 'opacity 0.35s ease',
      pointerEvents: 'none',
    }}>
      {!failed ? (
        <img
          src={urls[qi]}
          alt={title || ''}
          draggable="false"
          style={{
            width: '100%', height: '100%', objectFit: 'cover',
            opacity: loaded ? 1 : 0,
            transition: 'opacity 0.25s ease',
          }}
          onLoad={() => setLoaded(true)}
          onError={onError}
        />
      ) : (
        <div style={{
          width: '100%', height: '100%',
          background: 'linear-gradient(135deg,#0f0f1a,#1a0f2e)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="48" height="34" viewBox="0 0 48 34" fill="none">
            <rect width="48" height="34" rx="8" fill="#FF0000" />
            <path d="M20 10l14 7-14 7V10z" fill="white" />
          </svg>
        </div>
      )}
      <div style={{
        position: 'absolute', top: 60, left: 10,
        display: 'flex', alignItems: 'center', gap: 5,
        background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: 9999, padding: '3px 10px',
      }}>
        <svg width="12" height="9" viewBox="0 0 12 9" fill="none">
          <rect width="12" height="9" rx="2" fill="#FF0000" />
          <path d="M4.5 2.5l4 2-4 2V2.5z" fill="white" />
        </svg>
        <span style={{ color: 'white', fontSize: 10, fontWeight: 700 }}>YouTube</span>
      </div>
    </div>
  );
});
Thumbnail.displayName = 'Thumbnail';

// ─────────────────────────────────────────────────────────────────────────────
// Sound hint
// ─────────────────────────────────────────────────────────────────────────────
const SoundHint = memo(({ visible, onTap }) => (
  <div
    onClick={onTap}
    style={{
      position: 'absolute', bottom: 96, left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 10, cursor: 'pointer',
      opacity: visible ? 1 : 0,
      transition: 'opacity 0.3s ease',
      pointerEvents: visible ? 'auto' : 'none',
    }}
  >
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(12px)',
      border: '1px solid rgba(255,255,255,0.2)',
      borderRadius: 9999, padding: '7px 16px',
    }}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M2 5.5h2.5L8 2v12l-3.5-3.5H2V5.5Z" fill="white" opacity=".5" />
        <path d="M11 5a3 3 0 0 1 0 6" stroke="white" strokeWidth="1.5"
          strokeLinecap="round" opacity=".5" />
        <line x1="2" y1="2" x2="14" y2="14" stroke="white"
          strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <span style={{ color: 'white', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
        Appuie pour le son
      </span>
    </div>
  </div>
));
SoundHint.displayName = 'SoundHint';

// ─────────────────────────────────────────────────────────────────────────────
// YouTubeEmbed v6
// ─────────────────────────────────────────────────────────────────────────────
const YouTubeEmbed = memo(({
  videoId:      videoIdProp   = null,
  embedUrl:     embedUrlProp  = null,
  isActive,
  muted,
  thumbnail     = null,
  title         = '',
  onReady       = null,
  onMutedChange = null,
  onError       = null,
}) => {
  const containerRef = useRef(null);
  const slotRef      = useRef(null);
  const mutedRef     = useRef(muted);
  const readyRef     = useRef(false);
  const startedRef   = useRef(false);
  const idleRef      = useRef(null);   // requestIdleCallback handle

  const [posterVisible, setPosterVisible] = useState(true);
  const [showSoundHint, setShowSoundHint] = useState(false);

  const videoId = videoIdProp || extractVideoId(embedUrlProp);

  useEffect(() => { mutedRef.current = muted; }, [muted]);

  // ── Démarrer le player ─────────────────────────────────────────────────
  const startPlayer = useCallback(() => {
    if (!videoId || !containerRef.current || startedRef.current) return;
    startedRef.current = true;

    YouTubePool.init();

    const handleReady = () => {
      if (readyRef.current) return; // idempotent
      readyRef.current = true;
      setPosterVisible(false);

      const slot = slotRef.current;
      if (!slot || slot._isDestroyed) return;

      slot.setMuted(mutedRef.current);

      if (mutedRef.current && !getGlobalMuted() === false) {
        // Son coupé → montrer hint si son global pas encore activé
      }
      if (mutedRef.current) {
        setShowSoundHint(true);
        setTimeout(() => setShowSoundHint(false), 5000);
      }
      onReady?.();
    };

    const slot = YouTubePool.acquire(videoId, containerRef.current, {
      autoplay: true,
      muted:    true,
      onReady:  handleReady,
    });
    slotRef.current = slot;

    // Slot déjà actif depuis le warmup
    if (slot && (slot.state === 'active' || slot.state === 'paused') && slot._ready) {
      handleReady();
    }
  }, [videoId, onReady]);

  // ── isActive → autoplay ────────────────────────────────────────────────
  useEffect(() => {
    if (!videoId) return;

    if (isActive) {
      startPlayer();
      const slot = slotRef.current;
      if (slot && !slot._isDestroyed && readyRef.current) {
        slot.play();
        slot.setMuted(mutedRef.current);
      }
    } else {
      const slot = slotRef.current;
      if (slot && !slot._isDestroyed) slot.pause?.();
    }
  }, [isActive, startPlayer, videoId]);

  // ── Retry autoplay sur retour en premier plan ─────────────────────────
  useEffect(() => {
    if (!isActive) return;
    const retry = () => {
      const slot = slotRef.current;
      if (slot && !slot._isDestroyed && readyRef.current && document.visibilityState === 'visible') {
        slot.play();
      }
    };
    document.addEventListener('visibilitychange', retry);
    window.addEventListener('focus', retry);
    return () => {
      document.removeEventListener('visibilitychange', retry);
      window.removeEventListener('focus', retry);
    };
  }, [isActive]);

  // ── Sync mute → slot ──────────────────────────────────────────────────
  useEffect(() => {
    const slot = slotRef.current;
    if (!slot || slot._isDestroyed) return;
    slot.setMuted(muted);
    if (!muted) setShowSoundHint(false);
  }, [muted]);

  // ── Warmup dès le montage ─────────────────────────────────────────────
  useEffect(() => {
    if (videoId) YouTubePool.warmup([videoId]);
  }, [videoId]);

  // ── Cleanup ────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (idleRef.current != null) {
        try { cancelIdleCallback(idleRef.current); } catch {}
        try { clearTimeout(idleRef.current); } catch {}
      }
      const slot = slotRef.current;
      if (slot && !slot._isDestroyed) {
        YouTubePool.release(slot);
      }
      slotRef.current    = null;
      readyRef.current   = false;
      startedRef.current = false;
    };
  }, [videoId]);

  // ── Tap pour son ──────────────────────────────────────────────────────
  const handleTap = useCallback((e) => {
    e.stopPropagation();
    if (!showSoundHint) return;
    setShowSoundHint(false);
    setGlobalMuted(false);
    onMutedChange?.(false);
  }, [showSoundHint, onMutedChange]);

  // ── Rendu absent ──────────────────────────────────────────────────────
  if (!videoId) {
    return (
      <div style={{
        position: 'absolute', inset: 0, background: '#111',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
          Vidéo indisponible
        </span>
      </div>
    );
  }

  return (
    <div
      style={{ position: 'absolute', inset: 0, background: '#000', overflow: 'hidden' }}
      onClick={handleTap}
    >
      {/* Container YT Player */}
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />

      {/* Poster pendant le chargement */}
      <Thumbnail
        videoId={videoId}
        forcedUrl={thumbnail}
        title={title}
        visible={posterVisible}
      />

      {/* Sound hint */}
      <SoundHint
        visible={showSoundHint && isActive}
        onTap={handleTap}
      />
    </div>
  );
},
(prev, next) =>
  prev.videoId   === next.videoId   &&
  prev.embedUrl  === next.embedUrl  &&
  prev.isActive  === next.isActive  &&
  prev.muted     === next.muted     &&
  prev.thumbnail === next.thumbnail
);

YouTubeEmbed.displayName = 'YouTubeEmbed';
export default YouTubeEmbed;