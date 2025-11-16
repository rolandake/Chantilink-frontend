// src/context/StoryContext.jsx - VERSION OPTIMISÉE POUR PERFORMANCE
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo
} from 'react';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';

const StoryContext = createContext();
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export function StoryProvider({ children }) {
  const { token, user } = useAuth();
  const { socket } = useSocket();

  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  const abortControllerRef = useRef(null);
  const fetchTimeoutRef = useRef(null);
  const lastFetchRef = useRef(0);
  const isFetchingRef = useRef(false);

  // ════════════════════════════════════════════════════════
  // 🔧 DEBUG LOGGING - AVEC DÉPENDANCES FIXES
  // ════════════════════════════════════════════════════════
  useEffect(() => {
    console.log('%c[StoryProvider] Mounted/Updated', 'color: #00ffff; font-weight: bold;', {
      token: !!token,
      userId: user?._id,
      storiesLength: stories.length,
      loading
    });
  }, [token, user?._id, stories.length, loading]); // ✅ Dépendances explicites

  // ════════════════════════════════════════════════════════
  // 🚀 FETCH STORIES - AVEC DEBOUNCE & DEDUPLICATION
  // ════════════════════════════════════════════════════════
  const fetchStories = useCallback(async (force = false) => {
    if (!token) return;

    // ✅ Éviter les appels simultanés
    if (isFetchingRef.current && !force) {
      console.log('%c[fetchStories] Already fetching, skipped', 'color: #ff9900;');
      return;
    }

    // ✅ Debounce : max 1 appel toutes les 2 secondes
    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchRef.current;
    if (timeSinceLastFetch < 2000 && !force) {
      console.log('%c[fetchStories] Debounced (too soon)', 'color: #ff9900;', {
        timeSinceLastFetch: `${timeSinceLastFetch}ms`
      });
      return;
    }

    console.log('%c[fetchStories] Starting...', 'color: #ffa500; font-weight: bold;', { force });

    // Annuler la précédente requête
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    isFetchingRef.current = true;
    lastFetchRef.current = now;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/api/story`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: abortControllerRef.current.signal
      });

      if (!res.ok) throw new Error('Failed to load stories');
      const data = await res.json();
      const newStories = data.stories ?? [];

      // ✅ Comparaison stricte pour éviter les re-renders inutiles
      setStories(prev => {
        const prevIds = prev.map(s => s._id).sort().join(',');
        const newIds = newStories.map(s => s._id).sort().join(',');
        const changed = prevIds !== newIds || JSON.stringify(prev) !== JSON.stringify(newStories);
        
        if (!changed) {
          console.log('%c[fetchStories] No changes detected', 'color: #00ff00;');
          return prev; // ✅ Retourner la même référence si pas de changement
        }
        
        console.log('%c[fetchStories] Stories updated', 'color: #00ff00;', {
          prevCount: prev.length,
          newCount: newStories.length
        });
        return newStories;
      });
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('[fetchStories] ❌ Error:', err.message);
        setError(err.message);
      }
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
    }
  }, [token]);

  // ════════════════════════════════════════════════════════
  // 📡 INITIAL FETCH - UNE SEULE FOIS
  // ════════════════════════════════════════════════════════
  useEffect(() => {
    if (token) {
      console.log('%c[StoryProvider] Initial fetch', 'color: #00ff88;');
      fetchStories(true);
    }
  }, [token]); // ✅ Seulement au changement de token

  // ════════════════════════════════════════════════════════
  // 🔌 SOCKET LISTENERS - OPTIMISÉS
  // ════════════════════════════════════════════════════════
  useEffect(() => {
    if (!socket || !token) return;

    console.log('%c[StoryProvider] Socket listeners setup', 'color: #ffd700;');

    const handlers = {
      newStory: () => {
        console.log('%c[Socket] New story event', 'color: #0f0;');
        // ✅ Debounced refresh
        clearTimeout(fetchTimeoutRef.current);
        fetchTimeoutRef.current = setTimeout(() => fetchStories(true), 500);
      },
      storyDeleted: data => {
        console.log('%c[Socket] Story deleted', 'color: #ff4444;', data);
        // ✅ Mise à jour locale immédiate (pas de refetch)
        setStories(prev => prev.filter(s => s._id !== data.storyId));
      },
      slideViewed: data => {
        console.log('%c[Socket] Slide viewed', 'color: #1e90ff;', data);
        // ✅ Mise à jour locale uniquement
        setStories(prev =>
          prev.map(s => {
            if (s._id === data.storyId && s.slides?.[data.slideIndex]) {
              const views = s.slides[data.slideIndex].views || [];
              if (!views.some(v => (typeof v === 'string' ? v : v._id) === data.userId)) {
                const updated = [...s.slides];
                updated[data.slideIndex] = {
                  ...updated[data.slideIndex],
                  views: [...views, data.userId]
                };
                return { ...s, slides: updated };
              }
            }
            return s;
          })
        );
      }
    };

    Object.entries(handlers).forEach(([event, handler]) => socket.on(event, handler));
    
    return () => {
      Object.entries(handlers).forEach(([event, handler]) => socket.off(event, handler));
      clearTimeout(fetchTimeoutRef.current);
    };
  }, [socket, token]); // ✅ fetchStories retiré des dépendances

  // ════════════════════════════════════════════════════════
  // 📤 CREATE STORY
  // ════════════════════════════════════════════════════════
  const createStory = useCallback(async formData => {
    console.log('%c[createStory] Uploading...', 'color: #ff00ff;');
    const res = await fetch(`${API_URL}/api/story`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    });
    if (!res.ok) throw new Error('Failed to create story');
    
    // ✅ Refetch après création avec un délai
    setTimeout(() => fetchStories(true), 500);
    return res.json();
  }, [token, fetchStories]);

  // ════════════════════════════════════════════════════════
  // 🗑️ DELETE STORY
  // ════════════════════════════════════════════════════════
  const deleteStory = useCallback(async id => {
    console.log('%c[deleteStory]', 'color: #ff2222;', id);
    await fetch(`${API_URL}/api/story/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    
    // ✅ Mise à jour locale immédiate
    setStories(prev => prev.filter(s => s._id !== id));
  }, [token]);

  // ════════════════════════════════════════════════════════
  // 👁️ VIEW SLIDE
  // ════════════════════════════════════════════════════════
  const viewSlide = useCallback(async (storyId, slideIndex) => {
    if (!token || !user) {
      console.warn('[viewSlide] ⚠️ Non authentifié');
      return;
    }

    try {
      console.log('%c[viewSlide] Marking as viewed', 'color: #00bfff;', { storyId, slideIndex });
      
      const res = await fetch(`${API_URL}/api/story/${storyId}/slides/${slideIndex}/view`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!res.ok) throw new Error('Failed to mark slide as viewed');

      const data = await res.json();
      console.log('%c[viewSlide] ✅ Success', 'color: #00ff00;', data);

      // ✅ Mise à jour locale si pas déjà vue
      if (!data.alreadyViewed) {
        setStories(prev => prev.map(story => {
          if (story._id === storyId && story.slides?.[slideIndex]) {
            const updatedSlides = [...story.slides];
            updatedSlides[slideIndex] = {
              ...updatedSlides[slideIndex],
              views: [...(updatedSlides[slideIndex].views || []), user._id]
            };
            return { ...story, slides: updatedSlides };
          }
          return story;
        }));
      }

      return data;
    } catch (err) {
      console.error('[viewSlide] ❌ Error:', err.message);
    }
  }, [token, user]);

  // ════════════════════════════════════════════════════════
  // 🗑️ DELETE SLIDE
  // ════════════════════════════════════════════════════════
  const deleteSlide = useCallback(async (storyId, slideIndex) => {
    if (!token) throw new Error('Non authentifié');

    try {
      console.log('%c[deleteSlide] Deleting...', 'color: #ff4444;', { storyId, slideIndex });
      
      const res = await fetch(`${API_URL}/api/story/${storyId}/slides/${slideIndex}`, {
        method: 'DELETE',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!res.ok) throw new Error('Failed to delete slide');

      const data = await res.json();
      console.log('%c[deleteSlide] ✅ Success', 'color: #00ff00;', data);

      // ✅ Mise à jour locale immédiate
      if (data.deleted) {
        setStories(prev => prev.filter(s => s._id !== storyId));
      } else {
        setStories(prev => prev.map(story => {
          if (story._id === storyId) {
            const updatedSlides = [...story.slides];
            updatedSlides.splice(slideIndex, 1);
            return { ...story, slides: updatedSlides };
          }
          return story;
        }));
      }

      return data;
    } catch (err) {
      console.error('[deleteSlide] ❌ Error:', err.message);
      throw err;
    }
  }, [token]);

  // ════════════════════════════════════════════════════════
  // 📊 GET ANALYTICS
  // ════════════════════════════════════════════════════════
  const getAnalytics = useCallback(async (storyId) => {
    if (!token) throw new Error('Non authentifié');

    try {
      console.log('%c[getAnalytics] Fetching...', 'color: #ffaa00;', storyId);
      
      const res = await fetch(`${API_URL}/api/story/${storyId}/analytics`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!res.ok) throw new Error('Failed to fetch analytics');

      const data = await res.json();
      console.log('%c[getAnalytics] ✅ Success', 'color: #00ff00;', data);

      return data;
    } catch (err) {
      console.error('[getAnalytics] ❌ Error:', err.message);
      throw err;
    }
  }, [token]);

  // ════════════════════════════════════════════════════════
  // 📦 MEMOIZED VALUE
  // ════════════════════════════════════════════════════════
  const value = useMemo(() => ({
    stories,
    loading,
    error,
    uploadProgress,
    setUploadProgress,
    fetchStories,
    createStory,
    deleteStory,
    viewSlide,
    deleteSlide,
    getAnalytics
  }), [
    stories, 
    loading, 
    error, 
    uploadProgress, 
    fetchStories, 
    createStory, 
    deleteStory, 
    viewSlide, 
    deleteSlide,
    getAnalytics
  ]);

  return <StoryContext.Provider value={value}>{children}</StoryContext.Provider>;
}

export const StoriesProvider = StoryProvider;

export const useStories = () => {
  const context = useContext(StoryContext);
  if (!context) throw new Error('useStories must be used within StoryProvider');
  return context;
};