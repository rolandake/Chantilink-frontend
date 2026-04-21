// 📁 src/pages/Home/mediaUtils.jsx
// ✅ MIGRATION R2 COMPLÈTE — aucune référence Cloudinary
// ✅ getVideoThumbnail enrichi : postData.thumbnail en priorité (ffmpeg back-end)
// ✅ getCloudinaryUrl renommé logiquement mais gardé pour rétrocompat (alias exporté)
// ✅ Logs DEV conservés pour débogage

const R2_PUBLIC_URL = (import.meta.env.VITE_R2_PUBLIC_URL || "").replace(/\/+$/, "");
const API_BASE      = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/api$/, "");

if (import.meta.env.DEV && !R2_PUBLIC_URL) {
  console.error("❌ [mediaUtils] VITE_R2_PUBLIC_URL est vide ! Vérifiez votre .env frontend.");
}

/**
 * getMediaUrl — résout n'importe quel identifiant média vers une URL absolue.
 *
 * Ordre de résolution :
 *   1. URL complète (http/https) → retournée TELLE QUELLE (évite le double-préfixage)
 *   2. Chemin local /uploads/…  → préfixé par API_BASE (anciens uploads pré-migration)
 *   3. Clé R2 relative (posts/uuid.jpg) → préfixée par R2_PUBLIC_URL
 */
export const getMediaUrl = (publicId, _options = {}) => {
  if (!publicId) return null;

  if (import.meta.env.DEV) {
    console.log("🔍 [getMediaUrl] Input :", publicId);
  }

  // CAS 1 : URL absolue → retour direct (R2, Cloudinary legacy, autre CDN)
  if (publicId.startsWith("http://") || publicId.startsWith("https://")) {
    if (import.meta.env.DEV) console.log("🌐 URL absolue conservée :", publicId);
    return publicId;
  }

  // CAS 2 : Chemin local (anciens uploads avant migration R2)
  if (publicId.startsWith("/uploads/") || publicId.startsWith("uploads/")) {
    const cleanPath = publicId.startsWith("/") ? publicId : `/${publicId}`;
    const url = `${API_BASE}${cleanPath}`;
    if (import.meta.env.DEV) console.log("📁 Chemin local :", url);
    return url;
  }

  // CAS 3 : Clé R2 relative (ex: posts/uuid.jpg)
  if (!R2_PUBLIC_URL) {
    console.warn("⚠️  VITE_R2_PUBLIC_URL non défini — impossible de construire l'URL R2");
    return null;
  }
  const url = `${R2_PUBLIC_URL}/${publicId.replace(/^\/+/, "")}`;
  if (import.meta.env.DEV) console.log("✅ URL R2 générée :", url);
  return url;
};

/**
 * Alias rétrocompat — à utiliser si des fichiers importent encore getCloudinaryUrl.
 * Pointe vers getMediaUrl, aucune logique Cloudinary.
 */
export const getCloudinaryUrl = getMediaUrl;

/**
 * getMediaUrls — extrait les URLs médias d'un post.
 * Gère : string, tableau, objets {url, path, location, publicId}.
 */
export const getMediaUrls = (media) => {
  if (!media) {
    if (import.meta.env.DEV) console.log("⚠️ Aucun média dans le post");
    return [];
  }
  const medias = Array.isArray(media) ? media : [media];
  if (import.meta.env.DEV) console.log("📸 Traitement de", medias.length, "média(s)");

  return medias
    .map((m, index) => {
      const mediaId =
        typeof m === "string"
          ? m
          : m?.url || m?.path || m?.location || m?.publicId || null;

      if (!mediaId) {
        if (import.meta.env.DEV) console.warn(`⚠️ Média ${index} vide :`, m);
        return null;
      }

      const url = getMediaUrl(mediaId);
      if (!url) {
        if (import.meta.env.DEV) console.error(`❌ URL impossible pour :`, mediaId);
        return null;
      }

      if (import.meta.env.DEV) console.log(`✅ URL finale média ${index} :`, url);
      return url;
    })
    .filter(Boolean);
};

/** Vérifie si une URL pointe vers une vidéo. */
export const isVideo = (url) =>
  !!url && /\.(mp4|webm|mov|avi)$/i.test(url.split("?")[0]);

/** Vérifie si une URL est une image. */
export const isImage = (url) =>
  !!url && /\.(jpg|jpeg|png|gif|webp|avif|svg)$/i.test(url.split("?")[0]);

/**
 * getVideoThumbnail — thumbnail depuis une URL vidéo ou les métadonnées du post.
 *
 * ✅ CORRIGÉ pour R2 :
 *   R2 ne génère pas de thumbnails automatiquement.
 *   La source fiable est postData.thumbnail (généré côté back-end via ffmpeg
 *   au moment de l'upload, stocké dans R2 sous thumbnails/<uuid>.jpg,
 *   persisté dans le champ thumbnail du document Post en base).
 *
 *   Fallback YouTube uniquement pour les vidéos embarquées (embed YouTube).
 *   Les vidéos R2 natives sans thumbnail back-end retournent null.
 *
 * @param {string} videoUrl   - URL de la vidéo
 * @param {object} postData   - Document post complet (optionnel)
 * @returns {string|null}
 */
export const getVideoThumbnail = (videoUrl, postData = null) => {
  if (!videoUrl) return null;

  // Priorité 1 : thumbnail pré-généré (back-end ffmpeg → R2)
  if (postData?.thumbnail) return postData.thumbnail;

  // Priorité 2 : YouTube — thumbnail public
  const ytMatch = videoUrl.match(
    /(?:youtube\.com\/embed\/|youtu\.be\/|youtube\.com\/watch\?(?:.*&)?v=)([a-zA-Z0-9_-]{11})/
  );
  if (ytMatch) return `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`;

  // Priorité 3 : Pexels — API publique
  if (videoUrl.includes("videos.pexels.com")) {
    const m = videoUrl.match(/video-files\/(\d+)\//);
    if (m) return `https://images.pexels.com/videos/${m[1]}/pictures/preview-0.jpg`;
  }

  // Priorité 4 : Pixabay — dérivation d'URL
  if (videoUrl.includes("cdn.pixabay.com/video")) {
    const t = videoUrl
      .replace("_large.mp4",  "_tiny.jpg")
      .replace("_medium.mp4", "_tiny.jpg")
      .replace("_small.mp4",  "_tiny.jpg");
    if (t !== videoUrl) return t;
  }

  // R2 natif sans thumbnail back-end → pas de poster
  return null;
};