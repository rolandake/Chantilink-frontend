// 📁 src/pages/Home/MediaLightbox.jsx
// ✅ Lightbox plein écran — Instagram/Facebook style
//
// Fonctionnalités :
//   - Image : zoom pinch (mobile) + molette (desktop) + double-tap zoom
//   - Vidéo : lecture plein écran avec contrôles natifs
//   - Navigation multi-médias (flèches + swipe)
//   - Fermeture : clic fond, bouton X, touche Escape
//   - Animation d'ouverture/fermeture spring
//   - Préserve le ratio original
//   - Barre de miniatures en bas si plusieurs médias

import React, {
  useState, useEffect, useRef, useCallback, memo
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { XMarkIcon, ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";

const isVideoUrl = (u) => u && /\.(mp4|webm|mov|avi)$/i.test((u || "").split("?")[0]);

// ─────────────────────────────────────────────────────────────────────────────
// LIGHTBOX IMAGE
// ─────────────────────────────────────────────────────────────────────────────
const LightboxImage = memo(({ url }) => {
  const [loaded, setLoaded] = useState(false);
  const [scale,  setScale]  = useState(1);
  const [pos,    setPos]    = useState({ x: 0, y: 0 });
  const isDragging   = useRef(false);
  const lastPos      = useRef({ x: 0, y: 0 });
  const lastTap      = useRef(0);
  const pinchRef     = useRef(null);
  const imgRef       = useRef(null);

  const reset = useCallback(() => {
    setScale(1);
    setPos({ x: 0, y: 0 });
  }, []);

  // Double-tap zoom (mobile)
  const handleTouchEnd = useCallback((e) => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      e.preventDefault();
      setScale(s => {
        if (s > 1) { setPos({ x: 0, y: 0 }); return 1; }
        return 2.5;
      });
    }
    lastTap.current = now;
  }, []);

  // Pinch zoom
  const handleTouchMove = useCallback((e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      if (pinchRef.current !== null) {
        const delta = dist / pinchRef.current;
        setScale(s => Math.min(Math.max(s * delta, 1), 5));
      }
      pinchRef.current = dist;
    } else if (e.touches.length === 1 && scale > 1) {
      e.preventDefault();
      const touch = e.touches[0];
      setPos(p => ({
        x: p.x + touch.clientX - lastPos.current.x,
        y: p.y + touch.clientY - lastPos.current.y,
      }));
      lastPos.current = { x: touch.clientX, y: touch.clientY };
    }
  }, [scale]);

  const handleTouchStart = useCallback((e) => {
    if (e.touches.length === 1) {
      lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    if (e.touches.length === 2) pinchRef.current = null;
  }, []);

  const handleTouchEndPinch = useCallback(() => {
    pinchRef.current = null;
  }, []);

  // Scroll wheel zoom (desktop)
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale(s => {
      const next = Math.min(Math.max(s * delta, 1), 5);
      if (next === 1) setPos({ x: 0, y: 0 });
      return next;
    });
  }, []);

  // Drag (desktop, quand zoomé)
  const handleMouseDown = useCallback((e) => {
    if (scale <= 1) return;
    isDragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
  }, [scale]);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging.current) return;
    setPos(p => ({
      x: p.x + e.clientX - lastPos.current.x,
      y: p.y + e.clientY - lastPos.current.y,
    }));
    lastPos.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseUp = useCallback(() => { isDragging.current = false; }, []);

  // Double-clic zoom (desktop)
  const handleDoubleClick = useCallback(() => {
    setScale(s => {
      if (s > 1) { setPos({ x: 0, y: 0 }); return 1; }
      return 2.5;
    });
  }, []);

  return (
    <div
      style={{
        position: "absolute", inset: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        overflow: "hidden",
        cursor: scale > 1 ? "grab" : "zoom-in",
      }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onDoubleClick={handleDoubleClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={(e) => { handleTouchEnd(e); handleTouchEndPinch(); }}
    >
      {!loaded && (
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: "50%",
            border: "3px solid rgba(255,255,255,0.2)",
            borderTopColor: "white",
            animation: "lbSpin 0.7s linear infinite",
          }} />
          <style>{`@keyframes lbSpin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}
      <img
        ref={imgRef}
        src={url}
        alt=""
        draggable="false"
        onLoad={() => setLoaded(true)}
        style={{
          maxWidth: "100%", maxHeight: "100%",
          objectFit: "contain",
          transform: `scale(${scale}) translate(${pos.x / scale}px, ${pos.y / scale}px)`,
          transition: isDragging.current ? "none" : "transform 0.15s ease",
          userSelect: "none",
          opacity: loaded ? 1 : 0,
        }}
      />
      {scale > 1 && (
        <button
          onClick={reset}
          style={{
            position: "absolute", top: 12, left: 12, zIndex: 10,
            background: "rgba(0,0,0,0.6)", color: "white",
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: 9999, padding: "4px 10px",
            fontSize: 11, fontWeight: 600, cursor: "pointer",
          }}
        >
          Réinitialiser
        </button>
      )}
    </div>
  );
});
LightboxImage.displayName = "LightboxImage";

// ─────────────────────────────────────────────────────────────────────────────
// LIGHTBOX VIDEO
// ─────────────────────────────────────────────────────────────────────────────
const LightboxVideo = memo(({ url }) => (
  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#000" }}>
    <video
      src={url}
      controls
      autoPlay
      playsInline
      style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
    />
  </div>
));
LightboxVideo.displayName = "LightboxVideo";

// ─────────────────────────────────────────────────────────────────────────────
// LIGHTBOX PRINCIPALE
// ─────────────────────────────────────────────────────────────────────────────
const MediaLightbox = memo(({ urls, initialIndex = 0, onClose }) => {
  const [index, setIndex] = useState(initialIndex);
  const startXRef = useRef(null);

  const url    = urls[index];
  const isVid  = isVideoUrl(url);
  const total  = urls.length;

  const prev = useCallback((e) => {
    e?.stopPropagation();
    setIndex(i => (i - 1 + total) % total);
  }, [total]);

  const next = useCallback((e) => {
    e?.stopPropagation();
    setIndex(i => (i + 1) % total);
  }, [total]);

  // Keyboard
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape")      onClose();
      if (e.key === "ArrowLeft")   setIndex(i => (i - 1 + total) % total);
      if (e.key === "ArrowRight")  setIndex(i => (i + 1) % total);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, total]);

  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Swipe horizontal
  const handleTouchStartSwipe = useCallback((e) => {
    startXRef.current = e.touches[0].clientX;
  }, []);

  const handleTouchEndSwipe = useCallback((e) => {
    if (startXRef.current === null) return;
    const dx = e.changedTouches[0].clientX - startXRef.current;
    startXRef.current = null;
    if (Math.abs(dx) < 50) return;
    if (dx < 0) setIndex(i => (i + 1) % total);
    else        setIndex(i => (i - 1 + total) % total);
  }, [total]);

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.95)",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
      }}
      onClick={onClose}
      onTouchStart={handleTouchStartSwipe}
      onTouchEnd={handleTouchEndSwipe}
    >
      {/* Bouton fermer */}
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        style={{
          position: "absolute", top: 16, right: 16, zIndex: 10,
          width: 40, height: 40, borderRadius: "50%",
          background: "rgba(0,0,0,0.6)",
          border: "1px solid rgba(255,255,255,0.2)",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", color: "white",
        }}
      >
        <XMarkIcon style={{ width: 22, height: 22 }} />
      </button>

      {/* Compteur */}
      {total > 1 && (
        <div style={{
          position: "absolute", top: 20, left: "50%", transform: "translateX(-50%)",
          color: "white", fontSize: 13, fontWeight: 600,
          background: "rgba(0,0,0,0.5)", padding: "4px 12px", borderRadius: 9999,
          zIndex: 10,
        }}>
          {index + 1} / {total}
        </div>
      )}

      {/* Zone média */}
      <motion.div
        key={index}
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ type: "spring", damping: 28, stiffness: 300 }}
        style={{
          position: "relative",
          width: "100vw",
          height: total > 1 ? "calc(100vh - 90px)" : "100vh",
        }}
        onClick={e => e.stopPropagation()}
      >
        {isVid
          ? <LightboxVideo url={url} />
          : <LightboxImage url={url} />
        }
      </motion.div>

      {/* Flèches navigation */}
      {total > 1 && (
        <>
          <button
            onClick={prev}
            style={{
              position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
              zIndex: 10, width: 40, height: 40, borderRadius: "50%",
              background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: "white",
            }}
          >
            <ChevronLeftIcon style={{ width: 22, height: 22 }} />
          </button>
          <button
            onClick={next}
            style={{
              position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
              zIndex: 10, width: 40, height: 40, borderRadius: "50%",
              background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: "white",
            }}
          >
            <ChevronRightIcon style={{ width: 22, height: 22 }} />
          </button>

          {/* Miniatures */}
          <div style={{
            position: "absolute", bottom: 12,
            display: "flex", gap: 6, zIndex: 10,
            maxWidth: "90vw", overflowX: "auto",
            padding: "4px 8px",
          }}>
            {urls.map((u, i) => (
              <button
                key={i}
                onClick={e => { e.stopPropagation(); setIndex(i); }}
                style={{
                  width: 48, height: 48, borderRadius: 6, overflow: "hidden",
                  flexShrink: 0, padding: 0, border: "none",
                  outline: i === index ? "2px solid white" : "2px solid transparent",
                  cursor: "pointer", opacity: i === index ? 1 : 0.5,
                  transition: "all 0.15s",
                }}
              >
                {isVideoUrl(u)
                  ? <div style={{ width: "100%", height: "100%", background: "#222", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg viewBox="0 0 24 24" style={{ width: 18, height: 18 }} fill="white"><path d="M8 5v14l11-7z"/></svg>
                    </div>
                  : <img src={u} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" />
                }
              </button>
            ))}
          </div>
        </>
      )}
    </motion.div>,
    document.body
  );
});
MediaLightbox.displayName = "MediaLightbox";

export default MediaLightbox;