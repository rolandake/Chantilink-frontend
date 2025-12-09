// ============================================
// 📁 src/pages/Home/StoryContainer.jsx
// ============================================
import React, { useMemo, useCallback, memo } from "react";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { useStories } from "../../context/StoryContext";
import { useAuth } from "../../context/AuthContext";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

// --- HELPER URL SÉCURISÉ ---
const url = (path) => {
  if (!path) return null;
  if (path.startsWith("http") || path.startsWith("blob:")) return path;
  // Gestion propre du slash
  return `${API}${path.startsWith('/') ? '' : '/'}${path}`;
};

// ========================================
// 1. SOUS-COMPOSANT MÉMOÏSÉ (Item Story)
// ========================================
const StoryItem = memo(({ owner, unviewed, latest, isDarkMode, onClick }) => {
  // Récupération sécurisée de la dernière slide
  const slide = latest?.slides?.at(-1);
  
  // Correction : Backend renvoie 'mediaUrl', on gère les deux cas
  const mediaSrc = slide?.mediaUrl || slide?.media;
  
  const ownerName = owner?.username || owner?.fullName || "Utilisateur";
  const ownerPhoto = owner?.profilePhoto;
  const ownerInitial = ownerName[0]?.toUpperCase() || "?";

  return (
    <motion.button
      className="flex flex-col items-center flex-shrink-0 group cursor-pointer"
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
    >
      {/* CERCLE DE CONTOUR */}
      <div className={`relative w-16 h-16 rounded-full p-[3px] transition-all ${
        unviewed 
          ? "bg-gradient-to-tr from-yellow-400 via-orange-500 to-fuchsia-600" 
          : "bg-gray-300 dark:bg-gray-700"
      }`}>
        
        {/* AVATAR / MINIATURE */}
        <div className="w-full h-full rounded-full overflow-hidden bg-white dark:bg-black border-2 border-white dark:border-gray-900 relative">
          {ownerPhoto ? (
            <img 
              src={url(ownerPhoto)} 
              alt={ownerName} 
              className="w-full h-full object-cover" 
              loading="lazy"
              onError={(e) => e.target.style.display = 'none'} 
            />
          ) : mediaSrc ? (
            <img 
              src={url(mediaSrc)} 
              alt={ownerName} 
              className="w-full h-full object-cover" 
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center">
              <span className="text-white text-xl font-bold">{ownerInitial}</span>
            </div>
          )}
        </div>
      </div>
      
      {/* NOM UTILISATEUR */}
      <p className={`text-xs mt-1.5 font-medium truncate w-16 text-center ${
        isDarkMode ? "text-gray-300" : "text-gray-700"
      }`}>
        {ownerName}
      </p>
    </motion.button>
  );
});

StoryItem.displayName = 'StoryItem';

// ========================================
// 2. COMPOSANT PRINCIPAL
// ========================================
const StoryContainer = ({ onOpenStory, onOpenCreator, isDarkMode }) => {
  // 1. Hooks Context
  const { stories = [], loading = false, myStories } = useStories();
  const { user } = useAuth();
  
  const uid = user?._id || user?.id;

  // 2. Préparer "Mes Stories" (Sécurité si myStories est undefined)
  const my = useMemo(() => myStories || [], [myStories]);

  // 3. Préparer "Stories des Autres" (Groupement + Tri)
  const others = useMemo(() => {
    if (!stories) return [];

    const otherStoriesMap = {};

    for (const s of stories) {
      // Ignorer mes stories et celles sans propriétaire
      if (!s.owner || (s.owner._id || s.owner) === uid) continue;

      const ownerId = s.owner._id || s.owner;
      if (!otherStoriesMap[ownerId]) {
        otherStoriesMap[ownerId] = { owner: s.owner, stories: [] };
      }
      otherStoriesMap[ownerId].stories.push(s);
    }

    // Convertir en tableau et trier
    return Object.values(otherStoriesMap).map(data => {
        const userStories = data.stories;
        
        // Calculer s'il y a du nouveau (non vu)
        const slides = userStories.flatMap(s => s.slides || []);
        const unviewed = slides.some(sl => 
            !(sl.views || []).some(v => (typeof v === "string" ? v : v._id) === uid)
        );

        // Trouver la plus récente
        const latest = userStories.reduce((last, curr) => 
            new Date(curr.createdAt) > new Date(last.createdAt) ? curr : last
        , userStories[0]);

        return { id: data.owner._id, owner: data.owner, stories: userStories, unviewed, latest };
    }).sort((a, b) => {
        // Tri : Non-vus d'abord, puis par date récente
        if (a.unviewed !== b.unviewed) return b.unviewed - a.unviewed;
        return new Date(b.latest.createdAt) - new Date(a.latest.createdAt);
    });

  }, [stories, uid]);

  // Vérifier si MA story a des vues (point vert)
  const hasViews = useMemo(() => 
    my.some(s => s.slides?.some(sl => (sl.views || []).length > 0)), 
  [my]);

  // Gestionnaire d'ouverture
  const handleOpen = useCallback((list, owner) => {
    if (onOpenStory) onOpenStory(list, owner);
  }, [onOpenStory]);


  // --- RENDU : LOADING ---
  if (loading && stories.length === 0) {
    return (
      <div className="flex gap-4 px-4 overflow-x-auto pb-2 scrollbar-hide min-h-[110px] items-center">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex flex-col items-center flex-shrink-0 animate-pulse">
            <div className={`w-16 h-16 rounded-full ${isDarkMode ? "bg-gray-800" : "bg-gray-200"}`} />
            <div className={`w-12 h-2 mt-2 rounded-full ${isDarkMode ? "bg-gray-800" : "bg-gray-200"}`} />
          </div>
        ))}
      </div>
    );
  }

  // --- RENDU : PRINCIPAL ---
  return (
    <div className="flex gap-4 px-4 overflow-x-auto pb-2 scrollbar-hide items-start min-h-[110px]">
      
      {/* 1. BOUTON CRÉER */}
      <motion.button
        className="flex flex-col items-center flex-shrink-0 group cursor-pointer"
        onClick={onOpenCreator}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <div className={`relative w-16 h-16 rounded-full overflow-hidden shadow-md border-2 ${
          isDarkMode ? "border-gray-700" : "border-orange-100"
        }`}>
          {user?.profilePhoto ? (
            <img 
              src={url(user.profilePhoto)} 
              alt="Moi" 
              className="w-full h-full object-cover opacity-90"
            />
          ) : (
            <div className={`w-full h-full flex items-center justify-center ${isDarkMode ? "bg-gray-800" : "bg-gray-200"}`}>
               <Plus className="w-6 h-6 text-gray-500" />
            </div>
          )}
          
          <div className="absolute inset-0 bg-black/10 flex items-center justify-center group-hover:bg-black/20 transition-colors">
            <div className="bg-orange-500 rounded-full p-1 shadow-lg border-2 border-white dark:border-black">
              <Plus className="w-4 h-4 text-white" strokeWidth={3} />
            </div>
          </div>
        </div>
        <p className={`text-xs mt-1.5 font-medium ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>
          Créer
        </p>
      </motion.button>

      {/* 2. MA STORY (Si existe) */}
      {my.length > 0 && (
        <motion.button
          className="flex flex-col items-center flex-shrink-0 group cursor-pointer"
          onClick={() => handleOpen(my, user)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <div className="relative w-16 h-16 rounded-full p-[2px] shadow-md">
            {/* Bordure */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-blue-400 to-indigo-500" />
            
            <div className="w-full h-full rounded-full overflow-hidden bg-white dark:bg-black relative border-2 border-white dark:border-gray-900">
               {/* Miniature dernière slide */}
               {(() => {
                 const lastMedia = my.at(-1)?.slides?.at(-1);
                 const src = lastMedia?.mediaUrl || lastMedia?.media;
                 
                 if (src) {
                   return <img src={url(src)} alt="My story" className="w-full h-full object-cover" />;
                 }
                 return <div className="w-full h-full bg-gradient-to-br from-blue-400 to-indigo-500" />;
               })()}
              
              <div className="absolute bottom-0 w-full bg-black/60 backdrop-blur-sm text-[8px] text-white text-center py-0.5 font-bold">
                VOUS
              </div>
            </div>
            
            {/* Point Vert (Nouvelles Vues) */}
            {hasViews && (
              <div className="absolute top-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white dark:border-gray-900 rounded-full z-20" />
            )}
          </div>
          <p className={`text-xs mt-1.5 font-medium ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>
            Ma story
          </p>
        </motion.button>
      )}

      {/* 3. AUTRES STORIES */}
      {others.map((u) => (
        <StoryItem
          key={u.id}
          owner={u.owner}
          unviewed={u.unviewed}
          latest={u.latest}
          isDarkMode={isDarkMode}
          onClick={() => handleOpen(u.stories, u.owner)}
        />
      ))}
      
      {/* 4. VIDE */}
      {!loading && stories.length === 0 && my.length === 0 && (
        <div className="flex flex-col justify-center h-16 ml-4">
           <p className="text-xs text-gray-400 italic">Aucune story</p>
        </div>
      )}

    </div>
  );
};

export default memo(StoryContainer);