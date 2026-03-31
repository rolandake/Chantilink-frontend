// src/context/DarkModeContext.jsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────
/**
 * @typedef {'light' | 'dark' | 'system'} ColorScheme
 *
 * @typedef {Object} DarkModeContextValue
 * @property {boolean}      isDarkMode     - Thème actuel résolu
 * @property {ColorScheme}  colorScheme    - Préférence explicite ('light' | 'dark' | 'system')
 * @property {() => void}   toggleDarkMode - Bascule light ↔ dark (persiste la préférence)
 * @property {(scheme: ColorScheme) => void} setColorScheme - Forcer un mode précis
 * @property {() => void}   resetToSystem  - Revenir au suivi du système (= 'system')
 */

const DarkModeContext = createContext(/** @type {DarkModeContextValue | null} */ (null));

// ─── Constantes ─────────────────────────────────────────────────────────────

const STORAGE_KEY = 'chantilink_colorScheme'; // 'light' | 'dark' | 'system'

/**
 * Tokens de design système – niveau "Premium Dark".
 * Chaque token utilise une valeur très précise pour un rendu raffiné.
 */
const TOKENS = {
  dark: {
    // Surfaces
    '--surface-0': '#080808',   // Page root – quasi noir absolu
    '--surface-1': '#111111',   // Sidebar, drawers
    '--surface-2': '#1a1a1a',   // Cards, modals
    '--surface-3': '#222222',   // Inputs, badges
    '--surface-hover': '#2a2a2a',
    '--surface-active': '#333333',

    // Texte
    '--text-primary':   'rgba(255,255,255,0.92)',
    '--text-secondary': 'rgba(255,255,255,0.55)',
    '--text-tertiary':  'rgba(255,255,255,0.28)',
    '--text-disabled':  'rgba(255,255,255,0.18)',

    // Bordures & séparateurs
    '--border-subtle':  'rgba(255,255,255,0.06)',
    '--border-default': 'rgba(255,255,255,0.10)',
    '--border-strong':  'rgba(255,255,255,0.18)',

    // Couleur de schéma (scrollbars natives, inputs system)
    '--color-scheme': 'dark',

    // Ombres (portées quasi invisibles en dark, juste un outline subtil)
    '--shadow-sm': '0 0 0 1px rgba(255,255,255,0.05)',
    '--shadow-md': '0 4px 24px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.05)',
    '--shadow-lg': '0 8px 40px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.06)',

    // Meta mobile
    '--meta-color': '#080808',
  },
  light: {
    '--surface-0': '#ffffff',
    '--surface-1': '#f7f7f5',   // Blanc chaud – moins clinique que #f5f5f5
    '--surface-2': '#f0efed',
    '--surface-3': '#e8e7e4',
    '--surface-hover': '#ebebea',
    '--surface-active': '#e0dfdc',

    '--text-primary':   'rgba(0,0,0,0.88)',
    '--text-secondary': 'rgba(0,0,0,0.52)',
    '--text-tertiary':  'rgba(0,0,0,0.30)',
    '--text-disabled':  'rgba(0,0,0,0.22)',

    '--border-subtle':  'rgba(0,0,0,0.05)',
    '--border-default': 'rgba(0,0,0,0.09)',
    '--border-strong':  'rgba(0,0,0,0.16)',

    '--color-scheme': 'light',

    '--shadow-sm': '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
    '--shadow-md': '0 4px 16px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.05)',
    '--shadow-lg': '0 8px 32px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)',

    '--meta-color': '#ffffff',
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Lit la préférence système (SSR-safe) */
const prefersDark = () =>
  typeof window !== 'undefined'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : false;

/** Résout un ColorScheme en booléen */
const resolve = (scheme) =>
  scheme === 'system' ? prefersDark() : scheme === 'dark';

/** Lit la préférence stockée, avec fallback gracieux */
const readStoredScheme = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
  } catch (_) { /* storage bloqué (iframe sandboxé, etc.) */ }
  return 'system';
};

// ─── Application des tokens ───────────────────────────────────────────────

let _scheduledFrame = null;

/**
 * Applique les tokens de design et les attributs de mode sur <html>.
 * Batché via requestAnimationFrame pour éviter les repaints multiples.
 */
const applyTokens = (isDark) => {
  if (_scheduledFrame) cancelAnimationFrame(_scheduledFrame);
  _scheduledFrame = requestAnimationFrame(() => {
    const root = document.documentElement;
    const tokens = isDark ? TOKENS.dark : TOKENS.light;

    // 1. Tokens CSS
    const style = root.style;
    for (const [k, v] of Object.entries(tokens)) {
      if (k !== '--meta-color') style.setProperty(k, v);
    }

    // 2. Classe utilitaire + attribut data pour Tailwind / sélecteurs CSS
    root.classList.toggle('dark', isDark);
    root.setAttribute('data-theme', isDark ? 'dark' : 'light');

    // 3. color-scheme natif (scrollbars, input caret, autocomplete)
    style.colorScheme = isDark ? 'dark' : 'light';

    // 4. Couleur de barre de statut mobile
    _setMetaThemeColor(tokens['--meta-color']);

    _scheduledFrame = null;
  });
};

const _setMetaThemeColor = (color) => {
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
  }
  meta.content = color;
};

// ─── Provider ─────────────────────────────────────────────────────────────

export const DarkModeProvider = ({ children }) => {
  // Initialisation synchrone depuis localStorage (évite le flash)
  const [colorScheme, setColorSchemeState] = useState(readStoredScheme);
  const isDarkMode = resolve(colorScheme);

  // Ref pour accéder à la valeur courante dans l'écouteur sans re-créer le listener
  const schemeRef = useRef(colorScheme);
  schemeRef.current = colorScheme;

  // ── Application initiale & à chaque changement ──
  useEffect(() => {
    applyTokens(isDarkMode);
  }, [isDarkMode]);

  // ── Suivi du changement de préférence système ──
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onSystemChange = (e) => {
      // Ne réagit que si l'utilisateur suit le système
      if (schemeRef.current === 'system') applyTokens(e.matches);
    };
    mq.addEventListener('change', onSystemChange);
    return () => mq.removeEventListener('change', onSystemChange);
  }, []);

  // ── Helpers stables ──
  const setColorScheme = useCallback((scheme) => {
    setColorSchemeState(scheme);
    try { localStorage.setItem(STORAGE_KEY, scheme); } catch (_) {}
  }, []);

  const toggleDarkMode = useCallback(() => {
    // Depuis 'system', on détermine d'abord l'état résolu avant de basculer
    setColorScheme(schemeRef.current === 'dark' || (schemeRef.current === 'system' && prefersDark())
      ? 'light'
      : 'dark'
    );
  }, [setColorScheme]);

  const resetToSystem = useCallback(() => {
    setColorScheme('system');
  }, [setColorScheme]);

  return (
    <DarkModeContext.Provider
      value={{ isDarkMode, colorScheme, toggleDarkMode, setColorScheme, resetToSystem }}
    >
      {children}
    </DarkModeContext.Provider>
  );
};

// ─── Hook ─────────────────────────────────────────────────────────────────

export const useDarkMode = () => {
  const ctx = useContext(DarkModeContext);
  if (!ctx) throw new Error('useDarkMode must be used within <DarkModeProvider>');
  return ctx;
};

// ─── Inline script de pré-application (NO-FLASH) ─────────────────────────
// Copiez ce <script> en premier enfant de <head> dans votre index.html
// pour appliquer le mode AVANT le premier rendu React (évite le flash blanc→noir).
//
// <script>
//   (function() {
//     var s = 'chantilink_colorScheme';
//     var v = localStorage.getItem(s);
//     var dark = v === 'dark' || (v !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
//     document.documentElement.classList.toggle('dark', dark);
//     document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
//     document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
//   })();
// </script>