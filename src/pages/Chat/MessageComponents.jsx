
// ============================================
// 📁 src/Pages/chat/MessageComponents.jsx
// ============================================
import React from 'react';
import { motion } from 'framer-motion';
import { Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fmt } from '../../utils/messageConstants';

export const StoryReactionMessage = ({ message, isMine }) => {
  const navigate = useNavigate();
  const metadata = message.metadata || {};
  const emoji = metadata.emoji || "❤️";
  const reactorName = metadata.reactorName || message.sender?.username || message.sender?.fullName || "Quelqu'un";
  const storyId = metadata.storyId;
  const slideIndex = metadata.slideIndex ?? 0;
  const storyPreview = metadata.storyPreview;

  const handleClick = (e) => {
    e.stopPropagation();
    if (!storyId) return;
    navigate(`/stories/${storyId}?slide=${slideIndex}`);
  };

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      onClick={handleClick}
      className={`max-w-[70%] ${isMine ? "ml-auto" : ""} ${storyId ? "cursor-pointer" : "cursor-not-allowed opacity-70"} group`}
    >
      <div className={`p-4 rounded-2xl border-2 transition-all ${storyId ? "hover:scale-[1.02]" : ""} ${
        isMine
          ? "bg-gradient-to-r from-pink-500/20 to-purple-500/20 border-pink-500/30 hover:border-pink-500/50"
          : "bg-gradient-to-r from-orange-500/20 to-red-500/20 border-orange-500/30 hover:border-orange-500/50"
      }`}>
        <div className="flex items-center gap-3">
          <div className={`text-4xl ${storyId ? "animate-bounce group-hover:scale-110" : ""} transition-transform`}>
            {emoji}
          </div>
          {storyPreview && (
            <div className="w-12 h-12 rounded-lg overflow-hidden border-2 border-white/20 flex-shrink-0">
              <img src={storyPreview} alt="Story preview" className="w-full h-full object-cover" loading="lazy" onError={(e) => e.target.style.display = 'none'} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm truncate">
              {isMine ? "Vous avez réagi à une story" : `${reactorName} a réagi à votre story`}
            </p>
            <p className={`text-xs mt-1 flex items-center gap-1 ${storyId ? "text-white/70" : "text-red-400"}`}>
              <Eye className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">
                {storyId ? "Touchez pour voir la story" : "Story expirée ou supprimée"}
              </span>
            </p>
          </div>
        </div>
        <div className="text-xs text-white/50 mt-2 text-right">
          {fmt(message.timestamp)}
        </div>
      </div>
    </motion.div>
  );
};

export const MissedCallMessage = ({ message, isMine }) => (
  <div className={`max-w-[70%] ${isMine ? "ml-auto" : ""}`}>
    <div className={`p-3 rounded-2xl ${isMine ? "bg-gradient-to-r from-orange-500 to-pink-500 text-white" : "bg-gray-700 text-white"}`}>
      <p className="text-sm italic">{message.content}</p>
      <div className="text-xs opacity-70 mt-1 flex justify-between">
        <span>{fmt(message.timestamp)}</span>
        {isMine && <span>{message.read ? "Vu" : "Envoyé"}</span>}
      </div>
    </div>
  </div>
);

export const StandardMessage = ({ message, isMine, onClick }) => (
  <div onClick={onClick} className={`max-w-[70%] ${isMine ? "ml-auto" : ""}`}>
    <div className={`p-3 rounded-2xl ${isMine ? "bg-gradient-to-r from-orange-500 to-pink-500 text-white" : "bg-gray-700 text-white"}`}>
      {message.content && <p className="break-words">{message.content}</p>}
      {message.file && (
        message.file.match(/\.(jpg|jpeg|png|gif|webp)$/i)
          ? <img src={message.file} className="max-w-full rounded-lg mt-2" alt="attachment" />
          : message.file.match(/\.(mp3|wav)$/i)
          ? <audio controls src={message.file} className="w-full mt-2" />
          : <a href={message.file} target="_blank" rel="noopener noreferrer" className="text-sm underline">Fichier</a>
      )}
      <div className="text-xs opacity-70 mt-1 flex justify-between">
        <span>{fmt(message.timestamp)}</span>
        {isMine && <span>{message.read ? "Vu" : "Envoyé"}</span>}
      </div>
    </div>
  </div>
);

