// ============================================
// 📁 src/hooks/useAudioRecording.js - VERSION CORRIGÉE
// ============================================
import { useState, useRef, useCallback } from "react";

export const useAudioRecording = (token, showToast) => {
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioRef = useRef(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        
        setAudioBlob(blob);
        setAudioUrl(url);
        
        // Arrêter tous les tracks du stream
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setRecording(true);
      
      if (showToast) {
        showToast("Enregistrement en cours...", "info");
      }
    } catch (error) {
      console.error("Erreur d'accès au microphone:", error);
      if (showToast) {
        showToast("Impossible d'accéder au microphone", "error");
      }
    }
  }, [showToast]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
      
      if (showToast) {
        showToast("Enregistrement terminé", "success");
      }
    }
  }, [recording, showToast]);

  const cancelAudio = useCallback(() => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioBlob(null);
    setAudioUrl(null);
    setIsPlaying(false);
    audioChunksRef.current = [];
  }, [audioUrl]);

  const playPreview = useCallback(() => {
    if (audioRef.current && audioUrl) {
      audioRef.current.play();
      setIsPlaying(true);
    }
  }, [audioUrl]);

  const pausePreview = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  return {
    recording,
    audioBlob,
    audioUrl,
    isPlaying,
    audioRef,
    startRecording,
    stopRecording,
    cancelAudio,
    playPreview,
    pausePreview
  };
};