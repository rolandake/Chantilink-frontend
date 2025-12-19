// ============================================
// 📁 src/services/apiService.js 
// VERSION: ÉLITE - PRIVACY & RELIABILITY
// ============================================
import axios from 'axios';

class APIService {
  constructor() {
    // Utilisation de l'URL d'API avec fallback sur le port 5000
    this.base = import.meta.env.VITE_API_URL || "http://localhost:5000";
    
    // Instance Axios personnalisée pour une configuration globale
    this.client = axios.create({
      baseURL: this.base,
      timeout: 30000,
    });
  }

  /**
   * 🛡️ Moteur de requête avec Retry automatique
   * Gère la fiabilité réseau et les erreurs serveur.
   */
  async req(ep, opt = {}, attempt = 1) {
    try {
      const response = await this.client({ 
        url: ep, 
        ...opt 
      });
      return response.data;
    } catch (error) {
      // Stratégie de fiabilité : Retry automatique sur erreur 5xx ou réseau
      const isNetworkError = !error.response;
      const isServerError = error.response?.status >= 500;

      if (attempt < 3 && (isNetworkError || isServerError)) {
        console.warn(`⚠️ Erreur API (${error.message}). Tentative ${attempt + 1}/3...`);
        await new Promise(r => setTimeout(r, 1000 * attempt));
        return this.req(ep, opt, attempt + 1);
      }

      // Gestion propre du message d'erreur pour l'UX
      const message = error.response?.data?.message || error.response?.data?.error || error.message;
      throw new Error(message);
    }
  }

  /**
   * 🛠️ Helper pour générer les headers d'autorisation
   */
  authHeader(token) {
    return { 
      Authorization: `Bearer ${token}`,
      'X-Secure-Channel': 'true' // Tag pour le firewall backend (Confidentialité)
    };
  }

  // ============================================
  // 👥 GESTION DES CONTACTS (RÉSEAU PRIVÉ)
  // ============================================

  loadConversations(token) {
    return this.req('/api/contacts/conversations', { headers: this.authHeader(token) });
  }

  loadStats(token) {
    return this.req('/api/contacts/stats', { headers: this.authHeader(token) });
  }

  syncContacts(token, contacts) {
    return this.req('/api/contacts/sync', {
      method: 'POST',
      headers: this.authHeader(token),
      data: { contacts }
    });
  }

  addContact(token, data) {
    return this.req('/api/contacts/add', {
      method: 'POST',
      headers: this.authHeader(token),
      data
    });
  }

  deleteContact(token, id) {
    return this.req(`/api/contacts/${id}`, {
      method: 'DELETE',
      headers: this.authHeader(token)
    });
  }

  // ============================================
  // 💬 MESSAGERIE PRIVÉE & SÉCURISÉE
  // ============================================

  /**
   * Récupère l'historique chiffré des messages
   */
  getMessages(token, friendId) {
    return this.req(`/api/messages/${friendId}`, {
      method: 'GET',
      headers: this.authHeader(token)
    });
  }

  /**
   * Supprime un message spécifique (Droit à l'oubli / Confidentialité)
   */
  deleteMessage(token, messageId) {
    return this.req(`/api/messages/${messageId}`, {
      method: 'DELETE',
      headers: this.authHeader(token)
    });
  }

  /**
   * Efface toute une conversation côté utilisateur
   */
  deleteConversation(token, friendId) {
    return this.req(`/api/messages/conversation/${friendId}`, {
      method: 'DELETE',
      headers: this.authHeader(token)
    });
  }

  // ============================================
  // 📁 TRANSFERT DE FICHIERS & MÉDIAS
  // ============================================

  /**
   * Envoi de fichiers avec support de la progression (Fiabilité)
   */
  uploadFile(token, formData, onProgress = null) {
    return this.req('/api/messages/upload', {
      method: 'POST',
      headers: { 
        ...this.authHeader(token),
        'Content-Type': 'multipart/form-data' 
      },
      data: formData,
      onUploadProgress: (progressEvent) => {
        if (onProgress) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percentCompleted);
        }
      }
    });
  }

  // ============================================
  // 🛡️ SÉCURITÉ & MODÉRATION
  // ============================================

  getPendingMessageRequests(token) {
    return this.req('/api/messages/pending-requests', { headers: this.authHeader(token) });
  }

  acceptMessageRequest(token, requestId) {
    return this.req(`/api/messages/pending-requests/${requestId}/accept`, {
      method: 'POST',
      headers: this.authHeader(token)
    });
  }

  rejectMessageRequest(token, requestId) {
    return this.req(`/api/messages/pending-requests/${requestId}/reject`, {
      method: 'POST',
      headers: this.authHeader(token)
    });
  }

  /**
   * Signaler un utilisateur pour comportement inapproprié (Fiabilité du cercle)
   */
  reportUser(token, userId, reason) {
    return this.req('/api/admin/reports', {
      method: 'POST',
      headers: this.authHeader(token),
      data: { targetUserId: userId, reason }
    });
  }
}

export const API = new APIService();