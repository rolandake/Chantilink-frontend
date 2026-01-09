// 📁 src/pages/Home/StoryViewer.jsx
import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { X, Loader2 } from "lucide-react";

const SERVER_URL = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace('/api', '');
const MEDIA_URL = (path) => path?.startsWith("http") ? path : `${SERVER_URL}/${path?.replace(/^\/+/, "")}`;

export default function StoryViewer({ stories = [], currentUser, onClose }) {
  const [slideIdx, setSlideIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  
  const story = stories[0] || {}; // On prend le premier groupe d'un utilisateur
  const slide = story.slides?.[slideIdx];

  // ✅ Prévenir le setState pendant le render
  useEffect(() => {
    if (!slide) {
      // Si pas de slide, fermer proprement
      const timer = setTimeout(onClose, 0);
      return () => clearTimeout(timer);
    }
  }, [slide, onClose]);

  useEffect(() => {
    if (!isLoaded || !slide) return;
    const duration = 5000;
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          if (slideIdx < story.slides.length - 1) {
            setSlideIdx(s => s + 1);
            setProgress(0);
            setIsLoaded(false);
          } else {
            onClose();
          }
          return 0;
        }
        return p + (100 / (duration / 100));
      });
    }, 100);
    return () => clearInterval(interval);
  }, [slideIdx, isLoaded, story.slides, onClose, slide]);

  // ✅ useCallback pour éviter les re-renders inutiles
  const handlePrevSlide = useCallback(() => {
    if (slideIdx > 0) {
      setSlideIdx(s => s - 1);
      setProgress(0);
      setIsLoaded(false);
    }
  }, [slideIdx]);

  const handleNextSlide = useCallback(() => {
    if (slideIdx < story.slides.length - 1) {
      setSlideIdx(s => s + 1);
      setProgress(0);
      setIsLoaded(false);
    } else {
      onClose();
    }
  }, [slideIdx, story.slides, onClose]);

  const handleDragEnd = useCallback((_, info) => {
    if (info.offset.y > 100) onClose();
  }, [onClose]);

  // ✅ Ne pas rendre si pas de slide
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
      {/* Progress Bars (Optimisées encoche iPhone) */}
      <div className="absolute top-[calc(env(safe-area-inset-top)+10px)] left-4 right-4 z-[10001] flex gap-1">
        {story.slides.map((_, i) => (
          <div key={i} className="h-1 flex-1 bg-white/20 rounded-full overflow-hidden">
            <div 
              className="h-full bg-white transition-all duration-100 ease-linear" 
              style={{ width: i === slideIdx ? `${progress}%` : i < slideIdx ? '100%' : '0%' }} 
            />
          </div>
        ))}
      </div>

      {/* Bouton Fermer */}
      <button 
        onClick={onClose} 
        className="absolute top-[calc(env(safe-area-inset-top)+25px)] right-4 z-[10001] p-2 bg-black/20 backdrop-blur-md rounded-full text-white"
      >
        <X size={24}/>
      </button>

      {/* Média */}
      <div className="w-full h-full flex items-center justify-center relative">
        {!isLoaded && (
          <Loader2 className="animate-spin text-white/20 absolute" size={40}/>
        )}
        {slide.type === "video" ? (
          <video 
            key={`video-${slideIdx}`}
            src={MEDIA_URL(slide.mediaUrl || slide.media)} 
            onLoadedData={() => setIsLoaded(true)}
            autoPlay 
            playsInline 
            className="w-full h-full object-contain"
          />
        ) : (
          <img 
            key={`img-${slideIdx}`}
            src={MEDIA_URL(slide.mediaUrl || slide.media)} 
            onLoad={() => setIsLoaded(true)}
            alt="Story"
            className="w-full h-full object-contain"
          />
        )}
      </div>

      {/* Zones de Clic (Navigation tactile facile) */}
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

      {/* Swipe Hint Footer */}
      <div className="absolute bottom-6 text-white/30 text-[10px] font-bold tracking-widest pointer-events-none uppercase">
        Glisser vers le bas pour fermer
      </div>
    </motion.div>
  );
}