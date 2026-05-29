import React, { useEffect, useMemo, useState } from "react";
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import {
  Anchor,
  ChevronDown,
  ChevronUp,
  Droplets,
  Leaf,
  Plus,
  Ruler,
  Trash2,
} from "lucide-react";
import usePersistentState from "../../../../hooks/usePersistentState";
import { useProjectStore } from "../../../../store/useProjectStore";

ChartJS.register(ArcElement, Tooltip, Legend);

const DOSAGE_ECO = {
  ciment: 0.30,
  sable: 0.60,
  gravier: 0.80,
  eau: 170,
};

const DOSAGE_PROPRETE = {
  ciment: 0.15,
  sable: 0.65,
  gravier: 0.90,
  eau: 160,
};

const TYPES_FONDATION = {
  FILANTE: {
    label: "Béton bas carbone linéaire",
    icon: "📏",
    acier: 45,
    fields: [
      { key: "longueur", label: "Longueur (m)" },
      { key: "largeur", label: "Largeur (m)" },
      { key: "hauteur", label: "Hauteur (m)" },
    ],
    compute: (f) => f("longueur") * f("largeur") * f("hauteur"),
    coffrage: (f) => 2 * f("longueur") * f("hauteur"),
    support: (f) => f("longueur") * f("largeur"),
  },
  ISOLEE: {
    label: "Éléments béton ponctuels",
    icon: "🟦",
    acier: 70,
    needsCount: true,
    fields: [
      { key: "nombre", label: "Nombre" },
      { key: "longueur", label: "Longueur (m)" },
      { key: "largeur", label: "Largeur (m)" },
      { key: "hauteur", label: "Hauteur (m)" },
    ],
    compute: (f) => f("nombre") * f("longueur") * f("largeur") * f("hauteur"),
    coffrage: (f) => f("nombre") * 2 * (f("longueur") + f("largeur")) * f("hauteur"),
    support: (f) => f("nombre") * f("longueur") * f("largeur"),
  },
  LONGRINE: {
    label: "Béton armé optimisé",
    icon: "➖",
    acier: 80,
    fields: [
      { key: "longueur", label: "Longueur totale (m)" },
      { key: "largeur", label: "Largeur (m)" },
      { key: "hauteur", label: "Hauteur (m)" },
    ],
    compute: (f) => f("longueur") * f("largeur") * f("hauteur"),
    coffrage: (f) => 2 * f("longueur") * f("hauteur"),
    support: (f) => f("longueur") * f("largeur"),
  },
  RADIER: {
    label: "Béton bas carbone surfacique",
    icon: "▣",
    acier: 90,
    fields: [
      { key: "surface", label: "Surface (m²)" },
      { key: "hauteur", label: "Épaisseur (m)" },
    ],
    compute: (f) => f("surface") * f("hauteur"),
    coffrage: (f) => Math.sqrt(f("surface")) * 4 * f("hauteur"),
    support: (f) => f("surface"),
  },
  MASSIF: {
    label: "Masses béton optimisées",
    icon: "⬛",
    acier: 55,
    needsCount: true,
    fields: [
      { key: "nombre", label: "Nombre" },
      { key: "longueur", label: "Longueur (m)" },
      { key: "largeur", label: "Largeur (m)" },
      { key: "hauteur", label: "Hauteur (m)" },
    ],
    compute: (f) => f("nombre") * f("longueur") * f("largeur") * f("hauteur"),
    coffrage: (f) => f("nombre") * 2 * (f("longueur") + f("largeur")) * f("hauteur"),
    support: (f) => f("nombre") * f("longueur") * f("largeur"),
  },
};

const fmt = (value, decimals = 0) =>
  Number(value || 0).toLocaleString("fr-FR", { maximumFractionDigits: decimals });
const fmtD = (value, decimals = 2) => Number(value || 0).toFixed(decimals);
const num = (value) => Number.parseFloat(value) || 0;
const fieldReader = (fields) => (key) => num(fields?.[key]);

const defaultOuvrage = (type = "FILANTE") => ({
  id: Date.now() + Math.random(),
  type,
  label: "",
  fields: type === "ISOLEE" || type === "MASSIF" ? { nombre: "1" } : {},
  ratioAcier: String(TYPES_FONDATION[type]?.acier || 60),
  marge: "8",
  prixBeton: "",
  prixCoffrage: "",
  prixAcier: "",
  mainOeuvre: "",
  proprete: true,
  epaisseurProprete: "0.05",
  expanded: true,
});

export default function FondationEco({
  currency = "XOF",
  onTotalChange = () => {},
  onCostChange = () => {},
  onMateriauxChange = () => {},
  onMaterialsChange = () => {},
}) {
  const gestionTerres = useProjectStore((state) => state.subResults.ecoTerrassement);
  const setGlobalCost = useProjectStore((state) => state.setCost);
  const setGlobalMaterials = useProjectStore((state) => state.setMaterials);
  const setGlobalResults = useProjectStore((state) => state.setResults);

  const [ouvrages, setOuvrages] = usePersistentState("eco:fondation:ouvrages", [defaultOuvrage("FILANTE")]);
  const [newType, setNewType] = usePersistentState("eco:fondation:newType", "FILANTE");
  const [activeTab, setActiveTab] = useState("ouvrages");

  const autoSurface = gestionTerres?.surfacePlateforme || 0;
  const autoFields = useMemo(() => ({
    RADIER: { surface: autoSurface },
  }), [autoSurface]);

  const getEffectiveFields = (ouvrage) => {
    const fields = { ...(ouvrage.fields || {}) };
    Object.entries(autoFields[ouvrage.type] || {}).forEach(([key, value]) => {
      if ((fields[key] === undefined || fields[key] === "") && Number(value) > 0) {
        fields[key] = String(value);
      }
    });
    return fields;
  };

  const results = useMemo(() => {
    let volumeBeton = 0;
    let volumeProprete = 0;
    let surfaceSupport = 0;
    let surfaceCoffrage = 0;
    let acierKg = 0;
    let total = 0;

    const ouvragesCalc = ouvrages.map((ouvrage) => {
      const def = TYPES_FONDATION[ouvrage.type];
      if (!def) return { ...ouvrage, fields: ouvrage.fields || {}, volumeBeton: 0, total: 0 };
      const fields = getEffectiveFields(ouvrage);
      const marge = 1 + (num(ouvrage.marge) || 0) / 100;
      const volumeBrut = def.compute(fieldReader(fields));
      const volumeCommande = volumeBrut * marge;
      const support = def.support(fieldReader(fields));
      const coffrage = def.coffrage(fieldReader(fields));
      const proprete = ouvrage.proprete ? support * num(ouvrage.epaisseurProprete || 0.05) : 0;
      const ratioAcier = num(ouvrage.ratioAcier) || def.acier;
      const acier = volumeCommande * ratioAcier;

      const coutBeton = volumeCommande * num(ouvrage.prixBeton);
      const coutCoffrage = coffrage * num(ouvrage.prixCoffrage);
      const coutAcier = acier * num(ouvrage.prixAcier);
      const cout = coutBeton + coutCoffrage + coutAcier + num(ouvrage.mainOeuvre);

      volumeBeton += volumeCommande;
      volumeProprete += proprete;
      surfaceSupport += support;
      surfaceCoffrage += coffrage;
      acierKg += acier;
      total += cout;

      return {
        ...ouvrage,
        fields,
        volumeBrut,
        volumeBeton: volumeCommande,
        volumeProprete: proprete,
        surfaceSupport: support,
        surfaceCoffrage: coffrage,
        acierKg: acier,
        total: cout,
      };
    });

    const volumeTotal = volumeBeton + volumeProprete;
    const cimentT = volumeBeton * DOSAGE_ECO.ciment + volumeProprete * DOSAGE_PROPRETE.ciment;
    const sableT = volumeBeton * DOSAGE_ECO.sable + volumeProprete * DOSAGE_PROPRETE.sable;
    const gravierT = volumeBeton * DOSAGE_ECO.gravier + volumeProprete * DOSAGE_PROPRETE.gravier;
    const eauL = volumeBeton * DOSAGE_ECO.eau + volumeProprete * DOSAGE_PROPRETE.eau;

    return {
      ouvragesCalc,
      volumeBeton,
      volumeProprete,
      volumeTotal,
      surfaceSupport,
      surfaceCoffrage,
      acierKg,
      acierT: acierKg / 1000,
      cimentT,
      cimentSacs: Math.ceil((cimentT * 1000) / 50),
      sableT,
      gravierT,
      eauL,
      total,
    };
  }, [ouvrages, autoFields]);

  useEffect(() => {
    onTotalChange(results.total);
    onCostChange(results.total);
    const materials = {
      volume: results.volumeTotal,
      ciment: results.cimentT,
      sable: results.sableT,
      gravier: results.gravierT,
      acier: results.acierT,
      eau: results.eauL,
      coffrage: results.surfaceCoffrage,
    };
    onMateriauxChange(materials);
    onMaterialsChange(materials);
    setGlobalCost("ecoFondation", results.total);
    setGlobalMaterials("ecoFondation", materials);
    setGlobalResults("ecoFondation", {
      volumeBetonFondation: results.volumeBeton,
      volumeBetonProprete: results.volumeProprete,
      volumeTotal: results.volumeTotal,
      surfaceSupport: results.surfaceSupport,
      surfaceCoffrage: results.surfaceCoffrage,
      acierKg: results.acierKg,
      ouvrages: results.ouvragesCalc.map((ouvrage) => ({
        type: ouvrage.type,
        label: ouvrage.label || TYPES_FONDATION[ouvrage.type]?.label,
        volumeBeton: ouvrage.volumeBeton,
        surfaceCoffrage: ouvrage.surfaceCoffrage,
        acierKg: ouvrage.acierKg,
      })),
    });
  }, [results]);

  const updateOuvrage = (id, patch) => setOuvrages((prev) => prev.map((ouvrage) => (
    ouvrage.id === id ? { ...ouvrage, ...patch } : ouvrage
  )));
  const updateField = (id, key, value) => setOuvrages((prev) => prev.map((ouvrage) => (
    ouvrage.id === id ? { ...ouvrage, fields: { ...ouvrage.fields, [key]: value } } : ouvrage
  )));
  const addOuvrage = () => setOuvrages((prev) => [...prev, defaultOuvrage(newType)]);
  const removeOuvrage = (id) => setOuvrages((prev) => prev.filter((ouvrage) => ouvrage.id !== id));

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
    <div className="w-full h-full flex flex-col bg-gray-950 text-gray-100 overflow-hidden">
      <div className="flex-shrink-0 px-5 py-3 border-b border-gray-800 flex justify-between items-center bg-gray-900/70">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-500/20 rounded-xl text-red-300">
            <Leaf className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white leading-tight">Béton bas carbone</h2>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">
              Scénarios béton · matériaux recyclés · ciment réduit · CO2 évité
            </p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-gray-500 uppercase font-bold block">Coût total</span>
          <span className="text-xl font-black text-red-300 tracking-tight">
            {fmt(results.total)} <span className="text-xs text-gray-500 font-normal">{currency}</span>
          </span>
        </div>
      </div>

      <div className="flex-shrink-0 flex border-b border-gray-800 xl:hidden">
        {[["ouvrages", "Ouvrages"], ["synthese", "Synthèse"]].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider ${
              activeTab === key ? "text-red-300 border-b-2 border-red-300" : "text-gray-500"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-1 xl:grid-cols-12 min-h-full">
          <div className={`xl:col-span-7 p-4 lg:p-5 border-r border-gray-800/50 flex flex-col gap-3 ${activeTab !== "ouvrages" ? "hidden xl:flex" : "flex"}`}>
            {autoSurface > 0 && (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                <p className="text-[10px] text-emerald-300 uppercase font-bold tracking-widest">Donnée récupérée de la gestion des terres</p>
                <p className="mt-1 text-xs text-gray-300">Surface d'emprise disponible : <strong>{fmtD(autoSurface)} m²</strong>. Elle peut préremplir un scénario surfacique.</p>
              </div>
            )}

            {results.ouvragesCalc.map((ouvrage) => {
              const def = TYPES_FONDATION[ouvrage.type];
              return (
                <OuvrageCard
                  key={ouvrage.id}
                  ouvrage={ouvrage}
                  def={def}
                  currency={currency}
                  autoFields={autoFields[ouvrage.type] || {}}
                  onToggle={() => updateOuvrage(ouvrage.id, { expanded: !ouvrage.expanded })}
                  onRemove={() => removeOuvrage(ouvrage.id)}
                  onTypeChange={(type) => updateOuvrage(ouvrage.id, {
                    type,
                    fields: TYPES_FONDATION[type]?.needsCount ? { nombre: ouvrage.fields?.nombre || "1" } : {},
                    ratioAcier: String(TYPES_FONDATION[type]?.acier || ouvrage.ratioAcier),
                  })}
                  onLabelChange={(value) => updateOuvrage(ouvrage.id, { label: value })}
                  onPatch={(patch) => updateOuvrage(ouvrage.id, patch)}
                  onFieldChange={(key, value) => updateField(ouvrage.id, key, value)}
                />
              );
            })}

            <div className="bg-gray-900/40 border border-gray-700/50 rounded-2xl p-4">
              <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-3">Ajouter un scénario béton bas carbone</p>
              <select
                value={newType}
                onChange={(event) => setNewType(event.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-3 text-sm text-white focus:border-red-400"
              >
                {Object.entries(TYPES_FONDATION).map(([key, def]) => (
                  <option key={key} value={key}>{def.label}</option>
                ))}
              </select>
              <button
                onClick={addOuvrage}
                className="w-full mt-3 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 text-white py-3 rounded-xl font-bold text-sm"
              >
                <Plus className="w-4 h-4" /> Ajouter à la synthèse
              </button>
            </div>
          </div>

          <div className={`xl:col-span-5 p-4 lg:p-5 flex flex-col gap-4 ${activeTab !== "synthese" ? "hidden xl:flex" : "flex"}`}>
            <div className="grid grid-cols-2 gap-3">
              <KpiCard label="Béton BA" value={fmtD(results.volumeBeton)} unit="m³" color="text-red-300" />
              <KpiCard label="Béton propreté" value={fmtD(results.volumeProprete)} unit="m³" color="text-emerald-300" />
              <KpiCard label="Coffrage" value={fmtD(results.surfaceCoffrage)} unit="m²" color="text-indigo-300" />
              <KpiCard label="Acier" value={fmtD(results.acierKg, 0)} unit="kg" color="text-blue-300" />
            </div>

            <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-5">
              <div className="relative w-28 h-28 flex-shrink-0">
                <Doughnut data={chartData} options={{ cutout: "72%", plugins: { legend: { display: false } } }} />
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[9px] text-gray-500 uppercase">Volume</span>
                  <span className="text-[11px] font-bold text-white text-center leading-tight">{fmtD(results.volumeTotal)} m³</span>
                </div>
              </div>
              <div className="flex-1 w-full space-y-2">
                <MaterialRow label="Ciment bas carbone" value={`${fmtD(results.cimentT)} t · ${results.cimentSacs} sacs`} dot="bg-red-500" />
                <MaterialRow label="Sable recyclé" value={`${fmtD(results.sableT)} t`} dot="bg-amber-500" />
                <MaterialRow label="Gravier recyclé" value={`${fmtD(results.gravierT)} t`} dot="bg-stone-500" />
                <MaterialRow label="Acier" value={`${fmtD(results.acierKg, 0)} kg`} dot="bg-blue-500" />
                <MaterialRow label="Eau" value={`${fmtD(results.eauL, 0)} L`} dot="bg-cyan-500" />
              </div>
            </div>

            <div className="bg-gray-900/40 border border-gray-800/50 rounded-2xl overflow-hidden">
              <div className="px-4 py-2.5 bg-gray-900/70 border-b border-gray-800/50">
                <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Synthèse béton bas carbone</h4>
              </div>
              <SummaryRow label="Ouvrages" value={`${ouvrages.length} u`} />
              <SummaryRow label="Surface support" value={`${fmtD(results.surfaceSupport)} m²`} />
              <SummaryRow label="Volume béton BA" value={`${fmtD(results.volumeBeton)} m³`} />
              <SummaryRow label="Béton propreté" value={`${fmtD(results.volumeProprete)} m³`} />
              <SummaryRow label="Coffrage" value={`${fmtD(results.surfaceCoffrage)} m²`} />
              <SummaryRow label="Acier" value={`${fmtD(results.acierKg, 0)} kg`} />
              <SummaryRow label="Total" value={`${fmt(results.total)} ${currency}`} strong />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function OuvrageCard({
  ouvrage,
  def,
  currency,
  autoFields,
  onToggle,
  onRemove,
  onTypeChange,
  onLabelChange,
  onPatch,
  onFieldChange,
}) {
  return (
    <div className="border border-red-500/25 bg-red-500/10 rounded-2xl overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={onToggle}>
        <div className="p-1.5 rounded-lg bg-gray-900/60 text-red-300"><Anchor className="w-4 h-4" /></div>
        <div className="flex-1 min-w-0">
          <span className="text-[10px] font-bold uppercase tracking-widest text-red-300">{def?.label}</span>
          <p className="text-xs font-bold text-white truncate">{ouvrage.label || def?.label}</p>
        </div>
        <span className="text-xs font-bold text-white font-mono">{fmtD(ouvrage.volumeBeton)} m³</span>
        <button onClick={(event) => { event.stopPropagation(); onRemove(); }} className="text-gray-600 hover:text-red-400">
          <Trash2 className="w-4 h-4" />
        </button>
        {ouvrage.expanded ? <ChevronUp className="w-4 h-4 text-gray-600" /> : <ChevronDown className="w-4 h-4 text-gray-600" />}
      </div>

      {ouvrage.expanded && (
        <div className="px-4 pb-4 grid grid-cols-2 gap-3">
          <SelectInput label="Type d'ouvrage" value={ouvrage.type} onChange={onTypeChange} options={TYPES_FONDATION} full />
          <TextInput label="Libellé" value={ouvrage.label} onChange={onLabelChange} full text />
          {def.fields.map((field) => (
            <TextInput
              key={field.key}
              label={field.label}
              value={ouvrage.fields?.[field.key] ?? ""}
              onChange={(value) => onFieldChange(field.key, value)}
              hint={autoFields[field.key] > 0 ? `Auto: ${fmtD(autoFields[field.key])}` : ""}
            />
          ))}
          <TextInput label="Marge pertes (%)" value={ouvrage.marge} onChange={(value) => onPatch({ marge: value })} />
          <TextInput label="Acier (kg/m³)" value={ouvrage.ratioAcier} onChange={(value) => onPatch({ ratioAcier: value })} />
          <TextInput label={`Béton (${currency}/m³)`} value={ouvrage.prixBeton} onChange={(value) => onPatch({ prixBeton: value })} />
          <TextInput label={`Coffrage (${currency}/m²)`} value={ouvrage.prixCoffrage} onChange={(value) => onPatch({ prixCoffrage: value })} />
          <TextInput label={`Acier (${currency}/kg)`} value={ouvrage.prixAcier} onChange={(value) => onPatch({ prixAcier: value })} />
          <TextInput label={`Main d'œuvre (${currency})`} value={ouvrage.mainOeuvre} onChange={(value) => onPatch({ mainOeuvre: value })} />
          <label className="col-span-2 flex items-center justify-between rounded-xl border border-gray-700 bg-gray-950 px-3 py-2.5">
            <span className="text-[10px] text-gray-400 uppercase font-bold">Béton de propreté</span>
            <input type="checkbox" checked={Boolean(ouvrage.proprete)} onChange={(event) => onPatch({ proprete: event.target.checked })} />
          </label>
          {ouvrage.proprete && (
            <TextInput label="Épaisseur propreté (m)" value={ouvrage.epaisseurProprete} onChange={(value) => onPatch({ epaisseurProprete: value })} full />
          )}
        </div>
      )}
    </div>
  );
}

const TextInput = ({ label, value, onChange, full = false, hint = "", text = false }) => (
  <label className={`block ${full ? "col-span-2" : ""}`}>
    <span className="mb-1 block text-[10px] font-bold text-gray-500 uppercase tracking-wide">{label}</span>
    <input
      type={text ? "text" : "number"}
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value)}
      className="w-full bg-gray-950 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:border-red-400"
      placeholder={hint || "0"}
    />
    {hint && <span className="mt-1 block text-[10px] text-emerald-300">{hint}</span>}
  </label>
);

const SelectInput = ({ label, value, onChange, options, full = false }) => (
  <label className={`block ${full ? "col-span-2" : ""}`}>
    <span className="mb-1 block text-[10px] font-bold text-gray-500 uppercase tracking-wide">{label}</span>
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="w-full bg-gray-950 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:border-red-400"
    >
      {Object.entries(options).map(([key, option]) => (
        <option key={key} value={key}>{option.label}</option>
      ))}
    </select>
  </label>
);

const KpiCard = ({ label, value, unit, color }) => (
  <div className="rounded-2xl p-4 bg-gray-900/60 border border-gray-800">
    <p className="text-[10px] text-gray-500 uppercase font-bold">{label}</p>
    <p className={`text-lg font-black font-mono ${color}`}>{value} <span className="text-xs text-gray-500">{unit}</span></p>
  </div>
);

const MaterialRow = ({ label, value, dot }) => (
  <div className="flex justify-between items-center border-b border-gray-800 pb-2 last:border-0">
    <span className="text-xs text-gray-400 flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${dot}`} />{label}</span>
    <span className="text-xs font-bold text-white font-mono">{value}</span>
  </div>
);

const SummaryRow = ({ label, value, strong = false }) => (
  <div className={`px-4 py-2.5 flex justify-between items-center border-b border-gray-800/30 last:border-0 ${strong ? "bg-red-500/10" : ""}`}>
    <span className={`text-xs font-bold ${strong ? "text-red-300" : "text-gray-400"}`}>{label}</span>
    <span className={`text-xs font-black font-mono ${strong ? "text-red-300" : "text-white"}`}>{value}</span>
  </div>
);
