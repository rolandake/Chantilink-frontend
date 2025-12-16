// src/hooks/useVisionIA.js
import { useState, useEffect, useRef, useCallback } from "react";
import { io } from "socket.io-client";
import { useAuth } from "../context/AuthContext.jsx";

export function useVisionIA(userId, projectType, engineerMode) {
  const { user, getToken } = useAuth();
  const [connected, setConnected] = useState(false);
  const [typing, setTyping] = useState(false);
  const [currentProvider, setCurrentProvider] = useState(null);
  const [messages, setMessages] = useState([]);

  const socketRef = useRef(null);
  const roomIdRef = useRef(`vision-${userId}-${projectType}-${engineerMode}`);
  const messageCallbacksRef = useRef(new Map());

  // ========================================
  // INITIALISATION SOCKET
  // ========================================
  useEffect(() => {
    if (!user?._id) {
      console.warn("[VisionIA] ⚠️ User non connecté (pas d'_id), skip socket");
      return;
    }

    const initSocket = async () => {
      try {
        const token = await getToken();
        if (!token) {
          console.error("[VisionIA] ❌ Token manquant après getToken()");
          return;
        }

        const BACKEND_URL =
          (import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace('/api', '');

        console.log("[VisionIA] 🔌 Connexion au namespace /vision...");
        const socket = io(`${BACKEND_URL}/vision`, {
          auth: { token },
          transports: ["websocket", "polling"],
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
          forceNew: true,
          withCredentials: true,
        });

        socketRef.current = socket;

        // ========================================
        // EVENT LISTENERS
        // ========================================
        socket.on("connect", () => {
          console.log("[VisionIA] ✅ CONNECTÉ au namespace /vision");
          setConnected(true);

          const roomId = roomIdRef.current;
          socket.emit("joinProject", { roomId, projectType, engineerMode });
        });

        socket.on("disconnect", (reason) => {
          console.warn("[VisionIA] ❌ DÉCONNECTÉ:", reason);
          setConnected(false);
          setTyping(false);
        });

        socket.on("connect_error", (error) => {
          console.error("[VisionIA] ❌ ERREUR DE CONNEXION:", error.message);
          setConnected(false);
        });

        socket.on("projectJoined", (data) => {
          console.log("[VisionIA] ✅ Projet rejoint:", data);
          if (data.history?.length > 0) setMessages(data.history);
          if (data.availableProviders?.length > 0)
            console.log("[VisionIA] Providers:", data.availableProviders);
        });

        socket.on("providerInfo", (data) => {
          setCurrentProvider(data.provider);
        });

        socket.on("visionResponse", (data) => {
          const { replyId, content, typing: isTyping, complete, provider } = data;
          if (provider) setCurrentProvider(provider);
          setTyping(!complete);

          const callback = messageCallbacksRef.current.get(replyId);
          if (callback) {
            callback(content, complete);
            if (complete) messageCallbacksRef.current.delete(replyId);
          }
        });

        socket.on("historyCleared", (data) => {
          console.log("[VisionIA] 🧹 Historique effacé:", data.roomId);
          setMessages([]);
        });

        socket.on("error", (error) => {
          console.error("[VisionIA] ❌ Erreur serveur:", error);
          setTyping(false);
        });
      } catch (err) {
        console.error("[VisionIA] ❌ Erreur initSocket:", err);
      }
    };

    // ✅ Appel effectif de la fonction
    initSocket();

    // ✅ Cleanup
    return () => {
      console.log("[VisionIA] 🧹 Nettoyage socket...");
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      messageCallbacksRef.current.clear();
    };
  }, [user?._id, projectType, engineerMode]);

  // ========================================
  // UPDATE ROOM ID
  // ========================================
  useEffect(() => {
    const newRoomId = `vision-${userId}-${projectType}-${engineerMode}`;
    if (newRoomId !== roomIdRef.current) {
      roomIdRef.current = newRoomId;
      if (socketRef.current?.connected) {
        socketRef.current.emit("joinProject", {
          roomId: newRoomId,
          projectType,
          engineerMode,
        });
      }
    }
  }, [userId, projectType, engineerMode]);

  // ========================================
  // SEND MESSAGE
  // ========================================
  const sendMessage = useCallback(
    (message, options = {}) => {
      if (!socketRef.current?.connected) {
        console.error("[VisionIA] ❌ Socket non connecté");
        return null;
      }

      const replyId = `msg-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 9)}`;
      const roomId = roomIdRef.current;

      const tempMessage = {
        id: replyId,
        role: "assistant",
        content: "",
        typing: true,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, tempMessage]);
      setTyping(true);

      messageCallbacksRef.current.set(replyId, (content, complete) => {
        setMessages((prev) => {
          const index = prev.findIndex((m) => m.id === replyId);
          if (index === -1) return prev;
          const updated = [...prev];
          updated[index] = {
            ...updated[index],
            content: complete
              ? content
              : updated[index].content + content,
            typing: !complete,
          };
          return updated;
        });
      });

      socketRef.current.emit("sendVisionMessage", {
        roomId,
        replyId,
        message,
        projectType,
        engineerMode,
        ...options,
      });

      return replyId;
    },
    [projectType, engineerMode]
  );

  // ========================================
  // CLEAR HISTORY
  // ========================================
  const clearHistory = useCallback(() => {
    if (!socketRef.current?.connected) {
      console.error("[VisionIA] ❌ Socket non connecté");
      return;
    }
    socketRef.current.emit("clearHistory", { roomId: roomIdRef.current });
  }, []);

  // ========================================
  // RETURN
  // ========================================
  return {
    connected,
    typing,
    currentProvider,
    messages,
    sendMessage,
    clearHistory,
    socket: socketRef.current,
  };
}
