// 📁 src/hooks/useNews.js
// Hook pour récupérer les actualités depuis l'API backend
// ✅ VERSION FINALE : Utilise AuthContext au lieu de localStorage

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext'; // ✅ Import du contexte

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const useNews = (options = {}) => {
  const {
    maxArticles = 20,
    category = 'all',
    autoFetch = true,
    enabled = true
  } = options;

  // ✅ Utiliser le contexte Auth pour obtenir le token
  const { getToken, isAuthenticated } = useAuth();

  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchNews = useCallback(async () => {
    // ✅ Ne pas charger si pas authentifié
    if (!enabled || !isAuthenticated) {
      setArticles([]);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);

    try {
      // ✅ Obtenir le token via AuthContext (gère automatiquement le refresh)
      const token = await getToken();
      
      if (!token) {
        setArticles([]);
        setLoading(false);
        return;
      }

      const response = await axios.get(`${API_URL}/news`, {
        params: {
          limit: maxArticles,
          category: category === 'all' ? undefined : category
        },
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (response.data.success) {
        console.log(`✅ [useNews] ${response.data.count} actualités chargées`);
        setArticles(response.data.articles || []);
      } else {
        throw new Error('Réponse invalide du serveur');
      }

    } catch (err) {
      console.error('❌ [useNews] Erreur:', err.message);
      setError(err.message);
      setArticles([]);
    } finally {
      setLoading(false);
    }
  }, [maxArticles, category, enabled, isAuthenticated, getToken]);

  const searchNews = useCallback(async (query) => {
    if (!enabled || !query || !isAuthenticated) return [];
    
    setLoading(true);
    setError(null);

    try {
      const token = await getToken();
      
      if (!token) {
        throw new Error('Non authentifié');
      }

      const response = await axios.get(`${API_URL}/news/search`, {
        params: {
          q: query,
          limit: 10
        },
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (response.data.success) {
        return response.data.articles || [];
      }
      return [];

    } catch (err) {
      console.error('❌ [useNews] Erreur recherche:', err.message);
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

      await axios.delete(`${API_URL}/news/cache`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      console.log('✅ [useNews] Cache vidé');
      await fetchNews();

    } catch (err) {
      console.error('❌ [useNews] Erreur vidage cache:', err.message);
    }
  }, [fetchNews, getToken]);

  useEffect(() => {
    if (autoFetch && enabled && isAuthenticated) {
      fetchNews();
    }
  }, [autoFetch, enabled, isAuthenticated, fetchNews]);

  return {
    articles,
    loading,
    error,
    fetchNews,
    searchNews,
    clearCache,
    refetch: fetchNews
  };
};

export default useNews;