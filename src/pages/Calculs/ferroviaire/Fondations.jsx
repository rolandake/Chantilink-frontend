import React, { useState, useEffect, useMemo } from "react";
import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS, ArcElement, Tooltip, Legend,
} from "chart.js";
import { 
  BrickWall, Ruler, Banknote, Save, Trash2, History, Anchor, 
  Layers, Info, HardHat, Droplets, Weight
} from "lucide-react";

ChartJS.register(ArcElement, Tooltip, Legend);

const STORAGE_KEY = "fondations-rail-history-pro";

// Configuration Technique (Standards Bureau d'Études Génie Civil Ferroviaire)
const FONDATION_CONFIG = {
  cimentDosage: 0.350,   // 350kg/m3
  acierRatioKgM3: 110,   // 110kg d'acier par m3
  sableRatio: 0.45,      // m3 par m3 de béton
  gravierRatio: 0.85,    // m3 par m3 de béton
};

export default function Fondations({ currency = "XOF", onMaterialsChange = () => {} }) {
  
  // --- ÉTATS ---
  const [inputs, setInputs] = useState({
    longueur: "",
    largeur: "",
    hauteur: "",
    prixBetonM3: "",   // Prix du béton aux granulats
    prixAcierKg: "850", // Prix moyen de l'acier HA
    mainOeuvre: "",
    margePerte: "5"
  });

  const [historique, setHistorique] = useState([]);
  const [message, setMessage] = useState(null);

  // --- MOTEUR DE CALCUL (LOGIQUE BE) ---
  const results = useMemo(() => {
    const L = parseFloat(inputs.longueur) || 0;
    const l = parseFloat(inputs.largeur) || 0;
    const h = parseFloat(inputs.hauteur) || 0;
    const margin = 1 + (parseFloat(inputs.margePerte) || 0) / 100;

    // 1. Volume Géométrique
    const volumeBrut = L * l * h;
    const volumeFinal = volumeBrut * margin;

    // 2. Matériaux (Quantités)
    const tonnageAcier = (volumeFinal * FONDATION_CONFIG.acierRatioKgM3) / 1000;
    const cimentT = volumeFinal * FONDATION_CONFIG.cimentDosage;
    const cimentSacs = (cimentT * 1000) / 50;
    const sableM3 = volumeFinal * FONDATION_CONFIG.sableRatio;
    const gravierM3 = volumeFinal * FONDATION_CONFIG.gravierRatio;

    // 3. Coûts
    const coutBeton = volumeFinal * (parseFloat(inputs.prixBetonM3) || 0);
    const coutAcier = (tonnageAcier * 1000) * (parseFloat(inputs.prixAcierKg) || 0);
    const mo = parseFloat(inputs.mainOeuvre) || 0;
    
    const total = coutBeton + coutAcier + mo;

    return {
      volumeFinal,
      tonnageAcier,
      cimentSacs,
      sableM3,
      gravierM3,
      total,
      coutBeton,
      coutAcier
    };
  }, [inputs]);

  // --- SYNC PARENT ---
  useEffect(() => {
    onMaterialsChange({ 
      volume: results.volumeFinal,
      acierT: results.tonnageAcier,
      cimentSacs: results.cimentSacs 
    });
  }, [results.volumeFinal]);

  // --- HISTORIQUE ---
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) try { setHistorique(JSON.parse(saved)); } catch(e) {}
  }, []);

  const handleSave = () => {
    if (results.total <= 0) return showToast("⚠️ Saisie incomplète", "error");
    const newEntry = {
      id: Date.now(),
      date: new Date().toLocaleString(),
      ...inputs, ...results
    };
    const newHist = [newEntry, ...historique];
    setHistorique(newHist);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newHist));
    showToast("✅ Calcul fondation enregistré !");
  };

  const showToast = (msg, type = "success") => {
    setMessage({ text: msg, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const chartData = {
    labels: ["Béton", "Acier HA", "Main d'œuvre"],
    datasets: [{
      data: [results.coutBeton, results.coutAcier, parseFloat(inputs.mainOeuvre || 0)],
      backgroundColor: ["#4f46e5", "#ef4444", "#374151"],
      borderColor: "#111827",
      borderWidth: 2,
    }]
  };

  return (
    <div className="w-full h-full flex flex-col bg-gray-950 text-gray-100 overflow-hidden relative font-sans">
      
      {/* Toast Notification */}
      {message && (
        <div className={`fixed top-4 right-4 px-6 py-3 rounded-xl shadow-2xl z-50 font-bold animate-in fade-in slide-in-from-top-2 ${
          message.type === "error" ? "bg-red-600" : "bg-indigo-600"
        }`}>
          {message.text}
        </div>
      )}

      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600/20 rounded-lg text-indigo-500">
            <BrickWall className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white uppercase tracking-tight">Génie Civil : Fondations</h2>
            <p className="text-xs text-gray-400 font-medium italic">Massifs & Infrastructures enterrées</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-gray-500 uppercase font-bold block tracking-widest">Budget Estimé</span>
          <span className="text-2xl font-black text-indigo-400 tracking-tighter">
            {results.total.toLocaleString()} <span className="text-sm text-gray-500 font-normal">{currency}</span>
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-6 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
          
          {/* GAUCHE : SAISIE (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 shadow-lg space-y-4">
              <h3 className="flex items-center gap-2 text-xs font-bold text-indigo-400 uppercase tracking-widest mb-2">
                <Ruler className="w-4 h-4" /> Dimensions des massifs
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label="Longueur (m)" value={inputs.longueur} onChange={v => setInputs({...inputs, longueur: v})} />
                <InputGroup label="Largeur (m)" value={inputs.largeur} onChange={v => setInputs({...inputs, largeur: v})} />
                <InputGroup label="Hauteur (m)" value={inputs.hauteur} onChange={v => setInputs({...inputs, hauteur: v})} />
                <InputGroup label="Marge Perte (%)" value={inputs.margePerte} onChange={v => setInputs({...inputs, margePerte: v})} />
              </div>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 shadow-lg space-y-4 flex-1">
              <h3 className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
                <Banknote className="w-4 h-4" /> Coûts Unitaires (BE)
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label={`Béton (${currency}/m³)`} value={inputs.prixBetonM3} onChange={v => setInputs({...inputs, prixBetonM3: v})} />
                <InputGroup label={`Acier (${currency}/kg)`} value={inputs.prixAcierKg} onChange={v => setInputs({...inputs, prixAcierKg: v})} />
                <InputGroup label={`Main d'œuvre (${currency})`} value={inputs.mainOeuvre} onChange={v => setInputs({...inputs, mainOeuvre: v})} full />
              </div>

              <button 
                onClick={handleSave}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-xl font-bold shadow-lg transition-all flex justify-center items-center gap-2 active:scale-95 mt-4"
              >
                <Save className="w-5 h-5" /> Enregistrer la Phase
              </button>
            </div>
          </div>

          {/* DROITE : RÉSULTATS (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            
            <div className="grid grid-cols-3 gap-4">
              <ResultCard label="Béton Total" value={results.volumeFinal.toFixed(2)} unit="m³" icon={<Layers className="w-4 h-4"/>} color="text-indigo-400" bg="bg-indigo-500/10" border />
              <ResultCard label="Ciment" value={Math.ceil(results.cimentSacs)} unit="sacs" icon={<Weight className="w-4 h-4"/>} color="text-white" bg="bg-gray-800" />
              <ResultCard label="Acier HA" value={results.tonnageAcier.toFixed(2)} unit="Tons" icon={<Anchor className="w-4 h-4"/>} color="text-red-400" bg="bg-red-500/10" />
            </div>

            <div className="flex-1 bg-gray-900 rounded-3xl p-8 border border-gray-800 shadow-xl flex flex-col md:flex-row gap-10 items-center relative overflow-hidden">
               <div className="absolute -bottom-10 -right-10 w-44 h-44 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

               <div className="w-48 h-48 flex-shrink-0 relative">
                  <Doughnut data={chartData} options={{ cutout: "75%", plugins: { legend: { display: false } } }} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                     <span className="text-[10px] text-gray-500 uppercase font-bold text-center leading-tight">Masse<br/>Béton</span>
                     <span className="text-sm font-bold text-white">{(results.volumeFinal * 2.5).toFixed(1)} T</span>
                  </div>
               </div>

               <div className="flex-1 w-full space-y-4">
                  <h4 className="text-gray-400 text-xs font-bold uppercase tracking-widest border-b border-gray-800 pb-2 mb-2">Détails des fournitures</h4>
                  
                  <MaterialRow label="Acier (Ratio 110kg/m³)" val={`${(results.tonnageAcier * 1000).toFixed(0)} kg`} color="bg-red-500" />
                  <MaterialRow label="Sable (Ratio 0.45)" val={`${results.sableM3.toFixed(2)} m³`} color="bg-indigo-500" />
                  <MaterialRow label="Gravier (Ratio 0.85)" val={`${results.gravierM3.toFixed(2)} m³`} color="bg-slate-600" />
                  
                  <div className="pt-2 border-t border-gray-800 flex justify-between items-center">
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Droplets className="w-3 h-3 text-indigo-400" /> Eau nécessaire
                    </span>
                    <span className="text-sm font-bold text-white font-mono">{(results.volumeFinal * 180).toFixed(0)} L</span>
                  </div>

                  <div className="flex items-start gap-2 p-3 bg-blue-500/5 rounded-xl border border-blue-500/20">
                    <Info className="w-4 h-4 text-indigo-400 mt-0.5" />
                    <p className="text-[10px] text-indigo-200/70 leading-relaxed italic">
                      Les dosages sont calculés pour un béton de structure C25/30 avec une densité de 2.5 T/m³ une fois ferraillé.
                    </p>
                  </div>
               </div>
            </div>

            {/* Historique Mini */}
            {historique.length > 0 && (
              <div className="bg-gray-900/50 rounded-2xl border border-gray-800 overflow-hidden">
                <div className="px-4 py-2 bg-gray-800/50 border-b border-gray-800 flex justify-between items-center text-xs">
                  <h4 className="font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2"><History className="w-3 h-3" /> Historique</h4>
                  <button onClick={() => {setHistorique([]); localStorage.removeItem(STORAGE_KEY)}} className="text-red-400 hover:underline uppercase text-[10px]">Vider</button>
                </div>
                <div className="max-h-[120px] overflow-y-auto">
                  {historique.slice(0, 5).map((item) => (
                    <div key={item.id} className="flex justify-between items-center p-3 border-b border-gray-800 hover:bg-gray-800 transition-colors">
                      <div className="text-xs">
                        <span className="text-gray-500 block text-[9px]">{item.date}</span>
                        <span className="font-medium uppercase tracking-tighter">Vol: {item.volumeFinal.toFixed(1)} m³ - {item.tonnageAcier.toFixed(1)}T Acier</span>
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
      className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-white focus:border-indigo-500 transition-all font-mono text-sm"
      placeholder={placeholder || "0"}
    />
  </div>
);

const ResultCard = ({ label, value, unit, color, bg, border, icon }) => (
  <div className={`rounded-2xl p-4 flex flex-col justify-center items-center text-center ${bg} ${border ? 'border border-gray-800' : ''}`}>
    <span className="text-[10px] text-gray-500 uppercase font-bold mb-1 flex items-center gap-1">
      {icon} {label}
    </span>
    <span className={`text-xl font-black ${color}`}>
      {value} <span className="text-xs font-normal text-gray-500 lowercase">{unit}</span>
    </span>
  </div>
);

const MaterialRow = ({ label, val, color }) => (
  <div className="flex justify-between items-center border-b border-gray-800 pb-2 last:border-0 group">
    <div className="flex items-center gap-2">
      <div className={`w-1.5 h-1.5 rounded-full ${color}`} />
      <span className="text-gray-300 text-xs font-medium">{label}</span>
    </div>
    <span className="text-xs font-bold text-white font-mono">{val}</span>
  </div>
);