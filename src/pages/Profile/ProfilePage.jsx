// src/pages/profile/ProfilePage.jsx
// ✅ Fix spinner infini
// ✅ Fix "Profil introuvable" pour bots et profils tiers
// ✅ Fix posts non affichés au premier rendu
// ✅ Profil BOT consultable — traité exactement comme un vrai utilisateur
// ✅ FIX HTTP 400 : garde ObjectId — attend un vrai _id MongoDB avant tout fetch
//    Les comptes auto (bots) ont de vrais ObjectIds → fonctionnent normalement
//    L'ID temporaire client (user_6_xxx) est ignoré jusqu'au vrai ID serveur

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
// GUARD ObjectId — 24 caractères hexadécimaux
// Les bots ont de vrais ObjectIds MongoDB (ex: 6651f3a2e4b0c12345678901)
// Les IDs temporaires clients (ex: user_6_1772309482858_41942) sont rejetés
// ─────────────────────────────────────────────
const isValidObjectId = (id) => /^[a-f\d]{24}$/i.test(String(id || ""));

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

// Reconstruit un profil minimal depuis le premier post d'un compte
// quand l'API /users/:id est indisponible ou retourne 404
// Fonctionne pour les bots ET les vrais utilisateurs
const buildUserFromPost = (post) => {
  if (!post) return null;
  const u = post.user || {};
  if (!u._id && !u.id) return null;
  return {
    _id:          u._id || u.id,
    username:     u.username     || "utilisateur",
    fullName:     u.fullName     || u.name || "Utilisateur",
    profilePhoto: u.profilePhoto || u.avatar || null,
    coverPhoto:   u.coverPhoto   || null,
    bio:          u.bio          || "",
    location:     u.location     || "",
    website:      u.website      || "",
    isVerified:   u.isVerified   ?? false,
    isPremium:    u.isPremium    ?? false,
    isBot:        u.isBot        ?? false,
    followers:    [],
    following:    [],
    createdAt:    null,
  };
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
    ) : isFollowing ? "Se desabonner" : "S'abonner"}
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
  // isBot : utilisé uniquement pour masquer Settings/CreatePost, PAS pour l'affichage
  const [isBot,          setIsBot]          = useState(false);

  const [isLoadingUser,  setIsLoadingUser]  = useState(!initialUser && !(isOwner && authUser));
  const [authToken,      setAuthToken]      = useState(null);

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

  const fetchUserById = useCallback(async (uid) => {
    if (!uid || uid === "undefined" || uid === "null") return null;
    // ✅ Ne requête pas le serveur avec un ID temporaire client
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
      const user = extractUserFromResponse(data);
      if (user) requestCache.current.set(uid, { data: user, timestamp: Date.now() });
      return user;
    } catch (err) {
      if (err.code === "ERR_NETWORK" || err.code === "ECONNABORTED") return null;
      console.warn(`[Profile] fetchUserById echoue pour ${uid}:`, err.message);
      return null;
    }
  }, []);

  // Fallback : reconstruit le profil depuis les posts publiés
  // Fonctionne pour les bots (qui ont de vrais ObjectIds) ET les vrais users
  const tryBuildProfileFromPosts = useCallback(async (uid) => {
    if (!isValidObjectId(uid)) return null;
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
    try { await idbSetUser(user._id, user); } catch (err) { console.warn("IDB User Save Error", err); }
  }, [isMockProfile]);

  const handlePostCreated = useCallback(async (newPost) => {
    const normalized = normalizePost(newPost);
    if (!isMockProfile) await syncNewPost(normalized, profileUser._id);
    startTransition(() => setProfilePosts(prev => [normalized, ...prev]));
    showLocalToast("Post publie !");
  }, [profileUser?._id, showLocalToast, isMockProfile]);

  const handlePostDeleted = useCallback(async (postId) => {
    if (!isMockProfile) await syncDeletePost(postId, profileUser._id);
    startTransition(() => setProfilePosts(prev => prev.filter(p => p._id !== postId)));
    showLocalToast("Post supprime");
  }, [profileUser?._id, showLocalToast, isMockProfile]);

  const handleFollowSuccess = useCallback(() => showLocalToast("Abonne !"), [showLocalToast]);

  const loadProfilePosts = useCallback(async (targetId, pageNumber = 1, append = false, prefetchedPosts = null) => {
    if (!targetId || loadingRef.current) return;
    // ✅ Garde ObjectId — ne lance aucun fetch avec un ID temporaire
    if (!isValidObjectId(targetId)) {
      console.warn(`[Profile] loadProfilePosts ignoré — ID non-MongoDB: ${targetId}`);
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
        return;
      }

      if (!isMockProfile && !append && !prefetchedPosts) {
        try {
          const cached = await getCachedPosts(targetId);
          if (Array.isArray(cached) && cached.length > 0) {
            postsArray = cached;
            startTransition(() => setProfilePosts(cached));
          }
        } catch (e) {
          console.warn("IDB cache read error:", e);
        }
      }

      if (navigator.onLine && !prefetchedPosts) {
        try {
          const result  = await fetchUserPosts(targetId, pageNumber);
          const fetched = extractPostsFromResult(result);
          if (fetched.length > 0) postsArray = fetched;
        } catch (networkErr) {
          console.error("[Profile] Erreur fetch posts reseau:", networkErr);
          if (postsArray.length === 0) showLocalToast("Mode hors ligne", "info");
        }
      }

      setHasMore(postsArray.length > 0 && postsArray.length >= 20);

      startTransition(() => {
        setProfilePosts(prev => {
          const base        = append ? prev : [];
          const merged      = [...base, ...postsArray];
          const seen        = new Set();
          const uniquePosts = merged
            .filter(p => { if (seen.has(p._id)) return false; seen.add(p._id); return true; })
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          if (!isMockProfile) savePosts(targetId, uniquePosts);
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
      showLocalToast(wasFollowing ? "Desabonne !" : "Abonne !");
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
  // useEffect principal
  // ✅ FIX : si l'ID propriétaire n'est pas encore un ObjectId valide (ID temporaire),
  //    on attend silencieusement sans lancer de fetch — React re-run quand authUser
  //    se met à jour avec le vrai _id serveur.
  //    Les bots ont toujours un vrai ObjectId → chargement normal immédiat.
  // ─────────────────────────────────────────────
  useEffect(() => {
    if (authLoading) return;
    if (!authUser) { navigate("/auth", { replace: true }); return; }

    if (initialUser) {
      setProfileUser(initialUser);
      setIsBot(!!initialUser.isBot);
      setIsLoadingUser(false);
      if (targetUserId && isValidObjectId(targetUserId)) {
        loadProfilePosts(targetUserId, 1, false);
      }
      return;
    }

    if (!targetUserId || targetUserId === "undefined") {
      setIsLoadingUser(false);
      return;
    }

    // ✅ Si on consulte son propre profil et que l'ID est encore temporaire,
    //    on attend que authUser soit mis à jour avec le vrai ObjectId MongoDB.
    //    Pendant ce temps on affiche le profil depuis authUser (sans fetch réseau).
    if (isOwner && !isValidObjectId(targetUserId)) {
      console.warn(`[Profile] ID propriétaire temporaire détecté (${targetUserId}) — attente du vrai ObjectId...`);
      setProfileUser(authUser);
      setIsBot(false);
      setIsLoadingUser(false);
      // Pas de loadProfilePosts ici — on attend le re-render avec le bon ID
      return;
    }

    (async () => {
      setIsLoadingUser(true);
      try {
        await idbClearOtherKeys(`profilePosts_${targetUserId}`);

        if (isOwner) {
          // Propriétaire avec un vrai ObjectId
          setProfileUser(authUser);
          setIsBot(false);
          saveUser(authUser);
          if (navigator.onLine) {
            fetchUserById(authUserId).then(fresh => {
              if (fresh) { setProfileUser(fresh); saveUser(fresh); }
            }).catch(() => {});
          }
        } else {
          // Profil tiers (autre user ou bot)
          const cachedUser = await idbGetUser(targetUserId);
          if (cachedUser) {
            setProfileUser(cachedUser);
            setIsBot(!!cachedUser.isBot);
          }

          if (navigator.onLine) {
            const fetchedUser = await fetchUserById(targetUserId);

            if (fetchedUser) {
              setProfileUser(fetchedUser);
              setIsBot(!!fetchedUser.isBot);
              saveUser(fetchedUser);
            } else if (!cachedUser) {
              // Fallback : reconstruit depuis les posts
              // Fonctionne pour tous les comptes : bots ET vrais utilisateurs
              const fallback = await tryBuildProfileFromPosts(targetUserId);
              if (fallback) {
                setProfileUser(fallback.user);
                setIsBot(!!fallback.user.isBot);
                saveUser(fallback.user);
                setPage(1);
                setHasMore(fallback.posts.length >= 20);
                await loadProfilePosts(targetUserId, 1, false, fallback.posts);
                return;
              } else {
                showLocalToast("Profil inaccessible", "error");
              }
            }
          } else if (!cachedUser) {
            showLocalToast("Profil non disponible hors ligne", "info");
          }
        }

        setPage(1);
        setHasMore(true);
        await loadProfilePosts(targetUserId, 1, false);

      } catch (err) {
        console.error("Profil Load Error:", err);
        showLocalToast("Erreur lors du chargement", "error");
      } finally {
        setIsLoadingUser(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, authUser?._id, targetUserId, isOwner]);

  // Socket temps réel (désactivé pour les bots — pas de nouveaux posts en direct)
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
          return updated;
        });
      });
    };
    const handleDeletedPost = (postId) => {
      startTransition(() => {
        setProfilePosts(prev => {
          const updated = prev.filter(p => p._id !== postId);
          savePosts(profileUser._id, updated);
          return updated;
        });
      });
    };
    const handleUpdatedPost = (post) => {
      startTransition(() => {
        setProfilePosts(prev => {
          const updated = prev.map(p => p._id === post._id ? normalizePost(post) : p);
          savePosts(profileUser._id, updated);
          return updated;
        });
      });
    };
    socket.on("newPost",      handleNewPost);
    socket.on("postDeleted",  handleDeletedPost);
    socket.on("postUpdated",  handleUpdatedPost);
    return () => {
      socket.off("newPost",     handleNewPost);
      socket.off("postDeleted", handleDeletedPost);
      socket.off("postUpdated", handleUpdatedPost);
    };
  }, [socket, profileUser?._id, savePosts, isMockProfile, isBot]);

  const stats = {
    posts:     profilePosts.length,
    followers: profileUser?.followers?.length || 0,
    following: profileUser?.following?.length || 0,
  };

  if (authLoading || (isLoadingUser && !profileUser)) {
    return (
      <div className={`profile-page min-h-screen p-4 flex items-center justify-center transition-colors duration-200 ${
        isDarkMode ? "bg-black" : "bg-orange-50"
      }`}>
        <LoadingSpinner darkMode={isDarkMode} />
      </div>
    );
  }

  if (!profileUser) {
    return (
      <div className={`profile-page min-h-screen p-4 flex items-center justify-center transition-colors duration-200 ${
        isDarkMode ? "bg-black" : "bg-orange-50"
      }`}>
        <div className="text-center">
          <p className={`text-lg font-medium ${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>
            Profil introuvable
          </p>
          <button
            onClick={() => navigate(-1)}
            className="mt-4 px-6 py-2 bg-orange-500 text-white rounded-full font-semibold hover:bg-orange-600 transition"
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
              <span>Profil de demonstration - Toutes les interactions sont simulees</span>
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

          {/* S'abonner visible pour tous les profils tiers, bots inclus */}
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
              {/* CreatePost uniquement pour les vrais propriétaires non-bots */}
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
                <div className={`text-center py-12 ${isDarkMode ? "text-gray-500" : "text-gray-400"}`}>
                  <p className="text-4xl mb-3">📭</p>
                  <p className="text-base font-medium">
                    {isOwner ? "Tu n'as pas encore publie de post" : "Aucun post pour l'instant"}
                  </p>
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
                    <p className={`text-center py-4 ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
                      Plus de posts
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Settings uniquement pour les vrais propriétaires */}
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