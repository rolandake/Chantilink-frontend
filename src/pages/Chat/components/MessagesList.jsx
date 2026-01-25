// ============================================
// 📁 src/pages/Chat/components/MessagesList.jsx
// VERSION WHATSAPP - STOCKAGE LOCAL DES MÉDIAS
// ============================================
import React, { useMemo, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Check, CheckCheck, FileText, Download, 
  Clock, PhoneMissed, Image as ImageIcon, 
  Play, Pause, Music, File, Video as VideoIcon,
  X, ZoomIn, Shield
} from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";
import { fr } from "date-fns/locale";

// === GESTIONNAIRE DE STOCKAGE LOCAL ===
class LocalMediaStorage {
  constructor() {
    this.dbName = 'WhatsAppMedia';
    this.storeName = 'media';
    this.db = null;
  }

  async init() {
    if (this.db) return this.db;
    
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'id' });
        }
      };
    });
  }

  async saveMedia(messageId, blob, metadata = {}) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      const data = {
        id: messageId,
        blob: blob,
        timestamp: Date.now(),
        ...metadata
      };
      
      const request = store.put(data);
      request.onsuccess = () => resolve(messageId);
      request.onerror = () => reject(request.error);
    });
  }

  async getMedia(messageId) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(messageId);
      
      request.onsuccess = () => {
        if (request.result) {
          const url = URL.createObjectURL(request.result.blob);
          resolve(url);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async deleteMedia(messageId) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(messageId);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clearOldMedia(daysToKeep = 30) {
    const db = await this.init();
    const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.openCursor();
      
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          if (cursor.value.timestamp < cutoffTime) {
            cursor.delete();
          }
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });
  }
}

const mediaStorage = new LocalMediaStorage();

// === HOOK POUR CHARGER LES MÉDIAS ===
const useLocalMedia = (messageId, remoteUrl, type) => {
  const [localUrl, setLocalUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    let objectUrl = null;

    const loadMedia = async () => {
      try {
        setLoading(true);
        
        // 1. Vérifier si le média existe localement
        const cached = await mediaStorage.getMedia(messageId);
        if (cached && isMounted) {
          objectUrl = cached;
          setLocalUrl(cached);
          setLoading(false);
          return;
        }

        // 2. Si pas en cache et qu'il y a une URL distante, télécharger
        if (remoteUrl) {
          const response = await fetch(remoteUrl);
          if (!response.ok) throw new Error('Téléchargement échoué');
          
          const blob = await response.blob();
          
          // 3. Sauvegarder localement
          await mediaStorage.saveMedia(messageId, blob, { type, remoteUrl });
          
          // 4. Créer l'URL local
          if (isMounted) {
            objectUrl = URL.createObjectURL(blob);
            setLocalUrl(objectUrl);
          }
        } else {
          setError('Pas d\'URL disponible');
        }
      } catch (err) {
        console.error('❌ Erreur chargement média:', err);
        if (isMounted) {
          setError(err.message);
          // En cas d'erreur, utiliser l'URL distante directement
          if (remoteUrl) {
            setLocalUrl(remoteUrl);
          }
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadMedia();

    return () => {
      isMounted = false;
      if (objectUrl && objectUrl.startsWith('blob:')) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [messageId, remoteUrl, type]);

  return { localUrl, loading, error };
};

// === DÉTECTION DE CONTENU ===
const detectFileType = (msg) => {
  // Chercher l'URL dans tous les champs possibles
  const url = msg.file || msg.fileUrl || msg.url || msg.attachmentUrl || msg.mediaUrl;
  const declaredType = msg.type;
  const content = msg.content || '';
  
  // Types spéciaux prioritaires
  if (declaredType === 'missed-call' || declaredType === 'system' || declaredType === 'story_reaction') {
    return declaredType;
  }
  
  // Si type explicite
  if (['image', 'video', 'audio', 'file'].includes(declaredType)) {
    return declaredType;
  }
  
  // Détection par URL
  if (url) {
    const ext = url.split('.').pop().toLowerCase().split('?')[0];
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) return 'image';
    if (['mp4', 'mov', 'webm', 'avi', 'mkv'].includes(ext)) return 'video';
    if (['mp3', 'wav', 'm4a', 'ogg', 'webm', 'aac'].includes(ext)) return 'audio';
    if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'zip', 'rar'].includes(ext)) return 'file';
  }
  
  // Détection par nom de fichier dans le contenu
  if (content) {
    const lowerContent = content.toLowerCase();
    if (lowerContent.match(/\.(jpg|jpeg|png|gif|webp)$/)) return 'image';
    if (lowerContent.match(/\.(mp4|mov|webm|avi)$/)) return 'video';
    if (lowerContent.match(/\.(mp3|wav|m4a|ogg)$/)) return 'audio';
    if (lowerContent.match(/\.(pdf|doc|docx|xls|xlsx|txt|zip)$/)) return 'file';
  }
  
  return 'text';
};

// Extraire l'URL du média
const getMediaUrl = (msg) => {
  return msg.file || msg.fileUrl || msg.url || msg.attachmentUrl || msg.mediaUrl || null;
};

// Formater taille
const formatFileSize = (bytes) => {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
};

// Formater durée audio
const formatDuration = (seconds) => {
  if (!seconds) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// === MODAL PREVIEW IMAGE ===
const ImagePreviewModal = ({ src, onClose }) => (
  <AnimatePresence>
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
      >
        <X size={24} className="text-white" />
      </button>
      <img
        src={src}
        alt="Preview"
        className="max-w-full max-h-full object-contain rounded-lg"
        onClick={(e) => e.stopPropagation()}
      />
    </motion.div>
  </AnimatePresence>
);

// === IMAGE MESSAGE (AVEC CACHE LOCAL) ===
const ImageMessage = React.memo(({ messageId, remoteUrl, isMe }) => {
  const { localUrl, loading: mediaLoading } = useLocalMedia(messageId, remoteUrl, 'image');
  const [showPreview, setShowPreview] = useState(false);
  const [loaded, setLoaded] = useState(false);

  return (
    <>
      <div 
        className="relative group cursor-pointer overflow-hidden rounded-lg my-1 max-w-xs"
        onClick={() => localUrl && setShowPreview(true)}
      >
        {(!loaded || mediaLoading) && (
          <div className="absolute inset-0 bg-gray-800 animate-pulse rounded-lg flex items-center justify-center">
            <ImageIcon size={32} className="text-gray-600" />
          </div>
        )}
        {localUrl && (
          <>
            <img 
              src={localUrl} 
              alt="Image" 
              className={`w-full h-auto max-h-80 object-cover rounded-lg transition-all duration-300 ${loaded ? 'opacity-100' : 'opacity-0'} ${isMe ? 'group-hover:brightness-90' : 'group-hover:brightness-110'}`}
              loading="lazy"
              onLoad={() => setLoaded(true)}
              onError={(e) => {
                e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect fill="%23333"/><text x="50%" y="50%" text-anchor="middle" fill="%23666" font-size="14">Image indisponible</text></svg>';
                setLoaded(true);
              }}
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
              <ZoomIn size={32} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </>
        )}
      </div>
      {showPreview && localUrl && <ImagePreviewModal src={localUrl} onClose={() => setShowPreview(false)} />}
    </>
  );
});

// === VIDEO MESSAGE (AVEC CACHE LOCAL) ===
const VideoMessage = React.memo(({ messageId, remoteUrl, isMe }) => {
  const { localUrl, loading: mediaLoading } = useLocalMedia(messageId, remoteUrl, 'video');
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="relative rounded-lg overflow-hidden bg-black my-1 max-w-xs">
      {(!loaded || mediaLoading) && (
        <div className="absolute inset-0 bg-gray-800 animate-pulse flex items-center justify-center">
          <VideoIcon size={32} className="text-gray-600" />
        </div>
      )}
      {localUrl && (
        <video 
          controls
          playsInline
          preload="metadata"
          className={`w-full max-h-80 ${loaded ? 'opacity-100' : 'opacity-0'} transition-opacity`}
          onLoadedMetadata={() => setLoaded(true)}
          onError={(e) => {
            e.target.parentElement.innerHTML = '<div class="p-8 text-center text-gray-500"><p>Vidéo indisponible</p></div>';
          }}
        >
          <source src={localUrl} type="video/mp4" />
          <source src={localUrl} type="video/webm" />
          Votre navigateur ne supporte pas la lecture vidéo.
        </video>
      )}
    </div>
  );
});

// === AUDIO MESSAGE (AVEC CACHE LOCAL) ===
const AudioMessage = React.memo(({ messageId, remoteUrl, isMe }) => {
  const { localUrl, loading: mediaLoading } = useLocalMedia(messageId, remoteUrl, 'audio');
  const [audio, setAudio] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    if (localUrl && !audio) {
      const newAudio = new Audio(localUrl);
      setAudio(newAudio);
    }
  }, [localUrl, audio]);

  useEffect(() => {
    if (!audio) return;

    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleEnded = () => setPlaying(false);

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.pause();
    };
  }, [audio]);

  const togglePlay = () => {
    if (!audio) return;
    
    if (playing) {
      audio.pause();
    } else {
      audio.play();
    }
    setPlaying(!playing);
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (mediaLoading || !localUrl) {
    return (
      <div className={`flex items-center gap-3 p-3 rounded-lg my-1 min-w-[260px] max-w-xs ${isMe ? "bg-white/5" : "bg-[#1c2026]"}`}>
        <div className="w-10 h-10 rounded-full bg-gray-700 animate-pulse" />
        <div className="flex-1">
          <div className="h-6 bg-gray-700 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg my-1 min-w-[260px] max-w-xs ${isMe ? "bg-white/5" : "bg-[#1c2026]"}`}>
      <button
        onClick={togglePlay}
        className={`p-2.5 rounded-full flex-shrink-0 transition-colors ${isMe ? "bg-blue-500 hover:bg-blue-600" : "bg-green-500 hover:bg-green-600"}`}
      >
        {playing ? (
          <Pause size={18} className="text-white" fill="white" />
        ) : (
          <Play size={18} className="text-white ml-0.5" fill="white" />
        )}
      </button>
      
      <div className="flex-1 min-w-0">
        <div className="relative h-8 flex items-center">
          <div className="flex items-center gap-0.5 h-full">
            {[...Array(30)].map((_, i) => (
              <div
                key={i}
                className={`w-1 rounded-full transition-all ${
                  (i / 30) * 100 < progress 
                    ? isMe ? 'bg-blue-400' : 'bg-green-400'
                    : 'bg-gray-600'
                }`}
                style={{ height: `${20 + Math.random() * 60}%` }}
              />
            ))}
          </div>
        </div>
        <div className="flex justify-between items-center mt-1">
          <span className="text-xs text-gray-400">
            {formatDuration(playing ? currentTime : duration)}
          </span>
        </div>
      </div>
    </div>
  );
});

// === FILE MESSAGE (AVEC CACHE LOCAL) ===
const FileMessage = React.memo(({ messageId, remoteUrl, name, size, isMe }) => {
  const { localUrl } = useLocalMedia(messageId, remoteUrl, 'file');
  const fileName = name || 'Document';
  const ext = fileName.split('.').pop().toUpperCase();
  
  const getFileIcon = (extension) => {
    const docTypes = ['PDF', 'DOC', 'DOCX', 'TXT'];
    const sheetTypes = ['XLS', 'XLSX', 'CSV'];
    const archiveTypes = ['ZIP', 'RAR', '7Z'];
    
    if (docTypes.includes(extension)) return '📄';
    if (sheetTypes.includes(extension)) return '📊';
    if (archiveTypes.includes(extension)) return '📦';
    return '📎';
  };

  return (
    <a 
      href={localUrl || remoteUrl || '#'} 
      download={fileName}
      target="_blank" 
      rel="noopener noreferrer" 
      className={`flex items-center gap-3 p-3 rounded-lg transition-all my-1 max-w-xs ${isMe ? "bg-white/5 hover:bg-white/10" : "bg-[#1c2026] hover:bg-[#252a33]"}`}
    >
      <div className="text-3xl flex-shrink-0">
        {getFileIcon(ext)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate text-gray-200">{fileName}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-gray-500 uppercase font-bold">{ext}</span>
          {size && <span className="text-xs text-gray-500">• {formatFileSize(size)}</span>}
        </div>
      </div>
      <Download size={18} className="text-gray-400 flex-shrink-0" />
    </a>
  );
});

// === STORY REACTION ===
const StoryReactionMessage = React.memo(({ content }) => (
  <div className="flex items-center gap-3 p-3 rounded-xl my-1 border bg-purple-500/10 border-purple-500/20 max-w-xs">
    <div className="text-3xl animate-bounce">❤️</div>
    <div className="flex-1 min-w-0">
      <p className="text-xs font-semibold text-gray-300 truncate">
        {content || "Réaction à une story"}
      </p>
    </div>
  </div>
));

// === MISSED CALL ===
const MissedCallMessage = React.memo(({ isMe, metadata }) => (
  <div className={`flex items-center gap-3 p-3 rounded-xl my-1 border ${isMe ? "bg-white/5 border-white/10" : "bg-red-500/10 border-red-500/20"} max-w-xs`}>
    <div className={`p-2 rounded-full ${isMe ? "bg-gray-500/20 text-gray-400" : "bg-red-500/20 text-red-400"}`}>
      <PhoneMissed size={18} />
    </div>
    <div className="flex-1 min-w-0">
      <p className={`text-xs font-bold ${isMe ? "text-gray-400" : "text-red-400"}`}>
        Appel {metadata?.callType === 'video' ? 'vidéo' : 'audio'} manqué
      </p>
    </div>
  </div>
));

// === DATE SEPARATOR ===
const DateSeparator = React.memo(({ date }) => {
  let label = format(new Date(date), "dd MMMM yyyy", { locale: fr });
  if (isToday(new Date(date))) label = "Aujourd'hui";
  if (isYesterday(new Date(date))) label = "Hier";
  
  return (
    <div className="flex justify-center my-4 sticky top-0 z-10">
      <span className="bg-[#1c2026]/95 backdrop-blur-sm text-gray-400 text-xs font-semibold px-3 py-1 rounded-full border border-white/5 shadow-lg">
        {label}
      </span>
    </div>
  );
});

// === MESSAGE ITEM ===
const MessageItem = React.memo(({ 
  msg, 
  prevMsg, 
  currentUserId, 
  onSelectMessage 
}) => {
  const showDate = !prevMsg || new Date(msg.timestamp).toDateString() !== new Date(prevMsg.timestamp).toDateString();
  const senderId = typeof msg.sender === 'object' ? msg.sender._id : msg.sender;
  const isMe = senderId === currentUserId;
  const isTemp = msg.status === 'sending' || msg._id?.toString().startsWith('temp-');
  
  const mediaUrl = getMediaUrl(msg);
  const type = detectFileType(msg);
  const hasContent = msg.content && msg.content.trim() && type !== 'audio';

  const renderContent = () => {
    if (type === 'story_reaction') {
      return <StoryReactionMessage content={msg.content} />;
    }
    if (type === 'missed-call') {
      return <MissedCallMessage isMe={isMe} metadata={msg.metadata} />;
    }
    
    if (type === 'image' && mediaUrl) {
      return <ImageMessage messageId={msg._id} remoteUrl={mediaUrl} isMe={isMe} />;
    }
    if (type === 'video' && mediaUrl) {
      return <VideoMessage messageId={msg._id} remoteUrl={mediaUrl} isMe={isMe} />;
    }
    if (type === 'audio' && mediaUrl) {
      return <AudioMessage messageId={msg._id} remoteUrl={mediaUrl} isMe={isMe} />;
    }
    if (type === 'file' && mediaUrl) {
      return <FileMessage messageId={msg._id} remoteUrl={mediaUrl} name={msg.fileName || msg.originalName} size={msg.fileSize} isMe={isMe} />;
    }
    
    return null;
  };

  if (['story_reaction', 'missed-call'].includes(type)) {
    return (
      <React.Fragment key={msg._id}>
        {showDate && <DateSeparator date={msg.timestamp} />}
        <div className={`flex w-full ${isMe ? "justify-end" : "justify-start"} mb-2`}>
          {renderContent()}
        </div>
      </React.Fragment>
    );
  }

  return (
    <React.Fragment key={msg._id}>
      {showDate && <DateSeparator date={msg.timestamp} />}

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className={`flex w-full ${isMe ? "justify-end" : "justify-start"} mb-1`}
      >
        <div 
          className={`
            relative max-w-[85%] md:max-w-[70%] rounded-2xl shadow-sm
            ${type === 'image' || type === 'video' ? '' : 'px-3 py-2'}
            ${isMe 
              ? `${type === 'image' || type === 'video' ? 'bg-transparent' : 'bg-[#005c4b]'} text-white rounded-tr-md` 
              : `${type === 'image' || type === 'video' ? 'bg-transparent' : 'bg-[#202c33]'} text-gray-100 rounded-tl-md`}
            ${isTemp ? "opacity-60" : "opacity-100"}
          `}
          onContextMenu={(e) => { 
            e.preventDefault(); 
            onSelectMessage?.(msg); 
          }}
        >
          {renderContent()}
          
          {hasContent && (
            <p className={`text-sm leading-relaxed whitespace-pre-wrap break-words ${type === 'file' ? 'mt-2' : ''}`}>
              {msg.content}
            </p>
          )}

          <div className={`flex items-center justify-end gap-1 ${hasContent || type === 'file' ? 'mt-1' : 'absolute bottom-2 right-2'} text-xs ${
            type === 'image' || type === 'video' 
              ? 'text-white drop-shadow-lg' 
              : isMe ? 'text-gray-300' : 'text-gray-500'
          }`}>
            <span className="font-medium">
              {format(new Date(msg.timestamp || Date.now()), "HH:mm")}
            </span>
            {isMe && (
              <span className="shrink-0">
                {isTemp ? (
                  <Clock size={14} className="animate-pulse" />
                ) : msg.read ? (
                  <CheckCheck size={16} className="text-blue-400" />
                ) : (
                  <Check size={16} />
                )}
              </span>
            )}
          </div>
        </div>
      </motion.div>
    </React.Fragment>
  );
});

// === COMPOSANT PRINCIPAL ===
export const MessagesList = ({ 
  messages = [], 
  loading, 
  currentUserId, 
  onSelectMessage, 
  endRef 
}) => {
  
  // Nettoyage des anciens médias au montage
  useEffect(() => {
    mediaStorage.clearOldMedia(30).catch(console.error);
  }, []);

  const sortedMessages = useMemo(() => {
    return [...messages].sort((a, b) => 
      new Date(a.timestamp) - new Date(b.timestamp)
    );
  }, [messages]);

  if (loading && messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#0b0d10]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-gray-700 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Chargement des messages...</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="flex-1 overflow-y-auto px-3 md:px-6 pb-4 space-y-0.5 bg-[#0b0d10]"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.02'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
      }}
    >
      {sortedMessages.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full opacity-30">
          <Shield size={64} className="mb-4 text-gray-600" />
          <p className="text-sm font-semibold text-gray-500">Messages chiffrés de bout en bout</p>
          <p className="text-xs text-gray-600 mt-1">Envoyez votre premier message</p>
        </div>
      ) : (
        sortedMessages.map((msg, index) => (
          <MessageItem
            key={msg._id || `msg-${index}`}
            msg={msg}
            prevMsg={sortedMessages[index - 1]}
            currentUserId={currentUserId}
            onSelectMessage={onSelectMessage}
          />
        ))
      )}
      <div ref={endRef} className="h-2" />
    </div>
  );
};