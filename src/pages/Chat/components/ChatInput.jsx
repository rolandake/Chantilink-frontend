// ============================================
// 📁 src/pages/Chat/components/ChatInput.jsx
// VERSION: FINALE - CORRIGÉE - COPIER CE FICHIER
// ============================================
import React from "react";
import { Send, Mic, Paperclip, Smile, StopCircle, X, Play, Pause, ShieldCheck, Lock } from "lucide-react";
import EmojiPicker from 'emoji-picker-react';
import { motion, AnimatePresence } from "framer-motion";

export const ChatInput = ({
  input = "",  // ✅ VALEUR PAR DÉFAUT AJOUTÉE
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
  fileRef, 
  audioRef
}) => {

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (onSend) onSend();
    }
  };

  return (
    <div className="w-full bg-[#12151a]/95 backdrop-blur-2xl border-t border-white/5 p-3 md:p-5 z-40 relative">
      
      {/* --- PRÉVISUALISATION VOCALE SÉCURISÉE --- */}
      <AnimatePresence>
        {audioUrl && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex items-center gap-4 bg-[#1c2026] p-4 rounded-[24px] mb-4 shadow-2xl border border-blue-500/20"
          >
            <button 
              onClick={isPlaying ? onPausePreview : onPlayPreview}
              className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-900/40 active:scale-90 transition-transform"
            >
              {isPlaying ? (
                <Pause size={20} fill="currentColor" />
              ) : (
                <Play size={20} className="ml-1" fill="currentColor" />
              )}
            </button>
            
            <div className="flex-1">
              <div className="flex justify-between mb-1.5">
                <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">
                  Message Vocal Privé
                </span>
                <span className="text-[10px] font-bold text-gray-500 italic">
                  Prêt pour envoi
                </span>
              </div>
              <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-gradient-to-r from-blue-600 to-indigo-400"
                  animate={{ width: isPlaying ? "100%" : "0%" }}
                  transition={{ duration: 10, ease: "linear" }}
                />
              </div>
            </div>

            {audioRef && <audio ref={audioRef} src={audioUrl} className="hidden" />}

            <div className="flex gap-2">
              <button 
                onClick={onCancelAudio} 
                className="p-3 text-gray-500 hover:text-red-400 transition-colors"
              >
                <X size={22}/>
              </button>
              <button 
                onClick={onSendAudio} 
                className="p-3 bg-blue-600/10 text-blue-400 rounded-xl hover:bg-blue-600 hover:text-white transition-all"
              >
                <Send size={22}/>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-5xl mx-auto">
        <div className="flex items-end gap-3 relative">
          
          {/* --- EMOJI PICKER MODERNE --- */}
          <AnimatePresence>
            {showEmoji && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0, y: 10 }}
                className="absolute bottom-16 left-0 z-50 shadow-2xl rounded-3xl overflow-hidden border border-white/10"
              >
                <EmojiPicker 
                  onEmojiClick={onEmojiSelect} 
                  theme="dark" 
                  width={300} 
                  height={350} 
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* --- ATTACHEMENT & EMOJI --- */}
          <div className="flex pb-1.5 gap-1">
            <button 
              onClick={() => fileRef?.current?.click()} 
              disabled={!connected || uploading || recording}
              className="p-3 text-gray-500 hover:text-blue-400 hover:bg-blue-500/5 rounded-2xl transition-all disabled:opacity-20"
            >
              {uploading ? (
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Paperclip size={24} />
              )}
            </button>
            <input 
              type="file" 
              ref={fileRef} 
              className="hidden" 
              onChange={onUpload} 
              accept="image/*,video/*,audio/*,application/pdf,.doc,.docx" 
            />
            
            <button 
              onClick={onToggleEmoji} 
              className={`p-3 rounded-2xl transition-all hidden sm:block ${
                showEmoji ? 'text-blue-400 bg-blue-500/10' : 'text-gray-500 hover:text-blue-400'
              }`}
            >
              <Smile size={24} />
            </button>
          </div>

          {/* --- ZONE DE SAISIE PRINCIPALE --- */}
          <div className={`flex-1 bg-[#0f1115] rounded-[24px] border transition-all flex items-center min-h-[52px] px-2 ${
            recording 
              ? 'border-red-500/50 bg-red-500/5' 
              : 'border-white/5 focus-within:border-blue-500/50'
          }`}>
            {recording && (
              <div className="pl-3 flex items-center gap-2">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
                <span className="text-[10px] font-black text-red-500 uppercase tracking-widest mr-2">
                  Enregistrement
                </span>
              </div>
            )}
            
            <textarea
              ref={txtRef}
              value={input}
              onChange={onChange}
              onKeyDown={handleKeyDown}
              disabled={!connected || recording}
              placeholder={
                recording 
                  ? "" 
                  : !connected 
                    ? "Reconnexion..." 
                    : "Message privé..."
              }
              rows={1}
              className="w-full bg-transparent text-white px-3 py-3.5 max-h-32 resize-none outline-none text-[15px] placeholder:text-gray-700 disabled:opacity-50"
            />
            
            {!input?.trim() && !recording && (
              <div className="pr-2 opacity-20">
                <Lock size={16} className="text-gray-400" />
              </div>
            )}
          </div>

          {/* --- BOUTON D'ACTION DYNAMIQUE --- */}
          <div className="pb-1">
            <AnimatePresence mode="wait">
              {input?.trim() ? (
                <motion.button
                  key="send"
                  initial={{ scale: 0.5, opacity: 0 }} 
                  animate={{ scale: 1, opacity: 1 }} 
                  exit={{ scale: 0.5, opacity: 0 }}
                  onClick={onSend}
                  className="p-4 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-900/40 hover:bg-blue-500 active:scale-95 transition-all"
                >
                  <Send size={22} fill="currentColor" />
                </motion.button>
              ) : (
                <motion.button
                  key="mic"
                  initial={{ scale: 0.5, opacity: 0 }} 
                  animate={{ scale: 1, opacity: 1 }} 
                  exit={{ scale: 0.5, opacity: 0 }}
                  onClick={recording ? onStopRecording : onStartRecording}
                  disabled={!connected}
                  className={`p-4 rounded-2xl transition-all shadow-lg active:scale-95 ${
                    recording 
                      ? "bg-red-600 text-white shadow-red-900/40" 
                      : "bg-[#1c2026] text-gray-400 hover:text-white"
                  }`}
                >
                  {recording ? (
                    <StopCircle size={22} fill="currentColor" />
                  ) : (
                    <Mic size={22} />
                  )}
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* --- BADGE DE SÉCURITÉ --- */}
      <div className="mt-3 flex justify-center items-center gap-1.5 opacity-30">
        <ShieldCheck size={10} className="text-blue-500" />
        <span className="text-[8px] font-black text-gray-500 uppercase tracking-[0.2em]">
          Transmission Chiffrée
        </span>
      </div>
    </div>
  );
};