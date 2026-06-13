// ============================================
// 📁 src/pages/Chat/hooks/useCallManager.js  v2
// ─ Sonnerie appelant (CallerRingtone)
// ─ Sonnerie appelé  (CallRingtone) déclenchée par le composant parent
// ─ Timeout 30 s → appel manqué automatique
// ─ Notification onglet arrière-plan (Page Visibility + titre)
// ─ Historique des appels manqués persisté en state
// ─ endCall lit le callId depuis une ref (pas de stale closure)
// ============================================
import { useState, useCallback, useRef, useEffect } from "react";
import {
  CallerRingtone,
  playCallConnectedSound,
  playCallEndedSound,
  playCallRejectedSound,
  startTabCallAlert,
  stopTabCallAlert,
  stopVibration,
} from "../../../utils/callSounds";

const RING_TIMEOUT_MS = 30_000; // 30 secondes avant appel manqué

export function useCallManager(
  sel,
  connected,
  initiateCall,
  socketEndCall,
  sendMessage,
  showToast
) {
  // ── État appel actif ────────────────────────────────────────────────────
  const [call, setCall] = useState({
    on: false, type: null, friend: null,
    mute: false, video: true, isIncoming: false, callId: null,
  });

  // ── État appel entrant ──────────────────────────────────────────────────
  const [incomingCall, setIncomingCall] = useState(null);

  // ── Historique des appels manqués ───────────────────────────────────────
  const [missedCalls, setMissedCalls] = useState([]);
  // Notification passagère (compatible avec l'ancienne API)
  const [missedCallNotification, setMissedCallNotification] = useState(null);

  // ── Refs ────────────────────────────────────────────────────────────────
  const callIdRef       = useRef(null);
  const callerRingRef   = useRef(null); // sonnerie côté appelant
  const ringTimeoutRef  = useRef(null); // timer 30 s
  const isDisposedRef   = useRef(false);

  // ─── setCall + sync ref ─────────────────────────────────────────────────
  const setCallWithRef = useCallback((updater) => {
    setCall((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      callIdRef.current = next.callId ?? null;
      return next;
    });
  }, []);

  // ─── Arrêter la sonnerie appelant ────────────────────────────────────────
  const stopCallerRing = useCallback(() => {
    if (callerRingRef.current) {
      callerRingRef.current.stop();
      callerRingRef.current = null;
    }
    if (ringTimeoutRef.current) {
      clearTimeout(ringTimeoutRef.current);
      ringTimeoutRef.current = null;
    }
  }, []);

  // ─── Arrêter la sonnerie appelé (gérée côté parent via CallRingtone) ───
  // Le parent passe cleanupCallRingtone — ici on expose stopCallerRing
  const cleanupCallRingtone = useCallback(() => {
    stopCallerRing();
    stopTabCallAlert();
    stopVibration();
  }, [stopCallerRing]);

  // ─── DÉMARRER UN APPEL ───────────────────────────────────────────────────
  const startCall = useCallback((callType) => {
    if (call.on) { showToast("Un appel est déjà en cours", "warning"); return; }
    if (!sel?.friend || !connected) {
      showToast("Impossible d'établir la connexion", "error");
      return;
    }

    const success = initiateCall(sel.friend.id, callType);
    if (!success) { showToast("Service d'appel indisponible", "error"); return; }

    // ── Sonnerie appelant ──
    const ring = new CallerRingtone();
    ring.start();
    callerRingRef.current = ring;
    isDisposedRef.current = false;

    setCallWithRef({
      on: true, type: callType, friend: sel.friend,
      mute: false, video: callType === "video", isIncoming: false, callId: null,
    });

    // ── Timeout 30 s : appel sans réponse ──
    ringTimeoutRef.current = setTimeout(() => {
      stopCallerRing();
      try { playCallRejectedSound(); } catch {}
      showToast("Appel sans réponse", "info");
      // Enregistrer appel manqué côté appelant aussi
      addMissedCall(sel.friend, callType, "outgoing");
      // Terminer l'appel proprement
      if (callIdRef.current) socketEndCall(callIdRef.current);
      setCallWithRef({
        on: false, type: null, friend: null,
        mute: false, video: true, isIncoming: false, callId: null,
      });
    }, RING_TIMEOUT_MS);
  }, [call.on, sel?.friend, connected, initiateCall, showToast,
      stopCallerRing, socketEndCall, setCallWithRef]);

  // ─── CALL ACCEPTÉ (appelant reçoit la confirmation) ─────────────────────
  const onCallAccepted = useCallback((callId) => {
    stopCallerRing(); // stopper la sonnerie dès que c'est décroché
    try { playCallConnectedSound(); } catch {}
    setCallWithRef((prev) => ({ ...prev, on: true, callId: callId || prev.callId }));
  }, [stopCallerRing, setCallWithRef]);

  // ─── TERMINER L'APPEL ────────────────────────────────────────────────────
  const endCall = useCallback(() => {
    const id = callIdRef.current;
    if (id) socketEndCall(id);
    cleanupCallRingtone();
    try { playCallEndedSound(); } catch {}
    callIdRef.current = null;
    setCall({
      on: false, type: null, friend: null,
      mute: false, video: true, isIncoming: false, callId: null,
    });
  }, [socketEndCall, cleanupCallRingtone]);

  // ─── AJOUTER UN APPEL MANQUÉ ─────────────────────────────────────────────
  const addMissedCall = useCallback((friend, callType, direction = "incoming") => {
    const entry = {
      id:        `missed-${Date.now()}`,
      friend,
      callType,
      direction, // "incoming" | "outgoing"
      timestamp: new Date().toISOString(),
    };
    setMissedCalls((prev) => [entry, ...prev].slice(0, 50)); // max 50
    setMissedCallNotification(entry);
    setTimeout(() => setMissedCallNotification(null), 6000);
  }, []);

  // ─── NOTIFICATION APPEL MANQUÉ → message socket ──────────────────────────
  const sendMissedCallMessage = useCallback((friend, callType = "audio") => {
    if (!friend?.id || typeof sendMessage !== "function") return;
    try {
      sendMessage({
        recipientId: friend.id,
        content:     `Appel ${callType === "video" ? "vidéo" : "audio"} manqué`,
        type:        "missed-call",
        metadata:    { callType, timestamp: new Date().toISOString(), isPrivate: true },
      });
    } catch (e) {
      console.error("[CallManager] sendMissedCallMessage:", e);
    }
    addMissedCall(friend, callType, "incoming");
  }, [sendMessage, addMissedCall]);

  // ─── Effacer un appel manqué de la liste ─────────────────────────────────
  const dismissMissedCall = useCallback((id) => {
    setMissedCalls((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const clearAllMissedCalls = useCallback(() => setMissedCalls([]), []);

  // ─── Cleanup au démontage ─────────────────────────────────────────────────
  useEffect(() => () => {
    cleanupCallRingtone();
  }, [cleanupCallRingtone]);

  return {
    call,
    setCall:      setCallWithRef,
    callIdRef,
    incomingCall,
    setIncomingCall,
    missedCalls,
    missedCallNotification,
    setMissedCallNotification,
    startCall,
    onCallAccepted,
    endCall,
    sendMissedCallMessage,
    addMissedCall,
    dismissMissedCall,
    clearAllMissedCalls,
    cleanupCallRingtone,
  };
}