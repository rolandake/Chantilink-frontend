// src/context/SocketContext.jsx
import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { useAuth } from "./AuthContext.jsx";

const SocketContext = createContext();

export const useSocket = (namespace = "/") => {
  const { user, token } = useAuth();
  const socketRef = useRef(null);
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!user?._id || !token) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setSocket(null);
      setConnected(false);
      return;
    }

    const apiUrl = import.meta.env.PROD
      ? (import.meta.env.VITE_API_URL_PROD || "https://chantilink-backend.onrender.com/api")
      : (import.meta.env.VITE_API_URL_LOCAL || import.meta.env.VITE_API_URL || "http://localhost:5000/api");
    const url = apiUrl.replace(/\/api$/, "");
    const fullPath = namespace.startsWith("/") ? namespace : `/${namespace}`;

    const newSocket = io(`${url}${fullPath}`, {
      auth: { token },
      transports: ["websocket"],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      forceNew: true,
    });

    newSocket.on("connect", () => {
      console.log(`[SOCKET] CONNECTÉ À ${fullPath}`);
      if (fullPath === "/") newSocket.emit("joinRoom", user._id);
      setConnected(true);
    });

    newSocket.on("disconnect", () => {
      console.log(`[SOCKET] DÉCONNECTÉ DE ${fullPath}`);
      setConnected(false);
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setSocket(null);
      setConnected(false);
    };
  }, [user?._id, token, namespace]);

  return { socket, connected };
};

export function SocketProvider({ children }) {
  return <SocketContext.Provider value={{}}>{children}</SocketContext.Provider>;
}
