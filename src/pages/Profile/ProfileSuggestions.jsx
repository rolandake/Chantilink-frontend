// ProfileSuggestions.jsx - VERSION FINALE COMPLÈTE CORRIGÉE
import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UserPlusIcon, XMarkIcon, SparklesIcon, ShieldCheckIcon, ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

// ============================================
// 🎨 COMPOSANT CARTE SUGGESTION (HORIZONTAL)
// ============================================

const SuggestionCard = React.forwardRef(({ 
  suggestion, 
  onFollow, 
  onDismiss, 
  isDarkMode, 
  isLoading 
}, ref) => {
  const [imageError, setImageError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  
  const getUserBadge = () => {
    if (suggestion.isPremium) return "Premium";
    if (suggestion.isVerified) return "Vérifié";
    if (suggestion.postsCount > 10) return "Actif";
    if (suggestion.followers?.length > 100) return "Populaire";
    return "Nouveau";
  };

  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, x: -100 }}
      transition={{ 
        type: "spring", 
        stiffness: 400, 
        damping: 30,
        layout: { duration: 0.3 }
      }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className={`relative flex-shrink-0 w-[180px] rounded-2xl transition-all duration-300 ${
        isDarkMode 
          ? 'bg-gray-900/40 hover:bg-gray-900/60 border border-white/5 hover:border-white/10' 
          : 'bg-white/90 hover:bg-white border border-gray-200/50 hover:border-orange-300 shadow-sm hover:shadow-md'
      }`}
    >
      {/* Bouton Dismiss - Au survol uniquement */}
      <AnimatePresence>
        {isHovered && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => onDismiss(suggestion._id)}
            className={`absolute -top-2 -right-2 p-1.5 rounded-full z-10 shadow-lg ${
              isDarkMode 
                ? 'bg-gray-800 hover:bg-gray-700 text-gray-300 border border-white/10' 
                : 'bg-white hover:bg-gray-50 text-gray-600 border border-gray-200'
            }`}
            whileHover={{ scale: 1.1, rotate: 90 }}
            whileTap={{ scale: 0.9 }}
          >
            <XMarkIcon className="w-3.5 h-3.5" />
          </motion.button>
        )}
      </AnimatePresence>

      <div className="p-4 flex flex-col items-center text-center">
        {/* Avatar avec contour premium */}
        <div className="relative mb-3">
          <motion.div
            className={`relative ${
              suggestion.isPremium 
                ? 'p-[2px] rounded-full bg-gradient-to-br from-orange-400 via-pink-500 to-purple-500' 
                : ''
            }`}
            whileHover={{ scale: 1.05 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
          >
            <motion.img
              src={imageError ? '/default-avatar.png' : (suggestion.profilePhoto || '/default-avatar.png')}
              alt={suggestion.fullName}
              onError={() => setImageError(true)}
              className={`w-16 h-16 rounded-full object-cover ${
                suggestion.isPremium 
                  ? `border-2 ${isDarkMode ? 'border-gray-900' : 'border-white'}` 
                  : 'border-2 border-orange-500/20'
              }`}
            />
          </motion.div>
          
          {/* Badge Premium/Vérifié */}
          {(suggestion.isPremium || suggestion.isVerified) && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, type: "spring", stiffness: 500 }}
              className={`absolute -bottom-1 -right-1 p-1 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 shadow-lg ring-2 ${
                isDarkMode ? 'ring-gray-900' : 'ring-white'
              }`}
            >
              {suggestion.isPremium ? (
                <SparklesIcon className="w-3 h-3 text-white" />
              ) : (
                <ShieldCheckIcon className="w-3 h-3 text-white" />
              )}
            </motion.div>
          )}
        </div>

        {/* Infos utilisateur */}
        <div className="w-full mb-3">
          {/* Nom extrabold */}
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <p className={`font-extrabold text-sm truncate max-w-full ${
              isDarkMode ? 'text-white' : 'text-gray-900'
            }`}>
              {suggestion.fullName || suggestion.username || 'Utilisateur'}
            </p>
            {suggestion.isVerified && (
              <ShieldCheckIcon className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
            )}
          </div>
          
          {/* Username gris */}
          <p className={`text-[11px] truncate mb-1.5 ${
            isDarkMode ? 'text-gray-500' : 'text-gray-500'
          }`}>
            @{suggestion.username || suggestion.email?.split('@')[0] || 'user'}
          </p>
          
          {/* Badge contexte */}
          <span className={`inline-block text-[9px] font-semibold px-2 py-0.5 rounded-full ${
            suggestion.isPremium 
              ? 'bg-gradient-to-r from-orange-500/20 to-pink-500/20 text-orange-400'
              : suggestion.isVerified
              ? 'bg-blue-500/10 text-blue-400'
              : isDarkMode
              ? 'bg-gray-800 text-gray-500'
              : 'bg-gray-100 text-gray-600'
          }`}>
            {getUserBadge()}
          </span>
        </div>

        {/* Stats - Une seule ligne */}
        <div className={`w-full text-[10px] mb-3 ${
          isDarkMode ? 'text-gray-500' : 'text-gray-500'
        }`}>
          <span className="font-medium">{suggestion.followers?.length || 0} abonnés</span>
        </div>

        {/* Bouton Follow */}
        <motion.button
          onClick={() => onFollow(suggestion._id)}
          disabled={isLoading}
          className={`w-full py-2 rounded-lg font-bold text-xs transition-all duration-200 flex items-center justify-center gap-1.5 ${
            isDarkMode
              ? 'bg-gradient-to-r from-orange-600 to-pink-600 hover:from-orange-700 hover:to-pink-700 text-white disabled:from-gray-700 disabled:to-gray-700'
              : 'bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white disabled:from-gray-300 disabled:to-gray-400'
          } disabled:cursor-not-allowed shadow-md hover:shadow-lg`}
          whileHover={{ scale: isLoading ? 1 : 1.02, y: isLoading ? 0 : -1 }}
          whileTap={{ scale: isLoading ? 1 : 0.98 }}
        >
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <UserPlusIcon className="w-4 h-4" />
              Suivre
            </>
          )}
        </motion.button>
      </div>
    </motion.div>
  );
});

SuggestionCard.displayName = 'SuggestionCard';

// ============================================
// 🔄 LOADING SKELETON
// ============================================

const LoadingCard = React.memo(({ isDarkMode }) => (
  <div className={`flex-shrink-0 w-[180px] rounded-2xl p-4 animate-pulse ${
    isDarkMode ? 'bg-gray-900/30' : 'bg-gray-100'
  }`}>
    <div className="flex flex-col items-center">
      <div className={`w-16 h-16 rounded-full mb-3 ${
        isDarkMode ? 'bg-gray-800' : 'bg-gray-200'
      }`} />
      <div className="w-full space-y-2 mb-3">
        <div className={`h-3.5 rounded mx-auto ${isDarkMode ? 'bg-gray-800' : 'bg-gray-200'}`} style={{ width: '70%' }} />
        <div className={`h-2.5 rounded mx-auto ${isDarkMode ? 'bg-gray-800' : 'bg-gray-200'}`} style={{ width: '50%' }} />
      </div>
      <div className={`w-full h-8 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-gray-200'}`} />
    </div>
  </div>
));

LoadingCard.displayName = 'LoadingCard';

// ============================================
// 📱 COMPOSANT PRINCIPAL
// ============================================

export default function ProfileSuggestions({ 
  currentUser, 
  token, 
  isDarkMode = false,
  maxSuggestions = 8,
  onFollowSuccess
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [followingIds, setFollowingIds] = useState(new Set());
  const [dismissedIds, setDismissedIds] = useState(new Set());
  const [error, setError] = useState(null);
  const [usingFallback, setUsingFallback] = useState(false);
  const [scrollPosition, setScrollPosition] = useState(0);
  const scrollContainerRef = React.useRef(null);

  // ============================================
  // 🎯 SCROLL HORIZONTAL
  // ============================================

  const scroll = (direction) => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const scrollAmount = 200;
    const newPosition = direction === 'left' 
      ? Math.max(0, scrollPosition - scrollAmount)
      : scrollPosition + scrollAmount;

    container.scrollTo({
      left: newPosition,
      behavior: 'smooth'
    });
    setScrollPosition(newPosition);
  };

  // ============================================
  // 🔄 FALLBACK: Cache local
  // ============================================

  const getSuggestionsFromCache = useCallback(() => {
    try {
      const cachedPosts = localStorage.getItem('allPostsCache');
      if (!cachedPosts) return [];

      const posts = JSON.parse(cachedPosts);
      if (!Array.isArray(posts) || posts.length === 0) return [];

      const usersMap = new Map();
      const currentUserId = currentUser?._id || currentUser?.id;
      const currentFollowing = new Set(
        (currentUser?.following || []).map(f => typeof f === 'object' ? f._id : f)
      );

      posts.forEach(post => {
        const postUser = post.user;
        if (!postUser) return;

        const userId = postUser._id || postUser.id;
        if (!userId || userId === currentUserId || currentFollowing.has(userId) || dismissedIds.has(userId)) {
          return;
        }

        if (!usersMap.has(userId)) {
          usersMap.set(userId, {
            _id: userId,
            fullName: postUser.fullName,
            username: postUser.username,
            email: postUser.email,
            profilePhoto: postUser.profilePhoto,
            bio: postUser.bio,
            followers: postUser.followers || [],
            following: postUser.following || [],
            isVerified: postUser.isVerified,
            isPremium: postUser.isPremium,
            postsCount: 1
          });
        } else {
          usersMap.get(userId).postsCount++;
        }
      });

      return Array.from(usersMap.values())
        .sort((a, b) => {
          if (a.isPremium && !b.isPremium) return -1;
          if (!a.isPremium && b.isPremium) return 1;
          if (a.isVerified && !b.isVerified) return -1;
          if (!a.isVerified && b.isVerified) return 1;
          if (a.postsCount !== b.postsCount) return b.postsCount - a.postsCount;
          return (b.followers?.length || 0) - (a.followers?.length || 0);
        })
        .slice(0, maxSuggestions);

    } catch (err) {
      console.error('❌ Erreur cache:', err);
      return [];
    }
  }, [currentUser, dismissedIds, maxSuggestions]);

  // ============================================
  // 🔄 FETCH SUGGESTIONS
  // ============================================

  const fetchSuggestions = useCallback(async () => {
    if (!currentUser?._id && !currentUser?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setUsingFallback(false);

    try {
      const userId = currentUser._id || currentUser.id;
      let response;
      let data;
      let success = false;
      
      const endpoints = [
        `${API_URL}/api/users/suggestions`,
        `${API_URL}/api/users`,
        `${API_URL}/users`
      ];

      for (const endpoint of endpoints) {
        try {
          response = await fetch(endpoint, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {})
            },
            credentials: 'include',
            signal: AbortSignal.timeout(5000)
          });
          
          if (response.ok) {
            data = await response.json();
            success = true;
            console.log('✅ Suggestions API response:', endpoint);
            break;
          }
        } catch (err) {
          continue;
        }
      }

      if (!success) {
        const cachedSuggestions = getSuggestionsFromCache();
        if (cachedSuggestions.length > 0) {
          setSuggestions(cachedSuggestions);
          setUsingFallback(true);
        }
        setLoading(false);
        return;
      }

      const allUsers = Array.isArray(data) 
        ? data 
        : (data.users || data.suggestions || data.data || []);
      
      if (!Array.isArray(allUsers) || allUsers.length === 0) {
        const cachedSuggestions = getSuggestionsFromCache();
        if (cachedSuggestions.length > 0) {
          setSuggestions(cachedSuggestions);
          setUsingFallback(true);
        }
        setLoading(false);
        return;
      }

      // ✅ FILTRAGE RENFORCÉ: Exclure following + dismissed + followingIds
      const currentFollowing = new Set(
        (currentUser.following || []).map(f => typeof f === 'object' ? f._id : f)
      );

      const filtered = allUsers
        .filter(u => {
          const uid = u._id || u.id;
          // ✅ Triple vérification pour éviter les doublons
          return uid !== userId 
            && !currentFollowing.has(uid) 
            && !dismissedIds.has(uid)
            && !followingIds.has(uid); // ✅ CRITIQUE
        })
        .sort((a, b) => {
          if (a.isPremium && !b.isPremium) return -1;
          if (!a.isPremium && b.isPremium) return 1;
          if (a.isVerified && !b.isVerified) return -1;
          if (!a.isVerified && b.isVerified) return 1;
          return (b.followers?.length || 0) - (a.followers?.length || 0);
        })
        .slice(0, maxSuggestions);

      console.log(`📊 Suggestions filtrées: ${filtered.length} (following: ${currentFollowing.size}, dismissed: ${dismissedIds.size}, following en cours: ${followingIds.size})`);
      setSuggestions(filtered);

    } catch (err) {
      const cachedSuggestions = getSuggestionsFromCache();
      if (cachedSuggestions.length > 0) {
        setSuggestions(cachedSuggestions);
        setUsingFallback(true);
      } else {
        setError(err.message || 'Erreur de chargement');
      }
    } finally {
      setLoading(false);
    }
  }, [currentUser, token, dismissedIds, followingIds, maxSuggestions, getSuggestionsFromCache]);

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  // ============================================
  // 🎯 ACTIONS
  // ============================================

  const handleFollow = useCallback(async (userId) => {
    if (!token || followingIds.has(userId)) return;

    setFollowingIds(prev => new Set(prev).add(userId));

    try {
      // ✅ Utiliser la nouvelle route unifiée /:id/follow
      const response = await fetch(`${API_URL}/api/users/${userId}/follow`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erreur lors du suivi');
      }

      const data = await response.json();
      console.log('✅ Follow réussi:', data);

      // ✅ Retirer immédiatement de la liste
      setSuggestions(prev => prev.filter(s => (s._id || s.id) !== userId));
      
      // ✅ Ajouter à dismissedIds pour ne jamais revenir
      setDismissedIds(prev => new Set(prev).add(userId));
      
      // ✅ Notifier le parent
      onFollowSuccess?.(userId);
      
    } catch (err) {
      console.error('❌ Erreur follow:', err);
      setFollowingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    }
  }, [token, followingIds, onFollowSuccess]);

  const handleDismiss = useCallback((userId) => {
    setDismissedIds(prev => new Set(prev).add(userId));
    setSuggestions(prev => prev.filter(s => (s._id || s.id) !== userId));
  }, []);

  // ============================================
  // 🎨 RENDU
  // ============================================

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-3xl p-5 shadow-xl border ${
          isDarkMode 
            ? 'bg-gray-900/50 backdrop-blur-xl border-white/5' 
            : 'bg-white/80 backdrop-blur-md border-gray-200/50'
        }`}
      >
        <h3 className={`text-lg font-extrabold mb-4 flex items-center gap-2 ${
          isDarkMode ? 'text-white' : 'text-gray-900'
        }`}>
          <SparklesIcon className="w-5 h-5 text-orange-500" />
          Suggestions pour vous
        </h3>
        <div className="flex gap-3 overflow-hidden">
          {[1, 2, 3, 4].map(i => <LoadingCard key={i} isDarkMode={isDarkMode} />)}
        </div>
      </motion.div>
    );
  }

  if (suggestions.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-3xl p-6 shadow-xl border ${
          isDarkMode 
            ? 'bg-gray-900/50 backdrop-blur-xl border-white/5' 
            : 'bg-white/80 backdrop-blur-md border-gray-200/50'
        }`}
      >
        <h3 className={`text-lg font-extrabold mb-4 flex items-center gap-2 ${
          isDarkMode ? 'text-white' : 'text-gray-900'
        }`}>
          <SparklesIcon className="w-5 h-5 text-orange-500" />
          Suggestions pour vous
        </h3>
        <div className={`text-center py-8 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
          <SparklesIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">Aucune suggestion</p>
          <p className="text-xs mt-1 opacity-70">Revenez plus tard !</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-3xl p-5 shadow-xl border transition-all duration-200 ${
        isDarkMode 
          ? 'bg-gray-900/50 backdrop-blur-xl border-white/5' 
          : 'bg-white/80 backdrop-blur-md border-gray-200/50'
      }`}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className={`text-lg font-extrabold flex items-center gap-2 ${
          isDarkMode ? 'text-white' : 'text-gray-900'
        }`}>
          <SparklesIcon className="w-5 h-5 text-orange-500" />
          Suggestions pour vous
        </h3>
        <div className="flex items-center gap-2">
          {usingFallback && (
            <span className={`text-[9px] font-medium px-2 py-1 rounded-full ${
              isDarkMode ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600'
            }`}>
              💡 Basées sur votre activité
            </span>
          )}
          <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
            isDarkMode ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-600'
          }`}>
            {suggestions.length}
          </span>
        </div>
      </div>

      {/* Scroll horizontal avec boutons */}
      <div className="relative">
        {scrollPosition > 0 && (
          <motion.button
            onClick={() => scroll('left')}
            className={`absolute left-0 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full shadow-lg ${
              isDarkMode 
                ? 'bg-gray-800 hover:bg-gray-700 text-white' 
                : 'bg-white hover:bg-gray-50 text-gray-900'
            }`}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <ChevronLeftIcon className="w-5 h-5" />
          </motion.button>
        )}

        <div 
          ref={scrollContainerRef}
          className="flex gap-3 overflow-x-auto scrollbar-hide scroll-smooth pb-2"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <AnimatePresence mode="popLayout">
            {suggestions.map(suggestion => (
              <SuggestionCard
                key={suggestion._id || suggestion.id}
                suggestion={suggestion}
                onFollow={handleFollow}
                onDismiss={handleDismiss}
                isDarkMode={isDarkMode}
                isLoading={followingIds.has(suggestion._id || suggestion.id)}
              />
            ))}
          </AnimatePresence>
        </div>

        {suggestions.length > 4 && (
          <motion.button
            onClick={() => scroll('right')}
            className={`absolute right-0 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full shadow-lg ${
              isDarkMode 
                ? 'bg-gray-800 hover:bg-gray-700 text-white' 
                : 'bg-white hover:bg-gray-50 text-gray-900'
            }`}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <ChevronRightIcon className="w-5 h-5" />
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}