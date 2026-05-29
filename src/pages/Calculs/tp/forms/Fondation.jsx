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
  Layers,
  Mountain,
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

const TYPES_OUVRAGE = {
  FORME: {
    label: "Couche de forme",
    icon: Mountain,
    color: "text-orange-400",
    bg: "bg-orange-500/10",
    border: "border-orange-500/30",
    epaisseur: "0.25",
    densite: 1.9,
    coeff: 1.25,
    sable: 0.4,
    gravier: 0.2,
    terre: 0.4,
  },
  FONDATION_GNT: {
    label: "Couche de fondation GNT",
    icon: Layers,
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    epaisseur: "0.20",
    densite: 2.1,
    coeff: 1.25,
    sable: 0.3,
    gravier: 0.7,
    terre: 0,
  },
  BASE_GRANULAIRE: {
    label: "Couche de base granulaire",
    icon: Scale,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    epaisseur: "0.15",
    densite: 2.1,
    coeff: 1.2,
    sable: 0.25,
    gravier: 0.75,
    terre: 0,
  },
  STABILISEE: {
    label: "Couche stabilisée au ciment",
    icon: Truck,
    color: "text-sky-400",
    bg: "bg-sky-500/10",
    border: "border-sky-500/30",
    epaisseur: "0.18",
    densite: 2,
    coeff: 1.15,
    sable: 0.35,
    gravier: 0.6,
    terre: 0,
    cimentRatio: 0.06,
  },
};

const fmt = (value, decimals = 0) =>
  Number(value || 0).toLocaleString("fr-FR", { maximumFractionDigits: decimals });
const fmtD = (value) => Number(value || 0).toFixed(2);
const num = (value) => Number.parseFloat(value) || 0;

const defaultOuvrage = (type = "FONDATION_GNT") => ({
  id: Date.now() + Math.random(),
  type,
  label: "",
  longueur: "",
  largeur: "",
  surface: "",
  epaisseur: TYPES_OUVRAGE[type]?.epaisseur || "0.20",
  pertes: "5",
  prixTonne: "",
  poseM2: "",
  expanded: true,
});

export default function Fondation({ currency = "XOF", onCostChange, onMateriauxChange }) {
  const terrassement = useProjectStore((state) => state.subResults.terrassement);
  const setGlobalCost = useProjectStore((state) => state.setCost);
  const setGlobalMaterials = useProjectStore((state) => state.setMaterials);
  const setGlobalResults = useProjectStore((state) => state.setResults);

  const [ouvrages, setOuvrages] = usePersistentState("tp:fondation:ouvrages", [
    defaultOuvrage("FORME"),
    defaultOuvrage("FONDATION_GNT"),
  ]);
  const [newType, setNewType] = usePersistentState("tp:fondation:newType", "FONDATION_GNT");
  const [message, setMessage] = useState(null);

  const refs = useMemo(() => ({
    longueur: terrassement?.longueurReference || 0,
    largeur: terrassement?.largeurReference || 0,
    surface: terrassement?.surfacePlateforme || 0,
  }), [terrassement?.longueurReference, terrassement?.largeurReference, terrassement?.surfacePlateforme]);

  const getEffective = (ouvrage) => {
    const longueur = num(ouvrage.longueur) || refs.longueur;
    const largeur = num(ouvrage.largeur) || refs.largeur;
    const surface = num(ouvrage.surface) || (longueur && largeur ? longueur * largeur : refs.surface);
    return { longueur, largeur, surface };
  };

  const results = useMemo(() => {
    let surfaceTotale = 0;
    let volumeCompacte = 0;
    let volumeCommande = 0;
    let tonnageTotal = 0;
    let sableT = 0;
    let gravierT = 0;
    let terreT = 0;
    let cimentT = 0;
    let coutMateriaux = 0;
    let coutPose = 0;

    const ouvragesCalc = ouvrages.map((ouvrage) => {
      const def = TYPES_OUVRAGE[ouvrage.type] || TYPES_OUVRAGE.FONDATION_GNT;
      const effective = getEffective(ouvrage);
      const epaisseur = num(ouvrage.epaisseur) || num(def.epaisseur);
      const pertes = 1 + num(ouvrage.pertes) / 100;
      const volumeNet = effective.surface * epaisseur;
      const volumeBrut = volumeNet * def.coeff * pertes;
      const tonnage = volumeBrut * def.densite;
      const sable = tonnage * def.sable;
      const gravier = tonnage * def.gravier;
      const terre = tonnage * def.terre;
      const ciment = tonnage * (def.cimentRatio || 0);
      const cout = tonnage * num(ouvrage.prixTonne) + effective.surface * num(ouvrage.poseM2);

      surfaceTotale += effective.surface;
      volumeCompacte += volumeNet;
      volumeCommande += volumeBrut;
      tonnageTotal += tonnage;
      sableT += sable;
      gravierT += gravier;
      terreT += terre;
      cimentT += ciment;
      coutMateriaux += tonnage * num(ouvrage.prixTonne);
      coutPose += effective.surface * num(ouvrage.poseM2);

      return {
        ...ouvrage,
        def,
        effective,
        volumeNet,
        volumeBrut,
        tonnage,
        sable,
        gravier,
        terre,
        ciment,
        cout,
      };
    });

    return {
      ouvragesCalc,
      surfaceTotale,
      volumeCompacte,
      volumeCommande,
      tonnageTotal,
      sableT,
      gravierT,
      terreT,
      cimentT,
      nombreCamions: volumeCommande > 0 ? Math.ceil(volumeCommande / 16) : 0,
      coutMateriaux,
      coutPose,
      total: coutMateriaux + coutPose,
    };
  }, [ouvrages, refs]);

  useEffect(() => {
    const materials = {
      surface: results.surfaceTotale,
      volume: results.volumeCompacte,
      volumeCommande: results.volumeCommande,
      tonnageTotal: results.tonnageTotal,
      fondationT: results.tonnageTotal,
      sableT: results.sableT,
      gravierT: results.gravierT,
      terreT: results.terreT,
      cimentT: results.cimentT,
      nombreCamions: results.nombreCamions,
    };

    onCostChange?.(results.total);
    onMateriauxChange?.(materials);
    setGlobalCost("fondation", results.total);
    setGlobalMaterials("fondation", materials);
    setGlobalResults("fondation", {
      surface: results.surfaceTotale,
      volume: results.volumeCompacte,
      volumeCommande: results.volumeCommande,
      tonnageTotal: results.tonnageTotal,
      longueurReference: refs.longueur,
      largeurReference: refs.largeur,
      nombreCamions: results.nombreCamions,
    });
  }, [results, refs.longueur, refs.largeur, onCostChange, onMateriauxChange, setGlobalCost, setGlobalMaterials, setGlobalResults]);

  const updateOuvrage = (id, patch) => setOuvrages((prev) => prev.map((ouvrage) => (
    ouvrage.id === id ? { ...ouvrage, ...patch } : ouvrage
  )));

  const addOuvrage = () => setOuvrages((prev) => [...prev, defaultOuvrage(newType)]);
  const removeOuvrage = (id) => setOuvrages((prev) => prev.filter((ouvrage) => ouvrage.id !== id));

  const showToast = (text, type = "success") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 2500);
  };

  const handleSave = () => {
    if (results.volumeCompacte <= 0) return showToast("Dimensions insuffisantes", "error");
    showToast("Fondation TP enregistrée dans la synthèse");
  };

  const chartData = {
    labels: ["Sable", "Gravier", "Terre", "Ciment"],
    datasets: [{
      data: [results.sableT, results.gravierT, results.terreT, results.cimentT],
      backgroundColor: ["#fbbf24", "#78716c", "#92400e", "#38bdf8"],
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
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white uppercase tracking-tight">Fondation TP</h2>
            <p className="text-xs text-gray-400 font-medium">Couches de forme, fondation et base</p>
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
                <Plus className="w-4 h-4" /> Ajouter un ouvrage
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
                <select
                  value={newType}
                  onChange={(event) => setNewType(event.target.value)}
                  className="bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-orange-500"
                >
                  {Object.entries(TYPES_OUVRAGE).map(([key, def]) => (
                    <option key={key} value={key}>{def.label}</option>
                  ))}
                </select>
                <button
                  onClick={addOuvrage}
                  className="bg-orange-600 hover:bg-orange-500 text-white px-5 py-3 rounded-xl font-bold flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Ajouter
                </button>
              </div>
              {refs.surface > 0 && (
                <p className="mt-3 text-xs text-orange-200/70">
                  Surface reprise du terrassement : {fmtD(refs.surface)} m²
                </p>
              )}
            </div>

            {results.ouvragesCalc.map((ouvrage) => {
              const Icon = ouvrage.def.icon;
              return (
                <div key={ouvrage.id} className={`border rounded-2xl overflow-hidden ${ouvrage.def.bg} ${ouvrage.def.border}`}>
                  <div className="p-4 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => updateOuvrage(ouvrage.id, { expanded: !ouvrage.expanded })}
                      className="flex items-center gap-3 text-left min-w-0"
                    >
                      <div className="p-2 bg-gray-950/50 rounded-xl">
                        <Icon className={`w-5 h-5 ${ouvrage.def.color}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-black text-white truncate">{ouvrage.label || ouvrage.def.label}</p>
                        <p className="text-xs text-gray-400">
                          {fmtD(ouvrage.effective.surface)} m² | {fmtD(ouvrage.volumeNet)} m³ | {fmtD(ouvrage.tonnage)} t
                        </p>
                      </div>
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => removeOuvrage(ouvrage.id)}
                        className="p-2 rounded-lg text-red-400 hover:bg-red-500/10"
                        aria-label="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      {ouvrage.expanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                    </div>
                  </div>

                  {ouvrage.expanded && (
                    <div className="p-4 border-t border-gray-700/60 bg-gray-950/30">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <InputGroup label="Nom / repère" value={ouvrage.label} onChange={(value) => updateOuvrage(ouvrage.id, { label: value })} type="text" />
                        <InputGroup label="Surface directe (m²)" value={ouvrage.surface} onChange={(value) => updateOuvrage(ouvrage.id, { surface: value })} placeholder={refs.surface ? fmtD(refs.surface) : "auto"} />
                        <InputGroup label="Longueur (m)" value={ouvrage.longueur} onChange={(value) => updateOuvrage(ouvrage.id, { longueur: value })} placeholder={refs.longueur ? fmtD(refs.longueur) : "auto"} />
                        <InputGroup label="Largeur (m)" value={ouvrage.largeur} onChange={(value) => updateOuvrage(ouvrage.id, { largeur: value })} placeholder={refs.largeur ? fmtD(refs.largeur) : "auto"} />
                        <InputGroup label="Épaisseur (m)" value={ouvrage.epaisseur} onChange={(value) => updateOuvrage(ouvrage.id, { epaisseur: value })} />
                        <InputGroup label="Pertes / compactage chantier (%)" value={ouvrage.pertes} onChange={(value) => updateOuvrage(ouvrage.id, { pertes: value })} />
                        <InputGroup label={`Prix matériau (${currency}/t)`} value={ouvrage.prixTonne} onChange={(value) => updateOuvrage(ouvrage.id, { prixTonne: value })} />
                        <InputGroup label={`Pose (${currency}/m²)`} value={ouvrage.poseM2} onChange={(value) => updateOuvrage(ouvrage.id, { poseM2: value })} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="xl:col-span-5 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <ResultCard label="Surface" value={fmt(results.surfaceTotale, 1)} unit="m²" icon={<Ruler className="w-4 h-4" />} />
              <ResultCard label="Volume compacté" value={fmt(results.volumeCompacte, 2)} unit="m³" icon={<Layers className="w-4 h-4" />} accent />
              <ResultCard label="Volume à commander" value={fmt(results.volumeCommande, 2)} unit="m³" icon={<Truck className="w-4 h-4" />} />
              <ResultCard label="Tonnage" value={fmt(results.tonnageTotal, 2)} unit="t" icon={<Scale className="w-4 h-4" />} />
            </div>

            <div className="bg-gray-800 rounded-3xl p-6 border border-gray-700 shadow-xl">
              <div className="w-48 h-48 mx-auto relative">
                <Doughnut data={chartData} options={{ cutout: "72%", plugins: { legend: { display: false } } }} />
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[10px] text-gray-500 uppercase font-bold">Total</span>
                  <span className="text-sm font-bold text-white">{fmt(results.tonnageTotal, 1)} t</span>
                </div>
              </div>
              <div className="mt-6 space-y-3">
                <MaterialRow label="Sable" value={`${fmt(results.sableT, 2)} t`} color="bg-amber-400" />
                <MaterialRow label="Gravier" value={`${fmt(results.gravierT, 2)} t`} color="bg-stone-500" />
                <MaterialRow label="Terre sélectionnée" value={`${fmt(results.terreT, 2)} t`} color="bg-orange-800" />
                <MaterialRow label="Ciment" value={`${fmt(results.cimentT, 2)} t`} color="bg-sky-400" />
              </div>
            </div>

            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5">
              <h3 className="flex items-center gap-2 text-xs font-bold text-orange-300 uppercase tracking-widest mb-4">
                <Banknote className="w-4 h-4" /> Synthèse fondation
              </h3>
              <SummaryLine label="Coût matériaux" value={`${fmt(results.coutMateriaux)} ${currency}`} />
              <SummaryLine label="Coût pose" value={`${fmt(results.coutPose)} ${currency}`} />
              <SummaryLine label="Camions estimés (16 m³)" value={`${results.nombreCamions} u`} />
              <div className="mt-4 pt-4 border-t border-orange-500/20 flex items-center justify-between">
                <span className="text-xs font-black uppercase text-orange-300">Total fondation</span>
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
    <label className="mb-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-wide">{label}</label>
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
