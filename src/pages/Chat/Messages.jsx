// ============================================
// 📁 src/Pages/chat/Messages.jsx
// ✅ Navigation par modales — header compact
//    Conforme Google Play Policy (avril 2026)
// ============================================

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import {
  ArrowLeft, X, Users, MessageSquare, Lock, ShieldCheck,
  Phone, Video, CheckCircle, Shield,
  ChevronRight, Loader, UserPlus, Bell
} from "lucide-react";

import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { API } from "../../services/apiService";
import messageCache from "../../utils/messageCache";

import IncomingCallModal from "../../components/IncomingCallModal";
import CallManager from "../../components/CallManager";
import { PhoneNumberModal } from "./components/PhoneNumberModal";
import { ContactSidebar } from "./ContactSidebar";
import { ChatHeader } from "./components/ChatHeader";
import { MessagesList } from "./components/MessagesList";
import { ChatInput } from "./components/ChatInput";
import { PendingMessagesModal } from "./PendingMessagesModal";

import { useAudioRecording } from "../../hooks/useAudioRecording";
import { useCallManager } from "./hooks/useCallManager";
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

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
const saveContactToOnApp = (contact) => {
  if (!contact?.id) return;
  try {
    const stored = localStorage.getItem("onAppContacts");
    const existing = stored ? JSON.parse(stored) : [];
    const updated = [contact, ...existing.filter((c) => c.id !== contact.id)];
    localStorage.setItem("onAppContacts", JSON.stringify(updated));
  } catch (e) {
    console.warn("saveContactToOnApp error:", e);
  }
};

const openContactPicker = async () => {
  try {
    if (!("contacts" in navigator && "ContactsManager" in window)) return [];
    const props = ["name", "tel"];
    const opts  = { multiple: true };
    const raw   = await navigator.contacts.select(props, opts);
    return raw.flatMap((c) =>
      (c.tel || []).map((phone) => ({ name: c.name?.[0] || "Inconnu", phone }))
    );
  } catch (err) {
    console.info("Contact Picker:", err.message);
    return [];
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ONBOARDING
// ─────────────────────────────────────────────────────────────────────────────
const OnboardingPhoneScreen = ({ onComplete, user }) => {
  const [step, setStep]       = useState("intro");
  const [phone, setPhone]     = useState("");
  const [error, setError]     = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncStats, setSyncStats] = useState(null);
  const { token, updateUserProfile } = useAuth();
  const { showToast } = useToast();

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
      if (updateUserProfile) updateUserProfile(user.id, resp.user);
      setSyncing(false);
      setStep("picker");
    } catch (err) {
      setError(err.message || "Une erreur est survenue");
      setSyncing(false);
    }
  };

  const handlePickContacts = async () => {
    setSyncing(true);
    try {
      const picked = await openContactPicker();
      if (picked.length === 0) {
        setSyncStats({ total: 0, onApp: 0 });
        setStep("done");
        setSyncing(false);
        return;
      }
      const syncResp = await API.syncContacts(token, picked);
      const stats = {
        total: picked.length,
        onApp: syncResp.stats?.onApp || syncResp.onChantilink?.length || 0,
      };
      (syncResp.onChantilink || []).forEach((c) => saveContactToOnApp(c));
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

  const handleSkip = () => {
    setSyncStats({ total: 0, onApp: 0 });
    setStep("done");
  };

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-gray-950 via-blue-950 to-gray-950 flex items-center justify-center p-4">
      <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      <AnimatePresence mode="wait">

        {step === "intro" && (
          <motion.div
            key="intro"
            initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
            className="w-full max-w-sm text-center"
          >
            <motion.div
              animate={{ scale: [1, 1.06, 1] }}
              transition={{ duration: 2.5, repeat: Infinity }}
              className="mx-auto mb-8 w-24 h-24 rounded-3xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-2xl shadow-blue-900/50"
            >
              <MessageSquare size={44} className="text-white" />
            </motion.div>
            <h1 className="text-3xl font-black text-white mb-3 leading-tight">
              Restez connecté<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">
                avec vos proches
              </span>
            </h1>
            <p className="text-gray-400 mb-10 leading-relaxed">
              Trouvez vos amis sur Chantilink en sélectionnant vos contacts depuis votre téléphone.
            </p>
            <div className="space-y-3 mb-10 text-left">
              {[
                { icon: <UserPlus size={18} />, color: "blue",   title: "Vous choisissez",       desc: "Sélectionnez uniquement les contacts que vous voulez" },
                { icon: <Shield size={18} />,   color: "green",  title: "Chiffrement SHA-256",    desc: "Vos numéros ne sont jamais stockés en clair" },
                { icon: <MessageSquare size={18} />, color: "purple", title: "Messagerie sécurisée", desc: "Discussions privées de bout en bout" },
              ].map((f, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + i * 0.1 }}
                  className="flex items-center gap-3 p-3 bg-white/5 rounded-2xl border border-white/5"
                >
                  <div className={`w-9 h-9 rounded-xl bg-${f.color}-500/15 flex items-center justify-center text-${f.color}-400 flex-shrink-0`}>
                    {f.icon}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{f.title}</p>
                    <p className="text-xs text-gray-500">{f.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => setStep("phone")}
              className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black rounded-2xl shadow-xl shadow-blue-900/40 flex items-center justify-center gap-2 transition-all"
            >
              Commencer <ChevronRight size={20} />
            </motion.button>
            <button onClick={handleSkip} className="mt-4 w-full py-3 text-gray-500 text-sm hover:text-gray-400 transition-colors">
              Passer pour l'instant
            </button>
          </motion.div>
        )}

        {step === "phone" && (
          <motion.div
            key="phone"
            initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
            className="w-full max-w-sm"
          >
            <button onClick={() => { setStep("intro"); setError(""); }} className="flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition-colors">
              <ArrowLeft size={18} /> Retour
            </button>
            <div className="mb-8">
              <div className="w-16 h-16 rounded-2xl bg-blue-600/20 flex items-center justify-center mb-6">
                <Phone size={30} className="text-blue-400" />
              </div>
              <h2 className="text-2xl font-black text-white mb-2">Votre numéro</h2>
              <p className="text-gray-400 text-sm leading-relaxed">
                Entrez votre numéro pour être trouvable par vos contacts.
              </p>
            </div>
            <div className="mb-6">
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                Numéro de téléphone
              </label>
              <div className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all bg-white/5
                ${error ? "border-red-500/60" : "border-white/10 focus-within:border-blue-500/60"}`}
              >
                <span className="text-2xl select-none">🇨🇮</span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => { setPhone(e.target.value); setError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && handlePhoneSubmit()}
                  placeholder="+225 07 00 00 00 00"
                  autoFocus
                  className="flex-1 bg-transparent text-white text-lg font-semibold outline-none placeholder:text-gray-600"
                />
              </div>
              <AnimatePresence>
                {error && (
                  <motion.p initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-2 text-sm text-red-400">
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>
              <p className="mt-2 text-xs text-gray-600">Format international — ex: +225 07 12 34 56 78</p>
            </div>
            <div className="p-4 bg-green-500/5 border border-green-500/15 rounded-2xl mb-6">
              <div className="flex items-start gap-2">
                <ShieldCheck size={16} className="text-green-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-gray-400 leading-relaxed">
                  Votre numéro est chiffré avec SHA-256. <strong className="text-white">Il n'est jamais stocké en clair.</strong>
                </p>
              </div>
            </div>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handlePhoneSubmit}
              disabled={!phone.trim() || syncing}
              className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black rounded-2xl shadow-xl shadow-blue-900/40 flex items-center justify-center gap-2 transition-all"
            >
              {syncing ? <Loader size={20} className="animate-spin" /> : <><span>Continuer</span> <ChevronRight size={20} /></>}
            </motion.button>
            <button onClick={handleSkip} className="mt-4 w-full py-3 text-gray-500 text-sm hover:text-gray-400 transition-colors">
              Passer
            </button>
          </motion.div>
        )}

        {step === "picker" && (
          <motion.div
            key="picker"
            initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
            className="w-full max-w-sm text-center"
          >
            <motion.div
              animate={{ scale: [1, 1.04, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="mx-auto mb-8 w-24 h-24 rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-2xl shadow-indigo-900/50"
            >
              <Users size={44} className="text-white" />
            </motion.div>
            <h2 className="text-2xl font-black text-white mb-3">Trouvez vos amis</h2>
            <p className="text-gray-400 mb-8 leading-relaxed text-sm">
              Sélectionnez les contacts à retrouver sur Chantilink.{" "}
              <strong className="text-white">Vous choisissez qui partager.</strong>
            </p>
            <div className="p-4 bg-blue-500/5 border border-blue-500/15 rounded-2xl mb-8 text-left space-y-2">
              <p className="text-xs font-bold text-blue-400">Comment ça fonctionne</p>
              <p className="text-xs text-gray-400 leading-relaxed">
                1. Un sélecteur de contacts s'ouvre<br />
                2. Vous choisissez les contacts à vérifier<br />
                3. Leurs numéros sont hachés (SHA-256) localement<br />
                4. Comparaison sécurisée avec notre base<br />
                5. <strong className="text-white">Aucun numéro n'est stocké en clair</strong>
              </p>
            </div>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handlePickContacts}
              disabled={syncing}
              className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white font-black rounded-2xl shadow-xl shadow-indigo-900/40 flex items-center justify-center gap-2 transition-all"
            >
              {syncing
                ? <><Loader size={20} className="animate-spin" /> Recherche en cours…</>
                : <><Users size={20} /> Sélectionner mes contacts</>
              }
            </motion.button>
            <button onClick={handleSkip} disabled={syncing} className="mt-4 w-full py-3 text-gray-500 text-sm hover:text-gray-400 transition-colors disabled:opacity-40">
              Passer cette étape
            </button>
          </motion.div>
        )}

        {step === "done" && (
          <motion.div
            key="done"
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", damping: 20, stiffness: 200 }}
            className="w-full max-w-sm text-center"
          >
            <motion.div
              initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", damping: 15, stiffness: 200 }}
              className="mx-auto mb-8 w-24 h-24 rounded-full bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30 flex items-center justify-center"
            >
              <CheckCircle size={52} className="text-green-400" />
            </motion.div>
            <h2 className="text-2xl font-black text-white mb-3">
              {syncStats?.onApp > 0 ? "Amis trouvés ! 🎉" : "C'est tout bon !"}
            </h2>
            {syncStats?.onApp > 0 ? (
              <p className="text-gray-400 mb-8">
                <span className="text-white font-black text-xl">{syncStats.onApp}</span>{" "}
                {syncStats.onApp === 1 ? "ami utilise" : "amis utilisent"} déjà Chantilink
                {syncStats.total > 0 && (
                  <span className="block text-sm mt-1 text-gray-500">sur {syncStats.total} contacts sélectionnés</span>
                )}
              </p>
            ) : (
              <p className="text-gray-400 mb-8 leading-relaxed">
                Votre compte est configuré.<br />
                <span className="text-sm text-gray-500">Ajoutez des contacts depuis l'onglet Contacts.</span>
              </p>
            )}
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => onComplete()}
              className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-black rounded-2xl shadow-xl shadow-green-900/40 flex items-center justify-center gap-2 transition-all"
            >
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
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
    onClick={onClose}
  >
    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
    <motion.div
      initial={{ y: 60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 60, opacity: 0 }}
      transition={{ type: "spring", damping: 28, stiffness: 300 }}
      className="relative z-10 w-full max-w-md bg-[#13161c] border border-white/10 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-white/5">
        <MessageSquare size={18} className="text-purple-400 flex-shrink-0" />
        <div className="flex-1">
          <h2 className="text-base font-black text-white">Conversations</h2>
          <p className="text-[11px] text-gray-500">{conversations.length} active(s)</p>
        </div>
        <button onClick={onClose} className="p-1.5 hover:bg-white/5 rounded-xl transition-colors">
          <X size={18} className="text-gray-400" />
        </button>
      </div>

      {/* Liste */}
      <div className="overflow-y-auto max-h-[60vh] custom-scrollbar">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-7 h-7 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <MessageSquare size={36} className="text-gray-700 mb-3" />
            <p className="text-sm text-gray-500">Aucune conversation active</p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => { onSelect(conv); onClose(); }}
                className="w-full flex items-center gap-3 p-3 hover:bg-white/[0.04] rounded-xl transition-all group"
              >
                <div className="relative flex-shrink-0">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-lg font-black overflow-hidden">
                    {conv.profilePhoto
                      ? <img src={conv.profilePhoto} alt="" className="w-full h-full object-cover" />
                      : conv.fullName?.[0]?.toUpperCase() || "?"}
                  </div>
                  {conv.isOnline && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-[#13161c]" />
                  )}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between mb-0.5">
                    <h3 className="text-sm font-bold text-white truncate">{conv.fullName}</h3>
                    {conv.lastMessageTime && (
                      <span className="text-[10px] text-gray-600 flex-shrink-0 ml-2">
                        {new Date(conv.lastMessageTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-gray-500 truncate flex-1">
                      {conv.lastMessage || "Aucun message"}
                    </p>
                    {conv.unreadCount > 0 && (
                      <span className="bg-blue-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full flex-shrink-0">
                        {conv.unreadCount}
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
        <button onClick={onClose} className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-gray-400 text-sm font-bold rounded-xl transition-all">
          Fermer
        </button>
      </div>
    </motion.div>
  </motion.div>
);

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSANT PRINCIPAL : Messages
// ─────────────────────────────────────────────────────────────────────────────
export default function Messages() {
  const { user, token, socket, updateUserProfile } = useAuth();
  const { showToast } = useToast();
  const navigate  = useNavigate();
  const location  = useLocation();

  const messagesEndRef = useRef(null);
  const textareaRef    = useRef(null);
  const fileInputRef   = useRef(null);
  const ringtoneRef    = useRef(null);

  // ── ÉTAT VUE ──
  const [view, setView] = useState("contacts"); // contacts | chat
  const [modal, setModal] = useState(null);     // null | 'conversations' | 'pending'

  const [contacts, setContacts]           = useState([]);
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages]           = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [unreadCounts, setUnreadCounts]   = useState({});
  const [onlineUsers, setOnlineUsers]     = useState([]);

  const [showPhoneModal, setShowPhoneModal] = useState(false);

  const [input, setInput]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);

  // ── ONBOARDING ──
  const onboardingKey     = user?.id ? `chantilink_onboarding_done_${user.id}` : null;
  const hasSeenOnboarding = onboardingKey ? !!localStorage.getItem(onboardingKey) : true;
  const needsOnboarding   = !hasSeenOnboarding && !user?.phone;
  const [showOnboarding, setShowOnboarding] = useState(needsOnboarding);

  const handleOnboardingComplete = useCallback(() => {
    if (onboardingKey) localStorage.setItem(onboardingKey, "1");
    setShowOnboarding(false);
    loadContacts();
    loadConversations();
  }, [onboardingKey]); // eslint-disable-line

  const {
    recording, audioBlob, audioUrl, isPlaying,
    startRecording, stopRecording, cancelRecording,
    playPreview, pausePreview,
  } = useAudioRecording(token, showToast);

  const connected = socket?.connected || false;

  const initiateCall = useCallback((recipientId, callType) => {
    if (!socket?.connected) { showToast("Connexion socket requise", "error"); return false; }
    socket.emit("startCall", { recipientId, type: callType, callerId: user?.id });
    return true;
  }, [socket, user, showToast]);

  const socketEndCall = useCallback((callId) => {
    if (socket?.connected && callId) socket.emit("endCall", { callId });
  }, [socket]);

  const sendMessageSocket = useCallback((data) => {
    if (!socket?.connected) { showToast("Impossible d'envoyer le message", "error"); return; }
    socket.emit("sendMessage", data);
  }, [socket, showToast]);

  const {
    call, setCall, incomingCall, setIncomingCall,
    missedCallNotification, startCall, endCall,
    sendMissedCallMessage, cleanupCallRingtone,
  } = useCallManager(
    { friend: selectedContact },
    connected, initiateCall, socketEndCall, sendMessageSocket, showToast
  );

  const loadContacts = useCallback(async () => {
    if (!token) return;
    try {
      const cached = await messageCache.getContacts();
      if (cached.length > 0) setContacts(cached);
      const result = await API.getContacts(token);
      const list = result.contacts || [];
      if (list.length > 0) { await messageCache.saveContacts(list); setContacts(list); }
    } catch (err) {
      console.error("❌ loadContacts:", err);
    }
  }, [token]);

  const loadConversations = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const cached = await messageCache.getConversations();
      if (cached.length > 0) {
        setConversations(cached);
        const counts = {};
        cached.forEach((c) => { if (c.unreadCount > 0) counts[c.id] = c.unreadCount; });
        setUnreadCounts(counts);
        setLoading(false);
      }
      const result = await API.getConversations(token);
      const fresh  = result.conversations || [];
      if (fresh.length > 0) {
        await messageCache.saveConversations(fresh);
        setConversations(fresh);
        fresh.forEach((conv) => { if (conv.id) saveContactToOnApp(conv); });
        const counts = {};
        fresh.forEach((c) => { if (c.unreadCount > 0) counts[c.id] = c.unreadCount; });
        setUnreadCounts(counts);
      }
    } catch (err) {
      console.error("❌ loadConversations:", err);
      showToast("Erreur de chargement", "error");
    } finally {
      setLoading(false);
    }
  }, [token, showToast]);

  const loadMessages = useCallback(async (contactId) => {
    if (!contactId || !token || !user?.id) return;
    setLoading(true);
    try {
      const cached = await messageCache.getMessages(user.id, contactId);
      if (cached.length > 0) {
        setMessages(cached);
        setLoading(false);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      }
      const result = await API.getMessages(token, contactId);
      const list   = Array.isArray(result) ? result : (result.messages || []);
      if (list.length > 0) { await messageCache.saveMessages(user.id, contactId, list); setMessages(list); }
      if (socket?.connected) socket.emit("markMessagesAsRead", { senderId: contactId });
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (err) {
      console.error("❌ loadMessages:", err);
      showToast("Impossible de charger les messages", "error");
    } finally {
      setLoading(false);
    }
  }, [token, socket, showToast, user]);

  const handlePickerSync = useCallback((newContacts) => {
    loadContacts();
    loadConversations();
    if (newContacts.length > 0) showToast(`${newContacts.length} ami(s) trouvé(s) !`, "success");
  }, [loadContacts, loadConversations, showToast]);

  const handleContactSelect = useCallback((contact) => {
    const normalized = {
      id: contact.id || contact._id,
      fullName: contact.fullName,
      username: contact.username,
      profilePhoto: contact.profilePhoto,
      isOnline: contact.isOnline,
      lastSeen: contact.lastSeen,
    };
    saveContactToOnApp(normalized);
    setSelectedContact(normalized);
    setMessages([]);
    loadMessages(normalized.id);
    setView("chat");
    setModal(null);
    setUnreadCounts((prev) => { const n = { ...prev }; delete n[normalized.id]; return n; });
  }, [loadMessages]);

  const handleInputChange = useCallback((e) => {
    setInput(e.target.value);
    if (socket?.connected && selectedContact) {
      socket.emit("typing", { recipientId: selectedContact.id, isTyping: e.target.value.length > 0 });
    }
  }, [socket, selectedContact]);

  const handleSendMessage = useCallback(async () => {
    if (!selectedContact || !input.trim() || !socket?.connected || !user?.id) return;
    const temp = {
      _id:       `temp-${Date.now()}`,
      sender:    user.id,
      recipient: selectedContact.id,
      content:   input.trim(),
      type:      "text",
      status:    "sending",
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, temp]);
    try { playSendSound(); } catch {}
    try { await messageCache.addMessage(user.id, selectedContact.id, temp); } catch {}
    socket.emit("sendMessage", { recipientId: selectedContact.id, content: input.trim(), type: "text" });
    setInput("");
    socket.emit("typing", { recipientId: selectedContact.id, isTyping: false });
  }, [selectedContact, input, socket, user]);

  const handleFileUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedContact) return;
    showToast("📤 Upload en cours…", "info");
    try {
      const up = await API.uploadMessageFile(token, file);
      if (up.success && up.url) {
        socket.emit("sendMessage", {
          recipientId: selectedContact.id, content: file.name,
          type: up.type || "file", file: up.url, fileUrl: up.url,
          fileName: file.name, fileSize: file.size,
        });
        showToast("✅ Fichier envoyé !", "success");
      }
    } catch { showToast("❌ Erreur d'envoi", "error"); }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [selectedContact, token, socket, showToast]);

  const handleSendAudio = useCallback(async () => {
    if (!audioBlob || !selectedContact) return;
    try {
      showToast("📤 Envoi du message vocal…", "info");
      const up = await API.uploadMessageFile(token, new File([audioBlob], "audio.webm", { type: "audio/webm" }));
      if (up.success && up.url) {
        socket.emit("sendMessage", {
          recipientId: selectedContact.id, content: "Message vocal",
          type: "audio", file: up.url, fileUrl: up.url,
        });
        showToast("✅ Message vocal envoyé !", "success");
      }
      cancelRecording();
    } catch { showToast("❌ Erreur lors de l'envoi", "error"); }
  }, [audioBlob, selectedContact, token, socket, cancelRecording, showToast]);

  const handleEmojiSelect = useCallback((emoji) => {
    setInput((prev) => prev + emoji.emoji);
    setShowEmoji(false);
  }, []);

  const handlePhoneSubmit = useCallback(async (phoneNumber) => {
    const resp = await API.updatePhone(token, phoneNumber);
    if (resp.success) {
      if (updateUserProfile) updateUserProfile(user.id, resp.user);
      showToast("Numéro enregistré ! 🎉", "success");
      setShowPhoneModal(false);
    }
  }, [token, updateUserProfile, user, showToast]);

  const handleAcceptPendingRequest = useCallback(async (request) => {
    try {
      await API.acceptMessageRequest(token, request._id);
      showToast("✅ Demande acceptée !", "success");
      loadContacts(); loadConversations(); setModal(null);
    } catch { showToast("❌ Impossible d'accepter", "error"); }
  }, [token, loadContacts, loadConversations, showToast]);

  const handleVideoCall = useCallback(() => {
    if (!selectedContact) { showToast("Aucun contact sélectionné", "error"); return; }
    try { playCallConnectedSound(); } catch {}
    setCall({ on: true, type: "video", friend: selectedContact, mute: false, video: true, isIncoming: false, callId: null });
    startCall("video");
  }, [selectedContact, startCall, showToast, setCall]);

  const handleAudioCall = useCallback(() => {
    if (!selectedContact) { showToast("Aucun contact sélectionné", "error"); return; }
    try { playCallConnectedSound(); } catch {}
    setCall({ on: true, type: "audio", friend: selectedContact, mute: false, video: false, isIncoming: false, callId: null });
    startCall("audio");
  }, [selectedContact, startCall, showToast, setCall]);

  const handleAcceptCall = useCallback(() => {
    if (incomingCall && socket) {
      if (ringtoneRef.current) { ringtoneRef.current.stop(); ringtoneRef.current = null; }
      stopVibration();
      try { playCallConnectedSound(); } catch {}
      socket.emit("acceptCall", { callId: incomingCall.callId });
      setCall({ on: true, type: incomingCall.type, friend: incomingCall.caller, mute: false, video: incomingCall.type === "video", isIncoming: true, callId: incomingCall.callId });
      setIncomingCall(null);
      cleanupCallRingtone();
    }
  }, [incomingCall, socket, setCall, setIncomingCall, cleanupCallRingtone]);

  const handleRejectCall = useCallback(() => {
    if (incomingCall && socket) {
      if (ringtoneRef.current) { ringtoneRef.current.stop(); ringtoneRef.current = null; }
      stopVibration();
      try { playCallRejectedSound(); } catch {}
      socket.emit("rejectCall", { callId: incomingCall.callId });
      sendMissedCallMessage(incomingCall.caller, incomingCall.type);
      setIncomingCall(null);
      cleanupCallRingtone();
    }
  }, [incomingCall, socket, sendMissedCallMessage, setIncomingCall, cleanupCallRingtone]);

  const handleBack = useCallback(() => {
    setView("contacts");
    setSelectedContact(null);
    setMessages([]);
  }, []);


  const handleDeleteMessage = useCallback(async (messageId) => {
    if (!selectedContact || !user?.id) return;
    try {
      setMessages((prev) => prev.filter((m) => m._id !== messageId));
      await messageCache.deleteMessage(user.id, selectedContact.id, messageId);
      if (socket?.connected) socket.emit("deleteMessage", { messageId, conversationId: selectedContact.id });
      showToast("Message supprimé", "success");
    } catch { showToast("Erreur lors de la suppression", "error"); }
  }, [selectedContact, user, socket, showToast]);

  // ── EFFECTS ──
  useEffect(() => {
    if (!showOnboarding) { loadContacts(); loadConversations(); }
  }, [loadContacts, loadConversations, showOnboarding]);

  useEffect(() => {
    if (location.state?.selectedContact && location.state?.openChat) {
      const contact = location.state.selectedContact;
      const normalized = { id: contact.id || contact._id, fullName: contact.fullName, username: contact.username, profilePhoto: contact.profilePhoto, isOnline: contact.isOnline, lastSeen: contact.lastSeen };
      saveContactToOnApp(normalized);
      setSelectedContact(normalized);
      setMessages([]);
      loadMessages(normalized.id);
      setView("chat");
      navigate("/messages", { replace: true, state: {} });
    }
  }, [location.state, navigate, loadMessages]);

  useEffect(() => {
    if (!socket?.connected) return;
    const h = (users) => setOnlineUsers(users || []);
    socket.on("onlineUsers", h);
    return () => socket.off("onlineUsers", h);
  }, [socket]);

  useEffect(() => {
    if (!socket?.connected || !user?.id) return;

    const handleReceiveMessage = async (message) => {
      const senderId = typeof message.sender === "object" ? message.sender._id : message.sender;
      const recipientId = typeof message.recipient === "object" ? message.recipient._id : message.recipient;
      const isCurrentChat = selectedContact && (senderId === selectedContact.id || recipientId === selectedContact.id);
      if (isCurrentChat) {
        try { playReceiveSound(); } catch {}
        try { await messageCache.addMessage(user.id, selectedContact.id, message); } catch {}
        setMessages((prev) => [...prev, message].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)));
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      } else {
        setUnreadCounts((prev) => ({ ...prev, [senderId]: (prev[senderId] || 0) + 1 }));
      }
      loadConversations();
    };

    const handleMessageSent = async (message) => {
      try { if (selectedContact?.id && user?.id) await messageCache.addMessage(user.id, selectedContact.id, message); } catch {}
      setMessages((prev) => {
        const filtered = prev.filter((m) => m.status !== "sending" || m.content !== message.content);
        return [...filtered, message].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      });
      loadConversations();
    };

    const handleTyping = ({ userId, isTyping }) => {
      if (isTyping) setTypingUsers((prev) => [...new Set([...prev, userId])]);
      else setTypingUsers((prev) => prev.filter((id) => id !== userId));
    };

    socket.on("receiveMessage", handleReceiveMessage);
    socket.on("messageSent",    handleMessageSent);
    socket.on("typing",         handleTyping);
    return () => {
      socket.off("receiveMessage", handleReceiveMessage);
      socket.off("messageSent",    handleMessageSent);
      socket.off("typing",         handleTyping);
    };
  }, [socket, selectedContact, loadConversations, user]);

  useEffect(() => {
    if (!socket?.connected) return;

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

    const handleCallEnded = () => {
      try { playCallEndedSound(); } catch {}
      if (ringtoneRef.current) { ringtoneRef.current.stop(); ringtoneRef.current = null; }
      stopVibration();
      cleanupCallRingtone();
      endCall();
    };

    socket.on("incoming-call",  handleIncomingCall);
    socket.on("call-rejected",  handleCallRejected);
    socket.on("call-ended",     handleCallEnded);
    return () => {
      socket.off("incoming-call",  handleIncomingCall);
      socket.off("call-rejected",  handleCallRejected);
      socket.off("call-ended",     handleCallEnded);
    };
  }, [socket, contacts, cleanupCallRingtone, showToast, endCall, setCall, setIncomingCall]);

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

  const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0);

  return (
    <>
      <AnimatePresence>
        {showOnboarding && (
          <OnboardingPhoneScreen user={user} onComplete={handleOnboardingComplete} />
        )}
      </AnimatePresence>

      <div className={`flex h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 text-white overflow-hidden ${showOnboarding ? "pointer-events-none" : ""}`}>

        {/* ══ VUE CONTACTS ══ */}
        {view === "contacts" && (
          <motion.div
            initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
            className="w-full h-full flex flex-col"
          >
            <ContactSidebar
              token={token}
              contacts={contacts}
              selectedContact={selectedContact}
              onContactSelect={handleContactSelect}
              unreadCounts={unreadCounts}
              onlineUsers={onlineUsers}
              user={user}
              onPickerSync={handlePickerSync}
              onShowPending={() => setModal('pending')}
              onShowConversations={() => setModal('conversations')}
              conversations={conversations}
              totalUnread={totalUnread}
            />
          </motion.div>
        )}

        {/* ══ VUE CHAT ══ */}
        {view === "chat" && selectedContact && (
          <motion.div
            initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
            className="w-full h-full flex flex-col"
          >
            <ChatHeader
              friend={selectedContact} typingUsers={typingUsers} onlineUsers={onlineUsers}
              connected={connected} onVideoCall={handleVideoCall} onAudioCall={handleAudioCall} onBack={handleBack}
            />
            <MessagesList
              messages={messages} currentUserId={user?.id} loading={loading}
              endRef={messagesEndRef} conversationId={selectedContact?.id} onDeleteMessage={handleDeleteMessage}
            />
            <ChatInput
              input={input} onChange={handleInputChange} onSend={handleSendMessage}
              recording={recording} onStartRecording={startRecording} onStopRecording={stopRecording}
              onCancelAudio={cancelRecording} onSendAudio={handleSendAudio}
              audioUrl={audioUrl} isPlaying={isPlaying} onPlayPreview={playPreview} onPausePreview={pausePreview}
              showEmoji={showEmoji} onToggleEmoji={() => setShowEmoji(!showEmoji)} onEmojiSelect={handleEmojiSelect}
              uploading={false} onUpload={handleFileUpload} connected={connected}
              txtRef={textareaRef} fileRef={fileInputRef}
            />
          </motion.div>
        )}
      </div>

      {/* ══ MODALES ══ */}
      <AnimatePresence>
        {modal === 'conversations' && (
          <ConversationsModal
            key="modal-conversations"
            conversations={conversations}
            loading={loading}
            onSelect={handleContactSelect}
            onClose={() => setModal(null)}
            unreadCounts={unreadCounts}
          />
        )}
        {modal === 'pending' && (
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
        />
      )}
      {incomingCall && (
        <IncomingCallModal caller={incomingCall.caller} callType={incomingCall.type} onAccept={handleAcceptCall} onReject={handleRejectCall} />
      )}
      {missedCallNotification && (
        <div className="fixed bottom-4 right-4 bg-red-500/90 backdrop-blur-sm text-white px-6 py-3 rounded-lg shadow-lg z-50">
          <p className="font-semibold">Appel manqué</p>
          <p className="text-sm">{missedCallNotification.caller?.name}</p>
        </div>
      )}
    </>
  );
}