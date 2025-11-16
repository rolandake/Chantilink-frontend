// ============================================ //
// 📁 src/pages/Chat/Messages.jsx - VERSION COMPLÈTE CORRIGÉE
// ============================================
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, Paperclip, Video, Phone, X, AlertCircle, RefreshCw, Heart,
  ArrowLeft, Smile, Mic, MicOff, Play, Pause, PhoneIncoming, PhoneOff, UserPlus
} from "lucide-react";

import { useAuth } from "../../context/AuthContext";
import { useChatSocket } from "../../hooks/useChatSocket";
import { useToast } from "../../context/ToastContext";
import { useNavigate } from "react-router-dom";
import Picker from "emoji-picker-react";
import * as Tone from "tone";

// === IMPORTS COMPOSANTS ===
import IncomingCallModal from "../../components/IncomingCallModal";
import MissedCallNotification from "../../components/MissedCallNotification";
import { API } from "../../services/apiService";
import { CFG, MSG, day } from "../../utils/messageConstants";
import { AddContactModal } from "./AddContactModal";
import { ContactSidebar } from "./ContactSidebar";
import { PendingMessagesModal } from "./PendingMessagesModal";
import { StoryReactionMessage, MissedCallMessage, StandardMessage } from "./MessageComponents";
import { useAudioRecording } from "../../hooks/useAudioRecording";
import PhoneModal from "../../components/PhoneModal";
import CallManager from "../../components/CallManager";

const Err = ({ msg, retry }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2"
  >
    {msg}
    {retry && (
      <button onClick={retry} className="ml-auto text-red-400 hover:text-red-300 text-sm font-medium">
        Réessayer
      </button>
    )}
  </motion.div>
);

export default function Messages() {
  const { user, token } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  // === SOCKET + FONCTIONS D'APPEL ===
  const {
    connected,
    onlineUsers,
    typingUsers,
    sendMessage,
    markAsRead,
    loadConversation,
    deleteMessage,
    startTyping,
    stopTyping,
    getUnreadCounts,
    on,
    off,
    initiateCall,
    acceptCall,
    rejectCall,
    endCall: socketEndCall
  } = useChatSocket();

  // === ÉTAT PRINCIPAL ===
  const [ui, setUi] = useState({
    phone: false,
    load: false,
    search: "",
    showPending: false,
    showEmoji: false,
    showAddContact: false,
    contactFilter: 'all'
  });

  const [data, setData] = useState({
    conn: [],
    msg: [],
    unread: {},
    stats: { total: 0, onChantilink: 0, other: 0 },
    pendingRequests: []
  });

  const [sel, setSel] = useState({ friend: null, msg: null });
  const [input, setInput] = useState("");

  // === ÉTAT APPEL ===
  const [call, setCall] = useState({
    on: false,
    type: null,
    friend: null,
    mute: false,
    video: true,
    isIncoming: false,
    callId: null
  });

  const [incomingCall, setIncomingCall] = useState(null);
  const [missedCallNotification, setMissedCallNotification] = useState(null);

  const [err, setErr] = useState({ load: null, send: null });
  const [recon, setRecon] = useState(false);

  // === REFS ===
  const endRef = useRef(null);
  const txtRef = useRef(null);
  const fileRef = useRef(null);
  const reconRef = useRef(0);
  const typeRef = useRef(null);
  const processedMessagesRef = useRef(new Set());
  const toneIntervalRef = useRef(null);
  const toneTimeoutRef = useRef(null);
  const toneSynthRef = useRef(null);

  // === HOOKS ===
  const {
    recording, audioBlob, audioUrl, isPlaying, audioRef,
    startRecording, stopRecording, cancelAudio, playPreview, pausePreview
  } = useAudioRecording(token, showToast);

  // === NOTIFICATIONS ===
  useEffect(() => {
    if (Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // === RECONNEXION ===
  useEffect(() => {
    if (!connected && token && reconRef.current < 5) {
      setRecon(true);
      reconRef.current++;
      setTimeout(() => setRecon(false), 5000);
    } else if (connected) {
      reconRef.current = 0;
      setRecon(false);
    }
  }, [connected, token]);

  // === CHARGEMENT DES DONNÉES ===
  const load = useCallback(async () => {
    if (!token) return;
    setErr(p => ({ ...p, load: null }));
    try {
      const [convRes, statsRes, pendingRes] = await Promise.all([
        API.loadConversations(token).catch(() => ({ connections: [] })),
        API.loadStats(token).catch(() => ({ total: 0, onChantilink: 0, other: 0 })),
        API.getPendingMessageRequests(token).catch(() => ({ requests: [] }))
      ]);

      setData(p => ({
        ...p,
        conn: convRes.connections || [],
        stats: statsRes || { total: 0, onChantilink: 0, other: 0 },
        pendingRequests: pendingRes.requests || []
      }));
    } catch (e) {
      setErr(p => ({ ...p, load: e.message }));
      showToast("Erreur de chargement des données", "error");
    }
  }, [token, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  // === NETTOYAGE SONNERIE ===
  const cleanupCallRingtone = useCallback(() => {
    if (toneIntervalRef.current) clearInterval(toneIntervalRef.current);
    if (toneTimeoutRef.current) clearTimeout(toneTimeoutRef.current);
    if (toneSynthRef.current) {
      toneSynthRef.current.dispose();
      toneSynthRef.current = null;
    }
    toneIntervalRef.current = null;
    toneTimeoutRef.current = null;
  }, []);

  // === SOCKET HANDLERS ===
  useEffect(() => {
    if (!connected) return;

    const handlers = {
      receiveMessage: (m) => {
        const msgId = m._id;
        if (!msgId || processedMessagesRef.current.has(msgId)) return;

        const senderId = m.sender?._id || m.sender;
        if (!senderId) return;

        const isOwnMessage = senderId === user?.id;
        let tempIndex = -1;

        if (isOwnMessage && sel.friend?.id === m.recipient) {
          tempIndex = data.msg.findIndex(msg =>
            msg._id?.toString().startsWith('temp-') &&
            msg.content === m.content &&
            new Date(msg.timestamp).getTime() - new Date(m.timestamp).getTime() < 5000
          );
        }

        if (sel.friend?.id === senderId || (isOwnMessage && sel.friend?.id === m.recipient)) {
          setData(p => {
            let newMsgs = [...p.msg];

            if (tempIndex !== -1) {
              newMsgs[tempIndex] = { ...m, status: 'sent' };
            } else {
              newMsgs = [...newMsgs, m];
            }

            return {
              ...p,
              msg: newMsgs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
            };
          });

          if (!isOwnMessage) markAsRead(senderId);
        } else {
          const isContact = data.conn.some(c => c.id === senderId);
          if (!isContact) {
            setData(p => ({
              ...p,
              pendingRequests: [...p.pendingRequests.filter(r => (r.sender?._id || r.sender) !== senderId), m]
            }));
          }
          setData(p => ({
            ...p,
            unread: { ...p.unread, [senderId]: (p.unread[senderId] || 0) + 1 }
          }));
          showToast(
            m.type === 'story_reaction'
              ? `${m.sender.fullName} a réagi à votre story`
              : `${m.sender.fullName} vous a écrit`,
            'info'
          );
        }

        processedMessagesRef.current.add(msgId);
      },

      conversationLoaded: ({ messages = [] }) => {
        const newMsgs = messages.filter(m => m._id && !processedMessagesRef.current.has(m._id));
        newMsgs.forEach(m => processedMessagesRef.current.add(m._id));
        setData(p => ({
          ...p,
          msg: [...p.msg, ...newMsgs].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
        }));
        setUi(p => ({ ...p, load: false }));
      },

      unreadCounts: (payload) => {
        const map = Object.fromEntries((payload?.counts || []).map(x => [x._id, x.count]));
        setData(p => ({ ...p, unread: map }));
      },

      // 🆕 HANDLER AJOUT AMI
      friendAdded: ({ friend }) => {
        console.log("🎉 [Socket] Nouvel ami ajouté:", friend);
        
        setData(p => {
          const exists = p.conn.some(c => c.id === friend._id || c.id === friend.id);
          if (exists) {
            console.log("ℹ️ [Socket] Contact déjà présent");
            return p;
          }

          const newContact = {
            id: friend._id || friend.id,
            _id: friend._id || friend.id,
            fullName: friend.fullName,
            username: friend.username,
            phone: friend.phone,
            isOnChantilink: true,
            profilePhoto: friend.profilePhoto
          };

          console.log("✨ [Socket] Ajout automatique du contact");
          
          return {
            ...p,
            conn: [...p.conn, newContact],
            stats: {
              ...p.stats,
              total: p.stats.total + 1,
              onChantilink: p.stats.onChantilink + 1
            }
          };
        });

        showToast(`${friend.fullName} a été ajouté à vos contacts`, "success");
      },

      // 🆕 HANDLER MISE À JOUR CONTACT
      contactUpdated: ({ contact }) => {
        console.log("🔄 [Socket] Contact mis à jour:", contact);
        
        setData(p => ({
          ...p,
          conn: p.conn.map(c => 
            (c.id === contact._id || c.id === contact.id) 
              ? { ...c, ...contact } 
              : c
          )
        }));
      },

      // 🆕 HANDLER SUPPRESSION CONTACT
      contactRemoved: ({ contactId }) => {
        console.log("🗑️ [Socket] Contact supprimé:", contactId);
        
        setData(p => ({
          ...p,
          conn: p.conn.filter(c => c.id !== contactId),
          stats: {
            ...p.stats,
            total: Math.max(0, p.stats.total - 1)
          }
        }));

        setSel(s => s.friend?.id === contactId ? { friend: null, msg: null } : s);
      },

      "incoming-call": ({ callId, from, caller, type }) => {
        console.log("Appel entrant:", { callId, from, type });

        const friend = data.conn.find(c => c.id === from) || {
          id: from,
          fullName: caller?.fullName || "Inconnu",
          profilePhoto: caller?.profilePhoto
        };

        if (Notification.permission === "granted") {
          new Notification(`Appel ${type} de ${caller?.fullName || "Inconnu"}`, {
            body: "Appuyez pour répondre",
            icon: "/icon-192x192.png",
            tag: "call-incoming"
          });
        }

        Tone.start().catch(() => {});
        const synth = new Tone.Synth().toDestination();
        toneSynthRef.current = synth;

        const interval = setInterval(() => synth.triggerAttackRelease(1000, "8n"), 1000);
        toneIntervalRef.current = interval;

        const timeout = setTimeout(() => {
          sendMissedCallMessage(friend);
          cleanupCallRingtone();
          setIncomingCall(null);
        }, 30000);
        toneTimeoutRef.current = timeout;

        const cleanup = () => {
          clearTimeout(timeout);
          clearInterval(interval);
          synth.dispose();
          toneTimeoutRef.current = null;
          toneIntervalRef.current = null;
          toneSynthRef.current = null;
        };

        setIncomingCall({ callId, friend, caller, type, cleanup });
      },

      "call-missed": (data) => {
        setMissedCallNotification({
          callId: data.callId,
          caller: {
            id: data.from,
            fullName: data.caller?.fullName || "Inconnu",
            profilePhoto: data.caller?.profilePhoto
          },
          type: data.type,
          timestamp: new Date()
        });
        setTimeout(() => setMissedCallNotification(null), 10000);
      },

      "call-accepted": () => {},
      "call-rejected": () => { showToast("Appel rejeté", "info"); endCall(); },
      "call-not-answered": () => { showToast("Pas de réponse", "info"); endCall(); }
    };

    Object.entries(handlers).forEach(([e, h]) => on(e, h));
    getUnreadCounts();

    return () => {
      Object.entries(handlers).forEach(([e, h]) => off(e, h));
      cleanupCallRingtone();
    };
  }, [
    connected, sel.friend, data.conn, data.msg, on, off, getUnreadCounts, markAsRead, showToast,
    initiateCall, acceptCall, rejectCall, socketEndCall, user?.id, cleanupCallRingtone
  ]);

  // === ACTIONS ===
  const pick = useCallback((f) => {
    if (!f?.id || sel.friend?.id === f.id) return;
    processedMessagesRef.current.clear();
    setSel({ friend: f, msg: null });
    setData(p => ({ ...p, msg: [] }));
    setUi(p => ({ ...p, load: true }));
    setTimeout(() => {
      loadConversation(f.id);
      markAsRead(f.id);
      setData(p => ({ ...p, unread: { ...p.unread, [f.id]: 0 } }));
    }, 50);
  }, [loadConversation, markAsRead]);

  const handleOpenConversationFromRequest = useCallback(async (request) => {
    try {
      console.log("💬 [Messages] Ouverture conversation depuis demande:", request);
      await API.acceptMessageRequest(token, request._id);
      
      const newContact = {
        id: request.sender._id,
        fullName: request.sender.fullName,
        phone: request.sender.phone,
        isOnChantilink: true,
        profilePhoto: request.sender.profilePhoto
      };
      
      setData(p => ({
        ...p,
        conn: [...p.conn, newContact],
        pendingRequests: p.pendingRequests.filter(r => r._id !== request._id)
      }));
      
      setUi(p => ({ ...p, showPending: false }));
      pick(newContact);
      showToast(`Conversation avec ${newContact.fullName} ouverte`, "success");
    } catch (err) {
      console.error("❌ Erreur ouverture conversation:", err);
      showToast("Erreur lors de l'ouverture de la conversation", "error");
    }
  }, [token, pick, showToast]);

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
      status: 'sending'
    };

    setData(p => ({
      ...p,
      msg: [...p.msg, tempMessage]
    }));

    const sent = sendMessage({
      recipientId: sel.friend.id,
      content: input.trim()
    });

    if (sent) {
      setInput("");
      stopTyping(sel.friend.id);
      if (txtRef.current) txtRef.current.style.height = 'auto';
    } else {
      setData(p => ({
        ...p,
        msg: p.msg.filter(m => m._id !== tempId)
      }));
      showToast(MSG.err.send, 'error');
    }
  }, [sel.friend, input, connected, sendMessage, stopTyping, showToast, user.id]);

  const upload = useCallback(async e => {
    const f = e.target.files[0];
    if (!f || !sel.friend || !connected) return;
    if (f.size > CFG.MAX_FILE) { showToast(MSG.err.file, 'error'); return; }
    if (!CFG.TYPES.includes(f.type)) { showToast(MSG.err.type, 'error'); return; }
    setUi(p => ({ ...p, up: true }));
    try {
      const d = await API.uploadFile(f, token);
      const tempId = `temp-file-${Date.now()}`;
      setData(p => ({
        ...p,
        msg: [...p.msg, {
          _id: tempId,
          sender: { _id: user.id },
          file: d.fileUrl,
          timestamp: new Date().toISOString(),
          status: 'sending'
        }]
      }));
    } catch {
      showToast(MSG.err.send, 'error');
    } finally {
      setUi(p => ({ ...p, up: false }));
      if (fileRef.current) fileRef.current.value = '';
    }
  }, [sel.friend, token, connected, showToast, user.id]);

  const startCall = useCallback((t) => {
    if (!sel.friend || !connected) return;
    const success = initiateCall(sel.friend.id, t);
    if (success) {
      setCall({
        on: true,
        type: t,
        friend: sel.friend,
        mute: false,
        video: t === 'video',
        isIncoming: false,
        callId: null
      });
    } else {
      showToast("Impossible d'initier l'appel", "error");
    }
  }, [sel.friend, connected, initiateCall, showToast]);

  const endCall = useCallback(() => {
    if (call.callId) socketEndCall(call.callId);
    setCall({
      on: false,
      type: null,
      friend: null,
      mute: false,
      video: true,
      isIncoming: false,
      callId: null
    });
  }, [call.callId, socketEndCall]);

  const sendMissedCallMessage = useCallback((friend) => {
    if (!friend?.id) return;
    sendMessage({ recipientId: friend.id, content: `Appel manqué`, type: "missed-call" });
  }, [sendMessage]);

  const sendAudio = useCallback(async () => {
    if (!audioBlob || !sel.friend) return;
    setUi(p => ({ ...p, up: true }));
    try {
      const d = await API.uploadFile(audioBlob, token);
      const tempId = `temp-audio-${Date.now()}`;
      setData(p => ({
        ...p,
        msg: [...p.msg, {
          _id: tempId,
          sender: { _id: user.id },
          file: d.fileUrl,
          timestamp: new Date().toISOString(),
          status: 'sending'
        }]
      }));
      cancelAudio();
    } catch {
      showToast("Échec envoi vocal", "error");
    } finally {
      setUi(p => ({ ...p, up: false }));
    }
  }, [audioBlob, sel.friend, token, cancelAudio, showToast, user.id]);

  // === UI CALCULÉE ===
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

  const totalPendingCount = data.pendingRequests?.length || 0;

  return (
    <>
      {/* === BOUTON RETOUR === */}
      <motion.button
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={() => navigate("/")}
        className="fixed top-4 left-4 z-[100] p-3 bg-gradient-to-r from-orange-500 to-pink-500 text-white rounded-full shadow-2xl hover:scale-110"
      >
        <ArrowLeft className="w-6 h-6" />
      </motion.button>

      <div className="fixed inset-0 flex bg-gradient-to-br from-gray-900 to-gray-800">
        {/* === SIDEBAR === */}
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
          pendingCount={totalPendingCount}
          connected={connected}
          reconnecting={recon}
          error={err.load}
        />

        {/* === SECTION CHAT === */}
        <section className="flex-1 flex flex-col overflow-hidden">
          {sel.friend ? (
            <>
              {/* === HEADER === */}
              <div className="p-4 bg-gray-800/50 border-b border-gray-700 flex items-center gap-3 flex-shrink-0">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center text-white font-bold">
                  {sel.friend.fullName?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="flex-1">
                  <h3 className="text-white font-bold">{sel.friend.fullName || "Inconnu"}</h3>
                  <p className="text-xs text-gray-400">
                    {typingUsers[sel.friend.id] ? "Écrit..." : onlineUsers.includes(sel.friend.id) ? "En ligne" : "Hors ligne"}
                  </p>
                </div>
                <button onClick={() => startCall('video')} disabled={!connected}
                  className="p-2 bg-gradient-to-r from-orange-500 to-pink-500 text-white rounded-xl hover:opacity-90 disabled:opacity-50">
                  <Video className="w-5 h-5" />
                </button>
                <button onClick={() => startCall('audio')} disabled={!connected}
                  className="p-2 bg-gray-700 text-white rounded-xl hover:bg-gray-600 disabled:opacity-50">
                  <Phone className="w-5 h-5" />
                </button>
              </div>

              {/* === MESSAGES === */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-orange-500">
                {ui.load ? (
                  <div className="flex justify-center items-center h-full">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-orange-500" />
                  </div>
                ) : data.msg.length === 0 ? (
                  <div className="text-center text-gray-500 py-12">
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                      className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-orange-500/20 to-pink-500/20 flex items-center justify-center">
                      <Send className="w-10 h-10 text-orange-500" />
                    </motion.div>
                    <p className="text-xl font-semibold">Aucun message</p>
                    <p className="text-sm mt-2">Envoyez le premier message</p>
                  </div>
                ) : data.msg.map((m, i) => {
                  const mine = (m.sender?._id || m.sender) === user?.id;
                  const showDay = i === 0 || day(data.msg[i-1]?.timestamp) !== day(m.timestamp);
                  return (
                    <div key={m._id || `msg-${i}`}>
                      {showDay && (
                        <div className="text-center my-4">
                          <span className="px-3 py-1 bg-gray-700/50 text-xs text-gray-400 rounded-full">
                            {day(m.timestamp)}
                          </span>
                        </div>
                      )}
                      {m.type === 'story_reaction' ? (
                        <StoryReactionMessage message={m} isMine={mine} />
                      ) : m.type === 'missed-call' ? (
                        <MissedCallMessage message={m} isMine={mine} />
                      ) : (
                        <StandardMessage
                          message={m}
                          isMine={mine}
                          status={m.status}
                          onClick={() => setSel(p => ({ ...p, msg: m }))}
                        />
                      )}
                    </div>
                  );
                })}
                <div ref={endRef} />
              </div>

              {/* === INPUT === */}
              <div className="p-4 bg-gray-800/50 border-t border-gray-700 flex-shrink-0 relative">
                <AnimatePresence>
                  {audioUrl && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                      className="mb-3 p-3 bg-gray-700 rounded-xl flex items-center gap-3">
                      <button onClick={isPlaying ? pausePreview : playPreview}
                        className="p-2 bg-orange-500 rounded-full text-white">
                        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </button>
                      <audio ref={audioRef} src={audioUrl} />
                      <div className="flex-1 h-2 bg-gray-600 rounded-full overflow-hidden">
                        <motion.div className="h-full bg-gradient-to-r from-orange-500 to-pink-500"
                          animate={{ width: isPlaying ? "100%" : "0%" }} transition={{ duration: 10, ease: "linear" }} />
                      </div>
                      <button onClick={sendAudio} className="p-2 bg-green-500 rounded-full text-white hover:bg-green-600">
                        <Send className="w-4 h-4" />
                      </button>
                      <button onClick={cancelAudio} className="p-2 bg-red-500 rounded-full text-white hover:bg-red-600">
                        <X className="w-4 h-4" />
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex items-end gap-2">
                  <button onClick={() => setUi(p => ({ ...p, showEmoji: !p.showEmoji }))}
                    className="p-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl">
                    <Smile className="w-5 h-5" />
                  </button>
                  <button onClick={() => fileRef.current?.click()} disabled={ui.up || !connected}
                    className="p-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl disabled:opacity-50">
                    {ui.up ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Paperclip className="w-5 h-5" />}
                  </button>
                  <input ref={fileRef} type="file" accept="image/*,video/*,audio/*" onChange={upload} className="hidden" />
                  <div className="flex-1 relative">
                    <textarea
                      ref={txtRef}
                      value={input}
                      onChange={type}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                      placeholder={connected ? "Message..." : "Hors ligne..."}
                      className="w-full p-3 bg-gray-700 text-white rounded-xl min-h-[44px] max-h-32 resize-none focus:outline-none focus:ring-2 focus:ring-orange-500 pr-12"
                      disabled={ui.up || !connected}
                      rows={1}
                    />
                  </div>
                  <button
                    onMouseDown={startRecording}
                    onMouseUp={stopRecording}
                    onTouchStart={startRecording}
                    onTouchEnd={stopRecording}
                    disabled={!connected || !!audioUrl}
                    className={`p-3 rounded-xl transition-all ${recording ? "bg-red-600 animate-pulse" : "bg-gray-700 hover:bg-gray-600 text-white"} disabled:opacity-50`}
                  >
                    {recording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                  </button>
                  <button onClick={send} disabled={!input.trim() || ui.up || !connected}
                    className="p-3 bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white rounded-xl disabled:opacity-50">
                    <Send className="w-5 h-5" />
                  </button>
                </div>

                <AnimatePresence>
                  {ui.showEmoji && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
                      className="absolute bottom-full left-0 mb-2 z-10">
                      <div className="bg-gray-800 p-2 rounded-xl shadow-2xl">
                        <Picker onEmojiClick={(e) => { setInput(p => p + e.emoji); setUi(p => ({ ...p, showEmoji: false })); }} theme="dark" height={350} width={320} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {!connected && (
                  <p className="text-xs text-red-400 mt-2 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" /> Vous êtes hors ligne
                  </p>
                )}
              </div>
            </>
          ) : (
            /* === ÉCRAN VIDE === */
            <div className="flex-1 flex items-center justify-center text-gray-500 text-center p-6">
              <div>
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                  className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-orange-500/20 to-pink-500/20 flex items-center justify-center">
                  <Send className="w-12 h-12 text-orange-500" />
                </motion.div>
                <p className="text-2xl font-bold mb-2">Vos Messages</p>
                <p className="text-sm mb-4">Sélectionnez une conversation pour commencer</p>

                {totalPendingCount > 0 && (
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                    className="mt-6 p-4 bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-xl max-w-md mx-auto">
                    <div className="flex items-center gap-3 mb-2">
                      <Heart className="w-6 h-6 text-purple-400" />
                      <p className="text-white font-semibold">
                        {totalPendingCount} nouvelle{totalPendingCount > 1 ? 's' : ''} demande{totalPendingCount > 1 ? 's' : ''}
                      </p>
                    </div>
                    <p className="text-sm text-gray-300 mb-3">Des personnes ont réagi à vos stories</p>
                    <button onClick={() => setUi(p => ({ ...p, showPending: true }))}
                      className="w-full px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg font-semibold">
                      Voir les demandes
                    </button>
                  </motion.div>
                )}

                {data.conn.length === 0 && totalPendingCount === 0 && (
                  <div className="space-y-3">
                    <button onClick={() => API.syncContacts(token, []).then(load)}
                      className="px-6 py-3 bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white rounded-xl font-semibold">
                      Synchroniser mes contacts
                    </button>
                    <button onClick={() => setUi(p => ({ ...p, showAddContact: true }))}
                      className="px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-xl font-semibold flex items-center gap-2 mx-auto">
                      <UserPlus className="w-5 h-5" />
                      Ajouter un contact manuellement
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* === CALL MANAGER === */}
      {call.on && !call.isIncoming && (
        <CallManager
          call={call}
          onEndCall={endCall}
          onToggleMute={() => setCall(p => ({ ...p, mute: !p.mute }))}
          onToggleVideo={() => setCall(p => ({ ...p, video: !p.video }))}
        />
      )}

      {/* === INCOMING CALL MODAL === */}
      <AnimatePresence>
        {incomingCall && (
          <IncomingCallModal
            caller={incomingCall.caller || incomingCall.friend}
            type={incomingCall.type}
            onAccept={() => {
              acceptCall(incomingCall.callId);
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
              rejectCall(incomingCall.callId);
              setIncomingCall(null);
              incomingCall.cleanup?.();
            }}
          />
        )}
      </AnimatePresence>

      {/* === MISSED CALL NOTIFICATION === */}
      <AnimatePresence>
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
      </AnimatePresence>

      {/* === MODALS === */}
      <AnimatePresence>
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
            onAccept={async (request) => {
              try {
                console.log("🎯 [Messages] Acceptation demande:", request._id);
                
                // 1️⃣ Accepter la demande côté backend
                await API.acceptMessageRequest(token, request._id);
                console.log("✅ [Messages] Demande acceptée côté backend");

                // 2️⃣ Créer l'objet contact complet
                const newContact = {
                  id: request.sender._id,
                  _id: request.sender._id,
                  fullName: request.sender.fullName,
                  username: request.sender.username,
                  phone: request.sender.phone,
                  isOnChantilink: true,
                  profilePhoto: request.sender.profilePhoto
                };

                console.log("👤 [Messages] Nouveau contact:", newContact);

                // 3️⃣ MISE À JOUR IMMÉDIATE DE L'UI
                setData(p => {
                  const exists = p.conn.some(c => c.id === newContact.id);
                  if (exists) {
                    console.log("ℹ️ [Messages] Contact déjà dans la liste");
                    return p;
                  }

                  console.log("✨ [Messages] Ajout du contact à la liste");
                  return {
                    ...p,
                    conn: [...p.conn, newContact],
                    pendingRequests: p.pendingRequests.filter(r => r._id !== request._id),
                    unread: {
                      ...p.unread,
                      [newContact.id]: 0
                    }
                  };
                });

                // 4️⃣ Recharger pour sync backend
                console.log("🔄 [Messages] Rechargement des conversations...");
                await load();

                // 5️⃣ Fermer la modal
                setUi(p => ({ ...p, showPending: false }));

                // 6️⃣ Ouvrir la conversation
                console.log("💬 [Messages] Ouverture de la conversation");
                pick(newContact);

                // 7️⃣ Notification
                showToast(`${newContact.fullName} ajouté à vos contacts`, "success");
                
              } catch (err) {
                console.error("❌ [Messages] Erreur acceptation:", err);
                showToast(
                  err.message || "Erreur lors de l'acceptation de la demande",
                  "error"
                );
              }
            }}
            onReject={async (requestId) => {
              try {
                console.log("🗑️ [Messages] Rejet demande:", requestId);
                await API.rejectMessageRequest(token, requestId);
                
                setData(p => ({
                  ...p,
                  pendingRequests: p.pendingRequests.filter(r => r._id !== requestId)
                }));
                
                showToast("Demande rejetée", "info");
              } catch (err) {
                console.error("❌ [Messages] Erreur rejet:", err);
                showToast("Erreur lors du rejet", "error");
              }
            }}
            onOpenConversation={handleOpenConversationFromRequest}
          />
        )}
      </AnimatePresence>
    </>
  );
}