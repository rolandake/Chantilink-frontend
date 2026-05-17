import React, { useState, useEffect, useMemo } from "react";
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import {
  BrickWall, Ruler, Banknote, Save, Trash2, History,
  Anchor, Droplets, Info, Target, Link, Zap, AlertTriangle,
} from "lucide-react";

import { useProjectStore } from "../../../../store/useProjectStore";

ChartJS.register(ArcElement, Tooltip, Legend);

const STORAGE_KEY = "fondation-history-pro";

// ─── TYPES FONDATION ── ratios corrigés selon descriptif du devis ─────────────
const TYPES_FONDATION = {
  BETON_PROPRETE: {
    label: "Béton de propreté",
    acier: 0,
    icon: "🟩",
    desc: "Béton maigre dosé 150 kg/m³, sans armatures — sous semelles, radier, longrines",
    dosageForce: "150",
    epaisseurDefaut: 0.05,           // 5 cm standard descriptif
    needsPropreteAuto: false,
  },
  FILANTE: {
    label: "Semelle Filante",
    acier: 80,                        // ✅ ratio standard BTP Côte d'Ivoire
    icon: "📏",
    desc: "Murs porteurs, fondations continues — dosage 350 kg/m³",
    dosageForce: "350",
    needsPropreteAuto: true,
  },
  ISOLEE: {
    label: "Semelle Isolée",
    acier: 120,                       // ✅ CORRIGÉ : 120 kg/m³ selon descriptif
    icon: "🟦",
    desc: "Poteaux, charges ponctuelles — dosage 400 kg/m³, acier HA 120 kg/m³",
    dosageForce: "400",
    needsPropreteAuto: true,
  },
  LONGRINE: {
    label: "Longrine de fondation",
    acier: 100,                       // ✅ CORRIGÉ : 100 kg/m³ selon descriptif
    icon: "➖",
    desc: "Liaison entre semelles isolées — dosage 400 kg/m³, acier HA 100 kg/m³",
    dosageForce: "400",
    needsPropreteAuto: true,
  },
  RADIER: {
    label: "Radier Général",
    acier: 90,
    icon: "🍱",
    desc: "Sol compressible, charges réparties — dosage 350 kg/m³",
    dosageForce: "350",
    needsPropreteAuto: true,
  },
  MASSIF: {
    label: "Massif / Plot",
    acier: 60,
    icon: "⬛",
    desc: "Appui ponctuel, dé de fondation — dosage 350 kg/m³",
    dosageForce: "350",
    needsPropreteAuto: false,
  },
};

// ─── DOSAGES ──────────────────────────────────────────────────────────────────
const DOSAGES_CIMENT = {
  150: { label: "150 kg/m³ (Béton de propreté)", ciment: 0.15, sable: 0.65, gravier: 0.90 },
  300: { label: "300 kg/m³",                      ciment: 0.30, sable: 0.65, gravier: 0.85 },
  350: { label: "350 kg/m³ (Standard BA)",         ciment: 0.35, sable: 0.60, gravier: 0.80 },
  400: { label: "400 kg/m³ (Haute résistance)",   ciment: 0.40, sable: 0.55, gravier: 0.75 },
};

// ─── UTILS ────────────────────────────────────────────────────────────────────
const fmt  = (n) => Math.round(n).toLocaleString("fr-FR");
const fmtD = (n, d = 2) => (n || 0).toFixed(d);

// ─── COMPOSANT PRINCIPAL ──────────────────────────────────────────────────────
export default function Fondation({ currency = "XOF", onCostChange, onMateriauxChange }) {

  const terrassement = useProjectStore((s) => s.subResults.terrassement);
  const setResults   = useProjectStore((s) => s.setResults);
  const setMaterials = useProjectStore((s) => s.setMaterials);
  const setCost      = useProjectStore((s) => s.setCost);

  // ── États ─────────────────────────────────────────────────────────────────
  const [inputs, setInputs] = useState({
    typeFondation: "ISOLEE",
    dosage:        "400",
    ratioAcier:    "120",   // ✅ éditable par l'utilisateur
    longueur:      "",
    largeur:       "",
    profondeur:    "",
    prixUnitaire:  "",
    coutMainOeuvre:"",
    margePerte:    "10",
  });

  // Béton de propreté automatique
  const [propreteAuto, setPropreteAuto] = useState({
    actif: true,
    epaisseur: "0.05",
  });

  const [historique, setHistorique]   = useState([]);
  const [message,    setMessage]      = useState(null);
  const [showTooltip, setShowTooltip] = useState(null);

  // ── Liaison terrassement ──────────────────────────────────────────────────
  const [autoData, setAutoData] = useState({
    volumeRefDisponible: false,
    volumeRef: 0,
    profondeurRef: 0,
  });

  useEffect(() => {
    if (terrassement.totalDeblai > 0) {
      setAutoData({
        volumeRefDisponible: true,
        volumeRef:     terrassement.totalDeblai,
        profondeurRef: terrassement.profondeurMoyenne || 0,
      });
    }
  }, [terrassement.totalDeblai, terrassement.profondeurMoyenne]);

  // ✅ Préremplissage intelligent selon le type sélectionné
  const handleTypeChange = (key) => {
    const type = TYPES_FONDATION[key];
    setInputs((prev) => ({
      ...prev,
      typeFondation: key,
      dosage:     type.dosageForce || prev.dosage,
      ratioAcier: String(type.acier),   // ✅ prérempli mais modifiable
      profondeur: key === "BETON_PROPRETE" ? "0.05" : prev.profondeur,
    }));
  };

  const applyAutoData = () => {
    setInputs((prev) => ({
      ...prev,
      profondeur: autoData.profondeurRef > 0 ? autoData.profondeurRef.toFixed(2) : prev.profondeur,
    }));
  };

  // ── Moteur de calcul principal ────────────────────────────────────────────
  const results = useMemo(() => {
    const L     = parseFloat(inputs.longueur)    || 0;
    const l     = parseFloat(inputs.largeur)     || 0;
    const p     = parseFloat(inputs.profondeur)  || 0;
    const marge = 1 + (parseFloat(inputs.margePerte) || 0) / 100;

    const volumeBrut     = L * l * p;
    const volumeCommande = volumeBrut * marge;

    const configDosage = DOSAGES_CIMENT[inputs.dosage];
    const ratioAcier   = parseFloat(inputs.ratioAcier) || 0;

    const cimentT    = volumeCommande * configDosage.ciment;
    const cimentSacs = (cimentT * 1000) / 50;
    const sableT     = volumeCommande * configDosage.sable;
    const gravierT   = volumeCommande * configDosage.gravier;
    const acierKg    = volumeCommande * ratioAcier;
    const acierT     = acierKg / 1000;
    const eauL       = volumeCommande * 175;

    // ✅ Calcul automatique béton de propreté
    const typeInfo = TYPES_FONDATION[inputs.typeFondation];
    const epProprete = parseFloat(propreteAuto.epaisseur) || 0.05;
    const surface    = L * l;
    const volumeProprete     = typeInfo.needsPropreteAuto && propreteAuto.actif && surface > 0
      ? surface * epProprete
      : 0;
    const volumePropreteCmd  = volumeProprete * marge;
    const configProprete     = DOSAGES_CIMENT[150];
    const cimentProprete     = volumePropreteCmd * configProprete.ciment;
    const sableProprete      = volumePropreteCmd * configProprete.sable;
    const gravierProprete    = volumePropreteCmd * configProprete.gravier;
    const sacsProprete       = (cimentProprete * 1000) / 50;

    const pu = parseFloat(inputs.prixUnitaire)    || 0;
    const mo = parseFloat(inputs.coutMainOeuvre)  || 0;
    const coutMateriaux = volumeCommande * pu;
    const coutProprete  = volumePropreteCmd * pu;
    const total         = coutMateriaux + mo + coutProprete;

    const volumeRemblaiEstime = Math.max(0, (terrassement.totalDeblai || 0) - volumeCommande);

    return {
      volumeBrut, volumeCommande, surface,
      cimentT, cimentSacs, sableT, gravierT,
      acierT, acierKg, eauL,
      total, coutMateriaux, mo,
      volumeRemblaiEstime,
      // béton de propreté
      volumeProprete, volumePropreteCmd,
      cimentProprete, sableProprete, gravierProprete, sacsProprete,
    };
  }, [inputs, propreteAuto, terrassement.totalDeblai]);

  // ── Synchronisation store ─────────────────────────────────────────────────
  useEffect(() => {
    if (onCostChange)      onCostChange(results.total);
    if (onMateriauxChange) onMateriauxChange({
      volume: results.volumeCommande,
      ciment: results.cimentT + results.cimentProprete,
      acier:  results.acierT,
    });

    setCost("fondation", results.total);
    setResults("fondation", {
      volumeBetonFondation: results.volumeCommande,
      volumeRemblaiEstime:  results.volumeRemblaiEstime,
      typeFondation:        inputs.typeFondation,
      longueur:             parseFloat(inputs.longueur)   || 0,
      largeur:              parseFloat(inputs.largeur)    || 0,
      profondeur:           parseFloat(inputs.profondeur) || 0,
      acierKg:              results.acierKg,
      surface:              results.surface,
    });
    setMaterials("fondation", {
      volume:  results.volumeCommande,
      ciment:  results.cimentT + results.cimentProprete,
      sable:   results.sableT  + results.sableProprete,
      gravier: results.gravierT + results.gravierProprete,
      acier:   results.acierT,
    });
  }, [results.total, results.volumeCommande, results.cimentT, results.acierT,
      results.volumeRemblaiEstime, results.cimentProprete]);

  // ── Historique ────────────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setHistorique(JSON.parse(saved));
    } catch {}
  }, []);

  const handleSave = () => {
    if (results.volumeBrut <= 0) return showToastMsg("⚠️ Dimensions manquantes", "error");
    const newEntry = {
      id: Date.now(),
      date: new Date().toLocaleString(),
      type: TYPES_FONDATION[inputs.typeFondation].label,
      ...inputs, ...results,
    };
    const newHist = [newEntry, ...historique];
    setHistorique(newHist);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newHist));
    showToastMsg("✅ Fondation enregistrée !");
  };

  const showToastMsg = (msg, type = "success") => {
    setMessage({ text: msg, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const typeInfo = TYPES_FONDATION[inputs.typeFondation];

  const chartData = {
    labels: ["Ciment", "Sable", "Gravier", "Acier", "B. Propreté"],
    datasets: [{
      data: [
        results.cimentT,
        results.sableT,
        results.gravierT,
        results.acierT,
        results.cimentProprete + results.sableProprete + results.gravierProprete,
      ],
      backgroundColor: ["#ef4444", "#fbbf24", "#78716c", "#3b82f6", "#22c55e"],
      borderColor: "#111827",
      borderWidth: 2,
    }],
  };

  return (
    <div className="w-full h-full flex flex-col bg-gray-900 text-gray-100 overflow-hidden relative">

      {/* Toast */}
      {message && (
        <div className={`fixed top-4 right-4 px-6 py-3 rounded-xl shadow-2xl z-50 font-bold animate-bounce ${
          message.type === "error" ? "bg-red-600" : "bg-emerald-600"
        }`}>
          {message.text}
        </div>
      )}

      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-600/20 rounded-lg text-red-500"><BrickWall className="w-6 h-6" /></div>
          <div>
            <h2 className="text-xl font-bold text-white">Fondation & Semelles</h2>
            <p className="text-xs text-gray-400 font-medium">Béton Armé Structurel — Descriptif normalisé CPJ 42,5</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-gray-500 uppercase font-bold block tracking-widest">Total Estimé</span>
          <span className="text-2xl font-black text-red-500 tracking-tighter">
            {fmt(results.total)} <span className="text-sm text-gray-500 font-normal">{currency}</span>
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* ══ GAUCHE ══ */}
          <div className="lg:col-span-5 flex flex-col gap-5">

            {/* Liaison terrassement */}
            {autoData.volumeRefDisponible && (
              <div className="flex items-start gap-3 p-3 bg-amber-500/8 border border-amber-500/30 rounded-2xl">
                <Link className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-amber-300 font-bold uppercase tracking-wider mb-1">
                    Données importées — Terrassement
                  </p>
                  <p className="text-xs text-amber-200/70">
                    Déblais totaux : <span className="font-mono font-bold text-amber-300">{fmtD(autoData.volumeRef)} m³</span>
                    {autoData.profondeurRef > 0 && (
                      <> · Profondeur : <span className="font-mono font-bold text-amber-300">{fmtD(autoData.profondeurRef)} m</span></>
                    )}
                  </p>
                  {autoData.profondeurRef > 0 && !inputs.profondeur && (
                    <button onClick={applyAutoData}
                      className="mt-2 text-[10px] bg-amber-500/20 border border-amber-500/40 text-amber-300 px-3 py-1 rounded-lg font-bold hover:bg-amber-500/30 transition-all">
                      Appliquer la profondeur automatique ↗
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Remblai estimé */}
            {results.volumeRemblaiEstime > 0 && (
              <div className="flex items-center justify-between p-3 bg-green-500/8 border border-green-500/30 rounded-2xl">
                <div>
                  <p className="text-[10px] text-green-300 font-bold uppercase tracking-wider">Remblai estimé automatique</p>
                  <p className="text-[11px] text-green-200/70">Fouilles − Béton de fondation</p>
                </div>
                <span className="text-sm font-black text-green-400 font-mono">{fmtD(results.volumeRemblaiEstime)} m³</span>
              </div>
            )}

            {/* ✅ Type d'ouvrage avec préremplissage intelligent */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-4">
              <h3 className="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                Type d'élément
                <span className="text-[9px] text-gray-500 normal-case font-normal">— dosage & acier préremplis automatiquement</span>
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(TYPES_FONDATION).map(([key, type]) => (
                  <button key={key}
                    onClick={() => handleTypeChange(key)}
                    className={`p-2 rounded-xl border text-[9px] font-bold transition-all flex flex-col items-center gap-1 ${
                      inputs.typeFondation === key
                        ? "border-red-500 bg-red-500/10 text-red-400"
                        : "border-gray-700 bg-gray-800 text-gray-500"
                    }`}>
                    <span className="text-lg">{type.icon}</span>
                    <span className="text-center leading-tight">{type.label}</span>
                    <span className="text-[8px] opacity-60">{type.acier} kg/m³</span>
                    <span className="text-[8px] opacity-40">{type.dosageForce} kg ciment</span>
                  </button>
                ))}
              </div>
              {inputs.typeFondation && (
                <p className="mt-2 text-[10px] text-gray-500 italic leading-relaxed">
                  {typeInfo.desc}
                </p>
              )}
            </div>

            {/* ✅ Béton de propreté automatique */}
            {typeInfo.needsPropreteAuto && (
              <div className="bg-green-500/5 border border-green-500/25 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-green-400" />
                    <h3 className="text-[10px] font-bold text-green-400 uppercase tracking-widest">
                      Béton de propreté — automatique
                    </h3>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={propreteAuto.actif}
                      onChange={(e) => setPropreteAuto((p) => ({ ...p, actif: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-700 rounded-full peer peer-checked:bg-green-600 transition-all" />
                    <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow peer-checked:translate-x-4 transition-transform" />
                  </label>
                </div>

                {propreteAuto.actif && (
                  <div className="flex items-end gap-3">
                    <div className="flex-1">
                      <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Épaisseur (m)</label>
                      <input
                        type="number"
                        value={propreteAuto.epaisseur}
                        onChange={(e) => setPropreteAuto((p) => ({ ...p, epaisseur: e.target.value }))}
                        className="w-full bg-gray-900 border border-gray-600 rounded-xl px-4 py-2.5 text-white focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all font-mono text-sm"
                        placeholder="0.05"
                        step="0.01"
                      />
                    </div>
                    <div className="flex-1 pb-0.5">
                      {results.volumeProprete > 0 ? (
                        <div className="bg-green-500/10 rounded-xl p-2.5 text-center">
                          <p className="text-[9px] text-green-400 font-bold uppercase">Volume calculé</p>
                          <p className="text-sm font-black text-green-300 font-mono">{fmtD(results.volumePropreteCmd)} m³</p>
                          <p className="text-[9px] text-green-500/70">{fmtD(results.sacsProprete, 1)} sacs ciment</p>
                        </div>
                      ) : (
                        <p className="text-[10px] text-gray-600 italic">Entrez les dimensions d'abord</p>
                      )}
                    </div>
                  </div>
                )}

                <p className="mt-2 text-[9px] text-green-400/50 italic">
                  Surface fondation × épaisseur · Dosage 150 kg/m³ CPJ 42,5 · Sans armatures
                </p>
              </div>
            )}

            {/* Dimensions */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5 shadow-lg">
              <h3 className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase mb-4">
                <Ruler className="w-3 h-3" /> Dimensions Géométriques
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label="Longueur (m)" value={inputs.longueur}
                  onChange={(e) => setInputs({ ...inputs, longueur: e.target.value })} />
                <InputGroup label="Largeur (m)"  value={inputs.largeur}
                  onChange={(e) => setInputs({ ...inputs, largeur: e.target.value })} />
                <InputGroup label="Épaisseur / Prof. (m)" value={inputs.profondeur}
                  onChange={(e) => setInputs({ ...inputs, profondeur: e.target.value })} full />
              </div>
            </div>

            {/* Paramètres techniques */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5 flex-1">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Dosage Ciment</label>
                  <select
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg p-2 text-sm text-white focus:border-red-500 outline-none"
                    value={inputs.dosage}
                    onChange={(e) => setInputs({ ...inputs, dosage: e.target.value })}>
                    {Object.entries(DOSAGES_CIMENT).map(([kg, val]) => (
                      <option key={kg} value={kg}>{val.label}</option>
                    ))}
                  </select>
                </div>
                <InputGroup label="Pertes & Recouv. (%)" value={inputs.margePerte}
                  onChange={(e) => setInputs({ ...inputs, margePerte: e.target.value })} />
              </div>

              {/* ✅ Ratio acier éditable */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase">
                    Ratio Acier HA (kg/m³)
                  </label>
                  <button
                    onClick={() => setInputs((p) => ({ ...p, ratioAcier: String(TYPES_FONDATION[p.typeFondation].acier) }))}
                    className="text-[9px] text-blue-400 hover:text-blue-300 border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 rounded-md font-bold transition-all"
                    title="Réinitialiser au ratio standard"
                  >
                    ↺ Défaut : {TYPES_FONDATION[inputs.typeFondation].acier} kg/m³
                  </button>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    value={inputs.ratioAcier}
                    onChange={(e) => setInputs({ ...inputs, ratioAcier: e.target.value })}
                    className="w-full bg-gray-900 border border-blue-500/50 rounded-xl px-4 py-2.5 text-white focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-all font-mono text-sm"
                    placeholder="0"
                    min="0"
                    step="5"
                  />
                  {parseFloat(inputs.ratioAcier) !== TYPES_FONDATION[inputs.typeFondation].acier &&
                   parseFloat(inputs.ratioAcier) >= 0 && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] text-amber-400 font-bold bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 rounded">
                      ✏️ modifié
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <InputGroup label={`Prix Unitaire (${currency}/m³)`} value={inputs.prixUnitaire}
                  onChange={(e) => setInputs({ ...inputs, prixUnitaire: e.target.value })} />
                <InputGroup label={`Main d'œuvre (${currency})`} value={inputs.coutMainOeuvre}
                  onChange={(e) => setInputs({ ...inputs, coutMainOeuvre: e.target.value })} />
              </div>

              <button onClick={handleSave}
                className="w-full mt-6 bg-red-600 hover:bg-red-500 text-white py-3.5 rounded-xl font-bold shadow-lg transition-all flex justify-center items-center gap-2">
                <Save className="w-5 h-5" /> Calculer & Enregistrer
              </button>
            </div>
          </div>

          {/* ══ DROITE ══ */}
          <div className="lg:col-span-7 flex flex-col gap-6">

            {/* Cartes résultats */}
            <div className="grid grid-cols-3 gap-4">
              <ResultCard label="Volume à Commander" value={fmtD(results.volumeCommande)} unit="m³"   icon="🧊" color="text-red-400"  bg="bg-red-500/10" />
              <ResultCard label="Ciment BA"           value={fmtD(results.cimentSacs, 1)} unit="sacs" icon="🧱" color="text-gray-200" bg="bg-gray-500/10" border />
              <ResultCard label="Acier HA"            value={fmtD(results.acierKg, 0)}   unit="kg"   icon={<Target className="w-4 h-4"/>} color="text-blue-400" bg="bg-blue-500/10" />
            </div>

            {/* ✅ Résumé béton de propreté si actif */}
            {results.volumeProprete > 0 && (
              <div className="bg-green-500/5 border border-green-500/20 rounded-2xl p-4">
                <p className="text-[10px] font-bold text-green-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <Zap className="w-3 h-3" /> Béton de propreté — généré automatiquement
                </p>
                <div className="grid grid-cols-4 gap-3">
                  <MiniStat label="Volume cmd" val={`${fmtD(results.volumePropreteCmd)} m³`} color="text-green-300" />
                  <MiniStat label="Ciment"     val={`${fmtD(results.sacsProprete, 1)} sacs`} color="text-green-300" />
                  <MiniStat label="Sable"      val={`${fmtD(results.sableProprete)} t`}      color="text-green-300" />
                  <MiniStat label="Gravier"    val={`${fmtD(results.gravierProprete)} t`}    color="text-green-300" />
                </div>
              </div>
            )}

            {/* Détail matériaux */}
            <div className="flex-1 bg-gray-800 rounded-2xl p-6 border border-gray-700 shadow-xl flex flex-col md:flex-row gap-8 items-center relative overflow-hidden">
              <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-red-600/5 rounded-full blur-3xl" />
              <div className="w-40 h-40 flex-shrink-0 relative">
                <Doughnut data={chartData} options={{ cutout: "75%", plugins: { legend: { display: false } } }} />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[10px] text-gray-500 uppercase">Poids</span>
                  <span className="text-sm font-bold text-red-500">
                    {fmtD(results.cimentT + results.sableT + results.gravierT + results.acierT)} T
                  </span>
                </div>
              </div>

              <div className="flex-1 w-full space-y-3">
                <h4 className="text-gray-400 text-xs font-bold uppercase tracking-widest border-b border-gray-700 pb-2 mb-2">
                  Détails des fournitures — Béton principal
                </h4>
                <MaterialRow label={`Ciment (${inputs.dosage} kg/m³)`} val={`${fmtD(results.cimentT)} t · ${fmtD(results.cimentSacs,1)} sacs`} color="bg-red-500" />
                <MaterialRow label="Sable 0/5"                          val={`${fmtD(results.sableT)} t`}   color="bg-amber-500" />
                <MaterialRow label="Gravier 5/25"                       val={`${fmtD(results.gravierT)} t`} color="bg-stone-500" />
                <MaterialRow
                  label={`Acier HA (${inputs.ratioAcier} kg/m³)`}
                  val={`${fmtD(results.acierKg, 0)} kg`}
                  color="bg-blue-500"
                />
                <div className="pt-2 border-t border-gray-700 flex justify-between items-center">
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Droplets className="w-3 h-3 text-cyan-400" /> Eau de gâchée
                  </span>
                  <span className="text-sm font-bold text-white">{fmtD(results.eauL, 0)} L</span>
                </div>

                {/* Note technique normalisée */}
                <div className="flex items-start gap-2 p-3 bg-red-500/5 rounded-lg border border-red-500/20 mt-2">
                  <Info className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                  <p className="text-[10px] text-red-200/60 leading-relaxed italic">
                    <strong>{typeInfo.label}</strong> · CPJ 42,5 · {inputs.dosage} kg/m³ · HA {inputs.ratioAcier} kg/m³
                    {parseFloat(inputs.ratioAcier) !== typeInfo.acier && (
                      <span className="text-amber-400"> (ratio modifié — standard : {typeInfo.acier} kg/m³)</span>
                    )}
                    {results.volumeRemblaiEstime > 0 && (
                      <> · Remblai transmis : <span className="font-mono text-green-400">{fmtD(results.volumeRemblaiEstime)} m³</span></>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Historique */}
            {historique.length > 0 && (
              <div className="bg-gray-800/30 rounded-2xl border border-gray-700/50 overflow-hidden">
                <div className="px-4 py-2 bg-gray-800/50 flex justify-between items-center">
                  <h4 className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2">
                    <History className="w-3 h-3" /> Historique
                  </h4>
                  <button onClick={() => { setHistorique([]); localStorage.removeItem(STORAGE_KEY); }}
                    className="text-[10px] text-red-400 hover:underline">Vider</button>
                </div>
                <div className="max-h-[120px] overflow-y-auto">
                  {historique.slice(0, 5).map((item) => (
                    <div key={item.id} className="flex justify-between items-center p-3 border-b border-gray-700/30">
                      <div className="text-xs">
                        <span className="text-gray-500 text-[10px] block">{item.date}</span>
                        {item.type} — {fmtD(item.volumeBrut)} m³
                      </div>
                      <span className="text-sm font-bold text-red-500">{fmt(item.total)} {currency}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SOUS-COMPOSANTS ──────────────────────────────────────────────────────────
const InputGroup = ({ label, value, onChange, full = false }) => (
  <div className={`flex flex-col ${full ? "col-span-2" : ""}`}>
    <label className="mb-1 text-[10px] font-bold text-gray-500 uppercase">{label}</label>
    <input type="number" value={value} onChange={onChange}
      className="w-full bg-gray-900 border border-gray-600 rounded-xl px-4 py-2.5 text-white focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all font-mono text-sm"
      placeholder="0" />
  </div>
);

const ResultCard = ({ label, value, unit, color, bg, border, icon }) => (
  <div className={`rounded-2xl p-4 flex flex-col justify-center items-center text-center ${bg} ${border ? "border border-gray-700" : ""}`}>
    <span className="text-[10px] text-gray-500 uppercase font-bold mb-1 flex items-center gap-1">{icon} {label}</span>
    <span className={`text-xl font-black ${color}`}>
      {value} <span className="text-xs font-normal text-gray-500">{unit}</span>
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

const MiniStat = ({ label, val, color }) => (
  <div className="bg-green-500/10 rounded-xl p-2 text-center">
    <p className="text-[9px] text-green-500/70 uppercase font-bold mb-0.5">{label}</p>
    <p className={`text-xs font-black font-mono ${color}`}>{val}</p>
  </div>
);