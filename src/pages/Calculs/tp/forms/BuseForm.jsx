import React, { useState, useEffect, useMemo } from "react";
import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS, ArcElement, Tooltip, Legend,
} from "chart.js";
import { 
  Waves, Ruler, Banknote, Save, Trash2, History, Anchor, Droplets, Info, Activity, Package
} from "lucide-react";
import { useCalculator } from "../../../../shared/hooks/useCalculator.js";
import { BuseCalculator, BUSE_CONSTANTS } from "@/domains/tp/calculators/BuseCalculator.js";

ChartJS.register(ArcElement, Tooltip, Legend);

const STORAGE_KEY = "buse-history-pro";

export default function BuseForm({ 
  currency = "FCFA",
  onCostChange = () => {},
  onMateriauxChange = () => {}
}) {
  const { inputs, results, updateInput, isValid } = useCalculator(BuseCalculator, "buse", "tp");

  const [historique, setHistorique] = useState([]);
  const [message, setMessage] = useState(null);
  const [showHydraulique, setShowHydraulique] = useState(true);

  // --- SYNC PARENT ---
  useEffect(() => {
    onCostChange(results?.total ?? 0);
    if (results && isValid) {
      onMateriauxChange({
        volume: results.volume,
        ciment: results.cimentT,
        acier: results.acierT,
        sable: results.sableT,
        gravier: results.gravierT
      });
    }
  }, [results?.total, isValid]);

  // --- HISTORIQUE ---
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) try { setHistorique(JSON.parse(saved)); } catch (e) {}
  }, []);

  const handleSave = () => {
    if (!isValid || !results?.volume) return showToast("⚠️ Données incomplètes", "error");
    const newEntry = {
      id: Date.now(),
      date: new Date().toLocaleString('fr-FR'),
      ...inputs, ...results,
    };
    const newHist = [newEntry, ...historique];
    setHistorique(newHist);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newHist));
    showToast("✅ Calcul Buse sauvegardé !");
  };

  const showToast = (msg, type = "success") => {
    setMessage({ text: msg, type });
    setTimeout(() => setMessage(null), 3000);
  };

  // --- CALCULS HYDRAULIQUES ---
  const hydraulique = useMemo(() => {
    if (!isValid || !results?.volume) return null;
    const calc = new BuseCalculator(inputs);
    return calc.estimerCapaciteHydraulique(1, 0.013); // Pente 1%, Manning 0.013 (Béton lisse)
  }, [inputs, isValid]);

  const chartData = {
    labels: ["Fournitures", "Pose/MO"],
    datasets: [{
      data: [results?.coutMateriaux || 0, results?.coutMainOeuvre || 0],
      backgroundColor: ["#06b6d4", "#374151"],
      borderColor: "#111827",
      borderWidth: 2,
    }]
  };

  return (
    <div className="w-full h-full flex flex-col bg-gray-900 text-gray-100 overflow-hidden relative font-sans">
      
      {/* Notification Toast */}
      {message && (
        <div className={`fixed top-4 right-4 px-6 py-3 rounded-xl shadow-2xl z-50 font-bold animate-in fade-in slide-in-from-top-2 ${
          message.type === 'error' ? 'bg-red-600' : 'bg-cyan-600'
        }`}>
          {message.text}
        </div>
      )}

      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cyan-600/20 rounded-lg text-cyan-500">
            <Waves className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white uppercase tracking-tight">Ouvrages : Buses</h2>
            <p className="text-xs text-gray-400 font-medium italic">Hydraulique & Assainissement</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-gray-500 uppercase font-bold block">Estimation Ouvrage</span>
          <span className="text-2xl font-black text-cyan-400 tracking-tighter">
            {(results?.total || 0).toLocaleString()} <span className="text-sm text-gray-500 font-normal">{currency}</span>
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-6 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
          
          {/* GAUCHE : INPUTS */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            <div className="bg-gray-800/50 border border-gray-700 rounded-3xl p-6 shadow-xl space-y-6">
              <h3 className="flex items-center gap-2 text-xs font-bold text-cyan-400 uppercase tracking-widest">
                <Ruler className="w-4 h-4" /> Dimensionnement (ml)
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label="Diamètre Ø (m)" value={inputs.diametre} onChange={(e) => updateInput("diametre", e.target.value)} placeholder="0.80" />
                <InputGroup label="Longueur (m)" value={inputs.longueur} onChange={(e) => updateInput("longueur", e.target.value)} placeholder="2.00" />
                <InputGroup label="Quantité (u)" value={inputs.quantite} onChange={(e) => updateInput("quantite", e.target.value)} placeholder="1" full />
              </div>
              <p className="text-[9px] text-gray-500 uppercase font-bold">Standards: 0.60, 0.80, 1.00, 1.20 m</p>
            </div>

            <div className="bg-gray-800/50 border border-gray-700 rounded-3xl p-6 shadow-xl space-y-6 flex-1">
              <h3 className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
                <Banknote className="w-4 h-4" /> Paramètres Financiers
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label={`Prix Buse (${currency}/u)`} value={inputs.prixUnitaire} onChange={(e) => updateInput("prixUnitaire", e.target.value)} />
                <InputGroup label={`Main d'œuvre (${currency})`} value={inputs.coutMainOeuvre} onChange={(e) => updateInput("coutMainOeuvre", e.target.value)} />
              </div>
              <button 
                onClick={handleSave}
                className="w-full bg-cyan-600 hover:bg-cyan-500 text-white py-4 rounded-2xl font-bold shadow-lg transition-all flex justify-center items-center gap-2 active:scale-95"
              >
                <Save className="w-5 h-5" /> Enregistrer la ligne
              </button>
            </div>
          </div>

          {/* DROITE : RÉSULTATS */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            
            <div className="grid grid-cols-3 gap-4">
              <ResultCard label="Volume Béton" value={results?.volume?.toFixed(2)} unit="m³" icon={<Package className="w-4 h-4"/>} color="text-cyan-400" bg="bg-cyan-500/10" />
              <ResultCard label="Linéaire Total" value={(inputs.longueur * inputs.quantite).toFixed(1)} unit="ml" icon={<Ruler className="w-4 h-4"/>} color="text-white" bg="bg-gray-800" border />
              <ResultCard label="Acier Estimé" value={(results?.acierKg || 0).toFixed(0)} unit="kg" icon={<Anchor className="w-4 h-4"/>} color="text-red-400" bg="bg-red-500/10" />
            </div>

            {/* Panel Analyse Hydraulique */}
            <div className={`p-6 rounded-3xl border transition-all flex items-center gap-6 ${hydraulique ? 'bg-blue-600/10 border-blue-500/30 shadow-blue-900/10 shadow-lg' : 'bg-gray-800 border-gray-700'}`}>
                <div className={`p-4 rounded-2xl ${hydraulique ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-700 text-gray-500'}`}>
                  <Activity className="w-8 h-8" />
                </div>
                <div className="flex-1 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-gray-500">Débit de pointe (Max)</p>
                    <span className="text-xl font-black text-blue-400">{hydraulique?.debit || "0.00"} <small className="text-xs">m³/h</small></span>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-gray-500">Vitesse écoulement</p>
                    <span className="text-xl font-black text-blue-400">{hydraulique?.vitesse || "0.00"} <small className="text-xs">m/s</small></span>
                  </div>
                </div>
                <Info className="w-5 h-5 text-gray-600 cursor-help" title="Calcul selon Manning (n=0.013, i=1%)" />
            </div>

            <div className="flex-1 bg-gray-800 rounded-3xl p-6 border border-gray-700 shadow-xl flex flex-col md:flex-row gap-8 items-center relative overflow-hidden">
               <div className="w-44 h-44 flex-shrink-0 relative">
                  <Doughnut data={chartData} options={{ cutout: "75%", plugins: { legend: { display: false } } }} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                     <span className="text-[10px] text-gray-500 uppercase font-bold">Ciment</span>
                     <span className="text-sm font-bold text-white">{results?.cimentSacs?.toFixed(1) || 0} sacs</span>
                  </div>
               </div>

               <div className="flex-1 w-full space-y-4">
                  <h4 className="text-gray-400 text-xs font-bold uppercase tracking-widest border-b border-gray-700 pb-2 mb-2">Détails Fournitures</h4>
                  <MaterialRow label="Ciment (Buses + Calage)" val={`${(results?.cimentT || 0).toFixed(2)} t`} color="bg-cyan-500" />
                  <MaterialRow label="Sable / Granulats" val={`${(results?.sableT || 0).toFixed(2)} t`} color="bg-amber-500" />
                  <MaterialRow label="Acier d'armature" val={`${(results?.acierKg || 0).toFixed(0)} kg`} color="bg-red-500" />
                  <div className="pt-2 border-t border-gray-700 flex justify-between items-center">
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Droplets className="w-3 h-3 text-cyan-400" /> Eau nécessaire
                    </span>
                    <span className="text-sm font-bold text-white">{(results?.eauL || 0).toFixed(0)} L</span>
                  </div>
               </div>
            </div>

            {/* Historique Mini */}
            {historique.length > 0 && (
              <div className="bg-gray-800/30 rounded-2xl border border-gray-700/50 overflow-hidden">
                <div className="px-4 py-3 bg-gray-800/50 border-b border-gray-700/50 flex justify-between items-center">
                  <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2"><History className="w-3 h-3" /> Devis Récents</h4>
                  <button onClick={() => {setHistorique([]); localStorage.removeItem(STORAGE_KEY)}} className="text-[10px] text-red-400 hover:underline uppercase">Vider</button>
                </div>
                <div className="max-h-[120px] overflow-y-auto">
                  {historique.slice(0, 5).map((item) => (
                    <div key={item.id} className="flex justify-between items-center p-3 border-b border-gray-700/30 hover:bg-gray-700/40 transition-colors">
                      <div className="text-xs">
                        <span className="text-gray-500 block text-[9px]">{item.date}</span>
                        <span className="font-medium">Ø{item.diametre} - {item.quantite}u ({item.longueur}m)</span>
                      </div>
                      <span className="text-sm font-bold text-cyan-400">{(item.total || 0).toLocaleString()} {currency}</span>
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
    <label className="mb-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-wide">{label}</label>
    <input
      type="number" value={value || ""} onChange={onChange}
      className="w-full bg-gray-900 border border-gray-600 rounded-xl px-4 py-3 text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all font-mono text-sm"
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