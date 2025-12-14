import React, { useState, useEffect } from "react";
import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { 
  BrickWall, Ruler, Banknote, Save, Trash2, History, Info, Cuboid 
} from "lucide-react";

ChartJS.register(ArcElement, Tooltip, Legend);

const STORAGE_KEY = "fondation-history";

export default function Fondation({ currency = "XOF", onCostChange, onMateriauxChange }) {
  // --- ÉTATS LOCAUX ---
  const [inputs, setInputs] = useState({
    longueur: "",
    largeur: "",
    profondeur: "",
    prixUnitaire: "",
    coutMainOeuvre: ""
  });

  const [historique, setHistorique] = useState([]);
  const [message, setMessage] = useState(null);

  // --- CALCULS (Derived State) ---
  const L = parseFloat(inputs.longueur) || 0;
  const W = parseFloat(inputs.largeur) || 0;
  const H = parseFloat(inputs.profondeur) || 0;
  const pu = parseFloat(inputs.prixUnitaire) || 0;
  const mo = parseFloat(inputs.coutMainOeuvre) || 0;

  const volume = L * W * H;
  
  // Logique métier (conservée de votre code)
  const cimentT = volume * 0.3;     // 300kg/m3 -> 0.3T
  const cimentKg = cimentT * 1000;
  const cimentSacs = cimentKg / 50;
  
  const sableT = volume * 0.6;
  const sableKg = sableT * 1000;
  const sableM3 = sableKg / 1600;   // Densité sable ~1600kg/m3
  
  const gravierT = volume * 0.8;
  const gravierKg = gravierT * 1000;
  const gravierM3 = gravierKg / 1700; // Densité gravier ~1700kg/m3
  
  const eauL = volume * 150;        // 150L/m3
  const eauM3 = eauL / 1000;
  
  const acierT = volume * 0.05;     // Ratio ferraillage
  const acierKg = acierT * 1000;

  const coutMateriaux = volume * pu;
  const total = coutMateriaux + mo;

  // --- EFFETS (Communication Parent & Persistance) ---
  
  // 1. Mise à jour du parent (Sécurisée contre les boucles)
  useEffect(() => {
    if (onCostChange) onCostChange(total);
    
    if (onMateriauxChange) {
      onMateriauxChange({
        volume,
        cimentT,
        sableT,
        gravierT,
        acierT,
        eauM3
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total, volume, cimentT, sableT, gravierT, acierT]); 

  // 2. Chargement historique
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setHistorique(JSON.parse(saved));
    } catch (e) { console.error("Erreur chargement historique", e); }
  }, []);

  // 3. Sauvegarde automatique historique (optionnel, ici on le fait au clic bouton)
  const persistHistory = (newHistory) => {
    setHistorique(newHistory);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newHistory));
  };

  // --- HANDLERS ---
  const handleChange = (field) => (e) => {
    setInputs(prev => ({ ...prev, [field]: e.target.value }));
  };

  const showToast = (msg, type = "success") => {
    setMessage({ text: msg, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleSave = () => {
    if (volume === 0) return showToast("⚠️ Dimensions manquantes", "error");
    
    const newEntry = {
      id: Date.now(),
      date: new Date().toLocaleString(),
      inputs: { ...inputs },
      results: { volume, cimentSacs, sableM3, gravierM3, acierKg, total }
    };
    
    persistHistory([newEntry, ...historique]);
    showToast("✅ Fondation sauvegardée !");
  };

  const clearHistory = () => {
    if (window.confirm("Tout effacer ?")) {
      persistHistory([]);
      showToast("Historique vidé");
    }
  };

  const resetForm = () => {
    setInputs({ longueur: "", largeur: "", profondeur: "", prixUnitaire: "", coutMainOeuvre: "" });
  };

  // --- DONNÉES GRAPHIQUE ---
  const chartData = {
    labels: ["Ciment (T)", "Sable (T)", "Gravier (T)", "Acier (T)"],
    datasets: [{
      data: [cimentT, sableT, gravierT, acierT],
      backgroundColor: ["#ef4444", "#fbbf24", "#78716c", "#3b82f6"], // Red, Amber, Stone, Blue
      borderColor: "#1f2937",
      borderWidth: 4,
    }]
  };

  return (
    <div className="w-full h-full flex flex-col bg-gray-900 text-gray-100 overflow-hidden relative">
      
      {/* Toast Notification */}
      {message && (
        <div className={`fixed top-4 right-4 px-6 py-3 rounded-xl shadow-2xl z-50 font-bold animate-in fade-in slide-in-from-top-2 ${
          message.type === "error" ? "bg-red-600" : "bg-emerald-600"
        }`}>
          {message.text}
        </div>
      )}

      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-600/20 rounded-lg text-red-500">
            <BrickWall className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Fondation</h2>
            <p className="text-xs text-gray-400">Semelles, Béton de propreté</p>
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg px-4 py-2 border border-gray-700">
          <span className="text-xs text-gray-400 block">Total Estimé</span>
          <span className="text-lg font-black text-red-400">
            {total.toLocaleString(undefined, { maximumFractionDigits: 0 })} <span className="text-sm">{currency}</span>
          </span>
        </div>
      </div>

      {/* Main Grid */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
          
          {/* GAUCHE : SAISIE (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            
            {/* Dimensions */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5 shadow-lg">
              <h3 className="flex items-center gap-2 text-sm font-bold text-gray-300 mb-4 uppercase tracking-wider">
                <Ruler className="w-4 h-4 text-blue-400" /> Géométrie
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label="Longueur (m)" value={inputs.longueur} onChange={handleChange("longueur")} />
                <InputGroup label="Largeur (m)" value={inputs.largeur} onChange={handleChange("largeur")} />
                <InputGroup label="Hauteur / Prof. (m)" value={inputs.profondeur} onChange={handleChange("profondeur")} full />
              </div>
            </div>

            {/* Coûts */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5 shadow-lg flex-1">
              <h3 className="flex items-center gap-2 text-sm font-bold text-gray-300 mb-4 uppercase tracking-wider">
                <Banknote className="w-4 h-4 text-green-400" /> Prix & Main d'œuvre
              </h3>
              <div className="space-y-4">
                <InputGroup label={`Prix Béton (${currency}/m³)`} value={inputs.prixUnitaire} onChange={handleChange("prixUnitaire")} placeholder="Ex: 60000" />
                <InputGroup label={`Main d'œuvre Forfait (${currency})`} value={inputs.coutMainOeuvre} onChange={handleChange("coutMainOeuvre")} placeholder="Ex: 150000" />
                
                {/* Séparateur */}
                <div className="h-px bg-gray-700/50 my-4" />
                
                <div className="flex gap-3 mt-auto">
                   <button 
                    onClick={handleSave}
                    className="flex-1 bg-red-600 hover:bg-red-500 text-white py-3 rounded-xl font-bold shadow-lg shadow-red-900/20 active:scale-95 transition-all flex justify-center items-center gap-2"
                  >
                    <Save className="w-5 h-5" /> Sauvegarder
                  </button>
                  <button 
                    onClick={resetForm}
                    className="px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-xl transition-colors"
                    title="Réinitialiser"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* DROITE : RÉSULTATS (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            
            {/* KPIs Cards */}
            <div className="grid grid-cols-3 gap-4">
              <ResultCard 
                label="Volume Béton" 
                value={volume.toFixed(2)} 
                unit="m³" 
                icon={<Cuboid className="w-4 h-4" />}
                color="text-blue-400" 
                bg="bg-blue-500/10"
              />
              <ResultCard 
                label="Ciment requis" 
                value={cimentSacs.toFixed(1)} 
                unit="sacs" 
                icon="🧱"
                color="text-red-400" 
                bg="bg-red-500/10"
                border
              />
              <ResultCard 
                label="Acier requis" 
                value={Math.ceil(acierKg)} 
                unit="kg" 
                icon="🔩"
                color="text-gray-300" 
                bg="bg-gray-700/50"
              />
            </div>

            {/* Section Centrale : Graphique & Détails */}
            <div className="flex-1 bg-gray-800 rounded-2xl p-6 border border-gray-700 shadow-xl flex flex-col md:flex-row gap-8 relative overflow-hidden">
               {/* Background Glow */}
               <div className="absolute -top-10 -right-10 w-40 h-40 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />

               {/* Graphique */}
               <div className="w-48 h-48 flex-shrink-0 relative self-center md:self-start mx-auto md:mx-0">
                  <Doughnut
                    data={chartData}
                    options={{ cutout: "75%", plugins: { legend: { display: false } } }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                     <span className="text-xs text-gray-500 font-bold uppercase">Poids Total</span>
                     <span className="text-sm font-bold text-white">{(cimentT + sableT + gravierT + acierT).toFixed(1)} T</span>
                  </div>
               </div>

               {/* Liste Détaillée */}
               <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 content-center">
                  <MaterialRow label="Ciment" valT={cimentT} valUnit={`${Math.ceil(cimentSacs)} sacs`} color="bg-red-500" />
                  <MaterialRow label="Sable" valT={sableT} valUnit={`${sableM3.toFixed(2)} m³`} color="bg-amber-400" />
                  <MaterialRow label="Gravier" valT={gravierT} valUnit={`${gravierM3.toFixed(2)} m³`} color="bg-stone-500" />
                  <MaterialRow label="Acier" valT={acierT} valUnit={`${Math.ceil(acierKg)} kg`} color="bg-blue-500" />
                  <MaterialRow label="Eau Gâchage" valT={null} valUnit={`${eauL.toFixed(0)} L`} color="bg-cyan-400" />
               </div>
            </div>

            {/* Historique Mini */}
            {historique.length > 0 && (
              <div className="bg-gray-800/30 rounded-2xl border border-gray-700/50 overflow-hidden flex-1 min-h-[100px]">
                <div className="px-4 py-2 bg-gray-800/50 border-b border-gray-700/50 flex justify-between items-center">
                  <h4 className="text-xs font-bold text-gray-400 flex items-center gap-2">
                    <History className="w-3 h-3" /> Derniers calculs
                  </h4>
                  <button onClick={clearHistory} className="text-[10px] text-red-400 hover:underline">Vider</button>
                </div>
                <div className="overflow-y-auto max-h-[120px] p-2 space-y-2">
                  {historique.map((item) => (
                    <div key={item.id} className="flex justify-between items-center bg-gray-700/30 p-2 rounded hover:bg-gray-700/50 transition border border-transparent hover:border-gray-600">
                      <div className="flex flex-col">
                         <span className="text-[10px] text-gray-500">{item.date}</span>
                         <span className="text-xs font-mono text-gray-300">Vol: {item.results.volume.toFixed(1)} m³</span>
                      </div>
                      <span className="text-sm font-bold text-red-400">{item.results.total.toLocaleString()} {currency}</span>
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

const InputGroup = ({ label, value, onChange, full = false, placeholder }) => (
  <div className={`flex flex-col ${full ? "col-span-2" : ""}`}>
    <label className="mb-1.5 text-xs font-semibold text-gray-400">{label}</label>
    <input
      type="number"
      min="0"
      step="any"
      value={value}
      onChange={onChange}
      className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all font-mono text-sm"
      placeholder={placeholder || "0"}
    />
  </div>
);

const ResultCard = ({ label, value, unit, color, bg, border, icon }) => (
  <div className={`relative overflow-hidden rounded-xl p-3 flex flex-col justify-center items-center text-center ${bg} ${border ? 'border border-gray-600' : ''}`}>
    <span className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 flex items-center gap-1">
      {icon} {label}
    </span>
    <span className={`text-xl font-black ${color}`}>
      {value} <span className="text-xs font-normal text-gray-500">{unit}</span>
    </span>
  </div>
);

const MaterialRow = ({ label, valT, valUnit, color }) => (
  <div className="flex justify-between items-center border-b border-gray-700/50 pb-2 last:border-0">
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${color}`} />
      <span className="text-gray-300 text-sm">{label}</span>
    </div>
    <div className="text-right">
      {valT !== null && <div className="text-xs text-gray-500">{valT.toFixed(2)} t</div>}
      <div className="text-sm font-bold text-white font-mono">{valUnit}</div>
    </div>
  </div>
);