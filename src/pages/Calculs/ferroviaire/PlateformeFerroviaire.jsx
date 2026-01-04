import React, { useState, useEffect, useMemo } from "react";
import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS, ArcElement, Tooltip, Legend,
} from "chart.js";
import { 
  Mountain, Ruler, Banknote, Save, Trash2, History, Truck, Weight, Info, Layers, MoveRight
} from "lucide-react";

ChartJS.register(ArcElement, Tooltip, Legend);

const STORAGE_KEY = "plateforme-rail-history-pro";

// Configuration Technique (Standards Bureau d'Études)
const SOIL_CONFIG = {
  GRAVE: { label: "Grave de remblai (GNT)", density: 2.1, compacting: 1.30, icon: "🪨" },
  SABLE: { label: "Sable stabilisé", density: 1.8, compacting: 1.20, icon: "⏳" },
  TERRE: { label: "Terre de remblai", density: 1.6, compacting: 1.25, icon: "🌱" },
};

export default function PlateformeFerroviaire({ currency = "XOF", onMateriauxChange = () => {} }) {
  
  // --- ÉTATS ---
  const [soilType, setSoilType] = useState("GRAVE");
  const [inputs, setInputs] = useState({
    longueur: "",
    largeur: "",
    epaisseur: "0.50",
    prixTonne: "",      // Prix du remblai à la tonne
    coutEngins: "",     // Location pelle + compacteur
    margePerte: "5"
  });

  const [historique, setHistorique] = useState([]);
  const [message, setMessage] = useState(null);

  // --- MOTEUR DE CALCUL (LOGIQUE BE) ---
  const results = useMemo(() => {
    const L = parseFloat(inputs.longueur) || 0;
    const l = parseFloat(inputs.largeur) || 0;
    const e = parseFloat(inputs.epaisseur) || 0;
    const config = SOIL_CONFIG[soilType];
    const margin = 1 + (parseFloat(inputs.margePerte) || 0) / 100;

    // 1. Volumes
    const volumeFini = L * l * e; // Volume géométrique compacté
    const volumeCommande = volumeFini * config.compacting * margin;

    // 2. Masses (Logistique)
    const tonnageTotal = volumeCommande * config.density;
    const nbCamions = Math.ceil(tonnageTotal / 25); // Camions de 25 Tonnes

    // 3. Coûts
    const coutFourniture = tonnageTotal * (parseFloat(inputs.prixTonne) || 0);
    const total = coutFourniture + (parseFloat(inputs.coutEngins) || 0);

    return {
      volumeFini,
      volumeCommande,
      tonnageTotal,
      nbCamions,
      coutFourniture,
      total
    };
  }, [inputs, soilType]);

  // --- SYNC PARENT ---
  useEffect(() => {
    onMateriauxChange({ 
      volumeTerrassement: results.volumeFini,
      tonnageRemblais: results.tonnageTotal,
      nbCamions: results.nbCamions
    });
  }, [results.volumeFini, onMateriauxChange]);

  // --- HISTORIQUE ---
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) try { setHistorique(JSON.parse(saved)); } catch(e) {}
  }, []);

  const handleSave = () => {
    if (results.total <= 0) return showToast("⚠️ Données invalides", "error");
    const newEntry = {
      id: Date.now(),
      date: new Date().toLocaleString(),
      soilLabel: SOIL_CONFIG[soilType].label,
      ...inputs, ...results
    };
    const newHist = [newEntry, ...historique];
    setHistorique(newHist);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newHist));
    showToast("✅ Plateforme enregistrée !");
  };

  const showToast = (msg, type = "success") => {
    setMessage({ text: msg, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const chartData = {
    labels: ["Fourniture Remblai", "Mise en œuvre / Engins"],
    datasets: [{
      data: [results.coutFourniture, parseFloat(inputs.coutEngins || 0)],
      backgroundColor: ["#4f46e5", "#1e293b"],
      borderColor: "#111827",
      borderWidth: 2,
    }]
  };

  return (
    <div className="w-full h-full flex flex-col bg-gray-950 text-gray-100 overflow-hidden relative font-sans">
      
      {/* Toast */}
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
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white uppercase tracking-tight">Infrastructure : Plateforme</h2>
            <p className="text-xs text-gray-400 font-medium italic">Terrassement et Remblais techniques</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-gray-500 uppercase font-bold block tracking-widest">Estimation Phase</span>
          <span className="text-2xl font-black text-indigo-400 tracking-tighter">
            {results.total.toLocaleString()} <span className="text-sm text-gray-500 font-normal">{currency}</span>
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-6 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
          
          {/* GAUCHE : SAISIE */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            
            {/* 1. Nature du Remblai */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 shadow-lg">
              <h3 className="flex items-center gap-2 text-xs font-bold text-indigo-400 uppercase tracking-widest mb-4">
                <Mountain className="w-4 h-4" /> Matériau d'apport
              </h3>
              <div className="grid grid-cols-1 gap-2">
                {Object.entries(SOIL_CONFIG).map(([key, sol]) => (
                  <button
                    key={key}
                    onClick={() => setSoilType(key)}
                    className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between ${
                      soilType === key ? "border-indigo-500 bg-indigo-500/10 shadow-lg shadow-indigo-900/10" : "border-gray-800 bg-gray-900"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                        <span className="text-lg">{sol.icon}</span>
                        <span className={`text-xs font-bold ${soilType === key ? "text-indigo-400" : "text-gray-500"}`}>{sol.label}</span>
                    </div>
                    <span className="text-[10px] text-gray-600 italic">densité: {sol.density}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Géométrie */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 shadow-lg">
              <h3 className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
                <Ruler className="w-4 h-4" /> Cubature de plateforme
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label="Longueur (m)" value={inputs.longueur} onChange={v => setInputs({...inputs, longueur: v})} placeholder="Ex: 1000" />
                <InputGroup label="Largeur (m)" value={inputs.largeur} onChange={v => setInputs({...inputs, largeur: v})} placeholder="Ex: 8.5" />
                <InputGroup label="Ép. Compactée (m)" value={inputs.epaisseur} onChange={v => setInputs({...inputs, epaisseur: v})} placeholder="0.50" />
                <InputGroup label="Pertes (%)" value={inputs.margePerte} onChange={v => setInputs({...inputs, margePerte: v})} placeholder="5" />
              </div>
            </div>

            {/* 3. Financier */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 shadow-lg flex-1">
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label={`Prix Remblai (${currency}/T)`} value={inputs.prixTonne} onChange={v => setInputs({...inputs, prixTonne: v})} />
                <InputGroup label={`Mise en œuvre (${currency})`} value={inputs.coutEngins} onChange={v => setInputs({...inputs, coutEngins: v})} />
              </div>
              <button 
                onClick={handleSave}
                className="w-full mt-6 bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-xl font-bold shadow-lg transition-all flex justify-center items-center gap-2 active:scale-95"
              >
                <Save className="w-5 h-5" /> Enregistrer la Section
              </button>
            </div>
          </div>

          {/* DROITE : RÉSULTATS */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            
            <div className="grid grid-cols-3 gap-4">
              <ResultCard label="Masse Totale" value={results.tonnageTotal.toFixed(1)} unit="Tons" icon={<Weight className="w-4 h-4"/>} color="text-indigo-400" bg="bg-indigo-500/10" border />
              <ResultCard label="Nb Camions" value={results.nbCamions} unit="u" icon={<Truck className="w-4 h-4"/>} color="text-white" bg="bg-gray-800" />
              <ResultCard label="Volume Fini" value={results.volumeFini.toFixed(1)} unit="m³" icon={<MoveRight className="w-4 h-4"/>} color="text-emerald-400" bg="bg-emerald-500/10" />
            </div>

            <div className="flex-1 bg-gray-900 rounded-3xl p-8 border border-gray-800 shadow-xl flex flex-col md:flex-row gap-10 items-center relative overflow-hidden">
               <div className="absolute -bottom-10 -right-10 w-44 h-44 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

               <div className="w-48 h-48 flex-shrink-0 relative">
                  <Doughnut data={chartData} options={{ cutout: "75%", plugins: { legend: { display: false } } }} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                     <span className="text-[10px] text-gray-500 uppercase font-bold text-center leading-tight">Volume<br/>à commander</span>
                     <span className="text-sm font-bold text-white">{results.volumeCommande.toFixed(1)} m³</span>
                  </div>
               </div>

               <div className="flex-1 w-full space-y-4">
                  <h4 className="text-gray-400 text-xs font-bold uppercase tracking-widest border-b border-gray-800 pb-2 mb-2">Bilan Logistique</h4>
                  
                  <MaterialRow label="Remblais (Apport)" val={`${results.tonnageTotal.toFixed(1)} Tonnes`} color="bg-indigo-500" />
                  <MaterialRow label="Transport (25T / camion)" val={`${results.nbCamions} voyages`} color="bg-slate-600" />
                  
                  <div className="flex items-start gap-2 p-3 bg-blue-500/5 rounded-xl border border-blue-500/20 mt-4">
                    <Info className="w-4 h-4 text-indigo-400 mt-0.5" />
                    <p className="text-[10px] text-indigo-200/70 leading-relaxed italic">
                      Ce calcul inclut un <strong>coefficient de compactage de {Math.round((SOIL_CONFIG[soilType].compacting - 1) * 100)}%</strong>. Le tonnage représente la quantité réelle à livrer pour compenser le tassement sous les rouleaux.
                    </p>
                  </div>
               </div>
            </div>

            {/* Historique Mini */}
            {historique.length > 0 && (
              <div className="bg-gray-800/30 rounded-2xl border border-gray-700/50 overflow-hidden">
                <div className="px-4 py-2 bg-gray-800/50 border-b border-gray-700/50 flex justify-between items-center text-xs">
                  <h4 className="font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2"><History className="w-3 h-3" /> Historique plateforme</h4>
                  <button onClick={() => {setHistorique([]); localStorage.removeItem(STORAGE_KEY)}} className="text-red-400 hover:underline uppercase text-[10px]">Vider</button>
                </div>
                <div className="max-h-[120px] overflow-y-auto">
                  {historique.slice(0, 5).map((item) => (
                    <div key={item.id} className="flex justify-between items-center p-3 border-b border-gray-700/30 hover:bg-gray-800 transition-colors">
                      <div className="text-xs">
                        <span className="text-gray-500 block text-[9px]">{item.date}</span>
                        <span className="font-medium uppercase tracking-tighter">{item.longueur}m x {item.largeur}m • {item.soilLabel}</span>
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