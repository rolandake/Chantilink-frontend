// src/pages/Videos/VideosPage.jsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useVideos } from "../../context/VideoContext";
import VideoCard from "./VideoCard";
import VideoModal from "./VideoModal";
import {
  FaPlus, FaSearch, FaTh, FaPlay, FaFire,
  FaUserFriends, FaCompass, FaTimes, FaHeart, FaArrowLeft,
} from "react-icons/fa";

const VideosPage = () => {
  const navigate = useNavigate();
  
  // ✅ 1. AUTH STANDARDISÉE (Compatible avec votre Context)
  const { user: currentUser } = useAuth();
  
  const {
    videos,
    loading,
    hasMore,
    initialLoad,
    fetchVideos,
    incrementViews, // Cette fonction vient du Context corrigé
  } = useVideos();

  // États
  const [activeIndex, setActiveIndex] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [viewMode, setViewMode] = useState("swipe");
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredVideos, setFilteredVideos] = useState([]);
  const [activeTab, setActiveTab] = useState("foryou");
  const [showSearch, setShowSearch] = useState(false);

  // Refs
  const containerRef = useRef(null);
  const viewTracked = useRef(new Set());
  const fetchTriggered = useRef(false);

  // ✅ 2. GESTION DU SCROLL
  const handleScroll = useCallback((e) => {
    if (viewMode !== "swipe") return;
    const container = containerRef.current;
    if (!container) return;

    const scrollTop = container.scrollTop;
    const windowHeight = container.clientHeight;
    
    // Calcul de l'index actuel
    const newIndex = Math.round(scrollTop / windowHeight);

    if (newIndex !== activeIndex && newIndex >= 0 && newIndex < filteredVideos.length) {
      setActiveIndex(newIndex);
    }

    // Infinite Scroll
    const distanceToBottom = container.scrollHeight - (scrollTop + windowHeight);
    if (distanceToBottom < windowHeight * 2 && hasMore && !loading) {
      fetchVideos();
    }
  }, [activeIndex, filteredVideos.length, hasMore, loading, fetchVideos, viewMode]);

  // Callback publication
  const handleVideoPublished = useCallback((newVideo) => {
    console.log("✅ [VideosPage] Vidéo publiée !");
    setActiveIndex(0);
    if (containerRef.current) {
      containerRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
    // Force un refresh léger si besoin
    fetchVideos(true);
  }, [fetchVideos]);

  // CSS Injection pour cacher la scrollbar (proprement)
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
      if(el) el.remove();
    };
  }, []);

  // Fetch initial unique
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

  // ✅ 3. TRACKING VUES SÉCURISÉ (Empêche le crash)
  useEffect(() => {
    const activeVideo = filteredVideos[activeIndex];
    
    if (activeVideo && !viewTracked.current.has(activeVideo._id)) {
      viewTracked.current.add(activeVideo._id);
      
      // Sécurité absolue : on vérifie que la fonction existe avant d'appeler
      if (typeof incrementViews === 'function') {
         incrementViews(activeVideo._id);
      }
    }
  }, [activeIndex, filteredVideos, incrementViews]);

  // LOADING SCREEN
  if (initialLoad) {
    return (
      <div className="h-screen bg-black flex flex-col items-center justify-center z-50">
        <div className="w-16 h-16 border-4 border-gray-800 border-t-orange-500 rounded-full animate-spin mb-4"></div>
        <p className="text-white font-bold animate-pulse">Chargement du flux...</p>
      </div>
    );
  }

  // COMPOSANT BARRE D'ACTION
  const ActionBar = () => (
    <div className="fixed top-0 inset-x-0 z-50 bg-gradient-to-b from-black/80 to-transparent px-4 py-3 pt-safe">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        
        {/* RETOUR */}
        <button
          onClick={() => navigate("/")}
          className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/20 active:scale-95 transition"
        >
          <FaArrowLeft />
        </button>

        {/* TABS CENTRAUX */}
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

        {/* ACTIONS DROITE */}
        <div className="flex items-center gap-2">
          {/* RECHERCHE */}
          <div className="relative">
            <AnimatePresence>
              {showSearch && (
                <motion.input
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 160, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
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
              className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition"
            >
              {showSearch ? <FaTimes /> : <FaSearch />}
            </button>
          </div>

          {/* ADD BUTTON */}
          <button
            onClick={() => setShowModal(true)}
            className="w-10 h-10 rounded-full bg-gradient-to-r from-orange-500 to-pink-600 flex items-center justify-center text-white shadow-lg hover:scale-105 active:scale-95 transition"
          >
            <FaPlus />
          </button>
        </div>
      </div>
    </div>
  );

  // RENDER : MODE SWIPE (TikTok Style)
  if (viewMode === "swipe") {
    return (
      <div className="relative h-screen w-full bg-black overflow-hidden">
        <ActionBar />

        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="videos-container h-full w-full overflow-y-scroll snap-y snap-mandatory scroll-smooth"
        >
          {filteredVideos.length === 0 && !loading ? (
             <div className="h-full flex flex-col items-center justify-center text-white space-y-4">
                 <div className="text-6xl">📹</div>
                 <h2 className="text-2xl font-bold">Aucune vidéo</h2>
                 <p className="text-gray-400">Soyez le premier à publier !</p>
                 <button 
                    onClick={() => setShowModal(true)}
                    className="px-6 py-3 bg-white text-black rounded-full font-bold hover:scale-105 transition"
                 >
                    Créer une vidéo
                 </button>
             </div>
          ) : (
            filteredVideos.map((video, index) => (
              <div key={video._id} className="h-full w-full snap-start snap-always relative">
                 {/* On passe isActive pour gérer l'autoplay intelligent */}
                 <VideoCard video={video} isActive={index === activeIndex} />
              </div>
            ))
          )}
          
          {loading && (
             <div className="h-20 flex items-center justify-center w-full absolute bottom-0 z-20">
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
             </div>
          )}
        </div>

        {/* INDICATEUR DE POSITION (Facultatif) */}
        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex flex-col gap-1 z-10 pointer-events-none">
           {filteredVideos.slice(Math.max(0, activeIndex - 2), activeIndex + 3).map((_, i) => (
               <div key={i} className="w-1 h-1 bg-white/30 rounded-full" />
           ))}
        </div>

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
  }

  return null; // Fallback si autre mode
};

export default React.memo(VideosPage);