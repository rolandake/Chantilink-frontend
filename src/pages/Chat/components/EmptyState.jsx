// ============================================
// 📁 src/pages/Chat/components/EmptyState.jsx
// VERSION: ÉLITE - SECURE HUB UX
// ============================================
import React from 'react';
import { motion } from 'framer-motion';
import { 
  ShieldCheck, Lock, UserPlus, RefreshCw, 
  ArrowRight, ShieldAlert, MessageSquare, Zap
} from 'lucide-react';

export const EmptyState = ({ 
  loading = false,
  totalPendingCount = 0, 
  onShowPending, 
  onSyncContacts, 
  onAddContact,
  hasContacts = false
}) => {
  
  // --- ÉTAT DE CHARGEMENT SÉCURISÉ ---
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#0b0d10] p-8">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <div className="relative w-20 h-20 mx-auto mb-6">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 border-t-2 border-b-2 border-blue-500 rounded-full"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <Lock className="w-8 h-8 text-blue-500 animate-pulse" />
            </div>
          </div>
          <p className="text-sm font-black text-white uppercase tracking-[0.2em]">Synchronisation</p>
          <p className="text-[10px] text-gray-500 uppercase mt-2">Canal privé en cours d'ouverture...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center bg-[#0b0d10] p-6 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-sm w-full"
      >
        {/* Icône Centrale de Confiance */}
        <motion.div
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          className="w-24 h-24 mx-auto mb-8 rounded-[32px] bg-blue-500/5 border border-blue-500/10 flex items-center justify-center shadow-2xl"
        >
          <ShieldCheck className="w-12 h-12 text-blue-500/80" />
        </motion.div>

        <h2 className="text-2xl font-black text-white mb-2 uppercase tracking-tight">
          {hasContacts ? "Messagerie Privée" : "Cercle Vide"}
        </h2>

        <p className="text-sm text-gray-500 mb-10 leading-relaxed font-medium">
          {hasContacts 
            ? "Sélectionnez un collègue pour démarrer une session de chat chiffrée."
            : "Votre annuaire sécurisé est vide. Ajoutez vos amis et collègues pour commencer."}
        </p>

        {/* Grille d'actions rapides */}
        <div className="space-y-3">
          
          {/* Demandes Privées (Priorité Haute) */}
          {totalPendingCount > 0 && (
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={onShowPending}
              className="w-full p-4 bg-[#1c1226] border border-purple-500/20 rounded-2xl flex items-center justify-between group transition-all hover:bg-[#251833]"
            >
              <div className="flex items-center gap-4">
                <div className="p-2 bg-purple-500/20 rounded-xl text-purple-400">
                  <ShieldAlert size={20} />
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold text-white uppercase tracking-wider">Accès en attente</p>
                  <p className="text-[10px] text-purple-400 font-black uppercase">
                    {totalPendingCount} nouvelle{totalPendingCount > 1 ? 's' : ''} demande{totalPendingCount > 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <ArrowRight size={18} className="text-purple-500 group-hover:translate-x-1 transition-transform" />
            </motion.button>
          )}

          {/* Ajouter un Contact */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onAddContact}
            className="w-full p-4 bg-[#12151a] border border-white/5 rounded-2xl flex items-center justify-between group transition-all hover:bg-white/5"
          >
            <div className="flex items-center gap-4">
              <div className="p-2 bg-blue-500/10 rounded-xl text-blue-500">
                <UserPlus size={20} />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-white uppercase tracking-wider">Ajouter un profil</p>
                <p className="text-[10px] text-gray-500 font-bold uppercase">Lier un nouveau numéro</p>
              </div>
            </div>
            <ArrowRight size={18} className="text-gray-700 group-hover:translate-x-1 transition-transform" />
          </motion.button>

          {/* Synchronisation (Fiabilité) */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onSyncContacts}
            className="w-full p-4 bg-[#12151a] border border-white/5 rounded-2xl flex items-center justify-between group transition-all hover:bg-white/5"
          >
            <div className="flex items-center gap-4">
              <div className="p-2 bg-orange-500/10 rounded-xl text-orange-500">
                <RefreshCw size={20} />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-white uppercase tracking-wider">Mettre à jour</p>
                <p className="text-[10px] text-gray-500 font-bold uppercase">Synchroniser les contacts</p>
              </div>
            </div>
            <ArrowRight size={18} className="text-gray-700 group-hover:translate-x-1 transition-transform" />
          </motion.button>
        </div>

        {/* Badge de Confidentialité */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-12 flex flex-col items-center gap-3"
        >
          <div className="flex items-center gap-4 text-gray-700">
            <Zap size={16} />
            <Lock size={16} />
            <ShieldCheck size={16} />
          </div>
          <p className="text-[9px] text-gray-600 font-black uppercase tracking-[0.3em]">
            Cryptage de bout en bout actif
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
};