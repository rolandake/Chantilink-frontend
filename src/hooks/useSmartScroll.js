// 📁 src/hooks/useSmartScroll.js
// ✨ v2 — SCROLL INTELLIGENT avec vélocité + idle timer
//
// CHANGEMENTS vs v1 (useSmartScroll inline dans App.jsx) :
//   → Vélocité réelle (Δpx / Δms) au lieu d'un seuil fixe sur direction
//   → Deux états séparés : headerVisible / navbarVisible
//   → Navbar se cache légèrement après le header (délai 150ms)
//     pour un effet cascade plus naturel
//   → Idle timer 1500ms : si l'utilisateur ne scrolle plus, on réaffiche
//   → Zone top (< 80px) : toujours visible, sans délai
//   → Le hook s'abonne à l'event custom "app:scroll" émis par Home.jsx
//     ET au scroll natif window comme fallback
//   → RAF throttling pour éviter les reflows inutiles

import { useState, useEffect, useRef, useCallback } from "react";

const TOP_ZONE        = 80;      // px — toujours visible sous ce seuil
const HIDE_VELOCITY   = 2.5;     // px/ms — vélocité minimale pour cacher
const SHOW_VELOCITY   = 1.0;     // px/ms — vélocité minimale pour réafficher
const NAVBAR_DELAY    = 150;     // ms — la navbar se cache après le header
const IDLE_TIMEOUT    = 1500;    // ms — réaffiche tout si l'utilisateur s'arrête
const RAF_THROTTLE    = 16;      // ms — ~60fps

export function useSmartScroll() {
  const [headerVisible,  setHeaderVisible]  = useState(true);
  const [navbarVisible,  setNavbarVisible]  = useState(true);

  const lastScrollY     = useRef(0);
  const lastScrollTime  = useRef(Date.now());
  const headerVisRef    = useRef(true);
  const navbarVisRef    = useRef(true);
  const rafRef          = useRef(null);
  const idleTimerRef    = useRef(null);
  const navbarTimerRef  = useRef(null);
  const lastRafTime     = useRef(0);

  const setHeader = useCallback((visible) => {
    if (headerVisRef.current === visible) return;
    headerVisRef.current = visible;
    setHeaderVisible(visible);
  }, []);

  const setNavbar = useCallback((visible) => {
    if (navbarVisRef.current === visible) return;
    navbarVisRef.current = visible;
    setNavbarVisible(visible);
  }, []);

  // Réaffiche tout quand l'utilisateur est immobile
  const resetIdleTimer = useCallback(() => {
    clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      setHeader(true);
      setNavbar(true);
    }, IDLE_TIMEOUT);
  }, [setHeader, setNavbar]);

  const processScroll = useCallback((currentY) => {
    const now      = Date.now();
    const deltaY   = currentY - lastScrollY.current;
    const deltaT   = Math.max(now - lastScrollTime.current, 1); // éviter /0
    const velocity = Math.abs(deltaY) / deltaT; // px/ms

    lastScrollY.current   = currentY;
    lastScrollTime.current = now;

    resetIdleTimer();

    // Zone top → toujours visible
    if (currentY < TOP_ZONE) {
      setHeader(true);
      setNavbar(true);
      return;
    }

    const scrollingDown = deltaY > 0;
    const scrollingUp   = deltaY < 0;

    if (scrollingDown && velocity >= HIDE_VELOCITY) {
      // Cache le header immédiatement
      setHeader(false);
      // Cache la navbar avec un léger délai (effet cascade)
      clearTimeout(navbarTimerRef.current);
      navbarTimerRef.current = setTimeout(() => setNavbar(false), NAVBAR_DELAY);
    } else if (scrollingUp && velocity >= SHOW_VELOCITY) {
      // Réaffiche tout
      clearTimeout(navbarTimerRef.current);
      setHeader(true);
      setNavbar(true);
    }
    // Scroll lent → on ne fait rien, on laisse l'état actuel
  }, [resetIdleTimer, setHeader, setNavbar]);

  const handleScrollEvent = useCallback((scrollY) => {
    const now = Date.now();
    if (now - lastRafTime.current < RAF_THROTTLE) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        lastRafTime.current = Date.now();
        processScroll(scrollY);
      });
      return;
    }
    lastRafTime.current = now;
    processScroll(scrollY);
  }, [processScroll]);

  useEffect(() => {
    // Écoute l'event custom émis par Home.jsx (scroll dans le conteneur interne)
    const onAppScroll = (e) => {
      handleScrollEvent(e.detail?.scrollTop ?? 0);
    };

    // Fallback : scroll natif sur window (pages hors Home)
    const onWindowScroll = () => {
      handleScrollEvent(window.scrollY || document.documentElement.scrollTop || 0);
    };

    window.addEventListener("app:scroll",  onAppScroll,    { passive: true });
    window.addEventListener("scroll",      onWindowScroll, { passive: true });

    return () => {
      window.removeEventListener("app:scroll",  onAppScroll);
      window.removeEventListener("scroll",      onWindowScroll);
      if (rafRef.current)      cancelAnimationFrame(rafRef.current);
      clearTimeout(idleTimerRef.current);
      clearTimeout(navbarTimerRef.current);
    };
  }, [handleScrollEvent]);

  return { headerVisible, navbarVisible };
}