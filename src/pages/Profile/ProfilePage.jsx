// src/pages/profile/ProfilePage.jsx - VERSION ULTRA-OPTIMISÉE
import React, { useState, useEffect, useCallback, useRef, memo, startTransition } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ProfileHeader from "./ProfileHeader";
import ProfileMenu from "./ProfileMenu";
import SettingsSection from "./SettingsSection";
import CreatePost from "../Home/CreatePost";
import PostCard from "../Home/PostCard";
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

// ============================================
// 🚀 UTILITAIRES OPTIMISÉS
// ============================================

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

// ============================================
// 🎨 COMPOSANTS MÉMORISÉS
// ============================================

const LoadingSpinner = memo(({ size = "12", darkMode = false, text = "Chargement..." }) => (
  <div className="text-center py-12">
    <div className={`inline-block w-${size} h-${size} border-4 rounded-full animate-spin ${
      darkMode 
        ? 'border-orange-400 border-t-transparent' 
        : 'border-orange-500 border-t-transparent'
    }`}></div>
    {text && (
      <p className={`mt-4 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
        {text}
      </p>
    )}
  </div>
));

const FollowButton = memo(({ 
  isFollowing, 
  isLoading, 
  onClick, 
  isDarkMode 
}) => (
  <button 
    onClick={onClick} 
    disabled={isLoading}
    className={`px-8 py-3 rounded-full font-semibold transition-all duration-200 shadow-md ${
      isFollowing 
        ? (isDarkMode 
            ? 'bg-gray-800 text-gray-200 hover:bg-gray-700 border border-white/10' 
            : 'bg-gray-200 text-gray-700 hover:bg-gray-300')
        : (isDarkMode
            ? 'bg-orange-600 text-white hover:bg-orange-700'
            : 'bg-orange-500 text-white hover:bg-orange-600')
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

const Toast = memo(({ message, type }) => (
  <div className={`fixed bottom-6 right-6 px-6 py-3 rounded-lg shadow-2xl transition-all duration-200 z-50 ${
    type === "error" 
      ? 'bg-red-500 text-white' 
      : type === "info"
      ? 'bg-blue-500 text-white'
      : 'bg-green-500 text-white'
  }`}>
    {message}
  </div>
));

// ============================================
// 📱 COMPOSANT PRINCIPAL
// ============================================

export default function ProfilePage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user: authUser, loading: authLoading, socket } = useAuth();
  const { fetchUserPosts } = usePosts();
  const { isDarkMode } = useDarkMode();

  const [profileUser, setProfileUser] = useState(null);
  const [profilePosts, setProfilePosts] = useState([]);
  const [selectedTab, setSelectedTab] = useState("posts");
  const [toast, setToast] = useState(null);
  const [followLoading, setFollowLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);
  const [isLoadingUser, setIsLoadingUser] = useState(true);

  const loadingRef = useRef(false);
  const saveDebounceTimer = useRef(null);
  const writeInProgress = useRef(false);
  const prefetchTimer = useRef(null);
  const observer = useRef();
  const requestCache = useRef(new Map());

  const targetUserId = userId || authUser?.id;
  const isOwner = targetUserId === authUser?.id;

  const CACHE_DURATION = 30000; // 30 secondes

  // ============================================
  // 🎯 CALLBACKS OPTIMISÉS
  // ============================================

  const showLocalToast = useCallback((msg, type = "success") => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const fetchUserById = useCallback(async (uid) => {
    if (!uid || uid === "undefined" || uid === "null") return null;

    // ✅ Cache en mémoire
    const cached = requestCache.current.get(uid);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.data;
    }

    if (!navigator.onLine) return null;

    try {
      const { data } = await axios.get(`${API_URL}/users/${uid}`, {
        withCredentials: true,
        headers: { "Cache-Control": "no-cache", "Pragma": "no-cache" },
        timeout: 8000
      });
      
      // ✅ Mise en cache
      requestCache.current.set(uid, { data, timestamp: Date.now() });
      return data;
    } catch (err) {
      if (err.code === "ERR_NETWORK" || err.code === "ECONNABORTED") {
        return null;
      }
      console.error("❌ Erreur fetchUserById:", err.message);
      return null;
    }
  }, []);

  const followUser = useCallback(async (uid) => {
    const { data } = await axios.post(`${API_URL}/users/${uid}/follow`, {}, {
      withCredentials: true
    });
    return data;
  }, []);

  const unfollowUser = useCallback(async (uid) => {
    const { data } = await axios.post(`${API_URL}/users/${uid}/unfollow`, {}, {
      withCredentials: true
    });
    return data;
  }, []);

  const savePosts = useCallback((userKey, posts) => {
    if (!userKey || !Array.isArray(posts)) return;
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
    }, 200); // ✅ Réduit de 400ms à 200ms
  }, []);

  const saveUser = useCallback(async (user) => {
    if (!user?._id) return;
    try { 
      await idbSetUser(user._id, user); 
    } catch(err) { 
      console.warn("IDB User Save Error", err); 
    }
  }, []);

  const handlePostCreated = useCallback(async (newPost) => {
    const normalized = normalizePost(newPost);
    await syncNewPost(normalized, profileUser._id);
    
    startTransition(() => {
      setProfilePosts(prev => [normalized, ...prev]);
    });
    
    showLocalToast("Post publié ! 🚀");
  }, [profileUser?._id, showLocalToast]);

  const handlePostDeleted = useCallback(async (postId) => {
    await syncDeletePost(postId, profileUser._id);
    
    startTransition(() => {
      setProfilePosts(prev => prev.filter(p => p._id !== postId));
    });
    
    showLocalToast("Post supprimé");
  }, [profileUser?._id, showLocalToast]);

  // ============================================
  // 🔄 CHARGEMENT DES POSTS
  // ============================================

  const loadProfilePosts = useCallback(async (targetId, pageNumber = 1, append = false) => {
    if (!targetId || loadingRef.current) return;
    loadingRef.current = true;
    setIsLoadingPosts(true);
    
    try {
      let postsArray = [];
      let fromCache = false;

      const cached = await getCachedPosts(targetId);
      if (cached && cached.length > 0 && !append) {
        postsArray = cached;
        fromCache = true;
        setProfilePosts(cached);
      }

      if (navigator.onLine && pageNumber === 1) {
        try {
          const result = await fetchUserPosts(targetId, pageNumber);
          if (Array.isArray(result) && result.length > 0) {
            postsArray = result;
            fromCache = false;
          }
        } catch (err) {
          if (!postsArray.length && cached && cached.length > 0) {
            postsArray = cached;
            fromCache = true;
          }
        }
      }

      setHasMore(postsArray.length > 0 && postsArray.length >= 20);
      
      startTransition(() => {
        setProfilePosts((prev) => {
          const newPosts = append ? [...prev, ...postsArray] : postsArray;
          const uniquePosts = newPosts.reduce((acc, post) => {
            if (!acc.find((p) => p._id === post._id)) acc.push(post);
            return acc;
          }, []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          
          if (!fromCache || append) savePosts(targetId, uniquePosts);
          return uniquePosts;
        });
      });
    } catch (err) {
      showLocalToast("Mode hors ligne : Données limitées", "info");
    } finally {
      loadingRef.current = false;
      setIsLoadingPosts(false);
    }
  }, [fetchUserPosts, savePosts, showLocalToast]);

  // ============================================
  // 🎨 INFINITE SCROLL OPTIMISÉ
  // ============================================

  const lastPostRef = useCallback((node) => {
    if (loadingRef.current) return;
    if (observer.current) observer.current.disconnect();
    
    observer.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore && !isLoadingPosts) {
        const nextPage = page + 1;
        setPage(nextPage);
        if (profileUser?._id) loadProfilePosts(profileUser._id, nextPage, true);
      }
    }, {
      rootMargin: '200px', // ✅ Charger 200px avant la fin
      threshold: 0.1
    });
    
    if (node) observer.current.observe(node);
  }, [page, hasMore, isLoadingPosts, loadProfilePosts, profileUser]);

  // ============================================
  // 🔌 FOLLOW / UNFOLLOW
  // ============================================

  const followStatus = profileUser && authUser && !isOwner
    ? (profileUser.followers || []).some(u => (typeof u === "object" ? u._id : u) === authUser.id)
    : null;

  const handleFollowToggle = useCallback(async () => {
    if (!authUser || !profileUser || followLoading) return;
    setFollowLoading(true);
    const wasFollowing = followStatus;
    
    try {
      const newFollowers = wasFollowing
        ? (profileUser.followers || []).filter(u => (typeof u === "object" ? u._id : u) !== authUser.id)
        : [...(profileUser.followers || []), authUser.id];

      // ✅ Update optimiste
      startTransition(() => {
        setProfileUser(prev => ({ ...prev, followers: newFollowers }));
      });

      if (wasFollowing) await unfollowUser(profileUser._id);
      else await followUser(profileUser._id);
      
      showLocalToast(wasFollowing ? "Désabonné !" : "Abonné ! 🎉");
    } catch (err) {
      console.error("❌ Erreur follow:", err);
      showLocalToast("Erreur lors de l'action", "error");
      
      // ✅ Rollback en cas d'erreur
      const originalFollowers = wasFollowing
        ? [...(profileUser.followers || []), authUser.id]
        : (profileUser.followers || []).filter(u => (typeof u === "object" ? u._id : u) !== authUser.id);
      
      startTransition(() => {
        setProfileUser(prev => ({ ...prev, followers: originalFollowers }));
      });
    } finally { 
      setFollowLoading(false); 
    }
  }, [authUser, profileUser, followStatus, followLoading, followUser, unfollowUser, showLocalToast]);

  // ============================================
  // 🎬 EFFECTS
  // ============================================

  // ✅ Setup IndexedDB + ServiceWorker
  useEffect(() => {
    (async () => {
      try { await registerServiceWorker(); } catch {}
      try { await setupIndexedDB(); } catch {}
    })();
  }, []);

  // ✅ Prefetch optimisé
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (prefetchTimer.current) clearTimeout(prefetchTimer.current);
    
    prefetchTimer.current = setTimeout(() => {
      const urls = extractImageUrls(profilePosts, 15); // ✅ Réduit de 30 à 15
      if (urls.length) prefetchImagesViaSW(urls);
    }, 300); // ✅ Réduit de 600ms à 300ms
    
    return () => clearTimeout(prefetchTimer.current);
  }, [profilePosts]);

  // ✅ Network recovery
  useEffect(() => {
    const handleOnline = () => {
      if (profileUser?._id) loadProfilePosts(profileUser._id, 1, false);
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [profileUser?._id, loadProfilePosts]);

  // ✅ Initial Profile Load
  useEffect(() => {
    if (authLoading) return;
    if (!authUser) return navigate("/auth", { replace: true });
    
    if (!targetUserId || targetUserId === "undefined") {
      setIsLoadingUser(false);
      return;
    }

    (async () => {
      setIsLoadingUser(true);
      try {
        await idbClearOtherKeys(`profilePosts_${targetUserId}`);

        if (isOwner) {
          setProfileUser(authUser);
          saveUser(authUser);
        } else {
          const cachedUser = await idbGetUser(targetUserId);
          if (cachedUser) setProfileUser(cachedUser);
          
          if (navigator.onLine) {
            const fetchedUser = await fetchUserById(targetUserId);
            if (fetchedUser) { 
              setProfileUser(fetchedUser);
              saveUser(fetchedUser);
            } else if (!cachedUser) {
              showLocalToast("Profil inaccessible hors ligne", "error");
            }
          }
        }

        const cached = await getCachedPosts(targetUserId);
        if (cached && cached.length > 0) setProfilePosts(cached);

        if (navigator.onLine) await loadProfilePosts(targetUserId, 1, false);

        setPage(1);
        setHasMore(true);
      } catch (err) {
        console.error("Profil Load Error:", err);
      } finally { 
        setIsLoadingUser(false); 
      }
    })();
  }, [authUser, authLoading, targetUserId, isOwner, fetchUserById, navigate, loadProfilePosts, saveUser, showLocalToast]);

  // ✅ Socket Events optimisés
  useEffect(() => {
    if (!socket || !profileUser) return;
    
    const handleNewPost = (post) => {
      const postUserId = typeof post.user === "object" ? post.user._id : post.user;
      if (postUserId === profileUser._id) {
        startTransition(() => {
          setProfilePosts((prev) => {
            if (prev.find((p) => p._id === post._id)) return prev;
            const newPosts = [normalizePost(post), ...prev];
            savePosts(profileUser._id, newPosts);
            return newPosts;
          });
        });
      }
    };
    
    const handleDeletedPost = (postId) => {
      startTransition(() => {
        setProfilePosts((prev) => {
          const newPosts = prev.filter((p) => p._id !== postId);
          savePosts(profileUser._id, newPosts);
          return newPosts;
        });
      });
    };
    
    const handleUpdatedPost = (post) => {
      startTransition(() => {
        setProfilePosts((prev) => {
          const newPosts = prev.map((p) => (p._id === post._id ? normalizePost(post) : p));
          savePosts(profileUser._id, newPosts);
          return newPosts;
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
  }, [socket, profileUser, savePosts]);

  // ============================================
  // 🎨 RENDU
  // ============================================

  const stats = {
    posts: profilePosts.length,
    followers: profileUser?.followers?.length || 0,
    following: profileUser?.following?.length || 0,
  };

  if (authLoading || isLoadingUser) {
    return (
      <div className={`profile-page min-h-screen p-4 flex items-center justify-center transition-colors duration-200 ${
        isDarkMode ? 'bg-black' : 'bg-orange-50'
      }`}>
        <LoadingSpinner darkMode={isDarkMode} />
      </div>
    );
  }

  return (
    <div className={`profile-page min-h-screen p-4 space-y-6 transition-colors duration-200 ${
      isDarkMode ? 'bg-black' : 'bg-orange-50'
    }`}>
      <ProfileHeader 
        user={profileUser || authUser}
        isOwnProfile={isOwner}
        posts={profilePosts}
        followers={profileUser?.followers || []}
        following={profileUser?.following || []}
        showToast={showLocalToast}
      />

      {!isOwner && profileUser && (
        <div className="text-center">
          <FollowButton
            isFollowing={followStatus}
            isLoading={followLoading}
            onClick={handleFollowToggle}
            isDarkMode={isDarkMode}
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
        <div className="space-y-4">
          {isOwner && (
            <CreatePost 
              user={authUser} 
              onPostCreated={handlePostCreated}
              showToast={showLocalToast} 
            />
          )}

          {isLoadingPosts && profilePosts.length === 0 ? (
            <LoadingSpinner darkMode={isDarkMode} text="Chargement des posts..." />
          ) : (
            <div className="space-y-4">
              {profilePosts.map((post, index) => (
                <div key={post._id} ref={index === profilePosts.length - 1 ? lastPostRef : null}>
                  <PostCard 
                    post={post} 
                    onDeleted={handlePostDeleted}
                    showToast={showLocalToast}
                  />
                </div>
              ))}
              
              {isLoadingPosts && (
                <div className="text-center py-4">
                  <div className={`inline-block w-8 h-8 border-4 rounded-full animate-spin ${
                    isDarkMode 
                      ? 'border-orange-400 border-t-transparent' 
                      : 'border-orange-500 border-t-transparent'
                  }`}></div>
                </div>
              )}
              
              {!hasMore && profilePosts.length > 0 && (
                <p className={`text-center py-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
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

      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}