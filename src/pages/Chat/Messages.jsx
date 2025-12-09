// ============================================
// 📁 src/pages/Chat/Messages.jsx - VERSION FINALE
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

// === MODULES LOCAUX ===
import { ContactSidebar } from "./ContactSidebar";
import { ChatHeader } from "./components/ChatHeader";
import { MessagesList } from "./components/MessagesList";
import { ChatInput } from "./components/ChatInput";
import { EmptyState } from "./components/EmptyState";
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

// Configuration
const CFG = { MAX_LEN: 5000 };

export default function Messages() {
  const { user, token, socket } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [input, setInput] = useState("");
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const connected = socket?.connected || false;

  // === SOCKET EMITTERS (Shim Layer) ===
  const sendMessage = useCallback((data) => {
    if (socket?.connected) {
      socket.emit("sendMessage", data);
      return true;
    }
    return false;
  }, [socket]);

  const markAsRead = useCallback((senderId) => {
    if (socket?.connected) socket.emit("markMessagesAsRead", { senderId });
  }, [socket]);

  const startTyping = useCallback((recipientId) => {
    if (socket?.connected) socket.emit("typing", { recipientId });
  }, [socket]);

  const stopTyping = useCallback((recipientId) => {
    if (socket?.connected) socket.emit("stopTyping", { recipientId });
  }, [socket]);

  const getUnreadCounts = useCallback(() => {
    if (socket?.connected) socket.emit("getUnreadCounts");
  }, [socket]);

  const initiateCall = useCallback((data) => socket?.emit("call-user", data), [socket]);
  const acceptCall = useCallback((data) => socket?.emit("call-answer", data), [socket]);
  const rejectCall = useCallback((data) => socket?.emit("call-rejected", data), [socket]);
  const socketEndCall = useCallback((data) => socket?.emit("call-ended", data), [socket]);
  
  const on = useCallback((evt, fn) => socket?.on(evt, fn), [socket]);
  const off = useCallback((evt, fn) => socket?.off(evt, fn), [socket]);

  // === EFFETS GLOBAUX SOCKET ===
  useEffect(() => {
    if (!socket) return;
    socket.emit("getOnlineUsers");
    socket.emit("getUnreadCounts");

    const handleOnlineUsers = (users) => setOnlineUsers(users || []);
    const handleTyping = (data) => setTypingUsers(prev => [...prev, data.senderId]);
    const handleStopTyping = (data) => setTypingUsers(prev => prev.filter(id => id !== data.senderId));
    
    // Écouteur pour la suppression temps réel
    const handleMessageDeleted = ({ messageId }) => {
      console.log("🗑️ Message supprimé par le correspondant:", messageId);
      setData(p => ({
        ...p,
        msg: p.msg.filter(m => m._id !== messageId)
      }));
    };

    socket.on("getOnlineUsers", handleOnlineUsers);
    socket.on("onlineUsers", handleOnlineUsers);
    socket.on("typing", handleTyping);
    socket.on("stopTyping", handleStopTyping);
    socket.on("messageDeleted", handleMessageDeleted); // Nouveau listener

    return () => {
      socket.off("getOnlineUsers", handleOnlineUsers);
      socket.off("onlineUsers", handleOnlineUsers);
      socket.off("typing", handleTyping);
      socket.off("stopTyping", handleStopTyping);
      socket.off("messageDeleted", handleMessageDeleted);
    };
  }, [socket]); // Pas besoin de dépendance setData ici car utilisée via fonction update

  // === CUSTOM HOOKS ===
  const {
    ui, setUi,
    data, setData,
    sel, setSel,
    err, setErr,
    recon, setRecon,
    load
  } = useMessagesData(token, showToast);

  const {
    call, setCall,
    incomingCall, setIncomingCall,
    missedCallNotification, setMissedCallNotification,
    startCall,
    endCall,
    cleanupCallRingtone
  } = useCallManager(sel, connected, initiateCall, socketEndCall, sendMessage, showToast);

  const {
    recording, audioBlob, audioUrl, isPlaying, audioRef,
    startRecording, stopRecording, cancelAudio, playPreview, pausePreview
  } = useAudioRecording(token, showToast);

  const endRef = useRef(null);
  const txtRef = useRef(null);
  const fileRef = useRef(null);
  const typeRef = useRef(null);
  const processedMessagesRef = useRef(new Set());

  // === SOCKET HANDLERS (Gestion des messages entrants) ===
  useSocketHandlers({
    connected,
    on,
    off,
    getUnreadCounts,
    markAsRead,
    acceptCall,
    rejectCall,
    socketEndCall,
    user,
    sel,
    data,
    setData,
    setUi, 
    setIncomingCall,
    setMissedCallNotification,
    showToast,
    processedMessagesRef,
    cleanupCallRingtone,
    sendMessage
  });

  // =========================================================
  // 📥 CHARGEMENT CONVERSATION (Mode Hybride HTTP)
  // =========================================================
  const loadConversation = useCallback(async (withId) => {
    setUi(p => ({ ...p, load: true }));
    try {
      console.log("📥 [API] Chargement conversation:", withId);
      const result = await API.getMessages(token, withId);
      const messages = Array.isArray(result) ? result : (result.messages || []);
      
      setData(p => ({ ...p, msg: messages }));
      markAsRead(withId);
      setData(p => ({ ...p, unread: { ...p.unread, [withId]: 0 } }));
    } catch (error) {
      console.error("❌ Erreur chargement messages:", error);
      showToast("Erreur lors du chargement des messages", "error");
    } finally {
      setUi(p => ({ ...p, load: false }));
    }
  }, [token, markAsRead, setData, setUi, showToast]);

  const pick = useCallback((f) => {
    if (!f?.id || sel.friend?.id === f.id) return;
    processedMessagesRef.current.clear();
    setSel({ friend: f, msg: null });
    setData(p => ({ ...p, msg: [] }));
    loadConversation(f.id);
  }, [loadConversation, sel.friend?.id, setSel, setData]);

  // =========================================================
  // 🗑️ SUPPRESSION DE MESSAGE
  // =========================================================
  const handleDeleteMessage = useCallback(async (msgId) => {
    if (!window.confirm("Supprimer ce message pour tout le monde ?")) return;

    try {
      // 1. Suppression optimiste (Immédiat)
      setData(p => ({
        ...p,
        msg: p.msg.filter(m => m._id !== msgId)
      }));

      // 2. Appel API
      await API.deleteMessage(token, msgId);

      // 3. Prévenir le correspondant via Socket
      if (socket?.connected && sel.friend) {
        socket.emit("deleteMessage", { 
          messageId: msgId, 
          recipientId: sel.friend.id 
        });
      }

      showToast("Message supprimé", "success");
    } catch (err) {
      console.error("Erreur suppression:", err);
      showToast("Impossible de supprimer le message", "error");
      // Recharger pour remettre l'état correct si erreur
      loadConversation(sel.friend.id);
    }
  }, [token, socket, sel.friend, setData, showToast, loadConversation]);

  // =========================================================
  // ✉️ ENVOI DE MESSAGES (Texte, Fichier, Audio)
  // =========================================================
  
  const type = useCallback(e => {
    const v = e.target.value;
    setInput(v);
    if (txtRef.current) {
      txtRef.current.style.height = 'auto';
      txtRef.current.style.height = txtRef.current.scrollHeight + 'px';
    }
    if (!sel.friend || !connected) return;
    startTyping(sel.friend.id);
    clearTimeout(typeRef.current);
    typeRef.current = setTimeout(() => stopTyping(sel.friend.id), 1000);
  }, [sel.friend, connected, startTyping, stopTyping]);

  const send = useCallback(() => {
    if (!sel.friend || !input.trim() || input.length > CFG.MAX_LEN || !connected) return;

    const tempId = `temp-${Date.now()}-${Math.random()}`;
    const tempMessage = {
      _id: tempId,
      sender: { _id: user.id },
      recipient: sel.friend.id,
      content: input.trim(),
      timestamp: new Date().toISOString(),
      status: 'sending',
      type: 'text'
    };

    setData(p => ({ ...p, msg: [...p.msg, tempMessage] }));

    const sent = sendMessage({
      recipientId: sel.friend.id,
      content: input.trim(),
      type: 'text'
    });

    if (sent) {
      setInput("");
      stopTyping(sel.friend.id);
      if (txtRef.current) txtRef.current.style.height = 'auto';
    } else {
      setData(p => ({ ...p, msg: p.msg.filter(m => m._id !== tempId) }));
      showToast(MSG.err.send, 'error');
    }
  }, [sel.friend, input, connected, sendMessage, stopTyping, showToast, user.id, setData]);

  // 📎 Upload Fichier
  const upload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !sel.friend) return;

    setUi(p => ({ ...p, up: true }));
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('recipientId', sel.friend.id);

      const response = await API.uploadFile(token, formData);

      sendMessage({
        recipientId: sel.friend.id,
        content: "",
        type: response.type || "file",
        file: response.url // ✅ Clé correcte pour MessagesList
      });

      setData(p => ({
        ...p,
        msg: [...p.msg, {
          _id: `temp-${Date.now()}`,
          sender: { _id: user.id },
          recipient: sel.friend.id,
          content: "",
          file: response.url, // ✅ Clé correcte
          type: response.type || "file",
          timestamp: new Date().toISOString(),
          status: "sending"
        }]
      }));

      showToast('Fichier envoyé', 'success');
    } catch (err) {
      console.error('Erreur upload:', err);
      showToast('Erreur envoi fichier', 'error');
    } finally {
      setUi(p => ({ ...p, up: false }));
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  // 🎤 Envoi Audio
  const sendAudio = async () => {
    if (!audioBlob || !sel.friend) return;

    try {
      const formData = new FormData();
      formData.append('file', audioBlob, 'recording.wav'); // ✅ Clé 'file' requise par Multer
      formData.append('recipientId', sel.friend.id);

      const response = await API.uploadFile(token, formData);

      sendMessage({
        recipientId: sel.friend.id,
        content: "",
        type: "audio",
        file: response.url // ✅ Clé correcte
      });

      setData(p => ({
        ...p,
        msg: [...p.msg, {
          _id: `temp-${Date.now()}`,
          sender: { _id: user.id },
          recipient: sel.friend.id,
          content: "",
          file: response.url, // ✅ Clé correcte
          type: "audio",
          timestamp: new Date().toISOString(),
          status: "sending"
        }]
      }));

      cancelAudio();
      showToast('Message vocal envoyé', 'success');
    } catch (err) {
      console.error('Erreur envoi audio:', err);
      showToast('Erreur envoi message vocal', 'error');
    }
  };

  // === CALCULS UI ===
  const filt = useMemo(() => {
    let filtered = ui.search
      ? (data.conn || []).filter(c =>
          c?.fullName?.toLowerCase().includes(ui.search.toLowerCase()) ||
          c?.phone?.includes(ui.search)
        )
      : data.conn;

    if (ui.contactFilter === 'chantilink') {
      filtered = filtered.filter(c => c?.isOnChantilink);
    } else if (ui.contactFilter === 'other') {
      filtered = filtered.filter(c => !c?.isOnChantilink);
    }
    return filtered;
  }, [data.conn, ui.search, ui.contactFilter]);

  const sorted = useMemo(() =>
    [...filt].sort((a, b) =>
      ((data.unread[b?.id] || 0) - (data.unread[a?.id] || 0)) ||
      (onlineUsers.includes(b?.id) ? 1 : 0) - (onlineUsers.includes(a?.id) ? 1 : 0)
    ),
    [filt, data.unread, onlineUsers]
  );

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [data.msg]);

  // Acceptation demande de contact
  const handleAcceptRequest = async (request) => {
    try {
      const newContact = {
        id: request.sender._id,
        _id: request.sender._id,
        fullName: request.sender.fullName,
        username: request.sender.username,
        phone: request.sender.phone,
        isOnChantilink: true,
        profilePhoto: request.sender.profilePhoto
      };

      await API.acceptMessageRequest(token, request._id);

      setData(p => {
        const exists = p.conn.some(c => c.id === newContact.id);
        if (exists) return { ...p, pendingRequests: p.pendingRequests.filter(r => r._id !== request._id) };
        return {
          ...p,
          conn: [...p.conn, newContact],
          pendingRequests: p.pendingRequests.filter(r => r._id !== request._id),
          stats: { ...p.stats, total: p.stats.total + 1, onChantilink: p.stats.onChantilink + 1 },
          unread: { ...p.unread, [newContact.id]: 0 }
        };
      });

      setUi(p => ({ ...p, showPending: false }));
      setTimeout(() => pick(newContact), 100);
      showToast(`${newContact.fullName} ajouté`, "success");
    } catch (err) {
      showToast("Erreur acceptation", "error");
    }
  };

  return (
    <>
      <motion.button
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={() => navigate("/")}
        className="fixed top-4 left-4 z-[100] p-3 bg-gradient-to-r from-orange-500 to-pink-500 text-white rounded-full shadow-2xl hover:scale-110"
      >
        <ArrowLeft className="w-6 h-6" />
      </motion.button>

      <div className="fixed inset-0 flex bg-gradient-to-br from-gray-900 to-gray-800">
        <div className="w-1/3 flex-shrink-0 border-r border-gray-700">
          <ContactSidebar
            contacts={sorted}
            stats={data.stats}
            searchQuery={ui.search}
            onSearchChange={(q) => setUi(p => ({ ...p, search: q }))}
            filter={ui.contactFilter}
            onFilterChange={(f) => setUi(p => ({ ...p, contactFilter: f }))}
            onContactSelect={pick}
            onAddContact={() => setUi(p => ({ ...p, showAddContact: true }))}
            onSyncContacts={() => API.syncContacts(token, []).then(load)}
            onDeleteContact={async (id) => { await API.deleteContact(token, id); await load(); }}
            onInviteContact={async (c) => { await API.inviteContact(token, { phoneNumber: c.phone, fullName: c.fullName }); }}
            onShowPending={() => setUi(p => ({ ...p, showPending: true }))}
            unreadCounts={data.unread}
            onlineUsers={onlineUsers}
            pendingCount={data.pendingRequests?.length || 0}
            connected={connected}
            reconnecting={recon}
            error={err.load}
          />
        </div>

        <section className="flex-1 flex flex-col overflow-hidden">
          {sel.friend ? (
            <>
              <ChatHeader
                friend={sel.friend}
                typingUsers={typingUsers}
                onlineUsers={onlineUsers}
                connected={connected}
                onVideoCall={() => startCall('video')}
                onAudioCall={() => startCall('audio')}
              />

              <MessagesList
                messages={data.msg}
                loading={ui.load}
                currentUserId={user?.id}
                onSelectMessage={(m) => setSel(p => ({ ...p, msg: m }))}
                onDeleteMessage={handleDeleteMessage} // 👈 NOUVEAU
                endRef={endRef}
              />

              <ChatInput
                input={input}
                onChange={type}
                onSend={send}
                onUpload={upload}
                recording={recording}
                audioBlob={audioBlob}
                audioUrl={audioUrl}
                isPlaying={isPlaying}
                audioRef={audioRef}
                onStartRecording={startRecording}
                onStopRecording={stopRecording}
                onCancelAudio={cancelAudio}
                onPlayPreview={playPreview}
                onPausePreview={pausePreview}
                onSendAudio={sendAudio}
                showEmoji={ui.showEmoji}
                onToggleEmoji={() => setUi(p => ({ ...p, showEmoji: !p.showEmoji }))}
                onEmojiSelect={(e) => { setInput(p => p + e.emoji); setUi(p => ({ ...p, showEmoji: false })); }}
                uploading={ui.up}
                connected={connected}
                txtRef={txtRef}
                fileRef={fileRef}
              />
            </>
          ) : (
            <EmptyState
              totalPendingCount={data.pendingRequests?.length || 0}
              onShowPending={() => setUi(p => ({ ...p, showPending: true }))}
              onSyncContacts={() => API.syncContacts(token, []).then(load)}
              onAddContact={() => setUi(p => ({ ...p, showAddContact: true }))}
              hasContacts={data.conn.length > 0}
            />
          )}
        </section>
      </div>

      {/* MODALS & NOTIFICATIONS */}
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
                on: true,
                type: incomingCall.type,
                friend: incomingCall.friend,
                mute: false,
                video: incomingCall.type === "video",
                isIncoming: true,
                callId: incomingCall.callId
              });
              setIncomingCall(null);
              incomingCall.cleanup?.();
            }}
            onReject={() => {
              rejectCall({ to: incomingCall.callId });
              setIncomingCall(null);
            }}
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

        {ui.phone && (
          <PhoneModal
            onSuccess={(updatedUser) => {
              if (user && updatedUser) Object.assign(user, updatedUser);
              setUi(p => ({ ...p, phone: false }));
              showToast(MSG.ok.phone, 'success');
              setTimeout(() => API.syncContacts(token, []).then(load), 1000);
            }}
            onClose={() => setUi(p => ({ ...p, phone: false }))}
          />
        )}
        
        {ui.showAddContact && (
          <AddContactModal
            isOpen={ui.showAddContact}
            onClose={() => setUi(p => ({ ...p, showAddContact: false }))}
            onAdd={async (data) => {
              await API.addContact(token, data);
              await load();
            }}
          />
        )}
        
        {ui.showPending && (
          <PendingMessagesModal
            isOpen={ui.showPending}
            onClose={() => setUi(p => ({ ...p, showPending: false }))}
            onAccept={handleAcceptRequest}
            onReject={async (requestId) => {
              try {
                await API.rejectMessageRequest(token, requestId);
                setData(p => ({ ...p, pendingRequests: p.pendingRequests.filter(r => r._id !== requestId) }));
                showToast("Demande rejetée", "info");
              } catch (err) {
                showToast("Erreur lors du rejet", "error");
              }
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}