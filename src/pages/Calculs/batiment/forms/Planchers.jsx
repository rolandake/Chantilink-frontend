import React, { useState, useEffect, useMemo } from 'react';
import { Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { 
  Layers, Ruler, Banknote, Save, Trash2, History, Anchor, Droplets, HardHat, Info
} from "lucide-react";

ChartJS.register(ArcElement, Tooltip, Legend);

const STORAGE_KEY = "planchers-history";

// Tes Ratios originaux
const RATIO = {
  cimentKg: 350,
  sableM3: 0.5,
  gravierM3: 0.9,
  eauL: 180,
  acierKg: 60,
  sableDensite: 1.6, // T/m3
  gravierDensite: 1.7, // T/m3
};

export default function Planchers({
  currency = "XOF",
  onTotalChange = () => {},
  onMateriauxChange = () => {},
}) {
  // --- ÉTATS ---
  const [inputs, setInputs] = useState({
    surface: "",
    epaisseur: "0.15",
    prixUnitaire: "",
    coutMainOeuvre: ""
  });
  const [historique, setHistorique] = useState([]);
  const [message, setMessage] = useState(null);

  // --- MOTEUR DE CALCUL ---
  const results = useMemo(() => {
    const s = parseFloat(inputs.surface) || 0;
    const e = parseFloat(inputs.epaisseur) || 0;
    const pu = parseFloat(inputs.prixUnitaire) || 0;
    const mo = parseFloat(inputs.coutMainOeuvre) || 0;

    const volume = s * e;

    // Matériaux
    const cimentKg = volume * RATIO.cimentKg;
    const cimentT = cimentKg / 1000;
    const cimentSacs = cimentKg / 50;

    const sableM3 = volume * RATIO.sableM3;
    const sableT = sableM3 * RATIO.sableDensite;

    const gravierM3 = volume * RATIO.gravierM3;
    const gravierT = gravierM3 * RATIO.gravierDensite;

    const eauL = volume * RATIO.eauL;
    const acierKg = volume * RATIO.acierKg;
    const acierT = acierKg / 1000;

    const total = (volume * pu) + mo;

    return {
      volume,
      cimentKg, cimentT, cimentSacs,
      sableM3, sableT,
      gravierM3, gravierT,
      eauL,
      acierKg, acierT,
      total
    };
  }, [inputs]);

  // --- SYNC PARENT ---
  useEffect(() => {
    onTotalChange(results.total);
    onMateriauxChange({
      ciment: results.cimentT,
      sable: results.sableT,
      gravier: results.gravierT,
      eau: results.eauL,
      acier: results.acierT,
    });
  }, [results, onTotalChange, onMateriauxChange]);

  // --- HISTORIQUE & EFFETS ---
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try { setHistorique(JSON.parse(saved)); } catch {}
    }
  }, []);

  const showToast = (text, type = "success") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleSave = () => {
    if (results.volume <= 0) return showToast("Veuillez entrer une surface", "error");
    
    const entry = {
      id: Date.now(),
      date: new Date().toLocaleString(),
      ...inputs,
      ...results
    };
    const newHist = [entry, ...historique];
    setHistorique(newHist);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newHist));
    showToast("Calcul enregistré !");
  };

  const clearHistorique = () => {
    if (window.confirm("Vider l'historique ?")) {
      setHistorique([]);
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const handleChange = (field) => (e) => setInputs(prev => ({ ...prev, [field]: e.target.value }));

  // --- CHART DATA (Poids en Tonnes) ---
  const chartData = {
    labels: ["Ciment", "Sable", "Gravier", "Acier"],
    datasets: [{
      data: [results.cimentT, results.sableT, results.gravierT, results.acierT],
      backgroundColor: ["#f59e0b", "#fbbf24", "#78716c", "#475569"],
      borderColor: "#111827",
      borderWidth: 2,
    }]
  };

  return (
    <div className="w-full h-full flex flex-col bg-gray-900 text-gray-100 overflow-hidden relative">
      
      {/* Toast Notification */}
      {message && (
        <div className={`fixed top-4 right-4 px-6 py-3 rounded-xl shadow-2xl z-50 font-bold animate-bounce ${
          message.type === "error" ? "bg-red-600" : "bg-amber-600"
        }`}>
          {message.text}
        </div>
      )}

      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-600/20 rounded-lg text-amber-500">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Plancher</h2>
            <p className="text-xs text-gray-400">Dalle & Béton de compression</p>
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg px-4 py-2 border border-gray-700">
          <span className="text-xs text-gray-400 block">Total Devis</span>
          <span className="text-lg font-black text-amber-400">
            {results.total.toLocaleString()} <span className="text-sm text-gray-500">{currency}</span>
          </span>
        </div>
      </div>

      {/* Main Scrollable Area */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* COLONNE GAUCHE : SAISIE */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5 shadow-lg">
              <h3 className="flex items-center gap-2 text-sm font-bold text-amber-400 uppercase tracking-wider mb-4">
                <Ruler className="w-4 h-4" /> Géométrie du plancher
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label="Surface (m²)" value={inputs.surface} onChange={handleChange("surface")} placeholder="ex: 120" />
                <InputGroup label="Épaisseur (m)" value={inputs.epaisseur} onChange={handleChange("epaisseur")} placeholder="ex: 0.15" />
              </div>
            </div>

            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5 shadow-lg flex-1">
              <h3 className="flex items-center gap-2 text-sm font-bold text-gray-300 uppercase tracking-wider mb-4">
                <Banknote className="w-4 h-4 text-green-400" /> Paramètres Financiers
              </h3>
              <div className="space-y-4">
                <InputGroup label={`Prix Unitaire Béton (${currency}/m³)`} value={inputs.prixUnitaire} onChange={handleChange("prixUnitaire")} placeholder="45000" />
                <InputGroup label={`Coût Main d'œuvre (${currency})`} value={inputs.coutMainOeuvre} onChange={handleChange("coutMainOeuvre")} placeholder="75000" />
              </div>

              <div className="flex gap-3 mt-8">
                <button 
                  onClick={handleSave}
                  className="flex-1 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white py-3 rounded-xl font-bold shadow-lg active:scale-95 transition-all flex justify-center items-center gap-2"
                >
                  <Save className="w-5 h-5" /> Enregistrer
                </button>
                <button 
                  onClick={() => setInputs({surface:"", epaisseur:"0.15", prixUnitaire:"", coutMainOeuvre:""})}
                  className="px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-xl transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* COLONNE DROITE : RÉSULTATS */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            
            {/* KPI Cards */}
            <div className="grid grid-cols-3 gap-4">
              <ResultCard label="Volume" value={results.volume.toFixed(2)} unit="m³" icon="🧊" color="text-amber-400" bg="bg-amber-500/10" />
              <ResultCard label="Ciment" value={results.cimentSacs.toFixed(1)} unit="sacs" icon="🧱" color="text-gray-100" bg="bg-gray-500/10" border />
              <ResultCard label="Acier" value={results.acierKg.toFixed(0)} unit="kg" icon={<Anchor className="w-4 h-4"/>} color="text-blue-400" bg="bg-blue-500/10" />
            </div>

            {/* Graph & Materials */}
            <div className="flex-1 bg-gray-800 rounded-2xl p-6 border border-gray-700 shadow-xl flex flex-col md:flex-row gap-8 items-center">
               <div className="w-44 h-44 flex-shrink-0 relative">
                  <Doughnut data={chartData} options={{ cutout: "70%", plugins: { legend: { display: false } } }} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                     <span className="text-[10px] text-gray-500 uppercase">Poids Total</span>
                     <span className="text-sm font-bold text-amber-500">
                      {(results.cimentT + results.sableT + results.gravierT + results.acierT).toFixed(1)} T
                     </span>
                  </div>
               </div>

               <div className="flex-1 w-full space-y-3">
                  <h4 className="text-gray-400 text-xs font-bold uppercase tracking-widest border-b border-gray-700 pb-2 mb-3">Détail des besoins</h4>
                  
                  <MaterialRow label="Ciment (350kg/m³)" val={`${results.cimentT.toFixed(2)} t`} color="bg-amber-500" />
                  <MaterialRow label="Sable (0.5m³/m³)" val={`${results.sableM3.toFixed(2)} m³`} sub={`${results.sableT.toFixed(2)} t`} color="bg-yellow-400" />
                  <MaterialRow label="Gravier (0.9m³/m³)" val={`${results.gravierM3.toFixed(2)} m³`} sub={`${results.gravierT.toFixed(2)} t`} color="bg-stone-500" />
                  <MaterialRow label="Acier (60kg/m³)" val={`${results.acierKg.toFixed(0)} kg`} color="bg-slate-600" />
                  
                  <div className="pt-2 border-t border-gray-700 flex justify-between items-center">
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Droplets className="w-3 h-3 text-cyan-400" /> Eau nécessaire
                    </span>
                    <span className="text-sm font-bold text-white font-mono">{results.eauL.toFixed(0)} L</span>
                  </div>
               </div>
            </div>

            {/* Historique Mini */}
            {historique.length > 0 && (
              <div className="bg-gray-800/40 rounded-2xl border border-gray-700/50 overflow-hidden">
                <div className="px-4 py-2 bg-gray-800/80 border-b border-gray-700/50 flex justify-between items-center">
                  <h4 className="text-[10px] font-bold text-gray-400 flex items-center gap-2 uppercase">
                    <History className="w-3 h-3" /> Historique des calculs
                  </h4>
                  <button onClick={clearHistorique} className="text-[10px] text-red-400 hover:text-red-300 flex items-center gap-1">
                    <Trash2 className="w-3 h-3" /> Vider
                  </button>
                </div>
                <div className="max-h-[160px] overflow-y-auto">
                  {historique.map((item) => (
                    <div key={item.id} className="flex justify-between items-center p-3 border-b border-gray-700/30 hover:bg-gray-700/20 transition-colors">
                      <div className="flex flex-col">
                         <span className="text-[10px] text-gray-500">{item.date}</span>
                         <span className="text-xs font-medium">Surf: {item.surface}m² | Vol: {item.volume}m³</span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-bold text-amber-400">{parseFloat(item.total).toLocaleString()} {currency}</span>
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

// --- SOUS-COMPOSANTS UTILES ---

const InputGroup = ({ label, value, onChange, placeholder, type = "number" }) => (
  <div className="flex flex-col">
    <label className="mb-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-wide">{label}</label>
    <input
      type={type}
      value={value}
      onChange={onChange}
      className="w-full bg-gray-900/50 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all font-mono text-sm"
      placeholder={placeholder || "0"}
    />
  </div>
);

const ResultCard = ({ label, value, unit, color, bg, border, icon }) => (
  <div className={`rounded-2xl p-4 flex flex-col justify-center items-center text-center shadow-inner ${bg} ${border ? 'border border-gray-700' : ''}`}>
    <div className="text-[10px] text-gray-400 uppercase tracking-tighter mb-1 flex items-center gap-1">
      {icon} {label}
    </div>
    <div className={`text-xl font-black ${color}`}>
      {value} <span className="text-xs font-normal text-gray-500 lowercase">{unit}</span>
    </div>
  </div>
);

const MaterialRow = ({ label, val, sub, color }) => (
  <div className="flex justify-between items-center group">
    <div className="flex items-center gap-2">
      <div className={`w-1.5 h-4 rounded-full ${color}`} />
      <span className="text-gray-300 text-sm">{label}</span>
    </div>
    <div className="flex flex-col items-end">
      <span className="text-sm font-bold text-white font-mono">{val}</span>
      {sub && <span className="text-[9px] text-gray-500 font-mono italic">{sub}</span>}
    </div>
  </div>
);