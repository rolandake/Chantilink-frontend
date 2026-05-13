import React, { useState, useEffect, useMemo } from "react";
import { BrickWall, Ruler, DoorOpen, Info, Save, Trash2, History, Banknote } from "lucide-react";

const STORAGE_KEY = "murs-history";

const TYPES_BLOCS = {
  "15": { label: "Parpaing de 15", nbM2: 12.5, mortierM3: 0.012 },
  "20": { label: "Parpaing de 20", nbM2: 12.5, mortierM3: 0.015 },
  "BT": { label: "Brique Terre Cuite", nbM2: 20,   mortierM3: 0.010 }
};

export default function Murs({ currency = "XOF", onTotalChange, onMateriauxChange }) {
  const [inputs, setInputs] = useState({
    longueur:    "",
    hauteur:     "",
    type:        "15",
    ouvertures:  "",
    prixBloc:    "",
    prixCiment:  "",
    coutMainOeuvre: "",
    margePerte:  "5",
  });

  const [historique, setHistorique] = useState([]);
  const [message,    setMessage]    = useState(null);

  // ── MOTEUR DE CALCUL ─────────────────────────────────────────
  const results = useMemo(() => {
    const L       = parseFloat(inputs.longueur)   || 0;
    const H       = parseFloat(inputs.hauteur)    || 0;
    const S_vide  = parseFloat(inputs.ouvertures) || 0;
    const surfaceNette = Math.max(0, (L * H) - S_vide);

    const config = TYPES_BLOCS[inputs.type];
    const marge  = 1 + (parseFloat(inputs.margePerte) || 5) / 100;

    const nbBlocs    = Math.ceil(surfaceNette * config.nbM2 * marge);
    const volMortier = surfaceNette * config.mortierM3;
    const cimentSacs = Math.ceil(volMortier * 7); // ~350 kg/m³ de mortier
    const cimentT    = cimentSacs * 0.05;         // 1 sac = 50 kg = 0.05 t

    const prixBloc  = parseFloat(inputs.prixBloc)        || 0;
    const prixCim   = parseFloat(inputs.prixCiment)       || 0;
    const mo        = parseFloat(inputs.coutMainOeuvre)   || 0;

    const coutBlocs   = nbBlocs    * prixBloc;
    const coutCiment  = cimentSacs * prixCim;
    const total       = coutBlocs + coutCiment + mo;

    return { surfaceNette, nbBlocs, cimentSacs, cimentT, total, volMortier, coutBlocs, coutCiment, mo };
  }, [inputs]);

  // ── SYNC PARENT ───────────────────────────────────────────────
  useEffect(() => {
    onTotalChange?.(results.total);
    onMateriauxChange?.({ blocs: results.nbBlocs, ciment: results.cimentT });
  }, [results, onTotalChange, onMateriauxChange]);

  // ── HISTORIQUE ────────────────────────────────────────────────
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
    if (results.surfaceNette <= 0) return showToast("⚠️ Dimensions invalides", "error");
    const entry = {
      id:    Date.now(),
      date:  new Date().toLocaleString("fr-FR"),
      type:  TYPES_BLOCS[inputs.type].label,
      surface: results.surfaceNette,
      nbBlocs: results.nbBlocs,
      total:   results.total,
    };
    const next = [entry, ...historique];
    setHistorique(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
    showToast("✅ Mur enregistré !");
  };

  const handleClear = () => {
    setHistorique([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 text-gray-100 overflow-hidden relative">

      {/* Toast */}
      {message && (
        <div className={`fixed top-4 right-4 px-6 py-3 rounded-xl shadow-2xl z-50 font-bold animate-bounce ${
          message.type === "error" ? "bg-red-600" : "bg-orange-600"
        }`}>
          {message.text}
        </div>
      )}

      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-500/20 rounded-lg text-orange-400">
            <BrickWall className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Élévation : Murs</h2>
            <p className="text-xs text-gray-400 font-medium">Maçonnerie & Blocs</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-gray-500 uppercase font-bold block">Total Estimé</span>
          <span className="text-2xl font-black text-orange-400 tracking-tighter">
            {results.total.toLocaleString()} <span className="text-sm text-gray-500 font-normal">{currency}</span>
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-6 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* ── GAUCHE : SAISIE ── */}
          <div className="lg:col-span-5 flex flex-col gap-5">

            {/* Géométrie */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5 shadow-lg">
              <h3 className="flex items-center gap-2 text-sm font-bold text-orange-400 uppercase mb-4">
                <Ruler className="w-4 h-4" /> Géométrie du Mur
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label="Long. Totale (m)" value={inputs.longueur} onChange={v => setInputs({...inputs, longueur: v})} />
                <InputGroup label="Hauteur (m)"      value={inputs.hauteur}  onChange={v => setInputs({...inputs, hauteur: v})}  />
                <div className="col-span-2">
                  <label className="text-[10px] text-gray-400 font-bold uppercase mb-1 block">Type de maçonnerie</label>
                  <select
                    className="w-full bg-gray-900 border border-gray-600 rounded-xl p-3 text-sm text-white focus:border-orange-500 outline-none"
                    value={inputs.type}
                    onChange={e => setInputs({...inputs, type: e.target.value})}
                  >
                    {Object.entries(TYPES_BLOCS).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
                <InputGroup label="Pertes (%)" value={inputs.margePerte} onChange={v => setInputs({...inputs, margePerte: v})} />
              </div>
            </div>

            {/* Ouvertures */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5 shadow-lg">
              <h3 className="flex items-center gap-2 text-sm font-bold text-gray-400 uppercase mb-4">
                <DoorOpen className="w-4 h-4" /> Ouvertures (Déduction)
              </h3>
              <InputGroup
                label="Surface totale des vides (m²)"
                value={inputs.ouvertures}
                onChange={v => setInputs({...inputs, ouvertures: v})}
                placeholder="Portes + Fenêtres"
              />
            </div>

            {/* Financier + Bouton Save */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5 shadow-lg flex flex-col gap-4">
              <h3 className="flex items-center gap-2 text-sm font-bold text-gray-300 uppercase">
                <Banknote className="w-4 h-4 text-green-400" /> Paramètres Financiers
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label={`Prix / Bloc (${currency})`}      value={inputs.prixBloc}       onChange={v => setInputs({...inputs, prixBloc: v})}       />
                <InputGroup label={`Prix / Sac Ciment (${currency})`} value={inputs.prixCiment}     onChange={v => setInputs({...inputs, prixCiment: v})}     />
                <InputGroup label={`Main d'œuvre (${currency})`}      value={inputs.coutMainOeuvre} onChange={v => setInputs({...inputs, coutMainOeuvre: v})} full />
              </div>

              <button
                onClick={handleSave}
                className="w-full mt-2 bg-orange-600 hover:bg-orange-500 text-white py-3.5 rounded-xl font-bold shadow-lg transition-all flex justify-center items-center gap-2 active:scale-95"
              >
                <Save className="w-5 h-5" /> Enregistrer le calcul
              </button>
            </div>
          </div>

          {/* ── DROITE : RÉSULTATS ── */}
          <div className="lg:col-span-7 flex flex-col gap-6">

            {/* KPI Cards */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-orange-500/10 border border-orange-500/20 p-6 rounded-2xl text-center">
                <span className="text-4xl font-black text-white block">{results.nbBlocs.toLocaleString()}</span>
                <span className="text-orange-400 text-xs font-bold uppercase">Unités de Blocs</span>
              </div>
              <div className="bg-gray-800 border border-gray-700 p-6 rounded-2xl text-center">
                <span className="text-4xl font-black text-white block">{results.cimentSacs}</span>
                <span className="text-gray-400 text-xs font-bold uppercase">Sacs Ciment (Mortier)</span>
              </div>
            </div>

            {/* Détails Techniques */}
            <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 shadow-xl">
              <h4 className="text-xs font-bold text-gray-500 uppercase mb-4 flex items-center gap-2">
                <Info className="w-4 h-4" /> Détails Techniques
              </h4>
              <ul className="space-y-3 text-sm">
                <li className="flex justify-between border-b border-gray-700 pb-2">
                  <span className="text-gray-400">Surface nette à bâtir</span>
                  <span className="font-mono font-bold">{results.surfaceNette.toFixed(2)} m²</span>
                </li>
                <li className="flex justify-between border-b border-gray-700 pb-2">
                  <span className="text-gray-400">Mortier de pose</span>
                  <span className="font-mono font-bold">{(results.volMortier * 1000).toFixed(0)} Litres</span>
                </li>
                <li className="flex justify-between border-b border-gray-700 pb-2">
                  <span className="text-gray-400">Coût des blocs</span>
                  <span className="font-mono font-bold text-orange-300">{results.coutBlocs.toLocaleString()} {currency}</span>
                </li>
                <li className="flex justify-between border-b border-gray-700 pb-2">
                  <span className="text-gray-400">Coût ciment mortier</span>
                  <span className="font-mono font-bold text-orange-300">{results.coutCiment.toLocaleString()} {currency}</span>
                </li>
                <li className="flex justify-between border-b border-gray-700 pb-2">
                  <span className="text-gray-400">Main d'œuvre</span>
                  <span className="font-mono font-bold text-orange-300">{results.mo.toLocaleString()} {currency}</span>
                </li>
                <li className="flex justify-between pt-1">
                  <span className="font-bold text-white">TOTAL</span>
                  <span className="font-mono font-black text-orange-400 text-base">{results.total.toLocaleString()} {currency}</span>
                </li>
              </ul>
            </div>

            {/* Historique */}
            {historique.length > 0 && (
              <div className="bg-gray-800/30 rounded-2xl border border-gray-700/50 overflow-hidden">
                <div className="px-4 py-2 bg-gray-800/50 border-b border-gray-700/50 flex justify-between items-center">
                  <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                    <History className="w-3 h-3" /> Historique
                  </h4>
                  <button onClick={handleClear} className="text-[10px] text-red-400 hover:underline flex items-center gap-1">
                    <Trash2 className="w-3 h-3" /> Vider
                  </button>
                </div>
                <div className="max-h-[140px] overflow-y-auto">
                  {historique.slice(0, 5).map((item) => (
                    <div key={item.id} className="flex justify-between items-center p-3 border-b border-gray-700/30 hover:bg-gray-700/40 transition-colors">
                      <div className="text-xs">
                        <span className="text-gray-500 text-[9px] block">{item.date}</span>
                        <span className="font-medium">{item.type} — {item.surface.toFixed(1)} m²</span>
                      </div>
                      <span className="text-sm font-bold text-orange-400">{item.total.toLocaleString()} {currency}</span>
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

// ── SOUS-COMPOSANTS ───────────────────────────────────────────
const InputGroup = ({ label, value, onChange, placeholder, full = false }) => (
  <div className={`flex flex-col ${full ? "col-span-2" : ""}`}>
    <label className="mb-1 text-[10px] font-bold text-gray-500 uppercase">{label}</label>
    <input
      type="number"
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full bg-gray-900 border border-gray-600 rounded-xl px-4 py-3 text-white focus:border-orange-500 outline-none transition-all font-mono text-sm"
      placeholder={placeholder || "0"}
    />
  </div>
);