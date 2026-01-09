import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useCalculation } from "@/context/CalculationContext";
import { 
  FileText, 
  ChevronLeft, 
  LayoutDashboard, 
  Building2 
} from "lucide-react";

// Imports des composants enfants
import Devis from "./Devis";
import Terrassement from "./Terrassement";
import Fondation from "./Fondation";
import Elevations from "./Elevations";
import Planchers from "./Planchers";
import Toiture from "./Toiture";
import Finitions from "./Finitions";

// Configuration de la navigation (Thème Bâtiment)
const stepsConfig = [
  { id: "terrassement", label: "Terrassement", component: Terrassement, icon: "🚜", color: "text-amber-500", border: "border-amber-500/50" },
  { id: "fondation", label: "Fondation", component: Fondation, icon: "🏗️", color: "text-red-500", border: "border-red-500/50" },
  { id: "elevation", label: "Élévation (Murs)", component: Elevations, icon: "🧱", color: "text-blue-500", border: "border-blue-500/50" },
  { id: "planchers", label: "Planchers / Dalles", component: Planchers, icon: "📐", color: "text-emerald-500", border: "border-emerald-500/50" },
  { id: "toiture", label: "Toiture / Charpente", component: Toiture, icon: "🏠", color: "text-orange-500", border: "border-orange-500/50" },
  { id: "finitions", label: "Finitions", component: Finitions, icon: "✨", color: "text-purple-500", border: "border-purple-500/50" },
];

export default function BatimentForm({ currency = "XOF" }) {
  const calculationContext = useCalculation();
  const { setCurrentProjectType, setCurrentCalculationType, PROJECT_TYPES } = calculationContext || {};

  const [selectedStep, setSelectedStep] = useState(null);
  const [showDevis, setShowDevis] = useState(false);
  
  // États globaux pour le Devis
  const [costs, setCosts] = useState(() => Object.fromEntries(stepsConfig.map(s => [s.id, 0])));
  const [quantitesParEtape, setQuantitesParEtape] = useState(() => Object.fromEntries(stepsConfig.map(s => [s.id, {}])));

  // Initialisation du contexte
  useEffect(() => {
    if (calculationContext && PROJECT_TYPES?.BATIMENT) {
      setCurrentProjectType?.(PROJECT_TYPES.BATIMENT);
      setCurrentCalculationType?.('projet_complet');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- HANDLERS OPTIMISÉS (Anti-Boucle) ---

  const handleCostChange = useCallback((stepId, value) => {
    setCosts(prev => {
      const safeValue = Math.max(0, Number(value) || 0);
      if (prev[stepId] === safeValue) return prev; 
      return { ...prev, [stepId]: safeValue };
    });
  }, []);

  const handleQuantitesChange = useCallback((stepId, materiaux) => {
    setQuantitesParEtape(prev => {
      if (JSON.stringify(prev[stepId]) === JSON.stringify(materiaux)) return prev;
      return { ...prev, [stepId]: materiaux };
    });
  }, []);

  // --- CALCULS GLOBAUX ---
  const totalGeneral = useMemo(() => Object.values(costs).reduce((acc, val) => acc + val, 0), [costs]);
  const activeSteps = useMemo(() => stepsConfig.filter(({ id }) => costs[id] > 0).length, [costs]);
  const progressPercent = (activeSteps / stepsConfig.length) * 100;

  // --- RENDU DYNAMIQUE ---
  const renderCurrentStep = () => {
    const step = stepsConfig.find(s => s.id === selectedStep);
    if (!step) return null;
    
    const StepComponent = step.component;
    
    return (
      <StepComponent 
        currency={currency} 
        onTotalChange={(val) => handleCostChange(step.id, val)} 
        onMateriauxChange={(mats) => handleQuantitesChange(step.id, mats)} 
      />
    );
  };

  if (!calculationContext) return <div className="text-white p-10">Chargement du contexte...</div>;

  return (
    <div className="flex h-[calc(100vh-80px)] w-full bg-gray-900 text-white overflow-hidden font-sans">
      
      {/* ====================== SIDEBAR (Desktop) ====================== */}
      <aside className="hidden lg:flex flex-col w-80 bg-gray-800/80 backdrop-blur-xl border-r border-gray-700 h-full transition-all duration-300 shadow-2xl z-20">
        
        {/* Header Sidebar */}
        <div className="p-6 border-b border-gray-700 shrink-0 bg-gray-800/50">
          <h1 className="text-2xl font-black bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent mb-1 flex items-center gap-2">
            <Building2 className="w-6 h-6 text-blue-500" />
            Bâtiment
          </h1>
          <p className="text-xs text-gray-400 mb-4 ml-1">Construction & Rénovation</p>
          
          {/* Progression */}
          <div className="bg-gray-700 rounded-full h-1.5 w-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-700 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
            <span>Avancement</span>
            <span>{activeSteps} / {stepsConfig.length}</span>
          </div>
        </div>

        {/* Liste des Étapes */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
          {stepsConfig.map((step) => {
            const isActive = costs[step.id] > 0;
            const isSelected = selectedStep === step.id;
            
            return (
              <button
                key={step.id}
                onClick={() => setSelectedStep(step.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 group relative overflow-hidden text-left ${
                  isSelected 
                    ? "bg-gray-700 border border-blue-500/50 shadow-lg" 
                    : "hover:bg-gray-800 border border-transparent hover:border-gray-700"
                }`}
              >
                {isSelected && <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500" />}

                <span className={`text-xl filter transition-all ${!isSelected && !isActive ? 'grayscale opacity-50' : 'scale-110'}`}>
                  {step.icon}
                </span>
                
                <div className="flex-1">
                  <div className={`font-bold text-sm ${isSelected ? 'text-white' : 'text-gray-300 group-hover:text-white'}`}>
                    {step.label}
                  </div>
                  {isActive ? (
                    <div className="text-xs font-mono text-blue-400 font-medium mt-0.5">
                      {(costs[step.id]).toLocaleString()} {currency}
                    </div>
                  ) : (
                    <div className="text-[10px] text-gray-600 group-hover:text-gray-500">Non chiffré</div>
                  )}
                </div>

                {isActive && (
                   <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse" />
                )}
              </button>
            );
          })}
        </div>

        {/* Footer Sidebar (Total) */}
        <div className="p-4 border-t border-gray-700 bg-gray-900/80 shrink-0 backdrop-blur-sm">
          <div className="bg-gradient-to-br from-gray-800 to-gray-750 rounded-xl p-4 border border-gray-700 shadow-lg">
             <span className="text-[10px] text-gray-400 uppercase tracking-widest block mb-1">Total Projet</span>
             <span className="text-xl font-black text-white block truncate tracking-tight">
               {totalGeneral.toLocaleString()} <span className="text-sm font-normal text-blue-400">{currency}</span>
             </span>
             <button
                onClick={() => setShowDevis(true)}
                disabled={totalGeneral === 0}
                className="w-full mt-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white py-2.5 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95"
              >
                <FileText className="w-4 h-4" />
                Voir le Devis
              </button>
          </div>
        </div>
      </aside>


      {/* ====================== MAIN CONTENT ====================== */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative bg-gray-900 w-full">
        
        {/* MOBILE HEADER */}
        <div className="lg:hidden flex items-center justify-between p-4 border-b border-gray-800 bg-gray-900 shrink-0 z-20">
           {selectedStep ? (
             <button 
                onClick={() => setSelectedStep(null)} 
                className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
             >
               <ChevronLeft className="w-5 h-5" /> Retour
             </button>
           ) : (
             <h1 className="text-lg font-bold text-blue-500 flex items-center gap-2">
               <Building2 className="w-5 h-5" /> Bâtiment
             </h1>
           )}
           <div className="bg-gray-800 px-3 py-1.5 rounded-lg border border-gray-700 shadow-sm">
              <span className="text-xs font-bold text-white">{totalGeneral.toLocaleString()} {currency}</span>
           </div>
        </div>

        {/* CONTENU */}
        {selectedStep ? (
          <div className="flex-1 w-full h-full overflow-hidden relative animate-in fade-in zoom-in-95 duration-300">
            {renderCurrentStep()}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 lg:p-10 custom-scrollbar">
            {/* Desktop Welcome */}
            <div className="hidden lg:flex flex-col items-center justify-center h-full text-center opacity-60 pointer-events-none select-none">
              <div className="w-32 h-32 bg-gray-800 rounded-full flex items-center justify-center mb-6 shadow-2xl">
                <LayoutDashboard className="w-16 h-16 text-gray-600" />
              </div>
              <h2 className="text-3xl font-bold text-gray-300">Constructeur Bâtiment</h2>
              <p className="text-gray-500 mt-2 max-w-sm">Gros œuvre, second œuvre et finitions en un seul endroit.</p>
            </div>

            {/* Mobile Grid */}
            <div className="lg:hidden grid grid-cols-2 gap-4 pb-24">
               {stepsConfig.map((step) => (
                 <button
                   key={step.id}
                   onClick={() => setSelectedStep(step.id)}
                   className={`flex flex-col items-center justify-center p-5 rounded-2xl border bg-gray-800/50 backdrop-blur-sm shadow-lg ${
                     costs[step.id] > 0 
                       ? "border-blue-500/50 bg-gradient-to-br from-gray-800 to-blue-900/20" 
                       : "border-gray-700 hover:bg-gray-800"
                   } active:scale-95 transition-all duration-200`}
                 >
                   <span className="text-4xl mb-3 filter drop-shadow-lg">{step.icon}</span>
                   <span className="font-bold text-sm text-center text-gray-200">{step.label}</span>
                   {costs[step.id] > 0 && (
                     <span className="mt-2 text-[10px] font-mono font-bold text-blue-400 bg-gray-900/80 px-2 py-1 rounded-md border border-blue-500/30">
                       {(costs[step.id] / 1000).toFixed(0)}k
                     </span>
                   )}
                 </button>
               ))}
            </div>
          </div>
        )}

        {/* MOBILE FOOTER DEVIS */}
        <div className="lg:hidden fixed bottom-6 right-4 left-4 z-50 pointer-events-none">
           {totalGeneral > 0 && !selectedStep && (
              <button
                onClick={() => setShowDevis(true)}
                className="w-full pointer-events-auto bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3.5 rounded-xl font-bold shadow-2xl flex items-center justify-center gap-2 animate-in slide-in-from-bottom-10 border border-blue-400/30"
              >
                <FileText className="w-5 h-5" /> Voir Devis ({totalGeneral.toLocaleString()})
              </button>
           )}
        </div>

      </main>

      {/* ====================== MODAL DEVIS ====================== */}
      {showDevis && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-0 lg:p-4">
          <div className="bg-gray-900 w-full h-full lg:rounded-3xl lg:max-w-6xl lg:h-[90vh] flex flex-col shadow-2xl border border-gray-700 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-5 border-b border-gray-800 bg-gray-900 lg:rounded-t-3xl">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <FileText className="text-blue-500 w-6 h-6" /> Devis Bâtiment
              </h2>
              <button 
                onClick={() => setShowDevis(false)}
                className="p-2 bg-gray-800 hover:bg-gray-700 rounded-full transition-colors border border-gray-700"
              >
                ✕
              </button>
            </div>
            
            <div className="flex-1 overflow-hidden relative">
              <Devis
                currency={currency}
                costs={costs}
                quantitesParEtape={quantitesParEtape}
                totalGeneral={totalGeneral}
              />
            </div>
          </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #374151; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #4b5563; }
      `}</style>
    </div>
  );
}