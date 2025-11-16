// src/components/NotificationCenter.jsx - Centre de notifications complet
import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  BellIcon, 
  XMarkIcon, 
  TrashIcon, 
  CheckIcon,
  EyeIcon,
  HeartIcon,
  UserPlusIcon
} from "@heroicons/react/24/outline";
import { BellIcon as BellSolidIcon } from "@heroicons/react/24/solid";
import { useAuth } from "../context/AuthContext";
import { io } from "socket.io-client";
import { useNavigate } from "react-router-dom";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

// ========================================
// ICÔNE PAR TYPE DE NOTIFICATION
// ========================================
const NotificationIcon = ({ type }) => {
  const icons = {
    story_reaction: <HeartIcon className="w-5 h-5 text-pink-500" />,
    friend_request: <UserPlusIcon className="w-5 h-5 text-blue-500" />,
    story_mention: <EyeIcon className="w-5 h-5 text-purple-500" />,
    message: <BellIcon className="w-5 h-5 text-orange-500" />
  };
  return icons[type] || <BellIcon className="w-5 h-5 text-gray-500" />;
};

// ========================================
// ITEM DE NOTIFICATION
// ========================================
const NotificationItem = ({ notification, onRead, onDelete, onClick }) => {
  const timeAgo = (date) => {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    if (seconds < 60) return "À l'instant";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    return `${Math.floor(seconds / 86400)}j`;
  };

  const avatar = notification.sender?.profilePhoto 
    ? `${API}/${notification.sender.profilePhoto}` 
    : `https://ui-avatars.com/api/?name=${encodeURIComponent(
        notification.sender?.fullName || notification.sender?.username || 'U'
      )}&background=random`;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className={`p-4 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer ${
        !notification.read ? 'bg-blue-50 dark:bg-blue-900/10' : ''
      }`}
      onClick={() => onClick(notification)}
    >
      <div className="flex items-start gap-3">
        {/* Avatar + icône */}
        <div className="relative">
          <img 
            src={avatar} 
            alt={notification.sender?.username || "User"}
            className="w-12 h-12 rounded-full object-cover border-2 border-gray-200 dark:border-gray-700"
          />
          <div className="absolute -bottom-1 -right-1 bg-white dark:bg-gray-800 rounded-full p-1 border border-gray-200 dark:border-gray-700">
            <NotificationIcon type={notification.type} />
          </div>
        </div>

        {/* Contenu */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-900 dark:text-white font-medium">
            {notification.content}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {timeAgo(notification.createdAt)}
            </span>
            {notification.metadata?.emoji && (
              <span className="text-lg">{notification.metadata.emoji}</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {!notification.read && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRead(notification._id);
              }}
              className="p-2 text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-full transition-colors"
              title="Marquer comme lu"
            >
              <CheckIcon className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(notification._id);
            }}
            className="p-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-full transition-colors"
            title="Supprimer"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

// ========================================
// COMPOSANT PRINCIPAL
// ========================================
export default function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  
  const { token, user } = useAuth();
  const socketRef = useRef(null);
  const navigate = useNavigate();

  // ========================================
  // INITIALISATION SOCKET
  // ========================================
  useEffect(() => {
    if (!token) return;

    console.log("🔔 [Notifications] Connexion socket...");
    
    socketRef.current = io(`${API}/messages`, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true
    });

    socketRef.current.on("connect", () => {
      console.log("✅ [Notifications] Socket connecté");
      setSocketConnected(true);
      socketRef.current.emit("getUnreadNotifications");
    });

    socketRef.current.on("disconnect", () => {
      console.warn("⚠️ [Notifications] Socket déconnecté");
      setSocketConnected(false);
    });

    // Écouter les nouvelles notifications
    socketRef.current.on("newNotification", ({ notification }) => {
      console.log("🔔 [Notifications] Nouvelle notification reçue:", notification);
      setNotifications(prev => [notification, ...prev]);
      setUnreadCount(prev => prev + 1);
      
      // Notification navigateur
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("Nouvelle notification", {
          body: notification.content,
          icon: "/logo.png",
          badge: "/logo.png"
        });
      }
    });

    // Compteur de non-lues
    socketRef.current.on("unreadNotificationCount", ({ count }) => {
      console.log("📊 [Notifications] Compteur:", count);
      setUnreadCount(count);
    });

    // Confirmation de lecture
    socketRef.current.on("notificationMarkedRead", ({ notification }) => {
      console.log("✅ [Notifications] Marquée comme lue:", notification._id);
      setNotifications(prev => 
        prev.map(n => n._id === notification._id ? { ...n, read: true } : n)
      );
    });

    // Confirmation de lecture globale
    socketRef.current.on("allNotificationsMarkedRead", ({ count }) => {
      console.log("✅ [Notifications] Toutes marquées comme lues:", count);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    });

    // Confirmation de suppression
    socketRef.current.on("notificationDeleted", ({ notificationId }) => {
      console.log("🗑️ [Notifications] Supprimée:", notificationId);
      setNotifications(prev => prev.filter(n => n._id !== notificationId));
    });

    // Chargement des notifications
    socketRef.current.on("notificationsLoaded", ({ notifications: notifs, unreadCount: count }) => {
      console.log("📋 [Notifications] Chargées:", notifs.length);
      setNotifications(notifs);
      setUnreadCount(count);
      setLoading(false);
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [token]);

  // ========================================
  // DEMANDER PERMISSION NOTIFICATIONS NAVIGATEUR
  // ========================================
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // ========================================
  // CHARGER LES NOTIFICATIONS À L'OUVERTURE
  // ========================================
  useEffect(() => {
    if (isOpen && socketRef.current?.connected && notifications.length === 0) {
      setLoading(true);
      socketRef.current.emit("loadNotifications", { page: 1, limit: 50 });
    }
  }, [isOpen]);

  // ========================================
  // ACTIONS
  // ========================================
  const markAsRead = (notificationId) => {
    if (!socketRef.current?.connected) return;
    socketRef.current.emit("markNotificationRead", { notificationId });
  };

  const markAllAsRead = () => {
    if (!socketRef.current?.connected) return;
    socketRef.current.emit("markAllNotificationsRead");
  };

  const deleteNotification = (notificationId) => {
    if (!socketRef.current?.connected) return;
    socketRef.current.emit("deleteNotification", { notificationId });
  };

  const handleNotificationClick = (notification) => {
    // Marquer comme lue
    if (!notification.read) {
      markAsRead(notification._id);
    }

    // Naviguer selon le type
    if (notification.type === "story_reaction" && notification.metadata?.storyId) {
      navigate(`/stories/${notification.metadata.storyId}`);
      setIsOpen(false);
    } else if (notification.type === "friend_request" && notification.sender?._id) {
      navigate(`/profile/${notification.sender._id}`);
      setIsOpen(false);
    }
  };

  // ========================================
  // RENDER
  // ========================================
  return (
    <>
      {/* Bouton cloche */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
      >
        {unreadCount > 0 ? (
          <BellSolidIcon className="w-6 h-6 text-orange-500 animate-pulse" />
        ) : (
          <BellIcon className="w-6 h-6 text-gray-600 dark:text-gray-300" />
        )}
        
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </motion.span>
        )}
      </button>

      {/* Panel des notifications */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/20 z-40"
              onClick={() => setIsOpen(false)}
            />

            {/* Panel */}
            <motion.div
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 100 }}
              className="fixed top-0 right-0 h-full w-full sm:w-96 bg-white dark:bg-gray-900 shadow-2xl z-50 flex flex-col"
            >
              {/* Header */}
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <BellIcon className="w-6 h-6" />
                    Notifications
                    {unreadCount > 0 && (
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        ({unreadCount})
                      </span>
                    )}
                  </h2>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                  >
                    <XMarkIcon className="w-5 h-5 text-gray-500" />
                  </button>
                </div>

                {/* Actions */}
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    disabled={!socketConnected}
                    className="text-sm text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 disabled:opacity-50"
                  >
                    Tout marquer comme lu
                  </button>
                )}

                {/* Status */}
                <div className="flex items-center gap-2 mt-2">
                  <div className={`w-2 h-2 rounded-full ${socketConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {socketConnected ? "En ligne" : "Hors ligne"}
                  </span>
                </div>
              </div>

              {/* Liste des notifications */}
              <div className="flex-1 overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-orange-500" />
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                    <BellIcon className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      Aucune notification
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Vous n'avez pas encore de notifications
                    </p>
                  </div>
                ) : (
                  <AnimatePresence>
                    {notifications.map(notification => (
                      <NotificationItem
                        key={notification._id}
                        notification={notification}
                        onRead={markAsRead}
                        onDelete={deleteNotification}
                        onClick={handleNotificationClick}
                      />
                    ))}
                  </AnimatePresence>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}