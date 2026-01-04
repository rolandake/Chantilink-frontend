import React, { useState, useEffect, useMemo } from "react";
import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { 
  Ruler, Banknote, Save, Trash2, History, Anchor, Droplets, Link, Layers, Info 
} from "lucide-react";

ChartJS.register(ArcElement, Tooltip, Legend);

const STORAGE_KEY = "longrines-history-pro";

// Configuration Technique
const DOSAGE_BETON = {
  ciment: 0.350, // 350kg/m3 (Dosage structurel standard)
  sable: 0.6,    // T/m3
  gravier: 0.85, // T/m3
  eau: 175       // L/m3
};

const TYPES_LONGRINES = [
  { id: "filante", label: "Filante", acierCoef: 80, desc: "Chaînage bas standard" },
  { id: "liaison", label: "Liaison", acierCoef: 100, desc: "Anti-sismique / Liaison massifs" },
  { id: "redressement", label: "Redressement", acierCoef: 120, desc: "Poutre d'équilibre" },
  { id: "prefab", label: "Préfabriquée", acierCoef: 60, desc: "Longrine industrielle" },
];

export default function Longrines({ currency = "XOF", onTotalChange, onMateriauxChange }) {
  
  // --- ÉTATS ---
  const [typeLongrine, setTypeLongrine] = useState("filante");
  const [inputs, setInputs] = useState({
    longueur: "",
    largeur: "",
    hauteur: "",
    prixUnitaire: "",   
    coutMainOeuvre: "",
    marge: "10" // 10% de marge par défaut pour irrégularité fouille
  });

  const [historique, setHistorique] = useState([]);
  const [message, setMessage] = useState(null);

  // --- MOTEUR DE CALCUL ---
  const results = useMemo(() => {
    const L = parseFloat(inputs.longueur) || 0;
    const l = parseFloat(inputs.largeur) || 0;
    const h = parseFloat(inputs.hauteur) || 0;
    const margeCoef = 1 + (parseFloat(inputs.marge) || 0) / 100;

    const volumeTheorique = L * l * h;
    const volumeCommande = volumeTheorique * margeCoef;

    // Coffrage (2 faces latérales uniquement)
    const surfaceCoffrage = (2 * h) * L;

    // Acier
    const acierRatio = TYPES_LONGRINES.find(t => t.id === typeLongrine)?.acierCoef || 80;
    const acierKg = volumeTheorique * acierRatio;
    const acierT = acierKg / 1000;

    // Matériaux
    const cimentT = volumeCommande * DOSAGE_BETON.ciment;
    const cimentSacs = (cimentT * 1000) / 50;
    const sableT = volumeCommande * DOSAGE_BETON.sable;
    const gravierT = volumeCommande * DOSAGE_BETON.gravier;
    const eauL = volumeCommande * DOSAGE_BETON.eau;

    // Coûts
    const pu = parseFloat(inputs.prixUnitaire) || 0;
    const mo = parseFloat(inputs.coutMainOeuvre) || 0;
    const total = (volumeCommande * pu) + mo;

    return {
      volumeTheorique,
      volumeCommande,
      surfaceCoffrage,
      cimentT, cimentSacs,
      sableT, gravierT, acierT, acierKg, eauL,
      total, acierRatio
    };
  }, [inputs, typeLongrine]);

  // --- SYNC PARENT ---
  useEffect(() => {
    if (onTotalChange) onTotalChange(results.total);
    if (onMateriauxChange) {
      onMateriauxChange({
        volume: results.volumeCommande,
        ciment: results.cimentT,
        acier: results.acierT
      });
    }
  }, [results.total, results.volumeCommande, results.cimentT, results.acierT, onTotalChange, onMateriauxChange]);

  // --- HISTORIQUE ---
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try { setHistorique(JSON.parse(saved)); } catch {}
    }
  }, []);

  const handleSave = () => {
    if (results.volumeTheorique <= 0) return showToast("⚠️ Dimensions invalides", "error");
    
    const newEntry = {
      id: Date.now(),
      date: new Date().toLocaleString(),
      typeLabel: TYPES_LONGRINES.find(t => t.id === typeLongrine).label,
      ...inputs,
      ...results
    };

    const newHist = [newEntry, ...historique];
    setHistorique(newHist);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newHist));
    showToast("✅ Longrines sauvegardées !");
  };

  const showToast = (msg, type = "success") => {
    setMessage({ text: msg, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const chartData = {
    labels: ["Béton", "Acier"],
    datasets: [{
      data: [results.total - results.mo, (results.acierKg * 500) / 100], // Estimation visuelle
      backgroundColor: ["#10b981", "#ef4444"],
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
          <div className="p-2 bg-emerald-600/20 rounded-lg text-emerald-500">
            <Link className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Élévation : Longrines</h2>
            <p className="text-xs text-gray-400 font-medium tracking-tight">Liaison de fondation & Redressement</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-gray-500 uppercase font-bold block">Estimation Partielle</span>
          <span className="text-2xl font-black text-emerald-400 tracking-tighter">
            {results.total.toLocaleString()} <span className="text-sm text-gray-500 font-normal">{currency}</span>
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-6 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
          
          {/* GAUCHE : INPUTS */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            
            <div className="bg-gray-800 p-2 rounded-2xl border border-gray-700">
              <div className="grid grid-cols-2 gap-2">
                {TYPES_LONGRINES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTypeLongrine(t.id)}
                    className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all ${
                      typeLongrine === t.id 
                        ? "bg-emerald-600 text-white shadow-lg" 
                        : "text-gray-400 hover:text-white hover:bg-gray-700"
                    }`}
                  >
                    <span className="text-xs font-bold">{t.label}</span>
                    <span className="text-[9px] opacity-70 tracking-tighter uppercase">{t.acierCoef}kg/m³</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5 shadow-lg space-y-4">
              <h3 className="flex items-center gap-2 text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
                <Ruler className="w-3 h-3" /> Dimensions Fouille (m)
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label="Longueur Totale" value={inputs.longueur} onChange={v => setInputs({...inputs, longueur: v})} full />
                <InputGroup label="Largeur" value={inputs.largeur} onChange={v => setInputs({...inputs, largeur: v})} placeholder="0.20" />
                <InputGroup label="Hauteur" value={inputs.hauteur} onChange={v => setInputs({...inputs, hauteur: v})} placeholder="0.40" />
              </div>
            </div>

            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5 shadow-lg space-y-4 flex-1">
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label={`PU Béton (${currency}/m³)`} value={inputs.prixUnitaire} onChange={v => setInputs({...inputs, prixUnitaire: v})} />
                <InputGroup label="Marge de perte (%)" value={inputs.marge} onChange={v => setInputs({...inputs, marge: v})} />
              </div>
              <button onClick={handleSave} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-xl font-bold shadow-lg transition-all flex justify-center items-center gap-2 mt-4">
                <Save className="w-5 h-5" /> Enregistrer Longrines
              </button>
            </div>
          </div>

          {/* DROITE : RÉSULTATS */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            
            <div className="grid grid-cols-3 gap-4">
              <ResultCard label="Volume Brut" value={results.volumeCommande.toFixed(2)} unit="m³" icon="🧊" color="text-emerald-400" bg="bg-emerald-500/10" />
              <ResultCard label="Sacs Ciment" value={results.cimentSacs.toFixed(1)} unit="u" icon="🧱" color="text-white" bg="bg-gray-800" border />
              <ResultCard label="Acier HA" value={results.acierKg.toFixed(0)} unit="kg" icon={<Anchor className="w-4 h-4"/>} color="text-red-400" bg="bg-red-500/10" />
            </div>

            <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 shadow-xl flex flex-col md:flex-row gap-8 items-center relative">
               <div className="w-44 h-44 flex-shrink-0 relative">
                  <Doughnut data={chartData} options={{ cutout: "75%", plugins: { legend: { display: false } } }} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                     <span className="text-[10px] text-gray-500 uppercase font-bold">Coffrage</span>
                     <span className="text-sm font-bold text-white">{results.surfaceCoffrage.toFixed(1)} m²</span>
                  </div>
               </div>

               <div className="flex-1 w-full space-y-3">
                  <h4 className="text-gray-400 text-xs font-bold uppercase tracking-widest border-b border-gray-700 pb-2 mb-2">Analyse Technique</h4>
                  <MaterialRow label="Ciment (350kg/m³)" val={`${results.cimentT.toFixed(2)} t`} color="bg-emerald-500" />
                  <MaterialRow label="Sable (Ratio 0.6)" val={`${results.sableT.toFixed(2)} t`} color="bg-amber-500" />
                  <MaterialRow label="Gravier (Ratio 0.85)" val={`${results.gravierT.toFixed(2)} t`} color="bg-stone-500" />
                  <MaterialRow label={`Acier (${results.acierRatio}kg/m³)`} val={`${results.acierKg.toFixed(0)} kg`} color="bg-red-500" />
                  
                  <div className="pt-2 border-t border-gray-700 flex justify-between items-center mt-2">
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Droplets className="w-3 h-3 text-cyan-400" /> Eau nécessaire
                    </span>
                    <span className="text-sm font-bold text-white font-mono">{results.eauL.toFixed(0)} L</span>
                  </div>

                  <div className="flex items-start gap-2 p-3 bg-emerald-500/5 rounded-lg border border-emerald-500/20">
                    <Info className="w-4 h-4 text-emerald-400 mt-0.5" />
                    <p className="text-[10px] text-emerald-200/70 leading-relaxed italic">
                      Les longrines de <strong>redressement</strong> nécessitent un ratio d'acier élevé pour compenser l'excentrement des charges.
                    </p>
                  </div>
               </div>
            </div>

            {/* Historique Mini */}
            {historique.length > 0 && (
              <div className="bg-gray-800/30 rounded-2xl border border-gray-700/50 overflow-hidden">
                <div className="px-4 py-2 bg-gray-800/50 border-b border-gray-700/50 flex justify-between items-center">
                  <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                    <History className="w-3 h-3" /> Historique de liaison
                  </h4>
                </div>
                <div className="max-h-[100px] overflow-y-auto">
                  {historique.slice(0, 5).map((item) => (
                    <div key={item.id} className="flex justify-between items-center p-3 border-b border-gray-700/30">
                      <div className="text-xs">
                        <span className="text-gray-500 text-[9px] block">{item.date}</span>
                        <span className="font-medium">{item.typeLabel} - {item.volumeTheorique.toFixed(1)} m³</span>
                      </div>
                      <span className="text-sm font-bold text-emerald-400">{parseFloat(item.total).toLocaleString()} {currency}</span>
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
      className="w-full bg-gray-900 border border-gray-600 rounded-xl px-4 py-2.5 text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-mono text-sm"
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