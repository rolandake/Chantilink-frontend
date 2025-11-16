// src/pages/Home/mediaUtils.jsx

const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "dlymdclhe";

/**
 * Génère l'URL Cloudinary avec transformations
 */
export const getCloudinaryUrl = (publicId, options = {}) => {
  if (!publicId) return null;

  console.log('🔍 [getCloudinaryUrl] Input:', publicId);

  // CAS 1: URL Cloudinary complète
  if (publicId.includes('res.cloudinary.com')) {
    console.log('✅ URL Cloudinary complète détectée');
    return publicId;
  }

  // CAS 2: URL HTTP complète
  if (publicId.startsWith('http://') || publicId.startsWith('https://')) {
    console.log('✅ URL externe détectée');
    return publicId;
  }

  // CAS 3: Ancien chemin local
  if (publicId.startsWith('uploads/') || publicId.startsWith('/uploads/')) {
    const base = import.meta.env.VITE_API_URL || "http://localhost:5000";
    const cleanPath = publicId.startsWith('/') ? publicId : `/${publicId}`;
    console.log('📁 Ancien chemin local:', `${base}${cleanPath}`);
    return `${base}${cleanPath}`;
  }

  // CAS 4: PublicId Cloudinary
  let cleanPublicId = publicId.trim().replace(/^\/+/, '');
  const isVideoCheck = cleanPublicId.includes('/video/') || /\.(mp4|webm|mov)$/i.test(cleanPublicId);
  
  const baseUrl = isVideoCheck 
    ? `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/video/upload/`
    : `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/`;

  const transformations = [];
  if (options.width) transformations.push(`w_${options.width}`);
  if (options.height) transformations.push(`h_${options.height}`);
  if (options.crop) transformations.push(`c_${options.crop}`);
  if (options.quality) transformations.push(`q_${options.quality}`);
  if (options.format) transformations.push(`f_${options.format}`);
  if (options.gravity) transformations.push(`g_${options.gravity}`);

  const transformStr = transformations.length > 0 ? transformations.join(',') + '/' : '';
  const finalUrl = `${baseUrl}${transformStr}${cleanPublicId}`;
  
  console.log('✅ URL Cloudinary générée:', finalUrl);
  return finalUrl;
};

/**
 * Extrait les URLs des médias d'un post
 */
export const getMediaUrls = (media) => {
  if (!media) {
    console.log('⚠️ Aucun média dans le post');
    return [];
  }
  
  const medias = Array.isArray(media) ? media : [media];
  console.log('📸 Traitement de', medias.length, 'média(s):', medias);
  
  return medias
    .map((m, index) => {
      let mediaId = typeof m === "string" ? m : m?.url || m?.path || m?.location || m?.publicId;
      
      if (!mediaId) {
        console.warn(`⚠️ Média ${index} vide ou invalide:`, m);
        return null;
      }

      console.log(`🖼️ Média ${index} original:`, mediaId);
      const cloudinaryUrl = getCloudinaryUrl(mediaId);
      
      if (!cloudinaryUrl) {
        console.error(`❌ Impossible de générer l'URL pour:`, mediaId);
        return null;
      }

      console.log(`✅ URL finale média ${index}:`, cloudinaryUrl);
      return cloudinaryUrl;
    })
    .filter(Boolean);
};

/**
 * Vérifie si une URL est une vidéo
 */
export const isVideo = (url) => {
  return /\.(mp4|webm|mov)$/i.test(url) || url.includes('/video/upload/');
};

