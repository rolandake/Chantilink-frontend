// ============================================
// 📁 src/Pages/chat/ContactSidebar.jsx  v3
//
// CORRECTIONS :
//   1. Doublons → déduplication par normalizeId() sur conversations + contacts
//   2. Suppression contact → DELETE /contacts/by-user/:userId (pas l'ID MongoDB du doc Contact)
//   3. Flèche retour → toujours rendue si onBack fourni
//   4. IDs normalisés partout (String, trim, lowercase)
//   5. removeContactFromCache() utilisé à la suppression
//   6. mergedList : conversations ET contacts dédupliqués par clé canonique
// ============================================
import React, {
  useState, useEffect, useMemo, useCallback,
} from "react";
import {
  Search, UserPlus, ArrowLeft, X, Users,
  ChevronRight, Loader, CheckCircle2, XCircle,
  PhoneMissed, Smartphone, PenLine, Trash2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "../../context/ToastContext";
import {
  readOnAppContacts,
  saveContactToOnApp,
  removeContactFromCache,
  normalizeId,
} from "../../utils/contactsCache";

const BASE_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD
    ? "https://chantilink-backend.onrender.com/api"
    : "http://localhost:5000/api");

// ─── API ─────────────────────────────────────────────────────────────────────
const syncContactsAPI = async (token, contacts) => {
  const res = await fetch(`${BASE_URL}/contacts/sync`, {
    method:  "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body:    JSON.stringify({ contacts }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `Erreur ${res.status}`);
  return data;
};

/**
 * Supprime le lien contact entre l'utilisateur courant et un userId cible.
 * Utilise DELETE /contacts/by-user/:targetUserId
 * (pas l'ID MongoDB du document Contact, mais l'ID de l'utilisateur cible)
 */
const deleteContactByUserIdAPI = async (token, targetUserId) => {
  const res = await fetch(`${BASE_URL}/contacts/by-user/${targetUserId}`, {
    method:  "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  // 404 = déjà supprimé → on accepte silencieusement
  if (res.status === 404) return { success: true };
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Erreur ${res.status}`);
  return data;
};

const openContactPicker = async () => {
  try {
    if (!("contacts" in navigator && "ContactsManager" in window)) return null;
    const raw = await navigator.contacts.select(["name", "tel"], { multiple: true });
    return raw.flatMap((c) =>
      (c.tel || []).map((phone) => ({ name: c.name?.[0] || "Inconnu", phone }))
    );
  } catch (err) {
    console.info("Contact Picker annulé:", err.message);
    return null;
  }
};

const isPickerSupported = () =>
  typeof window !== "undefined" &&
  "contacts" in navigator &&
  "ContactsManager" in window;

// ─────────────────────────────────────────────────────────────────────────────
// MODALE AJOUTER — double action (répertoire OU manuel)
// ─────────────────────────────────────────────────────────────────────────────
const AddContactModal = ({ token, userId, onClose, onPickerSync }) => {
  const [mode,    setMode]    = useState(null);
  const [form,    setForm]    = useState({ name: "", phone: "" });
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState(null);
  const [error,   setError]   = useState("");
  const { showToast } = useToast();
  const pickerOk = isPickerSupported();

  const fmtPhone = (v) => {
    let c = v.replace(/[^\d+]/g, "");
    if (!c.startsWith("+")) c = "+" + c;
    if (c.length > 16) c = c.slice(0, 16);
    if (c.length > 4) {
      const prefix = c.slice(0, 4);
      const groups = c.slice(4).match(/.{1,2}/g) || [];
      return prefix + " " + groups.join(" ");
    }
    return c;
  };

  const handlePicker = async () => {
    setLoading(true); setError("");
    try {
      const picked = await openContactPicker();
      if (!picked) { setLoading(false); return; }
      if (!picked.length) { showToast("Aucun contact sélectionné", "info"); setLoading(false); return; }
      const data  = await syncContactsAPI(token, picked);
      const found = data.onChantilink || [];
      found.forEach((c) => saveContactToOnApp(c, userId));
      setResult({ found, total: picked.length });
      onPickerSync?.(found);
    } catch (e) { setError(e.message || "Erreur de synchronisation"); }
    finally { setLoading(false); }
  };

  const handleManual = async (e) => {
    e.preventDefault(); setError("");
    const clean = form.phone.replace(/\s/g, "");
    if (!form.name.trim()) return setError("Le nom est requis");
    if (clean.length < 10)  return setError("Numéro trop court (min 10 chiffres)");
    setLoading(true);
    try {
      const data  = await syncContactsAPI(token, [{ phone: clean, name: form.name.trim() }]);
      const found = data.onChantilink || [];
      found.forEach((c) => saveContactToOnApp(c, userId));
      setResult({ found, total: 1 });
      onPickerSync?.(found);
    } catch (e) { setError(e.message || "Contact introuvable"); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 26, stiffness: 280 }}
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 w-full sm:max-w-md bg-[#0f1218] border-t sm:border border-white/10 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-white/5">
          {(mode || result) && (
            <button onClick={() => { setMode(null); setResult(null); setError(""); }} className="p-1.5 hover:bg-white/5 rounded-xl">
              <ArrowLeft size={16} className="text-gray-400" />
            </button>
          )}
          <div className="flex-1">
            <h2 className="text-base font-black text-white">
              {result ? "Résultats" : mode === "manual" ? "Saisie manuelle" : "Ajouter un contact"}
            </h2>
            <p className="text-[11px] text-gray-500">
              {result ? `${result.total} vérifié(s)` : "Chantilink Secure"}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/5 rounded-xl">
            <X size={16} className="text-gray-400" />
          </button>
        </div>

        <div className="p-5">
          <AnimatePresence mode="wait">

            {/* CHOIX */}
            {!mode && !result && (
              <motion.div key="choice" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                {/* Répertoire */}
                <button
                  onClick={pickerOk ? handlePicker : () => setMode("manual")}
                  disabled={loading}
                  className="w-full flex items-center gap-4 p-4 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/20 rounded-2xl transition-all group"
                >
                  <div className="w-11 h-11 rounded-xl bg-blue-600/20 flex items-center justify-center flex-shrink-0">
                    {loading ? <Loader size={20} className="text-blue-400 animate-spin" /> : <Smartphone size={20} className="text-blue-400" />}
                  </div>
                  <div className="text-left flex-1">
                    <p className="text-sm font-black text-white">Depuis mon répertoire</p>
                    <p className="text-xs text-gray-500">{pickerOk ? "Sélectionnez vos contacts téléphone" : "Non disponible sur cet appareil"}</p>
                  </div>
                  <ChevronRight size={14} className="text-gray-600 group-hover:text-gray-400" />
                </button>

                {/* Manuel */}
                <button
                  onClick={() => setMode("manual")}
                  className="w-full flex items-center gap-4 p-4 bg-white/[0.03] hover:bg-white/[0.06] border border-white/8 rounded-2xl transition-all group"
                >
                  <div className="w-11 h-11 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">
                    <PenLine size={20} className="text-gray-400" />
                  </div>
                  <div className="text-left flex-1">
                    <p className="text-sm font-black text-white">Saisie manuelle</p>
                    <p className="text-xs text-gray-500">Entrez un nom et un numéro</p>
                  </div>
                  <ChevronRight size={14} className="text-gray-600 group-hover:text-gray-400" />
                </button>
                <p className="text-center text-[10px] text-gray-600 pt-1">🔒 Numéros hachés SHA-256</p>
              </motion.div>
            )}

            {/* FORMULAIRE MANUEL */}
            {mode === "manual" && !result && (
              <motion.div key="manual" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
                <form onSubmit={handleManual} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Nom</label>
                    <input type="text" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                      placeholder="Ex: Marc Koffi" autoFocus
                      className="w-full px-4 py-3.5 bg-white/[0.04] text-white rounded-2xl border border-white/8 focus:border-blue-500/60 outline-none placeholder:text-gray-700 font-bold text-sm" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Téléphone</label>
                    <input type="tel" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: fmtPhone(e.target.value) }))}
                      placeholder="+225 07 00 00 00 00"
                      className="w-full px-4 py-3.5 bg-white/[0.04] text-white rounded-2xl border border-white/8 focus:border-blue-500/60 outline-none placeholder:text-gray-700 font-mono text-sm" />
                  </div>
                  {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{error}</p>}
                  <button type="submit" disabled={loading || !form.name.trim() || form.phone.replace(/\s/g, "").length < 10}
                    className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 disabled:opacity-40 text-white font-bold rounded-2xl flex items-center justify-center gap-2 text-sm">
                    {loading ? <Loader size={16} className="animate-spin" /> : <UserPlus size={16} />}
                    {loading ? "Recherche…" : "Vérifier sur Chantilink"}
                  </button>
                </form>
              </motion.div>
            )}

            {/* RÉSULTAT */}
            {result && (
              <motion.div key="result" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                {result.found.length > 0 ? (
                  <>
                    <div className="flex items-center gap-3 mb-4 p-3 bg-green-500/8 border border-green-500/15 rounded-2xl">
                      <CheckCircle2 size={20} className="text-green-400 flex-shrink-0" />
                      <p className="text-sm text-gray-300"><span className="text-white font-black">{result.found.length}</span> ami(s) trouvés sur Chantilink</p>
                    </div>
                    <div className="space-y-2 max-h-44 overflow-y-auto">
                      {result.found.map((c) => (
                        <div key={normalizeId(c.id || c._id)} className="flex items-center gap-3 p-3 bg-white/[0.03] rounded-xl border border-white/5">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-sm font-black text-white overflow-hidden">
                            {c.profilePhoto ? <img src={c.profilePhoto} alt="" className="w-full h-full object-cover" /> : c.fullName?.[0]?.toUpperCase() || "?"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-white truncate">{c.fullName}</p>
                            {c.username && <p className="text-xs text-gray-500">@{c.username}</p>}
                          </div>
                          <CheckCircle2 size={14} className="text-green-400 flex-shrink-0" />
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-6">
                    <XCircle size={36} className="text-gray-600 mx-auto mb-3" />
                    <p className="text-sm font-bold text-gray-300 mb-1">Aucun ami trouvé</p>
                    <p className="text-xs text-gray-500">Aucun de vos contacts n'utilise encore Chantilink.</p>
                  </div>
                )}
                <button onClick={onClose} className="w-full mt-4 py-3 bg-white/5 hover:bg-white/10 text-gray-300 font-bold rounded-2xl text-sm">Fermer</button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSANT PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export const ContactSidebar = ({
  token,
  contacts      = [],
  conversations = [],
  selectedContact,
  unreadCounts  = {},
  onlineUsers   = [],
  user,
  onContactSelect,
  onPickerSync,
  onShowPending,
  onShowMissedCalls,
  missedCallsCount = 0,
  onBack,
}) => {
  const userId = normalizeId(user?.id || user?._id);
  const { showToast } = useToast();

  const [onAppContacts, setOnAppContacts] = useState([]);
  const [search,        setSearch]        = useState("");
  const [showAdd,       setShowAdd]       = useState(false);
  const [deletingId,    setDeletingId]    = useState(null);

  // ── Charger + recharger contacts locaux ──────────────────────────────────
  const reloadLocal = useCallback(() => {
    if (userId) setOnAppContacts(readOnAppContacts(userId));
  }, [userId]);

  useEffect(() => {
    setOnAppContacts([]);
    if (userId) reloadLocal();
  }, [userId, reloadLocal]);

  useEffect(() => {
    window.addEventListener("focus", reloadLocal);
    return () => window.removeEventListener("focus", reloadLocal);
  }, [reloadLocal]);

  // ── Sync contacts prop → cache local (sans écraser les existants) ─────────
  useEffect(() => {
    if (!userId || contacts.length === 0) return;
    contacts.forEach((c) => {
      const id = normalizeId(c.id || c._id);
      if (id) saveContactToOnApp({ ...c, id }, userId);
    });
    reloadLocal();
  }, [contacts, userId, reloadLocal]);

  // ── Fusion sans doublons : conversations + contacts ───────────────────────
  // Clé canonique = normalizeId pour les deux sources
  const mergedList = useMemo(() => {
    const map = new Map();

    // 1. Conversations (priorité, ont un lastMessage)
    conversations.forEach((conv) => {
      const id = normalizeId(conv.id || conv._id);
      if (id) map.set(id, { ...conv, id, _hasConv: true });
    });

    // 2. Contacts locaux (uniquement si pas déjà dans map)
    onAppContacts.forEach((c) => {
      const id = normalizeId(c.id || c._id);
      if (id && !map.has(id)) {
        map.set(id, { ...c, id, _hasConv: false });
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      if (a._hasConv && !b._hasConv) return -1;
      if (!a._hasConv && b._hasConv) return 1;
      const tA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
      const tB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
      return tB - tA;
    });
  }, [conversations, onAppContacts]);

  const filtered = useMemo(() =>
    mergedList.filter((c) =>
      (c.fullName || c.name || "").toLowerCase().includes(search.toLowerCase())
    ), [mergedList, search]);

  // ── Suppression contact ───────────────────────────────────────────────────
  // On passe l'ID de l'utilisateur cible (pas l'ID doc Contact MongoDB)
  const handleDelete = useCallback(async (targetUserId) => {
    const id = normalizeId(targetUserId);
    setDeletingId(id);
    try {
      await deleteContactByUserIdAPI(token, id);
      // Supprimer du cache local
      removeContactFromCache(id, userId);
      setOnAppContacts((prev) => prev.filter((c) => normalizeId(c.id) !== id));
      showToast("Contact supprimé", "success");
    } catch (err) {
      showToast(err.message || "Impossible de supprimer", "error");
    } finally {
      setDeletingId(null);
    }
  }, [token, userId, showToast]);

  const handlePickerSync = useCallback((found) => {
    found.forEach((c) => saveContactToOnApp(c, userId));
    reloadLocal();
    onPickerSync?.(found);
    setShowAdd(false);
  }, [userId, onPickerSync, reloadLocal]);

  return (
    <>
      <div className="flex flex-col h-full bg-[#0b0d10]">

        {/* ── HEADER ── */}
        <div className="px-4 py-3 bg-[#0f1218]/90 backdrop-blur-xl border-b border-white/5">
          <div className="flex items-center gap-2 mb-3">

            {/* ✅ Flèche retour — toujours visible si onBack fourni */}
            {onBack && (
              <motion.button whileTap={{ scale: 0.9 }} onClick={onBack}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/[0.06] hover:bg-white/[0.10] flex-shrink-0"
                aria-label="Retour"
              >
                <ArrowLeft size={15} className="text-white/70" />
              </motion.button>
            )}

            <span className="text-sm font-black tracking-tight text-white flex-1 text-center">
              Messages
            </span>

            {/* Appels manqués */}
            {onShowMissedCalls && (
              <motion.button whileTap={{ scale: 0.9 }} onClick={onShowMissedCalls}
                className="relative flex items-center gap-1.5 px-2.5 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-[11px] font-bold border border-red-500/15 transition-all"
              >
                <PhoneMissed size={12} /> Manqués
                {missedCallsCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[15px] h-[15px] bg-red-500 text-white text-[9px] font-black px-1 rounded-full flex items-center justify-center">
                    {missedCallsCount > 9 ? "9+" : missedCallsCount}
                  </span>
                )}
              </motion.button>
            )}

            {/* Ajouter contact */}
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => setShowAdd(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600/15 hover:bg-blue-600/25 text-blue-400 rounded-lg text-[11px] font-bold border border-blue-500/20 transition-all"
            >
              <UserPlus size={12} /> Ajouter
            </motion.button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" size={13} />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher…"
              className="w-full bg-white/[0.04] border border-white/5 rounded-xl py-2 pl-9 pr-4 text-xs outline-none focus:border-blue-500/40 text-white placeholder:text-gray-600" />
          </div>
        </div>

        {/* ── LISTE ── */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <EmptyState onAdd={() => setShowAdd(true)} />
          ) : (
            filtered.map((item) => {
              const id      = normalizeId(item.id || item._id);
              const unread  = unreadCounts[id] || item.unreadCount || 0;
              const online  = onlineUsers.includes(id) || item.isOnline;
              return (
                <ConversationRow
                  key={id}
                  item={{ ...item, id }}
                  unread={unread}
                  online={online}
                  isSelected={normalizeId(selectedContact?.id) === id}
                  isDeleting={deletingId === id}
                  onSelect={() => onContactSelect({
                    id,
                    fullName:     item.fullName,
                    username:     item.username,
                    profilePhoto: item.profilePhoto,
                    isOnline:     online,
                    lastSeen:     item.lastSeen,
                  })}
                  onDelete={() => handleDelete(id)}
                />
              );
            })
          )}
        </div>

        {/* ── Demandes ── */}
        {onShowPending && (
          <div className="px-3 pb-3 pt-2 border-t border-white/5">
            <button onClick={onShowPending}
              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-white/[0.04] rounded-xl group">
              <span className="text-xs text-gray-500 group-hover:text-gray-300 transition-colors">Demandes de messages</span>
              <ChevronRight size={12} className="text-gray-700 group-hover:text-gray-500" />
            </button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showAdd && (
          <AddContactModal key="add" token={token} userId={userId} onClose={() => setShowAdd(false)} onPickerSync={handlePickerSync} />
        )}
      </AnimatePresence>
    </>
  );
};

// ─── Ligne conversation (style WhatsApp) ─────────────────────────────────────
const ConversationRow = ({ item, unread, online, isSelected, isDeleting, onSelect, onDelete }) => {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const lastTime = item.lastMessageTime
    ? new Date(item.lastMessageTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";

  return (
    <div className={`group relative border-b border-white/[0.03] transition-colors ${isSelected ? "bg-white/[0.07]" : "hover:bg-white/[0.03]"}`}>
      <button onClick={onSelect} className="w-full flex items-center gap-3 px-4 py-3.5">
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center font-black text-lg text-white overflow-hidden border border-white/5">
            {item.profilePhoto
              ? <img src={item.profilePhoto} alt="" className="w-full h-full object-cover" />
              : (item.fullName?.[0] || "?").toUpperCase()}
          </div>
          {online && <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-[#0b0d10]" />}
        </div>

        {/* Infos */}
        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center justify-between mb-0.5">
            <h3 className="text-sm font-bold text-white truncate">{item.fullName || "Inconnu"}</h3>
            <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
              {lastTime && <span className="text-[10px] text-gray-500">{lastTime}</span>}
              {unread > 0 && (
                <span className="bg-green-500 text-white text-[9px] font-black min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1">
                  {unread > 99 ? "99" : unread}
                </span>
              )}
            </div>
          </div>
          <p className="text-xs text-gray-500 truncate">
            {item.lastMessage || (online ? "En ligne" : item.username ? `@${item.username}` : "Disponible")}
          </p>
        </div>
      </button>

      {/* Bouton supprimer */}
      {!confirmDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/25 text-red-400 opacity-0 group-hover:opacity-100 transition-all"
          aria-label="Supprimer le contact"
        >
          <Trash2 size={13} />
        </button>
      )}

      {/* Confirmation suppression */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
            className="absolute inset-x-3 top-1.5 bottom-1.5 z-10 flex items-center gap-2 bg-[#1a1f2a] border border-red-500/20 rounded-xl px-3 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-xs text-white flex-1 font-semibold truncate">Supprimer {item.fullName} ?</p>
            <button onClick={() => setConfirmDelete(false)}
              className="px-2.5 py-1.5 text-[10px] font-bold text-gray-400 hover:text-white transition-colors flex-shrink-0">
              Annuler
            </button>
            <button
              onClick={() => { setConfirmDelete(false); onDelete(); }}
              disabled={isDeleting}
              className="px-3 py-1.5 bg-red-500 hover:bg-red-400 disabled:opacity-50 text-white text-[10px] font-black rounded-lg transition-all flex-shrink-0 flex items-center gap-1"
            >
              {isDeleting ? <Loader size={11} className="animate-spin" /> : <Trash2 size={11} />}
              {isDeleting ? "…" : "Supprimer"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const EmptyState = ({ onAdd }) => (
  <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
    <div className="w-14 h-14 rounded-2xl bg-blue-600/8 flex items-center justify-center mb-4">
      <Users size={26} className="text-blue-500/30" />
    </div>
    <p className="text-sm font-bold text-gray-500 mb-1">Aucun contact</p>
    <p className="text-xs text-gray-600 mb-4">Ajoutez des contacts pour discuter</p>
    <button onClick={onAdd} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all">
      <UserPlus size={14} /> Ajouter un contact
    </button>
  </div>
);

export default ContactSidebar;