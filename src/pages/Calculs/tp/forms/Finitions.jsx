import React, { useState, useEffect, useMemo } from "react";
import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { 
  PaintRoller, Grid3X3, Hammer, Layers, Palette, Component,
  Save, Trash2, History, Ruler, Banknote
} from "lucide-react";

ChartJS.register(ArcElement, Tooltip, Legend);

const STORAGE_KEY = "finitions-history";

// Types de finitions avec configuration visuelle
const FINITION_TYPES = [
  { id: "peinture", label: "Peinture", icon: <PaintRoller className="w-5 h-5"/>, color: "violet", unit: "m²", bg: "bg-violet-500/10", text: "text-violet-400" },
  { id: "carrelage", label: "Carrelage", icon: <Grid3X3 className="w-5 h-5"/>, color: "emerald", unit: "m²", bg: "bg-emerald-500/10", text: "text-emerald-400" },
  { id: "parquet", label: "Parquet", icon: <Component className="w-5 h-5"/>, color: "amber", unit: "m²", bg: "bg-amber-500/10", text: "text-amber-400" },
  { id: "platre", label: "Plâtre/Enduit", icon: <Layers className="w-5 h-5"/>, color: "gray", unit: "m²", bg: "bg-gray-500/10", text: "text-gray-400" },
  { id: "faience", label: "Faïence", icon: <Palette className="w-5 h-5"/>, color: "cyan", unit: "m²", bg: "bg-cyan-500/10", text: "text-cyan-400" },
  { id: "autre", label: "Autre", icon: <Hammer className="w-5 h-5"/>, color: "rose", unit: "u", bg: "bg-rose-500/10", text: "text-rose-400" },
];

export default function Finitions({ currency = "XOF", onCostChange }) {
  
  // === ÉTATS ===
  const [selectedType, setSelectedType] = useState("peinture");
  
  const [inputs, setInputs] = useState({
    surface: "",        // Ou quantité pour "Autre"
    prixMateriel: "",   // Prix unitaire matériaux
    prixMainOeuvre: "", // Prix unitaire pose
    couches: "2",       // Spécifique peinture
  });

  const [historique, setHistorique] = useState([]);
  const [message, setMessage] = useState(null);

  // === THÈME ACTUEL ===
  const currentTheme = useMemo(() => 
    FINITION_TYPES.find(t => t.id === selectedType) || FINITION_TYPES[0],
    [selectedType]
  );

  // === MOTEUR DE CALCUL ===
  const results = useMemo(() => {
    const surf = parseFloat(inputs.surface) || 0;
    const pm = parseFloat(inputs.prixMateriel) || 0;
    const mo = parseFloat(inputs.prixMainOeuvre) || 0;
    
    // Gestion spécifique peinture : matériel multiplié par nombre de couches
    const nbCouches = selectedType === 'peinture' ? (parseFloat(inputs.couches) || 1) : 1;
    
    let totalMateriaux = 0;
    let totalMainOeuvre = 0;

    if (selectedType === 'peinture') {
        // Peinture : Matériel * m² * couches + Main d'œuvre * m²
        totalMateriaux = surf * pm * nbCouches;
        totalMainOeuvre = surf * mo; 
    } else {
        // Autres : (Matériel + Main d'œuvre) * Quantité
        totalMateriaux = surf * pm;
        totalMainOeuvre = surf * mo;
    }

    const total = totalMateriaux + totalMainOeuvre;

    return { 
        surface: surf, 
        totalMateriaux, 
        totalMainOeuvre, 
        total,
        nbCouches
    };
  }, [inputs, selectedType]);

  // === EFFETS ===

  // 1. Sync Parent (Anti-Loop)
  useEffect(() => {
    if (onCostChange) onCostChange(results.total);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results.total]);

  // 2. Chargement Historique
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setHistorique(JSON.parse(saved));
    } catch (e) { console.error("Erreur historique", e); }
  }, []);

  // === HANDLERS ===
  const handleChange = (field) => (e) => setInputs(prev => ({ ...prev, [field]: e.target.value }));
  
  const showToast = (msg, type = "success") => {
    setMessage({ text: msg, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleSave = () => {
    if (results.total <= 0) return showToast("⚠️ Montant nul", "error");
    
    const newEntry = {
      id: Date.now(),
      date: new Date().toLocaleString(),
      type: selectedType,
      inputs: { ...inputs },
      results: { ...results }
    };

    const newHist = [newEntry, ...historique];
    setHistorique(newHist);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newHist));
    showToast("✅ Finition sauvegardée !");
  };

  const clearHistory = () => {
    if (window.confirm("Vider l'historique ?")) {
      setHistorique([]);
      localStorage.removeItem(STORAGE_KEY);
      showToast("Historique vidé");
    }
  };

  const resetFields = () => {
    setInputs({ surface: "", prixMateriel: "", prixMainOeuvre: "", couches: "2" });
  };

  // === DATA CHART ===
  const chartData = {
    labels: ["Matériaux", "Main d'œuvre"],
    datasets: [{
      data: [results.totalMateriaux, results.totalMainOeuvre],
      backgroundColor: ["#8b5cf6", "#06b6d4"], // Violet, Cyan
      borderColor: "#1f2937",
      borderWidth: 4,
    }]
  };

  // === RENDU ===
  return (
    <div className="w-full h-full flex flex-col bg-gray-900 text-gray-100 overflow-hidden relative">
      
      {/* Toast */}
      {message && (
        <div className={`fixed top-4 right-4 px-6 py-3 rounded-xl shadow-2xl z-50 font-bold animate-in fade-in slide-in-from-top-2 ${
          message.type === "error" ? "bg-red-600" : "bg-violet-600"
        }`}>
          {message.text}
        </div>
      )}

      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-800 flex flex-col sm:flex-row justify-between items-center bg-gray-900/50 backdrop-blur-sm gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-violet-500/20 rounded-lg text-violet-500">
            <PaintRoller className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Finitions</h2>
            <p className="text-xs text-gray-400">Revêtements & Peinture</p>
          </div>
        </div>

        {/* Total Badge */}
        <div className="bg-gray-800 rounded-lg px-4 py-2 border border-gray-700">
          <span className="text-xs text-gray-400 block">Total Estimé</span>
          <span className="text-lg font-black text-violet-400">
            {results.total.toLocaleString(undefined, { maximumFractionDigits: 0 })} 
            <span className="text-sm ml-1 text-gray-500">{currency}</span>
          </span>
        </div>
      </div>

      {/* Main Grid */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
          
          {/* COLONNE GAUCHE : SÉLECTION & INPUTS (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            
            {/* Grid Sélection */}
            <div className="grid grid-cols-3 gap-2 bg-gray-800 p-2 rounded-2xl border border-gray-700">
              {FINITION_TYPES.map((type) => (
                <button
                  key={type.id}
                  onClick={() => setSelectedType(type.id)}
                  className={`flex flex-col items-center justify-center gap-1 py-3 rounded-xl text-xs font-bold transition-all ${
                    selectedType === type.id 
                      ? "bg-violet-600 text-white shadow-lg scale-95" 
                      : "text-gray-400 hover:text-white hover:bg-gray-700"
                  }`}
                >
                  {type.icon}
                  <span>{type.label}</span>
                </button>
              ))}
            </div>

            {/* Formulaire */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5 shadow-lg flex-1 flex flex-col gap-4 animate-in fade-in slide-in-from-left-4 duration-300">
              <h3 className={`flex items-center gap-2 text-sm font-bold uppercase tracking-wider ${currentTheme.text}`}>
                <Ruler className="w-4 h-4" /> Quantités : {currentTheme.label}
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div className={selectedType === "peinture" ? "" : "col-span-2"}>
                   <InputGroup 
                     label={`Surface (${currentTheme.unit})`} 
                     value={inputs.surface} 
                     onChange={handleChange("surface")} 
                     placeholder="0" 
                   />
                </div>

                {/* Champ spécifique Peinture */}
                {selectedType === "peinture" && (
                  <InputGroup 
                    label="Couches" 
                    value={inputs.couches} 
                    onChange={handleChange("couches")} 
                    placeholder="2" 
                  />
                )}
              </div>

              <div className="h-px bg-gray-700/50 my-2" />

              <h3 className="flex items-center gap-2 text-sm font-bold text-gray-400 uppercase tracking-wider">
                <Banknote className="w-4 h-4" /> Prix Unitaires
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <InputGroup 
                  label={`Matériaux (${currency}/${currentTheme.unit})`} 
                  value={inputs.prixMateriel} 
                  onChange={handleChange("prixMateriel")} 
                />
                <InputGroup 
                  label={`Pose (${currency}/${currentTheme.unit})`} 
                  value={inputs.prixMainOeuvre} 
                  onChange={handleChange("prixMainOeuvre")} 
                />
              </div>

              <div className="flex gap-3 mt-auto pt-6">
                <button 
                  onClick={handleSave}
                  className="flex-1 bg-gradient-to-r from-violet-600 to-indigo-600 hover:opacity-90 text-white py-3 rounded-xl font-bold shadow-lg active:scale-95 transition-all flex justify-center items-center gap-2"
                >
                  <Save className="w-5 h-5" /> Ajouter
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

          {/* COLONNE DROITE : DASHBOARD (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            
            {/* KPIs */}
            <div className="grid grid-cols-3 gap-4">
              <ResultCard 
                label="Surface" 
                value={results.surface} 
                unit={currentTheme.unit} 
                icon={currentTheme.icon} 
                color={currentTheme.text} 
                bg={currentTheme.bg} 
              />
              <ResultCard 
                label="Matériaux" 
                value={(results.totalMateriaux / 1000).toFixed(1)} 
                unit={`k ${currency}`} 
                icon="🧱" 
                color="text-blue-400" 
                bg="bg-blue-500/10" 
                border 
              />
              <ResultCard 
                label="Main d'œuvre" 
                value={(results.totalMainOeuvre / 1000).toFixed(1)} 
                unit={`k ${currency}`} 
                icon="👷" 
                color="text-cyan-400" 
                bg="bg-cyan-500/10" 
              />
            </div>

            {/* Graphique & Détails */}
            <div className="flex-1 bg-gray-800 rounded-2xl p-6 border border-gray-700 shadow-xl flex flex-col md:flex-row gap-8 items-center relative overflow-hidden">
               {/* Deco BG */}
               <div className={`absolute -bottom-10 -right-10 w-40 h-40 ${currentTheme.bg} rounded-full blur-3xl pointer-events-none opacity-50`} />

               <div className="w-40 h-40 flex-shrink-0 relative">
                  <Doughnut data={chartData} options={{ cutout: "75%", plugins: { legend: { display: false } } }} />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                     <span className={`text-sm font-bold ${currentTheme.text}`}>
                       {results.total > 0 ? "Total" : "0"}
                     </span>
                  </div>
               </div>

               <div className="flex-1 w-full space-y-4">
                  <h4 className="text-gray-400 text-sm font-medium border-b border-gray-700 pb-2">
                    Répartition des Coûts
                  </h4>
                  <CostRow 
                    label="Matériaux" 
                    value={results.totalMateriaux} 
                    currency={currency} 
                    color="bg-violet-500" 
                  />
                  <CostRow 
                    label="Main d'œuvre (Pose)" 
                    value={results.totalMainOeuvre} 
                    currency={currency} 
                    color="bg-cyan-500" 
                  />
                  <div className="pt-3 border-t border-gray-700">
                    <CostRow 
                      label="TOTAL" 
                      value={results.total} 
                      currency={currency} 
                      color="bg-emerald-500" 
                      bold 
                    />
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
                  {historique.map((item) => {
                    const theme = FINITION_TYPES.find(t => t.id === item.type);
                    return (
                      <div 
                        key={item.id} 
                        className="flex justify-between items-center bg-gray-700/30 p-2 rounded hover:bg-gray-700/50 transition border border-transparent hover:border-gray-600"
                      >
                        <div className="flex items-center gap-3">
                           <div className={`p-1.5 rounded-lg ${theme?.bg || 'bg-gray-500/20'} ${theme?.text || 'text-gray-400'}`}>
                              {theme?.icon}
                           </div>
                           <div className="flex flex-col">
                             <span className="text-xs font-bold text-gray-200">{theme?.label}</span>
                             <span className="text-[10px] text-gray-500">{item.date.split(',')[0]}</span>
                           </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-gray-400">{item.inputs.surface} {theme?.unit}</div>
                          <div className={`text-sm font-bold ${theme?.text}`}>
                            {parseFloat(item.results.total).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}

// === SOUS-COMPOSANTS ===

const InputGroup = ({ label, value, onChange, placeholder, full = false, type = "number" }) => (
  <div className={`flex flex-col ${full ? "col-span-2" : ""}`}>
    <label className="mb-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-wide">
      {label}
    </label>
    <input
      type={type}
      min={type === "number" ? "0" : undefined}
      step={type === "number" ? "any" : undefined}
      value={value}
      onChange={onChange}
      className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all font-mono text-sm"
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
      {typeof value === 'number' ? value : value} {unit && <span className="text-xs font-normal text-gray-500">{unit}</span>}
    </span>
  </div>
);

const CostRow = ({ label, value, currency, color, bold = false }) => (
  <div className="flex justify-between items-center">
    <span className={`flex items-center gap-2 text-gray-300 text-sm ${bold ? 'font-bold' : ''}`}>
      <div className={`w-3 h-3 rounded-full ${color}`} />
      {label}
    </span>
    <span className={`font-mono text-white ${bold ? 'font-black text-lg' : 'font-bold'}`}>
      {value.toLocaleString(undefined, { maximumFractionDigits: 0 })} {currency}
    </span>
  </div>
);