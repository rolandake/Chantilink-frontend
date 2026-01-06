// src/pages/Home/PostCard.jsx - FIX BOUTON SUIVRE
import React, { forwardRef, useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  TrashIcon, HeartIcon, ChatBubbleLeftIcon, ShareIcon,
} from "@heroicons/react/24/outline";
import { HeartIcon as HeartSolid, CheckBadgeIcon, RocketLaunchIcon, FireIcon } from "@heroicons/react/24/solid";
import { useAuth } from "../../context/AuthContext";
import { usePosts } from "../../context/PostsContext";
import { useDarkMode } from "../../context/DarkModeContext";
import PostMedia from "./PostMedia";
import PostComments from "./PostComments";
import PostShareSection from "./PostShareSection";
import ErrorBoundary from "../../components/ErrorBoundary";

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

// === POST CARD PRINCIPALE ===
const PostCard = forwardRef(({ post, onDeleted, showToast }, ref) => {
  if (!post || !post._id) return null;

  const { user: currentUser, getToken, updateUserProfile } = useAuth();
  const { isDarkMode } = useDarkMode();
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

  // ✅ FIX: Synchronisation ROBUSTE du state "Following"
  useEffect(() => {
    if (!currentUser || !postUser._id || postUser._id === 'unknown') {
      setIsFollowing(false);
      return;
    }

    // Ne pas permettre de se suivre soi-même
    if (currentUser._id === postUser._id) {
      setIsFollowing(false);
      return;
    }

    // Vérifier dans le tableau "following" de currentUser
    const followingList = Array.isArray(currentUser.following) ? currentUser.following : [];
    
    const isCurrentlyFollowing = followingList.some(followId => {
      // Gérer les cas où followId peut être un ObjectId ou un objet User complet
      const idToCompare = typeof followId === 'object' && followId !== null
        ? (followId._id || followId.id || followId)
        : followId;
      
      return idToCompare?.toString() === postUser._id.toString();
    });

    console.log(`🔍 [PostCard] État follow pour ${postUser.fullName}:`, {
      isFollowing: isCurrentlyFollowing,
      postUserId: postUser._id,
      currentUserFollowing: followingList.length,
      followingIds: followingList.slice(0, 3)
    });

    setIsFollowing(isCurrentlyFollowing);
  }, [currentUser, postUser._id]);

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
      const token = await getToken();
      const response = await fetch(`${API_URL}/posts/${post._id}/like`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Erreur lors du like');
    } catch (err) {
      console.error('❌ [Like] Erreur:', err);
      setLiked(prevLiked);
      setLikesCount(prevCount);
      showToast?.("Erreur lors du like", "error");
    } finally {
      setLoadingLike(false);
      setTimeout(() => setAnimateHeart(false), 800);
    }
  }, [currentUser, liked, likesCount, loadingLike, post._id, getToken, showToast]);

  // ✅ FIX COMPLET: handleFollow avec mise à jour du contexte
  const handleFollow = useCallback(async (e) => {
    e?.stopPropagation();

    // Validations
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

    console.log(`🔄 [Follow] Action: ${action} pour ${postUser.fullName} (${postUser._id})`);

    // UI Optimiste
    setIsFollowing(!wasFollowing);
    setLoadingFollow(true);

    try {
      const token = await getToken();
      
      const response = await fetch(`${API_URL}/follow/${action}/${postUser._id}`, {
        method: "POST",
        headers: { 
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Erreur ${response.status}`);
      }

      const data = await response.json();

      // ✅ MISE À JOUR DU CONTEXTE AUTH
      if (updateUserProfile && currentUser._id) {
        const updatedFollowing = wasFollowing
          ? currentUser.following.filter(id => {
              const idStr = typeof id === 'object' ? (id._id || id) : id;
              return idStr?.toString() !== postUser._id.toString();
            })
          : [...(currentUser.following || []), postUser._id];

        console.log(`✅ [Follow] Mise à jour locale:`, {
          action,
          newFollowingCount: updatedFollowing.length,
          postUserId: postUser._id
        });

        updateUserProfile(currentUser._id, {
          following: updatedFollowing
        });
      }

      showToast?.(
        wasFollowing 
          ? `Vous ne suivez plus ${postUser.fullName}` 
          : `Vous suivez ${postUser.fullName}`, 
        "success"
      );

      console.log(`✅ [Follow] Action ${action} réussie`);
    } catch (err) {
      console.error(`❌ [Follow] Erreur ${action}:`, err);
      
      // Retour arrière en cas d'erreur
      setIsFollowing(wasFollowing);
      
      showToast?.(
        err.message || "Impossible de modifier l'abonnement", 
        "error"
      );
    } finally {
      setLoadingFollow(false);
    }
  }, [currentUser, isFollowing, loadingFollow, postUser, getToken, showToast, updateUserProfile]);

  const handleBoostPayment = useCallback(async () => {
    if (!selectedBoost) return;
    setBoostLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL.replace('/api', '')}/boost/create-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          postId: post._id, planId: selectedBoost.id, amount: selectedBoost.amount, duration: selectedBoost.duration
        })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      if (data.url) { window.location.href = data.url; } 
      else {
        setIsBoosted(true);
        showToast?.("🚀 Post boosté avec succès !", "success");
        setShowBoostModal(false);
      }
    } catch (err) {
      showToast?.(err.message || "Erreur de paiement", "error");
    } finally {
      setBoostLoading(false);
    }
  }, [selectedBoost, getToken, post._id, showToast]);

  const isOwner = currentUser && (post.userId === currentUser._id || postUser._id === currentUser._id);
  const canFollow = currentUser && !isOwner && postUser._id !== 'unknown';

  const mediaUrls = useMemo(() => 
    (Array.isArray(post.media) ? post.media : [post.media]).filter(Boolean).map(m => 
        getCloudinaryUrl(typeof m === 'string' ? m : m.url, { width: 800, format: 'auto' })
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
      className={`relative w-full border-b ${isDarkMode ? 'bg-black border-white/10' : 'bg-white border-gray-200'}`}
    >
      {isBoosted && (
        <div className="absolute top-0 right-0 z-10 p-2">
            <div className="flex items-center gap-1 bg-gradient-to-r from-orange-500 to-pink-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-bl-xl shadow-lg select-none">
                <RocketLaunchIcon className="w-3 h-3" /> SPONSORISÉ
            </div>
        </div>
      )}

      {/* HEADER */}
      <div className="flex justify-between items-center px-4 pt-3 pb-2">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(`/profile/${postUser._id}`)} className="relative shrink-0">
            <SimpleAvatar username={postUser.fullName} photo={postUser.profilePhoto} size={42} />
            {postUser.isPremium && (
                 <div className="absolute -bottom-1 -right-1 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full p-[2px] border border-black z-10">
                     <CheckBadgeIcon className="w-3 h-3 text-white" />
                 </div>
            )}
          </button>
          
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span onClick={() => navigate(`/profile/${postUser._id}`)}
                className={`font-bold text-sm cursor-pointer hover:underline truncate max-w-[150px] ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {postUser.fullName}
              </span>
              {postUser.isVerified && <CheckBadgeIcon className="w-4 h-4 text-orange-500" />}
            </div>
            <span className="text-xs text-gray-500">{formattedDate} {post.location && ` • ${post.location}`}</span>
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
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all border active:scale-95 min-w-[80px] ${
                    isFollowing 
                    ? isDarkMode ? 'border-gray-700 text-gray-300 bg-transparent hover:bg-red-500/10 hover:text-red-400 hover:border-red-400' : 'border-gray-300 text-gray-600 bg-transparent hover:bg-red-50 hover:text-red-500 hover:border-red-300'
                    : isDarkMode ? 'bg-white text-black border-white hover:bg-gray-200' : 'bg-black text-white border-black hover:bg-gray-800'
                }`}
            >
                {loadingFollow ? "..." : isFollowing ? "Suivi" : "Suivre"}
            </button>
          )}
        </div>
      </div>

      {/* CONTENU TEXTE */}
      <div className="px-4 py-1">
        <p className={`whitespace-pre-line text-[15px] leading-relaxed break-words ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
            {displayContent}
        </p>
        {shouldTruncate && (
          <button onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className="text-gray-500 text-sm mt-1 hover:text-orange-500 font-medium transition-colors">
            {expanded ? "Voir moins" : "Voir plus"}
          </button>
        )}
      </div>

      {/* MEDIA */}
      {mediaUrls.length > 0 && (
          <div className="w-full mt-2">
             <PostMedia mediaUrls={mediaUrls} />
          </div>
      )}

      {/* ACTIONS BAR */}
      <div className="flex items-center px-4 py-3 gap-6">
        <button onClick={handleLike} disabled={loadingLike} className="flex items-center gap-2 group active:scale-95">
          {liked ? <HeartSolid className={`w-6 h-6 text-red-500 ${animateHeart ? 'animate-bounce' : ''}`} /> 
                 : <HeartIcon className={`w-6 h-6 ${isDarkMode ? 'text-gray-400 group-hover:text-red-400' : 'text-gray-600 group-hover:text-red-500'}`} />}
          <span className={`text-sm font-medium ${liked ? 'text-red-500' : 'text-gray-500'}`}>{likesCount || ""}</span>
        </button>

        <button onClick={(e) => { e.stopPropagation(); setShowComments(!showComments); }} className="flex items-center gap-2 group active:scale-95">
          <ChatBubbleLeftIcon className={`w-6 h-6 ${isDarkMode ? 'text-gray-400 group-hover:text-blue-400' : 'text-gray-600 group-hover:text-blue-500'}`} />
          <span className={`text-sm font-medium ${showComments ? 'text-blue-500' : 'text-gray-500'}`}>{commentsCount || ""}</span>
        </button>

        <button onClick={(e) => { e.stopPropagation(); setShowShare(!showShare); }} className="flex items-center gap-2 group active:scale-95 ml-auto">
          <ShareIcon className={`w-6 h-6 ${isDarkMode ? 'text-gray-400 group-hover:text-green-400' : 'text-gray-600 group-hover:text-green-500'}`} />
        </button>
      </div>

      {/* MODAL BOOST */}
      <AnimatePresence>
          {showBoostModal && (
              <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-4"
                onClick={() => setShowBoostModal(false)}>
                  <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                      className={`w-full max-w-md rounded-3xl p-6 shadow-2xl relative ${isDarkMode ? 'bg-gray-900 border border-gray-800' : 'bg-white'}`}
                      onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => setShowBoostModal(false)} className="absolute top-4 right-4 text-gray-500 hover:text-red-500 p-2">✕</button>
                      <div className="text-center mb-6">
                          <div className="w-16 h-16 bg-gradient-to-br from-orange-400 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-3">
                              <RocketLaunchIcon className="w-8 h-8 text-white" />
                          </div>
                          <h2 className={`text-2xl font-black ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Booster ce post</h2>
                      </div>
                      <div className="space-y-3 mb-6">
                          {boostPlans.map(plan => (
                              <div key={plan.id} onClick={() => setSelectedBoost(plan)}
                                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                                      selectedBoost?.id === plan.id ? 'border-orange-500 bg-orange-500/10' 
                                      : isDarkMode ? 'border-gray-800 bg-gray-800' : 'border-gray-100 bg-gray-50'
                                  }`}>
                                  <div className="flex items-center gap-3">
                                      {plan.icon}
                                      <div>
                                          <p className={`font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{plan.label}</p>
                                          <p className="text-xs text-gray-500">{plan.description}</p>
                                      </div>
                                  </div>
                                  <p className="font-bold text-orange-500">{plan.amount} FCFA</p>
                              </div>
                          ))}
                      </div>
                      <button onClick={handleBoostPayment} disabled={!selectedBoost || boostLoading}
                          className="w-full py-4 rounded-xl bg-gradient-to-r from-orange-500 to-pink-600 text-white font-bold text-lg disabled:opacity-50">
                          {boostLoading ? "Paiement..." : `Payer ${selectedBoost ? selectedBoost.amount + ' FCFA' : ''}`}
                      </button>
                  </motion.div>
              </div>
          )}
      </AnimatePresence>

      {/* COMMENTAIRES & PARTAGE */}
      <AnimatePresence>
        {showComments && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
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
           <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
              <PostShareSection postId={post._id} showToast={showToast} />
           </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

PostCard.displayName = "PostCard";
export default React.memo(PostCard);