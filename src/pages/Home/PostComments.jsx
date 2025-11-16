// src/components/PostComments.jsx - VERSION COMPLÈTE AVEC EMOJI PICKER VISIBLE
import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TrashIcon } from "@heroicons/react/24/outline";
import EmojiPicker from "emoji-picker-react";
import SimpleAvatar from "./SimpleAvatar";
import { useDarkMode } from "../../context/DarkModeContext";

const PostComments = ({
  postId,
  comments,
  setComments,
  currentUser,
  getToken,
  showToast,
  saveCommentsDebounced,
  navigate
}) => {
  const { isDarkMode } = useDarkMode();
  const [newComment, setNewComment] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [loadingComment, setLoadingComment] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState(null);
  
  const emojiPickerRef = useRef(null);
  const base = import.meta.env.VITE_API_URL || "http://localhost:5000";

  // Fermer emoji picker au clic extérieur
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target)) {
        setShowEmojiPicker(false);
      }
    };

    if (showEmojiPicker) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showEmojiPicker]);

  const handleAddComment = async () => {
    if (!currentUser) return showToast?.("Connectez-vous pour commenter", "error");
    if (!newComment.trim()) return showToast?.("Le commentaire est vide", "error");

    const commentContent = newComment.trim();
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // ✅ Commentaire optimiste avec ID STABLE
    const optimisticComment = {
      _id: tempId,
      content: commentContent,
      user: {
        _id: currentUser._id,
        fullName: currentUser.fullName || currentUser.username || currentUser.email?.split('@')[0],
        profilePhoto: currentUser.profilePhoto || null,
        isVerified: currentUser.isVerified || false,
        isPremium: currentUser.isPremium || false
      },
      createdAt: new Date().toISOString(),
      isOptimistic: true // Marqueur pour identifier les commentaires temporaires
    };

    // ✅ Mise à jour optimiste immédiate
    const updatedComments = [...comments, optimisticComment];
    setComments(updatedComments);
    setNewComment("");
    setShowEmojiPicker(false);
    setLoadingComment(true);

    try {
      const token = await getToken();
      if (!token) throw new Error("Non authentifié");

      const res = await fetch(`${base}/api/posts/${postId}/comment`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ content: commentContent }),
        credentials: "include"
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || `Erreur ${res.status}`);
      }

      const responseData = await res.json();
      const savedComment = responseData.data || responseData;
      
      // ✅ Remplacer le commentaire optimiste PAR SON INDEX (plus stable)
      const finalComments = comments.concat([savedComment]);
      
      setComments(finalComments);
      saveCommentsDebounced(finalComments);
      showToast?.("✅ Commentaire ajouté", "success");

    } catch (err) {
      console.error("❌ Erreur commentaire:", err);
      
      // ✅ Rollback en supprimant le commentaire temporaire
      const rolledBack = comments.filter(c => c._id !== tempId);
      setComments(rolledBack);
      saveCommentsDebounced(rolledBack);
      setNewComment(commentContent);
      showToast?.(err.message || "Erreur lors de l'ajout du commentaire", "error");
    } finally {
      setLoadingComment(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm("Supprimer ce commentaire ?")) return;
    
    setDeletingCommentId(commentId);

    // ✅ Suppression optimiste
    const updatedComments = comments.filter(c => c._id !== commentId);
    setComments(updatedComments);

    try {
      const token = await getToken();
      if (!token) throw new Error("Non authentifié");

      const res = await fetch(`${base}/api/posts/${postId}/comment/${commentId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include"
      });

      if (!res.ok) throw new Error("Erreur suppression");

      saveCommentsDebounced(updatedComments);
      showToast?.("✅ Commentaire supprimé", "success");
      
    } catch (err) {
      console.error("❌ Erreur suppression commentaire:", err);
      
      // ✅ Rollback - remettre tous les commentaires
      setComments(comments);
      saveCommentsDebounced(comments);
      showToast?.(err.message || "Erreur suppression", "error");
    } finally {
      setDeletingCommentId(null);
    }
  };

  const onEmojiClick = useCallback((emojiObject) => {
    setNewComment(prev => prev + emojiObject.emoji);
  }, []);

  // ✅ Fonction pour générer une clé stable
  const getCommentKey = useCallback((comment) => {
    // Utiliser l'ID, ou un hash du contenu + timestamp si c'est un temp
    if (comment._id && !comment._id.startsWith('temp-')) {
      return comment._id;
    }
    // Pour les commentaires optimistes, utiliser une combinaison stable
    return `${comment._id}-${comment.createdAt}`;
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0, height: 0 }} 
      animate={{ opacity: 1, height: "auto" }} 
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
      className={`space-y-2 mt-2 max-h-60 overflow-y-auto rounded-xl p-3 ${
        isDarkMode ? 'bg-gray-900/50' : 'bg-gray-50'
      }`}
    >
      <AnimatePresence mode="popLayout">
        {comments.map(c => {
          const commentUser = c.user || {
            _id: c.userId || "unknown",
            fullName: c.fullName || "Utilisateur",
            profilePhoto: c.profilePhoto || null,
            isVerified: false,
            isPremium: false
          };

          if (c.user) {
            commentUser.isVerified = c.user.isVerified || false;
            commentUser.isPremium = c.user.isPremium || false;
          }

          // ✅ Clé stable pour éviter les erreurs DOM
          const commentKey = getCommentKey(c);

          return (
            <motion.div 
              key={commentKey}
              layout
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20, height: 0 }}
              transition={{ duration: 0.2, layout: { duration: 0.2 } }}
              className="flex items-start gap-2 group"
            >
              <button
                onClick={() => {
                  if (commentUser._id && commentUser._id !== 'unknown') {
                    navigate(`/profile/${commentUser._id}`);
                  }
                }}
                className="flex-shrink-0 hover:scale-105 transition-transform"
              >
                <SimpleAvatar
                  username={commentUser.fullName}
                  profilePhoto={commentUser.profilePhoto}
                  size={32}
                />
              </button>

              <div className={`rounded-xl px-3 py-2 flex-1 shadow-sm border ${
                isDarkMode 
                  ? 'bg-gray-800 border-gray-700' 
                  : 'bg-white border-gray-200'
              } ${c.isOptimistic ? 'opacity-70' : ''}`}>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <button
                    onClick={() => {
                      if (commentUser._id && commentUser._id !== 'unknown') {
                        navigate(`/profile/${commentUser._id}`);
                      }
                    }}
                    className={`text-sm font-semibold hover:text-orange-600 transition text-left hover:underline ${
                      isDarkMode ? 'text-gray-100' : 'text-gray-800'
                    }`}
                    disabled={!commentUser._id || commentUser._id === 'unknown'}
                  >
                    {commentUser.fullName}
                  </button>
                  {c.isOptimistic && (
                    <span className="text-xs text-gray-500 italic">Envoi...</span>
                  )}
                </div>

                <p className={`text-sm break-words leading-relaxed ${
                  isDarkMode ? 'text-gray-200' : 'text-gray-700'
                }`}>
                  {c.content}
                </p>
              </div>

              {currentUser && currentUser._id === commentUser._id && !c.isOptimistic && (
                <button
                  onClick={() => handleDeleteComment(c._id)}
                  disabled={deletingCommentId === c._id}
                  className={`opacity-0 group-hover:opacity-100 transition text-red-500 p-1.5 rounded-full disabled:opacity-50 flex-shrink-0 ${
                    isDarkMode ? 'hover:bg-red-900/30' : 'hover:bg-red-50'
                  }`}
                  title="Supprimer ce commentaire"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Zone d'ajout de commentaire */}
      <div className={`relative space-y-2 pt-2 border-t ${
        isDarkMode ? 'border-gray-700' : 'border-gray-200'
      }`}>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Ajouter un commentaire..."
            className={`flex-1 border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition ${
              isDarkMode 
                ? 'bg-gray-800 border-gray-700 text-gray-100 placeholder-gray-500' 
                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
            }`}
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleAddComment()}
            disabled={loadingComment}
          />
          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className={`text-2xl hover:scale-110 transition flex-shrink-0 p-2 rounded-xl ${
              showEmojiPicker 
                ? isDarkMode 
                  ? 'bg-orange-500/20 ring-2 ring-orange-500' 
                  : 'bg-orange-100 ring-2 ring-orange-400'
                : isDarkMode
                ? 'hover:bg-gray-700'
                : 'hover:bg-gray-100'
            }`}
            title="Ajouter un emoji"
          >
            😊
          </button>
          <button 
            onClick={handleAddComment} 
            disabled={loadingComment || !newComment.trim()} 
            className="bg-orange-500 text-white px-3 py-2 rounded-xl hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium text-sm flex-shrink-0"
          >
            {loadingComment ? "..." : "Envoyer"}
          </button>
        </div>

        <AnimatePresence>
          {showEmojiPicker && (
            <motion.div 
              ref={emojiPickerRef} 
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              transition={{ duration: 0.2 }}
              className="absolute bottom-full mb-2 right-0 z-[9999] shadow-2xl rounded-xl overflow-hidden border-2"
              style={{
                borderColor: isDarkMode ? 'rgba(249, 115, 22, 0.3)' : 'rgba(249, 115, 22, 0.2)',
                boxShadow: isDarkMode 
                  ? '0 20px 50px rgba(0, 0, 0, 0.8), 0 0 20px rgba(249, 115, 22, 0.2)' 
                  : '0 20px 50px rgba(0, 0, 0, 0.3)'
              }}
            >
              <EmojiPicker 
                onEmojiClick={onEmojiClick} 
                theme={isDarkMode ? "dark" : "light"}
                width={320}
                height={420}
                searchDisabled={false}
                skinTonesDisabled={false}
                previewConfig={{ showPreview: false }}
                emojiStyle="native"
                lazyLoadEmojis={false}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default PostComments;
