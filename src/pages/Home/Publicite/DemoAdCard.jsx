// ============================================
// 📁 src/pages/Home/Publicite/DemoAdCard.jsx
// Publicité de démonstration (avant Google AdSense)
// ============================================
import React, { memo, useState, useEffect } from 'react';
import { ExternalLink, X } from 'lucide-react';

// Import avec chemin absolu (si configuré dans vite.config.js ou jsconfig.json)
// Sinon, utilisez le chemin relatif approprié
import { useDarkMode } from '@/context/DarkModeContext';
// OU si pas de chemin absolu configuré :
// import { useDarkMode } from '../../../context/DarkModeContext';

// Exemples de publicités de démonstration
const DEMO_ADS = [
  {
    id: 1,
    title: "Boostez votre entreprise",
    description: "Découvrez nos solutions marketing innovantes pour développer votre activité",
    image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80",
    cta: "En savoir plus",
    url: "#",
    bgGradient: "from-blue-500 to-purple-600"
  },
  {
    id: 2,
    title: "Formation en ligne",
    description: "Apprenez de nouvelles compétences avec nos cours certifiés",
    image: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&q=80",
    cta: "Découvrir",
    url: "#",
    bgGradient: "from-green-500 to-teal-600"
  },
  {
    id: 3,
    title: "Productivité maximale",
    description: "L'outil de gestion de projet qui transforme votre équipe",
    image: "https://images.unsplash.com/photo-1551434678-e076c223a692?w=800&q=80",
    cta: "Essayer gratuitement",
    url: "#",
    bgGradient: "from-orange-500 to-pink-600"
  },
  {
    id: 4,
    title: "E-commerce moderne",
    description: "Créez votre boutique en ligne en quelques clics",
    image: "https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=800&q=80",
    cta: "Commencer",
    url: "#",
    bgGradient: "from-indigo-500 to-blue-600"
  },
  {
    id: 5,
    title: "Voyage de rêve",
    description: "Des destinations exceptionnelles à prix imbattables",
    image: "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&q=80",
    cta: "Réserver",
    url: "#",
    bgGradient: "from-cyan-500 to-blue-600"
  }
];

const DemoAdCard = memo(({ 
  style = {},
  className = '',
  canClose = false // Option pour permettre la fermeture
}) => {
  const { isDarkMode } = useDarkMode();
  const [currentAd, setCurrentAd] = useState(null);
  const [isVisible, setIsVisible] = useState(true);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Sélectionner une pub aléatoire au montage
  useEffect(() => {
    const randomAd = DEMO_ADS[Math.floor(Math.random() * DEMO_ADS.length)];
    setCurrentAd(randomAd);
  }, []);

  if (!isVisible || !currentAd) return null;

  return (
    <div 
      className={`w-full my-4 ${className}`}
      style={style}
    >
      <div className={`rounded-2xl overflow-hidden border transition-all ${
        isDarkMode 
          ? 'bg-gray-800/50 border-gray-700 hover:border-gray-600' 
          : 'bg-white border-gray-200 hover:border-gray-300'
      }`}>
        {/* Header avec label et bouton fermer */}
        <div className={`px-4 py-2 flex items-center justify-between border-b ${
          isDarkMode ? 'border-gray-700' : 'border-gray-200'
        }`}>
          <span className={`text-xs font-medium ${
            isDarkMode ? 'text-gray-500' : 'text-gray-400'
          }`}>
            Publicité
          </span>
          {canClose && (
            <button
              onClick={() => setIsVisible(false)}
              className={`p-1 rounded-full transition-colors ${
                isDarkMode 
                  ? 'hover:bg-gray-700 text-gray-500' 
                  : 'hover:bg-gray-100 text-gray-400'
              }`}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Contenu de la pub */}
        <a 
          href={currentAd.url}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="block group"
        >
          {/* Image */}
          <div className="relative aspect-video overflow-hidden bg-gray-200 dark:bg-gray-700">
            {!imageLoaded && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-gray-300 border-t-orange-500 rounded-full animate-spin" />
              </div>
            )}
            <img
              src={currentAd.image}
              alt={currentAd.title}
              className={`w-full h-full object-cover transition-all duration-300 group-hover:scale-105 ${
                imageLoaded ? 'opacity-100' : 'opacity-0'
              }`}
              onLoad={() => setImageLoaded(true)}
              loading="lazy"
            />
            {/* Overlay gradient */}
            <div className={`absolute inset-0 bg-gradient-to-t ${currentAd.bgGradient} opacity-0 group-hover:opacity-20 transition-opacity`} />
          </div>

          {/* Texte */}
          <div className="p-4">
            <h3 className={`text-lg font-bold mb-2 line-clamp-1 ${
              isDarkMode ? 'text-white' : 'text-gray-900'
            }`}>
              {currentAd.title}
            </h3>
            <p className={`text-sm mb-4 line-clamp-2 ${
              isDarkMode ? 'text-gray-400' : 'text-gray-600'
            }`}>
              {currentAd.description}
            </p>

            {/* CTA Button */}
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-sm transition-all bg-gradient-to-r ${currentAd.bgGradient} text-white group-hover:scale-105 group-hover:shadow-lg`}>
              {currentAd.cta}
              <ExternalLink size={14} />
            </div>
          </div>
        </a>

        {/* Footer optionnel */}
        <div className={`px-4 py-2 border-t text-xs ${
          isDarkMode 
            ? 'border-gray-700 text-gray-600' 
            : 'border-gray-200 text-gray-400'
        }`}>
          Annonce sponsorisée
        </div>
      </div>
    </div>
  );
});

DemoAdCard.displayName = 'DemoAdCard';

export default DemoAdCard;