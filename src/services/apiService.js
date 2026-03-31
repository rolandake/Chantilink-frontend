// ============================================
// 📁 src/services/apiService.js
// SERVICE API COMPLET — VERSION CORRIGÉE & OPTIMISÉE
// ✅ FIX 1 : syncContacts — numéros NON strippés (le + est préservé)
// ✅ FIX 2 : addContact — détection 404 via err.status (fiable)
// ✅ FIX 3 : uploads avec timeout AbortController (30 s)
// ✅ FIX 4 : BASE_URL aligné avec AuthContext (logique isProd)
// ✅ FIX 5 : err.status attaché dans fetchWithAuth
// ============================================

// ============================================
// 🔥 BASE_URL — aligné sur AuthContext.jsx
// En prod : VITE_API_URL_PROD ou fallback Render
// En dev  : VITE_API_URL_LOCAL | VITE_API_URL | localhost
// ============================================
const isProd = import.meta.env.PROD;

const BASE_URL = isProd
  ? (import.meta.env.VITE_API_URL_PROD  || "https://chantilink-backend.onrender.com/api")
  : (import.meta.env.VITE_API_URL_LOCAL || import.meta.env.VITE_API_URL || "http://localhost:5000/api");

console.log(`🔧 [apiService] ${isProd ? "PRODUCTION" : "DÉVELOPPEMENT"} — ${BASE_URL}`);

// ============================================
// 🔧 HELPER — fetchWithAuth
// ✅ FIX 5 : err.status attaché pour checks fiables (ex: addContact 404)
// ============================================
const fetchWithAuth = async (url, options = {}) => {
  try {
    console.log(`📡 [API] ${options.method || "GET"} ${url}`);

    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    console.log(`📡 [API] ← ${response.status} ${response.statusText}`);

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const text = await response.text();
      console.error(`❌ [API] Réponse non-JSON:`, text.substring(0, 200));
      throw new Error(`Erreur serveur (${response.status}): Réponse invalide`);
    }

    const data = await response.json();

    if (!response.ok) {
      console.error(`❌ [API] Erreur ${response.status}:`, data);
      const err   = new Error(data.message || `Erreur ${response.status}`);
      err.status  = response.status;  // ✅ FIX 5
      err.payload = data;
      throw err;
    }

    return data;
  } catch (error) {
    console.error(`❌ [API Error] ${url}:`, error.message);
    if (error.message === "Failed to fetch")
      throw new Error("Impossible de contacter le serveur. Vérifiez votre connexion.");
    if (error.message.includes("NetworkError"))
      throw new Error("Erreur réseau. Êtes-vous connecté à Internet ?");
    if (error.message.includes("timeout") || error.name === "AbortError")
      throw new Error("Délai d'attente dépassé. Réessayez.");
    throw error;
  }
};

// ============================================
// 🔧 HELPER — uploadWithTimeout
// ✅ FIX 3 : Upload multipart avec AbortController (30 s)
// Évite les blocages sur connexions mobiles instables
// ============================================
const uploadWithTimeout = async (url, token, file, fieldName = "file", timeoutMs = 30_000) => {
  const formData   = new FormData();
  formData.append(fieldName, file);

  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method:  "POST",
      headers: { Authorization: `Bearer ${token}` },
      body:    formData,
      signal:  controller.signal,
    });
    clearTimeout(timer);
    const data = await response.json();
    if (!response.ok) {
      const err  = new Error(data.message || "Erreur upload");
      err.status = response.status;
      throw err;
    }
    return data;
  } catch (err) {
    clearTimeout(timer);
    if (err.name === "AbortError")
      throw new Error("Upload trop long — réessayez sur une meilleure connexion.");
    throw err;
  }
};

// ============================================
// 📦 API SERVICE
// ============================================
export const API = {
  BASE_URL,

  // ==========================================
  // 🔐 AUTHENTIFICATION
  // ==========================================

  login: async (credentials) =>
    fetchWithAuth(`${BASE_URL}/auth/login`, {
      method: "POST",
      body:   JSON.stringify(credentials),
    }),

  register: async (userData) =>
    fetchWithAuth(`${BASE_URL}/auth/register`, {
      method: "POST",
      body:   JSON.stringify(userData),
    }),

  logout: async (token) =>
    fetchWithAuth(`${BASE_URL}/auth/logout`, {
      method:  "POST",
      headers: { Authorization: `Bearer ${token}` },
    }),

  verifyToken: async (token) =>
    fetchWithAuth(`${BASE_URL}/auth/verify`, {
      method:  "GET",
      headers: { Authorization: `Bearer ${token}` },
    }),

  refreshToken: async (refreshToken) =>
    fetchWithAuth(`${BASE_URL}/auth/refresh-token`, {
      method: "POST",
      body:   JSON.stringify({ refreshToken }),
    }),

  getCurrentUser: async (token) =>
    fetchWithAuth(`${BASE_URL}/auth/me`, {
      method:  "GET",
      headers: { Authorization: `Bearer ${token}` },
    }),

  /**
   * ✅ Mettre à jour le numéro de téléphone
   * Utilisé par l'onboarding dans Messages.jsx (OnboardingPhoneScreen)
   */
  updatePhone: async (token, phone) => {
    console.log(`📞 [API.updatePhone] Mise à jour: ${phone}`);
    return fetchWithAuth(`${BASE_URL}/auth/update-phone`, {
      method:  "PUT",
      headers: { Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ phone }),
    });
  },

  // ==========================================
  // 👤 UTILISATEURS
  // ==========================================

  getUserProfile: async (token, userId) =>
    fetchWithAuth(`${BASE_URL}/users/${userId}`, {
      method:  "GET",
      headers: { Authorization: `Bearer ${token}` },
    }),

  updateProfile: async (token, profileData) =>
    fetchWithAuth(`${BASE_URL}/users/profile`, {
      method:  "PATCH",
      headers: { Authorization: `Bearer ${token}` },
      body:    JSON.stringify(profileData),
    }),

  searchUsers: async (token, query) =>
    fetchWithAuth(`${BASE_URL}/users/search?q=${encodeURIComponent(query)}`, {
      method:  "GET",
      headers: { Authorization: `Bearer ${token}` },
    }),

  getSuggestedUsers: async (token) =>
    fetchWithAuth(`${BASE_URL}/users/suggestions`, {
      method:  "GET",
      headers: { Authorization: `Bearer ${token}` },
    }),

  followUser: async (token, userId) =>
    fetchWithAuth(`${BASE_URL}/users/${userId}/follow`, {
      method:  "POST",
      headers: { Authorization: `Bearer ${token}` },
    }),

  unfollowUser: async (token, userId) =>
    fetchWithAuth(`${BASE_URL}/users/${userId}/unfollow`, {
      method:  "POST",
      headers: { Authorization: `Bearer ${token}` },
    }),

  // ==========================================
  // 📞 CONTACTS & SYNCHRONISATION
  // ==========================================

  checkContactsHealth: async (token) => {
    try {
      return await fetchWithAuth(`${BASE_URL}/contacts/health`, {
        method:  "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (error) {
      console.error("❌ [API.checkContactsHealth]:", error);
      return { status: "error", message: error.message };
    }
  },

  /**
   * ✅ FIX 1 — Synchroniser les contacts natifs avec le backend
   *
   * AVANT (❌) : replace(/\D/g,'') supprimait le "+"
   *   → backend reçoit "22507123456" → normalizePhone préfixe +225
   *   → "+22522507123456" (numéro doublé !) ❌
   *
   * APRÈS (✅) : numéro transmis tel quel, normalisation au backend
   *   normalizePhone du backend gère : espaces, tirets, "00→+", etc.
   */
  syncContacts: async (token, contacts) => {
    console.log("═══════════════════════════════════════════════");
    console.log(`📤 [API.syncContacts] Début — ${contacts.length} contacts`);
    console.log(`📋 Exemples:`, contacts.slice(0, 3));
    console.log("═══════════════════════════════════════════════");

    if (!Array.isArray(contacts))
      throw new Error("Le paramètre contacts doit être un tableau");

    if (contacts.length === 0) {
      return {
        success: true, onChantilink: [], notOnChantilink: [], count: 0,
        stats: { total: 0, onApp: 0, offApp: 0 },
      };
    }

    // ✅ Normalisation légère côté client : format préservé, filtrage minimal
    const normalizedContacts = contacts
      .map((c) => ({
        name:  (c.name || "Sans nom").trim(),
        phone: (c.phone || c.phoneNumber || "").trim(), // ✅ PAS de replace(/\D/g,'')
      }))
      .filter((c) => c.phone.replace(/\D/g, "").length >= 8);

    console.log(`📊 Contacts valides: ${normalizedContacts.length}/${contacts.length}`);

    try {
      const result = await fetchWithAuth(`${BASE_URL}/contacts/sync`, {
        method:  "POST",
        headers: { Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ contacts: normalizedContacts }),
      });

      console.log("✅ [API.syncContacts] Succès:", result.stats);
      return {
        success:         true,
        onChantilink:    result.onChantilink    || [],
        notOnChantilink: result.notOnChantilink || [],
        stats:           result.stats           || { total: 0, onApp: 0, offApp: 0 },
      };
    } catch (error) {
      console.error("❌ [API.syncContacts] ÉCHEC:", error.message);
      throw error;
    }
  },

  getContacts: async (token) => {
    try {
      const result = await fetchWithAuth(`${BASE_URL}/contacts`, {
        method:  "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log(`✅ [API.getContacts] ${result.contacts?.length || 0} contacts`);
      return { success: true, contacts: result.contacts || [] };
    } catch (error) {
      console.error("❌ [API.getContacts]:", error);
      return { success: false, contacts: [], message: error.message };
    }
  },

  /**
   * ✅ FIX 2 — Ajouter un contact manuellement
   * Détection hors-app via err.status === 404 (fiable) au lieu de includes('404')
   */
  addContact: async (token, contactData) => {
    console.log(`➕ [API.addContact] ${contactData.fullName} (${contactData.phone || contactData.phoneNumber})`);
    try {
      const result = await fetchWithAuth(`${BASE_URL}/contacts/add`, {
        method:  "POST",
        headers: { Authorization: `Bearer ${token}` },
        body:    JSON.stringify(contactData),
      });
      console.log(`✅ [API.addContact] Contact ajouté`);
      return result;
    } catch (error) {
      const isOffApp =
        error.status === 404 ||
        error.message.includes("pas encore sur") ||
        error.message.toLowerCase().includes("introuvable") ||
        error.message.toLowerCase().includes("not found");

      if (isOffApp) {
        console.log(`⚠️ [API.addContact] Contact hors app`);
        return { success: false, isOnChantilink: false, canInvite: true, contact: contactData };
      }
      throw error;
    }
  },

  inviteContact: async (token, contactData) => {
    console.log(`📲 [API.inviteContact] ${contactData.contactName}`);
    return fetchWithAuth(`${BASE_URL}/contacts/invite`, {
      method:  "POST",
      headers: { Authorization: `Bearer ${token}` },
      body:    JSON.stringify(contactData),
    });
  },

  getConversations: async (token) => {
    try {
      const result = await fetchWithAuth(`${BASE_URL}/contacts/conversations`, {
        method:  "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
      return { success: true, conversations: result.conversations || [] };
    } catch (error) {
      console.error("❌ [API.getConversations]:", error);
      return { success: false, conversations: [] };
    }
  },

  getContactsStats: async (token) =>
    fetchWithAuth(`${BASE_URL}/contacts/stats`, {
      method:  "GET",
      headers: { Authorization: `Bearer ${token}` },
    }),

  deleteContact: async (token, contactId) =>
    fetchWithAuth(`${BASE_URL}/contacts/${contactId}`, {
      method:  "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }),

  // ==========================================
  // 💬 MESSAGES
  // ==========================================

  getMessages: async (token, userId) =>
    fetchWithAuth(`${BASE_URL}/messages/${userId}`, {
      method:  "GET",
      headers: { Authorization: `Bearer ${token}` },
    }),

  sendMessage: async (token, messageData) =>
    fetchWithAuth(`${BASE_URL}/messages`, {
      method:  "POST",
      headers: { Authorization: `Bearer ${token}` },
      body:    JSON.stringify(messageData),
    }),

  // ✅ FIX 3 — timeout 30 s
  uploadMessageFile: async (token, file) => {
    console.log(`📤 [API.uploadMessageFile] ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
    return uploadWithTimeout(`${BASE_URL}/messages/upload`, token, file, "file", 30_000);
  },

  markMessagesAsRead: async (token, senderId) =>
    fetchWithAuth(`${BASE_URL}/messages/read/${senderId}`, {
      method:  "PUT",
      headers: { Authorization: `Bearer ${token}` },
    }),

  deleteMessage: async (token, messageId) =>
    fetchWithAuth(`${BASE_URL}/messages/${messageId}`, {
      method:  "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }),

  deleteConversation: async (token, otherUserId) =>
    fetchWithAuth(`${BASE_URL}/messages/conversation/${otherUserId}`, {
      method:  "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }),

  getUnreadCount: async (token) =>
    fetchWithAuth(`${BASE_URL}/messages/unread-count`, {
      method:  "GET",
      headers: { Authorization: `Bearer ${token}` },
    }),

  getPendingMessageRequests: async (token) =>
    fetchWithAuth(`${BASE_URL}/messages/pending-requests`, {
      method:  "GET",
      headers: { Authorization: `Bearer ${token}` },
    }),

  acceptMessageRequest: async (token, requestId) =>
    fetchWithAuth(`${BASE_URL}/messages/pending-requests/${requestId}/accept`, {
      method:  "POST",
      headers: { Authorization: `Bearer ${token}` },
    }),

  rejectMessageRequest: async (token, requestId) =>
    fetchWithAuth(`${BASE_URL}/messages/pending-requests/${requestId}/reject`, {
      method:  "POST",
      headers: { Authorization: `Bearer ${token}` },
    }),

  // ==========================================
  // 📱 POSTS
  // ==========================================

  getFeed: async (token, page = 1) =>
    fetchWithAuth(`${BASE_URL}/posts?page=${page}`, {
      method:  "GET",
      headers: { Authorization: `Bearer ${token}` },
    }),

  getUserPosts: async (token, userId) =>
    fetchWithAuth(`${BASE_URL}/posts/user/${userId}`, {
      method:  "GET",
      headers: { Authorization: `Bearer ${token}` },
    }),

  createPost: async (token, postData) =>
    fetchWithAuth(`${BASE_URL}/posts`, {
      method:  "POST",
      headers: { Authorization: `Bearer ${token}` },
      body:    JSON.stringify(postData),
    }),

  updatePost: async (token, postId, postData) =>
    fetchWithAuth(`${BASE_URL}/posts/${postId}`, {
      method:  "PUT",
      headers: { Authorization: `Bearer ${token}` },
      body:    JSON.stringify(postData),
    }),

  deletePost: async (token, postId) =>
    fetchWithAuth(`${BASE_URL}/posts/${postId}`, {
      method:  "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }),

  likePost: async (token, postId) =>
    fetchWithAuth(`${BASE_URL}/posts/${postId}/like`, {
      method:  "POST",
      headers: { Authorization: `Bearer ${token}` },
    }),

  unlikePost: async (token, postId) =>
    fetchWithAuth(`${BASE_URL}/posts/${postId}/unlike`, {
      method:  "POST",
      headers: { Authorization: `Bearer ${token}` },
    }),

  // ==========================================
  // 💬 COMMENTAIRES
  // ==========================================

  getComments: async (token, postId) =>
    fetchWithAuth(`${BASE_URL}/posts/${postId}/comments`, {
      method:  "GET",
      headers: { Authorization: `Bearer ${token}` },
    }),

  addComment: async (token, postId, content) =>
    fetchWithAuth(`${BASE_URL}/posts/${postId}/comments`, {
      method:  "POST",
      headers: { Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ content }),
    }),

  deleteComment: async (token, postId, commentId) =>
    fetchWithAuth(`${BASE_URL}/posts/${postId}/comments/${commentId}`, {
      method:  "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }),

  // ==========================================
  // 📖 STORIES
  // ==========================================

  getStoriesFeed: async (token) =>
    fetchWithAuth(`${BASE_URL}/story/feed`, {
      method:  "GET",
      headers: { Authorization: `Bearer ${token}` },
    }),

  getUserStories: async (token, userId) =>
    fetchWithAuth(`${BASE_URL}/story/user/${userId}`, {
      method:  "GET",
      headers: { Authorization: `Bearer ${token}` },
    }),

  createStory: async (token, storyData) =>
    fetchWithAuth(`${BASE_URL}/story`, {
      method:  "POST",
      headers: { Authorization: `Bearer ${token}` },
      body:    JSON.stringify(storyData),
    }),

  // ✅ FIX 3 — timeout 30 s
  uploadStoryMedia: async (token, file) => {
    console.log(`📤 [API.uploadStoryMedia] ${file.name}`);
    return uploadWithTimeout(`${BASE_URL}/story/upload`, token, file, "file", 30_000);
  },

  deleteStory: async (token, storyId) =>
    fetchWithAuth(`${BASE_URL}/story/${storyId}`, {
      method:  "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }),

  viewStory: async (token, storyId) =>
    fetchWithAuth(`${BASE_URL}/story/${storyId}/view`, {
      method:  "POST",
      headers: { Authorization: `Bearer ${token}` },
    }),

  reactToStory: async (token, storyId, emoji) =>
    fetchWithAuth(`${BASE_URL}/story/${storyId}/react`, {
      method:  "POST",
      headers: { Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ emoji }),
    }),

  // ==========================================
  // 🔔 NOTIFICATIONS
  // ==========================================

  getNotifications: async (token) =>
    fetchWithAuth(`${BASE_URL}/notifications`, {
      method:  "GET",
      headers: { Authorization: `Bearer ${token}` },
    }),

  markNotificationAsRead: async (token, notificationId) =>
    fetchWithAuth(`${BASE_URL}/notifications/${notificationId}/read`, {
      method:  "PUT",
      headers: { Authorization: `Bearer ${token}` },
    }),

  markAllNotificationsAsRead: async (token) =>
    fetchWithAuth(`${BASE_URL}/notifications/read-all`, {
      method:  "PUT",
      headers: { Authorization: `Bearer ${token}` },
    }),

  deleteNotification: async (token, notificationId) =>
    fetchWithAuth(`${BASE_URL}/notifications/${notificationId}`, {
      method:  "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }),

  // ==========================================
  // 📤 UPLOAD PROFIL
  // ==========================================

  // ✅ FIX 3 — timeout 30 s
  uploadProfilePhoto: async (token, file) => {
    console.log(`📤 [API.uploadProfilePhoto] ${file.name}`);
    return uploadWithTimeout(`${BASE_URL}/users/profile-photo`, token, file, "file", 30_000);
  },

  // ✅ FIX 3 — timeout 30 s
  uploadCoverPhoto: async (token, file) => {
    console.log(`📤 [API.uploadCoverPhoto] ${file.name}`);
    return uploadWithTimeout(`${BASE_URL}/users/cover-photo`, token, file, "file", 30_000);
  },

  // ==========================================
  // 💎 PREMIUM
  // ==========================================

  createCheckoutSession: async (token) =>
    fetchWithAuth(`${BASE_URL}/payments/create-checkout-session`, {
      method:  "POST",
      headers: { Authorization: `Bearer ${token}` },
    }),

  verifyPayment: async (token, sessionId) =>
    fetchWithAuth(`${BASE_URL}/payments/verify-session`, {
      method:  "POST",
      headers: { Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ sessionId }),
    }),

  getPremiumStatus: async (token) =>
    fetchWithAuth(`${BASE_URL}/payments/premium-status`, {
      method:  "GET",
      headers: { Authorization: `Bearer ${token}` },
    }),
};

export default API;