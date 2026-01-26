// ============================================
// 📁 src/pages/Chat/hooks/useMessagesData.js
// VERSION AVEC CACHE IndexedDB + OPTIMISATION ANTI-SPAM
// ============================================
import { useState, useEffect, useCallback, useRef } from "react";
import { API } from "../../../services/apiService";
import messageCache from "../../../utils/messageCache";

// ✅ SINGLETON : Cache global partagé entre toutes les instances
let globalCache = {
  conversations: [],
  unread: {},
  contacts: [],
  lastUpdate: 0,
  isLoading: false,
  pendingRequests: []
};

// ✅ LISTE DES INSTANCES ACTIVES
const activeInstances = new Set();

// ✅ COOLDOWN GLOBAL : 5 secondes minimum entre 2 requêtes API
const GLOBAL_COOLDOWN = 5000;
let lastGlobalFetch = 0;

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
    conn: globalCache.conversations,
    msg: [],
    unread: globalCache.unread,
    stats: { total: 0, onChantilink: 0, other: 0 },
    pendingRequests: globalCache.pendingRequests,
    conversations: globalCache.conversations // ✅ Compatibilité App.jsx
  });

  const [sel, setSel] = useState({ 
    friend: null,
    msgToForward: null
  });

  const [err, setErr] = useState(null);
  const isMounted = useRef(true);
  const instanceId = useRef(`instance-${Date.now()}-${Math.random()}`);

  /**
   * ✅ CHARGEMENT OPTIMISÉ AVEC COOLDOWN GLOBAL
   */
  const load = useCallback(async () => {
    if (!token) return;

    const now = Date.now();
    
    // ✅ ANTI-SPAM : Vérifier le cooldown global
    if (now - lastGlobalFetch < GLOBAL_COOLDOWN) {
      console.log(`⏰ [useMessagesData] Cooldown actif (${instanceId.current})`);
      
      // Utiliser le cache global existant
      if (isMounted.current) {
        setData(prev => ({
          ...prev,
          conn: globalCache.conversations,
          conversations: globalCache.conversations,
          unread: globalCache.unread,
          pendingRequests: globalCache.pendingRequests
        }));
        setUi(prev => ({ ...prev, load: false }));
      }
      return;
    }

    // ✅ SI UNE AUTRE INSTANCE EST DÉJÀ EN TRAIN DE CHARGER, ATTENDRE
    if (globalCache.isLoading) {
      console.log(`⏳ [useMessagesData] Attente chargement en cours (${instanceId.current})`);
      
      // Attendre max 3 secondes que l'autre instance finisse
      const timeout = setTimeout(() => {
        if (isMounted.current) {
          setData(prev => ({
            ...prev,
            conn: globalCache.conversations,
            conversations: globalCache.conversations,
            unread: globalCache.unread
          }));
          setUi(prev => ({ ...prev, load: false }));
        }
      }, 3000);

      return () => clearTimeout(timeout);
    }

    setUi(prev => ({ ...prev, load: true }));
    setErr(null);
    globalCache.isLoading = true;
    lastGlobalFetch = now;

    console.log(`🔄 [useMessagesData] Début chargement (${instanceId.current})`);

    try {
      // 1️⃣ Charger d'abord depuis le cache (UX instantanée)
      const [cachedConversations, cachedContacts] = await Promise.all([
        messageCache.getConversations().catch(() => []),
        messageCache.getContacts().catch(() => [])
      ]);

      if (isMounted.current && (cachedConversations.length > 0 || cachedContacts.length > 0)) {
        console.log(`📦 [useMessagesData] Cache: ${cachedConversations.length} conv (${instanceId.current})`);
        
        // Calculer les messages non lus
        const unreadCounts = {};
        cachedConversations.forEach(conv => {
          if (conv.unreadCount > 0) {
            unreadCounts[conv.id] = conv.unreadCount;
          }
        });

        // Mettre à jour le cache global
        globalCache.conversations = cachedConversations;
        globalCache.unread = unreadCounts;
        globalCache.lastUpdate = Date.now();
        
        setData(prev => ({
          ...prev,
          conn: cachedConversations,
          conversations: cachedConversations,
          unread: unreadCounts,
          stats: {
            total: cachedContacts.length,
            onChantilink: cachedContacts.filter(c => c.isOnChantilink).length,
            other: cachedContacts.filter(c => !c.isOnChantilink).length
          }
        }));
        setUi(prev => ({ ...prev, load: false }));
      }

      // 2️⃣ Puis synchroniser avec le serveur (UNE SEULE FOIS)
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

      // Calculer les messages non lus
      const unreadCounts = {};
      freshConversations.forEach(conv => {
        if (conv.unreadCount > 0) {
          unreadCounts[conv.id] = conv.unreadCount;
        }
      });

      // ✅ MISE À JOUR DU CACHE GLOBAL (partagé par toutes les instances)
      globalCache.conversations = freshConversations;
      globalCache.unread = unreadCounts;
      globalCache.pendingRequests = Array.isArray(pendingRes) ? pendingRes : (pendingRes.requests || []);
      globalCache.lastUpdate = Date.now();

      // ✅ PROPAGER AUX AUTRES INSTANCES ACTIVES
      activeInstances.forEach(updateFn => {
        if (typeof updateFn === 'function') {
          updateFn({
            conn: freshConversations,
            conversations: freshConversations,
            unread: unreadCounts,
            pendingRequests: globalCache.pendingRequests
          });
        }
      });

      setData(prev => ({
        ...prev,
        conn: freshConversations,
        conversations: freshConversations,
        unread: unreadCounts,
        stats: {
          total: statsRes.totalContacts || 0,
          onChantilink: statsRes.totalContacts || 0,
          other: 0
        },
        pendingRequests: globalCache.pendingRequests
      }));

      console.log(`✅ [useMessagesData] Sync OK: ${freshConversations.length} conv (${instanceId.current})`);

    } catch (globalError) {
      console.error("❌ [Critical Sync Error]:", globalError);
      
      if (typeof showToast === 'function') {
        showToast("Problème de synchronisation réseau", "error");
      }
      
      setErr(globalError.message);
    } finally {
      if (isMounted.current) {
        setUi(prev => ({ ...prev, load: false }));
      }
      globalCache.isLoading = false;
    }
  }, [token, showToast]);

  /**
   * ✅ CHARGER MESSAGES D'UNE CONVERSATION AVEC CACHE
   */
  const loadConversationMessages = useCallback(async (userId, friendId) => {
    if (!userId || !friendId) return [];

    try {
      const cachedMessages = await messageCache.getMessages(userId, friendId);
      
      if (cachedMessages.length > 0) {
        console.log(`📦 [MessagesData] ${cachedMessages.length} messages depuis cache`);
        setData(prev => ({ ...prev, msg: cachedMessages }));
      }

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
   * ✅ NOUVEAU : Mettre à jour le compteur de messages non lus
   */
  const updateUnreadCount = useCallback((friendId, delta = 1) => {
    setData(prev => ({
      ...prev,
      unread: {
        ...prev.unread,
        [friendId]: Math.max(0, (prev.unread[friendId] || 0) + delta)
      }
    }));
    
    // Mettre à jour le cache global
    globalCache.unread[friendId] = Math.max(0, (globalCache.unread[friendId] || 0) + delta);
  }, []);

  /**
   * ✅ NOUVEAU : Marquer une conversation comme lue
   */
  const markAsRead = useCallback((friendId) => {
    setData(prev => {
      const newUnread = { ...prev.unread };
      delete newUnread[friendId];
      return { ...prev, unread: newUnread };
    });
    
    // Mettre à jour le cache global
    delete globalCache.unread[friendId];
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
   * ✅ ENREGISTREMENT DE L'INSTANCE
   */
  useEffect(() => {
    const updateFunction = (newData) => {
      if (isMounted.current) {
        setData(prev => ({ ...prev, ...newData }));
      }
    };
    
    activeInstances.add(updateFunction);
    console.log(`📌 [useMessagesData] Instance enregistrée: ${instanceId.current} (total: ${activeInstances.size})`);

    return () => {
      activeInstances.delete(updateFunction);
      console.log(`🗑️ [useMessagesData] Instance supprimée: ${instanceId.current} (restant: ${activeInstances.size})`);
    };
  }, []);

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
    }, 24 * 60 * 60 * 1000);

    return () => clearInterval(cleanupInterval);
  }, []);

  /**
   * ✅ SYNCHRONISATION PÉRIODIQUE (30 secondes)
   * MAIS UNIQUEMENT SI ON EST LA PREMIÈRE INSTANCE
   */
  useEffect(() => {
    if (!token) return;

    const interval = setInterval(() => {
      // Ne refresh que si visible ET si on est la première instance
      if (document.visibilityState === 'visible' && 
          Array.from(activeInstances)[0] === activeInstances.values().next().value) {
        load();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [token, load]);

  return {
    ui, setUi,
    data, setData,
    sel, setSel,
    err,
    load,
    loadConversationMessages,
    addMessageToCache,
    updateUnreadCount,
    markAsRead
  };
}