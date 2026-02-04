// ============================================
// 📁 PermissionModal.jsx
// Modal explicatif pour la demande de permission contacts
// ============================================
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Smartphone, Shield, Users, X } from 'lucide-react';

export const PermissionModal = ({ isOpen, onAccept, onCancel }) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 rounded-3xl p-6 max-w-md w-full border border-white/10 shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-600/20 flex items-center justify-center">
                <Smartphone className="text-blue-500" size={24} />
              </div>
              <div>
                <h3 className="text-xl font-black text-white">Accès aux contacts</h3>
                <p className="text-xs text-gray-400">Synchronisation sécurisée</p>
              </div>
            </div>
            <button
              onClick={onCancel}
              className="p-2 hover:bg-white/5 rounded-xl transition-colors"
            >
              <X size={20} className="text-gray-400" />
            </button>
          </div>

          {/* Body */}
          <div className="space-y-4 mb-6">
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                <Users className="text-green-500" size={20} />
              </div>
              <div>
                <h4 className="font-bold text-white mb-1">Trouvez vos amis</h4>
                <p className="text-sm text-gray-400">
                  Découvrez automatiquement quels contacts utilisent déjà Chantilink
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Shield className="text-blue-500" size={20} />
              </div>
              <div>
                <h4 className="font-bold text-white mb-1">Sécurité garantie</h4>
                <p className="text-sm text-gray-400">
                  Vos contacts sont chiffrés et ne sont jamais stockés en clair
                </p>
              </div>
            </div>

            <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
              <p className="text-xs text-gray-400 leading-relaxed">
                <strong className="text-white">Comment ça marche ?</strong><br />
                Nous lisons vos contacts localement, les chiffrons avec SHA-256, 
                puis les comparons de manière sécurisée avec notre base de données. 
                Aucun numéro n'est jamais stocké en clair.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 py-3 px-4 bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold transition-all"
            >
              Annuler
            </button>
            <button
              onClick={onAccept}
              className="flex-1 py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-900/30"
            >
              Autoriser l'accès
            </button>
          </div>

          {/* Footer */}
          <p className="text-center text-[10px] text-gray-600 mt-4">
            Cette permission peut être révoquée à tout moment dans les paramètres de votre téléphone
          </p>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default PermissionModal;