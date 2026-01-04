import React, { useState, useEffect, useMemo } from "react";
import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { 
  Square, Ruler, Banknote, Save, Trash2, History, Anchor, Droplets, Layers, Info, Target 
} from "lucide-react";

ChartJS.register(ArcElement, Tooltip, Legend);

const STORAGE_KEY = "dalles-history-pro";

// Configuration Technique
const TYPES_DALLES = {
  TERRE_PLEIN: { label: "Dallage sol (Terre-plein)", acier: 40, icon: "🚜", desc: "Ferraillage léger (Treillis)" },
  ETAGE: { label: "Dalle pleine (Étage)", acier: 80, icon: "🏗️", desc: "Ferraillage structurel suspendu" },
};

const DOSAGE = {
  ciment: 0.350, // 350kg/m3
  sable: 0.6,    // T/m3
  gravier: 0.85, // T/m3
  eau: 175       // L/m3
};

export default function Dalles({ currency = "XOF", onTotalChange, onMateriauxChange }) {
  
  // --- ÉTATS ---
  const [typeDalle, setTypeDalle] = useState("ETAGE");
  const [inputs, setInputs] = useState({
    longueur: "",
    largeur: "",
    epaisseur: "0.15",
    prixUnitaire: "",
    coutMainOeuvre: "",
    marge: "5" // 5% de perte par défaut
  });

  const [historique, setHistorique] = useState([]);
  const [message, setMessage] = useState(null);

  // --- MOTEUR DE CALCUL ---
  const results = useMemo(() => {
    const L = parseFloat(inputs.longueur) || 0;
    const l = parseFloat(inputs.largeur) || 0;
    const e = parseFloat(inputs.epaisseur) || 0;
    const margeCoef = 1 + (parseFloat(inputs.marge) || 0) / 100;

    const surface = L * l;
    const volumeGeo = surface * e;
    const volumeFinal = volumeGeo * margeCoef;

    // Acier selon type
    const ratioAcier = TYPES_DALLES[typeDalle].acier;
    const acierKg = volumeFinal * ratioAcier;
    const acierT = acierKg / 1000;

    // Matériaux
    const cimentT = volumeFinal * DOSAGE.ciment;
    const cimentSacs = (cimentT * 1000) / 50;
    const sableT = volumeFinal * DOSAGE.sable;
    const gravierT = volumeFinal * DOSAGE.gravier;
    const eauL = volumeFinal * DOSAGE.eau;

    // Coûts
    const pu = parseFloat(inputs.prixUnitaire) || 0;
    const mo = parseFloat(inputs.coutMainOeuvre) || 0;
    const total = (volumeFinal * pu) + mo;

    return {
      surface,
      volumeGeo,
      volumeFinal,
      cimentT, cimentSacs,
      sableT, gravierT, acierT, acierKg, eauL,
      total, ratioAcier
    };
  }, [inputs, typeDalle]);

  // --- SYNC PARENT ---
  useEffect(() => {
    if (onTotalChange) onTotalChange(results.total);
    if (onMateriauxChange) {
      onMateriauxChange({
        volume: results.volumeFinal,
        ciment: results.cimentT,
        acier: results.acierT
      });
    }
  }, [results.total, results.volumeFinal, results.cimentT, results.acierT, onTotalChange, onMateriauxChange]);

  // --- HISTORIQUE ---
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try { setHistorique(JSON.parse(saved)); } catch {}
    }
  }, []);

  const handleSave = () => {
    if (results.surface <= 0) return showToast("⚠️ Dimensions manquantes", "error");
    
    const newEntry = {
      id: Date.now(),
      date: new Date().toLocaleString(),
      type: TYPES_DALLES[typeDalle].label,
      ...inputs,
      ...results
    };

    const newHist = [newEntry, ...historique];
    setHistorique(newHist);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newHist));
    showToast("✅ Dalle enregistrée !");
  };

  const showToast = (msg, type = "success") => {
    setMessage({ text: msg, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const chartData = {
    labels: ["Béton", "Acier"],
    datasets: [{
      data: [results.total - results.mo, (results.acierKg * 500) / 100], // Approximation
      backgroundColor: ["#f43f5e", "#ef4444"],
      borderColor: "#111827",
      borderWidth: 2,
    }]
  };

  return (
    <div className="w-full h-full flex flex-col bg-gray-900 text-gray-100 overflow-hidden relative">
      
      {message && (
        <div className={`fixed top-4 right-4 px-6 py-3 rounded-xl shadow-2xl z-50 font-bold animate-in fade-in slide-in-from-top-2 ${
          message.type === "error" ? "bg-red-600" : "bg-rose-600"
        }`}>
          {message.text}
        </div>
      )}

      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-rose-600/20 rounded-lg text-rose-500">
            <Square className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Élévation : Dalles</h2>
            <p className="text-xs text-gray-400">Planchers pleins & Dallages</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-gray-500 uppercase font-bold block">Estimation Dalle</span>
          <span className="text-2xl font-black text-rose-400 tracking-tighter">
            {results.total.toLocaleString()} <span className="text-sm text-gray-500 font-normal">{currency}</span>
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-6 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
          
          {/* GAUCHE : INPUTS */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            
            {/* Type Selector */}
            <div className="grid grid-cols-2 gap-2 bg-gray-800 p-1.5 rounded-xl border border-gray-700">
              {Object.entries(TYPES_DALLES).map(([id, t]) => (
                <button
                  key={id}
                  onClick={() => setTypeDalle(id)}
                  className={`flex flex-col items-center justify-center py-2 rounded-lg transition-all ${
                    typeDalle === id 
                      ? "bg-rose-600 text-white shadow-lg" 
                      : "text-gray-400 hover:text-white hover:bg-gray-700"
                  }`}
                >
                  <span className="text-xs font-bold">{t.icon} {t.label}</span>
                  <span className="text-[9px] opacity-60 tracking-tighter">{t.desc}</span>
                </button>
              ))}
            </div>

            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5 shadow-lg space-y-4">
              <h3 className="flex items-center gap-2 text-[10px] font-bold text-rose-400 uppercase tracking-widest">
                <Ruler className="w-3 h-3" /> Dimensions (m)
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label="Longueur" value={inputs.longueur} onChange={v => setInputs({...inputs, longueur: v})} />
                <InputGroup label="Largeur" value={inputs.largeur} onChange={v => setInputs({...inputs, largeur: v})} />
                <InputGroup label="Épaisseur" value={inputs.epaisseur} onChange={v => setInputs({...inputs, epaisseur: v})} placeholder="Ex: 0.15" full />
              </div>
            </div>

            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5 shadow-lg space-y-4 flex-1">
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label={`PU Béton (${currency}/m³)`} value={inputs.prixUnitaire} onChange={v => setInputs({...inputs, prixUnitaire: v})} />
                <InputGroup label="Pertes (%)" value={inputs.marge} onChange={v => setInputs({...inputs, marge: v})} />
              </div>
              <button onClick={handleSave} className="w-full mt-6 bg-rose-600 hover:bg-rose-500 text-white py-4 rounded-xl font-bold shadow-lg transition-all flex justify-center items-center gap-2">
                <Save className="w-5 h-5" /> Enregistrer Dalle
              </button>
            </div>
          </div>

          {/* DROITE : RÉSULTATS */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            
            <div className="grid grid-cols-3 gap-4">
              <ResultCard label="Volume Brut" value={results.volumeFinal.toFixed(2)} unit="m³" icon="🧊" color="text-rose-400" bg="bg-rose-500/10" />
              <ResultCard label="Coffrage" value={results.surface.toFixed(1)} unit="m²" icon={<Layers className="w-4 h-4"/>} color="text-indigo-400" bg="bg-indigo-500/10" border />
              <ResultCard label="Acier (HA/TS)" value={results.acierKg.toFixed(0)} unit="kg" icon={<Target className="w-4 h-4"/>} color="text-red-400" bg="bg-red-500/10" />
            </div>

            <div className="flex-1 bg-gray-800 rounded-2xl p-6 border border-gray-700 shadow-xl flex flex-col md:flex-row gap-8 items-center relative overflow-hidden">
               <div className="w-40 h-40 flex-shrink-0 relative">
                  <Doughnut data={chartData} options={{ cutout: "75%", plugins: { legend: { display: false } } }} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                     <span className="text-[10px] text-gray-500 uppercase font-bold">Ciment</span>
                     <span className="text-sm font-bold text-white">{results.cimentSacs.toFixed(1)} sacs</span>
                  </div>
               </div>

               <div className="flex-1 w-full space-y-3">
                  <h4 className="text-gray-400 text-xs font-bold uppercase tracking-widest border-b border-gray-700 pb-2 mb-2">Analyse Technique</h4>
                  <MaterialRow label="Ciment (350kg/m³)" val={`${results.cimentT.toFixed(2)} t`} color="bg-rose-500" />
                  <MaterialRow label="Sable (0.6 t/m³)" val={`${results.sableT.toFixed(2)} t`} color="bg-amber-500" />
                  <MaterialRow label="Gravier (0.85 t/m³)" val={`${results.gravierT.toFixed(2)} t`} color="bg-stone-500" />
                  <MaterialRow label={`Acier (${results.ratioAcier}kg/m³)`} val={`${results.acierKg.toFixed(0)} kg`} color="bg-red-500" />
                  
                  <div className="pt-2 border-t border-gray-700 flex justify-between items-center mt-2">
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Droplets className="w-3 h-3 text-cyan-400" /> Eau nécessaire
                    </span>
                    <span className="text-sm font-bold text-white font-mono">{results.eauL.toFixed(0)} L</span>
                  </div>

                  <div className="flex items-start gap-2 p-3 bg-rose-500/5 rounded-lg border border-rose-500/20">
                    <Info className="w-4 h-4 text-rose-400 mt-0.5" />
                    <p className="text-[10px] text-rose-200/70 leading-relaxed italic">
                      Pour une dalle d'étage, prévoyez environ 1 étai par m² pour supporter le poids du béton frais.
                    </p>
                  </div>
               </div>
            </div>

            {/* Historique Mini */}
            {historique.length > 0 && (
              <div className="bg-gray-800/30 rounded-2xl border border-gray-700/50 overflow-hidden">
                <div className="px-4 py-2 bg-gray-800/50 border-b border-gray-700/50 flex justify-between items-center">
                  <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2"><History className="w-3 h-3" /> Historique</h4>
                </div>
                <div className="max-h-[100px] overflow-y-auto">
                  {historique.slice(0, 5).map((item) => (
                    <div key={item.id} className="flex justify-between items-center p-3 border-b border-gray-700/30">
                      <div className="text-xs">
                        <span className="text-gray-500 text-[9px] block">{item.date}</span>
                        {item.type} - {item.surface.toFixed(1)} m²
                      </div>
                      <span className="text-sm font-bold text-rose-500">{parseFloat(item.total).toLocaleString()} {currency}</span>
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
    <label className="mb-1 text-[10px] font-bold text-gray-500 uppercase">{label}</label>
    <input
      type="number"
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full bg-gray-900 border border-gray-600 rounded-xl px-4 py-2.5 text-white focus:border-rose-500 outline-none font-mono text-sm"
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
  <div className="flex justify-between items-center border-b border-gray-700/30 pb-2 last:border-0">
    <div className="flex items-center gap-2">
      <div className={`w-1.5 h-1.5 rounded-full ${color}`} />
      <span className="text-gray-300 text-xs font-medium">{label}</span>
    </div>
    <span className="text-xs font-bold text-white font-mono">{val}</span>
  </div>
);