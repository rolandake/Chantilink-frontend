// ============================================
// 📁 src/components/ReportUserModal.jsx
// Modal de signalement d'utilisateur
// ============================================

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  XMarkIcon, 
  ExclamationTriangleIcon,
  FlagIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';

// ============================================
// 🚨 CATÉGORIES DE SIGNALEMENT
// ============================================
const REPORT_CATEGORIES = [
  {
    id: 'spam',
    label: 'Spam ou publicité',
    icon: '🚫',
    description: 'Publications répétitives, publicités non sollicitées'
  },
  {
    id: 'harassment',
    label: 'Harcèlement',
    icon: '😡',
    description: 'Menaces, intimidation, harcèlement'
  },
  {
    id: 'hate_speech',
    label: 'Discours haineux',
    icon: '⚠️',
    description: 'Propos racistes, sexistes, discriminatoires'
  },
  {
    id: 'fake_account',
    label: 'Faux compte',
    icon: '🎭',
    description: 'Usurpation d\'identité, faux profil'
  },
  {
    id: 'inappropriate_content',
    label: 'Contenu inapproprié',
    icon: '🔞',
    description: 'Contenu sexuel, violent ou choquant'
  },
  {
    id: 'scam',
    label: 'Arnaque',
    icon: '💰',
    description: 'Tentative d\'escroquerie, fraude'
  },
  {
    id: 'violence',
    label: 'Violence',
    icon: '🔪',
    description: 'Menaces de violence, appel à la violence'
  },
  {
    id: 'other',
    label: 'Autre',
    icon: '📝',
    description: 'Autre raison à préciser'
  }
];

// ============================================
// 📱 COMPOSANT PRINCIPAL
// ============================================
export const ReportUserModal = ({ 
  isOpen, 
  onClose, 
  user,
  onSubmit,
  isDarkMode = false 
}) => {
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState('');

  // ============================================
  // 🔄 RÉINITIALISATION
  // ============================================
  const resetForm = () => {
    setSelectedCategory(null);
    setDescription('');
    setError('');
    setIsSubmitted(false);
  };

  // ============================================
  // ✅ SOUMISSION
  // ============================================
  const handleSubmit = async () => {
    if (!selectedCategory) {
      setError('Veuillez sélectionner une catégorie');
      return;
    }

    if (selectedCategory === 'other' && !description.trim()) {
      setError('Veuillez décrire la raison du signalement');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await onSubmit({
        reportedUserId: user._id || user.id,
        category: selectedCategory,
        description: description.trim(),
        reportedUser: {
          fullName: user.fullName,
          username: user.username,
          profilePhoto: user.profilePhoto
        }
      });

      setIsSubmitted(true);
      
      // Fermer après 2 secondes
      setTimeout(() => {
        handleClose();
      }, 2000);

    } catch (err) {
      console.error('❌ Erreur signalement:', err);
      setError(err.message || 'Erreur lors du signalement');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ============================================
  // 🚪 FERMETURE
  // ============================================
  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className={`relative w-full max-w-2xl max-h-[90vh] rounded-3xl shadow-2xl border overflow-hidden ${
            isDarkMode 
              ? 'bg-gray-900 border-white/10' 
              : 'bg-white border-gray-200'
          }`}
        >
          {/* ========== HEADER ========== */}
          <div className={`sticky top-0 z-10 px-6 py-4 border-b backdrop-blur-xl ${
            isDarkMode 
              ? 'bg-gray-900/95 border-white/10' 
              : 'bg-white/95 border-gray-200'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${
                  isDarkMode ? 'bg-red-500/10' : 'bg-red-500/10'
                }`}>
                  <FlagIcon className="w-6 h-6 text-red-500" />
                </div>
                <div>
                  <h2 className={`text-xl font-bold ${
                    isDarkMode ? 'text-white' : 'text-gray-900'
                  }`}>
                    Signaler cet utilisateur
                  </h2>
                  <p className={`text-sm ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    {user?.fullName || 'Utilisateur'}
                  </p>
                </div>
              </div>
              <motion.button
                onClick={handleClose}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className={`p-2 rounded-xl transition-colors ${
                  isDarkMode 
                    ? 'hover:bg-gray-800 text-gray-400 hover:text-white' 
                    : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
                }`}
              >
                <XMarkIcon className="w-6 h-6" />
              </motion.button>
            </div>
          </div>

          {/* ========== CONTENU ========== */}
          <div className="overflow-y-auto max-h-[calc(90vh-160px)] px-6 py-6">
            
            {/* ✅ MESSAGE DE CONFIRMATION */}
            {isSubmitted ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-12"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', delay: 0.1 }}
                  className="inline-block p-4 bg-green-500/10 rounded-full mb-4"
                >
                  <CheckCircleIcon className="w-16 h-16 text-green-500" />
                </motion.div>
                <h3 className={`text-2xl font-bold mb-2 ${
                  isDarkMode ? 'text-white' : 'text-gray-900'
                }`}>
                  Signalement envoyé !
                </h3>
                <p className={`text-sm ${
                  isDarkMode ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Merci pour votre signalement. Notre équipe va l'examiner dans les plus brefs délais.
                </p>
              </motion.div>
            ) : (
              <>
                {/* AVERTISSEMENT */}
                <div className={`p-4 rounded-2xl mb-6 border ${
                  isDarkMode 
                    ? 'bg-orange-500/10 border-orange-500/20' 
                    : 'bg-orange-50 border-orange-200'
                }`}>
                  <div className="flex gap-3">
                    <ExclamationTriangleIcon className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className={`text-sm font-medium mb-1 ${
                        isDarkMode ? 'text-orange-400' : 'text-orange-800'
                      }`}>
                        À savoir avant de signaler
                      </p>
                      <ul className={`text-xs space-y-1 ${
                        isDarkMode ? 'text-orange-400/80' : 'text-orange-700'
                      }`}>
                        <li>• Les signalements abusifs sont interdits</li>
                        <li>• Votre identité reste anonyme</li>
                        <li>• L'utilisateur ne sera pas notifié</li>
                        <li>• Notre équipe examine chaque signalement</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* CATÉGORIES */}
                <div className="mb-6">
                  <label className={`block text-sm font-bold mb-3 ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Raison du signalement *
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {REPORT_CATEGORIES.map((category) => (
                      <motion.button
                        key={category.id}
                        onClick={() => {
                          setSelectedCategory(category.id);
                          setError('');
                        }}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className={`p-4 rounded-2xl border-2 text-left transition-all ${
                          selectedCategory === category.id
                            ? (isDarkMode
                                ? 'border-orange-500 bg-orange-500/10'
                                : 'border-orange-500 bg-orange-50')
                            : (isDarkMode
                                ? 'border-white/10 bg-gray-800/50 hover:border-white/20'
                                : 'border-gray-200 bg-gray-50 hover:border-gray-300')
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-2xl flex-shrink-0">{category.icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className={`font-semibold text-sm mb-1 ${
                              selectedCategory === category.id
                                ? (isDarkMode ? 'text-orange-400' : 'text-orange-600')
                                : (isDarkMode ? 'text-white' : 'text-gray-900')
                            }`}>
                              {category.label}
                            </p>
                            <p className={`text-xs ${
                              isDarkMode ? 'text-gray-400' : 'text-gray-600'
                            }`}>
                              {category.description}
                            </p>
                          </div>
                        </div>
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* DESCRIPTION */}
                <div className="mb-6">
                  <label className={`block text-sm font-bold mb-2 ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Détails supplémentaires {selectedCategory === 'other' && '*'}
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => {
                      setDescription(e.target.value);
                      setError('');
                    }}
                    placeholder="Décrivez la raison du signalement (optionnel, sauf pour 'Autre')..."
                    rows={4}
                    maxLength={500}
                    className={`w-full px-4 py-3 rounded-xl border resize-none transition-all ${
                      isDarkMode
                        ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-orange-500'
                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-orange-500'
                    } focus:outline-none focus:ring-2 focus:ring-orange-500/20`}
                  />
                  <div className="flex justify-end mt-1">
                    <span className={`text-xs ${
                      isDarkMode ? 'text-gray-500' : 'text-gray-500'
                    }`}>
                      {description.length}/500
                    </span>
                  </div>
                </div>

                {/* MESSAGE D'ERREUR */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl"
                  >
                    <div className="flex gap-3">
                      <ExclamationTriangleIcon className="w-5 h-5 text-red-500 flex-shrink-0" />
                      <p className="text-sm text-red-500 font-medium">{error}</p>
                    </div>
                  </motion.div>
                )}
              </>
            )}
          </div>

          {/* ========== FOOTER ========== */}
          {!isSubmitted && (
            <div className={`sticky bottom-0 px-6 py-4 border-t backdrop-blur-xl ${
              isDarkMode 
                ? 'bg-gray-900/95 border-white/10' 
                : 'bg-white/95 border-gray-200'
            }`}>
              <div className="flex gap-3 justify-end">
                <motion.button
                  onClick={handleClose}
                  disabled={isSubmitting}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                    isDarkMode
                      ? 'bg-gray-800 hover:bg-gray-700 text-white'
                      : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  Annuler
                </motion.button>
                <motion.button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !selectedCategory}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="px-6 py-3 rounded-xl font-semibold bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Envoi en cours...
                    </>
                  ) : (
                    <>
                      <FlagIcon className="w-5 h-5" />
                      Envoyer le signalement
                    </>
                  )}
                </motion.button>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ReportUserModal;