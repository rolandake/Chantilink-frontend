import React, { useEffect, useRef, useState, useMemo, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useVideos } from "../../context/VideoContext";
import { loadStripe } from "@stripe/stripe-js";
import {
  FaHeart, FaRegHeart, FaComment, FaShare, FaBookmark, FaRegBookmark,
  FaVolumeUp, FaVolumeMute, FaTrash, FaFlag, FaLink, FaDownload,
  FaUserSlash, FaMusic, FaPlay, FaPause, FaRocket
} from "react-icons/fa";
import { HiDotsVertical } from "react-icons/hi";
import { IoSend } from "react-icons/io5";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

const generateDefaultAvatar = (username = "User") => {
  const initial = username.charAt(0).toUpperCase();
  const colors = ['9CA3AF','EF4444','3B82F6','10B981','F59E0B','8B5CF6','EC4899'];
  const color = colors[Math.floor(Math.random() * colors.length)];
  return `data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='100' height='100' fill='%23${color}'/%3E%3Ctext x='50%25' y='50%25' font-size='48' fill='white' text-anchor='middle' dominant-baseline='middle'%3E${initial}%3C/text%3E%3C/svg%3E`;
};

const getAvatarUrl = (user) => {
  if (!user) return generateDefaultAvatar();
  const avatar = user.profilePhoto || user.profilePicture || user.avatar || user.photo;
  if (avatar) {
    return avatar.startsWith('http') || avatar.startsWith('data:')
      ? avatar
      : `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}${avatar.startsWith('/') ? avatar : '/' + avatar}`;
  }
  return generateDefaultAvatar(user.username || user.fullName);
};

const VideoCard = memo(({ video, isActive }) => {
  const videoRef = useRef(null);
  const navigate = useNavigate();
  const isMountedRef = useRef(true);

  const [muted, setMuted] = useState(true);
  const [showHeart, setShowHeart] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [showBoostModal, setShowBoostModal] = useState(false);
  const [localLikes, setLocalLikes] = useState(video?.likes || 0);
  const [localComments, setLocalComments] = useState(video?.comments || []);
  const [newComment, setNewComment] = useState("");
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [boostLoading, setBoostLoading] = useState(false);
  const [selectedBoost, setSelectedBoost] = useState(null);

  const { getActiveUser } = useAuth();
  const currentUser = getActiveUser();
  const { likeVideo, commentVideo, deleteVideo } = useVideos();

  const videoOwnerData = useMemo(() => {
    const owner = video?.uploadedBy || video?.owner || video?.user || {};
    return {
      id: owner?._id || owner?.id,
      username: owner?.username || owner?.fullName || "Utilisateur",
      avatar: getAvatarUrl(owner),
      verified: owner?.isVerified || false
    };
  }, [video]);

  const isOwner = useMemo(() =>
    currentUser?.user?._id === videoOwnerData.id ||
    currentUser?.user?.id === videoOwnerData.id,
    [currentUser, videoOwnerData.id]
  );

  const boostPlans = [
    { id: 1, duration: 24, amount: 1000, label: "24h", description: "Visibilité pendant 1 jour" },
    { id: 2, duration: 72, amount: 2500, label: "3 jours", description: "Visibilité pendant 3 jours" },
    { id: 3, duration: 168, amount: 5000, label: "7 jours", description: "Visibilité pendant 1 semaine" }
  ];

  const formatNumber = (num) => {
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + "M";
    if (num >= 1_000) return (num / 1_000).toFixed(1) + "K";
    return num?.toString() || "0";
  };

  // === Lecture auto ===
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;

    if (isActive) {
      vid.play().catch(err => {
        if (err.name === "NotAllowedError") {
          setMuted(true);
          vid.muted = true;
          vid.play().catch(() => {});
        }
      });
    } else {
      vid.pause();
    }

    return () => { if (vid) vid.pause(); };
  }, [isActive]);

  // === Progression ===
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    const updateProgress = () => {
      if (vid.duration) setProgress((vid.currentTime / vid.duration) * 100);
    };
    vid.addEventListener("timeupdate", updateProgress);
    return () => vid.removeEventListener("timeupdate", updateProgress);
  }, []);

  // === Handlers ===
  const handleDoubleTap = () => {
    if (!isLiked) handleLike();
    setShowHeart(true);
    setTimeout(() => isMountedRef.current && setShowHeart(false), 800);
  };

  const handleToggleMute = () => {
    const vid = videoRef.current;
    if (!vid) return;
    const newMuted = !muted;
    setMuted(newMuted);
    vid.muted = newMuted;
  };

  const handlePlayPause = () => {
    const vid = videoRef.current;
    if (!vid) return;
    if (vid.paused) {
      vid.play();
      setIsPaused(false);
    } else {
      vid.pause();
      setIsPaused(true);
    }
  };

  const handleLike = async () => {
    const wasLiked = isLiked;
    setIsLiked(!isLiked);
    setLocalLikes(prev => wasLiked ? prev - 1 : prev + 1);
    try {
      if (likeVideo) await likeVideo(video._id);
    } catch {
      setIsLiked(wasLiked);
      setLocalLikes(prev => wasLiked ? prev + 1 : prev - 1);
    }
  };

  const handleSave = () => setIsSaved(!isSaved);
  const handleFollow = () => setIsFollowing(!isFollowing);

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({ title: video.title, url: window.location.href }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert("Lien copié !");
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    alert("Lien copié !");
    setShowOptions(false);
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(video.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `video-${video._id}.mp4`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      alert("Erreur");
    }
    setShowOptions(false);
  };

  const handleReport = () => { alert("Signalée"); setShowOptions(false); };
  const handleBlock = () => {
    if (window.confirm(`Bloquer @${videoOwnerData.username} ?`)) {
      alert(`Bloqué`);
      setShowOptions(false);
    }
  };

  const handleDelete = async () => {
    if (window.confirm("Supprimer ?")) {
      if (deleteVideo) await deleteVideo(video._id);
      setShowOptions(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    const comment = {
      id: Date.now(),
      user: { ...currentUser.user, profilePicture: getAvatarUrl(currentUser.user) },
      text: newComment,
      createdAt: new Date()
    };
    setLocalComments([...localComments, comment]);
    setNewComment("");
    if (commentVideo) await commentVideo(video._id, newComment);
  };

  const handleBoost = async (plan) => {
    if (!currentUser) {
      alert("Vous devez être connecté pour booster une vidéo");
      return;
    }

    setBoostLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/boost/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          contentId: video._id,
          amount: plan.amount,
          duration: plan.duration
        })
      });

      if (!res.ok) {
        throw new Error("Erreur lors de la création du paiement");
      }

      const data = await res.json();
      const stripe = await stripePromise;
      
      const { error } = await stripe.confirmCardPayment(data.clientSecret);
      
      if (error) {
        alert(`Erreur de paiement: ${error.message}`);
      } else {
        alert("✅ Vidéo boostée avec succès !");
        setShowBoostModal(false);
      }
    } catch (error) {
      console.error("Erreur boost:", error);
      alert("Erreur lors du boost. Veuillez réessayer.");
    } finally {
      setBoostLoading(false);
    }
  };

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      {/* Vidéo */}
      <video
        ref={videoRef}
        src={video.url}
        className="w-full h-full object-cover"
        style={{ filter: video.filter || "none" }}
        loop
        muted={muted}
        playsInline
        preload="auto"
        onDoubleClick={handleDoubleTap}
        onClick={handlePlayPause}
      />

      {/* Gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/70 pointer-events-none" />

      {/* Barre progression */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-white/10 z-50">
        <motion.div
          className="h-full bg-gradient-to-r from-pink-500 to-orange-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Coeur double tap */}
      <AnimatePresence>
        {showHeart && (
          <motion.div
            initial={{ scale: 0, opacity: 1 }}
            animate={{ scale: 1.3, opacity: 0 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-40"
          >
            <FaHeart className="text-white text-7xl drop-shadow-2xl" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pause */}
      {isPaused && (
        <motion.div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
          <div className="w-16 h-16 bg-black/60 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20">
            <FaPlay className="text-white text-2xl ml-1" />
          </div>
        </motion.div>
      )}

      {/* === INFOS VIDÉO (COMPACT) === */}
      <div className="absolute bottom-20 left-3 right-20 z-30 text-white">
        <div className="flex items-center gap-2 mb-2">
          <motion.img
            whileHover={{ scale: 1.1 }}
            src={videoOwnerData.avatar}
            className="w-9 h-9 rounded-full border-2 border-white shadow-md object-cover"
            alt={videoOwnerData.username}
            onError={(e) => e.target.src = generateDefaultAvatar(videoOwnerData.username)}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm truncate">@{videoOwnerData.username}</span>
              {videoOwnerData.verified && <span className="text-blue-400 text-xs">✓</span>}
            </div>
          </div>
          {!isOwner && (
            <motion.button
              onClick={handleFollow}
              whileTap={{ scale: 0.9 }}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                isFollowing
                  ? "bg-white/20 backdrop-blur-md border border-white/30"
                  : "bg-gradient-to-r from-pink-500 to-red-500"
              }`}
            >
              {isFollowing ? "Abonné" : "+ Suivre"}
            </motion.button>
          )}
        </div>

        <div className="space-y-1">
          {video.title && (
            <p className="font-bold text-sm line-clamp-1 drop-shadow-md">{video.title}</p>
          )}
          {video.description && (
            <p className="text-xs text-white/90 line-clamp-1 drop-shadow-md">{video.description}</p>
          )}
        </div>

        {video.musicName && (
          <motion.div
            initial={{ x: -10 }}
            animate={{ x: 0 }}
            className="flex items-center gap-1.5 bg-black/40 backdrop-blur-md rounded-full px-3 py-1.5 w-fit mt-2 text-xs"
          >
            <FaMusic className="text-white text-xs animate-pulse" />
            <span className="truncate max-w-[120px]">{video.musicName}</span>
          </motion.div>
        )}
      </div>

      {/* === BOUTONS D'ACTION (COMPACTS) === */}
      <div className="absolute right-2 bottom-24 flex flex-col items-center gap-3 z-40">
        {/* Boost Button (pour le propriétaire) */}
        {isOwner && (
          <motion.button
            onClick={() => setShowBoostModal(true)}
            whileTap={{ scale: 0.85 }}
            whileHover={{ scale: 1.1 }}
            className="flex flex-col items-center gap-1"
          >
            <div className="w-11 h-11 rounded-full flex items-center justify-center shadow-lg bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 shadow-purple-500/40">
              <FaRocket className="text-white text-lg" />
            </div>
            <span className="text-white text-[10px] font-bold">Boost</span>
          </motion.button>
        )}

        {/* Like */}
        <motion.button
          onClick={handleLike}
          whileTap={{ scale: 0.85 }}
          whileHover={{ scale: 1.1 }}
          className="flex flex-col items-center gap-1"
        >
          <div className={`w-11 h-11 rounded-full flex items-center justify-center shadow-lg transition-all ${
            isLiked ? "bg-gradient-to-br from-pink-500 to-red-600 shadow-pink-500/40" : "bg-black/40 backdrop-blur-md border border-white/20"
          }`}>
            {isLiked ? <FaHeart className="text-white text-lg" /> : <FaRegHeart className="text-white text-lg" />}
          </div>
          <span className="text-white text-[10px] font-bold">{formatNumber(localLikes)}</span>
        </motion.button>

        {/* Commentaire */}
        <motion.button
          onClick={() => setShowComments(!showComments)}
          whileTap={{ scale: 0.85 }}
          whileHover={{ scale: 1.1 }}
          className="flex flex-col items-center gap-1"
        >
          <div className="w-11 h-11 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center shadow-lg border border-white/20">
            <FaComment className="text-white text-lg" />
          </div>
          <span className="text-white text-[10px] font-bold">{formatNumber(localComments.length)}</span>
        </motion.button>

        {/* Partager */}
        <motion.button
          onClick={handleShare}
          whileTap={{ scale: 0.85 }}
          whileHover={{ scale: 1.1 }}
          className="w-11 h-11 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center shadow-lg border border-white/20"
        >
          <FaShare className="text-white text-lg" />
        </motion.button>

        {/* Sauvegarder */}
        <motion.button
          onClick={handleSave}
          whileTap={{ scale: 0.85 }}
          whileHover={{ scale: 1.1 }}
          className="w-11 h-11 rounded-full flex items-center justify-center shadow-lg transition-all"
          style={{
            background: isSaved ? "linear-gradient(135deg, #f59e0b, #f97316)" : "",
            border: isSaved ? "none" : "1px solid rgba(255,255,255,0.2)",
            backdropFilter: isSaved ? "none" : "blur(8px)",
            WebkitBackdropFilter: isSaved ? "none" : "blur(8px)",
            backgroundColor: isSaved ? "" : "rgba(0,0,0,0.4)"
          }}
        >
          {isSaved ? <FaBookmark className="text-white text-lg" /> : <FaRegBookmark className="text-white text-lg" />}
        </motion.button>

        {/* Options */}
        <motion.button
          onClick={() => setShowOptions(!showOptions)}
          whileTap={{ scale: 0.85 }}
          whileHover={{ scale: 1.1 }}
          className="w-11 h-11 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center shadow-lg border border-white/20"
        >
          <HiDotsVertical className="text-white text-lg" />
        </motion.button>

        {/* Son */}
        <motion.button
          onClick={handleToggleMute}
          whileTap={{ scale: 0.85 }}
          whileHover={{ scale: 1.1 }}
          className="w-11 h-11 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center shadow-lg border border-white/20 mt-1"
        >
          {muted ? <FaVolumeMute className="text-white text-lg" /> : <FaVolumeUp className="text-white text-lg" />}
        </motion.button>
      </div>

      {/* === MODAL BOOST === */}
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
              className="fixed bottom-0 left-0 right-0 bg-gradient-to-b from-gray-900 to-black rounded-t-3xl z-50 p-6 shadow-2xl max-h-[80vh] overflow-y-auto"
            >
              <div className="w-12 h-1.5 bg-gray-600 rounded-full mx-auto mb-6" />
              
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 rounded-full flex items-center justify-center">
                  <FaRocket className="text-white text-xl" />
                </div>
                <div>
                  <h3 className="text-white font-bold text-xl">Booster votre vidéo</h3>
                  <p className="text-gray-400 text-sm">Augmentez votre visibilité</p>
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
                        : "bg-white/5 border-white/10 hover:border-white/20"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-left">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-white font-bold text-lg">{plan.label}</span>
                          {plan.id === 2 && (
                            <span className="bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full">
                              Populaire
                            </span>
                          )}
                        </div>
                        <p className="text-gray-400 text-sm">{plan.description}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-white font-bold text-xl">{plan.amount}</div>
                        <div className="text-gray-400 text-xs">FCFA</div>
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>

              <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 mb-6">
                <p className="text-blue-300 text-sm">
                  💡 <strong>Avantages du boost :</strong> Votre vidéo apparaîtra en priorité dans le feed, augmentant vos vues et votre engagement !
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowBoostModal(false)}
                  disabled={boostLoading}
                  className="flex-1 py-3 bg-white/10 rounded-xl text-white font-bold hover:bg-white/20 transition-all disabled:opacity-50"
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

      {/* === MENU OPTIONS (COMPACT) === */}
      <AnimatePresence>
        {showOptions && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
              onClick={() => setShowOptions(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="fixed bottom-0 left-0 right-0 bg-gray-900/95 backdrop-blur-2xl rounded-t-3xl z-50 p-4 shadow-2xl"
            >
              <div className="w-10 h-1 bg-gray-600 rounded-full mx-auto mb-3" />
              <div className="space-y-2">
                <button onClick={handleCopyLink} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/10 text-white text-sm">
                  <div className="w-9 h-9 bg-blue-500/20 rounded-full flex items-center justify-center"><FaLink className="text-blue-400 text-base" /></div>
                  Copier le lien
                </button>
                <button onClick={handleDownload} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/10 text-white text-sm">
                  <div className="w-9 h-9 bg-green-500/20 rounded-full flex items-center justify-center"><FaDownload className="text-green-400 text-base" /></div>
                  Télécharger
                </button>
                {!isOwner && (
                  <>
                    <button onClick={handleReport} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/10 text-white text-sm">
                      <div className="w-9 h-9 bg-orange-500/20 rounded-full flex items-center justify-center"><FaFlag className="text-orange-400 text-base" /></div>
                      Signaler
                    </button>
                    <button onClick={handleBlock} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/10 text-white text-sm">
                      <div className="w-9 h-9 bg-red-500/20 rounded-full flex items-center justify-center"><FaUserSlash className="text-red-400 text-base" /></div>
                      Bloquer
                    </button>
                  </>
                )}
                {isOwner && (
                  <button onClick={handleDelete} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-red-500/10 text-red-400 text-sm">
                    <div className="w-9 h-9 bg-red-500/20 rounded-full flex items-center justify-center"><FaTrash className="text-red-400 text-base" /></div>
                    Supprimer
                  </button>
                )}
                <button onClick={() => setShowOptions(false)} className="w-full p-3 bg-white/10 rounded-xl text-white font-bold text-sm hover:bg-white/20">
                  Annuler
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* === COMMENTAIRES (COMPACT) === */}
      <AnimatePresence>
        {showComments && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            className="absolute bottom-0 left-0 right-0 bg-gray-900/95 backdrop-blur-2xl z-50 rounded-t-3xl max-h-[70vh] flex flex-col"
          >
            <div className="flex items-center justify-between p-3 border-b border-white/10">
              <h3 className="text-white font-bold text-sm flex items-center gap-2">
                <FaComment className="text-pink-500 text-sm" />
                {localComments.length} commentaire{localComments.length > 1 ? "s" : ""}
              </h3>
              <button onClick={() => setShowComments(false)} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-gray-300 hover:text-white">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {localComments.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-sm">
                  <div className="w-14 h-14 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-3"><FaComment className="text-2xl opacity-30" /></div>
                  Soyez le premier à commenter !
                </div>
              ) : (
                localComments.map((c, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2">
                    <img
                      src={c.user?.profilePicture || generateDefaultAvatar(c.user?.username)}
                      className="w-8 h-8 rounded-full object-cover border border-white/10"
                      alt=""
                    />
                    <div className="flex-1 bg-white/5 backdrop-blur-sm rounded-xl p-2.5 border border-white/10">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-white font-semibold text-xs">{c.user?.username}</span>
                        <span className="text-gray-500 text-[10px] ml-auto">
                          {new Date(c.createdAt).toLocaleDateString("fr", { day: "numeric", month: "short" })}
                        </span>
                      </div>
                      <p className="text-gray-200 text-xs leading-tight">{c.text}</p>
                    </div>
                  </motion.div>
                ))
              )}
            </div>

            <div className="p-3 border-t border-white/10 bg-gray-800/80">
              <div className="flex gap-2 items-center">
                <img
                  src={getAvatarUrl(currentUser?.user)}
                  className="w-8 h-8 rounded-full object-cover border border-gray-600"
                  alt=""
                />
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleAddComment()}
                  placeholder="Commenter..."
                  className="flex-1 bg-gray-700/70 text-white px-3 py-2 rounded-full text-sm focus:outline-none focus:ring-1 focus:ring-pink-500 placeholder-gray-400"
                />
                <button
                  onClick={handleAddComment}
                  disabled={!newComment.trim()}
                  className="w-9 h-9 bg-gradient-to-r from-pink-500 to-red-500 rounded-full flex items-center justify-center disabled:opacity-50"
                >
                  <IoSend className="text-white text-base" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

VideoCard.displayName = 'VideoCard';
export default VideoCard;