// src/pages/profile/ProfilePage.jsx
// ✅ Fix perf : skeleton instantané au lieu du spinner bloquant
//   AVANT : if (!profileUser) return <Spinner> → page blanche jusqu'au fetch
//   APRÈS : skeleton s'affiche immédiatement, données remplies en arrière-plan

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

const normalizePost = (p) => ({
  _id: p._id || p.id,
  content: p.content || "",
  media: Array.isArray(p.media)
    ? p.media.map((m) => ({ url: m?.url || m?.path || m?.location || m, type: m?.type || "image" }))
    : [],
  user: typeof p.user === "object" ? (p.user._id ? p.user : { _id: p.user.id }) : { _id: p.user },
  likes: p.likes || [],
  comments: p.comments || [],
  views: p.views || [],
  shares: p.shares || [],
  createdAt: p.createdAt,
});

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

// ─── Skeleton ────────────────────────────────────────────────────────────────
const Pulse = ({ className }) => (
  <div className={`animate-pulse rounded-xl bg-white/10 ${className}`} />
);

const ProfileSkeleton = memo(({ isDarkMode }) => (
  <div className={`profile-page min-h-screen p-4 transition-colors duration-200 ${
    isDarkMode ? "bg-black" : "bg-orange-50"
  }`}>
    <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        {/* Avatar + nom */}
        <div className={`rounded-2xl p-6 ${isDarkMode ? "bg-gray-900" : "bg-white"}`}>
          <div className="flex items-center gap-4">
            <div className={`w-20 h-20 rounded-full animate-pulse ${isDarkMode ? "bg-gray-700" : "bg-gray-200"}`} />
            <div className="flex-1 space-y-3">
              <Pulse className={`h-5 w-40 ${isDarkMode ? "bg-gray-700" : "bg-gray-200"}`} />
              <Pulse className={`h-3 w-24 ${isDarkMode ? "bg-gray-700" : "bg-gray-200"}`} />
            </div>
          </div>
          {/* Stats */}
          <div className="flex gap-8 mt-6">
            {[0, 1, 2].map(i => (
              <div key={i} className="text-center space-y-1">
                <Pulse className={`h-5 w-8 mx-auto ${isDarkMode ? "bg-gray-700" : "bg-gray-200"}`} />
                <Pulse className={`h-3 w-14 mx-auto ${isDarkMode ? "bg-gray-700" : "bg-gray-200"}`} />
              </div>
            ))}
          </div>
        </div>
        {/* Onglets */}
        <Pulse className={`h-10 w-full ${isDarkMode ? "bg-gray-800" : "bg-gray-200"}`} />
        {/* Posts */}
        {[0, 1, 2].map(i => (
          <div key={i} className={`rounded-2xl p-4 space-y-3 ${isDarkMode ? "bg-gray-900" : "bg-white"}`}>
            <div className="flex items-center gap-3">
              <Pulse className={`w-10 h-10 rounded-full ${isDarkMode ? "bg-gray-700" : "bg-gray-200"}`} />
              <Pulse className={`h-4 w-32 ${isDarkMode ? "bg-gray-700" : "bg-gray-200"}`} />
            </div>
            <Pulse className={`h-4 w-full ${isDarkMode ? "bg-gray-700" : "bg-gray-200"}`} />
            <Pulse className={`h-4 w-3/4 ${isDarkMode ? "bg-gray-700" : "bg-gray-200"}`} />
          </div>
        ))}
      </div>
    </div>
  </div>
));

// ─── Sous-composants ──────────────────────────────────────────────────────────
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
        <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        Chargement...
      </span>
    ) : isFollowing ? "Se désabonner" : "S'abonner"}
  </button>
));

const Toast = memo(({ message, type }) => (
  <div className={`fixed bottom-6 right-6 px-6 py-3 rounded-lg shadow-2xl z-50 ${
    type === "error" ? "bg-red-500 text-white"
    : type === "info" ? "bg-blue-500 text-white"
    : "bg-green-500 text-white"
  }`}>
    {message}
  </div>
));

const PostsLoadingBar = memo(({ isDarkMode }) => (
  <div className="text-center py-4">
    <div className={`inline-block w-8 h-8 border-4 rounded-full animate-spin ${
      isDarkMode ? "border-orange-400 border-t-transparent" : "border-orange-500 border-t-transparent"
    }`} />
  </div>
));

// ─── Page principale ──────────────────────────────────────────────────────────
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

  const [profileUser, setProfileUser] = useState(initialUser);
  const [profilePosts, setProfilePosts] = useState(initialPosts || []);
  const [selectedTab, setSelectedTab] = useState("posts");
  const [toast, setToast] = useState(null);
  const [followLoading, setFollowLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);
  // ✅ isLoadingUser ne bloque plus le rendu — sert uniquement au skeleton
  const [isLoadingUser, setIsLoadingUser] = useState(!initialUser);
  const [authToken, setAuthToken] = useState(null);

  const loadingRef = useRef(false);
  const saveDebounceTimer = useRef(null);
  const writeInProgress = useRef(false);
  const prefetchTimer = useRef(null);
  const observer = useRef();
  const requestCache = useRef(new Map());

  const targetUserId = userId || authUser?._id || authUser?.id;
  const authUserId = authUser?._id || authUser?.id;
  const isOwner = !!(targetUserId && authUserId && targetUserId === authUserId);

  const CACHE_DURATION = 30000;

  const showLocalToast = useCallback((msg, type = "success") => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const fetchUserById = useCallback(async (uid) => {
    if (!uid || uid === "undefined" || uid === "null") return null;
    const cached = requestCache.current.get(uid);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) return cached.data;
    if (!navigator.onLine) return null;
    try {
      const { data } = await axios.get(`${API_URL}/users/${uid}`, {
        withCredentials: true,
        headers: { "Cache-Control": "no-cache", "Pragma": "no-cache" },
        timeout: 8000,
      });
      requestCache.current.set(uid, { data, timestamp: Date.now() });
      return data;
    } catch (err) {
      if (err.code === "ERR_NETWORK" || err.code === "ECONNABORTED") return null;
      console.error("❌ Erreur fetchUserById:", err.message);
      return null;
    }
  }, []);

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
    if (saveDebounceTimer.current) clearTimeout(saveDebounceTimer.current);
    saveDebounceTimer.current = setTimeout(async () => {
      if (writeInProgress.current) return;
      writeInProgress.current = true;
      try {
        await idbSet(`profilePosts_${userKey}`, posts.map(normalizePost));
      } finally {
        writeInProgress.current = false;
      }
    }, 200);
  }, [isMockProfile]);

  const saveUser = useCallback(async (user) => {
    if (isMockProfile || !user?._id) return;
    try { await idbSetUser(user._id, user); } catch (err) { console.warn("IDB User Save Error", err); }
  }, [isMockProfile]);

  const handlePostCreated = useCallback(async (newPost) => {
    const normalized = normalizePost(newPost);
    if (!isMockProfile) await syncNewPost(normalized, profileUser._id);
    startTransition(() => setProfilePosts(prev => [normalized, ...prev]));
    showLocalToast("Post publié ! 🚀");
  }, [profileUser?._id, showLocalToast, isMockProfile]);

  const handlePostDeleted = useCallback(async (postId) => {
    if (!isMockProfile) await syncDeletePost(postId, profileUser._id);
    startTransition(() => setProfilePosts(prev => prev.filter(p => p._id !== postId)));
    showLocalToast("Post supprimé");
  }, [profileUser?._id, showLocalToast, isMockProfile]);

  const handleFollowSuccess = useCallback(() => showLocalToast("Abonné ! 🎉"), [showLocalToast]);

  const loadProfilePosts = useCallback(async (targetId, pageNumber = 1, append = false) => {
    if (!targetId || loadingRef.current) return;
    loadingRef.current = true;
    setIsLoadingPosts(true);
    try {
      let postsArray = [];
      let fromCache = false;

      if (isMockProfile && initialPosts && !append) {
        postsArray = initialPosts;
        fromCache = true;
        setProfilePosts(initialPosts);
      } else if (!isMockProfile) {
        const cached = await getCachedPosts(targetId);
        if (cached?.length > 0 && !append) {
          postsArray = cached;
          fromCache = true;
          setProfilePosts(cached);
        }
      }

      if (navigator.onLine && pageNumber === 1) {
        try {
          const result = await fetchUserPosts(targetId, pageNumber);
          if (Array.isArray(result) && result.length > 0) {
            postsArray = result;
            fromCache = false;
          }
        } catch {
          if (!postsArray.length && !isMockProfile) {
            const cached = await getCachedPosts(targetId);
            if (cached?.length > 0) { postsArray = cached; fromCache = true; }
          }
        }
      }

      setHasMore(postsArray.length > 0 && postsArray.length >= 20);
      startTransition(() => {
        setProfilePosts(prev => {
          const newPosts = append ? [...prev, ...postsArray] : postsArray;
          const unique = newPosts
            .reduce((acc, p) => (acc.find(x => x._id === p._id) ? acc : [...acc, p]), [])
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          if (!fromCache || append) savePosts(targetId, unique);
          return unique;
        });
      });
    } catch {
      showLocalToast("Mode hors ligne : Données limitées", "info");
    } finally {
      loadingRef.current = false;
      setIsLoadingPosts(false);
    }
  }, [fetchUserPosts, savePosts, showLocalToast, isMockProfile, initialPosts]);

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
    ? (profileUser.followers || []).some(u => (typeof u === "object" ? u._id : u) === authUserId)
    : null;

  const handleFollowToggle = useCallback(async () => {
    if (!authUser || !profileUser || followLoading) return;
    setFollowLoading(true);
    const wasFollowing = followStatus;
    const newFollowers = wasFollowing
      ? (profileUser.followers || []).filter(u => (typeof u === "object" ? u._id : u) !== authUserId)
      : [...(profileUser.followers || []), authUserId];
    startTransition(() => setProfileUser(prev => ({ ...prev, followers: newFollowers })));
    try {
      if (wasFollowing) await unfollowUser(profileUser._id);
      else await followUser(profileUser._id);
      showLocalToast(wasFollowing ? "Désabonné !" : "Abonné ! 🎉");
    } catch {
      const original = wasFollowing
        ? [...(profileUser.followers || []), authUserId]
        : (profileUser.followers || []).filter(u => (typeof u === "object" ? u._id : u) !== authUserId);
      startTransition(() => setProfileUser(prev => ({ ...prev, followers: original })));
      showLocalToast("Erreur lors de l'action", "error");
    } finally {
      setFollowLoading(false);
    }
  }, [authUser, profileUser, followStatus, followLoading, followUser, unfollowUser, showLocalToast, authUserId]);

  // ─── Effects ────────────────────────────────────────────────────────────────
  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); }, [targetUserId]);

  useEffect(() => {
    if (authUser && getToken) {
      getToken().then(setAuthToken).catch(() => {});
    }
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
      if (profileUser?._id) loadProfilePosts(profileUser._id, 1, false);
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [profileUser?._id, loadProfilePosts]);

  useEffect(() => {
    if (authLoading) return;
    if (!authUser) return navigate("/auth", { replace: true });
    if (initialUser) {
      setProfileUser(initialUser);
      setIsLoadingUser(false);
      return;
    }
    if (!targetUserId || targetUserId === "undefined") {
      setIsLoadingUser(false);
      return;
    }

    (async () => {
      setIsLoadingUser(true);
      try {
        await idbClearOtherKeys(`profilePosts_${targetUserId}`);

        if (isOwner) {
          // ✅ Affichage immédiat avec authUser (données locales disponibles)
          setProfileUser(authUser);
          saveUser(authUser);
          setIsLoadingUser(false); // ← débloque le rendu immédiatement
        } else {
          // ✅ Affichage immédiat depuis le cache IDB si dispo
          const cachedUser = await idbGetUser(targetUserId);
          if (cachedUser) {
            setProfileUser(cachedUser);
            setIsLoadingUser(false); // ← débloque le rendu avec le cache
          }

          if (navigator.onLine) {
            const fetchedUser = await fetchUserById(targetUserId);
            if (fetchedUser) {
              setProfileUser(fetchedUser); // ← mise à jour silencieuse
              saveUser(fetchedUser);
            } else if (!cachedUser) {
              showLocalToast("Profil inaccessible hors ligne", "error");
            }
          }

          if (!profileUser) setIsLoadingUser(false); // sécurité si pas de cache
        }

        const cached = await getCachedPosts(targetUserId);
        if (cached?.length > 0) setProfilePosts(cached);

        if (navigator.onLine) await loadProfilePosts(targetUserId, 1, false);

        setPage(1);
        setHasMore(true);
      } catch (err) {
        console.error("Profil Load Error:", err);
        setIsLoadingUser(false);
      }
    })();
  }, [authUser, authLoading, targetUserId, isOwner, fetchUserById, navigate, loadProfilePosts, saveUser, showLocalToast, initialUser]);

  useEffect(() => {
    if (!socket || !profileUser || isMockProfile) return;

    const handleNewPost = (post) => {
      const postUserId = typeof post.user === "object" ? post.user._id : post.user;
      if (postUserId !== profileUser._id) return;
      startTransition(() => {
        setProfilePosts(prev => {
          if (prev.find(p => p._id === post._id)) return prev;
          const next = [normalizePost(post), ...prev];
          savePosts(profileUser._id, next);
          return next;
        });
      });
    };

    const handleDeletedPost = (postId) => {
      startTransition(() => {
        setProfilePosts(prev => {
          const next = prev.filter(p => p._id !== postId);
          savePosts(profileUser._id, next);
          return next;
        });
      });
    };

    const handleUpdatedPost = (post) => {
      startTransition(() => {
        setProfilePosts(prev => {
          const next = prev.map(p => p._id === post._id ? normalizePost(post) : p);
          savePosts(profileUser._id, next);
          return next;
        });
      });
    };

    socket.on("newPost", handleNewPost);
    socket.on("postDeleted", handleDeletedPost);
    socket.on("postUpdated", handleUpdatedPost);
    return () => {
      socket.off("newPost", handleNewPost);
      socket.off("postDeleted", handleDeletedPost);
      socket.off("postUpdated", handleUpdatedPost);
    };
  }, [socket, profileUser, savePosts, isMockProfile]);

  // ─── Rendu ────────────────────────────────────────────────────────────────

  // ✅ Skeleton uniquement si pas de données du tout (premier chargement sans cache)
  // Si authUser est dispo (profil owner) ou cache IDB dispo → on affiche directement
  if ((authLoading || isLoadingUser) && !profileUser) {
    return <ProfileSkeleton isDarkMode={isDarkMode} />;
  }

  // Sécurité : ne devrait pas arriver mais évite un crash
  if (!profileUser) return <ProfileSkeleton isDarkMode={isDarkMode} />;

  const stats = {
    posts: profilePosts.length,
    followers: profileUser.followers?.length || 0,
    following: profileUser.following?.length || 0,
  };

  return (
    <div className={`profile-page min-h-screen p-4 transition-colors duration-200 ${
      isDarkMode ? "bg-black" : "bg-orange-50"
    }`}>
      {isMockProfile && (
        <div className="max-w-7xl mx-auto mb-4">
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg px-4 py-3">
            <p className="text-sm text-blue-500 text-center flex items-center justify-center gap-2">
              <span>👤</span>
              <span>Profil de démonstration - Toutes les interactions sont simulées</span>
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
              {isOwner && !isMockProfile && (
                <div className="mb-4">
                  <CreatePost
                    user={authUser}
                    onPostCreated={handlePostCreated}
                    showToast={showLocalToast}
                  />
                </div>
              )}

              {/* ✅ Skeleton posts uniquement si vraiment aucun post encore */}
              {isLoadingPosts && profilePosts.length === 0 ? (
                <div className="space-y-4">
                  {[0, 1, 2].map(i => (
                    <div key={i} className={`rounded-2xl p-4 space-y-3 ${isDarkMode ? "bg-gray-900" : "bg-white"}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full animate-pulse ${isDarkMode ? "bg-gray-700" : "bg-gray-200"}`} />
                        <div className={`h-4 w-32 rounded animate-pulse ${isDarkMode ? "bg-gray-700" : "bg-gray-200"}`} />
                      </div>
                      <div className={`h-4 w-full rounded animate-pulse ${isDarkMode ? "bg-gray-700" : "bg-gray-200"}`} />
                      <div className={`h-4 w-3/4 rounded animate-pulse ${isDarkMode ? "bg-gray-700" : "bg-gray-200"}`} />
                    </div>
                  ))}
                </div>
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
                  {isLoadingPosts && <PostsLoadingBar isDarkMode={isDarkMode} />}
                  {!hasMore && profilePosts.length > 0 && (
                    <p className={`text-center py-4 ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
                      Plus de posts
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {selectedTab === "settings" && isOwner && (
            <SettingsSection user={authUser} showToast={showLocalToast} />
          )}
        </div>

        {isOwner && authUser && authToken && (
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