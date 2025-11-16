// FICHIER 3/3: STORYREACTIONMESSAGE.JSX - COMPOSANT COMPLET
// ═══════════════════════════════════════════════════════════

// src/components/StoryReactionMessage.jsx
import React, { useEffect } from "react";
import { motion } from "framer-motion";
import { Eye, AlertTriangle, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

/**
 * Composant pour afficher un message de réaction à une story
 * 
 * @param {Object} message - Objet message complet
 * @param {string} message._id - ID du message
 * @param {string} message.type - Type du message (doit être "story_reaction")
 * @param {Object} message.metadata - Métadonnées de la réaction
 * @param {string} message.metadata.emoji - Emoji de la réaction (ex: "❤️")
 * @param {string} message.metadata.reactorName - Nom de la personne qui a réagi
 * @param {string} message.metadata.storyId - ID de la story
 * @param {number} message.metadata.slideIndex - Index de la slide (0 par défaut)
 * @param {string} [message.metadata.storyPreview] - URL de la preview (optionnel)
 * @param {Object|string} message.sender - Objet utilisateur ou ID
 * @param {Date} message.timestamp - Date du message
 * @param {boolean} isMine - Si le message vient de l'utilisateur actuel
 * @param {Function} [onClick] - Callback au clic (optionnel)
 */
export default function StoryReactionMessage({ message, isMine, onClick }) {
  const navigate = useNavigate();
  
  // ═══════════════════════════════════════════════════════════
  // EXTRACTION DES MÉTADONNÉES AVEC FALLBACKS ROBUSTES
  // ═══════════════════════════════════════════════════════════
  
  const metadata = message.metadata || {};
  
  // Emoji de la réaction
  const emoji = metadata.emoji || "❤️";
  
  // Nom du réacteur avec plusieurs fallbacks
  const reactorName = 
    metadata.reactorName || 
    message.sender?.username || 
    message.sender?.fullName || 
    "Quelqu'un";
  
  // ID de la story (CRITIQUE pour la navigation)
  const storyId = metadata.storyId;
  
  // Index de la slide (0 par défaut)
  const slideIndex = metadata.slideIndex ?? 0;
  
  // Preview de la story (optionnel)
  const storyPreview = metadata.storyPreview;
  
  // Vérification si la story est disponible
  const isStoryAvailable = !!storyId;
  
  // ═══════════════════════════════════════════════════════════
  // LOGS DE DEBUG (à retirer en production)
  // ═══════════════════════════════════════════════════════════
  
  useEffect(() => {
    console.log('📨 [StoryReactionMessage] Rendu:', {
      messageId: message._id,
      type: message.type,
      metadata: metadata,
      extracted: {
        emoji,
        reactorName,
        storyId,
        slideIndex,
        hasPreview: !!storyPreview
      },
      validation: {
        hasStoryId: isStoryAvailable,
        hasSlideIndex: slideIndex !== undefined
      }
    });
    
    // Alerte si des données critiques manquent
    if (!isStoryAvailable) {
      console.error('❌ [StoryReactionMessage] CRITIQUE: storyId manquant!', {
        message,
        metadata
      });
    }
  }, [message._id, metadata, emoji, reactorName, storyId, slideIndex, storyPreview, isStoryAvailable]);
  
  // ═══════════════════════════════════════════════════════════
  // GESTION DU CLIC
  // ═══════════════════════════════════════════════════════════
  
  const handleClick = (e) => {
    e.stopPropagation();
    
    // Appel du callback si fourni
    if (onClick) {
      onClick();
    }
    
    // Vérification de la disponibilité de la story
    if (!isStoryAvailable) {
      console.warn("⚠️ [StoryReactionMessage] Navigation impossible: Story ID manquant", {
        message,
        metadata
      });
      return;
    }
    
    // Navigation vers la story avec le bon index de slide
    const targetUrl = `/stories/${storyId}?slide=${slideIndex}`;
    console.log('[StoryReactionMessage] Navigation vers:', targetUrl);
    
    navigate(targetUrl);
  };
  
  // ═══════════════════════════════════════════════════════════
  // FORMATAGE DE L'HEURE
  // ═══════════════════════════════════════════════════════════
  
  const formatTime = (timestamp) => {
    try {
      return new Date(timestamp).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } catch (error) {
      console.error('[StoryReactionMessage] Erreur formatage date:', error);
      return '';
    }
  };
  
  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════
  
  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      onClick={handleClick}
      className={`max-w-[70%] ${isMine ? "ml-auto" : ""} ${
        isStoryAvailable ? "cursor-pointer" : "cursor-not-allowed opacity-70"
      } group`}
    >
      {/* CONTAINER PRINCIPAL */}
      <div className={`p-4 rounded-2xl border-2 transition-all duration-200 ${
        isStoryAvailable ? "hover:scale-[1.02] active:scale-[0.98]" : ""
      } ${
        isMine
          ? "bg-gradient-to-r from-pink-500/20 to-purple-500/20 border-pink-500/30 hover:border-pink-500/50"
          : "bg-gradient-to-r from-orange-500/20 to-red-500/20 border-orange-500/30 hover:border-orange-500/50"
      } backdrop-blur-sm shadow-lg`}>
        
        {/* CONTENU PRINCIPAL */}
        <div className="flex items-center gap-3">
          
          {/* EMOJI ANIMÉ */}
          <div className={`text-4xl flex-shrink-0 ${
            isStoryAvailable 
              ? "animate-bounce group-hover:scale-110 group-active:scale-90" 
              : ""
          } transition-transform duration-200`}>
            {emoji}
          </div>
          
          {/* PREVIEW DE LA STORY (si disponible) */}
          {storyPreview && (
            <div className="w-12 h-12 rounded-lg overflow-hidden border-2 border-white/20 flex-shrink-0 shadow-md">
              <img 
                src={storyPreview} 
                alt="Story preview" 
                className="w-full h-full object-cover"
                loading="lazy"
                onError={(e) => {
                  console.warn('[StoryReactionMessage] Erreur chargement preview:', storyPreview);
                  e.target.style.display = 'none';
                }}
              />
            </div>
          )}
          
          {/* TEXTE ET INFORMATIONS */}
          <div className="flex-1 min-w-0">
            {/* Titre */}
            <p className="text-white font-semibold text-sm truncate mb-1">
              {isMine 
                ? "Vous avez réagi à une story" 
                : `${reactorName} a réagi à votre story`
              }
            </p>
            
            {/* Sous-titre avec icône */}
            <div className={`text-xs flex items-center gap-1 ${
              isStoryAvailable ? "text-white/70" : "text-red-400"
            }`}>
              {isStoryAvailable ? (
                <>
                  <Eye className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">Touchez pour voir la story</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">Story expirée ou supprimée</span>
                </>
              )}
            </div>
          </div>
        </div>
        
        {/* FOOTER: TIMESTAMP */}
        <div className="flex items-center justify-between mt-3 pt-2 border-t border-white/10">
          <span className="text-xs text-white/50">
            {formatTime(message.timestamp)}
          </span>
          
          {/* Badge de statut */}
          {isStoryAvailable && (
            <div className="flex items-center gap-1 text-xs text-emerald-400">
              <CheckCircle className="w-3 h-3" />
              <span>Disponible</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}