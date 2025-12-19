import React, { memo } from 'react';
import { motion } from 'framer-motion';

// Configuration centralisée pour réutilisation
const SIZES = {
  xs: 'w-4 h-4',
  sm: 'w-6 h-6',
  md: 'w-10 h-10',
  lg: 'w-16 h-16',
  xl: 'w-24 h-24',
};

const COLORS = {
  orange: 'border-orange-500',
  blue: 'border-blue-500',
  purple: 'border-purple-500',
  pink: 'border-pink-500',
  green: 'border-green-500',
};

// Animation constante réutilisée (optimisation mémoire)
const spinAnimation = {
  rotate: 360
};

const spinTransition = {
  duration: 1,
  repeat: Infinity,
  ease: "linear"
};

const LoadingSpinner = memo(({ 
  size = 'md', 
  color = 'orange',
  fullScreen = false,
  message = 'Chargement...'
}) => {
  const spinnerClass = `${SIZES[size]} border-4 ${COLORS[color]} border-t-transparent rounded-full`;

  // Version plein écran optimisée
  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-gradient-to-br from-orange-50 via-white to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="text-center">
          {/* Logo optimisé avec will-change */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="mb-8"
            style={{ willChange: 'transform, opacity' }}
          >
            <div className="relative w-28 h-28 mx-auto">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-400 via-orange-500 to-orange-600 rounded-3xl flex items-center justify-center text-white font-bold text-5xl shadow-2xl">
                C
              </div>
              {/* Halo optimisé */}
              <motion.div
                animate={{
                  scale: [1, 1.15, 1],
                  opacity: [0.4, 0.7, 0.4],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="absolute inset-0 bg-gradient-to-br from-orange-400 to-pink-600 rounded-3xl blur-xl"
                style={{ willChange: 'transform, opacity' }}
              />
            </div>
          </motion.div>

          {/* Spinner principal */}
          <motion.div
            animate={spinAnimation}
            transition={spinTransition}
            className={`${SIZES.lg} ${COLORS.orange} border-t-transparent rounded-full mx-auto mb-6`}
            style={{ willChange: 'transform' }}
          />

          {/* Message optimisé */}
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.3 }}
            className="text-gray-700 dark:text-gray-300 font-semibold text-lg"
          >
            {message}
          </motion.p>

          {/* Points animés optimisés */}
          <div className="flex justify-center gap-2 mt-4">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                animate={{ y: [0, -8, 0] }}
                transition={{
                  duration: 0.6,
                  repeat: Infinity,
                  delay: i * 0.15,
                  ease: "easeInOut",
                }}
                className="w-2 h-2 bg-gradient-to-r from-orange-500 to-pink-500 rounded-full"
                style={{ willChange: 'transform' }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Version inline ultra-légère
  return (
    <div className="flex items-center justify-center p-4">
      <motion.div
        animate={spinAnimation}
        transition={spinTransition}
        className={spinnerClass}
        style={{ willChange: 'transform' }}
      />
    </div>
  );
});

LoadingSpinner.displayName = 'LoadingSpinner';

// Variante avec texte optimisée
export const LoadingSpinnerWithText = memo(({ message = 'Chargement...', size = 'md' }) => {
  return (
    <div className="flex flex-col items-center justify-center gap-4 p-8">
      <LoadingSpinner size={size} />
      <p className="text-gray-600 dark:text-gray-400 text-sm font-medium animate-pulse">
        {message}
      </p>
    </div>
  );
});

LoadingSpinnerWithText.displayName = 'LoadingSpinnerWithText';

// Variante mini ultra-légère pour boutons
export const ButtonSpinner = memo(({ size = 'xs' }) => {
  return (
    <motion.div
      animate={spinAnimation}
      transition={spinTransition}
      className={`${size === 'xs' ? 'w-4 h-4' : 'w-5 h-5'} border-2 border-current border-t-transparent rounded-full`}
      style={{ willChange: 'transform' }}
    />
  );
});

ButtonSpinner.displayName = 'ButtonSpinner';

// Skeleton optimisé avec CSS pur (pas de JS)
export const SkeletonCard = memo(({ className = '' }) => {
  return (
    <div className={`bg-gray-200 dark:bg-gray-700 rounded-2xl overflow-hidden ${className}`}>
      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-300 dark:bg-gray-600 rounded-full animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-1/3 animate-pulse" />
            <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-1/4 animate-pulse" style={{ animationDelay: '0.1s' }} />
          </div>
        </div>
        {/* Content */}
        <div className="space-y-2">
          <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded animate-pulse" style={{ animationDelay: '0.2s' }} />
          <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-5/6 animate-pulse" style={{ animationDelay: '0.3s' }} />
        </div>
        {/* Image placeholder */}
        <div className="h-48 bg-gray-300 dark:bg-gray-600 rounded-xl animate-pulse" style={{ animationDelay: '0.4s' }} />
      </div>
    </div>
  );
});

SkeletonCard.displayName = 'SkeletonCard';

// Skeleton pour liste de posts (optimisation massive)
export const SkeletonPostList = memo(({ count = 3 }) => {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
});

SkeletonPostList.displayName = 'SkeletonPostList';

// Mini spinner pour les actions inline
export const InlineSpinner = memo(({ className = '' }) => {
  return (
    <motion.div
      animate={spinAnimation}
      transition={spinTransition}
      className={`w-4 h-4 border-2 border-current border-t-transparent rounded-full ${className}`}
      style={{ willChange: 'transform' }}
    />
  );
});

InlineSpinner.displayName = 'InlineSpinner';

// Pulse loader (alternative au spinner)
export const PulseLoader = memo(({ size = 'md', color = 'orange' }) => {
  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
  };

  const colorClasses = {
    orange: 'bg-orange-500',
    blue: 'bg-blue-500',
    purple: 'bg-purple-500',
  };

  return (
    <div className="flex items-center gap-2">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          animate={{
            scale: [1, 1.5, 1],
            opacity: [1, 0.5, 1],
          }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            delay: i * 0.2,
          }}
          className={`${sizeClasses[size]} ${colorClasses[color]} rounded-full`}
        />
      ))}
    </div>
  );
});

PulseLoader.displayName = 'PulseLoader';

// Progress bar pour chargements avec progression
export const ProgressBar = memo(({ progress = 0, showPercentage = true }) => {
  return (
    <div className="w-full">
      <div className="relative h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(progress, 100)}%` }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-orange-500 to-pink-500 rounded-full"
        />
      </div>
      {showPercentage && (
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-2 text-center">
          {Math.round(progress)}%
        </p>
      )}
    </div>
  );
});

ProgressBar.displayName = 'ProgressBar';

export default LoadingSpinner;