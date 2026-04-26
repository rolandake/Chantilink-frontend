// src/pages/profile/ProfilePage.jsx
// ✅ v7 — NOUVEAU DESIGN moderne TikTok/Instagram fusionné
// Conserve toute la logique métier v6 (cache, IDB, socket, offline, etc.)

import React, { useState, useEffect, useCallback, useRef, memo, startTransition } from "react";
import { motion } from "framer-motion";
import { useParams, useNavigate } from "react-router-dom";
import ProfileHeader from "./ProfileHeader";
import ProfileMenu from "./ProfileMenu";
import ProfileMediaGrid from "./ProfileMediaGrid";
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
  idbGetProfileUser as idbGetUser,
} from "../../utils/idbMigration";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

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
    for (const [, { posts, ts }] of sorted) {
      if (now - ts > maxAge) continue;
      for (const p of posts) {
        if (!p?._id || seen.has(p._id)) continue;
        seen.add(p._id);
        result.push({ ...p, _fromProfileCache: true });
      }
    }
    return result;
  } catch { return []; }
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
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
});

const buildProfileFromEmbeddedUser = (targetId) => {
  try {
    const homePool = window.__homePostsPool__;
    if (Array.isArray(homePool)) {
      for (const post of homePool) {
        const uid = post?.user?._id || post?.user?.id || post?.author?._id;
        if (uid && String(uid) === String(targetId)) {
          const profile = buildUserFromPost(post);
          if (profile) return { profile, posts: homePool.filter(p => { const pid = p?.user?._id || p?.user?.id || p?.author?._id; return pid && String(pid) === String(targetId); }) };
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
    return homePool.filter(p => { const uid = p?.user?._id || p?.user?.id || p?.author?._id; return uid && String(uid) === String(targetId); });
  } catch { return []; }
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSANTS UI — Avec nouveau design
// ─────────────────────────────────────────────────────────────────────────────

const LoadingSpinner = memo(({ darkMode = false, text = "Chargement..." }) => (
  <div style={{ textAlign: 'center', padding: '48px 0', fontFamily: "'Sora','DM Sans',sans-serif" }}>
    <div style={{
      display: 'inline-block', width: 44, height: 44,
      border: `4px solid ${darkMode ? 'rgba(249,115,22,0.2)' : 'rgba(249,115,22,0.15)'}`,
      borderTopColor: '#f97316',
      borderRadius: '50%',
      animation: 'spin 0.8s linear infinite',
    }} />
    {text && <p style={{ marginTop: 14, color: darkMode ? '#6b7280' : '#9ca3af', fontSize: 14 }}>{text}</p>}
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
      padding: '11px 36px',
      borderRadius: 999,
      fontFamily: "'Sora','DM Sans',sans-serif",
      fontWeight: 700,
      fontSize: 15,
      cursor: isLoading ? 'not-allowed' : 'pointer',
      border: isFollowing ? `1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}` : 'none',
      background: isFollowing
        ? (isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)')
        : 'linear-gradient(135deg,#f97316,#ec4899)',
      color: isFollowing ? (isDarkMode ? '#9ca3af' : '#6b7280') : '#fff',
      boxShadow: isFollowing ? 'none' : '0 6px 24px rgba(249,115,22,0.4)',
      opacity: isLoading ? 0.7 : 1,
      display: 'flex', alignItems: 'center', gap: 8,
      transition: 'all 0.2s',
    }}
  >
    {isLoading ? (
      <>
        <span style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        Chargement...
      </>
    ) : isFollowing ? "Se désabonner" : "S'abonner"}
  </motion.button>
));
FollowButton.displayName = "FollowButton";

const Toast = memo(({ message, type }) => {
  const bg = type === "error" ? '#ef4444' : type === "info" ? '#3b82f6' : 'linear-gradient(135deg,#22c55e,#16a34a)';
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.95 }}
      style={{
        position: 'fixed', bottom: 28, right: 28,
        padding: '12px 22px', borderRadius: 16,
        background: bg, color: '#fff',
        fontFamily: "'Sora','DM Sans',sans-serif",
        fontWeight: 600, fontSize: 14,
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        zIndex: 9999, maxWidth: 340,
        border: '1px solid rgba(255,255,255,0.15)',
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
    style={{
      textAlign: 'center', padding: '56px 24px',
      fontFamily: "'Sora','DM Sans',sans-serif",
    }}
  >
    <div style={{ fontSize: 52, marginBottom: 16 }}>📭</div>
    <p style={{ fontSize: 17, fontWeight: 700, color: isDarkMode ? '#d1d5db' : '#374151', marginBottom: 8 }}>
      {isOwner ? "Tu n'as pas encore publié de post" : "Aucun post pour l'instant"}
    </p>
    <p style={{ fontSize: 13, color: isDarkMode ? '#6b7280' : '#9ca3af', maxWidth: 280, margin: '0 auto', lineHeight: 1.7 }}>
      {isOwner
        ? "Partage quelque chose avec ta communauté !"
        : "Cet utilisateur n'a encore rien publié. Reviens plus tard !"}
    </p>
  </motion.div>
));
EmptyPostsState.displayName = "EmptyPostsState";

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function ProfilePage({
  initialUser  = null,
  initialPosts = null,
  mockHandlers = null,
}) {
  const { userId } = useParams();
  const navigate   = useNavigate();
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

  // ✅ FIX DÉFINITIF SYNC PHOTO — Re-sync profileUser depuis authUser
  // On dépend de authUser?.profilePhoto directement (valeur primitive) pour
  // que le useEffect se déclenche IMMÉDIATEMENT après updateUserProfile().
  // On merge toujours pour garantir une nouvelle référence → re-render garanti.
  useEffect(() => {
    if (!isOwner || !authUser) return;
    setProfileUser(prev => ({ ...(prev || {}), ...authUser }));
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
  ]);

  const fetchUserById = useCallback(async (uid) => {
    if (!uid || uid === "undefined" || uid === "null") return null;
    if (!isValidObjectId(uid)) return null;
    const cached = requestCache.current.get(uid);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) return cached.data;
    if (!navigator.onLine) return null;
    try {
      const { data } = await axios.get(`${API_URL}/users/${uid}`, { withCredentials: true, headers: { "Cache-Control": "no-cache", Pragma: "no-cache" }, timeout: 8000 });
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
  }, []);

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

  const followUser   = useCallback(async (uid) => {
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
      if (prefetchedPosts && !append) { postsArray = prefetchedPosts; startTransition(() => setProfilePosts(prefetchedPosts)); }
      if (isMockProfile && initialPosts && !append) { postsArray = initialPosts; startTransition(() => setProfilePosts(initialPosts)); storeProfilePostsInCache(targetId, initialPosts); return; }
      if (!isMockProfile && !append && !prefetchedPosts) {
        try {
          const cached = await getCachedPosts(targetId);
          if (Array.isArray(cached) && cached.length > 0) { postsArray = cached; startTransition(() => setProfilePosts(cached)); storeProfilePostsInCache(targetId, cached); }
        } catch (e) { console.warn("IDB cache read error:", e); }
      }
      if (!append && !prefetchedPosts && postsArray.length === 0) {
        const homePostsForUser = getPostsFromHomePool(targetId);
        if (homePostsForUser.length > 0) { postsArray = homePostsForUser; startTransition(() => setProfilePosts(homePostsForUser.map(normalizePost))); storeProfilePostsInCache(targetId, homePostsForUser); }
      }
      if (navigator.onLine && !prefetchedPosts) {
        try {
          const result  = await fetchUserPosts(targetId, pageNumber);
          const fetched = extractPostsFromResult(result);
          if (fetched.length > 0) postsArray = fetched;
        } catch (networkErr) { if (postsArray.length === 0) showLocalToast("Mode hors ligne", "info"); }
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
    finally { loadingRef.current = false; setIsLoadingPosts(false); }
  }, [fetchUserPosts, savePosts, showLocalToast, isMockProfile, initialPosts]);

  useEffect(() => {
    if (profilePosts.length > 0 && profileUser?._id) storeProfilePostsInCache(profileUser._id, profilePosts);
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
      showLocalToast("Erreur lors de l'action", "error");
      const rollback = wasFollowing
        ? [...(profileUser.followers || []), authUserId]
        : (profileUser.followers || []).filter(u => !isSameUser(typeof u === "object" ? u._id : u, authUserId));
      startTransition(() => setProfileUser(prev => ({ ...prev, followers: rollback })));
    } finally { setFollowLoading(false); }
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
      if (profileUser?._id && isValidObjectId(profileUser._id)) loadProfilePosts(profileUser._id, 1, false);
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [profileUser?._id, loadProfilePosts]);

  // useEffect principal
  useEffect(() => {
    if (authLoading) return;
    if (!authUser) { navigate("/auth", { replace: true }); return; }
    if (initialUser) {
      setProfileUser(initialUser); setIsBot(!!initialUser.isBot); setIsLoadingUser(false); setUserNotFound(false);
      if (targetUserId && isValidObjectId(targetUserId)) loadProfilePosts(targetUserId, 1, false);
      return;
    }
    if (!targetUserId || targetUserId === "undefined") { setIsLoadingUser(false); setUserNotFound(true); return; }
    if (isMockId(targetUserId)) {
      const result = buildProfileFromEmbeddedUser(targetUserId);
      if (result) {
        setProfileUser(result.profile); setIsBot(!!result.profile.isBot); setIsLoadingUser(false); setUserNotFound(false);
        if (result.posts.length > 0) { startTransition(() => setProfilePosts(result.posts.map(normalizePost))); storeProfilePostsInCache(targetUserId, result.posts); }
      } else {
        setProfileUser(buildMinimalUser(targetUserId, { username: "utilisateur", fullName: "Utilisateur" }));
        setIsBot(false); setIsLoadingUser(false); setUserNotFound(false);
        showLocalToast("Profil de démonstration", "info");
      }
      return;
    }
    if (!isValidObjectId(targetUserId)) {
      if (isOwner) { setProfileUser(authUser); setIsBot(false); setIsLoadingUser(false); setUserNotFound(false); }
      else { setIsLoadingUser(false); setUserNotFound(true); }
      return;
    }
    (async () => {
      setIsLoadingUser(true); setUserNotFound(false);
      try {
        await idbClearOtherKeys(`profilePosts_${targetUserId}`);
        if (isOwner) {
          setProfileUser(authUser); setIsBot(false); setUserNotFound(false); saveUser(authUser);
          if (navigator.onLine) fetchUserById(authUserId).then(fresh => { if (fresh) { setProfileUser(fresh); saveUser(fresh); } }).catch(() => {});
        } else {
          const cachedUser = await idbGetUser(targetUserId);
          if (cachedUser) { setProfileUser(buildMinimalUser(cachedUser._id || cachedUser.id, cachedUser)); setIsBot(!!cachedUser.isBot); setUserNotFound(false); }
          if (navigator.onLine) {
            const fetchedUser = await fetchUserById(targetUserId);
            if (fetchedUser) { setProfileUser(fetchedUser); setIsBot(!!fetchedUser.isBot); setUserNotFound(false); saveUser(fetchedUser); }
            else if (!cachedUser) {
              const embeddedResult = buildProfileFromEmbeddedUser(targetUserId);
              if (embeddedResult) {
                setProfileUser(embeddedResult.profile); setIsBot(!!embeddedResult.profile.isBot); setUserNotFound(false); saveUser(embeddedResult.profile);
                if (embeddedResult.posts.length > 0) { startTransition(() => setProfilePosts(embeddedResult.posts.map(normalizePost))); storeProfilePostsInCache(targetUserId, embeddedResult.posts); }
                setPage(1); setHasMore(true); await loadProfilePosts(targetUserId, 1, false); return;
              }
              const fallback = await tryBuildProfileFromPosts(targetUserId);
              if (fallback) {
                setProfileUser(fallback.user); setIsBot(!!fallback.user.isBot); setUserNotFound(false); saveUser(fallback.user);
                setPage(1); setHasMore(fallback.posts.length >= 20);
                await loadProfilePosts(targetUserId, 1, false, fallback.posts); return;
              } else {
                if (isValidObjectId(targetUserId)) { setProfileUser(buildMinimalUser(targetUserId)); setIsBot(false); setUserNotFound(false); showLocalToast("Profil partiellement disponible", "info"); }
                else setUserNotFound(true);
              }
            }
          } else if (!cachedUser) {
            if (isValidObjectId(targetUserId)) {
              const embeddedResult = buildProfileFromEmbeddedUser(targetUserId);
              if (embeddedResult) {
                setProfileUser(embeddedResult.profile); setIsBot(!!embeddedResult.profile.isBot); setUserNotFound(false);
                if (embeddedResult.posts.length > 0) startTransition(() => setProfilePosts(embeddedResult.posts.map(normalizePost)));
              } else {
                setProfileUser(buildMinimalUser(targetUserId)); setIsBot(false); setUserNotFound(false);
                showLocalToast("Profil non disponible hors ligne", "info");
              }
            } else setUserNotFound(true);
          }
        }
        setPage(1); setHasMore(true); await loadProfilePosts(targetUserId, 1, false);
      } catch (err) {
        console.error("Profil Load Error:", err);
        if (!profileUser && isValidObjectId(targetUserId)) { setProfileUser(buildMinimalUser(targetUserId)); setUserNotFound(false); }
        showLocalToast("Erreur lors du chargement", "error");
      } finally { setIsLoadingUser(false); }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, authUser?._id, targetUserId, isOwner]);

  // Socket temps réel
  useEffect(() => {
    if (!socket || !profileUser || isMockProfile || isBot) return;
    const handleNewPost = (post) => {
      const postUserId = typeof post.user === "object" ? post.user._id : post.user;
      if (!isSameUser(postUserId, profileUser._id)) return;
      startTransition(() => setProfilePosts(prev => {
        if (prev.find(p => p._id === post._id)) return prev;
        const updated = [normalizePost(post), ...prev];
        savePosts(profileUser._id, updated); storeProfilePostsInCache(profileUser._id, updated);
        return updated;
      }));
    };
    const handleDeletedPost = (postId) => {
      startTransition(() => setProfilePosts(prev => {
        const updated = prev.filter(p => p._id !== postId);
        savePosts(profileUser._id, updated); storeProfilePostsInCache(profileUser._id, updated);
        return updated;
      }));
    };
    const handleUpdatedPost = (post) => {
      startTransition(() => setProfilePosts(prev => {
        const updated = prev.map(p => p._id === post._id ? normalizePost(post) : p);
        savePosts(profileUser._id, updated); storeProfilePostsInCache(profileUser._id, updated);
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

  const stats = {
    posts:     profilePosts.length,
    followers: profileUser?.followers?.length || profileUser?.followersCount || 0,
    following: profileUser?.following?.length || profileUser?.followingCount || 0,
  };

  // Styles de page
  const pageBg = isDarkMode ? '#080808' : '#f5f5f7';

  // ── STATES D'ÉCRAN ──────────────────────────────────────────────────────────

  if (authLoading || (isLoadingUser && !profileUser)) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: pageBg }}>
        <LoadingSpinner darkMode={isDarkMode} />
      </div>
    );
  }

  if (userNotFound || (!profileUser && !isLoadingUser)) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: pageBg, fontFamily: "'Sora','DM Sans',sans-serif" }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🔍</div>
          <p style={{ fontSize: 18, fontWeight: 700, color: isDarkMode ? '#d1d5db' : '#374151', marginBottom: 20 }}>Profil introuvable</p>
          <motion.button
            onClick={() => navigate(-1)}
            whileHover={{ scale: 1.04, y: -1 }} whileTap={{ scale: 0.97 }}
            style={{ padding: '11px 28px', borderRadius: 999, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#f97316,#ec4899)', color: '#fff', fontWeight: 700, fontSize: 14, boxShadow: '0 6px 24px rgba(249,115,22,0.4)' }}
          >
            ← Retour
          </motion.button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: pageBg,
      padding: '16px',
      fontFamily: "'Sora','DM Sans',sans-serif",
      transition: 'background 0.3s',
    }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&display=swap');
      `}</style>

      {/* Bannière mock */}
      {isMockProfile && (
        <div style={{ maxWidth: 820, margin: '0 auto 16px', padding: '12px 20px', borderRadius: 16, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)' }}>
          <p style={{ fontSize: 13, color: '#3b82f6', textAlign: 'center', margin: 0, fontWeight: 500 }}>
            👤 Profil de démonstration — Toutes les interactions sont simulées
          </p>
        </div>
      )}

      <div style={{ maxWidth: 820, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>

        {/* Layout desktop */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 16 }}>

          {/* Colonne principale */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Header */}
            <ProfileHeader
              user={profileUser}
              isOwnProfile={isOwner}
              posts={profilePosts}
              followers={profileUser.followers || []}
              following={profileUser.following || []}
              showToast={showLocalToast}
            />

            {/* Bouton S'abonner */}
            {!isOwner && (
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <FollowButton
                  isFollowing={followStatus}
                  isLoading={followLoading}
                  onClick={handleFollowToggle}
                  isDarkMode={isDarkMode}
                />
              </div>
            )}

            {/* Suggestions mobile */}
            {isOwner && authUser && authToken && (
              <div style={{ display: 'block' }} className="lg:hidden">
                <ProfileSuggestions
                  currentUser={authUser} token={authToken}
                  isDarkMode={isDarkMode} maxSuggestions={3}
                  onFollowSuccess={handleFollowSuccess}
                />
              </div>
            )}

            {/* Menu onglets */}
            <ProfileMenu
              selectedTab={selectedTab}
              onSelectTab={setSelectedTab}
              isOwner={isOwner}
              stats={stats}
            />

            {/* ── ONGLET PUBLICATIONS ── */}
            {selectedTab === "posts" && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {isOwner && !isMockProfile && !isBot && (
                  <CreatePost user={authUser} onPostCreated={handlePostCreated} showToast={showLocalToast} />
                )}
                {isLoadingPosts && profilePosts.length === 0 ? (
                  <LoadingSpinner darkMode={isDarkMode} text="Chargement des posts..." />
                ) : profilePosts.length === 0 && !isLoadingPosts ? (
                  <EmptyPostsState isOwner={isOwner} isDarkMode={isDarkMode} />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {profilePosts.map((post, index) => (
                      <div key={post._id} ref={index === profilePosts.length - 1 ? lastPostRef : null}>
                        <PostCard post={post} onDeleted={handlePostDeleted} showToast={showLocalToast} mockPost={isMockProfile} />
                      </div>
                    ))}
                    {isLoadingPosts && (
                      <div style={{ textAlign: 'center', padding: '16px 0' }}>
                        <div style={{ display: 'inline-block', width: 28, height: 28, border: `3px solid ${isDarkMode ? 'rgba(249,115,22,0.2)' : 'rgba(249,115,22,0.15)'}`, borderTopColor: '#f97316', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                      </div>
                    )}
                    {!hasMore && profilePosts.length > 0 && (
                      <p style={{ textAlign: 'center', padding: '16px 0', fontSize: 13, color: isDarkMode ? '#4b5563' : '#9ca3af' }}>
                        · Tous les posts affichés ·
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── ONGLET PHOTOS ── */}
            {selectedTab === "photos" && (
              <ProfileMediaGrid
                posts={profilePosts}
                isDarkMode={isDarkMode}
                isLoading={isLoadingPosts}
                hasMore={hasMore}
                onLoadMore={() => {
                  const nextPage = page + 1;
                  setPage(nextPage);
                  if (profileUser?._id) loadProfilePosts(profileUser._id, nextPage, true);
                }}
                featuredFirst={false}
                isOwner={isOwner}
              />
            )}

            {/* ── ONGLET PARAMÈTRES ── */}
            {selectedTab === "settings" && isOwner && !isBot && (
              <SettingsSection user={authUser} showToast={showLocalToast} />
            )}
          </div>

          {/* Colonne suggestions desktop */}
          {isOwner && !isBot && authUser && authToken && (
            <div style={{ display: 'none' }} className="lg:block">
              <div style={{ position: 'sticky', top: 16 }}>
                <ProfileSuggestions
                  currentUser={authUser} token={authToken}
                  isDarkMode={isDarkMode} maxSuggestions={5}
                  onFollowSuccess={handleFollowSuccess}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}