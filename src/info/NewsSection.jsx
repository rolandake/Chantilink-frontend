// 📁 src/info/NewsSection.jsx
// ✅ ArticleReader bottom-sheet → ArticleReaderModal plein écran (portal z-index propre)
// ✅ ZÉRO FETCH INTERNE — reçoit les articles en props depuis Home
// ✅ Composant purement présentationnel

import React, { useState, memo, useEffect, useCallback, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  NewspaperIcon, ClockIcon, ArrowTopRightOnSquareIcon, SparklesIcon,
} from "@heroicons/react/24/outline";
import { useDarkMode } from "../context/DarkModeContext";
import ArticleReaderModal from "../pages/Home/ArticleReaderModal";

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
const getCategoryColor = (category) => {
  const map = {
    genieCivil:    "from-orange-500 to-red-500",
    sport:         "from-blue-500 to-cyan-500",
    politique:     "from-purple-500 to-pink-500",
    technologie:   "from-green-500 to-emerald-500",
    environnement: "from-teal-500 to-green-600",
    general:       "from-gray-500 to-gray-600",
  };
  return map[category] || map.general;
};

const getCategoryLabel = (category) => {
  const map = {
    genieCivil:    "🏗️ Génie Civil & BTP",
    sport:         "⚽ Sport",
    politique:     "🏛️ Politique",
    technologie:   "💻 Tech",
    environnement: "🌱 Environnement",
    general:       "📰 Actualités",
  };
  return map[category] || map.general;
};

const formatDate = (date) => {
  if (!date) return "";
  const h = Math.floor((Date.now() - new Date(date)) / 3600000);
  if (h < 1)  return "À l'instant";
  if (h < 24) return `Il y a ${h}h`;
  if (h < 48) return "Hier";
  return new Date(date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
};

// ─────────────────────────────────────────────
// NEWS CARD — grande carte (mode liste)
// ─────────────────────────────────────────────
const NewsCard = memo(({ article, onRead, priority = false }) => {
  const { isDarkMode } = useDarkMode();
  const [imgError, setImgError] = useState(false);

  return (
    <div
      className={`relative overflow-hidden rounded-2xl shadow-lg cursor-pointer active:scale-[0.98] transition-transform
        ${isDarkMode ? "bg-gray-900" : "bg-white"}`}
      style={{ height: 320 }}
      onClick={() => onRead(article)}
    >
      {/* Badge */}
      <div className="absolute top-3 left-3 z-20">
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur-md shadow-lg border
          ${isDarkMode ? "bg-black/60 border-white/10" : "bg-white/90 border-gray-200"}`}>
          <SparklesIcon className="w-3.5 h-3.5 text-orange-500" />
          <span className={`text-[10px] font-bold ${isDarkMode ? "text-white" : "text-gray-900"}`}>
            ACTUALITÉ
          </span>
        </div>
      </div>

      {/* Image */}
      <div style={{ height: 180, position: "relative", overflow: "hidden", flexShrink: 0 }}>
        {!imgError && article.image ? (
          <>
            <img
              src={article.image} alt={article.title}
              width={630} height={180}
              className="w-full h-full object-cover"
              loading={priority ? "eager" : "lazy"}
              decoding="async"
              onError={() => setImgError(true)}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          </>
        ) : (
          <div className={`w-full h-full flex items-center justify-center
            ${isDarkMode ? "bg-gray-800" : "bg-gray-200"}`}>
            <NewspaperIcon className="w-12 h-12 text-gray-400" />
          </div>
        )}
        <div className="absolute bottom-3 left-3">
          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold text-white
            bg-gradient-to-r ${getCategoryColor(article.category)}`}>
            {getCategoryLabel(article.category)}
          </span>
        </div>
      </div>

      {/* Texte */}
      <div className="p-3" style={{ height: 140 }}>
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className={`text-xs font-semibold ${isDarkMode ? "text-orange-400" : "text-orange-500"}`}>
            {article.source}
          </span>
          <span className={`text-[10px] ${isDarkMode ? "text-gray-600" : "text-gray-400"}`}>
            · {formatDate(article.publishedAt)}
          </span>
        </div>
        <h3 className={`text-sm font-bold leading-snug line-clamp-2 mb-2
          ${isDarkMode ? "text-white" : "text-gray-900"}`}
          style={{ minHeight: 40 }}>
          {article.title}
        </h3>
        <button
          onClick={e => { e.stopPropagation(); onRead(article); }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-500 text-white text-xs font-semibold active:scale-95 transition-transform"
        >
          Lire l'article
          <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
});
NewsCard.displayName = "NewsCard";

// ─────────────────────────────────────────────
// NEWS CARD INLINE — carte compacte horizontale dans le feed
// ─────────────────────────────────────────────
export const NewsCardInline = memo(({ article, isDarkMode: isDarkModeProp }) => {
  const { isDarkMode: contextDark } = useDarkMode();
  const isDarkMode = isDarkModeProp !== undefined ? isDarkModeProp : contextDark;

  const [imgError,    setImgError]    = useState(false);
  const [openArticle, setOpenArticle] = useState(null);

  const timeAgo = useMemo(() => formatDate(article.publishedAt), [article.publishedAt]);

  return (
    <>
      <div
        className={`cursor-pointer active:opacity-75 transition-opacity ${isDarkMode ? "bg-black" : "bg-white"}`}
        style={{ borderTop: isDarkMode ? "1px solid #111827" : "1px solid #f3f4f6" }}
        onClick={() => setOpenArticle(article)}
      >
        {/* Séparateur */}
        <div className="flex items-center gap-3 px-4 pt-3 pb-2">
          <div className={`flex-1 h-px ${isDarkMode ? "bg-gray-800" : "bg-gray-100"}`} />
          <span className={`text-[9px] font-black uppercase tracking-widest ${isDarkMode ? "text-gray-700" : "text-gray-300"}`}>
            Actualité
          </span>
          <div className={`flex-1 h-px ${isDarkMode ? "bg-gray-800" : "bg-gray-100"}`} />
        </div>

        {/* Layout horizontal compact */}
        <div className="flex gap-3 px-4 pb-4">
          {!imgError && article.image && (
            <div className="flex-shrink-0 rounded-xl overflow-hidden bg-gray-200" style={{ width: 88, height: 88 }}>
              <img
                src={article.image} alt=""
                width={88} height={88}
                loading="lazy" decoding="async"
                className="w-full h-full object-cover"
                onError={() => setImgError(true)}
              />
            </div>
          )}
          <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
            <div>
              <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                <span className="text-[10px] font-bold text-orange-500 uppercase tracking-wide">
                  {article.source}
                </span>
                <span className={`text-[10px] ${isDarkMode ? "text-gray-600" : "text-gray-400"}`}>
                  · {timeAgo}
                </span>
              </div>
              <p className={`text-sm font-semibold leading-snug line-clamp-3
                ${isDarkMode ? "text-white" : "text-gray-900"}`}>
                {article.title}
              </p>
            </div>
            <span className="text-xs font-semibold text-orange-500 mt-1.5">Lire →</span>
          </div>
        </div>
      </div>

      {/* ✅ Modal plein écran */}
      <ArticleReaderModal
        article={openArticle}
        isOpen={!!openArticle}
        onClose={() => setOpenArticle(null)}
      />
    </>
  );
});
NewsCardInline.displayName = "NewsCardInline";

// ─────────────────────────────────────────────
// NEWS SECTION — mode liste complet
// ─────────────────────────────────────────────
const NewsSection = memo(({
  articles = [],
  loading = false,
  error = null,
  onRefetch = null,
  maxArticles,
  showCategories = false,
  selectedCategory,
  onCategoryChange,
}) => {
  const { isDarkMode } = useDarkMode();
  const [selectedArticle, setSelectedArticle] = useState(null);

  const displayed = useMemo(() =>
    maxArticles ? articles.slice(0, maxArticles) : articles,
    [articles, maxArticles]
  );

  const categories = [
    { id: "all",           label: "📰 Toutes"   },
    { id: "genieCivil",    label: "🏗️ BTP"      },
    { id: "sport",         label: "⚽ Sport"    },
    { id: "technologie",   label: "💻 Tech"     },
    { id: "politique",     label: "🏛️ Politique" },
    { id: "environnement", label: "🌱 Éco"      },
  ];

  if (loading) {
    return (
      <div className={`rounded-2xl overflow-hidden animate-pulse ${isDarkMode ? "bg-gray-900" : "bg-white"}`}
        style={{ height: 320 }}>
        <div className={`w-full ${isDarkMode ? "bg-gray-800" : "bg-gray-200"}`} style={{ height: 180 }} />
        <div className="p-3 space-y-2">
          <div className={`h-3 rounded w-1/3 ${isDarkMode ? "bg-gray-800" : "bg-gray-200"}`} />
          <div className={`h-4 rounded w-full ${isDarkMode ? "bg-gray-800" : "bg-gray-200"}`} />
          <div className={`h-4 rounded w-3/4 ${isDarkMode ? "bg-gray-700" : "bg-gray-100"}`} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-6 rounded-2xl text-center ${isDarkMode ? "bg-gray-900 text-gray-400" : "bg-white text-gray-600"}`}>
        <NewspaperIcon className="w-10 h-10 mx-auto mb-3 opacity-40" />
        <p className="text-sm font-medium mb-3">{error}</p>
        {onRefetch && (
          <button onClick={onRefetch}
            className="px-4 py-2 rounded-full bg-orange-500 text-white text-xs font-semibold">
            Réessayer
          </button>
        )}
      </div>
    );
  }

  if (displayed.length === 0) return null;

  return (
    <>
      <div className="w-full">
        {/* Filtres catégories */}
        {showCategories && onCategoryChange && (
          <div className={`mb-3 p-2 rounded-xl ${isDarkMode ? "bg-gray-900" : "bg-white"}`}>
            <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
              {categories.map(cat => (
                <button key={cat.id} onClick={() => onCategoryChange(cat.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap flex-shrink-0 transition-colors
                    ${selectedCategory === cat.id
                      ? "bg-orange-500 text-white"
                      : isDarkMode ? "bg-gray-800 text-gray-400" : "bg-gray-100 text-gray-600"}`}
                  style={{ touchAction: "manipulation" }}>
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Liste des articles */}
        <div className="space-y-3">
          {displayed.map((article, i) => (
            <NewsCard
              key={article.id || article.url || i}
              article={article}
              priority={i === 0}
              onRead={setSelectedArticle}
            />
          ))}
        </div>
      </div>

      {/* ✅ Modal plein écran */}
      <ArticleReaderModal
        article={selectedArticle}
        isOpen={!!selectedArticle}
        onClose={() => setSelectedArticle(null)}
      />
    </>
  );
});
NewsSection.displayName = "NewsSection";
export default NewsSection;