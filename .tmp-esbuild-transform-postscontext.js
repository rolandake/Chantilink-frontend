import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo
} from "react";
import { useAuth } from "./AuthContext";
import { useLanguage } from "./LanguageContext";
import { idbGetPosts, idbSetPosts } from "../utils/idbMigration";
import { syncNewPost, syncDeletePost, syncUpdatePost } from "../utils/cacheSync";
import { isPostHidden } from "../utils/postNotificationPreferences";
const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? "https://chantilink-backend.onrender.com/api" : "http://localhost:5000/api");
const SESSION_LOAD_KEY = "posts_session_loaded_v1";
const PostsContext = createContext();
const usePosts = () => useContext(PostsContext);
const isValidObjectId = (id) => /^[a-f\d]{24}$/i.test(String(id || ""));
const BTP_KEYWORDS = [
  "chantier",
  "construction",
  "btp",
  "g\xE9nie civil",
  "genie civil",
  "b\xE2timent",
  "batiment",
  "b\xE9ton",
  "beton",
  "ciment",
  "grue",
  "pelleteuse",
  "pont",
  "route",
  "terrassement",
  "coffrage",
  "ferraillage",
  "fondation",
  "ma\xE7onnerie",
  "maconnerie",
  "infrastructure",
  "civil engineering",
  "construction site",
  "concrete",
  "formwork",
  "rebar",
  "earthwork",
  "foundation",
  "bridge",
  "roadwork",
  "masonry",
  "site work"
];
const BOT_FALLBACK_CONTENT = {
  fr: "S\xE9quence chantier autour du BTP et du g\xE9nie civil.",
  en: "Construction and civil engineering site sequence.",
  ar: "\u0644\u0642\u0637\u0629 \u0645\u0646 \u0645\u0648\u0642\u0639 \u0628\u0646\u0627\u0621 \u0645\u0631\u062A\u0628\u0637\u0629 \u0628\u0627\u0644\u0647\u0646\u062F\u0633\u0629 \u0627\u0644\u0645\u062F\u0646\u064A\u0629."
};
const normalizeLang = (lang = "fr") => {
  const code = String(lang || "fr").toLowerCase().split(/[-_]/)[0];
  return ["fr", "en", "ar"].includes(code) ? code : "fr";
};
const cleanBotText = (value = "") => String(value || "").replace(/https?:\/\/\S+/gi, "").replace(/\bt\.co\/\S+/gi, "").replace(/[@#][\p{L}\p{N}_-]+/gu, "").replace(/\s+/g, " ").trim();
const looksNoisyBotText = (value = "") => {
  const text = String(value || "").trim();
  if (!text) return true;
  if (/^[a-f0-9]{16,}$/i.test(text)) return true;
  if (/^[A-Za-z0-9+/=_-]{24,}$/.test(text) && !/\s/.test(text)) return true;
  const tokens = text.split(/\s+/);
  const noisy = tokens.filter((t) => /https?:|t\.co\//i.test(t) || /^[#@]/.test(t) || /^[A-Za-z0-9_-]{14,}$/.test(t)).length;
  const letters = (text.match(/\p{L}/gu) || []).length;
  const symbols = (text.match(/[^\p{L}\p{N}\s.,:;!?'"()\-]/gu) || []).length;
  return noisy / Math.max(tokens.length, 1) > 0.45 || letters < 8 || symbols > letters * 0.45;
};
const isBotPost = (post) => !!(post?.isBot || post?.user?.isBot || post?.user?.isAutoCreated || post?._isBot);
const hasPostMedia = (post) => !!(post?.videoUrl || post?.embedUrl || post?.sourceUrl || post?.media?.length || post?.images?.length);
const isBtpPost = (post) => {
  const text = [
    post?.content || post?.contenu || "",
    post?.title || "",
    post?.description || "",
    post?.category || "",
    ...Array.isArray(post?.hashtags) ? post.hashtags : [],
    ...Array.isArray(post?.tags) ? post.tags : []
  ].join(" ").toLowerCase();
  return BTP_KEYWORDS.some((kw) => text.includes(kw));
};
function hasBlockedExternalVideoUrl(post) {
  const sources = [
    ...Array.isArray(post.media) ? post.media : post.media ? [post.media] : [],
    ...Array.isArray(post.images) ? post.images : post.images ? [post.images] : [],
    post.videoUrl,
    post.embedUrl,
    post.sourceUrl
  ];
  return sources.some((m) => {
    const url = typeof m === "string" ? m : m?.url;
    return url && (url.includes("videos.pexels.com") || url.includes("cdn.pixabay.com/video"));
  });
}
function filterBlockedPosts(posts) {
  const before = posts.length;
  const filtered = posts.filter((p) => !hasBlockedExternalVideoUrl(p) && !isPostHidden(p) && !(isBotPost(p) && hasPostMedia(p) && p._botCivilRelevant === false));
  const removed = before - filtered.length;
  if (removed > 0) console.log(`\u{1F9F9} [PostsContext] ${removed} post(s) masqu\xE9s (URLs bloqu\xE9es)`);
  return filtered;
}
const _preloadInjected = /* @__PURE__ */ new Set();
function shouldPreloadAsLcp(url) {
  if (!url || typeof url !== "string") return false;
  if (url.startsWith("/") || url.startsWith("data:") || url.startsWith("blob:")) return true;
  try {
    const parsed = new URL(url);
    const api = new URL(API_URL);
    return parsed.origin === window.location.origin || parsed.origin === api.origin;
  } catch {
    return false;
  }
}
function injectPreload(url) {
  if (!shouldPreloadAsLcp(url)) return;
  if (!url || _preloadInjected.has(url)) return;
  if (document.querySelector(`link[rel="preload"][href="${url}"]`)) return;
  _preloadInjected.add(url);
  const link = document.createElement("link");
  link.rel = "preload";
  link.as = "image";
  link.href = url;
  link.fetchPriority = "high";
  document.head.appendChild(link);
}
function preloadFirstPostLCP(posts) {
  if (!posts?.length) return;
  const first = posts[0];
  if (!first) return;
  if (first.thumbnail) {
    injectPreload(first.thumbnail);
    return;
  }
  const mediaSrc = first.images?.[0] || first.media?.[0];
  const rawUrl = typeof mediaSrc === "string" ? mediaSrc : mediaSrc?.url;
  if (rawUrl && rawUrl.startsWith("http")) {
    injectPreload(rawUrl);
  }
}
const PostsProvider = ({ children }) => {
  const { user, token } = useAuth();
  const { language } = useLanguage();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const isLoadingRef = useRef(false);
  const abortController = useRef(null);
  const networkBackoffUntilRef = useRef(0);
  const tokenRef = useRef(token);
  useEffect(() => {
    tokenRef.current = token;
  }, [token]);
  const languageRef = useRef(language || "fr");
  useEffect(() => {
    languageRef.current = language || "fr";
  }, [language]);
  const buildAuthHeaders = useCallback((activeToken = tokenRef.current) => ({
    Authorization: `Bearer ${activeToken}`,
    "Accept-Language": languageRef.current || "fr",
    "X-User-Language": languageRef.current || "fr"
  }), []);
  const userId = user?._id || user?.id;
  const userIdRef = useRef(userId);
  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);
  const sessionLoadDone = useRef(
    typeof sessionStorage !== "undefined" && !!sessionStorage.getItem(SESSION_LOAD_KEY)
  );
  const cacheHydratedRef = useRef(false);
  const didInitialFetchRef = useRef(false);
  const prevTokenRef = useRef(token);
  useEffect(() => {
    if (token && token !== prevTokenRef.current) {
      try {
        sessionStorage.removeItem(SESSION_LOAD_KEY);
      } catch {
      }
      sessionLoadDone.current = false;
      cacheHydratedRef.current = false;
      didInitialFetchRef.current = false;
    }
    prevTokenRef.current = token;
  }, [token]);
  const waitForToken = useCallback(async (maxWaitMs = 3e3) => {
    if (tokenRef.current) return tokenRef.current;
    const interval = 100;
    let elapsed = 0;
    return new Promise((resolve) => {
      const check = setInterval(() => {
        elapsed += interval;
        if (tokenRef.current) {
          clearInterval(check);
          resolve(tokenRef.current);
        } else if (elapsed >= maxWaitMs) {
          clearInterval(check);
          resolve(null);
        }
      }, interval);
    });
  }, []);
  const normalizePost = useCallback((p) => {
    if (p.isOptimistic) return p;
    const rawUser = p.user || p.author || {};
    const botPost = isBotPost({ ...p, user: rawUser });
    const botCivilRelevant = !botPost || isBtpPost(p);
    const cleanedContent = botPost ? cleanBotText(p.content || p.contenu || "") : null;
    const contentIsUsable = cleanedContent && !looksNoisyBotText(cleanedContent) && isBtpPost({ ...p, content: cleanedContent });
    const safeContent = botPost ? contentIsUsable ? cleanedContent : BOT_FALLBACK_CONTENT[normalizeLang(languageRef.current)] : p.content;
    const normalizedUser = {
      ...rawUser,
      _id: rawUser._id || rawUser.id || p.userId || p.author?._id || "unknown",
      fullName: rawUser.fullName || rawUser.name || rawUser.username || rawUser.displayName || p.author?.fullName || p.author?.name || p.fullName || p.userName || "",
      profilePhoto: rawUser.profilePhoto || rawUser.profilePicture || rawUser.avatar || rawUser.photo || p.userProfilePhoto || null,
      isVerified: !!(rawUser.isVerified || rawUser.verified || p.isVerified),
      isPremium: !!(rawUser.isPremium || p.isPremium),
      isBot: !!(rawUser.isBot || p.isBot),
      isAutoCreated: !!(rawUser.isAutoCreated || p.isAutoCreated)
    };
    return {
      ...p,
      _id: p._id || p.id,
      _botCivilRelevant: botCivilRelevant,
      content: safeContent,
      contenu: botPost ? safeContent : p.contenu,
      user: normalizedUser,
      likes: Array.isArray(p.likes) ? p.likes : [],
      comments: Array.isArray(p.comments) ? p.comments : [],
      views: Array.isArray(p.views) ? p.views : [],
      shares: Array.isArray(p.shares) ? p.shares : []
    };
  }, []);
  const fetchPosts = useCallback(async (pageNumber = 1, append = false, options = {}) => {
    if (options.forceNetworkRetry) {
      networkBackoffUntilRef.current = 0;
    } else if (Date.now() < networkBackoffUntilRef.current) {
      return { success: false, posts: [], error: "network_backoff" };
    }
    const currentToken = tokenRef.current;
    if (!currentToken) {
      console.warn("\u26A0\uFE0F [PostsContext] fetchPosts bloqu\xE9 : pas de token");
      return { success: false, posts: [] };
    }
    if (isLoadingRef.current) {
      if (options.waitIfLoading) {
        const startedAt = Date.now();
        const maxWaitMs = options.maxWaitMs || 2500;
        while (isLoadingRef.current && Date.now() - startedAt < maxWaitMs) {
          await new Promise((resolve) => setTimeout(resolve, 80));
        }
      }
      if (isLoadingRef.current) {
        if (!options.silentIfLoading) {
          console.warn("\u26A0\uFE0F [PostsContext] fetchPosts bloqu\xE9 : d\xE9j\xE0 en cours");
        }
        return { success: false, posts: [], error: "already_loading" };
      }
    }
    console.log(`\u{1F4E1} [PostsContext] fetchPosts page=${pageNumber} append=${append}`);
    isLoadingRef.current = true;
    if (!append) {
      setPosts((prev) => {
        if (prev.length === 0) setLoading(true);
        return prev;
      });
    }
    setError(null);
    abortController.current?.abort();
    abortController.current = new AbortController();
    try {
      const lang = encodeURIComponent(languageRef.current || "fr");
      const refreshTs = options.forceNetworkRetry ? `&_ts=${Date.now()}` : "";
      const url = `${API_URL}/posts?page=${pageNumber}&limit=20&language=${lang}${refreshTs}`;
      const res = await fetch(url, {
        headers: buildAuthHeaders(currentToken),
        signal: abortController.current.signal,
        cache: "no-store"
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const postsArray = data.data || data.posts || data || [];
      const normalized = postsArray.map(normalizePost);
      console.log(`\u2705 [PostsContext] ${normalized.length} posts re\xE7us`);
      const clean = filterBlockedPosts(normalized);
      preloadFirstPostLCP(clean);
      setPosts((prev) => {
        const optimistic = prev.filter((p) => p.isOptimistic);
        const nonOptimistic = prev.filter((p) => !p.isOptimistic);
        let merged;
        if (append) {
          const existingIds = new Set(nonOptimistic.map((p) => p._id));
          const freshOnly = clean.filter((p) => p._id && !existingIds.has(p._id));
          merged = [...nonOptimistic, ...freshOnly];
        } else {
          merged = clean;
        }
        const unique = Array.from(new Map(merged.map((p) => [p._id, p])).values());
        if (!append && unique.length === nonOptimistic.length) {
          const allSame = unique.every((p, i) => p._id === nonOptimistic[i]?._id);
          if (allSame) {
            idbSetPosts("allPosts", unique);
            return prev;
          }
        }
        const final = [...optimistic, ...unique.filter((p) => !optimistic.some((o) => o._id === p._id))];
        idbSetPosts("allPosts", unique);
        return final;
      });
      setHasMore(data.hasMore ?? normalized.length === 20);
      setPage(pageNumber);
      return { success: true, posts: clean, page: pageNumber, hasMore: data.hasMore ?? normalized.length === 20 };
    } catch (err) {
      if (err.name !== "AbortError") {
        const isNetworkFailure = err instanceof TypeError && /failed to fetch/i.test(err.message || "");
        if (isNetworkFailure) {
          networkBackoffUntilRef.current = Date.now() + 3e4;
          console.warn("\u26A0\uFE0F [PostsContext] API posts injoignable, nouvelle tentative dans 30s");
        } else {
          console.error("\u274C [PostsContext] fetchPosts erreur:", err.message);
        }
        setError(err.message);
      }
      return { success: false, posts: [], error: err.message };
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  }, [buildAuthHeaders, normalizePost]);
  const pageRef = useRef(page);
  const hasMoreRef = useRef(hasMore);
  useEffect(() => {
    pageRef.current = page;
  }, [page]);
  useEffect(() => {
    hasMoreRef.current = hasMore;
  }, [hasMore]);
  const fetchNextPage = useCallback(() => {
    if (!hasMoreRef.current || isLoadingRef.current || loading) return;
    return fetchPosts(pageRef.current + 1, true);
  }, [loading, fetchPosts]);
  const fetchUserPosts = useCallback(async (targetUserId, pageNumber = 1) => {
    if (!targetUserId) {
      console.warn("\u26A0\uFE0F [PostsContext] fetchUserPosts : targetUserId manquant");
      return [];
    }
    if (!isValidObjectId(targetUserId)) {
      console.warn(`\u26A0\uFE0F [PostsContext] fetchUserPosts : ID non-MongoDB ignor\xE9 (${targetUserId})`);
      return [];
    }
    let activeToken = tokenRef.current;
    if (!activeToken) {
      console.log("\u23F3 [PostsContext] fetchUserPosts : attente token...");
      activeToken = await waitForToken(1200);
    }
    const requestHeaders = activeToken ? buildAuthHeaders(activeToken) : {};
    console.log(`\u{1F4E1} [PostsContext] fetchUserPosts userId=${targetUserId} page=${pageNumber}`);
    try {
      const urls = [
        `${API_URL}/posts/user/${targetUserId}?page=${pageNumber}&limit=20`,
        `${API_URL}/users/${targetUserId}/posts?page=${pageNumber}&limit=20`,
        `${API_URL}/posts?userId=${targetUserId}&page=${pageNumber}&limit=20`
      ];
      let data = null;
      let lastError = null;
      for (const url of urls) {
        const res = await fetch(url, { headers: requestHeaders, cache: "no-store" });
        if (res.ok) {
          data = await res.json();
          break;
        }
        lastError = new Error(`HTTP ${res.status}`);
        if (res.status !== 404) break;
      }
      if (!data) throw lastError || new Error("Aucune r\xE9ponse posts utilisateur");
      const postsArray = data.posts || data.data || (Array.isArray(data) ? data : []);
      const normalized = postsArray.map(normalizePost);
      const clean = filterBlockedPosts(normalized);
      console.log(`\u2705 [PostsContext] fetchUserPosts : ${clean.length} posts`);
      return clean;
    } catch (err) {
      console.error(`\u274C [PostsContext] fetchUserPosts erreur:`, err.message);
      try {
        const { getCachedPosts } = await import("../utils/cacheSync");
        const cached = await getCachedPosts(targetUserId);
        if (Array.isArray(cached) && cached.length > 0) {
          console.log(`\u{1F4E6} [PostsContext] fallback cache ${cached.length} posts`);
          return filterBlockedPosts(cached);
        }
      } catch {
      }
      return [];
    }
  }, [buildAuthHeaders, normalizePost, waitForToken]);
  const addPostOptimistic = useCallback((optimisticPost) => {
    setPosts((prev) => {
      if (prev.some((p) => p._id === optimisticPost._id)) return prev;
      return [optimisticPost, ...prev];
    });
  }, []);
  const replaceOptimisticPost = useCallback((tempId, realPost) => {
    const normalized = normalizePost(realPost);
    syncNewPost(normalized, normalized.user?._id || userIdRef.current).catch(() => {
    });
    setPosts((prev) => {
      const idx = prev.findIndex((p) => p._id === tempId);
      if (idx === -1) return [normalized, ...prev];
      const next = [...prev];
      next[idx] = normalized;
      return next;
    });
    return normalized;
  }, [normalizePost]);
  const removeOptimisticPost = useCallback((tempId) => {
    setPosts((prev) => prev.filter((p) => p._id !== tempId));
  }, []);
  const createPost = useCallback(async (formData) => {
    const currentToken = tokenRef.current;
    if (!currentToken) throw new Error("Connexion requise");
    const res = await fetch(`${API_URL}/posts`, {
      method: "POST",
      headers: buildAuthHeaders(currentToken),
      body: formData
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || err.error || "Erreur serveur");
    }
    const data = await res.json();
    const newPost = data.data || data;
    if (!newPost?._id) throw new Error("Post invalide");
    const normalized = normalizePost(newPost);
    await syncNewPost(normalized, userIdRef.current);
    setPosts((prev) => {
      if (prev.some((p) => p._id === normalized._id)) return prev;
      return [normalized, ...prev];
    });
    return normalized;
  }, [buildAuthHeaders, normalizePost]);
  const deletePost = useCallback(async (postId) => {
    const currentToken = tokenRef.current;
    if (!currentToken) return false;
    try {
      const res = await fetch(`${API_URL}/posts/${postId}`, {
        method: "DELETE",
        headers: buildAuthHeaders(currentToken)
      });
      if (!res.ok) throw new Error("Suppression \xE9chou\xE9e");
      await syncDeletePost(postId, userIdRef.current);
      setPosts((prev) => prev.filter((p) => p._id !== postId));
      return true;
    } catch (err) {
      console.error("\u274C \xC9chec suppression:", err.message);
      return false;
    }
  }, [buildAuthHeaders]);
  const removePost = useCallback((postId) => {
    setPosts((prev) => prev.filter((p) => p._id !== postId));
  }, []);
  const updatePost = useCallback(async (updatedPost) => {
    const normalized = normalizePost(updatedPost);
    await syncUpdatePost(normalized, normalized.user?._id || normalized.user);
    setPosts((prev) => prev.map((p) => p._id === normalized._id ? normalized : p));
  }, [normalizePost]);
  const toggleLike = useCallback(async (postId) => {
    const currentToken = tokenRef.current;
    const currentUserId = userIdRef.current;
    if (!currentToken || !currentUserId) return false;
    const optimisticUpdate = () => {
      setPosts((prev) => prev.map((p) => {
        if (p._id !== postId) return p;
        const likes = [...p.likes];
        const idx = likes.indexOf(currentUserId);
        idx > -1 ? likes.splice(idx, 1) : likes.push(currentUserId);
        return { ...p, likes };
      }));
    };
    optimisticUpdate();
    try {
      const res = await fetch(`${API_URL}/posts/${postId}/like`, {
        method: "POST",
        headers: buildAuthHeaders(currentToken)
      });
      if (!res.ok) throw new Error("Like \xE9chou\xE9");
      const data = await res.json();
      const updated = normalizePost(data.data || data);
      await syncUpdatePost(updated, updated.user?._id || updated.user);
      setPosts((prev) => prev.map((p) => p._id === postId ? updated : p));
      return true;
    } catch (err) {
      console.error("\u274C \xC9chec like:", err.message);
      optimisticUpdate();
      return false;
    }
  }, [buildAuthHeaders, normalizePost]);
  const addComment = useCallback(async (postId, content) => {
    const currentToken = tokenRef.current;
    if (!content?.trim() || !currentToken) return false;
    try {
      const res = await fetch(`${API_URL}/posts/${postId}/comment`, {
        method: "POST",
        headers: { ...buildAuthHeaders(currentToken), "Content-Type": "application/json" },
        body: JSON.stringify({ content })
      });
      if (!res.ok) throw new Error("Commentaire \xE9chou\xE9");
      const data = await res.json();
      const comment = data.data || data;
      setPosts((prev) => prev.map((p) => {
        if (p._id !== postId) return p;
        return { ...p, comments: [...p.comments, comment] };
      }));
      return true;
    } catch (err) {
      console.error("\u274C \xC9chec commentaire:", err.message);
      return false;
    }
  }, [buildAuthHeaders]);
  useEffect(() => {
    if (!user) return;
    if (cacheHydratedRef.current) return;
    const wasSessionLoaded = sessionLoadDone.current;
    cacheHydratedRef.current = true;
    sessionLoadDone.current = true;
    try {
      sessionStorage.setItem(SESSION_LOAD_KEY, "1");
    } catch {
    }
    const init = async () => {
      try {
        const cached = await idbGetPosts("allPosts");
        const hasCachedPosts = cached?.length > 0;
        const shouldFetchNetwork = !wasSessionLoaded || !hasCachedPosts;
        if (hasCachedPosts) {
          const cleanCached = filterBlockedPosts(cached);
          preloadFirstPostLCP(cleanCached);
          setPosts(cleanCached);
          setLoading(false);
          console.log(`\u26A1 [PostsContext] Cache IDB : ${cleanCached.length} posts`);
        } else {
          setLoading(true);
        }
        if (shouldFetchNetwork && navigator.onLine && tokenRef.current) {
          didInitialFetchRef.current = true;
          await fetchPosts(1, false);
        } else {
          if (!tokenRef.current) {
            console.log("\u26A1 [PostsContext] Token non disponible \u2014 affichage du cache en attendant la reconnexion");
          } else {
            console.log("\u{1F4F4} [PostsContext] Offline \u2014 cache uniquement");
          }
          if (!cached?.length) setLoading(false);
        }
      } catch (err) {
        console.error("\u274C [PostsContext] Erreur initialisation:", err.message);
        setLoading(false);
      }
    };
    init();
  }, [user, fetchPosts]);
  useEffect(() => {
    if (!user || !token || !sessionLoadDone.current) return;
    if (didInitialFetchRef.current) return;
    if (isLoadingRef.current) return;
    didInitialFetchRef.current = true;
    fetchPosts(1, false);
  }, [user, token, fetchPosts]);
  useEffect(() => {
    if (!user || !token) return;
    const handleLanguageChanged = () => {
      sessionLoadDone.current = false;
      setPage(1);
      setHasMore(true);
      fetchPosts(1, false, { waitIfLoading: true, silentIfLoading: true });
    };
    window.addEventListener("feed:language-changed", handleLanguageChanged);
    return () => {
      window.removeEventListener("feed:language-changed", handleLanguageChanged);
    };
  }, [fetchPosts, token, user]);
  useEffect(() => {
    return () => {
      abortController.current?.abort();
    };
  }, []);
  const clearHomeState = useCallback(() => {
    console.log("\u{1F9F9} [PostsContext] Nettoyage complet du feed Home");
    setPosts([]);
    setLoading(false);
    setError(null);
    setPage(1);
    setHasMore(true);
    isLoadingRef.current = false;
    didInitialFetchRef.current = false;
    sessionLoadDone.current = false;
    networkBackoffUntilRef.current = 0;
    abortController.current?.abort();
    abortController.current = new AbortController();
  }, []);
  const refetch = useCallback(async (options = {}) => {
    return await fetchPosts(1, false, options);
  }, [fetchPosts]);
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
    clearHomeState
  }), [
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
    clearHomeState
  ]);
  return /* @__PURE__ */ React.createElement(PostsContext.Provider, { value }, children);
};
export {
  PostsProvider,
  usePosts
};
