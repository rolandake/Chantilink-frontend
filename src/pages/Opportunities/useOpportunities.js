/**
 * useOpportunities.js
 *
 * v2 — recherche robuste + tri orienté "récent"
 *  - sortBy passé au backend ("recent" | "expiring" | "relevance")
 *  - onlyNew : filtre offres < 7 jours (toggle UI)
 *  - debounce déjà géré côté page (search arrive stable ici)
 *  - cache localStorage uniquement pour la vue "Tout" sans filtre
 */

import { useState, useEffect, useCallback, useRef } from "react";
import axiosClient from "../../api/axiosClientGlobal";

const LIMIT = 20;
const CACHE_KEY = "chantilink_opportunities_cache";
const CACHE_STATS_KEY = "chantilink_opportunities_stats";
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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

export function useOpportunities({ type, location = "", search, sortBy = "recent", onlyNew = false }) {
  const hasFilters = type || search || onlyNew || sortBy !== "recent";

  const [items,      setItems]      = useState(() => hasFilters ? [] : (getCached(CACHE_KEY) || []));
  const [stats,      setStats]      = useState(() => getCached(CACHE_STATS_KEY) || null);
  const [page,       setPage]       = useState(1);
  const [hasMore,    setHasMore]    = useState(true);
  const [loading,    setLoading]    = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState(null);
  const [searchMode, setSearchMode] = useState("none"); // "text" | "regex" | "none"

  const abortRef    = useRef(null);
  const isFirstLoad = useRef(true);
  const filtersRef  = useRef({ type, location, search, sortBy, onlyNew });
  filtersRef.current = { type, location, search, sortBy, onlyNew };

  const fetchStats = useCallback(async () => {
    try {
      const { data } = await axiosClient.get("/opportunities/stats");
      setStats(data);
      setCache(CACHE_STATS_KEY, data);
    } catch { /* stats non critiques */ }
  }, []);

  const fetchPage = useCallback(async (pageNum, append = false) => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    setError(null);

    const attemptFetch = async (retries = 2) => {
      try {
        const { type: t, location: l, search: s, sortBy: sb, onlyNew: on } = filtersRef.current;
        const params = new URLSearchParams({ page: pageNum, limit: LIMIT, sort: sb || "recent" });
        if (t)  params.set("type", t);
        if (l)  params.set("location", l);
        if (s)  params.set("search", s);
        if (on) params.set("onlyNew", "true");

        const { data } = await axiosClient.get(`/opportunities?${params}`, {
          signal: abortRef.current.signal,
        });

        setItems((prev) => {
          const newItems = append ? [...prev, ...data.opportunities] : data.opportunities;
          const { type: ct, location: cl, search: cs, sortBy: csb, onlyNew: con } = filtersRef.current;
          const isDefaultView = !ct && !cs && !con && (csb || "recent") === "recent";
          if (isDefaultView && !append) {
            setCache(CACHE_KEY, newItems);
          }
          return newItems;
        });
        setHasMore(data.pagination.hasMore);
        setSearchMode(data.meta?.searchMode || "none");
      } catch (err) {
        if (err.name === "CanceledError" || err.code === "ERR_CANCELED") return;

        if (retries > 0) {
          await new Promise((r) => setTimeout(r, (3 - retries) * 1000));
          return attemptFetch(retries - 1);
        }

        setError("Impossible de charger les opportunités.");
        const { type: ct, search: cs, onlyNew: con } = filtersRef.current;
        if (!append && !ct && !cs && !con) {
          const cached = getCached(CACHE_KEY);
          if (cached) setItems(cached);
        }
      } finally {
        setLoading(false);
      }
    };

    await attemptFetch();
  }, []);

  // ── Chargement initial ──────────────────────────────────────────────────────
  useEffect(() => {
    if (isFirstLoad.current && !hasFilters && items.length > 0) {
      isFirstLoad.current = false;
      fetchStats();
      return;
    }
    isFirstLoad.current = false;
    setPage(1);
    fetchPage(1, false);
    fetchStats();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Re-fetch quand les filtres/tri/recherche changent ───────────────────────
  useEffect(() => {
    if (isFirstLoad.current) return;

    setPage(1);
    setItems([]);
    setHasMore(true);
    fetchPage(1, false);
  }, [type, search, sortBy, onlyNew]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Infinite scroll ─────────────────────────────────────────────────────────
  const loadMore = useCallback(() => {
    if (!hasMore || loading) return;
    const next = page + 1;
    setPage(next);
    fetchPage(next, true);
  }, [hasMore, loading, page, fetchPage]);

  // ── Refresh manuel ────────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    setRefreshing(true);
    try { await axiosClient.post("/opportunities/admin/sync"); } catch { /* ignore */ }
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_STATS_KEY);
    setPage(1);
    setItems([]);
    await fetchPage(1, false);
    await fetchStats();
    setRefreshing(false);
  }, [fetchPage, fetchStats]);

  return { items, stats, loading, refreshing, hasMore, error, searchMode, loadMore, refresh };
}