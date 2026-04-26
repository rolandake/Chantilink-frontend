// 📁 src/hooks/useVideoPlayer.js
// ═══════════════════════════════════════════════════════════════════════════════
// useVideoPlayer — SOURCE DE VÉRITÉ pour toute lecture vidéo
//                  (VideoCard + AggregatedCard + tout futur composant)
//
// Porte les mêmes garanties que PostMedia/VideoItem v7 :
//
//  ✅ FIX DÉFINITIF StrictMode — src JAMAIS passé comme prop JSX.
//     React StrictMode : mount → unmount → remount. Au unmount, React vide
//     vid.src = "". Au remount, si src JSX n'a pas changé, React ne re-pose
//     PAS l'attribut DOM → vid.src === "" → onerror code=4 "Empty src".
//     Solution : ref callback (pose el.src dès insertion DOM) +
//                useLayoutEffect (vérifie synchronement avant chaque paint).
//
//  ✅ AbortController par tentative → zéro "interrupted by pause()" en console
//  ✅ Debounce configurable → absorbe les scrolls rapides sans play() fantômes
//  ✅ canplay listener proprement retiré (ref clonée → pas de closure stale)
//  ✅ Timeout readyState 6s → onError → blacklist/recycle dans VideosPage
//  ✅ Fallback proxy → direct via setCurrentSrc (re-render React propre)
//  ✅ NotAllowedError → force mute + retry → jamais bloqué sur autoplay policy
//  ✅ Cleanup complet au unmount : abort, pause, src="", load()
//  ✅ Singleton registerPlaying → une seule vidéo joue à la fois
//  ✅ Deux modes : isActive (TikTok feed) ou IntersectionObserver autonome
//  ✅ onerror code=4 sur src vide = artefact StrictMode → ignoré silencieusement
// ═══════════════════════════════════════════════════════════════════════════════

import { useRef, useState, useCallback, useEffect, useLayoutEffect, useMemo } from 'react';

// ─── Config ───────────────────────────────────────────────────────────────────
const API_BASE = (
  (typeof import.meta !== 'undefined' ? import.meta.env?.VITE_API_URL : undefined)
  || 'http://localhost:5000/api'
).replace(/\/api$/, '');

export const USER_INTERACTED_KEY = 'vp_user_interacted';

// ─── Singleton : une seule vidéo joue à la fois ──────────────────────────────
let _currentPlayingVideo = null;
export const registerPlaying = (vid) => {
  if (!vid) return;
  if (_currentPlayingVideo && _currentPlayingVideo !== vid && document.contains(_currentPlayingVideo)) {
    try { _currentPlayingVideo.pause(); } catch {}
  }
  _currentPlayingVideo = vid;
};

// ─── URL helpers ──────────────────────────────────────────────────────────────
const isPexelsVideo  = (url) => !!(url && url.includes('videos.pexels.com'));
const isPixabayVideo = (url) => !!(url && url.includes('cdn.pixabay.com/video'));
const isCloudinary   = (url) => !!(url && url.includes('res.cloudinary.com'));

export const resolveVideoUrls = (url) => {
  if (!url) return { proxy: null, direct: null };
  if (isPexelsVideo(url) || isPixabayVideo(url)) {
    return {
      proxy:  `${API_BASE}/api/proxy/video?url=${encodeURIComponent(url)}`,
      direct: null,
    };
  }
  return { proxy: null, direct: url };
};

export const getVideoPoster = (url, thumbnail = null) => {
  if (thumbnail) return thumbnail;
  if (isPexelsVideo(url)) {
    const m = url.match(/video-files\/(\d+)\//);
    return m ? `https://images.pexels.com/videos/${m[1]}/pictures/preview-0.jpg` : null;
  }
  if (isPixabayVideo(url)) {
    const t = url
      .replace('_large.mp4',  '_tiny.jpg')
      .replace('_medium.mp4', '_tiny.jpg')
      .replace('_small.mp4',  '_tiny.jpg');
    return t !== url ? t : null;
  }
  return null;
};

// ─────────────────────────────────────────────────────────────────────────────
// HOOK PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {object} options
 * @param {string}       options.url                   URL source de la vidéo
 * @param {string}       [options.thumbnail]            Poster/thumbnail (optionnel)
 * @param {boolean|null} [options.isActive=null]        null → IntersectionObserver
 * @param {boolean}      [options.initialMuted=true]
 * @param {'auto'|'metadata'|'none'} [options.preload='auto']
 * @param {function}     [options.onError]              Vidéo irrécupérable
 * @param {function}     [options.onPlay]               Lecture démarrée
 * @param {function}     [options.onMutedChange]        Mute forcé par le hook
 * @param {number}       [options.intersectionThreshold=0.5]
 * @param {boolean}      [options.useIntersection=true]
 * @param {number}       [options.debounceMs=180]
 */
export const useVideoPlayer = ({
  url,
  thumbnail             = null,
  isActive              = null,
  initialMuted          = true,
  preload               = 'auto',
  onError               = null,
  onPlay                = null,
  onMutedChange         = null,
  intersectionThreshold = 0.5,
  useIntersection       = true,
  debounceMs            = 180,
} = {}) => {

  // ── Refs DOM ──────────────────────────────────────────────────────────────
  const videoElRef    = useRef(null);
  const containerRef  = useRef(null);
  const muteButtonRef = useRef(null);

  // ── Refs internes ─────────────────────────────────────────────────────────
  const abortRef      = useRef(null);
  const debounceRef   = useRef(null);
  const canplayRef    = useRef(null);
  const timerRef      = useRef(null);
  const isVisibleRef  = useRef(false);
  const userPausedRef = useRef(false);
  const isMutedRef    = useRef(initialMuted);

  // ── URLs résolues ─────────────────────────────────────────────────────────
  const videoUrls = useMemo(() => resolveVideoUrls(url), [url]);

  // ── État React minimal ────────────────────────────────────────────────────
  const [currentSrc,    setCurrentSrc]    = useState(() => videoUrls.proxy || videoUrls.direct);
  const [videoError,    setVideoError]    = useState(false);
  const [posterVisible, setPosterVisible] = useState(true);

  const posterUrl   = useMemo(() => getVideoPoster(url, thumbnail), [url, thumbnail]);
  const crossOrigin = isCloudinary(url) ? 'anonymous' : undefined;

  // Sync si url change de l'extérieur
  useEffect(() => {
    const fresh = videoUrls.proxy || videoUrls.direct;
    setCurrentSrc(fresh);
    setVideoError(false);
    setPosterVisible(true);
  }, [videoUrls.proxy, videoUrls.direct]);

  // ─────────────────────────────────────────────────────────────────────────
  // ✅ FIX DÉFINITIF — src IMPÉRATIF (jamais via prop JSX src={})
  //
  // React StrictMode : mount → unmount → remount.
  // Au unmount : React vide vid.src = "".
  // Au remount : si la valeur JSX src n'a pas changé, React ne re-pose
  //              PAS l'attribut → vid.src === "" → onerror code=4.
  //
  // Double protection synchrone :
  //   1. ref callback : pose el.src à l'insertion DOM (avant tout render)
  //   2. useLayoutEffect : re-vérifie avant chaque paint (couvre remounts)
  // ─────────────────────────────────────────────────────────────────────────

  const videoRef = useCallback((el) => {
    videoElRef.current = el;
    if (el && currentSrc) {
      el.muted    = isMutedRef.current;
      el.volume   = isMutedRef.current ? 0 : 1;
      el.preload  = preload;
      if (el.src !== currentSrc) el.src = currentSrc;
    }
  }, [currentSrc, preload]); // eslint-disable-line

  useLayoutEffect(() => {
    const vid = videoElRef.current;
    if (!vid || !currentSrc) return;
    if (vid.src !== currentSrc) {
      vid.src    = currentSrc;
      vid.muted  = isMutedRef.current;
      vid.volume = isMutedRef.current ? 0 : 1;
      vid.preload = preload;
    }
  }, [currentSrc, preload]);

  // ─────────────────────────────────────────────────────────────────────────
  // PLAY INTERNE
  // ─────────────────────────────────────────────────────────────────────────
  const doPlay = useCallback(() => {
    if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; }
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      const vid = videoElRef.current;
      if (!vid) return;

      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      vid.muted  = isMutedRef.current;
      vid.volume = isMutedRef.current ? 0 : 1;
      userPausedRef.current = false;

      const execute = () => {
        if (ctrl.signal.aborted) return;
        if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
        registerPlaying(vid);
        const p = vid.play();
        if (!p) return;
        p.then(() => {
          if (ctrl.signal.aborted) { vid.pause(); return; }
          // Honorer l'état mute utilisateur après le premier geste
          if (sessionStorage.getItem(USER_INTERACTED_KEY) === '1') {
            vid.muted  = isMutedRef.current;
            vid.volume = isMutedRef.current ? 0 : 1;
          }
          setPosterVisible(false);
          onPlay?.();
        }).catch((err) => {
          if (ctrl.signal.aborted || err.name === 'AbortError') return;
          if (err.name === 'NotAllowedError') {
            // Politique autoplay → forcer mute + retry immédiat
            vid.muted = true; vid.volume = 0;
            isMutedRef.current = true;
            if (muteButtonRef.current) muteButtonRef.current.innerHTML = ICON_MUTED;
            onMutedChange?.(true);
            vid.play().catch(() => {});
          } else {
            // Erreur réseau transitoire → 1 retry après 300ms
            setTimeout(() => {
              if (ctrl.signal.aborted) return;
              vid.play()
                .then(() => { if (ctrl.signal.aborted) { vid.pause(); return; } setPosterVisible(false); })
                .catch(() => { vid.muted = true; vid.volume = 0; isMutedRef.current = true; onMutedChange?.(true); });
            }, 300);
          }
        });
      };

      if (vid.readyState >= 3) {
        execute();
      } else {
        // Timeout 6s → vidéo morte → blacklist
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          if (!ctrl.signal.aborted && vid.readyState < 1) {
            setVideoError(true);
            onError?.();
          }
        }, 6000);
        if (canplayRef.current) vid.removeEventListener('canplay', canplayRef.current);
        const onCan = () => {
          vid.removeEventListener('canplay', onCan);
          canplayRef.current = null;
          if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
          execute();
        };
        canplayRef.current = onCan;
        vid.addEventListener('canplay', onCan);
      }
    }, debounceMs);
  }, [onError, onPlay, onMutedChange, debounceMs]); // eslint-disable-line

  const doPause = useCallback((resetTime = false) => {
    if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; }
    if (timerRef.current)    { clearTimeout(timerRef.current);    timerRef.current    = null; }
    abortRef.current?.abort(); abortRef.current = null;
    const vid = videoElRef.current;
    if (vid) {
      if (canplayRef.current) { vid.removeEventListener('canplay', canplayRef.current); canplayRef.current = null; }
      vid.pause();
      if (resetTime) { vid.currentTime = 0; setPosterVisible(true); }
    }
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // MODE 1 — IntersectionObserver autonome
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!useIntersection || isActive !== null) return;
    const container = containerRef.current;
    if (!container) return;
    const obs = new IntersectionObserver(([entry]) => {
      isVisibleRef.current = entry.isIntersecting;
      if (entry.isIntersecting) { if (!userPausedRef.current) doPlay(); }
      else doPause(true);
    }, { threshold: intersectionThreshold, rootMargin: '-5% 0px' });
    obs.observe(container);
    return () => { obs.disconnect(); doPause(false); };
  }, [useIntersection, isActive, doPlay, doPause, intersectionThreshold]);

  // ─────────────────────────────────────────────────────────────────────────
  // MODE 2 — Contrôle externe via isActive (feed TikTok)
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isActive === null) return;
    if (isActive) { userPausedRef.current = false; doPlay(); }
    else doPause(true);
  }, [isActive]); // eslint-disable-line

  // ─────────────────────────────────────────────────────────────────────────
  // CLEANUP COMPLET AU UNMOUNT
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (timerRef.current)    clearTimeout(timerRef.current);
    abortRef.current?.abort();
    const vid = videoElRef.current;
    if (vid) {
      if (canplayRef.current) vid.removeEventListener('canplay', canplayRef.current);
      vid.pause(); vid.src = ''; vid.load();
    }
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // HANDLERS PUBLICS
  // ─────────────────────────────────────────────────────────────────────────

  /** Toggle mute : met à jour vid.muted + innerHTML du bouton impérativement */
  const handleMuteToggle = useCallback((e) => {
    e?.stopPropagation();
    sessionStorage.setItem(USER_INTERACTED_KEY, '1');
    const vid = videoElRef.current;
    if (!vid) return;
    const nm = !vid.muted;
    vid.muted = nm; vid.volume = nm ? 0 : 1;
    isMutedRef.current = nm;
    if (muteButtonRef.current) muteButtonRef.current.innerHTML = nm ? ICON_MUTED : ICON_UNMUTED;
    if (!nm && vid.paused && isVisibleRef.current) {
      userPausedRef.current = false;
      vid.play().catch(() => {
        vid.muted = true; vid.volume = 0; isMutedRef.current = true;
        if (muteButtonRef.current) muteButtonRef.current.innerHTML = ICON_MUTED;
        onMutedChange?.(true);
      });
    }
  }, [onMutedChange]);

  /** onPlay du <video> → enregistrer singleton + cacher poster */
  const handlePlay = useCallback(() => {
    registerPlaying(videoElRef.current);
    setPosterVisible(false);
    userPausedRef.current = false;
    onPlay?.();
  }, [onPlay]);

  /** onPause du <video> → mémoriser si pause volontaire */
  const handlePause = useCallback(() => {
    if (isVisibleRef.current) userPausedRef.current = true;
  }, []);

  /** onError du <video> → fallback proxy→direct ou blacklist */
  const handleError = useCallback(() => {
    const vid = videoElRef.current;
    const errCode = vid?.error?.code;
    // Code 4 sur src vide = artefact StrictMode → ignorer
    if (errCode === 4 && (!vid?.src || vid.src === window.location.href || vid.src === '')) return;
    // Fallback proxy → direct
    const { proxy, direct } = videoUrls;
    if (currentSrc === proxy && direct) { setCurrentSrc(direct); return; }
    setVideoError(true);
    onError?.();
  }, [videoUrls, currentSrc, onError]);

  /** Tap sur la vidéo → toggle play/pause */
  const handleTogglePlay = useCallback((e) => {
    e?.stopPropagation();
    const vid = videoElRef.current;
    if (!vid) return;
    if (vid.paused) {
      userPausedRef.current = false;
      vid.play().then(() => { registerPlaying(vid); setPosterVisible(false); }).catch(() => {});
    } else {
      vid.pause(); userPausedRef.current = true;
    }
  }, []);

  return {
    // ── Refs à attacher au DOM ──
    videoRef,       // ref callback → <video ref={videoRef}>
    containerRef,   // ref objet → <div ref={containerRef}> (wrappeur pour IO)
    muteButtonRef,  // ref objet → <button ref={muteButtonRef}> (innerHTML impératif)

    // ── État ──
    posterVisible,
    currentSrc,
    videoError,
    posterUrl,
    crossOrigin,

    // ── Handlers événements ──
    handleMuteToggle,   // onClick bouton mute
    handleError,        // onError <video>
    handlePlay,         // onPlay <video>
    handlePause,        // onPause <video>
    handleTogglePlay,   // onClick sur la vidéo

    // ── Contrôle impératif ──
    doPlay,
    doPause,

    // ── Accès à l'élément DOM vidéo ──
    // (pour seekBar, download, canvas watermark, etc.)
    get videoEl() { return videoElRef.current; },
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// ICÔNES SVG mutualisées
// ─────────────────────────────────────────────────────────────────────────────
export const ICON_MUTED = `<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M16.5 12A4.5 4.5 0 0 0 14 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06A8.99 8.99 0 0 0 17.73 18l1.99 2L21 18.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>`;
export const ICON_UNMUTED = `<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`;

export default useVideoPlayer;