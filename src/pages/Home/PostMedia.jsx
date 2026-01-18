// ============================================
// 📁 src/pages/Home/PostMedia.jsx
// VERSION OPTIMISÉE LCP + SWIPE + CLOUDINARY
// ============================================
import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";

const CLOUD_NAME = "dlymdclhe";
const IMG_BASE = `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/`;
const VID_BASE = `https://res.cloudinary.com/${CLOUD_NAME}/video/upload/`;

const isVideo = url => url && /\.(mp4|webm|mov|avi)$/i.test(url);

const getUltraHDUrl = (url) => {
  if (!url) return null;
  if (url.includes('res.cloudinary.com') || url.startsWith('http')) return url;

  const id = url.replace(/^\/+/, '');
  const video = isVideo(id);
  const base = video ? VID_BASE : IMG_BASE;

  if (video) return `${base}q_auto:best,f_auto,w_1920,c_limit/${id}`;

  return `${base}q_100,f_auto,fl_progressive:steep,dpr_2.0,w_2048,c_limit,e_sharpen:100,cs_srgb/${id}`;
};

const PostMedia = React.memo(({ mediaUrls, isFirstPost = false }) => { // 🔥 AJOUT PROP
  const [index, setIndex] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [loadedImages, setLoadedImages] = useState({}); // 🔥 TRACKING CHARGEMENT
  const containerRef = useRef(null);
  const videoRefs = useRef({});
  const touch = useRef({ x: 0, y: 0, time: 0 });
  const dir = useRef(null);
  const hasInteracted = useRef(false);

  if (!mediaUrls?.length) return null;

  const urls = mediaUrls.map(getUltraHDUrl);
  const total = urls.length;

  // === DÉBLOCAGE AUTOPLAY APRÈS INTERACTION ===
  useEffect(() => {
    const unlock = () => {
      hasInteracted.current = true;
      ['click', 'touchstart', 'keydown'].forEach(ev =>
        document.removeEventListener(ev, unlock)
      );
    };
    ['click', 'touchstart', 'keydown'].forEach(ev =>
      document.addEventListener(ev, unlock, { once: true })
    );
    return () => {
      ['click', 'touchstart', 'keydown'].forEach(ev =>
        document.removeEventListener(ev, unlock)
      );
    };
  }, []);

  // === PRÉCHARGEMENT IMAGE SUIVANTE ===
  useEffect(() => {
    const next = (index + 1) % total;
    if (!isVideo(urls[next])) {
      const img = new Image();
      img.src = urls[next];
    }
  }, [index, urls, total]);

  // === GESTION VIDÉOS : PLAY/PAUSE + AUTOPLAY MUET ===
  useEffect(() => {
    const currentVideo = videoRefs.current[index];
    const otherVideos = Object.values(videoRefs.current).filter((_, i) => i !== index);

    otherVideos.forEach(v => v?.pause());

    if (currentVideo && (currentVideo.muted || hasInteracted.current)) {
      currentVideo.play().catch(() => {});
    }
  }, [index]);

  // === SWIPE MOBILE/DESKTOP ===
  useEffect(() => {
    if (total <= 1) return;
    const el = containerRef.current;
    if (!el) return;

    const SWIPE = 50, TIME = 500, DIR = 10;

    const start = e => {
      const t = e.touches?.[0] || e;
      touch.current = { x: t.clientX, y: t.clientY, time: Date.now() };
      dir.current = null;
      setDragging(true);
    };

    const move = e => {
      if (!touch.current.x) return;
      const t = e.touches?.[0] || e;
      const dx = t.clientX - touch.current.x;
      const dy = t.clientY - touch.current.y;

      if (dir.current === null && (Math.abs(dx) > DIR || Math.abs(dy) > DIR)) {
        dir.current = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
      }

      if (dir.current === 'h') {
        e.preventDefault();
      }
    };

    const end = e => {
      if (!touch.current.x) return;
      const t = e.changedTouches?.[0] || e;
      const dx = touch.current.x - t.clientX;
      const time = Date.now() - touch.current.time;

      if (dir.current === 'h' && Math.abs(dx) > SWIPE && time < TIME) {
        setIndex(prev => dx > 0 ? (prev + 1) % total : (prev - 1 + total) % total);
      }

      touch.current = { x: 0, y: 0, time: 0 };
      dir.current = null;
      setDragging(false);
    };

    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchmove', move, { passive: false });
    el.addEventListener('touchend', end, { passive: true });
    el.addEventListener('mousedown', start);
    el.addEventListener('mousemove', move);
    el.addEventListener('mouseup', end);
    el.addEventListener('mouseleave', end);

    return () => {
      el.removeEventListener('touchstart', start);
      el.removeEventListener('touchmove', move);
      el.removeEventListener('touchend', end);
      el.removeEventListener('mousedown', start);
      el.removeEventListener('mousemove', move);
      el.removeEventListener('mouseup', end);
      el.removeEventListener('mouseleave', end);
    };
  }, [total]);

  const prev = useCallback(() => setIndex(i => (i - 1 + total) % total), [total]);
  const next = useCallback(() => setIndex(i => (i + 1) % total), [total]);

  return (
    <div
      ref={containerRef}
      className="relative w-full bg-black group select-none overflow-hidden"
      style={{ maxHeight: '600px', cursor: dragging ? 'grabbing' : 'grab', touchAction: 'pan-y' }}
    >
      <motion.div
        animate={{ x: `-${index * 100}%` }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="flex w-full"
        style={{ minHeight: '300px' }}
      >
        {urls.map((url, i) => (
          <div key={i} className="w-full flex-shrink-0 flex items-center justify-center bg-black relative">
            {/* 🔥 PLACEHOLDER PENDANT CHARGEMENT */}
            {!isVideo(url) && !loadedImages[i] && (
              <div className="absolute inset-0 animate-pulse bg-gray-800" />
            )}
            
            {isVideo(url) ? (
              <video
                ref={el => videoRefs.current[i] = el}
                src={url}
                className="w-full h-auto max-h-[600px]"
                style={{ objectFit: 'contain' }}
                preload={isFirstPost && i === 0 ? "auto" : "metadata"} // 🔥 LCP
                muted
                playsInline
                loop
                controls={total === 1}
                onClick={() => {
                  const v = videoRefs.current[i];
                  if (v) v.muted = !v.muted;
                }}
              />
            ) : (
              <img
                src={url}
                alt=""
                className={`w-full h-auto max-h-[600px] transition-opacity duration-300 ${
                  loadedImages[i] ? 'opacity-100' : 'opacity-0'
                }`}
                style={{
                  objectFit: 'contain',
                  imageRendering: 'high-quality',
                  userSelect: 'none',
                  pointerEvents: dragging ? 'none' : 'auto'
                }}
                // 🔥 OPTIMISATIONS LCP CRITIQUES
                loading={isFirstPost && i === 0 ? 'eager' : 'lazy'}
                fetchpriority={isFirstPost && i === 0 ? 'high' : 'auto'}
                decoding={isFirstPost && i === 0 ? 'sync' : 'async'}
                onLoad={() => setLoadedImages(prev => ({ ...prev, [i]: true }))}
                draggable="false"
              />
            )}
          </div>
        ))}
      </motion.div>

      {total > 1 && (
        <>
          {/* Zones tactiles mobile */}
          <div className="absolute inset-y-0 left-0 w-20 sm:hidden z-10" onClick={prev} />
          <div className="absolute inset-y-0 right-0 w-20 sm:hidden z-10" onClick={next} />

          {/* Flèches desktop */}
          <button
            onClick={prev}
            className="hidden sm:flex absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-3 rounded-full opacity-0 group-hover:opacity-100 transition-all z-10"
            aria-label="Précédent"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={next}
            className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-3 rounded-full opacity-0 group-hover:opacity-100 transition-all z-10"
            aria-label="Suivant"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Points indicateurs */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
            {urls.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                className={`w-2 h-2 rounded-full transition-all ${i === index ? "bg-white scale-125 shadow-lg" : "bg-white/50 hover:bg-white/75"}`}
                aria-label={`Aller à l'image ${i + 1}`}
              />
            ))}
          </div>

          {/* Compteur */}
          <div className="absolute top-4 right-4 bg-black/70 text-white px-3 py-1.5 rounded-full text-xs font-semibold shadow-lg">
            {index + 1} / {total}
          </div>
        </>
      )}
    </div>
  );
});

PostMedia.displayName = "PostMedia";
export default PostMedia;