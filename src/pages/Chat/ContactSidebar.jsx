// ============================================
// src/pages/Chat/ContactSidebar.jsx - MOBILE OPTIMIZED
// ============================================
import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Heart, UserPlus, RefreshCw, Search, Send, Trash2, 
  AlertCircle, Users, Phone, CheckCircle, ShieldCheck
} from 'lucide-react';
import { useToast } from "../../context/ToastContext";
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

export const ContactSidebar = React.memo(({
  contacts = [],
  stats = { total: 0, onChantilink: 0, other: 0 },
  searchQuery = "",
  onSearchChange,
  filter = 'all',
  onFilterChange,
  onContactSelect,
  onAddContact,
  onSyncContacts,
  onDeleteContact,
  onInviteContact,
  onShowPending,
  unreadCounts = {},
  onlineUsers = [],
  pendingCount = 0,
  connected = true,
  reconnecting = false,
  error = null,
  loading = false
}) => {
  const { showToast } = useToast();
  const [syncing, setSyncing] = useState(false);

  const lastSyncDate = useMemo(() => {
    const timestamp = localStorage.getItem('lastContactSync');
    return timestamp ? new Date(parseInt(timestamp)) : null;
  }, []);

  const filteredContacts = useMemo(() => {
    let filtered = contacts || [];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(c => 
        (c.fullName?.toLowerCase().includes(q)) || (c.phone?.includes(q))
      );
    }
    if (filter === 'chantilink') filtered = filtered.filter(c => c.isOnChantilink);
    else if (filter === 'other') filtered = filtered.filter(c => !c.isOnChantilink);

    return filtered.sort((a, b) => {
      const unreadA = unreadCounts[a.id] || 0;
      const unreadB = unreadCounts[b.id] || 0;
      if (unreadA !== unreadB) return unreadB - unreadA;
      const onlineA = onlineUsers.includes(a.id);
      const onlineB = onlineUsers.includes(b.id);
      if (onlineA !== onlineB) return onlineB ? 1 : -1;
      return (a.fullName || '').localeCompare(b.fullName || '');
    });
  }, [contacts, searchQuery, filter, unreadCounts, onlineUsers]);

  const handleSync = async () => {
    if (!connected) return showToast("Vérifiez votre connexion", "error");
    setSyncing(true);
    try {
      await onSyncContacts?.();
      showToast("Contacts synchronisés", "success");
    } catch (err) {
      showToast("Échec sync", "error");
    } finally { setSyncing(false); }
  };

  return (
    <aside className="w-full md:w-96 bg-[#16191f] border-r border-white/5 flex flex-col h-full overflow-hidden">
      
      {/* --- HEADER COMPACT --- */}
      <div className="p-4 space-y-4 bg-[#1c2026]/50">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <ShieldCheck size={20} className="text-blue-500" />
            <h2 className="text-xl font-black text-white tracking-tight">Contacts</h2>
          </div>
          
          <div className="flex gap-2">
             {/* Bouton Demandes avec Badge */}
             <button onClick={onShowPending} className="relative p-2 bg-purple-500/10 text-purple-400 rounded-xl active:scale-90 transition-transform">
               <Heart size={20} />
               {pendingCount > 0 && (
                 <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center font-bold border-2 border-[#16191f]">
                   {pendingCount > 9 ? '9+' : pendingCount}
                 </span>
               )}
             </button>
             
             {/* Bouton Ajouter */}
             <button onClick={onAddContact} className="p-2 bg-blue-500/10 text-blue-400 rounded-xl active:scale-90 transition-transform">
               <UserPlus size={20} />
             </button>

             {/* Bouton Sync */}
             <button onClick={handleSync} disabled={syncing} className={`p-2 bg-orange-500/10 text-orange-400 rounded-xl active:scale-90 transition-transform ${syncing ? 'animate-spin' : ''}`}>
               <RefreshCw size={20} />
             </button>
          </div>
        </div>

        {/* --- RECHERCHE --- */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange?.(e.target.value)}
            placeholder="Rechercher un collègue..."
            className="w-full pl-10 pr-4 py-3 bg-[#0f1115] text-white rounded-2xl text-sm border border-white/5 focus:border-blue-500 outline-none transition-all placeholder:text-gray-600"
          />
        </div>

        {/* --- STATS & FILTRES RAPIDES --- */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar pb-1">
          <FilterTab active={filter === 'all'} onClick={() => onFilterChange?.('all')} label="Tous" count={stats.total} color="blue" />
          <FilterTab active={filter === 'chantilink'} onClick={() => onFilterChange?.('chantilink')} label="Sécurisés" count={stats.onChantilink} color="green" />
          <FilterTab active={filter === 'other'} onClick={() => onFilterChange?.('other')} label="Inconnus" count={stats.other} color="orange" />
        </div>
      </div>

      {/* --- LISTE DES CONTACTS --- */}
      <div className="flex-1 overflow-y-auto bg-[#0f1115]/30">
        {loading ? (
          <div className="flex justify-center py-10"><RefreshCw className="animate-spin text-blue-500" /></div>
        ) : filteredContacts.length === 0 ? (
          <div className="p-12 text-center">
            <Users size={40} className="mx-auto mb-4 text-gray-700 opacity-20" />
            <p className="text-gray-500 text-sm">Aucun contact trouvé</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {filteredContacts.map(contact => (
              <ContactItem
                key={contact.id}
                contact={contact}
                unread={unreadCounts[contact.id] || 0}
                isOnline={onlineUsers.includes(contact.id)}
                onSelect={() => onContactSelect?.(contact)}
                onInvite={() => onInviteContact?.(contact)}
                onDelete={() => onDeleteContact?.(contact.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* --- FOOTER STATUS --- */}
      <div className="p-3 bg-[#16191f] border-t border-white/5 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest px-6">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          <span className={connected ? 'text-green-500' : 'text-red-500'}>
            {connected ? 'Serveur Sécurisé' : 'Déconnecté'}
          </span>
        </div>
        {lastSyncDate && (
          <span className="text-gray-600">Sync: {formatDistanceToNow(lastSyncDate, { locale: fr, addSuffix: true })}</span>
        )}
      </div>
    </aside>
  );
});

// --- COMPOSANTS INTERNES ---

const FilterTab = ({ active, onClick, label, count, color }) => {
  const colors = {
    blue: active ? 'bg-blue-500 text-white' : 'bg-blue-500/5 text-blue-500',
    green: active ? 'bg-green-500 text-white' : 'bg-green-500/5 text-green-500',
    orange: active ? 'bg-orange-500 text-white' : 'bg-orange-500/5 text-orange-500',
  };
  return (
    <button onClick={onClick} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-black transition-all whitespace-nowrap ${colors[color]} border border-white/5`}>
      {label} <span className={`px-1.5 rounded-md ${active ? 'bg-white/20' : 'bg-current/10'}`}>{count || 0}</span>
    </button>
  );
};

const ContactItem = ({ contact, unread, isOnline, onSelect, onInvite, onDelete }) => (
  <div onClick={onSelect} className="group flex items-center gap-4 p-4 hover:bg-white/5 active:bg-white/10 transition-colors cursor-pointer relative">
    {/* Avatar avec Statut */}
    <div className="relative flex-shrink-0">
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-lg border-2 ${contact.isOnChantilink ? 'border-blue-500/20 bg-gradient-to-br from-blue-600 to-indigo-600' : 'border-gray-500/20 bg-gray-700'}`}>
        {(contact.fullName?.[0] || contact.phone?.[0] || '?').toUpperCase()}
      </div>
      {isOnline && (
        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-4 border-[#0f1115]" />
      )}
    </div>

    {/* Infos */}
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <h4 className="text-sm font-bold text-white truncate">{contact.fullName || contact.contactName}</h4>
        {contact.isOnChantilink && <CheckCircle size={12} className="text-blue-500 flex-none" />}
      </div>
      <p className="text-xs text-gray-500 truncate mt-0.5">
        {unread > 0 ? `${unread} nouveaux messages` : contact.isOnChantilink ? 'Canal sécurisé' : 'Cliquer pour inviter'}
      </p>
    </div>

    {/* Badge ou Action */}
    <div className="flex flex-col items-end gap-2">
      {unread > 0 ? (
        <span className="bg-blue-600 text-white text-[10px] font-black px-2 py-1 rounded-lg shadow-lg shadow-blue-900/40">
          {unread}
        </span>
      ) : !contact.isOnChantilink && (
        <button onClick={(e) => { e.stopPropagation(); onInvite(); }} className="p-2 bg-blue-500/10 text-blue-500 rounded-lg">
          <Send size={14} />
        </button>
      )}
    </div>
  </div>
);