import React, { useState, useEffect, useMemo } from "react";
import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS, ArcElement, Tooltip, Legend,
} from "chart.js";
import { 
  Train, Ruler, Banknote, Save, Trash2, History, Weight, Anchor, Settings2, Info, Navigation
} from "lucide-react";

ChartJS.register(ArcElement, Tooltip, Legend);

const STORAGE_KEY = "voies-ferrees-history-pro";

// Standards techniques ferroviaires
const RAIL_PROFILES = {
  UIC60: { label: "UIC 60 (60kg/m)", weight: 60, desc: "Lignes grande vitesse / Fret lourd" },
  UIC54: { label: "UIC 54 (54kg/m)", weight: 54, desc: "Lignes conventionnelles" },
  S49: { label: "S49 (49kg/m)", weight: 49, desc: "Voies secondaires / Tramway" },
};

const TRACK_CONFIG = {
  traversesPerKm: 1666, // Standard 0.60m d'espacement
  ballastM3perMl: 2.5,   // Volume moyen de ballast par mètre linéaire
};

export default function VoiesFerrees({ currency = "XOF", onMaterialsChange = () => {} }) {
  
  // --- ÉTATS ---
  const [profileId, setProfileId] = useState("UIC60");
  const [inputs, setInputs] = useState({
    longueurKm: "",
    typeVoie: "2", // 2 rails pour voie unique, 4 pour double voie
    prixAcierTonne: "", 
    coutMainOeuvre: "",
    margePose: "5"
  });

  const [historique, setHistorique] = useState([]);
  const [message, setMessage] = useState(null);

  // --- MOTEUR DE CALCUL (INGÉNIERIE) ---
  const results = useMemo(() => {
    const L_km = parseFloat(inputs.longueurKm) || 0;
    const L_m = L_km * 1000;
    const nbRails = parseInt(inputs.typeVoie) || 2;
    const profile = RAIL_PROFILES[profileId];
    const margin = 1 + (parseFloat(inputs.margePose) || 0) / 100;

    // 1. Calcul Acier (Rails)
    const lineaireTotalRail = L_m * nbRails;
    const tonnageAcier = (lineaireTotalRail * profile.weight * margin) / 1000;

    // 2. Calcul Traverses
    const nbTraverses = Math.ceil(L_m * (TRACK_CONFIG.traversesPerKm / 1000) * (nbRails / 2));

    // 3. Calcul Ballast
    const volumeBallast = L_m * TRACK_CONFIG.ballastM3perMl * (nbRails / 2);

    // 4. Coûts
    const puAcier = parseFloat(inputs.prixAcierTonne) || 0;
    const mo = parseFloat(inputs.coutMainOeuvre) || 0;
    
    const coutMateriaux = tonnageAcier * puAcier;
    const total = coutMateriaux + mo;

    return {
      lineaireTotalRail,
      tonnageAcier,
      nbTraverses,
      volumeBallast,
      coutMateriaux,
      total
    };
  }, [inputs, profileId]);

  // --- SYNC PARENT ---
  useEffect(() => {
    onMaterialsChange({ 
        tonnageAcier: results.tonnageAcier, 
        nbTraverses: results.nbTraverses,
        volumeBallast: results.volumeBallast 
    });
  }, [results.tonnageAcier]);

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
      profile: RAIL_PROFILES[profileId].label,
      ...inputs, ...results
    };
    const newHist = [newEntry, ...historique];
    setHistorique(newHist);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newHist));
    showToast("✅ Projet enregistré !");
  };

  const showToast = (msg, type = "success") => {
    setMessage({ text: msg, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const chartData = {
    labels: ["Acier (Rails)", "Main d'œuvre"],
    datasets: [{
      data: [results.coutMateriaux, parseFloat(inputs.coutMainOeuvre || 0)],
      backgroundColor: ["#3b82f6", "#1e293b"],
      borderColor: "#111827",
      borderWidth: 2,
    }]
  };

  return (
    <div className="w-full h-full flex flex-col bg-gray-900 text-gray-100 overflow-hidden relative font-sans">
      
      {/* Notification */}
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
          <div className="p-2 bg-blue-600/20 rounded-lg text-blue-500">
            <Train className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white uppercase tracking-tight">Superstructure Ferroviaire</h2>
            <p className="text-xs text-gray-400 font-medium">Pose de voies et armement</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-gray-500 uppercase font-bold block tracking-widest">Budget Estimé</span>
          <span className="text-2xl font-black text-blue-400 tracking-tighter">
            {results.total.toLocaleString()} <span className="text-sm text-gray-500 font-normal">{currency}</span>
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-6 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
          
          {/* GAUCHE : PARAMÈTRES (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            
            {/* 1. Profil Rail */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5">
              <h3 className="flex items-center gap-2 text-xs font-bold text-blue-400 uppercase tracking-widest mb-4">
                <Settings2 className="w-4 h-4" /> Type de profilé
              </h3>
              <div className="grid grid-cols-1 gap-2">
                {Object.entries(RAIL_PROFILES).map(([id, p]) => (
                  <button
                    key={id}
                    onClick={() => setProfileId(id)}
                    className={`p-3 rounded-xl border text-left transition-all flex flex-col ${
                      profileId === id ? "border-blue-500 bg-blue-500/10 shadow-lg" : "border-gray-700 bg-gray-800"
                    }`}
                  >
                    <span className={`text-xs font-bold ${profileId === id ? "text-blue-400" : "text-gray-400"}`}>{p.label}</span>
                    <span className="text-[10px] text-gray-500 italic">{p.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Géométrie */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5 shadow-lg">
              <h3 className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
                <Ruler className="w-4 h-4" /> Linéaire du projet
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label="Distance (km)" value={inputs.longueurKm} onChange={v => setInputs({...inputs, longueurKm: v})} placeholder="Ex: 10" />
                <div className="flex flex-col">
                    <label className="mb-1.5 text-[10px] font-bold text-gray-500 uppercase">Configuration</label>
                    <select 
                        value={inputs.typeVoie} 
                        onChange={e => setInputs({...inputs, typeVoie: e.target.value})}
                        className="w-full bg-gray-900 border border-gray-600 rounded-xl p-3 text-sm"
                    >
                        <option value="2">Voie Unique (2 rails)</option>
                        <option value="4">Double Voie (4 rails)</option>
                    </select>
                </div>
              </div>
            </div>

            {/* 3. Financier */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5 flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label={`Prix Acier (${currency}/T)`} value={inputs.prixAcierTonne} onChange={v => setInputs({...inputs, prixAcierTonne: v})} />
                <InputGroup label={`MO Pose (${currency})`} value={inputs.coutMainOeuvre} onChange={v => setInputs({...inputs, coutMainOeuvre: v})} />
              </div>
              <button 
                onClick={handleSave}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-xl font-bold shadow-lg transition-all flex justify-center items-center gap-2 active:scale-95"
              >
                <Save className="w-5 h-5" /> Enregistrer le chiffrage
              </button>
            </div>
          </div>

          {/* DROITE : RÉSULTATS (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            
            <div className="grid grid-cols-3 gap-4">
              <ResultCard label="Acier (Rails)" value={results.tonnageAcier.toFixed(1)} unit="Tons" icon={<Weight className="w-4 h-4"/>} color="text-blue-400" bg="bg-blue-500/10" border />
              <ResultCard label="Traverses" value={results.nbTraverses} unit="u" icon={<Anchor className="w-4 h-4"/>} color="text-white" bg="bg-gray-800" />
              <ResultCard label="Ballast" value={results.volumeBallast.toFixed(0)} unit="m³" icon={<Navigation className="w-4 h-4"/>} color="text-emerald-400" bg="bg-emerald-500/10" />
            </div>

            <div className="flex-1 bg-gray-800 rounded-3xl p-8 border border-gray-700 shadow-xl flex flex-col md:flex-row gap-10 items-center relative overflow-hidden">
               <div className="absolute -bottom-10 -right-10 w-44 h-44 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

               <div className="w-48 h-48 flex-shrink-0 relative">
                  <Doughnut data={chartData} options={{ cutout: "75%", plugins: { legend: { display: false } } }} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                     <span className="text-[10px] text-gray-500 uppercase font-bold text-center leading-tight">Structure<br/>du Devis</span>
                  </div>
               </div>

               <div className="flex-1 w-full space-y-4">
                  <h4 className="text-gray-400 text-xs font-bold uppercase tracking-widest border-b border-gray-700 pb-2 mb-2">Bilan Logistique</h4>
                  
                  <MaterialRow label="Acier (UIC)" val={`${results.tonnageAcier.toFixed(2)} T`} color="bg-blue-500" />
                  <MaterialRow label="Traverses Béton" val={`${results.nbTraverses} unités`} color="bg-gray-400" />
                  <MaterialRow label="Ballast 31.5/50" val={`${results.volumeBallast.toFixed(1)} m³`} color="bg-emerald-500" />
                  
                  <div className="flex items-start gap-2 p-3 bg-blue-500/5 rounded-xl border border-blue-500/20 mt-4">
                    <Info className="w-4 h-4 text-blue-400 mt-0.5" />
                    <p className="text-[10px] text-blue-200/70 leading-relaxed italic">
                      L'estimation inclut un coefficient de pose de {inputs.margePose}%. Les traverses sont calculées sur la base d'un écartement standard de 0.60m.
                    </p>
                  </div>
               </div>
            </div>

            {/* Historique Mini */}
            {historique.length > 0 && (
              <div className="bg-gray-800/30 rounded-2xl border border-gray-700/50 overflow-hidden">
                <div className="px-4 py-2 bg-gray-800/50 border-b border-gray-700/50 flex justify-between items-center text-xs">
                  <h4 className="font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2"><History className="w-3 h-3" /> Historique de ligne</h4>
                  <button onClick={() => {setHistorique([]); localStorage.removeItem(STORAGE_KEY)}} className="text-red-400 hover:underline uppercase text-[10px]">Vider</button>
                </div>
                <div className="max-h-[120px] overflow-y-auto">
                  {historique.slice(0, 5).map((item) => (
                    <div key={item.id} className="flex justify-between items-center p-3 border-b border-gray-700/30 hover:bg-gray-700/40 transition-colors">
                      <div className="text-xs">
                        <span className="text-gray-500 block text-[9px]">{item.date}</span>
                        <span className="font-medium uppercase tracking-tighter">{item.longueurKm} km - {item.profile}</span>
                      </div>
                      <span className="text-sm font-bold text-blue-400">{parseFloat(item.total).toLocaleString()} {currency}</span>
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
      className="w-full bg-gray-900 border border-gray-600 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none transition-all font-mono text-sm"
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
      {value.toLocaleString()} <span className="text-xs font-normal text-gray-500 lowercase">{unit}</span>
    </span>
  </div>
);

const MaterialRow = ({ label, val, color }) => (
  <div className="flex justify-between items-center border-b border-gray-700/30 pb-2 last:border-0 group">
    <div className="flex items-center gap-2">
      <div className={`w-1.5 h-1.5 rounded-full ${color}`} />
      <span className="text-gray-300 text-xs font-medium">{label}</span>
    </div>
    <span className="text-xs font-bold text-white font-mono">{val}</span>
  </div>
);