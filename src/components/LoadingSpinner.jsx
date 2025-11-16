// src/components/LoadingSpinner.jsx
import React from 'react';
import { motion } from 'framer-motion';

const LoadingSpinner = ({ 
  size = 'md', 
  color = 'orange',
  fullScreen = false,
  message = 'Chargement...'
}) => {
  // Tailles disponibles
  const sizes = {
    xs: 'w-4 h-4',
    sm: 'w-6 h-6',
    md: 'w-10 h-10',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24',
  };

  // Couleurs disponibles
  const colors = {
    orange: 'border-orange-500',
    blue: 'border-blue-500',
    purple: 'border-purple-500',
    pink: 'border-pink-500',
    green: 'border-green-500',
  };

  const spinnerClass = `${sizes[size]} border-4 ${colors[color]} border-t-transparent rounded-full`;

  // Version plein écran
  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-gradient-to-br from-orange-50 via-white to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="text-center">
          {/* Logo animé */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="mb-8"
          >
            <div className="relative w-32 h-32 mx-auto">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-400 via-orange-500 to-orange-600 rounded-3xl flex items-center justify-center text-white font-bold text-5xl shadow-2xl">
                C
              </div>
              {/* Halo pulsant */}
              <motion.div
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.5, 0.8, 0.5],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="absolute inset-0 bg-gradient-to-br from-orange-400 to-pink-600 rounded-3xl blur-xl"
              />
            </div>
          </motion.div>

          {/* Spinner */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className={`${sizes.lg} ${colors.orange} border-t-transparent rounded-full mx-auto mb-6`}
          />

          {/* Message */}
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-gray-700 dark:text-gray-300 font-semibold text-lg"
          >
            {message}
          </motion.p>

          {/* Points animés */}
          <div className="flex justify-center gap-2 mt-4">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                animate={{
                  y: [0, -10, 0],
                }}
                transition={{
                  duration: 0.6,
                  repeat: Infinity,
                  delay: i * 0.15,
                  ease: "easeInOut",
                }}
                className="w-2 h-2 bg-gradient-to-r from-orange-500 to-pink-500 rounded-full"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Version inline simple
  return (
    <div className="flex items-center justify-center p-4">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        className={spinnerClass}
      />
    </div>
  );
};

// Variante avec texte
export const LoadingSpinnerWithText = ({ message = 'Chargement...', size = 'md' }) => {
  return (
    <div className="flex flex-col items-center justify-center gap-4 p-8">
      <LoadingSpinner size={size} />
      <p className="text-gray-600 dark:text-gray-400 text-sm font-medium animate-pulse">
        {message}
      </p>
    </div>
  );
};

// Variante mini pour les boutons
export const ButtonSpinner = ({ size = 'xs', color = 'white' }) => {
  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      className={`${
        size === 'xs' ? 'w-4 h-4' : 'w-5 h-5'
      } border-2 border-current border-t-transparent rounded-full`}
    />
  );
};

// Skeleton loader pour les cartes
export const SkeletonCard = ({ className = '' }) => {
  return (
    <div className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded-2xl ${className}`}>
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-300 dark:bg-gray-600 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-1/3" />
            <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-1/4" />
          </div>
        </div>
        <div className="space-y-2">
          <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded" />
          <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-5/6" />
        </div>
        <div className="h-48 bg-gray-300 dark:bg-gray-600 rounded-xl" />
      </div>
    </div>
  );
};

export default LoadingSpinner;
