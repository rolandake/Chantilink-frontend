// src/pages/videos/VideosPage.jsx - AFFICHAGE INSTANTANÉ
import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useVideos } from "../../context/VideoContext";
import VideoCard from "./VideoCard";
import VideoModal from "./VideoModal";
import {
  FaPlus,
  FaSearch,
  FaTh,
  FaPlay,
  FaFire,
  FaUserFriends,
  FaCompass,
  FaTimes,
  FaHeart,
  FaArrowLeft,
} from "react-icons/fa";

const VideosPage = () => {
  const navigate = useNavigate();
  const { getActiveUser } = useAuth();
  const currentUser = getActiveUser();
  const {
    videos,
    loading,
    hasMore,
    initialLoad,
    fetchVideos,
    incrementViews,
  } = useVideos();

  // ✅ TOUS LES STATES
  const [activeIndex, setActiveIndex] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [viewMode, setViewMode] = useState("swipe");
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredVideos, setFilteredVideos] = useState([]);
  const [activeTab, setActiveTab] = useState("foryou");
  const [showSearch, setShowSearch] = useState(false);

  // ✅ TOUS LES REFS
  const containerRef = useRef(null);
  const viewTracked = useRef(new Set());
  const fetchTriggered = useRef(false);

  // ✅ CALLBACKS
  const handleScroll = useCallback((e) => {
    if (viewMode !== "swipe") return;
    const container = containerRef.current;
    if (!container) return;

    const scrollTop = container.scrollTop;
    const windowHeight = container.clientHeight;
    const newIndex = Math.round(scrollTop / windowHeight);

    if (newIndex !== activeIndex && newIndex >= 0 && newIndex < filteredVideos.length) {
      setActiveIndex(newIndex);
    }

    const distanceToBottom = container.scrollHeight - (scrollTop + windowHeight);
    if (distanceToBottom < windowHeight * 2 && hasMore && !loading) {
      fetchVideos();
    }
  }, [activeIndex, filteredVideos.length, hasMore, loading, fetchVideos, viewMode]);

  // 🔥 NOUVEAU: Callback après publication
  const handleVideoPublished = useCallback((newVideo) => {
    console.log("✅ [VideosPage] Vidéo publiée, scroll vers le haut");
    
    // Réinitialiser l'index et scroller
    setActiveIndex(0);
    if (containerRef.current) {
      containerRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, []);

  // 🔥 MODIFIÉ: Fermeture simple du modal
  const handleModalClose = useCallback(() => {
    console.log("🔥 [VideosPage] Fermeture du modal");
    setShowModal(false);
  }, []);

  // ✅ EFFECTS

  // Effect 1: Inject global styles
  useEffect(() => {
    const styleId = 'videos-page-scrollbar-hide';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        .videos-page div::-webkit-scrollbar { 
          display: none; 
        }
      `;
      document.head.appendChild(style);
    }
    
    return () => {
      const style = document.getElementById(styleId);
      if (style) {
        style.remove();
      }
    };
  }, []);

  // Effect 2: Initial fetch
  useEffect(() => {
    if (!fetchTriggered.current) {
      fetchTriggered.current = true;
      fetchVideos(true);
    }
  }, [fetchVideos]);

  // Effect 3: Filter videos
  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = videos.filter(
        (v) =>
          v.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          v.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          v.uploadedBy?.username?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredVideos(filtered);
    } else {
      setFilteredVideos(videos);
    }
  }, [searchQuery, videos]);

  // Effect 4: Track views
  useEffect(() => {
    const activeVideo = filteredVideos[activeIndex];
    if (activeVideo && !viewTracked.current.has(activeVideo._id)) {
      viewTracked.current.add(activeVideo._id);
      incrementViews(activeVideo._id);
    }
  }, [activeIndex, filteredVideos, incrementViews]);

  // Loading skeleton
  if (initialLoad) {
    return (
      <div className="h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center px-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-16 h-16 sm:w-24 sm:h-24 mx-auto mb-8 border-4 border-orange-500/20 border-t-orange-500 rounded-full shadow-2xl shadow-orange-500/20"
          />
          <motion.p className="text-white text-xl sm:text-2xl font-bold mb-2">
            Chargement des vidéos...
          </motion.p>
          <motion.p className="text-gray-400 text-xs sm:text-sm">
            Préparation de votre feed personnalisé
          </motion.p>
        </motion.div>
      </div>
    );
  }

  // Action Bar Component
  const ActionBar = () => (
    <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/95 via-black/85 to-transparent backdrop-blur-xl px-4 py-3 border-b border-white/10">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        <motion.button
          onClick={() => navigate("/")}
          whileTap={{ scale: 0.9 }}
          whileHover={{ scale: 1.05 }}
          className="p-2.5 rounded-full bg-white/10 backdrop-blur-xl flex items-center justify-center text-white hover:bg-white/20 transition-all"
          title="Retour"
        >
          <FaArrowLeft className="text-lg" />
        </motion.button>

        <div className="flex gap-2 flex-1 justify-center">
          {[
            { id: "foryou", label: "Pour toi", icon: FaFire },
            { id: "following", label: "Abonnés", icon: FaUserFriends },
            { id: "discover", label: "Découvrir", icon: FaCompass },
          ].map((tab) => (
            <motion.button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              whileTap={{ scale: 0.95 }}
              whileHover={{ scale: 1.05 }}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full font-bold text-xs sm:text-sm transition-all ${
                activeTab === tab.id
                  ? "bg-white text-black shadow-lg"
                  : "text-white/80 hover:text-white hover:bg-white/10"
              }`}
            >
              <tab.icon className={activeTab === tab.id ? "animate-pulse" : ""} />
              <span className="hidden sm:inline">{tab.label}</span>
            </motion.button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <AnimatePresence>
              {showSearch && (
                <motion.div
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: "auto", opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  className="absolute right-0 top-0"
                >
                  <input
                    type="text"
                    placeholder="Rechercher..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-48 sm:w-64 pl-10 pr-4 py-2 bg-white/95 backdrop-blur-xl rounded-full text-black text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    autoFocus
                  />
                </motion.div>
              )}
            </AnimatePresence>
            <motion.button
              whileTap={{ scale: 0.9 }}
              whileHover={{ scale: 1.1 }}
              onClick={() => setShowSearch(!showSearch)}
              className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-xl flex items-center justify-center text-white hover:bg-white/20 transition-all"
            >
              {showSearch ? <FaTimes /> : <FaSearch />}
            </motion.button>
          </div>

          {viewMode === "swipe" && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              whileHover={{ scale: 1.1 }}
              onClick={() => setViewMode("feed")}
              className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-xl flex items-center justify-center text-white hover:bg-white/20 transition-all"
              title="Mode grille"
            >
              <FaTh />
            </motion.button>
          )}

          <motion.button
            whileTap={{ scale: 0.9 }}
            whileHover={{ scale: 1.15 }}
            onClick={() => setShowModal(true)}
            className="w-12 h-12 bg-gradient-to-r from-orange-500 via-pink-600 to-red-600 rounded-full flex items-center justify-center text-white shadow-xl hover:shadow-pink-500/60 transition-all"
          >
            <FaPlus className="text-lg" />
          </motion.button>
        </div>
      </div>
    </div>
  );

  // SWIPE MODE
  if (viewMode === "swipe") {
    return (
      <div className="videos-page relative h-screen bg-black overflow-hidden">
        <ActionBar />

        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="h-full pt-[60px] overflow-y-scroll snap-y snap-mandatory scroll-smooth"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {filteredVideos.length === 0 && !loading ? (
            <div className="h-screen flex items-center justify-center px-6">
              <motion.div className="text-center">
                <motion.div
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="text-8xl mb-6"
                >
                  🎬
                </motion.div>
                <p className="text-white text-3xl font-bold mb-3">Aucune vidéo</p>
                <p className="text-gray-400 text-lg mb-8">
                  Soyez le premier à partager du contenu !
                </p>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  whileHover={{ scale: 1.05 }}
                  onClick={() => setShowModal(true)}
                  className="px-10 py-5 bg-gradient-to-r from-orange-500 to-pink-600 text-white rounded-full font-bold text-xl hover:shadow-2xl hover:shadow-orange-500/50"
                >
                  <FaPlus className="inline mr-2" />
                  Créer une vidéo
                </motion.button>
              </motion.div>
            </div>
          ) : (
            <>
              {filteredVideos.map((video, index) => (
                <div key={video._id} className="h-screen snap-start relative">
                  <VideoCard video={video} isActive={index === activeIndex} />
                </div>
              ))}

              {loading && (
                <div className="h-screen flex items-center justify-center bg-black">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-20 h-20 border-4 border-orange-500/20 border-t-orange-500 rounded-full"
                  />
                </div>
              )}

              {!hasMore && filteredVideos.length > 0 && (
                <div className="h-screen flex items-center justify-center bg-gradient-to-b from-black to-gray-900 px-4">
                  <motion.div className="text-center text-gray-400">
                    <p className="text-3xl font-bold mb-3">🎉 C'est tout !</p>
                    <p className="text-lg mb-6">Vous avez vu toutes les vidéos</p>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => containerRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
                      className="px-8 py-3 bg-white/10 backdrop-blur-xl rounded-full text-white font-semibold hover:bg-white/20"
                    >
                      Retour au début
                    </motion.button>
                  </motion.div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="absolute right-2 top-1/2 -translate-y-1/2 z-10 flex flex-col gap-2 pointer-events-none">
          {filteredVideos.slice(0, 8).map((_, i) => (
            <motion.div
              key={i}
              animate={{
                height: i === activeIndex % 8 ? "1.5rem" : "0.3rem",
                opacity: i === activeIndex % 8 ? 1 : 0.3,
              }}
              className={`w-1 rounded-full transition-all ${
                i === activeIndex % 8
                  ? "bg-gradient-to-b from-orange-400 via-pink-500 to-red-600 shadow-lg"
                  : "bg-white/40"
              }`}
            />
          ))}
        </div>

        {/* 🔥 MODAL AVEC LES DEUX CALLBACKS */}
        <VideoModal 
          showModal={showModal} 
          setShowModal={handleModalClose}
          onVideoPublished={handleVideoPublished}
        />
      </div>
    );
  }

  // FEED MODE
  return (
    <div className="videos-page bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-950 dark:via-black dark:to-gray-900 min-h-screen">
      <ActionBar />

      <div className="pt-[76px] max-w-7xl mx-auto px-4 py-8">
        {loading && filteredVideos.length === 0 ? (
          <div className="flex justify-center py-32">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="w-16 h-16 border-4 border-orange-500/30 border-t-orange-500 rounded-full"
            />
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4"
          >
            {filteredVideos.map((video, index) => (
              <motion.div
                key={video._id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                whileHover={{ scale: 1.05, y: -5 }}
                onClick={() => {
                  setViewMode("swipe");
                  const idx = filteredVideos.findIndex((v) => v._id === video._id);
                  setActiveIndex(idx >= 0 ? idx : 0);
                }}
                className="aspect-[9/16] bg-gradient-to-br from-gray-800 to-gray-900 rounded-3xl overflow-hidden cursor-pointer shadow-xl hover:shadow-2xl relative group"
              >
                <video src={video.url} className="w-full h-full object-cover" preload="metadata" />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent opacity-60 group-hover:opacity-80" />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center">
                    <FaPlay className="text-white text-2xl ml-1" />
                  </div>
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-4 space-y-2">
                  <p className="text-white text-sm font-bold line-clamp-2 drop-shadow-lg">
                    {video.title || "Sans titre"}
                  </p>
                  <div className="flex items-center gap-3 text-white/90 text-xs font-semibold">
                    <span className="flex items-center gap-1">
                      <FaHeart className="text-pink-500" />
                      {video.likes || 0}
                    </span>
                    <span className="flex items-center gap-1">
                      💬 {video.comments?.length || 0}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}

        {!loading && filteredVideos.length === 0 && (
          <motion.div className="text-center py-32 px-4">
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="text-8xl mb-6"
            >
              🎬
            </motion.div>
            <p className="text-gray-700 dark:text-gray-300 text-2xl font-bold mb-3">
              Aucune vidéo trouvée
            </p>
            <p className="text-gray-500 dark:text-gray-500 text-lg mb-8">
              {searchQuery ? "Essayez avec d'autres mots-clés" : "Soyez le premier à créer une vidéo !"}
            </p>
            <motion.button
              whileTap={{ scale: 0.95 }}
              whileHover={{ scale: 1.05 }}
              onClick={() => setShowModal(true)}
              className="px-10 py-5 bg-gradient-to-r from-orange-500 to-pink-600 text-white rounded-full font-bold text-xl hover:shadow-2xl"
            >
              <FaPlus className="inline mr-3" />
              Créer une vidéo
            </motion.button>
          </motion.div>
        )}
      </div>

      {/* 🔥 MODAL AVEC LES DEUX CALLBACKS */}
      <VideoModal 
        showModal={showModal} 
        setShowModal={handleModalClose}
        onVideoPublished={handleVideoPublished}
      />
    </div>
  );
};

export default VideosPage;