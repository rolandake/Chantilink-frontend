import React, { useEffect, useMemo, useState } from "react";
import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS, ArcElement, Tooltip, Legend,
} from "chart.js";
import {
  Banknote,
  ChevronDown,
  ChevronUp,
  HardHat,
  Layers,
  Plus,
  Ruler,
  Save,
  Scale,
  Trash2,
  Truck,
} from "lucide-react";
import usePersistentState from "../../../../hooks/usePersistentState";
import { useProjectStore } from "../../../../store/useProjectStore";

ChartJS.register(ArcElement, Tooltip, Legend);

const COUCHES_CONFIG = {
  fondation_gnt: {
    label: "Couche de fondation GNT",
    type: "fondation",
    icon: HardHat,
    epaisseur: "0.20",
    densite: 2,
    coeff: 1.15,
    gravier: 0.7,
    sable: 0.3,
    color: "#eab308",
    dot: "bg-yellow-500",
  },
  base_grave_bitume: {
    label: "Couche de base grave bitume",
    type: "base",
    icon: Layers,
    epaisseur: "0.10",
    densite: 2.35,
    coeff: 1.05,
    granulats: 0.945,
    bitume: 0.055,
    color: "#f97316",
    dot: "bg-orange-500",
  },
  base_granulaire: {
    label: "Couche de base granulaire",
    type: "base",
    icon: Layers,
    epaisseur: "0.15",
    densite: 2.1,
    coeff: 1.15,
    gravier: 0.75,
    sable: 0.25,
    color: "#fb923c",
    dot: "bg-orange-400",
  },
  roulement_bb: {
    label: "Couche de roulement BB",
    type: "roulement",
    icon: Truck,
    epaisseur: "0.05",
    densite: 2.35,
    coeff: 1.05,
    granulats: 0.945,
    bitume: 0.055,
    emulsionKgM2: 1,
    color: "#a855f7",
    dot: "bg-purple-500",
  },
  accrochage: {
    label: "Couche d'accrochage",
    type: "traitement",
    icon: Scale,
    epaisseur: "0",
    densite: 0,
    coeff: 1,
    emulsionKgM2: 1,
    color: "#38bdf8",
    dot: "bg-sky-400",
    surfaceOnly: true,
  },
};

const fmt = (value, decimals = 0) =>
  Number(value || 0).toLocaleString("fr-FR", { maximumFractionDigits: decimals });
const fmtD = (value) => Number(value || 0).toFixed(2);
const num = (value) => Number.parseFloat(value) || 0;

const defaultCouche = (type = "roulement_bb") => ({
  id: Date.now() + Math.random(),
  type,
  label: "",
  longueur: "",
  largeur: "",
  surface: "",
  epaisseur: COUCHES_CONFIG[type]?.epaisseur || "0.05",
  pertes: "5",
  prixTonne: "",
  prixM2: "",
  expanded: true,
});

const normalizeCouche = (couche) => {
  const type = COUCHES_CONFIG[couche?.type] ? couche.type : "roulement_bb";
  return {
    ...defaultCouche(type),
    ...(couche || {}),
    type,
    epaisseur: couche?.epaisseur ?? COUCHES_CONFIG[type].epaisseur,
  };
};

const computeCouche = (couche, refs) => {
  const config = COUCHES_CONFIG[couche.type] || COUCHES_CONFIG.roulement_bb;
  const longueur = num(couche.longueur) || refs.longueur;
  const largeur = num(couche.largeur) || refs.largeur;
  const surface = num(couche.surface) || (longueur && largeur ? longueur * largeur : refs.surface);
  const epaisseur = num(couche.epaisseur);
  const pertes = 1 + num(couche.pertes) / 100;
  const volume = config.surfaceOnly ? 0 : surface * epaisseur;
  const tonnage = volume * config.densite * config.coeff * pertes;
  const sableT = tonnage * (config.sable || 0);
  const gravierT = tonnage * (config.gravier || 0);
  const granulatsT = tonnage * (config.granulats || 0);
  const bitumeT = tonnage * (config.bitume || 0);
  const emulsionKg = surface * (config.emulsionKgM2 || 0);
  const coutMateriaux = config.surfaceOnly ? surface * num(couche.prixM2) : tonnage * num(couche.prixTonne);
  const coutPose = config.surfaceOnly ? 0 : surface * num(couche.prixM2);
  const total = coutMateriaux + coutPose;

  return {
    ...couche,
    config,
    longueurEffective: longueur,
    largeurEffective: largeur,
    surface,
    volume,
    tonnage,
    sableT,
    gravierT,
    granulatsT,
    bitumeT,
    emulsionKg,
    coutMateriaux,
    coutPose,
    total,
  };
};

export default function Chaussee({ currency = "XOF", onCostChange, onMateriauxChange }) {
  const terrassement = useProjectStore((state) => state.subResults.terrassement);
  const fondation = useProjectStore((state) => state.subResults.fondation);
  const setGlobalResults = useProjectStore((state) => state.setResults);
  const setGlobalMaterials = useProjectStore((state) => state.setMaterials);
  const setGlobalCost = useProjectStore((state) => state.setCost);

  const [couchesRaw, setCouchesRaw] = usePersistentState("tp:chaussee:couches", [
    defaultCouche("base_grave_bitume"),
    defaultCouche("roulement_bb"),
  ]);
  const [newType, setNewType] = usePersistentState("tp:chaussee:newType", "roulement_bb");
  const [message, setMessage] = useState(null);

  const couches = useMemo(() => (
    Array.isArray(couchesRaw) && couchesRaw.length ? couchesRaw.map(normalizeCouche) : [defaultCouche("roulement_bb")]
  ), [couchesRaw]);

  const refs = useMemo(() => ({
    longueur: fondation?.longueurReference || terrassement?.longueurReference || 0,
    largeur: fondation?.largeurReference || terrassement?.largeurReference || 0,
    surface: fondation?.surface || terrassement?.surfacePlateforme || 0,
  }), [
    fondation?.longueurReference,
    fondation?.largeurReference,
    fondation?.surface,
    terrassement?.longueurReference,
    terrassement?.largeurReference,
    terrassement?.surfacePlateforme,
  ]);

  const results = useMemo(() => {
    const couchesCalc = couches.map((couche) => computeCouche(couche, refs));
    return couchesCalc.reduce((acc, couche) => ({
      couchesCalc,
      surface: Math.max(acc.surface, couche.surface),
      volume: acc.volume + couche.volume,
      tonnageTotal: acc.tonnageTotal + couche.tonnage,
      roulementT: acc.roulementT + (couche.config.type === "roulement" ? couche.tonnage : 0),
      baseT: acc.baseT + (couche.config.type === "base" ? couche.tonnage : 0),
      fondationT: acc.fondationT + (couche.config.type === "fondation" ? couche.tonnage : 0),
      enrobe: acc.enrobe + (couche.config.type === "roulement" || couche.type === "base_grave_bitume" ? couche.tonnage : 0),
      sableT: acc.sableT + couche.sableT,
      gravierT: acc.gravierT + couche.gravierT,
      granulatsT: acc.granulatsT + couche.granulatsT,
      bitumeT: acc.bitumeT + couche.bitumeT,
      emulsionKg: acc.emulsionKg + couche.emulsionKg,
      coutMateriaux: acc.coutMateriaux + couche.coutMateriaux,
      coutPose: acc.coutPose + couche.coutPose,
      total: acc.total + couche.total,
    }), {
      couchesCalc,
      surface: 0,
      volume: 0,
      tonnageTotal: 0,
      roulementT: 0,
      baseT: 0,
      fondationT: 0,
      enrobe: 0,
      sableT: 0,
      gravierT: 0,
      granulatsT: 0,
      bitumeT: 0,
      emulsionKg: 0,
      coutMateriaux: 0,
      coutPose: 0,
      total: 0,
    });
  }, [couches, refs]);

  useEffect(() => {
    const materials = {
      surface: results.surface,
      volume: results.volume,
      tonnageTotal: results.tonnageTotal,
      roulementT: results.roulementT,
      baseT: results.baseT,
      fondationT: results.fondationT,
      enrobe: results.enrobe,
      sableT: results.sableT,
      gravierT: results.gravierT,
      granulatsT: results.granulatsT,
      bitumeT: results.bitumeT,
      emulsionKg: results.emulsionKg,
      coutMateriaux: results.coutMateriaux,
      coutPose: results.coutPose,
    };

    onCostChange?.(results.total);
    onMateriauxChange?.(materials);
    setGlobalCost("chaussee", results.total);
    setGlobalMaterials("chaussee", materials);
    setGlobalResults("chaussee", {
      surface: results.surface,
      longueur: refs.longueur,
      largeur: refs.largeur,
      volume: results.volume,
      tonnageTotal: results.tonnageTotal,
      roulementT: results.roulementT,
      baseT: results.baseT,
      fondationT: results.fondationT,
      bitumeT: results.bitumeT,
      emulsionKg: results.emulsionKg,
    });
  }, [results, refs.longueur, refs.largeur, onCostChange, onMateriauxChange, setGlobalCost, setGlobalMaterials, setGlobalResults]);

  const updateCouche = (id, patch) => setCouchesRaw((prev) => (Array.isArray(prev) ? prev : []).map((couche) => (
    couche.id === id ? { ...couche, ...patch } : couche
  )));
  const addCouche = () => setCouchesRaw((prev) => [...(Array.isArray(prev) ? prev : []), defaultCouche(newType)]);
  const removeCouche = (id) => setCouchesRaw((prev) => (Array.isArray(prev) ? prev : []).filter((couche) => couche.id !== id));

  const showToast = (text, type = "success") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 2500);
  };

  const handleSave = () => {
    if (results.total <= 0) return showToast("Données incomplètes", "error");
    showToast("Chaussée ajoutée à la synthèse");
  };

  const chartData = {
    labels: ["Roulement", "Base", "Fondation", "Pose"],
    datasets: [{
      data: [results.roulementT, results.baseT, results.fondationT, results.coutPose / 1000],
      backgroundColor: ["#a855f7", "#f97316", "#eab308", "#2563eb"],
      borderColor: "#111827",
      borderWidth: 2,
    }],
  };

  return (
    <div className="w-full h-full flex flex-col bg-gray-900 text-gray-100 overflow-hidden relative font-sans">
      {message && (
        <div className={`fixed top-4 right-4 px-5 py-3 rounded-xl shadow-2xl z-50 font-bold ${
          message.type === "error" ? "bg-red-600" : "bg-purple-600"
        }`}>
          {message.text}
        </div>
      )}

      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-500/20 rounded-lg text-purple-400">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white uppercase tracking-tight">Corps de Chaussée</h2>
            <p className="text-xs text-gray-400 font-medium">Couches routières, tonnages et liants</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-gray-500 uppercase font-bold block">Budget total</span>
          <span className="text-2xl font-black text-purple-400 tracking-tighter">
            {fmt(results.total)} <span className="text-sm text-gray-500 font-normal">{currency}</span>
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-6 pb-24">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <div className="xl:col-span-7 space-y-5">
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5">
              <h3 className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
                <Plus className="w-4 h-4" /> Ajouter une couche
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
                <select
                  value={newType}
                  onChange={(event) => setNewType(event.target.value)}
                  className="bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-purple-500"
                >
                  {Object.entries(COUCHES_CONFIG).map(([key, cfg]) => (
                    <option key={key} value={key}>{cfg.label}</option>
                  ))}
                </select>
                <button
                  onClick={addCouche}
                  className="bg-purple-600 hover:bg-purple-500 text-white px-5 py-3 rounded-xl font-bold flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Ajouter
                </button>
              </div>
              {refs.surface > 0 && (
                <p className="mt-3 text-xs text-purple-200/70">
                  Références reprises : {refs.longueur ? `${fmtD(refs.longueur)} m` : "—"} x {refs.largeur ? `${fmtD(refs.largeur)} m` : "—"} | {fmtD(refs.surface)} m²
                </p>
              )}
            </div>

            {results.couchesCalc.map((couche) => {
              const Icon = couche.config.icon;
              return (
                <div key={couche.id} className="border border-gray-700 rounded-2xl overflow-hidden bg-gray-800/40">
                  <div className="p-4 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => updateCouche(couche.id, { expanded: !couche.expanded })}
                      className="flex items-center gap-3 text-left min-w-0"
                    >
                      <div className="p-2 bg-gray-950/50 rounded-xl">
                        <Icon className="w-5 h-5" style={{ color: couche.config.color }} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-black text-white truncate">{couche.label || couche.config.label}</p>
                        <p className="text-xs text-gray-400">
                          {fmtD(couche.surface)} m² | {fmtD(couche.volume)} m³ | {fmtD(couche.tonnage)} t
                        </p>
                      </div>
                    </button>
                    <div className="flex items-center gap-2">
                      <button onClick={() => removeCouche(couche.id)} className="p-2 rounded-lg text-red-400 hover:bg-red-500/10" aria-label="Supprimer">
                        <Trash2 className="w-4 h-4" />
                      </button>
                      {couche.expanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                    </div>
                  </div>

                  {couche.expanded && (
                    <div className="p-4 border-t border-gray-700/60 bg-gray-950/30">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <InputGroup label="Nom / repère" type="text" value={couche.label} onChange={(value) => updateCouche(couche.id, { label: value })} />
                        <InputGroup label="Surface directe (m²)" value={couche.surface} onChange={(value) => updateCouche(couche.id, { surface: value })} placeholder={refs.surface ? fmtD(refs.surface) : "auto"} />
                        <InputGroup label="Longueur (m)" value={couche.longueur} onChange={(value) => updateCouche(couche.id, { longueur: value })} placeholder={refs.longueur ? fmtD(refs.longueur) : "auto"} />
                        <InputGroup label="Largeur (m)" value={couche.largeur} onChange={(value) => updateCouche(couche.id, { largeur: value })} placeholder={refs.largeur ? fmtD(refs.largeur) : "auto"} />
                        {!couche.config.surfaceOnly && (
                          <InputGroup label="Épaisseur (m)" value={couche.epaisseur} onChange={(value) => updateCouche(couche.id, { epaisseur: value })} />
                        )}
                        <InputGroup label="Pertes (%)" value={couche.pertes} onChange={(value) => updateCouche(couche.id, { pertes: value })} />
                        {!couche.config.surfaceOnly && (
                          <InputGroup label={`Prix matériau (${currency}/t)`} value={couche.prixTonne} onChange={(value) => updateCouche(couche.id, { prixTonne: value })} />
                        )}
                        <InputGroup label={couche.config.surfaceOnly ? `Prix (${currency}/m²)` : `Pose (${currency}/m²)`} value={couche.prixM2} onChange={(value) => updateCouche(couche.id, { prixM2: value })} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="xl:col-span-5 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <ResultCard label="Surface" value={fmt(results.surface, 1)} unit="m²" icon={<Ruler className="w-4 h-4" />} />
              <ResultCard label="Tonnage" value={fmt(results.tonnageTotal, 2)} unit="t" icon={<Truck className="w-4 h-4" />} accent />
              <ResultCard label="Volume" value={fmt(results.volume, 2)} unit="m³" icon={<Layers className="w-4 h-4" />} />
              <ResultCard label="Prix moyen" value={fmt(results.total / (results.surface || 1), 0)} unit={`${currency}/m²`} icon={<Banknote className="w-4 h-4" />} />
            </div>

            <div className="bg-gray-800 rounded-3xl p-6 border border-gray-700 shadow-xl">
              <div className="w-48 h-48 mx-auto relative">
                <Doughnut data={chartData} options={{ cutout: "72%", plugins: { legend: { display: false } } }} />
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[10px] text-gray-500 uppercase font-bold">Masse</span>
                  <span className="text-sm font-bold text-white">{fmt(results.tonnageTotal, 1)} t</span>
                </div>
              </div>
              <div className="mt-6 space-y-3">
                <MaterialRow label="Roulement" value={`${fmt(results.roulementT, 2)} t`} color="bg-purple-500" />
                <MaterialRow label="Base" value={`${fmt(results.baseT, 2)} t`} color="bg-orange-500" />
                <MaterialRow label="Fondation" value={`${fmt(results.fondationT, 2)} t`} color="bg-yellow-500" />
                <MaterialRow label="Bitume" value={`${fmt(results.bitumeT, 3)} t`} color="bg-gray-950" />
                <MaterialRow label="Émulsion" value={`${fmt(results.emulsionKg, 2)} kg`} color="bg-sky-400" />
              </div>
            </div>

            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5">
              <h3 className="flex items-center gap-2 text-xs font-bold text-purple-300 uppercase tracking-widest mb-4">
                <Banknote className="w-4 h-4" /> Synthèse chaussée
              </h3>
              <SummaryLine label="Coût matériaux" value={`${fmt(results.coutMateriaux)} ${currency}`} />
              <SummaryLine label="Coût pose" value={`${fmt(results.coutPose)} ${currency}`} />
              <SummaryLine label="Couches ajoutées" value={`${results.couchesCalc.length} u`} />
              <div className="mt-4 pt-4 border-t border-purple-500/20 flex items-center justify-between">
                <span className="text-xs font-black uppercase text-purple-300">Total chaussée</span>
                <span className="text-xl font-black text-white">{fmt(results.total)} {currency}</span>
              </div>
              <button
                onClick={handleSave}
                className="mt-5 w-full bg-purple-600 hover:bg-purple-500 text-white py-4 rounded-xl font-bold shadow-lg transition-all flex justify-center items-center gap-2 active:scale-95"
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
      className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all font-mono text-sm"
      placeholder={placeholder || "0"}
    />
  </div>
);

const ResultCard = ({ label, value, unit, icon, accent = false }) => (
  <div className={`rounded-2xl p-4 text-center border ${accent ? "bg-purple-500/10 border-purple-500/30" : "bg-gray-800/70 border-gray-700"}`}>
    <span className="text-[10px] text-gray-500 uppercase font-bold mb-1 flex items-center justify-center gap-1">
      {icon} {label}
    </span>
    <span className={`text-xl font-black ${accent ? "text-purple-300" : "text-white"}`}>
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
