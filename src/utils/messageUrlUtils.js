// ============================================
// 📁 src/utils/messageUrlUtils.js - VERSION FINALE CORRIGÉE
// Extraction robuste des URLs de fichiers dans les messages
// ============================================

/**
 * ✅ EXTRACTION ROBUSTE DE L'URL D'UN MESSAGE
 * Vérifie TOUS les champs possibles où l'URL peut être stockée
 * 
 * @param {Object} message - Message contenant potentiellement un fichier
 * @returns {string|null} - URL du fichier ou null
 */
export const getMessageUrl = (message) => {
  if (!message) {
    console.warn('⚠️ [getMessageUrl] Message null ou undefined');
    return null;
  }

  // 🔍 DEBUG: Activer seulement pour les messages avec fichiers
  const shouldLog = message.type && 
                    !['text', 'system', 'missed-call'].includes(message.type);

  if (shouldLog) {
    console.log('🔍 [getMessageUrl] Analyse message:', {
      id: message._id,
      type: message.type,
      content: message.content?.substring(0, 50),
      availableFields: Object.keys(message).filter(k => 
        k.toLowerCase().includes('url') || 
        k === 'file' || 
        k === 'audio' || 
        k === 'image' || 
        k === 'video'
      )
    });
  }

  // ✅ ORDRE DE PRIORITÉ pour chercher l'URL
  const urlFields = [
    // Champs principaux
    'fileUrl',
    'file',
    'url',
    'secure_url',
    
    // Champs Cloudinary
    'mediaUrl',
    'attachmentUrl',
    
    // Champs spécifiques par type
    'audioUrl',
    'audio',
    'imageUrl',
    'image',
    'videoUrl',
    'video',
    
    // Anciens formats (compatibilité)
    'attachment',
    'media',
  ];

  // Parcourir tous les champs possibles
  for (const field of urlFields) {
    const value = message[field];
    
    // Vérifier que la valeur existe et est une string valide
    if (value && 
        typeof value === 'string' && 
        value.trim().length > 0) {
      
      // Vérifier que c'est bien une URL (commence par http)
      if (value.startsWith('http://') || value.startsWith('https://')) {
        if (shouldLog) {
          console.log(`✅ [getMessageUrl] URL trouvée dans "${field}":`, value);
        }
        return value;
      }
    }
  }

  // ❌ Aucune URL valide trouvée
  if (shouldLog) {
    console.warn('⚠️ [getMessageUrl] Aucune URL trouvée pour message:', {
      id: message._id,
      type: message.type,
      content: message.content,
      checkedFields: urlFields,
      messageKeys: Object.keys(message)
    });
  }

  return null;
};

/**
 * ✅ VÉRIFIER SI UN MESSAGE CONTIENT UN FICHIER
 * 
 * @param {Object} message - Message à vérifier
 * @returns {boolean} - true si le message a un fichier
 */
export const hasFile = (message) => {
  return !!getMessageUrl(message);
};

/**
 * ✅ DÉTERMINER LE TYPE DE FICHIER D'APRÈS L'URL
 * 
 * @param {string} url - URL du fichier
 * @returns {string|null} - Type de fichier (image, video, audio, file)
 */
export const getFileTypeFromUrl = (url) => {
  if (!url) return null;

  const urlLower = url.toLowerCase();

  // Images
  if (urlLower.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i)) {
    return 'image';
  }
  if (urlLower.includes('/image/upload')) {
    return 'image';
  }

  // Vidéos
  if (urlLower.match(/\.(mp4|mov|webm|avi|mkv)(\?|$)/i)) {
    return 'video';
  }
  if (urlLower.includes('/video/upload')) {
    return 'video';
  }

  // Audio
  if (urlLower.match(/\.(mp3|wav|m4a|ogg|aac|webm)(\?|$)/i)) {
    return 'audio';
  }

  // Documents
  if (urlLower.match(/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|zip|rar)(\?|$)/i)) {
    return 'file';
  }

  // Par défaut, considérer comme fichier générique
  return 'file';
};

/**
 * ✅ OBTENIR TOUTES LES INFORMATIONS DU FICHIER
 * 
 * @param {Object} message - Message contenant le fichier
 * @returns {Object|null} - Infos du fichier ou null
 */
export const getFileInfo = (message) => {
  const url = getMessageUrl(message);
  if (!url) return null;

  return {
    url,
    name: message.fileName || 
          message.originalName || 
          message.content || 
          'Fichier',
    size: message.fileSize || null,
    type: message.type || getFileTypeFromUrl(url),
    mimeType: message.mimeType || null,
  };
};

/**
 * ✅ FORMATER LA TAILLE D'UN FICHIER
 * 
 * @param {number} bytes - Taille en bytes
 * @returns {string} - Taille formatée (ex: "1.5 MB")
 */
export const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

/**
 * ✅ OBTENIR L'EXTENSION D'UN FICHIER DEPUIS SON NOM
 * 
 * @param {string} filename - Nom du fichier
 * @returns {string} - Extension en majuscules (ex: "PDF")
 */
export const getFileExtension = (filename) => {
  if (!filename) return '';
  
  const parts = filename.split('.');
  if (parts.length < 2) return '';
  
  return parts[parts.length - 1].toUpperCase();
};

/**
 * ✅ OBTENIR UNE ICÔNE POUR UN TYPE DE FICHIER
 * 
 * @param {string} filename - Nom du fichier
 * @returns {string} - Emoji représentant le type de fichier
 */
export const getFileIcon = (filename) => {
  const ext = getFileExtension(filename);
  
  // Documents texte
  if (['PDF', 'DOC', 'DOCX', 'TXT', 'RTF'].includes(ext)) return '📄';
  
  // Tableurs
  if (['XLS', 'XLSX', 'CSV', 'NUMBERS'].includes(ext)) return '📊';
  
  // Présentations
  if (['PPT', 'PPTX', 'KEY'].includes(ext)) return '📽️';
  
  // Archives
  if (['ZIP', 'RAR', '7Z', 'TAR', 'GZ'].includes(ext)) return '📦';
  
  // Code
  if (['JS', 'JSX', 'TS', 'TSX', 'PY', 'JAVA', 'CPP', 'C', 'HTML', 'CSS'].includes(ext)) return '💻';
  
  // Images (déjà gérées séparément, mais au cas où)
  if (['JPG', 'JPEG', 'PNG', 'GIF', 'WEBP', 'SVG'].includes(ext)) return '🖼️';
  
  // Vidéos (déjà gérées séparément)
  if (['MP4', 'MOV', 'AVI', 'MKV', 'WEBM'].includes(ext)) return '🎥';
  
  // Audio (déjà géré séparément)
  if (['MP3', 'WAV', 'OGG', 'M4A'].includes(ext)) return '🎵';
  
  // Défaut
  return '📎';
};

// Export par défaut de toutes les fonctions
export default {
  getMessageUrl,
  hasFile,
  getFileTypeFromUrl,
  getFileInfo,
  formatFileSize,
  getFileExtension,
  getFileIcon,
};