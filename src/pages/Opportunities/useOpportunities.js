/**
 * useOpportunities.js — Hook extrait depuis OpportunitiesPage.jsx
 *
 * Corrections :
 *  - Au changement de filtre : vider les items (setItems([])) au lieu de
 *    remettre le cache non-filtré → évite le flash visuel "mauvais résultats"
 *  - Annulation propre de la requête en cours lors d'un changement de filtre
 *  - isFirstLoad géré correctement avec useRef pour éviter le double-fetch
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

export function useOpportunities({ type, location, search }) {
  // Au premier rendu : charger depuis le cache si dispo (sans filtre actif)
  const hasFilters = type || location || search;
  const [items,      setItems]      = useState(() => hasFilters ? [] : (getCached(CACHE_KEY) || []));
  const [stats,      setStats]      = useState(() => getCached(CACHE_STATS_KEY) || null);
  const [page,       setPage]       = useState(1);
  const [hasMore,    setHasMore]    = useState(true);
  const [loading,    setLoading]    = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState(null);

  const abortRef      = useRef(null);
  const isFirstLoad   = useRef(true);
  // Référence stable aux filtres pour le fetchPage
  const filtersRef    = useRef({ type, location, search });

  // Mettre à jour la ref à chaque rendu
  filtersRef.current = { type, location, search };

  const fetchStats = useCallback(async () => {
    try {
      const { data } = await axiosClient.get("/opportunities/stats");
      setStats(data);
      setCache(CACHE_STATS_KEY, data);
    } catch { /* stats non critiques */ }
  }, []);

  const fetchPage = useCallback(async (pageNum, append = false) => {
    // Annuler la requête précédente
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    setError(null);

    const attemptFetch = async (retries = 2) => {
      try {
        const { type: t, location: l, search: s } = filtersRef.current;
        const params = new URLSearchParams({ page: pageNum, limit: LIMIT });
        if (t) params.set("type", t);
        if (l) params.set("location", l);
        if (s) params.set("search", s);

        const { data } = await axiosClient.get(`/opportunities?${params}`, {
          signal: abortRef.current.signal,
        });

        setItems((prev) => {
          const newItems = append ? [...prev, ...data.opportunities] : data.opportunities;
          // Mettre en cache seulement si pas de filtre actif (cache = état "tout")
          const { type: ct, location: cl, search: cs } = filtersRef.current;
          if (!ct && !cl && !cs && !append) {
            setCache(CACHE_KEY, newItems);
          }
          return newItems;
        });
        setHasMore(data.pagination.hasMore);
      } catch (err) {
        if (err.name === "CanceledError" || err.code === "ERR_CANCELED") return;

        if (retries > 0) {
          await new Promise((r) => setTimeout(r, (3 - retries) * 1000));
          return attemptFetch(retries - 1);
        }

        setError("Impossible de charger les opportunités.");
        // Restaurer depuis le cache uniquement si pas de filtre et pas en pagination
        if (!append && !filtersRef.current.type && !filtersRef.current.location && !filtersRef.current.search) {
          const cached = getCached(CACHE_KEY);
          if (cached) setItems(cached);
        }
      } finally {
        setLoading(false);
      }
    };

    await attemptFetch();
  }, []); // pas de dépendances → stable, les filtres passent via filtersRef

  // ── Chargement initial ──────────────────────────────────────────────────────
  useEffect(() => {
    // Si cache dispo et pas de filtre actif → afficher cache et rafraîchir stats
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

  // ── Re-fetch quand les filtres changent ─────────────────────────────────────
  useEffect(() => {
    if (isFirstLoad.current) return; // Éviter le double-fetch au montage

    setPage(1);
    // ✅ Correction : toujours vider avant de fetcher avec un filtre
    //    (ne pas remettre le cache non-filtré)
    setItems([]);
    setHasMore(true);
    fetchPage(1, false);
  }, [type, location, search]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Infinite scroll ─────────────────────────────────────────────────────────
  const loadMore = useCallback(() => {
    if (!hasMore || loading) return;
    const next = page + 1;
    setPage(next);
    fetchPage(next, true);
  }, [hasMore, loading, page, fetchPage]);

  // ── Refresh manuel (force re-scraping + invalidation cache) ────────────────
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

  return { items, stats, loading, refreshing, hasMore, error, loadMore, refresh };
}