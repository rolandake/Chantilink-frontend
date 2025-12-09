// src/context/DarkModeContext.jsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const DarkModeContext = createContext();

export const useDarkMode = () => {
  const context = useContext(DarkModeContext);
  if (!context) throw new Error('useDarkMode must be used within DarkModeProvider');
  return context;
};

export const DarkModeProvider = ({ children }) => {
  // 1. Initialisation (élégante et sans erreur hook)
  const [isDarkMode, setIsDarkMode] = useState(() => {
    try {
      const saved = localStorage.getItem('chantilink_darkMode');
      if (saved !== null) return JSON.parse(saved);
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch (e) {
      return false; // Fallback sécurité
    }
  });

  // 2. Écouteur changement système (OS)
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => {
      // On ne change que si l'utilisateur n'a pas forcé une préférence manuelle
      if (localStorage.getItem('chantilink_darkMode') === null) {
        setIsDarkMode(e.matches);
      }
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // 3. Application du Thème (Le Cœur du Fix)
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;

    const applyTheme = () => {
      if (isDarkMode) {
        // === MODE SOMBRE (Optimisé pour Admin) ===
        root.classList.add('dark');
        root.style.colorScheme = 'dark'; // ✅ Force les scrollbars et inputs en sombre

        // Fond légèrement moins noir pur pour éviter le ghosting sur mobile, mais très sombre
        body.style.background = '#0a0a0a'; 
        body.style.color = '#ededed';

        const vars = {
          '--bg-primary': '#0a0a0a',     // Fond principal
          '--bg-secondary': '#171717',   // Sidebar / Cards (plus clair)
          '--bg-tertiary': '#262626',    // Hover / Inputs
          '--bg-input': '#1f1f1f',       // Spécifique pour les formulaires admin
          
          '--text-primary': '#ededed',   // Blanc cassé (moins agressif)
          '--text-secondary': '#a3a3a3', // Gris neutre
          '--text-muted': '#525252',     // Texte désactivé

          '--border-color': '#262626',   // Bordures subtiles
          '--shadow': '0 4px 6px -1px rgba(0, 0, 0, 0.5)',
        };
        Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
        updateMetaThemeColor('#0a0a0a');

      } else {
        // === MODE CLAIR ===
        root.classList.remove('dark');
        root.style.colorScheme = 'light';

        body.style.background = '#ffffff';
        body.style.color = '#171717';

        const vars = {
          '--bg-primary': '#ffffff',
          '--bg-secondary': '#f5f5f5',   // Sidebar léger gris
          '--bg-tertiary': '#e5e5e5',
          '--bg-input': '#ffffff',
          
          '--text-primary': '#171717',
          '--text-secondary': '#525252',
          '--text-muted': '#a3a3a3',

          '--border-color': '#e5e5e5',
          '--shadow': '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        };
        Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
        updateMetaThemeColor('#ffffff');
      }

      localStorage.setItem('chantilink_darkMode', JSON.stringify(isDarkMode));
    };

    applyTheme();
  }, [isDarkMode]);

  // Helper pour la barre de statut mobile
  const updateMetaThemeColor = useCallback((color) => {
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = color;
  }, []);

  const toggleDarkMode = useCallback(() => setIsDarkMode(prev => !prev), []);
  
  const resetDarkMode = useCallback(() => {
    localStorage.removeItem('chantilink_darkMode');
    setIsDarkMode(window.matchMedia('(prefers-color-scheme: dark)').matches);
  }, []);

  return (
    <DarkModeContext.Provider value={{ isDarkMode, toggleDarkMode, resetDarkMode }}>
      {children}
    </DarkModeContext.Provider>
  );
};