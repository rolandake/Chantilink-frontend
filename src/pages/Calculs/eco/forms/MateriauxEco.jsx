import React, { useState, useEffect, useMemo } from "react";
import { Package, Save, Trash2, History, Info, Banknote, Leaf } from "lucide-react";

const STORAGE_KEY = "materiaux-eco-history";

const TYPES_MATERIAUX = {
  ciment:    { label: "Ciment (bas carbone)", icon: "🧱", unit: "t",  co2: 0.83  },
  sable:     { label: "Sable recyclé",         icon: "🟡", unit: "t",  co2: 0.005 },
  gravier:   { label: "Gravier recyclé",       icon: "⚫", unit: "t",  co2: 0.005 },
  fer:       { label: "Acier / Fer",            icon: "🔩", unit: "t",  co2: 1.46  },
  briques:   { label: "Briques / Blocs",        icon: "🟫", unit: "u",  co2: 0.25  },
  bois:      { label: "Bois (certifié FSC)",    icon: "🌲", unit: "m³", co2: -0.9  },
  autre:     { label: "Autre matériau",         icon: "📦", unit: "t",  co2: 0     },
};

export default function MateriauxEco({
  currency = "XOF",
  onTotalChange = () => {},
  onCostChange  = () => {},
  onMateriauxChange = () => {},
  onMaterialsChange = () => {},
}) {
  const [inputs, setInputs] = useState({
    type:           "ciment",
    autreNom:       "",
    quantite:       "",
    prixUnitaire:   "",
    coutMainOeuvre: "",
  });
  const [historique, setHistorique] = useState([]);
  const [message,    setMessage]    = useState(null);

  const cfg = TYPES_MATERIAUX[inputs.type] || TYPES_MATERIAUX.autre;

  const results = useMemo(() => {
    const qte   = parseFloat(inputs.quantite)      || 0;
    const pu    = parseFloat(inputs.prixUnitaire)   || 0;
    const mo    = parseFloat(inputs.coutMainOeuvre) || 0;
    const co2   = qte * cfg.co2;
    const total = qte * pu + mo;
    return { qte, co2, total };
  }, [inputs, cfg]);

  useEffect(() => {
    onTotalChange(results.total);
    onCostChange(results.total);
  }, [results.total]);

  useEffect(() => {
    try { const s = localStorage.getItem(STORAGE_KEY); if (s) setHistorique(JSON.parse(s)); } catch {}
  }, []);

  const showToast = (msg, type = "success") => {
    setMessage({ text: msg, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleSave = () => {
    if (results.qte <= 0) return showToast("⚠️ Quantité invalide", "error");
    const nom = inputs.type === "autre" && inputs.autreNom.trim() ? inputs.autreNom : cfg.label;
    const entry = {
      id:    Date.now(),
      date:  new Date().toLocaleString("fr-FR"),
      nom,
      qte:   results.qte,
      unit:  cfg.unit,
      co2:   results.co2,
      total: results.total,
    };
    const next = [entry, ...historique];
    setHistorique(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
    showToast("✅ Matériau enregistré !");
  };

  return (
    <div className="w-full h-full flex flex-col bg-gray-900 text-gray-100 overflow-hidden relative">
      {message && (
        <div className={`fixed top-4 right-4 px-6 py-3 rounded-xl shadow-2xl z-50 font-bold animate-bounce ${message.type === "error" ? "bg-red-600" : "bg-emerald-600"}`}>
          {message.text}
        </div>
      )}

      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-400"><Package className="w-6 h-6"/></div>
          <div>
            <h2 className="text-xl font-bold text-white">Matériaux Éco</h2>
            <p className="text-xs text-gray-400">Empreinte carbone & Coût</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-gray-500 uppercase font-bold block">Total</span>
          <span className="text-2xl font-black text-emerald-400">
            {results.total.toLocaleString()} <span className="text-sm text-gray-500">{currency}</span>
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* GAUCHE */}
          <div className="lg:col-span-5 flex flex-col gap-5">

            {/* Sélecteur type */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-4">
              <h3 className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-3">Type de matériau</h3>
              <div className="grid grid-cols-4 gap-1.5">
                {Object.entries(TYPES_MATERIAUX).map(([key, mat]) => (
                  <button key={key}
                    onClick={() => setInputs(p => ({...p, type: key}))}
                    title={mat.label}
                    className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all ${
                      inputs.type === key
                        ? "border-emerald-500 bg-emerald-500/10"
                        : "border-gray-700 bg-gray-800 hover:border-gray-500"
                    }`}>
                    <span className="text-lg">{mat.icon}</span>
                    <span className={`text-[9px] font-bold truncate w-full text-center ${inputs.type === key ? "text-emerald-400" : "text-gray-500"}`}>
                      {mat.label.split(" ")[0]}
                    </span>
                  </button>
                ))}
              </div>
              {inputs.type === "autre" && (
                <input type="text" value={inputs.autreNom}
                  onChange={e => setInputs(p => ({...p, autreNom: e.target.value}))}
                  className="mt-3 w-full bg-gray-900 border border-gray-600 rounded-xl px-4 py-2.5 text-white focus:border-emerald-500 outline-none font-mono text-sm"
                  placeholder="Nom du matériau..."/>
              )}
            </div>

            {/* Paramètres */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5 flex flex-col gap-4">
              <h3 className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase">
                <Banknote className="w-4 h-4 text-green-400"/> Paramètres Financiers
              </h3>
              <InputGroup label={`Quantité (${cfg.unit})`}               value={inputs.quantite}      onChange={v => setInputs(p => ({...p, quantite: v}))}      />
              <InputGroup label={`Prix / ${cfg.unit} (${currency})`}     value={inputs.prixUnitaire}   onChange={v => setInputs(p => ({...p, prixUnitaire: v}))}   />
              <InputGroup label={`Main d'œuvre (${currency})`}            value={inputs.coutMainOeuvre} onChange={v => setInputs(p => ({...p, coutMainOeuvre: v}))} />
              <button onClick={handleSave}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3.5 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all">
                <Save className="w-5 h-5"/> Enregistrer
              </button>
            </div>
          </div>

          {/* DROITE */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            <div className="grid grid-cols-2 gap-4">
              <ResultCard label="Quantité"    value={results.qte.toFixed(2)}       unit={cfg.unit} icon={cfg.icon} color="text-emerald-400" bg="bg-emerald-500/10" />
              <ResultCard label="Empreinte CO₂" value={Math.abs(results.co2).toFixed(2)} unit="kg CO₂"
                icon={results.co2 <= 0 ? "🌲" : "☁️"}
                color={results.co2 <= 0 ? "text-green-400" : "text-orange-400"}
                bg={results.co2 <= 0 ? "bg-green-500/10" : "bg-orange-500/10"} />
            </div>

            <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 shadow-xl">
              <h4 className="text-gray-400 text-xs font-bold uppercase tracking-widest border-b border-gray-700 pb-2 mb-4">Ventilation</h4>
              <MaterialRow label="Coût matériaux" val={`${(results.qte * (parseFloat(inputs.prixUnitaire)||0)).toLocaleString()} ${currency}`} color="bg-emerald-500" />
              <MaterialRow label="Main d'œuvre"   val={`${(parseFloat(inputs.coutMainOeuvre)||0).toLocaleString()} ${currency}`}              color="bg-gray-500" />
              <MaterialRow label="Facteur CO₂"    val={`${cfg.co2} kg CO₂/${cfg.unit}`}                                                       color={cfg.co2 <= 0 ? "bg-green-500" : "bg-orange-500"} />

              <div className="flex items-start gap-2 p-3 bg-emerald-500/5 rounded-lg border border-emerald-500/20 mt-4">
                <Leaf className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0"/>
                <p className="text-[10px] text-emerald-200/60 leading-relaxed italic">
                  {results.co2 < 0
                    ? `Le bois certifié FSC séquestre du CO₂ (${Math.abs(results.co2).toFixed(2)} kg capturés).`
                    : `Ce matériau émet ${results.co2.toFixed(2)} kg de CO₂. Préférez des variantes recyclées pour réduire l'empreinte.`}
                </p>
              </div>
            </div>

            {historique.length > 0 && (
              <div className="bg-gray-800/30 rounded-2xl border border-gray-700/50 overflow-hidden">
                <div className="px-4 py-2 bg-gray-800/50 border-b border-gray-700/50 flex justify-between items-center">
                  <h4 className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2"><History className="w-3 h-3"/> Historique</h4>
                  <button onClick={() => { setHistorique([]); localStorage.removeItem(STORAGE_KEY); }} className="text-[10px] text-red-400 hover:underline flex items-center gap-1"><Trash2 className="w-3 h-3"/> Vider</button>
                </div>
                <div className="max-h-[140px] overflow-y-auto">
                  {historique.slice(0, 5).map(item => (
                    <div key={item.id} className="flex justify-between items-center p-3 border-b border-gray-700/30 hover:bg-gray-700/40 transition-colors">
                      <div className="text-xs">
                        <span className="text-gray-500 text-[9px] block">{item.date}</span>
                        <span className="font-medium">{item.nom} — {item.qte.toFixed(2)} {item.unit}</span>
                      </div>
                      <span className="text-sm font-bold text-emerald-400 font-mono">{item.total.toLocaleString()} {currency}</span>
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
      className="w-full bg-gray-900 border border-gray-600 rounded-xl px-4 py-2.5 text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-mono text-sm outline-none"
      placeholder={placeholder || "0"}/>
  </div>
);
const ResultCard = ({ label, value, unit, icon, color, bg, border }) => (
  <div className={`rounded-2xl p-4 flex flex-col justify-center items-center text-center ${bg} ${border ? "border border-gray-700" : ""}`}>
    <span className="text-[10px] text-gray-500 uppercase font-bold mb-1">{icon} {label}</span>
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