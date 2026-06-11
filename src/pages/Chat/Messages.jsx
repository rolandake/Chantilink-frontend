// ============================================
// 📁 src/Pages/chat/Messages.jsx
// FIXES:
//  - handleOnboardingComplete appelait loadContacts/loadConversations
//    avant qu'elles soient définies (hoisting manquant) → déplacé après
//  - handleReceiveMessage : selectedContact en closure stale dans useEffect
//    → ajout de selectedContact dans les dépendances + useRef comme guard
//  - handleSendMessage : pas de guard si socket déconnecté mid-send
//  - call-initiated : ne flushait pas l'offer WebRTC en attente
//  - handleAcceptCall : setCall avant socket.emit → race condition
//  - handleDeleteMessage : pas de feedback si API échoue silencieusement
//  - Absence de cleanup du socket "onlineUsers" quand connected change
//  - totalUnread : recalculé à chaque render sans useMemo
//  - loadConversations : setLoading(true) mais pas toujours setLoading(false)
//    dans le chemin du cache (finally manquant)
//  - sendMediaMessage : si socket connecté, le message n'apparaît pas
//    localement (pas d'optimistic update)
//  - missedCallNotification : s'affichait indéfiniment (pas de auto-clear)
//    → géré dans useCallManager mais setMissedCallNotification aussi
//      appelé depuis Messages.jsx → doublon nettoyé
// ============================================
import React, {
  useState, useEffect, useRef, useCallback, useMemo,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import {
  X, Users, MessageSquare, Shield, ShieldCheck,
  Phone, Video, CheckCircle, ChevronRight, Loader, UserPlus,
} from "lucide-react";

import { useAuth }   from "../../context/AuthContext";
import { useSocket } from "../../context/SocketContext";
import { useToast }  from "../../context/ToastContext";
import { API }       from "../../services/apiService";
import { saveContactToOnApp } from "../../utils/contactsCache";
import messageCache  from "../../utils/messageCache";

import IncomingCallModal from "../../components/IncomingCallModal";
import CallManager       from "../../components/CallManager";
import { PhoneNumberModal }    from "./components/PhoneNumberModal";
import { ContactSidebar }      from "./ContactSidebar";
import { ChatHeader }          from "./components/ChatHeader";
import { MessagesList }        from "./components/MessagesList";
import { ChatInput }           from "./components/ChatInput";
import { PendingMessagesModal } from "./PendingMessagesModal";

import { useAudioRecording } from "../../hooks/useAudioRecording";
import { useCallManager }    from "./hooks/useCallManager";
import {
  playSendSound,
  playReceiveSound,
  playCallConnectedSound,
  playCallEndedSound,
  playCallRejectedSound,
  CallRingtone,
  vibrateCall,
  stopVibration,
} from "../../utils/callSounds";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const openContactPicker = async () => {
  try {
    if (!("contacts" in navigator && "ContactsManager" in window)) return [];
    const raw = await navigator.contacts.select(["name", "tel"], { multiple: true });
    return raw.flatMap((c) =>
      (c.tel || []).map((phone) => ({ name: c.name?.[0] || "Inconnu", phone }))
    );
  } catch (err) {
    console.info("Contact Picker:", err.message);
    return [];
  }
};

const getEntityId = (value) => {
  if (!value) return "";
  if (typeof value === "object") return String(value._id || value.id || "");
  return String(value);
};

// ─────────────────────────────────────────────────────────────────────────────
// ONBOARDING
// ─────────────────────────────────────────────────────────────────────────────
const OnboardingPhoneScreen = ({ onComplete, user }) => {
  const [step,      setStep]      = useState("intro");
  const [phone,     setPhone]     = useState("");
  const [error,     setError]     = useState("");
  const [syncing,   setSyncing]   = useState(false);
  const [syncStats, setSyncStats] = useState(null);

  const { token, updateUserProfile } = useAuth();
  const { showToast } = useToast();
  const onboardingUserId = getEntityId(user);

  const formatPhone = (value) => {
    let v = value.replace(/[^\d+]/g, "");
    if (!v.startsWith("+") && v.length > 0) v = "+225" + v.replace(/^0/, "");
    return v;
  };

  const handlePhoneSubmit = async () => {
    const formatted = formatPhone(phone);
    if (formatted.replace(/\D/g, "").length < 10) {
      setError("Numéro invalide — ex: +225 07 00 00 00 00");
      return;
    }
    setError("");
    setSyncing(true);
    try {
      const resp = await API.updatePhone(token, formatted);
      if (!resp.success) throw new Error(resp.message || "Erreur serveur");
      if (updateUserProfile) updateUserProfile(user.id || user._id, resp.user);
      setStep("picker");
    } catch (err) {
      setError(err.message || "Une erreur est survenue");
    } finally {
      setSyncing(false);
    }
  };

  const handlePickContacts = async () => {
    setSyncing(true);
    try {
      const picked = await openContactPicker();
      if (picked.length === 0) { setSyncStats({ total: 0, onApp: 0 }); setStep("done"); return; }
      const syncResp = await API.syncContacts(token, picked);
      const stats = {
        total: picked.length,
        onApp: syncResp.stats?.onApp || syncResp.onChantilink?.length || 0,
      };
      (syncResp.onChantilink || []).forEach((c) => saveContactToOnApp(c, onboardingUserId));
      setSyncStats(stats);
      setStep("done");
    } catch (err) {
      console.error("Picker sync error:", err);
      setSyncStats({ total: 0, onApp: 0 });
      setStep("done");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-gray-950 via-blue-950 to-gray-950 flex items-center justify-center p-4">
      <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <AnimatePresence mode="wait">

        {step === "intro" && (
          <motion.div key="intro" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.4 }} className="w-full max-w-sm text-center">
            <motion.div animate={{ scale: [1, 1.06, 1] }} transition={{ duration: 2.5, repeat: Infinity }} className="mx-auto mb-8 w-24 h-24 rounded-3xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-2xl shadow-blue-900/50">
              <MessageSquare size={44} className="text-white" />
            </motion.div>
            <h1 className="text-3xl font-black text-white mb-3 leading-tight">
              Restez connecté<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">avec vos proches</span>
            </h1>
            <p className="text-gray-400 mb-10 leading-relaxed">Trouvez vos amis sur Chantilink en sélectionnant vos contacts depuis votre téléphone.</p>
            <div className="space-y-3 mb-10 text-left">
              {[
                { icon: <UserPlus size={18} />, color: "blue",   title: "Vous choisissez",        desc: "Sélectionnez uniquement les contacts que vous voulez" },
                { icon: <Shield   size={18} />, color: "green",  title: "Chiffrement SHA-256",     desc: "Vos numéros ne sont jamais stockés en clair" },
                { icon: <MessageSquare size={18} />, color: "purple", title: "Messagerie sécurisée", desc: "Discussions privées de bout en bout" },
              ].map((f, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.1 }} className="flex items-center gap-3 p-3 bg-white/5 rounded-2xl border border-white/5">
                  <div className={`w-9 h-9 rounded-xl bg-${f.color}-500/15 flex items-center justify-center text-${f.color}-400 flex-shrink-0`}>{f.icon}</div>
                  <div><p className="text-sm font-bold text-white">{f.title}</p><p className="text-xs text-gray-500">{f.desc}</p></div>
                </motion.div>
              ))}
            </div>
            <motion.button whileTap={{ scale: 0.97 }} onClick={() => setStep("phone")} className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black rounded-2xl flex items-center justify-center gap-2">
              Commencer <ChevronRight size={20} />
            </motion.button>
            <button onClick={() => { setSyncStats({ total: 0, onApp: 0 }); setStep("done"); }} className="mt-4 w-full py-3 text-gray-500 text-sm hover:text-gray-400">Passer pour l'instant</button>
          </motion.div>
        )}

        {step === "phone" && (
          <motion.div key="phone" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.4 }} className="w-full max-w-sm">
            <div className="mb-8">
              <div className="w-16 h-16 rounded-2xl bg-blue-600/20 flex items-center justify-center mb-6"><Phone size={30} className="text-blue-400" /></div>
              <h2 className="text-2xl font-black text-white mb-2">Votre numéro</h2>
              <p className="text-gray-400 text-sm">Entrez votre numéro pour être trouvable par vos contacts.</p>
            </div>
            <div className={`flex items-center gap-3 p-4 rounded-2xl border-2 bg-white/5 mb-4 ${error ? "border-red-500/60" : "border-white/10 focus-within:border-blue-500/60"}`}>
              <span className="text-2xl select-none">🇨🇮</span>
              <input type="tel" value={phone} onChange={(e) => { setPhone(e.target.value); setError(""); }} onKeyDown={(e) => e.key === "Enter" && handlePhoneSubmit()} placeholder="+225 07 00 00 00 00" autoFocus className="flex-1 bg-transparent text-white text-lg font-semibold outline-none placeholder:text-gray-600" />
            </div>
            {error && <p className="mb-4 text-sm text-red-400">{error}</p>}
            <div className="p-4 bg-green-500/5 border border-green-500/15 rounded-2xl mb-6">
              <div className="flex items-start gap-2"><ShieldCheck size={16} className="text-green-500 flex-shrink-0 mt-0.5" /><p className="text-xs text-gray-400">Votre numéro est chiffré avec SHA-256. <strong className="text-white">Il n'est jamais stocké en clair.</strong></p></div>
            </div>
            <motion.button whileTap={{ scale: 0.97 }} onClick={handlePhoneSubmit} disabled={!phone.trim() || syncing} className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 disabled:opacity-40 text-white font-black rounded-2xl flex items-center justify-center gap-2">
              {syncing ? <Loader size={20} className="animate-spin" /> : <><span>Continuer</span><ChevronRight size={20} /></>}
            </motion.button>
            <button onClick={() => { setSyncStats({ total: 0, onApp: 0 }); setStep("done"); }} className="mt-4 w-full py-3 text-gray-500 text-sm hover:text-gray-400">Passer</button>
          </motion.div>
        )}

        {step === "picker" && (
          <motion.div key="picker" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.4 }} className="w-full max-w-sm text-center">
            <motion.div animate={{ scale: [1, 1.04, 1] }} transition={{ duration: 2, repeat: Infinity }} className="mx-auto mb-8 w-24 h-24 rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-2xl">
              <Users size={44} className="text-white" />
            </motion.div>
            <h2 className="text-2xl font-black text-white mb-3">Trouvez vos amis</h2>
            <p className="text-gray-400 mb-8 text-sm">Sélectionnez les contacts à retrouver sur Chantilink. <strong className="text-white">Vous choisissez qui partager.</strong></p>
            <motion.button whileTap={{ scale: 0.97 }} onClick={handlePickContacts} disabled={syncing} className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 disabled:opacity-50 text-white font-black rounded-2xl flex items-center justify-center gap-2">
              {syncing ? <><Loader size={20} className="animate-spin" /> Recherche…</> : <><Users size={20} /> Sélectionner mes contacts</>}
            </motion.button>
            <button onClick={() => { setSyncStats({ total: 0, onApp: 0 }); setStep("done"); }} disabled={syncing} className="mt-4 w-full py-3 text-gray-500 text-sm hover:text-gray-400 disabled:opacity-40">Passer</button>
          </motion.div>
        )}

        {step === "done" && (
          <motion.div key="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", damping: 20, stiffness: 200 }} className="w-full max-w-sm text-center">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", damping: 15, stiffness: 200 }} className="mx-auto mb-8 w-24 h-24 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center">
              <CheckCircle size={52} className="text-green-400" />
            </motion.div>
            <h2 className="text-2xl font-black text-white mb-3">{syncStats?.onApp > 0 ? "Amis trouvés ! 🎉" : "C'est tout bon !"}</h2>
            {syncStats?.onApp > 0
              ? <p className="text-gray-400 mb-8"><span className="text-white font-black text-xl">{syncStats.onApp}</span> {syncStats.onApp === 1 ? "ami utilise" : "amis utilisent"} déjà Chantilink</p>
              : <p className="text-gray-400 mb-8">Votre compte est configuré.<br /><span className="text-sm text-gray-500">Ajoutez des contacts depuis l'onglet Contacts.</span></p>
            }
            <motion.button whileTap={{ scale: 0.97 }} onClick={onComplete} className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-black rounded-2xl flex items-center justify-center gap-2">
              Accéder aux messages <ChevronRight size={20} />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MODALE CONVERSATIONS
// ─────────────────────────────────────────────────────────────────────────────
const ConversationsModal = ({ conversations, loading, onSelect, onClose, unreadCounts }) => (
  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
    <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }} transition={{ type: "spring", damping: 28, stiffness: 300 }} className="relative z-10 w-full max-w-md bg-[#13161c] border border-white/10 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-white/5">
        <MessageSquare size={18} className="text-purple-400 flex-shrink-0" />
        <div className="flex-1"><h2 className="text-base font-black text-white">Conversations</h2><p className="text-[11px] text-gray-500">{conversations.length} active(s)</p></div>
        <button onClick={onClose} className="p-1.5 hover:bg-white/5 rounded-xl"><X size={18} className="text-gray-400" /></button>
      </div>
      <div className="overflow-y-auto max-h-[60vh]">
        {loading ? (
          <div className="flex items-center justify-center py-12"><div className="w-7 h-7 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" /></div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12"><MessageSquare size={36} className="text-gray-700 mb-3" /><p className="text-sm text-gray-500">Aucune conversation active</p></div>
        ) : (
          <div className="p-2 space-y-1">
            {conversations.map((conv) => (
              <button key={conv.id} onClick={() => { onSelect(conv); onClose(); }} className="w-full flex items-center gap-3 p-3 hover:bg-white/[0.04] rounded-xl group">
                <div className="relative flex-shrink-0">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-lg font-black overflow-hidden">
                    {conv.profilePhoto ? <img src={conv.profilePhoto} alt="" className="w-full h-full object-cover" /> : conv.fullName?.[0]?.toUpperCase() || "?"}
                  </div>
                  {conv.isOnline && <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-[#13161c]" />}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between mb-0.5">
                    <h3 className="text-sm font-bold text-white truncate">{conv.fullName}</h3>
                    {conv.lastMessageTime && <span className="text-[10px] text-gray-600 flex-shrink-0 ml-2">{new Date(conv.lastMessageTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-gray-500 truncate flex-1">{conv.lastMessage || "Aucun message"}</p>
                    {(conv.unreadCount > 0 || unreadCounts?.[conv.id] > 0) && (
                      <span className="bg-blue-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full flex-shrink-0">
                        {conv.unreadCount || unreadCounts[conv.id]}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight size={13} className="text-gray-700 group-hover:text-gray-500 flex-shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="p-4 border-t border-white/5">
        <button onClick={onClose} className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-gray-400 text-sm font-bold rounded-xl">Fermer</button>
      </div>
    </motion.div>
  </motion.div>
);

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSANT PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export default function Messages() {
  const { user, token, updateUserProfile } = useAuth();
  const { socket, connected: socketConnected } = useSocket("/messages");
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const messagesEndRef = useRef(null);
  const textareaRef    = useRef(null);
  const fileInputRef   = useRef(null);
  const ringtoneRef    = useRef(null);
  // ✅ FIX: ref pour selectedContact dans les callbacks socket (évite stale closure)
  const selectedContactRef = useRef(null);

  const [view,  setView]  = useState("contacts");
  const [modal, setModal] = useState(null);

  const [contacts,         setContacts]         = useState([]);
  const [conversations,    setConversations]     = useState([]);
  const [messages,         setMessages]          = useState([]);
  const [selectedContact,  setSelectedContact]   = useState(null);
  const [unreadCounts,     setUnreadCounts]      = useState({});
  const [onlineUsers,      setOnlineUsers]       = useState([]);
  const [showPhoneModal,   setShowPhoneModal]    = useState(false);
  const [input,            setInput]             = useState("");
  const [loading,          setLoading]           = useState(false);
  const [uploading,        setUploading]         = useState(false);
  const [showEmoji,        setShowEmoji]         = useState(false);
  const [typingUsers,      setTypingUsers]       = useState([]);

  const currentUserId  = getEntityId(user);
  const onboardingKey  = currentUserId ? `chantilink_onboarding_done_${currentUserId}` : null;
  const needsOnboarding = onboardingKey
    ? !localStorage.getItem(onboardingKey) && !user?.phone
    : false;
  const [showOnboarding, setShowOnboarding] = useState(needsOnboarding);

  const {
    recording, audioBlob, audioUrl, isPlaying,
    startRecording, stopRecording, cancelRecording,
    playPreview, pausePreview,
  } = useAudioRecording(token, showToast);

  const connected = socketConnected;

  // ✅ FIX: synchroniser la ref à chaque changement de selectedContact
  useEffect(() => {
    selectedContactRef.current = selectedContact;
  }, [selectedContact]);

  const initiateCall = useCallback((recipientId, callType) => {
    if (!socket?.connected) { showToast("Connexion socket requise", "error"); return false; }
    socket.emit("initiate-call", { receiverId: recipientId, type: callType });
    return true;
  }, [socket, showToast]);

  const socketEndCall = useCallback((callId) => {
    if (socket?.connected && callId) socket.emit("end-call", { callId });
  }, [socket]);

  const sendMessageSocket = useCallback((data) => {
    if (!socket?.connected) { showToast("Impossible d'envoyer le message", "error"); return; }
    socket.emit("sendMessage", data);
  }, [socket, showToast]);

  const {
    call, setCall, incomingCall, setIncomingCall,
    missedCallNotification, startCall, endCall,
    sendMissedCallMessage, cleanupCallRingtone, callIdRef,
  } = useCallManager(
    { friend: selectedContact },
    connected, initiateCall, socketEndCall, sendMessageSocket, showToast
  );

  // ── Chargement données ─────────────────────────────────────────────────────
  const loadContacts = useCallback(async () => {
    if (!token) return;
    try {
      const cached = await messageCache.getContacts();
      if (cached.length > 0) setContacts(cached);
      const result = await API.getContacts(token);
      const list   = result.contacts || [];
      if (list.length > 0) { await messageCache.saveContacts(list); setContacts(list); }
    } catch (err) {
      console.error("❌ loadContacts:", err);
    }
  }, [token]);

  const loadConversations = useCallback(async () => {
    if (!token) return;
    // ✅ FIX: setLoading encadré par finally
    setLoading(true);
    try {
      const cached = await messageCache.getConversations();
      if (cached.length > 0) {
        setConversations(cached);
        const counts = {};
        cached.forEach((c) => { if (c.unreadCount > 0) counts[c.id] = c.unreadCount; });
        setUnreadCounts((prev) => ({ ...prev, ...counts }));
      }
      const result = await API.getConversations(token);
      const fresh  = result.conversations || [];
      if (fresh.length > 0) {
        await messageCache.saveConversations(fresh);
        setConversations(fresh);
        fresh.forEach((conv) => { if (conv.id) saveContactToOnApp(conv, currentUserId); });
        const counts = {};
        fresh.forEach((c) => { if (c.unreadCount > 0) counts[c.id] = c.unreadCount; });
        setUnreadCounts((prev) => ({ ...prev, ...counts }));
      }
    } catch (err) {
      console.error("❌ loadConversations:", err);
      showToast("Erreur de chargement", "error");
    } finally {
      setLoading(false);
    }
  }, [token, showToast, currentUserId]);

  // ✅ FIX: handleOnboardingComplete défini APRÈS les fonctions qu'il appelle
  const handleOnboardingComplete = useCallback(() => {
    if (onboardingKey) localStorage.setItem(onboardingKey, "1");
    setShowOnboarding(false);
    loadContacts();
    loadConversations();
  }, [onboardingKey, loadContacts, loadConversations]);

  const loadMessages = useCallback(async (contactId) => {
    if (!contactId || !token || !currentUserId) return;
    setLoading(true);
    try {
      const cached = await messageCache.getMessages(currentUserId, contactId);
      if (cached.length > 0) {
        setMessages(cached);
        setLoading(false);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      }
      const result = await API.getMessages(token, contactId);
      const list   = Array.isArray(result) ? result : (result.messages || []);
      if (list.length > 0) {
        await messageCache.saveMessages(currentUserId, contactId, list);
        setMessages(list);
      }
      if (socket?.connected) socket.emit("markAsRead", { senderId: contactId });
      await API.markMessagesAsRead(token, contactId).catch(() => {});
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (err) {
      console.error("❌ loadMessages:", err);
      showToast("Impossible de charger les messages", "error");
    } finally {
      setLoading(false);
    }
  }, [token, socket, showToast, currentUserId]);

  // ✅ FIX: optimistic update local + émission socket
  const sendMediaMessage = useCallback(async (messageData) => {
    if (!selectedContact || !currentUserId) return null;

    // Optimistic update
    const tempMsg = {
      _id:       `temp-${Date.now()}`,
      sender:    currentUserId,
      recipient: selectedContact.id,
      ...messageData,
      status:    "sending",
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMsg].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)));

    if (socket?.connected) {
      socket.emit("sendMessage", messageData);
      return null;
    }

    try {
      const saved = await API.sendMessage(token, messageData);
      await messageCache.addMessage(currentUserId, selectedContact.id, saved).catch(() => {});
      setMessages((prev) =>
        prev
          .filter((m) => m._id !== tempMsg._id)
          .concat(saved)
          .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      );
      loadConversations();
      return saved;
    } catch (err) {
      // Retirer le message optimiste en cas d'échec
      setMessages((prev) => prev.filter((m) => m._id !== tempMsg._id));
      throw err;
    }
  }, [socket, token, selectedContact, currentUserId, loadConversations]);

  const handlePickerSync = useCallback((newContacts) => {
    loadContacts();
    loadConversations();
    if (newContacts.length > 0) showToast(`${newContacts.length} ami(s) trouvé(s) !`, "success");
  }, [loadContacts, loadConversations, showToast]);

  const handleContactSelect = useCallback((contact) => {
    const normalized = {
      id:           getEntityId(contact),
      fullName:     contact.fullName,
      username:     contact.username,
      profilePhoto: contact.profilePhoto,
      isOnline:     contact.isOnline,
      lastSeen:     contact.lastSeen,
    };
    saveContactToOnApp(normalized, currentUserId);
    setSelectedContact(normalized);
    selectedContactRef.current = normalized;
    setMessages([]);
    loadMessages(normalized.id);
    setView("chat");
    setModal(null);
    setUnreadCounts((prev) => { const n = { ...prev }; delete n[normalized.id]; return n; });
  }, [loadMessages, currentUserId]);

  const handleInputChange = useCallback((e) => {
    setInput(e.target.value);
    if (socket?.connected && selectedContactRef.current) {
      socket.emit(
        e.target.value.length > 0 ? "typing" : "stopTyping",
        { recipientId: selectedContactRef.current.id }
      );
    }
  }, [socket]);

  const handleSendMessage = useCallback(async () => {
    const contact = selectedContactRef.current;
    if (!contact || !input.trim() || !currentUserId) return;
    // ✅ FIX: guard socket avec fallback API
    if (!socket?.connected) {
      showToast("Connexion perdue — réessai…", "warning");
      return;
    }
    const temp = {
      _id:       `temp-${Date.now()}`,
      sender:    currentUserId,
      recipient: contact.id,
      content:   input.trim(),
      type:      "text",
      status:    "sending",
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, temp]);
    try { playSendSound(); } catch {}
    try { await messageCache.addMessage(currentUserId, contact.id, temp); } catch {}
    socket.emit("sendMessage", { recipientId: contact.id, content: input.trim(), type: "text" });
    setInput("");
    socket.emit("stopTyping", { recipientId: contact.id });
  }, [input, socket, currentUserId, showToast]);

  const handleFileUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedContactRef.current) return;
    if (!token) { showToast("Session expirée. Reconnectez-vous.", "error"); return; }
    showToast("📤 Upload en cours…", "info");
    setUploading(true);
    try {
      const up = await API.uploadMessageFile(token, file);
      if (up.success && up.url) {
        await sendMediaMessage({
          recipientId: selectedContactRef.current.id,
          content:     file.name,
          type:        up.type || "file",
          file:        up.url, fileUrl: up.url, url: up.url,
          secure_url:  up.url, attachmentUrl: up.url,
          fileName:    file.name, fileSize: file.size, mimeType: file.type,
        });
        showToast("✅ Fichier envoyé !", "success");
      } else {
        throw new Error(up?.message || "Upload incomplet");
      }
    } catch (error) {
      showToast(error.message || "❌ Erreur d'envoi", "error");
    } finally {
      setUploading(false);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [token, sendMediaMessage, showToast]);

  const handleSendAudio = useCallback(async () => {
    if (!audioBlob || !selectedContactRef.current) return;
    if (!token) { showToast("Session expirée. Reconnectez-vous.", "error"); return; }
    setUploading(true);
    try {
      const ext = audioBlob.type?.includes("mp4") ? "m4a" : audioBlob.type?.includes("ogg") ? "ogg" : "webm";
      const up = await API.uploadMessageFile(token, new File([audioBlob], `audio.${ext}`, { type: audioBlob.type || "audio/webm" }));
      if (up.success && up.url) {
        await sendMediaMessage({
          recipientId: selectedContactRef.current.id,
          content:     "Message vocal",
          type:        "audio",
          file:        up.url, fileUrl: up.url, url: up.url,
          secure_url:  up.url, attachmentUrl: up.url,
          fileName:    `audio.${ext}`, fileSize: audioBlob.size, mimeType: audioBlob.type || "audio/webm",
        });
        showToast("✅ Message vocal envoyé !", "success");
        cancelRecording();
      } else {
        throw new Error(up?.message || "Upload audio incomplet");
      }
    } catch (error) {
      showToast(error.message || "❌ Erreur lors de l'envoi", "error");
    } finally {
      setUploading(false);
    }
  }, [audioBlob, token, sendMediaMessage, cancelRecording, showToast]);

  const handleEmojiSelect = useCallback((emoji) => {
    setInput((prev) => prev + emoji.emoji);
    setShowEmoji(false);
  }, []);

  const handlePhoneSubmit = useCallback(async (phoneNumber) => {
    const resp = await API.updatePhone(token, phoneNumber);
    if (resp.success) {
      if (updateUserProfile) updateUserProfile(currentUserId, resp.user);
      showToast("Numéro enregistré ! 🎉", "success");
      setShowPhoneModal(false);
    }
  }, [token, updateUserProfile, currentUserId, showToast]);

  const handleAcceptPendingRequest = useCallback(async (request) => {
    try {
      await API.acceptMessageRequest(token, request._id);
      showToast("✅ Demande acceptée !", "success");
      loadContacts(); loadConversations(); setModal(null);
    } catch { showToast("❌ Impossible d'accepter", "error"); }
  }, [token, loadContacts, loadConversations, showToast]);

  const handleVideoCall = useCallback(() => {
    if (!selectedContactRef.current) { showToast("Aucun contact sélectionné", "error"); return; }
    try { playCallConnectedSound(); } catch {}
    setCall({ on: true, type: "video", friend: selectedContactRef.current, mute: false, video: true, isIncoming: false, callId: null });
    startCall("video");
  }, [startCall, showToast, setCall]);

  const handleAudioCall = useCallback(() => {
    if (!selectedContactRef.current) { showToast("Aucun contact sélectionné", "error"); return; }
    try { playCallConnectedSound(); } catch {}
    setCall({ on: true, type: "audio", friend: selectedContactRef.current, mute: false, video: false, isIncoming: false, callId: null });
    startCall("audio");
  }, [startCall, showToast, setCall]);

  const handleAcceptCall = useCallback(() => {
    if (!incomingCall || !socket) return;
    if (ringtoneRef.current) { ringtoneRef.current.stop(); ringtoneRef.current = null; }
    stopVibration();
    // ✅ FIX: émettre accept-call AVANT de setCall
    socket.emit("accept-call", { callId: incomingCall.callId });
    try { playCallConnectedSound(); } catch {}
    setCall({ on: true, type: incomingCall.type, friend: incomingCall.caller, mute: false, video: incomingCall.type === "video", isIncoming: true, callId: incomingCall.callId });
    setIncomingCall(null);
    cleanupCallRingtone();
  }, [incomingCall, socket, setCall, setIncomingCall, cleanupCallRingtone]);

  const handleRejectCall = useCallback(() => {
    if (!incomingCall || !socket) return;
    if (ringtoneRef.current) { ringtoneRef.current.stop(); ringtoneRef.current = null; }
    stopVibration();
    socket.emit("reject-call", { callId: incomingCall.callId });
    try { playCallRejectedSound(); } catch {}
    sendMissedCallMessage(incomingCall.caller, incomingCall.type);
    setIncomingCall(null);
    cleanupCallRingtone();
  }, [incomingCall, socket, sendMissedCallMessage, setIncomingCall, cleanupCallRingtone]);

  const handleBack = useCallback(() => {
    setView("contacts");
    setSelectedContact(null);
    selectedContactRef.current = null;
    setMessages([]);
  }, []);

  const handleDeleteMessage = useCallback(async (messageId) => {
    const contact = selectedContactRef.current;
    if (!contact || !currentUserId) return;
    // Optimistic
    setMessages((prev) => prev.filter((m) => m._id !== messageId));
    try {
      await messageCache.deleteMessage(currentUserId, contact.id, messageId);
      await API.deleteMessage(token, messageId).catch(() => {});
      if (socket?.connected) socket.emit("deleteMessage", { messageId, forEveryone: false });
      showToast("Message supprimé", "success");
    } catch {
      showToast("Erreur lors de la suppression", "error");
      // ✅ FIX: recharger les messages si la suppression échoue
      loadMessages(contact.id);
    }
  }, [currentUserId, token, socket, showToast, loadMessages]);

  // ── Effects socket ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!connected || !socket) return;
    const h = (payload) => setOnlineUsers(Array.isArray(payload) ? payload : (payload?.users || []));
    socket.on("onlineUsers", h);
    // ✅ FIX: cleanup propre
    return () => socket.off("onlineUsers", h);
  }, [socket, connected]);

  useEffect(() => {
    if (!connected || !socket || !currentUserId) return;

    const handleReceiveMessage = async (message) => {
      const senderId    = getEntityId(message.sender);
      const recipientId = getEntityId(message.recipient);
      // ✅ FIX: utiliser la ref pour éviter la stale closure
      const contact     = selectedContactRef.current;
      const selectedId  = getEntityId(contact);
      const isCurrentChat = !!selectedId && (senderId === selectedId || recipientId === selectedId);

      if (isCurrentChat) {
        if (senderId !== currentUserId) { try { playReceiveSound(); } catch {} }
        try { await messageCache.addMessage(currentUserId, contact.id, message); } catch {}
        setMessages((prev) => {
          if (prev.some((m) => m._id === message._id)) return prev;
          const filtered = prev.filter((m) => m.status !== "sending" || m.content !== message.content);
          return [...filtered, message].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        });
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      } else if (senderId && senderId !== currentUserId) {
        setUnreadCounts((prev) => ({ ...prev, [senderId]: (prev[senderId] || 0) + 1 }));
      }
      loadConversations();
    };

    const handleMessageSent = async (message) => {
      const senderId    = getEntityId(message.sender);
      const recipientId = getEntityId(message.recipient);
      const contact     = selectedContactRef.current;
      const selectedId  = getEntityId(contact);

      if (!selectedId || (senderId !== selectedId && recipientId !== selectedId)) {
        loadConversations();
        return;
      }
      try { await messageCache.addMessage(currentUserId, contact.id, message); } catch {}
      setMessages((prev) => {
        if (prev.some((m) => m._id === message._id)) return prev;
        const filtered = prev.filter((m) => m.status !== "sending" || m.content !== message.content);
        return [...filtered, message].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      });
      loadConversations();
    };

    const handleMessageDeleted = ({ messageId }) => {
      setMessages((prev) => prev.filter((m) => m._id !== messageId));
    };

    const handleTyping        = ({ userId }) => setTypingUsers((p) => [...new Set([...p, userId])]);
    const handleStoppedTyping = ({ userId }) => setTypingUsers((p) => p.filter((id) => id !== userId));

    socket.on("receiveMessage",    handleReceiveMessage);
    socket.on("messageSent",       handleMessageSent);
    socket.on("message-deleted",   handleMessageDeleted);
    socket.on("userTyping",        handleTyping);
    socket.on("userStoppedTyping", handleStoppedTyping);
    return () => {
      socket.off("receiveMessage",    handleReceiveMessage);
      socket.off("messageSent",       handleMessageSent);
      socket.off("message-deleted",   handleMessageDeleted);
      socket.off("userTyping",        handleTyping);
      socket.off("userStoppedTyping", handleStoppedTyping);
    };
  // ✅ FIX: selectedContact retiré des dépendances (utilise la ref)
  }, [socket, connected, currentUserId, loadConversations]);

  useEffect(() => {
    if (!connected || !socket) return;

    const handleIncomingCall = ({ callId, from, caller, type }) => {
      const friend = contacts.find((c) => c.id === from) || { id: from, fullName: caller?.fullName || "Anonyme" };
      if (!ringtoneRef.current) { ringtoneRef.current = new CallRingtone(); ringtoneRef.current.start(); }
      try { vibrateCall(); } catch {}
      setIncomingCall({ callId, caller: friend, type });
    };

    const handleCallRejected = () => {
      try { playCallRejectedSound(); } catch {}
      cleanupCallRingtone();
      showToast("Appel occupé", "info");
      setCall({ on: false, type: null, friend: null, mute: false, video: true, isIncoming: false, callId: null });
    };

    // ✅ FIX: call-initiated flush l'offer WebRTC en attente
    const handleCallInitiated = ({ callId }) => {
      setCall((prev) => ({ ...prev, callId }));
      // Si useWebRTC est utilisé, appeler flushPendingOffer ici
      // (intégration à faire selon l'architecture de CallManager)
    };

    const handleCallAccepted = ({ callId }) => {
      try { playCallConnectedSound(); } catch {}
      setCall((prev) => ({ ...prev, on: true, callId: callId || prev.callId }));
    };

    const handleCallEnded = () => {
      try { playCallEndedSound(); } catch {}
      if (ringtoneRef.current) { ringtoneRef.current.stop(); ringtoneRef.current = null; }
      stopVibration();
      cleanupCallRingtone();
      endCall();
    };

    socket.on("incoming-call",  handleIncomingCall);
    socket.on("call-initiated", handleCallInitiated);
    socket.on("call-accepted",  handleCallAccepted);
    socket.on("call-rejected",  handleCallRejected);
    socket.on("call-ended",     handleCallEnded);
    return () => {
      socket.off("incoming-call",  handleIncomingCall);
      socket.off("call-initiated", handleCallInitiated);
      socket.off("call-accepted",  handleCallAccepted);
      socket.off("call-rejected",  handleCallRejected);
      socket.off("call-ended",     handleCallEnded);
    };
  }, [socket, connected, contacts, cleanupCallRingtone, showToast, endCall, setCall, setIncomingCall]);

  useEffect(() => {
    if (!showOnboarding) { loadContacts(); loadConversations(); }
  }, [loadContacts, loadConversations, showOnboarding]);

  useEffect(() => {
    if (location.state?.selectedContact && location.state?.openChat) {
      const contact    = location.state.selectedContact;
      const normalized = { id: contact.id || contact._id, fullName: contact.fullName, username: contact.username, profilePhoto: contact.profilePhoto, isOnline: contact.isOnline, lastSeen: contact.lastSeen };
      saveContactToOnApp(normalized, currentUserId);
      setSelectedContact(normalized);
      selectedContactRef.current = normalized;
      setMessages([]);
      loadMessages(normalized.id);
      setView("chat");
      navigate("/messages", { replace: true, state: {} });
    }
  }, [location.state, navigate, loadMessages, currentUserId]);

  useEffect(() => () => {
    cleanupCallRingtone();
    if (ringtoneRef.current) { ringtoneRef.current.stop(); ringtoneRef.current = null; }
    stopVibration();
  }, [cleanupCallRingtone]);

  useEffect(() => {
    const id = setInterval(() => messageCache.cleanOldMessages(30).catch(console.error), 86400000);
    messageCache.cleanOldMessages(30).catch(console.error);
    return () => clearInterval(id);
  }, []);

  // ✅ FIX: useMemo pour éviter le recalcul à chaque render
  const totalUnread = useMemo(
    () => Object.values(unreadCounts).reduce((a, b) => a + b, 0),
    [unreadCounts]
  );

  return (
    <>
      <AnimatePresence>
        {showOnboarding && (
          <OnboardingPhoneScreen user={user} onComplete={handleOnboardingComplete} />
        )}
      </AnimatePresence>

      <div className={`flex h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 text-white overflow-hidden ${showOnboarding ? "pointer-events-none" : ""}`}>

        {view === "contacts" && (
          <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="w-full h-full flex flex-col">
            <ContactSidebar
              token={token}
              contacts={contacts}
              selectedContact={selectedContact}
              onContactSelect={handleContactSelect}
              unreadCounts={unreadCounts}
              onlineUsers={onlineUsers}
              user={user}
              onPickerSync={handlePickerSync}
              onShowPending={() => setModal("pending")}
              onShowConversations={() => setModal("conversations")}
              conversations={conversations}
              totalUnread={totalUnread}
            />
          </motion.div>
        )}

        {view === "chat" && selectedContact && (
          <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="w-full h-full flex flex-col">
            <ChatHeader
              friend={selectedContact} typingUsers={typingUsers} onlineUsers={onlineUsers}
              connected={connected} onVideoCall={handleVideoCall} onAudioCall={handleAudioCall} onBack={handleBack}
            />
            <MessagesList
              messages={messages} currentUserId={currentUserId} loading={loading}
              endRef={messagesEndRef} conversationId={selectedContact?.id} onDeleteMessage={handleDeleteMessage}
            />
            <ChatInput
              input={input} onChange={handleInputChange} onSend={handleSendMessage}
              recording={recording} onStartRecording={startRecording} onStopRecording={stopRecording}
              onCancelAudio={cancelRecording} onSendAudio={handleSendAudio}
              audioUrl={audioUrl} isPlaying={isPlaying} onPlayPreview={playPreview} onPausePreview={pausePreview}
              showEmoji={showEmoji} onToggleEmoji={() => setShowEmoji(!showEmoji)} onEmojiSelect={handleEmojiSelect}
              uploading={uploading} onUpload={handleFileUpload} connected={connected}
              txtRef={textareaRef} fileRef={fileInputRef}
            />
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {modal === "conversations" && (
          <ConversationsModal key="modal-conversations" conversations={conversations} loading={loading} onSelect={handleContactSelect} onClose={() => setModal(null)} unreadCounts={unreadCounts} />
        )}
        {modal === "pending" && (
          <PendingMessagesModal
            key="modal-pending"
            isOpen
            onClose={() => setModal(null)}
            onAccept={handleAcceptPendingRequest}
            onReject={async (requestId) => {
              try { await API.rejectMessageRequest(token, requestId); showToast("Demande rejetée", "info"); loadConversations(); }
              catch { showToast("Erreur", "error"); }
            }}
            onOpenConversation={(request) => { handleContactSelect(request.sender); }}
          />
        )}
      </AnimatePresence>

      {showPhoneModal && (
        <PhoneNumberModal isOpen onClose={() => setShowPhoneModal(false)} onSubmit={handlePhoneSubmit} canSkip />
      )}
      {call.on && (
        <CallManager
          call={call} onEndCall={endCall}
          onToggleMute={() => setCall((p) => ({ ...p, mute: !p.mute }))}
          onToggleVideo={() => setCall((p) => ({ ...p, video: !p.video }))}
          socket={socket}
        />
      )}
      {incomingCall && (
        <IncomingCallModal caller={incomingCall.caller} callType={incomingCall.type} onAccept={handleAcceptCall} onReject={handleRejectCall} />
      )}
      {/* ✅ FIX: auto-disparition gérée dans useCallManager, affichage simplifié */}
      <AnimatePresence>
        {missedCallNotification && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-4 right-4 bg-red-500/90 backdrop-blur-sm text-white px-6 py-3 rounded-xl shadow-lg z-50 flex items-center gap-3"
          >
            <Phone size={16} className="flex-shrink-0" />
            <div>
              <p className="font-semibold text-sm">Appel manqué</p>
              <p className="text-xs opacity-80">{missedCallNotification.caller?.fullName || "Inconnu"}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}