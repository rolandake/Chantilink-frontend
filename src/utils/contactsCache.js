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
  const rawId = contact?.id || contact?._id;
  if (!rawId || !key) return;
  try {
    // ✅ Normaliser l'ID : toujours utiliser 'id' comme clé
    const id = String(rawId);
    const existing = readOnAppContacts(userId);
    const normalized = { ...contact, id, _id: id };
    
    // ✅ Déduplication : filtrer tous les doublons (id OU _id)
    const updated = [normalized, ...existing.filter((c) => {
      const cId = String(c.id || c._id || '');
      return cId !== id;
    })];
    
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
