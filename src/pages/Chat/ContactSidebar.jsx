// ============================================
// 📁 ContactSidebar.jsx - VERSION FINALE
// 100% données serveur - Aucun contact fictif
// ============================================
import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShieldCheck, RefreshCw, UserCheck, UserPlus,
  Search, Users, MessageSquare, Send, Smartphone
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '../../context/ToastContext';
import { Capacitor } from '@capacitor/core';
import nativeContactsService from '../../services/nativeContactsService';

// ============================================
// API SERVICE
// ============================================
const getAPIService = () => {
  const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
  
  const fetchWithAuth = async (url, options = {}) => {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      console.error('❌ Réponse non-JSON:', text.substring(0, 200));
      throw new Error(`Erreur serveur (${response.status}): Réponse invalide`);
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || `Erreur ${response.status}`);
    }

    return data;
  };

  return {
    syncContacts: async (token, contacts) => {
      return fetchWithAuth(`${BASE_URL}/contacts/sync`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ contacts }),
      });
    }
  };
};

const API = getAPIService();

export const ContactSidebar = ({ 
  token, 
  onContactSelect, 
  contacts = [], 
  unreadCounts = {},
  user,
  onSyncComplete
}) => {
  const [loading, setLoading] = useState(false);
  const [allPhoneContacts, setAllPhoneContacts] = useState([]); // TOUS les contacts du téléphone
  const [onAppContacts, setOnAppContacts] = useState([]); // Contacts sur Chantilink
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("phone");
  const [syncProgress, setSyncProgress] = useState(0);
  const [isNativeSync, setIsNativeSync] = useState(false);
  const { showToast } = useToast();

  // ============================================
  // 🔍 FILTRAGE DES CONTACTS
  // ============================================
  const filteredPhoneContacts = useMemo(() => {
    return allPhoneContacts.filter(c => 
      c.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [allPhoneContacts, searchQuery]);

  const filteredOnAppContacts = useMemo(() => {
    return onAppContacts.filter(c => 
      c.fullName?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [onAppContacts, searchQuery]);

  // ============================================
  // 🔍 DÉTECTION ENVIRONNEMENT
  // ============================================
  useEffect(() => {
    const isNative = Capacitor.isNativePlatform();
    setIsNativeSync(isNative);
    
    console.log(`📱 [ContactSidebar] Environnement: ${isNative ? 'NATIF (iOS/Android)' : 'WEB'}`);
    
    // ✅ Si mode WEB, nettoyer les contacts de test du cache
    if (!isNative) {
      const savedContacts = localStorage.getItem('allPhoneContacts');
      if (savedContacts) {
        console.log('🧹 [ContactSidebar] Nettoyage des contacts web du cache');
        localStorage.removeItem('allPhoneContacts');
        localStorage.removeItem('onAppContacts');
        setAllPhoneContacts([]);
        setOnAppContacts([]);
      }
    }
  }, []);

  // ============================================
  // 💾 RESTAURATION DES CONTACTS
  // ============================================
  useEffect(() => {
    const savedPhoneContacts = localStorage.getItem('allPhoneContacts');
    const savedOnAppContacts = localStorage.getItem('onAppContacts');
    
    if (savedPhoneContacts) {
      try {
        setAllPhoneContacts(JSON.parse(savedPhoneContacts));
      } catch (e) {
        console.error('Erreur chargement contacts téléphone:', e);
      }
    }
    
    if (savedOnAppContacts) {
      try {
        setOnAppContacts(JSON.parse(savedOnAppContacts));
      } catch (e) {
        console.error('Erreur chargement contacts app:', e);
      }
    }
  }, []);

  // ============================================
  // 🔥 SYNCHRONISATION NATIVE (avec fallback gracieux)
  // ============================================
  const handleSyncProcess = async () => {
    setLoading(true);
    setSyncProgress(0);
    
    try {
      console.log("📱 [ContactSidebar] Démarrage synchronisation...");
      console.log("📱 [ContactSidebar] isNativeSync:", isNativeSync);
      console.log("📱 [ContactSidebar] Capacitor.isNativePlatform():", Capacitor.isNativePlatform());
      
      showToast("📱 Synchronisation en cours...", "info");
      
      // ✅ Synchroniser avec le backend (fonctionne en natif ET web)
      const result = await nativeContactsService.syncWithBackend(
        token,
        (progress) => {
          setSyncProgress(progress);
          console.log(`📊 Progression: ${progress}%`);
        }
      );

      if (!result.success) {
        throw new Error(result.errors?.[0] || 'Échec de la synchronisation');
      }

      console.log(`✅ [ContactSidebar] Sync réussie:`, result.stats);

      // ✅ Extraire UNIQUEMENT les données du serveur
      const onChantilink = result.onChantilink || [];
      const notOnChantilink = result.notOnChantilink || [];
      
      // Construire la liste complète des contacts téléphone
      const allContacts = [];
      
      // Ajouter les contacts sur l'app
      onChantilink.forEach(contact => {
        allContacts.push({
          name: contact.fullName,
          phone: contact.phone,
          isOnApp: true,
          appData: contact
        });
      });
      
      // Ajouter les contacts hors app
      notOnChantilink.forEach(contact => {
        allContacts.push({
          name: contact.name,
          phone: contact.phone,
          isOnApp: false
        });
      });

      console.log(`✅ Traitement: ${allContacts.length} contacts téléphone, ${onChantilink.length} sur app`);

      // ✅ Mise à jour UI + Sauvegarde
      setAllPhoneContacts(allContacts);
      setOnAppContacts(onChantilink);
      
      localStorage.setItem('allPhoneContacts', JSON.stringify(allContacts));
      localStorage.setItem('onAppContacts', JSON.stringify(onChantilink));
      
      if (onChantilink.length > 0) {
        setActiveTab("onapp");
        showToast(
          `✅ ${onChantilink.length} ami${onChantilink.length > 1 ? 's' : ''} trouvé${onChantilink.length > 1 ? 's' : ''} sur Chantilink !`, 
          "success"
        );
        
        if (onSyncComplete) {
          onSyncComplete(onChantilink);
        }
      } else if (allContacts.length > 0) {
        showToast(`📱 ${allContacts.length} contact${allContacts.length > 1 ? 's' : ''} synchronisé${allContacts.length > 1 ? 's' : ''}`, "info");
        setActiveTab("phone");
      } else {
        showToast("Aucun contact trouvé", "info");
      }

    } catch (err) {
      console.error("❌ Erreur sync:", err);
      
      if (err.message?.includes('Permission')) {
        showToast("Permission refusée. Activez l'accès aux contacts dans les paramètres de votre téléphone.", "error");
      } else if (err.message?.includes('not available')) {
        showToast("Fonctionnalité non disponible sur cet appareil", "warning");
      } else {
        showToast(err.message || "Erreur de synchronisation", "error");
      }
    } finally {
      setLoading(false);
      setSyncProgress(0);
    }
  };

  // ============================================
  // 📲 INVITER UN CONTACT
  // ============================================
  const handleInvite = async (contact) => {
    try {
      const inviteText = `Salut ! Rejoins-moi sur Chantilink pour discuter en toute sécurité 🔒\n\n${window.location.origin}/register`;
      const phoneDigits = contact.phone.replace(/\D/g, '');
      const whatsappUrl = `https://wa.me/${phoneDigits}?text=${encodeURIComponent(inviteText)}`;
      
      window.open(whatsappUrl, '_blank');
      showToast(`Invitation envoyée à ${contact.name}`, "success");
    } catch (err) {
      console.error("❌ Erreur invitation:", err);
      showToast("Erreur lors de l'invitation", "error");
    }
  };

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
            {/* Indicateur de mode */}
            {isNativeSync && (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-green-500/10 text-green-500">
                <Smartphone size={14} />
                <span className="text-[9px] font-black uppercase tracking-wider">
                  NATIF
                </span>
              </div>
            )}

            {/* Bouton sync - TOUJOURS ACTIF */}
            <motion.button 
              whileTap={{ scale: 0.9 }}
              onClick={handleSyncProcess} 
              disabled={loading}
              className="p-2 hover:bg-white/5 rounded-xl transition-colors relative"
              title="Synchroniser depuis la puce téléphonique"
            >
              <RefreshCw size={20} className={`${loading ? 'animate-spin' : ''} text-gray-400`} />
              {loading && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full animate-pulse" />
              )}
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
            <p className="text-xs text-gray-500 text-center mt-1">
              {syncProgress}% 📱 Lecture de la puce téléphonique...
            </p>
          </div>
        )}

        {/* BARRE DE RECHERCHE */}
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-500 transition-colors" size={16} />
          <input 
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher..."
            className="w-full bg-[#0b0d10] border border-white/5 rounded-xl py-2.5 pl-10 pr-4 text-sm outline-none focus:border-blue-500/50 transition-all"
          />
        </div>
      </div>

      {/* TABS */}
      <div className="flex p-2 gap-2 bg-[#12151a]/30">
        <TabButton 
          active={activeTab === "phone"} 
          onClick={() => setActiveTab("phone")} 
          label="Téléphone" 
          icon={<Smartphone size={14} />} 
          badge={allPhoneContacts.length}
        />
        <TabButton 
          active={activeTab === "onapp"} 
          onClick={() => setActiveTab("onapp")} 
          label="Sur l'app" 
          icon={<Users size={14} />} 
          badge={onAppContacts.length}
        />
      </div>

      {/* CONTENU */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <AnimatePresence mode="wait">
          
          {/* TAB 1: CONTACTS TÉLÉPHONE */}
          {activeTab === "phone" && (
            <motion.div 
              key="phone"
              initial={{ opacity: 0, x: -10 }} 
              animate={{ opacity: 1, x: 0 }} 
              exit={{ opacity: 0, x: -10 }}
              className="p-2"
            >
              <p className="text-[10px] font-black text-gray-500 uppercase px-3 mb-3 tracking-[0.2em] flex items-center gap-2">
                <Smartphone size={12} />
                Tous vos contacts ({allPhoneContacts.length})
              </p>
              
              {filteredPhoneContacts.length > 0 ? (
                filteredPhoneContacts.map((contact, idx) => (
                  <PhoneContactItem 
                    key={idx}
                    contact={contact}
                    onInvite={() => handleInvite(contact)}
                    onSelect={() => {
                      if (contact.isOnApp && contact.appData) {
                        onContactSelect(contact.appData);
                      }
                    }}
                  />
                ))
              ) : (
                <EmptyState 
                  icon={<Smartphone size={40} />} 
                  text={isNativeSync ? "Aucun contact synchronisé" : "Synchronisation mobile uniquement"}
                  subtext={isNativeSync 
                    ? "Appuyez sur Synchroniser pour importer vos contacts" 
                    : "Ouvrez l'app sur iOS ou Android"
                  }
                />
              )}
            </motion.div>
          )}

          {/* TAB 2: CONTACTS SUR L'APP */}
          {activeTab === "onapp" && (
            <motion.div 
              key="onapp"
              initial={{ opacity: 0, x: 10 }} 
              animate={{ opacity: 1, x: 0 }} 
              exit={{ opacity: 0, x: 10 }}
              className="p-2"
            >
              <p className="text-[10px] font-black text-blue-500 uppercase px-3 mb-3 tracking-[0.2em] flex items-center gap-2">
                <Users size={12} />
                Disponibles sur Chantilink ({onAppContacts.length})
              </p>
              
              {filteredOnAppContacts.length > 0 ? (
                filteredOnAppContacts.map(user => (
                  <ContactItem 
                    key={user.id} 
                    user={user} 
                    unread={unreadCounts[user.id]}
                    onClick={() => onContactSelect(user)} 
                  />
                ))
              ) : (
                <EmptyState 
                  icon={<Users size={40} />} 
                  text="Aucun ami sur l'app"
                  subtext="Synchronisez vos contacts pour trouver vos amis"
                />
              )}
            </motion.div>
          )}
          
        </AnimatePresence>
      </div>
    </div>
  );
};

// ============================================
// SOUS-COMPOSANTS
// ============================================

const TabButton = ({ active, onClick, label, icon, badge }) => (
  <button 
    onClick={onClick}
    className={`
      flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all
      ${active ? 'bg-white/5 text-white shadow-inner' : 'text-gray-500 hover:text-gray-300'}
    `}
  >
    {icon}
    {label}
    {badge > 0 && (
      <span className="bg-blue-600 text-white text-[9px] px-1.5 py-0.5 rounded-full">
        {badge}
      </span>
    )}
  </button>
);

// Contact du téléphone
const PhoneContactItem = ({ contact, onInvite, onSelect }) => (
  <div className="flex items-center gap-3 p-4 bg-white/[0.02] hover:bg-white/[0.04] rounded-xl mb-2 transition-all group">
    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg ${
      contact.isOnApp 
        ? 'bg-blue-600 border border-blue-500/30' 
        : 'bg-gray-700/50 border border-gray-600/30'
    }`}>
      {contact.name[0]?.toUpperCase() || '?'}
    </div>
    
    <div className="flex-1 min-w-0">
      <p className="text-sm font-bold text-gray-100 truncate">{contact.name}</p>
      <div className="flex items-center gap-2 mt-0.5">
        {contact.isOnApp ? (
          <span className="text-[9px] text-blue-500 font-black uppercase tracking-wider flex items-center gap-1">
            <UserCheck size={10} /> Sur Chantilink
          </span>
        ) : (
          <span className="text-[9px] text-gray-600 font-bold uppercase tracking-wider">
            Pas encore sur l'app
          </span>
        )}
      </div>
    </div>

    {contact.isOnApp ? (
      <button
        onClick={onSelect}
        className="p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all active:scale-95"
        title="Envoyer un message"
      >
        <MessageSquare size={16} />
      </button>
    ) : (
      <button
        onClick={onInvite}
        className="p-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl transition-all active:scale-95"
        title="Inviter sur Chantilink"
      >
        <Send size={16} />
      </button>
    )}
  </div>
);

// Contact sur l'application
const ContactItem = ({ user, unread, onClick }) => {
  const handleClick = () => {
    const contact = {
      id: user.id || user._id,
      fullName: user.fullName,
      username: user.username,
      profilePhoto: user.profilePhoto,
      isOnline: user.isOnline,
      lastSeen: user.lastSeen,
      isOnChantilink: true
    };
    onClick(contact);
  };

  return (
    <div 
      onClick={handleClick}
      className="flex items-center gap-3 p-4 hover:bg-white/[0.03] active:bg-white/[0.05] cursor-pointer transition-all group"
    >
      <div className="relative">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg shadow-xl border border-white/5 bg-gradient-to-br from-blue-600 to-indigo-700">
          {user.fullName?.[0]?.toUpperCase() || '?'}
        </div>
        {user.isOnline && (
          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-[3px] border-[#0b0d10]" />
        )}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-baseline">
          <p className="text-sm font-bold text-gray-100 truncate group-hover:text-white transition-colors">
            {user.fullName}
          </p>
          {unread > 0 && (
            <span className="bg-blue-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded-md">
              {unread}
            </span>
          )}
        </div>
        <p className="text-[11px] text-gray-500 truncate flex items-center gap-1">
          {user.lastSeen 
            ? `Vu ${new Date(user.lastSeen).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}` 
            : 'Disponible'
          }
        </p>
      </div>
      <UserCheck size={16} className="text-blue-500/50" />
    </div>
  );
};

const EmptyState = ({ icon, text, subtext }) => (
  <div className="flex flex-col items-center justify-center py-12 opacity-20 grayscale">
    {icon}
    <p className="text-xs font-black uppercase tracking-widest mt-4">{text}</p>
    {subtext && <p className="text-[10px] text-gray-600 mt-1 text-center px-4">{subtext}</p>}
  </div>
);

export default ContactSidebar;