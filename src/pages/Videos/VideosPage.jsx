// 📁 src/pages/Videos/VideosPage.jsx
// Feed mixte : vidéos utilisateurs + contenus agrégés (Reddit, Mastodon, Vimeo, RSS)
import React, { useState, useEffect, useRef, useCallback, memo, useMemo } from 'react';
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
                <motion.input initial={{ width: 0, opacity: 0 }} animate={{ width: 120, opacity: 1 }} exit={{ width: 0, opacity: 0 }} transition={{ duration: 0.15 }}
                  value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Rechercher..."
                  className="absolute right-10 top-0 bg-white/20 backdrop-blur-md text-white placeholder-white/50 text-xs px-3 py-1.5 rounded-full outline-none" autoFocus />
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
const VideosPage = () => {
  const navigate  = useNavigate();
  const { getToken } = useAuth();
  const { videos: userVideos, loading: userLoading, hasMore: userHasMore, initialLoad, fetchVideos: fetchUserVideos } = useVideos();

  const [activeIndex, setActiveIndex]       = useState(0);
  const [showModal, setShowModal]           = useState(false);
  const [searchQuery, setSearchQuery]       = useState('');
  const [activeTab, setActiveTab]           = useState('foryou');
  const [showSearch, setShowSearch]         = useState(false);
  const [aggContents, setAggContents]       = useState([]);
  const [aggLoading, setAggLoading]         = useState(false);
  const [aggPage, setAggPage]               = useState(1);
  const [aggHasMore, setAggHasMore]         = useState(true);

  const containerRef    = useRef(null);
  const fetchTriggered  = useRef(false);
  const scrollTimeout   = useRef(null);
  const shuffleRef      = useRef(null);
  const shuffleKeyRef   = useRef(null);

  // ── Fetch contenus agrégés ──────────────────
  const fetchAggregated = useCallback(async (page = 1, limit = 25) => {
    if (!CONFIG.aggregated.enabled) return;
    try {
      setAggLoading(true);
      const token = await getToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`${API_BASE}/api/aggregated?page=${page}&limit=${limit}`, { headers });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      const items = (data.contents || []).map(c => ({ ...c, _isAggregated: true }));
      if (page === 1) setAggContents(items);
      else setAggContents(prev => [...prev, ...items]);
      setAggPage(page);
      setAggHasMore(data.pagination?.hasMore || false);
    } catch (err) {
      console.error('❌ [Aggregated]', err.message);
      setAggHasMore(false);
    } finally {
      setAggLoading(false);
    }
  }, [getToken]);

  // ── Init ────────────────────────────────────
  useEffect(() => {
    if (!fetchTriggered.current) {
      fetchTriggered.current = true;
      fetchUserVideos(true);
      fetchAggregated(1, CONFIG.aggregated.initialLoad);
    }
  }, []); // eslint-disable-line

  // ── Feed mixte : interleave users + agrégés ─
  const allItems = useMemo(() => {
    const key = `${userVideos?.length || 0}-${aggContents.length}`;
    if (shuffleKeyRef.current === key && shuffleRef.current) return shuffleRef.current;
    shuffleKeyRef.current = key;

    const userList = (userVideos || []).map(v => ({ ...v, _isUserVideo: true }));
    const mixed = [];
    const ratio  = CONFIG.aggregated.mixRatio;
    let aggIdx   = 0;

    // Intercaler 1 contenu agrégé toutes les `ratio` vidéos utilisateurs
    userList.forEach((v, i) => {
      mixed.push(v);
      if ((i + 1) % ratio === 0 && aggIdx < aggContents.length) {
        mixed.push(aggContents[aggIdx++]);
      }
    });
    // Ajouter les contenus agrégés restants
    while (aggIdx < aggContents.length) mixed.push(aggContents[aggIdx++]);

    // Shuffle léger
    for (let i = mixed.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [mixed[i], mixed[j]] = [mixed[j], mixed[i]];
    }

    shuffleRef.current = mixed;
    return mixed;
  }, [userVideos, aggContents]);

  // ── Filtre recherche ────────────────────────
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return allItems;
    const q = searchQuery.toLowerCase();
    return allItems.filter(v =>
      (v.title || '').toLowerCase().includes(q) ||
      (v.description || '').toLowerCase().includes(q) ||
      (v.channelName || v.username || '').toLowerCase().includes(q)
    );
  }, [allItems, searchQuery]);

  // ── Feed avec pubs ──────────────────────────
  const feedItems = useMemo(() => {
    const items = [];
    filteredItems.forEach((item, index) => {
      items.push({
        type: 'content',
        data: item,
        id: item._id || `item-${index}`,
        isAggregated: !!item._isAggregated,
      });
      if (CONFIG.ads.enabled && (index + 1) % CONFIG.ads.frequency === 0) {
        items.push({ type: 'ad', id: `ad-${index}` });
      }
    });
    return items;
  }, [filteredItems]);

  // ── Scroll ───────────────────────────────────
  const handleScroll = useCallback(() => {
    if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    scrollTimeout.current = setTimeout(() => {
      const c = containerRef.current;
      if (!c) return;
      const newIndex = Math.round(c.scrollTop / c.clientHeight);
      if (newIndex !== activeIndex && newIndex >= 0 && newIndex < feedItems.length) setActiveIndex(newIndex);
      if (c.scrollHeight - (c.scrollTop + c.clientHeight) < c.clientHeight * 2) {
        if (userHasMore && !userLoading) fetchUserVideos();
        if (aggHasMore && !aggLoading) fetchAggregated(aggPage + 1, CONFIG.aggregated.loadMore);
      }
    }, 150);
  }, [activeIndex, feedItems.length, userHasMore, userLoading, aggHasMore, aggLoading, aggPage, fetchUserVideos, fetchAggregated]);

  const handleVideoPublished = useCallback(() => {
    setActiveIndex(0);
    containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    shuffleRef.current = null; shuffleKeyRef.current = null;
    fetchUserVideos(true);
  }, [fetchUserVideos]);

  const handleBack     = useCallback(() => navigate('/'), [navigate]);
  const handleAddVideo = useCallback(() => setShowModal(true), []);

  // ── Styles scroll masqué ─────────────────────
  useEffect(() => {
    const id = 'vp-styles';
    if (!document.getElementById(id)) {
      const s = document.createElement('style');
      s.id = id;
      s.textContent = `.vp-scroll::-webkit-scrollbar{display:none}.vp-scroll{-ms-overflow-style:none;scrollbar-width:none}body{overflow:hidden}`;
      document.head.appendChild(s);
    }
    return () => { document.getElementById(id)?.remove(); if (scrollTimeout.current) clearTimeout(scrollTimeout.current); };
  }, []);

  if (initialLoad) return <LoadingScreen />;

  return (
    <div className="fixed inset-0 bg-black">
      <ActionBar onBack={handleBack} activeTab={activeTab} setActiveTab={setActiveTab}
        showSearch={showSearch} setShowSearch={setShowSearch}
        searchQuery={searchQuery} setSearchQuery={setSearchQuery}
        onAddVideo={handleAddVideo}
      />

      <div ref={containerRef} onScroll={handleScroll}
        className="vp-scroll h-full w-full overflow-y-scroll snap-y snap-mandatory">

        {feedItems.map((item, index) => (
          <div key={item.id} className="w-full snap-start snap-always flex-shrink-0" style={{ height: '100vh' }}>
            {item.type === 'ad' ? (
              <VideoAd isActive={index === activeIndex} />
            ) : item.isAggregated ? (
              // ← Contenu agrégé externe (Reddit, Mastodon, Vimeo, RSS)
              <AggregatedCard content={item.data} isActive={index === activeIndex} />
            ) : (
              // ← Vidéo publiée par un utilisateur de la plateforme
              <VideoCard video={item.data} isActive={index === activeIndex} isAutoPost={false} />
            )}
          </div>
        ))}

        {(userLoading || aggLoading) && (
          <div className="h-20 flex items-center justify-center w-full">
            <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Indicateur position */}
      {feedItems.length > 1 && (
        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex flex-col gap-1 z-10 pointer-events-none">
          {feedItems.slice(Math.max(0, activeIndex - 2), activeIndex + 3).map((item, i) => (
            <div key={i} className={`rounded-full transition-all ${
              i === Math.min(2, activeIndex)
                ? item.type === 'ad'       ? 'bg-orange-500 w-1 h-4'
                : item.isAggregated        ? 'bg-blue-400 w-1 h-4'
                                           : 'bg-white w-1 h-4'
                : 'bg-white/30 w-0.5 h-0.5'
            }`} />
          ))}
        </div>
      )}

      {showModal && (
        <VideoModal showModal={showModal} setShowModal={setShowModal} onVideoPublished={handleVideoPublished} />
      )}
    </div>
  );
};

export default memo(VideosPage);