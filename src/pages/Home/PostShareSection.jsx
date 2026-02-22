// src/pages/Home/PostShareSection.jsx
// ✅ Modal plein écran — même architecture que PostCommentsModal
// ✅ Reprend TOUTE la logique de PostShareSection (contacts, réseaux, lien)
// ✅ Layout 2 colonnes desktop (preview post | options partage)
// ✅ Layout 1 colonne plein écran mobile
// ✅ Portal → z-index propre, hors de tout contain
// ✅ Keyboard-aware iOS/Android

import React, { useState, useEffect, useCallback, useMemo, memo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  XMarkIcon, ChevronLeftIcon, LinkIcon, CheckIcon,
  MagnifyingGlassIcon, ShareIcon, PaperAirplaneIcon,
  HeartIcon
} from "@heroicons/react/24/outline";
import {
  HeartIcon as HeartSolid, CheckBadgeIcon
} from "@heroicons/react/24/solid";
import { useDarkMode } from "../../context/DarkModeContext";
import { useAuth } from "../../context/AuthContext";

// ─────────────────────────────────────────────
// ICÔNES RÉSEAUX (SVG inline — pas de dépendance react-icons)
// ─────────────────────────────────────────────
const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.967-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.557 4.126 1.533 5.862L.06 23.25l5.565-1.453A11.94 11.94 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.9a9.872 9.872 0 0 1-5.031-1.378l-.361-.214-3.735.977.998-3.648-.235-.374A9.86 9.86 0 0 1 2.1 12c0-5.463 4.437-9.9 9.9-9.9 5.463 0 9.9 4.437 9.9 9.9 0 5.463-4.437 9.9-9.9 9.9z"/>
  </svg>
);

const TelegramIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
  </svg>
);

const TwitterXIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

const FacebookIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

// ─────────────────────────────────────────────
// AVATAR
// ─────────────────────────────────────────────
const Avatar = memo(({ username, profilePhoto, size = 40 }) => {
  const [error, setError] = useState(false);
  const initials = useMemo(() => {
    if (!username) return "?";
    const p = username.trim().split(" ");
    return p.length > 1 ? (p[0][0] + p[1][0]).toUpperCase() : username.substring(0, 2).toUpperCase();
  }, [username]);
  const bg = useMemo(() => {
    const colors = ["#f97316","#ef4444","#8b5cf6","#3b82f6","#10b981","#f59e0b","#ec4899","#6366f1"];
    let h = 0;
    for (let i = 0; i < (username || "").length; i++) h = username.charCodeAt(i) + ((h << 5) - h);
    return colors[Math.abs(h) % colors.length];
  }, [username]);
  if (error || !profilePhoto) {
    return (
      <div className="rounded-full flex items-center justify-center text-white font-bold select-none flex-shrink-0"
        style={{ width: size, height: size, backgroundColor: bg, fontSize: size * 0.36 }}>
        {initials}
      </div>
    );
  }
  return (
    <img src={profilePhoto} alt={username}
      className="rounded-full object-cover flex-shrink-0 bg-gray-200"
      style={{ width: size, height: size }}
      onError={() => setError(true)} loading="lazy" />
  );
});
Avatar.displayName = "Avatar";

// ─────────────────────────────────────────────
// APERÇU DU POST (colonne gauche desktop / header mobile)
// ─────────────────────────────────────────────
const PostPreview = memo(({ postUser, postContent, postMediaUrl, likesCount, commentsCount, isDarkMode, onNavigate }) => (
  <div className="flex flex-col h-full overflow-hidden">
    {/* Media */}
    <div className="flex-1 min-h-0 bg-black flex items-center justify-center overflow-hidden">
      {postMediaUrl
        ? <img src={postMediaUrl} alt="" className="w-full h-full object-contain" loading="eager" />
        : (
          <div className="flex flex-col items-center gap-3 opacity-20">
            <ShareIcon className="w-16 h-16 text-white" />
          </div>
        )
      }
    </div>
    {/* Infos */}
    <div className={`flex-shrink-0 p-5 border-t ${isDarkMode ? "bg-[#0a0a0a] border-gray-800" : "bg-white border-gray-100"}`}>
      {postUser && (
        <button
          className="flex items-center gap-3 mb-3 hover:opacity-75 transition-opacity w-full text-left"
          onClick={() => postUser._id && onNavigate?.(`/profile/${postUser._id}`)}
        >
          <Avatar username={postUser.fullName} profilePhoto={postUser.profilePhoto} size={38} />
          <div className="flex items-center gap-1.5">
            <span className={`text-[15px] font-bold ${isDarkMode ? "text-white" : "text-gray-900"}`}>{postUser.fullName}</span>
            {postUser.isVerified && <CheckBadgeIcon className="w-4 h-4 text-orange-500" />}
          </div>
        </button>
      )}
      {postContent && (
        <p className={`text-[13px] leading-relaxed line-clamp-3 mb-3 ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
          {postContent}
        </p>
      )}
      <div className="flex items-center gap-4">
        {likesCount > 0 && (
          <div className="flex items-center gap-1.5">
            <HeartSolid className="w-4 h-4 text-red-500" />
            <span className={`text-[13px] font-semibold ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
              {likesCount.toLocaleString()}
            </span>
          </div>
        )}
        {commentsCount > 0 && (
          <span className={`text-[13px] ${isDarkMode ? "text-gray-500" : "text-gray-400"}`}>
            💬 {commentsCount.toLocaleString()}
          </span>
        )}
      </div>
    </div>
  </div>
));
PostPreview.displayName = "PostPreview";

// ─────────────────────────────────────────────
// ONGLET CONTACTS
// ─────────────────────────────────────────────
const ContactsTab = memo(({ postId, isDarkMode, showToast, onClose }) => {
  const { user: currentUser, getToken } = useAuth();
  const [searchQuery,    setSearchQuery]    = useState("");
  const [allUsers,       setAllUsers]       = useState([]);
  const [selectedUsers,  setSelectedUsers]  = useState([]);
  const [shareMessage,   setShareMessage]   = useState("");
  const [loadingUsers,   setLoadingUsers]   = useState(false);
  const [loadingShare,   setLoadingShare]   = useState(false);
  const base = import.meta.env.VITE_API_URL || "http://localhost:5000";

  useEffect(() => {
    if (!currentUser) return;
    const load = async () => {
      setLoadingUsers(true);
      try {
        const token = await getToken();
        const results = await Promise.allSettled([
          fetch(`${base}/api/users/friends`,   { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${base}/api/users/following`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        let merged = [];
        for (const r of results) {
          if (r.status === "fulfilled" && r.value.ok) {
            const d = await r.value.json();
            merged = [...merged, ...(Array.isArray(d) ? d : d.data || [])];
          }
        }
        setAllUsers(Array.from(new Map(merged.map(u => [u._id, u])).values()));
      } catch { showToast?.("Erreur chargement contacts", "error"); }
      finally { setLoadingUsers(false); }
    };
    load();
  }, [currentUser]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return allUsers;
    const q = searchQuery.toLowerCase();
    return allUsers.filter(u =>
      (u.fullName || "").toLowerCase().includes(q) ||
      (u.username || "").toLowerCase().includes(q)
    );
  }, [allUsers, searchQuery]);

  const toggle = (user) =>
    setSelectedUsers(prev =>
      prev.some(u => u._id === user._id)
        ? prev.filter(u => u._id !== user._id)
        : [...prev, user]
    );

  const handleSend = async () => {
    if (!currentUser) return showToast?.("Connectez-vous", "error");
    if (!selectedUsers.length) return showToast?.("Sélectionnez au moins une personne", "error");
    setLoadingShare(true);
    try {
      const token = await getToken();
      const res = await fetch(`${base}/api/posts/${postId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ recipients: selectedUsers.map(u => u._id), message: shareMessage }),
      });
      if (!res.ok) throw new Error();
      showToast?.(`✅ Partagé avec ${selectedUsers.length} personne${selectedUsers.length > 1 ? "s" : ""}`, "success");
      onClose?.();
    } catch { showToast?.("Erreur lors du partage", "error"); }
    finally { setLoadingShare(false); }
  };

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Search */}
      <div className="relative flex-shrink-0">
        <MagnifyingGlassIcon className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDarkMode ? "text-gray-500" : "text-gray-400"}`} />
        <input
          type="text"
          placeholder="Rechercher un ami…"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className={`w-full pl-9 pr-4 py-2.5 rounded-xl text-[14px] focus:outline-none focus:ring-2 focus:ring-orange-500/40 border transition-all
            ${isDarkMode ? "bg-gray-900 border-gray-800 text-white placeholder-gray-600" : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400"}`}
        />
      </div>

      {/* Liste */}
      <div className="flex-1 overflow-y-auto overscroll-contain space-y-1 pr-1" style={{ WebkitOverflowScrolling: "touch" }}>
        {loadingUsers ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            <p className={`text-sm ${isDarkMode ? "text-gray-500" : "text-gray-400"}`}>Chargement…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <span className="text-3xl">👥</span>
            <p className={`text-sm ${isDarkMode ? "text-gray-500" : "text-gray-400"}`}>
              {searchQuery ? "Aucun résultat" : "Aucun contact trouvé"}
            </p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {filtered.map(user => {
              const isSelected = selectedUsers.some(u => u._id === user._id);
              return (
                <motion.button
                  key={user._id}
                  layout
                  onClick={() => toggle(user)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all border text-left
                    ${isSelected
                      ? isDarkMode ? "bg-orange-500/15 border-orange-500/30" : "bg-orange-50 border-orange-200"
                      : isDarkMode ? "border-transparent hover:bg-white/5" : "border-transparent hover:bg-gray-50"
                    }`}
                >
                  <div className="relative flex-shrink-0">
                    <Avatar username={user.fullName || user.username} profilePhoto={user.profilePhoto} size={42} />
                    <AnimatePresence>
                      {isSelected && (
                        <motion.div
                          initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                          className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center border-2 border-white dark:border-[#0a0a0a]"
                        >
                          <CheckIcon className="w-3 h-3 text-white" strokeWidth={3} />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[14px] font-bold truncate ${isDarkMode ? "text-white" : "text-gray-900"}`}>
                      {user.fullName || user.username}
                    </p>
                    <p className={`text-[12px] truncate ${isDarkMode ? "text-gray-500" : "text-gray-400"}`}>
                      @{user.username || "utilisateur"}
                    </p>
                  </div>
                </motion.button>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      {/* Zone envoi */}
      <AnimatePresence>
        {selectedUsers.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
            className="flex-shrink-0 space-y-2 pt-2 border-t border-gray-100 dark:border-gray-800"
          >
            {/* Avatars sélectionnés */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {selectedUsers.map(u => (
                <button key={u._id} onClick={() => toggle(u)} className="flex-shrink-0 relative group">
                  <Avatar username={u.fullName} profilePhoto={u.profilePhoto} size={32} />
                  <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <XMarkIcon className="w-3 h-3 text-white" />
                  </div>
                </button>
              ))}
            </div>
            <textarea
              placeholder="Ajouter un message (optionnel)…"
              value={shareMessage}
              onChange={e => setShareMessage(e.target.value)}
              rows={2}
              className={`w-full px-3 py-2 text-[13px] rounded-xl border resize-none focus:outline-none focus:ring-2 focus:ring-orange-500/40
                ${isDarkMode ? "bg-gray-900 border-gray-800 text-white placeholder-gray-600" : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400"}`}
            />
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleSend}
              disabled={loadingShare}
              className="w-full bg-gradient-to-r from-orange-500 to-pink-500 text-white py-3 rounded-xl font-bold text-[15px] flex items-center justify-center gap-2 shadow-lg shadow-orange-500/25 disabled:opacity-50"
            >
              {loadingShare
                ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <><PaperAirplaneIcon className="w-4 h-4" /> Envoyer à {selectedUsers.length} personne{selectedUsers.length > 1 ? "s" : ""}</>
              }
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
ContactsTab.displayName = "ContactsTab";

// ─────────────────────────────────────────────
// ONGLET RÉSEAUX SOCIAUX
// ─────────────────────────────────────────────
const SocialTab = memo(({ postId, postContent, isDarkMode }) => {
  const postLink = `${window.location.origin}/post/${postId}`;
  const open = (url) => window.open(url, "_blank", "noopener,noreferrer");

  const apps = [
    {
      id: "whatsapp", label: "WhatsApp", bg: "#25D366", textColor: "text-white",
      icon: <WhatsAppIcon />,
      action: () => open(`https://wa.me/?text=${encodeURIComponent(`${postContent || "Découvrez ce post !"}\n\n${postLink}`)}`),
    },
    {
      id: "telegram", label: "Telegram", bg: "#229ED9", textColor: "text-white",
      icon: <TelegramIcon />,
      action: () => open(`https://t.me/share/url?url=${encodeURIComponent(postLink)}&text=${encodeURIComponent(postContent || "Découvrez ce post !")}`),
    },
    {
      id: "twitter", label: "X (Twitter)", bg: "#000000", textColor: "text-white",
      icon: <TwitterXIcon />,
      action: () => open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(postLink)}&text=${encodeURIComponent(postContent || "Découvrez ce post !")}`),
    },
    {
      id: "facebook", label: "Facebook", bg: "#1877F2", textColor: "text-white",
      icon: <FacebookIcon />,
      action: () => open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(postLink)}`),
    },
    {
      id: "sms", label: "SMS", bg: isDarkMode ? "#1d1d1f" : "#e5e5ea", textColor: isDarkMode ? "text-white" : "text-gray-800",
      icon: <span className="text-xl">💬</span>,
      action: () => { window.location.href = `sms:?&body=${encodeURIComponent(`${postContent || ""}\n${postLink}`)}`; },
    },
    {
      id: "email", label: "Email", bg: isDarkMode ? "#1d1d1f" : "#f3f4f6", textColor: isDarkMode ? "text-white" : "text-gray-800",
      icon: <span className="text-xl">📧</span>,
      action: () => { window.location.href = `mailto:?subject=${encodeURIComponent("Post à voir !")}&body=${encodeURIComponent(`${postContent || ""}\n\n${postLink}`)}`; },
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {apps.map((app, i) => (
        <motion.button
          key={app.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.04 }}
          whileTap={{ scale: 0.93 }}
          onClick={app.action}
          className="flex flex-col items-center gap-2 p-4 rounded-2xl transition-all hover:brightness-110 active:scale-95"
          style={{ backgroundColor: app.bg }}
        >
          <span className={app.textColor}>{app.icon}</span>
          <span className={`text-[11px] font-bold ${app.textColor}`}>{app.label}</span>
        </motion.button>
      ))}
    </div>
  );
});
SocialTab.displayName = "SocialTab";

// ─────────────────────────────────────────────
// ONGLET LIEN
// ─────────────────────────────────────────────
const LinkTab = memo(({ postId, isDarkMode, showToast }) => {
  const [copied, setCopied] = useState(false);
  const postLink = `${window.location.origin}/post/${postId}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(postLink);
      setCopied(true);
      showToast?.("✅ Lien copié !", "success");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      showToast?.("Erreur lors de la copie", "error");
    }
  };

  // Web Share API natif si disponible
  const canNativeShare = !!navigator.share;
  const nativeShare = async () => {
    try {
      await navigator.share({ title: "Post", url: postLink });
    } catch {}
  };

  return (
    <div className="flex flex-col items-center gap-6 py-6 px-2">
      {/* Icône */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={`w-20 h-20 rounded-3xl flex items-center justify-center shadow-lg
          ${isDarkMode ? "bg-gray-900" : "bg-orange-50"}`}
      >
        <LinkIcon className={`w-9 h-9 ${isDarkMode ? "text-orange-400" : "text-orange-500"}`} />
      </motion.div>

      <div className="text-center">
        <h3 className={`text-[17px] font-bold mb-1 ${isDarkMode ? "text-white" : "text-gray-900"}`}>
          Lien du post
        </h3>
        <p className={`text-[13px] ${isDarkMode ? "text-gray-500" : "text-gray-400"}`}>
          Partagez ce lien sur n'importe quelle plateforme
        </p>
      </div>

      {/* URL */}
      <div className={`w-full flex items-center gap-2 px-4 py-3 rounded-2xl border
        ${isDarkMode ? "bg-gray-900 border-gray-800" : "bg-gray-50 border-gray-200"}`}
      >
        <input
          type="text"
          value={postLink}
          readOnly
          className={`flex-1 text-[13px] bg-transparent outline-none truncate
            ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}
        />
      </div>

      {/* Boutons */}
      <div className="w-full flex flex-col gap-2">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={copyLink}
          className={`w-full py-3.5 rounded-2xl font-bold text-[15px] flex items-center justify-center gap-2 transition-all
            ${copied
              ? "bg-green-500 text-white shadow-lg shadow-green-500/25"
              : "bg-gradient-to-r from-orange-500 to-pink-500 text-white shadow-lg shadow-orange-500/25"
            }`}
        >
          <AnimatePresence mode="wait">
            {copied ? (
              <motion.span key="check" initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex items-center gap-2">
                <CheckIcon className="w-5 h-5" /> Lien copié !
              </motion.span>
            ) : (
              <motion.span key="copy" className="flex items-center gap-2">
                <LinkIcon className="w-4 h-4" /> Copier le lien
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>

        {canNativeShare && (
          <button
            onClick={nativeShare}
            className={`w-full py-3 rounded-2xl font-semibold text-[14px] flex items-center justify-center gap-2 border
              ${isDarkMode ? "border-gray-800 text-gray-300 hover:bg-gray-900" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
          >
            <ShareIcon className="w-4 h-4" /> Partager via le système
          </button>
        )}
      </div>
    </div>
  );
});
LinkTab.displayName = "LinkTab";

// ─────────────────────────────────────────────
// MODAL PRINCIPAL
// ─────────────────────────────────────────────
const TABS = [
  { id: "contacts", label: "👥 Contacts" },
  { id: "social",   label: "🌐 Réseaux"  },
  { id: "link",     label: "🔗 Lien"     },
];

const PostShareModal = ({
  isOpen,
  onClose,
  postId,
  postUser,
  postContent,
  postMediaUrl,
  likesCount    = 0,
  commentsCount = 0,
  navigate,
  showToast,
}) => {
  const { isDarkMode } = useDarkMode();
  const [activeTab, setActiveTab] = useState("contacts");
  const [viewportH,  setViewportH]  = useState("100dvh");

  // Body lock
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  // Keyboard-aware
  useEffect(() => {
    if (!isOpen) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setViewportH(`${vv.height}px`);
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    update();
    return () => { vv.removeEventListener("resize", update); vv.removeEventListener("scroll", update); };
  }, [isOpen]);

  // Reset onglet à l'ouverture
  useEffect(() => { if (isOpen) setActiveTab("contacts"); }, [isOpen]);

  const hasMedia = !!postMediaUrl;

  const content = (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="bd"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[400] bg-black/85"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            key="share-modal"
            initial={{ opacity: 0, y: "3%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "3%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className={`fixed z-[401] flex overflow-hidden
              inset-0
              sm:inset-6 sm:rounded-2xl
              ${isDarkMode ? "bg-[#0a0a0a]" : "bg-white"}
            `}
            style={{ height: viewportH, maxHeight: "100%" }}
            onClick={e => e.stopPropagation()}
          >
            {/* ── Colonne gauche : preview post (desktop) ── */}
            {hasMedia && (
              <div className={`hidden sm:flex flex-col border-r flex-shrink-0 sm:w-[42%] lg:w-[48%]
                ${isDarkMode ? "border-gray-800" : "border-gray-100"}`}
              >
                <PostPreview
                  postUser={postUser} postContent={postContent}
                  postMediaUrl={postMediaUrl} likesCount={likesCount}
                  commentsCount={commentsCount}
                  isDarkMode={isDarkMode} onNavigate={navigate}
                />
              </div>
            )}

            {/* ── Colonne droite : options de partage ── */}
            <div className="flex flex-col flex-1 min-w-0 min-h-0">

              {/* Header */}
              <div className={`flex-shrink-0 flex items-center gap-3 px-4 py-3.5 border-b
                ${isDarkMode ? "border-gray-800" : "border-gray-100"}`}
              >
                <button onClick={onClose}
                  className={`p-2 -ml-1 rounded-full transition-colors flex-shrink-0
                    ${isDarkMode ? "hover:bg-gray-800 text-gray-400" : "hover:bg-gray-100 text-gray-500"}`}
                >
                  <ChevronLeftIcon className="w-5 h-5 sm:hidden" />
                  <XMarkIcon className="w-5 h-5 hidden sm:block" />
                </button>
                <div className="flex items-center gap-2 flex-1">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                    <ShareIcon className="w-4 h-4 text-white" />
                  </div>
                  <h2 className={`text-[16px] font-bold ${isDarkMode ? "text-white" : "text-gray-900"}`}>
                    Partager
                  </h2>
                </div>
              </div>

              {/* Résumé post compact — mobile uniquement */}
              {(hasMedia || postContent) && (
                <div className={`sm:hidden flex-shrink-0 flex items-center gap-3 px-4 py-3 border-b
                  ${isDarkMode ? "border-gray-800 bg-black/40" : "border-gray-100 bg-gray-50/80"}`}
                >
                  {hasMedia && (
                    <img src={postMediaUrl} alt="" className="w-14 h-14 rounded-xl object-cover flex-shrink-0" loading="eager" />
                  )}
                  <div className="flex-1 min-w-0">
                    {postUser?.fullName && (
                      <p className={`text-[13px] font-bold truncate mb-0.5 ${isDarkMode ? "text-gray-200" : "text-gray-800"}`}>
                        {postUser.fullName}
                      </p>
                    )}
                    {postContent && (
                      <p className={`text-[12px] line-clamp-2 ${isDarkMode ? "text-gray-500" : "text-gray-500"}`}>
                        {postContent}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Onglets */}
              <div className={`flex-shrink-0 flex border-b
                ${isDarkMode ? "border-gray-800" : "border-gray-100"}`}
              >
                {TABS.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 py-3 text-[13px] font-semibold relative transition-colors
                      ${activeTab === tab.id
                        ? isDarkMode ? "text-orange-400" : "text-orange-600"
                        : isDarkMode ? "text-gray-500 hover:text-gray-300" : "text-gray-400 hover:text-gray-700"
                      }`}
                  >
                    {tab.label}
                    {activeTab === tab.id && (
                      <motion.div
                        layoutId="tab-indicator"
                        className="absolute bottom-0 left-3 right-3 h-0.5 bg-orange-500 rounded-full"
                      />
                    )}
                  </button>
                ))}
              </div>

              {/* Contenu de l'onglet actif */}
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
                <div className="p-4 h-full">
                  <AnimatePresence mode="wait">
                    {activeTab === "contacts" && (
                      <motion.div
                        key="contacts"
                        initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 8 }} transition={{ duration: 0.15 }}
                        className="h-full flex flex-col"
                      >
                        <ContactsTab
                          postId={postId} isDarkMode={isDarkMode}
                          showToast={showToast} onClose={onClose}
                        />
                      </motion.div>
                    )}
                    {activeTab === "social" && (
                      <motion.div
                        key="social"
                        initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 8 }} transition={{ duration: 0.15 }}
                      >
                        <SocialTab postId={postId} postContent={postContent} isDarkMode={isDarkMode} />
                      </motion.div>
                    )}
                    {activeTab === "link" && (
                      <motion.div
                        key="link"
                        initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 8 }} transition={{ duration: 0.15 }}
                      >
                        <LinkTab postId={postId} isDarkMode={isDarkMode} showToast={showToast} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  return createPortal(content, document.body);
};

export default PostShareModal;