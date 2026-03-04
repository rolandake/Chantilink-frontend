// 📁 src/pages/Videos/VideosPage.jsx
//
// ✅ FIXES APPLIQUÉS (ce commit) :
//
//   🐛 FIX SAUT IMMÉDIAT AU CHARGEMENT (cause racine confirmée par logs) :
//
//   SYMPTÔME : les vidéos sautent dès qu'elles sont affichées, sans que
//              l'utilisateur ne touche l'écran.
//
//   CAUSE RACINE (identifiée via logs console) :
//     1. Les 25 vidéos agrégées (Pexels/Pixabay) arrivent APRÈS le montage
//        initial via fetchAggregated().
//     2. setAggContents → shuffledItems change → feedItems change →
//        TOUS les indices des slides se décalent.
//     3. L'IntersectionObserver voit des slides à de nouveaux indices →
//        handleVisible() se déclenche avec le mauvais index → saut.
//     4. Même problème avec les posts utilisateur (241 posts chargés en
//        plusieurs fois) → feed reconstruit → indices décalés → saut.
//
//   FIX A : activeItemIdRef — mémorise l'ID de la vidéo active.
//     Quand feedItems change, on recalcule l'index pour rester sur la même
//     vidéo (même ID) au lieu de rester sur la même position numérique.
//     → scrollTo({ behavior: 'instant' }) repositionne silencieusement.
//
//   FIX B : setShuffledItems append-only — quand le feed existait déjà,
//     on AJOUTE les nouvelles vidéos à la fin sans reshuffler l'existant.
//     → Les vidéos déjà en position ne bougent plus quand de nouvelles
//       arrivent → pas de décalage d'indices → pas de saut.
//
//   FIXES PRÉCÉDENTS CONSERVÉS :
//   C. isScrollLocked (1500ms boot)
//   D. scrolledOnce ref
//   E. isUserScrolling ref (scroll actif détecté via event + timer 150ms)
//   F. isAutoScrolling ref (scroll programmatique fin de vidéo)
//   G. VIRTUAL_WINDOW = 1
//   H. threshold 0.92

import React, {
  useState, useEffect, useRef, useCallback, memo, useMemo, createContext, useContext
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useVideos } from '../../context/VideoContext';
import VideoCard from './VideoCard';
import AggregatedCard from './AggregatedCard';
import VideoModal from './VideoModal';
import VideoAd from './Publicite/VideoAd.jsx';
import { FaPlus, FaSearch, FaArrowLeft, FaTimes, FaFire } from 'react-icons/fa';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api$/, '');

const CONFIG = {
  ads:        { enabled: true, frequency: 7 },
  aggregated: { enabled: true, initialLoad: 25, loadMore: 15, mixRatio: 3 },
};

const VALID_VIDEO_HOSTS = [
  'videos.pexels.com',
  'cdn.pixabay.com/video',
  'res.cloudinary.com',
  'player.pixabay.com',
  'vimeocdn.com',
];

const PLAYABLE_EXT = /\.(mp4|webm|mov)(\?|$)/i;

const isPlayableVideo = (item) => {
  if (item.type === 'short_video') {
    const url = item.videoUrl || '';
    if (!url) return false;
    if (url.includes('.m3u8'))    return false;
    if (url.includes('youtube.')) return false;
    if (url.includes('youtu.be')) return false;
    if (url.includes('vimeo.com') && !url.includes('vimeocdn.com')) return false;
    return true;
  }
  const url = item.videoUrl || item.url || '';
  if (!url) return false;
  if (url.includes('.m3u8'))    return false;
  if (url.includes('youtube.')) return false;
  if (url.includes('youtu.be')) return false;
  const hasExt  = PLAYABLE_EXT.test(url);
  const hasHost = VALID_VIDEO_HOSTS.some(h => url.includes(h));
  return hasExt || hasHost;
};

const ActiveIndexContext = createContext(0);
const ModalOpenContext   = createContext(false);

const ActionBar = memo(({ onBack, activeTab, setActiveTab, showSearch, setShowSearch, searchQuery, setSearchQuery, onAddVideo }) => (
  <div className="absolute top-0 left-0 right-0 z-50 pointer-events-none">
    <div className="bg-gradient-to-b from-black/90 via-black/60 to-transparent px-3 py-2 pt-safe pointer-events-auto">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <button onClick={onBack} className="w-9 h-9 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/20 active:scale-95 transition-transform">
          <FaArrowLeft className="text-sm" />
        </button>
        <div className="flex gap-0.5 bg-black/40 backdrop-blur-xl rounded-full p-0.5 border border-white/10">
          {[{ id: 'foryou', label: 'Pour toi', icon: FaFire }, { id: 'following', label: 'Suivis' }].map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all flex items-center gap-1 ${activeTab === tab.id ? 'bg-white text-black' : 'text-white/70 hover:text-white'}`}>
              {tab.icon && <tab.icon className="w-2.5 h-2.5" />}
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <div className="relative">
            <AnimatePresence>
              {showSearch && (
                <motion.input
                  initial={{ width: 0, opacity: 0 }} animate={{ width: 120, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }} transition={{ duration: 0.15 }}
                  value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher..."
                  className="absolute right-10 top-0 bg-white/20 backdrop-blur-md text-white placeholder-white/50 text-xs px-3 py-1.5 rounded-full outline-none"
                  autoFocus
                />
              )}
            </AnimatePresence>
            <button onClick={() => setShowSearch(!showSearch)} className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors">
              {showSearch ? <FaTimes className="text-xs" /> : <FaSearch className="text-xs" />}
            </button>
          </div>
          <button onClick={onAddVideo} className="w-9 h-9 rounded-full bg-gradient-to-r from-orange-500 to-pink-600 flex items-center justify-center text-white shadow-lg hover:scale-105 active:scale-95 transition-transform">
            <FaPlus className="text-sm" />
          </button>
        </div>
      </div>
    </div>
  </div>
));
ActionBar.displayName = 'ActionBar';

const LoadingScreen = memo(() => (
  <div className="h-screen bg-black flex flex-col items-center justify-center">
    <div className="w-16 h-16 border-4 border-gray-800 border-t-orange-500 rounded-full animate-spin mb-4" />
    <p className="text-white font-bold animate-pulse">Chargement du flux...</p>
  </div>
));
LoadingScreen.displayName = 'LoadingScreen';

// ✅ FIX G : VIRTUAL_WINDOW = 1 → 3 slides max dans le DOM
const VIRTUAL_WINDOW = 1;

const SlidePlaceholder = memo(() => (
  <div className="w-full snap-start snap-always flex-shrink-0 bg-black" style={{ height: '100vh' }} aria-hidden="true" />
));
SlidePlaceholder.displayName = 'SlidePlaceholder';

const SlideItem = memo(({ item, index, onVisible, onVideoEnded, isVirtualized, onModalChange }) => {
  const ref         = useRef(null);
  const activeIndex = useContext(ActiveIndexContext);
  const modalOpen   = useContext(ModalOpenContext);
  const isActive    = activeIndex === index;

  useEffect(() => {
    const el = ref.current;
    if (!el || isVirtualized) return;
    if (modalOpen) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        // ✅ FIX H : threshold 0.92 → moins sensible aux repaints
        if (entry.isIntersecting && entry.intersectionRatio >= 0.92) {
          onVisible(index);
        }
      },
      { threshold: 0.92 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [index, onVisible, isVirtualized, modalOpen]);

  return (
    <div ref={ref} className="w-full snap-start snap-always flex-shrink-0" style={{ height: '100vh' }}>
      {isVirtualized ? null : (
        item.type === 'ad' ? (
          <VideoAd isActive={isActive} />
        ) : item.isAggregated ? (
          <AggregatedCard
            content={item.data}
            isActive={isActive}
            onVideoEnded={() => onVideoEnded(index)}
            onModalChange={onModalChange}
          />
        ) : (
          <VideoCard
            video={item.data}
            isActive={isActive}
            isAutoPost={false}
            onVideoEnded={() => onVideoEnded(index)}
            onModalChange={onModalChange}
          />
        )
      )}
    </div>
  );
}, (prev, next) =>
  prev.item.id         === next.item.id &&
  prev.index           === next.index &&
  prev.isVirtualized   === next.isVirtualized &&
  prev.onVisible       === next.onVisible &&
  prev.onVideoEnded    === next.onVideoEnded &&
  prev.onModalChange   === next.onModalChange
);
SlideItem.displayName = 'SlideItem';

const shuffleArray = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const VideosPage = () => {
  const navigate     = useNavigate();
  const { getToken } = useAuth();
  const {
    videos: userVideos,
    loading: userLoading,
    hasMore: userHasMore,
    initialLoad,
    fetchVideos: fetchUserVideos,
  } = useVideos();

  const [activeIndex,   setActiveIndex]   = useState(0);
  const [showModal,     setShowModal]     = useState(false);
  const [searchQuery,   setSearchQuery]   = useState('');
  const [activeTab,     setActiveTab]     = useState('foryou');
  const [showSearch,    setShowSearch]    = useState(false);
  const [aggContents,   setAggContents]   = useState([]);
  const [aggLoading,    setAggLoading]    = useState(false);
  const [aggPage,       setAggPage]       = useState(1);
  const [aggHasMore,    setAggHasMore]    = useState(true);
  const [shuffledItems, setShuffledItems] = useState([]);
  const [anyModalOpen,  setAnyModalOpen]  = useState(false);

  const containerRef    = useRef(null);
  const fetchTriggered  = useRef(false);
  const lastVisibleTime = useRef(0);

  // ✅ FIX C : isScrollLocked — bloque handleVisible pendant 1500ms au boot
  const isScrollLocked  = useRef(true);

  // ✅ FIX D : scrolledOnce — l'index ne peut changer QUE si l'user a scrollé
  const scrolledOnce    = useRef(false);

  // ✅ FIX E : isUserScrolling — l'observer ne change l'index QUE si l'user scrolle activement
  const isUserScrolling = useRef(false);
  const scrollEndTimer  = useRef(null);

  // ✅ FIX F : isAutoScrolling — bloque handleVisible après scroll programmatique (fin vidéo)
  const isAutoScrolling = useRef(false);

  // ✅ FIX A : activeItemIdRef — mémorise l'ID de la vidéo active
  // Quand feedItems change (nouvelles vidéos chargées), on recalcule l'index
  // pour rester sur la même vidéo au lieu de la même position numérique.
  const activeItemIdRef = useRef(null);

  const userHasMoreRef = useRef(userHasMore);
  const userLoadingRef = useRef(userLoading);
  const aggHasMoreRef  = useRef(aggHasMore);
  const aggLoadingRef  = useRef(aggLoading);
  const aggPageRef     = useRef(aggPage);
  const feedLengthRef  = useRef(0);

  useEffect(() => { userHasMoreRef.current = userHasMore;  }, [userHasMore]);
  useEffect(() => { userLoadingRef.current = userLoading;  }, [userLoading]);
  useEffect(() => { aggHasMoreRef.current  = aggHasMore;   }, [aggHasMore]);
  useEffect(() => { aggLoadingRef.current  = aggLoading;   }, [aggLoading]);
  useEffect(() => { aggPageRef.current     = aggPage;      }, [aggPage]);

  // ✅ FIX C : déverrouiller après 1500ms
  useEffect(() => {
    const t = setTimeout(() => { isScrollLocked.current = false; }, 1500);
    return () => clearTimeout(t);
  }, []);

  // ✅ FIX D + E : écouter le scroll du container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onScroll = () => {
      // FIX D : marquer le premier scroll utilisateur
      if (!scrolledOnce.current) {
        scrolledOnce.current   = true;
        isScrollLocked.current = false;
      }
      // FIX E : fenêtre "scroll actif" de 150ms
      isUserScrolling.current = true;
      clearTimeout(scrollEndTimer.current);
      scrollEndTimer.current = setTimeout(() => {
        isUserScrolling.current = false;
      }, 150);
    };
    container.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', onScroll);
      clearTimeout(scrollEndTimer.current);
    };
  }, []);

  const handleVideoEnded = useCallback((finishedIndex) => {
    const container = containerRef.current;
    if (!container) return;
    const nextIndex = finishedIndex + 1;
    if (nextIndex >= feedLengthRef.current) return;

    // ✅ FIX F : verrouiller handleVisible pendant le scroll automatique
    isAutoScrolling.current = true;
    setTimeout(() => { isAutoScrolling.current = false; }, 800);

    setActiveIndex(nextIndex);
    requestAnimationFrame(() => {
      container.scrollTo({ top: nextIndex * container.clientHeight, behavior: 'smooth' });
    });
  }, []);

  const handleModalChange = useCallback((isOpen) => {
    setAnyModalOpen(isOpen);
  }, []);

  const fetchAggregated = useCallback(async (page = 1, limit = 25) => {
    if (!CONFIG.aggregated.enabled) return;
    try {
      setAggLoading(true);
      const token   = await getToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(
        `${API_BASE}/api/aggregated?page=${page}&limit=${limit}&type=short_videos`,
        { headers }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const items = (json.data || [])
        .filter(isPlayableVideo)
        .map(c => ({ ...c, _isAggregated: true }));
      if (page === 1) setAggContents(items);
      else setAggContents(prev => [...prev, ...items]);
      setAggPage(page);
      setAggHasMore(json.pagination?.hasMore || false);
      console.log(`🎬 [VideosPage] ${items.length} vidéos courtes chargées (page ${page})`);
    } catch (err) {
      console.error('❌ [Aggregated]', err.message);
      setAggHasMore(false);
    } finally {
      setAggLoading(false);
    }
  }, [getToken]);

  const fetchAggregatedRef = useRef(fetchAggregated);
  useEffect(() => { fetchAggregatedRef.current = fetchAggregated; }, [fetchAggregated]);
  const fetchUserVideosRef = useRef(fetchUserVideos);
  useEffect(() => { fetchUserVideosRef.current = fetchUserVideos; }, [fetchUserVideos]);

  useEffect(() => {
    if (!fetchTriggered.current) {
      fetchTriggered.current = true;
      fetchUserVideos(true);
      fetchAggregated(1, CONFIG.aggregated.initialLoad);
    }
  }, []); // eslint-disable-line

  // ✅ FIX B : setShuffledItems append-only
  // Quand le feed existait déjà, on AJOUTE les nouvelles vidéos à la fin
  // sans reshuffler l'existant → les vidéos déjà en position ne bougent plus
  // → pas de décalage d'indices → pas de saut lors du chargement différé.
  useEffect(() => {
    const userList = (userVideos || []).map(v => ({ ...v, _isUserVideo: true }));
    const mixed    = [];
    const ratio    = CONFIG.aggregated.mixRatio;
    let aggIdx     = 0;
    userList.forEach((v, i) => {
      mixed.push(v);
      if ((i + 1) % ratio === 0 && aggIdx < aggContents.length) mixed.push(aggContents[aggIdx++]);
    });
    while (aggIdx < aggContents.length) mixed.push(aggContents[aggIdx++]);

    // Déduplication
    const seen    = new Set();
    const deduped = [];
    for (const item of mixed) {
      const uid = `${item._isAggregated ? 'agg' : 'user'}-${item._id || item.externalId}`;
      if (!seen.has(uid)) { seen.add(uid); deduped.push(item); }
    }

    setShuffledItems(prev => {
      // Premier chargement → shuffle complet
      if (prev.length === 0) return shuffleArray(deduped);

      // Chargements suivants → append uniquement des nouvelles vidéos
      // Les vidéos déjà présentes restent à leur position → pas de saut
      const prevIds  = new Set(prev.map(v => `${v._isAggregated ? 'agg' : 'user'}-${v._id || v.externalId}`));
      const newItems = deduped.filter(v => {
        const uid = `${v._isAggregated ? 'agg' : 'user'}-${v._id || v.externalId}`;
        return !prevIds.has(uid);
      });

      if (newItems.length === 0) return prev; // Rien de nouveau → pas de re-render
      return [...prev, ...shuffleArray(newItems)];
    });
  }, [userVideos, aggContents]);

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return shuffledItems;
    const q = searchQuery.toLowerCase();
    return shuffledItems.filter(v =>
      (v.title       || '').toLowerCase().includes(q) ||
      (v.description || '').toLowerCase().includes(q) ||
      (v.channelName || v.username || '').toLowerCase().includes(q)
    );
  }, [shuffledItems, searchQuery]);

  const feedItems = useMemo(() => {
    const items = [];
    filteredItems.forEach((item, index) => {
      const id = `${item._isAggregated ? 'agg' : 'user'}-${item._id || item.externalId || index}`;
      items.push({ type: 'content', data: item, id, isAggregated: !!item._isAggregated });
      if (CONFIG.ads.enabled && (index + 1) % CONFIG.ads.frequency === 0) {
        items.push({ type: 'ad', id: `ad-${index}` });
      }
    });
    return items;
  }, [filteredItems]);

  useEffect(() => { feedLengthRef.current = feedItems.length; }, [feedItems.length]);

  // ✅ FIX A (partie 1) : mémoriser l'ID de la vidéo active à chaque changement
  useEffect(() => {
    const item = feedItems[activeIndex];
    if (item) activeItemIdRef.current = item.id;
  }, [activeIndex, feedItems]);

  // ✅ FIX A (partie 2) : quand feedItems change, repositionner silencieusement
  // sur la même vidéo (même ID) si son index a changé.
  // Cas typique : les 25 vidéos agrégées arrivent → feedItems se reconstruit →
  // la vidéo active est maintenant à un autre index → scroll instant pour compenser.
  useEffect(() => {
    if (!activeItemIdRef.current) return;
    const newIndex = feedItems.findIndex(item => item.id === activeItemIdRef.current);
    if (newIndex !== -1 && newIndex !== activeIndex) {
      setActiveIndex(newIndex);
      const container = containerRef.current;
      if (container) {
        // behavior: 'instant' → repositionnement invisible pour l'utilisateur
        container.scrollTo({ top: newIndex * container.clientHeight, behavior: 'instant' });
      }
    }
  }, [feedItems]); // eslint-disable-line

  const handleVisible = useCallback((index) => {
    // FIX C : bloquer pendant le verrouillage initial (1500ms au boot)
    if (isScrollLocked.current) return;

    // FIX D : l'index ne peut changer que si l'utilisateur a scrollé au moins une fois
    if (!scrolledOnce.current && index !== 0) return;

    // FIX F : ignorer pendant un scroll automatique (handleVideoEnded)
    if (isAutoScrolling.current) return;

    // FIX E : ignorer si l'utilisateur ne scrolle pas activement
    // Exception : index === activeIndex (confirmation slide courante → inoffensif)
    if (!isUserScrolling.current && index !== activeIndex) return;

    // Debounce 400ms
    const now = Date.now();
    if (now - lastVisibleTime.current < 400) return;
    lastVisibleTime.current = now;

    setActiveIndex(index);

    if (index >= feedLengthRef.current - 5) {
      if (userHasMoreRef.current && !userLoadingRef.current) fetchUserVideosRef.current();
      if (aggHasMoreRef.current  && !aggLoadingRef.current)  fetchAggregatedRef.current(aggPageRef.current + 1, CONFIG.aggregated.loadMore);
    }
  }, [activeIndex]);

  const handleVideoPublished = useCallback(() => {
    setActiveIndex(0);
    activeItemIdRef.current = null;
    containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    setShuffledItems([]);
    fetchUserVideos(true);
  }, [fetchUserVideos]);

  const handleBack     = useCallback(() => navigate('/'), [navigate]);
  const handleAddVideo = useCallback(() => setShowModal(true), []);

  const { windowItems, activeInWin } = useMemo(() => {
    const start = Math.max(0, activeIndex - 2);
    return { windowItems: feedItems.slice(start, activeIndex + 3), activeInWin: activeIndex - start };
  }, [activeIndex, feedItems]);

  useEffect(() => {
    const id = 'vp-styles';
    if (!document.getElementById(id)) {
      const s = document.createElement('style');
      s.id = id;
      s.textContent = `.vp-scroll::-webkit-scrollbar{display:none}.vp-scroll{-ms-overflow-style:none;scrollbar-width:none}`;
      document.head.appendChild(s);
    }
    return () => { document.getElementById(id)?.remove(); };
  }, []);

  if (initialLoad) return <LoadingScreen />;

  return (
    <ActiveIndexContext.Provider value={activeIndex}>
      <ModalOpenContext.Provider value={anyModalOpen}>
        <div className="fixed inset-0 bg-black overflow-hidden">
          <ActionBar
            onBack={handleBack} activeTab={activeTab} setActiveTab={setActiveTab}
            showSearch={showSearch} setShowSearch={setShowSearch}
            searchQuery={searchQuery} setSearchQuery={setSearchQuery}
            onAddVideo={handleAddVideo}
          />

          <div
            ref={containerRef}
            className="vp-scroll h-full w-full overflow-y-scroll snap-y snap-mandatory"
            style={{ willChange: 'transform', WebkitOverflowScrolling: 'touch' }}
          >
            {feedItems.map((item, index) => {
              const isVirtualized = Math.abs(index - activeIndex) > VIRTUAL_WINDOW;
              return isVirtualized ? (
                <SlidePlaceholder key={item.id} />
              ) : (
                <SlideItem
                  key={item.id}
                  item={item}
                  index={index}
                  onVisible={handleVisible}
                  onVideoEnded={handleVideoEnded}
                  onModalChange={handleModalChange}
                  isVirtualized={false}
                />
              );
            })}

            {(userLoading || aggLoading) && (
              <div className="h-20 flex items-center justify-center w-full">
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              </div>
            )}
          </div>

          {feedItems.length > 1 && (
            <div className="absolute right-1 top-1/2 -translate-y-1/2 flex flex-col gap-1 z-10 pointer-events-none">
              {windowItems.map((item, i) => (
                <div
                  key={i}
                  className={`rounded-full transition-all ${
                    i === activeInWin
                      ? item.type === 'ad'
                        ? 'bg-orange-500 w-1 h-4'
                        : item.isAggregated
                        ? 'bg-blue-400 w-1 h-4'
                        : 'bg-white w-1 h-4'
                      : 'bg-white/30 w-0.5 h-2'
                  }`}
                />
              ))}
            </div>
          )}

          {showModal && (
            <VideoModal
              showModal={showModal}
              setShowModal={setShowModal}
              onVideoPublished={handleVideoPublished}
            />
          )}
        </div>
      </ModalOpenContext.Provider>
    </ActiveIndexContext.Provider>
  );
};

export default memo(VideosPage);