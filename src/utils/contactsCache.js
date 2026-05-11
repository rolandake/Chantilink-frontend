// ============================================
// 📁 src/utils/contactsCache.js
// Utilitaire isolé pour gérer le cache contacts par userId
// Importé par AuthContext ET ContactSidebar sans dépendance circulaire
// ============================================

const getStorageKey = (userId) =>
  userId ? `onAppContacts_${userId}` : null;

export const readOnAppContacts = (userId) => {
  const key = getStorageKey(userId);
  if (!key) return [];
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
};

export const saveContactToOnApp = (contact, userId) => {
  const key = getStorageKey(userId);
  if (!contact?.id || !key) return;
  try {
    const existing = readOnAppContacts(userId);
    const updated = [contact, ...existing.filter((c) => c.id !== contact.id)];
    localStorage.setItem(key, JSON.stringify(updated));
  } catch {}
};

/**
 * Vide le cache contacts d'un utilisateur.
 * Appelé au logout dans AuthContext.
 */
export const clearContactsCache = (userId) => {
  const key = getStorageKey(userId);
  if (key) localStorage.removeItem(key);
};