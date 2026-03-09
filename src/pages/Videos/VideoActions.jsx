// src/pages/videos/VideoActions.jsx
//
// 🔥 FIX : clic sur les actions ne change plus la vidéo active
//
//   CAUSE : les événements touch/pointer sur les boutons remontaient jusqu'au
//   scroll container → IntersectionObserver ou le fallback scroll recalculait
//   activeIndex → la vidéo changeait.
//
//   FIX 1 : onPointerDown/onTouchStart bloqués sur la barre d'actions
//           (e.stopPropagation() seul ne suffit pas pour les events pointer)
//   FIX 2 : les modales via createPortal bloquent aussi le scroll du container
//           pendant qu'elles sont ouvertes (touch-action: none sur body)
//   FIX 3 : lock/unlock du scroll body quand une modale est ouverte

import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../context/AuthContext";
import { useVideos } from "../../context/VideoContext";
import {
  FaHeart, FaRegHeart, FaComment, FaShare,
  FaBookmark, FaTrash, FaFlag, FaLink, FaReply,
} from "react-icons/fa";
import { HiDotsVertical } from "react-icons/hi";
import { IoSend } from "react-icons/io5";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

// ── Lock/unlock du scroll du feed pendant qu'une modale est ouverte ──
let scrollLockCount = 0;
const lockFeedScroll = () => {
  scrollLockCount++;
  // Empêche le scroll du feed (le container principal Videos)
  const feed = document.querySelector('.vp-scroll');
  if (feed) {
    feed.style.overflow = 'hidden';
    feed.style.touchAction = 'none';
  }
};
const unlockFeedScroll = () => {
  scrollLockCount = Math.max(0, scrollLockCount - 1);
  if (scrollLockCount === 0) {
    const feed = document.querySelector('.vp-scroll');
    if (feed) {
      feed.style.overflow = '';
      feed.style.touchAction = '';
    }
  }
};

// ── Stoppe la propagation complète d'un event ─────────────────────────
const stopAll = (e) => {
  e.stopPropagation();
  e.preventDefault?.();
};

const generateAvatar = (name = "U") => {
  const char   = (name || "U").charAt(0).toUpperCase();
  const colors = ["#EF4444","#3B82F6","#10B981","#F59E0B","#8B5CF6","#EC4899"];
  const color  = colors[char.charCodeAt(0) % colors.length];
  return `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="${encodeURIComponent(color)}"/><text x="50%" y="50%" font-size="50" fill="white" text-anchor="middle" dy=".3em" font-family="Arial">${char}</text></svg>`;
};

const UserAvatar = ({ user, size = "w-8 h-8" }) => {
  const name = user?.username || user?.fullName || "U";
  const src  = user?.profilePhoto || user?.profilePicture || user?.avatar || generateAvatar(name);
  return (
    <img src={src} alt={name}
      className={`${size} rounded-full object-cover bg-gray-700 shrink-0 border border-white/10`}
      onError={(e) => { e.target.onerror = null; e.target.src = generateAvatar(name); }}
    />
  );
};

const formatDate = (date) => {
  if (!date) return "";
  const diff = Math.floor((Date.now() - new Date(date)) / 1000);
  if (diff < 60)    return "À l'instant";
  if (diff < 3600)  return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}j`;
  return new Date(date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
};

const formatNumber = (num) => {
  if (!num) return "0";
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000)    return (num / 1000).toFixed(1) + "K";
  return String(num);
};

// ─────────────────────────────────────────────────────────────────────
// CommentItem
// ─────────────────────────────────────────────────────────────────────
const CommentItem = ({ comment, videoId, currentUser, getToken, depth = 0 }) => {
  const [liked,       setLiked]       = useState(false);
  const [likeCount,   setLikeCount]   = useState(comment.likes?.length || 0);
  const [showReply,   setShowReply]   = useState(false);
  const [replyText,   setReplyText]   = useState("");
  const [sending,     setSending]     = useState(false);
  const [replies,     setReplies]     = useState(comment.replies || []);
  const [showReplies, setShowReplies] = useState(false);
  const replyInputRef = useRef(null);

  useEffect(() => {
    if (showReply) replyInputRef.current?.focus();
  }, [showReply]);

  useEffect(() => {
    if (!currentUser) return;
    const uid = currentUser._id || currentUser.id;
    setLiked((comment.likes || []).some(id => id?.toString() === uid?.toString()));
  }, [comment._id, currentUser]);

  const handleLike = useCallback(async (e) => {
    e.stopPropagation();
    if (!currentUser) return;
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikeCount(c => wasLiked ? c - 1 : c + 1);
    try {
      const token = getToken ? await getToken() : null;
      await fetch(`${API_URL}/videos/${videoId}/comment/${comment._id}/like`, {
        method: "POST",
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
    } catch {
      setLiked(wasLiked);
      setLikeCount(c => wasLiked ? c + 1 : c - 1);
    }
  }, [liked, currentUser, videoId, comment._id, getToken]);

  const handleReply = useCallback(async (e) => {
    e?.stopPropagation();
    if (!replyText.trim() || sending || !currentUser) return;
    setSending(true);
    const tempId    = `temp-${Date.now()}`;
    const tempReply = { _id: tempId, text: replyText.trim(), user: currentUser, createdAt: new Date().toISOString(), likes: [] };
    setReplies(prev => [...prev, tempReply]);
    setReplyText(""); setShowReply(false); setShowReplies(true);
    try {
      const token = getToken ? await getToken() : null;
      const res = await fetch(`${API_URL}/videos/${videoId}/comment/${comment._id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ text: tempReply.text }),
      });
      if (res.ok) {
        const data = await res.json();
        setReplies(prev => prev.map(r => r._id === tempId ? (data.reply || tempReply) : r));
      }
    } catch {
      setReplies(prev => prev.filter(r => r._id !== tempId));
    } finally {
      setSending(false);
    }
  }, [replyText, sending, currentUser, videoId, comment._id, getToken]);

  // 🔥 FIX : lire user || uploadedBy pour les commentaires aussi
  const cUser      = comment.user || comment.uploadedBy;
  const authorName = cUser?.username || cUser?.fullName || "Utilisateur";

  return (
    <div
      className={`flex gap-2.5 ${depth > 0 ? "ml-10 mt-2" : ""}`}
      onPointerDown={e => e.stopPropagation()}
      onTouchStart={e => e.stopPropagation()}
    >
      <UserAvatar user={cUser} size="w-8 h-8" />
      <div className="flex-1 min-w-0">
        <div className="bg-gray-800/60 rounded-2xl rounded-tl-sm px-3 py-2">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-white text-xs font-bold truncate">{authorName}</span>
            <span className="text-gray-500 text-[10px] shrink-0">{formatDate(comment.createdAt)}</span>
          </div>
          <p className="text-gray-200 text-sm leading-relaxed break-words">
            {comment.text || comment.content}
          </p>
        </div>

        <div className="flex items-center gap-4 mt-1 ml-2">
          <button onClick={handleLike}
            className={`flex items-center gap-1 text-xs transition-colors ${liked ? "text-red-400" : "text-gray-500 hover:text-red-400"}`}>
            {liked ? <FaHeart className="text-[11px]" /> : <FaRegHeart className="text-[11px]" />}
            {likeCount > 0 && <span>{likeCount}</span>}
          </button>

          {depth === 0 && (
            <button onClick={(e) => { e.stopPropagation(); setShowReply(v => !v); }}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-400 transition-colors">
              <FaReply className="text-[11px]" />
              <span>Répondre</span>
            </button>
          )}

          {depth === 0 && replies.length > 0 && (
            <button onClick={(e) => { e.stopPropagation(); setShowReplies(v => !v); }}
              className="text-xs text-blue-400 hover:text-blue-300">
              {showReplies ? "Masquer" : `${replies.length} réponse${replies.length > 1 ? "s" : ""}`}
            </button>
          )}
        </div>

        <AnimatePresence>
          {showReply && (
            <motion.div
              initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mt-2"
              onPointerDown={e => e.stopPropagation()}
              onTouchStart={e => e.stopPropagation()}
            >
              <div className="flex gap-2 items-center">
                <UserAvatar user={currentUser} size="w-6 h-6" />
                <div className="flex-1 flex gap-1 items-center bg-gray-700/60 rounded-full px-3 py-1.5">
                  <input
                    ref={replyInputRef}
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    onKeyDown={e => { e.stopPropagation(); if (e.key === "Enter") handleReply(e); }}
                    placeholder={`Répondre à ${authorName}…`}
                    className="flex-1 bg-transparent text-white text-xs focus:outline-none placeholder-gray-500"
                    disabled={sending}
                  />
                  <button onClick={handleReply} disabled={!replyText.trim() || sending}
                    className="text-blue-400 disabled:opacity-40 hover:text-blue-300">
                    <IoSend className="text-sm" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showReplies && replies.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mt-1 space-y-2"
            >
              {replies.map((reply, i) => (
                <CommentItem key={reply._id || i} comment={reply} videoId={videoId}
                  currentUser={currentUser} getToken={getToken} depth={1} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────
// VideoActions
// ─────────────────────────────────────────────────────────────────────
const VideoActions = ({ video }) => {
  const { user: currentUser, getToken } = useAuth();
  const { likeVideo, commentVideo, deleteVideo } = useVideos();

  const [showComments,  setShowComments]  = useState(false);
  const [showOptions,   setShowOptions]   = useState(false);
  const [newComment,    setNewComment]    = useState("");
  const [isCommenting,  setIsCommenting]  = useState(false);
  const [heartAnim,     setHeartAnim]     = useState(false);
  const [localComments, setLocalComments] = useState(video.comments || []);

  useEffect(() => { setLocalComments(video.comments || []); }, [video.comments]);

  // 🔥 FIX : lock/unlock le scroll du feed quand une modale est ouverte
  useEffect(() => {
    if (showComments || showOptions) lockFeedScroll();
    else unlockFeedScroll();
    return () => { if (showComments || showOptions) unlockFeedScroll(); };
  }, [showComments, showOptions]);

  const isLiked = useMemo(() => {
    if (!currentUser) return false;
    if (Array.isArray(video.likes)) return video.likes.some(id => id?.toString() === currentUser._id?.toString());
    return !!video.userLiked;
  }, [video.likes, video.userLiked, currentUser]);

  const likesCount = useMemo(() => {
    if (Array.isArray(video.likes)) return video.likes.length;
    return typeof video.likes === "number" ? video.likes : 0;
  }, [video.likes]);

  // 🔥 FIX : lire user || uploadedBy pour isOwner
  const videoOwnerId = video.user?._id || video.uploadedBy?._id || video.user || video.uploadedBy || video.userId;
  const isOwner      = currentUser?._id && videoOwnerId?.toString() === currentUser._id?.toString();

  const handleLike = async (e) => {
    stopAll(e);
    if (!currentUser) return alert("Connectez-vous pour aimer !");
    setHeartAnim(true);
    setTimeout(() => setHeartAnim(false), 300);
    await likeVideo(video._id);
  };

  const handleComment = async (e) => {
    e?.stopPropagation();
    if (!newComment.trim() || isCommenting || !currentUser) return;
    setIsCommenting(true);
    const tempId = `temp-${Date.now()}`;
    const tempComment = { _id: tempId, text: newComment.trim(), user: currentUser, createdAt: new Date().toISOString(), likes: [], replies: [] };
    setLocalComments(prev => [...prev, tempComment]);
    setNewComment("");
    try { await commentVideo(video._id, tempComment.text); }
    catch { setLocalComments(prev => prev.filter(c => c._id !== tempId)); }
    finally { setIsCommenting(false); }
  };

  const handleDelete = async (e) => {
    e?.stopPropagation();
    if (!window.confirm("Supprimer cette vidéo définitivement ?")) return;
    try { await deleteVideo(video._id); setShowOptions(false); }
    catch { alert("Erreur lors de la suppression"); }
  };

  const handleShare = async (e) => {
    stopAll(e);
    const url = `${window.location.origin}/videos/${video._id}`;
    if (navigator.share) { try { await navigator.share({ title: video?.title || "Vidéo", url }); } catch {} }
    else { navigator.clipboard.writeText(url); alert("Lien copié !"); }
  };

  const openComments = (e) => { stopAll(e); setShowComments(true); };
  const openOptions  = (e) => { stopAll(e); setShowOptions(true);  };

  // ── Modal Commentaires ────────────────────────────────────────────
  const commentsModal = (
    <AnimatePresence>
      {showComments && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            style={{ zIndex: 9998 }}
            onPointerDown={stopAll}
            onTouchStart={stopAll}
            onClick={() => setShowComments(false)}
          />
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="fixed bottom-0 left-0 right-0 bg-gray-900 rounded-t-3xl flex flex-col shadow-2xl border-t border-gray-800"
            style={{ zIndex: 9999, height: "72vh" }}
            onPointerDown={e => e.stopPropagation()}
            onTouchStart={e => e.stopPropagation()}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
              <span className="font-bold text-white text-sm">
                {localComments.length} commentaire{localComments.length !== 1 ? "s" : ""}
              </span>
              <button onClick={() => setShowComments(false)}
                className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white text-base">✕</button>
            </div>

            {/* Liste */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4"
              onPointerDown={e => e.stopPropagation()}
              onTouchStart={e => e.stopPropagation()}
            >
              {localComments.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-3">
                  <FaComment className="text-5xl opacity-20" />
                  <p className="text-sm">Sois le premier à commenter !</p>
                </div>
              ) : (
                localComments.map((comment, idx) => (
                  <CommentItem
                    key={comment._id || idx}
                    comment={comment}
                    videoId={video._id}
                    currentUser={currentUser}
                    getToken={getToken}
                  />
                ))
              )}
            </div>

            {/* Input */}
            <div className="px-4 py-3 border-t border-gray-800 bg-gray-900/95"
              onPointerDown={e => e.stopPropagation()}
              onTouchStart={e => e.stopPropagation()}
            >
              {currentUser ? (
                <div className="flex gap-2.5 items-center">
                  <UserAvatar user={currentUser} size="w-8 h-8" />
                  <div className="flex-1 flex items-center gap-2 bg-gray-800 rounded-full px-4 py-2">
                    <input
                      value={newComment}
                      onChange={e => setNewComment(e.target.value)}
                      onKeyDown={e => { e.stopPropagation(); if (e.key === "Enter") handleComment(e); }}
                      placeholder="Ajouter un commentaire…"
                      className="flex-1 bg-transparent text-white text-sm focus:outline-none placeholder-gray-500"
                      disabled={isCommenting}
                      autoFocus
                    />
                    <button onClick={handleComment} disabled={!newComment.trim() || isCommenting}
                      className={`transition-all shrink-0 ${newComment.trim() ? "text-orange-400 hover:text-orange-300" : "text-gray-600"}`}>
                      {isCommenting
                        ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        : <IoSend className="text-base" />
                      }
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-center text-gray-500 text-sm py-1">
                  <span className="text-orange-400 font-semibold">Connectez-vous</span> pour commenter
                </p>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  // ── Modal Options ─────────────────────────────────────────────────
  const optionsModal = (
    <AnimatePresence>
      {showOptions && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            style={{ zIndex: 9998 }}
            onPointerDown={stopAll}
            onTouchStart={stopAll}
            onClick={() => setShowOptions(false)}
          />
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="fixed bottom-0 left-0 right-0 bg-gray-900 rounded-t-3xl overflow-hidden shadow-2xl border-t border-gray-800"
            style={{ zIndex: 9999 }}
            onPointerDown={e => e.stopPropagation()}
            onTouchStart={e => e.stopPropagation()}
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-gray-600 rounded-full mx-auto mt-3 mb-4" />

            <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/videos/${video._id}`); alert("Lien copié !"); setShowOptions(false); }}
              className="flex items-center gap-4 px-6 py-4 hover:bg-gray-800 text-white w-full transition-colors">
              <div className="w-9 h-9 rounded-full bg-blue-500/20 flex items-center justify-center"><FaLink className="text-blue-400" /></div>
              <span className="font-medium">Copier le lien</span>
            </button>

            <button onClick={() => { alert("Sauvegardé !"); setShowOptions(false); }}
              className="flex items-center gap-4 px-6 py-4 hover:bg-gray-800 text-white w-full transition-colors">
              <div className="w-9 h-9 rounded-full bg-yellow-500/20 flex items-center justify-center"><FaBookmark className="text-yellow-400" /></div>
              <span className="font-medium">Enregistrer</span>
            </button>

            {isOwner && (
              <button onClick={handleDelete}
                className="flex items-center gap-4 px-6 py-4 hover:bg-red-500/10 text-red-400 w-full transition-colors">
                <div className="w-9 h-9 rounded-full bg-red-500/20 flex items-center justify-center"><FaTrash className="text-red-400" /></div>
                <span className="font-medium">Supprimer la vidéo</span>
              </button>
            )}

            {!isOwner && (
              <button onClick={() => { alert("Signalé !"); setShowOptions(false); }}
                className="flex items-center gap-4 px-6 py-4 hover:bg-gray-800 text-orange-400 w-full transition-colors">
                <div className="w-9 h-9 rounded-full bg-orange-500/20 flex items-center justify-center"><FaFlag className="text-orange-400" /></div>
                <span className="font-medium">Signaler</span>
              </button>
            )}

            <button onClick={() => setShowOptions(false)}
              className="w-full py-4 mb-2 text-gray-400 hover:text-white text-sm font-medium transition-colors">
              Annuler
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  return (
    <>
      {/* 🔥 FIX : onPointerDown + onTouchStart bloqués sur toute la barre d'actions
          pour empêcher les events de remonter au scroll container */}
      <div
        className="absolute right-3 bottom-20 flex flex-col items-center gap-5 z-40"
        onPointerDown={e => e.stopPropagation()}
        onTouchStart={e => e.stopPropagation()}
      >
        {/* Like */}
        <div className="flex flex-col items-center gap-1">
          <motion.button onClick={handleLike} whileTap={{ scale: 0.75 }}
            className={`w-11 h-11 rounded-full flex items-center justify-center shadow-xl transition-all ${
              isLiked ? "bg-gradient-to-br from-red-500 to-pink-600" : "bg-black/40 backdrop-blur-md border border-white/20"
            }`}>
            <FaHeart className={`text-white text-xl ${heartAnim ? "animate-ping" : ""}`} />
          </motion.button>
          <span className="text-white text-xs font-bold drop-shadow-md">{formatNumber(likesCount)}</span>
        </div>

        {/* Commentaires */}
        <div className="flex flex-col items-center gap-1">
          <motion.button onClick={openComments} whileTap={{ scale: 0.85 }}
            className="w-11 h-11 bg-black/40 backdrop-blur-md border border-white/20 rounded-full flex items-center justify-center shadow-xl">
            <FaComment className="text-white text-xl" />
          </motion.button>
          <span className="text-white text-xs font-bold drop-shadow-md">{formatNumber(localComments.length)}</span>
        </div>

        {/* Partager */}
        <div className="flex flex-col items-center gap-1">
          <motion.button onClick={handleShare} whileTap={{ scale: 0.85 }}
            className="w-11 h-11 bg-black/40 backdrop-blur-md border border-white/20 rounded-full flex items-center justify-center shadow-xl">
            <FaShare className="text-white text-xl" />
          </motion.button>
          <span className="text-white text-xs font-bold drop-shadow-md">Partager</span>
        </div>

        {/* Options */}
        <motion.button onClick={openOptions} whileTap={{ scale: 0.85 }}
          className="w-9 h-9 mt-1 bg-black/40 backdrop-blur-md border border-white/20 rounded-full flex items-center justify-center shadow-xl">
          <HiDotsVertical className="text-white text-lg" />
        </motion.button>
      </div>

      {createPortal(commentsModal, document.body)}
      {createPortal(optionsModal,  document.body)}
    </>
  );
};

export default React.memo(VideoActions);