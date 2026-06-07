// src/pages/Home/PostCard.jsx
// v28 — FIX double createPortal sur FeedbackModal
//
// CHANGEMENT v28 :
//   - Dans PostCardInner, le FeedbackModal était wrappé dans un createPortal externe
//     EN PLUS de son propre createPortal interne → double portal → events React cassés
//   - Fix : supprimer le createPortal externe, FeedbackModal gère son propre portal
//   - Tout le reste est identique à v27.1

import React, {
  forwardRef, useState, useEffect, useLayoutEffect,
  useCallback, useMemo, useRef, memo, lazy, Suspense
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useElements, useStripe } from "@stripe/react-stripe-js";
import {
  TrashIcon, HeartIcon, ChatBubbleLeftIcon, ShareIcon, BookmarkIcon, EllipsisHorizontalIcon,
  XMarkIcon, EyeSlashIcon, ExclamationTriangleIcon, PlusCircleIcon, MinusCircleIcon,
  BellIcon, InformationCircleIcon, CodeBracketIcon, LinkIcon, NoSymbolIcon, ArrowLeftIcon, EyeIcon,
} from "@heroicons/react/24/outline";
import {
  HeartIcon as HeartSolid, CheckBadgeIcon, RocketLaunchIcon, BookmarkIcon as BookmarkSolid
} from "@heroicons/react/24/solid";
import { useAuth } from "../../context/AuthContext";
import { useDarkMode } from "../../context/DarkModeContext";
import PostMedia from "./PostMedia";
import ErrorBoundary from "../../components/ErrorBoundary";
import axiosClient from "../../api/axiosClientGlobal";
import useTranslatedText from "../../hooks/useTranslatedText";
import {
  getPostAuthor,
  hidePostPreference,
  isPostHidden,
  isAuthorNotificationEnabled,
  setAuthorNotificationEnabled,
} from "../../utils/postNotificationPreferences";

const PostCommentsModal = lazy(() => import("./PostComments"));
const PostShareModal    = lazy(() => import("./PostShareSection"));

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? "https://chantilink-backend.onrender.com/api" : "http://localhost:5000/api");
const STRIPE_PUBLIC_KEY = import.meta.env.VITE_STRIPE_PUBLIC_KEY || import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "";
const stripePromise = STRIPE_PUBLIC_KEY ? loadStripe(STRIPE_PUBLIC_KEY) : null;

const BOOST_PLANS = [
  { duration: 24,  amount: 1500, label: "24h",     detail: "Coup de pouce rapide" },
  { duration: 72,  amount: 3500, label: "3 jours", detail: "Visibilite equilibree" },
  { duration: 168, amount: 7000, label: "7 jours", detail: "Campagne prolongee" },
];

const SAVED_POSTS_KEY = "chantilink_saved_posts_v1";
const VIEWED_POSTS_SESSION_KEY = "chantilink_viewed_posts_session_v1";
const VIEWED_POSTS_SESSION = new Set();
const VIEWING_POSTS_SESSION = new Set();

const getPostViewsCount = (post) => {
  const raw = Array.isArray(post?.views) ? post.views.length : (post?.viewsCount ?? post?.views ?? 0);
  return Number.isFinite(Number(raw)) ? Number(raw) : 0;
};

const formatCompactCount = (value) => {
  const count = Number(value) || 0;
  if (count >= 1_000_000) {
    const compact = count / 1_000_000;
    return `${Number(compact.toFixed(compact >= 10 ? 0 : 1))}M`;
  }
  if (count >= 1_000) {
    const compact = count / 1_000;
    return `${Number(compact.toFixed(compact >= 10 ? 0 : 1))}K`;
  }
  return String(count);
};

const getSessionViewedPosts = () => {
  if (typeof window === "undefined") return VIEWED_POSTS_SESSION;
  if (VIEWED_POSTS_SESSION.size) return VIEWED_POSTS_SESSION;
  try {
    const parsed = JSON.parse(window.sessionStorage?.getItem(VIEWED_POSTS_SESSION_KEY) || "[]");
    if (Array.isArray(parsed)) parsed.forEach((id) => VIEWED_POSTS_SESSION.add(String(id)));
  } catch {}
  return VIEWED_POSTS_SESSION;
};

const markSessionViewedPost = (postId) => {
  if (!postId || typeof window === "undefined") return;
  const viewed = getSessionViewedPosts();
  viewed.add(String(postId));
  try { window.sessionStorage?.setItem(VIEWED_POSTS_SESSION_KEY, JSON.stringify([...viewed].slice(-1000))); } catch {}
};

const getSavedPostIds = () => {
  if (typeof window === "undefined") return new Set();
  try {
    const parsed = JSON.parse(window.localStorage?.getItem(SAVED_POSTS_KEY) || "[]");
    return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
  } catch {
    return new Set();
  }
};

const setSavedPostPreference = (postId, enabled) => {
  if (!postId || typeof window === "undefined") return;
  const ids = getSavedPostIds();
  enabled ? ids.add(String(postId)) : ids.delete(String(postId));
  try { window.localStorage?.setItem(SAVED_POSTS_KEY, JSON.stringify([...ids].slice(-1000))); } catch {}
};

const IS_LOW_END_DEVICE = typeof navigator !== "undefined" && (
  (navigator.hardwareConcurrency || 4) <= 2 ||
  (navigator.deviceMemory || 4) <= 2
);

const _initDebug = () => {
  if (typeof window === "undefined") return false;
  try {
    if (new URLSearchParams(window.location.search).get("postcard_debug") === "1") {
      window.localStorage?.setItem("POSTCARD_DEBUG", "1");
      return true;
    }
  } catch {}
  return window.localStorage?.getItem("POSTCARD_DEBUG") === "1";
};
const _DEBUG_CACHED = _initDebug();
const dbgPC   = _DEBUG_CACHED ? (...a) => console.log("%c[PostCard]",  "color:#f97316;font-weight:bold", ...a) : () => {};
const dbgWarn = _DEBUG_CACHED ? (...a) => console.warn("%c[PostCard]", "color:#ef4444;font-weight:bold", ...a) : () => {};

// ─────────────────────────────────────────────────────────────────────────────
// getModalRoot
// ─────────────────────────────────────────────────────────────────────────────
const getModalRoot = () => {
  let el = document.getElementById("modal-root");
  if (el && !document.body.contains(el)) { el.remove(); el = null; }
  if (!el) {
    el = document.createElement("div");
    el.id = "modal-root";
    document.body.appendChild(el);
  }
  el.style.cssText = "position:fixed;inset:0;z-index:999999;pointer-events:none;overflow:visible;";
  return el;
};

const toStr = (v) => {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return String(v._id ?? v.id ?? "");
  return String(v);
};

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
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  if (raw.startsWith("blob:")) return raw;
  if (raw.startsWith("/uploads/") || raw.startsWith("uploads/"))
    return `${API_URL.replace("/api", "")}/${raw.replace(/^\/+/, "")}`;
  if (R2_PUBLIC_URL) return `${R2_PUBLIC_URL}/${raw.replace(/^\/+/, "")}`;
  return raw;
};

// ─────────────────────────────────────────────────────────────────────────────
// Timestamp relatif
// ─────────────────────────────────────────────────────────────────────────────
const _relativeSubscribers = new Set();
let   _relativeTimer = null;

const _startGlobalTimer = () => {
  if (_relativeTimer) return;
  _relativeTimer = setInterval(() => {
    if (_relativeSubscribers.size === 0) { clearInterval(_relativeTimer); _relativeTimer = null; return; }
    _relativeSubscribers.forEach(fn => fn());
  }, 15_000);
};

const _formatRelative = (date) => {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  if (diff < 0)            return "a l'instant";
  if (diff < 45_000)       return "a l'instant";
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
// Observer video (singleton)
// ─────────────────────────────────────────────────────────────────────────────
let _videoObserver = null;
const _observedVideos = new WeakMap();

const getVideoObserver = () => {
  if (!_videoObserver) {
    _videoObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const v = entry.target;
        if (!document.contains(v)) { _videoObserver?.unobserve(v); return; }
        if (entry.isIntersecting) {
          v.play().catch(() => {});
        } else {
          v.pause();
          if (IS_LOW_END_DEVICE && v.src) {
            const savedSrc = v.src;
            v.removeAttribute("src");
            v.load();
            v.src = savedSrc;
          }
        }
      });
    }, { threshold: IS_LOW_END_DEVICE ? 0.9 : 0.85 });
  }
  return _videoObserver;
};

// ─────────────────────────────────────────────────────────────────────────────
// PostUploadingIndicator
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
        {content ? content.substring(0, 60) + (content.length > 60 ? "..." : "") : "Publication en cours..."}
      </p>
      <p className="text-xs text-orange-500 mt-0.5">
        {mediaCount > 0 ? `Upload de ${mediaCount} fichier${mediaCount > 1 ? "s" : ""}...` : "Envoi en cours..."}
      </p>
    </div>
  </div>
));
PostUploadingIndicator.displayName = "PostUploadingIndicator";

// ─────────────────────────────────────────────────────────────────────────────
// Avatar
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
// Skeleton
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
// Bus d'evenements pour les modals
// ─────────────────────────────────────────────────────────────────────────────
const MODAL_EVENT = "postcard:openModal";

const emitModalEvent = (action, post, extra = {}) => {
  window.dispatchEvent(new CustomEvent(MODAL_EVENT, {
    detail: { action, post, ...extra },
    bubbles: false,
  }));
};

// ─────────────────────────────────────────────────────────────────────────────
// DeleteModal
// ─────────────────────────────────────────────────────────────────────────────
const DeleteModal = memo(({ isDarkMode, isDeleting, onConfirm, onCancel }) => {
  const isClosingRef = useRef(false);
  const safeCancel = (e) => {
    e?.stopPropagation();
    if (isDeleting || isClosingRef.current) return;
    isClosingRef.current = true;
    onCancel();
  };
  const safeConfirm = (e) => {
    e?.stopPropagation();
    if (isDeleting || isClosingRef.current) return;
    onConfirm();
  };
  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 999999,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.82)",
        backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
        padding: "16px", pointerEvents: "auto",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) safeCancel(e); }}
    >
      <motion.div
        initial={{ scale: 0.88, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.88, opacity: 0 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        style={{
          width: "100%", maxWidth: 360, borderRadius: 20, padding: 24,
          boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
          background: isDarkMode ? "#111827" : "#ffffff",
          border: isDarkMode ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.06)",
          pointerEvents: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
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
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: isDarkMode ? "#ffffff" : "#111827" }}>
            Supprimer ce post ?
          </h2>
          <p style={{ fontSize: 14, color: "#6b7280", margin: 0 }}>
            Cette action est irreversible.
          </p>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button type="button" onClick={safeCancel} disabled={isDeleting}
            style={{
              flex: 1, padding: "12px 0", borderRadius: 12, fontWeight: 700, fontSize: 15,
              border: "none", cursor: isDeleting ? "not-allowed" : "pointer",
              opacity: isDeleting ? 0.5 : 1,
              background: isDarkMode ? "#1f2937" : "#f3f4f6",
              color: isDarkMode ? "#ffffff" : "#111827", pointerEvents: "auto",
            }}>
            Annuler
          </button>
          <button type="button" onClick={safeConfirm} disabled={isDeleting}
            style={{
              flex: 1, padding: "12px 0", borderRadius: 12, fontWeight: 700, fontSize: 15,
              border: "none", cursor: isDeleting ? "not-allowed" : "pointer",
              opacity: isDeleting ? 0.5 : 1,
              background: "#ef4444", color: "#ffffff", pointerEvents: "auto",
            }}>
            {isDeleting ? "Suppression..." : "Supprimer"}
          </button>
        </div>
      </motion.div>
    </div>
  );
});
DeleteModal.displayName = "DeleteModal";

// ─────────────────────────────────────────────────────────────────────────────
// BoostModal
// ─────────────────────────────────────────────────────────────────────────────
const BoostPaymentForm = memo(({ isDarkMode, postId, onClose, onBoosted, showToast }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [plan, setPlan] = useState(BOOST_PLANS[1]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const pay = async () => {
    if (!stripe || !elements || loading) return;
    setLoading(true);
    setError("");
    try {
      const { data } = await axiosClient.post("/boost/create", {
        contentType: "Post", contentId: postId, duration: plan.duration,
      });
      const card = elements.getElement(CardElement);
      const result = await stripe.confirmCardPayment(data.clientSecret, {
        payment_method: { card },
      });
      if (result.error) throw new Error(result.error.message || "Paiement refuse");
      if (result.paymentIntent?.status !== "succeeded") throw new Error("Paiement non confirme");
      await axiosClient.post(`/boost/${data.boostId}/confirm`);
      onBoosted?.();
      showToast?.("Boost active avec succes", "success");
      onClose();
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.message || err.message || "Erreur paiement";
      setError(msg);
      showToast?.(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
        {BOOST_PLANS.map(p => {
          const active = p.duration === plan.duration;
          return (
            <button key={p.duration} type="button" onClick={() => setPlan(p)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                gap: 12, padding: "12px 14px", borderRadius: 12,
                border: active ? "2px solid #a855f7" : `1px solid ${isDarkMode ? "#374151" : "#e5e7eb"}`,
                background: active ? "rgba(168,85,247,0.12)" : (isDarkMode ? "#1f2937" : "#f9fafb"),
                color: isDarkMode ? "#fff" : "#111827", cursor: "pointer", textAlign: "left",
              }}>
              <span>
                <strong style={{ display: "block", fontSize: 14 }}>{p.label}</strong>
                <span style={{ display: "block", fontSize: 12, color: "#6b7280" }}>{p.detail}</span>
              </span>
              <strong style={{ whiteSpace: "nowrap" }}>{p.amount.toLocaleString("fr-FR")} FCFA</strong>
            </button>
          );
        })}
      </div>
      <div style={{
        padding: 12, borderRadius: 12, marginBottom: 12,
        background: isDarkMode ? "#0f172a" : "#f9fafb",
        border: `1px solid ${isDarkMode ? "#334155" : "#e5e7eb"}`,
      }}>
        <CardElement options={{
          hidePostalCode: true,
          style: {
            base: { fontSize: "15px", color: isDarkMode ? "#ffffff" : "#111827", "::placeholder": { color: "#9ca3af" } },
            invalid: { color: "#ef4444" },
          },
        }} />
      </div>
      {error && <p style={{ color: "#ef4444", fontSize: 13, margin: "0 0 12px" }}>{error}</p>}
      <button type="button" onClick={pay} disabled={!stripe || loading}
        style={{
          width: "100%", padding: "12px 0", borderRadius: 12, fontWeight: 700,
          fontSize: 15, border: "none", cursor: (!stripe || loading) ? "not-allowed" : "pointer",
          opacity: (!stripe || loading) ? 0.65 : 1,
          background: "linear-gradient(135deg, #9333ea, #ec4899)", color: "#ffffff",
          pointerEvents: "auto",
        }}>
        {loading ? "Paiement..." : `Payer ${plan.amount.toLocaleString("fr-FR")} FCFA`}
      </button>
    </>
  );
});
BoostPaymentForm.displayName = "BoostPaymentForm";

const BoostModal = memo(({ isDarkMode, postId, onClose, onBoosted, showToast }) => {
  const isClosingRef = useRef(false);
  const safeClose = (e) => {
    e?.stopPropagation();
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    onClose();
  };
  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 999999,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.82)",
        backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
        padding: "16px", pointerEvents: "auto",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) safeClose(e); }}
    >
      <motion.div
        initial={{ scale: 0.88, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.88, opacity: 0 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        style={{
          width: "100%", maxWidth: 400, borderRadius: 20, padding: 24,
          boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
          background: isDarkMode ? "#111827" : "#ffffff",
          border: isDarkMode ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.06)",
          pointerEvents: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
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
            Augmentez la visibilite de votre publication.
          </p>
        </div>
        {!stripePromise ? (
          <p style={{ color: "#ef4444", fontSize: 14, margin: 0 }}>
            Paiement indisponible: cle publique Stripe manquante.
          </p>
        ) : (
          <Elements stripe={stripePromise}>
            <BoostPaymentForm
              isDarkMode={isDarkMode} postId={postId}
              onClose={safeClose} onBoosted={onBoosted} showToast={showToast}
            />
          </Elements>
        )}
        <button type="button" onClick={safeClose}
          style={{
            width: "100%", padding: "10px 0", borderRadius: 12, fontWeight: 700,
            fontSize: 14, border: "none", cursor: "pointer", marginTop: 10,
            background: isDarkMode ? "#1f2937" : "#f3f4f6",
            color: isDarkMode ? "#ffffff" : "#111827", pointerEvents: "auto",
          }}>
          Annuler
        </button>
      </motion.div>
    </div>
  );
});
BoostModal.displayName = "BoostModal";

// ─────────────────────────────────────────────────────────────────────────────
// GlobalModalManager
// ─────────────────────────────────────────────────────────────────────────────
const GlobalModalManagerBase = () => {
  const { isDarkMode } = useDarkMode();
  const [modalState, setModalState] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      const { action, post, onDeleted, onBoosted, showToast, mockPost } = e.detail || {};
      if (!action || !post) return;
      setIsDeleting(false);
      setModalState({ action, post, onDeleted, onBoosted, showToast, mockPost });
    };
    window.addEventListener(MODAL_EVENT, handler);
    return () => window.removeEventListener(MODAL_EVENT, handler);
  }, []);

  const close = useCallback(() => setModalState(null), []);

  const handleDeletePost = useCallback(async () => {
    if (!modalState) return;
    const { post, onDeleted, showToast, mockPost } = modalState;
    const isMock = mockPost || post._id?.startsWith("post_") || post.isMockPost;
    const isTemp = !!post.isOptimistic || post._id?.startsWith("temp_");
    if (isTemp)  { showToast?.("Publication en cours, patientez...", "info"); close(); return; }
    if (isMock)  { showToast?.("Post supprime", "success"); close(); onDeleted?.(post._id); return; }
    setIsDeleting(true);
    try {
      await axiosClient.delete(`/posts/${post._id}`);
      showToast?.("Post supprime", "success");
      close();
      onDeleted?.(post._id);
    } catch (err) {
      const s = err.response?.status;
      if (s === 404) { close(); onDeleted?.(post._id); }
      else showToast?.(s === 403 ? "Permission refusee" : err.response?.data?.message || "Erreur", "error");
    } finally { setIsDeleting(false); }
  }, [modalState, close]);

  if (!modalState) return null;

  return createPortal(
    <AnimatePresence>
      {modalState.action === "delete" && (
        <DeleteModal key="delete" isDarkMode={isDarkMode} isDeleting={isDeleting}
          onConfirm={handleDeletePost} onCancel={close} />
      )}
      {modalState.action === "boost" && (
        <BoostModal key="boost" isDarkMode={isDarkMode} postId={modalState.post?._id}
          onClose={close} onBoosted={modalState.onBoosted} showToast={modalState.showToast} />
      )}
    </AnimatePresence>,
    getModalRoot()
  );
};

export const GlobalModalManager = memo(GlobalModalManagerBase);
GlobalModalManager.displayName = "GlobalModalManager";

// ─────────────────────────────────────────────────────────────────────────────
// ActionsBar
// ─────────────────────────────────────────────────────────────────────────────
const ActionsBar = memo(({ liked, likesCount, saved, commentsCount, viewsCount, isDarkMode, onLike, onOpenComments, onOpenShare, onSave }) => (
  <div className="flex items-center justify-between px-3 py-2">
    <div className="flex items-center gap-4">
      <button onClick={onLike} className="flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-orange-500 transition-colors">
        {liked
          ? <HeartSolid className="w-5 h-5 text-red-500" />
          : <HeartIcon className={`w-5 h-5 ${isDarkMode ? "text-gray-300" : "text-gray-700"}`} />
        }
        <span>{likesCount || 0}</span>
      </button>
      <button onClick={onOpenComments} className="flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-orange-500 transition-colors">
        <ChatBubbleLeftIcon className={`w-5 h-5 ${isDarkMode ? "text-gray-300" : "text-gray-700"}`} />
        <span>{commentsCount || 0}</span>
      </button>
      <button onClick={onOpenShare} className="flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-orange-500 transition-colors">
        <ShareIcon className={`w-5 h-5 ${isDarkMode ? "text-gray-300" : "text-gray-700"}`} />
        <span>Partager</span>
      </button>
      <div className={`flex items-center gap-2 text-sm font-semibold ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>
        <EyeIcon className="w-5 h-5" />
        <span>{formatCompactCount(viewsCount)}</span>
      </div>
    </div>
    <button onClick={onSave} className="flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-orange-500 transition-colors">
      {saved
        ? <BookmarkSolid className="w-5 h-5 text-orange-500" />
        : <BookmarkIcon className={`w-5 h-5 ${isDarkMode ? "text-gray-300" : "text-gray-700"}`} />
      }
    </button>
  </div>
));
ActionsBar.displayName = "ActionsBar";

// ─────────────────────────────────────────────────────────────────────────────
// FeedbackBar
// ─────────────────────────────────────────────────────────────────────────────
const FeedbackBar = memo(({ postId, isDarkMode, showToast }) => {
  const [given, setGiven] = useState(() => !!(typeof window !== 'undefined' && window.localStorage?.getItem(`feedback_given_${postId}`)));
  const [loading, setLoading] = useState(false);
  const sendFeedback = async (liked) => {
    if (given || loading) return;
    setLoading(true);
    try {
      await axiosClient.post(`/posts/${postId}/feedback`, { liked });
      setGiven(true);
      try { window.localStorage?.setItem(`feedback_given_${postId}`, '1'); } catch {}
      showToast?.(liked ? "Merci — contenu apprécié" : "Merci pour votre retour", "success");
    } catch (err) {
      showToast?.(err?.response?.data?.message || err.message || "Erreur", "error");
    } finally { setLoading(false); }
  };
  return (
    <div className="px-3 py-2 border-t flex items-center justify-between">
      <div className={`text-sm ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>Ce contenu vous plaît ?</div>
      <div className="flex items-center gap-2">
        {!given ? (
          <>
            <button onClick={() => sendFeedback(true)} disabled={loading}
              className="px-3 py-1 rounded-md bg-green-500 text-white text-sm font-medium">Oui</button>
            <button onClick={() => sendFeedback(false)} disabled={loading}
              className="px-3 py-1 rounded-md bg-gray-200 text-sm font-medium">Non</button>
          </>
        ) : (
          <div className="text-xs text-gray-400">Retour enregistré</div>
        )}
      </div>
    </div>
  );
});
FeedbackBar.displayName = "FeedbackBar";

// ─────────────────────────────────────────────────────────────────────────────
// FeedbackModal v3
// FIX : gère son propre createPortal → NE PAS wrapper dans un portal externe
// ─────────────────────────────────────────────────────────────────────────────
const FeedbackModal = memo(({
  postId, isDarkMode, showToast, onClose,
  onOpenShare, onOpenDelete, onOpenBoost, onToggleSave, onHideLocal,
  isOwner = false, isBoosted = false, isTempPost = false, saved = false, post = null,
}) => {
  const [loading, setLoading] = useState(false);
  const [selectedAction, setSelectedAction] = useState(null);
  const author = useMemo(() => getPostAuthor(post), [post]);
  const [notificationsOn, setNotificationsOn] = useState(() => isAuthorNotificationEnabled(author.id));

  useEffect(() => { setNotificationsOn(isAuthorNotificationEnabled(author.id)); }, [author.id]);

  const emitInteraction = (action) => {
    window.dispatchEvent(new CustomEvent("feed:interaction", {
      detail: { action, post, position: post?._displayPosition ?? 0 },
    }));
  };

  const sendFeedback = async (liked, reason, { hide = false } = {}) => {
    if (loading) return;
    setLoading(true);
    try {
      await axiosClient.post(`/posts/${postId}/feedback`, { liked, reason });
      try { window.localStorage?.setItem(`feedback_given_${postId}`, '1'); } catch {}
      showToast?.("Retour enregistré", "success");
    } catch (err) {
      showToast?.(err?.response?.data?.message || err.message || "Erreur", "error");
    } finally {
      setLoading(false);
      emitInteraction(reason);
      if (hide) {
        hidePostPreference(postId);
        onHideLocal?.();
        window.dispatchEvent(new CustomEvent("post:hidden", { detail: { postId, post, passive: true } }));
      }
      setTimeout(() => onClose?.(), hide ? 120 : 500);
    }
  };

  const closeThen = (fn) => { onClose?.(); setTimeout(() => fn?.(), 0); };

  const copyText = async (text, successMessage) => {
    try {
      if (!navigator.clipboard) throw new Error("no clipboard");
      await navigator.clipboard.writeText(text);
      showToast?.(successMessage, "success");
    } catch {
      showToast?.(text, "info");
    }
    onClose?.();
  };

  const copyPostLink = () =>
    copyText(`${window.location.origin}/posts/${postId}`, "Lien de la publication copié");

  const toggleNotifications = () => {
    if (!author.id) { showToast?.("Auteur introuvable", "error"); onClose?.(); return; }
    const next = !notificationsOn;
    setNotificationsOn(next);
    setAuthorNotificationEnabled(author.id, next);
    if (next && "Notification" in window && Notification.permission === "default") {
      try { Notification.requestPermission()?.catch?.(() => {}); } catch {}
    }
    showToast?.(
      next ? `Notifications activées pour ${author.name}` : `Notifications désactivées pour ${author.name}`,
      "success"
    );
    onClose?.();
  };

  // ── Groupes d'actions ────────────────────────────────────────────────────
  const visitorOnlyGroup = !isOwner ? [
    {
      label: "Masquer cette publication",
      description: "Vous verrez moins de publications comme celle-ci.",
      detail: "Cette publication sera retirée de votre fil immédiatement. Chantilink utilisera ce retour pour affiner vos recommandations.",
      confirmLabel: "Masquer la publication",
      icon: EyeSlashIcon,
      onConfirm: () => sendFeedback(false, "hide", { hide: true }),
    },
    {
      label: "Signaler cette publication",
      description: "Signalez un problème avec cette publication.",
      detail: "Utilisez cette action si le contenu semble abusif, trompeur ou dangereux. La publication sera retirée de votre fil et votre signalement transmis.",
      confirmLabel: "Signaler et masquer",
      icon: ExclamationTriangleIcon,
      danger: true,
      onConfirm: () => sendFeedback(false, "report", { hide: true }),
    },
  ] : [];

  const interestGroup = [
    {
      label: "Ça m'intéresse",
      description: "Vous verrez plus de publications de ce type.",
      detail: "Cette action aide le fil à comprendre que ce sujet, cet auteur ou ce format vous plaît.",
      confirmLabel: "Voir plus comme ça",
      icon: PlusCircleIcon,
      onConfirm: () => sendFeedback(true, "interested"),
    },
    {
      label: "Ça ne m'intéresse pas",
      description: "Vous verrez moins de publications de ce type.",
      detail: "Cette publication sera masquée et le fil réduira les contenus similaires.",
      confirmLabel: "Voir moins comme ça",
      icon: MinusCircleIcon,
      onConfirm: () => sendFeedback(false, "not_interested", { hide: true }),
    },
  ];

  const utilityGroup = [
    {
      label: notificationsOn ? "Désactiver les notifications" : "Activer les notifications",
      description: notificationsOn ? "Ne plus recevoir d'alertes pour ce post." : "Recevoir les nouveautés de cette publication.",
      detail: notificationsOn
        ? `Vous ne recevrez plus d'alertes lorsque ${author.name} publie.`
        : `Vous serez notifié lorsque ${author.name} publie du nouveau contenu.`,
      confirmLabel: notificationsOn ? "Désactiver" : "Activer",
      icon: BellIcon,
      onConfirm: toggleNotifications,
    },
    {
      label: saved ? "Retirer des favoris" : "Enregistrer la publication",
      description: saved ? "Retirer cette publication de vos favoris." : "Retrouver cette publication plus tard.",
      icon: BookmarkIcon,
      onClick: () => closeThen(onToggleSave),
    },
    {
      label: "Partager la publication",
      description: "Envoyer cette publication à d'autres personnes.",
      icon: ShareIcon,
      onClick: () => { emitInteraction("share"); closeThen(onOpenShare); },
    },
    {
      label: "Copier le lien",
      description: "Copier l'adresse directe de cette publication.",
      icon: LinkIcon,
      onClick: copyPostLink,
    },
    {
      label: "Pourquoi je vois cette publication",
      description: "Voir les signaux utilisés pour vous la proposer.",
      icon: InformationCircleIcon,
      detail: "Cette publication peut apparaître selon vos interactions, vos abonnements et les contenus consultés récemment.",
      confirmLabel: "Ça m'intéresse",
      onConfirm: () => sendFeedback(true, "interested"),
      secondaryLabel: "Voir moins",
      onSecondary: () => sendFeedback(false, "not_interested", { hide: true }),
    },
    {
      label: "À propos de cette publication",
      description: "Afficher les informations disponibles sur ce post.",
      icon: InformationCircleIcon,
      detail: `Publication créée sur Chantilink${author.name ? ` par ${author.name}` : ""}.`,
      confirmLabel: saved ? "Retirer des favoris" : "Enregistrer",
      onConfirm: () => closeThen(onToggleSave),
    },
    {
      label: "Intégrer à un site",
      description: "Copier le code d'intégration de cette publication.",
      icon: CodeBracketIcon,
      detail: "Copie un code iframe que vous pourrez coller sur un site compatible.",
      confirmLabel: "Copier le code",
      onConfirm: () => copyText(
        `<iframe src="${window.location.origin}/embed/posts/${postId}"></iframe>`,
        "Code d'intégration copié"
      ),
    },
  ];

  const ownerGroup = isOwner && !isTempPost ? [
    ...(!isBoosted ? [{
      label: "Booster cette publication",
      description: "Augmenter la visibilité de votre post.",
      icon: RocketLaunchIcon,
      detail: "Le boost lance une mise en avant payante pour donner plus de visibilité à cette publication.",
      confirmLabel: "Choisir un boost",
      onConfirm: () => closeThen(onOpenBoost),
    }] : []),
    {
      label: "Supprimer cette publication",
      description: "Retirer définitivement cette publication.",
      icon: TrashIcon,
      danger: true,
      detail: "Cette action est irréversible. La publication sera définitivement supprimée.",
      confirmLabel: "Supprimer définitivement",
      onConfirm: () => closeThen(onOpenDelete),
    },
  ] : [];

  const muteAuthorGroup = !isOwner ? [{
    label: "Ne plus voir l'auteur",
    description: "Limiter les publications de ce compte dans votre fil.",
    icon: NoSymbolIcon,
    detail: `Cette publication sera masquée et le fil réduira les contenus de ${author.name}.`,
    confirmLabel: "Limiter cet auteur",
    onConfirm: () => sendFeedback(false, "mute_author", { hide: true }),
  }] : [];

  const actionGroups = [visitorOnlyGroup, interestGroup, utilityGroup, ownerGroup, muteAuthorGroup]
    .filter(g => g.length > 0);

  const handleActionClick = (action) => {
    if (action.detail) { setSelectedAction(action); return; }
    action.onClick?.();
  };

  // ── Vue détail
  if (selectedAction) {
    const Icon = selectedAction.icon;
    return createPortal(
      <div
        style={{ position: "fixed", inset: 0, zIndex: 9999999, pointerEvents: "auto",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 16, background: "rgba(0,0,0,0.5)" }}
        onClick={onClose}
      >
        <div
          style={{ pointerEvents: "auto", width: "100%", maxWidth: 420, borderRadius: 24,
            maxHeight: "88vh", overflow: "hidden", display: "flex", flexDirection: "column",
            background: isDarkMode ? "#111827" : "#ffffff",
            border: isDarkMode ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.08)",
            boxShadow: "0 24px 64px rgba(0,0,0,0.4)" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px",
            borderBottom: isDarkMode ? "1px solid rgba(255,255,255,0.1)" : "1px solid #f0f0f0",
            flexShrink: 0 }}>
            <button type="button" onClick={() => setSelectedAction(null)}
              style={{ pointerEvents: "auto", background: "none", border: "none", cursor: "pointer",
                borderRadius: "50%", padding: 8, color: isDarkMode ? "#e5e7eb" : "#374151" }}>
              <ArrowLeftIcon style={{ width: 20, height: 20 }} />
            </button>
            <p style={{ flex: 1, fontSize: 14, fontWeight: 700, margin: 0,
              color: isDarkMode ? "#ffffff" : "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {selectedAction.label}
            </p>
            <button type="button" onClick={onClose}
              style={{ pointerEvents: "auto", background: "none", border: "none", cursor: "pointer",
                borderRadius: "50%", padding: 8, color: isDarkMode ? "#9ca3af" : "#6b7280" }}>
              <XMarkIcon style={{ width: 20, height: 20 }} />
            </button>
          </div>
          <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch",
            padding: 16, pointerEvents: "auto" }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", marginBottom: 12,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: selectedAction.danger ? "rgba(239,68,68,0.1)" : "rgba(249,115,22,0.1)",
              color: selectedAction.danger ? "#ef4444" : "#f97316" }}>
              <Icon style={{ width: 20, height: 20 }} />
            </div>
            <p style={{ fontSize: 14, lineHeight: 1.6, margin: "0 0 16px",
              color: isDarkMode ? "#d1d5db" : "#374151" }}>
              {selectedAction.detail}
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              {selectedAction.secondaryLabel && (
                <button type="button" onClick={selectedAction.onSecondary} disabled={loading}
                  style={{ pointerEvents: "auto", flex: 1, padding: "10px 0", borderRadius: 12,
                    fontWeight: 700, fontSize: 14, border: "none", cursor: loading ? "not-allowed" : "pointer",
                    opacity: loading ? 0.6 : 1,
                    background: isDarkMode ? "rgba(255,255,255,0.1)" : "#f3f4f6",
                    color: isDarkMode ? "#ffffff" : "#111827" }}>
                  {selectedAction.secondaryLabel}
                </button>
              )}
              <button type="button" onClick={selectedAction.onConfirm} disabled={loading}
                style={{ pointerEvents: "auto", flex: 1, padding: "10px 0", borderRadius: 12,
                  fontWeight: 700, fontSize: 14, border: "none", cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.6 : 1,
                  background: selectedAction.danger ? "#ef4444" : "#f97316",
                  color: "#ffffff" }}>
                {loading ? "Traitement..." : selectedAction.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      </div>,
      getModalRoot()
    );
  }

  // ── Vue principale
  return createPortal(
    <div
      style={{ position: "fixed", inset: 0, zIndex: 9999999, pointerEvents: "auto",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16, background: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
    >
      <div
        style={{ pointerEvents: "auto", width: "100%", maxWidth: 420, borderRadius: 24,
          maxHeight: "88vh", overflow: "hidden", display: "flex", flexDirection: "column",
          background: isDarkMode ? "#111827" : "#ffffff",
          border: isDarkMode ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.08)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.4)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: "16px 16px 12px", borderBottom: isDarkMode ? "1px solid rgba(255,255,255,0.1)" : "1px solid #f0f0f0",
          flexShrink: 0, position: "relative" }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, paddingRight: 36,
            color: isDarkMode ? "#ffffff" : "#111827" }}>
            {isOwner ? "Gérer ma publication" : "Actions sur la publication"}
          </h3>
          {isOwner && (
            <p style={{ fontSize: 12, margin: "2px 0 0", color: isDarkMode ? "#6b7280" : "#9ca3af" }}>
              Vous êtes l'auteur de cette publication
            </p>
          )}
          <button type="button" onClick={onClose}
            style={{ pointerEvents: "auto", position: "absolute", top: 12, right: 12,
              background: "none", border: "none", cursor: "pointer", borderRadius: "50%", padding: 6,
              color: isDarkMode ? "#9ca3af" : "#6b7280" }}>
            <XMarkIcon style={{ width: 20, height: 20 }} />
          </button>
        </div>

        {/* Liste scrollable */}
        <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", pointerEvents: "auto" }}>
          {actionGroups.map((group, gi) => (
            <div key={gi} style={{
              borderTop: gi > 0 ? (isDarkMode ? "1px solid rgba(255,255,255,0.08)" : "1px solid #f0f0f0") : "none",
              padding: "4px 0",
            }}>
              {group.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.label}
                    type="button"
                    onClick={() => handleActionClick(action)}
                    disabled={loading}
                    style={{
                      pointerEvents: "auto",
                      width: "100%", display: "flex", alignItems: "flex-start", gap: 12,
                      padding: "12px 16px", background: "none", border: "none",
                      cursor: loading ? "not-allowed" : "pointer", textAlign: "left",
                      opacity: loading ? 0.6 : 1,
                      color: action.danger ? "#ef4444" : isDarkMode ? "#f3f4f6" : "#111827",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = isDarkMode ? "rgba(255,255,255,0.05)" : "#f9fafb"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
                  >
                    <span style={{ marginTop: 2, flexShrink: 0,
                      color: action.danger ? "#ef4444" : isDarkMode ? "#d1d5db" : "#374151" }}>
                      <Icon style={{ width: 20, height: 20 }} />
                    </span>
                    <span>
                      <span style={{ display: "block", fontSize: 14, fontWeight: 600, lineHeight: 1.4 }}>
                        {action.label}
                      </span>
                      <span style={{ display: "block", fontSize: 12, lineHeight: 1.4,
                        color: isDarkMode ? "#6b7280" : "#9ca3af" }}>
                        {action.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>,
    getModalRoot()
  );
});
FeedbackModal.displayName = "FeedbackModal";

// ─────────────────────────────────────────────────────────────────────────────
// PostCardInner
// ─────────────────────────────────────────────────────────────────────────────
const PostCardInner = forwardRef(({
  post, onDeleted, showToast, mockPost = false, priority = false, ignoreHidden = false,
}, ref) => {
  const { isDarkMode } = useDarkMode();
  const { user: currentUser, getToken, updateUserProfile } = useAuth();
  const navigate = useNavigate();
  const cardRef  = useRef(null);
  const vidsRef  = useRef([]);

  const isMockPost   = mockPost || post._id?.startsWith("post_") || post.isMockPost;
  const isOptimistic = !!post.isOptimistic;
  const isTempPost   = !!post.isOptimistic || post._id?.startsWith("temp_");

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
      _raw:              u,
    };
  }, [post._id, post.user, post.author, post.userId, post.fullName, isMockPost, isOptimistic]);

  const [liked,             setLiked]             = useState(() =>
    currentUser && Array.isArray(post.likes)
      ? post.likes.some(l => (typeof l === "object" ? l._id : l)?.toString() === currentUser._id?.toString())
      : false
  );
  const [likesCount,    setLikesCount]    = useState(() => Array.isArray(post.likes) ? post.likes.length : (post.likesCount || 0));
  const [commentsCount, setCommentsCount] = useState(() => Array.isArray(post.comments) ? post.comments.length : (post.commentsCount || 0));
  const [viewsCount,    setViewsCount]    = useState(() => getPostViewsCount(post));
  const [comments,      setComments]      = useState(() => Array.isArray(post.comments) ? post.comments : []);
  const [saved,         setSaved]         = useState(() => getSavedPostIds().has(String(post._id)));
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [showShareModal,    setShowShareModal]    = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [boostedLocal, setBoostedLocal] = useState(() => !!post.isBoosted);
  const [hiddenLocal,  setHiddenLocal]  = useState(() => isPostHidden(post));
  const [isFollowing,  setIsFollowing]  = useState(() => {
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
  useLayoutEffect(() => { stateRef.current = { liked, likesCount, isFollowing, loadingFollow }; });
  useLayoutEffect(() => { postRef.current = { post, postUser, currentUser, isMockPost, isOptimistic, isTempPost, onDeleted, showToast, updateUserProfile }; });

  const loadingLikeRef = useRef(false);

  useEffect(() => {
    if (!cardRef.current) return;
    const obs  = getVideoObserver();
    const vids = Array.from(cardRef.current.querySelectorAll("video"));
    vids.forEach(v => { obs.observe(v); _observedVideos.set(v, true); });
    vidsRef.current = vids;
    return () => { vidsRef.current.forEach(v => obs.unobserve(v)); vidsRef.current = []; };
  }, []);

  useEffect(() => { setCommentsCount(comments.length); }, [comments.length]);
  useEffect(() => { setViewsCount(getPostViewsCount(post)); }, [post._id, post.viewsCount, post.views]);
  useEffect(() => { if (post.isBoosted) setBoostedLocal(true); }, [post.isBoosted]);
  useEffect(() => { setHiddenLocal(isPostHidden(post)); }, [post._id]);

  // ── NE PAS fermer le modal quand on clique à l'intérieur
  // (géré par FeedbackModal lui-même via stopPropagation)
  useEffect(() => {
    if (!showFeedbackModal) return;
    const onKey = (e) => { if (e.key === "Escape") setShowFeedbackModal(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [showFeedbackModal]);

  const isOwner = useMemo(() => {
    if (!currentUser) return false;
    const cuid = toStr(currentUser._id);
    if (!cuid) return false;
    const candidates = [
      toStr(post.userId), toStr(post.user?._id), toStr(post.user?.id),
      toStr(post.author?._id), toStr(post.author?.id), toStr(postUser._id),
    ].filter(id => id && id !== "unknown" && id !== "null" && id !== "undefined");
    return candidates.some(id => id === cuid);
  }, [currentUser?._id, post.userId, post.user, post.author, postUser._id]);

  const canFollow = useMemo(() =>
    !!(currentUser && !isOwner && postUser._id !== "unknown"),
    [currentUser, isOwner, postUser._id]
  );

  const handleLike = useCallback((e) => {
    e?.stopPropagation();
    if (loadingLikeRef.current) return;
    const { liked, likesCount } = stateRef.current;
    const { post, currentUser, isMockPost, isOptimistic, showToast } = postRef.current;
    if (isOptimistic) { showToast?.("Publication en cours, patientez...", "info"); return; }
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
        setLiked(liked); setLikesCount(likesCount);
        showToast?.(err.response?.data?.message || "Erreur", "error");
      })
      .finally(() => { loadingLikeRef.current = false; });
  }, []);

  const handleFollow = useCallback((e) => {
    e?.stopPropagation();
    const { isFollowing, loadingFollow } = stateRef.current;
    const { postUser, currentUser, isMockPost, showToast, updateUserProfile } = postRef.current;
    if (!currentUser)                               { showToast?.("Connectez-vous", "info"); return; }
    if (loadingFollow)                              return;
    if (!postUser._id || postUser._id === "unknown"){ showToast?.("Utilisateur introuvable", "error"); return; }
    if (currentUser._id === postUser._id)           { showToast?.("Vous ne pouvez pas vous suivre", "info"); return; }
    const was = isFollowing;
    setIsFollowing(!was);
    showToast?.(!was ? `Vous suivez ${postUser.fullName}` : `Vous ne suivez plus ${postUser.fullName}`, "success");
    if (isMockPost) return;
    setLoadingFollow(true);
    axiosClient.post(`/users/${postUser._id}/follow`)
      .then(({ data }) => {
        if (!data.success) throw new Error(data.message || "Echec");
        const cf = currentUser.following || [];
        const uf = was
          ? cf.filter(id => { const s = typeof id === "object" ? (id._id || id) : id; return s?.toString() !== postUser._id.toString(); })
          : [...cf, postUser._id];
        updateUserProfile?.(currentUser._id, { following: uf });
      })
      .catch(err => {
        setIsFollowing(was);
        const status = err.response?.status;
        if (status === 401 || status === 403) showToast?.("Non autorise - reconnecte-toi", "error");
        else if (status === 404)              showToast?.("Utilisateur introuvable", "error");
        else showToast?.(err.response?.data?.message || err.message || "Erreur", "error");
      })
      .finally(() => setLoadingFollow(false));
  }, []);

  const handleProfileClick = useCallback((e) => {
    e?.stopPropagation();
    const { postUser, post } = postRef.current;
    const id = postUser._id;
    if (!id || id === "unknown" || id === "null" || id === "undefined") return;
    const rawUser = post.user || post.author || {};
    navigate(`/profile/${id}`, { state: { instantUser: {
      _id: id, fullName: postUser.fullName, profilePhoto: postUser.profilePhoto,
      isVerified: postUser.isVerified, isPremium: postUser.isPremium,
      username: rawUser.username || rawUser.email?.split("@")[0] || "",
      bio: rawUser.bio || "", location: rawUser.location || "", website: rawUser.website || "",
      isBot: rawUser.isBot || false, followers: rawUser.followers || [],
      following: rawUser.following || [], followersCount: rawUser.followersCount || 0,
      followingCount: rawUser.followingCount || 0, createdAt: rawUser.createdAt || null,
    }}});
  }, [navigate]);

  const handleOpenComments = useCallback((e) => { e?.stopPropagation(); setShowCommentsModal(true); }, []);
  const handleOpenShare    = useCallback((e) => { e?.stopPropagation(); setShowShareModal(true); }, []);
  const handleSave         = useCallback(() => {
    setSaved(v => {
      const next = !v;
      setSavedPostPreference(postRef.current.post?._id, next);
      postRef.current.showToast?.(next ? "Publication enregistrée" : "Publication retirée des favoris", "success");
      window.dispatchEvent(new CustomEvent("feed:interaction", {
        detail: { action: "save", post: postRef.current.post, position: postRef.current.post?._displayPosition ?? 0 },
      }));
      return next;
    });
  }, []);
  const handleExpand      = useCallback((e) => { e?.stopPropagation(); setExpanded(v => !v); }, []);
  const handleOpenActions = useCallback((e) => { e?.preventDefault(); e?.stopPropagation(); setShowFeedbackModal(true); }, []);

  const openingRef = useRef(false);

  const handleOpenDelete = useCallback((e) => {
    e?.preventDefault(); e?.stopPropagation();
    if (openingRef.current) return;
    openingRef.current = true;
    setTimeout(() => { openingRef.current = false; }, 300);
    const { post, onDeleted, showToast, isMockPost } = postRef.current;
    emitModalEvent("delete", post, { onDeleted, showToast, mockPost: isMockPost });
  }, []);

  const handleOpenBoost = useCallback((e) => {
    e?.preventDefault(); e?.stopPropagation();
    if (openingRef.current) return;
    openingRef.current = true;
    setTimeout(() => { openingRef.current = false; }, 300);
    emitModalEvent("boost", postRef.current.post, {
      showToast: postRef.current.showToast,
      onBoosted: () => setBoostedLocal(true),
    });
  }, []);

  const handleCommentsCountChange = useCallback((count) => {
    if (typeof count === "number") setCommentsCount(count);
  }, []);

  const setRootRef = useCallback((node) => {
    cardRef.current = node;
    if (ref) { typeof ref === "function" ? ref(node) : (ref.current = node); }
  }, [ref]);

  const content        = post.content || post.contenu || "";
  const { text: translatedContent, isTranslated, isTranslating } = useTranslatedText(content, post);
  const shouldTruncate = translatedContent.length > 280;
  const displayContent = shouldTruncate && !expanded ? translatedContent.substring(0, 280) + "..." : translatedContent;
  const isBoosted      = boostedLocal || !!post.isBoosted;

  const embedUrl      = post.embedUrl  || null;
  const videoUrl      = post.videoUrl  || null;
  const imagesLen     = Array.isArray(post.images) ? post.images.length : 0;
  const mediaLen      = Array.isArray(post.media)  ? post.media.length  : 0;
  const postMediaType = post.mediaType || null;
  const isVideoMediaType = postMediaType === "video" || postMediaType === "youtube";

  const mediaUrls = useMemo(() => {
    const seen = new Set(); const result = [];
    const addUrl = (raw) => {
      if (!raw || typeof raw !== "string") return;
      if (raw.startsWith("blob:")) { if (!seen.has(raw)) { seen.add(raw); result.push(raw); } return; }
      const url = resolveMediaUrl(raw);
      if (url && !seen.has(url) && isStructurallyValid(url)) { seen.add(url); result.push(url); }
    };
    if (embedUrl) addUrl(embedUrl);
    if (videoUrl) addUrl(videoUrl);
    const imgSrc = post.media || post.images;
    const arr = Array.isArray(imgSrc) ? imgSrc : (imgSrc ? [imgSrc] : []);
    arr.forEach(m => addUrl(typeof m === "string" ? m : m?.url));
    return result;
  }, [embedUrl, videoUrl, post.media, post.images, post._id, postMediaType]);

  const hasVideoMedia = useMemo(() => {
    if (isVideoMediaType) return true;
    if (embedUrl) return true;
    if (videoUrl && isVideoUrl(videoUrl)) return true;
    const arr = Array.isArray(post.media) ? post.media : [];
    return arr.some(m => { const url = typeof m === "string" ? m : m?.url; return url && isVideoUrl(url); });
  }, [isVideoMediaType, embedUrl, videoUrl, post.media]);

  useEffect(() => {
    const el = cardRef.current;
    const postId = post?._id;
    if (!el || !postId || isMockPost || isOptimistic || isTempPost || !currentUser) return;
    if (String(postId).startsWith("temp_") || String(postId).startsWith("post_")) return;
    let timer = null, enteredAt = 0, cancelled = false;
    const sendView = async (visibleMs = 0) => {
      if (cancelled) return;
      const viewed = getSessionViewedPosts();
      if (viewed.has(String(postId))) return;
      if (VIEWING_POSTS_SESSION.has(String(postId))) return;
      VIEWING_POSTS_SESSION.add(String(postId));
      try {
        const { data } = await axiosClient.post(`/posts/${postId}/view`, {
          source: "post_card", watchPct: hasVideoMedia ? 55 : 100,
          watchTime: Math.max(1, Math.round(visibleMs / 1000)),
        }, { skipNetworkRetry: true, timeout: 8000 });
        markSessionViewedPost(postId);
        if (typeof data?.viewsCount === "number") setViewsCount(data.viewsCount);
        window.dispatchEvent(new CustomEvent("feed:interaction", {
          detail: { action: "view", post, position: post._displayPosition ?? 0, counted: !!data?.counted },
        }));
      } catch {
      } finally {
        VIEWING_POSTS_SESSION.delete(String(postId));
      }
    };
    const obs = new IntersectionObserver(([entry]) => {
      const visible = entry.isIntersecting && entry.intersectionRatio >= 0.55;
      if (visible) {
        enteredAt = Date.now(); clearTimeout(timer);
        timer = setTimeout(() => sendView(Date.now() - enteredAt), hasVideoMedia ? 1800 : 1000);
      } else {
        clearTimeout(timer); timer = null; enteredAt = 0;
      }
    }, { threshold: [0, 0.25, 0.55, 0.75] });
    obs.observe(el);
    return () => { cancelled = true; clearTimeout(timer); obs.disconnect(); };
  }, [post?._id, currentUser?._id, isMockPost, isOptimistic, isTempPost, hasVideoMedia]);

  const TEXT_CARD_THRESHOLD = 120;
  const hasRawMedia    = !!(embedUrl || videoUrl || imagesLen > 0 || mediaLen > 0 || post.thumbnail);
  const trimmedContent = content.trim();
  const isAutoTextCard = !postMediaType && !isVideoMediaType && !hasRawMedia && !hasVideoMedia
    && trimmedContent.length > 0 && trimmedContent.length <= TEXT_CARD_THRESHOLD;

  const effectiveMediaType = (() => {
    if (postMediaType && postMediaType !== "text") return postMediaType;
    if (isAutoTextCard) return "text-card";
    if (hasVideoMedia && !embedUrl) return "video";
    if (embedUrl) return "youtube";
    return null;
  })();

  const postForMedia = useMemo(() => (
    effectiveMediaType !== postMediaType ? { ...post, mediaType: effectiveMediaType } : post
  ), [post, effectiveMediaType, postMediaType]);

  const hasMedia = effectiveMediaType === "text-card" || mediaUrls.length > 0
    || effectiveMediaType === "youtube"
    || (effectiveMediaType === "video" && mediaLen > 0)
    || !!(post.thumbnail && (videoUrl || embedUrl));

  const formattedDate = useRelativeTime(post.createdAt || null);

  if (hiddenLocal && !ignoreHidden) return null;
  if (!isMockPost && !isOptimistic && (postUser.isInvalid || postUser.isBannedOrDeleted)) return null;

  return (
    <>
      <div
        ref={setRootRef}
        className={`relative w-full max-w-[630px] mx-auto ${isDarkMode ? "bg-black" : "bg-white"}`}
        style={{ margin: 0, padding: 0, isolation: "isolate" }}
      >
        {isBoosted && (
          <div className="absolute top-0 right-0 z-10 p-2 pointer-events-none">
            <div className="flex items-center gap-1 bg-gradient-to-r from-orange-500 to-pink-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-bl-xl shadow-lg select-none">
              <RocketLaunchIcon className="w-3 h-3" /> SPONSORISE
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
                <span onClick={handleProfileClick}
                  className={`font-semibold text-sm cursor-pointer hover:opacity-70 truncate max-w-[150px] ${isDarkMode ? "text-white" : "text-gray-900"}`}>
                  {postUser.fullName}
                </span>
                {postUser.isVerified && <CheckBadgeIcon className="w-4 h-4 text-orange-500" />}
              </div>
              <span className="text-xs text-gray-500">{formattedDate}</span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, position: "relative", zIndex: 50, isolation: "isolate" }}>
            {isOwner && !isBoosted && !isMockPost && !isTempPost && (
              <button type="button" onClick={handleOpenBoost}
                style={{
                  background: "linear-gradient(to right, #9333ea, #ec4899)", color: "white",
                  padding: "4px 12px", borderRadius: 9999, fontSize: 12, fontWeight: 700,
                  border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
                  WebkitTapHighlightColor: "transparent", touchAction: "manipulation",
                  position: "relative", zIndex: 51, pointerEvents: "auto",
                }}>
                <RocketLaunchIcon style={{ width: 12, height: 12 }} /> Booster
              </button>
            )}
            {canFollow && !isTempPost && (
              <button onClick={handleFollow} disabled={loadingFollow}
                style={{
                  padding: "4px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "none",
                  cursor: loadingFollow ? "not-allowed" : "pointer",
                  background: isFollowing ? (isDarkMode ? "#1f2937" : "#f3f4f6") : (isDarkMode ? "#ffffff" : "#111827"),
                  color: isFollowing ? (isDarkMode ? "#d1d5db" : "#4b5563") : (isDarkMode ? "#000000" : "#ffffff"),
                  WebkitTapHighlightColor: "transparent", touchAction: "manipulation",
                  position: "relative", zIndex: 51, pointerEvents: "auto",
                }}>
                {loadingFollow ? "..." : isFollowing ? "Suivi(e)" : "Suivre"}
              </button>
            )}
            <button type="button" onClick={handleOpenActions} aria-label="Ouvrir les actions de la publication"
              className="rounded-full border border-gray-200 bg-white/90 p-2 text-gray-700 hover:bg-gray-100 transition-colors"
              style={{ minWidth: 38, minHeight: 38 }}>
              <EllipsisHorizontalIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* TEXTE */}
        {content && effectiveMediaType !== "text-card" && (
          <div className="px-3 pb-2">
            <p className={`text-sm ${isDarkMode ? "text-gray-200" : "text-gray-800"}`}>{displayContent}</p>
            {(isTranslated || isTranslating) && (
              <p className={`mt-1 text-[11px] ${isDarkMode ? "text-gray-500" : "text-gray-400"}`}>
                {isTranslating ? "Traduction..." : "Traduit automatiquement"}
              </p>
            )}
            {shouldTruncate && (
              <button onClick={handleExpand} className="text-gray-500 text-sm hover:text-gray-400 mt-1">
                {expanded ? "voir moins" : "voir plus"}
              </button>
            )}
          </div>
        )}

        {/* MEDIA */}
        {hasMedia && (
          <div className="w-full" style={{ position: "relative", zIndex: 1 }}>
            <PostMedia mediaUrls={mediaUrls} isFirstPost={priority} post={postForMedia} />
          </div>
        )}

        <ActionsBar
          liked={liked} likesCount={likesCount} saved={saved}
          commentsCount={commentsCount} viewsCount={viewsCount}
          isDarkMode={isDarkMode} onLike={handleLike}
          onOpenComments={handleOpenComments} onOpenShare={handleOpenShare} onSave={handleSave}
        />

        {/* ✅ FIX v28 — PAS de createPortal externe ici.
            FeedbackModal gère son propre createPortal en interne.
            Le double portal cassait la propagation des events React. */}
        {showFeedbackModal && (
          <ErrorBoundary>
            <FeedbackModal
              postId={post._id}
              isDarkMode={isDarkMode}
              showToast={showToast}
              onClose={() => setShowFeedbackModal(false)}
              onOpenShare={handleOpenShare}
              onOpenDelete={handleOpenDelete}
              onOpenBoost={handleOpenBoost}
              onToggleSave={handleSave}
              onHideLocal={() => setHiddenLocal(true)}
              isOwner={isOwner}
              isBoosted={isBoosted}
              isTempPost={isTempPost}
              saved={saved}
              post={post}
            />
          </ErrorBoundary>
        )}
      </div>

      {showCommentsModal && (
        <ErrorBoundary>
          <Suspense fallback={null}>
            <PostCommentsModal
              isOpen={showCommentsModal} onClose={() => setShowCommentsModal(false)}
              postId={post._id} postUser={postUser} postContent={translatedContent || content}
              postMediaUrl={mediaUrls[0] || null} likesCount={likesCount}
              comments={comments} setComments={setComments}
              currentUser={currentUser} getToken={getToken} showToast={showToast}
              navigate={navigate} isMockPost={isMockPost}
              onCommentsCountChange={handleCommentsCountChange}
            />
          </Suspense>
        </ErrorBoundary>
      )}

      {showShareModal && (
        <ErrorBoundary>
          <Suspense fallback={null}>
            <PostShareModal
              isOpen={showShareModal} onClose={() => setShowShareModal(false)}
              postId={post._id} postUser={postUser} postContent={translatedContent || content}
              postMediaUrl={mediaUrls[0] || null} likesCount={likesCount}
              commentsCount={commentsCount} navigate={navigate} showToast={showToast}
            />
          </Suspense>
        </ErrorBoundary>
      )}
    </>
  );
});
PostCardInner.displayName = "PostCardInner";

// ─────────────────────────────────────────────────────────────────────────────
// PostCard — wrapper
// ─────────────────────────────────────────────────────────────────────────────
const PostCard = forwardRef(({ post, onDeleted, showToast, loading = false, mockPost = false, priority = false, ignoreHidden = false }, ref) => {
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
      ref={ref} post={post} onDeleted={onDeleted} showToast={showToast}
      mockPost={mockPost} priority={priority} ignoreHidden={ignoreHidden}
    />
  );
});
PostCard.displayName = "PostCard";

const getPostMediaSignature = (post) => {
  const media  = Array.isArray(post?.media)  ? post.media  : (post?.media  ? [post.media]  : []);
  const images = Array.isArray(post?.images) ? post.images : (post?.images ? [post.images] : []);
  const toUrl  = (m) => typeof m === "string" ? m : (m?.url || "");
  return [
    post?.mediaType || "", post?.videoUrl || "", post?.embedUrl || "", post?.thumbnail || "",
    ...media.map(toUrl), ...images.map(toUrl),
  ].join("|");
};

export default memo(PostCard, (prev, next) =>
  prev.post?._id              === next.post?._id              &&
  prev.post?.likes?.length    === next.post?.likes?.length    &&
  prev.post?.comments?.length === next.post?.comments?.length &&
  prev.post?.content          === next.post?.content          &&
  prev.post?.contenu          === next.post?.contenu          &&
  prev.post?.isBoosted        === next.post?.isBoosted        &&
  prev.post?.isOptimistic     === next.post?.isOptimistic     &&
  prev.post?.textCardPalette  === next.post?.textCardPalette  &&
  getPostMediaSignature(prev.post) === getPostMediaSignature(next.post) &&
  prev.priority               === next.priority               &&
  prev.loading                === next.loading
);
