// ============================================
// 📁 src/Pages/chat/Messages.jsx  v2
// ─ Sonnerie appelant + appelé + notification onglet arrière-plan
// ─ Timeout 30 s avec appel manqué automatique
// ─ Bouton "Appels manqués" remplace "Conversations"
// ─ ContactSidebar style WhatsApp (pas de doublons)
// ─ Suppression contact réelle (DELETE API)
// ─ Ajout contact : répertoire OU manuel
// ─ Envoi/réception fichiers robuste (image, audio, video, doc)
// ─ selectedContact via ref pour éviter les stale closures
// ============================================
import React, {
  useState, useEffect, useRef, useCallback, useMemo,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useLocation }  from "react-router-dom";
import {
  CheckCircle, Shield, ShieldCheck,
  Phone, Video, ChevronRight, Loader, UserPlus, MessageSquare,
} from "lucide-react";

import { useAuth }   from "../../context/AuthContext";
import { useSocket } from "../../context/SocketContext";
import { useToast }  from "../../context/ToastContext";
import { API }       from "../../services/apiService";
import { saveContactToOnApp } from "../../utils/contactsCache";
import messageCache  from "../../utils/messageCache";

import IncomingCallModal   from "../../components/IncomingCallModal";
import MissedCallsModal    from "./components/MissedCallsModal";
import CallManager         from "../../components/CallManager";
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
  CallerRingtone,
  vibrateCall,
  stopVibration,
  startTabCallAlert,
  stopTabCallAlert,
} from "../../utils/callSounds";

const getEntityId = (v) => {
  if (!v) return "";
  if (typeof v === "object") return String(v._id || v.id || "");
  return String(v);
};

const openContactPicker = async () => {
  try {
    if (!("contacts" in navigator && "ContactsManager" in window)) return [];
    const raw = await navigator.contacts.select(["name", "tel"], { multiple: true });
    return raw.flatMap((c) =>
      (c.tel || []).map((phone) => ({ name: c.name?.[0] || "Inconnu", phone }))
    );
  } catch (err) { console.info("Picker:", err.message); return []; }
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
  const userId = getEntityId(user);

  const fmt = (v) => {
    let c = v.replace(/[^\d+]/g, "");
    if (!c.startsWith("+") && c.length > 0) c = "+225" + c.replace(/^0/, "");
    return c;
  };

  const handlePhone = async () => {
    const f = fmt(phone);
    if (f.replace(/\D/g, "").length < 10) { setError("Numéro invalide"); return; }
    setSyncing(true);
    try {
      const r = await API.updatePhone(token, f);
      if (!r.success) throw new Error(r.message);
      if (updateUserProfile) updateUserProfile(user.id || user._id, r.user);
      setStep("picker");
    } catch (e) { setError(e.message || "Erreur"); }
    finally { setSyncing(false); }
  };

  const handlePick = async () => {
    setSyncing(true);
    try {
      const picked = await openContactPicker();
      if (!picked.length) { setSyncStats({ total: 0, onApp: 0 }); setStep("done"); return; }
      const r = await API.syncContacts(token, picked);
      const stats = { total: picked.length, onApp: r.stats?.onApp || r.onChantilink?.length || 0 };
      (r.onChantilink || []).forEach((c) => saveContactToOnApp(c, userId));
      setSyncStats(stats);
      setStep("done");
    } catch { setSyncStats({ total: 0, onApp: 0 }); setStep("done"); }
    finally { setSyncing(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-gray-950 via-blue-950 to-gray-950 flex items-center justify-center p-4">
      <AnimatePresence mode="wait">
        {step === "intro" && (
          <motion.div key="intro" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="w-full max-w-sm text-center">
            <motion.div animate={{ scale: [1, 1.06, 1] }} transition={{ duration: 2.5, repeat: Infinity }} className="mx-auto mb-8 w-24 h-24 rounded-3xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-2xl shadow-blue-900/50">
              <MessageSquare size={44} className="text-white" />
            </motion.div>
            <h1 className="text-3xl font-black text-white mb-3">Restez connecté<br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">avec vos proches</span></h1>
            <p className="text-gray-400 mb-10">Trouvez vos amis sur Chantilink en sélectionnant vos contacts depuis votre téléphone.</p>
            <div className="space-y-3 mb-10 text-left">
              {[
                { icon: <UserPlus size={18}/>, color: "blue",   title: "Vous choisissez",       desc: "Sélectionnez uniquement les contacts que vous voulez" },
                { icon: <Shield   size={18}/>, color: "green",  title: "Chiffrement SHA-256",    desc: "Vos numéros ne sont jamais stockés en clair" },
                { icon: <MessageSquare size={18}/>, color: "purple", title: "Messagerie sécurisée", desc: "Discussions privées de bout en bout" },
              ].map((f, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.1 }} className="flex items-center gap-3 p-3 bg-white/5 rounded-2xl border border-white/5">
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
          <motion.div key="phone" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="w-full max-w-sm">
            <div className="mb-8">
              <div className="w-16 h-16 rounded-2xl bg-blue-600/20 flex items-center justify-center mb-6"><Phone size={30} className="text-blue-400"/></div>
              <h2 className="text-2xl font-black text-white mb-2">Votre numéro</h2>
              <p className="text-gray-400 text-sm">Entrez votre numéro pour être trouvable par vos contacts.</p>
            </div>
            <div className={`flex items-center gap-3 p-4 rounded-2xl border-2 bg-white/5 mb-4 ${error ? "border-red-500/60" : "border-white/10 focus-within:border-blue-500/60"}`}>
              <span className="text-2xl">🇨🇮</span>
              <input type="tel" value={phone} onChange={(e) => { setPhone(e.target.value); setError(""); }} onKeyDown={(e) => e.key === "Enter" && handlePhone()} placeholder="+225 07 00 00 00 00" autoFocus className="flex-1 bg-transparent text-white text-lg font-semibold outline-none placeholder:text-gray-600"/>
            </div>
            {error && <p className="mb-4 text-sm text-red-400">{error}</p>}
            <div className="p-4 bg-green-500/5 border border-green-500/15 rounded-2xl mb-6">
              <div className="flex items-start gap-2"><ShieldCheck size={16} className="text-green-500 flex-shrink-0 mt-0.5"/><p className="text-xs text-gray-400">Votre numéro est chiffré avec SHA-256. <strong className="text-white">Jamais stocké en clair.</strong></p></div>
            </div>
            <motion.button whileTap={{ scale: 0.97 }} onClick={handlePhone} disabled={!phone.trim() || syncing} className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 disabled:opacity-40 text-white font-black rounded-2xl flex items-center justify-center gap-2">
              {syncing ? <Loader size={20} className="animate-spin"/> : <><span>Continuer</span><ChevronRight size={20}/></>}
            </motion.button>
            <button onClick={() => { setSyncStats({ total: 0, onApp: 0 }); setStep("done"); }} className="mt-4 w-full py-3 text-gray-500 text-sm hover:text-gray-400">Passer</button>
          </motion.div>
        )}

        {step === "picker" && (
          <motion.div key="picker" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="w-full max-w-sm text-center">
            <motion.div animate={{ scale: [1, 1.04, 1] }} transition={{ duration: 2, repeat: Infinity }} className="mx-auto mb-8 w-24 h-24 rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-2xl">
              <UserPlus size={44} className="text-white"/>
            </motion.div>
            <h2 className="text-2xl font-black text-white mb-3">Trouvez vos amis</h2>
            <p className="text-gray-400 mb-8 text-sm">Sélectionnez les contacts à retrouver sur Chantilink.</p>
            <motion.button whileTap={{ scale: 0.97 }} onClick={handlePick} disabled={syncing} className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 disabled:opacity-50 text-white font-black rounded-2xl flex items-center justify-center gap-2">
              {syncing ? <><Loader size={20} className="animate-spin"/> Recherche…</> : <><UserPlus size={20}/> Sélectionner mes contacts</>}
            </motion.button>
            <button onClick={() => { setSyncStats({ total: 0, onApp: 0 }); setStep("done"); }} disabled={syncing} className="mt-4 w-full py-3 text-gray-500 text-sm hover:text-gray-400 disabled:opacity-40">Passer</button>
          </motion.div>
        )}

        {step === "done" && (
          <motion.div key="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", damping: 20 }} className="w-full max-w-sm text-center">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", damping: 15 }} className="mx-auto mb-8 w-24 h-24 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center">
              <CheckCircle size={52} className="text-green-400"/>
            </motion.div>
            <h2 className="text-2xl font-black text-white mb-3">{syncStats?.onApp > 0 ? "Amis trouvés ! 🎉" : "C'est tout bon !"}</h2>
            {syncStats?.onApp > 0
              ? <p className="text-gray-400 mb-8"><span className="text-white font-black text-xl">{syncStats.onApp}</span> ami(s) utilisent Chantilink</p>
              : <p className="text-gray-400 mb-8 text-sm">Compte configuré. Ajoutez des contacts depuis la liste.</p>
            }
            <motion.button whileTap={{ scale: 0.97 }} onClick={onComplete} className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-black rounded-2xl flex items-center justify-center gap-2">
              Accéder aux messages <ChevronRight size={20}/>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSANT PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export default function Messages() {
  const { user, token, updateUserProfile } = useAuth();
  const { socket, connected }              = useSocket("/messages");
  const { showToast }                      = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const messagesEndRef    = useRef(null);
  const textareaRef       = useRef(null);
  const fileInputRef      = useRef(null);
  const ringtoneRef       = useRef(null);   // sonnerie appelé (CallRingtone)
  const selectedContactRef = useRef(null);  // ref anti-stale-closure

  const [view,  setView]  = useState("contacts");
  const [modal, setModal] = useState(null); // null | 'pending' | 'missed'

  const [contacts,      setContacts]      = useState([]);
  const [conversations, setConversations] = useState([]);
  const [messages,      setMessages]      = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [unreadCounts,  setUnreadCounts]  = useState({});
  const [onlineUsers,   setOnlineUsers]   = useState([]);
  const [input,         setInput]         = useState("");
  const [loading,       setLoading]       = useState(false);
  const [uploading,     setUploading]     = useState(false);
  const [showEmoji,     setShowEmoji]     = useState(false);
  const [typingUsers,   setTypingUsers]   = useState([]);
  const [showPhoneModal, setShowPhoneModal] = useState(false);

  const currentUserId = getEntityId(user);
  const onboardingKey = currentUserId ? `chantilink_onboarding_done_${currentUserId}` : null;
  const needsOnboarding = onboardingKey && !localStorage.getItem(onboardingKey) && !user?.phone;
  const [showOnboarding, setShowOnboarding] = useState(needsOnboarding);

  const { recording, audioBlob, audioUrl, isPlaying, startRecording, stopRecording, cancelRecording, playPreview, pausePreview } = useAudioRecording(token, showToast);

  // ── Sync selectedContact → ref ──────────────────────────────────────────
  useEffect(() => { selectedContactRef.current = selectedContact; }, [selectedContact]);

  // ── Socket callbacks ──────────────────────────────────────────────────────
  const initiateCall = useCallback((recipientId, callType) => {
    if (!socket?.connected) { showToast("Connexion socket requise", "error"); return false; }
    socket.emit("initiate-call", { receiverId: recipientId, type: callType });
    return true;
  }, [socket, showToast]);

  const socketEndCall = useCallback((callId) => {
    if (socket?.connected && callId) socket.emit("end-call", { callId });
  }, [socket]);

  const sendMessageSocket = useCallback((data) => {
    if (!socket?.connected) { showToast("Connexion perdue", "error"); return; }
    socket.emit("sendMessage", data);
  }, [socket, showToast]);

  const {
    call, setCall, callIdRef,
    incomingCall, setIncomingCall,
    missedCalls, missedCallNotification,
    startCall, onCallAccepted, endCall,
    sendMissedCallMessage, addMissedCall,
    dismissMissedCall, clearAllMissedCalls,
    cleanupCallRingtone,
  } = useCallManager({ friend: selectedContact }, connected, initiateCall, socketEndCall, sendMessageSocket, showToast);

  const missedCallsCount = missedCalls.length;

  // ── Chargement ────────────────────────────────────────────────────────────
  const loadContacts = useCallback(async () => {
    if (!token) return;
    try {
      const cached = await messageCache.getContacts();
      if (cached.length > 0) setContacts(cached);
      const result = await API.getContacts(token);
      const list   = result.contacts || [];
      if (list.length > 0) { await messageCache.saveContacts(list); setContacts(list); }
    } catch (e) { console.error("loadContacts:", e); }
  }, [token]);

  const loadConversations = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const cached = await messageCache.getConversations();
      if (cached.length > 0) {
        setConversations(cached);
        const counts = {};
        cached.forEach((c) => { if (c.unreadCount > 0) counts[c.id] = c.unreadCount; });
        setUnreadCounts((p) => ({ ...p, ...counts }));
      }
      const result = await API.getConversations(token);
      const fresh  = result.conversations || [];
      if (fresh.length > 0) {
        await messageCache.saveConversations(fresh);
        setConversations(fresh);
        fresh.forEach((c) => { if (c.id) saveContactToOnApp(c, currentUserId); });
        const counts = {};
        fresh.forEach((c) => { if (c.unreadCount > 0) counts[c.id] = c.unreadCount; });
        setUnreadCounts((p) => ({ ...p, ...counts }));
      }
    } catch (e) { console.error("loadConversations:", e); showToast("Erreur de chargement", "error"); }
    finally { setLoading(false); }
  }, [token, showToast, currentUserId]);

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
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
      }
      const result = await API.getMessages(token, contactId);
      const list   = Array.isArray(result) ? result : (result.messages || []);
      if (list.length > 0) { await messageCache.saveMessages(currentUserId, contactId, list); setMessages(list); }
      if (socket?.connected) socket.emit("markAsRead", { senderId: contactId });
      await API.markMessagesAsRead(token, contactId).catch(() => {});
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
    } catch (e) { showToast("Impossible de charger les messages", "error"); }
    finally { setLoading(false); }
  }, [token, socket, showToast, currentUserId]);

  // ── Envoi fichier / audio : optimistic + robuste ────────────────────────
  const sendMediaMessage = useCallback(async (messageData) => {
    const contact = selectedContactRef.current;
    if (!contact || !currentUserId) return null;
    const tempId = `temp-${Date.now()}`;
    const tempMsg = { _id: tempId, sender: currentUserId, recipient: contact.id, ...messageData, status: "sending", timestamp: new Date().toISOString() };
    setMessages((p) => [...p, tempMsg].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)));

    if (socket?.connected) {
      socket.emit("sendMessage", messageData);
      return null;
    }
    try {
      const saved = await API.sendMessage(token, messageData);
      await messageCache.addMessage(currentUserId, contact.id, saved).catch(() => {});
      setMessages((p) => p.filter((m) => m._id !== tempId).concat(saved).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)));
      loadConversations();
      return saved;
    } catch (err) {
      setMessages((p) => p.filter((m) => m._id !== tempId));
      throw err;
    }
  }, [socket, token, currentUserId, loadConversations]);

  const handlePickerSync = useCallback((found) => {
    loadContacts(); loadConversations();
    if (found.length > 0) showToast(`${found.length} ami(s) trouvé(s) !`, "success");
  }, [loadContacts, loadConversations, showToast]);

  const handleContactSelect = useCallback((contact) => {
    const norm = { id: getEntityId(contact), fullName: contact.fullName, username: contact.username, profilePhoto: contact.profilePhoto, isOnline: contact.isOnline, lastSeen: contact.lastSeen };
    saveContactToOnApp(norm, currentUserId);
    setSelectedContact(norm);
    selectedContactRef.current = norm;
    setMessages([]);
    loadMessages(norm.id);
    setView("chat");
    setModal(null);
    setUnreadCounts((p) => { const n = { ...p }; delete n[norm.id]; return n; });
  }, [loadMessages, currentUserId]);

  const handleSendMessage = useCallback(async () => {
    const contact = selectedContactRef.current;
    if (!contact || !input.trim() || !currentUserId) return;
    if (!socket?.connected) { showToast("Connexion perdue", "warning"); return; }
    const temp = { _id: `temp-${Date.now()}`, sender: currentUserId, recipient: contact.id, content: input.trim(), type: "text", status: "sending", timestamp: new Date().toISOString() };
    setMessages((p) => [...p, temp]);
    try { playSendSound(); } catch {}
    try { await messageCache.addMessage(currentUserId, contact.id, temp); } catch {}
    socket.emit("sendMessage", { recipientId: contact.id, content: input.trim(), type: "text" });
    setInput("");
    socket.emit("stopTyping", { recipientId: contact.id });
  }, [input, socket, currentUserId, showToast]);

  const handleInputChange = useCallback((e) => {
    setInput(e.target.value);
    const c = selectedContactRef.current;
    if (socket?.connected && c) {
      socket.emit(e.target.value.length > 0 ? "typing" : "stopTyping", { recipientId: c.id });
    }
  }, [socket]);

  // ─── Upload fichier amélioré ──────────────────────────────────────────────
  const handleFileUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    const contact = selectedContactRef.current;
    if (!file || !contact || !token) { if (!token) showToast("Session expirée", "error"); return; }

    // Vérifications taille
    const maxMb = file.type.startsWith("video/") ? 100 : file.type.startsWith("audio/") ? 25 : 20;
    if (file.size > maxMb * 1024 * 1024) {
      showToast(`Fichier trop volumineux (max ${maxMb} Mo)`, "error");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    showToast("📤 Envoi en cours…", "info");
    setUploading(true);
    try {
      const up = await API.uploadMessageFile(token, file);
      if (!up.success || !up.url) throw new Error(up?.message || "Upload incomplet");

      // Déterminer type
      let msgType = "file";
      if (file.type.startsWith("image/")) msgType = "image";
      else if (file.type.startsWith("audio/")) msgType = "audio";
      else if (file.type.startsWith("video/")) msgType = "video";

      await sendMediaMessage({
        recipientId:  contact.id,
        content:      file.name,
        type:         msgType,
        file:         up.url, fileUrl: up.url, url: up.url,
        secure_url:   up.url, attachmentUrl: up.url,
        fileName:     file.name, fileSize: file.size, mimeType: file.type,
      });
      showToast("✅ Fichier envoyé !", "success");
    } catch (err) {
      showToast(err.message || "❌ Erreur d'envoi", "error");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [token, sendMediaMessage, showToast]);

  const handleSendAudio = useCallback(async () => {
    const contact = selectedContactRef.current;
    if (!audioBlob || !contact || !token) return;
    setUploading(true);
    try {
      const ext = audioBlob.type?.includes("mp4") ? "m4a" : audioBlob.type?.includes("ogg") ? "ogg" : "webm";
      const up  = await API.uploadMessageFile(token, new File([audioBlob], `audio.${ext}`, { type: audioBlob.type || "audio/webm" }));
      if (!up.success || !up.url) throw new Error(up?.message || "Upload audio incomplet");
      await sendMediaMessage({ recipientId: contact.id, content: "Message vocal", type: "audio", file: up.url, fileUrl: up.url, url: up.url, secure_url: up.url, attachmentUrl: up.url, fileName: `audio.${ext}`, fileSize: audioBlob.size, mimeType: audioBlob.type || "audio/webm" });
      showToast("✅ Message vocal envoyé !", "success");
      cancelRecording();
    } catch (e) {
      showToast(e.message || "❌ Erreur envoi vocal", "error");
    } finally {
      setUploading(false);
    }
  }, [audioBlob, token, sendMediaMessage, cancelRecording, showToast]);

  const handleEmojiSelect = useCallback((emoji) => { setInput((p) => p + emoji.emoji); setShowEmoji(false); }, []);

  // ─── Appels ───────────────────────────────────────────────────────────────
  const handleVideoCall = useCallback(() => {
    const c = selectedContactRef.current;
    if (!c) { showToast("Aucun contact sélectionné", "error"); return; }
    setCall({ on: true, type: "video", friend: c, mute: false, video: true, isIncoming: false, callId: null });
    startCall("video");
  }, [startCall, showToast, setCall]);

  const handleAudioCall = useCallback(() => {
    const c = selectedContactRef.current;
    if (!c) { showToast("Aucun contact sélectionné", "error"); return; }
    setCall({ on: true, type: "audio", friend: c, mute: false, video: false, isIncoming: false, callId: null });
    startCall("audio");
  }, [startCall, showToast, setCall]);

  const handleAcceptCall = useCallback(() => {
    if (!incomingCall || !socket) return;
    ringtoneRef.current?.stop(); ringtoneRef.current = null;
    stopVibration(); stopTabCallAlert();
    socket.emit("accept-call", { callId: incomingCall.callId });
    try { playCallConnectedSound(); } catch {}
    setCall({ on: true, type: incomingCall.type, friend: incomingCall.friend, mute: false, video: incomingCall.type === "video", isIncoming: true, callId: incomingCall.callId });
    setIncomingCall(null);
    cleanupCallRingtone();
  }, [incomingCall, socket, setCall, setIncomingCall, cleanupCallRingtone]);

  const handleRejectCall = useCallback(() => {
    if (!incomingCall || !socket) return;
    ringtoneRef.current?.stop(); ringtoneRef.current = null;
    stopVibration(); stopTabCallAlert();
    socket.emit("reject-call", { callId: incomingCall.callId });
    try { playCallRejectedSound(); } catch {}
    sendMissedCallMessage(incomingCall.friend, incomingCall.type);
    setIncomingCall(null);
    cleanupCallRingtone();
  }, [incomingCall, socket, sendMissedCallMessage, setIncomingCall, cleanupCallRingtone]);

  // Rappeler depuis la liste des appels manqués
  const handleCallback = useCallback((friend, callType) => {
    if (!friend) return;
    handleContactSelect(friend);
    setTimeout(() => {
      if (callType === "video") handleVideoCall();
      else handleAudioCall();
    }, 400);
    setModal(null);
  }, [handleContactSelect, handleVideoCall, handleAudioCall]);

  const handleBack = useCallback(() => { setView("contacts"); setSelectedContact(null); selectedContactRef.current = null; setMessages([]); }, []);

  const handleDeleteMessage = useCallback(async (messageId) => {
    const c = selectedContactRef.current;
    if (!c || !currentUserId) return;
    setMessages((p) => p.filter((m) => m._id !== messageId));
    try {
      await messageCache.deleteMessage(currentUserId, c.id, messageId);
      await API.deleteMessage(token, messageId).catch(() => {});
      if (socket?.connected) socket.emit("deleteMessage", { messageId, forEveryone: false });
      showToast("Message supprimé", "success");
    } catch { showToast("Erreur suppression", "error"); loadMessages(c.id); }
  }, [currentUserId, token, socket, showToast, loadMessages]);

  // ─── Effects socket ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!connected || !socket) return;
    const h = (p) => setOnlineUsers(Array.isArray(p) ? p : (p?.users || []));
    socket.on("onlineUsers", h);
    return () => socket.off("onlineUsers", h);
  }, [socket, connected]);

  useEffect(() => {
    if (!connected || !socket || !currentUserId) return;

    const handleReceive = async (message) => {
      const senderId   = getEntityId(message.sender);
      const contact    = selectedContactRef.current;
      const selectedId = getEntityId(contact);
      const isCurrent  = !!selectedId && (senderId === selectedId || getEntityId(message.recipient) === selectedId);

      if (isCurrent) {
        if (senderId !== currentUserId) { try { playReceiveSound(); } catch {} }
        try { await messageCache.addMessage(currentUserId, contact.id, message); } catch {}
        setMessages((p) => {
          if (p.some((m) => m._id === message._id)) return p;
          return [...p.filter((m) => !(m.status === "sending" && m.content === message.content)), message]
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        });
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
      } else if (senderId && senderId !== currentUserId) {
        setUnreadCounts((p) => ({ ...p, [senderId]: (p[senderId] || 0) + 1 }));
      }
      loadConversations();
    };

    const handleSent = async (message) => {
      const contact    = selectedContactRef.current;
      const selectedId = getEntityId(contact);
      if (!selectedId) { loadConversations(); return; }
      try { await messageCache.addMessage(currentUserId, contact.id, message); } catch {}
      setMessages((p) => {
        if (p.some((m) => m._id === message._id)) return p;
        return [...p.filter((m) => !(m.status === "sending" && m.content === message.content)), message]
          .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      });
      loadConversations();
    };

    const handleDeleted     = ({ messageId }) => setMessages((p) => p.filter((m) => m._id !== messageId));
    const handleTyping      = ({ userId }) => setTypingUsers((p) => [...new Set([...p, userId])]);
    const handleStopTyping  = ({ userId }) => setTypingUsers((p) => p.filter((id) => id !== userId));

    socket.on("receiveMessage",    handleReceive);
    socket.on("messageSent",       handleSent);
    socket.on("message-deleted",   handleDeleted);
    socket.on("userTyping",        handleTyping);
    socket.on("userStoppedTyping", handleStopTyping);
    return () => {
      socket.off("receiveMessage",    handleReceive);
      socket.off("messageSent",       handleSent);
      socket.off("message-deleted",   handleDeleted);
      socket.off("userTyping",        handleTyping);
      socket.off("userStoppedTyping", handleStopTyping);
    };
  }, [socket, connected, currentUserId, loadConversations]);

  useEffect(() => {
    if (!connected || !socket) return;

    const handleIncomingCall = ({ callId, from, caller, type }) => {
      const friend = contacts.find((c) => c.id === from) || { id: from, fullName: caller?.fullName || "Anonyme", profilePhoto: caller?.profilePhoto };
      // Sonnerie appelé
      if (!ringtoneRef.current) { ringtoneRef.current = new CallRingtone(); ringtoneRef.current.start(); }
      try { vibrateCall(); } catch {}
      // Notification onglet
      startTabCallAlert(friend.fullName);
      setIncomingCall({ callId, friend, type, caller: friend });
    };

    const handleCallInitiated = ({ callId }) => {
      // callId connu → mettre à jour + stopper la sonnerie appelant si déjà décroché
      setCall((p) => ({ ...p, callId }));
    };

    const handleCallAccepted = ({ callId }) => {
      onCallAccepted(callId); // stoppe CallerRingtone + joue son connecté
    };

    const handleCallRejected = () => {
      cleanupCallRingtone();
      try { playCallRejectedSound(); } catch {}
      showToast("Appel occupé", "info");
      setCall({ on: false, type: null, friend: null, mute: false, video: true, isIncoming: false, callId: null });
    };

    const handleCallEnded = () => {
      try { playCallEndedSound(); } catch {}
      ringtoneRef.current?.stop(); ringtoneRef.current = null;
      stopVibration(); stopTabCallAlert();
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
  }, [socket, connected, contacts, cleanupCallRingtone, showToast, endCall, setCall, setIncomingCall, onCallAccepted]);

  useEffect(() => { if (!showOnboarding) { loadContacts(); loadConversations(); } }, [loadContacts, loadConversations, showOnboarding]);

  useEffect(() => {
    if (location.state?.selectedContact && location.state?.openChat) {
      const c = location.state.selectedContact;
      const norm = { id: c.id || c._id, fullName: c.fullName, username: c.username, profilePhoto: c.profilePhoto, isOnline: c.isOnline, lastSeen: c.lastSeen };
      saveContactToOnApp(norm, currentUserId);
      setSelectedContact(norm); selectedContactRef.current = norm;
      setMessages([]); loadMessages(norm.id); setView("chat");
      navigate("/messages", { replace: true, state: {} });
    }
  }, [location.state, navigate, loadMessages, currentUserId]);

  useEffect(() => () => {
    cleanupCallRingtone();
    ringtoneRef.current?.stop(); ringtoneRef.current = null;
    stopVibration(); stopTabCallAlert();
  }, [cleanupCallRingtone]);

  useEffect(() => {
    const id = setInterval(() => messageCache.cleanOldMessages(30).catch(console.error), 86_400_000);
    messageCache.cleanOldMessages(30).catch(console.error);
    return () => clearInterval(id);
  }, []);

  const totalUnread = useMemo(() => Object.values(unreadCounts).reduce((a, b) => a + b, 0), [unreadCounts]);

  return (
    <>
      <AnimatePresence>
        {showOnboarding && <OnboardingPhoneScreen user={user} onComplete={handleOnboardingComplete} />}
      </AnimatePresence>

      <div className={`flex h-screen bg-gradient-to-br from-gray-900 via-blue-900/30 to-gray-900 text-white overflow-hidden ${showOnboarding ? "pointer-events-none" : ""}`}>

        {view === "contacts" && (
          <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="w-full h-full flex flex-col">
            <ContactSidebar
              token={token}
              contacts={contacts}
              conversations={conversations}
              selectedContact={selectedContact}
              onContactSelect={handleContactSelect}
              unreadCounts={unreadCounts}
              onlineUsers={onlineUsers}
              user={user}
              onPickerSync={handlePickerSync}
              onShowPending={() => setModal("pending")}
              onShowMissedCalls={() => setModal("missed")}
              missedCallsCount={missedCallsCount}
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

      {/* Modales */}
      <AnimatePresence>
        {modal === "pending" && (
          <PendingMessagesModal key="pending" isOpen onClose={() => setModal(null)} onAccept={async (req) => { await API.acceptMessageRequest(token, req._id); showToast("✅ Demande acceptée", "success"); loadContacts(); loadConversations(); setModal(null); }} onReject={async (id) => { try { await API.rejectMessageRequest(token, id); showToast("Demande rejetée", "info"); loadConversations(); } catch { showToast("Erreur", "error"); } }} onOpenConversation={(req) => { handleContactSelect(req.sender); }} />
        )}
        {modal === "missed" && (
          <MissedCallsModal key="missed" isOpen missedCalls={missedCalls} onClose={() => setModal(null)} onCallback={handleCallback} onDismiss={dismissMissedCall} onClearAll={clearAllMissedCalls} />
        )}
      </AnimatePresence>

      {showPhoneModal && <PhoneNumberModal isOpen onClose={() => setShowPhoneModal(false)} onSubmit={async (ph) => { const r = await API.updatePhone(token, ph); if (r.success) { if (updateUserProfile) updateUserProfile(currentUserId, r.user); showToast("Numéro enregistré ! 🎉", "success"); setShowPhoneModal(false); }}} canSkip />}

      {call.on && (
        <CallManager call={call} onEndCall={endCall} onToggleMute={() => setCall((p) => ({ ...p, mute: !p.mute }))} onToggleVideo={() => setCall((p) => ({ ...p, video: !p.video }))} socket={socket} />
      )}

      <AnimatePresence>
        {incomingCall && (
          <IncomingCallModal key="incoming" caller={incomingCall.friend || incomingCall.caller} callType={incomingCall.type} onAccept={handleAcceptCall} onReject={handleRejectCall} />
        )}
      </AnimatePresence>

      {/* Notification appel manqué passagère */}
      <AnimatePresence>
        {missedCallNotification && (
          <motion.div initial={{ opacity: 0, y: 20, x: 20 }} animate={{ opacity: 1, y: 0, x: 0 }} exit={{ opacity: 0, y: 20, x: 20 }} className="fixed bottom-4 right-4 z-[300] flex items-center gap-3 bg-red-600/95 backdrop-blur-sm text-white px-4 py-3 rounded-2xl shadow-2xl border border-red-400/20 cursor-pointer" onClick={() => setModal("missed")}>
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
              <Phone size={15} className="text-white" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-wide">Appel manqué</p>
              <p className="text-[11px] opacity-80">{missedCallNotification.friend?.fullName || "Inconnu"}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}