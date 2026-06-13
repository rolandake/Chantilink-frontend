// ============================================
// 📁 src/components/CallManager.jsx
//
// Wrapper entre Messages.jsx et CallModal.jsx.
// Gère :
//   - WebRTC (useWebRTC hook) → localStream, remoteStream, callState
//   - Signaling socket (webrtc-offer, webrtc-answer, ice-candidate)
//   - Transmission de l'offer quand callId est connu (call-initiated)
//   - Contrôles mute / caméra délégués au hook WebRTC
//   - Rendu via <CallModal />
//
// Props reçues depuis Messages.jsx :
//   call         : { on, type, friend, mute, video, isIncoming, callId }
//   onEndCall    : () => void
//   onToggleMute : () => void   (met à jour call.mute dans Messages)
//   onToggleVideo: () => void   (met à jour call.video dans Messages)
//   socket       : Socket.IO instance
// ============================================
import React, { useEffect, useCallback } from "react";
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
  } = useWebRTC(socket, null /* selfId géré côté serveur */);

  const friend    = call?.friend;
  const callId    = call?.callId;
  const callType  = call?.type  || "audio";
  const isIncoming = call?.isIncoming ?? false;

  // ── Démarrer ou accepter selon le sens de l'appel ──────────────────────
  useEffect(() => {
    if (!call?.on) return;

    if (isIncoming) {
      // Côté appelé : on a déjà émis accept-call depuis Messages.jsx
      // → préparer le peer connection en attente de l'offer WebRTC
      if (callId && friend?.id) {
        rtcAcceptCall(callId, friend.id, callType).catch(console.error);
      }
    } else {
      // Côté appelant : lancer getUserMedia + créer l'offer
      if (friend?.id) {
        rtcStartCall(friend.id, callType).catch(console.error);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call?.on]);

  // ── Quand callId devient connu (call-initiated côté appelant) ──────────
  useEffect(() => {
    if (callId && !isIncoming) {
      setCallId(callId);
      flushPendingOffer(callId); // envoie l'offer qui attendait le callId
    }
  }, [callId, isIncoming, setCallId, flushPendingOffer]);

  // ── Signaling WebRTC via socket ────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const onOffer     = (data) => handleOffer(data);
    const onAnswer    = (data) => handleAnswer(data);
    const onIce       = (data) => handleIceCandidate(data);

    socket.on("webrtc-offer",  onOffer);
    socket.on("webrtc-answer", onAnswer);
    socket.on("ice-candidate", onIce);

    return () => {
      socket.off("webrtc-offer",  onOffer);
      socket.off("webrtc-answer", onAnswer);
      socket.off("ice-candidate", onIce);
    };
  }, [socket, handleOffer, handleAnswer, handleIceCandidate]);

  // ── Raccrocher ─────────────────────────────────────────────────────────
  const handleEnd = useCallback(() => {
    rtcEndCall();   // ferme PeerConnection + arrête les tracks
    onEndCall?.();  // met à jour call.on dans Messages.jsx
  }, [rtcEndCall, onEndCall]);

  // ── Mute (WebRTC track + état UI) ─────────────────────────────────────
  const handleToggleMute = useCallback(() => {
    rtcToggleMute();  // active/désactive l'audioTrack
    onToggleMute?.(); // met à jour call.mute dans Messages.jsx
  }, [rtcToggleMute, onToggleMute]);

  // ── Caméra ─────────────────────────────────────────────────────────────
  const handleToggleCamera = useCallback(() => {
    rtcToggleCamera();  // active/désactive le videoTrack
    onToggleVideo?.();  // met à jour call.video dans Messages.jsx
  }, [rtcToggleCamera, onToggleVideo]);

  // ── Nettoyage si appel terminé de l'extérieur (call.on → false) ───────
  useEffect(() => {
    if (!call?.on) {
      rtcEndCall();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call?.on]);

  if (!call?.on) return null;

  return (
    <CallModal
      open         = {call.on}
      callType     = {callType}
      remoteUser   = {friend}
      callState    = {callState}
      localStream  = {localStream}
      remoteStream = {remoteStream}
      isMuted      = {isMuted}
      isCameraOff  = {isCameraOff}
      error        = {error}
      onToggleMute   = {handleToggleMute}
      onToggleCamera = {handleToggleCamera}
      onEnd          = {handleEnd}
    />
  );
}