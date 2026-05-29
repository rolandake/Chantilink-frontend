import React, { useEffect, useMemo, useState } from "react";
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import {
  Home, Ruler, Save, Trash2, History, Layers, ShieldCheck, Wind,
  Info, ChevronDown, Link, Droplets,
} from "lucide-react";
import usePersistentState from "../../../../hooks/usePersistentState";
import { useProjectStore } from "../../../../store/useProjectStore";

ChartJS.register(ArcElement, Tooltip, Legend);

const STORAGE_KEY = "toiture-history-pro";

const TYPES_TOITURE = {
  tuiles: {
    label: "Couverture en tuiles",
    short: "Tuiles",
    color: "#f97316",
    boisM3parM2: 0.02,
    accessoireCoef: 0.08,
  },
  bac_acier: {
    label: "Couverture bac acier",
    short: "Bac acier",
    color: "#06b6d4",
    recouvrement: 1.10,
    boisM3parM2: 0.015,
    accessoireCoef: 0.06,
  },
  toit_terrasse: {
    label: "Toit-terrasse béton",
    short: "Toit-terrasse",
    color: "#6366f1",
    ciment: 0.350,
    sable: 0.6,
    gravier: 0.85,
    eau: 175,
    acierKgM3: 100,
    etancheiteM2: 1.05,
  },
};

const DEFAULT_INPUTS = {
  surface: "",
  pente: "30",
  epaisseur: "0.15",
  densiteTuiles: "12",
  prixUnitaire: "",
  prixEtancheite: "",
  coutMainOeuvre: "",
};

const fmt = (n) => Math.round(n || 0).toLocaleString("fr-FR");
const fmtD = (n, d = 2) => Number(n || 0).toFixed(d);

export default function Toiture({
  currency = "XOF",
  onTotalChange,
  onMateriauxChange,
}) {
  const [typeToiture, setTypeToiture] = usePersistentState("toiture:typeToiture", "tuiles");
  const [activeView, setActiveView] = usePersistentState("toiture:activeView", "ouvrages");
  const [savedInputs, setSavedInputs] = usePersistentState("toiture:inputs", DEFAULT_INPUTS);
  const inputs = useMemo(() => ({ ...DEFAULT_INPUTS, ...savedInputs }), [savedInputs]);
  const setInputs = (next) => {
    setSavedInputs((prev) => {
      const base = { ...DEFAULT_INPUTS, ...prev };
      const value = typeof next === "function" ? next(base) : next;
      return { ...DEFAULT_INPUTS, ...value };
    });
  };

  const [historique, setHistorique] = useState([]);
  const [message, setMessage] = useState(null);

  const dallesResults = useProjectStore((s) => s.subResults.dalles);
  const fondationResults = useProjectStore((s) => s.subResults.fondation);
  const setGlobalResults = useProjectStore((s) => s.setResults);
  const setGlobalMaterials = useProjectStore((s) => s.setMaterials);
  const setGlobalCost = useProjectStore((s) => s.setCost);

  const surfaceAuto = dallesResults?.surface || fondationResults?.surfaceSupport || 0;

  useEffect(() => {
    if (surfaceAuto > 0 && !inputs.surface) {
      setInputs((prev) => ({ ...prev, surface: fmtD(surfaceAuto) }));
    }
  }, [surfaceAuto]);

  const results = useMemo(() => {
    const config = TYPES_TOITURE[typeToiture] || TYPES_TOITURE.tuiles;
    const surfaceProjetee = parseFloat(inputs.surface) || 0;
    const pente = parseFloat(inputs.pente) || 0;
    const penteCoef = typeToiture === "toit_terrasse"
      ? 1
      : 1 / Math.max(0.1, Math.cos((pente * Math.PI) / 180));
    const surfaceReelle = surfaceProjetee * penteCoef;
    const pu = parseFloat(inputs.prixUnitaire) || 0;
    const prixEtancheite = parseFloat(inputs.prixEtancheite) || 0;
    const mo = parseFloat(inputs.coutMainOeuvre) || 0;

    let couverture = 0;
    let boisM3 = 0;
    let accessoires = 0;
    let volumeBeton = 0;
    let cimentT = 0;
    let cimentSacs = 0;
    let sableT = 0;
    let gravierT = 0;
    let eauL = 0;
    let acierKg = 0;
    let etancheiteM2 = 0;
    let surfaceCoffrage = 0;
    let coutMateriaux = 0;
    let coutEtancheite = 0;

    if (typeToiture === "tuiles") {
      couverture = surfaceReelle * (parseFloat(inputs.densiteTuiles) || 12);
      boisM3 = surfaceReelle * config.boisM3parM2;
      accessoires = surfaceReelle * config.accessoireCoef;
      coutMateriaux = couverture * pu;
    } else if (typeToiture === "bac_acier") {
      couverture = surfaceReelle * config.recouvrement;
      boisM3 = surfaceReelle * config.boisM3parM2;
      accessoires = surfaceReelle * config.accessoireCoef;
      coutMateriaux = couverture * pu;
    } else {
      volumeBeton = surfaceProjetee * (parseFloat(inputs.epaisseur) || 0.15);
      couverture = volumeBeton;
      cimentT = volumeBeton * config.ciment;
      cimentSacs = (cimentT * 1000) / 50;
      sableT = volumeBeton * config.sable;
      gravierT = volumeBeton * config.gravier;
      eauL = volumeBeton * config.eau;
      acierKg = volumeBeton * config.acierKgM3;
      etancheiteM2 = surfaceProjetee * config.etancheiteM2;
      surfaceCoffrage = surfaceProjetee;
      coutMateriaux = volumeBeton * pu;
      coutEtancheite = etancheiteM2 * prixEtancheite;
    }

    const total = coutMateriaux + coutEtancheite + mo;

    return {
      surfaceProjetee,
      surfaceReelle,
      penteCoef,
      couverture,
      boisM3,
      accessoires,
      volumeBeton,
      cimentT,
      cimentSacs,
      sableT,
      gravierT,
      eauL,
      acierKg,
      acierT: acierKg / 1000,
      etancheiteM2,
      surfaceCoffrage,
      coutMateriaux,
      coutEtancheite,
      mo,
      total,
    };
  }, [inputs, typeToiture]);

  useEffect(() => {
    onTotalChange?.(results.total);
    const materials = {
      volume: results.volumeBeton,
      ciment: results.cimentT,
      sable: results.sableT,
      gravier: results.gravierT,
      eau: results.eauL,
      acier: results.acierT,
      bois: results.boisM3,
      couverture: results.couverture,
      etancheite: results.etancheiteM2,
      coffrage: results.surfaceCoffrage,
    };
    onMateriauxChange?.(materials);
    setGlobalCost("toiture", results.total);
    setGlobalMaterials("toiture", materials);
    setGlobalResults("toiture", {
      typeToiture,
      surfaceProjetee: results.surfaceProjetee,
      surfaceReelle: results.surfaceReelle,
      volumeBeton: results.volumeBeton,
      boisM3: results.boisM3,
      couverture: results.couverture,
      etancheiteM2: results.etancheiteM2,
      surfaceCoffrage: results.surfaceCoffrage,
    });
  }, [results.total, results.surfaceProjetee, results.surfaceReelle, results.volumeBeton, results.boisM3, results.couverture, results.etancheiteM2, results.surfaceCoffrage, typeToiture]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setHistorique(JSON.parse(saved));
    } catch {}
  }, []);

  const showToast = (msg, type = "success") => {
    setMessage({ text: msg, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleSave = () => {
    if (results.surfaceProjetee <= 0) return showToast("Surface de toiture manquante", "error");
    const newEntry = {
      id: Date.now(),
      date: new Date().toLocaleString("fr-FR"),
      type: TYPES_TOITURE[typeToiture].label,
      ...inputs,
      ...results,
    };
    const next = [newEntry, ...historique];
    setHistorique(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
    showToast("Devis toiture enregistré");
  };

  const clearHistory = () => {
    setHistorique([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  const chartData = {
    labels: ["Matériaux", "Étanchéité", "Main d'œuvre"],
    datasets: [{
      data: [results.coutMateriaux, results.coutEtancheite, results.mo],
      backgroundColor: [TYPES_TOITURE[typeToiture].color, "#2563eb", "#374151"],
      borderColor: "#111827",
      borderWidth: 2,
    }],
  };

  return (
    <div className="w-full h-full flex flex-col bg-gray-900 text-gray-100 overflow-hidden relative">
      {message && (
        <div className={`fixed top-4 right-4 px-6 py-3 rounded-xl shadow-2xl z-50 font-bold animate-in fade-in slide-in-from-top-2 ${
          message.type === "error" ? "bg-red-600" : "bg-orange-600"
        }`}>
          {message.text}
        </div>
      )}

      <div className="shrink-0 px-6 py-4 border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg" style={{ backgroundColor: `${TYPES_TOITURE[typeToiture].color}20`, color: TYPES_TOITURE[typeToiture].color }}>
            <Home className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Mise hors d'eau : Toiture</h2>
            <p className="text-xs text-gray-400">Charpente, couverture & étanchéité</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="min-w-[220px]">
            <label className="block mb-1 text-[9px] text-gray-500 uppercase font-bold tracking-wider">
              Ouvrage de toiture
            </label>
            <div className="relative">
              <select
                value={typeToiture}
                onChange={(e) => {
                  setTypeToiture(e.target.value);
                  setActiveView("ouvrages");
                }}
                className="w-full appearance-none bg-gray-950 border border-gray-700 rounded-xl px-3 py-2.5 pr-9 text-sm text-white focus:border-orange-500 focus:outline-none"
              >
                {Object.entries(TYPES_TOITURE).map(([id, t]) => (
                  <option key={id} value={id}>{t.label}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            </div>
          </div>
          <div className="text-right min-w-[130px]">
            <span className="text-[10px] text-gray-500 uppercase font-bold block">Budget toiture</span>
            <span className="text-2xl font-black text-orange-400 tracking-tighter">
              {fmt(results.total)} <span className="text-sm text-gray-500 font-normal">{currency}</span>
            </span>
          </div>
        </div>
      </div>

      <div className="shrink-0 flex border-b border-gray-800 bg-gray-900">
        {[["ouvrages", "Ouvrages"], ["synthese", "Synthèse"]].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveView(key)}
            className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors ${
              activeView === key ? "text-orange-400 border-b-2 border-orange-400" : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden">
        {activeView === "ouvrages" ? (
          <ToitureOuvrage
            currency={currency}
            typeToiture={typeToiture}
            inputs={inputs}
            setInputs={setInputs}
            results={results}
            surfaceAuto={surfaceAuto}
            chartData={chartData}
            handleSave={handleSave}
            historique={historique}
            clearHistory={clearHistory}
          />
        ) : (
          <ToitureSynthese
            currency={currency}
            typeToiture={typeToiture}
            results={results}
            historique={historique}
          />
        )}
      </div>
    </div>
  );
}

const ToitureOuvrage = ({
  currency, typeToiture, inputs, setInputs, results, surfaceAuto,
  chartData, handleSave, historique, clearHistory,
}) => (
  <div className="h-full overflow-y-auto p-4 lg:p-6 pb-24">
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
      <div className="lg:col-span-5 flex flex-col gap-5">
        {surfaceAuto > 0 && (
          <div className="flex items-start gap-3 p-3 bg-orange-500/8 border border-orange-500/25 rounded-2xl">
            <Link className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-[10px] text-orange-300 font-bold uppercase tracking-wider">Surface récupérée automatiquement</p>
              <p className="text-xs text-orange-200/70">
                Surface de référence : <span className="font-mono font-bold text-orange-300">{fmtD(surfaceAuto)} m²</span>
              </p>
              <button
                onClick={() => setInputs((prev) => ({ ...prev, surface: fmtD(surfaceAuto) }))}
                className="mt-2 text-[10px] bg-orange-500/20 border border-orange-500/40 text-orange-300 px-3 py-1 rounded-lg font-bold hover:bg-orange-500/30 transition-all"
              >
                Appliquer cette surface
              </button>
            </div>
          </div>
        )}

        <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5 space-y-5 shadow-xl">
          <h3 className="flex items-center gap-2 text-xs font-bold text-orange-400 uppercase tracking-widest">
            <Ruler className="w-4 h-4" /> Géométrie de toiture
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <InputGroup label="Surface projetée (m²)" value={inputs.surface} onChange={(v) => setInputs({ ...inputs, surface: v })} full />
            {typeToiture !== "toit_terrasse" && (
              <InputGroup label="Pente toiture (°)" value={inputs.pente} onChange={(v) => setInputs({ ...inputs, pente: v })} />
            )}
            {typeToiture === "tuiles" && (
              <InputGroup label="Densité tuiles/m²" value={inputs.densiteTuiles} onChange={(v) => setInputs({ ...inputs, densiteTuiles: v })} />
            )}
            {typeToiture === "toit_terrasse" && (
              <InputGroup label="Épaisseur dalle (m)" value={inputs.epaisseur} onChange={(v) => setInputs({ ...inputs, epaisseur: v })} />
            )}
          </div>
        </div>

        <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5 space-y-4 shadow-xl">
          <div className="grid grid-cols-2 gap-4">
            <InputGroup label={`Prix unitaire (${currency})`} value={inputs.prixUnitaire} onChange={(v) => setInputs({ ...inputs, prixUnitaire: v })} />
            <InputGroup label={`Main d'œuvre (${currency})`} value={inputs.coutMainOeuvre} onChange={(v) => setInputs({ ...inputs, coutMainOeuvre: v })} />
            {typeToiture === "toit_terrasse" && (
              <InputGroup label={`Étanchéité (${currency}/m²)`} value={inputs.prixEtancheite} onChange={(v) => setInputs({ ...inputs, prixEtancheite: v })} full />
            )}
          </div>
          <button onClick={handleSave} className="w-full bg-orange-600 hover:bg-orange-500 text-white py-4 rounded-xl font-bold shadow-lg transition-all flex justify-center items-center gap-2">
            <Save className="w-5 h-5" /> Enregistrer le calcul
          </button>
        </div>
      </div>

      <div className="lg:col-span-7 flex flex-col gap-6">
        <div className="grid grid-cols-3 gap-4">
          <ResultCard
            label={typeToiture === "tuiles" ? "Tuiles" : typeToiture === "toit_terrasse" ? "Béton toiture" : "Bac acier"}
            value={fmtD(results.couverture, typeToiture === "tuiles" ? 0 : 2)}
            unit={typeToiture === "tuiles" ? "u" : typeToiture === "toit_terrasse" ? "m³" : "m²"}
            icon={<Layers className="w-4 h-4" />}
            color="text-orange-400"
            bg="bg-orange-500/10"
          />
          <ResultCard
            label={typeToiture === "toit_terrasse" ? "Étanchéité" : "Charpente"}
            value={typeToiture === "toit_terrasse" ? fmtD(results.etancheiteM2, 1) : fmtD(results.boisM3, 3)}
            unit={typeToiture === "toit_terrasse" ? "m²" : "m³"}
            icon={<Wind className="w-4 h-4" />}
            color="text-emerald-400"
            bg="bg-emerald-500/10"
            border
          />
          <ResultCard
            label="Surface réelle"
            value={fmtD(results.surfaceReelle, 1)}
            unit="m²"
            icon={<ShieldCheck className="w-4 h-4" />}
            color="text-blue-400"
            bg="bg-blue-500/10"
          />
        </div>

        <div className="flex-1 bg-gray-800 rounded-2xl p-6 border border-gray-700 shadow-xl flex flex-col md:flex-row gap-8 items-center">
          <div className="w-44 h-44 flex-shrink-0 relative">
            <Doughnut data={chartData} options={{ cutout: "75%", plugins: { legend: { display: false } } }} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[10px] text-gray-500 uppercase font-bold text-center leading-tight">Coût<br />toiture</span>
            </div>
          </div>
          <div className="flex-1 w-full space-y-3">
            <h4 className="text-gray-400 text-xs font-bold uppercase tracking-widest border-b border-gray-700 pb-2">Détails techniques</h4>
            {typeToiture === "toit_terrasse" ? (
              <>
                <MaterialRow label="Ciment" val={`${fmtD(results.cimentT)} t (${fmtD(results.cimentSacs, 0)} sacs)`} color="bg-orange-500" />
                <MaterialRow label="Sable" val={`${fmtD(results.sableT)} t`} color="bg-amber-500" />
                <MaterialRow label="Gravier" val={`${fmtD(results.gravierT)} t`} color="bg-stone-500" />
                <MaterialRow label="Acier HA" val={`${fmtD(results.acierKg, 0)} kg`} color="bg-blue-500" />
                <MaterialRow label="Étanchéité" val={`${fmtD(results.etancheiteM2, 1)} m²`} color="bg-indigo-500" />
                <MaterialRow label="Coffrage / étaiement" val={`${fmtD(results.surfaceCoffrage, 1)} m²`} color="bg-cyan-500" />
                <div className="pt-2 border-t border-gray-700 flex justify-between items-center">
                  <span className="text-xs text-gray-400 flex items-center gap-1"><Droplets className="w-3 h-3 text-cyan-400" /> Eau</span>
                  <span className="text-sm font-bold text-white font-mono">{fmtD(results.eauL, 0)} L</span>
                </div>
              </>
            ) : (
              <>
                <MaterialRow label="Surface projetée" val={`${fmtD(results.surfaceProjetee)} m²`} color="bg-blue-500" />
                <MaterialRow label="Surface réelle avec pente" val={`${fmtD(results.surfaceReelle)} m²`} color="bg-orange-500" />
                <MaterialRow label="Bois de charpente" val={`${fmtD(results.boisM3, 3)} m³`} color="bg-emerald-500" />
                <MaterialRow label="Accessoires estimés" val={`${fmtD(results.accessoires)} ml`} color="bg-indigo-500" />
              </>
            )}
            <div className="flex items-start gap-2 p-3 bg-blue-500/5 rounded-xl border border-blue-500/20">
              <Info className="w-4 h-4 text-blue-400 mt-0.5" />
              <p className="text-[10px] text-blue-200/70 leading-relaxed italic">
                {typeToiture === "toit_terrasse"
                  ? "Le toit-terrasse inclut la dalle béton, l'acier estimatif, le coffrage/étaiement et l'étanchéité."
                  : "La surface réelle tient compte de la pente. Le bois est une estimation de charpente légère/traditionnelle."}
              </p>
            </div>
          </div>
        </div>

        {historique.length > 0 && (
          <div className="bg-gray-800/30 rounded-2xl border border-gray-700/50 overflow-hidden">
            <div className="px-4 py-2 bg-gray-800/50 flex justify-between items-center border-b border-gray-700/50">
              <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2"><History className="w-3 h-3" /> Devis récents</h4>
              <button onClick={clearHistory} className="text-[10px] text-red-400 hover:underline flex items-center gap-1"><Trash2 className="w-3 h-3" /> Vider</button>
            </div>
            <div className="max-h-[120px] overflow-y-auto">
              {historique.slice(0, 5).map((item) => (
                <div key={item.id} className="flex justify-between items-center p-3 border-b border-gray-700/30 text-xs">
                  <div>
                    <span className="text-gray-500 text-[9px] block">{item.date}</span>
                    <span className="font-medium uppercase">{item.type}</span> - {item.surfaceProjetee || item.surface} m²
                  </div>
                  <span className="font-bold text-orange-400">{fmt(item.total)} {currency}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  </div>
);

const ToitureSynthese = ({ currency, typeToiture, results, historique }) => (
  <div className="h-full overflow-y-auto bg-gray-900 text-gray-100 p-4 lg:p-6">
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
      <div className="xl:col-span-5 bg-gray-800/60 border border-orange-500/20 rounded-2xl p-4">
        <p className="text-[10px] text-orange-300 uppercase font-bold tracking-widest">Synthèse toiture</p>
        <div className="mt-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] text-gray-500">Ouvrage actif</p>
            <p className="text-lg font-black text-white">{TYPES_TOITURE[typeToiture].label}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-gray-500 uppercase font-bold">Total</p>
            <p className="text-xl font-black text-orange-400">{fmt(results.total)} <span className="text-xs text-gray-500">{currency}</span></p>
          </div>
        </div>
      </div>

      <div className="xl:col-span-7 bg-gray-800/50 border border-gray-700 rounded-2xl p-4">
        <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-3">Récapitulatif interne</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <ReadonlySummaryField label="Surface projetée" value={fmtD(results.surfaceProjetee)} unit="m²" />
          <ReadonlySummaryField label="Surface réelle" value={fmtD(results.surfaceReelle)} unit="m²" />
          <ReadonlySummaryField label="Couverture" value={fmtD(results.couverture, typeToiture === "tuiles" ? 0 : 2)} unit={typeToiture === "tuiles" ? "u" : typeToiture === "toit_terrasse" ? "m³" : "m²"} />
          <ReadonlySummaryField label="Bois" value={fmtD(results.boisM3, 3)} unit="m³" />
          <ReadonlySummaryField label="Étanchéité" value={fmtD(results.etancheiteM2, 1)} unit="m²" />
          <ReadonlySummaryField label="Coffrage" value={fmtD(results.surfaceCoffrage, 1)} unit="m²" />
          <ReadonlySummaryField label="Ciment" value={fmtD(results.cimentT)} unit="t" />
          <ReadonlySummaryField label="Acier" value={fmtD(results.acierKg, 0)} unit="kg" />
          <ReadonlySummaryField label="Historique" value={historique.length} unit="calc." />
        </div>
      </div>
    </div>
  </div>
);

const InputGroup = ({ label, value, onChange, placeholder, full = false }) => (
  <div className={`flex flex-col ${full ? "col-span-2" : ""}`}>
    <label className="mb-1 text-[10px] font-bold text-gray-500 uppercase tracking-wide">{label}</label>
    <input
      type="number"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-gray-900 border border-gray-600 rounded-xl px-4 py-2.5 text-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all font-mono text-sm"
      placeholder={placeholder || "0"}
    />
  </div>
);

const ResultCard = ({ label, value, unit, color, bg, border, icon }) => (
  <div className={`rounded-2xl p-4 flex flex-col justify-center items-center text-center ${bg} ${border ? "border border-gray-700" : ""}`}>
    <span className="text-[10px] text-gray-500 uppercase font-bold mb-1 flex items-center gap-1">{icon} {label}</span>
    <span className={`text-xl font-black ${color}`}>
      {value} <span className="text-xs font-normal text-gray-500 lowercase">{unit}</span>
    </span>
  </div>
);

const MaterialRow = ({ label, val, color }) => (
  <div className="flex justify-between items-center border-b border-gray-700/30 pb-2 last:border-0">
    <div className="flex items-center gap-2">
      <div className={`w-1.5 h-1.5 rounded-full ${color}`} />
      <span className="text-gray-300 text-xs font-medium">{label}</span>
    </div>
    <span className="text-xs font-bold text-white font-mono">{val}</span>
  </div>
);

const ReadonlySummaryField = ({ label, value, unit }) => (
  <div>
    <label className="block mb-1 text-[10px] font-bold text-gray-500 uppercase tracking-wide leading-tight">{label}</label>
    <div className="flex items-center gap-2 rounded-xl border border-gray-700 bg-gray-950/70 px-3 py-2">
      <input readOnly value={value} className="min-w-0 flex-1 bg-transparent text-sm font-mono font-bold text-white outline-none" />
      <span className="text-[10px] font-bold uppercase text-gray-500">{unit}</span>
    </div>
  </div>
);
