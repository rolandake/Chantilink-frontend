/**
 * AvatarWithFallback — Avatar universel avec fallback élégant
 *
 * Affiche la photo de profil ou un cercle avec l'initiale + dégradé
 * si aucune photo ou en cas d'erreur de chargement.
 *
 * Props :
 *  - src : URL de la photo (optionnel)
 *  - name : Nom complet pour extraire l'initiale
 *  - size : Taille en px (défaut: 40)
 *  - className : classes supplémentaires
 *  - isOnline : booléen pour le halo vert
 *  - style : styles additionnels
 */
import React, { useState, useCallback, useMemo, memo } from "react";

// Palette de couleurs pour les dégradés (basée sur le nom)
const GRADIENTS = [
  "linear-gradient(135deg, #f97316, #ea580c)",
  "linear-gradient(135deg, #3b82f6, #2563eb)",
  "linear-gradient(135deg, #22c55e, #16a34a)",
  "linear-gradient(135deg, #a855f7, #9333ea)",
  "linear-gradient(135deg, #ec4899, #db2777)",
  "linear-gradient(135deg, #06b6d4, #0891b2)",
  "linear-gradient(135deg, #eab308, #ca8a04)",
  "linear-gradient(135deg, #ef4444, #dc2626)",
  "linear-gradient(135deg, #14b8a6, #0d9488)",
  "linear-gradient(135deg, #6366f1, #4f46e5)",
];

function getGradient(name) {
  if (!name) return GRADIENTS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}

function getInitial(name) {
  if (!name) return "?";
  const clean = name.trim();
  if (clean.length === 0) return "?";
  // Prend la première lettre du nom
  return clean[0].toUpperCase();
}

const AvatarWithFallback = memo(({
  src,
  name = "?",
  size = 40,
  className = "",
  isOnline,
  style: externalStyle = {},
}) => {
  const [imgError, setImgError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const hasValidSrc = Boolean(src) && !imgError;

  const gradient = useMemo(() => getGradient(name), [name]);
  const initial = useMemo(() => getInitial(name), [name]);

  const handleError = useCallback(() => {
    setImgError(true);
  }, []);

  const handleLoad = useCallback(() => {
    setLoaded(true);
  }, []);

  const baseStyle = {
    width: size,
    height: size,
    borderRadius: "50%",
    flexShrink: 0,
    overflow: "hidden",
    position: "relative",
    ...externalStyle,
  };

  return (
    <div
      style={baseStyle}
      className={className}
    >
      {/* Image */}
      {hasValidSrc ? (
        <img
          src={src}
          alt={name || "Avatar"}
          onError={handleError}
          onLoad={handleLoad}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: loaded ? 1 : 0,
            transition: "opacity 0.2s ease",
          }}
        />
      ) : null}

      {/* Fallback : initiale avec dégradé */}
      {(!hasValidSrc || (!loaded && hasValidSrc)) && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: gradient,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: size * 0.42,
            fontWeight: 800,
            color: "#fff",
            lineHeight: 1,
            textShadow: "0 1px 2px rgba(0,0,0,0.2)",
            letterSpacing: "0.02em",
          }}
        >
          {initial}
        </div>
      )}

      {/* Halo vert "en ligne" */}
      {isOnline && (
        <div
          style={{
            position: "absolute",
            bottom: 0,
            right: 0,
            width: size * 0.3,
            height: size * 0.3,
            borderRadius: "50%",
            background: "#22c55e",
            border: `2px solid ${externalStyle?.background || "#0b0d10"}`,
            boxShadow: "0 0 0 1px rgba(34,197,94,0.3)",
          }}
        />
      )}
    </div>
  );
});

AvatarWithFallback.displayName = "AvatarWithFallback";

export default AvatarWithFallback;