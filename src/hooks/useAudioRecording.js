// ============================================
// 📁 src/hooks/useAudioRecording.js
// VERSION CORRIGÉE - HOOK AUDIO FONCTIONNEL
// ============================================

import { useState, useRef, useCallback } from 'react';

export function useAudioRecording(token, showToast) {
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioElementRef = useRef(null);

  // ========== DÉMARRER L'ENREGISTREMENT ==========
  const startRecording = useCallback(async () => {
    try {
      console.log('🎤 [Audio] Demande permission microphone...');
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } 
      });

      console.log('✅ [Audio] Permission accordée');

      const preferredTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus'
      ];
      const supportedType = preferredTypes.find((type) =>
        typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)
      );
      const mediaRecorder = new MediaRecorder(
        stream,
        supportedType ? { mimeType: supportedType } : undefined
      );

      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          console.log(`📊 [Audio] Chunk reçu: ${event.data.size} bytes`);
        }
      };

      mediaRecorder.onstop = () => {
        console.log('⏹️ [Audio] Enregistrement terminé');
        
        const blobType = mediaRecorder.mimeType || supportedType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: blobType });
        const url = URL.createObjectURL(blob);
        
        console.log(`✅ [Audio] Blob créé: ${(blob.size / 1024).toFixed(2)} KB`);
        
        setAudioBlob(blob);
        setAudioUrl(url);
        setRecording(false);

        // Arrêter tous les tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setRecording(true);

      if (showToast) {
        showToast('🎤 Enregistrement en cours...', 'info');
      }

    } catch (error) {
      console.error('❌ [Audio] Erreur microphone:', error);
      
      if (showToast) {
        if (error.name === 'NotAllowedError') {
          showToast('Permission microphone refusée', 'error');
        } else if (error.name === 'NotFoundError') {
          showToast('Aucun microphone détecté', 'error');
        } else {
          showToast('Erreur microphone', 'error');
        }
      }
    }
  }, [showToast]);

  // ========== ARRÊTER L'ENREGISTREMENT ==========
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && recording) {
      console.log('🛑 [Audio] Arrêt enregistrement...');
      mediaRecorderRef.current.stop();
    }
  }, [recording]);

  // ========== ANNULER L'ENREGISTREMENT ==========
  const cancelRecording = useCallback(() => {
    console.log('❌ [Audio] Annulation enregistrement...');
    
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
    }

    // Nettoyer les données
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }

    setAudioBlob(null);
    setAudioUrl(null);
    setRecording(false);
    setIsPlaying(false);
    audioChunksRef.current = [];

    if (showToast) {
      showToast('Enregistrement annulé', 'info');
    }
  }, [recording, audioUrl, showToast]);

  // ========== LECTURE PREVIEW ==========
  const playPreview = useCallback(() => {
    if (!audioUrl) return;

    console.log('▶️ [Audio] Lecture preview...');

    if (!audioElementRef.current) {
      audioElementRef.current = new Audio(audioUrl);
      
      audioElementRef.current.onended = () => {
        console.log('✅ [Audio] Lecture terminée');
        setIsPlaying(false);
      };
    }

    audioElementRef.current.play();
    setIsPlaying(true);
  }, [audioUrl]);

  // ========== PAUSE PREVIEW ==========
  const pausePreview = useCallback(() => {
    if (audioElementRef.current) {
      console.log('⏸️ [Audio] Pause preview');
      audioElementRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  // ========== NETTOYAGE ==========
  const cleanup = useCallback(() => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current = null;
    }
  }, [audioUrl]);

  return {
    recording,
    audioBlob,
    audioUrl,
    isPlaying,
    startRecording,
    stopRecording,
    cancelRecording,
    playPreview,
    pausePreview,
    cleanup
  };
}
