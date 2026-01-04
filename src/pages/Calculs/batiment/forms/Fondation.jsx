import React, { useState, useEffect, useMemo } from "react";
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { 
  BrickWall, Ruler, Banknote, Save, Trash2, History, Anchor, Droplets, Info, Target
} from "lucide-react";

ChartJS.register(ArcElement, Tooltip, Legend);

const STORAGE_KEY = "fondation-history-pro";

// Configuration dynamique pour se rapprocher de la réalité BE
const TYPES_FONDATION = {
  FILANTE: { label: "Semelle Filante (Mur)", acier: 45, icon: "📏" }, // Ratio kg/m3
  ISOLEE: { label: "Semelle Isolée (Poteau)", acier: 70, icon: "🟦" },
  RADIER: { label: "Radier Général", acier: 90, icon: "🍱" },
};

const DOSAGES_CIMENT = {
  300: { label: "300 kg/m³", ciment: 0.3, sable: 0.65, gravier: 0.85 },
  350: { label: "350 kg/m³ (Standard BA)", ciment: 0.35, sable: 0.6, gravier: 0.8 },
};

export default function Fondation({ currency = "XOF", onCostChange, onMateriauxChange }) {
  
  // --- ÉTATS ---
  const [inputs, setInputs] = useState({
    typeFondation: "FILANTE",
    dosage: "350",
    longueur: "",
    largeur: "",
    profondeur: "",
    prixUnitaire: "",
    coutMainOeuvre: "",
    margePerte: "10" // Marge de sécurité en %
  });

  const [historique, setHistorique] = useState([]);
  const [message, setMessage] = useState(null);

  // --- MOTEUR DE CALCUL ---
  const results = useMemo(() => {
    const L = parseFloat(inputs.longueur) || 0;
    const l = parseFloat(inputs.largeur) || 0;
    const p = parseFloat(inputs.profondeur) || 0;
    const marge = 1 + (parseFloat(inputs.margePerte) || 0) / 100;

    const volumeBrut = L * l * p;
    const volumeCommande = volumeBrut * marge; // Volume avec pertes

    const configDosage = DOSAGES_CIMENT[inputs.dosage];
    const ratioAcier = TYPES_FONDATION[inputs.typeFondation].acier;

    // Calculs Matériaux
    const cimentT = volumeCommande * configDosage.ciment;
    const cimentSacs = (cimentT * 1000) / 50;
    const sableT = volumeCommande * configDosage.sable;
    const gravierT = volumeCommande * configDosage.gravier;
    
    // Acier avec recouvrement de 10% inclus dans la marge globale
    const acierKg = volumeCommande * ratioAcier;
    const acierT = acierKg / 1000;
    
    const eauL = volumeCommande * 175; // Moyenne L/m3

    // Coûts
    const pu = parseFloat(inputs.prixUnitaire) || 0;
    const mo = parseFloat(inputs.coutMainOeuvre) || 0;
    const coutMateriaux = volumeCommande * pu;
    const total = coutMateriaux + mo;

    return {
      volumeBrut,
      volumeCommande,
      cimentT, cimentSacs,
      sableT,
      gravierT,
      acierT, acierKg,
      eauL,
      total
    };
  }, [inputs]);

  // --- SYNC PARENT & HISTORIQUE ---
  useEffect(() => {
    if (onCostChange) onCostChange(results.total);
    if (onMateriauxChange) {
      onMateriauxChange({ volume: results.volumeCommande, ciment: results.cimentT, acier: results.acierT });
    }
  }, [results.total]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setHistorique(JSON.parse(saved));
    } catch {}
  }, []);

  const handleSave = () => {
    if (results.volumeBrut <= 0) return showToast("⚠️ Dimensions manquantes", "error");
    const newEntry = {
      id: Date.now(),
      date: new Date().toLocaleString(),
      type: TYPES_FONDATION[inputs.typeFondation].label,
      ...inputs,
      ...results
    };
    const newHist = [newEntry, ...historique];
    setHistorique(newHist);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newHist));
    showToast("✅ Fondation enregistrée !");
  };

  const showToast = (msg, type = "success") => {
    setMessage({ text: msg, type });
    setTimeout(() => setMessage(null), 3000);
  };

  // --- CHART DATA ---
  const chartData = {
    labels: ["Ciment", "Sable", "Gravier", "Acier"],
    datasets: [{
      data: [results.cimentT, results.sableT, results.gravierT, results.acierT],
      backgroundColor: ["#ef4444", "#fbbf24", "#78716c", "#3b82f6"],
      borderColor: "#111827",
      borderWidth: 2,
    }]
  };

  return (
    <div className="w-full h-full flex flex-col bg-gray-900 text-gray-100 overflow-hidden relative">
      
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
            <h2 className="text-xl font-bold text-white">Fondation & Semelles</h2>
            <p className="text-xs text-gray-400 font-medium">Béton Armé Structurel</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-gray-500 uppercase font-bold block tracking-widest">Total Estimé</span>
          <span className="text-2xl font-black text-red-500 tracking-tighter">
            {results.total.toLocaleString()} <span className="text-sm text-gray-500 font-normal">{currency}</span>
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
          
          {/* GAUCHE : SAISIE (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            
            {/* 1. Type d'ouvrage */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-4">
              <h3 className="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-3">Type d'élément</h3>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(TYPES_FONDATION).map(([key, type]) => (
                  <button
                    key={key}
                    onClick={() => setInputs(prev => ({...prev, typeFondation: key}))}
                    className={`p-2 rounded-xl border text-[10px] font-bold transition-all flex flex-col items-center gap-1 ${
                      inputs.typeFondation === key ? "border-red-500 bg-red-500/10 text-red-400" : "border-gray-700 bg-gray-800 text-gray-500"
                    }`}
                  >
                    <span className="text-lg">{type.icon}</span>
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Dimensions */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5 shadow-lg">
              <h3 className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase mb-4">
                <Ruler className="w-3 h-3" /> Dimensions Géométriques
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label="Longueur (m)" value={inputs.longueur} onChange={(e) => setInputs({...inputs, longueur: e.target.value})} />
                <InputGroup label="Largeur (m)" value={inputs.largeur} onChange={(e) => setInputs({...inputs, largeur: e.target.value})} />
                <InputGroup label="Épaisseur / Prof. (m)" value={inputs.profondeur} onChange={(e) => setInputs({...inputs, profondeur: e.target.value})} full />
              </div>
            </div>

            {/* 3. Paramètres Techniques */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5 flex-1">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Dosage Ciment</label>
                  <select 
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg p-2 text-sm text-white focus:border-red-500 outline-none"
                    value={inputs.dosage}
                    onChange={(e) => setInputs({...inputs, dosage: e.target.value})}
                  >
                    {Object.entries(DOSAGES_CIMENT).map(([kg, val]) => (
                      <option key={kg} value={kg}>{val.label}</option>
                    ))}
                  </select>
                </div>
                <InputGroup label="Pertes & Recouv. (%)" value={inputs.margePerte} onChange={(e) => setInputs({...inputs, margePerte: e.target.value})} />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label={`Prix Unitaire (${currency}/m³)`} value={inputs.prixUnitaire} onChange={(e) => setInputs({...inputs, prixUnitaire: e.target.value})} />
                <InputGroup label={`Main d'œuvre (${currency})`} value={inputs.coutMainOeuvre} onChange={(e) => setInputs({...inputs, coutMainOeuvre: e.target.value})} />
              </div>

              <button 
                onClick={handleSave}
                className="w-full mt-6 bg-red-600 hover:bg-red-500 text-white py-3.5 rounded-xl font-bold shadow-lg transition-all flex justify-center items-center gap-2"
              >
                <Save className="w-5 h-5" /> Calculer & Enregistrer
              </button>
            </div>
          </div>

          {/* DROITE : RÉSULTATS (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            
            <div className="grid grid-cols-3 gap-4">
              <ResultCard label="Volume à Commander" value={results.volumeCommande.toFixed(2)} unit="m³" icon="🧊" color="text-red-400" bg="bg-red-500/10" />
              <ResultCard label="Ciment" value={results.cimentSacs.toFixed(1)} unit="sacs" icon="🧱" color="text-gray-200" bg="bg-gray-500/10" border />
              <ResultCard label="Acier" value={results.acierKg.toFixed(0)} unit="kg" icon={<Target className="w-4 h-4"/>} color="text-blue-400" bg="bg-blue-500/10" />
            </div>

            <div className="flex-1 bg-gray-800 rounded-2xl p-6 border border-gray-700 shadow-xl flex flex-col md:flex-row gap-8 items-center relative overflow-hidden">
               <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-red-600/5 rounded-full blur-3xl" />

               <div className="w-40 h-40 flex-shrink-0 relative">
                  <Doughnut data={chartData} options={{ cutout: "75%", plugins: { legend: { display: false } } }} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                     <span className="text-[10px] text-gray-500 uppercase">Poids</span>
                     <span className="text-sm font-bold text-red-500">{(results.cimentT + results.sableT + results.gravierT + results.acierT).toFixed(1)} T</span>
                  </div>
               </div>

               <div className="flex-1 w-full space-y-3">
                  <h4 className="text-gray-400 text-xs font-bold uppercase tracking-widest border-b border-gray-700 pb-2 mb-2">Détails des fournitures</h4>
                  
                  <MaterialRow label="Ciment" val={`${results.cimentT.toFixed(2)} t`} color="bg-red-500" />
                  <MaterialRow label="Sable" val={`${results.sableT.toFixed(2)} t`} color="bg-amber-500" />
                  <MaterialRow label="Gravier" val={`${results.gravierT.toFixed(2)} t`} color="bg-stone-500" />
                  <MaterialRow label={`Acier (${TYPES_FONDATION[inputs.typeFondation].acier}kg/m³)`} val={`${results.acierKg.toFixed(0)} kg`} color="bg-blue-500" />
                  
                  <div className="pt-2 border-t border-gray-700 flex justify-between items-center">
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Droplets className="w-3 h-3 text-cyan-400" /> Eau de gâchée
                    </span>
                    <span className="text-sm font-bold text-white">{results.eauL.toFixed(0)} L</span>
                  </div>

                  <div className="flex items-start gap-2 p-3 bg-red-500/5 rounded-lg border border-red-500/20 mt-2">
                    <Info className="w-4 h-4 text-red-400 mt-0.5" />
                    <p className="text-[10px] text-red-200/60 leading-relaxed italic">
                      Ratio d'acier calculé pour une <strong>{TYPES_FONDATION[inputs.typeFondation].label}</strong> incluant {inputs.margePerte}% de recouvrement.
                    </p>
                  </div>
               </div>
            </div>

            {/* Historique Mini */}
            {historique.length > 0 && (
              <div className="bg-gray-800/30 rounded-2xl border border-gray-700/50 overflow-hidden">
                <div className="px-4 py-2 bg-gray-800/50 flex justify-between items-center">
                  <h4 className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2"><History className="w-3 h-3" /> Historique</h4>
                  <button onClick={() => {setHistorique([]); localStorage.removeItem(STORAGE_KEY)}} className="text-[10px] text-red-400 hover:underline">Vider</button>
                </div>
                <div className="max-h-[120px] overflow-y-auto">
                  {historique.slice(0, 5).map((item) => (
                    <div key={item.id} className="flex justify-between items-center p-3 border-b border-gray-700/30">
                      <div className="text-xs">
                        <span className="text-gray-500 text-[10px] block">{item.date}</span>
                        {item.type} - {item.volumeBrut}m³
                      </div>
                      <span className="text-sm font-bold text-red-500">{parseFloat(item.total).toLocaleString()} {currency}</span>
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

const InputGroup = ({ label, value, onChange, full = false }) => (
  <div className={`flex flex-col ${full ? "col-span-2" : ""}`}>
    <label className="mb-1 text-[10px] font-bold text-gray-500 uppercase">{label}</label>
    <input
      type="number"
      value={value}
      onChange={onChange}
      className="w-full bg-gray-900 border border-gray-600 rounded-xl px-4 py-2.5 text-white focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all font-mono text-sm"
      placeholder="0"
    />
  </div>
);

const ResultCard = ({ label, value, unit, color, bg, border, icon }) => (
  <div className={`rounded-2xl p-4 flex flex-col justify-center items-center text-center ${bg} ${border ? 'border border-gray-700' : ''}`}>
    <span className="text-[10px] text-gray-500 uppercase font-bold mb-1 flex items-center gap-1">
      {icon} {label}
    </span>
    <span className={`text-xl font-black ${color}`}>
      {value} <span className="text-xs font-normal text-gray-500">{unit}</span>
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