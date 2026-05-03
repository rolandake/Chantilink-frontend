// 📁 src/pages/Videos/YouTubeEmbed.jsx — v4 STABLE
//
// ═══════════════════════════════════════════════════════════════════════════
// COMPOSANT STANDALONE — remplace YouTubeEmbed inline dans AggregatedCard
//
// PROBLÈMES RÉSOLUS vs v3 :
// ─────────────────────────────────────────────────────────────────────────
// 1. RACE CONDITION isReadyRef :
//    L'ancien composant reset isReadyRef à false sur changement d'URL mais
//    l'iframe recyclée ne refire jamais onReady → plus aucune commande
//    ne s'exécute. Ici, on délègue entièrement à YouTubePool v4 qui crée
//    une iframe fraîche par videoId si nécessaire.
//
// 2. MUTE IGNORÉ AVANT onReady :
//    YouTubePool v4 queue les commandes mute/volume correctement.
//
// 3. PAS DE THUMBNAIL → NOIR IMMÉDIAT :
//    Affiche une thumbnail + bouton play en attendant que l'utilisateur
//    interagisse. On n'autoplay pas sans geste utilisateur (mobile).
//
// 4. POSTER FIRST :
//    L'iframe n'est créée que quand isActive=true, évitant les iframes
//    fantômes qui consomment de la bande passante.
//
// API :
//   <YouTubeEmbed
//     videoId="dQw4w9WgXcQ"         // obligatoire
//     isActive={bool}               // contrôle play/pause
//     muted={bool}                  // sync depuis le parent
//     thumbnail="https://..."       // optionnel
//     title="..."                   // optionnel
//     onReady={() => {}}            // callback quand le player est prêt
//   />
// ═══════════════════════════════════════════════════════════════════════════

import React, { useEffect, useRef, useState, useCallback, memo } from 'react';
import YouTubePool from './YouTubePool';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers thumbnail YouTube — plusieurs qualités en fallback
// ─────────────────────────────────────────────────────────────────────────────
const YT_THUMB_QUALITIES = ['maxresdefault', 'hqdefault', 'mqdefault', 'sddefault'];

const getYouTubeThumbnails = (videoId) =>
  YT_THUMB_QUALITIES.map(q => `https://img.youtube.com/vi/${videoId}/${q}.jpg`);

// ─────────────────────────────────────────────────────────────────────────────
// Thumbnail component avec fallback automatique
// ─────────────────────────────────────────────────────────────────────────────
const YouTubeThumbnail = memo(({ videoId, forcedUrl, title, onPlay }) => {
  const [thumbIdx, setThumbIdx]    = useState(0);
  const [thumbLoaded, setThumbLoaded] = useState(false);
  const [thumbFailed, setThumbFailed] = useState(false);

  const thumbUrls = forcedUrl
    ? [forcedUrl, ...getYouTubeThumbnails(videoId)]
    : getYouTubeThumbnails(videoId);

  const handleError = useCallback(() => {
    if (thumbIdx < thumbUrls.length - 1) {
      setThumbIdx(i => i + 1);
      setThumbLoaded(false);
    } else {
      setThumbFailed(true);
    }
  }, [thumbIdx, thumbUrls.length]);

  return (
    <div style={{ position: 'absolute', inset: 0, cursor: 'pointer', background: '#000' }} onClick={onPlay}>
      {/* Thumbnail */}
      {!thumbFailed && (
        <>
          {!thumbLoaded && (
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(135deg, #0f0f1a 0%, #1a0f2e 50%, #0f1a0f 100%)',
            }} />
          )}
          <img
            src={thumbUrls[thumbIdx]}
            alt={title || 'YouTube video'}
            style={{
              width: '100%', height: '100%', objectFit: 'cover',
              opacity: thumbLoaded ? 1 : 0,
              transition: 'opacity 0.3s ease',
            }}
            onLoad={() => setThumbLoaded(true)}
            onError={handleError}
            draggable="false"
          />
          {/* Dégradé sombre en bas */}
          {thumbLoaded && (
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 50%)',
              pointerEvents: 'none',
            }} />
          )}
        </>
      )}

      {/* Fallback no thumbnail */}
      {thumbFailed && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(135deg, #0f0f1a, #1a0f2e)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {/* Logo YouTube simplifié */}
          <svg width="48" height="34" viewBox="0 0 48 34" fill="none">
            <rect width="48" height="34" rx="8" fill="#FF0000" />
            <path d="M20 10l14 7-14 7V10z" fill="white" />
          </svg>
        </div>
      )}

      {/* Bouton Play */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'none',
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: 'rgba(255,0,0,0.88)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)',
        }}>
          {/* Triangle play */}
          <div style={{
            width: 0, height: 0, marginLeft: 5,
            borderTop: '11px solid transparent',
            borderBottom: '11px solid transparent',
            borderLeft: '19px solid white',
          }} />
        </div>
      </div>

      {/* Badge YouTube */}
      <div style={{
        position: 'absolute', top: 8, left: 8,
        display: 'flex', alignItems: 'center', gap: 5,
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: 9999, padding: '3px 10px',
      }}>
        <svg width="12" height="9" viewBox="0 0 12 9" fill="none">
          <rect width="12" height="9" rx="2" fill="#FF0000" />
          <path d="M4.5 2.5l4 2-4 2V2.5z" fill="white" />
        </svg>
        <span style={{ color: 'white', fontSize: 10, fontWeight: 700 }}>YouTube</span>
      </div>

      {/* Indication tap */}
      <div style={{
        position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
        color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 500,
        whiteSpace: 'nowrap', pointerEvents: 'none',
      }}>
        Appuyer pour lire
      </div>
    </div>
  );
});
YouTubeThumbnail.displayName = 'YouTubeThumbnail';

// ─────────────────────────────────────────────────────────────────────────────
// Spinner de chargement
// ─────────────────────────────────────────────────────────────────────────────
const LoadingOverlay = memo(() => (
  <div style={{
    position: 'absolute', inset: 0, zIndex: 5,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
    pointerEvents: 'none',
  }}>
    <div style={{
      width: 36, height: 36, borderRadius: '50%',
      border: '3px solid rgba(255,255,255,0.15)',
      borderTopColor: '#FF0000',
      animation: 'yt-spin 0.8s linear infinite',
    }} />
    <style>{`@keyframes yt-spin { to { transform: rotate(360deg); } }`}</style>
  </div>
));
LoadingOverlay.displayName = 'LoadingOverlay';

// ─────────────────────────────────────────────────────────────────────────────
// Extraire un videoId depuis plusieurs formats d'URL
// ─────────────────────────────────────────────────────────────────────────────
export const extractVideoId = (url) => {
  if (!url) return null;
  // Format: /embed/VIDEO_ID
  const embedMatch = url.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
  if (embedMatch) return embedMatch[1];
  // Format: youtu.be/VIDEO_ID
  const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (shortMatch) return shortMatch[1];
  // Format: youtube.com/watch?v=VIDEO_ID
  const watchMatch = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (watchMatch) return watchMatch[1];
  return null;
};

// ─────────────────────────────────────────────────────────────────────────────
// YouTubeEmbed — composant principal
// ─────────────────────────────────────────────────────────────────────────────
const YouTubeEmbed = memo(({
  videoId: videoIdProp,   // videoId direct
  embedUrl,               // OU URL embed/watch (extractVideoId sera appelé)
  isActive,
  muted = true,
  thumbnail = null,       // URL thumbnail forcée
  title = '',
  onReady = null,
  showBadge = true,
}) => {
  const containerRef = useRef(null);
  const slotRef      = useRef(null);
  const isActiveRef  = useRef(isActive);
  const mutedRef     = useRef(muted);

  // Résoudre le videoId
  const videoId = videoIdProp || extractVideoId(embedUrl);

  // États UI
  const [phase, setPhase] = useState('poster'); // poster | loading | playing | error
  const phaseRef = useRef('poster');

  const setPhaseSync = (p) => { phaseRef.current = p; setPhase(p); };

  useEffect(() => { isActiveRef.current = isActive; }, [isActive]);
  useEffect(() => { mutedRef.current    = muted;    }, [muted]);

  // ── Sync mute vers le slot actif ─────────────────────────────────────────
  useEffect(() => {
    if (slotRef.current && !slotRef.current._isDestroyed) {
      slotRef.current.setMuted(muted);
    }
  }, [muted]);

  // ── Sync play/pause selon isActive ───────────────────────────────────────
  useEffect(() => {
    const slot = slotRef.current;
    if (!slot || slot._isDestroyed) return;
    if (phaseRef.current !== 'playing') return; // Pas encore en lecture

    if (isActive) {
      slot.play();
      slot.setMuted(mutedRef.current);
    } else {
      slot.pause();
    }
  }, [isActive]);

  // ── Démarrage de la lecture (après tap sur thumbnail) ────────────────────
  const startPlayback = useCallback(() => {
    if (!videoId || !containerRef.current) return;
    if (phaseRef.current === 'loading' || phaseRef.current === 'playing') return;

    setPhaseSync('loading');

    // Initialiser le pool si nécessaire
    YouTubePool.init();

    // Acquérir un slot
    const slot = YouTubePool.acquire(videoId, containerRef.current, {
      autoplay: true,
      muted:    mutedRef.current,
    });
    slotRef.current = slot;

    // Écouter quand le player est prêt
    // YouTubePool gère l'état interne — on surveille via polling
    const checkReady = setInterval(() => {
      if (!slot || slot._isDestroyed) { clearInterval(checkReady); return; }
      if (slot.state === 'ready' || slot.state === 'active') {
        clearInterval(checkReady);
        setPhaseSync('playing');
        onReady?.();
      }
    }, 200);

    // Timeout max 10s
    const failTimer = setTimeout(() => {
      clearInterval(checkReady);
      if (phaseRef.current === 'loading') {
        console.warn(`[YouTubeEmbed] ${videoId} pas de réponse du player en 10s → error`);
        setPhaseSync('error');
      }
    }, 10000);

    // Si le slot était déjà prêt (depuis warmup), passer directement en playing
    if (slot.state === 'ready' || slot.state === 'active') {
      clearInterval(checkReady);
      clearTimeout(failTimer);
      setPhaseSync('playing');
      onReady?.();
    }

    // Cleanup de CES timers si le composant unmount
    return () => { clearInterval(checkReady); clearTimeout(failTimer); };
  }, [videoId, onReady]);

  // ── Si isActive passe à true et qu'on était en poster, démarrer auto ─────
  // (comportement optionnel — décommente si tu veux l'autoplay au scroll)
  // useEffect(() => {
  //   if (isActive && phaseRef.current === 'poster') startPlayback();
  // }, [isActive, startPlayback]);

  // ── Pause quand isActive=false ────────────────────────────────────────────
  useEffect(() => {
    if (!isActive && slotRef.current && !slotRef.current._isDestroyed) {
      slotRef.current.pause();
    }
  }, [isActive]);

  // ── Cleanup au démontage ──────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (slotRef.current && !slotRef.current._isDestroyed) {
        YouTubePool.release(slotRef.current);
        slotRef.current = null;
      }
    };
  }, [videoId]);

  // ── Pré-warmup quand la slide est proche (isActive ou presque) ───────────
  useEffect(() => {
    if (!videoId) return;
    // Warmup dès que le composant monte (même si pas encore actif)
    YouTubePool.warmup([videoId]);
  }, [videoId]);

  if (!videoId) {
    return (
      <div style={{
        position: 'absolute', inset: 0, background: '#111',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Vidéo indisponible</span>
      </div>
    );
  }

  return (
    <div style={{ position: 'absolute', inset: 0, background: '#000', overflow: 'hidden' }}>
      {/* Container pour l'iframe YouTube (géré par YouTubePool) */}
      <div
        ref={containerRef}
        style={{
          position: 'absolute', inset: 0,
          // Cacher l'iframe quand on est encore en poster/loading
          opacity: phase === 'playing' ? 1 : 0,
          transition: 'opacity 0.35s ease',
          pointerEvents: phase === 'playing' ? 'auto' : 'none',
        }}
      />

      {/* Poster + bouton play (phase = poster) */}
      {phase === 'poster' && (
        <YouTubeThumbnail
          videoId={videoId}
          forcedUrl={thumbnail}
          title={title}
          onPlay={startPlayback}
        />
      )}

      {/* Spinner de chargement */}
      {phase === 'loading' && (
        <>
          {/* Garder la thumbnail visible pendant le chargement */}
          {thumbnail && (
            <img
              src={thumbnail}
              alt={title}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.4 }}
            />
          )}
          <LoadingOverlay />
        </>
      )}

      {/* État erreur */}
      {phase === 'error' && (
        <div style={{
          position: 'absolute', inset: 0,
          background: '#0a0a0a',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 12,
        }}>
          {thumbnail && (
            <img src={thumbnail} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.15 }} />
          )}
          <div style={{ position: 'relative', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>📹</div>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, margin: 0 }}>
              Vidéo indisponible
            </p>
            {/* Bouton réessayer */}
            <button
              onClick={() => { setPhaseSync('poster'); }}
              style={{
                marginTop: 16, padding: '8px 20px', borderRadius: 9999,
                background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
                color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Réessayer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}, (prev, next) =>
  prev.videoId   === next.videoId   &&
  prev.embedUrl  === next.embedUrl  &&
  prev.isActive  === next.isActive  &&
  prev.muted     === next.muted     &&
  prev.thumbnail === next.thumbnail
);

YouTubeEmbed.displayName = 'YouTubeEmbed';
export default YouTubeEmbed;