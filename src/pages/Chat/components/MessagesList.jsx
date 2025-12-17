// ============================================
// 📁 src/pages/Chat/components/MessagesList.jsx - AMÉLIORÉ
// ============================================
import React from "react";
import { motion } from "framer-motion";
import { Check, CheckCheck, FileText, Download, Clock } from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";
import { fr } from "date-fns/locale";

// === FONCTION DE DÉTECTION ROBUSTE ===
const detectFileType = (url, declaredType) => {
  // 1. Si type explicite valide, utiliser
  if (['image', 'video', 'audio', 'file'].includes(declaredType)) {
    return declaredType;
  }
  
  // 2. Vérifier extension
  const ext = url.split('.').pop().toLowerCase().split('?')[0];
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return 'image';
  if (['mp4', 'mov', 'webm', 'avi'].includes(ext)) return 'video';
  if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) return 'audio';
  
  // 3. Vérifier patterns Cloudinary/S3
  if (url.includes('/image/upload/')) return 'image';
  if (url.includes('/video/upload/')) return 'video';
  if (url.includes('/raw/upload/')) return 'file';
  
  // 4. Fallback
  return 'file';
};

// === SOUS-COMPOSANTS ===
const DateSeparator = ({ date }) => {
  let label = format(new Date(date), "dd MMMM yyyy", { locale: fr });
  if (isToday(new Date(date))) label = "Aujourd'hui";
  if (isYesterday(new Date(date))) label = "Hier";
  return (
    <div className="flex justify-center my-4 sticky top-0 z-10">
      <span className="bg-gray-800/80 backdrop-blur-sm text-gray-300 text-xs px-3 py-1 rounded-full border border-gray-700 shadow-sm">
        {label}
      </span>
    </div>
  );
};

const ImageMessage = ({ src }) => (
  <div 
    className="relative group cursor-pointer overflow-hidden rounded-lg mb-1 mt-1" 
    onClick={() => window.open(src, '_blank')}
  >
    <img 
      src={src} 
      alt="Media" 
      className="max-w-[280px] max-h-[300px] object-cover rounded-lg bg-gray-900" 
      loading="lazy"
      onError={(e) => {
        e.target.style.display = 'none';
        e.target.parentElement.innerHTML = '<div class="p-4 bg-red-500/10 text-red-400 rounded-lg text-sm">Image non disponible</div>';
      }}
    />
  </div>
);

const VideoMessage = ({ src }) => (
  <div className="rounded-lg overflow-hidden max-w-[280px] bg-black mt-1">
    <video 
      controls 
      className="w-full max-h-[300px]" 
      preload="metadata"
      onError={(e) => {
        e.target.style.display = 'none';
        e.target.parentElement.innerHTML = '<div class="p-4 bg-red-500/10 text-red-400 rounded-lg text-sm">Vidéo non disponible</div>';
      }}
    >
      <source src={src} type="video/mp4" />
      Votre navigateur ne supporte pas la lecture vidéo.
    </video>
  </div>
);

const AudioMessage = ({ src, isMe }) => (
  <div className={`flex items-center gap-2 p-2 rounded-lg mt-1 min-w-[200px] ${
    isMe ? 'bg-white/10' : 'bg-gray-300 dark:bg-gray-700'
  }`}>
    <audio 
      controls 
      className="h-8 w-full max-w-[240px]" 
      src={src} 
      preload="metadata"
      onError={(e) => {
        e.target.style.display = 'none';
        e.target.parentElement.innerHTML = '<div class="text-red-400 text-xs">Audio non disponible</div>';
      }}
    />
  </div>
);

const FileMessage = ({ src, name, isMe }) => (
  <a 
    href={src} 
    target="_blank" 
    rel="noopener noreferrer" 
    className={`flex items-center gap-3 p-3 rounded-lg transition-colors mt-1 ${
      isMe 
        ? "bg-white/20 hover:bg-white/30" 
        : "bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
    }`}
  >
    <div className="p-2 bg-white rounded-full text-orange-500">
      <FileText size={20} />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium truncate">{name || "Télécharger le fichier"}</p>
    </div>
    <Download size={16} />
  </a>
);

// === COMPOSANT PRINCIPAL ===
export const MessagesList = ({ 
  messages = [], 
  loading, 
  currentUserId, 
  onSelectMessage, 
  endRef 
}) => {
  
  if (loading && messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
      {messages.length === 0 && (
        <div className="flex flex-col items-center justify-center h-full text-gray-400 opacity-50">
          <p>Aucun message. Dites bonjour ! 👋</p>
        </div>
      )}

      {messages.map((msg, index) => {
        const prevMsg = messages[index - 1];
        const showDate = !prevMsg || new Date(msg.timestamp).toDateString() !== new Date(prevMsg.timestamp).toDateString();
        
        const senderId = typeof msg.sender === 'object' ? msg.sender._id : msg.sender;
        const isMe = senderId === currentUserId;
        const isTemp = msg._id?.toString().startsWith('temp-') || msg.status === 'sending';
        
        // 🔍 DÉTECTION INTELLIGENTE DU CONTENU
        const fileUrl = msg.file || msg.fileUrl || msg.mediaUrl || msg.attachmentUrl || msg.url;
        
        // Utiliser la fonction de détection robuste
        const type = fileUrl ? detectFileType(fileUrl, msg.type) : msg.type || 'text';

        return (
          <React.Fragment key={msg._id || index}>
            {showDate && <DateSeparator date={msg.timestamp} />}

            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className={`flex w-full ${isMe ? "justify-end" : "justify-start"}`}
            >
              <div 
                className={`
                  relative px-3 py-2 max-w-[85%] sm:max-w-[70%] rounded-2xl shadow-sm text-sm sm:text-base break-words
                  ${isMe 
                    ? "bg-gradient-to-br from-orange-500 to-pink-600 text-white rounded-tr-none" 
                    : "bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-100 rounded-tl-none border border-gray-100 dark:border-gray-700"}
                  ${isTemp ? "opacity-70" : "opacity-100"}
                `}
                onContextMenu={(e) => { 
                  e.preventDefault(); 
                  onSelectMessage && onSelectMessage(msg); 
                }}
              >
                {/* AFFICHAGE CONDITIONNEL SELON LE TYPE DÉTECTÉ */}
                {type === 'image' && fileUrl && <ImageMessage src={fileUrl} />}
                {type === 'video' && fileUrl && <VideoMessage src={fileUrl} />}
                {type === 'audio' && fileUrl && <AudioMessage src={fileUrl} isMe={isMe} />}
                {type === 'file' && fileUrl && (
                  <FileMessage 
                    src={fileUrl} 
                    name={msg.originalName || msg.fileName || 'Fichier'} 
                    isMe={isMe} 
                  />
                )}

                {msg.content && (
                  <p className={`whitespace-pre-wrap leading-relaxed ${fileUrl ? "mt-2" : ""}`}>
                    {msg.content}
                  </p>
                )}

                <div className={`flex items-center justify-end gap-1 mt-1 text-[10px] select-none ${
                  isMe ? "text-white/80" : "text-gray-500"
                }`}>
                  <span>
                    {format(new Date(msg.timestamp || Date.now()), "HH:mm")}
                  </span>
                  {isMe && (
                    <span className="ml-0.5">
                      {isTemp ? (
                        <Clock size={12} className="animate-pulse" />
                      ) : msg.read ? (
                        <CheckCheck size={14} className="text-blue-200" />
                      ) : (
                        <Check size={14} />
                      )}
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          </React.Fragment>
        );
      })}
      <div ref={endRef} className="h-2" />
    </div>
  );
};