// src/pages/videos/VideoActions.jsx
// 🐛 FIX : Modal commentaires en position FIXED (au lieu de absolute)
//    → échappe au overflow-hidden du parent VideoCard
//    → z-index suffisant pour passer au-dessus de tout

import React, { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../context/AuthContext";
import { useVideos } from "../../context/VideoContext";
import {
  FaHeart, FaComment, FaShare,
  FaBookmark, FaTrash, FaFlag, FaLink
} from "react-icons/fa";
import { HiDotsVertical } from "react-icons/hi";
import { IoSend } from "react-icons/io5";

const VideoActions = ({ video }) => {
  const { user: currentUser } = useAuth();
  const { likeVideo, commentVideo, deleteVideo } = useVideos();

  const [showComments, setShowComments] = useState(false);
  const [showOptions,  setShowOptions]  = useState(false);
  const [newComment,   setNewComment]   = useState("");
  const [isCommenting, setIsCommenting] = useState(false);
  const [heartAnim,    setHeartAnim]    = useState(false);

  const isLiked = useMemo(() => {
    if (!currentUser) return false;
    if (Array.isArray(video.likes)) return video.likes.includes(currentUser._id);
    return !!video.userLiked;
  }, [video.likes, video.userLiked, currentUser]);

  const likesCount = useMemo(() => {
    if (Array.isArray(video.likes)) return video.likes.length;
    return video.likes || 0;
  }, [video.likes]);

  const commentsCount  = video.comments?.length || 0;
  const videoOwnerId   = video.user?._id || video.user || video.userId || video.uploadedBy?._id;
  const isOwner        = currentUser?._id && videoOwnerId === currentUser._id;

  const formatNumber = (num) => {
    if (!num) return "0";
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000)    return (num / 1000).toFixed(1) + "K";
    return num.toString();
  };

  const handleLike = async (e) => {
    e.stopPropagation();
    if (!currentUser) return alert("Connectez-vous pour aimer !");
    setHeartAnim(true);
    setTimeout(() => setHeartAnim(false), 300);
    await likeVideo(video._id);
  };

  const handleComment = async (e) => {
    e?.stopPropagation();
    if (!newComment.trim() || isCommenting) return;
    setIsCommenting(true);
    try {
      await commentVideo(video._id, newComment);
      setNewComment("");
    } finally {
      setIsCommenting(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Supprimer cette vidéo définitivement ?")) return;
    try {
      await deleteVideo(video._id);
      setShowOptions(false);
    } catch {
      alert("Erreur lors de la suppression");
    }
  };

  const handleShare = async (e) => {
    e.stopPropagation();
    if (navigator.share) {
      try { await navigator.share({ title: video?.description || "Regarde cette vidéo !", url: window.location.href }); }
      catch {}
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert("Lien copié dans le presse-papier !");
    }
  };

  // ─────────────────────────────────────────────────────────────────
  // 🐛 FIX : les modales sont rendues via createPortal dans document.body
  //    → elles échappent à tout overflow-hidden, clip-path ou z-index
  //    parent qui les rendait invisibles ou inaccessibles
  // ─────────────────────────────────────────────────────────────────
  const commentsModal = (
    <AnimatePresence>
      {showComments && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            style={{ zIndex: 9998 }}
            onClick={() => setShowComments(false)}
          />

          {/* Bottom sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 bg-gray-900 rounded-t-3xl flex flex-col shadow-2xl border-t border-gray-800"
            style={{ zIndex: 9999, height: "65vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 relative">
              <span className="font-bold text-white text-sm w-full text-center">
                {commentsCount} commentaires
              </span>
              <button
                onClick={() => setShowComments(false)}
                className="absolute right-4 p-2 text-gray-400 hover:text-white text-lg"
              >
                ✕
              </button>
            </div>

            {/* Liste */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {(!video.comments || video.comments.length === 0) ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-2">
                  <FaComment className="text-4xl opacity-20" />
                  <p className="text-sm">Sois le premier à commenter !</p>
                </div>
              ) : (
                video.comments.map((comment, idx) => (
                  <div key={comment._id || idx} className="flex gap-3 items-start">
                    <img
                      src={comment.user?.profilePhoto || comment.user?.profilePicture || "/default-avatar.png"}
                      alt="User"
                      className="w-8 h-8 rounded-full object-cover bg-gray-700 shrink-0"
                    />
                    <div className="flex-1 space-y-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-gray-300 font-semibold text-xs">
                          {comment.user?.fullName || comment.user?.username || "Utilisateur"}
                        </span>
                        <span className="text-gray-600 text-[10px]">
                          {new Date(comment.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-gray-200 text-sm">{comment.text || comment.content}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Input */}
            <div className="p-3 border-t border-gray-800 bg-gray-900 pb-safe">
              <div className="flex gap-2 items-center bg-gray-800 rounded-full px-2 py-1">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleComment()}
                  placeholder="Ajouter un commentaire..."
                  className="flex-1 bg-transparent text-white px-3 py-3 text-sm focus:outline-none placeholder-gray-500"
                  disabled={isCommenting}
                  autoFocus
                />
                <button
                  onClick={handleComment}
                  disabled={!newComment.trim() || isCommenting}
                  className={`p-2 rounded-full transition-all ${
                    newComment.trim()
                      ? "text-orange-500 bg-orange-500/10 hover:bg-orange-500 hover:text-white"
                      : "text-gray-500 cursor-not-allowed"
                  }`}
                >
                  {isCommenting ? (
                    <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <IoSend className="text-lg" />
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  const optionsModal = (
    <AnimatePresence>
      {showOptions && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            style={{ zIndex: 9998 }}
            onClick={() => setShowOptions(false)}
          />
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center p-8 pointer-events-none"
            style={{ zIndex: 9999 }}
          >
            <div
              className="w-full max-w-xs bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-2xl pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => { navigator.clipboard.writeText(window.location.href); alert("Lien copié !"); setShowOptions(false); }}
                className="flex items-center gap-3 px-6 py-4 hover:bg-gray-800 text-white transition-colors border-b border-gray-800 w-full"
              >
                <FaLink className="text-blue-500" />
                <span className="font-medium">Copier le lien</span>
              </button>

              <button
                onClick={() => { alert("Sauvegardé !"); setShowOptions(false); }}
                className="flex items-center gap-3 px-6 py-4 hover:bg-gray-800 text-white transition-colors border-b border-gray-800 w-full"
              >
                <FaBookmark className="text-yellow-500" />
                <span className="font-medium">Enregistrer</span>
              </button>

              {isOwner && (
                <button
                  onClick={handleDelete}
                  className="flex items-center gap-3 px-6 py-4 hover:bg-red-500/10 text-red-500 transition-colors border-b border-gray-800 w-full"
                >
                  <FaTrash />
                  <span className="font-medium">Supprimer</span>
                </button>
              )}

              {!isOwner && (
                <button
                  onClick={() => { alert("Signalé !"); setShowOptions(false); }}
                  className="flex items-center gap-3 px-6 py-4 hover:bg-gray-800 text-orange-500 transition-colors border-b border-gray-800 w-full"
                >
                  <FaFlag />
                  <span className="font-medium">Signaler</span>
                </button>
              )}

              <button
                onClick={() => setShowOptions(false)}
                className="px-6 py-4 text-gray-400 hover:text-white text-sm font-medium w-full"
              >
                Annuler
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  return (
    <>
      {/* Barre latérale droite */}
      <div className="absolute right-4 bottom-20 flex flex-col items-center gap-6 z-40">

        {/* Like */}
        <div className="flex flex-col items-center gap-1">
          <motion.button
            onClick={handleLike}
            whileTap={{ scale: 0.8 }}
            className={`w-12 h-12 rounded-full flex items-center justify-center shadow-xl transition-all ${
              isLiked
                ? "bg-gradient-to-br from-red-500 to-pink-600"
                : "bg-black/40 backdrop-blur-md border border-white/20 hover:bg-black/60"
            }`}
          >
            <FaHeart className={`text-white text-2xl ${heartAnim ? "animate-ping" : ""}`} />
          </motion.button>
          <span className="text-white text-xs font-bold drop-shadow-md">{formatNumber(likesCount)}</span>
        </div>

        {/* Commentaires */}
        <div className="flex flex-col items-center gap-1">
          <motion.button
            onClick={(e) => { e.stopPropagation(); setShowComments(true); }}
            whileTap={{ scale: 0.9 }}
            className="w-12 h-12 bg-black/40 backdrop-blur-md border border-white/20 rounded-full flex items-center justify-center hover:bg-black/60 transition-all shadow-xl"
          >
            <FaComment className="text-white text-2xl opacity-90" />
          </motion.button>
          <span className="text-white text-xs font-bold drop-shadow-md">{formatNumber(commentsCount)}</span>
        </div>

        {/* Partager */}
        <div className="flex flex-col items-center gap-1">
          <motion.button
            onClick={handleShare}
            whileTap={{ scale: 0.9 }}
            className="w-12 h-12 bg-black/40 backdrop-blur-md border border-white/20 rounded-full flex items-center justify-center hover:bg-black/60 transition-all shadow-xl"
          >
            <FaShare className="text-white text-2xl opacity-90" />
          </motion.button>
          <span className="text-white text-xs font-bold drop-shadow-md">Partager</span>
        </div>

        {/* Options */}
        <motion.button
          onClick={(e) => { e.stopPropagation(); setShowOptions(true); }}
          whileTap={{ scale: 0.9 }}
          className="w-10 h-10 mt-2 bg-black/40 backdrop-blur-md border border-white/20 rounded-full flex items-center justify-center hover:bg-black/60 transition-all shadow-xl"
        >
          <HiDotsVertical className="text-white text-xl" />
        </motion.button>
      </div>

      {/* Portails → montés dans document.body, hors de tout overflow-hidden */}
      {createPortal(commentsModal, document.body)}
      {createPortal(optionsModal,  document.body)}
    </>
  );
};

export default React.memo(VideoActions);