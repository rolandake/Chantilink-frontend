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
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // ✅ Ref sur la div principale (remplace l'attribut onWheel)
  const containerRef = useRef(null);
  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);
  const touchDraggingRef = useRef(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const lastPinchDistRef = useRef(0);
  const isPannedThisDrag = useRef(false);
  const lastTapRef = useRef(0);

  // ✅ FIX — addEventListener impératif avec { passive: false }
  // Permet e.preventDefault() sans warning Chrome/Firefox.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (e) => {
      e.preventDefault();
      // Si Ctrl/Cmd + molette → zoom
      if (e.ctrlKey || e.metaKey) {
        const delta = e.deltaY < 0 ? 0.15 : -0.15;
        setZoom(z => Math.max(1, Math.min(5, z + delta)));
        if (zoom <= 1 && delta < 0) setOffset({ x: 0, y: 0 });
      }
    };

    el.addEventListener("wheel",     handleWheel,     { passive: false });

    return () => {
      el.removeEventListener("wheel",     handleWheel);
    };
  }, [zoom]);

  // Double-clic pour zoomer/dézoomer
  const handleDoubleClick = useCallback((e) => {
    if (isVideo) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (zoom > 1) {
      // Dézoomer
      setZoom(1);
      setOffset({ x: 0, y: 0 });
    } else {
      // Zoomer centré sur le clic
      setZoom(3);
      const clickX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      const clickY = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
      setOffset({ x: -clickX * 300, y: -clickY * 200 });
    }
  }, [zoom, isVideo]);

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

  // ✅ Swipe tactile pour défiler les médias + pinch-to-zoom + drag panoramique
  const handleTouchStart = useCallback((e) => {
    if (e.touches.length === 1) {
      // Simple touch → peut être swipe ou drag panoramique
      touchStartXRef.current = e.touches[0].clientX;
      touchStartYRef.current = e.touches[0].clientY;
      touchDraggingRef.current = true;
      isPannedThisDrag.current = false;
      setDragStart({ x: offset.x, y: offset.y });
    } else if (e.touches.length === 2) {
      // Pinch start
      touchDraggingRef.current = false;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastPinchDistRef.current = Math.sqrt(dx * dx + dy * dy);
    }
  }, [offset]);

  const handleTouchMove = useCallback((e) => {
    if (e.touches.length === 2) {
      // Pinch-to-zoom
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (lastPinchDistRef.current > 0) {
        const scale = dist / lastPinchDistRef.current;
        setZoom(z => Math.max(1, Math.min(5, z * scale)));
      }
      lastPinchDistRef.current = dist;
      return;
    }
    if (!touchDraggingRef.current || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - touchStartXRef.current;
    const dy = e.touches[0].clientY - touchStartYRef.current;

    if (zoom > 1) {
      // Drag panoramique quand zoomé
      isPannedThisDrag.current = true;
      e.preventDefault();
      setOffset({
        x: dragStart.x + dx,
        y: dragStart.y + dy,
      });
      return;
    }
    // Swipe horizontal pour navigation (seulement si pas zoomé)
    if (Math.abs(dx) > Math.abs(dy)) {
      e.preventDefault();
      setSwipeOffset(dx);
    }
  }, [zoom, dragStart]);

  const handleTouchEnd = useCallback(() => {
    if (!touchDraggingRef.current) return;
    touchDraggingRef.current = false;
    lastPinchDistRef.current = 0;

    if (zoom > 1) {
      // Ne pas naviguer si on a juste fait un panoramique
      return;
    }

    // Détection double-tap pour zoomer
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      // Double-tap
      if (zoom > 1) {
        setZoom(1);
        setOffset({ x: 0, y: 0 });
      } else {
        setZoom(3);
      }
      lastTapRef.current = 0;
      return;
    }
    lastTapRef.current = now;

    // Swipe navigation
    const threshold = 60;
    if (swipeOffset < -threshold) {
      next();
    } else if (swipeOffset > threshold) {
      prev();
    }
    setSwipeOffset(0);
  }, [swipeOffset, next, prev, zoom]);

  // ✅ Mouse drag pour panoramique quand zoomé
  const handleMouseDown = useCallback((e) => {
    if (zoom <= 1 || isVideo) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  }, [zoom, offset, isVideo]);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging || zoom <= 1) return;
    setOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  }, [isDragging, zoom, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

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
          cursor: zoom > 1 ? (isDragging ? "grabbing" : "grab") : "default",
        }}
        onDoubleClick={handleDoubleClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {isVideo ? (
          <video
            src={currentUrl}
            controls
            autoPlay
            style={{ maxWidth: "90vw", maxHeight: "90vh", borderRadius: 8, pointerEvents: "auto" }}
          />
        ) : (
          <img
            src={currentUrl}
            alt=""
            style={{
              maxWidth: "90vw", maxHeight: "90vh",
              objectFit: "contain", borderRadius: 8,
              pointerEvents: "none",
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