// src/components/CallManager.jsx - VERSION FINALE CORRIGÉE v2
// FIXES:
//  - ✅ BUG PRINCIPAL : `if (!call.on || call.isIncoming) return null;` empêchait
//    TOUT affichage côté receveur de l'appel. Le composant ne gérait QUE les
//    appels sortants. Maintenant gère les deux sens.
//  - ✅ Events alignés sur backend/sockets/callSocket.js : "webrtc-offer",
//    "webrtc-answer", "ice-candidate" (callId inclus), pas "call-offer"/"call-answer"
//    qui n'existent pas côté serveur (callSocket.js n'écoute pas ces events).
//  - ✅ Pour un appel entrant accepté : envoie "accept-call" puis attend l'offer
//    WebRTC, répond avec "webrtc-answer".
//  - ✅ Pour un appel sortant : crée l'offer après avoir reçu "call-initiated"
//    (callId connu), comme attendu par callSocket.js.
//  - ✅ Guards anti double-déclenchement (hasStartedRef / hasAcceptedRef).
//  - ✅ Cleanup propre du peerConnection + stream au démontage / fin d'appel.
import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Mic, MicOff, Camera, CameraOff, PhoneOff } from "lucide-react";
import { useToast } from "../context/ToastContext";

const CallManager = ({ call, onEndCall, onToggleMute, onToggleVideo, socket }) => {
  const { showToast } = useToast();

  const [stream, setStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [callDuration, setCallDuration] = useState(0);
  const localVideoRef     = useRef(null);
  const remoteVideoRef    = useRef(null);
  const peerConnectionRef = useRef(null);
  const callIdRef         = useRef(call?.callId || null);
  const pendingCandidatesRef = useRef([]);
  const durationTimerRef = useRef(null);
  const callStartTimeRef = useRef(null);

  // ✅ Guards anti double-déclenchement
  const hasStartedRef  = useRef(false);
  const hasAcceptedRef = useRef(false);
  const prevCallOnRef  = useRef(false);

  // ── Format durée en MM:SS ────────────────────────────────────────────────
  const formatDuration = useCallback((seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }, []);

  const ICE_SERVERS = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

  // ── Sync callId externe → ref ──────────────────────────────────────────
  useEffect(() => {
    if (call?.callId) callIdRef.current = call.callId;
  }, [call?.callId]);

  useEffect(() => {
    if (!stream) return;
    stream.getAudioTracks().forEach((track) => {
      track.enabled = !call.mute;
    });
    stream.getVideoTracks().forEach((track) => {
      track.enabled = !!call.video;
    });
  }, [stream, call.mute, call.video]);

  // ── Créer une PeerConnection commune (appelant + appelé) ───────────────
  const createPeerConnection = useCallback((mediaStream, remoteUserId) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnectionRef.current = pc;

    mediaStream.getTracks().forEach((t) => pc.addTrack(t, mediaStream));

    pc.ontrack = (e) => {
      console.log("📡 [CallManager] Flux distant reçu !");
      setRemoteStream(e.streams[0]);
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0];
    };

    pc.onicecandidate = (e) => {
      if (e.candidate && socket && callIdRef.current && remoteUserId) {
        socket.emit("ice-candidate", {
          callId:    callIdRef.current,
          to:        remoteUserId,
          candidate: e.candidate,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log("[CallManager] connectionState:", pc.connectionState);
    };

    return pc;
  }, [socket]);

  // ════════════════════════════════════════════════════════════════════
  // 1. DÉMARRAGE — distingue appel SORTANT vs ENTRANT
  // ════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!socket || !socket.connected) return;
    if (!call?.on) {
      hasStartedRef.current  = false;
      hasAcceptedRef.current = false;
      prevCallOnRef.current  = false;
      return;
    }
    // Ne déclencher qu'au passage false → true
    if (prevCallOnRef.current) return;
    prevCallOnRef.current = true;

    const friendId = call.friend?.id;
    if (!friendId) return;

    // ──────────────────────────────────────────────────────────────
    // ✅ APPEL SORTANT (call.isIncoming === false)
    // ──────────────────────────────────────────────────────────────
    const startOutgoingCall = async () => {
      if (hasStartedRef.current) return;
      hasStartedRef.current = true;
      try {
        console.log("📞 [CallManager] Démarrage appel sortant vers", friendId);
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: call.video,
          audio: true,
        });
        setStream(mediaStream);
        if (localVideoRef.current) localVideoRef.current.srcObject = mediaStream;

        const pc = createPeerConnection(mediaStream, friendId);

        // L'offer ne peut être envoyée qu'une fois le callId connu
        // (émis par le serveur via "call-initiated" après "initiate-call")
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        // Si callId déjà connu (rare, mais possible), envoyer tout de suite
        if (callIdRef.current) {
          socket.emit("webrtc-offer", { callId: callIdRef.current, to: friendId, offer });
        } else {
          // Sinon stocker en attente — sera flush par le listener "call-initiated" plus bas
          pendingOfferRef.current = { offer, to: friendId };
        }
      } catch (err) {
        console.error("[CallManager] Erreur démarrage appel:", err);
        showToast("Impossible d'accéder à la caméra/micro", "error");
        onEndCall();
      }
    };

    // ──────────────────────────────────────────────────────────────
    // ✅ APPEL ENTRANT (call.isIncoming === true)
    // L'utilisateur a déjà cliqué "Décrocher" dans IncomingCallModal,
    // qui a émis "accept-call" côté Messages.jsx. Ici on prépare juste
    // le média + la PeerConnection, prête à recevoir l'offer WebRTC.
    // ──────────────────────────────────────────────────────────────
    const startIncomingCall = async () => {
      if (hasAcceptedRef.current) return;
      hasAcceptedRef.current = true;
      try {
        console.log("📞 [CallManager] Préparation média pour appel entrant de", friendId);
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: call.video,
          audio: true,
        });
        setStream(mediaStream);
        if (localVideoRef.current) localVideoRef.current.srcObject = mediaStream;

        createPeerConnection(mediaStream, friendId);

        // Si une offer était déjà arrivée avant que le média soit prêt
        if (pendingOfferRef.current?.offer && pendingOfferRef.current?.from === friendId) {
          await handleOfferRef.current(pendingOfferRef.current);
          pendingOfferRef.current = null;
        }
      } catch (err) {
        console.error("[CallManager] Erreur préparation média entrant:", err);
        showToast("Impossible d'accéder à la caméra/micro", "error");
        onEndCall();
      }
    };

    if (call.isIncoming) {
      startIncomingCall();
    } else {
      startOutgoingCall();
    }

    return () => {
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call?.on, socket?.connected]);

  // ── Stocker l'offer en attente côté appelant tant que callId inconnu ───
  const pendingOfferRef = useRef(null);
  const handleOfferRef  = useRef(null);

  // ════════════════════════════════════════════════════════════════════
  // 2. "call-initiated" — callId connu côté appelant → flush l'offer
  // ════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!socket) return;

    const handleCallInitiated = ({ callId }) => {
      console.log("📞 [CallManager] call-initiated reçu, callId:", callId);
      callIdRef.current = callId;
      const pending = pendingOfferRef.current;
      if (pending) {
        socket.emit("webrtc-offer", { callId, to: pending.to, offer: pending.offer });
        pendingOfferRef.current = null;
      }
    };

    socket.on("call-initiated", handleCallInitiated);
    return () => socket.off("call-initiated", handleCallInitiated);
  }, [socket]);

  // ════════════════════════════════════════════════════════════════════
  // 3. SIGNALING WEBRTC — offer / answer / ice-candidate
  // ════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!socket) return;

    const handleOffer = async ({ callId, from, offer }) => {
      if (call.friend?.id && from !== call.friend.id) return;
      if (callId) callIdRef.current = callId;

      if (!peerConnectionRef.current) {
        // PeerConnection pas encore prête (race condition) → mettre en attente
        console.warn("[CallManager] handleOffer: PC pas prête, mise en attente");
        pendingOfferRef.current = { callId, from, offer };
        return;
      }

      const pc = peerConnectionRef.current;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));

        // Vider les ICE candidates en attente
        for (const c of pendingCandidatesRef.current) {
          try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch { /* noop */ }
        }
        pendingCandidatesRef.current = [];

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("webrtc-answer", { callId: callIdRef.current, to: from, answer });
        console.log("📞 [CallManager] answer envoyée à", from);
      } catch (err) {
        console.error("[CallManager] Erreur handleOffer:", err);
      }
    };
    handleOfferRef.current = handleOffer;

    const handleAnswer = async ({ answer }) => {
      const pc = peerConnectionRef.current;
      if (pc && !pc.currentRemoteDescription) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
          console.log("📞 [CallManager] Connexion établie (answer reçue)");
        } catch (err) {
          console.error("[CallManager] Erreur handleAnswer:", err);
        }
      }
    };

    const handleIce = async ({ candidate }) => {
      const pc = peerConnectionRef.current;
      if (!candidate) return;
      if (!pc || !pc.remoteDescription) {
        pendingCandidatesRef.current.push(candidate);
        return;
      }
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.warn("[CallManager] Erreur ICE candidate:", err.message);
      }
    };

    const handleEnd = ({ endedBy }) => {
      // callSocket.js émet { callId, endedBy, duration } sur "call-ended"
      console.log("📞 [CallManager] call-ended reçu");
      onEndCall();
    };

    const handleRejected = () => {
      showToast("Appel refusé", "info");
      onEndCall();
    };

    socket.on("webrtc-offer",  handleOffer);
    socket.on("webrtc-answer", handleAnswer);
    socket.on("ice-candidate", handleIce);
    socket.on("call-ended",    handleEnd);
    socket.on("call-rejected", handleRejected);

    return () => {
      socket.off("webrtc-offer",  handleOffer);
      socket.off("webrtc-answer", handleAnswer);
      socket.off("ice-candidate", handleIce);
      socket.off("call-ended",    handleEnd);
      socket.off("call-rejected", handleRejected);
    };
  }, [call.friend?.id, onEndCall, socket, showToast]);

  // ════════════════════════════════════════════════════════════════════
  // Raccrocher manuellement
  // ════════════════════════════════════════════════════════════════════
  const endCall = () => {
    console.log("[CallManager] Raccrochage manuel...");

    // Arrêter le timer de durée
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
    }

    if (socket && socket.connected && callIdRef.current) {
      socket.emit("end-call", { callId: callIdRef.current });
    }

    setCallDuration(0);
    callStartTimeRef.current = null;
    onEndCall();
  };

  // ── Timer de durée d'appel ────────────────────────────────────────────────
  useEffect(() => {
    if (call?.on && !durationTimerRef.current) {
      // Démarrer le timer quand l'appel commence
      callStartTimeRef.current = Date.now();
      durationTimerRef.current = setInterval(() => {
        if (callStartTimeRef.current) {
          const elapsed = Math.floor((Date.now() - callStartTimeRef.current) / 1000);
          setCallDuration(elapsed);
        }
      }, 1000);
    } else if (!call?.on && durationTimerRef.current) {
      // Arrêter le timer quand l'appel se termine
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
      setCallDuration(0);
      callStartTimeRef.current = null;
    }

    return () => {
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }
    };
  }, [call?.on]);

  // ✅ FIX PRINCIPAL : ne plus bloquer le rendu pour les appels entrants
  if (!call?.on) return null;

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.8, opacity: 0 }}
      className="fixed inset-0 bg-black/90 z-[200] flex items-center justify-center p-4"
    >
      <div className="relative w-full max-w-4xl h-full max-h-[600px] bg-gray-900 rounded-3xl overflow-hidden border border-gray-700 shadow-2xl">
        {/* Vidéo Distante */}
        <div className="absolute inset-0">
          {remoteStream ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full bg-gradient-to-br from-gray-800 to-gray-900">
              <div className="w-32 h-32 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center text-5xl font-bold text-white shadow-lg animate-pulse">
                {call.friend?.fullName?.[0] || "?"}
              </div>
              <p className="mt-6 text-white text-xl font-medium animate-bounce">
                {call.isIncoming ? "Connexion en cours..." : "Appel en cours..."}
              </p>
            </div>
          )}
        </div>

        {/* Vidéo Locale */}
        {call.type === "video" && call.video && stream && (
          <motion.div
            drag
            dragConstraints={{ left: 0, right: 200, top: 0, bottom: 200 }}
            className="absolute top-4 right-4 w-32 sm:w-48 h-24 sm:h-36 rounded-2xl overflow-hidden border-2 border-white/50 shadow-lg bg-black cursor-grab active:cursor-grabbing z-10"
          >
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover transform scale-x-[-1]"
            />
          </motion.div>
        )}

        {/* Info */}
        <div className="absolute top-0 left-0 right-0 p-6 bg-gradient-to-b from-black/70 to-transparent pointer-events-none">
          <div className="text-center">
            <h3 className="text-2xl font-bold text-white drop-shadow-md">
              {call.friend?.fullName || "Utilisateur"}
            </h3>
            <p className="text-sm text-gray-300 drop-shadow-md">
              {remoteStream ? "En communication" : "Appel en cours..."}
            </p>
            {call.on && (
              <p className="text-lg font-mono font-bold text-green-400 drop-shadow-md mt-1">
                {formatDuration(callDuration)}
              </p>
            )}
          </div>
        </div>

        {/* Contrôles */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-6 bg-black/60 backdrop-blur-md px-8 py-5 rounded-full border border-white/10 shadow-2xl">
          <button
            onClick={onToggleMute}
            className={`p-4 rounded-full transition-all duration-300 ${
              call.mute ? "bg-white text-black" : "bg-gray-700/80 text-white hover:bg-gray-600"
            }`}
          >
            {call.mute ? <MicOff size={24} /> : <Mic size={24} />}
          </button>

          {call.type === "video" && (
            <button
              onClick={onToggleVideo}
              className={`p-4 rounded-full transition-all duration-300 ${
                !call.video ? "bg-white text-black" : "bg-gray-700/80 text-white hover:bg-gray-600"
              }`}
            >
              {!call.video ? <CameraOff size={24} /> : <Camera size={24} />}
            </button>
          )}

          <button
            onClick={endCall}
            className="p-5 bg-red-600 hover:bg-red-700 text-white rounded-full transition-all duration-300 transform hover:scale-110 shadow-lg hover:shadow-red-600/50"
          >
            <PhoneOff size={28} />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default CallManager;
