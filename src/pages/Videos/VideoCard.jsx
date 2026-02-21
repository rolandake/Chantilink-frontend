// 📁 src/pages/Videos/VideoCard.jsx
// VERSION CORRIGÉE - Fix lecture vidéo + re-renders + SON AUTO-POST
import React, { useEffect, useRef, useState, useMemo, memo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useVideos } from "../../context/VideoContext";
import { loadStripe } from "@stripe/stripe-js";
import {
  FaHeart, FaRegHeart, FaComment, FaShare,
  FaVolumeUp, FaVolumeMute, FaTrash, FaRocket, FaMusic, FaPlay, FaCheckCircle
} from "react-icons/fa";
import { HiDotsVertical } from "react-icons/hi";
import { IoSend } from "react-icons/io5";

const STRIPE_KEY = import.meta.env.VITE_STRIPE_PUBLIC_KEY;
const stripePromise = STRIPE_KEY ? loadStripe(STRIPE_KEY) : null;
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const generateDefaultAvatar = (username = "U") => {
  const char = (username || "U").charAt(0).toUpperCase();
  const colors = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6'];
  const color = colors[char.charCodeAt(0) % colors.length];
  return `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="${encodeURIComponent(color)}"/><text x="50%" y="50%" font-size="50" fill="white" text-anchor="middle" dy=".3em" font-family="Arial">${char}</text></svg>`;
};

const VideoCard = ({ video, isActive, isAutoPost }) => {
  if (!video) return null;

  const navigate = useNavigate();
  const videoRef = useRef(null);

  const { user: currentUser, getToken } = useAuth();
  const { likeVideo, commentVideo, deleteVideo, incrementViews } = useVideos();

  // ✅ Ref stable pour incrementViews — évite de le mettre en dépendance d'useEffect
  const incrementViewsRef = useRef(incrementViews);
  useEffect(() => { incrementViewsRef.current = incrementViews; });

  const [muted, setMuted] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [showHeart, setShowHeart] = useState(false);
  const [progress, setProgress] = useState(0);

  const [showComments, setShowComments] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [showBoostModal, setShowBoostModal] = useState(false);

  const [localLikes, setLocalLikes] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [localComments, setLocalComments] = useState([]);
  const [newComment, setNewComment] = useState("");

  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  const [boostLoading, setBoostLoading] = useState(false);
  const [selectedBoost, setSelectedBoost] = useState(null);

  // ✅ owner mémoïsé sur l'ID de la vidéo uniquement, pas l'objet entier
  const videoId = video._id;
  const owner = useMemo(() => {
    const u = video.user || video.uploadedBy || {};
    return {
      _id: u._id || u.id,
      username: u.username || u.fullName || "Utilisateur",
      photo: u.profilePhoto || u.profilePicture || u.avatar || null,
      isVerified: !!u.isVerified
    };
  }, [videoId]); // eslint-disable-line react-hooks/exhaustive-deps

  const isOwner = currentUser && owner._id && (owner._id === currentUser._id);

  // Initialiser les states depuis les props vidéo
  useEffect(() => {
    const likesList = Array.isArray(video.likes) ? video.likes : [];
    setLocalLikes(likesList.length || (typeof video.likes === 'number' ? video.likes : 0));

    if (currentUser) {
      setIsLiked(likesList.some(id => id === currentUser._id || (typeof id === 'object' && id._id === currentUser._id)));
      if (currentUser.following && Array.isArray(currentUser.following) && owner._id) {
        setIsFollowing(currentUser.following.includes(owner._id));
      }
    }
    setLocalComments(video.comments || []);
  }, [videoId, currentUser, owner._id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ✅ EFFET LECTURE — dépendance UNIQUEMENT sur isActive
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;

    if (isActive) {
      const playPromise = vid.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => setIsPaused(false))
          .catch((error) => {
            if (error.name === "NotAllowedError" || error.name === "NotSupportedError") {
              setMuted(true);
              vid.muted = true;
              vid.play().catch(() => {});
            }
          });
      }
    } else {
      vid.pause();
      // ✅ PAS de currentTime = 0 ici — c'était la cause du "restart" à chaque scroll
    }
  }, [isActive]); // ← Seulement isActive

  // Réinitialiser muted quand on change de slide
  useEffect(() => {
    if (!isActive) {
      setMuted(true);
      const vid = videoRef.current;
      if (vid) {
        vid.muted = true;
        vid.volume = 0;
      }
    }
  }, [isActive]);

  // ✅ EFFET VUES — séparé de la lecture pour ne pas interférer
  useEffect(() => {
    if (!isActive || isAutoPost || !videoId) return;
    const timer = setTimeout(() => {
      incrementViewsRef.current?.(videoId);
    }, 2000);
    return () => clearTimeout(timer);
  }, [isActive, videoId, isAutoPost]);

  const handleTimeUpdate = useCallback(() => {
    const vid = videoRef.current;
    if (vid && vid.duration) setProgress((vid.currentTime / vid.duration) * 100);
  }, []);

  const togglePlay = useCallback(() => {
    const vid = videoRef.current;
    if (!vid) return;
    if (vid.paused) {
      vid.play().catch(() => {});
      setIsPaused(false);
    } else {
      vid.pause();
      setIsPaused(true);
    }
  }, []);

  const handleDoubleTap = useCallback((e) => {
    e.stopPropagation();
    setShowHeart(true);
    setTimeout(() => setShowHeart(false), 800);
    if (!isLiked) handleLike(e);
  }, [isLiked]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLike = useCallback(async (e) => {
    e?.stopPropagation();
    if (!currentUser) return alert("Connectez-vous pour aimer !");

    if (isAutoPost) {
      setIsLiked(prev => !prev);
      setLocalLikes(prev => isLiked ? prev - 1 : prev + 1);
      return;
    }

    const wasLiked = isLiked;
    setIsLiked(!wasLiked);
    setLocalLikes(prev => wasLiked ? prev - 1 : prev + 1);

    try {
      await likeVideo(video._id);
    } catch {
      setIsLiked(wasLiked);
      setLocalLikes(prev => wasLiked ? prev + 1 : prev - 1);
    }
  }, [currentUser, isLiked, video._id, likeVideo, isAutoPost]);

  const handleFollow = async (e) => {
    e.stopPropagation();
    e.preventDefault();

    if (!currentUser) return alert("Connectez-vous pour suivre !");
    if (!owner._id) return;
    if (isOwner) return;
    if (followLoading) return;

    if (isAutoPost) {
      setIsFollowing(prev => !prev);
      return;
    }

    setFollowLoading(true);
    const wasFollowing = isFollowing;
    setIsFollowing(!wasFollowing);

    try {
      const token = await getToken();
      if (!token) throw new Error("Token manquant");

      const endpoint = wasFollowing
        ? `${API_URL}/users/unfollow/${owner._id}`
        : `${API_URL}/users/follow/${owner._id}`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error("Le serveur a retourné une erreur");
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Erreur ${res.status}`);
    } catch (err) {
      console.error("❌ Erreur Follow:", err);
      setIsFollowing(wasFollowing);
      alert(err.message || "Impossible de suivre cet utilisateur");
    } finally {
      setFollowLoading(false);
    }
  };

  const handleCommentSubmit = async () => {
    if (!newComment.trim()) return;
    if (!currentUser) return alert("Connectez-vous !");

    const tempComment = {
      _id: Date.now(),
      user: currentUser,
      text: newComment,
      createdAt: new Date().toISOString()
    };

    setLocalComments(prev => [...prev, tempComment]);
    setNewComment("");

    if (isAutoPost) return;

    try {
      await commentVideo(video._id, newComment);
    } catch {
      alert("Erreur envoi");
      setLocalComments(prev => prev.filter(c => c._id !== tempComment._id));
    }
  };

  const handleShare = async (e) => {
    e.stopPropagation();
    if (navigator.share) {
      try { await navigator.share({ title: "Regarde cette vidéo !", url: window.location.href }); } catch {}
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert("Lien copié !");
    }
  };

  // ─────────────────────────────────────────────────────────────────
  // ✅ handleToggleMute — fix son mobile (même logique qu'AggregatedCard)
  // Les navigateurs mobiles (iOS Safari, Android Chrome) bloquent
  // vid.muted = false via JS sauf si l'appel est dans un vrai click handler.
  // Séquence obligatoire pour débloquer le son :
  //   1. vid.pause()       — synchrone, dans le handler
  //   2. vid.muted = false — autorisé car on est dans un click utilisateur
  //   3. vid.play()        — relance avec son
  // ─────────────────────────────────────────────────────────────────
  const handleToggleMute = useCallback((e) => {
    e.stopPropagation();
    const vid = videoRef.current;
    const newMuted = !muted;
    setMuted(newMuted);

    if (!vid) return;

    if (newMuted) {
      // Remute simple
      vid.muted = true;
      vid.volume = 0;
    } else {
      // Séquence débloquage son mobile
      vid.pause();
      vid.muted = false;
      vid.volume = 1;
      vid.play().catch(() => {
        // Navigateur a refusé malgré le click — retour muted
        vid.muted = true;
        vid.volume = 0;
        setMuted(true);
      });
    }
  }, [muted]);

  const handleBoost = async () => {
    if (!selectedBoost || !stripePromise) return;
    if (isAutoPost) {
      alert("Cette fonctionnalité n'est disponible que pour vos vidéos");
      return;
    }

    setBoostLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/boost/create-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ contentId: video._id, contentType: 'video', amount: selectedBoost.amount, planId: selectedBoost.id })
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else { alert("Simulation: Boost activé !"); setShowBoostModal(false); }
    } catch { alert("Erreur paiement"); }
    finally { setBoostLoading(false); }
  };

  return (
    <div className="relative w-full h-full bg-black overflow-hidden select-none">

      {/* Badge Auto-Post */}
      {isAutoPost && (
        <div className="absolute top-16 left-4 z-50 bg-blue-500/90 text-white text-xs font-bold px-3 py-1 rounded-full backdrop-blur-sm">
          📡 Trending
        </div>
      )}

      <video
        ref={videoRef}
        src={video.videoUrl || video.url}
        className="w-full h-full object-cover"
        style={{ filter: video.filter && video.filter !== 'none' ? video.filter : undefined }}
        loop
        muted={muted}
        playsInline
        onClick={togglePlay}
        onDoubleClick={handleDoubleTap}
        onTimeUpdate={handleTimeUpdate}
        preload="metadata"
      />

      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/80 pointer-events-none" />

      {/* Barre de progression */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gray-800/30 z-20">
        <div
          className="h-full bg-gradient-to-r from-orange-500 to-pink-500 transition-all duration-100"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Icône pause / coeur */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
        {isPaused && <FaPlay className="text-white/50 text-6xl animate-pulse" />}
        <AnimatePresence>
          {showHeart && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1.5, opacity: 1 }}
              exit={{ scale: 2, opacity: 0 }}
              className="absolute"
            >
              <FaHeart className="text-red-500 text-8xl drop-shadow-2xl" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* INFOS UTILISATEUR */}
      <div className="absolute bottom-4 left-4 right-16 z-30 pb-safe">
        <div
          onClick={(e) => {
            e.stopPropagation();
            if (owner._id && !isAutoPost) navigate(`/profile/${owner._id}`);
          }}
          className="flex items-center gap-3 mb-3 cursor-pointer group"
        >
          <img
            src={owner.photo
              ? (owner.photo.startsWith('http') ? owner.photo : `${API_URL}${owner.photo}`)
              : generateDefaultAvatar(owner.username)
            }
            alt={owner.username}
            className="w-11 h-11 rounded-full border-2 border-white shadow-md object-cover group-hover:scale-105 transition-transform bg-gray-700"
            onError={(e) => { e.target.onerror = null; e.target.src = generateDefaultAvatar(owner.username); }}
          />
          <div className="flex flex-col">
            <h3 className="font-bold text-white text-base flex items-center gap-1 shadow-black drop-shadow-md">
              @{owner.username}
              {owner.isVerified && <FaCheckCircle className="text-orange-500 text-xs" />}
            </h3>
          </div>

          {!isOwner && currentUser && (
            <button
              onClick={handleFollow}
              disabled={followLoading}
              className={`text-xs font-bold px-3 py-1 rounded-full ml-2 shadow-lg transition ${
                isFollowing
                  ? "bg-white text-black hover:bg-gray-200"
                  : "bg-pink-600 text-white hover:bg-pink-700"
              } ${followLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {followLoading ? '...' : (isFollowing ? "Suivi" : "Suivre")}
            </button>
          )}
        </div>

        <div className="text-white/90 text-sm mb-2 max-w-[90%] drop-shadow-md pointer-events-auto">
          <p className="line-clamp-2">{video.description || video.title}</p>
        </div>

        <div className="flex items-center gap-2 text-white/80 text-xs font-medium bg-white/10 w-fit px-3 py-1 rounded-full backdrop-blur-sm pointer-events-auto">
          <FaMusic className="animate-spin-slow" />
          <span className="truncate max-w-[150px]">{video.musicName || "Son original"}</span>
        </div>
      </div>

      {/* ACTIONS */}
      <div className="absolute right-2 bottom-20 flex flex-col items-center gap-6 z-40 pb-safe pointer-events-auto">

        {isOwner && !isAutoPost && (
          <motion.div whileTap={{ scale: 0.9 }} className="flex flex-col items-center">
            <button
              onClick={(e) => { e.stopPropagation(); setShowBoostModal(true); }}
              className="w-10 h-10 rounded-full bg-gradient-to-tr from-orange-400 to-pink-600 flex items-center justify-center text-white shadow-lg shadow-orange-500/40"
            >
              <FaRocket />
            </button>
            <span className="text-[10px] font-bold text-white mt-1 drop-shadow-md">Boost</span>
          </motion.div>
        )}

        {/* Like */}
        <div className="flex flex-col items-center gap-1">
          <motion.button
            whileTap={{ scale: 0.8 }}
            onClick={handleLike}
            className={`w-10 h-10 rounded-full flex items-center justify-center text-3xl drop-shadow-xl transition-colors ${isLiked ? 'text-red-500' : 'text-white'}`}
          >
            {isLiked ? <FaHeart /> : <FaRegHeart />}
          </motion.button>
          <span className="text-xs font-bold text-white drop-shadow-md">{localLikes}</span>
        </div>

        {/* Commentaire */}
        <div className="flex flex-col items-center gap-1">
          <motion.button
            whileTap={{ scale: 0.8 }}
            onClick={(e) => { e.stopPropagation(); setShowComments(true); }}
            className="w-10 h-10 rounded-full flex items-center justify-center text-white text-3xl drop-shadow-xl"
          >
            <FaComment />
          </motion.button>
          <span className="text-xs font-bold text-white drop-shadow-md">{localComments.length}</span>
        </div>

        {/* Partage */}
        <div className="flex flex-col items-center gap-1">
          <motion.button
            whileTap={{ scale: 0.8 }}
            onClick={handleShare}
            className="w-10 h-10 rounded-full flex items-center justify-center text-white text-3xl drop-shadow-xl"
          >
            <FaShare />
          </motion.button>
          <span className="text-xs font-bold text-white drop-shadow-md">Partager</span>
        </div>

        {/* ✅ Bouton mute — séquence pause→unmute→play pour débloquer le son mobile */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={handleToggleMute}
          className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center text-white mt-2"
        >
          {muted ? <FaVolumeMute /> : <FaVolumeUp />}
        </motion.button>

        {/* Options */}
        <button
          onClick={(e) => { e.stopPropagation(); setShowOptions(true); }}
          className="text-white text-xl drop-shadow-lg p-2"
        >
          <HiDotsVertical />
        </button>
      </div>

      {/* MODALE COMMENTAIRES */}
      <AnimatePresence>
        {showComments && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowComments(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="relative w-full max-w-md bg-gray-900 border-t border-gray-800 rounded-t-3xl h-[70vh] flex flex-col z-50 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b border-gray-800 flex justify-between items-center">
                <span className="font-bold text-white">{localComments.length} Commentaires</span>
                <button onClick={() => setShowComments(false)} className="text-gray-400 p-2">✕</button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {localComments.map((comment, i) => (
                  <div key={comment._id || i} className="flex gap-3 items-start">
                    <img
                      src={comment.user?.profilePhoto || generateDefaultAvatar(comment.user?.fullName || comment.user?.username)}
                      className="w-8 h-8 rounded-full bg-gray-700 object-cover"
                      alt="user"
                      onError={(e) => { e.target.onerror = null; e.target.src = generateDefaultAvatar(comment.user?.username); }}
                    />
                    <div>
                      <p className="text-xs font-bold text-gray-400">
                        {comment.user?.fullName || comment.user?.username || "Utilisateur"}
                      </p>
                      <p className="text-sm text-gray-200">{comment.text}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-4 bg-gray-800 flex gap-2 items-center">
                <input
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCommentSubmit()}
                  placeholder="Votre commentaire..."
                  className="flex-1 bg-gray-700 text-white rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-pink-500"
                />
                <button
                  onClick={handleCommentSubmit}
                  disabled={!newComment.trim()}
                  className="p-2 bg-pink-600 rounded-full text-white disabled:opacity-50"
                >
                  <IoSend />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODALE OPTIONS */}
      <AnimatePresence>
        {showOptions && (
          <div
            className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowOptions(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="absolute bottom-0 inset-x-0 bg-gray-900 rounded-t-3xl p-6 space-y-3"
              onClick={(e) => e.stopPropagation()}
            >
              {isOwner && !isAutoPost && (
                <button
                  onClick={async () => {
                    if (confirm("Supprimer cette vidéo ?")) {
                      await deleteVideo(video._id);
                      setShowOptions(false);
                    }
                  }}
                  className="w-full py-3 bg-red-500/10 text-red-500 rounded-xl font-bold flex items-center justify-center gap-2"
                >
                  <FaTrash /> Supprimer la vidéo
                </button>
              )}
              <button
                onClick={() => { navigator.clipboard.writeText(window.location.href); setShowOptions(false); }}
                className="w-full py-3 bg-gray-800 text-white rounded-xl font-bold"
              >
                Copier le lien
              </button>
              <button
                onClick={() => setShowOptions(false)}
                className="w-full py-3 bg-gray-800 text-gray-400 rounded-xl"
              >
                Annuler
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODALE BOOST */}
      <AnimatePresence>
        {showBoostModal && !isAutoPost && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => setShowBoostModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gray-900 border border-gray-700 p-6 rounded-2xl w-full max-w-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <FaRocket className="text-orange-500" /> Booster cette vidéo
              </h2>
              <div className="space-y-3">
                {[
                  { id: 1, label: '24h Flash', price: 1000 },
                  { id: 2, label: '3 Jours Top', price: 2500 }
                ].map(plan => (
                  <div
                    key={plan.id}
                    onClick={() => setSelectedBoost(plan)}
                    className={`p-3 rounded-lg border cursor-pointer flex justify-between transition-colors ${
                      selectedBoost?.id === plan.id
                        ? 'border-orange-500 bg-orange-500/20'
                        : 'border-gray-700 hover:border-gray-500'
                    }`}
                  >
                    <span className="text-white">{plan.label}</span>
                    <span className="text-orange-400 font-bold">{plan.price} FCFA</span>
                  </div>
                ))}
              </div>
              <button
                onClick={handleBoost}
                disabled={!selectedBoost || boostLoading}
                className="w-full mt-6 bg-gradient-to-r from-orange-500 to-pink-600 text-white py-3 rounded-xl font-bold disabled:opacity-50 transition-opacity"
              >
                {boostLoading ? 'Chargement...' : 'Payer'}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

VideoCard.displayName = "VideoCard";

// ✅ Comparateur custom — ne re-render que si la vidéo change ou isActive change
export default memo(VideoCard, (prev, next) => {
  return (
    prev.isActive === next.isActive &&
    prev.video._id === next.video._id &&
    prev.isAutoPost === next.isAutoPost
  );
});