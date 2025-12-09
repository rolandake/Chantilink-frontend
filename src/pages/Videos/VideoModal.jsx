// src/pages/videos/VideoModal.jsx
import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useVideos } from "../../context/VideoContext";
import { useAuth } from "../../context/AuthContext";
import axios from "axios";
import {
  FaTimes, FaUpload, FaCamera, FaStop, FaArrowLeft, 
  FaMagic, FaHashtag, FaExclamationCircle
} from "react-icons/fa";
import { HiSparkles } from "react-icons/hi2";

// --- CONSTANTES GLOBALES ---
const MAX_FILE_SIZE = 150 * 1024 * 1024; // 150MB
const ALLOWED_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const VideoModal = ({ showModal, setShowModal, onVideoPublished }) => {
  // --- REFS ---
  const videoRef = useRef(null);
  const cameraVideoRef = useRef(null);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const abortControllerRef = useRef(null); // Pour annuler l'upload si on ferme

  // --- CONTEXTS ---
  const { addVideo, fetchVideos } = useVideos();
  const { getActiveUser } = useAuth();
  const currentUser = getActiveUser();

  // --- STATES ---
  const [step, setStep] = useState("upload");
  const [videoFile, setVideoFile] = useState(null);
  const [videoURL, setVideoURL] = useState(null);
  
  // Camera
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  
  // Metadata & Options
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("none");
  const [privacy, setPrivacy] = useState("public");
  
  // Upload UI
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState(null);

  // --- 1. FONCTIONS DE NETTOYAGE (Définies en premier pour éviter ReferenceError) ---

  // Arrête proprement le flux vidéo de la caméra
  const stopCameraStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (cameraVideoRef.current) {
      cameraVideoRef.current.srcObject = null;
    }
  }, []);

  // Arrête l'enregistrement MediaRecorder
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  }, []);

  // Nettoyage global (appelé à la fermeture ou au démontage)
  const cleanup = useCallback(() => {
    // 1. Arrêter enregistrement et timer
    stopRecording();
    
    // 2. Couper caméra
    stopCameraStream();

    // 3. Révoquer URL Blob (Libère la RAM)
    if (videoURL && videoURL.startsWith('blob:')) {
      URL.revokeObjectURL(videoURL);
    }

    // 4. Annuler requête Axios si en cours
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // 5. Reset des états
    setStep("upload");
    setVideoFile(null);
    setVideoURL(null);
    setRecordingTime(0);
    setTitle("");
    setDescription("");
    setHashtags("");
    setIsUploading(false);
    setUploadProgress(0);
    setUploadError(null);
  }, [videoURL, stopCameraStream, stopRecording]);

  // --- 2. GESTIONNAIRES D'INTERACTION ---

  const handleClose = useCallback(() => {
    if (isUploading) {
      if (!window.confirm("L'upload est en cours. Voulez-vous vraiment annuler ?")) return;
    }
    cleanup();
    setShowModal(false);
  }, [isUploading, cleanup, setShowModal]);

  const handleFileSelect = useCallback((e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      alert("Format non supporté. Utilisez MP4 ou WebM.");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      alert("Le fichier est trop volumineux (Max 150MB).");
      return;
    }

    if (videoURL) URL.revokeObjectURL(videoURL);

    setVideoFile(file);
    setVideoURL(URL.createObjectURL(file));
    setStep("edit");
    setUploadError(null);
  }, [videoURL]);

  // --- 3. CAMÉRA LOGIQUE ---

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: "user", 
          width: { ideal: 720 },
          height: { ideal: 1280 },
          aspectRatio: 9/16
        },
        audio: true,
      });

      streamRef.current = stream;
      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = stream;
      }

      // Optimisation codec pour le web
      const options = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') 
        ? { mimeType: 'video/webm;codecs=vp9' } 
        : { mimeType: 'video/webm' };
        
      const recorder = new MediaRecorder(stream, options);
      const chunks = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "video/webm" });
        const file = new File([blob], `capture_${Date.now()}.webm`, { type: "video/webm" });
        
        if (videoURL) URL.revokeObjectURL(videoURL);

        setVideoFile(file);
        setVideoURL(URL.createObjectURL(blob));
        setStep("edit");
        stopCameraStream(); // Coupe la caméra une fois fini
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      
      // Timer avec auto-stop
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= 60) {
            stopRecording(); // Arrêt auto à 60s
            return prev;
          }
          return prev + 1;
        });
      }, 1000);

    } catch (err) {
      console.error("Erreur caméra:", err);
      alert("Impossible d'accéder à la caméra. Vérifiez vos permissions.");
      setIsRecording(false);
    }
  }, [stopCameraStream, stopRecording, videoURL]);

  // --- 4. UPLOAD LOGIQUE ---

  const handlePublish = async () => {
    if (!videoFile || !title.trim()) return;
    if (!currentUser?.token) {
      alert("Vous devez être connecté.");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setUploadError(null);

    // Préparation annulation
    abortControllerRef.current = new AbortController();

    const formData = new FormData();
    formData.append('video', videoFile);
    formData.append('title', title.trim());
    formData.append('description', description.trim());
    formData.append('hashtags', hashtags.trim());
    formData.append('privacy', privacy);
    formData.append('filter', selectedFilter);

    try {
      const response = await axios.post(`${API_URL}/api/videos`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${currentUser.token}`
        },
        signal: abortControllerRef.current.signal, // Lie la requête au contrôleur
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percentCompleted);
        }
      });

      // Succès
      addVideo(response.data.video || response.data);
      fetchVideos(true);

      if (onVideoPublished) onVideoPublished(response.data);
      
      setTimeout(() => {
        alert("✨ Vidéo publiée avec succès !");
        handleClose();
      }, 500);

    } catch (error) {
      if (axios.isCancel(error)) {
        console.log('Upload annulé par l\'utilisateur');
      } else {
        console.error('❌ Upload Error:', error);
        setUploadError(error.response?.data?.message || "Erreur lors de l'upload.");
      }
      setIsUploading(false);
    }
  };

  const generateWithAI = () => {
    const suggestions = [
      { t: "POV: Quand tu codes à 3h du mat 💻", h: "#devlife #coding #funny" },
      { t: "La vue est incroyable ici ! 🌍", h: "#travel #nature #aesthetic" },
      { t: "Essayez de ne pas rire 😂", h: "#challenge #humour #viral" }
    ];
    const random = suggestions[Math.floor(Math.random() * suggestions.length)];
    setTitle(random.t);
    setHashtags(random.h);
  };

  // --- 5. EFFETS DE BORD ---
  useEffect(() => {
    // Si la modale se ferme via props externe
    if (!showModal) cleanup();
    
    // Au démontage du composant
    return () => cleanup();
  }, [showModal, cleanup]);

  if (!showModal) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className={`relative bg-gray-900 w-full overflow-hidden shadow-2xl ${isRecording ? 'h-screen' : 'max-w-4xl rounded-2xl max-h-[90vh]'}`}
        >
          {/* HEADER */}
          {!isRecording && (
            <div className="flex items-center justify-between px-6 py-4 bg-gray-800 border-b border-gray-700">
              <div className="flex items-center gap-3">
                {step !== "upload" && (
                  <button onClick={() => setStep(prev => prev === "publish" ? "edit" : "upload")} className="p-2 hover:bg-gray-700 rounded-full text-white transition">
                    <FaArrowLeft />
                  </button>
                )}
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  {step === "upload" ? "Créer" : step === "edit" ? "Prévisualisation" : "Publier"}
                </h2>
              </div>
              <button 
                onClick={handleClose}
                disabled={isUploading} 
                className="p-2 hover:bg-red-500/20 text-gray-400 hover:text-red-500 rounded-full transition disabled:opacity-50"
              >
                <FaTimes size={20} />
              </button>
            </div>
          )}

          {/* BODY */}
          <div className="relative w-full h-full overflow-y-auto custom-scrollbar">
            
            {/* ETAPE 1: CHOIX */}
            {step === "upload" && !isRecording && (
              <div className="p-10 flex flex-col items-center justify-center min-h-[400px] gap-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
                  {/* Bouton Upload */}
                  <motion.div 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => fileInputRef.current?.click()}
                    className="cursor-pointer bg-gray-800 border-2 border-dashed border-gray-600 hover:border-blue-500 rounded-2xl p-8 flex flex-col items-center gap-4 transition-colors group"
                  >
                    <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center group-hover:bg-blue-500 transition-colors">
                      <FaUpload className="text-blue-400 group-hover:text-white text-2xl" />
                    </div>
                    <div className="text-center">
                      <h3 className="text-white font-bold text-lg">Importer une vidéo</h3>
                      <p className="text-gray-400 text-sm mt-1">MP4, WebM (Max 150MB)</p>
                    </div>
                  </motion.div>

                  {/* Bouton Caméra */}
                  <motion.div 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={startRecording}
                    className="cursor-pointer bg-gray-800 border-2 border-dashed border-gray-600 hover:border-pink-500 rounded-2xl p-8 flex flex-col items-center gap-4 transition-colors group"
                  >
                    <div className="w-16 h-16 bg-pink-500/20 rounded-full flex items-center justify-center group-hover:bg-pink-500 transition-colors">
                      <FaCamera className="text-pink-400 group-hover:text-white text-2xl" />
                    </div>
                    <div className="text-center">
                      <h3 className="text-white font-bold text-lg">Filmer maintenant</h3>
                      <p className="text-gray-400 text-sm mt-1">Caméra • 60s Max</p>
                    </div>
                  </motion.div>
                </div>
                <input ref={fileInputRef} type="file" accept={ALLOWED_TYPES.join(',')} onChange={handleFileSelect} className="hidden" />
              </div>
            )}

            {/* MODE RECORDING */}
            {isRecording && (
              <div className="fixed inset-0 bg-black z-[60] flex flex-col">
                <video 
                  ref={cameraVideoRef} 
                  autoPlay 
                  muted 
                  playsInline
                  className="w-full h-full object-cover" 
                />
                <div className="absolute top-8 left-0 w-full flex justify-center">
                  <span className="bg-red-600 px-4 py-1 rounded-full text-white font-mono font-bold animate-pulse">
                    00:{recordingTime.toString().padStart(2, '0')} / 00:60
                  </span>
                </div>
                <div className="absolute bottom-10 left-0 w-full flex justify-center items-center gap-8">
                  <button onClick={() => { stopRecording(); stopCameraStream(); setIsRecording(false); }} className="p-4 bg-gray-800/80 text-white rounded-full backdrop-blur-md">
                    <FaTimes />
                  </button>
                  <button 
                    onClick={stopRecording}
                    className="w-20 h-20 bg-transparent border-4 border-white rounded-full flex items-center justify-center p-1"
                  >
                    <div className="w-full h-full bg-red-600 rounded-full hover:scale-90 transition-transform" />
                  </button>
                </div>
              </div>
            )}

            {/* ETAPE 2: EDIT */}
            {step === "edit" && videoURL && (
              <div className="p-6 flex flex-col items-center">
                <div className="relative w-full max-w-sm aspect-[9/16] bg-black rounded-xl overflow-hidden shadow-lg mb-6 group">
                  <video 
                    ref={videoRef} 
                    src={videoURL} 
                    className="w-full h-full object-cover" 
                    style={{ filter: selectedFilter !== 'none' ? selectedFilter : 'none' }}
                    controls 
                    loop
                  />
                </div>
                
                {/* FILTRES */}
                <div className="w-full max-w-xl mb-6 overflow-x-auto pb-4">
                  <div className="flex gap-3 px-2">
                    {['none', 'grayscale(1)', 'sepia(0.8)', 'contrast(1.5)', 'hue-rotate(90deg)'].map((f, i) => (
                      <button 
                        key={i}
                        onClick={() => setSelectedFilter(f === 'none' ? 'none' : f)}
                        className={`min-w-[80px] h-20 bg-gray-800 rounded-lg border-2 ${selectedFilter === f ? 'border-pink-500' : 'border-transparent'} overflow-hidden relative`}
                      >
                        <div className="absolute inset-0 bg-gray-700" style={{ filter: f }} />
                        <span className="absolute bottom-1 left-0 w-full text-[10px] text-center text-white bg-black/50 z-10">{i === 0 ? 'Normal' : `Filtre ${i}`}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <button 
                  onClick={() => setStep("publish")}
                  className="w-full max-w-md bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold py-3 rounded-xl hover:shadow-lg transition-all"
                >
                  Suivant
                </button>
              </div>
            )}

            {/* ETAPE 3: PUBLISH */}
            {step === "publish" && (
              <div className="p-6 max-w-2xl mx-auto space-y-6 pb-20">
                <div className="flex gap-4">
                  <div className="w-24 h-32 bg-black rounded-lg overflow-hidden shrink-0">
                    <video src={videoURL} className="w-full h-full object-cover opacity-70" />
                  </div>
                  <div className="flex-1 space-y-4">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-white font-semibold">Titre</label>
                        <button onClick={generateWithAI} className="text-xs text-yellow-400 flex items-center gap-1 hover:underline">
                          <FaMagic /> Générer IA
                        </button>
                      </div>
                      <input 
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        placeholder="Décrivez votre vidéo..."
                        maxLength={100}
                        className="w-full bg-gray-800 text-white border border-gray-700 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-white font-semibold block mb-2">Description</label>
                  <textarea 
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    className="w-full bg-gray-800 text-white border border-gray-700 rounded-lg p-3 h-24 resize-none focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Ajoutez des détails..."
                  />
                </div>

                <div>
                  <label className="text-white font-semibold block mb-2 flex items-center gap-2">
                    <FaHashtag className="text-gray-400"/> Hashtags
                  </label>
                  <input 
                    value={hashtags}
                    onChange={e => setHashtags(e.target.value)}
                    className="w-full bg-gray-800 text-white border border-gray-700 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="#fyp #viral"
                  />
                </div>

                <div className="space-y-4 pt-4 border-t border-gray-700">
                  {uploadError && (
                    <div className="bg-red-500/20 text-red-400 p-3 rounded-lg flex items-center gap-2 text-sm">
                      <FaExclamationCircle /> {uploadError}
                    </div>
                  )}

                  {isUploading ? (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm text-gray-400">
                        <span>Upload en cours...</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                        <motion.div 
                          className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
                          initial={{ width: 0 }}
                          animate={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <button 
                      onClick={handlePublish}
                      disabled={!title.trim()}
                      className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all ${
                        title.trim() 
                        ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-lg' 
                        : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      <HiSparkles /> Publier
                    </button>
                  )}
                </div>
              </div>
            )}

          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default VideoModal;