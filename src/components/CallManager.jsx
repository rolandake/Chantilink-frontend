// src/components/CallManager.jsx - VERSION FINALE (CORRIGÉE)
import React, { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Phone, Video, Mic, MicOff, Camera, CameraOff, X, PhoneOff } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

const CallManager = ({ call, onEndCall, onToggleMute, onToggleVideo }) => {
  
  // ✅ Récupération du socket stable depuis AuthContext
  const { socket } = useAuth();
  const { showToast } = useToast();
  
  const [stream, setStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);

  const ICE_SERVERS = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

  // Debug : Vérifier si le socket arrive bien
  useEffect(() => {
    if (socket && socket.connected) {
      console.log("✅ [CallManager] Socket global détecté et connecté :", socket.id);
    }
  }, [socket]);

  // 1. DÉMARRAGE DE L'APPEL
  useEffect(() => {
    // Sécurité : On ne fait rien tant que le socket n'est pas prêt ou qu'on n'est pas en appel
    if (!socket || !socket.connected) return;
    if (!call.on || call.isIncoming) return;

    const startCall = async () => {
      try {
        console.log("📞 [CallManager] Démarrage des médias...");
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: call.video,
          audio: true,
        });
        setStream(mediaStream);
        if (localVideoRef.current) localVideoRef.current.srcObject = mediaStream;

        const pc = new RTCPeerConnection(ICE_SERVERS);
        peerConnectionRef.current = pc;

        mediaStream.getTracks().forEach(t => pc.addTrack(t, mediaStream));

        pc.ontrack = e => {
          console.log("📡 [CallManager] Flux distant reçu !");
          setRemoteStream(e.streams[0]);
          if (remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0];
        };

        pc.onicecandidate = e => {
          if (e.candidate && socket) {
            socket.emit("ice-candidate", { candidate: e.candidate, to: call.friend.id });
          }
        };

        if (call.type === "outgoing") {
          console.log("📤 [CallManager] Création de l'offre...");
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit("call-offer", { offer, to: call.friend.id, type: call.video ? "video" : "audio" });
        }
      } catch (err) {
        console.error('[CallManager] Erreur démarrage appel:', err);
        showToast("Impossible d'accéder à la caméra/micro", "error");
        onEndCall();
      }
    };

    startCall();

    return () => {
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
    };
  }, [call.on, call.friend, call.video, call.type, call.isIncoming, onEndCall, showToast, socket]);

  // 2. GESTION DES SIGNAUX WEBRTC
  useEffect(() => {
    if (!socket) return;

    const handleOffer = async ({ offer, from }) => {
      if (from !== call.friend.id) return;
      
      if (!peerConnectionRef.current) {
        const pc = new RTCPeerConnection(ICE_SERVERS);
        peerConnectionRef.current = pc;
        
        try {
           const mediaStream = await navigator.mediaDevices.getUserMedia({
            video: call.video,
            audio: true,
          });
          setStream(mediaStream);
          if (localVideoRef.current) localVideoRef.current.srcObject = mediaStream;
          mediaStream.getTracks().forEach(t => pc.addTrack(t, mediaStream));
          
          pc.ontrack = e => {
            setRemoteStream(e.streams[0]);
            if (remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0];
          };
          
           pc.onicecandidate = e => {
            if (e.candidate) {
              socket.emit("ice-candidate", { candidate: e.candidate, to: from });
            }
          };
        } catch (e) {
          console.error("Erreur média réponse", e);
        }
      }

      const pc = peerConnectionRef.current;
      try {
        await pc.setRemoteDescription(offer);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("call-answer", { answer, to: from });
      } catch (err) {
        console.error('[CallManager] Erreur handleOffer:', err);
      }
    };

    const handleAnswer = async ({ answer }) => {
      const pc = peerConnectionRef.current;
      if (pc && !pc.currentRemoteDescription) {
        try {
          await pc.setRemoteDescription(answer);
        } catch (err) {
          console.error('[CallManager] Erreur handleAnswer:', err);
        }
      }
    };

    const handleIce = async ({ candidate }) => {
      const pc = peerConnectionRef.current;
      if (pc) {
        try {
          await pc.addIceCandidate(candidate);
        } catch (err) {
          console.error('[CallManager] Erreur handleIce:', err);
        }
      }
    };

    const handleEnd = ({ from }) => {
      if (from === call.friend.id) {
        onEndCall();
      }
    };

    socket.on("call-offer", handleOffer);
    socket.on("call-answer", handleAnswer);
    socket.on("ice-candidate", handleIce);
    socket.on("call-ended", handleEnd);

    return () => {
      socket.off("call-offer", handleOffer);
      socket.off("call-answer", handleAnswer);
      socket.off("ice-candidate", handleIce);
      socket.off("call-ended", handleEnd);
    };
  }, [call.friend?.id, onEndCall, socket, call.video]);

  const endCall = () => {
    console.log('[CallManager] Raccrochage manuel...');
    
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
    }
    
    // On émet l'événement de fin seulement si le socket est là
    if (socket && socket.connected) {
      socket.emit("call-ended", { to: call.friend.id });
    }
    
    onEndCall();
  };

  if (!call.on || call.isIncoming) return null;

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
                {call.friend?.fullName?.[0] || '?'}
              </div>
              <p className="mt-6 text-white text-xl font-medium animate-bounce">Connexion en cours...</p>
            </div>
          )}
        </div>

        {/* Vidéo Locale */}
        {call.video && stream && (
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
              {call.friend?.fullName || 'Utilisateur'}
            </h3>
            <p className="text-sm text-gray-300 drop-shadow-md">
              {remoteStream ? "En communication" : "Appel en cours..."}
            </p>
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
          
          {call.video && (
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