// ============================================
// 📁 src/services/apiService.js
// SERVICE API COMPLET - Toutes les méthodes
// ============================================

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// ============================================
// 🔧 HELPER FUNCTIONS
// ============================================

/**
 * Wrapper pour les requêtes fetch avec gestion d'erreurs
 */
const fetchWithAuth = async (url, options = {}) => {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || `Erreur ${response.status}`);
    }

    return data;
  } catch (error) {
    console.error(`[API Error] ${url}:`, error);
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
   * Synchroniser les contacts du téléphone
   * @param {string} token - Token d'authentification
   * @param {Array} contacts - Liste de { name, phone }
   * @returns {Promise<Object>} { success, onChantilink[], notOnChantilink[], stats }
   */
  syncContacts: async (token, contacts) => {
    console.log(`📤 [API] Synchro ${contacts.length} contacts...`);
    
    const result = await fetchWithAuth(`${BASE_URL}/contacts/sync`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ contacts }),
    });

    console.log(`✅ [API] Synchro OK:`, result.stats);
    return result;
  },

  /**
   * Inviter un contact qui n'est pas sur l'app
   * @param {string} token - Token d'authentification
   * @param {Object} contactData - { contactName, contactPhone }
   * @returns {Promise<Object>} { success, inviteUrl }
   */
  inviteContact: async (token, contactData) => {
    console.log(`📲 [API] Invitation:`, contactData.contactName);
    
    const result = await fetchWithAuth(`${BASE_URL}/contacts/invite`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(contactData),
    });

    console.log(`✅ [API] Invitation créée`);
    return result;
  },

  /**
   * Ajouter manuellement un contact par numéro
   * @param {string} token - Token d'authentification
   * @param {Object} contactData - { fullName, phoneNumber }
   * @returns {Promise<Object>} { success, contact, canInvite? }
   */
  addContact: async (token, contactData) => {
    console.log(`➕ [API] Ajout contact:`, contactData.fullName);
    
    try {
      const result = await fetchWithAuth(`${BASE_URL}/contacts/add`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(contactData),
      });

      console.log(`✅ [API] Contact ajouté`);
      return result;
    } catch (error) {
      // Si 404, retourner les infos pour invitation
      if (error.message.includes('404') || error.message.includes('pas encore sur')) {
        console.log(`⚠️ [API] Contact hors app`);
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
   * Obtenir les conversations actives
   * @param {string} token - Token d'authentification
   * @returns {Promise<Object>} { conversations: [] }
   */
  getConversations: async (token) => {
    return fetchWithAuth(`${BASE_URL}/contacts/conversations`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  /**
   * Obtenir les statistiques de contacts
   * @param {string} token - Token d'authentification
   * @returns {Promise<Object>} { totalContacts, unreadMessages, pendingRequests }
   */
  getContactsStats: async (token) => {
    return fetchWithAuth(`${BASE_URL}/contacts/stats`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  /**
   * Supprimer un contact
   * @param {string} token - Token d'authentification
   * @param {string} contactId - ID du contact
   * @returns {Promise<Object>} { success, message }
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

  // Demandes de messages
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