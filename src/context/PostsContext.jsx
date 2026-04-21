// src/context/PostsContext.jsx
// ✅ MIGRATION R2 COMPLÈTE
// ✅ SUPPRESSION IMG_BASE / CLOUD_NAME / VITE_CLOUDINARY_CLOUD_NAME
// ✅ SUPPRESSION getVideoPosterUrlFast (Cloudinary-only)
// ✅ SUPPRESSION getOptimizedImageUrl (transformations Cloudinary)
// ✅ preloadFirstPostLCP simplifié — URL déjà absolues (R2)
// ✅ FIX CHARGEMENT INITIAL : sessionLoadDone (vs tokenUsedRef)
// ✅ FIX PUBLICATION LENTE : addPostOptimistic / replaceOptimisticPost / removeOptimisticPost
// ✅ FIX TDZ : fetchPosts déclaré AVANT replaceOptimisticPost
// ✅ FIX HTTP 400 : garde ObjectId sur fetchUserPosts
// ✅ FIX RE-RENDER / SAUT VIDÉOS : tokenRef stable, replaceOptimisticPost sans fetchPosts
// ✅ FIX PEXELS v2 / PIXABAY v3 : filtre URLs vidéos bloquées

import React, {
  createContext, useContext, useState, useEffect,
  useCallback, useRef, useMemo
} from "react";
import { useAuth }     from "./AuthContext";
import { idbGetPosts, idbSetPosts } from "../utils/idbMigration";
import { syncNewPost, syncDeletePost, syncUpdatePost } from "../utils/cacheSync";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const PostsContext = createContext();
export const usePosts = () => useContext(PostsContext);

// ─────────────────────────────────────────────
// GUARD ObjectId MongoDB (24 hex)
// ─────────────────────────────────────────────
const isValidObjectId = (id) => /^[a-f\d]{24}$/i.test(String(id || ""));

// ─────────────────────────────────────────────
// FILTRE URLs EXTERNES BLOQUÉES
// ─────────────────────────────────────────────
function hasBlockedExternalVideoUrl(post) {
  const sources = [
    ...(Array.isArray(post.media)  ? post.media  : post.media  ? [post.media]  : []),
    ...(Array.isArray(post.images) ? post.images : post.images ? [post.images] : []),
    post.videoUrl, post.embedUrl, post.sourceUrl,
  ];
  return sources.some(m => {
    const url = typeof m === "string" ? m : m?.url;
    return url && (
      url.includes("videos.pexels.com") ||
      url.includes("cdn.pixabay.com/video")
    );
  });
}

function filterBlockedPosts(posts) {
  const before   = posts.length;
  const filtered = posts.filter(p => !hasBlockedExternalVideoUrl(p));
  const removed  = before - filtered.length;
  if (removed > 0) console.log(`🧹 [PostsContext] ${removed} post(s) masqués (URLs bloquées)`);
  return filtered;
}

// ─────────────────────────────────────────────
// LCP PRELOAD
// ✅ R2 : les URLs sont déjà absolues, on injecte directement
// ─────────────────────────────────────────────
const _preloadInjected = new Set();

function injectPreload(url) {
  if (!url || _preloadInjected.has(url)) return;
  if (document.querySelector(`link[rel="preload"][href="${url}"]`)) return;
  _preloadInjected.add(url);
  const link = document.createElement("link");
  link.rel           = "preload";
  link.as            = "image";
  link.href          = url;
  link.fetchPriority = "high";
  document.head.appendChild(link);
}

// ✅ CORRIGÉ : plus de Cloudinary — on preload l'URL telle quelle (déjà absolue R2)
// Pour les vidéos, on preload post.thumbnail si disponible (généré côté back-end).
function preloadFirstPostLCP(posts) {
  if (!posts?.length) return;
  const first = posts[0];
  if (!first) return;

  // Priorité 1 : thumbnail pré-généré (upload back-end ffmpeg → R2)
  if (first.thumbnail) {
    injectPreload(first.thumbnail);
    return;
  }

  // Priorité 2 : première image/media
  const mediaSrc = first.images?.[0] || first.media?.[0];
  const rawUrl   = typeof mediaSrc === "string" ? mediaSrc : mediaSrc?.url;
  if (rawUrl && rawUrl.startsWith("http")) {
    injectPreload(rawUrl);
  }
}

// ─────────────────────────────────────────────
// PROVIDER
// ─────────────────────────────────────────────
export const PostsProvider = ({ children }) => {
  const { user, token } = useAuth();

  const [posts,   setPosts]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const [page,    setPage]    = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const isLoadingRef    = useRef(false);
  const abortController = useRef(null);

  // tokenRef — fetchPosts lit toujours le token courant sans closure stale
  const tokenRef = useRef(token);
  useEffect(() => { tokenRef.current = token; }, [token]);

  const userId    = user?._id || user?.id;
  const userIdRef = useRef(userId);
  useEffect(() => { userIdRef.current = userId; }, [userId]);

  // ✅ FIX CHARGEMENT INITIAL :
  // sessionLoadDone = false AU MONTAGE → init() s'exécute toujours une fois par montage,
  // peu importe que le token JWT soit identique entre sessions (long-lived token).
  const sessionLoadDone = useRef(false);

  const waitForToken = useCallback(async (maxWaitMs = 3000) => {
    if (tokenRef.current) return tokenRef.current;
    const interval = 100;
    let elapsed    = 0;
    return new Promise((resolve) => {
      const check = setInterval(() => {
        elapsed += interval;
        if (tokenRef.current)      { clearInterval(check); resolve(tokenRef.current); }
        else if (elapsed >= maxWaitMs) { clearInterval(check); resolve(null); }
      }, interval);
    });
  }, []);

  // ============================================
  // NORMALISATION — stable (dépendances [])
  // ============================================
  const normalizePost = useCallback((p) => {
    if (p.isOptimistic) return p;
    const rawUser = p.user || p.author || {};
    const normalizedUser = {
      ...rawUser,
      _id:          rawUser._id || rawUser.id || p.userId || p.author?._id || "unknown",
      fullName:     rawUser.fullName || rawUser.name || rawUser.username || rawUser.displayName || p.author?.fullName || p.author?.name || p.fullName || p.userName || "",
      profilePhoto: rawUser.profilePhoto || rawUser.profilePicture || rawUser.avatar || rawUser.photo || p.userProfilePhoto || null,
      isVerified:   !!(rawUser.isVerified || rawUser.verified || p.isVerified),
      isPremium:    !!(rawUser.isPremium  || p.isPremium),
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
    const currentToken = tokenRef.current;
    if (!currentToken) {
      console.warn("⚠️ [PostsContext] fetchPosts bloqué : pas de token");
      return { success: false, posts: [] };
    }
    if (isLoadingRef.current) {
      console.warn("⚠️ [PostsContext] fetchPosts bloqué : déjà en cours");
      return { success: false, posts: [] };
    }

    console.log(`📡 [PostsContext] fetchPosts page=${pageNumber} append=${append}`);
    isLoadingRef.current = true;

    if (!append) {
      setPosts(prev => { if (prev.length === 0) setLoading(true); return prev; });
    }
    setError(null);

    abortController.current?.abort();
    abortController.current = new AbortController();

    try {
      const res = await fetch(`${API_URL}/posts?page=${pageNumber}&limit=20`, {
        headers: { Authorization: `Bearer ${currentToken}` },
        signal:  abortController.current.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data       = await res.json();
      const postsArray = data.data || data.posts || data || [];
      const normalized = postsArray.map(normalizePost);
      console.log(`✅ [PostsContext] ${normalized.length} posts reçus`);

      const clean = filterBlockedPosts(normalized);
      preloadFirstPostLCP(clean);

      setPosts(prev => {
        const optimistic = prev.filter(p => p.isOptimistic);
        const merged     = append
          ? [...prev.filter(p => !p.isOptimistic), ...clean]
          : clean;
        const unique = Array.from(new Map(merged.map(p => [p._id, p])).values());
        const final  = [...optimistic, ...unique.filter(p => !optimistic.some(o => o._id === p._id))];
        idbSetPosts("allPosts", unique);
        return final;
      });

      setHasMore(data.hasMore ?? normalized.length === 20);
      setPage(pageNumber);
      return { success: true, posts: clean };
    } catch (err) {
      if (err.name !== "AbortError") {
        console.error("❌ [PostsContext] fetchPosts erreur:", err.message);
        setError(err.message);
        setHasMore(false);
      }
      return { success: false, posts: [], error: err.message };
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  }, [normalizePost]);

  // ============================================
  // FETCH NEXT PAGE
  // ============================================
  const pageRef    = useRef(page);
  const hasMoreRef = useRef(hasMore);
  useEffect(() => { pageRef.current    = page;    }, [page]);
  useEffect(() => { hasMoreRef.current = hasMore; }, [hasMore]);

  const fetchNextPage = useCallback(() => {
    if (!hasMoreRef.current || isLoadingRef.current || loading) return;
    return fetchPosts(pageRef.current + 1, true);
  }, [loading, fetchPosts]);

  // ============================================
  // FETCH USER POSTS (Profil)
  // ============================================
  const fetchUserPosts = useCallback(async (targetUserId, pageNumber = 1) => {
    if (!targetUserId) {
      console.warn("⚠️ [PostsContext] fetchUserPosts : targetUserId manquant");
      return [];
    }
    if (!isValidObjectId(targetUserId)) {
      console.warn(`⚠️ [PostsContext] fetchUserPosts : ID non-MongoDB ignoré (${targetUserId})`);
      return [];
    }

    let activeToken = tokenRef.current;
    if (!activeToken) {
      console.log("⏳ [PostsContext] fetchUserPosts : attente token...");
      activeToken = await waitForToken(3000);
    }
    if (!activeToken) {
      console.error("❌ [PostsContext] fetchUserPosts : token null — abandon");
      return [];
    }

    console.log(`📡 [PostsContext] fetchUserPosts userId=${targetUserId} page=${pageNumber}`);
    try {
      const res = await fetch(
        `${API_URL}/posts/user/${targetUserId}?page=${pageNumber}&limit=20`,
        { headers: { Authorization: `Bearer ${activeToken}` } }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data       = await res.json();
      const postsArray = data.posts || data.data || (Array.isArray(data) ? data : []);
      const normalized = postsArray.map(normalizePost);
      const clean      = filterBlockedPosts(normalized);
      console.log(`✅ [PostsContext] fetchUserPosts : ${clean.length} posts`);
      return clean;
    } catch (err) {
      console.error(`❌ [PostsContext] fetchUserPosts erreur:`, err.message);
      try {
        const { getCachedPosts } = await import("../utils/cacheSync");
        const cached = await getCachedPosts(targetUserId);
        if (Array.isArray(cached) && cached.length > 0) {
          console.log(`📦 [PostsContext] fallback cache ${cached.length} posts`);
          return filterBlockedPosts(cached);
        }
      } catch { /* cache inaccessible */ }
      return [];
    }
  }, [normalizePost, waitForToken]);

  // ============================================
  // OPTIMISTIC POST METHODS
  // ============================================
  const addPostOptimistic = useCallback((optimisticPost) => {
    setPosts(prev => {
      if (prev.some(p => p._id === optimisticPost._id)) return prev;
      return [optimisticPost, ...prev];
    });
  }, []);

  const replaceOptimisticPost = useCallback((tempId, realPost) => {
    const normalized = normalizePost(realPost);
    syncNewPost(normalized, normalized.user?._id || userIdRef.current).catch(() => {});
    setPosts(prev => {
      const idx = prev.findIndex(p => p._id === tempId);
      if (idx === -1) return [normalized, ...prev];
      const next = [...prev];
      next[idx] = normalized;
      return next;
    });
  }, [normalizePost]);

  const removeOptimisticPost = useCallback((tempId) => {
    setPosts(prev => prev.filter(p => p._id !== tempId));
  }, []);

  // ============================================
  // CREATE / DELETE / REMOVE / UPDATE / LIKE / COMMENT
  // ============================================
  const createPost = useCallback(async (formData) => {
    const currentToken = tokenRef.current;
    if (!currentToken) throw new Error("Connexion requise");
    const res = await fetch(`${API_URL}/posts`, {
      method:  "POST",
      headers: { Authorization: `Bearer ${currentToken}` },
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
    await syncNewPost(normalized, userIdRef.current);
    setPosts(prev => {
      if (prev.some(p => p._id === normalized._id)) return prev;
      return [normalized, ...prev];
    });
    return normalized;
  }, [normalizePost]);

  const deletePost = useCallback(async (postId) => {
    const currentToken = tokenRef.current;
    if (!currentToken) return false;
    try {
      const res = await fetch(`${API_URL}/posts/${postId}`, {
        method:  "DELETE",
        headers: { Authorization: `Bearer ${currentToken}` },
      });
      if (!res.ok) throw new Error("Suppression échouée");
      await syncDeletePost(postId, userIdRef.current);
      setPosts(prev => prev.filter(p => p._id !== postId));
      return true;
    } catch (err) {
      console.error("❌ Échec suppression:", err.message);
      return false;
    }
  }, []);

  const removePost = useCallback((postId) => {
    setPosts(prev => prev.filter(p => p._id !== postId));
  }, []);

  const updatePost = useCallback(async (updatedPost) => {
    const normalized = normalizePost(updatedPost);
    await syncUpdatePost(normalized, normalized.user?._id || normalized.user);
    setPosts(prev => prev.map(p => p._id === normalized._id ? normalized : p));
  }, [normalizePost]);

  const toggleLike = useCallback(async (postId) => {
    const currentToken  = tokenRef.current;
    const currentUserId = userIdRef.current;
    if (!currentToken || !currentUserId) return false;
    const optimisticUpdate = () => {
      setPosts(prev => prev.map(p => {
        if (p._id !== postId) return p;
        const likes = [...p.likes];
        const idx   = likes.indexOf(currentUserId);
        idx > -1 ? likes.splice(idx, 1) : likes.push(currentUserId);
        return { ...p, likes };
      }));
    };
    optimisticUpdate();
    try {
      const res = await fetch(`${API_URL}/posts/${postId}/like`, {
        method:  "POST",
        headers: { Authorization: `Bearer ${currentToken}` },
      });
      if (!res.ok) throw new Error("Like échoué");
      const data    = await res.json();
      const updated = normalizePost(data.data || data);
      await syncUpdatePost(updated, updated.user?._id || updated.user);
      setPosts(prev => prev.map(p => p._id === postId ? updated : p));
      return true;
    } catch (err) {
      console.error("❌ Échec like:", err.message);
      optimisticUpdate();
      return false;
    }
  }, [normalizePost]);

  const addComment = useCallback(async (postId, content) => {
    const currentToken = tokenRef.current;
    if (!content?.trim() || !currentToken) return false;
    try {
      const res = await fetch(`${API_URL}/posts/${postId}/comment`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${currentToken}` },
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
  }, []);

  // ============================================
  // INIT — sessionLoadDone garantit l'exécution à chaque montage
  // ============================================
  useEffect(() => {
    if (!token) return;

    if (sessionLoadDone.current) return;
    sessionLoadDone.current = true;

    const init = async () => {
      try {
        const cached = await idbGetPosts("allPosts");
        if (cached?.length) {
          const cleanCached = filterBlockedPosts(cached);
          preloadFirstPostLCP(cleanCached);
          setPosts(cleanCached);
          setLoading(false);
          console.log(`⚡ [PostsContext] Cache IDB : ${cleanCached.length} posts`);
        } else {
          setLoading(true);
        }

        if (navigator.onLine) {
          await fetchPosts(1, false);
        } else {
          setLoading(false);
          console.log("📴 [PostsContext] Offline — cache uniquement");
        }
      } catch (err) {
        console.error("❌ [PostsContext] Erreur initialisation:", err.message);
        setLoading(false);
      }
    };

    init();
  }, [token, fetchPosts]);

  // ============================================
  // CLEANUP
  // ============================================
  useEffect(() => {
    return () => { abortController.current?.abort(); };
  }, []);

  const refetch = useCallback(async () => {
    return await fetchPosts(1, false);
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
    addPostOptimistic,
    replaceOptimisticPost,
    removeOptimisticPost,
  }), [
    posts, loading, error, hasMore, page,
    fetchPosts, fetchNextPage, fetchUserPosts,
    createPost, deletePost, removePost, updatePost,
    toggleLike, addComment, refetch,
    addPostOptimistic, replaceOptimisticPost, removeOptimisticPost,
  ]);

  return <PostsContext.Provider value={value}>{children}</PostsContext.Provider>;
};