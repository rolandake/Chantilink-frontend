import React, { useState, useEffect, useMemo } from "react";
import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { 
  Grid, Ruler, Banknote, Save, Trash2, History, Anchor, Droplets, Layers, Info, Target
} from "lucide-react";

ChartJS.register(ArcElement, Tooltip, Legend);

const STORAGE_KEY = "poutres-history-pro";

// Configuration Technique
const TYPES_POUTRES = {
  SECONDAIRE: { label: "Poutre Secondaire (Chaînage)", acier: 100, icon: "🔗" },
  PRINCIPALE: { label: "Poutre Principale (Porteuse)", acier: 150, icon: "🏗️" },
};

const DOSAGE_BETON = {
  ciment: 0.350, // 350kg/m3
  sable: 0.6,    // T/m3
  gravier: 0.85, // T/m3
  eau: 175       // L/m3
};

export default function Poutres({ currency = "XOF", onTotalChange, onMateriauxChange }) {
  
  // --- ÉTATS ---
  const [inputs, setInputs] = useState({
    type: "PRINCIPALE",
    nombre: "1",
    longueur: "",
    largeur: "",
    hauteur: "",
    prixUnitaire: "",
    coutMainOeuvre: "",
    marge: "10" // 10% de marge par défaut (recouvrements aciers)
  });

  const [historique, setHistorique] = useState([]);
  const [message, setMessage] = useState(null);

  // --- MOTEUR DE CALCUL ---
  const results = useMemo(() => {
    const nb = parseFloat(inputs.nombre) || 0;
    const L = parseFloat(inputs.longueur) || 0;
    const l = parseFloat(inputs.largeur) || 0;
    const h = parseFloat(inputs.hauteur) || 0;
    const margeCoef = 1 + (parseFloat(inputs.marge) || 0) / 100;

    const volumeGeo = L * l * h * nb;
    const volumeFinal = volumeGeo * margeCoef;

    // Coffrage : (Base + 2 x Hauteur) x Longueur x Nombre
    const surfaceCoffrage = (l + (2 * h)) * L * nb;

    // Acier selon type
    const ratioAcier = TYPES_POUTRES[inputs.type].acier;
    const acierKg = volumeFinal * ratioAcier;
    const acierT = acierKg / 1000;

    // Matériaux
    const cimentT = volumeFinal * DOSAGE_BETON.ciment;
    const cimentSacs = (cimentT * 1000) / 50;
    const sableT = volumeFinal * DOSAGE_BETON.sable;
    const gravierT = volumeFinal * DOSAGE_BETON.gravier;
    const eauL = volumeFinal * DOSAGE_BETON.eau;

    // Coûts
    const pu = parseFloat(inputs.prixUnitaire) || 0;
    const mo = parseFloat(inputs.coutMainOeuvre) || 0;
    const total = (volumeFinal * pu) + mo;

    return {
      volumeGeo,
      volumeFinal,
      surfaceCoffrage,
      cimentT, cimentSacs,
      sableT, gravierT, acierT, acierKg, eauL,
      total, ratioAcier
    };
  }, [inputs]);

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
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setHistorique(JSON.parse(saved));
    } catch {}
  }, []);

  const handleSave = () => {
    if (results.volumeGeo <= 0) return showToast("⚠️ Dimensions manquantes", "error");
    
    const newEntry = {
      id: Date.now(),
      date: new Date().toLocaleString(),
      typeLabel: TYPES_POUTRES[inputs.type].label,
      ...inputs,
      ...results
    };

    const newHist = [newEntry, ...historique];
    setHistorique(newHist);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newHist));
    showToast("✅ Poutres enregistrées !");
  };

  const showToast = (msg, type = "success") => {
    setMessage({ text: msg, type });
    setTimeout(() => setMessage(null), 3000);
  };

  // --- CHART DATA ---
  const chartData = {
    labels: ["Béton", "Acier", "Autres"],
    datasets: [{
      data: [results.cimentT + results.sableT + results.gravierT, results.acierT, 0.1],
      backgroundColor: ["#a855f7", "#ef4444", "#374151"],
      borderColor: "#111827",
      borderWidth: 2,
    }]
  };

  return (
    <div className="flex flex-col h-full w-full bg-gray-900 text-gray-100 overflow-hidden relative">
      
      {message && (
        <div className={`fixed top-4 right-4 px-6 py-3 rounded-xl shadow-2xl z-50 font-bold animate-in fade-in slide-in-from-top-2 ${
          message.type === "error" ? "bg-red-600" : "bg-purple-600"
        }`}>
          {message.text}
        </div>
      )}

      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-600/20 rounded-lg text-purple-500">
            <Grid className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Élévation : Poutres</h2>
            <p className="text-xs text-gray-400">Calcul structurel et coffrage</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-gray-500 uppercase font-bold block">Estimation Poutres</span>
          <span className="text-2xl font-black text-purple-400 tracking-tighter">
            {results.total.toLocaleString()} <span className="text-sm text-gray-500 font-normal">{currency}</span>
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-6 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* GAUCHE : SAISIE */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            
            {/* Type de Poutre */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-4">
              <h3 className="text-[10px] font-bold text-purple-400 uppercase tracking-widest mb-3">Usage de la poutre</h3>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(TYPES_POUTRES).map(([key, t]) => (
                  <button
                    key={key}
                    onClick={() => setInputs(prev => ({...prev, type: key}))}
                    className={`p-3 rounded-xl border text-[11px] font-bold transition-all flex items-center justify-center gap-2 ${
                      inputs.type === key ? "border-purple-500 bg-purple-500/10 text-purple-400" : "border-gray-700 bg-gray-800 text-gray-500"
                    }`}
                  >
                    <span>{t.icon}</span> {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5 shadow-lg space-y-4">
              <h3 className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                <Ruler className="w-3 h-3" /> Dimensions (m)
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label="Nombre" value={inputs.nombre} onChange={v => setInputs({...inputs, nombre: v})} />
                <InputGroup label="Longueur" value={inputs.longueur} onChange={v => setInputs({...inputs, longueur: v})} placeholder="Ex: 4.5" />
                <InputGroup label="Largeur (Base)" value={inputs.largeur} onChange={v => setInputs({...inputs, largeur: v})} placeholder="0.20" />
                <InputGroup label="Hauteur (Retombée)" value={inputs.hauteur} onChange={v => setInputs({...inputs, hauteur: v})} placeholder="0.40" />
              </div>
            </div>

            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5 shadow-lg space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label={`PU Béton (${currency}/m³)`} value={inputs.prixUnitaire} onChange={v => setInputs({...inputs, prixUnitaire: v})} />
                <InputGroup label="Pertes/Recouv. (%)" value={inputs.marge} onChange={v => setInputs({...inputs, marge: v})} />
              </div>
              <button 
                onClick={handleSave}
                className="w-full bg-purple-600 hover:bg-purple-500 text-white py-4 rounded-xl font-bold shadow-lg transition-all flex justify-center items-center gap-2"
              >
                <Save className="w-5 h-5" /> Enregistrer le calcul
              </button>
            </div>
          </div>

          {/* DROITE : RÉSULTATS */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            
            <div className="grid grid-cols-3 gap-4">
              <ResultCard label="Volume à Commander" value={results.volumeFinal.toFixed(2)} unit="m³" icon="🧊" color="text-purple-400" bg="bg-purple-500/10" />
              <ResultCard label="Coffrage Requis" value={results.surfaceCoffrage.toFixed(1)} unit="m²" icon={<Layers className="w-4 h-4"/>} color="text-indigo-400" bg="bg-indigo-500/10" border />
              <ResultCard label="Acier Estimé" value={results.acierKg.toFixed(0)} unit="kg" icon={<Target className="w-4 h-4"/>} color="text-red-400" bg="bg-red-500/10" />
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
                  <h4 className="text-gray-400 text-xs font-bold uppercase tracking-widest border-b border-gray-700 pb-2 mb-2">Analyse des Matériaux</h4>
                  
                  <MaterialRow label="Ciment (350kg/m³)" val={`${results.cimentT.toFixed(2)} t`} color="bg-purple-500" />
                  <MaterialRow label="Sable (Ratio 0.6)" val={`${results.sableT.toFixed(2)} t`} color="bg-amber-500" />
                  <MaterialRow label="Gravier (Ratio 0.85)" val={`${results.gravierT.toFixed(2)} t`} color="bg-stone-500" />
                  <MaterialRow label={`Acier (${results.ratioAcier}kg/m³)`} val={`${results.acierKg.toFixed(0)} kg`} color="bg-red-500" />
                  
                  <div className="pt-2 border-t border-gray-700 flex justify-between items-center mt-2">
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Droplets className="w-3 h-3 text-blue-400" /> Eau de gâchée
                    </span>
                    <span className="text-sm font-bold text-white font-mono">{results.eauL.toFixed(0)} L</span>
                  </div>

                  <div className="flex items-start gap-2 p-3 bg-purple-500/5 rounded-lg border border-purple-500/20">
                    <Info className="w-4 h-4 text-purple-400 mt-0.5" />
                    <p className="text-[10px] text-purple-200/70 leading-relaxed italic">
                      Les poutres porteuses nécessitent un ferraillage transversal (cadres) serré près des appuis. Le ratio inclut {inputs.marge}% de pertes et recouvrements.
                    </p>
                  </div>
               </div>
            </div>

            {/* Historique Mini */}
            {historique.length > 0 && (
              <div className="bg-gray-800/30 rounded-2xl border border-gray-700/50 overflow-hidden">
                <div className="px-4 py-2 bg-gray-800/50 flex justify-between items-center border-b border-gray-700/50">
                  <h4 className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2"><History className="w-3 h-3" /> Historique</h4>
                  <button onClick={() => {setHistorique([]); localStorage.removeItem(STORAGE_KEY)}} className="text-[10px] text-red-400 hover:underline">Vider</button>
                </div>
                <div className="max-h-[100px] overflow-y-auto">
                  {historique.slice(0, 5).map((item) => (
                    <div key={item.id} className="flex justify-between items-center p-3 border-b border-gray-700/30">
                      <div className="text-xs">
                        <span className="text-gray-500 text-[9px] block">{item.date}</span>
                        {item.nombre}x Poutre {item.typeLabel}
                      </div>
                      <span className="text-sm font-bold text-purple-500">{parseFloat(item.total).toLocaleString()} {currency}</span>
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

const MaterialRow = ({ label, val, color }) => (
  <div className="flex justify-between items-center border-b border-gray-700/30 pb-2 last:border-0">
    <div className="flex items-center gap-2">
      <div className={`w-1.5 h-1.5 rounded-full ${color}`} />
      <span className="text-gray-300 text-xs font-medium">{label}</span>
    </div>
    <span className="text-xs font-bold text-white font-mono">{val}</span>
  </div>
);