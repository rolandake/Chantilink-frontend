// src/context/VideoContext.jsx
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
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export const VideosProvider = ({ children }) => {
  const { user: currentUser, getToken } = useAuth();
  
  const [videos, setVideos] = useState([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);

  const socketRef = useRef(null);
  const fetchingRef = useRef(false);
  const abortController = useRef(null);
  const initialFetchDone = useRef(false);

  // === CLIENT AXIOS CONFIGURÉ ===
  const apiClient = useMemo(() => {
    const client = axios.create({
      baseURL: API_URL,
      timeout: 20000,
      headers: { 'Content-Type': 'application/json' }
    });

    client.interceptors.request.use(
      async (config) => {
        if (getToken) {
          const token = await getToken();
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
          }
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    return client;
  }, [getToken]);

  // === SOCKET.IO CONNECTION ===
  useEffect(() => {
    let socket = null;

    const connectSocket = async () => {
      const token = getToken ? await getToken() : null;
      if (!token) return;

      socket = io(`${API_URL}${SOCKET_NAMESPACE}`, {
        auth: { token },
        transports: ['websocket'],
        reconnectionAttempts: 5,
      });

      socketRef.current = socket;

      socket.on('connect', () => console.log('✅ [VideoContext] Socket Connecté'));
      
      socket.on('newVideo', (video) => setVideos(prev => [video, ...prev]));
      
      socket.on('videoLiked', ({ videoId, likes }) => {
        setVideos(prev => prev.map(v => v._id === videoId ? { ...v, likes } : v));
      });

      socket.on('commentAdded', ({ videoId, comment }) => {
        setVideos(prev => prev.map(v => 
          v._id === videoId ? { ...v, comments: [...(v.comments || []), comment] } : v
        ));
      });
    };

    if (currentUser) {
      connectSocket();
    }

    return () => {
      if (socket) socket.disconnect();
    };
  }, [currentUser, getToken]);

  // === FETCH VIDÉOS ===
  const fetchVideos = useCallback(async (reset = false) => {
    if (fetchingRef.current) return;
    if (!reset && !hasMore) return;

    fetchingRef.current = true;
    if (reset) setLoading(true);

    const targetPage = reset ? 1 : page + 1;

    if (abortController.current) abortController.current.abort();
    abortController.current = new AbortController();

    try {
      // Ajustement de l'URL pour correspondre à votre backend (parfois /api/videos, parfois /videos)
      const { data } = await apiClient.get(`/api/videos?page=${targetPage}&limit=${LIMIT}`, {
        signal: abortController.current.signal,
      });

      let newVideos = [];
      if (Array.isArray(data)) newVideos = data;
      else if (Array.isArray(data.videos)) newVideos = data.videos;
      else if (Array.isArray(data.data)) newVideos = data.data;

      setVideos(prev => {
        if (reset) return newVideos;
        const existingIds = new Set(prev.map(v => v._id));
        const filtered = newVideos.filter(v => !existingIds.has(v._id));
        return [...prev, ...filtered];
      });

      setPage(targetPage);
      setHasMore(newVideos.length >= LIMIT);
      if (initialLoad) setInitialLoad(false);

    } catch (err) {
      if (axios.isCancel(err)) return;
      console.error('❌ [VideoContext] Erreur Fetch:', err);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [page, hasMore, initialLoad, apiClient]);

  // Chargement Initial
  useEffect(() => {
    if (!initialFetchDone.current) {
      initialFetchDone.current = true;
      fetchVideos(true);
    }
  }, [fetchVideos]);

  // === ACTIONS UTILISATEUR ===

  // 1. LIKE
  const likeVideo = useCallback(async (videoId) => {
    if (!currentUser) return alert("Connectez-vous !");

    setVideos(prev => prev.map(v => {
      if (v._id === videoId) {
        const likesArr = Array.isArray(v.likes) ? v.likes : []; 
        const isLiked = likesArr.includes(currentUser._id);
        
        let newLikes;
        if (Array.isArray(v.likes)) {
             newLikes = isLiked 
                ? v.likes.filter(id => id !== currentUser._id)
                : [...v.likes, currentUser._id];
        } else {
             newLikes = isLiked ? v.likes - 1 : v.likes + 1;
        }

        return { ...v, likes: newLikes, userLiked: !isLiked };
      }
      return v;
    }));

    try {
      const { data } = await apiClient.post(`/api/videos/${videoId}/like`);
      setVideos(prev => prev.map(v => 
        v._id === videoId ? { ...v, likes: data.likes } : v
      ));
    } catch (err) {
      console.error("❌ Erreur Like:", err);
    }
  }, [currentUser, apiClient]);

  // 2. COMMENT
  const commentVideo = useCallback(async (videoId, text) => {
    if (!text?.trim()) return;
    if (!currentUser) return alert("Connectez-vous !");

    const cleanText = text.trim();
    const tempId = `temp-${Date.now()}`;
    const optimisticComment = {
      _id: tempId,
      text: cleanText,
      user: currentUser,
      createdAt: new Date().toISOString()
    };

    setVideos(prev => prev.map(v => 
      v._id === videoId ? { ...v, comments: [...(v.comments || []), optimisticComment] } : v
    ));

    try {
      const { data } = await apiClient.post(`/api/videos/${videoId}/comment`, { 
        text: cleanText,
        content: cleanText
      });

      setVideos(prev => prev.map(v => {
        if (v._id === videoId) {
          const others = v.comments.filter(c => c._id !== tempId);
          const serverComment = data.comment || data; 
          return { ...v, comments: [...others, serverComment] };
        }
        return v;
      }));
      
      socketRef.current?.emit('commentVideo', { videoId, comment: data.comment || data });

    } catch (err) {
      console.error("❌ Erreur Commentaire:", err);
      setVideos(prev => prev.map(v => 
        v._id === videoId ? { ...v, comments: v.comments.filter(c => c._id !== tempId) } : v
      ));
    }
  }, [currentUser, apiClient]);

  // 3. DELETE
  const deleteVideo = useCallback(async (videoId) => {
    try {
      await apiClient.delete(`/api/videos/${videoId}`);
      setVideos(prev => prev.filter(v => v._id !== videoId));
    } catch (err) {
      console.error("Erreur suppression:", err);
    }
  }, [apiClient]);

  // 4. INCREMENT VIEWS (C'est ce qui manquait !)
  const incrementViews = useCallback(async (videoId) => {
    if (!videoId) return;

    // Mise à jour optimiste locale
    setVideos((prev) => prev.map(v => 
      v._id === videoId ? { ...v, views: (v.views || 0) + 1 } : v
    ));

    try {
      // Appel silencieux à l'API
      await apiClient.post(`/api/videos/${videoId}/view`);
    } catch (err) {
      // On ignore l'erreur silencieusement pour ne pas gêner l'UX
      console.warn("Erreur incrémentation vue:", err);
    }
  }, [apiClient]);

  // === VALEURS EXPORTÉES ===
  const value = useMemo(() => ({
    videos,
    loading,
    hasMore,
    fetchVideos,
    likeVideo,
    commentVideo,
    deleteVideo,
    incrementViews, // <--- AJOUTÉ ICI POUR ÉVITER LE CRASH
    currentUser
  }), [videos, loading, hasMore, fetchVideos, likeVideo, commentVideo, deleteVideo, incrementViews, currentUser]);

  return <VideosContext.Provider value={value}>{children}</VideosContext.Provider>;
};