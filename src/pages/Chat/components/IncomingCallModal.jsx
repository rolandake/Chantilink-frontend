// ============================================
// 📁 src/components/IncomingCallModal.jsx  v3
// FIXES :
//  - ✅ BUG CRITIQUE : `Notification.permission` était accédé sans vérifier
//    que `Notification` existe dans l'environnement. Sur Safari iOS et la
//    plupart des WebViews mobiles, `Notification` est undefined → ça levait
//    une ReferenceError EN PLEIN useEffect, après le démarrage de la
//    sonnerie/vibration mais AVANT l'enregistrement du cleanup et du
//    timer d'auto-rejet. Résultat : la sonnerie jouait (audible), mais le
//    composant ne finissait jamais son effet correctement — d'où les
//    boutons Décrocher/Refuser invisibles ou inertes.
//  - ✅ Sonnerie/vibration/notification retirées d'ici : Messages.jsx gère
//    déjà CallRingtone + vibrateCall + startTabCallAlert dans son listener
//    "incoming-call". Les dupliquer ici causait une double sonnerie non
//    synchronisée (celle du modal n'était jamais stoppée par
//    handleAcceptCall/handleRejectCall, qui ne connaissent que la ref de
//    Messages.jsx).
//  - Ce composant est maintenant purement présentationnel : affichage +
//    compte à rebours visuel 30 s + boutons. L'auto-rejet réel après 30 s
//    est piloté côté serveur (call-missed / call-not-answered, gérés dans
//    Messages.jsx) ; le timer local sert uniquement de filet de secours
//    visuel/UX si jamais l'événement serveur tarde.
// ============================================
import React, { useEffect, useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Phone, PhoneOff, Video } from "lucide-react";

const RING_DURATION_S = 30;

export default function IncomingCallModal({ caller, callType, onAccept, onReject }) {
  const [remaining, setRemaining] = useState(RING_DURATION_S);
  const timerRef = useRef(null);
  const countRef = useRef(null);

  // ── Compte à rebours visuel uniquement (pas de son/vibration ici) ───────
  useEffect(() => {
    if (!caller) return;

    setRemaining(RING_DURATION_S);
    countRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(countRef.current);
          return 0;
        }
        return r - 1;
      });
    }, 1000);

    // Filet de secours local : si rien ne vient du serveur après 30s,
    // on déclenche quand même onReject côté UI.
    timerRef.current = setTimeout(() => {
      cleanup();
      onReject?.();
    }, RING_DURATION_S * 1000);

    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caller?.id]);

  const cleanup = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (countRef.current) { clearInterval(countRef.current); countRef.current = null; }
  }, []);

  const handleAccept = useCallback(() => {
    cleanup();
    onAccept?.();
  }, [cleanup, onAccept]);

  const handleReject = useCallback(() => {
    cleanup();
    onReject?.();
  }, [cleanup, onReject]);

  if (!caller) return null;

  const progress = (remaining / RING_DURATION_S) * 100;
  const isVideo  = callType === "video";

  return (
    <div className="fixed inset-0 z-[400] flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-none">
      {/* Backdrop semi-transparent (ne bloque pas l'UI derrière) */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-md pointer-events-auto" />

      <motion.div
        initial={{ y: 80, opacity: 0, scale: 0.95 }}
        animate={{ y: 0,  opacity: 1, scale: 1 }}
        exit={{   y: 80, opacity: 0, scale: 0.95 }}
        transition={{ type: "spring", damping: 24, stiffness: 280 }}
        className="relative pointer-events-auto w-full sm:max-w-sm bg-gradient-to-b from-[#0f1520] to-[#0a0f1a] rounded-t-3xl sm:rounded-3xl border border-white/10 shadow-2xl overflow-hidden"
      >
        {/* Barre de progression 30 s */}
        <div className="h-0.5 bg-white/5 relative">
          <motion.div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-indigo-400"
            initial={{ width: "100%" }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.9, ease: "linear" }}
          />
        </div>

        <div className="px-6 pt-8 pb-10 flex flex-col items-center gap-6">

          {/* Type d'appel */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 rounded-full border border-blue-500/20">
            {isVideo
              ? <Video    size={14} className="text-blue-400" />
              : <Phone    size={14} className="text-blue-400" />
            }
            <span className="text-[11px] font-black text-blue-300 uppercase tracking-widest">
              Appel {isVideo ? "vidéo" : "audio"} entrant
            </span>
          </div>

          {/* Avatar pulsant */}
          <div className="relative flex items-center justify-center">
            {/* Anneaux de pulsation */}
            {[1, 2, 3].map((i) => (
              <motion.div
                key={i}
                className="absolute rounded-full border border-blue-400/30"
                style={{ width: 80 + i * 28, height: 80 + i * 28 }}
                animate={{ scale: [1, 1.12, 1], opacity: [0.4, 0, 0.4] }}
                transition={{ duration: 2, repeat: Infinity, delay: i * 0.4, ease: "easeOut" }}
              />
            ))}
            <div className="relative z-10 w-20 h-20 rounded-full border-2 border-blue-400/50 overflow-hidden bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-xl shadow-blue-900/50">
              {caller.profilePhoto
                ? <img src={caller.profilePhoto} alt="" className="w-full h-full object-cover" />
                : <span className="text-3xl font-black text-white">
                    {(caller.fullName?.[0] || "?").toUpperCase()}
                  </span>
              }
            </div>
          </div>

          {/* Infos appelant */}
          <div className="text-center">
            <h2 className="text-xl font-black text-white mb-1">{caller.fullName || "Inconnu"}</h2>
            <p className="text-sm text-gray-400 animate-pulse">Appel en cours…</p>
            <p className="text-xs text-gray-600 mt-1">{remaining}s</p>
          </div>

          {/* Boutons */}
          <div className="flex items-center justify-center gap-10 mt-2">
            {/* Refuser */}
            <div className="flex flex-col items-center gap-2">
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={handleReject}
                className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-400 active:bg-red-600 flex items-center justify-center shadow-xl shadow-red-900/40 transition-colors"
                aria-label="Refuser l'appel"
              >
                <PhoneOff size={26} className="text-white" />
              </motion.button>
              <span className="text-[11px] text-gray-500 font-bold">Refuser</span>
            </div>

            {/* Décrocher */}
            <div className="flex flex-col items-center gap-2">
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={handleAccept}
                className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-400 active:bg-green-600 flex items-center justify-center shadow-xl shadow-green-900/40 transition-colors"
                aria-label="Décrocher"
              >
                {isVideo
                  ? <Video  size={26} className="text-white" />
                  : <Phone  size={26} className="text-white" />
                }
              </motion.button>
              <span className="text-[11px] text-gray-500 font-bold">Décrocher</span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}