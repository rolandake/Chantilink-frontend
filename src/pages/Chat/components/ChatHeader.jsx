import React from 'react';
import { motion } from 'framer-motion';
import { Video, Phone, MoreVertical, WifiOff } from 'lucide-react';

export const ChatHeader = ({ 
  friend, 
  typingUsers = [], 
  onlineUsers = [], 
  connected = true,
  onVideoCall,
  onAudioCall,
  className
}) => {
  if (!friend) return null;

  // Gestion sécurisée des tableaux
  const typingArray = Array.isArray(typingUsers) ? typingUsers : [];
  const onlineArray = Array.isArray(onlineUsers) ? onlineUsers : [];
  
  // Logique de statut
  const isOnline = onlineArray.some(u => u.userId === friend.id);
  const isTyping = typingArray.includes(friend.id);

  return (
    <header className={`bg-gray-900/80 backdrop-blur-md border-b border-gray-800 h-20 px-4 flex items-center justify-between z-20 ${className}`}>
      {/* --- INFO CONTACT --- */}
      <div className="flex items-center gap-3 overflow-hidden">
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-orange-500 to-pink-600 flex items-center justify-center text-white font-bold text-lg shadow-lg">
            {friend.avatar ? (
              <img src={friend.avatar} alt={friend.username} className="w-full h-full rounded-full object-cover" />
            ) : (
              (friend.fullName?.[0] || friend.username?.[0] || '?').toUpperCase()
            )}
          </div>
          {isOnline && (
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-gray-900 rounded-full shadow-sm" />
          )}
        </div>

        {/* Textes */}
        <div className="flex flex-col justify-center">
          <h3 className="text-white font-bold text-base md:text-lg leading-tight truncate max-w-[150px] md:max-w-xs">
            {friend.fullName || friend.username || "Inconnu"}
          </h3>
          
          <div className="h-4 flex items-center">
            {isTyping ? (
              <motion.span 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="text-orange-400 text-xs font-medium italic flex items-center gap-1"
              >
                écrit
                <motion.span animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1.5 }}>...</motion.span>
              </motion.span>
            ) : (
              <span className={`text-xs ${isOnline ? 'text-green-400 font-medium' : 'text-gray-500'}`}>
                {isOnline ? 'En ligne' : 'Hors ligne'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* --- ACTIONS --- */}
      <div className="flex items-center gap-1 md:gap-3">
        {!connected && (
          <WifiOff className="text-red-500 w-5 h-5 mr-2 animate-pulse" title="Connexion perdue" />
        )}

        <ActionButton onClick={onAudioCall} icon={Phone} disabled={!connected} color="green" />
        <ActionButton onClick={onVideoCall} icon={Video} disabled={!connected} color="blue" />
        
        <button className="p-2 text-gray-400 hover:text-white transition hidden md:block">
          <MoreVertical size={20} />
        </button>
      </div>
    </header>
  );
};

// Petit composant helper pour les boutons
const ActionButton = ({ onClick, icon: Icon, disabled, color }) => (
  <motion.button
    whileHover={{ scale: 1.1 }}
    whileTap={{ scale: 0.9 }}
    onClick={onClick}
    disabled={disabled}
    className={`p-2.5 rounded-full transition-colors ${
      disabled 
        ? 'opacity-50 cursor-not-allowed text-gray-600 bg-gray-800' 
        : 'text-gray-200 hover:bg-white/10 hover:text-white'
    }`}
  >
    <Icon size={22} className={color === 'blue' ? 'text-blue-400' : 'text-green-400'} />
  </motion.button>
);