// ============================================
// 📁 src/utils/LocalMediaStorage.js
// SYSTÈME DE STOCKAGE LOCAL TYPE WHATSAPP
// Médias téléchargés UNE FOIS = disponibles HORS LIGNE
// ============================================

const DB_NAME = 'ChantilinkMediaDB';
const DB_VERSION = 2;
const MEDIA_STORE = 'media';
const METADATA_STORE = 'metadata';

// Tailles maximales par type de média (en MB)
const MAX_SIZES = {
  image: 10,
  video: 50,
  audio: 20,
  file: 100
};

class LocalMediaStorage {
  constructor() {
    this.db = null;
    this.initPromise = this.init();
    this.downloadQueue = new Map(); // File d'attente des téléchargements
    this.activeDownloads = 0;
    this.maxConcurrentDownloads = 3; // Maximum 3 téléchargements simultanés
  }

  /**
   * ✅ INITIALISATION BASE DE DONNÉES
   */
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('❌ [LocalMedia] Erreur ouverture DB');
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('✅ [LocalMedia] Base de données prête');
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Store pour les fichiers binaires
        if (!db.objectStoreNames.contains(MEDIA_STORE)) {
          const mediaStore = db.createObjectStore(MEDIA_STORE, { keyPath: 'id' });
          mediaStore.createIndex('messageId', 'messageId', { unique: true });
          mediaStore.createIndex('type', 'type', { unique: false });
          mediaStore.createIndex('downloadedAt', 'downloadedAt', { unique: false });
          mediaStore.createIndex('size', 'size', { unique: false });
        }

        // Store pour les métadonnées (recherche rapide)
        if (!db.objectStoreNames.contains(METADATA_STORE)) {
          const metaStore = db.createObjectStore(METADATA_STORE, { keyPath: 'messageId' });
          metaStore.createIndex('conversationId', 'conversationId', { unique: false });
          metaStore.createIndex('remoteUrl', 'remoteUrl', { unique: false });
        }

        console.log('🔧 [LocalMedia] Stores créés');
      };
    });
  }

  /**
   * ✅ VÉRIFIER SI UN MÉDIA EXISTE LOCALEMENT
   */
  async hasMedia(messageId) {
    await this.initPromise;
    
    return new Promise((resolve) => {
      const transaction = this.db.transaction([METADATA_STORE], 'readonly');
      const store = transaction.objectStore(METADATA_STORE);
      const request = store.get(messageId);

      request.onsuccess = () => {
        resolve(!!request.result);
      };

      request.onerror = () => {
        resolve(false);
      };
    });
  }

  /**
   * ✅ RÉCUPÉRER UN MÉDIA LOCAL (Blob URL)
   */
  async getMedia(messageId) {
    await this.initPromise;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([MEDIA_STORE], 'readonly');
      const store = transaction.objectStore(MEDIA_STORE);
      const index = store.index('messageId');
      const request = index.get(messageId);

      request.onsuccess = () => {
        if (request.result && request.result.blob) {
          try {
            const blobUrl = URL.createObjectURL(request.result.blob);
            console.log(`📦 [LocalMedia] Média local: ${messageId}`);
            resolve({
              url: blobUrl,
              type: request.result.type,
              size: request.result.size,
              downloadedAt: request.result.downloadedAt
            });
          } catch (error) {
            console.error('❌ [LocalMedia] Erreur création Blob URL:', error);
            reject(error);
          }
        } else {
          resolve(null);
        }
      };

      request.onerror = () => {
        console.error('❌ [LocalMedia] Erreur lecture média');
        reject(request.error);
      };
    });
  }

  /**
   * ✅ TÉLÉCHARGER ET SAUVEGARDER UN MÉDIA
   * Avec gestion de file d'attente et retry
   */
  async downloadAndSave(messageId, remoteUrl, metadata = {}) {
    // Vérifier si déjà téléchargé
    const exists = await this.hasMedia(messageId);
    if (exists) {
      console.log(`⏭️ [LocalMedia] Déjà téléchargé: ${messageId}`);
      return await this.getMedia(messageId);
    }

    // Vérifier si déjà en téléchargement
    if (this.downloadQueue.has(messageId)) {
      console.log(`⏳ [LocalMedia] Déjà en file: ${messageId}`);
      return this.downloadQueue.get(messageId);
    }

    // Créer la promesse de téléchargement
    const downloadPromise = this._executeDownload(messageId, remoteUrl, metadata);
    this.downloadQueue.set(messageId, downloadPromise);

    try {
      const result = await downloadPromise;
      this.downloadQueue.delete(messageId);
      return result;
    } catch (error) {
      this.downloadQueue.delete(messageId);
      throw error;
    }
  }

  /**
   * 🔄 EXÉCUTER LE TÉLÉCHARGEMENT (avec retry et limitation)
   */
  async _executeDownload(messageId, remoteUrl, metadata, retryCount = 0) {
    const maxRetries = 3;

    // Attendre si trop de téléchargements actifs
    while (this.activeDownloads >= this.maxConcurrentDownloads) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.activeDownloads++;
    console.log(`⬇️ [LocalMedia] Téléchargement ${messageId} (actifs: ${this.activeDownloads})`);

    try {
      // Télécharger le fichier
      const response = await fetch(remoteUrl);
      
      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }

      // Vérifier la taille
      const contentLength = response.headers.get('content-length');
      const sizeInMB = contentLength ? parseInt(contentLength) / (1024 * 1024) : 0;
      const maxSize = MAX_SIZES[metadata.type] || 100;

      if (sizeInMB > maxSize) {
        throw new Error(`Fichier trop volumineux: ${sizeInMB.toFixed(1)}MB (max: ${maxSize}MB)`);
      }

      // Convertir en Blob
      const blob = await response.blob();
      console.log(`✅ [LocalMedia] Téléchargé: ${messageId} (${(blob.size / 1024).toFixed(1)} KB)`);

      // Sauvegarder dans IndexedDB
      await this._saveToIndexedDB(messageId, blob, metadata, remoteUrl);

      // Retourner le Blob URL
      return {
        url: URL.createObjectURL(blob),
        type: metadata.type,
        size: blob.size,
        downloadedAt: Date.now()
      };

    } catch (error) {
      console.error(`❌ [LocalMedia] Erreur téléchargement ${messageId}:`, error);

      // Retry automatique
      if (retryCount < maxRetries) {
        console.log(`🔄 [LocalMedia] Retry ${retryCount + 1}/${maxRetries} pour ${messageId}`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
        return this._executeDownload(messageId, remoteUrl, metadata, retryCount + 1);
      }

      throw error;
    } finally {
      this.activeDownloads--;
    }
  }

  /**
   * 💾 SAUVEGARDER DANS INDEXEDDB
   */
  async _saveToIndexedDB(messageId, blob, metadata, remoteUrl) {
    await this.initPromise;

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([MEDIA_STORE, METADATA_STORE], 'readwrite');
      const mediaStore = transaction.objectStore(MEDIA_STORE);
      const metaStore = transaction.objectStore(METADATA_STORE);

      const now = Date.now();

      // Sauvegarder le blob
      const mediaData = {
        id: `media-${messageId}`,
        messageId,
        blob,
        type: metadata.type || 'file',
        size: blob.size,
        downloadedAt: now
      };

      // Sauvegarder les métadonnées
      const metaData = {
        messageId,
        conversationId: metadata.conversationId,
        remoteUrl,
        type: metadata.type,
        fileName: metadata.fileName,
        downloadedAt: now,
        hasLocalCopy: true
      };

      mediaStore.put(mediaData);
      metaStore.put(metaData);

      transaction.oncomplete = () => {
        console.log(`💾 [LocalMedia] Sauvegardé: ${messageId}`);
        resolve(true);
      };

      transaction.onerror = () => {
        console.error('❌ [LocalMedia] Erreur sauvegarde');
        reject(transaction.error);
      };
    });
  }

  /**
   * 🗑️ SUPPRIMER UN MÉDIA
   */
  async deleteMedia(messageId) {
    await this.initPromise;

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([MEDIA_STORE, METADATA_STORE], 'readwrite');
      const mediaStore = transaction.objectStore(MEDIA_STORE);
      const metaStore = transaction.objectStore(METADATA_STORE);

      const mediaIndex = mediaStore.index('messageId');
      const mediaRequest = mediaIndex.openCursor(messageId);

      mediaRequest.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          cursor.delete();
        }
      };

      metaStore.delete(messageId);

      transaction.oncomplete = () => {
        console.log(`🗑️ [LocalMedia] Supprimé: ${messageId}`);
        resolve(true);
      };

      transaction.onerror = () => {
        reject(transaction.error);
      };
    });
  }

  /**
   * 📊 OBTENIR STATISTIQUES DE STOCKAGE
   */
  async getStorageStats() {
    await this.initPromise;

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([MEDIA_STORE], 'readonly');
      const store = transaction.objectStore(MEDIA_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        const allMedia = request.result;
        
        const stats = {
          totalCount: allMedia.length,
          totalSize: 0,
          byType: {
            image: { count: 0, size: 0 },
            video: { count: 0, size: 0 },
            audio: { count: 0, size: 0 },
            file: { count: 0, size: 0 }
          }
        };

        allMedia.forEach(media => {
          stats.totalSize += media.size;
          if (stats.byType[media.type]) {
            stats.byType[media.type].count++;
            stats.byType[media.type].size += media.size;
          }
        });

        // Convertir en MB
        stats.totalSizeMB = (stats.totalSize / (1024 * 1024)).toFixed(2);
        Object.keys(stats.byType).forEach(type => {
          stats.byType[type].sizeMB = (stats.byType[type].size / (1024 * 1024)).toFixed(2);
        });

        console.log('📊 [LocalMedia] Stats:', stats);
        resolve(stats);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 🧹 NETTOYER LES ANCIENS MÉDIAS
   */
  async cleanOldMedia(daysToKeep = 90) {
    await this.initPromise;

    const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([MEDIA_STORE, METADATA_STORE], 'readwrite');
      const mediaStore = transaction.objectStore(MEDIA_STORE);
      const metaStore = transaction.objectStore(METADATA_STORE);
      
      let deletedCount = 0;
      let freedSpace = 0;

      const request = mediaStore.openCursor();

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          if (cursor.value.downloadedAt < cutoffTime) {
            freedSpace += cursor.value.size;
            deletedCount++;
            
            // Supprimer média et métadonnées
            cursor.delete();
            metaStore.delete(cursor.value.messageId);
          }
          cursor.continue();
        } else {
          const freedMB = (freedSpace / (1024 * 1024)).toFixed(2);
          console.log(`🧹 [LocalMedia] ${deletedCount} médias supprimés (${freedMB} MB libérés)`);
          resolve({ deletedCount, freedSpace, freedMB });
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 🗑️ EFFACER TOUS LES MÉDIAS
   */
  async clearAllMedia() {
    await this.initPromise;

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([MEDIA_STORE, METADATA_STORE], 'readwrite');
      
      transaction.objectStore(MEDIA_STORE).clear();
      transaction.objectStore(METADATA_STORE).clear();

      transaction.oncomplete = () => {
        console.log('🗑️ [LocalMedia] Tous les médias effacés');
        resolve(true);
      };

      transaction.onerror = () => reject(transaction.error);
    });
  }

  /**
   * 📥 TÉLÉCHARGER TOUS LES MÉDIAS D'UNE CONVERSATION
   * (Pour sauvegarde hors ligne)
   */
  async downloadConversationMedia(messages, conversationId) {
    const mediaMessages = messages.filter(msg => 
      ['image', 'video', 'audio', 'file'].includes(msg.type) && 
      (msg.file || msg.url)
    );

    console.log(`📥 [LocalMedia] Téléchargement de ${mediaMessages.length} médias pour conversation ${conversationId}`);

    const downloadPromises = mediaMessages.map(msg => 
      this.downloadAndSave(
        msg._id, 
        msg.file || msg.url,
        {
          type: msg.type,
          conversationId,
          fileName: msg.fileName || msg.content
        }
      ).catch(err => {
        console.error(`❌ [LocalMedia] Échec ${msg._id}:`, err);
        return null;
      })
    );

    const results = await Promise.all(downloadPromises);
    const successCount = results.filter(r => r !== null).length;
    
    console.log(`✅ [LocalMedia] ${successCount}/${mediaMessages.length} médias téléchargés`);
    
    return { total: mediaMessages.length, success: successCount };
  }
}

// Export singleton
export const localMediaStorage = new LocalMediaStorage();
export default localMediaStorage;