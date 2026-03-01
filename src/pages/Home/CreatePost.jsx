// src/pages/Home/CreatePost.jsx - VERSION ULTRA PREMIUM INSTAGRAM/TWITTER
// ✅ FIX LENTEUR :
//   - Upload progress RÉEL via onUploadProgress (axios) au lieu de fake steps
//   - Post optimiste : affiché IMMÉDIATEMENT dans le feed, remplacé après réponse serveur
//   - Pas de retry automatique sur les uploads (aggravait la lenteur perçue)
//   - Timeout 30s sur la requête pour éviter l'attente infinie

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePosts } from "../../context/PostsContext";
import { useDarkMode } from "../../context/DarkModeContext";
import axiosClient from "../../api/axiosClientGlobal";
import {
  PhotoIcon,
  MapPinIcon,
  FaceSmileIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

// ============================================
// 🎨 Avatar simple avec photo
// ============================================
const SimpleAvatar = ({ username, profilePhoto, size = 38 }) => {
  const [imageError, setImageError] = useState(false);

  const getInitials = (name) => {
    if (!name) return "?";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  const getColorFromName = (name) => {
    if (!name) return "#f97316";
    const colors = ["#f97316","#ef4444","#8b5cf6","#3b82f6","#10b981","#f59e0b","#ec4899","#6366f1"];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  const getPhotoUrl = (photo) => {
    if (!photo) return null;
    if (photo.startsWith("http")) return photo;
    const base = import.meta.env.VITE_API_URL || "http://localhost:5000";
    return `${base}${photo.startsWith("/") ? photo : `/${photo}`}`;
  };

  const photoUrl = getPhotoUrl(profilePhoto);

  if (photoUrl && !imageError) {
    return (
      <img
        src={photoUrl} alt={username}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
        onError={() => setImageError(true)}
      />
    );
  }

  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-bold"
      style={{ width: size, height: size, backgroundColor: getColorFromName(username), fontSize: size * 0.4 }}
    >
      {getInitials(username)}
    </div>
  );
};

export default function CreatePost({ user, showToast, onPostCreated }) {
  const { addPostOptimistic, replaceOptimisticPost, removeOptimisticPost } = usePosts();
  const { isDarkMode } = useDarkMode();
  const fileInputRef = useRef(null);
  const abortControllerRef = useRef(null);

  const [isOpen, setIsOpen] = useState(false);
  const [content, setContent] = useState("");
  const [mediaFiles, setMediaFiles] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);
  const [location, setLocation] = useState("");
  const [privacy, setPrivacy] = useState("Public");
  const [posting, setPosting] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showLocation, setShowLocation] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);

  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const swipeThreshold = 50;

  const emojis = [
    "😀","😂","😍","😎","😢","👍","🙏","🎉",
    "❤️","🤩","🤔","😱","🥳","💯","✨","🔥",
    "👏","🎊","💪","🌟","⭐","💖","🙌","👌"
  ];

  const MAX_CONTENT_LENGTH = 2000;
  const MAX_MEDIA_COUNT    = 5;
  const MAX_IMAGE_SIZE     = 5  * 1024 * 1024;
  const MAX_VIDEO_SIZE     = 200 * 1024 * 1024;
  const ALLOWED_IMAGE_TYPES = ["image/jpeg","image/jpg","image/png","image/webp"];
  const ALLOWED_VIDEO_TYPES = ["video/mp4","video/webm","video/quicktime"];

  useEffect(() => {
    if (mediaFiles.length === 0) { setPreviewUrls([]); return; }
    const urls = mediaFiles.map(f => ({
      file: f,
      url: URL.createObjectURL(f),
      type: f.type.startsWith("video") ? "video" : "image"
    }));
    setPreviewUrls(urls);
    return () => urls.forEach(u => URL.revokeObjectURL(u.url));
  }, [mediaFiles]);

  // Annuler l'upload en cours si le composant est démonté
  useEffect(() => {
    return () => { abortControllerRef.current?.abort(); };
  }, []);

  const resetForm = useCallback(() => {
    setContent("");
    setMediaFiles([]);
    setPreviewUrls([]);
    setLocation("");
    setPrivacy("Public");
    setIsOpen(false);
    setShowEmoji(false);
    setShowLocation(false);
    setDragOver(false);
    setCurrentIndex(0);
    setUploadProgress(0);
  }, []);

  const validateFile = useCallback((file) => {
    const isVideo = file.type.startsWith("video");
    const isImage = file.type.startsWith("image");
    if (!isVideo && !isImage) return { valid: false, error: "Type de fichier non supporté" };
    if (isImage && !ALLOWED_IMAGE_TYPES.includes(file.type)) return { valid: false, error: "Format image non autorisé (JPG, PNG, WebP)" };
    if (isVideo && !ALLOWED_VIDEO_TYPES.includes(file.type)) return { valid: false, error: "Format vidéo non autorisé (MP4, WebM, MOV)" };
    const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
    if (file.size > maxSize) return { valid: false, error: `Fichier trop lourd (max ${isVideo ? "200 Mo" : "5 Mo"})` };
    return { valid: true };
  }, []);

  const handleFiles = useCallback((files) => {
    if (!files || files.length === 0) return;
    const remainingSlots = MAX_MEDIA_COUNT - mediaFiles.length;
    if (remainingSlots <= 0) { showToast?.(`Maximum ${MAX_MEDIA_COUNT} fichiers`, "error"); return; }
    const newFiles = Array.from(files).slice(0, remainingSlots);
    const validFiles = [];
    for (const file of newFiles) {
      const v = validateFile(file);
      if (!v.valid) { showToast?.(v.error, "error"); continue; }
      validFiles.push(file);
    }
    if (validFiles.length > 0) {
      setMediaFiles(prev => [...prev, ...validFiles]);
    }
  }, [mediaFiles.length, validateFile, showToast]);

  const handleMediaChange  = (e) => handleFiles(e.target.files);
  const handleDrop         = useCallback((e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }, [handleFiles]);
  const handleDragOver     = useCallback((e) => { e.preventDefault(); setDragOver(true);  }, []);
  const handleDragLeave    = useCallback((e) => { e.preventDefault(); setDragOver(false); }, []);

  const removeMedia = useCallback((index) => {
    setMediaFiles(prev => prev.filter((_, i) => i !== index));
    if (currentIndex >= index && currentIndex > 0) setCurrentIndex(currentIndex - 1);
  }, [currentIndex]);

  // ─────────────────────────────────────────────────────────────────────────
  // 🚀 handlePost — VERSION OPTIMISTE + PROGRESSION RÉELLE
  //
  //   AVANT : attend que le serveur uploade sur Cloudinary (5-30s) avant
  //           d'afficher quoi que ce soit → UX catastrophique
  //
  //   APRÈS :
  //     1. Crée un post "fantôme" immédiatement avec les URLs locales (blob:)
  //        → l'utilisateur voit son post INSTANTANÉMENT
  //     2. Lance l'upload en arrière-plan avec onUploadProgress réel
  //        → la barre de progression reflète le vrai transfert réseau
  //     3. Quand le serveur répond → remplace le fantôme par le vrai post
  //     4. Si erreur → retire le fantôme + toast d'erreur
  // ─────────────────────────────────────────────────────────────────────────
  const handlePost = async () => {
    if (posting || !user) return;

    const trimmedContent = content.trim();
    if (!trimmedContent && mediaFiles.length === 0) {
      showToast?.("Ajoutez du texte ou des médias.", "error");
      return;
    }
    if (trimmedContent.length > MAX_CONTENT_LENGTH) {
      showToast?.(`Texte trop long (max ${MAX_CONTENT_LENGTH} caractères)`, "error");
      return;
    }

    // ── Étape 1 : post optimiste instantané ──────────────────────────────
    const tempId = `temp_${Date.now()}`;
    const optimisticPost = {
      _id:       tempId,
      content:   trimmedContent,
      contenu:   trimmedContent,
      user: {
        _id:          user._id,
        fullName:     user.fullName || user.username,
        profilePhoto: user.profilePhoto,
        isVerified:   user.isVerified || false,
        isPremium:    user.isPremium  || false,
      },
      // Prévisualisations locales (blob URLs) pour affichage immédiat
      media:     previewUrls.map(p => p.url),
      mediaType: previewUrls.some(p => p.type === "video") ? "video"
               : previewUrls.length > 0 ? "image" : null,
      likes:     [],
      comments:  [],
      shares:    [],
      location:  location.trim() || null,
      privacy,
      createdAt: new Date().toISOString(),
      isOptimistic: true, // flag pour le rendu (peut afficher un indicateur)
    };

    // Ajoute immédiatement au feed (PostsContext doit exposer cette méthode)
    addPostOptimistic?.(optimisticPost);

    // Ferme le formulaire instantanément
    const capturedFiles    = [...mediaFiles];
    const capturedContent  = trimmedContent;
    const capturedLocation = location.trim();
    resetForm();

    // ── Étape 2 : upload en arrière-plan ────────────────────────────────
    setPosting(true);
    setUploadProgress(0);

    abortControllerRef.current = new AbortController();

    const formData = new FormData();
    formData.append("content", capturedContent);
    if (capturedLocation) formData.append("location", capturedLocation);
    formData.append("privacy", privacy);
    capturedFiles.forEach(file => formData.append("media", file));

    try {
      const response = await axiosClient.post("/posts", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        signal: abortControllerRef.current.signal,
        timeout: 60000, // 60s max (vidéos lourdes)
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const pct = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(pct);
          }
        },
      });

      const realPost = response.data?.data || response.data;

      // ── Étape 3 : remplace le fantôme par le vrai post ────────────────
      replaceOptimisticPost?.(tempId, realPost);

      showToast?.("Post publié ! 🎉", "success");
      onPostCreated?.(realPost);

    } catch (err) {
      if (err.name === "CanceledError" || err.name === "AbortError") return;

      // ── Étape 4 : rollback — retire le fantôme ────────────────────────
      removeOptimisticPost?.(tempId);

      const msg = err.response?.status === 401
        ? "Session expirée. Reconnectez-vous."
        : err.response?.data?.message || err.message || "Publication échouée. Réessayez.";

      showToast?.(msg, "error");
      console.error("❌ Erreur publication:", err);

    } finally {
      setPosting(false);
      setTimeout(() => setUploadProgress(0), 800);
    }
  };

  const onTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchMove  = (e) => { touchEndX.current   = e.touches[0].clientX; };
  const onTouchEnd   = () => {
    const distance = touchStartX.current - touchEndX.current;
    if (Math.abs(distance) < swipeThreshold || previewUrls.length <= 1) return;
    if (distance > 0) setCurrentIndex(prev => (prev + 1) % previewUrls.length);
    else              setCurrentIndex(prev => (prev - 1 + previewUrls.length) % previewUrls.length);
  };

  if (!user) {
    return (
      <div className={`text-center py-6 font-medium ${isDarkMode ? "text-orange-400" : "text-orange-500"}`}>
        Connectez-vous pour publier un post
      </div>
    );
  }

  return (
    <motion.div
      layout
      className={`transition-all duration-300 ${isDarkMode ? "bg-black border-b border-white/[0.02]" : "bg-white border-b border-gray-100/30"}`}
      style={{ borderBottomWidth: "0.5px" }}
    >
      {/* Barre de progression flottante (visible même après fermeture du form) */}
      {posting && uploadProgress > 0 && (
        <div className={`w-full h-0.5 overflow-hidden ${isDarkMode ? "bg-white/10" : "bg-gray-200"}`}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${uploadProgress}%` }}
            className="bg-orange-500 h-full"
            transition={{ duration: 0.2 }}
          />
        </div>
      )}

      {!isOpen ? (
        <motion.div
          onClick={() => setIsOpen(true)}
          className="cursor-pointer flex items-center gap-3 px-4 py-3 group"
        >
          <div className="flex-shrink-0">
            <SimpleAvatar username={user?.username || user?.fullName} profilePhoto={user?.profilePhoto} size={40} />
          </div>
          <div className={`flex-1 px-4 py-2.5 rounded-full transition ${
            isDarkMode ? "bg-white/[0.03] group-hover:bg-white/[0.05]" : "bg-gray-50 group-hover:bg-gray-100"
          }`}>
            <span className="text-gray-500 font-normal">Quoi de neuf ?</span>
          </div>
        </motion.div>
      ) : (
        <AnimatePresence>
          <motion.div
            key="expanded"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="px-4 py-3 space-y-3"
          >
            {/* Header */}
            <div className="flex items-center gap-3">
              <SimpleAvatar username={user?.username || user?.fullName} profilePhoto={user?.profilePhoto} size={40} />
              <div className="flex-1">
                <p className={`font-semibold text-sm ${isDarkMode ? "text-white" : "text-gray-900"}`}>
                  {user?.fullName || user?.username}
                </p>
              </div>
            </div>

            {/* Textarea */}
            <textarea
              placeholder="Quoi de neuf ?"
              value={content}
              onChange={e => setContent(e.target.value)}
              className={`w-full px-0 py-2 resize-none focus:outline-none text-[15px] ${
                isDarkMode ? "bg-transparent text-gray-200 placeholder-gray-600" : "bg-transparent text-gray-900 placeholder-gray-500"
              }`}
              rows={3}
              autoFocus
              maxLength={MAX_CONTENT_LENGTH}
            />

            {/* Zone médias */}
            {previewUrls.length > 0 ? (
              <div
                className="-mx-4 relative"
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
              >
                <div className="relative w-full" style={{ height: "450px" }}>
                  <AnimatePresence mode="wait">
                    {previewUrls.map((item, i) =>
                      i === currentIndex && (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="absolute inset-0"
                        >
                          {item.type === "image" ? (
                            <img src={item.url} alt="preview" className="w-full h-full object-cover" />
                          ) : (
                            <video src={item.url} controls className="w-full h-full object-cover" />
                          )}
                          <button
                            onClick={e => { e.stopPropagation(); removeMedia(i); }}
                            className="absolute top-2 right-2 bg-black/80 hover:bg-black text-white rounded-full p-2 transition z-10"
                          >
                            <XMarkIcon className="w-5 h-5" />
                          </button>
                        </motion.div>
                      )
                    )}
                  </AnimatePresence>

                  {previewUrls.length > 1 && (
                    <>
                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                        {previewUrls.map((_, i) => (
                          <button
                            key={i}
                            onClick={() => setCurrentIndex(i)}
                            className={`h-1.5 rounded-full transition-all ${i === currentIndex ? "bg-white w-5" : "bg-white/50 w-1.5"}`}
                          />
                        ))}
                      </div>
                      <div className="absolute top-2 left-2 bg-black/80 text-white text-xs px-2 py-1 rounded-full">
                        {currentIndex + 1} / {previewUrls.length}
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative w-full h-32 border border-dashed rounded-xl flex justify-center items-center cursor-pointer transition-all ${
                  dragOver
                    ? isDarkMode ? "border-orange-500/50 bg-orange-500/5" : "border-orange-500/50 bg-orange-50"
                    : isDarkMode ? "border-white/10" : "border-gray-200 bg-gray-50/50"
                }`}
              >
                <div className="text-center">
                  <PhotoIcon className={`w-10 h-10 mx-auto mb-2 ${isDarkMode ? "text-gray-600" : "text-gray-400"}`} />
                  <p className="text-sm text-gray-500">Ajouter des photos ou vidéos</p>
                </div>
              </div>
            )}

            <input
              type="file" className="hidden" ref={fileInputRef}
              accept="image/*,video/*" multiple
              onChange={handleMediaChange}
              disabled={mediaFiles.length >= MAX_MEDIA_COUNT}
            />

            {/* Actions */}
            <div
              className={`flex items-center justify-between pt-2 border-t ${isDarkMode ? "border-white/[0.05]" : "border-gray-100"}`}
              style={{ borderTopWidth: "0.5px" }}
            >
              <div className="flex items-center gap-2">
                <button onClick={() => fileInputRef.current?.click()} disabled={mediaFiles.length >= MAX_MEDIA_COUNT}
                  className={`p-2 rounded-full transition ${isDarkMode ? "hover:bg-white/10" : "hover:bg-gray-100"}`}>
                  <PhotoIcon className={`w-5 h-5 ${mediaFiles.length >= MAX_MEDIA_COUNT ? "text-gray-500" : "text-orange-500"}`} />
                </button>
                <button onClick={() => setShowEmoji(!showEmoji)}
                  className={`p-2 rounded-full transition ${isDarkMode ? "hover:bg-white/10" : "hover:bg-gray-100"}`}>
                  <FaceSmileIcon className="w-5 h-5 text-orange-500" />
                </button>
                <button onClick={() => setShowLocation(!showLocation)}
                  className={`p-2 rounded-full transition ${isDarkMode ? "hover:bg-white/10" : "hover:bg-gray-100"}`}>
                  <MapPinIcon className="w-5 h-5 text-orange-500" />
                </button>
                {mediaFiles.length > 0 && (
                  <span className="text-xs text-gray-500 ml-1">{mediaFiles.length}/{MAX_MEDIA_COUNT}</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={resetForm}
                  className={`px-4 py-1.5 rounded-full text-sm font-semibold transition ${
                    isDarkMode ? "text-gray-400 hover:bg-white/10" : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  Annuler
                </button>
                <button
                  onClick={handlePost}
                  disabled={(!content.trim() && mediaFiles.length === 0) || posting}
                  className="px-4 py-1.5 bg-orange-500 text-white rounded-full hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm font-semibold"
                >
                  {posting ? "Envoi..." : "Publier"}
                </button>
              </div>
            </div>

            {/* Emoji Panel */}
            {showEmoji && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} className="flex flex-wrap gap-2 py-2">
                {emojis.map((e, i) => (
                  <button key={i} onClick={() => setContent(prev => prev + e)} className="text-2xl hover:scale-110 transition-transform">
                    {e}
                  </button>
                ))}
              </motion.div>
            )}

            {/* Location Input */}
            {showLocation && (
              <input
                type="text" placeholder="Ajouter un lieu"
                value={location} onChange={e => setLocation(e.target.value)}
                className={`w-full px-3 py-2 rounded-lg text-sm focus:outline-none ${
                  isDarkMode ? "bg-white/5 text-gray-200 placeholder-gray-600" : "bg-gray-100 text-gray-900 placeholder-gray-500"
                }`}
              />
            )}
          </motion.div>
        </AnimatePresence>
      )}
    </motion.div>
  );
}