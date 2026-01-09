// src/pages/Home/PostCard.jsx - VERSION LAYOUT INSTAGRAM
import React, { forwardRef, useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  TrashIcon, HeartIcon, ChatBubbleLeftIcon, ShareIcon, BookmarkIcon,
} from "@heroicons/react/24/outline";
import { HeartIcon as HeartSolid, CheckBadgeIcon, RocketLaunchIcon, FireIcon, BookmarkIcon as BookmarkSolid } from "@heroicons/react/24/solid";
import { useAuth } from "../../context/AuthContext";
import { usePosts } from "../../context/PostsContext";
import { useDarkMode } from "../../context/DarkModeContext";
import PostMedia from "./PostMedia";
import PostComments from "./PostComments";
import PostShareSection from "./PostShareSection";
import ErrorBoundary from "../../components/ErrorBoundary";
import axiosClient from "../../api/axiosClientGlobal";

// === CONFIGURATION ===
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "dlymdclhe";
const IMG_BASE = `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/`;
const VID_BASE = `https://res.cloudinary.com/${CLOUD_NAME}/video/upload/`;

// === UTILITAIRES ===
const getCloudinaryUrl = (id, opts = {}) => {
  if (!id) return null;
  if (typeof id !== 'string') return null;
  if (id.startsWith('http')) return id;
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

// === COMPOSANT AVATAR ===
const SimpleAvatar = React.memo(({ username, photo, size = 40 }) => {
  const [error, setError] = useState(false);
  const initials = useMemo(() => {
    if (!username) return "?";
    const parts = username.trim().split(" ");
    return parts.length > 1 
      ? (parts[0][0] + parts[1][0]).toUpperCase().slice(0, 2)
      : username.substring(0, 2).toUpperCase();
  }, [username]);

  const bgColor = useMemo(() => {
    const colors = ["#f97316", "#ef4444", "#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#ec4899", "#6366f1"];
    let hash = 0;
    const str = username || "";
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  }, [username]);

  const url = useMemo(() => {
    return photo ? getCloudinaryUrl(photo, { width: size * 2, height: size * 2, crop: 'thumb', gravity: 'face' }) : null;
  }, [photo, size]);

  if (error || !url) {
    return (
      <div 
        className="rounded-full flex items-center justify-center text-white font-bold select-none shadow-sm flex-shrink-0"
        style={{ width: size, height: size, backgroundColor: bgColor, fontSize: size * 0.4 }}
      >
        {initials}
      </div>
    );
  }
  return (
    <img 
      src={url} alt={username} 
      className="rounded-full object-cover shadow-sm bg-gray-200 flex-shrink-0"
      style={{ width: size, height: size }} 
      onError={() => setError(true)}
      loading="lazy"
    />
  );
});

// === SKELETON LOADER COMPONENT ===
const SkeletonPostCard = ({ isDarkMode }) => (
  <div className={`relative w-full max-w-[630px] mx-auto border-b ${
    isDarkMode ? 'bg-black border-gray-800' : 'bg-white border-gray-200'
  } animate-pulse overflow-hidden`}>
    {/* Header */}
    <div className="flex justify-between items-center p-4">
      <div className="flex items-center gap-3">
        <div className={`rounded-full w-10 h-10 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-300'}`} />
        <div className="flex flex-col gap-1.5">
          <div className={`h-4 rounded w-32 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-300'}`}></div>
          <div className={`h-3 rounded w-20 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
        </div>
      </div>
    </div>
    
    {/* Media Placeholder */}
    <div className={`w-full aspect-square ${isDarkMode ? 'bg-gray-800' : 'bg-gray-300'}`} />
    
    {/* Actions Bar */}
    <div className="flex items-center p-4 gap-4">
      <div className={`h-6 w-6 rounded ${isDarkMode ? 'bg-gray-800' : 'bg-gray-300'}`} />
      <div className={`h-6 w-6 rounded ${isDarkMode ? 'bg-gray-800' : 'bg-gray-300'}`} />
      <div className={`h-6 w-6 rounded ${isDarkMode ? 'bg-gray-800' : 'bg-gray-300'}`} />
      <div className={`h-6 w-6 rounded ml-auto ${isDarkMode ? 'bg-gray-800' : 'bg-gray-300'}`} />
    </div>
    
    {/* Content Text */}
    <div className="px-4 pb-4 space-y-2">
      <div className={`h-3 rounded w-full ${isDarkMode ? 'bg-gray-800' : 'bg-gray-300'}`}></div>
      <div className={`h-3 rounded w-3/4 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
    </div>
  </div>
);

// === POST CARD PRINCIPALE ===
const PostCard = forwardRef(({ post, onDeleted, showToast, loading = false }, ref) => {
  const { isDarkMode } = useDarkMode();
  
  // ✅ SKELETON LOADER
  if (loading) {
    return <SkeletonPostCard isDarkMode={isDarkMode} />;
  }

  if (!post || !post._id) return null;

  const { user: currentUser, getToken, updateUserProfile } = useAuth();
  const navigate = useNavigate();
  const cardRef = useRef(null);

  // Normalisation des données utilisateur du post
  const postUser = useMemo(() => {
    const u = post.user || post.author || {};
    return {
      _id: u._id || post.userId || post.author?._id || "unknown",
      fullName: u.fullName || post.fullName || "Utilisateur Inconnu",
      profilePhoto: u.profilePhoto || post.userProfilePhoto || null,
      isVerified: !!(u.isVerified || post.isVerified),
      isPremium: !!(u.isPremium || post.isPremium)
    };
  }, [post]);

  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [comments, setComments] = useState([]);
  const [commentsCount, setCommentsCount] = useState(0);
  const [isBoosted, setIsBoosted] = useState(!!post.isBoosted);
  const [showComments, setShowComments] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [animateHeart, setAnimateHeart] = useState(false);
  const [loadingLike, setLoadingLike] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loadingFollow, setLoadingFollow] = useState(false);
  const [showBoostModal, setShowBoostModal] = useState(false);
  const [boostLoading, setBoostLoading] = useState(false);
  const [selectedBoost, setSelectedBoost] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [saved, setSaved] = useState(false);

  const boostPlans = [
    { id: 1, duration: 24, amount: 1000, label: "24h Flash", description: "Visibilité boostée pendant 24h", icon: <RocketLaunchIcon className="w-5 h-5 text-orange-500"/> },
    { id: 2, duration: 72, amount: 2500, label: "3 Jours (Populaire)", description: "Idéal pour vendre un service", popular: true, icon: <FireIcon className="w-5 h-5 text-red-500"/> },
    { id: 3, duration: 168, amount: 5000, label: "Semaine Pro", description: "Domination totale du feed", icon: <CheckBadgeIcon className="w-5 h-5 text-purple-500"/> }
  ];

  const MAX_CHARS = 280;
  const content = post.content || "";
  const shouldTruncate = content.length > MAX_CHARS;
  const displayContent = shouldTruncate && !expanded ? content.substring(0, MAX_CHARS) + "..." : content;

  // Sync Likes et Comments
  useEffect(() => {
    setLikesCount(Array.isArray(post.likes) ? post.likes.length : (post.likesCount || 0));
    if (Array.isArray(post.comments)) {
        setComments(post.comments);
        setCommentsCount(post.comments.length);
    } else {
        setCommentsCount(post.commentsCount || 0);
    }
    setIsBoosted(!!post.isBoosted);

    if (currentUser && Array.isArray(post.likes)) {
      setLiked(post.likes.some(like => {
          const likeId = typeof like === 'object' ? like._id : like;
          return likeId?.toString() === currentUser._id?.toString();
      }));
    }
  }, [post, currentUser]);

  // Synchronisation du state "following"
  useEffect(() => {
    if (!currentUser || !postUser._id || postUser._id === 'unknown') {
      setIsFollowing(false);
      return;
    }

    if (currentUser._id === postUser._id) {
      setIsFollowing(false);
      return;
    }

    const followingList = Array.isArray(currentUser.following) ? currentUser.following : [];
    
    const isCurrentlyFollowing = followingList.some(followId => {
      const idToCompare = typeof followId === 'object' && followId !== null
        ? (followId._id || followId.id || followId)
        : followId;
      
      return idToCompare?.toString() === postUser._id.toString();
    });

    setIsFollowing(isCurrentlyFollowing);
  }, [currentUser, postUser._id, currentUser?.following]);

  // Observer Vidéos
  useEffect(() => {
    if (!cardRef.current) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const video = entry.target;
        if (entry.isIntersecting) {
            if (video.paused) video.play().catch(() => {});
        } else {
            if (!video.paused) video.pause();
        }
      });
    }, { threshold: 0.7 });
    const videos = cardRef.current.querySelectorAll('video');
    videos.forEach(v => { v.muted = true; observer.observe(v); });
    return () => observer.disconnect();
  }, []);

  // Handle Like
  const handleLike = useCallback(async (e) => {
    e?.stopPropagation();
    if (!currentUser) return showToast?.("Connectez-vous pour aimer", "info");
    if (loadingLike) return;

    const prevLiked = liked;
    const prevCount = likesCount;
    setLiked(!prevLiked);
    setLikesCount(c => prevLiked ? c - 1 : c + 1);
    setAnimateHeart(!prevLiked);
    setLoadingLike(true);

    try {
      await axiosClient.post(`/posts/${post._id}/like`);
    } catch (err) {
      console.error('❌ [Like] Erreur:', err);
      setLiked(prevLiked);
      setLikesCount(prevCount);
      const errorMsg = err.response?.data?.message || err.response?.data?.error || "Erreur lors du like";
      showToast?.(errorMsg, "error");
    } finally {
      setLoadingLike(false);
      setTimeout(() => setAnimateHeart(false), 800);
    }
  }, [currentUser, liked, likesCount, loadingLike, post._id, showToast]);

  // Handle Follow
  const handleFollow = useCallback(async (e) => {
    e?.stopPropagation();

    if (!currentUser) {
      showToast?.("Connectez-vous pour suivre", "info");
      return;
    }

    if (loadingFollow) return;
    
    if (!postUser._id || postUser._id === "unknown") {
      showToast?.("Utilisateur introuvable", "error");
      return;
    }

    if (currentUser._id === postUser._id) {
      showToast?.("Vous ne pouvez pas vous suivre vous-même", "info");
      return;
    }

    const wasFollowing = isFollowing;
    const action = wasFollowing ? 'unfollow' : 'follow';

    setIsFollowing(!wasFollowing);
    setLoadingFollow(true);

    try {
      const response = await axiosClient.post(`/follow/${action}/${postUser._id}`);
      const data = response.data;

      if (!data.success) {
        throw new Error(data.error || data.message || "Échec de l'opération");
      }

      const currentFollowing = Array.isArray(currentUser.following) 
        ? currentUser.following 
        : [];
      
      const updatedFollowing = wasFollowing
        ? currentFollowing.filter(id => {
            const idStr = typeof id === 'object' ? (id._id || id) : id;
            return idStr?.toString() !== postUser._id.toString();
          })
        : [...currentFollowing, postUser._id];

      if (updateUserProfile) {
        await updateUserProfile(currentUser._id, {
          following: updatedFollowing
        });
      }

      showToast?.(
        wasFollowing 
          ? `Vous ne suivez plus ${postUser.fullName}` 
          : `Vous suivez ${postUser.fullName}`, 
        "success"
      );
      
    } catch (err) {
      console.error(`❌ [Follow] Erreur ${action}:`, err);
      setIsFollowing(wasFollowing);
      
      const errorMessage = err.response?.data?.error 
        || err.response?.data?.message 
        || err.message 
        || "Impossible de modifier l'abonnement";
      
      showToast?.(errorMessage, "error");
    } finally {
      setLoadingFollow(false);
    }
  }, [currentUser, isFollowing, loadingFollow, postUser, showToast, updateUserProfile]);

  const handleBoostPayment = useCallback(async () => {
    if (!selectedBoost) return;
    setBoostLoading(true);
    try {
      const token = await getToken();
      const res = await axiosClient.post('/boost/create-session', {
        postId: post._id, 
        planId: selectedBoost.id, 
        amount: selectedBoost.amount, 
        duration: selectedBoost.duration
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const data = res.data;
      
      if (!data.success) throw new Error(data.message);
      if (data.url) { 
        window.location.href = data.url; 
      } else {
        setIsBoosted(true);
        showToast?.("🚀 Post boosté avec succès !", "success");
        setShowBoostModal(false);
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message || "Erreur de paiement";
      showToast?.(errorMsg, "error");
    } finally {
      setBoostLoading(false);
    }
  }, [selectedBoost, getToken, post._id, showToast]);

  // ✅ HANDLE DELETE POST
  const handleDeletePost = useCallback(async () => {
    setIsDeleting(true);
    try {
      await axiosClient.delete(`/posts/${post._id}`);
      showToast?.("Post supprimé avec succès", "success");
      setShowDeleteModal(false);
      
      if (onDeleted) {
        onDeleted(post._id);
      }
    } catch (err) {
      console.error('❌ [Delete] Erreur:', err);
      
      let errorMsg = "Erreur lors de la suppression";
      
      if (err.response?.status === 404) {
        errorMsg = "Ce post a déjà été supprimé ou n'existe plus";
        setShowDeleteModal(false);
        if (onDeleted) {
          onDeleted(post._id);
        }
      } else if (err.response?.status === 403) {
        errorMsg = "Vous n'avez pas la permission de supprimer ce post";
      } else if (err.response?.status === 401) {
        errorMsg = "Vous devez être connecté pour supprimer ce post";
      } else {
        errorMsg = err.response?.data?.message || err.response?.data?.error || errorMsg;
      }
      
      showToast?.(errorMsg, "error");
    } finally {
      setIsDeleting(false);
    }
  }, [post._id, showToast, onDeleted]);

  const isOwner = currentUser && (post.userId === currentUser._id || postUser._id === currentUser._id);
  const canFollow = currentUser && !isOwner && postUser._id !== 'unknown';

  const mediaUrls = useMemo(() => 
    (Array.isArray(post.media) ? post.media : [post.media]).filter(Boolean).map(m => 
        getCloudinaryUrl(typeof m === 'string' ? m : m.url, { width: 1080, format: 'auto' })
    ), [post.media]);

  const formattedDate = useMemo(() => {
    if (!post.createdAt) return "";
    try { return new Date(post.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }); } 
    catch (e) { return ""; }
  }, [post.createdAt]);

  return (
    <motion.div
      ref={node => { cardRef.current = node; if (ref) ref.current = node; }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className={`relative w-full max-w-[630px] mx-auto border-b ${
        isDarkMode ? 'bg-black border-gray-800' : 'bg-white border-gray-200'
      } overflow-hidden`}
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
          <button onClick={() => navigate(`/profile/${postUser._id}`)} className="relative shrink-0">
            <SimpleAvatar username={postUser.fullName} photo={postUser.profilePhoto} size={38} />
            {postUser.isPremium && (
                 <div className="absolute -bottom-1 -right-1 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full p-[2px] border border-black z-10">
                     <CheckBadgeIcon className="w-3 h-3 text-white" />
                 </div>
            )}
          </button>
          
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span onClick={() => navigate(`/profile/${postUser._id}`)}
                className={`font-semibold text-sm cursor-pointer hover:opacity-70 truncate max-w-[150px] ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {postUser.fullName}
              </span>
              {postUser.isVerified && <CheckBadgeIcon className="w-4 h-4 text-orange-500" />}
            </div>
            <span className="text-xs text-gray-500">{formattedDate}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isOwner && !isBoosted && (
             <button onClick={(e) => { e.stopPropagation(); setShowBoostModal(true); }}
                className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 hover:shadow-lg transition-all active:scale-95">
                 <RocketLaunchIcon className="w-3 h-3" /> Booster
             </button>
          )}
          
          {canFollow && (
            <button 
                onClick={handleFollow}
                disabled={loadingFollow}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    isFollowing 
                    ? isDarkMode ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    : isDarkMode ? 'bg-white text-black hover:bg-gray-200' : 'bg-black text-white hover:bg-gray-800'
                }`}
            >
                {loadingFollow ? "..." : isFollowing ? "Suivi(e)" : "Suivre"}
            </button>
          )}
          
          {isOwner && (
            <button 
              onClick={(e) => { e.stopPropagation(); setShowDeleteModal(true); }}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-all"
            >
              <TrashIcon className="w-5 h-5 text-gray-400" />
            </button>
          )}
        </div>
      </div>

      {/* CONTENU TEXTE - Déplacé en haut */}
      {content && (
        <div className="px-3 pb-2">
          <p className={`text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            <span className="font-semibold mr-2">{postUser.fullName}</span>
            <span className={isDarkMode ? 'text-gray-200' : 'text-gray-800'}>{displayContent}</span>
          </p>
          {shouldTruncate && (
            <button onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
              className="text-gray-500 text-sm hover:text-gray-400">
              {expanded ? "moins" : "plus"}
            </button>
          )}
        </div>
      )}

      {/* MEDIA */}
      {mediaUrls.length > 0 && (
          <div className="w-full">
             <PostMedia mediaUrls={mediaUrls} />
          </div>
      )}

      {/* ACTIONS BAR - Style Instagram */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-4">
          <button onClick={handleLike} disabled={loadingLike} className="group active:scale-90 transition-transform">
            {liked ? <HeartSolid className={`w-7 h-7 text-red-500 ${animateHeart ? 'animate-bounce' : ''}`} /> 
                   : <HeartIcon className={`w-7 h-7 ${isDarkMode ? 'text-white' : 'text-gray-900'} group-hover:text-gray-500`} />}
          </button>

          <button onClick={(e) => { e.stopPropagation(); setShowComments(!showComments); }} className="group active:scale-90 transition-transform">
            <ChatBubbleLeftIcon className={`w-7 h-7 ${isDarkMode ? 'text-white' : 'text-gray-900'} group-hover:text-gray-500`} />
          </button>

          <button onClick={(e) => { e.stopPropagation(); setShowShare(!showShare); }} className="group active:scale-90 transition-transform">
            <ShareIcon className={`w-7 h-7 ${isDarkMode ? 'text-white' : 'text-gray-900'} group-hover:text-gray-500`} />
          </button>
        </div>

        <button onClick={() => setSaved(!saved)} className="group active:scale-90 transition-transform">
          {saved ? <BookmarkSolid className="w-7 h-7 text-gray-900 dark:text-white" />
                 : <BookmarkIcon className={`w-7 h-7 ${isDarkMode ? 'text-white' : 'text-gray-900'} group-hover:text-gray-500`} />}
        </button>
      </div>

      {/* LIKES COUNT */}
      {likesCount > 0 && (
        <div className="px-3 pb-1">
          <span className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            {likesCount} {likesCount === 1 ? 'mention J\'aime' : 'mentions J\'aime'}
          </span>
        </div>
      )}

      {/* COMMENTS PREVIEW */}
      {commentsCount > 0 && !showComments && (
        <button 
          onClick={(e) => { e.stopPropagation(); setShowComments(true); }}
          className="px-3 pb-2 text-sm text-gray-500 hover:text-gray-400 text-left"
        >
          Afficher {commentsCount === 1 ? 'le commentaire' : `les ${commentsCount} commentaires`}
        </button>
      )}

      {/* MODAL DELETE */}
      <AnimatePresence>
          {showDeleteModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
                onClick={() => !isDeleting && setShowDeleteModal(false)}>
                  <motion.div 
                      initial={{ scale: 0.9, opacity: 0 }} 
                      animate={{ scale: 1, opacity: 1 }} 
                      exit={{ scale: 0.9, opacity: 0 }}
                      className={`w-full max-w-sm rounded-2xl p-6 shadow-2xl ${isDarkMode ? 'bg-gray-900 border border-gray-800' : 'bg-white'}`}
                      onClick={(e) => e.stopPropagation()}>
                      <div className="text-center mb-6">
                          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                              <TrashIcon className="w-8 h-8 text-red-500" />
                          </div>
                          <h2 className={`text-xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                              Supprimer ce post ?
                          </h2>
                          <p className="text-sm text-gray-500">
                              Cette action est irréversible.
                          </p>
                      </div>
                      <div className="flex gap-3">
                          <button 
                              onClick={() => setShowDeleteModal(false)}
                              disabled={isDeleting}
                              className={`flex-1 py-3 rounded-xl font-bold ${
                                  isDarkMode ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'
                              } disabled:opacity-50`}
                          >
                              Annuler
                          </button>
                          <button 
                              onClick={handleDeletePost}
                              disabled={isDeleting}
                              className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 disabled:opacity-50"
                          >
                              {isDeleting ? "..." : "Supprimer"}
                          </button>
                      </div>
                  </motion.div>
              </div>
          )}
      </AnimatePresence>

      {/* COMMENTAIRES & PARTAGE */}
      <AnimatePresence>
        {showComments && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-gray-200 dark:border-gray-800">
            <ErrorBoundary>
                <PostComments 
                    postId={post._id} comments={comments}
                    setComments={(newComments) => {
                        if (typeof newComments === 'function') {
                            setComments(prev => {
                                const next = newComments(prev);
                                setCommentsCount(next.length);
                                return next;
                            });
                        } else {
                            setComments(newComments);
                            setCommentsCount(newComments.length);
                        }
                    }}
                    currentUser={currentUser} getToken={getToken} showToast={showToast} navigate={navigate}
                />
            </ErrorBoundary>
          </motion.div>
        )}
        {showShare && (
           <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden border-t border-gray-200 dark:border-gray-800">
              <PostShareSection postId={post._id} showToast={showToast} />
           </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

PostCard.displayName = "PostCard";
export default React.memo(PostCard);