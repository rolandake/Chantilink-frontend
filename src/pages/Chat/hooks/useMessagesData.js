// ============================================
// 📁 src/pages/Chat/hooks/useMessagesData.js
// VERSION AVEC CACHE IndexedDB
// ============================================
import { useState, useEffect, useCallback, useRef } from "react";
import { API } from "../../../services/apiService";
import messageCache from "../../../utils/messageCache";

export function useMessagesData(token, showToast) {
  const [ui, setUi] = useState({
    load: true,
    up: false,
    search: "",
    showPending: false,
    showEmoji: false,
    showAddContact: false,
    showForward: false,
    contactFilter: 'all'
  });

  const [data, setData] = useState({
    conn: [],
    msg: [],
    unread: {},
    stats: { total: 0, onChantilink: 0, other: 0 },
    pendingRequests: []
  });

  const [sel, setSel] = useState({ 
    friend: null,
    msgToForward: null
  });

  const [err, setErr] = useState(null);
  const isMounted = useRef(true);

  /**
   * ✅ CHARGEMENT AVEC CACHE
   */
  const load = useCallback(async () => {
    if (!token) return;

    setUi(prev => ({ ...prev, load: true }));
    setErr(null);

    try {
      // 1️⃣ Charger d'abord depuis le cache (UX instantanée)
      const [cachedConversations, cachedContacts] = await Promise.all([
        messageCache.getConversations().catch(() => []),
        messageCache.getContacts().catch(() => [])
      ]);

      if (isMounted.current && (cachedConversations.length > 0 || cachedContacts.length > 0)) {
        console.log('📦 [MessagesData] Chargement depuis cache');
        setData(prev => ({
          ...prev,
          conn: cachedConversations,
          stats: {
            total: cachedContacts.length,
            onChantilink: cachedContacts.filter(c => c.isOnChantilink).length,
            other: cachedContacts.filter(c => !c.isOnChantilink).length
          }
        }));
        setUi(prev => ({ ...prev, load: false }));
      }

      // 2️⃣ Puis synchroniser avec le serveur
      const [convRes, statsRes, pendingRes] = await Promise.all([
        API.getConversations(token).catch(e => {
          console.error("⚠️ Erreur Conversations:", e);
          return { conversations: [] };
        }),
        API.getContactsStats(token).catch(e => {
          console.error("⚠️ Erreur Stats:", e);
          return { totalContacts: 0, unreadMessages: 0, pendingRequests: 0 };
        }),
        API.getPendingMessageRequests(token).catch(e => {
          console.error("⚠️ Erreur Demandes:", e);
          return { requests: [] };
        })
      ]);

      if (!isMounted.current) return;

      const freshConversations = convRes.conversations || [];
      
      // 3️⃣ Mettre à jour le cache avec les nouvelles données
      if (freshConversations.length > 0) {
        await messageCache.saveConversations(freshConversations);
      }

      setData(prev => ({
        ...prev,
        conn: freshConversations,
        stats: {
          total: statsRes.totalContacts || 0,
          onChantilink: statsRes.totalContacts || 0,
          other: 0
        },
        pendingRequests: Array.isArray(pendingRes) ? pendingRes : (pendingRes.requests || [])
      }));

    } catch (globalError) {
      console.error("❌ [Critical Sync Error]:", globalError);
      
      if (typeof showToast === 'function') {
        showToast("Problème de synchronisation réseau", "error");
      }
      
      setErr(globalError.message);
    } finally {
      if (isMounted.current) setUi(prev => ({ ...prev, load: false }));
    }
  }, [token, showToast]);

  /**
   * ✅ CHARGER MESSAGES D'UNE CONVERSATION AVEC CACHE
   */
  const loadConversationMessages = useCallback(async (userId, friendId) => {
    if (!userId || !friendId) return [];

    try {
      // 1️⃣ Charger depuis le cache d'abord
      const cachedMessages = await messageCache.getMessages(userId, friendId);
      
      if (cachedMessages.length > 0) {
        console.log(`📦 [MessagesData] ${cachedMessages.length} messages depuis cache`);
        setData(prev => ({ ...prev, msg: cachedMessages }));
      }

      // 2️⃣ Puis synchroniser avec le serveur
      const freshMessages = await API.getMessages(token, friendId);
      
      if (freshMessages && freshMessages.length > 0) {
        await messageCache.saveMessages(userId, friendId, freshMessages);
        setData(prev => ({ ...prev, msg: freshMessages }));
      }

      return freshMessages || cachedMessages;
    } catch (error) {
      console.error('❌ [MessagesData] Erreur chargement messages:', error);
      return [];
    }
  }, [token]);

  /**
   * ✅ AJOUTER UN MESSAGE AU CACHE
   */
  const addMessageToCache = useCallback(async (userId, friendId, message) => {
    try {
      await messageCache.addMessage(userId, friendId, message);
      setData(prev => ({
        ...prev,
        msg: [...prev.msg, message].sort((a, b) => 
          new Date(a.timestamp) - new Date(b.timestamp)
        )
      }));
    } catch (error) {
      console.error('❌ [MessagesData] Erreur ajout message cache:', error);
    }
  }, []);

  /**
   * ✅ SÉCURITÉ DE TRANSITION
   */
  useEffect(() => {
    if (sel.friend?.id) {
      setData(prev => ({ ...prev, msg: [] }));
    }
  }, [sel.friend?.id]);

  /**
   * ✅ CYCLE DE VIE
   */
  useEffect(() => {
    isMounted.current = true;
    load();
    return () => { 
      isMounted.current = false; 
    };
  }, [load]);

  /**
   * ✅ NETTOYAGE AUTOMATIQUE (tous les jours)
   */
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      messageCache.cleanOldMessages(30).catch(console.error);
    }, 24 * 60 * 60 * 1000); // 1 jour

    return () => clearInterval(cleanupInterval);
  }, []);

  return {
    ui, setUi,
    data, setData,
    sel, setSel,
    err,
    load,
    loadConversationMessages,
    addMessageToCache
  };
}