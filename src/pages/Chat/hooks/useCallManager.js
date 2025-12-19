// ============================================
// 📁 src/pages/Chat/hooks/useCallManager.js
// VERSION: ÉLITE - RÉLIABILITÉ APPELS & AUDIO
// ============================================
import { useState, useCallback, useRef } from "react";
import * as Tone from "tone";

export function useCallManager(sel, connected, initiateCall, socketEndCall, sendMessage, showToast) {
  // --- 1. ÉTAT DE L'APPEL ACTIF ---
  const [call, setCall] = useState({
    on: false,
    type: null,      // 'audio' | 'video'
    friend: null,
    mute: false,
    video: true,
    isIncoming: false,
    callId: null
  });

  // --- 2. ÉTATS DE NOTIFICATION ---
  const [incomingCall, setIncomingCall] = useState(null);
  const [missedCallNotification, setMissedCallNotification] = useState(null);

  // --- 3. REFS POUR LA GESTION AUDIO (TONE.JS) ---
  const toneIntervalRef = useRef(null);
  const toneTimeoutRef = useRef(null);
  const toneSynthRef = useRef(null);

  /**
   * 🧹 NETTOYAGE AUDIO (Crucial pour la confidentialité et la batterie)
   */
  const cleanupCallRingtone = useCallback(() => {
    if (toneIntervalRef.current) {
      clearInterval(toneIntervalRef.current);
      toneIntervalRef.current = null;
    }
    if (toneTimeoutRef.current) {
      clearTimeout(toneTimeoutRef.current);
      toneTimeoutRef.current = null;
    }
    if (toneSynthRef.current) {
      try {
        toneSynthRef.current.dispose();
      } catch (e) {
        console.warn("[ToneJS] Déjà libéré");
      }
      toneSynthRef.current = null;
    }
  }, []);

  /**
   * 📞 DÉMARRER UN APPEL SÉCURISÉ
   */
  const startCall = useCallback((callType) => {
    if (!sel.friend || !connected) {
      showToast("Impossible d'établir la connexion", "error");
      return;
    }

    // On active l'audio Tone sur action utilisateur (requis par les navigateurs)
    Tone.start();

    const success = initiateCall(sel.friend.id, callType);
    
    if (success) {
      setCall({
        on: true,
        type: callType,
        friend: sel.friend,
        mute: false,
        video: callType === 'video',
        isIncoming: false,
        callId: null
      });
    } else {
      showToast("Le service d'appel est indisponible", "error");
    }
  }, [sel.friend, connected, initiateCall, showToast]);

  /**
   * 📴 TERMINER L'APPEL ET NETTOYER
   */
  const endCall = useCallback(() => {
    if (call.callId) {
      socketEndCall(call.callId);
    }
    
    cleanupCallRingtone();
    
    setCall({
      on: false,
      type: null,
      friend: null,
      mute: false,
      video: true,
      isIncoming: false,
      callId: null
    });
  }, [call.callId, socketEndCall, cleanupCallRingtone]);

  /**
   * 📨 SIGNALEMENT APPEL MANQUÉ (Fiabilité & Trace)
   */
  const sendMissedCallMessage = useCallback((friend, callType = "video") => {
    if (!friend?.id) return;

    const messageData = {
      recipientId: friend.id,
      content: `Appel ${callType === 'video' ? 'vidéo' : 'audio'} sans réponse`,
      type: "missed-call",
      metadata: {
        callType,
        timestamp: new Date().toISOString(),
        isPrivate: true
      }
    };

    try {
      sendMessage(messageData);
    } catch (error) {
      console.error("[CallManager] Erreur notification échec:", error);
    }
  }, [sendMessage]);

  return {
    call,
    setCall,
    incomingCall,
    setIncomingCall,
    missedCallNotification,
    setMissedCallNotification,
    toneIntervalRef,
    toneSynthRef,
    startCall,
    endCall,
    sendMissedCallMessage,
    cleanupCallRingtone
  };
}