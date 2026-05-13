import React, { useState, useEffect, useMemo } from "react";
import { Truck, Save, Trash2, History, Info, Banknote, Wind, Zap } from "lucide-react";

const STORAGE_KEY = "transport-eco-history";

const MODES_TRANSPORT = {
  simple:  { label: "Simple",    icon: "🚛", sublabel: "Distance × Quantité × Prix",   color: "text-blue-400"  },
  carbone: { label: "Carbone",   icon: "🌿", sublabel: "Émissions CO₂ estimées",        color: "text-green-400" },
  forfait: { label: "Forfaitaire", icon: "💲", sublabel: "Barème par tranches kilométriques", color: "text-purple-400" },
};

const FACTEUR_EMISSION = {
  camion: { label: "Camion",  icon: "🚚", co2: 0.30 },
  train:  { label: "Train",   icon: "🚂", co2: 0.05 },
  bateau: { label: "Bateau",  icon: "🚢", co2: 0.02 },
  avion:  { label: "Avion",   icon: "✈️", co2: 0.50 },
};

const FORFAITS = [
  { maxKm: 50,       label: "≤ 50 km",     pu: 1000 },
  { maxKm: 200,      label: "51–200 km",   pu: 800  },
  { maxKm: Infinity, label: "> 200 km",    pu: 500  },
];

export default function TransportEco({
  currency = "XOF",
  onTotalChange = () => {},
  onCostChange  = () => {},
  onMateriauxChange = () => {},
  onMaterialsChange = () => {},
}) {
  const [mode, setMode] = useState("simple");
  const [inputs, setInputs] = useState({
    distance:       "",
    quantite:       "",
    prixUnitaire:   "",
    typeVehicule:   "camion",
    prixParKmManuel:"",
    coutMainOeuvre: "",
  });
  const [historique, setHistorique] = useState([]);
  const [message,    setMessage]    = useState(null);

  // ── CALCUL ──────────────────────────────────────────────────
  const results = useMemo(() => {
    const dist  = parseFloat(inputs.distance)       || 0;
    const qte   = parseFloat(inputs.quantite)       || 0;
    const pu    = parseFloat(inputs.prixUnitaire)   || 0;
    const mo    = parseFloat(inputs.coutMainOeuvre) || 0;
    const tkm   = dist * qte;

    let total = 0;
    let co2   = 0;

    if (mode === "simple") {
      total = tkm * pu + mo;
    } else if (mode === "carbone") {
      const facteur = FACTEUR_EMISSION[inputs.typeVehicule]?.co2 || 0.3;
      co2   = tkm * facteur;
      total = mo; // pas de coût monétaire direct dans ce mode
    } else if (mode === "forfait") {
      const puManuel = parseFloat(inputs.prixParKmManuel);
      const tranche  = FORFAITS.find(f => dist <= f.maxKm);
      const prixKm   = (!isNaN(puManuel) && puManuel > 0) ? puManuel : (tranche?.pu || 0);
      total = prixKm * dist + mo;
    }

    return { dist, qte, tkm, co2, total };
  }, [inputs, mode]);

  useEffect(() => {
    onTotalChange(results.total);
    onCostChange(results.total);
    const mats = { distance: results.dist, co2: results.co2 };
    onMateriauxChange(mats);
    onMaterialsChange(mats);
  }, [results.total]);

  useEffect(() => {
    try { const s = localStorage.getItem(STORAGE_KEY); if (s) setHistorique(JSON.parse(s)); } catch {}
  }, []);

  const showToast = (msg, type = "success") => {
    setMessage({ text: msg, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleSave = () => {
    if (results.dist <= 0) return showToast("⚠️ Distance invalide", "error");
    const entry = {
      id:    Date.now(),
      date:  new Date().toLocaleString("fr-FR"),
      mode:  MODES_TRANSPORT[mode].label,
      dist:  results.dist,
      co2:   results.co2,
      total: results.total,
    };
    const next = [entry, ...historique];
    setHistorique(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
    showToast("✅ Transport enregistré !");
  };

  const inp = (field, v) => setInputs(p => ({ ...p, [field]: v }));

  return (
    <div className="w-full h-full flex flex-col bg-gray-900 text-gray-100 overflow-hidden relative">
      {message && (
        <div className={`fixed top-4 right-4 px-6 py-3 rounded-xl shadow-2xl z-50 font-bold animate-bounce ${message.type === "error" ? "bg-red-600" : "bg-blue-600"}`}>
          {message.text}
        </div>
      )}

      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400"><Truck className="w-6 h-6"/></div>
          <div>
            <h2 className="text-xl font-bold text-white">Transport Éco</h2>
            <p className="text-xs text-gray-400">Logistique & Émissions CO₂</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-gray-500 uppercase font-bold block">Total</span>
          <span className="text-2xl font-black text-blue-400">
            {results.total.toLocaleString()} <span className="text-sm text-gray-500">{currency}</span>
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* GAUCHE */}
          <div className="lg:col-span-5 flex flex-col gap-5">

            {/* Sélecteur mode */}
            <div className="bg-gray-800 p-1.5 rounded-2xl border border-gray-700">
              <div className="grid grid-cols-3 gap-1.5">
                {Object.entries(MODES_TRANSPORT).map(([key, m]) => (
                  <button key={key} onClick={() => setMode(key)}
                    className={`flex flex-col items-center justify-center py-3 rounded-xl transition-all ${
                      mode === key ? "bg-blue-600 text-white shadow-lg" : "text-gray-400 hover:text-white hover:bg-gray-700"
                    }`}>
                    <span className="text-xl mb-1">{m.icon}</span>
                    <span className="text-[10px] font-bold uppercase">{m.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Champs communs */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5 flex flex-col gap-4">
              <h3 className="flex items-center gap-2 text-xs font-bold text-blue-400 uppercase tracking-widest">
                <Truck className="w-4 h-4"/> {MODES_TRANSPORT[mode].sublabel}
              </h3>

              <InputGroup label="Distance (km)" value={inputs.distance} onChange={v => inp("distance", v)} />

              {mode === "simple" && (
                <>
                  <InputGroup label="Quantité transportée (t)" value={inputs.quantite}     onChange={v => inp("quantite", v)}     />
                  <InputGroup label={`Prix unitaire (${currency}/t·km)`} value={inputs.prixUnitaire} onChange={v => inp("prixUnitaire", v)} />
                </>
              )}

              {mode === "carbone" && (
                <>
                  <InputGroup label="Quantité (t)" value={inputs.quantite} onChange={v => inp("quantite", v)} />
                  <div className="flex flex-col">
                    <label className="mb-1 text-[10px] font-bold text-gray-500 uppercase">Type de véhicule</label>
                    <div className="grid grid-cols-4 gap-2">
                      {Object.entries(FACTEUR_EMISSION).map(([key, v]) => (
                        <button key={key} onClick={() => inp("typeVehicule", key)}
                          className={`flex flex-col items-center p-2 rounded-xl border transition-all ${
                            inputs.typeVehicule === key
                              ? "border-green-500 bg-green-500/10"
                              : "border-gray-700 bg-gray-800 hover:border-gray-500"
                          }`}>
                          <span className="text-lg">{v.icon}</span>
                          <span className={`text-[9px] font-bold ${inputs.typeVehicule === key ? "text-green-400" : "text-gray-500"}`}>
                            {v.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {mode === "forfait" && (
                <>
                  <div className="bg-gray-900/50 rounded-xl p-3 border border-gray-700">
                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Barème applicable</p>
                    {FORFAITS.map((f, i) => (
                      <div key={i} className={`flex justify-between text-xs py-1 ${i < FORFAITS.length - 1 ? "border-b border-gray-700" : ""} ${
                        (parseFloat(inputs.distance)||0) <= f.maxKm && (i === 0 || (parseFloat(inputs.distance)||0) > FORFAITS[i-1].maxKm)
                          ? "text-blue-400 font-bold" : "text-gray-400"
                      }`}>
                        <span>{f.label}</span>
                        <span>{f.pu.toLocaleString()} {currency}/km</span>
                      </div>
                    ))}
                  </div>
                  <InputGroup label={`Prix /km personnalisé (${currency})`} value={inputs.prixParKmManuel} onChange={v => inp("prixParKmManuel", v)} placeholder="Laisser vide pour barème" />
                </>
              )}

              <InputGroup label={`Main d'œuvre (${currency})`} value={inputs.coutMainOeuvre} onChange={v => inp("coutMainOeuvre", v)} />

              <button onClick={handleSave}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3.5 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all">
                <Save className="w-5 h-5"/> Enregistrer
              </button>
            </div>
          </div>

          {/* DROITE */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            <div className="grid grid-cols-3 gap-4">
              <ResultCard label="Distance"  value={results.dist.toFixed(0)}  unit="km"     icon="📍"                          color="text-blue-400"  bg="bg-blue-500/10"  />
              <ResultCard label="t·km"      value={results.tkm.toFixed(1)}   unit="t·km"   icon={<Truck className="w-4 h-4"/>} color="text-indigo-400" bg="bg-indigo-500/10" border />
              <ResultCard label="CO₂ est."  value={results.co2.toFixed(2)}   unit="kg"     icon="🌿"                          color="text-green-400" bg="bg-green-500/10" />
            </div>

            <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 shadow-xl">
              <h4 className="text-gray-400 text-xs font-bold uppercase tracking-widest border-b border-gray-700 pb-2 mb-4">Analyse Transport</h4>
              <MaterialRow label="Distance"       val={`${results.dist.toFixed(0)} km`}  color="bg-blue-500"  />
              <MaterialRow label="Charge totale"  val={`${results.qte.toFixed(1)} t`}    color="bg-indigo-500" />
              {mode === "carbone" && (
                <MaterialRow label={`Facteur (${FACTEUR_EMISSION[inputs.typeVehicule]?.label})`}
                  val={`${FACTEUR_EMISSION[inputs.typeVehicule]?.co2} kg CO₂/t·km`} color="bg-green-500" />
              )}
              <MaterialRow label="Émissions CO₂"  val={`${results.co2.toFixed(2)} kg`}  color="bg-emerald-500" />

              <div className="flex items-start gap-2 p-3 bg-blue-500/5 rounded-lg border border-blue-500/20 mt-4">
                <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0"/>
                <p className="text-[10px] text-blue-200/60 leading-relaxed italic">
                  {mode === "carbone"
                    ? `Le ${FACTEUR_EMISSION[inputs.typeVehicule]?.label} émet ${FACTEUR_EMISSION[inputs.typeVehicule]?.co2} kg CO₂/t·km. Le train est 6× moins polluant que le camion.`
                    : mode === "forfait"
                    ? "Le barème décroît avec la distance. Saisissez un prix personnalisé pour ignorer le forfait automatique."
                    : "Le coût total = distance × quantité × prix unitaire + main d'œuvre."}
                </p>
              </div>
            </div>

            {historique.length > 0 && (
              <div className="bg-gray-800/30 rounded-2xl border border-gray-700/50 overflow-hidden">
                <div className="px-4 py-2 bg-gray-800/50 border-b border-gray-700/50 flex justify-between items-center">
                  <h4 className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2"><History className="w-3 h-3"/> Historique</h4>
                  <button onClick={() => { setHistorique([]); localStorage.removeItem(STORAGE_KEY); }}
                    className="text-[10px] text-red-400 hover:underline flex items-center gap-1"><Trash2 className="w-3 h-3"/> Vider</button>
                </div>
                <div className="max-h-[140px] overflow-y-auto">
                  {historique.slice(0, 5).map(item => (
                    <div key={item.id} className="flex justify-between items-center p-3 border-b border-gray-700/30 hover:bg-gray-700/40 transition-colors">
                      <div className="text-xs">
                        <span className="text-gray-500 text-[9px] block">{item.date}</span>
                        <span className="font-medium">{item.mode} — {item.dist.toFixed(0)} km</span>
                      </div>
                      <span className="text-sm font-bold text-blue-400 font-mono">{item.total.toLocaleString()} {currency}</span>
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
    <input type="number" value={value} onChange={e => onChange(e.target.value)}
      className="w-full bg-gray-900 border border-gray-600 rounded-xl px-4 py-2.5 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono text-sm outline-none"
      placeholder={placeholder || "0"}/>
  </div>
);
const ResultCard = ({ label, value, unit, icon, color, bg, border }) => (
  <div className={`rounded-2xl p-4 flex flex-col justify-center items-center text-center ${bg} ${border ? "border border-gray-700" : ""}`}>
    <span className="text-[10px] text-gray-500 uppercase font-bold mb-1 flex items-center gap-1">{icon} {label}</span>
    <span className={`text-xl font-black ${color}`}>{value} <span className="text-xs font-normal text-gray-500">{unit}</span></span>
  </div>
);
const MaterialRow = ({ label, val, color }) => (
  <div className="flex justify-between items-center border-b border-gray-700/30 pb-2 last:border-0">
    <div className="flex items-center gap-2">
      <div className={`w-1.5 h-1.5 rounded-full ${color}`}/>
      <span className="text-gray-300 text-xs font-medium">{label}</span>
    </div>
    <span className="text-xs font-bold text-white font-mono">{val}</span>
  </div>
);