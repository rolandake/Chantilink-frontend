// src/context/SocketContext.jsx
import React, { createContext, useContext, useEffect, useRef, useMemo } from "react";
import { io } from "socket.io-client";
import { useAuth } from "./AuthContext.jsx";

const SocketContext = createContext();

export const useSocket = (namespace = "/") => {
  const { user } = useAuth();
  const socketRef = useRef(null);

  const socket = useMemo(() => {
    if (!user?._id || !user?.token) return null;

    const url = (import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace('/api', '');
    const fullPath = namespace.startsWith("/") ? namespace : `/${namespace}`;

    const newSocket = io(`${url}${fullPath}`, {
      auth: { token: user.token },
      transports: ["websocket"],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      forceNew: true,
    });

    newSocket.on("connect", () => {
      console.log(`[SOCKET] CONNECTÉ À ${fullPath}`);
      if (fullPath === "/") newSocket.emit("joinRoom", user._id);
    });

    newSocket.on("disconnect", () => {
      console.log(`[SOCKET] DÉCONNECTÉ DE ${fullPath}`);
    });

    socketRef.current = newSocket;
    return newSocket;
  }, [user?._id, user?.token, namespace]);

  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [namespace]);

  return { socket };
};

export function SocketProvider({ children }) {
  return <SocketContext.Provider value={{}}>{children}</SocketContext.Provider>;
}
