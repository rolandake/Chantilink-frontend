import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { 
  Layers, Ruler, Banknote, Save, Trash2, History, Truck
} from "lucide-react";

ChartJS.register(ArcElement, Tooltip, Legend);

const STORAGE_KEY = "chaussee-history";

// Densités moyennes (T/m3) pour conversion Volume -> Poids
const DENSITIES = {
  fondation: 2.0, // GNT
  base: 2.35,     // Grave Bitume
  roulement: 2.35 // Béton Bitumineux
};

export default function Chaussee({ currency = "XOF", onCostChange, onMateriauxChange }) {
  
  // --- ÉTATS ---
  const [inputs, setInputs] = useState({
    longueur: "",
    largeur: "",
    
    // Épaisseurs (en cm)
    epaisseurFondation: "", 
    epaisseurBase: "",
    epaisseurRoulement: "",

    // Prix Unitaires (souvent à la tonne)
    prixFondation: "",  
    prixBase: "",       
    prixRoulement: "",  
    
    coutMainOeuvre: ""  
  });

  const [historique, setHistorique] = useState([]);
  const [message, setMessage] = useState(null);

  // --- MOTEUR DE CALCUL (Mémorisé) ---
  const results = useMemo(() => {
    const L = parseFloat(inputs.longueur) || 0;
    const l = parseFloat(inputs.largeur) || 0;
    const surface = L * l;

    // Conversion cm -> m
    const eFond = (parseFloat(inputs.epaisseurFondation) || 0) / 100;
    const eBase = (parseFloat(inputs.epaisseurBase) || 0) / 100;
    const eRoul = (parseFloat(inputs.epaisseurRoulement) || 0) / 100;

    // Volumes (m3)
    const volFond = surface * eFond;
    const volBase = surface * eBase;
    const volRoul = surface * eRoul;

    // Tonnages (T) = Volume * Densité
    const tonFond = volFond * DENSITIES.fondation;
    const tonBase = volBase * DENSITIES.base;
    const tonRoul = volRoul * DENSITIES.roulement;

    // Coûts
    const coutFond = tonFond * (parseFloat(inputs.prixFondation) || 0);
    const coutBase = tonBase * (parseFloat(inputs.prixBase) || 0);
    const coutRoul = tonRoul * (parseFloat(inputs.prixRoulement) || 0);
    const coutMO = parseFloat(inputs.coutMainOeuvre) || 0;

    const total = coutFond + coutBase + coutRoul + coutMO;

    return {
      surface,
      volFond, volBase, volRoul,
      tonFond, tonBase, tonRoul,
      coutFond, coutBase, coutRoul, coutMO,
      total
    };
  }, [inputs]);

  // --- SYNC PARENT (Anti-Loop) ---
  useEffect(() => {
    if (onCostChange) onCostChange(results.total);
    
    if (onMateriauxChange) {
      onMateriauxChange({
        surface: results.surface,
        tonnageTotal: results.tonFond + results.tonBase + results.tonRoul,
        volumeTotal: results.volFond + results.volBase + results.volRoul
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results.total, results.tonRoul]); // Dépendances stables uniquement

  // --- HISTORIQUE ---
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setHistorique(JSON.parse(saved));
    } catch {}
  }, []);

  // --- HANDLERS ---
  const handleChange = (field) => (e) => setInputs(prev => ({ ...prev, [field]: e.target.value }));
  
  const showToast = (msg, type = "success") => {
    setMessage({ text: msg, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleSave = () => {
    if (results.total <= 0) return showToast("⚠️ Données incomplètes", "error");
    
    const newEntry = {
      id: Date.now(),
      date: new Date().toLocaleString(),
      inputs: { ...inputs },
      results: { ...results }
    };

    const newHist = [newEntry, ...historique];
    setHistorique(newHist);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newHist));
    showToast("✅ Chaussée sauvegardée !");
  };

  const clearHistory = () => {
    if (window.confirm("Vider l'historique ?")) {
      setHistorique([]);
      localStorage.removeItem(STORAGE_KEY);
      showToast("Historique vidé");
    }
  };

  const resetFields = () => {
    setInputs(Object.fromEntries(Object.keys(inputs).map(k => [k, ""])));
  };

  // --- DATA CHART ---
  const chartData = {
    labels: ["Fondation (GNT)", "Base (GB)", "Roulement (BB)", "Main d'œuvre"],
    datasets: [{
      data: [results.coutFond, results.coutBase, results.coutRoul, results.coutMO],
      backgroundColor: ["#fbbf24", "#f97316", "#a855f7", "#3b82f6"], // Amber, Orange, Purple, Blue
      borderColor: "#1f2937",
      borderWidth: 4,
    }]
  };

  return (
    <div className="w-full h-full flex flex-col bg-gray-900 text-gray-100 overflow-hidden relative">
      
      {/* Toast */}
      {message && (
        <div className={`fixed top-4 right-4 px-6 py-3 rounded-xl shadow-2xl z-50 font-bold animate-in fade-in slide-in-from-top-2 ${
          message.type === "error" ? "bg-red-600" : "bg-purple-600"
        }`}>
          {message.text}
        </div>
      )}

      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-500/20 rounded-lg text-purple-500">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Chaussée</h2>
            <p className="text-xs text-gray-400">Structure & Revêtement</p>
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg px-4 py-2 border border-gray-700">
          <span className="text-xs text-gray-400 block">Total Estimé</span>
          <span className="text-lg font-black text-purple-400">
            {results.total.toLocaleString(undefined, { maximumFractionDigits: 0 })} <span className="text-sm text-gray-500">{currency}</span>
          </span>
        </div>
      </div>

      {/* Main Grid */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
          
          {/* GAUCHE : SAISIE (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            
            {/* 1. Géométrie */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5 shadow-lg">
              <h3 className="flex items-center gap-2 text-sm font-bold text-purple-400 uppercase tracking-wider mb-4">
                <Ruler className="w-4 h-4" /> Géométrie
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label="Longueur (m)" value={inputs.longueur} onChange={handleChange("longueur")} placeholder="Ex: 1000" />
                <InputGroup label="Largeur (m)" value={inputs.largeur} onChange={handleChange("largeur")} placeholder="Ex: 7" />
              </div>
            </div>

            {/* 2. Structure & Prix */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5 shadow-lg flex-1 flex flex-col gap-4">
              <h3 className="flex items-center gap-2 text-sm font-bold text-gray-300 uppercase tracking-wider">
                <Layers className="w-4 h-4 text-orange-400" /> Structure ({currency}/T)
              </h3>
              
              {/* Couche Roulement */}
              <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-xl space-y-2">
                <span className="text-xs font-bold text-purple-300 uppercase">1. Roulement (BB)</span>
                <div className="grid grid-cols-2 gap-3">
                   <InputGroup label="Épaisseur (cm)" value={inputs.epaisseurRoulement} onChange={handleChange("epaisseurRoulement")} placeholder="Ex: 5" />
                   <InputGroup label="Prix/Tonne" value={inputs.prixRoulement} onChange={handleChange("prixRoulement")} placeholder="Ex: 85000" />
                </div>
              </div>

              {/* Couche Base */}
              <div className="p-3 bg-orange-500/10 border border-orange-500/30 rounded-xl space-y-2">
                <span className="text-xs font-bold text-orange-300 uppercase">2. Base (GB)</span>
                <div className="grid grid-cols-2 gap-3">
                   <InputGroup label="Épaisseur (cm)" value={inputs.epaisseurBase} onChange={handleChange("epaisseurBase")} placeholder="Ex: 10" />
                   <InputGroup label="Prix/Tonne" value={inputs.prixBase} onChange={handleChange("prixBase")} placeholder="Ex: 60000" />
                </div>
              </div>

              {/* Couche Fondation */}
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl space-y-2">
                <span className="text-xs font-bold text-yellow-300 uppercase">3. Fondation (GNT)</span>
                <div className="grid grid-cols-2 gap-3">
                   <InputGroup label="Épaisseur (cm)" value={inputs.epaisseurFondation} onChange={handleChange("epaisseurFondation")} placeholder="Ex: 20" />
                   <InputGroup label="Prix/Tonne" value={inputs.prixFondation} onChange={handleChange("prixFondation")} placeholder="Ex: 25000" />
                </div>
              </div>

              <div className="h-px bg-gray-700/50 my-2" />
              
              <InputGroup label={`Main d'œuvre Globale (${currency})`} value={inputs.coutMainOeuvre} onChange={handleChange("coutMainOeuvre")} full />

              <div className="flex gap-3 mt-auto pt-4">
                <button 
                  onClick={handleSave}
                  className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-90 text-white py-3 rounded-xl font-bold shadow-lg active:scale-95 transition-all flex justify-center items-center gap-2"
                >
                  <Save className="w-5 h-5" /> Calculer
                </button>
                <button 
                  onClick={resetFields} 
                  className="px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-xl transition-colors"
                  title="Réinitialiser"
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
              <ResultCard label="Surface Totale" value={results.surface.toFixed(0)} unit="m²" icon="📐" color="text-purple-400" bg="bg-purple-500/10" />
              <ResultCard label="Tonnage Total" value={(results.tonFond + results.tonBase + results.tonRoul).toFixed(1)} unit="T" icon="⚖️" color="text-orange-400" bg="bg-orange-500/10" border />
              <ResultCard label="Volume Total" value={(results.volFond + results.volBase + results.volRoul).toFixed(1)} unit="m³" icon="🧊" color="text-blue-400" bg="bg-blue-500/10" />
            </div>

            {/* Graphique & Détails */}
            <div className="flex-1 bg-gray-800 rounded-2xl p-6 border border-gray-700 shadow-xl flex flex-col md:flex-row gap-8 items-center relative overflow-hidden">
               <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

               <div className="w-40 h-40 flex-shrink-0 relative">
                  <Doughnut data={chartData} options={{ cutout: "75%", plugins: { legend: { display: false } } }} />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                     <Truck className="w-8 h-8 text-purple-500 opacity-50" />
                  </div>
               </div>

               <div className="flex-1 w-full space-y-3">
                  <h4 className="text-gray-400 text-sm font-medium border-b border-gray-700 pb-2">Détail par couche</h4>
                  
                  <LayerRow label="Roulement (BB)" thick={inputs.epaisseurRoulement} ton={results.tonRoul} cost={results.coutRoul} color="bg-purple-500" currency={currency} />
                  <LayerRow label="Base (GB)" thick={inputs.epaisseurBase} ton={results.tonBase} cost={results.coutBase} color="bg-orange-500" currency={currency} />
                  <LayerRow label="Fondation (GNT)" thick={inputs.epaisseurFondation} ton={results.tonFond} cost={results.coutFond} color="bg-yellow-500" currency={currency} />
                  
                  <div className="pt-2 border-t border-gray-700 flex justify-between items-center mt-2">
                    <span className="text-sm text-gray-400">Main d'œuvre</span>
                    <span className="font-bold text-white">{results.coutMO.toLocaleString()} {currency}</span>
                  </div>
               </div>
            </div>

            {/* Historique */}
            {historique.length > 0 && (
              <div className="bg-gray-800/30 rounded-2xl border border-gray-700/50 overflow-hidden flex-1 min-h-[150px]">
                <div className="px-4 py-2 bg-gray-800/50 border-b border-gray-700/50 flex justify-between items-center">
                  <h4 className="text-xs font-bold text-gray-400 flex items-center gap-2">
                    <History className="w-3 h-3" /> Historique récent
                  </h4>
                  <button onClick={clearHistory} className="text-[10px] text-red-400 hover:underline">Vider</button>
                </div>
                <div className="overflow-y-auto max-h-[180px] p-2 space-y-2">
                  {historique.map((item) => (
                    <div key={item.id} className="flex justify-between items-center bg-gray-700/30 p-2 rounded hover:bg-gray-700/50 transition border border-transparent hover:border-purple-500/30">
                      <div className="flex flex-col">
                         <span className="text-[10px] text-gray-500">{item.date.split(',')[0]}</span>
                         <span className="text-xs text-gray-300 font-bold">L={item.inputs.longueur}m x l={item.inputs.largeur}m</span>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-gray-400">Surf: {item.results.surface} m²</div>
                        <div className="text-sm font-bold text-purple-400">{item.results.total.toLocaleString()} {currency}</div>
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
    <label className="mb-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-wide">{label}</label>
    <input
      type={type}
      min="0"
      step="any"
      value={value}
      onChange={onChange}
      className="w-full bg-gray-900 border border-gray-600 rounded-lg px-2 py-2 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all font-mono text-sm"
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

const LayerRow = ({ label, thick, ton, cost, color, currency }) => (
  <div className="flex justify-between items-center border-b border-gray-700/50 pb-2 last:border-0 group">
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${color}`} />
      <div className="flex flex-col">
        <span className="text-gray-300 text-sm font-medium">{label}</span>
        <span className="text-[10px] text-gray-500">Ep: {thick || 0}cm • {ton.toFixed(1)} T</span>
      </div>
    </div>
    <div className="text-sm font-bold text-white font-mono group-hover:text-purple-300 transition-colors">
      {cost.toLocaleString(undefined, { maximumFractionDigits: 0 })} {currency}
    </div>
  </div>
);