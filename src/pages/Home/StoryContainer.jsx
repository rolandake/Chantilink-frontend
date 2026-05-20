import React, { useMemo, memo, useCallback, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, Calculator, Zap, Triangle } from 'lucide-react';
import { useStories } from '../../context/StoryContext';
import { useAuth } from '../../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const SERVER_URL = API_URL.replace('/api', '');

const MEDIA_URL = (path) => {
  if (!path) return null;
  if (path.startsWith('http') || path.startsWith('blob:')) return path;
  return `${SERVER_URL}/${path.replace(/^\/+/, '')}`;
};

const STORY_CONTAINER_HEIGHT = 120;

const parseBgFromCaption = (caption) => {
  if (!caption || typeof caption !== 'string') return null;
  if (!caption.startsWith('bg:')) return null;
  return caption.slice(3);
};

const getSlidePreview = (slide) => {
  if (!slide) return { type: 'empty', value: null };
  if (slide.type === 'text') {
    const bg = slide.background || parseBgFromCaption(slide.caption) || slide.backgroundColor || 'linear-gradient(135deg, #667eea, #764ba2)';
    const displayText = slide.text || slide.content || (slide.caption && !slide.caption.startsWith('bg:') ? slide.caption : null);
    return { type: 'gradient', value: bg, text: displayText || '✨' };
  }
  const mediaUrl = slide.media || slide.mediaUrl;
  if (mediaUrl) return { type: slide.type === 'video' ? 'video' : 'image', value: MEDIA_URL(mediaUrl) };
  return { type: 'empty', value: null };
};

// ─────────────────────────────────────────────────────────────────
// StoryItem — comportement WhatsApp :
//   • non vue  → taille normale (68px), anneau jaune→bleu vif, nom en gras
//   • vue      → taille réduite (50px), anneau gris tireté, nom grisé, opacité 0.55
//   • currentUser → taille normale, anneau jaune→bleu
// ─────────────────────────────────────────────────────────────────
const StoryItem = memo(({ owner, unviewed, latest, slideCount = 0, isDarkMode, onClick, isCurrentUser = false }) => {
  const ownerName = owner?.username || owner?.fullName || 'User';
  const lastSlide = latest?.slides?.at(-1);
  const preview = useMemo(() => getSlidePreview(lastSlide), [lastSlide]);
  const isTechnical = useMemo(() => latest?.slides?.some(
    (s) => (s.content || s.text || '').toLowerCase().includes('calcul') || s.metadata?.linkType === 'calculation'
  ), [latest]);
  const isFresh = useMemo(() => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return new Date(latest?.createdAt) > oneHourAgo;
  }, [latest]);

  // ✅ Style WhatsApp : vue = réduite et atténuée
  const isViewed = !unviewed && !isCurrentUser;
  const avatarSize  = isViewed ? 50 : 68;
  const wrapperSize = isViewed ? 54 : 68;
  const buttonWidth = isViewed ? 58 : 72;

  const ringStyle = isViewed
    ? {
        width: wrapperSize,
        height: wrapperSize,
        flexShrink: 0,
        borderRadius: '50%',
        border: `2px dashed ${isDarkMode ? '#4b5563' : '#d1d5db'}`,
        padding: '2px',
      }
    : {
        width: wrapperSize,
        height: wrapperSize,
        flexShrink: 0,
        borderRadius: '50%',
        padding: '2.5px',
        background: 'linear-gradient(135deg, #facc15, #22d3ee, #3b82f6)',
        boxShadow: isCurrentUser
          ? '0 4px 16px rgba(34,211,238,0.45)'
          : '0 2px 10px rgba(34,211,238,0.3)',
      };

  const handleImgError = useCallback((e) => {
    const profileSrc = MEDIA_URL(owner?.profilePhoto);
    if (profileSrc && e.target.src !== profileSrc) { e.target.src = profileSrc; }
    else { e.target.removeAttribute('src'); e.target.style.display = 'none'; }
  }, [owner?.profilePhoto]);

  return (
    <motion.button
      layout
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{
        opacity: isViewed ? 0.55 : 1,
        scale: 1,
      }}
      transition={{ type: 'spring', stiffness: 300, damping: 26 }}
      className='flex flex-col items-center flex-shrink-0 snap-center active:scale-95'
      style={{
        WebkitTapHighlightColor: 'transparent',
        touchAction: 'manipulation',
        width: buttonWidth,
      }}
      onClick={onClick}
    >
      {/* Anneau + avatar */}
      <div style={ringStyle} className='relative'>
        <div
          className='w-full h-full rounded-full overflow-hidden relative'
          style={{
            background: isDarkMode ? '#000' : '#fff',
            border: isViewed ? 'none' : `3px solid ${isDarkMode ? '#0b0d10' : '#fff'}`,
          }}
        >
          {preview.type === 'gradient' ? (
            <div className='w-full h-full flex items-center justify-center' style={{ background: preview.value }}>
              <span
                className='text-white font-black drop-shadow-sm select-none'
                style={{ fontSize: isViewed ? 13 : 18 }}
              >
                {String(preview.text || '✨').slice(0, 2)}
              </span>
            </div>
          ) : preview.type === 'image' || preview.type === 'video' ? (
            <img
              src={preview.value}
              alt={ownerName}
              width={avatarSize}
              height={avatarSize}
              className={`w-full h-full object-cover ${isViewed ? 'grayscale-[0.45]' : ''}`}
              loading='lazy'
              decoding='async'
              onError={handleImgError}
            />
          ) : (
            <img
              src={MEDIA_URL(owner?.profilePhoto)}
              alt={ownerName}
              width={avatarSize}
              height={avatarSize}
              className={`w-full h-full object-cover ${isViewed ? 'grayscale-[0.45]' : ''}`}
              loading='lazy'
              decoding='async'
              onError={(e) => { e.target.removeAttribute('src'); }}
            />
          )}
          {/* Voile léger pour les stories vues */}
          {isViewed && <div className='absolute inset-0 bg-black/10 rounded-full' />}
        </div>

        {/* Badges uniquement sur les stories non vues */}
        {!isViewed && isTechnical && (
          <div className='absolute -top-1 -right-1 bg-orange-600 text-white p-1 rounded-full shadow-lg border-2 border-white dark:border-[#0b0d10]'>
            <Calculator size={10} strokeWidth={3} />
          </div>
        )}
        {!isViewed && isFresh && (unviewed || isCurrentUser) && (
          <div className='absolute -bottom-1 -right-1 bg-gradient-to-tr from-yellow-400 to-orange-500 text-white p-1 rounded-full shadow-lg border-2 border-white dark:border-[#0b0d10]'>
            <Zap size={10} strokeWidth={3} fill='currentColor' />
          </div>
        )}
      </div>

      {/* Nom */}
      <p
        className='truncate text-center mt-1.5 font-bold tracking-tight'
        style={{
          width: buttonWidth - 6,
          fontSize: isViewed ? 9 : 10,
          color: isViewed
            ? isDarkMode ? '#6b7280' : '#9ca3af'
            : isDarkMode ? '#fff' : '#111827',
        }}
      >
        {isCurrentUser ? 'Votre story' : ownerName}
      </p>
      {slideCount > 0 && (
        <p
          className='truncate text-center mt-0.5 font-semibold uppercase'
          style={{
            width: buttonWidth - 6,
            fontSize: 8,
            color: isDarkMode ? '#9ca3af' : '#6b7280',
            opacity: 0.85,
          }}
        >
          {slideCount} {slideCount === 1 ? 'slide' : 'slides'}
        </p>
      )}
    </motion.button>
  );
});
StoryItem.displayName = 'StoryItem';

// ─────────────────────────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────────────────────────
const StoriesSkeleton = memo(({ isDarkMode }) => (
  <div className='flex gap-3 px-4 pt-3 pb-2' style={{ height: STORY_CONTAINER_HEIGHT, alignItems: 'center' }}>
    {[...Array(6)].map((_, i) => (
      <div key={i} className='flex flex-col items-center flex-shrink-0' style={{ width: i > 2 ? 58 : 72 }}>
        <div
          className={`rounded-full animate-pulse ${isDarkMode ? 'bg-gray-800' : 'bg-gray-200'}`}
          style={{ width: i > 2 ? 54 : 68, height: i > 2 ? 54 : 68 }}
        />
        <div className={`mt-1.5 rounded animate-pulse ${isDarkMode ? 'bg-gray-800' : 'bg-gray-200'}`} style={{ width: 40, height: 9 }} />
      </div>
    ))}
  </div>
));
StoriesSkeleton.displayName = 'StoriesSkeleton';

// ─────────────────────────────────────────────────────────────────
// StoryContainer principal
// ─────────────────────────────────────────────────────────────────
function StoryContainer({ onOpenStory, onOpenCreator, onOpenPyramid, isDarkMode }) {
  const { stories = [], loading = false } = useStories();
  const { user } = useAuth();
  const uid = user?._id || user?.id;

  const scrollContainerRef = useRef(null);

  const allGroupedStories = useMemo(() => {
    if (!stories || stories.length === 0) return [];
    const map = {};
    for (const s of stories) {
      if (!s.owner) continue;
      const ownerId = s.owner._id || s.owner;
      if (!map[ownerId]) map[ownerId] = {
        owner: typeof s.owner === 'object' ? s.owner : { _id: ownerId, fullName: 'Utilisateur' },
        stories: [],
      };
      map[ownerId].stories.push(s);
    }
    return Object.values(map).map((data) => {
      const slides = data.stories.flatMap((s) => s.slides || []);
      const unviewed = slides.some(
        (sl) => !(sl.views || []).some((v) => (typeof v === 'string' ? v : v._id) === uid)
      );
      const latest = data.stories.reduce(
        (l, c) => (new Date(c.createdAt) > new Date(l.createdAt) ? c : l),
        data.stories[0]
      );
      const isCurrentUser = data.owner._id === uid;
      return {
        id: data.owner._id,
        owner: data.owner,
        stories: data.stories,
        unviewed,
        latest,
        isCurrentUser,
        slideCount: slides.length,
      };
    }).sort((a, b) => {
      // Tri WhatsApp : currentUser → non vues (récentes d'abord) → vues (récentes d'abord)
      if (a.isCurrentUser) return -1;
      if (b.isCurrentUser) return 1;
      if (a.unviewed !== b.unviewed) return b.unviewed - a.unviewed;
      return new Date(b.latest.createdAt) - new Date(a.latest.createdAt);
    });
  }, [stories, uid]);

  const unviewedCount = useMemo(
    () => allGroupedStories.filter((o) => o.unviewed && !o.isCurrentUser).length,
    [allGroupedStories]
  );

  // Toujours repositionner au début — les non vues sont déjà devant
  useEffect(() => {
    if (!scrollContainerRef.current || !allGroupedStories.length) return;
    const timer = setTimeout(() => {
      scrollContainerRef.current?.scrollTo({ left: 0, behavior: 'smooth' });
    }, 150);
    return () => clearTimeout(timer);
  }, [allGroupedStories.length]);

  const handleOpenStory = useCallback((group) => {
    onOpenStory(group.stories, group.owner);
  }, [onOpenStory]);

  if (loading && stories.length === 0) {
    return (
      <div className='relative w-full overflow-hidden' style={{ height: STORY_CONTAINER_HEIGHT, contain: 'layout size' }}>
        <StoriesSkeleton isDarkMode={isDarkMode} />
      </div>
    );
  }

  return (
    <div className='relative w-full overflow-hidden pb-2' style={{ height: STORY_CONTAINER_HEIGHT, contain: 'layout size' }}>
      <div
        ref={scrollContainerRef}
        className='flex gap-3 px-4 pt-3 pb-2 overflow-x-auto scrollbar-hide snap-x snap-mandatory h-full'
        style={{ alignItems: 'center' }}
      >
        {/* ─── Bouton Créer ─── */}
        <button
          onClick={onOpenCreator}
          className='flex flex-col items-center flex-shrink-0 snap-start active:scale-95 transition-transform'
          style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation', width: 72 }}
        >
          <div
            className='relative rounded-full flex items-center justify-center'
            style={{
              width: 68,
              height: 68,
              flexShrink: 0,
              background: isDarkMode
                ? 'linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0.1))'
                : 'linear-gradient(135deg,#f9fafb,#f3f4f6)',
              border: `2px dashed ${isDarkMode ? 'rgba(255,255,255,0.2)' : '#d1d5db'}`,
            }}
          >
            {user?.profilePhoto && (
              <img
                src={MEDIA_URL(user.profilePhoto)}
                className='w-full h-full rounded-full object-cover opacity-40'
                width={68}
                height={68}
                alt=''
                loading='eager'
                onError={(e) => { e.target.removeAttribute('src'); }}
              />
            )}
            <div
              className='absolute rounded-full p-1.5 border-[3px] shadow-lg'
              style={{
                bottom: 0,
                right: 0,
                background: 'linear-gradient(135deg,#facc15,#22d3ee)',
                borderColor: isDarkMode ? '#0b0d10' : '#fff',
              }}
            >
              <Plus size={10} className='text-white' strokeWidth={4} />
            </div>
          </div>
          <p className='text-[10px] mt-1.5 font-bold text-gray-500 uppercase tracking-tighter truncate' style={{ width: 64, textAlign: 'center' }}>
            Créer
          </p>
        </button>

        {/* ─── Stories : non vues grandes, vues petites ─── */}
        {allGroupedStories.map((group) => (
          <div key={group.id} className='snap-start relative flex-shrink-0'>
            <StoryItem
              owner={group.owner}
              latest={group.latest}
              unviewed={group.unviewed}
              slideCount={group.slideCount}
              isDarkMode={isDarkMode}
              onClick={() => handleOpenStory(group)}
              isCurrentUser={group.isCurrentUser}
            />
          </div>
        ))}

        <div className='flex-shrink-0 w-24 md:hidden' />
      </div>

      {/* ─── Bouton Univers ─── */}
      <AnimatePresence>
        {unviewedCount > 0 && (
          <motion.button
            initial={{ y: 50, opacity: 0, scale: 0.8 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 50, opacity: 0, scale: 0.8 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onOpenPyramid}
            className='absolute top-1/2 -translate-y-1/2 right-2 z-[100] px-3 py-2 rounded-full flex items-center gap-2 transition-all'
            style={{
              background: 'linear-gradient(135deg,#facc15,#22d3ee,#3b82f6)',
              boxShadow: '0 8px 24px rgba(34,211,238,0.35)',
              border: '1px solid rgba(255,255,255,0.3)',
            }}
          >
            <div className='relative'>
              <Triangle size={12} className='text-white fill-white rotate-180' />
              <motion.div
                animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0, 0.6] }}
                transition={{ duration: 2, repeat: Infinity }}
                className='absolute inset-0 bg-white rounded-full blur-sm'
              />
            </div>
            <span className='text-white text-[10px] font-black tracking-wide uppercase hidden sm:inline'>Univers</span>
            <div className='bg-white/20 backdrop-blur-sm rounded-full px-1.5 py-0.5 min-w-[18px] flex items-center justify-center'>
              <span className='text-white text-[10px] font-black'>{unviewedCount}</span>
            </div>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

export default StoryContainer;