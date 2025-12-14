import React, { useState, useEffect, useMemo } from "react";
import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
// ✅ CORRECTION ICI : Remplacement de TriangleAlert par AlertTriangle
import { 
  AlertTriangle, // <--- C'était TriangleAlert avant
  TrafficCone, MapPin, Shield, Construction, 
  Save, Trash2, History, Banknote, Lightbulb, Ruler
} from "lucide-react";

ChartJS.register(ArcElement, Tooltip, Legend);

const STORAGE_KEY = "signalisation-history";

const EQUIPMENT_TYPES = [
  { 
    id: "panneaux", 
    label: "Panneaux", 
    icon: <AlertTriangle className="w-5 h-5"/>, // <--- ET ICI AUSSI
    color: "orange", 
    bg: "bg-orange-500/10", 
    text: "text-orange-400" 
  },
  { id: "feux", label: "Feux Tricolores", icon: <Lightbulb className="w-5 h-5"/>, color: "red", bg: "bg-red-500/10", text: "text-red-400" },
  { id: "glissieres", label: "Glissières", icon: <Shield className="w-5 h-5"/>, color: "slate", bg: "bg-slate-500/10", text: "text-slate-400" },
  { id: "marquage", label: "Marquage Sol", icon: <Construction className="w-5 h-5"/>, color: "yellow", bg: "bg-yellow-500/10", text: "text-yellow-400" },
  { id: "bornes", label: "Bornes", icon: <MapPin className="w-5 h-5"/>, color: "pink", bg: "bg-pink-500/10", text: "text-pink-400" },
  { id: "divers", label: "Divers", icon: <TrafficCone className="w-5 h-5"/>, color: "green", bg: "bg-green-500/10", text: "text-green-400" },
];

export default function EquipementsDeSignalisationForm({ currency = "XOF", onCostChange }) {
  
  // === ÉTATS ===
  const [selectedType, setSelectedType] = useState("panneaux");
  
  const [inputs, setInputs] = useState({
    quantite: "",
    coutUnitaire: "", // Matériel
    coutMainOeuvre: "", // Pose
    dimension: "",    // Spécifique Panneaux
    longueur: "",     // Spécifique Glissières
    surface: "",      // Spécifique Marquage
    details: ""       // Spécifique Divers/Feux
  });

  const [historique, setHistorique] = useState([]);
  const [message, setMessage] = useState(null);

  // === THÈME DYNAMIQUE ===
  const currentTheme = useMemo(() => 
    EQUIPMENT_TYPES.find(t => t.id === selectedType) || EQUIPMENT_TYPES[0],
    [selectedType]
  );

  // === CALCULS (Mémorisés) ===
  const results = useMemo(() => {
    const qte = parseFloat(inputs.quantite) || 0;
    const cu = parseFloat(inputs.coutUnitaire) || 0;
    const mo = parseFloat(inputs.coutMainOeuvre) || 0;

    const totalMateriaux = qte * cu;
    const totalMainOeuvre = qte * mo; 
    const total = totalMateriaux + totalMainOeuvre;

    return { qte, totalMateriaux, totalMainOeuvre, total };
  }, [inputs]);

  // === EFFETS ===
  
  // Synchronisation avec le parent (Anti-Loop)
  useEffect(() => {
    if (onCostChange) onCostChange(results.total);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results.total]);

  // Chargement Historique
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setHistorique(JSON.parse(saved));
    } catch {}
  }, []);

  // === HANDLERS ===
  const handleChange = (field) => (e) => setInputs(prev => ({ ...prev, [field]: e.target.value }));
  
  const showToast = (msg, type = "success") => {
    setMessage({ text: msg, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleSave = () => {
    if (results.total <= 0) return showToast("⚠️ Montant nul", "error");
    
    const newEntry = {
      id: Date.now(),
      date: new Date().toLocaleString(),
      type: selectedType,
      inputs: { ...inputs },
      results: { ...results }
    };

    const newHist = [newEntry, ...historique];
    setHistorique(newHist);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newHist));
    showToast("✅ Équipement sauvegardé !");
  };

  const clearHistory = () => {
    if (window.confirm("Vider l'historique ?")) {
      setHistorique([]);
      localStorage.removeItem(STORAGE_KEY);
      showToast("Historique vidé");
    }
  };

  const resetFields = () => {
    setInputs({
      quantite: "",
      coutUnitaire: "",
      coutMainOeuvre: "",
      dimension: "",
      longueur: "",
      surface: "",
      details: ""
    });
  };

  // === DATA CHART ===
  const chartData = {
    labels: ["Matériel", "Pose (MO)"],
    datasets: [{
      data: [results.totalMateriaux, results.totalMainOeuvre],
      backgroundColor: ["#f97316", "#3b82f6"], // Orange, Blue
      borderColor: "#1f2937",
      borderWidth: 4,
    }]
  };

  return (
    <div className="w-full h-full flex flex-col bg-gray-900 text-gray-100 overflow-hidden relative">
      
      {/* Toast */}
      {message && (
        <div className={`fixed top-4 right-4 px-6 py-3 rounded-xl shadow-2xl z-50 font-bold animate-in fade-in slide-in-from-top-2 ${message.type === "error" ? "bg-red-600" : "bg-green-600"}`}>
          {message.text}
        </div>
      )}

      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-500/20 rounded-lg text-orange-500">
            <TrafficCone className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Signalisation</h2>
            <p className="text-xs text-gray-400">Sécurité & Équipements</p>
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg px-4 py-2 border border-gray-700">
          <span className="text-xs text-gray-400 block">Total Estimé</span>
          <span className="text-lg font-black text-orange-400">
            {results.total.toLocaleString(undefined, { maximumFractionDigits: 0 })} <span className="text-sm text-gray-500">{currency}</span>
          </span>
        </div>
      </div>

      {/* Main Grid */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
          
          {/* GAUCHE : SÉLECTION & INPUTS (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            
            {/* Grid Sélection */}
            <div className="grid grid-cols-3 gap-2 bg-gray-800 p-2 rounded-2xl border border-gray-700">
              {EQUIPMENT_TYPES.map((type) => (
                <button
                  key={type.id}
                  onClick={() => setSelectedType(type.id)}
                  className={`flex flex-col items-center justify-center gap-1 py-3 rounded-xl text-xs font-bold transition-all ${
                    selectedType === type.id 
                      ? "bg-orange-600 text-white shadow-lg scale-95" 
                      : "text-gray-400 hover:text-white hover:bg-gray-700"
                  }`}
                >
                  {type.icon}
                  <span>{type.label}</span>
                </button>
              ))}
            </div>

            {/* Formulaire */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5 shadow-lg flex-1 flex flex-col gap-4">
              <h3 className="flex items-center gap-2 text-sm font-bold text-orange-400 uppercase tracking-wider">
                {currentTheme.icon} Paramètres : {currentTheme.label}
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                   <InputGroup label="Quantité" value={inputs.quantite} onChange={handleChange("quantite")} placeholder="Ex: 10" />
                </div>

                {/* Champs Dynamiques */}
                {selectedType === "panneaux" && (
                  <InputGroup label="Dimensions (cm)" value={inputs.dimension} onChange={handleChange("dimension")} placeholder="Ex: 80x80" full />
                )}
                {selectedType === "glissieres" && (
                  <InputGroup label="Longueur (m/unité)" value={inputs.longueur} onChange={handleChange("longueur")} placeholder="Ex: 4" full />
                )}
                {selectedType === "marquage" && (
                  <InputGroup label="Surface (m²)" value={inputs.surface} onChange={handleChange("surface")} full />
                )}
                {(selectedType === "feux" || selectedType === "divers" || selectedType === "bornes") && (
                  <InputGroup label="Détails / Réf" value={inputs.details} onChange={handleChange("details")} placeholder="Optionnel" full />
                )}
              </div>

              <div className="h-px bg-gray-700/50 my-2" />

              <h3 className="flex items-center gap-2 text-sm font-bold text-gray-400 uppercase tracking-wider">
                <Banknote className="w-4 h-4" /> Coûts Unitaires
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label={`Prix Matériel (${currency})`} value={inputs.coutUnitaire} onChange={handleChange("coutUnitaire")} />
                <InputGroup label={`Prix Pose (${currency})`} value={inputs.coutMainOeuvre} onChange={handleChange("coutMainOeuvre")} />
              </div>

              <div className="flex gap-3 mt-auto pt-6">
                <button 
                  onClick={handleSave}
                  className="flex-1 bg-gradient-to-r from-orange-600 to-red-600 hover:opacity-90 text-white py-3 rounded-xl font-bold shadow-lg active:scale-95 transition-all flex justify-center items-center gap-2"
                >
                  <Save className="w-5 h-5" /> Ajouter
                </button>
                <button 
                  onClick={resetFields} 
                  className="px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-xl transition-colors"
                  title="Réinitialiser"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* DROITE : DASHBOARD (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            
            {/* KPIs */}
            <div className="grid grid-cols-3 gap-4">
              <ResultCard label="Type" value={currentTheme.label} unit="" icon={currentTheme.icon} color="text-orange-400" bg="bg-orange-500/10" />
              <ResultCard label="Quantité" value={results.qte} unit="u" icon="#" color="text-blue-400" bg="bg-blue-500/10" border />
              <ResultCard label="Total" value={(results.total / 1000).toFixed(1)} unit="k" icon="💰" color="text-green-400" bg="bg-green-500/10" />
            </div>

            {/* Graphique */}
            <div className="flex-1 bg-gray-800 rounded-2xl p-6 border border-gray-700 shadow-xl flex flex-col md:flex-row gap-8 items-center relative overflow-hidden">
               <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-orange-600/10 rounded-full blur-3xl pointer-events-none" />

               <div className="w-40 h-40 flex-shrink-0 relative">
                  <Doughnut data={chartData} options={{ cutout: "75%", plugins: { legend: { display: false } } }} />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                     <span className="text-sm font-bold text-orange-400">{results.total > 0 ? "100%" : "0%"}</span>
                  </div>
               </div>

               <div className="flex-1 w-full space-y-4">
                  <h4 className="text-gray-400 text-sm font-medium border-b border-gray-700 pb-2">Répartition des Coûts</h4>
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-2 text-gray-300 text-sm"><div className="w-3 h-3 rounded-full bg-orange-500"/> Matériel</span>
                    <span className="font-mono font-bold text-white">{results.totalMateriaux.toLocaleString()} {currency}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-2 text-gray-300 text-sm"><div className="w-3 h-3 rounded-full bg-blue-500"/> Main d'œuvre</span>
                    <span className="font-mono font-bold text-white">{results.totalMainOeuvre.toLocaleString()} {currency}</span>
                  </div>
               </div>
            </div>

            {/* Historique */}
            {historique.length > 0 && (
              <div className="bg-gray-800/30 rounded-2xl border border-gray-700/50 overflow-hidden flex-1 min-h-[150px]">
                <div className="px-4 py-2 bg-gray-800/50 border-b border-gray-700/50 flex justify-between items-center">
                  <h4 className="text-xs font-bold text-gray-400 flex items-center gap-2">
                    <History className="w-3 h-3" /> Derniers ajouts
                  </h4>
                  <button onClick={clearHistory} className="text-[10px] text-red-400 hover:underline">Vider</button>
                </div>
                <div className="overflow-y-auto max-h-[180px] p-2 space-y-2">
                  {historique.map((item) => (
                    <div key={item.id} className="flex justify-between items-center bg-gray-700/30 p-2 rounded hover:bg-gray-700/50 transition border border-transparent hover:border-orange-500/30">
                      <div className="flex items-center gap-3">
                         <div className={`p-1.5 rounded-lg ${EQUIPMENT_TYPES.find(t => t.id === item.type)?.bg || 'bg-gray-500/20'} text-orange-400`}>
                            {EQUIPMENT_TYPES.find(t => t.id === item.type)?.icon}
                         </div>
                         <div className="flex flex-col">
                           <span className="text-xs font-bold text-gray-200">{EQUIPMENT_TYPES.find(t => t.id === item.type)?.label}</span>
                           <span className="text-[10px] text-gray-500">{item.date}</span>
                         </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-gray-400">Qté: {item.inputs.quantite}</div>
                        <div className="text-sm font-bold text-orange-400">{parseFloat(item.results.total).toLocaleString()}</div>
                      </div>
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
      type="number" 
      min="0"
      step="any"
      value={value}
      onChange={onChange}
      className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all font-mono text-sm"
      placeholder={placeholder || "0"}
    />
  </div>
);

const ResultCard = ({ label, value, unit, color, bg, border, icon }) => (
  <div className={`rounded-xl p-3 flex flex-col justify-center items-center text-center ${bg} ${border ? 'border border-gray-600' : ''}`}>
    <span className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 flex items-center gap-1">
      {icon} {label}
    </span>
    <span className={`text-xl font-black ${color}`}>
      {value} <span className="text-xs font-normal text-gray-500">{unit}</span>
    </span>
  </div>
);