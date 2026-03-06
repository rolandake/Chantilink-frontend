// 📁 src/pages/Videos/VideosPage.jsx
//
// 🐛 FIX SAUT DÈS LE DÉBUT (ce commit) :
//
//   SYMPTÔME : les vidéos user (Cloudinary) sautent dès le début, avant
//              que l'utilisateur ne touche l'écran.
//
//   CAUSES IDENTIFIÉES :
//
//   1. IntersectionObserver déclenché au chargement initial :
//      Au montage, la slide 0 est visible → observer → handleVisible(0) → OK.
//      Mais Cloudinary provoque un repaint (chargement de la vidéo, thumbnail)
//      → l'intersectionRatio de la slide 0 fluctue brièvement → observer se
//      redéclenche avec un ratio légèrement < 0.85 puis > 0.85 → handleVisible(0)
//      appelé à nouveau → si entre-temps la slide 1 était dans le viewport
//      (pré-rendu, height pas encore stable) → handleVisible(1) → saut.
//
//   2. Debounce de 400ms insuffisant au boot :
//      Le premier chargement de Cloudinary peut prendre 1-3 secondes.
//      Pendant ce temps, des repaints multiples déclenchent handleVisible()
//      plusieurs fois. Le debounce de 400ms ne couvre pas ce cas.
//
//   3. VIRTUAL_WINDOW = 2 rend 3 slides visibles dans le DOM au démarrage :
//      Les slides 0, 1, 2 sont toutes rendues. Si la slide 1 entre à 86%
//      dans le viewport à cause d'un height instable → handleVisible(1).
//
//   FIXES APPLIQUÉS :
//
//   A. isScrollLocked ref : les 1500ms après le montage initial, handleVisible
//      est bloqué. Cela couvre le temps de premier chargement Cloudinary.
//      L'utilisateur ne peut pas scroller aussi vite → pas d'impact UX.
//
//   B. scrolledOnce ref : l'observer ne peut changer activeIndex QUE si
//      l'utilisateur a déjà scrollé (container 'scroll' event fired).
//      → Au boot, seule la slide 0 peut être active.
//      → Le premier changement d'index ne peut venir que d'un vrai scroll.
//
//   C. VIRTUAL_WINDOW réduit à 1 : seules les slides index-1, index, index+1
//      sont dans le DOM. Réduit les faux positifs de l'observer au boot.
//
//   D. threshold relevé à 0.92 (était 0.85) : encore moins sensible aux
//      repaints Cloudinary qui font fluctuer le ratio sur ≤ 8% de la slide.

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

// ✅ FIX C : VIRTUAL_WINDOW réduit à 1
// Avant : index-2 à index+2 = 5 slides dans le DOM au boot
// Après : index-1 à index+1 = 3 slides seulement → moins de faux positifs observer
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
        // ✅ FIX D : threshold 0.92 (était 0.85)
        // Les repaints Cloudinary font fluctuer le ratio de ±5-8%
        // → avec 0.92, il faut que 92% de la slide soit visible pour déclencher
        // → réduit fortement les faux positifs au chargement initial
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

  // ✅ FIX A : isScrollLocked — bloque handleVisible pendant 1500ms au boot
  // Cloudinary peut provoquer des repaints pendant le premier chargement.
  // 1500ms couvre le cas le plus lent (connexion mobile 3G).
  const isScrollLocked  = useRef(true);

  // ✅ FIX B : scrolledOnce — l'index ne peut changer QUE si l'utilisateur
  // a déjà scrollé au moins une fois. Empêche tout saut automatique au boot.
  const scrolledOnce    = useRef(false);

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

  // ✅ FIX A : déverrouiller après 1500ms
  useEffect(() => {
    const t = setTimeout(() => { isScrollLocked.current = false; }, 1500);
    return () => clearTimeout(t);
  }, []);

  // ✅ FIX B : écouter le scroll du container pour marquer scrolledOnce
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onScroll = () => {
      if (!scrolledOnce.current) {
        scrolledOnce.current = true;
        // Dès que l'utilisateur scrolle, déverrouiller immédiatement aussi
        isScrollLocked.current = false;
      }
    };
    container.addEventListener('scroll', onScroll, { passive: true });
    return () => container.removeEventListener('scroll', onScroll);
  }, []);

  const handleVideoEnded = useCallback((finishedIndex) => {
    const container = containerRef.current;
    if (!container) return;
    const nextIndex = finishedIndex + 1;
    if (nextIndex >= feedLengthRef.current) return;
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
    const seen    = new Set();
    const deduped = [];
    for (const item of mixed) {
      const uid = `${item._isAggregated ? 'agg' : 'user'}-${item._id || item.externalId}`;
      if (!seen.has(uid)) { seen.add(uid); deduped.push(item); }
    }
    setShuffledItems(shuffleArray(deduped));
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

  const handleVisible = useCallback((index) => {
    // ✅ FIX A : bloquer pendant le verrouillage initial (1500ms au boot)
    if (isScrollLocked.current) return;

    // ✅ FIX B : l'index ne peut changer que si l'utilisateur a scrollé au moins une fois
    // Exception : index === 0 toujours autorisé (slide initiale)
    if (!scrolledOnce.current && index !== 0) return;

    // Debounce 400ms (anti-repaint des portails)
    const now = Date.now();
    if (now - lastVisibleTime.current < 400) return;
    lastVisibleTime.current = now;

    setActiveIndex(index);

    if (index >= feedLengthRef.current - 5) {
      if (userHasMoreRef.current && !userLoadingRef.current) fetchUserVideosRef.current();
      if (aggHasMoreRef.current  && !aggLoadingRef.current)  fetchAggregatedRef.current(aggPageRef.current + 1, CONFIG.aggregated.loadMore);
    }
  }, []);

  const handleVideoPublished = useCallback(() => {
    setActiveIndex(0);
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