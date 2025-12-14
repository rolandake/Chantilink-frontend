// ============================================
// 📁 src/pages/Home/StoryViewer.jsx - VERSION AVEC BARRES VISIBLES
// ============================================
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { X, Eye, Trash2, Heart, Send, Loader2, Volume2, VolumeX } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useStories } from "../../context/StoryContext";
import axios from "axios";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

// Helper URL
const MEDIA_URL = (path) => {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${API}/${path.replace(/^\/+/, "")}`;
};

const EMOJIS = ["❤️","😂","😮","😢","😍","🔥","👏","💯"];

// --- SOUS-COMPOSANTS ---

const LoadingOverlay = () => (
  <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/20 pointer-events-none">
    <Loader2 className="w-10 h-10 text-white animate-spin drop-shadow-lg" />
  </div>
);

const EmojiPicker = ({ onSelect, onClose }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20, scale: 0.9 }} 
    animate={{ opacity: 1, y: 0, scale: 1 }}
    exit={{ opacity: 0, y: 20, scale: 0.9 }}
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
    <button onClick={onClose} className="w-full mt-3 py-2 text-sm text-gray-400 hover:text-white transition bg-white/5 rounded-lg">
      Fermer
    </button>
  </motion.div>
);

const ViewersModal = ({ storyId, slideIndex, onClose }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const { token } = useAuth();

  useEffect(() => {
    let isMounted = true;
    const fetchViewers = async () => {
      try {
        const res = await axios.get(`${API}/api/story/${storyId}/slides/${slideIndex}/viewers`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (isMounted) setData(res.data.viewers || []);
      } catch (err) { console.warn(err); } 
      finally { if (isMounted) setLoading(false); }
    };
    fetchViewers();
    return () => { isMounted = false; };
  }, [storyId, slideIndex, token]);

  return createPortal(
    <div className="fixed inset-0 bg-black/90 z-[99999] flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <motion.div 
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        className="bg-[#111b21] w-full sm:max-w-md h-[70vh] sm:rounded-3xl rounded-t-3xl p-6 flex flex-col border border-gray-800" 
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-800">
          <h3 className="text-white font-bold text-lg">Vues ({data.length})</h3>
          <button onClick={onClose}><X className="text-gray-400" /></button>
        </div>
        <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar">
          {loading ? <p className="text-gray-500 text-center mt-10">Chargement...</p> : 
           data.length === 0 ? <p className="text-gray-500 text-center mt-10">Aucune vue</p> : 
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

const FloatingReaction = ({ emoji, onComplete }) => (
  <motion.div
    initial={{ opacity: 1, y: 0, scale: 0.5 }}
    animate={{ opacity: 0, y: -300, scale: 2, x: (Math.random() - 0.5) * 100 }}
    transition={{ duration: 1.5, ease: "easeOut" }}
    onAnimationComplete={onComplete}
    className="absolute bottom-20 left-1/2 -translate-x-1/2 text-6xl pointer-events-none z-50 select-none"
  >
    {emoji}
  </motion.div>
);

// ==========================================
// 2. COMPOSANT PRINCIPAL
// ==========================================

export default function StoryViewer({ stories = [], currentUser, onClose }) {
  // --- STATES ---
  const [isMediaLoaded, setIsMediaLoaded] = useState(false);
  const [isHolding, setIsHolding] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  
  const initialStoryIndex = useMemo(() => {
    if (!currentUser) return 0;
    const idx = stories.findIndex(s => (s.owner?._id || s.owner) === (currentUser._id || currentUser));
    return idx !== -1 ? idx : 0;
  }, [stories, currentUser]);

  const [storyIdx, setStoryIdx] = useState(initialStoryIndex);
  const [slideIdx, setSlideIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  
  const [showEmoji, setShowEmoji] = useState(false);
  const [showViewers, setShowViewers] = useState(false);
  const [replyText, setReplyText] = useState("");
  
  const [floatingReactions, setFloatingReactions] = useState([]);
  const [userReaction, setUserReaction] = useState(null);
  
  const videoRef = useRef(null);
  const interval = useRef(null);
  const viewTimer = useRef(null);
  const viewedSlides = useRef(new Set());
  const reactionId = useRef(0);
  const controls = useAnimation();

  const { token, user } = useAuth();
  const { viewSlide, deleteStory } = useStories();

  const story = useMemo(() => stories[storyIdx], [stories, storyIdx]);
  const slide = useMemo(() => story?.slides?.[slideIdx], [story, slideIdx]);
  
  const isOwner = useMemo(() => {
    if (!story || !user) return false;
    const ownerId = story.owner?._id || story.owner;
    return ownerId === user._id;
  }, [story, user]);

  // Animation Entrée
  useEffect(() => { controls.start({ scale: 1, opacity: 1, y: 0 }); }, [controls]);

  // Sécurité Fermeture
  useEffect(() => {
    if (!story || !slide) {
      const timer = setTimeout(() => onClose(), 0);
      return () => clearTimeout(timer);
    }
  }, [story, slide, onClose]);

  // Reset Loader
  useEffect(() => { setIsMediaLoaded(false); setProgress(0); }, [slideIdx, storyIdx]);

  // Navigation
  const nextSlide = useCallback(() => {
    if (isHolding) return;
    setUserReaction(null); setReplyText("");
    
    if (slideIdx < (story?.slides?.length || 0) - 1) {
      setSlideIdx(s => s + 1);
    } else if (storyIdx < stories.length - 1) {
      setStoryIdx(s => s + 1);
      setSlideIdx(0);
    } else {
      onClose();
    }
  }, [slideIdx, storyIdx, stories, isHolding, onClose, story]);

  const prevSlide = useCallback(() => {
    if (isHolding) return;
    setUserReaction(null);
    if (slideIdx > 0) {
      setSlideIdx(s => s - 1);
    } else if (storyIdx > 0) {
      setStoryIdx(s => s - 1);
      setSlideIdx(stories[storyIdx - 1].slides.length - 1);
    }
  }, [slideIdx, storyIdx, stories, isHolding]);

  // Auto Play
  useEffect(() => {
    if (!slide || isPaused || isHolding || showEmoji || showViewers || !isMediaLoaded) {
      clearInterval(interval.current);
      if (videoRef.current) videoRef.current.pause();
      return;
    }

    if (slide.type === 'video' && videoRef.current) {
      videoRef.current.play().catch(() => {});
    }

    const step = 50; 
    const currentDuration = (slide.type === 'video' && videoRef.current?.duration) 
      ? videoRef.current.duration * 1000 
      : (slide.duration || 5000);

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
  }, [slide, isPaused, isHolding, isMediaLoaded, showEmoji, showViewers, nextSlide]);

  // Mark Viewed
  useEffect(() => {
    if (!slide || isOwner || !story?._id) return;
    const key = `${story._id}-${slideIdx}`;
    if (viewedSlides.current.has(key)) return;

    viewTimer.current = setTimeout(() => {
      viewSlide(story._id, slideIdx);
      viewedSlides.current.add(key);
    }, 500);

    return () => clearTimeout(viewTimer.current);
  }, [slide, story, slideIdx, isOwner, viewSlide]);

  // Reactions
  const sendReaction = useCallback(async (emoji) => {
    if (!story?._id || !token) return;
    const id = reactionId.current++;
    setFloatingReactions(prev => [...prev, { id, emoji }]);
    setUserReaction(emoji);
  }, [story?._id, token]);

  const renderContent = () => {
    const src = MEDIA_URL(slide.mediaUrl || slide.media);
    if (slide.type === "text") {
      if (!isMediaLoaded) setIsMediaLoaded(true);
      return (
        <div className="w-full h-full flex items-center justify-center p-8 text-center" style={{ background: slide.background || "#111" }}>
          <p style={{ fontFamily: slide.fontFamily || "sans-serif", fontSize: "28px", color: "white" }} className="font-bold drop-shadow-lg whitespace-pre-wrap">{slide.content || slide.text}</p>
        </div>
      );
    }
    if (slide.type === "video") {
      return (
        <video ref={videoRef} src={src} className="w-full h-full object-contain" playsInline muted={isMuted} onLoadedData={() => setIsMediaLoaded(true)} onWaiting={() => setIsMediaLoaded(false)} onPlaying={() => setIsMediaLoaded(true)} />
      );
    }
    return <img src={src} alt="Story" className="w-full h-full object-contain" onLoad={() => setIsMediaLoaded(true)} draggable={false} />;
  };

  if (!story || !slide) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-xl">
        {slide.type === 'image' && <img src={MEDIA_URL(slide.mediaUrl || slide.media)} className="w-full h-full object-cover blur-3xl opacity-30" alt="" />}
      </div>

      <motion.div 
        drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={0.7}
        onDragEnd={(e, info) => info.offset.y > 100 ? onClose() : controls.start({ y: 0, scale: 1, opacity: 1 })}
        animate={controls} initial={{ scale: 0.9, opacity: 0, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 100 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="relative w-full h-full sm:max-w-[420px] sm:h-[90vh] bg-black sm:rounded-3xl overflow-hidden shadow-2xl z-20 select-none"
        onPointerDown={() => { setIsHolding(true); setIsPaused(true); }}
        onPointerUp={() => { setIsHolding(false); setIsPaused(false); }}
        onPointerLeave={() => { setIsHolding(false); setIsPaused(false); }}
      >
        {!isMediaLoaded && <LoadingOverlay />}

        <AnimatePresence>
          {!isHolding && (
            <>
              {/* ✅ LES BARRES DE PROGRESSION (Modifié pour la visibilité) */}
              <div className="absolute top-0 left-0 right-0 z-50 p-2 pt-3 flex gap-1.5 pointer-events-none">
                {story.slides.map((_, i) => (
                  <div key={i} className="h-1 flex-1 bg-gray-600/60 rounded-full overflow-hidden backdrop-blur-sm">
                    <motion.div 
                      className="h-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]" 
                      initial={{ width: i < slideIdx ? "100%" : "0%" }}
                      animate={{ width: i === slideIdx ? `${progress}%` : i < slideIdx ? "100%" : "0%" }}
                      transition={{ ease: "linear", duration: 0 }}
                    />
                  </div>
                ))}
              </div>

              {/* Header User */}
              <div className="absolute top-6 left-0 right-0 z-30 px-4 flex justify-between items-center pointer-events-none">
                <div className="flex items-center gap-3 pointer-events-auto">
                  <img src={MEDIA_URL(story.owner?.profilePhoto) || "/default-avatar.png"} className="w-9 h-9 rounded-full border border-white/20 shadow-lg object-cover bg-gray-700" alt="" />
                  <div>
                    <p className="text-white font-bold text-sm drop-shadow-md">{story.owner?.username || "Utilisateur"}</p>
                    <p className="text-white/70 text-xs drop-shadow-md font-medium">{new Date(slide.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 pointer-events-auto">
                   {slide.type === 'video' && (
                     <button onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); }} className="p-2 bg-white/10 rounded-full backdrop-blur-md hover:bg-white/20 text-white">
                        {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                     </button>
                   )}
                   <button onClick={onClose} className="p-2 bg-white/10 rounded-full backdrop-blur-md hover:bg-white/20 text-white transition-transform hover:scale-110">
                     <X size={20} />
                   </button>
                </div>
              </div>
            </>
          )}
        </AnimatePresence>

        {renderContent()}

        {!isHolding && (slide.caption || slide.text) && slide.type !== 'text' && (
           <div className="absolute bottom-24 left-0 right-0 px-6 z-20 flex justify-center pointer-events-none">
             <p className="text-white text-center text-lg font-medium drop-shadow-lg leading-relaxed bg-black/40 px-4 py-2 rounded-2xl backdrop-blur-sm">{slide.caption || slide.text}</p>
           </div>
        )}

        <div className="absolute inset-0 flex z-10">
          <div className="w-1/3 h-full" onClick={prevSlide} />
          <div className="w-1/3 h-full" />
          <div className="w-1/3 h-full" onClick={nextSlide} />
        </div>

        <AnimatePresence>
          {!isHolding && !isOwner && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="absolute bottom-0 left-0 right-0 p-4 z-30 bg-gradient-to-t from-black via-black/60 to-transparent flex gap-3 items-center pointer-events-auto" onClick={e => e.stopPropagation()}>
              <input type="text" value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Envoyer un message..." className="flex-1 bg-white/10 border border-white/20 rounded-full px-5 py-3 text-white placeholder-white/60 focus:outline-none focus:border-white/50 focus:bg-white/20 transition backdrop-blur-xl text-sm" onFocus={() => setIsPaused(true)} onBlur={() => setIsPaused(false)} />
              {replyText.trim() ? <button className="p-3 bg-[#00a884] rounded-full text-white shadow-lg active:scale-95 transition"><Send className="w-5 h-5 ml-0.5" /></button> : <button onClick={() => { setShowEmoji(!showEmoji); setIsPaused(true); }} className="p-3 rounded-full bg-white/10 text-white hover:bg-white/20 backdrop-blur-xl active:scale-95 transition"><Heart className={`w-6 h-6 ${userReaction ? 'fill-red-500 text-red-500' : ''}`} /></button>}
            </motion.div>
          )}
          {!isHolding && isOwner && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute bottom-6 left-0 right-0 px-6 z-40 flex justify-between items-end pointer-events-auto">
              <button onClick={(e) => { e.stopPropagation(); setShowViewers(true); setIsPaused(true); }} className="flex flex-col items-center gap-1 group">
                <div className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full backdrop-blur-md group-hover:bg-white/20 transition border border-white/10">
                  <Eye className="w-5 h-5 text-white" />
                  <span className="text-white font-bold text-sm">{slide.views?.length || 0}</span>
                </div>
                <span className="text-[10px] text-white/80 font-medium">Vues</span>
              </button>
              <button onClick={async (e) => { e.stopPropagation(); if(confirm('Supprimer ?')) { await deleteStory(story._id); onClose(); } }} className="p-3 bg-white/10 border border-white/10 rounded-full text-white hover:bg-red-500/80 hover:border-red-500 transition backdrop-blur-md shadow-lg"><Trash2 className="w-5 h-5" /></button>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {floatingReactions.map(r => <FloatingReaction key={r.id} emoji={r.emoji} onComplete={() => setFloatingReactions(prev => prev.filter(rx => rx.id !== r.id))} />)}
        </AnimatePresence>

        <AnimatePresence>
           {showEmoji && <EmojiPicker onSelect={(e) => { sendReaction(e); setShowEmoji(false); setIsPaused(false); }} onClose={() => setShowEmoji(false)} />}
           {showViewers && <ViewersModal storyId={story._id} slideIndex={slideIdx} onClose={() => { setShowViewers(false); setIsPaused(false); }} />}
        </AnimatePresence>
      </motion.div>
    </div>,
    document.body
  );
}