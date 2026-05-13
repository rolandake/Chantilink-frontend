import React, { useState, useEffect, useMemo } from "react";
import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { 
  PaintRoller, Grid3X3, Hammer, Layers, Palette, Component,
  Save, Trash2, History, Ruler, Banknote, Brush, Info, Package, Droplets
} from "lucide-react";

ChartJS.register(ArcElement, Tooltip, Legend);

const STORAGE_KEY = "finitions-history-pro";

const FINITION_CONFIG = {
  peinture: { 
    label: "Peinture", icon: <PaintRoller className="w-5 h-5"/>, color: "#8b5cf6", 
    rendement: 10, perte: 5, unit: "L" 
  },
  carrelage: { 
    label: "Carrelage Sol", icon: <Grid3X3 className="w-5 h-5"/>, color: "#10b981", 
    colleKgM2: 5, jointKgM2: 0.5, perte: 10, unit: "m²" 
  },
  parquet: { 
    label: "Parquet", icon: <Component className="w-5 h-5"/>, color: "#f59e0b", 
    perte: 8, unit: "m²" 
  },
  platre: { 
    label: "Enduit / Plâtre", icon: <Layers className="w-5 h-5"/>, color: "#9ca3af", 
    consoKgM2: 1.5, perte: 5, unit: "kg" 
  },
  faience: { 
    label: "Faïence Murale", icon: <Palette className="w-5 h-5"/>, color: "#06b6d4", 
    colleKgM2: 4, jointKgM2: 0.4, perte: 12, unit: "m²" 
  }
};

// ✅ Lecture sécurisée du localStorage — évite un crash si les données sont corrompues
const safeLoadHistorique = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // ✅ Filtre les entrées invalides (sans id ou sans total lisible)
    return parsed.filter(item => item && item.id && typeof item.total === "number");
  } catch {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    return [];
  }
};

export default function Finitions({ currency = "XOF", onTotalChange, onMateriauxChange }) {
  
  const [selectedType, setSelectedType] = useState("peinture");
  const [inputs, setInputs] = useState({
    surface:        "",
    prixMateriel:   "",
    prixMainOeuvre: "",
    couches:        "2",
    marge:          "10",
  });

  // ✅ Chargement sécurisé
  const [historique, setHistorique] = useState(safeLoadHistorique);
  const [message,    setMessage]    = useState(null);

  const results = useMemo(() => {
    const surf   = parseFloat(inputs.surface)        || 0;
    const pm     = parseFloat(inputs.prixMateriel)   || 0;
    const mo     = parseFloat(inputs.prixMainOeuvre) || 0;
    const margin = 1 + (parseFloat(inputs.marge)     || 0) / 100;
    const config = FINITION_CONFIG[selectedType];

    let totalMateriaux  = 0;
    let totalMainOeuvre = surf * mo;
    let qtePrincipale   = 0;
    let sacsColle       = 0;

    if (selectedType === "peinture") {
      const nbCouches = parseFloat(inputs.couches) || 2;
      qtePrincipale   = (surf * nbCouches) / config.rendement * margin;
      totalMateriaux  = qtePrincipale * pm;
    } else if (selectedType === "carrelage" || selectedType === "faience") {
      qtePrincipale  = surf * margin;
      totalMateriaux = qtePrincipale * pm;
      sacsColle      = Math.ceil((surf * config.colleKgM2) / 25);
    } else {
      qtePrincipale  = surf * margin;
      totalMateriaux = qtePrincipale * pm;
    }

    const total = totalMateriaux + totalMainOeuvre;
    return { surface: surf, qtePrincipale, sacsColle, totalMateriaux, totalMainOeuvre, total };
  }, [inputs, selectedType]);

  useEffect(() => {
    if (typeof onTotalChange === "function") onTotalChange(results.total);
  }, [results.total, onTotalChange]);

  const showToast = (msg, type = "success") => {
    setMessage({ text: msg, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleSave = () => {
    if (results.total <= 0) return showToast("⚠️ Entrez une surface valide", "error");

    // ✅ FIX — on stocke total, totalMateriaux, totalMainOeuvre à la RACINE de l'objet
    //    (pas dans un sous-objet results) pour cohérence avec la lecture dans le template.
    //    Ancienne version faisait ...results → item.results était undefined.
    const newEntry = {
      id:              Date.now(),
      date:            new Date().toLocaleString("fr-FR"),
      type:            selectedType,
      label:           FINITION_CONFIG[selectedType].label,
      surface:         inputs.surface,
      prixMateriel:    inputs.prixMateriel,
      prixMainOeuvre:  inputs.prixMainOeuvre,
      couches:         inputs.couches,
      marge:           inputs.marge,
      // ✅ Champs résultats à la racine — lisibles directement via item.total
      qtePrincipale:   results.qtePrincipale,
      sacsColle:       results.sacsColle,
      totalMateriaux:  results.totalMateriaux,
      totalMainOeuvre: results.totalMainOeuvre,
      total:           results.total,
    };

    const newHist = [newEntry, ...historique];
    setHistorique(newHist);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newHist));
    } catch {
      // Storage plein → on ignore
    }
    showToast("✅ Finition enregistrée");
  };

  const handleClearHistorique = () => {
    setHistorique([]);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  };

  const chartData = {
    labels: ["Fournitures", "Pose"],
    datasets: [{
      data: [results.totalMateriaux, results.totalMainOeuvre],
      backgroundColor: [FINITION_CONFIG[selectedType].color, "#374151"],
      borderColor: "#111827",
      borderWidth: 2,
    }],
  };

  return (
    <div className="w-full h-full flex flex-col bg-gray-900 text-gray-100 overflow-hidden relative">
      
      {message && (
        <div className={`fixed top-4 right-4 px-6 py-3 rounded-xl shadow-2xl z-50 font-bold animate-bounce ${
          message.type === "error" ? "bg-red-600" : "bg-violet-600"
        }`}>
          {message.text}
        </div>
      )}

      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-violet-500/20 rounded-lg text-violet-400">
            <Brush className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Second Œuvre : Finitions</h2>
            <p className="text-xs text-gray-400 font-medium">Revêtements & Décoration</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-gray-500 uppercase font-bold block">Budget Estimé</span>
          <span className="text-2xl font-black text-violet-400 tracking-tighter">
            {results.total.toLocaleString()} <span className="text-sm text-gray-500 font-normal">{currency}</span>
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-6 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
          
          {/* GAUCHE : CONFIGURATION */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            
            <div className="grid grid-cols-5 gap-2 bg-gray-800 p-2 rounded-2xl border border-gray-700 shadow-inner">
              {Object.entries(FINITION_CONFIG).map(([id, cfg]) => (
                <button
                  key={id}
                  onClick={() => setSelectedType(id)}
                  className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all ${
                    selectedType === id 
                      ? "bg-violet-600 text-white shadow-lg scale-105" 
                      : "text-gray-500 hover:bg-gray-700"
                  }`}
                  title={cfg.label}
                >
                  {cfg.icon}
                  <span className="text-[8px] mt-1 font-bold uppercase truncate w-full text-center">{cfg.label}</span>
                </button>
              ))}
            </div>

            <div className="bg-gray-800/50 border border-gray-700 rounded-3xl p-6 shadow-xl space-y-6">
              <h3 className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
                <Ruler className="w-4 h-4" /> Paramètres de calcul
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <InputGroup label="Surface (m²)" value={inputs.surface} onChange={v => setInputs({...inputs, surface: v})} />
                <InputGroup label="Pertes (%)" value={inputs.marge} onChange={v => setInputs({...inputs, marge: v})} />
                {selectedType === "peinture" && (
                  <InputGroup label="Nb de couches" value={inputs.couches} onChange={v => setInputs({...inputs, couches: v})} full />
                )}
              </div>

              <div className="pt-4 border-t border-gray-700 grid grid-cols-2 gap-4">
                <InputGroup label={`Prix Matériel (${currency}/${FINITION_CONFIG[selectedType].unit})`} value={inputs.prixMateriel} onChange={v => setInputs({...inputs, prixMateriel: v})} />
                <InputGroup label={`Prix Pose (${currency}/m²)`} value={inputs.prixMainOeuvre} onChange={v => setInputs({...inputs, prixMainOeuvre: v})} />
              </div>

              <button 
                onClick={handleSave}
                className="w-full bg-violet-600 hover:bg-violet-500 text-white py-4 rounded-2xl font-bold shadow-lg transition-all flex justify-center items-center gap-2 active:scale-95"
              >
                <Save className="w-5 h-5" /> Enregistrer la ligne
              </button>
            </div>
          </div>

          {/* DROITE : RÉSULTATS */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            
            <div className="grid grid-cols-3 gap-4">
              <ResultCard 
                label={`Besoin ${FINITION_CONFIG[selectedType].unit}`} 
                value={results.qtePrincipale.toFixed(1)} 
                unit={FINITION_CONFIG[selectedType].unit} 
                icon={<Package className="w-4 h-4"/>} 
                color="text-violet-400" 
                bg="bg-violet-500/10" 
              />
              <ResultCard 
                label="Fournitures" 
                value={results.totalMateriaux.toLocaleString()} 
                unit={currency} 
                icon="🧱" 
                color="text-blue-400" 
                bg="bg-blue-500/10" 
                border 
              />
              <ResultCard 
                label="Main d'œuvre" 
                value={results.totalMainOeuvre.toLocaleString()} 
                unit={currency} 
                icon="👷" 
                color="text-cyan-400" 
                bg="bg-cyan-500/10" 
              />
            </div>

            <div className="flex-1 bg-gray-800 rounded-3xl p-6 border border-gray-700 shadow-xl flex flex-col md:flex-row gap-8 items-center relative overflow-hidden">
              <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />

              <div className="w-44 h-44 flex-shrink-0 relative">
                <Doughnut data={chartData} options={{ cutout: "75%", plugins: { legend: { display: false } } }} />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[10px] text-gray-500 uppercase font-bold">Ratio</span>
                  <span className="text-sm font-bold text-white">
                    {results.total > 0 ? Math.round((results.totalMateriaux / results.total) * 100) : 0}% Matos
                  </span>
                </div>
              </div>

              <div className="flex-1 w-full space-y-4">
                <h4 className="text-gray-400 text-xs font-bold uppercase tracking-widest border-b border-gray-700 pb-2">Détails Logistiques</h4>
                
                {selectedType === "peinture" && (
                  <MaterialRow label="Volume de peinture" val={`${results.qtePrincipale.toFixed(1)} Litres`} color="bg-violet-500" />
                )}
                {(selectedType === "carrelage" || selectedType === "faience") && (
                  <>
                    <MaterialRow label="Carreaux (Nets)" val={`${results.qtePrincipale.toFixed(1)} m²`} color="bg-emerald-500" />
                    <MaterialRow label="Colle (Sacs 25kg)" val={`${results.sacsColle} sacs`} color="bg-blue-500" />
                  </>
                )}
                
                <div className="pt-2 border-t border-gray-700 flex justify-between items-center">
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Info className="w-3 h-3 text-violet-400" /> Rendement estimé
                  </span>
                  <span className="text-sm font-bold text-white">
                    {selectedType === "peinture" ? "10 m²/L" : "Standard BE"}
                  </span>
                </div>
              </div>
            </div>

            {/* Historique */}
            {historique.length > 0 && (
              <div className="bg-gray-800/30 rounded-2xl border border-gray-700/50 overflow-hidden">
                <div className="px-4 py-2 bg-gray-800/50 flex justify-between items-center border-b border-gray-700/50">
                  <h4 className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2">
                    <History className="w-3 h-3" /> Devis Finitions
                  </h4>
                  <button
                    onClick={handleClearHistorique}
                    className="text-[10px] text-red-400 hover:underline"
                  >
                    Vider
                  </button>
                </div>
                <div className="max-h-[120px] overflow-y-auto">
                  {historique.map((item) => (
                    <div key={item.id} className="flex justify-between items-center p-3 border-b border-gray-700/30 hover:bg-gray-700/40 transition-colors">
                      <div className="text-xs">
                        <span className="text-gray-500 text-[9px] block">{item.date}</span>
                        <span className="font-medium">{item.label} — {item.surface} m²</span>
                      </div>
                      {/* ✅ FIX — item.total à la racine (plus item.results.total) */}
                      <span className="text-sm font-bold text-violet-400">
                        {(item.total ?? 0).toLocaleString()} {currency}
                      </span>
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
      type="number"
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full bg-gray-900 border border-gray-600 rounded-xl px-4 py-2.5 text-white focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all font-mono text-sm"
      placeholder={placeholder || "0"}
    />
  </div>
);

const ResultCard = ({ label, value, unit, color, bg, border, icon }) => (
  <div className={`rounded-2xl p-4 flex flex-col justify-center items-center text-center ${bg} ${border ? "border border-gray-700" : ""}`}>
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