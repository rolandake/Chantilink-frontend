// 📁 src/hooks/useNews.js
// Hook pour récupérer les actualités depuis l'API backend
// ✅ VERSION FINALE : Filtrage côté client + Debug

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const useNews = (options = {}) => {
  const {
    maxArticles = 20,
    category = 'all',
    autoFetch = true,
    enabled = true
  } = options;

  const { getToken, isAuthenticated } = useAuth();

  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchNews = useCallback(async () => {
    if (!enabled || !isAuthenticated) {
      setArticles([]);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);

    try {
      const token = await getToken();
      
      if (!token) {
        setArticles([]);
        setLoading(false);
        return;
      }

      // 🔍 Log pour debug
      console.log(`🔍 [useNews] Fetching category: "${category}"`);

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
        const fetchedArticles = response.data.articles || [];
        
        // 🔍 Log les données reçues
        console.log(`📥 [useNews] ${fetchedArticles.length} articles reçus`);
        
        // Afficher les catégories uniques reçues
        const categoriesReceived = [...new Set(fetchedArticles.map(a => a.category))];
        console.log(`📊 [useNews] Catégories reçues:`, categoriesReceived);

        // ✅ FILTRAGE CÔTÉ CLIENT (protection si backend ne filtre pas)
        let filteredArticles = fetchedArticles;
        
        if (category !== 'all') {
          const beforeFilter = fetchedArticles.length;
          
          // Filtrer uniquement les articles de la catégorie demandée
          filteredArticles = fetchedArticles.filter(article => {
            const matches = article.category === category;
            
            // Log les articles qui ne correspondent pas (debug)
            if (!matches) {
              console.warn(
                `⚠️ [useNews] Article ignoré - ` +
                `Attendu: "${category}", Reçu: "${article.category}" - ` +
                `"${article.title?.substring(0, 50)}..."`
              );
            }
            
            return matches;
          });

          const afterFilter = filteredArticles.length;
          
          // Si le filtrage côté client a supprimé des articles
          if (beforeFilter !== afterFilter) {
            console.error(
              `❌ [useNews] BACKEND NE FILTRE PAS CORRECTEMENT! ` +
              `${beforeFilter} reçus, ${afterFilter} correspondent à "${category}". ` +
              `Filtrage côté client appliqué.`
            );
          } else {
            console.log(`✅ [useNews] Backend filtre correctement`);
          }
        }

        console.log(`✅ [useNews] ${filteredArticles.length} articles finaux`);
        setArticles(filteredArticles);
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