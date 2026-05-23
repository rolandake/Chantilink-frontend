// src/pages/Profile/SettingsSection.jsx
import React, { useState, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import MonetisationProgram from "./Monetisation/MonetisationProgram";
import MonetisationDashboard from "./Monetisation/MonetisationDashboard";
import CreateOffer from "./Monetisation/CreateOffer";
import MyClients from "./Monetisation/MyClients";
import RevenueStats from "./Monetisation/RevenueStats";
import Payouts from "./Monetisation/Payouts";
import StorageManager from "./StorageManager";
import { useAuth } from '../../context/AuthContext';
import { useDarkMode } from '../../context/DarkModeContext';

const AdminDashboard = lazy(() => import('../Admin/AdminDashboard'));

// ── ICÔNES SVG ────────────────────────────────────────────────────────────────
const Icons = {
  program: () => (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l7 3v5c0 4.5-2.9 8.3-7 10-4.1-1.7-7-5.5-7-10V6l7-3z" />
      <path d="M9 12l2 2 4-5" />
    </svg>
  ),
  dashboard: () => (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  ),
  create: () => (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  ),
  clients: () => (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="7" r="3.5" />
      <path d="M2 21c0-4 3.1-7 7-7" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M14 21c0-3 1.8-5 4.5-5s4.5 2 4.5 5" />
    </svg>
  ),
  stats: () => (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 17l4-6 4 4 4-7 4 4" />
      <path d="M3 21h18" />
    </svg>
  ),
  payouts: () => (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="6" width="20" height="13" rx="2" />
      <path d="M2 10h20" />
      <path d="M6 15h4" />
    </svg>
  ),
  storage: () => (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="6" rx="8" ry="3" />
      <path d="M4 6v4c0 1.66 3.58 3 8 3s8-1.34 8-3V6" />
      <path d="M4 14v4c0 1.66 3.58 3 8 3s8-1.34 8-3v-4" />
    </svg>
  ),
  admin: () => (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l2.09 6.26L20 9.27l-5 4.87 1.18 6.88L12 17.77l-4.18 3.25L9 14.14 4 9.27l5.91-1.01L12 2z" />
    </svg>
  ),
};

// ── LOADING ───────────────────────────────────────────────────────────────────
const LoadingSpinner = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
    <div style={{
      width: 40, height: 40,
      border: '3px solid rgba(249,115,22,0.2)',
      borderTopColor: '#f97316',
      borderRadius: '50%',
      animation: 'spin 0.8s linear infinite',
    }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

// ── MAIN ──────────────────────────────────────────────────────────────────────
export default function SettingsSection({ user, showToast }) {
  const [activeTab, setActiveTab] = useState("programme");
  const { isAdmin } = useAuth();
  const { isDarkMode } = useDarkMode();
  const userIsAdmin = isAdmin();

  const TABS = [
    { id: "programme", label: "Programme",      IconComp: Icons.program  },
    { id: "dashboard", label: "Tableau de bord", IconComp: Icons.dashboard },
    { id: "create",    label: "Créer une offre",  IconComp: Icons.create   },
    { id: "clients",   label: "Mes clients",       IconComp: Icons.clients  },
    { id: "revenus",   label: "Statistiques",      IconComp: Icons.stats    },
    { id: "retraits",  label: "Retraits",           IconComp: Icons.payouts  },
    { id: "storage",   label: "Stockage",           IconComp: Icons.storage  },
    ...(userIsAdmin ? [{ id: "admin", label: "Admin", IconComp: Icons.admin, badge: "Admin" }] : []),
  ];

  const renderContent = () => {
    switch (activeTab) {
      case "programme": return <MonetisationProgram user={user} showToast={showToast} onNavigate={setActiveTab} />;
      case "dashboard": return <MonetisationDashboard />;
      case "create":    return <CreateOffer />;
      case "clients":   return <MyClients />;
      case "revenus":   return <RevenueStats />;
      case "retraits":  return <Payouts />;
      case "storage":   return <StorageManager user={user} showToast={showToast} />;
      case "admin":
        if (!userIsAdmin) return (
          <div style={{ textAlign: 'center', padding: '48px 0', fontFamily: "'Sora','DM Sans',sans-serif" }}>
            <p style={{ fontSize: 16, fontWeight: 600, color: '#ef4444' }}>
              ⛔ Accès réservé aux administrateurs
            </p>
          </div>
        );
        return <Suspense fallback={<LoadingSpinner />}><AdminDashboard /></Suspense>;
      default: return null;
    }
  };

  const bdr        = isDarkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
  const sub        = isDarkMode ? '#6b7280' : '#9ca3af';
  const cardBg     = isDarkMode ? 'rgba(10,10,10,0.98)' : 'rgba(255,255,255,0.98)';
  const cardShadow = isDarkMode ? '0 4px 24px rgba(0,0,0,0.4)' : '0 2px 16px rgba(0,0,0,0.07)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: "'Sora','DM Sans',sans-serif" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }

        .s-tab {
          position: relative;
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 5px;
          padding: 13px 8px 15px;
          border: none;
          background: none;
          cursor: pointer;
          font-family: 'Sora','DM Sans',sans-serif;
          transition: color 0.2s;
          outline: none;
          min-width: 80px;
        }
        .s-tab .s-icon-wrap {
          display: flex; align-items: center; justify-content: center;
          width: 36px; height: 36px; border-radius: 10px;
          transition: background 0.25s, transform 0.2s;
        }
        .s-tab:hover .s-icon-wrap {
          transform: translateY(-2px);
          background: rgba(249,115,22,0.08);
        }
        .s-tab.active .s-icon-wrap {
          background: linear-gradient(135deg, rgba(249,115,22,0.15), rgba(236,72,153,0.12));
        }

        .settings-select {
          width: 100%;
          padding: 13px 42px 13px 16px;
          border-radius: 14px;
          font-family: 'Sora','DM Sans',sans-serif;
          font-size: 14px;
          font-weight: 600;
          appearance: none;
          background-repeat: no-repeat;
          background-position: right 14px center;
          cursor: pointer;
          outline: none;
          transition: border-color 0.2s;
        }
        .settings-select:focus { border-color: #f97316; }

        @media (min-width: 768px) {
          .s-mobile  { display: none !important; }
          .s-desktop { display: flex !important; }
        }
        @media (max-width: 767px) {
          .s-mobile  { display: block !important; }
          .s-desktop { display: none  !important; }
        }
      `}</style>

      {/* ── MOBILE SELECT ── */}
      <div className="s-mobile">
        <select
          className="settings-select"
          value={activeTab}
          onChange={(e) => setActiveTab(e.target.value)}
          style={{
            background: isDarkMode ? '#0a0a0a' : '#fff',
            color: isDarkMode ? '#f3f4f6' : '#111827',
            border: `1px solid ${bdr}`,
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2.5' stroke-linecap='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
          }}
        >
          {TABS.map(({ id, label }) => (
            <option key={id} value={id}>{label}</option>
          ))}
        </select>
      </div>

      {/* ── TAB BAR DESKTOP ── */}
      <div
        className="s-desktop"
        style={{
          background: cardBg,
          backdropFilter: 'blur(20px)',
          borderRadius: 20,
          border: `1px solid ${bdr}`,
          overflow: 'hidden',
          boxShadow: cardShadow,
        }}
      >
        <div style={{
          display: 'flex',
          overflowX: 'auto',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}>
          {TABS.map(({ id, label, IconComp, badge }) => {
            const isActive = id === activeTab;
            return (
              <button
                key={id}
                className={`s-tab${isActive ? ' active' : ''}`}
                onClick={() => setActiveTab(id)}
                style={{ color: isActive ? '#f97316' : sub, fontWeight: isActive ? 700 : 400 }}
              >
                {/* Icône SVG dans wrapper */}
                <span className="s-icon-wrap">
                  <IconComp />
                </span>

                {/* Label + badge */}
                <span style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}>
                  {label}
                  {badge && (
                    <span style={{
                      padding: '1px 6px', borderRadius: 999,
                      fontSize: 9, fontWeight: 700,
                      background: '#ef4444', color: '#fff',
                      letterSpacing: '0.02em',
                    }}>
                      {badge}
                    </span>
                  )}
                </span>

                {/* Underline animé */}
                {isActive && (
                  <motion.div
                    layoutId="settings-underline"
                    style={{
                      position: 'absolute', bottom: 0,
                      left: '15%', right: '15%',
                      height: 3, borderRadius: '3px 3px 0 0',
                      background: 'linear-gradient(90deg,#f97316,#ec4899)',
                    }}
                    transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── CONTENU ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2 }}
          style={{
            padding: 24,
            borderRadius: 20,
            minHeight: 300,
            background: cardBg,
            border: `1px solid ${bdr}`,
            backdropFilter: 'blur(20px)',
            boxShadow: cardShadow,
          }}
        >
          {renderContent()}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
