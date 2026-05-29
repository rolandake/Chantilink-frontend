import React, { useEffect, useMemo, useState } from "react";
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { ChevronDown, ChevronUp, Droplets, Plus, Recycle, Trash2 } from "lucide-react";
import usePersistentState from "../../../../hooks/usePersistentState";
import { useProjectStore } from "../../../../store/useProjectStore";

ChartJS.register(ArcElement, Tooltip, Legend);

const TYPES_EAU = {
  consommation: {
    label: "Consommation chantier",
    icon: Droplets,
    sens: "consomme",
    desc: "Eau potable ou forage consommé sur le chantier.",
  },
  pluie: {
    label: "Récupération eaux pluviales",
    icon: Recycle,
    sens: "reemploi",
    desc: "Volume récupéré et utilisé à la place de l'eau neuve.",
  },
  grise: {
    label: "Réemploi eaux grises",
    icon: Recycle,
    sens: "reemploi",
    desc: "Eaux traitées/réutilisées pour nettoyage, arrosage ou process.",
  },
  reduction: {
    label: "Réduction par équipements",
    icon: Droplets,
    sens: "economie",
    desc: "Économie liée aux équipements hydro-économes.",
  },
};

const fmt = (value, decimals = 0) =>
  Number(value || 0).toLocaleString("fr-FR", { maximumFractionDigits: decimals });
const fmtD = (value, decimals = 2) => Number(value || 0).toFixed(decimals);
const num = (value) => Number.parseFloat(value) || 0;

const defaultScenario = (type = "consommation") => ({
  id: Date.now() + Math.random(),
  type,
  label: "",
  volume: "",
  prixUnitaire: "",
  mainOeuvre: "",
  expanded: true,
});

const computeScenario = (scenario) => {
  const config = TYPES_EAU[scenario.type] || TYPES_EAU.consommation;
  const volume = num(scenario.volume);
  const total = volume * num(scenario.prixUnitaire) + num(scenario.mainOeuvre);
  return { ...scenario, config, volume, total };
};

export default function EauEco({
  currency = "XOF",
  onTotalChange = () => {},
  onCostChange = () => {},
  onMateriauxChange = () => {},
  onMaterialsChange = () => {},
}) {
  const setGlobalCost = useProjectStore((state) => state.setCost);
  const setGlobalMaterials = useProjectStore((state) => state.setMaterials);
  const setGlobalResults = useProjectStore((state) => state.setResults);

  const [scenarios, setScenarios] = usePersistentState("eco:eau:scenarios", [defaultScenario("consommation")]);
  const [newType, setNewType] = usePersistentState("eco:eau:newType", "consommation");
  const [activeTab, setActiveTab] = useState("scenarios");

  const results = useMemo(() => {
    const scenariosCalc = scenarios.map(computeScenario);
    const eauConsommee = scenariosCalc
      .filter((item) => item.config.sens === "consomme")
      .reduce((sum, item) => sum + item.volume, 0);
    const eauRecyclee = scenariosCalc
      .filter((item) => item.config.sens === "reemploi")
      .reduce((sum, item) => sum + item.volume, 0);
    const eauEconomisee = scenariosCalc
      .filter((item) => item.config.sens === "economie")
      .reduce((sum, item) => sum + item.volume, 0);
    const eauNeuveNette = Math.max(0, eauConsommee - eauRecyclee - eauEconomisee);
    const tauxReemploi = eauConsommee > 0 ? ((eauRecyclee + eauEconomisee) / eauConsommee) * 100 : 0;
    const total = scenariosCalc.reduce((sum, item) => sum + item.total, 0);

    return { scenariosCalc, eauConsommee, eauRecyclee, eauEconomisee, eauNeuveNette, tauxReemploi, total };
  }, [scenarios]);

  useEffect(() => {
    onTotalChange(results.total);
    onCostChange(results.total);
    const materials = {
      m3: results.eauConsommee,
      eau: results.eauConsommee * 1000,
      eauRecyclee: results.eauRecyclee,
      eauEconomisee: results.eauEconomisee,
      eauNette: results.eauNeuveNette,
      tauxReemploiEau: results.tauxReemploi,
    };
    onMateriauxChange(materials);
    onMaterialsChange(materials);
    setGlobalCost("ecoEau", results.total);
    setGlobalMaterials("ecoEau", materials);
    setGlobalResults("ecoEau", {
      eauConsommeeM3: results.eauConsommee,
      eauRecycleeM3: results.eauRecyclee,
      eauEconomiseeM3: results.eauEconomisee,
      eauNeuveNetteM3: results.eauNeuveNette,
      tauxReemploi: results.tauxReemploi,
      scenarios: results.scenariosCalc.map((item) => ({
        type: item.type,
        label: item.label || item.config.label,
        volume: item.volume,
        total: item.total,
      })),
    });
  }, [results]);

  const updateScenario = (id, patch) => setScenarios((prev) => prev.map((item) => (
    item.id === id ? { ...item, ...patch } : item
  )));
  const addScenario = () => setScenarios((prev) => [...prev, defaultScenario(newType)]);
  const removeScenario = (id) => setScenarios((prev) => prev.filter((item) => item.id !== id));

  const chartData = {
    labels: ["Eau neuve nette", "Réemploi", "Économie"],
    datasets: [{
      data: [results.eauNeuveNette, results.eauRecyclee, results.eauEconomisee],
      backgroundColor: ["#06b6d4", "#22c55e", "#84cc16"],
      borderColor: "#111827",
      borderWidth: 2,
    }],
  };

  return (
    <div className="w-full h-full flex flex-col bg-gray-950 text-gray-100 overflow-hidden">
      <div className="flex-shrink-0 px-5 py-3 border-b border-gray-800 flex justify-between items-center bg-gray-900/70">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cyan-500/20 rounded-xl text-cyan-300">
            <Droplets className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white leading-tight">Eau & réemploi</h2>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">
              Consommation · récupération · réutilisation · économie
            </p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-gray-500 uppercase font-bold block">Coût total</span>
          <span className="text-xl font-black text-cyan-300 tracking-tight">
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
              activeTab === key ? "text-cyan-300 border-b-2 border-cyan-300" : "text-gray-500"
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
              <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-3">Ajouter un scénario eau</p>
              <select
                value={newType}
                onChange={(event) => setNewType(event.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-3 text-sm text-white focus:border-cyan-400"
              >
                {Object.entries(TYPES_EAU).map(([key, item]) => (
                  <option key={key} value={key}>{item.label}</option>
                ))}
              </select>
              <button
                onClick={addScenario}
                className="w-full mt-3 flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white py-3 rounded-xl font-bold text-sm"
              >
                <Plus className="w-4 h-4" /> Ajouter à la synthèse
              </button>
            </div>
          </div>

          <div className={`xl:col-span-5 p-4 lg:p-5 flex flex-col gap-4 ${activeTab !== "synthese" ? "hidden xl:flex" : "flex"}`}>
            <div className="grid grid-cols-2 gap-3">
              <KpiCard label="Eau consommée" value={fmtD(results.eauConsommee)} unit="m³" color="text-cyan-300" />
              <KpiCard label="Réemploi" value={fmtD(results.eauRecyclee)} unit="m³" color="text-green-300" />
              <KpiCard label="Économie" value={fmtD(results.eauEconomisee)} unit="m³" color="text-lime-300" />
              <KpiCard label="Taux évité" value={fmtD(results.tauxReemploi, 1)} unit="%" color="text-emerald-300" />
            </div>

            <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-5">
              <div className="relative w-28 h-28 flex-shrink-0">
                <Doughnut data={chartData} options={{ cutout: "72%", plugins: { legend: { display: false } } }} />
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[9px] text-gray-500 uppercase">Net</span>
                  <span className="text-[11px] font-bold text-white text-center leading-tight">{fmtD(results.eauNeuveNette)} m³</span>
                </div>
              </div>
              <div className="flex-1 w-full space-y-2">
                <MaterialRow label="Eau neuve nette" value={`${fmtD(results.eauNeuveNette)} m³`} dot="bg-cyan-500" />
                <MaterialRow label="Eau réutilisée" value={`${fmtD(results.eauRecyclee)} m³`} dot="bg-green-500" />
                <MaterialRow label="Économie d'eau" value={`${fmtD(results.eauEconomisee)} m³`} dot="bg-lime-500" />
                <MaterialRow label="Coût" value={`${fmt(results.total)} ${currency}`} dot="bg-gray-500" />
              </div>
            </div>

            <div className="bg-gray-900/40 border border-gray-800/50 rounded-2xl overflow-hidden">
              <div className="px-4 py-2.5 bg-gray-900/70 border-b border-gray-800/50">
                <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Synthèse eau & réemploi</h4>
              </div>
              <SummaryRow label="Scénarios" value={`${scenarios.length} u`} />
              <SummaryRow label="Eau consommée" value={`${fmtD(results.eauConsommee)} m³`} />
              <SummaryRow label="Eau réutilisée" value={`${fmtD(results.eauRecyclee)} m³`} />
              <SummaryRow label="Économie d'eau" value={`${fmtD(results.eauEconomisee)} m³`} />
              <SummaryRow label="Eau neuve nette" value={`${fmtD(results.eauNeuveNette)} m³`} />
              <SummaryRow label="Total" value={`${fmt(results.total)} ${currency}`} strong />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ScenarioCard({ scenario, currency, onToggle, onRemove, onPatch }) {
  const Icon = scenario.config.icon;
  return (
    <div className="border border-cyan-500/25 bg-cyan-500/10 rounded-2xl overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={onToggle}>
        <div className="p-1.5 rounded-lg bg-gray-900/60 text-cyan-300"><Icon className="w-4 h-4" /></div>
        <div className="flex-1 min-w-0">
          <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-300">{scenario.config.label}</span>
          <p className="text-xs font-bold text-white truncate">{scenario.label || scenario.config.desc}</p>
        </div>
        <span className="text-xs font-bold text-white font-mono">{fmtD(scenario.volume)} m³</span>
        <button onClick={(event) => { event.stopPropagation(); onRemove(); }} className="text-gray-600 hover:text-red-400">
          <Trash2 className="w-4 h-4" />
        </button>
        {scenario.expanded ? <ChevronUp className="w-4 h-4 text-gray-600" /> : <ChevronDown className="w-4 h-4 text-gray-600" />}
      </div>

      {scenario.expanded && (
        <div className="px-4 pb-4 grid grid-cols-2 gap-3">
          <SelectInput label="Type de scénario" value={scenario.type} onChange={(type) => onPatch({ type })} options={TYPES_EAU} full />
          <TextInput label="Libellé" value={scenario.label} onChange={(label) => onPatch({ label })} text full />
          <TextInput label="Volume (m³)" value={scenario.volume} onChange={(volume) => onPatch({ volume })} />
          <TextInput label={`Prix (${currency}/m³)`} value={scenario.prixUnitaire} onChange={(prixUnitaire) => onPatch({ prixUnitaire })} />
          <TextInput label={`Main d'œuvre (${currency})`} value={scenario.mainOeuvre} onChange={(mainOeuvre) => onPatch({ mainOeuvre })} full />
          <div className="col-span-2 grid grid-cols-2 gap-2">
            <MiniResult label="Volume" value={`${fmtD(scenario.volume)} m³`} />
            <MiniResult label="Coût" value={`${fmt(scenario.total)} ${currency}`} />
          </div>
        </div>
      )}
    </div>
  );
}

const TextInput = ({ label, value, onChange, full = false, text = false }) => (
  <label className={`block ${full ? "col-span-2" : ""}`}>
    <span className="mb-1 block text-[10px] font-bold text-gray-500 uppercase tracking-wide">{label}</span>
    <input
      type={text ? "text" : "number"}
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value)}
      className="w-full bg-gray-950 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:border-cyan-400"
      placeholder="0"
    />
  </label>
);

const SelectInput = ({ label, value, onChange, options, full = false }) => (
  <label className={`block ${full ? "col-span-2" : ""}`}>
    <span className="mb-1 block text-[10px] font-bold text-gray-500 uppercase tracking-wide">{label}</span>
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="w-full bg-gray-950 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:border-cyan-400"
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
  <div className={`px-4 py-2.5 flex justify-between items-center border-b border-gray-800/30 last:border-0 ${strong ? "bg-cyan-500/10" : ""}`}>
    <span className={`text-xs font-bold ${strong ? "text-cyan-300" : "text-gray-400"}`}>{label}</span>
    <span className={`text-xs font-black font-mono ${strong ? "text-cyan-300" : "text-white"}`}>{value}</span>
  </div>
);
