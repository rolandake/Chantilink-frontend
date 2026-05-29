import React, { useEffect, useMemo, useState } from "react";
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import {
  Banknote,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Hammer,
  HardHat,
  Plus,
  Ruler,
  Save,
  Trash2,
  Wrench,
} from "lucide-react";
import usePersistentState from "../../../../hooks/usePersistentState";
import { useProjectStore } from "../../../../store/useProjectStore";

ChartJS.register(ArcElement, Tooltip, Legend);

const INTERVENTIONS = {
  demolition: {
    label: "Démolition / curage",
    unit: "m³",
    auto: "volume",
    color: "#ef4444",
    dot: "bg-red-500",
  },
  scarification: {
    label: "Scarification chaussée",
    unit: "m²",
    auto: "surface",
    color: "#f97316",
    dot: "bg-orange-500",
  },
  reprofilage: {
    label: "Reprofilage / rechargement",
    unit: "m²",
    auto: "surface",
    color: "#fb923c",
    dot: "bg-orange-400",
  },
  reprise_chaussee: {
    label: "Reprise de chaussée",
    unit: "m²",
    auto: "surface",
    color: "#a855f7",
    dot: "bg-purple-500",
  },
  assainissement: {
    label: "Curage / réparation assainissement",
    unit: "ml",
    auto: "longueur",
    color: "#3b82f6",
    dot: "bg-blue-500",
  },
  signalisation: {
    label: "Remise à niveau signalisation",
    unit: "u",
    auto: "signalisation",
    color: "#eab308",
    dot: "bg-yellow-500",
  },
  divers: {
    label: "Divers / finitions",
    unit: "u",
    auto: null,
    color: "#6b7280",
    dot: "bg-gray-500",
  },
};

const CATEGORY_KEYS = {
  demolition: "coutDemolition",
  scarification: "coutChaussee",
  reprofilage: "coutChaussee",
  reprise_chaussee: "coutChaussee",
  assainissement: "coutAssainissement",
  signalisation: "coutSignalisation",
  divers: "coutDivers",
};

const fmt = (value, decimals = 0) =>
  Number(value || 0).toLocaleString("fr-FR", { maximumFractionDigits: decimals });
const fmtD = (value) => Number(value || 0).toFixed(2);
const num = (value) => Number.parseFloat(value) || 0;

const defaultIntervention = (type = "reprise_chaussee") => ({
  id: Date.now() + Math.random(),
  type,
  description: "",
  quantite: "",
  prixUnitaire: "",
  forfait: "",
  expanded: true,
});

const normalizeIntervention = (item) => {
  const type = INTERVENTIONS[item?.type] ? item.type : "reprise_chaussee";
  return { ...defaultIntervention(type), ...(item || {}), type };
};

const autoQuantityFor = (type, refs) => {
  const auto = INTERVENTIONS[type]?.auto;
  if (auto === "surface") return refs.surface;
  if (auto === "longueur") return refs.longueur;
  if (auto === "volume") return refs.volume;
  if (auto === "signalisation") return refs.signalisation;
  return 0;
};

const computeIntervention = (item, refs) => {
  const config = INTERVENTIONS[item.type] || INTERVENTIONS.reprise_chaussee;
  const quantite = num(item.quantite) || autoQuantityFor(item.type, refs);
  const montantQuantite = quantite * num(item.prixUnitaire);
  const total = montantQuantite + num(item.forfait);
  return { ...item, config, quantiteEffective: quantite, montantQuantite, total };
};

export default function Rehabilitation({ currency = "XOF", onCostChange, onMateriauxChange }) {
  const terrassement = useProjectStore((state) => state.subResults.terrassement);
  const chaussee = useProjectStore((state) => state.subResults.chaussee);
  const hydraulique = useProjectStore((state) => state.subResults.ouvragesHydrauliques);
  const signalisation = useProjectStore((state) => state.subResults.signalisation);
  const setGlobalResults = useProjectStore((state) => state.setResults);
  const setGlobalMaterials = useProjectStore((state) => state.setMaterials);
  const setGlobalCost = useProjectStore((state) => state.setCost);

  const [itemsRaw, setItemsRaw] = usePersistentState("tp:rehabilitation:interventions", [defaultIntervention("reprise_chaussee")]);
  const [newType, setNewType] = usePersistentState("tp:rehabilitation:newType", "reprise_chaussee");
  const [message, setMessage] = useState(null);

  const items = useMemo(() => (
    Array.isArray(itemsRaw) && itemsRaw.length ? itemsRaw.map(normalizeIntervention) : [defaultIntervention("reprise_chaussee")]
  ), [itemsRaw]);

  const refs = useMemo(() => ({
    longueur: chaussee?.longueur || terrassement?.longueurReference || 0,
    surface: chaussee?.surface || terrassement?.surfacePlateforme || 0,
    volume: terrassement?.totalDeblai || terrassement?.totalFoisonne || 0,
    signalisation: signalisation?.quantiteSignalisation || 0,
    hydraulique: hydraulique?.volume || 0,
  }), [
    chaussee?.longueur,
    chaussee?.surface,
    terrassement?.longueurReference,
    terrassement?.surfacePlateforme,
    terrassement?.totalDeblai,
    terrassement?.totalFoisonne,
    signalisation?.quantiteSignalisation,
    hydraulique?.volume,
  ]);

  const results = useMemo(() => {
    const interventionsCalc = items.map((item) => computeIntervention(item, refs));
    const byCategory = {
      coutDemolition: 0,
      coutChaussee: 0,
      coutAssainissement: 0,
      coutSignalisation: 0,
      coutDivers: 0,
    };

    interventionsCalc.forEach((item) => {
      const key = CATEGORY_KEYS[item.type] || "coutDivers";
      byCategory[key] += item.total;
    });

    return {
      interventionsCalc,
      byCategory,
      total: interventionsCalc.reduce((sum, item) => sum + item.total, 0),
      quantiteTotale: interventionsCalc.reduce((sum, item) => sum + item.quantiteEffective, 0),
    };
  }, [items, refs]);

  useEffect(() => {
    const materials = {
      nbTaches: results.interventionsCalc.length,
      quantiteRehabilitation: results.quantiteTotale,
      ...results.byCategory,
    };

    onCostChange?.(results.total);
    onMateriauxChange?.(materials);
    setGlobalCost("rehabilitation", results.total);
    setGlobalMaterials("rehabilitation", materials);
    setGlobalResults("rehabilitation", {
      nbTaches: results.interventionsCalc.length,
      total: results.total,
      quantiteTotale: results.quantiteTotale,
      references: refs,
      ...results.byCategory,
    });
  }, [results, refs, onCostChange, onMateriauxChange, setGlobalCost, setGlobalMaterials, setGlobalResults]);

  const updateItem = (id, patch) => setItemsRaw((prev) => (Array.isArray(prev) ? prev : []).map((item) => (
    item.id === id ? { ...item, ...patch } : item
  )));
  const addItem = () => setItemsRaw((prev) => [...(Array.isArray(prev) ? prev : []), defaultIntervention(newType)]);
  const removeItem = (id) => setItemsRaw((prev) => (Array.isArray(prev) ? prev : []).filter((item) => item.id !== id));

  const showToast = (text, type = "success") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 2500);
  };

  const handleSave = () => {
    if (results.total <= 0) return showToast("Aucune intervention chiffrée", "error");
    showToast("Réhabilitation ajoutée à la synthèse");
  };

  const chartData = {
    labels: ["Démolition", "Chaussée", "Assainissement", "Signalisation", "Divers"],
    datasets: [{
      data: [
        results.byCategory.coutDemolition,
        results.byCategory.coutChaussee,
        results.byCategory.coutAssainissement,
        results.byCategory.coutSignalisation,
        results.byCategory.coutDivers,
      ],
      backgroundColor: ["#ef4444", "#f97316", "#3b82f6", "#eab308", "#6b7280"],
      borderColor: "#111827",
      borderWidth: 2,
    }],
  };

  return (
    <div className="w-full h-full flex flex-col bg-gray-900 text-gray-100 overflow-hidden relative font-sans">
      {message && (
        <div className={`fixed top-4 right-4 px-5 py-3 rounded-xl shadow-2xl z-50 font-bold ${
          message.type === "error" ? "bg-red-600" : "bg-green-600"
        }`}>
          {message.text}
        </div>
      )}

      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-500/20 rounded-lg text-green-400">
            <Wrench className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white uppercase tracking-tight">Réhabilitation</h2>
            <p className="text-xs text-gray-400 font-medium">Maintenance, reprises et réparations TP</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-gray-500 uppercase font-bold block">Total estimé</span>
          <span className="text-2xl font-black text-green-400 tracking-tighter">
            {fmt(results.total)} <span className="text-sm text-gray-500 font-normal">{currency}</span>
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-6 pb-24">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <div className="xl:col-span-7 space-y-5">
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5">
              <h3 className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
                <Plus className="w-4 h-4" /> Ajouter une intervention
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
                <select
                  value={newType}
                  onChange={(event) => setNewType(event.target.value)}
                  className="bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-green-500"
                >
                  {Object.entries(INTERVENTIONS).map(([key, item]) => (
                    <option key={key} value={key}>{item.label}</option>
                  ))}
                </select>
                <button onClick={addItem} className="bg-green-600 hover:bg-green-500 text-white px-5 py-3 rounded-xl font-bold flex items-center justify-center gap-2">
                  <Plus className="w-4 h-4" /> Ajouter
                </button>
              </div>
              <p className="mt-3 text-xs text-green-200/70">
                Références disponibles : {refs.surface ? `${fmtD(refs.surface)} m²` : "—"} | {refs.longueur ? `${fmtD(refs.longueur)} ml` : "—"} | {refs.volume ? `${fmtD(refs.volume)} m³` : "—"}
              </p>
            </div>

            {results.interventionsCalc.map((item) => (
              <div key={item.id} className="border border-gray-700 rounded-2xl overflow-hidden bg-gray-800/40">
                <div className="p-4 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => updateItem(item.id, { expanded: !item.expanded })}
                    className="flex items-center gap-3 text-left min-w-0"
                  >
                    <div className="p-2 bg-gray-950/50 rounded-xl">
                      <Hammer className="w-5 h-5" style={{ color: item.config.color }} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-black text-white truncate">{item.description || item.config.label}</p>
                      <p className="text-xs text-gray-400">
                        {fmtD(item.quantiteEffective)} {item.config.unit} | {fmt(item.total)} {currency}
                      </p>
                    </div>
                  </button>
                  <div className="flex items-center gap-2">
                    <button onClick={() => removeItem(item.id)} className="p-2 rounded-lg text-red-400 hover:bg-red-500/10" aria-label="Supprimer">
                      <Trash2 className="w-4 h-4" />
                    </button>
                    {item.expanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                  </div>
                </div>

                {item.expanded && (
                  <div className="p-4 border-t border-gray-700/60 bg-gray-950/30">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <InputGroup label="Description" type="text" value={item.description} onChange={(value) => updateItem(item.id, { description: value })} placeholder="Ex: reprise nid de poule PK10" />
                      <InputGroup label={`Quantité (${item.config.unit})`} value={item.quantite} onChange={(value) => updateItem(item.id, { quantite: value })} placeholder={fmtD(autoQuantityFor(item.type, refs))} />
                      <InputGroup label={`Prix unitaire (${currency}/${item.config.unit})`} value={item.prixUnitaire} onChange={(value) => updateItem(item.id, { prixUnitaire: value })} />
                      <InputGroup label={`Forfait (${currency})`} value={item.forfait} onChange={(value) => updateItem(item.id, { forfait: value })} />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="xl:col-span-5 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <ResultCard label="Interventions" value={results.interventionsCalc.length} unit="u" icon={<ClipboardList className="w-4 h-4" />} />
              <ResultCard label="Quantités" value={fmt(results.quantiteTotale, 2)} unit="u/ml/m²" icon={<Ruler className="w-4 h-4" />} />
              <ResultCard label="Moyenne" value={fmt(results.total / (results.interventionsCalc.length || 1))} unit={currency} icon={<Banknote className="w-4 h-4" />} />
              <ResultCard label="Poste principal" value={results.total > 0 ? "Mixte" : "-"} unit="" icon={<HardHat className="w-4 h-4" />} accent />
            </div>

            <div className="bg-gray-800 rounded-3xl p-6 border border-gray-700 shadow-xl">
              <div className="w-48 h-48 mx-auto relative">
                <Doughnut data={chartData} options={{ cutout: "72%", plugins: { legend: { display: false } } }} />
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[10px] text-gray-500 uppercase font-bold">Budget</span>
                  <span className="text-sm font-bold text-white">{fmt(results.total)} {currency}</span>
                </div>
              </div>
              <div className="mt-6 space-y-3">
                {Object.entries(results.byCategory).map(([key, value]) => {
                  if (!value) return null;
                  const label = {
                    coutDemolition: "Démolition / curage",
                    coutChaussee: "Chaussée",
                    coutAssainissement: "Assainissement",
                    coutSignalisation: "Signalisation",
                    coutDivers: "Divers",
                  }[key];
                  return <MaterialRow key={key} label={label} value={`${fmt(value)} ${currency}`} color="bg-green-500" />;
                })}
                {results.total === 0 && <p className="text-center text-xs text-gray-500">Les coûts apparaîtront selon les interventions ajoutées.</p>}
              </div>
            </div>

            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5">
              <h3 className="flex items-center gap-2 text-xs font-bold text-green-300 uppercase tracking-widest mb-4">
                <Banknote className="w-4 h-4" /> Synthèse réhabilitation
              </h3>
              <SummaryLine label="Démolition / curage" value={`${fmt(results.byCategory.coutDemolition)} ${currency}`} />
              <SummaryLine label="Reprise chaussée" value={`${fmt(results.byCategory.coutChaussee)} ${currency}`} />
              <SummaryLine label="Assainissement" value={`${fmt(results.byCategory.coutAssainissement)} ${currency}`} />
              <SummaryLine label="Signalisation" value={`${fmt(results.byCategory.coutSignalisation)} ${currency}`} />
              <div className="mt-4 pt-4 border-t border-green-500/20 flex items-center justify-between">
                <span className="text-xs font-black uppercase text-green-300">Total réhabilitation</span>
                <span className="text-xl font-black text-white">{fmt(results.total)} {currency}</span>
              </div>
              <button
                onClick={handleSave}
                className="mt-5 w-full bg-green-600 hover:bg-green-500 text-white py-4 rounded-xl font-bold shadow-lg transition-all flex justify-center items-center gap-2 active:scale-95"
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
    <label className="mb-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-wide">{label}</label>
    <input
      type={type}
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value)}
      className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none transition-all font-mono text-sm"
      placeholder={placeholder || "0"}
    />
  </div>
);

const ResultCard = ({ label, value, unit, icon, accent = false }) => (
  <div className={`rounded-2xl p-4 text-center border ${accent ? "bg-green-500/10 border-green-500/30" : "bg-gray-800/70 border-gray-700"}`}>
    <span className="text-[10px] text-gray-500 uppercase font-bold mb-1 flex items-center justify-center gap-1">
      {icon} {label}
    </span>
    <span className={`text-xl font-black ${accent ? "text-green-300" : "text-white"}`}>
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
