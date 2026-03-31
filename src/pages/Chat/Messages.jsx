// ============================================
// 📁 src/Pages/chat/Messages.jsx
// ✅ ONBOARDING : au 1er accès, modal numéro de téléphone
//    → après soumission, sync contacts automatique (comme WhatsApp)
// ✅ Contacts venant du profil → sauvegardés dans onAppContacts
// ✅ Tout le reste inchangé
// ============================================

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import {
  ArrowLeft, X, Users, MessageSquare, Lock, ShieldCheck,
  Home, List, Phone, Video, Smartphone, CheckCircle, Shield,
  ChevronRight, Loader
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
import { AddContactModal } from "./AddContactModal";
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
// HELPER — sauvegarder un contact dans onAppContacts (localStorage)
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

// ─────────────────────────────────────────────
// HELPER — lire les contacts natifs du téléphone (Web Contacts API)
// Retourne [] si la permission est refusée ou l'API indisponible
// ─────────────────────────────────────────────
const readNativeContacts = async () => {
  try {
    if (!("contacts" in navigator && "ContactsManager" in window)) return [];
    const props = ["name", "tel"];
    const opts  = { multiple: true };
    const raw   = await navigator.contacts.select(props, opts);
    return raw.flatMap((c) =>
      (c.tel || []).map((phone) => ({ name: c.name?.[0] || "Inconnu", phone }))
    );
  } catch (err) {
    console.warn("Contacts natifs indisponibles:", err.message);
    return [];
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSANT : OnboardingPhoneScreen
// Affiché au 1er accès → saisie du numéro → sync contacts
// ─────────────────────────────────────────────────────────────────────────────
const OnboardingPhoneScreen = ({ onComplete, user }) => {
  const [step, setStep]       = useState("intro");   // intro | phone | syncing | done
  const [phone, setPhone]     = useState("");
  const [error, setError]     = useState("");
  const [syncStats, setSyncStats] = useState(null);
  const { token, updateUserProfile } = useAuth();
  const { showToast } = useToast();

  const formatPhone = (value) => {
    // Garder uniquement chiffres et +
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
    setStep("syncing");

    try {
      // 1. Enregistrer le numéro
      const resp = await API.updatePhone(token, formatted);
      if (!resp.success) throw new Error(resp.message || "Erreur serveur");
      if (updateUserProfile) updateUserProfile(user.id, resp.user);

      // 2. Lire les contacts natifs
      const nativeContacts = await readNativeContacts();

      let stats = { total: 0, onApp: 0 };

      if (nativeContacts.length > 0) {
        // 3. Synchroniser avec le backend
        const syncResp = await API.syncContacts(token, nativeContacts);
        stats = {
          total: syncResp.stats?.total  || nativeContacts.length,
          onApp: syncResp.stats?.onApp  || syncResp.onChantilink?.length || 0,
        };
        // Sauvegarder les contacts trouvés sur l'app
        (syncResp.onChantilink || []).forEach((c) => saveContactToOnApp(c));
      }

      setSyncStats(stats);
      setStep("done");
    } catch (err) {
      console.error("Onboarding error:", err);
      setError(err.message || "Une erreur est survenue");
      setStep("phone");
    }
  };

  const handleSkipSync = () => {
    setSyncStats({ total: 0, onApp: 0 });
    setStep("done");
  };

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-gray-950 via-blue-950 to-gray-950 flex items-center justify-center p-4">
      {/* Cercles décoratifs */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      <AnimatePresence mode="wait">

        {/* ── ÉTAPE 1 : Intro ─────────────────────────────────────── */}
        {step === "intro" && (
          <motion.div
            key="intro"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
            className="w-full max-w-sm text-center"
          >
            {/* Icône principale */}
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
              Chantilink synchronise vos contacts téléphoniques pour retrouver vos amis en un instant.
            </p>

            {/* Features */}
            <div className="space-y-3 mb-10 text-left">
              {[
                { icon: <Smartphone size={18} />, color: "blue", title: "Contacts automatiques", desc: "Retrouvez vos amis déjà sur Chantilink" },
                { icon: <Shield size={18} />, color: "green", title: "Chiffrement SHA-256", desc: "Vos numéros ne sont jamais stockés en clair" },
                { icon: <MessageSquare size={18} />, color: "purple", title: "Messagerie sécurisée", desc: "Discussions privées de bout en bout" },
              ].map((f, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
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

            <button
              onClick={() => onComplete()}
              className="mt-4 w-full py-3 text-gray-500 text-sm hover:text-gray-400 transition-colors"
            >
              Passer pour l'instant
            </button>
          </motion.div>
        )}

        {/* ── ÉTAPE 2 : Saisie du numéro ──────────────────────────── */}
        {step === "phone" && (
          <motion.div
            key="phone"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
            className="w-full max-w-sm"
          >
            <button
              onClick={() => { setStep("intro"); setError(""); }}
              className="flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition-colors"
            >
              <ArrowLeft size={18} /> Retour
            </button>

            <div className="mb-8">
              <div className="w-16 h-16 rounded-2xl bg-blue-600/20 flex items-center justify-center mb-6">
                <Phone size={30} className="text-blue-400" />
              </div>
              <h2 className="text-2xl font-black text-white mb-2">Votre numéro</h2>
              <p className="text-gray-400 text-sm leading-relaxed">
                Entrez votre numéro de téléphone pour synchroniser vos contacts et être trouvable par vos amis.
              </p>
            </div>

            {/* Input téléphone */}
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
                  <motion.p
                    initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="mt-2 text-sm text-red-400"
                  >
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>
              <p className="mt-2 text-xs text-gray-600">
                Format international requis — ex: +225 07 12 34 56 78
              </p>
            </div>

            {/* Bloc sécurité */}
            <div className="p-4 bg-green-500/5 border border-green-500/15 rounded-2xl mb-6">
              <div className="flex items-start gap-2">
                <ShieldCheck size={16} className="text-green-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-gray-400 leading-relaxed">
                  Votre numéro est chiffré avec SHA-256 avant toute comparaison. <strong className="text-white">Il n'est jamais stocké en clair.</strong>
                </p>
              </div>
            </div>

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handlePhoneSubmit}
              disabled={!phone.trim()}
              className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black rounded-2xl shadow-xl shadow-blue-900/40 flex items-center justify-center gap-2 transition-all"
            >
              Continuer <ChevronRight size={20} />
            </motion.button>

            <button
              onClick={handleSkipSync}
              className="mt-4 w-full py-3 text-gray-500 text-sm hover:text-gray-400 transition-colors"
            >
              Passer la synchronisation
            </button>
          </motion.div>
        )}

        {/* ── ÉTAPE 3 : Synchronisation en cours ──────────────────── */}
        {step === "syncing" && (
          <motion.div
            key="syncing"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="w-full max-w-sm text-center"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
              className="mx-auto mb-8 w-20 h-20 rounded-full border-4 border-blue-600/20 border-t-blue-500"
            />
            <h2 className="text-xl font-black text-white mb-2">Synchronisation…</h2>
            <p className="text-gray-400 text-sm">On recherche vos amis sur Chantilink</p>

            <div className="mt-8 space-y-3">
              {[
                "Enregistrement du numéro",
                "Lecture des contacts",
                "Chiffrement SHA-256",
                "Correspondances trouvées",
              ].map((label, i) => (
                <motion.div
                  key={label}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.4 }}
                  className="flex items-center gap-3 p-3 bg-white/5 rounded-xl"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: i * 0.4 + 0.2 }}
                    className="w-5 h-5 rounded-full bg-blue-600/30 border border-blue-500/50 flex items-center justify-center"
                  >
                    <motion.div
                      animate={{ backgroundColor: ["#3b82f6", "#6366f1", "#3b82f6"] }}
                      transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
                      className="w-2 h-2 rounded-full bg-blue-500"
                    />
                  </motion.div>
                  <span className="text-sm text-gray-300">{label}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── ÉTAPE 4 : Terminé ───────────────────────────────────── */}
        {step === "done" && (
          <motion.div
            key="done"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", damping: 20, stiffness: 200 }}
            className="w-full max-w-sm text-center"
          >
            {/* Checkmark animé */}
            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
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
                  <span className="block text-sm mt-1 text-gray-500">
                    sur {syncStats.total} contacts analysés
                  </span>
                )}
              </p>
            ) : (
              <p className="text-gray-400 mb-8 leading-relaxed">
                Votre compte est configuré.<br />
                <span className="text-sm text-gray-500">
                  Invitez vos proches à rejoindre Chantilink.
                </span>
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
// COMPOSANT PRINCIPAL : Messages
// ─────────────────────────────────────────────────────────────────────────────
export default function Messages() {
  const { user, token, socket, updateUserProfile } = useAuth();
  const { showToast } = useToast();
  const navigate  = useNavigate();
  const location  = useLocation();

  // ── Refs ──
  const messagesEndRef = useRef(null);
  const textareaRef    = useRef(null);
  const fileInputRef   = useRef(null);
  const ringtoneRef    = useRef(null);

  // ── States UI ──
  const [view, setView]                   = useState("contacts");
  const [contacts, setContacts]           = useState([]);
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages]           = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [unreadCounts, setUnreadCounts]   = useState({});
  const [onlineUsers, setOnlineUsers]     = useState([]);

  const [showPhoneModal, setShowPhoneModal]   = useState(false);
  const [showAddContact, setShowAddContact]   = useState(false);
  const [showPendingModal, setShowPendingModal] = useState(false);

  const [input, setInput]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);

  // ── ONBOARDING : afficher l'écran si l'user n'a pas encore de téléphone ──
  // On mémorise dans localStorage qu'il a déjà vu l'onboarding (même sans numéro)
  const onboardingKey = user?.id ? `chantilink_onboarding_done_${user.id}` : null;
  const hasSeenOnboarding = onboardingKey ? !!localStorage.getItem(onboardingKey) : true;
  const needsOnboarding   = !hasSeenOnboarding && !user?.phone;

  const [showOnboarding, setShowOnboarding] = useState(needsOnboarding);

  const handleOnboardingComplete = useCallback(() => {
    if (onboardingKey) localStorage.setItem(onboardingKey, "1");
    setShowOnboarding(false);
    // Recharger les contacts après l'onboarding
    loadContacts();
    loadConversations();
  }, [onboardingKey]); // eslint-disable-line

  // ── Audio ──
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

  // ── Data loading ──
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

  const handleSyncComplete = useCallback((newContacts) => {
    loadContacts();
    loadConversations();
    if (newContacts.length > 0) showToast(`${newContacts.length} nouveaux amis trouvés !`, "success");
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

  const handleAddContact = useCallback(async (contactData) => {
    const result = await API.addContact(token, contactData);
    if (result.success) {
      showToast("✅ Contact ajouté !", "success");
      loadContacts(); loadConversations(); setShowAddContact(false);
    } else if (result.canInvite) showToast("Contact hors app - invitation disponible", "info");
  }, [token, loadContacts, loadConversations, showToast]);

  const handleAcceptPendingRequest = useCallback(async (request) => {
    try {
      await API.acceptMessageRequest(token, request._id);
      showToast("✅ Demande acceptée !", "success");
      loadContacts(); loadConversations(); setShowPendingModal(false);
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
    if (view === "chat") { setView("conversations"); setSelectedContact(null); setMessages([]); }
    else if (view === "conversations") setView("contacts");
  }, [view]);

  const handleGoHome = useCallback(() => navigate("/"), [navigate]);

  const handleDeleteMessage = useCallback(async (messageId) => {
    if (!selectedContact || !user?.id) return;
    try {
      setMessages((prev) => prev.filter((m) => m._id !== messageId));
      await messageCache.deleteMessage(user.id, selectedContact.id, messageId);
      if (socket?.connected) socket.emit("deleteMessage", { messageId, conversationId: selectedContact.id });
      showToast("Message supprimé", "success");
    } catch { showToast("Erreur lors de la suppression", "error"); }
  }, [selectedContact, user, socket, showToast]);

  // ── Effects ──
  useEffect(() => {
    if (!showOnboarding) { loadContacts(); loadConversations(); }
  }, [loadContacts, loadConversations, showOnboarding]);

  // Ouverture auto depuis ProfileHeader
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

  // ─────────────────────────────────────────────
  // RENDU : écran onboarding affiché en overlay
  // ─────────────────────────────────────────────
  return (
    <>
      {/* ── ONBOARDING OVERLAY ── */}
      <AnimatePresence>
        {showOnboarding && (
          <OnboardingPhoneScreen
            user={user}
            onComplete={handleOnboardingComplete}
          />
        )}
      </AnimatePresence>

      {/* ── APP PRINCIPALE ── */}
      <div className={`flex h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 text-white overflow-hidden ${showOnboarding ? "pointer-events-none" : ""}`}>

        {/* VUE CONTACTS */}
        {view === "contacts" && (
          <motion.div
            initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }}
            className="w-full h-full flex flex-col"
          >
            <div className="bg-[#12151a]/90 backdrop-blur-xl border-b border-white/5 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button onClick={handleGoHome} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                  <Home size={20} />
                </button>
                <div className="flex items-center gap-2">
                  <Users size={22} className="text-blue-500" />
                  <h1 className="text-xl font-bold">Mes Contacts</h1>
                </div>
              </div>
              <button
                onClick={() => setView("conversations")}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl transition-all"
              >
                <MessageSquare size={18} />
                <span className="text-sm font-semibold">Conversations</span>
                {conversations.length > 0 && (
                  <span className="bg-white/20 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    {conversations.length}
                  </span>
                )}
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <ContactSidebar
                token={token}
                contacts={contacts}
                selectedContact={selectedContact}
                onContactSelect={handleContactSelect}
                unreadCounts={unreadCounts}
                onlineUsers={onlineUsers}
                user={user}
                onSyncComplete={handleSyncComplete}
                onShowAddContact={() => setShowAddContact(true)}
                onShowPending={() => setShowPendingModal(true)}
              />
            </div>
          </motion.div>
        )}

        {/* VUE CONVERSATIONS */}
        {view === "conversations" && (
          <motion.div
            initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 20, opacity: 0 }}
            className="w-full h-full flex flex-col"
          >
            <div className="bg-[#12151a]/90 backdrop-blur-xl border-b border-white/5 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button onClick={handleBack} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                  <ArrowLeft size={20} />
                </button>
                <div className="flex items-center gap-2">
                  <MessageSquare size={22} className="text-purple-500" />
                  <h1 className="text-xl font-bold">Conversations</h1>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setView("contacts")} className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-xl transition-all">
                  <Users size={18} /><span className="text-sm font-semibold">Contacts</span>
                </button>
                <button onClick={handleGoHome} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                  <Home size={20} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="w-8 h-8 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                </div>
              ) : conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full">
                  <MessageSquare size={64} className="text-gray-600 mb-4" />
                  <p className="text-gray-500 text-center">
                    Aucune conversation active<br />
                    <span className="text-sm">Synchronisez vos contacts pour commencer</span>
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {conversations.map((conv) => (
                    <button
                      key={conv.id}
                      onClick={() => handleContactSelect(conv)}
                      className="w-full flex items-center gap-4 p-4 bg-white/5 hover:bg-white/10 rounded-2xl transition-all border border-white/5"
                    >
                      <div className="relative flex-shrink-0">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-xl font-black overflow-hidden">
                          {conv.profilePhoto
                            ? <img src={conv.profilePhoto} alt="" className="w-full h-full object-cover" />
                            : conv.fullName?.[0]?.toUpperCase() || "?"}
                        </div>
                        {conv.isOnline && <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-[#12151a]" />}
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="font-bold text-white truncate">{conv.fullName}</h3>
                          {conv.lastMessageTime && (
                            <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                              {new Date(conv.lastMessageTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-gray-400 truncate flex-1">
                            {conv.lastMessageType === "system" && "📱 "}{conv.lastMessage || "Aucun message"}
                          </p>
                          {conv.unreadCount > 0 && (
                            <span className="bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ml-2">
                              {conv.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* VUE CHAT */}
        {view === "chat" && selectedContact && (
          <motion.div
            initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 20, opacity: 0 }}
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

        {/* MODALES */}
        {showPhoneModal && (
          <PhoneNumberModal isOpen={showPhoneModal} onClose={() => setShowPhoneModal(false)} onSubmit={handlePhoneSubmit} canSkip />
        )}
        {showAddContact && (
          <AddContactModal isOpen={showAddContact} onClose={() => setShowAddContact(false)} onAdd={handleAddContact} />
        )}
        {showPendingModal && (
          <PendingMessagesModal
            isOpen={showPendingModal} onClose={() => setShowPendingModal(false)}
            onAccept={handleAcceptPendingRequest}
            onReject={async (requestId) => {
              try { await API.rejectMessageRequest(token, requestId); showToast("Demande rejetée", "info"); loadConversations(); }
              catch { showToast("Erreur", "error"); }
            }}
            onOpenConversation={(request) => { handleContactSelect(request.sender); setShowPendingModal(false); }}
          />
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
      </div>
    </>
  );
}