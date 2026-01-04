import React, { useState, useEffect, useMemo } from "react";
import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS, ArcElement, Tooltip, Legend,
} from "chart.js";
import { 
  Settings, Ruler, Banknote, Save, Trash2, History, Anchor, Weight, Activity, Info, Drill
} from "lucide-react";

ChartJS.register(ArcElement, Tooltip, Legend);

const STORAGE_KEY = "pose-rails-history-pro";

// Configuration Technique RailPro
const RAIL_PROFILES = {
  UIC60: { label: "UIC 60", weight: 60.34, desc: "Lignes à grande vitesse / Trafic intense" },
  UIC54: { label: "UIC 54", weight: 54.43, desc: "Lignes conventionnelles" },
};

const INSTALL_CONSTANTS = {
  espacementTraverses: 0.6, // 1 traverse tous les 60cm
  attachesParTraverse: 4,   // 2 par rail
  longueurBarreStandard: 18 // Longueur standard d'un rail avant soudure
};

export default function PoseRails({ currency = "XOF", onCostChange = () => {} }) {
  
  // --- ÉTATS ---
  const [profileId, setProfileId] = useState("UIC60");
  const [inputs, setInputs] = useState({
    longueurVoieKm: "",
    prixAcierTonne: "",
    coutPoseMl: "",
    coutFixationUnitaire: "",
    imprevusPourcent: "5"
  });

  const [historique, setHistorique] = useState([]);
  const [message, setMessage] = useState(null);

  // --- MOTEUR DE CALCUL (BUREAU D'ÉTUDES) ---
  const results = useMemo(() => {
    const L_km = parseFloat(inputs.longueurVoieKm) || 0;
    const L_m = L_km * 1000;
    const profile = RAIL_PROFILES[profileId];
    
    // 1. Linéaire et Tonnage (Voie unique = 2 rails)
    const lineaireTotalRail = L_m * 2;
    const tonnageAcier = (lineaireTotalRail * profile.weight) / 1000;

    // 2. Fixations et Soudures
    const nbTraverses = Math.ceil(L_m / INSTALL_CONSTANTS.espacementTraverses);
    const nbAttaches = nbTraverses * INSTALL_CONSTANTS.attachesParTraverse;
    const nbSoudures = Math.ceil(lineaireTotalRail / INSTALL_CONSTANTS.longueurBarreStandard);

    // 3. Coûts
    const coutRails = tonnageAcier * (parseFloat(inputs.prixAcierTonne) || 0);
    const coutFixations = nbAttaches * (parseFloat(inputs.coutFixationUnitaire) || 0);
    const coutPose = L_m * (parseFloat(inputs.coutPoseMl) || 0);
    
    const sousTotal = coutRails + coutFixations + coutPose;
    const margeImprevus = sousTotal * ((parseFloat(inputs.imprevusPourcent) || 0) / 100);
    const total = sousTotal + margeImprevus;

    return {
      tonnageAcier,
      nbAttaches,
      nbSoudures,
      coutRails,
      coutFixations,
      coutPose,
      total
    };
  }, [inputs, profileId]);

  // --- SYNC PARENT ---
  useEffect(() => {
    onCostChange(results.total);
  }, [results.total, onCostChange]);

  // --- HISTORIQUE ---
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) try { setHistorique(JSON.parse(saved)); } catch(e) {}
  }, []);

  const handleSave = () => {
    if (results.total <= 0) return showToast("⚠️ Données incomplètes", "error");
    const newEntry = {
      id: Date.now(),
      date: new Date().toLocaleString(),
      profile: RAIL_PROFILES[profileId].label,
      ...inputs, ...results
    };
    const newHist = [newEntry, ...historique];
    setHistorique(newHist);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newHist));
    showToast("✅ Pose rails enregistrée !");
  };

  const showToast = (msg, type = "success") => {
    setMessage({ text: msg, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const chartData = {
    labels: ["Rails (Acier)", "Fixations", "Main d'œuvre"],
    datasets: [{
      data: [results.coutRails, results.coutFixations, results.coutPose],
      backgroundColor: ["#312e81", "#4338ca", "#1e293b"],
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
            <Drill className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white uppercase tracking-tight">Superstructure : Pose Rails</h2>
            <p className="text-xs text-gray-400 font-medium italic">Armement de la voie et fixations</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-gray-500 uppercase font-bold block tracking-widest">Total Phase</span>
          <span className="text-2xl font-black text-indigo-400 tracking-tighter">
            {results.total.toLocaleString()} <span className="text-sm text-gray-500 font-normal">{currency}</span>
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-6 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
          
          {/* GAUCHE : SAISIE */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            
            {/* 1. Profilé Rail */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <h3 className="flex items-center gap-2 text-xs font-bold text-indigo-400 uppercase tracking-widest mb-4">
                <Settings className="w-4 h-4" /> Spécifications Rail
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(RAIL_PROFILES).map(([id, p]) => (
                  <button
                    key={id}
                    onClick={() => setProfileId(id)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      profileId === id ? "border-indigo-500 bg-indigo-500/10 shadow-lg" : "border-gray-800 bg-gray-900"
                    }`}
                  >
                    <span className={`text-xs font-bold block ${profileId === id ? "text-indigo-400" : "text-gray-500"}`}>{p.label}</span>
                    <span className="text-[9px] text-gray-600 leading-none">{p.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Géométrie & Coûts */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-5 shadow-lg space-y-4">
              <h3 className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                <Ruler className="w-3 h-3" /> Paramètres de pose
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label="Linéaire Voie (km)" value={inputs.longueurVoieKm} onChange={v => setInputs({...inputs, longueurVoieKm: v})} placeholder="Ex: 5" />
                <InputGroup label="Aléas (%)" value={inputs.imprevusPourcent} onChange={v => setInputs({...inputs, imprevusPourcent: v})} />
              </div>

              <div className="pt-4 border-t border-gray-800 grid grid-cols-2 gap-4">
                <InputGroup label={`Prix Acier (${currency}/T)`} value={inputs.prixAcierTonne} onChange={v => setInputs({...inputs, prixAcierTonne: v})} />
                <InputGroup label={`Prix Clip (${currency}/u)`} value={inputs.coutFixationUnitaire} onChange={v => setInputs({...inputs, coutFixationUnitaire: v})} />
                <InputGroup label={`Pose (${currency}/ml)`} value={inputs.coutPoseMl} onChange={v => setInputs({...inputs, coutPoseMl: v})} full />
              </div>

              <button 
                onClick={handleSave}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-xl font-bold shadow-lg transition-all flex justify-center items-center gap-2 active:scale-95"
              >
                <Save className="w-5 h-5" /> Enregistrer le calcul
              </button>
            </div>
          </div>

          {/* DROITE : RÉSULTATS */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            
            <div className="grid grid-cols-3 gap-4">
              <ResultCard label="Masse Acier" value={results.tonnageAcier.toFixed(1)} unit="Tons" icon={<Weight className="w-4 h-4"/>} color="text-indigo-400" bg="bg-indigo-500/10" border />
              <ResultCard label="Attaches" value={results.nbAttaches} unit="u" icon={<Anchor className="w-4 h-4"/>} color="text-white" bg="bg-gray-800" />
              <ResultCard label="Soudures" value={results.nbSoudures} unit="u" icon={<Activity className="w-4 h-4"/>} color="text-emerald-400" bg="bg-emerald-500/10" />
            </div>

            <div className="flex-1 bg-gray-900 rounded-3xl p-8 border border-gray-800 shadow-xl flex flex-col md:flex-row gap-10 items-center relative overflow-hidden">
               <div className="absolute -bottom-10 -right-10 w-44 h-44 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

               <div className="w-48 h-48 flex-shrink-0 relative">
                  <Doughnut data={chartData} options={{ cutout: "75%", plugins: { legend: { display: false } } }} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                     <span className="text-[10px] text-gray-500 uppercase font-bold text-center leading-tight">Ratio<br/>Financier</span>
                  </div>
               </div>

               <div className="flex-1 w-full space-y-4">
                  <h4 className="text-gray-400 text-xs font-bold uppercase tracking-widest border-b border-gray-800 pb-2 mb-2">Bilan Fournitures</h4>
                  <MaterialRow label="Rails (Double file)" val={`${(results.tonnageAcier).toFixed(2)} T`} color="bg-indigo-500" />
                  <MaterialRow label="Attaches élastiques" val={`${results.nbAttaches} clips`} color="bg-indigo-800" />
                  <MaterialRow label="Pose & Soudage" val={`${(results.coutPose).toLocaleString()} ${currency}`} color="bg-gray-600" />
                  
                  <div className="flex items-start gap-2 p-4 bg-blue-500/5 rounded-2xl border border-blue-500/20 mt-4">
                    <Info className="w-4 h-4 text-indigo-400 mt-0.5" />
                    <p className="text-[10px] text-indigo-200/70 leading-relaxed italic">
                      Basé sur des barres de 18m. Le calcul inclut les attaches pour les deux files de rails et un espacement de traverses de 60cm.
                    </p>
                  </div>
               </div>
            </div>

            {/* Historique Mini */}
            {historique.length > 0 && (
              <div className="bg-gray-800/30 rounded-2xl border border-gray-700/50 overflow-hidden">
                <div className="px-4 py-2 bg-gray-800/50 border-b border-gray-700/50 flex justify-between items-center text-xs">
                  <h4 className="font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2"><History className="w-3 h-3" /> Historique de pose</h4>
                  <button onClick={() => {setHistorique([]); localStorage.removeItem(STORAGE_KEY)}} className="text-red-400 hover:underline uppercase text-[10px]">Vider</button>
                </div>
                <div className="max-h-[120px] overflow-y-auto">
                  {historique.slice(0, 5).map((item) => (
                    <div key={item.id} className="flex justify-between items-center p-3 border-b border-gray-800 hover:bg-gray-900 transition-colors">
                      <div className="text-xs">
                        <span className="text-gray-500 block text-[9px]">{item.date}</span>
                        <span className="font-medium uppercase">{item.longueurVoieKm} km - {item.profile}</span>
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
      {value.toLocaleString()} <span className="text-xs font-normal text-gray-500 lowercase">{unit}</span>
    </span>
  </div>
);

const MaterialRow = ({ label, val, color }) => (
  <div className="flex justify-between items-center border-b border-gray-800 pb-2 last:border-0">
    <div className="flex items-center gap-2">
      <div className={`w-1.5 h-1.5 rounded-full ${color}`} />
      <span className="text-gray-300 text-xs font-medium">{label}</span>
    </div>
    <span className="text-xs font-bold text-white font-mono">{val}</span>
  </div>
);