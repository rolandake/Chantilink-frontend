// src/pages/Home/VirtualFeed.jsx
// ✅ v6 — CORRECTIONS PERF MOBILE
//
// CHANGEMENTS v6 vs v5 :
//
// 🐛 BUG 1 — BUFFER_BELOW trop petit (3) → re-mounts constants au scroll :
//   Avec BUFFER_BELOW=3, dès que l'utilisateur scrolle de quelques posts,
//   les items en bas de la fenêtre virtuelle sont unmountés/remountés.
//   Sur mobile lent, chaque remount = recalcul layout + re-render complet PostCard.
//   FIX : BUFFER_BELOW=6, BUFFER_ABOVE=3.
//
// 🐛 BUG 2 — Hysteresis réductrice vers le haut cause des re-mounts en remontant :
//   shouldShrinkStart recalculait la fenêtre haute à chaque scroll vers le haut,
//   causant des unmount/remount des items déjà vus.
//   FIX : shouldShrinkStart = false (on ne réduit jamais la borne haute).
//         shouldShrinkEnd avec multiplicateur x3 (moins agressif).
//
// 🐛 BUG 3 — SCROLL_THROTTLE_MS trop faible sur mobile lent :
//   32ms (2 frames) est insuffisant sur les téléphones < 4 cœurs.
//   FIX : adaptatif selon hardwareConcurrency (48ms sur mobile faible).
//
// ✅ Toutes les optimisations v5 conservées :
//   - refCallbacks (Map stable) — 0 re-création de closure par render
//   - 0 ResizeObserver par item
//   - 1 seul IntersectionObserver sentinel
//   - Mesure périodique idle (2s)

import React, {
  useState, useRef, useEffect, useCallback, memo,
} from "react";

// ─── Constantes ──────────────────────────────────────────────────────────────
const ITEM_ESTIMATED_HEIGHT = 580;
const BUFFER_ABOVE          = 3;   // était 2
const BUFFER_BELOW          = 6;   // était 3 → trop agressif sur mobile
const HEIGHT_MEASURE_DELAY  = 100;

// ✅ Throttle adaptatif : 48ms sur mobile faible, 32ms sinon
const SCROLL_THROTTLE_MS = typeof navigator !== "undefined" &&
  (navigator.hardwareConcurrency || 4) <= 2 ? 48 : 32;

// ─── Helper : offset estimé sûr ──────────────────────────────────────────────
const estimatedOffset = (index, heights, offsets) => {
  if (offsets[index] !== undefined) return offsets[index];
  let cumul = 0;
  for (let i = 0; i < index; i++) {
    cumul += heights[i] || ITEM_ESTIMATED_HEIGHT;
  }
  return cumul;
};

// ─────────────────────────────────────────────────────────────────────────────
// VirtualFeed
// ─────────────────────────────────────────────────────────────────────────────
const VirtualFeed = ({ posts, renderItem, containerRef }) => {
  const initialEnd = Math.min(posts.length - 1, BUFFER_BELOW + 2);
  const [range, setRange] = useState({ start: 0, end: initialEnd });

  const heightsRef = useRef({});
  const offsetsRef = useRef({});
  const totalRef   = useRef(posts.length * ITEM_ESTIMATED_HEIGHT);

  // ✅ Map stable de closures ref (v5) — jamais recréée
  const itemDOMRefs  = useRef({});
  const refCallbacks = useRef({});

  const rafRef        = useRef(null);
  const lastScrollRef = useRef(0);
  const rangeRef      = useRef({ start: 0, end: initialEnd });

  // ── Ref callback stable ───────────────────────────────────────────────────
  const getItemRef = useCallback((index) => {
    if (!refCallbacks.current[index]) {
      refCallbacks.current[index] = (el) => {
        if (el) {
          itemDOMRefs.current[index] = el;
        } else {
          delete itemDOMRefs.current[index];
          delete refCallbacks.current[index];
        }
      };
    }
    return refCallbacks.current[index];
  }, []);

  // ── Mesure batch des hauteurs ─────────────────────────────────────────────
  const measureHeights = useCallback(() => {
    let changed = false;
    const refs = itemDOMRefs.current;
    Object.keys(refs).forEach(key => {
      const el  = refs[key];
      const idx = Number(key);
      if (!el) return;
      const h = el.getBoundingClientRect().height;
      if (h > 0 && heightsRef.current[idx] !== h) {
        heightsRef.current[idx] = h;
        changed = true;
      }
    });
    if (changed) recomputeOffsets();
  }, []); // eslint-disable-line

  const recomputeOffsets = useCallback(() => {
    let cumul = 0;
    for (let i = 0; i < posts.length; i++) {
      offsetsRef.current[i] = cumul;
      cumul += heightsRef.current[i] || ITEM_ESTIMATED_HEIGHT;
    }
    totalRef.current = cumul;
  }, [posts.length]);

  // ── Calcul de la fenêtre visible ──────────────────────────────────────────
  const computeRange = useCallback(() => {
    const scrollEl = containerRef?.current;
    if (!scrollEl) return;

    const scrollTop  = scrollEl.scrollTop;
    const viewHeight = scrollEl.clientHeight || window.innerHeight;
    const viewBottom = scrollTop + viewHeight;
    const n          = posts.length;
    if (n === 0) return;

    let firstVisible = 0;
    for (let i = 0; i < n; i++) {
      const top    = estimatedOffset(i, heightsRef.current, offsetsRef.current);
      const height = heightsRef.current[i] || ITEM_ESTIMATED_HEIGHT;
      if (top + height >= scrollTop - 20) {
        firstVisible = i;
        break;
      }
    }

    let lastVisible = firstVisible;
    for (let i = firstVisible; i < n; i++) {
      const top = estimatedOffset(i, heightsRef.current, offsetsRef.current);
      if (top > viewBottom + 20) break;
      lastVisible = i;
    }

    const newStart = Math.max(0, firstVisible - BUFFER_ABOVE);
    const newEnd   = Math.min(n - 1, lastVisible + BUFFER_BELOW);

    const prev = rangeRef.current;

    // ✅ FIX v6 — Hysteresis corrigée :
    // On ne réduit JAMAIS la borne haute (évite les re-mounts en remontant).
    // On ne réduit la borne basse que si l'écart est > 3× le buffer (moins agressif).
    const shouldShrinkStart = false;
    const shouldShrinkEnd   = newEnd < prev.end - BUFFER_BELOW * 3;

    const finalStart = shouldShrinkStart ? newStart : Math.min(prev.start, newStart);
    const finalEnd   = shouldShrinkEnd   ? newEnd   : Math.max(prev.end,   newEnd);

    const clampedStart = Math.max(0, finalStart);
    const clampedEnd   = Math.min(n - 1, finalEnd);

    if (clampedStart !== prev.start || clampedEnd !== prev.end) {
      rangeRef.current = { start: clampedStart, end: clampedEnd };
      setRange({ start: clampedStart, end: clampedEnd });
    }
  }, [posts.length, containerRef]);

  // ── Scroll throttlé (RAF) ─────────────────────────────────────────────────
  const onScroll = useCallback(() => {
    const now = Date.now();
    if (now - lastScrollRef.current < SCROLL_THROTTLE_MS) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(computeRange);
      return;
    }
    lastScrollRef.current = now;
    computeRange();
  }, [computeRange]);

  // ── Attacher le listener de scroll ───────────────────────────────────────
  useEffect(() => {
    const scrollEl = containerRef?.current;
    if (!scrollEl) return;

    scrollEl.addEventListener("scroll", onScroll, { passive: true });
    recomputeOffsets();
    computeRange();

    const t = setTimeout(measureHeights, HEIGHT_MEASURE_DELAY);

    return () => {
      scrollEl.removeEventListener("scroll", onScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      clearTimeout(t);
    };
  }, [onScroll, computeRange, recomputeOffsets, measureHeights, containerRef]);

  // ── Réagir aux changements de posts.length ────────────────────────────────
  useEffect(() => {
    recomputeOffsets();
    const n = posts.length;
    if (n === 0) return;

    const prev   = rangeRef.current;
    const newEnd = Math.min(n - 1, Math.max(prev.end, prev.end + 2));
    if (newEnd !== prev.end) {
      rangeRef.current = { ...prev, end: newEnd };
      setRange({ ...prev, end: newEnd });
    }

    const t1 = setTimeout(computeRange,    50);
    const t2 = setTimeout(measureHeights, 150);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [posts.length, recomputeOffsets, computeRange, measureHeights]);

  // ── Mesure périodique légère en idle ──────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      if (typeof requestIdleCallback !== "undefined") {
        requestIdleCallback(measureHeights, { timeout: 1000 });
      } else {
        setTimeout(measureHeights, 0);
      }
    }, 2000);
    return () => clearInterval(id);
  }, [measureHeights]);

  // ── Cleanup ───────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      itemDOMRefs.current  = {};
      refCallbacks.current = {};
    };
  }, []);

  // ── Calcul des paddings ───────────────────────────────────────────────────
  const { start, end } = range;
  const n = posts.length;

  const topPad = Math.max(
    0,
    estimatedOffset(start, heightsRef.current, offsetsRef.current)
  );

  const endOffset  = estimatedOffset(Math.min(end + 1, n - 1), heightsRef.current, offsetsRef.current);
  const endHeight  = heightsRef.current[Math.min(end + 1, n - 1)] || ITEM_ESTIMATED_HEIGHT;
  const contentEnd = end + 1 >= n ? totalRef.current : endOffset + endHeight;
  const bottomPad  = Math.max(0, totalRef.current - contentEnd);

  return (
    <div>
      {topPad > 0 && (
        <div style={{ height: topPad }} aria-hidden="true" />
      )}

      {posts.slice(start, end + 1).map((post, relIdx) => {
        const absIdx = start + relIdx;
        return (
          <div
            key={post._displayKey || post._id || absIdx}
            ref={getItemRef(absIdx)}
          >
            {renderItem(post, absIdx)}
          </div>
        );
      })}

      {bottomPad > 0 && (
        <div style={{ height: bottomPad }} aria-hidden="true" />
      )}
    </div>
  );
};

export default memo(VirtualFeed);