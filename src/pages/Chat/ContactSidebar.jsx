// ============================================
// 📁 src/Pages/chat/ContactSidebar.jsx
// ✅ PHASE 1 — MODAL-BASED NAVIGATION
//    Chaque bouton ouvre sa modale avec retour
//    Conforme Google Play Policy (avril 2026)
// ============================================
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ShieldCheck, UserCheck, Search, Users, MessageSquare,
  UserPlus, Loader, ArrowLeft, X, Bell, ChevronRight,
  Clock, CheckCircle2, XCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '../../context/ToastContext';

// ─────────────────────────────────────────────
// HELPERS localStorage
// ─────────────────────────────────────────────
const readOnAppContacts = () => {
  try {
    const raw = localStorage.getItem('onAppContacts');
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
};

const saveContactToOnApp = (contact) => {
  if (!contact?.id) return;
  try {
    const existing = readOnAppContacts();
    const updated = [contact, ...existing.filter((c) => c.id !== contact.id)];
    localStorage.setItem('onAppContacts', JSON.stringify(updated));
  } catch {}
};

// ─────────────────────────────────────────────
// API
// ─────────────────────────────────────────────
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const syncContactsAPI = async (token, contacts) => {
  const res = await fetch(`${BASE_URL}/contacts/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ contacts }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `Erreur ${res.status}`);
  return data;
};

// ─────────────────────────────────────────────
// Contact Picker natif
// ─────────────────────────────────────────────
const openContactPicker = async () => {
  try {
    if (!('contacts' in navigator && 'ContactsManager' in window)) return null;
    const props = ['name', 'tel'];
    const opts  = { multiple: true };
    const raw   = await navigator.contacts.select(props, opts);
    return raw.flatMap((c) =>
      (c.tel || []).map((phone) => ({ name: c.name?.[0] || 'Inconnu', phone }))
    );
  } catch (err) {
    console.info('Contact Picker annulé:', err.message);
    return null;
  }
};

const isContactPickerSupported = () =>
  typeof window !== 'undefined' &&
  'contacts' in navigator &&
  'ContactsManager' in window;

// ─────────────────────────────────────────────
// OVERLAY MODALE — conteneur réutilisable
// ─────────────────────────────────────────────
const ModalOverlay = ({ children, onClose }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
    onClick={onClose}
  >
    {/* Backdrop */}
    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
    {/* Sheet */}
    <motion.div
      initial={{ y: 60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 60, opacity: 0 }}
      transition={{ type: 'spring', damping: 28, stiffness: 300 }}
      className="relative z-10 w-full max-w-md bg-[#13161c] border border-white/10 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden"
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </motion.div>
  </motion.div>
);

// ─────────────────────────────────────────────
// MODALE — Ajouter un contact (Contact Picker)
// ─────────────────────────────────────────────
const AddContactModal = ({ token, onClose, onPickerSync }) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState(null); // null | { found: [], total: number }
  const [step, setStep]       = useState('idle'); // idle | picking | done
  const { showToast } = useToast();
  const pickerSupported = isContactPickerSupported();

  const handlePick = async () => {
    setLoading(true);
    setStep('picking');
    try {
      const picked = await openContactPicker();
      if (picked === null) { setStep('idle'); setLoading(false); return; }
      if (picked.length === 0) {
        showToast('Aucun contact sélectionné', 'info');
        setStep('idle'); setLoading(false); return;
      }
      const data = await syncContactsAPI(token, picked);
      const found = data.onChantilink || [];
      found.forEach(saveContactToOnApp);
      setResult({ found, total: picked.length });
      setStep('done');
      if (onPickerSync) onPickerSync(found);
    } catch (err) {
      showToast(err.message || 'Erreur lors de la vérification', 'error');
      setStep('idle');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalOverlay onClose={onClose}>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-white/5">
        {step === 'done' && (
          <button onClick={() => setStep('idle')} className="p-1.5 hover:bg-white/5 rounded-xl transition-colors">
            <ArrowLeft size={18} className="text-gray-400" />
          </button>
        )}
        <div className="flex-1">
          <h2 className="text-base font-black text-white">
            {step === 'done' ? 'Résultats' : 'Ajouter des contacts'}
          </h2>
          <p className="text-[11px] text-gray-500">
            {step === 'done' ? `${result?.total} contact(s) vérifiés` : 'Sélectionnez depuis votre téléphone'}
          </p>
        </div>
        <button onClick={onClose} className="p-1.5 hover:bg-white/5 rounded-xl transition-colors">
          <X size={18} className="text-gray-400" />
        </button>
      </div>

      <div className="p-5">
        <AnimatePresence mode="wait">

          {/* ÉTAT IDLE */}
          {step === 'idle' && (
            <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {pickerSupported ? (
                <>
                  {/* Explication */}
                  <div className="bg-blue-500/8 border border-blue-500/15 rounded-2xl p-4 mb-5 space-y-2">
                    {[
                      'Un sélecteur de contacts s\'ouvre',
                      'Vous choisissez qui vérifier',
                      'Numéros hachés SHA-256 en local',
                      'Comparaison sécurisée avec la base',
                    ].map((step, i) => (
                      <div key={i} className="flex items-center gap-2.5 text-xs text-gray-400">
                        <span className="w-5 h-5 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                          {i + 1}
                        </span>
                        {step}
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={handlePick}
                    disabled={loading}
                    className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold rounded-2xl flex items-center justify-center gap-2 transition-all text-sm"
                  >
                    {loading
                      ? <><Loader size={16} className="animate-spin" /> Recherche…</>
                      : <><UserPlus size={16} /> Sélectionner mes contacts</>
                    }
                  </button>
                </>
              ) : (
                <div className="text-center py-8">
                  <div className="w-14 h-14 rounded-2xl bg-yellow-500/10 flex items-center justify-center mx-auto mb-4">
                    <UserPlus size={28} className="text-yellow-400/60" />
                  </div>
                  <p className="text-sm font-bold text-gray-300 mb-2">Disponible sur mobile</p>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    La sélection de contacts est disponible sur iOS et Android uniquement.
                  </p>
                </div>
              )}
            </motion.div>
          )}

          {/* ÉTAT DONE */}
          {step === 'done' && result && (
            <motion.div key="done" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {result.found.length > 0 ? (
                <>
                  <div className="flex items-center gap-3 mb-4 p-3 bg-green-500/8 border border-green-500/15 rounded-2xl">
                    <CheckCircle2 size={20} className="text-green-400 flex-shrink-0" />
                    <p className="text-sm text-gray-300">
                      <span className="text-white font-black">{result.found.length}</span> ami(s) trouvés sur Chantilink
                    </p>
                  </div>
                  <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                    {result.found.map((c) => (
                      <div key={c.id || c._id} className="flex items-center gap-3 p-3 bg-white/[0.03] rounded-xl border border-white/5">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-sm font-black overflow-hidden">
                          {c.profilePhoto
                            ? <img src={c.profilePhoto} alt="" className="w-full h-full object-cover" />
                            : c.fullName?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white">{c.fullName}</p>
                          {c.username && <p className="text-xs text-gray-500">@{c.username}</p>}
                        </div>
                        <CheckCircle2 size={14} className="text-green-400 ml-auto flex-shrink-0" />
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-6">
                  <XCircle size={36} className="text-gray-600 mx-auto mb-3" />
                  <p className="text-sm font-bold text-gray-300 mb-1">Aucun ami trouvé</p>
                  <p className="text-xs text-gray-500">
                    Aucun de vos {result.total} contacts n'utilise encore Chantilink.
                  </p>
                </div>
              )}
              <button
                onClick={onClose}
                className="w-full mt-4 py-3 bg-white/5 hover:bg-white/10 text-gray-300 font-bold rounded-2xl text-sm transition-all"
              >
                Fermer
              </button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </ModalOverlay>
  );
};

// ─────────────────────────────────────────────
// MODALE — Liste des contacts (recherche)
// ─────────────────────────────────────────────
const ContactsModal = ({ contacts, unreadCounts, onContactSelect, onClose, onAddContact }) => {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() =>
    contacts.filter((c) =>
      (c.fullName || c.name || '').toLowerCase().includes(search.toLowerCase())
    ), [contacts, search]);

  return (
    <ModalOverlay onClose={onClose}>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-white/5">
        <ShieldCheck size={18} className="text-blue-500 flex-shrink-0" />
        <div className="flex-1">
          <h2 className="text-base font-black text-white">Sur Chantilink</h2>
          <p className="text-[11px] text-gray-500">{contacts.length} contact(s)</p>
        </div>
        <button
          onClick={onAddContact}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded-xl text-xs font-bold border border-blue-500/20 transition-all"
        >
          <UserPlus size={12} />
          Ajouter
        </button>
        <button onClick={onClose} className="p-1.5 hover:bg-white/5 rounded-xl transition-colors ml-1">
          <X size={18} className="text-gray-400" />
        </button>
      </div>

      {/* Recherche */}
      <div className="px-5 pt-4 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un contact…"
            className="w-full bg-white/[0.04] border border-white/8 rounded-xl py-2.5 pl-9 pr-4 text-sm outline-none focus:border-blue-500/50 transition-all text-white placeholder:text-gray-600"
            autoFocus
          />
        </div>
      </div>

      {/* Liste */}
      <div className="overflow-y-auto max-h-[50vh] custom-scrollbar px-2 pb-5">
        {filtered.length > 0 ? (
          filtered.map((u) => (
            <button
              key={u.id || u._id}
              onClick={() => { onContactSelect(u); onClose(); }}
              className="w-full flex items-center gap-3 p-3 hover:bg-white/[0.04] rounded-xl transition-all group"
            >
              <div className="relative flex-shrink-0">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center font-black text-base border border-white/5 bg-gradient-to-br from-blue-600 to-indigo-700 overflow-hidden">
                  {u.profilePhoto
                    ? <img src={u.profilePhoto} alt="" className="w-full h-full object-cover" />
                    : (u.fullName?.[0]?.toUpperCase() || '?')}
                </div>
                {u.isOnline && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-[#13161c]" />
                )}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-bold text-gray-100 truncate">{u.fullName}</p>
                <p className="text-[11px] text-gray-500 truncate">
                  {u.username ? `@${u.username}` : 'Disponible'}
                </p>
              </div>
              {unreadCounts?.[u.id || u._id] > 0 && (
                <span className="bg-blue-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded-md flex-shrink-0">
                  {unreadCounts[u.id || u._id]}
                </span>
              )}
              <ChevronRight size={14} className="text-gray-600 group-hover:text-gray-400 transition-colors flex-shrink-0" />
            </button>
          ))
        ) : (
          <div className="text-center py-10">
            <Users size={36} className="text-gray-700 mx-auto mb-3" />
            <p className="text-sm text-gray-500">Aucun contact trouvé</p>
          </div>
        )}
      </div>
    </ModalOverlay>
  );
};

// ─────────────────────────────────────────────
// COMPOSANT PRINCIPAL
// ─────────────────────────────────────────────
export const ContactSidebar = ({
  token,
  onContactSelect,
  contacts = [],
  unreadCounts = {},
  user,
  onPickerSync,
  onShowPending,
  conversations = [],
  onShowConversations,
  totalUnread = 0,
}) => {
  const [onAppContacts, setOnAppContacts] = useState([]);
  const [searchQuery,   setSearchQuery]   = useState('');
  const [modal, setModal] = useState(null); // null | 'contacts' | 'add'
  const [pickerSupported] = useState(isContactPickerSupported());
  const { showToast } = useToast();

  const reloadOnAppContacts = useCallback(() => {
    setOnAppContacts(readOnAppContacts());
  }, []);

  useEffect(() => { reloadOnAppContacts(); }, [reloadOnAppContacts]);

  useEffect(() => {
    window.addEventListener('focus', reloadOnAppContacts);
    return () => window.removeEventListener('focus', reloadOnAppContacts);
  }, [reloadOnAppContacts]);

  useEffect(() => {
    if (contacts.length > 0) {
      contacts.forEach((c) => {
        if (c.id || c._id) {
          saveContactToOnApp({
            id: c.id || c._id,
            fullName: c.fullName,
            username: c.username,
            profilePhoto: c.profilePhoto,
            isOnline: c.isOnline,
            lastSeen: c.lastSeen,
          });
        }
      });
      reloadOnAppContacts();
    }
  }, [contacts, reloadOnAppContacts]);

  const filteredContacts = useMemo(() =>
    onAppContacts.filter((c) =>
      (c.fullName || c.name || '').toLowerCase().includes(searchQuery.toLowerCase())
    ), [onAppContacts, searchQuery]);

  const handlePickerSync = useCallback((newContacts) => {
    newContacts.forEach(saveContactToOnApp);
    reloadOnAppContacts();
    if (onPickerSync) onPickerSync(newContacts);
    setModal(null);
  }, [onPickerSync, reloadOnAppContacts]);


  return (
    <>
      <div className="flex flex-col h-full bg-[#0b0d10] border-r border-white/5">

        {/* HEADER COMPACT */}
        <div className="px-4 py-3 bg-[#12151a]/80 backdrop-blur-xl border-b border-white/5">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-blue-500 flex-shrink-0" />
            <span className="text-sm font-black tracking-tight bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent flex-1">
              Mes Contacts
            </span>

            {/* Bouton Conversations */}
            {onShowConversations && (
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={onShowConversations}
                className="relative flex items-center gap-1.5 px-2.5 py-1.5 bg-purple-600/15 hover:bg-purple-600/25 text-purple-400 rounded-lg transition-all text-[11px] font-bold border border-purple-500/20"
                title="Conversations"
              >
                <MessageSquare size={12} />
                Conv.
                {totalUnread > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[15px] h-[15px] bg-red-500 text-white text-[9px] font-black px-1 rounded-full flex items-center justify-center">
                    {totalUnread > 99 ? '99+' : totalUnread}
                  </span>
                )}
              </motion.button>
            )}

            {/* Bouton Ajouter */}
            {pickerSupported && (
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => setModal('add')}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600/15 hover:bg-blue-600/25 text-blue-400 rounded-lg transition-all text-[11px] font-bold border border-blue-500/20"
                title="Ajouter des contacts"
              >
                <UserPlus size={12} />
                Ajouter
              </motion.button>
            )}
          </div>

          {/* RECHERCHE */}
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" size={13} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher…"
              className="w-full bg-white/[0.04] border border-white/5 rounded-xl py-2 pl-9 pr-4 text-xs outline-none focus:border-blue-500/40 transition-all text-white placeholder:text-gray-600"
            />
          </div>
        </div>

        {/* LISTE */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2">

          {/* Label cliquable → ouvre modale contacts */}
          <button
            onClick={() => setModal('contacts')}
            className="w-full flex items-center justify-between px-3 mb-2 group"
          >
            <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em] flex items-center gap-1.5">
              <Users size={11} />
              Sur Chantilink ({filteredContacts.length})
            </p>
            <ChevronRight size={12} className="text-blue-500/40 group-hover:text-blue-500 transition-colors" />
          </button>

          <AnimatePresence>
            {filteredContacts.length > 0
              ? filteredContacts.slice(0, 8).map((u) => (
                  <motion.div
                    key={u.id || u._id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    <ContactItem
                      user={u}
                      unread={unreadCounts[u.id || u._id]}
                      onClick={() => onContactSelect({
                        id: u.id || u._id,
                        fullName: u.fullName,
                        username: u.username,
                        profilePhoto: u.profilePhoto,
                        isOnline: u.isOnline,
                        lastSeen: u.lastSeen,
                      })}
                    />
                  </motion.div>
                ))
              : (
                  <EmptyState
                    pickerSupported={pickerSupported}
                    onAdd={() => setModal('add')}
                  />
                )
            }
          </AnimatePresence>

          {/* Voir tous si > 8 */}
          {filteredContacts.length > 8 && (
            <button
              onClick={() => setModal('contacts')}
              className="w-full mt-1 py-2 text-xs text-blue-500/60 hover:text-blue-400 transition-colors font-bold"
            >
              Voir tous ({filteredContacts.length - 8} de plus)
            </button>
          )}
        </div>

        {/* FOOTER — Demandes uniquement */}
        {onShowPending && (
          <div className="px-3 pb-3 pt-2 border-t border-white/5">
            <button
              onClick={onShowPending}
              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-white/[0.04] rounded-xl transition-all group"
            >
              <div className="flex items-center gap-2 text-xs text-gray-500 group-hover:text-gray-300 transition-colors">
                <Bell size={13} />
                Demandes de messages
              </div>
              <ChevronRight size={12} className="text-gray-700 group-hover:text-gray-500" />
            </button>
          </div>
        )}
      </div>

      {/* ── MODALES ── */}
      <AnimatePresence>
        {modal === 'add' && (
          <AddContactModal
            key="modal-add"
            token={token}
            onClose={() => setModal(null)}
            onPickerSync={handlePickerSync}
          />
        )}
        {modal === 'contacts' && (
          <ContactsModal
            key="modal-contacts"
            contacts={onAppContacts}
            unreadCounts={unreadCounts}
            onContactSelect={onContactSelect}
            onClose={() => setModal(null)}
            onAddContact={() => setModal('add')}
          />
        )}
      </AnimatePresence>
    </>
  );
};

// ─────────────────────────────────────────────
// SOUS-COMPOSANTS
// ─────────────────────────────────────────────
const ContactItem = ({ user, unread, onClick }) => (
  <button
    onClick={onClick}
    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/[0.03] active:bg-white/[0.05] cursor-pointer transition-all rounded-xl group"
  >
    <div className="relative flex-shrink-0">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-base border border-white/5 bg-gradient-to-br from-blue-600 to-indigo-700 overflow-hidden">
        {user.profilePhoto
          ? <img src={user.profilePhoto} alt="" className="w-full h-full object-cover" />
          : (user.fullName?.[0]?.toUpperCase() || '?')}
      </div>
      {user.isOnline && (
        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-[#0b0d10]" />
      )}
    </div>
    <div className="flex-1 min-w-0 text-left">
      <p className="text-sm font-bold text-gray-100 truncate group-hover:text-white">{user.fullName}</p>
      <p className="text-[11px] text-gray-600 truncate">
        {user.username ? `@${user.username}` : 'Disponible'}
      </p>
    </div>
    {unread > 0 && (
      <span className="bg-blue-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded-md flex-shrink-0">
        {unread}
      </span>
    )}
  </button>
);

const EmptyState = ({ pickerSupported, onAdd }) => (
  <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
    <div className="w-12 h-12 rounded-2xl bg-blue-600/8 flex items-center justify-center mb-3">
      <Users size={24} className="text-blue-500/30" />
    </div>
    <p className="text-xs font-bold text-gray-500 mb-1">Aucun contact</p>
    {pickerSupported && (
      <button
        onClick={onAdd}
        className="mt-3 flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all"
      >
        <UserPlus size={13} />
        Ajouter des contacts
      </button>
    )}
  </div>
);

export default ContactSidebar;