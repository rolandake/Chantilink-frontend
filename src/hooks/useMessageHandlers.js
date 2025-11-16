
// ============================================
// 📁 src/hooks/useMessageHandlers.js
// ============================================
import { useCallback, useRef } from 'react';
import { playSendSound, playReceiveSound } from '../utils/sounds';
import { CFG } from '../utils/messageConstants';

export const useMessageHandlers = ({
  connected,
  sel,
  user,
  data,
  sendMessage,
  markAsRead,
  stopTyping,
  showToast,
  setData,
  setPendingMessages,
  setErr,
  processedMessagesRef,
  loadedSendersRef
}) => {
  const typeRef = useRef(null);

  const handleReceiveMessage = useCallback((m) => {
    const msgId = m._id || `${m.sender?._id || m.sender}-${m.timestamp}`;
    if (processedMessagesRef.current.has(msgId)) return;
    processedMessagesRef.current.add(msgId);
    playReceiveSound();

    const senderId = m.sender?._id || m.sender;
    const senderInfo = { 
      id: senderId, 
      name: m.sender?.fullName || m.sender?.username || "Inconnu", 
      photo: m.sender?.profilePhoto 
    };

    if (sel.friend && senderId === sel.friend.id) {
      setData(p => {
        if (p.msg.some(existing => existing._id === m._id)) return p;
        return { ...p, msg: [...p.msg, m] };
      });
      markAsRead(sel.friend.id);
    } else {
      if (!data.conn.some(c => c.id === senderId)) {
        if (!loadedSendersRef.current.has(senderId)) {
          loadedSendersRef.current.add(senderId);
          if (loadedSendersRef.current.size > CFG.MAX_PENDING_SENDERS) {
            const first = loadedSendersRef.current.values().next().value;
            loadedSendersRef.current.delete(first);
          }
          setPendingMessages(prev => prev.some(p => p.id === senderId) ? prev : [...prev, senderInfo]);
        }
      }
      setData(p => ({ 
        ...p, 
        unread: { ...p.unread, [senderId]: (p.unread[senderId] || 0) + 1 } 
      }));
      showToast(
        m.type === 'story_reaction' 
          ? `${senderInfo.name} a réagi à votre story` 
          : `${senderInfo.name} vous a écrit`, 
        'info'
      );
    }
  }, [sel.friend, data.conn, markAsRead, showToast, setData, setPendingMessages, processedMessagesRef, loadedSendersRef]);

  const handleSendMessage = useCallback(() => {
    if (!sel.friend || !connected) return false;
    
    const sent = sendMessage({ recipientId: sel.friend.id });
    if (sent) {
      playSendSound();
      stopTyping(sel.friend.id);
      return true;
    } else {
      showToast('Échec envoi', 'error');
      return false;
    }
  }, [sel.friend, connected, sendMessage, stopTyping, showToast]);

  return {
    handleReceiveMessage,
    handleSendMessage,
    typeRef
  };
};
