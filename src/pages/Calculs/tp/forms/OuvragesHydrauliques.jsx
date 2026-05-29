import React, { useEffect, useMemo, useState } from "react";
import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS, ArcElement, Tooltip, Legend,
} from "chart.js";
import {
  Anchor,
  Banknote,
  BoxSelect,
  ChevronDown,
  ChevronUp,
  Cylinder,
  Droplets,
  Plus,
  Ruler,
  Save,
  Trash2,
  Waves,
} from "lucide-react";
import usePersistentState from "../../../../hooks/usePersistentState";
import { useProjectStore } from "../../../../store/useProjectStore";

ChartJS.register(ArcElement, Tooltip, Legend);

const OUVRAGES_CONFIG = {
  dalot: {
    label: "Dalot cadre",
    icon: BoxSelect,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    dot: "bg-blue-500",
    ratioAcier: 120,
    defaultEpaisseur: "0.20",
  },
  caniveau: {
    label: "Caniveau U",
    icon: Waves,
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/30",
    dot: "bg-cyan-500",
    ratioAcier: 80,
    defaultEpaisseur: "0.15",
  },
  buse: {
    label: "Buse béton",
    icon: Cylinder,
    color: "text-indigo-400",
    bg: "bg-indigo-500/10",
    border: "border-indigo-500/30",
    dot: "bg-indigo-500",
    ratioAcier: 100,
    defaultEpaisseur: "0.12",
  },
};

const fmt = (value, decimals = 0) =>
  Number(value || 0).toLocaleString("fr-FR", { maximumFractionDigits: decimals });
const fmtD = (value) => Number(value || 0).toFixed(2);
const num = (value) => Number.parseFloat(value) || 0;

const defaultOuvrage = (type = "dalot") => ({
  id: Date.now() + Math.random(),
  type,
  label: "",
  longueur: "",
  largeurInt: "",
  hauteurInt: "",
  diametreInt: "",
  epaisseur: OUVRAGES_CONFIG[type]?.defaultEpaisseur || "0.20",
  prixUnitaire: "",
  coutMainOeuvre: "",
  expanded: true,
});

const normalizeOuvrage = (ouvrage) => {
  const type = OUVRAGES_CONFIG[ouvrage?.type] ? ouvrage.type : "dalot";
  return {
    ...defaultOuvrage(type),
    ...(ouvrage || {}),
    type,
    epaisseur: ouvrage?.epaisseur || OUVRAGES_CONFIG[type].defaultEpaisseur,
  };
};

const computeOuvrage = (ouvrage, autoLongueur) => {
  const config = OUVRAGES_CONFIG[ouvrage.type] || OUVRAGES_CONFIG.dalot;
  const longueur = num(ouvrage.longueur) || autoLongueur;
  const ep = num(ouvrage.epaisseur) || num(config.defaultEpaisseur);
  const largeurInt = num(ouvrage.largeurInt);
  const hauteurInt = num(ouvrage.hauteurInt);
  const diametreInt = num(ouvrage.diametreInt);
  const prixUnitaire = num(ouvrage.prixUnitaire);
  const coutMainOeuvre = num(ouvrage.coutMainOeuvre);

  let volume = 0;
  let coffrage = 0;

  if (ouvrage.type === "dalot") {
    const aireBeton = Math.max(0, ((largeurInt + 2 * ep) * (hauteurInt + 2 * ep)) - (largeurInt * hauteurInt));
    volume = aireBeton * longueur;
    coffrage = ((2 * hauteurInt + largeurInt) + 2 * (hauteurInt + 2 * ep)) * longueur;
  } else if (ouvrage.type === "caniveau") {
    const aireBeton = Math.max(0, ((largeurInt + 2 * ep) * (hauteurInt + ep)) - (largeurInt * hauteurInt));
    volume = aireBeton * longueur;
    coffrage = ((2 * hauteurInt + largeurInt) + 2 * (hauteurInt + ep)) * longueur;
  } else {
    const rInt = diametreInt / 2;
    const rExt = rInt + ep;
    const aireBeton = Math.max(0, Math.PI * ((rExt ** 2) - (rInt ** 2)));
    volume = aireBeton * longueur;
    coffrage = (Math.PI * (diametreInt + 2 * ep) + Math.PI * diametreInt) * longueur;
  }

  const cimentT = volume * 0.35;
  const sableT = volume * 0.55;
  const gravierT = volume * 0.75;
  const eauL = volume * 180;
  const acierKg = volume * config.ratioAcier;
  const acierT = acierKg / 1000;
  const total = volume * prixUnitaire + coutMainOeuvre;

  return {
    ...ouvrage,
    config,
    longueurEffective: longueur,
    volume,
    coffrage,
    cimentT,
    cimentSacs: Math.ceil(cimentT * 20),
    sableT,
    gravierT,
    eauL,
    acierKg,
    acierT,
    total,
  };
};

export default function OuvragesHydrauliques({ currency = "XOF", onCostChange, onMateriauxChange }) {
  const terrassement = useProjectStore((state) => state.subResults.terrassement);
  const chaussee = useProjectStore((state) => state.subResults.chaussee);
  const setGlobalResults = useProjectStore((state) => state.setResults);
  const setGlobalMaterials = useProjectStore((state) => state.setMaterials);
  const setGlobalCost = useProjectStore((state) => state.setCost);

  const [ouvragesRaw, setOuvragesRaw] = usePersistentState("tp:hydraulique:ouvrages", [defaultOuvrage("dalot")]);
  const [newType, setNewType] = usePersistentState("tp:hydraulique:newType", "dalot");
  const [message, setMessage] = useState(null);
  const ouvrages = useMemo(() => (
    Array.isArray(ouvragesRaw) && ouvragesRaw.length ? ouvragesRaw.map(normalizeOuvrage) : [defaultOuvrage("dalot")]
  ), [ouvragesRaw]);

  const autoLongueur = useMemo(
    () => chaussee?.longueur || terrassement?.longueurReference || 0,
    [chaussee?.longueur, terrassement?.longueurReference]
  );

  const results = useMemo(() => {
    const ouvragesCalc = ouvrages.map((ouvrage) => computeOuvrage(ouvrage, autoLongueur));
    return ouvragesCalc.reduce((acc, ouvrage) => ({
      ouvragesCalc,
      volume: acc.volume + ouvrage.volume,
      coffrage: acc.coffrage + ouvrage.coffrage,
      cimentT: acc.cimentT + ouvrage.cimentT,
      cimentSacs: acc.cimentSacs + ouvrage.cimentSacs,
      sableT: acc.sableT + ouvrage.sableT,
      gravierT: acc.gravierT + ouvrage.gravierT,
      eauL: acc.eauL + ouvrage.eauL,
      acierKg: acc.acierKg + ouvrage.acierKg,
      acierT: acc.acierT + ouvrage.acierT,
      total: acc.total + ouvrage.total,
    }), {
      ouvragesCalc,
      volume: 0,
      coffrage: 0,
      cimentT: 0,
      cimentSacs: 0,
      sableT: 0,
      gravierT: 0,
      eauL: 0,
      acierKg: 0,
      acierT: 0,
      total: 0,
    });
  }, [ouvrages, autoLongueur]);

  useEffect(() => {
    const materials = {
      nbOuvrages: results.ouvragesCalc.length,
      volume: results.volume,
      coffrage: results.coffrage,
      cimentT: results.cimentT,
      ciment: results.cimentT,
      acierT: results.acierT,
      acier: results.acierT,
      sableT: results.sableT,
      gravierT: results.gravierT,
      eauL: results.eauL,
    };

    onCostChange?.(results.total);
    onMateriauxChange?.(materials);
    setGlobalCost("ouvragesHydrauliques", results.total);
    setGlobalMaterials("ouvragesHydrauliques", materials);
    setGlobalResults("ouvragesHydrauliques", {
      nbOuvrages: results.ouvragesCalc.length,
      longueurReference: autoLongueur,
      volume: results.volume,
      coffrage: results.coffrage,
      acierT: results.acierT,
      cimentT: results.cimentT,
    });
  }, [results, autoLongueur, onCostChange, onMateriauxChange, setGlobalCost, setGlobalMaterials, setGlobalResults]);

  const updateOuvrage = (id, patch) => setOuvragesRaw((prev) => (Array.isArray(prev) ? prev : []).map((ouvrage) => (
    ouvrage.id === id ? { ...ouvrage, ...patch } : ouvrage
  )));
  const addOuvrage = () => setOuvragesRaw((prev) => [...(Array.isArray(prev) ? prev : []), defaultOuvrage(newType)]);
  const removeOuvrage = (id) => setOuvragesRaw((prev) => (Array.isArray(prev) ? prev : []).filter((ouvrage) => ouvrage.id !== id));

  const showToast = (text, type = "success") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 2500);
  };

  const handleSave = () => {
    if (results.volume <= 0) return showToast("Dimensions insuffisantes", "error");
    showToast("Ouvrages hydrauliques ajoutés à la synthèse");
  };

  const chartData = {
    labels: ["Ciment", "Sable", "Gravier", "Acier"],
    datasets: [{
      data: [results.cimentT, results.sableT, results.gravierT, results.acierT],
      backgroundColor: ["#3b82f6", "#fbbf24", "#78716c", "#ef4444"],
      borderColor: "#111827",
      borderWidth: 2,
    }],
  };

  return (
    <div className="w-full h-full flex flex-col bg-gray-900 text-gray-100 overflow-hidden relative font-sans">
      {message && (
        <div className={`fixed top-4 right-4 px-5 py-3 rounded-xl shadow-2xl z-50 font-bold ${
          message.type === "error" ? "bg-red-600" : "bg-blue-600"
        }`}>
          {message.text}
        </div>
      )}

      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
            <Droplets className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white uppercase tracking-tight">Ouvrages Hydrauliques</h2>
            <p className="text-xs text-gray-400 font-medium">Dalots, caniveaux et buses</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-gray-500 uppercase font-bold block">Estimation devis</span>
          <span className="text-2xl font-black text-blue-400 tracking-tighter">
            {fmt(results.total)} <span className="text-sm text-gray-500 font-normal">{currency}</span>
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-6 pb-24">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <div className="xl:col-span-7 space-y-5">
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5">
              <h3 className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
                <Plus className="w-4 h-4" /> Ajouter un ouvrage
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
                <select
                  value={newType}
                  onChange={(event) => setNewType(event.target.value)}
                  className="bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-blue-500"
                >
                  {Object.entries(OUVRAGES_CONFIG).map(([key, config]) => (
                    <option key={key} value={key}>{config.label}</option>
                  ))}
                </select>
                <button
                  onClick={addOuvrage}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-3 rounded-xl font-bold flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Ajouter
                </button>
              </div>
              {autoLongueur > 0 && (
                <p className="mt-3 text-xs text-blue-200/70">
                  Linéaire repris automatiquement : {fmtD(autoLongueur)} m
                </p>
              )}
            </div>

            {results.ouvragesCalc.map((ouvrage) => {
              const Icon = ouvrage.config.icon;
              return (
                <div key={ouvrage.id} className={`border rounded-2xl overflow-hidden ${ouvrage.config.bg} ${ouvrage.config.border}`}>
                  <div className="p-4 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => updateOuvrage(ouvrage.id, { expanded: !ouvrage.expanded })}
                      className="flex items-center gap-3 text-left min-w-0"
                    >
                      <div className="p-2 bg-gray-950/50 rounded-xl">
                        <Icon className={`w-5 h-5 ${ouvrage.config.color}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-black text-white truncate">{ouvrage.label || ouvrage.config.label}</p>
                        <p className="text-xs text-gray-400">
                          {fmtD(ouvrage.longueurEffective)} m | {fmtD(ouvrage.volume)} m³ | coffrage {fmtD(ouvrage.coffrage)} m²
                        </p>
                      </div>
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => removeOuvrage(ouvrage.id)}
                        className="p-2 rounded-lg text-red-400 hover:bg-red-500/10"
                        aria-label="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      {ouvrage.expanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                    </div>
                  </div>

                  {ouvrage.expanded && (
                    <div className="p-4 border-t border-gray-700/60 bg-gray-950/30">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <InputGroup label="Nom / repère" type="text" value={ouvrage.label} onChange={(value) => updateOuvrage(ouvrage.id, { label: value })} />
                        <InputGroup label="Longueur totale (m)" value={ouvrage.longueur} onChange={(value) => updateOuvrage(ouvrage.id, { longueur: value })} placeholder={autoLongueur ? fmtD(autoLongueur) : "0"} />
                        <InputGroup label="Épaisseur parois (m)" value={ouvrage.epaisseur} onChange={(value) => updateOuvrage(ouvrage.id, { epaisseur: value })} />

                        {ouvrage.type !== "buse" ? (
                          <>
                            <InputGroup label="Largeur intérieure (m)" value={ouvrage.largeurInt} onChange={(value) => updateOuvrage(ouvrage.id, { largeurInt: value })} />
                            <InputGroup label="Hauteur intérieure (m)" value={ouvrage.hauteurInt} onChange={(value) => updateOuvrage(ouvrage.id, { hauteurInt: value })} />
                          </>
                        ) : (
                          <InputGroup label="Diamètre intérieur (m)" value={ouvrage.diametreInt} onChange={(value) => updateOuvrage(ouvrage.id, { diametreInt: value })} />
                        )}

                        <InputGroup label={`PU béton (${currency}/m³)`} value={ouvrage.prixUnitaire} onChange={(value) => updateOuvrage(ouvrage.id, { prixUnitaire: value })} />
                        <InputGroup label={`Main d'œuvre (${currency})`} value={ouvrage.coutMainOeuvre} onChange={(value) => updateOuvrage(ouvrage.id, { coutMainOeuvre: value })} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="xl:col-span-5 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <ResultCard label="Volume béton" value={fmt(results.volume, 2)} unit="m³" icon={<BoxSelect className="w-4 h-4" />} accent />
              <ResultCard label="Coffrage" value={fmt(results.coffrage, 2)} unit="m²" icon={<Ruler className="w-4 h-4" />} />
              <ResultCard label="Acier" value={fmt(results.acierKg, 0)} unit="kg" icon={<Anchor className="w-4 h-4" />} />
              <ResultCard label="Eau" value={fmt(results.eauL, 0)} unit="L" icon={<Droplets className="w-4 h-4" />} />
            </div>

            <div className="bg-gray-800 rounded-3xl p-6 border border-gray-700 shadow-xl">
              <div className="w-48 h-48 mx-auto relative">
                <Doughnut data={chartData} options={{ cutout: "72%", plugins: { legend: { display: false } } }} />
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[10px] text-gray-500 uppercase font-bold">Ciment</span>
                  <span className="text-sm font-bold text-white">{results.cimentSacs} sacs</span>
                </div>
              </div>
              <div className="mt-6 space-y-3">
                <MaterialRow label="Ciment 350 kg/m³" value={`${fmt(results.cimentT, 2)} t`} color="bg-blue-500" />
                <MaterialRow label="Sable" value={`${fmt(results.sableT, 2)} t`} color="bg-amber-400" />
                <MaterialRow label="Gravier" value={`${fmt(results.gravierT, 2)} t`} color="bg-stone-500" />
                <MaterialRow label="Acier" value={`${fmt(results.acierT, 3)} t`} color="bg-red-500" />
              </div>
            </div>

            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5">
              <h3 className="flex items-center gap-2 text-xs font-bold text-blue-300 uppercase tracking-widest mb-4">
                <Banknote className="w-4 h-4" /> Synthèse hydraulique
              </h3>
              <SummaryLine label="Ouvrages ajoutés" value={`${results.ouvragesCalc.length} u`} />
              <SummaryLine label="Volume béton total" value={`${fmt(results.volume, 2)} m³`} />
              <SummaryLine label="Coffrage total" value={`${fmt(results.coffrage, 2)} m²`} />
              <div className="mt-4 pt-4 border-t border-blue-500/20 flex items-center justify-between">
                <span className="text-xs font-black uppercase text-blue-300">Total hydraulique</span>
                <span className="text-xl font-black text-white">{fmt(results.total)} {currency}</span>
              </div>
              <button
                onClick={handleSave}
                className="mt-5 w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-xl font-bold shadow-lg transition-all flex justify-center items-center gap-2 active:scale-95"
              >
                <Save className="w-5 h-5" /> Valider la synthèse
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const InputGroup = ({ label, value, onChange, placeholder, type = "number" }) => (
  <div className="flex flex-col">
    <label className="mb-1 text-[10px] font-bold text-gray-500 uppercase tracking-wide">{label}</label>
    <input
      type={type}
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value)}
      className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none transition-all font-mono text-sm"
      placeholder={placeholder || "0"}
    />
  </div>
);

const ResultCard = ({ label, value, unit, icon, accent = false }) => (
  <div className={`rounded-2xl p-4 text-center border ${accent ? "bg-blue-500/10 border-blue-500/30" : "bg-gray-800/70 border-gray-700"}`}>
    <span className="text-[10px] text-gray-500 uppercase font-bold mb-1 flex items-center justify-center gap-1">
      {icon} {label}
    </span>
    <span className={`text-xl font-black ${accent ? "text-blue-300" : "text-white"}`}>
      {value} <span className="text-xs font-normal text-gray-500 lowercase">{unit}</span>
    </span>
  </div>
);

const MaterialRow = ({ label, value, color }) => (
  <div className="flex items-center justify-between text-sm">
    <div className="flex items-center gap-2 min-w-0">
      <span className={`w-3 h-3 rounded-full ${color}`} />
      <span className="text-gray-300 truncate">{label}</span>
    </div>
    <span className="font-mono font-bold text-white">{value}</span>
  </div>
);

const SummaryLine = ({ label, value }) => (
  <div className="flex items-center justify-between py-2 text-sm border-b border-gray-700/50 last:border-0">
    <span className="text-gray-400">{label}</span>
    <span className="font-mono font-bold text-white">{value}</span>
  </div>
);
