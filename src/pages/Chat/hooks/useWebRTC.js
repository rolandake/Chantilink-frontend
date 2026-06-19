// ============================================
// src/pages/Chat/hooks/useWebRTC.js
// FIXES:
//  - flushPendingOffer : envoie l'offer stockée dès que callId est connu
//    (l'offer est créée dans startCall AVANT que callId arrive via "call-initiated")
//  - stopLocalStream utilise la ref (pas le state stale)
//  - pendingCandidates vidangés correctement après setRemoteDescription
//  - handleOffer : mise en attente si pcRef pas encore prêt (race condition)
//  - updateLocalStream synchronise ref + state ensemble
//  - setCallId exposé pour permettre à CallManager de mettre à jour callIdRef
// ============================================
import { useEffect, useRef, useState, useCallback } from "react";

const DEFAULT_ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302"  },
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

  // ── Refs stables (anti stale-closure) ────────────────────────────────────
  const localStreamRef       = useRef(null);
  const pcRef                = useRef(null);
  const callIdRef            = useRef(null);
  const remoteIdRef          = useRef(null);
  const pendingCandidatesRef = useRef([]);
  // ✅ Stocke l'offer en attente du callId
  const pendingOfferRef      = useRef(null);

  // ── Synchroniser ref + state ──────────────────────────────────────────────
  const updateLocalStream = useCallback((stream) => {
    localStreamRef.current = stream;
    setLocalStream(stream);
  }, []);

  // ──────────────────────────────────────────────────────────────────────────
  // 🔧 CRÉER LA PEER CONNECTION
  // ──────────────────────────────────────────────────────────────────────────
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

    pc.oniceconnectionstatechange = () => {
      const s = pc.iceConnectionState;
      if (["failed", "disconnected"].includes(s)) {
        console.warn("[WebRTC] ICE:", s);
      }
    };

    return pc;
  }, [socket]);

  // ──────────────────────────────────────────────────────────────────────────
  // ✅ stopLocalStream utilise la REF (pas le state)
  // ──────────────────────────────────────────────────────────────────────────
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

  // ──────────────────────────────────────────────────────────────────────────
  // 📞 APPEL SORTANT
  // Crée la PeerConnection + offer, les stocke dans pendingOfferRef.
  // L'offer ne sera envoyée que quand flushPendingOffer(callId) est appelé.
  // ──────────────────────────────────────────────────────────────────────────
  const startCall = useCallback(async (remoteId, callType) => {
    try {
      setError(null);
      setCallState("calling");
      remoteIdRef.current = String(remoteId).trim();

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

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // ✅ Stocker l'offer en attente du callId
      pendingOfferRef.current = { offer, remoteId: remoteIdRef.current };

      console.log("[WebRTC] startCall: offer créée, en attente de callId via call-initiated");

      // L'événement "initiate-call" est émis par CallManager (pas ici)
      // pour éviter la double émission. Si CallManager veut qu'on l'émette :
      // socket?.emit("initiate-call", { receiverId: remoteId, type: callType });
      // → déjà fait dans useCallManager.startCall, donc on n'émet pas ici.

    } catch (err) {
      console.error("[WebRTC] startCall error:", err);
      setError(err.message || "Erreur d'accès micro/caméra");
      setCallState("failed");
      cleanup();
    }
  }, [createPeerConnection, updateLocalStream, cleanup]);

  // ──────────────────────────────────────────────────────────────────────────
  // ✅ flushPendingOffer : appelé par CallManager quand "call-initiated" arrive
  // ──────────────────────────────────────────────────────────────────────────
  const flushPendingOffer = useCallback((callId) => {
    callIdRef.current = String(callId).trim();
    const pending = pendingOfferRef.current;
    if (!pending) {
      console.warn("[WebRTC] flushPendingOffer: aucune offer en attente");
      return;
    }
    console.log(`[WebRTC] flushPendingOffer: envoi offer vers ${pending.remoteId} (callId: ${callId})`);
    socket?.emit("webrtc-offer", {
      callId:   callIdRef.current,
      to:       pending.remoteId,
      offer:    pending.offer,
    });
    pendingOfferRef.current = null;
  }, [socket]);

  // ──────────────────────────────────────────────────────────────────────────
  // 📞 APPEL ENTRANT — ACCEPTATION
  // ──────────────────────────────────────────────────────────────────────────
  const acceptIncomingCall = useCallback(async (callId, callerId, callType) => {
    try {
      setError(null);
      setCallState("connecting");
      callIdRef.current   = String(callId).trim();
      remoteIdRef.current = String(callerId).trim();

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

      console.log("[WebRTC] acceptIncomingCall: PC prête, en attente de l'offer WebRTC");

      // Si une offer était déjà arrivée avant que la PC soit prête
      if (pendingOfferRef.current) {
        const { offer } = pendingOfferRef.current;
        pendingOfferRef.current = null;
        // Traiter l'offer immédiatement
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        for (const c of pendingCandidatesRef.current) {
          try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch { /* noop */ }
        }
        pendingCandidatesRef.current = [];
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket?.emit("webrtc-answer", {
          callId: callIdRef.current,
          to:     remoteIdRef.current,
          answer,
        });
      }

    } catch (err) {
      console.error("[WebRTC] acceptIncomingCall error:", err);
      setError(err.message || "Erreur d'accès micro/caméra");
      setCallState("failed");
      cleanup();
    }
  }, [socket, createPeerConnection, updateLocalStream, cleanup]);

  // ──────────────────────────────────────────────────────────────────────────
  // 📨 RECEVOIR UNE OFFER (côté appelé)
  // ──────────────────────────────────────────────────────────────────────────
  const handleOffer = useCallback(async ({ callId, from, offer }) => {
    try {
      if (callId) callIdRef.current   = String(callId).trim();
      if (from)   remoteIdRef.current = String(from).trim();

      // ✅ PC pas encore prête (race condition) → stocker pour plus tard
      if (!pcRef.current) {
        console.warn("[WebRTC] handleOffer: pcRef non prêt, mise en attente");
        pendingOfferRef.current = { offer, remoteId: remoteIdRef.current };
        return;
      }

      await pcRef.current.setRemoteDescription(new RTCSessionDescription(offer));

      // Vider les candidats en attente
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

      socket?.emit("webrtc-answer", {
        callId: callIdRef.current,
        to:     remoteIdRef.current,
        answer,
      });

      console.log("[WebRTC] handleOffer: answer envoyée");
    } catch (err) {
      console.error("[WebRTC] handleOffer error:", err);
      setError(err.message);
      setCallState("failed");
    }
  }, [socket]);

  // ──────────────────────────────────────────────────────────────────────────
  // 📨 RECEVOIR UNE ANSWER (côté appelant)
  // ──────────────────────────────────────────────────────────────────────────
  const handleAnswer = useCallback(async ({ answer }) => {
    try {
      if (!pcRef.current) return;
      await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
      setCallState("connected");
      console.log("[WebRTC] handleAnswer: connexion établie");
    } catch (err) {
      console.error("[WebRTC] handleAnswer error:", err);
      setError(err.message);
    }
  }, []);

  // ──────────────────────────────────────────────────────────────────────────
  // 🧊 RECEVOIR UN ICE CANDIDATE
  // ──────────────────────────────────────────────────────────────────────────
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

  // ──────────────────────────────────────────────────────────────────────────
  // 📴 RACCROCHER
  // ──────────────────────────────────────────────────────────────────────────
  const endCall = useCallback(() => {
    const callId = callIdRef.current;
    if (callId) socket?.emit("end-call", { callId });
    cleanup();
  }, [socket, cleanup]);

  // ──────────────────────────────────────────────────────────────────────────
  // 🔇 MUTE / 📷 CAMÉRA (utilise la ref, pas le state)
  // ──────────────────────────────────────────────────────────────────────────
  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach((t) => { t.enabled = !t.enabled; });
    setIsMuted((prev) => !prev);
  }, []);

  const toggleCamera = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const videoTracks = stream.getVideoTracks();
    if (!videoTracks.length) return;
    videoTracks.forEach((t) => { t.enabled = !t.enabled; });
    setIsCameraOff((prev) => !prev);
  }, []);

  // Cleanup au démontage
  useEffect(() => () => { cleanup(); }, [cleanup]);

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
    // ✅ Exposés pour CallManager
    setCallId:    (id) => { callIdRef.current   = String(id).trim(); },
    setRemoteId:  (id) => { remoteIdRef.current = String(id).trim(); },
    setCallState: (s)  => setCallState(s),
  };
}

export default useWebRTC;