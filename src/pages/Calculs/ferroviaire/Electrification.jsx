import React, { useState, useEffect, useMemo } from "react";
import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS, ArcElement, Tooltip, Legend,
} from "chart.js";
import { 
  Zap, Ruler, Banknote, Save, Trash2, History, Info, 
  TowerControl, Cpu, HardHat, Activity, TrendingUp
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

ChartJS.register(ArcElement, Tooltip, Legend);

const STORAGE_KEY = "electrification-rail-history-pro";

// Configuration Technique (Standards Bureau d'Études Ferroviaire)
const ELEC_CONSTANTS = {
  espacementPoteaux: 50, // 1 poteau tous les 50 mètres
  cuivreKgParKm: 1800,   // ~1.8 tonne de cuivre par km de ligne
};

export default function Electrification({ currency = "XOF", onCostChange = () => {} }) {
  
  // --- ÉTATS ---
  const [inputs, setInputs] = useState({
    longueurKm: "",
    nbSousStations: "1",
    prixKmCatenaire: "", // Fourniture fil + accessoires
    prixUnitairePoste: "", // Prix d'une sous-station
    coutMainOeuvre: "",
    margeSecurite: "5"
  });

  const [historique, setHistorique] = useState([]);
  const [message, setMessage] = useState(null);

  // --- MOTEUR DE CALCUL (LOGIQUE BE) ---
  const results = useMemo(() => {
    const L_km = parseFloat(inputs.longueurKm) || 0;
    const L_m = L_km * 1000;
    const nbPostes = parseFloat(inputs.nbSousStations) || 0;
    const puCatenaire = parseFloat(inputs.prixKmCatenaire) || 0;
    const puPoste = parseFloat(inputs.prixUnitairePoste) || 0;
    const mo = parseFloat(inputs.coutMainOeuvre) || 0;
    const margin = 1 + (parseFloat(inputs.margeSecurite) || 0) / 100;

    // 1. Logistique
    const nbPoteaux = Math.ceil(L_m / ELEC_CONSTANTS.espacementPoteaux);
    const masseCuivreT = (L_km * ELEC_CONSTANTS.cuivreKgParKm) / 1000;

    // 2. Coûts
    const coutLigne = L_km * puCatenaire;
    const coutPostes = nbPostes * puPoste;
    const totalGlobal = (coutLigne + coutPostes + mo) * margin;

    return {
      nbPoteaux,
      masseCuivreT,
      coutLigne,
      coutPostes,
      totalGlobal,
      coutMo: mo
    };
  }, [inputs]);

  // --- SYNC PARENT ---
  useEffect(() => {
    onCostChange(results.totalGlobal);
  }, [results.totalGlobal, onCostChange]);

  // --- HISTORIQUE ---
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) try { setHistorique(JSON.parse(saved)); } catch(e) {}
  }, []);

  const handleSave = () => {
    if (results.totalGlobal <= 0) return showToast("⚠️ Saisie incomplète", "error");
    const newEntry = {
      id: Date.now(),
      date: new Date().toLocaleString('fr-FR'),
      ...inputs, ...results
    };
    const newHist = [newEntry, ...historique];
    setHistorique(newHist);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newHist));
    showToast("✅ Chiffrage élec. enregistré !");
  };

  const showToast = (msg, type = "success") => {
    setMessage({ text: msg, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const chartData = {
    labels: ["Caténaires", "Sous-stations", "Main d'œuvre"],
    datasets: [{
      data: [results.coutLigne, results.coutPostes, results.coutMo],
      backgroundColor: ["#eab308", "#f59e0b", "#1e293b"],
      borderColor: "#111827",
      borderWidth: 2,
    }]
  };

  return (
    <div className="w-full h-full flex flex-col bg-gray-950 text-gray-100 overflow-hidden relative font-sans">
      
      {/* Notification Toast */}
      <AnimatePresence>
        {message && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-4 right-4 px-6 py-3 rounded-xl shadow-2xl z-50 font-bold ${
            message.type === "error" ? "bg-red-600" : "bg-amber-600"
          }`}>
            {message.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-600/20 rounded-lg text-amber-500 shadow-[0_0_15px_rgba(234,179,8,0.3)]">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white uppercase tracking-tight">Système : Électrification</h2>
            <p className="text-xs text-gray-400 font-medium italic">Caténaires & Postes de traction</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-gray-500 uppercase font-bold block tracking-widest">Total Lot 27.5kV</span>
          <span className="text-2xl font-black text-amber-400 tracking-tighter">
            {results.totalGlobal.toLocaleString()} <span className="text-sm text-gray-500 font-normal">{currency}</span>
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-6 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
          
          {/* GAUCHE : SAISIE (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            
            {/* 1. Ligne Caténaire */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 shadow-lg">
              <h3 className="flex items-center gap-2 text-xs font-bold text-amber-500 uppercase tracking-widest mb-4">
                <TowerControl className="w-4 h-4" /> Infrastructure Linéaire
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label="Longueur (km)" value={inputs.longueurKm} onChange={v => setInputs({...inputs, longueurKm: v})} placeholder="Ex: 50" />
                <InputGroup label={`PU Ligne (${currency}/km)`} value={inputs.prixKmCatenaire} onChange={v => setInputs({...inputs, prixKmCatenaire: v})} />
              </div>
            </div>

            {/* 2. Puissance & Postes */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 shadow-lg">
              <h3 className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
                <Cpu className="w-4 h-4" /> Sous-stations de traction
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label="Nb Sous-stations" value={inputs.nbSousStations} onChange={v => setInputs({...inputs, nbSousStations: v})} placeholder="Ex: 2" />
                <InputGroup label={`Prix / Unité (${currency})`} value={inputs.prixUnitairePoste} onChange={v => setInputs({...inputs, prixUnitairePoste: v})} />
              </div>
            </div>

            {/* 3. Pose & Marges */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 shadow-lg flex-1">
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label={`Main d'œuvre (${currency})`} value={inputs.coutMainOeuvre} onChange={v => setInputs({...inputs, coutMainOeuvre: v})} />
                <InputGroup label="Aléas (%)" value={inputs.margeSecurite} onChange={v => setInputs({...inputs, margeSecurite: v})} />
              </div>

              <button 
                onClick={handleSave}
                className="w-full bg-amber-600 hover:bg-amber-500 text-white py-4 rounded-xl font-bold shadow-lg shadow-amber-900/20 transition-all flex justify-center items-center gap-2 active:scale-95 mt-6"
              >
                <Save className="w-5 h-5" /> Enregistrer le chiffrage
              </button>
            </div>
          </div>

          {/* DROITE : DASHBOARD (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            
            <div className="grid grid-cols-3 gap-4">
              <ResultCard label="Poteaux Supports" value={results.nbPoteaux} unit="mâts" icon={<TowerControl className="w-4 h-4"/>} color="text-amber-400" bg="bg-amber-500/10" border />
              <ResultCard label="Masse Cuivre" value={results.masseCuivreT.toFixed(1)} unit="Tons" icon={<Weight className="w-4 h-4"/>} color="text-white" bg="bg-gray-800" />
              <ResultCard label="Coût / Km" value={results.longueurKm > 0 ? Math.round(results.totalGlobal / results.longueurKm).toLocaleString() : 0} unit={currency} icon={<TrendingUp className="w-4 h-4"/>} color="text-emerald-400" bg="bg-emerald-500/10" />
            </div>

            <div className="flex-1 bg-gray-900 rounded-3xl p-8 border border-gray-800 shadow-xl flex flex-col md:flex-row gap-10 items-center relative overflow-hidden">
               <div className="absolute -bottom-10 -right-10 w-44 h-44 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />

               <div className="w-48 h-48 flex-shrink-0 relative">
                  <Doughnut data={chartData} options={{ cutout: "75%", plugins: { legend: { display: false } } }} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                     <span className="text-[10px] text-gray-500 uppercase font-bold text-center leading-tight">Ratio<br/>Energie</span>
                  </div>
               </div>

               <div className="flex-1 w-full space-y-4">
                  <h4 className="text-gray-400 text-xs font-bold uppercase tracking-widest border-b border-gray-800 pb-2 mb-2">Structure de l'investissement</h4>
                  
                  <MaterialRow label="Réseau Caténaire" val={`${results.coutLigne.toLocaleString()} ${currency}`} color="bg-amber-500" />
                  <MaterialRow label="Postes Haute Tension" val={`${results.coutPostes.toLocaleString()} ${currency}`} color="bg-orange-600" />
                  <MaterialRow label="Génie Électrique (Pose)" val={`${results.coutMo.toLocaleString()} ${currency}`} color="bg-slate-700" />
                  
                  <div className="flex items-start gap-2 p-3 bg-blue-500/5 rounded-xl border border-blue-500/20 mt-4">
                    <Info className="w-4 h-4 text-amber-500 mt-0.5" />
                    <p className="text-[10px] text-amber-200/70 leading-relaxed italic">
                      L'estimation inclut les poteaux tous les 50m. Le tonnage de cuivre est calculé sur un standard de 1.8T/km (porteur + contact).
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
                        <span className="font-medium uppercase tracking-tighter">{item.longueurKm} km - {item.nbSousStations} postes</span>
                      </div>
                      <span className="text-sm font-bold text-amber-400">{parseFloat(item.totalGlobal).toLocaleString()} {currency}</span>
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
      className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-white focus:border-amber-500 transition-all font-mono text-sm"
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
      {value.toLocaleString()} <span className="text-xs font-normal text-gray-500 lowercase">{unit}</span>
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