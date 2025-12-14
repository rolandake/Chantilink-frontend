import React, { useState, useEffect, useMemo } from "react";
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { 
  Pickaxe, Ruler, Banknote, Save, Trash2, History, Truck 
} from "lucide-react";

ChartJS.register(ArcElement, Tooltip, Legend);

const STORAGE_KEY = "terrassement-batiment-history";

// Coefficient de foisonnement moyen (terre végétale)
const COEFF_FOISONNEMENT = 1.30; 

export default function Terrassement({ currency = "XOF", onCostChange }) {
  
  // --- ÉTATS ---
  const [inputs, setInputs] = useState({
    longueur: "",
    largeur: "",
    profondeur: "",
    prixExcavation: "", // Prix au m3
    prixEvacuation: "", // Prix au m3 ou au voyage
    capaciteCamion: "16", // m3 par camion (standard)
  });

  const [historique, setHistorique] = useState([]);
  const [message, setMessage] = useState(null);

  // --- MOTEUR DE CALCUL ---
  const results = useMemo(() => {
    const L = parseFloat(inputs.longueur) || 0;
    const l = parseFloat(inputs.largeur) || 0;
    const p = parseFloat(inputs.profondeur) || 0;
    
    // Volumes
    const volEnPlace = L * l * p; // Volume géométrique
    const volFoisonne = volEnPlace * COEFF_FOISONNEMENT; // Volume à transporter

    // Coûts
    const puExcav = parseFloat(inputs.prixExcavation) || 0;
    const puEvac = parseFloat(inputs.prixEvacuation) || 0;
    
    const coutExcavation = volEnPlace * puExcav;
    
    // Calcul évacuation (au volume foisonné)
    const coutEvacuation = volFoisonne * puEvac;

    const total = coutExcavation + coutEvacuation;

    // Logistique
    const capCamion = parseFloat(inputs.capaciteCamion) || 16;
    const nbCamions = Math.ceil(volFoisonne / capCamion);

    return {
      volEnPlace,
      volFoisonne,
      coutExcavation,
      coutEvacuation,
      total,
      nbCamions
    };
  }, [inputs]);

  // --- SYNC PARENT ---
  useEffect(() => {
    if (onCostChange) onCostChange(results.total);
  }, [results.total, onCostChange]);

  // --- HISTORIQUE ---
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setHistorique(JSON.parse(saved));
    } catch {}
  }, []);

  const handleSave = () => {
    if (results.volEnPlace <= 0) return showToast("⚠️ Dimensions nulles", "error");
    
    const newEntry = {
      id: Date.now(),
      date: new Date().toLocaleString(),
      inputs: { ...inputs },
      results: { ...results }
    };

    const newHist = [newEntry, ...historique];
    setHistorique(newHist);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newHist));
    showToast("✅ Terrassement sauvegardé !");
  };

  const clearHistory = () => {
    if (window.confirm("Vider l'historique ?")) {
      setHistorique([]);
      localStorage.removeItem(STORAGE_KEY);
      showToast("Historique vidé");
    }
  };

  // --- HELPERS ---
  const handleChange = (field) => (e) => setInputs(prev => ({ ...prev, [field]: e.target.value }));
  
  const showToast = (msg, type = "success") => {
    setMessage({ text: msg, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const resetFields = () => {
    setInputs({ longueur: "", largeur: "", profondeur: "", prixExcavation: "", prixEvacuation: "", capaciteCamion: "16" });
  };

  // --- CHART DATA ---
  const chartData = {
    labels: ["Excavation (Fouille)", "Évacuation (Transport)"],
    datasets: [{
      data: [results.coutExcavation, results.coutEvacuation],
      backgroundColor: ["#f59e0b", "#78716c"], // Amber, Stone
      borderColor: "#1f2937",
      borderWidth: 4,
    }]
  };

  return (
    <div className="w-full h-full flex flex-col bg-gray-900 text-gray-100 overflow-hidden relative">
      
      {/* Toast */}
      {message && (
        <div className={`fixed top-4 right-4 px-6 py-3 rounded-xl shadow-2xl z-50 font-bold animate-in fade-in slide-in-from-top-2 ${
          message.type === "error" ? "bg-red-600" : "bg-amber-600"
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
            <h2 className="text-xl font-bold text-white">Terrassement</h2>
            <p className="text-xs text-gray-400">Fouille & Évacuation</p>
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg px-4 py-2 border border-gray-700">
          <span className="text-xs text-gray-400 block">Total Estimé</span>
          <span className="text-lg font-black text-amber-400">
            {results.total.toLocaleString(undefined, { maximumFractionDigits: 0 })} <span className="text-sm text-gray-500">{currency}</span>
          </span>
        </div>
      </div>

      {/* Main Grid */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
          
          {/* GAUCHE : SÉLECTION & INPUTS (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            
            {/* 1. Géométrie */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5 shadow-lg">
              <h3 className="flex items-center gap-2 text-sm font-bold text-amber-400 uppercase tracking-wider mb-4">
                <Ruler className="w-4 h-4" /> Dimensions Fouille
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label="Longueur (m)" value={inputs.longueur} onChange={handleChange("longueur")} placeholder="Ex: 20" />
                <InputGroup label="Largeur (m)" value={inputs.largeur} onChange={handleChange("largeur")} placeholder="Ex: 15" />
                <InputGroup label="Profondeur (m)" value={inputs.profondeur} onChange={handleChange("profondeur")} placeholder="Ex: 0.80" full />
              </div>
            </div>

            {/* 2. Coûts & Logistique */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5 shadow-lg flex-1 flex flex-col gap-4">
              <h3 className="flex items-center gap-2 text-sm font-bold text-gray-300 uppercase tracking-wider">
                <Banknote className="w-4 h-4 text-green-400" /> Prix & Transport
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label={`Excavation (${currency}/m³)`} value={inputs.prixExcavation} onChange={handleChange("prixExcavation")} placeholder="Ex: 2500" />
                <InputGroup label={`Évacuation (${currency}/m³)`} value={inputs.prixEvacuation} onChange={handleChange("prixEvacuation")} placeholder="Ex: 3500" />
                <InputGroup label="Capacité Camion (m³)" value={inputs.capaciteCamion} onChange={handleChange("capaciteCamion")} placeholder="16" full />
              </div>

              <div className="flex gap-3 mt-auto pt-6">
                <button 
                  onClick={handleSave}
                  className="flex-1 bg-gradient-to-r from-amber-600 to-orange-600 hover:opacity-90 text-white py-3 rounded-xl font-bold shadow-lg active:scale-95 transition-all flex justify-center items-center gap-2"
                >
                  <Save className="w-5 h-5" /> Calculer
                </button>
                <button 
                  onClick={resetFields} 
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
              <ResultCard label="Volume en place" value={results.volEnPlace.toFixed(1)} unit="m³" icon="🧊" color="text-amber-400" bg="bg-amber-500/10" />
              <ResultCard label="Volume Foisonné" value={results.volFoisonne.toFixed(1)} unit="m³" icon="🌋" color="text-orange-400" bg="bg-orange-500/10" border />
              <ResultCard label="Camions requis" value={results.nbCamions} unit="voyages" icon={<Truck className="w-4 h-4"/>} color="text-stone-400" bg="bg-stone-500/10" />
            </div>

            {/* Graphique & Détails */}
            <div className="flex-1 bg-gray-800 rounded-2xl p-6 border border-gray-700 shadow-xl flex flex-col md:flex-row gap-8 items-center relative overflow-hidden">
               <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />

               <div className="w-40 h-40 flex-shrink-0 relative">
                  <Doughnut data={chartData} options={{ cutout: "75%", plugins: { legend: { display: false } } }} />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                     <span className="text-sm font-bold text-amber-400">Total</span>
                  </div>
               </div>

               <div className="flex-1 w-full space-y-4">
                  <h4 className="text-gray-400 text-sm font-medium border-b border-gray-700 pb-2">Répartition des Coûts</h4>
                  
                  <CostRow 
                    label="Excavation (Fouille)" 
                    value={results.coutExcavation} 
                    currency={currency} 
                    color="bg-amber-500" 
                  />
                  <CostRow 
                    label="Évacuation (Déblais)" 
                    value={results.coutEvacuation} 
                    currency={currency} 
                    color="bg-stone-500" 
                  />
                  
                  <div className="pt-2 border-t border-gray-700 flex justify-between items-center mt-2">
                    <span className="text-xs text-gray-400">
                      *Foisonnement estimé à 30%
                    </span>
                  </div>
               </div>
            </div>

            {/* Historique */}
            {historique.length > 0 && (
              <div className="bg-gray-800/30 rounded-2xl border border-gray-700/50 overflow-hidden flex-1 min-h-[150px]">
                <div className="px-4 py-2 bg-gray-800/50 border-b border-gray-700/50 flex justify-between items-center">
                  <h4 className="text-xs font-bold text-gray-400 flex items-center gap-2">
                    <History className="w-3 h-3" /> Derniers ajouts
                  </h4>
                  <button onClick={clearHistory} className="text-[10px] text-red-400 hover:underline">
                    Vider
                  </button>
                </div>
                <div className="overflow-y-auto max-h-[180px] p-2 space-y-2">
                  {historique.map((item) => (
                    <div key={item.id} className="flex justify-between items-center bg-gray-700/30 p-2 rounded hover:bg-gray-700/50 transition border border-transparent hover:border-amber-500/30">
                      <div className="flex flex-col">
                         <span className="text-[10px] text-gray-500">{item.date.split(',')[0]}</span>
                         <span className="text-xs text-gray-300">Vol: {item.results.volEnPlace.toFixed(1)} m³</span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-bold text-amber-400">{item.results.total.toLocaleString()} {currency}</span>
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

const InputGroup = ({ label, value, onChange, placeholder, full = false, type = "number" }) => (
  <div className={`flex flex-col ${full ? "col-span-2" : ""}`}>
    <label className="mb-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-wide">
      {label}
    </label>
    <input
      type={type}
      min="0"
      step="any"
      value={value}
      onChange={onChange}
      className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all font-mono text-sm"
      placeholder={placeholder || "0"}
    />
  </div>
);

const ResultCard = ({ label, value, unit, color, bg, border, icon }) => (
  <div className={`rounded-xl p-3 flex flex-col justify-center items-center text-center ${bg} ${border ? 'border border-gray-600' : ''}`}>
    <span className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 flex items-center gap-1">
      {typeof icon === 'string' ? icon : <span className="opacity-70">{icon}</span>} {label}
    </span>
    <span className={`text-xl font-black ${color}`}>
      {value} <span className="text-xs font-normal text-gray-500">{unit}</span>
    </span>
  </div>
);

const CostRow = ({ label, value, currency, color, bold = false }) => (
  <div className="flex justify-between items-center border-b border-gray-700/50 pb-2 last:border-0 group">
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${color}`} />
      <span className="text-gray-300 text-sm font-medium">{label}</span>
    </div>
    <span className={`font-mono text-white ${bold ? 'font-black text-lg' : 'font-bold'}`}>
      {value.toLocaleString(undefined, { maximumFractionDigits: 0 })} {currency}
    </span>
  </div>
);