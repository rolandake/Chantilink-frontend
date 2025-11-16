// ============================================
// src/hooks/useChatSocket.js - VERSION FINALE (APPELS SUR /messages)
// ============================================
import { useEffect, useRef, useCallback, useState } from "react";
import { io } from "socket.io-client";
import { useAuth } from "../context/AuthContext";
import Cookies from "js-cookie";

const SOCKET_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 2000;
const CONNECTION_TIMEOUT = 10000;

export function useChatSocket() {
  const authContext = useAuth();
  const getToken = authContext?.getToken
    ? authContext.getToken
    : async () => {
        return (
          Cookies.get("token") ||
          localStorage.getItem("token") ||
          sessionStorage.getItem("token")
        );
      };

  const user = authContext?.user;

  // === REFS ===
  const socketRef = useRef(null);           // /messages (messages + appels)
  const isInitializingRef = useRef(false);
  const reconnectCountRef = useRef(0);
  const hasCleanedUp = useRef(false);
  const listenersRef = useRef(new Map());   // Messages
  const callListenersRef = useRef(new Map()); // Appels
  const connectionTimeoutRef = useRef(null);
  const initAttempts = useRef(0);

  // === ÉTAT ===
  const [connected, setConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState({});
  const [error, setError] = useState(null);

  // === NETTOYAGE ===
  const cleanup = useCallback(() => {
    if (hasCleanedUp.current) return;
    hasCleanedUp.current = true;

    console.log("Nettoyage useChatSocket...");

    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }

    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    listenersRef.current.clear();
    callListenersRef.current.clear();
    isInitializingRef.current = false;
    reconnectCountRef.current = 0;
    setConnected(false);
    setOnlineUsers([]);
    setTypingUsers({});
    setError(null);
  }, []);

  // === INITIALISATION ===
  useEffect(() => {
    hasCleanedUp.current = false;
    initAttempts.current = 0;

    if (!user || !authContext) {
      console.warn("Auth manquante");
      return;
    }

    if (socketRef.current?.connected) {
      setConnected(true);
      return;
    }

    const initSocket = async () => {
      if (isInitializingRef.current) return;
      if (initAttempts.current > 10) {
        setError("Trop de tentatives");
        return;
      }

      initAttempts.current++;
      isInitializingRef.current = true;
      setError(null);

      try {
        const token = await getToken();
        if (!token) {
          console.error("AUCUN TOKEN");
          setError("Token manquant");
          isInitializingRef.current = false;
          return;
        }

        // === SOCKET /messages (messages + appels) ===
        if (socketRef.current) {
          socketRef.current.removeAllListeners();
          socketRef.current.disconnect();
        }

        const socket = io(`${SOCKET_URL}/messages`, {
          auth: { token },
          query: { token },
          reconnection: false,
          timeout: CONNECTION_TIMEOUT,
          transports: ["websocket", "polling"],
          forceNew: true,
          withCredentials: true,
        });

        // --- Connexion ---
        socket.on("connect", () => {
          console.log("Messages & Appels connecté (/messages)");
          setConnected(true);
          reconnectCountRef.current = 0;
        });

        socket.on("disconnect", (reason) => {
          console.log("Déconnecté:", reason);
          setConnected(false);
        });

        socket.on("connect_error", (err) => {
          console.error("Erreur connexion:", err.message);
          setError(err.message);
        });

        // --- Messages ---
        socket.on("onlineUsers", (data) => {
          let users = [];
          if (Array.isArray(data)) users = data;
          else if (data?.users) users = data.users;
          else if (data && typeof data === "object") {
            users = Object.keys(data).filter((k) => k !== "count");
          }
          setOnlineUsers((prev) => Array.from(new Set([...prev, ...users])));
        });

        socket.on("userOnline", ({ userId }) => {
          setOnlineUsers((prev) => Array.from(new Set([...prev, userId])));
        });

        socket.on("userOffline", ({ userId }) => {
          setOnlineUsers((prev) => prev.filter((id) => id !== userId));
        });

        socket.on("userTyping", ({ userId }) => {
          setTypingUsers((prev) => ({ ...prev, [userId]: true }));
        });

        socket.on("userStoppedTyping", ({ userId }) => {
          setTypingUsers((prev) => {
            const copy = { ...prev };
            delete copy[userId];
            return copy;
          });
        });

        socketRef.current = socket;
        isInitializingRef.current = false;

      } catch (err) {
        console.error("ERREUR INIT:", err);
        setError("Échec connexion");
        isInitializingRef.current = false;
      }
    };

    initSocket();

    return () => {
      cleanup();
    };
  }, [user, authContext, cleanup, getToken]);

  // === API MESSAGES ===
  const sendMessage = useCallback((data) => {
    if (!socketRef.current?.connected) return false;
    socketRef.current.emit("sendMessage", data);
    return true;
  }, []);

  const markAsRead = useCallback((id) => {
    socketRef.current?.emit("markAsRead", { senderId: id });
  }, []);

  const loadConversation = useCallback((id, page = 1) => {
    socketRef.current?.emit("loadConversation", { userId: id, page });
  }, []);

  const deleteMessage = useCallback((id, forEveryone = false) => {
    socketRef.current?.emit("deleteMessage", { messageId: id, forEveryone });
  }, []);

  const startTyping = useCallback((id) => {
    socketRef.current?.emit("typing", { recipientId: id });
  }, []);

  const stopTyping = useCallback((id) => {
    socketRef.current?.emit("stopTyping", { recipientId: id });
  }, []);

  const getUnreadCounts = useCallback(() => {
    socketRef.current?.emit("getUnreadCounts");
  }, []);

  // === API APPELS (sur /messages) ===
  const initiateCall = useCallback((receiverId, type) => {
    if (!socketRef.current?.connected) {
      console.error("Socket non connecté");
      return false;
    }
    console.log(`Appel: ${type} → ${receiverId}`);
    socketRef.current.emit("initiate-call", { receiverId, type });
    return true;
  }, []);

  const acceptCall = useCallback((callId) => {
    if (!socketRef.current?.connected) return false;
    console.log(`Accepter appel: ${callId}`);
    socketRef.current.emit("accept-call", { callId });
    return true;
  }, []);

  const rejectCall = useCallback((callId) => {
    if (!socketRef.current?.connected) return false;
    console.log(`Rejeter appel: ${callId}`);
    socketRef.current.emit("reject-call", { callId });
    return true;
  }, []);

  const endCall = useCallback((callId) => {
    if (!socketRef.current?.connected) return false;
    console.log(`Terminer appel: ${callId}`);
    socketRef.current.emit("end-call", { callId });
    return true;
  }, []);

  const getCallHistory = useCallback((limit = 50) => {
    if (!socketRef.current?.connected) return false;
    socketRef.current.emit("get-call-history", { limit });
    return true;
  }, []);

  // === LISTENERS (messages) ===
  const on = useCallback((event, handler) => {
    if (!socketRef.current) return;
    socketRef.current.on(event, handler);
    listenersRef.current.set(event, handler);
  }, []);

  const off = useCallback((event) => {
    const handler = listenersRef.current.get(event);
    if (handler) {
      socketRef.current?.off(event, handler);
      listenersRef.current.delete(event);
    }
  }, []);

  // === LISTENERS (appels) ===
  const onCall = useCallback((event, handler) => {
    if (!socketRef.current) return;
    socketRef.current.on(event, handler);
    callListenersRef.current.set(event, handler);
  }, []);

  const offCall = useCallback((event) => {
    const handler = callListenersRef.current.get(event);
    if (handler) {
      socketRef.current?.off(event, handler);
      callListenersRef.current.delete(event);
    }
  }, []);

  // === RECONNEXION ===
  const reconnect = useCallback(() => {
    cleanup();
    hasCleanedUp.current = false;
    reconnectCountRef.current = 0;
    initAttempts.current = 0;
  }, [cleanup]);

  return {
    // État
    connected,
    callsConnected: connected, // ← même socket
    error,
    onlineUsers,
    typingUsers,

    // Messages
    sendMessage,
    markAsRead,
    loadConversation,
    deleteMessage,
    startTyping,
    stopTyping,
    getUnreadCounts,
    on,
    off,

    // Appels
    initiateCall,
    acceptCall,
    rejectCall,
    endCall,
    getCallHistory,
    onCall,
    offCall,

    // Utils
    reconnect,
  };
}

export default useChatSocket;