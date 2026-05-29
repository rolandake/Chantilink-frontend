import React, { useState, useEffect, useMemo } from "react";
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import {
  Square, Ruler, Save, History, Anchor, Droplets, Layers, Info, Target, Link,
  ChevronDown,
} from "lucide-react";
import usePersistentState from "../../../../hooks/usePersistentState";

ChartJS.register(ArcElement, Tooltip, Legend);

const STORAGE_KEY = "dalles-history-pro";

const TYPES_DALLES = {
  TERRE_PLEIN: { label: "Dallage terre-plein", acier: 40, icon: "🚜", desc: "Béton sur sol, treillis léger" },
  ETAGE:       { label: "Dalle pleine",        acier: 80, icon: "🏗️", desc: "Dalle BA coulée pleine" },
  HOURDIS:     { label: "Plancher poutrelles-hourdis", acier: 25, icon: "▦", desc: "Hourdis + dalle de compression" },
};

const DOSAGE = {
  ciment:  0.350,
  sable:   0.6,
  gravier: 0.85,
  eau:     175,
};

const fmtD = (n, d = 2) => (n || 0).toFixed(d);
const fmt  = (n) => Math.round(n).toLocaleString("fr-FR");

export default function Dalles({
  currency = "XOF",
  onTotalChange,
  onMateriauxChange,
  onResultsChange,  // ✅ nouveau
  projectResults,   // ✅ nouveau
}) {

  const [typeDalle, setTypeDalle] = usePersistentState("elevations:dalles:typeDalle", "ETAGE");
  const [inputs, setInputs] = usePersistentState("elevations:dalles:inputs", {
    nombre:         "1",
    longueur:       "",
    largeur:        "",
    epaisseur:      "0.15",
    epaisseurCompression: "0.05",
    entraxePoutrelles:    "0.60",
    hauteurNiveau:  "",   // ✅ hauteur entre niveaux — transmise aux Escaliers
    prixUnitaire:   "",
    prixPlancherM2: "",
    coutMainOeuvre: "",
    marge:          "5",
  });
  const [historique, setHistorique] = useState([]);
  const [message,    setMessage]    = useState(null);

  // ── Calcul ────────────────────────────────────────────────────────────────
  const results = useMemo(() => {
    const L = parseFloat(inputs.longueur)  || 0;
    const l = parseFloat(inputs.largeur)   || 0;
    const e = typeDalle === "HOURDIS"
      ? parseFloat(inputs.epaisseurCompression) || 0
      : parseFloat(inputs.epaisseur) || 0;
    const nb = parseFloat(inputs.nombre) || 1;
    const entraxe = parseFloat(inputs.entraxePoutrelles) || 0;
    const margeCoef = 1 + (parseFloat(inputs.marge) || 0) / 100;

    const surfaceUnitaire = L * l;
    const surface     = surfaceUnitaire * nb;
    const volumeGeo   = surface * e;
    const volumeFinal = volumeGeo * margeCoef;
    const perimetreUnitaire = 2 * (L + l);
    const surfaceCoffrage = typeDalle === "TERRE_PLEIN"
      ? perimetreUnitaire * e * nb
      : surface;

    const ratioAcier = TYPES_DALLES[typeDalle].acier;
    const acierKg    = volumeFinal * ratioAcier;
    const acierT     = acierKg / 1000;

    const cimentT    = volumeFinal * DOSAGE.ciment;
    const cimentSacs = (cimentT * 1000) / 50;
    const sableT     = volumeFinal * DOSAGE.sable;
    const gravierT   = volumeFinal * DOSAGE.gravier;
    const eauL       = volumeFinal * DOSAGE.eau;

    const pu    = parseFloat(inputs.prixUnitaire)   || 0;
    const prixPlancherM2 = parseFloat(inputs.prixPlancherM2) || 0;
    const mo    = parseFloat(inputs.coutMainOeuvre) || 0;
    const coutSystemePlancher = typeDalle === "HOURDIS" ? surface * prixPlancherM2 : 0;
    const total = (volumeFinal * pu) + coutSystemePlancher + mo;

    const nombrePoutrellesUnitaire = typeDalle === "HOURDIS" && l > 0 && entraxe > 0
      ? Math.ceil(l / entraxe) + 1
      : 0;
    const nombrePoutrelles = nombrePoutrellesUnitaire * nb;
    const lineairePoutrelles = nombrePoutrelles * L;

    return {
      surface, volumeGeo, volumeFinal,
      surfaceUnitaire,
      nombre: nb,
      surfaceCoffrage,
      nombrePoutrelles,
      lineairePoutrelles,
      coutSystemePlancher,
      cimentT, cimentSacs, sableT, gravierT, acierT, acierKg, eauL,
      total, mo, ratioAcier,
    };
  }, [inputs, typeDalle]);

  // ── Sync parent + store ───────────────────────────────────────────────────
  useEffect(() => {
    onTotalChange?.(results.total);
    onMateriauxChange?.({
      volume: results.volumeFinal,
      ciment: results.cimentT,
      sable: results.sableT,
      gravier: results.gravierT,
      eau: results.eauL,
      acier:  results.acierT,
      coffrage: results.surfaceCoffrage,
    });
    // ✅ ÉMISSION résultats → Escaliers (hauteurNiveau), Finitions (surface carrelage)
    onResultsChange?.({
      surface:        results.surface,
      surfaceUnitaire: results.surfaceUnitaire,
      nombre:         results.nombre,
      nombrePoutrelles: results.nombrePoutrelles,
      lineairePoutrelles: results.lineairePoutrelles,
      volumeFinal:    results.volumeFinal,
      surfaceCoffrage: results.surfaceCoffrage,
      epaisseur:      typeDalle === "HOURDIS"
        ? parseFloat(inputs.epaisseurCompression) || 0
        : parseFloat(inputs.epaisseur) || 0,
      hauteurNiveau:  parseFloat(inputs.hauteurNiveau)  || 0,  // pour Escaliers
      typeDalle,
      acierKg:        results.acierKg,
      // La surface de la dalle = surface carrelage potentielle
      surfaceCarrelage: results.surface,
    });
  }, [results.total, results.surface, results.volumeFinal, results.surfaceCoffrage, inputs.hauteurNiveau, typeDalle]);

  // ── Historique ────────────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setHistorique(JSON.parse(saved));
    } catch {}
  }, []);

  const handleSave = () => {
    if (results.surface <= 0) return showToast("⚠️ Dimensions manquantes", "error");
    const newEntry = {
      id: Date.now(),
      date: new Date().toLocaleString(),
      type: TYPES_DALLES[typeDalle].label,
      ...inputs, ...results,
    };
    const newHist = [newEntry, ...historique];
    setHistorique(newHist);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newHist));
    showToast("✅ Dalle enregistrée !");
  };

  const showToast = (msg, type = "success") => {
    setMessage({ text: msg, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const chartData = {
    labels: [typeDalle === "HOURDIS" ? "Béton + hourdis" : "Béton", "Acier"],
    datasets: [{
      data: [results.total - results.mo, (results.acierKg * 500) / 100],
      backgroundColor: ["#f43f5e", "#ef4444"],
      borderColor: "#111827",
      borderWidth: 2,
    }],
  };

  return (
    <div className="w-full h-full flex flex-col bg-gray-900 text-gray-100 overflow-hidden relative">

      {message && (
        <div className={`fixed top-4 right-4 px-6 py-3 rounded-xl shadow-2xl z-50 font-bold animate-in fade-in slide-in-from-top-2 ${
          message.type === "error" ? "bg-red-600" : "bg-rose-600"
        }`}>
          {message.text}
        </div>
      )}

      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-rose-600/20 rounded-lg text-rose-500"><Square className="w-6 h-6" /></div>
          <div>
            <h2 className="text-xl font-bold text-white">Élévation : Dalles / Planchers</h2>
            <p className="text-xs text-gray-400">Planchers pleins & Dallages</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-gray-500 uppercase font-bold block">Estimation Dalle</span>
          <span className="text-2xl font-black text-rose-400 tracking-tighter">
            {fmt(results.total)} <span className="text-sm text-gray-500 font-normal">{currency}</span>
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-6 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* ── GAUCHE ── */}
          <div className="lg:col-span-5 flex flex-col gap-5">

            {/* Type de dalle / plancher */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-4 shadow-lg">
              <label className="block mb-1 text-[10px] font-bold text-gray-500 uppercase tracking-wide">
                Type d'ouvrage
              </label>
              <div className="relative">
                <select
                  value={typeDalle}
                  onChange={(e) => setTypeDalle(e.target.value)}
                  className="w-full appearance-none bg-gray-900 border border-gray-600 rounded-xl px-4 py-3 pr-10 text-white focus:border-rose-500 outline-none font-bold text-sm"
                >
                  {Object.entries(TYPES_DALLES).map(([id, t]) => (
                    <option key={id} value={id}>{t.label}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              </div>
              <p className="mt-2 text-[10px] text-gray-500">
                {TYPES_DALLES[typeDalle].icon} {TYPES_DALLES[typeDalle].desc}
              </p>
            </div>

            {/* Dimensions */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5 shadow-lg space-y-4">
              <h3 className="flex items-center gap-2 text-[10px] font-bold text-rose-400 uppercase tracking-widest">
                <Ruler className="w-3 h-3" /> Dimensions (m)
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label="Longueur" value={inputs.longueur} onChange={(v) => setInputs({ ...inputs, longueur: v })} />
                <InputGroup label="Largeur"  value={inputs.largeur}  onChange={(v) => setInputs({ ...inputs, largeur: v })} />
                <InputGroup
                  label={typeDalle === "HOURDIS" ? "Nombre de planchers" : "Nombre de dalles"}
                  value={inputs.nombre}
                  onChange={(v) => setInputs({ ...inputs, nombre: v })}
                />
                {typeDalle === "HOURDIS" ? (
                  <>
                    <InputGroup
                      label="Dalle compression (m)"
                      value={inputs.epaisseurCompression}
                      onChange={(v) => setInputs({ ...inputs, epaisseurCompression: v })}
                      placeholder="Ex: 0.05"
                    />
                    <InputGroup
                      label="Entraxe poutrelles (m)"
                      value={inputs.entraxePoutrelles}
                      onChange={(v) => setInputs({ ...inputs, entraxePoutrelles: v })}
                      placeholder="Ex: 0.60"
                      full
                    />
                  </>
                ) : (
                  <InputGroup
                    label="Épaisseur béton (m)"
                    value={inputs.epaisseur}
                    onChange={(v) => setInputs({ ...inputs, epaisseur: v })}
                    placeholder="Ex: 0.15"
                    full
                  />
                )}
              </div>
            </div>

            {/* ✅ Hauteur de niveau — transmise aux Escaliers */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Link className="w-3.5 h-3.5 text-rose-400" />
                <h3 className="text-[10px] font-bold text-rose-400 uppercase tracking-widest">
                  Hauteur entre niveaux (m) — transmise aux Escaliers
                </h3>
              </div>
              <InputGroup
                label="Hauteur de niveau (m)"
                value={inputs.hauteurNiveau}
                onChange={(v) => setInputs({ ...inputs, hauteurNiveau: v })}
                placeholder="Ex: 3.00"
                full />
              {inputs.hauteurNiveau && (
                <p className="mt-2 text-[10px] text-rose-300/60 italic">
                  Cette valeur sera automatiquement utilisée dans le module Escaliers.
                </p>
              )}
            </div>

            {/* Prix + bouton */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5 shadow-lg space-y-4 flex-1">
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label={`PU Béton (${currency}/m³)`} value={inputs.prixUnitaire}   onChange={(v) => setInputs({ ...inputs, prixUnitaire: v })} />
                <InputGroup label="Pertes (%)"                   value={inputs.marge}          onChange={(v) => setInputs({ ...inputs, marge: v })} />
                {typeDalle === "HOURDIS" && (
                  <InputGroup
                    label={`Poutrelles-hourdis (${currency}/m²)`}
                    value={inputs.prixPlancherM2}
                    onChange={(v) => setInputs({ ...inputs, prixPlancherM2: v })}
                    full
                  />
                )}
              </div>
              <button onClick={handleSave}
                className="w-full mt-6 bg-rose-600 hover:bg-rose-500 text-white py-4 rounded-xl font-bold shadow-lg transition-all flex justify-center items-center gap-2">
                <Save className="w-5 h-5" /> Enregistrer {typeDalle === "HOURDIS" ? "Plancher" : "Dalle"}
              </button>
            </div>
          </div>

          {/* ── DROITE ── */}
          <div className="lg:col-span-7 flex flex-col gap-6">

            <div className="grid grid-cols-3 gap-4">
              <ResultCard label={typeDalle === "HOURDIS" ? "Béton compression" : "Volume béton"} value={fmtD(results.volumeFinal)} unit="m³" icon="🧊" color="text-rose-400" bg="bg-rose-500/10" />
              <ResultCard
                label={typeDalle === "TERRE_PLEIN" ? "Coffrage rive" : "Coffrage/étaiement"}
                value={fmtD(results.surfaceCoffrage, 1)}
                unit="m²"
                icon={<Layers className="w-4 h-4"/>}
                color="text-indigo-400"
                bg="bg-indigo-500/10"
                border
              />
              <ResultCard label="Acier (HA/TS)" value={fmtD(results.acierKg, 0)} unit="kg" icon={<Target className="w-4 h-4"/>} color="text-red-400"    bg="bg-red-500/10" />
            </div>

            {/* Bandeau liaisons émises */}
            {results.surface > 0 && (
              <div className="flex flex-col gap-2 p-3 bg-rose-500/5 border border-rose-500/20 rounded-2xl">
                <div className="flex items-center gap-2">
                  <Link className="w-3.5 h-3.5 text-rose-400" />
                  <p className="text-[10px] text-rose-300 font-bold uppercase tracking-wider">Données transmises automatiquement</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="text-[10px] bg-rose-500/15 text-rose-300 px-2 py-0.5 rounded font-mono">
                    → Finitions/Carrelage : {fmtD(results.surface)} m² ({fmtD(results.nombre, 0)} {typeDalle === "HOURDIS" ? "plancher" : "dalle"}{results.nombre > 1 ? "s" : ""})
                  </span>
                  {inputs.hauteurNiveau && (
                    <span className="text-[10px] bg-rose-500/15 text-rose-300 px-2 py-0.5 rounded font-mono">
                      → Escaliers : H = {inputs.hauteurNiveau} m
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="flex-1 bg-gray-800 rounded-2xl p-6 border border-gray-700 shadow-xl flex flex-col md:flex-row gap-8 items-center relative overflow-hidden">
              <div className="w-40 h-40 flex-shrink-0 relative">
                <Doughnut data={chartData} options={{ cutout: "75%", plugins: { legend: { display: false } } }} />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[10px] text-gray-500 uppercase font-bold">Ciment</span>
                  <span className="text-sm font-bold text-white">{fmtD(results.cimentSacs, 1)} sacs</span>
                </div>
              </div>

              <div className="flex-1 w-full space-y-3">
                <h4 className="text-gray-400 text-xs font-bold uppercase tracking-widest border-b border-gray-700 pb-2 mb-2">Analyse Technique</h4>
                <MaterialRow label="Ciment (350kg/m³)"       val={`${fmtD(results.cimentT)} t`}     color="bg-rose-500" />
                <MaterialRow label="Sable (0.6 t/m³)"        val={`${fmtD(results.sableT)} t`}      color="bg-amber-500" />
                <MaterialRow label="Gravier (0.85 t/m³)"     val={`${fmtD(results.gravierT)} t`}    color="bg-stone-500" />
                <MaterialRow label={typeDalle === "HOURDIS" ? "Surface totale hourdis" : "Surface totale dalles"} val={`${fmtD(results.surface)} m²`} color="bg-indigo-500" />
                <MaterialRow label={typeDalle === "TERRE_PLEIN" ? "Coffrage de rive" : "Coffrage / étaiement"} val={`${fmtD(results.surfaceCoffrage, 1)} m²`} color="bg-blue-500" />
                {typeDalle === "HOURDIS" && (
                  <>
                    <MaterialRow label="Nombre poutrelles estimé" val={`${fmtD(results.nombrePoutrelles, 0)} u`} color="bg-cyan-500" />
                    <MaterialRow label="Linéaire poutrelles" val={`${fmtD(results.lineairePoutrelles)} ml`} color="bg-blue-500" />
                    <MaterialRow label="Coût système hourdis" val={`${fmt(results.coutSystemePlancher)} ${currency}`} color="bg-emerald-500" />
                  </>
                )}
                <MaterialRow label={`Acier (${results.ratioAcier}kg/m³)`} val={`${fmtD(results.acierKg, 0)} kg`} color="bg-red-500" />
                <div className="pt-2 border-t border-gray-700 flex justify-between items-center mt-2">
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Droplets className="w-3 h-3 text-cyan-400" /> Eau nécessaire
                  </span>
                  <span className="text-sm font-bold text-white font-mono">{fmtD(results.eauL, 0)} L</span>
                </div>
                <div className="flex items-start gap-2 p-3 bg-rose-500/5 rounded-lg border border-rose-500/20">
                  <Info className="w-4 h-4 text-rose-400 mt-0.5" />
                  <p className="text-[10px] text-rose-200/70 leading-relaxed italic">
                    {typeDalle === "HOURDIS"
                      ? "Pour un plancher poutrelles-hourdis, le béton calculé correspond à la dalle de compression. Les poutrelles et hourdis sont estimés au m² et en linéaire."
                      : "Pour une dalle d'étage, prévoyez environ 1 étai par m² pour supporter le poids du béton frais."}
                  </p>
                </div>
              </div>
            </div>

            {historique.length > 0 && (
              <div className="bg-gray-800/30 rounded-2xl border border-gray-700/50 overflow-hidden">
                <div className="px-4 py-2 bg-gray-800/50 border-b border-gray-700/50 flex justify-between items-center">
                  <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                    <History className="w-3 h-3" /> Historique
                  </h4>
                </div>
                <div className="max-h-[100px] overflow-y-auto">
                  {historique.slice(0, 5).map((item) => (
                    <div key={item.id} className="flex justify-between items-center p-3 border-b border-gray-700/30">
                      <div className="text-xs">
                        <span className="text-gray-500 text-[9px] block">{item.date}</span>
                        {item.type} — {fmtD(item.surface, 1)} m²
                      </div>
                      <span className="text-sm font-bold text-rose-500">{fmt(item.total)} {currency}</span>
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

const InputGroup = ({ label, value, onChange, placeholder, full = false }) => (
  <div className={`flex flex-col ${full ? "col-span-2" : ""}`}>
    <label className="mb-1 text-[10px] font-bold text-gray-500 uppercase">{label}</label>
    <input type="number" value={value} onChange={(e) => onChange(e.target.value)}
      className="w-full bg-gray-900 border border-gray-600 rounded-xl px-4 py-2.5 text-white focus:border-rose-500 outline-none font-mono text-sm"
      placeholder={placeholder || "0"} />
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
