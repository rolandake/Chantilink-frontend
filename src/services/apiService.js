// ============================================
// 📁 src/services/apiService.js
// SERVICE API COMPLET - VERSION OPTIMISÉE
// Compatible avec synchronisation native des contacts
// ============================================

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// ============================================
// 🔧 HELPER FUNCTIONS
// ============================================

/**
 * Wrapper pour les requêtes fetch avec gestion d'erreurs améliorée
 */
const fetchWithAuth = async (url, options = {}) => {
  try {
    console.log(`📡 [API Request] ${options.method || 'GET'} ${url}`);
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    console.log(`📡 [API Response] ${response.status} ${response.statusText}`);

    // ✅ Vérifier si la réponse est JSON
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      console.error(`❌ [API] Réponse non-JSON:`, text.substring(0, 200));
      throw new Error(`Erreur serveur (${response.status}): Réponse invalide`);
    }

    const data = await response.json();

    if (!response.ok) {
      console.error(`❌ [API] Erreur ${response.status}:`, data);
      throw new Error(data.message || `Erreur ${response.status}`);
    }

    console.log(`✅ [API] Succès:`, data.success !== false ? '✓' : '✗');
    return data;
  } catch (error) {
    console.error(`❌ [API Error] ${url}:`, {
      message: error.message,
      name: error.name
    });

    // Messages d'erreur plus clairs
    if (error.message === 'Failed to fetch') {
      throw new Error('Impossible de contacter le serveur. Vérifiez votre connexion.');
    }
    if (error.message.includes('NetworkError')) {
      throw new Error('Erreur réseau. Êtes-vous connecté à Internet ?');
    }
    if (error.message.includes('timeout')) {
      throw new Error('Délai d\'attente dépassé. Réessayez.');
    }

    throw error;
  }
};

// ============================================
// 📦 API SERVICE
// ============================================

export const API = {
  BASE_URL,

  // ============================================
  // 🔐 AUTHENTIFICATION
  // ============================================

  login: async (credentials) => {
    return fetchWithAuth(`${BASE_URL}/auth/login`, {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  },

  register: async (userData) => {
    return fetchWithAuth(`${BASE_URL}/auth/register`, {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  },

  logout: async (token) => {
    return fetchWithAuth(`${BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  verifyToken: async (token) => {
    return fetchWithAuth(`${BASE_URL}/auth/verify`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  refreshToken: async (refreshToken) => {
    return fetchWithAuth(`${BASE_URL}/auth/refresh-token`, {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
  },

  getCurrentUser: async (token) => {
    return fetchWithAuth(`${BASE_URL}/auth/me`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  updatePhone: async (token, phone) => {
    console.log(`📞 [API.updatePhone] Mise à jour: ${phone}`);
    return fetchWithAuth(`${BASE_URL}/auth/update-phone`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ phone }),
    });
  },

  // ============================================
  // 👤 UTILISATEURS
  // ============================================

  getUserProfile: async (token, userId) => {
    return fetchWithAuth(`${BASE_URL}/users/${userId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  updateProfile: async (token, profileData) => {
    return fetchWithAuth(`${BASE_URL}/users/profile`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(profileData),
    });
  },

  searchUsers: async (token, query) => {
    return fetchWithAuth(`${BASE_URL}/users/search?q=${encodeURIComponent(query)}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  getSuggestedUsers: async (token) => {
    return fetchWithAuth(`${BASE_URL}/users/suggestions`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  followUser: async (token, userId) => {
    return fetchWithAuth(`${BASE_URL}/users/${userId}/follow`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  unfollowUser: async (token, userId) => {
    return fetchWithAuth(`${BASE_URL}/users/${userId}/unfollow`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  // ============================================
  // 📞 CONTACTS & SYNCHRONISATION
  // ============================================

  /**
   * ✅ Vérifier la santé de l'endpoint contacts
   */
  checkContactsHealth: async (token) => {
    try {
      return await fetchWithAuth(`${BASE_URL}/contacts/health`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (error) {
      console.error('❌ [API.checkContactsHealth] Erreur:', error);
      return { status: 'error', message: error.message };
    }
  },

  /**
   * ✅ Synchroniser les contacts du téléphone avec le backend
   * Utilisé par nativeContactsService
   */
  syncContacts: async (token, contacts) => {
    console.log('═══════════════════════════════════════════════');
    console.log(`📤 [API.syncContacts] Début synchronisation`);
    console.log(`📊 Total contacts: ${contacts.length}`);
    console.log(`📋 Exemples:`, contacts.slice(0, 3));
    console.log('═══════════════════════════════════════════════');

    // ✅ Validation des données
    if (!Array.isArray(contacts)) {
      throw new Error('Le paramètre contacts doit être un tableau');
    }

    if (contacts.length === 0) {
      console.warn('⚠️ [API.syncContacts] Aucun contact à synchroniser');
      return {
        success: true,
        onChantilink: [],
        notOnChantilink: [],
        count: 0,
        stats: { total: 0, onApp: 0, offApp: 0 }
      };
    }

    // ✅ Normaliser les numéros de téléphone
    const normalizedContacts = contacts.map(contact => ({
      name: contact.name || 'Sans nom',
      phone: (contact.phone || contact.phoneNumber || '').replace(/\D/g, '') // Garder seulement les chiffres
    })).filter(c => c.phone.length >= 8); // Minimum 8 chiffres

    console.log(`📊 Contacts normalisés: ${normalizedContacts.length}/${contacts.length}`);

    try {
      const result = await fetchWithAuth(`${BASE_URL}/contacts/sync`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ contacts: normalizedContacts }),
      });

      console.log('═══════════════════════════════════════════════');
      console.log(`✅ [API.syncContacts] Synchronisation réussie`);
      console.log(`📊 Résultats:`, result.stats);
      console.log(`   ✓ Sur app: ${result.stats?.onApp || 0}`);
      console.log(`   ➖ Hors app: ${result.stats?.offApp || 0}`);
      console.log('═══════════════════════════════════════════════');

      return {
        success: true,
        onChantilink: result.onChantilink || [],
        notOnChantilink: result.notOnChantilink || [],
        stats: result.stats || { total: 0, onApp: 0, offApp: 0 }
      };
    } catch (error) {
      console.error('═══════════════════════════════════════════════');
      console.error('❌ [API.syncContacts] ÉCHEC');
      console.error('   Message:', error.message);
      console.error('═══════════════════════════════════════════════');
      throw error;
    }
  },

  /**
   * ✅ Récupérer la liste des contacts
   */
  getContacts: async (token) => {
    console.log('📋 [API.getContacts] Chargement des contacts...');
    
    try {
      const result = await fetchWithAuth(`${BASE_URL}/contacts`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });

      console.log(`✅ [API.getContacts] ${result.contacts?.length || 0} contacts récupérés`);

      return {
        success: true,
        contacts: result.contacts || []
      };
    } catch (error) {
      console.error('❌ [API.getContacts] Erreur:', error);
      return {
        success: false,
        contacts: [],
        message: error.message
      };
    }
  },

  /**
   * ✅ Inviter un contact (hors app)
   */
  inviteContact: async (token, contactData) => {
    console.log(`📲 [API.inviteContact] Invitation: ${contactData.contactName}`);
    
    const result = await fetchWithAuth(`${BASE_URL}/contacts/invite`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(contactData),
    });

    console.log(`✅ [API.inviteContact] Invitation créée`);
    return result;
  },

  /**
   * ✅ Ajouter un contact manuellement
   */
  addContact: async (token, contactData) => {
    console.log(`➕ [API.addContact] Ajout: ${contactData.fullName} (${contactData.phoneNumber})`);
    
    try {
      const result = await fetchWithAuth(`${BASE_URL}/contacts/add`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(contactData),
      });

      console.log(`✅ [API.addContact] Contact ajouté avec succès`);
      return result;
    } catch (error) {
      // ✅ Gestion des contacts hors app
      if (error.message.includes('404') || 
          error.message.includes('pas encore sur') ||
          error.message.includes('not found')) {
        console.log(`⚠️ [API.addContact] Contact hors app`);
        return {
          success: false,
          isOnChantilink: false,
          canInvite: true,
          contact: contactData
        };
      }
      throw error;
    }
  },

  /**
   * ✅ Récupérer les conversations
   */
  getConversations: async (token) => {
    try {
      const result = await fetchWithAuth(`${BASE_URL}/contacts/conversations`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });

      return {
        success: true,
        conversations: result.conversations || []
      };
    } catch (error) {
      console.error('❌ [API.getConversations] Erreur:', error);
      return {
        success: false,
        conversations: []
      };
    }
  },

  /**
   * ✅ Statistiques des contacts
   */
  getContactsStats: async (token) => {
    return fetchWithAuth(`${BASE_URL}/contacts/stats`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  /**
   * ✅ Supprimer un contact
   */
  deleteContact: async (token, contactId) => {
    return fetchWithAuth(`${BASE_URL}/contacts/${contactId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  // ============================================
  // 💬 MESSAGES
  // ============================================

  getMessages: async (token, userId) => {
    return fetchWithAuth(`${BASE_URL}/messages/${userId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  sendMessage: async (token, messageData) => {
    return fetchWithAuth(`${BASE_URL}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(messageData),
    });
  },

  uploadMessageFile: async (token, file) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${BASE_URL}/messages/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Erreur upload');
    }
    return data;
  },

  markMessagesAsRead: async (token, senderId) => {
    return fetchWithAuth(`${BASE_URL}/messages/read/${senderId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  deleteMessage: async (token, messageId) => {
    return fetchWithAuth(`${BASE_URL}/messages/${messageId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  deleteConversation: async (token, otherUserId) => {
    return fetchWithAuth(`${BASE_URL}/messages/conversation/${otherUserId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  getUnreadCount: async (token) => {
    return fetchWithAuth(`${BASE_URL}/messages/unread-count`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  getPendingMessageRequests: async (token) => {
    return fetchWithAuth(`${BASE_URL}/messages/pending-requests`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  acceptMessageRequest: async (token, requestId) => {
    return fetchWithAuth(`${BASE_URL}/messages/pending-requests/${requestId}/accept`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  rejectMessageRequest: async (token, requestId) => {
    return fetchWithAuth(`${BASE_URL}/messages/pending-requests/${requestId}/reject`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  // ============================================
  // 📱 POSTS
  // ============================================

  getFeed: async (token, page = 1) => {
    return fetchWithAuth(`${BASE_URL}/posts?page=${page}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  getUserPosts: async (token, userId) => {
    return fetchWithAuth(`${BASE_URL}/posts/user/${userId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  createPost: async (token, postData) => {
    return fetchWithAuth(`${BASE_URL}/posts`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(postData),
    });
  },

  updatePost: async (token, postId, postData) => {
    return fetchWithAuth(`${BASE_URL}/posts/${postId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(postData),
    });
  },

  deletePost: async (token, postId) => {
    return fetchWithAuth(`${BASE_URL}/posts/${postId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  likePost: async (token, postId) => {
    return fetchWithAuth(`${BASE_URL}/posts/${postId}/like`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  unlikePost: async (token, postId) => {
    return fetchWithAuth(`${BASE_URL}/posts/${postId}/unlike`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  // ============================================
  // 💬 COMMENTAIRES
  // ============================================

  getComments: async (token, postId) => {
    return fetchWithAuth(`${BASE_URL}/posts/${postId}/comments`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  addComment: async (token, postId, content) => {
    return fetchWithAuth(`${BASE_URL}/posts/${postId}/comments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ content }),
    });
  },

  deleteComment: async (token, postId, commentId) => {
    return fetchWithAuth(`${BASE_URL}/posts/${postId}/comments/${commentId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  // ============================================
  // 📖 STORIES
  // ============================================

  getStoriesFeed: async (token) => {
    return fetchWithAuth(`${BASE_URL}/story/feed`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  getUserStories: async (token, userId) => {
    return fetchWithAuth(`${BASE_URL}/story/user/${userId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  createStory: async (token, storyData) => {
    return fetchWithAuth(`${BASE_URL}/story`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(storyData),
    });
  },

  uploadStoryMedia: async (token, file) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${BASE_URL}/story/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Erreur upload story');
    }
    return data;
  },

  deleteStory: async (token, storyId) => {
    return fetchWithAuth(`${BASE_URL}/story/${storyId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  viewStory: async (token, storyId) => {
    return fetchWithAuth(`${BASE_URL}/story/${storyId}/view`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  reactToStory: async (token, storyId, emoji) => {
    return fetchWithAuth(`${BASE_URL}/story/${storyId}/react`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ emoji }),
    });
  },

  // ============================================
  // 🔔 NOTIFICATIONS
  // ============================================

  getNotifications: async (token) => {
    return fetchWithAuth(`${BASE_URL}/notifications`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  markNotificationAsRead: async (token, notificationId) => {
    return fetchWithAuth(`${BASE_URL}/notifications/${notificationId}/read`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  markAllNotificationsAsRead: async (token) => {
    return fetchWithAuth(`${BASE_URL}/notifications/read-all`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  deleteNotification: async (token, notificationId) => {
    return fetchWithAuth(`${BASE_URL}/notifications/${notificationId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  // ============================================
  // 📤 UPLOAD DE FICHIERS
  // ============================================

  uploadProfilePhoto: async (token, file) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${BASE_URL}/users/profile-photo`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Erreur upload photo');
    }
    return data;
  },

  uploadCoverPhoto: async (token, file) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${BASE_URL}/users/cover-photo`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Erreur upload cover');
    }
    return data;
  },

  // ============================================
  // 💎 PREMIUM
  // ============================================

  createCheckoutSession: async (token) => {
    return fetchWithAuth(`${BASE_URL}/payments/create-checkout-session`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  verifyPayment: async (token, sessionId) => {
    return fetchWithAuth(`${BASE_URL}/payments/verify-session`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ sessionId }),
    });
  },

  getPremiumStatus: async (token) => {
    return fetchWithAuth(`${BASE_URL}/payments/premium-status`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
  },
};

export default API;