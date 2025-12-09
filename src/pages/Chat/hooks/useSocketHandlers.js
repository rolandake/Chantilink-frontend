// ============================================ //
// 📁 src/pages/Chat/hooks/useSocketHandlers.js
// ============================================
import { useEffect } from "react";
import * as Tone from "tone";

export function useSocketHandlers({
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
  setUi, // ✅ Indispensable pour arrêter le spinner
  setIncomingCall,
  setMissedCallNotification,
  showToast,
  processedMessagesRef,
  cleanupCallRingtone,
  sendMessage,
  toneIntervalRef,
  toneTimeoutRef,
  toneSynthRef,
  sendMissedCallMessage
}) {
  useEffect(() => {
    if (!connected) return;

    const handlers = {
      // 1. Gestion des nouveaux messages entrants (un par un)
      receiveMessage: (m) => {
        const msgId = m._id;
        if (!msgId || processedMessagesRef.current.has(msgId)) return;

        const senderId = m.sender?._id || m.sender;
        if (!senderId) return;

        const isOwnMessage = senderId === user?.id;
        let tempIndex = -1;

        // Gestion optimiste (remplacement du message temporaire)
        if (isOwnMessage && sel.friend?.id === m.recipient) {
          tempIndex = data.msg.findIndex(msg =>
            msg._id?.toString().startsWith('temp-') &&
            msg.content === m.content
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
          // Notification si on n'est pas sur la conversation
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

          if (m.type === 'story_reaction') showToast(`${m.sender.fullName} a réagi à votre story`, 'info');
          else if (m.type === 'missed-call') showToast(`Appel manqué de ${m.sender.fullName}`, 'warning');
          else showToast(`${m.sender.fullName} vous a écrit`, 'info');
        }
        processedMessagesRef.current.add(msgId);
      },

      // 🚨 2. C'EST ICI LA CORRECTION PRINCIPALE 🚨
      // On écoute 'messages' (réponse standard) ET 'conversationLoaded' (au cas où)
      messages: (payload) => {
        console.log("📥 [Socket] Historique reçu, arrêt du chargement...");
        
        // Sécurité : le payload peut être un tableau direct ou un objet { messages: [] }
        const messages = Array.isArray(payload) ? payload : (payload?.messages || []);

        const newMsgs = messages.filter(m => m._id && !processedMessagesRef.current.has(m._id));
        newMsgs.forEach(m => processedMessagesRef.current.add(m._id));

        setData(p => ({
          ...p,
          msg: [...p.msg, ...newMsgs].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
        }));

        // ✅ ARRÊT DU SPINNER
        if (setUi) {
          setUi(p => ({ ...p, load: false }));
        }
      },
      
      // Fallback si ton backend utilise l'ancien nom
      conversationLoaded: (payload) => {
        console.log("📥 [Socket] conversationLoaded reçu");
        // On redirige vers la même logique
        handlers.messages(payload);
      },

      unreadCounts: (payload) => {
        const map = Object.fromEntries((payload?.counts || []).map(x => [x._id, x.count]));
        setData(p => ({ ...p, unread: map }));
      },

      friendAdded: ({ friend }) => {
        setData(p => {
            const exists = p.conn.some(c => c.id === friend._id || c.id === friend.id);
            if (exists) return p;
            const newContact = {
                id: friend._id || friend.id,
                _id: friend._id || friend.id,
                fullName: friend.fullName,
                username: friend.username,
                phone: friend.phone,
                isOnChantilink: true,
                profilePhoto: friend.profilePhoto
            };
            return { ...p, conn: [...p.conn, newContact] };
        });
        showToast(`${friend.fullName} ajouté`, "success");
      },

      contactUpdated: ({ contact }) => {
        setData(p => ({
          ...p,
          conn: p.conn.map(c => (c.id === contact._id || c.id === contact.id) ? { ...c, ...contact } : c)
        }));
      },

      contactRemoved: ({ contactId }) => {
        setData(p => ({
          ...p,
          conn: p.conn.filter(c => c.id !== contactId)
        }));
      },

      "incoming-call": ({ callId, from, caller, type }) => {
        const friend = data.conn.find(c => c.id === from) || {
          id: from,
          fullName: caller?.fullName || "Inconnu",
          profilePhoto: caller?.profilePhoto
        };

        Tone.start().catch(() => {});
        const synth = new Tone.Synth().toDestination();
        toneSynthRef.current = synth;
        const interval = setInterval(() => synth.triggerAttackRelease(1000, "8n"), 1000);
        toneIntervalRef.current = interval;

        const timeout = setTimeout(() => {
          sendMissedCallMessage(friend, type);
          cleanupCallRingtone();
          setIncomingCall(null);
        }, 30000);
        toneTimeoutRef.current = timeout;

        setIncomingCall({ 
            callId, 
            friend, 
            caller, 
            type, 
            cleanup: () => {
                clearTimeout(timeout);
                clearInterval(interval);
                synth.dispose();
            } 
        });
      },

      "call-missed": (d) => {
        setMissedCallNotification({
          caller: { id: d.from, fullName: d.caller?.fullName || "Inconnu" },
          type: d.type,
          timestamp: new Date()
        });
        setTimeout(() => setMissedCallNotification(null), 10000);
      },

      "call-rejected": () => showToast("Appel rejeté", "info"),
      "call-ended": () => {
         socketEndCall(); 
         cleanupCallRingtone();
      }
    };

    // Abonnements
    Object.entries(handlers).forEach(([e, h]) => on(e, h));
    getUnreadCounts();

    return () => {
      Object.entries(handlers).forEach(([e, h]) => off(e, h));
      cleanupCallRingtone();
    };
  }, [
    connected, sel.friend, data.conn, on, off, getUnreadCounts, markAsRead, showToast,
    user?.id, cleanupCallRingtone, setData, setUi, setIncomingCall, setMissedCallNotification,
    processedMessagesRef, sendMessage
  ]);
}