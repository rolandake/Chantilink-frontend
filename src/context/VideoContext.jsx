// src/context/VideoContext.jsx - CORRECTIONS ERREURS 500
import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const VideosContext = createContext();

export const useVideos = () => {
  const context = useContext(VideosContext);
  if (!context) throw new Error('useVideos doit être dans VideosProvider');
  return context;
};

const LIMIT = 10;
const SOCKET_NAMESPACE = '/videos';

export const VideosProvider = ({ children }) => {
  const { getActiveUser } = useAuth();
  
  const [videos, setVideos] = useState([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);

  const socketRef = useRef(null);
  const fetchingRef = useRef(false);
  const viewedVideos = useRef(new Set());
  const observer = useRef(null);
  const abortController = useRef(null);
  const initialFetchDone = useRef(false);

  const getToken = useCallback(() => {
    const user = getActiveUser();
    if (user?.token) return user.token;
    
    const localToken = localStorage.getItem('token');
    if (localToken) return localToken;
    
    const sessionToken = sessionStorage.getItem('token');
    if (sessionToken) return sessionToken;
    
    return null;
  }, [getActiveUser]);

  const getUserId = useCallback(() => {
    const user = getActiveUser();
    return user?.user?._id || user?.user?.id;
  }, [getActiveUser]);

  const apiClient = useMemo(() => {
    const client = axios.create({
      baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
      timeout: 15000,
    });

    const requestInterceptor = client.interceptors.request.use(
      config => {
        const token = getToken();
        
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
          console.log('✅ [VideoContext] Token ajouté à la requête');
        } else {
          console.warn('⚠️ [VideoContext] Pas de token disponible');
        }
        
        return config;
      },
      error => Promise.reject(error)
    );

    const responseInterceptor = client.interceptors.response.use(
      response => response,
      error => {
        if (error.response?.status === 401) {
          console.error('🔒 [VideoContext] Session expirée (401)');
        }
        return Promise.reject(error);
      }
    );

    return { client, requestInterceptor, responseInterceptor };
  }, [getToken]);

  // === SOCKET.IO ===
  useEffect(() => {
    const token = getToken();
    if (!token) {
      console.warn('⚠️ [VideoContext] Pas de token pour le socket');
      return;
    }

    const socket = io(`${apiClient.client.defaults.baseURL}${SOCKET_NAMESPACE}`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      forceNew: false,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('✅ [VideoContext] Socket connecté');
    });

    socket.on('connect_error', (error) => {
      console.warn('⚠️ [VideoContext] Socket erreur:', error.message);
    });

    const handlers = {
      newVideo: (video) => {
        console.log('📹 [VideoContext] Nouvelle vidéo reçue');
        setVideos(prev => [video, ...prev]);
      },
      videoLiked: ({ videoId, likes, userLiked }) => {
        setVideos(prev => prev.map(v => 
          v._id === videoId ? { ...v, likes, userLiked } : v
        ));
      },
      commentAdded: ({ videoId, comment }) => {
        setVideos(prev => prev.map(v => 
          v._id === videoId ? { ...v, comments: [...(v.comments || []), comment] } : v
        ));
      },
      videoViewed: ({ videoId, views }) => {
        setVideos(prev => prev.map(v => 
          v._id === videoId ? { ...v, views } : v
        ));
      },
    };

    Object.entries(handlers).forEach(([event, handler]) => socket.on(event, handler));

    return () => {
      console.log('🔌 [VideoContext] Déconnexion socket');
      Object.keys(handlers).forEach(event => socket.off(event));
      socket.disconnect();
      socketRef.current = null;
    };
  }, [getToken, apiClient]);

  // === FETCH VIDÉOS ===
  const fetchVideos = useCallback(async (reset = false) => {
    if (fetchingRef.current) return;
    if (!reset && !hasMore) return;

    const token = getToken();
    if (!token) {
      console.warn('⚠️ [VideoContext] Impossible de charger sans token');
      return;
    }

    fetchingRef.current = true;
    setLoading(true);
    const targetPage = reset ? 1 : page + 1;

    console.log(`📡 [VideoContext] Chargement page ${targetPage}`);

    abortController.current?.abort();
    abortController.current = new AbortController();

    try {
      const url = `/api/videos?page=${targetPage}&limit=${LIMIT}`;
      const { data } = await apiClient.client.get(url, {
        signal: abortController.current.signal,
      });

      console.log('📥 [VideoContext] Données reçues:', data);

      let newVideos = [];
      let pagination = {};

      if (Array.isArray(data)) {
        newVideos = data;
      } else if (data.videos && Array.isArray(data.videos)) {
        newVideos = data.videos;
        pagination = data.pagination || {};
      } else if (data.data && Array.isArray(data.data)) {
        newVideos = data.data;
      } else {
        newVideos = [];
      }

      console.log(`✅ [VideoContext] ${newVideos.length} vidéos chargées`);

      setVideos(prev => {
        if (reset) {
          return newVideos;
        }
        const existing = new Set(prev.map(v => v._id));
        const unique = newVideos.filter(v => !existing.has(v._id));
        return [...prev, ...unique];
      });

      setPage(targetPage);
      
      const hasMoreVideos = pagination.hasMore !== undefined 
        ? pagination.hasMore 
        : newVideos.length >= LIMIT;
      
      setHasMore(hasMoreVideos);

      if (initialLoad) {
        setInitialLoad(false);
      }

    } catch (err) {
      if (err.name === 'AbortError' || err.name === 'CanceledError') {
        console.log('🚫 [VideoContext] Requête annulée');
      } else {
        console.error('❌ [VideoContext] Erreur fetch:', err);
        
        if (err.response?.status === 404 || err.response?.status === 500) {
          setHasMore(false);
        }
      }
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [page, hasMore, initialLoad, apiClient, getToken]);

  // === CHARGEMENT INITIAL ===
  useEffect(() => {
    const token = getToken();

    if (initialFetchDone.current) return;
    if (!token) {
      console.warn('⚠️ [VideoContext] Attente du token...');
      return;
    }

    initialFetchDone.current = true;
    fetchVideos(true);
  }, [getToken, fetchVideos]);

  // === ACTIONS ===
  const addVideo = useCallback((video) => {
    console.log('➕ [VideoContext] Ajout vidéo:', video._id);
    setVideos(prev => [video, ...prev]);
    socketRef.current?.emit('newVideo', video);
  }, []);

  const updateVideo = useCallback((videoId, data) => {
    setVideos(prev => prev.map(v => v._id === videoId ? { ...v, ...data } : v));
  }, []);

  const deleteVideo = useCallback(async (videoId) => {
    try {
      await apiClient.client.delete(`/api/videos/${videoId}`);
      setVideos(prev => prev.filter(v => v._id !== videoId));
    } catch (err) {
      console.error('❌ [VideoContext] Erreur suppression:', err);
      throw err;
    }
  }, [apiClient]);

  const incrementViews = useCallback(async (videoId) => {
    if (viewedVideos.current.has(videoId)) return;
    viewedVideos.current.add(videoId);

    setVideos(prev => prev.map(v => 
      v._id === videoId ? { ...v, views: (v.views || 0) + 1 } : v
    ));

    try {
      const { data } = await apiClient.client.post(`/api/videos/${videoId}/view`);
      setVideos(prev => prev.map(v => 
        v._id === videoId ? { ...v, views: data.views } : v
      ));
    } catch (err) {
      console.warn('⚠️ [VideoContext] Erreur incrémentation vues:', err.message);
      viewedVideos.current.delete(videoId);
      setVideos(prev => prev.map(v => 
        v._id === videoId ? { ...v, views: Math.max(0, (v.views || 0) - 1) } : v
      ));
    }
  }, [apiClient]);

  const likeVideo = useCallback(async (videoId) => {
    const token = getToken();
    if (!token) {
      alert('Vous devez être connecté pour aimer une vidéo');
      return;
    }

    const video = videos.find(v => v._id === videoId);
    if (!video) return;

    const wasLiked = video.userLiked;
    const newLikes = wasLiked ? video.likes - 1 : video.likes + 1;

    setVideos(prev => prev.map(v => 
      v._id === videoId ? { ...v, likes: newLikes, userLiked: !wasLiked } : v
    ));

    try {
      const { data } = await apiClient.client.post(`/api/videos/${videoId}/like`);
      
      setVideos(prev => prev.map(v => 
        v._id === videoId ? { ...v, likes: data.likes, userLiked: data.userLiked } : v
      ));
      
      const userId = getUserId();
      socketRef.current?.emit('likeVideo', { videoId, userId, likes: data.likes });
    } catch (err) {
      console.error('❌ [VideoContext] Erreur like:', err);
      
      setVideos(prev => prev.map(v => 
        v._id === videoId ? { ...v, likes: video.likes, userLiked: wasLiked } : v
      ));
      
      if (err.response?.status === 401) {
        alert('Session expirée. Veuillez vous reconnecter.');
      }
    }
  }, [videos, getToken, getUserId, apiClient]);

  // 🔥 FIX: AMÉLIORATION DE LA FONCTION COMMENTAIRE
  const commentVideo = useCallback(async (videoId, text) => {
    if (!text || !text.trim()) {
      console.warn('⚠️ [VideoContext] Texte de commentaire vide');
      return;
    }
    
    const token = getToken();
    if (!token) {
      alert('Vous devez être connecté pour commenter');
      throw new Error('Token manquant');
    }

    const user = getActiveUser();
    if (!user?.user) {
      alert('Informations utilisateur manquantes');
      throw new Error('User manquant');
    }

    console.log('💬 [VideoContext] Commentaire vidéo:', { videoId, text: text.trim() });

    // Créer le commentaire optimiste
    const optimisticComment = {
      _id: `temp-${Date.now()}`,
      text: text.trim(),
      user: {
        _id: user.user._id || user.user.id,
        username: user.user.username || user.user.fullName,
        profilePicture: user.user.profilePhoto || user.user.profilePicture
      },
      createdAt: new Date().toISOString()
    };

    // Ajouter immédiatement (UI optimiste)
    setVideos(prev => prev.map(v => 
      v._id === videoId 
        ? { ...v, comments: [...(v.comments || []), optimisticComment] } 
        : v
    ));

    try {
      // 🔥 REQUÊTE CORRIGÉE
      const { data } = await apiClient.client.post(
        `/api/videos/${videoId}/comment`, 
        { 
          text: text.trim(),
          content: text.trim() // Certains backends utilisent "content" au lieu de "text"
        }
      );
      
      console.log('✅ [VideoContext] Commentaire réussi:', data);
      
      // Remplacer le commentaire temporaire par le vrai
      setVideos(prev => prev.map(v => {
        if (v._id === videoId) {
          // Enlever le commentaire optimiste
          const withoutOptimistic = v.comments.filter(c => c._id !== optimisticComment._id);
          
          // Ajouter les commentaires du serveur
          const serverComments = data.comments || data.video?.comments || [];
          
          return { 
            ...v, 
            comments: serverComments.length > 0 ? serverComments : [...withoutOptimistic, data.comment || data]
          };
        }
        return v;
      }));
      
      // Émettre via socket
      const comment = data.comment || data.comments?.[data.comments.length - 1] || data;
      socketRef.current?.emit('commentVideo', { videoId, comment });
      
    } catch (err) {
      console.error('❌ [VideoContext] Erreur commentaire:', err);
      console.error('❌ Détails:', {
        status: err.response?.status,
        data: err.response?.data,
        message: err.message
      });
      
      // Retirer le commentaire optimiste en cas d'erreur
      setVideos(prev => prev.map(v => 
        v._id === videoId 
          ? { ...v, comments: v.comments.filter(c => c._id !== optimisticComment._id) } 
          : v
      ));
      
      // Messages d'erreur explicites
      if (err.response?.status === 401) {
        alert('Session expirée. Veuillez vous reconnecter.');
      } else if (err.response?.status === 500) {
        alert('Erreur serveur. Réessayez plus tard.');
      } else if (err.response?.data?.message) {
        alert(err.response.data.message);
      } else {
        alert('Erreur lors de l\'ajout du commentaire');
      }
      
      throw err;
    }
  }, [getToken, getActiveUser, apiClient]);

  const fetchUserVideos = useCallback(async (userId) => {
    try {
      const { data } = await apiClient.client.get(`/api/videos/user/${userId}`);
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.error('❌ [VideoContext] Erreur fetch user videos:', err);
      return [];
    }
  }, [apiClient]);

  // === NETTOYAGE ===
  useEffect(() => {
    return () => {
      observer.current?.disconnect();
      abortController.current?.abort();
      
      if (apiClient.requestInterceptor !== undefined) {
        apiClient.client.interceptors.request.eject(apiClient.requestInterceptor);
      }
      if (apiClient.responseInterceptor !== undefined) {
        apiClient.client.interceptors.response.eject(apiClient.responseInterceptor);
      }
    };
  }, [apiClient]);

  const value = useMemo(() => ({
    videos,
    loading,
    hasMore,
    page,
    initialLoad,
    fetchVideos,
    fetchUserVideos,
    addVideo,
    updateVideo,
    deleteVideo,
    incrementViews,
    likeVideo,
    commentVideo,
    socket: socketRef.current,
  }), [
    videos, loading, hasMore, page, initialLoad,
    fetchVideos, fetchUserVideos, addVideo, updateVideo,
    deleteVideo, incrementViews, likeVideo, commentVideo
  ]);

  return <VideosContext.Provider value={value}>{children}</VideosContext.Provider>;
};