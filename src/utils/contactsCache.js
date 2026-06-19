// ============================================
// src/utils/contactsCache.js
// FIXES:
//  - normalizeId : gère ObjectId Mongoose, string, objet {id, _id}
//    uniformément → même résultat que getEntityId dans Messages.jsx
//  - saveContactToOnApp : vérifie que l'id est normalisé avant save
//  - readOnAppContacts : filtre les entrées corrompues (sans id)
//  - removeContactFromCache : supprime par userId normalisé
// ============================================

// ──────────────────────────────────────────────────────────────────────────
// ✅ normalizeId — fonction canonique utilisée PARTOUT dans le projet
// Remplace getEntityId de Messages.jsx pour garantir la cohérence des clés
// ──────────────────────────────────────────────────────────────────────────
export const normalizeId = (v) => {
  if (!v) return "";
  // ObjectId Mongoose ou objet {_id, id}
  if (typeof v === "object" && v !== null) {
    const id = v._id || v.id;
    return id ? String(id).trim().toLowerCase() : "";
  }
  return String(v).trim().toLowerCase();
};

// ──────────────────────────────────────────────────────────────────────────
// Clé localStorage par userId propriétaire
// ──────────────────────────────────────────────────────────────────────────
const cacheKey = (ownerId) => {
  const id = normalizeId(ownerId);
  if (!id) return null;
  return `chantilink_onapp_contacts_${id}`;
};

// ──────────────────────────────────────────────────────────────────────────
// Lire les contacts "sur l'app" depuis le cache local
// ──────────────────────────────────────────────────────────────────────────
export const readOnAppContacts = (ownerId) => {
  const key = cacheKey(ownerId);
  if (!key) return [];
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // ✅ Filtrer les entrées corrompues (sans id valide)
    return parsed.filter((c) => normalizeId(c.id || c._id));
  } catch {
    return [];
  }
};

// ──────────────────────────────────────────────────────────────────────────
// Sauvegarder / mettre à jour un contact dans le cache local
// ──────────────────────────────────────────────────────────────────────────
export const saveContactToOnApp = (contact, ownerId) => {
  const key = cacheKey(ownerId);
  if (!key) return;

  // ✅ Normaliser l'id du contact avant sauvegarde
  const contactId = normalizeId(contact.id || contact._id);
  if (!contactId) return;

  try {
    const existing = readOnAppContacts(ownerId);
    const idx      = existing.findIndex(
      (c) => normalizeId(c.id || c._id) === contactId
    );

    const entry = {
      ...contact,
      id:  contactId,
      _id: contactId,
    };

    let updated;
    if (idx !== -1) {
      // Mettre à jour en conservant les champs existants
      updated = [...existing];
      updated[idx] = { ...existing[idx], ...entry };
    } else {
      updated = [...existing, entry];
    }

    localStorage.setItem(key, JSON.stringify(updated));
  } catch (e) {
    console.error("[contactsCache] saveContactToOnApp error:", e);
  }
};

// ──────────────────────────────────────────────────────────────────────────
// Supprimer un contact du cache local
// ──────────────────────────────────────────────────────────────────────────
export const removeContactFromCache = (contactId, ownerId) => {
  const key = cacheKey(ownerId);
  if (!key) return;

  const normalizedContactId = normalizeId(contactId);
  if (!normalizedContactId) return;

  try {
    const existing = readOnAppContacts(ownerId);
    const updated  = existing.filter(
      (c) => normalizeId(c.id || c._id) !== normalizedContactId
    );
    localStorage.setItem(key, JSON.stringify(updated));
  } catch (e) {
    console.error("[contactsCache] removeContactFromCache error:", e);
  }
};

// ──────────────────────────────────────────────────────────────────────────
// Vider tous les contacts du cache (déconnexion)
// ──────────────────────────────────────────────────────────────────────────
export const clearOnAppContacts = (ownerId) => {
  const key = cacheKey(ownerId);
  if (!key) return;
  try {
    localStorage.removeItem(key);
  } catch (e) {
    console.error("[contactsCache] clearOnAppContacts error:", e);
  }
};

// ──────────────────────────────────────────────────────────────────────────
// ✅ Alias requis par AuthContext.jsx (logout() appelle clearContactsCache)
// ──────────────────────────────────────────────────────────────────────────
export const clearContactsCache = clearOnAppContacts;

// ──────────────────────────────────────────────────────────────────────────
// Vérifie si un contact est déjà dans le cache
// ──────────────────────────────────────────────────────────────────────────
export const isContactCached = (contactId, ownerId) => {
  const normalizedContactId = normalizeId(contactId);
  if (!normalizedContactId) return false;
  const existing = readOnAppContacts(ownerId);
  return existing.some((c) => normalizeId(c.id || c._id) === normalizedContactId);
};