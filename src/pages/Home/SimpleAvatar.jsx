// src/pages/Home/SimpleAvatar.jsx
import React, { useState } from "react";
import { getCloudinaryUrl } from "./mediaUtils";

const SimpleAvatar = ({ username, profilePhoto, size = 32 }) => {
  const [imageError, setImageError] = useState(false);

  const getInitials = (name) => {
    if (!name) return "?";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const getColorFromName = (name) => {
    if (!name) return "#f97316";
    const colors = [
      "#f97316", "#ef4444", "#8b5cf6", "#3b82f6",
      "#10b981", "#f59e0b", "#ec4899", "#6366f1"
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const photoUrl = profilePhoto && !imageError
    ? getCloudinaryUrl(profilePhoto, {
        width: size * 2,
        height: size * 2,
        crop: "fill",
        quality: 80,
        gravity: "face"
      })
    : null;

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={username}
        className="rounded-full object-cover border-2 border-orange-200"
        style={{ width: size, height: size }}
        onError={() => {
          console.log("❌ Erreur chargement avatar:", photoUrl);
          setImageError(true);
        }}
      />
    );
  }

  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-bold border-2 border-orange-200"
      style={{
        width: size,
        height: size,
        backgroundColor: getColorFromName(username),
        fontSize: size * 0.4,
      }}
    >
      {getInitials(username)}
    </div>
  );
};

export default SimpleAvatar;

