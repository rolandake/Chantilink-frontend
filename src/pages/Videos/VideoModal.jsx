// src/pages/videos/VideoModal.jsx - UPLOAD RÉEL AU BACKEND
import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useVideos } from "../../context/VideoContext";
import { useAuth } from "../../context/AuthContext";
import axios from "axios";
import {
  FaTimes, FaUpload, FaMusic, FaPalette, FaTextHeight,
  FaPlay, FaPause, FaCamera, FaStop, FaRedo, FaArrowLeft, FaGlobe,
  FaUserFriends, FaLock, FaSearch, FaMagic,
  FaHashtag, FaHeadphones, FaVolumeUp, FaCompress, FaExpand
} from "react-icons/fa";
import { HiSparkles } from "react-icons/hi2";

const MUSIC_LIBRARY = [
  { id: 1, title: "Summer Vibes", artist: "DJ Nova", genre: "Pop", duration: "2:30", url: "https://cdn.pixabay.com/download/audio/2022/03/15/audio_9d7b8f8d9a.mp3" },
  { id: 2, title: "Cyber Dreams", artist: "Neon Pulse", genre: "Synthwave", duration: "3:15", url: "https://cdn.pixabay.com/download/audio/2023/01/10/audio_5f8e3a2b1c.mp3" },
];

const HASHTAG_SUGGESTIONS = [
  "#fyp", "#pourtoi", "#viral", "#trending", "#tiktok", "#reels",
  "#dance", "#comedy", "#funny", "#love", "#music", "#aesthetic",
];

const VideoModal = ({ showModal, setShowModal, onVideoPublished }) => {
  const videoRef = useRef(null);
  const cameraVideoRef = useRef(null);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const isCleaningRef = useRef(false);
  const isMountedRef = useRef(true);
  const canvasRef = useRef(null);
  const recordingTimerRef = useRef(null);

  const { addVideo, fetchVideos } = useVideos();
  const { getActiveUser } = useAuth();
  const currentUser = getActiveUser();

  const [step, setStep] = useState("upload");
  const [videoFile, setVideoFile] = useState(null);
  const [videoURL, setVideoURL] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("none");
  const [textOverlay, setTextOverlay] = useState("");
  const [textColor, setTextColor] = useState("#ffffff");
  const [textPosition] = useState({ x: 50, y: 10 });
  const [selectedMusic, setSelectedMusic] = useState(null);
  const [musicSearch, setMusicSearch] = useState("");
  const [privacy, setPrivacy] = useState("public");
  const [allowComments, setAllowComments] = useState(true);
  const [allowDuet, setAllowDuet] = useState(true);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showMusicLibrary, setShowMusicLibrary] = useState(false);
  const [showHashtagSuggestions, setShowHashtagSuggestions] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const filters = useMemo(() => [
    { name: "Original", value: "none", filter: "none" },
    { name: "Cinematic", value: "cinematic", css: "contrast(1.3) saturate(1.4) brightness(1.05)" },
    { name: "Neon Glow", value: "neon", css: "contrast(1.6) brightness(1.3) saturate(2.2)" },
    { name: "Vintage Film", value: "vintage", css: "sepia(0.6) contrast(1.25) brightness(0.9)" },
    { name: "Cyberpunk", value: "cyber", css: "hue-rotate(200deg) saturate(2) contrast(1.4)" },
    { name: "Dreamwave", value: "dream", css: "blur(1.5px) brightness(1.15) saturate(1.6)" },
    { name: "Monochrome", value: "bw", css: "grayscale(1) contrast(1.3)" },
    { name: "Ultra HD", value: "ultra", css: "contrast(1.5) saturate(1.8) brightness(1.1)" },
  ], []);

  const cleanup = useCallback(() => {
    if (isCleaningRef.current || !isMountedRef.current) return;
    isCleaningRef.current = true;

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        try { track.stop(); } catch (e) {}
      });
      streamRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch (e) {}
      mediaRecorderRef.current = null;
    }

    [videoRef, cameraVideoRef].forEach(ref => {
      if (ref.current) {
        try {
          ref.current.pause();
          ref.current.src = '';
          ref.current.srcObject = null;
          if (ref.current.load) ref.current.load();
        } catch (e) {}
      }
    });

    if (videoURL) URL.revokeObjectURL(videoURL);

    requestAnimationFrame(() => {
      if (isMountedRef.current) {
        setStep("upload");
        setVideoFile(null);
        setVideoURL(null);
        setIsRecording(false);
        setRecordingTime(0);
        setTitle("");
        setDescription("");
        setHashtags("");
        setSelectedFilter("none");
        setTextOverlay("");
        setSelectedMusic(null);
        setIsPlaying(false);
        setIsUploading(false);
        setUploadProgress(0);
      }
      isCleaningRef.current = false;
    });
  }, [videoURL]);

  // 🔥 UPLOAD RÉEL AU BACKEND
  const handlePublish = useCallback(async () => {
    if (!title.trim()) {
      alert("Le titre est requis");
      return;
    }

    if (!currentUser?.token) {
      alert("Vous devez être connecté pour publier");
      return;
    }

    if (!videoFile) {
      alert("Aucune vidéo sélectionnée");
      return;
    }

    console.log('🚀 [VideoModal] Début upload backend');
    setIsUploading(true);
    setUploadProgress(0);

    try {
      // 🔥 CRÉER LE FORMDATA
      const formData = new FormData();
      formData.append('video', videoFile);
      formData.append('title', title.trim());
      formData.append('description', description.trim());
      formData.append('hashtags', hashtags.trim());
      formData.append('privacy', privacy);
      formData.append('allowComments', allowComments);
      formData.append('allowDuet', allowDuet);
      
      if (selectedFilter !== "none") {
        formData.append('filter', selectedFilter);
      }
      
      if (selectedMusic) {
        formData.append('musicName', selectedMusic.title);
        formData.append('musicArtist', selectedMusic.artist);
      }

      // 🔥 RÉCUPÉRER LE TOKEN
      const token = currentUser.token || localStorage.getItem('token');
      if (!token) {
        throw new Error('Token manquant');
      }

      console.log('📤 [VideoModal] Envoi au backend...');

      // 🔥 UPLOAD AVEC PROGRESSION
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/videos`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            'Authorization': `Bearer ${token}`
          },
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            setUploadProgress(percentCompleted);
            console.log(`📊 [VideoModal] Upload: ${percentCompleted}%`);
          }
        }
      );

      console.log('✅ [VideoModal] Vidéo uploadée:', response.data);

      // 🔥 AJOUTER AU CONTEXT LOCAL IMMÉDIATEMENT
      const uploadedVideo = response.data.video || response.data;
      addVideo(uploadedVideo);

      // 🔥 RAFRAÎCHIR LE FEED POUR AVOIR TOUTES LES VIDÉOS
      setTimeout(() => {
        fetchVideos(true);
      }, 500);

      // 🔥 NOTIFICATION ET FERMETURE
      setTimeout(() => {
        cleanup();
        setShowModal(false);
        
        if (onVideoPublished) {
          onVideoPublished(uploadedVideo);
        }
        
        alert('✅ Vidéo publiée avec succès !');
      }, 800);

    } catch (error) {
      console.error("❌ [VideoModal] Erreur upload:", error);
      
      let errorMessage = "Erreur lors de la publication";
      
      if (error.response) {
        errorMessage = error.response.data?.message || 
                      error.response.data?.error || 
                      `Erreur ${error.response.status}`;
      } else if (error.request) {
        errorMessage = "Impossible de contacter le serveur";
      }
      
      alert(errorMessage);
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, [title, description, hashtags, selectedFilter, selectedMusic, privacy, 
      allowComments, allowDuet, videoFile, currentUser, addVideo, fetchVideos,
      cleanup, setShowModal, onVideoPublished]);

  const handleFileSelect = useCallback((e) => {
    const file = e.target.files[0];
    if (!file || !file.type.startsWith("video/")) return alert("Sélectionnez une vidéo");
    if (file.size > 150 * 1024 * 1024) return alert("Max 150MB");

    if (videoURL) URL.revokeObjectURL(videoURL);
    setVideoFile(file);
    setVideoURL(URL.createObjectURL(file));
    setStep("edit");
  }, [videoURL]);

  const startRecording = useCallback(async () => {
    if (isRecording) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1080 }, height: { ideal: 1920 } },
        audio: true,
      });

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }

      streamRef.current = stream;
      setIsRecording(true);
      setRecordingTime(0);

      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = stream;
        cameraVideoRef.current.play().catch(() => {});
      }

      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      const recorder = new MediaRecorder(stream, { 
        mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9') 
          ? 'video/webm;codecs=vp9' 
          : 'video/webm'
      });
      mediaRecorderRef.current = recorder;
      const chunks = [];

      recorder.ondataavailable = e => e.data.size > 0 && chunks.push(e.data);
      recorder.onstop = () => {
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }

        const blob = new Blob(chunks, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        setVideoURL(url);
        setVideoFile(new File([blob], `recorded-${Date.now()}.webm`, { type: "video/webm" }));
        setStep("edit");
        setIsRecording(false);
        
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop());
          streamRef.current = null;
        }

        if (cameraVideoRef.current) {
          cameraVideoRef.current.srcObject = null;
        }
      };

      recorder.start();
    } catch (err) {
      console.error("Caméra inaccessible", err);
      alert("Impossible d'accéder à la caméra");
      setIsRecording(false);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  }, [isRecording]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const retakeVideo = useCallback(() => {
    cleanup();
    setStep("upload");
  }, [cleanup]);

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  }, [isPlaying]);

  const formatTime = useCallback((s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`, []);

  const generateWithAI = useCallback(() => {
    const suggestions = [
      { title: "Quand la vibe est parfaite ✨", hashtags: "#fyp #vibes #aesthetic #trending" },
      { title: "POV: Tu vis ton meilleur moment 🌟", hashtags: "#pov #foryou #viral #explore" },
      { title: "Juste une journée normale... 😄", hashtags: "#comedy #funny #relatable #fyp" },
      { title: "Glow up level 100 💯", hashtags: "#glowup #transformation #beforeafter #viral" },
    ];
    const random = suggestions[Math.floor(Math.random() * suggestions.length)];
    setTitle(random.title);
    setHashtags(random.hashtags);
  }, []);

  useEffect(() => {
    if (!showModal) cleanup();
  }, [showModal, cleanup]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      cleanup();
    };
  }, [cleanup]);

  if (!showModal) return null;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-black via-purple-900/30 to-black backdrop-blur-3xl"
        onClick={() => !isUploading && !isRecording && setShowModal(false)}
      >
        <motion.div
          initial={{ scale: 0.92, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 20 }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          onClick={e => e.stopPropagation()}
          className={`relative w-full bg-gradient-to-br from-gray-950 via-black to-gray-900 shadow-2xl overflow-hidden border border-white/10 ${
            isRecording 
              ? 'h-screen w-screen fixed inset-0 rounded-none' 
              : isFullscreen 
              ? 'fixed inset-0 rounded-none' 
              : 'max-w-5xl max-h-[96vh] rounded-3xl'
          }`}
        >
          {/* Header */}
          {!isRecording && (
            <div className="sticky top-0 z-50 bg-gradient-to-r from-purple-900/90 via-black/95 to-pink-900/90 backdrop-blur-3xl border-b border-white/10 px-5 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {step !== "upload" && (
                    <button
                      onClick={() => setStep(step === "publish" ? "edit" : "upload")}
                      className="p-2.5 rounded-full bg-white/10 hover:bg-white/20"
                    >
                      <FaArrowLeft className="text-white text-lg" />
                    </button>
                  )}
                  <h2 className="text-white text-xl font-black flex items-center gap-2.5">
                    <HiSparkles className="text-yellow-400" />
                    <span className="bg-gradient-to-r from-pink-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
                      {step === "upload" ? "Créer" : step === "edit" ? "Édition" : "Publier"}
                    </span>
                  </h2>
                </div>
                <button
                  onClick={() => !isUploading && setShowModal(false)}
                  disabled={isUploading}
                  className="p-2.5 rounded-full bg-white/10 hover:bg-red-500/20 disabled:opacity-50"
                >
                  <FaTimes className="text-white text-lg" />
                </button>
              </div>
            </div>
          )}

          <div className={isRecording ? "w-full h-screen" : "overflow-y-auto max-h-[calc(96vh-80px)] p-6"}>
            
            {/* MODE ENREGISTREMENT */}
            {isRecording && (
              <div className="relative w-full h-full bg-black flex flex-col">
                <video 
                  ref={cameraVideoRef} 
                  autoPlay 
                  muted 
                  playsInline 
                  className="absolute inset-0 w-full h-full object-cover"
                />
                
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute top-8 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/70 backdrop-blur-xl px-6 py-3 rounded-full">
                    <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse" />
                    <span className="text-2xl font-mono font-bold text-white">{formatTime(recordingTime)}</span>
                  </div>

                  <div className="absolute bottom-12 left-1/2 -translate-x-1/2 pointer-events-auto">
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={stopRecording}
                      className="w-20 h-20 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center shadow-2xl border-4 border-white/30"
                    >
                      <FaStop className="text-white text-2xl" />
                    </motion.button>
                  </div>
                </div>
              </div>
            )}

            {/* STEP UPLOAD */}
            {step === "upload" && !isRecording && (
              <div className="space-y-8">
                <div className="text-center">
                  <h3 className="text-3xl font-black text-white mb-2">Créez votre hit</h3>
                  <p className="text-white/60">Importez ou filmez</p>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <motion.div
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => fileInputRef.current?.click()}
                    className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-pink-600/20 via-purple-600/20 to-cyan-600/20 p-8 cursor-pointer border-2 border-white/10 hover:border-pink-500/50"
                  >
                    <div className="relative text-center">
                      <div className="w-24 h-24 mx-auto mb-5 bg-gradient-to-br from-pink-500 to-purple-600 rounded-3xl flex items-center justify-center">
                        <FaUpload className="text-white text-3xl" />
                      </div>
                      <h4 className="text-xl font-bold text-white mb-2">Importer</h4>
                      <p className="text-white/70 text-sm">MP4 • WebM • Max 150MB</p>
                    </div>
                  </motion.div>

                  <motion.div
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={startRecording}
                    className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-cyan-600/20 via-blue-600/20 to-indigo-600/20 p-8 cursor-pointer border-2 border-white/10 hover:border-cyan-500/50"
                  >
                    <div className="relative text-center">
                      <div className="w-24 h-24 mx-auto mb-5 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-3xl flex items-center justify-center">
                        <FaCamera className="text-white text-3xl" />
                      </div>
                      <h4 className="text-xl font-bold text-white mb-2">Filmer</h4>
                      <p className="text-white/70 text-sm">1080p • 60s max</p>
                    </div>
                  </motion.div>
                </div>

                <input ref={fileInputRef} type="file" accept="video/*" onChange={handleFileSelect} className="hidden" />
              </div>
            )}

            {/* STEP EDIT */}
            {step === "edit" && videoURL && !isRecording && (
              <div className="text-center py-12">
                <div className="mb-6">
                  <video
                    ref={videoRef}
                    src={videoURL}
                    className="max-w-md mx-auto rounded-2xl shadow-2xl"
                    controls
                  />
                </div>
                <button
                  onClick={() => setStep("publish")}
                  className="px-8 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-bold rounded-xl hover:shadow-xl"
                >
                  Suivant →
                </button>
              </div>
            )}

            {/* STEP PUBLISH */}
            {step === "publish" && (
              <div className="max-w-3xl mx-auto space-y-6">
                <div className="flex justify-center mb-4">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={generateWithAI}
                    className="px-6 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-bold rounded-full flex items-center gap-2"
                  >
                    <FaMagic />
                    Générer avec IA
                  </motion.button>
                </div>

                <div className="bg-white/5 backdrop-blur-2xl rounded-3xl p-6 border border-white/10 space-y-5">
                  <div>
                    <label className="text-lg font-bold text-white mb-2 block">Titre *</label>
                    <input
                      type="text"
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      placeholder="Un titre qui claque..."
                      className="w-full bg-white/10 text-white placeholder-white/50 rounded-xl px-5 py-4 outline-none focus:ring-2 focus:ring-pink-500 text-lg"
                      maxLength={100}
                    />
                    <p className="text-white/50 text-sm mt-1 text-right">{title.length}/100</p>
                  </div>

                  <div>
                    <label className="text-lg font-bold text-white mb-2 block">Description</label>
                    <textarea
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      placeholder="Racontez votre histoire..."
                      className="w-full bg-white/10 text-white placeholder-white/50 rounded-xl px-5 py-4 outline-none focus:ring-2 focus:ring-purple-500 resize-none h-28"
                      maxLength={500}
                    />
                  </div>

                  <div>
                    <label className="text-lg font-bold text-white mb-2 block flex items-center gap-2">
                      <FaHashtag className="text-pink-400" /> Hashtags
                    </label>
                    <input
                      type="text"
                      value={hashtags}
                      onChange={e => setHashtags(e.target.value)}
                      placeholder="#fyp #viral #trending"
                      className="w-full bg-white/10 text-white placeholder-white/50 rounded-xl px-5 py-4 outline-none focus:ring-2 focus:ring-pink-500"
                    />
                  </div>
                </div>

                <button
                  onClick={handlePublish}
                  disabled={isUploading || !title.trim()}
                  className={`w-full py-6 rounded-2xl font-black text-xl flex items-center justify-center gap-3 ${
                    isUploading || !title.trim()
                      ? "bg-gray-700 cursor-not-allowed"
                      : "bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 hover:shadow-2xl"
                  } text-white`}
                >
                  {isUploading ? (
                    <>
                      <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Upload... {uploadProgress}%</span>
                    </>
                  ) : (
                    <>
                      <HiSparkles className="text-yellow-400" />
                      <span>Publier</span>
                    </>
                  )}
                </button>

                {isUploading && (
                  <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${uploadProgress}%` }}
                      className="h-full bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default VideoModal;