// src/components/CallManager.jsx - VERSION CORRIGÉE
import React, { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Phone, Video, Mic, MicOff, Camera, CameraOff, X, PhoneOff } from "lucide-react";
import { useChatSocket } from "../hooks/useChatSocket";
import { useToast } from "../context/ToastContext";

const CallManager = ({ call, onEndCall, onToggleMute, onToggleVideo }) => {
  const { socket } = useChatSocket();
  const { showToast } = useToast();
  const [stream, setStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);

  const ICE_SERVERS = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

  // Vérification du socket
  useEffect(() => {
    if (!socket) {
      console.warn('[CallManager] Socket non disponible');
    }
  }, [socket]);

  useEffect(() => {
    if (!call.on || call.isIncoming || !socket) return;

    const startCall = async () => {
      try {
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
          setRemoteStream(e.streams[0]);
          if (remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0];
        };

        pc.onicecandidate = e => {
          if (e.candidate && socket) {
            socket.emit("ice-candidate", { candidate: e.candidate, to: call.friend.id });
          }
        };

        if (call.type === "outgoing") {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          if (socket) {
            socket.emit("call-offer", { offer, to: call.friend.id, type: call.video ? "video" : "audio" });
          }
        }
      } catch (err) {
        console.error('[CallManager] Erreur démarrage appel:', err);
        showToast("Accès refusé", "error");
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

  // Signaux WebRTC
  useEffect(() => {
    if (!socket) return;

    const handleOffer = async ({ offer, from }) => {
      if (from !== call.friend.id) return;
      const pc = peerConnectionRef.current;
      if (!pc) return;
      
      try {
        await pc.setRemoteDescription(offer);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        if (socket) {
          socket.emit("call-answer", { answer, to: from });
        }
      } catch (err) {
        console.error('[CallManager] Erreur handleOffer:', err);
      }
    };

    const handleAnswer = async ({ answer }) => {
      const pc = peerConnectionRef.current;
      if (pc && !pc.remoteDescription) {
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
  }, [call.friend?.id, onEndCall, socket]);

  // ⚠️ FIX PRINCIPAL : Vérification du socket avant d'émettre
  const endCall = () => {
    console.log('[CallManager] endCall appelé, socket:', socket ? 'disponible' : 'undefined');
    
    // Nettoyer la connexion peer
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    
    // Arrêter les streams
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
    }
    
    // Émettre signal de fin seulement si socket est disponible
    if (socket && socket.connected) {
      try {
        socket.emit("call-ended", { to: call.friend.id });
      } catch (err) {
        console.error('[CallManager] Erreur lors de l\'émission call-ended:', err);
      }
    } else {
      console.warn('[CallManager] Socket non disponible pour émettre call-ended');
    }
    
    // Appeler le callback parent
    onEndCall();
  };

  if (!call.on || call.isIncoming) return null;

  return (
    <motion.div
      initial={{ scale: 0.8 }} 
      animate={{ scale: 1 }} 
      exit={{ scale: 0.8 }}
      className="fixed inset-0 bg-black/90 z-[200] flex items-center justify-center p-4"
    >
      <div className="relative w-full max-w-4xl h-full max-h-[600px] bg-gray-900 rounded-3xl overflow-hidden">
        <div className="absolute inset-0">
          {remoteStream ? (
            <video 
              ref={remoteVideoRef} 
              autoPlay 
              playsInline 
              className="w-full h-full object-cover" 
            />
          ) : (
            <div className="flex items-center justify-center h-full bg-gradient-to-br from-orange-600 to-pink-600">
              <div className="w-32 h-32 rounded-full bg-white/20 flex items-center justify-center text-6xl font-bold text-white">
                {call.friend?.fullName?.[0] || '?'}
              </div>
            </div>
          )}
        </div>

        {call.video && stream && (
          <div className="absolute top-4 right-4 w-48 h-36 rounded-2xl overflow-hidden border-4 border-white/30">
            <video 
              ref={localVideoRef} 
              autoPlay 
              muted 
              playsInline 
              className="w-full h-full object-cover" 
            />
          </div>
        )}

        <div className="absolute top-0 left-0 right-0 p-6 text-center">
          <h3 className="text-2xl font-bold text-white">
            {call.friend?.fullName || 'Inconnu'}
          </h3>
          <p className="text-sm text-gray-300">
            Appel {call.video ? "vidéo" : "audio"}
          </p>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-4 bg-black/50 backdrop-blur px-6 py-4 rounded-full">
          <button 
            onClick={onToggleMute} 
            className={`p-4 rounded-full transition-colors ${call.mute ? "bg-red-600" : "bg-gray-700 hover:bg-gray-600"}`}
          >
            {call.mute ? <MicOff className="w-6 h-6 text-white" /> : <Mic className="w-6 h-6 text-white" />}
          </button>
          
          {call.video && (
            <button 
              onClick={onToggleVideo} 
              className={`p-4 rounded-full transition-colors ${!call.video ? "bg-red-600" : "bg-gray-700 hover:bg-gray-600"}`}
            >
              {!call.video ? <CameraOff className="w-6 h-6 text-white" /> : <Camera className="w-6 h-6 text-white" />}
            </button>
          )}
          
          <button 
            onClick={endCall} 
            className="p-4 bg-red-600 hover:bg-red-700 rounded-full transition-colors"
          >
            <PhoneOff className="w-6 h-6 text-white" />
          </button>
        </div>

        <button 
          onClick={endCall} 
          className="absolute top-4 left-4 p-2 bg-black/50 hover:bg-black/70 rounded-full transition-colors"
        >
          <X className="w-5 h-5 text-white" />
        </button>
      </div>
    </motion.div>
  );
};

export default CallManager;