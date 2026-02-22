// src/context/PostsContext.jsx
// ✅ OPTIMISÉ LCP :
// - Cache IDB affiché IMMÉDIATEMENT avec setLoading(false)
// - fetchPosts retourne { success, posts } pour le polling Home
// - fetchUserPosts isolé du feed global
// - Batch user loading côté backend (inchangé)
// ✅ FIX LCP FINAL :
// - Dès que le cache IDB répond, on précharge le poster du 1er post via <link preload>
//   AVANT que React ne rende quoi que ce soit
// - Le navigateur commence à télécharger l'image LCP ~2-3s plus tôt

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useAuth } from "./AuthContext";
import { idbGetPosts, idbSetPosts } from "../utils/idbMigration";
import { syncNewPost, syncDeletePost, syncUpdatePost } from "../utils/cacheSync";

const API_URL    = import.meta.env.VITE_API_URL    || "http://localhost:5000/api";
const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "dlymdclhe";
const IMG_BASE   = `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/`;

const PostsContext = createContext();
export const usePosts = () => useContext(PostsContext);

// ─────────────────────────────────────────────
// HELPERS LCP PRELOAD
// Injecte un <link rel="preload"> dans le <head> dès que
// l'URL du poster est connue — SANS attendre le render React.
// ─────────────────────────────────────────────
const _preloadInjected = new Set();

function injectPreload(url) {
  if (!url || _preloadInjected.has(url)) return;
  if (document.querySelector(`link[rel="preload"][href="${url}"]`)) return;
  _preloadInjected.add(url);
  const link = document.createElement("link");
  link.rel          = "preload";
  link.as           = "image";
  link.href         = url;
  link.fetchPriority = "high";
  document.head.appendChild(link);
}

function isVideoUrl(url) {
  return url && /\.(mp4|webm|mov|avi)$/i.test(url.split("?")[0]);
}

function isPexelsVideo(url)  { return url && url.includes("videos.pexels.com"); }
function isPixabayVideo(url) { return url && url.includes("cdn.pixabay.com/video"); }

function getVideoPosterUrlFast(videoUrl) {
  if (!videoUrl) return null;
  try {
    if (videoUrl.includes("res.cloudinary.com")) {
      const uploadIndex = videoUrl.indexOf("/upload/");
      if (uploadIndex === -1) return null;
      const afterUpload = videoUrl.substring(uploadIndex + 8);
      const segments    = afterUpload.split("/");
      const publicIdParts = [];
      for (const seg of segments) {
        const isTransform = seg.includes(",") || (/^[a-z]+_[a-z]/.test(seg) && !seg.includes("."));
        if (!isTransform) publicIdParts.push(seg);
      }
      const publicId = publicIdParts.join("/").replace(/\.(mp4|webm|mov|avi)$/i, "");
      if (!publicId) return null;
      return `${IMG_BASE}q_auto:good,f_jpg,w_1080,c_limit,so_0/${publicId}.jpg`;
    }
    if (isPexelsVideo(videoUrl)) {
      const match = videoUrl.match(/video-files\/(\d+)\//);
      if (match) return `https://images.pexels.com/videos/${match[1]}/pictures/preview-0.jpg`;
    }
    if (isPixabayVideo(videoUrl)) {
      return videoUrl
        .replace("_large.mp4",  "_tiny.jpg")
        .replace("_medium.mp4", "_tiny.jpg")
        .replace("_small.mp4",  "_tiny.jpg");
    }
    return null;
  } catch { return null; }
}

function getOptimizedImageUrl(url) {
  if (!url || url.startsWith("data:")) return url;
  if (url.startsWith("http") && !url.includes("res.cloudinary.com")) return url;
  if (url.includes("res.cloudinary.com")) {
    if (url.includes("q_auto") || url.includes("w_1080")) return url;
    try {
      const uploadIndex = url.indexOf("/upload/");
      if (uploadIndex !== -1) {
        const afterUpload = url.substring(uploadIndex + 8);
        const firstPart   = afterUpload.split("/")[0];
        const publicId    = firstPart.includes(",") || /^[a-z]_/.test(firstPart)
          ? afterUpload.substring(firstPart.length + 1)
          : afterUpload;
        return `${IMG_BASE}q_auto:good,f_auto,fl_progressive:steep,w_1080,c_limit/${publicId}`;
      }
    } catch { return url; }
  }
  const id = url.replace(/^\/+/, "");
  return `${IMG_BASE}q_auto:good,f_auto,fl_progressive:steep,w_1080,c_limit/${id}`;
}

/**
 * Extrait l'URL LCP du 1er post et l'injecte en preload.
 * Appelé dès que les posts sont disponibles (cache IDB ou API).
 */
function preloadFirstPostLCP(posts) {
  if (!posts?.length) return;
  const first = posts[0];
  if (!first) return;

  const mediaSrc  = first.images?.[0] || first.media?.[0];
  const rawUrl    = typeof mediaSrc === "string" ? mediaSrc : mediaSrc?.url;
  if (!rawUrl) return;

  let lcpUrl;
  if (isVideoUrl(rawUrl) || isPexelsVideo(rawUrl) || isPixabayVideo(rawUrl)) {
    lcpUrl = first.thumbnail || getVideoPosterUrlFast(rawUrl);
  } else {
    lcpUrl = getOptimizedImageUrl(rawUrl);
  }

  if (lcpUrl) injectPreload(lcpUrl);
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

      // ✅ Preload LCP dès réception des posts frais (cas sans cache)
      preloadFirstPostLCP(normalized);

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
  }, [token, normalizePost]);

  // ============================================
  // FETCH NEXT PAGE
  // ============================================
  const fetchNextPage = useCallback(() => {
    if (!hasMore || isLoadingRef.current || loading) return;
    return fetchPosts(page + 1, true);
  }, [hasMore, loading, page, fetchPosts]);

  // ============================================
  // FETCH USER POSTS (Profil) — isolé du feed global
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
        const { getCachedPosts } = await import("../utils/cacheSync");
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
      optimisticUpdate();
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
  // INITIAL LOAD — cache IMMÉDIAT puis API en arrière-plan
  // ✅ FIX LCP : preloadFirstPostLCP() appelé DÈS le cache hit
  //    → le navigateur commence à télécharger le poster AVANT le render React
  //    → resource load delay réduit de ~3s
  // ============================================
  useEffect(() => {
    if (!token) return;

    initialLoadDone.current = false;

    const init = async () => {
      if (initialLoadDone.current) return;
      initialLoadDone.current = true;

      try {
        // Étape 1 : cache IDB IMMÉDIAT
        const cached = await idbGetPosts("allPosts");
        if (cached?.length) {
          // ✅ CRITIQUE : preload du poster LCP AVANT setPosts()
          // Le navigateur reçoit l'instruction de télécharger l'image
          // pendant que React prépare le render — gain de ~1-2s
          preloadFirstPostLCP(cached);

          setPosts(cached);
          setLoading(false);
          console.log(`⚡ [PostsContext] Cache hit : ${cached.length} posts affichés`);
        }

        // Étape 2 : API en arrière-plan
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
    return result;
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