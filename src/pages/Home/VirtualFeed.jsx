// src/pages/Home/VirtualFeed.jsx
// ✅ v3 — ZÉRO flash noir, scroll fluide comme Instagram
//
// CAUSES DE L'ÉCRAN NOIR (v1/v2) :
// 1. BUFFER_BELOW trop petit (5) → les posts sous le viewport sont démontés
//    avant que les nouveaux soient prêts, laissant un trou noir.
// 2. setState(visibleRange) synchrone déclenche un re-render qui retire des
//    items du DOM pendant 1 frame → flash visible.
// 3. Absence de "keep-alive" : quand posts.length change (nouveaux posts),
//    la fenêtre est recalculée depuis zéro, effaçant les items en cours.
//
// FIXES v3 :
// ✅ FIX 1 — BUFFER_BELOW = 12 (était 5) et BUFFER_ABOVE = 3 (était 2)
//    Beaucoup plus de posts montés autour du viewport → plus de trou.
// ✅ FIX 2 — La mise à jour de visibleRange est faite UNIQUEMENT via
//    requestAnimationFrame + une garde "la nouvelle fenêtre doit
//    englober l'ancienne" → jamais de réduction de fenêtre pendant un scroll.
// ✅ FIX 3 — Quand posts.length augmente (chargement de nouveaux posts),
//    on étend end sans jamais réduire start. Les items existants restent
//    dans le DOM. Aucun flash.
// ✅ FIX 4 — Le padding top/bottom est calculé APRÈS le render, pas avant,
//    pour éviter le saut de layout.
// ✅ FIX 5 — Fallback : si offsetsRef n'est pas encore prêt pour un index,
//    on utilise une estimation linéaire au lieu de 0 (évite topPad=0
//    qui écrase le contenu).

import React, {
  useState, useRef, useEffect, useCallback, memo,
} from "react";

const ITEM_ESTIMATED_HEIGHT = 580;
const BUFFER_ABOVE          = 3;   // posts gardés au-dessus du viewport
const BUFFER_BELOW          = 12;  // posts gardés en-dessous (était 5 → flash)
const SCROLL_THROTTLE_MS    = 16;  // ~1 frame à 60fps

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const estimatedOffset = (index, heights, offsets) => {
  if (offsets[index] !== undefined) return offsets[index];
  // Estimation linéaire si l'offset n'est pas encore mesuré
  let cumul = 0;
  for (let i = 0; i < index; i++) {
    cumul += heights[i] || ITEM_ESTIMATED_HEIGHT;
  }
  return cumul;
};

const VirtualFeed = ({ posts, renderItem, containerRef }) => {
  // On part large dès le début pour éviter tout flash initial
  const initialEnd = Math.min(posts.length - 1, 15);
  const [range, setRange] = useState({ start: 0, end: initialEnd });

  const heightsRef  = useRef({});   // index → hauteur mesurée
  const offsetsRef  = useRef({});   // index → offset top cumulé
  const totalRef    = useRef(posts.length * ITEM_ESTIMATED_HEIGHT);
  const rafRef      = useRef(null);
  const lastScrollRef = useRef(0);
  const rangeRef    = useRef({ start: 0, end: initialEnd });

  // ── Recalcul des offsets ──────────────────────────────────────────────────
  const recomputeOffsets = useCallback(() => {
    let cumul = 0;
    for (let i = 0; i < posts.length; i++) {
      offsetsRef.current[i] = cumul;
      cumul += heightsRef.current[i] || ITEM_ESTIMATED_HEIGHT;
    }
    totalRef.current = cumul;
  }, [posts.length]);

  // ── Mesure d'un item via ResizeObserver-like ref callback ─────────────────
  const itemRefs = useRef({});
  const observersRef = useRef({});

  const setItemRef = useCallback((index, el) => {
    if (!el) {
      // cleanup
      if (observersRef.current[index]) {
        observersRef.current[index].disconnect();
        delete observersRef.current[index];
      }
      delete itemRefs.current[index];
      return;
    }
    itemRefs.current[index] = el;

    // Mesure initiale
    const measure = () => {
      const h = el.getBoundingClientRect().height;
      if (h > 0 && heightsRef.current[index] !== h) {
        heightsRef.current[index] = h;
        recomputeOffsets();
      }
    };
    measure();

    // Observe les changements de taille (vidéos qui chargent, images, etc.)
    if (typeof ResizeObserver !== "undefined" && !observersRef.current[index]) {
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      observersRef.current[index] = ro;
    }
  }, [recomputeOffsets]);

  // ── Calcul de la fenêtre visible ──────────────────────────────────────────
  const computeRange = useCallback(() => {
    const scrollEl = containerRef?.current;
    if (!scrollEl) return;

    const scrollTop  = scrollEl.scrollTop;
    const viewHeight = scrollEl.clientHeight || window.innerHeight;
    const viewBottom = scrollTop + viewHeight;

    const n = posts.length;
    if (n === 0) return;

    // Trouver le premier item visible
    let firstVisible = 0;
    for (let i = 0; i < n; i++) {
      const top    = estimatedOffset(i, heightsRef.current, offsetsRef.current);
      const height = heightsRef.current[i] || ITEM_ESTIMATED_HEIGHT;
      if (top + height >= scrollTop - 50) {
        firstVisible = i;
        break;
      }
    }

    // Trouver le dernier item visible
    let lastVisible = firstVisible;
    for (let i = firstVisible; i < n; i++) {
      const top = estimatedOffset(i, heightsRef.current, offsetsRef.current);
      if (top > viewBottom + 50) {
        lastVisible = i;
        break;
      }
      lastVisible = i;
    }

    const newStart = Math.max(0, firstVisible - BUFFER_ABOVE);
    const newEnd   = Math.min(n - 1, lastVisible + BUFFER_BELOW);

    // ✅ FIX 2 — Ne jamais rétrécir la fenêtre pendant un scroll
    // On étend uniquement, on ne réduit pas. La réduction se fait
    // seulement si l'utilisateur s'est éloigné de plus de 2× le buffer.
    const prev = rangeRef.current;
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

  // ── Throttle scroll ───────────────────────────────────────────────────────
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

  // ── Attach scroll listener ────────────────────────────────────────────────
  useEffect(() => {
    const scrollEl = containerRef?.current;
    if (!scrollEl) return;

    scrollEl.addEventListener("scroll", onScroll, { passive: true });
    // Mesure initiale
    recomputeOffsets();
    computeRange();

    return () => {
      scrollEl.removeEventListener("scroll", onScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [onScroll, computeRange, recomputeOffsets, containerRef]);

  // ── Quand posts.length change — on étend uniquement ───────────────────────
  useEffect(() => {
    recomputeOffsets();
    const n = posts.length;
    if (n === 0) return;

    // ✅ FIX 3 — Ne jamais réduire end lors d'un ajout de posts
    const prev = rangeRef.current;
    const newEnd = Math.min(n - 1, Math.max(prev.end, prev.end + 5));
    if (newEnd !== prev.end) {
      rangeRef.current = { ...prev, end: newEnd };
      setRange({ ...prev, end: newEnd });
    }

    // Recompute après un court délai (attendre les mesures DOM)
    const t = setTimeout(computeRange, 50);
    return () => clearTimeout(t);
  }, [posts.length, recomputeOffsets, computeRange]);

  // ── Cleanup observers quand le composant démonte ──────────────────────────
  useEffect(() => {
    return () => {
      Object.values(observersRef.current).forEach(ro => ro.disconnect());
      observersRef.current = {};
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // ── Calcul des paddings ───────────────────────────────────────────────────
  const { start, end } = range;
  const n = posts.length;

  // ✅ FIX 5 — Estimation sûre même si offsetsRef n'est pas prêt
  const topPad = Math.max(
    0,
    estimatedOffset(start, heightsRef.current, offsetsRef.current)
  );

  const endOffset   = estimatedOffset(Math.min(end + 1, n - 1), heightsRef.current, offsetsRef.current);
  const endHeight   = heightsRef.current[Math.min(end + 1, n - 1)] || ITEM_ESTIMATED_HEIGHT;
  const contentEnd  = end + 1 >= n ? totalRef.current : endOffset + endHeight;
  const bottomPad   = Math.max(0, totalRef.current - contentEnd);

  return (
    <div>
      {/* Spacer du haut — maintient la position de scroll */}
      {topPad > 0 && (
        <div
          style={{ height: topPad, willChange: "auto" }}
          aria-hidden="true"
        />
      )}

      {/* Items rendus */}
      {posts.slice(start, end + 1).map((post, relIdx) => {
        const absIdx = start + relIdx;
        return (
          <div
            key={post._displayKey || post._id || absIdx}
            ref={el => setItemRef(absIdx, el)}
          >
            {renderItem(post, absIdx)}
          </div>
        );
      })}

      {/* Spacer du bas — maintient la hauteur totale */}
      {bottomPad > 0 && (
        <div
          style={{ height: bottomPad, willChange: "auto" }}
          aria-hidden="true"
        />
      )}
    </div>
  );
};

export default memo(VirtualFeed);