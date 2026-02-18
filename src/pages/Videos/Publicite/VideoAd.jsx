// 📁 src/pages/Videos/Publicite/VideoAd.jsx
// Publicité vidéo - Style identique aux vrais posts (invisible comme pub)

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaHeart, FaRegHeart, FaComment, FaShare,
  FaVolumeUp, FaVolumeMute, FaPlay, FaCheckCircle, FaMusic
} from 'react-icons/fa';
import { HiDotsVertical } from 'react-icons/hi';

// ============================================
// BASE DE DONNÉES DES "POSTS SPONSORISÉS"
// Apparence identique aux vrais posts utilisateurs
// ============================================
const ADS_DATABASE = [
  {
    id: 'ad-1',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    user: {
      username: 'chantilink_officiel',
      photo: null,
      isVerified: true,
    },
    description: '🔥 La plateforme qui connecte tous les professionnels du BTP en Côte d\'Ivoire',
    musicName: 'Son original - Chantilink',
    likes: 1847,
    comments: 234,
  },
  {
    id: 'ad-2',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    user: {
      username: 'abidjan_vibes',
      photo: null,
      isVerified: true,
    },
    description: '✨ Abidjan by night 🌙 La ville qui ne dort jamais #abidjan #cotedivoire #lifestyle',
    musicName: 'Afro Night - DJ Mix',
    likes: 3201,
    comments: 451,
  },
  {
    id: 'ad-3',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    user: {
      username: 'btp_connect_ci',
      photo: null,
      isVerified: false,
    },
    description: '🏗️ Les plus beaux chantiers de 2026 — qui reconnaît son quartier ? #btp #construction #ci',
    musicName: 'Construction Vibes',
    likes: 892,
    comments: 167,
  },
  {
    id: 'ad-4',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
    user: {
      username: 'tendance_ci',
      photo: null,
      isVerified: true,
    },
    description: '💃 La mode ivoirienne s\'exporte partout dans le monde 🌍 Fiers de nos créateurs !',
    musicName: 'Coupé Décalé Mix 2026',
    likes: 5430,
    comments: 823,
  },
];

const generateDefaultAvatar = (username = "U") => {
  const char = (username || "U").charAt(0).toUpperCase();
  const colors = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6'];
  const color = colors[char.charCodeAt(0) % colors.length];
  return `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="${encodeURIComponent(color)}"/><text x="50%" y="50%" font-size="50" fill="white" text-anchor="middle" dy=".3em" font-family="Arial">${char}</text></svg>`;
};

// ============================================
// COMPOSANT PRINCIPAL
// ============================================
const VideoAd = ({ isActive }) => {
  const videoRef = useRef(null);
  const [muted, setMuted] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showHeart, setShowHeart] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [localLikes, setLocalLikes] = useState(0);
  const [adData, setAdData] = useState(null);

  // Sélectionner une pub aléatoire au montage
  useEffect(() => {
    const randomAd = ADS_DATABASE[Math.floor(Math.random() * ADS_DATABASE.length)];
    setAdData(randomAd);
    setLocalLikes(randomAd.likes);
  }, []);

  // Lecture/pause selon isActive
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !adData) return;

    if (isActive) {
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => setIsPaused(false))
          .catch(() => {
            setMuted(true);
            video.muted = true;
            video.play().catch(() => {});
          });
      }
    } else {
      video.pause();
      video.currentTime = 0;
      setIsPaused(false);
    }
  }, [isActive, adData]);

  const handleTimeUpdate = useCallback(() => {
    const vid = videoRef.current;
    if (vid && vid.duration) setProgress((vid.currentTime / vid.duration) * 100);
  }, []);

  const togglePlay = useCallback(() => {
    const vid = videoRef.current;
    if (!vid) return;
    if (vid.paused) { vid.play().catch(() => {}); setIsPaused(false); }
    else { vid.pause(); setIsPaused(true); }
  }, []);

  const handleDoubleTap = useCallback((e) => {
    e.stopPropagation();
    setShowHeart(true);
    setTimeout(() => setShowHeart(false), 800);
    if (!isLiked) {
      setIsLiked(true);
      setLocalLikes(prev => prev + 1);
    }
  }, [isLiked]);

  const handleLike = useCallback((e) => {
    e?.stopPropagation();
    setIsLiked(prev => {
      setLocalLikes(l => prev ? l - 1 : l + 1);
      return !prev;
    });
  }, []);

  const handleShare = useCallback((e) => {
    e.stopPropagation();
    if (navigator.share) {
      navigator.share({ title: "Regarde cette vidéo !", url: window.location.href }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
    }
  }, []);

  if (!adData) return null;

  return (
    <div className="relative w-full h-full bg-black overflow-hidden select-none">

      {/* VIDÉO — identique au VideoCard */}
      <video
        ref={videoRef}
        src={adData.videoUrl}
        className="w-full h-full object-cover"
        loop
        muted={muted}
        playsInline
        preload="auto"
        onClick={togglePlay}
        onDoubleClick={handleDoubleTap}
        onTimeUpdate={handleTimeUpdate}
      />

      {/* Overlay gradient identique */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/80 pointer-events-none" />

      {/* Barre de progression identique */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gray-800/30 z-20">
        <motion.div
          className="h-full bg-gradient-to-r from-orange-500 to-pink-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Icône pause identique */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
        {isPaused && <FaPlay className="text-white/50 text-6xl animate-pulse" />}
        <AnimatePresence>
          {showHeart && (
            <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1.5, opacity: 1 }} exit={{ scale: 2, opacity: 0 }} className="absolute">
              <FaHeart className="text-red-500 text-8xl drop-shadow-2xl" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* INFOS UTILISATEUR — identique au VideoCard */}
      <div className="absolute bottom-4 left-4 right-16 z-30 pb-safe">
        <div className="flex items-center gap-3 mb-3">
          <img
            src={adData.user.photo || generateDefaultAvatar(adData.user.username)}
            alt={adData.user.username}
            className="w-11 h-11 rounded-full border-2 border-white shadow-md object-cover bg-gray-700"
          />
          <div className="flex flex-col">
            <h3 className="font-bold text-white text-base flex items-center gap-1 drop-shadow-md">
              @{adData.user.username}
              {adData.user.isVerified && <FaCheckCircle className="text-orange-500 text-xs" />}
            </h3>
          </div>
        </div>

        <div className="text-white/90 text-sm mb-2 max-w-[90%] drop-shadow-md pointer-events-auto">
          <p className="line-clamp-2">{adData.description}</p>
        </div>

        <div className="flex items-center gap-2 text-white/80 text-xs font-medium bg-white/10 w-fit px-3 py-1 rounded-full backdrop-blur-sm">
          <FaMusic className="animate-spin-slow" />
          <span className="truncate max-w-[150px]">{adData.musicName}</span>
        </div>
      </div>

      {/* ACTIONS — identiques au VideoCard */}
      <div className="absolute right-2 bottom-20 flex flex-col items-center gap-6 z-40 pb-safe pointer-events-auto">

        {/* Like */}
        <div className="flex flex-col items-center gap-1">
          <motion.button whileTap={{ scale: 0.8 }} onClick={handleLike} className={`w-10 h-10 rounded-full flex items-center justify-center text-3xl drop-shadow-xl transition-colors ${isLiked ? 'text-red-500' : 'text-white'}`}>
            {isLiked ? <FaHeart /> : <FaRegHeart />}
          </motion.button>
          <span className="text-xs font-bold text-white drop-shadow-md">{localLikes.toLocaleString()}</span>
        </div>

        {/* Commentaires */}
        <div className="flex flex-col items-center gap-1">
          <motion.button whileTap={{ scale: 0.8 }} className="w-10 h-10 rounded-full flex items-center justify-center text-white text-3xl drop-shadow-xl">
            <FaComment />
          </motion.button>
          <span className="text-xs font-bold text-white drop-shadow-md">{adData.comments}</span>
        </div>

        {/* Partager */}
        <div className="flex flex-col items-center gap-1">
          <motion.button whileTap={{ scale: 0.8 }} onClick={handleShare} className="w-10 h-10 rounded-full flex items-center justify-center text-white text-3xl drop-shadow-xl">
            <FaShare />
          </motion.button>
          <span className="text-xs font-bold text-white drop-shadow-md">Partager</span>
        </div>

        {/* Son */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={(e) => {
            e.stopPropagation();
            setMuted(!muted);
            if (videoRef.current) videoRef.current.muted = !muted;
          }}
          className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center text-white mt-2"
        >
          {muted ? <FaVolumeMute /> : <FaVolumeUp />}
        </motion.button>

        {/* Trois points */}
        <button className="text-white text-xl drop-shadow-lg p-2">
          <HiDotsVertical />
        </button>
      </div>

    </div>
  );
};

export default VideoAd;