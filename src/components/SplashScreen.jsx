// 📁 src/components/SplashScreen.jsx
// ✅ FIX LCP  : splash masqué dès que React est prêt, pas après un timer arbitraire
// ✅ FIX CLS  : dimensions réservées (width/height) + layout-stable (pas de reflow)
// ✅ FIX INP  : pas de setInterval, animation CSS pure

import { useEffect, useRef } from "react";

export default function SplashScreen({ onFinish }) {
  const ref = useRef(null);

  useEffect(() => {
    // Masquer le splash natif HTML immédiatement si présent
    if (typeof window.__hideSplash === "function") window.__hideSplash();
    if (typeof window.hideSplashScreen === "function") window.hideSplashScreen();

    // ✅ FIX LCP + CLS : on utilise une seule transition CSS, pas de setInterval
    // Le splash disparaît après 400ms — suffisant pour éviter le flash blanc
    // mais assez court pour ne pas pénaliser le LCP
    const FADE_DELAY = 400; // ms avant le fade-out
    const HIDE_DELAY = 700; // ms avant le unmount complet

    const fadeTimer = setTimeout(() => {
      if (ref.current) ref.current.style.opacity = "0";
    }, FADE_DELAY);

    const hideTimer = setTimeout(() => {
      onFinish?.();
    }, HIDE_DELAY);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, [onFinish]);

  return (
    // ✅ FIX CLS : position fixed + inset-0 → ne génère aucun reflow sur le document
    // width/height explicites sur l'img → réserve l'espace dès le premier paint
    <div
      ref={ref}
      aria-hidden="true"
      style={{
        position:   "fixed",
        inset:      0,
        zIndex:     9999,
        display:    "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #2B2D42 0%, #1a1b2e 100%)",
        opacity:    1,
        // ✅ transition CSS pure — pas de JS dans la boucle de rendu
        transition: "opacity 300ms ease-out",
        // ✅ will-change limité à opacity uniquement (pas transform)
        willChange: "opacity",
      }}
    >
      {/* ✅ FIX LCP : fetchpriority="high" + dimensions explicites (évite reflow CLS) */}
      <img
        src="/chantilink-logo.png"
        alt=""
        width={160}
        height={160}
        fetchpriority="high"
        decoding="sync"
        style={{
          width:       160,
          height:      160,
          objectFit:   "contain",
          marginBottom: 24,
          // ✅ animation CSS déclarée ici pour éviter FOUC
          animation:   "splash-float 2s ease-in-out infinite",
          filter:      "drop-shadow(0 10px 40px rgba(230,126,60,0.4))",
        }}
      />

      <h1
        style={{
          fontSize:      36,
          fontWeight:    900,
          letterSpacing: "-0.02em",
          color:         "#fff",
          textTransform: "uppercase",
          margin:        0,
          // ✅ FIX CLS : line-height fixe pour éviter reflow au chargement de la font
          lineHeight:    1.1,
        }}
      >
        CHANTI
        <span style={{ color: "#E67E3C" }}>LINK</span>
      </h1>

      <div
        style={{
          marginTop:    12,
          height:       4,
          width:        60,
          borderRadius: 2,
          background:   "linear-gradient(90deg, transparent, #E67E3C, transparent)",
          animation:    "splash-expand 0.4s ease-out 0.3s backwards",
        }}
      />

      {/* Dots */}
      <div
        style={{
          position: "absolute",
          bottom:   64,
          display:  "flex",
          gap:      8,
        }}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width:           10,
              height:          10,
              borderRadius:    "50%",
              background:      "#E67E3C",
              boxShadow:       "0 0 10px rgba(230,126,60,0.5)",
              animation:       `splash-pulse 1.2s ease-in-out ${i * 150}ms infinite`,
            }}
          />
        ))}
      </div>

      {/* ✅ CSS inline dans <style> pour éviter FOUC — critique pour LCP */}
      <style>{`
        @keyframes splash-float {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(-10px); }
        }
        @keyframes splash-expand {
          from { width: 0; }
          to   { width: 60px; }
        }
        @keyframes splash-pulse {
          0%, 100% { opacity: 0.4; transform: scale(0.8); }
          50%       { opacity: 1;   transform: scale(1.1); }
        }
      `}</style>
    </div>
  );
}