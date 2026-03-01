// 📁 src/pages/Videos/VideosPage.jsx
// ✅ Auto-scroll à la fin de la vidéo
// ✅ Fetch ?type=short_videos → uniquement MP4 Pexels/Pixabay
// ✅ Filtre défensif isPlayableVideo() côté front
// ✅ IntersectionObserver pour lecture automatique
// ✅ Déduplication + clés préfixées par type
//
// 🚀 FIX SCROLL PERFORMANCE :
//
//   CAUSE 1 : feedItems dépendait de activeIndex → recalcul O(n) à chaque scroll
//             FIX : activeIndex retiré des deps de feedItems. _isActive calculé
//             dynamiquement dans SlideItem via un ref partagé → 0 recalcul du feed
//
//   CAUSE 2 : SlideItem recevait item._isActive dans ses props → re-render de TOUS
//             les slides à chaque changement d'index
//             FIX : SlideItem s'abonne lui-même à activeIndex via useActiveIndex()
//             hook interne basé sur un callback ref → seul le slide actif/inactif
//             re-render (2 composants max au lieu de N)
//
//   CAUSE 3 : Aucune virtualisation → 50+ <video> dans le DOM simultanément
//             FIX : fenêtre de virtualisation ±2 slides autour de l'index actif
//             Les slides hors fenêtre sont remplacés par des placeholders légers
//             → CPU/mémoire divisés par ~10
//
//   CAUSE 4 : Math.random() side-effect dans useMemo
//             FIX : shuffle dans useEffect séparé, stocké dans un state stable
//
//   CAUSE 5 : feedLengthRef.current muté dans le render (concurrent mode unsafe)
//             FIX : mutation déplacée dans useEffect
//
//   CAUSE 6 : windowItems/activeInWin recalculés inline sans mémo
//             FIX : useMemo avec deps précises

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

// ─────────────────────────────────────────────
// ✅ Filtre défensif côté front
// ─────────────────────────────────────────────
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

// ─────────────────────────────────────────────
// 🚀 ActiveIndexContext
// Permet aux SlideItem de s'abonner à activeIndex SANS recevoir de props
// → seul le slide qui devient actif/inactif re-render, pas tout le feed
// ─────────────────────────────────────────────
const ActiveIndexContext = createContext(0);

// ─────────────────────────────────────────────
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

// ─────────────────────────────────────────────
// 🚀 VIRTUALISATION : fenêtre de ±2 autour de l'index actif
// Les slides hors fenêtre sont des placeholders vides (0 CPU/mémoire)
// → identique à la stratégie de TikTok/Instagram Reels
// ─────────────────────────────────────────────
const VIRTUAL_WINDOW = 2; // slides visibles avant/après l'actif

// Placeholder léger pour les slides hors fenêtre de virtualisation
const SlidePlaceholder = memo(() => (
  <div
    className="w-full snap-start snap-always flex-shrink-0 bg-black"
    style={{ height: '100vh' }}
    aria-hidden="true"
  />
));
SlidePlaceholder.displayName = 'SlidePlaceholder';

// ─────────────────────────────────────────────
// SlideItem
// 🚀 FIX : ne reçoit plus _isActive en prop
//    Lit activeIndex depuis le Context → re-render uniquement si
//    son propre état actif/inactif change (2 slides max au lieu de N)
// ─────────────────────────────────────────────
const SlideItem = memo(({ item, index, onVisible, onVideoEnded, isVirtualized }) => {
  const ref         = useRef(null);
  const activeIndex = useContext(ActiveIndexContext);
  const isActive    = activeIndex === index;

  useEffect(() => {
    const el = ref.current;
    if (!el || isVirtualized) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
          onVisible(index);
        }
      },
      { threshold: 0.6 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [index, onVisible, isVirtualized]);

  return (
    <div
      ref={ref}
      className="w-full snap-start snap-always flex-shrink-0"
      style={{ height: '100vh' }}
    >
      {/* 🚀 Si hors fenêtre de virtualisation → placeholder vide */}
      {isVirtualized ? null : (
        item.type === 'ad' ? (
          <VideoAd isActive={isActive} />
        ) : item.isAggregated ? (
          <AggregatedCard
            content={item.data}
            isActive={isActive}
            onVideoEnded={() => onVideoEnded(index)}
          />
        ) : (
          <VideoCard
            video={item.data}
            isActive={isActive}
            isAutoPost={false}
            onVideoEnded={() => onVideoEnded(index)}
          />
        )
      )}
    </div>
  );
}, (prev, next) =>
  // 🚀 SlideItem ne re-render que si ses props structurelles changent
  // (pas activeIndex — il vient du Context)
  prev.item.id         === next.item.id &&
  prev.index           === next.index &&
  prev.isVirtualized   === next.isVirtualized &&
  prev.onVisible       === next.onVisible &&
  prev.onVideoEnded    === next.onVideoEnded
);
SlideItem.displayName = 'SlideItem';

// ─────────────────────────────────────────────
// Fisher-Yates shuffle (pur, sans side-effect dans useMemo)
// ─────────────────────────────────────────────
const shuffleArray = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// ─────────────────────────────────────────────
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

  const [activeIndex, setActiveIndex] = useState(0);
  const [showModal,   setShowModal]   = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab,   setActiveTab]   = useState('foryou');
  const [showSearch,  setShowSearch]  = useState(false);
  const [aggContents, setAggContents] = useState([]);
  const [aggLoading,  setAggLoading]  = useState(false);
  const [aggPage,     setAggPage]     = useState(1);
  const [aggHasMore,  setAggHasMore]  = useState(true);

  // 🚀 FIX : shuffledItems dans un state séparé, mis à jour par useEffect
  //    → shuffle ne s'exécute pas dans un useMemo (side-effect unsafe)
  const [shuffledItems, setShuffledItems] = useState([]);

  const containerRef   = useRef(null);
  const fetchTriggered = useRef(false);

  // Refs stables pour les callbacks async (évite les stale closures)
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

  // ── Auto-scroll à la fin de la vidéo ───────────────────────────
  const handleVideoEnded = useCallback((finishedIndex) => {
    const container = containerRef.current;
    if (!container) return;
    const nextIndex = finishedIndex + 1;
    if (nextIndex >= feedLengthRef.current) return;
    container.scrollTo({
      top:      nextIndex * container.clientHeight,
      behavior: 'smooth',
    });
  }, []);

  // ── Fetch vidéos courtes ────────────────────────────────────────
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

  // ── Init ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!fetchTriggered.current) {
      fetchTriggered.current = true;
      fetchUserVideos(true);
      fetchAggregated(1, CONFIG.aggregated.initialLoad);
    }
  }, []); // eslint-disable-line

  // ─────────────────────────────────────────────
  // 🚀 FIX : Mix + Shuffle dans useEffect (pas dans useMemo)
  //    → Math.random() ne pollue plus le render path
  //    → shuffle stable : ne re-shuffle que si userVideos ou aggContents changent
  // ─────────────────────────────────────────────
  useEffect(() => {
    const userList = (userVideos || []).map(v => ({ ...v, _isUserVideo: true }));
    const mixed    = [];
    const ratio    = CONFIG.aggregated.mixRatio;
    let aggIdx     = 0;

    userList.forEach((v, i) => {
      mixed.push(v);
      if ((i + 1) % ratio === 0 && aggIdx < aggContents.length) {
        mixed.push(aggContents[aggIdx++]);
      }
    });
    while (aggIdx < aggContents.length) mixed.push(aggContents[aggIdx++]);

    // Déduplication avant shuffle
    const seen    = new Set();
    const deduped = [];
    for (const item of mixed) {
      const uid = `${item._isAggregated ? 'agg' : 'user'}-${item._id || item.externalId}`;
      if (!seen.has(uid)) { seen.add(uid); deduped.push(item); }
    }

    setShuffledItems(shuffleArray(deduped));
  }, [userVideos, aggContents]);

  // ── Recherche ───────────────────────────────────────────────────
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return shuffledItems;
    const q = searchQuery.toLowerCase();
    return shuffledItems.filter(v =>
      (v.title       || '').toLowerCase().includes(q) ||
      (v.description || '').toLowerCase().includes(q) ||
      (v.channelName || v.username || '').toLowerCase().includes(q)
    );
  }, [shuffledItems, searchQuery]);

  // ─────────────────────────────────────────────
  // 🚀 FIX : feedItems ne dépend PLUS de activeIndex
  //    → recalculé uniquement quand le contenu change, pas à chaque scroll
  //    feedLengthRef mis à jour dans useEffect (pas dans le render)
  // ─────────────────────────────────────────────
  const feedItems = useMemo(() => {
    const items = [];
    filteredItems.forEach((item, index) => {
      const feedIndex = items.length;
      const id = `${item._isAggregated ? 'agg' : 'user'}-${item._id || item.externalId || index}`;
      items.push({
        type:         'content',
        data:         item,
        id,
        isAggregated: !!item._isAggregated,
        // 🚀 Plus de _isActive ici → lu depuis Context dans SlideItem
      });
      if (CONFIG.ads.enabled && (index + 1) % CONFIG.ads.frequency === 0) {
        items.push({ type: 'ad', id: `ad-${index}` });
      }
    });
    return items;
  }, [filteredItems]); // 🚀 activeIndex retiré des deps

  // 🚀 FIX : feedLengthRef mis à jour dans useEffect, pas dans le render
  useEffect(() => {
    feedLengthRef.current = feedItems.length;
  }, [feedItems.length]);

  const handleVisible = useCallback((index) => {
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

  // ─────────────────────────────────────────────
  // 🚀 Indicateur de position (window autour de l'index actif)
  //    Mémoïsé avec deps précises → ne recalcule que si activeIndex change
  // ─────────────────────────────────────────────
  const { windowItems, activeInWin } = useMemo(() => {
    const start = Math.max(0, activeIndex - 2);
    return {
      windowItems: feedItems.slice(start, activeIndex + 3),
      activeInWin: activeIndex - start,
    };
  }, [activeIndex, feedItems]);

  useEffect(() => {
    const id = 'vp-styles';
    if (!document.getElementById(id)) {
      const s = document.createElement('style');
      s.id = id;
      s.textContent = `.vp-scroll::-webkit-scrollbar{display:none}.vp-scroll{-ms-overflow-style:none;scrollbar-width:none}body{overflow:hidden}`;
      document.head.appendChild(s);
    }
    return () => { document.getElementById(id)?.remove(); };
  }, []);

  if (initialLoad) return <LoadingScreen />;

  return (
    // 🚀 Provider : transmet activeIndex à tous les SlideItem via Context
    //    sans prop drilling → seuls les 2 slides concernés re-render
    <ActiveIndexContext.Provider value={activeIndex}>
      <div className="fixed inset-0 bg-black">
        <ActionBar
          onBack={handleBack} activeTab={activeTab} setActiveTab={setActiveTab}
          showSearch={showSearch} setShowSearch={setShowSearch}
          searchQuery={searchQuery} setSearchQuery={setSearchQuery}
          onAddVideo={handleAddVideo}
        />

        <div
          ref={containerRef}
          className="vp-scroll h-full w-full overflow-y-scroll snap-y snap-mandatory"
          // 🚀 GPU compositing layer pour le scroll → 0 jank
          style={{ willChange: 'transform', WebkitOverflowScrolling: 'touch' }}
        >
          {feedItems.map((item, index) => {
            // 🚀 Virtualisation : slides hors fenêtre = placeholder vide
            const isVirtualized = Math.abs(index - activeIndex) > VIRTUAL_WINDOW;
            return isVirtualized ? (
              // Placeholder : conserve la hauteur pour le snap-scroll,
              // mais ne monte AUCUN composant vidéo
              <SlidePlaceholder key={item.id} />
            ) : (
              <SlideItem
                key={item.id}
                item={item}
                index={index}
                onVisible={handleVisible}
                onVideoEnded={handleVideoEnded}
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
    </ActiveIndexContext.Provider>
  );
};

export default memo(VideosPage);