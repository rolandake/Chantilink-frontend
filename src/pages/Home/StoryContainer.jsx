// src/pages/Home/StoryContainer.jsx - VERSION AVEC INFOS RÉELLES
import React, { useMemo, useCallback, memo } from "react";
import { motion } from "framer-motion";
import { Plus, Clock } from "lucide-react";
import { useStories } from "../../context/StoryContext";
import { useAuth } from "../../context/AuthContext";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";
const url = (p) =>
  p?.startsWith("http") ? p : p ? `${API}/${p.replace(/^\/+/, "")}` : "/placeholder.png";

const timeLeft = (e) => {
  if (!e) return "";
  const d = new Date(e) - Date.now();
  if (d <= 0) return "";
  const h = Math.floor(d / 3600000),
    m = Math.floor((d % 3600000) / 60000);
  return h > 0 ? `${h}h` : `${m}m`;
};

const StoryContainer = ({ onOpenStory, onOpenCreator, isDarkMode }) => {
  const { stories, loading } = useStories();
  const { user } = useAuth();
  const uid = user?._id || user?.id;

  // ═══════════════════════════════════════════════════════
  // ORGANISATION DES STORIES
  // ═══════════════════════════════════════════════════════
  const { my, others } = useMemo(() => {
    console.log("📊 [StoryContainer] Processing stories:", stories.length);
    
    const m = [];
    const o = {};
    
    for (const s of stories) {
      const ownerId = s.owner?._id || s.owner?.id || "unknown";
      
      console.log("🔍 [StoryContainer] Story owner data:", {
        storyId: s._id,
        ownerId,
        ownerUsername: s.owner?.username,
        ownerFullName: s.owner?.fullName,
        ownerEmail: s.owner?.email,
        ownerPhoto: s.owner?.profilePhoto
      });
      
      // Mes stories
      if (ownerId === uid) {
        m.push(s);
        console.log("✅ [StoryContainer] My story:", s._id, "slides:", s.slides?.length);
      } 
      // Stories des autres
      else {
        if (!o[ownerId]) {
          o[ownerId] = { 
            owner: s.owner, 
            stories: [] 
          };
        }
        o[ownerId].stories.push(s);
        console.log("👤 [StoryContainer] Other story:", {
          ownerId,
          username: s.owner?.username,
          fullName: s.owner?.fullName
        });
      }
    }
    
    console.log("📈 [StoryContainer] Result - My:", m.length, "Others:", Object.keys(o).length);
    return { my: m, others: o };
  }, [stories, uid]);

  // ═══════════════════════════════════════════════════════
  // LISTE DES UTILISATEURS AVEC STORIES
  // ═══════════════════════════════════════════════════════
  const users = useMemo(() => {
    return Object.entries(others)
      .map(([id, { owner, stories }]) => {
        const slides = stories.flatMap((s) => s.slides || []);
        
        // Vérifier si non vu
        const unviewed = slides.some(
          (sl) =>
            !(sl.views || []).some((v) => (typeof v === "string" ? v : v._id) === uid)
        );
        
        // Story la plus récente
        const latest = stories.reduce(
          (a, b) => (new Date(b.createdAt) > new Date(a.createdAt) ? b : a),
          stories[0]
        );
        
        console.log("👥 [StoryContainer] User story data:", {
          ownerId: id,
          username: owner?.username,
          fullName: owner?.fullName,
          email: owner?.email,
          photo: owner?.profilePhoto,
          storiesCount: stories.length,
          unviewed
        });
        
        return { 
          id, 
          owner, 
          stories, 
          unviewed, 
          latest, 
          total: slides.length 
        };
      })
      .sort((a, b) => {
        // Trier: non vues d'abord, puis par date
        if (a.unviewed !== b.unviewed) return b.unviewed - a.unviewed;
        return new Date(b.latest.createdAt) - new Date(a.latest.createdAt);
      });
  }, [others, uid]);

  // ═══════════════════════════════════════════════════════
  // VÉRIFIER SI MES STORIES ONT DES VUES
  // ═══════════════════════════════════════════════════════
  const hasViews = useMemo(
    () => my.some((s) => s.slides?.some((sl) => (sl.views || []).length > 0)),
    [my]
  );

  // ═══════════════════════════════════════════════════════
  // HANDLERS
  // ═══════════════════════════════════════════════════════
  const handleOpen = useCallback((stories, owner) => {
    console.log("🎬 [StoryContainer] Opening story viewer:", {
      storiesCount: stories.length,
      owner: owner?.username || owner?.fullName,
      ownerId: owner?._id,
      ownerEmail: owner?.email
    });
    onOpenStory?.(stories, owner);
  }, [onOpenStory]);

  const handleCreate = useCallback(() => {
    console.log("➕ [StoryContainer] Opening story creator");
    onOpenCreator?.();
  }, [onOpenCreator]);

  // ═══════════════════════════════════════════════════════
  // SKELETON LOADING
  // ═══════════════════════════════════════════════════════
  if (loading && !stories.length) {
    return (
      <div className="flex gap-4 px-1 overflow-x-auto">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex flex-col items-center flex-shrink-0">
            <div className="w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
            <div className="w-12 h-2 mt-2 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════
  return (
    <div className="flex gap-4 px-1 overflow-x-auto pb-2 scrollbar-hide">
      {/* ─────────────────────────────────────────────────────
          BOUTON CRÉER UNE STORY
      ───────────────────────────────────────────────────── */}
      <motion.button
        className="flex flex-col items-center flex-shrink-0 group"
        onClick={handleCreate}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
      >
        <div className={`relative w-16 h-16 rounded-full overflow-hidden shadow-xl border-2 ${
          isDarkMode ? "border-white/20" : "border-orange-200/50"
        }`}>
          {user?.profilePhoto ? (
            <img 
              src={url(user.profilePhoto)} 
              alt={user?.username || user?.fullName || "User"} 
              className="w-full h-full object-cover opacity-70" 
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center">
              <span className="text-white text-2xl font-bold">
                {(user?.username || user?.fullName || "?")[0]?.toUpperCase()}
              </span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-br from-orange-500/30 to-pink-500/30 flex items-center justify-center">
            <Plus className="w-7 h-7 text-white drop-shadow-md" strokeWidth={3} />
          </div>
        </div>
        <p className={`text-xs mt-1.5 font-medium ${
          isDarkMode ? "text-gray-300" : "text-gray-700"
        }`}>
          Créer
        </p>
      </motion.button>

      {/* ─────────────────────────────────────────────────────
          MA STORY
      ───────────────────────────────────────────────────── */}
      {my.length > 0 && (
        <motion.button
          className="flex flex-col items-center flex-shrink-0 group"
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => handleOpen(my, user)}
        >
          <div className="relative w-16 h-16 rounded-full p-0.5 shadow-xl">
            <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-cyan-400 via-blue-500 to-purple-600 opacity-80 group-hover:opacity-100 transition-opacity" />
            <div className="w-full h-full rounded-full overflow-hidden bg-white dark:bg-black relative">
              {/* Preview de la dernière slide */}
              {my.at(-1)?.slides?.at(-1)?.media ? (
                <img 
                  src={url(my.at(-1).slides.at(-1).media)} 
                  alt="My story" 
                  className="w-full h-full object-cover" 
                />
              ) : my.at(-1)?.slides?.at(-1)?.caption ? (
                <div className="w-full h-full bg-gradient-to-br from-blue-400 to-cyan-500 flex items-center justify-center p-2">
                  <p className="text-white text-[10px] font-bold text-center line-clamp-3">
                    {my.at(-1).slides.at(-1).caption}
                  </p>
                </div>
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-blue-400 to-cyan-500" />
              )}
              
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
              
              <div className="absolute top-0 left-0 bg-blue-600 text-white text-[9px] px-1.5 py-0.5 rounded-br font-bold">
                Vous
              </div>
              
              {hasViews && (
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-black" />
              )}
            </div>
          </div>
          
          <p className={`text-xs mt-1 font-medium ${
            isDarkMode ? "text-gray-200" : "text-gray-800"
          }`}>
            Ma story
          </p>
          
          {timeLeft(my[0]?.expiresAt) && (
            <div className={`flex items-center gap-1 text-[10px] ${
              isDarkMode ? "text-gray-400" : "text-gray-500"
            }`}>
              <Clock className="w-3 h-3" />
              <span>{timeLeft(my[0]?.expiresAt)}</span>
            </div>
          )}
        </motion.button>
      )}

      {/* ─────────────────────────────────────────────────────
          STORIES DES AUTRES UTILISATEURS
      ───────────────────────────────────────────────────── */}
      {users.map(({ id, owner, stories, unviewed, latest }) => {
        const slide = latest.slides?.at(-1);
        
        // ✅ AFFICHAGE DES VRAIES INFOS UTILISATEUR
        const ownerName = owner?.username || owner?.fullName || owner?.email?.split('@')[0] || "Utilisateur";
        const ownerPhoto = owner?.profilePhoto;
        const ownerInitial = ownerName[0]?.toUpperCase() || "?";
        
        console.log("🎨 [StoryContainer] Rendering user:", {
          id,
          ownerName,
          ownerPhoto,
          hasPhoto: !!ownerPhoto
        });
        
        return (
          <motion.button
            key={id}
            className="flex flex-col items-center flex-shrink-0 group"
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleOpen(stories, owner)}
          >
            <div className={`relative w-16 h-16 rounded-full p-0.5 shadow-xl transition-all ${
              unviewed 
                ? "ring-2 ring-orange-500 ring-offset-2 ring-offset-transparent" 
                : ""
            }`}>
              {/* Gradient border */}
              <div className={`absolute inset-0 rounded-full ${
                unviewed 
                  ? "bg-gradient-to-tr from-pink-500 via-orange-400 to-yellow-400" 
                  : "bg-gradient-to-tr from-gray-300 via-gray-400 to-gray-500"
              } opacity-80 group-hover:opacity-100 transition-opacity`} />
              
              <div className="w-full h-full rounded-full overflow-hidden bg-white dark:bg-black relative">
                {/* Photo de profil prioritaire */}
                {ownerPhoto ? (
                  <img 
                    src={url(ownerPhoto)} 
                    alt={ownerName} 
                    className="w-full h-full object-cover" 
                    onError={(e) => {
                      console.error("❌ Failed to load profile photo:", ownerPhoto);
                      // Fallback vers avatar texte
                      e.target.style.display = 'none';
                      const parent = e.target.parentElement;
                      if (parent) {
                        const fallback = document.createElement('div');
                        fallback.className = "w-full h-full bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center";
                        fallback.innerHTML = `<span class="text-white text-2xl font-bold">${ownerInitial}</span>`;
                        parent.appendChild(fallback);
                      }
                    }}
                  />
                ) : slide?.media ? (
                  // Preview de la story si pas de photo de profil
                  <img 
                    src={url(slide.media)} 
                    alt={ownerName} 
                    className="w-full h-full object-cover" 
                  />
                ) : slide?.caption ? (
                  // Story texte
                  <div className="w-full h-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center p-2">
                    <p className="text-white text-[10px] font-bold text-center line-clamp-3">
                      {slide.caption}
                    </p>
                  </div>
                ) : (
                  // Avatar par défaut avec initiale
                  <div className="w-full h-full bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center">
                    <span className="text-white text-2xl font-bold">
                      {ownerInitial}
                    </span>
                  </div>
                )}
                
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                
                {/* Badge non vu */}
                {unviewed && (
                  <div className="absolute top-0 right-0 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-white dark:border-black animate-pulse shadow-lg" />
                )}
              </div>
            </div>
            
            {/* Nom de l'utilisateur */}
            <p 
              className={`text-xs mt-1 font-medium truncate w-16 text-center ${
                isDarkMode ? "text-gray-300" : "text-gray-700"
              }`}
              title={ownerName} // Tooltip au survol
            >
              {ownerName}
            </p>
            
            {/* Temps restant */}
            {timeLeft(latest.expiresAt) && (
              <div className={`flex items-center gap-1 text-[10px] ${
                isDarkMode ? "text-gray-500" : "text-gray-500"
              }`}>
                <Clock className="w-3 h-3" />
                <span>{timeLeft(latest.expiresAt)}</span>
              </div>
            )}
          </motion.button>
        );
      })}

      {/* ─────────────────────────────────────────────────────
          MESSAGE SI AUCUNE STORY
      ───────────────────────────────────────────────────── */}
      {!loading && stories.length === 0 && (
        <div className="flex items-center justify-center w-full py-8">
          <p className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
            Aucune story pour le moment
          </p>
        </div>
      )}
    </div>
  );
};

export default memo(StoryContainer);