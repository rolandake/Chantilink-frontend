import React, { useCallback, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Activity,
  BarChart3,
  Cable,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Download,
  FileSpreadsheet,
  FileText,
  HardHat,
  Map as MapIcon,
  Plus,
  Route,
  ShieldAlert,
  Signal,
  Train,
  Trash2,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import usePersistentState from "../../../hooks/usePersistentState";
import {
  addPdfFooters,
  createChantilinkLogoCanvas,
  drawChantilinkHeader,
  fmtPdfMoney,
} from "../utils/exportBranding";

const STEP_CONFIG = [
  {
    id: "etudes",
    label: "Études & conception",
    icon: FileText,
    color: "text-blue-300",
    types: {
      faisabilite: { label: "Étude de faisabilité", unit: "km", materialKey: "lineaireKm", desc: "Analyse tracé, trafic, coûts et variantes." },
      conception: { label: "Conception préliminaire", unit: "km", materialKey: "lineaireEtudesKm", desc: "APS/APD et choix techniques." },
      detaillees: { label: "Études détaillées", unit: "u", materialKey: "dossiersEtudes", desc: "Plans, notes et dossiers d'exécution." },
    },
  },
  {
    id: "foncier",
    label: "Foncier & emprise",
    icon: MapIcon,
    color: "text-orange-300",
    types: {
      emprise: { label: "Emprise ferroviaire", unit: "ha", materialKey: "empriseHa", desc: "Surface foncière à libérer." },
      indemnite: { label: "Indemnisation", unit: "u", materialKey: "parcelles", desc: "Parcelles ou biens impactés." },
      liberation: { label: "Libération d'emprise", unit: "km", materialKey: "empriseKm", desc: "Nettoyage et préparation foncière." },
    },
  },
  {
    id: "terrassement",
    label: "Plateforme & terrassement",
    icon: HardHat,
    color: "text-stone-300",
    types: {
      deblais: { label: "Déblais", unit: "m³", materialKey: "deblais", desc: "Excavations de plateforme." },
      remblais: { label: "Remblais", unit: "m³", materialKey: "remblais", desc: "Remblais ferroviaires compactés." },
      coucheForme: { label: "Couche de forme", unit: "m³", materialKey: "coucheForme", desc: "Structure support de voie." },
    },
  },
  {
    id: "ouvrages",
    label: "Ouvrages d'art",
    icon: Route,
    color: "text-cyan-300",
    types: {
      pont: { label: "Pont ferroviaire", unit: "m", materialKey: "pontsMl", desc: "Ouvrages de franchissement." },
      dalot: { label: "Dalots / buses", unit: "u", materialKey: "ouvragesHydrauliques", desc: "Drainage et franchissements hydrauliques." },
      mur: { label: "Murs de soutènement", unit: "m²", materialKey: "mursM2", desc: "Soutènement de plateforme." },
    },
  },
  {
    id: "voie",
    label: "Voie ferrée",
    icon: Train,
    color: "text-indigo-300",
    types: {
      rails: { label: "Rails", unit: "m", materialKey: "railsMl", desc: "Longueur totale de rails." },
      traverses: { label: "Traverses", unit: "u", materialKey: "traverses", desc: "Traverses béton/bois/acier." },
      ballast: { label: "Ballast", unit: "m³", materialKey: "ballast", desc: "Ballast de voie." },
    },
  },
  {
    id: "electrification",
    label: "Électrification",
    icon: Zap,
    color: "text-yellow-300",
    types: {
      catenaire: { label: "Caténaire", unit: "km", materialKey: "catenaireKm", desc: "Ligne aérienne de traction." },
      sousStation: { label: "Sous-stations", unit: "u", materialKey: "sousStations", desc: "Postes de traction." },
      alimentation: { label: "Alimentation", unit: "km", materialKey: "alimentationKm", desc: "Réseau d'alimentation électrique." },
    },
  },
  {
    id: "signalisation",
    label: "Signalisation & télécom",
    icon: Signal,
    color: "text-rose-300",
    types: {
      signaux: { label: "Signaux", unit: "u", materialKey: "signaux", desc: "Signalisation lumineuse/latérale." },
      telecom: { label: "Télécommunication", unit: "km", materialKey: "telecomKm", desc: "Fibre, radio, contrôle commande." },
      securite: { label: "Systèmes sécurité", unit: "u", materialKey: "systemesSecurite", desc: "Contrôle train, enclenchements, SIL." },
    },
  },
  {
    id: "gares",
    label: "Gares & équipements",
    icon: Wrench,
    color: "text-green-300",
    types: {
      gare: { label: "Gare / halte", unit: "u", materialKey: "gares", desc: "Bâtiments voyageurs et quais." },
      quai: { label: "Quais", unit: "m", materialKey: "quaisMl", desc: "Longueur de quais." },
      equipements: { label: "Équipements voyageurs", unit: "u", materialKey: "equipementsGare", desc: "Abris, information, mobilier." },
    },
  },
  {
    id: "essais",
    label: "Essais & mise en service",
    icon: Activity,
    color: "text-purple-300",
    types: {
      essaisVoie: { label: "Essais de voie", unit: "km", materialKey: "essaisKm", desc: "Contrôles géométriques et dynamiques." },
      essaisSystemes: { label: "Essais systèmes", unit: "u", materialKey: "essaisSystemes", desc: "Signalisation, énergie, télécom." },
      miseService: { label: "Mise en service", unit: "u", materialKey: "miseService", desc: "Réception et ouverture exploitation." },
    },
  },
  {
    id: "maintenance",
    label: "Maintenance",
    icon: ShieldAlert,
    color: "text-sky-300",
    types: {
      maintenanceVoie: { label: "Maintenance voie", unit: "km/an", materialKey: "maintenanceKm", desc: "Entretien annuel de voie." },
      maintenanceSystemes: { label: "Maintenance systèmes", unit: "u/an", materialKey: "maintenanceSystemes", desc: "Énergie, signalisation, télécom." },
      inspection: { label: "Inspections", unit: "u/an", materialKey: "inspections", desc: "Visites périodiques." },
    },
  },
];

const MATERIAL_LABELS = {
  lineaireKm: "Linéaire projet",
  lineaireEtudesKm: "Linéaire étudié",
  dossiersEtudes: "Dossiers d'études",
  empriseHa: "Emprise",
  parcelles: "Parcelles/biens",
  empriseKm: "Emprise libérée",
  deblais: "Déblais",
  remblais: "Remblais",
  coucheForme: "Couche de forme",
  pontsMl: "Ponts",
  ouvragesHydrauliques: "Ouvrages hydrauliques",
  mursM2: "Murs",
  railsMl: "Rails",
  traverses: "Traverses",
  ballast: "Ballast",
  catenaireKm: "Caténaire",
  sousStations: "Sous-stations",
  alimentationKm: "Alimentation",
  signaux: "Signaux",
  telecomKm: "Télécom",
  systemesSecurite: "Systèmes sécurité",
  gares: "Gares/haltes",
  quaisMl: "Quais",
  equipementsGare: "Équipements gare",
  essaisKm: "Essais voie",
  essaisSystemes: "Essais systèmes",
  miseService: "Mise en service",
  maintenanceKm: "Maintenance voie",
  maintenanceSystemes: "Maintenance systèmes",
  inspections: "Inspections",
};

const MATERIAL_UNITS = {
  lineaireKm: "km",
  lineaireEtudesKm: "km",
  dossiersEtudes: "u",
  empriseHa: "ha",
  parcelles: "u",
  empriseKm: "km",
  deblais: "m³",
  remblais: "m³",
  coucheForme: "m³",
  pontsMl: "m",
  ouvragesHydrauliques: "u",
  mursM2: "m²",
  railsMl: "m",
  traverses: "u",
  ballast: "m³",
  catenaireKm: "km",
  sousStations: "u",
  alimentationKm: "km",
  signaux: "u",
  telecomKm: "km",
  systemesSecurite: "u",
  gares: "u",
  quaisMl: "m",
  equipementsGare: "u",
  essaisKm: "km",
  essaisSystemes: "u",
  miseService: "u",
  maintenanceKm: "km/an",
  maintenanceSystemes: "u/an",
  inspections: "u/an",
};

const fmt = (value, digits = 2) => Number(value || 0).toFixed(digits);
const money = (value, currency) => `${Number(value || 0).toLocaleString("fr-FR")} ${currency}`;
const num = (value) => Number.parseFloat(value) || 0;

const defaultLine = (step, typeKey = Object.keys(step.types)[0]) => ({
  id: Date.now() + Math.random(),
  type: typeKey,
  designation: "",
  quantite: "",
  prixUnitaire: "",
  mainOeuvre: "",
  expanded: true,
});

const getAutoQuantity = (stepId, typeKey, quantites = {}) => {
  const etudes = quantites.etudes || {};
  const foncier = quantites.foncier || {};
  const terrassement = quantites.terrassement || {};
  const voie = quantites.voie || {};
  const electrification = quantites.electrification || {};
  const signalisation = quantites.signalisation || {};
  const gares = quantites.gares || {};

  const lineaire = Number(etudes.lineaireKm || etudes.lineaireEtudesKm || foncier.empriseKm || 0);
  const empriseKm = Number(foncier.empriseKm || lineaire || 0);
  const railsKm = Number(voie.railsMl || 0) / 2000 || lineaire;
  const garesCount = Number(gares.gares || 0);
  const auto = {
    foncier: {
      emprise: lineaire > 0 ? lineaire * 4 : 0,
      liberation: lineaire,
    },
    terrassement: {
      deblais: empriseKm > 0 ? empriseKm * 1000 * 8 : 0,
      remblais: Number(terrassement.deblais || 0) * 0.65,
      coucheForme: empriseKm > 0 ? empriseKm * 1000 * 6 * 0.35 : 0,
    },
    ouvrages: {
      dalot: lineaire > 0 ? Math.max(1, Math.ceil(lineaire / 2)) : 0,
    },
    voie: {
      rails: lineaire > 0 ? lineaire * 1000 * 2 : 0,
      traverses: lineaire > 0 ? Math.ceil(lineaire * 1000 / 0.6) : 0,
      ballast: lineaire > 0 ? lineaire * 1000 * 3.2 * 0.35 : 0,
    },
    electrification: {
      catenaire: lineaire,
      sousStation: lineaire > 0 ? Math.max(1, Math.ceil(lineaire / 40)) : 0,
      alimentation: lineaire,
    },
    signalisation: {
      signaux: lineaire > 0 ? Math.max(2, Math.ceil(lineaire * 2)) : 0,
      telecom: lineaire,
      securite: lineaire > 0 ? Math.max(1, Math.ceil(lineaire / 20)) : 0,
    },
    gares: {
      quai: garesCount > 0 ? garesCount * 160 : 0,
      equipements: garesCount > 0 ? garesCount * 8 : 0,
    },
    essais: {
      essaisVoie: railsKm,
      essaisSystemes: Number(electrification.catenaireKm || 0) > 0 || Number(signalisation.signaux || 0) > 0 ? Math.max(1, Math.ceil(lineaire / 10)) : 0,
      miseService: lineaire > 0 ? 1 : 0,
    },
    maintenance: {
      maintenanceVoie: railsKm,
      maintenanceSystemes: Number(signalisation.signaux || 0) + Number(electrification.sousStations || 0),
      inspection: lineaire > 0 ? Math.max(1, Math.ceil(lineaire * 4)) : 0,
    },
  };
  return Number(auto[stepId]?.[typeKey] || 0);
};

const computeLine = (step, line, quantites = {}) => {
  const type = step.types[line.type] || Object.values(step.types)[0];
  const autoQuantity = getAutoQuantity(step.id, line.type, quantites);
  const hasManualQuantity = String(line.quantite ?? "").trim() !== "";
  const quantite = hasManualQuantity ? num(line.quantite) : autoQuantity;
  const total = quantite * num(line.prixUnitaire) + num(line.mainOeuvre);
  return { ...line, typeInfo: type, autoQuantity, hasManualQuantity, quantite, total };
};

const buildMaterialText = (materials = {}) => {
  const entries = Object.entries(materials).filter(([, value]) => Number(value || 0) > 0);
  if (!entries.length) return "—";
  return entries
    .map(([key, value]) => `${MATERIAL_LABELS[key] || key}: ${fmt(value)} ${MATERIAL_UNITS[key] || ""}`)
    .join(" | ");
};

const buildMaterialTotals = (quantites = {}) =>
  Object.values(quantites).reduce((acc, materials) => {
    Object.entries(materials || {}).forEach(([key, value]) => {
      const n = Number(value || 0);
      if (n > 0) acc[key] = (acc[key] || 0) + n;
    });
    return acc;
  }, {});

function RailStep({ step, currency, quantites, onCostChange, onMaterialsChange }) {
  const [lines, setLines] = usePersistentState(`ferroviaire:${step.id}:lines`, [defaultLine(step)]);
  const [newType, setNewType] = usePersistentState(`ferroviaire:${step.id}:newType`, Object.keys(step.types)[0]);
  const [activeTab, setActiveTab] = useState("ouvrages");
  const Icon = step.icon;

  const results = useMemo(() => {
    const calc = lines.map((line) => computeLine(step, line, quantites));
    const total = calc.reduce((sum, line) => sum + line.total, 0);
    const materials = calc.reduce((acc, line) => {
      if (line.quantite > 0) acc[line.typeInfo.materialKey] = (acc[line.typeInfo.materialKey] || 0) + line.quantite;
      return acc;
    }, {});
    return { calc, total, materials };
  }, [lines, quantites, step]);

  React.useEffect(() => {
    onCostChange(results.total);
    onMaterialsChange(results.materials);
  }, [results, onCostChange, onMaterialsChange]);

  const updateLine = (id, patch) => setLines((prev) => prev.map((line) => line.id === id ? { ...line, ...patch } : line));
  const addLine = () => setLines((prev) => [...prev, defaultLine(step, newType)]);
  const removeLine = (id) => setLines((prev) => prev.filter((line) => line.id !== id));

  return (
    <div className="w-full h-full flex flex-col bg-gray-950 text-gray-100 overflow-hidden">
      <div className="flex-shrink-0 px-5 py-3 border-b border-gray-800 flex justify-between items-center bg-gray-900/70">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/20 rounded-xl text-indigo-300"><Icon className="w-5 h-5" /></div>
          <div>
            <h2 className="text-base font-bold text-white leading-tight">{step.label}</h2>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Ouvrages · quantités automatiques · synthèse</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-gray-500 uppercase font-bold block">Coût total</span>
          <span className="text-xl font-black text-indigo-300 tracking-tight">{Number(results.total || 0).toLocaleString("fr-FR")} <span className="text-xs text-gray-500 font-normal">{currency}</span></span>
        </div>
      </div>

      <div className="flex-shrink-0 flex border-b border-gray-800 xl:hidden">
        {[["ouvrages", "Ouvrages"], ["synthese", "Synthèse"]].map(([key, label]) => (
          <button key={key} onClick={() => setActiveTab(key)} className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider ${activeTab === key ? "text-indigo-300 border-b-2 border-indigo-300" : "text-gray-500"}`}>{label}</button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-1 xl:grid-cols-12 min-h-full">
          <div className={`xl:col-span-7 p-4 lg:p-5 border-r border-gray-800/50 flex flex-col gap-3 ${activeTab !== "ouvrages" ? "hidden xl:flex" : "flex"}`}>
            {results.calc.map((line) => (
              <RailLineCard key={line.id} line={line} step={step} currency={currency} onToggle={() => updateLine(line.id, { expanded: !line.expanded })} onRemove={() => removeLine(line.id)} onPatch={(patch) => updateLine(line.id, patch)} />
            ))}

            <div className="bg-gray-900/40 border border-gray-700/50 rounded-2xl p-4">
              <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-3">Ajouter un ouvrage</p>
              <select value={newType} onChange={(event) => setNewType(event.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-3 text-sm text-white focus:border-indigo-400">
                {Object.entries(step.types).map(([key, type]) => <option key={key} value={key}>{type.label}</option>)}
              </select>
              <button onClick={addLine} className="mt-3 w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors">
                <Plus className="w-4 h-4" /> Ajouter au calcul
              </button>
            </div>
          </div>

          <div className={`xl:col-span-5 p-4 lg:p-5 bg-gray-900/20 flex flex-col gap-4 ${activeTab !== "synthese" ? "hidden xl:flex" : "flex"}`}>
            <div className="grid grid-cols-2 gap-3">
              <ResultCard label="Ouvrages" value={results.calc.length} unit="u" />
              <ResultCard label="Montant" value={Number(results.total || 0).toLocaleString("fr-FR")} unit={currency} />
            </div>
            <div className="bg-gray-900/70 border border-gray-800 rounded-2xl p-4">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Synthèse interne</h3>
              <div className="space-y-2">
                {results.calc.map((line) => (
                  <div key={line.id} className="rounded-xl bg-gray-950/60 border border-gray-800 p-3">
                    <div className="flex justify-between gap-3 text-sm">
                      <span className="font-semibold text-white">{line.designation || line.typeInfo.label}</span>
                      <span className="font-black text-indigo-300">{money(line.total, currency)}</span>
                    </div>
                    <div className="mt-1 text-[11px] text-gray-400">{fmt(line.quantite)} {line.typeInfo.unit} · {line.hasManualQuantity ? "saisie manuelle" : "récupération automatique"}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-indigo-950/25 border border-indigo-800/40 rounded-2xl p-4">
              <p className="text-[11px] text-indigo-100/80 leading-relaxed">Les quantités vides sont calculées depuis les phases précédentes. Une saisie manuelle reste prioritaire.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RailLineCard({ line, step, currency, onToggle, onRemove, onPatch }) {
  const Icon = step.icon;
  return (
    <div className="bg-gray-900/70 border border-gray-800 rounded-2xl overflow-hidden">
      <button type="button" onClick={onToggle} className="w-full px-4 py-3 flex items-center justify-between gap-3 hover:bg-gray-800/40">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-9 h-9 rounded-xl bg-indigo-500/15 text-indigo-300 flex items-center justify-center flex-shrink-0"><Icon className="w-4 h-4" /></span>
          <div className="text-left min-w-0">
            <h3 className="text-sm font-bold text-white truncate">{line.designation || line.typeInfo.label}</h3>
            <p className="text-[10px] text-gray-500 truncate">{line.typeInfo.desc}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-black text-indigo-300 whitespace-nowrap">{money(line.total, currency)}</span>
          {line.expanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
        </div>
      </button>

      {line.expanded && (
        <div className="px-4 pb-4 border-t border-gray-800 grid grid-cols-1 md:grid-cols-2 gap-3 pt-4">
          <Input label="Type d'ouvrage" as="select" value={line.type} onChange={(value) => onPatch({ type: value })}>
            {Object.entries(step.types).map(([key, type]) => <option key={key} value={key}>{type.label}</option>)}
          </Input>
          <Input label="Désignation" value={line.designation} onChange={(value) => onPatch({ designation: value })} placeholder={line.typeInfo.label} />
          <Input label={`Quantité (${line.typeInfo.unit})`} value={line.hasManualQuantity ? line.quantite : ""} onChange={(value) => onPatch({ quantite: value })} placeholder={line.autoQuantity > 0 ? `Auto: ${fmt(line.autoQuantity)} ${line.typeInfo.unit}` : "0"} />
          <Input label={`Prix unitaire (${currency}/${line.typeInfo.unit})`} value={line.prixUnitaire} onChange={(value) => onPatch({ prixUnitaire: value })} />
          <Input label={`Main d'oeuvre (${currency})`} value={line.mainOeuvre} onChange={(value) => onPatch({ mainOeuvre: value })} />
          <div className="md:col-span-2 flex flex-wrap gap-2">
            <Badge label={line.hasManualQuantity ? "Quantité" : "Quantité auto"} value={`${fmt(line.quantite)} ${line.typeInfo.unit}`} />
            <Badge label="Montant" value={money(line.total, currency)} />
            <button type="button" onClick={onRemove} className="ml-auto px-3 py-2 rounded-lg bg-red-500/10 text-red-300 hover:bg-red-500/20 flex items-center gap-1 text-xs">
              <Trash2 className="w-3 h-3" /> Retirer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function DevisFerroviaireGlobal({ currency, costs, quantites }) {
  const rows = useMemo(() => STEP_CONFIG.map((step) => ({
    id: step.id,
    label: step.label,
    amount: Number(costs[step.id] || 0),
    materials: quantites[step.id] || {},
  })), [costs, quantites]);
  const activeRows = rows.filter((row) => row.amount > 0 || buildMaterialText(row.materials) !== "—");
  const materialRows = useMemo(() => Object.entries(buildMaterialTotals(quantites)).filter(([, value]) => Number(value || 0) > 0).sort(([a], [b]) => (MATERIAL_LABELS[a] || a).localeCompare(MATERIAL_LABELS[b] || b)), [quantites]);
  const totalGeneral = rows.reduce((sum, row) => sum + row.amount, 0);

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    const synthese = [
      ["CHANTILINK - DEVIS FERROVIAIRE", "", "", ""],
      [`Date : ${new Date().toLocaleDateString("fr-FR")}`, "", "", ""],
      [""],
      ["Indicateur", "Valeur", "Unité", "Observation"],
      ["Postes calculés", activeRows.length, "u", "Détail dans l'onglet Récap global"],
      ["Quantités cumulées", materialRows.length, "u", "Détail dans l'onglet Quantités cumulées"],
      ["Total général", totalGeneral, currency, "Montant global estimatif"],
    ];
    const ws0 = XLSX.utils.aoa_to_sheet(synthese);
    ws0["!cols"] = [{ wch: 30 }, { wch: 18 }, { wch: 14 }, { wch: 52 }];
    ws0["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }];
    XLSX.utils.book_append_sheet(wb, ws0, "Synthèse");
    const recap = [["Poste", "Quantités calculées", `Montant (${currency})`], ...activeRows.map((row) => [row.label, buildMaterialText(row.materials), row.amount]), ["TOTAL", "", totalGeneral]];
    const ws1 = XLSX.utils.aoa_to_sheet(recap);
    ws1["!cols"] = [{ wch: 30 }, { wch: 90 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws1, "Récap global");
    const materials = [["Quantité cumulée", "Valeur", "Unité"], ...materialRows.map(([key, value]) => [MATERIAL_LABELS[key] || key, Number(value || 0), MATERIAL_UNITS[key] || ""])];
    const ws2 = XLSX.utils.aoa_to_sheet(materials);
    ws2["!cols"] = [{ wch: 34 }, { wch: 16 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws2, "Quantités cumulées");
    XLSX.writeFile(wb, `devis_ferroviaire_${Date.now()}.xlsx`);
  };

  const exportPDF = async () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const logoDataUrl = await createChantilinkLogoCanvas().catch(() => null);
    drawChantilinkHeader(doc, { logoDataUrl, title: "DEVIS FERROVIAIRE", subtitle: "Récapitulatif global des ouvrages ferroviaires" });
    doc.setFillColor(238, 242, 255);
    doc.roundedRect(14, 38, pageWidth - 28, 18, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(49, 46, 129);
    doc.text("POSTES", 20, 46);
    doc.text("QUANTITES", 96, 46);
    doc.text("TOTAL GENERAL", 172, 46);
    doc.setFontSize(11);
    doc.setTextColor(17, 24, 39);
    doc.text(String(activeRows.length), 20, 52);
    doc.text(String(materialRows.length), 96, 52);
    doc.text(fmtPdfMoney(totalGeneral, currency), 172, 52);
    autoTable(doc, {
      startY: 64,
      head: [["Poste", "Quantités calculées", `Montant ${currency}`]],
      body: [...activeRows.map((row) => [row.label, buildMaterialText(row.materials), row.amount ? fmtPdfMoney(row.amount, currency) : "—"]), ["TOTAL", "", fmtPdfMoney(totalGeneral, currency)]],
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 2.6, lineColor: [229, 231, 235], valign: "top" },
      headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [238, 242, 255] },
      columnStyles: { 0: { cellWidth: 54, fontStyle: "bold" }, 1: { cellWidth: 164 }, 2: { cellWidth: 59, halign: "right", fontStyle: "bold" } },
      margin: { left: 10, right: 10 },
      didParseCell: (data) => {
        if (data.row.index === activeRows.length) {
          data.cell.styles.fillColor = [224, 231, 255];
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.textColor = [49, 46, 129];
        }
      },
    });
    doc.addPage();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(79, 70, 229);
    doc.text("QUANTITES CUMULEES", 10, 18);
    autoTable(doc, {
      startY: 26,
      head: [["Quantité cumulée", "Valeur", "Unité"]],
      body: materialRows.map(([key, value]) => [MATERIAL_LABELS[key] || key, fmt(value), MATERIAL_UNITS[key] || ""]),
      theme: "grid",
      styles: { fontSize: 11, cellPadding: 3.5, lineColor: [229, 231, 235] },
      headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [238, 242, 255] },
      columnStyles: { 0: { cellWidth: 145, fontStyle: "bold" }, 1: { cellWidth: 85, halign: "right" }, 2: { cellWidth: 47 } },
      margin: { left: 10, right: 10 },
    });
    addPdfFooters(doc, "ChantiLink - devis ferroviaire");
    doc.save(`devis_ferroviaire_${Date.now()}.pdf`);
  };

  return (
    <div className="h-full overflow-y-auto bg-gray-900 text-white p-5 space-y-5">
      <section className="rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-gray-800 to-indigo-950/30 p-5">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <p className="text-[10px] text-indigo-300 font-bold uppercase tracking-widest flex items-center gap-2"><Train className="w-4 h-4" /> Synthèse ferroviaire</p>
            <h1 className="text-2xl font-black">Devis ferroviaire global</h1>
            <p className="text-xs text-gray-400 mt-1">Récupération automatique des calculs de chaque phase.</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-gray-500 uppercase font-bold">Total général</p>
            <p className="text-2xl font-black text-indigo-300 font-mono">{money(totalGeneral, currency)}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-col sm:flex-row gap-3">
          <button onClick={exportPDF} disabled={!activeRows.length} className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 px-4 py-3 text-sm font-bold transition"><FileText className="w-4 h-4" /> Export PDF</button>
          <button onClick={exportExcel} disabled={!activeRows.length} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 hover:bg-blue-600 disabled:bg-gray-700 disabled:text-gray-500 px-4 py-3 text-sm font-bold transition"><FileSpreadsheet className="w-4 h-4" /> Export Excel</button>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-700 bg-gray-800 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-700 flex items-center gap-2"><FileText className="w-4 h-4 text-indigo-400" /><h2 className="text-xs font-bold uppercase tracking-widest text-indigo-300">Récapitulatif par phase</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-900/70 text-[10px] uppercase tracking-widest text-gray-400"><tr><th className="px-4 py-3 text-left">Phase</th><th className="px-4 py-3 text-left">Quantités</th><th className="px-4 py-3 text-right">Montant</th></tr></thead>
            <tbody className="divide-y divide-gray-700">
              {activeRows.length === 0 ? <tr><td colSpan={3} className="px-4 py-8 text-center text-xs text-gray-500 italic">Les calculs ferroviaires apparaîtront ici automatiquement.</td></tr> : activeRows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-700/30"><td className="px-4 py-3 font-bold text-white">{row.label}</td><td className="px-4 py-3 text-xs text-gray-300 font-mono">{buildMaterialText(row.materials)}</td><td className="px-4 py-3 text-right font-mono font-black text-indigo-300">{row.amount ? money(row.amount, currency) : "—"}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-700 bg-gray-800 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-700 flex items-center gap-2"><Download className="w-4 h-4 text-blue-400" /><h2 className="text-xs font-bold uppercase tracking-widest text-blue-300">Quantités cumulées</h2></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4">
          {materialRows.length === 0 ? <p className="text-xs text-gray-500 italic">Aucun cumul disponible.</p> : materialRows.map(([key, value]) => (
            <div key={key} className="rounded-xl border border-gray-700 bg-gray-900/70 p-3 flex items-center justify-between gap-3">
              <span className="text-xs font-bold text-gray-300">{MATERIAL_LABELS[key] || key}</span>
              <span className="text-xs font-mono font-black text-white">{fmt(value)} {MATERIAL_UNITS[key] || ""}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default function FerroviaireForm({ currency = "XOF" }) {
  const [selectedStep, setSelectedStep] = usePersistentState("ferroviaire:selectedStep", null);
  const [showDevis, setShowDevis] = useState(false);
  const [costs, setCosts] = usePersistentState("ferroviaire:costs", Object.fromEntries(STEP_CONFIG.map((step) => [step.id, 0])));
  const [quantites, setQuantites] = usePersistentState("ferroviaire:quantites", Object.fromEntries(STEP_CONFIG.map((step) => [step.id, {}])));
  const selectedConfig = STEP_CONFIG.find((step) => step.id === selectedStep);
  const totalGeneral = useMemo(() => Object.values(costs).reduce((sum, value) => sum + Number(value || 0), 0), [costs]);
  const activeSteps = useMemo(() => STEP_CONFIG.filter((step) => Number(costs[step.id] || 0) > 0).length, [costs]);
  const materialCount = useMemo(() => Object.values(quantites).reduce((sum, materials) => sum + Object.values(materials || {}).filter((value) => Number(value || 0) > 0).length, 0), [quantites]);
  const progressPercent = activeSteps / STEP_CONFIG.length * 100;

  const handleCostChange = useCallback((stepId, value) => {
    setCosts((prev) => {
      const nextValue = Math.max(0, Number(value) || 0);
      if (prev[stepId] === nextValue) return prev;
      return { ...prev, [stepId]: nextValue };
    });
  }, [setCosts]);

  const handleMaterialsChange = useCallback((stepId, materials) => {
    setQuantites((prev) => {
      if (JSON.stringify(prev[stepId]) === JSON.stringify(materials)) return prev;
      return { ...prev, [stepId]: materials };
    });
  }, [setQuantites]);

  return (
    <div className="flex h-full w-full bg-gray-950 text-white overflow-hidden font-sans" style={{ minHeight: 0 }}>
      <aside className="hidden lg:flex flex-col w-72 bg-gray-900 border-r border-gray-800 shadow-2xl z-20 flex-shrink-0">
        <div className="p-5 border-b border-gray-800 shrink-0">
          <h1 className="text-xl font-black bg-gradient-to-r from-indigo-300 to-blue-500 bg-clip-text text-transparent flex items-center gap-2 mb-1"><Train className="w-5 h-5 text-indigo-400" /> Ferroviaire</h1>
          <p className="text-[10px] text-gray-400 mb-3">Infrastructure · voie · systèmes</p>
          <div className="bg-gray-800 rounded-full h-1.5 overflow-hidden"><div className="h-full bg-gradient-to-r from-indigo-500 to-blue-500 transition-all duration-700" style={{ width: `${progressPercent}%` }} /></div>
          <div className="flex justify-between mt-1.5 text-[9px] font-bold text-gray-500 uppercase tracking-wider"><span>Avancement</span><span>{activeSteps}/{STEP_CONFIG.length}</span></div>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5 custom-scrollbar">
          {STEP_CONFIG.map((step) => {
            const Icon = step.icon;
            const isActive = costs[step.id] > 0;
            const isSelected = selectedStep === step.id;
            return (
              <button key={step.id} onClick={() => setSelectedStep(step.id)} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left relative overflow-hidden ${isSelected ? "bg-gray-800 border border-indigo-500/50 shadow-lg" : "hover:bg-gray-800 border border-transparent hover:border-gray-700"}`}>
                {isSelected && <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 rounded-r" />}
                <Icon className={`w-4 h-4 ${isSelected || isActive ? step.color : "text-gray-600"}`} />
                <div className="flex-1 min-w-0">
                  <div className={`font-bold text-xs ${isSelected ? "text-white" : "text-gray-300"}`}>{step.label}</div>
                  {isActive ? <div className="text-[10px] font-mono text-indigo-400">{costs[step.id].toLocaleString("fr-FR")} {currency}</div> : <div className="text-[9px] text-gray-600">Non chiffré</div>}
                </div>
                {isActive && <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_6px_rgba(99,102,241,0.6)]" />}
              </button>
            );
          })}
        </div>
        <div className="p-4 border-t border-gray-800 bg-gray-900 shrink-0 space-y-2">
          <div className="bg-gray-800 rounded-xl p-3 border border-gray-700"><span className="text-[9px] text-gray-400 uppercase tracking-widest block mb-0.5">Total projet ferroviaire</span><span className="text-lg font-black text-white tracking-tight">{totalGeneral.toLocaleString("fr-FR")} <span className="text-xs font-normal text-indigo-400">{currency}</span></span></div>
          <button onClick={() => setShowDevis(true)} disabled={totalGeneral === 0} className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95"><FileText className="w-3.5 h-3.5" /> Voir le devis ferroviaire</button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-full overflow-hidden relative bg-gray-950 w-full min-w-0">
        <div className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-900 shrink-0 z-20">
          {selectedStep ? <button onClick={() => setSelectedStep(null)} className="flex items-center gap-2 text-gray-300 hover:text-white text-sm"><ChevronLeft className="w-4 h-4" /> Retour</button> : <h1 className="text-base font-bold text-indigo-400 flex items-center gap-2"><Train className="w-4 h-4" /> Ferroviaire</h1>}
          <div className="bg-gray-800 px-3 py-1.5 rounded-lg border border-gray-700"><span className="text-xs font-bold text-white">{totalGeneral.toLocaleString("fr-FR")} {currency}</span></div>
        </div>

        {selectedConfig ? (
          <div className="flex-1 w-full h-full overflow-hidden">
            <RailStep step={selectedConfig} currency={currency} quantites={quantites} onCostChange={(value) => handleCostChange(selectedConfig.id, value)} onMaterialsChange={(materials) => handleMaterialsChange(selectedConfig.id, materials)} />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="lg:hidden grid grid-cols-2 gap-3 p-4">
              {STEP_CONFIG.map((step) => {
                const Icon = step.icon;
                return (
                  <button key={step.id} onClick={() => setSelectedStep(step.id)} className={`flex flex-col items-center justify-center p-4 rounded-2xl border backdrop-blur-sm shadow-lg active:scale-95 transition-all ${costs[step.id] > 0 ? "border-indigo-500/50 bg-gradient-to-br from-gray-800 to-indigo-900/20" : "border-gray-700 bg-gray-800/50 hover:bg-gray-800"}`}>
                    <Icon className={`w-7 h-7 mb-2 ${costs[step.id] > 0 ? step.color : "text-gray-500"}`} />
                    <span className="font-bold text-xs text-center text-gray-200">{step.label}</span>
                    {costs[step.id] > 0 && <span className="mt-1.5 text-[9px] font-mono font-bold text-indigo-400 bg-gray-900/80 px-2 py-0.5 rounded border border-indigo-500/30">{(costs[step.id] / 1000).toFixed(0)}k</span>}
                  </button>
                );
              })}
            </div>
            <div className="hidden lg:flex flex-col items-center justify-center py-12 text-center opacity-40 select-none"><Train className="w-12 h-12 text-gray-600 mb-3" /><p className="text-gray-400 text-sm font-medium">Sélectionnez une phase dans la barre latérale</p></div>
            <div className="px-4 pb-6">
              <section className="rounded-2xl overflow-hidden border border-indigo-500/20 bg-gray-800">
                <div className="px-5 py-3 flex items-center gap-3 border-b border-indigo-500/20 bg-indigo-500/10"><FileText className="w-4 h-4 text-indigo-400" /><span className="text-xs font-bold text-indigo-300 uppercase tracking-widest">Récapitulatif ferroviaire</span></div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-900/70 text-[10px] uppercase tracking-widest text-gray-400"><tr><th className="px-4 py-3 text-left">Phase</th><th className="px-4 py-3 text-left">Montant</th></tr></thead>
                    <tbody className="divide-y divide-gray-700">
                      {STEP_CONFIG.map((step) => {
                        const Icon = step.icon;
                        const amount = costs[step.id] || 0;
                        return <tr key={step.id} className={amount > 0 ? "opacity-100" : "opacity-40"}><td className="px-4 py-3"><div className="flex items-center gap-2"><Icon className={`w-4 h-4 ${step.color}`} /><span className="font-bold text-xs text-white">{step.label}</span></div></td><td className="px-4 py-3 font-mono text-xs font-black text-indigo-300">{amount > 0 ? money(amount, currency) : "Non chiffré"}</td></tr>;
                      })}
                    </tbody>
                    <tfoot><tr className="bg-indigo-500/10 border-t border-indigo-500/20"><td className="px-4 py-3 text-xs font-black text-indigo-300 uppercase tracking-wider">Total général</td><td className="px-4 py-3 text-sm font-black text-white font-mono">{money(totalGeneral, currency)}</td></tr></tfoot>
                  </table>
                </div>
                <div className="px-5 py-4 border-t border-indigo-500/20 flex flex-col sm:flex-row sm:items-center gap-3 bg-indigo-500/10">
                  <div className="flex-1"><p className="text-[10px] text-indigo-300 font-bold uppercase tracking-widest">Synthèse complète</p><p className="text-xs text-gray-400">{materialCount} quantité{materialCount > 1 ? "s" : ""} récupérée{materialCount > 1 ? "s" : ""} automatiquement.</p></div>
                  <button onClick={() => setShowDevis(true)} disabled={totalGeneral === 0} className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 px-4 py-3 text-sm font-bold transition"><FileText className="w-4 h-4" /> Voir devis et exports</button>
                </div>
              </section>
            </div>
          </div>
        )}

        {showDevis && (
          <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-0 lg:p-4">
            <div className="bg-gray-900 w-full h-full lg:rounded-3xl lg:max-w-5xl lg:h-[90vh] flex flex-col shadow-2xl border border-gray-700">
              <div className="flex justify-between items-center p-4 border-b border-gray-800"><h2 className="text-lg font-bold text-white flex items-center gap-2"><Train className="text-indigo-500 w-5 h-5" /> Devis Ferroviaire</h2><button onClick={() => setShowDevis(false)} className="p-2 bg-gray-800 hover:bg-gray-700 rounded-full border border-gray-700"><X className="w-4 h-4" /></button></div>
              <div className="flex-1 overflow-hidden"><DevisFerroviaireGlobal currency={currency} costs={costs} quantites={quantites} /></div>
            </div>
          </div>
        )}

        <style>{`.custom-scrollbar::-webkit-scrollbar { width: 4px; }.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }.custom-scrollbar::-webkit-scrollbar-thumb { background: #374151; border-radius: 10px; }.custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #4b5563; }`}</style>
      </main>
    </div>
  );
}

function Input({ label, value, onChange, placeholder = "0", as, children }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{label}</span>
      {as === "select" ? (
        <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full bg-gray-950 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:border-indigo-400 outline-none">{children}</select>
      ) : (
        <input type={label === "Désignation" ? "text" : "number"} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-full bg-gray-950 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:border-indigo-400 outline-none" />
      )}
    </label>
  );
}

function Badge({ label, value }) {
  return <span className="px-3 py-2 rounded-lg bg-gray-950 border border-gray-800 text-[11px]"><span className="text-gray-500">{label}: </span><strong className="text-white">{value}</strong></span>;
}

function ResultCard({ label, value, unit }) {
  return <div className="rounded-2xl border border-indigo-800/40 bg-indigo-500/10 p-4"><div className="text-[10px] uppercase font-bold tracking-wider text-indigo-200/80">{label}</div><div className="mt-2 text-xl font-black text-white">{value} <span className="text-xs font-normal text-gray-400">{unit}</span></div></div>;
}
