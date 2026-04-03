// ==========================================
// 📁 src/components/SearchPanel.jsx
// 🔍 Recherche avancée style réseau social :
//    ✅ Historique persistant (localStorage) + effaçable
//    ✅ Mots-clés → recherche par bio, username, fullName
//    ✅ Recherche instantanée avec debounce 280ms
//    ✅ Suggestions tendances
//    ✅ Catégories filtrables (Tous / Vérifiés / Bots)
//    ✅ Desktop drawer | Mobile bottom sheet (via SidePanel parent)
// ==========================================
import React, {
  useState, useEffect, useCallback, useRef, useMemo, memo,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, X, Clock, TrendingUp, Trash2, Loader2,
  CheckCircle2, Bot, Users, Star, ArrowUpRight,
} from "lucide-react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const SERVER_URL = API_URL.replace("/api", "");
const MEDIA_URL = (path) =>
  path?.startsWith("http") ? path : `${SERVER_URL}/${path?.replace(/^\/+/, "")}`;

// ── Persistance historique ────────────────────────────────────────────────────
const HISTORY_KEY = "chantilink_search_history_v2";
const MAX_HISTORY = 15;

const loadHistory = () => {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveHistory = (history) => {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {}
};

// ── Suggestions tendances (statiques, à remplacer par un vrai endpoint) ───────
const TRENDING = [
  { id: "t1", label: "Développeurs", icon: "💻" },
  { id: "t2", label: "Designers",    icon: "🎨" },
  { id: "t3", label: "Chantilink",   icon: "🔥" },
  { id: "t4", label: "Vérifiés",     icon: "✅" },
  { id: "t5", label: "Nouveaux",     icon: "✨" },
];

// ── Catégories de filtre ──────────────────────────────────────────────────────
const FILTERS = [
  { id: "all",      label: "Tous",      Icon: Users },
  { id: "verified", label: "Vérifiés",  Icon: CheckCircle2 },
  { id: "bot",      label: "Bots",      Icon: Bot },
  { id: "premium",  label: "Premium",   Icon: Star },
];

// ── Avatar ────────────────────────────────────────────────────────────────────
const Avatar = memo(({ user, size = 48 }) => {
  const [err, setErr] = useState(false);
  const src = MEDIA_URL(user?.profilePhoto || user?.avatar || user?.profilePicture);
  const letter = (user?.fullName?.[0] || user?.username?.[0] || "U").toUpperCase();
  return (
    <div
      style={{
        width: size, height: size, borderRadius: "50%", overflow: "hidden", flexShrink: 0,
        boxShadow: "0 0 0 1.5px rgba(249,115,22,0.3)",
      }}>
      {src && !err ? (
        <img src={src} alt={user?.fullName || "user"} onError={() => setErr(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <div style={{
          width: "100%", height: "100%",
          background: "linear-gradient(135deg, #f97316, #ec4899)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontWeight: 700, fontSize: size * 0.35,
        }}>{letter}</div>
      )}
    </div>
  );
});
Avatar.displayName = "Avatar";

// ── Surlignage du terme recherché dans le texte ───────────────────────────────
const Highlight = memo(({ text = "", query = "", isDarkMode }) => {
  if (!query.trim() || !text) return <span>{text}</span>;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} style={{
            background: "linear-gradient(135deg, rgba(249,115,22,0.3), rgba(236,72,153,0.3))",
            color: isDarkMode ? "#fed7aa" : "#c2410c",
            borderRadius: 3, padding: "0 2px",
          }}>{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
});
Highlight.displayName = "Highlight";

// ── Carte résultat ────────────────────────────────────────────────────────────
const ResultCard = memo(({ profile, query, onClick, isDarkMode, index }) => {
  const badges = [];
  if (profile.isVerified) badges.push({ label: "Vérifié",  color: "#3b82f6", icon: "✓" });
  if (profile.isPremium)  badges.push({ label: "Premium",  color: "#f59e0b", icon: "★" });
  if (profile.isBot || profile.isAutoCreated) badges.push({ label: "Bot", color: "#8b5cf6", icon: "⚡" });

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.18, delay: index * 0.04 }}
      onClick={() => onClick(profile)}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "12px 20px", cursor: "pointer",
        borderBottom: `1px solid ${isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"}`,
        transition: "background 0.15s",
      }}
      whileHover={{ backgroundColor: isDarkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.025)" }}
    >
      <Avatar user={profile} size={46} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span style={{
            fontWeight: 600, fontSize: 14,
            color: isDarkMode ? "#f1f5f9" : "#111827",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            <Highlight text={profile.fullName || profile.username} query={query} isDarkMode={isDarkMode} />
          </span>
          {badges.map(b => (
            <span key={b.label} style={{
              fontSize: 10, fontWeight: 700, padding: "1px 6px",
              borderRadius: 20, color: "#fff",
              background: b.color, flexShrink: 0,
            }}>{b.icon} {b.label}</span>
          ))}
        </div>

        {profile.username && profile.fullName && (
          <p style={{ fontSize: 12, color: "#9ca3af", margin: "1px 0 0" }}>
            @<Highlight text={profile.username} query={query} isDarkMode={isDarkMode} />
          </p>
        )}
        {profile.bio && (
          <p style={{
            fontSize: 12, marginTop: 3,
            color: isDarkMode ? "#64748b" : "#6b7280",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            <Highlight text={profile.bio} query={query} isDarkMode={isDarkMode} />
          </p>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          {[
            profile.followers?.length > 0 && `${fmtNum(profile.followers.length)} abonnés`,
            profile.following?.length > 0 && `${fmtNum(profile.following.length)} abonnements`,
          ].filter(Boolean).map((stat, i) => (
            <span key={i} style={{ fontSize: 11, color: "#9ca3af" }}>{stat}</span>
          ))}
        </div>
      </div>

      <div style={{
        flexShrink: 0, width: 32, height: 32, borderRadius: "50%",
        background: "linear-gradient(135deg, #f97316, #ec4899)",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "#fff",
      }}>
        <ArrowUpRight size={15} />
      </div>
    </motion.div>
  );
});
ResultCard.displayName = "ResultCard";

const fmtNum = (n = 0) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
};

// ── Entrée historique ─────────────────────────────────────────────────────────
const HistoryItem = memo(({ item, onSelect, onRemove, isDarkMode }) => (
  <div style={{
    display: "flex", alignItems: "center", gap: 10,
    padding: "10px 20px",
    borderBottom: `1px solid ${isDarkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"}`,
  }}>
    <Clock size={14} style={{ color: "#9ca3af", flexShrink: 0 }} />
    <button
      onClick={() => onSelect(item.query)}
      style={{
        flex: 1, textAlign: "left", background: "none", border: "none",
        cursor: "pointer", fontSize: 14, fontWeight: 500,
        color: isDarkMode ? "#e2e8f0" : "#374151",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
      {item.query}
    </button>
    <span style={{ fontSize: 11, color: "#9ca3af", flexShrink: 0 }}>
      {item.count > 1 ? `×${item.count}` : ""}
    </span>
    <button
      onClick={() => onRemove(item.query)}
      style={{
        background: "none", border: "none", cursor: "pointer",
        padding: 4, color: "#9ca3af", display: "flex", alignItems: "center",
        borderRadius: 6, flexShrink: 0,
        transition: "color 0.15s",
      }}
      onMouseEnter={e => e.currentTarget.style.color = "#ef4444"}
      onMouseLeave={e => e.currentTarget.style.color = "#9ca3af"}>
      <X size={13} />
    </button>
  </div>
));
HistoryItem.displayName = "HistoryItem";

// ── Section titre ─────────────────────────────────────────────────────────────
const SectionLabel = memo(({ label, action, isDarkMode }) => (
  <div style={{
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "12px 20px 8px",
    background: isDarkMode ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.015)",
  }}>
    <span style={{
      fontSize: 11, fontWeight: 700, textTransform: "uppercase",
      letterSpacing: "0.1em", color: "#9ca3af",
    }}>{label}</span>
    {action}
  </div>
));
SectionLabel.displayName = "SectionLabel";

// ═════════════════════════════════════════════════════════════════════════════
// SEARCH PANEL PRINCIPAL
// ═════════════════════════════════════════════════════════════════════════════
const SearchPanel = memo(({ isOpen, onClose, isDarkMode, onNavigate }) => {
  const { activeUserId, getToken } = useAuth();

  const [query,       setQuery]       = useState("");
  const [results,     setResults]     = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [activeFilter,setActiveFilter]= useState("all");
  const [history,     setHistory]     = useState([]);

  const inputRef   = useRef(null);
  const abortRef   = useRef(null);
  const timeoutRef = useRef(null);

  // Charger l'historique au montage
  useEffect(() => { setHistory(loadHistory()); }, []);

  // Focus + reset à l'ouverture
  useEffect(() => {
    if (isOpen) {
      setQuery(""); setResults([]); setHasSearched(false); setActiveFilter("all");
      setHistory(loadHistory());
      setTimeout(() => inputRef.current?.focus(), 160);
    }
  }, [isOpen]);

  // ── Enregistrer dans l'historique ─────────────────────────────────────────
  const pushHistory = useCallback((q) => {
    if (!q.trim() || q.trim().length < 2) return;
    setHistory(prev => {
      const cleaned = q.trim();
      const existing = prev.find(h => h.query.toLowerCase() === cleaned.toLowerCase());
      let updated;
      if (existing) {
        updated = [
          { ...existing, count: existing.count + 1, ts: Date.now() },
          ...prev.filter(h => h.query.toLowerCase() !== cleaned.toLowerCase()),
        ];
      } else {
        updated = [{ query: cleaned, count: 1, ts: Date.now() }, ...prev];
      }
      updated = updated.slice(0, MAX_HISTORY);
      saveHistory(updated);
      return updated;
    });
  }, []);

  // ── Supprimer une entrée de l'historique ──────────────────────────────────
  const removeHistoryItem = useCallback((q) => {
    setHistory(prev => {
      const updated = prev.filter(h => h.query !== q);
      saveHistory(updated);
      return updated;
    });
  }, []);

  // ── Vider tout l'historique ───────────────────────────────────────────────
  const clearHistory = useCallback(() => {
    setHistory([]);
    saveHistory([]);
  }, []);

  // ── Recherche réseau ──────────────────────────────────────────────────────
  // Recherche par : fullName, username, bio (mots-clés fragmentés)
  // Si plusieurs mots, on recherche chaque mot séparément et on fusionne.
  const doSearch = useCallback(async (q) => {
    const trimmed = q.trim();
    if (!trimmed || trimmed.length < 2) {
      setResults([]); setHasSearched(false); return;
    }

    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    setLoading(true); setHasSearched(true);

    try {
      const token = await getToken(activeUserId);
      if (!token) { setLoading(false); return; }

      const headers = { Authorization: `Bearer ${token}` };
      const signal  = abortRef.current.signal;

      // Si la query contient plusieurs mots, on lance une recherche par mot-clé
      // en plus de la requête globale, pour maximiser les résultats.
      const words = trimmed.split(/\s+/).filter(w => w.length >= 2);
      const queries = [trimmed, ...words.filter(w => w !== trimmed)].slice(0, 3);

      const responses = await Promise.allSettled(
        queries.map(q =>
          axios.get(`${API_URL}/users/search?q=${encodeURIComponent(q)}`, { headers, signal })
        )
      );

      // Fusion + déduplification par _id
      const seen = new Set();
      const merged = [];
      for (const r of responses) {
        if (r.status === "fulfilled") {
          const users = r.value.data?.users || r.value.data?.data || [];
          for (const u of users) {
            if (!seen.has(u._id)) { seen.add(u._id); merged.push(u); }
          }
        }
      }

      setResults(merged);
    } catch (err) {
      if (err.name !== "CanceledError" && err.code !== "ERR_CANCELED") {
        setResults([]);
      }
    } finally {
      setLoading(false);
    }
  }, [activeUserId, getToken]);

  // ── Gestion input ─────────────────────────────────────────────────────────
  const handleChange = useCallback((e) => {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(timeoutRef.current);
    if (!val.trim()) {
      setResults([]); setHasSearched(false); return;
    }
    timeoutRef.current = setTimeout(() => doSearch(val), 280);
  }, [doSearch]);

  const handleClear = useCallback(() => {
    setQuery(""); setResults([]); setHasSearched(false);
    inputRef.current?.focus();
  }, []);

  const handleSelectHistory = useCallback((q) => {
    setQuery(q);
    doSearch(q);
  }, [doSearch]);

  const handleSubmit = useCallback((e) => {
    e?.preventDefault();
    if (query.trim().length >= 2) {
      pushHistory(query);
      doSearch(query);
    }
  }, [query, doSearch, pushHistory]);

  // Enregistrer dans l'historique quand on clique sur un résultat
  const handleResultClick = useCallback((profile) => {
    pushHistory(query);
    onNavigate(`/profile/${profile._id}`);
    onClose();
  }, [query, pushHistory, onNavigate, onClose]);

  // ── Filtre local sur les résultats ────────────────────────────────────────
  const filteredResults = useMemo(() => {
    if (activeFilter === "all")      return results;
    if (activeFilter === "verified") return results.filter(u => u.isVerified);
    if (activeFilter === "bot")      return results.filter(u => u.isBot || u.isAutoCreated);
    if (activeFilter === "premium")  return results.filter(u => u.isPremium);
    return results;
  }, [results, activeFilter]);

  const showHistory  = !query.trim() && history.length > 0;
  const showTrending = !query.trim() && history.length === 0;
  const showEmpty    = hasSearched && !loading && filteredResults.length === 0 && query.trim();
  const showFilters  = results.length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>

      {/* ── Barre de recherche ── */}
      <div style={{
        padding: "12px 16px",
        borderBottom: `1px solid ${isDarkMode ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)"}`,
        background: isDarkMode ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.8)",
        backdropFilter: "blur(12px)",
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <form onSubmit={handleSubmit}>
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            background: isDarkMode ? "rgba(255,255,255,0.07)" : "#f3f4f6",
            borderRadius: 14, padding: "10px 14px",
            border: query.trim()
              ? "1.5px solid rgba(249,115,22,0.5)"
              : `1.5px solid ${isDarkMode ? "rgba(255,255,255,0.08)" : "transparent"}`,
            transition: "border-color 0.2s",
          }}>
            {loading
              ? <Loader2 size={16} style={{ color: "#f97316", flexShrink: 0, animation: "spin 1s linear infinite" }} />
              : <Search size={16} style={{ color: "#9ca3af", flexShrink: 0 }} />
            }
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={handleChange}
              onKeyDown={e => e.key === "Enter" && handleSubmit()}
              placeholder="Nom, pseudo, bio, mot-clé…"
              style={{
                flex: 1, background: "none", border: "none", outline: "none",
                fontSize: 14, color: isDarkMode ? "#f1f5f9" : "#111827",
              }}
            />
            <AnimatePresence>
              {query && (
                <motion.button
                  type="button"
                  onClick={handleClear}
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.6 }}
                  style={{
                    background: isDarkMode ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)",
                    border: "none", cursor: "pointer", borderRadius: "50%",
                    width: 20, height: 20, display: "flex", alignItems: "center",
                    justifyContent: "center", flexShrink: 0,
                    color: isDarkMode ? "#94a3b8" : "#6b7280",
                  }}>
                  <X size={11} />
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </form>

        {/* ── Filtres (affiché quand il y a des résultats) ── */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              style={{ overflow: "hidden" }}>
              <div style={{ display: "flex", gap: 6, marginTop: 10, overflowX: "auto", paddingBottom: 2 }}>
                {FILTERS.map(({ id, label, Icon }) => {
                  const active = activeFilter === id;
                  const count = id === "all" ? results.length
                    : id === "verified" ? results.filter(u => u.isVerified).length
                    : id === "bot"      ? results.filter(u => u.isBot || u.isAutoCreated).length
                    : results.filter(u => u.isPremium).length;
                  if (id !== "all" && count === 0) return null;
                  return (
                    <button
                      key={id}
                      onClick={() => setActiveFilter(id)}
                      style={{
                        display: "flex", alignItems: "center", gap: 5,
                        padding: "5px 12px", borderRadius: 20, border: "none",
                        cursor: "pointer", fontSize: 12, fontWeight: 600,
                        flexShrink: 0, transition: "all 0.15s",
                        background: active
                          ? "linear-gradient(135deg, #f97316, #ec4899)"
                          : isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
                        color: active ? "#fff" : isDarkMode ? "#94a3b8" : "#6b7280",
                      }}>
                      <Icon size={12} />
                      {label}
                      {count > 0 && (
                        <span style={{
                          background: active ? "rgba(255,255,255,0.25)" : "rgba(249,115,22,0.2)",
                          color: active ? "#fff" : "#f97316",
                          borderRadius: 10, fontSize: 10, fontWeight: 700,
                          padding: "0 5px", minWidth: 16, textAlign: "center",
                        }}>{count}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Contenu scrollable ── */}
      <div style={{ flex: 1, overflowY: "auto", overscrollBehavior: "contain" }}>

        {/* ── HISTORIQUE ── */}
        {showHistory && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <SectionLabel
              label="Recherches récentes"
              isDarkMode={isDarkMode}
              action={
                <button
                  onClick={clearHistory}
                  style={{
                    display: "flex", alignItems: "center", gap: 5,
                    background: "none", border: "none", cursor: "pointer",
                    fontSize: 12, color: "#f97316", fontWeight: 600,
                    padding: "3px 8px", borderRadius: 8,
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(249,115,22,0.1)"}
                  onMouseLeave={e => e.currentTarget.style.background = "none"}>
                  <Trash2 size={12} />
                  Tout effacer
                </button>
              }
            />
            <AnimatePresence initial={false}>
              {history.map(item => (
                <motion.div key={item.query}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12, height: 0 }}
                  transition={{ duration: 0.15 }}>
                  <HistoryItem
                    item={item}
                    onSelect={handleSelectHistory}
                    onRemove={removeHistoryItem}
                    isDarkMode={isDarkMode}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}

        {/* ── TENDANCES (si aucun historique) ── */}
        {showTrending && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <SectionLabel label="Tendances" isDarkMode={isDarkMode} />
            <div style={{ padding: "8px 16px", display: "flex", flexWrap: "wrap", gap: 8 }}>
              {TRENDING.map(t => (
                <button
                  key={t.id}
                  onClick={() => { setQuery(t.label); doSearch(t.label); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "8px 14px", borderRadius: 20, border: "none",
                    cursor: "pointer", fontSize: 13, fontWeight: 600,
                    background: isDarkMode ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)",
                    color: isDarkMode ? "#e2e8f0" : "#374151",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = "linear-gradient(135deg, rgba(249,115,22,0.15), rgba(236,72,153,0.15))";
                    e.currentTarget.style.color = "#f97316";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = isDarkMode ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)";
                    e.currentTarget.style.color = isDarkMode ? "#e2e8f0" : "#374151";
                  }}>
                  <TrendingUp size={13} style={{ color: "#f97316" }} />
                  {t.icon} {t.label}
                </button>
              ))}
            </div>

            {/* Astuce */}
            <div style={{ padding: "16px 20px" }}>
              <div style={{
                padding: "12px 16px", borderRadius: 12,
                background: isDarkMode
                  ? "linear-gradient(135deg, rgba(249,115,22,0.08), rgba(236,72,153,0.06))"
                  : "linear-gradient(135deg, rgba(249,115,22,0.06), rgba(236,72,153,0.04))",
                border: "1px solid rgba(249,115,22,0.15)",
              }}>
                <p style={{ fontSize: 12, color: isDarkMode ? "#fb923c" : "#ea580c", fontWeight: 600, marginBottom: 4 }}>
                  💡 Astuce
                </p>
                <p style={{ fontSize: 12, color: isDarkMode ? "#94a3b8" : "#6b7280", lineHeight: 1.5 }}>
                  Recherchez par nom, pseudonyme ou mots-clés de la bio.
                  Plusieurs mots affinent les résultats.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── RÉSULTATS ── */}
        {hasSearched && !loading && filteredResults.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <SectionLabel
              label={`${filteredResults.length} résultat${filteredResults.length > 1 ? "s" : ""}`}
              isDarkMode={isDarkMode}
            />
            <AnimatePresence mode="popLayout" initial={false}>
              {filteredResults.map((profile, i) => (
                <ResultCard
                  key={profile._id}
                  profile={profile}
                  query={query}
                  onClick={handleResultClick}
                  isDarkMode={isDarkMode}
                  index={i}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}

        {/* ── ÉTAT VIDE ── */}
        {showEmpty && (
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            style={{ display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", padding: "60px 32px", textAlign: "center" }}>
            <div style={{
              width: 72, height: 72, borderRadius: 20,
              background: isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 32, marginBottom: 16,
            }}>🔍</div>
            <p style={{ fontSize: 15, fontWeight: 700,
              color: isDarkMode ? "#e2e8f0" : "#111827", marginBottom: 6 }}>
              Aucun résultat
            </p>
            <p style={{ fontSize: 13, color: "#9ca3af", lineHeight: 1.6, maxWidth: 240 }}>
              Aucun utilisateur ne correspond à <strong style={{ color: "#f97316" }}>"{query}"</strong>.
              Essayez un autre terme ou vérifiez l'orthographe.
            </p>
          </motion.div>
        )}

        {/* ── SKELETON pendant chargement ── */}
        {loading && (
          <div style={{ padding: "8px 0" }}>
            {[0, 1, 2, 3].map(i => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "12px 20px",
                borderBottom: `1px solid ${isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"}`,
              }}>
                <div style={{
                  width: 46, height: 46, borderRadius: "50%", flexShrink: 0,
                  background: isDarkMode ? "rgba(255,255,255,0.07)" : "#e5e7eb",
                  animation: "pulse 1.5s ease-in-out infinite",
                  animationDelay: `${i * 0.1}s`,
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{
                    height: 13, width: "55%", borderRadius: 6, marginBottom: 7,
                    background: isDarkMode ? "rgba(255,255,255,0.07)" : "#e5e7eb",
                    animation: "pulse 1.5s ease-in-out infinite",
                    animationDelay: `${i * 0.1 + 0.05}s`,
                  }} />
                  <div style={{
                    height: 11, width: "35%", borderRadius: 6,
                    background: isDarkMode ? "rgba(255,255,255,0.05)" : "#f3f4f6",
                    animation: "pulse 1.5s ease-in-out infinite",
                    animationDelay: `${i * 0.1 + 0.1}s`,
                  }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:.5} 50%{opacity:1} }
      `}</style>
    </div>
  );
});
SearchPanel.displayName = "SearchPanel";

export default SearchPanel;