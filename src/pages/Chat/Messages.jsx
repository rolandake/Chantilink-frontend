// ============================================
// 📁 src/pages/Chat/Messages.jsx
// VERSION FINALE - AVEC CACHE IndexedDB
// ============================================

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { 
  ArrowLeft, X, Users, MessageSquare, Lock, ShieldCheck, Home, List,
  Phone, Video
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
  stopVibration
} from "../../utils/callSounds";

export default function Messages() {
  // ========== 1. CONTEXTS (TOUJOURS EN PREMIER) ==========
  const { user, token, socket, updateUserProfile } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  // ========== 2. TOUS LES REFS ==========
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const ringtoneRef = useRef(null); // ✅ NOUVEAU: Référence pour la sonnerie

  // ========== 3. TOUS LES STATES (ORDRE FIXE) ==========
  const [view, setView] = useState('contacts');
  const [contacts, setContacts] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [onlineUsers, setOnlineUsers] = useState([]);
  
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [showPendingModal, setShowPendingModal] = useState(false);
  
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);

  // ========== 4. HOOKS PERSONNALISÉS (ORDRE FIXE) ==========
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

  // ========== 5. VALEURS DÉRIVÉES ==========
  const connected = socket?.connected || false;

  // ========== 6. CALLBACKS SOCKET (AVANT useCallManager) ==========
  const initiateCall = useCallback((recipientId, callType) => {
    if (!socket || !socket.connected) {
      showToast("Connexion socket requise", "error");
      return false;
    }
    console.log(`📞 [Messages] Initiation appel ${callType} vers:`, recipientId);
    socket.emit("startCall", { recipientId, type: callType, callerId: user?.id });
    return true;
  }, [socket, user, showToast]);

  const socketEndCall = useCallback((callId) => {
    if (socket && socket.connected && callId) {
      console.log(`📴 [Messages] Fin d'appel:`, callId);
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

  // ========== 7. HOOK CALL MANAGER ==========
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

  // ========== 8. CALLBACKS AVEC CACHE ==========

  /**
   * ✅ CHARGER CONTACTS AVEC CACHE
   */
  const loadContacts = useCallback(async () => {
    if (!token) return;
    
    try {
      // 1️⃣ Charger depuis le cache d'abord
      const cachedContacts = await messageCache.getContacts();
      if (cachedContacts.length > 0) {
        console.log(`📦 [Messages] ${cachedContacts.length} contacts depuis cache`);
        setContacts(cachedContacts);
      }

      // 2️⃣ Synchroniser avec le serveur
      const result = await API.getContacts(token);
      const contactsList = result.contacts || [];
      
      console.log(`👥 [Messages] ${contactsList.length} contacts chargés du serveur`);
      
      if (contactsList.length > 0) {
        await messageCache.saveContacts(contactsList);
        setContacts(contactsList);
      }
      
    } catch (error) {
      console.error('❌ [Messages] Erreur chargement contacts:', error);
    }
  }, [token]);

  /**
   * ✅ CHARGER CONVERSATIONS AVEC CACHE
   */
  const loadConversations = useCallback(async () => {
    if (!token) return;
    
    try {
      setLoading(true);

      // 1️⃣ Charger depuis le cache d'abord
      const cachedConversations = await messageCache.getConversations();
      if (cachedConversations.length > 0) {
        console.log(`📦 [Messages] ${cachedConversations.length} conversations depuis cache`);
        setConversations(cachedConversations);
        
        // Mettre à jour les compteurs non lus
        const counts = {};
        cachedConversations.forEach(conv => {
          if (conv.unreadCount > 0) {
            counts[conv.id] = conv.unreadCount;
          }
        });
        setUnreadCounts(counts);
        setLoading(false);
      }

      // 2️⃣ Synchroniser avec le serveur
      const result = await API.getConversations(token);
      const freshConversations = result.conversations || [];
      
      console.log(`📊 [Messages] ${freshConversations.length} conversations du serveur`);
      
      if (freshConversations.length > 0) {
        await messageCache.saveConversations(freshConversations);
        setConversations(freshConversations);
        
        const counts = {};
        freshConversations.forEach(conv => {
          if (conv.unreadCount > 0) {
            counts[conv.id] = conv.unreadCount;
          }
        });
        setUnreadCounts(counts);
      }
      
    } catch (error) {
      console.error('❌ [Messages] Erreur chargement conversations:', error);
      showToast('Erreur de chargement', 'error');
    } finally {
      setLoading(false);
    }
  }, [token, showToast]);

  /**
   * ✅ CHARGER MESSAGES AVEC CACHE
   */
  const loadMessages = useCallback(async (contactId) => {
    if (!contactId || !token || !user?.id) return;
    
    setLoading(true);
    
    try {
      // 1️⃣ Charger depuis le cache d'abord
      const cachedMessages = await messageCache.getMessages(user.id, contactId);
      if (cachedMessages.length > 0) {
        console.log(`📦 [Messages] ${cachedMessages.length} messages depuis cache`);
        setMessages(cachedMessages);
        setLoading(false);
        
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
      }

      // 2️⃣ Synchroniser avec le serveur
      const result = await API.getMessages(token, contactId);
      const msgList = Array.isArray(result) ? result : (result.messages || []);
      
      console.log(`📨 [Messages] ${msgList.length} messages du serveur`);
      
      if (msgList.length > 0) {
        await messageCache.saveMessages(user.id, contactId, msgList);
        setMessages(msgList);
      }
      
      // Marquer comme lu
      if (socket && socket.connected) {
        socket.emit("markMessagesAsRead", { senderId: contactId });
      }
      
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
      
    } catch (error) {
      console.error('❌ [Messages] Erreur chargement messages:', error);
      showToast('Impossible de charger les messages', 'error');
    } finally {
      setLoading(false);
    }
  }, [token, socket, showToast, user]);

  const handleSyncComplete = useCallback((newContacts) => {
    console.log(`📲 [Messages] ${newContacts.length} nouveaux contacts synchronisés`);
    
    loadContacts();
    loadConversations();
    
    if (newContacts.length > 0) {
      showToast(`${newContacts.length} nouveaux amis trouvés !`, "success");
    }
  }, [loadContacts, loadConversations, showToast]);

  const handleContactSelect = useCallback((contact) => {
    console.log('📱 [Messages] Contact sélectionné:', contact);
    setSelectedContact(contact);
    setMessages([]);
    loadMessages(contact.id);
    setView('chat');
    
    setUnreadCounts(prev => {
      const newCounts = { ...prev };
      delete newCounts[contact.id];
      return newCounts;
    });
  }, [loadMessages]);

  const handleInputChange = useCallback((e) => {
    setInput(e.target.value);
    
    if (socket && socket.connected && selectedContact) {
      socket.emit("typing", { 
        recipientId: selectedContact.id, 
        isTyping: e.target.value.length > 0 
      });
    }
  }, [socket, selectedContact]);

  /**
   * ✅ ENVOYER MESSAGE AVEC CACHE ET SON
   */
  const handleSendMessage = useCallback(async () => {
    if (!selectedContact || !input.trim() || !socket || !socket.connected || !user?.id) return;
    
    const messageData = {
      recipientId: selectedContact.id,
      content: input.trim(),
      type: 'text'
    };
    
    const tempMessage = {
      _id: `temp-${Date.now()}`,
      sender: user.id,
      recipient: selectedContact.id,
      content: input.trim(),
      type: 'text',
      status: 'sending',
      timestamp: new Date().toISOString()
    };
    
    // Ajouter immédiatement à l'UI
    setMessages(prev => [...prev, tempMessage]);
    
    // ✅ JOUER SON D'ENVOI
    try {
      playSendSound();
    } catch (e) {
      console.warn('Son non disponible:', e);
    }
    
    // Ajouter au cache
    try {
      await messageCache.addMessage(user.id, selectedContact.id, tempMessage);
    } catch (error) {
      console.error('❌ [Messages] Erreur ajout cache:', error);
    }
    
    // Envoyer via socket
    socket.emit("sendMessage", messageData);
    setInput("");
    
    if (socket) {
      socket.emit("typing", { recipientId: selectedContact.id, isTyping: false });
    }
    
  }, [selectedContact, input, socket, user]);

  const handleFileUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedContact) return;
    
    showToast('📤 Upload en cours...', 'info');
    
    try {
      const uploadResponse = await API.uploadMessageFile(token, file);
      
      if (uploadResponse.success && uploadResponse.url) {
        const messageData = {
          recipientId: selectedContact.id,
          content: file.name,
          type: uploadResponse.type || 'file',
          file: uploadResponse.url,
          fileUrl: uploadResponse.url,
          fileName: file.name,
          fileSize: file.size
        };
        
        socket.emit("sendMessage", messageData);
        showToast('✅ Fichier envoyé !', 'success');
      }
    } catch (error) {
      console.error('❌ [Messages] Erreur upload:', error);
      showToast('❌ Erreur d\'envoi', 'error');
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [selectedContact, token, socket, showToast]);

  const handleSendAudio = useCallback(async () => {
    if (!audioBlob || !selectedContact) return;
    
    try {
      showToast('📤 Envoi du message vocal...', 'info');
      
      const audioFile = new File([audioBlob], 'audio.webm', { type: 'audio/webm' });
      const uploadResponse = await API.uploadMessageFile(token, audioFile);
      
      if (uploadResponse.success && uploadResponse.url) {
        const messageData = {
          recipientId: selectedContact.id,
          content: 'Message vocal',
          type: 'audio',
          file: uploadResponse.url,
          fileUrl: uploadResponse.url
        };
        
        socket.emit("sendMessage", messageData);
        showToast('✅ Message vocal envoyé !', 'success');
      }
      
      cancelRecording();
    } catch (error) {
      console.error('❌ [Messages] Erreur envoi audio:', error);
      showToast('❌ Erreur lors de l\'envoi', 'error');
    }
  }, [audioBlob, selectedContact, token, socket, cancelRecording, showToast]);

  const handleEmojiSelect = useCallback((emoji) => {
    setInput(prev => prev + emoji.emoji);
    setShowEmoji(false);
  }, []);

  const handlePhoneSubmit = useCallback(async (phoneNumber) => {
    try {
      const response = await API.updatePhone(token, phoneNumber);
      
      if (response.success) {
        if (updateUserProfile) {
          updateUserProfile(user.id, response.user);
        }
        showToast("Numéro enregistré ! 🎉", "success");
        setShowPhoneModal(false);
      }
    } catch (error) {
      console.error('❌ [Messages] Erreur update phone:', error);
      throw error;
    }
  }, [token, updateUserProfile, user, showToast]);

  const handleAddContact = useCallback(async (contactData) => {
    try {
      const result = await API.addContact(token, contactData);
      
      if (result.success) {
        showToast('✅ Contact ajouté !', 'success');
        loadContacts();
        loadConversations();
        setShowAddContact(false);
      } else if (result.canInvite) {
        showToast('Contact hors app - invitation disponible', 'info');
      }
    } catch (error) {
      console.error('❌ [Messages] Erreur ajout contact:', error);
      throw error;
    }
  }, [token, loadContacts, loadConversations, showToast]);

  const handleAcceptPendingRequest = useCallback(async (request) => {
    try {
      await API.acceptMessageRequest(token, request._id);
      showToast('✅ Demande acceptée !', 'success');
      loadContacts();
      loadConversations();
      setShowPendingModal(false);
    } catch (error) {
      console.error('❌ [Messages] Erreur acceptation:', error);
      showToast('❌ Impossible d\'accepter', 'error');
    }
  }, [token, loadContacts, loadConversations, showToast]);

  const handleVideoCall = useCallback(() => {
    if (!selectedContact) {
      showToast("Aucun contact sélectionné", "error");
      return;
    }
    console.log('📹 [Messages] Démarrage appel vidéo vers:', selectedContact.fullName);
    
    // ✅ JOUER SON D'APPEL SORTANT
    try {
      playCallConnectedSound();
    } catch (e) {
      console.warn('Son non disponible:', e);
    }
    
    // Configure l'appel sortant
    setCall({
      on: true,
      type: 'video',
      friend: selectedContact,
      mute: false,
      video: true,
      isIncoming: false,
      callId: null
    });
    
    // Initie l'appel via socket
    startCall('video');
  }, [selectedContact, startCall, showToast, setCall]);

  const handleAudioCall = useCallback(() => {
    if (!selectedContact) {
      showToast("Aucun contact sélectionné", "error");
      return;
    }
    console.log('📞 [Messages] Démarrage appel audio vers:', selectedContact.fullName);
    
    // ✅ JOUER SON D'APPEL SORTANT
    try {
      playCallConnectedSound();
    } catch (e) {
      console.warn('Son non disponible:', e);
    }
    
    // Configure l'appel sortant
    setCall({
      on: true,
      type: 'audio',
      friend: selectedContact,
      mute: false,
      video: false,
      isIncoming: false,
      callId: null
    });
    
    // Initie l'appel via socket
    startCall('audio');
  }, [selectedContact, startCall, showToast, setCall]);

  const handleAcceptCall = useCallback(() => {
    if (incomingCall && socket) {
      console.log('✅ [Messages] Acceptation appel:', incomingCall.callId);
      
      // ✅ ARRÊTER LA SONNERIE
      if (ringtoneRef.current) {
        ringtoneRef.current.stop();
        ringtoneRef.current = null;
      }
      stopVibration();
      
      // ✅ JOUER SON DE CONNEXION
      try {
        playCallConnectedSound();
      } catch (e) {
        console.warn('Son non disponible:', e);
      }
      
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
      cleanupCallRingtone();
    }
  }, [incomingCall, socket, setCall, setIncomingCall, cleanupCallRingtone]);

  const handleRejectCall = useCallback(() => {
    if (incomingCall && socket) {
      console.log('❌ [Messages] Rejet appel:', incomingCall.callId);
      
      // ✅ ARRÊTER LA SONNERIE
      if (ringtoneRef.current) {
        ringtoneRef.current.stop();
        ringtoneRef.current = null;
      }
      stopVibration();
      
      // ✅ JOUER SON DE REJET
      try {
        playCallRejectedSound();
      } catch (e) {
        console.warn('Son non disponible:', e);
      }
      
      socket.emit('rejectCall', { callId: incomingCall.callId });
      sendMissedCallMessage(incomingCall.caller, incomingCall.type);
      setIncomingCall(null);
      cleanupCallRingtone();
    }
  }, [incomingCall, socket, sendMissedCallMessage, setIncomingCall, cleanupCallRingtone]);

  const handleBack = useCallback(() => {
    if (view === 'chat') {
      setView('conversations');
      setSelectedContact(null);
      setMessages([]);
    } else if (view === 'conversations') {
      setView('contacts');
    }
  }, [view]);

  const handleGoHome = useCallback(() => {
    navigate('/');
  }, [navigate]);

  const handleGoToConversations = useCallback(() => {
    setView('conversations');
    setSelectedContact(null);
  }, []);

  // ========== 9. TOUS LES useEffect À LA FIN ==========
  
  useEffect(() => {
    loadContacts();
    loadConversations();
  }, [loadContacts, loadConversations]);

  useEffect(() => {
    if (!socket || !socket.connected) return;

    const handleOnlineUsers = (users) => {
      console.log('🟢 [Messages] Utilisateurs en ligne:', users);
      setOnlineUsers(users || []);
    };

    socket.on("onlineUsers", handleOnlineUsers);
    
    return () => {
      socket.off("onlineUsers", handleOnlineUsers);
    };
  }, [socket]);

  /**
   * ✅ GESTION MESSAGES REÇUS AVEC CACHE ET SON
   */
  useEffect(() => {
    if (!socket || !socket.connected || !user?.id) return;

    const handleReceiveMessage = async (message) => {
      const senderId = typeof message.sender === 'object' ? message.sender._id : message.sender;
      const recipientId = typeof message.recipient === 'object' ? message.recipient._id : message.recipient;
      const isCurrentChat = selectedContact && (senderId === selectedContact.id || recipientId === selectedContact.id);

      if (isCurrentChat) {
        // ✅ JOUER SON DE RÉCEPTION
        try {
          playReceiveSound();
        } catch (e) {
          console.warn('Son non disponible:', e);
        }
        
        // Ajouter au cache
        try {
          await messageCache.addMessage(user.id, selectedContact.id, message);
        } catch (error) {
          console.error('❌ [Messages] Erreur cache message reçu:', error);
        }

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

    const handleMessageSent = async (message) => {
      // Remplacer le message temporaire et mettre à jour le cache
      try {
        if (selectedContact?.id && user?.id) {
          await messageCache.addMessage(user.id, selectedContact.id, message);
        }
      } catch (error) {
        console.error('❌ [Messages] Erreur cache message envoyé:', error);
      }

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

    const handleTyping = ({ userId, isTyping }) => {
      if (isTyping) {
        setTypingUsers(prev => [...new Set([...prev, userId])]);
      } else {
        setTypingUsers(prev => prev.filter(id => id !== userId));
      }
    };

    socket.on("receiveMessage", handleReceiveMessage);
    socket.on("messageSent", handleMessageSent);
    socket.on("typing", handleTyping);

    return () => {
      socket.off("receiveMessage", handleReceiveMessage);
      socket.off("messageSent", handleMessageSent);
      socket.off("typing", handleTyping);
    };
  }, [socket, selectedContact, loadConversations, user]);

  useEffect(() => {
    if (!socket || !socket.connected) return;

    const handleIncomingCall = ({ callId, from, caller, type }) => {
      console.log('📞 [Messages] Appel entrant:', { callId, from, type });
      
      const friend = contacts.find(c => c.id === from) || { 
        id: from, 
        fullName: caller?.fullName || "Anonyme" 
      };

      // ✅ DÉMARRER LA SONNERIE
      if (!ringtoneRef.current) {
        ringtoneRef.current = new CallRingtone();
        ringtoneRef.current.start();
      }
      
      // ✅ VIBRATION MOBILE
      try {
        vibrateCall();
      } catch (e) {
        console.warn('Vibration non disponible:', e);
      }

      setIncomingCall({ callId, caller: friend, type });
    };

    const handleCallRejected = () => {
      console.log('❌ [Messages] Appel rejeté');
      
      // ✅ JOUER SON DE REJET
      try {
        playCallRejectedSound();
      } catch (e) {
        console.warn('Son non disponible:', e);
      }
      
      cleanupCallRingtone();
      showToast("Appel occupé", "info");
      setCall({
        on: false,
        type: null,
        friend: null,
        mute: false,
        video: true,
        isIncoming: false,
        callId: null
      });
    };

    const handleCallEnded = () => {
      console.log('📴 [Messages] Appel terminé');
      
      // ✅ JOUER SON DE FIN D'APPEL
      try {
        playCallEndedSound();
      } catch (e) {
        console.warn('Son non disponible:', e);
      }
      
      // ✅ ARRÊTER LA SONNERIE SI ELLE EST ACTIVE
      if (ringtoneRef.current) {
        ringtoneRef.current.stop();
        ringtoneRef.current = null;
      }
      stopVibration();
      
      cleanupCallRingtone();
      endCall();
    };

    socket.on("incoming-call", handleIncomingCall);
    socket.on("call-rejected", handleCallRejected);
    socket.on("call-ended", handleCallEnded);

    return () => {
      socket.off("incoming-call", handleIncomingCall);
      socket.off("call-rejected", handleCallRejected);
      socket.off("call-ended", handleCallEnded);
    };
  }, [socket, contacts, cleanupCallRingtone, showToast, endCall, setCall, setIncomingCall]);

  useEffect(() => {
    return () => {
      cleanupCallRingtone();
      // ✅ NETTOYAGE COMPLET DE LA SONNERIE
      if (ringtoneRef.current) {
        ringtoneRef.current.stop();
        ringtoneRef.current = null;
      }
      stopVibration();
    };
  }, [cleanupCallRingtone]);

  /**
   * ✅ NETTOYAGE AUTOMATIQUE DU CACHE (tous les jours)
   */
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      messageCache.cleanOldMessages(30).catch(console.error);
    }, 24 * 60 * 60 * 1000); // 24 heures

    // Nettoyage initial au montage
    messageCache.cleanOldMessages(30).catch(console.error);

    return () => clearInterval(cleanupInterval);
  }, []);

  // ========== 10. RENDU ==========
  return (
    <div className="flex h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 text-white overflow-hidden">
      
      {/* VUE CONTACTS */}
      {view === 'contacts' && (
        <motion.div
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -20, opacity: 0 }}
          className="w-full h-full flex flex-col"
        >
          <div className="bg-[#12151a]/90 backdrop-blur-xl border-b border-white/5 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button 
                onClick={handleGoHome} 
                className="p-2 hover:bg-white/5 rounded-full transition-colors"
              >
                <Home size={20} />
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
      {view === 'conversations' && (
        <motion.div
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 20, opacity: 0 }}
          className="w-full h-full flex flex-col"
        >
          <div className="bg-[#12151a]/90 backdrop-blur-xl border-b border-white/5 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button 
                onClick={handleBack} 
                className="p-2 hover:bg-white/5 rounded-full transition-colors"
              >
                <ArrowLeft size={20} />
              </button>
              <div className="flex items-center gap-2">
                <MessageSquare size={22} className="text-purple-500" />
                <h1 className="text-xl font-bold">Conversations</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setView('contacts')}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-xl transition-all"
              >
                <Users size={18} />
                <span className="text-sm font-semibold">Contacts</span>
              </button>
              <button 
                onClick={handleGoHome} 
                className="p-2 hover:bg-white/5 rounded-full transition-colors"
              >
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
                        {conv.profilePhoto ? (
                          <img src={conv.profilePhoto} alt="" className="w-full h-full object-cover" />
                        ) : (
                          conv.fullName?.[0]?.toUpperCase() || '?'
                        )}
                      </div>
                      {conv.isOnline && (
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-[#12151a]" />
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

      {/* VUE CHAT */}
      {view === 'chat' && selectedContact && (
        <motion.div
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 20, opacity: 0 }}
          className="w-full h-full flex flex-col"
        >
          <ChatHeader
            friend={selectedContact}
            typingUsers={typingUsers}
            onlineUsers={onlineUsers}
            connected={connected}
            onVideoCall={handleVideoCall}
            onAudioCall={handleAudioCall}
            onBack={handleBack}
          />

          <MessagesList
            messages={messages}
            currentUserId={user?.id}
            loading={loading}
            endRef={messagesEndRef}
            conversationId={selectedContact?.id} 
          />

          <ChatInput
            input={input}
            onChange={handleInputChange}
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

      {/* MODALES */}
      {showPhoneModal && (
        <PhoneNumberModal
          isOpen={showPhoneModal}
          onClose={() => setShowPhoneModal(false)}
          onSubmit={handlePhoneSubmit}
          canSkip={true}
        />
      )}

      {showAddContact && (
        <AddContactModal
          isOpen={showAddContact}
          onClose={() => setShowAddContact(false)}
          onAdd={handleAddContact}
        />
      )}

      {showPendingModal && (
        <PendingMessagesModal
          isOpen={showPendingModal}
          onClose={() => setShowPendingModal(false)}
          onAccept={handleAcceptPendingRequest}
          onReject={async (requestId) => {
            try {
              await API.rejectMessageRequest(token, requestId);
              showToast('Demande rejetée', 'info');
              loadConversations();
            } catch (error) {
              showToast('Erreur', 'error');
            }
          }}
          onOpenConversation={(request) => {
            handleContactSelect(request.sender);
            setShowPendingModal(false);
          }}
        />
      )}

      {/* COMPOSANT CALLMANAGER - GESTION WEBRTC */}
      {call.on && (
        <CallManager
          call={call}
          onEndCall={endCall}
          onToggleMute={() => setCall(prev => ({ ...prev, mute: !prev.mute }))}
          onToggleVideo={() => setCall(prev => ({ ...prev, video: !prev.video }))}
        />
      )}

      {/* MODAL D'APPEL ENTRANT */}
      {incomingCall && (
        <IncomingCallModal
          caller={incomingCall.caller}
          callType={incomingCall.type}
          onAccept={handleAcceptCall}
          onReject={handleRejectCall}
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