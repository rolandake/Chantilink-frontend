// 📁 src/pages/Home/PostCard.jsx
// ✅ FIX INP : PostCommentsModal et PostShareModal chargés en lazy
// ✅ FIX YOUTUBE : getCloudinaryUrl ignoré pour URLs YouTube/Pixabay/Pexels/Vimeo
// 🔥 FIX VIDÉOS BOT (Pixabay/YouTube hardcodés)
// ✅ FIX OPTIMISTE : posts temp_ masqués dans le rendu normal
//    → plus de CastError backend sur DELETE/LIKE avec un ID temp_xxx
//    → le vrai post apparaît directement après upload (pas de swap visible)
//    → indicateur "Publication en cours..." discret pendant l'upload
// ✅ FIX PEXELS v2 : resolveMediaUrl bloque toutes URLs videos.pexels.com
//    (tokens expirent ~2h — cohérent avec PostsContext.jsx filterBlockedPosts)
// ✅ FIX PIXABAY v3 : bloque toutes URLs cdn.pixabay.com/video dans mediaUrls
//    (CORS bloqué côté navigateur — cohérent avec PostsContext.jsx filterBlockedPosts)
// ✅ FIX URLs INVALIDES v4 : isStructurallyValid() filtre les URLs tronquées/corrompues
//    dans resolveMediaUrl ET dans le useMemo mediaUrls

import React, {
  forwardRef, useState, useEffect, useLayoutEffect,
  useCallback, useMemo, useRef, memo, lazy, Suspense
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  TrashIcon, HeartIcon, ChatBubbleLeftIcon, ShareIcon, BookmarkIcon,
} from "@heroicons/react/24/outline";
import {
  HeartIcon as HeartSolid, CheckBadgeIcon, RocketLaunchIcon, BookmarkIcon as BookmarkSolid
} from "@heroicons/react/24/solid";
import { useAuth } from "../../context/AuthContext";
import { useDarkMode } from "../../context/DarkModeContext";
import PostMedia from "./PostMedia";
import ErrorBoundary from "../../components/ErrorBoundary";
import axiosClient from "../../api/axiosClientGlobal";

const PostCommentsModal = lazy(() => import("./PostComments"));
const PostShareModal    = lazy(() => import("./PostShareSection"));

const API_URL    = import.meta.env.VITE_API_URL    || "http://localhost:5000/api";
const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "dlymdclhe";
const IMG_BASE   = `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/`;
const VID_BASE   = `https://res.cloudinary.com/${CLOUD_NAME}/video/upload/`;

// ─────────────────────────────────────────────
// ✅ FIX PEXELS v2 + PIXABAY v3 + URLs INVALIDES v4
//
// resolveMediaUrl retourne null pour :
//   - videos.pexels.com  → tokens expirés ~2h
//   - cdn.pixabay.com/video → CORS bloqué navigateur
//   - URLs structurellement invalides → tronquées, path vide, corrompues
//
// Note : ce guard est une défense en profondeur. En conditions normales,
// ces posts sont déjà filtrés par PostsContext.filterBlockedPosts()
// et par isValidPost() dans Home.jsx.
// ─────────────────────────────────────────────
const EXTERNAL_URL_PATTERNS = [
  'youtube.com', 'youtu.be', 'player.vimeo.com', 'dailymotion.com',
  'cdn.pixabay.com', 'images.pexels.com',
  'img.youtube.com', 'i.vimeocdn.com', 'pixabay.com',
];

const isExternalMediaUrl = (url) =>
  url && EXTERNAL_URL_PATTERNS.some(p => url.includes(p));

// ─────────────────────────────────────────────
// ✅ isStructurallyValid — détecte les URLs tronquées/corrompues
//
// Rejette :
//  - URLs trop courtes (< 10 chars)
//  - URLs sans hostname valide
//  - URLs avec pathname vide ou "/"
//  - URLs qui ne parsent pas
//
// Accepte sans parser :
//  - data:image/...   (inline base64)
//  - blob:...         (object URLs)
//  - /uploads/...     (chemins relatifs backend)
// ─────────────────────────────────────────────
const isStructurallyValid = (url) => {
  if (!url || typeof url !== "string" || url.length < 10) return false;
  if (url.startsWith("data:") || url.startsWith("blob:") || url.startsWith("/")) return true;
  try {
    const u = new URL(url);
    return !!(u.hostname && u.pathname && u.pathname !== "/");
  } catch {
    return false;
  }
};

// ─────────────────────────────────────────────
// OBSERVER VIDÉO
// ─────────────────────────────────────────────
let _videoObserver = null;
const _observedVideos = new WeakMap();

const getVideoObserver = () => {
  if (!_videoObserver) {
    _videoObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const v = entry.target;
        if (!document.contains(v)) { _videoObserver?.unobserve(v); return; }
        if (entry.isIntersecting) v.play().catch(() => {});
        else v.pause();
      });
    }, { threshold: 0.7 });
  }
  return _videoObserver;
};

// ─────────────────────────────────────────────
// CLOUDINARY URL
// ─────────────────────────────────────────────
const getCloudinaryUrl = (id, opts = {}) => {
  if (!id || typeof id !== "string") return null;
  if (id.startsWith("http") || id.startsWith("data:")) return id;
  if (id.startsWith("/uploads/") || id.startsWith("uploads/"))
    return `${API_URL.replace("/api", "")}/${id.replace(/^\/+/, "")}`;
  const isVideo = /\.(mp4|webm|mov|avi)$/i.test(id);
  const base = isVideo ? VID_BASE : IMG_BASE;
  const t = [
    opts.width   && `w_${opts.width}`,
    opts.height  && `h_${opts.height}`,
    opts.crop    && `c_${opts.crop}`,
    opts.quality ? `q_${opts.quality}` : "q_auto",
    opts.format  ? `f_${opts.format}`  : "f_auto",
    opts.gravity && `g_${opts.gravity}`,
    "fl_progressive:steep",
    !isVideo && "dpr_auto",
  ].filter(Boolean).join(",");
  return `${base}${t ? t + "/" : ""}${id.replace(/^\/+/, "")}`;
};

// ─────────────────────────────────────────────
// ✅ resolveMediaUrl — v4 avec validation structurelle
// ─────────────────────────────────────────────
const resolveMediaUrl = (raw, opts = {}) => {
  if (!raw || typeof raw !== 'string') return null;
  if (raw.startsWith('data:image')) return raw;

  // ✅ FIX : bloquer TOUTE URL videos.pexels.com — tokens expirés ~2h
  if (raw.includes('videos.pexels.com')) return null;

  // ✅ FIX : bloquer TOUTE URL cdn.pixabay.com/video — CORS bloqué
  if (raw.includes('cdn.pixabay.com/video')) return null;

  // ✅ FIX v4 : rejeter les URLs structurellement invalides
  if (!isStructurallyValid(raw)) return null;

  if (isExternalMediaUrl(raw)) return raw;
  return getCloudinaryUrl(raw, opts);
};

// ─────────────────────────────────────────────
// ✅ INDICATEUR POST EN COURS D'UPLOAD
// ─────────────────────────────────────────────
export const PostUploadingIndicator = memo(({ isDarkMode, content, mediaCount }) => (
  <div className={`w-full max-w-[630px] mx-auto px-4 py-3 flex items-center gap-3 ${
    isDarkMode ? "bg-black border-b border-white/5" : "bg-white border-b border-gray-100"
  }`}>
    <div className="w-8 h-8 flex-shrink-0">
      <svg className="animate-spin w-8 h-8 text-orange-500" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
        <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
      </svg>
    </div>
    <div className="flex-1 min-w-0">
      <p className={`text-sm font-medium truncate ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>
        {content ? content.substring(0, 60) + (content.length > 60 ? "…" : "") : "Publication en cours…"}
      </p>
      <p className="text-xs text-orange-500 mt-0.5">
        {mediaCount > 0 ? `Upload de ${mediaCount} fichier${mediaCount > 1 ? "s" : ""}…` : "Envoi en cours…"}
      </p>
    </div>
  </div>
));
PostUploadingIndicator.displayName = "PostUploadingIndicator";

// ─────────────────────────────────────────────
// AVATAR
// ─────────────────────────────────────────────
const SimpleAvatar = memo(({ username, photo, size = 40 }) => {
  const [error, setError] = useState(false);
  const initials = useMemo(() => {
    if (!username) return "?";
    const p = username.trim().split(" ");
    return p.length > 1 ? (p[0][0] + p[1][0]).toUpperCase() : username.substring(0, 2).toUpperCase();
  }, [username]);
  const bgColor = useMemo(() => {
    const colors = ["#f97316","#ef4444","#8b5cf6","#3b82f6","#10b981","#f59e0b","#ec4899","#6366f1"];
    let h = 0;
    for (let i = 0; i < (username || "").length; i++) h = username.charCodeAt(i) + ((h << 5) - h);
    return colors[Math.abs(h) % colors.length];
  }, [username]);
  const url = useMemo(() => {
    if (!photo || typeof photo !== 'string') return null;
    if (photo.startsWith("data:image")) return photo;
    return resolveMediaUrl(photo, { width: size * 2, height: size * 2, crop: "thumb", gravity: "face" });
  }, [photo, size]);
  if (error || !url)
    return (
      <div className="rounded-full flex items-center justify-center text-white font-bold select-none flex-shrink-0"
        style={{ width: size, height: size, backgroundColor: bgColor, fontSize: size * 0.4 }}>
        {initials}
      </div>
    );
  return (
    <img src={url} alt={username}
      className="rounded-full object-cover bg-gray-200 flex-shrink-0"
      style={{ width: size, height: size }}
      onError={() => setError(true)} loading="lazy" />
  );
});
SimpleAvatar.displayName = "SimpleAvatar";

// ─────────────────────────────────────────────
// SKELETON
// ─────────────────────────────────────────────
const SkeletonPostCard = memo(({ isDarkMode }) => (
  <div className={`w-full max-w-[630px] mx-auto animate-pulse ${isDarkMode ? "bg-black" : "bg-white"}`}>
    <div className="flex items-center gap-3 p-3">
      <div className={`rounded-full w-10 h-10 ${isDarkMode ? "bg-gray-800" : "bg-gray-300"}`} />
      <div className="flex-1 space-y-1.5">
        <div className={`h-4 rounded w-32 ${isDarkMode ? "bg-gray-800" : "bg-gray-300"}`} />
        <div className={`h-3 rounded w-20 ${isDarkMode ? "bg-gray-700" : "bg-gray-200"}`} />
      </div>
    </div>
    <div className={`w-full aspect-square ${isDarkMode ? "bg-gray-800" : "bg-gray-300"}`} />
    <div className="flex items-center p-3 gap-4">
      {[1,2,3].map(i => <div key={i} className={`h-6 w-6 rounded ${isDarkMode ? "bg-gray-800" : "bg-gray-300"}`} />)}
    </div>
  </div>
));
SkeletonPostCard.displayName = "SkeletonPostCard";

// ─────────────────────────────────────────────
// DELETE MODAL
// ─────────────────────────────────────────────
const DeleteModal = memo(({ isDarkMode, isDeleting, onConfirm, onCancel }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
    onClick={() => !isDeleting && onCancel()}>
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }} transition={{ duration: 0.15 }}
      className={`w-full max-w-sm rounded-2xl p-6 shadow-2xl ${isDarkMode ? "bg-gray-900 border border-gray-800" : "bg-white"}`}
      onClick={e => e.stopPropagation()}
    >
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <TrashIcon className="w-8 h-8 text-red-500" />
        </div>
        <h2 className={`text-xl font-bold mb-2 ${isDarkMode ? "text-white" : "text-gray-900"}`}>Supprimer ce post ?</h2>
        <p className="text-sm text-gray-500">Cette action est irréversible.</p>
      </div>
      <div className="flex gap-3">
        <button onClick={onCancel} disabled={isDeleting}
          className={`flex-1 py-3 rounded-xl font-bold ${isDarkMode ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-900"} disabled:opacity-50`}>
          Annuler
        </button>
        <button onClick={onConfirm} disabled={isDeleting}
          className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 disabled:opacity-50">
          {isDeleting ? "..." : "Supprimer"}
        </button>
      </div>
    </motion.div>
  </div>
));
DeleteModal.displayName = "DeleteModal";

// ─────────────────────────────────────────────
// ACTIONS BAR
// ─────────────────────────────────────────────
const ActionsBar = memo(({
  liked, likesCount, saved, commentsCount,
  isDarkMode, onLike, onOpenComments, onOpenShare, onSave,
}) => (
  <>
    <div className="flex items-center justify-between px-3 py-2">
      <div className="flex items-center gap-4">
        <button onClick={onLike} className="active:scale-90 transition-transform" style={{ WebkitTapHighlightColor: "transparent" }}>
          {liked
            ? <HeartSolid className="w-7 h-7 text-red-500" />
            : <HeartIcon className={`w-7 h-7 ${isDarkMode ? "text-white" : "text-gray-900"}`} />}
        </button>
        <button onClick={onOpenComments} className="active:scale-90 transition-transform" style={{ WebkitTapHighlightColor: "transparent" }}>
          <ChatBubbleLeftIcon className={`w-7 h-7 ${isDarkMode ? "text-white" : "text-gray-900"}`} />
        </button>
        <button onClick={onOpenShare} className="active:scale-90 transition-transform" style={{ WebkitTapHighlightColor: "transparent" }}>
          <ShareIcon className={`w-7 h-7 ${isDarkMode ? "text-white" : "text-gray-900"}`} />
        </button>
      </div>
      <button onClick={onSave} className="active:scale-90 transition-transform" style={{ WebkitTapHighlightColor: "transparent" }}>
        {saved
          ? <BookmarkSolid className={`w-7 h-7 ${isDarkMode ? "text-white" : "text-gray-900"}`} />
          : <BookmarkIcon  className={`w-7 h-7 ${isDarkMode ? "text-white" : "text-gray-900"}`} />}
      </button>
    </div>
    {likesCount > 0 && (
      <div className="px-3 pb-1">
        <span className={`text-sm font-semibold ${isDarkMode ? "text-white" : "text-gray-900"}`}>
          {likesCount.toLocaleString()} {likesCount === 1 ? "mention J'aime" : "mentions J'aime"}
        </span>
      </div>
    )}
    {commentsCount > 0 && (
      <button onClick={onOpenComments} className="px-3 pb-3 text-sm text-gray-500 hover:text-gray-400 text-left">
        Afficher {commentsCount === 1 ? "le commentaire" : `les ${commentsCount.toLocaleString()} commentaires`}
      </button>
    )}
  </>
));
ActionsBar.displayName = "ActionsBar";

// ─────────────────────────────────────────────
// POST CARD INNER
// ─────────────────────────────────────────────
const PostCardInner = forwardRef(({ post, onDeleted, showToast, mockPost = false, priority = false }, ref) => {
  const { isDarkMode } = useDarkMode();
  const { user: currentUser, getToken, updateUserProfile } = useAuth();
  const navigate = useNavigate();
  const cardRef  = useRef(null);
  const vidsRef  = useRef([]);

  const isMockPost = mockPost || post._id?.startsWith("post_") || post.isMockPost;
  const isOptimistic = !!post.isOptimistic || post._id?.startsWith("temp_");

  const postUser = useMemo(() => {
    const u = post.user || post.author || {};
    const fullName = u.fullName || post.fullName || "";
    const isInvalidName = !fullName ||
      ["Utilisateur Inconnu","Unknown User","undefined","null"].includes(fullName) ||
      fullName.trim() === "";
    const resolvedId = u._id || u.id || post.userId || post.author?._id || null;
    const isInvalidId = !resolvedId || ["unknown","null","undefined"].includes(String(resolvedId));
    const isBannedDeleted = u.isBanned || u.isDeleted || u.status === "deleted" || u.status === "banned";
    return {
      _id:               resolvedId || "unknown",
      fullName:          fullName || "Utilisateur Inconnu",
      profilePhoto:      u.profilePhoto || u.profilePicture || post.userProfilePhoto || null,
      isVerified:        !!(u.isVerified || u.verified || post.isVerified),
      isPremium:         !!(u.isPremium || post.isPremium),
      isInvalid:         !isMockPost && !isOptimistic && (isInvalidName || isInvalidId),
      isBannedOrDeleted: isBannedDeleted,
    };
  }, [
    post._id,
    post.user?._id, post.user?.id, post.user?.fullName, post.user?.profilePhoto,
    post.user?.isVerified, post.user?.isPremium, post.user?.isBanned, post.user?.isDeleted,
    post.userId, post.author?._id, post.fullName, isMockPost, isOptimistic,
  ]);

  const [liked,             setLiked]             = useState(() =>
    currentUser && Array.isArray(post.likes)
      ? post.likes.some(l => (typeof l === "object" ? l._id : l)?.toString() === currentUser._id?.toString())
      : false
  );
  const [likesCount,        setLikesCount]        = useState(() => Array.isArray(post.likes) ? post.likes.length : (post.likesCount || 0));
  const [commentsCount,     setCommentsCount]     = useState(() => Array.isArray(post.comments) ? post.comments.length : (post.commentsCount || 0));
  const [comments,          setComments]          = useState(() => Array.isArray(post.comments) ? post.comments : []);
  const [saved,             setSaved]             = useState(false);
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [showShareModal,    setShowShareModal]    = useState(false);
  const [showDeleteModal,   setShowDeleteModal]   = useState(false);
  const [isDeleting,        setIsDeleting]        = useState(false);
  const [isFollowing,       setIsFollowing]       = useState(() => {
    if (!currentUser || !postUser._id || postUser._id === "unknown") return false;
    if (currentUser._id === postUser._id) return false;
    return (currentUser.following || []).some(id => {
      const s = typeof id === "object" ? (id._id || id) : id;
      return s?.toString() === postUser._id.toString();
    });
  });
  const [loadingFollow, setLoadingFollow] = useState(false);
  const [expanded,      setExpanded]      = useState(false);

  const stateRef = useRef({});
  const postRef  = useRef({});

  useLayoutEffect(() => {
    stateRef.current = { liked, likesCount, isFollowing, loadingFollow };
  });
  useLayoutEffect(() => {
    postRef.current = { post, postUser, currentUser, isMockPost, isOptimistic, onDeleted, showToast, updateUserProfile };
  });

  const loadingLikeRef = useRef(false);

  useEffect(() => {
    if (!cardRef.current) return;
    const obs  = getVideoObserver();
    const vids = Array.from(cardRef.current.querySelectorAll("video"));
    vids.forEach(v => { obs.observe(v); _observedVideos.set(v, true); });
    vidsRef.current = vids;
    return () => {
      vidsRef.current.forEach(v => { obs.unobserve(v); });
      vidsRef.current = [];
    };
  }, []);

  useEffect(() => { setCommentsCount(comments.length); }, [comments.length]);

  const isOwner = useMemo(() =>
    !!(currentUser && (
      String(post.userId) === String(currentUser._id) ||
      String(postUser._id) === String(currentUser._id)
    )),
    [currentUser?._id, post.userId, postUser._id]
  );

  const canFollow = useMemo(() =>
    !!(currentUser && !isOwner && postUser._id !== "unknown"),
    [currentUser, isOwner, postUser._id]
  );

  const handleLike = useCallback((e) => {
    e?.stopPropagation();
    if (loadingLikeRef.current) return;
    const { liked, likesCount } = stateRef.current;
    const { post, currentUser, isMockPost, isOptimistic, showToast } = postRef.current;
    if (isOptimistic) { showToast?.("Publication en cours, patientez…", "info"); return; }
    if (!currentUser) { showToast?.("Connectez-vous pour aimer", "info"); return; }
    loadingLikeRef.current = true;
    const nl = !liked;
    setLiked(nl);
    setLikesCount(c => nl ? c + 1 : c - 1);
    if (isMockPost) { loadingLikeRef.current = false; return; }
    axiosClient.post(`/posts/${post._id}/like`)
      .catch(err => {
        setLiked(liked);
        setLikesCount(likesCount);
        showToast?.(err.response?.data?.message || "Erreur", "error");
      })
      .finally(() => { loadingLikeRef.current = false; });
  }, []);

  const handleFollow = useCallback((e) => {
    e?.stopPropagation();
    const { isFollowing, loadingFollow } = stateRef.current;
    const { postUser, currentUser, isMockPost, showToast, updateUserProfile } = postRef.current;
    if (!currentUser) { showToast?.("Connectez-vous", "info"); return; }
    if (loadingFollow) return;
    if (!postUser._id || postUser._id === "unknown") { showToast?.("Utilisateur introuvable", "error"); return; }
    if (currentUser._id === postUser._id) { showToast?.("Vous ne pouvez pas vous suivre", "info"); return; }
    const was = isFollowing;
    setIsFollowing(!was);
    showToast?.(!was ? `Vous suivez ${postUser.fullName}` : `Vous ne suivez plus ${postUser.fullName}`, "success");
    if (isMockPost) return;
    setLoadingFollow(true);
    axiosClient.post(`/follow/${was ? "unfollow" : "follow"}/${postUser._id}`)
      .then(({ data }) => {
        if (!data.success) throw new Error(data.error || "Échec");
        const cf = currentUser.following || [];
        const uf = was
          ? cf.filter(id => { const s = typeof id === "object" ? (id._id || id) : id; return s?.toString() !== postUser._id.toString(); })
          : [...cf, postUser._id];
        updateUserProfile?.(currentUser._id, { following: uf });
      })
      .catch(err => { setIsFollowing(was); showToast?.(err.response?.data?.error || err.message || "Erreur", "error"); })
      .finally(() => setLoadingFollow(false));
  }, []);

  const handleDeletePost = useCallback(async () => {
    const { post, isMockPost, isOptimistic, onDeleted, showToast } = postRef.current;
    if (isOptimistic || post._id?.startsWith("temp_")) {
      showToast?.("Publication en cours, patientez…", "info");
      setShowDeleteModal(false);
      return;
    }
    if (isMockPost) { showToast?.("Post supprimé", "success"); setShowDeleteModal(false); onDeleted?.(post._id); return; }
    setIsDeleting(true);
    try {
      await axiosClient.delete(`/posts/${post._id}`);
      showToast?.("Post supprimé", "success");
      setShowDeleteModal(false);
      onDeleted?.(post._id);
    } catch (err) {
      const s = err.response?.status;
      if (s === 404) { setShowDeleteModal(false); onDeleted?.(post._id); }
      else showToast?.(s === 403 ? "Permission refusée" : err.response?.data?.message || "Erreur", "error");
    } finally { setIsDeleting(false); }
  }, []);

  const handleProfileClick = useCallback((e) => {
    e?.stopPropagation();
    const { postUser } = postRef.current;
    const id = postUser._id;
    if (!id || id === "unknown" || id === "null" || id === "undefined") return;
    navigate(`/profile/${id}`);
  }, [navigate]);

  const handleOpenComments = useCallback((e) => { e?.stopPropagation(); setShowCommentsModal(true); }, []);
  const handleOpenShare    = useCallback((e) => { e?.stopPropagation(); setShowShareModal(true);    }, []);
  const handleSave         = useCallback(() => setSaved(v => !v), []);
  const handleExpand       = useCallback((e) => { e?.stopPropagation(); setExpanded(v => !v); }, []);
  const handleOpenDelete   = useCallback((e) => { e?.stopPropagation(); setShowDeleteModal(true); }, []);

  const setRootRef = useCallback((node) => {
    cardRef.current = node;
    if (ref) {
      if (typeof ref === "function") ref(node);
      else ref.current = node;
    }
  }, [ref]);

  const content        = post.content || post.contenu || "";
  const shouldTruncate = content.length > 280;
  const displayContent = shouldTruncate && !expanded ? content.substring(0, 280) + "..." : content;
  const isBoosted = !!post.isBoosted;

  const firstImage = Array.isArray(post.images) ? post.images[0] : null;
  const firstMedia = Array.isArray(post.media)  ? post.media[0]  : null;
  const imagesLen  = Array.isArray(post.images) ? post.images.length : 0;
  const mediaLen   = Array.isArray(post.media)  ? post.media.length  : 0;

  // ─────────────────────────────────────────────
  // ✅ mediaUrls — v4 avec validation structurelle
  //
  // Filtres appliqués sur chaque URL :
  //  1. videos.pexels.com → bloqué (tokens expirés)
  //  2. cdn.pixabay.com/video → bloqué (CORS)
  //  3. isStructurallyValid() → rejette URLs tronquées/corrompues
  //  4. resolveMediaUrl() → transforme en URL Cloudinary optimisée ou retourne null
  //  5. Déduplication par seen Set
  // ─────────────────────────────────────────────
  const mediaUrls = useMemo(() => {
    const seen = new Set();
    const result = [];
    const addUrl = (raw) => {
      if (!raw || typeof raw !== 'string') return;

      // ✅ blob: URLs → toujours acceptées sans transformation
      if (raw.startsWith('blob:')) {
        if (!seen.has(raw)) { seen.add(raw); result.push(raw); }
        return;
      }

      // ✅ FIX PEXELS v2 : bloquer videos.pexels.com — tokens expirés ~2h
      if (raw.includes('videos.pexels.com')) return;

      // ✅ FIX PIXABAY v3 : bloquer cdn.pixabay.com/video — CORS bloqué navigateur
      if (raw.includes('cdn.pixabay.com/video')) return;

      // ✅ FIX v4 : rejeter les URLs structurellement invalides AVANT résolution
      if (!raw.startsWith('data:') && !isStructurallyValid(raw)) return;

      const url = raw.startsWith('data:image') ? raw
        : isExternalMediaUrl(raw) ? raw
        : getCloudinaryUrl(raw, { width: 1080, format: 'auto' });

      // ✅ Vérifier aussi l'URL résolue
      if (url && !seen.has(url) && isStructurallyValid(url)) {
        seen.add(url);
        result.push(url);
      }
    };
    if (post.embedUrl) addUrl(post.embedUrl);
    if (post.videoUrl) addUrl(post.videoUrl);
    const imgSrc = post.images || post.media;
    const arr = Array.isArray(imgSrc) ? imgSrc : (imgSrc ? [imgSrc] : []);
    arr.forEach(m => addUrl(typeof m === 'string' ? m : m?.url));
    return result;
  }, [post.embedUrl, post.videoUrl, firstImage, firstMedia, imagesLen, mediaLen]);

  const hasMedia = mediaUrls.length > 0
    || post.mediaType === 'youtube'
    || post.mediaType === 'video'
    || !!(post.thumbnail && (post.videoUrl || post.embedUrl));

  const formattedDate = useMemo(() => {
    if (!post.createdAt) return "";
    try { return new Date(post.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short" }); }
    catch { return ""; }
  }, [post.createdAt ? new Date(post.createdAt).getTime() : 0]);

  if (!isMockPost && !isOptimistic && (postUser.isInvalid || postUser.isBannedOrDeleted)) return null;

  return (
    <>
      <div
        ref={setRootRef}
        className={`relative w-full max-w-[630px] mx-auto ${isDarkMode ? "bg-black" : "bg-white"}`}
        style={{ margin: 0, padding: 0, contain: "content" }}
      >
        {isBoosted && (
          <div className="absolute top-0 right-0 z-10 p-2">
            <div className="flex items-center gap-1 bg-gradient-to-r from-orange-500 to-pink-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-bl-xl shadow-lg select-none">
              <RocketLaunchIcon className="w-3 h-3" /> SPONSORISÉ
            </div>
          </div>
        )}

        {/* HEADER */}
        <div className="flex justify-between items-center p-3">
          <div className="flex items-center gap-3">
            <button onClick={handleProfileClick} className="relative shrink-0">
              <SimpleAvatar username={postUser.fullName} photo={postUser.profilePhoto} size={38} />
              {postUser.isPremium && (
                <div className="absolute -bottom-1 -right-1 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full p-[2px] border border-black z-10">
                  <CheckBadgeIcon className="w-3 h-3 text-white" />
                </div>
              )}
            </button>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span onClick={handleProfileClick}
                  className={`font-semibold text-sm cursor-pointer hover:opacity-70 truncate max-w-[150px] ${isDarkMode ? "text-white" : "text-gray-900"}`}>
                  {postUser.fullName}
                </span>
                {postUser.isVerified && <CheckBadgeIcon className="w-4 h-4 text-orange-500" />}
              </div>
              <span className="text-xs text-gray-500">{formattedDate}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isOwner && !isBoosted && !isMockPost && !isOptimistic && (
              <button onClick={e => e.stopPropagation()}
                className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 active:scale-95 transition-transform">
                <RocketLaunchIcon className="w-3 h-3" /> Booster
              </button>
            )}
            {canFollow && !isOptimistic && (
              <button onClick={handleFollow} disabled={loadingFollow}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  isFollowing
                    ? isDarkMode ? "bg-gray-800 text-gray-300" : "bg-gray-100 text-gray-600"
                    : isDarkMode ? "bg-white text-black"       : "bg-black text-white"
                }`}>
                {loadingFollow ? "..." : isFollowing ? "Suivi(e)" : "Suivre"}
              </button>
            )}
            {isOwner && !isOptimistic && (
              <button onClick={handleOpenDelete} className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                <TrashIcon className="w-5 h-5 text-gray-400" />
              </button>
            )}
          </div>
        </div>

        {/* TEXTE */}
        {content && (
          <div className="px-3 pb-2">
            <p className={`text-sm ${isDarkMode ? "text-gray-200" : "text-gray-800"}`}>{displayContent}</p>
            {shouldTruncate && (
              <button onClick={handleExpand} className="text-gray-500 text-sm hover:text-gray-400 mt-1">
                {expanded ? "voir moins" : "voir plus"}
              </button>
            )}
          </div>
        )}

        {/* MEDIA */}
        {hasMedia && (
          <div className="w-full">
            <PostMedia mediaUrls={mediaUrls} isFirstPost={priority} post={post} />
          </div>
        )}

        <ActionsBar
          liked={liked} likesCount={likesCount} saved={saved}
          commentsCount={commentsCount} isDarkMode={isDarkMode}
          onLike={handleLike}
          onOpenComments={handleOpenComments}
          onOpenShare={handleOpenShare}
          onSave={handleSave}
        />

        <AnimatePresence>
          {showDeleteModal && (
            <DeleteModal
              isDarkMode={isDarkMode} isDeleting={isDeleting}
              onConfirm={handleDeletePost} onCancel={() => setShowDeleteModal(false)}
            />
          )}
        </AnimatePresence>
      </div>

      {showCommentsModal && (
        <ErrorBoundary>
          <Suspense fallback={null}>
            <PostCommentsModal
              isOpen={showCommentsModal}
              onClose={() => setShowCommentsModal(false)}
              postId={post._id}
              postUser={postUser}
              postContent={content}
              postMediaUrl={mediaUrls[0] || null}
              likesCount={likesCount}
              comments={comments}
              setComments={setComments}
              currentUser={currentUser}
              getToken={getToken}
              showToast={showToast}
              navigate={navigate}
              isMockPost={isMockPost}
            />
          </Suspense>
        </ErrorBoundary>
      )}

      {showShareModal && (
        <ErrorBoundary>
          <Suspense fallback={null}>
            <PostShareModal
              isOpen={showShareModal}
              onClose={() => setShowShareModal(false)}
              postId={post._id}
              postUser={postUser}
              postContent={content}
              postMediaUrl={mediaUrls[0] || null}
              likesCount={likesCount}
              commentsCount={commentsCount}
              navigate={navigate}
              showToast={showToast}
            />
          </Suspense>
        </ErrorBoundary>
      )}
    </>
  );
});
PostCardInner.displayName = "PostCardInner";

// ─────────────────────────────────────────────
// POSTCARD wrapper
// ─────────────────────────────────────────────
const PostCard = forwardRef(({ post, onDeleted, showToast, loading = false, mockPost = false, priority = false }, ref) => {
  const { isDarkMode } = useDarkMode();

  if (loading) return <SkeletonPostCard isDarkMode={isDarkMode} />;
  if (!post || !post._id) return null;

  if (post.isOptimistic || post._id?.startsWith("temp_")) {
    return (
      <PostUploadingIndicator
        isDarkMode={isDarkMode}
        content={post.content || post.contenu}
        mediaCount={Array.isArray(post.media) ? post.media.length : 0}
      />
    );
  }

  return (
    <PostCardInner
      ref={ref}
      post={post}
      onDeleted={onDeleted}
      showToast={showToast}
      mockPost={mockPost}
      priority={priority}
    />
  );
});
PostCard.displayName = "PostCard";

export default memo(PostCard, (prev, next) =>
  prev.post?._id              === next.post?._id              &&
  prev.post?.likes?.length    === next.post?.likes?.length    &&
  prev.post?.comments?.length === next.post?.comments?.length &&
  prev.post?.content          === next.post?.content          &&
  prev.post?.isBoosted        === next.post?.isBoosted        &&
  prev.post?.isOptimistic     === next.post?.isOptimistic     &&
  prev.priority               === next.priority               &&
  prev.loading                === next.loading
);