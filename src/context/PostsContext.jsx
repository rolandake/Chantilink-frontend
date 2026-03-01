// src/context/PostsContext.jsx
// ✅ OPTIMISÉ LCP
// ✅ FIX LCP FINAL : preload avant render
// ✅ FIX PEXELS HARDCODÉ
// ✅ FIX POSTS PROFIL NON AFFICHÉS
// 🚀 FIX PUBLICATION LENTE :
//   - addPostOptimistic  → affiche le post INSTANTANÉMENT avec blob URLs locales
//   - replaceOptimisticPost → remplace le fantôme par le vrai post serveur
//   - removeOptimisticPost  → rollback propre si l'upload échoue
//   - createPost supprimé du context (géré directement dans CreatePost via axiosClient)
// ✅ FIX TDZ : fetchPosts déclaré AVANT replaceOptimisticPost
// ✅ FIX HTTP 400 : garde ObjectId sur fetchUserPosts — rejette les IDs temporaires clients

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
// GUARD — vérifie qu'un ID est un ObjectId MongoDB valide (24 hex)
// Rejette les IDs temporaires générés côté client (ex: user_6_1772309482858_41942)
// ─────────────────────────────────────────────
const isValidObjectId = (id) => /^[a-f\d]{24}$/i.test(String(id || ""));

// ─────────────────────────────────────────────
// FILTRE PEXELS HARDCODÉ
// ─────────────────────────────────────────────
const STALE_PEXELS_PATTERN = /videos\.pexels\.com\/video-files\/\d+\/\d+-\w+_\d+_\d+/;

function hasStaleHardcodedPexelsUrl(post) {
  const sources = [
    ...(Array.isArray(post.media)  ? post.media  : post.media  ? [post.media]  : []),
    ...(Array.isArray(post.images) ? post.images : post.images ? [post.images] : []),
    post.videoUrl,
    post.embedUrl,
  ];
  return sources.some(m => {
    const url = typeof m === "string" ? m : m?.url;
    return url && STALE_PEXELS_PATTERN.test(url);
  });
}

function filterStalePexelsPosts(posts) {
  return posts.filter(p => !hasStaleHardcodedPexelsUrl(p));
}

// ─────────────────────────────────────────────
// HELPERS LCP PRELOAD
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

function isVideoUrl(url)     { return url && /\.(mp4|webm|mov|avi)$/i.test(url.split("?")[0]); }
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

function preloadFirstPostLCP(posts) {
  if (!posts?.length) return;
  const first = posts[0];
  if (!first) return;
  const mediaSrc = first.images?.[0] || first.media?.[0];
  const rawUrl   = typeof mediaSrc === "string" ? mediaSrc : mediaSrc?.url;
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

  const tokenRef = useRef(token);
  useEffect(() => { tokenRef.current = token; }, [token]);

  const userId = user?._id || user?.id;

  const waitForToken = useCallback(async (maxWaitMs = 3000) => {
    if (tokenRef.current) return tokenRef.current;
    const interval = 100;
    let elapsed    = 0;
    return new Promise((resolve) => {
      const check = setInterval(() => {
        elapsed += interval;
        if (tokenRef.current) { clearInterval(check); resolve(tokenRef.current); }
        else if (elapsed >= maxWaitMs) { clearInterval(check); resolve(null); }
      }, interval);
    });
  }, []);

  // ============================================
  // NORMALISATION
  // ============================================
  const normalizePost = useCallback((p) => {
    // Les posts optimistes ont déjà leur user structuré — ne pas écraser
    if (p.isOptimistic) return p;

    const rawUser = p.user || p.author || {};
    const normalizedUser = {
      ...rawUser,
      _id:
        rawUser._id || rawUser.id || p.userId || p.author?._id || "unknown",
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
  // ✅ Déclaré EN PREMIER pour éviter la TDZ dans replaceOptimisticPost
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
        signal:  abortController.current.signal,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data       = await res.json();
      const postsArray = data.data || data.posts || data || [];
      const normalized = postsArray.map(normalizePost);
      console.log(`✅ [PostsContext] ${normalized.length} posts reçus`);

      preloadFirstPostLCP(normalized);

      setPosts(prev => {
        // Garde les posts optimistes en tête, dédoublonne le reste
        const optimistic = prev.filter(p => p.isOptimistic);
        const merged     = append
          ? [...prev.filter(p => !p.isOptimistic), ...normalized]
          : normalized;
        const unique = Array.from(new Map(merged.map(p => [p._id, p])).values());
        const clean  = filterStalePexelsPosts(unique);
        const final  = [...optimistic, ...clean.filter(p => !optimistic.some(o => o._id === p._id))];
        idbSetPosts("allPosts", clean); // cache sans les fantômes
        return final;
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
  // FETCH USER POSTS (Profil)
  // ✅ FIX : garde ObjectId — les IDs temporaires clients (user_6_xxx) sont
  //          rejetés silencieusement AVANT le fetch pour éviter les HTTP 400.
  //          Les bots ont de vrais ObjectIds MongoDB → passent normalement.
  // ============================================
  const fetchUserPosts = useCallback(async (targetUserId, pageNumber = 1) => {
    if (!targetUserId) {
      console.warn("⚠️ [PostsContext] fetchUserPosts : targetUserId manquant");
      return [];
    }

    // ✅ Garde ObjectId : rejette les IDs temporaires générés côté client
    // Les vrais comptes (humains ET bots) ont toujours un ObjectId MongoDB valide
    if (!isValidObjectId(targetUserId)) {
      console.warn(`⚠️ [PostsContext] fetchUserPosts : ID non-MongoDB ignoré (${targetUserId}) — attente d'un vrai ObjectId`);
      return [];
    }

    let activeToken = tokenRef.current;
    if (!activeToken) {
      console.log("⏳ [PostsContext] fetchUserPosts : token pas encore disponible, attente...");
      activeToken = await waitForToken(3000);
    }

    if (!activeToken) {
      console.error("❌ [PostsContext] fetchUserPosts : token toujours null après attente — abandon");
      return [];
    }

    console.log(`📡 [PostsContext] fetchUserPosts userId=${targetUserId} page=${pageNumber}`);

    try {
      const res = await fetch(
        `${API_URL}/posts/user/${targetUserId}?page=${pageNumber}&limit=20`,
        { headers: { Authorization: `Bearer ${activeToken}` } }
      );

      if (!res.ok) {
        console.error(`❌ [PostsContext] fetchUserPosts HTTP ${res.status} pour userId=${targetUserId}`);
        throw new Error(`HTTP ${res.status}`);
      }

      const data       = await res.json();
      const postsArray = data.posts || data.data || (Array.isArray(data) ? data : []);
      const normalized = postsArray.map(normalizePost);

      console.log(`✅ [PostsContext] fetchUserPosts : ${normalized.length} posts pour userId=${targetUserId}`);
      return normalized;

    } catch (err) {
      console.error(`❌ [PostsContext] fetchUserPosts erreur pour userId=${targetUserId}:`, err.message);

      try {
        const { getCachedPosts } = await import("../utils/cacheSync");
        const cached = await getCachedPosts(targetUserId);
        if (Array.isArray(cached) && cached.length > 0) {
          console.log(`📦 [PostsContext] fetchUserPosts : fallback cache ${cached.length} posts`);
          return cached;
        }
      } catch (cacheErr) {
        console.warn("⚠️ [PostsContext] fetchUserPosts : cache IDB inaccessible:", cacheErr.message);
      }

      return [];
    }
  }, [normalizePost, waitForToken]);

  // ============================================
  // 🚀 OPTIMISTIC POST METHODS
  // Placées APRÈS fetchPosts pour éviter le ReferenceError (temporal dead zone)
  // ============================================

  const addPostOptimistic = useCallback((optimisticPost) => {
    setPosts(prev => {
      if (prev.some(p => p._id === optimisticPost._id)) return prev;
      return [optimisticPost, ...prev];
    });
  }, []);

  const replaceOptimisticPost = useCallback((tempId, realPost) => {
    const normalized = normalizePost(realPost);
    syncNewPost(normalized, normalized.user?._id || userId).catch(() => {});
    // Retire le fantôme puis refetch → le vrai post arrive depuis le serveur
    // avec ses vraies URLs Cloudinary (identique à ce que le profil verrait)
    setPosts(prev => prev.filter(p => p._id !== tempId));
    setTimeout(() => {
      fetchPosts(1, false).catch(() => {});
    }, 800);
  }, [normalizePost, userId, fetchPosts]);

  const removeOptimisticPost = useCallback((tempId) => {
    setPosts(prev => prev.filter(p => p._id !== tempId));
  }, []);

  // ============================================
  // CREATE POST (conservé pour rétrocompat)
  // CreatePost.jsx utilise axiosClient directement
  // mais d'autres composants peuvent encore appeler createPost()
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
    // Ne prepend que si pas déjà dans le feed (évite doublon avec optimiste)
    setPosts(prev => {
      if (prev.some(p => p._id === normalized._id)) return prev;
      return [normalized, ...prev];
    });
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
  // INITIAL LOAD
  // ============================================
  useEffect(() => {
    if (!token) return;

    initialLoadDone.current = false;

    const init = async () => {
      if (initialLoadDone.current) return;
      initialLoadDone.current = true;

      try {
        const cached = await idbGetPosts("allPosts");
        if (cached?.length) {
          const cleanCached = filterStalePexelsPosts(cached);
          preloadFirstPostLCP(cleanCached);
          setPosts(cleanCached);
          setLoading(false);
          console.log(`⚡ [PostsContext] Cache hit : ${cleanCached.length} posts`);
        }

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
    // 🚀 Méthodes optimistes pour CreatePost.jsx
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