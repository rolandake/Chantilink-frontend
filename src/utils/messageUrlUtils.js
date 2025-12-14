// ============================================
// 📁 src/utils/messageUrlUtils.js
// Utilitaire partagé pour construire les URLs de médias
// ============================================

const CLOUD_NAME = "dlymdclhe";
const IMG_BASE = `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/`;
const VID_BASE = `https://res.cloudinary.com/${CLOUD_NAME}/video/upload/`;
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

/**
 * Construit l'URL complète d'un média à partir d'un message
 * @param {Object} msg - Le message contenant les données du média
 * @returns {string|null} - L'URL complète ou null si introuvable
 */
export const getMessageUrl = (msg) => {
  // 1. EXTRACTION BRUTE - On cherche dans TOUS les champs possibles
  let rawFile = 
    msg.file || 
    msg.url || 
    msg.mediaUrl || 
    msg.secure_url || 
    msg.audio || 
    msg.image || 
    msg.video ||
    msg.media ||
    null;

  // Gestion cas objet (ex: file: { url: "..." })
  if (rawFile && typeof rawFile === 'object') {
    rawFile = rawFile.url || rawFile.secure_url || rawFile.path || null;
  }

  // ✅ Vérification stricte pour éviter les valeurs falsy
  if (!rawFile || rawFile === null || rawFile === 'null' || rawFile === '') {
    // ✅ ON NE LOG PLUS : Les médias manquants sont normaux pour les vieux messages
    return null;
  }

  // 2. SI C'EST DÉJÀ UNE URL COMPLÈTE
  if (typeof rawFile === 'string' && (rawFile.startsWith('http') || rawFile.startsWith('blob:'))) {
    return rawFile;
  }

  // 3. SI C'EST UN FICHIER LOCAL (/uploads/...)
  if (typeof rawFile === 'string' && (rawFile.startsWith('/uploads') || rawFile.startsWith('uploads/'))) {
    return `${API_URL}/${rawFile.replace(/^\/+/, '')}`;
  }

  // 4. SI C'EST UN ID CLOUDINARY (reconstruction intelligente)
  if (typeof rawFile === 'string') {
    const lower = rawFile.toLowerCase();
    
    // Détection du type de média
    const isVideo = 
      msg.type === 'video' || 
      /\.(mp4|mov|webm|avi|mkv)$/i.test(lower);
    
    const isAudio = 
      msg.type === 'audio' || 
      /\.(mp3|wav|ogg|m4a)$/i.test(lower);

    // Audio = traité comme vidéo par Cloudinary
    const base = (isVideo || isAudio) ? VID_BASE : IMG_BASE;
    
    // URL optimisée avec transformations Cloudinary
    return `${base}q_auto,f_auto/${rawFile}`;
  }

  // ✅ Format non reconnu = on retourne null silencieusement
  return null;
};

/**
 * Normalise un message reçu via socket pour garantir la cohérence des URLs
 * @param {Object} rawMsg - Message brut du serveur
 * @returns {Object} - Message normalisé avec URLs complètes
 */
export const normalizeMessage = (rawMsg) => {
  // Extraction de la source brute
  const rawFile = 
    rawMsg.file || 
    rawMsg.url || 
    rawMsg.mediaUrl || 
    rawMsg.secure_url || 
    rawMsg.audio || 
    rawMsg.image || 
    rawMsg.video ||
    null;

  // ✅ Filtrage des valeurs null explicites
  const cleanFile = (rawFile && rawFile !== 'null' && rawFile !== '') ? rawFile : null;

  // Construction de l'URL finale
  const finalUrl = getMessageUrl(rawMsg);

  // Détection intelligente du type
  let detectedType = rawMsg.type || 'text';
  
  if (finalUrl) {
    const lower = finalUrl.toLowerCase();
    
    if (/\.(mp4|mov|webm|avi)$/i.test(lower) || lower.includes('/video/upload')) {
      detectedType = 'video';
    } else if (/\.(mp3|wav|ogg|m4a)$/i.test(lower) || lower.includes('/audio/')) {
      detectedType = 'audio';
    } else if (/\.(jpg|jpeg|png|gif|webp)$/i.test(lower) || lower.includes('/image/upload')) {
      detectedType = 'image';
    } else if (!detectedType || detectedType === 'text') {
      detectedType = 'file';
    }
  }

  // Construction du message normalisé
  const normalized = {
    ...rawMsg,
    _id: rawMsg._id || `msg-${Date.now()}-${Math.random()}`,
    type: detectedType,
    content: rawMsg.content || rawMsg.text || "",
  };

  // On ajoute les URLs UNIQUEMENT si elles existent
  if (finalUrl) {
    normalized.file = finalUrl;
    normalized.url = finalUrl;
    
    // On ajoute les propriétés spécifiques selon le type
    if (detectedType === 'image') normalized.image = finalUrl;
    else if (detectedType === 'video') normalized.video = finalUrl;
    else if (detectedType === 'audio') normalized.audio = finalUrl;
  }

  return normalized;
};

/**
 * Détecte automatiquement le type de média depuis une URL ou un nom de fichier
 * @param {string} urlOrFilename - URL ou nom de fichier
 * @returns {string} - Type détecté: 'image', 'video', 'audio', ou 'file'
 */
export const detectMediaType = (urlOrFilename) => {
  if (!urlOrFilename) return 'file';
  
  const lower = urlOrFilename.toLowerCase();
  
  if (/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(lower)) return 'image';
  if (/\.(mp4|mov|webm|avi|mkv|flv)$/i.test(lower)) return 'video';
  if (/\.(mp3|wav|ogg|m4a|flac|aac)$/i.test(lower)) return 'audio';
  
  return 'file';
};