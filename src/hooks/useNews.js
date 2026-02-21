// 📁 src/hooks/useNews.js
// ✅ OPTIMISÉ LCP :
// - AbortController : annule les fetches en cours si le composant démonte
//   (évite setState sur composant démonté = React warning + travail inutile)
// - Suppression des console.log en production (ne bloque pas le thread au scroll)
// - Cache mémoire simple : si les articles ont déjà été fetchés pour cette catégorie,
//   on les retourne immédiatement sans refaire un fetch → pas de flash de contenu

import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const IS_DEV = import.meta.env.DEV;

// ✅ Cache mémoire — évite de refetcher si les articles sont déjà disponibles
// Clé : `${category}:${maxArticles}`, Valeur : articles[]
const newsCache = new Map();

const log = IS_DEV ? console.log.bind(console) : () => {};
const warn = IS_DEV ? console.warn.bind(console) : () => {};
const error = IS_DEV ? console.error.bind(console) : () => {};

export const useNews = (options = {}) => {
  const {
    maxArticles = 20,
    category = 'all',
    autoFetch = true,
    enabled = true
  } = options;

  const { getToken, isAuthenticated } = useAuth();

  const cacheKey = `${category}:${maxArticles}`;

  // ✅ Initialisation depuis le cache si disponible → zéro flash de contenu
  const [articles, setArticles] = useState(() => newsCache.get(cacheKey) || []);
  const [loading, setLoading] = useState(false);
  const [fetchError, setError] = useState(null);

  // ✅ AbortController ref — annule le fetch si le hook est démonté ou si les options changent
  const abortRef = useRef(null);

  const fetchNews = useCallback(async () => {
    if (!enabled || !isAuthenticated) {
      setArticles([]);
      setLoading(false);
      return;
    }

    // ✅ Si on a déjà les données en cache, on les retourne sans spinner
    const cached = newsCache.get(cacheKey);
    if (cached) {
      setArticles(cached);
      return;
    }

    // ✅ Annuler le fetch précédent si encore en cours
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) { setArticles([]); setLoading(false); return; }

      log(`🔍 [useNews] Fetching category: "${category}"`);

      const response = await axios.get(`${API_URL}/news`, {
        params: {
          limit: maxArticles,
          category: category === 'all' ? undefined : category
        },
        headers: { Authorization: `Bearer ${token}` },
        signal: abortRef.current.signal, // ✅ fetch annulable
      });

      if (response.data.success) {
        const fetchedArticles = response.data.articles || [];
        log(`📥 [useNews] ${fetchedArticles.length} articles reçus`);

        let filteredArticles = fetchedArticles;
        if (category !== 'all') {
          const before = fetchedArticles.length;
          filteredArticles = fetchedArticles.filter(a => a.category === category);
          const after = filteredArticles.length;
          if (before !== after) {
            error(`❌ [useNews] Backend ne filtre pas correctement: ${before}→${after} pour "${category}"`);
          }
        }

        // ✅ Mise en cache
        newsCache.set(cacheKey, filteredArticles);
        setArticles(filteredArticles);
        log(`✅ [useNews] ${filteredArticles.length} articles finaux`);
      } else {
        throw new Error('Réponse invalide du serveur');
      }
    } catch (err) {
      // ✅ Ignorer les erreurs d'annulation (AbortError) — pas une vraie erreur
      if (axios.isCancel(err) || err.name === 'AbortError' || err.name === 'CanceledError') return;
      error('❌ [useNews] Erreur:', err.message);
      setError(err.message);
      setArticles([]);
    } finally {
      setLoading(false);
    }
  }, [maxArticles, category, enabled, isAuthenticated, getToken, cacheKey]);

  const searchNews = useCallback(async (query) => {
    if (!enabled || !query || !isAuthenticated) return [];
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error('Non authentifié');
      const response = await axios.get(`${API_URL}/news/search`, {
        params: { q: query, limit: 10 },
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data.success ? (response.data.articles || []) : [];
    } catch (err) {
      error('❌ [useNews] Erreur recherche:', err.message);
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, [enabled, isAuthenticated, getToken]);

  const clearCache = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      await axios.delete(`${API_URL}/news/cache`, { headers: { Authorization: `Bearer ${token}` } });
      newsCache.delete(cacheKey);
      log('✅ [useNews] Cache vidé');
      await fetchNews();
    } catch (err) {
      error('❌ [useNews] Erreur vidage cache:', err.message);
    }
  }, [fetchNews, getToken, cacheKey]);

  useEffect(() => {
    if (autoFetch && enabled && isAuthenticated) fetchNews();
    // ✅ Cleanup : annuler le fetch si le composant démonte
    return () => { if (abortRef.current) abortRef.current.abort(); };
  }, [autoFetch, enabled, isAuthenticated, fetchNews]);

  return {
    articles,
    loading,
    error: fetchError,
    fetchNews,
    searchNews,
    clearCache,
    refetch: fetchNews
  };
};

export default useNews;