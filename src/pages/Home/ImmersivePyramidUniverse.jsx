// 📁 src/pages/Home/ImmersivePyramidUniverse.jsx
import React, { useEffect, useState, useMemo } from "react";
import { motion, useMotionValue, useTransform, useSpring } from "framer-motion";
import { X, Plus, Sparkles, Zap } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const SERVER_URL = API_URL.replace('/api', '');

const MEDIA_URL = (path) => {
  if (!path) return null;
  if (path.startsWith("http") || path.startsWith("blob:")) return path;
  return `${SERVER_URL}/${path.replace(/^\/+/, "")}`;
};

const ImmersivePyramidUniverse = ({ 
  stories = [], 
  myStories = [],
  user,
  onClose, 
  onOpenStory, 
  onOpenCreator, 
  isDarkMode 
}) => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // --- LOGIQUE PARALLAXE ---
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // Amortissement pour un mouvement fluide
  const springX = useSpring(mouseX, { stiffness: 60, damping: 25 });
  const springY = useSpring(mouseY, { stiffness: 60, damping: 25 });

  // Translation légère de l'univers (effet profondeur)
  const rotateX = useTransform(springY, [-400, 400], [8, -8]);
  const rotateY = useTransform(springX, [-400, 400], [-8, 8]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleInteraction = (e) => {
    const { clientX, clientY } = e.touches ? e.touches[0] : e;
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    mouseX.set(clientX - centerX);
    mouseY.set(clientY - centerY);
  };

  // Coordonnées de la constellation (Pyramide souple)
  const levels = useMemo(() => [
    [{ x: 50, y: 18 }], // Sommet (Créer)
    [{ x: isMobile ? 32 : 38, y: 32 }, { x: isMobile ? 68 : 62, y: 32 }], // Niveau 2
    [{ x: isMobile ? 22 : 28, y: 46 }, { x: 50, y: 46 }, { x: isMobile ? 78 : 72, y: 46 }], // Niveau 3
    [{ x: 15, y: 60 }, { x: 38, y: 60 }, { x: 62, y: 60 }, { x: 85, y: 60 }], // Niveau 4
    [{ x: 10, y: 74 }, { x: 30, y: 74 }, { x: 50, y: 74 }, { x: 70, y: 74 }, { x: 90, y: 74 }], // Base
  ], [isMobile]);

  // Regrouper les stories par utilisateur
  const groupedStories = useMemo(() => {
    const grouped = {};
    
    stories.forEach(story => {
      const ownerId = story.owner?._id || story.owner;
      if (!grouped[ownerId]) {
        grouped[ownerId] = {
          owner: story.owner,
          stories: []
        };
      }
      grouped[ownerId].stories.push(story);
    });

    return Object.values(grouped).map(group => {
      // Vérifier si l'utilisateur a vu toutes les slides
      const allSlides = group.stories.flatMap(s => s.slides || []);
      const unviewed = allSlides.some(slide => 
        !(slide.views || []).some(v => {
          const viewerId = typeof v === 'string' ? v : v._id;
          return viewerId === user?._id;
        })
      );

      // Trier par date et prendre la plus récente
      const sortedStories = [...group.stories].sort((a, b) => 
        new Date(b.createdAt) - new Date(a.createdAt)
      );
      
      const latestStory = sortedStories[0];
      const isFresh = latestStory ? (Date.now() - new Date(latestStory.createdAt).getTime()) < 3600000 : false;

      return {
        owner: group.owner,
        stories: sortedStories,
        unviewed,
        isFresh
      };
    }).sort((a, b) => {
      // Prioriser: non vues d'abord, puis par date
      if (a.unviewed !== b.unviewed) return b.unviewed - a.unviewed;
      return new Date(b.stories[0].createdAt) - new Date(a.stories[0].createdAt);
    });
  }, [stories, user]);

  let storyIdx = 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseMove={handleInteraction}
      onTouchMove={handleInteraction}
      className="fixed inset-0 z-[99999] bg-[#02040a] overflow-hidden select-none touch-none"
    >
      {/* Fond : Nébuleuse & Poussière d'étoiles */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,#1e293b_0%,transparent_75%)] opacity-40" />
        {[...Array(isMobile ? 30 : 70)].map((_, i) => (
          <motion.div 
            key={i}
            className="absolute bg-white rounded-full"
            style={{
              width: Math.random() * 2 + 1,
              height: Math.random() * 2 + 1,
              top: Math.random() * 100 + '%',
              left: Math.random() * 100 + '%',
              opacity: Math.random() * 0.4 + 0.1
            }}
            animate={{ opacity: [0.1, 0.4, 0.1] }}
            transition={{ duration: 2 + Math.random() * 3, repeat: Infinity }}
          />
        ))}
      </div>

      {/* Header UI */}
      <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-[100000]">
        <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}>
          <h1 className="text-white font-black text-2xl tracking-tighter flex items-center gap-2">
            <Zap className="text-orange-500 fill-orange-500" size={20} /> UNIVERS
          </h1>
          <p className="text-orange-400/50 text-[10px] font-bold tracking-[0.3em] uppercase">Cosmos Live</p>
        </motion.div>
        
        <button 
          onClick={onClose}
          className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white backdrop-blur-xl hover:bg-white/10 active:scale-90 transition-all"
        >
          <X size={24} />
        </button>
      </div>

      {/* Constellation de Stories */}
      <motion.div 
        style={{ rotateX, rotateY, perspective: 1000 }}
        className="relative w-full h-full flex items-center justify-center pointer-events-none"
      >
        <div className="relative w-full max-w-5xl h-[85vh] pointer-events-none">
          
          {/* Étoile de Création (Le Sommet) */}
          <motion.div
            className="absolute z-[60] pointer-events-auto"
            style={{ left: '50%', top: '18%', transform: 'translate(-50%, -50%)' }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={(e) => {
              e.stopPropagation();
              onOpenCreator();
            }}
          >
            <div className="relative cursor-pointer group">
              <motion.div 
                animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 4, repeat: Infinity }}
                className="absolute inset-[-20px] bg-orange-600/20 blur-2xl rounded-full" 
              />
              <div className="w-20 h-20 md:w-28 md:h-28 rounded-full bg-gradient-to-tr from-yellow-400 via-orange-500 to-red-600 p-[3px] shadow-[0_0_30px_rgba(249,115,22,0.3)]">
                <div className="w-full h-full rounded-full bg-black flex items-center justify-center border-2 border-black/50">
                  <Plus className="text-white" size={isMobile ? 32 : 44} strokeWidth={3} />
                </div>
              </div>
              <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-orange-400 font-black text-[10px] tracking-widest bg-orange-950/20 px-3 py-1 rounded-full border border-orange-500/10">CRÉER</span>
            </div>
          </motion.div>

          {/* Rendu des Stories (Étoiles) */}
          {levels.slice(1).map((level, lIdx) => 
            level.map((pos, pIdx) => {
              const storyData = groupedStories[storyIdx++];
              if (!storyData) return null;

              const size = isMobile ? (65 - lIdx * 4) : (95 - lIdx * 7);
              const driftDelay = Math.random() * 5;

              return (
                <motion.div
                  key={`star-${lIdx}-${pIdx}`}
                  className="absolute cursor-pointer pointer-events-auto"
                  style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: 'translate(-50%, -50%)' }}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ 
                    scale: 1, 
                    opacity: 1,
                    y: [0, -12, 0]
                  }}
                  transition={{ 
                    scale: { delay: storyIdx * 0.06 },
                    y: { duration: 4 + Math.random() * 3, repeat: Infinity, ease: "easeInOut", delay: driftDelay }
                  }}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    console.log('Story clicked:', storyData);
                    onOpenStory(storyData.stories, storyData.owner);
                  }}
                >
                  <div className="relative group">
                    {/* Halo lumineux si non vu */}
                    <motion.div 
                      className={`absolute inset-[-8px] rounded-full blur-lg ${storyData.unviewed ? 'bg-orange-500/40' : 'bg-gray-400/20'}`}
                      animate={storyData.unviewed ? { opacity: [0.3, 0.6, 0.3] } : {}}
                      transition={{ duration: 3, repeat: Infinity }}
                    />

                    {/* Avatar Bubble */}
                    <div 
                      style={{ width: size, height: size }}
                      className={`relative rounded-full p-[3px] transition-all ${
                        storyData.unviewed 
                          ? 'bg-gradient-to-tr from-purple-600 via-pink-500 to-orange-500' 
                          : 'bg-gray-600/30'
                      }`}
                    >
                      <div className="w-full h-full rounded-full overflow-hidden bg-gray-950 border-[3px] border-black relative">
                        <img 
                          src={MEDIA_URL(storyData.owner?.profilePhoto) || '/default-avatar.png'}
                          className={`w-full h-full object-cover transition-all duration-700 ${!storyData.unviewed && 'grayscale opacity-50'}`}
                          alt={storyData.owner?.username || 'user'}
                          onError={(e) => {
                            e.target.src = '/default-avatar.png';
                          }}
                        />
                      </div>

                      {storyData.isFresh && storyData.unviewed && (
                        <div className="absolute -top-1 -right-1 bg-gradient-to-tr from-yellow-400 to-orange-500 rounded-full p-1 shadow-lg border-2 border-black">
                          <Sparkles size={Math.max(size * 0.18, 10)} className="text-white" />
                        </div>
                      )}
                    </div>

                    {/* Username (Mobile-friendly) */}
                    <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap">
                      <span className={`text-[9px] font-bold tracking-tight uppercase ${storyData.unviewed ? 'text-orange-300' : 'text-gray-500/70'}`}>
                        {storyData.owner?.username || storyData.owner?.fullName?.split(' ')[0] || 'Utilisateur'}
                      </span>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </motion.div>

      {/* Footer Hint */}
      <div className="absolute bottom-10 left-0 right-0 flex flex-col items-center pointer-events-none opacity-40">
        <motion.div animate={{ y: [0, 5, 0] }} transition={{ duration: 2, repeat: Infinity }}>
          <div className="w-[1px] h-10 bg-gradient-to-b from-white to-transparent" />
        </motion.div>
        <span className="text-[9px] text-white font-black tracking-[0.4em] uppercase mt-2">
          {isMobile ? "Explorer l'espace" : "Utilisez la souris"}
        </span>
      </div>
    </motion.div>
  );
};

export default ImmersivePyramidUniverse;