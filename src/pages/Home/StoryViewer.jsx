// 📁 src/pages/Home/StoryViewer.jsx - VERSION MULTI-SLIDES FLUIDE
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { X, Loader2, Heart, Send, MoreVertical } from "lucide-react";

const SERVER_URL = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace('/api', '');
const MEDIA_URL = (path) => path?.startsWith("http") ? path : `${SERVER_URL}/${path?.replace(/^\/+/, "")}`;

export default function StoryViewer({ stories = [], currentUser, onClose }) {
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [slideIdx, setSlideIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  
  const story = stories[currentStoryIndex] || {};
  const allSlides = useMemo(() => {
    return story.slides || [];
  }, [story]);
  
  const slide = allSlides[slideIdx];
  const owner = story.owner || story.user;

  // Avatar et nom du propriétaire
  const ownerAvatar = useMemo(() => {
    return MEDIA_URL(owner?.profilePhoto || owner?.avatar || owner?.profilePicture);
  }, [owner]);

  const ownerName = useMemo(() => {
    return owner?.fullName || owner?.username || "Utilisateur";
  }, [owner]);

  const timeAgo = useMemo(() => {
    if (!slide?.createdAt) return "";
    const diff = Date.now() - new Date(slide.createdAt).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return "À l'instant";
    if (hours < 24) return `Il y a ${hours}h`;
    return `Il y a ${Math.floor(hours / 24)}j`;
  }, [slide?.createdAt]);

  // Calcul de la durée en fonction du contenu
  const slideDuration = useMemo(() => {
    if (!slide) return 10000;
    
    const content = slide.content || slide.text || "";
    const hasMedia = slide.type === "video" || slide.mediaUrl || slide.media;
    
    if (content.length > 500) return 60000;
    if (content.length > 300) return 45000;
    if (content.length > 150) return 30000;
    if (content.length > 50) return 20000;
    
    if (hasMedia && content.length === 0) {
      return slide.type === "video" ? 60000 : 15000;
    }
    
    return 10000;
  }, [slide]);

  useEffect(() => {
    if (!slide && allSlides.length === 0) {
      const timer = setTimeout(onClose, 0);
      return () => clearTimeout(timer);
    }
  }, [slide, allSlides.length, onClose]);

  useEffect(() => {
    if (!isLoaded || !slide || isPaused) return;
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          if (slideIdx < allSlides.length - 1) {
            setSlideIdx(s => s + 1);
            setProgress(0);
            setIsLoaded(false);
          } else {
            if (currentStoryIndex < stories.length - 1) {
              setCurrentStoryIndex(i => i + 1);
              setSlideIdx(0);
              setProgress(0);
              setIsLoaded(false);
            } else {
              onClose();
            }
          }
          return 0;
        }
        return p + (100 / (slideDuration / 100));
      });
    }, 100);
    return () => clearInterval(interval);
  }, [slideIdx, isLoaded, allSlides.length, onClose, slide, isPaused, currentStoryIndex, stories.length, slideDuration]);

  const handlePrevSlide = useCallback(() => {
    if (slideIdx > 0) {
      setSlideIdx(s => s - 1);
      setProgress(0);
      setIsLoaded(false);
    } else if (currentStoryIndex > 0) {
      setCurrentStoryIndex(i => i - 1);
      const prevStory = stories[currentStoryIndex - 1];
      setSlideIdx((prevStory?.slides?.length || 1) - 1);
      setProgress(0);
      setIsLoaded(false);
    }
  }, [slideIdx, currentStoryIndex, stories]);

  const handleNextSlide = useCallback(() => {
    if (slideIdx < allSlides.length - 1) {
      setSlideIdx(s => s + 1);
      setProgress(0);
      setIsLoaded(false);
    } else if (currentStoryIndex < stories.length - 1) {
      setCurrentStoryIndex(i => i + 1);
      setSlideIdx(0);
      setProgress(0);
      setIsLoaded(false);
    } else {
      onClose();
    }
  }, [slideIdx, allSlides.length, currentStoryIndex, stories.length, onClose]);

  const handleDragEnd = useCallback((_, info) => {
    if (info.offset.y > 100) onClose();
  }, [onClose]);

  const togglePause = useCallback(() => {
    setIsPaused(p => !p);
  }, []);

  if (!slide) return null;

  return (
    <motion.div 
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      onDragEnd={handleDragEnd}
      initial={{ y: '100%' }} 
      animate={{ y: 0 }} 
      exit={{ y: '100%' }}
      className="fixed inset-0 z-[10000] bg-black touch-none flex flex-col items-center justify-center"
    >
      <div className="absolute top-[calc(env(safe-area-inset-top)+10px)] left-4 right-4 z-[10001] flex gap-1">
        {allSlides.map((_, i) => (
          <div key={i} className="h-1 flex-1 bg-white/20 rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-white" 
              initial={{ width: '0%' }}
              animate={{ 
                width: i === slideIdx ? `${progress}%` : i < slideIdx ? '100%' : '0%' 
              }}
              transition={{ duration: 0.1, ease: 'linear' }}
            />
          </div>
        ))}
      </div>

      <div className="absolute top-[calc(env(safe-area-inset-top)+30px)] left-4 right-4 z-[10001] flex items-center justify-between">
        <div className="flex items-center gap-3">
          {ownerAvatar ? (
            <img 
              src={ownerAvatar} 
              alt={ownerName}
              className="w-10 h-10 rounded-full border-2 border-white object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-full border-2 border-white bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center text-white font-bold">
              {ownerName[0]?.toUpperCase()}
            </div>
          )}
          
          <div className="flex flex-col">
            <span className="text-white font-semibold text-sm drop-shadow-lg">
              {ownerName}
            </span>
            <span className="text-white/80 text-xs drop-shadow-lg">
              {timeAgo}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isPaused && (
            <div className="text-white text-xs bg-black/40 backdrop-blur-sm px-2 py-1 rounded-full">
              Pause
            </div>
          )}
          <button 
            onClick={togglePause}
            className="p-2 bg-black/20 backdrop-blur-md rounded-full text-white active:scale-95 transition-transform"
          >
            <MoreVertical size={20}/>
          </button>
          <button 
            onClick={onClose} 
            className="p-2 bg-black/20 backdrop-blur-md rounded-full text-white active:scale-95 transition-transform"
          >
            <X size={20}/>
          </button>
        </div>
      </div>

      <div className="w-full h-full flex items-center justify-center relative">
        {!isLoaded && (
          <Loader2 className="animate-spin text-white/20 absolute" size={40}/>
        )}
        <motion.div
          key={`slide-${currentStoryIndex}-${slideIdx}`}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.05 }}
          transition={{ duration: 0.3 }}
          className="w-full h-full flex items-center justify-center"
        >
          {slide.type === "video" ? (
            <video 
              src={MEDIA_URL(slide.mediaUrl || slide.media)} 
              onLoadedData={() => setIsLoaded(true)}
              autoPlay 
              playsInline 
              muted
              className="w-full h-full object-contain"
            />
          ) : (
            <img 
              src={MEDIA_URL(slide.mediaUrl || slide.media)} 
              onLoad={() => setIsLoaded(true)}
              alt="Story"
              className="w-full h-full object-contain"
            />
          )}
        </motion.div>

        {(slide.content || slide.text) && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-20 left-4 right-4 z-[10001]"
          >
            <p className="text-white text-sm bg-black/40 backdrop-blur-md px-4 py-3 rounded-2xl drop-shadow-lg">
              {slide.content || slide.text}
            </p>
          </motion.div>
        )}
      </div>

      <div className="absolute inset-0 z-[10000] flex">
        <button 
          onClick={handlePrevSlide}
          className="w-[40%] h-full"
          aria-label="Slide précédent"
        />
        <button 
          onClick={handleNextSlide}
          className="flex-1 h-full"
          aria-label="Slide suivant"
        />
      </div>

      <div className="absolute top-[calc(env(safe-area-inset-top)+70px)] right-4 z-[10001]">
        <div className="bg-black/40 backdrop-blur-md px-2 py-1 rounded-full">
          <span className="text-white text-xs font-bold">
            {slideIdx + 1}/{allSlides.length}
          </span>
        </div>
      </div>

      {owner?._id !== currentUser?._id && (
        <div className="absolute bottom-[calc(env(safe-area-inset-bottom)+20px)] left-4 right-4 z-[10001] flex items-center gap-3">
          <input
            type="text"
            placeholder="Envoyer un message..."
            className="flex-1 px-4 py-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-full text-white placeholder-white/60 outline-none focus:bg-white/20 transition-all"
            onClick={(e) => e.stopPropagation()}
          />
          <button className="p-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-full text-white hover:bg-white/20 active:scale-95 transition-all">
            <Heart size={20} />
          </button>
          <button className="p-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-full text-white hover:bg-white/20 active:scale-95 transition-all">
            <Send size={20} />
          </button>
        </div>
      )}

      <div className="absolute bottom-2 text-white/20 text-[9px] font-bold tracking-widest pointer-events-none uppercase">
        Glisser vers le bas pour fermer
      </div>
    </motion.div>
  );
}