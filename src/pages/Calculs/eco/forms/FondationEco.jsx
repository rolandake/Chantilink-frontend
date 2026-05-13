import React, { useState, useEffect, useMemo } from "react";
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import {
  BrickWall, Ruler, Save, Trash2, History, Anchor, Droplets, Info, Banknote, Leaf
} from "lucide-react";

ChartJS.register(ArcElement, Tooltip, Legend);

const STORAGE_KEY = "fondation-eco-history";

// Ratios éco — légèrement réduits vs béton classique
const DOSAGE_ECO = {
  ciment:  300,  // kg/m³ (ciment bas carbone)
  sable:   0.60, // t/m³
  gravier: 0.80, // t/m³
  acier:   85,   // kg/m³
  eau:     170,  // L/m³
};

const TYPES_FONDATION = {
  FILANTE: { label: "Semelle Filante", acier: 45, icon: "📏" },
  ISOLEE:  { label: "Semelle Isolée",  acier: 70, icon: "🟦" },
  RADIER:  { label: "Radier Général",  acier: 90, icon: "🍱" },
};

export default function FondationEco({
  currency = "XOF",
  onTotalChange = () => {},
  onCostChange  = () => {},
  onMateriauxChange = () => {},
  onMaterialsChange = () => {},
}) {
  const [inputs, setInputs] = useState({
    typeFondation:  "FILANTE",
    longueur:       "",
    largeur:        "",
    profondeur:     "",
    margePerte:     "10",
    prixUnitaire:   "",
    coutMainOeuvre: "",
  });
  const [historique, setHistorique] = useState([]);
  const [message,    setMessage]    = useState(null);

  // ── CALCUL ──────────────────────────────────────────────────
  const results = useMemo(() => {
    const L     = parseFloat(inputs.longueur)   || 0;
    const l     = parseFloat(inputs.largeur)    || 0;
    const p     = parseFloat(inputs.profondeur) || 0;
    const marge = 1 + (parseFloat(inputs.margePerte) || 10) / 100;

    const volumeBrut     = L * l * p;
    const volumeCommande = volumeBrut * marge;

    const ratioAcier = TYPES_FONDATION[inputs.typeFondation].acier;

    const cimentKg   = volumeCommande * DOSAGE_ECO.ciment;
    const cimentT    = cimentKg / 1000;
    const cimentSacs = Math.ceil(cimentKg / 50);
    const sableT     = volumeCommande * DOSAGE_ECO.sable;
    const gravierT   = volumeCommande * DOSAGE_ECO.gravier;
    const acierKg    = volumeCommande * ratioAcier;
    const acierT     = acierKg / 1000;
    const eauL       = volumeCommande * DOSAGE_ECO.eau;

    const pu    = parseFloat(inputs.prixUnitaire)   || 0;
    const mo    = parseFloat(inputs.coutMainOeuvre) || 0;
    const total = volumeCommande * pu + mo;

    return { volumeBrut, volumeCommande, cimentT, cimentSacs, sableT, gravierT, acierKg, acierT, eauL, total };
  }, [inputs]);

  // ── SYNC PARENT ─────────────────────────────────────────────
  useEffect(() => {
    onTotalChange(results.total);
    onCostChange(results.total);
    const mats = { volume: results.volumeCommande, ciment: results.cimentT, acier: results.acierT };
    onMateriauxChange(mats);
    onMaterialsChange(mats);
  }, [results.total]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setHistorique(JSON.parse(saved));
    } catch {}
  }, []);

  const showToast = (msg, type = "success") => {
    setMessage({ text: msg, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleSave = () => {
    if (results.volumeBrut <= 0) return showToast("⚠️ Dimensions manquantes", "error");
    const entry = {
      id:     Date.now(),
      date:   new Date().toLocaleString("fr-FR"),
      type:   TYPES_FONDATION[inputs.typeFondation].label,
      volume: results.volumeCommande,
      total:  results.total,
    };
    const next = [entry, ...historique];
    setHistorique(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
    showToast("✅ Fondation Éco enregistrée !");
  };

  const chartData = {
    labels: ["Ciment", "Sable", "Gravier", "Acier"],
    datasets: [{
      data: [results.cimentT, results.sableT, results.gravierT, results.acierT],
      backgroundColor: ["#ef4444", "#fbbf24", "#78716c", "#3b82f6"],
      borderColor: "#111827",
      borderWidth: 2,
    }],
  };

  return (
    <div className="w-full h-full flex flex-col bg-gray-900 text-gray-100 overflow-hidden relative">

      {message && (
        <div className={`fixed top-4 right-4 px-6 py-3 rounded-xl shadow-2xl z-50 font-bold animate-bounce ${
          message.type === "error" ? "bg-red-600" : "bg-emerald-600"
        }`}>{message.text}</div>
      )}

      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-600/20 rounded-lg text-red-500">
            <BrickWall className="w-6 h-6"/>
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Fondation Écologique</h2>
            <p className="text-xs text-gray-400">Béton bas carbone — Ciment 300 kg/m³</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-gray-500 uppercase font-bold block">Total Estimé</span>
          <span className="text-2xl font-black text-red-400 tracking-tighter">
            {results.total.toLocaleString()} <span className="text-sm text-gray-500 font-normal">{currency}</span>
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* GAUCHE */}
          <div className="lg:col-span-5 flex flex-col gap-5">

            {/* Type fondation */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-4">
              <h3 className="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-3">Type d'élément</h3>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(TYPES_FONDATION).map(([key, type]) => (
                  <button key={key}
                    onClick={() => setInputs(p => ({...p, typeFondation: key}))}
                    className={`p-2 rounded-xl border text-[10px] font-bold transition-all flex flex-col items-center gap-1 ${
                      inputs.typeFondation === key
                        ? "border-red-500 bg-red-500/10 text-red-400"
                        : "border-gray-700 bg-gray-800 text-gray-500 hover:border-gray-500"
                    }`}>
                    <span className="text-lg">{type.icon}</span>
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Dimensions */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5">
              <h3 className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase mb-4">
                <Ruler className="w-3 h-3"/> Dimensions
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label="Longueur (m)"       value={inputs.longueur}    onChange={v => setInputs(p => ({...p, longueur: v}))}    />
                <InputGroup label="Largeur (m)"        value={inputs.largeur}     onChange={v => setInputs(p => ({...p, largeur: v}))}     />
                <InputGroup label="Épaisseur / Prof."  value={inputs.profondeur}  onChange={v => setInputs(p => ({...p, profondeur: v}))}  full />
                <InputGroup label="Pertes & Recouv. (%)" value={inputs.margePerte} onChange={v => setInputs(p => ({...p, margePerte: v}))} full />
              </div>
            </div>

            {/* Financier */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5">
              <h3 className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase mb-4">
                <Banknote className="w-3 h-3 text-green-400"/> Paramètres Financiers
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label={`Prix Unitaire (${currency}/m³)`} value={inputs.prixUnitaire}   onChange={v => setInputs(p => ({...p, prixUnitaire: v}))}   />
                <InputGroup label={`Main d'œuvre (${currency})`}     value={inputs.coutMainOeuvre} onChange={v => setInputs(p => ({...p, coutMainOeuvre: v}))} />
              </div>
              <button onClick={handleSave}
                className="w-full mt-4 bg-red-600 hover:bg-red-500 text-white py-3.5 rounded-xl font-bold shadow-lg transition-all flex justify-center items-center gap-2 active:scale-95">
                <Save className="w-5 h-5"/> Enregistrer
              </button>
            </div>
          </div>

          {/* DROITE */}
          <div className="lg:col-span-7 flex flex-col gap-6">

            <div className="grid grid-cols-3 gap-4">
              <ResultCard label="Volume commandé" value={results.volumeCommande.toFixed(2)} unit="m³"  icon="🧊"                            color="text-red-400"  bg="bg-red-500/10"  />
              <ResultCard label="Ciment éco"       value={results.cimentSacs.toFixed(0)}    unit="sacs" icon="🌿"                            color="text-gray-200" bg="bg-gray-500/10" border />
              <ResultCard label="Acier"            value={results.acierKg.toFixed(0)}        unit="kg"   icon={<Anchor className="w-4 h-4"/>} color="text-blue-400" bg="bg-blue-500/10" />
            </div>

            <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 shadow-xl flex flex-col md:flex-row gap-8 items-center">
              <div className="w-40 h-40 flex-shrink-0 relative">
                <Doughnut data={chartData} options={{ cutout: "75%", plugins: { legend: { display: false } } }}/>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[10px] text-gray-500 uppercase">Poids</span>
                  <span className="text-sm font-bold text-red-400">
                    {(results.cimentT + results.sableT + results.gravierT + results.acierT).toFixed(1)} T
                  </span>
                </div>
              </div>

              <div className="flex-1 w-full space-y-3">
                <h4 className="text-gray-400 text-xs font-bold uppercase tracking-widest border-b border-gray-700 pb-2">Fournitures Éco</h4>
                <MaterialRow label="Ciment bas carbone (300 kg/m³)" val={`${results.cimentT.toFixed(2)} t`}  color="bg-red-500"   />
                <MaterialRow label="Sable recyclé"                   val={`${results.sableT.toFixed(2)} t`}   color="bg-amber-500" />
                <MaterialRow label="Gravier recyclé"                 val={`${results.gravierT.toFixed(2)} t`} color="bg-stone-500" />
                <MaterialRow label={`Acier (${TYPES_FONDATION[inputs.typeFondation].acier} kg/m³)`} val={`${results.acierKg.toFixed(0)} kg`} color="bg-blue-500" />
                <div className="pt-2 border-t border-gray-700 flex justify-between items-center">
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Droplets className="w-3 h-3 text-cyan-400"/> Eau
                  </span>
                  <span className="text-sm font-bold text-white font-mono">{results.eauL.toFixed(0)} L</span>
                </div>
                <div className="flex items-start gap-2 p-2.5 bg-green-500/5 rounded-lg border border-green-500/20">
                  <Leaf className="w-3.5 h-3.5 text-green-400 mt-0.5 flex-shrink-0"/>
                  <p className="text-[10px] text-green-200/60 leading-relaxed italic">
                    Dosage réduit à 300 kg/m³ (−15% vs béton classique). Réduction significative de l'empreinte carbone.
                  </p>
                </div>
              </div>
            </div>

            {historique.length > 0 && (
              <div className="bg-gray-800/30 rounded-2xl border border-gray-700/50 overflow-hidden">
                <div className="px-4 py-2 bg-gray-800/50 border-b border-gray-700/50 flex justify-between items-center">
                  <h4 className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2"><History className="w-3 h-3"/> Historique</h4>
                  <button onClick={() => { setHistorique([]); localStorage.removeItem(STORAGE_KEY); }} className="text-[10px] text-red-400 hover:underline">Vider</button>
                </div>
                <div className="max-h-[120px] overflow-y-auto">
                  {historique.slice(0, 5).map(item => (
                    <div key={item.id} className="flex justify-between items-center p-3 border-b border-gray-700/30 hover:bg-gray-700/40 transition-colors">
                      <div className="text-xs">
                        <span className="text-gray-500 text-[9px] block">{item.date}</span>
                        <span className="font-medium">{item.type} — {item.volume.toFixed(2)} m³</span>
                      </div>
                      <span className="text-sm font-bold text-red-400">{item.total.toLocaleString()} {currency}</span>
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

const InputGroup = ({ label, value, onChange, full = false }) => (
  <div className={`flex flex-col ${full ? "col-span-2" : ""}`}>
    <label className="mb-1 text-[10px] font-bold text-gray-500 uppercase">{label}</label>
    <input type="number" value={value} onChange={e => onChange(e.target.value)}
      className="w-full bg-gray-900 border border-gray-600 rounded-xl px-4 py-2.5 text-white focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all font-mono text-sm outline-none"
      placeholder="0"/>
  </div>
);
const ResultCard = ({ label, value, unit, icon, color, bg, border }) => (
  <div className={`rounded-2xl p-4 flex flex-col justify-center items-center text-center ${bg} ${border ? "border border-gray-700" : ""}`}>
    <span className="text-[10px] text-gray-500 uppercase font-bold mb-1 flex items-center gap-1">{icon} {label}</span>
    <span className={`text-xl font-black ${color}`}>{value} <span className="text-xs font-normal text-gray-500">{unit}</span></span>
  </div>
);
const MaterialRow = ({ label, val, color }) => (
  <div className="flex justify-between items-center border-b border-gray-700/30 pb-2 last:border-0">
    <div className="flex items-center gap-2">
      <div className={`w-1.5 h-1.5 rounded-full ${color}`}/>
      <span className="text-gray-300 text-xs font-medium">{label}</span>
    </div>
    <span className="text-xs font-bold text-white font-mono">{val}</span>
  </div>
);