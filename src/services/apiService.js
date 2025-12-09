// ============================================
// 📁 src/services/apiService.js - VERSION COMPLÈTE
// ============================================
import axios from 'axios';

class APIService {
  constructor() {
    this.base = import.meta.env.VITE_API_URL || "http://localhost:5000";
  }

  // Fonction générique de requête avec retry automatique
  async req(ep, opt = {}, attempt = 1) {
    try {
      const response = await axios({ 
        url: `${this.base}${ep}`, 
        timeout: 30000, 
        ...opt 
      });
      return response.data;
    } catch (error) {
      // Si erreur réseau (pas de réponse) ou erreur serveur 5xx, on réessaie
      if (attempt < 3 && (!error.response || error.response.status >= 500)) {
        await new Promise(r => setTimeout(r, 1000 * attempt));
        return this.req(ep, opt, attempt + 1);
      }
      throw new Error(error.response?.data?.message || error.message);
    }
  }

  // === AUTH & CONTACTS ===
  loadConversations(token) {
    return this.req('/api/contacts/conversations', { headers: { Authorization: `Bearer ${token}` } });
  }

  loadStats(token) {
    return this.req('/api/contacts/stats', { headers: { Authorization: `Bearer ${token}` } });
  }

  syncContacts(token, contacts) {
    return this.req('/api/contacts/sync', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      data: { contacts }
    });
  }

  addContact(token, data) {
    return this.req('/api/contacts/add', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      data
    });
  }

  deleteContact(token, id) {
    return this.req(`/api/contacts/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  inviteContact(token, data) {
    return this.req('/api/contacts/invite', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      data
    });
  }

  // === MESSAGERIE (C'est ici qu'il te manquait la fonction !) ===

  /**
   * ✅ Récupère l'historique via HTTP (Essentiel pour Messages.jsx)
   */
  getMessages(token, friendId) {
    return this.req(`/api/messages/${friendId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  getPendingMessageRequests(token) {
    return this.req('/api/messages/pending-requests', { headers: { Authorization: `Bearer ${token}` } });
  }

  acceptMessageRequest(token, requestId) {
    return this.req(`/api/messages/pending-requests/${requestId}/accept`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  rejectMessageRequest(token, requestId) {
    return this.req(`/api/messages/pending-requests/${requestId}/reject`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  uploadFile(token, formData) {
    return this.req('/api/messages/upload', {
      method: 'POST',
      headers: { 
        Authorization: `Bearer ${token}`,
        'Content-Type': 'multipart/form-data' 
      },
      data: formData
    });
  }

  deleteConversation(token, friendId) {
    return this.req(`/api/messages/conversation/${friendId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
  }
}

export const API = new APIService();