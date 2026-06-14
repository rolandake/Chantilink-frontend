// 📁 src/pages/Videos/VideoModal.jsx — v2 REDESIGN
//
// ═══════════════════════════════════════════════════════════════════════════
// CHANGEMENTS v2 :
//  ✅ UI entièrement redessinée — style glassmorphism + gradients riches
//  ✅ Step "upload" repensé avec drag & drop
//  ✅ Step "edit" — prévisualisation immersive plein écran
//  ✅ Step "publish" — sections groupées, toggle animé, meilleures icônes
//  ✅ Progress bar animée dans le header
//  ✅ Animation de succès à la publication
//  ✅ onVideoPublished déclenche aussi un refresh des posts du profil
//    → la vidéo apparaît dans la grille média ProfileMediaGrid
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useVideos } from "../../context/VideoContext";
import { useAuth } from "../../context/AuthContext";
import axios from "axios";
import axiosClient from "../../api/axiosClientGlobal";
import {
  FaTimes, FaUpload, FaCamera, FaArrowLeft,
  FaMagic, FaHashtag, FaExclamationCircle, FaChevronRight, FaVideo,
  FaEye, FaEyeSlash, FaTag, FaWater, FaClock, FaCheck,
  FaPlay, FaPause, FaVolumeUp, FaVolumeMute,
} from "react-icons/fa";
import { HiSparkles } from "react-icons/hi2";
import { MdDragIndicator } from "react-icons/md";

// --- CONSTANTES ---
const MAX_FILE_SIZE = 150 * 1024 * 1024;
const ACCEPT_TYPES  = "video/mp4,video/webm,video/quicktime,video/x-msvideo";

const VIDEO_CATEGORIES = [
  { value: "btp",           label: "🏗️ BTP & Construction" },
  { value: "genie_civil",   label: "🏛️ Génie Civil"        },
  { value: "architecture",  label: "📐 Architecture"        },
  { value: "formation",     label: "📚 Formation"           },
  { value: "divertissement",label: "🎬 Divertissement"      },
  { value: "actualite",     label: "📰 Actualités"          },
  { value: "ambiance",      label: "🎥 Ambiance & Vlogs"    },
  { value: "autre",         label: "📋 Autre"               },
];

const VISIBILITY_OPTIONS = [
  { value: "public",    label: "Public",   icon: "🌍", desc: "Visible par tous"            },
  { value: "followers", label: "Abonnés",  icon: "👥", desc: "Vos abonnés seulement"       },
  { value: "private",   label: "Privé",    icon: "🔒", desc: "Visible uniquement par vous" },
];

const AI_SUGGESTIONS = [
  { t: "Regardez ça ! 😱",          h: "#viral #omg #fun"                  },
  { t: "Vibe du jour ✨",            h: "#mood #aesthetic #lifestyle"       },
  { t: "Incroyable talent 🔥",       h: "#talent #skill #wow"              },
  { t: "Moment inoubliable ❤️",      h: "#love #memory #best"             },
  { t: "Tuto express 🎯",            h: "#tuto #astuce #apprendre"         },
  { t: "Sur le chantier 🏗️",        h: "#btp #chantier #travaux"          },
  { t: "Coulisses du projet 🎬",     h: "#coulisses #projet #behindscenes" },
  { t: "Pro tip du jour 💡",         h: "#conseil #pro #expert"            },
];

const FILTERS = [
  { name: "Normal",  val: "none"                              },
  { name: "N&B",     val: "grayscale(1)"                      },
  { name: "Sépia",   val: "sepia(0.6)"                        },
  { name: "Vif",     val: "saturate(2)"                       },
  { name: "Cinéma",  val: "contrast(1.2) brightness(0.9)"     },
  { name: "Rétro",   val: "sepia(0.4) contrast(1.2)"          },
  { name: "Froid",   val: "hue-rotate(180deg)"                },
  { name: "Chaud",   val: "hue-rotate(330deg) saturate(1.4)"  },
];

const autoDetectCategory = (title, hashtags) => {
  const text = `${title} ${hashtags}`.toLowerCase();
  const map = [
    ["btp",           ["chantier","construction","btp","béton","maçonnerie","grue","pelleteuse"]],
    ["genie_civil",   ["génie civil","infrastructure","pont","route","terrassement"]],
    ["architecture",  ["architecture","bâtiment","design","plan"]],
    ["formation",     ["tutoriel","formation","cours","technique"]],
    ["divertissement",["funny","compilation","humour","viral"]],
    ["actualite",     ["actualité","news","breaking","annonce"]],
    ["ambiance",      ["vlog","ambiance","relaxing","asmr"]],
  ];
  for (const [cat, keywords] of map)
    if (keywords.some(kw => text.includes(kw))) return cat;
  return "autre";
};

const extractHashtags = (text) =>
  (text.match(/#[\p{L}\p{N}_-]+/gu) || []).map(h => h.replace(/^#/, "")).filter(h => h.length > 0);

const formatSize     = (b) => b > 1048576 ? `${(b/1048576).toFixed(1)} MB` : `${(b/1024).toFixed(0)} KB`;
const formatDuration = (s) => { if (!s) return ""; const m = Math.floor(s/60); return `${m}:${Math.floor(s%60).toString().padStart(2,"0")}`; };
const formatAmount   = (n) => n >= 1000 ? `${(n/1000).toFixed(n%1000===0?0:1)}K` : String(n);

// ─────────────────────────────────────────────────────────────────────────────
// STEP INDICATOR
// ─────────────────────────────────────────────────────────────────────────────
const STEPS = ["upload", "edit", "publish"];
const StepIndicator = ({ current }) => {
  const idx = STEPS.indexOf(current);
  return (
    <div className="flex items-center gap-1">
      {STEPS.map((s, i) => (
        <div key={s} className="flex items-center gap-1">
          <div className={`flex items-center justify-center rounded-full transition-all duration-300 text-xs font-bold
            ${i < idx  ? "w-5 h-5 bg-orange-500 text-white" : ""}
            ${i === idx ? "w-6 h-6 bg-gradient-to-br from-orange-500 to-pink-600 text-white shadow-lg shadow-orange-500/40" : ""}
            ${i > idx  ? "w-5 h-5 bg-gray-700 text-gray-500" : ""}
          `}>
            {i < idx ? <FaCheck size={8} /> : i + 1}
          </div>
          {i < STEPS.length - 1 && (
            <div className={`h-px w-6 rounded transition-all duration-500 ${i < idx ? "bg-orange-500" : "bg-gray-700"}`} />
          )}
        </div>
      ))}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// DRAG & DROP ZONE
// ─────────────────────────────────────────────────────────────────────────────
const DropZone = ({ onFile }) => {
  const [dragging, setDragging] = useState(false);

  const handleDragOver  = (e) => { e.preventDefault(); setDragging(true); };
  const handleDragLeave = ()  => setDragging(false);
  const handleDrop      = (e) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  };

  return (
    <motion.div
      onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
      animate={{ borderColor: dragging ? "#f97316" : "rgba(255,255,255,0.12)", scale: dragging ? 1.02 : 1 }}
      transition={{ duration: 0.18 }}
      className="relative w-full rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-3 p-8 cursor-pointer"
      style={{ background: dragging ? "rgba(249,115,22,0.07)" : "rgba(255,255,255,0.03)", minHeight: 140 }}
    >
      <div className="w-12 h-12 rounded-full flex items-center justify-center"
        style={{ background: "rgba(249,115,22,0.15)" }}>
        <FaVideo className="text-orange-400" size={22} />
      </div>
      <div className="text-center">
        <p className="text-white font-semibold text-sm">Déposez votre vidéo ici</p>
        <p className="text-gray-500 text-xs mt-1">MP4, WebM, MOV — max 150 MB</p>
      </div>
      {dragging && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="absolute inset-0 rounded-2xl flex items-center justify-center"
          style={{ background: "rgba(249,115,22,0.12)" }}>
          <p className="text-orange-400 font-bold text-base">Déposez ici !</p>
        </motion.div>
      )}
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// TOGGLE SWITCH
// ─────────────────────────────────────────────────────────────────────────────
const Toggle = ({ value, onChange }) => (
  <button onClick={() => onChange(!value)}
    className={`w-12 h-6 rounded-full relative transition-all duration-300 flex-shrink-0 ${value ? "bg-orange-500" : "bg-gray-700"}`}>
    <motion.div animate={{ left: value ? "calc(100% - 22px)" : "2px" }} transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md" />
  </button>
);

// ─────────────────────────────────────────────────────────────────────────────
// SUCCESS OVERLAY
// ─────────────────────────────────────────────────────────────────────────────
const SuccessOverlay = () => (
  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    className="absolute inset-0 z-50 flex flex-col items-center justify-center rounded-3xl"
    style={{ background: "linear-gradient(135deg, rgba(249,115,22,0.15), rgba(236,72,153,0.15))", backdropFilter: "blur(20px)" }}>
    <motion.div initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 20 }}
      className="w-24 h-24 rounded-full flex items-center justify-center mb-5 shadow-2xl"
      style={{ background: "linear-gradient(135deg, #f97316, #ec4899)" }}>
      <FaCheck className="text-white" size={36} />
    </motion.div>
    <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
      className="text-white text-xl font-bold">
      Vidéo publiée ! 🎉
    </motion.p>
    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
      className="text-gray-400 text-sm mt-2 text-center px-8">
      Votre vidéo est en ligne et visible dans votre profil
    </motion.p>
    <motion.div initial={{ width: 0 }} animate={{ width: 120 }} transition={{ delay: 0.6, duration: 1.8, ease: "linear" }}
      className="h-1 rounded-full mt-6 bg-gradient-to-r from-orange-500 to-pink-500" />
  </motion.div>
);

// ─────────────────────────────────────────────────────────────────────────────
// MODAL PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
const VideoModal = ({ showModal, setShowModal, onVideoPublished }) => {
  const fileInputRef       = useRef(null);
  const videoRef           = useRef(null);
  const cameraVideoRef     = useRef(null);
  const mediaRecorderRef   = useRef(null);
  const streamRef          = useRef(null);
  const recordingTimerRef  = useRef(null);
  const abortControllerRef = useRef(null);

  const { addVideo, fetchVideos } = useVideos();
  const { user: currentUser, getToken } = useAuth();

  // Steps & media
  const [step,         setStep]         = useState("upload");
  const [videoFile,    setVideoFile]    = useState(null);
  const [videoURL,     setVideoURL]     = useState(null);
  const [videoDuration,setVideoDuration]= useState(0);
  const [videoSize,    setVideoSize]    = useState(0);

  // Camera
  const [isRecording,   setIsRecording]   = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [cameraReady,   setCameraReady]   = useState(false);
  const [cameraFacing,  setCameraFacing]  = useState("user");

  // Form data
  const [title,           setTitle]           = useState("");
  const [description,     setDescription]     = useState("");
  const [hashtags,        setHashtags]        = useState("");
  const [selectedFilter,  setSelectedFilter]  = useState("none");
  const [category,        setCategory]        = useState("autre");
  const [visibility,      setVisibility]      = useState("public");
  const [enableWatermark, setEnableWatermark] = useState(true);
  const [scheduleDate,    setScheduleDate]    = useState("");

  // Upload state
  const [isUploading,    setIsUploading]    = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError,    setUploadError]    = useState(null);
  const [publishSuccess, setPublishSuccess] = useState(false);

  // Edit UI
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted,   setIsMuted]   = useState(false);

  // ── Auto detect category ─────────────────────────────────────────────────
  useEffect(() => {
    if (title || hashtags) {
      const d = autoDetectCategory(title, hashtags);
      if (d !== "autre" && category === "autre") setCategory(d);
    }
  }, [title, hashtags]);

  // ── Cleanup ──────────────────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (videoURL?.startsWith("blob:")) URL.revokeObjectURL(videoURL);
    if (abortControllerRef.current) abortControllerRef.current.abort();
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    setStep("upload"); setVideoFile(null); setVideoURL(null);
    setTitle(""); setDescription(""); setHashtags("");
    setCategory("autre"); setVisibility("public"); setEnableWatermark(true);
    setScheduleDate(""); setSelectedFilter("none");
    setIsUploading(false); setUploadProgress(0); setUploadError(null);
    setIsRecording(false); setCameraReady(false);
    setVideoDuration(0); setVideoSize(0); setPublishSuccess(false);
    setIsPlaying(false); setIsMuted(false);
  }, [videoURL]);

  const handleClose = () => {
    if (isUploading && !window.confirm("Upload en cours. Annuler ?")) return;
    cleanup(); setShowModal(false);
  };

  // ── File select ──────────────────────────────────────────────────────────
  const processFile = useCallback((file) => {
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) { alert(`Fichier trop lourd (${(file.size/1048576).toFixed(1)} MB). Max 150 MB.`); return; }
    if (!file.type.startsWith("video/")) { alert("Ce fichier n'est pas une vidéo valide."); return; }
    if (videoURL) URL.revokeObjectURL(videoURL);
    setVideoFile(file); setVideoSize(file.size);
    const url = URL.createObjectURL(file);
    setVideoURL(url);
    const tmp = document.createElement("video");
    tmp.preload = "metadata";
    tmp.onloadedmetadata = () => { setVideoDuration(tmp.duration || 0); URL.revokeObjectURL(tmp.src); };
    tmp.src = URL.createObjectURL(file);
    setStep("edit");
  }, [videoURL]);

  const handleFileSelect = (e) => { processFile(e.target.files[0]); e.target.value = null; };

  // ── Camera ───────────────────────────────────────────────────────────────
  const initCamera = async (facingMode = "user") => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { aspectRatio: { ideal: 9/16 }, facingMode, width: { ideal: 1080 }, height: { ideal: 1920 } },
        audio: true,
      });
      streamRef.current = stream;
      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = stream;
        cameraVideoRef.current.onloadedmetadata = () => setCameraReady(true);
      }
      setStep("camera");
    } catch (err) {
      const msgs = { NotAllowedError: "Permission refusée. Autorisez la caméra.", NotFoundError: "Aucune caméra détectée.", NotReadableError: "Caméra déjà utilisée." };
      alert(msgs[err.name] || "Impossible d'accéder à la caméra.");
      setStep("upload");
    }
  };

  const startRecording = () => {
    if (!streamRef.current) return;
    const mimeType = MediaRecorder.isTypeSupported("video/webm; codecs=vp9") ? "video/webm; codecs=vp9"
      : MediaRecorder.isTypeSupported("video/webm") ? "video/webm" : "video/mp4";
    const recorder = new MediaRecorder(streamRef.current, { mimeType, videoBitsPerSecond: 2500000 });
    const chunks = [];
    recorder.ondataavailable = (e) => { if (e.data?.size > 0) chunks.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType });
      const file = new File([blob], `cam_${Date.now()}.${mimeType.includes("webm") ? "webm" : "mp4"}`, { type: mimeType });
      setVideoFile(file); setVideoURL(URL.createObjectURL(blob)); setVideoSize(blob.size);
      if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
      setCameraReady(false); setStep("edit");
    };
    mediaRecorderRef.current = recorder;
    recorder.start(1000); setIsRecording(true);
    let time = 0; setRecordingTime(0);
    recordingTimerRef.current = setInterval(() => {
      time++; setRecordingTime(time);
      if (time >= 60) stopRecording();
    }, 1000);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state !== "inactive") mediaRecorderRef.current.stop();
    setIsRecording(false);
    if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
  };

  const cancelCamera = () => {
    stopRecording();
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    setCameraReady(false); setStep("upload");
  };

  const flipCamera = async () => {
    const next = cameraFacing === "user" ? "environment" : "user";
    setCameraFacing(next);
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    setCameraReady(false);
    await initCamera(next);
  };

  // ── Video controls in edit ────────────────────────────────────────────────
  const togglePlay = () => {
    const v = videoRef.current; if (!v) return;
    if (v.paused) { v.play(); setIsPlaying(true); } else { v.pause(); setIsPlaying(false); }
  };
  const toggleMute = () => {
    const v = videoRef.current; if (!v) return;
    v.muted = !v.muted; setIsMuted(v.muted);
  };

  // ── AI generation ─────────────────────────────────────────────────────────
  const generateWithAI = () => {
    const r = AI_SUGGESTIONS[Math.floor(Math.random() * AI_SUGGESTIONS.length)];
    setTitle(r.t); setHashtags(r.h);
  };

  // ── PUBLISH ───────────────────────────────────────────────────────────────
  const handlePublish = async () => {
    if (!videoFile || !title.trim()) return;
    setIsUploading(true); setUploadError(null);
    abortControllerRef.current = new AbortController();

    const formData = new FormData();
    formData.append("video", videoFile);
    formData.append("title", title.trim());
    formData.append("description", description || "");
    formData.append("hashtags", hashtags || "");
    formData.append("filter", selectedFilter);
    formData.append("category", category);
    formData.append("visibility", visibility);
    formData.append("enableWatermark", enableWatermark ? "true" : "false");
    if (scheduleDate) formData.append("scheduledAt", scheduleDate);
    if (videoDuration) formData.append("duration", String(videoDuration));

    try {
      const token = await getToken();
      if (!token) throw new Error("Vous devez être connecté pour publier.");

      const res = await axiosClient.post("/videos", formData, {
        onUploadProgress: (e) => setUploadProgress(Math.round((e.loaded * 100) / e.total)),
        signal: abortControllerRef.current.signal,
        timeout: 300000,
      });

      const videoData = res.data.video || res.data;
      if (addVideo) addVideo(videoData);
      if (fetchVideos) fetchVideos(true);

      // ── Créer un post → la vidéo apparaît dans ProfileMediaGrid ──────────
      // Le backend POST /api/posts attend :
      //   - content (texte)
      //   - media[] (fichier via multer) → déclenche l'upload R2 et remplit post.media
      //   - videoUrl (fallback si pas de re-upload souhaité)
      //   - thumbnail (URL string)
      //   - privacy → "Public" | "Friends" | "Private" (avec majuscule)
      try {
        const videoUrl   = videoData.videoUrl  || videoData.url         || videoData.cloudinaryUrl || "";
        const thumbnail  = videoData.thumbnail || videoData.poster       || videoData.previewUrl    || "";
        const privacyMap = { public: "Public", followers: "Friends", private: "Private" };

        const postForm = new FormData();
        // Champs texte
        postForm.append("content",   title.trim());
        postForm.append("contenu",   title.trim()); // rétrocompat backend
        postForm.append("privacy",   privacyMap[visibility] || "Public");
        postForm.append("category",  category || "autre");
        if (description) postForm.append("description", description);
        if (hashtags) {
          // Convertir "#btp #chantier" → tableau de tags
          const tagList = hashtags.match(/#[\p{L}\p{N}_-]+/gu) || [];
          tagList.forEach(t => postForm.append("tags[]", t.replace(/^#/, "")));
        }

        // Stratégie d'upload :
        // 1. Si la vidéo est déjà uploadée sur R2/Cloudinary (videoUrl disponible)
        //    → on n'envoie PAS le fichier une 2e fois (économie de bande passante)
        //    → on envoie juste videoUrl + thumbnail comme champs texte
        //    → le backend les stocke dans post.videoUrl et post.thumbnail
        // 2. Si pas de videoUrl (cas improbable), on renvoie le fichier dans media[]
        if (videoUrl) {
          postForm.append("videoUrl",  videoUrl);
          if (thumbnail) postForm.append("thumbnail", thumbnail);
        } else if (videoFile) {
          // Fallback : re-uploader le fichier via media[]
          postForm.append("media", videoFile, videoFile.name);
        }

        await axiosClient.post("/posts", postForm, {
          headers: { "Content-Type": "multipart/form-data" },
          timeout: 60000,
        });

        console.log("✅ Post profil créé — vidéo visible dans ProfileMediaGrid");
      } catch (postErr) {
        // Non bloquant — la vidéo est publiée même si le post profil échoue
        console.warn("⚠️ Création post profil échouée (non bloquant):", postErr?.response?.data || postErr?.message);
      }

      // ── Succès ────────────────────────────────────────────────────────────
      setPublishSuccess(true);
      setTimeout(() => {
        if (onVideoPublished) onVideoPublished(res.data);
        handleClose();
      }, 2400);

    } catch (err) {
      if (axios.isCancel(err)) setUploadError("Upload annulé.");
      else setUploadError(err.response?.data?.message || "Erreur lors de l'upload. Vérifiez votre connexion.");
      setIsUploading(false);
    }
  };

  const parsedHashtags = extractHashtags(hashtags);

  if (!showModal) return null;

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4"
        style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)" }}>

        <motion.div
          initial={{ opacity: 0, y: 60, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 60, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 340, damping: 30 }}
          className="relative w-full sm:max-w-lg flex flex-col overflow-hidden"
          style={{
            height: "100dvh", maxHeight: "100dvh",
            background: "linear-gradient(160deg, #111118 0%, #0e0e14 60%, #12101a 100%)",
            borderRadius: "28px 28px 0 0",
            border: "1px solid rgba(255,255,255,0.07)",
            boxShadow: "0 -8px 40px rgba(0,0,0,0.5)",
          }}
        >
          {/* ── SUCCESS OVERLAY ── */}
          <AnimatePresence>
            {publishSuccess && <SuccessOverlay />}
          </AnimatePresence>

          {/* ── HEADER ── */}
          {step !== "camera" && (
            <div className="flex items-center justify-between px-5 py-4 flex-shrink-0"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="flex items-center gap-3">
                {step !== "upload" && (
                  <motion.button whileTap={{ scale: 0.9 }}
                    onClick={() => setStep(step === "publish" ? "edit" : "upload")}
                    className="w-9 h-9 rounded-full flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                    style={{ background: "rgba(255,255,255,0.06)" }}>
                    <FaArrowLeft size={14} />
                  </motion.button>
                )}
                <div>
                  <h2 className="text-base font-bold text-white">
                    {step === "upload" ? "Nouvelle vidéo" : step === "edit" ? "Éditer" : "Détails"}
                  </h2>
                  <StepIndicator current={step} />
                </div>
              </div>
              <motion.button whileTap={{ scale: 0.9 }} onClick={handleClose} disabled={isUploading}
                className="w-9 h-9 rounded-full flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                style={{ background: "rgba(255,255,255,0.06)" }}>
                <FaTimes size={16} />
              </motion.button>
            </div>
          )}

          {/* ── CONTENU ── */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden" style={{ scrollbarWidth: "none" }}>

            {/* ═══════════════ STEP 1 : UPLOAD ═══════════════ */}
            <AnimatePresence mode="wait">
              {step === "upload" && (
                <motion.div key="upload"
                  initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                  className="flex flex-col gap-5 p-5 h-full">

                  {/* Hero */}
                  <div className="text-center pt-2 pb-1">
                    <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                      style={{ background: "linear-gradient(135deg, rgba(249,115,22,0.2), rgba(236,72,153,0.2))", border: "1px solid rgba(249,115,22,0.3)" }}>
                      <FaVideo className="text-orange-400" size={28} />
                    </div>
                    <h3 className="text-xl font-bold text-white">Partagez votre univers</h3>
                    <p className="text-gray-500 text-sm mt-1">Importez ou filmez directement depuis l'app</p>
                  </div>

                  {/* Drag & drop */}
                  <div onClick={() => fileInputRef.current?.click()} className="cursor-pointer">
                    <DropZone onFile={processFile} />
                  </div>

                  {/* Boutons */}
                  <div className="grid grid-cols-2 gap-3">
                    <motion.button whileTap={{ scale: 0.97 }}
                      onClick={() => fileInputRef.current?.click()}
                      className="flex flex-col items-center gap-2 p-4 rounded-2xl transition-all active:scale-95"
                      style={{ background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)" }}>
                      <div className="w-10 h-10 rounded-full flex items-center justify-center"
                        style={{ background: "rgba(59,130,246,0.15)" }}>
                        <FaUpload className="text-blue-400" size={18} />
                      </div>
                      <div className="text-center">
                        <p className="text-white font-bold text-sm">Importer</p>
                        <p className="text-gray-500 text-xs">Galerie</p>
                      </div>
                    </motion.button>

                    <motion.button whileTap={{ scale: 0.97 }}
                      onClick={() => initCamera()}
                      className="flex flex-col items-center gap-2 p-4 rounded-2xl transition-all active:scale-95"
                      style={{ background: "rgba(236,72,153,0.1)", border: "1px solid rgba(236,72,153,0.2)" }}>
                      <div className="w-10 h-10 rounded-full flex items-center justify-center"
                        style={{ background: "rgba(236,72,153,0.15)" }}>
                        <FaCamera className="text-pink-400" size={18} />
                      </div>
                      <div className="text-center">
                        <p className="text-white font-bold text-sm">Caméra</p>
                        <p className="text-gray-500 text-xs">Max 60s</p>
                      </div>
                    </motion.button>
                  </div>

                  {/* Tips */}
                  <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                    <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-3">Conseils</p>
                    <div className="space-y-2">
                      {["Format vertical 9:16 recommandé","Résolution 1080×1920 idéale","Max 150 MB — MP4, WebM, MOV"].map((tip, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-orange-500 flex-shrink-0" />
                          <p className="text-gray-400 text-xs">{tip}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ═══════════════ STEP CAMERA ═══════════════ */}
            {step === "camera" && (
              <div className="absolute inset-0 bg-black z-50">
                <video ref={cameraVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />

                {/* Loading overlay */}
                {!cameraReady && (
                  <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
                    <div className="text-center space-y-3">
                      <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin mx-auto" />
                      <p className="text-white/70 font-medium text-sm">Initialisation…</p>
                    </div>
                  </div>
                )}

                {/* Recording timer */}
                {isRecording && (
                  <div className="absolute top-6 inset-x-0 flex justify-center">
                    <div className="flex items-center gap-2 px-4 py-2 rounded-full"
                      style={{ background: "rgba(239,68,68,0.85)", backdropFilter: "blur(10px)" }}>
                      <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                      <span className="text-white font-mono font-bold text-sm">
                        {Math.floor(recordingTime/60).toString().padStart(2,"0")}:{(recordingTime%60).toString().padStart(2,"0")} / 01:00
                      </span>
                    </div>
                  </div>
                )}

                {/* Progress bar */}
                {isRecording && (
                  <div className="absolute top-0 left-0 right-0 h-1"
                    style={{ background: "rgba(255,255,255,0.15)" }}>
                    <div className="h-full bg-red-500 transition-all"
                      style={{ width: `${(recordingTime/60)*100}%` }} />
                  </div>
                )}

                {/* Controls */}
                <div className="absolute bottom-0 left-0 right-0 pb-10 px-6"
                  style={{ background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)", paddingTop: 60 }}>
                  <div className="flex items-center justify-between">
                    {/* Cancel */}
                    <motion.button whileTap={{ scale: 0.9 }} onClick={cancelCamera}
                      className="w-12 h-12 rounded-full flex items-center justify-center text-white"
                      style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.2)" }}>
                      <FaTimes size={18} />
                    </motion.button>

                    {/* Record button */}
                    <motion.button whileTap={{ scale: 0.93 }}
                      onClick={isRecording ? stopRecording : startRecording}
                      disabled={!cameraReady}
                      className="w-20 h-20 rounded-full flex items-center justify-center disabled:opacity-40"
                      style={{ border: "4px solid white", background: "transparent" }}>
                      <motion.div
                        animate={{ borderRadius: isRecording ? "6px" : "50%", width: isRecording ? 28 : 64, height: isRecording ? 28 : 64 }}
                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                        className="bg-red-500" />
                    </motion.button>

                    {/* Flip */}
                    <motion.button whileTap={{ scale: 0.9 }} onClick={flipCamera}
                      className="w-12 h-12 rounded-full flex items-center justify-center text-white"
                      style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.2)" }}>
                      <span style={{ fontSize: 22 }}>🔄</span>
                    </motion.button>
                  </div>
                </div>
              </div>
            )}

            {/* ═══════════════ STEP 2 : EDIT ═══════════════ */}
            <AnimatePresence mode="wait">
              {step === "edit" && videoURL && (
                <motion.div key="edit"
                  initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                  className="flex flex-col">

                  {/* Preview vidéo */}
                  <div className="relative bg-black" style={{ height: "55vmax", maxHeight: "58vh", minHeight: 240 }}>
                    <video ref={videoRef} src={videoURL} loop playsInline
                      style={{ width: "100%", height: "100%", objectFit: "contain", filter: selectedFilter !== "none" ? selectedFilter : "none" }}
                      onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} />

                    {/* Controls overlay */}
                    <div className="absolute inset-0 flex items-center justify-center gap-6 pointer-events-none">
                      <div className="flex gap-4 pointer-events-auto">
                        <motion.button whileTap={{ scale: 0.85 }} onClick={togglePlay}
                          className="w-14 h-14 rounded-full flex items-center justify-center text-white"
                          style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.15)" }}>
                          {isPlaying ? <FaPause size={18} /> : <FaPlay size={18} style={{ marginLeft: 2 }} />}
                        </motion.button>
                      </div>
                    </div>

                    {/* Mute + infos */}
                    <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between pointer-events-none">
                      <div className="flex gap-2">
                        {videoDuration > 0 && (
                          <span className="text-xs font-bold text-white px-2 py-1 rounded-full"
                            style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}>
                            ⏱ {formatDuration(videoDuration)}
                          </span>
                        )}
                        {videoSize > 0 && (
                          <span className="text-xs font-bold text-white px-2 py-1 rounded-full"
                            style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}>
                            {formatSize(videoSize)}
                          </span>
                        )}
                      </div>
                      <motion.button whileTap={{ scale: 0.85 }} onClick={toggleMute}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white pointer-events-auto"
                        style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)" }}>
                        {isMuted ? <FaVolumeMute size={12} /> : <FaVolumeUp size={12} />}
                      </motion.button>
                    </div>
                  </div>

                  {/* Filtres */}
                  <div className="p-4 flex-shrink-0">
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-3 flex items-center gap-2">
                      <HiSparkles className="text-yellow-400" /> Filtres
                    </p>
                    <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
                      {FILTERS.map((f) => (
                        <button key={f.val} onClick={() => setSelectedFilter(f.val)}
                          className="flex-shrink-0 flex flex-col items-center gap-1.5">
                          <div className={`w-16 h-20 rounded-xl overflow-hidden relative transition-all duration-200
                            ${selectedFilter === f.val ? "ring-2 ring-orange-500 scale-105" : "ring-1 ring-white/10"}`}>
                            <video src={videoURL} className="absolute inset-0 w-full h-full object-cover" muted
                              style={{ filter: f.val !== "none" ? f.val : "none" }} />
                          </div>
                          <span className={`text-[10px] font-bold transition-colors ${selectedFilter === f.val ? "text-orange-400" : "text-gray-500"}`}>
                            {f.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ═══════════════ STEP 3 : PUBLISH ═══════════════ */}
            <AnimatePresence mode="wait">
              {step === "publish" && (
                <motion.div key="publish"
                  initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                  className="p-5 space-y-5">

                  {/* Preview + Caption */}
                  <div className="flex gap-4">
                    {/* Miniature */}
                    <div className="w-20 rounded-xl overflow-hidden flex-shrink-0 relative"
                      style={{ aspectRatio: "9/16", background: "#111" }}>
                      <video src={videoURL} className="w-full h-full object-cover"
                        style={{ filter: selectedFilter !== "none" ? selectedFilter : "none" }} />
                      {enableWatermark && (
                        <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded"
                          style={{ background: "rgba(0,0,0,0.65)" }}>
                          <span className="text-white text-[7px] font-bold">Chantilink</span>
                        </div>
                      )}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <FaPlay className="text-white/30" size={14} />
                      </div>
                    </div>

                    {/* Légende */}
                    <div className="flex-1 flex flex-col gap-2">
                      <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Légende *</label>
                      <textarea value={title} onChange={e => setTitle(e.target.value)}
                        className="flex-1 bg-transparent text-white text-sm outline-none resize-none placeholder-gray-600"
                        style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}
                        placeholder="Décrivez votre vidéo…" rows={3} maxLength={150} />
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-gray-600">{title.length}/150</span>
                        <motion.button whileTap={{ scale: 0.95 }} onClick={generateWithAI}
                          className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-semibold"
                          style={{ background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.3)", color: "#a78bfa" }}>
                          <FaMagic size={9} /> Idée IA
                        </motion.button>
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <div className="space-y-2">
                    <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Description</label>
                    <textarea value={description} onChange={e => setDescription(e.target.value)}
                      className="w-full text-white text-sm p-3 rounded-xl outline-none resize-none placeholder-gray-600 transition-all"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", minHeight: 72 }}
                      placeholder="Ajoutez une description détaillée…" maxLength={500} />
                    <div className="text-right text-[10px] text-gray-600">{description.length}/500</div>
                  </div>

                  {/* Hashtags */}
                  <div className="space-y-2">
                    <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Hashtags</label>
                    <div className="flex items-center gap-2 p-3 rounded-xl transition-all"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                      <FaHashtag className="text-orange-400 flex-shrink-0" size={13} />
                      <input value={hashtags} onChange={e => setHashtags(e.target.value)}
                        className="bg-transparent flex-1 text-sm text-white outline-none placeholder-gray-600"
                        placeholder="#btp #chantier #construction" />
                    </div>
                    {parsedHashtags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {parsedHashtags.slice(0, 8).map((h, i) => (
                          <span key={i} className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                            style={{ background: "rgba(249,115,22,0.12)", border: "1px solid rgba(249,115,22,0.2)", color: "#fb923c" }}>
                            #{h}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Catégorie */}
                  <div className="space-y-2">
                    <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest flex items-center gap-1.5">
                      <FaTag className="text-orange-400" size={10} /> Catégorie
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {VIDEO_CATEGORIES.map(cat => (
                        <button key={cat.value} onClick={() => setCategory(cat.value)}
                          className="text-left p-2.5 rounded-xl text-xs font-semibold transition-all"
                          style={{
                            background: category === cat.value ? "rgba(249,115,22,0.12)" : "rgba(255,255,255,0.04)",
                            border: `1px solid ${category === cat.value ? "rgba(249,115,22,0.4)" : "rgba(255,255,255,0.07)"}`,
                            color: category === cat.value ? "#fb923c" : "#6b7280",
                          }}>
                          {cat.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Visibilité */}
                  <div className="space-y-2">
                    <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Visibilité</label>
                    <div className="grid grid-cols-3 gap-2">
                      {VISIBILITY_OPTIONS.map(opt => (
                        <button key={opt.value} onClick={() => setVisibility(opt.value)}
                          className="flex flex-col items-center gap-1 p-3 rounded-xl transition-all"
                          style={{
                            background: visibility === opt.value ? "rgba(249,115,22,0.12)" : "rgba(255,255,255,0.04)",
                            border: `1px solid ${visibility === opt.value ? "rgba(249,115,22,0.4)" : "rgba(255,255,255,0.07)"}`,
                          }}>
                          <span style={{ fontSize: 18 }}>{opt.icon}</span>
                          <span className="text-xs font-bold" style={{ color: visibility === opt.value ? "#fb923c" : "#6b7280" }}>{opt.label}</span>
                          <span className="text-[9px] text-gray-600 text-center leading-tight">{opt.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Options avancées */}
                  <div className="space-y-3">
                    <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Options</label>

                    {/* Watermark */}
                    <div className="flex items-center justify-between p-3 rounded-xl"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                      <div className="flex items-center gap-3">
                        <span style={{ fontSize: 18 }}>💧</span>
                        <div>
                          <p className="text-white text-sm font-semibold">Marque Chantilink</p>
                          <p className="text-gray-500 text-xs">Filigrane sur votre vidéo</p>
                        </div>
                      </div>
                      <Toggle value={enableWatermark} onChange={setEnableWatermark} />
                    </div>

                    {/* Planifier */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <FaClock className="text-blue-400" size={11} />
                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Planifier (optionnel)</span>
                      </div>
                      <input type="datetime-local" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)}
                        className="w-full text-white text-sm p-3 rounded-xl outline-none transition-all"
                        style={{
                          background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                          colorScheme: "dark",
                        }} />
                      {scheduleDate && (
                        <p className="text-[10px] text-gray-500 flex items-center gap-1">
                          <FaClock size={8} /> La vidéo sera publiée automatiquement à la date choisie
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Error */}
                  {uploadError && (
                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                      className="flex items-start gap-3 p-3 rounded-xl text-sm"
                      style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171" }}>
                      <FaExclamationCircle className="flex-shrink-0 mt-0.5" />
                      <span>{uploadError}</span>
                    </motion.div>
                  )}

                  {/* Spacer pour le footer */}
                  <div className="h-4" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── FOOTER ── */}
          {step !== "camera" && step !== "upload" && (
            <div className="flex-shrink-0 p-4"
              style={{ borderTop: "1px solid rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.3)", backdropFilter: "blur(20px)" }}>

              {step === "edit" ? (
                <motion.button whileTap={{ scale: 0.97 }}
                  onClick={() => setStep("publish")}
                  className="w-full py-3.5 rounded-2xl font-bold text-base flex items-center justify-center gap-2 text-white transition-all"
                  style={{ background: "linear-gradient(135deg, #3b82f6, #8b5cf6)" }}>
                  Suivant <FaChevronRight size={12} />
                </motion.button>
              ) : isUploading ? (
                <div className="space-y-3">
                  <div className="flex justify-between text-xs font-semibold"
                    style={{ color: "rgba(255,255,255,0.5)" }}>
                    <span>Publication en cours…</span>
                    <span style={{ color: "#60a5fa" }}>{uploadProgress}%</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden"
                    style={{ background: "rgba(255,255,255,0.08)" }}>
                    <motion.div className="h-full rounded-full"
                      style={{ background: "linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899)" }}
                      initial={{ width: 0 }} animate={{ width: `${uploadProgress}%` }}
                      transition={{ ease: "linear" }} />
                  </div>
                  <p className="text-center text-[10px] text-gray-600 animate-pulse">Ne fermez pas cette fenêtre</p>
                </div>
              ) : (
                <motion.button whileTap={{ scale: 0.97 }}
                  onClick={handlePublish} disabled={!title.trim()}
                  className="w-full py-3.5 rounded-2xl font-bold text-base flex items-center justify-center gap-2 text-white transition-all"
                  style={{
                    background: title.trim()
                      ? "linear-gradient(135deg, #f97316, #ec4899)"
                      : "rgba(255,255,255,0.07)",
                    color: title.trim() ? "white" : "#4b5563",
                    cursor: title.trim() ? "pointer" : "not-allowed",
                    boxShadow: title.trim() ? "0 4px 24px rgba(249,115,22,0.35)" : "none",
                  }}>
                  <HiSparkles className={title.trim() ? "animate-pulse" : ""} />
                  Publier
                </motion.button>
              )}
            </div>
          )}

          {/* Input caché */}
          <input ref={fileInputRef} type="file" accept={ACCEPT_TYPES} onChange={handleFileSelect} className="hidden" />
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default VideoModal;