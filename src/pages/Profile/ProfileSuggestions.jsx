// src/pages/profile/ProfileSuggestions.jsx
// ✅ NOUVEAU DESIGN — Style moderne TikTok/Instagram fusionné
// Conserve toute la logique métier originale (follow, dismiss, cache, filtrage)

import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  UserPlusIcon,
  XMarkIcon,
  SparklesIcon,
  ShieldCheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function formatCount(n) {
  if (!n) return "0";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return String(n);
}

// ============================================
// 🎨 CARTE SUGGESTION
// ============================================
const SuggestionCard = React.forwardRef(
  ({ suggestion, onFollow, onDismiss, isDarkMode, isLoading }, ref) => {
    const [imageError, setImageError] = useState(false);
    const [hovered, setHovered] = useState(false);

    const getBadge = () => {
      if (suggestion.isPremium) return { label: "Premium", color: "#f97316" };
      if (suggestion.isVerified) return { label: "Vérifié", color: "#3b82f6" };
      if (suggestion.postsCount > 10) return { label: "Actif", color: "#22c55e" };
      if ((suggestion.followers?.length || 0) > 100) return { label: "Populaire", color: "#a855f7" };
      return { label: "Nouveau", color: "#6b7280" };
    };

    const badge = getBadge();
    const bg   = isDarkMode ? "rgba(255,255,255,0.04)" : "#fff";
    const bdr  = isDarkMode ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)";
    const bdrH = isDarkMode ? "rgba(249,115,22,0.35)"  : "rgba(249,115,22,0.3)";

    return (
      <motion.div
        ref={ref}
        layout
        initial={{ opacity: 0, scale: 0.92, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.88, x: -40 }}
        transition={{ type: "spring", stiffness: 420, damping: 32 }}
        onHoverStart={() => setHovered(true)}
        onHoverEnd={() => setHovered(false)}
        style={{
          position: "relative",
          flexShrink: 0,
          width: 160,
          borderRadius: 20,
          background: bg,
          border: `1px solid ${hovered ? bdrH : bdr}`,
          boxShadow: hovered
            ? isDarkMode
              ? "0 8px 32px rgba(249,115,22,0.15)"
              : "0 8px 28px rgba(0,0,0,0.1)"
            : "none",
          transition: "border-color 0.2s, box-shadow 0.2s",
          fontFamily: "'Sora','DM Sans',sans-serif",
          overflow: "visible",
        }}
      >
        {/* Dismiss button */}
        <AnimatePresence>
          {hovered && (
            <motion.button
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              onClick={() => onDismiss(suggestion._id)}
              whileHover={{ scale: 1.15, rotate: 90 }}
              whileTap={{ scale: 0.9 }}
              style={{
                position: "absolute", top: -8, right: -8, zIndex: 10,
                width: 24, height: 24, borderRadius: 8, border: "none", cursor: "pointer",
                background: isDarkMode ? "#1a1a1a" : "#fff",
                color: isDarkMode ? "#9ca3af" : "#6b7280",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 2px 12px rgba(0,0,0,0.25)",
              }}
            >
              <XMarkIcon style={{ width: 13, height: 13 }} />
            </motion.button>
          )}
        </AnimatePresence>

        <div style={{ padding: "16px 12px 14px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>

          {/* Avatar */}
          <div style={{ position: "relative", marginBottom: 12 }}>
            <motion.div
              whileHover={{ scale: 1.06 }}
              style={{
                width: 64, height: 64, borderRadius: 20, overflow: "hidden",
                background: isDarkMode ? "#1a1a1a" : "#f3f4f6",
                border: suggestion.isPremium
                  ? "2px solid transparent"
                  : `2px solid ${isDarkMode ? "rgba(249,115,22,0.25)" : "rgba(249,115,22,0.2)"}`,
                backgroundClip: "padding-box",
                boxShadow: suggestion.isPremium
                  ? "0 0 0 2px #f97316, 0 0 0 4px #ec4899"
                  : hovered ? "0 0 0 3px rgba(249,115,22,0.3)" : "none",
                transition: "box-shadow 0.2s",
              }}
            >
              <img
                src={imageError ? "/default-avatar.png" : (suggestion.profilePhoto || "/default-avatar.png")}
                alt={suggestion.fullName}
                onError={() => setImageError(true)}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </motion.div>

            {/* Badge vérifié/premium */}
            {(suggestion.isPremium || suggestion.isVerified) && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1, type: "spring", stiffness: 500 }}
                style={{
                  position: "absolute", bottom: -4, right: -4,
                  width: 20, height: 20, borderRadius: 7,
                  background: "linear-gradient(135deg,#f97316,#ec4899)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  border: isDarkMode ? "2px solid #0a0a0a" : "2px solid #fff",
                  boxShadow: "0 2px 8px rgba(249,115,22,0.4)",
                }}
              >
                {suggestion.isPremium
                  ? <SparklesIcon style={{ width: 10, height: 10, color: "#fff" }} />
                  : <ShieldCheckIcon style={{ width: 10, height: 10, color: "#fff" }} />
                }
              </motion.div>
            )}
          </div>

          {/* Nom + handle */}
          <div style={{ width: "100%", marginBottom: 10 }}>
            <p style={{
              fontSize: 13, fontWeight: 800, letterSpacing: "-0.02em",
              color: isDarkMode ? "#f5f5f5" : "#111",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              marginBottom: 2,
            }}>
              {suggestion.fullName || suggestion.username || "Utilisateur"}
            </p>
            <p style={{
              fontSize: 11, color: isDarkMode ? "#6b7280" : "#9ca3af",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              marginBottom: 6,
            }}>
              @{suggestion.username || suggestion.email?.split("@")[0] || "user"}
            </p>

            {/* Badge type */}
            <span style={{
              display: "inline-block", fontSize: 9, fontWeight: 700,
              padding: "2px 8px", borderRadius: 999,
              background: `${badge.color}18`,
              color: badge.color,
              border: `1px solid ${badge.color}30`,
              letterSpacing: "0.04em", textTransform: "uppercase",
            }}>
              {badge.label}
            </span>
          </div>

          {/* Compteur abonnés */}
          <p style={{ fontSize: 11, color: isDarkMode ? "#6b7280" : "#9ca3af", marginBottom: 12 }}>
            <b style={{ color: isDarkMode ? "#d1d5db" : "#374151", fontWeight: 700 }}>
              {formatCount(suggestion.followers?.length || 0)}
            </b> abonnés
          </p>

          {/* Bouton Suivre */}
          <motion.button
            onClick={() => onFollow(suggestion._id)}
            disabled={isLoading}
            whileHover={{ scale: isLoading ? 1 : 1.04, y: isLoading ? 0 : -1 }}
            whileTap={{ scale: isLoading ? 1 : 0.97 }}
            style={{
              width: "100%", padding: "8px 0", borderRadius: 50, border: "none",
              cursor: isLoading ? "not-allowed" : "pointer",
              background: isLoading
                ? (isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)")
                : "linear-gradient(135deg,#f97316,#ec4899)",
              color: isLoading ? (isDarkMode ? "#4b5563" : "#9ca3af") : "#fff",
              fontFamily: "'Sora','DM Sans',sans-serif",
              fontWeight: 700, fontSize: 12,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
              boxShadow: isLoading ? "none" : "0 4px 14px rgba(249,115,22,0.4)",
              transition: "all 0.2s",
            }}
          >
            {isLoading ? (
              <div style={{
                width: 14, height: 14,
                border: `2px solid ${isDarkMode ? "#4b5563" : "#d1d5db"}`,
                borderTopColor: "transparent", borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
              }} />
            ) : (
              <>
                <UserPlusIcon style={{ width: 13, height: 13 }} />
                Suivre
              </>
            )}
          </motion.button>
        </div>
      </motion.div>
    );
  }
);
SuggestionCard.displayName = "SuggestionCard";

// ============================================
// 🔄 LOADING SKELETON
// ============================================
const LoadingCard = React.memo(({ isDarkMode }) => (
  <div style={{
    flexShrink: 0, width: 160, borderRadius: 20, padding: "16px 12px",
    background: isDarkMode ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)",
    border: `1px solid ${isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"}`,
    animation: "pulse 1.8s ease infinite",
  }}>
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      <div style={{ width: 64, height: 64, borderRadius: 20, background: isDarkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }} />
      <div style={{ width: "70%", height: 12, borderRadius: 6, background: isDarkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }} />
      <div style={{ width: "50%", height: 10, borderRadius: 6, background: isDarkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)" }} />
      <div style={{ width: "100%", height: 32, borderRadius: 50, background: isDarkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }} />
    </div>
    <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} } @keyframes spin { to{transform:rotate(360deg)} }`}</style>
  </div>
));
LoadingCard.displayName = "LoadingCard";

// ============================================
// 📱 COMPOSANT PRINCIPAL
// ============================================
export default function ProfileSuggestions({
  currentUser,
  token,
  isDarkMode = false,
  maxSuggestions = 8,
  onFollowSuccess,
}) {
  const [suggestions,     setSuggestions]     = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [followingIds,    setFollowingIds]    = useState(new Set());
  const [dismissedIds,    setDismissedIds]    = useState(new Set());
  const [localFollowedIds, setLocalFollowedIds] = useState(new Set());
  const [error,           setError]           = useState(null);
  const [usingFallback,   setUsingFallback]   = useState(false);
  const [scrollPos,       setScrollPos]       = useState(0);
  const [canScrollRight,  setCanScrollRight]  = useState(false);
  const scrollRef = useRef(null);

  // ── Scroll ────────────────────────────────────────────────────────────────
  const scroll = (dir) => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = 180;
    const next = dir === "left"
      ? Math.max(0, scrollPos - amount)
      : scrollPos + amount;
    el.scrollTo({ left: next, behavior: "smooth" });
    setScrollPos(next);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const check = () => setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    check();
    el.addEventListener("scroll", check);
    return () => el.removeEventListener("scroll", check);
  }, [suggestions]);

  // ── Cache fallback ─────────────────────────────────────────────────────────
  const getSuggestionsFromCache = useCallback(() => {
    try {
      const cached = localStorage.getItem("allPostsCache");
      if (!cached) return [];
      const posts = JSON.parse(cached);
      if (!Array.isArray(posts)) return [];
      const usersMap = new Map();
      const currentUserId = currentUser?._id || currentUser?.id;
      const following = new Set([
        ...(currentUser?.following || []).map(f => typeof f === "object" ? f._id : f),
        ...localFollowedIds,
      ]);
      posts.forEach(post => {
        const u = post.user;
        if (!u) return;
        const uid = u._id || u.id;
        if (!uid || uid === currentUserId || following.has(uid) || dismissedIds.has(uid)) return;
        if (!usersMap.has(uid)) {
          usersMap.set(uid, { _id: uid, fullName: u.fullName, username: u.username, email: u.email, profilePhoto: u.profilePhoto, bio: u.bio, followers: u.followers || [], following: u.following || [], isVerified: u.isVerified, isPremium: u.isPremium, postsCount: 1 });
        } else {
          usersMap.get(uid).postsCount++;
        }
      });
      return Array.from(usersMap.values())
        .sort((a, b) => {
          if (a.isPremium && !b.isPremium) return -1;
          if (!a.isPremium && b.isPremium) return 1;
          if (a.isVerified && !b.isVerified) return -1;
          if (!a.isVerified && b.isVerified) return 1;
          if (a.postsCount !== b.postsCount) return b.postsCount - a.postsCount;
          return (b.followers?.length || 0) - (a.followers?.length || 0);
        })
        .slice(0, maxSuggestions);
    } catch { return []; }
  }, [currentUser, dismissedIds, localFollowedIds, maxSuggestions]);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchSuggestions = useCallback(async () => {
    if (!currentUser?._id && !currentUser?.id) { setLoading(false); return; }
    setLoading(true); setError(null); setUsingFallback(false);
    try {
      const userId = currentUser._id || currentUser.id;
      let data; let success = false;
      const endpoints = [`${API_URL}/api/users/suggestions`, `${API_URL}/api/users`, `${API_URL}/users`];
      for (const ep of endpoints) {
        try {
          const res = await fetch(ep, { headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, credentials: "include", signal: AbortSignal.timeout(5000) });
          if (res.ok) { data = await res.json(); success = true; break; }
        } catch { continue; }
      }
      if (!success) {
        const c = getSuggestionsFromCache();
        if (c.length) { setSuggestions(c); setUsingFallback(true); }
        return;
      }
      const allUsers = Array.isArray(data) ? data : (data.users || data.suggestions || data.data || []);
      if (!allUsers.length) {
        const c = getSuggestionsFromCache();
        if (c.length) { setSuggestions(c); setUsingFallback(true); }
        return;
      }
      const following = new Set([
        ...(currentUser.following || []).map(f => typeof f === "object" ? f._id : f),
        ...localFollowedIds,
      ]);
      const filtered = allUsers
        .filter(u => { const uid = u._id || u.id; return uid !== userId && !following.has(uid) && !dismissedIds.has(uid) && !followingIds.has(uid) && !localFollowedIds.has(uid); })
        .sort((a, b) => {
          if (a.isPremium && !b.isPremium) return -1;
          if (!a.isPremium && b.isPremium) return 1;
          if (a.isVerified && !b.isVerified) return -1;
          if (!a.isVerified && b.isVerified) return 1;
          return (b.followers?.length || 0) - (a.followers?.length || 0);
        })
        .slice(0, maxSuggestions);
      setSuggestions(filtered);
    } catch (err) {
      const c = getSuggestionsFromCache();
      if (c.length) { setSuggestions(c); setUsingFallback(true); }
      else setError(err.message || "Erreur de chargement");
    } finally { setLoading(false); }
  }, [currentUser, token, dismissedIds, followingIds, localFollowedIds, maxSuggestions, getSuggestionsFromCache]);

  useEffect(() => { fetchSuggestions(); }, [fetchSuggestions]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleFollow = useCallback(async (userId) => {
    if (!token || followingIds.has(userId) || localFollowedIds.has(userId)) return;
    setFollowingIds(prev => new Set(prev).add(userId));
    setLocalFollowedIds(prev => new Set(prev).add(userId));
    setSuggestions(prev => prev.filter(s => (s._id || s.id) !== userId));
    try {
      const res = await fetch(`${API_URL}/api/users/${userId}/follow`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, credentials: "include" });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message || "Erreur suivi"); }
      setDismissedIds(prev => new Set(prev).add(userId));
      onFollowSuccess?.(userId);
    } catch {
      setFollowingIds(prev => { const s = new Set(prev); s.delete(userId); return s; });
    }
  }, [token, followingIds, localFollowedIds, onFollowSuccess]);

  const handleDismiss = useCallback((userId) => {
    setDismissedIds(prev => new Set(prev).add(userId));
    setSuggestions(prev => prev.filter(s => (s._id || s.id) !== userId));
  }, []);

  // ── Styles ─────────────────────────────────────────────────────────────────
  const containerBg  = isDarkMode ? "rgba(10,10,10,0.8)"  : "rgba(255,255,255,0.9)";
  const containerBdr = isDarkMode ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)";
  const textPrimary  = isDarkMode ? "#f5f5f5" : "#111";
  const textSub      = isDarkMode ? "#6b7280" : "#9ca3af";

  // ── LOADING ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          borderRadius: 24, padding: 20,
          background: containerBg,
          backdropFilter: "blur(20px)",
          border: `1px solid ${containerBdr}`,
          boxShadow: isDarkMode ? "0 8px 32px rgba(0,0,0,0.4)" : "0 4px 24px rgba(0,0,0,0.07)",
          fontFamily: "'Sora','DM Sans',sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <div style={{ width: 28, height: 28, borderRadius: 10, background: "linear-gradient(135deg,#f97316,#ec4899)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <SparklesIcon style={{ width: 14, height: 14, color: "#fff" }} />
          </div>
          <span style={{ fontSize: 15, fontWeight: 800, color: textPrimary }}>Suggestions pour vous</span>
        </div>
        <div style={{ display: "flex", gap: 10, overflow: "hidden" }}>
          {[1, 2, 3].map(i => <LoadingCard key={i} isDarkMode={isDarkMode} />)}
        </div>
      </motion.div>
    );
  }

  // ── VIDE ───────────────────────────────────────────────────────────────────
  if (suggestions.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          borderRadius: 24, padding: 20,
          background: containerBg, backdropFilter: "blur(20px)",
          border: `1px solid ${containerBdr}`,
          boxShadow: isDarkMode ? "0 8px 32px rgba(0,0,0,0.4)" : "0 4px 24px rgba(0,0,0,0.07)",
          fontFamily: "'Sora','DM Sans',sans-serif",
          textAlign: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20, justifyContent: "center" }}>
          <div style={{ width: 28, height: 28, borderRadius: 10, background: "linear-gradient(135deg,#f97316,#ec4899)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <SparklesIcon style={{ width: 14, height: 14, color: "#fff" }} />
          </div>
          <span style={{ fontSize: 15, fontWeight: 800, color: textPrimary }}>Suggestions pour vous</span>
        </div>
        <div style={{ padding: "24px 0" }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>✨</div>
          <p style={{ fontSize: 14, fontWeight: 600, color: textPrimary, marginBottom: 4 }}>Aucune suggestion</p>
          <p style={{ fontSize: 12, color: textSub }}>Revenez plus tard !</p>
        </div>
      </motion.div>
    );
  }

  // ── RENDU PRINCIPAL ────────────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        borderRadius: 24, padding: 20,
        background: containerBg, backdropFilter: "blur(20px)",
        border: `1px solid ${containerBdr}`,
        boxShadow: isDarkMode ? "0 8px 32px rgba(0,0,0,0.4)" : "0 4px 24px rgba(0,0,0,0.07)",
        fontFamily: "'Sora','DM Sans',sans-serif",
      }}
    >
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 10, background: "linear-gradient(135deg,#f97316,#ec4899)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <SparklesIcon style={{ width: 14, height: 14, color: "#fff" }} />
          </div>
          <span style={{ fontSize: 15, fontWeight: 800, color: textPrimary }}>Suggestions pour vous</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {usingFallback && (
            <span style={{
              fontSize: 9, fontWeight: 600, padding: "3px 8px", borderRadius: 999,
              background: isDarkMode ? "rgba(59,130,246,0.1)" : "rgba(59,130,246,0.08)",
              color: "#3b82f6", border: "1px solid rgba(59,130,246,0.2)",
            }}>
              💡 Votre activité
            </span>
          )}
          <span style={{
            fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 999,
            background: isDarkMode ? "rgba(249,115,22,0.12)" : "rgba(249,115,22,0.08)",
            color: "#f97316", border: "1px solid rgba(249,115,22,0.2)",
          }}>
            {suggestions.length}
          </span>
        </div>
      </div>

      {/* Scroll area */}
      <div style={{ position: "relative" }}>
        {/* Flèche gauche */}
        <AnimatePresence>
          {scrollPos > 10 && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={() => scroll("left")}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              style={{
                position: "absolute", left: -8, top: "50%", transform: "translateY(-50%)",
                zIndex: 10, width: 32, height: 32, borderRadius: 12, border: "none", cursor: "pointer",
                background: isDarkMode ? "#1a1a1a" : "#fff",
                color: isDarkMode ? "#d1d5db" : "#374151",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
              }}
            >
              <ChevronLeftIcon style={{ width: 16, height: 16 }} />
            </motion.button>
          )}
        </AnimatePresence>

        {/* Liste */}
        <div
          ref={scrollRef}
          style={{
            display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4,
            scrollbarWidth: "none", msOverflowStyle: "none",
          }}
        >
          <AnimatePresence mode="popLayout">
            {suggestions.map(s => (
              <SuggestionCard
                key={s._id || s.id}
                suggestion={s}
                onFollow={handleFollow}
                onDismiss={handleDismiss}
                isDarkMode={isDarkMode}
                isLoading={followingIds.has(s._id || s.id)}
              />
            ))}
          </AnimatePresence>
        </div>

        {/* Flèche droite */}
        <AnimatePresence>
          {canScrollRight && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={() => scroll("right")}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              style={{
                position: "absolute", right: -8, top: "50%", transform: "translateY(-50%)",
                zIndex: 10, width: 32, height: 32, borderRadius: 12, border: "none", cursor: "pointer",
                background: isDarkMode ? "#1a1a1a" : "#fff",
                color: isDarkMode ? "#d1d5db" : "#374151",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
              }}
            >
              <ChevronRightIcon style={{ width: 16, height: 16 }} />
            </motion.button>
          )}
        </AnimatePresence>

        {/* Fade droite si scrollable */}
        {canScrollRight && (
          <div style={{
            position: "absolute", right: 0, top: 0, bottom: 4, width: 40, pointerEvents: "none",
            background: `linear-gradient(to right, transparent, ${isDarkMode ? "rgba(10,10,10,0.9)" : "rgba(255,255,255,0.9)"})`,
            borderRadius: "0 16px 16px 0",
          }} />
        )}
      </div>
    </motion.div>
  );
}