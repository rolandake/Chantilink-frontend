import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  BrickWall, 
  Columns, 
  Ruler, 
  BetweenHorizontalEnd,
  Grid,
  Square,
  ArrowUpRight,
  Calculator
} from "lucide-react";

// ✅ Imports de tous les sous-composants
import Murs from "./Murs";
import Poteaux from "./Poteaux";
import Longrines from "./Longrines";
import Linteaux from "./Linteaux";
import Poutres from "./Poutres";
import Dalles from "./Dalles";
import Escaliers from "./Escaliers";

// Configuration complète des onglets
const TABS = [
  { id: "murs", label: "Murs", icon: <BrickWall className="w-4 h-4" />, color: "orange" },
  { id: "poteaux", label: "Poteaux", icon: <Columns className="w-4 h-4" />, color: "blue" },
  { id: "longrines", label: "Longrines", icon: <Ruler className="w-4 h-4" />, color: "emerald" },
  { id: "linteaux", label: "Linteaux", icon: <BetweenHorizontalEnd className="w-4 h-4" />, color: "cyan" },
  { id: "poutres", label: "Poutres", icon: <Grid className="w-4 h-4" />, color: "purple" },
  { id: "dalles", label: "Dalles", icon: <Square className="w-4 h-4" />, color: "rose" },
  { id: "escaliers", label: "Escaliers", icon: <ArrowUpRight className="w-4 h-4" />, color: "yellow" },
];

export default function Elevations({ currency = "XOF", onCostChange, onMateriauxChange }) {
  
  // --- ÉTATS ---
  const [activeTab, setActiveTab] = useState("murs");
  
  // Stockage des coûts par sous-catégorie
  const [subCosts, setSubCosts] = useState({});
  const [subMaterials, setSubMaterials] = useState({});

  // --- CALCULS GLOBAUX ---
  // Somme de tous les sous-totaux
  const totalGlobal = useMemo(() => 
    Object.values(subCosts).reduce((acc, val) => acc + (val || 0), 0), 
  [subCosts]);

  // Agrégation des matériaux pour le devis global
  const totalMateriaux = useMemo(() => {
    const total = {};
    Object.values(subMaterials).forEach(matObj => {
      if (!matObj) return;
      Object.entries(matObj).forEach(([key, val]) => {
        if (typeof val === 'number') {
          // On cumule les valeurs (ex: Ciment des murs + Ciment des poteaux)
          total[key] = (total[key] || 0) + val;
        }
      });
    });
    return total;
  }, [subMaterials]);

  // --- SYNC PARENT (Anti-Loop) ---
  useEffect(() => {
    if (onCostChange) onCostChange(totalGlobal);
    if (onMateriauxChange) onMateriauxChange(totalMateriaux);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalGlobal]); 

  // --- HANDLERS (Mémorisés) ---
  const handleSubCostChange = useCallback((id, amount) => {
    setSubCosts(prev => {
      if (prev[id] === amount) return prev;
      return { ...prev, [id]: amount };
    });
  }, []);

  const handleSubMaterialChange = useCallback((id, mats) => {
    setSubMaterials(prev => {
      if (JSON.stringify(prev[id]) === JSON.stringify(mats)) return prev;
      return { ...prev, [id]: mats };
    });
  }, []);

  // --- RENDU DYNAMIQUE ---
  const renderActiveComponent = () => {
    // Props communes passées à chaque enfant
    const commonProps = {
      currency,
      onTotalChange: (val) => handleSubCostChange(activeTab, val),
      onMateriauxChange: (mats) => handleSubMaterialChange(activeTab, mats)
    };

    switch (activeTab) {
      case "murs": return <Murs {...commonProps} />;
      case "poteaux": return <Poteaux {...commonProps} />;
      case "longrines": return <Longrines {...commonProps} />;
      case "linteaux": return <Linteaux {...commonProps} />;
      case "poutres": return <Poutres {...commonProps} />;
      case "dalles": return <Dalles {...commonProps} />;
      case "escaliers": return <Escaliers {...commonProps} />;
      default: return (
        <div className="flex flex-col items-center justify-center h-full text-gray-500 opacity-50">
          <Calculator className="w-16 h-16 mb-4" />
          <p>Module en chargement...</p>
        </div>
      );
    }
  };

  const activeTheme = TABS.find(t => t.id === activeTab) || TABS[0];

  return (
    // Structure fixe : Header fixe + Contenu scrollable
    <div className="flex flex-col h-full bg-gray-900 rounded-2xl overflow-hidden border border-gray-800 shadow-2xl relative">
      
      {/* --- HEADER FIXE --- */}
      <div className="bg-gray-800/80 backdrop-blur-md border-b border-gray-700 p-3 flex flex-col md:flex-row justify-between items-center gap-3 z-10 shrink-0">
        
        {/* Titre & Icône */}
        <div className="flex items-center gap-3 self-start md:self-center">
          <div className={`p-2 rounded-lg bg-${activeTheme.color}-500/20 text-${activeTheme.color}-400 transition-colors duration-300`}>
            {activeTheme.icon}
          </div>
          <div>
            <h2 className="text-lg font-bold text-white transition-all duration-300">
              {activeTheme.label}
            </h2>
            <p className="text-[10px] text-gray-400 uppercase tracking-wider hidden sm:block">Structure</p>
          </div>
        </div>

        {/* Navigation Onglets (Scroll horizontal) */}
        <div className="flex overflow-x-auto gap-2 pb-1 w-full md:w-auto custom-scrollbar no-scrollbar-y">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap border ${
                activeTab === tab.id 
                  ? `bg-${tab.color}-600 text-white border-${tab.color}-500 shadow-md transform scale-105` 
                  : "bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 border-gray-700"
              }`}
            >
              {tab.icon}
              {tab.label}
              {/* Point indicateur si données présentes */}
              {(subCosts[tab.id] || 0) > 0 && (
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 ml-1 shadow-[0_0_5px_#4ade80]" />
              )}
            </button>
          ))}
        </div>

        {/* Total Global Badge (Desktop) */}
        <div className="bg-gray-900 border border-gray-700 px-3 py-1.5 rounded-lg hidden md:block min-w-[120px] text-right">
          <span className="text-[10px] text-gray-500 uppercase block leading-none mb-0.5">Total Élévation</span>
          <span className="text-base font-black text-white">
            {totalGlobal.toLocaleString()} <span className="text-[10px] font-normal text-gray-500">{currency}</span>
          </span>
        </div>
      </div>

      {/* --- CONTENU (Scroll interne géré par l'enfant) --- */}
      <div className="flex-1 overflow-hidden relative w-full h-full">
        {renderActiveComponent()}
      </div>

      {/* Footer Mobile (Total) */}
      <div className="md:hidden bg-gray-900 border-t border-gray-800 p-3 flex justify-between items-center shrink-0">
        <span className="text-xs text-gray-400 font-bold uppercase">Total Élévation</span>
        <span className="text-lg font-black text-white">
          {totalGlobal.toLocaleString()} <span className="text-xs text-gray-500">{currency}</span>
        </span>
      </div>

      <style>{`
        /* Scrollbar fine horizontale pour les onglets */
        .custom-scrollbar::-webkit-scrollbar { height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #4b5563; border-radius: 10px; }
        
        /* Cacher le scroll vertical sur la nav */
        .no-scrollbar-y::-webkit-scrollbar-y { display: none; }
      `}</style>
    </div>
  );
}