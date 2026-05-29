import React, { useEffect, useMemo, useState } from "react";
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import {
  Archive,
  ChevronDown,
  ChevronUp,
  Layers,
  Leaf,
  Mountain,
  Pickaxe,
  Plus,
  RotateCcw,
  Shovel,
  Trash2,
  Truck,
} from "lucide-react";
import usePersistentState from "../../../../hooks/usePersistentState";
import { useProjectStore } from "../../../../store/useProjectStore";

ChartJS.register(ArcElement, Tooltip, Legend);

const DENSITY_TERRE = 1.7;

const NATURE_SOL = {
  SABLE: { label: "Sable / grave", coeff: 1.15 },
  TERRE: { label: "Terre ordinaire", coeff: 1.25 },
  ARGILE: { label: "Argile / limon", coeff: 1.35 },
  ROCHE: { label: "Rocher / grave dure", coeff: 1.5 },
};

const CATEGORIES = {
  A: { label: "Préparation", color: "text-emerald-300", bg: "bg-emerald-500/10", border: "border-emerald-500/30" },
  B: { label: "Terres déplacées", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30" },
  C: { label: "Gestion des terres", color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/30" },
  D: { label: "Réemploi sur site", color: "text-sky-300", bg: "bg-sky-500/10", border: "border-sky-500/30" },
};

const TYPES_OUVRAGE = {
  DECAPAGE: {
    cat: "A",
    label: "Décapage terre végétale",
    icon: Layers,
    unit: "m³",
    hasSol: true,
    fields: [
      { key: "surface", label: "Surface (m²)" },
      { key: "epaisseur", label: "Épaisseur (m)" },
    ],
    compute: (f) => f("surface") * f("epaisseur"),
  },
  DEBLAIS: {
    cat: "B",
    label: "Terres déplacées",
    icon: Pickaxe,
    unit: "m³",
    hasSol: true,
    fields: [
      { key: "longueur", label: "Longueur (m)" },
      { key: "largeur", label: "Largeur (m)" },
      { key: "profondeur", label: "Profondeur (m)" },
    ],
    compute: (f) => f("longueur") * f("largeur") * f("profondeur"),
  },
  PLATEFORME: {
    cat: "B",
    label: "Emprise / nivellement de surface",
    icon: Mountain,
    unit: "m³",
    hasSol: true,
    fields: [
      { key: "surface", label: "Surface plateforme (m²)" },
      { key: "profondeur", label: "Profondeur moyenne (m)" },
    ],
    compute: (f) => f("surface") * f("profondeur"),
  },
  EVACUATION: {
    cat: "C",
    label: "Évacuation évitable / réelle",
    icon: Truck,
    unit: "m³",
    isEvac: true,
    fields: [{ key: "volume", label: "Volume à évacuer (m³)" }],
    compute: (f) => f("volume"),
  },
  DEPOT: {
    cat: "C",
    label: "Stockage provisoire sur site",
    icon: Archive,
    unit: "m³",
    isDepot: true,
    fields: [{ key: "volume", label: "Volume stocké (m³)" }],
    compute: (f) => f("volume"),
  },
  REMBLAI: {
    cat: "D",
    label: "Réemploi des terres",
    icon: Shovel,
    unit: "m³",
    isRemblai: true,
    fields: [{ key: "volume", label: "Volume compacté (m³)" }],
    compute: (f) => f("volume"),
  },
  COMPACTAGE: {
    cat: "D",
    label: "Stabilisation / compactage",
    icon: RotateCcw,
    unit: "m²",
    prixUnit: true,
    fields: [{ key: "surface", label: "Surface compactée (m²)" }],
    compute: (f) => f("surface"),
  },
};

const fmt = (value, decimals = 0) =>
  Number(value || 0).toLocaleString("fr-FR", { maximumFractionDigits: decimals });
const fmtD = (value) => Number(value || 0).toFixed(2);
const num = (value) => Number.parseFloat(value) || 0;
const fieldReader = (fields) => (key) => num(fields?.[key]);

const defaultOuvrage = (type = "DEBLAIS") => ({
  id: Date.now() + Math.random(),
  type,
  label: "",
  typeSol: "TERRE",
  prixUnit: "",
  fields: {},
  expanded: true,
});

export default function TerrassementEco({
  currency = "XOF",
  onTotalChange = () => {},
  onCostChange = () => {},
  onMateriauxChange = () => {},
  onMaterialsChange = () => {},
}) {
  const setGlobalCost = useProjectStore((state) => state.setCost);
  const setGlobalMaterials = useProjectStore((state) => state.setMaterials);
  const setGlobalResults = useProjectStore((state) => state.setResults);

  const [ouvrages, setOuvrages] = usePersistentState("eco:terrassement:ouvrages", [
    defaultOuvrage("DECAPAGE"),
    defaultOuvrage("DEBLAIS"),
  ]);
  const [prixExcavation, setPrixExcavation] = usePersistentState("eco:terrassement:prixExcavation", "");
  const [prixTransport, setPrixTransport] = usePersistentState("eco:terrassement:prixTransport", "");
  const [prixDepot, setPrixDepot] = usePersistentState("eco:terrassement:prixDepot", "");
  const [capaciteCamion, setCapaciteCamion] = usePersistentState("eco:terrassement:capaciteCamion", "16");
  const [newType, setNewType] = usePersistentState("eco:terrassement:newType", "DEBLAIS");
  const [activeTab, setActiveTab] = useState("ouvrages");

  const totalFouillesAuto = useMemo(() => ouvrages.reduce((sum, ouvrage) => {
    const def = TYPES_OUVRAGE[ouvrage.type];
    if (!def?.hasSol) return sum;
    return sum + def.compute(fieldReader(ouvrage.fields));
  }, 0), [ouvrages]);

  const totalFoisonneAuto = useMemo(() => ouvrages.reduce((sum, ouvrage) => {
    const def = TYPES_OUVRAGE[ouvrage.type];
    if (!def?.hasSol) return sum;
    const coeff = NATURE_SOL[ouvrage.typeSol]?.coeff || 1.25;
    return sum + def.compute(fieldReader(ouvrage.fields)) * coeff;
  }, 0), [ouvrages]);

  const surfacePlateforme = useMemo(() => {
    const surfaces = ouvrages.map((ouvrage) => {
      if (["DECAPAGE", "PLATEFORME", "COMPACTAGE"].includes(ouvrage.type)) {
        return num(ouvrage.fields?.surface);
      }
      if (ouvrage.type === "DEBLAIS") {
        return num(ouvrage.fields?.longueur) * num(ouvrage.fields?.largeur);
      }
      return 0;
    }).filter((surface) => surface > 0);
    return surfaces.length ? Math.max(...surfaces) : 0;
  }, [ouvrages]);

  const autoFieldValues = useMemo(() => ({
    EVACUATION: { volume: totalFoisonneAuto },
    DEPOT: { volume: totalFoisonneAuto },
    REMBLAI: { volume: totalFouillesAuto },
    COMPACTAGE: {
      surface: ouvrages
        .filter((ouvrage) => ["DECAPAGE", "PLATEFORME"].includes(ouvrage.type))
        .reduce((max, ouvrage) => Math.max(max, num(ouvrage.fields?.surface)), 0),
    },
  }), [totalFoisonneAuto, totalFouillesAuto, ouvrages]);

  const getEffectiveFields = (ouvrage) => {
    const fields = { ...(ouvrage.fields || {}) };
    Object.entries(autoFieldValues[ouvrage.type] || {}).forEach(([key, value]) => {
      if ((fields[key] === undefined || fields[key] === "") && Number(value) > 0) {
        fields[key] = String(value);
      }
    });
    return fields;
  };

  const results = useMemo(() => {
    let volumeExcave = 0;
    let volumeFoisonne = 0;
    let volumeEvacue = 0;
    let volumeDepot = 0;
    let volumeRemblai = 0;
    let coutSpeciaux = 0;

    const ouvragesCalc = ouvrages.map((ouvrage) => {
      const def = TYPES_OUVRAGE[ouvrage.type];
      if (!def) return { ...ouvrage, fields: ouvrage.fields || {}, vol: 0, volFoisonne: 0, cout: 0 };
      const fields = getEffectiveFields(ouvrage);
      const vol = def.compute(fieldReader(fields));
      const coeff = NATURE_SOL[ouvrage.typeSol]?.coeff || 1.25;
      const volFoisonne = def.hasSol ? vol * coeff : 0;
      const pu = num(ouvrage.prixUnit);
      let cout = 0;

      if (def.hasSol) {
        volumeExcave += vol;
        volumeFoisonne += volFoisonne;
      } else if (def.isEvac) {
        volumeEvacue += vol;
      } else if (def.isDepot) {
        volumeDepot += vol;
        cout = vol * (pu || num(prixDepot));
      } else if (def.isRemblai) {
        volumeRemblai += vol;
        cout = vol * pu;
      } else if (def.prixUnit) {
        cout = vol * pu;
      }

      coutSpeciaux += cout;
      return { ...ouvrage, fields, vol, volFoisonne, cout };
    });

    const capCamion = num(capaciteCamion) || 16;
    const volumeTransport = volumeEvacue + volumeDepot;
    const nombreCamions = volumeTransport > 0 ? Math.ceil(volumeTransport / capCamion) : 0;
    const poidsTonnes = volumeExcave * DENSITY_TERRE;
    const coutExcavation = volumeExcave * num(prixExcavation);
    const coutTransport = nombreCamions * num(prixTransport);
    const total = coutExcavation + coutTransport + coutSpeciaux;

    return {
      ouvragesCalc,
      volumeExcave,
      volumeFoisonne,
      volumeEvacue,
      volumeDepot,
      volumeRemblai,
      volumeApport: Math.max(0, volumeRemblai - (volumeDepot || 0)),
      volumeTransport,
      nombreCamions,
      poidsTonnes,
      surfacePlateforme,
      surfaceCompactage: autoFieldValues.COMPACTAGE.surface,
      coutExcavation,
      coutTransport,
      coutSpeciaux,
      total,
    };
  }, [ouvrages, prixExcavation, prixTransport, prixDepot, capaciteCamion, autoFieldValues, surfacePlateforme]);

  useEffect(() => {
    onTotalChange(results.total);
    onCostChange(results.total);
    const materials = {
      volume: results.volumeExcave,
      volumeFoisonne: results.volumeFoisonne,
      poids: results.poidsTonnes,
      volumeEvacue: results.volumeEvacue,
      volumeDepot: results.volumeDepot,
      volumeRemblai: results.volumeRemblai,
      volumeApport: results.volumeApport,
      surface: results.surfacePlateforme,
      nombreCamions: results.nombreCamions,
    };

    onMateriauxChange(materials);
    onMaterialsChange(materials);
    setGlobalCost("ecoTerrassement", results.total);
    setGlobalMaterials("ecoTerrassement", materials);
    setGlobalResults("ecoTerrassement", {
      totalDeblai: results.volumeExcave,
      totalFoisonne: results.volumeFoisonne,
      totalRemblai: results.volumeRemblai,
      deblaisEvacues: results.volumeEvacue,
      deblaisStockes: results.volumeDepot,
      volumeApport: results.volumeApport,
      nbCamions: results.nombreCamions,
      poidsTonnes: results.poidsTonnes,
      surfacePlateforme: results.surfacePlateforme,
      surfaceCompactage: results.surfaceCompactage,
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
    labels: ["Excavation", "Transport", "Autres"],
    datasets: [{
      data: [results.coutExcavation, results.coutTransport, results.coutSpeciaux],
      backgroundColor: ["#f59e0b", "#10b981", "#6366f1"],
      borderColor: "#111827",
      borderWidth: 2,
    }],
  };

  return (
    <div className="w-full h-full flex flex-col bg-gray-950 text-gray-100 overflow-hidden">
      <div className="flex-shrink-0 px-5 py-3 border-b border-gray-800 flex justify-between items-center bg-gray-900/70">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/20 rounded-xl text-emerald-300">
            <Leaf className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white leading-tight">Gestion des terres & sols</h2>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">
              Volumes déplacés · réemploi · évacuation · impact transport
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
            <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-4">
              <p className="text-[10px] text-emerald-300 uppercase font-bold tracking-widest mb-3">Sol et logistique du chantier</p>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <PriceInput label={`Excavation (${currency}/m³)`} value={prixExcavation} onChange={setPrixExcavation} />
                <PriceInput label={`Transport (${currency}/voyage)`} value={prixTransport} onChange={setPrixTransport} />
                <PriceInput label={`Dépôt (${currency}/m³)`} value={prixDepot} onChange={setPrixDepot} />
                <PriceInput label="Capacité camion (m³)" value={capaciteCamion} onChange={setCapaciteCamion} />
              </div>
            </div>

            {ouvrages.map((ouvrage) => {
              const def = TYPES_OUVRAGE[ouvrage.type];
              if (!def) return null;
              const cat = CATEGORIES[def.cat];
              const calc = results.ouvragesCalc.find((item) => item.id === ouvrage.id);
              return (
                <OuvrageCard
                  key={ouvrage.id}
                  ouvrage={ouvrage}
                  def={def}
                  cat={cat}
                  calc={calc}
                  currency={currency}
                  autoFields={autoFieldValues[ouvrage.type] || {}}
                  onToggle={() => updateOuvrage(ouvrage.id, { expanded: !ouvrage.expanded })}
                  onRemove={() => removeOuvrage(ouvrage.id)}
                  onLabelChange={(value) => updateOuvrage(ouvrage.id, { label: value })}
                  onSolChange={(value) => updateOuvrage(ouvrage.id, { typeSol: value })}
                  onPrixChange={(value) => updateOuvrage(ouvrage.id, { prixUnit: value })}
                  onFieldChange={(key, value) => updateField(ouvrage.id, key, value)}
                />
              );
            })}

            <div className="bg-gray-900/40 border border-gray-700/50 rounded-2xl p-4">
              <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-3">Ajouter un ouvrage</p>
              <select
                value={newType}
                onChange={(event) => setNewType(event.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-3 text-sm text-white focus:border-emerald-400"
              >
                {Object.entries(CATEGORIES).map(([catKey, cat]) => (
                  <optgroup key={catKey} label={cat.label}>
                    {Object.entries(TYPES_OUVRAGE)
                      .filter(([, def]) => def.cat === catKey)
                      .map(([key, def]) => <option key={key} value={key}>{def.label}</option>)}
                  </optgroup>
                ))}
              </select>
              <button
                onClick={addOuvrage}
                className="w-full mt-3 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl font-bold text-sm"
              >
                <Plus className="w-4 h-4" /> Ajouter à la synthèse
              </button>
            </div>
          </div>

          <div className={`xl:col-span-5 p-4 lg:p-5 flex flex-col gap-4 ${activeTab !== "synthese" ? "hidden xl:flex" : "flex"}`}>
            <div className="grid grid-cols-2 gap-3">
              <KpiCard label="Terres déplacées" value={fmtD(results.volumeExcave)} unit="m³" color="text-amber-400" />
              <KpiCard label="Foisonné" value={fmtD(results.volumeFoisonne)} unit="m³" color="text-orange-400" />
              <KpiCard label="Poids estimé" value={fmtD(results.poidsTonnes)} unit="t" color="text-emerald-300" />
              <KpiCard label="Camions" value={results.nombreCamions} unit="rot." color="text-stone-300" />
            </div>

            {results.total > 0 && (
              <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-5">
                <div className="relative w-28 h-28 flex-shrink-0">
                  <Doughnut data={chartData} options={{ cutout: "72%", plugins: { legend: { display: false } } }} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[9px] text-gray-500 uppercase">Total</span>
                    <span className="text-[11px] font-bold text-white text-center leading-tight">{fmt(results.total)}</span>
                  </div>
                </div>
                <div className="flex-1 w-full space-y-2">
                  <CostRow label="Excavation" value={results.coutExcavation} currency={currency} dot="bg-amber-500" />
                  <CostRow label="Transport" value={results.coutTransport} currency={currency} dot="bg-emerald-500" />
                  <CostRow label="Autres ouvrages" value={results.coutSpeciaux} currency={currency} dot="bg-indigo-500" />
                </div>
              </div>
            )}

            <div className="bg-gray-900/40 border border-gray-800/50 rounded-2xl overflow-hidden">
              <div className="px-4 py-2.5 bg-gray-900/70 border-b border-gray-800/50">
                <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Synthèse gestion terres & sols</h4>
              </div>
              <SummaryRow label="Ouvrages" value={`${ouvrages.length} u`} />
              <SummaryRow label="Volume de terres déplacées" value={`${fmtD(results.volumeExcave)} m³`} />
              <SummaryRow label="Volume foisonné" value={`${fmtD(results.volumeFoisonne)} m³`} />
              <SummaryRow label="Stockage provisoire" value={`${fmtD(results.volumeDepot)} m³`} />
              <SummaryRow label="Évacuation réelle/évitable" value={`${fmtD(results.volumeEvacue)} m³`} />
              <SummaryRow label="Remblai" value={`${fmtD(results.volumeRemblai)} m³`} />
              <SummaryRow label="Apport estimé" value={`${fmtD(results.volumeApport)} m³`} />
              <SummaryRow label="Poids de terre" value={`${fmtD(results.poidsTonnes)} t`} />
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
  cat,
  calc,
  currency,
  autoFields,
  onToggle,
  onRemove,
  onLabelChange,
  onSolChange,
  onPrixChange,
  onFieldChange,
}) {
  const Icon = def.icon;
  return (
    <div className={`border rounded-2xl overflow-hidden ${cat.border} ${cat.bg}`}>
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={onToggle}>
        <div className={`p-1.5 rounded-lg bg-gray-900/60 ${cat.color}`}><Icon className="w-4 h-4" /></div>
        <div className="flex-1 min-w-0">
          <span className={`text-[10px] font-bold uppercase tracking-widest ${cat.color}`}>{cat.label}</span>
          <p className="text-xs font-bold text-white truncate">{ouvrage.label || def.label}</p>
        </div>
        <span className="text-xs font-bold text-white font-mono">{fmtD(calc?.vol)} {def.unit}</span>
        <button onClick={(event) => { event.stopPropagation(); onRemove(); }} className="text-gray-600 hover:text-red-400">
          <Trash2 className="w-4 h-4" />
        </button>
        {ouvrage.expanded ? <ChevronUp className="w-4 h-4 text-gray-600" /> : <ChevronDown className="w-4 h-4 text-gray-600" />}
      </div>

      {ouvrage.expanded && (
        <div className="px-4 pb-4 grid grid-cols-2 gap-3">
          <TextInput label="Libellé" value={ouvrage.label} onChange={onLabelChange} full />
          {def.hasSol && (
            <SelectInput label="Nature du sol" value={ouvrage.typeSol} onChange={onSolChange} options={NATURE_SOL} full />
          )}
          {def.fields.map((field) => (
            <TextInput
              key={field.key}
              label={field.label}
              value={ouvrage.fields?.[field.key] ?? ""}
              onChange={(value) => onFieldChange(field.key, value)}
              hint={autoFields[field.key] > 0 ? `Auto: ${fmtD(autoFields[field.key])}` : ""}
            />
          ))}
          {(def.prixUnit || def.isRemblai || def.isDepot) && (
            <TextInput label={`Prix (${currency}/${def.unit})`} value={ouvrage.prixUnit} onChange={onPrixChange} full />
          )}
        </div>
      )}
    </div>
  );
}

const PriceInput = ({ label, value, onChange }) => (
  <label className="block">
    <span className="mb-1 block text-[10px] font-bold text-gray-500 uppercase tracking-wide">{label}</span>
    <input
      type="number"
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value)}
      className="w-full bg-gray-950 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:border-emerald-400"
      placeholder="0"
    />
  </label>
);

const TextInput = ({ label, value, onChange, full = false, hint = "" }) => (
  <label className={`block ${full ? "col-span-2" : ""}`}>
    <span className="mb-1 block text-[10px] font-bold text-gray-500 uppercase tracking-wide">{label}</span>
    <input
      type={label === "Libellé" ? "text" : "number"}
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value)}
      className="w-full bg-gray-950 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:border-emerald-400"
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
      className="w-full bg-gray-950 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:border-emerald-400"
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

const CostRow = ({ label, value, currency, dot }) => (
  <div className="flex justify-between items-center border-b border-gray-800 pb-2 last:border-0">
    <span className="text-xs text-gray-400 flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${dot}`} />{label}</span>
    <span className="text-xs font-bold text-white font-mono">{fmt(value)} {currency}</span>
  </div>
);

const SummaryRow = ({ label, value, strong = false }) => (
  <div className={`px-4 py-2.5 flex justify-between items-center border-b border-gray-800/30 last:border-0 ${strong ? "bg-emerald-500/10" : ""}`}>
    <span className={`text-xs font-bold ${strong ? "text-emerald-300" : "text-gray-400"}`}>{label}</span>
    <span className={`text-xs font-black font-mono ${strong ? "text-emerald-300" : "text-white"}`}>{value}</span>
  </div>
);
