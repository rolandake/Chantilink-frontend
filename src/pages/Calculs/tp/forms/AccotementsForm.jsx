import React, { useEffect, useState, useMemo } from "react";
import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { useCalculator } from "../../../../shared/hooks/useCalculator.js";
import { AccotementsCalculator } from "@/domains/tp/calculators/AccotementsCalculator.js";
import { 
  Waypoints, Ruler, Banknote, Save, Trash2, History, Scale 
} from "lucide-react";

ChartJS.register(ArcElement, Tooltip, Legend);

export default function AccotementsForm({ currency = "FCFA", onCostChange, onMateriauxChange }) {
  const {
    inputs,
    results,
    updateInput,
    history,
    saveToHistory,
    deleteFromHistory,
    clearHistory,
  } = useCalculator(AccotementsCalculator, "accotements", "tp");

  const [message, setMessage] = useState(null);

  // --- SYNC PARENT (Anti-Loop) ---
  const total = results?.total ?? 0;
  const cimentT = results?.cimentT ?? 0;
  const sableT = results?.sableT ?? 0;
  const gravierT = results?.gravierT ?? 0;
  const eauL = results?.eauL ?? 0;

  useEffect(() => {
    if (onCostChange) onCostChange(total);
    if (onMateriauxChange) {
      onMateriauxChange({ cimentT, sableT, gravierT, eauL });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total, cimentT, sableT, gravierT, eauL]);

  // --- ACTIONS ---
  const handleChange = (field) => (e) => updateInput(field, parseFloat(e.target.value) || 0);

  const showToast = (msg, type = "success") => {
    setMessage({ text: msg, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleSave = () => {
    if (!results || !results.volume) return showToast("⚠️ Dimensions invalides", "error");
    if (saveToHistory()) showToast("✅ Accotements sauvegardés !");
    else showToast("❌ Erreur sauvegarde", "error");
  };

  const handleReset = () => {
    // On peut imaginer une fonction reset dans le hook useCalculator, sinon on set manuellement
    ["longueur", "largeur", "epaisseur", "prixUnitaire", "coutMainOeuvre"].forEach(f => updateInput(f, ""));
  };

  // --- GRAPHIQUE ---
  const chartData = {
    labels: ["Ciment", "Sable", "Gravier", "Eau"],
    datasets: [{
      data: [cimentT, sableT, gravierT, eauL / 1000], // Eau en m3 pour l'échelle
      backgroundColor: ["#ec4899", "#fbbf24", "#78716c", "#3b82f6"], // Pink, Amber, Stone, Blue
      borderColor: "#1f2937",
      borderWidth: 4,
    }]
  };

  return (
    <div className="w-full h-full flex flex-col bg-gray-900 text-gray-100 overflow-hidden relative">
      
      {/* Toast */}
      {message && (
        <div className={`fixed top-4 right-4 px-6 py-3 rounded-xl shadow-2xl z-50 font-bold animate-in fade-in slide-in-from-top-2 ${
          message.type === "error" ? "bg-red-600" : "bg-pink-600"
        }`}>
          {message.text}
        </div>
      )}

      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-pink-500/20 rounded-lg text-pink-500">
            <Waypoints className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Accotements</h2>
            <p className="text-xs text-gray-400">Bétonnage & Stabilisation</p>
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg px-4 py-2 border border-gray-700">
          <span className="text-xs text-gray-400 block">Total Estimé</span>
          <span className="text-lg font-black text-pink-400">
            {total.toLocaleString(undefined, { maximumFractionDigits: 0 })} <span className="text-sm text-gray-500">{currency}</span>
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
              <h3 className="flex items-center gap-2 text-sm font-bold text-pink-400 uppercase tracking-wider mb-4">
                <Ruler className="w-4 h-4" /> Géométrie
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <InputGroup 
                  label="Longueur (m)" 
                  value={inputs.longueur} 
                  onChange={handleChange("longueur")} 
                  placeholder="Ex: 100"
                />
                <InputGroup 
                  label="Largeur (m)" 
                  value={inputs.largeur} 
                  onChange={handleChange("largeur")} 
                  placeholder="Ex: 1.5"
                />
                <InputGroup 
                  label="Épaisseur (m)" 
                  value={inputs.epaisseur} 
                  onChange={handleChange("epaisseur")} 
                  placeholder="Ex: 0.15"
                  full
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
                  label={`Prix Béton (${currency}/m³)`} 
                  value={inputs.prixUnitaire} 
                  onChange={handleChange("prixUnitaire")} 
                  placeholder="Ex: 65000"
                />
                <InputGroup 
                  label={`Main d'œuvre (${currency})`} 
                  value={inputs.coutMainOeuvre} 
                  onChange={handleChange("coutMainOeuvre")} 
                  placeholder="Ex: 45000"
                />
              </div>

              <div className="mt-auto pt-6 flex gap-3">
                <button 
                  onClick={handleSave}
                  className="flex-1 bg-gradient-to-r from-pink-600 to-rose-600 hover:opacity-90 text-white py-3 rounded-xl font-bold shadow-lg active:scale-95 transition-all flex justify-center items-center gap-2"
                >
                  <Save className="w-5 h-5" /> Sauvegarder
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
              <ResultCard label="Volume Béton" value={results?.volume?.toFixed(2)} unit="m³" icon={<Scale className="w-4 h-4"/>} color="text-pink-400" bg="bg-pink-500/10" />
              <ResultCard label="Ciment Total" value={cimentT.toFixed(1)} unit="t" icon="🧱" color="text-gray-300" bg="bg-gray-700/50" border />
              <ResultCard label="Eau Gâchage" value={eauL.toFixed(0)} unit="L" icon="💧" color="text-blue-400" bg="bg-blue-500/10" />
            </div>

            {/* Graphique & Détails */}
            <div className="flex-1 bg-gray-800 rounded-2xl p-6 border border-gray-700 shadow-xl flex flex-col md:flex-row gap-8 items-center relative overflow-hidden">
               <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-pink-600/10 rounded-full blur-3xl pointer-events-none" />

               <div className="w-40 h-40 flex-shrink-0 relative">
                  <Doughnut data={chartData} options={{ cutout: "70%", plugins: { legend: { display: false } } }} />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                     <span className="text-sm font-bold text-pink-400">{results?.volume?.toFixed(1)} m³</span>
                  </div>
               </div>

               <div className="flex-1 w-full space-y-3">
                  <h4 className="text-gray-400 text-sm font-medium border-b border-gray-700 pb-2">Dosage Matériaux (Standard)</h4>
                  <MaterialRow label="Ciment" valPoids={`${cimentT.toFixed(2)} t`} color="bg-pink-500" />
                  <MaterialRow label="Sable" valPoids={`${sableT.toFixed(2)} t`} color="bg-amber-500" />
                  <MaterialRow label="Gravier" valPoids={`${gravierT.toFixed(2)} t`} color="bg-stone-500" />
                  <div className="pt-2 border-t border-gray-700 flex justify-between items-center mt-2">
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-blue-500"></div> Eau
                    </span>
                    <span className="text-sm font-bold text-white">{eauL.toFixed(0)} L</span>
                  </div>
               </div>
            </div>

            {/* Historique */}
            {history.length > 0 && (
              <div className="bg-gray-800/30 rounded-2xl border border-gray-700/50 overflow-hidden flex-1 min-h-[150px]">
                <div className="px-4 py-2 bg-gray-800/50 border-b border-gray-700/50 flex justify-between items-center">
                  <h4 className="text-xs font-bold text-gray-400 flex items-center gap-2">
                    <History className="w-3 h-3" /> Historique ({history.length})
                  </h4>
                  <button onClick={clearHistory} className="text-[10px] text-red-400 hover:underline">Vider</button>
                </div>
                <div className="overflow-y-auto max-h-[180px] p-2 space-y-2">
                  {history.map((item) => (
                    <div key={item.id} className="flex justify-between items-center bg-gray-700/30 p-2 rounded hover:bg-gray-700/50 transition border border-transparent hover:border-pink-500/30">
                      <div className="flex flex-col">
                         <span className="text-[10px] text-gray-500">{item.date.split(',')[0]}</span>
                         <span className="text-xs text-gray-300">Vol: {item.results.volume?.toFixed(1)} m³</span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-bold text-pink-400">{item.results.total?.toLocaleString()} {currency}</span>
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
      className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition-all font-mono text-sm"
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