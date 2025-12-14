import React, { useState, useEffect, useMemo } from "react";
import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { 
  Droplets, Waves, Ruler, Banknote, Save, Trash2, History, BoxSelect, Cylinder 
} from "lucide-react";

ChartJS.register(ArcElement, Tooltip, Legend);

// Clés de stockage pour l'historique local
const STORAGE_KEYS = {
  dalot: "dalot-history",
  caniveau: "caniveau-history",
  buse: "buse-history"
};

export default function OuvragesHydrauliques({ currency = "XOF", onCostChange, onMateriauxChange }) {
  // === ÉTATS ===
  const [activeTab, setActiveTab] = useState("dalot");
  
  const [inputs, setInputs] = useState({
    longueur: "",
    largeur: "",
    largeurHaut: "",
    largeurBas: "",
    hauteur: "",
    profondeur: "",
    diametre: "",
    epaisseur: "",
    prixUnitaire: "",
    coutMainOeuvre: ""
  });

  const [historique, setHistorique] = useState([]);
  const [message, setMessage] = useState(null);

  // === CONFIGURATION DYNAMIQUE ===
  const theme = useMemo(() => {
    switch (activeTab) {
      case "dalot": 
        return { 
          color: "blue", 
          text: "text-blue-400", 
          bg: "bg-blue-500/10", 
          border: "border-blue-500", 
          ring: "focus:ring-blue-500", 
          icon: <BoxSelect className="w-5 h-5"/> 
        };
      case "caniveau": 
        return { 
          color: "cyan", 
          text: "text-cyan-400", 
          bg: "bg-cyan-500/10", 
          border: "border-cyan-500", 
          ring: "focus:ring-cyan-500", 
          icon: <Waves className="w-5 h-5"/> 
        };
      case "buse": 
        return { 
          color: "indigo", 
          text: "text-indigo-400", 
          bg: "bg-indigo-500/10", 
          border: "border-indigo-500", 
          ring: "focus:ring-indigo-500", 
          icon: <Cylinder className="w-5 h-5"/> 
        };
      default: 
        return { color: "gray", text: "text-gray-400", bg: "bg-gray-500/10" };
    }
  }, [activeTab]);

  // === MOTEUR DE CALCUL ===
  const results = useMemo(() => {
    const L = parseFloat(inputs.longueur) || 0;
    const e = parseFloat(inputs.epaisseur) || 0;
    const pu = parseFloat(inputs.prixUnitaire) || 0;
    const mo = parseFloat(inputs.coutMainOeuvre) || 0;

    let vol = 0;

    // Calcul du Volume selon le type
    if (activeTab === "dalot") {
      const l = parseFloat(inputs.largeur) || 0;
      const h = parseFloat(inputs.hauteur) || 0;
      // Volume = L × ((l_ext × h_ext) - (l_int × h_int))
      vol = L * (((l + 2 * e) * (h + 2 * e)) - (l * h)); 
    } 
    else if (activeTab === "caniveau") {
      const lh = parseFloat(inputs.largeurHaut) || 0;
      const lb = parseFloat(inputs.largeurBas) || 0;
      const p = parseFloat(inputs.profondeur) || 0;
      // Section trapézoïdale
      const surfInt = ((lh + lb) / 2) * p;
      const surfExt = ((lh + 2 * e + lb + 2 * e) / 2) * (p + e); 
      vol = L * (surfExt - surfInt);
    } 
    else if (activeTab === "buse") {
      const d = parseFloat(inputs.diametre) || 0;
      const rInt = d / 2;
      const rExt = rInt + e;
      vol = Math.PI * L * (Math.pow(rExt, 2) - Math.pow(rInt, 2));
    }

    // Calcul des Matériaux (Dosage standard ~350kg/m³)
    const cimentT = vol * 0.350; 
    const sableT = vol * 0.43 * 1.6;
    const gravierT = vol * 0.85 * 1.75;
    const eauL = vol * 175;
    
    // Ferraillage moyen estimé
    const ratioAcier = activeTab === "dalot" ? 120 : activeTab === "buse" ? 100 : 80;
    const acierT = (vol * ratioAcier) / 1000;

    // Coût Total
    const total = (vol * pu) + mo;

    return { volume: Math.max(0, vol), cimentT, sableT, gravierT, eauL, acierT, total };
  }, [inputs, activeTab]);

  // === EFFETS ===
  
  // Synchronisation avec le parent
  useEffect(() => {
    if (onCostChange) onCostChange(results.total);
    if (onMateriauxChange) onMateriauxChange({ ...results, type: activeTab });
  }, [results.total, results.volume, activeTab, onCostChange, onMateriauxChange]);

  // Chargement de l'historique
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS[activeTab]);
      setHistorique(saved ? JSON.parse(saved) : []);
    } catch (e) { 
      setHistorique([]); 
    }
  }, [activeTab]);

  // === HANDLERS ===
  const handleChange = (field) => (e) => setInputs(prev => ({ ...prev, [field]: e.target.value }));

  const showToast = (msg, type = "success") => { 
    setMessage({ text: msg, type }); 
    setTimeout(() => setMessage(null), 3000); 
  };

  const handleSave = () => {
    if (results.volume <= 0) return showToast("⚠️ Dimensions invalides", "error");
    
    const newEntry = {
      id: Date.now(),
      date: new Date().toLocaleString(),
      type: activeTab,
      inputs: { ...inputs },
      results: { ...results }
    };
    
    const newHist = [newEntry, ...historique];
    setHistorique(newHist);
    localStorage.setItem(STORAGE_KEYS[activeTab], JSON.stringify(newHist));
    showToast("✅ Ouvrage sauvegardé !");
  };

  const clearHistory = () => {
    if (window.confirm(`Vider l'historique des ${activeTab}s ?`)) {
      setHistorique([]);
      localStorage.removeItem(STORAGE_KEYS[activeTab]);
      showToast("Historique vidé");
    }
  };

  const resetFields = () => {
    setInputs({
      longueur: "",
      largeur: "",
      largeurHaut: "",
      largeurBas: "",
      hauteur: "",
      profondeur: "",
      diametre: "",
      epaisseur: "",
      prixUnitaire: "",
      coutMainOeuvre: ""
    });
  };

  // === DONNÉES GRAPHIQUE ===
  const chartData = {
    labels: ["Ciment", "Sable", "Gravier", "Acier"],
    datasets: [{
      data: [results.cimentT, results.sableT, results.gravierT, results.acierT],
      backgroundColor: ["#10b981", "#fbbf24", "#78716c", "#ef4444"],
      borderColor: "#1f2937",
      borderWidth: 4,
    }]
  };

  // === RENDU ===
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
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-800 flex flex-col sm:flex-row justify-between items-center bg-gray-900/50 backdrop-blur-sm gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/20 rounded-lg text-blue-500">
            <Droplets className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Hydraulique</h2>
            <p className="text-xs text-gray-400">Dalots, Caniveaux & Buses</p>
          </div>
        </div>

        {/* Total Badge */}
        <div className="bg-gray-800 rounded-lg px-4 py-2 border border-gray-700">
          <span className="text-xs text-gray-400 block">Total Estimé</span>
          <span className={`text-lg font-black ${theme.text}`}>
            {results.total.toLocaleString(undefined, { maximumFractionDigits: 0 })} 
            <span className="text-sm ml-1 text-gray-500">{currency}</span>
          </span>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
          
          {/* COLONNE GAUCHE : SÉLECTION & SAISIE */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            
            {/* Tab Switcher */}
            <div className="grid grid-cols-3 gap-2 bg-gray-800 p-1.5 rounded-xl border border-gray-700">
              <TabButton id="dalot" label="Dalot" icon={BoxSelect} active={activeTab} onClick={setActiveTab} color="blue" />
              <TabButton id="caniveau" label="Caniveau" icon={Waves} active={activeTab} onClick={setActiveTab} color="cyan" />
              <TabButton id="buse" label="Buse" icon={Cylinder} active={activeTab} onClick={setActiveTab} color="indigo" />
            </div>

            {/* Formulaire Dynamique */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5 shadow-lg flex-1 flex flex-col gap-4 animate-in fade-in slide-in-from-left-4 duration-300">
              <h3 className={`flex items-center gap-2 text-sm font-bold uppercase tracking-wider ${theme.text}`}>
                <Ruler className="w-4 h-4" /> Dimensions ({activeTab})
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                {/* Champs Communs */}
                <InputGroup label="Longueur (m)" value={inputs.longueur} onChange={handleChange("longueur")} theme={theme} />
                <InputGroup label="Épaisseur (m)" value={inputs.epaisseur} onChange={handleChange("epaisseur")} theme={theme} />

                {/* Spécifique DALOT */}
                {activeTab === "dalot" && (
                  <>
                    <InputGroup label="Largeur Int. (m)" value={inputs.largeur} onChange={handleChange("largeur")} theme={theme} />
                    <InputGroup label="Hauteur Int. (m)" value={inputs.hauteur} onChange={handleChange("hauteur")} theme={theme} />
                  </>
                )}

                {/* Spécifique CANIVEAU */}
                {activeTab === "caniveau" && (
                  <>
                    <InputGroup label="Largeur Haut (m)" value={inputs.largeurHaut} onChange={handleChange("largeurHaut")} theme={theme} />
                    <InputGroup label="Largeur Bas (m)" value={inputs.largeurBas} onChange={handleChange("largeurBas")} theme={theme} />
                    <InputGroup label="Profondeur (m)" value={inputs.profondeur} onChange={handleChange("profondeur")} theme={theme} full />
                  </>
                )}

                {/* Spécifique BUSE */}
                {activeTab === "buse" && (
                  <div className="col-span-2">
                    <InputGroup label="Diamètre Intérieur (m)" value={inputs.diametre} onChange={handleChange("diametre")} theme={theme} full />
                  </div>
                )}
              </div>

              <div className="h-px bg-gray-700/50 my-4" />
              
              <h3 className="flex items-center gap-2 text-sm font-bold text-gray-400 uppercase tracking-wider">
                <Banknote className="w-4 h-4" /> Coûts
              </h3>
              <div className="grid grid-cols-2 gap-4">
                 <InputGroup label={`Prix Béton (${currency}/m³)`} value={inputs.prixUnitaire} onChange={handleChange("prixUnitaire")} theme={theme} />
                 <InputGroup label={`Main d'œuvre (${currency})`} value={inputs.coutMainOeuvre} onChange={handleChange("coutMainOeuvre")} theme={theme} />
              </div>

              <div className="flex gap-3 mt-auto pt-6">
                <button 
                  onClick={handleSave}
                  className={`flex-1 bg-gradient-to-r from-${theme.color === 'cyan' ? 'teal' : theme.color}-600 to-${theme.color === 'cyan' ? 'teal' : theme.color}-500 hover:opacity-90 text-white py-3 rounded-xl font-bold shadow-lg active:scale-95 transition-all flex justify-center items-center gap-2`}
                >
                  <Save className="w-5 h-5" /> Calculer
                </button>
                <button 
                  onClick={resetFields} 
                  className="px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-xl transition-colors"
                  title="Réinitialiser champs"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* COLONNE DROITE : RÉSULTATS */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            
            {/* KPIs */}
            <div className="grid grid-cols-3 gap-4">
              <ResultCard 
                label="Volume Béton" 
                value={results.volume.toFixed(2)} 
                unit="m³" 
                color={theme.text} 
                bg={theme.bg} 
                icon={theme.icon} 
              />
              <ResultCard 
                label="Poids Matériaux" 
                value={(results.cimentT + results.sableT + results.gravierT).toFixed(1)} 
                unit="T" 
                color="text-emerald-400" 
                bg="bg-emerald-500/10"
                border
                icon="⚖️"
              />
              <ResultCard 
                label="Acier Requis" 
                value={(results.acierT * 1000).toFixed(0)} 
                unit="kg" 
                color="text-red-400" 
                bg="bg-red-500/10"
                icon="🔩"
              />
            </div>

            {/* Graphique & Liste */}
            <div className="flex-1 bg-gray-800 rounded-2xl p-6 border border-gray-700 shadow-xl flex flex-col md:flex-row gap-8 items-center relative overflow-hidden">
               <div className={`absolute -bottom-10 -right-10 w-40 h-40 ${theme.bg} rounded-full blur-3xl pointer-events-none opacity-50`} />

               <div className="w-40 h-40 flex-shrink-0 relative">
                  <Doughnut data={chartData} options={{ cutout: "70%", plugins: { legend: { display: false } } }} />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                     <span className={`text-sm font-bold ${theme.text}`}>{results.volume.toFixed(1)} m³</span>
                  </div>
               </div>

               <div className="flex-1 w-full grid grid-cols-2 gap-x-8 gap-y-3 content-center">
                  <MaterialRow label="Ciment" value={results.cimentT} unit="T" color="bg-emerald-500" />
                  <MaterialRow label="Sable" value={results.sableT} unit="T" color="bg-amber-400" />
                  <MaterialRow label="Gravier" value={results.gravierT} unit="T" color="bg-stone-500" />
                  <MaterialRow label="Acier" value={results.acierT} unit="T" color="bg-red-500" />
               </div>
            </div>

            {/* Historique */}
            {historique.length > 0 && (
              <div className="bg-gray-800/30 rounded-2xl border border-gray-700/50 overflow-hidden flex-1 min-h-[120px]">
                <div className="px-4 py-2 bg-gray-800/50 border-b border-gray-700/50 flex justify-between items-center">
                  <h4 className="text-xs font-bold text-gray-400 flex items-center gap-2">
                    <History className="w-3 h-3" /> Historique ({activeTab})
                  </h4>
                  <button onClick={clearHistory} className="text-[10px] text-red-400 hover:underline">Vider</button>
                </div>
                <div className="overflow-y-auto max-h-[150px] p-2 space-y-2">
                  {historique.map((item) => (
                    <div key={item.id} className="flex justify-between items-center bg-gray-700/30 p-2 rounded hover:bg-gray-700/50 transition border border-transparent hover:border-gray-600">
                      <div className="flex flex-col">
                         <span className="text-[10px] text-gray-500">{item.date.split(' ')[0]}</span>
                         <span className="text-xs text-gray-300">
                           {item.type === 'buse' ? `Ø ${item.inputs.diametre}` : `L ${item.inputs.longueur}`}m
                         </span>
                      </div>
                      <span className={`text-sm font-bold ${theme.text}`}>{item.results.total.toLocaleString()} {currency}</span>
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

// === SOUS-COMPOSANTS ===

const TabButton = ({ id, label, icon: Icon, active, onClick, color }) => (
  <button
    onClick={() => onClick(id)}
    className={`flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all ${
      active === id 
        ? `bg-${color}-600 text-white shadow-lg` 
        : "text-gray-400 hover:text-white hover:bg-gray-700"
    }`}
  >
    <Icon className="w-4 h-4" />
    <span className="hidden sm:inline">{label}</span>
  </button>
);

const InputGroup = ({ label, value, onChange, full = false, theme, placeholder = "0" }) => (
  <div className={`flex flex-col ${full ? "col-span-2" : ""}`}>
    <label className="mb-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-wide">{label}</label>
    <input
      type="number"
      min="0"
      step="any"
      value={value}
      onChange={onChange}
      className={`w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2.5 text-white placeholder-gray-600 focus:outline-none ${theme.border} ${theme.ring} transition-all font-mono text-sm`}
      placeholder={placeholder}
    />
  </div>
);

const ResultCard = ({ label, value, unit, color, bg, border, icon }) => (
  <div className={`relative overflow-hidden rounded-xl p-3 flex flex-col justify-center items-center text-center ${bg} ${border ? 'border border-gray-600' : ''}`}>
    <span className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 flex items-center gap-1">
      {typeof icon === 'string' ? icon : <span className="opacity-70">{icon}</span>} {label}
    </span>
    <span className={`text-xl font-black ${color}`}>
      {value} <span className="text-xs font-normal text-gray-500">{unit}</span>
    </span>
  </div>
);

const MaterialRow = ({ label, value, unit, color }) => (
  <div className="flex justify-between items-center border-b border-gray-700/50 pb-2 last:border-0">
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${color}`} />
      <span className="text-gray-300 text-sm">{label}</span>
    </div>
    <div className="text-sm font-bold text-white font-mono">
      {value.toFixed(2)} <span className="text-xs text-gray-500">{unit}</span>
    </div>
  </div>
);