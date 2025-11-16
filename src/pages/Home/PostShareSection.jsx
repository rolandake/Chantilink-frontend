import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShareIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
  LinkIcon,
  CheckIcon
} from "@heroicons/react/24/outline";
import { FaCheckCircle, FaCrown, FaWhatsapp, FaFacebookMessenger, FaTelegram, FaTwitter } from "react-icons/fa";
import SimpleAvatar from "./SimpleAvatar";
import { useDarkMode } from "../../context/DarkModeContext"; // ✅ IMPORT

const PostShareSection = ({
  postId,
  currentUser,
  getToken,
  showToast,
  onClose,
  onShareSuccess
}) => {
  const { isDarkMode } = useDarkMode(); // ✅ UTILISATION
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

      const [friendsRes, followingRes] = await Promise.all([
        fetch(`${base}/api/users/friends`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include"
        }),
        fetch(`${base}/api/users/following`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include"
        })
      ]);

      if (!friendsRes.ok || !followingRes.ok) throw new Error("Erreur chargement");

      const friendsData = await friendsRes.json();
      const followingData = await followingRes.json();

      const friends = Array.isArray(friendsData) ? friendsData : friendsData.data || [];
      const following = Array.isArray(followingData) ? followingData : followingData.data || [];

      const combined = [...friends, ...following];
      const uniqueUsers = combined.filter((user, index, self) =>
        index === self.findIndex((u) => u._id === user._id)
      );

      setAllUsers(uniqueUsers);
    } catch (err) {
      console.error("❌ Erreur chargement contacts:", err);
      showToast?.("Erreur chargement de vos contacts", "error");
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (allUsers.length === 0) {
      loadUsers();
    }
  }, []);

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
        }),
        credentials: "include"
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

  const shareToWhatsApp = () => {
    const text = `Découvrez ce post sur notre plateforme !\n\n${postLink}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const shareToMessenger = () => {
    window.open(`https://www.facebook.com/dialog/send?link=${encodeURIComponent(postLink)}&app_id=YOUR_APP_ID&redirect_uri=${encodeURIComponent(postLink)}`, '_blank');
  };

  const shareToTelegram = () => {
    const text = 'Découvrez ce post';
    window.open(`https://t.me/share/url?url=${encodeURIComponent(postLink)}&text=${encodeURIComponent(text)}`, '_blank');
  };

  const shareToTwitter = () => {
    const text = 'Découvrez ce post incroyable !';
    window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(postLink)}&text=${encodeURIComponent(text)}`, '_blank');
  };

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return allUsers;
    const query = searchQuery.toLowerCase();
    return allUsers.filter(user => 
      user.fullName?.toLowerCase().includes(query) ||
      user.username?.toLowerCase().includes(query)
    );
  }, [allUsers, searchQuery]);

  return (
    <motion.div 
      initial={{ opacity: 0, height: 0, scale: 0.95 }} 
      animate={{ opacity: 1, height: "auto", scale: 1 }} 
      exit={{ opacity: 0, height: 0, scale: 0.95 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={`mt-2 rounded-2xl overflow-hidden shadow-lg ${
        isDarkMode 
          ? 'bg-gradient-to-br from-gray-800 via-gray-850 to-gray-900' 
          : 'bg-gradient-to-br from-orange-50 via-red-50 to-pink-50'
      }`}
    >
      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-3 border-b backdrop-blur-sm ${
        isDarkMode 
          ? 'border-gray-700 bg-gray-800/50' 
          : 'border-orange-100 bg-white/50'
      }`}>
        <div className="flex items-center gap-2">
          <div className="p-2 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl">
            <ShareIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className={`font-bold ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`}>
              Partager ce post
            </h3>
            <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Choisissez comment partager
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            onClose?.();
            setSelectedUsers([]);
            setShareMessage("");
            setSearchQuery("");
            setShareTab("contacts");
          }}
          className={`p-2 rounded-full transition-all hover:rotate-90 duration-300 ${
            isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-white'
          }`}
        >
          <XMarkIcon className={`w-5 h-5 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
        </button>
      </div>

      {/* Tabs */}
      <div className={`flex gap-2 px-4 pt-3 ${
        isDarkMode ? 'bg-gray-800/30' : 'bg-white/30'
      }`}>
        <button
          onClick={() => setShareTab("contacts")}
          className={`flex-1 py-2.5 px-4 rounded-t-xl font-medium text-sm transition-all ${
            shareTab === "contacts"
              ? isDarkMode
                ? "bg-gray-800 text-orange-500 shadow-md border-b-2 border-orange-500"
                : "bg-white text-orange-600 shadow-md"
              : isDarkMode
                ? "text-gray-400 hover:bg-gray-800/50"
                : "text-gray-600 hover:bg-white/50"
          }`}
        >
          👥 Contacts
        </button>
        <button
          onClick={() => setShareTab("social")}
          className={`flex-1 py-2.5 px-4 rounded-t-xl font-medium text-sm transition-all ${
            shareTab === "social"
              ? isDarkMode
                ? "bg-gray-800 text-orange-500 shadow-md border-b-2 border-orange-500"
                : "bg-white text-orange-600 shadow-md"
              : isDarkMode
                ? "text-gray-400 hover:bg-gray-800/50"
                : "text-gray-600 hover:bg-white/50"
          }`}
        >
          🌐 Réseaux
        </button>
        <button
          onClick={() => setShareTab("link")}
          className={`flex-1 py-2.5 px-4 rounded-t-xl font-medium text-sm transition-all ${
            shareTab === "link"
              ? isDarkMode
                ? "bg-gray-800 text-orange-500 shadow-md border-b-2 border-orange-500"
                : "bg-white text-orange-600 shadow-md"
              : isDarkMode
                ? "text-gray-400 hover:bg-gray-800/50"
                : "text-gray-600 hover:bg-white/50"
          }`}
        >
          🔗 Lien
        </button>
      </div>

      {/* Contenu des tabs */}
      <div className={`p-4 rounded-b-2xl ${
        isDarkMode ? 'bg-gray-800' : 'bg-white'
      }`}>
        <AnimatePresence mode="wait">
          {/* Tab Contacts */}
          {shareTab === "contacts" && (
            <motion.div
              key="contacts"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              className="space-y-3"
            >
              {/* Barre de recherche */}
              <div className="relative">
                <MagnifyingGlassIcon className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${
                  isDarkMode ? 'text-gray-500' : 'text-gray-400'
                }`} />
                <input
                  type="text"
                  placeholder="Rechercher un ami ou abonné..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`w-full pl-10 pr-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400' 
                      : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
                  }`}
                />
              </div>

              {/* Utilisateurs sélectionnés */}
              {selectedUsers.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  transition={{ duration: 0.2 }}
                  className={`flex flex-wrap gap-2 p-3 rounded-xl border-2 ${
                    isDarkMode 
                      ? 'bg-gray-700/50 border-orange-700' 
                      : 'bg-gradient-to-r from-orange-50 to-red-50 border-orange-200'
                  }`}
                >
                  {selectedUsers.map(user => (
                    <motion.div
                      key={user._id}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      transition={{ duration: 0.2 }}
                      className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-red-500 text-white px-3 py-1.5 rounded-full text-sm font-medium shadow-md"
                    >
                      <SimpleAvatar 
                        username={user.fullName} 
                        profilePhoto={user.profilePhoto} 
                        size={20} 
                      />
                      <span className="max-w-24 truncate">{user.fullName}</span>
                      <button
                        onClick={() => toggleUserSelection(user)}
                        className="hover:bg-white/20 rounded-full p-0.5 transition"
                      >
                        <XMarkIcon className="w-4 h-4" />
                      </button>
                    </motion.div>
                  ))}
                </motion.div>
              )}

              {/* Liste des utilisateurs */}
              <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
                {loadingUsers ? (
                  <div className={`flex flex-col items-center justify-center py-8 ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    <div className="animate-spin w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full mb-3"></div>
                    <p className="text-sm">Chargement de vos contacts...</p>
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className={`flex flex-col items-center justify-center py-8 ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-3 ${
                      isDarkMode ? 'bg-gray-700' : 'bg-gray-100'
                    }`}>
                      <MagnifyingGlassIcon className={`w-8 h-8 ${
                        isDarkMode ? 'text-gray-500' : 'text-gray-400'
                      }`} />
                    </div>
                    <p className="text-sm font-medium">{searchQuery ? "Aucun contact trouvé" : "Aucun contact disponible"}</p>
                  </div>
                ) : (
                  filteredUsers.map(user => {
                    const isSelected = selectedUsers.some(u => u._id === user._id);
                    return (
                      <motion.button
                        key={user._id}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => toggleUserSelection(user)}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                          isSelected 
                            ? isDarkMode
                              ? "bg-gray-700 border-2 border-orange-500 shadow-md"
                              : "bg-gradient-to-r from-orange-100 to-red-100 border-2 border-orange-400 shadow-md"
                            : isDarkMode
                              ? "bg-gray-700/30 border-2 border-transparent hover:bg-gray-700/50 hover:shadow-sm"
                              : "bg-gray-50 border-2 border-transparent hover:bg-gray-100 hover:shadow-sm"
                        }`}
                      >
                        <SimpleAvatar 
                          username={user.fullName || user.username} 
                          profilePhoto={user.profilePhoto} 
                          size={40} 
                        />
                        <div className="flex-1 text-left min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className={`font-semibold text-sm truncate ${
                              isDarkMode ? 'text-gray-100' : 'text-gray-800'
                            }`}>
                              {user.fullName || user.username}
                            </p>
                            {user.isVerified && (
                              <FaCheckCircle className="text-orange-500 text-xs flex-shrink-0" />
                            )}
                            {user.isPremium && (
                              <FaCrown className="text-yellow-500 text-xs flex-shrink-0" />
                            )}
                          </div>
                          {user.username && user.fullName && (
                            <p className={`text-xs truncate ${
                              isDarkMode ? 'text-gray-400' : 'text-gray-500'
                            }`}>@{user.username}</p>
                          )}
                        </div>
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                          isSelected 
                            ? "bg-gradient-to-br from-orange-500 to-red-500 border-orange-500 shadow-md" 
                            : isDarkMode
                              ? "border-gray-600"
                              : "border-gray-300"
                        }`}>
                          {isSelected && (
                            <motion.svg
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ duration: 0.2 }}
                              className="w-4 h-4 text-white" 
                              fill="none" 
                              viewBox="0 0 24 24" 
                              stroke="currentColor"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </motion.svg>
                          )}
                        </div>
                      </motion.button>
                    );
                  })
                )}
              </div>

              {/* Message optionnel */}
              <textarea
                placeholder="💬 Ajouter un message (optionnel)..."
                value={shareMessage}
                onChange={(e) => setShareMessage(e.target.value)}
                className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none transition-all ${
                  isDarkMode 
                    ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400' 
                    : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
                }`}
                rows={2}
              />

              {/* Bouton de partage */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleShareToContacts}
                disabled={loadingShare || selectedUsers.length === 0}
                className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white py-3.5 rounded-xl font-bold hover:from-orange-600 hover:to-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg"
              >
                {loadingShare ? (
                  <>
                    <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
                    Partage en cours...
                  </>
                ) : (
                  <>
                    <ShareIcon className="w-5 h-5" />
                    Partager {selectedUsers.length > 0 && `avec ${selectedUsers.length} personne${selectedUsers.length > 1 ? 's' : ''}`}
                  </>
                )}
              </motion.button>
            </motion.div>
          )}

          {/* Tab Réseaux Sociaux */}
          {shareTab === "social" && (
            <motion.div
              key="social"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-2 gap-3"
            >
              <motion.button
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
                onClick={shareToWhatsApp}
                className={`flex flex-col items-center gap-3 p-4 border-2 rounded-xl hover:shadow-lg transition-all group ${
                  isDarkMode 
                    ? 'bg-gray-700/50 border-green-700' 
                    : 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200'
                }`}
              >
                <div className="p-3 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl group-hover:scale-110 transition-transform shadow-md">
                  <FaWhatsapp className="w-7 h-7 text-white" />
                </div>
                <span className={`font-semibold ${
                  isDarkMode ? 'text-gray-200' : 'text-gray-700'
                }`}>WhatsApp</span>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
                onClick={shareToMessenger}
                className={`flex flex-col items-center gap-3 p-4 border-2 rounded-xl hover:shadow-lg transition-all group ${
                  isDarkMode 
                    ? 'bg-gray-700/50 border-blue-700' 
                    : 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200'
                }`}
              >
                <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl group-hover:scale-110 transition-transform shadow-md">
                  <FaFacebookMessenger className="w-7 h-7 text-white" />
                </div>
                <span className={`font-semibold ${
                  isDarkMode ? 'text-gray-200' : 'text-gray-700'
                }`}>Messenger</span>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
                onClick={shareToTelegram}
                className={`flex flex-col items-center gap-3 p-4 border-2 rounded-xl hover:shadow-lg transition-all group ${
                  isDarkMode 
                    ? 'bg-gray-700/50 border-sky-700' 
                    : 'bg-gradient-to-br from-sky-50 to-cyan-50 border-sky-200'
                }`}
              >
                <div className="p-3 bg-gradient-to-br from-sky-500 to-cyan-600 rounded-xl group-hover:scale-110 transition-transform shadow-md">
                  <FaTelegram className="w-7 h-7 text-white" />
                </div>
                <span className={`font-semibold ${
                  isDarkMode ? 'text-gray-200' : 'text-gray-700'
                }`}>Telegram</span>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
                onClick={shareToTwitter}
                className={`flex flex-col items-center gap-3 p-4 border-2 rounded-xl hover:shadow-lg transition-all group ${
                  isDarkMode 
                    ? 'bg-gray-700/50 border-gray-600' 
                    : 'bg-gradient-to-br from-gray-50 to-slate-50 border-gray-300'
                }`}
              >
                <div className="p-3 bg-gradient-to-br from-gray-800 to-slate-900 rounded-xl group-hover:scale-110 transition-transform shadow-md">
                  <FaTwitter className="w-7 h-7 text-white" />
                </div>
                <span className={`font-semibold ${
                  isDarkMode ? 'text-gray-200' : 'text-gray-700'
                }`}>Twitter/X</span>
              </motion.button>
            </motion.div>
          )}

          {/* Tab Lien */}
          {shareTab === "link" && (
            <motion.div
              key="link"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <LinkIcon className="w-8 h-8 text-white" />
                </div>
                <h4 className={`font-bold mb-2 ${
                  isDarkMode ? 'text-gray-100' : 'text-gray-800'
                }`}>Copiez le lien du post</h4>
                <p className={`text-sm ${
                  isDarkMode ? 'text-gray-400' : 'text-gray-500'
                }`}>Partagez ce lien où vous voulez</p>
              </div>

              <div className={`flex items-center gap-2 p-3 rounded-xl border-2 ${
                isDarkMode 
                  ? 'bg-gray-700 border-gray-600' 
                  : 'bg-gray-50 border-gray-200'
              }`}>
                <input
                  type="text"
                  value={postLink}
                  readOnly
                  className={`flex-1 bg-transparent text-sm outline-none ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-600'
                  }`}
                />
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={copyLink}
                  className={`px-4 py-2 rounded-lg font-semibold transition-all flex items-center gap-2 shadow-md ${
                    linkCopied
                      ? "bg-green-500 text-white"
                      : "bg-gradient-to-r from-orange-500 to-red-500 text-white hover:from-orange-600 hover:to-red-600"
                  }`}
                >
                  {linkCopied ? (
                    <>
                      <CheckIcon className="w-5 h-5" />
                      Copié !
                    </>
                  ) : (
                    <>
                      <LinkIcon className="w-5 h-5" />
                      Copier
                    </>
                  )}
                </motion.button>
              </div>

              <div className={`border-2 rounded-xl p-4 ${
                isDarkMode 
                  ? 'bg-gray-700/50 border-orange-700' 
                  : 'bg-gradient-to-br from-orange-50 to-red-50 border-orange-200'
              }`}>
                <p className={`text-xs text-center ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-600'
                }`}>
                  💡 <span className="font-semibold">Astuce :</span> Collez ce lien dans vos messages, emails ou sur d'autres plateformes pour partager ce post
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default PostShareSection;
