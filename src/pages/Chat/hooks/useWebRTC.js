// ============================================
// 📁 src/pages/Chat/hooks/useWebRTC.js
// ✅ PHASE 5 — Hook WebRTC pour appels audio/vidéo
//    - getUserMedia (audio + optionnel video)
//    - RTCPeerConnection avec ICE servers (Google STUN publics)
//    - Gestion de l'état local + remote des streams
//    - Signaling via callbacks (à brancher sur le socket)
//    - Nettoyage automatique des ressources
// ============================================
import { useEffect, useRef, useState, useCallback } from "react";

// ICE servers publics (Google STUN gratuits + fallback)
// Pour les NAT symétriques complexes, il faudrait un TURN custom.
const DEFAULT_ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun3.l.google.com:19302" },
  { urls: "stun:stun4.l.google.com:19302" },
];

/**
 * Hook WebRTC
 * @param {Object} socket - Instance socket.io connectée sur /messages
 * @param {string} selfId - ID de l'utilisateur courant
 * @returns {Object} API complète pour gérer un appel
 */
export function useWebRTC(socket, selfId) {
  const [localStream,  setLocalStream]  = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [callState,    setCallState]    = useState("idle"); // idle | calling | ringing | connecting | connected | ended | failed
  const [isMuted,      setIsMuted]      = useState(false);
  const [isCameraOff,  setIsCameraOff]  = useState(false);
  const [error,        setError]        = useState(null);

  const pcRef      = useRef(null);   // RTCPeerConnection
  const callIdRef  = useRef(null);
  const remoteIdRef = useRef(null);
  const pendingCandidatesRef = useRef([]);

  // ========================================
  // 🔧 HELPERS
  // ========================================
  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers: DEFAULT_ICE_SERVERS });

    pc.ontrack = (event) => {
      const [stream] = event.streams;
      if (stream) setRemoteStream(stream);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && remoteIdRef.current && callIdRef.current) {
        socket?.emit("ice-candidate", {
          callId: callIdRef.current,
          to:     remoteIdRef.current,
          candidate: event.candidate,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.log("[WebRTC] connectionState:", state);
      if (state === "connected") setCallState("connected");
      else if (state === "failed" || state === "disconnected" || state === "closed") {
        setCallState((prev) => (prev === "ended" ? prev : "failed"));
      }
    };

    return pc;
  }, [socket]);

  const stopLocalStream = useCallback(() => {
    if (localStream) {
      localStream.getTracks().forEach((t) => t.stop());
      setLocalStream(null);
    }
  }, [localStream]);

  const cleanup = useCallback(() => {
    if (pcRef.current) {
      try { pcRef.current.close(); } catch (e) { /* noop */ }
      pcRef.current = null;
    }
    stopLocalStream();
    setRemoteStream(null);
    setIsMuted(false);
    setIsCameraOff(false);
    setCallState("ended");
    setError(null);
    pendingCandidatesRef.current = [];
  }, [stopLocalStream]);

  // ========================================
  // 📞 DÉMARRER UN APPEL SORTANT
  // ========================================
  const startCall = useCallback(async (remoteId, callType) => {
    try {
      setError(null);
      setCallState("calling");
      remoteIdRef.current = remoteId;

      // 1. Initier l'appel via socket (côté backend)
      socket?.emit("initiate-call", { receiverId: remoteId, type: callType });
      // Le callId sera set par le handler "call-initiated"

      // 2. Demander l'accès micro/caméra
      const constraints = {
        audio: true,
        video: callType === "video" ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);
      setIsCameraOff(callType !== "video");

      // 3. Créer le peer connection
      const pc = createPeerConnection();
      pcRef.current = pc;

      // 4. Ajouter les tracks locaux
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      // 5. Créer l'offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // 6. Envoyer l'offer via socket (sera envoyé quand callId connu)
      // On attend que callIdRef soit set par "call-initiated"
      setTimeout(() => {
        if (callIdRef.current && remoteId) {
          socket?.emit("webrtc-offer", {
            callId: callIdRef.current,
            to:     remoteId,
            offer,
          });
        } else {
          // Retry après 500ms
          setTimeout(() => {
            if (callIdRef.current && remoteId) {
              socket?.emit("webrtc-offer", {
                callId: callIdRef.current,
                to:     remoteId,
                offer,
              });
            }
          }, 500);
        }
      }, 100);

    } catch (err) {
      console.error("[WebRTC] startCall error:", err);
      setError(err.message || "Erreur d'accès micro/caméra");
      setCallState("failed");
      cleanup();
    }
  }, [socket, createPeerConnection, cleanup]);

  // ========================================
  // 📞 ACCEPTER UN APPEL ENTRANT
  // ========================================
  const acceptIncomingCall = useCallback(async (callId, callerId, callType) => {
    try {
      setError(null);
      setCallState("connecting");
      callIdRef.current = callId;
      remoteIdRef.current = callerId;

      // 1. Demander l'accès micro/caméra
      const constraints = {
        audio: true,
        video: callType === "video" ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);
      setIsCameraOff(callType !== "video");

      // 2. Créer le peer connection
      const pc = createPeerConnection();
      pcRef.current = pc;

      // 3. Ajouter les tracks locaux
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      // 4. Notifier le backend qu'on accepte
      socket?.emit("accept-call", { callId });

      // Note : l'offer WebRTC sera reçue ensuite via "webrtc-offer"
      // Le caller initie après que le receiver ait accepté
    } catch (err) {
      console.error("[WebRTC] acceptIncomingCall error:", err);
      setError(err.message || "Erreur d'accès micro/caméra");
      setCallState("failed");
      cleanup();
    }
  }, [socket, createPeerConnection, cleanup]);

  // ========================================
  // 📨 RECEVOIR UNE OFFER (après acceptation)
  // ========================================
  const handleOffer = useCallback(async ({ callId, from, offer }) => {
    try {
      callIdRef.current = callId;
      remoteIdRef.current = from;

      if (!pcRef.current) {
        // Receveur : on reçoit l'offer APRÈS avoir accepté
        // Le peer connection doit déjà être créé via acceptIncomingCall
        return;
      }

      await pcRef.current.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pcRef.current.createAnswer();
      await pcRef.current.setLocalDescription(answer);

      socket?.emit("webrtc-answer", {
        callId,
        to: from,
        answer,
      });

      // Envoyer les ICE candidats en attente
      pendingCandidatesRef.current.forEach((c) => {
        socket?.emit("ice-candidate", { callId, to: from, candidate: c });
      });
      pendingCandidatesRef.current = [];
    } catch (err) {
      console.error("[WebRTC] handleOffer error:", err);
      setError(err.message);
      setCallState("failed");
    }
  }, [socket]);

  // ========================================
  // 📨 RECEVOIR UNE ANSWER
  // ========================================
  const handleAnswer = useCallback(async ({ from, answer }) => {
    try {
      if (!pcRef.current) return;
      await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
      setCallState("connected");
    } catch (err) {
      console.error("[WebRTC] handleAnswer error:", err);
      setError(err.message);
    }
  }, []);

  // ========================================
  // 🧊 RECEVOIR UN ICE CANDIDATE
  // ========================================
  const handleIceCandidate = useCallback(async ({ candidate }) => {
    try {
      if (!pcRef.current || !candidate) return;
      // Si remoteDescription n'est pas encore set, on bufferise
      if (!pcRef.current.remoteDescription) {
        pendingCandidatesRef.current.push(candidate);
        return;
      }
      await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.warn("[WebRTC] ICE candidate error:", err);
    }
  }, []);

  // ========================================
  // 📴 RACCROCHER
  // ========================================
  const endCall = useCallback(() => {
    const callId = callIdRef.current;
    if (callId) {
      socket?.emit("end-call", { callId });
    }
    cleanup();
  }, [socket, cleanup]);

  // ========================================
  // 🔇 MUTE / UNMUTE MICRO
  // ========================================
  const toggleMute = useCallback(() => {
    if (localStream) {
      const audioTracks = localStream.getAudioTracks();
      audioTracks.forEach((t) => {
        t.enabled = !t.enabled;
      });
      setIsMuted((prev) => !prev);
    }
  }, [localStream]);

  // ========================================
  // 📷 ON / OFF CAMÉRA
  // ========================================
  const toggleCamera = useCallback(() => {
    if (localStream) {
      const videoTracks = localStream.getVideoTracks();
      if (videoTracks.length === 0) return;
      videoTracks.forEach((t) => {
        t.enabled = !t.enabled;
      });
      setIsCameraOff((prev) => !prev);
    }
  }, [localStream]);

  // ========================================
  // 🎯 SETTERS EXTERNES
  // ========================================
  const setCallId    = useCallback((id) => { callIdRef.current = id; }, []);
  const setRemoteId  = useCallback((id) => { remoteIdRef.current = id; }, []);
  const setState     = useCallback((s) => setCallState(s), []);

  // Cleanup au démontage du composant
  useEffect(() => {
    return () => {
      cleanup();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    // State
    localStream,
    remoteStream,
    callState,
    isMuted,
    isCameraOff,
    error,

    // Refs accessors
    getCallId:   () => callIdRef.current,
    getRemoteId: () => remoteIdRef.current,

    // Actions
    startCall,
    acceptIncomingCall,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    endCall,
    toggleMute,
    toggleCamera,
    cleanup,

    // Setters
    setCallId,
    setRemoteId,
    setCallState: setState,
  };
}

export default useWebRTC;
