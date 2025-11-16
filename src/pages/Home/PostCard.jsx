// src/pages/Home/PostCard.jsx - OPTIMISÉ + BOOST SYSTEM
import React, { forwardRef, useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { loadStripe } from "@stripe/stripe-js";
import {
  TrashIcon, HeartIcon, ChatBubbleLeftIcon, MapPinIcon, ShareIcon,
} from "@heroicons/react/24/outline";
import { HeartIcon as HeartSolid, CheckBadgeIcon, RocketLaunchIcon } from "@heroicons/react/24/solid";
import { useAuth } from "../../context/AuthContext";
import { usePosts } from "../../context/PostsContext";
import { useDarkMode } from "../../context/DarkModeContext";
import { idbGet, idbSet } from "../../utils/idbMigration";
import PostMedia from "./PostMedia";
import PostComments from "./PostComments";
import PostShareSection from "./PostShareSection";
import ErrorBoundary from "../../components/ErrorBoundary";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

// === CLOUDINARY CONFIG ===
const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "dlymdclhe";
const IMG_BASE = `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/`;
const VID_BASE = `https://res.cloudinary.com/${CLOUD_NAME}/video/upload/`;

// === OPTIMIZED URL GENERATOR ===
const getCloudinaryUrl = (id, opts = {}) => {
  if (!id) return null;
  if (id.startsWith('http')) return id;
  if (id.startsWith('/uploads/') || id.startsWith('uploads/')) {
    const base = import.meta.env.VITE_API_URL || "http://localhost:5000";
    return `${base}/${id.replace(/^\/+/, '')}`;
  }

  const isVideo = /\.(mp4|webm|mov|avi)$/i.test(id);
  const base = isVideo ? VID_BASE : IMG_BASE;
  const transforms = [
    opts.width && `w_${opts.width}`,
    opts.height && `h_${opts.height}`,
    opts.crop && `c_${opts.crop}`,
    opts.quality ? `q_${opts.quality}` : 'q_100',
    opts.format ? `f_${opts.format}` : 'f_auto:best',
    opts.gravity && `g_${opts.gravity}`,
    'fl_progressive:steep', 'dpr_2.0', 'fl_lossy.preserve_transparency',
    !isVideo && 'e_sharpen:100,e_improve:outdoor,cs_srgb'
  ].filter(Boolean).join(',');

  return `${base}${transforms ? transforms + '/' : ''}${id.replace(/^\/+/, '')}`;
};

const getOptimizedImageUrl = (id, size = 'medium') => {
  const sizes = {
    thumbnail: { width: 200, height: 200, crop: 'fill', quality: 95, gravity: 'auto:subject' },
    small: { width: 640, height: 640, crop: 'limit', quality: 98 },
    medium: { width: 1080, height: 1350, crop: 'limit', quality: 100 },
    large: { width: 1920, height: 1920, crop: 'limit', quality: 100 },
    full: { width: 2048, crop: 'limit', quality: 100, format: 'auto:best' }
  };
  return getCloudinaryUrl(id, sizes[size] || sizes.medium);
};

// === AVATAR PREMIUM ===
const SimpleAvatar = React.memo(({ username, photo, size = 40 }) => {
  const [error, setError] = useState(false);
  const initials = username ? (username.trim().split(" ").length > 1 
    ? username.trim().split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
    : username.substring(0, 2).toUpperCase()) : "?";

  const color = useMemo(() => {
    const colors = ["#f97316","#ef4444","#8b5cf6","#3b82f6","#10b981","#f59e0b","#ec4899","#6366f1"];
    let hash = 0; for (let i = 0; i < username.length; i++) hash = username.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  }, [username]);

  const url = photo ? getCloudinaryUrl(photo, { width: size*3, height: size*3, crop: 'fill', quality: 100, gravity: 'face:auto' }) : null;

  return error || !url ? (
    <div className="rounded-full flex items-center justify-center text-white font-bold" style={{ width: size, height: size, backgroundColor: color, fontSize: size * 0.4 }}>
      {initials}
    </div>
  ) : (
    <img src={url} alt={username} className="rounded-full object-cover" style={{ width: size, height: size }} onError={() => setError(true)} />
  );
});

// === POST CARD ===
const PostCard = forwardRef(({ post, onDeleted, showToast }, ref) => {
  const { user: currentUser, getToken } = useAuth();
  const { deletePost, updatePost } = usePosts();
  const { isDarkMode } = useDarkMode();
  const navigate = useNavigate();
  const cardRef = useRef(null);

  const postUser = useMemo(() => ({
    _id: post.user?._id || post.userId || post.user || "unknown",
    fullName: post.user?.fullName || post.fullName || post.userName || "Utilisateur",
    profilePhoto: post.user?.profilePhoto || post.userProfilePhoto || post.profilePhoto || null,
    isVerified: Boolean(post.user?.isVerified || post.isVerified),
    isPremium: Boolean(post.user?.isPremium || post.isPremium)
  }), [post]);

  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [comments, setComments] = useState([]);
  const [commentsCount, setCommentsCount] = useState(0);
  const [sharesCount, setSharesCount] = useState(0);
  const [animateHeart, setAnimateHeart] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loadingLike, setLoadingLike] = useState(false);
  const [loadingFollow, setLoadingFollow] = useState(false);
  const [loadingDelete, setLoadingDelete] = useState(false);
  const [expanded, setExpanded] = useState(false);
  
  // ⭐ BOOST STATES
  const [showBoostModal, setShowBoostModal] = useState(false);
  const [boostLoading, setBoostLoading] = useState(false);
  const [selectedBoost, setSelectedBoost] = useState(null);

  const base = import.meta.env.VITE_API_URL || "http://localhost:5000";
  const MAX_CHARS = 300;
  const shouldTruncate = post.content?.length > MAX_CHARS;
  const displayContent = shouldTruncate && !expanded ? post.content.substring(0, MAX_CHARS) + "..." : post.content;

  // ⭐ PLANS DE BOOST
  const boostPlans = [
    { id: 1, duration: 24, amount: 1000, label: "24h", description: "Visibilité pendant 1 jour" },
    { id: 2, duration: 72, amount: 2500, label: "3 jours", description: "Visibilité pendant 3 jours", popular: true },
    { id: 3, duration: 168, amount: 5000, label: "7 jours", description: "Visibilité pendant 1 semaine" }
  ];

  // === VIDEO AUTOPLAY SÉCURISÉ ===
  useEffect(() => {
    if (!cardRef.current) return;
    const videos = cardRef.current.querySelectorAll('video');
    if (videos.length === 0) return;

    let hasInteracted = false;
    const unlockAutoplay = () => {
      hasInteracted = true;
      ['click', 'touchstart', 'keydown'].forEach(ev =>
        document.removeEventListener(ev, unlockAutoplay)
      );
    };

    ['click', 'touchstart', 'keydown'].forEach(ev =>
      document.addEventListener(ev, unlockAutoplay, { once: true })
    );

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const video = entry.target;
        if (entry.isIntersecting) {
          if (video.muted || hasInteracted) {
            video.play().catch(() => {});
          }
        } else {
          video.pause();
        }
      });
    }, { threshold: 0.6 });

    videos.forEach(video => {
      video.muted = true;
      video.playsInline = true;
      video.setAttribute('playsinline', '');
      observer.observe(video);
    });

    return () => {
      observer.disconnect();
      ['click', 'touchstart', 'keydown'].forEach(ev =>
        document.removeEventListener(ev, unlockAutoplay)
      );
    };
  }, []);

  // === SYNC WITH PROPS ===
  useEffect(() => {
    setLikesCount(Array.isArray(post.likes) ? post.likes.length : post.likes || 0);
    setCommentsCount(Array.isArray(post.comments) ? post.comments.length : post.commentsCount || post.comments || 0);
    setSharesCount(Array.isArray(post.shares) ? post.shares.length : post.sharesCount || post.shares || 0);
    setComments(Array.isArray(post.comments) ? post.comments : []);

    if (currentUser && Array.isArray(post.likes)) {
      const isLiked = post.likes.some(id => 
        id === currentUser._id || id === currentUser.id || (typeof id === 'object' && id._id === currentUser._id)
      );
      setLiked(isLiked);
    }
  }, [post, currentUser]);

  // === CACHE LOAD ===
  useEffect(() => {
    let mounted = true;
    const keys = [`postLikes_${post._id}`, `postComments_${post._id}`, `userFollow_${postUser._id}`];
    Promise.all(keys.map(k => idbGet("posts", k))).then(([l, c, f]) => {
      if (!mounted) return;
      if (l !== undefined) setLiked(l);
      if (c) { setComments(c); setCommentsCount(c.length); }
      if (f !== undefined) setIsFollowing(f);
      else if (currentUser?.following?.includes(postUser._id)) {
        setIsFollowing(true); idbSet("posts", keys[2], true);
      }
    }).catch(() => {});
    return () => { mounted = false; };
  }, [post._id, postUser._id, currentUser]);

  // === DEBOUNCED SAVE ===
  const save = useCallback((key, value) => {
    let t; return () => { clearTimeout(t); t = setTimeout(() => idbSet("posts", key, value), 300); };
  }, []);

  // === ACTIONS ===
  const handleLike = async () => {
    if (!currentUser || loadingLike) return;
    const wasLiked = liked;
    setLiked(!wasLiked); setLikesCount(prev => prev + (wasLiked ? -1 : 1)); setAnimateHeart(!wasLiked); setLoadingLike(true);
    save(`postLikes_${post._id}`, !wasLiked)();

    try {
      const token = await getToken();
      const res = await fetch(`${base}/api/posts/${post._id}/like`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` }, credentials: "include"
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setLikesCount(data.data?.likes?.length || 0);
      setLiked(data.data?.likes?.some(id => id === currentUser._id) || false);
    } catch {
      setLiked(wasLiked); setLikesCount(prev => prev + (wasLiked ? 1 : -1));
    } finally {
      setLoadingLike(false); setTimeout(() => setAnimateHeart(false), 500);
    }
  };

  const handleFollow = async () => {
    if (!currentUser || postUser._id === currentUser._id || loadingFollow) return;
    const wasFollowing = isFollowing;
    setIsFollowing(!wasFollowing); setLoadingFollow(true);
    save(`userFollow_${postUser._id}`, !wasFollowing)();

    try {
      const token = await getToken();
      const res = await fetch(`${base}/api/users/${postUser._id}/${wasFollowing ? 'unfollow' : 'follow'}`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` }, credentials: "include"
      });
      if (!res.ok) throw new Error();
      showToast?.(`${!wasFollowing ? "Suivi" : "Désabonné"} ${postUser.fullName}`, "success");
    } catch {
      setIsFollowing(wasFollowing);
    } finally {
      setLoadingFollow(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Supprimer ?")) return;
    setLoadingDelete(true);
    try {
      await deletePost(post._id);
      showToast?.("Supprimé", "success");
      onDeleted?.(post._id);
    } catch {
      showToast?.("Erreur", "error");
    } finally {
      setLoadingDelete(false);
    }
  };

  // ⭐ BOOST HANDLER
  const handleBoost = async (plan) => {
    if (!currentUser) {
      showToast?.("Vous devez être connecté pour booster", "error");
      return;
    }

    setBoostLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`${base}/api/boost/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          contentId: post._id,
          amount: plan.amount,
          duration: plan.duration
        })
      });

      if (!res.ok) throw new Error("Erreur création paiement");

      const data = await res.json();
      const stripe = await stripePromise;
      
      const { error } = await stripe.confirmCardPayment(data.clientSecret);
      
      if (error) {
        showToast?.(`Erreur: ${error.message}`, "error");
      } else {
        showToast?.("✅ Post boosté avec succès !", "success");
        setShowBoostModal(false);
      }
    } catch (error) {
      console.error("Erreur boost:", error);
      showToast?.("Erreur lors du boost", "error");
    } finally {
      setBoostLoading(false);
    }
  };

  const mediaUrls = useMemo(() => 
    (Array.isArray(post.media) ? post.media : [post.media]).filter(Boolean).map(m => 
      typeof m === "string" ? (m.startsWith("http") ? m : getOptimizedImageUrl(m, 'full')) 
      : getOptimizedImageUrl(m.url || m.path || m.publicId || m, 'full')
    ), [post.media]);

  const isOwner = currentUser && [post.userId, postUser._id, post.user?._id].includes(currentUser._id);
  const canFollow = currentUser && postUser._id && postUser._id !== currentUser._id && postUser._id !== 'unknown';

  return (
    <motion.div
      ref={node => { cardRef.current = node; if (ref) ref.current = node; }}
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }} 
      exit={{ opacity: 0, scale: 0.95 }}
      className={`space-y-0 relative ${isDarkMode ? 'bg-black border-b border-white/5 hover:bg-[#0a0a0a]' : 'bg-white border-b border-gray-100/30 hover:bg-gray-50/30'}`}
      style={{ borderBottomWidth: '0.5px' }}
    >
      {/* ⭐ BADGE BOOST */}
      {post.isBoosted && (
        <div className="absolute top-2 right-2 z-10">
          <div className="flex items-center gap-1.5 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 px-2.5 py-1 rounded-full shadow-lg">
            <RocketLaunchIcon className="w-3.5 h-3.5 text-white" />
            <span className="text-white text-xs font-bold">Sponsorisé</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between px-4 pt-2.5 pb-1.5">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button onClick={() => postUser._id !== 'unknown' && navigate(`/profile/${postUser._id}`)} className="hover:opacity-80">
            <SimpleAvatar username={postUser.fullName} photo={postUser.profilePhoto} />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button onClick={() => postUser._id !== 'unknown' && navigate(`/profile/${postUser._id}`)}
                className={`font-semibold text-sm hover:underline truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {postUser.fullName}
              </button>
              {postUser.isVerified && (
                <CheckBadgeIcon className="w-4 h-4" style={{ color: '#f97316' }} />
              )}
              {postUser.isPremium && <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-gradient-to-r from-amber-400 to-orange-500 text-white">PRO</span>}
            </div>
            <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
              {post.createdAt ? new Date(post.createdAt).toLocaleString("fr-FR") : ""}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {/* ⭐ BOOST BUTTON (pour propriétaire) */}
          {isOwner && (
            <button 
              onClick={() => setShowBoostModal(true)}
              className="p-1.5 rounded-full bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 hover:shadow-lg hover:shadow-purple-500/50 transition-all"
              title="Booster ce post"
            >
              <RocketLaunchIcon className="w-4 h-4 text-white" />
            </button>
          )}
          
          {canFollow && (
            <button onClick={handleFollow} disabled={loadingFollow}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${isFollowing 
                ? isDarkMode ? "bg-white/10 text-white hover:bg-white/15 border border-white/20" : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                : "bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"}`}>
              {isFollowing ? "Abonné" : "Suivre"}
            </button>
          )}
          {isOwner && (
            <button onClick={handleDelete} disabled={loadingDelete}
              className={`p-1.5 rounded-full ${isDarkMode ? 'hover:bg-white/10 text-gray-400 hover:text-red-400' : 'hover:bg-gray-100 text-gray-500 hover:text-red-500'}`}>
              <TrashIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {post.content && (
        <div className="px-4 pb-1.5">
          <p className={`whitespace-pre-line text-[15px] ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>{displayContent}</p>
          {shouldTruncate && (
            <button onClick={() => setExpanded(!expanded)} className="text-blue-500 hover:text-blue-400 text-sm font-medium mt-1">
              {expanded ? "Voir moins" : "Voir plus"}
            </button>
          )}
        </div>
      )}

      {post.location && (
        <div className={`flex items-center gap-2 text-sm px-4 pb-1.5 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
          <MapPinIcon className="w-4 h-4" /> <span>{post.location}</span>
        </div>
      )}

      {mediaUrls.length > 0 && <PostMedia mediaUrls={mediaUrls} />}
      
     {/* Actions */}
      <div className="flex items-center px-4 py-2 gap-4">
        <button onClick={handleLike} disabled={loadingLike} className="flex items-center gap-1.5 group">
          <div className="relative">
            {liked ? <HeartSolid className={`w-6 h-6 text-red-500 ${animateHeart ? "animate-bounce" : ""}`} /> 
              : <HeartIcon className={`w-6 h-6 group-hover:text-red-500 ${isDarkMode ? 'text-gray-400' : 'text-gray-700'}`} />}
          </div>
          {likesCount > 0 && <span className={`text-sm font-semibold ${liked ? "text-red-500" : isDarkMode ? "text-gray-300" : "text-gray-700"}`}>{likesCount}</span>}
        </button>

        <button onClick={() => setShowComments(!showComments)} className="flex items-center gap-1.5 group">
          <ChatBubbleLeftIcon className={`w-6 h-6 group-hover:text-blue-500 ${isDarkMode ? 'text-gray-400' : 'text-gray-700'}`} />
          {commentsCount > 0 && <span className={`text-sm font-semibold ${showComments ? "text-blue-500" : isDarkMode ? "text-gray-300" : "text-gray-700"}`}>{commentsCount}</span>}
        </button>

        <button onClick={() => setShowShare(!showShare)} className="flex items-center gap-1.5 group">
          <ShareIcon className={`w-6 h-6 group-hover:text-green-500 ${isDarkMode ? 'text-gray-400' : 'text-gray-700'}`} />
          {sharesCount > 0 && <span className={`text-sm font-semibold ${showShare ? "text-green-500" : isDarkMode ? "text-gray-300" : "text-gray-700"}`}>{sharesCount}</span>}
        </button>
      </div>

      {/* ⭐ MODAL BOOST */}
      <AnimatePresence>
        {showBoostModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
              onClick={() => !boostLoading && setShowBoostModal(false)}
            />
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              className={`fixed bottom-0 left-0 right-0 rounded-t-3xl z-50 p-6 shadow-2xl max-h-[80vh] overflow-y-auto ${isDarkMode ? 'bg-gradient-to-b from-gray-900 to-black' : 'bg-white'}`}
            >
              <div className={`w-12 h-1.5 rounded-full mx-auto mb-6 ${isDarkMode ? 'bg-gray-600' : 'bg-gray-300'}`} />
              
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 rounded-full flex items-center justify-center">
                  <RocketLaunchIcon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className={`font-bold text-xl ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Booster votre post</h3>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Augmentez votre visibilité</p>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                {boostPlans.map((plan) => (
                  <motion.button
                    key={plan.id}
                    onClick={() => setSelectedBoost(plan)}
                    whileTap={{ scale: 0.98 }}
                    className={`w-full p-4 rounded-2xl border-2 transition-all ${
                      selectedBoost?.id === plan.id
                        ? "bg-gradient-to-r from-purple-500/20 to-pink-500/20 border-purple-500"
                        : isDarkMode ? "bg-white/5 border-white/10 hover:border-white/20" : "bg-gray-50 border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-left">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`font-bold text-lg ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{plan.label}</span>
                          {plan.popular && (
                            <span className="bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full">
                              Populaire
                            </span>
                          )}
                        </div>
                        <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>{plan.description}</p>
                      </div>
                      <div className="text-right">
                        <div className={`font-bold text-xl ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{plan.amount}</div>
                        <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>FCFA</div>
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>

              <div className={`rounded-xl p-4 mb-6 ${isDarkMode ? 'bg-blue-500/10 border border-blue-500/30' : 'bg-blue-50 border border-blue-200'}`}>
                <p className={`text-sm ${isDarkMode ? 'text-blue-300' : 'text-blue-700'}`}>
                  💡 <strong>Avantages du boost :</strong> Votre post apparaîtra en priorité dans le feed, augmentant vos vues et votre engagement !
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowBoostModal(false)}
                  disabled={boostLoading}
                  className={`flex-1 py-3 rounded-xl font-bold transition-all disabled:opacity-50 ${isDarkMode ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`}
                >
                  Annuler
                </button>
                <button
                  onClick={() => selectedBoost && handleBoost(selectedBoost)}
                  disabled={!selectedBoost || boostLoading}
                  className="flex-1 py-3 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 rounded-xl text-white font-bold hover:shadow-lg hover:shadow-purple-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {boostLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Traitement...
                    </span>
                  ) : (
                    "🚀 Confirmer le boost"
                  )}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ✅ SECTION COMMENTAIRES (CORRIGÉE) */}
      <AnimatePresence>
        {showComments && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }} 
            animate={{ height: "auto", opacity: 1 }} 
            exit={{ height: 0, opacity: 0 }}
            className={`border-t ${isDarkMode ? 'border-white/5' : 'border-gray-100/30'}`}
            style={{ borderTopWidth: '0.5px' }}
          >
            <ErrorBoundary>
              <PostComments 
                postId={post._id}
                comments={comments}
                setComments={(newComments) => {
                  setComments(newComments);
                  setCommentsCount(newComments.length);
                  save(`postComments_${post._id}`, newComments)();
                }}
                currentUser={currentUser}
                getToken={getToken}
                showToast={showToast}
                saveCommentsDebounced={(newComments) => {
                  save(`postComments_${post._id}`, newComments)();
                }}
                navigate={navigate}
              />
            </ErrorBoundary>
          </motion.div>
        )}

        {showShare && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }} 
            animate={{ height: "auto", opacity: 1 }} 
            exit={{ height: 0, opacity: 0 }}
            className={`border-t ${isDarkMode ? 'border-white/5' : 'border-gray-100/30'}`}
            style={{ borderTopWidth: '0.5px' }}
          >
            <ErrorBoundary>
              <PostShareSection 
                postId={post._id} 
                postContent={post.content} 
                onShareSuccess={() => setSharesCount(p => p + 1)} 
                showToast={showToast} 
              />
            </ErrorBoundary>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

PostCard.displayName = "PostCard";
export default PostCard;