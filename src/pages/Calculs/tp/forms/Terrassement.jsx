import React, { useEffect, useState, useMemo } from "react";
import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { 
  Pickaxe, Truck, Ruler, Save, Trash2, History, Info, Mountain, Banknote, Navigation
} from "lucide-react";
import { useCalculator } from "../../../../shared/hooks/useCalculator.js";
import { TerrassementCalculator } from "@/domains/tp/calculators/TerrassementCalculator.js";

ChartJS.register(ArcElement, Tooltip, Legend);

// Table des coefficients de foisonnement pro (Bureau d'Études TP)
const NATURE_SOL = {
  SABLE: { label: "Sable / Gravier", coeff: 1.15, icon: "⏳" },
  TERRE: { label: "Terre Végétale", coeff: 1.25, icon: "🌱" },
  ARGILE: { label: "Argile / Limon", coeff: 1.35, icon: "🧱" },
  ROCHE: { label: "Roche / Remblai", coeff: 1.50, icon: "🪨" },
};

export default function Terrassement({ currency = "XOF", onCostChange, onMateriauxChange }) {
  const {
    inputs,
    results,
    updateInput,
    history,
    saveToHistory,
    deleteFromHistory,
    clearHistory,
  } = useCalculator(TerrassementCalculator, "terrassement", "tp");

  const [message, setMessage] = useState("");
  const [selectedSol, setSelectedSol] = useState("TERRE");

  // Synchronisation du coefficient de foisonnement selon le sol choisi
  useEffect(() => {
    updateInput("foisonnement", (NATURE_SOL[selectedSol].coeff - 1) * 100);
  }, [selectedSol]);

  const total = results?.total ?? 0;
  const volumeExcave = results?.volumeExcave ?? 0;
  const volumeFoisonne = results?.volumeFoisonne ?? 0;
  const nombreCamions = results?.nombreCamions ?? 0;
  const coutExcavation = results?.coutTotalExcavation ?? 0;
  const coutEvacuation = results?.coutTotalEvacuation ?? 0;

  useEffect(() => {
    if (onCostChange) onCostChange(total);
    if (onMateriauxChange) {
      onMateriauxChange({
        volumeExcave,
        volumeFoisonne,
        camions: nombreCamions
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total, volumeExcave, volumeFoisonne, nombreCamions]);

  const handleChange = (field) => (e) => updateInput(field, parseFloat(e.target.value) || 0);

  const showMessage = (msg, type = "success") => {
    setMessage({ text: msg, type });
    setTimeout(() => setMessage(""), 3000);
  };

  const handleSave = () => {
    if (!results || !results.volumeExcave) return showMessage("⚠️ Dimensions invalides", "error");
    if (saveToHistory()) showMessage("✅ Calcul sauvegardé !", "success");
  };

  const chartData = {
    labels: ["Excavation (Extraction)", "Évacuation (Transport)"],
    datasets: [{
      data: [coutExcavation, coutEvacuation],
      backgroundColor: ["#EAB308", "#F97316"],
      borderColor: "#111827",
      borderWidth: 2,
    }]
  };

  return (
    <div className="w-full h-full flex flex-col bg-gray-900 text-gray-100 overflow-hidden relative">
      
      {message && (
        <div className={`fixed top-4 right-4 px-6 py-3 rounded-xl shadow-2xl z-50 font-bold animate-in fade-in slide-in-from-top-2 ${
          message.type === "error" ? "bg-red-600" : "bg-amber-500"
        }`}>
          {message.text}
        </div>
      )}

      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/20 rounded-lg text-amber-500">
            <Pickaxe className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white uppercase tracking-tight">Terrassement</h2>
            <p className="text-xs text-gray-400 font-medium">Préparation & Mouvement de terre</p>
          </div>
        </div>
        <div className="bg-gray-800 rounded-xl px-4 py-2 border border-gray-700">
          <span className="text-[10px] text-gray-500 uppercase font-bold block">Budget Estimé</span>
          <span className="text-xl font-black text-amber-400">
            {total.toLocaleString()} <span className="text-sm font-normal text-gray-500">{currency}</span>
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-6 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
          
          {/* GAUCHE : PARAMÈTRES */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            
            {/* 1. Nature du sol */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5">
              <h3 className="flex items-center gap-2 text-xs font-bold text-amber-500 uppercase tracking-widest mb-4">
                <Mountain className="w-4 h-4" /> Nature du Terrain
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(NATURE_SOL).map(([key, sol]) => (
                  <button
                    key={key}
                    onClick={() => setSelectedSol(key)}
                    className={`p-3 rounded-xl border transition-all text-left flex flex-col ${
                      selectedSol === key 
                      ? "border-amber-500 bg-amber-500/10 shadow-lg shadow-amber-900/10" 
                      : "border-gray-700 bg-gray-800 hover:border-gray-500"
                    }`}
                  >
                    <span className="text-lg">{sol.icon}</span>
                    <span className={`text-[10px] font-bold uppercase ${selectedSol === key ? "text-amber-400" : "text-gray-500"}`}>
                      {sol.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Géométrie */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5 shadow-lg">
              <h3 className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
                <Ruler className="w-4 h-4" /> Cubature Géométrique
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label="Longueur (m)" name="longueur" value={inputs.longueur} onChange={handleChange} />
                <InputGroup label="Largeur (m)" name="largeur" value={inputs.largeur} onChange={handleChange} />
                <InputGroup label="Profondeur (m)" name="profondeur" value={inputs.profondeur} onChange={handleChange} full />
              </div>
            </div>

            {/* 3. Coûts & Logistique */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5 shadow-lg space-y-5">
              <h3 className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
                <Banknote className="w-4 h-4" /> Prix Unitaires & Transport
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label={`Extraction (${currency}/m³)`} name="prixExcavation" value={inputs.prixExcavation} onChange={handleChange} />
                <InputGroup label={`Transport (${currency}/voyage)`} name="prixEvacuation" value={inputs.prixEvacuation} onChange={handleChange} />
                <InputGroup label="Capacité Camion (m³)" name="capaciteCamion" value={inputs.capaciteCamion} onChange={handleChange} full />
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  onClick={handleSave}
                  className="flex-1 bg-amber-600 hover:bg-amber-500 text-white py-4 rounded-xl font-bold shadow-lg transition-all flex justify-center items-center gap-2 active:scale-95"
                >
                  <Save className="w-5 h-5" /> Enregistrer
                </button>
                <button 
                  onClick={() => updateInput('longueur', 0)} 
                  className="px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-xl transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* DROITE : TABLEAU DE BORD */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            
            {/* KPIs */}
            <div className="grid grid-cols-3 gap-4">
              <ResultCard label="Volume Brut" value={volumeExcave.toFixed(1)} unit="m³" color="text-amber-400" bg="bg-amber-500/10" />
              <ResultCard label="Volume Foisonné" value={volumeFoisonne.toFixed(1)} unit="m³" color="text-orange-400" bg="bg-orange-500/10" border />
              <ResultCard label="Nb Camions" value={Math.ceil(nombreCamions)} unit="voyages" color="text-stone-300" bg="bg-stone-500/10" />
            </div>

            {/* Graphique et Analyse */}
            <div className="flex-1 bg-gray-800 rounded-3xl p-8 border border-gray-700 shadow-xl flex flex-col md:flex-row gap-10 items-center relative overflow-hidden">
               <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />

               <div className="w-44 h-44 flex-shrink-0 relative">
                  <Doughnut data={chartData} options={{ cutout: "75%", plugins: { legend: { display: false } } }} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                     <span className="text-[10px] text-gray-500 uppercase font-bold">Total</span>
                     <span className="text-sm font-bold text-white">{total.toLocaleString()}</span>
                  </div>
               </div>

               <div className="flex-1 w-full space-y-5">
                  <h4 className="text-gray-400 text-xs font-bold uppercase tracking-widest border-b border-gray-700 pb-2">Répartition du Poste</h4>
                  
                  <MaterialRow label="Excavation (Extraction)" val={`${coutExcavation.toLocaleString()} ${currency}`} color="bg-yellow-500" />
                  <MaterialRow label="Évacuation (Mise en décharge)" val={`${coutEvacuation.toLocaleString()} ${currency}`} color="bg-orange-500" />
                  
                  <div className="flex items-start gap-2 p-4 bg-blue-500/5 rounded-2xl border border-blue-500/20 mt-4">
                    <Info className="w-4 h-4 text-blue-400 mt-0.5" />
                    <p className="text-[11px] text-blue-200/70 leading-relaxed italic">
                      Le sol de type <strong>{NATURE_SOL[selectedSol].label}</strong> entraîne un foisonnement de <strong>{Math.round((NATURE_SOL[selectedSol].coeff - 1) * 100)}%</strong>. 
                      C'est ce volume augmenté qui définit le nombre de rotations de camions.
                    </p>
                  </div>
               </div>
            </div>

            {/* Historique */}
            {history.length > 0 && (
              <div className="bg-gray-800/30 rounded-2xl border border-gray-700/50 overflow-hidden flex-1">
                <div className="px-4 py-3 bg-gray-800/50 border-b border-gray-700/50 flex justify-between items-center">
                  <h4 className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2"><History className="w-3 h-3" /> Historique de terrassement</h4>
                  <button onClick={clearHistory} className="text-[10px] text-red-400 hover:underline uppercase">Vider</button>
                </div>
                <div className="overflow-y-auto max-h-[160px]">
                  {history.map((item) => (
                    <div key={item.id} className="flex justify-between items-center p-3 border-b border-gray-700/30 hover:bg-gray-700/40 group">
                      <div className="flex flex-col">
                         <span className="text-[10px] text-gray-500">{item.date.split(',')[0]}</span>
                         <span className="text-xs font-medium">{item.results.volumeExcave.toFixed(1)} m³ - {item.results.nombreCamions} voyages</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm font-bold text-amber-400">{item.results.total.toLocaleString()} {currency}</span>
                        <button onClick={() => deleteFromHistory(item.id)} className="text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Trash2 className="w-4 h-4" />
                        </button>
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

const InputGroup = ({ label, name, value, onChange, full = false }) => (
  <div className={`flex flex-col ${full ? "col-span-2" : ""}`}>
    <label className="mb-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-wide">{label}</label>
    <input
      type="number"
      value={value || ""}
      onChange={onChange(name)}
      className="w-full bg-gray-900 border border-gray-600 rounded-xl px-4 py-3 text-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all font-mono text-sm"
      placeholder="0"
    />
  </div>
);

const ResultCard = ({ label, value, unit, color, bg, border }) => (
  <div className={`rounded-2xl p-4 flex flex-col justify-center items-center text-center ${bg} ${border ? 'border border-gray-700' : ''}`}>
    <span className="text-[10px] text-gray-500 uppercase font-bold mb-1">{label}</span>
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