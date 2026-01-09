// src/pages/Profile/SettingsSection.jsx - AVEC ONGLET STOCKAGE
import React, { useState, lazy, Suspense } from 'react';
import MonetisationDashboard from "./Monetisation/MonetisationDashboard";
import CreateOffer from "./Monetisation/CreateOffer";
import MyClients from "./Monetisation/MyClients";
import RevenueStats from "./Monetisation/RevenueStats";
import Payouts from "./Monetisation/Payouts";
import StorageManager from "./StorageManager"; // ✅ NOUVEAU
import { useAuth } from '../../context/AuthContext';
import { useDarkMode } from '../../context/DarkModeContext';

const AdminDashboard = lazy(() => import('../Admin/AdminDashboard'));

const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-[300px]">
    <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent" />
  </div>
);

export default function SettingsSection({ user, showToast }) {
  const [activeTab, setActiveTab] = useState("dashboard");
  const { isAdmin } = useAuth();
  const { isDarkMode } = useDarkMode();

  const userIsAdmin = isAdmin();

  const TABS = [
    { id: "dashboard", label: "📊 Tableau de bord" },
    { id: "create", label: "➕ Créer une offre" },
    { id: "clients", label: "👥 Mes clients" },
    { id: "revenus", label: "💰 Statistiques" },
    { id: "retraits", label: "💵 Retraits" },
    { id: "storage", label: "💾 Stockage" }, // ✅ NOUVEAU
    ...(userIsAdmin ? [{ id: "admin", label: "🛠️ Admin", badge: "Admin only" }] : [])
  ];

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard": 
        return <MonetisationDashboard />;
      
      case "create": 
        return <CreateOffer />;
      
      case "clients": 
        return <MyClients />;
      
      case "revenus": 
        return <RevenueStats />;
      
      case "retraits": 
        return <Payouts />;
      
      // ✅ NOUVEAU: Onglet Stockage
      case "storage":
        return <StorageManager user={user} showToast={showToast} />;
      
      case "admin":
        if (!userIsAdmin) {
          return (
            <div className="text-center py-12">
              <p className={`text-lg font-medium ${isDarkMode ? 'text-red-400' : 'text-red-500'}`}>
                ⛔ Accès réservé aux administrateurs
              </p>
            </div>
          );
        }
        
        return (
          <Suspense fallback={<LoadingSpinner />}>
            <AdminDashboard />
          </Suspense>
        );
      
      default: 
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Menu déroulant mobile */}
      <div className="md:hidden">
        <label htmlFor="settings-tabs" className="sr-only">
          Choisir une section
        </label>
        <select
          id="settings-tabs"
          className={`w-full px-4 py-2 rounded-md border transition-colors ${
            isDarkMode 
              ? 'bg-gray-800 border-gray-700 text-gray-100' 
              : 'bg-white border-gray-300 text-gray-900'
          }`}
          value={activeTab}
          onChange={(e) => setActiveTab(e.target.value)}
        >
          {TABS.map(({ id, label }) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Onglets desktop */}
      <div 
        className="hidden md:flex space-x-3 mb-6 overflow-x-auto" 
        role="tablist" 
        aria-label="Sections des paramètres"
      >
        {TABS.map(({ id, label, badge }) => {
          const isActive = id === activeTab;
          return (
            <button
              key={id}
              id={`tab-${id}`}
              role="tab"
              aria-selected={isActive}
              aria-controls={`tabpanel-${id}`}
              tabIndex={isActive ? 0 : -1}
              className={`px-5 py-2 rounded-md font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-orange-500 relative whitespace-nowrap ${
                isActive 
                  ? "bg-orange-500 text-white shadow-md" 
                  : isDarkMode
                    ? "bg-gray-800 text-gray-300 hover:bg-gray-700"
                    : "bg-gray-200 text-gray-800 hover:bg-gray-300"
              }`}
              onClick={() => setActiveTab(id)}
            >
              {label}
              {badge && (
                <span className="ml-2 px-2 py-0.5 text-xs font-medium text-white bg-red-500 rounded-full">
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Contenu principal */}
      <main
        role="tabpanel"
        id={`tabpanel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
        className={`p-6 rounded-lg shadow-lg min-h-[300px] transition-colors ${
          isDarkMode 
            ? 'bg-gray-900/80 backdrop-blur-xl' 
            : 'bg-white'
        }`}
      >
        {renderContent()}
      </main>
    </div>
  );
}