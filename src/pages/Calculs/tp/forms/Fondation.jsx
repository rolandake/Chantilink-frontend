import React, { useState, useEffect, useMemo } from "react";
import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { 
  BrickWall, Ruler, Banknote, Save, Trash2, History, Anchor, Droplets, Info, Target, Layers
} from "lucide-react";

ChartJS.register(ArcElement, Tooltip, Legend);

const STORAGE_KEY = "fondation-history-pro";

// Configuration Technique Bureau d'Études
const TYPES_FONDATION = {
  FILANTE: { label: "Semelle Filante (Mur)", acierRatio: 45, icon: "📏" }, // 45kg/m3
  ISOLEE: { label: "Semelle Isolée (Poteau)", acierRatio: 75, icon: "🟦" }, // 75kg/m3
};

const DOSAGES = {
  300: { label: "300 kg/m³", ciment: 0.3, sable: 0.6, gravier: 0.8 },
  350: { label: "350 kg/m³ (BA)", ciment: 0.35, sable: 0.55, gravier: 0.75 },
};

export default function Fondation({ currency = "XOF", onCostChange, onMateriauxChange }) {
  
  // --- ÉTATS ---
  const [inputs, setInputs] = useState({
    type: "FILANTE",
    dosage: "350",
    longueur: "",
    largeur: "",
    profondeur: "",
    prixUnitaire: "",
    coutMainOeuvre: ""
  });

  const [historique, setHistorique] = useState([]);
  const [message, setMessage] = useState(null);

  // --- MOTEUR DE CALCUL (BE) ---
  const results = useMemo(() => {
    const L = parseFloat(inputs.longueur) || 0;
    const l = parseFloat(inputs.largeur) || 0;
    const p = parseFloat(inputs.profondeur) || 0;
    const pu = parseFloat(inputs.prixUnitaire) || 0;
    const mo = parseFloat(inputs.coutMainOeuvre) || 0;

    const volume = L * l * p;
    const configDosage = DOSAGES[inputs.dosage];
    const configAcier = TYPES_FONDATION[inputs.type].acierRatio;

    // Matériaux
    const cimentT = volume * configDosage.ciment;
    const cimentSacs = (cimentT * 1000) / 50;
    const sableT = volume * configDosage.sable;
    const gravierT = volume * configDosage.gravier;
    const acierKg = volume * configAcier;
    const acierT = acierKg / 1000;
    const eauL = volume * 175; // Standard 175L/m3 pour BA

    // Coûts
    const coutMateriaux = volume * pu;
    const total = coutMateriaux + mo;

    return {
      volume,
      cimentT, cimentSacs,
      sableT, gravierT,
      acierKg, acierT,
      eauL,
      total,
      configAcier
    };
  }, [inputs]);

  // --- SYNC PARENT ---
  useEffect(() => {
    if (onCostChange) onCostChange(results.total);
    if (onMateriauxChange) {
      onMateriauxChange({
        volume: results.volume,
        ciment: results.cimentT,
        acier: results.acierT
      });
    }
  }, [results.total]);

  // --- HISTORIQUE ---
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) try { setHistorique(JSON.parse(saved)); } catch(e) {}
  }, []);

  const handleSave = () => {
    if (results.volume <= 0) return showToast("⚠️ Dimensions manquantes", "error");
    const newEntry = {
      id: Date.now(),
      date: new Date().toLocaleString(),
      typeLabel: TYPES_FONDATION[inputs.type].label,
      ...inputs,
      ...results
    };
    const newHist = [newEntry, ...historique];
    setHistorique(newHist);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newHist));
    showToast("✅ Fondation enregistrée !");
  };

  const showToast = (msg, type = "success") => {
    setMessage({ text: msg, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const chartData = {
    labels: ["Ciment", "Sable", "Gravier", "Acier"],
    datasets: [{
      data: [results.cimentT, results.sableT, results.gravierT, results.acierT],
      backgroundColor: ["#ef4444", "#fbbf24", "#78716c", "#3b82f6"],
      borderColor: "#111827",
      borderWidth: 2,
    }]
  };

  return (
    <div className="w-full h-full flex flex-col bg-gray-900 text-gray-100 overflow-hidden relative">
      
      {/* Toast */}
      {message && (
        <div className={`fixed top-4 right-4 px-6 py-3 rounded-xl shadow-2xl z-50 font-bold animate-in fade-in slide-in-from-top-2 ${
          message.type === "error" ? "bg-red-600" : "bg-emerald-600"
        }`}>
          {message.text}
        </div>
      )}

      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-600/20 rounded-lg text-red-500">
            <BrickWall className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white uppercase tracking-tight">Fondation</h2>
            <p className="text-xs text-gray-400 font-medium">Infrastructure & Gros Œuvre</p>
          </div>
        </div>
        <div className="bg-gray-800 rounded-xl px-4 py-2 border border-gray-700">
          <span className="text-[10px] text-gray-500 uppercase font-bold block">Total Estimé</span>
          <span className="text-xl font-black text-red-500">
            {results.total.toLocaleString()} <span className="text-sm font-normal text-gray-500">{currency}</span>
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-6 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
          
          {/* GAUCHE : SAISIE (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            
            {/* 1. Type & Dosage */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5">
              <h3 className="flex items-center gap-2 text-xs font-bold text-red-500 uppercase tracking-widest mb-4">
                <Target className="w-4 h-4" /> Configuration Technique
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(TYPES_FONDATION).map(([key, f]) => (
                  <button
                    key={key}
                    onClick={() => setInputs({...inputs, type: key})}
                    className={`p-3 rounded-xl border text-left transition-all flex flex-col ${
                      inputs.type === key ? "border-red-500 bg-red-500/10" : "border-gray-700 bg-gray-800"
                    }`}
                  >
                    <span className="text-lg mb-1">{f.icon}</span>
                    <span className={`text-[10px] font-bold uppercase ${inputs.type === key ? "text-red-400" : "text-gray-500"}`}>{f.label}</span>
                  </button>
                ))}
              </div>
              <div className="mt-4">
                <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1.5 ml-1">Dosage Ciment</label>
                <div className="flex gap-2">
                  {Object.entries(DOSAGES).map(([kg, d]) => (
                    <button
                      key={kg}
                      onClick={() => setInputs({...inputs, dosage: kg})}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${
                        inputs.dosage === kg ? "bg-gray-200 text-gray-900 border-white" : "bg-gray-900 text-gray-400 border-gray-700"
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 2. Géométrie */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5">
              <h3 className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
                <Ruler className="w-4 h-4" /> Dimensions (m)
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label="Longueur" value={inputs.longueur} onChange={v => setInputs({...inputs, longueur: v})} />
                <InputGroup label="Largeur" value={inputs.largeur} onChange={v => setInputs({...inputs, largeur: v})} />
                <InputGroup label="Épaisseur / Prof." value={inputs.profondeur} onChange={v => setInputs({...inputs, profondeur: v})} full />
              </div>
            </div>

            {/* 3. Coûts */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5 flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label={`Prix Béton (${currency}/m³)`} value={inputs.prixUnitaire} onChange={v => setInputs({...inputs, prixUnitaire: v})} />
                <InputGroup label={`Main d'œuvre (${currency})`} value={inputs.coutMainOeuvre} onChange={v => setInputs({...inputs, coutMainOeuvre: v})} />
              </div>
              <button 
                onClick={handleSave}
                className="w-full bg-red-600 hover:bg-red-500 text-white py-4 rounded-xl font-bold shadow-lg transition-all flex justify-center items-center gap-2 active:scale-95"
              >
                <Save className="w-5 h-5" /> Enregistrer le calcul
              </button>
            </div>
          </div>

          {/* DROITE : RÉSULTATS (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            
            <div className="grid grid-cols-3 gap-4">
              <ResultCard label="Volume Béton" value={results.volume.toFixed(2)} unit="m³" icon={<Layers className="w-4 h-4"/>} color="text-red-400" bg="bg-red-500/10" />
              <ResultCard label="Ciment requis" value={results.cimentSacs.toFixed(1)} unit="sacs" icon="🧱" color="text-white" bg="bg-gray-800" border />
              <ResultCard label="Acier HA" value={Math.ceil(results.acierKg)} unit="kg" icon={<Anchor className="w-4 h-4"/>} color="text-blue-400" bg="bg-blue-500/10" />
            </div>

            <div className="flex-1 bg-gray-800 rounded-3xl p-8 border border-gray-700 shadow-xl flex flex-col md:flex-row gap-10 items-center relative overflow-hidden">
               <div className="absolute -top-10 -right-10 w-40 h-40 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />

               <div className="w-48 h-48 flex-shrink-0 relative">
                  <Doughnut data={chartData} options={{ cutout: "75%", plugins: { legend: { display: false } } }} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                     <span className="text-[10px] text-gray-500 uppercase font-bold">Poids Total</span>
                     <span className="text-sm font-bold text-white">{(results.cimentT + results.sableT + results.gravierT + results.acierT).toFixed(1)} T</span>
                  </div>
               </div>

               <div className="flex-1 w-full space-y-4">
                  <h4 className="text-gray-400 text-xs font-bold uppercase tracking-widest border-b border-gray-700 pb-2">Récapitulatif Fournitures</h4>
                  
                  <MaterialRow label="Ciment" val={`${results.cimentT.toFixed(2)} t`} color="bg-red-500" />
                  <MaterialRow label="Sable" val={`${results.sableT.toFixed(2)} t`} color="bg-amber-400" />
                  <MaterialRow label="Gravier" val={`${results.gravierT.toFixed(2)} t`} color="bg-stone-500" />
                  <MaterialRow label={`Acier (${results.configAcier}kg/m³)`} val={`${results.acierKg.toFixed(0)} kg`} color="bg-blue-500" />
                  
                  <div className="pt-2 border-t border-gray-700 flex justify-between items-center">
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Droplets className="w-3 h-3 text-cyan-400" /> Eau nécessaire
                    </span>
                    <span className="text-sm font-bold text-white font-mono">{results.eauL.toFixed(0)} L</span>
                  </div>

                  <div className="flex items-start gap-2 p-3 bg-blue-500/5 rounded-lg border border-blue-500/20">
                    <Info className="w-4 h-4 text-blue-400 mt-0.5" />
                    <p className="text-[10px] text-blue-200/70 leading-relaxed italic">
                      Les dosages sont calculés pour un béton de structure. Le ratio d'acier inclut les armatures principales et les cadres.
                    </p>
                  </div>
               </div>
            </div>

            {/* Historique */}
            {historique.length > 0 && (
              <div className="bg-gray-800/30 rounded-2xl border border-gray-700/50 overflow-hidden flex-1 min-h-[150px]">
                <div className="px-4 py-3 bg-gray-800/50 border-b border-gray-700/50 flex justify-between items-center">
                  <h4 className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2"><History className="w-3 h-3" /> Historique</h4>
                </div>
                <div className="overflow-y-auto max-h-[120px]">
                  {historique.slice(0, 5).map((item) => (
                    <div key={item.id} className="flex justify-between items-center p-3 border-b border-gray-700/30 hover:bg-gray-700/40">
                      <div className="text-xs">
                        <span className="text-gray-500 block text-[9px]">{item.date}</span>
                        <span className="font-medium">{item.typeLabel} - {item.volume.toFixed(1)} m³</span>
                      </div>
                      <span className="text-sm font-bold text-red-400">{parseFloat(item.total).toLocaleString()} {currency}</span>
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

const InputGroup = ({ label, value, onChange, full = false }) => (
  <div className={`flex flex-col ${full ? "col-span-2" : ""}`}>
    <label className="mb-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-wide">{label}</label>
    <input
      type="number"
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full bg-gray-900 border border-gray-600 rounded-xl px-4 py-2.5 text-white focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all font-mono text-sm"
      placeholder="0"
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