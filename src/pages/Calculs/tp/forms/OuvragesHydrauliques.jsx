import React, { useState, useEffect, useMemo } from "react";
import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS, ArcElement, Tooltip, Legend,
} from "chart.js";
import { 
  Droplets, Waves, Ruler, Banknote, Save, Trash2, History, BoxSelect, Cylinder, Layers, Info, Anchor
} from "lucide-react";

ChartJS.register(ArcElement, Tooltip, Legend);

const STORAGE_KEYS = {
  dalot: "tp-dalot-history",
  caniveau: "tp-caniveau-history",
  buse: "tp-buse-history"
};

const OUVRAGES_CONFIG = {
  dalot: { label: "Dalot Cadre", icon: <BoxSelect className="w-5 h-5"/>, color: "blue", ratioAcier: 120 },
  caniveau: { label: "Caniveau U", icon: <Waves className="w-5 h-5"/>, color: "cyan", ratioAcier: 80 },
  buse: { label: "Buse Béton", icon: <Cylinder className="w-5 h-5"/>, color: "indigo", ratioAcier: 100 },
};

export default function OuvragesHydrauliques({ currency = "XOF", onCostChange, onMateriauxChange }) {
  const [activeTab, setActiveTab] = useState("dalot");
  const [inputs, setInputs] = useState({
    longueur: "",
    largeurInt: "",     // Pour Dalot/Caniveau
    hauteurInt: "",     // Pour Dalot/Caniveau
    diametreInt: "",    // Pour Buse
    epaisseur: "0.20",  // Épaisseur des parois
    prixUnitaire: "",
    coutMainOeuvre: ""
  });

  const [historique, setHistorique] = useState([]);
  const [message, setMessage] = useState(null);

  // --- MOTEUR DE CALCUL (BUREAU D'ÉTUDES) ---
  const results = useMemo(() => {
    const L = parseFloat(inputs.longueur) || 0;
    const ep = parseFloat(inputs.epaisseur) || 0;
    const pu = parseFloat(inputs.prixUnitaire) || 0;
    const mo = parseFloat(inputs.coutMainOeuvre) || 0;

    let volumeBeton = 0;
    let surfaceCoffrage = 0;

    if (activeTab === "dalot") {
      const lint = parseFloat(inputs.largeurInt) || 0;
      const hint = parseFloat(inputs.hauteurInt) || 0;
      // Section béton = Aire Ext - Aire Int
      const aireBeton = ((lint + 2 * ep) * (hint + 2 * ep)) - (lint * hint);
      volumeBeton = aireBeton * L;
      // Coffrage = (2 faces intérieures + dalle sup int) + (2 faces extérieures) * L
      surfaceCoffrage = ((2 * hint + lint) + 2 * (hint + 2 * ep)) * L;
    } 
    else if (activeTab === "caniveau") {
      const lint = parseFloat(inputs.largeurInt) || 0;
      const hint = parseFloat(inputs.hauteurInt) || 0;
      // Section U = (lint + 2*ep)*(hint + ep) - (lint*hint) [pas de dalle sup]
      const aireBeton = ((lint + 2 * ep) * (hint + ep)) - (lint * hint);
      volumeBeton = aireBeton * L;
      surfaceCoffrage = ((2 * hint + lint) + 2 * (hint + ep)) * L;
    } 
    else if (activeTab === "buse") {
      const d = parseFloat(inputs.diametreInt) || 0;
      const rInt = d / 2;
      const rExt = rInt + ep;
      const aireBeton = Math.PI * (Math.pow(rExt, 2) - Math.pow(rInt, 2));
      volumeBeton = aireBeton * L;
      surfaceCoffrage = (Math.PI * (d + 2 * ep) + Math.PI * d) * L;
    }

    // Matériaux (Dosage structurel 350kg/m3)
    const cimentT = volumeBeton * 0.350;
    const cimentSacs = Math.ceil(cimentT * 20);
    const acierKg = volumeBeton * OUVRAGES_CONFIG[activeTab].ratioAcier;
    const acierT = acierKg / 1000;
    
    const total = (volumeBeton * pu) + mo;

    return { volume: volumeBeton, coffrage: surfaceCoffrage, cimentT, cimentSacs, acierKg, acierT, total };
  }, [inputs, activeTab]);

  // --- SYNC PARENT ---
  useEffect(() => {
    onCostChange?.(results.total);
    onMateriauxChange?.({ volume: results.volume, ciment: results.cimentT, acier: results.acierT });
  }, [results.total, activeTab]);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEYS[activeTab]);
    setHistorique(saved ? JSON.parse(saved) : []);
  }, [activeTab]);

  // --- HANDLERS ---
  const showToast = (text, type = "success") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleSave = () => {
    if (results.volume <= 0) return showToast("⚠️ Dimensions invalides", "error");
    const newEntry = { id: Date.now(), date: new Date().toLocaleString(), type: activeTab, ...inputs, ...results };
    const newHist = [newEntry, ...historique];
    setHistorique(newHist);
    localStorage.setItem(STORAGE_KEYS[activeTab], JSON.stringify(newHist));
    showToast("✅ Ouvrage enregistré !");
  };

  const chartData = {
    labels: ["Béton / Matériaux", "Main d'œuvre"],
    datasets: [{
      data: [results.total - (parseFloat(inputs.coutMainOeuvre) || 0), parseFloat(inputs.coutMainOeuvre) || 0],
      backgroundColor: [activeTab === 'dalot' ? '#3b82f6' : activeTab === 'caniveau' ? '#06b6d4' : '#6366f1', '#374151'],
      borderColor: "#111827",
      borderWidth: 2,
    }]
  };

  return (
    <div className="w-full h-full flex flex-col bg-gray-900 text-gray-100 overflow-hidden relative">
      
      {message && (
        <div className={`fixed top-4 right-4 px-6 py-3 rounded-xl shadow-2xl z-50 font-bold animate-in fade-in slide-in-from-top-2 ${
          message.type === "error" ? "bg-red-600" : "bg-blue-600"
        }`}>
          {message.text}
        </div>
      )}

      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
            <Droplets className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white uppercase tracking-tight">Ouvrages Hydrauliques</h2>
            <p className="text-xs text-gray-400 font-medium italic">Assainissement & Drainage TP</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-gray-500 uppercase font-bold block">Estimation Devis</span>
          <span className={`text-2xl font-black tracking-tighter text-${OUVRAGES_CONFIG[activeTab].color}-400`}>
            {results.total.toLocaleString()} <span className="text-sm text-gray-500 font-normal">{currency}</span>
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-6 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* GAUCHE : CONFIGURATION */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            
            {/* Tab Selector */}
            <div className="grid grid-cols-3 gap-2 bg-gray-800 p-1.5 rounded-2xl border border-gray-700 shadow-inner">
              {Object.entries(OUVRAGES_CONFIG).map(([id, cfg]) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`flex flex-col items-center justify-center py-3 rounded-xl transition-all ${
                    activeTab === id 
                      ? `bg-${cfg.color}-600 text-white shadow-lg` 
                      : "text-gray-500 hover:bg-gray-700"
                  }`}
                >
                  {cfg.icon}
                  <span className="text-[10px] mt-1 font-bold uppercase">{cfg.label}</span>
                </button>
              ))}
            </div>

            <div className="bg-gray-800/50 border border-gray-700 rounded-3xl p-6 space-y-6 shadow-xl">
              <h3 className={`flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-${OUVRAGES_CONFIG[activeTab].color}-400`}>
                <Ruler className="w-4 h-4" /> Dimensionnement (m)
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <InputGroup label="Longueur Totale" value={inputs.longueur} onChange={v => setInputs({...inputs, longueur: v})} />
                <InputGroup label="Épaisseur Parois" value={inputs.epaisseur} onChange={v => setInputs({...inputs, epaisseur: v})} />
                
                {activeTab !== "buse" ? (
                  <>
                    <InputGroup label="Largeur Int." value={inputs.largeurInt} onChange={v => setInputs({...inputs, largeurInt: v})} />
                    <InputGroup label="Hauteur Int." value={inputs.hauteurInt} onChange={v => setInputs({...inputs, hauteurInt: v})} />
                  </>
                ) : (
                  <InputGroup label="Diamètre Int. (Ø)" value={inputs.diametreInt} onChange={v => setInputs({...inputs, diametreInt: v})} full />
                )}
              </div>

              <div className="pt-4 border-t border-gray-700 grid grid-cols-2 gap-4">
                <InputGroup label={`PU Béton (${currency}/m³)`} value={inputs.prixUnitaire} onChange={v => setInputs({...inputs, prixUnitaire: v})} />
                <InputGroup label={`Main d'œuvre (${currency})`} value={inputs.coutMainOeuvre} onChange={v => setInputs({...inputs, coutMainOeuvre: v})} />
              </div>

              <button onClick={handleSave} className={`w-full py-4 rounded-2xl font-bold shadow-lg transition-all flex justify-center items-center gap-2 active:scale-95 bg-${OUVRAGES_CONFIG[activeTab].color}-600 hover:bg-${OUVRAGES_CONFIG[activeTab].color}-500`}>
                <Save className="w-5 h-5" /> Enregistrer l'ouvrage
              </button>
            </div>
          </div>

          {/* DROITE : TABLEAU DE BORD */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            
            <div className="grid grid-cols-3 gap-4">
              <ResultCard label="Volume Béton" value={results.volume.toFixed(2)} unit="m³" icon={<Layers className="w-4 h-4"/>} color={`text-${OUVRAGES_CONFIG[activeTab].color}-400`} bg={`bg-${OUVRAGES_CONFIG[activeTab].color}-500/10`} />
              <ResultCard label="Coffrage" value={results.coffrage.toFixed(1)} unit="m²" icon={<Ruler className="w-4 h-4"/>} color="text-white" bg="bg-gray-800" border />
              <ResultCard label="Acier Estimé" value={results.acierKg.toFixed(0)} unit="kg" icon={<Anchor className="w-4 h-4"/>} color="text-red-400" bg="bg-red-500/10" />
            </div>

            <div className="flex-1 bg-gray-800 rounded-3xl p-8 border border-gray-700 shadow-xl flex flex-col md:flex-row gap-10 items-center relative overflow-hidden">
               <div className={`absolute -bottom-10 -right-10 w-44 h-44 bg-${OUVRAGES_CONFIG[activeTab].color}-600/10 rounded-full blur-3xl pointer-events-none`} />

               <div className="w-44 h-44 flex-shrink-0 relative">
                  <Doughnut data={chartData} options={{ cutout: "75%", plugins: { legend: { display: false } } }} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                     <span className="text-[10px] text-gray-500 uppercase font-bold text-center">Ciment</span>
                     <span className="text-sm font-bold text-white">{results.cimentSacs} sacs</span>
                  </div>
               </div>

               <div className="flex-1 w-full space-y-4">
                  <h4 className="text-gray-400 text-xs font-bold uppercase tracking-widest border-b border-gray-700 pb-2 mb-2">Besoins Logistiques</h4>
                  <MaterialRow label="Ciment (350kg/m³)" val={`${results.cimentT.toFixed(2)} T`} color={`bg-${OUVRAGES_CONFIG[activeTab].color}-500`} />
                  <MaterialRow label={`Acier (${OUVRAGES_CONFIG[activeTab].ratioAcier}kg/m³)`} val={`${results.acierKg.toFixed(0)} kg`} color="bg-red-500" />
                  
                  <div className="pt-2 border-t border-gray-700 flex justify-between items-center">
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Droplets className="w-3 h-3 text-blue-400" /> Eau nécessaire
                    </span>
                    <span className="text-sm font-bold text-white font-mono">{(results.volume * 180).toFixed(0)} L</span>
                  </div>

                  <div className="flex items-start gap-2 p-3 bg-blue-500/5 rounded-xl border border-blue-500/20 mt-4">
                    <Info className="w-4 h-4 text-blue-400 mt-0.5" />
                    <p className="text-[10px] text-blue-200/70 leading-relaxed italic">
                      Les volumes sont calculés sur la base de parois de {inputs.epaisseur}m. Le coffrage inclut les faces intérieures et extérieures.
                    </p>
                  </div>
               </div>
            </div>

            {/* Historique Mini */}
            {historique.length > 0 && (
              <div className="bg-gray-800/30 rounded-2xl border border-gray-700/50 overflow-hidden">
                <div className="px-4 py-2 bg-gray-800/50 border-b border-gray-700/50 flex justify-between items-center text-xs">
                  <h4 className="font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2"><History className="w-3 h-3" /> Historique {activeTab}</h4>
                  <button onClick={() => {setHistorique([]); localStorage.removeItem(STORAGE_KEYS[activeTab])}} className="text-red-400 hover:underline uppercase text-[10px]">Vider</button>
                </div>
                <div className="max-h-[120px] overflow-y-auto">
                  {historique.slice(0, 5).map((item) => (
                    <div key={item.id} className="flex justify-between items-center p-3 border-b border-gray-700/30 hover:bg-gray-700/40 transition-colors">
                      <div className="text-xs">
                        <span className="text-gray-500 block text-[9px]">{item.date}</span>
                        <span className="font-medium uppercase">{item.longueur}m x {item.epaisseur}m</span>
                      </div>
                      <span className={`text-sm font-bold text-${OUVRAGES_CONFIG[activeTab].color}-400`}>{parseFloat(item.total).toLocaleString()} {currency}</span>
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
      className="w-full bg-gray-900 border border-gray-600 rounded-xl px-4 py-2.5 text-white focus:border-blue-500 outline-none transition-all font-mono text-sm"
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