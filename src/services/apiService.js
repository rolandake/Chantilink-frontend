// src/services/apiService.js
import axios from 'axios';

class APIService {
  constructor() {
    this.base = import.meta.env.VITE_API_URL || "http://localhost:5000";
  }

  async req(ep, opt = {}, attempt = 1) {
    try {
      const response = await axios({ url: `${this.base}${ep}`, timeout: 30000, ...opt });
      return response.data;
    } catch (error) {
      if (attempt < 3 && !error.response) {
        await new Promise(r => setTimeout(r, 1000 * attempt));
        return this.req(ep, opt, attempt + 1);
      }
      throw new Error(error.response?.data?.message || error.message);
    }
  }

  loadConversations(token) {
    return this.req('/api/contacts/conversations', { headers: { Authorization: `Bearer ${token}` } });
  }

  loadStats(token) {
    return this.req('/api/contacts/stats', { headers: { Authorization: `Bearer ${token}` } });
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

  uploadFile(file, token) {
    const form = new FormData();
    form.append('file', file);
    return this.req('/api/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      data: form
    });
  }
}

export const API = new APIService();