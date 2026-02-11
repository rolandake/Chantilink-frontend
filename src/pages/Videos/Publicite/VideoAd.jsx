// ============================================
// 📁 src/pages/Videos/Publicite/VideoAd.FULL_INTERACTIVE.jsx
// Publicité 100% INTERACTIVE - Indistinguable d'un vrai post
// ============================================
import React, { memo, useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ExternalLink,
  Volume2, 
  VolumeX,
  Heart,
  MessageCircle,
  Share2,
  Download,
  MoreVertical,
  ShoppingBag,
  Smartphone,
  Plane,
  BookOpen,
  Home as HomeIcon,
  CheckCircle,
  Send,
  X
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// ============================================
// BASE DE DONNÉES ENRICHIE
// ============================================
const VIDEO_ADS = [
  {
    id: 1,
    user: {
      username: "fashionabidjan",
      fullName: "Fashion Abidjan",
      photo: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&q=80",
      isVerified: true
    },
    title: "Nouvelle Collection Wax 2026 🔥",
    description: "Les meilleurs tissus wax et kita directement d'Abidjan ! Livraison gratuite 📦 #FashionCI #Wax",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    thumbnailUrl: "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800&q=80",
    musicName: "Son original - Fashion Abidjan",
    ctaUrl: "#",
    ctaText: "Voir la boutique",
    likes: 12400,
    comments: [
      { id: 1, user: { username: "sarah_ci", photo: "https://i.pravatar.cc/150?img=1" }, text: "Trop beau ! 😍", createdAt: "2026-02-10T10:30:00Z" },
      { id: 2, user: { username: "kouame225", photo: "https://i.pravatar.cc/150?img=2" }, text: "Les prix svp ?", createdAt: "2026-02-10T11:15:00Z" },
      { id: 3, user: { username: "mariam_abj", photo: "https://i.pravatar.cc/150?img=3" }, text: "Vous livrez à Yopougon ?", createdAt: "2026-02-10T12:00:00Z" },
    ],
    icon: <ShoppingBag className="w-5 h-5" />,
    gradient: "from-pink-500 to-rose-600",
    category: "Mode"
  },
  {
    id: 2,
    user: {
      username: "techstoreci",
      fullName: "TechStore Abidjan",
      photo: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&q=80",
      isVerified: true
    },
    title: "iPhone 16 Pro Max En Stock ! 📱",
    description: "Garantie 1 an Apple 🍎 | Livraison Abidjan 24h | Paiement sécurisé Orange/MTN Money #TechCI",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
    thumbnailUrl: "https://images.unsplash.com/photo-1468495244123-6c6c332eeece?w=800&q=80",
    musicName: "Trending Tech Beat",
    ctaUrl: "#",
    ctaText: "Voir le prix",
    likes: 8900,
    comments: [
      { id: 1, user: { username: "jean_tech", photo: "https://i.pravatar.cc/150?img=4" }, text: "C'est combien ?", createdAt: "2026-02-09T14:20:00Z" },
      { id: 2, user: { username: "aya_ci", photo: "https://i.pravatar.cc/150?img=5" }, text: "Disponible en bleu ?", createdAt: "2026-02-09T15:30:00Z" },
    ],
    icon: <Smartphone className="w-5 h-5" />,
    gradient: "from-blue-500 to-purple-600",
    category: "Tech"
  },
  {
    id: 3,
    user: {
      username: "travel_ci",
      fullName: "Travel Côte d'Ivoire",
      photo: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&q=80",
      isVerified: true
    },
    title: "Assinie ce week-end ? 🏖️",
    description: "Pack tout compris à partir de 75 000 FCFA | Hôtel 4⭐ + Excursions + Repas #AssinieParadise",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
    thumbnailUrl: "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&q=80",
    musicName: "Summer Vibes",
    ctaUrl: "#",
    ctaText: "Réserver maintenant",
    likes: 15200,
    comments: [
      { id: 1, user: { username: "diane_voyage", photo: "https://i.pravatar.cc/150?img=6" }, text: "J'ai trop envie ! 🌊", createdAt: "2026-02-08T09:00:00Z" },
      { id: 2, user: { username: "karl_abj", photo: "https://i.pravatar.cc/150?img=7" }, text: "Y'a piscine ?", createdAt: "2026-02-08T10:45:00Z" },
      { id: 3, user: { username: "fatoumata_ci", photo: "https://i.pravatar.cc/150?img=8" }, text: "On peut payer en 2 fois ?", createdAt: "2026-02-08T11:30:00Z" },
    ],
    icon: <Plane className="w-5 h-5" />,
    gradient: "from-cyan-500 to-blue-600",
    category: "Voyage"
  },
];

// ============================================
// Avatar par défaut
// ============================================
const generateDefaultAvatar = (username = "U") => {
  const char = (username || "U").charAt(0).toUpperCase();
  const colors = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6'];
  const color = colors[char.charCodeAt(0) % colors.length];
  return `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="${encodeURIComponent(color)}"/><text x="50%" y="50%" font-size="50" fill="white" text-anchor="middle" dy=".3em" font-family="Arial">${char}</text></svg>`;
};

// ============================================
// COMPOSANT PRINCIPAL
// ============================================
const VideoAd = memo(({ 
  isActive = false,
}) => {
  const [ad, setAd] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  
  // États interactions
  const [localLikes, setLocalLikes] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [showHeart, setShowHeart] = useState(false);
  const [showCTA, setShowCTA] = useState(false);
  
  // États modales
  const [showComments, setShowComments] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [localComments, setLocalComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [isCommenting, setIsCommenting] = useState(false);
  
  const videoRef = useRef(null);
  const hasStarted = useRef(false);

  // ============================================
  // Initialisation
  // ============================================
  useEffect(() => {
    const randomAd = VIDEO_ADS[Math.floor(Math.random() * VIDEO_ADS.length)];
    setAd(randomAd);
    setLocalLikes(randomAd.likes);
    setLocalComments(randomAd.comments || []);
  }, []);

  // ============================================
  // Autoplay
  // ============================================
  useEffect(() => {
    if (!videoRef.current || !ad) return;

    if (isActive) {
      videoRef.current.play()
        .then(() => {
          setIsPlaying(true);
          hasStarted.current = true;
          setTimeout(() => setShowCTA(true), 3000);
        })
        .catch(err => console.log('Autoplay bloqué:', err));
    } else {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
      setIsPlaying(false);
      setProgress(0);
    }
  }, [isActive, ad]);

  // ============================================
  // Handlers
  // ============================================
  const handleTimeUpdate = () => {
    const vid = videoRef.current;
    if (vid && vid.duration) setProgress((vid.currentTime / vid.duration) * 100);
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleDoubleTap = (e) => {
    e.stopPropagation();
    if (!isLiked) {
      setShowHeart(true);
      setTimeout(() => setShowHeart(false), 800);
      handleLike(e);
    }
  };

  const handleLike = (e) => {
    e?.stopPropagation();
    setIsLiked(!isLiked);
    setLocalLikes(prev => isLiked ? prev - 1 : prev + 1);
    console.log('👍 Like pub:', ad.title);
  };

  const handleCommentSubmit = (e) => {
    e?.stopPropagation();
    if (!newComment.trim() || isCommenting) return;
    
    setIsCommenting(true);
    
    // Ajouter le commentaire localement
    const fakeComment = {
      id: Date.now(),
      user: {
        username: "user_" + Math.random().toString(36).substr(2, 9),
        photo: `https://i.pravatar.cc/150?img=${Math.floor(Math.random() * 70)}`
      },
      text: newComment,
      createdAt: new Date().toISOString()
    };
    
    setLocalComments(prev => [...prev, fakeComment]);
    setNewComment("");
    
    console.log('💬 Commentaire pub:', newComment);
    
    setTimeout(() => setIsCommenting(false), 500);
  };

  const handleShare = async (e) => {
    e.stopPropagation();
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: ad.title,
          text: ad.description,
          url: window.location.href
        });
        console.log('✅ Partage réussi');
      } catch (err) {
        console.log('❌ Partage annulé');
      }
    } else {
      // Fallback : copier le lien
      navigator.clipboard.writeText(window.location.href);
      alert('Lien copié dans le presse-papier !');
    }
    
    console.log('🔗 Partage pub:', ad.title);
  };

  const handleDownload = async (e) => {
    e.stopPropagation();
    
    try {
      // Télécharger la vidéo
      const response = await fetch(ad.videoUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${ad.user.username}_video.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      console.log('📥 Téléchargement pub:', ad.title);
      alert('Téléchargement démarré !');
    } catch (err) {
      console.error('Erreur téléchargement:', err);
      alert('Impossible de télécharger cette vidéo');
    }
  };

  const handleCTAClick = (e) => {
    e.stopPropagation();
    console.log('🎯 CTA cliqué:', ad.title);
    // window.open(ad.ctaUrl, '_blank');
  };

  if (!ad) return null;

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="relative w-full h-full bg-black overflow-hidden select-none">
      
      {/* Vidéo */}
      <video
        ref={videoRef}
        src={ad.videoUrl}
        poster={ad.thumbnailUrl}
        className="w-full h-full object-cover"
        loop
        playsInline
        muted={isMuted}
        onClick={togglePlay}
        onDoubleClick={handleDoubleTap}
        onTimeUpdate={handleTimeUpdate}
      />

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/80 pointer-events-none" />

      {/* Barre de progression */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gray-800/30 z-20">
        <motion.div 
          className="h-full bg-gradient-to-r from-orange-500 to-pink-500" 
          style={{ width: `${progress}%` }} 
        />
      </div>

      {/* Animation coeur */}
      <AnimatePresence>
        {showHeart && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1.5, opacity: 1 }}
            exit={{ scale: 2, opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
          >
            <Heart className="text-red-500 w-32 h-32 fill-current drop-shadow-2xl" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* INFOS UTILISATEUR (Bas Gauche) */}
      <div className="absolute bottom-4 left-4 right-16 z-30 pb-safe">
        
        <div className="flex items-center gap-3 mb-3 cursor-pointer group">
          <img 
            src={ad.user.photo || generateDefaultAvatar(ad.user.username)}
            alt={ad.user.username}
            className="w-11 h-11 rounded-full border-2 border-white shadow-md object-cover group-hover:scale-105 transition-transform bg-gray-700"
          />
          <div className="flex flex-col">
            <h3 className="font-bold text-white text-base flex items-center gap-1 shadow-black drop-shadow-md">
              @{ad.user.username}
              {ad.user.isVerified && <CheckCircle className="text-orange-500 w-4 h-4" />}
            </h3>
          </div>
          
          <button 
            onClick={(e) => {
              e.stopPropagation();
              console.log('Follow pub:', ad.user.username);
            }}
            className="text-xs font-bold px-3 py-1 rounded-full ml-2 shadow-lg bg-pink-600 text-white hover:bg-pink-700"
          >
            Suivre
          </button>
        </div>

        <div className="text-white/90 text-sm mb-2 max-w-[90%] drop-shadow-md pointer-events-auto">
          <p className="line-clamp-2">{ad.description}</p>
        </div>

        {/* CTA Subtil */}
        <AnimatePresence>
          {showCTA && (
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              onClick={handleCTAClick}
              className={`mt-2 inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r ${ad.gradient} text-white font-bold rounded-full shadow-lg text-sm hover:scale-105 transition-transform`}
            >
              {ad.ctaText}
              <ExternalLink className="w-4 h-4" />
            </motion.button>
          )}
        </AnimatePresence>

        {/* Musique */}
        <div className="flex items-center gap-2 text-white/80 text-xs font-medium bg-white/10 w-fit px-3 py-1 rounded-full backdrop-blur-sm mt-2">
          <span className="animate-pulse">🎵</span>
          <span className="truncate max-w-[150px]">{ad.musicName}</span>
        </div>
      </div>

      {/* ACTIONS (Droite) */}
      <div className="absolute right-2 bottom-20 flex flex-col items-center gap-6 z-40 pb-safe pointer-events-auto">
        
        {/* Like */}
        <div className="flex flex-col items-center gap-1">
          <motion.button 
            whileTap={{ scale: 0.8 }} 
            onClick={handleLike}
            className={`w-10 h-10 rounded-full flex items-center justify-center text-3xl drop-shadow-xl transition-colors ${
              isLiked ? 'text-red-500' : 'text-white'
            }`}
          >
            <Heart className={`w-7 h-7 ${isLiked ? 'fill-current' : ''}`} />
          </motion.button>
          <span className="text-xs font-bold text-white drop-shadow-md">{localLikes.toLocaleString()}</span>
        </div>

        {/* Commentaires */}
        <div className="flex flex-col items-center gap-1">
          <motion.button 
            whileTap={{ scale: 0.8 }} 
            onClick={(e) => { e.stopPropagation(); setShowComments(true); }}
            className="w-10 h-10 rounded-full flex items-center justify-center text-white text-3xl drop-shadow-xl"
          >
            <MessageCircle className="w-7 h-7" />
          </motion.button>
          <span className="text-xs font-bold text-white drop-shadow-md">{localComments.length}</span>
        </div>

        {/* Partage */}
        <div className="flex flex-col items-center gap-1">
          <motion.button 
            whileTap={{ scale: 0.8 }} 
            onClick={handleShare}
            className="w-10 h-10 rounded-full flex items-center justify-center text-white text-3xl drop-shadow-xl"
          >
            <Share2 className="w-7 h-7" />
          </motion.button>
          <span className="text-xs font-bold text-white drop-shadow-md text-[10px]">Partager</span>
        </div>

        {/* Volume */}
        <motion.button 
          whileTap={{ scale: 0.9 }} 
          onClick={(e) => { 
            e.stopPropagation(); 
            setIsMuted(!isMuted);
            if(videoRef.current) videoRef.current.muted = !isMuted;
          }}
          className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center text-white mt-2"
        >
          {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </motion.button>

        {/* Options */}
        <motion.button 
          whileTap={{ scale: 0.9 }} 
          onClick={(e) => { e.stopPropagation(); setShowOptions(true); }}
          className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center text-white"
        >
          <MoreVertical className="w-5 h-5" />
        </motion.button>
      </div>

      {/* MODAL COMMENTAIRES */}
      <AnimatePresence>
        {showComments && (
          <div 
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pointer-events-auto" 
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              className="absolute inset-0 bg-black/50 backdrop-blur-sm" 
              onClick={() => setShowComments(false)} 
            />
            
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="relative w-full max-w-md bg-gray-900 border-t border-gray-800 rounded-t-3xl h-[70vh] flex flex-col z-50 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-4 border-b border-gray-800 flex justify-between items-center">
                <span className="font-bold text-white">{localComments.length} Commentaires</span>
                <button 
                  onClick={() => setShowComments(false)} 
                  className="text-gray-400 p-2 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Liste commentaires */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {localComments.map((comment, i) => (
                  <div key={comment.id || i} className="flex gap-3 items-start">
                    <img 
                      src={comment.user?.photo || generateDefaultAvatar(comment.user?.username)} 
                      className="w-8 h-8 rounded-full bg-gray-700 object-cover" 
                      alt="user" 
                    />
                    <div>
                      <p className="text-xs font-bold text-gray-400">
                        {comment.user?.username || "Utilisateur"}
                      </p>
                      <p className="text-sm text-gray-200">{comment.text}</p>
                      <p className="text-xs text-gray-600 mt-1">
                        {new Date(comment.createdAt).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Input commentaire */}
              <div className="p-4 bg-gray-800 flex gap-2 items-center">
                <input 
                  value={newComment} 
                  onChange={(e) => setNewComment(e.target.value)} 
                  onKeyDown={(e) => e.key === 'Enter' && handleCommentSubmit(e)} 
                  placeholder="Votre commentaire..." 
                  className="flex-1 bg-gray-700 text-white rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-pink-500" 
                  disabled={isCommenting}
                />
                <button 
                  onClick={handleCommentSubmit} 
                  disabled={!newComment.trim() || isCommenting} 
                  className="p-2 bg-pink-600 rounded-full text-white disabled:opacity-50 hover:bg-pink-700"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL OPTIONS */}
      <AnimatePresence>
        {showOptions && (
          <div 
            className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" 
            onClick={(e) => { e.stopPropagation(); setShowOptions(false); }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-xs bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button 
                onClick={(e) => { e.stopPropagation(); handleDownload(e); setShowOptions(false); }}
                className="w-full flex items-center gap-3 px-6 py-4 hover:bg-gray-800 text-white transition-colors border-b border-gray-800"
              >
                <Download className="text-blue-500" />
                <span className="font-medium">Télécharger</span>
              </button>

              <button 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  navigator.clipboard.writeText(window.location.href);
                  alert("Lien copié !");
                  setShowOptions(false);
                }}
                className="w-full flex items-center gap-3 px-6 py-4 hover:bg-gray-800 text-white transition-colors border-b border-gray-800"
              >
                <Share2 className="text-green-500" />
                <span className="font-medium">Copier le lien</span>
              </button>

              <button 
                onClick={() => setShowOptions(false)}
                className="w-full px-6 py-4 text-gray-400 hover:text-white text-sm font-medium"
              >
                Annuler
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
});

VideoAd.displayName = 'VideoAd';

export default VideoAd;