// src/context/PostsContext.jsx - OPTIMISÉ, SILENCIEUX, ROBUSTE, PERFORMANT (CORRIGÉ)
import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useAuth } from "./AuthContext";
import { idbGetPosts, idbSetPosts } from "../utils/idbMigration";
import { syncNewPost, syncDeletePost, syncUpdatePost, syncUserPosts } from "../utils/cacheSync";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const PostsContext = createContext();
export const usePosts = () => useContext(PostsContext);

export const PostsProvider = ({ children }) => {
  const { user, token } = useAuth();

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const isLoadingRef = useRef(false);
  const initialLoadDone = useRef(false);
  const abortController = useRef(null);

  const userId = user?._id || user?.id;

  // === NORMALISATION ===
  const normalizePost = useCallback((p) => ({
    ...p,
    _id: p._id || p.id,
    user: p.user || p.author || { _id: p.userId },
    likes: Array.isArray(p.likes) ? p.likes : [],
    comments: Array.isArray(p.comments) ? p.comments : [],
    views: Array.isArray(p.views) ? p.views : [],
    shares: Array.isArray(p.shares) ? p.shares : [],
  }), []);

  // === FETCH POSTS (global) ===
  const fetchPosts = useCallback(async (pageNumber = 1, append = false) => {
    if (!token || isLoadingRef.current) return { success: false, posts: [] };

    isLoadingRef.current = true;
    setLoading(true);
    setError(null);

    abortController.current?.abort();
    abortController.current = new AbortController();

    try {
      const res = await fetch(`${API_URL}/api/posts?page=${pageNumber}&limit=20`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: abortController.current.signal,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      const postsArray = data.data || data.posts || data || [];
      const normalized = postsArray.map(normalizePost);

      setPosts(prev => {
        const merged = append ? [...prev, ...normalized] : normalized;
        const unique = Array.from(new Map(merged.map(p => [p._id, p])).values());
        idbSetPosts("allPosts", unique);
        return unique;
      });

      const more = data.hasMore ?? normalized.length === 20;
      setHasMore(more);
      setPage(pageNumber);

      return { success: true, posts: normalized };
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message);
        setHasMore(false);
        console.error("❌ Erreur chargement posts:", err.message);
      }
      return { success: false, posts: [], error: err.message };
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  }, [token, normalizePost]);

  // === FETCH NEXT PAGE ===
  const fetchNextPage = useCallback(() => {
    if (!hasMore || isLoadingRef.current || loading) return;
    return fetchPosts(page + 1, true);
  }, [hasMore, loading, page, fetchPosts]);

  // === FETCH USER POSTS ===
  const fetchUserPosts = useCallback(async (targetUserId, pageNumber = 1, append = false) => {
    if (!token || !targetUserId) return [];

    try {
      const res = await fetch(`${API_URL}/api/posts?userId=${targetUserId}&page=${pageNumber}&limit=20`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      const postsArray = data.data || data.posts || data || [];
      const normalized = postsArray.map(normalizePost);

      await syncUserPosts(targetUserId, normalized);

      setPosts(prev => {
        const filtered = prev.filter(p => (p.user?._id || p.user) !== targetUserId);
        const merged = append ? [...filtered, ...normalized] : [...normalized, ...filtered];
        const unique = Array.from(new Map(merged.map(p => [p._id, p])).values());
        idbSetPosts("allPosts", unique);
        return unique;
      });

      return normalized;
    } catch (err) {
      console.error("❌ Erreur chargement posts utilisateur:", err.message);
      const { getCachedPosts } = await import('../utils/cacheSync');
      const cached = await getCachedPosts(targetUserId);
      return cached || [];
    }
  }, [token, normalizePost]);

  // === CREATE POST ===
  const createPost = useCallback(async (formData) => {
    if (!token) {
      console.warn("⚠️ Connexion requise pour publier");
      throw new Error("Connexion requise");
    }

    try {
      const res = await fetch(`${API_URL}/api/posts`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.error || "Erreur serveur");
      }

      const data = await res.json();
      const newPost = data.data || data;
      if (!newPost?._id) throw new Error("Post invalide");

      const normalized = normalizePost(newPost);
      await syncNewPost(normalized, userId);

      setPosts(prev => [normalized, ...prev]);
      console.log("✅ Post créé avec succès:", normalized._id);
      return normalized;
    } catch (err) {
      console.error("❌ Échec création post:", err.message);
      throw err;
    }
  }, [token, userId, normalizePost]);

  // === DELETE POST ===
  const deletePost = useCallback(async (postId) => {
    if (!token) {
      console.warn("⚠️ Connexion requise pour supprimer");
      return false;
    }

    try {
      const res = await fetch(`${API_URL}/api/posts/${postId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Suppression échouée");

      await syncDeletePost(postId, userId);
      setPosts(prev => prev.filter(p => p._id !== postId));
      console.log("✅ Post supprimé:", postId);
      return true;
    } catch (err) {
      console.error("❌ Échec suppression:", err.message);
      return false;
    }
  }, [token, userId]);

  // === UPDATE POST ===
  const updatePost = useCallback(async (updatedPost) => {
    const normalized = normalizePost(updatedPost);
    const ownerId = normalized.user?._id || normalized.user;

    await syncUpdatePost(normalized, ownerId);
    setPosts(prev => prev.map(p => p._id === normalized._id ? normalized : p));
    console.log("✅ Post mis à jour:", normalized._id);
  }, [normalizePost]);

  // === TOGGLE LIKE ===
  const toggleLike = useCallback(async (postId) => {
    if (!token || !userId) {
      console.warn("⚠️ Connexion requise pour liker");
      return false;
    }

    const optimisticUpdate = () => {
      setPosts(prev => prev.map(p => {
        if (p._id !== postId) return p;
        const likes = [...p.likes];
        const idx = likes.indexOf(userId);
        idx > -1 ? likes.splice(idx, 1) : likes.push(userId);
        return { ...p, likes };
      }));
    };

    optimisticUpdate();

    try {
      const res = await fetch(`${API_URL}/api/posts/${postId}/like`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Like échoué");

      const data = await res.json();
      const updated = normalizePost(data.data || data);
      const ownerId = updated.user?._id || updated.user;

      await syncUpdatePost(updated, ownerId);
      setPosts(prev => prev.map(p => p._id === postId ? updated : p));
      return true;
    } catch (err) {
      console.error("❌ Échec like:", err.message);
      optimisticUpdate(); // rollback
      fetchPosts(1, false);
      return false;
    }
  }, [token, userId, fetchPosts, normalizePost]);

  // === ADD COMMENT ===
  const addComment = useCallback(async (postId, content) => {
    if (!content?.trim() || !token) {
      console.warn("⚠️ Contenu vide ou non connecté");
      return false;
    }

    try {
      const res = await fetch(`${API_URL}/api/posts/${postId}/comment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ content }),
      });

      if (!res.ok) throw new Error("Commentaire échoué");

      const data = await res.json();
      const comment = data.data || data;

      setPosts(prev => prev.map(p => {
        if (p._id !== postId) return p;
        return { ...p, comments: [...p.comments, comment] };
      }));

      console.log("✅ Commentaire ajouté:", postId);
      return true;
    } catch (err) {
      console.error("❌ Échec commentaire:", err.message);
      return false;
    }
  }, [token]);

  // === INITIAL LOAD (cache first) ===
  useEffect(() => {
    if (!token || initialLoadDone.current) return;

    const init = async () => {
      try {
        const cached = await idbGetPosts("allPosts");
        if (cached?.length) {
          setPosts(cached);
          console.log("📦 Posts chargés depuis cache:", cached.length);
        }

        if (navigator.onLine) {
          await fetchPosts(1, false);
        }
      } catch (err) {
        console.error("❌ Erreur initialisation posts:", err.message);
        if (!posts.length) setError(err.message);
      } finally {
        initialLoadDone.current = true;
      }
    };

    init();
  }, [token, fetchPosts]);

  // === CLEANUP ===
  useEffect(() => {
    return () => {
      abortController.current?.abort();
    };
  }, []);

  // === MEMOIZED VALUE ===
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
    updatePost,
    toggleLike,
    addComment,
  }), [
    posts, loading, error, hasMore, page,
    fetchPosts, fetchNextPage, fetchUserPosts,
    createPost, deletePost, updatePost,
    toggleLike, addComment
  ]);

  return <PostsContext.Provider value={value}>{children}</PostsContext.Provider>;
};