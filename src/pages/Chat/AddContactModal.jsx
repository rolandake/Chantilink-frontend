// ============================================
// 📁 src/pages/Chat/AddContactModal.jsx
// VERSION: ÉLITE - SECURE CONTACT ADDITION
// ============================================
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, X, AlertCircle, Check, ShieldCheck, Phone } from 'lucide-react';

export const AddContactModal = ({ isOpen, onClose, onAdd }) => {
  const [formData, setFormData] = useState({ phoneNumber: '', fullName: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Formatage propre : +225 01 02 03 04 05
  const formatPhoneDisplay = (value) => {
    let cleaned = value.replace(/[^\d+]/g, '');
    if (!cleaned.startsWith('+')) cleaned = '+' + cleaned.replace(/^\+/, '');
    if (cleaned.length > 16) cleaned = cleaned.slice(0, 16);
    
    // Ajoute des espaces tous les 2 chiffres après l'indicatif (simplifié)
    if (cleaned.length > 4) {
      const prefix = cleaned.slice(0, 4);
      const rest = cleaned.slice(4);
      const groups = rest.match(/.{1,2}/g);
      return prefix + (groups ? ' ' + groups.join(' ') : '');
    }
    return cleaned;
  };

  const handlePhoneChange = (e) => {
    const formatted = formatPhoneDisplay(e.target.value);
    setFormData(prev => ({ ...prev, phoneNumber: formatted }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const cleanedPhone = formData.phoneNumber.replace(/\s/g, '');

    if (!formData.fullName.trim()) return setError('Le nom est requis');
    if (cleanedPhone.length < 10) return setError('Numéro trop court');

    setLoading(true);
    try {
      await onAdd({ phoneNumber: cleanedPhone, fullName: formData.fullName.trim() });
      setFormData({ phoneNumber: '', fullName: '' });
      onClose();
    } catch (err) {
      setError(err.message || "Impossible d'ajouter ce contact");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[300] flex items-end md:items-center justify-center p-0 md:p-4">
        {/* Backdrop */}
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="relative bg-[#12151a] w-full max-w-md rounded-t-[32px] md:rounded-[24px] border-t md:border border-white/10 shadow-2xl overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="p-6 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-500">
                <UserPlus size={24} />
              </div>
              <div>
                <h2 className="text-xl font-black text-white uppercase tracking-tight">Nouveau Contact</h2>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest flex items-center gap-1">
                  <ShieldCheck size={10} className="text-green-500" /> Cercle Sécurisé
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-gray-400">
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Input Nom */}
            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 ml-1">Nom du collègue ou ami</label>
              <input
                type="text"
                value={formData.fullName}
                onChange={(e) => setFormData(p => ({ ...p, fullName: e.target.value }))}
                placeholder="Ex: Marc Koffi"
                className="w-full px-5 py-4 bg-[#0f1115] text-white rounded-2xl border border-white/5 focus:border-blue-500 outline-none transition-all placeholder:text-gray-700 font-bold"
                autoFocus
              />
            </div>

            {/* Input Téléphone */}
            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 ml-1">Numéro de téléphone</label>
              <div className="relative">
                <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" />
                <input
                  type="tel"
                  value={formData.phoneNumber}
                  onChange={handlePhoneChange}
                  placeholder="+225 00 00 00 00 00"
                  className="w-full pl-12 pr-5 py-4 bg-[#0f1115] text-white rounded-2xl border border-white/5 focus:border-blue-500 outline-none transition-all placeholder:text-gray-700 font-mono text-lg"
                />
              </div>
            </div>

            {/* Error Message */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                  className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3"
                >
                  <AlertCircle className="text-red-500 shrink-0" size={18} />
                  <span className="text-red-400 text-xs font-bold">{error}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Info Confidentialité */}
            <div className="p-4 bg-blue-500/5 rounded-2xl border border-blue-500/10">
              <p className="text-[10px] text-blue-400/80 leading-relaxed font-medium">
                🛡️ Ce contact sera ajouté à votre annuaire privé. S'il utilise déjà l'application, un canal de communication chiffré sera automatiquement créé.
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-4 bg-white/5 text-gray-400 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-white/10 transition-all"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Check size={18} /> Ajouter au cercle
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Footer Security Badge */}
          <div className="p-4 bg-black/20 text-center">
            <span className="text-[9px] text-gray-600 font-black uppercase tracking-[0.2em]">
              Protégé par cryptographie Chantilink
            </span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};