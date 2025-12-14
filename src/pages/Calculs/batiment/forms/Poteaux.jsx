import React, { useState, useEffect, useMemo } from "react";
import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { 
  Columns, Ruler, Banknote, Save, Trash2, History, Anchor, Circle, Square, Type, ScanLine
} from "lucide-react";

ChartJS.register(ArcElement, Tooltip, Legend);

const STORAGE_KEY = "poteaux-batiment-history";

const DOSAGE = {
  ciment: 0.350, 
  sable: 0.6,    
  gravier: 0.85, 
  acier: 0.080,  
  eau: 175       
};

const TYPES_POTEAUX = [
  { id: "rectangulaire", label: "Rectangulaire", icon: <Square className="w-5 h-5"/> },
  { id: "circulaire", label: "Circulaire", icon: <Circle className="w-5 h-5"/> },
  { id: "t_shape", label: "Forme en T", icon: <Type className="w-5 h-5"/> },
  { id: "autre", label: "Autre", icon: <ScanLine className="w-5 h-5"/> },
];

export default function Poteaux({ currency = "XOF", onTotalChange, onMateriauxChange }) {
  
  // --- ÉTATS ---
  const [typePoteau, setTypePoteau] = useState("rectangulaire");
  const [inputs, setInputs] = useState({
    nombre: "1",
    longueur: "",      // Hauteur du poteau
    largeur: "",       // Section Rect ou Largeur T
    epaisseur: "",     // Section Rect ou Epaisseur T
    diametre: "",      // Section Circulaire
    section: "",       // Section Manuelle
    prixUnitaire: "",
    coutMainOeuvre: ""
  });

  const [historique, setHistorique] = useState([]);
  const [message, setMessage] = useState(null);

  // --- MOTEUR DE CALCUL ---
  const results = useMemo(() => {
    const nb = parseFloat(inputs.nombre) || 0;
    const h = parseFloat(inputs.longueur) || 0; 
    const pu = parseFloat(inputs.prixUnitaire) || 0;
    const mo = parseFloat(inputs.coutMainOeuvre) || 0;

    let aireSection = 0;
    if (typePoteau === "rectangulaire") {
      const l = parseFloat(inputs.largeur) || 0;
      const ep = parseFloat(inputs.epaisseur) || 0;
      aireSection = l * ep;
    } else if (typePoteau === "circulaire") {
      const d = parseFloat(inputs.diametre) || 0;
      aireSection = Math.PI * Math.pow(d / 2, 2);
    } else if (typePoteau === "t_shape") {
      const l = parseFloat(inputs.largeur) || 0; 
      const ep = parseFloat(inputs.epaisseur) || 0; 
      // Calcul simplifié T : (Largeur * Epaisseur) + ((Largeur - Epaisseur) * Epaisseur) -> Approximatif pour l'UX
      // On considère Largeur Totale et Epaisseur des jambages
      aireSection = (l * ep) + ((l * 0.6) * ep); // Estimation surface T
    } else {
      aireSection = parseFloat(inputs.section) || 0;
    }

    const volumeUnitaire = aireSection * h;
    const volumeTotal = volumeUnitaire * nb;

    // Matériaux
    const cimentT = volumeTotal * DOSAGE.ciment;
    const cimentSacs = (cimentT * 1000) / 50;
    const sableT = volumeTotal * DOSAGE.sable;
    const gravierT = volumeTotal * DOSAGE.gravier;
    const acierT = volumeTotal * DOSAGE.acier;
    const eauL = volumeTotal * DOSAGE.eau;

    // Coûts
    const coutMateriaux = volumeTotal * pu;
    const total = coutMateriaux + mo;

    return {
      aireSection,
      volumeTotal,
      cimentT, cimentSacs,
      sableT, gravierT, acierT, eauL,
      coutMateriaux, mo, total
    };
  }, [inputs, typePoteau]);

  // --- SYNC PARENT ---
  useEffect(() => {
    if (onTotalChange) onTotalChange(results.total);
    if (onMateriauxChange) {
      onMateriauxChange({
        volume: results.volumeTotal,
        ciment: results.cimentT,
        acier: results.acierT
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results.total]);

  // --- HISTORIQUE ---
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setHistorique(JSON.parse(saved));
    } catch {}
  }, []);

  const handleSave = () => {
    if (results.volumeTotal <= 0) return showToast("⚠️ Données invalides", "error");
    
    const newEntry = {
      id: Date.now(),
      date: new Date().toLocaleString(),
      type: typePoteau,
      inputs: { ...inputs },
      results: { ...results }
    };

    const newHist = [newEntry, ...historique];
    setHistorique(newHist);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newHist));
    showToast("✅ Poteaux sauvegardés !");
  };

  const clearHistory = () => {
    if (window.confirm("Vider l'historique ?")) {
      setHistorique([]);
      localStorage.removeItem(STORAGE_KEY);
      showToast("Historique vidé");
    }
  };

  const resetFields = () => {
    setInputs({ nombre: "1", longueur: "", largeur: "", epaisseur: "", diametre: "", section: "", prixUnitaire: "", coutMainOeuvre: "" });
  };

  const handleChange = (field) => (e) => setInputs(prev => ({ ...prev, [field]: e.target.value }));
  
  const showToast = (msg, type = "success") => {
    setMessage({ text: msg, type });
    setTimeout(() => setMessage(null), 3000);
  };

  // --- CHART DATA ---
  const chartData = {
    labels: ["Béton", "Main d'œuvre"],
    datasets: [{
      data: [results.coutMateriaux, results.mo],
      backgroundColor: ["#3b82f6", "#f97316"],
      borderColor: "#1f2937",
      borderWidth: 4,
    }]
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 text-gray-100">
      
      {/* Toast */}
      {message && (
        <div className={`fixed top-4 right-4 px-6 py-3 rounded-xl shadow-2xl z-50 font-bold ${message.type === "error" ? "bg-red-600" : "bg-blue-600"}`}>
          {message.text}
        </div>
      )}

      {/* Main Grid - Scrollable et Aéré */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-6 pb-24"> {/* pb-24 ajoute de l'espace en bas */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* GAUCHE : SÉLECTION & INPUTS (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            
            {/* Type Selector (Visibilité améliorée) */}
            <div className="bg-gray-800 p-2 rounded-2xl border border-gray-700 shadow-md">
              <div className="grid grid-cols-4 gap-2">
                {TYPES_POTEAUX.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTypePoteau(t.id)}
                    className={`flex flex-col items-center justify-center py-3 rounded-xl transition-all ${
                      typePoteau === t.id 
                        ? "bg-blue-600 text-white shadow-lg ring-2 ring-blue-400 ring-offset-2 ring-offset-gray-900" 
                        : "text-gray-400 hover:text-white hover:bg-gray-700"
                    }`}
                  >
                    {t.icon}
                    <span className="text-[10px] mt-1 font-bold">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Formulaire */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6 shadow-lg flex flex-col gap-5">
              <h3 className="flex items-center gap-2 text-sm font-bold text-blue-400 uppercase tracking-wider">
                <Ruler className="w-4 h-4" /> Géométrie ({typePoteau})
              </h3>

              <div className="grid grid-cols-2 gap-5">
                <div className="col-span-2">
                   <InputGroup label="Nombre de poteaux" value={inputs.nombre} onChange={handleChange("nombre")} placeholder="1" />
                </div>
                
                <InputGroup label="Hauteur (m)" value={inputs.longueur} onChange={handleChange("longueur")} placeholder="Ex: 3.00" />
                
                {/* Champs dynamiques selon le type */}
                {typePoteau === "rectangulaire" && (
                  <>
                    <InputGroup label="Largeur (m)" value={inputs.largeur} onChange={handleChange("largeur")} placeholder="Ex: 0.20" />
                    <InputGroup label="Profondeur (m)" value={inputs.epaisseur} onChange={handleChange("epaisseur")} placeholder="Ex: 0.20" />
                  </>
                )}
                {typePoteau === "circulaire" && (
                  <InputGroup label="Diamètre (m)" value={inputs.diametre} onChange={handleChange("diametre")} placeholder="Ex: 0.30" />
                )}
                {typePoteau === "t_shape" && (
                  <>
                    <InputGroup label="Largeur Totale (m)" value={inputs.largeur} onChange={handleChange("largeur")} placeholder="Ex: 0.40" />
                    <InputGroup label="Épaisseur (m)" value={inputs.epaisseur} onChange={handleChange("epaisseur")} placeholder="Ex: 0.15" />
                  </>
                )}
                {typePoteau === "autre" && (
                  <InputGroup label="Section (m²)" value={inputs.section} onChange={handleChange("section")} placeholder="Ex: 0.09" />
                )}
              </div>

              <div className="h-px bg-gray-700/50 my-2" />

              <h3 className="flex items-center gap-2 text-sm font-bold text-gray-400 uppercase tracking-wider">
                <Banknote className="w-4 h-4" /> Coûts
              </h3>
              <div className="grid grid-cols-2 gap-5">
                <InputGroup label={`Prix Béton (${currency}/m³)`} value={inputs.prixUnitaire} onChange={handleChange("prixUnitaire")} />
                <InputGroup label={`Main d'œuvre (${currency})`} value={inputs.coutMainOeuvre} onChange={handleChange("coutMainOeuvre")} />
              </div>

              <div className="flex gap-3 mt-4">
                <button onClick={handleSave} className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-90 text-white py-3.5 rounded-xl font-bold shadow-lg active:scale-95 transition-all flex justify-center items-center gap-2">
                  <Save className="w-5 h-5" /> Calculer
                </button>
                <button onClick={resetFields} className="px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-xl transition">
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* DROITE : RÉSULTATS (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            
            {/* KPIs */}
            <div className="grid grid-cols-3 gap-4">
              <ResultCard label="Volume Total" value={results.volumeTotal.toFixed(2)} unit="m³" icon="🧊" color="text-blue-400" bg="bg-blue-500/10" />
              <ResultCard label="Ciment" value={results.cimentSacs.toFixed(1)} unit="sacs" icon="🧱" color="text-gray-300" bg="bg-gray-500/10" border />
              <ResultCard label="Acier" value={(results.acierT * 1000).toFixed(0)} unit="kg" icon={<Anchor className="w-4 h-4"/>} color="text-red-400" bg="bg-red-500/10" />
            </div>

            {/* Graphique & Détails */}
            <div className="flex-1 bg-gray-800 rounded-2xl p-6 border border-gray-700 shadow-xl flex flex-col md:flex-row gap-8 items-center relative overflow-hidden">
               <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

               <div className="w-40 h-40 flex-shrink-0 relative">
                  <Doughnut data={chartData} options={{ cutout: "70%", plugins: { legend: { display: false } } }} />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                     <span className="text-sm font-bold text-blue-400">Total</span>
                  </div>
               </div>

               <div className="flex-1 w-full space-y-3">
                  <h4 className="text-gray-400 text-sm font-medium border-b border-gray-700 pb-2">Matériaux (Dosage 350kg/m³)</h4>
                  <MaterialRow label="Ciment" val={`${results.cimentT.toFixed(2)} t`} color="bg-blue-500" />
                  <MaterialRow label="Sable" val={`${results.sableT.toFixed(2)} t`} color="bg-amber-500" />
                  <MaterialRow label="Gravier" val={`${results.gravierT.toFixed(2)} t`} color="bg-stone-500" />
                  <MaterialRow label="Acier (80kg/m³)" val={`${results.acierT.toFixed(3)} t`} color="bg-red-500" />
               </div>
            </div>

            {/* Historique */}
            {historique.length > 0 && (
              <div className="bg-gray-800/30 rounded-2xl border border-gray-700/50 overflow-hidden flex-1 min-h-[150px]">
                <div className="px-4 py-3 bg-gray-800/50 border-b border-gray-700/50 flex justify-between items-center">
                  <h4 className="text-xs font-bold text-gray-400 flex items-center gap-2">
                    <History className="w-3 h-3" /> Historique récent
                  </h4>
                  <button onClick={clearHistory} className="text-[10px] text-red-400 hover:underline">Vider</button>
                </div>
                <div className="overflow-y-auto max-h-[180px] p-2 space-y-2">
                  {historique.map((item) => (
                    <div key={item.id} className="flex justify-between items-center bg-gray-700/30 p-2 rounded hover:bg-gray-700/50 transition border border-transparent hover:border-blue-500/30">
                      <div className="flex flex-col">
                         <span className="text-[10px] text-gray-500">{item.date.split(',')[0]}</span>
                         <span className="text-xs text-gray-300">
                           {item.inputs.nombre}x {item.type} (Vol: {item.results.volumeTotal.toFixed(1)}m³)
                         </span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-bold text-blue-400">{item.results.total.toLocaleString()} {currency}</span>
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

const InputGroup = ({ label, value, onChange, placeholder, full = false, type = "number" }) => (
  <div className={`flex flex-col ${full ? "col-span-2" : ""}`}>
    <label className="mb-2 text-[11px] font-bold text-gray-400 uppercase tracking-wide">{label}</label>
    <input
      type={type}
      min="0"
      step="any"
      value={value}
      onChange={onChange}
      className="w-full bg-gray-900 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono text-sm"
      placeholder={placeholder || "0"}
    />
  </div>
);

const ResultCard = ({ label, value, unit, color, bg, border, icon }) => (
  <div className={`rounded-xl p-4 flex flex-col justify-center items-center text-center ${bg} ${border ? 'border border-gray-600' : ''}`}>
    <span className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 flex items-center gap-1">
      {typeof icon === 'string' ? icon : <span className="opacity-70">{icon}</span>} {label}
    </span>
    <span className={`text-2xl font-black ${color}`}>
      {value} <span className="text-xs font-normal text-gray-500">{unit}</span>
    </span>
  </div>
);

const MaterialRow = ({ label, val, color }) => (
  <div className="flex justify-between items-center border-b border-gray-700/50 pb-2 last:border-0 group">
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${color}`} />
      <span className="text-gray-300 text-sm font-medium">{label}</span>
    </div>
    <span className="text-sm font-bold text-white font-mono">{val}</span>
  </div>
);