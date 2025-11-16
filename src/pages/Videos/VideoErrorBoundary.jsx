// src/pages/videos/VideoErrorBoundary.jsx
import React from 'react';
import { motion } from 'framer-motion';
import { FaExclamationTriangle, FaRedo, FaVideo } from 'react-icons/fa';

class VideoErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
    };
  }

  static getDerivedStateFromError(error) {
    // Met à jour le state pour afficher l'UI de secours
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log l'erreur pour le debug
    console.error('❌ [VideoErrorBoundary] Erreur capturée:', {
      error: error.toString(),
      errorInfo,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
    });

    this.setState(prevState => ({
      error,
      errorInfo,
      errorCount: prevState.errorCount + 1,
    }));

    // Vous pouvez aussi envoyer l'erreur à un service de monitoring
    // comme Sentry, LogRocket, etc.
    // logErrorToService(error, errorInfo);
  }

  handleRetry = () => {
    // Réinitialise l'état d'erreur et force un re-render
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleSkip = () => {
    // Si une fonction onSkip est fournie, l'appelle
    if (this.props.onSkip) {
      this.props.onSkip();
    }
    this.handleRetry();
  };

  render() {
    if (this.state.hasError) {
      // UI de secours personnalisée
      return (
        <ErrorFallbackUI
          error={this.state.error}
          errorCount={this.state.errorCount}
          onRetry={this.handleRetry}
          onSkip={this.handleSkip}
          showSkip={!!this.props.onSkip}
        />
      );
    }

    return this.props.children;
  }
}

// ========================================
// INTERFACE DE SECOURS EN CAS D'ERREUR
// ========================================
const ErrorFallbackUI = ({ error, errorCount, onRetry, onSkip, showSkip }) => {
  const errorMessage = error?.message || "Une erreur inattendue s'est produite";
  const isVideoError = errorMessage.toLowerCase().includes('video') || 
                       errorMessage.toLowerCase().includes('media');

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="h-full w-full flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-black"
    >
      <div className="text-center px-6 py-12 max-w-md">
        {/* Icône animée */}
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ 
            type: "spring", 
            stiffness: 200, 
            damping: 15,
            delay: 0.1 
          }}
          className="mb-6 flex justify-center"
        >
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-pink-600 rounded-full blur-2xl opacity-50 animate-pulse" />
            <div className="relative bg-gradient-to-br from-gray-800 to-gray-900 rounded-full p-6 border-4 border-orange-500/30">
              {isVideoError ? (
                <FaVideo className="text-5xl text-orange-500" />
              ) : (
                <FaExclamationTriangle className="text-5xl text-orange-500" />
              )}
            </div>
          </div>
        </motion.div>

        {/* Message principal */}
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-2xl font-bold text-white mb-3"
        >
          {isVideoError ? 'Erreur de lecture vidéo' : 'Oups, une erreur !'}
        </motion.h2>

        {/* Description */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-gray-400 mb-6 text-sm"
        >
          {isVideoError 
            ? 'La vidéo ne peut pas être chargée. Vérifiez votre connexion ou réessayez.'
            : 'Quelque chose s\'est mal passé. Vous pouvez réessayer ou passer à la suivante.'}
        </motion.p>

        {/* Détails techniques (mode développement uniquement) */}
        {process.env.NODE_ENV === 'development' && (
          <motion.details
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mb-6 text-left bg-black/40 rounded-xl p-4 border border-red-500/30"
          >
            <summary className="text-red-400 text-xs font-mono cursor-pointer hover:text-red-300 transition-colors">
              Détails techniques (dev)
            </summary>
            <pre className="mt-3 text-[10px] text-gray-400 overflow-x-auto whitespace-pre-wrap break-all">
              {errorMessage}
              {errorCount > 1 && (
                <div className="mt-2 text-yellow-400">
                  ⚠️ Cette erreur s'est produite {errorCount} fois
                </div>
              )}
            </pre>
          </motion.details>
        )}

        {/* Compteur d'erreurs */}
        {errorCount > 1 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 }}
            className="mb-6 inline-flex items-center gap-2 px-4 py-2 bg-yellow-500/20 border border-yellow-500/30 rounded-full text-yellow-400 text-xs font-semibold"
          >
            <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
            Erreur persistante ({errorCount}x)
          </motion.div>
        )}

        {/* Boutons d'action */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="flex flex-col sm:flex-row gap-3 justify-center"
        >
          {/* Bouton Réessayer */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onRetry}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-pink-600 text-white font-bold rounded-full hover:from-orange-600 hover:to-pink-700 transition-all shadow-lg hover:shadow-2xl"
          >
            <FaRedo className={errorCount > 2 ? 'animate-spin' : ''} />
            <span>Réessayer</span>
          </motion.button>

          {/* Bouton Passer (si onSkip fourni) */}
          {showSkip && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onSkip}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-white/10 backdrop-blur-md text-white font-bold rounded-full hover:bg-white/20 transition-all border border-white/20"
            >
              <span>Vidéo suivante</span>
              <span>→</span>
            </motion.button>
          )}
        </motion.div>

        {/* Message d'encouragement */}
        {errorCount > 3 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="mt-6 text-gray-500 text-xs italic"
          >
            💡 Si le problème persiste, essayez de rafraîchir la page
          </motion.p>
        )}
      </div>
    </motion.div>
  );
};

// ========================================
// ERROR BOUNDARY POUR UNE SEULE VIDÉO
// ========================================
export class SingleVideoErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('❌ [SingleVideoErrorBoundary] Erreur vidéo:', {
      videoId: this.props.videoId,
      error: error.toString(),
      errorInfo,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full w-full flex items-center justify-center bg-gray-900">
          <div className="text-center px-4">
            <FaVideo className="text-4xl text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">
              Cette vidéo ne peut pas être affichée
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// ========================================
// HOOK POUR GÉRER LES ERREURS VIDÉO
// ========================================
export const useVideoErrorHandler = () => {
  const [videoErrors, setVideoErrors] = React.useState(new Map());

  const reportError = React.useCallback((videoId, error) => {
    console.error(`❌ Erreur vidéo ${videoId}:`, error);
    setVideoErrors(prev => {
      const newMap = new Map(prev);
      const currentCount = newMap.get(videoId) || 0;
      newMap.set(videoId, currentCount + 1);
      return newMap;
    });
  }, []);

  const clearError = React.useCallback((videoId) => {
    setVideoErrors(prev => {
      const newMap = new Map(prev);
      newMap.delete(videoId);
      return newMap;
    });
  }, []);

  const getErrorCount = React.useCallback((videoId) => {
    return videoErrors.get(videoId) || 0;
  }, [videoErrors]);

  const hasError = React.useCallback((videoId) => {
    return videoErrors.has(videoId);
  }, [videoErrors]);

  return {
    reportError,
    clearError,
    getErrorCount,
    hasError,
    errorCount: videoErrors.size,
  };
};

export default VideoErrorBoundary;
