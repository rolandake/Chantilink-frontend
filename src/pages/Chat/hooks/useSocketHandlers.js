// ============================================
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
  setUi, // ✅ Indispensable pour arrêter le spinner de chargement
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
    // Si pas de connexion, on ne fait rien
    if (!connected) return;

    // === FONCTION UTILITAIRE DE NORMALISATION ===
    // Cette fonction transforme n'importe quel message du backend en format standard pour le frontend
    const normalizeMessage = (rawMsg) => {
      // 1. Récupération sécurisée du fichier (le backend peut utiliser différents noms)
      const fileUrl = rawMsg.file || rawMsg.attachmentUrl || rawMsg.url || null;

      // 2. Détection du type
      let type = rawMsg.type;

      // Si le type est générique ou manquant, et qu'il y a un fichier, on essaie de deviner
      if ((!type || type === 'file') && fileUrl) {
         // On laisse le composant d'affichage faire la détection fine par extension,
         // mais on s'assure que le type 'file' est présent a minima.
         type = 'file';
      }

      return {
        ...rawMsg,
        file: fileUrl, // On force le nom de propriété 'file'
        type: type || 'text'
      };
    };

    const handlers = {
      // ----------------------------------------------------
      // 1. RÉCEPTION D'UN NOUVEAU MESSAGE (TEMPS RÉEL)
      // ----------------------------------------------------
      receiveMessage: (rawMessage) => {
        const msgId = rawMessage._id;
        // Éviter les doublons stricts
        if (!msgId || processedMessagesRef.current.has(msgId)) return;

        // ✅ NORMALISATION
        const m = normalizeMessage(rawMessage);

        const senderId = m.sender?._id || m.sender;
        if (!senderId) return;

        const isOwnMessage = senderId === user?.id;
        let tempIndex = -1;

        // Gestion optimiste : Si c'est mon message, je cherche le message temporaire pour le remplacer
        if (isOwnMessage && sel.friend?.id === m.recipient) {
          tempIndex = data.msg.findIndex(msg =>
            msg._id?.toString().startsWith('temp-') &&
            // On compare le contenu ou le type pour matcher le bon message temporaire
            (msg.content === m.content || (msg.type === m.type && msg.file))
          );
        }

        // Si je suis sur la conversation active avec cet ami
        if (sel.friend?.id === senderId || (isOwnMessage && sel.friend?.id === m.recipient)) {
          setData(p => {
            let newMsgs = [...p.msg];
            if (tempIndex !== -1) {
              // On remplace le message temporaire par le message confirmé (avec la vraie URL du fichier)
              newMsgs[tempIndex] = { ...m, status: 'sent' };
            } else {
              newMsgs = [...newMsgs, m];
            }
            // Tri chronologique pour éviter les sauts
            return {
              ...p,
              msg: newMsgs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
            };
          });
          
          if (!isOwnMessage) markAsRead(senderId);

        } else {
          // Si je ne suis PAS sur la conversation : Gérer les notifications
          const isContact = data.conn.some(c => c.id === senderId);
          
          // Si c'est un inconnu, on l'ajoute aux requêtes en attente
          if (!isContact) {
            setData(p => ({
              ...p,
              pendingRequests: [...p.pendingRequests.filter(r => (r.sender?._id || r.sender) !== senderId), m]
            }));
          }
          
          // Incrémenter le compteur non lu
          setData(p => ({
            ...p,
            unread: { ...p.unread, [senderId]: (p.unread[senderId] || 0) + 1 }
          }));

          // Toast intelligent selon le type
          if (m.type === 'story_reaction') showToast(`${m.sender.fullName} a réagi à votre story`, 'info');
          else if (m.type === 'missed-call') showToast(`Appel manqué de ${m.sender.fullName}`, 'warning');
          else if (m.file) showToast(`${m.sender.fullName} a envoyé un fichier`, 'info');
          else showToast(`${m.sender.fullName} vous a écrit`, 'info');
        }
        
        // Marquer comme traité
        processedMessagesRef.current.add(msgId);
      },

      // ----------------------------------------------------
      // 2. CHARGEMENT DE L'HISTORIQUE (MESSAGE LIST)
      // ----------------------------------------------------
      messages: (payload) => {
        console.log("📥 [Socket] Historique reçu");
        
        // Le payload peut être un tableau direct ou un objet { messages: [...] }
        const rawMessages = Array.isArray(payload) ? payload : (payload?.messages || []);

        // ✅ NORMALISATION DE TOUT L'HISTORIQUE
        // C'est vital pour que les anciens messages multimédias s'affichent bien au rechargement
        const normalizedMessages = rawMessages.map(normalizeMessage);

        const newMsgs = normalizedMessages.filter(m => m._id && !processedMessagesRef.current.has(m._id));
        newMsgs.forEach(m => processedMessagesRef.current.add(m._id));

        setData(p => ({
          ...p,
          msg: [...p.msg, ...newMsgs].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
        }));

        // Arrêt du loader UI
        if (setUi) {
          setUi(p => ({ ...p, load: false }));
        }
      },
      
      // Alias pour la compatibilité backend
      conversationLoaded: (payload) => handlers.messages(payload),

      // ----------------------------------------------------
      // 3. COMPTEURS NON LUS
      // ----------------------------------------------------
      unreadCounts: (payload) => {
        const map = Object.fromEntries((payload?.counts || []).map(x => [x._id, x.count]));
        setData(p => ({ ...p, unread: map }));
      },

      // ----------------------------------------------------
      // 4. GESTION DES CONTACTS (Ajout/Modif/Suppr)
      // ----------------------------------------------------
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

      // ----------------------------------------------------
      // 5. GESTION DES APPELS
      // ----------------------------------------------------
      "incoming-call": ({ callId, from, caller, type }) => {
        const friend = data.conn.find(c => c.id === from) || {
          id: from,
          fullName: caller?.fullName || "Inconnu",
          profilePhoto: caller?.profilePhoto
        };

        // Lancement Sonnerie
        Tone.start().catch(() => {});
        const synth = new Tone.Synth().toDestination();
        toneSynthRef.current = synth;
        const interval = setInterval(() => synth.triggerAttackRelease(1000, "8n"), 1000);
        toneIntervalRef.current = interval;

        // Timeout auto-rejet (30s)
        const timeout = setTimeout(() => {
          if (sendMissedCallMessage) sendMissedCallMessage(friend, type);
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

    // === ABONNEMENTS ===
    Object.entries(handlers).forEach(([evt, handler]) => {
        on(evt, handler);
    });
    
    // Initialisation
    getUnreadCounts();

    // === NETTOYAGE ===
    return () => {
      Object.entries(handlers).forEach(([evt, handler]) => {
          off(evt, handler);
      });
      cleanupCallRingtone();
    };
  }, [
    connected, 
    sel.friend, 
    data.conn, 
    on, 
    off, 
    getUnreadCounts, 
    markAsRead, 
    showToast, 
    user?.id, 
    cleanupCallRingtone, 
    setData, 
    setUi, 
    setIncomingCall, 
    setMissedCallNotification, 
    processedMessagesRef, 
    sendMessage
  ]);
}