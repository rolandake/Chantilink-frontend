// ============================================
// 📁 src/pages/Chat/hooks/useCallManager.js
// FIXES:
//  - endCall lisait call.callId via closure stale → remplacé par ref
//  - cleanupCallRingtone appelait dispose() sur un synth déjà libéré → guard
//  - startCall ne vérifiait pas si un appel était déjà actif
//  - missedCallNotification n'avait pas de auto-clear
//  - sendMissedCallMessage ne gérait pas l'absence de sendMessage
// ============================================
import { useState, useCallback, useRef } from "react";
import * as Tone from "tone";

export function useCallManager(sel, connected, initiateCall, socketEndCall, sendMessage, showToast) {

  const [call, setCall] = useState({
    on: false,
    type: null,
    friend: null,
    mute: false,
    video: true,
    isIncoming: false,
    callId: null,
  });

  const [incomingCall, setIncomingCall]                   = useState(null);
  const [missedCallNotification, setMissedCallNotification] = useState(null);

  // ✅ FIX: stocker callId en ref pour éviter la stale closure dans endCall
  const callIdRef        = useRef(null);
  const toneIntervalRef  = useRef(null);
  const toneTimeoutRef   = useRef(null);
  const toneSynthRef     = useRef(null);
  // ✅ FIX: guard pour ne pas appeler dispose() deux fois
  const isDisposedRef    = useRef(false);

  // ─── Sync callId → ref à chaque changement d'état ───
  const setCallWithRef = useCallback((updater) => {
    setCall((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      callIdRef.current = next.callId ?? null;
      return next;
    });
  }, []);

  // ───────────────────────────────────────────────────
  // 🧹 NETTOYAGE AUDIO
  // ───────────────────────────────────────────────────
  const cleanupCallRingtone = useCallback(() => {
    if (toneIntervalRef.current) {
      clearInterval(toneIntervalRef.current);
      toneIntervalRef.current = null;
    }
    if (toneTimeoutRef.current) {
      clearTimeout(toneTimeoutRef.current);
      toneTimeoutRef.current = null;
    }
    // ✅ FIX: ne dispose qu'une seule fois
    if (toneSynthRef.current && !isDisposedRef.current) {
      try {
        toneSynthRef.current.dispose();
      } catch (e) {
        console.warn("[ToneJS] dispose() échoué:", e.message);
      }
      isDisposedRef.current = true;
      toneSynthRef.current  = null;
    }
  }, []);

  // ───────────────────────────────────────────────────
  // 📞 DÉMARRER UN APPEL
  // ───────────────────────────────────────────────────
  const startCall = useCallback((callType) => {
    // ✅ FIX: empêcher un double-appel
    if (call.on) {
      showToast("Un appel est déjà en cours", "warning");
      return;
    }
    if (!sel?.friend || !connected) {
      showToast("Impossible d'établir la connexion", "error");
      return;
    }

    Tone.start().catch(() => {/* autoplay policy — silencieux */});

    const success = initiateCall(sel.friend.id, callType);
    if (success) {
      setCallWithRef({
        on:         true,
        type:       callType,
        friend:     sel.friend,
        mute:       false,
        video:      callType === "video",
        isIncoming: false,
        callId:     null,
      });
    } else {
      showToast("Le service d'appel est indisponible", "error");
    }
  }, [call.on, sel?.friend, connected, initiateCall, showToast, setCallWithRef]);

  // ───────────────────────────────────────────────────
  // 📴 TERMINER L'APPEL
  // ───────────────────────────────────────────────────
  const endCall = useCallback(() => {
    // ✅ FIX: utiliser la ref pour éviter la stale closure
    const currentCallId = callIdRef.current;
    if (currentCallId) {
      socketEndCall(currentCallId);
    }

    cleanupCallRingtone();
    callIdRef.current = null;

    setCall({
      on:         false,
      type:       null,
      friend:     null,
      mute:       false,
      video:      true,
      isIncoming: false,
      callId:     null,
    });
  }, [socketEndCall, cleanupCallRingtone]);

  // ───────────────────────────────────────────────────
  // 📨 NOTIFICATION APPEL MANQUÉ
  // ───────────────────────────────────────────────────
  const sendMissedCallMessage = useCallback((friend, callType = "audio") => {
    if (!friend?.id) return;

    // ✅ FIX: vérifier que sendMessage existe
    if (typeof sendMessage !== "function") {
      console.warn("[CallManager] sendMessage non disponible");
      return;
    }

    const messageData = {
      recipientId: friend.id,
      content:     `Appel ${callType === "video" ? "vidéo" : "audio"} sans réponse`,
      type:        "missed-call",
      metadata: {
        callType,
        timestamp:  new Date().toISOString(),
        isPrivate:  true,
      },
    };

    try {
      sendMessage(messageData);
    } catch (error) {
      console.error("[CallManager] Erreur notification appel manqué:", error);
    }

    // ✅ FIX: afficher la notif et l'effacer automatiquement après 5s
    setMissedCallNotification({ caller: friend, type: callType });
    setTimeout(() => setMissedCallNotification(null), 5000);
  }, [sendMessage]);

  // ✅ FIX: exposer setCallWithRef au lieu de setCall brut
  // pour que Messages.jsx puisse aussi mettre à jour callIdRef
  return {
    call,
    setCall: setCallWithRef,
    incomingCall,
    setIncomingCall,
    missedCallNotification,
    setMissedCallNotification,
    toneIntervalRef,
    toneSynthRef,
    callIdRef,
    startCall,
    endCall,
    sendMissedCallMessage,
    cleanupCallRingtone,
  };
}