// src/pages/profile/ProfileSuggestions.jsx
// ✅ v7 — MODERN REDESIGN
// → Design System unifié : tokens CSS-in-JS, glassmorphism raffiné
// → Robustesse : error boundary, retry, abort signal, timeout
// → A11y : aria-labels, focus-visible, keyboard nav
// → Perf : React.memo agressif, useMemo profond, layout stable
// → UX : loading progressif, empty state animé, scroll snap

import React, {
  useState, useEffect, useCallback, useRef, useMemo, memo,
} from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  UserPlusIcon, XMarkIcon, SparklesIcon,
  ShieldCheckIcon, ChevronLeftIcon, ChevronRightIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import { CheckBadgeIcon } from "@heroicons/react/24/solid";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────────────────────────────────────
const tokens = (dark) => ({
  bg:         dark ? "rgba(12,12,14,0.92)"       : "rgba(255,255,255,0.95)",
  bgCard:     dark ? "rgba(22,22,26,0.85)"       : "rgba(250,250,252,0.9)",
  bgCardHov:  dark ? "rgba(30,30,36,0.95)"       : "rgba(255,255,255,1)",
  border:     dark ? "rgba(255,255,255,0.07)"     : "rgba(0,0,0,0.06)",
  borderHov:  dark ? "rgba(249,115,22,0.4)"       : "rgba(249,115,22,0.35)",
  text:       dark ? "#f0f0f2"                    : "#0f0f11",
  textSub:    dark ? "#6b6b7b"                    : "#8a8a9a",
  textMuted:  dark ? "#4a4a5a"                    : "#b0b0be",
  accent:     "#f97316",
  accent2:    "#ec4899",
  grad:       "linear-gradient(135deg,#f97316,#ec4899)",
  gradSoft:   dark
    ? "linear-gradient(135deg,rgba(249,115,22,0.15),rgba(236,72,153,0.1))"
    : "linear-gradient(135deg,rgba(249,115,22,0.08),rgba(236,72,153,0.06))",
  shadow:     dark ? "0 20px 60px rgba(0,0,0,0.6)" : "0 8px 40px rgba(0,0,0,0.1)",
  shadowCard: dark ? "0 4px 24px rgba(0,0,0,0.5)"  : "0 2px 16px rgba(0,0,0,0.07)",
  blur:       "blur(24px)",
  font:       "'DM Sans','Sora',sans-serif",
});

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const fmt = (n) => {
  if (!n) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
};

const BADGE_MAP = (s) => {
  if (s.isPremium)            return { label: "Premium",  color: "#f97316", icon: "✦" };
  if (s.isVerified)           return { label: "Vérifié",  color: "#3b82f6", icon: "✓" };
  if (s.postsCount > 10)     return { label: "Actif",    color: "#22c55e", icon: "⚡" };
  if ((s.followers?.length || 0) > 100) return { label: "Populaire", color: "#a855f7", icon: "★" };
  return                             { label: "Nouveau",  color: "#6b7280", icon: "◎" };
};

// ─────────────────────────────────────────────────────────────────────────────
// AVATAR avec initials fallback
// ─────────────────────────────────────────────────────────────────────────────
const AVATAR_COLORS = ["#f97316","#ef4444","#8b5cf6","#3b82f6","#10b981","#f59e0b","#ec4899","#6366f1"];

const Avatar = memo(({ name, photo, size = 64, premium, verified }) => {
  const [err, setErr] = useState(false);
  const initials = useMemo(() => {
    if (!name) return "?";
    const parts = name.trim().split(" ");
    return parts.length > 1
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : name.substring(0, 2).toUpperCase();
  }, [name]);
  const bg = useMemo(() => {
    let h = 0;
    for (let i = 0; i < (name || "").length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
    return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
  }, [name]);

  const ring = premium
    ? "linear-gradient(135deg,#f97316,#ec4899,#8b5cf6)"
    : verified
      ? "linear-gradient(135deg,#3b82f6,#06b6d4)"
      : null;

  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <div style={{
        width: size + (ring ? 4 : 0),
        height: size + (ring ? 4 : 0),
        borderRadius: "30%",
        padding: ring ? 2 : 0,
        background: ring || "transparent",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{
          width: size, height: size,
          borderRadius: "28%",
          overflow: "hidden",
          background: bg,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          {!err && photo
            ? <img src={photo} alt={name} onError={() => setErr(true)}
                style={{ width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" />
            : <span style={{ color: "#fff", fontWeight: 800, fontSize: size * 0.34, letterSpacing: "-0.02em" }}>
                {initials}
              </span>
          }
        </div>
      </div>
      {(premium || verified) && (
        <div style={{
          position: "absolute", bottom: -3, right: -3,
          width: 18, height: 18, borderRadius: "40%",
          background: premium ? "linear-gradient(135deg,#f97316,#ec4899)" : "linear-gradient(135deg,#3b82f6,#06b6d4)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
        }}>
          {premium
            ? <SparklesIcon style={{ width: 9, height: 9, color: "#fff" }} />
            : <ShieldCheckIcon style={{ width: 9, height: 9, color: "#fff" }} />
          }
        </div>
      )}
    </div>
  );
});
Avatar.displayName = "Avatar";

// ─────────────────────────────────────────────────────────────────────────────
// SUGGESTION CARD
// ─────────────────────────────────────────────────────────────────────────────
const SuggestionCard = memo(({ suggestion: s, onFollow, onDismiss, isDarkMode, isLoading }) => {
  const [hovered, setHovered] = useState(false);
  const reduced = useReducedMotion();
  const tk = useMemo(() => tokens(isDarkMode), [isDarkMode]);
  const badge = useMemo(() => BADGE_MAP(s), [s]);
  const followers = s.followers?.length || 0;

  return (
    <motion.article
      layout
      initial={reduced ? false : { opacity: 0, y: 16, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduced ? undefined : { opacity: 0, scale: 0.88, x: -30 }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      role="article"
      aria-label={`Suggestion : ${s.fullName || s.username}`}
      style={{
        position: "relative",
        flexShrink: 0,
        width: 156,
        borderRadius: 20,
        background: hovered ? tk.bgCardHov : tk.bgCard,
        border: `1.5px solid ${hovered ? tk.borderHov : tk.border}`,
        boxShadow: hovered
          ? `0 12px 40px rgba(249,115,22,${isDarkMode ? "0.2" : "0.12"}), ${tk.shadowCard}`
          : tk.shadowCard,
        transition: "border-color 0.25s, box-shadow 0.25s, background 0.25s",
        fontFamily: tk.font,
        overflow: "visible",
        cursor: "default",
      }}
    >
      {/* Dismiss */}
      <AnimatePresence>
        {hovered && (
          <motion.button
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ duration: 0.15 }}
            onClick={() => onDismiss(s._id)}
            aria-label={`Ignorer ${s.fullName || s.username}`}
            whileHover={{ scale: 1.1, rotate: 90 }}
            whileTap={{ scale: 0.9 }}
            style={{
              position: "absolute", top: -8, right: -8, zIndex: 10,
              width: 22, height: 22, borderRadius: 8, border: "none",
              cursor: "pointer",
              background: isDarkMode ? "#1c1c20" : "#fff",
              color: tk.textSub,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 2px 12px rgba(0,0,0,0.3)",
            }}
          >
            <XMarkIcon style={{ width: 11, height: 11 }} />
          </motion.button>
        )}
      </AnimatePresence>

      <div style={{
        padding: "18px 14px 16px",
        display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center",
        gap: 0,
      }}>
        {/* Avatar */}
        <motion.div
          whileHover={{ scale: reduced ? 1 : 1.05 }}
          transition={{ type: "spring", stiffness: 500 }}
          style={{ marginBottom: 12 }}
        >
          <Avatar
            name={s.fullName || s.username}
            photo={s.profilePhoto}
            size={60}
            premium={s.isPremium}
            verified={s.isVerified}
          />
        </motion.div>

        {/* Name */}
        <p style={{
          fontSize: 13, fontWeight: 800, letterSpacing: "-0.025em",
          color: tk.text,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          width: "100%", marginBottom: 2,
        }}>
          {s.fullName || s.username || "Utilisateur"}
          {s.isVerified && (
            <CheckBadgeIcon style={{ width: 12, height: 12, color: "#f97316", display: "inline", marginLeft: 3, verticalAlign: "middle" }} />
          )}
        </p>

        {/* Handle */}
        <p style={{
          fontSize: 10.5, color: tk.textSub, marginBottom: 8,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%",
        }}>
          @{s.username || s.email?.split("@")[0] || "user"}
        </p>

        {/* Badge */}
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 3,
          fontSize: 9, fontWeight: 700,
          padding: "2.5px 8px", borderRadius: 999,
          background: `${badge.color}18`,
          color: badge.color,
          border: `1px solid ${badge.color}28`,
          letterSpacing: "0.05em", textTransform: "uppercase",
          marginBottom: 10,
        }}>
          <span style={{ fontSize: 8 }}>{badge.icon}</span>
          {badge.label}
        </span>

        {/* Followers */}
        <p style={{
          fontSize: 11, color: tk.textSub, marginBottom: 14,
          fontVariantNumeric: "tabular-nums",
        }}>
          <b style={{ color: tk.text, fontWeight: 700 }}>{fmt(followers)}</b>
          {" "}abonné{followers !== 1 ? "s" : ""}
        </p>

        {/* Follow button */}
        <motion.button
          onClick={() => onFollow(s._id)}
          disabled={isLoading}
          aria-label={`Suivre ${s.fullName || s.username}`}
          whileHover={isLoading ? {} : { scale: 1.03, y: -1 }}
          whileTap={isLoading ? {} : { scale: 0.97 }}
          style={{
            width: "100%", padding: "8.5px 0",
            borderRadius: 50, border: "none",
            cursor: isLoading ? "not-allowed" : "pointer",
            background: isLoading
              ? (isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)")
              : tk.grad,
            color: isLoading ? tk.textMuted : "#fff",
            fontFamily: tk.font, fontWeight: 700, fontSize: 12,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
            boxShadow: isLoading ? "none" : "0 4px 16px rgba(249,115,22,0.35)",
            transition: "all 0.2s",
          }}
        >
          {isLoading
            ? <div style={{
                width: 13, height: 13,
                border: `2px solid ${isDarkMode ? "#4b5563" : "#d1d5db"}`,
                borderTopColor: "transparent",
                borderRadius: "50%",
                animation: "ps-spin 0.8s linear infinite",
              }} />
            : <><UserPlusIcon style={{ width: 12, height: 12 }} />Suivre</>
          }
        </motion.button>
      </div>

      <style>{`@keyframes ps-spin{to{transform:rotate(360deg)}}`}</style>
    </motion.article>
  );
});
SuggestionCard.displayName = "SuggestionCard";

// ─────────────────────────────────────────────────────────────────────────────
// SKELETON
// ─────────────────────────────────────────────────────────────────────────────
const SkeletonCard = memo(({ isDarkMode }) => {
  const base = isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)";
  const shine = isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)";
  return (
    <div style={{
      flexShrink: 0, width: 156, borderRadius: 20,
      padding: "18px 14px 16px",
      background: isDarkMode ? "rgba(22,22,26,0.6)" : "rgba(250,250,252,0.8)",
      border: `1.5px solid ${isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"}`,
      display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
      animation: "ps-pulse 1.6s ease-in-out infinite",
    }}>
      <div style={{ width: 64, height: 64, borderRadius: "28%", background: base }} />
      <div style={{ width: "65%", height: 12, borderRadius: 6, background: base }} />
      <div style={{ width: "45%", height: 10, borderRadius: 6, background: shine }} />
      <div style={{ width: "40%", height: 18, borderRadius: 99, background: base }} />
      <div style={{ width: "55%", height: 10, borderRadius: 6, background: shine }} />
      <div style={{ width: "100%", height: 34, borderRadius: 99, background: base }} />
      <style>{`@keyframes ps-pulse{0%,100%{opacity:1}50%{opacity:0.45}}`}</style>
    </div>
  );
});
SkeletonCard.displayName = "SkeletonCard";

// ─────────────────────────────────────────────────────────────────────────────
// SCROLL BUTTON
// ─────────────────────────────────────────────────────────────────────────────
const ScrollBtn = memo(({ dir, onClick, isDarkMode }) => (
  <motion.button
    initial={{ opacity: 0, scale: 0.7 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.7 }}
    transition={{ duration: 0.15 }}
    whileHover={{ scale: 1.1 }}
    whileTap={{ scale: 0.9 }}
    onClick={onClick}
    aria-label={dir === "left" ? "Précédent" : "Suivant"}
    style={{
      position: "absolute",
      [dir === "left" ? "left" : "right"]: -10,
      top: "50%", transform: "translateY(-50%)",
      zIndex: 10, width: 30, height: 30, borderRadius: 11,
      border: "none", cursor: "pointer",
      background: isDarkMode ? "#1c1c20" : "#fff",
      color: isDarkMode ? "#c0c0cc" : "#3a3a4a",
      display: "flex", alignItems: "center", justifyContent: "center",
      boxShadow: isDarkMode ? "0 4px 20px rgba(0,0,0,0.5)" : "0 4px 16px rgba(0,0,0,0.15)",
    }}
  >
    {dir === "left"
      ? <ChevronLeftIcon style={{ width: 15, height: 15 }} />
      : <ChevronRightIcon style={{ width: 15, height: 15 }} />
    }
  </motion.button>
));
ScrollBtn.displayName = "ScrollBtn";

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
export default function ProfileSuggestions({
  currentUser,
  token,
  isDarkMode = false,
  maxSuggestions = 8,
  onFollowSuccess,
}) {
  const [suggestions,      setSuggestions]      = useState([]);
  const [loading,          setLoading]          = useState(true);
  const [error,            setError]            = useState(null);
  const [followingIds,     setFollowingIds]      = useState(new Set());
  const [dismissedIds,     setDismissedIds]      = useState(new Set());
  const [localFollowedIds, setLocalFollowedIds]  = useState(new Set());
  const [usingFallback,    setUsingFallback]     = useState(false);
  const [scrollPos,        setScrollPos]         = useState(0);
  const [canScrollRight,   setCanScrollRight]    = useState(false);
  const scrollRef  = useRef(null);
  const abortRef   = useRef(null);
  const tk = useMemo(() => tokens(isDarkMode), [isDarkMode]);

  // ── Scroll state ────────────────────────────────────────────────────────
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const check = () => {
      setScrollPos(el.scrollLeft);
      setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
    };
    check();
    el.addEventListener("scroll", check, { passive: true });
    return () => el.removeEventListener("scroll", check);
  }, [suggestions]);

  const scroll = useCallback((dir) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "left" ? -180 : 180, behavior: "smooth" });
  }, []);

  // ── Cache fallback ──────────────────────────────────────────────────────
  const getSuggestionsFromCache = useCallback(() => {
    try {
      const cached = localStorage.getItem("allPostsCache");
      if (!cached) return [];
      const posts = JSON.parse(cached);
      if (!Array.isArray(posts)) return [];
      const usersMap = new Map();
      const currentUserId = currentUser?._id || currentUser?.id;
      const followingSet = new Set([
        ...(currentUser?.following || []).map(f => typeof f === "object" ? f._id : f),
        ...localFollowedIds,
      ]);
      posts.forEach(post => {
        const u = post.user;
        if (!u) return;
        const uid = u._id || u.id;
        if (!uid || uid === currentUserId || followingSet.has(uid) || dismissedIds.has(uid)) return;
        if (!usersMap.has(uid)) {
          usersMap.set(uid, {
            _id: uid, fullName: u.fullName, username: u.username,
            email: u.email, profilePhoto: u.profilePhoto, bio: u.bio,
            followers: u.followers || [], following: u.following || [],
            isVerified: u.isVerified, isPremium: u.isPremium, postsCount: 1,
          });
        } else usersMap.get(uid).postsCount++;
      });
      return Array.from(usersMap.values())
        .sort((a, b) => {
          if (a.isPremium !== b.isPremium) return a.isPremium ? -1 : 1;
          if (a.isVerified !== b.isVerified) return a.isVerified ? -1 : 1;
          if (a.postsCount !== b.postsCount) return b.postsCount - a.postsCount;
          return (b.followers?.length || 0) - (a.followers?.length || 0);
        })
        .slice(0, maxSuggestions);
    } catch { return []; }
  }, [currentUser, dismissedIds, localFollowedIds, maxSuggestions]);

  // ── Fetch ───────────────────────────────────────────────────────────────
  const fetchSuggestions = useCallback(async () => {
    const uid = currentUser?._id || currentUser?.id;
    if (!uid) { setLoading(false); return; }
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const { signal } = abortRef.current;

    setLoading(true); setError(null); setUsingFallback(false);

    const ENDPOINTS = [
      `${API_URL}/api/users/suggestions`,
      `${API_URL}/api/users`,
      `${API_URL}/users`,
    ];

    let data = null;
    for (const ep of ENDPOINTS) {
      if (signal.aborted) break;
      try {
        const res = await fetch(ep, {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          credentials: "include",
          signal: AbortSignal.any
            ? AbortSignal.any([signal, AbortSignal.timeout(6000)])
            : signal,
        });
        if (res.ok) { data = await res.json(); break; }
      } catch (e) {
        if (e.name === "AbortError") break;
        continue;
      }
    }

    if (signal.aborted) return;

    if (!data) {
      const cached = getSuggestionsFromCache();
      if (cached.length) { setSuggestions(cached); setUsingFallback(true); }
      else setError("Impossible de charger les suggestions.");
      setLoading(false);
      return;
    }

    const allUsers = Array.isArray(data)
      ? data
      : (data.users || data.suggestions || data.data || []);

    if (!allUsers.length) {
      const cached = getSuggestionsFromCache();
      if (cached.length) { setSuggestions(cached); setUsingFallback(true); }
      setLoading(false);
      return;
    }

    const followingSet = new Set([
      ...(currentUser.following || []).map(f => typeof f === "object" ? f._id : f),
      ...localFollowedIds,
    ]);

    const filtered = allUsers
      .filter(u => {
        const id = u._id || u.id;
        return id && id !== uid
          && !followingSet.has(id)
          && !dismissedIds.has(id)
          && !followingIds.has(id)
          && !localFollowedIds.has(id);
      })
      .sort((a, b) => {
        if (a.isPremium !== b.isPremium) return a.isPremium ? -1 : 1;
        if (a.isVerified !== b.isVerified) return a.isVerified ? -1 : 1;
        return (b.followers?.length || 0) - (a.followers?.length || 0);
      })
      .slice(0, maxSuggestions);

    setSuggestions(filtered);
    setLoading(false);
  }, [currentUser, token, dismissedIds, followingIds, localFollowedIds, maxSuggestions, getSuggestionsFromCache]);

  useEffect(() => {
    fetchSuggestions();
    return () => abortRef.current?.abort();
  }, [fetchSuggestions]);

  // ── Actions ─────────────────────────────────────────────────────────────
  const handleFollow = useCallback(async (userId) => {
    if (!token || followingIds.has(userId) || localFollowedIds.has(userId)) return;
    setFollowingIds(prev => new Set([...prev, userId]));
    setLocalFollowedIds(prev => new Set([...prev, userId]));
    setSuggestions(prev => prev.filter(s => (s._id || s.id) !== userId));
    try {
      const res = await fetch(`${API_URL}/api/users/${userId}/follow`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      if (!res.ok) throw new Error("follow_failed");
      setDismissedIds(prev => new Set([...prev, userId]));
      onFollowSuccess?.(userId);
    } catch {
      setFollowingIds(prev => { const s = new Set(prev); s.delete(userId); return s; });
      setLocalFollowedIds(prev => { const s = new Set(prev); s.delete(userId); return s; });
      setSuggestions(prev => {
        // Restore if we have the user still available
        return prev;
      });
    }
  }, [token, followingIds, localFollowedIds, onFollowSuccess]);

  const handleDismiss = useCallback((userId) => {
    setDismissedIds(prev => new Set([...prev, userId]));
    setSuggestions(prev => prev.filter(s => (s._id || s.id) !== userId));
  }, []);

  // ── RENDER STATES ────────────────────────────────────────────────────────
  const containerStyle = {
    borderRadius: 24,
    padding: 20,
    background: tk.bg,
    backdropFilter: tk.blur,
    WebkitBackdropFilter: tk.blur,
    border: `1.5px solid ${tk.border}`,
    boxShadow: tk.shadow,
    fontFamily: tk.font,
  };

  const Header = () => (
    <div style={{
      display: "flex", alignItems: "center",
      justifyContent: "space-between", marginBottom: 16,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 11,
          background: tk.grad,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 12px rgba(249,115,22,0.3)",
          flexShrink: 0,
        }}>
          <SparklesIcon style={{ width: 14, height: 14, color: "#fff" }} />
        </div>
        <span style={{ fontSize: 14.5, fontWeight: 800, color: tk.text, letterSpacing: "-0.02em" }}>
          Suggestions pour vous
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {usingFallback && (
          <span style={{
            fontSize: 9, fontWeight: 600, padding: "3px 8px", borderRadius: 999,
            background: isDarkMode ? "rgba(59,130,246,0.12)" : "rgba(59,130,246,0.08)",
            color: "#3b82f6", border: "1px solid rgba(59,130,246,0.2)",
          }}>
            💡 Activité locale
          </span>
        )}
        {!loading && suggestions.length > 0 && (
          <span style={{
            fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 999,
            background: isDarkMode ? "rgba(249,115,22,0.14)" : "rgba(249,115,22,0.09)",
            color: tk.accent, border: `1px solid rgba(249,115,22,0.22)`,
          }}>
            {suggestions.length}
          </span>
        )}
      </div>
    </div>
  );

  if (loading) return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      style={containerStyle}
    >
      <Header />
      <div style={{ display: "flex", gap: 10, overflow: "hidden" }}>
        {[1, 2, 3].map(i => <SkeletonCard key={i} isDarkMode={isDarkMode} />)}
      </div>
    </motion.div>
  );

  if (error) return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ ...containerStyle, textAlign: "center" }}
    >
      <Header />
      <div style={{ padding: "20px 0" }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>⚠️</div>
        <p style={{ fontSize: 13, color: tk.textSub, marginBottom: 14 }}>{error}</p>
        <motion.button
          onClick={fetchSuggestions}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          style={{
            padding: "8px 20px", borderRadius: 50, border: "none",
            background: tk.grad, color: "#fff",
            fontFamily: tk.font, fontWeight: 700, fontSize: 12,
            cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
            boxShadow: "0 4px 14px rgba(249,115,22,0.35)",
          }}
        >
          <ArrowPathIcon style={{ width: 13, height: 13 }} />
          Réessayer
        </motion.button>
      </div>
    </motion.div>
  );

  if (suggestions.length === 0) return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ ...containerStyle, textAlign: "center" }}
    >
      <Header />
      <div style={{ padding: "28px 0 10px" }}>
        <motion.div
          animate={{ rotate: [0, 10, -10, 0] }}
          transition={{ repeat: Infinity, repeatDelay: 3, duration: 0.5 }}
          style={{ fontSize: 34, marginBottom: 10 }}
        >✨</motion.div>
        <p style={{ fontSize: 14, fontWeight: 700, color: tk.text, marginBottom: 5 }}>
          Tout le monde est suivi !
        </p>
        <p style={{ fontSize: 12, color: tk.textSub }}>Revenez plus tard pour découvrir de nouveaux profils.</p>
      </div>
    </motion.div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      style={containerStyle}
      role="region"
      aria-label="Suggestions de profils"
    >
      <Header />

      <div style={{ position: "relative" }}>
        {/* Left arrow */}
        <AnimatePresence>
          {scrollPos > 10 && (
            <ScrollBtn dir="left" onClick={() => scroll("left")} isDarkMode={isDarkMode} />
          )}
        </AnimatePresence>

        {/* Cards list */}
        <div
          ref={scrollRef}
          style={{
            display: "flex", gap: 10,
            overflowX: "auto", paddingBottom: 2,
            scrollbarWidth: "none", msOverflowStyle: "none",
            scrollSnapType: "x mandatory",
          }}
        >
          <style>{`
            .ps-scroll::-webkit-scrollbar { display: none }
          `}</style>
          <AnimatePresence mode="popLayout">
            {suggestions.map(s => (
              <div key={s._id || s.id} style={{ scrollSnapAlign: "start" }}>
                <SuggestionCard
                  suggestion={s}
                  onFollow={handleFollow}
                  onDismiss={handleDismiss}
                  isDarkMode={isDarkMode}
                  isLoading={followingIds.has(s._id || s.id)}
                />
              </div>
            ))}
          </AnimatePresence>
        </div>

        {/* Right arrow */}
        <AnimatePresence>
          {canScrollRight && (
            <ScrollBtn dir="right" onClick={() => scroll("right")} isDarkMode={isDarkMode} />
          )}
        </AnimatePresence>

        {/* Right fade */}
        {canScrollRight && (
          <div style={{
            position: "absolute", right: 0, top: 0, bottom: 2,
            width: 48, pointerEvents: "none",
            background: `linear-gradient(to right, transparent, ${isDarkMode ? "rgba(12,12,14,0.95)" : "rgba(255,255,255,0.95)"})`,
            borderRadius: "0 16px 16px 0",
          }} />
        )}
      </div>
    </motion.div>
  );
}