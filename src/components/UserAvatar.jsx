// src/components/UserAvatar.jsx
import React, { useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';

/**
 * Composant Avatar utilisateur avec fallback intelligent
 * Gère automatiquement les cas où l'utilisateur n'a pas de photo
 */
const UserAvatar = ({
  user,
  src,
  alt,
  size = 'md',
  className = '',
  showBadge = false,
  showOnline = false,
  borderColor,
  onClick,
  animate = true,
}) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  // ✅ Extraction des données utilisateur avec protection
  const userData = useMemo(() => {
    if (!user) return {};
    if (typeof user === 'string') {
      return { _id: user, fullName: 'Utilisateur', email: '' };
    }
    return user;
  }, [user]);

  const {
    fullName = '',
    username = '',
    email = '',
    profilePhoto,
    profilePicture,
    avatar,
    isVerified = false,
    isPremium = false,
    role = 'user',
  } = userData;

  // ✅ URL de l'image avec validation stricte
  const imageUrl = useMemo(() => {
    const url = src || profilePhoto || profilePicture || avatar;
    
    // Ne retourner l'URL que si elle est valide
    if (!url || url === 'undefined' || url === 'null') return null;
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:')) {
      return url;
    }
    
    return null;
  }, [src, profilePhoto, profilePicture, avatar]);

  // ✅ Nom d'affichage
  const displayName = useMemo(() => {
    return fullName || username || email?.split('@')[0] || 'Utilisateur';
  }, [fullName, username, email]);

  // ✅ Initiales (max 2 lettres)
  const initials = useMemo(() => {
    const name = displayName.trim();
    const words = name.split(' ').filter(Boolean);
    
    if (words.length === 0) return '?';
    if (words.length === 1) {
      const word = words[0];
      return word.length >= 2 ? word.substring(0, 2).toUpperCase() : word[0].toUpperCase();
    }
    
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  }, [displayName]);

  // ✅ Couleur de fond consistante basée sur le nom
  const backgroundColor = useMemo(() => {
    const colors = [
      'from-pink-500 to-rose-500',
      'from-purple-500 to-indigo-500',
      'from-blue-500 to-cyan-500',
      'from-green-500 to-emerald-500',
      'from-yellow-500 to-orange-500',
      'from-red-500 to-pink-500',
      'from-indigo-500 to-purple-500',
      'from-cyan-500 to-blue-500',
      'from-emerald-500 to-teal-500',
      'from-orange-500 to-red-500',
    ];

    let hash = 0;
    for (let i = 0; i < displayName.length; i++) {
      hash = displayName.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  }, [displayName]);

  // ✅ Tailles
  const sizeClasses = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-lg',
    '2xl': 'w-20 h-20 text-xl',
    '3xl': 'w-24 h-24 text-2xl',
  };

  const badgeSizes = {
    xs: 'w-2 h-2 text-[6px]',
    sm: 'w-2.5 h-2.5 text-[7px]',
    md: 'w-3 h-3 text-[8px]',
    lg: 'w-3.5 h-3.5 text-[9px]',
    xl: 'w-4 h-4 text-[10px]',
    '2xl': 'w-5 h-5 text-xs',
    '3xl': 'w-6 h-6 text-sm',
  };

  const onlineSizes = {
    xs: 'w-1.5 h-1.5',
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3 h-3',
    xl: 'w-3.5 h-3.5',
    '2xl': 'w-4 h-4',
    '3xl': 'w-5 h-5',
  };

  // ✅ Badge
  const getBadgeColor = useCallback(() => {
    if (role === 'admin') return 'bg-red-500';
    if (isPremium) return 'bg-gradient-to-r from-yellow-400 to-orange-500';
    if (isVerified) return 'bg-blue-500';
    return '';
  }, [role, isPremium, isVerified]);

  const getBadgeIcon = useCallback(() => {
    if (role === 'admin') return '👑';
    if (isPremium) return '⭐';
    if (isVerified) return '✓';
    return '';
  }, [role, isPremium, isVerified]);

  // ✅ Gestion des erreurs d'image
  const handleImageError = useCallback(() => {
    console.warn('⚠️ Erreur chargement image avatar, fallback vers initiales');
    setImageError(true);
  }, []);

  const handleImageLoad = useCallback(() => {
    setImageLoaded(true);
  }, []);

  // ✅ Affichage conditionnel
  const shouldShowImage = imageUrl && !imageError;
  const shouldShowInitials = !shouldShowImage;

  const AvatarContent = () => (
    <div
      className={`
        relative inline-flex items-center justify-center flex-shrink-0
        ${sizeClasses[size]}
        rounded-full overflow-hidden
        ${borderColor ? `ring-2 ring-${borderColor}` : ''}
        ${onClick ? 'cursor-pointer hover:opacity-90' : ''}
        transition-all duration-200
        ${className}
      `}
      onClick={onClick}
      title={displayName}
    >
      {/* Image de profil */}
      {shouldShowImage && (
        <>
          {/* Skeleton pendant chargement */}
          {!imageLoaded && (
            <div className="absolute inset-0 bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800 animate-pulse" />
          )}
          
          <img
            src={imageUrl}
            alt={alt || displayName}
            className={`
              w-full h-full object-cover
              transition-opacity duration-300
              ${imageLoaded ? 'opacity-100' : 'opacity-0'}
            `}
            onLoad={handleImageLoad}
            onError={handleImageError}
            loading="lazy"
          />
        </>
      )}

      {/* Fallback: Initiales avec gradient */}
      {shouldShowInitials && (
        <div
          className={`
            w-full h-full flex items-center justify-center
            bg-gradient-to-br ${backgroundColor}
            text-white font-bold
            select-none
          `}
        >
          {initials}
        </div>
      )}

      {/* Badge vérification */}
      {showBadge && (isVerified || isPremium || role === 'admin') && (
        <div
          className={`
            absolute -bottom-0.5 -right-0.5
            ${badgeSizes[size]}
            ${getBadgeColor()}
            rounded-full
            flex items-center justify-center
            text-white font-bold
            ring-2 ring-white dark:ring-gray-900
            z-10
          `}
        >
          {getBadgeIcon()}
        </div>
      )}

      {/* Indicateur en ligne */}
      {showOnline && (
        <div
          className={`
            absolute -bottom-0.5 -right-0.5
            ${onlineSizes[size]}
            bg-green-500
            rounded-full
            ring-2 ring-white dark:ring-gray-900
            z-10
            animate-pulse
          `}
        />
      )}
    </div>
  );

  // ✅ Avec animation si demandée
  if (animate && onClick) {
    return (
      <motion.div
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 400, damping: 17 }}
      >
        <AvatarContent />
      </motion.div>
    );
  }

  return <AvatarContent />;
};

// ========================================
// COMPOSANT AVATAR GROUPE
// ========================================
export const GroupAvatar = ({ users = [], size = 'md', maxDisplay = 3, className = '' }) => {
  const displayUsers = users.slice(0, maxDisplay);
  const extraCount = Math.max(0, users.length - maxDisplay);

  const containerSizes = {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
    '2xl': 'w-20 h-20',
    '3xl': 'w-24 h-24',
  };

  if (displayUsers.length === 0) {
    return (
      <div className={`${containerSizes[size]} rounded-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center ${className}`}>
        <span className="text-gray-500 dark:text-gray-400 text-xs">?</span>
      </div>
    );
  }

  if (displayUsers.length === 1) {
    return <UserAvatar user={displayUsers[0]} size={size} className={className} />;
  }

  // Layout en grille 2x2
  return (
    <div className={`relative ${containerSizes[size]} ${className}`}>
      <div className="grid grid-cols-2 gap-0.5 w-full h-full rounded-full overflow-hidden border-2 border-white dark:border-gray-900">
        {displayUsers.map((user, idx) => (
          <div key={user?._id || idx} className="relative">
            <UserAvatar
              user={user}
              size="xs"
              className="w-full h-full"
              animate={false}
            />
          </div>
        ))}
        {extraCount > 0 && (
          <div className="bg-gradient-to-br from-orange-500 to-pink-600 flex items-center justify-center">
            <span className="text-white text-[8px] font-bold">+{extraCount}</span>
          </div>
        )}
      </div>
    </div>
  );
};

// ========================================
// COMPOSANT AVATAR AVEC NOM
// ========================================
export const UserAvatarWithName = ({ 
  user, 
  size = 'md', 
  showEmail = false, 
  onClick,
  className = '' 
}) => {
  const displayName = user?.fullName || user?.username || user?.email?.split('@')[0] || 'Utilisateur';
  const email = user?.email;

  return (
    <div 
      className={`flex items-center gap-3 ${onClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''} ${className}`}
      onClick={onClick}
    >
      <UserAvatar user={user} size={size} showBadge animate={!!onClick} />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">
          {displayName}
        </p>
        {showEmail && email && (
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {email}
          </p>
        )}
      </div>
    </div>
  );
};

export default UserAvatar;
