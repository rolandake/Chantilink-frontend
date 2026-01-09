// src/utils/idbCleanup.js - NETTOYAGE INDEXEDDB
import { openDB } from 'idb';

const DB_NAME = 'chantilink-db';
const DB_VERSION = 2;

// ============================================
// 🧹 FONCTION DE NETTOYAGE COMPLET
// ============================================
export async function cleanupIndexedDB() {
  try {
    console.log('🧹 [IDB Cleanup] Démarrage du nettoyage...');
    
    const db = await openDB(DB_NAME, DB_VERSION);
    
    // 1. Supprimer les anciennes données (> 7 jours)
    const stores = ['posts', 'profile-posts', 'users', 'stories'];
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    
    for (const storeName of stores) {
      if (db.objectStoreNames.contains(storeName)) {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const allKeys = await store.getAllKeys();
        
        let deletedCount = 0;
        
        for (const key of allKeys) {
          const item = await store.get(key);
          
          // Supprimer si timestamp trop ancien
          if (item?.timestamp && item.timestamp < sevenDaysAgo) {
            await store.delete(key);
            deletedCount++;
          }
        }
        
        await tx.done;
        console.log(`✅ [IDB Cleanup] ${storeName}: ${deletedCount} entrées supprimées`);
      }
    }
    
    // 2. Limiter le nombre d'entrées par store
    const limits = {
      'posts': 100,
      'profile-posts': 50,
      'users': 50,
      'stories': 20
    };
    
    for (const [storeName, limit] of Object.entries(limits)) {
      if (db.objectStoreNames.contains(storeName)) {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const allKeys = await store.getAllKeys();
        
        if (allKeys.length > limit) {
          const toDelete = allKeys.slice(0, allKeys.length - limit);
          for (const key of toDelete) {
            await store.delete(key);
          }
          console.log(`✅ [IDB Cleanup] ${storeName}: ${toDelete.length} entrées supprimées (limite: ${limit})`);
        }
        
        await tx.done;
      }
    }
    
    db.close();
    console.log('✅ [IDB Cleanup] Nettoyage terminé');
    return true;
    
  } catch (err) {
    console.error('❌ [IDB Cleanup] Erreur:', err);
    return false;
  }
}

// ============================================
// 🔥 RÉINITIALISATION COMPLÈTE (URGENCE)
// ============================================
export async function resetIndexedDB() {
  try {
    console.log('🔥 [IDB Reset] Réinitialisation complète...');
    
    // Fermer toutes les connexions
    const databases = await indexedDB.databases();
    
    for (const dbInfo of databases) {
      if (dbInfo.name === DB_NAME) {
        await new Promise((resolve, reject) => {
          const request = indexedDB.deleteDatabase(DB_NAME);
          request.onsuccess = () => {
            console.log('✅ [IDB Reset] Base supprimée');
            resolve();
          };
          request.onerror = () => reject(request.error);
          request.onblocked = () => {
            console.warn('⚠️ [IDB Reset] Suppression bloquée, réessai...');
            setTimeout(resolve, 1000);
          };
        });
      }
    }
    
    // Recréer la base
    await openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const stores = ['posts', 'profile-posts', 'users', 'stories'];
        stores.forEach(name => {
          if (!db.objectStoreNames.contains(name)) {
            db.createObjectStore(name);
          }
        });
      }
    });
    
    console.log('✅ [IDB Reset] Base recréée');
    return true;
    
  } catch (err) {
    console.error('❌ [IDB Reset] Erreur:', err);
    return false;
  }
}

// ============================================
// 📊 VÉRIFIER L'ESPACE DISPONIBLE
// ============================================
export async function checkStorageQuota() {
  try {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      const usage = estimate.usage || 0;
      const quota = estimate.quota || 0;
      const percentUsed = (usage / quota) * 100;
      
      console.log('📊 [Storage] Usage:', {
        used: `${(usage / 1024 / 1024).toFixed(2)} MB`,
        total: `${(quota / 1024 / 1024).toFixed(2)} MB`,
        percent: `${percentUsed.toFixed(1)}%`
      });
      
      // Nettoyer si > 80%
      if (percentUsed > 80) {
        console.warn('⚠️ [Storage] Quota > 80%, nettoyage automatique...');
        await cleanupIndexedDB();
      }
      
      return { usage, quota, percentUsed };
    }
    
    return null;
  } catch (err) {
    console.error('❌ [Storage] Erreur vérification quota:', err);
    return null;
  }
}

// ============================================
// 🔄 FONCTION D'INITIALISATION
// ============================================
export async function initializeStorage() {
  try {
    // Vérifier le quota
    const quota = await checkStorageQuota();
    
    // Si quota > 90%, réinitialiser
    if (quota && quota.percentUsed > 90) {
      console.warn('🔥 [Storage] Quota > 90%, réinitialisation...');
      await resetIndexedDB();
      return;
    }
    
    // Sinon, simple nettoyage
    await cleanupIndexedDB();
    
  } catch (err) {
    console.error('❌ [Storage] Erreur init:', err);
  }
}

// ============================================
// 🎯 EXPORTER POUR UTILISATION
// ============================================
export default {
  cleanup: cleanupIndexedDB,
  reset: resetIndexedDB,
  checkQuota: checkStorageQuota,
  init: initializeStorage
};