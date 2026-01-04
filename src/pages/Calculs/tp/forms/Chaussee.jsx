import React, { useState, useEffect, useMemo } from "react";
import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS, ArcElement, Tooltip, Legend,
} from "chart.js";
import { 
  Layers, Ruler, Banknote, Save, Trash2, History, Truck, Info, MoveRight, HardHat
} from "lucide-react";

ChartJS.register(ArcElement, Tooltip, Legend);

const STORAGE_KEY = "chaussee-history-pro";

// Densités professionnelles Bureau d'Études (T/m3)
const DENSITIES = {
  fondation: 2.00, // GNT (Grave Non Traitée)
  base: 2.35,      // GB (Grave Bitume)
  roulement: 2.35  // BB (Béton Bitumineux)
};

export default function Chaussee({ currency = "XOF", onCostChange, onMateriauxChange }) {
  
  // --- ÉTATS ---
  const [inputs, setInputs] = useState({
    longueur: "",
    largeur: "",
    epaisseurFondation: "20", // cm
    epaisseurBase: "10",      // cm
    epaisseurRoulement: "5",  // cm
    prixFondation: "",  
    prixBase: "",       
    prixRoulement: "",  
    coutMainOeuvre: ""  
  });

  const [historique, setHistorique] = useState([]);
  const [message, setMessage] = useState(null);

  // --- MOTEUR DE CALCUL TECHNIQUE ---
  const results = useMemo(() => {
    const L = parseFloat(inputs.longueur) || 0;
    const l = parseFloat(inputs.largeur) || 0;
    const surface = L * l;

    const eFond = (parseFloat(inputs.epaisseurFondation) || 0) / 100;
    const eBase = (parseFloat(inputs.epaisseurBase) || 0) / 100;
    const eRoul = (parseFloat(inputs.epaisseurRoulement) || 0) / 100;

    // Tonnages (T) = Surface * Épaisseur * Densité
    const tonRoul = surface * eRoul * DENSITIES.roulement;
    const tonBase = surface * eBase * DENSITIES.base;
    const tonFond = surface * eFond * DENSITIES.fondation;

    // Coûts
    const coutRoul = tonRoul * (parseFloat(inputs.prixRoulement) || 0);
    const coutBase = tonBase * (parseFloat(inputs.prixBase) || 0);
    const coutFond = tonFond * (parseFloat(inputs.prixFondation) || 0);
    const coutMO = parseFloat(inputs.coutMainOeuvre) || 0;

    const total = coutRoul + coutBase + coutFond + coutMO;

    return {
      surface,
      tonRoul, tonBase, tonFond,
      coutRoul, coutBase, coutFond, coutMO,
      total,
      tonnageTotal: tonRoul + tonBase + tonFond
    };
  }, [inputs]);

  // --- SYNC PARENT ---
  useEffect(() => {
    onCostChange(results.total);
    if (onMateriauxChange) {
      onMateriauxChange({
        surface: results.surface,
        tonnageTotal: results.tonnageTotal,
        enrobe: results.tonRoul
      });
    }
  }, [results.total]);

  // --- HISTORIQUE ---
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) try { setHistorique(JSON.parse(saved)); } catch(e) {}
  }, []);

  const handleSave = () => {
    if (results.total <= 0) return showToast("⚠️ Données incomplètes", "error");
    const newEntry = {
      id: Date.now(),
      date: new Date().toLocaleString(),
      ...inputs, ...results
    };
    const newHist = [newEntry, ...historique];
    setHistorique(newHist);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newHist));
    showToast("✅ Structure sauvegardée !");
  };

  const showToast = (msg, type = "success") => {
    setMessage({ text: msg, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const chartData = {
    labels: ["Roulement (BB)", "Base (GB)", "Fondation (GNT)", "Pose"],
    datasets: [{
      data: [results.coutRoul, results.coutBase, results.coutFond, results.coutMO],
      backgroundColor: ["#a855f7", "#f97316", "#fbbf24", "#374151"],
      borderColor: "#111827",
      borderWidth: 2,
    }]
  };

  return (
    <div className="w-full h-full flex flex-col bg-gray-900 text-gray-100 overflow-hidden relative font-sans">
      
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
          <div className="p-2 bg-purple-600/20 rounded-lg text-purple-500">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white uppercase tracking-tight">Corps de Chaussée</h2>
            <p className="text-xs text-gray-400 font-medium">Dimensionnement & Tonnages</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-gray-500 uppercase font-bold block">Budget Total</span>
          <span className="text-2xl font-black text-purple-400 tracking-tighter">
            {results.total.toLocaleString()} <span className="text-sm text-gray-500 font-normal">{currency}</span>
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-6 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
          
          {/* GAUCHE : PARAMÈTRES (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            
            {/* 1. Géométrie */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5 shadow-lg">
              <h3 className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
                <Ruler className="w-4 h-4" /> Géométrie du Tronçon
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label="Linéaire (m)" value={inputs.longueur} onChange={v => setInputs({...inputs, longueur: v})} placeholder="Ex: 1000" />
                <InputGroup label="Largeur (m)" value={inputs.largeur} onChange={v => setInputs({...inputs, largeur: v})} placeholder="Ex: 7.00" />
              </div>
            </div>

            {/* 2. Structure multicouche (Visual Stack) */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-3xl p-5 shadow-lg space-y-4">
              <h3 className="flex items-center gap-2 text-xs font-bold text-purple-400 uppercase tracking-widest mb-2">
                <HardHat className="w-4 h-4" /> Constitution du corps
              </h3>
              
              {/* Couche de Roulement */}
              <div className="p-4 bg-purple-500/5 border border-purple-500/20 rounded-2xl relative">
                <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-1 h-8 bg-purple-500 rounded-full" />
                <span className="text-[10px] font-black text-purple-400 uppercase">1. Roulement (Béton Bitumineux)</span>
                <div className="grid grid-cols-2 gap-3 mt-2">
                   <InputGroup label="Ép. (cm)" value={inputs.epaisseurRoulement} onChange={v => setInputs({...inputs, epaisseurRoulement: v})} />
                   <InputGroup label={`Prix (${currency}/T)`} value={inputs.prixRoulement} onChange={v => setInputs({...inputs, prixRoulement: v})} />
                </div>
              </div>

              {/* Couche de Base */}
              <div className="p-4 bg-orange-500/5 border border-orange-500/20 rounded-2xl relative">
                <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-1 h-8 bg-orange-500 rounded-full" />
                <span className="text-[10px] font-black text-orange-400 uppercase">2. Base (Grave Bitume)</span>
                <div className="grid grid-cols-2 gap-3 mt-2">
                   <InputGroup label="Ép. (cm)" value={inputs.epaisseurBase} onChange={v => setInputs({...inputs, epaisseurBase: v})} />
                   <InputGroup label={`Prix (${currency}/T)`} value={inputs.prixBase} onChange={v => setInputs({...inputs, prixBase: v})} />
                </div>
              </div>

              {/* Couche de Fondation */}
              <div className="p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-2xl relative">
                <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-1 h-8 bg-yellow-500 rounded-full" />
                <span className="text-[10px] font-black text-yellow-400 uppercase">3. Fondation (GNT)</span>
                <div className="grid grid-cols-2 gap-3 mt-2">
                   <InputGroup label="Ép. (cm)" value={inputs.epaisseurFondation} onChange={v => setInputs({...inputs, epaisseurFondation: v})} />
                   <InputGroup label={`Prix (${currency}/T)`} value={inputs.prixFondation} onChange={v => setInputs({...inputs, prixFondation: v})} />
                </div>
              </div>

              <div className="pt-4 border-t border-gray-700">
                 <InputGroup label={`Main d'œuvre Globale (${currency})`} value={inputs.coutMainOeuvre} onChange={v => setInputs({...inputs, coutMainOeuvre: v})} />
              </div>

              <button onClick={handleSave} className="w-full bg-purple-600 hover:bg-purple-500 text-white py-4 rounded-2xl font-bold shadow-lg transition-all flex justify-center items-center gap-2 active:scale-95">
                <Save className="w-5 h-5" /> Enregistrer la structure
              </button>
            </div>
          </div>

          {/* DROITE : RÉSULTATS (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            
            {/* KPIs */}
            <div className="grid grid-cols-3 gap-4">
              <ResultCard label="Surface Totale" value={results.surface.toFixed(0)} unit="m²" icon={<Ruler className="w-4 h-4"/>} color="text-blue-400" bg="bg-blue-500/10" />
              <ResultCard label="Tonnage Global" value={results.tonnageTotal.toFixed(1)} unit="T" icon={<Truck className="w-4 h-4"/>} color="text-purple-400" bg="bg-purple-500/10" border />
              <ResultCard label="Prix Moyen / m²" value={(results.total / (results.surface || 1)).toFixed(0)} unit={currency} icon={<Banknote className="w-4 h-4"/>} color="text-emerald-400" bg="bg-emerald-500/10" />
            </div>

            {/* Graphique et Détails */}
            <div className="flex-1 bg-gray-800 rounded-3xl p-8 border border-gray-700 shadow-xl flex flex-col md:flex-row gap-10 items-center relative overflow-hidden">
               <div className="absolute -bottom-10 -right-10 w-44 h-44 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

               <div className="w-48 h-48 flex-shrink-0 relative">
                  <Doughnut data={chartData} options={{ cutout: "75%", plugins: { legend: { display: false } } }} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                     <span className="text-[10px] text-gray-500 uppercase font-bold">Total Masse</span>
                     <span className="text-sm font-bold text-white">{results.tonnageTotal.toFixed(1)} T</span>
                  </div>
               </div>

               <div className="flex-1 w-full space-y-4">
                  <h4 className="text-gray-400 text-xs font-bold uppercase tracking-widest border-b border-gray-700 pb-2 mb-2">Bilan par couche</h4>
                  
                  <MaterialRow label="Roulement (BB)" val={`${results.tonRoul.toFixed(1)} T`} cost={`${results.coutRoul.toLocaleString()} ${currency}`} color="bg-purple-500" />
                  <MaterialRow label="Base (GB)" val={`${results.tonBase.toFixed(1)} T`} cost={`${results.coutBase.toLocaleString()} ${currency}`} color="bg-orange-500" />
                  <MaterialRow label="Fondation (GNT)" val={`${results.tonFond.toFixed(1)} T`} cost={`${results.coutFond.toLocaleString()} ${currency}`} color="bg-yellow-500" />
                  
                  <div className="flex items-start gap-2 p-3 bg-blue-500/5 rounded-xl border border-blue-500/20 mt-4">
                    <Info className="w-4 h-4 text-blue-400 mt-0.5" />
                    <p className="text-[10px] text-blue-200/70 leading-relaxed italic">
                      Les tonnages sont calculés avec une densité de 2.35 pour le bitume et 2.00 pour la grave non traitée.
                    </p>
                  </div>
               </div>
            </div>

            {/* Historique Mini */}
            {historique.length > 0 && (
              <div className="bg-gray-800/30 rounded-2xl border border-gray-700/50 overflow-hidden">
                <div className="px-4 py-2 bg-gray-800/50 border-b border-gray-700/50 flex justify-between items-center">
                  <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2"><History className="w-3 h-3" /> Historique récent</h4>
                </div>
                <div className="max-h-[120px] overflow-y-auto">
                  {historique.slice(0, 5).map((item) => (
                    <div key={item.id} className="flex justify-between items-center p-3 border-b border-gray-700/30 hover:bg-gray-700/40 transition-colors">
                      <div className="text-xs">
                        <span className="text-gray-500 block text-[9px]">{item.date}</span>
                        <span className="font-medium">{item.longueur}m x {item.largeur}m • {item.tonnageTotal.toFixed(1)}T</span>
                      </div>
                      <span className="text-sm font-bold text-purple-400">{parseFloat(item.total).toLocaleString()} {currency}</span>
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
      type="number" value={value || ""} onChange={e => onChange(e.target.value)}
      className="w-full bg-gray-900 border border-gray-600 rounded-xl px-4 py-2.5 text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all font-mono text-sm"
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

const MaterialRow = ({ label, val, cost, color }) => (
  <div className="flex flex-col border-b border-gray-700/30 pb-2 last:border-0 group">
    <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
            <div className={`w-1.5 h-3 rounded-full ${color}`} />
            <span className="text-gray-300 text-xs font-medium">{label}</span>
        </div>
        <span className="text-xs font-bold text-white font-mono">{val}</span>
    </div>
    <div className="flex justify-end mt-0.5">
        <span className="text-[10px] text-gray-500 font-mono italic">{cost}</span>
    </div>
  </div>
);