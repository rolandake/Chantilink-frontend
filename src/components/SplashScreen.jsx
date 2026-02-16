// 📁 src/components/SplashScreen.jsx
// ✅ VERSION ULTRA-OPTIMISÉE LCP + INP

import { useEffect, useState } from "react";

export default function SplashScreen({ onFinish }) {
  const [isVisible, setIsVisible] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);
  const [logoLoaded, setLogoLoaded] = useState(false);

  // ✅ PRÉCHARGER LE LOGO IMMÉDIATEMENT
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = '/chantilink-logo.png';
    link.fetchPriority = 'high';
    document.head.appendChild(link);

    // Précharger l'image
    const img = new Image();
    img.fetchPriority = 'high';
    img.src = '/chantilink-logo.png';
    img.onload = () => setLogoLoaded(true);

    return () => {
      if (link.parentNode) {
        link.parentNode.removeChild(link);
      }
    };
  }, []);

  useEffect(() => {
    // Masquer le splash natif immédiatement si présent
    if (typeof window.hideSplashScreen === 'function') {
      window.hideSplashScreen();
    }

    // ✅ Attendre que le logo soit chargé
    if (!logoLoaded) return;

    // ✅ DURÉE RÉDUITE (600ms au lieu de 800ms)
    const fadeTimer = setTimeout(() => {
      setFadeOut(true);
    }, 600);

    // ✅ Masquer complètement (900ms au lieu de 1100ms)
    const hideTimer = setTimeout(() => {
      setIsVisible(false);
      onFinish?.();
    }, 900);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, [onFinish, logoLoaded]);

  if (!isVisible) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center transition-opacity duration-300 ${
        fadeOut ? 'opacity-0' : 'opacity-100'
      }`}
      style={{
        background: 'linear-gradient(135deg, #2B2D42 0%, #1a1b2e 100%)'
      }}
    >
      {/* Logo avec animation fluide */}
      <div className="flex flex-col items-center animate-fade-in">
        {/* ✅ Logo OPTIMISÉ pour LCP */}
        <img 
          src="/chantilink-logo.png" 
          alt="ChantiLink"
          className="w-32 h-32 md:w-40 md:h-40 object-contain mb-6"
          loading="eager"
          fetchpriority="high"
          width="160"
          height="160"
          decoding="async"
          style={{
            filter: logoLoaded ? 'drop-shadow(0 10px 40px rgba(230, 126, 60, 0.4))' : 'none',
            animation: logoLoaded ? 'float 2s ease-in-out infinite' : 'none',
            contentVisibility: 'auto'
          }}
        />
        
        {/* Texte avec gradient */}
        <div className="text-center">
          <h1 className="text-4xl font-black tracking-tight text-white uppercase">
            CHANTI<span className="bg-gradient-to-r from-[#E67E3C] to-[#ff9966] bg-clip-text text-transparent">LINK</span>
          </h1>
          
          {/* Barre animée */}
          <div 
            className="mt-3 h-1 bg-gradient-to-r from-transparent via-[#E67E3C] to-transparent mx-auto rounded-full animate-expand"
            style={{ width: '60px' }}
          />
        </div>
      </div>

      {/* Indicateur de chargement avec effet néon */}
      <div className="absolute bottom-16">
        <div className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2.5 h-2.5 rounded-full bg-[#E67E3C] animate-pulse"
              style={{
                boxShadow: '0 0 10px rgba(230, 126, 60, 0.5)',
                animationDelay: `${i * 150}ms`
              }}
            />
          ))}
        </div>
      </div>

      {/* ✅ CSS INLINÉ pour performance */}
      <style>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0) scale(1);
          }
          50% {
            transform: translateY(-10px) scale(1.05);
          }
        }

        @keyframes fade-in {
          from {
            opacity: 0;
            transform: scale(0.8);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes expand {
          from {
            width: 0;
          }
          to {
            width: 60px;
          }
        }

        .animate-fade-in {
          animation: fade-in 0.6s ease-out;
        }

        .animate-expand {
          animation: expand 0.4s ease-out 0.5s backwards;
        }

        .animate-float {
          animation: float 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}