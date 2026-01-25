// ============================================
// 📁 src/utils/messageCache.js
// Service de cache IndexedDB pour les messages
// ============================================

const DB_NAME = 'ChantilinkMessagesDB';
const DB_VERSION = 1;
const MESSAGES_STORE = 'messages';
const CONVERSATIONS_STORE = 'conversations';
const CONTACTS_STORE = 'contacts';

class MessageCacheService {
  constructor() {
    this.db = null;
    this.initPromise = this.init();
  }

  /**
   * Initialiser la base de données IndexedDB
   */
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('❌ [MessageCache] Erreur ouverture IndexedDB');
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('✅ [MessageCache] IndexedDB initialisée');
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Store pour les messages
        if (!db.objectStoreNames.contains(MESSAGES_STORE)) {
          const messagesStore = db.createObjectStore(MESSAGES_STORE, { 
            keyPath: '_id' 
          });
          messagesStore.createIndex('conversationId', 'conversationId', { unique: false });
          messagesStore.createIndex('timestamp', 'timestamp', { unique: false });
          messagesStore.createIndex('sender', 'sender', { unique: false });
          messagesStore.createIndex('recipient', 'recipient', { unique: false });
        }

        // Store pour les conversations
        if (!db.objectStoreNames.contains(CONVERSATIONS_STORE)) {
          const conversationsStore = db.createObjectStore(CONVERSATIONS_STORE, { 
            keyPath: 'id' 
          });
          conversationsStore.createIndex('lastMessageTime', 'lastMessageTime', { unique: false });
        }

        // Store pour les contacts
        if (!db.objectStoreNames.contains(CONTACTS_STORE)) {
          db.createObjectStore(CONTACTS_STORE, { keyPath: 'id' });
        }

        console.log('🔧 [MessageCache] Stores créés');
      };
    });
  }

  /**
   * Générer un ID de conversation unique (ordre alphabétique des IDs)
   */
  getConversationId(userId1, userId2) {
    return [userId1, userId2].sort().join('_');
  }

  // ============================================
  // 📨 GESTION DES MESSAGES
  // ============================================

  /**
   * Sauvegarder les messages d'une conversation
   */
  async saveMessages(userId, friendId, messages) {
    await this.initPromise;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([MESSAGES_STORE], 'readwrite');
      const store = transaction.objectStore(MESSAGES_STORE);
      
      const conversationId = this.getConversationId(userId, friendId);
      
      messages.forEach(msg => {
        const messageToStore = {
          ...msg,
          conversationId,
          cachedAt: Date.now()
        };
        store.put(messageToStore);
      });

      transaction.oncomplete = () => {
        console.log(`✅ [MessageCache] ${messages.length} messages sauvegardés pour conversation ${conversationId}`);
        resolve(true);
      };

      transaction.onerror = () => {
        console.error('❌ [MessageCache] Erreur sauvegarde messages');
        reject(transaction.error);
      };
    });
  }

  /**
   * Récupérer les messages d'une conversation
   */
  async getMessages(userId, friendId) {
    await this.initPromise;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([MESSAGES_STORE], 'readonly');
      const store = transaction.objectStore(MESSAGES_STORE);
      const index = store.index('conversationId');
      
      const conversationId = this.getConversationId(userId, friendId);
      const request = index.getAll(conversationId);

      request.onsuccess = () => {
        const messages = request.result.sort((a, b) => 
          new Date(a.timestamp) - new Date(b.timestamp)
        );
        console.log(`📥 [MessageCache] ${messages.length} messages récupérés pour ${conversationId}`);
        resolve(messages);
      };

      request.onerror = () => {
        console.error('❌ [MessageCache] Erreur récupération messages');
        reject(request.error);
      };
    });
  }

  /**
   * Ajouter un message unique
   */
  async addMessage(userId, friendId, message) {
    await this.initPromise;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([MESSAGES_STORE], 'readwrite');
      const store = transaction.objectStore(MESSAGES_STORE);
      
      const conversationId = this.getConversationId(userId, friendId);
      const messageToStore = {
        ...message,
        conversationId,
        cachedAt: Date.now()
      };

      const request = store.put(messageToStore);

      request.onsuccess = () => {
        console.log(`✅ [MessageCache] Message ${message._id} ajouté`);
        resolve(messageToStore);
      };

      request.onerror = () => {
        console.error('❌ [MessageCache] Erreur ajout message');
        reject(request.error);
      };
    });
  }

  /**
   * Supprimer un message
   */
  async deleteMessage(messageId) {
    await this.initPromise;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([MESSAGES_STORE], 'readwrite');
      const store = transaction.objectStore(MESSAGES_STORE);
      
      const request = store.delete(messageId);

      request.onsuccess = () => {
        console.log(`🗑️ [MessageCache] Message ${messageId} supprimé`);
        resolve(true);
      };

      request.onerror = () => {
        console.error('❌ [MessageCache] Erreur suppression message');
        reject(request.error);
      };
    });
  }

  /**
   * Effacer tous les messages d'une conversation
   */
  async clearConversation(userId, friendId) {
    await this.initPromise;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([MESSAGES_STORE], 'readwrite');
      const store = transaction.objectStore(MESSAGES_STORE);
      const index = store.index('conversationId');
      
      const conversationId = this.getConversationId(userId, friendId);
      const request = index.openCursor(conversationId);

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          console.log(`🗑️ [MessageCache] Conversation ${conversationId} effacée`);
          resolve(true);
        }
      };

      request.onerror = () => {
        console.error('❌ [MessageCache] Erreur effacement conversation');
        reject(request.error);
      };
    });
  }

  // ============================================
  // 💬 GESTION DES CONVERSATIONS
  // ============================================

  /**
   * Sauvegarder les conversations
   */
  async saveConversations(conversations) {
    await this.initPromise;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([CONVERSATIONS_STORE], 'readwrite');
      const store = transaction.objectStore(CONVERSATIONS_STORE);
      
      conversations.forEach(conv => {
        const convToStore = {
          ...conv,
          cachedAt: Date.now()
        };
        store.put(convToStore);
      });

      transaction.oncomplete = () => {
        console.log(`✅ [MessageCache] ${conversations.length} conversations sauvegardées`);
        resolve(true);
      };

      transaction.onerror = () => {
        console.error('❌ [MessageCache] Erreur sauvegarde conversations');
        reject(transaction.error);
      };
    });
  }

  /**
   * Récupérer toutes les conversations
   */
  async getConversations() {
    await this.initPromise;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([CONVERSATIONS_STORE], 'readonly');
      const store = transaction.objectStore(CONVERSATIONS_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        const conversations = request.result.sort((a, b) => 
          new Date(b.lastMessageTime) - new Date(a.lastMessageTime)
        );
        console.log(`📥 [MessageCache] ${conversations.length} conversations récupérées`);
        resolve(conversations);
      };

      request.onerror = () => {
        console.error('❌ [MessageCache] Erreur récupération conversations');
        reject(request.error);
      };
    });
  }

  // ============================================
  // 👥 GESTION DES CONTACTS
  // ============================================

  /**
   * Sauvegarder les contacts
   */
  async saveContacts(contacts) {
    await this.initPromise;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([CONTACTS_STORE], 'readwrite');
      const store = transaction.objectStore(CONTACTS_STORE);
      
      contacts.forEach(contact => {
        const contactToStore = {
          ...contact,
          cachedAt: Date.now()
        };
        store.put(contactToStore);
      });

      transaction.oncomplete = () => {
        console.log(`✅ [MessageCache] ${contacts.length} contacts sauvegardés`);
        resolve(true);
      };

      transaction.onerror = () => {
        console.error('❌ [MessageCache] Erreur sauvegarde contacts');
        reject(transaction.error);
      };
    });
  }

  /**
   * Récupérer tous les contacts
   */
  async getContacts() {
    await this.initPromise;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([CONTACTS_STORE], 'readonly');
      const store = transaction.objectStore(CONTACTS_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        console.log(`📥 [MessageCache] ${request.result.length} contacts récupérés`);
        resolve(request.result);
      };

      request.onerror = () => {
        console.error('❌ [MessageCache] Erreur récupération contacts');
        reject(request.error);
      };
    });
  }

  // ============================================
  // 🧹 NETTOYAGE
  // ============================================

  /**
   * Nettoyer les anciens messages (plus de 30 jours)
   */
  async cleanOldMessages(daysToKeep = 30) {
    await this.initPromise;
    
    const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([MESSAGES_STORE], 'readwrite');
      const store = transaction.objectStore(MESSAGES_STORE);
      const request = store.openCursor();

      let deletedCount = 0;

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          if (cursor.value.cachedAt < cutoffTime) {
            cursor.delete();
            deletedCount++;
          }
          cursor.continue();
        } else {
          console.log(`🧹 [MessageCache] ${deletedCount} anciens messages supprimés`);
          resolve(deletedCount);
        }
      };

      request.onerror = () => {
        console.error('❌ [MessageCache] Erreur nettoyage');
        reject(request.error);
      };
    });
  }

  /**
   * Effacer tout le cache
   */
  async clearAll() {
    await this.initPromise;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(
        [MESSAGES_STORE, CONVERSATIONS_STORE, CONTACTS_STORE], 
        'readwrite'
      );

      transaction.objectStore(MESSAGES_STORE).clear();
      transaction.objectStore(CONVERSATIONS_STORE).clear();
      transaction.objectStore(CONTACTS_STORE).clear();

      transaction.oncomplete = () => {
        console.log('🗑️ [MessageCache] Tout le cache effacé');
        resolve(true);
      };

      transaction.onerror = () => {
        console.error('❌ [MessageCache] Erreur effacement total');
        reject(transaction.error);
      };
    });
  }
}

// Export d'une instance unique
export const messageCache = new MessageCacheService();
export default messageCache;