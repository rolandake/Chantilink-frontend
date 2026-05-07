// 📁 src/pages/Home/PostCard.jsx
// ✅ v25 — INSTANT PROFILE NAVIGATION
//
// CHANGEMENT v25 :
//   handleProfileClick transmet l'utilisateur embarqué dans le post via
//   navigate(..., { state: { instantUser } }) → ProfilePage s'affiche
//   immédiatement sans spinner ni requête bloquante.
//
// Pour activer le debug :
//   localStorage.setItem("POSTCARD_DEBUG", "1") dans la console DevTools
//   OU ajouter ?postcard_debug=1 dans l'URL
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
// DEBUG SYSTEM v25
// ─────────────────────────────────────────────────────────────────────────────
const _isDebug = () => {
  if (typeof window === "undefined") return false;
  if (window.localStorage?.getItem("POSTCARD_DEBUG") === "1") return true;
  try {
    if (new URLSearchParams(window.location.search).get("postcard_debug") === "1") return true;
  } catch {}
  return false;
};

if (typeof window !== "undefined") {
  try {
    if (new URLSearchParams(window.location.search).get("postcard_debug") === "1") {
      window.localStorage?.setItem("POSTCARD_DEBUG", "1");
      console.info("%c[PostCard DEBUG] Auto-activé via ?postcard_debug=1", "color:#f97316;font-weight:bold");
    }
  } catch {}
}

const dbgPC = (...args) => {
  if (_isDebug()) console.log("%c[PostCard]", "color:#f97316;font-weight:bold", ...args);
};

const dbgWarn = (...args) => {
  if (_isDebug()) console.warn("%c[PostCard ⚠]", "color:#ef4444;font-weight:bold", ...args);
};

const dbgInspectEl = (label, el) => {
  if (!_isDebug() || !el) return;
  const style  = window.getComputedStyle(el);
  const rect   = el.getBoundingClientRect();
  const inBody = document.body.contains(el);

  console.groupCollapsed(`%c[PostCard DOM] ${label}`, "color:#a855f7;font-weight:bold");
  console.log("element:", el);
  console.log("in document.body:", inBody);
  console.log("inline cssText:", el.style.cssText);
  console.log("computed display:", style.display);
  console.log("computed visibility:", style.visibility);
  console.log("computed opacity:", style.opacity);
  console.log("computed z-index:", style.zIndex);
  console.log("computed position:", style.position);
  console.log("computed inset:", style.inset);
  console.log("computed overflow:", style.overflow, "/", style.overflowX, "/", style.overflowY);
  console.log("computed pointer-events:", style.pointerEvents);
  console.log("computed isolation:", style.isolation);
  console.log("computed clip / clip-path:", style.clip, "/", style.clipPath);
  console.log("computed will-change:", style.willChange);
  console.log("computed transform:", style.transform);
  console.log("BoundingRect:", `top=${rect.top} left=${rect.left} w=${rect.width} h=${rect.height}`);
  console.log("children.length:", el.children.length);
  console.log("innerHTML preview:", el.innerHTML.substring(0, 300));

  console.group("→ Analyse des parents (recherche clip/overflow/isolation/transform)");
  let parent = el.parentElement;
  let depth  = 0;
  let problemsFound = 0;
  while (parent && parent !== document.documentElement && depth < 20) {
    const ps = window.getComputedStyle(parent);
    const pr = parent.getBoundingClientRect();
    const clipOverflow = ps.overflow !== "visible" || ps.overflowX !== "visible" || ps.overflowY !== "visible";
    const hasIsolate   = ps.isolation === "isolate";
    const hasTransform = ps.transform !== "none" || ps.willChange.includes("transform");
    const lowZ         = parseInt(ps.zIndex) < 0;

    if (clipOverflow || hasIsolate || hasTransform || lowZ) {
      problemsFound++;
      const id  = parent.id ? `#${parent.id}` : "";
      const cls = parent.className ? `.${String(parent.className).trim().split(/\s+/).slice(0,3).join(".")}` : "";
      console.warn(
        `[depth=${depth}] ${parent.tagName}${id}${cls}`,
        "\n  overflow:", ps.overflow, ps.overflowX, ps.overflowY,
        "\n  isolation:", ps.isolation,
        "\n  transform:", ps.transform,
        "\n  will-change:", ps.willChange,
        "\n  z-index:", ps.zIndex,
        "\n  position:", ps.position,
        "\n  rect:", `top=${pr.top} left=${pr.left} w=${pr.width} h=${pr.height}`,
      );
    }
    parent = parent.parentElement;
    depth++;
  }
  if (problemsFound === 0) console.log("(aucun parent problématique détecté)");
  console.groupEnd();
  console.groupEnd();
};

// ─────────────────────────────────────────────────────────────────────────────
// getModalRoot
// ─────────────────────────────────────────────────────────────────────────────
const getModalRoot = () => {
  let el = document.getElementById("modal-root");
  if (el && !document.body.contains(el)) {
    dbgWarn("getModalRoot: modal-root détaché du DOM → recréation");
    el.remove();
    el = null;
  }
  if (!el) {
    el = document.createElement("div");
    el.id = "modal-root";
    document.body.appendChild(el);
    dbgPC("getModalRoot: modal-root CRÉÉ et ajouté à document.body");
  }

  el.style.cssText = [
    "position:fixed",
    "inset:0",
    "z-index:999999",
    "pointer-events:none",
    "overflow:visible",
  ].join(";");

  dbgPC("getModalRoot → el:", el, "| cssText:", el.style.cssText);
  dbgInspectEl("modal-root après getModalRoot()", el);
  return el;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
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

// ── Bus d'événements ─────────────────────────────────────────────────────────
const MODAL_EVENT = "postcard:openModal";

const emitModalEvent = (action, post, extra = {}) => {
  dbgPC(`[1] emitModalEvent → action="${action}" postId="${post?._id}"`);

  const ev = new CustomEvent(MODAL_EVENT, {
    detail: { action, post, ...extra },
    bubbles: false,
  });
  window.dispatchEvent(ev);
  dbgPC(`[2] CustomEvent dispatché sur window`, ev);

  if (_isDebug()) {
    setTimeout(() => {
      const mr = document.getElementById("modal-root");
      if (!mr) {
        console.error("%c[PostCard DEBUG] [7] ❌ modal-root INTROUVABLE 100ms après dispatch !", "color:red;font-weight:bold");
        return;
      }
      if (mr.children.length === 0) {
        console.error(
          "%c[PostCard DEBUG] [7] ❌ modal-root VIDE 100ms après dispatch — GlobalModalManager n'a pas rendu !",
          "color:red;font-weight:bold",
        );
        dbgInspectEl("modal-root vide", mr);
      } else {
        console.info(
          "%c[PostCard DEBUG] [7] ✅ modal-root contient " + mr.children.length + " enfant(s)",
          "color:green;font-weight:bold",
        );
        dbgInspectEl("modal-root > premier enfant (100ms)", mr.children[0]);
      }
    }, 100);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE MODAL
// ─────────────────────────────────────────────────────────────────────────────
const DeleteModal = memo(({ isDarkMode, isDeleting, onConfirm, onCancel }) => {
  const isClosingRef = useRef(false);
  const overlayRef   = useRef(null);

  useEffect(() => {
    dbgPC("[8] DeleteModal MONTÉ ✅");
    if (overlayRef.current) dbgInspectEl("[8] DeleteModal overlay (monté)", overlayRef.current);
    return () => dbgPC("[8] DeleteModal DÉMONTÉ");
  }, []);

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
      ref={overlayRef}
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
            Cette action est irréversible.
          </p>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button type="button" onClick={safeCancel} disabled={isDeleting}
            style={{
              flex: 1, padding: "12px 0", borderRadius: 12, fontWeight: 700,
              fontSize: 15, border: "none", cursor: isDeleting ? "not-allowed" : "pointer",
              opacity: isDeleting ? 0.5 : 1,
              background: isDarkMode ? "#1f2937" : "#f3f4f6",
              color: isDarkMode ? "#ffffff" : "#111827", pointerEvents: "auto",
            }}>
            Annuler
          </button>
          <button type="button" onClick={safeConfirm} disabled={isDeleting}
            style={{
              flex: 1, padding: "12px 0", borderRadius: 12, fontWeight: 700,
              fontSize: 15, border: "none", cursor: isDeleting ? "not-allowed" : "pointer",
              opacity: isDeleting ? 0.5 : 1,
              background: "#ef4444", color: "#ffffff", pointerEvents: "auto",
            }}>
            {isDeleting ? "Suppression…" : "Supprimer"}
          </button>
        </div>
      </motion.div>
    </div>
  );
});
DeleteModal.displayName = "DeleteModal";

// ─────────────────────────────────────────────────────────────────────────────
// BOOST MODAL
// ─────────────────────────────────────────────────────────────────────────────
const BoostModal = memo(({ isDarkMode, postId, onClose }) => {
  const isClosingRef = useRef(false);
  const overlayRef   = useRef(null);

  useEffect(() => {
    dbgPC("[8] BoostModal MONTÉ ✅");
    if (overlayRef.current) dbgInspectEl("[8] BoostModal overlay (monté)", overlayRef.current);
    return () => dbgPC("[8] BoostModal DÉMONTÉ");
  }, []);

  const safeClose = (e) => {
    e?.stopPropagation();
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    onClose();
  };

  return (
    <div
      ref={overlayRef}
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
            Augmentez la visibilité de votre publication auprès d'un plus grand public.
          </p>
        </div>
        <button type="button" onClick={safeClose}
          style={{
            width: "100%", padding: "12px 0", borderRadius: 12, fontWeight: 700,
            fontSize: 15, border: "none", cursor: "pointer",
            background: "linear-gradient(135deg, #9333ea, #ec4899)", color: "#ffffff",
            pointerEvents: "auto",
          }}>
          Fermer
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
  const renderCountRef = useRef(0);
  renderCountRef.current++;

  dbgPC(`[4] GlobalModalManager render #${renderCountRef.current} | modalState=`, modalState?.action ?? "null");

  useEffect(() => {
    dbgPC("[3] GlobalModalManager MONTÉ — addEventListener MODAL_EVENT sur window");

    if (_isDebug()) {
      setTimeout(() => {
        dbgPC("[3] GlobalModalManager check post-mount → modal-root existant:", document.getElementById("modal-root"));
      }, 0);
    }

    const handler = (e) => {
      const { action, post, onDeleted, showToast, mockPost } = e.detail || {};
      dbgPC(`[3] GlobalModalManager ← EVENT REÇU action="${action}" postId="${post?._id}"`);

      if (!action || !post) {
        dbgWarn("[3] ❌ EVENT reçu avec detail incomplet !", e.detail);
        return;
      }

      dbgPC("[4] → setIsDeleting(false) + setModalState(...)");
      setIsDeleting(false);
      setModalState({ action, post, onDeleted, showToast, mockPost });

      if (_isDebug()) {
        setTimeout(() => {
          const mr = document.getElementById("modal-root");
          dbgPC("[6] Vérification 50ms après setModalState → modal-root:", mr);
          if (mr) {
            dbgInspectEl("[6] modal-root 50ms après setModalState", mr);
            if (mr.children.length === 0) {
              console.error("%c[PostCard DEBUG] [6] ❌ modal-root VIDE 50ms après setModalState !", "color:red;font-weight:bold");
            } else {
              console.info(`%c[PostCard DEBUG] [6] ✅ modal-root a ${mr.children.length} enfant(s)`, "color:green;font-weight:bold");
            }
          } else {
            console.error("%c[PostCard DEBUG] [6] ❌ modal-root ABSENT 50ms après setModalState !", "color:red");
          }
        }, 50);
      }
    };

    window.addEventListener(MODAL_EVENT, handler);
    dbgPC("[3] addEventListener OK pour", MODAL_EVENT);

    return () => {
      window.removeEventListener(MODAL_EVENT, handler);
      dbgPC("[3] GlobalModalManager DÉMONTÉ — removeEventListener");
    };
  }, []);

  const close = useCallback(() => {
    dbgPC("[4] GlobalModalManager → close() → setModalState(null)");
    setModalState(null);
  }, []);

  const handleDeletePost = useCallback(async () => {
    if (!modalState) return;
    const { post, onDeleted, showToast, mockPost } = modalState;
    const isMock = mockPost || post._id?.startsWith("post_") || post.isMockPost;
    const isTemp = !!post.isOptimistic || post._id?.startsWith("temp_");

    if (isTemp) { showToast?.("Publication en cours, patientez…", "info"); close(); return; }
    if (isMock) { showToast?.("Post supprimé", "success"); close(); onDeleted?.(post._id); return; }

    setIsDeleting(true);
    try {
      await axiosClient.delete(`/posts/${post._id}`);
      showToast?.("Post supprimé", "success");
      close();
      onDeleted?.(post._id);
    } catch (err) {
      const s = err.response?.status;
      if (s === 404) { close(); onDeleted?.(post._id); }
      else showToast?.(s === 403 ? "Permission refusée" : err.response?.data?.message || "Erreur", "error");
    } finally {
      setIsDeleting(false);
    }
  }, [modalState, close]);

  if (!modalState) {
    dbgPC("[4] GlobalModalManager → return null (modalState=null)");
    return null;
  }

  dbgPC(`[5] GlobalModalManager → RENDU PORTAIL action="${modalState.action}"`);

  const container = getModalRoot();
  dbgPC("[5] container du portail:", container);

  return createPortal(
    <AnimatePresence>
      {modalState.action === "delete" && (
        <DeleteModal
          key="delete"
          isDarkMode={isDarkMode}
          isDeleting={isDeleting}
          onConfirm={handleDeletePost}
          onCancel={close}
        />
      )}
      {modalState.action === "boost" && (
        <BoostModal
          key="boost"
          isDarkMode={isDarkMode}
          postId={modalState.post?._id}
          onClose={close}
        />
      )}
    </AnimatePresence>,
    container
  );
};

export const GlobalModalManager = memo(GlobalModalManagerBase);
GlobalModalManager.displayName = "GlobalModalManager";

// ─────────────────────────────────────────────────────────────────────────────
// ACTIONS BAR
// ─────────────────────────────────────────────────────────────────────────────
const ActionsBar = memo(({ liked, likesCount, saved, commentsCount, isDarkMode, onLike, onOpenComments, onOpenShare, onSave }) => (
  <div className="flex items-center justify-between px-3 py-2">
    <div className="flex items-center gap-4">
      <button onClick={onLike} className="flex items-center gap-1.5 group">
        {liked
          ? <HeartSolid className="w-6 h-6 text-red-500" />
          : <HeartIcon className={`w-6 h-6 ${isDarkMode ? "text-gray-300" : "text-gray-700"} group-active:scale-90 transition-transform`} />
        }
        {likesCount > 0 && (
          <span className={`text-sm font-medium ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>{likesCount}</span>
        )}
      </button>

      <button onClick={onOpenComments} className="flex items-center gap-1.5 group">
        <ChatBubbleLeftIcon className={`w-6 h-6 ${isDarkMode ? "text-gray-300" : "text-gray-700"}`} />
        {commentsCount > 0 && (
          <span className={`text-sm font-medium ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>{commentsCount}</span>
        )}
      </button>

      <button onClick={onOpenShare}>
        <ShareIcon className={`w-6 h-6 ${isDarkMode ? "text-gray-300" : "text-gray-700"}`} />
      </button>
    </div>

    <button onClick={onSave}>
      {saved
        ? <BookmarkSolid className="w-6 h-6 text-orange-500" />
        : <BookmarkIcon className={`w-6 h-6 ${isDarkMode ? "text-gray-300" : "text-gray-700"}`} />
      }
    </button>
  </div>
));
ActionsBar.displayName = "ActionsBar";

// ─────────────────────────────────────────────────────────────────────────────
// POST CARD INNER
// ─────────────────────────────────────────────────────────────────────────────
const PostCardInner = forwardRef(({
  post, onDeleted, showToast, mockPost = false, priority = false,
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
      // ✅ v25 — on conserve l'objet user complet pour la navigation instantanée
      _raw:              u,
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

  useLayoutEffect(() => { stateRef.current = { liked, likesCount, isFollowing, loadingFollow }; });
  useLayoutEffect(() => { postRef.current = { post, postUser, currentUser, isMockPost, isOptimistic, isTempPost, onDeleted, showToast, updateUserProfile }; });

  const loadingLikeRef = useRef(false);

  useEffect(() => {
    if (!cardRef.current) return;
    const obs  = getVideoObserver();
    const vids = Array.from(cardRef.current.querySelectorAll("video"));
    vids.forEach(v => { obs.observe(v); _observedVideos.set(v, true); });
    vidsRef.current = vids;
    return () => { vidsRef.current.forEach(v => { obs.unobserve(v); }); vidsRef.current = []; };
  }, []);

  useEffect(() => { setCommentsCount(comments.length); }, [comments.length]);

  const isOwner = useMemo(() => {
    if (!currentUser) return false;
    const cuid = toStr(currentUser._id);
    if (!cuid) return false;
    const candidates = [
      toStr(post.userId), toStr(post.user?._id), toStr(post.user?.id),
      toStr(post.author?._id), toStr(post.author?.id), toStr(postUser._id),
    ].filter(id => id && id !== "unknown" && id !== "null" && id !== "undefined");
    const result = candidates.some(id => id === cuid);
    dbgPC(`isOwner=${result} cuid=${cuid}`);
    return result;
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
        setLiked(liked); setLikesCount(likesCount);
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

  // ✅ v25 — INSTANT PROFILE NAVIGATION
  // On passe l'utilisateur embarqué dans le post comme état de navigation.
  // ProfilePage le lit via useLocation().state.instantUser et s'affiche
  // IMMÉDIATEMENT sans attendre l'API, puis revalide en arrière-plan.
  const handleProfileClick = useCallback((e) => {
    e?.stopPropagation();
    const { postUser, post } = postRef.current;
    const id = postUser._id;
    if (!id || id === "unknown" || id === "null" || id === "undefined") return;

    // Construit un objet utilisateur minimal depuis les données déjà en mémoire
    const rawUser = post.user || post.author || {};
    const instantUser = {
      _id:            id,
      fullName:       postUser.fullName,
      profilePhoto:   postUser.profilePhoto,
      isVerified:     postUser.isVerified,
      isPremium:      postUser.isPremium,
      username:       rawUser.username       || rawUser.email?.split("@")[0] || "",
      bio:            rawUser.bio            || "",
      location:       rawUser.location       || "",
      website:        rawUser.website        || "",
      isBot:          rawUser.isBot          || false,
      followers:      rawUser.followers      || [],
      following:      rawUser.following      || [],
      followersCount: rawUser.followersCount || 0,
      followingCount: rawUser.followingCount || 0,
      createdAt:      rawUser.createdAt      || null,
    };

    dbgPC(`[v25] handleProfileClick → navigate /profile/${id} avec instantUser`, instantUser);
    navigate(`/profile/${id}`, { state: { instantUser } });
  }, [navigate]);

  const handleOpenComments = useCallback((e) => { e?.stopPropagation(); setShowCommentsModal(true); }, []);
  const handleOpenShare    = useCallback((e) => { e?.stopPropagation(); setShowShareModal(true);    }, []);
  const handleSave         = useCallback(() => setSaved(v => !v), []);
  const handleExpand       = useCallback((e) => { e?.stopPropagation(); setExpanded(v => !v); }, []);

  const openingRef = useRef(false);

  const handleOpenDelete = useCallback((e) => {
    e?.preventDefault();
    e?.stopPropagation();
    dbgPC("[1] handleOpenDelete → clic reçu | openingRef:", openingRef.current);
    if (openingRef.current) {
      dbgWarn("[1] handleOpenDelete → IGNORÉ (guard actif)");
      return;
    }
    openingRef.current = true;
    setTimeout(() => { openingRef.current = false; }, 300);
    const { post, onDeleted, showToast, isMockPost } = postRef.current;
    dbgPC("[1] handleOpenDelete → emitModalEvent pour post._id:", post?._id);
    emitModalEvent("delete", post, { onDeleted, showToast, mockPost: isMockPost });
  }, []);

  const handleOpenBoost = useCallback((e) => {
    e?.preventDefault();
    e?.stopPropagation();
    dbgPC("[1] handleOpenBoost → clic reçu | openingRef:", openingRef.current);
    if (openingRef.current) {
      dbgWarn("[1] handleOpenBoost → IGNORÉ (guard actif)");
      return;
    }
    openingRef.current = true;
    setTimeout(() => { openingRef.current = false; }, 300);
    const { post } = postRef.current;
    dbgPC("[1] handleOpenBoost → emitModalEvent pour post._id:", post?._id);
    emitModalEvent("boost", post);
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
    const seen = new Set(); const result = [];
    const addUrl = (raw) => {
      if (!raw || typeof raw !== "string") return;
      if (raw.startsWith("blob:")) { if (!seen.has(raw)) { seen.add(raw); result.push(raw); } return; }
      if (raw.includes("videos.pexels.com")) return;
      if (raw.includes("cdn.pixabay.com/video")) return;
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

  const hasMedia = effectiveMediaType === "text-card" || mediaUrls.length > 0
    || effectiveMediaType === "youtube"
    || (effectiveMediaType === "video" && mediaLen > 0)
    || !!(post.thumbnail && (videoUrl || embedUrl));

  const formattedDate = useRelativeTime(post.createdAt || null);

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
              <RocketLaunchIcon className="w-3 h-3" /> SPONSORISÉ
            </div>
          </div>
        )}

        {/* HEADER */}
        <div className="flex justify-between items-center p-3">
          <div className="flex items-center gap-3">
            {/* ✅ v25 — Avatar cliquable avec navigation instantanée */}
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

            {isOwner && !isTempPost && (
              <button type="button" onClick={handleOpenDelete} aria-label="Supprimer ce post"
                style={{
                  padding: 8, borderRadius: "50%", border: "none", background: "transparent",
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  position: "relative", zIndex: 51,
                  WebkitTapHighlightColor: "transparent", touchAction: "manipulation",
                  pointerEvents: "auto", minWidth: 44, minHeight: 44,
                }}>
                <TrashIcon style={{ width: 20, height: 20, color: "#9ca3af" }} />
              </button>
            )}
          </div>
        </div>

        {/* TEXTE */}
        {content && effectiveMediaType !== "text-card" && (
          <div className="px-3 pb-2">
            <p className={`text-sm ${isDarkMode ? "text-gray-200" : "text-gray-800"}`}>{displayContent}</p>
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
            <PostMedia
              mediaUrls={mediaUrls}
              isFirstPost={priority}
              post={effectiveMediaType !== postMediaType ? { ...post, mediaType: effectiveMediaType } : post}
            />
          </div>
        )}

        <ActionsBar
          liked={liked} likesCount={likesCount} saved={saved} commentsCount={commentsCount}
          isDarkMode={isDarkMode} onLike={handleLike}
          onOpenComments={handleOpenComments} onOpenShare={handleOpenShare} onSave={handleSave}
        />
      </div>

      {showCommentsModal && (
        <ErrorBoundary>
          <Suspense fallback={null}>
            <PostCommentsModal
              isOpen={showCommentsModal} onClose={() => setShowCommentsModal(false)}
              postId={post._id} postUser={postUser} postContent={content}
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
              postId={post._id} postUser={postUser} postContent={content}
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
// POSTCARD — wrapper léger
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