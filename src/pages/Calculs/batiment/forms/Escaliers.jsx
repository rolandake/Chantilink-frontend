import React, { useState, useEffect, useMemo } from "react";
import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { 
  ArrowUpRight, Ruler, Banknote, Save, Trash2, History, Anchor, Droplets 
} from "lucide-react";

ChartJS.register(ArcElement, Tooltip, Legend);

const STORAGE_KEY = "escaliers-batiment-history";

// Dosages Béton (Escaliers) - 350kg/m3
const DOSAGE = {
  ciment: 0.350,
  sable: 0.6,
  gravier: 0.85,
  acier: 0.080, // Ferraillage moyen
  eau: 175
};

export default function Escaliers({ currency = "XOF", onTotalChange, onMateriauxChange }) {
  
  // --- ÉTATS ---
  const [inputs, setInputs] = useState({
    hauteurTotale: "",    // H
    largeur: "",          // L (Emmarchement)
    hauteurMarche: "0.17", // h (Standard ~17cm)
    giron: "0.28",        // g (Standard ~28cm)
    prixUnitaire: "",
    coutMainOeuvre: ""
  });

  const [historique, setHistorique] = useState([]);
  const [message, setMessage] = useState(null);

  // --- MOTEUR DE CALCUL ---
  const results = useMemo(() => {
    const H = parseFloat(inputs.hauteurTotale) || 0;
    const L = parseFloat(inputs.largeur) || 0;
    const h = parseFloat(inputs.hauteurMarche) || 0;
    const g = parseFloat(inputs.giron) || 0;
    const pu = parseFloat(inputs.prixUnitaire) || 0;
    const mo = parseFloat(inputs.coutMainOeuvre) || 0;

    // Nombre de marches
    const nbMarches = h > 0 ? Math.ceil(H / h) : 0;

    // Volume Paillasse + Marches (Approximation classique : V_marche * nb + 30% pour paillasse)
    // Volume d'une marche (prisme triangulaire) : (g * h / 2) * L
    const volMarches = (g * h / 2) * L * nbMarches;
    
    // Volume Paillasse (estimation épaisseur ~15cm)
    const longueurPente = Math.sqrt(Math.pow(H, 2) + Math.pow(nbMarches * g, 2));
    const volPaillasse = longueurPente * L * 0.15; 

    const volumeTotal = volMarches + volPaillasse;

    // Calculs Matériaux
    const cimentT = volumeTotal * DOSAGE.ciment;
    const cimentSacs = (cimentT * 1000) / 50;
    
    const sableT = volumeTotal * DOSAGE.sable;
    const gravierT = volumeTotal * DOSAGE.gravier;
    
    const acierT = volumeTotal * DOSAGE.acier;
    const acierKg = acierT * 1000;
    
    const eauL = volumeTotal * DOSAGE.eau;

    // Coûts
    const coutMateriaux = volumeTotal * pu;
    const total = coutMateriaux + mo;

    return {
      nbMarches,
      volumeTotal,
      cimentT, cimentSacs,
      sableT, gravierT, acierT, acierKg, eauL,
      coutMateriaux, mo, total
    };
  }, [inputs]);

  // --- SYNC PARENT (Anti-Loop) ---
  useEffect(() => {
    if (onTotalChange) onTotalChange(results.total);
    if (onMateriauxChange) {
      onMateriauxChange({
        volume: results.volumeTotal,
        ciment: results.cimentT,
        acier: results.acierT
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
    if (results.volumeTotal <= 0) return showToast("⚠️ Données invalides", "error");
    
    const newEntry = {
      id: Date.now(),
      date: new Date().toLocaleString(),
      inputs: { ...inputs },
      results: { ...results }
    };

    const newHist = [newEntry, ...historique];
    setHistorique(newHist);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newHist));
    showToast("✅ Escalier sauvegardé !");
  };

  const clearHistory = () => {
    if (window.confirm("Vider l'historique ?")) {
      setHistorique([]);
      localStorage.removeItem(STORAGE_KEY);
      showToast("Historique vidé");
    }
  };

  const resetFields = () => {
    setInputs({ hauteurTotale: "", largeur: "", hauteurMarche: "0.17", giron: "0.28", prixUnitaire: "", coutMainOeuvre: "" });
  };

  const handleChange = (field) => (e) => setInputs(prev => ({ ...prev, [field]: e.target.value }));
  
  const showToast = (msg, type = "success") => {
    setMessage({ text: msg, type });
    setTimeout(() => setMessage(null), 3000);
  };

  // --- CHART DATA ---
  const chartData = {
    labels: ["Béton", "Main d'œuvre"],
    datasets: [{
      data: [results.coutMateriaux, results.mo],
      backgroundColor: ["#eab308", "#f97316"], // Yellow, Orange
      borderColor: "#1f2937",
      borderWidth: 4,
    }]
  };

  return (
    <div className="w-full h-full flex flex-col bg-gray-900 text-gray-100 overflow-hidden relative">
      
      {/* Toast */}
      {message && (
        <div className={`fixed top-4 right-4 px-6 py-3 rounded-xl shadow-2xl z-50 font-bold ${message.type === "error" ? "bg-red-600" : "bg-yellow-600"}`}>
          {message.text}
        </div>
      )}

      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-yellow-600/20 rounded-lg text-yellow-500">
            <ArrowUpRight className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Escaliers</h2>
            <p className="text-xs text-gray-400">Paillasse & Marches</p>
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg px-4 py-2 border border-gray-700">
          <span className="text-xs text-gray-400 block">Total Estimé</span>
          <span className="text-lg font-black text-yellow-400">
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
              <h3 className="flex items-center gap-2 text-sm font-bold text-yellow-400 uppercase tracking-wider mb-4">
                <Ruler className="w-4 h-4" /> Géométrie
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <InputGroup label="Hauteur à franchir (m)" value={inputs.hauteurTotale} onChange={handleChange("hauteurTotale")} placeholder="Ex: 2.80" full />
                <InputGroup label="Largeur Escalier (m)" value={inputs.largeur} onChange={handleChange("largeur")} placeholder="Ex: 1.20" full />
                
                <InputGroup label="Hauteur Marche (m)" value={inputs.hauteurMarche} onChange={handleChange("hauteurMarche")} placeholder="0.17" />
                <InputGroup label="Giron (m)" value={inputs.giron} onChange={handleChange("giron")} placeholder="0.28" />
              </div>
            </div>

            {/* 2. Coûts */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5 shadow-lg flex-1 flex flex-col gap-4">
              <h3 className="flex items-center gap-2 text-sm font-bold text-gray-300 uppercase tracking-wider">
                <Banknote className="w-4 h-4 text-green-400" /> Coûts
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label={`Prix Béton (${currency}/m³)`} value={inputs.prixUnitaire} onChange={handleChange("prixUnitaire")} />
                <InputGroup label={`Main d'œuvre (${currency})`} value={inputs.coutMainOeuvre} onChange={handleChange("coutMainOeuvre")} />
              </div>

              <div className="flex gap-3 mt-auto pt-6">
                <button onClick={handleSave} className="flex-1 bg-gradient-to-r from-yellow-600 to-orange-600 hover:opacity-90 text-white py-3 rounded-xl font-bold shadow-lg active:scale-95 transition-all flex justify-center items-center gap-2">
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
              <ResultCard label="Volume Total" value={results.volumeTotal.toFixed(2)} unit="m³" icon="🧊" color="text-yellow-400" bg="bg-yellow-500/10" />
              <ResultCard label="Nb Marches" value={results.nbMarches} unit="u" icon="🪜" color="text-gray-300" bg="bg-gray-500/10" border />
              <ResultCard label="Acier" value={(results.acierT * 1000).toFixed(0)} unit="kg" icon={<Anchor className="w-4 h-4"/>} color="text-red-400" bg="bg-red-500/10" />
            </div>

            {/* Graphique & Détails */}
            <div className="flex-1 bg-gray-800 rounded-2xl p-6 border border-gray-700 shadow-xl flex flex-col md:flex-row gap-8 items-center relative overflow-hidden">
               <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-yellow-600/10 rounded-full blur-3xl pointer-events-none" />

               <div className="w-40 h-40 flex-shrink-0 relative">
                  <Doughnut data={chartData} options={{ cutout: "70%", plugins: { legend: { display: false } } }} />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                     <span className="text-sm font-bold text-yellow-400">Total</span>
                  </div>
               </div>

               <div className="flex-1 w-full space-y-3">
                  <h4 className="text-gray-400 text-sm font-medium border-b border-gray-700 pb-2">Matériaux (Dosage 350kg/m³)</h4>
                  <MaterialRow label="Ciment" val={`${results.cimentT.toFixed(2)} t`} color="bg-yellow-500" />
                  <MaterialRow label="Sable" val={`${results.sableT.toFixed(2)} t`} color="bg-amber-500" />
                  <MaterialRow label="Gravier" val={`${results.gravierT.toFixed(2)} t`} color="bg-stone-500" />
                  <MaterialRow label="Acier (80kg/m³)" val={`${results.acierT.toFixed(3)} t`} color="bg-red-500" />
                  
                  <div className="pt-2 border-t border-gray-700 flex justify-between items-center mt-2">
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Droplets className="w-3 h-3 text-blue-400" /> Eau
                    </span>
                    <span className="text-sm font-bold text-white">{results.eauL.toFixed(0)} L</span>
                  </div>
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
                    <div key={item.id} className="flex justify-between items-center bg-gray-700/30 p-2 rounded hover:bg-gray-700/50 transition border border-transparent hover:border-yellow-500/30">
                      <div className="flex flex-col">
                         <span className="text-[10px] text-gray-500">{item.date.split(',')[0]}</span>
                         <span className="text-xs text-gray-300">
                           {item.results.nbMarches} marches
                         </span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-bold text-yellow-400">{item.results.total.toLocaleString()} {currency}</span>
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
      className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-all font-mono text-sm"
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