// src/components/icons/AdminIcons.jsx
// ✅ Set d'icônes SVG custom, style minimaliste (traits fins, coins arrondis)
// cohérent avec les icônes déjà utilisées dans SettingsSection / AccountTypeSwitcher.
//
// Remplace lucide-react dans AdminDashboard.jsx. Les noms de composants
// sont identiques à ceux importés depuis 'lucide-react', donc il suffit
// de changer la ligne d'import :
//
//   - import { Users, Crown, ... } from 'lucide-react';
//   + import { Users, Crown, ... } from '../../components/icons/AdminIcons';
//
// API compatible : props size (number, def 24) et className.
//
// ✅ FIX : ajout de Briefcase et Building2 (utilisés dans AdminDashboard pour
//   les badges de type de compte "pro" et "business")

import React from "react";

const base = (size, className, style, props) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  className,
  style,
  ...props,
});

export const Users = ({ size = 24, className, style, ...props }) => (
  <svg {...base(size, className, style, props)}>
    <path d="M16 18v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 16.5V18" />
    <circle cx="9" cy="7.5" r="3.25" />
    <path d="M16.5 13.2A3.5 3.5 0 0 1 20 16.5V18" />
    <path d="M14.5 4.3a3.25 3.25 0 0 1 0 6.4" />
  </svg>
);

export const Crown = ({ size = 24, className, style, ...props }) => (
  <svg {...base(size, className, style, props)}>
    <path d="M3 8.5l3.2 2.3L9.5 6l2.5 4.8L14.5 6l3.3 4.8L21 8.5 19.5 18h-15L3 8.5z" />
    <path d="M6 18h12" />
  </svg>
);

export const CheckCircle = ({ size = 24, className, style, ...props }) => (
  <svg {...base(size, className, style, props)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8.5 12.2l2.3 2.3 4.7-5" />
  </svg>
);

export const Ban = ({ size = 24, className, style, ...props }) => (
  <svg {...base(size, className, style, props)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M6.2 6.2l11.6 11.6" />
  </svg>
);

export const Search = ({ size = 24, className, style, ...props }) => (
  <svg {...base(size, className, style, props)}>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="M19.5 19.5l-4.3-4.3" />
  </svg>
);

export const RotateCw = ({ size = 24, className, style, ...props }) => (
  <svg {...base(size, className, style, props)}>
    <path d="M19 12a7 7 0 1 1-2.1-5" />
    <path d="M19 5.5V10h-4.5" />
  </svg>
);

export const Mail = ({ size = 24, className, style, ...props }) => (
  <svg {...base(size, className, style, props)}>
    <rect x="3" y="5.5" width="18" height="13" rx="2.2" />
    <path d="M3.5 7l8.5 6 8.5-6" />
  </svg>
);

export const Trash2 = ({ size = 24, className, style, ...props }) => (
  <svg {...base(size, className, style, props)}>
    <path d="M4 7h16" />
    <path d="M9 7V5.2A1.2 1.2 0 0 1 10.2 4h3.6A1.2 1.2 0 0 1 15 5.2V7" />
    <path d="M6 7l.8 12a2 2 0 0 0 2 1.8h6.4a2 2 0 0 0 2-1.8L18 7" />
    <path d="M10 11v6M14 11v6" />
  </svg>
);

export const AlertCircle = ({ size = 24, className, style, ...props }) => (
  <svg {...base(size, className, style, props)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5v6" />
    <circle cx="12" cy="16.7" r="0.9" fill="currentColor" stroke="none" />
  </svg>
);

export const Shield = ({ size = 24, className, style, ...props }) => (
  <svg {...base(size, className, style, props)}>
    <path d="M12 3l7 3v5c0 4.5-2.9 8.3-7 10-4.1-1.7-7-5.5-7-10V6l7-3z" />
  </svg>
);

export const Clock = ({ size = 24, className, style, ...props }) => (
  <svg {...base(size, className, style, props)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5V12l3.2 1.9" />
  </svg>
);

export const Eye = ({ size = 24, className, style, ...props }) => (
  <svg {...base(size, className, style, props)}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
    <circle cx="12" cy="12" r="2.7" />
  </svg>
);

export const Activity = ({ size = 24, className, style, ...props }) => (
  <svg {...base(size, className, style, props)}>
    <path d="M3 12h3.5l2-6 4 12 2-7.5 1.5 3H21" />
  </svg>
);

export const Flag = ({ size = 24, className, style, ...props }) => (
  <svg {...base(size, className, style, props)}>
    <path d="M5 3.5v17" />
    <path d="M5 4.5h11.2c1 0 1.5 1.1.85 1.85l-2.6 2.95 2.6 2.95c.65.75.15 1.85-.85 1.85H5" />
  </svg>
);

export const TrendingUp = ({ size = 24, className, style, ...props }) => (
  <svg {...base(size, className, style, props)}>
    <path d="M3 16.5l6-6.2 4 4 7-7.8" />
    <path d="M14.5 6.5H20v5.5" />
  </svg>
);

export const AlertTriangle = ({ size = 24, className, style, ...props }) => (
  <svg {...base(size, className, style, props)}>
    <path d="M12 4.2l9.2 15.6a1 1 0 0 1-.86 1.5H3.66a1 1 0 0 1-.86-1.5L12 4.2z" />
    <path d="M12 10v4" />
    <circle cx="12" cy="17" r="0.9" fill="currentColor" stroke="none" />
  </svg>
);

// ✅ AJOUT — Briefcase (profil professionnel / pro)
export const Briefcase = ({ size = 24, className, style, ...props }) => (
  <svg {...base(size, className, style, props)}>
    <rect x="2" y="7" width="20" height="14" rx="2.2" />
    <path d="M16 7V5.5A2.5 2.5 0 0 0 13.5 3h-3A2.5 2.5 0 0 0 8 5.5V7" />
    <path d="M2 12h20" />
    <path d="M12 12v3" />
  </svg>
);

// ✅ AJOUT — Building2 (page entreprise / business)
export const Building2 = ({ size = 24, className, style, ...props }) => (
  <svg {...base(size, className, style, props)}>
    <path d="M3 21h18" />
    <path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" />
    <path d="M9 9h1.5M9 13h1.5M13.5 9H15M13.5 13H15" />
    <path d="M9 17h6v4H9z" />
  </svg>
);

export default {
  Users, Crown, CheckCircle, Ban, Search, RotateCw, Mail,
  Trash2, AlertCircle, Shield, Clock, Eye, Activity, Flag,
  TrendingUp, AlertTriangle, Briefcase, Building2,
};