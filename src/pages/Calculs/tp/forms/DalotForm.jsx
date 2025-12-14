import React, { useState, useEffect, useMemo } from "react";
import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { 
  BoxSelect, Columns, LayoutGrid, Grid, 
  Ruler, Banknote, Save, Trash2, History, ArrowRight
} from "lucide-react";

ChartJS.register(ArcElement, Tooltip, Legend);

const STORAGE_KEY = "dalot-calc-history";

// Types de dalots avec configuration géométrique
const DALOT_TYPES = [
  { id: "simple", label: "Simple", icon: <BoxSelect className="w-6 h-6"/>, cols: 1 },
  { id: "double", label: "Double", icon: <Columns className="w-6 h-6"/>, cols: 2 },
  { id: "triple", label: "Triple", icon: <LayoutGrid className="w-6 h-6"/>, cols: 3 },
  { id: "quadruple", label: "Quadruple", icon: <Grid className="w-6 h-6"/>, cols: 4 },
];

export default function DalotForm({ currency = "XOF", onCostChange, onMateriauxChange }) {
  
  // --- ÉTATS ---
  const [typeId, setTypeId] = useState("simple");
  const [inputs, setInputs] = useState({
    longueur: "",      // Longueur totale de l'ouvrage
    largeur: "",       // Ouverture intérieure (par cellule)
    hauteur: "",       // Hauteur intérieure
    epaisseur: "",     // Épaisseur des voiles et dalles
    prixUnitaire: "",  // Prix béton
    coutMainOeuvre: "" // Ferraillage + Coffrage
  });

  const [historique, setHistorique] = useState([]);
  const [message, setMessage] = useState(null);

  // --- MOTEUR DE CALCUL (Géométrie Dalot Cadre) ---
  const results = useMemo(() => {
    const L = parseFloat(inputs.longueur) || 0;
    const l_int = parseFloat(inputs.largeur) || 0;
    const h_int = parseFloat(inputs.hauteur) || 0;
    const ep = parseFloat(inputs.epaisseur) || 0;
    const pu = parseFloat(inputs.prixUnitaire) || 0;
    const mo = parseFloat(inputs.coutMainOeuvre) || 0;

    const nbCellules = DALOT_TYPES.find(t => t.id === typeId)?.cols || 1;

    // 1. Calcul des dimensions extérieures
    // Largeur Ext = (NbCellules * LargeurInt) + ((NbCellules + 1) * Epaisseur)
    const largExt = (nbCellules * l_int) + ((nbCellules + 1) * ep);
    
    // Hauteur Ext = HauteurInt + (2 * Epaisseur) (Radier + Dalle sup)
    const hautExt = h_int + (2 * ep);

    // 2. Calcul des Surfaces (Coupe transversale)
    const surfTotale = largExt * hautExt;
    const surfVide = (l_int * h_int) * nbCellules;
    const surfBeton = surfTotale - surfVide;

    // 3. Volume Béton Total
    const volume = surfBeton * L;

    // 4. Matériaux (Dosage 350kg/m3)
    const cimentT = (volume * 350) / 1000;
    const acierT = (volume * 120) / 1000; // Ratio ~120kg/m3 pour dalot ferraillé
    const sableT = (volume * 0.45) * 1.6;
    const gravierT = (volume * 0.85) * 1.75;

    // 5. Coûts
    const coutMateriel = volume * pu;
    const total = coutMateriel + mo;

    return {
      volume,
      cimentT, acierT, sableT, gravierT,
      coutMateriel, mo, total,
      nbCellules
    };
  }, [inputs, typeId]);

  // --- SYNC PARENT ---
  useEffect(() => {
    if (onCostChange) onCostChange(results.total);
    if (onMateriauxChange) onMateriauxChange(results);
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
    if (results.volume <= 0) return showToast("⚠️ Dimensions manquantes", "error");
    const newEntry = {
      id: Date.now(),
      date: new Date().toLocaleString(),
      type: typeId,
      inputs: { ...inputs },
      results: { ...results }
    };
    const newHist = [newEntry, ...historique];
    setHistorique(newHist);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newHist));
    showToast("✅ Dalot sauvegardé !");
  };

  const clearHistory = () => {
    if (window.confirm("Tout effacer ?")) {
      setHistorique([]);
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  // --- HELPERS ---
  const handleChange = (field) => (e) => setInputs(prev => ({ ...prev, [field]: e.target.value }));
  const showToast = (msg, type = "success") => {
    setMessage({ text: msg, type });
    setTimeout(() => setMessage(null), 3000);
  };

  // --- GRAPHIQUE ---
  const chartData = {
    labels: ["Béton", "Main d'œuvre"],
    datasets: [{
      data: [results.coutMateriel, results.mo],
      backgroundColor: ["#3b82f6", "#f97316"],
      borderColor: "#1f2937",
      borderWidth: 4,
    }]
  };

  return (
    <div className="w-full h-full flex flex-col bg-gray-900 text-gray-100 overflow-hidden relative">
      
      {/* Toast */}
      {message && (
        <div className={`fixed top-4 right-4 px-6 py-3 rounded-xl shadow-2xl z-50 font-bold ${message.type === "error" ? "bg-red-600" : "bg-blue-600"}`}>
          {message.text}
        </div>
      )}

      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/20 rounded-lg text-blue-500">
            <Columns className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Calculateur de Dalot</h2>
            <p className="text-xs text-gray-400">Ouvrage hydraulique cadre</p>
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
          
          {/* GAUCHE : SÉLECTION & INPUTS (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            
            {/* Sélecteur de Type */}
            <div className="grid grid-cols-4 gap-2 bg-gray-800 p-1.5 rounded-xl border border-gray-700">
              {DALOT_TYPES.map((type) => (
                <button
                  key={type.id}
                  onClick={() => setTypeId(type.id)}
                  title={type.label}
                  className={`flex flex-col items-center justify-center py-2 rounded-lg transition-all ${
                    typeId === type.id 
                      ? "bg-blue-600 text-white shadow-lg" 
                      : "text-gray-400 hover:text-white hover:bg-gray-700"
                  }`}
                >
                  {type.icon}
                  <span className="text-[10px] mt-1 font-bold">{type.cols}x</span>
                </button>
              ))}
            </div>

            {/* Formulaire */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5 shadow-lg flex-1 flex flex-col gap-4">
              <h3 className="flex items-center gap-2 text-sm font-bold text-blue-400 uppercase tracking-wider">
                <Ruler className="w-4 h-4" /> Dimensions {typeId}
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <InputGroup label="Longueur (m)" value={inputs.longueur} onChange={handleChange("longueur")} placeholder="Ex: 10" />
                <InputGroup label="Épaisseur Parois (m)" value={inputs.epaisseur} onChange={handleChange("epaisseur")} placeholder="Ex: 0.20" />
                <InputGroup label="Largeur Int. (m)" value={inputs.largeur} onChange={handleChange("largeur")} placeholder="Ex: 2.00" />
                <InputGroup label="Hauteur Int. (m)" value={inputs.hauteur} onChange={handleChange("hauteur")} placeholder="Ex: 1.50" />
              </div>

              <div className="h-px bg-gray-700/50 my-2" />

              <h3 className="flex items-center gap-2 text-sm font-bold text-gray-400 uppercase tracking-wider">
                <Banknote className="w-4 h-4" /> Coûts
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label={`Prix Béton (${currency}/m³)`} value={inputs.prixUnitaire} onChange={handleChange("prixUnitaire")} />
                <InputGroup label={`Main d'œuvre (${currency})`} value={inputs.coutMainOeuvre} onChange={handleChange("coutMainOeuvre")} />
              </div>

              <div className="flex gap-3 mt-auto pt-6">
                <button onClick={handleSave} className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-600 hover:opacity-90 text-white py-3 rounded-xl font-bold shadow-lg active:scale-95 transition-all flex justify-center items-center gap-2">
                  <Save className="w-5 h-5" /> Calculer
                </button>
                <button onClick={() => setInputs({ longueur: "", largeur: "", hauteur: "", epaisseur: "", prixUnitaire: "", coutMainOeuvre: "" })} className="px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-xl transition">
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* DROITE : RÉSULTATS (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            
            {/* KPIs */}
            <div className="grid grid-cols-3 gap-4">
              <ResultCard label="Volume Béton" value={results.volume.toFixed(2)} unit="m³" icon="🧊" color="text-blue-400" bg="bg-blue-500/10" />
              <ResultCard label="Ciment" value={results.cimentT.toFixed(2)} unit="t" icon="🧱" color="text-gray-300" bg="bg-gray-500/10" border />
              <ResultCard label="Acier" value={results.acierT.toFixed(2)} unit="t" icon="🔩" color="text-red-400" bg="bg-red-500/10" />
            </div>

            {/* Graphique & Détails */}
            <div className="flex-1 bg-gray-800 rounded-2xl p-6 border border-gray-700 shadow-xl flex flex-col md:flex-row gap-8 items-center relative overflow-hidden">
               <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

               <div className="w-40 h-40 flex-shrink-0 relative">
                  <Doughnut data={chartData} options={{ cutout: "70%", plugins: { legend: { display: false } } }} />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                     <span className="text-sm font-bold text-blue-400">Total</span>
                  </div>
               </div>

               <div className="flex-1 w-full space-y-3">
                  <h4 className="text-gray-400 text-sm font-medium border-b border-gray-700 pb-2">Matériaux (Estimation)</h4>
                  <MaterialRow label="Ciment (350kg/m³)" val={`${results.cimentT.toFixed(1)} t`} color="bg-gray-400" />
                  <MaterialRow label="Sable" val={`${results.sableT.toFixed(1)} t`} color="bg-amber-500" />
                  <MaterialRow label="Gravier" val={`${results.gravierT.toFixed(1)} t`} color="bg-stone-500" />
                  <MaterialRow label="Acier (120kg/m³)" val={`${results.acierT.toFixed(1)} t`} color="bg-red-500" />
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
                    <div key={item.id} className="flex justify-between items-center bg-gray-700/30 p-2 rounded hover:bg-gray-700/50 transition border border-transparent hover:border-blue-500/30">
                      <div className="flex items-center gap-3">
                         <span className="text-xs bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded font-bold uppercase">{item.type}</span>
                         <span className="text-[10px] text-gray-500">{item.date.split(',')[0]}</span>
                      </div>
                      <span className="text-sm font-bold text-blue-400">{item.results.total.toLocaleString()} {currency}</span>
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

const InputGroup = ({ label, value, onChange, placeholder }) => (
  <div className="flex flex-col">
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

const MaterialRow = ({ label, val, color }) => (
  <div className="flex justify-between items-center border-b border-gray-700/50 pb-2 last:border-0 group">
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${color}`} />
      <span className="text-gray-300 text-sm font-medium">{label}</span>
    </div>
    <span className="text-sm font-bold text-white font-mono">{val}</span>
  </div>
);