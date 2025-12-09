// src/pages/Videos/VideoCard.jsx
import React, { useEffect, useRef, useState, useMemo, memo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useVideos } from "../../context/VideoContext"; // Assurez-vous que ce contexte exporte bien incrementViews
import { loadStripe } from "@stripe/stripe-js";
import {
  FaHeart, FaRegHeart, FaComment, FaShare, 
  FaVolumeUp, FaVolumeMute, FaTrash, FaRocket, FaMusic, FaPlay, FaCheckCircle
} from "react-icons/fa";
import { HiDotsVertical } from "react-icons/hi";
import { IoSend } from "react-icons/io5";

// Configuration Stripe sécurisée
const STRIPE_KEY = import.meta.env.VITE_STRIPE_PUBLIC_KEY;
const stripePromise = STRIPE_KEY ? loadStripe(STRIPE_KEY) : null;
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// === UTILITAIRES ===
const generateDefaultAvatar = (username = "U") => {
  const char = (username || "U").charAt(0).toUpperCase();
  const colors = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6'];
  const color = colors[char.charCodeAt(0) % colors.length];
  return `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="${encodeURIComponent(color)}"/><text x="50%" y="50%" font-size="50" fill="white" text-anchor="middle" dy=".3em" font-family="Arial">${char}</text></svg>`;
};

// === COMPOSANT PRINCIPAL ===
const VideoCard = memo(({ video, isActive }) => {
  // Sécurité : Si pas de vidéo, on ne rend rien pour éviter les crashs
  if (!video) return null;

  const navigate = useNavigate();
  const videoRef = useRef(null);
  
  // Contextes
  const { user: currentUser } = useAuth();
  const { likeVideo, commentVideo, deleteVideo, incrementViews } = useVideos();

  // États UI
  const [muted, setMuted] = useState(true); // Muted par défaut pour autoplay navigateur
  const [isPaused, setIsPaused] = useState(false);
  const [showHeart, setShowHeart] = useState(false);
  const [progress, setProgress] = useState(0);
  
  // États Modales
  const [showComments, setShowComments] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [showBoostModal, setShowBoostModal] = useState(false);
  
  // États Données (Optimistic UI)
  const [localLikes, setLocalLikes] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [localComments, setLocalComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  
  // États Boost
  const [boostLoading, setBoostLoading] = useState(false);
  const [selectedBoost, setSelectedBoost] = useState(null);

  // Normalisation des données Propriétaire
  const owner = useMemo(() => {
    const u = video.user || video.uploadedBy || {};
    return {
      _id: u._id || u.id || "unknown",
      username: u.username || u.fullName || "Utilisateur",
      photo: u.profilePhoto || u.profilePicture || u.avatar || null,
      isVerified: !!u.isVerified
    };
  }, [video]);

  const isOwner = currentUser && (owner._id === currentUser._id);

  // === INITIALISATION ===
  useEffect(() => {
    // Likes
    const likesList = Array.isArray(video.likes) ? video.likes : [];
    setLocalLikes(likesList.length || (typeof video.likes === 'number' ? video.likes : 0));
    
    if (currentUser) {
        setIsLiked(likesList.some(id => id === currentUser._id || (typeof id === 'object' && id._id === currentUser._id)));
    }

    // Comments
    setLocalComments(video.comments || []);
  }, [video, currentUser]);

  // === GESTION DE LA LECTURE (Autoplay & Views) ===
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;

    if (isActive) {
      // 1. Lancer la vidéo
      const playPromise = vid.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPaused(false);
          })
          .catch((error) => {
            // Si le navigateur bloque l'autoplay avec son, on mute et on relance
            if (error.name === "NotAllowedError" || error.name === "NotSupportedError") {
              setMuted(true);
              vid.muted = true;
              vid.play().catch(() => {});
            }
          });
      }

      // 2. Incrémenter la vue (seulement si la fonction existe)
      if (incrementViews && video._id) {
         // Petit délai pour compter une "vraie" vue
         const timer = setTimeout(() => incrementViews(video._id), 2000);
         return () => clearTimeout(timer);
      }

    } else {
      vid.pause();
      vid.currentTime = 0; // Reset pour la prochaine lecture
      setIsPaused(false); // Reset UI pause icon
    }
  }, [isActive, video._id, incrementViews]);

  // === PROGRESS BAR ===
  const handleTimeUpdate = useCallback(() => {
    const vid = videoRef.current;
    if (vid && vid.duration) {
      setProgress((vid.currentTime / vid.duration) * 100);
    }
  }, []);

  // === HANDLERS ===
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
  }, [isLiked]);

  const handleLike = useCallback(async (e) => {
    e?.stopPropagation();
    if (!currentUser) return alert("Connectez-vous pour aimer !");

    // Optimistic Update
    const wasLiked = isLiked;
    setIsLiked(!wasLiked);
    setLocalLikes(prev => wasLiked ? prev - 1 : prev + 1);

    try {
      await likeVideo(video._id);
    } catch (err) {
      // Revert en cas d'erreur
      setIsLiked(wasLiked);
      setLocalLikes(prev => wasLiked ? prev + 1 : prev - 1);
    }
  }, [currentUser, isLiked, video._id, likeVideo]);

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

    try {
        await commentVideo(video._id, newComment);
    } catch (err) {
        alert("Erreur lors de l'envoi du commentaire");
        setLocalComments(prev => prev.filter(c => c._id !== tempComment._id));
    }
  };

  const handleShare = async (e) => {
    e.stopPropagation();
    if (navigator.share) {
        try {
            await navigator.share({
                title: "Regarde cette vidéo !",
                url: window.location.href
            });
        } catch (err) {
            console.log("Partage annulé");
        }
    } else {
        navigator.clipboard.writeText(window.location.href);
        alert("Lien copié !");
    }
  };

  const handleBoost = async () => {
    if (!selectedBoost || !stripePromise) return;
    setBoostLoading(true);
    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/api/boost/create-session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
                contentId: video._id,
                contentType: 'video', // Important si le backend gère posts et vidéos
                amount: selectedBoost.amount,
                planId: selectedBoost.id
            })
        });
        const data = await res.json();
        if (data.url) window.location.href = data.url;
        else {
            alert("Simulation: Boost activé !");
            setShowBoostModal(false);
        }
    } catch (err) {
        console.error(err);
        alert("Erreur paiement");
    } finally {
        setBoostLoading(false);
    }
  };

  // === RENDU ===
  return (
    <div className="relative w-full h-full bg-black overflow-hidden select-none">
      
      {/* 1. PLAYER VIDEO */}
      <video
        ref={videoRef}
        src={video.url}
        className="w-full h-full object-cover"
        style={{ filter: video.filter || "none" }}
        loop
        muted={muted}
        playsInline
        onClick={togglePlay}
        onDoubleClick={handleDoubleTap}
        onTimeUpdate={handleTimeUpdate}
      />

      {/* 2. OVERLAY GRADIENT (Lisibilité texte) */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/80 pointer-events-none" />

      {/* 3. PROGRESS BAR */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gray-800/30 z-20">
        <motion.div 
            className="h-full bg-gradient-to-r from-orange-500 to-pink-500" 
            style={{ width: `${progress}%` }} 
            layoutId="progressBar"
        />
      </div>

      {/* 4. ANIMATION PAUSE / COEUR */}
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

      {/* 5. INFOS UTILISATEUR & DESCRIPTION (Bas Gauche) */}
      <div className="absolute bottom-4 left-4 right-16 z-30 pb-safe">
        <div 
            onClick={() => navigate(`/profile/${owner._id}`)}
            className="flex items-center gap-3 mb-3 cursor-pointer group"
        >
             <img 
                src={owner.photo ? (owner.photo.startsWith('http') ? owner.photo : `${API_URL}${owner.photo}`) : generateDefaultAvatar(owner.username)}
                alt={owner.username}
                className="w-11 h-11 rounded-full border-2 border-white shadow-md object-cover group-hover:scale-105 transition-transform"
             />
             <div className="flex flex-col">
                 <h3 className="font-bold text-white text-base flex items-center gap-1 shadow-black drop-shadow-md">
                    @{owner.username}
                    {owner.isVerified && <FaCheckCircle className="text-orange-500 text-xs" />}
                 </h3>
             </div>
             
             {!isOwner && currentUser && (
                 <button className="bg-pink-600 text-white text-xs font-bold px-3 py-1 rounded-full ml-2 shadow-lg hover:bg-pink-700 transition">
                     Suivre
                 </button>
             )}
        </div>

        <div className="text-white/90 text-sm mb-2 max-w-[90%] drop-shadow-md">
            <p className="line-clamp-2">{video.description || video.title}</p>
        </div>

        <div className="flex items-center gap-2 text-white/80 text-xs font-medium bg-white/10 w-fit px-3 py-1 rounded-full backdrop-blur-sm">
             <FaMusic className="animate-spin-slow" />
             <span>{video.musicName || "Son original"}</span>
        </div>
      </div>

      {/* 6. ACTIONS (Barre Latérale Droite) */}
      <div className="absolute right-2 bottom-20 flex flex-col items-center gap-6 z-40 pb-safe">
         
         {/* BOOST (Owner Only) */}
         {isOwner && (
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

         {/* LIKE */}
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

         {/* COMMENT */}
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

         {/* SHARE */}
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

         {/* MUTE */}
         <motion.button 
            whileTap={{ scale: 0.9 }}
            onClick={(e) => { e.stopPropagation(); setMuted(!muted); if(videoRef.current) videoRef.current.muted = !muted; }}
            className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center text-white mt-2"
         >
            {muted ? <FaVolumeMute /> : <FaVolumeUp />}
         </motion.button>

         {/* OPTIONS */}
         <button 
            onClick={(e) => { e.stopPropagation(); setShowOptions(true); }} 
            className="text-white text-xl drop-shadow-lg p-2"
         >
             <HiDotsVertical />
         </button>
      </div>

      {/* === 7. MODALES === */}
      
      {/* Comments Modal */}
      <AnimatePresence>
        {showComments && (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={(e) => e.stopPropagation()}>
                <motion.div 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                    onClick={() => setShowComments(false)}
                />
                <motion.div 
                    initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                    className="relative w-full max-w-md bg-gray-900 border-t border-gray-800 rounded-t-3xl h-[70vh] flex flex-col z-50 shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="p-4 border-b border-gray-800 flex justify-between items-center">
                        <span className="font-bold text-white">{localComments.length} Commentaires</span>
                        <button onClick={() => setShowComments(false)} className="text-gray-400 p-2">✕</button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {localComments.length === 0 ? (
                            <div className="text-center text-gray-500 mt-10">Soyez le premier à commenter !</div>
                        ) : (
                            localComments.map((comment, i) => (
                                <div key={i} className="flex gap-3 items-start">
                                    <img 
                                        src={comment.user?.profilePhoto || generateDefaultAvatar(comment.user?.fullName)} 
                                        className="w-8 h-8 rounded-full bg-gray-700" 
                                        alt="user"
                                    />
                                    <div>
                                        <p className="text-xs font-bold text-gray-400">
                                            {comment.user?.fullName || comment.user?.username || "Utilisateur"}
                                        </p>
                                        <p className="text-sm text-gray-200">{comment.text}</p>
                                    </div>
                                </div>
                            ))
                        )}
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

      {/* Options Modal */}
      <AnimatePresence>
        {showOptions && (
            <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={() => setShowOptions(false)}>
                <motion.div 
                    initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                    className="absolute bottom-0 inset-x-0 bg-gray-900 rounded-t-3xl p-6 space-y-3"
                    onClick={(e) => e.stopPropagation()}
                >
                    {isOwner && (
                        <button 
                            onClick={async () => {
                                if(confirm("Supprimer ?")) { await deleteVideo(video._id); }
                            }} 
                            className="w-full py-3 bg-red-500/10 text-red-500 rounded-xl font-bold flex items-center justify-center gap-2"
                        >
                            <FaTrash /> Supprimer la vidéo
                        </button>
                    )}
                    <button onClick={() => { navigator.clipboard.writeText(window.location.href); setShowOptions(false); }} className="w-full py-3 bg-gray-800 text-white rounded-xl font-bold">
                        Copier le lien
                    </button>
                    <button onClick={() => setShowOptions(false)} className="w-full py-3 bg-gray-800 text-gray-400 rounded-xl">
                        Annuler
                    </button>
                </motion.div>
            </div>
        )}
      </AnimatePresence>
      
      {/* Boost Modal (Simplified for UI) */}
      <AnimatePresence>
          {showBoostModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setShowBoostModal(false)}>
                  <motion.div 
                      initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
                      className="bg-gray-900 border border-gray-700 p-6 rounded-2xl w-full max-w-sm"
                      onClick={(e) => e.stopPropagation()}
                  >
                      <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                          <FaRocket className="text-orange-500" /> Booster cette vidéo
                      </h2>
                      <div className="space-y-3">
                          {[
                              {id: 1, label: '24h Flash', price: 1000},
                              {id: 2, label: '3 Jours Top', price: 2500},
                          ].map(plan => (
                              <div 
                                  key={plan.id} 
                                  onClick={() => setSelectedBoost(plan)}
                                  className={`p-3 rounded-lg border cursor-pointer flex justify-between ${selectedBoost?.id === plan.id ? 'border-orange-500 bg-orange-500/20' : 'border-gray-700'}`}
                              >
                                  <span className="text-white">{plan.label}</span>
                                  <span className="text-orange-400 font-bold">{plan.price} FCFA</span>
                              </div>
                          ))}
                      </div>
                      <button 
                          onClick={handleBoost}
                          disabled={!selectedBoost || boostLoading}
                          className="w-full mt-6 bg-gradient-to-r from-orange-500 to-pink-600 text-white py-3 rounded-xl font-bold"
                      >
                          {boostLoading ? 'Chargement...' : 'Payer'}
                      </button>
                  </motion.div>
              </div>
          )}
      </AnimatePresence>

    </div>
  );
});

VideoCard.displayName = "VideoCard";
export default VideoCard;