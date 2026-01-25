// ============================================
// 📁 src/pages/Chat/components/ChatInput.jsx
// STYLE WHATSAPP - ENREGISTREMENT + FICHIERS
// ============================================
import React, { useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Paperclip, Send, Mic, X, Play, Pause, 
  Smile, Image, FileText, Video, Trash2
} from "lucide-react";
import EmojiPicker from "emoji-picker-react";

export const ChatInput = ({
  input,
  onChange,
  onSend,
  recording,
  onStartRecording,
  onStopRecording,
  onCancelAudio,
  onSendAudio,
  audioUrl,
  isPlaying,
  onPlayPreview,
  onPausePreview,
  showEmoji,
  onToggleEmoji,
  onEmojiSelect,
  uploading,
  onUpload,
  connected,
  txtRef,
  fileRef
}) => {
  const [showAttachMenu, setShowAttachMenu] = React.useState(false);
  const [recordingTime, setRecordingTime] = React.useState(0);
  const timerRef = useRef(null);

  // Timer pour l'enregistrement
  useEffect(() => {
    if (recording) {
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setRecordingTime(0);
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [recording]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (input.trim()) {
        onSend();
      }
    }
  };

  const handleFileSelect = (type) => {
    setShowAttachMenu(false);
    fileRef.current?.click();
  };

  // Mode enregistrement audio
  if (recording || audioUrl) {
    return (
      <div className="bg-[#1c2026] border-t border-white/5 p-3">
        <div className="flex items-center gap-3">
          {recording ? (
            // En cours d'enregistrement
            <>
              <button
                onClick={onCancelAudio}
                className="p-3 bg-red-500/20 hover:bg-red-500/30 rounded-full transition-all"
              >
                <Trash2 size={20} className="text-red-500" />
              </button>
              
              <div className="flex-1 flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-sm font-mono text-gray-300">
                    {formatTime(recordingTime)}
                  </span>
                </div>
                
                <div className="flex-1 flex items-center gap-1">
                  {[...Array(20)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="w-1 bg-blue-500 rounded-full"
                      animate={{
                        height: [8, 16, 8],
                      }}
                      transition={{
                        duration: 0.5,
                        repeat: Infinity,
                        delay: i * 0.05,
                      }}
                    />
                  ))}
                </div>
              </div>

              <button
                onClick={onStopRecording}
                className="p-3 bg-blue-600 hover:bg-blue-500 rounded-full transition-all"
              >
                <Send size={20} className="text-white" />
              </button>
            </>
          ) : (
            // Preview audio
            <>
              <button
                onClick={onCancelAudio}
                className="p-3 bg-red-500/20 hover:bg-red-500/30 rounded-full transition-all"
              >
                <X size={20} className="text-red-500" />
              </button>

              <button
                onClick={isPlaying ? onPausePreview : onPlayPreview}
                className="p-3 bg-green-500/20 hover:bg-green-500/30 rounded-full transition-all"
              >
                {isPlaying ? (
                  <Pause size={20} className="text-green-500" />
                ) : (
                  <Play size={20} className="text-green-500" />
                )}
              </button>

              <div className="flex-1">
                <div className="flex items-center gap-1">
                  {[...Array(30)].map((_, i) => (
                    <div
                      key={i}
                      className="w-1 bg-green-500 rounded-full"
                      style={{ height: `${8 + Math.random() * 16}px` }}
                    />
                  ))}
                </div>
              </div>

              <button
                onClick={onSendAudio}
                className="p-3 bg-blue-600 hover:bg-blue-500 rounded-full transition-all shadow-lg"
              >
                <Send size={20} className="text-white" />
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // Mode normal
  return (
    <div className="bg-[#1c2026] border-t border-white/5 p-3 relative">
      {/* Menu des pièces jointes */}
      <AnimatePresence>
        {showAttachMenu && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="absolute bottom-full left-4 mb-2 bg-[#2a3942] rounded-2xl shadow-2xl p-3 border border-white/10"
          >
            <div className="flex gap-3">
              <button
                onClick={() => handleFileSelect('image')}
                className="flex flex-col items-center gap-2 p-3 bg-purple-500/20 hover:bg-purple-500/30 rounded-xl transition-all group"
              >
                <div className="p-2 bg-purple-500 rounded-full">
                  <Image size={20} className="text-white" />
                </div>
                <span className="text-xs text-gray-300">Image</span>
              </button>

              <button
                onClick={() => handleFileSelect('video')}
                className="flex flex-col items-center gap-2 p-3 bg-pink-500/20 hover:bg-pink-500/30 rounded-xl transition-all group"
              >
                <div className="p-2 bg-pink-500 rounded-full">
                  <Video size={20} className="text-white" />
                </div>
                <span className="text-xs text-gray-300">Vidéo</span>
              </button>

              <button
                onClick={() => handleFileSelect('file')}
                className="flex flex-col items-center gap-2 p-3 bg-blue-500/20 hover:bg-blue-500/30 rounded-xl transition-all group"
              >
                <div className="p-2 bg-blue-500 rounded-full">
                  <FileText size={20} className="text-white" />
                </div>
                <span className="text-xs text-gray-300">Document</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Emoji Picker */}
      <AnimatePresence>
        {showEmoji && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-full right-4 mb-2"
          >
            <EmojiPicker
              onEmojiClick={onEmojiSelect}
              theme="dark"
              searchPlaceholder="Rechercher un emoji..."
              width={350}
              height={400}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-end gap-2">
        {/* Bouton Emoji */}
        <button
          onClick={onToggleEmoji}
          className="p-2.5 hover:bg-white/5 rounded-full transition-colors flex-shrink-0"
        >
          <Smile size={24} className="text-gray-400 hover:text-yellow-500 transition-colors" />
        </button>

        {/* Bouton Pièce jointe */}
        <button
          onClick={() => setShowAttachMenu(!showAttachMenu)}
          className="p-2.5 hover:bg-white/5 rounded-full transition-colors flex-shrink-0"
        >
          <Paperclip size={24} className="text-gray-400 hover:text-blue-500 transition-colors" />
        </button>

        {/* Input file caché */}
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.rar"
          onChange={onUpload}
          className="hidden"
        />

        {/* Zone de texte */}
        <div className="flex-1 bg-[#2a3942] rounded-2xl border border-white/5 overflow-hidden">
          <textarea
            ref={txtRef}
            value={input}
            onChange={onChange}
            onKeyDown={handleKeyPress}
            placeholder={connected ? "Message privé..." : "Hors ligne..."}
            disabled={!connected || uploading}
            rows={1}
            className="w-full px-4 py-3 bg-transparent text-white resize-none outline-none placeholder-gray-500 max-h-32"
            style={{ 
              minHeight: '48px',
              maxHeight: '128px',
            }}
            onInput={(e) => {
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px';
            }}
          />
        </div>

        {/* Bouton Envoyer / Micro */}
        {input.trim() ? (
          <button
            onClick={onSend}
            disabled={!connected || uploading}
            className="p-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-full transition-all flex-shrink-0 shadow-lg"
          >
            <Send size={22} className="text-white" />
          </button>
        ) : (
          <button
            onClick={onStartRecording}
            disabled={!connected}
            className="p-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-full transition-all flex-shrink-0 shadow-lg"
          >
            <Mic size={22} className="text-white" />
          </button>
        )}
      </div>

      {/* Indicateur upload */}
      {uploading && (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-[#2a3942] px-6 py-3 rounded-full flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            <span className="text-sm text-white">Envoi en cours...</span>
          </div>
        </div>
      )}

      {/* Indicateur connexion */}
      {!connected && (
        <div className="absolute top-0 left-0 right-0 -translate-y-full bg-red-500/20 border border-red-500/30 px-4 py-2">
          <p className="text-xs text-red-400 text-center">
            ⚠️ Connexion perdue - Reconnexion en cours...
          </p>
        </div>
      )}
    </div>
  );
};