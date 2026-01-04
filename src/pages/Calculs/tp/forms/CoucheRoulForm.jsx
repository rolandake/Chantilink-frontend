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
  Construction, Ruler, Banknote, Save, Trash2, History, Weight, Droplets, Info, Truck 
} from "lucide-react";

ChartJS.register(ArcElement, Tooltip, Legend);

// Constantes professionnelles (Bureau d'études TP)
const DENSITE_ENROBE = 2.35; // T/m3 compacté
const RATIO_BITUME = 0.06;   // 6% de bitume moyen dans le mélange BB

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

    if (!localInputs.surface) {
      updateMultipleInputs({
        surface: "",
        epaisseur: "0.05", // 5cm par défaut (standard)
        prixUnitaire: "",
        mainOeuvre: "",
        margePerte: "5" // 5% de perte chantier
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
    const margin = 1 + (parseFloat(localInputs.margePerte) || 0) / 100;

    const volumeFini = surf * ep;
    const tonnageEnrobe = volumeFini * DENSITE_ENROBE * margin;
    
    const poidsBitume = tonnageEnrobe * RATIO_BITUME;
    const poidsGranulats = tonnageEnrobe * (1 - RATIO_BITUME);

    // Coûts
    const coutMateriaux = tonnageEnrobe * pu;
    const total = coutMateriaux + mo;

    return {
      volume: volumeFini.toFixed(3),
      tonnage: tonnageEnrobe.toFixed(2),
      bitume: poidsBitume.toFixed(2),
      granulats: poidsGranulats.toFixed(2),
      coutMateriaux,
      mo,
      total: total.toFixed(2)
    };
  }, [localInputs]);

  // Sync parent
  useEffect(() => {
    onTotalChange(Number(results.total));
  }, [results.total, onTotalChange]);

  const handleSave = async () => {
    if (Number(results.volume) === 0) return showToast("⚠️ Dimensions invalides", "error");
    
    await saveCalculation(
      { inputs: localInputs, results },
      PROJECT_TYPES.TP,
      'couche_roulement'
    );
    showToast("✅ Calcul enregistré !");
  };

  const showToast = (msg, type = "success") => {
    setMessage({ text: msg, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const chartData = {
    labels: ["Fournitures (Enrobé)", "Mise en œuvre"],
    datasets: [{
      data: [results.coutMateriaux, results.mo],
      backgroundColor: ["#f97316", "#374151"],
      borderColor: "#111827",
      borderWidth: 2,
    }]
  };

  return (
    <div className="w-full h-full flex flex-col bg-gray-900 text-gray-100 overflow-hidden relative font-sans">
      
      {/* Toast Notification */}
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
            <Construction className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white uppercase tracking-tight">Couche de Roulement</h2>
            <p className="text-xs text-gray-400 font-medium">Enrobé (BB) / Asphalte</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-gray-500 uppercase font-bold block tracking-widest">Total Estimé</span>
          <span className="text-2xl font-black text-orange-400 tracking-tighter">
            {Number(results.total).toLocaleString()} <span className="text-sm font-normal text-gray-500">{currency}</span>
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-6 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
          
          {/* GAUCHE : SAISIE */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            <div className="bg-gray-800/50 border border-gray-700 rounded-3xl p-6 shadow-xl space-y-6">
              <h3 className="flex items-center gap-2 text-xs font-bold text-orange-400 uppercase tracking-widest">
                <Ruler className="w-4 h-4" /> Dimensionnement
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label="Surface (m²)" value={localInputs.surface} onChange={v => updateInput('surface', v)} placeholder="Ex: 500" />
                <InputGroup label="Épaisseur (m)" value={localInputs.epaisseur} onChange={v => updateInput('epaisseur', v)} placeholder="0.05" />
                <InputGroup label="Pertes (%)" value={localInputs.margePerte} onChange={v => updateInput('margePerte', v)} placeholder="5" full />
              </div>
            </div>

            <div className="bg-gray-800/50 border border-gray-700 rounded-3xl p-6 shadow-xl space-y-6 flex-1">
              <h3 className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
                <Banknote className="w-4 h-4" /> Analyse des Coûts
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label={`PU Enrobé (${currency}/T)`} value={localInputs.prixUnitaire} onChange={v => updateInput('prixUnitaire', v)} />
                <InputGroup label={`Pose (${currency}/m³)`} value={localInputs.mainOeuvre} onChange={v => updateInput('mainOeuvre', v)} />
              </div>
              <button 
                onClick={handleSave}
                disabled={loading}
                className="w-full bg-orange-600 hover:bg-orange-500 text-white py-4 rounded-2xl font-bold shadow-lg transition-all flex justify-center items-center gap-2 active:scale-95 disabled:opacity-50"
              >
                {loading ? <span className="animate-spin">⏳</span> : <Save className="w-5 h-5" />}
                Enregistrer la Section
              </button>
            </div>
          </div>

          {/* DROITE : RÉSULTATS */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            
            <div className="grid grid-cols-3 gap-4">
              <ResultCard label="Volume" value={results.volume} unit="m³" icon="🧊" color="text-orange-400" bg="bg-orange-500/10" />
              <ResultCard label="Masse Totale" value={results.tonnage} unit="T" icon={<Weight className="w-4 h-4"/>} color="text-white" bg="bg-gray-800" border />
              <ResultCard label="Logistique" value={Math.ceil(results.tonnage / 16)} unit="camions" icon={<Truck className="w-4 h-4"/>} color="text-blue-400" bg="bg-blue-500/10" />
            </div>

            <div className="flex-1 bg-gray-800 rounded-3xl p-8 border border-gray-700 shadow-xl flex flex-col md:flex-row gap-10 items-center relative overflow-hidden">
               <div className="absolute -bottom-10 -right-10 w-44 h-44 bg-orange-600/10 rounded-full blur-3xl pointer-events-none" />

               <div className="w-44 h-44 flex-shrink-0 relative">
                  <Doughnut data={chartData} options={{ cutout: "75%", plugins: { legend: { display: false } } }} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                     <span className="text-[10px] text-gray-500 uppercase font-bold text-center leading-tight">Masse<br/>à livrer</span>
                     <span className="text-sm font-bold text-white">{results.tonnage} T</span>
                  </div>
               </div>

               <div className="flex-1 w-full space-y-4">
                  <h4 className="text-gray-400 text-xs font-bold uppercase tracking-widest border-b border-gray-700 pb-2 mb-2">Besoins en Fournitures</h4>
                  <MaterialRow label="Bitume pur (6%)" val={`${results.bitume} T`} color="bg-black border border-gray-600" />
                  <MaterialRow label="Granulats (94%)" val={`${results.granulats} T`} color="bg-stone-500" />
                  
                  <div className="pt-2 border-t border-gray-700 flex justify-between items-center">
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Droplets className="w-3 h-3 text-blue-400" /> Émulsion d'accrochage
                    </span>
                    <span className="text-sm font-bold text-white font-mono">~1.0 kg/m²</span>
                  </div>

                  <div className="flex items-start gap-2 p-4 bg-blue-500/5 rounded-2xl border border-blue-500/20">
                    <Info className="w-4 h-4 text-blue-400 mt-0.5" />
                    <p className="text-[10px] text-blue-200/70 leading-relaxed italic">
                      Les tonnages sont calculés sur une densité de <strong>2.35 T/m³</strong> après compactage. Prévoyez une température de pose minimale de 120°C.
                    </p>
                  </div>
               </div>
            </div>

            {/* Historique Mini */}
            {savedCalculations?.length > 0 && (
              <div className="bg-gray-800/30 rounded-2xl border border-gray-700/50 overflow-hidden">
                <div className="px-4 py-2 bg-gray-800/50 border-b border-gray-700/50 flex justify-between items-center text-xs">
                  <h4 className="font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2"><History className="w-3 h-3" /> Historique de pose</h4>
                </div>
                <div className="max-h-[120px] overflow-y-auto">
                  {savedCalculations.slice(0, 5).map((item) => (
                    <div key={item._id || item.id} className="flex justify-between items-center p-3 border-b border-gray-700/30 hover:bg-gray-700/40 transition-colors text-xs">
                      <div>
                        <span className="text-gray-500 block text-[9px]">{new Date(item.savedAt).toLocaleDateString()}</span>
                        <span className="font-medium uppercase">{item.inputs.surface}m² x {item.inputs.epaisseur}m</span>
                      </div>
                      <span className="font-bold text-orange-400">{parseFloat(item.results.total).toLocaleString()} {currency}</span>
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
    <label className="mb-1 text-[10px] font-bold text-gray-500 uppercase tracking-wide">{label}</label>
    <input
      type="number" value={value || ""} onChange={e => onChange(e.target.value)}
      className="w-full bg-gray-900 border border-gray-600 rounded-xl px-4 py-3 text-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all font-mono text-sm"
      placeholder={placeholder || "0"}
    />
  </div>
);

const ResultCard = ({ label, value, unit, color, bg, border, icon }) => (
  <div className={`rounded-2xl p-4 flex flex-col justify-center items-center text-center ${bg} ${border ? 'border border-gray-700' : ''}`}>
    <span className="text-[10px] text-gray-500 uppercase font-bold mb-1 flex items-center gap-1">
      {icon} {label}
    </span>
    <span className={`text-xl font-black ${color}`}>
      {value} <span className="text-xs font-normal text-gray-500 lowercase">{unit}</span>
    </span>
  </div>
);

const MaterialRow = ({ label, val, color }) => (
  <div className="flex justify-between items-center border-b border-gray-700/30 pb-2 last:border-0">
    <div className="flex items-center gap-2">
      <div className={`w-1.5 h-1.5 rounded-full ${color}`} />
      <span className="text-gray-300 text-xs font-medium">{label}</span>
    </div>
    <span className="text-xs font-bold text-white font-mono">{val}</span>
  </div>
);