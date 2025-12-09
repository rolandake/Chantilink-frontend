// src/components/PostComments.jsx
import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TrashIcon, XMarkIcon } from "@heroicons/react/24/outline";
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

  // Gestion du clic extérieur pour fermer le picker
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
    if (!newComment.trim()) return; // Pas d'erreur, juste on ne fait rien

    const commentContent = newComment.trim();
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // 1. Création de l'objet optimiste
    const optimisticComment = {
      _id: tempId,
      content: commentContent,
      user: {
        _id: currentUser._id,
        fullName: currentUser.fullName || currentUser.username || "Moi",
        profilePhoto: currentUser.profilePhoto,
        isVerified: currentUser.isVerified,
        isPremium: currentUser.isPremium
      },
      createdAt: new Date().toISOString(),
      isOptimistic: true
    };

    // 2. Mise à jour immédiate de l'UI
    setComments(prev => [...prev, optimisticComment]);
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
        body: JSON.stringify({ content: commentContent })
      });

      if (!res.ok) throw new Error("Erreur serveur");

      const responseData = await res.json();
      const savedComment = responseData.data || responseData;
      
      // 3. Remplacement intelligent : On trouve le tempId et on le remplace par le vrai
      // Cela évite les doublons ou les sauts d'affichage
      const finalComments = comments.concat([savedComment]); // Fallback si state désynchronisé
      
      setComments(prev => prev.map(c => 
        c._id === tempId ? savedComment : c
      ));
      
      // Sauvegarde globale (pour le contexte parent si besoin)
      if (saveCommentsDebounced) {
        // Note: ici on utilise une version safe, mais dans l'idéal on passerait la nouvelle liste
        // saveCommentsDebounced(...) 
      }
      
      showToast?.("Commentaire publié !", "success");

    } catch (err) {
      console.error("❌ Erreur ajout commentaire:", err);
      // Rollback
      setComments(prev => prev.filter(c => c._id !== tempId));
      setNewComment(commentContent); // On remet le texte pour que l'user ne le perde pas
      showToast?.("Impossible de publier le commentaire", "error");
    } finally {
      setLoadingComment(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm("Supprimer ce commentaire ?")) return;
    
    setDeletingCommentId(commentId);
    const previousComments = [...comments]; // Copie pour rollback

    // Optimiste
    setComments(prev => prev.filter(c => c._id !== commentId));

    try {
      const token = await getToken();
      const res = await fetch(`${base}/api/posts/${postId}/comment/${commentId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) throw new Error("Erreur suppression");
      showToast?.("Commentaire supprimé", "success");

    } catch (err) {
      // Rollback
      setComments(previousComments);
      showToast?.("Erreur lors de la suppression", "error");
    } finally {
      setDeletingCommentId(null);
    }
  };

  const onEmojiClick = useCallback((emojiObject) => {
    setNewComment(prev => prev + emojiObject.emoji);
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0, height: 0 }} 
      animate={{ opacity: 1, height: "auto" }} 
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
      className={`mt-3 rounded-xl border overflow-hidden shadow-sm ${
        isDarkMode ? 'bg-gray-900 border-gray-700' : 'bg-gray-50 border-gray-200'
      }`}
    >
      {/* 
         ZONE SCROLLABLE (SEULEMENT LES COMMENTAIRES)
         Cela permet au picker (qui est en dehors) de ne pas être coupé
      */}
      <div className="max-h-60 overflow-y-auto p-3 space-y-3 custom-scrollbar">
        {comments.length === 0 && (
          <p className={`text-center text-sm py-4 italic ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
            Soyez le premier à commenter...
          </p>
        )}
        
        <AnimatePresence mode="popLayout">
          {comments.map(c => {
            const userObj = c.user || {};
            const isMe = currentUser && (userObj._id === currentUser._id || c.userId === currentUser._id);
            const isTemp = c.isOptimistic;

            return (
              <motion.div 
                key={c._id || c.tempId}
                layout
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: isTemp ? 0.7 : 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex gap-3 group"
              >
                <div 
                  className="flex-shrink-0 cursor-pointer pt-1"
                  onClick={() => userObj._id && navigate(`/profile/${userObj._id}`)}
                >
                  <SimpleAvatar
                    username={userObj.fullName || "User"}
                    profilePhoto={userObj.profilePhoto}
                    size={32}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className={`rounded-2xl rounded-tl-none px-3 py-2 ${
                    isDarkMode ? 'bg-gray-800' : 'bg-white border border-gray-200'
                  }`}>
                    <div className="flex justify-between items-start gap-2">
                      <span 
                        className={`text-sm font-bold cursor-pointer hover:underline truncate ${
                          isDarkMode ? 'text-gray-200' : 'text-gray-800'
                        }`}
                        onClick={() => userObj._id && navigate(`/profile/${userObj._id}`)}
                      >
                        {userObj.fullName || "Utilisateur"}
                      </span>
                      <span className="text-[10px] text-gray-400 whitespace-nowrap">
                        {isTemp ? "Envoi..." : new Date(c.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    
                    <p className={`text-sm whitespace-pre-wrap break-words leading-relaxed ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      {c.content}
                    </p>
                  </div>
                  
                  {/* Actions sous le commentaire */}
                  {isMe && !isTemp && (
                    <div className="flex justify-end mt-1 px-1">
                      <button
                        onClick={() => handleDeleteComment(c._id)}
                        disabled={deletingCommentId === c._id}
                        className="text-xs text-red-500 hover:text-red-600 font-medium flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <TrashIcon className="w-3 h-3" /> Supprimer
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* 
         ZONE INPUT (FIXE EN BAS)
         z-index élevé pour que l'emoji picker passe au dessus de tout
      */}
      <div className={`p-3 border-t relative z-20 ${
        isDarkMode ? 'border-gray-700 bg-gray-850' : 'border-gray-200 bg-white'
      }`}>
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleAddComment();
                }
              }}
              placeholder="Votre commentaire..."
              className={`w-full rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all custom-scrollbar ${
                isDarkMode 
                  ? 'bg-gray-800 text-white placeholder-gray-500 border-gray-700' 
                  : 'bg-gray-100 text-gray-900 placeholder-gray-400 border-transparent'
              }`}
              style={{ minHeight: "44px", maxHeight: "100px" }}
              rows={1}
            />
          </div>

          <div className="flex items-center gap-1 pb-1">
            <button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className={`p-2 rounded-full transition-colors ${
                showEmojiPicker 
                  ? 'bg-orange-100 text-orange-600' 
                  : isDarkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
              }`}
            >
              <span className="text-xl leading-none">😊</span>
            </button>
            
            <button
              onClick={handleAddComment}
              disabled={loadingComment || !newComment.trim()}
              className="p-2 rounded-full bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
            >
              {loadingComment ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 translate-x-0.5">
                  <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* EMOJI PICKER POPUP */}
        <AnimatePresence>
          {showEmojiPicker && (
            <motion.div
              ref={emojiPickerRef}
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.15 }}
              className="absolute bottom-full right-0 mb-2 z-50 origin-bottom-right"
            >
              <div className="relative shadow-2xl rounded-2xl overflow-hidden border border-gray-200/50 dark:border-gray-700/50">
                 {/* Header pour fermer sur mobile si clic outside ne marche pas */}
                 <div className={`flex justify-end p-1 ${isDarkMode ? 'bg-[#222]' : 'bg-white'} border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-100'}`}>
                    <button onClick={() => setShowEmojiPicker(false)} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full">
                       <XMarkIcon className="w-4 h-4 text-gray-500" />
                    </button>
                 </div>
                <EmojiPicker
                  onEmojiClick={onEmojiClick}
                  theme={isDarkMode ? "dark" : "light"}
                  width={300}
                  height={350}
                  searchDisabled={false}
                  previewConfig={{ showPreview: false }}
                  skinTonesDisabled
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default PostComments;