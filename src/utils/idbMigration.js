// ============================================
// 📁 src/utils/idbMigration.js - VERSION FINALE
// ============================================
import { openDB } from "idb";

const IDB_DB_NAME = "ChantilinkCache_v1";
const IDB_VERSION = 4; // ✅ Version 4 pour inclure le store 'users'

// Store names
export const STORES = {
  POSTS: "posts",
  PROFILE_POSTS: "profile-posts",
  STORIES: "stories",
  MESSAGES: "messages",
  USER_METADATA: "user-metadata",
  USERS: "users", // ✅ Store Utilisateurs
};

let dbInstance = null;

// ============================================
// 🔧 Initialisation IndexedDB
// ============================================
export async function initializeIndexedDB() {
  if (dbInstance) return dbInstance;

  try {
    dbInstance = await openDB(IDB_DB_NAME, IDB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        console.log(`🔄 [IDB] Migration de v${oldVersion} vers v${newVersion}`);

        Object.values(STORES).forEach((storeName) => {
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName);
            console.log(`✅ [IDB] Store '${storeName}' créé`);
          }
        });
      },
      blocked() {
        console.warn("⚠️ [IDB] Ouverture bloquée, fermez les autres onglets");
      },
      blocking() {
        console.warn("⚠️ [IDB] Nouvelle version détectée");
        if (dbInstance) {
          dbInstance.close();
          dbInstance = null;
        }
      },
      terminated() {
        console.error("❌ [IDB] Connexion terminée anormalement");
        dbInstance = null;
      },
    });
    return dbInstance;
  } catch (err) {
    console.error("❌ [IDB] Erreur d'initialisation:", err);
    return null;
  }
}

// ============================================
// 📖 Fonctions génériques d'accès
// ============================================
export async function idbGet(storeName, key) {
  try {
    const db = await initializeIndexedDB();
    if (!db) return null;
    return await db.get(storeName, key);
  } catch (err) {
    return null;
  }
}

export async function idbSet(storeName, key, value) {
  try {
    const db = await initializeIndexedDB();
    if (!db) return;

    // Protection taille cache (sauf pour users et stories unitaires)
    if (
      (storeName === STORES.POSTS || storeName === STORES.PROFILE_POSTS) &&
      Array.isArray(value) &&
      value.length > 100
    ) {
      value = value.slice(0, 100);
    }

    await db.put(storeName, value, key);
  } catch (err) {
    console.warn(`⚠️ [IDB] Erreur écriture ${storeName}:`, err);
  }
}

export async function idbDelete(storeName, key) {
  try {
    const db = await initializeIndexedDB();
    if (!db) return;
    await db.delete(storeName, key);
  } catch (err) {
    console.warn(`⚠️ [IDB] Erreur suppression ${storeName}:`, err);
  }
}

export async function idbClear(storeName) {
  try {
    const db = await initializeIndexedDB();
    if (!db) return;
    await db.clear(storeName);
  } catch (err) {
    console.warn(`⚠️ [IDB] Erreur clear ${storeName}:`, err);
  }
}

// ============================================
// 📝 Fonctions POSTS FEED
// ============================================
export async function idbGetPosts(key) { return await idbGet(STORES.POSTS, key); }
export async function idbSetPosts(key, value) { return await idbSet(STORES.POSTS, key, value); }
export async function idbClearPosts() { return await idbClear(STORES.POSTS); }

// ============================================
// 👤 Fonctions POSTS PROFIL
// ============================================
export async function idbGetProfilePosts(key) { return await idbGet(STORES.PROFILE_POSTS, key); }
export async function idbSetProfilePosts(key, value) { return await idbSet(STORES.PROFILE_POSTS, key, value); }

// ✅ Correction demandée : Nettoyage spécifique avec exclusion
export async function idbClearOtherKeysProfilePosts(prefix) {
  try {
    const db = await initializeIndexedDB();
    if (!db) return;

    const storeName = STORES.PROFILE_POSTS;
    const keys = await db.getAllKeys(storeName);
    
    // Suppression parallèle pour performance
    const promises = keys.map(key => {
      if (!key.startsWith(prefix)) {
        return db.delete(storeName, key);
      }
      return Promise.resolve();
    });

    await Promise.all(promises);
  } catch (err) {
    console.warn("⚠️ [IDB] Erreur clearOtherKeysProfilePosts:", err);
  }
}

// ============================================
// 👥 Fonctions USERS (Profils complets)
// ============================================
// Nom interne générique
export async function idbGetUser(key) { return await idbGet(STORES.USERS, key); }
export async function idbSetUser(key, value) { return await idbSet(STORES.USERS, key, value); }

// ✅ ALIAS OBLIGATOIRES POUR PROFILEPAGE.JSX
// Ces lignes corrigent l'erreur "does not provide an export named 'idbGetProfileUser'"
export const idbGetProfileUser = idbGetUser;
export const idbSetProfileUser = idbSetUser;

// ============================================
// 📖 Fonctions STORIES
// ============================================
export async function idbGetStories(key) { return await idbGet(STORES.STORIES, key); }
export async function idbSetStories(key, value) { return await idbSet(STORES.STORIES, key, value); }

// ============================================
// 💬 Fonctions MESSAGES
// ============================================
export async function idbGetMessages(key) { return await idbGet(STORES.MESSAGES, key); }
export async function idbSetMessages(key, value) { return await idbSet(STORES.MESSAGES, key, value); }

// ============================================
// 🚀 Setup & Maintenance
// ============================================
export async function setupIndexedDB() {
  await initializeIndexedDB();
  // On ne log plus "Prêt" à chaque appel pour éviter le spam console
}

export async function resetIndexedDB() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
  await indexedDB.deleteDatabase(IDB_DB_NAME);
  console.log("🔥 [IDB] Base supprimée");
}