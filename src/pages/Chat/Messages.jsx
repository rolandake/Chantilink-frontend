// ============================================
// 📁 src/pages/Chat/Messages.jsx
// VERSION FINALE : Modal Numéro + Synchro + Appels
// ============================================

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { 
  ArrowLeft, ShieldCheck, Lock, X, Zap 
} from "lucide-react";

// === CONTEXTS & SERVICES ===
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { API } from "../../services/apiService";
import MediaService from "../../services/mediaService";

// === COMPONENTS ===
import IncomingCallModal from "../../components/IncomingCallModal";
import CallManager from "../../components/CallManager";
import { PhoneNumberModal } from "./components/PhoneNumberModal";
import { ContactSidebar } from "./ContactSidebar";
import { ChatHeader } from "./components/ChatHeader";
import { MessagesList } from "./components/MessagesList";
import { ChatInput } from "./components/ChatInput";

// === HOOKS PERSONNALISÉS ===
import { useAudioRecording } from "../../hooks/useAudioRecording";
import { useMessagesData } from "./hooks/useMessagesData";
import { useCallManager } from "./hooks/useCallManager";
import { useSocketHandlers } from "./hooks/useSocketHandlers";

export default function Messages() {
  const { user, token, socket, updateUser } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  // --- ÉTATS LOCAUX ---
  const [input, setInput] = useState("");
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const processedMessagesRef = useRef(new Set());
  const connected = socket?.connected || false;

  // === INITIALISATION DES DONNÉES ET APPELS ===
  const { ui, setUi, data, setData, sel, setSel, load } = useMessagesData(token, showToast);
  
  const { 
    call, setCall, incomingCall, setIncomingCall, 
    startCall, endCall, cleanupCallRingtone 
  } = useCallManager(sel, connected, 
    (d) => socket?.emit("call-user", d), 
    (d) => socket?.emit("call-ended", d), 
    (d) => socket?.emit("sendMessage", d), 
    showToast
  );

  const {
    recording, audioBlob, startRecording, stopRecording, cancelAudio
  } = useAudioRecording(token, showToast);

  // === GESTION DES SOCKETS ===
  useSocketHandlers({
    connected, 
    on: (e, f) => socket?.on(e, f), 
    off: (e, f) => socket?.off(e, f),
    getUnreadCounts: () => socket?.emit("getUnreadCounts"),
    markAsRead: (id) => socket?.emit("markMessagesAsRead", { senderId: id }),
    acceptCall: (d) => socket?.emit("call-answer", d),
    rejectCall: (d) => socket?.emit("call-rejected", d),
    socketEndCall: (d) => socket?.emit("call-ended", d),
    user, sel, data, setData, setUi, setIncomingCall,
    showToast, processedMessagesRef, cleanupCallRingtone, 
    sendMessage: (d) => socket?.emit("sendMessage", d)
  });

  // ============================================
  // 🔔 VÉRIFIER SI L'UTILISATEUR A UN NUMÉRO
  // ============================================
  useEffect(() => {
    // Si l'user n'a pas de numéro ET n'a jamais vu la modal
    if (user && !user.phone && !user.hasSeenPhoneModal) {
      console.log("📱 [Messages] User sans numéro détecté, affichage modal");
      // Attendre 1 seconde avant d'afficher (meilleure UX)
      const timer = setTimeout(() => {
        setShowPhoneModal(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [user]);

  // ============================================
  // 📞 SOUMETTRE LE NUMÉRO DE TÉLÉPHONE
  // ============================================
  const handlePhoneSubmit = async (phoneNumber) => {
    try {
      console.log(`📞 [Messages] Soumission numéro: ${phoneNumber}`);
      
      // Appeler l'API pour mettre à jour le téléphone
      const response = await fetch(`${API.BASE_URL}/auth/update-phone`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ phone: phoneNumber })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Erreur lors de la mise à jour');
      }

      console.log("✅ [Messages] Numéro mis à jour:", data.user);

      // Mettre à jour le contexte utilisateur
      if (updateUser) {
        updateUser(data.user);
      }

      // Marquer la modal comme vue
      await fetch(`${API.BASE_URL}/users/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ hasSeenPhoneModal: true })
      });

      showToast("Numéro enregistré avec succès ! 🎉", "success");
      setShowPhoneModal(false);

      // Proposer une synchro automatique
      setTimeout(() => {
        if (window.confirm("Voulez-vous synchroniser vos contacts maintenant ?")) {
          // Trigger sync depuis le ContactSidebar
          document.querySelector('[title="Synchroniser mes contacts"]')?.click();
        }
      }, 1500);

    } catch (error) {
      console.error("❌ [Messages] Erreur soumission numéro:", error);
      throw error; // Le PhoneNumberModal gère l'affichage de l'erreur
    }
  };

  // === ACTIONS DE MESSAGERIE ===

  const loadConversation = useCallback(async (withId) => {
    setUi(p => ({ ...p, load: true }));
    try {
      const result = await API.getMessages(token, withId);
      setData(p => ({ ...p, msg: Array.isArray(result) ? result : (result.messages || []) }));
      socket?.emit("markMessagesAsRead", { senderId: withId });
    } catch (e) {
      showToast("Erreur de synchronisation des messages", "error");
    } finally { setUi(p => ({ ...p, load: false })); }
  }, [token, socket, setData, setUi, showToast]);

  const handlePickContact = useCallback((contact) => {
    if (!contact?.id) return;
    setSel({ friend: contact, msg: null });
    loadConversation(contact.id);
  }, [loadConversation, setSel]);

  const handleSend = useCallback(() => {
    if (!sel.friend || !input.trim() || !connected) return;
    socket.emit("sendMessage", { 
      recipientId: sel.friend.id, 
      content: input.trim(), 
      type: 'text' 
    });
    setInput("");
  }, [sel.friend, input, connected, socket]);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !sel.friend) return;

    setUi(p => ({ ...p, up: true }));
    try {
      const result = await MediaService.sendMediaMessage(token, socket, {
        file,
        recipientId: sel.friend.id,
        onProgress: (p) => console.log(`Upload: ${p.progress}%`)
      });
      if (result.success) showToast("Fichier envoyé avec succès", "success");
    } catch (err) {
      showToast(err.message, "error");
    } finally { setUi(p => ({ ...p, up: false })); }
  };

  const handleVoiceSend = async () => {
    if (!audioBlob || !sel.friend) return;
    setUi(p => ({ ...p, up: true }));
    try {
      await MediaService.sendVoiceMessage(token, socket, {
        audioBlob,
        recipientId: sel.friend.id
      });
      cancelAudio();
    } catch (err) {
      showToast("Échec de l'envoi du message vocal", "error");
    } finally { setUi(p => ({ ...p, up: false })); }
  };

  // ==========================================
  // RENDU
  // ==========================================

  return (
    <div className="fixed inset-0 flex bg-[#0b0d10] text-white overflow-hidden font-sans">
      
      {/* --- SIDEBAR : LISTE DES CONTACTS --- */}
      <div className={`
        flex-shrink-0 w-full md:w-[380px] lg:w-[420px] border-r border-white/5 bg-[#12151a] flex flex-col
        transition-all duration-300 ease-in-out
        ${sel.friend ? "-translate-x-full md:translate-x-0" : "translate-x-0"}
      `}>
        <div className="p-5 flex items-center justify-between bg-[#12151a]/80 backdrop-blur-xl border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/10 rounded-2xl text-blue-500 shadow-inner">
              <ShieldCheck size={22} strokeWidth={2.5} />
            </div>
            <h1 className="text-xl font-black tracking-tight">Messages</h1>
          </div>
          <button onClick={() => navigate("/")} className="p-2 hover:bg-white/5 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        <ContactSidebar
          token={token}
          user={user}
          contacts={data.conn}
          onContactSelect={handlePickContact}
          unreadCounts={data.unread}
          onlineUsers={onlineUsers}
          loading={ui.load}
        />
      </div>

      {/* --- ZONE DE CHAT PRINCIPALE --- */}
      <div className={`
        flex-1 flex flex-col relative bg-[#0b0d10]
        transition-all duration-300 ease-in-out
        ${sel.friend ? "translate-x-0" : "translate-x-full md:translate-x-0"}
      `}>
        <AnimatePresence mode="wait">
          {sel.friend ? (
            <motion.div 
              key={sel.friend.id}
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
              className="flex flex-col h-full"
            >
              {/* Header Chat */}
              <div className="h-16 flex-none border-b border-white/5 px-4 flex items-center justify-between bg-[#12151a]/90 backdrop-blur-md z-30">
                <div className="flex items-center gap-3">
                  <button onClick={() => setSel({ friend: null })} className="md:hidden p-2 -ml-2 text-gray-400">
                    <ArrowLeft size={24} />
                  </button>
                  <ChatHeader 
                    friend={sel.friend} 
                    onlineUsers={onlineUsers} 
                    onVideoCall={() => startCall('video')}
                    onAudioCall={() => startCall('audio')}
                  />
                </div>
                <div className="flex items-center gap-2 px-3 py-1 bg-green-500/5 border border-green-500/20 rounded-full">
                  <Lock size={10} className="text-green-500" />
                  <span className="text-[9px] text-green-500 font-black uppercase tracking-widest">Sécurisé</span>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-hidden relative">
                <div className="absolute inset-0 bg-[url('/chat-pattern.png')] opacity-[0.03] pointer-events-none" />
                <MessagesList
                  messages={data.msg}
                  currentUserId={user?.id}
                  onDeleteMessage={(id) => API.deleteMessage(token, id)}
                />
              </div>

              {/* Input */}
              <div className="p-4 bg-[#12151a]/95 backdrop-blur-xl border-t border-white/5">
                <ChatInput
                  input={input}
                  onChange={(e) => setInput(e.target.value)}
                  onSend={handleSend}
                  onUpload={handleFileUpload}
                  recording={recording}
                  onStartRecording={startRecording}
                  onStopRecording={stopRecording}
                  onSendAudio={handleVoiceSend}
                  uploading={ui.up}
                />
              </div>
            </motion.div>
          ) : (
            /* État vide */
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                className="w-24 h-24 bg-blue-500/5 rounded-[40px] flex items-center justify-center mb-6 border border-blue-500/10 shadow-2xl"
              >
                <ShieldCheck size={48} className="text-blue-500/50" />
              </motion.div>
              <h2 className="text-2xl font-black mb-3">Communications Privées</h2>
              <p className="text-gray-500 max-w-sm text-sm leading-relaxed">
                Toutes vos conversations et fichiers partagés sont protégés par un chiffrement de niveau industriel.
              </p>
              <div className="mt-8 flex items-center gap-6 opacity-20">
                <Zap size={20} /> <Lock size={20} /> <ShieldCheck size={20} />
              </div>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* --- MODALS --- */}
      <AnimatePresence>
        {/* Modal Numéro de Téléphone */}
        {showPhoneModal && (
          <PhoneNumberModal
            isOpen={showPhoneModal}
            onClose={() => setShowPhoneModal(false)}
            onSubmit={handlePhoneSubmit}
            canSkip={true}
          />
        )}

        {/* Modal Appel Entrant */}
        {incomingCall && (
          <IncomingCallModal
            caller={incomingCall.caller}
            type={incomingCall.type}
            onAccept={() => {
              socket.emit("call-answer", { to: incomingCall.callId });
              setCall({ on: true, ...incomingCall, isIncoming: true });
              setIncomingCall(null);
            }}
            onReject={() => {
              socket.emit("call-rejected", { to: incomingCall.callId });
              setIncomingCall(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* Manager d'Appel */}
      {call.on && (
        <CallManager call={call} onEndCall={endCall} />
      )}
    </div>
  );
}