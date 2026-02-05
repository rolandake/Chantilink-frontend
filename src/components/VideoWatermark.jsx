// ============================================
// 📁 src/components/VideoWatermark.jsx
// WATERMARK VIDÉO STYLE TIKTOK/INSTAGRAM
// ============================================
import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const VideoWatermark = ({ videoRef, isPlaying = false, showFinalWatermark = false }) => {
  const [showFloating, setShowFloating] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const intervalRef = useRef(null);
  const timeoutRef = useRef(null);

  // 🎯 POSITIONS ALÉATOIRES POUR LE WATERMARK FLOTTANT
  const getRandomPosition = () => {
    // Positions possibles (évite les bords)
    const positions = [
      { x: 15, y: 15 },   // Haut gauche
      { x: 15, y: 50 },   // Milieu gauche
      { x: 15, y: 85 },   // Bas gauche
      { x: 50, y: 15 },   // Haut centre
      { x: 50, y: 85 },   // Bas centre
      { x: 85, y: 15 },   // Haut droite
      { x: 85, y: 50 },   // Milieu droite
      { x: 85, y: 85 },   // Bas droite
    ];
    return positions[Math.floor(Math.random() * positions.length)];
  };

  // 🎬 GESTION DE L'AFFICHAGE PENDANT LA LECTURE
  useEffect(() => {
    if (!isPlaying || showFinalWatermark) {
      setShowFloating(false);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      return;
    }

    // Fonction pour afficher le watermark à des intervalles aléatoires
    const scheduleNextAppearance = () => {
      // Attendre entre 3 et 8 secondes avant la prochaine apparition
      const delay = Math.random() * 5000 + 3000;
      
      timeoutRef.current = setTimeout(() => {
        setPosition(getRandomPosition());
        setShowFloating(true);

        // Le watermark reste visible pendant 2-4 secondes
        const visibleDuration = Math.random() * 2000 + 2000;
        setTimeout(() => {
          setShowFloating(false);
          scheduleNextAppearance(); // Programmer la prochaine apparition
        }, visibleDuration);
      }, delay);
    };

    // Démarrer le cycle d'apparitions
    scheduleNextAppearance();

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [isPlaying, showFinalWatermark]);

  return (
    <>
      {/* 🌊 WATERMARK FLOTTANT PENDANT LA LECTURE */}
      <AnimatePresence>
        {showFloating && !showFinalWatermark && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.3 }}
            className="absolute z-50 pointer-events-none select-none"
            style={{
              left: `${position.x}%`,
              top: `${position.y}%`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <div className="relative">
              {/* Effet de lueur */}
              <div className="absolute inset-0 bg-orange-500/30 blur-xl rounded-full animate-pulse" />
              
              {/* Logo principal avec glassmorphism */}
              <div className="relative backdrop-blur-md bg-white/10 border border-white/20 rounded-2xl px-4 py-2 shadow-2xl">
                <div className="flex items-center gap-2">
                  {/* Icône avec animation */}
                  <motion.div
                    animate={{ rotate: [0, 5, -5, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="relative"
                  >
                    <div className="w-6 h-6 bg-gradient-to-br from-orange-400 to-orange-600 rounded-lg flex items-center justify-center shadow-lg">
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M13.5 2c-5.629 0-10.212 4.436-10.475 10h-3.025l4.537 5.917 4.463-5.917h-2.975c.26-3.902 3.508-7 7.475-7 4.136 0 7.5 3.364 7.5 7.5s-3.364 7.5-7.5 7.5c-2.381 0-4.502-1.119-5.876-2.854l-1.847 2.449c1.919 2.088 4.664 3.405 7.723 3.405 5.798 0 10.5-4.702 10.5-10.5s-4.702-10.5-10.5-10.5z"/>
                      </svg>
                    </div>
                    {/* Points décoratifs */}
                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-400 rounded-full animate-ping" />
                    <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-orange-400 rounded-full" />
                  </motion.div>

                  {/* Texte avec dégradé */}
                  <span className="font-black text-lg bg-gradient-to-r from-orange-400 via-orange-500 to-orange-600 bg-clip-text text-transparent drop-shadow-lg">
                    chantilink
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🎬 WATERMARK FINAL (AFFICHÉ À LA FIN DE LA VIDÉO) */}
      <AnimatePresence>
        {showFinalWatermark && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none select-none"
            style={{ background: 'radial-gradient(circle, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 100%)' }}
          >
            <div className="text-center">
              {/* Logo animé grand format */}
              <motion.div
                animate={{ 
                  scale: [1, 1.05, 1],
                  rotate: [0, 2, -2, 0]
                }}
                transition={{ 
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="relative mb-6"
              >
                {/* Cercles décoratifs */}
                <div className="absolute inset-0 animate-spin-slow">
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-3 bg-orange-400 rounded-full" />
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3 h-3 bg-yellow-400 rounded-full" />
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-orange-500 rounded-full" />
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-yellow-500 rounded-full" />
                </div>

                {/* Logo principal */}
                <div className="relative backdrop-blur-xl bg-gradient-to-br from-white/20 to-white/5 border-2 border-white/30 rounded-3xl p-8 shadow-2xl">
                  <div className="flex items-center gap-4">
                    {/* Icône grande taille */}
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-br from-orange-400 to-orange-600 rounded-2xl blur-xl opacity-50" />
                      <div className="relative w-16 h-16 bg-gradient-to-br from-orange-400 via-orange-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-2xl">
                        <svg className="w-10 h-10 text-white drop-shadow-lg" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M13.5 2c-5.629 0-10.212 4.436-10.475 10h-3.025l4.537 5.917 4.463-5.917h-2.975c.26-3.902 3.508-7 7.475-7 4.136 0 7.5 3.364 7.5 7.5s-3.364 7.5-7.5 7.5c-2.381 0-4.502-1.119-5.876-2.854l-1.847 2.449c1.919 2.088 4.664 3.405 7.723 3.405 5.798 0 10.5-4.702 10.5-10.5s-4.702-10.5-10.5-10.5z"/>
                        </svg>
                        {/* Particules brillantes */}
                        <div className="absolute -top-2 -right-2 w-4 h-4 bg-yellow-300 rounded-full animate-bounce" />
                        <div className="absolute -bottom-2 -left-2 w-3 h-3 bg-orange-300 rounded-full animate-pulse" />
                      </div>
                    </div>

                    {/* Texte */}
                    <div>
                      <h1 className="font-black text-5xl bg-gradient-to-r from-orange-300 via-orange-400 to-yellow-400 bg-clip-text text-transparent drop-shadow-2xl">
                        chantilink
                      </h1>
                      <p className="text-white/90 text-sm font-semibold mt-1 drop-shadow-lg">
                        Construction Industry Platform
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Bouton d'action (optionnel) */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 }}
                className="backdrop-blur-lg bg-white/10 border border-white/20 rounded-full px-6 py-3 inline-flex items-center gap-2 shadow-xl hover:bg-white/20 transition-all cursor-pointer"
              >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-white font-bold text-sm">Rejouer</span>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 📍 WATERMARK PERMANENT EN BAS À DROITE (TRÈS DISCRET) */}
      <div className="absolute bottom-4 right-4 z-40 pointer-events-none select-none">
        <div className="backdrop-blur-sm bg-black/20 border border-white/10 rounded-lg px-3 py-1.5 shadow-lg">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 bg-gradient-to-br from-orange-400 to-orange-600 rounded flex items-center justify-center">
              <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </div>
            <span className="text-white/80 text-xs font-bold">chantilink</span>
          </div>
        </div>
      </div>
    </>
  );
};

export default VideoWatermark;