import React, { useState, useEffect, useMemo } from "react";
import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import {
  Columns, Ruler, Save, History, Anchor, Circle, Square,
  Type, ScanLine, Layers, Droplets, Info, Minus, Plus
} from "lucide-react";

ChartJS.register(ArcElement, Tooltip, Legend);

const STORAGE_KEY = "poteaux-batiment-history";

const DOSAGE = {
  ciment: 0.350,
  sable: 0.6,
  gravier: 0.85,
  acier: 0.120,
  eau: 175,
};

const TYPES_POTEAUX = [
  { id: "rectangulaire", label: "Rectangulaire", icon: <Square  className="w-5 h-5" /> },
  { id: "circulaire",    label: "Circulaire",    icon: <Circle  className="w-5 h-5" /> },
  { id: "t_shape",       label: "Forme en T",    icon: <Type    className="w-5 h-5" /> },
  { id: "autre",         label: "Section Perso", icon: <ScanLine className="w-5 h-5" /> },
];

export default function Poteaux({ currency = "XOF", onTotalChange, onMateriauxChange }) {

  const [typePoteau,  setTypePoteau]  = useState("rectangulaire");
  const [inputs,      setInputs]      = useState({
    nombre: "1",
    longueur: "",
    largeur: "",
    epaisseur: "",
    diametre: "",
    section: "",
    prixUnitaire: "",
    coutMainOeuvre: "",
  });
  const [historique,  setHistorique]  = useState([]);
  const [message,     setMessage]     = useState(null);

  // ── CALCUL ─────────────────────────────────────────────────────
  const results = useMemo(() => {
    const nb = parseFloat(inputs.nombre) || 0;
    const h  = parseFloat(inputs.longueur) || 0;
    const pu = parseFloat(inputs.prixUnitaire) || 0;
    const mo = parseFloat(inputs.coutMainOeuvre) || 0;

    let aireSection = 0, perimetre = 0;

    if (typePoteau === "rectangulaire") {
      const a = parseFloat(inputs.largeur) || 0;
      const b = parseFloat(inputs.epaisseur) || 0;
      aireSection = a * b;
      perimetre = (a + b) * 2;
    } else if (typePoteau === "circulaire") {
      const d = parseFloat(inputs.diametre) || 0;
      aireSection = Math.PI * Math.pow(d / 2, 2);
      perimetre = Math.PI * d;
    } else if (typePoteau === "t_shape") {
      const L  = parseFloat(inputs.largeur) || 0;
      const ep = parseFloat(inputs.epaisseur) || 0;
      aireSection = (L * ep) + ((L - ep) * ep);
      perimetre = L * 4;
    } else {
      aireSection = parseFloat(inputs.section) || 0;
      perimetre = Math.sqrt(aireSection) * 4;
    }

    const volumeTotal    = aireSection * h * nb;
    const surfaceCoffrage = perimetre * h * nb;

    const cimentT    = volumeTotal * DOSAGE.ciment;
    const cimentSacs = (cimentT * 1000) / 50;
    const sableT     = volumeTotal * DOSAGE.sable;
    const gravierT   = volumeTotal * DOSAGE.gravier;
    const acierKg    = volumeTotal * (DOSAGE.acier * 1000);
    const acierT     = acierKg / 1000;
    const eauL       = volumeTotal * DOSAGE.eau;

    const coutMateriaux = volumeTotal * pu;
    const total = coutMateriaux + mo;

    return {
      aireSection, volumeTotal, surfaceCoffrage,
      cimentT, cimentSacs, sableT, gravierT,
      acierT, acierKg, eauL,
      coutMateriaux, mo, total,
    };
  }, [inputs, typePoteau]);

  // ── SYNC PARENT ────────────────────────────────────────────────
  useEffect(() => {
    onTotalChange?.(results.total);
    onMateriauxChange?.({
      volume: results.volumeTotal,
      ciment: results.cimentT,
      acier:  results.acierT,
    });
  }, [results.total, results.volumeTotal, results.cimentT, results.acierT, onTotalChange, onMateriauxChange]);

  // ── HISTORIQUE ─────────────────────────────────────────────────
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setHistorique(JSON.parse(saved));
    } catch {}
  }, []);

  const handleSave = () => {
    if (results.volumeTotal <= 0) return showToast("⚠️ Dimensions manquantes", "error");
    const entry = { id: Date.now(), date: new Date().toLocaleString(), type: typePoteau, inputs: { ...inputs }, results: { ...results } };
    const next = [entry, ...historique];
    setHistorique(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    showToast("✅ Poteaux sauvegardés !");
  };

  const clearHistory = () => {
    if (window.confirm("Vider l'historique ?")) {
      setHistorique([]);
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const handleChange = (field) => (e) =>
    setInputs((p) => ({ ...p, [field]: e.target.value }));

  // Stepper pour le nombre de poteaux
  const stepNombre = (delta) => {
    setInputs((p) => {
      const cur = Math.max(1, (parseInt(p.nombre) || 1) + delta);
      return { ...p, nombre: String(cur) };
    });
  };

  const showToast = (msg, type = "success") => {
    setMessage({ text: msg, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const chartData = {
    labels: ["Matériaux", "Main d'œuvre"],
    datasets: [{
      data: [results.coutMateriaux, results.mo],
      backgroundColor: ["#3b82f6", "#6366f1"],
      borderColor: "#111827",
      borderWidth: 2,
    }],
  };

  const nb = parseInt(inputs.nombre) || 1;

  return (
    <div className="flex flex-col h-full bg-gray-900 text-gray-100 overflow-hidden relative">

      {/* Toast */}
      {message && (
        <div className={`fixed top-4 right-4 px-6 py-3 rounded-xl shadow-2xl z-50 font-bold animate-bounce ${
          message.type === "error" ? "bg-red-600" : "bg-blue-600"
        }`}>
          {message.text}
        </div>
      )}

      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-gray-800 flex justify-between items-center bg-gray-900/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600/20 rounded-lg text-blue-500">
            <Columns className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Élévation : Poteaux</h2>
            <p className="text-[10px] text-gray-400 italic">Calcul structurel haute précision</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[9px] text-gray-500 uppercase font-bold block">Estimation</span>
          <span className="text-xl font-black text-blue-400 tracking-tighter">
            {results.total.toLocaleString()} <span className="text-xs text-gray-500 font-normal">{currency}</span>
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

          {/* ── GAUCHE : INPUTS ── */}
          <div className="lg:col-span-5 flex flex-col gap-4">

            {/* ✅ NOMBRE DE POTEAUX — Bloc dédié, bien visible */}
            <div
              className="rounded-2xl p-4 border"
              style={{
                background: "linear-gradient(135deg, rgba(59,130,246,0.12) 0%, rgba(99,102,241,0.08) 100%)",
                borderColor: "rgba(59,130,246,0.35)",
              }}
            >
              <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                <Columns className="w-3.5 h-3.5" />
                Nombre de poteaux
              </p>

              <div className="flex items-center gap-4">
                {/* Bouton − */}
                <button
                  onClick={() => stepNombre(-1)}
                  disabled={nb <= 1}
                  className="w-11 h-11 rounded-xl flex items-center justify-center font-bold text-lg transition-all active:scale-95 disabled:opacity-30"
                  style={{
                    background: "rgba(59,130,246,0.15)",
                    border: "0.5px solid rgba(59,130,246,0.4)",
                    color: "#93c5fd",
                  }}
                >
                  <Minus className="w-4 h-4" />
                </button>

                {/* Input central */}
                <div className="flex-1 relative">
                  <input
                    type="number"
                    min="1"
                    value={inputs.nombre}
                    onChange={handleChange("nombre")}
                    className="w-full rounded-xl text-center font-black text-3xl py-3 focus:outline-none transition-all"
                    style={{
                      background: "rgba(17,24,39,0.8)",
                      border: "1.5px solid rgba(59,130,246,0.5)",
                      color: "#fff",
                      caretColor: "#3b82f6",
                      /* Chrome — masquer les flèches natifs */
                      MozAppearance: "textfield",
                    }}
                  />
                  {/* Label sous l'input */}
                  <span
                    className="absolute -bottom-5 left-0 right-0 text-center text-[10px] font-semibold"
                    style={{ color: "rgba(147,197,253,0.7)" }}
                  >
                    {nb <= 1 ? "poteau" : "poteaux"}
                  </span>
                </div>

                {/* Bouton + */}
                <button
                  onClick={() => stepNombre(+1)}
                  className="w-11 h-11 rounded-xl flex items-center justify-center font-bold text-lg transition-all active:scale-95"
                  style={{
                    background: "rgba(59,130,246,0.25)",
                    border: "0.5px solid rgba(59,130,246,0.5)",
                    color: "#93c5fd",
                    boxShadow: "0 0 12px rgba(59,130,246,0.2)",
                  }}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* Raccourcis rapides */}
              <div className="flex gap-2 mt-6">
                {[1, 4, 8, 12, 20].map((v) => (
                  <button
                    key={v}
                    onClick={() => setInputs((p) => ({ ...p, nombre: String(v) }))}
                    className="flex-1 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95"
                    style={{
                      background: nb === v ? "rgba(59,130,246,0.35)" : "rgba(55,65,81,0.6)",
                      border: nb === v ? "0.5px solid rgba(59,130,246,0.7)" : "0.5px solid rgba(75,85,99,0.5)",
                      color: nb === v ? "#93c5fd" : "#9ca3af",
                    }}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {/* Type Selector */}
            <div className="bg-gray-800 p-2 rounded-2xl border border-gray-700">
              <div className="grid grid-cols-4 gap-1.5">
                {TYPES_POTEAUX.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTypePoteau(t.id)}
                    className={`flex flex-col items-center justify-center py-2.5 rounded-xl transition-all ${
                      typePoteau === t.id
                        ? "bg-blue-600 text-white shadow-lg"
                        : "text-gray-400 hover:text-white hover:bg-gray-700"
                    }`}
                  >
                    {t.icon}
                    <span className="text-[8px] mt-1 font-bold uppercase tracking-tighter leading-tight text-center">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Dimensions + coûts */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5 flex flex-col gap-4">
              <h3 className="flex items-center gap-2 text-[10px] font-bold text-blue-400 uppercase tracking-widest">
                <Ruler className="w-3.5 h-3.5" /> Dimensions & Coûts
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <InputGroup label="Hauteur (m)" value={inputs.longueur}  onChange={handleChange("longueur")}  placeholder="3.00" />

                {typePoteau === "rectangulaire" && (
                  <>
                    <InputGroup label="Côté A (m)" value={inputs.largeur}   onChange={handleChange("largeur")}   placeholder="0.20" />
                    <InputGroup label="Côté B (m)" value={inputs.epaisseur} onChange={handleChange("epaisseur")} placeholder="0.20" />
                  </>
                )}
                {typePoteau === "circulaire" && (
                  <InputGroup label="Diamètre (m)" value={inputs.diametre} onChange={handleChange("diametre")} placeholder="0.30" full />
                )}
                {typePoteau === "t_shape" && (
                  <>
                    <InputGroup label="Largeur Totale (m)" value={inputs.largeur}   onChange={handleChange("largeur")}   placeholder="0.40" />
                    <InputGroup label="Épaisseur (m)"      value={inputs.epaisseur} onChange={handleChange("epaisseur")} placeholder="0.15" />
                  </>
                )}
                {typePoteau === "autre" && (
                  <InputGroup label="Aire Section (m²)" value={inputs.section} onChange={handleChange("section")} placeholder="0.09" full />
                )}
              </div>

              <div className="pt-3 border-t border-gray-700 grid grid-cols-2 gap-3">
                <InputGroup label={`PU Béton (${currency}/m³)`}  value={inputs.prixUnitaire}    onChange={handleChange("prixUnitaire")}    />
                <InputGroup label={`Main d'œuvre (${currency})`} value={inputs.coutMainOeuvre} onChange={handleChange("coutMainOeuvre")} />
              </div>

              <button
                onClick={handleSave}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3.5 rounded-xl font-bold shadow-lg transition-all flex justify-center items-center gap-2"
              >
                <Save className="w-4 h-4" /> Enregistrer le calcul
              </button>
            </div>
          </div>

          {/* ── DROITE : RÉSULTATS ── */}
          <div className="lg:col-span-7 flex flex-col gap-5">

            <div className="grid grid-cols-3 gap-3">
              <ResultCard label="Volume Total"  value={results.volumeTotal.toFixed(2)}    unit="m³" icon="🧊"                           color="text-blue-400"   bg="bg-blue-500/10"   />
              <ResultCard label="Coffrage"       value={results.surfaceCoffrage.toFixed(1)} unit="m²" icon={<Layers  className="w-4 h-4"/>} color="text-indigo-400" bg="bg-indigo-500/10" border />
              <ResultCard label="Acier HA"       value={results.acierKg.toFixed(0)}         unit="kg" icon={<Anchor  className="w-4 h-4"/>} color="text-red-400"    bg="bg-red-500/10"    />
            </div>

            <div className="bg-gray-800 rounded-2xl p-5 border border-gray-700 shadow-xl flex flex-col md:flex-row gap-6 items-center">
              <div className="relative flex-shrink-0" style={{ width: 160, height: 160 }}>
                <Doughnut data={chartData} options={{ cutout: "75%", plugins: { legend: { display: false } } }} />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[9px] text-gray-500 uppercase font-bold">Ciment</span>
                  <span className="text-sm font-bold text-white">{results.cimentSacs.toFixed(1)} sacs</span>
                </div>
              </div>

              <div className="flex-1 w-full space-y-3">
                <h4 className="text-gray-400 text-[10px] font-bold uppercase tracking-widest border-b border-gray-700 pb-2">
                  Détail des Matériaux
                </h4>
                <MaterialRow label="Ciment (350kg/m³)"    val={`${results.cimentT.toFixed(2)} t`}  color="bg-blue-500"  />
                <MaterialRow label="Sable (Ratio 0.6)"    val={`${results.sableT.toFixed(2)} t`}   color="bg-amber-500" />
                <MaterialRow label="Gravier (Ratio 0.85)" val={`${results.gravierT.toFixed(2)} t`} color="bg-stone-500" />
                <MaterialRow label="Acier (120kg/m³)"     val={`${results.acierKg.toFixed(0)} kg`} color="bg-red-500"   />
                <div className="pt-2 border-t border-gray-700 flex justify-between items-center">
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Droplets className="w-3 h-3 text-cyan-400" /> Eau nécessaire
                  </span>
                  <span className="text-sm font-bold text-white font-mono">{results.eauL.toFixed(0)} L</span>
                </div>
                <div className="flex items-start gap-2 p-2.5 bg-blue-500/5 rounded-lg border border-blue-500/20">
                  <Info className="w-3.5 h-3.5 text-blue-400 mt-0.5 flex-shrink-0" />
                  <p className="text-[10px] text-blue-200/70 leading-relaxed italic">
                    Le ratio d'acier (120kg/m³) inclut barres longitudinales HA12/14 et cadres HA6/8.
                  </p>
                </div>
              </div>
            </div>

            {/* Historique */}
            {historique.length > 0 && (
              <div className="bg-gray-800/30 rounded-2xl border border-gray-700/50 overflow-hidden">
                <div className="px-4 py-2 bg-gray-800/50 border-b border-gray-700/50 flex justify-between items-center">
                  <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                    <History className="w-3 h-3" /> Derniers calculs
                  </h4>
                  <button onClick={clearHistory} className="text-[10px] text-red-400 hover:text-red-300">Effacer</button>
                </div>
                <div className="max-h-28 overflow-y-auto">
                  {historique.slice(0, 5).map((item) => (
                    <div key={item.id} className="flex justify-between items-center p-3 border-b border-gray-700/30 hover:bg-gray-700/40 transition-colors">
                      <div className="text-xs">
                        <span className="text-gray-500 block text-[9px]">{item.date}</span>
                        <span className="font-medium">{item.inputs.nombre}× Poteau {item.type}</span>
                      </div>
                      <span className="text-sm font-bold text-blue-400">{parseFloat(item.results.total).toLocaleString()} {currency}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CSS : masquer flèches input[type=number] */}
      <style>{`
        input[type=number]::-webkit-outer-spin-button,
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
      `}</style>
    </div>
  );
}

// ── SOUS-COMPOSANTS ────────────────────────────────────────────
const InputGroup = ({ label, value, onChange, placeholder, full = false }) => (
  <div className={`flex flex-col ${full ? "col-span-2" : ""}`}>
    <label className="mb-1 text-[10px] font-bold text-gray-500 uppercase tracking-wide">{label}</label>
    <input
      type="number"
      value={value}
      onChange={onChange}
      placeholder={placeholder || "0"}
      className="w-full bg-gray-900 border border-gray-600 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono text-sm"
    />
  </div>
);

const ResultCard = ({ label, value, unit, color, bg, border, icon }) => (
  <div className={`rounded-2xl p-3 flex flex-col justify-center items-center text-center ${bg} ${border ? "border border-gray-700" : ""}`}>
    <span className="text-[9px] text-gray-500 uppercase font-bold mb-1 flex items-center gap-1">
      {icon} {label}
    </span>
    <span className={`text-lg font-black ${color}`}>
      {value} <span className="text-xs font-normal text-gray-500">{unit}</span>
    </span>
  </div>
);

const MaterialRow = ({ label, val, color }) => (
  <div className="flex justify-between items-center border-b border-gray-700/30 pb-2 last:border-0">
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${color}`} />
      <span className="text-gray-300 text-xs font-medium">{label}</span>
    </div>
    <span className="text-xs font-bold text-white font-mono">{val}</span>
  </div>
);