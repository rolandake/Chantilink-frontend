import React, { useEffect, useMemo, useState } from "react";
import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import {
  Banknote,
  ChevronDown,
  ChevronUp,
  Droplets,
  Plus,
  Ruler,
  Save,
  Scale,
  Trash2,
  Waypoints,
} from "lucide-react";
import usePersistentState from "../../../../hooks/usePersistentState";
import { useProjectStore } from "../../../../store/useProjectStore";

ChartJS.register(ArcElement, Tooltip, Legend);

const TYPES_ACCOTEMENT = {
  grave: {
    label: "Accotement en grave",
    densite: 2,
    sable: 0.3,
    gravier: 0.7,
    color: "#ec4899",
    dot: "bg-pink-500",
  },
  beton: {
    label: "Accotement béton",
    densite: 2.4,
    ciment: 0.35,
    sable: 0.55,
    gravier: 0.75,
    eauL: 180,
    color: "#f472b6",
    dot: "bg-pink-400",
  },
  stabilise: {
    label: "Accotement stabilisé",
    densite: 1.9,
    ciment: 0.12,
    sable: 0.4,
    gravier: 0.25,
    terre: 0.35,
    eauL: 120,
    color: "#a855f7",
    dot: "bg-purple-500",
  },
};

const fmt = (value, decimals = 0) =>
  Number(value || 0).toLocaleString("fr-FR", { maximumFractionDigits: decimals });
const fmtD = (value) => Number(value || 0).toFixed(2);
const num = (value) => Number.parseFloat(value) || 0;

const defaultSection = (type = "grave") => ({
  id: Date.now() + Math.random(),
  type,
  label: "",
  longueur: "",
  largeur: "1.50",
  epaisseur: "0.15",
  nbCotes: "2",
  pertes: "5",
  prixTonne: "",
  prixM3: "",
  poseM2: "",
  expanded: true,
});

const normalizeSection = (section) => {
  const type = TYPES_ACCOTEMENT[section?.type] ? section.type : "grave";
  return { ...defaultSection(type), ...(section || {}), type };
};

const computeSection = (section, autoLongueur) => {
  const config = TYPES_ACCOTEMENT[section.type] || TYPES_ACCOTEMENT.grave;
  const longueur = num(section.longueur) || autoLongueur;
  const largeur = num(section.largeur);
  const epaisseur = num(section.epaisseur);
  const nbCotes = num(section.nbCotes) || 1;
  const pertes = 1 + num(section.pertes) / 100;
  const surface = longueur * largeur * nbCotes;
  const volume = surface * epaisseur;
  const volumeCommande = volume * pertes;
  const tonnage = volumeCommande * config.densite;
  const cimentT = volumeCommande * (config.ciment || 0);
  const sableT = tonnage * (config.sable || 0);
  const gravierT = tonnage * (config.gravier || 0);
  const terreT = tonnage * (config.terre || 0);
  const eauL = volumeCommande * (config.eauL || 0);
  const coutMateriaux = num(section.prixM3) > 0 ? volumeCommande * num(section.prixM3) : tonnage * num(section.prixTonne);
  const coutPose = surface * num(section.poseM2);
  const total = coutMateriaux + coutPose;

  return {
    ...section,
    config,
    longueurEffective: longueur,
    surface,
    volume,
    volumeCommande,
    tonnage,
    cimentT,
    sableT,
    gravierT,
    terreT,
    eauL,
    coutMateriaux,
    coutPose,
    total,
  };
};

export default function AccotementsForm({ currency = "XOF", onCostChange, onMateriauxChange }) {
  const terrassement = useProjectStore((state) => state.subResults.terrassement);
  const chaussee = useProjectStore((state) => state.subResults.chaussee);
  const setGlobalResults = useProjectStore((state) => state.setResults);
  const setGlobalMaterials = useProjectStore((state) => state.setMaterials);
  const setGlobalCost = useProjectStore((state) => state.setCost);

  const [sectionsRaw, setSectionsRaw] = usePersistentState("tp:accotements:sections", [defaultSection("grave")]);
  const [newType, setNewType] = usePersistentState("tp:accotements:newType", "grave");
  const [message, setMessage] = useState(null);

  const sections = useMemo(() => (
    Array.isArray(sectionsRaw) && sectionsRaw.length ? sectionsRaw.map(normalizeSection) : [defaultSection("grave")]
  ), [sectionsRaw]);

  const autoLongueur = useMemo(
    () => chaussee?.longueur || terrassement?.longueurReference || 0,
    [chaussee?.longueur, terrassement?.longueurReference]
  );

  const results = useMemo(() => {
    const sectionsCalc = sections.map((section) => computeSection(section, autoLongueur));
    return sectionsCalc.reduce((acc, section) => ({
      sectionsCalc,
      surface: acc.surface + section.surface,
      volume: acc.volume + section.volume,
      volumeCommande: acc.volumeCommande + section.volumeCommande,
      tonnageTotal: acc.tonnageTotal + section.tonnage,
      cimentT: acc.cimentT + section.cimentT,
      sableT: acc.sableT + section.sableT,
      gravierT: acc.gravierT + section.gravierT,
      terreT: acc.terreT + section.terreT,
      eauL: acc.eauL + section.eauL,
      coutMateriaux: acc.coutMateriaux + section.coutMateriaux,
      coutPose: acc.coutPose + section.coutPose,
      total: acc.total + section.total,
    }), {
      sectionsCalc,
      surface: 0,
      volume: 0,
      volumeCommande: 0,
      tonnageTotal: 0,
      cimentT: 0,
      sableT: 0,
      gravierT: 0,
      terreT: 0,
      eauL: 0,
      coutMateriaux: 0,
      coutPose: 0,
      total: 0,
    });
  }, [sections, autoLongueur]);

  useEffect(() => {
    const materials = {
      surface: results.surface,
      volume: results.volume,
      volumeCommande: results.volumeCommande,
      tonnageTotal: results.tonnageTotal,
      cimentT: results.cimentT,
      sableT: results.sableT,
      gravierT: results.gravierT,
      terreT: results.terreT,
      eauL: results.eauL,
      coutMateriaux: results.coutMateriaux,
      coutPose: results.coutPose,
    };

    onCostChange?.(results.total);
    onMateriauxChange?.(materials);
    setGlobalCost("accotements", results.total);
    setGlobalMaterials("accotements", materials);
    setGlobalResults("accotements", {
      longueur: autoLongueur,
      surface: results.surface,
      volume: results.volume,
      volumeCommande: results.volumeCommande,
      tonnageTotal: results.tonnageTotal,
    });
  }, [results, autoLongueur, onCostChange, onMateriauxChange, setGlobalCost, setGlobalMaterials, setGlobalResults]);

  const updateSection = (id, patch) => setSectionsRaw((prev) => (Array.isArray(prev) ? prev : []).map((section) => (
    section.id === id ? { ...section, ...patch } : section
  )));
  const addSection = () => setSectionsRaw((prev) => [...(Array.isArray(prev) ? prev : []), defaultSection(newType)]);
  const removeSection = (id) => setSectionsRaw((prev) => (Array.isArray(prev) ? prev : []).filter((section) => section.id !== id));

  const showToast = (text, type = "success") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 2500);
  };

  const handleSave = () => {
    if (results.volume <= 0) return showToast("Dimensions insuffisantes", "error");
    showToast("Accotements ajoutés à la synthèse");
  };

  const chartData = {
    labels: ["Ciment", "Sable", "Gravier", "Terre"],
    datasets: [{
      data: [results.cimentT, results.sableT, results.gravierT, results.terreT],
      backgroundColor: ["#ec4899", "#fbbf24", "#78716c", "#92400e"],
      borderColor: "#111827",
      borderWidth: 2,
    }],
  };

  return (
    <div className="w-full h-full flex flex-col bg-gray-900 text-gray-100 overflow-hidden relative font-sans">
      {message && (
        <div className={`fixed top-4 right-4 px-5 py-3 rounded-xl shadow-2xl z-50 font-bold ${
          message.type === "error" ? "bg-red-600" : "bg-pink-600"
        }`}>
          {message.text}
        </div>
      )}

      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-pink-500/20 rounded-lg text-pink-400">
            <Waypoints className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white uppercase tracking-tight">Accotements</h2>
            <p className="text-xs text-gray-400 font-medium">Stabilisation latérale liée à la chaussée</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-gray-500 uppercase font-bold block">Budget estimé</span>
          <span className="text-2xl font-black text-pink-400 tracking-tighter">
            {fmt(results.total)} <span className="text-sm text-gray-500 font-normal">{currency}</span>
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-6 pb-24">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <div className="xl:col-span-7 space-y-5">
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5">
              <h3 className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
                <Plus className="w-4 h-4" /> Ajouter une section
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
                <select
                  value={newType}
                  onChange={(event) => setNewType(event.target.value)}
                  className="bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-pink-500"
                >
                  {Object.entries(TYPES_ACCOTEMENT).map(([key, cfg]) => (
                    <option key={key} value={key}>{cfg.label}</option>
                  ))}
                </select>
                <button
                  onClick={addSection}
                  className="bg-pink-600 hover:bg-pink-500 text-white px-5 py-3 rounded-xl font-bold flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Ajouter
                </button>
              </div>
              {autoLongueur > 0 && (
                <p className="mt-3 text-xs text-pink-200/70">
                  Linéaire repris automatiquement : {fmtD(autoLongueur)} m
                </p>
              )}
            </div>

            {results.sectionsCalc.map((section) => (
              <div key={section.id} className="border border-gray-700 rounded-2xl overflow-hidden bg-gray-800/40">
                <div className="p-4 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => updateSection(section.id, { expanded: !section.expanded })}
                    className="flex items-center gap-3 text-left min-w-0"
                  >
                    <div className="p-2 bg-gray-950/50 rounded-xl">
                      <Waypoints className="w-5 h-5" style={{ color: section.config.color }} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-black text-white truncate">{section.label || section.config.label}</p>
                      <p className="text-xs text-gray-400">
                        {fmtD(section.surface)} m² | {fmtD(section.volume)} m³ | {fmtD(section.tonnage)} t
                      </p>
                    </div>
                  </button>
                  <div className="flex items-center gap-2">
                    <button onClick={() => removeSection(section.id)} className="p-2 rounded-lg text-red-400 hover:bg-red-500/10" aria-label="Supprimer">
                      <Trash2 className="w-4 h-4" />
                    </button>
                    {section.expanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                  </div>
                </div>

                {section.expanded && (
                  <div className="p-4 border-t border-gray-700/60 bg-gray-950/30">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <InputGroup label="Nom / repère" type="text" value={section.label} onChange={(value) => updateSection(section.id, { label: value })} />
                      <InputGroup label="Longueur (m)" value={section.longueur} onChange={(value) => updateSection(section.id, { longueur: value })} placeholder={autoLongueur ? fmtD(autoLongueur) : "auto"} />
                      <InputGroup label="Largeur accotement (m)" value={section.largeur} onChange={(value) => updateSection(section.id, { largeur: value })} />
                      <InputGroup label="Nombre de côtés" value={section.nbCotes} onChange={(value) => updateSection(section.id, { nbCotes: value })} />
                      <InputGroup label="Épaisseur (m)" value={section.epaisseur} onChange={(value) => updateSection(section.id, { epaisseur: value })} />
                      <InputGroup label="Pertes (%)" value={section.pertes} onChange={(value) => updateSection(section.id, { pertes: value })} />
                      <InputGroup label={`Prix matériau (${currency}/t)`} value={section.prixTonne} onChange={(value) => updateSection(section.id, { prixTonne: value })} />
                      <InputGroup label={`Prix matériau (${currency}/m³)`} value={section.prixM3} onChange={(value) => updateSection(section.id, { prixM3: value })} />
                      <InputGroup label={`Pose (${currency}/m²)`} value={section.poseM2} onChange={(value) => updateSection(section.id, { poseM2: value })} />
                    </div>
                    <div className="mt-4 rounded-2xl border border-gray-700 bg-gray-900/70 p-4">
                      <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-pink-300">Matériaux de cette section</p>
                      <div className="grid grid-cols-2 gap-3">
                        {section.cimentT > 0 && <MiniMaterial label="Ciment" value={`${fmt(section.cimentT, 2)} t`} />}
                        {section.sableT > 0 && <MiniMaterial label="Sable" value={`${fmt(section.sableT, 2)} t`} />}
                        {section.gravierT > 0 && <MiniMaterial label="Gravier" value={`${fmt(section.gravierT, 2)} t`} />}
                        {section.terreT > 0 && <MiniMaterial label="Terre" value={`${fmt(section.terreT, 2)} t`} />}
                        {section.eauL > 0 && <MiniMaterial label="Eau" value={`${fmt(section.eauL, 0)} L`} />}
                        {section.cimentT + section.sableT + section.gravierT + section.terreT + section.eauL === 0 && (
                          <p className="col-span-2 text-xs text-gray-500">Aucun matériau spécifique pour ce type avec les dimensions actuelles.</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="xl:col-span-5 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <ResultCard label="Surface" value={fmt(results.surface, 1)} unit="m²" icon={<Ruler className="w-4 h-4" />} />
              <ResultCard label="Volume" value={fmt(results.volume, 2)} unit="m³" icon={<Scale className="w-4 h-4" />} accent />
              <ResultCard label="Tonnage" value={fmt(results.tonnageTotal, 2)} unit="t" icon={<Waypoints className="w-4 h-4" />} />
              <ResultCard label="Eau" value={fmt(results.eauL, 0)} unit="L" icon={<Droplets className="w-4 h-4" />} />
              {results.cimentT > 0 && <ResultCard label="Ciment" value={fmt(results.cimentT, 2)} unit="t" icon={<Scale className="w-4 h-4" />} />}
              {results.terreT > 0 && <ResultCard label="Terre" value={fmt(results.terreT, 2)} unit="t" icon={<Scale className="w-4 h-4" />} />}
            </div>

            <div className="bg-gray-800 rounded-3xl p-6 border border-gray-700 shadow-xl">
              <div className="w-48 h-48 mx-auto relative">
                <Doughnut data={chartData} options={{ cutout: "72%", plugins: { legend: { display: false } } }} />
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[10px] text-gray-500 uppercase font-bold">Volume</span>
                  <span className="text-sm font-bold text-white">{fmt(results.volume, 2)} m³</span>
                </div>
              </div>
              <div className="mt-6 space-y-3">
                {results.cimentT > 0 && <MaterialRow label="Ciment" value={`${fmt(results.cimentT, 2)} t`} color="bg-pink-500" />}
                {results.sableT > 0 && <MaterialRow label="Sable" value={`${fmt(results.sableT, 2)} t`} color="bg-amber-400" />}
                {results.gravierT > 0 && <MaterialRow label="Gravier" value={`${fmt(results.gravierT, 2)} t`} color="bg-stone-500" />}
                {results.terreT > 0 && <MaterialRow label="Terre" value={`${fmt(results.terreT, 2)} t`} color="bg-orange-800" />}
                {results.cimentT + results.sableT + results.gravierT + results.terreT === 0 && (
                  <p className="text-center text-xs text-gray-500">Les matériaux apparaîtront selon le type d'accotement choisi.</p>
                )}
              </div>
            </div>

            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5">
              <h3 className="flex items-center gap-2 text-xs font-bold text-pink-300 uppercase tracking-widest mb-4">
                <Banknote className="w-4 h-4" /> Synthèse accotements
              </h3>
              <SummaryLine label="Coût matériaux" value={`${fmt(results.coutMateriaux)} ${currency}`} />
              <SummaryLine label="Coût pose" value={`${fmt(results.coutPose)} ${currency}`} />
              <SummaryLine label="Volume à commander" value={`${fmt(results.volumeCommande, 2)} m³`} />
              <div className="mt-4 pt-4 border-t border-pink-500/20 flex items-center justify-between">
                <span className="text-xs font-black uppercase text-pink-300">Total accotements</span>
                <span className="text-xl font-black text-white">{fmt(results.total)} {currency}</span>
              </div>
              <button
                onClick={handleSave}
                className="mt-5 w-full bg-pink-600 hover:bg-pink-500 text-white py-4 rounded-xl font-bold shadow-lg transition-all flex justify-center items-center gap-2 active:scale-95"
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
      className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none transition-all font-mono text-sm"
      placeholder={placeholder || "0"}
    />
  </div>
);

const ResultCard = ({ label, value, unit, icon, accent = false }) => (
  <div className={`rounded-2xl p-4 text-center border ${accent ? "bg-pink-500/10 border-pink-500/30" : "bg-gray-800/70 border-gray-700"}`}>
    <span className="text-[10px] text-gray-500 uppercase font-bold mb-1 flex items-center justify-center gap-1">
      {icon} {label}
    </span>
    <span className={`text-xl font-black ${accent ? "text-pink-300" : "text-white"}`}>
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

const MiniMaterial = ({ label, value }) => (
  <div className="rounded-xl border border-gray-700 bg-gray-950 px-3 py-2">
    <p className="text-[10px] font-bold uppercase text-gray-500">{label}</p>
    <p className="font-mono text-sm font-black text-white">{value}</p>
  </div>
);

const SummaryLine = ({ label, value }) => (
  <div className="flex items-center justify-between py-2 text-sm border-b border-gray-700/50 last:border-0">
    <span className="text-gray-400">{label}</span>
    <span className="font-mono font-bold text-white">{value}</span>
  </div>
);
