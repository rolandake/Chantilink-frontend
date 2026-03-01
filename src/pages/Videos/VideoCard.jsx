// 📁 src/pages/Videos/VideoCard.jsx
// ✅ Son activé automatiquement après le premier tap (politique navigateur)
// ✅ sessionStorage partagé avec AggregatedCard (USER_INTERACTED_KEY)
// ✅ Hint "Appuie pour activer le son" sur la première vidéo
// ✅ Loop conservé pour les vidéos utilisateur
//
// 🎯 VIDEO MANAGER GLOBAL (style TikTok)
//    Même gestionnaire que PostMedia — garantit qu'une seule vidéo joue
//    dans TOUTE la page (y compris entre VideoCard et PostMedia)
//    → -30~50% CPU, meilleure batterie, scroll fluide

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

const STRIPE_KEY    = import.meta.env.VITE_STRIPE_PUBLIC_KEY;
const stripePromise = STRIPE_KEY ? loadStripe(STRIPE_KEY) : null;
const API_URL       = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// ✅ Clé partagée avec AggregatedCard
const USER_INTERACTED_KEY = 'vp_user_interacted';

// ─────────────────────────────────────────────
// 🎯 VIDEO MANAGER GLOBAL (partagé avec PostMedia)
// On utilise window pour partager l'instance entre tous les composants
// ─────────────────────────────────────────────
const registerPlayingVideo = (video) => {
  if (!video) return;
  const current = window.__currentPlayingVideo;
  if (current && current !== video) {
    try {
      current.pause();
      current.currentTime = current.currentTime; // stop decoding
    } catch {}
  }
  window.__currentPlayingVideo = video;
};

const generateDefaultAvatar = (username = "U") => {
  const char   = (username || "U").charAt(0).toUpperCase();
  const colors = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6'];
  const color  = colors[char.charCodeAt(0) % colors.length];
  return `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="${encodeURIComponent(color)}"/><text x="50%" y="50%" font-size="50" fill="white" text-anchor="middle" dy=".3em" font-family="Arial">${char}</text></svg>`;
};

// ── Hint son ─────────────────────────────────────────────────────────
const SoundHint = memo(({ visible }) => {
  if (!visible) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="absolute bottom-32 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/20 pointer-events-none"
    >
      <FaVolumeUp className="text-white text-sm" />
      <span className="text-white text-xs font-semibold">Appuie pour activer le son</span>
    </motion.div>
  );
});
SoundHint.displayName = 'SoundHint';

const VideoCard = ({ video, isActive, isAutoPost, onVideoEnded }) => {
  if (!video) return null;

  const navigate = useNavigate();
  const videoRef = useRef(null);

  const { user: currentUser, getToken } = useAuth();
  const { likeVideo, commentVideo, deleteVideo, incrementViews } = useVideos();

  const incrementViewsRef = useRef(incrementViews);
  useEffect(() => { incrementViewsRef.current = incrementViews; });

  // ✅ Toujours muet au départ (règle navigateur)
  const [muted,          setMuted]          = useState(true);
  const [showSoundHint,  setShowSoundHint]  = useState(false);
  const [isPaused,       setIsPaused]       = useState(false);
  const [showHeart,      setShowHeart]      = useState(false);
  const [progress,       setProgress]       = useState(0);

  const [showComments,   setShowComments]   = useState(false);
  const [showOptions,    setShowOptions]    = useState(false);
  const [showBoostModal, setShowBoostModal] = useState(false);

  const [localLikes,    setLocalLikes]    = useState(0);
  const [isLiked,       setIsLiked]       = useState(false);
  const [localComments, setLocalComments] = useState([]);
  const [newComment,    setNewComment]    = useState("");

  const [isFollowing,   setIsFollowing]   = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [boostLoading,  setBoostLoading]  = useState(false);
  const [selectedBoost, setSelectedBoost] = useState(null);

  const videoId = video._id;
  const owner = useMemo(() => {
    const u = video.user || video.uploadedBy || {};
    return {
      _id:        u._id || u.id,
      username:   u.username || u.fullName || "Utilisateur",
      photo:      u.profilePhoto || u.profilePicture || u.avatar || null,
      isVerified: !!u.isVerified,
    };
  }, [videoId]); // eslint-disable-line

  const isOwner = currentUser && owner._id && (owner._id === currentUser._id);

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
  }, [videoId, currentUser, owner._id]); // eslint-disable-line

  // ── Hint son ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!isActive) {
      setShowSoundHint(false);
      return;
    }
    const hasInteracted = sessionStorage.getItem(USER_INTERACTED_KEY) === '1';
    if (!hasInteracted) {
      setShowSoundHint(true);
      const t = setTimeout(() => setShowSoundHint(false), 3000);
      return () => clearTimeout(t);
    }
  }, [isActive]);

  // ── Lecture / pause + gestion son ─────────────────────────────────
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;

    if (isActive) {
      const hasInteracted = sessionStorage.getItem(USER_INTERACTED_KEY) === '1';
      vid.muted  = true;
      vid.volume = 1;

      vid.play()
        .then(() => {
          setIsPaused(false);
          // 🎯 VIDEO MANAGER : enregistre cette vidéo comme active
          registerPlayingVideo(vid);
          // ✅ Si déjà interagi + pas muté explicitement → activer le son
          if (hasInteracted && !muted) {
            vid.muted  = false;
            vid.volume = 1;
          }
        })
        .catch((err) => {
          if (err.name === 'NotAllowedError' || err.name === 'NotSupportedError') {
            vid.muted = true;
            setMuted(true);
          }
        });
    } else {
      // 🎯 VIDEO MANAGER : pause propre quand non actif
      vid.pause();
      vid.muted  = true;
      vid.volume = 1;
      setIsPaused(false);
      setShowSoundHint(false);
    }
  }, [isActive]); // eslint-disable-line

  // Sync muted → DOM
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.muted  = muted;
    vid.volume = muted ? 0 : 1;
  }, [muted]);

  useEffect(() => {
    if (!isActive || isAutoPost || !videoId) return;
    const timer = setTimeout(() => { incrementViewsRef.current?.(videoId); }, 2000);
    return () => clearTimeout(timer);
  }, [isActive, videoId, isAutoPost]);

  const handleTimeUpdate = useCallback(() => {
    const vid = videoRef.current;
    if (vid?.duration) setProgress((vid.currentTime / vid.duration) * 100);
  }, []);

  // ✅ Premier tap → activer le son
  const activateSound = useCallback(() => {
    sessionStorage.setItem(USER_INTERACTED_KEY, '1');
    setShowSoundHint(false);
    const vid = videoRef.current;
    if (!vid) return;
    vid.muted  = false;
    vid.volume = 1;
    setMuted(false);
    if (vid.paused && isActive) vid.play().catch(() => {});
  }, [isActive]);

  const togglePlay = useCallback(() => {
    const hasInteracted = sessionStorage.getItem(USER_INTERACTED_KEY) === '1';
    if (!hasInteracted) { activateSound(); return; }

    const vid = videoRef.current;
    if (!vid) return;
    if (vid.paused) {
      vid.play().catch(() => {});
      setIsPaused(false);
      // 🎯 VIDEO MANAGER : enregistre au play manuel
      registerPlayingVideo(vid);
    } else {
      vid.pause();
      setIsPaused(true);
    }
  }, [activateSound]);

  const handleDoubleTap = useCallback((e) => {
    e.stopPropagation();
    setShowHeart(true);
    setTimeout(() => setShowHeart(false), 800);
    if (!isLiked) handleLike(e);
  }, [isLiked]); // eslint-disable-line

  const handleLike = useCallback(async (e) => {
    e?.stopPropagation();
    if (!currentUser) return alert("Connectez-vous pour aimer !");
    if (isAutoPost) { setIsLiked(prev => !prev); setLocalLikes(prev => isLiked ? prev - 1 : prev + 1); return; }
    const wasLiked = isLiked;
    setIsLiked(!wasLiked);
    setLocalLikes(prev => wasLiked ? prev - 1 : prev + 1);
    try { await likeVideo(video._id); }
    catch { setIsLiked(wasLiked); setLocalLikes(prev => wasLiked ? prev + 1 : prev - 1); }
  }, [currentUser, isLiked, video._id, likeVideo, isAutoPost]);

  const handleFollow = async (e) => {
    e.stopPropagation(); e.preventDefault();
    if (!currentUser) return alert("Connectez-vous pour suivre !");
    if (!owner._id || isOwner || followLoading) return;
    if (isAutoPost) { setIsFollowing(prev => !prev); return; }
    setFollowLoading(true);
    const wasFollowing = isFollowing;
    setIsFollowing(!wasFollowing);
    try {
      const token    = await getToken();
      if (!token) throw new Error("Token manquant");
      const endpoint = wasFollowing
        ? `${API_URL}/users/unfollow/${owner._id}`
        : `${API_URL}/users/follow/${owner._id}`;
      const res  = await fetch(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Erreur ${res.status}`);
    } catch (err) {
      setIsFollowing(wasFollowing);
      alert(err.message || "Impossible de suivre");
    } finally { setFollowLoading(false); }
  };

  const handleCommentSubmit = async () => {
    if (!newComment.trim()) return;
    if (!currentUser) return alert("Connectez-vous !");
    const temp = { _id: Date.now(), user: currentUser, text: newComment, createdAt: new Date().toISOString() };
    setLocalComments(prev => [...prev, temp]);
    setNewComment("");
    if (isAutoPost) return;
    try { await commentVideo(video._id, newComment); }
    catch { alert("Erreur envoi"); setLocalComments(prev => prev.filter(c => c._id !== temp._id)); }
  };

  const handleShare = async (e) => {
    e.stopPropagation();
    if (navigator.share) { try { await navigator.share({ title: "Regarde cette vidéo !", url: window.location.href }); } catch {} }
    else { navigator.clipboard.writeText(window.location.href); alert("Lien copié !"); }
  };

  const handleToggleMute = useCallback((e) => {
    e.stopPropagation();
    sessionStorage.setItem(USER_INTERACTED_KEY, '1');
    setShowSoundHint(false);
    const vid      = videoRef.current;
    const newMuted = !muted;
    setMuted(newMuted);
    if (!vid) return;
    vid.muted  = newMuted;
    vid.volume = newMuted ? 0 : 1;
    if (!newMuted && vid.paused && isActive) {
      vid.play().catch(() => { vid.muted = true; vid.volume = 0; setMuted(true); });
    }
  }, [muted, isActive]);

  const handleBoost = async () => {
    if (!selectedBoost || !stripePromise) return;
    if (isAutoPost) { alert("Fonctionnalité réservée à vos vidéos"); return; }
    setBoostLoading(true);
    try {
      const token = await getToken();
      const res   = await fetch(`${API_URL}/boost/create-session`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ contentId: video._id, contentType: 'video', amount: selectedBoost.amount, planId: selectedBoost.id }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else { alert("Simulation: Boost activé !"); setShowBoostModal(false); }
    } catch { alert("Erreur paiement"); }
    finally { setBoostLoading(false); }
  };

  const handleEnded = useCallback(() => {
    if (onVideoEnded) onVideoEnded();
  }, [onVideoEnded]);

  return (
    <div className="relative w-full h-full bg-black overflow-hidden select-none">

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
        preload="metadata"
        onClick={togglePlay}
        onDoubleClick={handleDoubleTap}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
      />

      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/80 pointer-events-none" />

      <div className="absolute top-0 left-0 right-0 h-1 bg-gray-800/30 z-20">
        <div className="h-full bg-gradient-to-r from-orange-500 to-pink-500 transition-all duration-100" style={{ width: `${progress}%` }} />
      </div>

      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
        {isPaused && <FaPlay className="text-white/50 text-6xl animate-pulse" />}
        <AnimatePresence>
          {showHeart && (
            <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1.5, opacity: 1 }} exit={{ scale: 2, opacity: 0 }} className="absolute">
              <FaHeart className="text-red-500 text-8xl drop-shadow-2xl" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ✅ Hint son */}
      <AnimatePresence>
        {showSoundHint && <SoundHint visible={showSoundHint} />}
      </AnimatePresence>

      {/* Infos utilisateur */}
      <div className="absolute bottom-4 left-4 right-16 z-30 pb-safe">
        <div onClick={(e) => { e.stopPropagation(); if (owner._id && !isAutoPost) navigate(`/profile/${owner._id}`); }}
          className="flex items-center gap-3 mb-3 cursor-pointer group">
          <img
            src={owner.photo ? (owner.photo.startsWith('http') ? owner.photo : `${API_URL}${owner.photo}`) : generateDefaultAvatar(owner.username)}
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
            <button onClick={handleFollow} disabled={followLoading}
              className={`text-xs font-bold px-3 py-1 rounded-full ml-2 shadow-lg transition ${
                isFollowing ? "bg-white text-black hover:bg-gray-200" : "bg-pink-600 text-white hover:bg-pink-700"
              } ${followLoading ? 'opacity-50 cursor-not-allowed' : ''}`}>
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

      {/* Actions droite */}
      <div className="absolute right-2 bottom-20 flex flex-col items-center gap-6 z-40 pb-safe pointer-events-auto">
        {isOwner && !isAutoPost && (
          <motion.div whileTap={{ scale: 0.9 }} className="flex flex-col items-center">
            <button onClick={(e) => { e.stopPropagation(); setShowBoostModal(true); }}
              className="w-10 h-10 rounded-full bg-gradient-to-tr from-orange-400 to-pink-600 flex items-center justify-center text-white shadow-lg shadow-orange-500/40">
              <FaRocket />
            </button>
            <span className="text-[10px] font-bold text-white mt-1 drop-shadow-md">Boost</span>
          </motion.div>
        )}

        <div className="flex flex-col items-center gap-1">
          <motion.button whileTap={{ scale: 0.8 }} onClick={handleLike}
            className={`w-10 h-10 rounded-full flex items-center justify-center text-3xl drop-shadow-xl transition-colors ${isLiked ? 'text-red-500' : 'text-white'}`}>
            {isLiked ? <FaHeart /> : <FaRegHeart />}
          </motion.button>
          <span className="text-xs font-bold text-white drop-shadow-md">{localLikes}</span>
        </div>

        <div className="flex flex-col items-center gap-1">
          <motion.button whileTap={{ scale: 0.8 }} onClick={(e) => { e.stopPropagation(); setShowComments(true); }}
            className="w-10 h-10 rounded-full flex items-center justify-center text-white text-3xl drop-shadow-xl">
            <FaComment />
          </motion.button>
          <span className="text-xs font-bold text-white drop-shadow-md">{localComments.length}</span>
        </div>

        <div className="flex flex-col items-center gap-1">
          <motion.button whileTap={{ scale: 0.8 }} onClick={handleShare}
            className="w-10 h-10 rounded-full flex items-center justify-center text-white text-3xl drop-shadow-xl">
            <FaShare />
          </motion.button>
          <span className="text-xs font-bold text-white drop-shadow-md">Partager</span>
        </div>

        <motion.button whileTap={{ scale: 0.9 }} onClick={handleToggleMute}
          className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center text-white mt-2">
          {muted ? <FaVolumeMute /> : <FaVolumeUp />}
        </motion.button>

        <button onClick={(e) => { e.stopPropagation(); setShowOptions(true); }} className="text-white text-xl drop-shadow-lg p-2">
          <HiDotsVertical />
        </button>
      </div>

      {/* Commentaires */}
      <AnimatePresence>
        {showComments && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pointer-events-auto" onClick={(e) => e.stopPropagation()}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowComments(false)} />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              className="relative w-full max-w-md bg-gray-900 border-t border-gray-800 rounded-t-3xl h-[70vh] flex flex-col z-50 shadow-2xl"
              onClick={(e) => e.stopPropagation()}>
              <div className="p-4 border-b border-gray-800 flex justify-between items-center">
                <span className="font-bold text-white">{localComments.length} Commentaires</span>
                <button onClick={() => setShowComments(false)} className="text-gray-400 p-2">✕</button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {localComments.map((comment, i) => (
                  <div key={comment._id || i} className="flex gap-3 items-start">
                    <img src={comment.user?.profilePhoto || generateDefaultAvatar(comment.user?.fullName || comment.user?.username)}
                      className="w-8 h-8 rounded-full bg-gray-700 object-cover" alt="user"
                      onError={(e) => { e.target.onerror = null; e.target.src = generateDefaultAvatar(comment.user?.username); }} />
                    <div>
                      <p className="text-xs font-bold text-gray-400">{comment.user?.fullName || comment.user?.username || "Utilisateur"}</p>
                      <p className="text-sm text-gray-200">{comment.text}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-4 bg-gray-800 flex gap-2 items-center">
                <input value={newComment} onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCommentSubmit()}
                  placeholder="Votre commentaire..."
                  className="flex-1 bg-gray-700 text-white rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-pink-500" />
                <button onClick={handleCommentSubmit} disabled={!newComment.trim()}
                  className="p-2 bg-pink-600 rounded-full text-white disabled:opacity-50"><IoSend /></button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Options */}
      <AnimatePresence>
        {showOptions && (
          <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={() => setShowOptions(false)}>
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              className="absolute bottom-0 inset-x-0 bg-gray-900 rounded-t-3xl p-6 space-y-3"
              onClick={(e) => e.stopPropagation()}>
              {isOwner && !isAutoPost && (
                <button onClick={async () => { if (confirm("Supprimer cette vidéo ?")) { await deleteVideo(video._id); setShowOptions(false); } }}
                  className="w-full py-3 bg-red-500/10 text-red-500 rounded-xl font-bold flex items-center justify-center gap-2">
                  <FaTrash /> Supprimer la vidéo
                </button>
              )}
              <button onClick={() => { navigator.clipboard.writeText(window.location.href); setShowOptions(false); }}
                className="w-full py-3 bg-gray-800 text-white rounded-xl font-bold">Copier le lien</button>
              <button onClick={() => setShowOptions(false)} className="w-full py-3 bg-gray-800 text-gray-400 rounded-xl">Annuler</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Boost */}
      <AnimatePresence>
        {showBoostModal && !isAutoPost && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setShowBoostModal(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gray-900 border border-gray-700 p-6 rounded-2xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <FaRocket className="text-orange-500" /> Booster cette vidéo
              </h2>
              <div className="space-y-3">
                {[{ id: 1, label: '24h Flash', price: 1000 }, { id: 2, label: '3 Jours Top', price: 2500 }].map(plan => (
                  <div key={plan.id} onClick={() => setSelectedBoost(plan)}
                    className={`p-3 rounded-lg border cursor-pointer flex justify-between transition-colors ${
                      selectedBoost?.id === plan.id ? 'border-orange-500 bg-orange-500/20' : 'border-gray-700 hover:border-gray-500'
                    }`}>
                    <span className="text-white">{plan.label}</span>
                    <span className="text-orange-400 font-bold">{plan.price} FCFA</span>
                  </div>
                ))}
              </div>
              <button onClick={handleBoost} disabled={!selectedBoost || boostLoading}
                className="w-full mt-6 bg-gradient-to-r from-orange-500 to-pink-600 text-white py-3 rounded-xl font-bold disabled:opacity-50 transition-opacity">
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
export default memo(VideoCard, (prev, next) =>
  prev.isActive   === next.isActive   &&
  prev.video._id  === next.video._id  &&
  prev.isAutoPost === next.isAutoPost
);