// ============================================
// src/pages/Chat/ContactSidebar.jsx - OPTIMISÉE
// ============================================
import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Heart, UserPlus, RefreshCw, Search, Send, Trash2, 
  AlertCircle, Users, Phone, CheckCircle
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

  // Dernière sync depuis localStorage
  const lastSyncDate = useMemo(() => {
    const timestamp = localStorage.getItem('lastContactSync');
    return timestamp ? new Date(parseInt(timestamp)) : null;
  }, []);

  // === FILTRE CALCULÉ (performant) ===
  const filteredContacts = useMemo(() => {
    let filtered = contacts || [];

    // Recherche
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(c => 
        (c.fullName?.toLowerCase().includes(q)) ||
        (c.phone?.includes(q))
      );
    }

    // Filtre
    if (filter === 'chantilink') {
      filtered = filtered.filter(c => c.isOnChantilink);
    } else if (filter === 'other') {
      filtered = filtered.filter(c => !c.isOnChantilink);
    }

    // Trier : unread > online > nom
    return filtered.sort((a, b) => {
      const unreadA = unreadCounts[a.id] || 0;
      const unreadB = unreadCounts[b.id] || 0;
      if (unreadA !== unreadB) return unreadB - unreadA;
      const onlineA = onlineUsers.includes(a.id);
      const onlineB = onlineUsers.includes(b.id);
      if (onlineA !== onlineB) return onlineB - onlineA ? 1 : -1;
      return (a.fullName || '').localeCompare(b.fullName || '');
    });
  }, [contacts, searchQuery, filter, unreadCounts, onlineUsers]);

  // === ACTIONS SÉCURISÉES ===
  const handleSync = async () => {
    if (!connected) return showToast("Hors ligne", "error");
    setSyncing(true);
    try {
      await onSyncContacts?.();
      showToast("Contacts synchronisés !", "success");
    } catch (err) {
      showToast("Échec synchronisation", "error");
    } finally {
      setSyncing(false);
    }
  };

  const handleInvite = async (contact) => {
    if (!connected) return showToast("Hors ligne", "error");
    try {
      await onInviteContact?.(contact);
      showToast(`Invitation envoyée à ${contact.fullName || contact.phone}`, "success");
    } catch (err) {
      showToast("Échec envoi invitation", "error");
    }
  };

  const handleDelete = async (contactId) => {
    if (!window.confirm("Supprimer ce contact ?")) return;
    try {
      await onDeleteContact?.(contactId);
      showToast("Contact supprimé", "success");
    } catch (err) {
      showToast("Échec suppression", "error");
    }
  };

  return (
    <aside className="w-80 bg-gray-800/50 border-r border-gray-700 flex flex-col overflow-hidden">
      {/* === HEADER === */}
      <div className="p-4 border-b border-gray-700 flex-shrink-0 space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-white">Messages</h2>
          <div className="flex gap-2">
            {/* Demandes */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onShowPending}
              className="relative px-3 py-1.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs rounded-lg flex items-center gap-1 font-medium"
            >
              <Heart className="w-4 h-4" />
              Demandes
              <AnimatePresence>
                {pendingCount > 0 && (
                  <motion.span
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 font-bold"
                  >
                    {pendingCount > 99 ? '99+' : pendingCount}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>

            {/* Ajouter */}
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={onAddContact}
              className="p-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg"
              title="Ajouter un contact"
            >
              <UserPlus className="w-4 h-4" />
            </motion.button>

            {/* Sync */}
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleSync}
              disabled={!connected || syncing}
              className={`p-2 bg-gradient-to-r from-orange-500 to-pink-500 text-white rounded-lg disabled:opacity-50 ${syncing ? 'animate-pulse' : ''}`}
              title="Synchroniser les contacts"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            </motion.button>
          </div>
        </div>

        {/* === STATS === */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-2 text-center">
            <p className="text-blue-300 text-[10px]">Total</p>
            <p className="text-white font-bold text-lg">{stats?.total ?? 0}</p>
          </div>
          <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-2 text-center">
            <p className="text-green-300 text-[10px]">Sur App</p>
            <p className="text-white font-bold text-lg">{stats?.onChantilink ?? 0}</p>
          </div>
          <div className="bg-orange-500/20 border border-orange-500/30 rounded-lg p-2 text-center">
            <p className="text-orange-300 text-[10px]">Autres</p>
            <p className="text-white font-bold text-lg">{stats?.other ?? 0}</p>
          </div>
        </div>

        {/* === FILTRES === */}
        <div className="flex gap-1">
          {[
            { value: 'all', label: 'Tous', icon: Users },
            { value: 'chantilink', label: 'App', icon: CheckCircle },
            { value: 'other', label: 'Autres', icon: Phone }
          ].map(f => (
            <motion.button
              key={f.value}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onFilterChange?.(f.value)}
              className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs rounded-lg font-medium transition-all ${
                filter === f.value
                  ? 'bg-gradient-to-r from-orange-500 to-pink-500 text-white shadow-lg'
                  : 'bg-gray-700/50 text-gray-300 hover:bg-gray-700'
              }`}
            >
              <f.icon className="w-3.5 h-3.5" />
              {f.label}
            </motion.button>
          ))}
        </div>

        {/* === STATUT CONNEXION === */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1">
            {connected ? (
              <>
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-green-400">En ligne</span>
              </>
            ) : reconnecting ? (
              <>
                <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                <span className="text-yellow-400">Reconnexion...</span>
              </>
            ) : (
              <>
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-red-400">Hors ligne</span>
              </>
            )}
          </div>
          {error && (
            <div className="flex items-center gap-1 text-red-400">
              <AlertCircle className="w-3 h-3" />
              <span className="text-[10px]">{error}</span>
            </div>
          )}
        </div>

        {/* === INFO DERNIÈRE SYNC === */}
        {lastSyncDate && (
          <div className="text-[10px] text-gray-500 text-center">
            Dernière sync : {formatDistanceToNow(lastSyncDate, { 
              addSuffix: true, 
              locale: fr 
            })}
          </div>
        )}

        {/* === RECHERCHE === */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange?.(e.target.value)}
            placeholder="Rechercher un contact..."
            className="w-full pl-10 pr-3 py-2 bg-gray-700/50 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 placeholder-gray-500"
          />
        </div>
      </div>

      {/* === LISTE DES CONTACTS === */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-orange-500">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-orange-500" />
          </div>
        ) : filteredContacts.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Users className="w-12 h-12 mx-auto mb-3 text-gray-600" />
            <p className="text-sm">Aucun contact</p>
            <p className="text-xs mt-1">Synchronisez ou ajoutez manuellement</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-700">
            {filteredContacts.map(contact => {
              const unread = unreadCounts[contact.id] || 0;
              const isOnline = onlineUsers.includes(contact.id);

              return (
                <motion.div
                  key={contact.id}
                  whileHover={{ backgroundColor: 'rgba(55, 65, 81, 0.5)' }}
                  onClick={() => onContactSelect?.(contact)}
                  className="p-3 cursor-pointer group transition-all"
                >
                  <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center text-white font-bold text-lg">
                        {(contact.fullName?.[0] || contact.phone?.[0] || '?').toUpperCase()}
                      </div>
                      {isOnline && (
                        <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-gray-800" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-white font-semibold truncate text-sm">
                          {contact.fullName || contact.contactName || "Inconnu"}
                        </p>
                        {!contact.isOnChantilink && (
                          <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 text-[10px] rounded border border-blue-500/30">
                            Inviter
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 truncate">
                        {unread > 0 
                          ? `${unread} nouveau${unread > 1 ? 'x' : ''} message${unread > 1 ? 's' : ''}` 
                          : contact.isOnChantilink ? "En ligne" : "Hors app"}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {unread > 0 && (
                        <div className="w-6 h-6 bg-gradient-to-r from-orange-500 to-pink-500 text-white text-xs rounded-full flex items-center justify-center font-bold shadow-lg">
                          {unread > 99 ? '99+' : unread}
                        </div>
                      )}
                      {!contact.isOnChantilink && (
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={(e) => { e.stopPropagation(); handleInvite(contact); }}
                          className="p-1.5 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30"
                          title="Inviter sur l'app"
                        >
                          <Send className="w-3.5 h-3.5" />
                        </motion.button>
                      )}
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => { e.stopPropagation(); handleDelete(contact.id); }}
                        className="p-1.5 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30"
                        title="Supprimer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}, (prevProps, nextProps) => {
  // Custom comparison pour éviter re-renders inutiles
  return (
    prevProps.searchQuery === nextProps.searchQuery &&
    prevProps.filter === nextProps.filter &&
    prevProps.contacts.length === nextProps.contacts.length &&
    JSON.stringify(prevProps.unreadCounts) === JSON.stringify(nextProps.unreadCounts) &&
    prevProps.onlineUsers.length === nextProps.onlineUsers.length &&
    prevProps.pendingCount === nextProps.pendingCount &&
    prevProps.connected === nextProps.connected &&
    prevProps.loading === nextProps.loading
  );
});