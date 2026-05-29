import React, { useEffect, useMemo, useState } from "react";
import { BarChart3, ChevronDown, ChevronUp, Leaf, Package, Plus, Recycle, Trash2 } from "lucide-react";
import usePersistentState from "../../../../hooks/usePersistentState";
import { useProjectStore } from "../../../../store/useProjectStore";

const TYPES_MATERIAUX = {
  ciment: {
    label: "Ciment bas carbone",
    unit: "t",
    refCo2: 830,
    ecoCo2: 520,
    key: "ciment",
    desc: "Ciment CEM III, CEM V ou liant à plus faible clinker.",
  },
  acier: {
    label: "Acier recyclé",
    unit: "t",
    refCo2: 1460,
    ecoCo2: 780,
    key: "acier",
    desc: "Acier avec part recyclée ou filière EAF.",
  },
  bois: {
    label: "Bois certifié / biosourcé",
    unit: "m³",
    refCo2: 450,
    ecoCo2: -250,
    key: "bois",
    desc: "Bois certifié ou matériau biosourcé stockant du carbone.",
  },
  blocs: {
    label: "Blocs/agglos recyclés",
    unit: "u",
    refCo2: 0.25,
    ecoCo2: 0.15,
    key: "blocs",
    desc: "Blocs béton recyclés, terre comprimée ou équivalent local.",
  },
  isolant: {
    label: "Isolant biosourcé",
    unit: "m²",
    refCo2: 12,
    ecoCo2: 4,
    key: "surface",
    desc: "Chanvre, fibre de bois, ouate, laine recyclée.",
  },
  finition: {
    label: "Peinture / finition faible COV",
    unit: "L",
    refCo2: 3.2,
    ecoCo2: 1.7,
    key: "eau",
    desc: "Produits à faible émission et faible impact.",
  },
  local: {
    label: "Matériau local / réemployé",
    unit: "t",
    refCo2: 180,
    ecoCo2: 45,
    key: "materiauxDurables",
    desc: "Pierre locale, terre, éléments déposés puis réutilisés.",
  },
};

const fmt = (value, decimals = 0) =>
  Number(value || 0).toLocaleString("fr-FR", { maximumFractionDigits: decimals });
const fmtD = (value, decimals = 2) => Number(value || 0).toFixed(decimals);
const num = (value) => Number.parseFloat(value) || 0;

const defaultLine = (type = "ciment") => ({
  id: Date.now() + Math.random(),
  type,
  designation: "",
  quantite: "",
  partDurable: "60",
  prixUnitaire: "",
  mainOeuvre: "",
  expanded: true,
});

const computeLine = (line) => {
  const material = TYPES_MATERIAUX[line.type] || TYPES_MATERIAUX.ciment;
  const quantite = num(line.quantite);
  const durableRatio = Math.min(100, Math.max(0, num(line.partDurable))) / 100;
  const prixUnitaire = num(line.prixUnitaire);
  const mainOeuvre = num(line.mainOeuvre);
  const co2Reference = quantite * material.refCo2;
  const co2Eco = quantite * (material.ecoCo2 * durableRatio + material.refCo2 * (1 - durableRatio));
  const co2Evite = Math.max(0, co2Reference - co2Eco);
  const total = quantite * prixUnitaire + mainOeuvre;

  return { ...line, material, quantite, durableRatio, co2Reference, co2Eco, co2Evite, total };
};

export default function MateriauxEco({
  currency = "XOF",
  onTotalChange = () => {},
  onCostChange = () => {},
  onMateriauxChange = () => {},
  onMaterialsChange = () => {},
}) {
  const setGlobalCost = useProjectStore((state) => state.setCost);
  const setGlobalMaterials = useProjectStore((state) => state.setMaterials);
  const setGlobalResults = useProjectStore((state) => state.setResults);

  const [lines, setLines] = usePersistentState("eco:materiaux:lines", [defaultLine("ciment")]);
  const [newType, setNewType] = usePersistentState("eco:materiaux:newType", "ciment");
  const [activeTab, setActiveTab] = useState("ouvrages");

  const results = useMemo(() => {
    const calc = lines.map(computeLine);
    const total = calc.reduce((sum, item) => sum + item.total, 0);
    const co2 = calc.reduce((sum, item) => sum + item.co2Eco, 0);
    const co2Evite = calc.reduce((sum, item) => sum + item.co2Evite, 0);
    const quantiteDurable = calc.reduce((sum, item) => sum + item.quantite * item.durableRatio, 0);
    const materials = calc.reduce((acc, item) => {
      if (item.quantite > 0) {
        acc[item.material.key] = (acc[item.material.key] || 0) + item.quantite;
      }
      return acc;
    }, {});

    return { calc, total, co2, co2Evite, quantiteDurable, materials };
  }, [lines]);

  useEffect(() => {
    onTotalChange(results.total);
    onCostChange(results.total);
    const materials = {
      ...results.materials,
      materiauxDurables: results.quantiteDurable,
      co2: results.co2,
      co2Evite: results.co2Evite,
    };
    onMateriauxChange(materials);
    onMaterialsChange(materials);
    setGlobalCost("ecoMateriaux", results.total);
    setGlobalMaterials("ecoMateriaux", materials);
    setGlobalResults("ecoMateriaux", {
      total: results.total,
      co2Kg: results.co2,
      co2EviteKg: results.co2Evite,
      lignes: results.calc.map((item) => ({
        type: item.type,
        designation: item.designation || item.material.label,
        quantite: item.quantite,
        unite: item.material.unit,
        partDurable: item.durableRatio * 100,
        total: item.total,
      })),
    });
  }, [results]);

  const updateLine = (id, patch) => setLines((prev) => prev.map((line) => (
    line.id === id ? { ...line, ...patch } : line
  )));
  const addLine = () => setLines((prev) => [...prev, defaultLine(newType)]);
  const removeLine = (id) => setLines((prev) => prev.filter((line) => line.id !== id));

  return (
    <div className="w-full h-full flex flex-col bg-gray-950 text-gray-100 overflow-hidden">
      <div className="flex-shrink-0 px-5 py-3 border-b border-gray-800 flex justify-between items-center bg-gray-900/70">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/20 rounded-xl text-emerald-300">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white leading-tight">Matériaux durables</h2>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">
              Quantités · part recyclée/réemployée · CO2 évité
            </p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-gray-500 uppercase font-bold block">Coût total</span>
          <span className="text-xl font-black text-emerald-300 tracking-tight">
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
              activeTab === key ? "text-emerald-300 border-b-2 border-emerald-300" : "text-gray-500"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-1 xl:grid-cols-12 min-h-full">
          <div className={`xl:col-span-7 p-4 lg:p-5 border-r border-gray-800/50 flex flex-col gap-3 ${activeTab !== "ouvrages" ? "hidden xl:flex" : "flex"}`}>
            {results.calc.map((line) => (
              <MaterialCard
                key={line.id}
                line={line}
                currency={currency}
                onToggle={() => updateLine(line.id, { expanded: !line.expanded })}
                onRemove={() => removeLine(line.id)}
                onPatch={(patch) => updateLine(line.id, patch)}
              />
            ))}

            <div className="bg-gray-900/40 border border-gray-700/50 rounded-2xl p-4">
              <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-3">Ajouter un matériau / ouvrage</p>
              <select
                value={newType}
                onChange={(event) => setNewType(event.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-3 text-sm text-white focus:border-emerald-400"
              >
                {Object.entries(TYPES_MATERIAUX).map(([key, material]) => (
                  <option key={key} value={key}>{material.label}</option>
                ))}
              </select>
              <button
                onClick={addLine}
                className="mt-3 w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
              >
                <Plus className="w-4 h-4" /> Ajouter au calcul
              </button>
            </div>
          </div>

          <div className={`xl:col-span-5 p-4 lg:p-5 bg-gray-900/20 flex flex-col gap-4 ${activeTab !== "synthese" ? "hidden xl:flex" : "flex"}`}>
            <div className="grid grid-cols-2 gap-3">
              <ResultCard label="CO2 émis" value={fmtD(results.co2 / 1000, 3)} unit="t CO2e" icon={<Leaf className="w-4 h-4" />} tone="emerald" />
              <ResultCard label="CO2 évité" value={fmtD(results.co2Evite / 1000, 3)} unit="t CO2e" icon={<Recycle className="w-4 h-4" />} tone="green" />
              <ResultCard label="Qté durable" value={fmtD(results.quantiteDurable, 2)} unit="u/t/m³" icon={<Package className="w-4 h-4" />} tone="blue" />
              <ResultCard label="Lignes" value={results.calc.length} unit="u" icon={<BarChart3 className="w-4 h-4" />} tone="slate" />
            </div>

            <div className="bg-gray-900/70 border border-gray-800 rounded-2xl p-4">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Synthèse interne</h3>
              <div className="space-y-2">
                {results.calc.map((item) => (
                  <div key={item.id} className="rounded-xl bg-gray-950/60 border border-gray-800 p-3">
                    <div className="flex justify-between gap-3 text-sm">
                      <span className="font-semibold text-white">{item.designation || item.material.label}</span>
                      <span className="font-black text-emerald-300">{fmt(item.total)} {currency}</span>
                    </div>
                    <div className="mt-1 text-[11px] text-gray-400">
                      {fmtD(item.quantite, 2)} {item.material.unit} · part durable {fmt(item.durableRatio * 100)}% · CO2 évité {fmtD(item.co2Evite / 1000, 3)} t
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-emerald-950/30 border border-emerald-800/50 rounded-2xl p-4">
              <p className="text-[11px] text-emerald-100/80 leading-relaxed">
                Les matériaux durables ne sont pas une phase de chantier séparée : ils alimentent les postes réels du projet.
                Ici, on les regroupe pour mesurer l'impact environnemental, le coût et les quantités cumulées exportables.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MaterialCard({ line, currency, onToggle, onRemove, onPatch }) {
  const material = line.material;
  const Icon = material.key === "bois" ? Leaf : material.key === "acier" ? Recycle : Package;

  return (
    <div className="bg-gray-900/70 border border-gray-800 rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between gap-3 hover:bg-gray-800/40"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-300 flex items-center justify-center flex-shrink-0">
            <Icon className="w-4 h-4" />
          </span>
          <div className="text-left min-w-0">
            <h3 className="text-sm font-bold text-white truncate">{line.designation || material.label}</h3>
            <p className="text-[10px] text-gray-500 truncate">{material.desc}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-black text-emerald-300 whitespace-nowrap">{fmt(line.total)} {currency}</span>
          {line.expanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
        </div>
      </button>

      {line.expanded && (
        <div className="px-4 pb-4 border-t border-gray-800 grid grid-cols-1 md:grid-cols-2 gap-3 pt-4">
          <Input label="Type de matériau" as="select" value={line.type} onChange={(value) => onPatch({ type: value })}>
            {Object.entries(TYPES_MATERIAUX).map(([key, item]) => (
              <option key={key} value={key}>{item.label}</option>
            ))}
          </Input>
          <Input label="Désignation" value={line.designation} onChange={(value) => onPatch({ designation: value })} placeholder={material.label} />
          <Input label={`Quantité (${material.unit})`} value={line.quantite} onChange={(value) => onPatch({ quantite: value })} />
          <Input label="Part durable / recyclée (%)" value={line.partDurable} onChange={(value) => onPatch({ partDurable: value })} />
          <Input label={`Prix unitaire (${currency}/${material.unit})`} value={line.prixUnitaire} onChange={(value) => onPatch({ prixUnitaire: value })} />
          <Input label={`Main d'oeuvre (${currency})`} value={line.mainOeuvre} onChange={(value) => onPatch({ mainOeuvre: value })} />
          <div className="md:col-span-2 flex flex-wrap gap-2 text-[11px] text-gray-300">
            <Badge label="CO2 référence" value={`${fmtD(line.co2Reference / 1000, 3)} t`} />
            <Badge label="CO2 projet" value={`${fmtD(line.co2Eco / 1000, 3)} t`} />
            <Badge label="CO2 évité" value={`${fmtD(line.co2Evite / 1000, 3)} t`} />
            <button
              type="button"
              onClick={onRemove}
              className="ml-auto px-3 py-2 rounded-lg bg-red-500/10 text-red-300 hover:bg-red-500/20 flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" /> Retirer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Input({ label, value, onChange, placeholder = "0", as, children }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{label}</span>
      {as === "select" ? (
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full bg-gray-950 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:border-emerald-400 outline-none"
        >
          {children}
        </select>
      ) : (
        <input
          type={label === "Désignation" ? "text" : "number"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="w-full bg-gray-950 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:border-emerald-400 outline-none"
        />
      )}
    </label>
  );
}

function Badge({ label, value }) {
  return (
    <span className="px-3 py-2 rounded-lg bg-gray-950 border border-gray-800">
      <span className="text-gray-500">{label}: </span>
      <strong className="text-white">{value}</strong>
    </span>
  );
}

function ResultCard({ label, value, unit, icon, tone }) {
  const tones = {
    emerald: "bg-emerald-500/10 text-emerald-300 border-emerald-800/50",
    green: "bg-green-500/10 text-green-300 border-green-800/50",
    blue: "bg-blue-500/10 text-blue-300 border-blue-800/50",
    slate: "bg-slate-500/10 text-slate-300 border-slate-700/50",
  };

  return (
    <div className={`rounded-2xl border p-4 ${tones[tone] || tones.emerald}`}>
      <div className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-wider opacity-80">
        {icon} {label}
      </div>
      <div className="mt-2 text-xl font-black text-white">
        {value} <span className="text-xs font-normal text-gray-400">{unit}</span>
      </div>
    </div>
  );
}
