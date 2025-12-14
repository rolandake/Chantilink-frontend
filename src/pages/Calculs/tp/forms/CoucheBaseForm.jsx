import React, { useEffect, useMemo, useState } from "react";
import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { useCalculation } from '@/contexts/CalculationContext'; // Assurez-vous que ce chemin est correct
import { 
  Layers, Ruler, Banknote, Save, Trash2, History, Info, Cuboid 
} from "lucide-react";

ChartJS.register(ArcElement, Tooltip, Legend);

// Constantes métier
const DENSITE_GRAVIER = 1.8;
const DENSITE_SABLE = 1.6;
const PROP_GRAVIER = 0.7; // 70%
const PROP_SABLE = 0.3;   // 30%

export function CoucheBaseForm({ currency = "FCFA", onTotalChange = () => {} }) {
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
    // Si la méthode setCalculationType existe, on l'utilise
    if (setCalculationType && PROJECT_TYPES) {
      setCalculationType(PROJECT_TYPES.TP, 'couche_base');
      fetchSavedCalculations({
        projectType: PROJECT_TYPES.TP,
        calculationType: 'couche_base'
      });
    }

    // Initialiser les champs si vides
    if (!localInputs.longueur) {
      updateMultipleInputs({
        longueur: "",
        largeur: "",
        epaisseur: "",
        prixUnitaire: "",
        coutMainOeuvre: "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- MOTEUR DE CALCUL ---
  const results = useMemo(() => {
    const L = parseFloat(localInputs.longueur) || 0;
    const l = parseFloat(localInputs.largeur) || 0;
    const e = parseFloat(localInputs.epaisseur) || 0;
    const pu = parseFloat(localInputs.prixUnitaire) || 0;
    const mo = parseFloat(localInputs.coutMainOeuvre) || 0;

    const surface = L * l;
    const volume = surface * e;

    // Matériaux
    const gravM3 = volume * PROP_GRAVIER;
    const sabM3 = volume * PROP_SABLE;
    
    const gravT = gravM3 * DENSITE_GRAVIER;
    const sabT = sabM3 * DENSITE_SABLE;

    // Coûts
    const coutMateriaux = volume * pu;
    const total = coutMateriaux + mo;

    return {
      surface,
      volume,
      gravierM3,
      sableM3,
      gravierT,
      sableT,
      coutMateriaux,
      mo,
      total,
    };
  }, [localInputs]);

  // Sync parent (Anti-loop)
  useEffect(() => {
    if (onTotalChange) onTotalChange(results.total);
  }, [results.total, onTotalChange]);

  // --- ACTIONS ---
  const handleSave = async () => {
    if (results.volume <= 0) {
      showToast("⚠️ Dimensions invalides", "error");
      return;
    }
    
    await saveCalculation(
      { inputs: localInputs, results },
      PROJECT_TYPES?.TP || 'TP',
      'couche_base'
    );

    if (fetchSavedCalculations) {
      fetchSavedCalculations({
        projectType: PROJECT_TYPES?.TP || 'TP',
        calculationType: 'couche_base'
      });
    }
    showToast("✅ Calcul sauvegardé !");
  };

  const handleReset = () => {
    updateMultipleInputs({
      longueur: "", largeur: "", epaisseur: "", prixUnitaire: "", coutMainOeuvre: ""
    });
  };

  const showToast = (msg, type = "success") => {
    setMessage({ text: msg, type });
    setTimeout(() => setMessage(null), 3000);
  };

  // --- CHART DATA ---
  const chartData = {
    labels: ["Matériaux", "Main d'œuvre"],
    datasets: [{
      data: [results.coutMateriaux, results.mo],
      backgroundColor: ["#3b82f6", "#f59e0b"], // Blue, Amber
      borderColor: "#1f2937",
      borderWidth: 4,
    }]
  };

  return (
    <div className="w-full h-full flex flex-col bg-gray-900 text-gray-100 overflow-hidden relative">
      
      {/* Toast Notification */}
      {message && (
        <div className={`fixed top-4 right-4 px-6 py-3 rounded-xl shadow-2xl z-50 font-bold animate-in fade-in slide-in-from-top-2 ${
          message.type === "error" ? "bg-red-600" : "bg-emerald-600"
        }`}>
          {message.text}
        </div>
      )}

      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600/20 rounded-lg text-blue-500">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Couche de Base</h2>
            <p className="text-xs text-gray-400">Grave non traitée / Concassée</p>
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg px-4 py-2 border border-gray-700">
          <span className="text-xs text-gray-400 block">Total Estimé</span>
          <span className="text-lg font-black text-blue-400">
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
              <h3 className="flex items-center gap-2 text-sm font-bold text-blue-400 uppercase tracking-wider mb-4">
                <Ruler className="w-4 h-4" /> Géométrie
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <InputGroup 
                  label="Longueur (m)" 
                  value={localInputs.longueur} 
                  onChange={(e) => updateInput('longueur', e.target.value)} 
                />
                <InputGroup 
                  label="Largeur (m)" 
                  value={localInputs.largeur} 
                  onChange={(e) => updateInput('largeur', e.target.value)} 
                />
                <InputGroup 
                  label="Épaisseur (m)" 
                  value={localInputs.epaisseur} 
                  onChange={(e) => updateInput('epaisseur', e.target.value)} 
                  full
                />
              </div>
            </div>

            {/* Coûts */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5 shadow-lg flex-1 flex flex-col gap-4">
              <h3 className="flex items-center gap-2 text-sm font-bold text-gray-400 uppercase tracking-wider">
                <Banknote className="w-4 h-4" /> Paramètres Coûts
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <InputGroup 
                  label={`Prix GNT (${currency}/m³)`} 
                  value={localInputs.prixUnitaire} 
                  onChange={(e) => updateInput('prixUnitaire', e.target.value)} 
                />
                <InputGroup 
                  label={`Main d'œuvre (${currency})`} 
                  value={localInputs.coutMainOeuvre} 
                  onChange={(e) => updateInput('coutMainOeuvre', e.target.value)} 
                />
              </div>

              <div className="mt-auto pt-6 flex gap-3">
                <button 
                  onClick={handleSave}
                  disabled={loading}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-600 hover:opacity-90 text-white py-3 rounded-xl font-bold shadow-lg active:scale-95 transition-all flex justify-center items-center gap-2 disabled:opacity-50"
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
              <ResultCard label="Volume" value={results.volume.toFixed(2)} unit="m³" icon={<Cuboid className="w-4 h-4"/>} color="text-blue-400" bg="bg-blue-500/10" />
              <ResultCard label="Poids Gravier" value={results.gravierT.toFixed(1)} unit="t" icon="🪨" color="text-emerald-400" bg="bg-emerald-500/10" border />
              <ResultCard label="Poids Sable" value={results.sableT.toFixed(1)} unit="t" icon="🏖️" color="text-amber-400" bg="bg-amber-500/10" />
            </div>

            {/* Graphique & Détails */}
            <div className="flex-1 bg-gray-800 rounded-2xl p-6 border border-gray-700 shadow-xl flex flex-col md:flex-row gap-8 items-center relative overflow-hidden">
               <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

               <div className="w-40 h-40 flex-shrink-0 relative">
                  <Doughnut data={chartData} options={{ cutout: "75%", plugins: { legend: { display: false } } }} />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                     <span className="text-sm font-bold text-blue-400">{results.volume.toFixed(1)} m³</span>
                  </div>
               </div>

               <div className="flex-1 w-full space-y-4">
                  <h4 className="text-gray-400 text-sm font-medium border-b border-gray-700 pb-2">Composition Matériaux</h4>
                  <MaterialRow label="Gravier (70%)" valVol={`${results.gravierM3.toFixed(2)} m³`} valPoids={`${results.gravierT.toFixed(1)} t`} color="bg-emerald-500" />
                  <MaterialRow label="Sable (30%)" valVol={`${results.sableM3.toFixed(2)} m³`} valPoids={`${results.sableT.toFixed(1)} t`} color="bg-amber-500" />
                  
                  <div className="pt-2 border-t border-gray-700 flex justify-between items-center mt-2">
                    <span className="text-xs text-gray-400">Densités: G=1.8, S=1.6</span>
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
                    <div key={item._id || item.id} className="flex justify-between items-center bg-gray-700/30 p-2 rounded hover:bg-gray-700/50 transition border border-transparent hover:border-blue-500/30">
                      <div className="flex flex-col">
                         <span className="text-[10px] text-gray-500">{new Date(item.savedAt || item.date).toLocaleDateString()}</span>
                         <span className="text-xs text-gray-300">Vol: {item.results?.volume} m³</span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-bold text-blue-400">{parseFloat(item.results?.total || 0).toLocaleString()} {currency}</span>
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
      className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono text-sm"
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

const MaterialRow = ({ label, valVol, valPoids, color }) => (
  <div className="flex justify-between items-center border-b border-gray-700/50 pb-2 last:border-0 group">
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${color}`} />
      <span className="text-gray-300 text-sm font-medium">{label}</span>
    </div>
    <div className="flex flex-col items-end">
        <span className="text-sm font-bold text-white font-mono">{valPoids}</span>
        <span className="text-[10px] text-gray-500">{valVol}</span>
    </div>
  </div>
);