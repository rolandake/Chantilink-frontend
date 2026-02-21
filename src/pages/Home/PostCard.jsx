// src/pages/Home/PostCard.jsx
// ✅ FIX CRITIQUE : tous les hooks appelés AVANT tout return conditionnel
// React exige que les hooks soient appelés dans le même ordre à chaque render
// Un return avant un hook = "Rendered fewer hooks than expected" = crash

import React, {
  forwardRef, useState, useEffect, useCallback, useMemo, useRef, memo, lazy, Suspense
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

const PostComments = lazy(() => import("./PostComments"));
const PostShareSection = lazy(() => import("./PostShareSection"));

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "dlymdclhe";
const IMG_BASE = `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/`;
const VID_BASE = `https://res.cloudinary.com/${CLOUD_NAME}/video/upload/`;

// ============================================
// OBSERVER VIDÉO GLOBAL PARTAGÉ
// ============================================
let globalVideoObserver = null;
const getVideoObserver = () => {
  if (!globalVideoObserver) {
    globalVideoObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const video = entry.target;
        if (entry.isIntersecting) video.play().catch(() => {});
        else video.pause();
      });
    }, { threshold: 0.7 });
  }
  return globalVideoObserver;
};

// ============================================
// UTILITAIRES
// ============================================
const getCloudinaryUrl = (id, opts = {}) => {
  if (!id || typeof id !== 'string') return null;
  if (id.startsWith('http') || id.startsWith('data:')) return id;
  if (id.startsWith('/uploads/') || id.startsWith('uploads/')) {
    return `${API_URL.replace('/api', '')}/${id.replace(/^\/+/, '')}`;
  }
  const isVideo = /\.(mp4|webm|mov|avi)$/i.test(id);
  const base = isVideo ? VID_BASE : IMG_BASE;
  const transforms = [
    opts.width && `w_${opts.width}`,
    opts.height && `h_${opts.height}`,
    opts.crop && `c_${opts.crop}`,
    opts.quality ? `q_${opts.quality}` : 'q_auto',
    opts.format ? `f_${opts.format}` : 'f_auto',
    opts.gravity && `g_${opts.gravity}`,
    'fl_progressive:steep',
    !isVideo && 'dpr_auto'
  ].filter(Boolean).join(',');
  return `${base}${transforms ? transforms + '/' : ''}${id.replace(/^\/+/, '')}`;
};

// ============================================
// AVATAR
// ============================================
const SimpleAvatar = memo(({ username, photo, size = 40 }) => {
  const [error, setError] = useState(false);

  const initials = useMemo(() => {
    if (!username) return "?";
    const parts = username.trim().split(" ");
    return parts.length > 1
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : username.substring(0, 2).toUpperCase();
  }, [username]);

  const bgColor = useMemo(() => {
    const colors = ["#f97316","#ef4444","#8b5cf6","#3b82f6","#10b981","#f59e0b","#ec4899","#6366f1"];
    let hash = 0;
    for (let i = 0; i < (username || "").length; i++) hash = username.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  }, [username]);

  const url = useMemo(() => {
    if (!photo) return null;
    if (photo.startsWith('data:image')) return photo;
    return getCloudinaryUrl(photo, { width: size * 2, height: size * 2, crop: 'thumb', gravity: 'face' });
  }, [photo, size]);

  if (error || !url) {
    return (
      <div
        className="rounded-full flex items-center justify-center text-white font-bold select-none flex-shrink-0"
        style={{ width: size, height: size, backgroundColor: bgColor, fontSize: size * 0.4 }}
      >
        {initials}
      </div>
    );
  }
  return (
    <img
      src={url} alt={username}
      className="rounded-full object-cover bg-gray-200 flex-shrink-0"
      style={{ width: size, height: size }}
      onError={() => setError(true)}
      loading="lazy"
    />
  );
});
SimpleAvatar.displayName = 'SimpleAvatar';

// ============================================
// SKELETON
// ============================================
const SkeletonPostCard = memo(({ isDarkMode }) => (
  <div className={`w-full max-w-[630px] mx-auto animate-pulse ${isDarkMode ? 'bg-black' : 'bg-white'}`}>
    <div className="flex items-center gap-3 p-3">
      <div className={`rounded-full w-10 h-10 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-300'}`} />
      <div className="flex-1 space-y-1.5">
        <div className={`h-4 rounded w-32 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-300'}`} />
        <div className={`h-3 rounded w-20 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`} />
      </div>
    </div>
    <div className={`w-full aspect-square ${isDarkMode ? 'bg-gray-800' : 'bg-gray-300'}`} />
    <div className="flex items-center p-3 gap-4">
      {[1,2,3].map(i => <div key={i} className={`h-6 w-6 rounded ${isDarkMode ? 'bg-gray-800' : 'bg-gray-300'}`} />)}
    </div>
  </div>
));
SkeletonPostCard.displayName = 'SkeletonPostCard';

// ============================================
// DELETE MODAL
// ============================================
const DeleteModal = memo(({ isDarkMode, isDeleting, onConfirm, onCancel }) => (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
    onClick={() => !isDeleting && onCancel()}
  >
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }}
      transition={{ duration: 0.15 }}
      className={`w-full max-w-sm rounded-2xl p-6 shadow-2xl ${isDarkMode ? 'bg-gray-900 border border-gray-800' : 'bg-white'}`}
      onClick={e => e.stopPropagation()}
    >
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <TrashIcon className="w-8 h-8 text-red-500" />
        </div>
        <h2 className={`text-xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Supprimer ce post ?</h2>
        <p className="text-sm text-gray-500">Cette action est irréversible.</p>
      </div>
      <div className="flex gap-3">
        <button onClick={onCancel} disabled={isDeleting}
          className={`flex-1 py-3 rounded-xl font-bold ${isDarkMode ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'} disabled:opacity-50`}>
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
DeleteModal.displayName = 'DeleteModal';

// ============================================
// ACTIONS BAR
// ============================================
const ActionsBar = memo(({ liked, likesCount, saved, commentsCount, showComments, isDarkMode, onLike, onToggleComments, onToggleShare, onSave }) => (
  <>
    <div className="flex items-center justify-between px-3 py-2">
      <div className="flex items-center gap-4">
        <button onClick={onLike} className="active:scale-90 transition-transform" style={{ WebkitTapHighlightColor: 'transparent' }}>
          {liked
            ? <HeartSolid className="w-7 h-7 text-red-500" />
            : <HeartIcon className={`w-7 h-7 ${isDarkMode ? 'text-white' : 'text-gray-900'}`} />}
        </button>
        <button onClick={onToggleComments} className="active:scale-90 transition-transform" style={{ WebkitTapHighlightColor: 'transparent' }}>
          <ChatBubbleLeftIcon className={`w-7 h-7 ${isDarkMode ? 'text-white' : 'text-gray-900'}`} />
        </button>
        <button onClick={onToggleShare} className="active:scale-90 transition-transform" style={{ WebkitTapHighlightColor: 'transparent' }}>
          <ShareIcon className={`w-7 h-7 ${isDarkMode ? 'text-white' : 'text-gray-900'}`} />
        </button>
      </div>
      <button onClick={onSave} className="active:scale-90 transition-transform" style={{ WebkitTapHighlightColor: 'transparent' }}>
        {saved
          ? <BookmarkSolid className={`w-7 h-7 ${isDarkMode ? 'text-white' : 'text-gray-900'}`} />
          : <BookmarkIcon className={`w-7 h-7 ${isDarkMode ? 'text-white' : 'text-gray-900'}`} />}
      </button>
    </div>
    {likesCount > 0 && (
      <div className="px-3 pb-1">
        <span className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
          {likesCount.toLocaleString()} {likesCount === 1 ? "mention J'aime" : "mentions J'aime"}
        </span>
      </div>
    )}
    {commentsCount > 0 && !showComments && (
      <button onClick={onToggleComments} className="px-3 pb-3 text-sm text-gray-500 hover:text-gray-400 text-left">
        Afficher {commentsCount === 1 ? 'le commentaire' : `les ${commentsCount.toLocaleString()} commentaires`}
      </button>
    )}
  </>
));
ActionsBar.displayName = 'ActionsBar';

// ============================================
// ✅ POST CARD INNER — contient TOUS les hooks, jamais de return conditionnel
// Séparé de PostCard pour permettre les guards post/loading sans violer les règles hooks
// ============================================
const PostCardInner = forwardRef(({ post, onDeleted, showToast, mockPost = false, priority = false }, ref) => {
  const { isDarkMode } = useDarkMode();
  const { user: currentUser, getToken, updateUserProfile } = useAuth();
  const navigate = useNavigate();
  const cardRef = useRef(null);

  const isMockPost = mockPost || post._id?.startsWith('post_') || post.isMockPost;

  // ✅ postUser mémoïsé — calculé TOUJOURS, même si on va return null ensuite
  const postUser = useMemo(() => {
    const u = post.user || post.author || {};
    const fullName = u.fullName || post.fullName || "";
    const isInvalidName = !fullName ||
      ["Utilisateur Inconnu","Unknown User","undefined","null"].includes(fullName) ||
      fullName.trim() === "";
    const isInvalidId = !u._id || ['unknown','null','undefined'].includes(u._id);
    const isBannedDeleted = u.isBanned || u.isDeleted ||
      u.status === 'deleted' || u.status === 'banned';
    return {
      _id: u._id || post.userId || post.author?._id || "unknown",
      fullName: fullName || "Utilisateur Inconnu",
      profilePhoto: u.profilePhoto || u.profilePicture || post.userProfilePhoto || null,
      isVerified: !!(u.isVerified || u.verified || post.isVerified),
      isPremium: !!(u.isPremium || post.isPremium),
      isInvalid: !isMockPost && (isInvalidName || isInvalidId),
      isBannedOrDeleted: isBannedDeleted,
    };
  }, [post._id, post.user?._id, post.fullName, isMockPost]);

  // ✅ TOUS LES ÉTATS — déclarés avant tout return conditionnel
  const [liked, setLiked] = useState(() =>
    currentUser && Array.isArray(post.likes)
      ? post.likes.some(l => (typeof l === 'object' ? l._id : l)?.toString() === currentUser._id?.toString())
      : false
  );
  const [likesCount, setLikesCount] = useState(() =>
    Array.isArray(post.likes) ? post.likes.length : (post.likesCount || 0)
  );
  const [commentsCount, setCommentsCount] = useState(() =>
    Array.isArray(post.comments) ? post.comments.length : (post.commentsCount || 0)
  );
  const [comments, setComments] = useState(() =>
    Array.isArray(post.comments) ? post.comments : []
  );
  const [saved, setSaved] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isFollowing, setIsFollowing] = useState(() => {
    if (!currentUser || !postUser._id || postUser._id === 'unknown') return false;
    if (currentUser._id === postUser._id) return false;
    return (currentUser.following || []).some(id => {
      const idStr = typeof id === 'object' ? (id._id || id) : id;
      return idStr?.toString() === postUser._id.toString();
    });
  });
  const [loadingFollow, setLoadingFollow] = useState(false);
  const [loadingLike, setLoadingLike] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // ✅ TOUS LES REFS — déclarés avant tout return conditionnel
  const stateRef = useRef({ liked, likesCount, loadingLike, isFollowing, loadingFollow });
  const postRef = useRef({ post, postUser, currentUser, isMockPost, onDeleted, showToast, updateUserProfile });

  // ✅ TOUS LES EFFETS — déclarés avant tout return conditionnel
  useEffect(() => {
    stateRef.current = { liked, likesCount, loadingLike, isFollowing, loadingFollow };
  });

  useEffect(() => {
    postRef.current = { post, postUser, currentUser, isMockPost, onDeleted, showToast, updateUserProfile };
  });

  useEffect(() => {
    if (!cardRef.current) return;
    const observer = getVideoObserver();
    const videos = cardRef.current.querySelectorAll('video');
    videos.forEach(v => { v.muted = true; observer.observe(v); });
    return () => videos.forEach(v => observer.unobserve(v));
  }, []);

  // ✅ TOUS LES CALLBACKS — déclarés avant tout return conditionnel
  const handleLike = useCallback((e) => {
    e?.stopPropagation();
    const { liked, likesCount, loadingLike } = stateRef.current;
    const { post, currentUser, isMockPost, showToast } = postRef.current;
    if (!currentUser) { showToast?.("Connectez-vous pour aimer", "info"); return; }
    if (loadingLike) return;
    const newLiked = !liked;
    setLiked(newLiked);
    setLikesCount(c => newLiked ? c + 1 : c - 1);
    if (isMockPost) return;
    setLoadingLike(true);
    axiosClient.post(`/posts/${post._id}/like`)
      .catch(err => {
        setLiked(liked);
        setLikesCount(likesCount);
        showToast?.(err.response?.data?.message || "Erreur lors du like", "error");
      })
      .finally(() => setLoadingLike(false));
  }, []);

  const handleFollow = useCallback((e) => {
    e?.stopPropagation();
    const { isFollowing, loadingFollow } = stateRef.current;
    const { postUser, currentUser, isMockPost, showToast, updateUserProfile } = postRef.current;
    if (!currentUser) { showToast?.("Connectez-vous pour suivre", "info"); return; }
    if (loadingFollow) return;
    if (!postUser._id || postUser._id === "unknown") { showToast?.("Utilisateur introuvable", "error"); return; }
    if (currentUser._id === postUser._id) { showToast?.("Vous ne pouvez pas vous suivre", "info"); return; }
    const wasFollowing = isFollowing;
    setIsFollowing(!wasFollowing);
    showToast?.(!wasFollowing ? `Vous suivez ${postUser.fullName}` : `Vous ne suivez plus ${postUser.fullName}`, "success");
    if (isMockPost) return;
    const action = wasFollowing ? 'unfollow' : 'follow';
    setLoadingFollow(true);
    axiosClient.post(`/follow/${action}/${postUser._id}`)
      .then(({ data }) => {
        if (!data.success) throw new Error(data.error || "Échec");
        const currentFollowing = currentUser.following || [];
        const updatedFollowing = wasFollowing
          ? currentFollowing.filter(id => {
              const s = typeof id === 'object' ? (id._id || id) : id;
              return s?.toString() !== postUser._id.toString();
            })
          : [...currentFollowing, postUser._id];
        updateUserProfile?.(currentUser._id, { following: updatedFollowing });
      })
      .catch(err => {
        setIsFollowing(wasFollowing);
        showToast?.(err.response?.data?.error || err.message || "Erreur", "error");
      })
      .finally(() => setLoadingFollow(false));
  }, []);

  const handleDeletePost = useCallback(async () => {
    const { post, isMockPost, onDeleted, showToast } = postRef.current;
    if (isMockPost) {
      showToast?.("Post supprimé", "success");
      setShowDeleteModal(false);
      onDeleted?.(post._id);
      return;
    }
    setIsDeleting(true);
    try {
      await axiosClient.delete(`/posts/${post._id}`);
      showToast?.("Post supprimé avec succès", "success");
      setShowDeleteModal(false);
      onDeleted?.(post._id);
    } catch (err) {
      const status = err.response?.status;
      if (status === 404) {
        setShowDeleteModal(false);
        onDeleted?.(post._id);
      } else {
        showToast?.(
          status === 403 ? "Permission refusée" :
          err.response?.data?.message || "Erreur lors de la suppression",
          "error"
        );
      }
    } finally {
      setIsDeleting(false);
    }
  }, []);

  const handleProfileClick = useCallback((e) => {
    e?.stopPropagation();
    navigate(`/profile/${postRef.current.postUser._id}`);
  }, [navigate]);

  const handleToggleComments = useCallback((e) => { e?.stopPropagation(); setShowComments(v => !v); }, []);
  const handleToggleShare    = useCallback((e) => { e?.stopPropagation(); setShowShare(v => !v); }, []);
  const handleSave           = useCallback(() => setSaved(v => !v), []);
  const handleToggleExpanded = useCallback((e) => { e?.stopPropagation(); setExpanded(v => !v); }, []);
  const handleOpenDelete     = useCallback((e) => { e?.stopPropagation(); setShowDeleteModal(true); }, []);

  // ✅ DONNÉES DÉRIVÉES — après tous les hooks
  const MAX_CHARS = 280;
  const content = post.content || "";
  const shouldTruncate = content.length > MAX_CHARS;
  const displayContent = shouldTruncate && !expanded ? content.substring(0, MAX_CHARS) + "..." : content;

  const isOwner  = currentUser && (post.userId === currentUser._id || postUser._id === currentUser._id);
  const canFollow = currentUser && !isOwner && postUser._id !== 'unknown';
  const isBoosted = !!post.isBoosted;

  const mediaUrls = useMemo(() => {
    const src = post.images || post.media;
    const arr = Array.isArray(src) ? src : (src ? [src] : []);
    return arr.filter(Boolean).map(m => {
      const raw = typeof m === 'string' ? m : m.url;
      if (!raw) return null;
      if (raw.startsWith('data:image')) return raw;
      return getCloudinaryUrl(raw, { width: 1080, format: 'auto' });
    }).filter(Boolean);
  }, [post.images, post.media]);

  const formattedDate = useMemo(() => {
    if (!post.createdAt) return "";
    try { return new Date(post.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }); }
    catch { return ""; }
  }, [post.createdAt]);

  // ✅ GUARDS APRÈS TOUS LES HOOKS — on peut maintenant return null sans violer les règles
  if (!isMockPost && (postUser.isInvalid || postUser.isBannedOrDeleted)) return null;

  // ============================================
  // RENDU
  // ============================================
  return (
    <div
      ref={node => { cardRef.current = node; if (ref) { if (typeof ref === 'function') ref(node); else ref.current = node; } }}
      className={`relative w-full max-w-[630px] mx-auto ${isDarkMode ? 'bg-black' : 'bg-white'}`}
      style={{ margin: 0, padding: 0, contain: 'content' }}
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
                className={`font-semibold text-sm cursor-pointer hover:opacity-70 truncate max-w-[150px] ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {postUser.fullName}
              </span>
              {postUser.isVerified && <CheckBadgeIcon className="w-4 h-4 text-orange-500" />}
            </div>
            <span className="text-xs text-gray-500">{formattedDate}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isOwner && !isBoosted && !isMockPost && (
            <button
              onClick={(e) => { e.stopPropagation(); }}
              className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 active:scale-95 transition-transform"
            >
              <RocketLaunchIcon className="w-3 h-3" /> Booster
            </button>
          )}
          {canFollow && (
            <button onClick={handleFollow} disabled={loadingFollow}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                isFollowing
                  ? isDarkMode ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-600'
                  : isDarkMode ? 'bg-white text-black' : 'bg-black text-white'
              }`}>
              {loadingFollow ? "..." : isFollowing ? "Suivi(e)" : "Suivre"}
            </button>
          )}
          {isOwner && (
            <button onClick={handleOpenDelete} className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <TrashIcon className="w-5 h-5 text-gray-400" />
            </button>
          )}
        </div>
      </div>

      {/* TEXTE */}
      {content && (
        <div className="px-3 pb-2">
          <p className={`text-sm ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>{displayContent}</p>
          {shouldTruncate && (
            <button onClick={handleToggleExpanded} className="text-gray-500 text-sm hover:text-gray-400 mt-1">
              {expanded ? "voir moins" : "voir plus"}
            </button>
          )}
        </div>
      )}

      {/* MEDIA */}
      {mediaUrls.length > 0 && (
        <div className="w-full">
          <PostMedia mediaUrls={mediaUrls} isFirstPost={priority} />
        </div>
      )}

      <ActionsBar
        liked={liked} likesCount={likesCount} saved={saved}
        commentsCount={commentsCount} showComments={showComments}
        isDarkMode={isDarkMode}
        onLike={handleLike} onToggleComments={handleToggleComments}
        onToggleShare={handleToggleShare} onSave={handleSave}
      />

      <AnimatePresence>
        {showComments && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }}
            className="overflow-hidden border-t border-gray-200 dark:border-gray-800"
          >
            <Suspense fallback={<div className="p-4 text-center text-sm text-gray-400">Chargement...</div>}>
              <ErrorBoundary>
                <PostComments
                  postId={post._id} comments={comments}
                  setComments={(newComments) => {
                    if (typeof newComments === 'function') {
                      setComments(prev => { const next = newComments(prev); setCommentsCount(next.length); return next; });
                    } else {
                      setComments(newComments);
                      setCommentsCount(newComments.length);
                    }
                  }}
                  currentUser={currentUser} getToken={getToken}
                  showToast={showToast} navigate={navigate} isMockPost={isMockPost}
                />
              </ErrorBoundary>
            </Suspense>
          </motion.div>
        )}

        {showShare && (
          <motion.div
            initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden border-t border-gray-200 dark:border-gray-800"
          >
            <Suspense fallback={null}>
              <PostShareSection postId={post._id} showToast={showToast} />
            </Suspense>
          </motion.div>
        )}

        {showDeleteModal && (
          <DeleteModal
            isDarkMode={isDarkMode} isDeleting={isDeleting}
            onConfirm={handleDeletePost} onCancel={() => setShowDeleteModal(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
});
PostCardInner.displayName = 'PostCardInner';

// ============================================
// ✅ POSTCARD — wrapper léger qui gère les guards loading/post nuls
// Les guards sont ICI, AVANT de monter PostCardInner qui contient les hooks
// => React ne voit jamais un composant avec des hooks conditionnels
// ============================================
const PostCard = forwardRef(({ post, onDeleted, showToast, loading = false, mockPost = false, priority = false }, ref) => {
  const { isDarkMode } = useDarkMode();

  // ✅ Ces guards sont dans le wrapper, PAS dans le composant avec les hooks
  if (loading) return <SkeletonPostCard isDarkMode={isDarkMode} />;
  if (!post || !post._id) return null;

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
PostCard.displayName = 'PostCard';

// ✅ Comparateur stable pour React.memo
export default memo(PostCard, (prev, next) => {
  return (
    prev.post?._id === next.post?._id &&
    prev.post?.likes?.length === next.post?.likes?.length &&
    prev.post?.comments?.length === next.post?.comments?.length &&
    prev.post?.content === next.post?.content &&
    prev.post?.isBoosted === next.post?.isBoosted &&
    prev.priority === next.priority &&
    prev.loading === next.loading
  );
});