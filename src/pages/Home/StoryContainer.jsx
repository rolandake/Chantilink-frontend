// 📁 src/pages/Home/StoryContainer.jsx
// ✅ OPTIMISÉ CLS + SUPPORT STORIES BOTS :
// - Miniature intelligente : affiche le fond gradient pour stories texte bot
//   (caption avec préfixe "bg:gradient")
// - Miniature image/vidéo : affiche le media de la dernière slide
// - Skeleton de même hauteur → zéro CLS

import React, { useMemo, memo, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Calculator, Zap, Triangle } from "lucide-react";
import { useStories } from "../../context/StoryContext";
import { useAuth } from "../../context/AuthContext";

const API_URL    = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const SERVER_URL = API_URL.replace('/api', '');

const MEDIA_URL = (path) => {
  if (!path) return null;
  if (path.startsWith("http") || path.startsWith("blob:")) return path;
  return `${SERVER_URL}/${path.replace(/^\/+/, "")}`;
};

const STORY_CONTAINER_HEIGHT = 120;

// ─────────────────────────────────────────────────────────────────
// HELPERS : lire le gradient depuis caption "bg:gradient"
// ─────────────────────────────────────────────────────────────────
const parseBgFromCaption = (caption) => {
  if (!caption || !caption.startsWith('bg:')) return null;
  return caption.slice(3); // retire le préfixe "bg:"
};

// Résoudre la miniature d'une slide :
// - slide texte bot  → fond gradient (depuis caption "bg:...")
// - slide image/vidéo → URL du media
const getSlidePreview = (slide) => {
  if (!slide) return { type: 'empty', value: null };

  if (slide.type === 'text') {
    const bg = parseBgFromCaption(slide.caption);
    return { type: 'gradient', value: bg || 'linear-gradient(135deg,#667eea,#764ba2)', text: slide.text || slide.caption };
  }

  const mediaUrl = slide.media || slide.mediaUrl;
  if (mediaUrl) {
    return { type: slide.type === 'video' ? 'video' : 'image', value: MEDIA_URL(mediaUrl) };
  }

  return { type: 'empty', value: null };
};

// ============================================
// STORY ITEM — avec miniature intelligente
// ============================================
const StoryItem = memo(({ owner, unviewed, latest, isDarkMode, onClick, isCurrentUser = false }) => {
  const ownerName = owner?.username || owner?.fullName || "User";

  // Prendre la dernière slide comme aperçu
  const lastSlide = latest?.slides?.at(-1);
  const preview   = useMemo(() => getSlidePreview(lastSlide), [lastSlide]);

  const isTechnical = useMemo(() =>
    latest?.slides?.some(s =>
      (s.content || s.text || '').toLowerCase().includes('calcul') ||
      s.metadata?.linkType === 'calculation'
    ), [latest]);

  const isFresh = useMemo(() => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return new Date(latest?.createdAt) > oneHourAgo;
  }, [latest]);

  const ringClass = isCurrentUser
    ? 'bg-gradient-to-tr from-purple-600 via-pink-500 to-orange-500 shadow-lg shadow-orange-500/30'
    : unviewed
    ? 'bg-gradient-to-tr from-purple-600 via-pink-500 to-orange-500 shadow-md shadow-orange-500/20'
    : 'bg-gray-300 dark:bg-white/10';

  return (
    <button
      className="flex flex-col items-center flex-shrink-0 snap-center active:scale-95 transition-transform"
      style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation', width: 72 }}
      onClick={onClick}
    >
      <div
        className={`relative rounded-full p-[2.5px] transition-all ${ringClass}`}
        style={{ width: 68, height: 68, flexShrink: 0 }}
      >
        <div className="w-full h-full rounded-full overflow-hidden bg-white dark:bg-black border-[3px] border-white dark:border-[#0b0d10] relative">

          {/* ── Miniature selon le type de la dernière slide ── */}
          {preview.type === 'gradient' ? (
            // Stories texte bot → fond coloré avec initiale ou emoji
            <div
              className="w-full h-full flex items-center justify-center"
              style={{ background: preview.value }}
            >
              <span className="text-white text-[18px] font-black drop-shadow-sm select-none">
                {(preview.text || '✨').slice(0, 2)}
              </span>
            </div>
          ) : preview.type === 'image' || preview.type === 'video' ? (
            // Stories image/vidéo → thumbnail du media
            <img
              src={preview.value}
              alt={ownerName}
              width={62} height={62}
              className={`w-full h-full object-cover ${!unviewed && !isCurrentUser ? 'opacity-60 grayscale-[0.3]' : ''}`}
              loading="lazy"
              decoding="async"
              onError={(e) => {
                // Fallback : photo de profil si le media est inaccessible
                e.target.src = MEDIA_URL(owner?.profilePhoto) || '';
              }}
            />
          ) : (
            // Fallback → photo de profil du propriétaire
            <img
              src={MEDIA_URL(owner?.profilePhoto)}
              alt={ownerName}
              width={62} height={62}
              className={`w-full h-full object-cover ${!unviewed && !isCurrentUser ? 'opacity-60 grayscale-[0.3]' : ''}`}
              loading="lazy"
              decoding="async"
            />
          )}

          {/* Overlay "vu" */}
          {!unviewed && !isCurrentUser && (
            <div className="absolute inset-0 bg-black/20 rounded-full" />
          )}
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

      <p
        className={`text-[10px] mt-2 font-bold tracking-tight truncate text-center ${
          isCurrentUser
            ? isDarkMode ? 'text-white' : 'text-gray-900'
            : unviewed
            ? isDarkMode ? 'text-white' : 'text-gray-900'
            : 'text-gray-500'
        }`}
        style={{ width: 64 }}
      >
        {isCurrentUser ? 'Votre story' : ownerName}
      </p>
    </button>
  );
});
StoryItem.displayName = 'StoryItem';

// ============================================
// SKELETON
// ============================================
const StoriesSkeleton = memo(({ isDarkMode }) => (
  <div
    className="flex gap-4 px-4 pt-4 pb-2"
    style={{ height: STORY_CONTAINER_HEIGHT, alignItems: 'flex-start' }}
  >
    {[...Array(6)].map((_, i) => (
      <div key={i} className="flex flex-col items-center flex-shrink-0" style={{ width: 72 }}>
        <div
          className={`rounded-full animate-pulse ${isDarkMode ? 'bg-gray-800' : 'bg-gray-200'}`}
          style={{ width: 68, height: 68 }}
        />
        <div
          className={`mt-2 rounded animate-pulse ${isDarkMode ? 'bg-gray-800' : 'bg-gray-200'}`}
          style={{ width: 48, height: 10 }}
        />
      </div>
    ))}
  </div>
));
StoriesSkeleton.displayName = 'StoriesSkeleton';

// ============================================
// CONTAINER PRINCIPAL
// ============================================
const StoryContainer = ({ onOpenStory, onOpenCreator, onOpenPyramid, isDarkMode }) => {
  const { stories = [], loading = false } = useStories();
  const { user } = useAuth();
  const uid = user?._id || user?.id;

  const allGroupedStories = useMemo(() => {
    if (!stories || stories.length === 0) return [];

    const map = {};
    for (const s of stories) {
      if (!s.owner) continue;
      const ownerId = s.owner._id || s.owner;
      if (!map[ownerId]) {
        map[ownerId] = {
          owner: typeof s.owner === 'object' ? s.owner : { _id: ownerId, fullName: 'Utilisateur' },
          stories: [],
        };
      }
      map[ownerId].stories.push(s);
    }

    return Object.values(map).map(data => {
      const slides   = data.stories.flatMap(s => s.slides || []);
      const unviewed = slides.some(sl =>
        !(sl.views || []).some(v => (typeof v === 'string' ? v : v._id) === uid)
      );
      const latest = data.stories.reduce(
        (l, c) => new Date(c.createdAt) > new Date(l.createdAt) ? c : l,
        data.stories[0]
      );
      const isCurrentUser = data.owner._id === uid;
      return { id: data.owner._id, owner: data.owner, stories: data.stories, unviewed, latest, isCurrentUser };
    }).sort((a, b) => {
      if (a.isCurrentUser) return -1;
      if (b.isCurrentUser) return 1;
      if (a.unviewed !== b.unviewed) return b.unviewed - a.unviewed;
      return new Date(b.latest.createdAt) - new Date(a.latest.createdAt);
    });
  }, [stories, uid]);

  const unviewedCount = useMemo(() =>
    allGroupedStories.filter(o => o.unviewed && !o.isCurrentUser).length,
    [allGroupedStories]
  );

  const handleOpenStory = useCallback((group) => {
    onOpenStory(group.stories, group.owner);
  }, [onOpenStory]);

  if (loading && stories.length === 0) {
    return (
      <div
        className="relative w-full overflow-hidden"
        style={{ height: STORY_CONTAINER_HEIGHT, contain: 'strict' }}
      >
        <StoriesSkeleton isDarkMode={isDarkMode} />
      </div>
    );
  }

  return (
    <div
      className="relative w-full overflow-hidden pb-2"
      style={{ height: STORY_CONTAINER_HEIGHT, contain: 'layout size' }}
    >
      <div className="flex gap-4 px-4 pt-4 pb-2 overflow-x-auto scrollbar-hide snap-x snap-mandatory h-full">

        {/* BOUTON AJOUTER */}
        <button
          onClick={onOpenCreator}
          className="flex flex-col items-center flex-shrink-0 snap-start active:scale-95 transition-transform"
          style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation', width: 72 }}
        >
          <div
            className="relative rounded-full bg-gradient-to-br from-gray-100 to-gray-50 dark:from-white/5 dark:to-white/10 border-2 border-dashed border-gray-300 dark:border-white/20 flex items-center justify-center hover:border-orange-500 dark:hover:border-orange-500 transition-colors"
            style={{ width: 68, height: 68, flexShrink: 0 }}
          >
            {user?.profilePhoto ? (
              <>
                <img
                  src={MEDIA_URL(user.profilePhoto)}
                  className="w-full h-full rounded-full object-cover opacity-40"
                  width={68} height={68}
                  alt=""
                  loading="eager"
                />
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
          <p className="text-[10px] mt-2 font-bold text-gray-500 uppercase tracking-tighter truncate" style={{ width: 64, textAlign: 'center' }}>
            Créer
          </p>
        </button>

        {/* TOUTES LES STORIES */}
        {allGroupedStories.map((group) => (
          <div key={group.id} className="snap-start">
            <StoryItem
              owner={group.owner}
              latest={group.latest}
              unviewed={group.unviewed}
              isDarkMode={isDarkMode}
              onClick={() => handleOpenStory(group)}
              isCurrentUser={group.isCurrentUser}
            />
          </div>
        ))}

        <div className="flex-shrink-0 w-24 md:hidden" />
      </div>

      {/* BOUTON UNIVERS FLOTTANT */}
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