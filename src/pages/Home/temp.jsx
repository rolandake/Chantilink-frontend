// 📁 src/pages/Home/SuggestedPostPreview.jsx
// Suggestion pleine largeur d'UN profil avec l'une de ses publications
// ✅ v3 : vidéos mp4 jouées directement dans la carte (autoplay muted, tap pour son)

import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import { useNavigate } from "react-router-dom";
import { CheckBadgeIcon } from "@heroicons/react/24/solid";
import { XMarkIcon, PlayIcon, SpeakerWaveIcon, SpeakerXMarkIcon } from "@heroicons/react/24/outline";
import { motion, AnimatePresence } from "framer-motion";
import axiosClient from "../../api/axiosClientGlobal";
import { useAuth } from "../../context/AuthContext";

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "dlymdclhe";
const IMG_BASE   = `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/`;
const VID_BASE   = `https://res.cloudinary.com/${CLOUD_NAME}/video/upload/`;

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
const isVideoUrl  = (url) => url && /\.(mp4|webm|mov|avi)$/i.test(url.split("?")[0]);
const isEmbedUrl  = (url) => url && (url.includes("youtube") || url.includes("youtu.be") || url.includes("vimeo"));
const isCloudinary = (url) => url && url.includes("res.cloudinary.com");
const isExternal   = (url) => url && url.startsWith("http");

const resolveMediaUrl = (url) => {
  if (!url || typeof url !== "string") return null;
  if (url.startsWith("data:") || url.startsWith("blob:") || url.startsWith("http")) return url;
  const id = url.replace(/^\/+/, "");
  if (isVideoUrl(id)) return `${VID_BASE}q_auto:good,f_auto,w_800,c_limit/${id}`;
  return `${IMG_BASE}q_auto,f_auto,w_800,c_limit/${id}`;
};

const getVideoPoster = (videoUrl) => {
  if (!videoUrl) return null;
  try {
    if (isCloudinary(videoUrl)) {
      const idx = videoUrl.indexOf("/upload/");
      if (idx === -1) return null;
      const after = videoUrl.substring(idx + 8);
      const segs  = after.split("/");
      const pub   = segs.filter(s => !s.includes(",") && !(/^[a-z]+_[a-z]/.test(s) && !s.includes("."))).join("/")
                        .replace(/\.(mp4|webm|mov|avi)$/i, "");
      return pub ? `${IMG_BASE}q_auto:good,f_jpg,w_800,c_limit,so_0/${pub}.jpg` : null;
    }
    if (videoUrl.includes("videos.pexels.com")) {
      const m = videoUrl.match(/video-files\/(\d+)\//);
      if (m) return `https://images.pexels.com/videos/${m[1]}/pictures/preview-0.jpg`;
    }
    if (videoUrl.includes("cdn.pixabay.com")) {
      return videoUrl.replace(/_large\.mp4$/i, "_tiny.jpg").replace(/_medium\.mp4$/i, "_tiny.jpg");
    }
  } catch {}
  return null;
};

const pickBestPost = (posts) => {
  if (!posts?.length) return null;

  const withImg = posts.filter(p => {
    const arr = Array.isArray(p.images || p.media) ? (p.images || p.media) : [];
    const raw = arr[0]; const url = typeof raw === "string" ? raw : raw?.url;
    return url && !isVideoUrl(url) && !isEmbedUrl(url);
  });

  const withVid = posts.filter(p => {
    if (isVideoUrl(p.videoUrl) || isEmbedUrl(p.embedUrl)) return true;
    const arr = Array.isArray(p.media) ? p.media : [];
    return arr.some(m => isVideoUrl(typeof m === "string" ? m : m?.url));
  });

  // Priorité : image > vidéo > texte
  const pool = withImg.length > 0 ? withImg : withVid.length > 0 ? withVid : posts;
  const post = pool[Math.floor(Math.random() * Math.min(pool.length, 6))];
  if (!post) return null;

  const imgs   = post.images || post.media;
  const arr    = Array.isArray(imgs) ? imgs : (imgs ? [imgs] : []);
  const raw    = arr[0];
  const rawUrl = typeof raw === "string" ? raw : raw?.url;

  // Déterminer le type réel
  const vidUrl = isVideoUrl(rawUrl) ? rawUrl : isVideoUrl(post.videoUrl) ? post.videoUrl : null;
  const imgUrl = !vidUrl && rawUrl && !isEmbedUrl(rawUrl) ? rawUrl : null;
  const embed  = isEmbedUrl(post.embedUrl) ? post.embedUrl : isEmbedUrl(rawUrl) ? rawUrl : null;

  return {
    type:     vidUrl ? "video" : embed ? "embed" : imgUrl ? "image" : "text",
    mediaUrl: resolveMediaUrl(vidUrl || imgUrl || embed),
    videoUrl: vidUrl ? resolveMediaUrl(vidUrl) : null,
    poster:   vidUrl ? (post.thumbnail || getVideoPoster(resolveMediaUrl(vidUrl))) : null,
    embedUrl: embed,
    text:     post.content || post.contenu || "",
    likes:    Array.isArray(post.likes) ? post.likes.length : (post.likesCount || 0),
    comments: Array.isArray(post.comments) ? post.comments.length : (post.commentsCount || 0),
    postId:   post._id,
  };
};

const fmtNum = (n) => {
  if (!n) return "0";
  if (n >= 1_000_000) return `${(n/1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n/1_000).toFixed(1)}K`;
  return String(n);
};

// ─────────────────────────────────────────────
// AVATAR
// ─────────────────────────────────────────────
const Avatar = memo(({ username, photo, size = 44 }) => {
  const [err, setErr] = useState(false);
  const initials = useMemo(() => {
    if (!username) return "?";
    const p = username.trim().split(" ");
    return p.length > 1 ? (p[0][0]+p[1][0]).toUpperCase() : username.substring(0,2).toUpperCase();
  }, [username]);
  const bg = useMemo(() => {
    const c = ["#f97316","#ef4444","#8b5cf6","#3b82f6","#10b981","#f59e0b","#ec4899","#6366f1"];
    let h = 0;
    for (let i = 0; i < (username||"").length; i++) h = username.charCodeAt(i)+((h<<5)-h);
    return c[Math.abs(h)%c.length];
  }, [username]);
  if (err || !photo)
    return <div className="rounded-full flex items-center justify-center text-white font-bold select-none flex-shrink-0"
      style={{width:size,height:size,backgroundColor:bg,fontSize:size*0.38}}>{initials}</div>;
  return <img src={photo} alt={username} className="rounded-full object-cover flex-shrink-0"
    style={{width:size,height:size}} onError={()=>setErr(true)} loading="lazy"/>;
});
Avatar.displayName = "Avatar";

// ─────────────────────────────────────────────
// MEDIA BLOCK — image / vidéo native / embed / texte
// ─────────────────────────────────────────────
const MediaBlock = memo(({ post, isDarkMode, onVideoClick }) => {
  const videoRef  = useRef(null);
  const [muted,   setMuted]   = useState(true);
  const [playing, setPlaying] = useState(false);
  const [imgErr,  setImgErr]  = useState(false);
  const [showPlay, setShowPlay] = useState(false);

  // Autoplay quand visible
  useEffect(() => {
    if (post?.type !== "video" || !videoRef.current) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        videoRef.current?.play().catch(() => {});
        setPlaying(true);
      } else {
        videoRef.current?.pause();
        setPlaying(false);
      }
    }, { threshold: 0.4 });
    obs.observe(videoRef.current);
    return () => obs.disconnect();
  }, [post?.type]);

  const toggleMute = useCallback((e) => {
    e.stopPropagation();
    const vid = videoRef.current;
    if (!vid) return;
    const next = !vid.muted;
    vid.muted  = next;
    vid.volume = next ? 0 : 1;
    if (!next && vid.paused) vid.play().catch(()=>{});
    setMuted(next);
  }, []);

  const togglePlay = useCallback((e) => {
    e.stopPropagation();
    const vid = videoRef.current;
    if (!vid) return;
    if (vid.paused) { vid.play().catch(()=>{}); setPlaying(true); }
    else            { vid.pause(); setPlaying(false); }
  }, []);

  if (!post) return (
    <div className="w-full flex items-center justify-center"
      style={{height:180, background:"linear-gradient(135deg,#f97316,#ec4899)"}}>
      <span className="text-white text-4xl">✨</span>
    </div>
  );

  // ── VIDÉO NATIVE ──
  if (post.type === "video" && post.videoUrl) return (
    <div className="relative w-full bg-black" style={{ aspectRatio: "4/3" }}
      onMouseEnter={()=>setShowPlay(true)} onMouseLeave={()=>setShowPlay(false)}>
      <video
        ref={videoRef}
        src={post.videoUrl}
        poster={post.poster || undefined}
        className="w-full h-full object-contain"
        muted loop playsInline preload="metadata"
        onPlay={()=>setPlaying(true)}
        onPause={()=>setPlaying(false)}
        onClick={togglePlay}
        style={{ cursor: "pointer" }}
      />

      {/* Overlay stats */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none" />

      {/* Bouton play/pause centré (hover desktop) */}
      <AnimatePresence>
        {(showPlay || !playing) && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.15 }}
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center pointer-events-auto"
            style={{ background: "transparent" }}
          >
            <div className="w-14 h-14 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center border border-white/30">
              {playing
                ? <div className="flex gap-1.5"><div className="w-1.5 h-6 bg-white rounded-full"/><div className="w-1.5 h-6 bg-white rounded-full"/></div>
                : <PlayIcon className="w-7 h-7 text-white ml-1"/>}
            </div>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Bouton mute bas droite */}
      <button onClick={toggleMute}
        className="absolute bottom-3 right-3 z-10 w-8 h-8 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white border border-white/20"
        style={{ WebkitTapHighlightColor: "transparent" }}>
        {muted ? <SpeakerXMarkIcon className="w-4 h-4"/> : <SpeakerWaveIcon className="w-4 h-4"/>}
      </button>

      {/* Stats */}
      {(post.likes > 0 || post.comments > 0) && (
        <div className="absolute bottom-3 left-3 flex items-center gap-3 pointer-events-none">
          {post.likes > 0 && <span className="text-white text-xs font-bold drop-shadow">❤️ {fmtNum(post.likes)}</span>}
          {post.comments > 0 && <span className="text-white text-xs font-bold drop-shadow">💬 {fmtNum(post.comments)}</span>}
        </div>
      )}
    </div>
  );

  // ── IMAGE ──
  if (post.type === "image" && post.mediaUrl && !imgErr) return (
    <div className="relative w-full bg-black" style={{ aspectRatio: "4/3" }}>
      <img src={post.mediaUrl} alt="" className="w-full h-full object-cover"
        loading="lazy" onError={()=>setImgErr(true)}/>
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none"/>
      {(post.likes > 0 || post.comments > 0) && (
        <div className="absolute bottom-3 left-3 flex items-center gap-3 pointer-events-none">
          {post.likes > 0 && <span className="text-white text-xs font-bold drop-shadow">❤️ {fmtNum(post.likes)}</span>}
          {post.comments > 0 && <span className="text-white text-xs font-bold drop-shadow">💬 {fmtNum(post.comments)}</span>}
        </div>
      )}
    </div>
  );

  // ── EMBED (YouTube/Vimeo) → thumbnail cliquable ──
  if (post.type === "embed") return (
    <div className="relative w-full flex items-center justify-center bg-black" style={{ aspectRatio: "4/3" }}>
      {post.mediaUrl && !imgErr
        ? <img src={post.mediaUrl} alt="" className="w-full h-full object-cover" loading="lazy" onError={()=>setImgErr(true)}/>
        : <div className="w-full h-full" style={{background:"linear-gradient(135deg,#1a1a2e,#16213e)"}}/>
      }
      <div className="absolute inset-0 bg-black/40"/>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-14 h-14 rounded-full bg-red-600/90 flex items-center justify-center shadow-xl">
          <PlayIcon className="w-7 h-7 text-white ml-1"/>
        </div>
      </div>
      {(post.likes > 0 || post.comments > 0) && (
        <div className="absolute bottom-3 left-3 flex items-center gap-3 pointer-events-none">
          {post.likes > 0 && <span className="text-white text-xs font-bold drop-shadow">❤️ {fmtNum(post.likes)}</span>}
          {post.comments > 0 && <span className="text-white text-xs font-bold drop-shadow">💬 {fmtNum(post.comments)}</span>}
        </div>
      )}
    </div>
  );

  // ── TEXTE SEUL ──
  return (
    <div className="relative w-full flex items-center justify-center p-6"
      style={{minHeight:160, background: isDarkMode
        ? "linear-gradient(135deg,#1a1a2e,#16213e)"
        : "linear-gradient(135deg,#fff7ed,#fce7f3)"}}>
      <p className={`text-sm leading-relaxed text-center line-clamp-6 font-medium
        ${isDarkMode ? "text-gray-200" : "text-gray-700"}`}>{post.text}</p>
    </div>
  );
});
MediaBlock.displayName = "MediaBlock";

// ─────────────────────────────────────────────
// COMPOSANT PRINCIPAL
// ─────────────────────────────────────────────
const SuggestedPostPreview = memo(({ isDarkMode, userPool = [], slotIndex = 0 }) => {
  const navigate = useNavigate();
  const { user: currentUser, updateUserProfile } = useAuth();

  const [post,       setPost]       = useState(null);
  const [user,       setUser]       = useState(null);
  const [ready,      setReady]      = useState(false);
  const [following,  setFollowing]  = useState(false);
  const [loadFollow, setLoadFollow] = useState(false);
  const [hidden,     setHidden]     = useState(false);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current || !userPool.length) return;
    fetchedRef.current = true;
    const picked = userPool[slotIndex % userPool.length];
    if (!picked?._id) { setReady(true); return; }
    setUser(picked);
    (async () => {
      try {
        const { data } = await axiosClient.get(`/posts/user/${picked._id}?limit=8&page=1`);
        const posts = Array.isArray(data) ? data : (data?.posts || []);
        setPost(pickBestPost(posts));
      } catch { setPost(null); }
      finally { setReady(true); }
    })();
  }, [userPool, slotIndex]);

  const handleFollow = useCallback(async (e) => {
    e.stopPropagation();
    if (loadFollow || following || !user?._id) return;
    setFollowing(true); setLoadFollow(true);
    try {
      await axiosClient.post(`/follow/follow/${user._id}`);
      updateUserProfile?.(currentUser._id, { following: [...(currentUser?.following||[]), user._id] });
    } catch { setFollowing(false); }
    finally { setLoadFollow(false); }
  }, [loadFollow, following, user, currentUser, updateUserProfile]);

  const goProfile = useCallback(() => { if (user?._id) navigate(`/profile/${user._id}`); }, [navigate, user]);
  const handleHide = useCallback((e) => { e.stopPropagation(); setHidden(true); }, []);

  // Skeleton
  if (!ready) return (
    <div className={`w-full ${isDarkMode ? "bg-black" : "bg-white"}`}>
      <div className="flex items-center gap-3 px-4 pt-5 pb-3">
        <div className={`flex-1 h-px ${isDarkMode ? "bg-gray-800" : "bg-gray-100"}`}/>
        <span className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? "text-orange-500" : "text-orange-400"}`}>👤 Profil suggéré</span>
        <div className={`flex-1 h-px ${isDarkMode ? "bg-gray-800" : "bg-gray-100"}`}/>
      </div>
      <div className="px-4 pb-5">
        <div className={`w-full rounded-2xl animate-pulse ${isDarkMode ? "bg-gray-900" : "bg-gray-100"}`} style={{height:340}}/>
      </div>
    </div>
  );

  if (hidden || !user) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -16 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className={`w-full ${isDarkMode ? "bg-black" : "bg-white"}`}
      >
        {/* Titre */}
        <div className="flex items-center gap-3 px-4 pt-5 pb-3">
          <div className={`flex-1 h-px ${isDarkMode ? "bg-gray-800" : "bg-gray-100"}`}/>
          <span className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? "text-orange-500" : "text-orange-400"}`}>
            👤 Profil suggéré
          </span>
          <div className={`flex-1 h-px ${isDarkMode ? "bg-gray-800" : "bg-gray-100"}`}/>
        </div>

        {/* Carte */}
        <div className="px-4 pb-5">
          <div
            className={`relative w-full rounded-2xl overflow-hidden
              ${isDarkMode ? "bg-gray-900 border border-gray-800" : "bg-white border border-gray-100"} shadow-md`}
          >
            {/* Bouton masquer */}
            <button onClick={handleHide}
              className="absolute top-3 right-3 z-20 w-7 h-7 rounded-full flex items-center justify-center bg-black/50 backdrop-blur-sm text-white"
              style={{ WebkitTapHighlightColor: "transparent" }}>
              <XMarkIcon className="w-4 h-4"/>
            </button>

            {/* Media cliquable → profil */}
            <div onClick={goProfile} style={{ cursor: "pointer" }}>
              <MediaBlock post={post} isDarkMode={isDarkMode} />
            </div>

            {/* Infos profil */}
            <div className="p-4 flex items-center gap-3" onClick={goProfile} style={{ cursor: "pointer" }}>
              <div className={`rounded-full p-[2px] flex-shrink-0 ${user.isPremium ? "bg-gradient-to-tr from-orange-400 via-pink-500 to-purple-500" : ""}`}>
                <div className={`rounded-full p-[2px] ${isDarkMode ? "bg-gray-900" : "bg-white"}`}>
                  <Avatar username={user.fullName} photo={user.profilePhoto} size={44}/>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={`text-sm font-bold truncate ${isDarkMode ? "text-white" : "text-gray-900"}`}>{user.fullName}</span>
                  {user.isVerified && <CheckBadgeIcon className="w-4 h-4 text-orange-500 flex-shrink-0"/>}
                </div>
                <p className={`text-xs mt-0.5 truncate ${isDarkMode ? "text-gray-500" : "text-gray-400"}`}>
                  {user.bio ? user.bio.substring(0,50)+(user.bio.length>50?"…":"") : "Suggéré pour toi"}
                </p>
              </div>
              {/* Bouton Suivre */}
              <button onClick={handleFollow} disabled={loadFollow}
                className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-all active:scale-95
                  ${following
                    ? isDarkMode ? "bg-gray-800 text-gray-400 border border-gray-700" : "bg-gray-100 text-gray-500 border border-gray-200"
                    : "bg-gradient-to-r from-orange-500 to-pink-500 text-white shadow-sm"}`}
                style={{ WebkitTapHighlightColor: "transparent" }}>
                {loadFollow ? "…" : following ? "✓ Suivi(e)" : "Suivre"}
              </button>
            </div>

            {/* Voir le profil */}
            <div className="px-4 pb-4">
              <button onClick={goProfile}
                className={`w-full py-2 rounded-xl text-xs font-semibold transition-colors
                  ${isDarkMode ? "bg-gray-800 text-gray-300 hover:bg-gray-700" : "bg-gray-50 text-gray-600 hover:bg-gray-100"}`}
                style={{ WebkitTapHighlightColor: "transparent" }}>
                Voir le profil →
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
});
SuggestedPostPreview.displayName = "SuggestedPostPreview";

export default SuggestedPostPreview;