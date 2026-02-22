// ============================================
// 📁 ContactSidebar.jsx
// ✅ Onglet "Sur l'app"  = contacts venus de ProfileHeader + sync téléphone Chantilink
// ✅ Onglet "Téléphone"  = uniquement contacts natifs du carnet téléphonique
// ✅ Rechargement auto depuis localStorage (window focus + clic onglet)
// ============================================
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ShieldCheck, RefreshCw, UserCheck,
  Search, Users, MessageSquare, Send, Smartphone
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '../../context/ToastContext';
import { Capacitor } from '@capacitor/core';
import nativeContactsService from '../../services/nativeContactsService';

// ─────────────────────────────────────────────
// ✅ HELPER — lire onAppContacts depuis localStorage
// ─────────────────────────────────────────────
const readOnAppContacts = () => {
  try {
    const raw = localStorage.getItem('onAppContacts');
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
};

// ─────────────────────────────────────────────
// API SERVICE
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

// ============================================
// COMPOSANT PRINCIPAL
// ============================================
export const ContactSidebar = ({
  token,
  onContactSelect,
  contacts = [],
  unreadCounts = {},
  user,
  onSyncComplete
}) => {
  const [loading,          setLoading]          = useState(false);
  const [allPhoneContacts, setAllPhoneContacts] = useState([]);
  const [onAppContacts,    setOnAppContacts]    = useState([]);
  const [searchQuery,      setSearchQuery]      = useState('');
  const [activeTab,        setActiveTab]        = useState('onapp'); // ✅ "Sur l'app" par défaut
  const [syncProgress,     setSyncProgress]     = useState(0);
  const [isNativeSync,     setIsNativeSync]     = useState(false);
  const { showToast } = useToast();

  // ─────────────────────────────────────────────
  // ✅ CHARGEMENT depuis localStorage
  // ─────────────────────────────────────────────
  const reloadOnAppContacts = useCallback(() => {
    setOnAppContacts(readOnAppContacts());
  }, []);

  useEffect(() => {
    // Contacts téléphone
    try {
      const saved = localStorage.getItem('allPhoneContacts');
      if (saved) setAllPhoneContacts(JSON.parse(saved));
    } catch {}
    // Contacts "Sur l'app"
    reloadOnAppContacts();
  }, [reloadOnAppContacts]);

  // ✅ Rechargement quand la fenêtre reprend le focus
  // (ex : retour depuis ProfilePage après clic "Message")
  useEffect(() => {
    window.addEventListener('focus', reloadOnAppContacts);
    return () => window.removeEventListener('focus', reloadOnAppContacts);
  }, [reloadOnAppContacts]);

  // ─────────────────────────────────────────────
  // Changement d'onglet — recharge "Sur l'app" à chaque activation
  // ─────────────────────────────────────────────
  const handleTabClick = (tab) => {
    if (tab === 'onapp') reloadOnAppContacts();
    setActiveTab(tab);
  };

  // ─────────────────────────────────────────────
  // 🔍 FILTRAGE
  // ─────────────────────────────────────────────
  const filteredPhoneContacts = useMemo(() =>
    allPhoneContacts.filter(c =>
      (c.name || '').toLowerCase().includes(searchQuery.toLowerCase())
    ), [allPhoneContacts, searchQuery]);

  const filteredOnAppContacts = useMemo(() =>
    onAppContacts.filter(c =>
      (c.fullName || c.name || '').toLowerCase().includes(searchQuery.toLowerCase())
    ), [onAppContacts, searchQuery]);

  // ─────────────────────────────────────────────
  // 🔍 DÉTECTION ENVIRONNEMENT
  // ─────────────────────────────────────────────
  useEffect(() => {
    const isNative = Capacitor.isNativePlatform();
    setIsNativeSync(isNative);
    if (!isNative) {
      // Web : vider les contacts téléphone (pas pertinents)
      if (localStorage.getItem('allPhoneContacts')) {
        localStorage.removeItem('allPhoneContacts');
        setAllPhoneContacts([]);
      }
    }
  }, []);

  // ─────────────────────────────────────────────
  // 🔥 SYNCHRONISATION CONTACTS NATIFS (téléphone)
  // ─────────────────────────────────────────────
  const handleSyncProcess = async () => {
    setLoading(true);
    setSyncProgress(0);
    try {
      const hasPermission = await nativeContactsService.checkPermissions();
      if (!hasPermission) {
        showToast("📱 Demande d'accès aux contacts...", 'info');
        const granted = await nativeContactsService.requestPermissions();
        if (!granted) {
          showToast("❌ Accès refusé. Activez dans Paramètres > Chantilink > Contacts", 'warning');
          setLoading(false); setSyncProgress(0);
          return;
        }
        showToast('✅ Accès autorisé !', 'success');
      }
      await performSync();
    } catch (err) {
      if (err.message?.includes('Permission')) {
        showToast("❌ Permission refusée.", 'error');
      } else if (err.message?.includes('not available')) {
        showToast('⚠️ Non disponible sur cet appareil', 'warning');
      } else {
        showToast(err.message || 'Erreur de synchronisation', 'error');
      }
      setLoading(false); setSyncProgress(0);
    }
  };

  const performSync = async () => {
    showToast('📱 Lecture des contacts...', 'info');
    const result = await nativeContactsService.syncWithBackend(token, (p) => setSyncProgress(p));
    if (!result.success) throw new Error(result.errors?.[0] || 'Échec de la synchronisation');

    const onChantilink    = result.onChantilink    || [];
    const notOnChantilink = result.notOnChantilink || [];

    // ✅ Onglet "Téléphone" = TOUS les contacts du carnet
    const allContacts = [
      ...onChantilink.map(c    => ({ name: c.fullName, phone: c.phone, isOnApp: true,  appData: c })),
      ...notOnChantilink.map(c => ({ name: c.name,     phone: c.phone, isOnApp: false })),
    ];
    setAllPhoneContacts(allContacts);
    localStorage.setItem('allPhoneContacts', JSON.stringify(allContacts));

    // ✅ Onglet "Sur l'app" = fusionner nouveaux contacts Chantilink + contacts déjà là (venus de profils)
    const existingOnApp = readOnAppContacts();
    const syncedIds     = new Set(onChantilink.map(c => c.id || c._id));
    const keepExisting  = existingOnApp.filter(c => !syncedIds.has(c.id)); // éviter doublons
    const normalizedNew = onChantilink.map(c => ({
      id: c.id || c._id,
      fullName: c.fullName,
      username: c.username,
      profilePhoto: c.profilePhoto,
      isOnline: c.isOnline,
      lastSeen: c.lastSeen,
    }));
    const merged = [...normalizedNew, ...keepExisting];
    setOnAppContacts(merged);
    localStorage.setItem('onAppContacts', JSON.stringify(merged));

    if (onChantilink.length > 0) {
      setActiveTab('onapp');
      showToast(`✅ ${onChantilink.length} ami${onChantilink.length > 1 ? 's' : ''} trouvé${onChantilink.length > 1 ? 's' : ''} sur Chantilink !`, 'success');
      if (onSyncComplete) onSyncComplete(onChantilink);
    } else if (allContacts.length > 0) {
      setActiveTab('phone');
      showToast(`📱 ${allContacts.length} contact${allContacts.length > 1 ? 's' : ''} synchronisé${allContacts.length > 1 ? 's' : ''}`, 'info');
    } else {
      showToast('Aucun contact trouvé', 'info');
    }

    setLoading(false); setSyncProgress(0);
  };

  const handleInvite = (contact) => {
    const text = `Salut ! Rejoins-moi sur Chantilink 🔒\n\n${window.location.origin}/register`;
    const phone = contact.phone.replace(/\D/g, '');
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
    showToast(`Invitation envoyée à ${contact.name}`, 'success');
  };

  // ─────────────────────────────────────────────
  // RENDU
  // ─────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-[#0b0d10] border-r border-white/5">

      {/* HEADER */}
      <div className="p-5 bg-[#12151a]/80 backdrop-blur-xl border-b border-white/5">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-black tracking-tighter flex items-center gap-2">
            <ShieldCheck className="text-blue-500" size={22} />
            <span className="bg-gradient-to-r from-white to-gray-500 bg-clip-text text-transparent">
              CONTACTS
            </span>
          </h2>
          <div className="flex items-center gap-2">
            {isNativeSync && (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-green-500/10 text-green-500">
                <Smartphone size={14} />
                <span className="text-[9px] font-black uppercase tracking-wider">NATIF</span>
              </div>
            )}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={handleSyncProcess}
              disabled={loading}
              className="p-2 hover:bg-white/5 rounded-xl transition-colors relative"
              title="Synchroniser les contacts téléphone"
            >
              <RefreshCw size={20} className={`${loading ? 'animate-spin' : ''} text-gray-400`} />
              {loading && <span className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full animate-pulse" />}
            </motion.button>
          </div>
        </div>

        {/* BARRE DE PROGRESSION */}
        {loading && syncProgress > 0 && (
          <div className="mb-3">
            <div className="bg-[#0b0d10] rounded-full h-2 overflow-hidden border border-white/5">
              <motion.div
                className="h-full bg-gradient-to-r from-blue-500 to-indigo-600"
                initial={{ width: 0 }}
                animate={{ width: `${syncProgress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <p className="text-xs text-gray-500 text-center mt-1">{syncProgress}% 📱</p>
          </div>
        )}

        {/* RECHERCHE */}
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-500 transition-colors" size={16} />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Rechercher..."
            className="w-full bg-[#0b0d10] border border-white/5 rounded-xl py-2.5 pl-10 pr-4 text-sm outline-none focus:border-blue-500/50 transition-all text-white"
          />
        </div>
      </div>

      {/* TABS — "Sur l'app" en premier */}
      <div className="flex p-2 gap-2 bg-[#12151a]/30">
        <TabButton
          active={activeTab === 'onapp'}
          onClick={() => handleTabClick('onapp')}
          label="Sur l'app"
          icon={<Users size={14} />}
          badge={onAppContacts.length}
          highlight
        />
        <TabButton
          active={activeTab === 'phone'}
          onClick={() => handleTabClick('phone')}
          label="Téléphone"
          icon={<Smartphone size={14} />}
          badge={allPhoneContacts.length}
        />
      </div>

      {/* LISTES */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <AnimatePresence mode="wait">

          {/* ✅ "Sur l'app" — contacts venus de profils + contacts synchro Chantilink */}
          {activeTab === 'onapp' && (
            <motion.div
              key="onapp"
              initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
              className="p-2"
            >
              <p className="text-[10px] font-black text-blue-500 uppercase px-3 mb-3 tracking-[0.2em] flex items-center gap-2">
                <Users size={12} />
                Disponibles sur Chantilink ({filteredOnAppContacts.length})
              </p>
              {filteredOnAppContacts.length > 0
                ? filteredOnAppContacts.map(u => (
                    <ContactItem
                      key={u.id || u._id}
                      user={u}
                      unread={unreadCounts[u.id || u._id]}
                      onClick={() => onContactSelect(u)}
                    />
                  ))
                : <EmptyState
                    icon={<Users size={40} />}
                    text="Aucun contact sur l'app"
                    subtext="Envoyez un message depuis un profil, ou synchronisez vos contacts"
                  />
              }
            </motion.div>
          )}

          {/* ✅ "Téléphone" — uniquement contacts natifs du carnet */}
          {activeTab === 'phone' && (
            <motion.div
              key="phone"
              initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
              className="p-2"
            >
              <p className="text-[10px] font-black text-gray-500 uppercase px-3 mb-3 tracking-[0.2em] flex items-center gap-2">
                <Smartphone size={12} />
                Contacts téléphone ({filteredPhoneContacts.length})
              </p>
              {filteredPhoneContacts.length > 0
                ? filteredPhoneContacts.map((c, i) => (
                    <PhoneContactItem
                      key={i}
                      contact={c}
                      onInvite={() => handleInvite(c)}
                      onSelect={() => c.isOnApp && c.appData && onContactSelect(c.appData)}
                    />
                  ))
                : <EmptyState
                    icon={<Smartphone size={40} />}
                    text={isNativeSync ? 'Aucun contact synchronisé' : 'Synchronisation mobile uniquement'}
                    subtext={isNativeSync ? 'Appuyez sur ↻ pour importer' : 'Ouvrez l\'app sur iOS ou Android'}
                  />
              }
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// SOUS-COMPOSANTS
// ─────────────────────────────────────────────

const TabButton = ({ active, onClick, label, icon, badge, highlight }) => (
  <button
    onClick={onClick}
    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all
      ${active
        ? highlight
          ? 'bg-blue-600/20 text-blue-400 border border-blue-500/20'
          : 'bg-white/5 text-white'
        : 'text-gray-500 hover:text-gray-300'
      }`}
  >
    {icon}{label}
    {badge > 0 && (
      <span className={`text-white text-[9px] px-1.5 py-0.5 rounded-full ${highlight ? 'bg-blue-600' : 'bg-gray-600'}`}>
        {badge}
      </span>
    )}
  </button>
);

const PhoneContactItem = ({ contact, onInvite, onSelect }) => (
  <div className="flex items-center gap-3 p-4 bg-white/[0.02] hover:bg-white/[0.04] rounded-xl mb-2 transition-all">
    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg ${
      contact.isOnApp ? 'bg-blue-600 border border-blue-500/30' : 'bg-gray-700/50 border border-gray-600/30'
    }`}>
      {contact.name?.[0]?.toUpperCase() || '?'}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-bold text-gray-100 truncate">{contact.name}</p>
      {contact.isOnApp
        ? <span className="text-[9px] text-blue-500 font-black uppercase tracking-wider flex items-center gap-1"><UserCheck size={10} /> Sur Chantilink</span>
        : <span className="text-[9px] text-gray-600 font-bold uppercase">Pas encore sur l'app</span>
      }
    </div>
    {contact.isOnApp
      ? <button onClick={onSelect} className="p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all active:scale-95"><MessageSquare size={16} /></button>
      : <button onClick={onInvite} className="p-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl transition-all active:scale-95"><Send size={16} /></button>
    }
  </div>
);

const ContactItem = ({ user, unread, onClick }) => (
  <div
    onClick={() => onClick({ id: user.id || user._id, fullName: user.fullName, username: user.username, profilePhoto: user.profilePhoto, isOnline: user.isOnline, lastSeen: user.lastSeen })}
    className="flex items-center gap-3 p-4 hover:bg-white/[0.03] active:bg-white/[0.05] cursor-pointer transition-all group"
  >
    <div className="relative">
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg border border-white/5 bg-gradient-to-br from-blue-600 to-indigo-700 overflow-hidden">
        {user.profilePhoto
          ? <img src={user.profilePhoto} alt="" className="w-full h-full object-cover" />
          : (user.fullName?.[0]?.toUpperCase() || '?')
        }
      </div>
      {user.isOnline && <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-[3px] border-[#0b0d10]" />}
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex justify-between items-baseline">
        <p className="text-sm font-bold text-gray-100 truncate group-hover:text-white">{user.fullName}</p>
        {unread > 0 && <span className="bg-blue-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded-md">{unread}</span>}
      </div>
      <p className="text-[11px] text-gray-500 truncate">
        {user.username ? `@${user.username}` : 'Disponible'}
      </p>
    </div>
    <UserCheck size={16} className="text-blue-500/50" />
  </div>
);

const EmptyState = ({ icon, text, subtext }) => (
  <div className="flex flex-col items-center justify-center py-12 opacity-20 grayscale">
    {icon}
    <p className="text-xs font-black uppercase tracking-widest mt-4">{text}</p>
    {subtext && <p className="text-[10px] text-gray-600 mt-1 text-center px-4">{subtext}</p>}
  </div>
);

export default ContactSidebar;