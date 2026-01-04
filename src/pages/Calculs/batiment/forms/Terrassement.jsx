import React, { useState, useEffect, useMemo } from "react";
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { 
  Pickaxe, Ruler, Banknote, Save, Trash2, History, Truck, Info, Mountain
} from "lucide-react";

ChartJS.register(ArcElement, Tooltip, Legend);

const STORAGE_KEY = "terrassement-history";

// Table des coefficients de foisonnement professionnels
const NATURE_SOL = {
  SABLE: { label: "Sable / Gravier", coeff: 1.15, icon: "" },
  TERRE: { label: "Terre Ordinaire", coeff: 1.25, icon: "" },
  ARGILE: { label: "Argile / Limon", coeff: 1.35, icon: "" },
  ROCHE: { label: "Roche / Remblai compact", coeff: 1.50, icon: "" },
};

export default function Terrassement({ currency = "XOF", onCostChange }) {
  
  // --- ÉTATS ---
  const [inputs, setInputs] = useState({
    typeSol: "TERRE",
    longueur: "",
    largeur: "",
    profondeur: "",
    prixExcavation: "", 
    prixEvacuation: "", 
    capaciteCamion: "16",
  });

  const [historique, setHistorique] = useState([]);
  const [message, setMessage] = useState(null);

  // --- MOTEUR DE CALCUL ---
  const results = useMemo(() => {
    const L = parseFloat(inputs.longueur) || 0;
    const l = parseFloat(inputs.largeur) || 0;
    const p = parseFloat(inputs.profondeur) || 0;
    
    // Récupération du coefficient selon le sol choisi
    const coeff = NATURE_SOL[inputs.typeSol].coeff;

    // Volumes
    const volEnPlace = L * l * p; 
    const volFoisonne = volEnPlace * coeff; 

    // Coûts
    const puExcav = parseFloat(inputs.prixExcavation) || 0;
    const puEvac = parseFloat(inputs.prixEvacuation) || 0;
    
    const coutExcavation = volEnPlace * puExcav;
    const coutEvacuation = volFoisonne * puEvac; // On paie le transport au volume chargé

    const total = coutExcavation + coutEvacuation;

    // Logistique
    const capCamion = parseFloat(inputs.capaciteCamion) || 16;
    const nbCamions = Math.ceil(volFoisonne / capCamion);

    return {
      volEnPlace,
      volFoisonne,
      coeff,
      coutExcavation,
      coutEvacuation,
      total,
      nbCamions
    };
  }, [inputs]);

  // --- SYNC PARENT ---
  useEffect(() => {
    if (onCostChange) onCostChange(results.total);
  }, [results.total, onCostChange]);

  // --- HISTORIQUE ---
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setHistorique(JSON.parse(saved));
    } catch {}
  }, []);

  const handleSave = () => {
    if (results.volEnPlace <= 0) return showToast("⚠️ Dimensions invalides", "error");
    
    const newEntry = {
      id: Date.now(),
      date: new Date().toLocaleString(),
      typeSolLabel: NATURE_SOL[inputs.typeSol].label,
      ...inputs,
      ...results
    };

    const newHist = [newEntry, ...historique];
    setHistorique(newHist);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newHist));
    showToast("✅ Calcul enregistré");
  };

  const showToast = (msg, type = "success") => {
    setMessage({ text: msg, type });
    setTimeout(() => setMessage(null), 3000);
  };

  // --- CHART DATA ---
  const chartData = {
    labels: ["Excavation", "Évacuation"],
    datasets: [{
      data: [results.coutExcavation, results.coutEvacuation],
      backgroundColor: ["#f59e0b", "#78716c"],
      borderColor: "#111827",
      borderWidth: 2,
    }]
  };

  return (
    <div className="w-full h-full flex flex-col bg-gray-900 text-gray-100 overflow-hidden relative">
      
      {message && (
        <div className={`fixed top-4 right-4 px-6 py-3 rounded-xl shadow-2xl z-50 font-bold animate-in fade-in slide-in-from-top-2 ${
          message.type === "error" ? "bg-red-600" : "bg-amber-600"
        }`}>
          {message.text}
        </div>
      )}

      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/20 rounded-lg text-amber-500">
            <Pickaxe className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Terrassement</h2>
            <p className="text-xs text-gray-400 font-medium">Préparation du terrain</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-gray-500 uppercase font-bold block">Budget Estimé</span>
          <span className="text-2xl font-black text-amber-400 tracking-tighter">
            {results.total.toLocaleString()} <span className="text-sm text-gray-500 font-normal">{currency}</span>
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
          
          {/* GAUCHE : PARAMÈTRES */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            
            {/* 1. Nature du sol */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5">
              <h3 className="flex items-center gap-2 text-xs font-bold text-amber-500 uppercase tracking-widest mb-4">
                <Mountain className="w-4 h-4" /> Nature du Terrain
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(NATURE_SOL).map(([key, sol]) => (
                  <button
                    key={key}
                    onClick={() => setInputs(prev => ({...prev, typeSol: key}))}
                    className={`p-3 rounded-xl border transition-all text-left flex flex-col ${
                      inputs.typeSol === key 
                      ? "border-amber-500 bg-amber-500/10" 
                      : "border-gray-700 bg-gray-800 hover:border-gray-500"
                    }`}
                  >
                    <span className="text-lg">{sol.icon}</span>
                    <span className={`text-xs font-bold ${inputs.typeSol === key ? "text-amber-400" : "text-gray-400"}`}>
                      {sol.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Dimensions */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5">
              <h3 className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
                <Ruler className="w-4 h-4" /> Volume à creuser
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label="Longueur (m)" value={inputs.longueur} onChange={(e) => setInputs({...inputs, longueur: e.target.value})} />
                <InputGroup label="Largeur (m)" value={inputs.largeur} onChange={(e) => setInputs({...inputs, largeur: e.target.value})} />
                <InputGroup label="Profondeur (m)" value={inputs.profondeur} onChange={(e) => setInputs({...inputs, profondeur: e.target.value})} full />
              </div>
            </div>

            {/* 3. Financier */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5">
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label={`Excavation (${currency}/m³)`} value={inputs.prixExcavation} onChange={(e) => setInputs({...inputs, prixExcavation: e.target.value})} />
                <InputGroup label={`Évacuation (${currency}/m³)`} value={inputs.prixEvacuation} onChange={(e) => setInputs({...inputs, prixEvacuation: e.target.value})} />
              </div>
              <button 
                onClick={handleSave}
                className="w-full mt-6 bg-amber-600 hover:bg-amber-500 text-white py-4 rounded-xl font-bold shadow-lg transition-all flex justify-center items-center gap-2"
              >
                <Save className="w-5 h-5" /> Enregistrer le calcul
              </button>
            </div>
          </div>

          {/* DROITE : RÉSULTATS */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            
            <div className="grid grid-cols-3 gap-4">
              <ResultCard label="Volume Brut" value={results.volEnPlace.toFixed(1)} unit="m³" icon="🧊" color="text-amber-400" bg="bg-amber-500/10" />
              <ResultCard label="Volume Réel" value={results.volFoisonne.toFixed(1)} unit="m³" icon="🌋" color="text-orange-400" bg="bg-orange-500/10" border />
              <ResultCard label="Camions" value={results.nbCamions} unit="voyages" icon={<Truck className="w-4 h-4"/>} color="text-stone-300" bg="bg-stone-500/10" />
            </div>

            <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 shadow-xl flex flex-col md:flex-row gap-8 items-center">
               <div className="w-40 h-40 flex-shrink-0 relative">
                  <Doughnut data={chartData} options={{ cutout: "75%", plugins: { legend: { display: false } } }} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                     <span className="text-[10px] text-gray-500 uppercase">Coût Total</span>
                     <span className="text-sm font-bold text-white">{Math.round(results.total).toLocaleString()}</span>
                  </div>
               </div>

               <div className="flex-1 w-full space-y-4">
                  <h4 className="text-gray-400 text-xs font-bold uppercase tracking-widest border-b border-gray-700 pb-2">Analyse Technique</h4>
                  <div className="space-y-3">
                    <MaterialRow label="Excavation (Volume en place)" val={`${results.coutExcavation.toLocaleString()} ${currency}`} color="bg-amber-500" />
                    <MaterialRow label="Transport (Volume foisonné)" val={`${results.coutEvacuation.toLocaleString()} ${currency}`} color="bg-stone-500" />
                    
                    <div className="flex items-start gap-2 p-3 bg-blue-500/5 rounded-lg border border-blue-500/20 mt-4">
                      <Info className="w-4 h-4 text-blue-400 mt-0.5" />
                      <p className="text-[11px] text-blue-200/70 leading-relaxed">
                        Le sol de type <strong>{NATURE_SOL[inputs.typeSol].label}</strong> augmente le volume de <strong>{Math.round((results.coeff - 1) * 100)}%</strong> une fois extrait. C'est ce volume "gonflé" qui détermine le coût du transport.
                      </p>
                    </div>
                  </div>
               </div>
            </div>

            {/* Historique Mini */}
            {historique.length > 0 && (
              <div className="bg-gray-800/30 rounded-2xl border border-gray-700/50 overflow-hidden">
                <div className="px-4 py-2 bg-gray-800/50 border-b border-gray-700/50 flex justify-between items-center">
                  <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                    <History className="w-3 h-3" /> Historique de terrassement
                  </h4>
                </div>
                <div className="max-h-[150px] overflow-y-auto">
                  {historique.slice(0, 5).map((item) => (
                    <div key={item.id} className="flex justify-between items-center p-3 border-b border-gray-700/30 hover:bg-gray-700/40">
                      <div className="text-xs">
                        <span className="text-gray-500 block text-[10px]">{item.date}</span>
                        <span className="font-medium">{item.typeSolLabel} - {item.volEnPlace} m³</span>
                      </div>
                      <span className="text-sm font-bold text-amber-500">{parseFloat(item.total).toLocaleString()} {currency}</span>
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
    <label className="mb-1 text-[10px] font-bold text-gray-500 uppercase tracking-wide">{label}</label>
    <input
      type="number"
      value={value}
      onChange={onChange}
      className="w-full bg-gray-900 border border-gray-600 rounded-xl px-4 py-2.5 text-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all font-mono text-sm"
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
      {value} <span className="text-xs font-normal text-gray-500">{unit}</span>
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