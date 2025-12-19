// ============================================
// 📁 src/pages/Chat/components/ChatHeader.jsx
// VERSION: ÉLITE - SECURE CONNECT UX
// ============================================
import React from 'react';
import { motion } from 'framer-motion';
import { Video, Phone, ShieldCheck, WifiOff, Lock } from 'lucide-react';

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

  // Logique de présence et d'activité
  const isOnline = Array.isArray(onlineUsers) 
    ? onlineUsers.some(u => (u.userId || u.id) === friend.id) 
    : onlineUsers.includes(friend.id);

  const isTyping = Array.isArray(typingUsers) && typingUsers.includes(friend.id);

  return (
    <header className={`bg-[#12151a]/90 backdrop-blur-xl border-b border-white/5 h-20 px-4 flex items-center justify-between z-30 ${className}`}>
      
      {/* --- BLOC INFO CONTACT (Confidentialité & Identité) --- */}
      <div className="flex items-center gap-3 overflow-hidden">
        {/* Avatar avec contour d'état */}
        <div className="relative flex-shrink-0">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-lg border-2 
            ${isOnline ? 'border-blue-500/20 bg-gradient-to-br from-blue-600 to-indigo-600' : 'border-gray-500/10 bg-[#1c2026] text-gray-400'}`}>
            {friend.profilePhoto ? (
              <img src={friend.profilePhoto} alt="" className="w-full h-full rounded-2xl object-cover" />
            ) : (
              (friend.fullName?.[0] || friend.username?.[0] || '?').toUpperCase()
            )}
          </div>
          {isOnline && (
            <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 border-4 border-[#12151a] rounded-full shadow-sm" />
          )}
        </div>

        {/* Textes et Statut */}
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="text-white font-black text-sm md:text-base truncate leading-none">
              {friend.fullName || friend.username}
            </h3>
            {friend.isOnChantilink && (
               <ShieldCheck size={12} className="text-blue-500 flex-shrink-0" />
            )}
          </div>
          
          <div className="h-4 mt-0.5 flex items-center">
            {isTyping ? (
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex items-center gap-1"
              >
                <span className="text-blue-400 text-[10px] font-black uppercase tracking-widest italic">Écrit</span>
                <span className="flex gap-0.5">
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      animate={{ opacity: [0, 1, 0] }}
                      transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.2 }}
                      className="w-1 h-1 bg-blue-400 rounded-full"
                    />
                  ))}
                </span>
              </motion.div>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className={`text-[10px] font-bold uppercase tracking-tighter ${isOnline ? 'text-green-500' : 'text-gray-600'}`}>
                  {isOnline ? 'Session Active' : 'Hors ligne'}
                </span>
                <span className="w-1 h-1 bg-white/10 rounded-full" />
                <div className="flex items-center gap-1 opacity-40">
                   <Lock size={8} className="text-gray-400" />
                   <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">P2P</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* --- ACTIONS DE COMMUNICATION (Fiabilité & Appels) --- */}
      <div className="flex items-center gap-2">
        {!connected && (
          <motion.div 
            animate={{ opacity: [1, 0.4, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="flex items-center gap-1 px-2 py-1 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 mr-2"
          >
            <WifiOff size={14} />
            <span className="text-[9px] font-black uppercase">Connexion...</span>
          </motion.div>
        )}

        <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5">
          <ActionButton 
            onClick={onAudioCall} 
            icon={Phone} 
            disabled={!connected} 
            type="audio" 
          />
          <div className="w-[1px] h-6 bg-white/5 mx-1 self-center" />
          <ActionButton 
            onClick={onVideoCall} 
            icon={Video} 
            disabled={!connected} 
            type="video" 
          />
        </div>
      </div>
    </header>
  );
};

// --- BOUTON D'ACTION PROFESSIONNEL ---
const ActionButton = ({ onClick, icon: Icon, disabled, type }) => (
  <motion.button
    whileTap={{ scale: 0.9 }}
    onClick={onClick}
    disabled={disabled}
    className={`p-3 rounded-xl transition-all flex items-center justify-center
      ${disabled 
        ? 'opacity-20 cursor-not-allowed text-gray-600' 
        : 'text-gray-300 hover:bg-white/10 hover:text-white'
      }`}
  >
    <Icon 
      size={22} 
      strokeWidth={2.5} 
      className={!disabled ? (type === 'video' ? 'text-blue-500' : 'text-indigo-400') : ''} 
    />
  </motion.button>
);