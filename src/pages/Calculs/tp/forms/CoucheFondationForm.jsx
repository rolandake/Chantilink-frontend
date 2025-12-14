import React, { useEffect, useMemo, useState } from "react";
import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { useCalculation } from '@/context/CalculationContext';
import { 
  RollerCoaster, Ruler, Banknote, Save, Trash2, History, Weight, Droplets 
} from "lucide-react";

ChartJS.register(ArcElement, Tooltip, Legend);

// Constantes métier
const DENSITE_ENROBE = 2.35; // T/m3
const RATIO_BITUME = 0.06;   // ~6% en moyenne (ajustable)
const RATIO_GRANULATS = 0.94; // ~94%

export function CoucheRoulForm({ currency = "FCFA", onTotalChange = () => {} }) {
  const {
    localInputs,
    updateInput,
    updateMultipleInputs,
    saveCalculation,
    fetchSavedCalculations,
    savedCalculations,
    loading,
    setCalculationType,
    PROJECT_TYPES,
  } = useCalculation();

  const [message, setMessage] = useState(null);

  // Initialisation
  useEffect(() => {
    if (setCalculationType && PROJECT_TYPES) {
      setCalculationType(PROJECT_TYPES.TP, 'couche_roulement');
      fetchSavedCalculations({
        projectType: PROJECT_TYPES.TP,
        calculationType: 'couche_roulement'
      });
    }

    // Init inputs si vides
    if (!localInputs.surface) {
      updateMultipleInputs({
        surface: "",
        epaisseur: "",
        prixUnitaire: "",
        mainOeuvre: "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- MOTEUR DE CALCUL ---
  const results = useMemo(() => {
    const surf = parseFloat(localInputs.surface) || 0;
    const ep = parseFloat(localInputs.epaisseur) || 0;
    const pu = parseFloat(localInputs.prixUnitaire) || 0;
    const mo = parseFloat(localInputs.mainOeuvre) || 0;

    const volume = surf * ep;
    const poidsTotal = volume * DENSITE_ENROBE;
    
    // Composition
    const poidsBitume = poidsTotal * RATIO_BITUME;
    const poidsGranulats = poidsTotal * RATIO_GRANULATS;

    // Coûts
    const coutMateriaux = volume * pu;
    const total = coutMateriaux + mo;

    return {
      volume,
      poidsTotal,
      poidsBitume,
      poidsGranulats,
      coutMateriaux,
      mo,
      total
    };
  }, [localInputs]);

  // Sync Parent (Anti-loop)
  useEffect(() => {
    if (onTotalChange) onTotalChange(results.total);
  }, [results.total, onTotalChange]);

  // --- ACTIONS ---
  const handleSave = async () => {
    if (results.volume <= 0) {
      showToast("⚠️ Dimensions manquantes", "error");
      return;
    }
    
    await saveCalculation(
      { inputs: localInputs, results },
      PROJECT_TYPES?.TP || 'TP',
      'couche_roulement'
    );

    if (fetchSavedCalculations) {
      fetchSavedCalculations({
        projectType: PROJECT_TYPES?.TP || 'TP',
        calculationType: 'couche_roulement'
      });
    }
    showToast("✅ Couche sauvegardée !");
  };

  const handleReset = () => {
    updateMultipleInputs({
      surface: "", epaisseur: "", prixUnitaire: "", mainOeuvre: ""
    });
  };

  const showToast = (msg, type = "success") => {
    setMessage({ text: msg, type });
    setTimeout(() => setMessage(null), 3000);
  };

  // --- CHART DATA ---
  const chartData = {
    labels: ["Matériaux (Enrobé)", "Main d'œuvre"],
    datasets: [{
      data: [results.coutMateriaux, results.mo],
      backgroundColor: ["#f97316", "#3b82f6"], // Orange, Blue
      borderColor: "#1f2937",
      borderWidth: 4,
    }]
  };

  return (
    <div className="w-full h-full flex flex-col bg-gray-900 text-gray-100 overflow-hidden relative">
      
      {/* Toast */}
      {message && (
        <div className={`fixed top-4 right-4 px-6 py-3 rounded-xl shadow-2xl z-50 font-bold animate-in fade-in slide-in-from-top-2 ${
          message.type === "error" ? "bg-red-600" : "bg-orange-600"
        }`}>
          {message.text}
        </div>
      )}

      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-600/20 rounded-lg text-orange-500">
            <RollerCoaster className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Couche de Roulement</h2>
            <p className="text-xs text-gray-400">Béton Bitumineux (BB) / Enrobé</p>
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg px-4 py-2 border border-gray-700">
          <span className="text-xs text-gray-400 block">Total Estimé</span>
          <span className="text-lg font-black text-orange-400">
            {results.total.toLocaleString(undefined, { maximumFractionDigits: 0 })} <span className="text-sm text-gray-500">{currency}</span>
          </span>
        </div>
      </div>

      {/* Main Grid */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
          
          {/* GAUCHE : SAISIE (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            
            {/* Dimensions */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5 shadow-lg">
              <h3 className="flex items-center gap-2 text-sm font-bold text-orange-400 uppercase tracking-wider mb-4">
                <Ruler className="w-4 h-4" /> Géométrie
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <InputGroup 
                  label="Surface (m²)" 
                  value={localInputs.surface} 
                  onChange={(e) => updateInput('surface', e.target.value)} 
                  placeholder="Ex: 500"
                />
                <InputGroup 
                  label="Épaisseur (m)" 
                  value={localInputs.epaisseur} 
                  onChange={(e) => updateInput('epaisseur', e.target.value)} 
                  placeholder="Ex: 0.05"
                />
              </div>
            </div>

            {/* Coûts */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5 shadow-lg flex-1 flex flex-col gap-4">
              <h3 className="flex items-center gap-2 text-sm font-bold text-gray-400 uppercase tracking-wider">
                <Banknote className="w-4 h-4" /> Coûts
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <InputGroup 
                  label={`Prix Enrobé (${currency}/m³)`} 
                  value={localInputs.prixUnitaire} 
                  onChange={(e) => updateInput('prixUnitaire', e.target.value)} 
                  placeholder="Ex: 120000"
                />
                <InputGroup 
                  label={`Main d'œuvre (${currency})`} 
                  value={localInputs.mainOeuvre} 
                  onChange={(e) => updateInput('mainOeuvre', e.target.value)} 
                  placeholder="Ex: 50000"
                />
              </div>

              <div className="mt-auto pt-6 flex gap-3">
                <button 
                  onClick={handleSave}
                  disabled={loading}
                  className="flex-1 bg-gradient-to-r from-orange-600 to-red-600 hover:opacity-90 text-white py-3 rounded-xl font-bold shadow-lg active:scale-95 transition-all flex justify-center items-center gap-2 disabled:opacity-50"
                >
                  {loading ? <span className="animate-spin">⏳</span> : <Save className="w-5 h-5" />}
                  Sauvegarder
                </button>
                <button 
                  onClick={handleReset}
                  className="px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-xl transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* DROITE : RÉSULTATS (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            
            {/* KPIs */}
            <div className="grid grid-cols-3 gap-4">
              <ResultCard label="Volume Compacté" value={results.volume.toFixed(2)} unit="m³" icon="🧊" color="text-blue-400" bg="bg-blue-500/10" />
              <ResultCard label="Tonnage Total" value={results.poidsTotal.toFixed(2)} unit="t" icon={<Weight className="w-4 h-4"/>} color="text-orange-400" bg="bg-orange-500/10" border />
              <ResultCard label="Bitume Pur" value={results.poidsBitume.toFixed(2)} unit="t" icon={<Droplets className="w-4 h-4"/>} color="text-gray-300" bg="bg-gray-700/50" />
            </div>

            {/* Graphique & Détails */}
            <div className="flex-1 bg-gray-800 rounded-2xl p-6 border border-gray-700 shadow-xl flex flex-col md:flex-row gap-8 items-center relative overflow-hidden">
               <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-orange-600/10 rounded-full blur-3xl pointer-events-none" />

               <div className="w-40 h-40 flex-shrink-0 relative">
                  <Doughnut data={chartData} options={{ cutout: "75%", plugins: { legend: { display: false } } }} />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                     <span className="text-sm font-bold text-orange-400">{results.volume.toFixed(1)} m³</span>
                  </div>
               </div>

               <div className="flex-1 w-full space-y-3">
                  <h4 className="text-gray-400 text-sm font-medium border-b border-gray-700 pb-2">Composition (Est. Densité 2.35)</h4>
                  <MaterialRow label="Granulats (94%)" valPoids={`${results.poidsGranulats.toFixed(2)} t`} color="bg-stone-500" />
                  <MaterialRow label="Bitume (6%)" valPoids={`${results.poidsBitume.toFixed(2)} t`} color="bg-black border border-gray-600" />
                  
                  <div className="pt-2 border-t border-gray-700 flex justify-between items-center mt-2">
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-blue-500"></div> Main d'œuvre
                    </span>
                    <span className="text-sm font-bold text-white">{results.mo.toLocaleString()} {currency}</span>
                  </div>
               </div>
            </div>

            {/* Historique */}
            {savedCalculations && savedCalculations.length > 0 && (
              <div className="bg-gray-800/30 rounded-2xl border border-gray-700/50 overflow-hidden flex-1 min-h-[150px]">
                <div className="px-4 py-2 bg-gray-800/50 border-b border-gray-700/50 flex justify-between items-center">
                  <h4 className="text-xs font-bold text-gray-400 flex items-center gap-2">
                    <History className="w-3 h-3" /> Historique ({savedCalculations.length})
                  </h4>
                </div>
                <div className="overflow-y-auto max-h-[180px] p-2 space-y-2">
                  {savedCalculations.map((item) => (
                    <div key={item._id || item.id} className="flex justify-between items-center bg-gray-700/30 p-2 rounded hover:bg-gray-700/50 transition border border-transparent hover:border-orange-500/30">
                      <div className="flex flex-col">
                         <span className="text-[10px] text-gray-500">{new Date(item.savedAt || item.date).toLocaleDateString()}</span>
                         <span className="text-xs text-gray-300">Vol: {item.results?.volume} m³</span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-bold text-orange-400">{parseFloat(item.results?.total || 0).toLocaleString()} {currency}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}

// --- SOUS-COMPOSANTS ---

const InputGroup = ({ label, value, onChange, placeholder, full = false }) => (
  <div className={`flex flex-col ${full ? "col-span-2" : ""}`}>
    <label className="mb-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-wide">{label}</label>
    <input
      type="number"
      min="0"
      step="any"
      value={value}
      onChange={onChange}
      className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all font-mono text-sm"
      placeholder={placeholder || "0"}
    />
  </div>
);

const ResultCard = ({ label, value, unit, color, bg, border, icon }) => (
  <div className={`rounded-xl p-3 flex flex-col justify-center items-center text-center ${bg} ${border ? 'border border-gray-600' : ''}`}>
    <span className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 flex items-center gap-1">
      {icon} {label}
    </span>
    <span className={`text-xl font-black ${color}`}>
      {value} <span className="text-xs font-normal text-gray-500">{unit}</span>
    </span>
  </div>
);

const MaterialRow = ({ label, valPoids, color }) => (
  <div className="flex justify-between items-center border-b border-gray-700/50 pb-2 last:border-0 group">
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${color}`} />
      <span className="text-gray-300 text-sm font-medium">{label}</span>
    </div>
    <span className="text-sm font-bold text-white font-mono">{valPoids}</span>
  </div>
);