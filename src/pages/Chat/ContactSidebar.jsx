// ============================================
// 📁 ContactSidebar.jsx - VERSION FINALE
// ============================================
import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShieldCheck, RefreshCw, Share2, UserCheck, UserPlus,
  Search, Users, MessageSquare, Send
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { API } from '../../services/apiService';
import { useToast } from '../../context/ToastContext';
import { Contacts } from '@capacitor-community/contacts';

export const ContactSidebar = ({ 
  token, 
  onContactSelect, 
  contacts = [], 
  unreadCounts = {},
  user
}) => {
  const [loading, setLoading] = useState(false);
  const [syncMatches, setSyncMatches] = useState([]);
  const [offAppContacts, setOffAppContacts] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("chats");
  const { showToast } = useToast();

  const filteredFriends = useMemo(() => {
    return contacts.filter(c => 
      c.fullName?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [contacts, searchQuery]);

  // ============================================
  // 🔐 NORMALISATION DU NUMÉRO (IDENTIQUE AU BACKEND)
  // ============================================
  const normalizePhone = (phoneNumber) => {
    // Retirer espaces, tirets, parenthèses, points
    let cleaned = phoneNumber.replace(/[\s\-\(\)\.]/g, '');
    
    // Remplacer 00 par +
    cleaned = cleaned.replace(/^00/, '+');
    
    // Si pas de +, ajouter +225 (Côte d'Ivoire)
    if (!cleaned.startsWith('+')) {
      cleaned = '+225' + cleaned.replace(/^0/, ''); // Enlever le 0 initial
    }
    
    return cleaned;
  };

  // ============================================
  // 🔥 SYNCHRONISATION CAPACITOR (avec fallback web)
  // ============================================
  const handleSyncProcess = async () => {
    setLoading(true);
    try {
      let phoneContacts = [];

      // ✅ DÉTECTION DE L'ENVIRONNEMENT
      const isWeb = typeof window !== 'undefined' && !window.Capacitor;

      if (isWeb) {
        // 🖥️ MODE WEB : Données de test avec vos vrais numéros
        console.log("🖥️ [Mode Web] Utilisation de contacts de test");
        phoneContacts = [
          { name: "ELF Test", phone: "+2250769144101" },
          { name: "Neon Test", phone: "+225010101031" },
          { name: "Anney Test", phone: "+225010101059" },
          { name: "Abate Test", phone: "+2250150329452" },
          { name: "2.0Musique Test", phone: "+2250150329453" }
        ];
        console.log(`🧪 ${phoneContacts.length} contacts de test générés (vrais numéros DB)`);
      } else {
        // 📱 MODE MOBILE : Vrais contacts Capacitor
        try {
          console.log("📱 Demande de permission contacts...");
          const permission = await Contacts.requestPermissions();
          
          if (permission.contacts !== 'granted') {
            showToast("Permission refusée pour accéder aux contacts", "error");
            setLoading(false);
            return;
          }

          console.log("✅ Permission accordée, lecture des contacts...");
          const result = await Contacts.getContacts({
            projection: {
              name: true,
              phones: true
            }
          });

          console.log(`📲 ${result.contacts?.length || 0} contacts trouvés`);

          // ✅ Extraction et normalisation
          phoneContacts = result.contacts
            .map(contact => {
              const phone = contact.phones?.[0]?.number;
              if (!phone) return null;

              const name = contact.name?.display || contact.name?.given || 'Inconnu';
              const normalized = normalizePhone(phone);

              console.log(`📞 ${name}: ${phone} → ${normalized}`);

              return {
                name,
                phone: normalized
              };
            })
            .filter(c => c !== null);

          console.log(`✅ ${phoneContacts.length} contacts valides extraits`);

          if (phoneContacts.length === 0) {
            showToast("Aucun contact avec numéro trouvé", "info");
            setLoading(false);
            return;
          }
        } catch (err) {
          console.error("❌ Erreur lecture contacts:", err);
          showToast(`Impossible de lire les contacts : ${err.message}`, "error");
          setLoading(false);
          return;
        }
      }

      console.log(`📤 Envoi de ${phoneContacts.length} contacts au backend...`);
      console.log("📋 Exemple:", phoneContacts.slice(0, 3));

      // ✅ Appel API
      const result = await API.syncContacts(token, phoneContacts);
      
      console.log(`📊 Résultat sync:`, result);

      // ✅ Mise à jour UI
      setSyncMatches(result.onChantilink || []);
      setOffAppContacts(result.notOnChantilink || []);
      
      if (result.onChantilink?.length > 0) {
        setActiveTab("suggestions");
        showToast(`✅ ${result.onChantilink.length} amis trouvés sur Chantilink !`, "success");
      } else {
        showToast("Aucun ami trouvé sur l'app", "info");
        if (result.notOnChantilink?.length > 0) {
          showToast(`${result.notOnChantilink.length} contacts à inviter`, "info");
        }
      }
    } catch (err) {
      console.error("❌ Erreur sync:", err);
      showToast(err.message || "Erreur de synchronisation", "error");
    } finally {
      setLoading(false);
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
      showToast(`Invitation ouverte pour ${contact.name}`, "success");
    } catch (err) {
      console.error("❌ Erreur invitation:", err);
      showToast("Erreur lors de l'invitation", "error");
    }
  };

  // ============================================
  // 🔗 PARTAGE GÉNÉRIQUE
  // ============================================
  const shareInvite = () => {
    const inviteText = `Rejoins-moi sur Chantilink pour discuter en toute sécurité !\n${window.location.origin}/register`;
    
    if (navigator.share) {
      navigator.share({
        title: 'Chantilink',
        text: inviteText
      });
    } else {
      window.open(
        `https://wa.me/?text=${encodeURIComponent(inviteText)}`, 
        '_blank'
      );
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
              RÉSEAU
            </span>
          </h2>
          <motion.button 
            whileTap={{ scale: 0.9 }}
            onClick={handleSyncProcess} 
            disabled={loading}
            className="p-2 hover:bg-white/5 rounded-xl transition-colors relative"
            title="Synchroniser mes contacts"
          >
            <RefreshCw size={20} className={`${loading ? 'animate-spin' : ''} text-gray-400`} />
          </motion.button>
        </div>

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
          active={activeTab === "chats"} 
          onClick={() => setActiveTab("chats")} 
          label="Messages" 
          icon={<MessageSquare size={14} />} 
        />
        <TabButton 
          active={activeTab === "suggestions"} 
          onClick={() => setActiveTab("suggestions")} 
          label="Trouvés" 
          icon={<Users size={14} />} 
          badge={syncMatches.length}
        />
        <TabButton 
          active={activeTab === "invite"} 
          onClick={() => setActiveTab("invite")} 
          label="Inviter" 
          icon={<UserPlus size={14} />} 
          badge={offAppContacts.length}
        />
      </div>

      {/* CONTENU */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <AnimatePresence mode="wait">
          {activeTab === "chats" && (
            <motion.div 
              key="chats"
              initial={{ opacity: 0, x: -10 }} 
              animate={{ opacity: 1, x: 0 }} 
              exit={{ opacity: 0, x: -10 }}
              className="divide-y divide-white/[0.02]"
            >
              {filteredFriends.length > 0 ? (
                filteredFriends.map(user => (
                  <ContactItem 
                    key={user.id} 
                    user={user} 
                    unread={unreadCounts[user.id]} 
                    onClick={() => onContactSelect(user)} 
                  />
                ))
              ) : (
                <EmptyState 
                  icon={<MessageSquare size={40} />} 
                  text="Aucune discussion active"
                  subtext="Synchronisez vos contacts pour commencer"
                />
              )}
            </motion.div>
          )}

          {activeTab === "suggestions" && (
            <motion.div 
              key="suggestions"
              initial={{ opacity: 0, x: 10 }} 
              animate={{ opacity: 1, x: 0 }} 
              exit={{ opacity: 0, x: 10 }}
              className="p-2"
            >
              <p className="text-[10px] font-black text-blue-500 uppercase px-3 mb-3 tracking-[0.2em]">
                Vos amis sur Chantilink
              </p>
              {syncMatches.length > 0 ? (
                syncMatches.map(user => (
                  <ContactItem 
                    key={user.id} 
                    user={user} 
                    isSuggestion 
                    onClick={() => onContactSelect(user)} 
                  />
                ))
              ) : (
                <EmptyState 
                  icon={<Users size={40} />} 
                  text="Aucun ami trouvé"
                  subtext="Lancez une synchronisation"
                />
              )}
            </motion.div>
          )}

          {activeTab === "invite" && (
            <motion.div 
              key="invite"
              initial={{ opacity: 0, x: 10 }} 
              animate={{ opacity: 1, x: 0 }} 
              exit={{ opacity: 0, x: 10 }}
              className="p-2"
            >
              <p className="text-[10px] font-black text-orange-500 uppercase px-3 mb-3 tracking-[0.2em]">
                À inviter sur Chantilink
              </p>
              {offAppContacts.length > 0 ? (
                offAppContacts.map((contact, idx) => (
                  <InviteContactItem 
                    key={idx}
                    contact={contact}
                    onInvite={() => handleInvite(contact)}
                  />
                ))
              ) : (
                <EmptyState 
                  icon={<UserPlus size={40} />} 
                  text="Aucun contact à inviter"
                  subtext="Tous vos contacts sont déjà sur l'app !"
                />
              )}

              <div className="mt-8 p-4 bg-blue-500/5 border border-blue-500/10 rounded-2xl text-center mx-2">
                <p className="text-xs text-gray-500 mb-4">D'autres personnes à inviter ?</p>
                <button 
                  onClick={shareInvite}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl flex items-center justify-center gap-2 text-sm font-black transition-all shadow-lg shadow-blue-900/20"
                >
                  <Share2 size={16} /> PARTAGER CHANTILINK
                </button>
              </div>
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

const ContactItem = ({ user, unread, onClick, isSuggestion }) => (
  <div 
    onClick={onClick}
    className="flex items-center gap-3 p-4 hover:bg-white/[0.03] active:bg-white/[0.05] cursor-pointer transition-all group"
  >
    <div className="relative">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg shadow-xl border border-white/5 ${isSuggestion ? 'bg-blue-600' : 'bg-gradient-to-br from-blue-600 to-indigo-700'}`}>
        {user.fullName[0].toUpperCase()}
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
        {isSuggestion ? (
          <span className="text-blue-500 font-bold uppercase tracking-tighter text-[9px]">
            ✓ Sur Chantilink
          </span>
        ) : (
          user.lastSeen ? `Vu ${new Date(user.lastSeen).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}` : 'Disponible'
        )}
      </p>
    </div>
    {isSuggestion && <UserCheck size={16} className="text-blue-500/50" />}
  </div>
);

const InviteContactItem = ({ contact, onInvite }) => (
  <div className="flex items-center gap-3 p-4 bg-white/[0.02] hover:bg-white/[0.04] rounded-xl mb-2 transition-all group">
    <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg bg-orange-600/20 border border-orange-500/30">
      {contact.name[0].toUpperCase()}
    </div>
    
    <div className="flex-1 min-w-0">
      <p className="text-sm font-bold text-gray-100 truncate">{contact.name}</p>
      <p className="text-[11px] text-gray-500 truncate">Pas encore sur l'app</p>
    </div>

    <button
      onClick={onInvite}
      className="p-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl transition-all active:scale-95"
      title="Inviter via WhatsApp"
    >
      <Send size={16} />
    </button>
  </div>
);

const EmptyState = ({ icon, text, subtext }) => (
  <div className="flex flex-col items-center justify-center py-12 opacity-20 grayscale">
    {icon}
    <p className="text-xs font-black uppercase tracking-widest mt-4">{text}</p>
    {subtext && <p className="text-[10px] text-gray-600 mt-1">{subtext}</p>}
  </div>
);