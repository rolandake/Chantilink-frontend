import React, { useState, useEffect, useMemo } from "react";
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import {
  ArrowUpRight, Ruler, Save, History, Anchor, Droplets, Info, Activity, Link,
} from "lucide-react";

ChartJS.register(ArcElement, Tooltip, Legend);

const STORAGE_KEY = "escaliers-history-pro";

const DOSAGE = {
  ciment:            0.350,
  sable:             0.6,
  gravier:           0.85,
  acier:             0.080,
  eau:               175,
  epaisseurPaillasse: 0.15,
};

const fmtD = (n, d = 2) => (n || 0).toFixed(d);
const fmt  = (n) => Math.round(n).toLocaleString("fr-FR");

export default function Escaliers({
  currency = "XOF",
  onTotalChange,
  onMateriauxChange,
  onResultsChange,  // ✅ nouveau
  projectResults,   // ✅ nouveau — contient dalles.hauteurNiveau
}) {

  const [inputs, setInputs] = useState({
    hauteurTotale:  "",
    largeur:        "",
    hauteurMarche:  "0.17",
    giron:          "0.28",
    prixUnitaire:   "",
    coutMainOeuvre: "",
  });
  const [historique, setHistorique] = useState([]);
  const [message,    setMessage]    = useState(null);

  // ✅ LIAISON AUTOMATIQUE : Dalles → Escaliers
  // Si l'utilisateur a saisi la hauteur de niveau dans Dalles, on la récupère
  const dallesData    = projectResults?.dalles;
  const hauteurAutoDisponible = dallesData?.hauteurNiveau > 0;

  useEffect(() => {
    if (hauteurAutoDisponible && !inputs.hauteurTotale) {
      setInputs((prev) => ({
        ...prev,
        hauteurTotale: dallesData.hauteurNiveau.toFixed(2),
      }));
    }
  }, [dallesData?.hauteurNiveau]);

  const applyHauteurAuto = () => {
    setInputs((prev) => ({
      ...prev,
      hauteurTotale: dallesData?.hauteurNiveau?.toFixed(2) || prev.hauteurTotale,
    }));
  };

  // ── Calcul ────────────────────────────────────────────────────────────────
  const results = useMemo(() => {
    const H  = parseFloat(inputs.hauteurTotale) || 0;
    const L  = parseFloat(inputs.largeur)       || 0;
    const h  = parseFloat(inputs.hauteurMarche) || 0.17;
    const g  = parseFloat(inputs.giron)         || 0.28;
    const pu = parseFloat(inputs.prixUnitaire)  || 0;
    const mo = parseFloat(inputs.coutMainOeuvre) || 0;

    const nbMarches = h > 0 ? Math.ceil(H / h) : 0;
    const blondel   = (2 * h) + g;
    const isConfortable = blondel >= 0.60 && blondel <= 0.64;

    const longueurPente = Math.sqrt(Math.pow(H, 2) + Math.pow(nbMarches * g, 2));
    const volPaillasse  = longueurPente * L * DOSAGE.epaisseurPaillasse;
    const volMarches    = (g * h / 2) * L * nbMarches;
    const volumeTotal   = volPaillasse + volMarches;

    const cimentT    = volumeTotal * DOSAGE.ciment;
    const cimentSacs = (cimentT * 1000) / 50;
    const sableT     = volumeTotal * DOSAGE.sable;
    const gravierT   = volumeTotal * DOSAGE.gravier;
    const acierKg    = volumeTotal * (DOSAGE.acier * 1000);
    const acierT     = acierKg / 1000;
    const eauL       = volumeTotal * DOSAGE.eau;

    const coutMateriaux = volumeTotal * pu;
    const total = coutMateriaux + mo;

    return {
      nbMarches, blondel, isConfortable, volumeTotal,
      cimentT, cimentSacs, sableT, gravierT, acierT, acierKg, eauL,
      coutMateriaux, mo, total,
    };
  }, [inputs]);

  // ── Sync parent + store ───────────────────────────────────────────────────
  useEffect(() => {
    onTotalChange?.(results.total);
    onMateriauxChange?.({
      volume: results.volumeTotal,
      ciment: results.cimentT,
      acier:  results.acierT,
    });
    onResultsChange?.({
      nbMarches:    results.nbMarches,
      hauteurTotale: parseFloat(inputs.hauteurTotale) || 0,
      largeur:       parseFloat(inputs.largeur)       || 0,
      volumeTotal:   results.volumeTotal,
      acierKg:       results.acierKg,
    });
  }, [results.total, results.volumeTotal, results.nbMarches]);

  // ── Historique ────────────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setHistorique(JSON.parse(saved));
    } catch {}
  }, []);

  const handleSave = () => {
    if (results.volumeTotal <= 0) return showToast("⚠️ Données incomplètes", "error");
    const newEntry = { id: Date.now(), date: new Date().toLocaleString(), ...inputs, ...results };
    const newHist = [newEntry, ...historique];
    setHistorique(newHist);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newHist));
    showToast("✅ Escalier enregistré !");
  };

  const showToast = (msg, type = "success") => {
    setMessage({ text: msg, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const chartData = {
    labels: ["Béton", "Main d'œuvre"],
    datasets: [{
      data: [results.coutMateriaux, results.mo],
      backgroundColor: ["#eab308", "#374151"],
      borderColor: "#111827",
      borderWidth: 2,
    }],
  };

  return (
    <div className="w-full h-full flex flex-col bg-gray-900 text-gray-100 overflow-hidden relative">

      {message && (
        <div className={`fixed top-4 right-4 px-6 py-3 rounded-xl shadow-2xl z-50 font-bold animate-in fade-in slide-in-from-top-2 ${
          message.type === "error" ? "bg-red-600" : "bg-yellow-600"
        }`}>
          {message.text}
        </div>
      )}

      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-yellow-600/20 rounded-lg text-yellow-500"><ArrowUpRight className="w-6 h-6" /></div>
          <div>
            <h2 className="text-xl font-bold text-white">Élévation : Escaliers</h2>
            <p className="text-xs text-gray-400 font-medium">Béton armé & Ergonomie</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-gray-500 uppercase font-bold block">Estimation Escalier</span>
          <span className="text-2xl font-black text-yellow-500 tracking-tighter">
            {fmt(results.total)} <span className="text-sm text-gray-500 font-normal">{currency}</span>
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-6 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* ── GAUCHE ── */}
          <div className="lg:col-span-5 flex flex-col gap-5">

            {/* ✅ LIAISON AUTOMATIQUE DALLE → ESCALIER */}
            {hauteurAutoDisponible && (
              <div className="flex items-start gap-3 p-3 bg-yellow-500/8 border border-yellow-500/30 rounded-2xl">
                <Link className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-yellow-300 font-bold uppercase tracking-wider mb-1">
                    Données importées — Dalles
                  </p>
                  <p className="text-xs text-yellow-200/70">
                    Hauteur de niveau : <span className="font-mono font-bold text-yellow-300">{dallesData.hauteurNiveau.toFixed(2)} m</span>
                  </p>
                  {!inputs.hauteurTotale && (
                    <button onClick={applyHauteurAuto}
                      className="mt-2 text-[10px] bg-yellow-500/20 border border-yellow-500/40 text-yellow-300 px-3 py-1 rounded-lg font-bold hover:bg-yellow-500/30 transition-all">
                      Appliquer la hauteur automatiquement ↗
                    </button>
                  )}
                  {inputs.hauteurTotale === dallesData.hauteurNiveau.toFixed(2) && (
                    <p className="mt-1 text-[10px] text-yellow-400/60 italic">✅ Hauteur appliquée depuis Dalles</p>
                  )}
                </div>
              </div>
            )}

            {/* Géométrie */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-3xl p-6 shadow-xl space-y-6">
              <h3 className="flex items-center gap-2 text-xs font-bold text-yellow-500 uppercase tracking-widest">
                <Ruler className="w-4 h-4" /> Géométrie de l'ouvrage
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label="Hauteur franchie (m)" value={inputs.hauteurTotale}
                  onChange={(v) => setInputs({ ...inputs, hauteurTotale: v })} placeholder="Ex: 2.80" full />
                <InputGroup label="Emmarchement (m)" value={inputs.largeur}
                  onChange={(v) => setInputs({ ...inputs, largeur: v })} placeholder="Ex: 1.20" full />
                <InputGroup label="Hauteur Marche (m)" value={inputs.hauteurMarche}
                  onChange={(v) => setInputs({ ...inputs, hauteurMarche: v })} />
                <InputGroup label="Giron / Prof. (m)" value={inputs.giron}
                  onChange={(v) => setInputs({ ...inputs, giron: v })} />
              </div>

              {/* Loi de Blondel */}
              <div className={`p-4 rounded-2xl border transition-all flex items-center gap-4 ${
                results.isConfortable
                  ? "bg-emerald-500/10 border-emerald-500/30"
                  : "bg-red-500/10 border-red-500/30"
              }`}>
                <div className={`p-2 rounded-full ${results.isConfortable ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-gray-500">Pas de foulée (Blondel)</p>
                  <span className={`text-lg font-black ${results.isConfortable ? "text-emerald-400" : "text-red-400"}`}>
                    {(results.blondel * 100).toFixed(0)} cm
                  </span>
                  <span className="text-[10px] ml-2 text-gray-400 italic">
                    {results.isConfortable ? "✅ Confortable" : "⚠️ Trop raide ou trop plat"}
                  </span>
                </div>
              </div>
            </div>

            {/* Prix + bouton */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-3xl p-6 shadow-xl space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label={`PU Béton (${currency}/m³)`} value={inputs.prixUnitaire}
                  onChange={(v) => setInputs({ ...inputs, prixUnitaire: v })} />
                <InputGroup label={`Forfait Pose (${currency})`} value={inputs.coutMainOeuvre}
                  onChange={(v) => setInputs({ ...inputs, coutMainOeuvre: v })} />
              </div>
              <button onClick={handleSave}
                className="w-full bg-yellow-600 hover:bg-yellow-500 text-white py-4 rounded-2xl font-bold shadow-lg transition-all flex justify-center items-center gap-2">
                <Save className="w-5 h-5" /> Enregistrer Escalier
              </button>
            </div>
          </div>

          {/* ── DROITE ── */}
          <div className="lg:col-span-7 flex flex-col gap-6">

            <div className="grid grid-cols-3 gap-4">
              <ResultCard label="Volume Total"       value={fmtD(results.volumeTotal)} unit="m³" icon="🧊"  color="text-yellow-500" bg="bg-yellow-500/10" />
              <ResultCard label="Nombre de Marches"  value={results.nbMarches}          unit="u"  icon="🪜"  color="text-white"      bg="bg-gray-800" border />
              <ResultCard label="Acier Estimé"       value={fmtD(results.acierKg, 0)}  unit="kg" icon={<Anchor className="w-4 h-4"/>} color="text-red-400" bg="bg-red-500/10" />
            </div>

            <div className="flex-1 bg-gray-800 rounded-3xl p-6 border border-gray-700 shadow-xl flex flex-col md:flex-row gap-8 items-center relative overflow-hidden">
              <div className="absolute -bottom-10 -right-10 w-44 h-44 bg-yellow-600/10 rounded-full blur-3xl pointer-events-none" />
              <div className="w-44 h-44 flex-shrink-0 relative">
                <Doughnut data={chartData} options={{ cutout: "75%", plugins: { legend: { display: false } } }} />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[10px] text-gray-500 uppercase font-bold">Ciment</span>
                  <span className="text-sm font-bold text-white">{fmtD(results.cimentSacs, 1)} sacs</span>
                </div>
              </div>

              <div className="flex-1 w-full space-y-4">
                <h4 className="text-gray-400 text-xs font-bold uppercase tracking-widest border-b border-gray-700 pb-2 mb-2">Besoins en fournitures</h4>
                <MaterialRow label="Ciment (350kg/m³)" val={`${fmtD(results.cimentT)} t`}     color="bg-yellow-500" />
                <MaterialRow label="Sable (Ratio 0.6)" val={`${fmtD(results.sableT)} t`}      color="bg-amber-500" />
                <MaterialRow label="Gravier (0.85)"    val={`${fmtD(results.gravierT)} t`}    color="bg-stone-500" />
                <MaterialRow label="Acier (HA8/HA10)"  val={`${fmtD(results.acierKg, 0)} kg`} color="bg-red-500" />
                <div className="pt-2 border-t border-gray-700 flex justify-between items-center">
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Droplets className="w-3 h-3 text-cyan-400" /> Eau nécessaire
                  </span>
                  <span className="text-sm font-bold text-white font-mono">{fmtD(results.eauL, 0)} L</span>
                </div>
                <div className="flex items-start gap-2 p-3 bg-blue-500/5 rounded-xl border border-blue-500/20">
                  <Info className="w-4 h-4 text-blue-400 mt-0.5" />
                  <p className="text-[10px] text-blue-200/70 leading-relaxed italic">
                    Calcul incluant une épaisseur de paillasse de 15cm et le volume propre des marches triangulaires.
                  </p>
                </div>
              </div>
            </div>

            {historique.length > 0 && (
              <div className="bg-gray-800/30 rounded-2xl border border-gray-700/50 overflow-hidden">
                <div className="px-4 py-2 bg-gray-800/50 flex justify-between items-center border-b border-gray-700/50">
                  <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                    <History className="w-3 h-3" /> Devis Récents
                  </h4>
                  <button onClick={() => { setHistorique([]); localStorage.removeItem(STORAGE_KEY); }}
                    className="text-[10px] text-red-400 hover:underline">Vider</button>
                </div>
                <div className="max-h-[100px] overflow-y-auto">
                  {historique.slice(0, 5).map((item) => (
                    <div key={item.id} className="flex justify-between items-center p-3 border-b border-gray-700/30 hover:bg-gray-700/40 transition-colors text-xs">
                      <div>
                        <span className="text-gray-500 text-[9px] block">{item.date}</span>
                        <span className="font-medium uppercase">Escalier {item.nbMarches} marches</span>
                      </div>
                      <span className="font-bold text-yellow-500">{fmt(item.total)} {currency}</span>
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
    <label className="mb-1 text-[10px] font-bold text-gray-500 uppercase tracking-wide">{label}</label>
    <input type="number" value={value} onChange={(e) => onChange(e.target.value)}
      className="w-full bg-gray-900 border border-gray-600 rounded-xl px-4 py-2.5 text-white focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-all font-mono text-sm"
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