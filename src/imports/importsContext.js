// src/imports/importsContext.js (AVEC SOCKETPROVIDER)
import { useAuth, AuthProvider } from "../context/AuthContext";
import { SocketProvider } from "../context/SocketContext.jsx"; // ✅ AJOUTÉ
import { PostsProvider } from "../context/PostsContext";
import { StoryProvider } from "../context/StoryContext.jsx";
import { VideosProvider } from "../context/VideoContext.jsx";
import { ToastProvider } from "../context/ToastContext";

export {
  useAuth,
  AuthProvider,
  SocketProvider, // ✅ AJOUTÉ
  PostsProvider,
  StoryProvider,
  VideosProvider,
  ToastProvider,
};