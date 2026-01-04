import React, { useState, useEffect, useMemo } from "react";
import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS, ArcElement, Tooltip, Legend,
} from "chart.js";
import { 
  AlertTriangle, TrafficCone, MapPin, Shield, Construction, 
  Save, Trash2, History, Banknote, Lightbulb, Ruler, Info, Package, Hammer
} from "lucide-react";

ChartJS.register(ArcElement, Tooltip, Legend);

const STORAGE_KEY = "signalisation-history-pro";

// Configuration Technique Pro (Normes SETRA / NF)
const EQUIPMENT_CONFIG = {
  panneaux: { 
    label: "Panneaux", icon: <AlertTriangle className="w-5 h-5"/>, 
    unit: "u", color: "#f59e0b", desc: "Signalisation verticale" 
  },
  feux: { 
    label: "Feux Tricolores", icon: <Lightbulb className="w-5 h-5"/>, 
    unit: "u", color: "#ef4444", desc: "Gestion de trafic" 
  },
  glissieres: { 
    label: "Glissières", icon: <Shield className="w-5 h-5"/>, 
    unit: "ml", color: "#64748b", poidsML: 20, desc: "Dispositif de retenue acier" 
  },
  marquage: { 
    label: "Marquage Sol", icon: <Construction className="w-5 h-5"/>, 
    unit: "m²", color: "#fbbf24", consoKgM2: 0.7, desc: "Signalisation horizontale" 
  },
  bornes: { 
    label: "Bornes / PK", icon: <MapPin className="w-5 h-5"/>, 
    unit: "u", color: "#ec4899", desc: "Balisage et kilométrage" 
  },
  divers: { 
    label: "Divers", icon: <TrafficCone className="w-5 h-5"/>, 
    unit: "u", color: "#10b981", desc: "Équipements spécifiques" 
  },
};

export default function EquipementsDeSignalisationForm({ currency = "XOF", onCostChange, onMateriauxChange }) {
  
  // --- ÉTATS ---
  const [selectedType, setSelectedType] = useState("panneaux");
  const [inputs, setInputs] = useState({
    quantite: "",
    coutUnitaire: "", 
    coutMainOeuvre: "",
    dimension: "",    
    marge: "5" 
  });

  const [historique, setHistorique] = useState([]);
  const [message, setMessage] = useState(null);

  // --- MOTEUR DE CALCUL TECHNIQUE ---
  const results = useMemo(() => {
    const qte = parseFloat(inputs.quantite) || 0;
    const cu = parseFloat(inputs.coutUnitaire) || 0;
    const mo = parseFloat(inputs.coutMainOeuvre) || 0;
    const margin = 1 + (parseFloat(inputs.marge) || 0) / 100;
    const config = EQUIPMENT_CONFIG[selectedType];

    const totalMateriaux = qte * cu * margin;
    const totalPose = qte * mo; 
    const total = totalMateriaux + totalPose;

    // Estimation des masses pour la logistique (Tonnage)
    let poidsLogistiqueT = 0;
    if (selectedType === 'marquage') {
        poidsLogistiqueT = (qte * config.consoKgM2 * margin) / 1000;
    } else if (selectedType === 'glissieres') {
        poidsLogistiqueT = (qte * config.poidsML * margin) / 1000;
    }

    return { qte, totalMateriaux, totalPose, total, poidsLogistiqueT };
  }, [inputs, selectedType]);

  // --- SYNC PARENT ---
  useEffect(() => {
    onCostChange?.(results.total);
    if (onMateriauxChange) {
        onMateriauxChange({ 
            poidsLogistique: results.poidsLogistiqueT, 
            total: results.total 
        });
    }
  }, [results.total, selectedType]);

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
      type: selectedType,
      label: EQUIPMENT_CONFIG[selectedType].label,
      ...inputs, ...results
    };
    const newHist = [newEntry, ...historique];
    setHistorique(newHist);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newHist));
    showToast("✅ Équipement enregistré !");
  };

  const showToast = (msg, type = "success") => {
    setMessage({ text: msg, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const chartData = {
    labels: ["Matériel", "Pose / Installation"],
    datasets: [{
      data: [results.totalMateriaux, results.totalPose],
      backgroundColor: [EQUIPMENT_CONFIG[selectedType].color, "#374151"],
      borderColor: "#111827",
      borderWidth: 2,
    }]
  };

  return (
    <div className="w-full h-full flex flex-col bg-gray-900 text-gray-100 overflow-hidden relative font-sans">
      
      {message && (
        <div className={`fixed top-4 right-4 px-6 py-3 rounded-xl shadow-2xl z-50 font-bold animate-in fade-in slide-in-from-top-2 ${
          message.type === "error" ? "bg-red-600" : "bg-orange-600"
        }`}>
          {message.text}
        </div>
      )}

      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-600/20 rounded-lg text-orange-500">
            <TrafficCone className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white uppercase tracking-tight">Signalisation & Sécurité</h2>
            <p className="text-xs text-gray-400 font-medium">Balisage et équipements de route</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-gray-500 uppercase font-bold block tracking-widest">Budget Estimé</span>
          <span className="text-2xl font-black text-orange-400 tracking-tighter">
            {results.total.toLocaleString()} <span className="text-sm text-gray-500 font-normal">{currency}</span>
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-6 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* GAUCHE : SÉLECTION & INPUTS */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            
            {/* Grid de sélection pro */}
            <div className="grid grid-cols-3 gap-2 bg-gray-800 p-2 rounded-2xl border border-gray-700">
              {Object.entries(EQUIPMENT_CONFIG).map(([id, cfg]) => (
                <button
                  key={id}
                  onClick={() => { setSelectedType(id); setInputs({...inputs, quantite: ""}); }}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl transition-all ${
                    selectedType === id 
                      ? "bg-orange-600 text-white shadow-lg scale-105" 
                      : "text-gray-500 hover:bg-gray-700"
                  }`}
                >
                  {cfg.icon}
                  <span className="text-[10px] mt-1 font-bold uppercase">{cfg.label}</span>
                </button>
              ))}
            </div>

            <div className="bg-gray-800/50 border border-gray-700 rounded-3xl p-6 shadow-xl space-y-6">
              <h3 className="flex items-center gap-2 text-xs font-bold text-orange-400 uppercase tracking-widest">
                <Target className="w-4 h-4" /> Détails de la ligne
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <InputGroup 
                    label={`Quantité (${EQUIPMENT_CONFIG[selectedType].unit})`} 
                    value={inputs.quantite} 
                    onChange={v => setInputs({...inputs, quantite: v})} 
                    placeholder="0"
                />
                <InputGroup label="Marge Perte (%)" value={inputs.marge} onChange={v => setInputs({...inputs, marge: v})} />
                
                {selectedType === "panneaux" && (
                  <InputGroup label="Dimensions (cm)" value={inputs.dimension} onChange={v => setInputs({...inputs, dimension: v})} placeholder="Ex: 80x80" full />
                )}
              </div>

              <div className="pt-4 border-t border-gray-700 grid grid-cols-2 gap-4">
                <InputGroup label={`PU Achat (${currency})`} value={inputs.coutUnitaire} onChange={v => setInputs({...inputs, coutUnitaire: v})} />
                <InputGroup label={`PU Pose (${currency})`} value={inputs.coutMainOeuvre} onChange={v => setInputs({...inputs, coutMainOeuvre: v})} />
              </div>

              <button 
                onClick={handleSave}
                className="w-full bg-orange-600 hover:bg-orange-500 text-white py-4 rounded-2xl font-bold shadow-lg transition-all flex justify-center items-center gap-2 active:scale-95"
              >
                <Save className="w-5 h-5" /> Ajouter au devis
              </button>
            </div>
          </div>

          {/* DROITE : RÉSULTATS */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            
            <div className="grid grid-cols-3 gap-4">
              <ResultCard label="Total Fourniture" value={results.totalMateriaux.toFixed(0)} unit={currency} icon={<Package className="w-4 h-4"/>} color="text-orange-400" bg="bg-orange-500/10" />
              <ResultCard label="Masse Logistique" value={results.poidsLogistiqueT.toFixed(2)} unit="Tons" icon={<Ruler className="w-4 h-4"/>} color="text-white" bg="bg-gray-800" border />
              <ResultCard label="Total Pose" value={results.totalPose.toFixed(0)} unit={currency} icon={<Hammer className="w-4 h-4"/>} color="text-blue-400" bg="bg-blue-500/10" />
            </div>

            <div className="flex-1 bg-gray-800 rounded-3xl p-8 border border-gray-700 shadow-xl flex flex-col md:flex-row gap-10 items-center relative overflow-hidden">
               <div className="absolute -bottom-10 -right-10 w-44 h-44 bg-orange-600/10 rounded-full blur-3xl pointer-events-none" />

               <div className="w-48 h-48 flex-shrink-0 relative">
                  <Doughnut data={chartData} options={{ cutout: "75%", plugins: { legend: { display: false } } }} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                     <span className="text-[10px] text-gray-500 uppercase font-bold text-center leading-tight">Structure<br/>du coût</span>
                  </div>
               </div>

               <div className="flex-1 w-full space-y-4">
                  <h4 className="text-gray-400 text-xs font-bold uppercase tracking-widest border-b border-gray-700 pb-2 mb-2">Analyse Technique</h4>
                  
                  {selectedType === 'marquage' && (
                    <MaterialRow label="Besoin Peinture" val={`${(results.poidsLogistiqueT * 1000).toFixed(1)} kg`} color="bg-yellow-500" />
                  )}
                  {selectedType === 'glissieres' && (
                    <MaterialRow label="Acier de retenue" val={`${(results.poidsLogistiqueT * 1000).toFixed(0)} kg`} color="bg-blue-500" />
                  )}
                  
                  <div className="flex items-start gap-2 p-3 bg-blue-500/5 rounded-xl border border-blue-500/20 mt-4">
                    <Info className="w-4 h-4 text-blue-400 mt-0.5" />
                    <p className="text-[10px] text-blue-200/70 leading-relaxed italic">
                      Les calculs de masse sont basés sur les standards SETRA (Glissière 20kg/ml, Peinture 0.7kg/m²).
                    </p>
                  </div>
               </div>
            </div>

            {/* Historique Mini */}
            {historique.length > 0 && (
              <div className="bg-gray-800/30 rounded-2xl border border-gray-700/50 overflow-hidden">
                <div className="px-4 py-2 bg-gray-800/50 border-b border-gray-700/50 flex justify-between items-center text-xs">
                  <h4 className="font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2"><History className="w-3 h-3" /> Historique</h4>
                  <button onClick={() => {setHistorique([]); localStorage.removeItem(STORAGE_KEY)}} className="text-red-400 hover:underline uppercase text-[10px]">Vider</button>
                </div>
                <div className="max-h-[120px] overflow-y-auto">
                  {historique.slice(0, 5).map((item) => (
                    <div key={item.id} className="flex justify-between items-center p-3 border-b border-gray-700/30 hover:bg-gray-700/40 transition-colors">
                      <div className="text-xs">
                        <span className="text-gray-500 block text-[9px]">{item.date}</span>
                        <span className="font-medium uppercase">{item.label} - {item.quantite} {EQUIPMENT_CONFIG[item.type].unit}</span>
                      </div>
                      <span className="text-sm font-bold text-orange-400">{parseFloat(item.total).toLocaleString()} {currency}</span>
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
      className="w-full bg-gray-900 border border-gray-600 rounded-xl px-4 py-3 text-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all font-mono text-sm"
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