import { lazy } from "react";

// Chargement à la demande (Lazy Loading) - SANS VISION
export const Home = lazy(() => import("../pages/Home/Home.jsx"));
export const Profile = lazy(() => import("../pages/Profile/ProfilePage.jsx"));
export const ChatPage = lazy(() => import("../pages/Chat/ChatPage.jsx"));
export const VideosPage = lazy(() => import("../pages/Videos/VideosPage.jsx"));
export const CalculsPage = lazy(() => import("../pages/Calculs/CalculsPage.jsx"));
export const Messages = lazy(() => import("../pages/Chat/Messages.jsx")); 
export const AuthPage = lazy(() => import("../pages/Auth/AuthPage.jsx"));
export const AdminDashboard = lazy(() => import("../pages/Admin/AdminDashboard.jsx"));