import React, { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useVideos } from "../../context/VideoContext";
import { useAuth } from "../../context/AuthContext";
import axios from "axios";
import {
  FaTimes, FaUpload, FaCamera, FaArrowLeft, 
  FaMagic, FaHashtag, FaExclamationCircle, FaChevronRight, FaVideo
} from "react-icons/fa";
import { HiSparkles } from "react-icons/hi2";

// --- CONSTANTES ---
const MAX_FILE_SIZE = 150 * 1024 * 1024; // 150MB
const ACCEPT_TYPES = "video/mp4,video/webm,video/quicktime,video/x-msvideo"; // ✅ Types MIME valides
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

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
  const { user: currentUser, getToken } = useAuth(); // ✅ Utilisation de getToken pour sécuriser l'appel

  // --- STATES ---
  const [step, setStep] = useState("upload"); // upload | edit | publish
  const [videoFile, setVideoFile] = useState(null);
  const [videoURL, setVideoURL] = useState(null);
  
  // Camera
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  
  // Data
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("none");
  
  // Upload State
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState(null);

  // --- NETTOYAGE ---
  const cleanup = useCallback(() => {
    // Arrêter la caméra proprement
    if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
    }
    // Libérer la mémoire vidéo
    if (videoURL && videoURL.startsWith('blob:')) {
        URL.revokeObjectURL(videoURL);
    }
    // Annuler requête en cours
    if (abortControllerRef.current) {
        abortControllerRef.current.abort();
    }
    // Reset states
    setStep("upload");
    setVideoFile(null);
    setVideoURL(null);
    setTitle("");
    setDescription("");
    setHashtags("");
    setIsUploading(false);
    setUploadProgress(0);
    setUploadError(null);
    setIsRecording(false);
  }, [videoURL]);

  // Fermeture modale avec confirmation si upload en cours
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

    // Validation taille
    if (file.size > MAX_FILE_SIZE) {
        alert(`Fichier trop lourd (${(file.size / 1024 / 1024).toFixed(1)}MB). Max 150MB.`);
        return;
    }

    // Validation type (sécurité supplémentaire)
    if (!file.type.startsWith('video/')) {
        alert("Ce fichier n'est pas une vidéo valide.");
        return;
    }

    if (videoURL) URL.revokeObjectURL(videoURL);
    setVideoFile(file);
    setVideoURL(URL.createObjectURL(file));
    setStep("edit");
    e.target.value = null; // Reset input pour permettre de ré-uploader le même fichier
  };

  // --- HANDLERS CAMERA ---
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
              aspectRatio: { ideal: 9/16 }, // Format vertical (TikTok style)
              facingMode: "user" 
          }, 
          audio: true 
      });
      
      streamRef.current = stream;
      if (cameraVideoRef.current) cameraVideoRef.current.srcObject = stream;
      
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp9' });
      const chunks = [];
      
      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
      
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "video/webm" });
        const file = new File([blob], `cam_${Date.now()}.webm`, { type: "video/webm" });
        setVideoFile(file);
        setVideoURL(URL.createObjectURL(blob));
        setStep("edit");
        
        // Couper la caméra une fois l'enregistrement fini
        stream.getTracks().forEach(t => t.stop());
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      
      // Timer
      let time = 0;
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => {
        time++;
        setRecordingTime(time);
        if (time >= 60) { // Max 60s
            stopRecording();
        }
      }, 1000);

    } catch (err) {
      console.error("Erreur caméra:", err);
      alert("Impossible d'accéder à la caméra. Vérifiez les permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
  };

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

    try {
      // ✅ Récupération sécurisée du token
      const token = await getToken(); 
      
      if (!token) {
          throw new Error("Vous devez être connecté pour publier.");
      }

      console.log("📤 Début upload...");

      const res = await axios.post(`${API_URL}/api/videos`, formData, {
        headers: { 
            'Content-Type': 'multipart/form-data', 
            'Authorization': `Bearer ${token}` 
        },
        onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percentCompleted);
        },
        signal: abortControllerRef.current.signal,
        timeout: 300000 // 5 minutes timeout pour les grosses vidéos
      });

      console.log("✅ Upload réussi:", res.data);

      if (addVideo) addVideo(res.data.video || res.data);
      if (fetchVideos) fetchVideos(true); // Rafraîchir le feed
      if (onVideoPublished) onVideoPublished(res.data);
      
      // Fermeture propre
      handleClose();
      
      // Feedback utilisateur (Toast serait mieux qu'alert)
      // alert("Vidéo publiée avec succès ! 🚀"); 

    } catch (err) {
      console.error("❌ Erreur Upload:", err);
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
    const opts = [
        {t: "Regardez ça ! 😱", h: "#viral #omg #fun"}, 
        {t: "Vibe du jour ✨", h: "#mood #aesthetic #lifestyle"},
        {t: "Incroyable talent 🔥", h: "#talent #skill #wow"},
        {t: "Moment inoubliable ❤️", h: "#love #memory #best"}
    ];
    const rnd = opts[Math.floor(Math.random() * opts.length)];
    setTitle(rnd.t); 
    setHashtags(rnd.h);
  };

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
          
          {/* ================= HEADER (Fixe) ================= */}
          {!isRecording && (
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 bg-gray-900/90 z-20">
              <div className="flex items-center gap-3">
                  {step !== "upload" && (
                     <button onClick={() => setStep(step === "publish" ? "edit" : "upload")} className="text-white p-2 -ml-2 rounded-full hover:bg-gray-800 transition">
                        <FaArrowLeft />
                     </button>
                  )}
                  <h2 className="text-lg font-bold text-white">
                    {step === "upload" ? "Créer" : step === "edit" ? "Éditer" : "Publier"}
                  </h2>
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

          {/* ================= CONTENU (Scrollable) ================= */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden relative bg-black custom-scrollbar">
            
            {/* ETAPE 1: UPLOAD */}
            {step === "upload" && !isRecording && (
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
                        onClick={startRecording}
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
            {isRecording && (
                <div className="absolute inset-0 bg-black flex flex-col z-50">
                    <video ref={cameraVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                    
                    {/* Timer */}
                    <div className="absolute top-6 left-0 right-0 flex justify-center">
                        <span className="bg-red-600/90 backdrop-blur px-4 py-1.5 rounded-full text-white font-mono text-sm shadow-lg animate-pulse border border-red-400/50">
                            00:{recordingTime.toString().padStart(2, '0')} / 01:00
                        </span>
                    </div>

                    {/* Controls */}
                    <div className="absolute bottom-10 inset-x-0 flex items-center justify-center gap-12 pb-safe">
                        <button 
                            onClick={() => { stopRecording(); setIsRecording(false); cleanup(); }} 
                            className="p-4 bg-gray-800/80 text-white rounded-full hover:bg-gray-700 backdrop-blur"
                        >
                            <FaTimes size={20} />
                        </button>
                        
                        <button 
                            onClick={stopRecording} 
                            className="w-20 h-20 border-4 border-white rounded-full p-1 transition-transform active:scale-90"
                        >
                            <div className="w-full h-full bg-red-600 rounded-full animate-pulse" />
                        </button>
                        
                        {/* Placeholder pour équilibrer */}
                        <div className="w-14" /> 
                    </div>
                </div>
            )}

            {/* ETAPE 2: EDIT (Preview & Filtres) */}
            {step === "edit" && videoURL && (
                <div className="flex flex-col h-full bg-gray-900 animate-in fade-in duration-300">
                    {/* Vidéo centrée */}
                    <div className="flex-1 flex items-center justify-center bg-black py-4 relative">
                        <video 
                            ref={videoRef} 
                            src={videoURL} 
                            className="max-h-[55vh] sm:max-h-[60vh] w-auto rounded-lg shadow-2xl"
                            controls loop playsInline
                            style={{ filter: selectedFilter !== 'none' ? selectedFilter : 'none' }}
                        />
                    </div>
                    
                    {/* Filtres scrollables */}
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

            {/* ETAPE 3: PUBLISH (Form) */}
            {step === "publish" && (
                <div className="p-6 space-y-6 animate-in slide-in-from-right duration-300">
                    <div className="flex gap-4 items-start">
                        <div className="w-24 aspect-[9/16] bg-black rounded-lg overflow-hidden shrink-0 border border-gray-700 shadow-lg">
                            <video src={videoURL} className="w-full h-full object-cover opacity-80" style={{ filter: selectedFilter }} />
                        </div>
                        <div className="flex-1 space-y-3">
                            <div>
                                <label className="text-xs text-gray-400 font-bold uppercase tracking-wide">Légende</label>
                                <textarea 
                                    value={title} 
                                    onChange={e => setTitle(e.target.value)} 
                                    className="w-full bg-transparent text-white text-base mt-2 border-b border-gray-700 focus:border-blue-500 outline-none pb-2 resize-none placeholder-gray-600 transition-colors"
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

                    <div className="space-y-4">
                        <div className="space-y-2">
                             <label className="text-xs text-gray-400 font-bold uppercase tracking-wide">Hashtags</label>
                             <div className="bg-gray-800/50 p-3 rounded-xl border border-gray-700 flex items-center gap-3 focus-within:border-blue-500 focus-within:bg-gray-800 transition-colors">
                                <FaHashtag className="text-blue-500" />
                                <input 
                                    value={hashtags} 
                                    onChange={e => setHashtags(e.target.value)} 
                                    className="bg-transparent flex-1 text-sm text-white outline-none placeholder-gray-500" 
                                    placeholder="ex: #humour #dance #challenge" 
                                />
                            </div>
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
                </div>
            )}
          </div>

          {/* ================= FOOTER (Fixe - Boutons) ================= */}
          {!isRecording && step !== "upload" && (
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