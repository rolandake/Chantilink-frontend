import React, { useEffect, useMemo, useState } from "react";
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import {
  BatteryCharging,
  ChevronDown,
  ChevronUp,
  Flame,
  Leaf,
  Plus,
  Trash2,
  Zap,
} from "lucide-react";
import usePersistentState from "../../../../hooks/usePersistentState";
import { useProjectStore } from "../../../../store/useProjectStore";

ChartJS.register(ArcElement, Tooltip, Legend);

const SOURCES_ENERGIE = {
  reseau: {
    label: "Réseau électrique",
    icon: Zap,
    factor: 0.233,
    unit: "kWh",
    desc: "Consommation chantier raccordée au réseau.",
  },
  solaire: {
    label: "Solaire / autoconsommation",
    icon: Leaf,
    factor: 0.05,
    unit: "kWh",
    desc: "Production ou énergie solaire utilisée sur site.",
  },
  groupe: {
    label: "Groupe électrogène",
    icon: Flame,
    factor: 0.75,
    unit: "kWh",
    desc: "Électricité produite par groupe thermique.",
  },
  carburant: {
    label: "Carburant engins",
    icon: BatteryCharging,
    factor: 2.68,
    unit: "L",
    desc: "Diesel ou carburant consommé par les engins.",
  },
};

const fmt = (value, decimals = 0) =>
  Number(value || 0).toLocaleString("fr-FR", { maximumFractionDigits: decimals });
const fmtD = (value, decimals = 2) => Number(value || 0).toFixed(decimals);
const num = (value) => Number.parseFloat(value) || 0;

const defaultScenario = (source = "reseau") => ({
  id: Date.now() + Math.random(),
  source,
  label: "",
  puissance: "",
  duree: "",
  quantite: "",
  prixUnitaire: "",
  mainOeuvre: "",
  expanded: true,
});

const computeScenario = (scenario) => {
  const source = SOURCES_ENERGIE[scenario.source] || SOURCES_ENERGIE.reseau;
  const puissance = num(scenario.puissance);
  const duree = num(scenario.duree);
  const quantiteAuto = puissance * duree;
  const quantite = num(scenario.quantite) || quantiteAuto;
  const co2 = quantite * source.factor;
  const total = quantite * num(scenario.prixUnitaire) + num(scenario.mainOeuvre);

  return {
    ...scenario,
    sourceInfo: source,
    quantite,
    quantiteAuto,
    co2,
    total,
  };
};

export default function EnergieEco({
  currency = "XOF",
  onTotalChange = () => {},
  onCostChange = () => {},
  onMateriauxChange = () => {},
  onMaterialsChange = () => {},
}) {
  const setGlobalCost = useProjectStore((state) => state.setCost);
  const setGlobalMaterials = useProjectStore((state) => state.setMaterials);
  const setGlobalResults = useProjectStore((state) => state.setResults);

  const [scenarios, setScenarios] = usePersistentState("eco:energie:scenarios", [defaultScenario("reseau")]);
  const [newSource, setNewSource] = usePersistentState("eco:energie:newSource", "reseau");
  const [activeTab, setActiveTab] = useState("scenarios");

  const results = useMemo(() => {
    const scenariosCalc = scenarios.map(computeScenario);
    const totalKwh = scenariosCalc
      .filter((item) => item.sourceInfo.unit === "kWh")
      .reduce((sum, item) => sum + item.quantite, 0);
    const totalCarburant = scenariosCalc
      .filter((item) => item.sourceInfo.unit === "L")
      .reduce((sum, item) => sum + item.quantite, 0);
    const co2 = scenariosCalc.reduce((sum, item) => sum + item.co2, 0);
    const total = scenariosCalc.reduce((sum, item) => sum + item.total, 0);
    const economieCo2VsReseau = Math.max(0, totalKwh * SOURCES_ENERGIE.reseau.factor - co2);

    return { scenariosCalc, totalKwh, totalCarburant, co2, economieCo2VsReseau, total };
  }, [scenarios]);

  useEffect(() => {
    onTotalChange(results.total);
    onCostChange(results.total);
    const materials = {
      kwh: results.totalKwh,
      carburant: results.totalCarburant,
      co2: results.co2,
      co2Evite: results.economieCo2VsReseau,
    };
    onMateriauxChange(materials);
    onMaterialsChange(materials);
    setGlobalCost("ecoEnergie", results.total);
    setGlobalMaterials("ecoEnergie", materials);
    setGlobalResults("ecoEnergie", {
      totalKwh: results.totalKwh,
      carburantL: results.totalCarburant,
      co2Kg: results.co2,
      co2EviteKg: results.economieCo2VsReseau,
      scenarios: results.scenariosCalc.map((item) => ({
        source: item.source,
        label: item.label || item.sourceInfo.label,
        quantite: item.quantite,
        unite: item.sourceInfo.unit,
        co2: item.co2,
        total: item.total,
      })),
    });
  }, [results]);

  const updateScenario = (id, patch) => setScenarios((prev) => prev.map((item) => (
    item.id === id ? { ...item, ...patch } : item
  )));
  const addScenario = () => setScenarios((prev) => [...prev, defaultScenario(newSource)]);
  const removeScenario = (id) => setScenarios((prev) => prev.filter((item) => item.id !== id));

  const chartData = {
    labels: ["Coût énergie", "CO2 kg"],
    datasets: [{
      data: [results.total, results.co2],
      backgroundColor: ["#eab308", "#22c55e"],
      borderColor: "#111827",
      borderWidth: 2,
    }],
  };

  return (
    <div className="w-full h-full flex flex-col bg-gray-950 text-gray-100 overflow-hidden">
      <div className="flex-shrink-0 px-5 py-3 border-b border-gray-800 flex justify-between items-center bg-gray-900/70">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-yellow-500/20 rounded-xl text-yellow-300">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white leading-tight">Énergie & CO2</h2>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">
              Sources énergétiques · émissions · économies carbone
            </p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-gray-500 uppercase font-bold block">Coût total</span>
          <span className="text-xl font-black text-yellow-300 tracking-tight">
            {fmt(results.total)} <span className="text-xs text-gray-500 font-normal">{currency}</span>
          </span>
        </div>
      </div>

      <div className="flex-shrink-0 flex border-b border-gray-800 xl:hidden">
        {[["scenarios", "Scénarios"], ["synthese", "Synthèse"]].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider ${
              activeTab === key ? "text-yellow-300 border-b-2 border-yellow-300" : "text-gray-500"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-1 xl:grid-cols-12 min-h-full">
          <div className={`xl:col-span-7 p-4 lg:p-5 border-r border-gray-800/50 flex flex-col gap-3 ${activeTab !== "scenarios" ? "hidden xl:flex" : "flex"}`}>
            {results.scenariosCalc.map((scenario) => (
              <ScenarioCard
                key={scenario.id}
                scenario={scenario}
                currency={currency}
                onToggle={() => updateScenario(scenario.id, { expanded: !scenario.expanded })}
                onRemove={() => removeScenario(scenario.id)}
                onPatch={(patch) => updateScenario(scenario.id, patch)}
              />
            ))}

            <div className="bg-gray-900/40 border border-gray-700/50 rounded-2xl p-4">
              <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-3">Ajouter un scénario énergétique</p>
              <select
                value={newSource}
                onChange={(event) => setNewSource(event.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-3 text-sm text-white focus:border-yellow-400"
              >
                {Object.entries(SOURCES_ENERGIE).map(([key, source]) => (
                  <option key={key} value={key}>{source.label}</option>
                ))}
              </select>
              <button
                onClick={addScenario}
                className="w-full mt-3 flex items-center justify-center gap-2 bg-yellow-600 hover:bg-yellow-500 text-white py-3 rounded-xl font-bold text-sm"
              >
                <Plus className="w-4 h-4" /> Ajouter à la synthèse
              </button>
            </div>
          </div>

          <div className={`xl:col-span-5 p-4 lg:p-5 flex flex-col gap-4 ${activeTab !== "synthese" ? "hidden xl:flex" : "flex"}`}>
            <div className="grid grid-cols-2 gap-3">
              <KpiCard label="Énergie" value={fmtD(results.totalKwh)} unit="kWh" color="text-yellow-300" />
              <KpiCard label="Carburant" value={fmtD(results.totalCarburant)} unit="L" color="text-orange-300" />
              <KpiCard label="CO2 émis" value={fmtD(results.co2)} unit="kg" color="text-green-300" />
              <KpiCard label="CO2 évité" value={fmtD(results.economieCo2VsReseau)} unit="kg" color="text-emerald-300" />
            </div>

            {(results.total > 0 || results.co2 > 0) && (
              <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-5">
                <div className="relative w-28 h-28 flex-shrink-0">
                  <Doughnut data={chartData} options={{ cutout: "72%", plugins: { legend: { display: false } } }} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[9px] text-gray-500 uppercase">CO2</span>
                    <span className="text-[11px] font-bold text-white text-center leading-tight">{fmtD(results.co2)} kg</span>
                  </div>
                </div>
                <div className="flex-1 w-full space-y-2">
                  <MaterialRow label="Coût énergie" value={`${fmt(results.total)} ${currency}`} dot="bg-yellow-500" />
                  <MaterialRow label="Émissions CO2" value={`${fmtD(results.co2)} kg CO2e`} dot="bg-green-500" />
                  <MaterialRow label="Économie vs réseau" value={`${fmtD(results.economieCo2VsReseau)} kg CO2e`} dot="bg-emerald-500" />
                </div>
              </div>
            )}

            <div className="bg-gray-900/40 border border-gray-800/50 rounded-2xl overflow-hidden">
              <div className="px-4 py-2.5 bg-gray-900/70 border-b border-gray-800/50">
                <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Synthèse énergie & CO2</h4>
              </div>
              <SummaryRow label="Scénarios" value={`${scenarios.length} u`} />
              <SummaryRow label="Énergie consommée" value={`${fmtD(results.totalKwh)} kWh`} />
              <SummaryRow label="Carburant" value={`${fmtD(results.totalCarburant)} L`} />
              <SummaryRow label="CO2 émis" value={`${fmtD(results.co2)} kg CO2e`} />
              <SummaryRow label="CO2 évité estimé" value={`${fmtD(results.economieCo2VsReseau)} kg CO2e`} />
              <SummaryRow label="Total" value={`${fmt(results.total)} ${currency}`} strong />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ScenarioCard({ scenario, currency, onToggle, onRemove, onPatch }) {
  const SourceIcon = scenario.sourceInfo.icon;
  return (
    <div className="border border-yellow-500/25 bg-yellow-500/10 rounded-2xl overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={onToggle}>
        <div className="p-1.5 rounded-lg bg-gray-900/60 text-yellow-300"><SourceIcon className="w-4 h-4" /></div>
        <div className="flex-1 min-w-0">
          <span className="text-[10px] font-bold uppercase tracking-widest text-yellow-300">{scenario.sourceInfo.label}</span>
          <p className="text-xs font-bold text-white truncate">{scenario.label || scenario.sourceInfo.desc}</p>
        </div>
        <span className="text-xs font-bold text-white font-mono">{fmtD(scenario.quantite)} {scenario.sourceInfo.unit}</span>
        <button onClick={(event) => { event.stopPropagation(); onRemove(); }} className="text-gray-600 hover:text-red-400">
          <Trash2 className="w-4 h-4" />
        </button>
        {scenario.expanded ? <ChevronUp className="w-4 h-4 text-gray-600" /> : <ChevronDown className="w-4 h-4 text-gray-600" />}
      </div>

      {scenario.expanded && (
        <div className="px-4 pb-4 grid grid-cols-2 gap-3">
          <SelectInput label="Source" value={scenario.source} onChange={(source) => onPatch({ source })} options={SOURCES_ENERGIE} full />
          <TextInput label="Libellé" value={scenario.label} onChange={(label) => onPatch({ label })} text full />
          {scenario.sourceInfo.unit === "kWh" && (
            <>
              <TextInput label="Puissance (kW)" value={scenario.puissance} onChange={(puissance) => onPatch({ puissance })} />
              <TextInput label="Durée (h)" value={scenario.duree} onChange={(duree) => onPatch({ duree })} />
            </>
          )}
          <TextInput label={`Quantité (${scenario.sourceInfo.unit})`} value={scenario.quantite} onChange={(quantite) => onPatch({ quantite })} hint={scenario.quantiteAuto > 0 ? `Auto: ${fmtD(scenario.quantiteAuto)}` : ""} />
          <TextInput label={`Prix (${currency}/${scenario.sourceInfo.unit})`} value={scenario.prixUnitaire} onChange={(prixUnitaire) => onPatch({ prixUnitaire })} />
          <TextInput label={`Main d'œuvre (${currency})`} value={scenario.mainOeuvre} onChange={(mainOeuvre) => onPatch({ mainOeuvre })} full />
          <div className="col-span-2 grid grid-cols-2 gap-2">
            <MiniResult label="CO2" value={`${fmtD(scenario.co2)} kg`} />
            <MiniResult label="Coût" value={`${fmt(scenario.total)} ${currency}`} />
          </div>
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
      className="w-full bg-gray-950 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:border-yellow-400"
      placeholder={hint || "0"}
    />
    {hint && <span className="mt-1 block text-[10px] text-yellow-300">{hint}</span>}
  </label>
);

const SelectInput = ({ label, value, onChange, options, full = false }) => (
  <label className={`block ${full ? "col-span-2" : ""}`}>
    <span className="mb-1 block text-[10px] font-bold text-gray-500 uppercase tracking-wide">{label}</span>
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="w-full bg-gray-950 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:border-yellow-400"
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

const MiniResult = ({ label, value }) => (
  <div className="rounded-xl border border-gray-800 bg-gray-950/70 p-3">
    <p className="text-[10px] uppercase font-bold text-gray-500">{label}</p>
    <p className="text-sm font-black text-white font-mono">{value}</p>
  </div>
);

const SummaryRow = ({ label, value, strong = false }) => (
  <div className={`px-4 py-2.5 flex justify-between items-center border-b border-gray-800/30 last:border-0 ${strong ? "bg-yellow-500/10" : ""}`}>
    <span className={`text-xs font-bold ${strong ? "text-yellow-300" : "text-gray-400"}`}>{label}</span>
    <span className={`text-xs font-black font-mono ${strong ? "text-yellow-300" : "text-white"}`}>{value}</span>
  </div>
);
