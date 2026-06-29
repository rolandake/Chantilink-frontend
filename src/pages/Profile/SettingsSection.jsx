// src/pages/profile/SettingsSection.jsx
// v4.1 — Refonte visuelle : onglets en accordéon déroulant (1 panneau ouvert à la fois)
//   - Remplace l'ancienne double barre (mobile/desktop) par une liste verticale unique
//   - Chaque ligne se déplie sur place pour afficher son contenu (style "paramètres pro")
//   - AccountTypeSwitcher reste fixe en haut
//   - ✅ FIX route : utilise PATCH /api/users/:id/pro (la seule route qui accepte accountType
//     pour personal/business/pro) au lieu de /:id/account-type qui n'existe pas côté backend
//   - ✅ FIX v4.1 : item "Entreprise" retiré du groupe "Compte" pour les comptes pro —
//     BusinessProfileForm est 100% dédié à accountType "business" (toggle + champs
//     businessName/businessCategory/etc. + route PATCH /:id/business). Le profil pro
//     gère déjà tout depuis l'onglet "CV" du profil (ProCVView), pas depuis Paramètres.

import React, { useState, useEffect, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import MonetisationProgram   from "./Monetisation/MonetisationProgram";
import MonetisationDashboard from "./Monetisation/MonetisationDashboard";
import OffersSection         from "./Monetisation/OffersSection";
import MyClients             from "./Monetisation/MyClients";
import StatsSection          from "./Monetisation/StatsSection";
import WithdrawalsSection    from "./Monetisation/WithdrawalsSection";
import TransactionsSection   from "./Monetisation/TransactionsSection";
import StorageManager        from "./StorageManager";
import BusinessProfileForm   from "./Business/BusinessProfileForm";
import MyOpportunities       from "./Business/MyOpportunities";
import AccountTypeSwitcher   from "./AccountTypeSwitcher";
import { useAuth }           from '../../context/AuthContext';
import { useDarkMode }       from '../../context/DarkModeContext';
import LanguageSelector      from "../../components/LanguageSelector";
import PrivacyPolicy         from "../../components/legal/PrivacyPolicy";
import { PROFILE_BACKEND_BASE } from "./profileApi";

const AdminDashboard = lazy(() => import('../Admin/AdminDashboard'));
const BASE_URL       = PROFILE_BACKEND_BASE;

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
  language: () => (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 5h8" />
      <path d="M8 3v2" />
      <path d="M5 9c1.5 3 4.5 5.5 8 6.5" />
      <path d="M11 5c-.5 4-2.8 7-6 9" />
      <path d="M14 19l4-9 4 9" />
      <path d="M15.5 16h5" />
    </svg>
  ),
  about: () => (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 10v6" />
      <path d="M12 7h.01" />
    </svg>
  ),
  admin: () => (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l2.09 6.26L20 9.27l-5 4.87 1.18 6.88L12 17.77l-4.18 3.25L9 14.14 4 9.27l5.91-1.01L12 2z" />
    </svg>
  ),
  business: () => (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="15" rx="2" />
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
      <path d="M12 12v4" />
      <path d="M8 12v4" />
      <path d="M16 12v4" />
    </svg>
  ),
  myOpportunities: () => (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="7.5" width="19" height="13" rx="2.5" />
      <path d="M8 7.5V6a3 3 0 0 1 3-3h2a3 3 0 0 1 3 3v1.5" />
      <path d="M2.5 13h19" />
    </svg>
  ),
  chevron: () => (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 6l6 6-6 6" />
    </svg>
  ),
};

// ── LOADING ───────────────────────────────────────────────────────────────────
const LoadingSpinner = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
    <div style={{
      width: 36, height: 36,
      border: '3px solid rgba(249,115,22,0.2)',
      borderTopColor: '#f97316',
      borderRadius: '50%',
      animation: 'spin 0.8s linear infinite',
    }} />
  </div>
);

// ── MAIN ──────────────────────────────────────────────────────────────────────
export default function SettingsSection({ user, showToast, onUserUpdated }) {
  const isBusiness = user?.accountType === "business";
  const isPro      = user?.accountType === "pro";

  // ✅ FIX v4.1 : un compte pro n'a pas de panneau "business" dans Paramètres
  // (BusinessProfileForm est dédié aux pages entreprise), donc l'onglet par
  // défaut pour un pro retombe sur "storage" plutôt que "business".
  const [openTab, setOpenTab] = useState(
    isBusiness ? "business" : (isPro ? "storage" : "programme")
  );
  const { isAdmin, getToken } = useAuth();
  const { isDarkMode } = useDarkMode();
  const userIsAdmin = isAdmin();

  const [changingType, setChangingType] = useState(false);

  const handleAccountTypeChange = async (newType) => {
    if (!user?._id) {
      showToast?.("Utilisateur introuvable", "error");
      return;
    }
    if (newType === user?.accountType) return;

    setChangingType(true);
    try {
      const token = await getToken?.();
      if (!token) throw new Error("Session expirée");

      // ✅ FIX : /:id/account-type n'existe pas côté backend.
      // /:id/pro accepte accountType pour personal | business | pro.
      const { data } = await axios.patch(
        `${BASE_URL}/api/users/${user._id}/pro`,
        { accountType: newType },
        {
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          timeout: 10000,
        }
      );

      const updatedUser = data?.user || { ...user, accountType: newType };
      onUserUpdated?.(updatedUser);
      // ✅ FIX v4.1 : business → onglet business ; pro → onglet storage (pas de panneau business pour un pro)
      setOpenTab(newType === "business" ? "business" : (newType === "pro" ? "storage" : "programme"));
      showToast?.("✅ Type de compte mis à jour !", "success");
    } catch (err) {
      showToast?.(
        err?.response?.data?.message || err.message || "Erreur lors du changement de type",
        "error"
      );
    } finally {
      setChangingType(false);
    }
  };

  // ── Groupes d'onglets (sections) selon accountType ──────────────────────
  const GROUPS = [
    {
      label: "Monétisation",
      hidden: isBusiness || isPro,
      items: [
        { id: "programme",    label: "Programme",       desc: "Activer et suivre le programme créateur", IconComp: Icons.program   },
        { id: "dashboard",    label: "Tableau de bord", desc: "Vue d'ensemble de votre activité",         IconComp: Icons.dashboard },
        { id: "create",       label: "Offres",          desc: "Créer et gérer vos offres",                IconComp: Icons.create    },
        { id: "clients",      label: "Mes clients",     desc: "Liste et suivi de vos clients",             IconComp: Icons.clients   },
        { id: "revenus",      label: "Statistiques",    desc: "Performances et revenus",                   IconComp: Icons.stats     },
        { id: "transactions", label: "Transactions",    desc: "Historique des paiements",                  IconComp: Icons.payouts   },
        { id: "retraits",     label: "Retraits",        desc: "Demander et suivre vos retraits",           IconComp: Icons.payouts   },
      ],
    },
    {
      label: "Compte",
      hidden: false,
      items: [
        { id: "storage", label: "Stockage", desc: "Gérer l'espace utilisé par vos médias", IconComp: Icons.storage },
        // ✅ FIX v4.1 : item "Entreprise" retiré pour les comptes pro — BusinessProfileForm
        // ne gère que accountType "business" (toggle + champs business*), un profil pro
        // gère son CV depuis l'onglet "CV" du profil, pas depuis Paramètres.
        ...(!isPro ? [{
          id: "business", label: "Entreprise",
          desc: "Informations de votre page entreprise",
          IconComp: Icons.business, badge: isBusiness ? "Actif" : null,
        }] : []),
        ...(isBusiness ? [
          { id: "myOpportunities", label: "Mes offres", desc: "Offres publiées par votre entreprise", IconComp: Icons.myOpportunities },
        ] : []),
      ],
    },
    {
      label: "Général",
      hidden: false,
      items: [
        { id: "language", label: "Langue",   desc: "Langue de l'application et du contenu", IconComp: Icons.language },
        { id: "about",    label: "À propos", desc: "Politique de confidentialité",          IconComp: Icons.about    },
        ...(userIsAdmin ? [{ id: "admin", label: "Admin", desc: "Outils de modération", IconComp: Icons.admin, badge: "Admin" }] : []),
      ],
    },
  ];

  const visibleIds = GROUPS.filter(g => !g.hidden).flatMap(g => g.items.map(i => i.id));

  useEffect(() => {
    if (!visibleIds.includes(openTab)) {
      setOpenTab(isBusiness ? "business" : (isPro ? "storage" : "programme"));
    }
  }, [isBusiness, isPro]); // eslint-disable-line react-hooks/exhaustive-deps

  const bdr        = isDarkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
  const sub        = isDarkMode ? '#9ca3af' : '#6b7280';
  const muted      = isDarkMode ? '#6b7280' : '#9ca3af';
  const cardBg     = isDarkMode ? 'rgba(255,255,255,0.02)' : '#ffffff';
  const panelBg    = isDarkMode ? 'rgba(255,255,255,0.015)' : '#fafafa';
  const groupLabel = isDarkMode ? '#71717a' : '#9ca3af';
  const titleColor = isDarkMode ? '#f9fafb' : '#111827';

  const renderContent = (id) => {
    switch (id) {
      case "programme":    return <MonetisationProgram user={user} showToast={showToast} onNavigate={setOpenTab} />;
      case "dashboard":    return <MonetisationDashboard />;
      case "create":       return <OffersSection />;
      case "clients":      return <MyClients />;
      case "revenus":      return <StatsSection />;
      case "transactions": return <TransactionsSection />;
      case "retraits":     return <WithdrawalsSection />;
      case "storage":      return <StorageManager user={user} showToast={showToast} />;
      case "business":     return <BusinessProfileForm user={user} showToast={showToast} onUserUpdated={onUserUpdated} />;
      case "myOpportunities": return <MyOpportunities user={user} showToast={showToast} />;

      case "language":
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <p style={{ margin: 0, fontSize: 13, color: sub, lineHeight: 1.6 }}>
              Les menus, les vidéos recommandées et les textes des publications seront adaptés à la langue choisie.
            </p>
            <LanguageSelector variant="pills" />
          </div>
        );

      case "about":
        return (
          <div
            className="settings-privacy-readable"
            style={{
              borderRadius: 14,
              background: isDarkMode ? '#0f172a' : '#ffffff',
              border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.1)'}`,
              overflow: 'hidden',
            }}
          >
            <style>{`
              .settings-privacy-readable, .settings-privacy-readable p,
              .settings-privacy-readable li, .settings-privacy-readable section {
                color: ${isDarkMode ? '#e5e7eb' : '#1f2937'} !important;
              }
              .settings-privacy-readable h1, .settings-privacy-readable h2, .settings-privacy-readable strong {
                color: ${isDarkMode ? '#f9fafb' : '#111827'} !important;
              }
              .settings-privacy-readable h1 { color: #f97316 !important; }
              .settings-privacy-readable a {
                color: ${isDarkMode ? '#93c5fd' : '#2563eb'} !important;
                text-decoration: underline;
              }
            `}</style>
            <div style={{ maxHeight: '65vh', overflowY: 'auto', padding: 4 }}>
              <PrivacyPolicy />
            </div>
          </div>
        );

      case "admin":
        if (!userIsAdmin) return (
          <p style={{ textAlign: 'center', padding: '24px 0', fontSize: 14, fontWeight: 600, color: '#ef4444' }}>
            ⛔ Accès réservé aux administrateurs
          </p>
        );
        return <Suspense fallback={<LoadingSpinner />}><AdminDashboard /></Suspense>;

      default: return null;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, fontFamily: "'Sora','DM Sans',sans-serif" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Sélecteur de type de compte */}
      <div style={{ opacity: changingType ? 0.6 : 1, pointerEvents: changingType ? 'none' : 'auto', transition: 'opacity 0.2s' }}>
        <AccountTypeSwitcher
          currentType={user?.accountType || "personal"}
          onChange={handleAccountTypeChange}
        />
      </div>

      {/* Liste accordéon groupée */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        {GROUPS.filter(g => !g.hidden).map((group) => (
          <div key={group.label} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{
              fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: groupLabel, padding: '0 4px',
            }}>
              {group.label}
            </span>

            <div style={{
              borderRadius: 16, border: `1px solid ${bdr}`, background: cardBg,
              overflow: 'hidden',
            }}>
              {group.items.map(({ id, label, desc, IconComp, badge }, idx) => {
                const isOpen = openTab === id;
                const badgeColor = badge === "Actif" ? "#22c55e" : (badge === "Pro" ? "#3b82f6" : "#ef4444");
                return (
                  <div
                    key={id}
                    style={{ borderTop: idx === 0 ? 'none' : `1px solid ${bdr}` }}
                  >
                    <button
                      type="button"
                      onClick={() => setOpenTab(isOpen ? null : id)}
                      aria-expanded={isOpen}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                        padding: '14px 16px', border: 'none', cursor: 'pointer',
                        background: isOpen ? (isDarkMode ? 'rgba(249,115,22,0.07)' : '#fff7ed') : 'transparent',
                        textAlign: 'left', fontFamily: "'Sora','DM Sans',sans-serif",
                        transition: 'background 0.15s',
                      }}
                    >
                      <span style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                        color: isOpen ? '#f97316' : sub,
                        background: isOpen
                          ? 'linear-gradient(135deg, rgba(249,115,22,0.15), rgba(236,72,153,0.12))'
                          : (isDarkMode ? 'rgba(255,255,255,0.04)' : '#f4f4f5'),
                        transition: 'all 0.2s',
                      }}>
                        <IconComp />
                      </span>

                      <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                        <span style={{
                          fontSize: 14.5, fontWeight: isOpen ? 700 : 600,
                          color: isOpen ? '#f97316' : titleColor,
                          display: 'flex', alignItems: 'center', gap: 8,
                        }}>
                          {label}
                          {badge && (
                            <span style={{
                              padding: '1px 7px', borderRadius: 999, fontSize: 9.5, fontWeight: 800,
                              background: badgeColor, color: '#fff', letterSpacing: '0.02em',
                            }}>
                              {badge}
                            </span>
                          )}
                        </span>
                        <span style={{
                          fontSize: 12, color: muted, overflow: 'hidden',
                          textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {desc}
                        </span>
                      </span>

                      <motion.span
                        animate={{ rotate: isOpen ? 90 : 0 }}
                        transition={{ duration: 0.2 }}
                        style={{ color: isOpen ? '#f97316' : muted, flexShrink: 0 }}
                      >
                        <Icons.chevron />
                      </motion.span>
                    </button>

                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          key="panel"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25, ease: 'easeInOut' }}
                          style={{ overflow: 'hidden' }}
                        >
                          <div style={{
                            padding: '18px 18px 22px',
                            background: panelBg,
                            borderTop: `1px solid ${bdr}`,
                          }}>
                            {renderContent(id)}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}