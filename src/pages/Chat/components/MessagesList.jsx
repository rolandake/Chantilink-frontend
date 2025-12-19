// ============================================
// 📁 src/pages/Chat/components/MessagesList.jsx
// VERSION: ÉLITE - SECURE & PROFESSIONAL UX
// ============================================
import React from "react";
import { motion } from "framer-motion";
import { 
  Check, CheckCheck, FileText, Download, 
  Clock, PhoneMissed, Image as ImageIcon, 
  PlayCircle, Shield
} from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";
import { fr } from "date-fns/locale";

// === DÉTECTION DE CONTENU SÉCURISÉE ===
const detectFileType = (url, declaredType) => {
  if (declaredType === 'missed-call') return 'missed-call';
  if (['image', 'video', 'audio', 'file'].includes(declaredType)) return declaredType;
  
  const ext = url.split('.').pop().toLowerCase().split('?')[0];
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'image';
  if (['mp4', 'mov', 'webm'].includes(ext)) return 'video';
  if (['mp3', 'wav', 'm4a'].includes(ext)) return 'audio';
  return 'file';
};

// --- SOUS-COMPOSANTS DE MÉDIAS ---

const ImageMessage = ({ src }) => (
  <div className="relative group cursor-pointer overflow-hidden rounded-xl my-1" onClick={() => window.open(src, '_blank')}>
    <img src={src} alt="Media" className="max-w-full max-h-[320px] object-cover rounded-xl bg-[#1a1d23] hover:scale-[1.02] transition-transform duration-300" loading="lazy" />
    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
      <ImageIcon className="text-white" size={24} />
    </div>
  </div>
);

const VideoMessage = ({ src }) => (
  <div className="relative rounded-xl overflow-hidden bg-black my-1 border border-white/5">
    <video controls className="w-full max-h-[300px]" preload="metadata">
      <source src={src} />
    </video>
  </div>
);

const FileMessage = ({ src, name, isMe }) => (
  <a href={src} target="_blank" rel="noopener noreferrer" 
     className={`flex items-center gap-3 p-3 rounded-xl transition-all my-1 border ${isMe ? "bg-white/10 border-white/10" : "bg-[#1c2026] border-white/5 hover:bg-[#252a33]"}`}>
    <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
      <FileText size={20} />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-xs font-bold truncate text-gray-200">{name || "Document"}</p>
      <p className="text-[10px] text-gray-500 uppercase font-black tracking-tighter">Fichier Sécurisé</p>
    </div>
    <Download size={16} className="text-gray-500" />
  </a>
);

const MissedCallMessage = ({ isMe, timestamp, metadata }) => (
  <div className={`flex items-center gap-3 p-3 rounded-xl my-1 border ${isMe ? "bg-white/5 border-white/10" : "bg-red-500/5 border-red-500/20"}`}>
    <div className={`p-2 rounded-full ${isMe ? "bg-gray-500/20 text-gray-400" : "bg-red-500/20 text-red-400"}`}>
      <PhoneMissed size={18} />
    </div>
    <div>
      <p className={`text-xs font-bold ${isMe ? "text-gray-400" : "text-red-400"}`}>
        Appel {metadata?.callType === 'video' ? 'vidéo' : 'audio'} manqué
      </p>
      <p className="text-[10px] text-gray-500 uppercase tracking-widest">{format(new Date(timestamp), "HH:mm")}</p>
    </div>
  </div>
);

const DateSeparator = ({ date }) => {
  let label = format(new Date(date), "dd MMMM yyyy", { locale: fr });
  if (isToday(new Date(date))) label = "Aujourd'hui";
  if (isYesterday(new Date(date))) label = "Hier";
  return (
    <div className="flex justify-center my-6 sticky top-2 z-20">
      <span className="bg-[#1c2026]/90 backdrop-blur-md text-gray-500 text-[10px] font-black uppercase tracking-[0.2em] px-4 py-1.5 rounded-full border border-white/5 shadow-xl">
        {label}
      </span>
    </div>
  );
};

// === COMPOSANT PRINCIPAL ===
export const MessagesList = ({ messages = [], loading, currentUserId, onSelectMessage, endRef }) => {
  
  if (loading && messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#0b0d10]">
        <div className="w-8 h-8 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-1 custom-scrollbar bg-[#0b0d10]">
      {messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full opacity-20 grayscale">
          <Shield size={48} className="mb-4" />
          <p className="text-xs font-black uppercase tracking-widest text-white">Canal Privé Chiffré</p>
        </div>
      ) : (
        messages.map((msg, index) => {
          const prevMsg = messages[index - 1];
          const showDate = !prevMsg || new Date(msg.timestamp).toDateString() !== new Date(prevMsg.timestamp).toDateString();
          const senderId = typeof msg.sender === 'object' ? msg.sender._id : msg.sender;
          const isMe = senderId === currentUserId;
          const isTemp = msg.status === 'sending' || msg._id?.toString().startsWith('temp-');
          
          const fileUrl = msg.file || msg.fileUrl || msg.url;
          const type = detectFileType(fileUrl || '', msg.type);

          return (
            <React.Fragment key={msg._id || index}>
              {showDate && <DateSeparator date={msg.timestamp} />}

              <motion.div
                initial={{ opacity: 0, x: isMe ? 20 : -20 }}
                animate={{ opacity: 1, x: 0 }}
                className={`flex w-full ${isMe ? "justify-end" : "justify-start"} mb-1`}
              >
                <div 
                  className={`
                    relative px-4 py-2.5 max-w-[85%] md:max-w-[70%] rounded-2xl shadow-sm
                    ${isMe 
                      ? "bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-tr-none" 
                      : "bg-[#1c2026] text-gray-100 rounded-tl-none border border-white/5"}
                    ${isTemp ? "opacity-60" : "opacity-100"}
                  `}
                  onContextMenu={(e) => { e.preventDefault(); onSelectMessage?.(msg); }}
                >
                  {/* RENDU DES CONTENUS */}
                  {type === 'missed-call' ? (
                    <MissedCallMessage isMe={isMe} timestamp={msg.timestamp} metadata={msg.metadata} />
                  ) : (
                    <>
                      {type === 'image' && fileUrl && <ImageMessage src={fileUrl} />}
                      {type === 'video' && fileUrl && <VideoMessage src={fileUrl} />}
                      {type === 'file' && fileUrl && <FileMessage src={fileUrl} name={msg.fileName || msg.originalName} isMe={isMe} />}
                      
                      {msg.content && (
                        <p className="text-sm md:text-[15px] leading-relaxed whitespace-pre-wrap break-words">
                          {msg.content}
                        </p>
                      )}
                    </>
                  )}

                  {/* FOOTER DE LA BULLE (Heure + Status) */}
                  <div className={`flex items-center justify-end gap-1.5 mt-1 text-[9px] font-bold uppercase tracking-tighter ${isMe ? "text-white/60" : "text-gray-500"}`}>
                    <span>{format(new Date(msg.timestamp || Date.now()), "HH:mm")}</span>
                    {isMe && (
                      <span className="shrink-0">
                        {isTemp ? (
                          <Clock size={10} className="animate-pulse" />
                        ) : msg.read ? (
                          <CheckCheck size={12} className="text-blue-300" />
                        ) : (
                          <Check size={12} />
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            </React.Fragment>
          );
        })
      )}
      <div ref={endRef} className="h-4" />
    </div>
  );
};