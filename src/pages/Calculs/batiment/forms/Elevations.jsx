import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  BrickWall, Columns, Ruler, BetweenHorizontalEnd,
  Grid, Square, ArrowUpRight, Calculator, Link,
} from "lucide-react";

import Murs      from "./Murs";
import Poteaux   from "./Poteaux";
import Longrines from "./Longrines";
import Linteaux  from "./Linteaux";
import Poutres   from "./Poutres";
import Dalles    from "./Dalles";
import Escaliers from "./Escaliers";

import { useProjectStore } from "../../../../store/useProjectStore";

const TABS = [
  { id: "murs",      label: "Murs",      icon: <BrickWall className="w-4 h-4" />,            color: "orange" },
  { id: "poteaux",   label: "Poteaux",   icon: <Columns className="w-4 h-4" />,              color: "blue" },
  { id: "longrines", label: "Longrines", icon: <Ruler className="w-4 h-4" />,                color: "emerald" },
  { id: "linteaux",  label: "Linteaux",  icon: <BetweenHorizontalEnd className="w-4 h-4" />, color: "cyan" },
  { id: "poutres",   label: "Poutres",   icon: <Grid className="w-4 h-4" />,                 color: "purple" },
  { id: "dalles",    label: "Dalles",    icon: <Square className="w-4 h-4" />,               color: "rose" },
  { id: "escaliers", label: "Escaliers", icon: <ArrowUpRight className="w-4 h-4" />,         color: "yellow" },
];

export default function Elevations({ currency = "XOF", onCostChange, onMateriauxChange }) {

  const [activeTab, setActiveTab] = useState("murs");
  const [subCosts,     setSubCosts]     = useState({});
  const [subMaterials, setSubMaterials] = useState({});

  // ✅ HUB DE RÉSULTATS TECHNIQUES entre sous-modules
  // Stocke les résultats de chaque sous-module pour que les autres puissent les lire
  const [subResults, setSubResultsLocal] = useState({});

  // Store global
  const setGlobalResults   = useProjectStore((s) => s.setResults);
  const setGlobalMaterials = useProjectStore((s) => s.setMaterials);
  const setGlobalCost      = useProjectStore((s) => s.setCost);

  // ── Totaux ────────────────────────────────────────────────────────────────
  const totalGlobal = useMemo(() =>
    Object.values(subCosts).reduce((acc, val) => acc + (val || 0), 0),
  [subCosts]);

  const totalMateriaux = useMemo(() => {
    const total = {};
    Object.values(subMaterials).forEach((matObj) => {
      if (!matObj) return;
      Object.entries(matObj).forEach(([key, val]) => {
        if (typeof val === "number") total[key] = (total[key] || 0) + val;
      });
    });
    return total;
  }, [subMaterials]);

  // ── Sync parent + store global ────────────────────────────────────────────
  useEffect(() => {
    if (onCostChange)      onCostChange(totalGlobal);
    if (onMateriauxChange) onMateriauxChange(totalMateriaux);
    setGlobalCost("elevation", totalGlobal);
  }, [totalGlobal]);

  useEffect(() => {
    setGlobalMaterials("elevation", totalMateriaux);
  }, [JSON.stringify(totalMateriaux)]);

  // ── Handlers mémorisés ────────────────────────────────────────────────────
  const handleSubCostChange = useCallback((id, amount) => {
    setSubCosts((prev) => {
      if (prev[id] === amount) return prev;
      return { ...prev, [id]: amount };
    });
  }, []);

  const handleSubMaterialChange = useCallback((id, mats) => {
    setSubMaterials((prev) => {
      if (JSON.stringify(prev[id]) === JSON.stringify(mats)) return prev;
      return { ...prev, [id]: mats };
    });
    setGlobalMaterials(id, mats);
  }, []);

  // ✅ Handler résultats techniques : stockage LOCAL (hub Elevations) + GLOBAL (store)
  const handleSubResultsChange = useCallback((id, results) => {
    setSubResultsLocal((prev) => {
      if (JSON.stringify(prev[id]) === JSON.stringify(results)) return prev;
      return { ...prev, [id]: results };
    });
    // Aussi dans le store global pour que d'autres modules (Finitions, Planchers) puissent lire
    setGlobalResults(id, results);
  }, []);

  // ── Rendu du sous-composant actif ─────────────────────────────────────────
  const renderActiveComponent = () => {
    // Props communes à tous les enfants
    const commonProps = {
      currency,
      // Coût
      onTotalChange: (val) => handleSubCostChange(activeTab, val),
      onCostChange:  (val) => handleSubCostChange(activeTab, val),
      // Matériaux
      onMateriauxChange: (mats) => handleSubMaterialChange(activeTab, mats),
      // ✅ Résultats techniques (nouveauté)
      onResultsChange: (results) => handleSubResultsChange(activeTab, results),
      // ✅ Accès aux résultats des autres sous-modules (pour liaisons automatiques)
      projectResults: subResults,
    };

    switch (activeTab) {
      case "murs":      return <Murs      {...commonProps} />;
      case "poteaux":   return <Poteaux   {...commonProps} />;
      case "longrines": return <Longrines {...commonProps} />;
      case "linteaux":  return <Linteaux  {...commonProps} />;
      case "poutres":   return <Poutres   {...commonProps} />;
      case "dalles":    return <Dalles    {...commonProps} />;
      case "escaliers": return <Escaliers {...commonProps} />;
      default:
        return (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 opacity-50">
            <Calculator className="w-16 h-16 mb-4" />
            <p>Module en chargement…</p>
          </div>
        );
    }
  };

  const activeTheme = TABS.find((t) => t.id === activeTab) || TABS[0];

  // Indicateur de liaisons actives
  const liaisonsActives = useMemo(() => {
    const liaisons = [];
    if (subResults.poteaux?.nombre > 0) liaisons.push("Poteaux → Longrines");
    if (subResults.murs?.surfaceNette > 0) liaisons.push("Murs → Finitions");
    if (subResults.dalles?.surface > 0) liaisons.push("Dalles → Escaliers");
    if (subResults.poutres?.volumeTotal > 0) liaisons.push("Poutres → Dalles");
    return liaisons;
  }, [subResults]);

  return (
    <div className="flex flex-col h-full bg-gray-900 rounded-2xl overflow-hidden border border-gray-800 shadow-2xl relative">

      {/* HEADER FIXE */}
      <div className="bg-gray-800/80 backdrop-blur-md border-b border-gray-700 p-3 flex flex-col md:flex-row justify-between items-center gap-3 z-10 shrink-0">

        <div className="flex items-center gap-3 self-start md:self-center">
          <div className={`p-2 rounded-lg bg-${activeTheme.color}-500/20 text-${activeTheme.color}-400 transition-colors duration-300`}>
            {activeTheme.icon}
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">{activeTheme.label}</h2>
            <p className="text-[10px] text-gray-400 uppercase tracking-wider hidden sm:block">Structure</p>
          </div>
        </div>

        {/* Navigation onglets */}
        <div className="flex overflow-x-auto gap-2 pb-1 w-full md:w-auto">
          {TABS.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap border ${
                activeTab === tab.id
                  ? `bg-${tab.color}-600 text-white border-${tab.color}-500 shadow-md transform scale-105`
                  : "bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 border-gray-700"
              }`}>
              {tab.icon}
              {tab.label}
              {(subCosts[tab.id] || 0) > 0 && (
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 ml-1 shadow-[0_0_5px_#4ade80]" />
              )}
              {/* ✅ Indicateur de liaison active */}
              {subResults[tab.id] && Object.keys(subResults[tab.id]).length > 0 && (subCosts[tab.id] || 0) === 0 && (
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 ml-1" />
              )}
            </button>
          ))}
        </div>

        <div className="bg-gray-900 border border-gray-700 px-3 py-1.5 rounded-lg hidden md:block min-w-[120px] text-right">
          <span className="text-[10px] text-gray-500 uppercase block leading-none mb-0.5">Total Élévation</span>
          <span className="text-base font-black text-white">
            {totalGlobal.toLocaleString()} <span className="text-[10px] font-normal text-gray-500">{currency}</span>
          </span>
        </div>
      </div>

      {/* ✅ BANDEAU LIAISONS ACTIVES */}
      {liaisonsActives.length > 0 && (
        <div className="shrink-0 px-4 py-2 bg-blue-500/5 border-b border-blue-500/20 flex items-center gap-3 overflow-x-auto">
          <Link className="w-3 h-3 text-blue-400 flex-shrink-0" />
          <span className="text-[10px] text-blue-400 font-bold uppercase tracking-wider flex-shrink-0">Liaisons actives :</span>
          {liaisonsActives.map((l, i) => (
            <span key={i} className="text-[10px] text-blue-300/70 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full whitespace-nowrap">
              {l}
            </span>
          ))}
        </div>
      )}

      {/* CONTENU */}
      <div className="flex-1 overflow-hidden relative w-full h-full">
        {renderActiveComponent()}
      </div>

      {/* Footer mobile */}
      <div className="md:hidden bg-gray-900 border-t border-gray-800 p-3 flex justify-between items-center shrink-0">
        <span className="text-xs text-gray-400 font-bold uppercase">Total Élévation</span>
        <span className="text-lg font-black text-white">
          {totalGlobal.toLocaleString()} <span className="text-xs text-gray-500">{currency}</span>
        </span>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #374151; border-radius: 10px; }
      `}</style>
    </div>
  );
}