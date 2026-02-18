// ============================================
// 📁 src/pages/Videos/VideosPage.jsx
// VERSION FINALE CORRIGÉE - Fix URL auto-posts + double /api
// ============================================
import React, { useState, useEffect, useRef, useCallback, memo, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useVideos } from "../../context/VideoContext";
import VideoCard from "./VideoCard";
import VideoModal from "./VideoModal";
import VideoAd from "./Publicite/VideoAd.jsx";
import {
  FaPlus, FaSearch, FaArrowLeft, FaTimes, FaFire
} from "react-icons/fa";

// ✅ CORRECTION : Extraire la base URL sans /api pour éviter le double /api
const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api$/, '');

const CONFIG = {
  ads: { enabled: true, frequency: 5 },
  autoPosts: { enabled: true, initialLoad: 30, loadMore: 15 }
};

const ActionBar = memo(({ onBack, activeTab, setActiveTab, showSearch, setShowSearch, searchQuery, setSearchQuery, onAddVideo }) => (
  <div className="absolute top-0 left-0 right-0 z-50 pointer-events-none">
    <div className="bg-gradient-to-b from-black/90 via-black/60 to-transparent px-3 py-2 pt-safe pointer-events-auto">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <button onClick={onBack} className="w-9 h-9 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/20 active:scale-95 transition-transform">
          <FaArrowLeft className="text-sm" />
        </button>
        <div className="flex gap-0.5 bg-black/40 backdrop-blur-xl rounded-full p-0.5 border border-white/10">
          {[{ id: "foryou", label: "Pour toi", icon: FaFire }, { id: "following", label: "Suivis" }].map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all flex items-center gap-1 ${activeTab === tab.id ? "bg-white text-black" : "text-white/70 hover:text-white"}`}>
              {tab.icon && <tab.icon className="w-2.5 h-2.5" />}
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <div className="relative">
            <AnimatePresence>
              {showSearch && (
                <motion.input initial={{ width: 0, opacity: 0 }} animate={{ width: 120, opacity: 1 }} exit={{ width: 0, opacity: 0 }} transition={{ duration: 0.15, ease: "easeOut" }} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Rechercher..." className="absolute right-10 top-0 bg-white/20 backdrop-blur-md text-white placeholder-white/50 text-xs px-3 py-1.5 rounded-full outline-none" autoFocus />
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
  <div className="h-screen bg-black flex flex-col items-center justify-center z-50">
    <div className="w-16 h-16 border-4 border-gray-800 border-t-orange-500 rounded-full animate-spin mb-4" />
    <p className="text-white font-bold animate-pulse">Chargement du flux...</p>
  </div>
));
LoadingScreen.displayName = 'LoadingScreen';

const VideosPage = () => {
  const navigate = useNavigate();
  const { user: currentUser, getToken } = useAuth();
  const { videos: userVideos, loading: userLoading, hasMore: userHasMore, initialLoad, fetchVideos: fetchUserVideos, incrementViews } = useVideos();

  const [activeIndex, setActiveIndex] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("foryou");
  const [showSearch, setShowSearch] = useState(false);
  const [autoPosts, setAutoPosts] = useState([]);
  const [autoLoading, setAutoLoading] = useState(false);
  const [autoPage, setAutoPage] = useState(1);
  const [autoHasMore, setAutoHasMore] = useState(true);

  const containerRef = useRef(null);
  const viewTracked = useRef(new Set());
  const fetchTriggered = useRef(false);
  const scrollTimeout = useRef(null);

  const fetchAutoPosts = useCallback(async (page = 1, limit = 30) => {
    if (!CONFIG.autoPosts.enabled || autoLoading) return;
    try {
      setAutoLoading(true);
      
      // ✅ CORRECTION PRINCIPALE : utiliser API_BASE (sans /api) + ajouter /api manuellement
      const url = `${API_BASE}/api/posts?page=${page}&limit=${limit}&autoGenerated=true`;
      
      console.log('🔍 [AUTO-POSTS] URL appelée:', url);
      
      const token = await getToken();
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const res = await fetch(url, { headers });
      
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      
      const data = await res.json();
      
      // ✅ Gérer les deux formats de réponse possibles (data.posts ou data.data)
      const posts = data.posts || data.data || [];
      
      const convertedPosts = posts
        .filter(post => post.media?.length > 0 || post.videoUrl || post.image)
        .map(post => ({
          _id: post._id,
          _isAutoPost: true,
          _source: 'backend-auto',
          title: post.content || post.title || '',
          description: post.content || post.description || '',
          // ✅ Priorité videoUrl, puis première image media[]
          videoUrl: post.mediaType === 'video' ? post.media?.[0] : null,
          url: post.mediaType === 'video' ? post.media?.[0] : post.media?.[0],
          thumbnail: post.mediaType === 'image' ? post.media?.[0] : null,
          image: post.mediaType === 'image' ? post.media?.[0] : null,
          uploadedBy: post.user,
          user: post.user,
          username: post.user?.username || 'chantilink_ai',
          avatar: post.user?.profilePhoto,
          views: post.viewsCount || 0,
          likes: Array.isArray(post.likes) ? post.likes : [],
          comments: Array.isArray(post.comments) ? post.comments : [],
          shares: post.sharesCount || 0,
          category: post.location || 'general',
          hashtags: [],
          isVerified: post.user?.isVerified || false,
          createdAt: post.createdAt,
          updatedAt: post.updatedAt,
          autoGenerated: post.autoGenerated,
        }));

      console.log(`✅ [AUTO-POSTS] ${convertedPosts.length} posts convertis (page ${page})`);
      
      if (page === 1) {
        setAutoPosts(convertedPosts);
      } else {
        setAutoPosts(prev => [...prev, ...convertedPosts]);
      }
      setAutoPage(page);
      setAutoHasMore(convertedPosts.length >= limit);
    } catch (error) {
      console.error('❌ [AUTO-POSTS] Erreur:', error);
      setAutoHasMore(false);
    } finally {
      setAutoLoading(false);
    }
  }, [getToken, autoLoading]);

  useEffect(() => {
    if (!fetchTriggered.current) {
      fetchTriggered.current = true;
      fetchUserVideos(true);
      if (CONFIG.autoPosts.enabled) fetchAutoPosts(1, CONFIG.autoPosts.initialLoad);
    }
  }, [fetchUserVideos, fetchAutoPosts]);

  const allVideos = useMemo(() => {
    const combined = [];
    if (userVideos && userVideos.length > 0) {
      combined.push(...userVideos.map(v => ({ ...v, _isUserVideo: true, _isAutoPost: false })));
    }
    if (CONFIG.autoPosts.enabled && autoPosts.length > 0) {
      combined.push(...autoPosts);
    }
    // Mélange aléatoire
    for (let i = combined.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [combined[i], combined[j]] = [combined[j], combined[i]];
    }
    console.log('📊 [FEED]', { total: combined.length, utilisateurs: userVideos?.length || 0, autoPosts: autoPosts.length });
    return combined;
  }, [userVideos, autoPosts]);

  const filteredVideos = useMemo(() => {
    if (!searchQuery.trim()) return allVideos;
    const q = searchQuery.toLowerCase();
    return allVideos.filter(v =>
      (v.title || '').toLowerCase().includes(q) ||
      (v.description || '').toLowerCase().includes(q) ||
      (v.username || '').toLowerCase().includes(q) ||
      (v.hashtags || []).some(tag => tag.toLowerCase().includes(q))
    );
  }, [allVideos, searchQuery]);

  const feedItems = useMemo(() => {
    const items = [];
    filteredVideos.forEach((video, index) => {
      items.push({ type: 'video', data: video, id: video._id || `video-${index}` });
      if (CONFIG.ads.enabled && (index + 1) % CONFIG.ads.frequency === 0) {
        items.push({ type: 'ad', id: `ad-${index}`, adIndex: Math.floor(index / CONFIG.ads.frequency) });
      }
    });
    return items;
  }, [filteredVideos]);

  const handleScroll = useCallback(() => {
    if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    scrollTimeout.current = setTimeout(() => {
      const container = containerRef.current;
      if (!container) return;
      const scrollTop = container.scrollTop;
      const windowHeight = container.clientHeight;
      const newIndex = Math.round(scrollTop / windowHeight);
      if (newIndex !== activeIndex && newIndex >= 0 && newIndex < feedItems.length) {
        setActiveIndex(newIndex);
      }
      const distanceToBottom = container.scrollHeight - (scrollTop + windowHeight);
      if (distanceToBottom < windowHeight * 2) {
        if (userHasMore && !userLoading) fetchUserVideos();
        if (CONFIG.autoPosts.enabled && autoHasMore && !autoLoading) {
          fetchAutoPosts(autoPage + 1, CONFIG.autoPosts.loadMore);
        }
      }
    }, 50);
  }, [activeIndex, feedItems.length, userHasMore, userLoading, autoHasMore, autoLoading, autoPage, fetchUserVideos, fetchAutoPosts]);

  const handleVideoPublished = useCallback(() => {
    setActiveIndex(0);
    if (containerRef.current) containerRef.current.scrollTo({ top: 0, behavior: "smooth" });
    fetchUserVideos(true);
    if (CONFIG.autoPosts.enabled) fetchAutoPosts(1, CONFIG.autoPosts.initialLoad);
  }, [fetchUserVideos, fetchAutoPosts]);

  const handleBack = useCallback(() => navigate("/"), [navigate]);
  const handleAddVideo = useCallback(() => setShowModal(true), []);

  useEffect(() => {
    const activeItem = feedItems[activeIndex];
    if (activeItem?.type === 'video' && activeItem.data._isUserVideo) {
      if (!viewTracked.current.has(activeItem.data._id)) {
        viewTracked.current.add(activeItem.data._id);
        if (incrementViews) incrementViews(activeItem.data._id);
      }
    }
  }, [activeIndex, feedItems, incrementViews]);

  useEffect(() => {
    const styleId = 'videos-page-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `.videos-container::-webkit-scrollbar { display: none; } .videos-container { -ms-overflow-style: none; scrollbar-width: none; } body { overflow: hidden; }`;
      document.head.appendChild(style);
    }
    return () => {
      const el = document.getElementById(styleId);
      if (el) el.remove();
      if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    };
  }, []);

  if (initialLoad) return <LoadingScreen />;

  return (
    <div className="fixed inset-0 bg-black">
      <ActionBar
        onBack={handleBack}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        showSearch={showSearch}
        setShowSearch={setShowSearch}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onAddVideo={handleAddVideo}
      />
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="videos-container h-full w-full overflow-y-scroll snap-y snap-mandatory"
      >
        {feedItems.map((item, index) => (
          <div key={item.id} className="w-full snap-start snap-always flex-shrink-0" style={{ height: '100vh' }}>
            {item.type === 'ad'
              ? <VideoAd isActive={index === activeIndex} />
              : <VideoCard video={item.data} isActive={index === activeIndex} isAutoPost={item.data._isAutoPost} />
            }
          </div>
        ))}
        {(userLoading || autoLoading) && (
          <div className="h-20 flex items-center justify-center w-full">
            <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        )}
      </div>
      {feedItems.length > 1 && (
        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex flex-col gap-1 z-10 pointer-events-none">
          {feedItems.slice(Math.max(0, activeIndex - 2), activeIndex + 3).map((item, i) => (
            <div key={i} className={`w-0.5 h-0.5 rounded-full transition-all ${i === Math.min(2, activeIndex) ? item.type === 'ad' ? 'bg-orange-500 w-1 h-4' : 'bg-white w-1 h-4' : 'bg-white/30'}`} />
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
  );
};

export default memo(VideosPage);