// 📁 src/pages/Home/MediaLightbox.jsx
// ✅ PATCH v26 — CORRECTION PASSIVE WHEEL EVENT

// ─────────────────────────────────────────────────────────────────────────────
// EXEMPLE COMPLET — MediaLightbox minimal avec le patch appliqué
// ─────────────────────────────────────────────────────────────────────────────

import React, {
  useState, useRef, useEffect, useCallback, memo,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { XMarkIcon, ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";

const MediaLightbox = memo(({ urls = [], initialIndex = 0, onClose }) => {
  const [index,  setIndex]  = useState(initialIndex);
  const [zoom,   setZoom]   = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  // ✅ Ref sur la div principale (remplace l'attribut onWheel)
  const containerRef = useRef(null);
  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);
  const touchDraggingRef = useRef(false);
  const [swipeOffset, setSwipeOffset] = useState(0);

  // ✅ FIX — addEventListener impératif avec { passive: false }
  // Permet e.preventDefault() sans warning Chrome/Firefox.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (e) => {
      // Empêcher le scroll de la page derrière le lightbox
      e.preventDefault();

      // Zoom au scroll molette
      const delta = e.deltaY < 0 ? 0.15 : -0.15;
      setZoom(z => Math.max(1, Math.min(5, z + delta)));
    };

    const handleTouchMove = (e) => {
      // Bloquer le scroll natif pendant le pinch-to-zoom
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };

    el.addEventListener("wheel",     handleWheel,     { passive: false });
    el.addEventListener("touchmove", handleTouchMove, { passive: false });

    return () => {
      el.removeEventListener("wheel",     handleWheel);
      el.removeEventListener("touchmove", handleTouchMove);
    };
  }, []); // une seule fois au mount

  const prev = useCallback(() => {
    setIndex(i => (i - 1 + urls.length) % urls.length);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setSwipeOffset(0);
  }, [urls.length]);

  const next = useCallback(() => {
    setIndex(i => (i + 1) % urls.length);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setSwipeOffset(0);
  }, [urls.length]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === "Escape")     onClose();
    if (e.key === "ArrowLeft")  prev();
    if (e.key === "ArrowRight") next();
  }, [onClose, prev, next]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // ✅ Swipe tactile pour défiler les médias
  const handleTouchStart = useCallback((e) => {
    if (e.touches.length !== 1 || zoom > 1) return;
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
    touchDraggingRef.current = true;
  }, [zoom]);

  const handleTouchMove = useCallback((e) => {
    if (!touchDraggingRef.current || e.touches.length !== 1 || zoom > 1) return;
    const dx = e.touches[0].clientX - touchStartXRef.current;
    const dy = e.touches[0].clientY - touchStartYRef.current;
    // Si le mouvement est plus horizontal que vertical, on swype
    if (Math.abs(dx) > Math.abs(dy)) {
      e.preventDefault();
      setSwipeOffset(dx);
    }
  }, [zoom]);

  const handleTouchEnd = useCallback(() => {
    if (!touchDraggingRef.current) return;
    touchDraggingRef.current = false;
    const threshold = 60;
    if (swipeOffset < -threshold) {
      next();
    } else if (swipeOffset > threshold) {
      prev();
    }
    setSwipeOffset(0);
  }, [swipeOffset, next, prev]);

  const currentUrl = urls[index] || "";
  const isVideo    = /\.(mp4|webm|mov)(\?|$)/i.test(currentUrl);

  return (
    <motion.div
      ref={containerRef}          // ← ref attachée ici, PAS de onWheel={} React
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.92)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        // Note : PAS de onWheel ici — géré par addEventListener en useEffect
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Bouton fermer */}
      <button
        onClick={onClose}
        style={{
          position: "absolute", top: 16, right: 16, zIndex: 10,
          width: 40, height: 40, borderRadius: "50%",
          background: "rgba(255,255,255,0.1)",
          border: "1px solid rgba(255,255,255,0.2)",
          color: "#fff", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
        aria-label="Fermer"
      >
        <XMarkIcon style={{ width: 20, height: 20 }} />
      </button>

      {/* Navigation gauche */}
      {urls.length > 1 && (
        <button
          onClick={prev}
          style={{
            position: "absolute", left: 16, zIndex: 10,
            width: 40, height: 40, borderRadius: "50%",
            background: "rgba(255,255,255,0.1)",
            border: "1px solid rgba(255,255,255,0.2)",
            color: "#fff", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
          aria-label="Précédent"
        >
          <ChevronLeftIcon style={{ width: 20, height: 20 }} />
        </button>
      )}

      {/* Média */}
      <div
        style={{
          transform: `scale(${zoom}) translate(${offset.x + (zoom === 1 ? swipeOffset : 0)}px, ${offset.y}px)`,
          transition: (zoom === 1 && swipeOffset === 0) ? "transform 0.25s ease" : "none",
          maxWidth: "90vw",
          maxHeight: "90vh",
          userSelect: "none",
        }}
      >
        {isVideo ? (
          <video
            src={currentUrl}
            controls
            autoPlay
            style={{ maxWidth: "90vw", maxHeight: "90vh", borderRadius: 8 }}
          />
        ) : (
          <img
            src={currentUrl}
            alt=""
            style={{
              maxWidth: "90vw", maxHeight: "90vh",
              objectFit: "contain", borderRadius: 8,
              cursor: zoom > 1 ? "grab" : "zoom-in",
            }}
            draggable={false}
          />
        )}
      </div>

      {/* Navigation droite */}
      {urls.length > 1 && (
        <button
          onClick={next}
          style={{
            position: "absolute", right: 16, zIndex: 10,
            width: 40, height: 40, borderRadius: "50%",
            background: "rgba(255,255,255,0.1)",
            border: "1px solid rgba(255,255,255,0.2)",
            color: "#fff", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
          aria-label="Suivant"
        >
          <ChevronRightIcon style={{ width: 20, height: 20 }} />
        </button>
      )}

      {/* Indicateur index */}
      {urls.length > 1 && (
        <div
          style={{
            position: "absolute", bottom: 20,
            display: "flex", gap: 6,
          }}
        >
          {urls.map((_, i) => (
            <div
              key={i}
              onClick={() => { setIndex(i); setZoom(1); setOffset({ x: 0, y: 0 }); }}
              style={{
                width: i === index ? 20 : 6,
                height: 6, borderRadius: 3,
                background: i === index ? "#fff" : "rgba(255,255,255,0.4)",
                cursor: "pointer",
                transition: "width 0.2s ease, background 0.2s ease",
              }}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
});

MediaLightbox.displayName = "MediaLightbox";
export default MediaLightbox;