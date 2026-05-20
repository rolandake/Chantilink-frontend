import { io as socketIOClient } from "socket.io-client";

let socket;

export function initSocket(token) {
  if (!socket) {
    socket = socketIOClient(import.meta.env.VITE_API_URL || (import.meta.env.PROD ? "https://chantilink-backend.onrender.com" : "http://localhost:5000"), {
      auth: { token },
      transports: ["websocket"],
    });
  }
  return socket;
}

export function getSocket() {
  if (!socket) throw new Error("Socket non initialisé. Appelle initSocket() d'abord.");
  return socket;
}
