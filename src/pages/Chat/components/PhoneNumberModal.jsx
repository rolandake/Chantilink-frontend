// ============================================
// 📁 src/components/PhoneNumberModal.jsx
// Modal pour renseigner le numéro (obligatoire pour synchro)
// VERSION FINALE OPTIMISÉE
// ============================================
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, X, AlertCircle, Check, ShieldCheck, Info } from 'lucide-react';

export const PhoneNumberModal = ({ isOpen, onClose, onSubmit, canSkip = false }) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // ============================================
  // 📱 FORMATAGE DU NUMÉRO : +225 01 02 03 04 05
  // ============================================
  const formatPhoneDisplay = (value) => {
    // Nettoyer : garder uniquement chiffres et +
    let cleaned = value.replace(/[^\d+]/g, '');
    
    // S'assurer qu'il commence par +
    if (!cleaned.startsWith('+')) {
      cleaned = '+' + cleaned.replace(/^\+/, '');
    }
    
    // Limiter à 16 caractères max
    if (cleaned.length > 16) {
      cleaned = cleaned.slice(0, 16);
    }
    
    // Formater avec espaces : +225 01 02 03 04 05
    if (cleaned.length > 4) {
      const prefix = cleaned.slice(0, 4); // +225
      const rest = cleaned.slice(4);       // 0102030405
      const groups = rest.match(/.{1,2}/g); // ['01', '02', '03', '04', '05']
      return prefix + (groups ? ' ' + groups.join(' ') : '');
    }
    
    return cleaned;
  };

  // ============================================
  // 🔄 GESTION DU CHANGEMENT
  // ============================================
  const handlePhoneChange = (e) => {
    const formatted = formatPhoneDisplay(e.target.value);
    setPhoneNumber(formatted);
    setError(''); // Réinitialiser l'erreur
  };

  // ============================================
  // ✅ VALIDATION ET SOUMISSION
  // ============================================
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    // Enlever les espaces pour la validation
    const cleanedPhone = phoneNumber.replace(/\s/g, '');
    
    // Validation minimale
    if (cleanedPhone.length < 10) {
      return setError('Numéro trop court (minimum 10 chiffres)');
    }

    // Vérifier que c'est bien des chiffres après le +
    const digits = cleanedPhone.replace(/^\+/, '');
    if (!/^\d+$/.test(digits)) {
      return setError('Le numéro ne doit contenir que des chiffres');
    }

    setLoading(true);
    try {
      // Appeler la fonction parent (handlePhoneSubmit dans Messages.jsx)
      await onSubmit(cleanedPhone);
      // Ne pas fermer ici, c'est handlePhoneSubmit qui le fait
    } catch (err) {
      // Afficher l'erreur retournée par le backend
      setError(err.message || 'Erreur lors de la validation');
      setLoading(false); // ✅ Réactiver le bouton en cas d'erreur
    }
  };

  // ============================================
  // ⏭️ SAUTER (SI AUTORISÉ)
  // ============================================
  const handleSkip = () => {
    if (canSkip) {
      onClose();
    }
  };

  // ============================================
  // 🚫 NE PAS RENDRE SI FERMÉE
  // ============================================
  if (!isOpen) return null;

  // ============================================
  // 🎨 RENDU
  // ============================================
  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[400] flex items-end md:items-center justify-center p-0 md:p-4">
        
        {/* Backdrop sombre avec blur */}
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }}
          onClick={canSkip ? handleSkip : undefined}
          className="absolute inset-0 bg-black/90 backdrop-blur-md"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ y: "100%", opacity: 0 }} 
          animate={{ y: 0, opacity: 1 }} 
          exit={{ y: "100%", opacity: 0 }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="relative bg-[#12151a] w-full max-w-md rounded-t-[32px] md:rounded-[24px] border-t md:border border-white/10 shadow-2xl overflow-hidden"
        >
          {/* ========== HEADER ========== */}
          <div className="p-6 border-b border-white/5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-500">
                  <Phone size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-white">Votre numéro</h2>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest flex items-center gap-1">
                    <ShieldCheck size={10} className="text-green-500" /> Confidentialité garantie
                  </p>
                </div>
              </div>
              {canSkip && (
                <button 
                  onClick={handleSkip}
                  className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-gray-400 transition-colors"
                  aria-label="Fermer"
                >
                  <X size={20} />
                </button>
              )}
            </div>

            {/* Info Box - Pourquoi le numéro ? */}
            <div className="p-4 bg-blue-500/5 rounded-2xl border border-blue-500/10 flex gap-3">
              <Info size={18} className="text-blue-400 shrink-0 mt-0.5" />
              <div className="text-[11px] text-blue-400/90 leading-relaxed">
                <p className="font-bold mb-1">Pourquoi votre numéro ?</p>
                <ul className="space-y-1 text-blue-400/70">
                  <li>✓ Synchroniser vos contacts</li>
                  <li>✓ Retrouver vos amis sur Chantilink</li>
                  <li>✓ Faciliter les connexions sécurisées</li>
                </ul>
              </div>
            </div>
          </div>

          {/* ========== FORMULAIRE ========== */}
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            
            {/* Input Téléphone */}
            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 ml-1">
                Numéro de téléphone
              </label>
              <div className="relative">
                <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" />
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={handlePhoneChange}
                  placeholder="+225 00 00 00 00 00"
                  className="w-full pl-12 pr-5 py-4 bg-[#0f1115] text-white rounded-2xl border border-white/5 focus:border-blue-500 outline-none transition-all placeholder:text-gray-700 font-mono text-lg"
                  autoFocus
                  disabled={loading}
                />
              </div>
            </div>

            {/* Message d'erreur */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }} 
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3"
                >
                  <AlertCircle className="text-red-500 shrink-0" size={18} />
                  <span className="text-red-400 text-xs font-bold">{error}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Privacy Notice */}
            <div className="p-4 bg-green-500/5 rounded-2xl border border-green-500/10">
              <p className="text-[10px] text-green-400/80 leading-relaxed font-medium">
                🔒 Votre numéro est haché (SHA-256) avant stockage. Nous ne le partageons jamais avec des tiers.
              </p>
            </div>

            {/* Boutons d'action */}
            <div className="flex gap-3 pt-2">
              {canSkip && (
                <button
                  type="button"
                  onClick={handleSkip}
                  disabled={loading}
                  className="flex-1 py-4 bg-white/5 text-gray-400 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-white/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Plus tard
                </button>
              )}
              <button
                type="submit"
                disabled={loading || !phoneNumber.trim()}
                className={`${canSkip ? 'flex-[2]' : 'flex-1'} py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-500`}
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Check size={18} /> Valider & Synchroniser
                  </>
                )}
              </button>
            </div>
          </form>

          {/* ========== FOOTER ========== */}
          <div className="p-4 bg-black/20 text-center border-t border-white/5">
            <span className="text-[9px] text-gray-600 font-black uppercase tracking-[0.2em]">
              Chiffrement de bout en bout
            </span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};