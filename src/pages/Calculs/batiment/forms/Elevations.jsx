import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  BrickWall, Columns, Ruler, BetweenHorizontalEnd,
  Grid, Square, ArrowUpRight, Calculator, Link,
  ChevronDown,
} from "lucide-react";

import Murs      from "./Murs";
import Poteaux   from "./Poteaux";
import Longrines from "./Longrines";
import Linteaux  from "./Linteaux";
import Poutres   from "./Poutres";
import Dalles    from "./Dalles";
import Escaliers from "./Escaliers";

import { useProjectStore } from "../../../../store/useProjectStore";
import usePersistentState from "../../../../hooks/usePersistentState";

const TABS = [
  { id: "murs",      label: "Murs",      icon: <BrickWall className="w-4 h-4" />,            color: "orange" },
  { id: "poteaux",   label: "Poteaux",   icon: <Columns className="w-4 h-4" />,              color: "blue" },
  { id: "longrines", label: "Chaînage", icon: <Ruler className="w-4 h-4" />,                 color: "emerald" },
  { id: "linteaux",  label: "Linteaux",  icon: <BetweenHorizontalEnd className="w-4 h-4" />, color: "cyan" },
  { id: "poutres",   label: "Poutres",   icon: <Grid className="w-4 h-4" />,                 color: "purple" },
  { id: "dalles",    label: "Dalles / Planchers", icon: <Square className="w-4 h-4" />,       color: "rose" },
  { id: "escaliers", label: "Escaliers", icon: <ArrowUpRight className="w-4 h-4" />,         color: "yellow" },
];

export default function Elevations({ currency = "XOF", onCostChange, onMateriauxChange }) {

  const [activeTab, setActiveTab] = usePersistentState("elevations:activeTab", "murs");
  const [activeView, setActiveView] = usePersistentState("elevations:activeView", "ouvrages");
  const [subCosts,     setSubCosts]     = usePersistentState("elevations:subCosts", {});
  const [subMaterials, setSubMaterials] = usePersistentState("elevations:subMaterials", {});

  // ✅ HUB DE RÉSULTATS TECHNIQUES entre sous-modules
  // Stocke les résultats de chaque sous-module pour que les autres puissent les lire
  const [subResults, setSubResultsLocal] = usePersistentState("elevations:subResults", {});

  // Store global
  const setGlobalResults   = useProjectStore((s) => s.setResults);
  const setGlobalMaterials = useProjectStore((s) => s.setMaterials);
  const setGlobalCost      = useProjectStore((s) => s.setCost);
  const materialSignaturesRef = useRef({});
  const resultSignaturesRef = useRef({});

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
    const signature = JSON.stringify(mats || {});
    if (materialSignaturesRef.current[id] === signature) return;
    materialSignaturesRef.current[id] = signature;

    setSubMaterials((prev) => {
      return { ...prev, [id]: mats };
    });
    setGlobalMaterials(id, mats);
  }, []);

  // ✅ Handler résultats techniques : stockage LOCAL (hub Elevations) + GLOBAL (store)
  const handleSubResultsChange = useCallback((id, results) => {
    const signature = JSON.stringify(results || {});
    if (resultSignaturesRef.current[id] === signature) return;
    resultSignaturesRef.current[id] = signature;

    setSubResultsLocal((prev) => {
      return { ...prev, [id]: results };
    });
    // Aussi dans le store global pour que d'autres modules (Finitions, Planchers) puissent lire
    setGlobalResults(id, results);
  }, []);

  const commonProps = useMemo(() => ({
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
  }), [
    activeTab,
    currency,
    handleSubCostChange,
    handleSubMaterialChange,
    handleSubResultsChange,
    subResults,
  ]);

  // ── Rendu du sous-composant actif ─────────────────────────────────────────
  const renderActiveComponent = () => {
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
  const activeCost = subCosts[activeTab] || 0;

  const elevationSynthese = useMemo(() => {
    const resultEntries = Object.values(subResults).filter(Boolean);

    return {
      volumeBeton: resultEntries.reduce((sum, r) =>
        sum + (r.volumeTotal || r.volumeCommande || r.volumeFinal || r.volume || 0), 0),
      surfaceCoffrage: resultEntries.reduce((sum, r) => sum + (r.surfaceCoffrage || 0), 0),
      surfaceMurs: subResults.murs?.surfaceNette || 0,
      surfaceDalles: subResults.dalles?.surface || 0,
      blocs: totalMateriaux.blocs || 0,
      ciment: totalMateriaux.ciment || 0,
      acier: totalMateriaux.acier || 0,
      modulesActifs: Object.keys(subResults).filter((key) => Object.keys(subResults[key] || {}).length > 0).length,
    };
  }, [subResults, totalMateriaux]);

  // Indicateur de liaisons actives
  const liaisonsActives = useMemo(() => {
    const liaisons = [];
    if (subResults.poteaux?.nombre > 0) liaisons.push("Poteaux → Chaînage");
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

        {/* Choix ouvrage */}
        <div className="w-full md:w-[320px]">
          <label className="block mb-1 text-[9px] text-gray-500 uppercase font-bold tracking-wider">
            Ouvrage d'élévation
          </label>
          <div className="relative">
            <select
              value={activeTab}
              onChange={(e) => {
                setActiveTab(e.target.value);
                setActiveView("ouvrages");
              }}
              className="w-full appearance-none bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 pr-9 text-sm text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 focus:outline-none"
            >
              {TABS.map((tab) => (
                <option key={tab.id} value={tab.id}>
                  {tab.label}{(subCosts[tab.id] || 0) > 0 ? " - calculé" : ""}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-700 px-3 py-1.5 rounded-lg hidden md:block min-w-[120px] text-right">
          <span className="text-[10px] text-gray-500 uppercase block leading-none mb-0.5">Total Élévation</span>
          <span className="text-base font-black text-white">
            {totalGlobal.toLocaleString()} <span className="text-[10px] font-normal text-gray-500">{currency}</span>
          </span>
        </div>
      </div>

      {/* Vues Ouvrages / Synthèse */}
      <div className="shrink-0 flex border-b border-gray-800 bg-gray-900">
        {[["ouvrages", "Ouvrages"], ["synthese", "Synthèse"]].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveView(key)}
            className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors ${
              activeView === key
                ? "text-blue-400 border-b-2 border-blue-400"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {label}
          </button>
        ))}
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
        {activeView === "ouvrages" ? renderActiveComponent() : (
          <ElevationSynthese
            currency={currency}
            totalGlobal={totalGlobal}
            activeLabel={activeTheme.label}
            activeCost={activeCost}
            subCosts={subCosts}
            subResults={subResults}
            synthese={elevationSynthese}
          />
        )}
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

const fmt = (n) => Math.round(n || 0).toLocaleString("fr-FR");
const fmtD = (n, d = 2) => (n || 0).toFixed(d);

const ElevationSynthese = ({ currency, totalGlobal, activeLabel, activeCost, subCosts, subResults, synthese }) => (
  <div className="h-full overflow-y-auto bg-gray-900 text-gray-100 p-4 lg:p-6">
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
      <div className="xl:col-span-5 flex flex-col gap-4">
        <div className="bg-gray-800/60 border border-blue-500/20 rounded-2xl p-4">
          <p className="text-[10px] text-blue-300 uppercase font-bold tracking-widest">Synthèse élévation</p>
          <div className="mt-2 flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] text-gray-500">Ouvrage actif</p>
              <p className="text-lg font-black text-white">{activeLabel}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-gray-500 uppercase font-bold">Total</p>
              <p className="text-xl font-black text-blue-400">{fmt(totalGlobal)} <span className="text-xs text-gray-500">{currency}</span></p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-4">
          <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-3">Récapitulatif interne</p>
          <div className="grid grid-cols-2 gap-3">
            <ReadonlySummaryField label="Modules actifs" value={synthese.modulesActifs} unit="u" />
            <ReadonlySummaryField label="Coût actif" value={fmt(activeCost)} unit={currency} />
            <ReadonlySummaryField label="Volume béton" value={fmtD(synthese.volumeBeton)} unit="m³" />
            <ReadonlySummaryField label="Coffrage" value={fmtD(synthese.surfaceCoffrage)} unit="m²" />
            <ReadonlySummaryField label="Surface murs" value={fmtD(synthese.surfaceMurs)} unit="m²" />
            <ReadonlySummaryField label="Surface dalles" value={fmtD(synthese.surfaceDalles)} unit="m²" />
            <ReadonlySummaryField label="Blocs" value={fmt(synthese.blocs)} unit="u" />
            <ReadonlySummaryField label="Ciment" value={fmtD(synthese.ciment, 2)} unit="t" />
            <ReadonlySummaryField label="Acier" value={fmtD(synthese.acier, 2)} unit="t" />
          </div>
        </div>
      </div>

      <div className="xl:col-span-7 bg-gray-800/40 border border-gray-700 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-700 bg-gray-800/70">
          <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Détail par ouvrage</p>
        </div>
        <div className="divide-y divide-gray-800/70">
          {TABS.map((tab) => {
            const cost = subCosts[tab.id] || 0;
            const results = subResults[tab.id] || {};
            const hasData = cost > 0 || Object.keys(results).length > 0;

            return (
              <div key={tab.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="text-gray-400 flex-shrink-0">{tab.icon}</div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate">{tab.label}</p>
                    <p className="text-[10px] text-gray-500">
                      {hasData ? "Données disponibles" : "Non calculé"}
                    </p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-black text-blue-300 font-mono">{fmt(cost)} {currency}</p>
                  {results.surfaceCoffrage > 0 && (
                    <p className="text-[10px] text-gray-500 font-mono">{fmtD(results.surfaceCoffrage)} m² coffrage</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  </div>
);

const ReadonlySummaryField = ({ label, value, unit }) => (
  <div>
    <label className="block mb-1 text-[10px] font-bold text-gray-500 uppercase tracking-wide leading-tight">{label}</label>
    <div className="flex items-center gap-2 rounded-xl border border-gray-700 bg-gray-950/70 px-3 py-2">
      <input
        readOnly
        value={value}
        className="min-w-0 flex-1 bg-transparent text-sm font-mono font-bold text-white outline-none"
      />
      <span className="text-[10px] font-bold uppercase text-gray-500">{unit}</span>
    </div>
  </div>
);
