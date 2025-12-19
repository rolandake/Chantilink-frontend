// ============================================
// 📁 src/pages/Chat/PendingMessagesModal.jsx
// VERSION: ÉLITE - SECURE CONNECT
// ============================================
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Heart, UserPlus, Trash2, MessageCircle, ShieldCheck, Lock, ArrowRight } from "lucide-react";
import { API } from "../../services/apiService";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";

export const PendingMessagesModal = ({ 
  isOpen, 
  onClose, 
  onAccept, 
  onReject, 
  onOpenConversation 
}) => {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && token) loadPendingRequests();
  }, [isOpen, token]);

  const loadPendingRequests = async () => {
    try {
      setLoading(true);
      const response = await API.getPendingMessageRequests(token);
      setPendingRequests(Array.isArray(response) ? response : (response.requests || []));
    } catch (error) {
      showToast("Erreur de synchronisation", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (request) => {
    try {
      await API.acceptMessageRequest(token, request._id);
      showToast("Connexion sécurisée établie", "success");
      setPendingRequests(prev => prev.filter(r => r._id !== request._id));
      if (onAccept) onAccept(request);
    } catch (error) {
      showToast("Échec de l'acceptation", "error");
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-md z-[200] flex items-end md:items-center justify-center p-0 md:p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-[#12151a] w-full max-w-xl rounded-t-[32px] md:rounded-[24px] border-t md:border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* --- HEADER --- */}
          <div className="p-6 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-500">
                <ShieldCheck size={24} />
              </div>
              <div>
                <h2 className="text-xl font-black text-white">Demandes d'accès</h2>
                <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">
                  {pendingRequests.length} Profil{pendingRequests.length > 1 ? 's' : ''} en attente
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors">
              <X size={20} className="text-gray-400" />
            </button>
          </div>

          {/* --- LISTE DES DEMANDES --- */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Vérification sécurisée...</span>
              </div>
            ) : pendingRequests.length === 0 ? (
              <div className="text-center py-16 opacity-40">
                <MessageCircle size={48} className="mx-auto mb-4 text-gray-600" />
                <p className="text-sm font-bold uppercase">Aucune demande en attente</p>
              </div>
            ) : (
              pendingRequests.map((request) => (
                <motion.div
                  key={request._id}
                  className="bg-[#1c2026] rounded-2xl border border-white/5 overflow-hidden"
                >
                  <div className="p-4">
                    <div className="flex items-start gap-4">
                      {/* Avatar */}
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-xl flex-shrink-0 shadow-lg">
                        {(request.sender?.fullName?.[0] || '?').toUpperCase()}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-white font-bold truncate">{request.sender?.fullName || 'Anonyme'}</h4>
                          <span className="px-1.5 py-0.5 bg-blue-500/10 text-blue-400 text-[8px] font-black rounded uppercase tracking-tighter">Nouveau</span>
                        </div>
                        
                        <p className="text-sm text-gray-400 line-clamp-2 italic mb-2">
                          "{request.content || "Demande d'ouverture de canal privé."}"
                        </p>

                        <div className="flex items-center gap-3 text-[10px] font-bold text-gray-500 uppercase tracking-tighter">
                          <span className="flex items-center gap-1"><Lock size={10}/> Chiffré</span>
                          <span className="flex items-center gap-1"><ArrowRight size={10}/> {new Date(request.timestamp).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 mt-4 pt-4 border-t border-white/5">
                      <button
                        onClick={() => handleAccept(request)}
                        className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2"
                      >
                        <UserPlus size={14} /> Accepter
                      </button>
                      <button
                        onClick={() => API.rejectMessageRequest(token, request._id).then(() => loadPendingRequests())}
                        className="p-3 bg-white/5 hover:bg-red-500/10 text-gray-400 hover:text-red-500 rounded-xl transition-all"
                      >
                        <Trash2 size={18} />
                      </button>
                      <button
                        onClick={() => onOpenConversation(request)}
                        className="p-3 bg-white/5 hover:bg-white/10 text-gray-400 rounded-xl transition-all"
                        title="Prévisualiser"
                      >
                        <MessageCircle size={18} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>

          {/* --- FOOTER SÉCURISÉ --- */}
          <div className="p-4 bg-black/20 border-t border-white/5 flex items-center justify-center gap-2 text-[10px] text-gray-600 font-bold uppercase tracking-widest">
            <ShieldCheck size={12} /> Canal privé sécurisé par Chantilink
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};