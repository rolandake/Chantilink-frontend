// ============================================
// 📁 src/pages/Videos/VideosPage.INFINITE.jsx
// VERSION SCROLL INFINI - Pubs invisibles + contenu sans fin
// ============================================
import React, { useState, useEffect, useRef, useCallback, memo, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useVideos } from "../../context/VideoContext";
import VideoCard from "./VideoCard";
import VideoModal from "./VideoModal";
import VideoAd from "./Publicite/VideoAd.jsx"; // Version invisible
import {
  FaPlus, FaSearch, FaArrowLeft, FaTimes
} from "react-icons/fa";

// ============================================
// CONFIGURATION GLOBALE
// ============================================
const CONFIG = {
  ads: {
    enabled: true,
    frequency: 3, // Une pub tous les 3 posts
  },
  infiniteScroll: {
    enabled: true,
    minContentBeforeAds: 0, // Même si 0 posts, afficher des pubs
    adsToGenerate: 20, // Combien de pubs générer quand il n'y a plus de contenu
  }
};

const fastTransition = { duration: 0.15, ease: "easeOut" };

// ============================================
// ACTION BAR
// ============================================
const ActionBar = memo(({ 
  onBack, 
  activeTab, 
  setActiveTab, 
  showSearch, 
  setShowSearch, 
  searchQuery, 
  setSearchQuery,
  onAddVideo 
}) => (
  <div className="fixed top-0 inset-x-0 z-50 bg-gradient-to-b from-black/80 to-transparent px-4 py-3 pt-safe">
    <div className="flex items-center justify-between max-w-7xl mx-auto">
      
      <button
        onClick={onBack}
        className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/20 active:scale-95 transition-transform"
      >
        <FaArrowLeft />
      </button>

      <div className="flex gap-1 bg-black/30 backdrop-blur-xl rounded-full p-1 border border-white/10">
        {[
          { id: "foryou", label: "Pour toi" },
          { id: "following", label: "Suivis" }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
              activeTab === tab.id
                ? "bg-white text-black shadow-lg"
                : "text-white/70 hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <div className="relative">
          <AnimatePresence>
            {showSearch && (
              <motion.input
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 160, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={fastTransition}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher..."
                className="bg-white/20 backdrop-blur-md text-white placeholder-white/50 text-sm px-3 py-2 rounded-full outline-none mr-2"
                autoFocus
              />
            )}
          </AnimatePresence>
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
          >
            {showSearch ? <FaTimes /> : <FaSearch />}
          </button>
        </div>

        <button
          onClick={onAddVideo}
          className="w-10 h-10 rounded-full bg-gradient-to-r from-orange-500 to-pink-600 flex items-center justify-center text-white shadow-lg hover:scale-105 active:scale-95 transition-transform"
        >
          <FaPlus />
        </button>
      </div>
    </div>
  </div>
));

// ============================================
// LOADING SCREEN
// ============================================
const LoadingScreen = memo(() => (
  <div className="h-screen bg-black flex flex-col items-center justify-center z-50">
    <div className="w-16 h-16 border-4 border-gray-800 border-t-orange-500 rounded-full animate-spin mb-4" />
    <p className="text-white font-bold animate-pulse">Chargement du flux...</p>
  </div>
));

// ============================================
// COMPOSANT PRINCIPAL
// ============================================
const VideosPage = () => {
  const navigate = useNavigate();
  
  const { user: currentUser } = useAuth();
  
  const {
    videos,
    loading,
    hasMore,
    initialLoad,
    fetchVideos,
    incrementViews,
  } = useVideos();

  // États
  const [activeIndex, setActiveIndex] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [viewMode] = useState("swipe");
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredVideos, setFilteredVideos] = useState([]);
  const [activeTab, setActiveTab] = useState("foryou");
  const [showSearch, setShowSearch] = useState(false);

  // Refs
  const containerRef = useRef(null);
  const viewTracked = useRef(new Set());
  const fetchTriggered = useRef(false);
  const scrollTimeout = useRef(null);

  // ============================================
  // 🔥 LOGIQUE SCROLL INFINI AVEC PUBS
  // ============================================
  const feedItems = useMemo(() => {
    const items = [];
    const hasUserContent = filteredVideos.length > 0;

    if (hasUserContent) {
      // CAS 1 : Il y a des posts utilisateurs
      filteredVideos.forEach((video, index) => {
        // Ajouter le post
        items.push({ type: 'video', data: video, id: video._id });

        // Ajouter une pub tous les X posts (si activé)
        if (CONFIG.ads.enabled && (index + 1) % CONFIG.ads.frequency === 0) {
          items.push({ 
            type: 'ad', 
            id: `ad-${index}`,
            adIndex: Math.floor(index / CONFIG.ads.frequency)
          });
        }
      });

      // Ajouter des pubs à la fin pour le scroll infini
      if (CONFIG.infiniteScroll.enabled && !hasMore) {
        for (let i = 0; i < CONFIG.infiniteScroll.adsToGenerate; i++) {
          items.push({
            type: 'ad',
            id: `infinite-ad-${i}`,
            adIndex: i + 1000 // Index élevé pour éviter les collisions
          });
        }
      }
    } else {
      // CAS 2 : Aucun post utilisateur = QUE DES PUBS
      if (CONFIG.infiniteScroll.enabled) {
        for (let i = 0; i < CONFIG.infiniteScroll.adsToGenerate; i++) {
          items.push({
            type: 'ad',
            id: `solo-ad-${i}`,
            adIndex: i
          });
        }
      }
    }

    return items;
  }, [filteredVideos, hasMore]);

  // ============================================
  // GESTION DU SCROLL
  // ============================================
  const handleScroll = useCallback(() => {
    if (viewMode !== "swipe") return;
    
    if (scrollTimeout.current) {
      clearTimeout(scrollTimeout.current);
    }

    scrollTimeout.current = setTimeout(() => {
      const container = containerRef.current;
      if (!container) return;

      const scrollTop = container.scrollTop;
      const windowHeight = container.clientHeight;
      
      const newIndex = Math.round(scrollTop / windowHeight);

      if (newIndex !== activeIndex && newIndex >= 0 && newIndex < feedItems.length) {
        setActiveIndex(newIndex);
      }

      // Infinite Scroll : charger plus de posts utilisateurs si disponibles
      const distanceToBottom = container.scrollHeight - (scrollTop + windowHeight);
      if (distanceToBottom < windowHeight * 2 && hasMore && !loading) {
        fetchVideos();
      }

      // 🔥 Si on est proche de la fin des pubs, en générer plus
      if (CONFIG.infiniteScroll.enabled) {
        const totalItems = feedItems.length;
        const triggerPoint = totalItems - 5; // Déclencher 5 items avant la fin
        
        if (newIndex >= triggerPoint) {
          console.log('🔄 Génération de pubs supplémentaires...');
          // La logique se gère automatiquement via useMemo
        }
      }
    }, 50);
  }, [activeIndex, feedItems.length, hasMore, loading, fetchVideos, viewMode]);

  // ============================================
  // CALLBACKS
  // ============================================
  const handleVideoPublished = useCallback(() => {
    console.log("✅ [VideosPage] Vidéo publiée !");
    setActiveIndex(0);
    if (containerRef.current) {
      containerRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
    fetchVideos(true);
  }, [fetchVideos]);

  const handleBack = useCallback(() => navigate("/"), [navigate]);
  const handleAddVideo = useCallback(() => setShowModal(true), []);

  // ============================================
  // EFFECTS
  // ============================================
  
  // CSS Injection
  useEffect(() => {
    const styleId = 'videos-scrollbar-hide';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `.videos-container::-webkit-scrollbar { display: none; }`;
      document.head.appendChild(style);
    }
    return () => {
      const el = document.getElementById(styleId);
      if (el) el.remove();
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }
    };
  }, []);

  // Fetch initial
  useEffect(() => {
    if (!fetchTriggered.current) {
      fetchTriggered.current = true;
      fetchVideos(true);
    }
  }, [fetchVideos]);

  // Filtrage
  useEffect(() => {
    if (searchQuery.trim()) {
      const lowerQ = searchQuery.toLowerCase();
      const filtered = videos.filter((v) =>
        (v.title || "").toLowerCase().includes(lowerQ) ||
        (v.description || "").toLowerCase().includes(lowerQ) ||
        (v.uploadedBy?.username || "").toLowerCase().includes(lowerQ)
      );
      setFilteredVideos(filtered);
    } else {
      setFilteredVideos(videos);
    }
  }, [searchQuery, videos]);

  // Tracking vues (seulement pour les vidéos normales)
  useEffect(() => {
    const activeItem = feedItems[activeIndex];
    
    if (activeItem && activeItem.type === 'video') {
      const video = activeItem.data;
      
      if (!viewTracked.current.has(video._id)) {
        viewTracked.current.add(video._id);
        
        if (typeof incrementViews === 'function') {
          incrementViews(video._id);
        }
      }
    }
  }, [activeIndex, feedItems, incrementViews]);

  // ============================================
  // RENDER
  // ============================================
  
  if (initialLoad) {
    return <LoadingScreen />;
  }

  return (
    <div className="relative h-screen w-full bg-black overflow-hidden">
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
        className="videos-container h-full w-full overflow-y-scroll snap-y snap-mandatory scroll-smooth"
      >
        {feedItems.map((item, index) => (
          <div 
            key={item.id} 
            className="h-full w-full snap-start snap-always relative"
          >
            {item.type === 'ad' ? (
              <VideoAd 
                isActive={index === activeIndex}
              />
            ) : (
              <VideoCard 
                video={item.data} 
                isActive={index === activeIndex} 
              />
            )}
          </div>
        ))}
        
        {/* Loading indicator pour les posts utilisateurs */}
        {loading && (
          <div className="h-20 flex items-center justify-center w-full absolute bottom-0 z-20">
            <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* INDICATEUR DE POSITION */}
      {feedItems.length > 1 && (
        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex flex-col gap-1 z-10 pointer-events-none">
          {feedItems.slice(
            Math.max(0, activeIndex - 2), 
            activeIndex + 3
          ).map((item, i) => (
            <div 
              key={i} 
              className={`w-1 h-1 rounded-full transition-colors ${
                i === Math.min(2, activeIndex) 
                  ? item.type === 'ad' ? 'bg-orange-500' : 'bg-white'
                  : 'bg-white/30'
              }`} 
            />
          ))}
        </div>
      )}

      {/* MODAL CREATION */}
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