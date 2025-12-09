// ============================================
// 📁 src/pages/Home/StoryViewer.jsx - VERSION FINALE & STABLE
// ============================================
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Eye, Trash2, Heart, Send
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useStories } from "../../context/StoryContext";
import axios from "axios";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

// ✅ Helper URL sécurisé
const MEDIA_URL = (path) => {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${API}/${path.replace(/^\/+/, "")}`;
};

const EMOJIS = ["❤️","😂","😮","😢","😍","🔥","👏","💯","🎉","😭","😻","👀","💪","🙌","😎","🤩"];

// --- SOUS-COMPOSANTS ---

const EmojiPicker = ({ onSelect, onClose }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="absolute bottom-20 left-4 right-4 bg-[#111b21] border border-gray-700 rounded-2xl shadow-2xl p-4 z-50 backdrop-blur-xl"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="grid grid-cols-8 gap-3">
        {EMOJIS.map((emoji, i) => (
          <motion.button
            key={i}
            whileHover={{ scale: 1.2 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => onSelect(emoji)}
            className="text-2xl sm:text-3xl p-1 sm:p-2 hover:bg-white/10 rounded-xl transition flex justify-center"
          >
            {emoji}
          </motion.button>
        ))}
      </div>
      <button 
        onClick={onClose}
        className="w-full mt-3 py-2 text-sm text-gray-400 hover:text-white transition bg-white/5 rounded-lg"
      >
        Fermer
      </button>
    </motion.div>
  );
};

const ViewersModal = ({ storyId, slideIndex, onClose }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const { token } = useAuth();

  useEffect(() => {
    const fetchViewers = async () => {
      try {
        // Cette route doit exister dans votre backend, sinon ça renverra 404
        // Si vous ne l'avez pas encore, ce n'est pas grave, le loading restera ou vide.
        const res = await axios.get(`${API}/api/story/${storyId}/slides/${slideIndex}/viewers`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setData(res.data.viewers || []);
      } catch (err) { 
        console.warn("Viewers fetch error:", err); 
      } finally { 
        setLoading(false); 
      }
    };
    fetchViewers();
  }, [storyId, slideIndex, token]);

  return createPortal(
    <div className="fixed inset-0 bg-black/90 z-[99999] flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <motion.div 
        initial={{ y: "100%" }} 
        animate={{ y: 0 }} 
        exit={{ y: "100%" }}
        className="bg-[#111b21] w-full sm:max-w-md h-[70vh] sm:rounded-3xl rounded-t-3xl p-6 flex flex-col border border-gray-800" 
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-800">
          <h3 className="text-white font-bold text-lg">Vues ({data.length})</h3>
          <button onClick={onClose}><X className="text-gray-400" /></button>
        </div>
        <div className="flex-1 overflow-y-auto space-y-3">
          {loading ? <p className="text-gray-500 text-center mt-10">Chargement...</p> : 
           data.length === 0 ? <p className="text-gray-500 text-center mt-10">Aucune vue pour l'instant</p> : 
           data.map((v, i) => (
            <div key={i} className="flex items-center gap-3 p-2 hover:bg-white/5 rounded-xl">
              <img src={MEDIA_URL(v.profilePhoto) || "/default-avatar.png"} className="w-10 h-10 rounded-full object-cover bg-gray-700" alt="" />
              <div>
                <p className="text-white font-medium">{v.username || "Utilisateur"}</p>
                <p className="text-gray-500 text-xs">{v.fullName}</p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>, document.body
  );
};

// Animation de réaction flottante
const FloatingReaction = ({ emoji, onComplete }) => {
  return (
    <motion.div
      initial={{ opacity: 1, y: 0, scale: 0.5 }}
      animate={{ 
        opacity: 0, 
        y: -300, 
        scale: 2,
        x: (Math.random() - 0.5) * 100 
      }}
      transition={{ duration: 1.5, ease: "easeOut" }}
      onAnimationComplete={onComplete}
      className="absolute bottom-20 left-1/2 -translate-x-1/2 text-6xl pointer-events-none z-50 select-none"
    >
      {emoji}
    </motion.div>
  );
};

// ============================================
// COMPOSANT PRINCIPAL
// ============================================
export default function StoryViewer({ stories = [], currentUser, onClose }) {
  // --- STATES ---
  // On commence à l'index de la story cliquée (via currentUser) ou 0
  const initialStoryIndex = useMemo(() => {
    if (!currentUser) return 0;
    const idx = stories.findIndex(s => (s.owner?._id || s.owner) === (currentUser._id || currentUser));
    return idx !== -1 ? idx : 0;
  }, [stories, currentUser]);

  const [storyIdx, setStoryIdx] = useState(initialStoryIndex);
  const [slideIdx, setSlideIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  
  // UI States
  const [showEmoji, setShowEmoji] = useState(false);
  const [showViewers, setShowViewers] = useState(false);
  const [replyText, setReplyText] = useState("");
  
  // Réactions
  const [floatingReactions, setFloatingReactions] = useState([]);
  const [userReaction, setUserReaction] = useState(null);
  
  // Refs
  const videoRef = useRef(null);
  const interval = useRef(null);
  const viewTimer = useRef(null);
  const viewedSlides = useRef(new Set()); // Évite double appel API
  const reactionId = useRef(0);

  const { token, user } = useAuth();
  const { viewSlide, deleteStory, fetchStories } = useStories();

  // --- DERIVED DATA ---
  const story = useMemo(() => stories[storyIdx], [stories, storyIdx]);
  const slide = useMemo(() => story?.slides?.[slideIdx], [story, slideIdx]);
  
  // Vérification propriétaire (supporte populate ou ID direct)
  const isOwner = useMemo(() => {
    if (!story || !user) return false;
    const ownerId = story.owner?._id || story.owner;
    return ownerId === user._id;
  }, [story, user]);

  const slideDuration = slide?.duration || 5000;

  // ✅ SÉCURITÉ ANTI-CRASH : Si données invalides, on ferme
  useEffect(() => {
    if (!story || !slide) {
      const t = setTimeout(() => onClose(), 0);
      return () => clearTimeout(t);
    }
  }, [story, slide, onClose]);

  // ============================================
  // LOGIQUE DE NAVIGATION
  // ============================================
  
  const nextSlide = useCallback(() => {
    setUserReaction(null);
    setReplyText("");
    
    // Y a-t-il une autre slide dans cette story ?
    if (slideIdx < (story?.slides?.length || 0) - 1) {
      setSlideIdx(s => s + 1);
      setProgress(0);
    } 
    // Sinon, y a-t-il une autre story ?
    else if (storyIdx < stories.length - 1) {
      setStoryIdx(s => s + 1);
      setSlideIdx(0);
      setProgress(0);
    } 
    // Sinon, c'est fini
    else {
      onClose();
    }
  }, [slideIdx, storyIdx, stories.length, story?.slides?.length, onClose]);

  const prevSlide = useCallback(() => {
    setUserReaction(null);
    if (slideIdx > 0) {
      setSlideIdx(s => s - 1);
      setProgress(0);
    } else if (storyIdx > 0) {
      setStoryIdx(s => s - 1);
      setSlideIdx(stories[storyIdx - 1].slides.length - 1);
      setProgress(0);
    }
  }, [slideIdx, storyIdx, stories]);

  // ============================================
  // PROGRESSION & AUTO-PLAY
  // ============================================
  
  useEffect(() => {
    if (!slide || isPaused || showEmoji || showViewers) {
      clearInterval(interval.current);
      if (videoRef.current) videoRef.current.pause();
      return;
    }

    // Gestion Vidéo
    if (slide.type === 'video' && videoRef.current) {
      videoRef.current.play().catch(e => console.log("Autoplay prevented", e));
    }

    const step = 50; // ms
    // Si c'est une vidéo, on utilise sa durée réelle si disponible
    const currentDuration = (slide.type === 'video' && videoRef.current?.duration) 
      ? videoRef.current.duration * 1000 
      : slideDuration;

    interval.current = setInterval(() => {
      setProgress(p => {
        const next = p + (step / currentDuration) * 100;
        if (next >= 100) {
          clearInterval(interval.current);
          nextSlide();
          return 0;
        }
        return next;
      });
    }, step);

    return () => clearInterval(interval.current);
  }, [slide, isPaused, showEmoji, showViewers, nextSlide, slideDuration]);

  // ============================================
  // MARQUER COMME VU (Une seule fois par slide)
  // ============================================
  
  useEffect(() => {
    // Si pas de slide, ou si je suis le proprio, ou si déjà vu dans cette session -> Stop
    if (!slide || isOwner || !story?._id) return;
    
    const key = `${story._id}-${slideIdx}`;
    if (viewedSlides.current.has(key)) return;

    // Délai de 0.5s avant de compter la vue
    viewTimer.current = setTimeout(() => {
      viewSlide(story._id, slideIdx);
      viewedSlides.current.add(key);
    }, 500);

    return () => clearTimeout(viewTimer.current);
  }, [slide, story, slideIdx, isOwner, viewSlide]);

  // ============================================
  // ACTIONS (Réactions / Clavier)
  // ============================================

  const sendReaction = useCallback(async (emoji) => {
    if (!story?._id || !token) return;
    
    // Animation locale immédiate (Optimistic UI)
    const id = reactionId.current++;
    setFloatingReactions(prev => [...prev, { id, emoji }]);
    setUserReaction(emoji);

    try {
      // Si vous avez une route backend pour ça :
      // await axios.post(`${API}/api/story/${story._id}/slides/${slideIdx}/react`, { emoji }, ...);
      console.log('💖 Reaction sent:', emoji);
    } catch (err) {
      console.error('Reaction error:', err);
    }
  }, [story?._id, slideIdx, token]);

  // Clavier
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "ArrowRight") nextSlide();
      if (e.key === "ArrowLeft") prevSlide();
      if (e.key === "Escape") onClose();
      if (e.key === " ") { 
        e.preventDefault(); 
        setIsPaused(p => !p); 
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [nextSlide, prevSlide, onClose]);

  // ============================================
  // RENDU DU CONTENU (Switch Type)
  // ============================================
  
  if (!story || !slide) return null; // Sécurité ultime

  const renderContent = () => {
    // 1. TEXTE SEUL
    if (slide.type === "text") {
      return (
        <div 
          className="absolute inset-0 flex items-center justify-center p-8 text-center"
          style={{ 
            background: slide.background || "linear-gradient(135deg, #111, #333)",
          }}
        >
          <p 
            style={{ 
              fontFamily: slide.fontFamily || "sans-serif",
              fontSize: "28px",
              color: "white"
            }}
            className="font-bold drop-shadow-lg whitespace-pre-wrap break-words"
          >
            {slide.content || slide.text || slide.caption}
          </p>
        </div>
      );
    }

    // 2. VIDÉO
    if (slide.type === "video") {
      return (
        <div className="absolute inset-0 bg-black flex items-center justify-center">
          <video
            ref={videoRef}
            src={MEDIA_URL(slide.mediaUrl || slide.media)}
            className="w-full h-full object-contain"
            playsInline
            muted={false} // Son activé par défaut (comme TikTok/Insta)
          />
        </div>
      );
    }

    // 3. IMAGE
    return (
      <div className="absolute inset-0 bg-black flex items-center justify-center">
        <img 
          src={MEDIA_URL(slide.mediaUrl || slide.media)} 
          alt="Story" 
          className="w-full h-full object-contain" 
        />
      </div>
    );
  };

  // ============================================
  // RENDU UI
  // ============================================

  return createPortal(
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }} 
      className="fixed inset-0 bg-black z-[9999] flex items-center justify-center"
    >
      
      <div 
        className="relative w-full h-full max-w-md bg-black sm:h-[90vh] sm:rounded-2xl overflow-hidden shadow-2xl"
        onMouseDown={() => setIsPaused(true)}
        onMouseUp={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
      >
        
        {/* BARRES DE PROGRESSION */}
        <div className="absolute top-0 left-0 right-0 z-30 p-2 flex gap-1">
          {story.slides.map((_, i) => (
            <div key={i} className="h-1 flex-1 bg-white/30 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-white" 
                initial={{ width: i < slideIdx ? "100%" : "0%" }}
                animate={{ width: i === slideIdx ? `${progress}%` : i < slideIdx ? "100%" : "0%" }}
                transition={{ ease: "linear", duration: 0 }}
              />
            </div>
          ))}
        </div>

        {/* HEADER (User Info) */}
        <div className="absolute top-4 left-0 right-0 z-30 px-4 flex justify-between items-center bg-gradient-to-b from-black/60 to-transparent pb-6">
          <div className="flex items-center gap-2">
            <img 
              src={MEDIA_URL(story.owner?.profilePhoto) || "/default-avatar.png"} 
              className="w-9 h-9 rounded-full border border-white/30 shadow-sm object-cover" 
              alt="" 
            />
            <div>
              <p className="text-white font-semibold text-sm drop-shadow-md leading-tight">
                {story.owner?.username || "Utilisateur"}
              </p>
              <p className="text-white/70 text-xs drop-shadow-md">
                {new Date(slide.createdAt || story.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isOwner && (
              <button 
                onClick={(e) => { e.stopPropagation(); setIsPaused(true); setShowViewers(true); }} 
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 rounded-full text-white backdrop-blur hover:bg-white/20 transition"
              >
                <Eye className="w-4 h-4" />
                <span className="text-xs font-bold">{slide.views?.length || 0}</span>
              </button>
            )}
            <button 
              onClick={onClose} 
              className="p-2 bg-white/10 rounded-full backdrop-blur hover:bg-white/20 transition text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* CONTENU PRINCIPAL */}
        {renderContent()}

        {/* LÉGENDE (CAPTION) - Si Image/Vidéo */}
        {slide.type !== 'text' && (slide.caption || slide.text) && (
          <div className="absolute bottom-24 left-0 right-0 px-4 z-20 flex justify-center">
            <div className="bg-black/50 backdrop-blur-md px-4 py-2 rounded-xl text-white text-center text-sm font-medium">
              {slide.caption || slide.text}
            </div>
          </div>
        )}

        {/* EFFETS DE RÉACTION */}
        <AnimatePresence>
          {floatingReactions.map(r => (
            <FloatingReaction 
              key={r.id} 
              emoji={r.emoji} 
              onComplete={() => setFloatingReactions(prev => prev.filter(rx => rx.id !== r.id))} 
            />
          ))}
        </AnimatePresence>

        {/* ZONES DE CLIC INVISIBLES */}
        <div className="absolute inset-0 flex z-10">
          <div className="w-1/3 h-full" onClick={prevSlide} /> {/* Gauche */}
          <div className="w-1/3 h-full" /> {/* Centre (Pause) */}
          <div className="w-1/3 h-full" onClick={nextSlide} /> {/* Droite */}
        </div>

        {/* FOOTER (INPUT & REACTION) - Sauf pour le proprio */}
        {!isOwner && (
          <div 
            className="absolute bottom-0 left-0 right-0 p-3 z-30 bg-gradient-to-t from-black via-black/80 to-transparent flex gap-2 items-center"
            onClick={e => e.stopPropagation()} // Important pour pas trigger nextSlide
          >
            <input 
              type="text"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Envoyer un message..." 
              className="flex-1 bg-white/10 border border-white/20 rounded-full px-4 py-2.5 text-white placeholder-white/50 focus:outline-none focus:border-white/50 focus:bg-white/20 transition backdrop-blur-md text-sm"
              onFocus={() => setIsPaused(true)}
              onBlur={() => setIsPaused(false)}
            />
            
            {replyText.trim() ? (
              <motion.button 
                whileTap={{ scale: 0.9 }}
                className="p-2.5 bg-[#00a884] rounded-full text-white shadow-lg"
              >
                <Send className="w-5 h-5 ml-0.5" />
              </motion.button>
            ) : (
              <motion.button 
                whileTap={{ scale: 0.9 }}
                onClick={() => {
                  setShowEmoji(!showEmoji);
                  setIsPaused(true);
                }}
                className={`p-2.5 rounded-full transition ${
                  userReaction ? 'bg-red-500/80 text-white' : 'bg-white/10 text-white hover:bg-white/20'
                } backdrop-blur-md`}
              >
                {userReaction ? <span className="text-lg font-bold">1</span> : <Heart className="w-6 h-6" />}
              </motion.button>
            )}

            {/* POPUP EMOJI */}
            <AnimatePresence>
              {showEmoji && (
                <EmojiPicker 
                  onSelect={(e) => {
                    sendReaction(e);
                    setShowEmoji(false);
                    setIsPaused(false);
                  }}
                  onClose={() => { setShowEmoji(false); setIsPaused(false); }}
                />
              )}
            </AnimatePresence>
          </div>
        )}

        {/* ACTION PROPRIO (DELETE) */}
        {isOwner && (
          <div className="absolute bottom-6 right-6 z-40">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={async (e) => {
                e.stopPropagation();
                if(confirm('Supprimer cette story ?')) {
                  await deleteStory(story._id);
                  await fetchStories(true);
                  onClose();
                }
              }} 
              className="p-3 bg-white/10 border border-white/10 rounded-full text-white hover:bg-red-500/80 hover:border-red-500 transition backdrop-blur-md shadow-lg"
            >
              <Trash2 className="w-5 h-5" />
            </motion.button>
          </div>
        )}

      </div>

      {/* MODAL VIEWERS */}
      <AnimatePresence>
        {showViewers && (
          <ViewersModal 
            storyId={story._id} 
            slideIndex={slideIdx} 
            onClose={() => { setShowViewers(false); setIsPaused(false); }} 
          />
        )}
      </AnimatePresence>

    </motion.div>,
    document.body
  );
}