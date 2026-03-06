// src/context/VideoContext.jsx
import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import axiosClient, { BACKEND_URL, API_ENDPOINTS } from '../api/axiosClientGlobal';

const VideosContext = createContext();

export const useVideos = () => {
  const context = useContext(VideosContext);
  if (!context) throw new Error('useVideos doit être dans VideosProvider');
  return context;
};

const LIMIT = 10;
const SOCKET_NAMESPACE = '/videos';

// ✅ URL API directe pour les requêtes fire-and-forget (vues)
// On n'utilise PAS axiosClient ici pour éviter :
//   - withCredentials: true → CORS strict (origin explicite requise)
//   - retry 3x avec 2s/4s/6s → maintient des connexions qui bloquent le chargement vidéo
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

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
  const pageRef = useRef(0);
  const hasMoreRef = useRef(true);

  // === SOCKET.IO ===
  useEffect(() => {
    let socket = null;

    const connectSocket = async () => {
      const token = getToken ? await getToken() : null;
      if (!token) return;

      socket = io(`${BACKEND_URL}${SOCKET_NAMESPACE}`, {
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

    if (currentUser) connectSocket();

    return () => { if (socket) socket.disconnect(); };
  }, [currentUser, getToken]);

  // === FETCH VIDÉOS ===
  const fetchVideos = useCallback(async (reset = false) => {
    if (fetchingRef.current) return;
    if (!reset && !hasMoreRef.current) return;

    fetchingRef.current = true;
    if (reset) {
      setLoading(true);
      pageRef.current = 0;
      hasMoreRef.current = true;
    }

    const targetPage = pageRef.current + 1;

    if (abortController.current) abortController.current.abort();
    abortController.current = new AbortController();

    try {
      const endpoint = API_ENDPOINTS?.VIDEOS?.LIST || '/videos';
      const { data } = await axiosClient.get(`${endpoint}?page=${targetPage}&limit=${LIMIT}`, {
        signal: abortController.current.signal,
      });

      let newVideos = [];
      if (Array.isArray(data)) newVideos = data;
      else if (Array.isArray(data.videos)) newVideos = data.videos;
      else if (Array.isArray(data.data)) newVideos = data.data;

      const normalizedVideos = newVideos.map(v => ({
        ...v,
        videoUrl: v.videoUrl || v.url || 
          (v.mediaType === 'video' && v.media?.[0]) ||
          (Array.isArray(v.media) && v.media.find(u => /\.(mp4|webm|mov)(\?|$)/i.test(u))) ||
          v.cloudinaryUrl || v.secure_url || null,
      }));

      setVideos(prev => {
        if (reset) return normalizedVideos;
        const existingIds = new Set(prev.map(v => v._id));
        return [...prev, ...normalizedVideos.filter(v => !existingIds.has(v._id))];
      });

      pageRef.current = targetPage;
      hasMoreRef.current = newVideos.length >= LIMIT;
      setPage(targetPage);
      setHasMore(newVideos.length >= LIMIT);
      setInitialLoad(false);

    } catch (err) {
      if (err.name === 'CanceledError' || err.name === 'AbortError') return;
      console.error('❌ [VideoContext] Erreur Fetch:', err);
      setInitialLoad(false);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!initialFetchDone.current) {
      initialFetchDone.current = true;
      fetchVideos(true);
    }
  }, [fetchVideos]);

  // === LIKE ===
  const likeVideo = useCallback(async (videoId) => {
    if (!currentUser) return alert("Connectez-vous !");

    setVideos(prev => prev.map(v => {
      if (v._id !== videoId) return v;
      const likesArr = Array.isArray(v.likes) ? v.likes : [];
      const isLiked = likesArr.includes(currentUser._id);
      return {
        ...v,
        likes: isLiked
          ? likesArr.filter(id => id !== currentUser._id)
          : [...likesArr, currentUser._id],
        userLiked: !isLiked,
      };
    }));

    try {
      const { data } = await axiosClient.post(`/videos/${videoId}/like`);
      setVideos(prev => prev.map(v => v._id === videoId ? { ...v, likes: data.likes } : v));
    } catch (err) {
      console.error("❌ Erreur Like:", err);
    }
  }, [currentUser]);

  // === COMMENT ===
  const commentVideo = useCallback(async (videoId, text) => {
    if (!text?.trim() || !currentUser) return;
    const cleanText = text.trim();
    const tempId = `temp-${Date.now()}`;

    setVideos(prev => prev.map(v =>
      v._id === videoId
        ? { ...v, comments: [...(v.comments || []), { _id: tempId, text: cleanText, user: currentUser, createdAt: new Date().toISOString() }] }
        : v
    ));

    try {
      const { data } = await axiosClient.post(`/videos/${videoId}/comment`, { text: cleanText, content: cleanText });
      setVideos(prev => prev.map(v => {
        if (v._id !== videoId) return v;
        const others = v.comments.filter(c => c._id !== tempId);
        return { ...v, comments: [...others, data.comment || data] };
      }));
      socketRef.current?.emit('commentVideo', { videoId, comment: data.comment || data });
    } catch (err) {
      console.error("❌ Erreur Commentaire:", err);
      setVideos(prev => prev.map(v =>
        v._id === videoId ? { ...v, comments: v.comments.filter(c => c._id !== tempId) } : v
      ));
    }
  }, [currentUser]);

  // === DELETE ===
  const deleteVideo = useCallback(async (videoId) => {
    try {
      const endpoint = API_ENDPOINTS?.VIDEOS?.DELETE?.(videoId) || `/videos/${videoId}`;
      await axiosClient.delete(endpoint);
      setVideos(prev => prev.filter(v => v._id !== videoId));
    } catch (err) {
      console.error("Erreur suppression:", err);
    }
  }, []);

  // ✅ FIX INCREMENT VIEWS
  // Utilise fetch() natif au lieu d'axiosClient pour éviter :
  //   1. withCredentials: true → CORS strict bloque sur cold start Render (502)
  //   2. Retry 3x (2s+4s+6s) → maintient des connexions ouvertes qui
  //      concurrencent le chargement de la vidéo suivante → sauts
  // C'est une requête fire-and-forget : on n'attend pas la réponse,
  // on n'affiche pas d'erreur, on incrémente juste le compteur local.
  const incrementViews = useCallback(async (videoId) => {
    if (!videoId) return;

    // Incrément local immédiat (UI réactive)
    setVideos(prev => prev.map(v =>
      v._id === videoId ? { ...v, views: (v.views || 0) + 1 } : v
    ));

    // Fire-and-forget — pas de retry, pas de throw
    try {
      const token = getToken ? await getToken() : null;
      await fetch(`${API_URL}/videos/${videoId}/view`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        // Pas de credentials: 'include' → évite le CORS strict
      });
    } catch {
      // Silencieux — une vue ratée n'est pas critique
    }
  }, [getToken]);

  const value = useMemo(() => ({
    videos,
    loading,
    hasMore,
    initialLoad,
    fetchVideos,
    likeVideo,
    commentVideo,
    deleteVideo,
    incrementViews,
    currentUser,
  }), [videos, loading, hasMore, initialLoad, fetchVideos, likeVideo, commentVideo, deleteVideo, incrementViews, currentUser]);

  return <VideosContext.Provider value={value}>{children}</VideosContext.Provider>;
};