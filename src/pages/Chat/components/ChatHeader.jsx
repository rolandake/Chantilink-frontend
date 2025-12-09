// ============================================
// 📁 src/pages/Chat/components/ChatHeader.jsx
// ============================================
import React from 'react';
import { motion } from 'framer-motion';
import { Video, Phone, MoreVertical, ArrowLeft } from 'lucide-react';

export const ChatHeader = ({ 
  friend, 
  typingUsers, 
  onlineUsers, 
  connected = true,
  onVideoCall,
  onAudioCall,
  onBack
}) => {
  // ✅ Vérifier que typingUsers et onlineUsers sont des tableaux
  const typingArray = Array.isArray(typingUsers) ? typingUsers : [];
  const onlineArray = Array.isArray(onlineUsers) ? onlineUsers : [];
  
  const isOnline = onlineArray.includes(friend?.id);
  const isTyping = typingArray.includes(friend?.id);

  return (
    <header className="bg-gray-800/50 border-b border-gray-700 p-4 flex-shrink-0">
      <div className="flex items-center justify-between">
        {/* Info du contact */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center text-white font-bold text-lg">
              {(friend?.fullName?.[0] || friend?.username?.[0] || '?').toUpperCase()}
            </div>
            {isOnline && (
              <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-gray-800" />
            )}
          </div>

          {/* Nom et statut */}
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-semibold text-lg truncate">
              {friend?.fullName || friend?.username || "Inconnu"}
            </h3>
            <div className="flex items-center gap-2">
              {isTyping ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-1 text-orange-400 text-sm"
                >
                  <span>En train d'écrire</span>
                  <motion.span
                    animate={{ opacity: [1, 0.5, 1] }}
                    transition={{ repeat: Infinity, duration: 1 }}
                  >
                    ...
                  </motion.span>
                </motion.div>
              ) : (
                <p className="text-sm text-gray-400">
                  {isOnline ? 'En ligne' : 'Hors ligne'}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Appel vidéo */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onVideoCall}
            disabled={!connected}
            className="p-3 bg-blue-500/20 text-blue-400 rounded-xl hover:bg-blue-500/30 transition disabled:opacity-50 disabled:cursor-not-allowed"
            title="Appel vidéo"
          >
            <Video className="w-5 h-5" />
          </motion.button>

          {/* Appel audio */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onAudioCall}
            disabled={!connected}
            className="p-3 bg-green-500/20 text-green-400 rounded-xl hover:bg-green-500/30 transition disabled:opacity-50 disabled:cursor-not-allowed"
            title="Appel audio"
          >
            <Phone className="w-5 h-5" />
          </motion.button>

          {/* Menu */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="p-3 bg-gray-700/50 text-gray-400 rounded-xl hover:bg-gray-700 transition"
            title="Plus d'options"
          >
            <MoreVertical className="w-5 h-5" />
          </motion.button>
        </div>
      </div>

      {/* Barre de connexion */}
      {!connected && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 p-2 bg-red-500/20 border border-red-500/30 rounded-lg text-center"
        >
          <p className="text-red-400 text-sm">
            Connexion perdue - Reconnexion en cours...
          </p>
        </motion.div>
      )}
    </header>
  );
};