import React, { useState, useEffect, useMemo } from "react";
import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS, ArcElement, Tooltip, Legend,
} from "chart.js";
import { 
  BoxSelect, Columns, LayoutGrid, Grid, Ruler, Banknote, 
  Save, Trash2, History, Anchor, Droplets, Info, Activity, Layers
} from "lucide-react";

ChartJS.register(ArcElement, Tooltip, Legend);

const STORAGE_KEY = "dalot-history-pro";

// Configuration Technique (Bureau d'Études)
const DALOT_TYPES = [
  { id: "simple", label: "Mono-cellulaire", icon: <BoxSelect className="w-5 h-5"/>, cells: 1 },
  { id: "double", label: "Bi-cellulaire", icon: <Columns className="w-5 h-5"/>, cells: 2 },
  { id: "triple", label: "Tri-cellulaire", icon: <LayoutGrid className="w-5 h-5"/>, cells: 3 },
];

const DOSAGE = {
  ciment: 0.350, // 350kg/m3
  sable: 0.6,    // T/m3
  gravier: 0.85, // T/m3
  acier: 0.120,  // 120kg/m3 (Ferraillage dense pour cadre)
  eau: 180
};

export default function DalotForm({ currency = "XOF", onCostChange, onMateriauxChange }) {
  
  // --- ÉTATS ---
  const [typeId, setTypeId] = useState("simple");
  const [inputs, setInputs] = useState({
    longueur: "",      
    largeurInt: "",     // Largeur d'une cellule
    hauteurInt: "",     // Hauteur d'une cellule
    epaisseur: "0.20",  
    prixUnitaire: "",  
    coutMainOeuvre: "" 
  });

  const [historique, setHistorique] = useState([]);
  const [message, setMessage] = useState(null);

  // --- MOTEUR DE CALCUL TECHNIQUE ---
  const results = useMemo(() => {
    const L = parseFloat(inputs.longueur) || 0;
    const l = parseFloat(inputs.largeurInt) || 0;
    const h = parseFloat(inputs.hauteurInt) || 0;
    const ep = parseFloat(inputs.epaisseur) || 0;
    const n = DALOT_TYPES.find(t => t.id === typeId)?.cells || 1;

    // 1. Géométrie Extérieure
    // Largeur totale = (n * l) + ((n + 1) * ep)
    const largExt = (n * l) + ((n + 1) * ep);
    const hautExt = h + (2 * ep); // Radier + Dalle sup

    // 2. Volume de Béton
    const aireSectionBeton = (largExt * hautExt) - (n * l * h);
    const volumeTotal = aireSectionBeton * L;

    // 3. Coffrage (m2)
    // Intérieur : (2h + l) * L * n  (3 faces par cellule, le fond est coulé sur propreté)
    // Extérieur : (2 * hautExt) * L (les 2 joues latérales)
    const surfaceCoffrage = ((2 * h + l) * n * L) + (2 * hautExt * L);

    // 4. Hydraulique (Vitesse estimée 1.5m/s à pleine section)
    const sectionMouillee = n * l * h;
    const debitMax = sectionMouillee * 1.5 * 3600; // m3/h

    // 5. Matériaux
    const cimentT = volumeTotal * DOSAGE.ciment;
    const cimentSacs = (cimentT * 1000) / 50;
    const acierKg = volumeTotal * (DOSAGE.acier * 1000);
    const acierT = acierKg / 1000;

    // 6. Coûts
    const pu = parseFloat(inputs.prixUnitaire) || 0;
    const mo = parseFloat(inputs.coutMainOeuvre) || 0;
    const total = (volumeTotal * pu) + mo;

    return {
      volumeTotal, surfaceCoffrage, debitMax,
      cimentT, cimentSacs, acierKg, acierT,
      total, largExt, hautExt
    };
  }, [inputs, typeId]);

  // --- SYNC PARENT ---
  useEffect(() => {
    onCostChange(results.total);
    if (onMateriauxChange) {
      onMateriauxChange({
        volume: results.volumeTotal,
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
    if (results.volumeTotal <= 0) return showToast("⚠️ Dimensions invalides", "error");
    const newEntry = {
      id: Date.now(),
      date: new Date().toLocaleString(),
      typeLabel: DALOT_TYPES.find(t => t.id === typeId).label,
      ...inputs, ...results
    };
    const newHist = [newEntry, ...historique];
    setHistorique(newHist);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newHist));
    showToast("✅ Ouvrage sauvegardé !");
  };

  const showToast = (msg, type = "success") => {
    setMessage({ text: msg, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const chartData = {
    labels: ["Fournitures", "Pose / MO"],
    datasets: [{
      data: [results.total - parseFloat(inputs.coutMainOeuvre || 0), parseFloat(inputs.coutMainOeuvre || 0)],
      backgroundColor: ["#4f46e5", "#374151"],
      borderColor: "#111827",
      borderWidth: 2,
    }]
  };

  return (
    <div className="w-full h-full flex flex-col bg-gray-900 text-gray-100 overflow-hidden relative font-sans">
      
      {message && (
        <div className={`fixed top-4 right-4 px-6 py-3 rounded-xl shadow-2xl z-50 font-bold animate-in fade-in slide-in-from-top-2 ${
          message.type === 'error' ? "bg-red-600" : "bg-indigo-600"
        }`}>
          {message.text}
        </div>
      )}

      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600/20 rounded-lg text-indigo-500">
            <BoxSelect className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white uppercase tracking-tight">Ouvrage : Dalot Cadre</h2>
            <p className="text-xs text-gray-400 font-medium italic">Calcul structurel et hydraulique</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-gray-500 uppercase font-bold block">Estimation Totale</span>
          <span className="text-2xl font-black text-indigo-400 tracking-tighter">
            {results.total.toLocaleString()} <span className="text-sm text-gray-500 font-normal">{currency}</span>
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-6 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
          
          {/* GAUCHE : SAISIE */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            
            <div className="grid grid-cols-3 gap-2 bg-gray-800 p-1.5 rounded-xl border border-gray-700">
              {DALOT_TYPES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTypeId(t.id)}
                  className={`flex flex-col items-center justify-center py-2 rounded-lg transition-all ${
                    typeId === t.id 
                      ? "bg-indigo-600 text-white shadow-lg" 
                      : "text-gray-400 hover:text-white hover:bg-gray-700"
                  }`}
                >
                  {t.icon}
                  <span className="text-[10px] font-bold uppercase mt-1">{t.cells}x</span>
                </button>
              ))}
            </div>

            <div className="bg-gray-800/50 border border-gray-700 rounded-3xl p-6 shadow-xl space-y-6">
              <h3 className="flex items-center gap-2 text-xs font-bold text-indigo-400 uppercase tracking-widest">
                <Ruler className="w-4 h-4" /> Géométrie Intérieure (m)
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label="Long. Ouvrage" value={inputs.longueur} onChange={v => setInputs({...inputs, longueur: v})} placeholder="Ex: 12.00" />
                <InputGroup label="Ép. Voiles/Dalle" value={inputs.epaisseur} onChange={v => setInputs({...inputs, epaisseur: v})} placeholder="0.20" />
                <InputGroup label="Larg. Cellule" value={inputs.largeurInt} onChange={v => setInputs({...inputs, largeurInt: v})} placeholder="1.00" />
                <InputGroup label="Haut. Cellule" value={inputs.hauteurInt} onChange={v => setInputs({...inputs, hauteurInt: v})} placeholder="1.00" />
              </div>
            </div>

            <div className="bg-gray-800/50 border border-gray-700 rounded-3xl p-6 shadow-xl space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label={`PU Béton (${currency}/m³)`} value={inputs.prixUnitaire} onChange={v => setInputs({...inputs, prixUnitaire: v})} />
                <InputGroup label={`Forfait MO (${currency})`} value={inputs.coutMainOeuvre} onChange={v => setInputs({...inputs, coutMainOeuvre: v})} />
              </div>
              <button onClick={handleSave} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-2xl font-bold shadow-lg transition-all flex justify-center items-center gap-2 active:scale-95">
                <Save className="w-5 h-5" /> Enregistrer l'Ouvrage
              </button>
            </div>
          </div>

          {/* DROITE : RÉSULTATS */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            
            <div className="grid grid-cols-3 gap-4">
              <ResultCard label="Volume Béton" value={results.volumeTotal.toFixed(2)} unit="m³" icon={<Layers className="w-4 h-4"/>} color="text-indigo-400" bg="bg-indigo-500/10" />
              <ResultCard label="Coffrage" value={results.surfaceCoffrage.toFixed(1)} unit="m²" icon={<Ruler className="w-4 h-4"/>} color="text-white" bg="bg-gray-800" border />
              <ResultCard label="Acier Estimé" value={results.acierKg.toFixed(0)} unit="kg" icon={<Anchor className="w-4 h-4"/>} color="text-red-400" bg="bg-red-500/10" />
            </div>

            <div className={`p-6 rounded-3xl border transition-all flex items-center gap-6 bg-blue-600/10 border-blue-500/30`}>
                <div className={`p-4 rounded-2xl bg-blue-500/20 text-blue-400`}>
                  <Activity className="w-8 h-8" />
                </div>
                <div className="flex-1">
                    <p className="text-[10px] uppercase font-bold text-gray-500">Capacité de transit (Pleine section)</p>
                    <span className="text-2xl font-black text-blue-400">{results.debitMax.toLocaleString()} <small className="text-xs">m³/h</small></span>
                    <p className="text-[10px] text-gray-500 mt-1 italic">* Basé sur une section mouillée de {(results.volumeTotal/parseFloat(inputs.longueur || 1)).toFixed(2)} m²</p>
                </div>
            </div>

            <div className="flex-1 bg-gray-800 rounded-3xl p-6 border border-gray-700 shadow-xl flex flex-col md:flex-row gap-8 items-center relative overflow-hidden">
               <div className="absolute -bottom-10 -right-10 w-44 h-44 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

               <div className="w-44 h-44 flex-shrink-0 relative">
                  <Doughnut data={chartData} options={{ cutout: "75%", plugins: { legend: { display: false } } }} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                     <span className="text-[10px] text-gray-500 uppercase font-bold text-center">Poids<br/>Béton</span>
                     <span className="text-sm font-bold text-white">{(results.volumeTotal * 2.5).toFixed(1)} T</span>
                  </div>
               </div>

               <div className="flex-1 w-full space-y-4">
                  <h4 className="text-gray-400 text-xs font-bold uppercase tracking-widest border-b border-gray-700 pb-2 mb-2">Analyse Logistique</h4>
                  <MaterialRow label="Ciment (350kg/m³)" val={`${results.cimentSacs.toFixed(1)} sacs`} color="bg-indigo-500" />
                  <MaterialRow label="Acier (HA10/12/14)" val={`${results.acierKg.toFixed(0)} kg`} color="bg-red-500" />
                  <div className="pt-2 border-t border-gray-700 flex justify-between items-center">
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Droplets className="w-3 h-3 text-cyan-400" /> Eau nécessaire
                    </span>
                    <span className="text-sm font-bold text-white font-mono">{(results.volumeTotal * 180).toFixed(0)} L</span>
                  </div>

                  <div className="flex items-start gap-2 p-3 bg-indigo-500/5 rounded-xl border border-indigo-500/20 mt-2">
                    <Info className="w-4 h-4 text-indigo-400 mt-0.5" />
                    <p className="text-[10px] text-indigo-200/70 leading-relaxed italic">
                      Dimensions extérieures estimées : <strong>{results.largExt.toFixed(2)}m x {results.hautExt.toFixed(2)}m</strong>.
                    </p>
                  </div>
               </div>
            </div>

            {/* Historique Mini */}
            {historique.length > 0 && (
              <div className="bg-gray-800/30 rounded-2xl border border-gray-700/50 overflow-hidden">
                <div className="px-4 py-2 bg-gray-800/50 border-b border-gray-700/50 flex justify-between items-center text-xs">
                  <h4 className="font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2"><History className="w-3 h-3" /> Historique</h4>
                  <button onClick={() => {setHistorique([]); localStorage.removeItem(STORAGE_KEY)}} className="text-red-400 hover:underline uppercase">Vider</button>
                </div>
                <div className="max-h-[120px] overflow-y-auto">
                  {historique.slice(0, 5).map((item) => (
                    <div key={item.id} className="flex justify-between items-center p-3 border-b border-gray-700/30 hover:bg-gray-700/40 transition-colors">
                      <div className="text-xs">
                        <span className="text-gray-500 block text-[9px]">{item.date}</span>
                        <span className="font-medium uppercase">{item.typeLabel} - {item.volumeTotal.toFixed(1)} m³</span>
                      </div>
                      <span className="text-sm font-bold text-indigo-400">{parseFloat(item.total).toLocaleString()} {currency}</span>
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
      className="w-full bg-gray-900 border border-gray-600 rounded-xl px-4 py-3 text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono text-sm"
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