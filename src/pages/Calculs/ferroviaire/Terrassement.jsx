import React, { useState, useEffect, useMemo } from "react";
import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { 
  Pickaxe, Ruler, Banknote, Save, Trash2, History, Truck, Info, MoveRight 
} from "lucide-react";

ChartJS.register(ArcElement, Tooltip, Legend);

const STORAGE_KEY = "terrassement-history-v2";

// Coefficients de foisonnement moyens (le volume augmente quand on creuse)
const SOIL_TYPES = {
  SABLE: { label: "Sable / Gravier", coeff: 1.10 },
  TERRE: { label: "Terre Ordinaire", coeff: 1.25 },
  ARGILE: { label: "Argile / Limon", coeff: 1.35 },
};

export default function Terrassement({ currency = "XOF", onMaterialsChange = () => {} }) {
  // --- ÉTATS ---
  const [inputs, setInputs] = useState({
    longueur: "",
    largeur: "",
    profondeur: "",
    prixUnitaire: "",
    coutMainOeuvre: "",
    typeSol: "TERRE"
  });
  const [historique, setHistorique] = useState([]);
  const [message, setMessage] = useState(null);

  // --- CALCULS (Mémorisés pour la performance) ---
  const results = useMemo(() => {
    const L = parseFloat(inputs.longueur) || 0;
    const l = parseFloat(inputs.largeur) || 0;
    const p = parseFloat(inputs.profondeur) || 0;
    const pu = parseFloat(inputs.prixUnitaire) || 0;
    const mo = parseFloat(inputs.coutMainOeuvre) || 0;
    
    const volumeEnPlace = L * l * p;
    const volumeFoisonne = volumeEnPlace * SOIL_TYPES[inputs.typeSol].coeff;
    
    const coutExcavation = volumeEnPlace * pu;
    const total = coutExcavation + mo;

    // Estimation camions (benne de 15m3)
    const nbCamions = Math.ceil(volumeFoisonne / 15);

    return { volumeEnPlace, volumeFoisonne, coutExcavation, mo, total, nbCamions };
  }, [inputs]);

  // --- EFFETS ---
  useEffect(() => {
    onMaterialsChange({ volume: results.volumeEnPlace });
  }, [results.volumeEnPlace]);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setHistorique(JSON.parse(saved));
  }, []);

  // --- ACTIONS ---
  const handleChange = (field, value) => setInputs(prev => ({ ...prev, [field]: value }));

  const handleSave = () => {
    if (results.volumeEnPlace <= 0) return showToast("⚠️ Dimensions invalides", "error");
    
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

  const showToast = (msg, type = "success") => {
    setMessage({ text: msg, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const clearHistory = () => {
    if (window.confirm("Vider l'historique ?")) {
      setHistorique([]);
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  // --- DATA CHART ---
  const chartData = {
    labels: ["Excavation", "Main d'œuvre"],
    datasets: [{
      data: [results.coutExcavation, results.mo],
      backgroundColor: ["#f59e0b", "#475569"],
      borderColor: "#111827",
      borderWidth: 2,
    }]
  };

  return (
    <div className="w-full h-full flex flex-col bg-gray-900 text-gray-100 overflow-hidden relative">
      
      {/* Notification */}
      {message && (
        <div className={`fixed top-4 right-4 px-6 py-3 rounded-xl shadow-2xl z-50 font-bold animate-bounce ${
          message.type === "error" ? "bg-red-600" : "bg-orange-600"
        }`}>
          {message.text}
        </div>
      )}

      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-600/20 rounded-lg text-orange-500">
            <Pickaxe className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white uppercase tracking-tight">Terrassement</h2>
            <p className="text-xs text-gray-400 font-medium">Fouilles & Mouvement de terre</p>
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg px-4 py-2 border border-gray-700">
          <span className="text-xs text-gray-400 block uppercase font-bold tracking-tighter">Budget Estimé</span>
          <span className="text-lg font-black text-orange-400">
            {results.total.toLocaleString()} <span className="text-sm text-gray-500">{currency}</span>
          </span>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-6 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
          
          {/* GAUCHE : SAISIE (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5 shadow-lg">
              <h3 className="flex items-center gap-2 text-xs font-bold text-orange-400 uppercase tracking-widest mb-4">
                <Ruler className="w-4 h-4" /> Géométrie du trou
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label="Longueur (m)" value={inputs.longueur} onChange={v => handleChange("longueur", v)} />
                <InputGroup label="Largeur (m)" value={inputs.largeur} onChange={v => handleChange("largeur", v)} />
                <InputGroup label="Profondeur (m)" value={inputs.profondeur} onChange={v => handleChange("profondeur", v)} full />
                
                <div className="col-span-2">
                  <label className="text-[10px] text-gray-500 font-bold uppercase mb-1 block">Nature du sol</label>
                  <select 
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-sm focus:ring-1 focus:ring-orange-500 outline-none"
                    value={inputs.typeSol}
                    onChange={(e) => handleChange("typeSol", e.target.value)}
                  >
                    {Object.entries(SOIL_TYPES).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5 shadow-lg flex-1">
              <h3 className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
                <Banknote className="w-4 h-4 text-green-500" /> Tarification
              </h3>
              <div className="space-y-4">
                <InputGroup label={`Prix unitaire (${currency}/m³)`} value={inputs.prixUnitaire} onChange={v => handleChange("prixUnitaire", v)} />
                <InputGroup label={`Main d'œuvre forfaitaire (${currency})`} value={inputs.coutMainOeuvre} onChange={v => handleChange("coutMainOeuvre", v)} />
                
                <button 
                  onClick={handleSave}
                  className="w-full bg-orange-600 hover:bg-orange-500 text-white py-4 rounded-xl font-bold shadow-lg transition-all flex justify-center items-center gap-2 active:scale-95"
                >
                  <Save className="w-5 h-5" /> Enregistrer le calcul
                </button>
              </div>
            </div>
          </div>

          {/* DROITE : DASHBOARD (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            
            <div className="grid grid-cols-3 gap-4">
              <ResultCard label="Volume Brut" value={results.volumeEnPlace.toFixed(2)} unit="m³" icon="🧊" color="text-orange-400" bg="bg-orange-500/10" />
              <ResultCard label="Volume Foisonné" value={results.volumeFoisonne.toFixed(2)} unit="m³" icon="🌋" color="text-yellow-400" bg="bg-yellow-500/10" border />
              <ResultCard label="Nb Camions" value={results.nbCamions} unit="voyages" icon={<Truck className="w-4 h-4"/>} color="text-stone-300" bg="bg-stone-500/10" />
            </div>

            <div className="flex-1 bg-gray-800 rounded-2xl p-6 border border-gray-700 shadow-xl flex flex-col md:flex-row gap-8 items-center relative overflow-hidden">
               <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-orange-600/10 rounded-full blur-3xl pointer-events-none" />

               <div className="w-44 h-44 flex-shrink-0 relative">
                  <Doughnut data={chartData} options={{ cutout: "75%", plugins: { legend: { display: false } } }} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                     <span className="text-[10px] text-gray-500 uppercase font-bold">Total</span>
                     <span className="text-sm font-bold text-white">{results.total.toLocaleString()}</span>
                  </div>
               </div>

               <div className="flex-1 w-full space-y-4">
                  <h4 className="text-gray-400 text-xs font-bold uppercase tracking-widest border-b border-gray-700 pb-2 mb-2">Analyse des coûts</h4>
                  <MaterialRow label="Excavation machine" val={`${results.coutExcavation.toLocaleString()} ${currency}`} color="bg-orange-500" />
                  <MaterialRow label="Main d'œuvre" val={`${results.mo.toLocaleString()} ${currency}`} color="bg-gray-600" />
                  
                  <div className="flex items-start gap-2 p-3 bg-blue-500/5 rounded-lg border border-blue-500/20 mt-4">
                    <Info className="w-4 h-4 text-blue-400 mt-0.5" />
                    <p className="text-[10px] text-blue-200/70 leading-relaxed italic">
                      Le sol de type <strong>{SOIL_TYPES[inputs.typeSol].label}</strong> augmente le volume réel à évacuer de <strong>{Math.round((SOIL_TYPES[inputs.typeSol].coeff - 1) * 100)}%</strong> après extraction.
                    </p>
                  </div>
               </div>
            </div>

            {/* Historique */}
            {historique.length > 0 && (
              <div className="bg-gray-800/30 rounded-2xl border border-gray-700/50 overflow-hidden flex-1 min-h-[150px]">
                <div className="px-4 py-2 bg-gray-800/50 border-b border-gray-700/50 flex justify-between items-center">
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2"><History className="w-3 h-3" /> Historique récent</h4>
                  <button onClick={clearHistory} className="text-[10px] text-red-400 hover:underline uppercase">Vider</button>
                </div>
                <div className="max-h-[150px] overflow-y-auto">
                  {historique.map((item) => (
                    <div key={item.id} className="flex justify-between items-center p-3 border-b border-gray-700/30 hover:bg-gray-700/40 transition-colors">
                      <div className="text-xs">
                        <span className="text-gray-500 block text-[9px]">{item.date}</span>
                        <span className="font-medium uppercase tracking-tighter">Volume: {item.results.volumeEnPlace} m³</span>
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
    <label className="mb-1 text-[10px] font-bold text-gray-500 uppercase tracking-wide">{label}</label>
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(e.target.value)}
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
  <div className="flex justify-between items-center border-b border-gray-700/30 pb-2 last:border-0 group">
    <div className="flex items-center gap-2">
      <div className={`w-1.5 h-1.5 rounded-full ${color}`} />
      <span className="text-gray-300 text-xs font-medium">{label}</span>
    </div>
    <span className="text-xs font-bold text-white font-mono">{val}</span>
  </div>
);