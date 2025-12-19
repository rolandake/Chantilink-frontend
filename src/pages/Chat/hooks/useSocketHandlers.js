// ============================================
// 📁 src/pages/Chat/hooks/useSocketHandlers.js
// VERSION: ÉLITE - RELIABILITY & PRIVACY
// ============================================
import { useEffect } from "react";
import * as Tone from "tone";

export function useSocketHandlers({
  connected, on, off, getUnreadCounts, markAsRead,
  acceptCall, rejectCall, socketEndCall,
  user, sel, data, setData, setUi,
  setIncomingCall, setMissedCallNotification,
  showToast, processedMessagesRef, cleanupCallRingtone,
  sendMessage, toneIntervalRef, toneSynthRef, sendMissedCallMessage
}) {
  useEffect(() => {
    if (!connected) return;

    // --- 🛡️ UTILITAIRE DE FIABILITÉ : NORMALISATION ---
    const normalizeMessage = (raw) => {
      const fileUrl = raw.file || raw.attachmentUrl || raw.url || null;
      return {
        ...raw,
        _id: raw._id || raw.id,
        senderId: raw.sender?._id || raw.sender,
        file: fileUrl,
        type: raw.type || (fileUrl ? 'file' : 'text'),
        metadata: raw.metadata || {}, // Pour la taille, durée, etc.
        status: 'sent'
      };
    };

    const handlers = {
      // 1. RÉCEPTION MESSAGE (PRIVÉ & SÉCURISÉ)
      receiveMessage: (raw) => {
        const m = normalizeMessage(raw);
        if (processedMessagesRef.current.has(m._id)) return;

        const isOwn = m.senderId === user?.id;
        const isCurrentChat = sel.friend?.id === m.senderId || (isOwn && sel.friend?.id === m.recipient);

        if (isCurrentChat) {
          setData(p => {
            // Remplacement intelligent du message temporaire (Simplicité UX)
            const tempIdx = p.msg.findIndex(msg => 
              msg.status === 'sending' && (msg.content === m.content || msg.type === m.type)
            );

            let newList = [...p.msg];
            if (tempIdx !== -1) newList[tempIdx] = m;
            else newList.push(m);

            return { ...p, msg: newList.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)) };
          });

          if (!isOwn) markAsRead(m.senderId);
        } else {
          // Hors de la vue : Notification discrète (Confidentialité)
          setData(p => ({
            ...p,
            unread: { ...p.unread, [m.senderId]: (p.unread[m.senderId] || 0) + 1 }
          }));
          
          const senderName = data.conn.find(c => c.id === m.senderId)?.fullName || "Collègue";
          showToast(`Nouveau message de ${senderName}`, 'info');
        }
        processedMessagesRef.current.add(m._id);
      },

      // 2. SUPPRESSION À DISTANCE (CONFIDENTIALITÉ)
      messageDeleted: ({ messageId }) => {
        setData(p => ({ ...p, msg: p.msg.filter(m => m._id !== messageId) }));
        processedMessagesRef.current.delete(messageId);
      },

      // 3. CHARGEMENT HISTORIQUE
      messages: (payload) => {
        const rawList = Array.isArray(payload) ? payload : (payload?.messages || []);
        const cleanList = rawList.map(normalizeMessage);
        
        cleanList.forEach(m => processedMessagesRef.current.add(m._id));
        setData(p => ({ 
          ...p, 
          msg: cleanList.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)) 
        }));
        if (setUi) setUi(p => ({ ...p, load: false }));
      },

      // 4. GESTION APPELS (FIABILITÉ AUDIO)
      "incoming-call": ({ callId, from, caller, type }) => {
        const friend = data.conn.find(c => c.id === from) || { id: from, fullName: caller?.fullName || "Anonyme" };

        // 🎵 Sonnerie élégante (Tone.js)
        Tone.start();
        const synth = new Tone.PolySynth().toDestination();
        toneSynthRef.current = synth;
        const interval = setInterval(() => synth.triggerAttackRelease(["C4", "E4"], "8n"), 1200);
        toneIntervalRef.current = interval;

        setIncomingCall({ callId, friend, type });

        // Auto-rejet après 30s
        setTimeout(() => {
          setIncomingCall(prev => {
            if (prev?.callId === callId) {
              cleanupCallRingtone();
              return null;
            }
            return prev;
          });
        }, 30000);
      },

      "call-rejected": () => {
        cleanupCallRingtone();
        showToast("Appel occupé", "info");
      },

      "call-ended": () => {
        cleanupCallRingtone();
        socketEndCall();
      },

      // 5. PRÉSENCE (QUI EST EN LIGNE)
      onlineUsers: (users) => {
        // Optionnel : Mettre à jour l'UI des contacts en ligne
      },

      unreadCounts: (payload) => {
        const counts = Object.fromEntries((payload?.counts || []).map(x => [x._id, x.count]));
        setData(p => ({ ...p, unread: counts }));
      }
    };

    // Abonnement
    Object.entries(handlers).forEach(([ev, fn]) => on(ev, fn));
    getUnreadCounts();

    return () => {
      Object.entries(handlers).forEach(([ev, fn]) => off(ev, fn));
      cleanupCallRingtone();
    };
  }, [
    connected, sel.friend?.id, data.conn, on, off, getUnreadCounts, 
    markAsRead, showToast, user?.id, setData, setUi, 
    setIncomingCall, processedMessagesRef, cleanupCallRingtone
  ]);
}