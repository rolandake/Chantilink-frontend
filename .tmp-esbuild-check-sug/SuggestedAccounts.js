// src/pages/Home/SuggestedAccounts.jsx
import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  memo
} from "react";
import { useNavigate } from "react-router-dom";
import { CheckBadgeIcon } from "@heroicons/react/24/solid";
import { XMarkIcon, PlayIcon, UserPlusIcon } from "@heroicons/react/24/outline";
import { motion, AnimatePresence } from "framer-motion";
import axiosClient from "../../api/axiosClientGlobal";
import { useAuth } from "../../context/AuthContext";
var R2_PUBLIC_URL = import.meta.env.VITE_R2_PUBLIC_URL || "";
var URL_CACHE_PFX = "murl_";
var URL_CACHE_TTL = 80 * 60 * 1e3;
var DISMISSED_KEY = "sug_dismissed_v7";
var SHOWN_KEY = "sug_shown_v7";
var CARD_W = 178;
var FETCH_TIMEOUT = 8e3;
var isDev = import.meta.env.DEV;
var log = (...a) => {
  if (isDev) console.log("[SuggestedAccounts]", ...a);
};
var warn = (...a) => {
  if (isDev) console.warn("[SuggestedAccounts]", ...a);
};
var EXPIRABLE = [
  (u) => u.includes("videos.pexels.com/video-files/"),
  (u) => /cdn\.pixabay\.com\/video\/\d{4}\/\d{2}\/\d{2}\//.test(u)
];
var DEAD = ["youtube.com/watch", "youtu.be/", "dailymotion.com/video", "tiktok.com/@", "vimeo.com/"];
var urlRead = (k) => {
  try {
    const r = sessionStorage.getItem(URL_CACHE_PFX + k);
    if (!r) return null;
    const { url, exp } = JSON.parse(r);
    if (Date.now() > exp) {
      sessionStorage.removeItem(URL_CACHE_PFX + k);
      return null;
    }
    return url;
  } catch {
    return null;
  }
};
var isExpirable = (u) => typeof u === "string" && EXPIRABLE.some((fn) => fn(u));
var isDead = (u) => typeof u === "string" && DEAD.some((p) => u.includes(p));
var isValid = (u) => {
  if (!u || typeof u !== "string" || u.length < 8) return false;
  if (u.startsWith("data:") || u.startsWith("blob:") || u.startsWith("/")) return true;
  try {
    const x = new URL(u);
    return !!(x.hostname && x.pathname !== "/");
  } catch {
    return false;
  }
};
var isUsable = (u) => u && !isExpirable(u) && !isDead(u) && isValid(u);
var isVideoUrl = (u) => u && /\.(mp4|webm|mov|avi)$/i.test(u.split("?")[0]);
var resolveThumb = (u) => {
  if (!u || typeof u !== "string") return null;
  if (u.startsWith("data:") || u.startsWith("blob:") || u.startsWith("http")) return u;
  if (R2_PUBLIC_URL) return `${R2_PUBLIC_URL}/${u.replace(/^\/+/, "")}`;
  return u;
};
var extractPexelsId = (u) => {
  const m = (u || "").match(/video-files\/(\d+)\//) || (u || "").match(/^pexels_(\d+)$/);
  return m?.[1] || null;
};
var resolveExpired = async (url, externalId, signal) => {
  const pexId = extractPexelsId(url) || extractPexelsId(externalId || "") || (/^\d+$/.test(externalId) ? externalId : null);
  if (!pexId) return null;
  const cached = urlRead(`pexels_${pexId}`);
  if (cached) return cached;
  return null;
};
var getFirstMediaUrl = (post) => {
  const imgs = post.images || post.media;
  const arr = Array.isArray(imgs) ? imgs : imgs ? [imgs] : [];
  if (!arr.length) return null;
  const raw = arr[0];
  return typeof raw === "string" ? raw : raw?.url || null;
};
var scoreUser = (u, currentUser, shownIds) => {
  let score = 50;
  const mutuals = u.mutualCount || u.mutualFollowers?.length || 0;
  score += Math.min(30, mutuals * 8);
  const fl = u.followersCount || u.followers?.length || 0;
  if (fl > 1e5) score += 20;
  else if (fl > 1e4) score += 14;
  else if (fl > 1e3) score += 8;
  else if (fl > 100) score += 3;
  if (u.isVerified) score += 12;
  if (u.isPremium) score += 8;
  const lastSeen = u.lastActivity || u.updatedAt;
  if (lastSeen) {
    const ageH = (Date.now() - new Date(lastSeen).getTime()) / 36e5;
    if (ageH < 1) score += 15;
    else if (ageH < 24) score += 8;
    else if (ageH < 168) score += 3;
  }
  if (u.bio && u.bio.length > 20) score += 5;
  const shown = shownIds.filter((id) => id === u._id).length;
  score -= shown * 15;
  if (currentUser?.following?.includes(u._id)) score -= 100;
  return Math.max(0, Math.min(100, score));
};
var pickBestMedia = async (posts, signal) => {
  if (!posts?.length) return null;
  const videoCandidates = [];
  const imageCandidates = [];
  const textCandidates = [];
  for (const post of posts.slice(0, 15)) {
    if (signal?.aborted) break;
    const videoUrl = post.videoUrl || post.embedUrl;
    if (post.hasAudio === false) continue;
    if (videoUrl || isVideoUrl(getFirstMediaUrl(post))) {
      const url = videoUrl || getFirstMediaUrl(post);
      if (isUsable(url)) {
        videoCandidates.push({ url: resolveThumb(url), isVid: true, text: post.content || post.contenu || "", postId: post._id, likes: post.likesCount || 0 });
      } else if (isExpirable(url)) {
        try {
          const fresh = await resolveExpired(url, post.externalId, signal);
          if (fresh) videoCandidates.push({ url: resolveThumb(fresh), isVid: true, text: post.content || post.contenu || "", postId: post._id, likes: post.likesCount || 0 });
        } catch {
        }
      }
      continue;
    }
    const imgUrl = getFirstMediaUrl(post);
    if (imgUrl && !isDead(imgUrl)) {
      if (isUsable(imgUrl)) {
        const eng = (post.likesCount || 0) + (post.commentsCount || 0) * 2;
        imageCandidates.push({ url: resolveThumb(imgUrl), isVid: false, text: post.content || post.contenu || "", postId: post._id, eng });
      } else if (isExpirable(imgUrl)) {
        try {
          const fresh = await resolveExpired(imgUrl, post.externalId, signal);
          if (fresh) imageCandidates.push({ url: resolveThumb(fresh), isVid: false, text: post.content || post.contenu || "", postId: post._id, eng: 0 });
        } catch {
        }
      }
      continue;
    }
    const text = post.content || post.contenu;
    if (text && text.trim().length > 0) {
      textCandidates.push({ url: null, isVid: false, text: text.trim(), postId: post._id });
    }
  }
  if (videoCandidates.length) return videoCandidates[Math.floor(Math.random() * Math.min(videoCandidates.length, 3))];
  if (imageCandidates.length) {
    imageCandidates.sort((a, b) => (b.eng || 0) - (a.eng || 0));
    return imageCandidates[0];
  }
  if (textCandidates.length) return textCandidates[0];
  return null;
};
var fmtFollowers = (n) => {
  if (!n) return null;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M abonn\xE9s`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K abonn\xE9s`;
  return `${n} abonn\xE9s`;
};
var SilhouetteFallback = ({ height = 140, rounded = true }) => /* @__PURE__ */ React.createElement(
  "div",
  {
    className: `w-full flex items-center justify-center overflow-hidden cursor-pointer${rounded ? " rounded-xl" : ""}`,
    style: { height, background: "#1e1e24" }
  },
  /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 100 100", style: { width: height * 0.52, height: height * 0.52, opacity: 0.25 }, fill: "none" }, /* @__PURE__ */ React.createElement("circle", { cx: "50", cy: "36", r: "21", fill: "#888" }), /* @__PURE__ */ React.createElement("ellipse", { cx: "50", cy: "86", rx: "33", ry: "23", fill: "#888" }))
);
var AVATAR_COLORS = ["#f97316", "#ef4444", "#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#ec4899", "#6366f1"];
var SuggestAvatar = memo(({ username, photo, size = 36 }) => {
  const [err, setErr] = useState(false);
  const initials = useMemo(() => {
    if (!username) return "?";
    const p = username.trim().split(" ");
    return p.length > 1 ? (p[0][0] + p[1][0]).toUpperCase() : username.substring(0, 2).toUpperCase();
  }, [username]);
  const bg = useMemo(() => {
    let h = 0;
    for (let i = 0; i < (username || "").length; i++) h = username.charCodeAt(i) + ((h << 5) - h);
    return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
  }, [username]);
  const resolvedPhoto = useMemo(() => resolveThumb(photo), [photo]);
  if (err || !resolvedPhoto || !isValid(resolvedPhoto)) {
    return /* @__PURE__ */ React.createElement(
      "div",
      {
        className: "rounded-full flex items-center justify-center text-white font-bold select-none flex-shrink-0",
        style: { width: size, height: size, backgroundColor: bg, fontSize: size * 0.38 }
      },
      initials
    );
  }
  return /* @__PURE__ */ React.createElement(
    "img",
    {
      src: resolvedPhoto,
      alt: username,
      className: "rounded-full object-cover flex-shrink-0",
      style: { width: size, height: size },
      onError: () => setErr(true),
      loading: "lazy"
    }
  );
});
SuggestAvatar.displayName = "SuggestAvatar";
var ContentPreview = memo(({ media, isDarkMode, onClick, loading }) => {
  const [imgErr, setImgErr] = useState(false);
  if (loading) {
    return /* @__PURE__ */ React.createElement(
      "div",
      {
        className: `w-full rounded-xl ${isDarkMode ? "bg-gray-800" : "bg-gray-100"}`,
        style: { height: 140, animation: "sa-pulse 1.5s ease-in-out infinite" }
      }
    );
  }
  if (!media || !media.url && !media.text) {
    return /* @__PURE__ */ React.createElement("div", { onClick }, /* @__PURE__ */ React.createElement(SilhouetteFallback, { height: 140, rounded: true }));
  }
  if (media.isVid) {
    return /* @__PURE__ */ React.createElement(
      "div",
      {
        onClick,
        className: "w-full rounded-xl overflow-hidden cursor-pointer relative flex items-center justify-center",
        style: { height: 140, background: "#0d0d0d" }
      },
      media.url && !imgErr && /* @__PURE__ */ React.createElement(
        "img",
        {
          src: media.url,
          alt: "",
          className: "absolute inset-0 w-full h-full object-cover",
          loading: "lazy",
          onError: () => setImgErr(true)
        }
      ),
      /* @__PURE__ */ React.createElement("div", { className: "absolute inset-0 bg-black/40" }),
      /* @__PURE__ */ React.createElement("div", { className: "relative z-10 w-11 h-11 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30 shadow-lg" }, /* @__PURE__ */ React.createElement(PlayIcon, { className: "w-5 h-5 text-white ml-0.5" })),
      media.likes > 0 && /* @__PURE__ */ React.createElement("span", { className: "absolute bottom-2 left-2.5 text-white text-[10px] font-bold drop-shadow" }, "\u2764\uFE0F ", media.likes)
    );
  }
  if (media.url && !imgErr) {
    return /* @__PURE__ */ React.createElement("div", { onClick, className: "w-full rounded-xl overflow-hidden cursor-pointer relative", style: { height: 140 } }, /* @__PURE__ */ React.createElement(
      "img",
      {
        src: media.url,
        alt: "",
        className: "w-full h-full object-cover",
        loading: "lazy",
        onError: () => setImgErr(true)
      }
    ), /* @__PURE__ */ React.createElement("div", { className: "absolute inset-0 bg-gradient-to-t from-black/30 to-transparent pointer-events-none" }));
  }
  return /* @__PURE__ */ React.createElement(
    "div",
    {
      onClick,
      className: `w-full rounded-xl overflow-hidden cursor-pointer p-3 flex items-center justify-center ${isDarkMode ? "bg-gray-800" : "bg-gray-50"}`,
      style: { height: 140 }
    },
    /* @__PURE__ */ React.createElement("p", { className: `text-[11px] leading-relaxed line-clamp-5 text-center ${isDarkMode ? "text-gray-300" : "text-gray-600"}` }, media.text || "Voir le profil")
  );
});
ContentPreview.displayName = "ContentPreview";
var SuggestedUserCard = memo(({ user, onFollow, onDismiss, isDarkMode, relevanceScore }) => {
  const navigate = useNavigate();
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [media, setMedia] = useState(null);
  const [mediaReady, setMediaReady] = useState(false);
  const cardRef = useRef(null);
  const fetchedRef = useRef(false);
  const abortRef = useRef(null);
  useEffect(() => {
    const el = cardRef.current;
    if (!el || fetchedRef.current) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      obs.disconnect();
      if (fetchedRef.current || !user._id) {
        setMediaReady(true);
        return;
      }
      fetchedRef.current = true;
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const timeout = setTimeout(() => {
        ctrl.abort();
        warn(`Timeout fetch posts user=${user._id}`);
      }, FETCH_TIMEOUT);
      const delay = 60 + Math.random() * 200;
      setTimeout(async () => {
        try {
          const { data } = await axiosClient.get(
            `/posts/user/${user._id}?limit=12&page=1`,
            { signal: ctrl.signal }
          );
          const posts = Array.isArray(data) ? data : data?.posts || [];
          log(`User ${user._id} \u2192 ${posts.length} posts`);
          const picked = await pickBestMedia(posts, ctrl.signal);
          log(`User ${user._id} \u2192 media picked:`, picked?.url || picked?.text || null);
          setMedia(picked);
        } catch (e) {
          if (e?.name !== "CanceledError" && e?.name !== "AbortError") {
            warn(`Fetch posts failed for user=${user._id}`, e?.message);
          }
          setMedia(null);
        } finally {
          clearTimeout(timeout);
          setMediaReady(true);
        }
      }, delay);
    }, { rootMargin: "200px", threshold: 0 });
    obs.observe(el);
    return () => {
      obs.disconnect();
      abortRef.current?.abort();
    };
  }, [user._id]);
  const handleFollow = useCallback(async (e) => {
    e.stopPropagation();
    if (loading || following) return;
    setFollowing(true);
    setLoading(true);
    try {
      await onFollow?.(user._id);
    } catch {
      setFollowing(false);
    } finally {
      setLoading(false);
    }
  }, [loading, following, onFollow, user._id]);
  const handleDismiss = useCallback((e) => {
    e.stopPropagation();
    setDismissed(true);
    setTimeout(() => onDismiss?.(user._id), 260);
  }, [onDismiss, user._id]);
  const goProfile = useCallback(() => {
    if (user._id) navigate(`/profile/${user._id}`);
  }, [navigate, user._id]);
  const subText = useMemo(() => {
    if (user.mutualCount > 0) return `${user.mutualCount} ami${user.mutualCount > 1 ? "s" : ""} en commun`;
    if (user.followedByNames?.length) return `Suivi par ${user.followedByNames[0]}`;
    const fl = fmtFollowers(user.followersCount || user.followers?.length);
    if (fl) return fl;
    return user.bio ? user.bio.substring(0, 40) + (user.bio.length > 40 ? "\u2026" : "") : "Sugg\xE9r\xE9 pour toi";
  }, [user]);
  const relevancePct = Math.round(Math.min(100, Math.max(0, relevanceScore || 50)));
  return /* @__PURE__ */ React.createElement(AnimatePresence, null, !dismissed && /* @__PURE__ */ React.createElement(
    motion.div,
    {
      ref: cardRef,
      initial: { opacity: 1, scale: 1 },
      exit: { opacity: 0, scale: 0.86, x: -16 },
      transition: { type: "spring", damping: 24, stiffness: 300 },
      className: `relative flex-shrink-0 flex flex-col gap-2.5 p-3 rounded-2xl cursor-pointer select-none
            ${isDarkMode ? "bg-gray-900/90 border border-gray-800 hover:border-gray-700" : "bg-white border border-gray-100 hover:border-gray-200"} transition-colors`,
      style: {
        width: CARD_W,
        boxShadow: isDarkMode ? "0 4px 24px rgba(0,0,0,0.5)" : "0 2px 16px rgba(0,0,0,0.07)"
      },
      onClick: goProfile
    },
    /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: handleDismiss,
        className: `absolute top-2 right-2 z-20 w-5 h-5 rounded-full flex items-center justify-center transition-colors
              ${isDarkMode ? "text-gray-600 hover:text-gray-300 hover:bg-white/10" : "text-gray-400 hover:text-gray-700 hover:bg-gray-100"}`,
        style: { WebkitTapHighlightColor: "transparent" }
      },
      /* @__PURE__ */ React.createElement(XMarkIcon, { className: "w-3.5 h-3.5" })
    ),
    /* @__PURE__ */ React.createElement(
      ContentPreview,
      {
        media,
        isDarkMode,
        onClick: goProfile,
        loading: !mediaReady
      }
    ),
    /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2 pr-5" }, /* @__PURE__ */ React.createElement("div", { className: `rounded-full flex-shrink-0 ${user.isPremium || user.isVerified ? "p-[2px] bg-gradient-to-tr from-orange-400 via-pink-500 to-purple-500" : ""}` }, /* @__PURE__ */ React.createElement("div", { className: `rounded-full ${user.isPremium || user.isVerified ? `p-[1.5px] ${isDarkMode ? "bg-gray-900" : "bg-white"}` : ""}` }, /* @__PURE__ */ React.createElement(
      SuggestAvatar,
      {
        username: user.fullName,
        photo: user.profilePhoto || user.avatar || user.profilePicture,
        size: 34
      }
    ))), /* @__PURE__ */ React.createElement("div", { className: "flex-1 min-w-0" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-1" }, /* @__PURE__ */ React.createElement("span", { className: `text-[12px] font-bold truncate ${isDarkMode ? "text-white" : "text-gray-900"}` }, user.fullName || "Utilisateur"), user.isVerified && /* @__PURE__ */ React.createElement(CheckBadgeIcon, { className: "w-3.5 h-3.5 text-orange-500 flex-shrink-0" })), /* @__PURE__ */ React.createElement("p", { className: `text-[10px] leading-tight truncate mt-0.5 ${isDarkMode ? "text-gray-500" : "text-gray-400"}` }, subText))),
    /* @__PURE__ */ React.createElement("div", { className: `w-full h-0.5 rounded-full overflow-hidden ${isDarkMode ? "bg-gray-800" : "bg-gray-100"}` }, /* @__PURE__ */ React.createElement(
      "div",
      {
        className: "h-full rounded-full",
        style: {
          width: `${relevancePct}%`,
          background: "linear-gradient(90deg,#f97316,#ec4899)",
          transition: "width 0.6s ease"
        }
      }
    )),
    /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: handleFollow,
        onMouseDown: (e) => e.stopPropagation(),
        disabled: loading,
        style: following ? {} : { background: "linear-gradient(135deg,#f97316,#ec4899)" },
        className: `w-full py-2 rounded-xl text-[12px] font-bold transition-all active:scale-95 flex items-center justify-center gap-1.5
              ${following ? isDarkMode ? "bg-gray-800 text-gray-400 border border-gray-700" : "bg-gray-100 text-gray-500 border border-gray-200" : "text-white shadow-md"}`
      },
      loading ? /* @__PURE__ */ React.createElement("span", { className: "w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" }) : following ? "\u2713 Suivi(e)" : /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(UserPlusIcon, { className: "w-3.5 h-3.5" }), "Suivre")
    )
  ));
});
SuggestedUserCard.displayName = "SuggestedUserCard";
var poolFingerprint = (pool) => {
  if (!Array.isArray(pool) || !pool.length) return "";
  return pool.slice(0, 10).map((u) => u._id || "").join(",");
};
var SuggestedAccounts = memo(({ isDarkMode, instanceId = 0, userPool = null }) => {
  const { user: currentUser, updateUserProfile } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem(DISMISSED_KEY) || "[]");
    } catch {
      return [];
    }
  });
  const [shownIds] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem(SHOWN_KEY) || "[]");
    } catch {
      return [];
    }
  });
  const scrollRef = useRef(null);
  const fetchedRef = useRef(false);
  const lastPoolFpRef = useRef("");
  const fetchUsers = useCallback(async (signal) => {
    const routes = [
      "/users/suggestions?limit=24",
      "/users/suggestions?limit=24&fallback=true",
      "/users?limit=24&sort=followers",
      "/users?limit=24"
    ];
    for (const route of routes) {
      try {
        const { data } = await axiosClient.get(route, { signal });
        const list = Array.isArray(data) ? data : data?.users || data?.suggestions || data?.data || [];
        if (list.length > 0) {
          log(`Fetched ${list.length} users via ${route}`);
          return list;
        }
      } catch (e) {
        if (e?.name === "CanceledError" || e?.name === "AbortError") throw e;
        warn(`Route ${route} failed:`, e?.message);
      }
    }
    return [];
  }, []);
  useEffect(() => {
    if (!currentUser) return;
    if (userPool && userPool.length > 0) {
      const fp = poolFingerprint(userPool);
      if (fp === lastPoolFpRef.current) return;
      lastPoolFpRef.current = fp;
      fetchedRef.current = true;
      const filtered = userPool.filter((u) => u?._id && u._id !== currentUser?._id);
      const scored = filtered.map((u) => ({
        ...u,
        _relevanceScore: scoreUser(u, currentUser, shownIds)
      })).sort((a, b) => b._relevanceScore - a._relevanceScore);
      setUsers(scored);
      setLoading(false);
      log("Using updated userPool:", scored.length, "users (fp:", fp, ")");
      return;
    }
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    const ctrl = new AbortController();
    const timeout = setTimeout(() => {
      ctrl.abort();
      warn("Fetch users timeout");
    }, FETCH_TIMEOUT);
    (async () => {
      try {
        const list = await fetchUsers(ctrl.signal);
        const filtered = list.filter((u) => u?._id && u._id !== currentUser._id);
        if (!filtered.length) {
          warn("No users returned from any route");
          setError(true);
          return;
        }
        const scored = filtered.map((u) => ({
          ...u,
          _relevanceScore: scoreUser(u, currentUser, shownIds)
        })).sort((a, b) => b._relevanceScore - a._relevanceScore);
        setUsers(scored);
        setError(false);
        log("Fetched and scored:", scored.length, "users");
      } catch (e) {
        if (e?.name === "CanceledError" || e?.name === "AbortError") return;
        warn("Fatal fetch error:", e?.message);
        setError(true);
        fetchedRef.current = false;
      } finally {
        clearTimeout(timeout);
        setLoading(false);
      }
    })();
    return () => {
      ctrl.abort();
      clearTimeout(timeout);
    };
  }, [currentUser, userPool, fetchUsers, shownIds]);
  useEffect(() => {
    if (!users.length) return;
    const ids = users.slice(0, 6).map((u) => u._id);
    try {
      const prev = JSON.parse(sessionStorage.getItem(SHOWN_KEY) || "[]");
      sessionStorage.setItem(SHOWN_KEY, JSON.stringify([...prev, ...ids].slice(-50)));
    } catch {
    }
  }, [users]);
  const visibleUsers = useMemo(
    () => users.filter((u) => !dismissed.includes(u._id)),
    [users, dismissed]
  );
  const handleFollow = useCallback(async (userId) => {
    await axiosClient.post(`/follow/follow/${userId}`);
    updateUserProfile?.(currentUser._id, {
      following: [...currentUser?.following || [], userId]
    });
  }, [currentUser, updateUserProfile]);
  const handleDismiss = useCallback((userId) => {
    setDismissed((prev) => {
      const next = [...prev, userId];
      try {
        sessionStorage.setItem(DISMISSED_KEY, JSON.stringify(next));
      } catch {
      }
      return next;
    });
  }, []);
  const scrollByDir = useCallback((dir) => {
    scrollRef.current?.scrollBy({ left: dir * (CARD_W + 12), behavior: "smooth" });
  }, []);
  if (!currentUser) return null;
  if (loading) {
    return /* @__PURE__ */ React.createElement("div", { className: `w-full ${isDarkMode ? "bg-black" : "bg-white"}` }, /* @__PURE__ */ React.createElement("style", null, `@keyframes sa-pulse{0%,100%{opacity:1}50%{opacity:.45}}.sa-pulse{animation:sa-pulse 1.5s ease infinite}`), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-3 px-4 pt-5 pb-3" }, /* @__PURE__ */ React.createElement("div", { className: `flex-1 h-px ${isDarkMode ? "bg-gray-800" : "bg-gray-100"}` }), /* @__PURE__ */ React.createElement("span", { className: `text-[10px] font-black uppercase tracking-widest ${isDarkMode ? "text-orange-500" : "text-orange-400"}` }, "\u2728 Suggestions pour toi"), /* @__PURE__ */ React.createElement("div", { className: `flex-1 h-px ${isDarkMode ? "bg-gray-800" : "bg-gray-100"}` })), /* @__PURE__ */ React.createElement("div", { className: "flex gap-3 px-4 pb-5 overflow-hidden" }, [0, 1, 2].map((i) => /* @__PURE__ */ React.createElement(
      "div",
      {
        key: i,
        className: `sa-pulse flex-shrink-0 rounded-2xl ${isDarkMode ? "bg-gray-900" : "bg-gray-100"}`,
        style: { width: CARD_W, height: 270 }
      }
    ))));
  }
  if (error || visibleUsers.length === 0) {
    log("No visible users to display (error:", error, "visible:", visibleUsers.length, ")");
    return null;
  }
  return /* @__PURE__ */ React.createElement("div", { className: `w-full ${isDarkMode ? "bg-black" : "bg-white"}` }, /* @__PURE__ */ React.createElement("style", null, `@keyframes sa-pulse{0%,100%{opacity:1}50%{opacity:.45}}.sa-pulse{animation:sa-pulse 1.5s ease infinite}`), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-3 px-4 pt-5 pb-3" }, /* @__PURE__ */ React.createElement("div", { className: `flex-1 h-px ${isDarkMode ? "bg-gray-800" : "bg-gray-100"}` }), /* @__PURE__ */ React.createElement("span", { className: `text-[10px] font-black uppercase tracking-widest ${isDarkMode ? "text-orange-500" : "text-orange-400"}` }, "\u2728 Suggestions pour toi"), /* @__PURE__ */ React.createElement("div", { className: `flex-1 h-px ${isDarkMode ? "bg-gray-800" : "bg-gray-100"}` })), /* @__PURE__ */ React.createElement("div", { className: "relative px-4 pb-5" }, /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => scrollByDir(-1),
      className: `hidden sm:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full items-center justify-center shadow-lg border transition-all hover:scale-105 active:scale-95
            ${isDarkMode ? "bg-gray-800 text-white border-gray-700 hover:bg-gray-700" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"}`,
      style: { WebkitTapHighlightColor: "transparent" }
    },
    /* @__PURE__ */ React.createElement("svg", { className: "w-4 h-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24" }, /* @__PURE__ */ React.createElement("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M15 19l-7-7 7-7" }))
  ), /* @__PURE__ */ React.createElement(
    "div",
    {
      ref: scrollRef,
      className: "flex gap-3 overflow-x-auto",
      style: {
        scrollSnapType: "x mandatory",
        WebkitOverflowScrolling: "touch",
        scrollbarWidth: "none",
        msOverflowStyle: "none",
        paddingBottom: 2
      }
    },
    /* @__PURE__ */ React.createElement("style", null, `.sa-scroll::-webkit-scrollbar{display:none}`),
    visibleUsers.map((u) => /* @__PURE__ */ React.createElement("div", { key: u._id, style: { scrollSnapAlign: "start" } }, /* @__PURE__ */ React.createElement(
      SuggestedUserCard,
      {
        user: u,
        onFollow: handleFollow,
        onDismiss: handleDismiss,
        isDarkMode,
        relevanceScore: u._relevanceScore
      }
    )))
  ), /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => scrollByDir(1),
      className: `hidden sm:flex absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full items-center justify-center shadow-lg border transition-all hover:scale-105 active:scale-95
            ${isDarkMode ? "bg-gray-800 text-white border-gray-700 hover:bg-gray-700" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"}`,
      style: { WebkitTapHighlightColor: "transparent" }
    },
    /* @__PURE__ */ React.createElement("svg", { className: "w-4 h-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24" }, /* @__PURE__ */ React.createElement("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M9 5l7 7-7 7" }))
  )));
});
SuggestedAccounts.displayName = "SuggestedAccounts";
var SuggestedAccounts_default = SuggestedAccounts;
export {
  SuggestedAccounts_default as default
};
