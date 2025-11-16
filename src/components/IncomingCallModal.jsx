// ============================================
// IncomingCallModal.jsx
// ============================================
import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Phone, PhoneOff, Video, User } from "lucide-react";
import * as Tone from "tone";

const IncomingCallModal = ({ call, onAccept, onReject }) => {
  const [ringingTime, setRingingTime] = useState(0);
  const synthRef = useRef(null);
  const intervalRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!call) return;

    // Démarrage sécurisé de Tone.js
    const startRingtone = async () => {
      try {
        await Tone.start();
        synthRef.current = new Tone.Synth({
          oscillator: { type: "sine" },
          envelope: {
            attack: 0.1,
            decay: 0.2,
            sustain: 0.5,
            release: 0.1
          }
        }).toDestination();

        // Sonnerie répétitive
        intervalRef.current = setInterval(() => {
          if (synthRef.current) {
            synthRef.current.triggerAttackRelease("C5", "0.2");
            setTimeout(() => {
              synthRef.current?.triggerAttackRelease("E5", "0.2");
            }, 300);
          }
        }, 1500);

        // Timer d'affichage
        timerRef.current = setInterval(() => {
          setRingingTime(t => t + 1);
        }, 1000);

      } catch (err) {
        console.error("Erreur démarrage sonnerie:", err);
      }
    };

    startRingtone();

    // Notification navigateur
    if (Notification.permission === "granted") {
      new Notification(`Appel ${call.type} entrant`, {
        body: `${call.caller.fullName} vous appelle`,
        icon: call.caller.profilePhoto || "/default-avatar.png",
        tag: "incoming-call",
        requireInteraction: true
      });
    }

    // Vibration mobile
    if ('vibrate' in navigator) {
      const vibratePattern = [200, 100, 200];
      const vibrateInterval = setInterval(() => {
        navigator.vibrate(vibratePattern);
      }, 2000);

      return () => clearInterval(vibrateInterval);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
      if (synthRef.current) {
        synthRef.current.dispose();
        synthRef.current = null;
      }
      if ('vibrate' in navigator) {
        navigator.vibrate(0);
      }
    };
  }, [call]);

  const handleAccept = () => {
    cleanup();
    onAccept();
  };

  const handleReject = () => {
    cleanup();
    onReject();
  };

  const cleanup = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    if (synthRef.current) {
      synthRef.current.dispose();
      synthRef.current = null;
    }
    if ('vibrate' in navigator) {
      navigator.vibrate(0);
    }
  };

  if (!call) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/95 z-[300] flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.8, y: 50 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.8, y: 50 }}
        className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl border border-gray-700"
      >
        {/* Avatar animé */}
        <motion.div
          animate={{
            scale: [1, 1.1, 1],
            rotate: [0, 5, -5, 0]
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="relative mx-auto mb-6"
        >
          <div className="w-32 h-32 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 p-1">
            {call.caller.profilePhoto ? (
              <img
                src={call.caller.profilePhoto}
                alt={call.caller.fullName}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <div className="w-full h-full rounded-full bg-gray-700 flex items-center justify-center text-white text-4xl font-bold">
                {call.caller.fullName?.[0]?.toUpperCase() || <User className="w-16 h-16" />}
              </div>
            )}
          </div>
          
          {/* Ondes sonores animées */}
          <motion.div
            animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute inset-0 rounded-full bg-green-500/30"
          />
          <motion.div
            animate={{ scale: [1, 2, 1], opacity: [0.3, 0, 0.3] }}
            transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
            className="absolute inset-0 rounded-full bg-green-500/20"
          />
        </motion.div>

        {/* Informations */}
        <h3 className="text-3xl font-bold text-white mb-2">
          {call.caller.fullName}
        </h3>
        <p className="text-lg text-gray-300 mb-1">
          Appel {call.type === "video" ? "vidéo" : "audio"} entrant
        </p>
        <p className="text-sm text-gray-400 mb-8">
          {ringingTime > 0 && `Sonnerie: ${ringingTime}s`}
        </p>

        {/* Boutons d'action */}
        <div className="flex justify-center gap-8">
          {/* Rejeter */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleReject}
            className="group relative"
          >
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-red-600 to-red-500 flex items-center justify-center shadow-lg shadow-red-500/50 group-hover:shadow-red-500/80 transition-all">
              <PhoneOff className="w-8 h-8 text-white" />
            </div>
            <p className="text-xs text-gray-400 mt-2 font-semibold">Refuser</p>
          </motion.button>

          {/* Accepter */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleAccept}
            className="group relative"
          >
            <motion.div
              animate={{ boxShadow: [
                "0 0 20px rgba(34, 197, 94, 0.5)",
                "0 0 40px rgba(34, 197, 94, 0.8)",
                "0 0 20px rgba(34, 197, 94, 0.5)"
              ]}}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="w-20 h-20 rounded-full bg-gradient-to-br from-green-600 to-green-500 flex items-center justify-center"
            >
              {call.type === "video" ? (
                <Video className="w-8 h-8 text-white" />
              ) : (
                <Phone className="w-8 h-8 text-white" />
              )}
            </motion.div>
            <p className="text-xs text-gray-400 mt-2 font-semibold">Répondre</p>
          </motion.button>
        </div>

        {/* Instructions */}
        <p className="text-xs text-gray-500 mt-8">
          L'appel sera automatiquement manqué après 30 secondes
        </p>
      </motion.div>
    </motion.div>
  );
};

export default IncomingCallModal;