// src/context/DarkModeContext.jsx - FIX ADMIN VISIBILITY
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const DarkModeContext = createContext();

export const useDarkMode = () => {
  const context = useContext(DarkModeContext);
  if (!context) throw new Error('useDarkMode must be used within DarkModeProvider');
  return context;
};

export const DarkModeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('chantilink_darkMode');
    return saved !== null ? JSON.parse(saved) : window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // === ÉCOUTEUR SYSTÈME ===
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => {
      if (localStorage.getItem('chantilink_darkMode') === null) {
        setIsDarkMode(e.matches);
      }
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // === APPLICATION THÈME ===
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;

    const applyTheme = () => {
      if (isDarkMode) {
        root.classList.add('dark');
        
        // ✅ FIX: Gradient plus visible avec meilleur contraste
        body.style.background = 'linear-gradient(to bottom, #0f0f0f, #1a1a1a)';
        body.style.color = '#f5f5f5';

        const vars = {
          '--bg-primary': '#0f0f0f',
          '--bg-secondary': '#1a1a1a',
          '--bg-tertiary': '#242424',
          '--text-primary': '#f5f5f5',
          '--text-secondary': '#b0b0b0',
          '--border-color': 'rgba(255, 255, 255, 0.1)',
          '--shadow': 'rgba(0, 0, 0, 0.8)',
        };
        Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
        updateMetaThemeColor('#0f0f0f');
      } else {
        root.classList.remove('dark');
        body.style.background = 'linear-gradient(to bottom, #ffffff, #fafafa)';
        body.style.color = '#111111';

        const vars = {
          '--bg-primary': '#ffffff',
          '--bg-secondary': '#fafafa',
          '--bg-tertiary': '#f0f0f0',
          '--text-primary': '#111111',
          '--text-secondary': '#666666',
          '--border-color': 'rgba(0, 0, 0, 0.1)',
          '--shadow': 'rgba(0, 0, 0, 0.1)',
        };
        Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
        updateMetaThemeColor('#ffffff');
      }

      body.style.transition = 'background 0.3s ease, color 0.3s ease';
      localStorage.setItem('chantilink_darkMode', JSON.stringify(isDarkMode));
    };

    applyTheme();
  }, [isDarkMode]);

  // === META THEME COLOR ===
  const updateMetaThemeColor = useCallback((color) => {
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = color;
  }, []);

  // === ACTIONS ===
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
