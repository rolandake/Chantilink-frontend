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
  Ruler, Banknote, Save, Trash2, History, Weight, Droplets, Info, Construction, Truck
} from "lucide-react";

ChartJS.register(ArcElement, Tooltip, Legend);

// Constantes métier Bureau d'Études TP
const DENSITE_ENROBE = 2.35;    // T/m3 compacté
const RATIO_BITUME_PUR = 0.055; // 5.5% de bitume dans le mélange
const DOSAGE_ACCROCHAGE = 1.0;  // 1kg d'émulsion par m2

export function CoucheRoulForm({ currency = "FCFA", onTotalChange = () => {} }) {
  const {
    localInputs,
    updateInput,
    updateMultipleInputs,
    saveCalculation,
    fetchSavedCalculations,
    savedCalculations,
    loading,
    PROJECT_TYPES,
  } = useCalculation();

  const [message, setMessage] = useState(null);

  // Initialisation des champs
  useEffect(() => {
    if (!localInputs.surface) {
      updateMultipleInputs({
        surface: "",
        epaisseur: "0.05", // 5cm standard
        prixUnitaireTonne: "", // Prix à la Tonne (plus réaliste en TP)
        mainOeuvreM2: "", 
        margePerte: "5"
      });
    }
  }, []);

  // --- MOTEUR DE CALCUL TECHNIQUE ---
  const results = useMemo(() => {
    const surf = parseFloat(localInputs.surface) || 0;
    const ep = parseFloat(localInputs.epaisseur) || 0;
    const puTonne = parseFloat(localInputs.prixUnitaireTonne) || 0;
    const moM2 = parseFloat(localInputs.mainOeuvreM2) || 0;
    const marge = 1 + (parseFloat(localInputs.margePerte) || 0) / 100;

    const volume = surf * ep;
    const tonnageEnrobe = volume * DENSITE_ENROBE * marge;
    
    // Matériaux de spécialité
    const poidsBitumePur = tonnageEnrobe * RATIO_BITUME_PUR;
    const emulsionAccrochageKg = surf * DOSAGE_ACCROCHAGE;

    // Coûts
    const coutMateriaux = tonnageEnrobe * puTonne;
    const coutMainOeuvre = surf * moM2;
    const total = coutMateriaux + coutMainOeuvre;

    return {
      volume,
      tonnageEnrobe,
      poidsBitumePur,
      emulsionAccrochageKg,
      coutMateriaux,
      coutMainOeuvre,
      total
    };
  }, [localInputs]);

  // Sync Parent
  useEffect(() => {
    onTotalChange(results.total);
  }, [results.total, onTotalChange]);

  const handleSave = async () => {
    if (results.tonnageEnrobe <= 0) return showToast("⚠️ Surface ou épaisseur invalide", "error");
    
    await saveCalculation(
      { inputs: localInputs, results },
      PROJECT_TYPES?.TP || 'TP',
      'couche_roulement'
    );
    showToast("✅ Devis enrobé sauvegardé !");
  };

  const showToast = (msg, type = "success") => {
    setMessage({ text: msg, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const chartData = {
    labels: ["Fourniture Enrobé", "Mise en œuvre"],
    datasets: [{
      data: [results.coutMateriaux, results.coutMainOeuvre],
      backgroundColor: ["#f97316", "#374151"], // Orange, Anthracite
      borderColor: "#111827",
      borderWidth: 2,
    }]
  };

  return (
    <div className="w-full h-full flex flex-col bg-gray-900 text-gray-100 overflow-hidden relative font-sans">
      
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
            <p className="text-xs text-gray-400 font-medium">Béton Bitumineux / Revêtement</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-gray-500 uppercase font-bold block tracking-widest">Budget Estimé</span>
          <span className="text-2xl font-black text-orange-400 tracking-tighter">
            {results.total.toLocaleString()} <span className="text-sm font-normal text-gray-500">{currency}</span>
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
                <InputGroup label="Surface (m²)" value={localInputs.surface} onChange={(e) => updateInput('surface', e.target.value)} placeholder="Ex: 1500" />
                <InputGroup label="Épaisseur (m)" value={localInputs.epaisseur} onChange={(e) => updateInput('epaisseur', e.target.value)} placeholder="0.05" />
                <InputGroup label="Pertes (%)" value={localInputs.margePerte} onChange={(e) => updateInput('margePerte', e.target.value)} placeholder="5" full />
              </div>
            </div>

            <div className="bg-gray-800/50 border border-gray-700 rounded-3xl p-6 shadow-xl space-y-6 flex-1">
              <h3 className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
                <Banknote className="w-4 h-4" /> Prix de revient
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label={`Prix Enrobé (${currency}/Tonne)`} value={localInputs.prixUnitaireTonne} onChange={(e) => updateInput('prixUnitaireTonne', e.target.value)} />
                <InputGroup label={`Pose (${currency}/m²)`} value={localInputs.mainOeuvreM2} onChange={(e) => updateInput('mainOeuvreM2', e.target.value)} />
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
              <ResultCard label="Tonnage à Commander" value={results.tonnageEnrobe.toFixed(1)} unit="T" icon={<Weight className="w-4 h-4"/>} color="text-orange-400" bg="bg-orange-500/10" border />
              <ResultCard label="Volume" value={results.volume.toFixed(1)} unit="m³" icon="🧊" color="text-white" bg="bg-gray-800" />
              <ResultCard label="Accrochage" value={results.emulsionAccrochageKg.toFixed(0)} unit="kg" icon={<Droplets className="w-4 h-4"/>} color="text-blue-400" bg="bg-blue-500/10" />
            </div>

            <div className="flex-1 bg-gray-800 rounded-3xl p-8 border border-gray-700 shadow-xl flex flex-col md:flex-row gap-10 items-center relative overflow-hidden">
               <div className="absolute -bottom-10 -right-10 w-44 h-44 bg-orange-600/10 rounded-full blur-3xl pointer-events-none" />

               <div className="w-48 h-48 flex-shrink-0 relative">
                  <Doughnut data={chartData} options={{ cutout: "75%", plugins: { legend: { display: false } } }} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                     <Truck className="w-8 h-8 text-orange-500 mb-1 opacity-50" />
                     <span className="text-sm font-bold text-white">{results.tonnageEnrobe.toFixed(0)} T</span>
                  </div>
               </div>

               <div className="flex-1 w-full space-y-4">
                  <h4 className="text-gray-400 text-xs font-bold uppercase tracking-widest border-b border-gray-700 pb-2 mb-2">Analyse Logistique</h4>
                  
                  <MaterialRow label="Mélange Bitumineux" val={`${results.tonnageEnrobe.toFixed(1)} T`} color="bg-orange-500" />
                  <MaterialRow label="Bitume pur estimé (5.5%)" val={`${results.poidsBitumePur.toFixed(2)} T`} color="bg-black border border-gray-600" />
                  <MaterialRow label="Émulsion d'accrochage" val={`${results.emulsionAccrochageKg.toFixed(0)} kg`} color="bg-blue-500" />
                  
                  <div className="pt-2 border-t border-gray-700 flex justify-between items-center">
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Info className="w-3 h-3 text-orange-400" /> Densité appliquée
                    </span>
                    <span className="text-sm font-bold text-white font-mono">2.35 T/m³</span>
                  </div>

                  <div className="flex items-start gap-2 p-4 bg-blue-500/5 rounded-2xl border border-blue-500/20">
                    <Info className="w-4 h-4 text-blue-400 mt-0.5" />
                    <p className="text-[10px] text-blue-200/70 leading-relaxed italic">
                      Ce calcul inclut la <strong>couche d'accrochage</strong> indispensable pour l'adhérence entre les couches. Le tonnage est calculé après compactage.
                    </p>
                  </div>
               </div>
            </div>

            {/* Historique Mini */}
            {savedCalculations?.length > 0 && (
              <div className="bg-gray-800/30 rounded-2xl border border-gray-700/50 overflow-hidden">
                <div className="px-4 py-2 bg-gray-800/50 border-b border-gray-700/50 flex justify-between items-center text-xs">
                  <h4 className="font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2"><History className="w-3 h-3" /> Derniers Enrobés</h4>
                </div>
                <div className="max-h-[120px] overflow-y-auto">
                  {savedCalculations.slice(0, 5).map((item) => (
                    <div key={item._id || item.id} className="flex justify-between items-center p-3 border-b border-gray-700/30 hover:bg-gray-700/40 transition-colors">
                      <div className="text-xs">
                        <span className="text-gray-500 block text-[9px]">{new Date(item.savedAt).toLocaleDateString()}</span>
                        <span className="font-medium">{item.inputs.surface}m² x {item.inputs.epaisseur}m • {item.results.tonnageEnrobe.toFixed(0)} T</span>
                      </div>
                      <span className="text-sm font-bold text-orange-400">{parseFloat(item.results.total).toLocaleString()} {currency}</span>
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
      type="number" value={value || ""} onChange={onChange}
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