// ============================================
// 📁 src/pages/Chat/components/ChatInput.jsx - AMÉLIORÉ
// ============================================
import React from "react";
import { Send, Mic, Paperclip, Smile, StopCircle, X, Play, Pause } from "lucide-react";
import EmojiPicker from 'emoji-picker-react';
import { motion, AnimatePresence } from "framer-motion";

export const ChatInput = ({
  input, onChange, onSend,
  recording, onStartRecording, onStopRecording, onCancelAudio, onSendAudio,
  audioUrl, isPlaying, onPlayPreview, onPausePreview,
  showEmoji, onToggleEmoji, onEmojiSelect,
  uploading, onUpload, connected,
  txtRef, fileRef, audioRef
}) => {

  // Gestion de la touche Entrée
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  // Déclencheur pour l'input file caché
  const handleFileClick = () => {
    if (!connected || uploading || recording) return;
    fileRef.current?.click();
  };

  return (
    <div className="w-full bg-gray-900/95 backdrop-blur-xl border-t border-gray-800 p-2 md:p-4 z-30 relative">
      
      {/* --- PRÉVISUALISATION AUDIO --- */}
      <AnimatePresence>
        {audioUrl && (
          <motion.div 
            initial={{ opacity: 0, height: 0, y: 10 }} 
            animate={{ opacity: 1, height: 'auto', y: 0 }} 
            exit={{ opacity: 0, height: 0, y: 10 }}
            className="flex items-center gap-3 bg-gray-800 p-3 rounded-xl mb-3 mx-1 shadow-lg border border-gray-700 overflow-hidden"
          >
            <button 
              onClick={isPlaying ? onPausePreview : onPlayPreview}
              className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center text-white hover:bg-orange-600 transition"
            >
              {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-1" />}
            </button>
            
            <div className="flex-1 flex flex-col justify-center gap-1">
              <span className="text-xs text-gray-300 font-medium">Message vocal</span>
              <div className="h-1 w-full bg-gray-700 rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-gradient-to-r from-orange-500 to-pink-500"
                  animate={{ width: isPlaying ? "100%" : "0%" }}
                  transition={{ duration: 10, ease: "linear" }}
                />
              </div>
            </div>

            {/* Audio element caché */}
            {audioRef && <audio ref={audioRef} src={audioUrl} className="hidden" />}

            <div className="flex gap-2">
              <button 
                onClick={onCancelAudio} 
                className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition"
                title="Annuler"
              >
                <X size={20}/>
              </button>
              <button 
                onClick={onSendAudio} 
                className="p-2 text-green-400 hover:bg-green-500/10 rounded-lg transition"
                title="Envoyer"
              >
                <Send size={20}/>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-end gap-2 max-w-5xl mx-auto relative">
        
        {/* --- SELECTEUR EMOJI --- */}
        <AnimatePresence>
          {showEmoji && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="absolute bottom-20 left-0 z-50 shadow-2xl rounded-2xl overflow-hidden"
            >
              <EmojiPicker 
                onEmojiClick={onEmojiSelect} 
                theme="dark" 
                width={320} 
                height={400} 
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* --- ACTIONS GAUCHE (Fichier / Emoji) --- */}
        <div className="flex pb-2 gap-1 text-gray-400">
          <motion.button 
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleFileClick} 
            disabled={!connected || uploading || recording}
            className="p-2.5 hover:text-white hover:bg-gray-800 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
            title="Joindre un fichier"
          >
            {uploading ? (
              <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Paperclip size={22} />
            )}
          </motion.button>

          {/* Input file caché : gère tous les types */}
          <input 
            type="file" 
            ref={fileRef} 
            className="hidden" 
            onChange={onUpload} 
            disabled={uploading || !connected}
            accept="image/*,video/*,audio/*,application/pdf,.doc,.docx,.txt,.zip,.rar" 
          />
          
          <motion.button 
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onToggleEmoji}
            disabled={recording}
            className={`p-2.5 hover:bg-gray-800 rounded-xl transition hidden md:block disabled:opacity-50 ${
              showEmoji ? 'text-yellow-400' : 'hover:text-yellow-400'
            }`}
            title="Emojis"
          >
            <Smile size={22} />
          </motion.button>
        </div>

        {/* --- INPUT TEXTE --- */}
        <div className="flex-1 bg-gray-800/50 rounded-2xl border border-gray-700 focus-within:border-orange-500/50 focus-within:bg-gray-800 transition-all flex items-center min-h-[48px]">
          <textarea
            ref={txtRef}
            value={input}
            onChange={onChange}
            onKeyDown={handleKeyDown}
            disabled={!connected || recording}
            placeholder={
              recording 
                ? "Enregistrement audio en cours..." 
                : !connected 
                ? "Hors ligne..." 
                : "Écrivez un message..."
            }
            rows={1}
            className="w-full bg-transparent text-white px-4 py-3 max-h-32 resize-none outline-none custom-scrollbar placeholder:text-gray-500 disabled:cursor-not-allowed"
          />
        </div>

        {/* --- BOUTON ACTION (Micro / Envoyer) --- */}
        <div className="pb-1">
          <AnimatePresence mode="wait">
            {input.trim() || audioUrl ? (
              <motion.button
                key="send-btn"
                initial={{ scale: 0, opacity: 0 }} 
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                onClick={onSend}
                disabled={!connected || uploading}
                className="p-3 bg-gradient-to-r from-orange-500 to-pink-600 text-white rounded-full shadow-lg shadow-orange-900/30 hover:scale-105 transition disabled:opacity-50 disabled:cursor-not-allowed"
                title="Envoyer"
              >
                <Send size={20} />
              </motion.button>
            ) : (
              <motion.button
                key="mic-btn"
                initial={{ scale: 0, opacity: 0 }} 
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                onClick={recording ? onStopRecording : onStartRecording}
                disabled={!connected}
                className={`p-3 rounded-full shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                  recording 
                    ? "bg-red-500 text-white animate-pulse shadow-red-500/30" 
                    : "bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white"
                }`}
                title={recording ? "Arrêter l'enregistrement" : "Enregistrer un message vocal"}
              >
                {recording ? <StopCircle size={20} /> : <Mic size={20} />}
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* --- INDICATEURS D'ÉTAT --- */}
      {!connected && (
        <div className="absolute top-1 left-1/2 transform -translate-x-1/2">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-500/90 text-white text-xs px-3 py-1 rounded-full"
          >
            Hors ligne
          </motion.div>
        </div>
      )}

      {uploading && (
        <div className="absolute top-1 left-1/2 transform -translate-x-1/2">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-blue-500/90 text-white text-xs px-3 py-1 rounded-full flex items-center gap-2"
          >
            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Envoi en cours...
          </motion.div>
        </div>
      )}
    </div>
  );
};