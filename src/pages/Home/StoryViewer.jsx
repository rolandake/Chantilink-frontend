// 📁 src/pages/Home/StoryViewer.jsx
// ✅ PERF : affichage des vues INSTANTANÉ
// ✅ FIX navigation : onNavigate prop pour éviter que le viewer reste monté après navigate()
//   1. Le compteur affiche IMMÉDIATEMENT slide.views.length (données locales)
//   2. Le fetch API tourne en arrière-plan et met à jour le compteur silencieusement
//   3. ViewsModal affiche d'abord les viewers locaux puis remplace avec les données API fraîches
//   4. viewSlide() fire-and-forget dans un microtask (n'attend jamais)
//   5. Animations des viewers supprimées sur mobile (>10 items), réduites sinon
//   6. onNavigate(path) contrôle fermeture + navigation de façon synchrone depuis Home
//
// ✅ FIX 3 (v25) — NAVIGATION PROFIL AU PREMIER CLIC
//   Avant : handleNavigateToOwner appelait onClose() PUIS onNavigate(path) séparément.
//           onClose() dans Home faisait visibility:hidden mais le wrapper restait dans le DOM
//           → le viewer interceptait les clics → double-clic nécessaire pour accéder au profil.
//   Après : handleNavigateToOwner appelle UNIQUEMENT onNavigate(path) quand la prop est dispo.
//           onNavigate fait setShowViewer(false) + setViewerData reset + navigate() en synchrone
//           → le wrapper est retiré du DOM immédiatement → navigation au premier clic.
//   Même correction appliquée dans ViewsModal → handleNavigateToProfile.

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Loader2, Heart, Send, MoreVertical,
  Eye, ChevronRight, Volume2, VolumeX, Trash2,
} from "lucide-react";
import axiosClient from "../../api/axiosClientGlobal";
import { useStories } from "../../context/StoryContext";

const SERVER_URL = (import.meta.env.VITE_API_URL || (import.meta.env.PROD ? "https://chantilink-backend.onrender.com/api" : "http://localhost:5000/api")).replace('/api', '');
const MEDIA_URL  = (path) => path?.startsWith("http") ? path : `${SERVER_URL}/${path?.replace(/^\/+/, "")}`;

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────
const parseBgFromCaption = (caption) => {
  if (!caption || typeof caption !== 'string') return null;
  return caption.startsWith('bg:') ? caption.slice(3) : null;
};

const getSlideBg = (slide) => {
  if (!slide) return '#000000';
  return slide.background || slide.backgroundColor || parseBgFromCaption(slide.caption) || '#000000';
};

const getSlideText = (slide) => {
  if (!slide) return null;
  if (slide.text) return slide.text;
  if (slide.content) return slide.content;
  if (slide.caption && !slide.caption.startsWith('bg:')) return slide.caption;
  return null;
};

// Normalise un viewer (populé ou ID brut) en objet affichable
const normalizeViewer = (v) => {
  if (!v) return null;
  if (typeof v === 'string' || !v.username) return null;
  return v;
};

// timeAgo rapide
const fmtAgo = (dateStr) => {
  if (!dateStr) return "";
  const diff    = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours   = Math.floor(diff / 3600000);
  const days    = Math.floor(diff / 86400000);
  if (minutes < 1)  return "À l'instant";
  if (minutes < 60) return `Il y a ${minutes}min`;
  if (hours   < 24) return `Il y a ${hours}h`;
  return `Il y a ${days}j`;
};

// ─────────────────────────────────────────────────────────────────
// VIEWER ROW
// ─────────────────────────────────────────────────────────────────
const ViewerRow = ({ viewer, animate, onNavigate }) => {
  const name   = viewer?.fullName || viewer?.username || "Utilisateur";
  const avatar = viewer?.profilePhoto || viewer?.avatar;
  const time   = fmtAgo(viewer?.viewedAt || viewer?.createdAt);

  const inner = (
    <button
      onClick={() => onNavigate?.(viewer)}
      className="w-full flex items-center gap-3 px-6 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 active:bg-gray-100 dark:active:bg-gray-800 transition-colors text-left"
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      {avatar ? (
        <img
          src={MEDIA_URL(avatar)} alt={name} loading="lazy"
          className="w-11 h-11 rounded-full object-cover border-2 border-gray-200 dark:border-gray-700 flex-shrink-0"
        />
      ) : (
        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-yellow-400 to-cyan-500 flex items-center justify-center text-white font-bold text-base flex-shrink-0">
          {name[0]?.toUpperCase()}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 dark:text-white truncate text-sm">{name}</p>
        {time && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{time}</p>}
      </div>
      <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
    </button>
  );

  if (!animate) return inner;
  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.18 }}
    >
      {inner}
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────
// MODAL SUPPRESSION
// ─────────────────────────────────────────────────────────────────
const DeleteConfirmModal = ({ onConfirm, onCancel }) => (
  <motion.div
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    className="fixed inset-0 z-[10003] bg-black/80 backdrop-blur-sm flex items-center justify-center px-4"
    onClick={onCancel}
  >
    <motion.div
      initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
      transition={{ type: "spring", damping: 28, stiffness: 320 }}
      onClick={(e) => e.stopPropagation()}
      className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl"
    >
      <div className="p-6">
        <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/20">
          <Trash2 size={32} className="text-red-600 dark:text-red-500" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 dark:text-white text-center mb-2">Supprimer cette story ?</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-6">
          Cette action est irréversible. Votre story sera définitivement supprimée.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl font-semibold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
            Annuler
          </button>
          <button onClick={onConfirm} className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors active:scale-95">
            Supprimer
          </button>
        </div>
      </div>
    </motion.div>
  </motion.div>
);

// ─────────────────────────────────────────────────────────────────
// MODAL VUES
// ✅ Affiche les viewers locaux IMMÉDIATEMENT puis enrichit avec l'API
// ✅ FIX 3 : handleNavigateToProfile utilise onNavigate DIRECTEMENT
//    sans appeler onClose() du viewer → évite le double-clic
// ─────────────────────────────────────────────────────────────────
const ViewsModal = ({ storyId, slideIndex, localViewers, onClose, onNavigate }) => {
  const navigate = useNavigate();

  const [viewers,    setViewers]    = useState(() => localViewers.filter(Boolean));
  const [refreshing, setRefreshing] = useState(true);
  const [error,      setError]      = useState(null);

  useEffect(() => {
    if (!storyId) { setRefreshing(false); return; }

    axiosClient.get(`/story/${storyId}/slides/${slideIndex}/viewers`)
      .then(({ data }) => {
        const fresh = Array.isArray(data.viewers) ? data.viewers.filter(Boolean) : [];
        setViewers(fresh);
      })
      .catch((err) => {
        console.warn('⚠️ [ViewsModal] API:', err?.response?.status || err.message);
        if (viewers.length === 0) setError('Impossible de charger les vues');
      })
      .finally(() => setRefreshing(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storyId, slideIndex]);

  // ✅ FIX 3 : utilise onNavigate DIRECTEMENT (sans appeler onClose() du viewer).
  // onNavigate vient de Home.handleViewerNavigate qui fait :
  //   setShowViewer(false) + setViewerData reset + navigate(path) en synchrone.
  // Appeler onClose() ici en plus serait redondant et causerait une double-mise à jour.
  // On ferme seulement la ViewsModal elle-même via onClose().
  const handleNavigateToProfile = useCallback((viewer) => {
    const username = viewer?.username;
    const id       = viewer?._id;
    const path     = username ? `/profile/${username}` : id ? `/profile/${id}` : null;
    if (!path) return;
    onClose(); // ferme uniquement la ViewsModal
    if (onNavigate) {
      onNavigate(path); // ferme le viewer + reset + navigate en synchrone
    } else {
      navigate(path);
    }
  }, [navigate, onClose, onNavigate]);

  const animateItems = viewers.length <= 15;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-[10002] bg-black/75 backdrop-blur-sm flex items-end md:items-center justify-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 320 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-gray-900 rounded-t-3xl md:rounded-3xl w-full md:w-[480px] max-h-[72vh] md:max-h-[600px] overflow-hidden flex flex-col shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <Eye size={19} className="text-gray-600 dark:text-gray-400" />
            <h3 className="text-base font-bold text-gray-900 dark:text-white">Vues</h3>
            <span className="text-sm text-gray-400 dark:text-gray-500 font-medium">
              ({viewers.length})
            </span>
            {refreshing && (
              <Loader2 size={12} className="animate-spin text-cyan-400 ml-1" />
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
          >
            <X size={18} className="text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Contenu */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {refreshing && viewers.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={26} className="animate-spin text-cyan-400" />
            </div>
          ) : error && viewers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
              <p className="text-red-500 font-medium text-sm">{error}</p>
            </div>
          ) : viewers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
              <div className="w-14 h-14 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-3">
                <Eye size={22} className="text-gray-300 dark:text-gray-600" />
              </div>
              <p className="text-gray-500 dark:text-gray-400 font-semibold text-sm">Aucune vue pour le moment</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Votre contenu sera bientôt vu !</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800/60">
              {viewers.map((viewer, index) => (
                <ViewerRow
                  key={viewer?._id || index}
                  viewer={viewer}
                  animate={animateItems && index < 8}
                  onNavigate={handleNavigateToProfile}
                />
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────
// STORY VIEWER PRINCIPAL
// ✅ onNavigate(path) : prop optionnelle injectée par Home.jsx
//    → ferme le viewer ET navigue de façon synchrone, sans laisser
//      le viewer monté par-dessus la page de destination
//
// ✅ FIX 3 : handleNavigateToOwner utilise onNavigate DIRECTEMENT
//    (sans appeler onClose() en plus) → navigation au premier clic
// ─────────────────────────────────────────────────────────────────
export default function StoryViewer({ stories = [], currentUser, onClose, onDeleteSlide, onNavigate }) {
  const { viewSlide, reactToSlide } = useStories();
  const navigate = useNavigate();

  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [slideIdx,          setSlideIdx]           = useState(0);
  const [progress,          setProgress]           = useState(0);
  const [loadedSlides,      setLoadedSlides]        = useState(new Set());
  const [isPaused,          setIsPaused]            = useState(false);
  const [showViewsModal,    setShowViewsModal]      = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm]   = useState(false);
  const [isMuted,           setIsMuted]             = useState(false);
  const [showOptionsMenu,   setShowOptionsMenu]     = useState(false);
  const [replyText,         setReplyText]           = useState("");
  const [sendingReaction,   setSendingReaction]     = useState(false);
  const [reactionFeedback,  setReactionFeedback]    = useState(null);

  const [apiViewCount,  setApiViewCount]  = useState(null);
  const viewCacheRef   = useRef({});
  const markedViewsRef = useRef(new Set());
  const fetchTimerRef  = useRef(null);

  const videoRef = useRef(null);

  const story     = stories[currentStoryIndex] || {};
  const allSlides = useMemo(() => story.slides || [], [story]);
  const slide     = allSlides[slideIdx];
  const owner     = story.owner || story.user;
  const isMyStory = owner?._id === currentUser?._id;

  const localViewers = useMemo(() => {
    const views = slide?.views || [];
    return views.map(normalizeViewer).filter(Boolean);
  }, [slide]);

  const localViewCount = (slide?.views || []).length;
  const displayViewCount = apiViewCount !== null ? apiViewCount : localViewCount;

  const ownerAvatar = useMemo(() =>
    MEDIA_URL(owner?.profilePhoto || owner?.avatar || owner?.profilePicture),
  [owner]);

  const ownerName = useMemo(() =>
    owner?.fullName || owner?.username || "Utilisateur",
  [owner]);

  // ✅ FIX 3 : handleNavigateToOwner utilise onNavigate DIRECTEMENT.
  // On N'appelle PAS onClose() séparément — onNavigate le fait déjà en synchrone.
  // Avant : onClose() + onNavigate(path) → le wrapper restait dans le DOM
  //         (visibility:hidden) et interceptait les clics → double-clic requis.
  // Après : onNavigate(path) seul → setShowViewer(false) + setViewerData reset
  //         + navigate(path) en synchrone → premier clic suffit.
  const handleNavigateToOwner = useCallback(() => {
    const username = owner?.username;
    const id       = owner?._id;
    const path     = username ? `/profile/${username}` : id ? `/profile/${id}` : null;
    if (!path) return;
    if (onNavigate) {
      onNavigate(path); // fait tout : ferme viewer + reset viewerData + navigate
    } else {
      onClose();
      navigate(path);
    }
  }, [owner, navigate, onClose, onNavigate]);

  const timeAgo = useMemo(() => fmtAgo(slide?.createdAt), [slide?.createdAt]);

  const slideKey = useMemo(() =>
    `${currentStoryIndex}-${slideIdx}`,
  [currentStoryIndex, slideIdx]);

  const isCurrentSlideLoaded = useMemo(() => {
    if (!slide) return false;
    if (slide.type === "text") return true;
    return loadedSlides.has(slideKey);
  }, [slide, loadedSlides, slideKey]);

  const slideDuration = useMemo(() => {
    if (!slide) return 10000;
    const content  = getSlideText(slide) || "";
    const hasMedia = slide.type === "video" || slide.mediaUrl || slide.media;
    if (content.length > 500) return 60000;
    if (content.length > 300) return 45000;
    if (content.length > 150) return 30000;
    if (content.length > 50)  return 20000;
    if (hasMedia && content.length === 0) return slide.type === "video" ? 60000 : 15000;
    return 10000;
  }, [slide]);

  // fire-and-forget viewSlide
  useEffect(() => {
    if (!slide || !story._id || isMyStory || !isCurrentSlideLoaded) return;
    const viewKey = `${story._id}-${slideIdx}`;
    if (markedViewsRef.current.has(viewKey)) return;
    markedViewsRef.current.add(viewKey);
    Promise.resolve().then(() => viewSlide?.(story._id, slideIdx));
  }, [slide, story._id, slideIdx, isMyStory, isCurrentSlideLoaded, viewSlide]);

  // fetch API en arrière-plan avec délai
  useEffect(() => {
    if (!isMyStory || !story._id || !slide) {
      setApiViewCount(null);
      return;
    }
    const cacheKey = `${story._id}-${slideIdx}`;

    if (viewCacheRef.current[cacheKey] !== undefined) {
      setApiViewCount(viewCacheRef.current[cacheKey]);
      return;
    }

    clearTimeout(fetchTimerRef.current);
    fetchTimerRef.current = setTimeout(() => {
      axiosClient.get(`/story/${story._id}/slides/${slideIdx}/viewers`)
        .then(({ data }) => {
          const count = Array.isArray(data.viewers) ? data.viewers.length : 0;
          viewCacheRef.current[cacheKey] = count;
          setApiViewCount(count);
        })
        .catch(() => {});
    }, 400);

    return () => clearTimeout(fetchTimerRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMyStory, story._id, slideIdx]);

  // Reset apiViewCount à chaque changement de slide/story
  useEffect(() => {
    setApiViewCount(null);
  }, [slideIdx, currentStoryIndex]);

  // Préchargement médias
  useEffect(() => {
    const preloadMedia = (index) => {
      const targetSlide = allSlides[index];
      if (!targetSlide || targetSlide.type === "text") return;
      const key = `${currentStoryIndex}-${index}`;
      if (loadedSlides.has(key)) return;
      const mUrl = MEDIA_URL(targetSlide.mediaUrl || targetSlide.media);
      if (targetSlide.type === "video") {
        const v = document.createElement('video');
        v.src = mUrl; v.preload = 'auto';
        v.onloadeddata = () => setLoadedSlides(prev => new Set(prev).add(key));
      } else {
        const img = new Image();
        img.src = mUrl;
        img.onload = () => setLoadedSlides(prev => new Set(prev).add(key));
      }
    };
    if (slideIdx < allSlides.length - 1) preloadMedia(slideIdx + 1);
    if (slideIdx < allSlides.length - 2) setTimeout(() => preloadMedia(slideIdx + 2), 400);
  }, [slideIdx, allSlides, currentStoryIndex, loadedSlides]);

  useEffect(() => {
    if (slide?.type === "text") setLoadedSlides(prev => new Set(prev).add(slideKey));
  }, [slide, slideKey]);

  useEffect(() => {
    if (!slide && allSlides.length === 0) onClose();
  }, [slide, allSlides.length, onClose]);

  // Progression automatique
  useEffect(() => {
    if (!isCurrentSlideLoaded || !slide || isPaused || showViewsModal || showDeleteConfirm || showOptionsMenu) return;
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          if (slideIdx < allSlides.length - 1)             { setSlideIdx(s => s + 1); setProgress(0); }
          else if (currentStoryIndex < stories.length - 1) { setCurrentStoryIndex(i => i + 1); setSlideIdx(0); setProgress(0); }
          else onClose();
          return 0;
        }
        return p + (100 / (slideDuration / 100));
      });
    }, 100);
    return () => clearInterval(interval);
  }, [slideIdx, isCurrentSlideLoaded, allSlides.length, onClose, slide, isPaused,
      currentStoryIndex, stories.length, slideDuration, showViewsModal, showDeleteConfirm, showOptionsMenu]);

  // Navigation
  const handlePrevSlide = useCallback(() => {
    if (slideIdx > 0) { setSlideIdx(s => s - 1); setProgress(0); }
    else if (currentStoryIndex > 0) {
      setCurrentStoryIndex(i => i - 1);
      setSlideIdx((stories[currentStoryIndex - 1]?.slides?.length || 1) - 1);
      setProgress(0);
    }
  }, [slideIdx, currentStoryIndex, stories]);

  const handleNextSlide = useCallback(() => {
    if (slideIdx < allSlides.length - 1)             { setSlideIdx(s => s + 1); setProgress(0); }
    else if (currentStoryIndex < stories.length - 1) { setCurrentStoryIndex(i => i + 1); setSlideIdx(0); setProgress(0); }
    else onClose();
  }, [slideIdx, allSlides.length, currentStoryIndex, stories.length, onClose]);

  const handleDragEnd = useCallback((_, info) => {
    if (info.offset.y > 100) onClose();
  }, [onClose]);

  const togglePause = useCallback(() => setIsPaused(p => !p), []);

  const handleOpenViewsModal = useCallback(() => {
    if (!isMyStory) return;
    delete viewCacheRef.current[`${story._id}-${slideIdx}`];
    setShowViewsModal(true);
    setIsPaused(true);
  }, [isMyStory, story._id, slideIdx]);

  const handleCloseViewsModal = useCallback(() => {
    const cacheKey = `${story._id}-${slideIdx}`;
    delete viewCacheRef.current[cacheKey];
    setApiViewCount(null);
    setShowViewsModal(false);
    setIsPaused(false);
  }, [story._id, slideIdx]);

  const handleToggleOptions = useCallback(() => {
    setShowOptionsMenu(prev => !prev);
    setIsPaused(prev => !prev);
  }, []);

  const handleDeleteClick = useCallback(() => {
    setShowOptionsMenu(false);
    setShowDeleteConfirm(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (onDeleteSlide && slide?._id) {
      try {
        await onDeleteSlide(story._id, slide._id);
        setShowDeleteConfirm(false);
        if (allSlides.length === 1) onClose();
        else {
          if (slideIdx >= allSlides.length - 1) setSlideIdx(Math.max(0, slideIdx - 1));
          setProgress(0);
        }
      } catch (err) {
        console.error("Erreur suppression:", err);
        setShowDeleteConfirm(false);
        setIsPaused(false);
      }
    }
  }, [onDeleteSlide, story._id, slide?._id, allSlides.length, slideIdx, onClose]);

  const handleCancelDelete = useCallback(() => {
    setShowDeleteConfirm(false);
    setIsPaused(false);
  }, []);

  const handleMediaLoaded = useCallback(() => {
    setLoadedSlides(prev => new Set(prev).add(slideKey));
  }, [slideKey]);

  const showReactionFeedback = useCallback((message, type = "success") => {
    setReactionFeedback({ message, type });
    window.setTimeout(() => setReactionFeedback(null), 1800);
  }, []);

  const sendReaction = useCallback(async (reaction, type = "emoji") => {
    if (!story?._id || !slide || isMyStory || sendingReaction) return;
    const clean = String(reaction || "").trim();
    if (!clean) return;

    setSendingReaction(true);
    setIsPaused(true);
    try {
      const result = await reactToSlide?.(story._id, slideIdx, clean, type);
      if (!result?.success) throw new Error(result?.error || "Réaction impossible");
      if (type === "text") setReplyText("");
      showReactionFeedback(type === "text" ? "Message envoyé" : "Réaction envoyée");
    } catch (err) {
      showReactionFeedback(err.message || "Envoi impossible", "error");
    } finally {
      setSendingReaction(false);
      setIsPaused(false);
    }
  }, [story?._id, slide, isMyStory, sendingReaction, reactToSlide, slideIdx, showReactionFeedback]);

  const handleReplySubmit = useCallback((e) => {
    e?.preventDefault?.();
    sendReaction(replyText, "text");
  }, [replyText, sendReaction]);

  if (!slide) return null;

  const slideBg   = getSlideBg(slide);
  const slideText = getSlideText(slide);
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
            {/*
              ✅ FIX 3 : onClick appelle handleNavigateToOwner qui utilise onNavigate DIRECTEMENT.
              Plus d'appel à onClose() séparé → plus de blocage du DOM → 1er clic suffit.
            */}
            <button
              onClick={(e) => { e.stopPropagation(); handleNavigateToOwner(); }}
              className="flex items-center gap-3 active:opacity-70 transition-opacity"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              <div className="p-[2px] rounded-full bg-gradient-to-tr from-yellow-400 via-cyan-400 to-blue-500">
                {ownerAvatar ? (
                  <img src={ownerAvatar} alt={ownerName} className="w-10 h-10 rounded-full border-2 border-black object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full border-2 border-black bg-gradient-to-br from-yellow-400 to-cyan-500 flex items-center justify-center text-white font-bold">
                    {ownerName[0]?.toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-white font-semibold text-sm drop-shadow-lg">{ownerName}</span>
                <span className="text-white/70 text-xs">{timeAgo}</span>
              </div>
            </button>
          </div>

          <div className="flex items-center gap-2 relative">
            {slide.type === "video" && (
              <button
                onClick={() => setIsMuted(!isMuted)}
                className="p-2 bg-black/40 backdrop-blur-md rounded-full text-white hover:bg-black/60 transition-all active:scale-95"
              >
                {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>
            )}

            {/* viewCount LOCAL immédiat */}
            {isMyStory && (
              <button
                onClick={handleOpenViewsModal}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-black/40 backdrop-blur-md rounded-full text-white hover:bg-black/60 transition-all active:scale-95"
              >
                <Eye size={16} />
                <span className="text-sm font-bold">{displayViewCount}</span>
                {apiViewCount !== null && apiViewCount > localViewCount && (
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 ml-0.5" />
                )}
              </button>
            )}

            {isPaused && !showViewsModal && !showDeleteConfirm && (
              <div className="text-white text-xs bg-black/40 backdrop-blur-sm px-2 py-1 rounded-full">Pause</div>
            )}

            {isMyStory && (
              <div className="relative">
                <button onClick={handleToggleOptions} className="p-2 bg-black/20 backdrop-blur-md rounded-full text-white active:scale-95 transition-transform">
                  <MoreVertical size={20} />
                </button>
                <AnimatePresence>
                  {showOptionsMenu && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9, y: -8 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9, y: -8 }}
                      transition={{ duration: 0.12 }}
                      className="absolute top-12 right-0 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden min-w-[180px] border border-gray-200 dark:border-gray-700"
                    >
                      <button onClick={handleDeleteClick} className="w-full flex items-center gap-3 px-4 py-3 text-red-600 dark:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                        <Trash2 size={16} />
                        <span className="font-semibold text-sm">Supprimer</span>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {!isMyStory && (
              <button onClick={togglePause} className="p-2 bg-black/20 backdrop-blur-md rounded-full text-white active:scale-95 transition-transform">
                <MoreVertical size={20} />
              </button>
            )}

            <button onClick={onClose} className="p-2 bg-black/20 backdrop-blur-md rounded-full text-white active:scale-95 transition-transform">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Contenu média */}
        <div className="w-full h-full flex items-center justify-center relative">
          {!isCurrentSlideLoaded && slide.type !== "text" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
              <Loader2 className="animate-spin text-white/60" size={44} />
            </div>
          )}

          <AnimatePresence mode="wait">
            <motion.div
              key={slideKey}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              className="w-full h-full flex items-center justify-center"
            >
              {slide.type === "text" ? (
                <div className="w-full h-full flex items-center justify-center p-8" style={{ background: slideBg }}>
                  <motion.p
                    initial={{ scale: 0.96, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.18 }}
                    className="text-white text-center text-3xl md:text-4xl font-bold drop-shadow-lg px-4 whitespace-pre-wrap break-words"
                    style={{ fontFamily: slide.fontFamily || "Inter", color: slide.textColor || "#ffffff" }}
                  >
                    {slideText}
                  </motion.p>
                </div>
              ) : slide.type === "video" ? (
                <video
                  ref={videoRef}
                  src={MEDIA_URL(mediaUrl)}
                  onLoadedData={handleMediaLoaded}
                  autoPlay playsInline muted={isMuted}
                  className="w-full h-full object-contain"
                  style={{ opacity: isCurrentSlideLoaded ? 1 : 0 }}
                />
              ) : (
                <img
                  src={MEDIA_URL(mediaUrl)}
                  onLoad={handleMediaLoaded}
                  alt="Story"
                  className="w-full h-full object-contain"
                  style={{ opacity: isCurrentSlideLoaded ? 1 : 0, transition: 'opacity 0.15s' }}
                />
              )}
            </motion.div>
          </AnimatePresence>

          {slide.type !== "text" && slideText && isCurrentSlideLoaded && (
            <div className="absolute bottom-20 left-4 right-4 z-[10001]">
              <p className="text-white text-sm bg-black/40 backdrop-blur-md px-4 py-3 rounded-2xl">
                {slideText}
              </p>
            </div>
          )}
        </div>

        {/* Navigation zones */}
        <div
          className="absolute left-0 right-0 z-[10000] flex"
          style={{
            top: 'calc(env(safe-area-inset-top) + 90px)',
            bottom: !isMyStory ? 'calc(env(safe-area-inset-bottom) + 90px)' : '60px',
          }}
        >
          <button onClick={handlePrevSlide} className="w-[40%] h-full" aria-label="Slide précédent" />
          <button onClick={handleNextSlide} className="flex-1 h-full" aria-label="Slide suivant" />
        </div>

        {/* Compteur slides */}
        <div className="absolute top-[calc(env(safe-area-inset-top)+70px)] right-4 z-[10001]">
          <div className="bg-black/40 backdrop-blur-md px-2 py-1 rounded-full">
            <span className="text-white text-xs font-bold">{slideIdx + 1}/{allSlides.length}</span>
          </div>
        </div>

        {/* Réponse (autres users) */}
        {!isMyStory && (
          <form
            onSubmit={handleReplySubmit}
            className="absolute bottom-[calc(env(safe-area-inset-bottom)+20px)] left-4 right-4 z-[10001] flex items-center gap-3"
          >
            <input
              type="text"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Envoyer un message..."
              className="flex-1 px-4 py-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-full text-white placeholder-white/60 outline-none focus:bg-white/20 transition-all"
              onClick={(e) => e.stopPropagation()}
              onFocus={() => setIsPaused(true)}
              onBlur={() => setIsPaused(false)}
              disabled={sendingReaction}
            />
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); sendReaction("❤️", "emoji"); }}
              disabled={sendingReaction}
              className="p-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-full text-white hover:bg-white/20 active:scale-95 transition-all disabled:opacity-50"
              title="Réagir"
            >
              {sendingReaction ? <Loader2 size={20} className="animate-spin" /> : <Heart size={20} />}
            </button>
            <button
              type="submit"
              disabled={sendingReaction || !replyText.trim()}
              className="p-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-full text-white hover:bg-white/20 active:scale-95 transition-all disabled:opacity-50"
              title="Envoyer"
            >
              {sendingReaction ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
            </button>
          </form>
        )}

        <AnimatePresence>
          {reactionFeedback && (
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.96 }}
              className={`absolute left-1/2 -translate-x-1/2 z-[10002] px-4 py-2 rounded-full text-sm font-semibold shadow-xl ${
                reactionFeedback.type === "error"
                  ? "bottom-[calc(env(safe-area-inset-bottom)+82px)] bg-red-500 text-white"
                  : "bottom-[calc(env(safe-area-inset-bottom)+82px)] bg-white text-gray-900"
              }`}
            >
              {reactionFeedback.message}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="absolute bottom-2 text-white/20 text-[9px] font-bold tracking-widest pointer-events-none uppercase">
          Glisser vers le bas pour fermer
        </div>
      </motion.div>

      {/* Modals */}
      <AnimatePresence>
        {showViewsModal && (
          <ViewsModal
            storyId={story._id}
            slideIndex={slideIdx}
            localViewers={localViewers}
            onClose={handleCloseViewsModal}
            onNavigate={onNavigate}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showDeleteConfirm && (
          <DeleteConfirmModal onConfirm={handleConfirmDelete} onCancel={handleCancelDelete} />
        )}
      </AnimatePresence>
    </>
  );
}
