// ============================================
// 📁 src/components/AdCard.jsx
// Composant de publicité Google AdSense
// ============================================
import React, { useEffect, useRef, memo } from 'react';
import { useDarkMode } from '../context/DarkModeContext';

const AdCard = memo(({ 
  slot = '', // Google AdSense slot ID
  format = 'auto', // Format de l'annonce
  responsive = true,
  style = {},
  className = ''
}) => {
  const { isDarkMode } = useDarkMode();
  const adRef = useRef(null);
  const adLoadedRef = useRef(false);

  useEffect(() => {
    // Charger Google AdSense uniquement si pas encore chargé
    if (!adLoadedRef.current && window) {
      try {
        // Attendre que le DOM soit prêt
        const loadAd = () => {
          if (window.adsbygoogle && adRef.current) {
            (window.adsbygoogle = window.adsbygoogle || []).push({});
            adLoadedRef.current = true;
          }
        };

        // Délai pour s'assurer que le composant est monté
        const timer = setTimeout(loadAd, 100);
        return () => clearTimeout(timer);
      } catch (error) {
        console.error('Erreur chargement AdSense:', error);
      }
    }
  }, []);

  return (
    <div 
      className={`w-full my-4 ${className}`}
      style={style}
    >
      <div className={`rounded-2xl overflow-hidden border ${
        isDarkMode 
          ? 'bg-gray-800/50 border-gray-700' 
          : 'bg-gray-50 border-gray-200'
      }`}>
        {/* Label "Publicité" */}
        <div className={`px-4 py-2 text-xs font-medium ${
          isDarkMode ? 'text-gray-500' : 'text-gray-400'
        }`}>
          Publicité
        </div>

        {/* Conteneur de l'annonce */}
        <div className="px-4 pb-4">
          <ins
            ref={adRef}
            className="adsbygoogle"
            style={{
              display: 'block',
              minHeight: '100px',
              ...style
            }}
            data-ad-client="ca-pub-9979082242566048" // À remplacer par votre ID
            data-ad-slot={slot}
            data-ad-format={format}
            data-full-width-responsive={responsive.toString()}
          />
        </div>
      </div>
    </div>
  );
});

AdCard.displayName = 'AdCard';

export default AdCard;