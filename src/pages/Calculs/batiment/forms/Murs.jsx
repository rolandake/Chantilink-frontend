import React, { useState, useEffect, useMemo } from "react";
import { BrickWall, Ruler, DoorOpen, Info, Save, Trash2, History, Banknote, Link } from "lucide-react";
import usePersistentState from "../../../../hooks/usePersistentState";

const STORAGE_KEY = "murs-history";

const TYPES_BLOCS = {
  "AGGLO_10": { label: "Agglo creux de 10", nbM2: 12.5, mortierM3: 0.010, epaisseur: 0.10 },
  "AGGLO_15": { label: "Agglo creux de 15", nbM2: 12.5, mortierM3: 0.012, epaisseur: 0.15 },
  "AGGLO_20": { label: "Agglo creux de 20", nbM2: 12.5, mortierM3: 0.015, epaisseur: 0.20 },
  "PLEIN_15": { label: "Agglo plein de 15", nbM2: 12.5, mortierM3: 0.014, epaisseur: 0.15 },
  "BT":       { label: "Brique terre cuite", nbM2: 20,   mortierM3: 0.010, epaisseur: 0.10 },
};

const MORTIER = {
  sacsCimentParM3: 7,
  sableM3ParM3: 1.15,
  eauLParM3: 180,
};

const normalizeBlocType = (type) => ({
  "10": "AGGLO_10",
  "15": "AGGLO_15",
  "20": "AGGLO_20",
}[type] || type || "AGGLO_15");

const DEFAULT_INPUTS = {
  longueur:       "",
  hauteur:        "",
  nombre:         "1",
  type:           "AGGLO_15",
  ouvertures:     "",
  prixBloc:       "",
  prixCiment:     "",
  prixSable:      "",
  coutMainOeuvre: "",
  margePerte:     "5",
};

const fmt  = (n) => Math.round(n).toLocaleString("fr-FR");
const fmtD = (n, d = 2) => (n || 0).toFixed(d);

export default function Murs({
  currency = "XOF",
  onTotalChange,
  onMateriauxChange,
  onResultsChange,  // ✅ nouveau
  projectResults,   // ✅ nouveau
}) {
  const [savedInputs, setSavedInputs] = usePersistentState("elevations:murs:inputs", DEFAULT_INPUTS);
  const inputs = useMemo(() => ({
    ...DEFAULT_INPUTS,
    ...savedInputs,
    type: normalizeBlocType(savedInputs?.type),
  }), [savedInputs]);
  const setInputs = (next) => {
    setSavedInputs((prev) => {
      const base = { ...DEFAULT_INPUTS, ...prev };
      const value = typeof next === "function" ? next(base) : next;
      return { ...DEFAULT_INPUTS, ...value, type: normalizeBlocType(value?.type) };
    });
  };
  const [historique, setHistorique] = useState([]);
  const [message,    setMessage]    = useState(null);

  // ── Calcul ────────────────────────────────────────────────────────────────
  const results = useMemo(() => {
    const L      = parseFloat(inputs.longueur)   || 0;
    const H      = parseFloat(inputs.hauteur)    || 0;
    const nbMurs = parseFloat(inputs.nombre)     || 1;
    const S_vide = parseFloat(inputs.ouvertures) || 0;
    const surfaceBrute = L * H * nbMurs;
    const surfaceNette = Math.max(0, surfaceBrute - S_vide);

    const typeBloc = normalizeBlocType(inputs.type);
    const config = TYPES_BLOCS[typeBloc] || TYPES_BLOCS.AGGLO_15;
    const marge  = 1 + (parseFloat(inputs.margePerte) || 5) / 100;

    const nbBlocs    = Math.ceil(surfaceNette * config.nbM2 * marge);
    const volMortier = surfaceNette * config.mortierM3;
    const cimentSacs = Math.ceil(volMortier * MORTIER.sacsCimentParM3);
    const cimentT    = cimentSacs * 0.05;
    const sableM3    = volMortier * MORTIER.sableM3ParM3;
    const eauL       = volMortier * MORTIER.eauLParM3;
    const volumeMaconnerie = surfaceNette * config.epaisseur;

    const prixBloc = parseFloat(inputs.prixBloc)        || 0;
    const prixCim  = parseFloat(inputs.prixCiment)       || 0;
    const prixSable = parseFloat(inputs.prixSable)       || 0;
    const mo       = parseFloat(inputs.coutMainOeuvre)   || 0;

    const coutBlocs  = nbBlocs    * prixBloc;
    const coutCiment = cimentSacs * prixCim;
    const coutSable  = sableM3    * prixSable;
    const total      = coutBlocs + coutCiment + coutSable + mo;

    return {
      surfaceBrute, surfaceNette, nbBlocs, cimentSacs, cimentT,
      sableM3, eauL, volumeMaconnerie,
      total, volMortier, coutBlocs, coutCiment, coutSable, mo,
    };
  }, [inputs]);

  // ── Sync parent + store ───────────────────────────────────────────────────
  useEffect(() => {
    onTotalChange?.(results.total);
    onMateriauxChange?.({
      blocs: results.nbBlocs,
      ciment: results.cimentT,
      sable: results.sableM3,
      eau: results.eauL,
      mortier: results.volMortier,
      volume: results.volumeMaconnerie,
    });

    // ✅ ÉMISSION résultats → Finitions (surface murs pour peinture/enduit)
    onResultsChange?.({
      surfaceNette:  results.surfaceNette,
      surfaceBrute:  results.surfaceBrute,
      longueur:      parseFloat(inputs.longueur) || 0,
      hauteur:       parseFloat(inputs.hauteur)  || 0,
      nombre:        parseFloat(inputs.nombre)   || 1,
      typeMur:       (TYPES_BLOCS[normalizeBlocType(inputs.type)] || TYPES_BLOCS.AGGLO_15).label,
      typeBloc:      normalizeBlocType(inputs.type),
      epaisseur:     (TYPES_BLOCS[normalizeBlocType(inputs.type)] || TYPES_BLOCS.AGGLO_15).epaisseur,
      nbBlocs:       results.nbBlocs,
      mortierM3:     results.volMortier,
      volumeMaconnerie: results.volumeMaconnerie,
    });
  }, [results.total, results.surfaceNette, results.nbBlocs, inputs.type]);

  // ── Historique ────────────────────────────────────────────────────────────
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
      id:      Date.now(),
      date:    new Date().toLocaleString("fr-FR"),
      type:    (TYPES_BLOCS[normalizeBlocType(inputs.type)] || TYPES_BLOCS.AGGLO_15).label,
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
          <div className="p-2 bg-orange-500/20 rounded-lg text-orange-400"><BrickWall className="w-6 h-6" /></div>
          <div>
            <h2 className="text-xl font-bold text-white">Élévation : Murs</h2>
            <p className="text-xs text-gray-400 font-medium">Maçonnerie, agglos & mortier</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-gray-500 uppercase font-bold block">Total Estimé</span>
          <span className="text-2xl font-black text-orange-400 tracking-tighter">
            {fmt(results.total)} <span className="text-sm text-gray-500 font-normal">{currency}</span>
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-6 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* ── GAUCHE ── */}
          <div className="lg:col-span-5 flex flex-col gap-5">

            {/* Géométrie */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5 shadow-lg">
              <h3 className="flex items-center gap-2 text-sm font-bold text-orange-400 uppercase mb-4">
                <Ruler className="w-4 h-4" /> Géométrie du Mur
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label="Long. unitaire (m)" value={inputs.longueur} onChange={(v) => setInputs({ ...inputs, longueur: v })} />
                <InputGroup label="Hauteur (m)"        value={inputs.hauteur}  onChange={(v) => setInputs({ ...inputs, hauteur: v })} />
                <InputGroup label="Nombre de murs" value={inputs.nombre} onChange={(v) => setInputs({ ...inputs, nombre: v })} />
                <InputGroup label="Pertes (%)" value={inputs.margePerte} onChange={(v) => setInputs({ ...inputs, margePerte: v })} />
                <div className="col-span-2">
                  <label className="text-[10px] text-gray-400 font-bold uppercase mb-1 block">Type d'agglo / maçonnerie</label>
                  <select
                    className="w-full bg-gray-900 border border-gray-600 rounded-xl p-3 text-sm text-white focus:border-orange-500 outline-none"
                    value={normalizeBlocType(inputs.type)}
                    onChange={(e) => setInputs({ ...inputs, type: e.target.value })}>
                    {Object.entries(TYPES_BLOCS).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
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
                onChange={(v) => setInputs({ ...inputs, ouvertures: v })}
                placeholder="Portes + Fenêtres" />
            </div>

            {/* Financier */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5 shadow-lg flex flex-col gap-4">
              <h3 className="flex items-center gap-2 text-sm font-bold text-gray-300 uppercase">
                <Banknote className="w-4 h-4 text-green-400" /> Paramètres Financiers
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label={`Prix / Bloc (${currency})`}       value={inputs.prixBloc}       onChange={(v) => setInputs({ ...inputs, prixBloc: v })} />
                <InputGroup label={`Prix / Sac Ciment (${currency})`} value={inputs.prixCiment}     onChange={(v) => setInputs({ ...inputs, prixCiment: v })} />
                <InputGroup label={`Prix sable (${currency}/m³)`}      value={inputs.prixSable}      onChange={(v) => setInputs({ ...inputs, prixSable: v })} />
                <InputGroup label={`Main d'œuvre (${currency})`}      value={inputs.coutMainOeuvre} onChange={(v) => setInputs({ ...inputs, coutMainOeuvre: v })} full />
              </div>
              <button onClick={handleSave}
                className="w-full mt-2 bg-orange-600 hover:bg-orange-500 text-white py-3.5 rounded-xl font-bold shadow-lg transition-all flex justify-center items-center gap-2 active:scale-95">
                <Save className="w-5 h-5" /> Enregistrer le calcul
              </button>
            </div>
          </div>

          {/* ── DROITE ── */}
          <div className="lg:col-span-7 flex flex-col gap-6">

            {/* KPI */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-orange-500/10 border border-orange-500/20 p-6 rounded-2xl text-center">
                <span className="text-4xl font-black text-white block">{results.nbBlocs.toLocaleString()}</span>
                <span className="text-orange-400 text-xs font-bold uppercase">Agglos / Blocs</span>
              </div>
              <div className="bg-gray-800 border border-gray-700 p-6 rounded-2xl text-center">
                <span className="text-4xl font-black text-white block">{results.cimentSacs}</span>
                <span className="text-gray-400 text-xs font-bold uppercase">Sacs Ciment (Mortier)</span>
              </div>
            </div>

            {/* ✅ Bandeau liaison → Finitions */}
            {results.surfaceNette > 0 && (
              <div className="flex items-center gap-3 p-3 bg-orange-500/8 border border-orange-500/25 rounded-2xl">
                <Link className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-[10px] text-orange-300 font-bold uppercase tracking-wider">
                    Transmis automatiquement → Finitions (Peinture / Enduit)
                  </p>
                  <p className="text-xs text-orange-200/60">
                    Surface nette murs : <span className="font-mono font-bold text-orange-300">{fmtD(results.surfaceNette)} m²</span>
                  </p>
                </div>
              </div>
            )}

            {/* Détails techniques */}
            <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 shadow-xl">
              <h4 className="text-xs font-bold text-gray-500 uppercase mb-4 flex items-center gap-2">
                <Info className="w-4 h-4" /> Détails Techniques
              </h4>
              <ul className="space-y-3 text-sm">
                <li className="flex justify-between border-b border-gray-700 pb-2">
                  <span className="text-gray-400">Surface brute</span>
                  <span className="font-mono font-bold">{fmtD(results.surfaceBrute)} m²</span>
                </li>
                <li className="flex justify-between border-b border-gray-700 pb-2">
                  <span className="text-gray-400">Surface nette à bâtir</span>
                  <span className="font-mono font-bold">{fmtD(results.surfaceNette)} m²</span>
                </li>
                <li className="flex justify-between border-b border-gray-700 pb-2">
                  <span className="text-gray-400">Volume de maçonnerie</span>
                  <span className="font-mono font-bold">{fmtD(results.volumeMaconnerie)} m³</span>
                </li>
                <li className="flex justify-between border-b border-gray-700 pb-2">
                  <span className="text-gray-400">Mortier de pose</span>
                  <span className="font-mono font-bold">{(results.volMortier * 1000).toFixed(0)} Litres</span>
                </li>
                <li className="flex justify-between border-b border-gray-700 pb-2">
                  <span className="text-gray-400">Sable mortier</span>
                  <span className="font-mono font-bold">{fmtD(results.sableM3)} m³</span>
                </li>
                <li className="flex justify-between border-b border-gray-700 pb-2">
                  <span className="text-gray-400">Eau mortier</span>
                  <span className="font-mono font-bold">{fmtD(results.eauL, 0)} L</span>
                </li>
                <li className="flex justify-between border-b border-gray-700 pb-2">
                  <span className="text-gray-400">Coût des blocs</span>
                  <span className="font-mono font-bold text-orange-300">{fmt(results.coutBlocs)} {currency}</span>
                </li>
                <li className="flex justify-between border-b border-gray-700 pb-2">
                  <span className="text-gray-400">Coût ciment mortier</span>
                  <span className="font-mono font-bold text-orange-300">{fmt(results.coutCiment)} {currency}</span>
                </li>
                <li className="flex justify-between border-b border-gray-700 pb-2">
                  <span className="text-gray-400">Coût sable</span>
                  <span className="font-mono font-bold text-orange-300">{fmt(results.coutSable)} {currency}</span>
                </li>
                <li className="flex justify-between border-b border-gray-700 pb-2">
                  <span className="text-gray-400">Main d'œuvre</span>
                  <span className="font-mono font-bold text-orange-300">{fmt(results.mo)} {currency}</span>
                </li>
                <li className="flex justify-between pt-1">
                  <span className="font-bold text-white">TOTAL</span>
                  <span className="font-mono font-black text-orange-400 text-base">{fmt(results.total)} {currency}</span>
                </li>
              </ul>
            </div>

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
                        <span className="font-medium">{item.type} — {fmtD(item.surface, 1)} m²</span>
                      </div>
                      <span className="text-sm font-bold text-orange-400">{fmt(item.total)} {currency}</span>
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

const InputGroup = ({ label, value, onChange, placeholder, full = false }) => (
  <div className={`flex flex-col ${full ? "col-span-2" : ""}`}>
    <label className="mb-1 text-[10px] font-bold text-gray-500 uppercase">{label}</label>
    <input type="number" value={value ?? ""} onChange={(e) => onChange(e.target.value)}
      className="w-full bg-gray-900 border border-gray-600 rounded-xl px-4 py-3 text-white focus:border-orange-500 outline-none transition-all font-mono text-sm"
      placeholder={placeholder || "0"} />
  </div>
);
