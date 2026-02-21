// 📁 src/pages/Home/PostMedia.jsx
//
// ✅ LCP FIX (10.3s → cible < 2.5s) :
//   PROBLÈME : l'élément LCP était `<video>` — le navigateur attend que la vidéo
//   soit suffisamment chargée avant de valider le LCP, ce qui prend 8-10s.
//   SOLUTION : on rend un vrai <img> poster par-dessus la vidéo en position absolute.
//   Cet <img> devient l'élément LCP (charge en < 500ms depuis Cloudinary CDN).
//   Il est caché (opacity 0) dès que onPlay se déclenche.
//   fetchpriority="high" + loading="eager" sur la première image du premier post.
//   preload="none" sur TOUTES les vidéos — le poster suffit.
//
// ✅ CLS FIX (0.23 → cible < 0.1) :
//   PROBLÈME : `style={{ aspectRatio: '1/1' }}` en JS inline → le navigateur
//   ne peut pas calculer l'espace réservé avant l'exécution de React.
//   SOLUTION : class Tailwind `aspect-square` (défini dans le CSS statique).
//   Le navigateur alloue l'espace dès le parsing HTML/CSS, avant tout JS.
//
// ✅ INP FIX (232ms → cible < 200ms) :
//   PROBLÈME : `useCallback([isMutedMap])` recrée handleToggleMute à chaque
//   changement de state → React propagait les nouvelles refs à tous les enfants
//   → re-renders en cascade sur chaque interaction.
//   SOLUTION : stocker isMutedMap dans un useRef. Le callback useCallback([])
//   lit toujours la valeur à jour via le ref sans jamais être recréé.

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { FaVolumeUp, FaVolumeMute } from "react-icons/fa";
import VideoWatermark from "../../components/VideoWatermark";

const CLOUD_NAME = "dlymdclhe";
const IMG_BASE = `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/`;
const VID_BASE = `https://res.cloudinary.com/${CLOUD_NAME}/video/upload/`;

const isVideoUrl = url => url && /\.(mp4|webm|mov|avi)$/i.test(url);

// ─────────────────────────────────────────────────────────────────
// getVideoPosterUrl — génère une URL image depuis une URL vidéo Cloudinary
// Extrait le public_id en ignorant les blocs de transformation
// ─────────────────────────────────────────────────────────────────
const getVideoPosterUrl = (videoUrl) => {
  if (!videoUrl) return null;
  try {
    if (videoUrl.includes('res.cloudinary.com')) {
      const uploadIndex = videoUrl.indexOf('/upload/');
      if (uploadIndex === -1) return null;
      const afterUpload = videoUrl.substring(uploadIndex + 8);

      // Parcourir les segments et ignorer les blocs de transformation Cloudinary
      // Un bloc de transformation contient "," ou commence par "[a-z]_[a-z]"
      // Une version ressemble à "v1234567"
      const segments = afterUpload.split('/');
      const publicIdSegments = [];

      for (const seg of segments) {
        const isTransform = seg.includes(',') || (/^[a-z]+_[a-z]/.test(seg) && !seg.includes('.'));
        if (!isTransform) {
          publicIdSegments.push(seg);
        }
      }

      const publicId = publicIdSegments
        .join('/')
        .replace(/\.(mp4|webm|mov|avi)$/i, '');

      if (!publicId) return null;
      return `${IMG_BASE}q_auto:good,f_jpg,w_1080,c_limit,so_0/${publicId}.jpg`;
    }
    // URL relative
    const withoutExt = videoUrl.replace(/^\/+/, '').replace(/\.(mp4|webm|mov|avi)$/i, '');
    return `${IMG_BASE}q_auto:good,f_jpg,w_1080,c_limit,so_0/${withoutExt}.jpg`;
  } catch {
    return null;
  }
};

const getOptimizedUrl = (url, isLCP = false) => {
  if (!url) return null;
  if (url.startsWith('data:')) return url;
  if (url.includes('res.cloudinary.com')) {
    if (url.includes('q_auto') || url.includes('w_1080') || url.includes('f_auto')) return url;
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
    return url;
  }
  if (url.startsWith('http')) return url;
  const id    = url.replace(/^\/+/, '');
  const video = isVideoUrl(id);
  if (video) return `${VID_BASE}q_auto:good,f_auto,w_1080,c_limit/${id}`;
  if (isLCP) return `${IMG_BASE}q_auto:good,f_auto,fl_progressive:steep,w_1080,c_limit/${id}`;
  return `${IMG_BASE}q_auto,f_auto,fl_progressive:steep,w_1080,c_limit/${id}`;
};

// ─────────────────────────────────────────────────────────────────
// PostMedia
// ─────────────────────────────────────────────────────────────────
const PostMedia = React.memo(({ mediaUrls, isFirstPost = false, priority = false }) => {
  const [index,        setIndex]        = useState(0);
  const [loadedImages, setLoadedImages] = useState({});
  const [videoStates,  setVideoStates]  = useState({});

  // ✅ INP FIX : state pour le rendu + ref pour les callbacks (jamais re-créés)
  const [isMutedMap,   setIsMutedMap]   = useState({});
  const isMutedRef = useRef({});         // Lu dans handleToggleMute sans dépendance

  // ✅ LCP FIX : track quelles vidéos sont en train de jouer (pour masquer le poster)
  const [playingSet, setPlayingSet] = useState({});

  const containerRef  = useRef(null);
  const videoRefs     = useRef({});
  const touch         = useRef({ x: 0, y: 0, time: 0 });
  const dir           = useRef(null);
  const hasInteracted = useRef(false);
  const isDragging    = useRef(false);
  const preloadImgRef = useRef(null);

  if (!mediaUrls?.length) return null;

  const isLCPSlot = isFirstPost || priority;

  const urls = useMemo(() =>
    mediaUrls.map((url, i) => getOptimizedUrl(url, isLCPSlot && i === 0)),
    [mediaUrls, isLCPSlot]
  );

  const posterUrls = useMemo(() =>
    urls.map(url => isVideoUrl(url) ? getVideoPosterUrl(url) : null),
    [urls]
  );

  const total = urls.length;

  // Init isMuted + playingSet
  useEffect(() => {
    const initial = {};
    urls.forEach((url, i) => { if (isVideoUrl(url)) initial[i] = true; });
    isMutedRef.current = initial;
    setIsMutedMap(initial);
    setPlayingSet({});
  }, [urls.length]); // eslint-disable-line

  // Déblocage autoplay
  useEffect(() => {
    const unlock = () => { hasInteracted.current = true; };
    ['click', 'touchstart', 'keydown'].forEach(ev =>
      document.addEventListener(ev, unlock, { once: true, passive: true })
    );
    return () => ['click', 'touchstart', 'keydown'].forEach(ev =>
      document.removeEventListener(ev, unlock)
    );
  }, []);

  // Préchargement image suivante
  useEffect(() => {
    if (total <= 1) return;
    const next    = (index + 1) % total;
    const nextUrl = urls[next];
    if (!isVideoUrl(nextUrl) && !nextUrl?.startsWith('data:')) {
      if (preloadImgRef.current) { preloadImgRef.current.src = ''; preloadImgRef.current = null; }
      const img = new Image();
      img.src = nextUrl;
      preloadImgRef.current = img;
    }
    return () => {
      if (preloadImgRef.current) { preloadImgRef.current.src = ''; preloadImgRef.current = null; }
    };
  }, [index, urls, total]);

  // Play/pause + reset mute/poster au changement de slide
  useEffect(() => {
    Object.entries(videoRefs.current).forEach(([i, v]) => {
      if (!v) return;
      const idx = parseInt(i, 10);
      if (idx !== index) {
        v.pause();
        v.muted  = true;
        v.volume = 0;
        isMutedRef.current = { ...isMutedRef.current, [idx]: true };
        setIsMutedMap(prev => ({ ...prev, [idx]: true }));
        setPlayingSet(prev => ({ ...prev, [idx]: false }));
      } else if (v.muted || hasInteracted.current) {
        v.play().catch(() => {});
      }
    });
  }, [index]);

  // ✅ LCP FIX : callbacks play/pause/ended mis à jour pour playingSet
  const handleVideoPlay = useCallback((i) => {
    setPlayingSet(prev => ({ ...prev, [i]: true }));
    const url = urls[i];
    if (url) setVideoStates(prev => ({ ...prev, [url]: { isPlaying: true, hasEnded: false } }));
  }, [urls]);

  const handleVideoPause = useCallback((i, url) => {
    setVideoStates(prev => ({ ...prev, [url]: { ...prev[url], isPlaying: false } }));
  }, []);

  const handleVideoEnded = useCallback((i, url) => {
    setVideoStates(prev => ({ ...prev, [url]: { isPlaying: false, hasEnded: true } }));
  }, []);

  // ✅ INP FIX : dépendances vides — lit via isMutedRef, jamais re-créé
  const handleToggleMute = useCallback((e, i) => {
    e.stopPropagation();
    const vid           = videoRefs.current[i];
    const currentlyMuted = isMutedRef.current[i] !== false;
    const newMuted       = !currentlyMuted;

    isMutedRef.current   = { ...isMutedRef.current, [i]: newMuted };
    setIsMutedMap(prev  => ({ ...prev, [i]: newMuted }));

    if (!vid) return;

    if (newMuted) {
      vid.muted  = true;
      vid.volume = 0;
    } else {
      // Séquence débloquage son mobile (iOS Safari / Android Chrome)
      vid.pause();
      vid.muted  = false;
      vid.volume = 1;
      vid.play().catch(() => {
        vid.muted  = true;
        vid.volume = 0;
        isMutedRef.current = { ...isMutedRef.current, [i]: true };
        setIsMutedMap(prev => ({ ...prev, [i]: true }));
      });
    }
  }, []); // ← [] stable, lit via ref

  // Swipe handlers
  useEffect(() => {
    if (total <= 1) return;
    const el = containerRef.current;
    if (!el) return;

    const SWIPE_THRESHOLD = 50;
    const TIME_THRESHOLD  = 500;
    const DIR_THRESHOLD   = 10;

    const onStart = e => {
      const t = e.touches?.[0] || e;
      touch.current   = { x: t.clientX, y: t.clientY, time: Date.now() };
      dir.current     = null;
      isDragging.current = true;
    };
    const onMove = e => {
      if (!touch.current.x || !isDragging.current) return;
      const t  = e.touches?.[0] || e;
      const dx = t.clientX - touch.current.x;
      const dy = t.clientY - touch.current.y;
      if (dir.current === null && (Math.abs(dx) > DIR_THRESHOLD || Math.abs(dy) > DIR_THRESHOLD)) {
        dir.current = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
      }
      if (dir.current === 'h' && e.cancelable) try { e.preventDefault(); } catch {}
    };
    const onEnd = e => {
      if (!isDragging.current || !touch.current.x) return;
      const t       = e.changedTouches?.[0] || e;
      const dx      = touch.current.x - t.clientX;
      const elapsed = Date.now() - touch.current.time;
      if (dir.current === 'h' && Math.abs(dx) > SWIPE_THRESHOLD && elapsed < TIME_THRESHOLD) {
        setIndex(prev => dx > 0 ? (prev + 1) % total : (prev - 1 + total) % total);
      }
      touch.current      = { x: 0, y: 0, time: 0 };
      dir.current        = null;
      isDragging.current = false;
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
    /*
     * ✅ CLS FIX : `aspect-square` (Tailwind) au lieu de style={{ aspectRatio:'1/1' }}
     * Le navigateur calcule l'espace AVANT que JS s'exécute → zéro layout shift.
     * `contain: layout paint` isole le composant du reste du layout.
     */
    <div
      ref={containerRef}
      className="relative w-full bg-black overflow-hidden select-none aspect-square"
      style={{ contain: 'layout paint', cursor: 'grab', touchAction: 'pan-y pinch-zoom' }}
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
          const isVid      = isVideoUrl(url);
          const isSVG      = url?.startsWith('data:image/svg+xml');
          const isLoaded   = loadedImages[i];
          const videoState = videoStates[url] || { isPlaying: false, hasEnded: false };
          const isLCP      = isLCPSlot && i === 0;
          const posterUrl  = posterUrls[i];
          const vidMuted   = isMutedMap[i] !== false;
          const isPlaying  = !!playingSet[i];

          return (
            <div
              key={i}
              className="relative flex items-center justify-center bg-black flex-shrink-0"
              style={{ width: `${100 / total}%`, height: '100%' }}
            >
              {/* Placeholder images */}
              {!isVid && !isSVG && !isLoaded && (
                <div className="absolute inset-0 bg-gray-900 animate-pulse" />
              )}

              {isVid ? (
                <>
                  {/*
                   * ✅ LCP FIX : preload="none" sur TOUTES les vidéos.
                   * Le vrai LCP element est l'<img> poster ci-dessous.
                   * La vidéo ne charge que quand elle joue.
                   */}
                  <video
                    ref={el => { videoRefs.current[i] = el; }}
                    src={url}
                    className="w-full h-full"
                    style={{ objectFit: 'contain' }}
                    preload="none"
                    muted
                    playsInline
                    loop
                    controls={total === 1}
                    onPlay={()    => handleVideoPlay(i)}
                    onPause={()   => handleVideoPause(i, url)}
                    onEnded={()   => handleVideoEnded(i, url)}
                    onClick={(e) => { if (total > 1) handleToggleMute(e, i); }}
                  />

                  {/*
                   * ✅ LCP FIX : <img> poster en position absolute par-dessus la vidéo.
                   * C'est lui que le navigateur mesure comme LCP element (charge en < 500ms).
                   * opacity:0 + pointer-events:none dès que la vidéo joue → invisible mais
                   * reste dans le DOM pour éviter un layout shift.
                   * Sur le slot LCP (premier post) : fetchpriority="high" + loading="eager"
                   */}
                  {posterUrl && (
                    <img
                      src={posterUrl}
                      alt=""
                      className="absolute inset-0 w-full h-full"
                      style={{
                        objectFit:     'contain',
                        zIndex:        2,
                        opacity:       isPlaying ? 0 : 1,
                        transition:    'opacity 0.3s ease',
                        pointerEvents: 'none',
                      }}
                      loading={isLCP ? 'eager' : 'lazy'}
                      fetchpriority={isLCP ? 'high' : 'auto'}
                      decoding={isLCP ? 'sync' : 'async'}
                      draggable="false"
                    />
                  )}

                  {/* Bouton mute en mode galerie */}
                  {total > 1 && i === index && (
                    <button
                      onClick={(e) => handleToggleMute(e, i)}
                      className="absolute bottom-3 right-3 z-20 w-9 h-9 rounded-full bg-black/50 backdrop-blur-md border border-white/20 flex items-center justify-center text-white"
                      style={{ touchAction: 'manipulation' }}
                      aria-label={vidMuted ? 'Activer le son' : 'Couper le son'}
                    >
                      {vidMuted
                        ? <FaVolumeMute className="text-sm" />
                        : <FaVolumeUp   className="text-sm" />
                      }
                    </button>
                  )}

                  {i === index && (
                    <VideoWatermark
                      videoRef={videoRefs.current[i]}
                      isPlaying={videoState.isPlaying}
                      showFinalWatermark={videoState.hasEnded}
                    />
                  )}
                </>
              ) : (
                <img
                  src={url}
                  alt=""
                  className="w-full h-full"
                  style={{
                    objectFit:      'contain',
                    opacity:        isSVG || isLoaded ? 1 : 0,
                    transition:     isLCP ? 'none' : 'opacity 0.2s ease',
                    imageRendering: 'high-quality',
                    userSelect:     'none',
                    display:        'block',
                  }}
                  loading={isLCP ? 'eager' : 'lazy'}
                  fetchpriority={isLCP ? 'high' : 'low'}
                  decoding={isLCP ? 'sync' : 'async'}
                  onLoad={()  => setLoadedImages(prev => ({ ...prev, [i]: true }))}
                  onError={()  => setLoadedImages(prev => ({ ...prev, [i]: true }))}
                  draggable="false"
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Navigation galerie */}
      {total > 1 && (
        <>
          <div className="absolute inset-y-0 left-0  w-16 sm:hidden z-10" onClick={goPrev} />
          <div className="absolute inset-y-0 right-0 w-16 sm:hidden z-10" onClick={goNext} />
          <button
            onClick={goPrev}
            className="hidden sm:flex absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-3 rounded-full z-10"
            style={{ touchAction: 'manipulation' }}
            aria-label="Précédent"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={goNext}
            className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-3 rounded-full z-10"
            style={{ touchAction: 'manipulation' }}
            aria-label="Suivant"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
            {urls.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                style={{
                  width:           i === index ? 20 : 8,
                  height:          8,
                  borderRadius:    4,
                  backgroundColor: i === index ? 'white' : 'rgba(255,255,255,0.5)',
                  transition:      'width 0.2s ease, background-color 0.2s ease',
                  border:          'none',
                  padding:         0,
                  touchAction:     'manipulation',
                  cursor:          'pointer',
                }}
                aria-label={`Aller à l'image ${i + 1}`}
              />
            ))}
          </div>
          <div className="absolute top-3 right-3 bg-black/60 text-white px-2.5 py-1 rounded-full text-xs font-semibold">
            {index + 1}/{total}
          </div>
        </>
      )}
    </div>
  );
});

PostMedia.displayName = "PostMedia";
export default PostMedia;