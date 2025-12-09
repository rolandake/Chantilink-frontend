// ============================================
// 📁 src/pages/Chat/components/EmptyState.jsx
// ============================================
import React from 'react';
import { motion } from 'framer-motion';
import { 
  MessageCircle, Heart, UserPlus, RefreshCw, ArrowRight 
} from 'lucide-react';

export const EmptyState = ({ 
  totalPendingCount, 
  onShowPending, 
  onSyncContacts, 
  onAddContact,
  hasContacts 
}) => {
  return (
    <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-md"
      >
        {/* Icône principale */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
          className="w-32 h-32 mx-auto mb-8 rounded-full bg-gradient-to-br from-orange-500/20 to-pink-500/20 flex items-center justify-center"
        >
          <MessageCircle className="w-16 h-16 text-orange-400" />
        </motion.div>

        {/* Message principal */}
        <motion.h2
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-3xl font-bold text-white mb-3"
        >
          {hasContacts ? "Sélectionnez une conversation" : "Aucun contact"}
        </motion.h2>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-gray-400 mb-8"
        >
          {hasContacts 
            ? "Choisissez un contact dans la liste pour commencer à discuter"
            : "Ajoutez des contacts pour démarrer vos conversations"}
        </motion.p>

        {/* Actions rapides */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="space-y-3"
        >
          {/* Demandes en attente */}
          {totalPendingCount > 0 && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onShowPending}
              className="w-full p-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <Heart className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <p className="font-semibold">Demandes en attente</p>
                  <p className="text-sm text-white/80">
                    {totalPendingCount} nouvelle{totalPendingCount > 1 ? 's' : ''} demande{totalPendingCount > 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </motion.button>
          )}

          {/* Ajouter un contact */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onAddContact}
            className="w-full p-4 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl hover:from-blue-700 hover:to-cyan-700 transition-all shadow-lg flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <UserPlus className="w-5 h-5" />
              </div>
              <div className="text-left">
                <p className="font-semibold">Ajouter un contact</p>
                <p className="text-sm text-white/80">Ajoutez manuellement un numéro</p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </motion.button>

          {/* Synchroniser */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onSyncContacts}
            className="w-full p-4 bg-gradient-to-r from-orange-600 to-pink-600 text-white rounded-xl hover:from-orange-700 hover:to-pink-700 transition-all shadow-lg flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <RefreshCw className="w-5 h-5" />
              </div>
              <div className="text-left">
                <p className="font-semibold">Synchroniser les contacts</p>
                <p className="text-sm text-white/80">Importer depuis votre téléphone</p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </motion.button>
        </motion.div>

        {/* Conseil */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-8 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl"
        >
          <p className="text-blue-300 text-sm">
            💡 <strong>Astuce :</strong> Les demandes de messages apparaissent quand quelqu'un réagit à votre story ou vous envoie un message
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
};