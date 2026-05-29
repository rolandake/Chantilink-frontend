import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useCalculation } from "@/context/CalculationContext";
import usePersistentState from "../../../../hooks/usePersistentState";
import { 
  FileText, 
  ChevronLeft, 
  LayoutGrid, 
  HardHat,
  Package,
  BarChart3,
  ClipboardList
} from "lucide-react";

// Imports des composants enfants
import Terrassement from "./Terrassement";
import Fondation from "./Fondation"; // Utilise CoucheFondationForm ou Fondation selon ton choix
import OuvragesHydrauliques from "./OuvragesHydrauliques";
import EquipementsDeSignalisation from "./EquipementsDeSignalisationForm";
import Chaussee from "./Chaussee"; // Utilise CoucheRoulForm et CoucheBaseForm en interne ou le composant unifié
import AccotementsForm from "./AccotementsForm";
import Rehabilitation from "./Rehabilitation";
import DevisTP from "./DevisTP";

// Configuration de la navigation
const stepsConfig = [
  { id: "terrassement", label: "Terrassement", component: Terrassement, icon: "🚜", color: "text-yellow-500", border: "border-yellow-500/50" },
  { id: "fondation", label: "Fondation", component: Fondation, icon: "🏗️", color: "text-red-500", border: "border-red-500/50" },
  { id: "hydraulique", label: "Hydraulique", component: OuvragesHydrauliques, icon: "💧", color: "text-blue-500", border: "border-blue-500/50" },
  { id: "signalisation", label: "Signalisation", component: EquipementsDeSignalisation, icon: "🚦", color: "text-orange-500", border: "border-orange-500/50" },
  { id: "chaussee", label: "Chaussée", component: Chaussee, icon: "🛣️", color: "text-purple-500", border: "border-purple-500/50" },
  { id: "accotements", label: "Accotements", component: AccotementsForm, icon: "🌿", color: "text-pink-500", border: "border-pink-500/50" },
  { id: "rehabilitation", label: "Réhabilitation", component: Rehabilitation, icon: "🔧", color: "text-green-500", border: "border-green-500/50" },
];

const activeStepIds = new Set(stepsConfig.map(({ id }) => id));

const MATERIAL_LABELS = {
  volume: "Béton / volume",
  volumeExcave: "Déblais excavés",
  volumeFoisonne: "Déblais foisonnés",
  volumeReutilise: "Volume réutilisé",
  volumeEvacue: "Volume évacué",
  volumeDepot: "Mise en dépôt",
  volumeRemblai: "Remblai compacté",
  volumeApport: "Emprunt / apport",
  volumeCommande: "Volume à commander",
  camions: "Camions",
  nombreCamions: "Camions",
  surface: "Surface",
  finitionSurface: "Surface finition",
  tonnageTotal: "Tonnage total",
  enrobe: "Enrobé / roulement",
  fondationT: "Couche fondation",
  baseT: "Couche base",
  roulementT: "Couche roulement",
  bitumeT: "Bitume",
  granulatsT: "Granulats",
  ciment: "Ciment",
  cimentT: "Ciment",
  sable: "Sable",
  sableT: "Sable",
  gravier: "Gravier",
  gravierT: "Gravier",
  terreT: "Terre stabilisée",
  acier: "Acier",
  acierT: "Acier",
  eauL: "Eau",
  coffrage: "Coffrage",
  poidsLogistique: "Poids logistique",
  emulsionKg: "Émulsion d'accrochage",
  quantiteSignalisation: "Quantité signalisation",
  couches: "Couches",
  nbTaches: "Tâches",
  coutMateriaux: "Coût matériaux",
  coutMainOeuvre: "Coût main d'œuvre",
  coutFourniture: "Coût fourniture",
  coutPose: "Coût pose",
  coutDemolition: "Démolition / curage",
  coutChaussee: "Reprise chaussée",
  coutAssainissement: "Assainissement",
  coutSignalisation: "Signalisation",
  coutDivers: "Divers",
};

const MATERIAL_UNITS = {
  volume: "m³",
  volumeExcave: "m³",
  volumeFoisonne: "m³",
  volumeReutilise: "m³",
  volumeEvacue: "m³",
  volumeDepot: "m³",
  volumeRemblai: "m³",
  volumeApport: "m³",
  volumeCommande: "m³",
  camions: "u",
  nombreCamions: "u",
  surface: "m²",
  finitionSurface: "m²",
  tonnageTotal: "t",
  enrobe: "t",
  fondationT: "t",
  baseT: "t",
  roulementT: "t",
  bitumeT: "t",
  granulatsT: "t",
  ciment: "t",
  cimentT: "t",
  sable: "t/m³",
  sableT: "t",
  gravier: "t",
  gravierT: "t",
  terreT: "t",
  acier: "t",
  acierT: "t",
  eauL: "L",
  coffrage: "m²",
  poidsLogistique: "t",
  emulsionKg: "kg",
  quantiteSignalisation: "u",
  couches: "u",
  nbTaches: "u",
  coutMateriaux: "XOF",
  coutMainOeuvre: "XOF",
  coutFourniture: "XOF",
  coutPose: "XOF",
  coutDemolition: "XOF",
  coutChaussee: "XOF",
  coutAssainissement: "XOF",
  coutSignalisation: "XOF",
  coutDivers: "XOF",
};

const MATERIAL_ALIASES = {
  ciment: "cimentT",
  sable: "sableT",
  gravier: "gravierT",
  acier: "acierT",
  camions: "nombreCamions",
};

const CUMULABLE_KEYS = new Set([
  "volume",
  "volumeExcave",
  "volumeFoisonne",
  "volumeReutilise",
  "volumeEvacue",
  "volumeDepot",
  "volumeRemblai",
  "volumeApport",
  "volumeCommande",
  "nombreCamions",
  "surface",
  "finitionSurface",
  "tonnageTotal",
  "enrobe",
  "fondationT",
  "baseT",
  "roulementT",
  "bitumeT",
  "granulatsT",
  "cimentT",
  "sableT",
  "gravierT",
  "terreT",
  "acierT",
  "eauL",
  "coffrage",
  "poidsLogistique",
  "emulsionKg",
  "quantiteSignalisation",
  "couches",
  "nbTaches",
]);

const fmt = (value, currency = "XOF") => `${Number(value || 0).toLocaleString("fr-FR")} ${currency}`;

const fmtNum = (value, dec = 2) =>
  Number(value || 0).toLocaleString("fr-FR", { maximumFractionDigits: dec });

const buildMaterialRows = (quantites = {}) => {
  const totals = {};
  Object.values(quantites || {}).forEach((materials) => {
    Object.entries(materials || {}).forEach(([key, value]) => {
      const normalizedKey = MATERIAL_ALIASES[key] || key;
      const n = Number(value || 0);
      if (n > 0 && CUMULABLE_KEYS.has(normalizedKey)) {
        totals[normalizedKey] = (totals[normalizedKey] || 0) + n;
      }
    });
  });
  return Object.entries(totals)
    .filter(([, value]) => Number(value || 0) > 0)
    .sort(([a], [b]) => (MATERIAL_LABELS[a] || a).localeCompare(MATERIAL_LABELS[b] || b));
};

const formatQuantities = (materials = {}) => {
  const entries = Object.entries(materials || {}).filter(([, value]) => Number(value || 0) > 0);
  if (!entries.length) return "—";
  return entries
    .map(([key, value]) => {
      const normalizedKey = MATERIAL_ALIASES[key] || key;
      return `${MATERIAL_LABELS[normalizedKey] || normalizedKey}: ${fmtNum(value, normalizedKey.includes("acier") ? 3 : 2)} ${MATERIAL_UNITS[normalizedKey] || ""}`;
    })
    .join(" | ");
};

export default function TPForm({ currency = "XOF" }) {
  const calculationContext = useCalculation();
  const { setCurrentProjectType, setCurrentCalculationType, PROJECT_TYPES } = calculationContext || {};

  const [selectedStep, setSelectedStep] = usePersistentState("tp:selectedStep", null);
  const [showDevis, setShowDevis] = useState(false);
  
  // États globaux pour le Devis
  const [costs, setCosts] = usePersistentState("tp:costs", Object.fromEntries(stepsConfig.map(s => [s.id, 0])));
  const [quantitesParEtape, setQuantitesParEtape] = usePersistentState("tp:quantites", Object.fromEntries(stepsConfig.map(s => [s.id, {}])));

  // Initialisation du contexte
  useEffect(() => {
    if (calculationContext && PROJECT_TYPES?.TP) {
      setCurrentProjectType?.(PROJECT_TYPES.TP);
      setCurrentCalculationType?.('projet_complet');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedStep && !activeStepIds.has(selectedStep)) {
      setSelectedStep(null);
    }
  }, [selectedStep, setSelectedStep]);

  // --- HANDLERS OPTIMISÉS (useCallback) ---

  // Mise à jour du coût d'une étape
  const handleCostChange = useCallback((stepId, value) => {
    setCosts(prev => {
      const safeValue = Math.max(0, Number(value) || 0);
      if (prev[stepId] === safeValue) return prev; // Évite le re-render si inchangé
      return { ...prev, [stepId]: safeValue };
    });
  }, []);

  // Mise à jour des matériaux d'une étape
  const handleQuantitesChange = useCallback((stepId, materiaux) => {
    setQuantitesParEtape(prev => {
      // Comparaison basique pour éviter re-render inutile
      if (JSON.stringify(prev[stepId]) === JSON.stringify(materiaux)) return prev;
      return { ...prev, [stepId]: materiaux };
    });
  }, []);

  // --- CALCULS GLOBAUX ---
  const visibleCosts = useMemo(
    () => Object.fromEntries(stepsConfig.map(({ id }) => [id, Number(costs[id] || 0)])),
    [costs]
  );
  const visibleQuantites = useMemo(
    () => Object.fromEntries(stepsConfig.map(({ id }) => [id, quantitesParEtape[id] || {}])),
    [quantitesParEtape]
  );
  const totalGeneral = useMemo(() => Object.values(visibleCosts).reduce((acc, val) => acc + val, 0), [visibleCosts]);
  const activeSteps = useMemo(() => stepsConfig.filter(({ id }) => visibleCosts[id] > 0).length, [visibleCosts]);
  const progressPercent = (activeSteps / stepsConfig.length) * 100;
  const materialRows = useMemo(() => buildMaterialRows(visibleQuantites), [visibleQuantites]);

  // --- RENDU DYNAMIQUE ---
  const renderCurrentStep = () => {
    const step = stepsConfig.find(s => s.id === selectedStep);
    if (!step) return null;
    
    const StepComponent = step.component;
    
    return (
      <StepComponent 
        currency={currency} 
        // On passe des fonctions fléchées stables grâce au useCallback du parent
        onCostChange={(val) => handleCostChange(step.id, val)} 
        onMateriauxChange={(mats) => handleQuantitesChange(step.id, mats)} 
      />
    );
  };

  // Protection si le contexte n'est pas chargé
  if (!calculationContext) return <div className="text-white p-10">Chargement du contexte...</div>;

  return (
    <div className="flex h-[calc(100vh-80px)] w-full bg-gray-900 text-white overflow-hidden font-sans">
      
      {/* ====================== SIDEBAR (Navigation Desktop) ====================== */}
      <aside className="hidden lg:flex flex-col w-80 bg-gray-800/80 backdrop-blur-xl border-r border-gray-700 h-full transition-all duration-300 shadow-2xl z-20">
        
        {/* Header Sidebar */}
        <div className="p-6 border-b border-gray-700 shrink-0 bg-gray-800/50">
          <h1 className="text-2xl font-black bg-gradient-to-r from-orange-400 to-amber-500 bg-clip-text text-transparent mb-1 flex items-center gap-2">
            <HardHat className="w-6 h-6 text-orange-500" />
            Travaux Publics
          </h1>
          <p className="text-xs text-gray-400 mb-4 ml-1">Tableau de bord projet</p>
          
          {/* Barre de progression */}
          <div className="bg-gray-700 rounded-full h-1.5 w-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-orange-500 to-amber-500 transition-all duration-700 ease-out"
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
                    ? "bg-gray-700 border border-orange-500/50 shadow-lg" 
                    : "hover:bg-gray-800 border border-transparent hover:border-gray-700"
                }`}
              >
                {/* Indicateur sélection */}
                {isSelected && <div className="absolute left-0 top-0 bottom-0 w-1 bg-orange-500" />}

                <span className={`text-xl filter transition-all ${!isSelected && !isActive ? 'grayscale opacity-50' : 'scale-110'}`}>
                  {step.icon}
                </span>
                
                <div className="flex-1">
                  <div className={`font-bold text-sm ${isSelected ? 'text-white' : 'text-gray-300 group-hover:text-white'}`}>
                    {step.label}
                  </div>
                  {isActive ? (
                    <div className="text-xs font-mono text-orange-400 font-medium mt-0.5">
                      {(costs[step.id]).toLocaleString()} {currency}
                    </div>
                  ) : (
                    <div className="text-[10px] text-gray-600 group-hover:text-gray-500">Non chiffré</div>
                  )}
                </div>

                {isActive && (
                   <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse" />
                )}
              </button>
            );
          })}
        </div>

        {/* Footer Sidebar (Total) */}
        <div className="p-4 border-t border-gray-700 bg-gray-900/80 shrink-0 backdrop-blur-sm">
          <div className="bg-gradient-to-br from-gray-800 to-gray-750 rounded-xl p-4 border border-gray-700 shadow-lg">
             <span className="text-[10px] text-gray-400 uppercase tracking-widest block mb-1">Total Estimé</span>
             <span className="text-xl font-black text-white block truncate tracking-tight">
               {totalGeneral.toLocaleString()} <span className="text-sm font-normal text-orange-400">{currency}</span>
             </span>
             <button
                onClick={() => setShowDevis(true)}
                disabled={totalGeneral === 0}
                className="w-full mt-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white py-2.5 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95"
              >
                <FileText className="w-4 h-4" />
                Voir le Devis
              </button>
          </div>
        </div>
      </aside>


      {/* ====================== MAIN CONTENT (Zone Centrale) ====================== */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative bg-gray-900 w-full">
        
        {/* MOBILE HEADER (Visible uniquement sur mobile) */}
        <div className="lg:hidden flex items-center justify-between p-4 border-b border-gray-800 bg-gray-900 shrink-0 z-20">
           {selectedStep ? (
             <button 
                onClick={() => setSelectedStep(null)} 
                className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
             >
               <ChevronLeft className="w-5 h-5" /> Retour
             </button>
           ) : (
             <h1 className="text-lg font-bold text-orange-500 flex items-center gap-2">
               <HardHat className="w-5 h-5" /> Travaux Publics
             </h1>
           )}
           <div className="bg-gray-800 px-3 py-1.5 rounded-lg border border-gray-700 shadow-sm">
              <span className="text-xs font-bold text-white">{totalGeneral.toLocaleString()} {currency}</span>
           </div>
        </div>

        {/* CONTENU VARIABLE */}
        {selectedStep ? (
          // --- VUE DÉTAIL D'UNE ÉTAPE ---
          <div className="flex-1 w-full h-full overflow-hidden relative animate-in fade-in zoom-in-95 duration-300">
            {renderCurrentStep()}
          </div>
        ) : (
          // --- VUE GRILLE (Accueil ou Mobile) ---
          <div className="flex-1 overflow-y-auto p-4 lg:p-10 custom-scrollbar">
            
            {/* Desktop Welcome Message */}
            <div className="hidden lg:block max-w-7xl mx-auto space-y-6">
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <SummaryCard icon={<ClipboardList className="w-5 h-5" />} label="Postes chiffrés" value={`${activeSteps}/${stepsConfig.length}`} color="text-orange-400" />
                <SummaryCard icon={<Package className="w-5 h-5" />} label="Matériaux suivis" value={materialRows.length} color="text-emerald-400" />
                <SummaryCard icon={<BarChart3 className="w-5 h-5" />} label="Total estimé" value={fmt(totalGeneral, currency)} color="text-blue-300" strong />
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
                <div className="xl:col-span-7 bg-gray-800/40 border border-gray-700 rounded-3xl overflow-hidden shadow-xl">
                  <div className="px-5 py-4 border-b border-gray-700 bg-gray-800/60 flex items-center gap-2">
                    <LayoutGrid className="w-4 h-4 text-orange-400" />
                    <h2 className="text-sm font-black text-white uppercase tracking-widest">Récapitulatif par ouvrage TP</h2>
                  </div>
                  <div className="divide-y divide-gray-800">
                    {stepsConfig.map((step) => {
                      const amount = Number(costs[step.id] || 0);
                      const materials = quantitesParEtape[step.id] || {};
                      return (
                        <button
                          key={step.id}
                          onClick={() => setSelectedStep(step.id)}
                          className="w-full text-left px-5 py-4 hover:bg-gray-800/60 transition-colors"
                        >
                          <div className="flex items-start gap-3">
                            <span className="text-2xl">{step.icon}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-4">
                                <p className="font-black text-white">{step.label}</p>
                                <p className={`font-mono text-sm font-black ${amount > 0 ? "text-orange-300" : "text-gray-600"}`}>
                                  {amount > 0 ? fmt(amount, currency) : "Non chiffré"}
                                </p>
                              </div>
                              <p className="mt-2 text-xs text-gray-400 leading-relaxed">{formatQuantities(materials)}</p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="xl:col-span-5 bg-gray-800/40 border border-gray-700 rounded-3xl overflow-hidden shadow-xl">
                  <div className="px-5 py-4 border-b border-gray-700 bg-gray-800/60 flex items-center gap-2">
                    <Package className="w-4 h-4 text-emerald-400" />
                    <h2 className="text-sm font-black text-white uppercase tracking-widest">Matériaux cumulés</h2>
                  </div>
                  {materialRows.length === 0 ? (
                    <div className="px-5 py-12 text-center text-sm text-gray-500">Les quantités calculées apparaîtront ici.</div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 p-4">
                      {materialRows.map(([key, value]) => (
                        <div key={key} className="bg-gray-950/70 border border-gray-800 rounded-2xl p-4">
                          <p className="text-[10px] text-gray-500 uppercase font-black truncate">{MATERIAL_LABELS[key] || key}</p>
                          <p className="mt-1 text-lg font-black text-white font-mono">
                            {fmtNum(value, key.includes("acier") ? 3 : 2)}
                            <span className="ml-1 text-[10px] text-gray-500">{MATERIAL_UNITS[key] || ""}</span>
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="px-5 py-4 border-t border-orange-500/20 bg-orange-500/10 flex items-center justify-between">
                    <span className="text-xs font-black text-orange-300 uppercase tracking-widest">Total projet</span>
                    <span className="text-base font-black text-white font-mono">{fmt(totalGeneral, currency)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile Grid */}
            <div className="lg:hidden grid grid-cols-2 gap-4 pb-24">
               {stepsConfig.map((step) => (
                 <button
                   key={step.id}
                   onClick={() => setSelectedStep(step.id)}
                   className={`flex flex-col items-center justify-center p-5 rounded-2xl border bg-gray-800/50 backdrop-blur-sm shadow-lg ${
                     costs[step.id] > 0 
                       ? "border-orange-500/50 bg-gradient-to-br from-gray-800 to-orange-900/20" 
                       : "border-gray-700 hover:bg-gray-800"
                   } active:scale-95 transition-all duration-200`}
                 >
                   <span className="text-4xl mb-3 filter drop-shadow-lg">{step.icon}</span>
                   <span className="font-bold text-sm text-center text-gray-200">{step.label}</span>
                   {costs[step.id] > 0 && (
                     <span className="mt-2 text-[10px] font-mono font-bold text-orange-400 bg-gray-900/80 px-2 py-1 rounded-md border border-orange-500/30">
                       {(costs[step.id] / 1000).toFixed(0)}k
                     </span>
                   )}
                 </button>
               ))}
            </div>
          </div>
        )}

        {/* MOBILE FOOTER ACTION (Devis) */}
        <div className="lg:hidden fixed bottom-6 right-4 left-4 z-50 pointer-events-none">
           {totalGeneral > 0 && !selectedStep && (
              <button
                onClick={() => setShowDevis(true)}
                className="w-full pointer-events-auto bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-3.5 rounded-xl font-bold shadow-2xl flex items-center justify-center gap-2 animate-in slide-in-from-bottom-10 border border-emerald-400/30"
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
            {/* Header Modal */}
            <div className="flex justify-between items-center p-5 border-b border-gray-800 bg-gray-900 lg:rounded-t-3xl">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <FileText className="text-orange-500 w-6 h-6" /> Devis Récapitulatif
              </h2>
              <button 
                onClick={() => setShowDevis(false)}
                className="p-2 bg-gray-800 hover:bg-gray-700 rounded-full transition-colors border border-gray-700"
              >
                ✕
              </button>
            </div>
            
            {/* Contenu Devis */}
            <div className="flex-1 overflow-hidden relative">
            <DevisTP
              currency={currency}
              costs={visibleCosts}
              quantitesParEtape={visibleQuantites}
              totalGeneral={totalGeneral}
            />
            </div>
          </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #4b5563; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #6b7280; }
      `}</style>
    </div>
  );
}

const SummaryCard = ({ icon, label, value, color, strong = false }) => (
  <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5 shadow-lg">
    <div className="flex items-center gap-3">
      <div className={`${color} bg-gray-950/60 border border-gray-700 rounded-xl p-2`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest">{label}</p>
        <p className={`font-black font-mono truncate ${strong ? "text-xl text-white" : "text-lg text-gray-100"}`}>{value}</p>
      </div>
    </div>
  </div>
);
