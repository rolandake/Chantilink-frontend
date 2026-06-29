// src/pages/profile/ProfilePage.jsx
// v8.8 — profil pro : isPro transmis à ProfileMenu + onglet "cv" géré dans renderContent
//   - isPro={effectiveProfileUser?.accountType === "pro"} passé à <ProfileMenu>
//   - renderContent() gère selectedTab === "cv" → <ProCVView>
//   - Pas d'onglet "Projets" (non pertinent pour le profil pro)

import React, { useState, useEffect, useCallback, useRef, memo, startTransition } from "react";
import { motion } from "framer-motion";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import ProfileHeader from "./ProfileHeader";
import ProfileMenu from "./ProfileMenu";
import ProfileMediaGrid from "./ProfileMediaGrid";
import SettingsSection from "./SettingsSection";
import CreatePost from "../Home/CreatePost";
import PostCard from "../Home/PostCard";
import ProCVView from "./Pro/ProCVView"; // ✅ NOUVEAU
import { usePosts } from "../../context/PostsContext";
import { useAuth } from "../../context/AuthContext";
import { useDarkMode } from "../../context/DarkModeContext";
import { registerServiceWorker, prefetchImagesViaSW } from "../../utils/swRegister";
import { syncNewPost, syncDeletePost, getCachedPosts } from "../../utils/cacheSync";
import axios from "axios";
import { PROFILE_BACKEND_BASE } from "./profileApi";
import {
  setupIndexedDB,
  idbGetProfilePosts as idbGet,
  idbSetProfilePosts as idbSet,
  idbClearOtherKeysProfilePosts as idbClearOtherKeys,
  idbSetProfileUser as idbSetUser,
  idbGetProfileUser as idbGetUser,
} from "../../utils/idbMigration";

const BASE_URL = PROFILE_BACKEND_BASE;

// ─────────────────────────────────────────────────────────────────────────────
// GUARDS ID
// ─────────────────────────────────────────────────────────────────────────────
const isValidObjectId = (id) => /^[a-f\d]{24}$/i.test(String(id || ""));
const isMockId = (id) =>
  !isValidObjectId(id) &&
  typeof id === "string" &&
  (id.startsWith("user_") || id.startsWith("post_") || id.startsWith("mock_"));

// ─────────────────────────────────────────────────────────────────────────────
// CACHE GLOBAL
// ─────────────────────────────────────────────────────────────────────────────
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
    window.dispatchEvent(new CustomEvent("profilePostsCached", { detail: { userId, count: posts.length } }));
  } catch {}
};

export const readAllCachedProfilePosts = (maxAge = PROFILE_CACHE_TTL) => {
  try {
    const cache = getProfilePostsCache();
    const now = Date.now();
    const seen = new Set();
    const result = [];
    const sorted = [...cache.entries()].sort((a, b) => b[1].ts - a[1].ts);
    for (const [userId, { posts, ts }] of sorted) {
      if (now - ts > maxAge) continue;
      for (const p of posts) {
        if (!p?._id || seen.has(p._id)) continue;
        seen.add(p._id);
        result.push({
          ...p,
          _fromProfileCache: true,
          _profileCacheUserId: userId,
          _profileCacheLoadedAt: ts,
          _shouldIsolateFromHomeFeed: true,
        });
      }
    }
    return result;
  } catch { return []; }
};

export const clearProfilePostsCache = () => {
  if (typeof window !== "undefined") {
    try {
      window.__profilePostsCache__ = new Map();
      console.log("✅ [ProfilePage] Cache des posts du profil nettoyé");
    } catch {}
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const normalizePost = (p) => {
  const rawUser = p.user || p.auteur || p.author || {};
  const normalizedUser = typeof rawUser === "object"
    ? {
        ...(rawUser || {}),
        _id: rawUser._id || rawUser.id || p.userId || p.owner || p.createdBy,
        fullName: rawUser.fullName || rawUser.name || p.fullName || "Utilisateur",
        profilePhoto: rawUser.profilePhoto || rawUser.avatar || p.userProfilePhoto || null,
      }
    : { _id: rawUser || p.userId || p.owner || p.createdBy, fullName: p.fullName || "Utilisateur" };

  return {
    _id:             p._id || p.id,
    content:         p.content || p.contenu || "",
    contenu:         p.contenu || p.content || "",
    media: Array.isArray(p.media)
      ? p.media.map((m) => ({ url: m?.url || m?.path || m?.location || m, type: m?.type || p.mediaType || "image" }))
      : [],
    user:            normalizedUser,
    author:          p.author || p.auteur || normalizedUser,
    userId:          p.userId || normalizedUser._id,
    likes:           p.likes    || [],
    comments:        p.comments || [],
    views:           p.views    || [],
    shares:          p.shares   || [],
    likesCount:      p.likesCount,
    commentsCount:   p.commentsCount,
    viewsCount:      p.viewsCount,
    sharesCount:     p.sharesCount,
    createdAt:       p.createdAt,
    updatedAt:       p.updatedAt,
    mediaType:       p.mediaType       || null,
    textCardPalette: p.textCardPalette ?? undefined,
    location:        p.location        || null,
    privacy:         p.privacy         || null,
    isBoosted:       !!p.isBoosted,
    isOptimistic:    p.isOptimistic    || false,
  };
};

const extractPostsFromResult = (result) => {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  if (Array.isArray(result.posts)) return result.posts;
  if (Array.isArray(result.data)) return result.data;
  if (result.data && Array.isArray(result.data.posts)) return result.data.posts;
  if (result.success && Array.isArray(result.posts)) return result.posts;
  return [];
};

const profileDebug = (...args) => {
  if (import.meta.env?.DEV) console.log("[ProfileDebug]", ...args);
};

const withTimeout = (promise, ms, fallbackValue) =>
  Promise.race([
    promise,
    new Promise(resolve => setTimeout(() => resolve(fallbackValue), ms)),
  ]);

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
  accountType:    partial.accountType   || "personal",
  businessInfo:   partial.businessInfo  || null,
  proInfo:        partial.proInfo       || null, // ✅ préservé
});

const buildProfileFromEmbeddedUser = (targetId) => {
  try {
    const homePool = window.__homePostsPool__;
    if (Array.isArray(homePool)) {
      for (const post of homePool) {
        const uid = post?.user?._id || post?.user?.id || post?.author?._id;
        if (uid && String(uid) === String(targetId)) {
          const profile = buildUserFromPost(post);
          if (profile) return {
            profile,
            posts: homePool.filter(p => {
              const pid = p?.user?._id || p?.user?.id || p?.author?._id;
              return pid && String(pid) === String(targetId);
            }),
          };
        }
      }
    }
  } catch {}
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

const getPostsFromHomePool = (targetId) => {
  try {
    const homePool = window.__homePostsPool__;
    if (!Array.isArray(homePool)) return [];
    return homePool.filter(p => {
      const uid = p?.user?._id || p?.user?.id || p?.author?._id;
      return uid && String(uid) === String(targetId);
    });
  } catch { return []; }
};

const isVideoPost = (post) => {
  if (!post) return false;
  if (String(post.mediaType || "").toLowerCase().includes("video")) return true;
  const media = Array.isArray(post.media) ? post.media : [];
  return media.some((m) => {
    const type = String(m?.type || "").toLowerCase();
    const url = String(m?.url || m?.path || m?.location || m || "").toLowerCase().split("?")[0];
    return type.includes("video") || /\.(mp4|webm|mov|avi|mkv|flv|m4v)$/i.test(url) || /\/videos?\//i.test(url);
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSANTS UI
// ─────────────────────────────────────────────────────────────────────────────

const LoadingSpinner = memo(({ darkMode = false, text = "Chargement..." }) => (
  <div style={{ textAlign: "center", padding: "48px 0", fontFamily: "'Sora','DM Sans',sans-serif" }}>
    <div style={{
      display: "inline-block", width: 44, height: 44,
      border: `4px solid ${darkMode ? "rgba(249,115,22,0.2)" : "rgba(249,115,22,0.15)"}`,
      borderTopColor: "#f97316",
      borderRadius: "50%",
      animation: "spin 0.8s linear infinite",
    }} />
    {text && <p style={{ marginTop: 14, color: darkMode ? "#6b7280" : "#9ca3af", fontSize: 14 }}>{text}</p>}
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
));
LoadingSpinner.displayName = "LoadingSpinner";

const FollowButton = memo(({ isFollowing, isLoading, onClick, isDarkMode }) => (
  <motion.button
    onClick={onClick}
    disabled={isLoading}
    whileHover={{ scale: isLoading ? 1 : 1.04, y: isLoading ? 0 : -1 }}
    whileTap={{ scale: isLoading ? 1 : 0.97 }}
    style={{
      width: "100%",
      minHeight: 36,
      padding: "8px 14px",
      borderRadius: 999,
      fontFamily: "'Sora','DM Sans',sans-serif",
      fontWeight: 700,
      fontSize: 14,
      cursor: isLoading ? "not-allowed" : "pointer",
      border: isFollowing
        ? `1px solid ${isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`
        : "none",
      background: isFollowing
        ? (isDarkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)")
        : "linear-gradient(135deg,#f97316,#ec4899)",
      color: isFollowing ? (isDarkMode ? "#9ca3af" : "#6b7280") : "#fff",
      boxShadow: "none",
      opacity: isLoading ? 0.7 : 1,
      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
      transition: "all 0.2s",
    }}
  >
    {isLoading ? (
      <>
        <span style={{
          display: "inline-block", width: 16, height: 16,
          border: "2px solid currentColor", borderTopColor: "transparent",
          borderRadius: "50%", animation: "spin 0.8s linear infinite",
        }} />
        Chargement...
      </>
    ) : isFollowing ? "Se désabonner" : "S'abonner"}
  </motion.button>
));
FollowButton.displayName = "FollowButton";

const Toast = memo(({ message, type }) => {
  const bg = type === "error"
    ? "#ef4444"
    : type === "info"
    ? "#3b82f6"
    : "linear-gradient(135deg,#22c55e,#16a34a)";
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.95 }}
      style={{
        position: "fixed", bottom: 28, right: 28,
        padding: "12px 22px", borderRadius: 16,
        background: bg, color: "#fff",
        fontFamily: "'Sora','DM Sans',sans-serif",
        fontWeight: 600, fontSize: 14,
        boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
        zIndex: 9999, maxWidth: 340,
        border: "1px solid rgba(255,255,255,0.15)",
      }}
    >
      {message}
    </motion.div>
  );
});
Toast.displayName = "Toast";

const EmptyPostsState = memo(({ isOwner, isDarkMode }) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    style={{ textAlign: "center", padding: "56px 24px", fontFamily: "'Sora','DM Sans',sans-serif" }}
  >
    <div style={{ fontSize: 52, marginBottom: 16 }}>📭</div>
    <p style={{ fontSize: 17, fontWeight: 700, color: isDarkMode ? "#d1d5db" : "#374151", marginBottom: 8 }}>
      {isOwner ? "Tu n'as pas encore publié de post" : "Aucun post pour l'instant"}
    </p>
    <p style={{ fontSize: 13, color: isDarkMode ? "#6b7280" : "#9ca3af", maxWidth: 280, margin: "0 auto", lineHeight: 1.7 }}>
      {isOwner
        ? "Partage quelque chose avec ta communauté !"
        : "Cet utilisateur n'a encore rien publié. Reviens plus tard !"}
    </p>
  </motion.div>
));
EmptyPostsState.displayName = "EmptyPostsState";

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE PAGE — export default
// ─────────────────────────────────────────────────────────────────────────────
export default function ProfilePage({
  initialUser  = null,
  initialPosts = null,
  mockHandlers = null,
}) {
  const { userId } = useParams();
  const navigate   = useNavigate();
  const location   = useLocation();

  const navInstantUserRef = useRef(location.state?.instantUser || null);
  const navInstantUser    = navInstantUserRef.current;

  const { user: authUser, loading: authLoading, socket, getToken } = useAuth();
  const { fetchUserPosts: realFetchUserPosts } = usePosts();
  const { isDarkMode } = useDarkMode();

  const isMockProfile  = !!mockHandlers;
  const fetchUserPosts = mockHandlers?.fetchUserPosts || realFetchUserPosts;

  const authUserId   = authUser?._id || authUser?.id;
  const targetUserId = userId || authUserId;
  const isOwner      = isSameUser(targetUserId, authUserId);

  const [profileUser,    setProfileUser]    = useState(
    initialUser || navInstantUser || (isOwner ? authUser : null)
  );
  const [profilePosts,   setProfilePosts]   = useState(initialPosts || []);
  const [selectedTab,    setSelectedTab]    = useState("feed");
  const [toast,          setToast]          = useState(null);
  const [followLoading,  setFollowLoading]  = useState(false);
  const [page,           setPage]           = useState(1);
  const [hasMore,        setHasMore]        = useState(true);
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);
  const [isBot,          setIsBot]          = useState(false);
  const [isLoadingUser,  setIsLoadingUser]  = useState(
    !initialUser && !navInstantUser && !(isOwner && authUser)
  );
  const [userNotFound, setUserNotFound] = useState(false);

  const silentRevalidatedRef = useRef(false);
  const loadingRef           = useRef(false);
  const saveDebounceTimer    = useRef(null);
  const writeInProgress      = useRef(false);
  const prefetchTimer        = useRef(null);
  const observer             = useRef();
  const requestCache         = useRef(new Map());
  const CACHE_DURATION       = 30_000;

  // ── Toast ──────────────────────────────────────────────────────────────────
  const showLocalToast = useCallback((msg, type = "success") => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // ── Sync authUser -> profileUser quand owner ───────────────────────────────
  useEffect(() => {
    if (!isOwner || !authUser) return;
    const uid = authUser._id || authUser.id;
    if (uid) requestCache.current.delete(String(uid));
    setProfileUser(prev => ({ ...(prev || {}), ...authUser }));
    if (!isMockProfile && uid && isValidObjectId(uid)) {
      idbSetUser(uid, authUser).catch(err => console.warn("IDB User Save Error", err));
    }
  }, [
    isOwner,
    authUser?._id,
    authUser?.profilePhoto,
    authUser?.coverPhoto,
    authUser?.fullName,
    authUser?.username,
    authUser?.bio,
    authUser?.location,
    authUser?.website,
    isMockProfile,
  ]);

  // ── Helper : headers Authorization Bearer ─────────────────────────────────
  const getAuthHeaders = useCallback(async () => {
    const currentToken = await getToken?.();
    if (!currentToken) throw new Error("Token manquant");
    return {
      Authorization: `Bearer ${currentToken}`,
      "Content-Type": "application/json",
    };
  }, [getToken]);

  // ── fetchUserById ──────────────────────────────────────────────────────────
  const fetchUserById = useCallback(async (uid) => {
    if (!uid || uid === "undefined" || uid === "null") return null;
    if (!isValidObjectId(uid)) return null;
    const cached = requestCache.current.get(uid);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) return cached.data;
    if (!navigator.onLine) return null;
    try {
      const currentToken = await getToken?.();
      const { data } = await axios.get(`${BASE_URL}/api/users/${uid}`, {
        withCredentials: true,
        timeout: 8000,
        headers: currentToken ? { Authorization: `Bearer ${currentToken}` } : {},
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
      if (err.response?.status === 401 || err.response?.status === 403) return buildMinimalUser(uid);
      return null;
    }
  }, [getToken]);

  const tryBuildProfileFromPosts = useCallback(async (uid) => {
    if (!isValidObjectId(uid)) return null;
    const homePostsForUser = getPostsFromHomePool(uid);
    if (homePostsForUser.length > 0) {
      const user = buildUserFromPost(homePostsForUser[0]);
      if (user) return { user, posts: homePostsForUser };
    }
    try {
      const result = await fetchUserPosts(uid, 1);
      const posts  = extractPostsFromResult(result);
      if (posts.length > 0) {
        const user = buildUserFromPost(posts[0]);
        if (user) return { user, posts };
      }
    } catch (e) { console.warn("[Profile] tryBuildProfileFromPosts:", e.message); }
    return null;
  }, [fetchUserPosts]);

  // ── followUser / unfollowUser (même endpoint toggle) ──────────────────────
  const followUser = useCallback(async (uid) => {
    if (mockHandlers?.followUser) return await mockHandlers.followUser(uid);
    const headers = await getAuthHeaders();
    const { data } = await axios.post(
      `${BASE_URL}/api/users/${uid}/follow`,
      {},
      { headers, withCredentials: true, timeout: 8000 }
    );
    return data;
  }, [mockHandlers, getAuthHeaders]);

  const unfollowUser = useCallback(async (uid) => {
    if (mockHandlers?.unfollowUser) return await mockHandlers.unfollowUser(uid);
    const headers = await getAuthHeaders();
    const { data } = await axios.post(
      `${BASE_URL}/api/users/${uid}/follow`,
      {},
      { headers, withCredentials: true, timeout: 8000 }
    );
    return data;
  }, [mockHandlers, getAuthHeaders]);

  // ── savePosts / saveUser (IDB) ─────────────────────────────────────────────
  const savePosts = useCallback((userKey, posts) => {
    if (isMockProfile || !userKey || !Array.isArray(posts)) return;
    if (!isValidObjectId(userKey)) return;
    if (saveDebounceTimer.current) clearTimeout(saveDebounceTimer.current);
    saveDebounceTimer.current = setTimeout(async () => {
      if (writeInProgress.current) return;
      writeInProgress.current = true;
      try { await idbSet(`profilePosts_${userKey}`, posts.map(normalizePost)); }
      finally { writeInProgress.current = false; }
    }, 200);
  }, [isMockProfile]);

  const saveUser = useCallback(async (user) => {
    if (isMockProfile || !user?._id || !isValidObjectId(user._id)) return;
    try { await idbSetUser(user._id, user); } catch (err) { console.warn("IDB User Save Error", err); }
  }, [isMockProfile]);

  // ── handleProfileUserUpdated ───────────────────────────────────────────────
  const handleProfileUserUpdated = useCallback((updatedUser) => {
    if (!updatedUser) return;
    const updatedId = updatedUser._id || updatedUser.id || profileUser?._id;
    if (!updatedId) return;

    requestCache.current.delete(String(updatedId));

    startTransition(() => {
      setProfileUser(prev => ({
        ...(prev || {}),
        ...updatedUser,
        _id: updatedId,
        accountType:  updatedUser.accountType  ?? prev?.accountType,
        businessInfo: updatedUser.businessInfo ?? prev?.businessInfo,
        proInfo:      updatedUser.proInfo      ?? prev?.proInfo, // ✅ préservé
      }));
    });

    saveUser({ ...(profileUser || {}), ...updatedUser, _id: updatedId });
  }, [profileUser, saveUser]);

  // ── Post lifecycle ─────────────────────────────────────────────────────────
  const handlePostCreated = useCallback(async (newPost) => {
    const normalized = normalizePost(newPost);
    const ownerId = profileUser?._id || targetUserId || authUserId;
    if (!isMockProfile && ownerId) await syncNewPost(normalized, ownerId);
    startTransition(() => setProfilePosts(prev => [normalized, ...prev]));
    showLocalToast("Post publié !");
  }, [profileUser?._id, targetUserId, authUserId, showLocalToast, isMockProfile]);

  const handlePostDeleted = useCallback(async (postId) => {
    if (!isMockProfile) await syncDeletePost(postId, profileUser._id);
    startTransition(() => setProfilePosts(prev => prev.filter(p => p._id !== postId)));
    showLocalToast("Post supprimé");
  }, [profileUser?._id, showLocalToast, isMockProfile]);

  // ── loadProfilePosts ───────────────────────────────────────────────────────
  const loadProfilePosts = useCallback(async (targetId, pageNumber = 1, append = false, prefetchedPosts = null) => {
    if (!targetId || loadingRef.current) return;
    if (!isValidObjectId(targetId)) {
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
          const cached = await withTimeout(getCachedPosts(targetId), 1200, []);
          if (Array.isArray(cached) && cached.length > 0) {
            postsArray = cached;
            startTransition(() => setProfilePosts(cached));
            Promise.resolve(storeProfilePostsInCache(targetId, cached)).catch(() => {});
          }
        } catch (e) { console.warn("IDB cache read error:", e); }
      }

      if (!append && !prefetchedPosts && postsArray.length === 0) {
        const homePostsForUser = getPostsFromHomePool(targetId);
        if (homePostsForUser.length > 0) {
          postsArray = homePostsForUser;
          startTransition(() => setProfilePosts(homePostsForUser.map(normalizePost)));
          Promise.resolve(storeProfilePostsInCache(targetId, homePostsForUser)).catch(() => {});
        }
      }

      if (navigator.onLine && !prefetchedPosts) {
        try {
          const result  = await Promise.race([
            fetchUserPosts(targetId, pageNumber),
            new Promise(resolve => setTimeout(() => resolve([]), 10000)),
          ]);
          const fetched = extractPostsFromResult(result);
          if (fetched.length > 0) postsArray = fetched;
        } catch (err) {
          if (postsArray.length === 0) showLocalToast("Mode hors ligne", "info");
        }
      }

      setHasMore(postsArray.length >= 20);
      startTransition(() => {
        setProfilePosts(prev => {
          const base   = append ? prev : [];
          const merged = [...base, ...postsArray];
          const seen   = new Set();
          const unique = merged
            .filter(p => { if (!p?._id || seen.has(p._id)) return false; seen.add(p._id); return true; })
            .map(normalizePost)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          if (!isMockProfile && isValidObjectId(targetId)) savePosts(targetId, unique);
          storeProfilePostsInCache(targetId, unique);
          return unique;
        });
      });
    } catch (err) { console.error("[Profile] loadProfilePosts error:", err); }
    finally {
      loadingRef.current = false;
      setIsLoadingPosts(false);
    }
  }, [fetchUserPosts, savePosts, showLocalToast, isMockProfile, initialPosts]);

  useEffect(() => {
    if (!isLoadingPosts) return;
    const timer = setTimeout(() => {
      loadingRef.current = false;
      setIsLoadingPosts(false);
      if (profilePosts.length === 0) setHasMore(false);
    }, 12000);
    return () => clearTimeout(timer);
  }, [isLoadingPosts, profilePosts.length]);

  useEffect(() => {
    if (profilePosts.length > 0 && profileUser?._id)
      storeProfilePostsInCache(profileUser._id, profilePosts);
  }, [profilePosts, profileUser?._id]);

  // ── Infinite scroll ────────────────────────────────────────────────────────
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

  // ── Follow status ──────────────────────────────────────────────────────────
  const followStatus = profileUser && authUser && !isOwner
    ? (profileUser.followers || []).some(u =>
        isSameUser(typeof u === "object" ? u._id : u, authUserId)
      )
    : null;

  // ── handleFollowToggle ─────────────────────────────────────────────────────
  const handleFollowToggle = useCallback(async () => {
    if (!authUser || !profileUser || followLoading) return;
    if (!isValidObjectId(profileUser._id)) {
      showLocalToast("Action impossible sur ce profil", "error");
      return;
    }
    setFollowLoading(true);
    const wasFollowing = followStatus;
    const newFollowers = wasFollowing
      ? (profileUser.followers || []).filter(
          u => !isSameUser(typeof u === "object" ? u._id : u, authUserId)
        )
      : [...(profileUser.followers || []), authUserId];
    startTransition(() => setProfileUser(prev => ({ ...prev, followers: newFollowers })));
    try {
      if (wasFollowing) await unfollowUser(profileUser._id);
      else              await followUser(profileUser._id);
      showLocalToast(wasFollowing ? "Désabonné !" : "Abonné !");
    } catch (err) {
      const rollback = wasFollowing
        ? [...(profileUser.followers || []), authUserId]
        : (profileUser.followers || []).filter(
            u => !isSameUser(typeof u === "object" ? u._id : u, authUserId)
          );
      startTransition(() => setProfileUser(prev => ({ ...prev, followers: rollback })));
      const status = err?.response?.status;
      if (status === 401 || status === 403) showLocalToast("Non autorisé — reconnecte-toi", "error");
      else if (status === 404)              showLocalToast("Utilisateur introuvable", "error");
      else if (err.code === "ERR_NETWORK" || err.code === "ECONNABORTED")
        showLocalToast("Hors ligne — réessaie plus tard", "error");
      else
        showLocalToast("Erreur lors de l'action", "error");
    } finally {
      setFollowLoading(false);
    }
  }, [authUser, profileUser, followStatus, followLoading, followUser, unfollowUser, showLocalToast, authUserId]);

  // ── Effets secondaires ─────────────────────────────────────────────────────
  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); }, [targetUserId]);

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
      if (profileUser?._id && isValidObjectId(profileUser._id))
        loadProfilePosts(profileUser._id, 1, false);
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [profileUser?._id, loadProfilePosts]);

  // ── useEffect principal : chargement du profil ────────────────────────────
  useEffect(() => {
    if (authLoading && !authUser && !targetUserId) return;
    if (!authUser && !targetUserId) { navigate("/auth", { replace: true }); return; }

    if (navInstantUser && !initialUser && !silentRevalidatedRef.current) {
      silentRevalidatedRef.current = true;
      setIsLoadingUser(false);
      setUserNotFound(false);
      setIsBot(!!navInstantUser.isBot);
      if (targetUserId && isValidObjectId(targetUserId)) {
        loadProfilePosts(targetUserId, 1, false).catch(() => {});
        if (navigator.onLine) {
          fetchUserById(targetUserId)
            .then(fresh => {
              if (fresh) {
                setProfileUser(prev => ({ ...(prev || {}), ...fresh }));
                saveUser(fresh).catch(() => {});
              }
            })
            .catch(() => {});
        }
      }
      return;
    }

    if (initialUser) {
      setProfileUser(initialUser);
      setIsBot(!!initialUser.isBot);
      setIsLoadingUser(false);
      setUserNotFound(false);
      if (targetUserId && isValidObjectId(targetUserId))
        loadProfilePosts(targetUserId, 1, false);
      return;
    }

    if (!targetUserId || targetUserId === "undefined") {
      setIsLoadingUser(false);
      setUserNotFound(true);
      return;
    }

    if (isMockId(targetUserId)) {
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
        setProfileUser(buildMinimalUser(targetUserId, { username: "utilisateur", fullName: "Utilisateur" }));
        setIsBot(false);
        setIsLoadingUser(false);
        setUserNotFound(false);
        showLocalToast("Profil de démonstration", "info");
      }
      return;
    }

    if (!isValidObjectId(targetUserId)) {
      if (isOwner) {
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

    (async () => {
      if (!profileUser && isValidObjectId(targetUserId)) {
        setProfileUser(isOwner ? authUser : buildMinimalUser(targetUserId));
      }
      setIsLoadingUser(!profileUser && !isValidObjectId(targetUserId));
      setUserNotFound(false);
      let postsLoadPromise = null;
      try {
        postsLoadPromise = loadProfilePosts(targetUserId, 1, false);
        idbClearOtherKeys(`profilePosts_${targetUserId}`).catch(() => {});

        if (isOwner) {
          setProfileUser(prev => ({ ...(prev || {}), ...authUser }));
          setIsBot(false);
          setUserNotFound(false);
          saveUser(authUser);
          if (navigator.onLine)
            fetchUserById(authUserId)
              .then(fresh => {
                if (fresh) {
                  setProfileUser(prev => ({ ...(prev || {}), ...fresh }));
                  saveUser(fresh);
                }
              })
              .catch(() => {});
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
              setProfileUser(prev => ({ ...(prev || {}), ...fetchedUser }));
              setIsBot(!!fetchedUser.isBot);
              setUserNotFound(false);
              saveUser(fetchedUser);
            } else if (!cachedUser) {
              const embedded = buildProfileFromEmbeddedUser(targetUserId);
              if (embedded) {
                setProfileUser(embedded.profile);
                setIsBot(!!embedded.profile.isBot);
                setUserNotFound(false);
                saveUser(embedded.profile);
                if (embedded.posts.length > 0) {
                  startTransition(() => setProfilePosts(embedded.posts.map(normalizePost)));
                  storeProfilePostsInCache(targetUserId, embedded.posts);
                }
                setPage(1); setHasMore(true);
                await loadProfilePosts(targetUserId, 1, false);
                return;
              }
              const fallback = await tryBuildProfileFromPosts(targetUserId);
              if (fallback) {
                setProfileUser(fallback.user);
                setIsBot(!!fallback.user.isBot);
                setUserNotFound(false);
                saveUser(fallback.user);
                setPage(1); setHasMore(fallback.posts.length >= 20);
                await loadProfilePosts(targetUserId, 1, false, fallback.posts);
                return;
              }
              if (isValidObjectId(targetUserId)) {
                setProfileUser(buildMinimalUser(targetUserId));
                setIsBot(false);
                setUserNotFound(false);
                showLocalToast("Profil partiellement disponible", "info");
              } else {
                setUserNotFound(true);
              }
            }
          } else if (!cachedUser) {
            if (isValidObjectId(targetUserId)) {
              const embedded = buildProfileFromEmbeddedUser(targetUserId);
              if (embedded) {
                setProfileUser(embedded.profile);
                setIsBot(!!embedded.profile.isBot);
                setUserNotFound(false);
                if (embedded.posts.length > 0)
                  startTransition(() => setProfilePosts(embedded.posts.map(normalizePost)));
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

        setPage(1); setHasMore(true);
        await postsLoadPromise;
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

  useEffect(() => {
    if (!isLoadingUser || profileUser || !isValidObjectId(targetUserId)) return;
    const timer = setTimeout(() => {
      setProfileUser(isOwner && authUser ? authUser : buildMinimalUser(targetUserId));
      setUserNotFound(false);
      setIsLoadingUser(false);
    }, 2500);
    return () => clearTimeout(timer);
  }, [isLoadingUser, profileUser, targetUserId, isOwner, authUser]);

  // ── Socket temps réel ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket || !profileUser || isMockProfile || isBot) return;

    const handleNewPost = (post) => {
      const postUserId = typeof post.user === "object" ? post.user._id : post.user;
      if (!isSameUser(postUserId, profileUser._id)) return;
      startTransition(() => setProfilePosts(prev => {
        if (prev.find(p => p._id === post._id)) return prev;
        const updated = [normalizePost(post), ...prev];
        savePosts(profileUser._id, updated);
        storeProfilePostsInCache(profileUser._id, updated);
        return updated;
      }));
    };

    const handleDeletedPost = (postId) => {
      startTransition(() => setProfilePosts(prev => {
        const updated = prev.filter(p => p._id !== postId);
        savePosts(profileUser._id, updated);
        storeProfilePostsInCache(profileUser._id, updated);
        return updated;
      }));
    };

    const handleUpdatedPost = (post) => {
      startTransition(() => setProfilePosts(prev => {
        const updated = prev.map(p => p._id === post._id ? normalizePost(post) : p);
        savePosts(profileUser._id, updated);
        storeProfilePostsInCache(profileUser._id, updated);
        return updated;
      }));
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

  // ── Stats ──────────────────────────────────────────────────────────────────
  const effectiveProfileUser =
    profileUser ||
    (isValidObjectId(targetUserId)
      ? (isOwner && authUser ? authUser : buildMinimalUser(targetUserId))
      : null);

  // ✅ flags accountType
  const isBusiness = effectiveProfileUser?.accountType === "business";
  const isPro      = effectiveProfileUser?.accountType === "pro";

  const handleLoadMore = useCallback(() => {
    if (!hasMore || isLoadingPosts || loadingRef.current || !effectiveProfileUser?._id) return;
    const nextPage = page + 1;
    setPage(nextPage);
    loadProfilePosts(effectiveProfileUser._id, nextPage, true);
  }, [effectiveProfileUser?._id, hasMore, isLoadingPosts, loadProfilePosts, page]);

  const renderPostsFeed = () => {
    if (profilePosts.length === 0 && !isLoadingPosts) {
      return <EmptyPostsState isOwner={isOwner} isDarkMode={isDarkMode} />;
    }
    return (
      <div className="profile-feed-list">
        {profilePosts.map((post, index) => {
          const isLast = index === profilePosts.length - 1;
          return (
            <div key={post._id || index} ref={isLast ? lastPostRef : undefined}>
              <PostCard
                post={post}
                onDeleted={handlePostDeleted}
                showToast={showLocalToast}
                priority={index < 2}
                ignoreHidden
              />
            </div>
          );
        })}
        {isLoadingPosts && <LoadingSpinner darkMode={isDarkMode} text="Chargement des publications..." />}
      </div>
    );
  };

  const renderContent = () => {
    // ── Paramètres ──────────────────────────────────────────────────────────
    if (selectedTab === "settings" && isOwner) {
      return (
        <section className="profile-section profile-panel">
          <SettingsSection
            user={effectiveProfileUser}
            showToast={showLocalToast}
            onUserUpdated={handleProfileUserUpdated}
          />
        </section>
      );
    }

    // ── Onglet CV (profil pro) ───────────────────────────────────────────────
    // ✅ NOUVEAU — ProCVView en lecture / édition owner
    if (selectedTab === "cv") {
      return (
        <section className="profile-section profile-panel">
          <ProCVView
            user={effectiveProfileUser}
            isOwner={isOwner}
            showToast={showLocalToast}
            onUserUpdated={handleProfileUserUpdated}
          />
        </section>
      );
    }

    // ── Feed principal ───────────────────────────────────────────────────────
    if (selectedTab === "feed") {
      return (
        <section className="profile-section profile-feed-section">
          {isOwner && !isMockProfile && !isBot && (
            <CreatePost
              user={effectiveProfileUser || authUser}
              showToast={showLocalToast}
              onPostCreated={handlePostCreated}
            />
          )}
          {renderPostsFeed()}
        </section>
      );
    }

    // ── Médias (profil perso uniquement) ────────────────────────────────────
    const videoPosts = profilePosts.filter(isVideoPost);
    return (
      <section className="profile-section">
        <ProfileMediaGrid
          posts={videoPosts}
          isDarkMode={isDarkMode}
          isLoading={isLoadingPosts}
          hasMore={hasMore}
          onLoadMore={handleLoadMore}
          isOwner={isOwner}
          emptyMessage={isOwner ? "Tes videos apparaitront ici." : "Les videos publiees apparaitront ici."}
        />
      </section>
    );
  };

  const pageBg = isDarkMode ? "#080808" : "#fff";

  if (authLoading || (isLoadingUser && !effectiveProfileUser)) {
    return (
      <main style={{ minHeight: "100vh", background: pageBg, padding: "32px 16px" }}>
        <LoadingSpinner darkMode={isDarkMode} text="Chargement du profil..." />
      </main>
    );
  }

  if (userNotFound && !effectiveProfileUser) {
    return (
      <main style={{ minHeight: "100vh", background: pageBg, padding: "32px 16px" }}>
        <div style={{
          maxWidth: 520,
          margin: "56px auto",
          padding: "34px 24px",
          textAlign: "center",
          borderRadius: 18,
          background: isDarkMode ? "#111" : "#fff",
          color: isDarkMode ? "#f8fafc" : "#0f172a",
          border: isDarkMode ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(15,23,42,0.08)",
          fontFamily: "'Sora','DM Sans',sans-serif",
        }}>
          <h1 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 800 }}>Profil introuvable</h1>
          <p style={{ margin: 0, color: isDarkMode ? "#94a3b8" : "#64748b", fontSize: 14 }}>
            Ce profil n'est pas disponible pour le moment.
          </p>
        </div>
        {toast && <Toast message={toast.message} type={toast.type} />}
      </main>
    );
  }

  return (
    <main className="profile-page-shell" style={{ background: pageBg }}>
      <style>{`
        .profile-page-shell {
          min-height: 100vh;
          padding: 14px 12px 56px;
          font-family: 'Sora','DM Sans',sans-serif;
        }
        .profile-page-frame {
          width: min(100%, 760px);
          margin: 0 auto;
        }
        .profile-layout-card {
          overflow: hidden;
          border-radius: 18px;
          border: 1px solid ${isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)"};
          background: ${isDarkMode ? "#0f0f0f" : "#fff"};
          box-shadow: ${isDarkMode ? "0 18px 60px rgba(0,0,0,0.42)" : "0 18px 50px rgba(15,23,42,0.08)"};
        }
        .profile-section {
          padding: 10px;
          background: ${isDarkMode ? "#0f0f0f" : "#fff"};
        }
        .profile-feed-section {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 12px;
        }
        .profile-feed-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .profile-panel {
          padding: 14px;
        }
        @media (max-width: 640px) {
          .profile-page-shell { padding: 0 0 42px; }
          .profile-page-frame { width: 100%; }
          .profile-layout-card {
            border-left: 0;
            border-right: 0;
            border-radius: 0;
            box-shadow: none;
          }
          .profile-section { padding: 3px; }
          .profile-feed-section { padding: 8px; }
        }
      `}</style>

      <div className="profile-page-frame">
        <div className="profile-layout-card">
          <ProfileHeader
            user={effectiveProfileUser}
            isOwnProfile={isOwner}
            posts={profilePosts}
            followers={effectiveProfileUser?.followers || []}
            following={effectiveProfileUser?.following || []}
            showToast={showLocalToast}
            onUserUpdated={handleProfileUserUpdated}
          />

          {!isOwner && (
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
              padding: "0 14px 14px",
              background: isDarkMode ? "#0f0f0f" : "#fff",
            }}>
              <FollowButton
                isFollowing={!!followStatus}
                isLoading={followLoading}
                onClick={handleFollowToggle}
                isDarkMode={isDarkMode}
              />
              <motion.button
                type="button"
                onClick={() => navigate('/messages', {
                  state: {
                    selectedContact: {
                      id: effectiveProfileUser?._id || effectiveProfileUser?.id,
                      fullName: effectiveProfileUser?.fullName,
                      username: effectiveProfileUser?.username,
                      profilePhoto: effectiveProfileUser?.profilePhoto,
                      isOnline: effectiveProfileUser?.isOnline,
                      lastSeen: effectiveProfileUser?.lastSeen,
                    },
                    openChat: true,
                  },
                })}
                whileHover={{ scale: 1.03, y: -1 }}
                whileTap={{ scale: 0.97 }}
                style={{
                  minHeight: 36,
                  borderRadius: 999,
                  border: `1px solid ${isDarkMode ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)"}`,
                  background: isDarkMode ? "rgba(255,255,255,0.05)" : "#fff",
                  color: isDarkMode ? "#f9fafb" : "#111827",
                  fontFamily: "'Sora','DM Sans',sans-serif",
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                Message
              </motion.button>
            </div>
          )}

          {/* ✅ isPro transmis à ProfileMenu */}
          <ProfileMenu
            selectedTab={selectedTab}
            onTabChange={setSelectedTab}
            isDarkMode={isDarkMode}
            isOwner={isOwner}
            isBusiness={isBusiness}
            isPro={isPro}
          />

          {renderContent()}
        </div>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} />}
    </main>
  );
}