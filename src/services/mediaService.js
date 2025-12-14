// ============================================
// 📁 src/services/mediaService.js
// Service centralisé pour gérer TOUS les médias
// ============================================

import { API } from './apiService';

/**
 * Configuration des types de médias supportés
 */
const MEDIA_CONFIG = {
  image: {
    extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'],
    mimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    maxSize: 10 * 1024 * 1024, // 10 MB
    icon: '🖼️'
  },
  video: {
    extensions: ['mp4', 'mov', 'webm', 'avi', 'mkv'],
    mimeTypes: ['video/mp4', 'video/quicktime', 'video/webm'],
    maxSize: 100 * 1024 * 1024, // 100 MB
    icon: '🎥'
  },
  audio: {
    extensions: ['mp3', 'wav', 'ogg', 'm4a', 'aac'],
    mimeTypes: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4'],
    maxSize: 25 * 1024 * 1024, // 25 MB
    icon: '🎵'
  },
  document: {
    extensions: ['pdf', 'doc', 'docx', 'txt', 'xls', 'xlsx', 'ppt', 'pptx'],
    mimeTypes: ['application/pdf', 'application/msword', 'text/plain'],
    maxSize: 50 * 1024 * 1024, // 50 MB
    icon: '📄'
  }
};

/**
 * Détecte le type de média à partir d'un fichier
 */
const detectMediaType = (file) => {
  const fileName = file.name.toLowerCase();
  const mimeType = file.type.toLowerCase();
  
  for (const [type, config] of Object.entries(MEDIA_CONFIG)) {
    // Vérification par extension
    const hasExtension = config.extensions.some(ext => fileName.endsWith(`.${ext}`));
    // Vérification par MIME type
    const hasMimeType = config.mimeTypes.some(mime => mimeType.includes(mime));
    
    if (hasExtension || hasMimeType) {
      return type;
    }
  }
  
  return 'file'; // Type par défaut
};

/**
 * Valide un fichier avant upload
 */
const validateFile = (file) => {
  const errors = [];
  
  if (!file) {
    errors.push('Aucun fichier sélectionné');
    return { valid: false, errors };
  }
  
  const mediaType = detectMediaType(file);
  const config = MEDIA_CONFIG[mediaType];
  
  if (!config) {
    // Fichier générique, on accepte jusqu'à 50MB
    if (file.size > 50 * 1024 * 1024) {
      errors.push('Fichier trop volumineux (max 50 MB)');
    }
    return { valid: errors.length === 0, errors, mediaType: 'file' };
  }
  
  // Vérification de la taille
  if (file.size > config.maxSize) {
    const maxSizeMB = (config.maxSize / (1024 * 1024)).toFixed(0);
    errors.push(`${config.icon} Fichier trop volumineux (max ${maxSizeMB} MB)`);
  }
  
  // Vérification de l'extension
  const extension = file.name.split('.').pop().toLowerCase();
  if (!config.extensions.includes(extension)) {
    errors.push(`${config.icon} Format non supporté (.${extension})`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
    mediaType,
    config
  };
};

/**
 * Compresse une image avant upload
 */
const compressImage = async (file, maxWidth = 1920, quality = 0.8) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        // Redimensionner si nécessaire
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (blob) => {
            resolve(new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now()
            }));
          },
          'image/jpeg',
          quality
        );
      };
      
      img.onerror = reject;
      img.src = e.target.result;
    };
    
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * Crée une miniature pour une vidéo
 */
const createVideoThumbnail = (file) => {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    
    video.preload = 'metadata';
    video.muted = true;
    
    video.onloadedmetadata = () => {
      video.currentTime = Math.min(2, video.duration / 2); // 2 secondes ou milieu
    };
    
    video.onseeked = () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);
      
      canvas.toBlob((blob) => {
        resolve(URL.createObjectURL(blob));
      }, 'image/jpeg', 0.7);
    };
    
    video.onerror = () => resolve(null);
    video.src = URL.createObjectURL(file);
  });
};

/**
 * Formatte la taille d'un fichier
 */
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Extrait les métadonnées d'un fichier média
 */
const extractMediaMetadata = async (file) => {
  const mediaType = detectMediaType(file);
  
  const metadata = {
    name: file.name,
    size: file.size,
    type: mediaType,
    mimeType: file.type,
    lastModified: file.lastModified
  };
  
  // Métadonnées spécifiques aux images
  if (mediaType === 'image') {
    try {
      const dimensions = await getImageDimensions(file);
      metadata.width = dimensions.width;
      metadata.height = dimensions.height;
    } catch (e) {
      console.error('Erreur extraction dimensions image:', e);
    }
  }
  
  // Métadonnées spécifiques aux vidéos
  if (mediaType === 'video') {
    try {
      const videoMeta = await getVideoMetadata(file);
      metadata.duration = videoMeta.duration;
      metadata.width = videoMeta.width;
      metadata.height = videoMeta.height;
      metadata.thumbnail = await createVideoThumbnail(file);
    } catch (e) {
      console.error('Erreur extraction métadonnées vidéo:', e);
    }
  }
  
  // Métadonnées spécifiques aux audios
  if (mediaType === 'audio') {
    try {
      const audioDuration = await getAudioDuration(file);
      metadata.duration = audioDuration;
    } catch (e) {
      console.error('Erreur extraction durée audio:', e);
    }
  }
  
  return metadata;
};

/**
 * Obtient les dimensions d'une image
 */
const getImageDimensions = (file) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
};

/**
 * Obtient les métadonnées d'une vidéo
 */
const getVideoMetadata = (file) => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    
    video.onloadedmetadata = () => {
      resolve({
        duration: video.duration,
        width: video.videoWidth,
        height: video.videoHeight
      });
    };
    
    video.onerror = reject;
    video.src = URL.createObjectURL(file);
  });
};

/**
 * Obtient la durée d'un fichier audio
 */
const getAudioDuration = (file) => {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    audio.preload = 'metadata';
    
    audio.onloadedmetadata = () => {
      resolve(audio.duration);
    };
    
    audio.onerror = reject;
    audio.src = URL.createObjectURL(file);
  });
};

/**
 * Upload un média avec progression
 */
const uploadMedia = async (
  token,
  file,
  recipientId,
  options = {}
) => {
  const {
    onProgress = () => {},
    compress = true,
    maxImageWidth = 1920,
    imageQuality = 0.8
  } = options;
  
  // 1. Validation
  const validation = validateFile(file);
  if (!validation.valid) {
    throw new Error(validation.errors.join(', '));
  }
  
  // 2. Compression des images si activée
  let fileToUpload = file;
  if (compress && validation.mediaType === 'image') {
    try {
      onProgress({ stage: 'compressing', progress: 0 });
      fileToUpload = await compressImage(file, maxImageWidth, imageQuality);
      console.log('🗜️ Image compressée:', {
        avant: formatFileSize(file.size),
        après: formatFileSize(fileToUpload.size),
        gain: `${((1 - fileToUpload.size / file.size) * 100).toFixed(1)}%`
      });
    } catch (e) {
      console.warn('⚠️ Erreur compression, envoi du fichier original:', e);
      fileToUpload = file;
    }
  }
  
  // 3. Extraction des métadonnées
  onProgress({ stage: 'extracting-metadata', progress: 10 });
  const metadata = await extractMediaMetadata(fileToUpload);
  
  // 4. Préparation FormData
  const formData = new FormData();
  formData.append('file', fileToUpload);
  formData.append('recipientId', recipientId);
  formData.append('metadata', JSON.stringify(metadata));
  
  // 5. Upload avec progression
  onProgress({ stage: 'uploading', progress: 20 });
  
  try {
    const response = await API.uploadFile(token, formData, {
      onUploadProgress: (progressEvent) => {
        const { percentage } = progressEvent;
        onProgress({ 
          stage: 'uploading', 
          progress: 20 + (percentage * 0.8) // 20-100%
        });
      }
    });
    
    onProgress({ stage: 'complete', progress: 100 });
    
    // ✅ Support de différents formats de réponse
    const uploadedUrl = response.url || response.secure_url || response.data?.url;
    
    if (!uploadedUrl) {
      throw new Error('URL du fichier introuvable dans la réponse du serveur');
    }
    
    return {
      success: true,
      url: uploadedUrl,
      type: validation.mediaType,
      metadata,
      response
    };
    
  } catch (error) {
    console.error('❌ Erreur upload:', error);
    throw new Error(`Erreur lors de l'upload: ${error.message}`);
  }
};

/**
 * Envoie un message avec média
 */
const sendMediaMessage = async (
  token,
  socket,
  {
    file,
    recipientId,
    content = '',
    onProgress = () => {}
  }
) => {
  try {
    // 1. Upload du média
    const uploadResult = await uploadMedia(token, file, recipientId, { onProgress });
    
    // 2. Envoi du message via socket
    if (socket?.connected) {
      const messageData = {
        recipientId,
        content,
        type: uploadResult.type,
        file: uploadResult.url,
        metadata: uploadResult.metadata
      };
      
      socket.emit('sendMessage', messageData);
      
      return {
        success: true,
        ...uploadResult,
        messageData
      };
    } else {
      throw new Error('Socket non connecté');
    }
    
  } catch (error) {
    console.error('❌ Erreur envoi message média:', error);
    throw error;
  }
};

/**
 * Enregistre et envoie un message vocal
 */
const sendVoiceMessage = async (
  token,
  socket,
  {
    audioBlob,
    recipientId,
    onProgress = () => {}
  }
) => {
  try {
    // Conversion du Blob en File
    const audioFile = new File(
      [audioBlob],
      `voice-${Date.now()}.wav`,
      { type: 'audio/wav' }
    );
    
    return await sendMediaMessage(token, socket, {
      file: audioFile,
      recipientId,
      content: '',
      onProgress
    });
    
  } catch (error) {
    console.error('❌ Erreur envoi message vocal:', error);
    throw error;
  }
};

// Export par défaut
const MediaService = {
  detectMediaType,
  validateFile,
  compressImage,
  createVideoThumbnail,
  formatFileSize,
  extractMediaMetadata,
  uploadMedia,
  sendMediaMessage,
  sendVoiceMessage,
  MEDIA_CONFIG
};

export default MediaService;

// Exports nommés pour plus de flexibilité
export {
  detectMediaType,
  validateFile,
  compressImage,
  createVideoThumbnail,
  formatFileSize,
  extractMediaMetadata,
  uploadMedia,
  sendMediaMessage,
  sendVoiceMessage,
  MEDIA_CONFIG
};