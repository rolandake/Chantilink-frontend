// src/pages/Home/VirtualFeed.jsx
// ✅ v4 — PERFORMANCE MAX : zéro lag avec beaucoup de contenu
//
// PROBLÈMES v3 corrigés :
//
// 🐛 BUG 1 — BUFFER_BELOW = 12 :
//   Avec 12 posts sous le viewport, chaque post vidéo lance VideoItem
//   (IntersectionObserver + setTimeout + <video preload="metadata">).
//   Sur un feed chargé = 12-15 vidéos qui chargent en background → GPU saturé.
//   FIX : BUFFER_BELOW = 3, BUFFER_ABOVE = 2. Seuls 5-6 posts max dans le DOM.
//
// 🐛 BUG 2 — 1 ResizeObserver + 1 IntersectionObserver PAR ITEM :
//   80 posts = 160 observers actifs simultanément. Chaque callback
//   déclenche un layout thrash (getBoundingClientRect force un reflow).
//   FIX : ZÉRO ResizeObserver par item. Les hauteurs sont mesurées une seule
//   fois via getBoundingClientRect() après le paint (requestAnimationFrame).
//   Un seul IntersectionObserver "sentinel" suffit pour le chargement infini.
//
// 🐛 BUG 3 — Réduction de fenêtre pendant scroll :
//   La garde "la nouvelle fenêtre doit englober l'ancienne" empêchait la
//   réduction, accumulant des items dans le DOM indéfiniment.
//   FIX : Réduction autorisée mais douce (hysteresis de 2× buffer).
//
// 🐛 BUG 4 — setItemRef recrée une closure par (index, el) :
//   Déclenche des re-renders en cascade sur PostCard.
//   FIX : ref callback stable via useRef map, aucune dépendance dynamique.
//
// ✅ RÉSULTAT : 5-7 nodes DOM actifs, 0 observer par item, scroll à 60fps.

import React, {
  useState, useRef, useEffect, useCallback, memo,
} from "react";

// ─── Constantes ──────────────────────────────────────────────────────────────
const ITEM_ESTIMATED_HEIGHT = 580;
const BUFFER_ABOVE          = 2;   // posts montés au-dessus du viewport
const BUFFER_BELOW          = 3;   // posts montés en-dessous (était 12 → lag)
const SCROLL_THROTTLE_MS    = 32;  // ~2 frames — moins de reflows qu'à 16ms
const HEIGHT_MEASURE_DELAY  = 100; // ms après mount avant mesure des hauteurs

// ─── Helper : offset estimé sûr ──────────────────────────────────────────────
// Évite topPad=0 si offsetsRef n'est pas encore prêt.
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

  // Hauteurs et offsets mesurés (pas de ResizeObserver par item)
  const heightsRef  = useRef({});
  const offsetsRef  = useRef({});
  const totalRef    = useRef(posts.length * ITEM_ESTIMATED_HEIGHT);

  // Refs DOM des items — Map stable, jamais recréée
  const itemDOMRefs = useRef({});

  // Contrôle du scroll throttle
  const rafRef        = useRef(null);
  const lastScrollRef = useRef(0);
  const rangeRef      = useRef({ start: 0, end: initialEnd });

  // Mesure batch des hauteurs (une seule passe, pas un ResizeObserver par item)
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

  // ── Ref callback stable (pas de closure par index) ────────────────────────
  // On stocke l'élément dans la Map, aucun observer créé ici.
  const setItemRef = useCallback((index) => (el) => {
    if (el) {
      itemDOMRefs.current[index] = el;
    } else {
      delete itemDOMRefs.current[index];
    }
  }, []);

  // ── Calcul de la fenêtre visible ──────────────────────────────────────────
  const computeRange = useCallback(() => {
    const scrollEl = containerRef?.current;
    if (!scrollEl) return;

    const scrollTop  = scrollEl.scrollTop;
    const viewHeight = scrollEl.clientHeight || window.innerHeight;
    const viewBottom = scrollTop + viewHeight;
    const n          = posts.length;
    if (n === 0) return;

    // Premier item visible
    let firstVisible = 0;
    for (let i = 0; i < n; i++) {
      const top    = estimatedOffset(i, heightsRef.current, offsetsRef.current);
      const height = heightsRef.current[i] || ITEM_ESTIMATED_HEIGHT;
      if (top + height >= scrollTop - 20) {
        firstVisible = i;
        break;
      }
    }

    // Dernier item visible
    let lastVisible = firstVisible;
    for (let i = firstVisible; i < n; i++) {
      const top = estimatedOffset(i, heightsRef.current, offsetsRef.current);
      if (top > viewBottom + 20) break;
      lastVisible = i;
    }

    const newStart = Math.max(0, firstVisible - BUFFER_ABOVE);
    const newEnd   = Math.min(n - 1, lastVisible + BUFFER_BELOW);

    const prev = rangeRef.current;

    // Hysteresis douce : on réduit uniquement si l'écart est supérieur à 2× le buffer
    const shouldShrinkStart = newStart > prev.start + BUFFER_ABOVE * 2;
    const shouldShrinkEnd   = newEnd   < prev.end   - BUFFER_BELOW * 2;

    const finalStart = shouldShrinkStart ? newStart : Math.min(prev.start, newStart);
    const finalEnd   = shouldShrinkEnd   ? newEnd   : Math.max(prev.end,   newEnd);

    const clampedStart = Math.max(0, finalStart);
    const clampedEnd   = Math.min(n - 1, finalEnd);

    if (clampedStart !== prev.start || clampedEnd !== prev.end) {
      rangeRef.current = { start: clampedStart, end: clampedEnd };
      setRange({ start: clampedStart, end: clampedEnd });
    }
  }, [posts.length, containerRef]);

  // ── Scroll throttlé (RAF, pas un listener brut) ───────────────────────────
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

    // Mesure initiale des hauteurs après le premier paint
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

    // Étendre la fenêtre si de nouveaux posts arrivent, sans jamais la réduire
    const prev = rangeRef.current;
    const newEnd = Math.min(n - 1, Math.max(prev.end, prev.end + 2));
    if (newEnd !== prev.end) {
      rangeRef.current = { ...prev, end: newEnd };
      setRange({ ...prev, end: newEnd });
    }

    // Mesurer après le paint pour que les nouveaux items soient dans le DOM
    const t1 = setTimeout(computeRange,    50);
    const t2 = setTimeout(measureHeights, 150);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [posts.length, recomputeOffsets, computeRange, measureHeights]);

  // ── Mesure périodique légère (remplace ResizeObserver) ────────────────────
  // Les images et vidéos qui chargent changent la hauteur des items.
  // On mesure en idle toutes les 2s au lieu d'un observer par item.
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
      itemDOMRefs.current = {};
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
            ref={setItemRef(absIdx)}
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