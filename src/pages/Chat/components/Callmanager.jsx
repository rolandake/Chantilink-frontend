// ============================================
// 📁 src/components/CallManager.jsx
// FIXES:
//  - useEffect call.on : guards hasStartedRef/hasAcceptedRef pour éviter
//    les doubles appels à rtcStartCall / rtcAcceptCall
//  - flushPendingOffer : appelé dès que callId devient connu (call-initiated)
//  - Écoute "webrtc-offer", "webrtc-answer", "ice-candidate" ici
//  - Cleanup rtcEndCall quand call.on → false (appel terminé extérieur)
//
// Wrapper entre Messages.jsx et CallModal.jsx.
// Props reçues depuis Messages.jsx :
//   call         : { on, type, friend, mute, video, isIncoming, callId }
//   onEndCall    : () => void
//   onToggleMute : () => void
//   onToggleVideo: () => void
//   socket       : Socket.IO instance
// ============================================
import React, { useEffect, useRef, useCallback } from "react";
import { useWebRTC } from "../pages/Chat/hooks/useWebRTC";
import CallModal     from "../pages/Chat/components/CallModal";

export default function CallManager({
  call,
  onEndCall,
  onToggleMute,
  onToggleVideo,
  socket,
}) {
  const {
    localStream,
    remoteStream,
    callState,
    isMuted,
    isCameraOff,
    error,
    startCall:          rtcStartCall,
    acceptIncomingCall: rtcAcceptCall,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    endCall:            rtcEndCall,
    toggleMute:         rtcToggleMute,
    toggleCamera:       rtcToggleCamera,
    flushPendingOffer,
    setCallId,
  } = useWebRTC(socket, null);

  const friend     = call?.friend;
  const callId     = call?.callId;
  const callType   = call?.type  || "audio";
  const isIncoming = call?.isIncoming ?? false;

  // ✅ Guards pour éviter les doubles déclenchements WebRTC
  const hasStartedRef  = useRef(false);
  const hasAcceptedRef = useRef(false);
  const prevCallOn     = useRef(false);

  // ── Démarrer ou accepter selon le sens de l'appel ──────────────────────
  // ✅ FIX : guard hasStartedRef/hasAcceptedRef pour éviter les doubles appels
  useEffect(() => {
    if (!call?.on) {
      // Réinitialiser les guards quand l'appel se termine
      hasStartedRef.current  = false;
      hasAcceptedRef.current = false;
      prevCallOn.current     = false;
      return;
    }

    // Ne déclencher qu'au passage false → true
    if (prevCallOn.current) return;
    prevCallOn.current = true;

    if (isIncoming) {
      // Côté appelé : préparer la PeerConnection en attente de l'offer WebRTC
      if (!hasAcceptedRef.current && callId && friend?.id) {
        hasAcceptedRef.current = true;
        rtcAcceptCall(callId, friend.id, callType).catch(console.error);
      }
    } else {
      // Côté appelant : getUserMedia + créer l'offer (stockée dans pendingOfferRef)
      if (!hasStartedRef.current && friend?.id) {
        hasStartedRef.current = true;
        rtcStartCall(friend.id, callType).catch(console.error);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call?.on]);

  // ✅ FIX : côté appelé, si callId arrive après que call.on soit déjà true
  // (race condition : call.on=true mais callId=null au premier render)
  useEffect(() => {
    if (!call?.on || !isIncoming || !callId || !friend?.id) return;
    if (hasAcceptedRef.current) return;
    hasAcceptedRef.current = true;
    setCallId(callId);
    rtcAcceptCall(callId, friend.id, callType).catch(console.error);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callId, isIncoming, call?.on]);

  // ✅ FIX PRINCIPAL : quand callId devient connu côté appelant → envoyer l'offer
  useEffect(() => {
    if (!callId || isIncoming) return;
    setCallId(callId);
    flushPendingOffer(callId);
  }, [callId, isIncoming, setCallId, flushPendingOffer]);

  // ── Signaling WebRTC via socket ────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const onOffer  = (data) => handleOffer(data);
    const onAnswer = (data) => handleAnswer(data);
    const onIce    = (data) => handleIceCandidate(data);

    socket.on("webrtc-offer",  onOffer);
    socket.on("webrtc-answer", onAnswer);
    socket.on("ice-candidate", onIce);

    return () => {
      socket.off("webrtc-offer",  onOffer);
      socket.off("webrtc-answer", onAnswer);
      socket.off("ice-candidate", onIce);
    };
  }, [socket, handleOffer, handleAnswer, handleIceCandidate]);

  // ── Nettoyage si appel terminé de l'extérieur (call.on → false) ───────
  useEffect(() => {
    if (!call?.on) {
      rtcEndCall();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call?.on]);

  // ── Raccrocher ─────────────────────────────────────────────────────────
  const handleEnd = useCallback(() => {
    rtcEndCall();
    onEndCall?.();
  }, [rtcEndCall, onEndCall]);

  // ── Mute ───────────────────────────────────────────────────────────────
  const handleToggleMute = useCallback(() => {
    rtcToggleMute();
    onToggleMute?.();
  }, [rtcToggleMute, onToggleMute]);

  // ── Caméra ─────────────────────────────────────────────────────────────
  const handleToggleCamera = useCallback(() => {
    rtcToggleCamera();
    onToggleVideo?.();
  }, [rtcToggleCamera, onToggleVideo]);

  if (!call?.on) return null;

  return (
    <CallModal
      open           = {call.on}
      callType       = {callType}
      remoteUser     = {friend}
      callState      = {callState}
      localStream    = {localStream}
      remoteStream   = {remoteStream}
      isMuted        = {isMuted}
      isCameraOff    = {isCameraOff}
      error          = {error}
      onToggleMute   = {handleToggleMute}
      onToggleCamera = {handleToggleCamera}
      onEnd          = {handleEnd}
    />
  );
}