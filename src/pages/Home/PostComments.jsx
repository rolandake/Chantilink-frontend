// src/pages/Home/PostComments.jsx
// ✅ PLEIN ÉCRAN TOTAL — inset-0 mobile / inset-6 desktop
// ✅ Layout 2 colonnes desktop (media | comments)
// ✅ AJOUTER un commentaire
// ✅ LIKER un commentaire
// ✅ RÉPONDRE à un commentaire (threads imbriqués)
// ✅ SUPPRIMER son commentaire / sa réponse
// ✅ Keyboard-aware iOS/Android (visualViewport)
// ✅ Portal → z-index propre, hors de tout contain

import React, {
  useState, useRef, useEffect, useCallback, useMemo, memo
} from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  XMarkIcon, HeartIcon, TrashIcon, PaperAirplaneIcon,
  ChevronLeftIcon, ChevronDownIcon, ChevronUpIcon
} from "@heroicons/react/24/outline";
import { HeartIcon as HeartSolid, CheckBadgeIcon } from "@heroicons/react/24/solid";
import EmojiPicker from "emoji-picker-react";
import { useDarkMode } from "../../context/DarkModeContext";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

// ─────────────────────────────────────────────
// AVATAR
// ─────────────────────────────────────────────
const Avatar = memo(({ username, profilePhoto, size = 36, onClick }) => {
  const [error, setError] = useState(false);

  const initials = useMemo(() => {
    if (!username) return "?";
    const p = username.trim().split(" ");
    return p.length > 1 ? (p[0][0] + p[1][0]).toUpperCase() : username.substring(0, 2).toUpperCase();
  }, [username]);

  const bg = useMemo(() => {
    const colors = ["#f97316","#ef4444","#8b5cf6","#3b82f6","#10b981","#f59e0b","#ec4899","#6366f1"];
    let h = 0;
    for (let i = 0; i < (username || "").length; i++) h = username.charCodeAt(i) + ((h << 5) - h);
    return colors[Math.abs(h) % colors.length];
  }, [username]);

  const Wrap = onClick ? "button" : "div";

  if (error || !profilePhoto) {
    return (
      <Wrap onClick={onClick} className="rounded-full flex items-center justify-center text-white font-bold select-none flex-shrink-0"
        style={{ width: size, height: size, backgroundColor: bg, fontSize: size * 0.38 }}>
        {initials}
      </Wrap>
    );
  }

  return (
    <Wrap onClick={onClick} className="rounded-full overflow-hidden flex-shrink-0 bg-gray-200"
      style={{ width: size, height: size }}>
      <img src={profilePhoto} alt={username} className="w-full h-full object-cover"
        onError={() => setError(true)} loading="lazy" />
    </Wrap>
  );
});
Avatar.displayName = "Avatar";

// ─────────────────────────────────────────────
// TIME AGO
// ─────────────────────────────────────────────
const timeAgo = (date) => {
  if (!date) return "";
  const diff = Date.now() - new Date(date);
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1) return "maintenant";
  if (m < 60) return `${m}m`;
  if (h < 24) return `${h}h`;
  if (d < 7)  return `${d}j`;
  return new Date(date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
};

// ─────────────────────────────────────────────
// REPLY ROW — réponse imbriquée
// ─────────────────────────────────────────────
const ReplyRow = memo(({ reply, currentUser, isDarkMode, onLike, onDelete, onNavigate, isReacting, isDeleting }) => {
  const user = reply.user || {};
  const isMe = currentUser && (user._id === currentUser._id);
  const likes = Array.isArray(reply.likes) ? reply.likes : [];
  const hasLiked = currentUser && likes.some(id =>
    (typeof id === "object" ? id._id : id) === currentUser._id
  );

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: reply.isOptimistic ? 0.55 : 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`flex gap-2.5 pl-12 pr-3 py-2 group rounded-xl mx-2 transition-colors
        ${isDarkMode ? "hover:bg-white/[0.025]" : "hover:bg-gray-50"}`}
    >
      <Avatar
        username={user.fullName || "User"}
        profilePhoto={user.profilePhoto}
        size={28}
        onClick={() => user._id && onNavigate?.(`/profile/${user._id}`)}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {/* Nom de la personne à qui on répond (mention @) */}
            {reply.replyTo && (
              <span className="text-[13px] font-semibold text-orange-500 mr-1.5">
                @{reply.replyTo}
              </span>
            )}
            <button
              onClick={() => user._id && onNavigate?.(`/profile/${user._id}`)}
              className={`text-[13px] font-bold mr-1.5 hover:underline ${isDarkMode ? "text-white" : "text-gray-900"}`}
            >
              {user.fullName || "Utilisateur"}
            </button>
            <span className={`text-[13px] break-words leading-relaxed ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>
              {reply.content}
            </span>
          </div>

          {/* Like */}
          {!reply.isOptimistic && (
            <button
              onClick={() => onLike(reply._id)}
              disabled={isReacting}
              className="flex flex-col items-center gap-0.5 flex-shrink-0 active:scale-90 transition-transform"
            >
              {hasLiked
                ? <HeartSolid className="w-3.5 h-3.5 text-red-500" />
                : <HeartIcon className={`w-3.5 h-3.5 ${isDarkMode ? "text-gray-600" : "text-gray-300"}`} />
              }
              {likes.length > 0 && (
                <span className={`text-[10px] font-bold leading-none ${hasLiked ? "text-red-500" : isDarkMode ? "text-gray-600" : "text-gray-400"}`}>
                  {likes.length}
                </span>
              )}
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 mt-1">
          <span className={`text-[11px] ${isDarkMode ? "text-gray-600" : "text-gray-400"}`}>
            {reply.isOptimistic ? "Envoi..." : timeAgo(reply.createdAt)}
          </span>
          {isMe && !reply.isOptimistic && (
            <button
              onClick={() => onDelete(reply._id)}
              disabled={isDeleting}
              className="text-[11px] text-red-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1"
            >
              <TrashIcon className="w-3 h-3" /> Supprimer
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
});
ReplyRow.displayName = "ReplyRow";

// ─────────────────────────────────────────────
// COMMENT ROW — commentaire principal
// ─────────────────────────────────────────────
const CommentRow = memo(({
  comment, currentUser, isDarkMode,
  onLike, onDelete, onReply, onNavigate,
  isReacting, isDeleting,
  replyingToId, // id du commentaire sur lequel on répond en ce moment
}) => {
  const user = comment.user || {};
  const isMe = currentUser && (user._id === currentUser._id);
  const likes = Array.isArray(comment.likes) ? comment.likes : [];
  const hasLiked = currentUser && likes.some(id =>
    (typeof id === "object" ? id._id : id) === currentUser._id
  );
  const replies = Array.isArray(comment.replies) ? comment.replies : [];
  const [showReplies, setShowReplies] = useState(false);
  const [reactingReplyId, setReactingReplyId] = useState(null);
  const [deletingReplyId, setDeletingReplyId] = useState(null);
  const isReplying = replyingToId === comment._id;

  return (
    <div className="mb-1">
      {/* Commentaire principal */}
      <motion.div
        layout="position"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: comment.isOptimistic ? 0.55 : 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className={`flex gap-3 px-4 py-3 mx-2 rounded-xl group transition-colors
          ${isDarkMode ? "hover:bg-white/[0.03]" : "hover:bg-gray-50"}
          ${isReplying ? (isDarkMode ? "bg-orange-500/10 border border-orange-500/20" : "bg-orange-50 border border-orange-200") : ""}
        `}
      >
        <Avatar
          username={user.fullName || "User"}
          profilePhoto={user.profilePhoto}
          size={40}
          onClick={() => user._id && onNavigate?.(`/profile/${user._id}`)}
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <button
                onClick={() => user._id && onNavigate?.(`/profile/${user._id}`)}
                className={`text-[14px] font-bold mr-2 hover:underline ${isDarkMode ? "text-white" : "text-gray-900"}`}
              >
                {user.fullName || "Utilisateur"}
              </button>
              <span className={`text-[14px] break-words leading-relaxed ${isDarkMode ? "text-gray-200" : "text-gray-700"}`}>
                {comment.content}
              </span>
            </div>

            {/* Like commentaire */}
            {!comment.isOptimistic && (
              <button
                onClick={() => onLike(comment._id)}
                disabled={isReacting}
                className="flex flex-col items-center gap-0.5 flex-shrink-0 pt-0.5 active:scale-90 transition-transform"
              >
                {hasLiked
                  ? <HeartSolid className="w-4 h-4 text-red-500" />
                  : <HeartIcon className={`w-4 h-4 ${isDarkMode ? "text-gray-600" : "text-gray-300"}`} />
                }
                {likes.length > 0 && (
                  <span className={`text-[11px] font-bold leading-none ${hasLiked ? "text-red-500" : isDarkMode ? "text-gray-600" : "text-gray-400"}`}>
                    {likes.length}
                  </span>
                )}
              </button>
            )}
          </div>

          {/* Actions sous le commentaire */}
          <div className="flex items-center gap-4 mt-1.5">
            <span className={`text-[12px] ${isDarkMode ? "text-gray-600" : "text-gray-400"}`}>
              {comment.isOptimistic ? "Envoi..." : timeAgo(comment.createdAt)}
            </span>

            {/* Bouton Répondre */}
            {!comment.isOptimistic && (
              <button
                onClick={() => onReply(comment._id, user.fullName)}
                className={`text-[12px] font-bold transition-colors
                  ${isReplying
                    ? "text-orange-500"
                    : isDarkMode ? "text-gray-500 hover:text-orange-400" : "text-gray-400 hover:text-orange-500"
                  }`}
              >
                {isReplying ? "✓ En cours…" : "Répondre"}
              </button>
            )}

            {/* Supprimer */}
            {isMe && !comment.isOptimistic && (
              <button
                onClick={() => onDelete(comment._id)}
                disabled={isDeleting}
                className="text-[12px] text-red-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1"
              >
                <TrashIcon className="w-3 h-3" /> Supprimer
              </button>
            )}
          </div>

          {/* Afficher/Masquer les réponses */}
          {replies.length > 0 && (
            <button
              onClick={() => setShowReplies(v => !v)}
              className={`flex items-center gap-1.5 mt-2 text-[12px] font-semibold transition-colors
                ${isDarkMode ? "text-gray-500 hover:text-gray-300" : "text-gray-400 hover:text-gray-700"}`}
            >
              <span className={`w-8 h-px ${isDarkMode ? "bg-gray-700" : "bg-gray-300"}`} />
              {showReplies
                ? <><ChevronUpIcon className="w-3 h-3" /> Masquer les réponses</>
                : <><ChevronDownIcon className="w-3 h-3" /> {replies.length} réponse{replies.length > 1 ? "s" : ""}</>
              }
            </button>
          )}
        </div>
      </motion.div>

      {/* Réponses imbriquées */}
      <AnimatePresence>
        {showReplies && replies.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <AnimatePresence mode="popLayout" initial={false}>
              {replies.map(reply => (
                <ReplyRow
                  key={reply._id || reply.tempId}
                  reply={reply}
                  currentUser={currentUser}
                  isDarkMode={isDarkMode}
                  onLike={async (replyId) => {
                    setReactingReplyId(replyId);
                    await onLike(replyId, comment._id);
                    setReactingReplyId(null);
                  }}
                  onDelete={async (replyId) => {
                    setDeletingReplyId(replyId);
                    await onDelete(replyId, comment._id);
                    setDeletingReplyId(null);
                  }}
                  onNavigate={onNavigate}
                  isReacting={reactingReplyId === reply._id}
                  isDeleting={deletingReplyId === reply._id}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
CommentRow.displayName = "CommentRow";

// ─────────────────────────────────────────────
// COLONNE GAUCHE — media + infos (desktop)
// ─────────────────────────────────────────────
const MediaColumn = memo(({ postUser, postContent, postMediaUrl, likesCount, isDarkMode, onNavigate }) => (
  <div className="flex flex-col h-full overflow-hidden">
    <div className="flex-1 min-h-0 bg-black flex items-center justify-center overflow-hidden">
      {postMediaUrl
        ? <img src={postMediaUrl} alt="" className="w-full h-full object-contain" loading="eager" />
        : <div className="text-6xl opacity-10">📷</div>
      }
    </div>
    <div className={`flex-shrink-0 p-5 border-t ${isDarkMode ? "bg-[#0a0a0a] border-gray-800" : "bg-white border-gray-100"}`}>
      {postUser && (
        <button
          className="flex items-center gap-3 mb-3 hover:opacity-75 transition-opacity w-full text-left"
          onClick={() => postUser._id && onNavigate?.(`/profile/${postUser._id}`)}
        >
          <Avatar username={postUser.fullName} profilePhoto={postUser.profilePhoto} size={38} />
          <div className="flex items-center gap-1.5">
            <span className={`text-[15px] font-bold ${isDarkMode ? "text-white" : "text-gray-900"}`}>{postUser.fullName}</span>
            {postUser.isVerified && <CheckBadgeIcon className="w-4 h-4 text-orange-500" />}
          </div>
        </button>
      )}
      {postContent && (
        <p className={`text-[14px] leading-relaxed line-clamp-4 mb-3 ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>
          {postContent}
        </p>
      )}
      {likesCount > 0 && (
        <div className="flex items-center gap-2">
          <HeartSolid className="w-4 h-4 text-red-500" />
          <span className={`text-[13px] font-semibold ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
            {likesCount.toLocaleString()} j'aime{likesCount > 1 ? "s" : ""}
          </span>
        </div>
      )}
    </div>
  </div>
));
MediaColumn.displayName = "MediaColumn";

// ─────────────────────────────────────────────
// MODAL PRINCIPAL
// ─────────────────────────────────────────────
const PostCommentsModal = ({
  isOpen, onClose,
  postId, postUser, postContent, postMediaUrl, likesCount = 0,
  comments = [], setComments,
  currentUser, getToken, showToast, navigate,
  isMockPost = false,
}) => {
  const { isDarkMode } = useDarkMode();

  // State saisie
  const [text,         setText]         = useState("");
  const [showEmoji,    setShowEmoji]     = useState(false);
  const [sending,      setSending]       = useState(false);
  const [viewportH,    setViewportH]     = useState("100dvh");

  // State réponse active : { commentId, username }
  const [replyTarget, setReplyTarget] = useState(null);

  // Refs
  const listRef  = useRef(null);
  const inputRef = useRef(null);

  const safeComments = useMemo(() =>
    Array.isArray(comments) ? comments.filter(c => c && (c._id || c.tempId)) : [],
    [comments]
  );

  // ── Body lock ──
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  // ── Keyboard-aware (iOS) ──
  useEffect(() => {
    if (!isOpen) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setViewportH(`${vv.height}px`);
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    update();
    return () => { vv.removeEventListener("resize", update); vv.removeEventListener("scroll", update); };
  }, [isOpen]);

  // ── Focus input quand on active une réponse ──
  useEffect(() => {
    if (replyTarget) {
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [replyTarget]);

  // ── Scroll bas après nouveau commentaire ──
  useEffect(() => {
    if (!isOpen || !listRef.current) return;
    const t = setTimeout(() =>
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }), 150);
    return () => clearTimeout(t);
  }, [safeComments.length, isOpen]);

  // ─────────────────────────────────────────────
  // ENVOYER (commentaire ou réponse)
  // ─────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    if (!currentUser) return showToast?.("Connectez-vous pour commenter", "error");
    const content = text.trim();
    if (!content) return;

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const optimistic = {
      _id: tempId,
      content,
      user: {
        _id: currentUser._id,
        fullName: currentUser.fullName || "Moi",
        profilePhoto: currentUser.profilePhoto,
      },
      createdAt: new Date().toISOString(),
      isOptimistic: !isMockPost,
      likes: [],
      replies: [],
    };

    const currentReplyTarget = replyTarget; // capture avant reset

    if (currentReplyTarget) {
      // C'est une réponse → on l'insère dans les replies du commentaire parent
      const replyOptimistic = {
        ...optimistic,
        replyTo: currentReplyTarget.username,
      };
      setComments(prev => prev.map(c =>
        c._id === currentReplyTarget.commentId
          ? { ...c, replies: [...(c.replies || []), replyOptimistic] }
          : c
      ));
    } else {
      // Commentaire principal
      setComments(prev => [...prev, optimistic]);
    }

    setText("");
    setReplyTarget(null);
    setShowEmoji(false);
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.blur();
    }

    if (isMockPost) { showToast?.("Commentaire ajouté !", "success"); return; }

    setSending(true);
    try {
      const token = await getToken();
      if (!token) throw new Error("Non authentifié");

      // Endpoint : réponse ou commentaire principal
      const endpoint = currentReplyTarget
        ? `${BASE_URL}/api/posts/${postId}/comment/${currentReplyTarget.commentId}/reply`
        : `${BASE_URL}/api/posts/${postId}/comment`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content }),
      });

      if (!res.ok) throw new Error("Erreur serveur");
      const data = await res.json();
      const saved = data.data || data;

      if (currentReplyTarget) {
        setComments(prev => prev.map(c =>
          c._id === currentReplyTarget.commentId
            ? { ...c, replies: (c.replies || []).map(r => r._id === tempId ? saved : r) }
            : c
        ));
      } else {
        setComments(prev => prev.map(c => c._id === tempId ? saved : c));
      }
    } catch {
      // Rollback
      if (currentReplyTarget) {
        setComments(prev => prev.map(c =>
          c._id === currentReplyTarget.commentId
            ? { ...c, replies: (c.replies || []).filter(r => r._id !== tempId) }
            : c
        ));
      } else {
        setComments(prev => prev.filter(c => c._id !== tempId));
      }
      setText(content);
      showToast?.("Impossible de publier", "error");
    } finally {
      setSending(false);
    }
  }, [currentUser, text, postId, isMockPost, getToken, setComments, showToast, replyTarget]);

  // ─────────────────────────────────────────────
  // SUPPRIMER (commentaire ou réponse)
  // commentId optionnel → si fourni, c'est une réponse
  // ─────────────────────────────────────────────
  const handleDelete = useCallback(async (id, parentCommentId = null) => {
    if (!window.confirm("Supprimer ce commentaire ?")) return;

    const prevComments = [...comments];

    if (parentCommentId) {
      // Supprimer une réponse
      setComments(prev => prev.map(c =>
        c._id === parentCommentId
          ? { ...c, replies: (c.replies || []).filter(r => r._id !== id) }
          : c
      ));
    } else {
      setComments(prev => prev.filter(c => c._id !== id));
    }

    if (isMockPost) { showToast?.("Commentaire supprimé", "success"); return; }

    try {
      const token = await getToken();
      const endpoint = parentCommentId
        ? `${BASE_URL}/api/posts/${postId}/comment/${parentCommentId}/reply/${id}`
        : `${BASE_URL}/api/posts/${postId}/comment/${id}`;

      const res = await fetch(endpoint, {
        method: "DELETE", headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      showToast?.("Supprimé", "success");
    } catch {
      setComments(prevComments);
      showToast?.("Erreur lors de la suppression", "error");
    }
  }, [comments, postId, isMockPost, getToken, setComments, showToast]);

  // ─────────────────────────────────────────────
  // LIKER (commentaire ou réponse)
  // ─────────────────────────────────────────────
  const handleLike = useCallback(async (id, parentCommentId = null) => {
    if (!currentUser) return showToast?.("Connectez-vous", "info");

    const toggle = (likes) => {
      const has = likes.some(l => (typeof l === "object" ? l._id : l) === currentUser._id);
      return has
        ? likes.filter(l => (typeof l === "object" ? l._id : l) !== currentUser._id)
        : [...likes, currentUser._id];
    };

    if (parentCommentId) {
      setComments(prev => prev.map(c =>
        c._id === parentCommentId
          ? { ...c, replies: (c.replies || []).map(r =>
              r._id === id ? { ...r, likes: toggle(Array.isArray(r.likes) ? r.likes : []) } : r
            )}
          : c
      ));
    } else {
      setComments(prev => prev.map(c =>
        c._id === id ? { ...c, likes: toggle(Array.isArray(c.likes) ? c.likes : []) } : c
      ));
    }

    if (isMockPost) return;

    try {
      const token = await getToken();
      const endpoint = parentCommentId
        ? `${BASE_URL}/api/posts/${postId}/comment/${parentCommentId}/reply/${id}/like`
        : `${BASE_URL}/api/posts/${postId}/comment/${id}/like`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.likes) {
        if (parentCommentId) {
          setComments(prev => prev.map(c =>
            c._id === parentCommentId
              ? { ...c, replies: (c.replies || []).map(r => r._id === id ? { ...r, likes: data.likes } : r) }
              : c
          ));
        } else {
          setComments(prev => prev.map(c => c._id === id ? { ...c, likes: data.likes } : c));
        }
      }
    } catch {
      showToast?.("Erreur réaction", "error");
    }
  }, [currentUser, postId, isMockPost, getToken, setComments, showToast]);

  // ─────────────────────────────────────────────
  // Activer le mode "répondre"
  // ─────────────────────────────────────────────
  const handleStartReply = useCallback((commentId, username) => {
    setReplyTarget(prev =>
      prev?.commentId === commentId ? null : { commentId, username }
    );
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
    if (e.key === "Escape" && replyTarget) { setReplyTarget(null); setText(""); }
  };

  const hasMedia = !!postMediaUrl;
  const placeholder = replyTarget
    ? `Répondre à @${replyTarget.username}…`
    : "Ajouter un commentaire…";

  // ─────────────────────────────────────────────
  const content = (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="bd"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[400] bg-black/85"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            key="modal"
            initial={{ opacity: 0, y: "3%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "3%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className={`fixed z-[401] flex overflow-hidden
              inset-0
              sm:inset-6 sm:rounded-2xl
              ${isDarkMode ? "bg-[#0a0a0a]" : "bg-white"}
            `}
            style={{ height: viewportH, maxHeight: "100%" }}
            onClick={e => e.stopPropagation()}
          >
            {/* ── Colonne gauche : media (desktop) ── */}
            {hasMedia && (
              <div className={`hidden sm:flex flex-col border-r flex-shrink-0 sm:w-[42%] lg:w-[50%]
                ${isDarkMode ? "border-gray-800" : "border-gray-100"}`}>
                <MediaColumn
                  postUser={postUser} postContent={postContent}
                  postMediaUrl={postMediaUrl} likesCount={likesCount}
                  isDarkMode={isDarkMode} onNavigate={navigate}
                />
              </div>
            )}

            {/* ── Colonne droite : commentaires ── */}
            <div className="flex flex-col flex-1 min-w-0 min-h-0">

              {/* Header */}
              <div className={`flex-shrink-0 flex items-center gap-3 px-4 py-3.5 border-b
                ${isDarkMode ? "border-gray-800" : "border-gray-100"}`}>
                <button onClick={onClose}
                  className={`p-2 -ml-1 rounded-full transition-colors flex-shrink-0
                    ${isDarkMode ? "hover:bg-gray-800 text-gray-400" : "hover:bg-gray-100 text-gray-500"}`}>
                  <ChevronLeftIcon className="w-5 h-5 sm:hidden" />
                  <XMarkIcon className="w-5 h-5 hidden sm:block" />
                </button>
                <h2 className={`flex-1 text-[16px] font-bold ${isDarkMode ? "text-white" : "text-gray-900"}`}>
                  Commentaires
                  {safeComments.length > 0 && (
                    <span className={`ml-2 text-[14px] font-normal ${isDarkMode ? "text-gray-500" : "text-gray-400"}`}>
                      ({safeComments.length})
                    </span>
                  )}
                </h2>
              </div>

              {/* Résumé post — mobile uniquement */}
              {(hasMedia || postContent) && (
                <div className={`sm:hidden flex-shrink-0 flex items-center gap-3 px-4 py-3 border-b
                  ${isDarkMode ? "border-gray-800 bg-black/40" : "border-gray-100 bg-gray-50/80"}`}>
                  {hasMedia && (
                    <img src={postMediaUrl} alt="" className="w-14 h-14 rounded-xl object-cover flex-shrink-0" loading="eager" />
                  )}
                  <div className="flex-1 min-w-0">
                    {postUser?.fullName && (
                      <p className={`text-[13px] font-bold truncate mb-0.5 ${isDarkMode ? "text-gray-200" : "text-gray-800"}`}>
                        {postUser.fullName}
                      </p>
                    )}
                    {postContent && (
                      <p className={`text-[12px] line-clamp-2 ${isDarkMode ? "text-gray-500" : "text-gray-500"}`}>
                        {postContent}
                      </p>
                    )}
                    {likesCount > 0 && (
                      <div className="flex items-center gap-1 mt-1">
                        <HeartSolid className="w-3 h-3 text-red-500" />
                        <span className={`text-[11px] font-semibold ${isDarkMode ? "text-gray-500" : "text-gray-400"}`}>
                          {likesCount.toLocaleString()} j'aime{likesCount > 1 ? "s" : ""}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Liste commentaires ── */}
              <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain py-2"
                style={{ WebkitOverflowScrolling: "touch" }}>
                {safeComments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full min-h-[240px] gap-4 py-10">
                    <div className={`w-20 h-20 rounded-full flex items-center justify-center text-4xl
                      ${isDarkMode ? "bg-gray-900" : "bg-gray-100"}`}>💬</div>
                    <div className="text-center px-8">
                      <p className={`text-[16px] font-bold mb-1.5 ${isDarkMode ? "text-gray-200" : "text-gray-800"}`}>
                        Aucun commentaire
                      </p>
                      <p className={`text-[13px] ${isDarkMode ? "text-gray-600" : "text-gray-400"}`}>
                        Soyez le premier à commenter !
                      </p>
                    </div>
                  </div>
                ) : (
                  <AnimatePresence mode="popLayout" initial={false}>
                    {safeComments.map(comment => (
                      <CommentRow
                        key={comment._id || comment.tempId}
                        comment={comment}
                        currentUser={currentUser}
                        isDarkMode={isDarkMode}
                        onLike={handleLike}
                        onDelete={handleDelete}
                        onReply={handleStartReply}
                        onNavigate={navigate}
                        isReacting={false}
                        isDeleting={false}
                        replyingToId={replyTarget?.commentId}
                      />
                    ))}
                  </AnimatePresence>
                )}
              </div>

              {/* ── Emoji Picker ── */}
              <AnimatePresence>
                {showEmoji && (
                  <motion.div
                    key="emoji"
                    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 12 }} transition={{ duration: 0.15 }}
                    className={`flex-shrink-0 border-t ${isDarkMode ? "border-gray-800" : "border-gray-100"}`}
                  >
                    <EmojiPicker
                      onEmojiClick={(e) => {
                        setText(prev => prev + e.emoji);
                        setShowEmoji(false);
                        inputRef.current?.focus();
                      }}
                      theme={isDarkMode ? "dark" : "light"}
                      width="100%" height={280}
                      searchDisabled={false}
                      previewConfig={{ showPreview: false }}
                      skinTonesDisabled
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Bandeau "Répondre à @X" ── */}
              <AnimatePresence>
                {replyTarget && (
                  <motion.div
                    key="reply-banner"
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }} transition={{ duration: 0.15 }}
                    className={`flex-shrink-0 flex items-center justify-between px-4 py-2 border-t
                      ${isDarkMode ? "border-gray-800 bg-orange-500/10" : "border-orange-100 bg-orange-50"}`}
                  >
                    <span className={`text-[13px] font-semibold ${isDarkMode ? "text-orange-400" : "text-orange-600"}`}>
                      ↩ Répondre à <span className="font-black">@{replyTarget.username}</span>
                    </span>
                    <button
                      onClick={() => { setReplyTarget(null); setText(""); }}
                      className={`text-[12px] font-bold ${isDarkMode ? "text-gray-500 hover:text-gray-300" : "text-gray-400 hover:text-gray-700"}`}
                    >
                      Annuler
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Zone de saisie ── */}
              <div
                className={`flex-shrink-0 px-3 py-3 border-t flex items-end gap-2
                  ${isDarkMode ? "border-gray-800 bg-[#0a0a0a]" : "border-gray-100 bg-white"}`}
                style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
              >
                {/* Avatar */}
                {currentUser && (
                  <div className="flex-shrink-0 mb-1">
                    <Avatar
                      username={currentUser.fullName || currentUser.username}
                      profilePhoto={currentUser.profilePhoto}
                      size={34}
                    />
                  </div>
                )}

                {/* Textarea */}
                <div className={`flex-1 flex items-end gap-2 rounded-2xl px-4 py-2.5 transition-all duration-150
                  ${isDarkMode
                    ? "bg-gray-900 border border-gray-800 focus-within:border-orange-500/40"
                    : "bg-gray-100 border border-transparent focus-within:border-orange-300 focus-within:bg-white"
                  }
                  ${replyTarget ? (isDarkMode ? "border-orange-500/30" : "border-orange-200") : ""}
                `}>
                  <textarea
                    ref={inputRef}
                    value={text}
                    onChange={e => {
                      setText(e.target.value);
                      e.target.style.height = "auto";
                      e.target.style.height = Math.min(e.target.scrollHeight, 100) + "px";
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    rows={1}
                    className={`flex-1 text-[14px] resize-none bg-transparent focus:outline-none leading-snug
                      ${isDarkMode ? "text-white placeholder-gray-600" : "text-gray-900 placeholder-gray-400"}`}
                    style={{ maxHeight: 100, minHeight: 22 }}
                  />
                  <button
                    onClick={() => setShowEmoji(v => !v)}
                    className={`text-xl leading-none flex-shrink-0 transition-all active:scale-90
                      ${showEmoji ? "opacity-100" : "opacity-50 hover:opacity-80"}`}
                  >
                    😊
                  </button>
                </div>

                {/* Envoyer */}
                <motion.button
                  whileTap={{ scale: 0.85 }}
                  onClick={handleSend}
                  disabled={!text.trim() || sending}
                  className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all mb-0.5
                    ${text.trim() && !sending
                      ? "bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/30"
                      : isDarkMode ? "bg-gray-800 text-gray-600" : "bg-gray-200 text-gray-400"
                    }`}
                >
                  {sending
                    ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <PaperAirplaneIcon className="w-4 h-4 translate-x-[1px]" />
                  }
                </motion.button>
              </div>

            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  return createPortal(content, document.body);
};

export default PostCommentsModal;