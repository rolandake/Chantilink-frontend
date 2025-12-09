// ============================================ //
// 📁 src/pages/Chat/hooks/useCallManager.js - VERSION CORRIGÉE
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
    callId: null
  });

  const [incomingCall, setIncomingCall] = useState(null);
  const [missedCallNotification, setMissedCallNotification] = useState(null);

  const toneIntervalRef = useRef(null);
  const toneTimeoutRef = useRef(null);
  const toneSynthRef = useRef(null);

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
      toneSynthRef.current.dispose();
      toneSynthRef.current = null;
    }
  }, []);

  const startCall = useCallback((callType) => {
    if (!sel.friend || !connected) {
      console.warn("[useCallManager] Impossible de démarrer l'appel:", { 
        hasFriend: !!sel.friend, 
        connected 
      });
      showToast("Impossible d'initier l'appel", "error");
      return;
    }

    console.log(`[useCallManager] 📞 Démarrage appel ${callType} vers ${sel.friend.fullName}`);
    
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
      console.log("[useCallManager] ✅ Appel initié avec succès");
    } else {
      console.error("[useCallManager] ❌ Échec de l'initiation de l'appel");
      showToast("Impossible d'initier l'appel", "error");
    }
  }, [sel.friend, connected, initiateCall, showToast]);

  const endCall = useCallback(() => {
    console.log("[useCallManager] 📴 Fin d'appel", { callId: call.callId });
    
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

  // ✅ CORRECTION MAJEURE : Envoi correct du message d'appel manqué
  const sendMissedCallMessage = useCallback((friend, callType = "video") => {
    if (!friend?.id) {
      console.warn("[useCallManager] ⚠️ Impossible d'envoyer le message d'appel manqué: friend invalide");
      return;
    }

    console.log(`[useCallManager] 📨 Envoi message d'appel manqué à ${friend.fullName || friend.id}`);

    // ✅ FORMAT CORRECT avec type "missed-call"
    const messageData = {
      recipientId: friend.id,
      content: `Appel ${callType === 'video' ? 'vidéo' : 'audio'} manqué`,
      type: "missed-call",  // ✅ Type valide
      metadata: {
        callType: callType,
        timestamp: new Date().toISOString()
      }
    };

    try {
      const sent = sendMessage(messageData);
      
      if (sent) {
        console.log("[useCallManager] ✅ Message d'appel manqué envoyé");
      } else {
        console.warn("[useCallManager] ⚠️ Échec de l'envoi du message d'appel manqué");
      }
    } catch (error) {
      console.error("[useCallManager] ❌ Erreur lors de l'envoi du message:", error);
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
    toneTimeoutRef,
    toneSynthRef,
    startCall,
    endCall,
    sendMissedCallMessage,
    cleanupCallRingtone
  };
}