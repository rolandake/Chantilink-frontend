// ============================================
// 📁 src/pages/Chat/hooks/useWebRTC.js
// FIXES:
//  - createPeerConnection n'était pas dans la portée correcte (code tronqué)
//  - stopLocalStream utilisait le state (stale closure) → utilise la ref
//  - startCall utilisait setTimeout fragile → callId attendu via event
//  - pendingCandidates non vidangés à la reconnexion
//  - cleanup appelait stopLocalStream (state stale) → appelle la ref
//  - handleOffer retournait tôt si !pcRef sans aucune log
//  - localStreamRef jamais synchronisé avec localStream state
// ============================================
import { useEffect, useRef, useState, useCallback } from "react";

const DEFAULT_ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun3.l.google.com:19302" },
  { urls: "stun:stun4.l.google.com:19302" },
];

export function useWebRTC(socket, selfId) {
  const [localStream,  setLocalStream]  = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [callState,    setCallState]    = useState("idle");
  const [isMuted,      setIsMuted]      = useState(false);
  const [isCameraOff,  setIsCameraOff]  = useState(false);
  const [error,        setError]        = useState(null);

  // ✅ Refs stables
  const localStreamRef       = useRef(null);
  const pcRef                = useRef(null);
  const callIdRef            = useRef(null);
  const remoteIdRef          = useRef(null);
  const pendingCandidatesRef = useRef([]);
  // ✅ FIX: garder une queue d'offers reçues avant que pcRef soit prêt
  const pendingOfferRef      = useRef(null);

  // ✅ FIX: synchroniser localStreamRef avec le state
  const updateLocalStream = useCallback((stream) => {
    localStreamRef.current = stream;
    setLocalStream(stream);
  }, []);

  // ───────────────────────────────────────────────────
  // 🔧 CRÉER LA PEER CONNECTION
  // ───────────────────────────────────────────────────
  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers: DEFAULT_ICE_SERVERS });

    pc.ontrack = (event) => {
      const [stream] = event.streams;
      if (stream) setRemoteStream(stream);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && remoteIdRef.current && callIdRef.current) {
        socket?.emit("ice-candidate", {
          callId:    callIdRef.current,
          to:        remoteIdRef.current,
          candidate: event.candidate,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.log("[WebRTC] connectionState:", state);
      if (state === "connected") {
        setCallState("connected");
      } else if (["failed", "disconnected", "closed"].includes(state)) {
        setCallState((prev) => (prev === "ended" ? prev : "failed"));
      }
    };

    // ✅ FIX: écouter iceconnectionstatechange aussi (meilleure compatibilité Safari)
    pc.oniceconnectionstatechange = () => {
      if (["failed", "disconnected"].includes(pc.iceConnectionState)) {
        console.warn("[WebRTC] ICE:", pc.iceConnectionState);
      }
    };

    return pc;
  }, [socket]);

  // ───────────────────────────────────────────────────
  // ✅ FIX: stopLocalStream utilise la REF (pas le state)
  // ───────────────────────────────────────────────────
  const stopLocalStream = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    }
  }, []);

  const cleanup = useCallback(() => {
    if (pcRef.current) {
      try { pcRef.current.close(); } catch { /* noop */ }
      pcRef.current = null;
    }
    stopLocalStream();
    setRemoteStream(null);
    setIsMuted(false);
    setIsCameraOff(false);
    setCallState("ended");
    setError(null);
    pendingCandidatesRef.current = [];
    pendingOfferRef.current      = null;
    callIdRef.current            = null;
    remoteIdRef.current          = null;
  }, [stopLocalStream]);

  // ───────────────────────────────────────────────────
  // 📞 APPEL SORTANT
  // ───────────────────────────────────────────────────
  const startCall = useCallback(async (remoteId, callType) => {
    try {
      setError(null);
      setCallState("calling");
      remoteIdRef.current = remoteId;

      // 1. Demander micro/caméra
      const constraints = {
        audio: true,
        video: callType === "video"
          ? { width: { ideal: 1280 }, height: { ideal: 720 } }
          : false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      updateLocalStream(stream);
      setIsCameraOff(callType !== "video");

      // 2. Peer connection + tracks
      const pc = createPeerConnection();
      pcRef.current = pc;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      // 3. Créer l'offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // 4. Initier via socket — le callId arrivera via "call-initiated"
      socket?.emit("initiate-call", { receiverId: remoteId, type: callType });

      // ✅ FIX: stocker l'offer, l'envoyer dès que callId est connu
      // via le handler "call-initiated" dans useSocketHandlers / Messages.jsx
      pendingOfferRef.current = { offer, remoteId };

    } catch (err) {
      console.error("[WebRTC] startCall error:", err);
      setError(err.message || "Erreur d'accès micro/caméra");
      setCallState("failed");
      cleanup();
    }
  }, [socket, createPeerConnection, updateLocalStream, cleanup]);

  // ✅ Méthode pour envoyer l'offer une fois le callId connu
  const flushPendingOffer = useCallback((callId) => {
    callIdRef.current = callId;
    const pending = pendingOfferRef.current;
    if (pending && pending.remoteId) {
      socket?.emit("webrtc-offer", {
        callId,
        to:    pending.remoteId,
        offer: pending.offer,
      });
      pendingOfferRef.current = null;
    }
  }, [socket]);

  // ───────────────────────────────────────────────────
  // 📞 APPEL ENTRANT — ACCEPTATION
  // ───────────────────────────────────────────────────
  const acceptIncomingCall = useCallback(async (callId, callerId, callType) => {
    try {
      setError(null);
      setCallState("connecting");
      callIdRef.current  = callId;
      remoteIdRef.current = callerId;

      const constraints = {
        audio: true,
        video: callType === "video"
          ? { width: { ideal: 1280 }, height: { ideal: 720 } }
          : false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      updateLocalStream(stream);
      setIsCameraOff(callType !== "video");

      const pc = createPeerConnection();
      pcRef.current = pc;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      socket?.emit("accept-call", { callId });

      // ✅ FIX: si une offer était déjà en attente, la traiter maintenant
      if (pendingOfferRef.current) {
        const { offer } = pendingOfferRef.current;
        pendingOfferRef.current = null;
        await handleOffer({ callId, from: callerId, offer });
      }

    } catch (err) {
      console.error("[WebRTC] acceptIncomingCall error:", err);
      setError(err.message || "Erreur d'accès micro/caméra");
      setCallState("failed");
      cleanup();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, createPeerConnection, updateLocalStream, cleanup]);

  // ───────────────────────────────────────────────────
  // 📨 RECEVOIR UNE OFFER
  // ───────────────────────────────────────────────────
  const handleOffer = useCallback(async ({ callId, from, offer }) => {
    try {
      callIdRef.current  = callId;
      remoteIdRef.current = from;

      // ✅ FIX: si pcRef pas encore prêt (race condition), mettre en attente
      if (!pcRef.current) {
        console.warn("[WebRTC] handleOffer: pcRef non prêt, mise en attente");
        pendingOfferRef.current = { offer, remoteId: from };
        return;
      }

      await pcRef.current.setRemoteDescription(new RTCSessionDescription(offer));

      // Vider les ICE candidats en attente
      for (const c of pendingCandidatesRef.current) {
        try {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(c));
        } catch (e) {
          console.warn("[WebRTC] ICE candidat en attente rejeté:", e.message);
        }
      }
      pendingCandidatesRef.current = [];

      const answer = await pcRef.current.createAnswer();
      await pcRef.current.setLocalDescription(answer);

      socket?.emit("webrtc-answer", { callId, to: from, answer });

    } catch (err) {
      console.error("[WebRTC] handleOffer error:", err);
      setError(err.message);
      setCallState("failed");
    }
  }, [socket]);

  // ───────────────────────────────────────────────────
  // 📨 RECEVOIR UNE ANSWER
  // ───────────────────────────────────────────────────
  const handleAnswer = useCallback(async ({ answer }) => {
    try {
      if (!pcRef.current) return;
      await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
      setCallState("connected");
    } catch (err) {
      console.error("[WebRTC] handleAnswer error:", err);
      setError(err.message);
    }
  }, []);

  // ───────────────────────────────────────────────────
  // 🧊 RECEVOIR UN ICE CANDIDATE
  // ───────────────────────────────────────────────────
  const handleIceCandidate = useCallback(async ({ candidate }) => {
    try {
      if (!candidate) return;
      if (!pcRef.current || !pcRef.current.remoteDescription) {
        pendingCandidatesRef.current.push(candidate);
        return;
      }
      await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.warn("[WebRTC] ICE candidate error:", err.message);
    }
  }, []);

  // ───────────────────────────────────────────────────
  // 📴 RACCROCHER
  // ───────────────────────────────────────────────────
  const endCall = useCallback(() => {
    const callId = callIdRef.current;
    if (callId) socket?.emit("end-call", { callId });
    cleanup();
  }, [socket, cleanup]);

  // ───────────────────────────────────────────────────
  // 🔇 MUTE / 📷 CAMÉRA
  // ───────────────────────────────────────────────────
  const toggleMute = useCallback(() => {
    // ✅ FIX: utiliser la ref
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach((t) => { t.enabled = !t.enabled; });
    setIsMuted((prev) => !prev);
  }, []);

  const toggleCamera = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const videoTracks = stream.getVideoTracks();
    if (videoTracks.length === 0) return;
    videoTracks.forEach((t) => { t.enabled = !t.enabled; });
    setIsCameraOff((prev) => !prev);
  }, []);

  // Nettoyage au démontage
  useEffect(() => {
    return () => { cleanup(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    localStream,
    remoteStream,
    callState,
    isMuted,
    isCameraOff,
    error,
    getCallId:   () => callIdRef.current,
    getRemoteId: () => remoteIdRef.current,
    startCall,
    acceptIncomingCall,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    endCall,
    toggleMute,
    toggleCamera,
    cleanup,
    flushPendingOffer,
    setCallId:    (id) => { callIdRef.current = id; },
    setRemoteId:  (id) => { remoteIdRef.current = id; },
    setCallState: (s)  => setCallState(s),
  };
}

export default useWebRTC;