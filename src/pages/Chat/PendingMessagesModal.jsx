// ============================================
// 📁 src/pages/Chat/PendingMessagesModal.jsx - CORRIGÉ
// ============================================
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Heart, UserPlus, Trash2, MessageCircle } from "lucide-react";
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
    if (isOpen && token) {
      loadPendingRequests();
    }
  }, [isOpen, token]);

  const loadPendingRequests = async () => {
    try {
      setLoading(true);
      console.log("🔄 Chargement des demandes en attente...");
      
      const response = await API.getPendingMessageRequests(token);
      
      console.log("📥 Réponse reçue:", response);
      
      // Gestion flexible de la réponse
      if (response) {
        if (Array.isArray(response.requests)) {
          setPendingRequests(response.requests);
          console.log(`✅ ${response.requests.length} demande(s) chargée(s)`);
        } else if (Array.isArray(response)) {
          setPendingRequests(response);
          console.log(`✅ ${response.length} demande(s) chargée(s)`);
        } else if (response.data && Array.isArray(response.data)) {
          setPendingRequests(response.data);
          console.log(`✅ ${response.data.length} demande(s) chargée(s)`);
        } else {
          console.warn("⚠️ Format de réponse inattendu:", response);
          setPendingRequests([]);
        }
      } else {
        console.warn("⚠️ Réponse vide");
        setPendingRequests([]);
      }
    } catch (error) {
      console.error("❌ Erreur détaillée:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        stack: error.stack
      });
      
      const errorMsg = error.response?.data?.message 
        || error.message 
        || "Erreur de chargement des demandes";
      
      showToast(errorMsg, "error");
      setPendingRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (request) => {
    try {
      console.log("✅ Acceptation de la demande:", request._id);
      await API.acceptMessageRequest(token, request._id);

      const userName = request.sender?.fullName 
        || request.sender?.username 
        || "Utilisateur";
      
      showToast(`${userName} ajouté à vos contacts`, "success");
      
      // Retirer de la liste
      setPendingRequests(prev => prev.filter(r => r._id !== request._id));
      
      // Notifier le parent pour recharger les contacts
      if (onAccept) {
        onAccept(request);
      }
    } catch (error) {
      console.error("❌ Erreur lors de l'acceptation:", error);
      const errorMsg = error.response?.data?.message 
        || error.message 
        || "Erreur lors de l'ajout du contact";
      showToast(errorMsg, "error");
    }
  };

  const handleReject = async (request) => {
    try {
      console.log("🗑️ Rejet de la demande:", request._id);
      await API.rejectMessageRequest(token, request._id);
      setPendingRequests(prev => prev.filter(r => r._id !== request._id));
      showToast("Demande rejetée", "info");
      
      if (onReject) {
        onReject(request._id);
      }
    } catch (error) {
      console.error("❌ Erreur lors du rejet:", error);
      const errorMsg = error.response?.data?.message 
        || error.message 
        || "Erreur lors du rejet";
      showToast(errorMsg, "error");
    }
  };

  const handleOpenConversation = (request) => {
    if (onOpenConversation) {
      console.log("💬 Ouverture de la conversation:", request);
      onOpenConversation(request);
    } else {
      console.warn("⚠️ onOpenConversation callback non fourni");
      showToast("Fonctionnalité non disponible", "error");
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[150] flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-gray-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden border border-gray-700"
        >
          {/* Header */}
          <div className="p-6 border-b border-gray-700 bg-gradient-to-r from-purple-500/10 to-pink-500/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl">
                  <Heart className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">Demandes de messages</h2>
                  <p className="text-sm text-gray-400">
                    {pendingRequests.length} demande{pendingRequests.length > 1 ? 's' : ''} en attente
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <X className="w-6 h-6 text-gray-400" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="overflow-y-auto max-h-[calc(80vh-120px)] p-6">
            {loading ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-purple-500" />
              </div>
            ) : pendingRequests.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                  <MessageCircle className="w-10 h-10 text-purple-400" />
                </div>
                <p className="text-xl font-semibold text-white mb-2">Aucune demande</p>
                <p className="text-sm text-gray-400">
                  Les réactions aux stories apparaîtront ici
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingRequests.map((request) => (
                  <motion.div
                    key={request._id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="p-4 bg-gray-800/50 border border-gray-700 rounded-xl hover:border-purple-500/50 transition-all"
                  >
                    {/* Zone cliquable pour ouvrir la conversation */}
                    <div 
                      onClick={() => handleOpenConversation(request)}
                      className="cursor-pointer hover:opacity-90 transition-opacity"
                    >
                      <div className="flex items-start gap-4 mb-3">
                        {/* Avatar */}
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                          {request.sender?.fullName?.[0] || request.sender?.username?.[0] || '?'}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <h4 className="text-white font-semibold mb-1">
                            {request.sender?.fullName || request.sender?.username || 'Utilisateur inconnu'}
                          </h4>
                          
                          {request.type === 'story_reaction' ? (
                            <div className="flex items-center gap-2 mb-2">
                              <Heart className="w-4 h-4 text-pink-500" />
                              <p className="text-sm text-gray-300">
                                A réagi à votre story 
                                {request.metadata?.emoji && ` avec ${request.metadata.emoji}`}
                              </p>
                            </div>
                          ) : (
                            <p className="text-sm text-gray-300 mb-2 line-clamp-2">
                              {request.content || 'Vous a envoyé un message'}
                            </p>
                          )}

                          {request.sender?.phone && (
                            <p className="text-xs text-gray-500">
                              📱 {request.sender.phone}
                            </p>
                          )}

                          {request.unreadCount > 1 && (
                            <p className="text-xs text-purple-400 mt-1">
                              +{request.unreadCount - 1} autre{request.unreadCount > 2 ? 's' : ''} message{request.unreadCount > 2 ? 's' : ''}
                            </p>
                          )}

                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(request.timestamp).toLocaleDateString('fr-FR', {
                              day: 'numeric',
                              month: 'long',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                      </div>

                      {/* Indicateur visuel */}
                      <div className="mb-3 pb-3 border-b border-gray-700/50">
                        <p className="text-xs text-center text-gray-400">
                          💬 Cliquez n'importe où pour ouvrir la conversation
                        </p>
                      </div>
                    </div>

                    {/* Actions - en dehors de la zone cliquable */}
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAccept(request);
                        }}
                        className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors flex items-center gap-2"
                        title="Accepter et ajouter aux contacts"
                      >
                        <UserPlus className="w-4 h-4" />
                        <span className="text-sm font-semibold">Accepter</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReject(request);
                        }}
                        className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors flex items-center gap-2"
                        title="Rejeter"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span className="text-sm font-semibold">Rejeter</span>
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {pendingRequests.length > 0 && (
            <div className="p-4 border-t border-gray-700 bg-gray-800/30">
              <p className="text-sm text-gray-400 text-center">
                💡 <strong>Astuce :</strong> Cliquer sur une demande ouvre automatiquement la conversation
              </p>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};