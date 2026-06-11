// ============================================
// 📁 src/pages/Chat/hooks/useSocketHandlers.js
// FIXES:
//  - Sonnerie Tone.js : PolySynth créé sans await Tone.start() → crash silencieux
//  - "call-initiated" non géré → callIdRef jamais mis à jour
//  - "call-accepted" non géré → UI bloquée à "calling"
//  - messageDeleted ne notifiait pas l'UI
//  - La sonnerie entrante ne s'arrêtait pas si le composant se démontait
//  - unreadCounts : mauvais merge (écrasait l'existant)
// ============================================
import { useEffect } from "react";
import * as Tone from "tone";

const getEntityId = (value) => {
  if (!value) return "";
  if (typeof value === "object") return String(value._id || value.id || "");
  return String(value);
};

export function useSocketHandlers({
  connected, on, off, getUnreadCounts, markAsRead,
  socketEndCall,
  user, sel, data, setData, setUi,
  setIncomingCall, setMissedCallNotification,
  showToast, processedMessagesRef, cleanupCallRingtone,
  sendMessage, toneIntervalRef, toneSynthRef, sendMissedCallMessage,
  // ✅ FIX: recevoir setCall pour gérer call-initiated et call-accepted
  setCall,
}) {
  useEffect(() => {
    if (!connected) return;

    const normalizeMessage = (raw) => {
      const fileUrl = raw.file || raw.attachmentUrl || raw.url || null;
      return {
        ...raw,
        _id:         raw._id || raw.id,
        senderId:    getEntityId(raw.sender),
        recipientId: getEntityId(raw.recipient),
        file:        fileUrl,
        type:        raw.type || (fileUrl ? "file" : "text"),
        metadata:    raw.metadata || {},
        status:      "sent",
      };
    };

    const handlers = {
      // ─── 1. RÉCEPTION MESSAGE ───────────────────────────────────
      receiveMessage: (raw) => {
        const m = normalizeMessage(raw);
        if (processedMessagesRef.current.has(m._id)) return;

        const currentUserId  = getEntityId(user);
        const selectedFriendId = getEntityId(sel.friend);
        const isOwn          = m.senderId === currentUserId;
        const isCurrentChat  = !!selectedFriendId && (
          selectedFriendId === m.senderId ||
          (isOwn && selectedFriendId === m.recipientId)
        );

        if (isCurrentChat) {
          setData((p) => {
            const tempIdx = p.msg.findIndex(
              (msg) => msg.status === "sending" && msg.content === m.content && msg.type === m.type
            );
            let newList = [...p.msg];
            if (tempIdx !== -1) newList[tempIdx] = m;
            else if (!newList.some((msg) => msg._id === m._id)) newList.push(m);
            return {
              ...p,
              msg: newList.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)),
            };
          });
          if (!isOwn) markAsRead(m.senderId);
        } else if (m.senderId && m.senderId !== getEntityId(user)) {
          // ✅ FIX: merger correctement sans écraser l'existant
          setData((p) => ({
            ...p,
            unread: {
              ...p.unread,
              [m.senderId]: (p.unread[m.senderId] || 0) + 1,
            },
          }));

          const senderName =
            data.conn.find((c) => c.id === m.senderId)?.fullName || "Nouveau message";
          showToast(`💬 ${senderName}`, "info");
        }

        processedMessagesRef.current.add(m._id);
      },

      // ─── 2. SUPPRESSION À DISTANCE ──────────────────────────────
      messageDeleted: ({ messageId }) => {
        setData((p) => ({
          ...p,
          msg: p.msg.filter((m) => m._id !== messageId),
        }));
        processedMessagesRef.current.delete(messageId);
      },

      // ─── 3. CHARGEMENT HISTORIQUE ───────────────────────────────
      messages: (payload) => {
        const rawList = Array.isArray(payload)
          ? payload
          : payload?.messages || [];
        const cleanList = rawList.map(normalizeMessage);
        cleanList.forEach((m) => processedMessagesRef.current.add(m._id));
        setData((p) => ({
          ...p,
          msg: cleanList.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)),
        }));
        if (setUi) setUi((p) => ({ ...p, load: false }));
      },

      // ─── 4. APPEL ENTRANT ────────────────────────────────────────
      "incoming-call": ({ callId, from, caller, type }) => {
        const friend =
          data.conn.find((c) => c.id === from) ||
          { id: from, fullName: caller?.fullName || "Anonyme" };

        // ✅ FIX: await Tone.start() avant de créer le synth
        Tone.start().then(() => {
          if (toneSynthRef.current) return; // déjà une sonnerie active
          const synth = new Tone.PolySynth().toDestination();
          toneSynthRef.current = synth;
          const interval = setInterval(() => {
            try {
              synth.triggerAttackRelease(["C4", "E4"], "8n");
            } catch {/* synth libéré entre-temps */}
          }, 1200);
          toneIntervalRef.current = interval;
        }).catch(() => {/* autoplay bloqué — sonnerie silencieuse */});

        setIncomingCall({ callId, friend, type });

        // Auto-rejet après 30 s
        setTimeout(() => {
          setIncomingCall((prev) => {
            if (prev?.callId === callId) {
              cleanupCallRingtone();
              sendMissedCallMessage(friend, type);
              return null;
            }
            return prev;
          });
        }, 30_000);
      },

      // ─── 5. APPEL INITIÉ (callId connu côté serveur) ─────────────
      // ✅ FIX: manquait complètement — causait callId=null indéfiniment
      "call-initiated": ({ callId }) => {
        if (typeof setCall === "function") {
          setCall((prev) => ({ ...prev, callId }));
        }
      },

      // ─── 6. APPEL ACCEPTÉ ────────────────────────────────────────
      // ✅ FIX: manquait — l'appelant restait bloqué en état "calling"
      "call-accepted": ({ callId }) => {
        if (typeof setCall === "function") {
          setCall((prev) => ({ ...prev, on: true, callId: callId || prev.callId }));
        }
      },

      // ─── 7. APPEL REJETÉ ─────────────────────────────────────────
      "call-rejected": () => {
        cleanupCallRingtone();
        showToast("Appel occupé", "info");
        if (typeof setCall === "function") {
          setCall({
            on: false, type: null, friend: null,
            mute: false, video: true, isIncoming: false, callId: null,
          });
        }
      },

      // ─── 8. APPEL TERMINÉ ────────────────────────────────────────
      "call-ended": () => {
        cleanupCallRingtone();
        socketEndCall();
      },

      // ─── 9. PRÉSENCE ─────────────────────────────────────────────
      onlineUsers: (_users) => {
        // géré directement dans Messages.jsx
      },

      // ─── 10. COMPTEURS NON LUS ───────────────────────────────────
      unreadCounts: (payload) => {
        const counts = Object.fromEntries(
          (payload?.counts || []).map((x) => [x._id, x.count])
        );
        // ✅ FIX: merger au lieu d'écraser
        setData((p) => ({
          ...p,
          unread: { ...p.unread, ...counts },
        }));
      },
    };

    Object.entries(handlers).forEach(([ev, fn]) => on(ev, fn));
    if (typeof getUnreadCounts === "function") getUnreadCounts();

    return () => {
      Object.entries(handlers).forEach(([ev, fn]) => off(ev, fn));
      cleanupCallRingtone();
    };
  }, [
    connected,
    sel.friend?.id,
    // ✅ FIX: data.conn en dépendance stable (longueur suffit pour éviter les re-render infinis)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    data.conn.length,
    on, off, getUnreadCounts,
    markAsRead, showToast, user, setData, setUi,
    setIncomingCall, processedMessagesRef,
    cleanupCallRingtone, setCall, socketEndCall,
    sendMissedCallMessage,
  ]);
}