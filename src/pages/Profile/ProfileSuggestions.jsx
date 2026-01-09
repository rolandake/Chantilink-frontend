// ProfileSuggestions.jsx - VERSION AVEC FALLBACK INTELLIGENT
import React, { useState, useEffect, useCallback, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UserPlusIcon, XMarkIcon, SparklesIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

// ============================================
// 🎨 COMPOSANTS MÉMORISÉS
// ============================================

const SuggestionCard = memo(({ 
  suggestion, 
  onFollow, 
  onDismiss, 
  isDarkMode, 
  isLoading 
}) => {
  const [imageError, setImageError] = useState(false);
  
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, x: -100 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className={`relative group rounded-2xl p-4 transition-all duration-200 ${
        isDarkMode 
          ? 'bg-gray-800/50 hover:bg-gray-800/70 border border-white/5 hover:border-white/10' 
          : 'bg-white hover:bg-gray-50 border border-gray-200 hover:border-orange-200 shadow-sm hover:shadow-md'
      }`}
    >
      {/* Bouton Dismiss */}
      <motion.button
        onClick={() => onDismiss(suggestion._id)}
        className={`absolute top-2 right-2 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all ${
          isDarkMode 
            ? 'bg-gray-700/50 hover:bg-gray-600 text-gray-300' 
            : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
        }`}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
      >
        <XMarkIcon className="w-4 h-4" />
      </motion.button>

      <div className="flex items-center gap-3 mb-3">
        {/* Avatar */}
        <div className="relative">
          <motion.img
            src={imageError ? '/default-avatar.png' : (suggestion.profilePhoto || '/default-avatar.png')}
            alt={suggestion.fullName}
            onError={() => setImageError(true)}
            className="w-14 h-14 rounded-2xl object-cover border-2 border-orange-500/30"
            whileHover={{ scale: 1.05 }}
          />
          {(suggestion.isPremium || suggestion.isVerified) && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -bottom-1 -right-1 p-1 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 shadow-lg"
            >
              {suggestion.isPremium ? (
                <SparklesIcon className="w-3.5 h-3.5 text-white" />
              ) : (
                <ShieldCheckIcon className="w-3.5 h-3.5 text-white" />
              )}
            </motion.div>
          )}
        </div>

        {/* Infos */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className={`font-semibold truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              {suggestion.fullName || suggestion.username || 'Utilisateur'}
            </p>
            {suggestion.isVerified && <ShieldCheckIcon className="w-4 h-4 text-blue-500 flex-shrink-0" />}
          </div>
          <p className={`text-sm truncate ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            @{suggestion.username || suggestion.email?.split('@')[0] || 'user'}
          </p>
          
          {/* Stats rapides */}
          <div className={`flex items-center gap-3 mt-1 text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
            <span>{suggestion.followers?.length || 0} abonnés</span>
            {suggestion.postsCount !== undefined && (
              <>
                <span>•</span>
                <span>{suggestion.postsCount} posts</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Bio */}
      {suggestion.bio && (
        <p className={`text-sm mb-3 line-clamp-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
          {suggestion.bio}
        </p>
      )}

      {/* Bouton Follow */}
      <motion.button
        onClick={() => onFollow(suggestion._id)}
        disabled={isLoading}
        className={`w-full py-2.5 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
          isDarkMode
            ? 'bg-orange-600 hover:bg-orange-700 text-white disabled:bg-gray-700'
            : 'bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white disabled:from-gray-300 disabled:to-gray-400'
        } disabled:cursor-not-allowed active:scale-95 shadow-md hover:shadow-lg`}
        whileHover={{ scale: isLoading ? 1 : 1.02 }}
        whileTap={{ scale: isLoading ? 1 : 0.98 }}
      >
        {isLoading ? (
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <>
            <UserPlusIcon className="w-5 h-5" />
            Suivre
          </>
        )}
      </motion.button>
    </motion.div>
  );
});

const LoadingCard = memo(({ isDarkMode }) => (
  <div className={`rounded-2xl p-4 animate-pulse ${isDarkMode ? 'bg-gray-800/30' : 'bg-gray-100'}`}>
    <div className="flex items-center gap-3 mb-3">
      <div className={`w-14 h-14 rounded-2xl ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`} />
      <div className="flex-1">
        <div className={`h-4 rounded mb-2 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`} style={{ width: '60%' }} />
        <div className={`h-3 rounded ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`} style={{ width: '40%' }} />
      </div>
    </div>
    <div className={`h-10 rounded-xl ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`} />
  </div>
));

// ============================================
// 📱 COMPOSANT PRINCIPAL
// ============================================

export default function ProfileSuggestions({ 
  currentUser, 
  token, 
  isDarkMode = false,
  maxSuggestions = 5,
  onFollowSuccess
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [followingIds, setFollowingIds] = useState(new Set());
  const [dismissedIds, setDismissedIds] = useState(new Set());
  const [error, setError] = useState(null);
  const [usingFallback, setUsingFallback] = useState(false);

  // ============================================
  // 🔄 FALLBACK: Extraire users depuis posts en cache
  // ============================================

  const getSuggestionsFromCache = useCallback(() => {
    try {
      console.log('🔍 Récupération suggestions depuis cache...');
      
      // ✅ Récupérer les posts du cache global
      const cachedPosts = localStorage.getItem('allPostsCache');
      if (!cachedPosts) {
        console.log('📭 Aucun cache disponible');
        return [];
      }

      const posts = JSON.parse(cachedPosts);
      if (!Array.isArray(posts) || posts.length === 0) {
        console.log('📭 Cache vide');
        return [];
      }

      console.log(`📦 ${posts.length} posts dans le cache`);

      // ✅ Extraire les utilisateurs uniques
      const usersMap = new Map();
      const currentUserId = currentUser?._id || currentUser?.id;
      const currentFollowing = new Set(
        (currentUser?.following || []).map(f => typeof f === 'object' ? f._id : f)
      );

      posts.forEach(post => {
        const postUser = post.user;
        if (!postUser) return;

        const userId = postUser._id || postUser.id;
        if (!userId) return;

        // ✅ Filtrer
        if (
          userId === currentUserId || // Pas soi-même
          currentFollowing.has(userId) || // Pas déjà suivi
          dismissedIds.has(userId) // Pas dismissed
        ) return;

        // ✅ Compter les posts par utilisateur
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

      // ✅ Convertir en array et trier
      const users = Array.from(usersMap.values())
        .sort((a, b) => {
          // Prioriser premium/vérifiés
          if (a.isPremium && !b.isPremium) return -1;
          if (!a.isPremium && b.isPremium) return 1;
          if (a.isVerified && !b.isVerified) return -1;
          if (!a.isVerified && b.isVerified) return 1;
          
          // Puis par nombre de posts (activité)
          if (a.postsCount !== b.postsCount) {
            return b.postsCount - a.postsCount;
          }
          
          // Puis par followers
          return (b.followers?.length || 0) - (a.followers?.length || 0);
        })
        .slice(0, maxSuggestions);

      console.log(`✅ ${users.length} suggestions extraites du cache`);
      return users;

    } catch (err) {
      console.error('❌ Erreur extraction cache:', err);
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
      
      // ✅ ESSAI 1: /api/users/suggestions
      try {
        response = await fetch(`${API_URL}/api/users/suggestions`, {
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
          console.log('✅ Suggestions depuis /api/users/suggestions');
          success = true;
        }
      } catch (err) {
        console.log('⚠️ /api/users/suggestions non disponible');
      }

      // ✅ ESSAI 2: /api/users
      if (!success) {
        try {
          response = await fetch(`${API_URL}/api/users`, {
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
            console.log('✅ Suggestions depuis /api/users');
            success = true;
          }
        } catch (err) {
          console.log('⚠️ /api/users non disponible');
        }
      }

      // ✅ ESSAI 3: /users
      if (!success) {
        try {
          response = await fetch(`${API_URL}/users`, {
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
            console.log('✅ Suggestions depuis /users');
            success = true;
          }
        } catch (err) {
          console.log('⚠️ /users non disponible');
        }
      }

      // ✅ FALLBACK: Utiliser le cache
      if (!success) {
        console.log('🔄 Utilisation du fallback (cache)');
        const cachedSuggestions = getSuggestionsFromCache();
        
        if (cachedSuggestions.length > 0) {
          setSuggestions(cachedSuggestions);
          setUsingFallback(true);
          setLoading(false);
          return;
        }
        
        throw new Error('Aucune source de données disponible');
      }

      // ✅ Traiter les données API
      const allUsers = Array.isArray(data) 
        ? data 
        : (data.users || data.suggestions || data.data || []);
      
      if (!Array.isArray(allUsers) || allUsers.length === 0) {
        // Fallback si API vide
        const cachedSuggestions = getSuggestionsFromCache();
        if (cachedSuggestions.length > 0) {
          setSuggestions(cachedSuggestions);
          setUsingFallback(true);
        }
        setLoading(false);
        return;
      }

      console.log(`✅ ${allUsers.length} utilisateurs récupérés`);
      
      // ✅ Filtrer
      const currentFollowing = new Set(
        (currentUser.following || []).map(f => typeof f === 'object' ? f._id : f)
      );

      const filtered = allUsers
        .filter(u => {
          const uid = u._id || u.id;
          return (
            uid !== userId &&
            !currentFollowing.has(uid) &&
            !dismissedIds.has(uid)
          );
        })
        .sort((a, b) => {
          if (a.isPremium && !b.isPremium) return -1;
          if (!a.isPremium && b.isPremium) return 1;
          if (a.isVerified && !b.isVerified) return -1;
          if (!a.isVerified && b.isVerified) return 1;
          
          const aFollowers = a.followers?.length || 0;
          const bFollowers = b.followers?.length || 0;
          return bFollowers - aFollowers;
        })
        .slice(0, maxSuggestions);

      console.log(`✅ ${filtered.length} suggestions filtrées`);
      setSuggestions(filtered);

    } catch (err) {
      console.error('❌ Erreur fetch suggestions:', err);
      
      // ✅ Dernier fallback
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
  }, [currentUser, token, dismissedIds, maxSuggestions, getSuggestionsFromCache]);

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
      let response;
      
      // Essai 1: /api/users/:id/follow
      try {
        response = await fetch(`${API_URL}/api/users/${userId}/follow`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          credentials: 'include'
        });
        
        if (!response.ok) throw new Error();
      } catch {
        // Essai 2: /users/:id/follow
        response = await fetch(`${API_URL}/users/${userId}/follow`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          credentials: 'include'
        });
      }

      if (!response.ok) throw new Error('Erreur lors du suivi');

      // ✅ Retirer de la liste
      setSuggestions(prev => prev.filter(s => (s._id || s.id) !== userId));
      
      // ✅ Callback
      onFollowSuccess?.(userId);
      
      console.log(`✅ Utilisateur ${userId} suivi`);
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
      <motion.aside
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-3xl p-6 shadow-xl border ${
          isDarkMode 
            ? 'bg-gray-900/50 backdrop-blur-xl border-white/5' 
            : 'bg-white/70 backdrop-blur-md border-orange-200/30'
        }`}
      >
        <h3 className={`text-lg font-bold mb-4 flex items-center gap-2 ${
          isDarkMode ? 'text-white' : 'text-gray-900'
        }`}>
          <SparklesIcon className="w-5 h-5 text-orange-500" />
          Suggestions
        </h3>
        <div className="space-y-3">
          {[1, 2, 3].map(i => <LoadingCard key={i} isDarkMode={isDarkMode} />)}
        </div>
      </motion.aside>
    );
  }

  if (error && suggestions.length === 0) {
    return (
      <motion.aside
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-3xl p-6 shadow-xl border ${
          isDarkMode 
            ? 'bg-gray-900/50 backdrop-blur-xl border-white/5' 
            : 'bg-white/70 backdrop-blur-md border-orange-200/30'
        }`}
      >
        <h3 className={`text-lg font-bold mb-4 flex items-center gap-2 ${
          isDarkMode ? 'text-white' : 'text-gray-900'
        }`}>
          <SparklesIcon className="w-5 h-5 text-orange-500" />
          Suggestions
        </h3>
        <div className={`text-center py-8 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
          <p className="text-sm mb-2">Aucune suggestion disponible</p>
          <p className="text-xs mb-4 opacity-70">Les suggestions apparaîtront bientôt</p>
        </div>
      </motion.aside>
    );
  }

  if (suggestions.length === 0) {
    return (
      <motion.aside
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-3xl p-6 shadow-xl border ${
          isDarkMode 
            ? 'bg-gray-900/50 backdrop-blur-xl border-white/5' 
            : 'bg-white/70 backdrop-blur-md border-orange-200/30'
        }`}
      >
        <h3 className={`text-lg font-bold mb-4 flex items-center gap-2 ${
          isDarkMode ? 'text-white' : 'text-gray-900'
        }`}>
          <SparklesIcon className="w-5 h-5 text-orange-500" />
          Suggestions
        </h3>
        <div className={`text-center py-8 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
          <SparklesIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Aucune suggestion pour le moment</p>
          <p className="text-xs mt-1">Revenez plus tard !</p>
        </div>
      </motion.aside>
    );
  }

  return (
    <motion.aside
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-3xl p-6 shadow-xl border transition-all duration-200 ${
        isDarkMode 
          ? 'bg-gray-900/50 backdrop-blur-xl border-white/5' 
          : 'bg-white/70 backdrop-blur-md border-orange-200/30'
      }`}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className={`text-lg font-bold flex items-center gap-2 ${
          isDarkMode ? 'text-white' : 'text-gray-900'
        }`}>
          <SparklesIcon className="w-5 h-5 text-orange-500" />
          Suggestions
        </h3>
        <span className={`text-xs font-normal ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
          {suggestions.length}
        </span>
      </div>

      {usingFallback && (
        <div className={`mb-3 px-3 py-2 rounded-lg text-xs ${
          isDarkMode ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600'
        }`}>
          💡 Suggestions basées sur votre activité
        </div>
      )}

      <AnimatePresence mode="popLayout">
        <div className="space-y-3">
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
        </div>
      </AnimatePresence>

      {suggestions.length > 0 && (
        <motion.button
          onClick={fetchSuggestions}
          className={`w-full mt-4 py-2.5 rounded-xl font-medium transition-all ${
            isDarkMode
              ? 'bg-gray-800 hover:bg-gray-700 text-gray-300'
              : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
          }`}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          Actualiser
        </motion.button>
      )}
    </motion.aside>
  );
}