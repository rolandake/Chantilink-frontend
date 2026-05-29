import React, { useState, useEffect, useMemo } from "react";
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import {
  Ruler, Save, History, Anchor, Droplets, Link, Layers, Info,
} from "lucide-react";
import usePersistentState from "../../../../hooks/usePersistentState";

ChartJS.register(ArcElement, Tooltip, Legend);

const STORAGE_KEY = "chainage-history-pro";

const DOSAGE_BETON = {
  ciment:  0.350,
  sable:   0.6,
  gravier: 0.85,
  eau:     175,
};

const TYPES_LONGRINES = [
  { id: "bas",           label: "Chaînage bas",             acierCoef: 80,  desc: "Liaison basse au niveau des murs ou soubassements" },
  { id: "haut",          label: "Chaînage haut",            acierCoef: 90,  desc: "Liaison haute sous dalle, toiture ou plancher" },
  { id: "intermediaire", label: "Chaînage intermédiaire",   acierCoef: 80,  desc: "Raidisseur horizontal intermédiaire" },
  { id: "redressement",  label: "Chaînage de redressement", acierCoef: 120, desc: "Liaison renforcée pour reprise d'excentrement" },
];

const fmtD = (n, d = 2) => (n || 0).toFixed(d);
const fmt  = (n) => Math.round(n).toLocaleString("fr-FR");

export default function Longrines({
  currency = "XOF",
  onTotalChange,
  onMateriauxChange,
  onResultsChange,  // ✅ nouveau
  projectResults,   // ✅ nouveau — contient poteaux, murs, etc.
}) {

  const [typeLongrine, setTypeLongrine] = usePersistentState("elevations:longrines:typeLongrine", "bas");
  const [inputs, setInputs] = usePersistentState("elevations:longrines:inputs", {
    nombre:         "1",
    longueur:       "",
    largeur:        "",
    hauteur:        "",
    facesCoffrage:  "3",
    prixUnitaire:   "",
    coutMainOeuvre: "",
    marge:          "10",
  });
  const [historique, setHistorique] = useState([]);
  const [message,    setMessage]    = useState(null);

  // ✅ LIAISON AUTOMATIQUE : Poteaux → Chaînage
  // Quand les poteaux sont calculés, on peut suggérer la longueur totale du chaînage.
  const poteauxData = projectResults?.poteaux;
  const autoSuggestion = useMemo(() => {
    if (!poteauxData?.nombre || poteauxData.nombre < 2) return null;
    const entraxe = poteauxData.entraxeMoyen || 3.5;
    const longueurEstimee = ((poteauxData.nombre - 1) * entraxe).toFixed(1);
    return {
      longueurEstimee,
      nombre: poteauxData.nombre,
      entraxe,
      largeurSugeree: poteauxData.largeur
        ? poteauxData.largeur.toFixed(2)
        : poteauxData.diametre
          ? poteauxData.diametre.toFixed(2)
          : "",
    };
  }, [poteauxData]);

  const applyAutoLongueur = () => {
    setInputs((prev) => ({
      ...prev,
      longueur: autoSuggestion?.longueurEstimee || prev.longueur,
      largeur:  autoSuggestion?.largeurSugeree  || prev.largeur,
    }));
  };

  const autoInputValues = useMemo(() => ({
    longueur: autoSuggestion?.longueurEstimee || 0,
    largeur:  autoSuggestion?.largeurSugeree  || 0,
  }), [autoSuggestion]);

  const getEffectiveInput = (key) => {
    const current = inputs[key];
    const auto = autoInputValues[key];
    if ((current === undefined || current === "") && Number(auto) > 0) return String(auto);
    return current;
  };

  // ── Calcul ────────────────────────────────────────────────────────────────
  const results = useMemo(() => {
    const nb = parseFloat(inputs.nombre) || 1;
    const L = parseFloat(getEffectiveInput("longueur")) || 0;
    const l = parseFloat(getEffectiveInput("largeur"))  || 0;
    const h = parseFloat(inputs.hauteur)  || 0;
    const facesCoffrage = parseFloat(inputs.facesCoffrage) || 3;
    const margeCoef = 1 + (parseFloat(inputs.marge) || 0) / 100;

    const volumeTheorique = L * l * h * nb;
    const volumeCommande  = volumeTheorique * margeCoef;
    const surfaceCoffrage = ((2 * h) + (facesCoffrage >= 3 ? l : 0)) * L * nb;

    const acierRatio = TYPES_LONGRINES.find((t) => t.id === typeLongrine)?.acierCoef || 80;
    const acierKg    = volumeTheorique * acierRatio;
    const acierT     = acierKg / 1000;

    const cimentT    = volumeCommande * DOSAGE_BETON.ciment;
    const cimentSacs = (cimentT * 1000) / 50;
    const sableT     = volumeCommande * DOSAGE_BETON.sable;
    const gravierT   = volumeCommande * DOSAGE_BETON.gravier;
    const eauL       = volumeCommande * DOSAGE_BETON.eau;

    const pu    = parseFloat(inputs.prixUnitaire)    || 0;
    const mo    = parseFloat(inputs.coutMainOeuvre)  || 0;
    const total = (volumeCommande * pu) + mo;

    return {
      volumeTheorique, volumeCommande, surfaceCoffrage,
      cimentT, cimentSacs, sableT, gravierT, acierT, acierKg, eauL,
      total, acierRatio,
      nombre: nb,
      facesCoffrage,
    };
  }, [inputs, typeLongrine, autoInputValues]);

  // ── Sync parent + store ───────────────────────────────────────────────────
  useEffect(() => {
    onTotalChange?.(results.total);
    onMateriauxChange?.({
      volume: results.volumeCommande,
      ciment: results.cimentT,
      sable: results.sableT,
      gravier: results.gravierT,
      eau: results.eauL,
      acier:  results.acierT,
      coffrage: results.surfaceCoffrage,
    });
    // ✅ Émission résultats → autres modules
    onResultsChange?.({
      longueur:        parseFloat(getEffectiveInput("longueur")) || 0,
      largeur:         parseFloat(getEffectiveInput("largeur"))  || 0,
      hauteur:         parseFloat(inputs.hauteur)  || 0,
      nombre:          results.nombre,
      volumeCommande:  results.volumeCommande,
      volumeTheorique: results.volumeTheorique,
      surfaceCoffrage: results.surfaceCoffrage,
      acierKg:         results.acierKg,
      cimentSacs:      results.cimentSacs,
      typeLongrine,
    });
  }, [results.total, results.volumeCommande, results.acierKg]);

  // ── Historique ────────────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setHistorique(JSON.parse(saved));
    } catch {}
  }, []);

  const handleSave = () => {
    if (results.volumeTheorique <= 0) return showToast("⚠️ Dimensions invalides", "error");
    const newEntry = {
      id: Date.now(),
      date: new Date().toLocaleString(),
      typeLabel: TYPES_LONGRINES.find((t) => t.id === typeLongrine).label,
      ...inputs, ...results,
    };
    const newHist = [newEntry, ...historique];
    setHistorique(newHist);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newHist));
    showToast("✅ Chaînage sauvegardé !");
  };

  const showToast = (msg, type = "success") => {
    setMessage({ text: msg, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const chartData = {
    labels: ["Béton", "Acier"],
    datasets: [{
      data: [results.total - (parseFloat(inputs.coutMainOeuvre) || 0), (results.acierKg * 500) / 100],
      backgroundColor: ["#10b981", "#ef4444"],
      borderColor: "#111827",
      borderWidth: 2,
    }],
  };

  return (
    <div className="w-full h-full flex flex-col bg-gray-900 text-gray-100 overflow-hidden relative">

      {message && (
        <div className={`fixed top-4 right-4 px-6 py-3 rounded-xl shadow-2xl z-50 font-bold animate-in fade-in slide-in-from-top-2 ${
          message.type === "error" ? "bg-red-600" : "bg-emerald-600"
        }`}>
          {message.text}
        </div>
      )}

      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-600/20 rounded-lg text-emerald-500">
            <Link className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Élévation : Chaînage</h2>
            <p className="text-xs text-gray-400 font-medium tracking-tight">Liaisons horizontales bas, haut et intermédiaires</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-gray-500 uppercase font-bold block">Estimation Partielle</span>
          <span className="text-2xl font-black text-emerald-400 tracking-tighter">
            {fmt(results.total)} <span className="text-sm text-gray-500 font-normal">{currency}</span>
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-6 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* ── GAUCHE ── */}
          <div className="lg:col-span-5 flex flex-col gap-5">

            {/* ✅ SUGGESTION AUTOMATIQUE DEPUIS POTEAUX */}
            {autoSuggestion && (
              <div className="flex items-start gap-3 p-3 bg-emerald-500/8 border border-emerald-500/30 rounded-2xl">
                <Link className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-emerald-300 font-bold uppercase tracking-wider mb-1">
                    Données importées — Poteaux
                  </p>
                  <p className="text-xs text-emerald-200/70">
                    {autoSuggestion.nombre} poteaux · Entraxe ~{autoSuggestion.entraxe} m
                    → Chaînage estimé : <span className="font-mono font-bold text-emerald-300">{autoSuggestion.longueurEstimee} m</span>
                  </p>
                  <button onClick={applyAutoLongueur}
                    className="mt-2 text-[10px] bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 px-3 py-1 rounded-lg font-bold hover:bg-emerald-500/30 transition-all">
                    Appliquer automatiquement ↗
                  </button>
                </div>
              </div>
            )}

            {/* Type de chaînage */}
            <div className="bg-gray-800 p-2 rounded-2xl border border-gray-700">
              <div className="grid grid-cols-2 gap-2">
                {TYPES_LONGRINES.map((t) => (
                  <button key={t.id} onClick={() => setTypeLongrine(t.id)}
                    className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all ${
                      typeLongrine === t.id
                        ? "bg-emerald-600 text-white shadow-lg"
                        : "text-gray-400 hover:text-white hover:bg-gray-700"
                    }`}>
                    <span className="text-xs font-bold">{t.label}</span>
                    <span className="text-[9px] opacity-70 tracking-tighter uppercase">{t.acierCoef}kg/m³</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Dimensions */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5 shadow-lg space-y-4">
              <h3 className="flex items-center gap-2 text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
                <Ruler className="w-3 h-3" /> Dimensions Fouille (m)
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label="Nombre de lignes" value={inputs.nombre} onChange={(v) => setInputs({ ...inputs, nombre: v })} />
                <InputGroup label="Longueur Totale" value={inputs.longueur} onChange={(v) => setInputs({ ...inputs, longueur: v })} autoValue={autoInputValues.longueur} full />
                <InputGroup label="Largeur"         value={inputs.largeur}  onChange={(v) => setInputs({ ...inputs, largeur: v })}  autoValue={autoInputValues.largeur} placeholder="0.20" />
                <InputGroup label="Hauteur"         value={inputs.hauteur}  onChange={(v) => setInputs({ ...inputs, hauteur: v })}  placeholder="0.40" />
                <InputGroup label="Faces coffrage"  value={inputs.facesCoffrage} onChange={(v) => setInputs({ ...inputs, facesCoffrage: v })} placeholder="2 ou 3" />
                <InputGroup label="Marge perte (%)" value={inputs.marge}    onChange={(v) => setInputs({ ...inputs, marge: v })} />
              </div>
            </div>

            {/* Prix + Bouton */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5 shadow-lg space-y-4 flex-1">
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label={`PU Béton (${currency}/m³)`} value={inputs.prixUnitaire}    onChange={(v) => setInputs({ ...inputs, prixUnitaire: v })} />
                <InputGroup label={`Main d'œuvre (${currency})`} value={inputs.coutMainOeuvre} onChange={(v) => setInputs({ ...inputs, coutMainOeuvre: v })} />
              </div>
              <button onClick={handleSave}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-xl font-bold shadow-lg transition-all flex justify-center items-center gap-2 mt-4">
                <Save className="w-5 h-5" /> Enregistrer le chaînage
              </button>
            </div>

            {/* Synthèse interne */}
            <div className="bg-gray-800/50 border border-emerald-500/20 rounded-2xl p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <p className="text-[10px] text-emerald-300 uppercase font-bold tracking-widest">Synthèse chaînage</p>
                  <p className="text-[11px] text-gray-500">Récapitulatif interne en temps réel</p>
                </div>
                <span className="text-sm font-black text-emerald-400 font-mono">{fmt(results.total)} {currency}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <ReadonlySummaryField label="Longueur" value={fmtD(parseFloat(getEffectiveInput("longueur")) || 0)} unit="m" />
                <ReadonlySummaryField label="Nombre" value={fmtD(results.nombre, 0)} unit="u" />
                <ReadonlySummaryField label="Volume brut" value={fmtD(results.volumeTheorique)} unit="m³" />
                <ReadonlySummaryField label="Volume commande" value={fmtD(results.volumeCommande)} unit="m³" />
                <ReadonlySummaryField label="Coffrage" value={fmtD(results.surfaceCoffrage)} unit="m²" />
                <ReadonlySummaryField label="Ciment" value={fmtD(results.cimentSacs, 1)} unit="sacs" />
                <ReadonlySummaryField label="Acier HA" value={fmtD(results.acierKg, 0)} unit="kg" />
              </div>
            </div>
          </div>

          {/* ── DROITE ── */}
          <div className="lg:col-span-7 flex flex-col gap-6">

            <div className="grid grid-cols-3 gap-4">
              <ResultCard label="Volume Brut"  value={fmtD(results.volumeCommande)} unit="m³" icon="🧊"                           color="text-emerald-400" bg="bg-emerald-500/10" />
              <ResultCard label="Sacs Ciment"  value={fmtD(results.cimentSacs, 1)} unit="u"  icon="🧱"                           color="text-white"       bg="bg-gray-800" border />
              <ResultCard label="Acier HA"     value={fmtD(results.acierKg, 0)}   unit="kg" icon={<Anchor className="w-4 h-4"/>} color="text-red-400"     bg="bg-red-500/10" />
            </div>

            <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 shadow-xl flex flex-col md:flex-row gap-8 items-center relative">
              <div className="w-44 h-44 flex-shrink-0 relative">
                <Doughnut data={chartData} options={{ cutout: "75%", plugins: { legend: { display: false } } }} />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[10px] text-gray-500 uppercase font-bold">Coffrage</span>
                  <span className="text-sm font-bold text-white">{fmtD(results.surfaceCoffrage, 1)} m²</span>
                </div>
              </div>

              <div className="flex-1 w-full space-y-3">
                <h4 className="text-gray-400 text-xs font-bold uppercase tracking-widest border-b border-gray-700 pb-2 mb-2">Analyse Technique</h4>
                <MaterialRow label="Ciment (350kg/m³)"       val={`${fmtD(results.cimentT)} t`}     color="bg-emerald-500" />
                <MaterialRow label="Sable (Ratio 0.6)"       val={`${fmtD(results.sableT)} t`}      color="bg-amber-500" />
                <MaterialRow label="Gravier (Ratio 0.85)"    val={`${fmtD(results.gravierT)} t`}    color="bg-stone-500" />
                <MaterialRow label={`Acier (${results.acierRatio}kg/m³)`} val={`${fmtD(results.acierKg, 0)} kg`} color="bg-red-500" />
                <div className="pt-2 border-t border-gray-700 flex justify-between items-center mt-2">
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Droplets className="w-3 h-3 text-cyan-400" /> Eau nécessaire
                  </span>
                  <span className="text-sm font-bold text-white font-mono">{fmtD(results.eauL, 0)} L</span>
                </div>
                <div className="flex items-start gap-2 p-3 bg-emerald-500/5 rounded-lg border border-emerald-500/20">
                  <Info className="w-4 h-4 text-emerald-400 mt-0.5" />
                  <p className="text-[10px] text-emerald-200/70 leading-relaxed italic">
                    Le chaînage de <strong>redressement</strong> nécessite un ratio d'acier élevé pour compenser l'excentrement des charges.
                  </p>
                </div>
              </div>
            </div>

            {historique.length > 0 && (
              <div className="bg-gray-800/30 rounded-2xl border border-gray-700/50 overflow-hidden">
                <div className="px-4 py-2 bg-gray-800/50 border-b border-gray-700/50 flex justify-between items-center">
                <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                    <History className="w-3 h-3" /> Historique du chaînage
                  </h4>
                </div>
                <div className="max-h-[100px] overflow-y-auto">
                  {historique.slice(0, 5).map((item) => (
                    <div key={item.id} className="flex justify-between items-center p-3 border-b border-gray-700/30">
                      <div className="text-xs">
                        <span className="text-gray-500 text-[9px] block">{item.date}</span>
                        <span className="font-medium">{item.typeLabel} — {fmtD(item.volumeTheorique, 1)} m³</span>
                      </div>
                      <span className="text-sm font-bold text-emerald-400">{fmt(item.total)} {currency}</span>
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

const InputGroup = ({ label, value, onChange, placeholder, full = false, autoValue = 0 }) => {
  const usesAutoValue = (value === undefined || value === "") && Number(autoValue) > 0;

  return (
    <div className={`flex flex-col ${full ? "col-span-2" : ""}`}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">{label}</label>
        {usesAutoValue && (
          <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-emerald-300">
            Auto
          </span>
        )}
      </div>
      <input type="number" value={usesAutoValue ? fmtD(autoValue) : value} onChange={(e) => onChange(e.target.value)}
        placeholder={usesAutoValue ? `Auto: ${fmtD(autoValue)}` : placeholder || "0"}
        className={`w-full bg-gray-900 border rounded-xl px-4 py-2.5 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-mono text-sm ${
          usesAutoValue ? "border-emerald-500/40 text-emerald-200" : "border-gray-600 text-white"
        }`} />
    </div>
  );
};

const ReadonlySummaryField = ({ label, value, unit }) => (
  <div>
    <label className="block mb-1 text-[10px] font-bold text-gray-500 uppercase tracking-wide leading-tight">{label}</label>
    <div className="flex items-center gap-2 rounded-xl border border-gray-700 bg-gray-950/70 px-3 py-2">
      <input
        readOnly
        value={value}
        className="min-w-0 flex-1 bg-transparent text-sm font-mono font-bold text-white outline-none"
      />
      <span className="text-[10px] font-bold uppercase text-gray-500">{unit}</span>
    </div>
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
