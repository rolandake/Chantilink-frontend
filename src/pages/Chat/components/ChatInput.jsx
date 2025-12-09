// ============================================
// 📁 src/pages/Chat/components/ChatInput.jsx
// ============================================
import React, { useRef, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, Paperclip, Smile, Mic, X, Play, Pause, Check 
} from 'lucide-react';
import Picker from 'emoji-picker-react';

const ChatInput = ({
  input,
  onChange,
  onSend,
  onUpload,
  recording,
  audioBlob,
  audioUrl,
  isPlaying,
  audioRef,
  onStartRecording,
  onStopRecording,
  onCancelAudio,
  onPlayPreview,
  onPausePreview,
  onSendAudio,
  showEmoji,
  onToggleEmoji,
  onEmojiSelect,
  uploading,
  connected,
  txtRef,
  fileRef
}) => {
  
  // Gestion de la touche Entrée
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  // Animation des boutons
  const btnAnim = {
    hover: { scale: 1.1 },
    tap: { scale: 0.95 }
  };

  return (
    <div className="border-t border-gray-700 bg-gray-800/95 backdrop-blur-sm p-4 flex-shrink-0 z-20">
      
      {/* === 1. PRÉVISUALISATION AUDIO === */}
      <AnimatePresence>
        {audioBlob && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: 'auto', marginBottom: 12 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            className="overflow-hidden"
          >
            <div className="p-3 bg-gray-700/80 rounded-xl border border-gray-600 flex items-center gap-3 shadow-lg">
              
              {/* Play/Pause */}
              <motion.button
                variants={btnAnim}
                whileHover="hover"
                whileTap="tap"
                onClick={isPlaying ? onPausePreview : onPlayPreview}
                className="p-2 bg-orange-500 text-white rounded-full hover:bg-orange-600 transition shadow-md"
                title={isPlaying ? "Pause" : "Écouter"}
              >
                {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
              </motion.button>
              
              {/* Visualiseur Audio (Fake Waveform) */}
              <div className="flex-1 h-8 flex items-center gap-1 justify-center px-2 bg-gray-800/50 rounded-lg overflow-hidden">
                {[...Array(20)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="w-1 bg-gradient-to-t from-orange-500 to-pink-500 rounded-full"
                    animate={{ 
                      height: isPlaying ? [10, Math.random() * 25 + 5, 10] : 4,
                      opacity: isPlaying ? 1 : 0.5 
                    }}
                    transition={{ 
                      repeat: Infinity, 
                      duration: 0.5, 
                      delay: i * 0.05 
                    }}
                  />
                ))}
              </div>

              {/* Élément Audio Caché */}
              <audio ref={audioRef} src={audioUrl} className="hidden" onEnded={onPausePreview} />

              {/* Actions Audio */}
              <div className="flex gap-2">
                <motion.button
                  variants={btnAnim}
                  whileHover="hover"
                  whileTap="tap"
                  onClick={onCancelAudio}
                  className="p-2 bg-gray-600 text-white rounded-full hover:bg-red-500 transition"
                  title="Annuler"
                >
                  <X className="w-4 h-4" />
                </motion.button>

                <motion.button
                  variants={btnAnim}
                  whileHover="hover"
                  whileTap="tap"
                  onClick={onSendAudio}
                  className="p-2 bg-green-500 text-white rounded-full hover:bg-green-600 transition shadow-md"
                  title="Envoyer le vocal"
                >
                  <Check className="w-4 h-4" />
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* === 2. ZONE DE SAISIE === */}
      <div className="flex items-end gap-2">
        
        {/* Actions Gauche (Emoji + Upload) */}
        <div className="flex gap-2 pb-1">
          {/* Picker Emoji */}
          <div className="relative">
            <motion.button
              variants={btnAnim}
              whileHover="hover"
              whileTap="tap"
              onClick={onToggleEmoji}
              className={`p-3 rounded-xl transition ${showEmoji ? 'bg-orange-500/20 text-orange-400' : 'bg-gray-700 text-gray-400 hover:text-gray-200'}`}
              title="Emojis"
            >
              <Smile className="w-6 h-6" />
            </motion.button>

            <AnimatePresence>
              {showEmoji && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 10 }}
                  className="absolute bottom-14 left-0 z-50 shadow-2xl rounded-2xl overflow-hidden border border-gray-600"
                >
                  <Picker 
                    onEmojiClick={onEmojiSelect} 
                    theme="dark" 
                    searchDisabled={false}
                    width={300}
                    height={400}
                    previewConfig={{ showPreview: false }}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Upload Fichier */}
          <motion.button
            variants={btnAnim}
            whileHover="hover"
            whileTap="tap"
            onClick={() => fileRef?.current?.click()}
            disabled={uploading}
            className="p-3 bg-gray-700 text-gray-400 rounded-xl hover:text-gray-200 transition disabled:opacity-50"
            title="Joindre un fichier"
          >
            {uploading ? (
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-t-transparent border-orange-500" />
            ) : (
              <Paperclip className="w-6 h-6" />
            )}
          </motion.button>
          
          {/* Input Fichier Caché (Supporte Video maintenant) */}
          <input
            ref={fileRef}
            type="file"
            onChange={onUpload}
            className="hidden"
            accept="image/*,audio/*,video/*"
          />
        </div>

        {/* Zone de Texte */}
        <div className="flex-1 relative bg-gray-700/50 rounded-2xl border border-gray-600 focus-within:border-orange-500/50 focus-within:bg-gray-700 transition-all duration-200">
          <textarea
            ref={txtRef}
            value={input}
            onChange={onChange}
            onKeyDown={handleKeyPress}
            placeholder={connected ? "Écrivez un message..." : "Connexion en cours..."}
            disabled={!connected}
            className="w-full px-4 py-3 bg-transparent text-white placeholder-gray-400 resize-none focus:outline-none max-h-32 min-h-[48px] scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent rounded-2xl"
            rows={1}
            style={{ height: 'auto', overflowY: 'auto' }}
          />
        </div>

        {/* Actions Droite (Micro / Envoyer) */}
        <div className="pb-1">
          <AnimatePresence mode="wait">
            {input.trim() ? (
              <motion.button
                key="send"
                initial={{ scale: 0, rotate: -45 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0, rotate: 45 }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={onSend}
                disabled={!connected}
                className="p-3 bg-gradient-to-r from-orange-500 to-pink-500 text-white rounded-xl shadow-lg hover:shadow-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Envoyer"
              >
                <Send className="w-5 h-5 ml-0.5" />
              </motion.button>
            ) : (
              <motion.button
                key="mic"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={recording ? onStopRecording : onStartRecording}
                disabled={!connected}
                className={`p-3 rounded-xl transition-all duration-300 disabled:opacity-50 ${
                  recording 
                    ? 'bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.5)]' 
                    : 'bg-gray-700 text-gray-400 hover:text-white hover:bg-gray-600'
                }`}
                title={recording ? "Arrêter l'enregistrement" : "Message vocal"}
              >
                {recording ? (
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                  >
                    <div className="w-3 h-3 bg-white rounded-sm" />
                  </motion.div>
                ) : (
                  <Mic className="w-6 h-6" />
                )}
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Compteur de caractères */}
      {input.length > 50 && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-1 mr-2 text-right"
        >
          <span className={`text-[10px] font-medium ${
            input.length > 4500 ? 'text-red-400' : 'text-gray-500'
          }`}>
            {input.length} / {5000}
          </span>
        </motion.div>
      )}
    </div>
  );
};

// Utilisation de memo pour éviter les re-renders inutiles
export const ChatInputMemo = memo(ChatInput);
// On exporte par défaut la version mémoïsée, mais on garde le nom ChatInput pour l'import
export { ChatInputMemo as ChatInput };