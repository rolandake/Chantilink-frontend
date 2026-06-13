// ============================================
// 📁 src/utils/contactsCache.js
// Système de cache local des contacts avec ID unique garanti.
//
// PROBLÈME RÉSOLU :
//   Les contacts apparaissaient en double car :
//   1. conversations[] retourne { id: "abc" }
//   2. contacts[] retourne { _id: "abc" } ou { id: "abc" }
//   3. onAppContacts localStorage stockait les deux formes
//   → Map.has() ratait car "abc" !== "abc" (string vs ObjectId)
//
// SOLUTION :
//   - normalizeId() : toujours String, trim, lowercase
//   - saveContactToOnApp() : clé canonique = normalizeId
//   - readOnAppContacts() : déduplication par normalizeId au moment de la lecture
//   - removeContactFromCache() : suppression fiable par normalizeId
// ============================================

/**
 * Normalise n'importe quelle forme d'ID en string lowercase sans espaces.
 * Gère : ObjectId MongoDB, string, { _id }, { id }, null/undefined.
 */
export const normalizeId = (value) => {
  if (!value) return "";
  if (typeof value === "object") {
    const raw = value._id || value.id || "";
    return String(raw).trim().toLowerCase();
  }
  return String(value).trim().toLowerCase();
};

/** Clé localStorage isolée par utilisateur */
const storageKey = (userId) => `onAppContacts_${normalizeId(userId)}`;

/**
 * Lire les contacts depuis localStorage avec déduplication garantie.
 * @param {string|object} userId
 * @returns {Array} contacts dédupliqués, normalisés
 */
export const readOnAppContacts = (userId) => {
  if (!userId) return [];
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    // Déduplication par ID normalisé (au cas où des doublons se seraient glissés)
    const seen = new Map();
    for (const c of parsed) {
      const id = normalizeId(c.id || c._id);
      if (id && !seen.has(id)) {
        seen.set(id, { ...c, id }); // normaliser l'id stocké
      }
    }
    return Array.from(seen.values());
  } catch {
    return [];
  }
};

/**
 * Ajouter ou mettre à jour un contact dans le cache.
 * Si un contact avec le même ID normalisé existe déjà, il est remplacé.
 * @param {object} contact - { id|_id, fullName, ... }
 * @param {string|object} userId
 */
export const saveContactToOnApp = (contact, userId) => {
  if (!contact || !userId) return;
  const id = normalizeId(contact.id || contact._id);
  if (!id) return;

  const existing = readOnAppContacts(userId);
  const normalized = {
    id,
    fullName:     contact.fullName    || contact.name || "",
    username:     contact.username    || "",
    profilePhoto: contact.profilePhoto|| "",
    isOnline:     contact.isOnline    ?? false,
    lastSeen:     contact.lastSeen    || null,
    phone:        contact.phone       || "",
    savedAt:      Date.now(),
  };

  // Remplacer si existe, sinon ajouter
  const idx = existing.findIndex((c) => normalizeId(c.id) === id);
  if (idx !== -1) {
    existing[idx] = normalized;
  } else {
    existing.push(normalized);
  }

  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(existing));
  } catch {
    // quota exceeded → purger les plus anciens
    const trimmed = existing.slice(-200);
    try { localStorage.setItem(storageKey(userId), JSON.stringify(trimmed)); } catch {}
  }
};

/**
 * Supprimer un contact du cache local par son ID.
 * @param {string|object} contactId
 * @param {string|object} userId
 */
export const removeContactFromCache = (contactId, userId) => {
  if (!contactId || !userId) return;
  const id = normalizeId(contactId);
  const existing = readOnAppContacts(userId);
  const updated  = existing.filter((c) => normalizeId(c.id) !== id);
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(updated));
  } catch {}
};

/**
 * Vider entièrement le cache d'un utilisateur.
 * @param {string|object} userId
 */
export const clearContactsCache = (userId) => {
  if (!userId) return;
  try { localStorage.removeItem(storageKey(userId)); } catch {}
};