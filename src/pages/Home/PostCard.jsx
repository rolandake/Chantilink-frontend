// 📁 src/pages/Home/PostCard.jsx
// ✅ v18 — FIX DÉFINITIF : boutons Supprimer et Booster ne répondent pas
//
// ══════════════════════════════════════════════════════════════════════════════
// ROOT CAUSES identifiés via logs :
//
// 🐛 BUG 1 — getModalRoot() crée le conteneur avec pointer-events:none
//    Le modal est injecté via createPortal dans ce conteneur.
//    Le useEffect du modal essaie de le réactiver APRÈS le mount,
//    mais les re-renders excessifs (log montre 4-6 renders par postId)
//    font que le modal se démonte avant que useEffect s'exécute.
//    → FIX : pointer-events:auto dès la création. Le backdrop du modal
//      lui-même gère l'isolation via position:fixed + zIndex élevé.
//
// 🐛 BUG 2 — Les modals DeleteModal et BoostModal ont leur propre useEffect
//    qui fait root.style.pointerEvents = "auto" mais root.style.pointerEvents
//    = "none" au cleanup. Si le parent re-render pendant que le modal est
//    ouvert, le cleanup tourne et désactive les events sur le root.
//    → FIX : Supprimer complètement la gestion pointer-events dans les modals.
//      Le root est toujours "auto", le backdrop fixed intercepte les clics.
//
// 🐛 BUG 3 — Wrapper du card n'a pas isolation:isolate.
//    PostMedia utilise des éléments position:absolute qui peuvent créer
//    des stacking contexts non isolés capturant les clics des boutons.
//    → FIX : isolation:isolate sur le div racine du card.
//
// 🐛 BUG 4 — memo() comparateur du PostCard wrapper ne couvre pas
//    onDeleted et showToast → nouvelles références à chaque render parent
//    → re-render inutiles → démontages/remontages intempestifs.
//    → FIX : les callbacks sont déjà dans postRef, le comparateur est OK.
//    Mais on s'assure que AnimatePresence wraps correctement les portails.
//
// ✅ Toutes les corrections v17 conservées.
// ══════════════════════════════════════════════════════════════════════════════

import React, {
  forwardRef, useState, useEffect, useLayoutEffect,
  useCallback, useMemo, useRef, memo, lazy, Suspense
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  TrashIcon, HeartIcon, ChatBubbleLeftIcon, ShareIcon, BookmarkIcon,
} from "@heroicons/react/24/outline";
import {
  HeartIcon as HeartSolid, CheckBadgeIcon, RocketLaunchIcon, BookmarkIcon as BookmarkSolid
} from "@heroicons/react/24/solid";
import { useAuth } from "../../context/AuthContext";
import { useDarkMode } from "../../context/DarkModeContext";
import PostMedia from "./PostMedia";
import ErrorBoundary from "../../components/ErrorBoundary";
import axiosClient from "../../api/axiosClientGlobal";

const PostCommentsModal = lazy(() => import("./PostComments"));
const PostShareModal    = lazy(() => import("./PostShareSection"));

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

// ─────────────────────────────────────────────────────────────────────────────
// DEBUG HELPER
// ─────────────────────────────────────────────────────────────────────────────
const DEBUG_PC = () => typeof window !== "undefined" && window.localStorage?.getItem("POSTCARD_DEBUG") === "1";
const dbgPC = (...args) => { if (DEBUG_PC()) console.log("[PostCard]", ...args); };

// ─────────────────────────────────────────────────────────────────────────────
// ✅ FIX BUG 1 — getModalRoot() : pointer-events TOUJOURS auto
// Le backdrop position:fixed du modal gère l'isolation visuelle et des clics.
// Mettre pointer-events:none ici causait des clics ignorés sur les modals.
// ─────────────────────────────────────────────────────────────────────────────
const getModalRoot = () => {
  let el = document.getElementById("modal-root");
  if (!el) {
    el = document.createElement("div");
    el.id = "modal-root";
    el.style.cssText = [
      "position:fixed",
      "top:0",
      "left:0",
      "width:0",
      "height:0",
      "z-index:99999",
      "isolation:isolate",
      // ✅ FIX : toujours "auto" — le backdrop du modal intercepte les clics
      "pointer-events:auto",
    ].join(";");
    document.body.appendChild(el);
  }
  // S'assurer que le root est toujours cliquable (peut avoir été désactivé par du code externe)
  el.style.pointerEvents = "auto";
  return el;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper robuste pour comparer des IDs MongoDB
// ─────────────────────────────────────────────────────────────────────────────
const toStr = (v) => {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return String(v._id ?? v.id ?? "");
  return String(v);
};

// ─────────────────────────────────────────────────────────────────────────────
// URL HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const isStructurallyValid = (url) => {
  if (!url || typeof url !== "string" || url.length < 10) return false;
  if (url.startsWith("data:") || url.startsWith("blob:") || url.startsWith("/")) return true;
  try {
    const u = new URL(url);
    return !!(u.hostname && u.pathname && u.pathname !== "/");
  } catch { return false; }
};

const isVideoUrl = (url) => {
  if (!url || typeof url !== "string") return false;
  const clean = url.split("?")[0].toLowerCase();
  if (/\.(mp4|webm|mov|avi|mkv|flv|m4v)$/.test(clean)) return true;
  if (/\/videos?\//.test(clean))  return true;
  if (/\/video[-_]/.test(clean))  return true;
  if (/[-_]video\b/.test(clean))  return true;
  return false;
};

const R2_PUBLIC_URL = (import.meta.env.VITE_R2_PUBLIC_URL || "").replace(/\/+$/, "");

const resolveMediaUrl = (raw) => {
  if (!raw || typeof raw !== "string") return null;
  if (raw.startsWith("data:image")) return raw;
  if (raw.includes("videos.pexels.com")) return null;
  if (raw.includes("cdn.pixabay.com/video")) return null;
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  if (raw.startsWith("blob:")) return raw;
  if (raw.startsWith("/uploads/") || raw.startsWith("uploads/")) {
    return `${API_URL.replace("/api", "")}/${raw.replace(/^\/+/, "")}`;
  }
  if (R2_PUBLIC_URL) return `${R2_PUBLIC_URL}/${raw.replace(/^\/+/, "")}`;
  return raw;
};

// ─────────────────────────────────────────────────────────────────────────────
// TIMESTAMP LIVE
// ─────────────────────────────────────────────────────────────────────────────
const _relativeSubscribers = new Set();
let   _relativeTimer = null;

const _startGlobalTimer = () => {
  if (_relativeTimer) return;
  _relativeTimer = setInterval(() => {
    _relativeSubscribers.forEach(fn => fn());
  }, 15_000);
};

const _formatRelative = (date) => {
  if (!date) return "";
  const d    = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  if (diff < 0)            return "à l'instant";
  if (diff < 45_000)       return "à l'instant";
  if (diff < 90_000)       return "il y a 1 min";
  if (diff < 3_600_000)    return `il y a ${Math.round(diff / 60_000)} min`;
  if (diff < 7_200_000)    return "il y a 1 h";
  if (diff < 86_400_000)   return `il y a ${Math.round(diff / 3_600_000)} h`;
  if (diff < 172_800_000)  return "hier";
  if (diff < 604_800_000)  return `il y a ${Math.round(diff / 86_400_000)} j`;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
};

const useRelativeTime = (date) => {
  const [label, setLabel] = useState(() => _formatRelative(date));
  useEffect(() => {
    if (!date) return;
    setLabel(_formatRelative(date));
    const tick = () => setLabel(_formatRelative(date));
    _relativeSubscribers.add(tick);
    _startGlobalTimer();
    return () => { _relativeSubscribers.delete(tick); };
  }, [date]);
  return label;
};

// ─────────────────────────────────────────────────────────────────────────────
// OBSERVER VIDÉO (singleton)
// ─────────────────────────────────────────────────────────────────────────────
let _videoObserver = null;
const _observedVideos = new WeakMap();

const getVideoObserver = () => {
  if (!_videoObserver) {
    _videoObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const v = entry.target;
        if (!document.contains(v)) { _videoObserver?.unobserve(v); return; }
        if (entry.isIntersecting) v.play().catch(() => {});
        else v.pause();
      });
    }, { threshold: 0.7 });
  }
  return _videoObserver;
};

// ─────────────────────────────────────────────────────────────────────────────
// INDICATEUR POST EN COURS D'UPLOAD
// ─────────────────────────────────────────────────────────────────────────────
export const PostUploadingIndicator = memo(({ isDarkMode, content, mediaCount }) => (
  <div className={`w-full max-w-[630px] mx-auto px-4 py-3 flex items-center gap-3 ${
    isDarkMode ? "bg-black border-b border-white/5" : "bg-white border-b border-gray-100"
  }`}>
    <div className="w-8 h-8 flex-shrink-0">
      <svg className="animate-spin w-8 h-8 text-orange-500" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
        <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
      </svg>
    </div>
    <div className="flex-1 min-w-0">
      <p className={`text-sm font-medium truncate ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>
        {content ? content.substring(0, 60) + (content.length > 60 ? "…" : "") : "Publication en cours…"}
      </p>
      <p className="text-xs text-orange-500 mt-0.5">
        {mediaCount > 0 ? `Upload de ${mediaCount} fichier${mediaCount > 1 ? "s" : ""}…` : "Envoi en cours…"}
      </p>
    </div>
  </div>
));
PostUploadingIndicator.displayName = "PostUploadingIndicator";

// ─────────────────────────────────────────────────────────────────────────────
// AVATAR
// ─────────────────────────────────────────────────────────────────────────────
const AVATAR_COLORS = ["#f97316","#ef4444","#8b5cf6","#3b82f6","#10b981","#f59e0b","#ec4899","#6366f1"];

const getAvatarColor = (username) => {
  let h = 0;
  for (let i = 0; i < (username || "").length; i++) h = username.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
};

const getInitials = (username) => {
  if (!username) return "?";
  const p = username.trim().split(" ");
  return p.length > 1 ? (p[0][0] + p[1][0]).toUpperCase() : username.substring(0, 2).toUpperCase();
};

const SimpleAvatar = memo(({ username, photo, size = 40 }) => {
  const [error, setError] = useState(false);
  const initials = useMemo(() => getInitials(username), [username]);
  const bgColor  = useMemo(() => getAvatarColor(username), [username]);

  const url = useMemo(() => {
    if (!photo || typeof photo !== "string") return null;
    if (photo.startsWith("data:image")) return photo;
    return resolveMediaUrl(photo);
  }, [photo]);

  if (error || !url)
    return (
      <div className="rounded-full flex items-center justify-center text-white font-bold select-none flex-shrink-0"
        style={{ width: size, height: size, backgroundColor: bgColor, fontSize: size * 0.4 }}>
        {initials}
      </div>
    );

  return (
    <img src={url} alt={username}
      className="rounded-full object-cover bg-gray-200 flex-shrink-0"
      style={{ width: size, height: size }}
      onError={() => setError(true)} loading="lazy" />
  );
}, (prev, next) =>
  prev.username === next.username &&
  prev.photo    === next.photo    &&
  prev.size     === next.size
);
SimpleAvatar.displayName = "SimpleAvatar";

// ─────────────────────────────────────────────────────────────────────────────
// SKELETON
// ─────────────────────────────────────────────────────────────────────────────
const SkeletonPostCard = memo(({ isDarkMode }) => (
  <div className={`w-full max-w-[630px] mx-auto animate-pulse ${isDarkMode ? "bg-black" : "bg-white"}`}>
    <div className="flex items-center gap-3 p-3">
      <div className={`rounded-full w-10 h-10 ${isDarkMode ? "bg-gray-800" : "bg-gray-300"}`} />
      <div className="flex-1 space-y-1.5">
        <div className={`h-4 rounded w-32 ${isDarkMode ? "bg-gray-800" : "bg-gray-300"}`} />
        <div className={`h-3 rounded w-20 ${isDarkMode ? "bg-gray-700" : "bg-gray-200"}`} />
      </div>
    </div>
    <div className={`w-full aspect-square ${isDarkMode ? "bg-gray-800" : "bg-gray-300"}`} />
    <div className="flex items-center p-3 gap-4">
      {[1,2,3].map(i => <div key={i} className={`h-6 w-6 rounded ${isDarkMode ? "bg-gray-800" : "bg-gray-300"}`} />)}
    </div>
  </div>
));
SkeletonPostCard.displayName = "SkeletonPostCard";

// ─────────────────────────────────────────────────────────────────────────────
// ✅ FIX BUG 2 — DELETE MODAL : suppression de la gestion pointer-events
// Le root modal-root a déjà pointer-events:auto en permanence (FIX BUG 1).
// Gérer pointer-events dans useEffect causait des désactivations lors des
// re-renders (cleanup tournait avant le prochain effect).
// ─────────────────────────────────────────────────────────────────────────────
const DeleteModal = memo(({ isDarkMode, isDeleting, onConfirm, onCancel }) => {
  // ✅ FIX BUG 2 : plus de gestion pointer-events ici (géré par getModalRoot)

  return (
    <div
      style={{
        position:             "fixed",
        inset:                0,
        zIndex:               99999,
        display:              "flex",
        alignItems:           "center",
        justifyContent:       "center",
        background:           "rgba(0,0,0,0.82)",
        backdropFilter:       "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        padding:              "16px",
        isolation:            "isolate",
        // pointer-events explicite sur le backdrop lui-même
        pointerEvents:        "auto",
      }}
      onClick={() => !isDeleting && onCancel()}
    >
      <motion.div
        initial={{ scale: 0.88, opacity: 0 }}
        animate={{ scale: 1,    opacity: 1 }}
        exit={{ scale: 0.88,    opacity: 0 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        style={{
          width:        "100%",
          maxWidth:     360,
          borderRadius: 20,
          padding:      24,
          boxShadow:    "0 24px 64px rgba(0,0,0,0.5)",
          background:   isDarkMode ? "#111827" : "#ffffff",
          border:       isDarkMode ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.06)",
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{
            width: 64, height: 64, borderRadius: "50%",
            background: "rgba(239,68,68,0.12)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 16px",
          }}>
            <TrashIcon style={{ width: 32, height: 32, color: "#ef4444" }} />
          </div>
          <h2 style={{
            fontSize: 20, fontWeight: 700, marginBottom: 8,
            color: isDarkMode ? "#ffffff" : "#111827",
          }}>
            Supprimer ce post ?
          </h2>
          <p style={{ fontSize: 14, color: "#6b7280", margin: 0 }}>
            Cette action est irréversible.
          </p>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            style={{
              flex: 1, padding: "12px 0", borderRadius: 12, fontWeight: 700,
              fontSize: 15, border: "none", cursor: isDeleting ? "not-allowed" : "pointer",
              opacity: isDeleting ? 0.5 : 1,
              background: isDarkMode ? "#1f2937" : "#f3f4f6",
              color:      isDarkMode ? "#ffffff" : "#111827",
              pointerEvents: "auto",
            }}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            style={{
              flex: 1, padding: "12px 0", borderRadius: 12, fontWeight: 700,
              fontSize: 15, border: "none", cursor: isDeleting ? "not-allowed" : "pointer",
              opacity: isDeleting ? 0.5 : 1,
              background: "#ef4444", color: "#ffffff",
              pointerEvents: "auto",
            }}
          >
            {isDeleting ? "Suppression…" : "Supprimer"}
          </button>
        </div>
      </motion.div>
    </div>
  );
});
DeleteModal.displayName = "DeleteModal";

// ─────────────────────────────────────────────────────────────────────────────
// ✅ FIX BUG 2 — BOOST MODAL : même correction pointer-events
// ─────────────────────────────────────────────────────────────────────────────
const BoostModal = memo(({ isDarkMode, postId, onClose }) => {
  // ✅ FIX BUG 2 : plus de gestion pointer-events ici (géré par getModalRoot)

  return (
    <div
      style={{
        position:             "fixed",
        inset:                0,
        zIndex:               99999,
        display:              "flex",
        alignItems:           "center",
        justifyContent:       "center",
        background:           "rgba(0,0,0,0.82)",
        backdropFilter:       "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        padding:              "16px",
        isolation:            "isolate",
        // pointer-events explicite sur le backdrop lui-même
        pointerEvents:        "auto",
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.88, opacity: 0 }}
        animate={{ scale: 1,    opacity: 1 }}
        exit={{ scale: 0.88,    opacity: 0 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        style={{
          width: "100%", maxWidth: 400, borderRadius: 20, padding: 24,
          boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
          background: isDarkMode ? "#111827" : "#ffffff",
          border: isDarkMode ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.06)",
          pointerEvents: "auto",
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{
            width: 64, height: 64, borderRadius: "50%",
            background: "linear-gradient(135deg, rgba(168,85,247,0.15), rgba(236,72,153,0.15))",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 16px",
          }}>
            <RocketLaunchIcon style={{ width: 32, height: 32, color: "#a855f7" }} />
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: isDarkMode ? "#ffffff" : "#111827" }}>
            Booster ce post
          </h2>
          <p style={{ fontSize: 14, color: "#6b7280", margin: 0 }}>
            Augmentez la visibilité de votre publication auprès d'un plus grand public.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            width: "100%", padding: "12px 0", borderRadius: 12, fontWeight: 700,
            fontSize: 15, border: "none", cursor: "pointer",
            background: "linear-gradient(135deg, #9333ea, #ec4899)", color: "#ffffff",
            pointerEvents: "auto",
          }}
        >
          Fermer
        </button>
      </motion.div>
    </div>
  );
});
BoostModal.displayName = "BoostModal";

// ─────────────────────────────────────────────────────────────────────────────
// ACTIONS BAR
// ─────────────────────────────────────────────────────────────────────────────
const ActionsBar = memo(({
  liked, likesCount, saved, commentsCount,
  isDarkMode, onLike, onOpenComments, onOpenShare, onSave,
}) => (
  <>
    <div className="flex items-center justify-between px-3 py-2">
      <div className="flex items-center gap-4">
        <button onClick={onLike} className="active:scale-90 transition-transform" style={{ WebkitTapHighlightColor: "transparent" }}>
          {liked
            ? <HeartSolid className="w-7 h-7 text-red-500" />
            : <HeartIcon className={`w-7 h-7 ${isDarkMode ? "text-white" : "text-gray-900"}`} />}
        </button>
        <button onClick={onOpenComments} className="active:scale-90 transition-transform" style={{ WebkitTapHighlightColor: "transparent" }}>
          <ChatBubbleLeftIcon className={`w-7 h-7 ${isDarkMode ? "text-white" : "text-gray-900"}`} />
        </button>
        <button onClick={onOpenShare} className="active:scale-90 transition-transform" style={{ WebkitTapHighlightColor: "transparent" }}>
          <ShareIcon className={`w-7 h-7 ${isDarkMode ? "text-white" : "text-gray-900"}`} />
        </button>
      </div>
      <button onClick={onSave} className="active:scale-90 transition-transform" style={{ WebkitTapHighlightColor: "transparent" }}>
        {saved
          ? <BookmarkSolid className={`w-7 h-7 ${isDarkMode ? "text-white" : "text-gray-900"}`} />
          : <BookmarkIcon  className={`w-7 h-7 ${isDarkMode ? "text-white" : "text-gray-900"}`} />}
      </button>
    </div>
    {likesCount > 0 && (
      <div className="px-3 pb-1">
        <span className={`text-sm font-semibold ${isDarkMode ? "text-white" : "text-gray-900"}`}>
          {likesCount.toLocaleString()} {likesCount === 1 ? "mention J'aime" : "mentions J'aime"}
        </span>
      </div>
    )}
    {commentsCount > 0 && (
      <button onClick={onOpenComments} className="px-3 pb-3 text-sm text-gray-500 hover:text-gray-400 text-left">
        Afficher {commentsCount === 1 ? "le commentaire" : `les ${commentsCount.toLocaleString()} commentaires`}
      </button>
    )}
  </>
), (prev, next) =>
  prev.liked         === next.liked         &&
  prev.likesCount    === next.likesCount    &&
  prev.saved         === next.saved         &&
  prev.commentsCount === next.commentsCount &&
  prev.isDarkMode    === next.isDarkMode
);
ActionsBar.displayName = "ActionsBar";

// ─────────────────────────────────────────────────────────────────────────────
// POST CARD INNER
// ─────────────────────────────────────────────────────────────────────────────
const PostCardInner = forwardRef(({ post, onDeleted, showToast, mockPost = false, priority = false }, ref) => {
  const { isDarkMode } = useDarkMode();
  const { user: currentUser, getToken, updateUserProfile } = useAuth();
  const navigate = useNavigate();
  const cardRef  = useRef(null);
  const vidsRef  = useRef([]);

  const isMockPost   = mockPost || post._id?.startsWith("post_") || post.isMockPost;
  const isOptimistic = !!post.isOptimistic || post._id?.startsWith("temp_");

  const postUser = useMemo(() => {
    const u = post.user || post.author || {};
    const fullName = u.fullName || post.fullName || "";
    const isInvalidName = !fullName ||
      ["Utilisateur Inconnu","Unknown User","undefined","null"].includes(fullName) ||
      fullName.trim() === "";
    const resolvedId = u._id || u.id || post.userId || post.author?._id || null;
    const isInvalidId = !resolvedId || ["unknown","null","undefined"].includes(String(resolvedId));
    const isBannedDeleted = u.isBanned || u.isDeleted || u.status === "deleted" || u.status === "banned";
    return {
      _id:               resolvedId || "unknown",
      fullName:          fullName || "Utilisateur Inconnu",
      profilePhoto:      u.profilePhoto || u.profilePicture || post.userProfilePhoto || null,
      isVerified:        !!(u.isVerified || u.verified || post.isVerified),
      isPremium:         !!(u.isPremium || post.isPremium),
      isInvalid:         !isMockPost && !isOptimistic && (isInvalidName || isInvalidId),
      isBannedOrDeleted: isBannedDeleted,
    };
  }, [post._id, post.user, post.author, post.userId, post.fullName, isMockPost, isOptimistic]);

  const [liked,             setLiked]             = useState(() =>
    currentUser && Array.isArray(post.likes)
      ? post.likes.some(l => (typeof l === "object" ? l._id : l)?.toString() === currentUser._id?.toString())
      : false
  );
  const [likesCount,        setLikesCount]        = useState(() => Array.isArray(post.likes) ? post.likes.length : (post.likesCount || 0));
  const [commentsCount,     setCommentsCount]     = useState(() => Array.isArray(post.comments) ? post.comments.length : (post.commentsCount || 0));
  const [comments,          setComments]          = useState(() => Array.isArray(post.comments) ? post.comments : []);
  const [saved,             setSaved]             = useState(false);
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [showShareModal,    setShowShareModal]    = useState(false);
  const [showDeleteModal,   setShowDeleteModal]   = useState(false);
  const [showBoostModal,    setShowBoostModal]    = useState(false);
  const [isDeleting,        setIsDeleting]        = useState(false);
  const [isFollowing,       setIsFollowing]       = useState(() => {
    if (!currentUser || !postUser._id || postUser._id === "unknown") return false;
    if (currentUser._id === postUser._id) return false;
    return (currentUser.following || []).some(id => {
      const s = typeof id === "object" ? (id._id || id) : id;
      return s?.toString() === postUser._id.toString();
    });
  });
  const [loadingFollow, setLoadingFollow] = useState(false);
  const [expanded,      setExpanded]      = useState(false);

  const stateRef = useRef({});
  const postRef  = useRef({});

  useLayoutEffect(() => {
    stateRef.current = { liked, likesCount, isFollowing, loadingFollow };
  });
  useLayoutEffect(() => {
    postRef.current = { post, postUser, currentUser, isMockPost, isOptimistic, onDeleted, showToast, updateUserProfile };
  });

  const loadingLikeRef = useRef(false);

  useEffect(() => {
    if (!cardRef.current) return;
    const obs  = getVideoObserver();
    const vids = Array.from(cardRef.current.querySelectorAll("video"));
    vids.forEach(v => { obs.observe(v); _observedVideos.set(v, true); });
    vidsRef.current = vids;
    return () => {
      vidsRef.current.forEach(v => { obs.unobserve(v); });
      vidsRef.current = [];
    };
  }, []);

  useEffect(() => { setCommentsCount(comments.length); }, [comments.length]);

  const isOwner = useMemo(() => {
    if (!currentUser) return false;
    const cuid = toStr(currentUser._id);
    if (!cuid) return false;
    return (
      toStr(post.userId)   === cuid ||
      toStr(postUser._id)  === cuid
    );
  }, [currentUser?._id, post.userId, postUser._id]);

  const canFollow = useMemo(() =>
    !!(currentUser && !isOwner && postUser._id !== "unknown"),
    [currentUser, isOwner, postUser._id]
  );

  const handleLike = useCallback((e) => {
    e?.stopPropagation();
    if (loadingLikeRef.current) return;
    const { liked, likesCount } = stateRef.current;
    const { post, currentUser, isMockPost, isOptimistic, showToast } = postRef.current;
    if (isOptimistic) { showToast?.("Publication en cours, patientez…", "info"); return; }
    if (!currentUser) { showToast?.("Connectez-vous pour aimer", "info"); return; }

    loadingLikeRef.current = true;
    const nl = !liked;
    setLiked(nl);
    setLikesCount(c => nl ? c + 1 : c - 1);

    if (isMockPost) { loadingLikeRef.current = false; return; }

    axiosClient.post(`/posts/${post._id}/like`)
      .then(({ data }) => {
        if (typeof data.likesCount === "number") setLikesCount(data.likesCount);
        if (typeof data.userLiked  === "boolean") setLiked(data.userLiked);
        window.dispatchEvent(new CustomEvent("feed:interaction", {
          detail: { action: "like", post, position: post._displayPosition ?? 0 },
        }));
      })
      .catch(err => {
        setLiked(liked);
        setLikesCount(likesCount);
        showToast?.(err.response?.data?.message || "Erreur", "error");
      })
      .finally(() => { loadingLikeRef.current = false; });
  }, []);

  const handleFollow = useCallback((e) => {
    e?.stopPropagation();
    const { isFollowing, loadingFollow } = stateRef.current;
    const { postUser, currentUser, isMockPost, showToast, updateUserProfile } = postRef.current;
    if (!currentUser) { showToast?.("Connectez-vous", "info"); return; }
    if (loadingFollow) return;
    if (!postUser._id || postUser._id === "unknown") { showToast?.("Utilisateur introuvable", "error"); return; }
    if (currentUser._id === postUser._id) { showToast?.("Vous ne pouvez pas vous suivre", "info"); return; }
    const was = isFollowing;
    setIsFollowing(!was);
    showToast?.(!was ? `Vous suivez ${postUser.fullName}` : `Vous ne suivez plus ${postUser.fullName}`, "success");
    if (isMockPost) return;
    setLoadingFollow(true);
    axiosClient.post(`/follow/${was ? "unfollow" : "follow"}/${postUser._id}`)
      .then(({ data }) => {
        if (!data.success) throw new Error(data.error || "Échec");
        const cf = currentUser.following || [];
        const uf = was
          ? cf.filter(id => { const s = typeof id === "object" ? (id._id || id) : id; return s?.toString() !== postUser._id.toString(); })
          : [...cf, postUser._id];
        updateUserProfile?.(currentUser._id, { following: uf });
      })
      .catch(err => { setIsFollowing(was); showToast?.(err.response?.data?.error || err.message || "Erreur", "error"); })
      .finally(() => setLoadingFollow(false));
  }, []);

  const handleDeletePost = useCallback(async () => {
    const { post, isMockPost, isOptimistic, onDeleted, showToast } = postRef.current;
    if (isOptimistic || post._id?.startsWith("temp_")) {
      showToast?.("Publication en cours, patientez…", "info");
      setShowDeleteModal(false);
      return;
    }
    if (isMockPost) {
      showToast?.("Post supprimé", "success");
      setShowDeleteModal(false);
      onDeleted?.(post._id);
      return;
    }
    setIsDeleting(true);
    try {
      await axiosClient.delete(`/posts/${post._id}`);
      showToast?.("Post supprimé", "success");
      setShowDeleteModal(false);
      onDeleted?.(post._id);
    } catch (err) {
      const s = err.response?.status;
      if (s === 404) { setShowDeleteModal(false); onDeleted?.(post._id); }
      else showToast?.(s === 403 ? "Permission refusée" : err.response?.data?.message || "Erreur", "error");
    } finally {
      setIsDeleting(false);
    }
  }, []);

  const handleProfileClick = useCallback((e) => {
    e?.stopPropagation();
    const { postUser } = postRef.current;
    const id = postUser._id;
    if (!id || id === "unknown" || id === "null" || id === "undefined") return;
    navigate(`/profile/${id}`);
  }, [navigate]);

  const handleOpenComments = useCallback((e) => { e?.stopPropagation(); setShowCommentsModal(true); }, []);
  const handleOpenShare    = useCallback((e) => { e?.stopPropagation(); setShowShareModal(true);    }, []);
  const handleSave         = useCallback(() => setSaved(v => !v), []);
  const handleExpand       = useCallback((e) => { e?.stopPropagation(); setExpanded(v => !v); }, []);

  // ✅ Handler Booster — ouvre showBoostModal
  const handleOpenBoost = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dbgPC("handleOpenBoost triggered");
    setShowBoostModal(true);
  }, []);

  // ✅ Handler Delete — isolé
  const handleOpenDelete = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dbgPC("handleOpenDelete triggered");
    setShowDeleteModal(true);
  }, []);

  const handleCommentsCountChange = useCallback((count) => {
    if (typeof count === "number") setCommentsCount(count);
  }, []);

  const setRootRef = useCallback((node) => {
    cardRef.current = node;
    if (ref) {
      if (typeof ref === "function") ref(node);
      else ref.current = node;
    }
  }, [ref]);

  const content        = post.content || post.contenu || "";
  const shouldTruncate = content.length > 280;
  const displayContent = shouldTruncate && !expanded ? content.substring(0, 280) + "..." : content;
  const isBoosted      = !!post.isBoosted;

  const embedUrl      = post.embedUrl  || null;
  const videoUrl      = post.videoUrl  || null;
  const imagesLen     = Array.isArray(post.images) ? post.images.length : 0;
  const mediaLen      = Array.isArray(post.media)  ? post.media.length  : 0;
  const postMediaType = post.mediaType || null;

  const isVideoMediaType = postMediaType === "video" || postMediaType === "youtube";

  const mediaUrls = useMemo(() => {
    const seen = new Set();
    const result = [];
    const addUrl = (raw) => {
      if (!raw || typeof raw !== "string") return;
      if (raw.startsWith("blob:")) {
        if (!seen.has(raw)) { seen.add(raw); result.push(raw); }
        return;
      }
      if (raw.includes("videos.pexels.com")) return;
      if (raw.includes("cdn.pixabay.com/video")) return;
      const url = resolveMediaUrl(raw);
      if (url && !seen.has(url) && isStructurallyValid(url)) {
        seen.add(url);
        result.push(url);
      }
    };
    if (embedUrl) addUrl(embedUrl);
    if (videoUrl) addUrl(videoUrl);
    const imgSrc = post.media || post.images;
    const arr = Array.isArray(imgSrc) ? imgSrc : (imgSrc ? [imgSrc] : []);
    arr.forEach(m => addUrl(typeof m === "string" ? m : m?.url));

    dbgPC(`mediaUrls postId=${post._id} postMediaType=${postMediaType} count=${result.length} urls=`, result);

    return result;
  }, [embedUrl, videoUrl, post.media, post.images, post._id, postMediaType]);

  const hasVideoMedia = useMemo(() => {
    if (isVideoMediaType) return true;
    if (embedUrl) return true;
    if (videoUrl && isVideoUrl(videoUrl)) return true;
    const arr = Array.isArray(post.media) ? post.media : [];
    return arr.some(m => {
      const url = typeof m === "string" ? m : m?.url;
      return url && isVideoUrl(url);
    });
  }, [isVideoMediaType, embedUrl, videoUrl, post.media]);

  const TEXT_CARD_THRESHOLD = 120;
  const hasRawMedia = !!(embedUrl || videoUrl || imagesLen > 0 || mediaLen > 0 || post.thumbnail);
  const trimmedContent = content.trim();

  const isAutoTextCard = !postMediaType
    && !isVideoMediaType
    && !hasRawMedia
    && !hasVideoMedia
    && trimmedContent.length > 0
    && trimmedContent.length <= TEXT_CARD_THRESHOLD;

  const effectiveMediaType = (() => {
    if (postMediaType && postMediaType !== "text") return postMediaType;
    if (isAutoTextCard) return "text-card";
    if (hasVideoMedia && !embedUrl) return "video";
    if (embedUrl) return "youtube";
    return null;
  })();

  const hasMedia = effectiveMediaType === "text-card"
    || mediaUrls.length > 0
    || effectiveMediaType === "youtube"
    || (effectiveMediaType === "video" && mediaLen > 0)
    || !!(post.thumbnail && (videoUrl || embedUrl));

  dbgPC(`render postId=${post._id} mediaType=${postMediaType} effectiveMediaType=${effectiveMediaType} hasMedia=${hasMedia} mediaUrls=${mediaUrls.length} hasVideoMedia=${hasVideoMedia}`);

  const formattedDate = useRelativeTime(post.createdAt || null);

  if (!isMockPost && !isOptimistic && (postUser.isInvalid || postUser.isBannedOrDeleted)) return null;

  return (
    <>
      {/* ✅ FIX BUG 3 — isolation:isolate sur le wrapper du card
          Empêche PostMedia (position:absolute) de créer un stacking context
          non isolé qui pourrait capturer les clics des boutons du header. */}
      <div
        ref={setRootRef}
        className={`relative w-full max-w-[630px] mx-auto ${isDarkMode ? "bg-black" : "bg-white"}`}
        style={{ margin: 0, padding: 0, isolation: "isolate" }}
      >
        {isBoosted && (
          <div className="absolute top-0 right-0 z-10 p-2 pointer-events-none">
            <div className="flex items-center gap-1 bg-gradient-to-r from-orange-500 to-pink-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-bl-xl shadow-lg select-none">
              <RocketLaunchIcon className="w-3 h-3" /> SPONSORISÉ
            </div>
          </div>
        )}

        {/* HEADER */}
        <div className="flex justify-between items-center p-3">
          <div className="flex items-center gap-3">
            <button onClick={handleProfileClick} className="relative shrink-0">
              <SimpleAvatar username={postUser.fullName} photo={postUser.profilePhoto} size={38} />
              {postUser.isPremium && (
                <div className="absolute -bottom-1 -right-1 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full p-[2px] border border-black z-10">
                  <CheckBadgeIcon className="w-3 h-3 text-white" />
                </div>
              )}
            </button>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span
                  onClick={handleProfileClick}
                  className={`font-semibold text-sm cursor-pointer hover:opacity-70 truncate max-w-[150px] ${isDarkMode ? "text-white" : "text-gray-900"}`}
                >
                  {postUser.fullName}
                </span>
                {postUser.isVerified && <CheckBadgeIcon className="w-4 h-4 text-orange-500" />}
              </div>
              <span className="text-xs text-gray-500">{formattedDate}</span>
            </div>
          </div>

          {/* ✅ Boutons header — zIndex élevé + isolation propre */}
          <div
            style={{
              display:       "flex",
              alignItems:    "center",
              gap:           8,
              position:      "relative",
              zIndex:        50,        // ← zIndex plus élevé qu'avant (était 10)
              isolation:     "isolate", // ← isolation locale pour ce groupe de boutons
            }}
          >
            {/* Bouton Booster */}
            {isOwner && !isBoosted && !isMockPost && !isOptimistic && (
              <button
                type="button"
                onClick={handleOpenBoost}
                style={{
                  background:                "linear-gradient(to right, #9333ea, #ec4899)",
                  color:                     "white",
                  padding:                   "4px 12px",
                  borderRadius:              9999,
                  fontSize:                  12,
                  fontWeight:                700,
                  border:                    "none",
                  cursor:                    "pointer",
                  display:                   "flex",
                  alignItems:                "center",
                  gap:                       4,
                  WebkitTapHighlightColor:   "transparent",
                  touchAction:               "manipulation",
                  position:                  "relative",
                  zIndex:                    51,
                  pointerEvents:             "auto",
                }}
              >
                <RocketLaunchIcon style={{ width: 12, height: 12 }} /> Booster
              </button>
            )}

            {/* Bouton Suivre */}
            {canFollow && !isOptimistic && (
              <button
                onClick={handleFollow}
                disabled={loadingFollow}
                style={{
                  padding:                 "4px 12px",
                  borderRadius:            8,
                  fontSize:                12,
                  fontWeight:              600,
                  border:                  "none",
                  cursor:                  loadingFollow ? "not-allowed" : "pointer",
                  background:              isFollowing
                    ? (isDarkMode ? "#1f2937" : "#f3f4f6")
                    : (isDarkMode ? "#ffffff" : "#111827"),
                  color:                   isFollowing
                    ? (isDarkMode ? "#d1d5db" : "#4b5563")
                    : (isDarkMode ? "#000000" : "#ffffff"),
                  WebkitTapHighlightColor: "transparent",
                  touchAction:             "manipulation",
                  position:                "relative",
                  zIndex:                  51,
                  pointerEvents:           "auto",
                }}
              >
                {loadingFollow ? "..." : isFollowing ? "Suivi(e)" : "Suivre"}
              </button>
            )}

            {/* Bouton Supprimer */}
            {isOwner && !isOptimistic && (
              <button
                type="button"
                onClick={handleOpenDelete}
                aria-label="Supprimer ce post"
                style={{
                  padding:                 8,
                  borderRadius:            "50%",
                  border:                  "none",
                  background:              "transparent",
                  cursor:                  "pointer",
                  display:                 "flex",
                  alignItems:              "center",
                  justifyContent:          "center",
                  position:                "relative",
                  zIndex:                  51,
                  WebkitTapHighlightColor: "transparent",
                  touchAction:             "manipulation",
                  pointerEvents:           "auto",
                  // Zone de clic élargie pour mobile
                  minWidth:                44,
                  minHeight:               44,
                }}
              >
                <TrashIcon style={{ width: 20, height: 20, color: "#9ca3af" }} />
              </button>
            )}
          </div>
        </div>

        {/* TEXTE */}
        {content && effectiveMediaType !== "text-card" && (
          <div className="px-3 pb-2">
            <p className={`text-sm ${isDarkMode ? "text-gray-200" : "text-gray-800"}`}>
              {displayContent}
            </p>
            {shouldTruncate && (
              <button onClick={handleExpand} className="text-gray-500 text-sm hover:text-gray-400 mt-1">
                {expanded ? "voir moins" : "voir plus"}
              </button>
            )}
          </div>
        )}

        {/* MEDIA — dans un wrapper avec zIndex bas pour ne pas déborder sur le header */}
        {hasMedia && (
          <div className="w-full" style={{ position: "relative", zIndex: 1 }}>
            <PostMedia
              mediaUrls={mediaUrls}
              isFirstPost={priority}
              post={effectiveMediaType !== postMediaType
                ? { ...post, mediaType: effectiveMediaType }
                : post
              }
            />
          </div>
        )}

        <ActionsBar
          liked={liked} likesCount={likesCount} saved={saved}
          commentsCount={commentsCount} isDarkMode={isDarkMode}
          onLike={handleLike}
          onOpenComments={handleOpenComments}
          onOpenShare={handleOpenShare}
          onSave={handleSave}
        />
      </div>

      {/* ✅ Modals via portail — AnimatePresence en dehors du div card
          pour éviter tout problème de stacking context */}
      <AnimatePresence>
        {showDeleteModal && createPortal(
          <DeleteModal
            isDarkMode={isDarkMode}
            isDeleting={isDeleting}
            onConfirm={handleDeletePost}
            onCancel={() => setShowDeleteModal(false)}
          />,
          getModalRoot()
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showBoostModal && createPortal(
          <BoostModal
            isDarkMode={isDarkMode}
            postId={post._id}
            onClose={() => setShowBoostModal(false)}
          />,
          getModalRoot()
        )}
      </AnimatePresence>

      {showCommentsModal && (
        <ErrorBoundary>
          <Suspense fallback={null}>
            <PostCommentsModal
              isOpen={showCommentsModal}
              onClose={() => setShowCommentsModal(false)}
              postId={post._id}
              postUser={postUser}
              postContent={content}
              postMediaUrl={mediaUrls[0] || null}
              likesCount={likesCount}
              comments={comments}
              setComments={setComments}
              currentUser={currentUser}
              getToken={getToken}
              showToast={showToast}
              navigate={navigate}
              isMockPost={isMockPost}
              onCommentsCountChange={handleCommentsCountChange}
            />
          </Suspense>
        </ErrorBoundary>
      )}

      {showShareModal && (
        <ErrorBoundary>
          <Suspense fallback={null}>
            <PostShareModal
              isOpen={showShareModal}
              onClose={() => setShowShareModal(false)}
              postId={post._id}
              postUser={postUser}
              postContent={content}
              postMediaUrl={mediaUrls[0] || null}
              likesCount={likesCount}
              commentsCount={commentsCount}
              navigate={navigate}
              showToast={showToast}
            />
          </Suspense>
        </ErrorBoundary>
      )}
    </>
  );
});
PostCardInner.displayName = "PostCardInner";

// ─────────────────────────────────────────────────────────────────────────────
// POSTCARD wrapper
// ─────────────────────────────────────────────────────────────────────────────
const PostCard = forwardRef(({ post, onDeleted, showToast, loading = false, mockPost = false, priority = false }, ref) => {
  const { isDarkMode } = useDarkMode();

  if (loading) return <SkeletonPostCard isDarkMode={isDarkMode} />;
  if (!post || !post._id) return null;

  if (post.isOptimistic || post._id?.startsWith("temp_")) {
    return (
      <PostUploadingIndicator
        isDarkMode={isDarkMode}
        content={post.content || post.contenu}
        mediaCount={Array.isArray(post.media) ? post.media.length : 0}
      />
    );
  }

  return (
    <PostCardInner
      ref={ref}
      post={post}
      onDeleted={onDeleted}
      showToast={showToast}
      mockPost={mockPost}
      priority={priority}
    />
  );
});
PostCard.displayName = "PostCard";

export default memo(PostCard, (prev, next) =>
  prev.post?._id              === next.post?._id              &&
  prev.post?.likes?.length    === next.post?.likes?.length    &&
  prev.post?.comments?.length === next.post?.comments?.length &&
  prev.post?.content          === next.post?.content          &&
  prev.post?.contenu          === next.post?.contenu          &&
  prev.post?.isBoosted        === next.post?.isBoosted        &&
  prev.post?.isOptimistic     === next.post?.isOptimistic     &&
  prev.post?.mediaType        === next.post?.mediaType        &&
  prev.post?.textCardPalette  === next.post?.textCardPalette  &&
  (Array.isArray(prev.post?.media)  ? prev.post.media.length  : 0) ===
  (Array.isArray(next.post?.media)  ? next.post.media.length  : 0) &&
  (Array.isArray(prev.post?.images) ? prev.post.images.length : 0) ===
  (Array.isArray(next.post?.images) ? next.post.images.length : 0) &&
  !!prev.post?.embedUrl       === !!next.post?.embedUrl       &&
  !!prev.post?.videoUrl       === !!next.post?.videoUrl       &&
  prev.priority               === next.priority               &&
  prev.loading                === next.loading
);