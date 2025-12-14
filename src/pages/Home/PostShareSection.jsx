// src/pages/Home/PostShareSection.jsx
import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShareIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
  LinkIcon,
  CheckIcon
} from "@heroicons/react/24/outline";

// Importations sécurisées pour les icônes sociales
import { FaWhatsapp, FaFacebookMessenger, FaTelegram, FaTwitter, FaCheckCircle, FaCrown } from "react-icons/fa";

import SimpleAvatar from "./SimpleAvatar";
import { useAuth } from "../../context/AuthContext"; // Import direct du contexte
import { useDarkMode } from "../../context/DarkModeContext";

const PostShareSection = ({
  postId,
  // On garde les props pour la flexibilité, mais on utilise le contexte en fallback
  currentUser: propUser,
  getToken: propGetToken,
  showToast,
  onClose,
  onShareSuccess
}) => {
  const { user: contextUser, getToken: contextGetToken } = useAuth();
  const { isDarkMode } = useDarkMode();

  // Priorité aux props, sinon contexte
  const currentUser = propUser || contextUser;
  const getToken = propGetToken || contextGetToken;

  const [shareTab, setShareTab] = useState("contacts");
  const [searchQuery, setSearchQuery] = useState("");
  const [allUsers, setAllUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [shareMessage, setShareMessage] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingShare, setLoadingShare] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const base = import.meta.env.VITE_API_URL || "http://localhost:5000";
  const postLink = `${window.location.origin}/post/${postId}`;

  // Charger les amis et abonnés
  const loadUsers = async () => {
    if (!currentUser) return;
    setLoadingUsers(true);
    try {
      const token = await getToken();
      if (!token) throw new Error("Non authentifié");

      // On utilise Promise.allSettled pour ne pas bloquer si une requête échoue
      const results = await Promise.allSettled([
        fetch(`${base}/api/users/friends`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${base}/api/users/following`, { headers: { Authorization: `Bearer ${token}` } })
      ]);

      let friends = [];
      let following = [];

      if (results[0].status === 'fulfilled' && results[0].value.ok) {
        const data = await results[0].value.json();
        friends = Array.isArray(data) ? data : data.data || [];
      }

      if (results[1].status === 'fulfilled' && results[1].value.ok) {
        const data = await results[1].value.json();
        following = Array.isArray(data) ? data : data.data || [];
      }

      const combined = [...friends, ...following];
      // Dédoublonnage robuste par ID
      const uniqueUsers = Array.from(new Map(combined.map(u => [u._id, u])).values());

      setAllUsers(uniqueUsers);
    } catch (err) {
      console.error("❌ Erreur chargement contacts:", err);
      showToast?.("Erreur chargement de vos contacts", "error");
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (shareTab === 'contacts' && allUsers.length === 0) {
      loadUsers();
    }
  }, [shareTab]); // On charge uniquement si l'onglet contact est actif

  const handleShareToContacts = async () => {
    if (!currentUser) return showToast?.("Connectez-vous pour partager", "error");
    if (selectedUsers.length === 0) return showToast?.("Sélectionnez au moins une personne", "error");

    setLoadingShare(true);

    try {
      const token = await getToken();
      if (!token) throw new Error("Non authentifié");

      const res = await fetch(`${base}/api/posts/${postId}/share`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ 
          recipients: selectedUsers.map(u => u._id),
          message: shareMessage || ""
        })
      });

      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      
      const updated = await res.json();
      onShareSuccess?.(updated.data?.shares?.length || 0);
      
      showToast?.(`✅ Post partagé avec ${selectedUsers.length} personne${selectedUsers.length > 1 ? 's' : ''}`, "success");
      
      onClose?.();
      setSelectedUsers([]);
      setShareMessage("");
      setSearchQuery("");
    } catch (err) {
      console.error("❌ Erreur partage:", err);
      showToast?.("Erreur lors du partage", "error");
    } finally {
      setLoadingShare(false);
    }
  };

  const toggleUserSelection = (user) => {
    setSelectedUsers(prev => {
      const isSelected = prev.some(u => u._id === user._id);
      if (isSelected) {
        return prev.filter(u => u._id !== user._id);
      } else {
        return [...prev, user];
      }
    });
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(postLink);
      setLinkCopied(true);
      showToast?.("✅ Lien copié !", "success");
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (err) {
      console.error("❌ Erreur copie:", err);
      showToast?.("Erreur lors de la copie", "error");
    }
  };

  // Helpers pour partage social
  const openSocialShare = (url) => window.open(url, '_blank', 'noopener,noreferrer');

  const shareToWhatsApp = () => {
    const text = `Découvrez ce post sur ChantiLink !\n\n${postLink}`;
    openSocialShare(`https://wa.me/?text=${encodeURIComponent(text)}`);
  };

  const shareToMessenger = () => {
    // Note: Facebook Messenger link sharing is often restricted on desktop web
    openSocialShare(`https://www.facebook.com/dialog/send?link=${encodeURIComponent(postLink)}&app_id=YOUR_APP_ID&redirect_uri=${encodeURIComponent(postLink)}`);
  };

  const shareToTelegram = () => {
    const text = 'Découvrez ce post sur ChantiLink';
    openSocialShare(`https://t.me/share/url?url=${encodeURIComponent(postLink)}&text=${encodeURIComponent(text)}`);
  };

  const shareToTwitter = () => {
    const text = 'Découvrez ce post incroyable sur ChantiLink !';
    openSocialShare(`https://twitter.com/intent/tweet?url=${encodeURIComponent(postLink)}&text=${encodeURIComponent(text)}`);
  };

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return allUsers;
    const query = searchQuery.toLowerCase();
    return allUsers.filter(user => 
      (user.fullName || "").toLowerCase().includes(query) ||
      (user.username || "").toLowerCase().includes(query)
    );
  }, [allUsers, searchQuery]);

  return (
    <motion.div 
      initial={{ opacity: 0, height: 0 }} 
      animate={{ opacity: 1, height: "auto" }} 
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={`mt-2 rounded-2xl overflow-hidden shadow-lg border ${
        isDarkMode 
          ? 'bg-gray-800 border-gray-700' 
          : 'bg-white border-orange-100'
      }`}
    >
      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-3 border-b ${
        isDarkMode 
          ? 'border-gray-700 bg-gray-800' 
          : 'border-orange-100 bg-orange-50/50'
      }`}>
        <div className="flex items-center gap-2">
          <div className="p-2 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl shadow-sm">
            <ShareIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className={`font-bold text-sm ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`}>
              Partager ce post
            </h3>
            <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Choisissez une option
            </p>
          </div>
        </div>
        
        {onClose && (
            <button
            onClick={() => {
                onClose();
                setSelectedUsers([]);
                setShareMessage("");
                setSearchQuery("");
                setShareTab("contacts");
            }}
            className={`p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors`}
            >
            <XMarkIcon className={`w-5 h-5 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
            </button>
        )}
      </div>

      {/* Tabs */}
      <div className={`flex gap-1 px-2 pt-2 border-b ${
        isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'
      }`}>
        {[
            { id: "contacts", label: "👥 Contacts" },
            { id: "social", label: "🌐 Réseaux" },
            { id: "link", label: "🔗 Lien" }
        ].map(tab => (
            <button
                key={tab.id}
                onClick={() => setShareTab(tab.id)}
                className={`flex-1 py-2.5 rounded-t-lg font-medium text-xs sm:text-sm transition-all relative ${
                    shareTab === tab.id
                    ? isDarkMode
                        ? "text-orange-400 bg-gray-700/50"
                        : "text-orange-600 bg-orange-50"
                    : isDarkMode
                        ? "text-gray-400 hover:text-gray-200"
                        : "text-gray-500 hover:text-gray-700"
                }`}
            >
                {tab.label}
                {shareTab === tab.id && (
                    <motion.div 
                        layoutId="activeTabIndicator"
                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-500"
                    />
                )}
            </button>
        ))}
      </div>

      {/* Contenu des tabs */}
      <div className={`p-4 ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
        <AnimatePresence mode="wait">
          {/* Tab Contacts */}
          {shareTab === "contacts" && (
            <motion.div
              key="contacts"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.2 }}
              className="space-y-3"
            >
              {/* Barre de recherche */}
              <div className="relative">
                <MagnifyingGlassIcon className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${
                  isDarkMode ? 'text-gray-500' : 'text-gray-400'
                }`} />
                <input
                  type="text"
                  placeholder="Rechercher un ami..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`w-full pl-9 pr-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 border transition-all ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-500' 
                      : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'
                  }`}
                />
              </div>

              {/* Liste des utilisateurs */}
              <div className="max-h-60 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                {loadingUsers ? (
                  <div className="flex flex-col items-center justify-center py-8 opacity-60">
                    <div className="animate-spin w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full mb-2"></div>
                    <p className="text-xs">Chargement...</p>
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="text-center py-8 opacity-60">
                    <p className="text-sm">Aucun contact trouvé</p>
                  </div>
                ) : (
                  filteredUsers.map(user => {
                    const isSelected = selectedUsers.some(u => u._id === user._id);
                    return (
                      <div
                        key={user._id}
                        onClick={() => toggleUserSelection(user)}
                        className={`w-full flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-all border ${
                          isSelected 
                            ? isDarkMode
                              ? "bg-gray-700 border-orange-500/50"
                              : "bg-orange-50 border-orange-200"
                            : "border-transparent hover:bg-black/5 dark:hover:bg-white/5"
                        }`}
                      >
                        <SimpleAvatar 
                          username={user.fullName || user.username} 
                          profilePhoto={user.profilePhoto} 
                          size={36} 
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <p className={`font-semibold text-sm truncate ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                              {user.fullName || user.username}
                            </p>
                            {user.isVerified && <FaCheckCircle className="text-orange-500 text-[10px]" />}
                          </div>
                          <p className={`text-xs truncate ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                             @{user.username || "utilisateur"}
                          </p>
                        </div>
                        
                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                          isSelected 
                            ? "bg-orange-500 border-orange-500" 
                            : isDarkMode ? "border-gray-600" : "border-gray-300"
                        }`}>
                          {isSelected && <CheckIcon className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Zone Message & Bouton */}
              {selectedUsers.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    <textarea
                        placeholder="Message (optionnel)..."
                        value={shareMessage}
                        onChange={(e) => setShareMessage(e.target.value)}
                        className={`w-full px-3 py-2 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-orange-500/30 resize-none mb-2 ${
                        isDarkMode 
                            ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-500' 
                            : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
                        }`}
                        rows={1}
                    />
                    <button
                        onClick={handleShareToContacts}
                        disabled={loadingShare}
                        className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white py-2.5 rounded-xl font-bold text-sm hover:shadow-lg hover:from-orange-600 hover:to-red-600 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                    >
                        {loadingShare ? "Envoi..." : `Partager (${selectedUsers.length})`}
                    </button>
                  </motion.div>
              )}
            </motion.div>
          )}

          {/* Tab Réseaux Sociaux */}
          {shareTab === "social" && (
            <motion.div
              key="social"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-2 gap-3"
            >
              {[
                { name: "WhatsApp", icon: FaWhatsapp, color: "text-green-500", bg: "bg-green-100 dark:bg-green-900/30", action: shareToWhatsApp },
                { name: "Messenger", icon: FaFacebookMessenger, color: "text-blue-500", bg: "bg-blue-100 dark:bg-blue-900/30", action: shareToMessenger },
                { name: "Telegram", icon: FaTelegram, color: "text-sky-500", bg: "bg-sky-100 dark:bg-sky-900/30", action: shareToTelegram },
                { name: "Twitter", icon: FaTwitter, color: "text-gray-700 dark:text-gray-300", bg: "bg-gray-100 dark:bg-gray-700/50", action: shareToTwitter }
              ].map((social, idx) => (
                  <button
                    key={idx}
                    onClick={social.action}
                    className={`flex items-center gap-3 p-3 rounded-xl transition-all hover:scale-[1.02] active:scale-95 ${
                        isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-50 hover:bg-gray-100 border border-gray-100'
                    }`}
                  >
                     <div className={`p-2 rounded-lg ${social.bg}`}>
                        <social.icon className={`w-6 h-6 ${social.color}`} />
                     </div>
                     <span className={`font-medium text-sm ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                        {social.name}
                     </span>
                  </button>
              ))}
            </motion.div>
          )}

          {/* Tab Lien */}
          {shareTab === "link" && (
            <motion.div
              key="link"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.2 }}
              className="space-y-4 text-center py-4"
            >
              <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center mx-auto text-orange-600 dark:text-orange-400">
                  <LinkIcon className="w-6 h-6" />
              </div>
              
              <div>
                <h4 className={`font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Lien du post</h4>
                <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Partagez ce lien n'importe où</p>
              </div>

              <div className={`flex items-center gap-2 p-2 rounded-xl border ${
                isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'
              }`}>
                <input
                  type="text"
                  value={postLink}
                  readOnly
                  className={`flex-1 bg-transparent text-xs sm:text-sm px-2 outline-none ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-600'
                  }`}
                />
                <button
                  onClick={copyLink}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5 ${
                    linkCopied
                      ? "bg-green-500 text-white"
                      : "bg-orange-500 text-white hover:bg-orange-600"
                  }`}
                >
                  {linkCopied ? <CheckIcon className="w-4 h-4" /> : <LinkIcon className="w-4 h-4" />}
                  {linkCopied ? "Copié" : "Copier"}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default PostShareSection;