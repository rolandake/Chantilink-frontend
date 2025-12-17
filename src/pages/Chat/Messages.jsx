// ============================================
// 📁 src/pages/Chat/Messages.jsx
// VERSION: FINAL INTEGRATED
// ============================================

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

// === CONTEXTS ===
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";

// === COMPONENTS ===
import IncomingCallModal from "../../components/IncomingCallModal";
import MissedCallNotification from "../../components/MissedCallNotification";
import PhoneModal from "../../components/PhoneModal";
import CallManager from "../../components/CallManager";

// === CHAT MODULES ===
import { ContactSidebar } from "./ContactSidebar";
import { ChatHeader } from "./components/ChatHeader";
import { MessagesList } from "./components/MessagesList";
import { ChatInput } from "./components/ChatInput";
import { AddContactModal } from "./AddContactModal";
import { PendingMessagesModal } from "./PendingMessagesModal";

// === HOOKS ===
import { useAudioRecording } from "../../hooks/useAudioRecording";
import { useMessagesData } from "./hooks/useMessagesData";
import { useCallManager } from "./hooks/useCallManager";
import { useSocketHandlers } from "./hooks/useSocketHandlers";

// === SERVICES & UTILS ===
import { API } from "../../services/apiService";
import { MSG } from "../../utils/messageConstants";

// ANIMATIONS
const pageVariants = {
  initial: (direction) => ({
    x: direction > 0 ? "100%" : "-100%",
    opacity: 0,
    scale: 0.95
  }),
  animate: {
    x: 0,
    opacity: 1,
    scale: 1,
    transition: { type: "spring", stiffness: 260, damping: 30 }
  },
  exit: (direction) => ({
    x: direction < 0 ? "100%" : "-100%",
    opacity: 0,
    scale: 0.95,
    transition: { duration: 0.2, ease: "easeInOut" }
  })
};

export default function Messages() {
  const { user, token, socket } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  // --- LOCAL STATE ---
  const [input, setInput] = useState("");
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  
  // --- REFS ---
  const endRef = useRef(null);
  const txtRef = useRef(null);
  const fileRef = useRef(null);
  const typeRef = useRef(null);
  const processedMessagesRef = useRef(new Set());
  
  const connected = socket?.connected || false;

  // === SOCKET EMITTERS ===
  const sendMessage = useCallback((data) => socket?.connected && socket.emit("sendMessage", data), [socket]);
  const markAsRead = useCallback((senderId) => socket?.connected && socket.emit("markMessagesAsRead", { senderId }), [socket]);
  const startTyping = useCallback((recipientId) => socket?.connected && socket.emit("typing", { recipientId }), [socket]);
  const stopTyping = useCallback((recipientId) => socket?.connected && socket.emit("stopTyping", { recipientId }), [socket]);
  const getUnreadCounts = useCallback(() => socket?.connected && socket.emit("getUnreadCounts"), [socket]);

  // Call Emitters
  const initiateCall = useCallback((data) => socket?.emit("call-user", data), [socket]);
  const acceptCall = useCallback((data) => socket?.emit("call-answer", data), [socket]);
  const rejectCall = useCallback((data) => socket?.emit("call-rejected", data), [socket]);
  const socketEndCall = useCallback((data) => socket?.emit("call-ended", data), [socket]);

  const on = useCallback((evt, fn) => socket?.on(evt, fn), [socket]);
  const off = useCallback((evt, fn) => socket?.off(evt, fn), [socket]);

  // === DATA HOOKS ===
  const { ui, setUi, data, setData, sel, setSel, load } = useMessagesData(token, showToast);
  
  const { 
    call, setCall, incomingCall, setIncomingCall, missedCallNotification, setMissedCallNotification,
    startCall, endCall, cleanupCallRingtone 
  } = useCallManager(sel, connected, initiateCall, socketEndCall, sendMessage, showToast);

  const {
    recording, audioBlob, audioUrl, isPlaying, audioRef,
    startRecording, stopRecording, cancelAudio, playPreview, pausePreview
  } = useAudioRecording(token, showToast);

  // === GLOBAL SOCKET LISTENERS ===
  useEffect(() => {
    if (!socket) return;
    socket.emit("getOnlineUsers");
    socket.emit("getUnreadCounts");

    const handleOnlineUsers = (users) => setOnlineUsers(users || []);
    const handleTyping = ({ senderId }) => setTypingUsers(prev => [...prev, senderId]);
    const handleStopTyping = ({ senderId }) => setTypingUsers(prev => prev.filter(id => id !== senderId));
    
    // Suppression temps réel
    const handleMessageDeleted = ({ messageId }) => {
      setData(p => ({ ...p, msg: p.msg.filter(m => m._id !== messageId) }));
    };

    socket.on("getOnlineUsers", handleOnlineUsers);
    socket.on("onlineUsers", handleOnlineUsers);
    socket.on("typing", handleTyping);
    socket.on("stopTyping", handleStopTyping);
    socket.on("messageDeleted", handleMessageDeleted);

    return () => {
      socket.off("getOnlineUsers", handleOnlineUsers);
      socket.off("onlineUsers", handleOnlineUsers);
      socket.off("typing", handleTyping);
      socket.off("stopTyping", handleStopTyping);
      socket.off("messageDeleted", handleMessageDeleted);
    };
  }, [socket, setData]);

  // === BUSINESS LOGIC HOOKS ===
  useSocketHandlers({
    connected, on, off, getUnreadCounts, markAsRead, acceptCall, rejectCall, socketEndCall,
    user, sel, data, setData, setUi, setIncomingCall, setMissedCallNotification,
    showToast, processedMessagesRef, cleanupCallRingtone, sendMessage
  });

  // Chargement conversation
  const loadConversation = useCallback(async (withId) => {
    setUi(p => ({ ...p, load: true }));
    try {
      const result = await API.getMessages(token, withId);
      const messages = Array.isArray(result) ? result : (result.messages || []);
      setData(p => ({ ...p, msg: messages }));
      markAsRead(withId);
      setData(p => ({ ...p, unread: { ...p.unread, [withId]: 0 } }));
    } catch (e) { showToast("Erreur chargement messages", "error"); }
    finally { setUi(p => ({ ...p, load: false })); }
  }, [token, markAsRead, setData, setUi, showToast]);

  // Sélection d'un contact
  const pick = useCallback((f) => {
    if (!f?.id) return;
    processedMessagesRef.current.clear();
    setSel({ friend: f, msg: null });
    setData(p => ({ ...p, msg: [] }));
    loadConversation(f.id);
  }, [loadConversation, setSel, setData]);

  // Navigation Retour
  const handleMainBack = () => {
    if (sel.friend) {
      setSel({ friend: null, msg: null });
      setData(p => ({ ...p, msg: [] }));
    } else {
      navigate("/");
    }
  };

  // SEND TEXT
  const type = useCallback(e => {
    setInput(e.target.value);
    if (txtRef.current) {
        txtRef.current.style.height = 'auto';
        txtRef.current.style.height = txtRef.current.scrollHeight + 'px';
    }
    if (sel.friend && connected) {
      startTyping(sel.friend.id);
      clearTimeout(typeRef.current);
      typeRef.current = setTimeout(() => stopTyping(sel.friend.id), 1000);
    }
  }, [sel.friend, connected, startTyping, stopTyping]);

  const send = useCallback(() => {
    if (!sel.friend || !input.trim() || !connected) return;
    const tempId = `temp-${Date.now()}`;
    const newMsg = {
      _id: tempId, sender: { _id: user.id }, recipient: sel.friend.id,
      content: input.trim(), timestamp: new Date().toISOString(), status: 'sending', type: 'text'
    };
    
    // UI Optimiste
    setData(p => ({ ...p, msg: [...p.msg, newMsg] }));
    
    const sent = sendMessage({ recipientId: sel.friend.id, content: input.trim(), type: 'text' });
    if (sent) {
      setInput("");
      if (txtRef.current) txtRef.current.style.height = 'auto';
      stopTyping(sel.friend.id);
    } else {
      showToast(MSG.err.send, 'error');
      setData(p => ({ ...p, msg: p.msg.filter(m => m._id !== tempId) }));
    }
  }, [sel.friend, input, connected, sendMessage, stopTyping, showToast, user.id, setData]);

  // --- 1. GESTION UPLOAD FICHIERS (IMAGE/VIDEO/FILE) ---
  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !sel.friend) return;

    // Limite 50Mo
    if (file.size > 50 * 1024 * 1024) {
      showToast("Fichier trop volumineux (>50Mo)", "error");
      return;
    }

    setUi(p => ({ ...p, up: true }));
    try {
      const formData = new FormData();
      formData.append("file", file);

      // Appel Service API
      const response = await API.uploadFile(token, formData);
      
      if (response && response.url) {
        // Détection Type
        let msgType = 'file';
        if (file.type.startsWith('image/')) msgType = 'image';
        else if (file.type.startsWith('video/')) msgType = 'video';
        else if (file.type.startsWith('audio/')) msgType = 'audio';

        // Envoi Socket
        sendMessage({
          recipientId: sel.friend.id,
          content: response.url,
          type: msgType,
          fileName: file.name
        });
      }
    } catch (error) {
      console.error("Upload error:", error);
      showToast("Erreur lors de l'envoi du fichier", "error");
    } finally {
      setUi(p => ({ ...p, up: false }));
      if (fileRef.current) fileRef.current.value = ""; // Reset input
    }
  };

  // --- 2. GESTION ENVOI AUDIO ---
  const sendAudio = async () => {
    if (!audioBlob || !sel.friend) return;
    
    setUi(p => ({ ...p, up: true }));
    try {
      const formData = new FormData();
      // Nommage important pour le backend
      formData.append("file", audioBlob, "voice_message.webm");

      const response = await API.uploadFile(token, formData);

      if (response && response.url) {
        sendMessage({ 
          recipientId: sel.friend.id, 
          content: response.url, 
          type: "audio" 
        });
        cancelAudio();
      }
    } catch (error) {
      console.error("Audio error:", error);
      showToast("Erreur envoi vocal", "error");
    } finally {
      setUi(p => ({ ...p, up: false }));
    }
  };

  // --- 3. GESTION SYNC CONTACTS ---
  const handleSyncContacts = async () => {
    setUi(p => ({ ...p, load: true }));
    try {
      let contactsToSend = [];
      // Vérifier support navigateur
      if ('contacts' in navigator && 'ContactsManager' in window) {
        try {
          const props = ['name', 'tel'];
          const contacts = await navigator.contacts.select(props, { multiple: true });
          contactsToSend = contacts.map(c => ({
            name: c.name?.[0] || "Sans nom",
            phone: c.tel?.[0] || ""
          }));
        } catch (err) {
          // Annulation utilisateur ou erreur
          console.warn("Acces contacts refusé ou annulé");
        }
      } else {
        showToast("Synchro automatique non supportée, rafraîchissement...", "info");
      }

      // Appel API (Même si liste vide, pour rafraîchir les status)
      const result = await API.syncContacts(token, contactsToSend);
      
      if (result.data?.syncedContacts) {
        // Mise à jour locale (si votre useMessagesData le permet, sinon recharger page)
        // setData(p => ({ ...p, conn: result.connections })); // Idéalement
        window.location.reload(); // Solution brute mais efficace pour mettre à jour la Sidebar
      }
      showToast(result.message || "Contacts synchronisés", "success");
    } catch (e) {
      console.error(e);
      showToast("Erreur synchronisation", "error");
    } finally {
      setUi(p => ({ ...p, load: false }));
    }
  };

  const handleInvite = async (contact) => {
    try {
      await API.inviteContact(token, { phoneNumber: contact.phone, fullName: contact.fullName });
      showToast(`Invitation envoyée à ${contact.fullName}`, "success");
    } catch (e) {
      showToast("Erreur invitation", "error");
    }
  };

  // Suppression Message
  const handleDeleteMessage = useCallback(async (msgId) => {
    if (!window.confirm("Supprimer ce message ?")) return;
    try {
      setData(p => ({ ...p, msg: p.msg.filter(m => m._id !== msgId) }));
      await API.deleteMessage(token, msgId);
      if (socket?.connected && sel.friend) socket.emit("deleteMessage", { messageId: msgId, recipientId: sel.friend.id });
    } catch (e) { showToast("Erreur suppression", "error"); loadConversation(sel.friend.id); }
  }, [token, socket, sel.friend, setData, showToast, loadConversation]);


  // Scroll automatique
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [data.msg, typingUsers]);

  // Filtering Logic
  const filteredContacts = useMemo(() => {
    let list = ui.search 
      ? data.conn.filter(c => c?.fullName?.toLowerCase().includes(ui.search.toLowerCase())) 
      : data.conn;
    return list.sort((a, b) => (data.unread[b.id] || 0) - (data.unread[a.id] || 0));
  }, [data.conn, ui.search, data.unread]);

  // Direction animation
  const direction = sel.friend ? 1 : -1;

  return (
    <>
      {/* BOUTON RETOUR FLOTTANT */}
      <motion.button
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={handleMainBack}
        className="fixed top-4 left-4 z-[50] p-3 bg-white/10 hover:bg-white/20 text-white rounded-full shadow-lg backdrop-blur-md border border-white/10 transition-colors"
      >
        <ArrowLeft className="w-5 h-5" />
      </motion.button>

      {/* CONTENEUR FLUIDE */}
      <div className="fixed inset-0 bg-gray-900 w-full h-full overflow-hidden font-sans">
        <AnimatePresence initial={false} custom={direction} mode="wait">
          
          {/* VUE 1 : LISTE DES CONTACTS */}
          {!sel.friend ? (
            <motion.div
              key="contact-list"
              custom={direction}
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="absolute inset-0 w-full h-full flex flex-col bg-gradient-to-br from-gray-900 via-gray-800 to-black"
            >
              <div className="flex-1 w-full max-w-5xl mx-auto h-full overflow-hidden flex flex-col pt-16 md:pt-4">
                <ContactSidebar
                  contacts={filteredContacts}
                  stats={data.stats}
                  searchQuery={ui.search}
                  onSearchChange={(q) => setUi(p => ({ ...p, search: q }))}
                  onContactSelect={pick}
                  onAddContact={() => setUi(p => ({ ...p, showAddContact: true }))}
                  onShowPending={() => setUi(p => ({ ...p, showPending: true }))}
                  // ✅ PROPS AJOUTÉES POUR LE SERVICE
                  onSyncContacts={handleSyncContacts}
                  onInviteContact={handleInvite}
                  // --------------------------------
                  unreadCounts={data.unread}
                  onlineUsers={onlineUsers}
                  pendingCount={data.pendingRequests?.length || 0}
                  connected={connected}
                  className="h-full w-full"
                />
              </div>
            </motion.div>
          ) : (
            
            /* VUE 2 : INTERFACE DE CHAT */
            <motion.div
              key="chat-interface"
              custom={direction}
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="absolute inset-0 w-full h-full flex flex-col bg-gray-900"
            >
              <ChatHeader
                friend={sel.friend}
                typingUsers={typingUsers}
                onlineUsers={onlineUsers}
                connected={connected}
                onVideoCall={() => startCall('video')}
                onAudioCall={() => startCall('audio')}
                className="pl-16 shadow-md z-10 bg-gray-800/90 backdrop-blur"
              />

              <div className="flex-1 overflow-hidden relative">
                <MessagesList
                  messages={data.msg}
                  loading={ui.load}
                  currentUserId={user?.id}
                  onSelectMessage={(m) => setSel(p => ({ ...p, msg: m }))}
                  onDeleteMessage={handleDeleteMessage}
                  endRef={endRef}
                />
              </div>

              <ChatInput
                input={input}
                onChange={type}
                onSend={send}
                // ✅ PROPS AUDIO/UPLOAD CONNECTÉES
                recording={recording}
                onStartRecording={startRecording}
                onStopRecording={stopRecording}
                onCancelAudio={cancelAudio}
                onSendAudio={sendAudio}
                audioUrl={audioUrl}
                isPlaying={isPlaying}
                audioRef={audioRef}
                onPlayPreview={playPreview}
                onPausePreview={pausePreview}
                // Props UI
                showEmoji={ui.showEmoji}
                onToggleEmoji={() => setUi(p => ({ ...p, showEmoji: !p.showEmoji }))}
                onEmojiSelect={(e) => { setInput(p => p + e.emoji); setUi(p => ({ ...p, showEmoji: false })); }}
                uploading={ui.up}
                onUpload={handleUpload} // Connecté à la fonction réelle
                connected={connected}
                txtRef={txtRef}
                fileRef={fileRef}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* --- MODALES & OVERLAYS --- */}
      {/* Call UI */}
      {call.on && !call.isIncoming && (
        <CallManager
          call={call}
          onEndCall={endCall}
          onToggleMute={() => setCall(p => ({ ...p, mute: !p.mute }))}
          onToggleVideo={() => setCall(p => ({ ...p, video: !p.video }))}
        />
      )}

      <AnimatePresence>
        {incomingCall && (
          <IncomingCallModal
            caller={incomingCall.caller || incomingCall.friend}
            type={incomingCall.type}
            onAccept={() => {
              acceptCall({ to: incomingCall.callId });
              setCall({
                on: true, type: incomingCall.type, friend: incomingCall.friend,
                mute: false, video: incomingCall.type === "video", isIncoming: true, callId: incomingCall.callId
              });
              setIncomingCall(null);
            }}
            onReject={() => { rejectCall({ to: incomingCall.callId }); setIncomingCall(null); }}
          />
        )}
        
        {missedCallNotification && (
          <MissedCallNotification
            caller={missedCallNotification.caller}
            type={missedCallNotification.type}
            timestamp={missedCallNotification.timestamp}
            onCallBack={() => {
              const friend = data.conn.find(c => c.id === missedCallNotification.caller.id) || missedCallNotification.caller;
              setSel({ friend, msg: null });
              startCall(missedCallNotification.type);
              setMissedCallNotification(null);
            }}
            onDismiss={() => setMissedCallNotification(null)}
          />
        )}

        {ui.phone && <PhoneModal onSuccess={(u) => { setUi(p => ({...p, phone:false})); load(); }} onClose={() => setUi(p=>({...p, phone:false}))} />}
        {ui.showAddContact && <AddContactModal isOpen={ui.showAddContact} onClose={() => setUi(p=>({...p, showAddContact:false}))} onAdd={async (d) => { await API.addContact(token, d); load(); }} />}
        {ui.showPending && <PendingMessagesModal isOpen={ui.showPending} onClose={() => setUi(p=>({...p, showPending:false}))} onAccept={async (req) => { /* Logic accept */ load(); }} onReject={async (id) => { /* Logic reject */ }} />}
      </AnimatePresence>
    </>
  );
}