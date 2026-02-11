// ============================================
// 📁 src/pages/Home/Publicite/SmartAd.jsx
// TOUT-EN-UN : Composant sans aucune dépendance externe
// ============================================
import React, { memo, useState, useEffect } from 'react';
import { ExternalLink, X, ShoppingBag, BookOpen, Plane, Smartphone, Home as HomeIcon } from 'lucide-react';

// ============================================
// CONFIGURATION (modifie ici)
// ============================================
const CONFIG = {
  // Active/désactive les pubs
  enabled: true,
  
  // true = pubs démo, false = Google AdSense
  useDemoAds: true,
  
  // Ton Publisher ID Google
  googlePublisherId: "ca-pub-9979082242566048",
  
  // Tes Slot IDs (à remplir quand tu les auras)
  googleSlots: {
    feedInline: "XXXXXXXXXX",
    headerBanner: "XXXXXXXXXX",
    footerBanner: "XXXXXXXXXX",
  }
};

// ============================================
// DONNÉES DES PUBLICITÉS DÉMO
// ============================================
const DEMO_ADS = [
  {
    id: 1,
    title: "Boostez votre entreprise",
    description: "Découvrez nos solutions marketing innovantes pour développer votre activité en Côte d'Ivoire",
    image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80",
    cta: "En savoir plus",
    icon: <Smartphone className="w-4 h-4" />,
    bgGradient: "from-blue-500 to-purple-600"
  },
  {
    id: 2,
    title: "Formation en ligne",
    description: "Apprenez le digital marketing, la programmation et le design avec nos cours certifiés",
    image: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&q=80",
    cta: "Découvrir",
    icon: <BookOpen className="w-4 h-4" />,
    bgGradient: "from-green-500 to-teal-600"
  },
  {
    id: 3,
    title: "E-commerce à Abidjan",
    description: "Créez votre boutique en ligne et vendez partout en Côte d'Ivoire avec Orange Money",
    image: "https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=800&q=80",
    cta: "Commencer",
    icon: <ShoppingBag className="w-4 h-4" />,
    bgGradient: "from-indigo-500 to-blue-600"
  },
  {
    id: 4,
    title: "Voyage de rêve",
    description: "Assinie, Bassam, San Pedro... Des destinations exceptionnelles à prix imbattables",
    image: "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&q=80",
    cta: "Réserver",
    icon: <Plane className="w-4 h-4" />,
    bgGradient: "from-cyan-500 to-blue-600"
  },
  {
    id: 5,
    title: "Cuisine ivoirienne",
    description: "Commandez vos plats préférés : Attiéké, Garba, Alloco... Livraison 30min",
    image: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&q=80",
    cta: "Commander",
    icon: <ShoppingBag className="w-4 h-4" />,
    bgGradient: "from-green-500 to-emerald-600"
  }
];

// ============================================
// COMPOSANT PUB DÉMO
// ============================================
const DemoAd = memo(({ canClose, isDarkMode }) => {
  const [currentAd, setCurrentAd] = useState(null);
  const [isVisible, setIsVisible] = useState(true);
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    const randomAd = DEMO_ADS[Math.floor(Math.random() * DEMO_ADS.length)];
    setCurrentAd(randomAd);
  }, []);

  if (!isVisible || !currentAd) return null;

  return (
    <div className="w-full">
      <div className={`rounded-none overflow-hidden border-b transition-all ${
        isDarkMode ? 'bg-black border-gray-800' : 'bg-white border-gray-200'
      }`}>
        {/* Header */}
        <div className={`px-4 py-2 flex items-center justify-between ${
          isDarkMode ? 'bg-gray-900/50' : 'bg-gray-50/50'
        }`}>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium ${
              isDarkMode ? 'text-gray-500' : 'text-gray-400'
            }`}>
              Publicité
            </span>
            {currentAd.icon && <span className="text-gray-400">{currentAd.icon}</span>}
          </div>
          {canClose && (
            <button
              onClick={() => setIsVisible(false)}
              className={`p-1 rounded-full transition-colors ${
                isDarkMode ? 'hover:bg-gray-800 text-gray-500' : 'hover:bg-gray-100 text-gray-400'
              }`}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Image */}
        <a href="#" className="block group" onClick={(e) => e.preventDefault()}>
          <div className="relative aspect-square overflow-hidden bg-gray-200 dark:bg-gray-800">
            {!imageLoaded && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-gray-300 border-t-orange-500 rounded-full animate-spin" />
              </div>
            )}
            <img
              src={currentAd.image}
              alt={currentAd.title}
              className={`w-full h-full object-cover transition-all duration-500 group-hover:scale-105 ${
                imageLoaded ? 'opacity-100' : 'opacity-0'
              }`}
              onLoad={() => setImageLoaded(true)}
              loading="lazy"
            />
            <div className={`absolute inset-0 bg-gradient-to-t ${currentAd.bgGradient} opacity-0 group-hover:opacity-20 transition-opacity duration-300`} />
            <div className="absolute bottom-4 left-4">
              <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-sm bg-gradient-to-r ${currentAd.bgGradient} text-white shadow-xl group-hover:scale-105 transition-all`}>
                {currentAd.cta}
                <ExternalLink size={14} />
              </div>
            </div>
          </div>

          {/* Texte */}
          <div className="p-4">
            <h3 className={`text-base font-bold mb-1 line-clamp-1 ${
              isDarkMode ? 'text-white' : 'text-gray-900'
            }`}>
              {currentAd.title}
            </h3>
            <p className={`text-sm line-clamp-2 ${
              isDarkMode ? 'text-gray-400' : 'text-gray-600'
            }`}>
              {currentAd.description}
            </p>
          </div>
        </a>

        {/* Footer */}
        <div className={`px-4 py-2 border-t flex items-center justify-between text-xs ${
          isDarkMode ? 'border-gray-800 text-gray-600' : 'border-gray-200 text-gray-400'
        }`}>
          <span>Annonce sponsorisée</span>
        </div>
      </div>
    </div>
  );
});

DemoAd.displayName = 'DemoAd';

// ============================================
// COMPOSANT PUB GOOGLE
// ============================================
const GoogleAd = memo(({ slot, isDarkMode }) => {
  const adRef = React.useRef(null);
  const adLoadedRef = React.useRef(false);

  useEffect(() => {
    if (adLoadedRef.current) return;

    try {
      const loadAd = () => {
        if (typeof window !== 'undefined' && window.adsbygoogle && adRef.current) {
          (window.adsbygoogle = window.adsbygoogle || []).push({});
          adLoadedRef.current = true;
        }
      };
      const timer = setTimeout(loadAd, 100);
      return () => clearTimeout(timer);
    } catch (error) {
      console.error('Erreur AdSense:', error);
    }
  }, []);

  return (
    <div className="w-full">
      <div className={`rounded-none overflow-hidden border-b ${
        isDarkMode ? 'bg-black border-gray-800' : 'bg-white border-gray-200'
      }`}>
        <div className={`px-4 py-2 text-xs font-medium ${
          isDarkMode ? 'text-gray-500' : 'text-gray-400'
        }`}>
          Publicité
        </div>
        <div className="px-4 pb-4 min-h-[250px]">
          <ins
            ref={adRef}
            className="adsbygoogle"
            style={{ display: 'block', minHeight: '250px' }}
            data-ad-client={CONFIG.googlePublisherId}
            data-ad-slot={slot}
            data-ad-format="auto"
            data-full-width-responsive="true"
          />
        </div>
      </div>
    </div>
  );
});

GoogleAd.displayName = 'GoogleAd';

// ============================================
// COMPOSANT SMART AD (PRINCIPAL)
// ============================================
const SmartAd = memo(({ 
  slot = 'feedInline',
  canClose = true,
  className = '',
  style = {}
}) => {
  // Détection du thème (dark mode)
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    // Détecter le dark mode
    const checkDarkMode = () => {
      const isDark = document.documentElement.classList.contains('dark') ||
                     window.matchMedia('(prefers-color-scheme: dark)').matches;
      setIsDarkMode(isDark);
    };
    
    checkDarkMode();
    
    // Observer les changements
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, { attributes: true });
    
    return () => observer.disconnect();
  }, []);

  if (!CONFIG.enabled) return null;

  const slotId = CONFIG.googleSlots[slot];
  const shouldUseDemoAds = CONFIG.useDemoAds || !slotId || slotId.includes('XXXXXXXXXX');

  return (
    <div className={className} style={style}>
      {shouldUseDemoAds ? (
        <DemoAd canClose={canClose} isDarkMode={isDarkMode} />
      ) : (
        <GoogleAd slot={slotId} isDarkMode={isDarkMode} />
      )}
    </div>
  );
});

SmartAd.displayName = 'SmartAd';

export default SmartAd;