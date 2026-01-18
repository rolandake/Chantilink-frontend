import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function SplashScreen({ onFinish }) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Masquer le splash natif immédiatement si présent
    if (typeof window.hideSplashScreen === 'function') {
      window.hideSplashScreen();
    }

    // Afficher le splash React pendant 1.2s minimum
    const timer = setTimeout(() => {
      setIsVisible(false);
      // Attendre la fin de l'animation de fade-out avant d'appeler onFinish
      setTimeout(() => onFinish?.(), 300);
    }, 1200);

    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, #2B2D42 0%, #1a1b2e 100%)'
          }}
        >
          {/* Logo avec animation fluide */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ 
              duration: 0.6, 
              ease: [0, 0.71, 0.2, 1.01]
            }}
            className="flex flex-col items-center"
          >
            {/* Logo avec effet de flottement */}
            <motion.img 
              src="/chantilink-logo.png" 
              alt="ChantiLink"
              className="w-32 h-32 md:w-40 md:h-40 object-contain mb-6"
              animate={{ 
                y: [0, -10, 0],
                scale: [1, 1.05, 1]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              style={{
                filter: 'drop-shadow(0 10px 40px rgba(230, 126, 60, 0.4))'
              }}
            />
            
            {/* Texte avec gradient */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-center"
            >
              <h1 className="text-4xl font-black tracking-tight text-white uppercase">
                CHANTI<span className="bg-gradient-to-r from-[#E67E3C] to-[#ff9966] bg-clip-text text-transparent">LINK</span>
              </h1>
              
              {/* Barre animée */}
              <motion.div 
                className="mt-3 h-1 bg-gradient-to-r from-transparent via-[#E67E3C] to-transparent mx-auto rounded-full"
                initial={{ width: 0 }}
                animate={{ width: 60 }}
                transition={{ delay: 0.5, duration: 0.4 }}
              />
            </motion.div>
          </motion.div>

          {/* Indicateur de chargement avec effet néon */}
          <div className="absolute bottom-16">
            <div className="flex gap-2">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  animate={{ 
                    opacity: [0.3, 1, 0.3],
                    scale: [1, 1.2, 1]
                  }}
                  transition={{ 
                    repeat: Infinity, 
                    duration: 1.2, 
                    delay: i * 0.15 
                  }}
                  className="w-2.5 h-2.5 rounded-full bg-[#E67E3C]"
                  style={{
                    boxShadow: '0 0 10px rgba(230, 126, 60, 0.5)'
                  }}
                />
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}