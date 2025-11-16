// src/pages/Home/CreatePost.jsx - VERSION ULTRA PREMIUM INSTAGRAM/TWITTER (FIXED)
import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePosts } from "../../context/PostsContext";
import { useDarkMode } from "../../context/DarkModeContext";
import {
  PhotoIcon,
  MapPinIcon,
  FaceSmileIcon,
  XMarkIcon,
  ArrowLeftIcon,
  ArrowRightIcon
} from "@heroicons/react/24/outline";

// ============================================
// 🎨 Avatar simple avec photo
// ============================================
const SimpleAvatar = ({ username, profilePhoto, size = 38 }) => {
  const [imageError, setImageError] = useState(false);

  const getInitials = (name) => {
    if (!name) return "?";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const getColorFromName = (name) => {
    if (!name) return "#f97316";
    const colors = [
      "#f97316", "#ef4444", "#8b5cf6", "#3b82f6", 
      "#10b981", "#f59e0b", "#ec4899", "#6366f1"
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const getPhotoUrl = (photo) => {
    if (!photo) return null;
    if (photo.startsWith('http')) return photo;
    const base = import.meta.env.VITE_API_URL || "http://localhost:5000";
    return `${base}${photo.startsWith('/') ? photo : `/${photo}`}`;
  };

  const photoUrl = getPhotoUrl(profilePhoto);

  if (photoUrl && !imageError) {
    return (
      <img
        src={photoUrl}
        alt={username}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
        onError={() => setImageError(true)}
      />
    );
  }

  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-bold"
      style={{
        width: size,
        height: size,
        backgroundColor: getColorFromName(username),
        fontSize: size * 0.4,
      }}
    >
      {getInitials(username)}
    </div>
  );
};

export default function CreatePost({ user, showToast, onPostCreated }) {
  const { createPost } = usePosts();
  const { isDarkMode } = useDarkMode();
  const fileInputRef = useRef(null);

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
  const retryTimeoutRef = useRef(null);

  const emojis = [
    "😀", "😂", "😍", "😎", "😢", "👍", "🙏", "🎉",
    "❤️", "🤩", "🤔", "😱", "🥳", "💯", "✨", "🔥",
    "👏", "🎊", "💪", "🌟", "⭐", "💖", "🙌", "👌"
  ];

  const MAX_CONTENT_LENGTH = 2000;
  const MAX_MEDIA_COUNT = 5;
  const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
  const MAX_VIDEO_SIZE = 200 * 1024 * 1024;
  const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];

  useEffect(() => {
    if (mediaFiles.length === 0) {
      setPreviewUrls([]);
      return;
    }

    const urls = mediaFiles.map((f) => ({
      file: f,
      url: URL.createObjectURL(f),
      type: f.type.startsWith("video") ? "video" : "image"
    }));

    setPreviewUrls(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u.url));
  }, [mediaFiles]);

  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    };
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

    if (!isVideo && !isImage) {
      return { valid: false, error: "Type de fichier non supporté" };
    }

    if (isImage && !ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return { valid: false, error: "Format image non autorisé (JPG, PNG, WebP uniquement)" };
    }

    if (isVideo && !ALLOWED_VIDEO_TYPES.includes(file.type)) {
      return { valid: false, error: "Format vidéo non autorisé (MP4, WebM, MOV uniquement)" };
    }

    const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
    if (file.size > maxSize) {
      const maxSizeMB = isVideo ? "200 Mo" : "5 Mo";
      return { valid: false, error: `Fichier trop lourd. Maximum ${maxSizeMB}` };
    }

    return { valid: true };
  }, []);

  const handleFiles = useCallback(
    (files) => {
      if (!files || files.length === 0) return;

      const remainingSlots = MAX_MEDIA_COUNT - mediaFiles.length;
      if (remainingSlots <= 0) {
        showToast?.(`Maximum ${MAX_MEDIA_COUNT} fichiers autorisés`, "error");
        return;
      }

      const newFiles = Array.from(files).slice(0, remainingSlots);
      const validFiles = [];

      for (const file of newFiles) {
        const validation = validateFile(file);
        if (!validation.valid) {
          showToast?.(validation.error, "error");
          continue;
        }
        validFiles.push(file);
      }

      if (validFiles.length > 0) {
        setMediaFiles((prev) => [...prev, ...validFiles]);
        showToast?.(`${validFiles.length} fichier(s) ajouté(s)`, "success");
      }
    },
    [mediaFiles.length, validateFile, showToast]
  );

  const handleMediaChange = (e) => handleFiles(e.target.files);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const removeMedia = useCallback(
    (index) => {
      setMediaFiles((prev) => prev.filter((_, i) => i !== index));
      if (currentIndex >= index && currentIndex > 0) {
        setCurrentIndex(currentIndex - 1);
      }
      showToast?.("Fichier supprimé", "success");
    },
    [currentIndex, showToast]
  );

  const handlePost = async (retryCount = 0) => {
    if (posting) return;

    if (!user) {
      showToast?.("Vous devez être connecté pour publier", "error");
      return;
    }

    const trimmedContent = content.trim();
    if (!trimmedContent && mediaFiles.length === 0) {
      showToast?.("Votre post est vide. Ajoutez du texte ou des médias.", "error");
      return;
    }

    if (trimmedContent.length > MAX_CONTENT_LENGTH) {
      showToast?.(`Texte trop long (max ${MAX_CONTENT_LENGTH} caractères)`, "error");
      return;
    }

    setPosting(true);
    setUploadProgress(10);

    try {
      const formData = new FormData();
      formData.append("content", trimmedContent);
      if (location.trim()) formData.append("location", location.trim());
      formData.append("privacy", privacy);
      
      mediaFiles.forEach((file) => {
        formData.append("media", file);
      });

      setUploadProgress(30);
      const newPost = await createPost(formData);
      setUploadProgress(100);

      resetForm();
      showToast?.("Post publié avec succès ! 🎉", "success");
      if (onPostCreated) onPostCreated({ ...newPost, user });
    } catch (err) {
      console.error("❌ Erreur publication:", err);

      if (retryCount < 2 && !err.message?.includes("401")) {
        showToast?.(`Nouvelle tentative (${retryCount + 1}/2)...`, "info");
        retryTimeoutRef.current = setTimeout(() => {
          handlePost(retryCount + 1);
        }, 2000 * (retryCount + 1));
        return;
      }

      const errorMsg = err.message?.includes("401")
        ? "Session expirée. Reconnectez-vous."
        : err.message || "La publication a échoué. Réessayez.";

      showToast?.(errorMsg, "error");
    } finally {
      setPosting(false);
      setTimeout(() => setUploadProgress(0), 500);
    }
  };

  const onTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const onTouchMove = (e) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const onTouchEnd = () => {
    const distance = touchStartX.current - touchEndX.current;
    if (Math.abs(distance) < swipeThreshold || previewUrls.length <= 1) return;

    if (distance > 0) {
      setCurrentIndex((prev) => (prev + 1) % previewUrls.length);
    } else {
      setCurrentIndex((prev) => (prev - 1 + previewUrls.length) % previewUrls.length);
    }
  };

  if (!user) {
    return (
      <div className={`text-center py-6 font-medium ${
        isDarkMode ? 'text-orange-400' : 'text-orange-500'
      }`}>
        Connectez-vous pour publier un post
      </div>
    );
  }

  return (
    <motion.div
      layout
      className={`transition-all duration-300 ${
        isDarkMode 
          ? 'bg-black border-b border-white/[0.02]' 
          : 'bg-white border-b border-gray-100/30'
      }`}
      style={{ borderBottomWidth: '0.5px' }}
    >
      {!isOpen ? (
        <motion.div
          onClick={() => setIsOpen(true)}
          className="cursor-pointer flex items-center gap-3 px-4 py-3 group"
        >
          <div className="flex-shrink-0">
            <SimpleAvatar
              username={user?.username || user?.fullName}
              profilePhoto={user?.profilePhoto}
              size={40}
            />
          </div>
          <div className={`flex-1 px-4 py-2.5 rounded-full transition ${
            isDarkMode
              ? 'bg-white/[0.03] group-hover:bg-white/[0.05]'
              : 'bg-gray-50 group-hover:bg-gray-100'
          }`}>
            <span className={`font-normal transition ${
              isDarkMode
                ? 'text-gray-500'
                : 'text-gray-500'
            }`}>
              Quoi de neuf ?
            </span>
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
              <SimpleAvatar
                username={user?.username || user?.fullName}
                profilePhoto={user?.profilePhoto}
                size={40}
              />
              <div className="flex-1">
                <p className={`font-semibold text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {user?.fullName || user?.username}
                </p>
              </div>
            </div>

            {/* Textarea */}
            <textarea
              placeholder="Quoi de neuf ?"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className={`w-full px-0 py-2 resize-none focus:outline-none text-[15px] ${
                isDarkMode
                  ? 'bg-transparent text-gray-200 placeholder-gray-600'
                  : 'bg-transparent text-gray-900 placeholder-gray-500'
              }`}
              rows={3}
              disabled={posting}
              maxLength={MAX_CONTENT_LENGTH}
            />

            {/* Zone médias OU drag & drop */}
            {previewUrls.length > 0 ? (
              <div 
                className="-mx-4 relative"
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
              >
                <div className="relative w-full" style={{ height: '450px' }}>
                  <AnimatePresence mode="wait">
                    {previewUrls.map(
                      (item, i) =>
                        i === currentIndex && (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0"
                          >
                            {item.type === "image" ? (
                              <img
                                src={item.url}
                                alt="preview"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <video
                                src={item.url}
                                controls
                                className="w-full h-full object-cover"
                              />
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                removeMedia(i);
                              }}
                              className="absolute top-2 right-2 bg-black/80 hover:bg-black text-white rounded-full p-2 transition z-10"
                              disabled={posting}
                            >
                              <XMarkIcon className="w-5 h-5" />
                            </button>
                          </motion.div>
                        )
                    )}
                  </AnimatePresence>
                  
                  {/* Indicateurs de pagination */}
                  {previewUrls.length > 1 && (
                    <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 flex gap-1.5 z-10">
                      {previewUrls.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setCurrentIndex(i)}
                          className={`w-1.5 h-1.5 rounded-full transition-all ${
                            i === currentIndex 
                              ? 'bg-white w-5' 
                              : 'bg-white/50 hover:bg-white/75'
                          }`}
                        />
                      ))}
                    </div>
                  )}
                  
                  {/* Compteur de médias */}
                  {previewUrls.length > 1 && (
                    <div className="absolute top-2 left-2 bg-black/80 text-white text-xs px-2 py-1 rounded-full">
                      {currentIndex + 1} / {previewUrls.length}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => !posting && fileInputRef.current?.click()}
                className={`relative w-full h-32 border border-dashed rounded-xl flex justify-center items-center transition-all cursor-pointer ${
                  dragOver
                    ? isDarkMode 
                      ? "border-orange-500/50 bg-orange-500/5"
                      : "border-orange-500/50 bg-orange-50"
                    : isDarkMode
                      ? "border-white/10 bg-transparent"
                      : "border-gray-200 bg-gray-50/50"
                }`}
              >
                <div className="text-center">
                  <PhotoIcon className={`w-10 h-10 mx-auto mb-2 ${
                    isDarkMode ? 'text-gray-600' : 'text-gray-400'
                  }`} />
                  <p className={`text-sm ${
                    isDarkMode ? 'text-gray-500' : 'text-gray-500'
                  }`}>
                    Ajouter des photos ou vidéos
                  </p>
                </div>
              </div>
            )}

            {/* Input file caché */}
            <input
              type="file"
              className="hidden"
              ref={fileInputRef}
              accept="image/*,video/*"
              multiple
              onChange={handleMediaChange}
              disabled={posting || mediaFiles.length >= MAX_MEDIA_COUNT}
            />

            {/* Progression */}
            {uploadProgress > 0 && (
              <div className={`w-full rounded-full h-1 overflow-hidden ${
                isDarkMode ? 'bg-white/10' : 'bg-gray-200'
              }`}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${uploadProgress}%` }}
                  className="bg-orange-500 h-full"
                  transition={{ duration: 0.3 }}
                />
              </div>
            )}

            {/* Actions compactes */}
            <div className={`flex items-center justify-between pt-2 border-t ${
              isDarkMode ? 'border-white/[0.05]' : 'border-gray-100'
            }`} style={{ borderTopWidth: '0.5px' }}>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className={`p-2 rounded-full transition ${
                    isDarkMode
                      ? 'hover:bg-white/10'
                      : 'hover:bg-gray-100'
                  }`}
                  disabled={posting || mediaFiles.length >= MAX_MEDIA_COUNT}
                >
                  <PhotoIcon className={`w-5 h-5 ${
                    mediaFiles.length >= MAX_MEDIA_COUNT 
                      ? 'text-gray-500' 
                      : 'text-orange-500'
                  }`} />
                </button>
                <button
                  onClick={() => setShowEmoji(!showEmoji)}
                  className={`p-2 rounded-full transition ${
                    isDarkMode
                      ? 'hover:bg-white/10'
                      : 'hover:bg-gray-100'
                  }`}
                  disabled={posting}
                >
                  <FaceSmileIcon className="w-5 h-5 text-orange-500" />
                </button>
                <button
                  onClick={() => setShowLocation(!showLocation)}
                  className={`p-2 rounded-full transition ${
                    isDarkMode
                      ? 'hover:bg-white/10'
                      : 'hover:bg-gray-100'
                  }`}
                  disabled={posting}
                >
                  <MapPinIcon className="w-5 h-5 text-orange-500" />
                </button>
                
                {/* Compteur de médias */}
                {mediaFiles.length > 0 && (
                  <span className={`text-xs ml-2 ${
                    isDarkMode ? 'text-gray-500' : 'text-gray-500'
                  }`}>
                    {mediaFiles.length}/{MAX_MEDIA_COUNT}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={resetForm}
                  className={`px-4 py-1.5 rounded-full text-sm font-semibold transition ${
                    isDarkMode
                      ? 'text-gray-400 hover:bg-white/10'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                  disabled={posting}
                >
                  Annuler
                </button>
                <button
                  onClick={() => handlePost()}
                  disabled={(!content.trim() && mediaFiles.length === 0) || posting}
                  className="px-4 py-1.5 bg-orange-500 text-white rounded-full hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm font-semibold"
                >
                  {posting ? "Publication..." : "Publier"}
                </button>
              </div>
            </div>

            {/* Emoji Panel */}
            {showEmoji && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                className="flex flex-wrap gap-2 py-2"
              >
                {emojis.map((e, i) => (
                  <button
                    key={i}
                    onClick={() => setContent((prev) => prev + e)}
                    className="text-2xl hover:scale-110 transition-transform"
                    disabled={posting}
                  >
                    {e}
                  </button>
                ))}
              </motion.div>
            )}

            {/* Location Input */}
            {showLocation && (
              <input
                type="text"
                placeholder="Ajouter un lieu"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className={`w-full px-3 py-2 rounded-lg text-sm focus:outline-none ${
                  isDarkMode
                    ? 'bg-white/5 text-gray-200 placeholder-gray-600'
                    : 'bg-gray-100 text-gray-900 placeholder-gray-500'
                }`}
                disabled={posting}
              />
            )}
          </motion.div>
        </AnimatePresence>
      )}
    </motion.div>
  );
}