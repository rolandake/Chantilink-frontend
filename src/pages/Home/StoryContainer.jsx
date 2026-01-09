// ============================================
// 📁 src/pages/Home/StoryContainer.jsx - AFFICHER TOUTES LES STORIES
// ============================================
import React, { useMemo, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Calculator, Zap, Triangle } from "lucide-react";
import { useStories } from "../../context/StoryContext";
import { useAuth } from "../../context/AuthContext";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const SERVER_URL = API_URL.replace('/api', '');

const MEDIA_URL = (path) => {
  if (!path) return null;
  if (path.startsWith("http") || path.startsWith("blob:")) return path;
  return `${SERVER_URL}/${path.replace(/^\/+/, "")}`;
};

// ========================================
// STORY ITEM
// ========================================
const StoryItem = memo(({ owner, unviewed, latest, isDarkMode, onClick, isCurrentUser = false }) => {
  const slide = latest?.slides?.at(-1);
  const mediaSrc = slide?.mediaUrl || slide?.media;
  const ownerName = owner?.username || owner?.fullName || "User";
  
  const isTechnical = useMemo(() => {
    return latest?.slides?.some(s => 
      (s.content || s.text || "").toLowerCase().includes("calcul") || 
      s.metadata?.linkType === "calculation"
    );
  }, [latest]);

  const isFresh = useMemo(() => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return new Date(latest?.createdAt) > oneHourAgo;
  }, [latest]);

  return (
    <motion.button
      className="flex flex-col items-center flex-shrink-0 group relative snap-center"
      whileTap={{ scale: 0.92 }}
      onClick={onClick}
    >
      <div className={`relative w-[68px] h-[68px] md:w-16 md:h-16 rounded-full p-[2.5px] transition-all ${
        isCurrentUser
          ? "bg-gradient-to-tr from-purple-600 via-pink-500 to-orange-500 shadow-lg shadow-orange-500/30"
          : unviewed 
            ? "bg-gradient-to-tr from-purple-600 via-pink-500 to-orange-500 shadow-md shadow-orange-500/20" 
            : "bg-gray-300 dark:bg-white/10"
      }`}>
        
        <div className="w-full h-full rounded-full overflow-hidden bg-white dark:bg-black border-[3px] border-white dark:border-[#0b0d10] relative">
          <img 
            src={MEDIA_URL(owner?.profilePhoto) || MEDIA_URL(mediaSrc)} 
            alt={ownerName} 
            className={`w-full h-full object-cover ${!unviewed && !isCurrentUser && 'opacity-60 grayscale-[0.3]'}`}
            loading="lazy"
          />
        </div>

        {isTechnical && (
          <div className="absolute -top-1 -right-1 bg-orange-600 text-white p-1 rounded-full shadow-lg border-2 border-white dark:border-[#0b0d10]">
            <Calculator size={10} strokeWidth={3} />
          </div>
        )}

        {isFresh && (unviewed || isCurrentUser) && (
          <div className="absolute -bottom-1 -right-1 bg-gradient-to-tr from-yellow-400 to-orange-500 text-white p-1 rounded-full shadow-lg border-2 border-white dark:border-[#0b0d10]">
            <Zap size={10} strokeWidth={3} fill="currentColor" />
          </div>
        )}
      </div>
      
      <p className={`text-[10px] mt-2 font-bold tracking-tight truncate w-16 text-center ${
        isCurrentUser
          ? (isDarkMode ? "text-white" : "text-gray-900")
          : unviewed 
            ? (isDarkMode ? "text-white" : "text-gray-900") 
            : "text-gray-500"
      }`}>
        {isCurrentUser ? "Votre story" : ownerName}
      </p>
    </motion.button>
  );
});

// ========================================
// CONTAINER PRINCIPAL
// ========================================
const StoryContainer = ({ onOpenStory, onOpenCreator, onOpenPyramid, isDarkMode }) => {
  const { stories = [], loading = false, myStories } = useStories();
  const { user } = useAuth();
  const uid = user?._id || user?.id;

  // ✅ MODIFICATION : On groupe TOUTES les stories (y compris celles de l'utilisateur courant)
  const allGroupedStories = useMemo(() => {
    if (!stories || stories.length === 0) return [];
    
    const map = {};
    
    // Grouper toutes les stories par propriétaire
    for (const s of stories) {
      if (!s.owner) continue;
      
      const ownerId = s.owner._id || s.owner;
      
      if (!map[ownerId]) {
        map[ownerId] = { 
          owner: typeof s.owner === 'object' ? s.owner : { _id: ownerId, fullName: "Utilisateur" }, 
          stories: [] 
        };
      }
      
      map[ownerId].stories.push(s);
    }

    // Transformer en tableau et calculer les propriétés
    return Object.values(map).map(data => {
      const slides = data.stories.flatMap(s => s.slides || []);
      const unviewed = slides.some(sl => 
        !(sl.views || []).some(v => (typeof v === "string" ? v : v._id) === uid)
      );
      const latest = data.stories.reduce(
        (l, c) => new Date(c.createdAt) > new Date(l.createdAt) ? c : l, 
        data.stories[0]
      );
      
      const isCurrentUser = data.owner._id === uid;
      
      return { 
        id: data.owner._id, 
        owner: data.owner, 
        stories: data.stories, 
        unviewed, 
        latest,
        isCurrentUser
      };
    })
    // Trier : stories non vues d'abord, puis par date
    .sort((a, b) => {
      // L'utilisateur courant passe en premier si il a une story
      if (a.isCurrentUser) return -1;
      if (b.isCurrentUser) return 1;
      
      // Ensuite, stories non vues en premier
      if (a.unviewed !== b.unviewed) return b.unviewed - a.unviewed;
      
      // Puis par date (plus récent en premier)
      return new Date(b.latest.createdAt) - new Date(a.latest.createdAt);
    });
  }, [stories, uid]);

  const unviewedCount = useMemo(() => 
    allGroupedStories.filter(o => o.unviewed && !o.isCurrentUser).length, 
    [allGroupedStories]
  );

  if (loading && stories.length === 0) {
    return (
      <div className="flex gap-4 px-4 py-4 overflow-x-hidden">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-800 animate-pulse flex-shrink-0" />
        ))}
      </div>
    );
  }

  return (
    <div className="relative group w-full overflow-hidden pb-2">
      
      {/* 🟢 LISTE SCROLLABLE (Snap Scroll activé) */}
      <div className="flex gap-4 px-4 pt-4 pb-2 overflow-x-auto scrollbar-hide snap-x snap-mandatory">
        
        {/* 1. BOUTON AJOUTER */}
        <motion.button
          onClick={onOpenCreator}
          whileTap={{ scale: 0.95 }}
          className="flex flex-col items-center flex-shrink-0 snap-start"
        >
          <div className="relative w-[68px] h-[68px] md:w-16 md:h-16 rounded-full bg-gradient-to-br from-gray-100 to-gray-50 dark:from-white/5 dark:to-white/10 border-2 border-dashed border-gray-300 dark:border-white/20 flex items-center justify-center hover:border-orange-500 dark:hover:border-orange-500 transition-colors">
            {user?.profilePhoto ? (
              <>
                <img src={MEDIA_URL(user.profilePhoto)} className="w-full h-full rounded-full object-cover opacity-40" alt="" />
                <div className="absolute bg-gradient-to-tr from-orange-500 to-pink-500 rounded-full p-1.5 border-[3px] border-white dark:border-[#0b0d10] bottom-0 right-0 shadow-lg">
                  <Plus size={10} className="text-white" strokeWidth={4} />
                </div>
              </>
            ) : (
              <div className="absolute bg-gradient-to-tr from-orange-500 to-pink-500 rounded-full p-1.5 border-[3px] border-white dark:border-[#0b0d10] bottom-0 right-0 shadow-lg">
                <Plus size={10} className="text-white" strokeWidth={4} />
              </div>
            )}
          </div>
          <p className="text-[10px] mt-2 font-bold text-gray-500 uppercase tracking-tighter">Créer</p>
        </motion.button>

        {/* 2. TOUTES LES STORIES (y compris celle de l'utilisateur si elle existe) */}
        {allGroupedStories.map((group) => (
          <div key={group.id} className="snap-start">
            <StoryItem 
              owner={group.owner} 
              latest={group.latest} 
              unviewed={group.unviewed} 
              isDarkMode={isDarkMode} 
              onClick={() => onOpenStory(group.stories, group.owner)}
              isCurrentUser={group.isCurrentUser}
            />
          </div>
        ))}

        {/* Padding final pour compenser le bouton flottant sur mobile */}
        <div className="flex-shrink-0 w-24 md:hidden" />
      </div>

      {/* 🔴 BOUTON UNIVERS FLOTTANT (Visible sur tous les écrans) */}
      <AnimatePresence>
        {unviewedCount > 0 && (
          <motion.button
            initial={{ y: 50, opacity: 0, scale: 0.8 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 50, opacity: 0, scale: 0.8 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onOpenPyramid}
            className={`absolute top-1/2 -translate-y-1/2 right-2 z-[100] px-3 py-2 rounded-full flex items-center gap-2 shadow-[0_8px_24px_rgba(249,115,22,0.35)] transition-all ${
              isDarkMode 
                ? 'bg-gradient-to-r from-orange-600 to-pink-600 border border-white/10' 
                : 'bg-gradient-to-r from-orange-500 to-pink-500 border border-white/50'
            }`}
          >
            <div className="relative">
              <Triangle size={12} className="text-white fill-white rotate-180" />
              <motion.div 
                animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0, 0.6] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute inset-0 bg-white rounded-full blur-sm"
              />
            </div>
            <span className="text-white text-[10px] font-black tracking-wide uppercase hidden sm:inline">
              Univers
            </span>
            <div className="bg-white/20 backdrop-blur-sm rounded-full px-1.5 py-0.5 min-w-[18px] flex items-center justify-center">
              <span className="text-white text-[10px] font-black">{unviewedCount}</span>
            </div>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
};

export default memo(StoryContainer);