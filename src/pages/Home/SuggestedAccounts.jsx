// 📁 src/pages/Home/SuggestedAccounts.jsx
// Carte "Suggestions pour toi" insérée dans le feed toutes les 8 publications
// ✨ v3 :
//   - Filtre URLs défaillantes (Pexels signées, Pixabay CDN, URLs mortes)
//   - Vidéos : uniquement si hasAudio === true (ou audio non renseigné mais pas explicitement false)
//   - Résolution d'URL fraîche via cache sessionStorage (même système que Home)
//   - pickRandomMedia filtre d'abord les posts avec media valide

import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import { useNavigate } from "react-router-dom";
import { CheckBadgeIcon } from "@heroicons/react/24/solid";
import { XMarkIcon, PlayIcon } from "@heroicons/react/24/outline";
import { motion, AnimatePresence } from "framer-motion";
import axiosClient from "../../api/axiosClientGlobal";
import { useAuth } from "../../context/AuthContext";

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "dlymdclhe";
const IMG_BASE   = `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/`;

// ─────────────────────────────────────────────────────────────────────────────
// URL VALIDATION — même logique que Home.jsx
// ─────────────────────────────────────────────────────────────────────────────

/** Patterns d'URLs qui expirent et ne peuvent pas être affichées directement */
const EXPIRABLE_PATTERNS = [
  (url) => url.includes("videos.pexels.com/video-files/"),   // Pexels vidéo signé
  (url) => /cdn\.pixabay\.com\/video\/\d{4}\/\d{2}\/\d{2}\//.test(url), // Pixabay CDN
];

/** Patterns d'URLs définitivement mortes */
const DEAD_PATTERNS = [
  "youtube.com/watch", "youtu.be/",
  "dailymotion.com/video", "tiktok.com/@",
  "vimeo.com/",  // embed OK mais URL directe morte
];

/** Cache sessionStorage partagé avec Home (même préfixe) */
const URL_CACHE_PREFIX = "murl_";
const URL_CACHE_TTL    = 80 * 60 * 1000;

const urlCacheRead = (key) => {
  try {
    const raw = sessionStorage.getItem(URL_CACHE_PREFIX + key);
    if (!raw) return null;
    const { url, exp } = JSON.parse(raw);
    if (Date.now() > exp) { sessionStorage.removeItem(URL_CACHE_PREFIX + key); return null; }
    return url;
  } catch { return null; }
};
const urlCacheWrite = (key, url) => {
  try { sessionStorage.setItem(URL_CACHE_PREFIX + key, JSON.stringify({ url, exp: Date.now() + URL_CACHE_TTL })); }
  catch {}
};

/** Vérifie si une URL est expirable (Pexels signé, Pixabay CDN…) */
const isExpirableUrl = (url) =>
  typeof url === "string" && EXPIRABLE_PATTERNS.some(fn => fn(url));

/** Vérifie si une URL est définitivement morte */
const isDeadUrl = (url) =>
  typeof url === "string" && DEAD_PATTERNS.some(p => url.includes(p));

/** Vérifie la validité structurelle d'une URL */
const isStructurallyValid = (url) => {
  if (!url || typeof url !== "string" || url.length < 10) return false;
  if (url.startsWith("data:") || url.startsWith("blob:") || url.startsWith("/")) return true;
  try { const u = new URL(url); return !!(u.hostname && u.pathname && u.pathname !== "/"); }
  catch { return false; }
};

/** Extrait l'ID Pexels depuis une URL expirable */
const extractPexelsId = (url) => {
  const m = url.match(/video-files\/(\d+)\//) || url.match(/^pexels_(\d+)$/);
  return m?.[1] || null;
};

/**
 * Résout une URL expirée vers une URL fraîche (Pexels uniquement pour l'instant).
 * Retourne null si la résolution échoue.
 */
const resolveExpiredUrl = async (url, externalId) => {
  // Chercher un ID Pexels
  const pexId = extractPexelsId(url || "") || extractPexelsId(externalId || "")
    || (/^\d+$/.test(externalId) ? externalId : null);

  if (pexId) {
    const cached = urlCacheRead(`pexels_${pexId}`);
    if (cached) return cached;
    try {
      const res = await axiosClient.get(`/videos/refresh-url?id=${pexId}`);
      const fresh = res.data?.url || res.data?.videoUrl || null;
      if (fresh) urlCacheWrite(`pexels_${pexId}`, fresh);
      return fresh;
    } catch { return null; }
  }

  return null; // source inconnue → ne pas afficher
};

/**
 * Vérifie qu'une URL media est utilisable directement
 * (ni expirable, ni morte, ni invalide).
 */
const isUsableUrl = (url) =>
  url &&
  typeof url === "string" &&
  !isExpirableUrl(url) &&
  !isDeadUrl(url) &&
  isStructurallyValid(url);

/** Détecte si une URL est une vidéo */
const isVideoUrl = (url) => url && /\.(mp4|webm|mov|avi)$/i.test(url.split("?")[0]);

/** Résout une URL Cloudinary vers un thumbnail image */
const resolveThumb = (url) => {
  if (!url || typeof url !== "string") return null;
  if (url.startsWith("data:") || url.startsWith("blob:") || url.startsWith("http")) return url;
  return `${IMG_BASE}q_auto,f_auto,w_300,c_fill/${url.replace(/^\/+/, "")}`;
};

// ─────────────────────────────────────────────────────────────────────────────
// pickRandomMedia — filtré + résolution async des URLs expirées
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Choisit un media aléatoire parmi les posts d'un utilisateur.
 *
 * Règles :
 *  1. Posts avec videoUrl → inclus SEULEMENT si hasAudio !== false
 *     (i.e. hasAudio === true OU hasAudio est absent/undefined)
 *  2. URLs expirables (Pexels signé, Pixabay CDN) → résolution async
 *     Si résolution échoue → post écarté
 *  3. URLs définitivement mortes (YouTube, TikTok…) → écartées
 *  4. Images Pexels statiques (images.pexels.com) → OK, pas signées
 *  5. Post texte pur → affiché si aucun media valide trouvé
 */
const pickRandomMedia = async (posts) => {
  if (!posts?.length) return null;

  // ── ÉTAPE 1 : Candidats vidéo (avec audio, URL valide ou résolvable) ──────
  const videoCandidates = [];
  const imageCandidates = [];
  const textCandidates  = [];

  for (const post of posts.slice(0, 12)) {
    const videoUrl = post.videoUrl || post.embedUrl;

    // Cas vidéo
    if (videoUrl || isVideoUrl(extractFirstImageUrl(post))) {
      const url = videoUrl || extractFirstImageUrl(post);

      // ✅ Filtre audio : skip si explicitement sans audio
      if (post.hasAudio === false) continue;

      if (isUsableUrl(url)) {
        videoCandidates.push({
          url:    resolveThumb(url),
          rawUrl: url,
          isVid:  true,
          text:   post.content || post.contenu || "",
          postId: post._id,
        });
      } else if (isExpirableUrl(url)) {
        // Résolution async (Pexels signé)
        const fresh = await resolveExpiredUrl(url, post.externalId);
        if (fresh) {
          videoCandidates.push({
            url:    resolveThumb(fresh),
            rawUrl: fresh,
            isVid:  true,
            text:   post.content || post.contenu || "",
            postId: post._id,
          });
        }
        // Si résolution échoue → post écarté (pas de fallback image pour une vidéo)
      }
      continue; // ne pas double-compter dans image
    }

    // Cas image
    const imgUrl = extractFirstImageUrl(post);
    if (imgUrl) {
      if (isUsableUrl(imgUrl)) {
        imageCandidates.push({
          url:    resolveThumb(imgUrl),
          rawUrl: imgUrl,
          isVid:  false,
          text:   post.content || post.contenu || "",
          postId: post._id,
        });
      } else if (isExpirableUrl(imgUrl)) {
        const fresh = await resolveExpiredUrl(imgUrl, post.externalId);
        if (fresh) {
          imageCandidates.push({
            url:    resolveThumb(fresh),
            rawUrl: fresh,
            isVid:  false,
            text:   post.content || post.contenu || "",
            postId: post._id,
          });
        }
      }
      // URL morte ou invalide → écartée silencieusement
      continue;
    }

    // Cas texte pur
    if (post.content || post.contenu) {
      textCandidates.push({
        url:    null,
        isVid:  false,
        text:   post.content || post.contenu || "",
        postId: post._id,
      });
    }
  }

  // ── ÉTAPE 2 : Sélection aléatoire par priorité (vidéo > image > texte) ───
  const pool = videoCandidates.length > 0
    ? videoCandidates
    : imageCandidates.length > 0
      ? imageCandidates
      : textCandidates;

  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * Math.min(pool.length, 5))];
};

/** Extrait la première URL d'image d'un post */
const extractFirstImageUrl = (post) => {
  const imgs = post.images || post.media;
  const arr  = Array.isArray(imgs) ? imgs : (imgs ? [imgs] : []);
  if (!arr.length) return null;
  const raw = arr[0];
  return typeof raw === "string" ? raw : raw?.url || null;
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSANTS
// ─────────────────────────────────────────────────────────────────────────────

const SuggestAvatar = memo(({ username, photo, size = 34 }) => {
  const [error, setError] = useState(false);
  const initials = useMemo(() => {
    if (!username) return "?";
    const p = username.trim().split(" ");
    return p.length > 1 ? (p[0][0] + p[1][0]).toUpperCase() : username.substring(0, 2).toUpperCase();
  }, [username]);
  const bg = useMemo(() => {
    const c = ["#f97316","#ef4444","#8b5cf6","#3b82f6","#10b981","#f59e0b","#ec4899","#6366f1"];
    let h = 0;
    for (let i = 0; i < (username||"").length; i++) h = username.charCodeAt(i) + ((h << 5) - h);
    return c[Math.abs(h) % c.length];
  }, [username]);
  if (error || !photo)
    return <div className="rounded-full flex items-center justify-center text-white font-bold select-none flex-shrink-0"
      style={{ width: size, height: size, backgroundColor: bg, fontSize: size * 0.38 }}>{initials}</div>;
  return <img src={photo} alt={username} className="rounded-full object-cover flex-shrink-0"
    style={{ width: size, height: size }} onError={() => setError(true)} loading="lazy" />;
});
SuggestAvatar.displayName = "SuggestAvatar";

const ContentPreview = memo(({ media, isDarkMode, onClick }) => {
  const [imgErr, setImgErr] = useState(false);

  // Aucun media valide → placeholder neutre
  if (!media || (!media.url && !media.text)) return (
    <div onClick={onClick} className="w-full rounded-xl overflow-hidden cursor-pointer flex items-center justify-center"
      style={{ height: 130, background: "linear-gradient(135deg,#f97316,#ec4899)" }}>
      <span className="text-white text-3xl opacity-60">✨</span>
    </div>
  );

  // Vidéo avec audio → thumbnail + icône play
  if (media.isVid) return (
    <div onClick={onClick} className="w-full rounded-xl overflow-hidden cursor-pointer relative flex items-center justify-center"
      style={{ height: 130, background: "#111" }}>
      {media.url && !imgErr && (
        <img src={media.url} alt="" className="w-full h-full object-cover absolute inset-0"
          loading="lazy" onError={() => setImgErr(true)} />
      )}
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative z-10 w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
        <PlayIcon className="w-5 h-5 text-white ml-0.5" />
      </div>
    </div>
  );

  // Image valide
  if (media.url && !imgErr) return (
    <div onClick={onClick} className="w-full rounded-xl overflow-hidden cursor-pointer relative" style={{ height: 130 }}>
      <img src={media.url} alt="" className="w-full h-full object-cover" loading="lazy"
        onError={() => setImgErr(true)} />
      <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
    </div>
  );

  // Texte pur (ou image avec erreur)
  return (
    <div onClick={onClick}
      className={`w-full rounded-xl overflow-hidden cursor-pointer p-3 flex items-center justify-center ${isDarkMode ? "bg-gray-800" : "bg-gray-50"}`}
      style={{ height: 130 }}>
      <p className={`text-xs leading-relaxed line-clamp-5 text-center ${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>
        {media.text || "Voir le profil"}
      </p>
    </div>
  );
});
ContentPreview.displayName = "ContentPreview";

// ── Carte utilisateur ──────────────────────────────────────────────────────
const SuggestedUserCard = memo(({ user, onFollow, onDismiss, isDarkMode }) => {
  const navigate = useNavigate();
  const [following,   setFollowing]   = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [dismissed,   setDismissed]   = useState(false);
  const [media,       setMedia]       = useState(null);
  const [mediaReady,  setMediaReady]  = useState(false);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current || !user._id) return;
    fetchedRef.current = true;

    // Délai aléatoire pour étaler les requêtes (évite burst réseau)
    const delay = 80 + Math.random() * 400;
    const timer = setTimeout(async () => {
      try {
        const { data } = await axiosClient.get(`/posts/user/${user._id}?limit=10&page=1`);
        const posts    = Array.isArray(data) ? data : (data?.posts || []);
        // pickRandomMedia est async (résout les URLs expirées)
        const picked   = await pickRandomMedia(posts);
        setMedia(picked);
      } catch {
        setMedia(null);
      } finally {
        setMediaReady(true);
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [user._id]);

  const handleFollow = useCallback(async (e) => {
    e.stopPropagation();
    if (loading || following) return;
    setFollowing(true); setLoading(true);
    try { await onFollow?.(user._id); }
    catch { setFollowing(false); }
    finally { setLoading(false); }
  }, [loading, following, onFollow, user._id]);

  const handleDismiss = useCallback((e) => {
    e.stopPropagation();
    setDismissed(true);
    setTimeout(() => onDismiss?.(user._id), 280);
  }, [onDismiss, user._id]);

  const goProfile = useCallback(() => {
    if (user._id) navigate(`/profile/${user._id}`);
  }, [navigate, user._id]);

  const mutualText = useMemo(() => {
    if (user.mutualCount > 0) return `${user.mutualCount} ami${user.mutualCount > 1 ? "s" : ""} en commun`;
    if (user.followedByNames?.length > 0) return `Suivi par ${user.followedByNames[0]}`;
    return user.bio ? user.bio.substring(0, 36) + (user.bio.length > 36 ? "…" : "") : "Suggéré pour toi";
  }, [user]);

  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.div
          initial={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.88, x: -20 }}
          transition={{ duration: 0.25 }}
          className={`relative flex-shrink-0 flex flex-col gap-2.5 p-3 rounded-2xl cursor-pointer select-none
            ${isDarkMode
              ? "bg-gray-900 border border-gray-800 hover:border-gray-700"
              : "bg-white border border-gray-100 hover:border-gray-200"
            } transition-colors shadow-sm`}
          style={{ width: 172 }}
          onClick={goProfile}
        >
          {/* Bouton fermer */}
          <button onClick={handleDismiss}
            className={`absolute top-2 right-2 z-10 w-5 h-5 rounded-full flex items-center justify-center
              ${isDarkMode ? "text-gray-600 hover:text-gray-400" : "text-gray-400 hover:text-gray-600"} transition-colors`}
            style={{ WebkitTapHighlightColor: "transparent" }}>
            <XMarkIcon className="w-3.5 h-3.5" />
          </button>

          {/* Aperçu contenu */}
          {!mediaReady
            ? <div className={`w-full rounded-xl animate-pulse ${isDarkMode ? "bg-gray-800" : "bg-gray-100"}`} style={{ height: 130 }} />
            : <ContentPreview media={media} isDarkMode={isDarkMode} onClick={goProfile} />
          }

          {/* Infos utilisateur */}
          <div className="flex items-center gap-2 pr-5">
            <div className={`rounded-full p-[2px] flex-shrink-0 ${user.isPremium ? "bg-gradient-to-tr from-orange-400 via-pink-500 to-purple-500" : ""}`}>
              <div className={`rounded-full p-[1.5px] ${isDarkMode ? "bg-gray-900" : "bg-white"}`}>
                <SuggestAvatar username={user.fullName} photo={user.profilePhoto} size={34} />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <span className={`text-xs font-bold truncate ${isDarkMode ? "text-white" : "text-gray-900"}`}>
                  {user.fullName}
                </span>
                {user.isVerified && <CheckBadgeIcon className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />}
              </div>
              <p className={`text-[10px] leading-tight truncate ${isDarkMode ? "text-gray-500" : "text-gray-400"}`}>
                {mutualText}
              </p>
            </div>
          </div>

          {/* Bouton suivre */}
          <button onClick={handleFollow} disabled={loading}
            className={`w-full py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95
              ${following
                ? isDarkMode
                  ? "bg-gray-800 text-gray-400 border border-gray-700"
                  : "bg-gray-100 text-gray-500 border border-gray-200"
                : "bg-gradient-to-r from-orange-500 to-pink-500 text-white shadow-sm"
              }`}
            style={{ WebkitTapHighlightColor: "transparent" }}>
            {loading ? "…" : following ? "✓ Suivi(e)" : "Suivre"}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
});
SuggestedUserCard.displayName = "SuggestedUserCard";

// ── Composant principal ───────────────────────────────────────────────────
const SuggestedAccounts = memo(({ isDarkMode, instanceId = 0 }) => {
  const { user: currentUser, updateUserProfile } = useAuth();
  const [users,     setUsers]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [dismissed, setDismissed] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem("suggested_dismissed") || "[]"); }
    catch { return []; }
  });
  const scrollRef  = useRef(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current || !currentUser) return;
    fetchedRef.current = true;
    (async () => {
      try {
        const { data } = await axiosClient.get("/users/suggestions?limit=12");
        const list = Array.isArray(data) ? data : (data?.users || data?.suggestions || []);
        setUsers(list.filter(u => u?._id && u._id !== currentUser._id));
      } catch {
        try {
          const { data } = await axiosClient.get("/users?limit=12&sort=followers");
          const list = Array.isArray(data) ? data : (data?.users || []);
          setUsers(list.filter(u => u?._id && u._id !== currentUser._id).slice(0, 10));
        } catch { setUsers([]); }
      } finally {
        setLoading(false);
      }
    })();
  }, [currentUser]);

  const visibleUsers = useMemo(
    () => users.filter(u => !dismissed.includes(u._id)),
    [users, dismissed]
  );

  const handleFollow = useCallback(async (userId) => {
    await axiosClient.post(`/follow/follow/${userId}`);
    updateUserProfile?.(currentUser._id, {
      following: [...(currentUser?.following || []), userId],
    });
  }, [currentUser, updateUserProfile]);

  const handleDismiss = useCallback((userId) => {
    setDismissed(prev => {
      const next = [...prev, userId];
      try { sessionStorage.setItem("suggested_dismissed", JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const scrollByDir = useCallback((dir) => {
    scrollRef.current?.scrollBy({ left: dir * 188, behavior: "smooth" });
  }, []);

  if (!currentUser || loading || visibleUsers.length === 0) return null;

  return (
    <div className={`w-full ${isDarkMode ? "bg-black" : "bg-white"}`}>
      <div className="flex items-center gap-3 px-4 pt-5 pb-3">
        <div className={`flex-1 h-px ${isDarkMode ? "bg-gray-800" : "bg-gray-100"}`} />
        <span className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? "text-orange-500" : "text-orange-400"}`}>
          ✨ Suggestions pour toi
        </span>
        <div className={`flex-1 h-px ${isDarkMode ? "bg-gray-800" : "bg-gray-100"}`} />
      </div>

      <div className="relative px-4 pb-5">
        <button onClick={() => scrollByDir(-1)}
          className={`hidden sm:flex absolute left-1 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full
            items-center justify-center shadow-md border
            ${isDarkMode ? "bg-gray-800 text-white border-gray-700" : "bg-white text-gray-700 border-gray-200"}`}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div ref={scrollRef} className="flex gap-3 overflow-x-auto scrollbar-hide"
          style={{ scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch", paddingBottom: 2 }}>
          {visibleUsers.map(user => (
            <div key={user._id} style={{ scrollSnapAlign: "start" }}>
              <SuggestedUserCard
                user={user}
                onFollow={handleFollow}
                onDismiss={handleDismiss}
                isDarkMode={isDarkMode}
              />
            </div>
          ))}
        </div>

        <button onClick={() => scrollByDir(1)}
          className={`hidden sm:flex absolute right-1 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full
            items-center justify-center shadow-md border
            ${isDarkMode ? "bg-gray-800 text-white border-gray-700" : "bg-white text-gray-700 border-gray-200"}`}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
});
SuggestedAccounts.displayName = "SuggestedAccounts";

export default SuggestedAccounts;