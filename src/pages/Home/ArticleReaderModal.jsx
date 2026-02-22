// src/pages/Home/ArticleReaderModal.jsx
// ✅ Modal plein écran — même architecture que PostCommentsModal / PostShareModal
// ✅ Layout 2 colonnes desktop (image article | contenu texte)
// ✅ Layout 1 colonne plein écran mobile
// ✅ Portal → z-index propre
// ✅ Keyboard-aware iOS/Android
// ✅ Remplace l'ancien ArticleReader bottom-sheet dans Home.jsx et NewsSection.jsx

import React, { useState, useEffect, useMemo, memo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  XMarkIcon, ChevronLeftIcon,
  ArrowTopRightOnSquareIcon, ClockIcon,
  NewspaperIcon, ShareIcon
} from "@heroicons/react/24/outline";
import { useDarkMode } from "../../context/DarkModeContext";

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
  return new Date(date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
};

// ─────────────────────────────────────────────
// COLONNE GAUCHE — image + gradient (desktop)
// ─────────────────────────────────────────────
const ImageColumn = memo(({ article, isDarkMode }) => {
  const [imgError, setImgError] = useState(false);

  return (
    <div className="relative flex flex-col h-full overflow-hidden">
      {/* Image plein fond */}
      {!imgError && article.image ? (
        <>
          <img
            src={article.image}
            alt={article.title}
            className="w-full h-full object-cover"
            loading="eager"
            onError={() => setImgError(true)}
          />
          {/* Gradient bas */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
        </>
      ) : (
        <div className={`w-full h-full flex flex-col items-center justify-center gap-4
          bg-gradient-to-br ${getCategoryColor(article.category)}`}>
          <NewspaperIcon className="w-24 h-24 text-white/30" />
        </div>
      )}

      {/* Infos superposées en bas */}
      <div className="absolute bottom-0 left-0 right-0 p-6">
        {/* Badge catégorie */}
        {article.category && (
          <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold text-white mb-4
            bg-gradient-to-r ${getCategoryColor(article.category)}`}>
            {getCategoryLabel(article.category)}
          </div>
        )}

        {/* Titre */}
        <h2 className="text-white text-xl font-bold leading-snug mb-3 line-clamp-4">
          {article.title}
        </h2>

        {/* Source + date */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-white/90 text-sm font-semibold">{article.source}</span>
          {article.publishedAt && (
            <>
              <span className="text-white/40 text-xs">·</span>
              <span className="text-white/70 text-xs flex items-center gap-1">
                <ClockIcon className="w-3 h-3" />
                {formatDate(article.publishedAt)}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
});
ImageColumn.displayName = "ImageColumn";

// ─────────────────────────────────────────────
// COLONNE DROITE — contenu de l'article
// ─────────────────────────────────────────────
const ContentColumn = memo(({ article, isDarkMode, onClose }) => {
  const [showFull, setShowFull] = useState(false);
  const [copied,   setCopied]   = useState(false);

  const articleUrl = article.url || `${window.location.origin}/article/${article.id || ""}`;

  const handleShare = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: article.title, url: articleUrl }); return; } catch {}
    }
    try {
      await navigator.clipboard.writeText(articleUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Header */}
      <div className={`flex-shrink-0 flex items-center gap-3 px-4 py-3.5 border-b
        ${isDarkMode ? "border-gray-800" : "border-gray-100"}`}>
        <button onClick={onClose}
          className={`p-2 -ml-1 rounded-full transition-colors flex-shrink-0
            ${isDarkMode ? "hover:bg-gray-800 text-gray-400" : "hover:bg-gray-100 text-gray-500"}`}>
          <ChevronLeftIcon className="w-5 h-5 sm:hidden" />
          <XMarkIcon className="w-5 h-5 hidden sm:block" />
        </button>

        {/* Source + icône */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center flex-shrink-0">
            <NewspaperIcon className="w-4 h-4 text-white" />
          </div>
          <span className={`text-[13px] font-semibold truncate ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
            {article.source}
          </span>
        </div>

        {/* Bouton partager */}
        <button onClick={handleShare}
          className={`p-2 rounded-full transition-colors flex-shrink-0
            ${isDarkMode ? "hover:bg-gray-800 text-gray-400" : "hover:bg-gray-100 text-gray-500"}`}>
          <ShareIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Image mobile (cachée sur desktop car colonne gauche) */}
      {article.image && (
        <div className="sm:hidden flex-shrink-0 w-full overflow-hidden" style={{ height: 220 }}>
          <img
            src={article.image}
            alt={article.title}
            className="w-full h-full object-cover"
            loading="eager"
          />
          <div className="absolute inset-x-0 bg-gradient-to-t from-black/50 to-transparent" style={{ height: 60, marginTop: -60 }} />
        </div>
      )}

      {/* Contenu scrollable */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-4"
        style={{ WebkitOverflowScrolling: "touch" }}>

        {/* Badge catégorie (mobile uniquement, desktop : visible colonne gauche) */}
        {article.category && (
          <div className={`sm:hidden inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold text-white mb-4
            bg-gradient-to-r ${getCategoryColor(article.category)}`}>
            {getCategoryLabel(article.category)}
          </div>
        )}

        {/* Titre */}
        <h1 className={`text-[20px] font-black leading-snug mb-3
          ${isDarkMode ? "text-white" : "text-gray-900"}`}>
          {article.title}
        </h1>

        {/* Meta */}
        <div className={`flex items-center gap-2 text-[12px] mb-5 pb-4 border-b
          ${isDarkMode ? "text-gray-500 border-gray-800" : "text-gray-400 border-gray-100"}`}>
          <span className="font-semibold text-orange-500">{article.source}</span>
          {article.publishedAt && (
            <>
              <span>·</span>
              <span className="flex items-center gap-1">
                <ClockIcon className="w-3 h-3" />
                {formatDate(article.publishedAt)}
              </span>
            </>
          )}
        </div>

        {/* Description */}
        {article.description && (
          <p className={`text-[15px] leading-relaxed mb-5
            ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>
            {article.description}
          </p>
        )}

        {/* Contenu complet (expandable) */}
        {article.content && !showFull && (
          <button
            onClick={() => setShowFull(true)}
            className={`w-full py-3 rounded-xl text-[14px] font-semibold border-2 border-dashed transition-colors mb-5
              ${isDarkMode
                ? "border-gray-800 text-gray-500 hover:border-orange-500/40 hover:text-orange-400"
                : "border-gray-200 text-gray-400 hover:border-orange-300 hover:text-orange-500"}`}>
            Afficher plus de contenu ↓
          </button>
        )}

        <AnimatePresence>
          {showFull && article.content && (
            <motion.div
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25 }}
              className="overflow-hidden mb-5"
            >
              <p className={`text-[15px] leading-relaxed ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>
                {article.content}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* CTA — Lire source */}
        {articleUrl && (
          <div className="space-y-3 pb-6">
            <a
              href={articleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl bg-gradient-to-r from-orange-500 to-pink-500 text-white font-bold text-[15px] shadow-lg shadow-orange-500/25 active:scale-[0.98] transition-transform"
            >
              Lire l'article complet
              <ArrowTopRightOnSquareIcon className="w-4 h-4" />
            </a>

            <button
              onClick={handleShare}
              className={`flex items-center justify-center gap-2 w-full py-3 rounded-2xl font-semibold text-[14px] border transition-colors
                ${isDarkMode
                  ? "border-gray-800 text-gray-400 hover:bg-gray-900"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
            >
              <ShareIcon className="w-4 h-4" />
              {copied ? "Lien copié ✓" : "Partager cet article"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
});
ContentColumn.displayName = "ContentColumn";

// ─────────────────────────────────────────────
// MODAL PRINCIPAL
// ─────────────────────────────────────────────
const ArticleReaderModal = ({ article, isOpen, onClose }) => {
  const { isDarkMode } = useDarkMode();
  const [viewportH, setViewportH] = useState("100dvh");

  // Body lock
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  // Keyboard-aware
  useEffect(() => {
    if (!isOpen) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setViewportH(`${vv.height}px`);
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    update();
    return () => { vv.removeEventListener("resize", update); vv.removeEventListener("scroll", update); };
  }, [isOpen]);

  // Escape key
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!article) return null;

  const hasImage = !!article.image;

  const content = (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="bd"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[400] bg-black/85"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            key="article-modal"
            initial={{ opacity: 0, y: "3%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "3%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className={`fixed z-[401] flex overflow-hidden
              inset-0
              sm:inset-6 sm:rounded-2xl
              ${isDarkMode ? "bg-[#0a0a0a]" : "bg-white"}
            `}
            style={{ height: viewportH, maxHeight: "100%" }}
            onClick={e => e.stopPropagation()}
          >
            {/* Colonne gauche — image (desktop uniquement, seulement si image disponible) */}
            {hasImage && (
              <div className={`hidden sm:flex flex-col border-r flex-shrink-0 sm:w-[45%] lg:w-[50%]
                ${isDarkMode ? "border-gray-800" : "border-gray-100"}`}>
                <ImageColumn article={article} isDarkMode={isDarkMode} />
              </div>
            )}

            {/* Colonne droite — contenu */}
            <div className="flex flex-col flex-1 min-w-0 min-h-0">
              <ContentColumn article={article} isDarkMode={isDarkMode} onClose={onClose} />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  return createPortal(content, document.body);
};

export default ArticleReaderModal;