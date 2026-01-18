// ============================================
// 📁 src/pages/Chat/Messages.jsx
// VERSION FINALE - AVEC CALLBACK SYNC
// ============================================

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { 
  ArrowLeft, X, Users, MessageSquare, Lock, ShieldCheck
} from "lucide-react";

// === CONTEXTS & SERVICES ===
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { API } from "../../services/apiService";

// === COMPONENTS ===
import IncomingCallModal from "../../components/IncomingCallModal";
import { PhoneNumberModal } from "./components/PhoneNumberModal";
import { ContactSidebar } from "./ContactSidebar";
import { ChatHeader } from "./components/ChatHeader";
import { MessagesList } from "./components/MessagesList";
import { ChatInput } from "./components/ChatInput";

// === HOOKS PERSONNALISÉS ===
import { useAudioRecording } from "../../hooks/useAudioRecording";
import { useCallManager } from "./hooks/useCallManager";

export default function Messages() {
  const { user, token, socket, updateUserProfile } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  // --- NAVIGATION À 3 NIVEAUX ---
  const [view, setView] = useState('contacts');

  // --- ÉTATS LOCAUX ---
  const [input, setInput] = useState("");
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  // --- DONNÉES ---
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [unreadCounts, setUnreadCounts] = useState({});

  const {
    recording,
    audioBlob,
    audioUrl,
    isPlaying,
    startRecording,
    stopRecording,
    cancelRecording,
    playPreview,
    pausePreview
  } = useAudioRecording(token, showToast);

  const connected = socket?.connected || false;

  // ============================================
  // 📞 GESTION DES APPELS
  // ============================================
  const initiateCall = useCallback((recipientId, callType) => {
    if (!socket || !socket.connected) {
      showToast("Connexion socket requise", "error");
      return false;
    }
    socket.emit("startCall", { recipientId, type: callType, callerId: user?.id });
    return true;
  }, [socket, user, showToast]);

  const socketEndCall = useCallback((callId) => {
    if (socket && socket.connected && callId) {
      socket.emit("endCall", { callId });
    }
  }, [socket]);

  const sendMessageSocket = useCallback((messageData) => {
    if (!socket || !socket.connected) {
      showToast("Impossible d'envoyer le message", "error");
      return;
    }
    socket.emit("sendMessage", messageData);
  }, [socket, showToast]);

  const {
    call,
    setCall,
    incomingCall,
    setIncomingCall,
    missedCallNotification,
    startCall,
    endCall,
    sendMissedCallMessage,
    cleanupCallRingtone
  } = useCallManager(
    { friend: selectedContact },
    connected,
    initiateCall,
    socketEndCall,
    sendMessageSocket,
    showToast
  );

  // ============================================
  // 📥 CHARGER LES CONVERSATIONS
  // ============================================
  const loadConversations = useCallback(async () => {
    if (!token) return;
    
    try {
      setLoading(true);
      const result = await API.getConversations(token);
      const existingConversations = result.conversations || [];
      
      console.log(`📊 [Messages] ${existingConversations.length} conversations chargées`);
      
      setConversations(existingConversations);
      
      // ✅ Extraire les unread counts
      const counts = {};
      existingConversations.forEach(conv => {
        if (conv.unreadCount > 0) {
          counts[conv.id] = conv.unreadCount;
        }
      });
      setUnreadCounts(counts);
      
    } catch (error) {
      console.error('❌ [Messages] Erreur chargement conversations:', error);
      showToast('Erreur de chargement', 'error');
    } finally {
      setLoading(false);
    }
  }, [token, showToast]);

  // ✅ Charger au montage
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // ============================================
  // 🔄 CALLBACK APRÈS SYNCHRONISATION
  // ============================================
  const handleSyncComplete = useCallback((newContacts) => {
    console.log(`📲 [Messages] ${newContacts.length} nouveaux contacts synchronisés`);
    
    // Recharger les conversations
    loadConversations();
    
    // Notification
    if (newContacts.length > 0) {
      showToast(`${newContacts.length} nouveaux contacts ajoutés !`, "success");
    }
  }, [loadConversations, showToast]);

  // ============================================
  // 💬 CHARGER LES MESSAGES
  // ============================================
  const loadMessages = useCallback(async (contactId) => {
    if (!contactId || !token) return;
    setLoading(true);
    try {
      const result = await API.getMessages(token, contactId);
      const msgList = Array.isArray(result) ? result : (result.messages || []);
      setMessages(msgList);
      if (socket && socket.connected) {
        socket.emit("markMessagesAsRead", { senderId: contactId });
      }
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } catch (error) {
      showToast('Impossible de charger les messages', 'error');
    } finally {
      setLoading(false);
    }
  }, [token, socket, showToast]);

  // ============================================
  // 👤 SÉLECTIONNER UN CONTACT
  // ============================================
  const handleContactSelect = useCallback((contact) => {
    console.log('📱 [Messages] Contact sélectionné:', contact);
    setSelectedContact(contact);
    setMessages([]);
    loadMessages(contact.id);
    setView('chat');
  }, [loadMessages]);

  // ============================================
  // 📤 ENVOYER UN MESSAGE
  // ============================================
  const handleSendMessage = useCallback(() => {
    if (!selectedContact || !input.trim() || !socket || !socket.connected) return;
    
    const messageData = {
      recipientId: selectedContact.id,
      content: input.trim(),
      type: 'text'
    };
    
    socket.emit("sendMessage", messageData);
    setInput("");
  }, [selectedContact, input, socket]);

  // ============================================
  // 📎 GESTION FICHIERS & AUDIO
  // ============================================
  const handleFileUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedContact) return;
    showToast('Upload de fichier en cours...', 'info');
  }, [selectedContact, showToast]);

  const handleSendAudio = useCallback(async () => {
    if (!audioBlob || !selectedContact) return;
    try {
      showToast('Envoi du message vocal...', 'info');
      cancelRecording();
    } catch (error) {
      showToast('Erreur lors de l\'envoi', 'error');
    }
  }, [audioBlob, selectedContact, cancelRecording, showToast]);

  const handleEmojiSelect = useCallback((emoji) => {
    setInput(prev => prev + emoji.emoji);
    setShowEmoji(false);
  }, []);

  // ============================================
  // 🎧 GESTION DES SOCKETS
  // ============================================
  useEffect(() => {
    if (!socket || !socket.connected) return;

    const handleReceiveMessage = (message) => {
      const senderId = typeof message.sender === 'object' ? message.sender._id : message.sender;
      const recipientId = typeof message.recipient === 'object' ? message.recipient._id : message.recipient;
      const isCurrentChat = selectedContact && (senderId === selectedContact.id || recipientId === selectedContact.id);

      if (isCurrentChat) {
        setMessages(prev => [...prev, message].sort((a, b) => 
          new Date(a.timestamp) - new Date(b.timestamp)
        ));
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
      } else {
        setUnreadCounts(prev => ({
          ...prev,
          [senderId]: (prev[senderId] || 0) + 1
        }));
      }
      
      loadConversations();
    };

    const handleMessageSent = (message) => {
      setMessages(prev => {
        const filtered = prev.filter(m => 
          m.status !== 'sending' || m.content !== message.content
        );
        return [...filtered, message].sort((a, b) => 
          new Date(a.timestamp) - new Date(b.timestamp)
        );
      });
      
      loadConversations();
    };

    socket.on("receiveMessage", handleReceiveMessage);
    socket.on("messageSent", handleMessageSent);

    return () => {
      socket.off("receiveMessage", handleReceiveMessage);
      socket.off("messageSent", handleMessageSent);
    };
  }, [socket, selectedContact, loadConversations]);

  // ============================================
  // 📞 SOUMETTRE LE NUMÉRO
  // ============================================
  const handlePhoneSubmit = async (phoneNumber) => {
    try {
      const response = await fetch(`${API.BASE_URL}/auth/update-phone`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ phone: phoneNumber })
      });

      const data = await response.json();
      if (!data.success) throw new Error(data.message || 'Erreur');
      
      if (updateUserProfile) {
        updateUserProfile(user.id, data.user);
      }
      showToast("Numéro enregistré ! 🎉", "success");
      setShowPhoneModal(false);
    } catch (error) {
      throw error;
    }
  };

  // ============================================
  // 🧹 NETTOYAGE
  // ============================================
  useEffect(() => {
    return () => cleanupCallRingtone();
  }, [cleanupCallRingtone]);

  // ============================================
  // 🔙 GESTION DU BOUTON RETOUR
  // ============================================
  const handleBack = () => {
    if (view === 'chat') {
      setView('conversations');
      setSelectedContact(null);
    } else if (view === 'conversations') {
      setView('contacts');
    } else {
      navigate('/');
    }
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 text-white overflow-hidden">
      
      {view === 'contacts' && (
        <motion.div
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -20, opacity: 0 }}
          className="w-full h-full flex flex-col"
        >
          <div className="bg-[#12151a]/90 backdrop-blur-xl border-b border-white/5 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={handleBack} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                <ArrowLeft size={20} />
              </button>
              <div className="flex items-center gap-2">
                <Users size={22} className="text-blue-500" />
                <h1 className="text-xl font-bold">Mes Contacts</h1>
              </div>
            </div>
            <button
              onClick={() => setView('conversations')}
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
              contacts={conversations}
              selectedContact={selectedContact}
              onContactSelect={handleContactSelect}
              unreadCounts={unreadCounts}
              onlineUsers={onlineUsers}
              user={user}
              onSyncComplete={handleSyncComplete}
            />
          </div>
        </motion.div>
      )}

      {view === 'conversations' && (
        <motion.div
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 20, opacity: 0 }}
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
            <button
              onClick={() => setView('contacts')}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-xl transition-all"
            >
              <Users size={18} />
              <span className="text-sm font-semibold">Contacts</span>
            </button>
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
                        {conv.profilePhoto ? (
                          <img src={conv.profilePhoto} alt="" className="w-full h-full object-cover" />
                        ) : (
                          conv.fullName?.[0]?.toUpperCase() || '?'
                        )}
                      </div>
                      {conv.isOnline && (
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-gray-900" />
                      )}
                    </div>

                    <div className="flex-1 text-left min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-bold text-white truncate">{conv.fullName}</h3>
                        {conv.lastMessageTime && (
                          <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                            {new Date(conv.lastMessageTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-gray-400 truncate flex-1">
                          {conv.lastMessageType === 'system' && '📱 '}{conv.lastMessage || 'Aucun message'}
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

      {view === 'chat' && selectedContact && (
        <motion.div
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 20, opacity: 0 }}
          className="w-full h-full flex flex-col"
        >
          <ChatHeader
            friend={selectedContact}
            onBack={handleBack}
            onAudioCall={() => startCall('audio')}
            onVideoCall={() => startCall('video')}
            connected={connected}
            onlineUsers={onlineUsers}
          />

          <MessagesList
            messages={messages}
            currentUserId={user?.id}
            loading={loading}
            endRef={messagesEndRef}
          />

          <ChatInput
            input={input}
            onChange={(e) => setInput(e.target.value)}
            onSend={handleSendMessage}
            recording={recording}
            onStartRecording={startRecording}
            onStopRecording={stopRecording}
            onCancelAudio={cancelRecording}
            onSendAudio={handleSendAudio}
            audioUrl={audioUrl}
            isPlaying={isPlaying}
            onPlayPreview={playPreview}
            onPausePreview={pausePreview}
            showEmoji={showEmoji}
            onToggleEmoji={() => setShowEmoji(!showEmoji)}
            onEmojiSelect={handleEmojiSelect}
            uploading={false}
            onUpload={handleFileUpload}
            connected={connected}
            txtRef={textareaRef}
            fileRef={fileInputRef}
          />
        </motion.div>
      )}

      {showPhoneModal && (
        <PhoneNumberModal
          isOpen={showPhoneModal}
          onClose={() => setShowPhoneModal(false)}
          onSubmit={handlePhoneSubmit}
          canSkip={true}
        />
      )}

      {incomingCall && (
        <IncomingCallModal
          caller={incomingCall.caller}
          callType={incomingCall.type}
          onAccept={() => {
            socket.emit('acceptCall', { callId: incomingCall.callId });
            setCall({
              on: true,
              type: incomingCall.type,
              friend: incomingCall.caller,
              mute: false,
              video: incomingCall.type === 'video',
              isIncoming: true,
              callId: incomingCall.callId
            });
            setIncomingCall(null);
          }}
          onReject={() => {
            socket.emit('rejectCall', { callId: incomingCall.callId });
            sendMissedCallMessage(incomingCall.caller, incomingCall.type);
            setIncomingCall(null);
          }}
        />
      )}

      {missedCallNotification && (
        <div className="fixed bottom-4 right-4 bg-red-500/90 backdrop-blur-sm text-white px-6 py-3 rounded-lg shadow-lg z-50">
          <p className="font-semibold">Appel manqué</p>
          <p className="text-sm">{missedCallNotification.caller?.name}</p>
        </div>
      )}
    </div>
  );
}