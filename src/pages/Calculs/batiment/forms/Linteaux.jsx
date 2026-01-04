import React, { useState, useEffect, useMemo } from "react";
import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { 
  BetweenHorizontalEnd, Ruler, Banknote, Save, Trash2, History, Anchor, Droplets, Component, Layers, Info, Target 
} from "lucide-react";

ChartJS.register(ArcElement, Tooltip, Legend);

const STORAGE_KEY = "linteaux-history-pro";

// Configuration Technique
const DOSAGE = {
  ciment: 0.350, // 350kg/m3
  sable: 0.6,    // T/m3
  gravier: 0.85, // T/m3
  acier: 0.080,  // 80kg/m3 (Standard linteau)
  eau: 175       // L/m3
};

const TYPES_LINTEAUX = [
  { id: "coule", label: "Coulé en place", icon: <Component className="w-4 h-4"/>, desc: "Coffrage bois traditionnel" },
  { id: "prefa", label: "Préfabriqué (Bloc U)", icon: <BetweenHorizontalEnd className="w-4 h-4"/>, desc: "Le bloc sert de coffrage" },
];

export default function Linteaux({ currency = "XOF", onTotalChange, onMateriauxChange }) {
  
  // --- ÉTATS ---
  const [typeLinteau, setTypeLinteau] = useState("coule");
  const [inputs, setInputs] = useState({
    nombre: "1",
    longueur: "", // Longueur totale (ouverture + appuis)
    largeur: "",
    hauteur: "",
    prixUnitaire: "",
    coutMainOeuvre: ""
  });

  const [historique, setHistorique] = useState([]);
  const [message, setMessage] = useState(null);

  // --- MOTEUR DE CALCUL ---
  const results = useMemo(() => {
    const nb = parseFloat(inputs.nombre) || 0;
    const L = parseFloat(inputs.longueur) || 0;
    const l = parseFloat(inputs.largeur) || 0;
    const h = parseFloat(inputs.hauteur) || 0;
    const pu = parseFloat(inputs.prixUnitaire) || 0;
    const mo = parseFloat(inputs.coutMainOeuvre) || 0;

    const volumeUnitaire = L * l * h;
    const volumeTotal = volumeUnitaire * nb;

    // Coffrage (uniquement si coulé en place) : Fond + 2 Joues
    // Formule : (Largeur + 2 x Hauteur) x Longueur x Nombre
    const surfaceCoffrage = typeLinteau === "coule" ? (l + (2 * h)) * L * nb : 0;

    // Matériaux
    const cimentT = volumeTotal * DOSAGE.ciment;
    const cimentSacs = (cimentT * 1000) / 50;
    const sableT = volumeTotal * DOSAGE.sable;
    const gravierT = volumeTotal * DOSAGE.gravier;
    const acierKg = volumeTotal * (DOSAGE.acier * 1000);
    const acierT = acierKg / 1000;
    const eauL = volumeTotal * DOSAGE.eau;

    // Coûts
    const coutMateriaux = volumeTotal * pu;
    const total = coutMateriaux + mo;

    return {
      volumeTotal,
      surfaceCoffrage,
      cimentT, cimentSacs,
      sableT, gravierT, acierT, acierKg, eauL,
      coutMateriaux, mo, total
    };
  }, [inputs, typeLinteau]);

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
  }, [results.total, results.volumeTotal, results.cimentT, results.acierT, onTotalChange, onMateriauxChange]);

  // --- HISTORIQUE ---
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try { setHistorique(JSON.parse(saved)); } catch {}
    }
  }, []);

  const handleSave = () => {
    if (results.volumeTotal <= 0) return showToast("⚠️ Dimensions manquantes", "error");
    
    const newEntry = {
      id: Date.now(),
      date: new Date().toLocaleString(),
      type: TYPES_LINTEAUX.find(t => t.id === typeLinteau).label,
      inputs: { ...inputs },
      results: { ...results }
    };

    const newHist = [newEntry, ...historique];
    setHistorique(newHist);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newHist));
    showToast("✅ Linteaux enregistrés !");
  };

  const showToast = (msg, type = "success") => {
    setMessage({ text: msg, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const chartData = {
    labels: ["Béton", "Main d'œuvre"],
    datasets: [{
      data: [results.coutMateriaux, results.mo],
      backgroundColor: ["#06b6d4", "#0891b2"],
      borderColor: "#111827",
      borderWidth: 2,
    }]
  };

  return (
    <div className="w-full h-full flex flex-col bg-gray-900 text-gray-100 overflow-hidden relative">
      
      {/* Toast */}
      {message && (
        <div className={`fixed top-4 right-4 px-6 py-3 rounded-xl shadow-2xl z-50 font-bold animate-in fade-in slide-in-from-top-2 ${
          message.type === "error" ? "bg-red-600" : "bg-cyan-600"
        }`}>
          {message.text}
        </div>
      )}

      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cyan-600/20 rounded-lg text-cyan-500">
            <BetweenHorizontalEnd className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Élévation : Linteaux</h2>
            <p className="text-xs text-gray-400">Renforts de baies et ouvertures</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-gray-500 uppercase font-bold block">Estimation Linteaux</span>
          <span className="text-2xl font-black text-cyan-400 tracking-tighter">
            {results.total.toLocaleString()} <span className="text-sm text-gray-500 font-normal">{currency}</span>
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-6 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
          
          {/* GAUCHE : INPUTS */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            
            <div className="grid grid-cols-2 gap-2 bg-gray-800 p-1.5 rounded-xl border border-gray-700">
              {TYPES_LINTEAUX.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTypeLinteau(t.id)}
                  className={`flex flex-col items-center justify-center py-2 rounded-lg transition-all ${
                    typeLinteau === t.id 
                      ? "bg-cyan-600 text-white shadow-lg" 
                      : "text-gray-400 hover:text-white hover:bg-gray-700"
                  }`}
                >
                  <span className="text-xs font-bold">{t.label}</span>
                  <span className="text-[9px] opacity-60 tracking-tighter">{t.desc}</span>
                </button>
              ))}
            </div>

            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5 shadow-lg space-y-4">
              <h3 className="flex items-center gap-2 text-[10px] font-bold text-cyan-400 uppercase tracking-widest">
                <Ruler className="w-3 h-3" /> Dimensions Totales (m)
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <InputGroup label="Nb Linteaux" value={inputs.nombre} onChange={v => setInputs({...inputs, nombre: v})} />
                <InputGroup label="Long. Totale" value={inputs.longueur} onChange={v => setInputs({...inputs, longueur: v})} placeholder="Portée + Appuis" />
                <InputGroup label="Largeur" value={inputs.largeur} onChange={v => setInputs({...inputs, largeur: v})} placeholder="Ex: 0.15" />
                <InputGroup label="Hauteur" value={inputs.hauteur} onChange={v => setInputs({...inputs, hauteur: v})} placeholder="Ex: 0.20" />
              </div>

              <div className="flex items-start gap-2 p-3 bg-amber-500/5 rounded-lg border border-amber-500/20">
                <Info className="w-4 h-4 text-amber-500 mt-0.5" />
                <p className="text-[10px] text-amber-200/70 italic">
                  <strong>Vérité Terrain :</strong> Prévoyez toujours un appui de 20cm minimum de chaque côté du mur pour la stabilité.
                </p>
              </div>
            </div>

            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5 shadow-lg flex-1">
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label={`PU Béton (${currency}/m³)`} value={inputs.prixUnitaire} onChange={v => setInputs({...inputs, prixUnitaire: v})} />
                <InputGroup label={`Main d'œuvre (${currency})`} value={inputs.coutMainOeuvre} onChange={v => setInputs({...inputs, coutMainOeuvre: v})} />
              </div>
              <button onClick={handleSave} className="w-full mt-6 bg-cyan-600 hover:bg-cyan-500 text-white py-4 rounded-xl font-bold shadow-lg transition-all flex justify-center items-center gap-2">
                <Save className="w-5 h-5" /> Enregistrer Linteaux
              </button>
            </div>
          </div>

          {/* DROITE : RÉSULTATS */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            
            <div className="grid grid-cols-3 gap-4">
              <ResultCard label="Volume Total" value={results.volumeTotal.toFixed(3)} unit="m³" icon="🧊" color="text-cyan-400" bg="bg-cyan-500/10" />
              <ResultCard label="Coffrage" value={results.surfaceCoffrage.toFixed(1)} unit="m²" icon={<Layers className="w-4 h-4"/>} color="text-indigo-400" bg="bg-indigo-500/10" border />
              <ResultCard label="Acier HA" value={results.acierKg.toFixed(0)} unit="kg" icon={<Target className="w-4 h-4"/>} color="text-red-400" bg="bg-red-500/10" />
            </div>

            <div className="flex-1 bg-gray-800 rounded-2xl p-6 border border-gray-700 shadow-xl flex flex-col md:flex-row gap-8 items-center relative overflow-hidden">
               <div className="w-40 h-40 flex-shrink-0 relative">
                  <Doughnut data={chartData} options={{ cutout: "75%", plugins: { legend: { display: false } } }} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                     <span className="text-[10px] text-gray-500 uppercase font-bold">Ciment</span>
                     <span className="text-sm font-bold text-white">{results.cimentSacs.toFixed(1)} sacs</span>
                  </div>
               </div>

               <div className="flex-1 w-full space-y-3">
                  <h4 className="text-gray-400 text-xs font-bold uppercase tracking-widest border-b border-gray-700 pb-2 mb-2">Fournitures (Dosage 350kg)</h4>
                  <MaterialRow label="Ciment" val={`${results.cimentT.toFixed(2)} t`} color="bg-cyan-500" />
                  <MaterialRow label="Sable (0.6 t/m³)" val={`${results.sableT.toFixed(2)} t`} color="bg-amber-500" />
                  <MaterialRow label="Gravier (0.85 t/m³)" val={`${results.gravierT.toFixed(2)} t`} color="bg-stone-500" />
                  <MaterialRow label="Acier (80kg/m³)" val={`${results.acierKg.toFixed(0)} kg`} color="bg-red-500" />
                  
                  <div className="pt-2 border-t border-gray-700 flex justify-between items-center mt-2">
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Droplets className="w-3 h-3 text-cyan-400" /> Eau nécessaire
                    </span>
                    <span className="text-sm font-bold text-white font-mono">{results.eauL.toFixed(0)} L</span>
                  </div>
               </div>
            </div>

            {/* Historique Mini */}
            {historique.length > 0 && (
              <div className="bg-gray-800/30 rounded-2xl border border-gray-700/50 overflow-hidden">
                <div className="px-4 py-2 bg-gray-800/50 border-b border-gray-700/50 flex justify-between items-center">
                  <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2"><History className="w-3 h-3" /> Derniers Linteaux</h4>
                  <button onClick={() => {setHistorique([]); localStorage.removeItem(STORAGE_KEY)}} className="text-[10px] text-red-400 hover:underline">Vider</button>
                </div>
                <div className="max-h-[100px] overflow-y-auto">
                  {historique.slice(0, 5).map((item) => (
                    <div key={item.id} className="flex justify-between items-center p-3 border-b border-gray-700/30">
                      <div className="text-xs">
                        <span className="text-gray-500 text-[9px] block">{item.date}</span>
                        {item.inputs.nombre}x Linteau ({item.type})
                      </div>
                      <span className="text-sm font-bold text-cyan-400">{parseFloat(item.results.total).toLocaleString()} {currency}</span>
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
    <label className="mb-1 text-[10px] font-bold text-gray-500 uppercase">{label}</label>
    <input
      type="number"
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full bg-gray-900 border border-gray-600 rounded-xl px-4 py-2.5 text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all font-mono text-sm"
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