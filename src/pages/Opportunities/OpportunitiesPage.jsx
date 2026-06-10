/**
 * OpportunitiesPage.jsx
 * Onglet Opportunités — Chantilink
 * UI v3 — robuste avec skeleton, cache localStorage, retry auto
 */

import React, {
  useState, useEffect, useCallback, useRef, useMemo, memo,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Briefcase, GraduationCap, FileText, MapPin, ExternalLink,
  Search, RefreshCw, Clock, X, ArrowUpRight, SlidersHorizontal,
  Building2, CalendarClock, Sparkles, TrendingUp, Award,
} from "lucide-react";
import { useDarkMode } from "../../context/DarkModeContext";
import axiosClient from "../../api/axiosClientGlobal";

// ─── Constantes ──────────────────────────────────────────────────────────────
const LIMIT = 20;
const CACHE_KEY = "chantilink_opportunities_cache";
const CACHE_STATS_KEY = "chantilink_opportunities_stats";
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const TYPE_CONFIG = {
  emploi: {
    label:   "Emploi",
    color:   "#3b82f6",
    colorDk: "#60a5fa",
    grad:    "linear-gradient(135deg, #1d4ed8, #3b82f6)",
    bg:      "rgba(59,130,246,0.10)",
    bgDk:    "rgba(59,130,246,0.18)",
    Icon:    Briefcase,
  },
  stage: {
    label:   "Stage",
    color:   "#22c55e",
    colorDk: "#4ade80",
    grad:    "linear-gradient(135deg, #15803d, #22c55e)",
    bg:      "rgba(34,197,94,0.10)",
    bgDk:    "rgba(34,197,94,0.18)",
    Icon:    GraduationCap,
  },
  appel_offre: {
    label:   "Appel d'offres",
    color:   "#f59e0b",
    colorDk: "#fbbf24",
    grad:    "linear-gradient(135deg, #b45309, #f59e0b)",
    bg:      "rgba(245,158,11,0.10)",
    bgDk:    "rgba(245,158,11,0.18)",
    Icon:    FileText,
  },
};

const CITIES = ["Abidjan", "Bouaké", "Yamoussoukro", "Korhogo", "San Pedro", "Daloa"];

// ─── Cache helpers ───────────────────────────────────────────────────────────
function getCached(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { data, timestamp } = JSON.parse(raw);
    if (Date.now() - timestamp > CACHE_TTL) {
      localStorage.removeItem(key);
      return null;
    }
    return data;
  } catch { return null; }
}

function setCache(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
  } catch { /* localStorage plein, ignore */ }
}

// ─── Utils ────────────────────────────────────────────────────────────────────
function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1)  return "À l'instant";
  if (h < 24) return `il y a ${h}h`;
  const d = Math.floor(h / 24);
  if (d === 1) return "Hier";
  if (d < 7)  return `il y a ${d}j`;
  return `il y a ${Math.floor(d / 7)} sem.`;
}

function isNew(dateStr) {
  return Date.now() - new Date(dateStr).getTime() < 48 * 3_600_000;
}

function formatExpiry(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (d < new Date()) return "Clôturé";
  return `${d.toLocaleDateString("fr-CI", { day: "numeric", month: "short" })}`;
}

// ─── Hook fetch avec cache + retry ──────────────────────────────────────────
function useOpportunities({ type, location, search }) {
  const [items,      setItems]      = useState(() => getCached(CACHE_KEY) || []);
  const [stats,      setStats]      = useState(() => getCached(CACHE_STATS_KEY) || null);
  const [page,       setPage]       = useState(1);
  const [hasMore,    setHasMore]    = useState(true);
  const [loading,    setLoading]    = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState(null);
  const abortRef = useRef(null);
  const retryCountRef = useRef(0);
  const isFirstLoad = useRef(true);

  const fetchStats = useCallback(async () => {
    try {
      const { data } = await axiosClient.get("/opportunities/stats");
      setStats(data);
      setCache(CACHE_STATS_KEY, data);
    } catch {}
  }, []);

  const fetchPage = useCallback(async (pageNum, append = false) => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    setError(null);

    const attemptFetch = async (retries = 2) => {
      try {
        const params = new URLSearchParams({ page: pageNum, limit: LIMIT });
        if (type)     params.set("type", type);
        if (location) params.set("location", location);
        if (search)   params.set("search", search);

        const { data } = await axiosClient.get(`/opportunities?${params}`, {
          signal: abortRef.current.signal,
        });

        setItems((prev) => {
          const newItems = append ? [...prev, ...data.opportunities] : data.opportunities;
          setCache(CACHE_KEY, newItems);
          return newItems;
        });
        setHasMore(data.pagination.hasMore);
        retryCountRef.current = 0;
      } catch (err) {
        if (err.name === "CanceledError" || err.code === "ERR_CANCELED") return;
        
        if (retries > 0) {
          // Retry après un délai exponentiel
          await new Promise(r => setTimeout(r, (3 - retries) * 1000));
          return attemptFetch(retries - 1);
        }
        
        setError("Impossible de charger les opportunités.");
        // Restaurer depuis le cache si perte de connexion
        const cached = getCached(CACHE_KEY);
        if (cached && !append) setItems(cached);
      } finally {
        setLoading(false);
      }
    };

    await attemptFetch();
  }, [type, location, search]);

  // Chargement initial
  useEffect(() => {
    if (isFirstLoad.current && items.length > 0) {
      // Déjà chargé depuis le cache
      isFirstLoad.current = false;
      fetchStats();
      return;
    }
    isFirstLoad.current = false;
    setPage(1);
    setItems([]);
    fetchPage(1, false);
    fetchStats();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch quand les filtres changent
  useEffect(() => {
    if (!isFirstLoad.current) {
      setPage(1);
      setItems(getCached(CACHE_KEY) || []);
      fetchPage(1, false);
    }
  }, [type, location, search]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMore = useCallback(() => {
    if (!hasMore || loading) return;
    const next = page + 1;
    setPage(next);
    fetchPage(next, true);
  }, [hasMore, loading, page, fetchPage]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try { await axiosClient.post("/opportunities/admin/sync"); } catch {}
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_STATS_KEY);
    setPage(1);
    await fetchPage(1, false);
    await fetchStats();
    setRefreshing(false);
  }, [fetchPage, fetchStats]);

  return { items, stats, loading, refreshing, hasMore, error, loadMore, refresh };
}

// ─── Skeleton Loader ─────────────────────────────────────────────────────────
const SkeletonCard = memo(({ isDarkMode }) => (
  <div style={{
    background: isDarkMode ? "rgba(255,255,255,0.04)" : "#ffffff",
    border: `1px solid ${isDarkMode ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)"}`,
    borderRadius: 20,
    padding: "14px 16px 14px 20px",
    position: "relative",
    overflow: "hidden",
  }}>
    {/* Accent bar */}
    <div style={{
      position: "absolute", left: 0, top: 0, bottom: 0, width: 3,
      background: "linear-gradient(135deg, #1d4ed8, #3b82f6)",
      borderRadius: "20px 0 0 20px",
    }} />
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
      {/* Icon skeleton */}
      <div style={{
        width: 40, height: 40, borderRadius: 14, flexShrink: 0,
        background: isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
        animation: "skeleton-pulse 1.5s ease-in-out infinite",
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Badges skeleton */}
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          <div style={{
            width: 60, height: 18, borderRadius: 99,
            background: isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
            animation: "skeleton-pulse 1.5s ease-in-out infinite",
          }} />
          <div style={{
            width: 80, height: 18, borderRadius: 99,
            background: isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
            animation: "skeleton-pulse 1.5s ease-in-out infinite",
          }} />
        </div>
        {/* Title skeleton */}
        <div style={{
          width: "70%", height: 18, borderRadius: 6, marginBottom: 8,
          background: isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
          animation: "skeleton-pulse 1.5s ease-in-out infinite",
        }} />
        {/* Company skeleton */}
        <div style={{
          width: "40%", height: 14, borderRadius: 6, marginBottom: 10,
          background: isDarkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
          animation: "skeleton-pulse 1.5s ease-in-out infinite",
        }} />
        {/* Pills skeleton */}
        <div style={{ display: "flex", gap: 6 }}>
          <div style={{
            width: 80, height: 26, borderRadius: 99,
            background: isDarkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
            animation: "skeleton-pulse 1.5s ease-in-out infinite",
          }} />
          <div style={{
            width: 60, height: 26, borderRadius: 99,
            background: isDarkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
            animation: "skeleton-pulse 1.5s ease-in-out infinite",
          }} />
        </div>
      </div>
    </div>
    <style>{`
      @keyframes skeleton-pulse {
        0%, 100% { opacity: 0.6; }
        50% { opacity: 1; }
      }
    `}</style>
  </div>
));
SkeletonCard.displayName = "SkeletonCard";

// ─── TypeIcon — conteneur icône moderne ──────────────────────────────────────
const TypeIcon = memo(({ type, size = 32 }) => {
  const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.emploi;
  const Icon = cfg.Icon;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.34,
        background: cfg.grad,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        boxShadow: `0 4px 12px ${cfg.color}40`,
      }}
    >
      <Icon size={size * 0.52} color="#fff" strokeWidth={2} />
    </div>
  );
});
TypeIcon.displayName = "TypeIcon";

// ─── OppCard ─────────────────────────────────────────────────────────────────
const OppCard = memo(({ opp, isDarkMode }) => {
  const cfg    = TYPE_CONFIG[opp.type] || TYPE_CONFIG.emploi;
  const expiry = formatExpiry(opp.expiresAt);
  const fresh  = isNew(opp.postedAt);
  const isClosed = expiry === "Clôturé";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      style={{
        background: isDarkMode
          ? "rgba(255,255,255,0.04)"
          : "#ffffff",
        border: `1px solid ${isDarkMode ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)"}`,
        borderRadius: 20,
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Accent bar gauche */}
      <div style={{
        position: "absolute", left: 0, top: 0, bottom: 0, width: 3,
        background: cfg.grad, borderRadius: "20px 0 0 20px",
      }} />

      <div style={{ padding: "14px 16px 14px 20px" }}>
        {/* Top row */}
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <TypeIcon type={opp.type} size={40} />

          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Meta row */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
              {/* Badge type */}
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: "0.04em",
                padding: "2px 8px", borderRadius: 99,
                background: isDarkMode ? cfg.bgDk : cfg.bg,
                color: isDarkMode ? cfg.colorDk : cfg.color,
                textTransform: "uppercase",
              }}>
                {cfg.label}
              </span>

              {/* Badge nouveau */}
              {fresh && (
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 3,
                  fontSize: 10, fontWeight: 700,
                  padding: "2px 7px", borderRadius: 99,
                  background: "rgba(249,115,22,0.15)", color: "#f97316",
                  "aria-hidden": "true",
                }}>
                  <Sparkles size={9} strokeWidth={2.5} />
                  Nouveau
                </span>
              )}

              {/* Time ago */}
              <span style={{
                fontSize: 11, marginLeft: "auto",
                color: isDarkMode ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)",
                display: "flex", alignItems: "center", gap: 3,
              }}>
                <Clock size={10} />
                {timeAgo(opp.postedAt)}
              </span>
            </div>

            {/* Titre */}
            <p style={{
              fontSize: 15, fontWeight: 700, lineHeight: 1.3, marginBottom: 2,
              color: isDarkMode ? "#f1f5f9" : "#0f172a",
            }}>
              {opp.title}
            </p>

            {/* Entreprise */}
            {opp.company && opp.company !== "Non précisé" && (
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 6 }}>
                <Building2 size={11} style={{ color: isDarkMode ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)", flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: isDarkMode ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.45)" }}>
                  {opp.company}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Pills row */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10, alignItems: "center" }}>
          {/* Ville */}
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            fontSize: 11, fontWeight: 500, padding: "4px 9px", borderRadius: 99,
            background: isDarkMode ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)",
            color: isDarkMode ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.5)",
          }}>
            <MapPin size={10} style={{ color: "#f97316" }} />
            {opp.location}
          </span>

          {/* Tags */}
          {opp.tags?.slice(0, 2).map((tag) => (
            <span key={tag} style={{
              fontSize: 11, fontWeight: 500, padding: "4px 9px", borderRadius: 99,
              background: isDarkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
              color: isDarkMode ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)",
            }}>
              {tag}
            </span>
          ))}

          {/* Expiry */}
          {expiry && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 3,
              fontSize: 11, fontWeight: 600, padding: "4px 9px", borderRadius: 99,
              background: isClosed ? "rgba(239,68,68,0.10)" : "rgba(245,158,11,0.10)",
              color: isClosed ? "#ef4444" : "#d97706",
            }}>
              <CalendarClock size={10} />
              {isClosed ? "Clôturé" : `Clôture ${expiry}`}
            </span>
          )}

          {/* CTA */}
          <a
            href={opp.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              marginLeft: "auto",
              display: "inline-flex", alignItems: "center", gap: 4,
              fontSize: 12, fontWeight: 700,
              padding: "5px 12px", borderRadius: 99,
              background: "linear-gradient(135deg, #ea580c, #f97316)",
              color: "#fff",
              textDecoration: "none",
              boxShadow: "0 2px 8px rgba(249,115,22,0.35)",
              flexShrink: 0,
            }}
          >
            Voir
            <ArrowUpRight size={12} strokeWidth={2.5} />
          </a>
        </div>

        {/* Source */}
        <p style={{
          fontSize: 10, marginTop: 8,
          color: isDarkMode ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.22)",
        }}>
          {opp.source?.replace(/_/g, ".")}
        </p>
      </div>
    </motion.div>
  );
});
OppCard.displayName = "OppCard";

// ─── StatBadge ────────────────────────────────────────────────────────────────
const StatBadge = memo(({ label, count, type, isDarkMode }) => {
  const cfg = TYPE_CONFIG[type];
  const Icon = cfg.Icon;
  return (
    <div style={{
      flex: 1, borderRadius: 18, padding: "14px 12px",
      background: isDarkMode ? "rgba(255,255,255,0.04)" : "#fff",
      border: `1px solid ${isDarkMode ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)"}`,
      display: "flex", flexDirection: "column", gap: 8, minWidth: 0,
    }}>
      {/* Icon container */}
      <div style={{
        width: 36, height: 36, borderRadius: 12,
        background: cfg.grad,
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: `0 4px 10px ${cfg.color}35`,
      }}>
        <Icon size={17} color="#fff" strokeWidth={2} />
      </div>
      <p style={{
        fontSize: 24, fontWeight: 900, lineHeight: 1,
        color: isDarkMode ? "#f1f5f9" : "#0f172a",
      }}>
        {count ?? "—"}
      </p>
      <p style={{
        fontSize: 11, fontWeight: 500,
        color: isDarkMode ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {label}
      </p>
    </div>
  );
});
StatBadge.displayName = "StatBadge";

// ─── FilterPill ───────────────────────────────────────────────────────────────
const FilterPill = memo(({ label, active, onClick, isDarkMode }) => (
  <button
    onClick={onClick}
    aria-pressed={active}
    style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "7px 14px", borderRadius: 99, border: "none", cursor: "pointer",
      fontSize: 13, fontWeight: 600, flexShrink: 0,
      transition: "all 0.15s",
      background: active
        ? "linear-gradient(135deg, #ea580c, #f97316)"
        : isDarkMode ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)",
      color: active
        ? "#fff"
        : isDarkMode ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.55)",
      boxShadow: active ? "0 2px 8px rgba(249,115,22,0.30)" : "none",
    }}
  >
    {label}
  </button>
));
FilterPill.displayName = "FilterPill";

// ─── Page principale ──────────────────────────────────────────────────────────
export default function OpportunitiesPage() {
  const { isDarkMode } = useDarkMode();

  const [filterType,     setFilterType]     = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [searchInput,    setSearchInput]    = useState("");
  const [search,         setSearch]         = useState("");

  const debounceRef = useRef(null);
  const handleSearchChange = useCallback((val) => {
    setSearchInput(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearch(val), 350);
  }, []);

  const { items, stats, loading, refreshing, hasMore, error, loadMore, refresh } =
    useOpportunities({ type: filterType, location: filterLocation, search });

  const sentinelRef = useRef(null);
  useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMore(); },
      { threshold: 0.1 }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [loadMore]);

  const lastSyncLabel = useMemo(() => {
    if (!stats?.lastSync) return null;
    return `Sync ${timeAgo(stats.lastSync)}`;
  }, [stats?.lastSync]);

  const clearFilters = useCallback(() => {
    setFilterType("");
    setFilterLocation("");
    setSearchInput("");
    setSearch("");
  }, []);

  const hasActiveFilters = filterType || filterLocation || search;

  const bg = isDarkMode ? "#0d0f12" : "#f6f7f9";
  const txt = isDarkMode ? "#f1f5f9" : "#0f172a";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: bg, color: txt }}>
      <div
        style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }}
        className="no-scrollbar"
      >
        <div style={{ maxWidth: 640, margin: "0 auto", padding: "20px 16px 96px" }}>

          {/* ── Header ───────────────────────────────────────────────────── */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#f97316", marginBottom: 2 }}>
                Chantilink
              </p>
              <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: "-0.02em", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{
                  width: 36, height: 36, borderRadius: 12,
                  background: "linear-gradient(135deg, #ea580c, #f97316)",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 4px 12px rgba(249,115,22,0.35)",
                  fontSize: 18,
                }} aria-hidden="true">💼</span>
                Opportunités
              </h1>
            </div>

            {/* Refresh */}
            <button
              onClick={refresh}
              disabled={refreshing}
              aria-label="Synchroniser les opportunités"
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "8px 14px", borderRadius: 12, border: "none", cursor: "pointer",
                background: isDarkMode ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)",
                color: isDarkMode ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.45)",
                fontSize: 12, fontWeight: 600,
              }}
            >
              <RefreshCw
                size={13}
                strokeWidth={2.2}
                style={{ animation: refreshing ? "spin 0.8s linear infinite" : "none" }}
              />
              {lastSyncLabel ?? "Sync"}
            </button>
          </div>

          {/* ── Stats ────────────────────────────────────────────────────── */}
          <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
            <StatBadge label="Emplois"      count={stats?.emploi}       type="emploi"      isDarkMode={isDarkMode} />
            <StatBadge label="Stages"       count={stats?.stage}        type="stage"       isDarkMode={isDarkMode} />
            <StatBadge label="Appels d'offres" count={stats?.appel_offre} type="appel_offre" isDarkMode={isDarkMode} />
          </div>

          {/* ── Recherche ────────────────────────────────────────────────── */}
          <div style={{ position: "relative", marginBottom: 12 }}>
            <Search size={15} aria-hidden="true" style={{
              position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
              color: isDarkMode ? "rgba(255,255,255,0.28)" : "rgba(0,0,0,0.28)",
              pointerEvents: "none",
            }} />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Ingénieur, conducteur, béton…"
              aria-label="Rechercher une opportunité"
              style={{
                width: "100%", boxSizing: "border-box",
                paddingLeft: 40, paddingRight: searchInput ? 38 : 14,
                paddingTop: 12, paddingBottom: 12,
                borderRadius: 14, fontSize: 14, outline: "none",
                background: isDarkMode ? "rgba(255,255,255,0.06)" : "#ffffff",
                border: `1px solid ${isDarkMode ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.08)"}`,
                color: txt,
              }}
            />
            {searchInput && (
              <button
                onClick={() => handleSearchChange("")}
                aria-label="Effacer la recherche"
                style={{
                  position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                  background: isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.07)",
                  border: "none", borderRadius: "50%", width: 20, height: 20,
                  display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                }}
              >
                <X size={11} style={{ color: isDarkMode ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.4)" }} />
              </button>
            )}
          </div>

          {/* ── Filtres type ─────────────────────────────────────────────── */}
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, marginBottom: 6 }} className="no-scrollbar" role="tablist" aria-label="Filtrer par type">
            <FilterPill label="Tout"              active={!filterType}                onClick={() => setFilterType("")}                             isDarkMode={isDarkMode} />
            <FilterPill label="💼 Emplois"        active={filterType === "emploi"}    onClick={() => setFilterType(filterType === "emploi"    ? "" : "emploi")}    isDarkMode={isDarkMode} />
            <FilterPill label="🎓 Stages"         active={filterType === "stage"}     onClick={() => setFilterType(filterType === "stage"     ? "" : "stage")}     isDarkMode={isDarkMode} />
            <FilterPill label="📋 Appels d'offres" active={filterType === "appel_offre"} onClick={() => setFilterType(filterType === "appel_offre" ? "" : "appel_offre")} isDarkMode={isDarkMode} />
          </div>

          {/* ── Filtres ville ─────────────────────────────────────────────── */}
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 12, marginBottom: 4 }} className="no-scrollbar" role="tablist" aria-label="Filtrer par ville">
            <FilterPill label="📍 Tout CI" active={!filterLocation} onClick={() => setFilterLocation("")} isDarkMode={isDarkMode} />
            {CITIES.map((city) => (
              <FilterPill key={city} label={city}
                active={filterLocation === city}
                onClick={() => setFilterLocation(filterLocation === city ? "" : city)}
                isDarkMode={isDarkMode}
              />
            ))}
          </div>

          {/* Reset */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              style={{
                display: "inline-flex", alignItems: "center", gap: 5, marginBottom: 12,
                background: "none", border: "none", cursor: "pointer",
                fontSize: 12, fontWeight: 700, color: "#f97316",
              }}
            >
              <X size={12} strokeWidth={2.5} />
              Effacer les filtres
            </button>
          )}

          {/* ── Erreur ───────────────────────────────────────────────────── */}
          {error && (
            <div style={{
              borderRadius: 16, padding: "14px 16px", marginBottom: 16, textAlign: "center",
              background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.18)",
            }}>
              <p style={{ fontSize: 14, color: "#ef4444", fontWeight: 500 }}>{error}</p>
              <button onClick={refresh} style={{ marginTop: 6, fontSize: 13, color: "#f87171", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                Réessayer
              </button>
            </div>
          )}

          {/* ── Skeleton loaders (première charge) ──────────────────────────── */}
          {loading && items.length === 0 && !error && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[1, 2, 3].map((i) => (
                <SkeletonCard key={i} isDarkMode={isDarkMode} />
              ))}
            </div>
          )}

          {/* ── Liste ────────────────────────────────────────────────────── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <AnimatePresence initial={false}>
              {items.map((opp) => (
                <OppCard key={opp._id} opp={opp} isDarkMode={isDarkMode} />
              ))}
            </AnimatePresence>
          </div>

          {/* Empty state */}
          {!loading && !error && items.length === 0 && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 0", gap: 10, textAlign: "center" }}>
              <div style={{
                width: 64, height: 64, borderRadius: 20,
                background: isDarkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28,
              }} aria-hidden="true">🏗️</div>
              <p style={{ fontSize: 16, fontWeight: 800, marginTop: 4 }}>Aucune opportunité</p>
              <p style={{ fontSize: 13, color: isDarkMode ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)" }}>
                Essaie d'autres filtres ou reviens plus tard.
              </p>
              {hasActiveFilters && (
                <button onClick={clearFilters} style={{ marginTop: 4, fontSize: 13, fontWeight: 700, color: "#f97316", background: "none", border: "none", cursor: "pointer" }}>
                  Effacer les filtres
                </button>
              )}
            </div>
          )}

          {/* Loader (pagination) */}
          {loading && items.length > 0 && (
            <div style={{ display: "flex", justifyContent: "center", padding: "20px 0" }}>
              <div style={{
                width: 24, height: 24, borderRadius: "50%",
                border: "2.5px solid rgba(249,115,22,0.25)",
                borderTopColor: "#f97316",
                animation: "spin 0.7s linear infinite",
              }} />
            </div>
          )}

          {hasMore && !loading && <div ref={sentinelRef} style={{ height: 32 }} />}

          {!hasMore && items.length > 0 && (
            <p style={{ textAlign: "center", fontSize: 12, padding: "20px 0", color: isDarkMode ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.25)" }}>
              {items.length} opportunité{items.length > 1 ? "s" : ""} chargée{items.length > 1 ? "s" : ""}
            </p>
          )}
        </div>
      </div>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes skeleton-pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}