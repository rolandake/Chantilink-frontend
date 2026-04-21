// src/pages/profile/ProfilePage.jsx
// ✅ v4 — FIX IDs NON-MONGODB + PROFIL BOT + PROFIL MOCK
//
// 🐛 FIX 1 — IDs non-MongoDB (mock posts) :
//    loadProfilePosts ne bloquait pas sur isValidObjectId, mais le log
//    "ID non-MongoDB: user_9_..." indique que le userId en param est un ID mock.
//    On détecte désormais les IDs mock/temporaires et on affiche le profil
//    directement depuis les données du post sans faire de fetch réseau.
//
// 🐛 FIX 2 — Profil bot "introuvable" :
//    Si fetchUserById retourne null (404) ET que le post a un user.isBot=true,
//    on construit le profil depuis l'objet user embarqué dans le post
//    au lieu d'afficher "Profil introuvable".
//
// 🐛 FIX 3 — Navigation depuis un post mock :
//    buildProfileFromEmbeddedUser() construit un profil complet depuis
//    le champ user du post (qui contient username, fullName, profilePhoto, etc.)
//    sans aucun appel réseau.
//
// 🐛 FIX 4 — Posts du profil bot visibles :
//    Pour les bots, on cherche les posts dans le pool Home (livePostsRef via
//    window.__homePostsPool__) avant de faire un fetch réseau.
//
// ✅ Toutes les corrections v1/v2/v3 conservées (spinner, texte coloré, etc.)

import React, { useState, useEffect, useCallback, useRef, memo, startTransition } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ProfileHeader from "./ProfileHeader";
import ProfileMenu from "./ProfileMenu";
import SettingsSection from "./SettingsSection";
import CreatePost from "../Home/CreatePost";
import PostCard from "../Home/PostCard";
import ProfileSuggestions from "./ProfileSuggestions";
import { usePosts } from "../../context/PostsContext";
import { useAuth } from "../../context/AuthContext";
import { useDarkMode } from "../../context/DarkModeContext";
import { registerServiceWorker, prefetchImagesViaSW } from "../../utils/swRegister";
import { syncNewPost, syncDeletePost, getCachedPosts } from "../../utils/cacheSync";
import axios from "axios";
import {
  setupIndexedDB,
  idbGetProfilePosts as idbGet,
  idbSetProfilePosts as idbSet,
  idbClearOtherKeysProfilePosts as idbClearOtherKeys,
  idbSetProfileUser as idbSetUser,
  idbGetProfileUser as idbGetUser
} from "../../utils/idbMigration";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

// ─────────────────────────────────────────────
// GUARDS ID
// ─────────────────────────────────────────────

/** Vrai ObjectId MongoDB — 24 hex chars */
const isValidObjectId = (id) => /^[a-f\d]{24}$/i.test(String(id || ""));

/** ID mock/temporaire généré côté front (ex: user_9_1776468454348_87280) */
const isMockId = (id) =>
  !isValidObjectId(id) &&
  typeof id === "string" &&
  (id.startsWith("user_") || id.startsWith("post_") || id.startsWith("mock_"));

// ─────────────────────────────────────────────
// CACHE GLOBAL DE POSTS DE PROFILS
// ─────────────────────────────────────────────
const PROFILE_CACHE_TTL = 5 * 60 * 1000;

const getProfilePostsCache = () => {
  if (!window.__profilePostsCache__) window.__profilePostsCache__ = new Map();
  return window.__profilePostsCache__;
};

const storeProfilePostsInCache = (userId, posts) => {
  if (!userId || !Array.isArray(posts) || posts.length === 0) return;
  try {
    const cache = getProfilePostsCache();
    cache.set(userId, { posts, ts: Date.now() });
    if (cache.size > 20) {
      const oldest = [...cache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
      if (oldest) cache.delete(oldest[0]);
    }
    window.dispatchEvent(new CustomEvent("profilePostsCached", {
      detail: { userId, count: posts.length }
    }));
  } catch {}
};

export const readAllCachedProfilePosts = (maxAge = PROFILE_CACHE_TTL) => {
  try {
    const cache = getProfilePostsCache();
    const now = Date.now();
    const seen = new Set();
    const result = [];
    const sorted = [...cache.entries()].sort((a, b) => b[1].ts - a[1].ts);
    for (const [, { posts, ts }] of sorted) {
      if (now - ts > maxAge) continue;
      for (const p of posts) {
        if (!p?._id || seen.has(p._id)) continue;
        seen.add(p._id);
        result.push({ ...p, _fromProfileCache: true });
      }
    }
    return result;
  } catch {
    return [];
  }
};

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

/** v3 FIX : préserve mediaType + textCardPalette pour les text-cards */
const normalizePost = (p) => ({
  _id:             p._id || p.id,
  content:         p.content || "",
  media: Array.isArray(p.media)
    ? p.media.map((m) => ({ url: m?.url || m?.path || m?.location || m, type: m?.type || "image" }))
    : [],
  user: typeof p.user === "object" ? (p.user._id ? p.user : { _id: p.user.id }) : { _id: p.user },
  likes:           p.likes    || [],
  comments:        p.comments || [],
  views:           p.views    || [],
  shares:          p.shares   || [],
  createdAt:       p.createdAt,
  mediaType:       p.mediaType       || null,
  textCardPalette: p.textCardPalette ?? undefined,
  location:        p.location        || null,
  privacy:         p.privacy         || null,
  isOptimistic:    p.isOptimistic    || false,
});

const extractPostsFromResult = (result) => {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  if (Array.isArray(result.posts)) return result.posts;
  if (Array.isArray(result.data)) return result.data;
  if (result.data && Array.isArray(result.data.posts)) return result.data.posts;
  if (result.success && Array.isArray(result.posts)) return result.posts;
  return [];
};

const extractImageUrls = (posts = [], max = 15) => {
  const urls = [];
  for (const p of posts) {
    if (!p.media) continue;
    for (const m of p.media) {
      const url = m?.url || m?.path || m?.location || m;
      if (url && !urls.includes(url)) urls.push(url);
      if (urls.length >= max) break;
    }
    if (urls.length >= max) break;
  }
  return urls.slice(0, max);
};

const isSameUser = (a, b) => {
  if (!a || !b) return false;
  return String(a) === String(b);
};

const extractUserFromResponse = (data) => {
  if (!data) return null;
  if (data.user && (data.user._id || data.user.id)) return data.user;
  if (data._id || data.id) return data;
  return null;
};

/**
 * buildUserFromPost — fallback si GET /users/:id retourne 404
 * Reconstruit le profil depuis l'objet user embarqué dans un post
 */
const buildUserFromPost = (post) => {
  if (!post) return null;
  const u = post.user || {};
  if (!u._id && !u.id) return null;
  return {
    _id:            u._id || u.id,
    username:       u.username     || "utilisateur",
    fullName:       u.fullName     || u.name || "Utilisateur",
    profilePhoto:   u.profilePhoto || u.avatar || null,
    coverPhoto:     u.coverPhoto   || null,
    bio:            u.bio          || "",
    location:       u.location     || "",
    website:        u.website      || "",
    isVerified:     u.isVerified   ?? false,
    isPremium:      u.isPremium    ?? false,
    isBot:          u.isBot        ?? false,
    followersCount: u.followersCount || 0,
    followers:      [],
    following:      [],
    createdAt:      null,
  };
};

/** buildMinimalUser — profil valide même sans posts */
const buildMinimalUser = (uid, partial = {}) => ({
  _id:            uid,
  username:       partial.username      || partial.email?.split("@")[0] || "utilisateur",
  fullName:       partial.fullName      || partial.name || "Utilisateur",
  profilePhoto:   partial.profilePhoto  || partial.avatar || null,
  coverPhoto:     partial.coverPhoto    || null,
  bio:            partial.bio           || "",
  location:       partial.location      || "",
  website:        partial.website       || "",
  isVerified:     partial.isVerified    ?? false,
  isPremium:      partial.isPremium     ?? false,
  isBot:          partial.isBot         ?? false,
  isAutoCreated:  partial.isAutoCreated ?? false,
  followersCount: partial.followersCount || 0,
  followers:      partial.followers     || [],
  following:      partial.following     || [],
  createdAt:      partial.createdAt     || null,
});

/**
 * 🆕 FIX 3 — Construit un profil depuis l'objet user embarqué dans n'importe quel post
 * Cherche dans window.__homePostsPool__ (pool Home) ou dans le cache profil
 * pour trouver un post de cet utilisateur et reconstruire son profil.
 */
const buildProfileFromEmbeddedUser = (targetId) => {
  // 1. Chercher dans le pool Home exposé
  try {
    const homePool = window.__homePostsPool__;
    if (Array.isArray(homePool)) {
      for (const post of homePool) {
        const uid = post?.user?._id || post?.user?.id || post?.author?._id;
        if (uid && String(uid) === String(targetId)) {
          const profile = buildUserFromPost(post);
          if (profile) return { profile, posts: homePool.filter(p => {
            const pid = p?.user?._id || p?.user?.id || p?.author?._id;
            return pid && String(pid) === String(targetId);
          })};
        }
      }
    }
  } catch {}

  // 2. Chercher dans le cache profil
  try {
    const cache = getProfilePostsCache();
    const entry = cache.get(targetId);
    if (entry?.posts?.length > 0) {
      const profile = buildUserFromPost(entry.posts[0]);
      if (profile) return { profile, posts: entry.posts };
    }
  } catch {}

  return null;
};

/**
 * 🆕 FIX 4 — Récupère les posts d'un utilisateur depuis le pool Home
 * sans faire de fetch réseau
 */
const getPostsFromHomePool = (targetId) => {
  try {
    const homePool = window.__homePostsPool__;
    if (!Array.isArray(homePool)) return [];
    return homePool.filter(p => {
      const uid = p?.user?._id || p?.user?.id || p?.author?._id;
      return uid && String(uid) === String(targetId);
    });
  } catch {
    return [];
  }
};

// ─────────────────────────────────────────────
// COMPOSANTS UI
// ─────────────────────────────────────────────
const LoadingSpinner = memo(({ size = "12", darkMode = false, text = "Chargement..." }) => (
  <div className="text-center py-12">
    <div className={`inline-block w-${size} h-${size} border-4 rounded-full animate-spin ${
      darkMode ? "border-orange-400 border-t-transparent" : "border-orange-500 border-t-transparent"
    }`}></div>
    {text && <p className={`mt-4 ${darkMode ? "text-gray-300" : "text-gray-600"}`}>{text}</p>}
  </div>
));
LoadingSpinner.displayName = "LoadingSpinner";

const FollowButton = memo(({ isFollowing, isLoading, onClick, isDarkMode }) => (
  <button
    onClick={onClick}
    disabled={isLoading}
    className={`px-8 py-3 rounded-full font-semibold transition-all duration-200 shadow-md ${
      isFollowing
        ? isDarkMode
          ? "bg-gray-800 text-gray-200 hover:bg-gray-700 border border-white/10"
          : "bg-gray-200 text-gray-700 hover:bg-gray-300"
        : isDarkMode
        ? "bg-orange-600 text-white hover:bg-orange-700"
        : "bg-orange-500 text-white hover:bg-orange-600"
    } disabled:opacity-50 disabled:cursor-not-allowed active:scale-95`}
  >
    {isLoading ? (
      <span className="flex items-center gap-2">
        <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
        Chargement...
      </span>
    ) : isFollowing ? "Se désabonner" : "S'abonner"}
  </button>
));
FollowButton.displayName = "FollowButton";

const Toast = memo(({ message, type }) => (
  <div className={`fixed bottom-6 right-6 px-6 py-3 rounded-lg shadow-2xl transition-all duration-200 z-50 ${
    type === "error" ? "bg-red-500 text-white"
    : type === "info" ? "bg-blue-500 text-white"
    : "bg-green-500 text-white"
  }`}>
    {message}
  </div>
));
Toast.displayName = "Toast";

const EmptyPostsState = memo(({ isOwner, isDarkMode }) => (
  <div className={`text-center py-16 ${isDarkMode ? "text-gray-500" : "text-gray-400"}`}>
    <p className="text-5xl mb-4">📭</p>
    <p className={`text-lg font-semibold mb-2 ${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>
      {isOwner ? "Tu n'as pas encore publié de post" : "Aucun post pour l'instant"}
    </p>
    <p className="text-sm mt-1 max-w-xs mx-auto leading-relaxed">
      {isOwner
        ? "Partage quelque chose avec ta communauté !"
        : "Cet utilisateur n'a encore rien publié. Reviens plus tard !"}
    </p>
  </div>
));
EmptyPostsState.displayName = "EmptyPostsState";

// ─────────────────────────────────────────────
// PROFILE PAGE
// ─────────────────────────────────────────────
export default function ProfilePage({
  initialUser = null,
  initialPosts = null,
  mockHandlers = null,
}) {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user: authUser, loading: authLoading, socket, getToken } = useAuth();
  const { fetchUserPosts: realFetchUserPosts } = usePosts();
  const { isDarkMode } = useDarkMode();

  const isMockProfile = !!mockHandlers;
  const fetchUserPosts = mockHandlers?.fetchUserPosts || realFetchUserPosts;

  const authUserId   = authUser?._id || authUser?.id;
  const targetUserId = userId || authUserId;
  const isOwner      = isSameUser(targetUserId, authUserId);

  const [profileUser,    setProfileUser]    = useState(initialUser || (isOwner ? authUser : null));
  const [profilePosts,   setProfilePosts]   = useState(initialPosts || []);
  const [selectedTab,    setSelectedTab]    = useState("posts");
  const [toast,          setToast]          = useState(null);
  const [followLoading,  setFollowLoading]  = useState(false);
  const [page,           setPage]           = useState(1);
  const [hasMore,        setHasMore]        = useState(true);
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);
  const [isBot,          setIsBot]          = useState(false);
  const [isLoadingUser,  setIsLoadingUser]  = useState(!initialUser && !(isOwner && authUser));
  const [authToken,      setAuthToken]      = useState(null);
  const [userNotFound,   setUserNotFound]   = useState(false);

  const loadingRef        = useRef(false);
  const saveDebounceTimer = useRef(null);
  const writeInProgress   = useRef(false);
  const prefetchTimer     = useRef(null);
  const observer          = useRef();
  const requestCache      = useRef(new Map());
  const CACHE_DURATION    = 30_000;

  const showLocalToast = useCallback((msg, type = "success") => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // ─────────────────────────────────────────────
  // fetchUserById
  // ─────────────────────────────────────────────
  const fetchUserById = useCallback(async (uid) => {
    if (!uid || uid === "undefined" || uid === "null") return null;
    if (!isValidObjectId(uid)) return null;

    const cached = requestCache.current.get(uid);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) return cached.data;
    if (!navigator.onLine) return null;

    try {
      const { data } = await axios.get(`${API_URL}/users/${uid}`, {
        withCredentials: true,
        headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
        timeout: 8000,
      });

      let raw = extractUserFromResponse(data);
      if (!raw && data) raw = data.data || data.user || (data._id || data.id ? data : null);

      if (raw) {
        const normalized = buildMinimalUser(raw._id || raw.id, raw);
        requestCache.current.set(uid, { data: normalized, timestamp: Date.now() });
        return normalized;
      }
      return null;
    } catch (err) {
      if (err.code === "ERR_NETWORK" || err.code === "ECONNABORTED") return null;
      if (err.response?.status === 404) return null;
      if (err.response?.status === 401 || err.response?.status === 403) {
        console.warn(`[Profile] Accès refusé (${err.response.status}) pour ${uid} — profil minimal`);
        return buildMinimalUser(uid);
      }
      console.warn(`[Profile] fetchUserById échoue pour ${uid}:`, err.message);
      return null;
    }
  }, []);

  const tryBuildProfileFromPosts = useCallback(async (uid) => {
    if (!isValidObjectId(uid)) return null;

    // 🆕 FIX 4 — d'abord chercher dans le pool Home (sans réseau)
    const homePostsForUser = getPostsFromHomePool(uid);
    if (homePostsForUser.length > 0) {
      const user = buildUserFromPost(homePostsForUser[0]);
      if (user) return { user, posts: homePostsForUser };
    }

    // Sinon fetch réseau
    try {
      const result = await fetchUserPosts(uid, 1);
      const posts  = extractPostsFromResult(result);
      if (posts.length > 0) {
        const user = buildUserFromPost(posts[0]);
        if (user) return { user, posts };
      }
    } catch (e) {
      console.warn("[Profile] tryBuildProfileFromPosts:", e.message);
    }
    return null;
  }, [fetchUserPosts]);

  const followUser = useCallback(async (uid) => {
    if (mockHandlers?.followUser) return await mockHandlers.followUser(uid);
    const { data } = await axios.post(`${API_URL}/users/${uid}/follow`, {}, { withCredentials: true });
    return data;
  }, [mockHandlers]);

  const unfollowUser = useCallback(async (uid) => {
    if (mockHandlers?.unfollowUser) return await mockHandlers.unfollowUser(uid);
    const { data } = await axios.post(`${API_URL}/users/${uid}/unfollow`, {}, { withCredentials: true });
    return data;
  }, [mockHandlers]);

  const savePosts = useCallback((userKey, posts) => {
    if (isMockProfile || !userKey || !Array.isArray(posts)) return;
    // Ne pas sauvegarder les profils avec ID non-MongoDB
    if (!isValidObjectId(userKey)) return;
    if (saveDebounceTimer.current) clearTimeout(saveDebounceTimer.current);
    saveDebounceTimer.current = setTimeout(async () => {
      if (writeInProgress.current) return;
      writeInProgress.current = true;
      try {
        const safePosts = posts.map(normalizePost);
        await idbSet(`profilePosts_${userKey}`, safePosts);
      } finally {
        writeInProgress.current = false;
      }
    }, 200);
  }, [isMockProfile]);

  const saveUser = useCallback(async (user) => {
    if (isMockProfile || !user?._id) return;
    if (!isValidObjectId(user._id)) return;
    try { await idbSetUser(user._id, user); } catch (err) { console.warn("IDB User Save Error", err); }
  }, [isMockProfile]);

  const handlePostCreated = useCallback(async (newPost) => {
    const normalized = normalizePost(newPost);
    if (!isMockProfile) await syncNewPost(normalized, profileUser._id);
    startTransition(() => setProfilePosts(prev => [normalized, ...prev]));
    showLocalToast("Post publié !");
  }, [profileUser?._id, showLocalToast, isMockProfile]);

  const handlePostDeleted = useCallback(async (postId) => {
    if (!isMockProfile) await syncDeletePost(postId, profileUser._id);
    startTransition(() => setProfilePosts(prev => prev.filter(p => p._id !== postId)));
    showLocalToast("Post supprimé");
  }, [profileUser?._id, showLocalToast, isMockProfile]);

  const handleFollowSuccess = useCallback(() => showLocalToast("Abonné !"), [showLocalToast]);

  // ─────────────────────────────────────────────
  // loadProfilePosts
  // ─────────────────────────────────────────────
  const loadProfilePosts = useCallback(async (targetId, pageNumber = 1, append = false, prefetchedPosts = null) => {
    if (!targetId || loadingRef.current) return;

    // 🆕 FIX 1 — Pour les IDs non-MongoDB, on ne fait pas de fetch réseau
    if (!isValidObjectId(targetId)) {
      console.warn(`[Profile] loadProfilePosts — ID non-MongoDB: ${targetId} — pool local uniquement`);

      // Chercher des posts dans le pool Home
      const localPosts = getPostsFromHomePool(targetId);
      if (localPosts.length > 0) {
        startTransition(() => setProfilePosts(localPosts.map(normalizePost)));
        storeProfilePostsInCache(targetId, localPosts);
      }
      return;
    }

    loadingRef.current = true;
    setIsLoadingPosts(true);

    try {
      let postsArray = [];

      if (prefetchedPosts && !append) {
        postsArray = prefetchedPosts;
        startTransition(() => setProfilePosts(prefetchedPosts));
      }

      if (isMockProfile && initialPosts && !append) {
        postsArray = initialPosts;
        startTransition(() => setProfilePosts(initialPosts));
        storeProfilePostsInCache(targetId, initialPosts);
        return;
      }

      if (!isMockProfile && !append && !prefetchedPosts) {
        try {
          const cached = await getCachedPosts(targetId);
          if (Array.isArray(cached) && cached.length > 0) {
            postsArray = cached;
            startTransition(() => setProfilePosts(cached));
            storeProfilePostsInCache(targetId, cached);
          }
        } catch (e) {
          console.warn("IDB cache read error:", e);
        }
      }

      // 🆕 FIX 4 — Pour les bots, chercher aussi dans le pool Home d'abord
      if (!append && !prefetchedPosts && postsArray.length === 0) {
        const homePostsForUser = getPostsFromHomePool(targetId);
        if (homePostsForUser.length > 0) {
          postsArray = homePostsForUser;
          startTransition(() => setProfilePosts(homePostsForUser.map(normalizePost)));
          storeProfilePostsInCache(targetId, homePostsForUser);
        }
      }

      if (navigator.onLine && !prefetchedPosts) {
        try {
          const result  = await fetchUserPosts(targetId, pageNumber);
          const fetched = extractPostsFromResult(result);
          if (fetched.length > 0) postsArray = fetched;
        } catch (networkErr) {
          console.error("[Profile] Erreur fetch posts réseau:", networkErr);
          if (postsArray.length === 0) showLocalToast("Mode hors ligne", "info");
        }
      }

      setHasMore(postsArray.length >= 20);

      startTransition(() => {
        setProfilePosts(prev => {
          const base        = append ? prev : [];
          const merged      = [...base, ...postsArray];
          const seen        = new Set();
          const uniquePosts = merged
            .filter(p => { if (!p?._id || seen.has(p._id)) return false; seen.add(p._id); return true; })
            .map(normalizePost)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          if (!isMockProfile && isValidObjectId(targetId)) savePosts(targetId, uniquePosts);
          storeProfilePostsInCache(targetId, uniquePosts);
          return uniquePosts;
        });
      });

    } catch (err) {
      console.error("[Profile] loadProfilePosts error:", err);
    } finally {
      loadingRef.current = false;
      setIsLoadingPosts(false);
    }
  }, [fetchUserPosts, savePosts, showLocalToast, isMockProfile, initialPosts]);

  useEffect(() => {
    if (profilePosts.length > 0 && profileUser?._id) {
      storeProfilePostsInCache(profileUser._id, profilePosts);
    }
  }, [profilePosts, profileUser?._id]);

  const lastPostRef = useCallback((node) => {
    if (loadingRef.current) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore && !isLoadingPosts) {
        const nextPage = page + 1;
        setPage(nextPage);
        if (profileUser?._id) loadProfilePosts(profileUser._id, nextPage, true);
      }
    }, { rootMargin: "200px", threshold: 0.1 });
    if (node) observer.current.observe(node);
  }, [page, hasMore, isLoadingPosts, loadProfilePosts, profileUser]);

  const followStatus = profileUser && authUser && !isOwner
    ? (profileUser.followers || []).some(u => isSameUser(typeof u === "object" ? u._id : u, authUserId))
    : null;

  const handleFollowToggle = useCallback(async () => {
    if (!authUser || !profileUser || followLoading) return;
    setFollowLoading(true);
    const wasFollowing = followStatus;
    const newFollowers = wasFollowing
      ? (profileUser.followers || []).filter(u => !isSameUser(typeof u === "object" ? u._id : u, authUserId))
      : [...(profileUser.followers || []), authUserId];
    startTransition(() => setProfileUser(prev => ({ ...prev, followers: newFollowers })));
    try {
      if (wasFollowing) await unfollowUser(profileUser._id);
      else await followUser(profileUser._id);
      showLocalToast(wasFollowing ? "Désabonné !" : "Abonné !");
    } catch (err) {
      console.error("Erreur follow:", err);
      showLocalToast("Erreur lors de l'action", "error");
      const rollback = wasFollowing
        ? [...(profileUser.followers || []), authUserId]
        : (profileUser.followers || []).filter(u => !isSameUser(typeof u === "object" ? u._id : u, authUserId));
      startTransition(() => setProfileUser(prev => ({ ...prev, followers: rollback })));
    } finally {
      setFollowLoading(false);
    }
  }, [authUser, profileUser, followStatus, followLoading, followUser, unfollowUser, showLocalToast, authUserId]);

  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); }, [targetUserId]);

  useEffect(() => {
    if (authUser && getToken) getToken().then(t => setAuthToken(t)).catch(() => {});
  }, [authUser, getToken]);

  useEffect(() => {
    if (isMockProfile) return;
    (async () => {
      try { await registerServiceWorker(); } catch {}
      try { await setupIndexedDB(); } catch {}
    })();
  }, [isMockProfile]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (prefetchTimer.current) clearTimeout(prefetchTimer.current);
    prefetchTimer.current = setTimeout(() => {
      const urls = extractImageUrls(profilePosts, 15);
      if (urls.length) prefetchImagesViaSW(urls);
    }, 300);
    return () => clearTimeout(prefetchTimer.current);
  }, [profilePosts]);

  useEffect(() => {
    const handleOnline = () => {
      if (profileUser?._id && isValidObjectId(profileUser._id)) {
        loadProfilePosts(profileUser._id, 1, false);
      }
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [profileUser?._id, loadProfilePosts]);

  // ─────────────────────────────────────────────
  // useEffect principal — v4
  // ─────────────────────────────────────────────
  useEffect(() => {
    if (authLoading) return;
    if (!authUser) { navigate("/auth", { replace: true }); return; }

    if (initialUser) {
      setProfileUser(initialUser);
      setIsBot(!!initialUser.isBot);
      setIsLoadingUser(false);
      setUserNotFound(false);
      if (targetUserId && isValidObjectId(targetUserId)) {
        loadProfilePosts(targetUserId, 1, false);
      }
      return;
    }

    if (!targetUserId || targetUserId === "undefined") {
      setIsLoadingUser(false);
      setUserNotFound(true);
      return;
    }

    // ─────────────────────────────────────────────
    // 🆕 FIX 1 — ID mock/temporaire (ex: user_9_...)
    // Pas de fetch réseau, on reconstruit depuis le pool Home
    // ─────────────────────────────────────────────
    if (isMockId(targetUserId)) {
      console.log(`[Profile] ID mock détecté (${targetUserId}) — reconstruction depuis pool local`);
      const result = buildProfileFromEmbeddedUser(targetUserId);

      if (result) {
        setProfileUser(result.profile);
        setIsBot(!!result.profile.isBot);
        setIsLoadingUser(false);
        setUserNotFound(false);
        if (result.posts.length > 0) {
          startTransition(() => setProfilePosts(result.posts.map(normalizePost)));
          storeProfilePostsInCache(targetUserId, result.posts);
        }
      } else {
        // Profil mock non trouvé dans le pool — afficher un profil vide plutôt que "introuvable"
        setProfileUser(buildMinimalUser(targetUserId, { username: "utilisateur", fullName: "Utilisateur" }));
        setIsBot(false);
        setIsLoadingUser(false);
        setUserNotFound(false);
        showLocalToast("Profil de démonstration", "info");
      }
      return;
    }

    // ID non-MongoDB non-mock (cas improbable)
    if (!isValidObjectId(targetUserId)) {
      if (isOwner) {
        // Si c'est le compte courant avec ID temporaire
        setProfileUser(authUser);
        setIsBot(false);
        setIsLoadingUser(false);
        setUserNotFound(false);
      } else {
        setIsLoadingUser(false);
        setUserNotFound(true);
      }
      return;
    }

    // ─────────────────────────────────────────────
    // Flux normal — ID MongoDB valide
    // ─────────────────────────────────────────────
    (async () => {
      setIsLoadingUser(true);
      setUserNotFound(false);

      try {
        await idbClearOtherKeys(`profilePosts_${targetUserId}`);

        if (isOwner) {
          setProfileUser(authUser);
          setIsBot(false);
          setUserNotFound(false);
          saveUser(authUser);
          if (navigator.onLine) {
            fetchUserById(authUserId).then(fresh => {
              if (fresh) { setProfileUser(fresh); saveUser(fresh); }
            }).catch(() => {});
          }

        } else {
          const cachedUser = await idbGetUser(targetUserId);
          if (cachedUser) {
            setProfileUser(buildMinimalUser(cachedUser._id || cachedUser.id, cachedUser));
            setIsBot(!!cachedUser.isBot);
            setUserNotFound(false);
          }

          if (navigator.onLine) {
            const fetchedUser = await fetchUserById(targetUserId);

            if (fetchedUser) {
              setProfileUser(fetchedUser);
              setIsBot(!!fetchedUser.isBot);
              setUserNotFound(false);
              saveUser(fetchedUser);

            } else if (!cachedUser) {
              // 🆕 FIX 2 — Chercher d'abord dans le pool Home (bots + posts récents)
              const embeddedResult = buildProfileFromEmbeddedUser(targetUserId);
              if (embeddedResult) {
                setProfileUser(embeddedResult.profile);
                setIsBot(!!embeddedResult.profile.isBot);
                setUserNotFound(false);
                saveUser(embeddedResult.profile);
                if (embeddedResult.posts.length > 0) {
                  startTransition(() => setProfilePosts(embeddedResult.posts.map(normalizePost)));
                  storeProfilePostsInCache(targetUserId, embeddedResult.posts);
                }
                // Essayer quand même de charger plus de posts réseau
                setPage(1);
                setHasMore(true);
                await loadProfilePosts(targetUserId, 1, false);
                return;
              }

              // Fallback fetch posts réseau
              const fallback = await tryBuildProfileFromPosts(targetUserId);

              if (fallback) {
                setProfileUser(fallback.user);
                setIsBot(!!fallback.user.isBot);
                setUserNotFound(false);
                saveUser(fallback.user);
                setPage(1);
                setHasMore(fallback.posts.length >= 20);
                await loadProfilePosts(targetUserId, 1, false, fallback.posts);
                return;
              } else {
                if (isValidObjectId(targetUserId)) {
                  console.warn(`[Profile] Profil réseau indisponible pour ${targetUserId} — profil vide`);
                  setProfileUser(buildMinimalUser(targetUserId));
                  setIsBot(false);
                  setUserNotFound(false);
                  showLocalToast("Profil partiellement disponible", "info");
                } else {
                  setUserNotFound(true);
                }
              }
            }

          } else if (!cachedUser) {
            if (isValidObjectId(targetUserId)) {
              // Hors ligne — tenter le pool Home
              const embeddedResult = buildProfileFromEmbeddedUser(targetUserId);
              if (embeddedResult) {
                setProfileUser(embeddedResult.profile);
                setIsBot(!!embeddedResult.profile.isBot);
                setUserNotFound(false);
                if (embeddedResult.posts.length > 0) {
                  startTransition(() => setProfilePosts(embeddedResult.posts.map(normalizePost)));
                }
              } else {
                setProfileUser(buildMinimalUser(targetUserId));
                setIsBot(false);
                setUserNotFound(false);
                showLocalToast("Profil non disponible hors ligne", "info");
              }
            } else {
              setUserNotFound(true);
            }
          }
        }

        setPage(1);
        setHasMore(true);
        await loadProfilePosts(targetUserId, 1, false);

      } catch (err) {
        console.error("Profil Load Error:", err);
        if (!profileUser && isValidObjectId(targetUserId)) {
          setProfileUser(buildMinimalUser(targetUserId));
          setUserNotFound(false);
        }
        showLocalToast("Erreur lors du chargement", "error");
      } finally {
        setIsLoadingUser(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, authUser?._id, targetUserId, isOwner]);

  // ── Socket temps réel ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket || !profileUser || isMockProfile || isBot) return;
    const handleNewPost = (post) => {
      const postUserId = typeof post.user === "object" ? post.user._id : post.user;
      if (!isSameUser(postUserId, profileUser._id)) return;
      startTransition(() => {
        setProfilePosts(prev => {
          if (prev.find(p => p._id === post._id)) return prev;
          const updated = [normalizePost(post), ...prev];
          savePosts(profileUser._id, updated);
          storeProfilePostsInCache(profileUser._id, updated);
          return updated;
        });
      });
    };
    const handleDeletedPost = (postId) => {
      startTransition(() => {
        setProfilePosts(prev => {
          const updated = prev.filter(p => p._id !== postId);
          savePosts(profileUser._id, updated);
          storeProfilePostsInCache(profileUser._id, updated);
          return updated;
        });
      });
    };
    const handleUpdatedPost = (post) => {
      startTransition(() => {
        setProfilePosts(prev => {
          const updated = prev.map(p => p._id === post._id ? normalizePost(post) : p);
          savePosts(profileUser._id, updated);
          storeProfilePostsInCache(profileUser._id, updated);
          return updated;
        });
      });
    };
    socket.on("newPost",     handleNewPost);
    socket.on("postDeleted", handleDeletedPost);
    socket.on("postUpdated", handleUpdatedPost);
    return () => {
      socket.off("newPost",     handleNewPost);
      socket.off("postDeleted", handleDeletedPost);
      socket.off("postUpdated", handleUpdatedPost);
    };
  }, [socket, profileUser?._id, savePosts, isMockProfile, isBot]);

  const stats = {
    posts:     profilePosts.length,
    followers: profileUser?.followers?.length || profileUser?.followersCount || 0,
    following: profileUser?.following?.length || profileUser?.followingCount || 0,
  };

  // ── Rendu ──────────────────────────────────────────────────────────────────

  if (authLoading || (isLoadingUser && !profileUser)) {
    return (
      <div className={`profile-page min-h-screen p-4 flex items-center justify-center transition-colors duration-200 ${
        isDarkMode ? "bg-black" : "bg-orange-50"
      }`}>
        <LoadingSpinner darkMode={isDarkMode} />
      </div>
    );
  }

  if (userNotFound || (!profileUser && !isLoadingUser)) {
    return (
      <div className={`profile-page min-h-screen p-4 flex items-center justify-center transition-colors duration-200 ${
        isDarkMode ? "bg-black" : "bg-orange-50"
      }`}>
        <div className="text-center">
          <p className="text-5xl mb-4">🔍</p>
          <p className={`text-lg font-medium mb-4 ${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>
            Profil introuvable
          </p>
          <button
            onClick={() => navigate(-1)}
            className="px-6 py-2 bg-orange-500 text-white rounded-full font-semibold hover:bg-orange-600 transition"
          >
            Retour
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`profile-page min-h-screen p-4 transition-colors duration-200 ${
      isDarkMode ? "bg-black" : "bg-orange-50"
    }`}>
      {isMockProfile && (
        <div className="max-w-7xl mx-auto mb-4">
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg px-4 py-3">
            <p className="text-sm text-blue-500 text-center flex items-center justify-center gap-2">
              <span>👤</span>
              <span>Profil de démonstration — Toutes les interactions sont simulées</span>
            </p>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <ProfileHeader
            user={profileUser}
            isOwnProfile={isOwner}
            posts={profilePosts}
            followers={profileUser.followers || []}
            following={profileUser.following || []}
            showToast={showLocalToast}
          />

          {!isOwner && (
            <div className="text-center">
              <FollowButton
                isFollowing={followStatus}
                isLoading={followLoading}
                onClick={handleFollowToggle}
                isDarkMode={isDarkMode}
              />
            </div>
          )}

          {isOwner && authUser && authToken && (
            <div className="lg:hidden">
              <ProfileSuggestions
                currentUser={authUser}
                token={authToken}
                isDarkMode={isDarkMode}
                maxSuggestions={3}
                onFollowSuccess={handleFollowSuccess}
              />
            </div>
          )}

          <ProfileMenu
            selectedTab={selectedTab}
            onSelectTab={setSelectedTab}
            isOwner={isOwner}
            stats={stats}
          />

          {selectedTab === "posts" && (
            <div>
              {isOwner && !isMockProfile && !isBot && (
                <div className="mb-4">
                  <CreatePost
                    user={authUser}
                    onPostCreated={handlePostCreated}
                    showToast={showLocalToast}
                  />
                </div>
              )}

              {isLoadingPosts && profilePosts.length === 0 ? (
                <LoadingSpinner darkMode={isDarkMode} text="Chargement des posts..." />
              ) : profilePosts.length === 0 && !isLoadingPosts ? (
                <EmptyPostsState isOwner={isOwner} isDarkMode={isDarkMode} />
              ) : (
                <div>
                  {profilePosts.map((post, index) => (
                    <div
                      key={post._id}
                      ref={index === profilePosts.length - 1 ? lastPostRef : null}
                    >
                      <PostCard
                        post={post}
                        onDeleted={handlePostDeleted}
                        showToast={showLocalToast}
                        mockPost={isMockProfile}
                      />
                    </div>
                  ))}

                  {isLoadingPosts && (
                    <div className="text-center py-4">
                      <div className={`inline-block w-8 h-8 border-4 rounded-full animate-spin ${
                        isDarkMode
                          ? "border-orange-400 border-t-transparent"
                          : "border-orange-500 border-t-transparent"
                      }`}></div>
                    </div>
                  )}

                  {!hasMore && profilePosts.length > 0 && (
                    <p className={`text-center py-4 text-sm ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
                      Plus de posts
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {selectedTab === "settings" && isOwner && !isBot && (
            <SettingsSection user={authUser} showToast={showLocalToast} />
          )}
        </div>

        {isOwner && !isBot && authUser && authToken && (
          <div className="hidden lg:block lg:col-span-1">
            <div className="sticky top-4">
              <ProfileSuggestions
                currentUser={authUser}
                token={authToken}
                isDarkMode={isDarkMode}
                maxSuggestions={5}
                onFollowSuccess={handleFollowSuccess}
              />
            </div>
          </div>
        )}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}