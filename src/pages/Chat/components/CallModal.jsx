// ============================================
// 📁 src/pages/Chat/components/CallModal.jsx
// ✅ PHASE 5 — Modale d'appel en cours (audio/vidéo)
//    - Vidéo plein écran (remote) + petit cadre local
//    - Contrôles : mute micro, on/off caméra, raccrocher
//    - Durée d'appel affichée en temps réel
//    - Avatar + nom si appel audio seul
// ============================================
import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Phone, PhoneCall } from "lucide-react";
import { useTranslation } from "react-i18next";

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function CallModal({
  open,
  callState = "calling",
  callType = "audio",
  remoteUser,
  localStream,
  remoteStream,
  isMuted = false,
  isCameraOff = false,
  onToggleMute,
  onToggleCamera,
  onHangup,
  startedAt,
  error,
}) {
  const { t } = useTranslation();
  const [duration, setDuration] = useState(0);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  // Bind streams to video elements
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
