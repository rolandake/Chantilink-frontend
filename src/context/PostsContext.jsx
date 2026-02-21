// src/context/PostsContext.jsx
// ✅ OPTIMISÉ LCP :
// - Cache IDB affiché IMMÉDIATEMENT avec setLoading(false) → évite skeleton qui bloque le LCP
// - fetchPosts retourne { success, posts } pour le polling Home
// - fetchUserPosts isolé du feed global (ne touche plus posts[])
// - Batch user loading côté backend (inchangé)

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useAuth } from "./AuthContext";
import { idbGetPosts, idbSetPosts } from "../utils/idbMigration";
import { syncNewPost, syncDeletePost, syncUpdatePost } from "../utils/cacheSync";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const PostsContext = createContext();
export const usePosts = () => useContext(PostsContext);

export const PostsProvider = ({ children }) => {
  const { user, token } = useAuth();

  const [posts,   setPosts]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const [page,    setPage]    = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const isLoadingRef    = useRef(false);
  const initialLoadDone = useRef(false);
  const abortController = useRef(null);

  const userId = user?._id || user?.id;

  // ============================================
  // NORMALISATION
  // ============================================
  const normalizePost = useCallback((p) => {
    const rawUser = p.user || p.author || {};
    const normalizedUser = {
      ...rawUser,
      _id:          rawUser._id || rawUser.id || p.userId || p.author?._id || "unknown",
      fullName:
        rawUser.fullName    ||
        rawUser.name        ||
        rawUser.username    ||
        rawUser.displayName ||
        p.author?.fullName  ||
        p.author?.name      ||
        p.fullName          ||
        p.userName          ||
        "",
      profilePhoto:
        rawUser.profilePhoto   ||
        rawUser.profilePicture ||
        rawUser.avatar         ||
        rawUser.photo          ||
        p.userProfilePhoto     ||
        null,
      isVerified: !!(rawUser.isVerified || rawUser.verified || p.isVerified),
      isPremium:  !!(rawUser.isPremium  || p.isPremium),
    };

    return {
      ...p,
      _id:      p._id || p.id,
      user:     normalizedUser,
      likes:    Array.isArray(p.likes)    ? p.likes    : [],
      comments: Array.isArray(p.comments) ? p.comments : [],
      views:    Array.isArray(p.views)    ? p.views    : [],
      shares:   Array.isArray(p.shares)   ? p.shares   : [],
    };
  }, []);

  // ============================================
  // FETCH FEED GLOBAL (Home)
  // ============================================
  const fetchPosts = useCallback(async (pageNumber = 1, append = false) => {
    if (!token) {
      console.warn("⚠️ [PostsContext] fetchPosts bloqué : pas de token");
      return { success: false, posts: [] };
    }
    if (isLoadingRef.current) {
      console.warn("⚠️ [PostsContext] fetchPosts bloqué : déjà en cours");
      return { success: false, posts: [] };
    }

    console.log(`📡 [PostsContext] fetchPosts page=${pageNumber} append=${append}`);
    isLoadingRef.current = true;

    // ✅ NE PAS setLoading(true) si on a déjà des posts (cache hit)
    // → évite de réafficher le skeleton alors qu'on a déjà du contenu visible
    if (!append) {
      setPosts(prev => {
        if (prev.length === 0) setLoading(true);
        return prev;
      });
    }

    setError(null);

    abortController.current?.abort();
    abortController.current = new AbortController();

    try {
      const res = await fetch(`${API_URL}/posts?page=${pageNumber}&limit=20`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: abortController.current.signal,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data       = await res.json();
      const postsArray = data.data || data.posts || data || [];
      const normalized = postsArray.map(normalizePost);
      console.log(`✅ [PostsContext] ${normalized.length} posts reçus`);

      setPosts(prev => {
        const merged = append ? [...prev, ...normalized] : normalized;
        const unique  = Array.from(new Map(merged.map(p => [p._id, p])).values());
        idbSetPosts("allPosts", unique);
        return unique;
      });

      setHasMore(data.hasMore ?? normalized.length === 20);
      setPage(pageNumber);

      return { success: true, posts: normalized };
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error("❌ [PostsContext] fetchPosts erreur:", err.message);
        setError(err.message);
        setHasMore(false);
      }
      return { success: false, posts: [], error: err.message };
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  }, [token, normalizePost]);

  // ============================================
  // FETCH NEXT PAGE
  // ============================================
  const fetchNextPage = useCallback(() => {
    if (!hasMore || isLoadingRef.current || loading) return;
    return fetchPosts(page + 1, true);
  }, [hasMore, loading, page, fetchPosts]);

  // ============================================
  // FETCH USER POSTS (Profil) — ISOLÉ du feed global
  // ✅ Ne modifie plus `posts` (le feed Home)
  // ============================================
  const fetchUserPosts = useCallback(async (targetUserId, pageNumber = 1) => {
    if (!token || !targetUserId) return [];

    try {
      const res = await fetch(
        `${API_URL}/posts/user/${targetUserId}?page=${pageNumber}&limit=20`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data       = await res.json();
      const postsArray = data.data || data.posts || data || [];
      return postsArray.map(normalizePost);
    } catch (err) {
      console.error("❌ Erreur chargement posts utilisateur:", err.message);
      try {
        const { getCachedPosts } = await import('../utils/cacheSync');
        return (await getCachedPosts(targetUserId)) || [];
      } catch {
        return [];
      }
    }
  }, [token, normalizePost]);

  // ============================================
  // CREATE POST
  // ============================================
  const createPost = useCallback(async (formData) => {
    if (!token) throw new Error("Connexion requise");

    const res = await fetch(`${API_URL}/posts`, {
      method:  "POST",
      headers: { Authorization: `Bearer ${token}` },
      body:    formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || err.error || "Erreur serveur");
    }

    const data    = await res.json();
    const newPost = data.data || data;
    if (!newPost?._id) throw new Error("Post invalide");

    const normalized = normalizePost(newPost);
    await syncNewPost(normalized, userId);
    setPosts(prev => [normalized, ...prev]);
    return normalized;
  }, [token, userId, normalizePost]);

  // ============================================
  // DELETE POST
  // ============================================
  const deletePost = useCallback(async (postId) => {
    if (!token) return false;
    try {
      const res = await fetch(`${API_URL}/posts/${postId}`, {
        method:  "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Suppression échouée");
      await syncDeletePost(postId, userId);
      setPosts(prev => prev.filter(p => p._id !== postId));
      return true;
    } catch (err) {
      console.error("❌ Échec suppression:", err.message);
      return false;
    }
  }, [token, userId]);

  // ============================================
  // REMOVE POST (local uniquement)
  // ============================================
  const removePost = useCallback((postId) => {
    setPosts(prev => prev.filter(p => p._id !== postId));
  }, []);

  // ============================================
  // UPDATE POST
  // ============================================
  const updatePost = useCallback(async (updatedPost) => {
    const normalized = normalizePost(updatedPost);
    await syncUpdatePost(normalized, normalized.user?._id || normalized.user);
    setPosts(prev => prev.map(p => p._id === normalized._id ? normalized : p));
  }, [normalizePost]);

  // ============================================
  // TOGGLE LIKE
  // ============================================
  const toggleLike = useCallback(async (postId) => {
    if (!token || !userId) return false;

    const optimisticUpdate = () => {
      setPosts(prev => prev.map(p => {
        if (p._id !== postId) return p;
        const likes = [...p.likes];
        const idx   = likes.indexOf(userId);
        idx > -1 ? likes.splice(idx, 1) : likes.push(userId);
        return { ...p, likes };
      }));
    };

    optimisticUpdate();

    try {
      const res = await fetch(`${API_URL}/posts/${postId}/like`, {
        method:  "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Like échoué");
      const data    = await res.json();
      const updated = normalizePost(data.data || data);
      await syncUpdatePost(updated, updated.user?._id || updated.user);
      setPosts(prev => prev.map(p => p._id === postId ? updated : p));
      return true;
    } catch (err) {
      console.error("❌ Échec like:", err.message);
      optimisticUpdate(); // rollback
      return false;
    }
  }, [token, userId, normalizePost]);

  // ============================================
  // ADD COMMENT
  // ============================================
  const addComment = useCallback(async (postId, content) => {
    if (!content?.trim() || !token) return false;
    try {
      const res = await fetch(`${API_URL}/posts/${postId}/comment`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error("Commentaire échoué");
      const data    = await res.json();
      const comment = data.data || data;
      setPosts(prev => prev.map(p => {
        if (p._id !== postId) return p;
        return { ...p, comments: [...p.comments, comment] };
      }));
      return true;
    } catch (err) {
      console.error("❌ Échec commentaire:", err.message);
      return false;
    }
  }, [token]);

  // ============================================
  // ✅ INITIAL LOAD — cache IMMÉDIAT puis API en arrière-plan
  //
  // Stratégie "cache-first" :
  // 1. On lit le cache IDB de façon synchrone (quelques ms)
  // 2. On affiche les posts IMMÉDIATEMENT avec setLoading(false)
  //    → React peut rendre le feed, les images peuvent commencer à charger
  //    → Resource load delay passe de 5s à ~200ms
  // 3. On fetch l'API en arrière-plan pour mettre à jour silencieusement
  // ============================================
  useEffect(() => {
    if (!token) return;

    initialLoadDone.current = false;

    const init = async () => {
      if (initialLoadDone.current) return;
      initialLoadDone.current = true;

      try {
        // ✅ Étape 1 : cache IDB IMMÉDIAT
        const cached = await idbGetPosts("allPosts");
        if (cached?.length) {
          setPosts(cached);
          setLoading(false); // ← CRITIQUE : stoppe le skeleton, feed visible immédiatement
          console.log(`⚡ [PostsContext] Cache hit : ${cached.length} posts affichés`);
        }

        // ✅ Étape 2 : API en arrière-plan (ne bloque pas le LCP)
        if (navigator.onLine) {
          await fetchPosts(1, false);
        }
      } catch (err) {
        console.error("❌ Erreur initialisation posts:", err.message);
        setLoading(false);
      }
    };

    init();
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  // ============================================
  // CLEANUP
  // ============================================
  useEffect(() => {
    return () => { abortController.current?.abort(); };
  }, []);

  const refetch = useCallback(async () => {
    const result = await fetchPosts(1, false);
    return result; // { success, posts } — utilisé par le polling du Home
  }, [fetchPosts]);

  // ============================================
  // CONTEXT VALUE
  // ============================================
  const value = useMemo(() => ({
    posts,
    loading,
    error,
    hasMore,
    page,
    fetchPosts,
    fetchNextPage,
    fetchUserPosts,
    createPost,
    deletePost,
    removePost,
    updatePost,
    toggleLike,
    addComment,
    refetch,
  }), [
    posts, loading, error, hasMore, page,
    fetchPosts, fetchNextPage, fetchUserPosts,
    createPost, deletePost, removePost, updatePost,
    toggleLike, addComment, refetch,
  ]);

  return <PostsContext.Provider value={value}>{children}</PostsContext.Provider>;
};