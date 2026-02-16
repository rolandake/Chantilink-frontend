// 📁 src/info/NewsSection.jsx
// ✅ OPTIMISÉ CLS - Dimensions fixes pour éviter les décalages

import React, { useState, memo, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion'; // ✅ Retirer motion.div pour réduire CLS
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
// HELPERS
// ============================================
const getCategoryColor = (category) => {
  const colors = {
    genieCivil: 'from-orange-500 to-red-500',
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
    genieCivil: '🏗️ Génie Civil & BTP',
    sport: '⚽ Sport',
    politique: '🏛️ Politique',
    technologie: '💻 Tech',
    environnement: '🌱 Environnement',
    general: '📰 Actualités'
  };
  return labels[category] || labels.general;
};

// ============================================
// CARD ACTUALITÉ - OPTIMISÉE CLS
// ============================================
const NewsCard = memo(({ article, onRead, priority = false }) => {
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
    // ✅ DIV SIMPLE au lieu de motion.div pour réduire CLS
    <div
      className={`relative overflow-hidden rounded-2xl shadow-xl cursor-pointer transition-transform hover:scale-[1.02] active:scale-[0.98] ${
        isDarkMode ? 'bg-gradient-to-br from-gray-900 to-gray-800' : 'bg-white'
      }`}
      onClick={() => onRead(article)}
      style={{ 
        margin: 0, 
        padding: 0,
        // ✅ HAUTEUR FIXE pour éviter CLS
        minHeight: '320px',
        height: '320px'
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

      {/* Image - DIMENSIONS FIXES */}
      <div 
        className="relative w-full flex-shrink-0" 
        style={{ 
          // ✅ HAUTEUR FIXE - CRITIQUE POUR CLS
          height: '180px',
          minHeight: '180px',
          maxHeight: '180px'
        }}
      >
        {!imageError && article.image ? (
          <>
            {/* Placeholder pendant chargement */}
            <div 
              className={`absolute inset-0 ${
                isDarkMode ? 'bg-gray-800' : 'bg-gray-200'
              }`}
              style={{ 
                height: '180px',
                opacity: imageLoaded ? 0 : 1,
                transition: 'opacity 0.3s'
              }}
            />
            
            {/* ✅ Image avec width/height explicites */}
            <img
              src={article.image}
              alt={article.title}
              width="630"
              height="180"
              className={`w-full h-full object-cover transition-opacity duration-300 ${
                imageLoaded ? 'opacity-100' : 'opacity-0'
              }`}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
              loading={priority ? "eager" : "lazy"}
              decoding="async"
              style={{ 
                height: '180px',
                objectFit: 'cover',
                aspectRatio: '630/180'
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

      {/* Contenu - HAUTEUR FIXE */}
      <div 
        className="p-3 flex flex-col"
        style={{
          // ✅ HAUTEUR RESTANTE FIXE
          height: '140px',
          minHeight: '140px',
          maxHeight: '140px'
        }}
      >
        <div className="flex items-center gap-2 mb-2 flex-shrink-0">
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

        <h3 className={`text-base font-bold mb-2 line-clamp-2 flex-shrink-0 ${
          isDarkMode ? 'text-white' : 'text-gray-900'
        }`}
        style={{
          // ✅ Hauteur fixe pour le titre (2 lignes max)
          minHeight: '44px',
          maxHeight: '44px'
        }}
        >
          {article.title}
        </h3>

        {article.description && (
          <p className={`text-sm mb-3 line-clamp-2 flex-1 ${
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
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold transition-all flex-shrink-0 self-start ${
            isDarkMode 
              ? 'bg-orange-600 hover:bg-orange-700 text-white' 
              : 'bg-orange-500 hover:bg-orange-600 text-white'
          } active:scale-95 shadow-lg`}
        >
          <span>Lire l'article</span>
          <ArrowTopRightOnSquareIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
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
    { id: 'genieCivil', label: '🏗️ Génie Civil & BTP' },
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
          // ✅ HAUTEUR FIXE pour le skeleton aussi
          style={{ minHeight: '320px', height: '320px', maxHeight: '320px' }}
        >
          <div 
            className={`w-full animate-pulse ${
              isDarkMode ? 'bg-gray-800' : 'bg-gray-300'
            }`} 
            style={{ height: '180px', minHeight: '180px' }}
          />
          <div className="p-3 space-y-2" style={{ height: '140px' }}>
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
              className="flex gap-2 pb-1 news-categories-scroll"
              style={{
                overflowX: 'auto',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
                WebkitOverflowScrolling: 'touch',
              }}
            >
              <style>{`
                .news-categories-scroll::-webkit-scrollbar {
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

        {/* Articles - SANS AnimatePresence pour réduire CLS */}
        {articles.length > 0 ? (
          articles.map((article, index) => (
            // ✅ Wrapper avec hauteur fixe
            <div 
              key={article.id} 
              className="mb-3"
              style={{
                minHeight: '320px',
                height: '320px'
              }}
            >
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
      </div>

      {/* Lecteur d'article en modal - GARDÉ */}
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

// ============================================
// ARTICLE READER (simplifié, pas affiché ici)
// ============================================
const ArticleReader = memo(({ article, onClose }) => {
  const { isDarkMode } = useDarkMode();
  
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className={`relative w-full max-w-2xl h-[90vh] rounded-3xl shadow-2xl overflow-hidden ${
          isDarkMode ? 'bg-gray-900' : 'bg-white'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-gray-700">
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-3 py-2 rounded-full bg-gray-800 hover:bg-gray-700 text-white"
          >
            <ChevronLeftIcon className="w-5 h-5" />
            <span className="text-sm font-semibold">Retour</span>
          </button>
        </div>
        
        <div className="overflow-y-auto h-[calc(100%-80px)] p-6">
          <h1 className="text-2xl font-bold mb-4 text-white">{article.title}</h1>
          {article.image && (
            <img src={article.image} alt={article.title} className="w-full rounded-xl mb-4" />
          )}
          <p className="text-gray-300">{article.description}</p>
        </div>
      </div>
    </div>
  );
});

ArticleReader.displayName = 'ArticleReader';

export default NewsSection;