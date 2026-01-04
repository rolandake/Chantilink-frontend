import React, { useState, useEffect, useMemo } from "react";
import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS, ArcElement, Tooltip, Legend,
} from "chart.js";
import { 
  Building2, Ruler, Banknote, Save, Trash2, History, Anchor, 
  Layers, Info, Map, Construction, ShoppingBag
} from "lucide-react";

ChartJS.register(ArcElement, Tooltip, Legend);

const STORAGE_KEY = "gares-history-pro";

// Configuration Technique (Ratios Bureau d'Études Bâtiment Voyageur)
const GARE_CONFIG = {
  ratioBetonM3m2: 0.35,  // 0.35 m3 de béton par m2 de surface au sol
  acierRatioKgM3: 110,   // 110 kg d'acier par m3 de béton
  cimentDosage: 0.350    // 350 kg/m3
};

export default function Gares({ currency = "XOF", onMaterialsChange = () => {} }) {
  
  // --- ÉTATS ---
  const [inputs, setInputs] = useState({
    nombreGares: "",
    surfaceMoyenne: "",
    prixUnitaireM2: "",   // Prix construction fini au m2
    coutMainOeuvre: "",
    margeImprevus: "10"
  });

  const [historique, setHistorique] = useState([]);
  const [message, setMessage] = useState(null);

  // --- MOTEUR DE CALCUL (INGÉNIERIE) ---
  const results = useMemo(() => {
    const nb = parseFloat(inputs.nombreGares) || 0;
    const surfMoy = parseFloat(inputs.surfaceMoyenne) || 0;
    const pu = parseFloat(inputs.prixUnitaireM2) || 0;
    const mo = parseFloat(inputs.coutMainOeuvre) || 0;
    const margin = 1 + (parseFloat(inputs.margeImprevus) || 0) / 100;

    // 1. Surfaces et Volumes
    const surfaceTotale = nb * surfMoy;
    const volumeBetonEstime = surfaceTotale * GARE_CONFIG.ratioBetonM3m2;
    
    // 2. Matériaux
    const tonnageAcier = (volumeBetonEstime * GARE_CONFIG.acierRatioKgM3) / 1000;
    const cimentSacs = (volumeBetonEstime * GARE_CONFIG.cimentDosage * 1000) / 50;

    // 3. Coûts
    const coutConstruction = surfaceTotale * pu;
    const total = (coutConstruction + mo) * margin;

    return {
      surfaceTotale,
      volumeBetonEstime,
      tonnageAcier,
      cimentSacs,
      total,
      coutConstruction
    };
  }, [inputs]);

  // --- SYNC PARENT ---
  useEffect(() => {
    onMaterialsChange({ 
      surfaceTotale: results.surfaceTotale,
      volumeBeton: results.volumeBetonEstime,
      acierT: results.tonnageAcier
    });
  }, [results.surfaceTotale]);

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
    showToast("✅ Gare enregistrée !");
  };

  const showToast = (msg, type = "success") => {
    setMessage({ text: msg, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const chartData = {
    labels: ["Gros Œuvre & Second Œuvre", "Main d'œuvre"],
    datasets: [{
      data: [results.coutConstruction, parseFloat(inputs.coutMainOeuvre || 0)],
      backgroundColor: ["#6366f1", "#1e293b"],
      borderColor: "#111827",
      borderWidth: 2,
    }]
  };

  return (
    <div className="w-full h-full flex flex-col bg-gray-950 text-gray-100 overflow-hidden relative font-sans">
      
      {/* Notification Toast */}
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
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white uppercase tracking-tight">Bâtiments : Gares</h2>
            <p className="text-xs text-gray-400 font-medium italic">Stations & Aménagements voyageurs</p>
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
                <Map className="w-4 h-4" /> Programme des stations
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label="Nombre de gares" value={inputs.nombreGares} onChange={v => setInputs({...inputs, nombreGares: v})} placeholder="Ex: 5" />
                <InputGroup label="Surf. Moyenne (m²)" value={inputs.surfaceMoyenne} onChange={v => setInputs({...inputs, surfaceMoyenne: v})} placeholder="Ex: 250" />
              </div>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 shadow-lg space-y-4 flex-1">
              <h3 className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
                <Banknote className="w-4 h-4" /> Tarification & Marges
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label={`Prix Finition (${currency}/m²)`} value={inputs.prixUnitaireM2} onChange={v => setInputs({...inputs, prixUnitaireM2: v})} />
                <InputGroup label={`Marges / Aléas (%)`} value={inputs.margeImprevus} onChange={v => setInputs({...inputs, margeImprevus: v})} />
                <InputGroup label={`Main d'œuvre Forfait (${currency})`} value={inputs.coutMainOeuvre} onChange={v => setInputs({...inputs, coutMainOeuvre: v})} full />
              </div>

              <button 
                onClick={handleSave}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-xl font-bold shadow-lg transition-all flex justify-center items-center gap-2 active:scale-95 mt-4"
              >
                <Save className="w-5 h-5" /> Enregistrer le lot Gares
              </button>
            </div>
          </div>

          {/* DROITE : DASHBOARD (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            
            <div className="grid grid-cols-3 gap-4">
              <ResultCard label="Surface Totale" value={results.surfaceTotale.toFixed(0)} unit="m²" icon={<Ruler className="w-4 h-4"/>} color="text-indigo-400" bg="bg-indigo-500/10" border />
              <ResultCard label="Béton Requis" value={results.volumeBetonEstime.toFixed(1)} unit="m³" icon={<Layers className="w-4 h-4"/>} color="text-white" bg="bg-gray-800" />
              <ResultCard label="Acier HA" value={results.tonnageAcier.toFixed(1)} unit="Tons" icon={<Anchor className="w-4 h-4"/>} color="text-red-400" bg="bg-red-500/10" />
            </div>

            <div className="flex-1 bg-gray-900 rounded-3xl p-8 border border-gray-800 shadow-xl flex flex-col md:flex-row gap-10 items-center relative overflow-hidden">
               <div className="absolute -bottom-10 -right-10 w-44 h-44 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

               <div className="w-48 h-48 flex-shrink-0 relative">
                  <Doughnut data={chartData} options={{ cutout: "75%", plugins: { legend: { display: false } } }} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                     <span className="text-[10px] text-gray-500 uppercase font-bold text-center leading-tight">Matériaux<br/>Second Œuvre</span>
                     <span className="text-sm font-bold text-white">{Math.ceil(results.cimentSacs)} sacs</span>
                  </div>
               </div>

               <div className="flex-1 w-full space-y-4">
                  <h4 className="text-gray-400 text-xs font-bold uppercase tracking-widest border-b border-gray-800 pb-2 mb-2">Bilan Structural</h4>
                  
                  <MaterialRow label="Gros Œuvre (Béton/Acier)" val={`${results.coutConstruction.toLocaleString()} ${currency}`} color="bg-indigo-500" />
                  <MaterialRow label="Équipements Voyageurs" val="Inclus dans le m²" color="bg-indigo-800" />
                  <MaterialRow label="Sacs de Ciment (350kg/m³)" val={`${Math.ceil(results.cimentSacs)} unités`} color="bg-slate-600" />
                  
                  <div className="flex items-start gap-2 p-3 bg-blue-500/5 rounded-xl border border-blue-500/20 mt-4">
                    <Info className="w-4 h-4 text-indigo-400 mt-0.5" />
                    <p className="text-[10px] text-indigo-200/70 leading-relaxed italic">
                      Les gares sont chiffrées selon un standard de bâtiment public à haute fréquentation. Le calcul inclut les structures de quai.
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
                        <span className="font-medium uppercase tracking-tighter">{item.nombreGares} gare(s) - {item.surfaceTotale.toFixed(1)} m²</span>
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