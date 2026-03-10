// 📁 src/components/WakeUpScreen.jsx
// Affiché pendant que le backend se réveille après inactivité.
// Remplace la page noire par un écran rassurant avec progression animée.

import React, { useEffect, useState, useRef } from "react";

const MESSAGES = [
  "Démarrage en cours…",
  "Ça prend quelques secondes…",
  "Presque prêt, merci de patienter…",
  "Encore un instant…",
  "Connexion établie, chargement…",
];

export default function WakeUpScreen({ isDarkMode = true }) {
  const [msgIndex, setMsgIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [dots,     setDots]     = useState("");
  const timerMsg  = useRef(null);
  const timerDots = useRef(null);
  const timerProg = useRef(null);

  // Rotation des messages toutes les 4s
  useEffect(() => {
    timerMsg.current = setInterval(() => {
      setMsgIndex(i => (i + 1) % MESSAGES.length);
    }, 4000);
    return () => clearInterval(timerMsg.current);
  }, []);

  // Animation des points "..."
  useEffect(() => {
    timerDots.current = setInterval(() => {
      setDots(d => d.length >= 3 ? "" : d + ".");
    }, 500);
    return () => clearInterval(timerDots.current);
  }, []);

  // Barre de progression simulée — ralentit vers 90% pour ne jamais atteindre 100%
  useEffect(() => {
    timerProg.current = setInterval(() => {
      setProgress(p => {
        if (p >= 90) return p + 0.05;
        if (p >= 70) return p + 0.2;
        if (p >= 40) return p + 0.5;
        return p + 1.2;
      });
    }, 200);
    return () => clearInterval(timerProg.current);
  }, []);

  const bg      = isDarkMode ? "#0f0f0f" : "#f9f9f9";
  const card    = isDarkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)";
  const border  = isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
  const txtMain = isDarkMode ? "rgba(255,255,255,0.92)" : "#111";
  const txtSub  = isDarkMode ? "rgba(255,255,255,0.4)"  : "#888";
  const clampedProgress = Math.min(progress, 97);

  return (
    <div style={{
      position:       "fixed",
      inset:          0,
      background:     bg,
      display:        "flex",
      flexDirection:  "column",
      alignItems:     "center",
      justifyContent: "center",
      zIndex:         9998,
      padding:        "24px",
    }}>

      {/* Logo */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, marginBottom: 40 }}>
        <div style={{
          width:          72,
          height:         72,
          borderRadius:   18,
          background:     "linear-gradient(135deg, #f97316, #ec4899)",
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          boxShadow:      "0 8px 32px rgba(249,115,22,0.35)",
          animation:      "wakeup-pulse 2s ease-in-out infinite",
        }}>
          <span style={{ color: "white", fontSize: 36, fontWeight: 900, fontFamily: "system-ui" }}>C</span>
        </div>

        <div style={{ display: "flex", alignItems: "baseline" }}>
          <span style={{ color: txtMain, fontSize: 28, fontWeight: 800, fontFamily: "system-ui, -apple-system, sans-serif" }}>
            Chanti
          </span>
          <span style={{
            fontSize:   28,
            fontWeight: 800,
            fontFamily: "system-ui, -apple-system, sans-serif",
            background: "linear-gradient(90deg, #f97316, #ec4899)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor:  "transparent",
          }}>
            Link
          </span>
        </div>
      </div>

      {/* Card d'attente */}
      <div style={{
        width:         "100%",
        maxWidth:      320,
        background:    card,
        border:        `1px solid ${border}`,
        borderRadius:  20,
        padding:       "24px 20px",
        display:       "flex",
        flexDirection: "column",
        gap:           20,
      }}>
        {/* Icône + message */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width:          40,
            height:         40,
            borderRadius:   12,
            background:     "rgba(249,115,22,0.12)",
            display:        "flex",
            alignItems:     "center",
            justifyContent: "center",
            flexShrink:     0,
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="8" rx="2" />
              <rect x="2" y="14" width="20" height="8" rx="2" />
              <line x1="6" y1="6" x2="6.01" y2="6" />
              <line x1="6" y1="18" x2="6.01" y2="18" />
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ color: txtMain, fontSize: 14, fontWeight: 600, margin: 0, lineHeight: 1.4 }}>
              {MESSAGES[msgIndex]}{dots}
            </p>
            <p style={{ color: txtSub, fontSize: 12, margin: "4px 0 0", lineHeight: 1.3 }}>
              Démarrage après une période d'inactivité.
            </p>
          </div>
        </div>

        {/* Barre de progression */}
        <div>
          <div style={{
            width:        "100%",
            height:       4,
            background:   isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
            borderRadius: 4,
            overflow:     "hidden",
          }}>
            <div style={{
              height:     "100%",
              width:      `${clampedProgress}%`,
              background: "linear-gradient(90deg, #f97316, #ec4899)",
              borderRadius: 4,
              transition: "width 0.3s ease",
            }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
            <span style={{ color: txtSub, fontSize: 11 }}>Connexion au serveur</span>
            <span style={{ color: "#f97316", fontSize: 11, fontWeight: 600 }}>
              {Math.round(clampedProgress)}%
            </span>
          </div>
        </div>

        {/* Barres animées */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={{
              flex:         1,
              height:       3,
              borderRadius: 3,
              background:   "linear-gradient(90deg, #f97316, #ec4899)",
              animation:    "wakeup-bar 1.4s ease-in-out infinite",
              animationDelay: `${i * 0.18}s`,
              opacity:      0.3,
            }} />
          ))}
        </div>
      </div>

      {/* Tip */}
      <p style={{
        color:      txtSub,
        fontSize:   12,
        marginTop:  28,
        textAlign:  "center",
        maxWidth:   280,
        lineHeight: 1.5,
      }}>
        💡 Le chargement sera instantané lors des prochaines visites.
      </p>

      <style>{`
        @keyframes wakeup-pulse {
          0%, 100% { transform: scale(1);    box-shadow: 0 8px 32px rgba(249,115,22,0.35); }
          50%       { transform: scale(1.06); box-shadow: 0 12px 40px rgba(249,115,22,0.55); }
        }
        @keyframes wakeup-bar {
          0%, 100% { opacity: 0.2; transform: scaleY(1); }
          50%       { opacity: 1;   transform: scaleY(1.8); }
        }
      `}</style>
    </div>
  );
}