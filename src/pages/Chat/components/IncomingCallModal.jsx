// ============================================
// 📁 src/pages/Chat/components/IncomingCallModal.jsx
// ✅ PHASE 5 — Modale d'appel entrant (audio/vidéo)
//    - Avatar du caller animé
//    - Boutons Accepter / Refuser
//    - Sonnerie Tone.js (gérée par le parent via cleanupCallRingtone)
//    - Auto-refuse après 30s
// ============================================
import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, PhoneOff, Video, PhoneIncoming } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function IncomingCallModal({
  open,
  caller,
  callType = "audio",
  onAccept,
  onReject,
  timeoutMs = 30000,
}) {
  const { t } = useTranslation();
  const [secondsLeft, setSecondsLeft] = useState(Math.floor(timeoutMs / 1000));

  useEffect(() => {
    if (!open) return;
    setSecondsLeft(Math.floor(timeoutMs / 1000));
    const interval = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(interval);
          onReject?.("timeout");
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [open, timeoutMs, onReject]);

  return (
    <AnimatePresence>
      {open && caller && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ background: "rgba(8,12,20,0.85)", backdropFilter: "blur(12px)" }}
        >
          <motion.div
            initial={{ scale: 0.85, y: 30 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.85, y: 30 }}
            transition={{ type: "spring", damping: 22, stiffness: 280 }}
            className="relative w-full max-w-sm overflow-hidden rounded-[32px] shadow-2xl"
            style={{
              background: "linear-gradient(165deg, #1a1f2e 0%, #0d1117 100%)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            {/* Pulse animation ring */}
            <div className="relative flex flex-col items-center pt-10 pb-8">
              <div className="relative mb-6">
                <motion.div
                  animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.15, 0.4] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: callType === "video"
                      ? "linear-gradient(135deg, #3b82f6, #8b5cf6)"
                      : "linear-gradient(135deg, #10b981, #14b8a6)",
                  }}
                />
                <motion.div
                  animate={{ scale: [1, 1.08, 1], opacity: [0.6, 0.3, 0.6] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
                  className="absolute -inset-2 rounded-full"
                  style={{
                    background: callType === "video"
                      ? "linear-gradient(135deg, #3b82f6, #8b5cf6)"
                      : "linear-gradient(135deg, #10b981, #14b8a6)",
                    filter: "blur(8px)",
                  }}
                />
                <div
                  className="relative w-28 h-28 rounded-full flex items-center justify-center overflow-hidden border-4"
                  style={{
                    background: callType === "video"
                      ? "linear-gradient(135deg, #3b82f6, #8b5cf6)"
                      : "linear-gradient(135deg, #10b981, #14b8a6)",
                    borderColor: "rgba(255,255,255,0.15)",
                  }}
                >
                  {caller.profilePhoto ? (
                    <img src={caller.profilePhoto} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-3xl font-black text-white">
                      {(caller.fullName || caller.username || "?")[0]?.toUpperCase()}
                    </span>
                  )}
                </div>
              </div>

              {/* Type icon */}
              <div className="flex items-center gap-2 mb-3 px-3 py-1 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
                {callType === "video" ? (
                  <Video size={13} className="text-blue-400" />
                ) : (
                  <PhoneIncoming size={13} className="text-emerald-400" />
                )}
                <span className="text-[10px] font-black uppercase tracking-wider text-white/70">
                  {callType === "video" ? t("call.video") : t("call.audio")}
                </span>
              </div>

              <h2 className="text-2xl font-black text-white tracking-tight mb-1">
                {caller.fullName || caller.username || "Utilisateur"}
              </h2>
              <p className="text-sm text-white/60 mb-1">
                {t("call.incoming")}
              </p>
              <p className="text-xs font-mono text-amber-400/80">
                {t("call.timeoutIn", { seconds: secondsLeft })}
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex justify-around items-center px-8 pb-8 pt-2">
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={() => onReject?.("user")}
                className="flex flex-col items-center gap-2"
              >
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center shadow-lg"
                  style={{
                    background: "linear-gradient(135deg, #ef4444, #dc2626)",
                    boxShadow: "0 8px 24px rgba(239,68,68,0.4)",
                  }}
                >
                  <PhoneOff size={26} className="text-white" strokeWidth={2.5} />
                </div>
                <span className="text-[11px] font-bold text-white/70">
                  {t("call.decline")}
                </span>
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={onAccept}
                className="flex flex-col items-center gap-2"
              >
                <motion.div
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="w-16 h-16 rounded-full flex items-center justify-center shadow-lg"
                  style={{
                    background: "linear-gradient(135deg, #10b981, #059669)",
                    boxShadow: "0 8px 24px rgba(16,185,129,0.4)",
                  }}
                >
                  {callType === "video" ? (
                    <Video size={26} className="text-white" strokeWidth={2.5} />
                  ) : (
                    <Phone size={26} className="text-white" strokeWidth={2.5} />
                  )}
                </motion.div>
                <span className="text-[11px] font-bold text-white/70">
                  {t("call.accept")}
                </span>
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
