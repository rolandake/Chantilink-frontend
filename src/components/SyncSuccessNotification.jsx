import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Users, MessageCircle, X } from 'lucide-react';

export default function SyncSuccessNotification({ show, onClose, stats }) {
  if (!show || !stats) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -50 }}
        className="fixed top-4 right-4 z-[200] max-w-md"
      >
        <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="p-4 flex items-center justify-between border-b border-white/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <Check className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-white font-bold text-lg">
                Synchronisation réussie !
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Body */}
          <div className="p-4 space-y-3">
            {/* Contacts trouvés */}
            {stats.onChantilink > 0 && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="bg-white/10 backdrop-blur-sm rounded-xl p-3 flex items-center gap-3"
              >
                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-white font-semibold text-lg">
                    {stats.onChantilink} {stats.onChantilink === 1 ? 'contact trouvé' : 'contacts trouvés'}
                  </p>
                  <p className="text-white/80 text-sm">
                    sur Chantilink
                  </p>
                </div>
              </motion.div>
            )}

            {/* Nouveaux amis */}
            {stats.newFriendsCount > 0 && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="bg-white/10 backdrop-blur-sm rounded-xl p-3 flex items-center gap-3"
              >
                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                  <MessageCircle className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-white font-semibold text-lg">
                    {stats.newFriendsCount} {stats.newFriendsCount === 1 ? 'nouvel ami' : 'nouveaux amis'}
                  </p>
                  <p className="text-white/80 text-sm">
                    Vous pouvez maintenant chatter !
                  </p>
                </div>
              </motion.div>
            )}

            {/* Contacts non-inscrits */}
            {stats.offChantilink > 0 && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="bg-white/5 backdrop-blur-sm rounded-xl p-3"
              >
                <p className="text-white/90 text-sm">
                  📱 {stats.offChantilink} {stats.offChantilink === 1 ? 'contact' : 'contacts'} non inscrit{stats.offChantilink === 1 ? '' : 's'}
                </p>
                <p className="text-white/70 text-xs mt-1">
                  Invitez-les à rejoindre Chantilink !
                </p>
              </motion.div>
            )}

            {/* Message si aucun contact */}
            {stats.total === 0 && (
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center">
                <p className="text-white text-sm">
                  Aucun contact à synchroniser
                </p>
                <p className="text-white/70 text-xs mt-1">
                  Ajoutez des contacts à votre téléphone
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 bg-black/20">
            <button
              onClick={onClose}
              className="w-full py-2 bg-white/20 hover:bg-white/30 text-white font-semibold rounded-lg transition-colors"
            >
              Compris
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}