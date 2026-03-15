// 📁 src/pages/Home/StoryViewer.jsx - VERSION OPTIMISÉE ULTRA-FLUIDE
// ✅ AJOUT SUPPORT STORIES BOTS (patch minimal) :
//   - parseBgFromCaption() : lit le gradient dans caption "bg:gradient"
//   - getSlideBg()         : fond = backgroundColor OU bg:caption OU #000000
//   - getSlideText()       : texte = text OU content OU caption (sans "bg:")
//   - slide.media supporté en plus de slide.mediaUrl (champ du schéma Story)
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, Heart, Send, MoreVertical, Eye, ChevronRight, Volume2, VolumeX, Trash2 } from "lucide-react";

const SERVER_URL = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace('/api', '');
const MEDIA_URL = (path) => path?.startsWith("http") ? path : `${SERVER_URL}/${path?.replace(/^\/+/, "")}`;

// ─────────────────────────────────────────────────────────────────
// ✅ HELPERS STORIES BOTS
// ─────────────────────────────────────────────────────────────────

// Extrait le gradient CSS depuis caption "bg:linear-gradient(...)"
// Retourne null si caption n'a pas le préfixe "bg:"
const parseBgFromCaption = (caption) => {
  if (!caption || typeof caption !== 'string') return null;
  if (!caption.startsWith('bg:')) return null;
  return caption.slice(3);
};

// Fond de la slide texte :
//   1. slide.backgroundColor  (stories manuelles via StoryCreator)
//   2. bg: dans caption        (stories texte publiées par les bots)
//   3. #000000 par défaut
const getSlideBg = (slide) => {
  if (!slide) return '#000000';
  if (slide.backgroundColor) return slide.backgroundColor;
  const fromCaption = parseBgFromCaption(slide.caption);
  if (fromCaption) return fromCaption;
  return '#000000';
};

// Texte à afficher sur la slide :
//   1. slide.text    (champ direct du modèle Story)
//   2. slide.content (compatibilité ancien format)
//   3. slide.caption SAUF s'il contient un préfixe "bg:" (dans ce cas c'est un fond)
const getSlideText = (slide) => {
  if (!slide) return null;
  if (slide.text) return slide.text;
  if (slide.content) return slide.content;
  if (slide.caption && !slide.caption.startsWith('bg:')) return slide.caption;
  return null;
};

// ========================================
// MODAL DE CONFIRMATION DE SUPPRESSION
// ========================================
const DeleteConfirmModal = ({ onConfirm, onCancel }) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[10003] bg-black/80 backdrop-blur-sm flex items-center justify-center px-4"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl"
      >
        <div className="p-6">
          <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/20">
            <Trash2 size={32} className="text-red-600 dark:text-red-500" />
          </div>
          
          <h3 className="text-xl font-bold text-gray-900 dark:text-white text-center mb-2">
            Supprimer cette story ?
          </h3>
          
          <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-6">
            Cette action est irréversible. Votre story sera définitivement supprimée.
          </p>

          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl font-semibold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors active:scale-95"
            >
              Supprimer
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ========================================
// MODAL DE VUES
// ========================================
const ViewsModal = ({ slide, onClose }) => {
  const views = slide?.views || [];
  const viewCount = views.length;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[10002] bg-black/80 backdrop-blur-sm flex items-end md:items-center justify-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-gray-900 rounded-t-3xl md:rounded-3xl w-full md:w-[480px] max-h-[70vh] md:max-h-[600px] overflow-hidden flex flex-col shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <Eye size={20} className="text-gray-700 dark:text-gray-300" />
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              Vues
            </h3>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              ({viewCount})
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
          >
            <X size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Liste des vues */}
        <div className="flex-1 overflow-y-auto">
          {viewCount === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                <Eye size={24} className="text-gray-400" />
              </div>
              <p className="text-gray-500 dark:text-gray-400 font-medium">
                Aucune vue pour le moment
              </p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                Soyez patient, votre contenu sera bientôt vu !
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {views.map((view, index) => {
                const viewer = typeof view === 'object' ? view : null;
                const viewerName = viewer?.fullName || viewer?.username || "Utilisateur";
                const viewerAvatar = viewer?.profilePhoto || viewer?.avatar;
                const viewedAt = viewer?.viewedAt || slide?.createdAt;

                const diff    = Date.now() - new Date(viewedAt || 0).getTime();
                const minutes = Math.floor(diff / (1000 * 60));
                const hours   = Math.floor(diff / (1000 * 60 * 60));
                const days    = Math.floor(diff / (1000 * 60 * 60 * 24));
                const timeAgo = !viewedAt ? "" : minutes < 1 ? "À l'instant" : minutes < 60 ? `Il y a ${minutes}min` : hours < 24 ? `Il y a ${hours}h` : `Il y a ${days}j`;

                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-center gap-3 px-6 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    {viewerAvatar ? (
                      <img
                        src={MEDIA_URL(viewerAvatar)}
                        alt={viewerName}
                        className="w-12 h-12 rounded-full object-cover border-2 border-gray-200 dark:border-gray-700"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center text-white font-bold text-lg border-2 border-gray-200 dark:border-gray-700">
                        {viewerName[0]?.toUpperCase()}
                      </div>
                    )}
                    
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-white truncate">
                        {viewerName}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {timeAgo}
                      </p>
                    </div>
                    
                    <ChevronRight size={18} className="text-gray-400" />
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

// ========================================
// STORY VIEWER PRINCIPAL - OPTIMISÉ
// ========================================
export default function StoryViewer({ stories = [], currentUser, onClose, onDeleteSlide }) {
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [slideIdx, setSlideIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [loadedSlides, setLoadedSlides] = useState(new Set());
  const [isPaused, setIsPaused] = useState(false);
  const [showViewsModal, setShowViewsModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  
  const videoRef = useRef(null);
  
  const story = stories[currentStoryIndex] || {};
  const allSlides = useMemo(() => {
    return story.slides || [];
  }, [story]);
  
  const slide = allSlides[slideIdx];
  const owner = story.owner || story.user;
  const isMyStory = owner?._id === currentUser?._id;

  const ownerAvatar = useMemo(() => {
    return MEDIA_URL(owner?.profilePhoto || owner?.avatar || owner?.profilePicture);
  }, [owner]);

  const ownerName = useMemo(() => {
    return owner?.fullName || owner?.username || "Utilisateur";
  }, [owner]);

  const timeAgo = useMemo(() => {
    if (!slide?.createdAt) return "";
    const diff = Date.now() - new Date(slide.createdAt).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return "À l'instant";
    if (hours < 24) return `Il y a ${hours}h`;
    return `Il y a ${Math.floor(hours / 24)}j`;
  }, [slide?.createdAt]);

  const viewCount = useMemo(() => {
    return (slide?.views || []).length;
  }, [slide?.views]);

  const slideKey = useMemo(() => {
    return `${currentStoryIndex}-${slideIdx}`;
  }, [currentStoryIndex, slideIdx]);

  const isCurrentSlideLoaded = useMemo(() => {
    if (!slide) return false;
    if (slide.type === "text") return true;
    return loadedSlides.has(slideKey);
  }, [slide, loadedSlides, slideKey]);

  const slideDuration = useMemo(() => {
    if (!slide) return 10000;
    // ✅ Utilise getSlideText() pour gérer tous les formats (text/content/caption)
    const content = getSlideText(slide) || "";
    const hasMedia = slide.type === "video" || slide.mediaUrl || slide.media;
    if (content.length > 500) return 60000;
    if (content.length > 300) return 45000;
    if (content.length > 150) return 30000;
    if (content.length > 50) return 20000;
    if (hasMedia && content.length === 0) {
      return slide.type === "video" ? 60000 : 15000;
    }
    return 10000;
  }, [slide]);

  useEffect(() => {
    const preloadMedia = (index) => {
      const targetSlide = allSlides[index];
      if (!targetSlide || targetSlide.type === "text") return;
      const key = `${currentStoryIndex}-${index}`;
      if (loadedSlides.has(key)) return;
      // ✅ Supporte media ET mediaUrl
      const mediaUrl = MEDIA_URL(targetSlide.mediaUrl || targetSlide.media);
      if (targetSlide.type === "video") {
        const video = document.createElement('video');
        video.src = mediaUrl;
        video.preload = 'auto';
        video.onloadeddata = () => setLoadedSlides(prev => new Set(prev).add(key));
      } else {
        const img = new Image();
        img.src = mediaUrl;
        img.onload = () => setLoadedSlides(prev => new Set(prev).add(key));
      }
    };
    if (slideIdx < allSlides.length - 1) preloadMedia(slideIdx + 1);
    if (slideIdx < allSlides.length - 2) setTimeout(() => preloadMedia(slideIdx + 2), 500);
  }, [slideIdx, allSlides, currentStoryIndex, loadedSlides]);

  useEffect(() => {
    if (slide?.type === "text") {
      setLoadedSlides(prev => new Set(prev).add(slideKey));
    }
  }, [slide, slideKey]);

  useEffect(() => {
    if (!slide && allSlides.length === 0) onClose();
  }, [slide, allSlides.length, onClose]);

  useEffect(() => {
    if (!isCurrentSlideLoaded || !slide || isPaused || showViewsModal || showDeleteConfirm || showOptionsMenu) return;
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          if (slideIdx < allSlides.length - 1) { setSlideIdx(s => s + 1); setProgress(0); }
          else if (currentStoryIndex < stories.length - 1) { setCurrentStoryIndex(i => i + 1); setSlideIdx(0); setProgress(0); }
          else onClose();
          return 0;
        }
        return p + (100 / (slideDuration / 100));
      });
    }, 100);
    return () => clearInterval(interval);
  }, [slideIdx, isCurrentSlideLoaded, allSlides.length, onClose, slide, isPaused, currentStoryIndex, stories.length, slideDuration, showViewsModal, showDeleteConfirm, showOptionsMenu]);

  const handlePrevSlide = useCallback(() => {
    if (slideIdx > 0) { setSlideIdx(s => s - 1); setProgress(0); }
    else if (currentStoryIndex > 0) {
      setCurrentStoryIndex(i => i - 1);
      const prevStory = stories[currentStoryIndex - 1];
      setSlideIdx((prevStory?.slides?.length || 1) - 1);
      setProgress(0);
    }
  }, [slideIdx, currentStoryIndex, stories]);

  const handleNextSlide = useCallback(() => {
    if (slideIdx < allSlides.length - 1) { setSlideIdx(s => s + 1); setProgress(0); }
    else if (currentStoryIndex < stories.length - 1) { setCurrentStoryIndex(i => i + 1); setSlideIdx(0); setProgress(0); }
    else onClose();
  }, [slideIdx, allSlides.length, currentStoryIndex, stories.length, onClose]);

  const handleDragEnd = useCallback((_, info) => {
    if (info.offset.y > 100) onClose();
  }, [onClose]);

  const togglePause = useCallback(() => setIsPaused(p => !p), []);

  const handleOpenViewsModal = useCallback(() => {
    if (isMyStory) { setShowViewsModal(true); setIsPaused(true); }
  }, [isMyStory]);

  const handleCloseViewsModal = useCallback(() => {
    setShowViewsModal(false); setIsPaused(false);
  }, []);

  const handleToggleOptions = useCallback(() => {
    setShowOptionsMenu(prev => !prev); setIsPaused(prev => !prev);
  }, []);

  const handleDeleteClick = useCallback(() => {
    setShowOptionsMenu(false); setShowDeleteConfirm(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (onDeleteSlide && slide?._id) {
      try {
        await onDeleteSlide(story._id, slide._id);
        setShowDeleteConfirm(false);
        if (allSlides.length === 1) onClose();
        else { if (slideIdx >= allSlides.length - 1) setSlideIdx(Math.max(0, slideIdx - 1)); setProgress(0); }
      } catch (error) {
        console.error("Erreur lors de la suppression:", error);
        setShowDeleteConfirm(false); setIsPaused(false);
      }
    }
  }, [onDeleteSlide, story._id, slide?._id, allSlides.length, slideIdx, onClose]);

  const handleCancelDelete = useCallback(() => {
    setShowDeleteConfirm(false); setIsPaused(false);
  }, []);

  const handleMediaLoaded = useCallback(() => {
    setLoadedSlides(prev => new Set(prev).add(slideKey));
  }, [slideKey]);

  if (!slide) return null;

  // ✅ Résolution des valeurs pour la slide courante
  const slideBg   = getSlideBg(slide);
  const slideText = getSlideText(slide);
  // ✅ URL media : supporte media (schéma Story) ET mediaUrl (ancien format)
  const mediaUrl  = slide.mediaUrl || slide.media;

  return (
    <>
      <motion.div 
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        onDragEnd={handleDragEnd}
        initial={{ y: '100%' }} 
        animate={{ y: 0 }} 
        exit={{ y: '100%' }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="fixed inset-0 z-[10000] bg-black touch-none flex flex-col items-center justify-center"
      >
        {/* Barres de progression */}
        <div className="absolute top-[calc(env(safe-area-inset-top)+10px)] left-4 right-4 z-[10001] flex gap-1">
          {allSlides.map((_, i) => (
            <div key={i} className="h-1 flex-1 bg-white/20 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-white" 
                initial={false}
                animate={{ width: i === slideIdx ? `${progress}%` : i < slideIdx ? '100%' : '0%' }}
                transition={{ duration: 0.1, ease: 'linear' }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-[calc(env(safe-area-inset-top)+30px)] left-4 right-4 z-[10001] flex items-center justify-between">
          <div className="flex items-center gap-3">
            {ownerAvatar ? (
              <img src={ownerAvatar} alt={ownerName} className="w-10 h-10 rounded-full border-2 border-white object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full border-2 border-white bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center text-white font-bold">
                {ownerName[0]?.toUpperCase()}
              </div>
            )}
            <div className="flex flex-col">
              <span className="text-white font-semibold text-sm drop-shadow-lg">{ownerName}</span>
              <span className="text-white/80 text-xs drop-shadow-lg">{timeAgo}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 relative">
            {slide.type === "video" && (
              <button onClick={() => setIsMuted(!isMuted)} className="p-2 bg-black/40 backdrop-blur-md rounded-full text-white hover:bg-black/60 transition-all active:scale-95">
                {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>
            )}
            {isMyStory && (
              <button onClick={handleOpenViewsModal} className="flex items-center gap-1.5 px-3 py-1.5 bg-black/40 backdrop-blur-md rounded-full text-white hover:bg-black/60 transition-all active:scale-95">
                <Eye size={16} /><span className="text-sm font-bold">{viewCount}</span>
              </button>
            )}
            {isPaused && !showViewsModal && !showDeleteConfirm && (
              <div className="text-white text-xs bg-black/40 backdrop-blur-sm px-2 py-1 rounded-full">Pause</div>
            )}
            {isMyStory && (
              <div className="relative">
                <button onClick={handleToggleOptions} className="p-2 bg-black/20 backdrop-blur-md rounded-full text-white active:scale-95 transition-transform">
                  <MoreVertical size={20}/>
                </button>
                <AnimatePresence>
                  {showOptionsMenu && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9, y: -10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9, y: -10 }}
                      className="absolute top-12 right-0 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden min-w-[200px] border border-gray-200 dark:border-gray-700"
                    >
                      <button onClick={handleDeleteClick} className="w-full flex items-center gap-3 px-4 py-3 text-red-600 dark:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                        <Trash2 size={18} /><span className="font-semibold text-sm">Supprimer</span>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
            {!isMyStory && (
              <button onClick={togglePause} className="p-2 bg-black/20 backdrop-blur-md rounded-full text-white active:scale-95 transition-transform">
                <MoreVertical size={20}/>
              </button>
            )}
            <button onClick={onClose} className="p-2 bg-black/20 backdrop-blur-md rounded-full text-white active:scale-95 transition-transform">
              <X size={20}/>
            </button>
          </div>
        </div>

        {/* Contenu média */}
        <div className="w-full h-full flex items-center justify-center relative">
          {!isCurrentSlideLoaded && slide.type !== "text" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
              <Loader2 className="animate-spin text-white/60" size={48}/>
            </div>
          )}
          
          <AnimatePresence mode="wait">
            <motion.div
              key={slideKey}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="w-full h-full flex items-center justify-center"
            >
              {slide.type === "text" ? (
                // ✅ STORY TEXTE : fond via getSlideBg() (supporte backgroundColor ET bg:caption)
                <div className="w-full h-full flex items-center justify-center p-8" style={{ background: slideBg }}>
                  <motion.p 
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.2 }}
                    className="text-white text-center text-3xl md:text-4xl font-bold drop-shadow-lg px-4 whitespace-pre-wrap break-words"
                    style={{ fontFamily: slide.fontFamily || "Inter", color: slide.textColor || "#ffffff" }}
                  >
                    {/* ✅ Texte via getSlideText() : text > content > caption(sans bg:) */}
                    {slideText}
                  </motion.p>
                </div>
              ) : slide.type === "video" ? (
                // ✅ STORY VIDÉO : supporte slide.media ET slide.mediaUrl
                <video 
                  ref={videoRef}
                  src={MEDIA_URL(mediaUrl)} 
                  onLoadedData={handleMediaLoaded}
                  autoPlay playsInline muted={isMuted}
                  className="w-full h-full object-contain"
                  style={{ opacity: isCurrentSlideLoaded ? 1 : 0 }}
                />
              ) : (
                // ✅ STORY IMAGE : supporte slide.media ET slide.mediaUrl
                <img 
                  src={MEDIA_URL(mediaUrl)} 
                  onLoad={handleMediaLoaded}
                  alt="Story"
                  className="w-full h-full object-contain transition-opacity duration-200"
                  style={{ opacity: isCurrentSlideLoaded ? 1 : 0 }}
                />
              )}
            </motion.div>
          </AnimatePresence>

          {/* ✅ Caption sur image/vidéo : via getSlideText() (exclut le préfixe bg:) */}
          {slide.type !== "text" && slideText && isCurrentSlideLoaded && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ delay: 0.1 }}
              className="absolute bottom-20 left-4 right-4 z-[10001]"
            >
              <p className="text-white text-sm bg-black/40 backdrop-blur-md px-4 py-3 rounded-2xl drop-shadow-lg">
                {slideText}
              </p>
            </motion.div>
          )}
        </div>

        {/* Zones de navigation */}
        <div className="absolute inset-0 z-[10000] flex">
          <button onClick={handlePrevSlide} className="w-[40%] h-full" aria-label="Slide précédent" />
          <button onClick={handleNextSlide} className="flex-1 h-full" aria-label="Slide suivant" />
        </div>

        {/* Compteur de slides */}
        <div className="absolute top-[calc(env(safe-area-inset-top)+70px)] right-4 z-[10001]">
          <div className="bg-black/40 backdrop-blur-md px-2 py-1 rounded-full">
            <span className="text-white text-xs font-bold">{slideIdx + 1}/{allSlides.length}</span>
          </div>
        </div>

        {/* Input de réponse (uniquement pour les stories des autres) */}
        {!isMyStory && (
          <div className="absolute bottom-[calc(env(safe-area-inset-bottom)+20px)] left-4 right-4 z-[10001] flex items-center gap-3">
            <input
              type="text"
              placeholder="Envoyer un message..."
              className="flex-1 px-4 py-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-full text-white placeholder-white/60 outline-none focus:bg-white/20 transition-all"
              onClick={(e) => e.stopPropagation()}
            />
            <button className="p-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-full text-white hover:bg-white/20 active:scale-95 transition-all">
              <Heart size={20} />
            </button>
            <button className="p-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-full text-white hover:bg-white/20 active:scale-95 transition-all">
              <Send size={20} />
            </button>
          </div>
        )}

        <div className="absolute bottom-2 text-white/20 text-[9px] font-bold tracking-widest pointer-events-none uppercase">
          Glisser vers le bas pour fermer
        </div>
      </motion.div>

      <AnimatePresence>
        {showViewsModal && <ViewsModal slide={slide} onClose={handleCloseViewsModal} />}
      </AnimatePresence>
      <AnimatePresence>
        {showDeleteConfirm && <DeleteConfirmModal onConfirm={handleConfirmDelete} onCancel={handleCancelDelete} />}
      </AnimatePresence>
    </>
  );
}