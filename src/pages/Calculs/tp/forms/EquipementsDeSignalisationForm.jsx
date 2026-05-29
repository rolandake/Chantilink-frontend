import React, { useEffect, useMemo, useState } from "react";
import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS, ArcElement, Tooltip, Legend,
} from "chart.js";
import {
  AlertTriangle,
  Banknote,
  ChevronDown,
  ChevronUp,
  Construction,
  Hammer,
  Lightbulb,
  MapPin,
  Package,
  Plus,
  Ruler,
  Save,
  Shield,
  Target,
  TrafficCone,
  Trash2,
} from "lucide-react";
import usePersistentState from "../../../../hooks/usePersistentState";
import { useProjectStore } from "../../../../store/useProjectStore";

ChartJS.register(ArcElement, Tooltip, Legend);

const EQUIPMENT_CONFIG = {
  panneaux: {
    label: "Panneaux",
    icon: AlertTriangle,
    unit: "u",
    color: "#f59e0b",
    dot: "bg-amber-500",
    desc: "Signalisation verticale",
  },
  feux: {
    label: "Feux tricolores",
    icon: Lightbulb,
    unit: "u",
    color: "#ef4444",
    dot: "bg-red-500",
    desc: "Gestion de trafic",
  },
  glissieres: {
    label: "Glissières",
    icon: Shield,
    unit: "ml",
    color: "#64748b",
    dot: "bg-slate-500",
    poidsML: 20,
    autoKey: "longueur",
    desc: "Dispositif de retenue acier",
  },
  marquage: {
    label: "Marquage sol",
    icon: Construction,
    unit: "m²",
    color: "#fbbf24",
    dot: "bg-yellow-400",
    consoKgM2: 0.7,
    autoKey: "surface",
    desc: "Signalisation horizontale",
  },
  bornes: {
    label: "Bornes / PK",
    icon: MapPin,
    unit: "u",
    color: "#ec4899",
    dot: "bg-pink-500",
    desc: "Balisage et kilométrage",
  },
  divers: {
    label: "Divers",
    icon: TrafficCone,
    unit: "u",
    color: "#10b981",
    dot: "bg-emerald-500",
    desc: "Équipements spécifiques",
  },
};

const fmt = (value, decimals = 0) =>
  Number(value || 0).toLocaleString("fr-FR", { maximumFractionDigits: decimals });
const fmtD = (value) => Number(value || 0).toFixed(2);
const num = (value) => Number.parseFloat(value) || 0;

const defaultLigne = (type = "panneaux") => ({
  id: Date.now() + Math.random(),
  type,
  label: "",
  quantite: "",
  coutUnitaire: "",
  coutMainOeuvre: "",
  dimension: "",
  marge: "5",
  expanded: true,
});

const normalizeLigne = (ligne) => {
  const type = EQUIPMENT_CONFIG[ligne?.type] ? ligne.type : "panneaux";
  return { ...defaultLigne(type), ...(ligne || {}), type };
};

const computeLigne = (ligne, references) => {
  const config = EQUIPMENT_CONFIG[ligne.type] || EQUIPMENT_CONFIG.panneaux;
  const autoQuantity = config.autoKey === "surface" ? references.surface : references.longueur;
  const quantite = num(ligne.quantite) || (config.autoKey ? autoQuantity : 0);
  const marge = 1 + num(ligne.marge) / 100;
  const totalFourniture = quantite * num(ligne.coutUnitaire) * marge;
  const totalPose = quantite * num(ligne.coutMainOeuvre);
  const total = totalFourniture + totalPose;

  let poidsLogistique = 0;
  let peintureKg = 0;
  let acierKg = 0;

  if (ligne.type === "marquage") {
    peintureKg = quantite * (config.consoKgM2 || 0) * marge;
    poidsLogistique = peintureKg / 1000;
  }
  if (ligne.type === "glissieres") {
    acierKg = quantite * (config.poidsML || 0) * marge;
    poidsLogistique = acierKg / 1000;
  }

  return {
    ...ligne,
    config,
    quantiteEffective: quantite,
    totalFourniture,
    totalPose,
    total,
    peintureKg,
    acierKg,
    poidsLogistique,
  };
};

export default function EquipementsDeSignalisationForm({ currency = "XOF", onCostChange, onMateriauxChange }) {
  const terrassement = useProjectStore((state) => state.subResults.terrassement);
  const chaussee = useProjectStore((state) => state.subResults.chaussee);
  const setGlobalResults = useProjectStore((state) => state.setResults);
  const setGlobalMaterials = useProjectStore((state) => state.setMaterials);
  const setGlobalCost = useProjectStore((state) => state.setCost);

  const [lignesRaw, setLignesRaw] = usePersistentState("tp:signalisation:lignes", [defaultLigne("panneaux")]);
  const [newType, setNewType] = usePersistentState("tp:signalisation:newType", "panneaux");
  const [message, setMessage] = useState(null);

  const lignes = useMemo(() => (
    Array.isArray(lignesRaw) && lignesRaw.length ? lignesRaw.map(normalizeLigne) : [defaultLigne("panneaux")]
  ), [lignesRaw]);

  const references = useMemo(() => ({
    longueur: chaussee?.longueur || terrassement?.longueurReference || 0,
    surface: chaussee?.surface || terrassement?.surfacePlateforme || 0,
  }), [chaussee?.longueur, chaussee?.surface, terrassement?.longueurReference, terrassement?.surfacePlateforme]);

  const results = useMemo(() => {
    const lignesCalc = lignes.map((ligne) => computeLigne(ligne, references));
    return lignesCalc.reduce((acc, ligne) => ({
      lignesCalc,
      quantiteSignalisation: acc.quantiteSignalisation + ligne.quantiteEffective,
      poidsLogistique: acc.poidsLogistique + ligne.poidsLogistique,
      peintureKg: acc.peintureKg + ligne.peintureKg,
      acierKg: acc.acierKg + ligne.acierKg,
      coutFourniture: acc.coutFourniture + ligne.totalFourniture,
      coutPose: acc.coutPose + ligne.totalPose,
      total: acc.total + ligne.total,
    }), {
      lignesCalc,
      quantiteSignalisation: 0,
      poidsLogistique: 0,
      peintureKg: 0,
      acierKg: 0,
      coutFourniture: 0,
      coutPose: 0,
      total: 0,
    });
  }, [lignes, references]);

  useEffect(() => {
    const materials = {
      quantiteSignalisation: results.quantiteSignalisation,
      poidsLogistique: results.poidsLogistique,
      peintureKg: results.peintureKg,
      acierSignalisationKg: results.acierKg,
      coutFourniture: results.coutFourniture,
      coutPose: results.coutPose,
    };

    onCostChange?.(results.total);
    onMateriauxChange?.(materials);
    setGlobalCost("signalisation", results.total);
    setGlobalMaterials("signalisation", materials);
    setGlobalResults("signalisation", {
      nbLignes: results.lignesCalc.length,
      longueurReference: references.longueur,
      surfaceReference: references.surface,
      quantiteSignalisation: results.quantiteSignalisation,
      poidsLogistique: results.poidsLogistique,
      peintureKg: results.peintureKg,
      acierKg: results.acierKg,
    });
  }, [results, references.longueur, references.surface, onCostChange, onMateriauxChange, setGlobalCost, setGlobalMaterials, setGlobalResults]);

  const updateLigne = (id, patch) => setLignesRaw((prev) => (Array.isArray(prev) ? prev : []).map((ligne) => (
    ligne.id === id ? { ...ligne, ...patch } : ligne
  )));
  const addLigne = () => setLignesRaw((prev) => [...(Array.isArray(prev) ? prev : []), defaultLigne(newType)]);
  const removeLigne = (id) => setLignesRaw((prev) => (Array.isArray(prev) ? prev : []).filter((ligne) => ligne.id !== id));

  const showToast = (msg, type = "success") => {
    setMessage({ text: msg, type });
    setTimeout(() => setMessage(null), 2500);
  };

  const handleSave = () => {
    if (results.total <= 0) return showToast("Saisie incomplète", "error");
    showToast("Signalisation ajoutée à la synthèse");
  };

  const chartData = {
    labels: ["Fourniture", "Pose"],
    datasets: [{
      data: [results.coutFourniture, results.coutPose],
      backgroundColor: ["#f97316", "#2563eb"],
      borderColor: "#111827",
      borderWidth: 2,
    }],
  };

  return (
    <div className="w-full h-full flex flex-col bg-gray-900 text-gray-100 overflow-hidden relative font-sans">
      {message && (
        <div className={`fixed top-4 right-4 px-5 py-3 rounded-xl shadow-2xl z-50 font-bold ${
          message.type === "error" ? "bg-red-600" : "bg-orange-600"
        }`}>
          {message.text}
        </div>
      )}

      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-500/20 rounded-lg text-orange-400">
            <TrafficCone className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white uppercase tracking-tight">Signalisation & Sécurité</h2>
            <p className="text-xs text-gray-400 font-medium">Équipements, marquage et balisage</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-gray-500 uppercase font-bold block">Budget estimé</span>
          <span className="text-2xl font-black text-orange-400 tracking-tighter">
            {fmt(results.total)} <span className="text-sm text-gray-500 font-normal">{currency}</span>
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-6 pb-24">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <div className="xl:col-span-7 space-y-5">
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5">
              <h3 className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
                <Plus className="w-4 h-4" /> Ajouter une ligne
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
                <select
                  value={newType}
                  onChange={(event) => setNewType(event.target.value)}
                  className="bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-orange-500"
                >
                  {Object.entries(EQUIPMENT_CONFIG).map(([key, cfg]) => (
                    <option key={key} value={key}>{cfg.label}</option>
                  ))}
                </select>
                <button
                  onClick={addLigne}
                  className="bg-orange-600 hover:bg-orange-500 text-white px-5 py-3 rounded-xl font-bold flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Ajouter
                </button>
              </div>
              {(references.longueur > 0 || references.surface > 0) && (
                <p className="mt-3 text-xs text-orange-200/70">
                  Références projet : {references.longueur > 0 ? `${fmtD(references.longueur)} ml` : "—"} | {references.surface > 0 ? `${fmtD(references.surface)} m²` : "—"}
                </p>
              )}
            </div>

            {results.lignesCalc.map((ligne) => {
              const Icon = ligne.config.icon;
              return (
                <div key={ligne.id} className="border border-gray-700 rounded-2xl overflow-hidden bg-gray-800/40">
                  <div className="p-4 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => updateLigne(ligne.id, { expanded: !ligne.expanded })}
                      className="flex items-center gap-3 text-left min-w-0"
                    >
                      <div className="p-2 bg-gray-950/50 rounded-xl">
                        <Icon className="w-5 h-5" style={{ color: ligne.config.color }} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-black text-white truncate">{ligne.label || ligne.config.label}</p>
                        <p className="text-xs text-gray-400">
                          {fmtD(ligne.quantiteEffective)} {ligne.config.unit} | {fmt(ligne.total)} {currency}
                        </p>
                      </div>
                    </button>
                    <div className="flex items-center gap-2">
                      <button onClick={() => removeLigne(ligne.id)} className="p-2 rounded-lg text-red-400 hover:bg-red-500/10" aria-label="Supprimer">
                        <Trash2 className="w-4 h-4" />
                      </button>
                      {ligne.expanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                    </div>
                  </div>

                  {ligne.expanded && (
                    <div className="p-4 border-t border-gray-700/60 bg-gray-950/30">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <InputGroup label="Nom / repère" type="text" value={ligne.label} onChange={(value) => updateLigne(ligne.id, { label: value })} />
                        <InputGroup
                          label={`Quantité (${ligne.config.unit})`}
                          value={ligne.quantite}
                          onChange={(value) => updateLigne(ligne.id, { quantite: value })}
                          placeholder={ligne.config.autoKey === "surface" ? fmtD(references.surface) : ligne.config.autoKey === "longueur" ? fmtD(references.longueur) : "0"}
                        />
                        <InputGroup label="Marge perte (%)" value={ligne.marge} onChange={(value) => updateLigne(ligne.id, { marge: value })} />
                        {ligne.type === "panneaux" && (
                          <InputGroup label="Dimensions panneau" type="text" value={ligne.dimension} onChange={(value) => updateLigne(ligne.id, { dimension: value })} placeholder="80x80" />
                        )}
                        <InputGroup label={`PU achat (${currency})`} value={ligne.coutUnitaire} onChange={(value) => updateLigne(ligne.id, { coutUnitaire: value })} />
                        <InputGroup label={`PU pose (${currency})`} value={ligne.coutMainOeuvre} onChange={(value) => updateLigne(ligne.id, { coutMainOeuvre: value })} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="xl:col-span-5 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <ResultCard label="Fourniture" value={fmt(results.coutFourniture)} unit={currency} icon={<Package className="w-4 h-4" />} accent />
              <ResultCard label="Pose" value={fmt(results.coutPose)} unit={currency} icon={<Hammer className="w-4 h-4" />} />
              <ResultCard label="Masse" value={fmt(results.poidsLogistique, 2)} unit="t" icon={<Ruler className="w-4 h-4" />} />
              <ResultCard label="Lignes" value={results.lignesCalc.length} unit="u" icon={<Target className="w-4 h-4" />} />
            </div>

            <div className="bg-gray-800 rounded-3xl p-6 border border-gray-700 shadow-xl">
              <div className="w-48 h-48 mx-auto relative">
                <Doughnut data={chartData} options={{ cutout: "72%", plugins: { legend: { display: false } } }} />
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[10px] text-gray-500 uppercase font-bold">Coût</span>
                  <span className="text-sm font-bold text-white">{fmt(results.total)} {currency}</span>
                </div>
              </div>
              <div className="mt-6 space-y-3">
                <MaterialRow label="Peinture / marquage" value={`${fmt(results.peintureKg, 2)} kg`} color="bg-yellow-400" />
                <MaterialRow label="Acier glissières" value={`${fmt(results.acierKg, 2)} kg`} color="bg-slate-500" />
                <MaterialRow label="Masse logistique" value={`${fmt(results.poidsLogistique, 3)} t`} color="bg-blue-500" />
              </div>
            </div>

            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5">
              <h3 className="flex items-center gap-2 text-xs font-bold text-orange-300 uppercase tracking-widest mb-4">
                <Banknote className="w-4 h-4" /> Synthèse signalisation
              </h3>
              <SummaryLine label="Quantité totale" value={`${fmt(results.quantiteSignalisation, 2)} u/ml/m²`} />
              <SummaryLine label="Fourniture" value={`${fmt(results.coutFourniture)} ${currency}`} />
              <SummaryLine label="Pose" value={`${fmt(results.coutPose)} ${currency}`} />
              <div className="mt-4 pt-4 border-t border-orange-500/20 flex items-center justify-between">
                <span className="text-xs font-black uppercase text-orange-300">Total signalisation</span>
                <span className="text-xl font-black text-white">{fmt(results.total)} {currency}</span>
              </div>
              <button
                onClick={handleSave}
                className="mt-5 w-full bg-orange-600 hover:bg-orange-500 text-white py-4 rounded-xl font-bold shadow-lg transition-all flex justify-center items-center gap-2 active:scale-95"
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
      className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all font-mono text-sm"
      placeholder={placeholder || "0"}
    />
  </div>
);

const ResultCard = ({ label, value, unit, icon, accent = false }) => (
  <div className={`rounded-2xl p-4 text-center border ${accent ? "bg-orange-500/10 border-orange-500/30" : "bg-gray-800/70 border-gray-700"}`}>
    <span className="text-[10px] text-gray-500 uppercase font-bold mb-1 flex items-center justify-center gap-1">
      {icon} {label}
    </span>
    <span className={`text-xl font-black ${accent ? "text-orange-300" : "text-white"}`}>
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
