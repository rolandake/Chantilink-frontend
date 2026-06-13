// ============================================
// 📁 src/pages/Chat/components/CallModal.jsx
//
// Modale d'appel en cours (audio / vidéo)
// Intégration avec le système existant :
//   - call        : { on, type, friend, mute, video, isIncoming, callId }
//   - localStream / remoteStream : flux WebRTC
//   - callState   : "calling" | "connecting" | "connected" | "ended" | "failed"
//   - onToggleMute / onToggleCamera / onEnd
//
// ÉTATS VISUELS :
//   calling    → animation pulsante "En attente…"  (sonnerie CallerRingtone active)
//   connecting → spinner "Connexion…"
//   connected  → timer + flux vidéo / avatar
//   ended      → bref flash "Appel terminé" avant fermeture
//   failed     → message d'erreur + bouton fermer
//
// LAYOUT :
//   Vidéo   → remote plein écran + self-preview en coin bas-droite
//   Audio   → fond dégradé sombre + avatar animé + nom + timer
//   Mobile  → plein écran (fixed inset-0)
//   Desktop → carte centrée max-w-sm arrondie
// ============================================
import React, {
  useEffect, useRef, useState, useCallback, useMemo,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic, MicOff, Video, VideoOff, PhoneOff,
  Phone, RotateCcw, Maximize2, Minimize2, Wifi, WifiOff,
} from "lucide-react";

// ─── Helper durée ─────────────────────────────────────────────────────────────
const fmtDuration = (sec) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
};

// ─── Label état ───────────────────────────────────────────────────────────────
const STATE_LABEL = {
  calling:    "En attente de réponse…",
  connecting: "Connexion en cours…",
  connected:  null,   // remplacé par le timer
  ended:      "Appel terminé",
  failed:     "Échec de la connexion",
};

// ─────────────────────────────────────────────────────────────────────────────
export default function CallModal({
  open         = false,
  callType     = "audio",   // "audio" | "video"
  remoteUser,               // { id, fullName, username, profilePhoto }
  callState    = "calling", // calling | connecting | connected | ended | failed
  localStream  = null,
  remoteStream = null,
  isMuted      = false,
  isCameraOff  = false,
  error        = null,
  onToggleMute,
  onToggleCamera,
  onEnd,
}) {
  const remoteVideoRef = useRef(null);
  const localVideoRef  = useRef(null);
  const [seconds,      setSeconds]      = useState(0);
  const [fullscreen,   setFullscreen]   = useState(false);
  const [showControls, setShowControls] = useState(true);
  const hideCtrlTimer  = useRef(null);

  const isVideo      = callType === "video";
  const isConnected  = callState === "connected";
  const isCalling    = callState === "calling";
  const isFailed     = callState === "failed";
  const isEnded      = callState === "ended";

  // ── Lier les streams aux éléments vidéo ────────────────────────────────
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // ── Timer d'appel (démarre quand connected) ───────────────────────────
  useEffect(() => {
    if (!open || !isConnected) { setSeconds(0); return; }
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [open, isConnected]);

  // ── Auto-masquer les contrôles après 4 s (mode vidéo plein écran) ────
  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    if (hideCtrlTimer.current) clearTimeout(hideCtrlTimer.current);
    if (isVideo && fullscreen && isConnected) {
      hideCtrlTimer.current = setTimeout(() => setShowControls(false), 4000);
    }
  }, [isVideo, fullscreen, isConnected]);

  useEffect(() => {
    resetHideTimer();
    return () => { if (hideCtrlTimer.current) clearTimeout(hideCtrlTimer.current); };
  }, [resetHideTimer]);

  // ── Cleanup à la fermeture ─────────────────────────────────────────────
  useEffect(() => {
    if (!open) { setSeconds(0); setFullscreen(false); setShowControls(true); }
  }, [open]);

  // ── Raccrocher ────────────────────────────────────────────────────────
  const handleEnd = useCallback(() => {
    onEnd?.();
  }, [onEnd]);

  if (!open) return null;

  // ─────────────────────────────────────────────────────────────────────────
  // CONTENU CENTRAL (avatar / vidéo distante)
  // ─────────────────────────────────────────────────────────────────────────
  const RemoteArea = () => {
    if (isVideo && remoteStream) {
      return (
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />
      );
    }

    // Appel audio OU vidéo sans stream distant encore
    return (
      <div className="flex flex-col items-center gap-5 relative z-10 px-6 py-8 w-full">
        {/* Avatar pulsant */}
        <div className="relative flex items-center justify-center">
          {/* Anneaux — seulement quand en attente */}
          {(isCalling || callState === "connecting") &&
            [1, 2, 3].map((i) => (
              <motion.div
                key={i}
                className="absolute rounded-full border border-white/20"
                style={{ width: 80 + i * 32, height: 80 + i * 32 }}
                animate={{ scale: [1, 1.08, 1], opacity: [0.3, 0, 0.3] }}
                transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.5 }}
              />
            ))
          }
          <div className="relative z-10 w-24 h-24 rounded-full overflow-hidden border-2 border-white/25 bg-gradient-to-br from-blue-600 to-indigo-700 shadow-2xl shadow-black/50 flex items-center justify-center">
            {remoteUser?.profilePhoto
              ? <img src={remoteUser.profilePhoto} alt="" className="w-full h-full object-cover" />
              : <span className="text-4xl font-black text-white select-none">
                  {(remoteUser?.fullName?.[0] || "?").toUpperCase()}
                </span>
            }
          </div>
        </div>

        {/* Nom */}
        <div className="text-center">
          <h2 className="text-2xl font-black text-white tracking-tight">
            {remoteUser?.fullName || "Inconnu"}
          </h2>
          {remoteUser?.username && (
            <p className="text-sm text-white/40 mt-0.5">@{remoteUser.username}</p>
          )}
        </div>

        {/* État / Timer */}
        <StateLabel callState={callState} seconds={seconds} error={error} />
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER PRINCIPAL
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="call-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          className={`fixed inset-0 z-[180] flex items-center justify-center ${fullscreen ? "" : "p-0 sm:p-6"}`}
          onClick={resetHideTimer}
        >
          {/* Fond */}
          <div
            className="absolute inset-0"
            style={{
              background: (isVideo && remoteStream)
                ? "rgba(0,0,0,0.85)"
                : "linear-gradient(160deg, #0b1020 0%, #050810 60%, #0a0e18 100%)",
            }}
          />

          {/* Carte principale */}
          <motion.div
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 24, stiffness: 260 }}
            className={`
              relative overflow-hidden flex flex-col
              ${fullscreen
                ? "w-full h-full"
                : "w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl border border-white/10 shadow-2xl"
              }
            `}
            style={{
              background: (isVideo && remoteStream)
                ? "transparent"
                : "linear-gradient(165deg, #0f1525 0%, #080b14 100%)",
            }}
          >
            {/* ── Vidéo distante (arrière-plan) ── */}
            {isVideo && remoteStream && (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}

            {/* ── Overlay dégradé sur vidéo pour lisibilité des contrôles ── */}
            {isVideo && remoteStream && (
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none z-10" />
            )}

            {/* ── En-tête (nom + état) — visible sur vidéo ── */}
            <AnimatePresence>
              {(showControls || !isVideo) && (
                <motion.div
                  initial={{ opacity: 0, y: -12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  className="relative z-20 flex items-center justify-between px-5 pt-5 pb-2"
                >
                  <div className="flex items-center gap-3">
                    {/* Mini avatar */}
                    <div className="w-9 h-9 rounded-full overflow-hidden bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center border border-white/20 flex-shrink-0">
                      {remoteUser?.profilePhoto
                        ? <img src={remoteUser.profilePhoto} alt="" className="w-full h-full object-cover"/>
                        : <span className="text-sm font-black text-white">
                            {(remoteUser?.fullName?.[0] || "?").toUpperCase()}
                          </span>
                      }
                    </div>
                    <div>
                      <p className="text-sm font-black text-white leading-tight">
                        {remoteUser?.fullName || "Inconnu"}
                      </p>
                      <StateLabel callState={callState} seconds={seconds} error={error} compact />
                    </div>
                  </div>

                  {/* Bouton plein écran (vidéo seulement) */}
                  {isVideo && (
                    <button
                      onClick={() => setFullscreen((f) => !f)}
                      className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                      aria-label={fullscreen ? "Réduire" : "Plein écran"}
                    >
                      {fullscreen
                        ? <Minimize2 size={14} className="text-white/70"/>
                        : <Maximize2 size={14} className="text-white/70"/>
                      }
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Zone centrale (avatar audio / placeholder vidéo) ── */}
            {(!isVideo || !remoteStream) && (
              <div className="relative z-10 flex-1 flex items-center justify-center">
                <RemoteArea />
              </div>
            )}

            {/* Espacement flex pour pousser les contrôles vers le bas */}
            {isVideo && remoteStream && <div className="flex-1 relative z-10" />}

            {/* ── Self-preview (vidéo locale, coin bas-gauche) ── */}
            {isVideo && localStream && !isCameraOff && (
              <div className="absolute bottom-28 left-4 z-30 w-24 h-32 rounded-xl overflow-hidden border-2 border-white/25 shadow-xl">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover scale-x-[-1]" /* mirror */
                />
                <div className="absolute inset-0 rounded-xl ring-1 ring-white/10" />
              </div>
            )}

            {/* ── Indicateur réseau (quand connecté) ── */}
            {isConnected && (
              <div className="absolute top-4 right-14 z-30 flex items-center gap-1 px-2 py-1 bg-black/30 rounded-full">
                <Wifi size={10} className="text-green-400" />
                <span className="text-[9px] text-green-400 font-bold">HD</span>
              </div>
            )}

            {/* ── CONTRÔLES ── */}
            <AnimatePresence>
              {(showControls || !isVideo) && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 16 }}
                  transition={{ type: "spring", damping: 22, stiffness: 240 }}
                  className="relative z-20 px-6 pb-10 pt-4"
                >
                  <div className="flex items-center justify-center gap-5">

                    {/* Mute micro */}
                    <ControlButton
                      onClick={onToggleMute}
                      active={isMuted}
                      activeIcon={<MicOff size={22}/>}
                      inactiveIcon={<Mic size={22}/>}
                      label={isMuted ? "Activer" : "Couper"}
                      activeColor="bg-white/15 text-white"
                      inactiveColor="bg-white/10 text-white/80"
                      disabled={!isConnected && !isCalling}
                    />

                    {/* Raccrocher — bouton central, toujours visible */}
                    <motion.div className="flex flex-col items-center gap-1.5">
                      <motion.button
                        whileTap={{ scale: 0.88 }}
                        onClick={handleEnd}
                        aria-label="Raccrocher"
                        className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-400 active:bg-red-700 flex items-center justify-center shadow-2xl shadow-red-900/60 transition-colors"
                      >
                        <PhoneOff size={26} className="text-white" />
                      </motion.button>
                      <span className="text-[10px] font-bold text-white/50">
                        Raccrocher
                      </span>
                    </motion.div>

                    {/* Caméra (vidéo seulement) */}
                    {isVideo ? (
                      <ControlButton
                        onClick={onToggleCamera}
                        active={isCameraOff}
                        activeIcon={<VideoOff size={22}/>}
                        inactiveIcon={<Video size={22}/>}
                        label={isCameraOff ? "Caméra" : "Caméra"}
                        activeColor="bg-white/15 text-white"
                        inactiveColor="bg-white/10 text-white/80"
                        disabled={!isConnected && !isCalling}
                      />
                    ) : (
                      /* Placeholder pour équilibrer la ligne sur appel audio */
                      <div className="w-14 h-14" aria-hidden />
                    )}

                  </div>
                </motion.div>
              )}
            </AnimatePresence>

          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sous-composant : bouton de contrôle
// ─────────────────────────────────────────────────────────────────────────────
function ControlButton({
  onClick, active, activeIcon, inactiveIcon,
  label, activeColor, inactiveColor, disabled,
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <motion.button
        whileTap={{ scale: 0.88 }}
        onClick={disabled ? undefined : onClick}
        aria-label={label}
        aria-pressed={active}
        className={`
          w-14 h-14 rounded-full flex items-center justify-center
          transition-all duration-200 shadow-lg
          ${disabled ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}
          ${active ? activeColor : inactiveColor}
        `}
      >
        {active ? activeIcon : inactiveIcon}
      </motion.button>
      <span className="text-[10px] font-bold text-white/50">{label}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sous-composant : label d'état
// ─────────────────────────────────────────────────────────────────────────────
function StateLabel({ callState, seconds, error, compact = false }) {
  const isConnected = callState === "connected";
  const isFailed    = callState === "failed";

  if (isConnected) {
    return (
      <p className={`${compact ? "text-xs" : "text-base"} font-bold tabular-nums ${compact ? "text-green-400" : "text-green-300"}`}>
        {fmtDuration(seconds)}
      </p>
    );
  }

  if (isFailed) {
    return (
      <p className={`${compact ? "text-xs" : "text-sm"} text-red-400 font-semibold`}>
        {error || "Échec de la connexion"}
      </p>
    );
  }

  const label = STATE_LABEL[callState] || "…";

  return (
    <p className={`${compact ? "text-xs" : "text-sm"} text-white/50 font-medium flex items-center gap-1.5`}>
      {/* Point animé */}
      {(callState === "calling" || callState === "connecting") && (
        <span className="inline-flex gap-0.5">
          {[0, 0.18, 0.36].map((d) => (
            <motion.span
              key={d}
              className="w-1 h-1 rounded-full bg-white/40 inline-block"
              animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
              transition={{ duration: 1.1, repeat: Infinity, delay: d }}
            />
          ))}
        </span>
      )}
      {label}
    </p>
  );
}