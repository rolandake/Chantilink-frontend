import React, { useState, useEffect, useMemo } from "react";
import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { 
  Home, Ruler, Banknote, Save, Trash2, History, Anchor, Droplets, Layers 
} from "lucide-react";

ChartJS.register(ArcElement, Tooltip, Legend);

const STORAGE_KEY = "toiture-batiment-history";

// Dosages Béton pour Toit Terrasse (Dalle pleine)
const DOSAGE_BETON = {
  ciment: 0.350,
  sable: 0.6,
  gravier: 0.85,
  acier: 0.100, // 100kg/m3 pour dalle toiture
  eau: 175
};

const TYPES_TOITURE = [
  { id: "tuiles", label: "Tuiles", icon: <Home className="w-4 h-4"/>, unit: "u" },
  { id: "bac_acier", label: "Bac Acier", icon: <Layers className="w-4 h-4"/>, unit: "m²" },
  { id: "toit_terrasse", label: "Toit Terrasse", icon: <Layers className="w-4 h-4"/>, unit: "m³" },
];

export default function Toiture({ currency = "XOF", onTotalChange, onMateriauxChange }) {
  
  // --- ÉTATS ---
  const [typeToiture, setTypeToiture] = useState("tuiles");
  const [inputs, setInputs] = useState({
    surface: "",
    epaisseur: "0.15", // Pour toit terrasse
    densiteTuiles: "12", // Pour tuiles
    prixUnitaire: "",
    coutMainOeuvre: ""
  });

  const [historique, setHistorique] = useState([]);
  const [message, setMessage] = useState(null);

  // --- MOTEUR DE CALCUL ---
  const results = useMemo(() => {
    const S = parseFloat(inputs.surface) || 0;
    const pu = parseFloat(inputs.prixUnitaire) || 0;
    const mo = parseFloat(inputs.coutMainOeuvre) || 0;
    
    let quantiteMateriel = 0;
    let coutMateriaux = 0;
    let detailsMateriaux = {};

    if (typeToiture === "tuiles") {
      const densite = parseFloat(inputs.densiteTuiles) || 12;
      quantiteMateriel = S * densite;
      coutMateriaux = quantiteMateriel * pu;
    } else if (typeToiture === "bac_acier") {
      quantiteMateriel = S;
      coutMateriaux = S * pu;
    } else if (typeToiture === "toit_terrasse") {
      const ep = parseFloat(inputs.epaisseur) || 0.15;
      const volume = S * ep;
      quantiteMateriel = volume;
      coutMateriaux = volume * pu;

      // Calculs Béton
      detailsMateriaux = {
        cimentT: volume * DOSAGE_BETON.ciment,
        sableT: volume * DOSAGE_BETON.sable,
        gravierT: volume * DOSAGE_BETON.gravier,
        acierT: volume * DOSAGE_BETON.acier,
        eauL: volume * DOSAGE_BETON.eau
      };
    }

    const total = coutMateriaux + mo;

    return {
      quantiteMateriel,
      coutMateriaux,
      detailsMateriaux,
      mo,
      total
    };
  }, [inputs, typeToiture]);

  // --- SYNC PARENT ---
  useEffect(() => {
    if (onTotalChange) onTotalChange(results.total);
    if (onMateriauxChange && typeToiture === "toit_terrasse") {
      onMateriauxChange({
        volume: results.quantiteMateriel,
        ciment: results.detailsMateriaux.cimentT,
        acier: results.detailsMateriaux.acierT
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results.total]);

  // --- HISTORIQUE ---
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setHistorique(JSON.parse(saved));
    } catch {}
  }, []);

  const handleSave = () => {
    if (results.total <= 0) return showToast("⚠️ Données invalides", "error");
    
    const newEntry = {
      id: Date.now(),
      date: new Date().toLocaleString(),
      type: typeToiture,
      inputs: { ...inputs },
      results: { ...results }
    };

    const newHist = [newEntry, ...historique];
    setHistorique(newHist);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newHist));
    showToast("✅ Toiture sauvegardée !");
  };

  const clearHistory = () => {
    if (window.confirm("Vider l'historique ?")) {
      setHistorique([]);
      localStorage.removeItem(STORAGE_KEY);
      showToast("Historique vidé");
    }
  };

  const resetFields = () => {
    setInputs({ surface: "", epaisseur: "0.15", densiteTuiles: "12", prixUnitaire: "", coutMainOeuvre: "" });
  };

  const handleChange = (field) => (e) => setInputs(prev => ({ ...prev, [field]: e.target.value }));
  
  const showToast = (msg, type = "success") => {
    setMessage({ text: msg, type });
    setTimeout(() => setMessage(null), 3000);
  };

  // --- CHART DATA ---
  const chartData = {
    labels: ["Matériaux", "Main d'œuvre"],
    datasets: [{
      data: [results.coutMateriaux, results.mo],
      backgroundColor: ["#f97316", "#06b6d4"], // Orange, Cyan
      borderColor: "#1f2937",
      borderWidth: 4,
    }]
  };

  return (
    <div className="w-full h-full flex flex-col bg-gray-900 text-gray-100 overflow-hidden relative">
      
      {/* Toast */}
      {message && (
        <div className={`fixed top-4 right-4 px-6 py-3 rounded-xl shadow-2xl z-50 font-bold ${message.type === "error" ? "bg-red-600" : "bg-orange-600"}`}>
          {message.text}
        </div>
      )}

      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-600/20 rounded-lg text-orange-500">
            <Home className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Toiture</h2>
            <p className="text-xs text-gray-400">Couverture & Charpente</p>
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
          
          {/* GAUCHE : SÉLECTION & INPUTS (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            
            {/* Type Selector */}
            <div className="grid grid-cols-3 gap-2 bg-gray-800 p-1.5 rounded-xl border border-gray-700">
              {TYPES_TOITURE.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTypeToiture(t.id)}
                  className={`flex items-center justify-center gap-2 py-2 rounded-lg transition-all text-xs font-bold ${
                    typeToiture === t.id 
                      ? "bg-orange-600 text-white shadow-lg" 
                      : "text-gray-400 hover:text-white hover:bg-gray-700"
                  }`}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>

            {/* Formulaire */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5 shadow-lg flex-1 flex flex-col gap-4">
              <h3 className="flex items-center gap-2 text-sm font-bold text-orange-400 uppercase tracking-wider">
                <Ruler className="w-4 h-4" /> Dimensions
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                   <InputGroup label="Surface Toiture (m²)" value={inputs.surface} onChange={handleChange("surface")} placeholder="Ex: 120" />
                </div>

                {typeToiture === "tuiles" && (
                  <div className="col-span-2">
                    <InputGroup label="Densité (u/m²)" value={inputs.densiteTuiles} onChange={handleChange("densiteTuiles")} placeholder="12" />
                  </div>
                )}

                {typeToiture === "toit_terrasse" && (
                  <div className="col-span-2">
                    <InputGroup label="Épaisseur Dalle (m)" value={inputs.epaisseur} onChange={handleChange("epaisseur")} placeholder="0.15" />
                  </div>
                )}
              </div>

              <div className="h-px bg-gray-700/50 my-2" />

              <h3 className="flex items-center gap-2 text-sm font-bold text-gray-400 uppercase tracking-wider">
                <Banknote className="w-4 h-4" /> Coûts
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <InputGroup 
                  label={`Prix Unit. (${currency}/${typeToiture === 'tuiles' ? 'u' : typeToiture === 'toit_terrasse' ? 'm³' : 'm²'})`} 
                  value={inputs.prixUnitaire} 
                  onChange={handleChange("prixUnitaire")} 
                />
                <InputGroup label={`Main d'œuvre (${currency})`} value={inputs.coutMainOeuvre} onChange={handleChange("coutMainOeuvre")} />
              </div>

              <div className="flex gap-3 mt-auto pt-6">
                <button onClick={handleSave} className="flex-1 bg-gradient-to-r from-orange-600 to-red-600 hover:opacity-90 text-white py-3 rounded-xl font-bold shadow-lg active:scale-95 transition-all flex justify-center items-center gap-2">
                  <Save className="w-5 h-5" /> Calculer
                </button>
                <button onClick={resetFields} className="px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-xl transition">
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* DROITE : RÉSULTATS (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            
            {/* KPIs */}
            <div className="grid grid-cols-3 gap-4">
              <ResultCard 
                label={typeToiture === 'tuiles' ? "Nombre Tuiles" : typeToiture === 'toit_terrasse' ? "Volume Béton" : "Surface"} 
                value={results.quantiteMateriel.toFixed(typeToiture === 'tuiles' ? 0 : 2)} 
                unit={typeToiture === 'tuiles' ? "u" : typeToiture === 'toit_terrasse' ? "m³" : "m²"} 
                icon="📦" 
                color="text-orange-400" 
                bg="bg-orange-500/10" 
              />
              <ResultCard label="Coût Matériaux" value={(results.coutMateriaux/1000).toFixed(1)} unit="k" icon="🧱" color="text-gray-300" bg="bg-gray-500/10" border />
              <ResultCard label="Coût MO" value={(results.mo/1000).toFixed(1)} unit="k" icon="👷" color="text-cyan-400" bg="bg-cyan-500/10" />
            </div>

            {/* Graphique & Détails */}
            <div className="flex-1 bg-gray-800 rounded-2xl p-6 border border-gray-700 shadow-xl flex flex-col md:flex-row gap-8 items-center relative overflow-hidden">
               <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-orange-600/10 rounded-full blur-3xl pointer-events-none" />

               <div className="w-40 h-40 flex-shrink-0 relative">
                  <Doughnut data={chartData} options={{ cutout: "70%", plugins: { legend: { display: false } } }} />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                     <span className="text-sm font-bold text-orange-400">Total</span>
                  </div>
               </div>

               <div className="flex-1 w-full space-y-3">
                  <h4 className="text-gray-400 text-sm font-medium border-b border-gray-700 pb-2">Répartition Coûts</h4>
                  <MaterialRow label="Matériaux" val={`${results.coutMateriaux.toLocaleString()} ${currency}`} color="bg-orange-500" />
                  <MaterialRow label="Main d'œuvre" val={`${results.mo.toLocaleString()} ${currency}`} color="bg-cyan-500" />
                  
                  {typeToiture === "toit_terrasse" && (
                    <div className="pt-2 border-t border-gray-700 mt-2">
                      <p className="text-[10px] text-gray-500 uppercase font-bold mb-2">Détail Béton</p>
                      <div className="grid grid-cols-2 gap-2 text-xs text-gray-300">
                        <span>Ciment: {results.detailsMateriaux.cimentT.toFixed(2)} t</span>
                        <span>Acier: {results.detailsMateriaux.acierT.toFixed(2)} t</span>
                      </div>
                    </div>
                  )}
               </div>
            </div>

            {/* Historique */}
            {historique.length > 0 && (
              <div className="bg-gray-800/30 rounded-2xl border border-gray-700/50 overflow-hidden flex-1 min-h-[150px]">
                <div className="px-4 py-3 bg-gray-800/50 border-b border-gray-700/50 flex justify-between items-center">
                  <h4 className="text-xs font-bold text-gray-400 flex items-center gap-2">
                    <History className="w-3 h-3" /> Historique récent
                  </h4>
                  <button onClick={clearHistory} className="text-[10px] text-red-400 hover:underline">Vider</button>
                </div>
                <div className="overflow-y-auto max-h-[180px] p-2 space-y-2">
                  {historique.map((item) => (
                    <div key={item.id} className="flex justify-between items-center bg-gray-700/30 p-2 rounded hover:bg-gray-700/50 transition border border-transparent hover:border-orange-500/30">
                      <div className="flex flex-col">
                         <span className="text-[10px] text-gray-500">{item.date.split(',')[0]}</span>
                         <span className="text-xs text-gray-300">
                           {item.type} ({item.inputs.surface}m²)
                         </span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-bold text-orange-400">{item.results.total.toLocaleString()} {currency}</span>
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
      className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all font-mono text-sm"
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

const MaterialRow = ({ label, val, color }) => (
  <div className="flex justify-between items-center border-b border-gray-700/50 pb-2 last:border-0 group">
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${color}`} />
      <span className="text-gray-300 text-sm font-medium">{label}</span>
    </div>
    <span className="text-sm font-bold text-white font-mono">{val}</span>
  </div>
);