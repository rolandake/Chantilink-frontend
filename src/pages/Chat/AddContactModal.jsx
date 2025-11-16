
// ============================================
// 📁 src/Pages/chat/AddContactModal.jsx
// ============================================
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, X, AlertCircle, Check } from 'lucide-react';

export const AddContactModal = ({ isOpen, onClose, onAdd }) => {
  const [formData, setFormData] = useState({ phoneNumber: '', fullName: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const formatPhoneDisplay = (value) => {
    let cleaned = value.replace(/[^\d+]/g, '');
    if (!cleaned.startsWith('+')) cleaned = '+' + cleaned.replace(/^\+/, '');
    if (cleaned.length > 16) cleaned = cleaned.slice(0, 16);
    
    if (cleaned.length > 3) {
      const plus = '+';
      const rest = cleaned.slice(1);
      let formatted = plus + rest.slice(0, Math.min(3, rest.length));
      const remaining = rest.slice(Math.min(3, rest.length));
      const groups = remaining.match(/.{1,2}/g);
      if (groups) formatted += ' ' + groups.join(' ');
      return formatted;
    }
    return cleaned;
  };

  const handlePhoneChange = (e) => {
    const formatted = formatPhoneDisplay(e.target.value);
    setFormData(prev => ({ ...prev, phoneNumber: formatted }));
    setError('');
  };

  const validatePhone = (phone) => {
    const cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
    return /^\+[1-9][0-9]{6,14}$/.test(cleaned);
  };

  const handleSubmit = async () => {
    setError('');
    const cleanedPhone = formData.phoneNumber.replace(/[\s\-\(\)\.]/g, '');

    if (!formData.fullName.trim()) {
      setError('Le nom est requis');
      return;
    }

    if (!validatePhone(cleanedPhone)) {
      setError('Numéro invalide. Format : +33612345678');
      return;
    }

    setLoading(true);
    try {
      await onAdd({ phoneNumber: cleanedPhone, fullName: formData.fullName.trim() });
      setFormData({ phoneNumber: '', fullName: '' });
      onClose();
    } catch (err) {
      setError(err.message || 'Erreur lors de l\'ajout');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-3xl p-8 w-full max-w-md shadow-2xl border border-gray-700"
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <UserPlus className="w-7 h-7 text-orange-500" />
            Ajouter un contact
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Nom complet *</label>
            <input
              type="text"
              value={formData.fullName}
              onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
              placeholder="Ex: Jean Dupont"
              className="w-full px-4 py-3 bg-gray-800/50 text-white placeholder-gray-500 rounded-xl border-2 border-gray-700 focus:border-orange-500 focus:outline-none transition"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Numéro de téléphone *</label>
            <input
              type="tel"
              value={formData.phoneNumber}
              onChange={handlePhoneChange}
              placeholder="+33612345678"
              className="w-full px-4 py-3 bg-gray-800/50 text-white placeholder-gray-500 rounded-xl border-2 border-gray-700 focus:border-orange-500 focus:outline-none transition text-lg tracking-wide"
            />
          </div>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-2"
              >
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                <span className="text-red-400 text-sm">{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3">
            <p className="text-blue-300 text-xs flex items-start gap-2">
              <span className="text-base">ℹ️</span>
              <span>Le contact sera ajouté à votre liste et vous pourrez démarrer une conversation.</span>
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-gray-700/50 text-gray-300 rounded-xl hover:bg-gray-700 transition font-medium"
            >
              Annuler
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-orange-500 to-pink-500 text-white rounded-xl hover:from-orange-600 hover:to-pink-600 disabled:opacity-50 transition font-semibold shadow-lg flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white" />
                  <span>Ajout...</span>
                </>
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  <span>Ajouter</span>
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
