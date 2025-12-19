// ============================================
// 📁 src/pages/Chat/components/ForwardModal.jsx
// VERSION: ÉLITE - SECURE FORWARDING
// ============================================

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, Search, Send, ShieldCheck, 
  FileText, Image as ImageIcon, Mic 
} from "lucide-react";

export default function ForwardModal({ isOpen, onClose, message, contacts, onForward }) {
  const [search, setSearch] = useState("");

  // Filtrer les contacts pour le transfert
  const filteredContacts = useMemo(() => {
    return contacts.filter(c => 
      c.isOnChantilink && (
        c.fullName?.toLowerCase().includes(search.toLowerCase()) || 
        c.phone?.includes(search)
      )
    );
  }, [contacts, search]);

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
          className="relative bg-[#12151a] w-full max-w-md rounded-t-[32px] md:rounded-[24px] border-t md:border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        >
          {/* Header */}
          <div className="p-6 border-b border-white/5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-black text-white flex items-center gap-2">
                Transférer
              </h3>
              <button onClick={onClose} className="p-2 bg-white/5 rounded-full text-gray-400">
                <X size={20} />
              </button>
            </div>

            {/* Barre de Recherche */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
              <input
                type="text"
                placeholder="Rechercher un collègue..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-[#0f1115] text-white rounded-2xl text-sm border border-white/5 focus:border-blue-500 outline-none transition-all"
              />
            </div>
          </div>

          {/* Preview du message à transférer */}
          <div className="px-6 py-3 bg-blue-500/5 border-b border-white/5">
            <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5">
              {message.type === 'image' ? <ImageIcon size={16} className="text-blue-400" /> : 
               message.type === 'audio' ? <Mic size={16} className="text-blue-400" /> :
               <FileText size={16} className="text-blue-400" />}
              
              <p className="text-xs text-gray-400 truncate flex-1 italic">
                {message.content || "Fichier média"}
              </p>
            </div>
          </div>

          {/* Liste des Contacts */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
            {filteredContacts.length > 0 ? (
              filteredContacts.map(contact => (
                <button
                  key={contact.id}
                  onClick={() => onForward(contact, message)}
                  className="w-full flex items-center justify-between p-4 hover:bg-white/5 rounded-2xl transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-sm shadow-lg">
                      {(contact.fullName?.[0] || '?').toUpperCase()}
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-white truncate">{contact.fullName}</p>
                      <p className="text-[10px] text-gray-500 uppercase tracking-widest font-black">Canal Sécurisé</p>
                    </div>
                  </div>
                  <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                    <Send size={16} />
                  </div>
                </button>
              ))
            ) : (
              <div className="p-12 text-center opacity-30">
                <p className="text-sm">Aucun contact trouvé</p>
              </div>
            )}
          </div>

          {/* Footer Sécurisé */}
          <div className="p-4 bg-black/20 border-t border-white/5 flex items-center justify-center gap-2 text-[10px] text-gray-600 font-bold uppercase tracking-widest">
            <ShieldCheck size={12} /> Transfert sécurisé par Chantilink
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}