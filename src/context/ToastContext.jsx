// src/context/ToastContext.jsx
// TOAST ULTIME – 0 ERREUR, 100% BEAUTÉ, 1000% PRO
import React, { createContext, useContext, useState, useCallback, useEffect, forwardRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, XCircle, AlertCircle, Info } from "lucide-react";

const ToastContext = createContext();

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast doit être dans ToastProvider");
  return context;
};

const TOAST_DURATION = 3500;

const icons = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertCircle,
  info: Info,
};

const gradients = {
  success: "from-emerald-500 to-teal-600",
  error: "from-red-500 to-rose-600",
  warning: "from-amber-500 to-orange-600",
  info: "from-blue-500 to-cyan-600",
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = "info", duration = TOAST_DURATION) => {
    const id = Date.now() + Math.random();
    const toast = { id, message, type, duration };

    setToasts(prev => [...prev, toast]);

    // Son discret
    const audio = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjV");
    audio.volume = 0.3;
    audio.play().catch(() => {});

    // Vibration mobile
    if (navigator.vibrate) navigator.vibrate(100);

    // Auto-remove
    if (duration > 0) {
      setTimeout(() => removeToast(id), duration);
    }

    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, removeToast, toasts }}>
      {children}

      {/* TOASTS AFFICHÉS ICI */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 pointer-events-none">
        <AnimatePresence mode="popLayout">
          {toasts.map(toast => (
            <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

// 🎯 CORRECTION: Ajouter forwardRef
const ToastItem = forwardRef(({ toast, onClose }, ref) => {
  const Icon = icons[toast.type] || Info;
  const gradient = gradients[toast.type] || gradients.info;
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (toast.duration <= 0) return;
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, (toast.duration - elapsed) / toast.duration * 100);
      setProgress(remaining);
      if (remaining <= 0) clearInterval(interval);
    }, 16);
    return () => clearInterval(interval);
  }, [toast.duration]);

  return (
    <motion.div
      ref={ref}  // 🎯 Ajouter la ref ici
      layout
      initial={{ opacity: 0, y: -50, scale: 0.85, x: 100 }}
      animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.85, x: 100 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
      className="pointer-events-auto cursor-pointer select-none"
      onClick={onClose}
    >
      <div className="relative overflow-hidden rounded-2xl backdrop-blur-xl bg-black/40 border border-white/20 shadow-2xl min-w-80 max-w-sm">
        {/* Fond dégradé */}
        <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-90`} />

        {/* Barre de progression */}
        {toast.duration > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
            <motion.div
              className="h-full bg-white"
              initial={{ width: "100%" }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.05, ease: "linear" }}
            />
          </div>
        )}

        <div className="relative flex items-center gap-3 p-4">
          {/* Icône animée */}
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.1, type: "spring", stiffness: 300 }}
            className="flex-shrink-0"
          >
            <div className="p-2 rounded-xl bg-white/20 backdrop-blur">
              <Icon className="w-5 h-5 text-white" />
            </div>
          </motion.div>

          {/* Message */}
          <motion.p
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 }}
            className="text-white font-medium text-sm leading-relaxed flex-1"
          >
            {toast.message}
          </motion.p>

          {/* Bouton fermer */}
          <motion.button
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="p-1.5 rounded-lg hover:bg-white/10 transition"
          >
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
});

// 🎯 Ajouter displayName pour le debugging
ToastItem.displayName = "ToastItem";