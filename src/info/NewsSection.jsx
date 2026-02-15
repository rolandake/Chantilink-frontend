// 📁 src/info/NewsSection.jsx
// ✅ VERSION FINALE - Catégorie BTP = Génie Civil, Construction, Travaux Publics
// Lecture complète de l'article dans un modal avec scroll fonctionnel

import React, { useState, memo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  NewspaperIcon, 
  ClockIcon, 
  ArrowTopRightOnSquareIcon,
  SparklesIcon,
  XMarkIcon,
  ChevronLeftIcon,
  ShareIcon
} from '@heroicons/react/24/outline';

import { useNews } from '../hooks/useNews';
import { useDarkMode } from '../context/DarkModeContext';

// ============================================
// HELPERS PARTAGÉS
// ============================================
const getCategoryColor = (category) => {
  const colors = {
    genieCivil: 'from-orange-500 to-red-500',      // BTP, Construction
    sport: 'from-blue-500 to-cyan-500',
    politique: 'from-purple-500 to-pink-500',
    technologie: 'from-green-500 to-emerald-500',
    environnement: 'from-teal-500 to-green-600',
    general: 'from-gray-500 to-gray-600'
  };
  return colors[category] || colors.general;
};

const getCategoryLabel = (category) => {
  const labels = {
    genieCivil: '🏗️ Génie Civil & BTP',           // Construction, Bâtiment, Travaux Publics
    sport: '⚽ Sport',
    politique: '🏛️ Politique',
    technologie: '💻 Tech',
    environnement: '🌱 Environnement',
    general: '📰 Actualités'
  };
  return labels[category] || labels.general;
};

// ============================================
// LECTEUR D'ARTICLE COMPLET (MODAL)
// ============================================
const ArticleReader = memo(({ article, onClose }) => {
  const { isDarkMode } = useDarkMode();
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('fr-FR', { 
      weekday: 'long',
      day: 'numeric', 
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleShare = () => {
    if (navigator.share && article.url) {
      navigator.share({
        title: article.title,
        text: article.description,
        url: article.url
      }).catch(() => {
        navigator.clipboard.writeText(article.url);
        alert('Lien copié !');
      });
    } else if (article.url) {
      navigator.clipboard.writeText(article.url);
      alert('Lien copié dans le presse-papier !');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-end md:items-center justify-center"
      onClick={onClose}
      style={{ 
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)'
      }}
    >
      <div className="absolute inset-0 bg-black/60" />

      <motion.div
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className={`relative w-full max-w-2xl rounded-t-3xl md:rounded-3xl shadow-2xl flex flex-col ${
          isDarkMode ? 'bg-gray-900' : 'bg-white'
        }`}
        style={{
          height: '90vh',
          maxHeight: '90vh'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header fixe */}
        <div className={`flex-shrink-0 ${
          isDarkMode ? 'bg-gray-900/95' : 'bg-white/95'
        } backdrop-blur-xl border-b ${
          isDarkMode ? 'border-gray-800' : 'border-gray-200'
        }`}>
          <div className="flex items-center justify-between p-4">
            <button
              onClick={onClose}
              className={`flex items-center gap-2 px-3 py-2 rounded-full transition-colors ${
                isDarkMode 
                  ? 'bg-gray-800 hover:bg-gray-700 text-white' 
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
              }`}
            >
              <ChevronLeftIcon className="w-5 h-5" />
              <span className="text-sm font-semibold">Retour</span>
            </button>

            <button
              onClick={handleShare}
              className={`p-2 rounded-full transition-colors ${
                isDarkMode 
                  ? 'bg-gray-800 hover:bg-gray-700' 
                  : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              <ShareIcon className={`w-5 h-5 ${
                isDarkMode ? 'text-white' : 'text-gray-900'
              }`} />
            </button>
          </div>
        </div>

        {/* Contenu scrollable */}
        <div 
          className="flex-1 overflow-y-auto overscroll-contain"
          style={{
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'thin'
          }}
        >
          {/* Image principale */}
          {article.image && (
            <div className="relative w-full h-64 md:h-80 flex-shrink-0">
              {!imageLoaded && (
                <div className={`absolute inset-0 animate-pulse ${
                  isDarkMode ? 'bg-gray-800' : 'bg-gray-200'
                }`} />
              )}
              <img
                src={article.image}
                alt={article.title}
                className={`w-full h-full object-cover transition-opacity duration-300 ${
                  imageLoaded ? 'opacity-100' : 'opacity-0'
                }`}
                onLoad={() => setImageLoaded(true)}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
              
              <div className="absolute bottom-4 left-4">
                <div className={`px-3 py-1.5 rounded-full bg-gradient-to-r ${getCategoryColor(article.category)} text-white text-sm font-bold shadow-lg`}>
                  {getCategoryLabel(article.category)}
                </div>
              </div>
            </div>
          )}

          {/* Contenu de l'article */}
          <div className="p-6">
            {/* Source + Date */}
            <div className="flex items-center gap-3 mb-4">
              <span className={`text-sm font-bold ${
                isDarkMode ? 'text-orange-400' : 'text-orange-600'
              }`}>
                {article.source}
              </span>
              <span className={`text-sm ${
                isDarkMode ? 'text-gray-500' : 'text-gray-400'
              }`}>•</span>
              <div className="flex items-center gap-2">
                <ClockIcon className={`w-4 h-4 ${
                  isDarkMode ? 'text-gray-500' : 'text-gray-400'
                }`} />
                <span className={`text-sm ${
                  isDarkMode ? 'text-gray-500' : 'text-gray-500'
                }`}>
                  {formatDate(article.publishedAt)}
                </span>
              </div>
            </div>

            {/* Titre */}
            <h1 className={`text-2xl md:text-3xl font-bold mb-4 leading-tight ${
              isDarkMode ? 'text-white' : 'text-gray-900'
            }`}>
              {article.title}
            </h1>

            {/* Description */}
            {article.description && (
              <p className={`text-lg mb-6 leading-relaxed font-medium ${
                isDarkMode ? 'text-gray-300' : 'text-gray-700'
              }`}>
                {article.description}
              </p>
            )}

            {/* Contenu complet */}
            {article.content ? (
              <div className={`prose max-w-none ${
                isDarkMode ? 'prose-invert' : ''
              }`}>
                {article.content.split('\n\n').map((paragraph, index) => (
                  <p 
                    key={index}
                    className={`mb-4 leading-relaxed text-base ${
                      isDarkMode ? 'text-gray-400' : 'text-gray-600'
                    }`}
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
            ) : (
              <p className={`text-base leading-relaxed mb-6 ${
                isDarkMode ? 'text-gray-400' : 'text-gray-600'
              }`}>
                {article.description}
              </p>
            )}

            {/* Source originale */}
            {article.url && (
              <div className={`mt-8 p-4 rounded-xl border ${
                isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'
              }`}>
                <p className={`text-xs mb-2 ${
                  isDarkMode ? 'text-gray-500' : 'text-gray-500'
                }`}>
                  Article original publié par {article.source}
                </p>
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center gap-2 text-sm font-semibold transition-colors ${
                    isDarkMode 
                      ? 'text-orange-400 hover:text-orange-300' 
                      : 'text-orange-600 hover:text-orange-700'
                  }`}
                >
                  <span>Voir sur {article.source}</span>
                  <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                </a>
              </div>
            )}

            <div className="h-20" />
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
});

ArticleReader.displayName = 'ArticleReader';

// ============================================
// CARD ACTUALITÉ
// ============================================
const NewsCard = memo(({ article, onClose, onRead, priority = false }) => {
  const { isDarkMode } = useDarkMode();
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const formatDate = (date) => {
    const now = new Date();
    const diff = now - new Date(date);
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    if (hours < 1) return 'Il y a quelques minutes';
    if (hours < 24) return `Il y a ${hours}h`;
    if (hours < 48) return 'Hier';
    return new Date(date).toLocaleDateString('fr-FR', { 
      day: 'numeric', 
      month: 'short' 
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={`relative overflow-hidden rounded-2xl shadow-xl cursor-pointer transition-transform hover:scale-[1.02] active:scale-[0.98] ${
        isDarkMode ? 'bg-gradient-to-br from-gray-900 to-gray-800' : 'bg-white'
      }`}
      onClick={() => onRead(article)}
      style={{ 
        margin: 0, 
        padding: 0,
        minHeight: '300px'
      }}
    >
      {/* Badge "Actualité" */}
      <div className="absolute top-3 left-3 z-20 flex items-center gap-2">
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur-md ${
          isDarkMode ? 'bg-black/60' : 'bg-white/90'
        } border ${isDarkMode ? 'border-white/10' : 'border-gray-200'} shadow-lg`}>
          <SparklesIcon className="w-4 h-4 text-orange-500" />
          <span className={`text-xs font-bold ${
            isDarkMode ? 'text-white' : 'text-gray-900'
          }`}>
            ACTUALITÉ
          </span>
        </div>
      </div>

      {onClose && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="absolute top-3 right-3 z-20 p-2 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-sm transition-colors"
        >
          <XMarkIcon className="w-5 h-5 text-white" />
        </button>
      )}

      {/* Image */}
      <div 
        className="relative w-full" 
        style={{ 
          height: '180px',
          minHeight: '180px'
        }}
      >
        {!imageError && article.image ? (
          <>
            {!imageLoaded && (
              <div 
                className={`absolute inset-0 animate-pulse ${
                  isDarkMode ? 'bg-gray-800' : 'bg-gray-200'
                }`}
                style={{ height: '180px' }}
              />
            )}
            
            <img
              src={article.image}
              alt={article.title}
              className={`w-full h-full object-cover transition-opacity duration-300 ${
                imageLoaded ? 'opacity-100' : 'opacity-0'
              }`}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
              loading={priority ? "eager" : "lazy"}
              decoding="async"
              style={{ 
                height: '180px',
                contentVisibility: 'auto'
              }}
            />
            
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          </>
        ) : (
          <div 
            className={`w-full h-full flex items-center justify-center ${
              isDarkMode ? 'bg-gray-800' : 'bg-gray-200'
            }`}
            style={{ height: '180px' }}
          >
            <NewspaperIcon className={`w-12 h-12 ${
              isDarkMode ? 'text-gray-700' : 'text-gray-400'
            }`} />
          </div>
        )}

        {/* Badge catégorie */}
        <div className="absolute bottom-3 left-3">
          <div className={`px-3 py-1 rounded-full bg-gradient-to-r ${getCategoryColor(article.category)} text-white text-xs font-bold shadow-lg`}>
            {getCategoryLabel(article.category)}
          </div>
        </div>
      </div>

      {/* Contenu */}
      <div className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <span className={`text-xs font-semibold ${
            isDarkMode ? 'text-orange-400' : 'text-orange-600'
          }`}>
            {article.source}
          </span>
          <span className={`text-xs ${
            isDarkMode ? 'text-gray-500' : 'text-gray-400'
          }`}>•</span>
          <div className="flex items-center gap-1">
            <ClockIcon className={`w-3 h-3 ${
              isDarkMode ? 'text-gray-500' : 'text-gray-400'
            }`} />
            <span className={`text-xs ${
              isDarkMode ? 'text-gray-500' : 'text-gray-500'
            }`}>
              {formatDate(article.publishedAt)}
            </span>
          </div>
        </div>

        <h3 className={`text-base font-bold mb-2 line-clamp-2 ${
          isDarkMode ? 'text-white' : 'text-gray-900'
        }`}>
          {article.title}
        </h3>

        {article.description && (
          <p className={`text-sm mb-3 line-clamp-2 ${
            isDarkMode ? 'text-gray-400' : 'text-gray-600'
          }`}>
            {article.description}
          </p>
        )}

        <button
          onClick={(e) => {
            e.stopPropagation();
            onRead(article);
          }}
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold transition-all ${
            isDarkMode 
              ? 'bg-orange-600 hover:bg-orange-700 text-white' 
              : 'bg-orange-500 hover:bg-orange-600 text-white'
          } active:scale-95 shadow-lg`}
        >
          <span>Lire l'article</span>
          <ArrowTopRightOnSquareIcon className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
});

NewsCard.displayName = 'NewsCard';

// ============================================
// SECTION ACTUALITÉS
// ============================================
const NewsSection = memo(({ maxArticles = 3, showCategories = true, enabled = true }) => {
  const { isDarkMode } = useDarkMode();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isVisible, setIsVisible] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const { articles, loading, error, refetch } = useNews({
    maxArticles,
    category: selectedCategory,
    autoFetch: isVisible && enabled,
    enabled: enabled && isVisible
  });

  const categories = [
    { id: 'all', label: '📰 Toutes' },
    { id: 'genieCivil', label: '🏗️ Génie Civil & BTP' }, // Construction, Bâtiment, Travaux Publics
    { id: 'sport', label: '⚽ Sport' },
    { id: 'technologie', label: '💻 Tech' },
    { id: 'politique', label: '🏛️ Politique' },
    { id: 'environnement', label: '🌱 Éco' }
  ];

  if (!enabled || !isVisible) {
    return null;
  }

  if (loading) {
    return (
      <div className="w-full" style={{ margin: 0, padding: 0 }}>
        <div 
          className={`mb-4 rounded-2xl overflow-hidden ${
            isDarkMode ? 'bg-gray-900' : 'bg-white'
          }`}
          style={{ minHeight: '300px', height: '300px' }}
        >
          <div 
            className={`w-full animate-pulse ${
              isDarkMode ? 'bg-gray-800' : 'bg-gray-300'
            }`} 
            style={{ height: '180px' }}
          />
          <div className="p-3 space-y-2">
            <div className={`h-3 rounded w-3/4 animate-pulse ${
              isDarkMode ? 'bg-gray-800' : 'bg-gray-300'
            }`} />
            <div className={`h-3 rounded w-full animate-pulse ${
              isDarkMode ? 'bg-gray-700' : 'bg-gray-200'
            }`} />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-6 rounded-2xl text-center ${
        isDarkMode ? 'bg-gray-900 text-gray-400' : 'bg-white text-gray-600'
      }`}>
        <NewspaperIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p className="font-medium text-sm">{error}</p>
        <button
          onClick={refetch}
          className="mt-3 px-4 py-2 rounded-full bg-orange-500 text-white text-xs font-semibold hover:bg-orange-600 transition-colors"
        >
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="w-full" style={{ margin: 0, padding: 0 }}>
        {/* Filtres catégories */}
        {showCategories && (
          <div className={`mb-3 p-2 rounded-xl ${
            isDarkMode ? 'bg-gray-900' : 'bg-white'
          }`}>
            <div 
              className="flex gap-2 pb-1"
              style={{
                overflowX: 'auto',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
                WebkitOverflowScrolling: 'touch',
              }}
            >
              <style jsx>{`
                div::-webkit-scrollbar {
                  display: none;
                }
              `}</style>
              
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0 ${
                    selectedCategory === cat.id
                      ? 'bg-orange-500 text-white shadow-lg'
                      : isDarkMode
                      ? 'bg-gray-800 text-gray-400 hover:bg-gray-700 active:bg-gray-600'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200 active:bg-gray-300'
                  }`}
                  style={{
                    minWidth: 'fit-content',
                    touchAction: 'manipulation'
                  }}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Articles */}
        <AnimatePresence mode="popLayout">
          {articles.length > 0 ? (
            articles.map((article, index) => (
              <div key={article.id} className="mb-3">
                <NewsCard 
                  article={article} 
                  priority={index === 0}
                  onRead={setSelectedArticle}
                />
              </div>
            ))
          ) : (
            <div className={`p-8 rounded-2xl text-center ${
              isDarkMode ? 'bg-gray-900 text-gray-400' : 'bg-white text-gray-600'
            }`}>
              <NewspaperIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm font-medium">Aucune actualité disponible</p>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Lecteur d'article en modal */}
      <AnimatePresence>
        {selectedArticle && (
          <ArticleReader
            article={selectedArticle}
            onClose={() => setSelectedArticle(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
});

NewsSection.displayName = 'NewsSection';

export default NewsSection;