import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from "framer-motion";
import { 
  Train, 
  FileText, 
  ChevronLeft, 
  LayoutDashboard, 
  Activity, 
  Zap, 
  Map as MapIcon, 
  Settings, 
  HardHat, 
  ShieldAlert,
  BarChart3,
  Download,
  Trash2
} from "lucide-react";

// ✅ Imports de tes sous-composants
import EtudeFaisabilite from "./EtudeFaisabilite";
import ConceptionPreliminaire from "./ConceptionPreliminaire";
import EvaluationImpact from "./EvaluationImpact";
import EtudesDetaillees from "./EtudesDetaillees";
import AcquisitionTerrain from "./AcquisitionTerrain";
import ConstructionInfrastructure from "./ConstructionInfrastructure";
import PoseRails from "./PoseRails";
import Electrification from "./Electrification";
import InstallationSignalisation from "./InstallationSignalisation";
import EssaisTests from "./EssaisTests";
import MiseEnService from "./MiseEnService";
import SuiviMaintenance from "./SuiviMaintenance";
import ProjetTracker from "./ProjetTracker";
import DevisFerroviaire from "./DevisFerroviaire";

const STORAGE_KEY = "ferroviaire-master-data";

const stepsConfig = [
  { id: "etudeFaisabilite", label: "Faisabilité", component: EtudeFaisabilite, icon: <Activity className="w-4 h-4"/>, color: "blue" },
  { id: "conceptionPreliminaire", label: "Conception", component: ConceptionPreliminaire, icon: <Settings className="w-4 h-4"/>, color: "slate" },
  { id: "evaluationImpact", label: "Impact Env.", component: EvaluationImpact, icon: <ShieldAlert className="w-4 h-4"/>, color: "emerald" },
  { id: "etudesDetaillees", label: "Études BE", component: EtudesDetaillees, icon: <FileText className="w-4 h-4"/>, color: "indigo" },
  { id: "acquisitionTerrain", label: "Foncier", component: AcquisitionTerrain, icon: <MapIcon className="w-4 h-4"/>, color: "orange" },
  { id: "constructionInfrastructure", label: "Génie Civil", component: ConstructionInfrastructure, icon: <HardHat className="w-4 h-4"/>, color: "stone" },
  { id: "poseRails", label: "Superstructure", component: PoseRails, icon: <Settings className="w-4 h-4"/>, color: "cyan" },
  { id: "electrification", label: "Électrification", component: Electrification, icon: <Zap className="w-4 h-4"/>, color: "yellow" },
  { id: "installationSignalisation", label: "Signalisation", component: InstallationSignalisation, icon: <ShieldAlert className="w-4 h-4"/>, color: "rose" },
  { id: "essaisTests", label: "Essais", component: EssaisTests, icon: <Activity className="w-4 h-4"/>, color: "violet" },
  { id: "miseEnService", label: "Exploitation", component: MiseEnService, icon: <Train className="w-4 h-4"/>, color: "green" },
  { id: "suiviMaintenance", label: "Maintenance", component: SuiviMaintenance, icon: <Settings className="w-4 h-4"/>, color: "sky" },
];

export default function FerroviaireForm() {
  const [selectedStep, setSelectedStep] = useState(null);
  const [currency, setCurrency] = useState("FCFA");
  const [costs, setCosts] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  });
  const [quantitiesByStep, setQuantitiesByStep] = useState({});

  // ✅ Sauvegarde automatique
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(costs));
  }, [costs]);

  // ✅ Handlers optimisés
  const handleCostChange = useCallback((stepId, value) => {
    setCosts(prev => {
      if (prev[stepId] === value) return prev;
      return { ...prev, [stepId]: Number(value) || 0 };
    });
  }, []);

  const handleQuantitiesChange = useCallback((stepId, materials) => {
    setQuantitiesByStep(prev => ({ ...prev, [stepId]: materials }));
  }, []);

  // ✅ Calculs globaux
  const totalGeneral = useMemo(() => Object.values(costs).reduce((acc, v) => acc + v, 0), [costs]);
  const progress = useMemo(() => (Object.values(costs).filter(v => v > 0).length / stepsConfig.length) * 100, [costs]);

  const renderActiveStep = () => {
    if (selectedStep === "devisFerroviaire") {
        return <DevisFerroviaire costs={costs} quantities={quantitiesByStep} currency={currency} />;
    }
    if (selectedStep === "projetTracker") {
        return <ProjetTracker costs={costs} />;
    }
    
    const step = stepsConfig.find(s => s.id === selectedStep);
    if (!step) return null;
    const Component = step.component;
    return (
      <Component
        currency={currency}
        onCostChange={(val) => handleCostChange(step.id, val)}
        onMateriauxChange={(mats) => handleQuantitiesChange(step.id, mats)}
      />
    );
  };

  return (
    <div className="flex h-[calc(100vh-64px)] w-full bg-gray-950 text-white overflow-hidden font-sans">
      
      {/* ====================== SIDEBAR (Navigation) ====================== */}
      <aside className="hidden lg:flex flex-col w-72 bg-gray-900 border-r border-gray-800 shadow-2xl z-20">
        <div className="p-6 border-b border-gray-800">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-indigo-600 rounded-lg">
              <Train className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-black tracking-tighter uppercase italic">RailPro <span className="text-indigo-500">BE</span></h1>
          </div>
          
          {/* Progression */}
          <div className="bg-gray-800 rounded-full h-1.5 w-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              className="h-full bg-indigo-500"
            />
          </div>
          <div className="flex justify-between mt-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
            <span>Complétion</span>
            <span>{Math.round(progress)}%</span>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar">
          <button
            onClick={() => setSelectedStep(null)}
            className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${!selectedStep ? "bg-indigo-600 text-white shadow-lg" : "text-gray-400 hover:bg-gray-800"}`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span className="text-sm font-bold">Vue d'ensemble</span>
          </button>

          <div className="h-4" />
          <p className="px-3 text-[10px] font-black text-gray-600 uppercase tracking-[0.2em] mb-2">Phases du projet</p>

          {stepsConfig.map((step) => (
            <button
              key={step.id}
              onClick={() => setSelectedStep(step.id)}
              className={`w-full flex items-center justify-between p-3 rounded-xl transition-all group ${selectedStep === step.id ? "bg-gray-800 border border-indigo-500/50" : "hover:bg-gray-800/50"}`}
            >
              <div className="flex items-center gap-3">
                <span className={`${selectedStep === step.id ? "text-indigo-400" : "text-gray-600 group-hover:text-indigo-400"}`}>
                  {step.icon}
                </span>
                <span className={`text-xs font-bold ${selectedStep === step.id ? "text-white" : "text-gray-500"}`}>{step.label}</span>
              </div>
              {costs[step.id] > 0 && <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_#6366f1]" />}
            </button>
          ))}

          <div className="h-4" />
          <p className="px-3 text-[10px] font-black text-gray-600 uppercase tracking-[0.2em] mb-2">Documents</p>
          <button onClick={() => setSelectedStep("devisFerroviaire")} className="w-full flex items-center gap-3 p-3 rounded-xl text-gray-400 hover:bg-gray-800">
            <FileText className="w-4 h-4" />
            <span className="text-sm font-bold">Bordereau (BPU)</span>
          </button>
        </nav>

        {/* Total Projet */}
        <div className="p-4 bg-gray-900 border-t border-gray-800">
           <div className="bg-indigo-600/10 border border-indigo-500/30 p-4 rounded-2xl">
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest block mb-1">Budget Global</span>
              <div className="text-lg font-black text-white truncate">
                {totalGeneral.toLocaleString()} <span className="text-xs font-normal opacity-60">{currency}</span>
              </div>
           </div>
        </div>
      </aside>

      {/* ====================== MAIN CONTENT ====================== */}
      <main className="flex-1 flex flex-col h-full bg-gray-950 relative overflow-hidden">
        
        {/* Mobile Header */}
        <div className="lg:hidden flex items-center justify-between p-4 border-b border-gray-800 bg-gray-900 z-30">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-600 rounded">
                <Train className="w-4 h-4 text-white" />
            </div>
            <span className="font-black uppercase text-xs tracking-tighter">RailPro</span>
          </div>
          <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="bg-gray-800 text-[10px] border-none rounded px-2 py-1 outline-none">
            <option value="FCFA">FCFA</option>
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
          </select>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <AnimatePresence mode="wait">
            {!selectedStep ? (
              <motion.div 
                key="welcome"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="p-8 max-w-4xl mx-auto"
              >
                <div className="text-center mb-12">
                   <h2 className="text-4xl font-black text-white mb-4">Ingénierie Ferroviaire</h2>
                   <p className="text-gray-400">Gérez l'ensemble de la chaîne de valeur : de l'étude d'impact à la maintenance.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                   {stepsConfig.map(step => (
                     <button 
                        key={step.id} 
                        onClick={() => setSelectedStep(step.id)}
                        className="p-6 bg-gray-900 border border-gray-800 rounded-3xl hover:border-indigo-500/50 transition-all text-left group"
                      >
                        <div className={`p-3 rounded-2xl bg-${step.color}-500/10 text-${step.color}-500 w-fit mb-4 group-hover:scale-110 transition-transform`}>
                          {step.icon}
                        </div>
                        <h3 className="font-bold text-white mb-1">{step.label}</h3>
                        <p className="text-[10px] text-gray-500 uppercase font-bold">
                          {costs[step.id] ? `${costs[step.id].toLocaleString()} ${currency}` : "Non chiffré"}
                        </p>
                     </button>
                   ))}
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="step"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="h-full"
              >
                <div className="sticky top-0 bg-gray-950/80 backdrop-blur-md p-4 border-b border-gray-800 flex justify-between items-center z-10">
                   <button onClick={() => setSelectedStep(null)} className="flex items-center gap-2 text-xs font-bold text-gray-400 hover:text-white transition-colors">
                      <ChevronLeft className="w-4 h-4" /> Retour
                   </button>
                   <div className="text-xs font-black uppercase tracking-widest text-indigo-400">
                      {selectedStep.replace(/([A-Z])/g, ' $1')}
                   </div>
                </div>
                <div className="p-6">
                    {renderActiveStep()}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Global Action Bar */}
        <div className="flex-shrink-0 p-4 border-t border-gray-800 bg-gray-900/50 backdrop-blur-sm flex justify-center gap-4">
           <button className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 px-6 py-2.5 rounded-full font-bold text-sm transition-all shadow-lg shadow-indigo-500/20">
              <Download className="w-4 h-4" /> PDF
           </button>
           <button className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 px-6 py-2.5 rounded-full font-bold text-sm transition-all border border-gray-700">
              <BarChart3 className="w-4 h-4 text-emerald-500" /> Excel
           </button>
        </div>
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e1b4b; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #312e81; }
      `}</style>
    </div>
  );
}