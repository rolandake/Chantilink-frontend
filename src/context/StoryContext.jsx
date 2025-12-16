// src/context/StoryContext.jsx - VERSION CORRIGÉE
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo
} from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';
// ❌ SUPPRIMÉ : import { useSocket } from './SocketContext';

const StoryContext = createContext(null);
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export function StoryProvider({ children }) {
  // ✅ CORRECTION : Récupérer socket directement depuis AuthContext
  const { token, user, socket } = useAuth();
  // ❌ SUPPRIMÉ : const { socket } = useSocket();

  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const abortControllerRef = useRef(null);
  const viewingRef = useRef(new Set());
  const isFetchingRef = useRef(false);

  // ✅ Fonction fetchStories avec meilleure gestion d'erreurs
  const fetchStories = useCallback(async (force = false) => {
    if (!token) {
      setStories([]);
      setLoading(false);
      return;
    }

    if (isFetchingRef.current && !force) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    isFetchingRef.current = true;
    if (force) setLoading(true);

    try {
      console.log('📡 [Story] Fetching from:', `${API_URL}/story/feed`);
      
      const response = await axios.get(`${API_URL}/story/feed`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: abortControllerRef.current.signal
      });

      console.log('✅ [Story] Response:', response.data);

      // ✅ Gérer les deux formats possibles de réponse
      let newStories;
      if (Array.isArray(response.data)) {
        newStories = response.data;
      } else if (response.data.stories && Array.isArray(response.data.stories)) {
        newStories = response.data.stories;
      } else {
        console.warn('⚠️ [Story] Format de réponse inattendu:', response.data);
        newStories = [];
      }
      
      console.log(`✅ [Story] ${newStories.length} stories chargées`);
      setStories(newStories);
      setError(null);
      
    } catch (err) {
      if (axios.isCancel(err)) {
        console.log('🛑 [Story] Fetch annulé');
      } else {
        console.error('❌ [Story] Fetch Error:', err);
        console.error('❌ [Story] Error details:', {
          message: err.message,
          response: err.response?.data,
          status: err.response?.status,
          url: err.config?.url
        });
        
        if (force) setError(err.message);
      }
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
    }
  }, [token]);

  // ✅ Charger les stories au montage
  useEffect(() => {
    if (token) {
      fetchStories(true);
    } else {
      setStories([]);
      setLoading(false);
    }
  }, [token, fetchStories]);

  // ✅ Gestion des événements Socket
  useEffect(() => {
    if (!socket || !token) return;

    const handleNewStory = () => {
      console.log('⚡ [Socket] Nouvelle story reçue');
      fetchStories(false);
    };

    const handleStoryDeleted = ({ storyId }) => {
      if (storyId) {
        console.log('⚡ [Socket] Story supprimée:', storyId);
        setStories(prev => prev.filter(s => s._id !== storyId));
      }
    };

    const handleSlideViewed = ({ storyId, slideIndex, userId }) => {
      if (!storyId || slideIndex === undefined || !userId) return;
      
      const viewerId = typeof userId === 'object' ? userId._id : userId;

      setStories(prev => prev.map(story => {
        if (story._id !== storyId) return story;

        const slides = [...(story.slides || [])];
        const slide = slides[slideIndex];

        if (!slide || slide.views?.some(v => (typeof v === 'object' ? v._id : v) === viewerId)) {
          return story;
        }

        slides[slideIndex] = {
          ...slide,
          views: [...(slide.views || []), viewerId]
        };

        return { ...story, slides };
      }));
    };

    socket.on('newStory', handleNewStory);
    socket.on('storyDeleted', handleStoryDeleted);
    socket.on('slideViewed', handleSlideViewed);

    return () => {
      socket.off('newStory', handleNewStory);
      socket.off('storyDeleted', handleStoryDeleted);
      socket.off('slideViewed', handleSlideViewed);
    };
  }, [socket, token, fetchStories]);

  // ✅ Créer une story
  const createStory = useCallback(async (formData) => {
    if (!token) throw new Error("Vous n'êtes pas connecté");

    console.log("📤 [Story] Envoi vers:", `${API_URL}/story`);
    console.log("📤 [Story] Données FormData :");
    for (let [key, value] of formData.entries()) {
      console.log(`   - ${key}:`, value instanceof File ? `Fichier: ${value.name} (${value.size} octets)` : value);
    }

    try {
      setUploadProgress(0);
      
      const response = await axios.post(`${API_URL}/story`, formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percent);
            console.log(`📊 [Story] Upload: ${percent}%`);
          }
        }
      });
      
      console.log("✅ [Story] Création réussie :", response.data);
      
      await fetchStories(true);
      setUploadProgress(0);
      return response.data;

    } catch (err) {
      setUploadProgress(0);

      console.error("❌ [Story] Erreur création");
      console.error("   Message:", err.message);
      console.error("   Response:", err.response?.data);
      console.error("   Status:", err.response?.status);

      if (err.response) {
        const serverMessage = err.response.data.message 
          || err.response.data.error 
          || JSON.stringify(err.response.data);
        throw new Error(serverMessage);
      } else if (err.request) {
        throw new Error("Le serveur ne répond pas. Vérifiez votre connexion.");
      } else {
        throw new Error(err.message);
      }
    }
  }, [token, fetchStories]);

  // ✅ Supprimer une story
  const deleteStory = useCallback(async (storyId) => {
    if (!token) return;
    
    const oldStories = [...stories];
    setStories(prev => prev.filter(s => s._id !== storyId));

    try {
      await axios.delete(`${API_URL}/story/${storyId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log("✅ [Story] Supprimée:", storyId);
    } catch (err) {
      console.error("❌ [Story] Delete Error:", err);
      setStories(oldStories);
      throw err;
    }
  }, [token, stories]);

  // ✅ Supprimer un slide (AJOUTÉ pour App.jsx)
  const deleteSlide = useCallback(async (storyId, slideIndex) => {
    if (!token) return;

    try {
      await axios.delete(`${API_URL}/story/${storyId}/slides/${slideIndex}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setStories(prev => prev.map(story => {
        if (story._id !== storyId) return story;
        return {
          ...story,
          slides: story.slides.filter((_, idx) => idx !== slideIndex)
        };
      }).filter(story => story.slides.length > 0));

      console.log("✅ [Story] Slide supprimé:", { storyId, slideIndex });
    } catch (err) {
      console.error("❌ [Story] Delete Slide Error:", err);
      throw err;
    }
  }, [token]);

  // ✅ Voir un slide
  const viewSlide = useCallback(async (storyId, slideIndex) => {
    if (!token || !user?._id) return { success: false, error: 'Auth required' };

    const key = `${storyId}-${slideIndex}`;
    
    if (viewingRef.current.has(key)) return { success: false, already: true };
    viewingRef.current.add(key);

    try {
      const response = await axios.post(
        `${API_URL}/story/${storyId}/slides/${slideIndex}/view`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const data = response.data;
      if (!data.isOwner && !data.alreadyViewed) {
        setStories(prev => prev.map(story => {
          if (story._id !== storyId) return story;
          const newSlides = [...story.slides];
          if (newSlides[slideIndex]) {
            const currentViews = newSlides[slideIndex].views || [];
            if (!currentViews.includes(user._id)) {
               newSlides[slideIndex] = {
                 ...newSlides[slideIndex],
                 views: [...currentViews, user._id]
               };
            }
          }
          return { ...story, slides: newSlides };
        }));
      }

      return { success: true, ...data };

    } catch (err) {
      const status = err.response?.status;
      const errorMsg = err.response?.data?.error || err.message;

      if (status === 403) console.warn('⚠️ [View] Accès refusé');
      else if (status === 410) console.warn('⚠️ [View] Story expirée');
      else if (status === 404) console.warn('⚠️ [View] Introuvable');
      else console.error('❌ [View] Erreur:', errorMsg);

      return { success: false, error: errorMsg, status };
    } finally {
      setTimeout(() => viewingRef.current.delete(key), 2000);
    }
  }, [token, user?._id]);

  // ✅ Obtenir les analytics
  const getAnalytics = useCallback(async (storyId) => {
    if (!token) return null;
    try {
      const res = await axios.get(`${API_URL}/story/${storyId}/analytics`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return res.data;
    } catch (err) {
      console.error("❌ [Analytics] Error:", err);
      return null;
    }
  }, [token]);

  // ✅ Mes stories (useMemo pour performance)
  const myStories = useMemo(() => {
    if (!user?._id) return [];
    return stories.filter(s => 
      (s.owner?._id || s.owner) === user._id
    );
  }, [stories, user?._id]);

  // ✅ Valeur du contexte (useMemo pour éviter re-renders inutiles)
  const value = useMemo(() => ({
    stories,        
    myStories,      
    loading,
    error,
    uploadProgress,
    fetchStories,
    createStory,
    deleteStory,
    deleteSlide,  // ✅ AJOUTÉ
    viewSlide,
    getAnalytics
  }), [stories, myStories, loading, error, uploadProgress, fetchStories, createStory, deleteStory, deleteSlide, viewSlide, getAnalytics]);

  return <StoryContext.Provider value={value}>{children}</StoryContext.Provider>;
}

// ✅ Hook personnalisé avec vérification
export const useStories = () => {
  const context = useContext(StoryContext);
  if (!context) {
    throw new Error('useStories doit être utilisé à l\'intérieur de StoryProvider');
  }
  return context;
};

export default StoryProvider;