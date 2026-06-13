import React, { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useVideos } from "../../context/VideoContext";
import { useAuth } from "../../context/AuthContext";
import axios from "axios";
import axiosClient from "../../api/axiosClientGlobal";
import {
  FaTimes, FaUpload, FaCamera, FaArrowLeft,
  FaMagic, FaHashtag, FaExclamationCircle, FaChevronRight, FaVideo,
  FaEye, FaEyeSlash, FaTag, FaWater, FaClock, FaBookOpen
} from "react-icons/fa";
import { HiSparkles } from "react-icons/hi2";

// --- CONSTANTES ---
const MAX_FILE_SIZE = 150 * 1024 * 1024; // 150MB
const ACCEPT_TYPES = "video/mp4,video/webm,video/quicktime,video/x-msvideo";

const VIDEO_CATEGORIES = [
  { value: "btp", label: "🏗️ BTP & Construction", keywords: ["chantier","construction","btp","béton","maçonnerie"] },
  { value: "genie_civil", label: "🏛️ Génie Civil", keywords: ["génie civil","infrastructure","pont","route"] },
  { value: "architecture", label: "📐 Architecture", keywords: ["architecture","bâtiment","design","plan"] },
  { value: "formation", label: "📚 Formation & Tutoriels", keywords: ["tutoriel","formation","cours","technique"] },
  { value: "divertissement", label: "🎬 Divertissement", keywords: ["funny","compilation","humour","viral"] },
  { value: "actualite", label: "📰 Actualités", keywords: ["actualité","news","breaking","annonce"] },
  { value: "ambiance", label: "🎥 Ambiance & Vlogs", keywords: ["vlog","ambiance","relaxing","asmr"] },
  { value: "autre", label: "📋 Autre", keywords: [] },
];

const VISIBILITY_OPTIONS = [
  { value: "public", label: "Public", icon: FaEye, desc: "Visible par tous" },
  { value: "followers", label: "Abonnés", icon: FaEyeSlash, desc: "Visible par vos abonnés" },
  { value: "private", label: "Privé", icon: FaEyeSlash, desc: "Visible uniquement par vous" },
];

const AI_TITLE_SUGGESTIONS = [
  { t: "Regardez ça ! 😱", h: "#viral #omg #fun" },
  { t: "Vibe du jour ✨", h: "#mood #aesthetic #lifestyle" },
  { t: "Incroyable talent 🔥", h: "#talent #skill #wow" },
  { t: "Moment inoubliable ❤️", h: "#love #memory #best" },
  { t: "Tuto express 🎯", h: "#tuto #astuce #apprendre" },
  { t: "Sur le chantier 🏗️", h: "#btp #chantier #travaux" },
  { t: "Coulisses du projet 🎬", h: "#coulisses #projet #behindthescenes" },
  { t: "Pro tip du jour 💡", h: "#conseil #pro #expert" },
];

// --- Détection de catégorie automatique ---
const autoDetectCategory = (title, hashtags) => {
  const text = `${title} ${hashtags}`.toLowerCase();
  for (const cat of VIDEO_CATEGORIES) {
    if (cat.keywords.length > 0 && cat.keywords.some(kw => text.includes(kw))) {
      return cat.value;
    }
  }
  return "autre";
};

// --- Extraction hashtags de texte ---
const extractHashtags = (text) => {
  const matches = text.match(/#[\p{L}\p{N}_-]+/gu) || [];
  return matches.map(h => h.replace(/^#/, "")).filter(h => h.length > 0);
};

const VideoModal = ({ showModal, setShowModal, onVideoPublished }) => {
  // --- REFS & CONTEXTS ---
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const cameraVideoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const abortControllerRef = useRef(null);

  const { addVideo, fetchVideos } = useVideos();
  const { user: currentUser, getToken } = useAuth();

  // --- STATES ---
  const [step, setStep] = useState("upload"); // upload | camera | edit | publish
  const [videoFile, setVideoFile] = useState(null);
  const [videoURL, setVideoURL] = useState(null);

  // Camera
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [cameraReady, setCameraReady] = useState(false);

  // Data
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("none");

  // New fields
  const [category, setCategory] = useState("autre");
  const [visibility, setVisibility] = useState("public");
  const [enableWatermark, setEnableWatermark] = useState(true);
  const [scheduleDate, setScheduleDate] = useState("");
  const [isDraft, setIsDraft] = useState(false);

  // Upload State
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState(null);

  // Video duration/size
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoSize, setVideoSize] = useState(0);

  // --- NETTOYAGE ---
  const cleanup = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoURL && videoURL.startsWith('blob:')) {
      URL.revokeObjectURL(videoURL);
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
    }
    setStep("upload");
    setVideoFile(null);
    setVideoURL(null);
    setTitle("");
    setDescription("");
    setHashtags("");
    setCategory("autre");
    setVisibility("public");
    setEnableWatermark(true);
    setScheduleDate("");
    setIsDraft(false);
    setIsUploading(false);
    setUploadProgress(0);
    setUploadError(null);
    setIsRecording(false);
    setCameraReady(false);
    setVideoDuration(0);
    setVideoSize(0);
  }, [videoURL]);

  const handleClose = () => {
    if (isUploading) {
      if (!window.confirm("L'upload est en cours. Voulez-vous vraiment annuler ?")) return;
    }
    cleanup();
    setShowModal(false);
  };

  // --- HANDLERS FICHIER ---
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      alert(`Fichier trop lourd (${(file.size / 1024 / 1024).toFixed(1)}MB). Max 150MB.`);
      return;
    }

    if (!file.type.startsWith('video/')) {
      alert("Ce fichier n'est pas une vidéo valide.");
      return;
    }

    if (videoURL) URL.revokeObjectURL(videoURL);
    setVideoFile(file);
    setVideoURL(URL.createObjectURL(file));
    setVideoSize(file.size);

    // Capture metadata
    const tempVideo = document.createElement('video');
    tempVideo.preload = "metadata";
    tempVideo.onloadedmetadata = () => {
      setVideoDuration(tempVideo.duration || 0);
      URL.revokeObjectURL(tempVideo.src);
    };
    tempVideo.src = URL.createObjectURL(file);

    setStep("edit");
    e.target.value = null;
  };

  // --- HANDLERS CAMERA ---
  const initCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          aspectRatio: { ideal: 9 / 16 },
          facingMode: "user",
          width: { ideal: 1080 },
          height: { ideal: 1920 }
        },
        audio: true
      });

      streamRef.current = stream;

      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = stream;
        cameraVideoRef.current.onloadedmetadata = () => {
          setCameraReady(true);
        };
      }

      setStep("camera");
    } catch (err) {
      let errorMsg = "Impossible d'accéder à la caméra.";
      if (err.name === 'NotAllowedError') {
        errorMsg = "Permission refusée. Autorisez l'accès à la caméra dans les paramètres.";
      } else if (err.name === 'NotFoundError') {
        errorMsg = "Aucune caméra détectée sur cet appareil.";
      } else if (err.name === 'NotReadableError') {
        errorMsg = "La caméra est déjà utilisée par une autre application.";
      }
      alert(errorMsg);
      setStep("upload");
    }
  };

  const startRecording = () => {
    if (!streamRef.current) return;

    try {
      const mimeType = MediaRecorder.isTypeSupported('video/webm; codecs=vp9')
        ? 'video/webm; codecs=vp9'
        : MediaRecorder.isTypeSupported('video/webm')
        ? 'video/webm'
        : 'video/mp4';

      const recorder = new MediaRecorder(streamRef.current, {
        mimeType,
        videoBitsPerSecond: 2500000
      });

      const chunks = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        const file = new File([blob], `cam_${Date.now()}.${mimeType.includes('webm') ? 'webm' : 'mp4'}`, {
          type: mimeType
        });

        setVideoFile(file);
        setVideoURL(URL.createObjectURL(blob));
        setVideoSize(blob.size);

        if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop());
          streamRef.current = null;
        }

        setCameraReady(false);
        setStep("edit");
      };

      recorder.onerror = () => {
        alert("Erreur lors de l'enregistrement");
      };

      mediaRecorderRef.current = recorder;
      recorder.start(1000);
      setIsRecording(true);

      let time = 0;
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => {
        time++;
        setRecordingTime(time);
        if (time >= 60) stopRecording();
      }, 1000);
    } catch (err) {
      alert("Impossible de démarrer l'enregistrement");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  const cancelCamera = () => {
    stopRecording();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
    setStep("upload");
  };

  // --- Auto-detect category from title ---
  useEffect(() => {
    if (title || hashtags) {
      const detected = autoDetectCategory(title, hashtags);
      if (detected !== "autre" && category === "autre") {
        setCategory(detected);
      }
    }
  }, [title, hashtags]);

  // --- PUBLISH ---
  const handlePublish = async () => {
    if (!videoFile || !title.trim()) return;

    setIsUploading(true);
    setUploadError(null);
    abortControllerRef.current = new AbortController();

    const formData = new FormData();
    formData.append('video', videoFile);
    formData.append('title', title.trim());
    formData.append('description', description || "");
    formData.append('hashtags', hashtags || "");
    formData.append('filter', selectedFilter);
    formData.append('category', category);
    formData.append('visibility', visibility);
    formData.append('enableWatermark', enableWatermark ? 'true' : 'false');
    if (scheduleDate) formData.append('scheduledAt', scheduleDate);
    if (videoDuration) formData.append('duration', String(videoDuration));

    try {
      const token = await getToken();

      if (!token) {
        throw new Error("Vous devez être connecté pour publier.");
      }

      const res = await axiosClient.post("/videos", formData, {
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percentCompleted);
        },
        signal: abortControllerRef.current.signal,
        timeout: 300000,
      });

      const videoData = res.data.video || res.data;
      if (addVideo) addVideo(videoData);
      if (fetchVideos) fetchVideos(true);

      // ── Créer aussi un post pour que la vidéo apparaisse dans le profil ──
      try {
        const videoUrl = videoData.videoUrl || videoData.url || videoData.cloudinaryUrl || "";
        const postFormData = new FormData();
        postFormData.append("content", title.trim());
        postFormData.append("mediaType", "video");
        postFormData.append("videoUrl", videoUrl);
        if (description) postFormData.append("description", description);
        if (hashtags) postFormData.append("hashtags", hashtags);
        if (category) postFormData.append("category", category);
        if (visibility) postFormData.append("privacy", visibility === "public" ? "public" : visibility === "followers" ? "friends" : "private");
        await axiosClient.post("/posts", postFormData, {
          headers: { "Content-Type": "multipart/form-data" },
          timeout: 30000,
        });
      } catch (postErr) {
        // Non bloquant — la vidéo est déjà publiée même si le post échoue
        console.warn("⚠️ Création post profil échouée (non bloquant):", postErr?.message);
      }

      if (onVideoPublished) onVideoPublished(res.data);

      handleClose();
    } catch (err) {
      if (axios.isCancel(err)) {
        setUploadError("Upload annulé.");
      } else {
        setUploadError(err.response?.data?.message || "Erreur lors de l'upload. Vérifiez votre connexion.");
      }
      setIsUploading(false);
    }
  };

  // --- IA GENERATION ---
  const generateWithAI = () => {
    const rnd = AI_TITLE_SUGGESTIONS[Math.floor(Math.random() * AI_TITLE_SUGGESTIONS.length)];
    setTitle(rnd.t);
    setHashtags(rnd.h);
  };

  // --- Format file size ---
  const formatSize = (bytes) => {
    if (!bytes) return '';
    if (bytes > 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / 1024).toFixed(0)} KB`;
  };

  // --- Format duration ---
  const formatDuration = (s) => {
    if (!s) return '';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  // --- Parse hashtags for display ---
  const parsedHashtags = extractHashtags(hashtags);

  if (!showModal) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex items-center justify-center sm:p-4">

        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.95 }}
          className="bg-gray-900 w-full h-full sm:h-[85vh] sm:max-w-lg sm:rounded-3xl border border-gray-800 shadow-2xl flex flex-col relative overflow-hidden"
        >

          {/* ================= HEADER ================= */}
          {step !== "camera" && (
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 bg-gray-900/90 z-20">
              <div className="flex items-center gap-3">
                {step !== "upload" && (
                  <button onClick={() => setStep(step === "publish" ? "edit" : "upload")} className="text-white p-2 -ml-2 rounded-full hover:bg-gray-800 transition">
                    <FaArrowLeft />
                  </button>
                )}
                <div>
                  <h2 className="text-lg font-bold text-white">
                    {step === "upload" ? "Créer" : step === "edit" ? "Éditer" : "Publier"}
                  </h2>
                  {/* Progress indicator */}
                  <div className="flex gap-1 mt-1">
                    {["upload", "edit", "publish"].map((s, i) => (
                      <div key={s} className={`h-1 rounded-full transition-all duration-300 ${
                        step === s ? "w-6 bg-orange-500" :
                        (["upload", "edit", "publish"].indexOf(step) > i ? "w-4 bg-orange-400" : "w-4 bg-gray-700")
                      }`} />
                    ))}
                  </div>
                </div>
              </div>

              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-white p-2 -mr-2 rounded-full hover:bg-gray-800 transition"
                disabled={isUploading}
              >
                <FaTimes size={20} />
              </button>
            </div>
          )}

          {/* ================= CONTENU ================= */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden relative bg-black custom-scrollbar">

            {/* ETAPE 1: UPLOAD */}
            {step === "upload" && (
              <div className="h-full flex flex-col items-center justify-center p-6 gap-8 animate-in fade-in zoom-in duration-300">
                <div className="text-center space-y-3">
                  <div className="w-20 h-20 bg-gradient-to-tr from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-purple-500/30 mb-4">
                    <FaVideo className="text-4xl text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-white">Partagez votre univers</h3>
                  <p className="text-gray-400 text-sm max-w-xs mx-auto">Importez une vidéo de votre galerie ou filmez directement.</p>
                </div>

                <div className="grid gap-4 w-full max-w-xs">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-4 p-5 bg-gray-800 rounded-2xl hover:bg-gray-700 transition border border-gray-700 group active:scale-95"
                  >
                    <div className="w-12 h-12 bg-blue-500/20 text-blue-400 rounded-full flex items-center justify-center group-hover:scale-110 transition">
                      <FaUpload size={20} />
                    </div>
                    <div className="text-left">
                      <p className="text-white font-bold text-lg">Importer</p>
                      <p className="text-xs text-gray-500">MP4, WebM (Max 150MB)</p>
                    </div>
                  </button>

                  <button
                    onClick={initCamera}
                    className="flex items-center gap-4 p-5 bg-gray-800 rounded-2xl hover:bg-gray-700 transition border border-gray-700 group active:scale-95"
                  >
                    <div className="w-12 h-12 bg-pink-500/20 text-pink-400 rounded-full flex items-center justify-center group-hover:scale-110 transition">
                      <FaCamera size={20} />
                    </div>
                    <div className="text-left">
                      <p className="text-white font-bold text-lg">Caméra</p>
                      <p className="text-xs text-gray-500">Filmer maintenant (60s)</p>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* MODE CAMERA (Full Screen) */}
            {step === "camera" && (
              <div className="absolute inset-0 bg-black flex flex-col z-50">
                <video
                  ref={cameraVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />

                {!cameraReady && (
                  <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
                    <div className="text-center space-y-3">
                      <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin mx-auto" />
                      <p className="text-white font-medium">Initialisation de la caméra...</p>
                    </div>
                  </div>
                )}

                {isRecording && (
                  <div className="absolute top-6 left-0 right-0 flex justify-center z-10">
                    <span className="bg-red-600/90 backdrop-blur px-4 py-1.5 rounded-full text-white font-mono text-sm shadow-lg animate-pulse border border-red-400/50">
                      {Math.floor(recordingTime / 60).toString().padStart(2, '0')}:{(recordingTime % 60).toString().padStart(2, '0')} / 01:00
                    </span>
                  </div>
                )}

                <div className="absolute bottom-10 inset-x-0 flex items-center justify-center gap-12 pb-safe z-10">
                  <button
                    onClick={cancelCamera}
                    className="p-4 bg-gray-800/80 text-white rounded-full hover:bg-gray-700 backdrop-blur active:scale-95 transition"
                  >
                    <FaTimes size={20} />
                  </button>

                  {!isRecording ? (
                    <button
                      onClick={startRecording}
                      disabled={!cameraReady}
                      className="w-20 h-20 border-4 border-white rounded-full p-2 transition-transform active:scale-90 disabled:opacity-50"
                    >
                      <div className="w-full h-full bg-red-600 rounded-full" />
                    </button>
                  ) : (
                    <button
                      onClick={stopRecording}
                      className="w-20 h-20 border-4 border-white rounded-full p-2 transition-transform active:scale-90"
                    >
                      <div className="w-full h-full bg-red-600 rounded-sm animate-pulse" />
                    </button>
                  )}

                  <div className="w-14" />
                </div>
              </div>
            )}

            {/* ETAPE 2: EDIT */}
            {step === "edit" && videoURL && (
              <div className="flex flex-col h-full bg-gray-900 animate-in fade-in duration-300">
                <div className="flex-1 flex items-center justify-center bg-black py-4 relative">
                  <video
                    ref={videoRef}
                    src={videoURL}
                    className="max-h-[55vh] sm:max-h-[60vh] w-auto rounded-lg shadow-2xl"
                    controls loop playsInline
                    style={{ filter: selectedFilter !== 'none' ? selectedFilter : 'none' }}
                  />

                  {/* Video info overlay */}
                  {(videoDuration > 0 || videoSize > 0) && (
                    <div className="absolute bottom-2 left-2 right-2 flex gap-2 justify-center">
                      {videoDuration > 0 && (
                        <span className="bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded-full text-white text-xs flex items-center gap-1">
                          <FaClock size={8} /> {formatDuration(videoDuration)}
                        </span>
                      )}
                      {videoSize > 0 && (
                        <span className="bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded-full text-white text-xs">
                          {formatSize(videoSize)}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Filtres */}
                <div className="p-4 bg-gray-900 border-t border-gray-800">
                  <p className="text-white text-xs font-bold mb-3 uppercase tracking-wide opacity-70 flex items-center gap-2">
                    <HiSparkles className="text-yellow-400" /> Filtres disponibles
                  </p>
                  <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide snap-x">
                    {[
                      { name: 'Normal', val: 'none' },
                      { name: 'N&B', val: 'grayscale(1)' },
                      { name: 'Sépia', val: 'sepia(0.6)' },
                      { name: 'Vif', val: 'saturate(2)' },
                      { name: 'Cinéma', val: 'contrast(1.2) brightness(0.9)' },
                      { name: 'Rétro', val: 'sepia(0.4) contrast(1.2)' },
                      { name: 'Froid', val: 'hue-rotate(180deg)' }
                    ].map((f, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedFilter(f.val)}
                        className={`shrink-0 w-20 h-24 rounded-xl overflow-hidden border-2 relative transition-all snap-center ${selectedFilter === f.val ? 'border-blue-500 scale-105 shadow-lg shadow-blue-500/20' : 'border-gray-700 hover:border-gray-500'}`}
                      >
                        <video src={videoURL} className="absolute inset-0 w-full h-full object-cover" muted style={{ filter: f.val }} />
                        <span className="absolute bottom-0 w-full text-[10px] bg-black/70 backdrop-blur-sm text-white text-center py-1.5 font-bold">
                          {f.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ETAPE 3: PUBLISH */}
            {step === "publish" && (
              <div className="p-6 space-y-5 animate-in slide-in-from-right duration-300">
                <div className="flex gap-4 items-start">
                  <div className="w-24 aspect-[9/16] bg-black rounded-lg overflow-hidden shrink-0 border border-gray-700 shadow-lg relative">
                    <video src={videoURL} className="w-full h-full object-cover opacity-80" style={{ filter: selectedFilter }} />
                    {/* Watermark preview */}
                    {enableWatermark && (
                      <div className="absolute bottom-1 right-1 bg-black/60 backdrop-blur-sm rounded px-1.5 py-0.5">
                        <span className="text-white text-[7px] font-bold">Chantilink</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 space-y-3">
                    <div>
                      <label className="text-xs text-gray-400 font-bold uppercase tracking-wide">Légende</label>
                      <textarea
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        className="w-full bg-transparent text-white text-base mt-2 border-b border-gray-700 focus:border-orange-500 outline-none pb-2 resize-none placeholder-gray-600 transition-colors"
                        placeholder="Écrivez une légende captivante..."
                        rows={3}
                        maxLength={150}
                      />
                      <div className="text-right text-[10px] text-gray-500">{title.length}/150</div>
                    </div>

                    <button onClick={generateWithAI} className="text-xs bg-purple-500/10 border border-purple-500/30 text-purple-300 px-3 py-1.5 rounded-full flex items-center gap-1 w-fit hover:bg-purple-500/20 transition active:scale-95">
                      <FaMagic /> Générer une idée IA
                    </button>
                  </div>
                </div>

                {/* --- Description --- */}
                <div className="space-y-2">
                  <label className="text-xs text-gray-400 font-bold uppercase tracking-wide">Description (optionnel)</label>
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    className="w-full bg-gray-800/60 text-white text-sm p-3 rounded-xl border border-gray-700 focus:border-orange-500 outline-none resize-none placeholder-gray-500 transition-colors"
                    placeholder="Ajoutez une description détaillée..."
                    rows={3}
                    maxLength={500}
                  />
                  <div className="text-right text-[10px] text-gray-500">{description.length}/500</div>
                </div>

                {/* --- Hashtags --- */}
                <div className="space-y-2">
                  <label className="text-xs text-gray-400 font-bold uppercase tracking-wide">Hashtags</label>
                  <div className="bg-gray-800/50 p-3 rounded-xl border border-gray-700 flex items-center gap-3 focus-within:border-orange-500 focus-within:bg-gray-800 transition-colors">
                    <FaHashtag className="text-orange-400" />
                    <input
                      value={hashtags}
                      onChange={e => setHashtags(e.target.value)}
                      className="bg-transparent flex-1 text-sm text-white outline-none placeholder-gray-500"
                      placeholder="ex: #humour #dance #challenge"
                    />
                  </div>
                  {/* Display parsed hashtags */}
                  {parsedHashtags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {parsedHashtags.slice(0, 8).map((h, i) => (
                        <span key={i} className="text-[10px] bg-orange-500/15 text-orange-300 px-2 py-0.5 rounded-full border border-orange-500/20">
                          #{h}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* --- Category --- */}
                <div className="space-y-2">
                  <label className="text-xs text-gray-400 font-bold uppercase tracking-wide flex items-center gap-1.5">
                    <FaTag className="text-orange-400" />
                    Catégorie
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {VIDEO_CATEGORIES.map(cat => (
                      <button
                        key={cat.value}
                        onClick={() => setCategory(cat.value)}
                        className={`text-left p-3 rounded-xl border transition-all text-xs font-medium ${
                          category === cat.value
                            ? "border-orange-500 bg-orange-500/10 text-white shadow-lg shadow-orange-500/10"
                            : "border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600"
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* --- Visibility --- */}
                <div className="space-y-2">
                  <label className="text-xs text-gray-400 font-bold uppercase tracking-wide">Visibilité</label>
                  <div className="flex gap-2">
                    {VISIBILITY_OPTIONS.map(opt => {
                      const Icon = opt.icon;
                      return (
                        <button
                          key={opt.value}
                          onClick={() => setVisibility(opt.value)}
                          className={`flex-1 flex flex-col items-center gap-1 p-3 rounded-xl border transition-all ${
                            visibility === opt.value
                              ? "border-orange-500 bg-orange-500/10 text-white"
                              : "border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600"
                          }`}
                        >
                          <Icon size={18} />
                          <span className="text-xs font-bold">{opt.label}</span>
                          <span className="text-[9px] opacity-60">{opt.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* --- Watermark Toggle --- */}
                <div className="flex items-center justify-between p-3 rounded-xl border border-gray-700 bg-gray-800/50">
                  <div className="flex items-center gap-3">
                    <FaWater className="text-blue-400" />
                    <div>
                      <p className="text-white text-sm font-bold">Marque Chantilink</p>
                      <p className="text-gray-400 text-xs">Affiche votre nom + la signature Chantilink</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setEnableWatermark(v => !v)}
                    className={`w-12 h-7 rounded-full transition-all relative ${
                      enableWatermark ? "bg-orange-500" : "bg-gray-600"
                    }`}
                  >
                    <div className={`w-5 h-5 bg-white rounded-full absolute top-1 transition-all ${
                      enableWatermark ? "left-6" : "left-1"
                    }`} />
                  </button>
                </div>

                {/* --- Schedule Date (optional) --- */}
                <div className="space-y-2">
                  <label className="text-xs text-gray-400 font-bold uppercase tracking-wide flex items-center gap-1.5">
                    <FaClock className="text-blue-400" />
                    Planifier (optionnel)
                  </label>
                  <input
                    type="datetime-local"
                    value={scheduleDate}
                    onChange={e => setScheduleDate(e.target.value)}
                    className="w-full bg-gray-800/50 text-white text-sm p-3 rounded-xl border border-gray-700 focus:border-orange-500 outline-none transition-colors"
                    style={{ colorScheme: "dark" }}
                  />
                  {scheduleDate && (
                    <p className="text-[10px] text-gray-400 flex items-center gap-1">
                      <FaClock size={8} />
                      La vidéo sera publiée à la date prévue
                    </p>
                  )}
                </div>

                {uploadError && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm p-4 rounded-xl flex items-start gap-3"
                  >
                    <FaExclamationCircle className="mt-0.5 shrink-0" />
                    <span>{uploadError}</span>
                  </motion.div>
                )}
              </div>
            )}
          </div>

          {/* ================= FOOTER ================= */}
          {step !== "camera" && step !== "upload" && (
            <div className="p-4 border-t border-gray-800 bg-gray-900/95 backdrop-blur-sm z-20">
              {step === "edit" ? (
                <button
                  onClick={() => setStep("publish")}
                  className="w-full py-3.5 bg-white text-black font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-gray-200 transition active:scale-95 shadow-lg"
                >
                  Suivant <FaChevronRight size={12} />
                </button>
              ) : (
                isUploading ? (
                  <div className="space-y-3">
                    <div className="flex justify-between text-xs text-gray-400 font-medium uppercase tracking-wide">
                      <span>Publication en cours...</span>
                      <span className="text-blue-400 font-bold">{uploadProgress}%</span>
                    </div>
                    <div className="h-2 bg-gray-800 rounded-full overflow-hidden shadow-inner">
                      <motion.div
                        className="h-full bg-gradient-to-r from-blue-500 to-purple-600"
                        initial={{ width: 0 }}
                        animate={{ width: `${uploadProgress}%` }}
                        transition={{ ease: "linear" }}
                      />
                    </div>
                    <p className="text-center text-[10px] text-gray-500 animate-pulse">Ne fermez pas cette fenêtre</p>
                  </div>
                ) : (
                  <button
                    onClick={handlePublish}
                    disabled={!title.trim()}
                    className={`w-full py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition active:scale-95 shadow-lg ${
                      title.trim()
                        ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-purple-900/20 hover:brightness-110'
                        : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    <HiSparkles className={title.trim() ? "animate-pulse" : ""} /> Publier maintenant
                  </button>
                )
              )}
            </div>
          )}

          {/* INPUT CACHÉ */}
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT_TYPES}
            onChange={handleFileSelect}
            className="hidden"
          />

        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default VideoModal;