import React, { useState, useEffect, useMemo } from "react";
import { Trash2, Save, History, Info, Banknote, Recycle } from "lucide-react";

const STORAGE_KEY = "dechets-eco-history";

const TYPES_DECHETS = {
  inertes:     { label: "Déchets inertes",     icon: "🪨", color: "text-gray-400",   unit: "t", tauxRecyclage: 0.80 },
  recyclables: { label: "Déchets recyclables", icon: "♻️", color: "text-green-400",  unit: "t", tauxRecyclage: 0.95 },
  dangereux:   { label: "Déchets dangereux",   icon: "☢️", color: "text-red-400",    unit: "t", tauxRecyclage: 0.10 },
  bois:        { label: "Chutes de bois",       icon: "🌲", color: "text-amber-400",  unit: "t", tauxRecyclage: 0.70 },
  beton:       { label: "Béton / Gravats",      icon: "🧱", color: "text-stone-400",  unit: "t", tauxRecyclage: 0.85 },
  autres:      { label: "Autres déchets",       icon: "📦", color: "text-purple-400", unit: "t", tauxRecyclage: 0.40 },
};

export default function DechetsEco({
  currency = "XOF",
  onTotalChange = () => {},
  onCostChange  = () => {},
  onMateriauxChange = () => {},
  onMaterialsChange = () => {},
}) {
  const [inputs, setInputs] = useState({
    type:           "recyclables",
    quantite:       "",
    prixUnitaire:   "",
    coutMainOeuvre: "",
  });
  const [historique, setHistorique] = useState([]);
  const [message,    setMessage]    = useState(null);

  const cfg = TYPES_DECHETS[inputs.type] || TYPES_DECHETS.autres;

  const results = useMemo(() => {
    const qte           = parseFloat(inputs.quantite)      || 0;
    const pu            = parseFloat(inputs.prixUnitaire)   || 0;
    const mo            = parseFloat(inputs.coutMainOeuvre) || 0;
    const qteRecyclable = qte * cfg.tauxRecyclage;
    const qteMise       = qte - qteRecyclable;
    const total         = qte * pu + mo;
    return { qte, qteRecyclable, qteMise, total };
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
    const entry = {
      id:    Date.now(),
      date:  new Date().toLocaleString("fr-FR"),
      label: cfg.label,
      qte:   results.qte,
      total: results.total,
    };
    const next = [entry, ...historique];
    setHistorique(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
    showToast("✅ Déchets enregistrés !");
  };

  return (
    <div className="w-full h-full flex flex-col bg-gray-900 text-gray-100 overflow-hidden relative">
      {message && (
        <div className={`fixed top-4 right-4 px-6 py-3 rounded-xl shadow-2xl z-50 font-bold animate-bounce ${message.type === "error" ? "bg-red-600" : "bg-orange-600"}`}>
          {message.text}
        </div>
      )}

      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-500/20 rounded-lg text-orange-400"><Recycle className="w-6 h-6"/></div>
          <div>
            <h2 className="text-xl font-bold text-white">Déchets</h2>
            <p className="text-xs text-gray-400">Gestion & Valorisation</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-gray-500 uppercase font-bold block">Total</span>
          <span className="text-2xl font-black text-orange-400">
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
              <h3 className="text-[10px] font-bold text-orange-400 uppercase tracking-widest mb-3">Type de déchet</h3>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(TYPES_DECHETS).map(([key, d]) => (
                  <button key={key}
                    onClick={() => setInputs(p => ({...p, type: key}))}
                    className={`p-3 rounded-xl border transition-all flex flex-col items-center gap-1 ${
                      inputs.type === key
                        ? "border-orange-500 bg-orange-500/10"
                        : "border-gray-700 bg-gray-800 hover:border-gray-500"
                    }`}>
                    <span className="text-xl">{d.icon}</span>
                    <span className={`text-[9px] font-bold text-center leading-tight ${inputs.type === key ? "text-orange-400" : "text-gray-500"}`}>
                      {d.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Paramètres */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5 flex flex-col gap-4">
              <h3 className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase">
                <Banknote className="w-4 h-4 text-green-400"/> Paramètres
              </h3>
              <InputGroup label={`Quantité (${cfg.unit})`}               value={inputs.quantite}      onChange={v => setInputs(p => ({...p, quantite: v}))}      />
              <InputGroup label={`Prix évacuation (${currency}/${cfg.unit})`} value={inputs.prixUnitaire} onChange={v => setInputs(p => ({...p, prixUnitaire: v}))} />
              <InputGroup label={`Main d'œuvre (${currency})`}            value={inputs.coutMainOeuvre} onChange={v => setInputs(p => ({...p, coutMainOeuvre: v}))} />
              <button onClick={handleSave}
                className="w-full bg-orange-600 hover:bg-orange-500 text-white py-3.5 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all">
                <Save className="w-5 h-5"/> Enregistrer
              </button>
            </div>
          </div>

          {/* DROITE */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            <div className="grid grid-cols-3 gap-4">
              <ResultCard label="Quantité totale" value={results.qte.toFixed(2)} unit="t" icon={cfg.icon} color="text-orange-400" bg="bg-orange-500/10" />
              <ResultCard label="Recyclable"       value={results.qteRecyclable.toFixed(2)} unit="t" icon="♻️" color="text-green-400" bg="bg-green-500/10" border />
              <ResultCard label="Mise en décharge" value={results.qteMise.toFixed(2)} unit="t" icon="🗑️" color="text-red-400" bg="bg-red-500/10" />
            </div>

            <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 shadow-xl">
              <h4 className="text-gray-400 text-xs font-bold uppercase tracking-widest border-b border-gray-700 pb-2 mb-4">Analyse valorisation</h4>
              <MaterialRow label="Taux de recyclage" val={`${Math.round(cfg.tauxRecyclage * 100)} %`} color="bg-green-500" />
              <MaterialRow label="Coût évacuation"   val={`${(results.qte * (parseFloat(inputs.prixUnitaire)||0)).toLocaleString()} ${currency}`} color="bg-orange-500" />
              <MaterialRow label="Main d'œuvre"       val={`${(parseFloat(inputs.coutMainOeuvre)||0).toLocaleString()} ${currency}`} color="bg-gray-500" />

              {/* Barre recyclage */}
              <div className="mt-4">
                <div className="flex justify-between text-[10px] text-gray-500 mb-1.5">
                  <span>Valorisation</span>
                  <span>{Math.round(cfg.tauxRecyclage * 100)}%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-green-600 to-emerald-400 rounded-full transition-all duration-700"
                    style={{ width: `${cfg.tauxRecyclage * 100}%` }}/>
                </div>
              </div>

              <div className="flex items-start gap-2 p-3 bg-orange-500/5 rounded-lg border border-orange-500/20 mt-4">
                <Info className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0"/>
                <p className="text-[10px] text-orange-200/60 leading-relaxed italic">
                  Trier et valoriser les déchets réduit les coûts d'évacuation et l'impact environnemental. Taux estimé pour {cfg.label}.
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
                        <span className="font-medium">{item.label} — {item.qte.toFixed(2)} t</span>
                      </div>
                      <span className="text-sm font-bold text-orange-400 font-mono">{item.total.toLocaleString()} {currency}</span>
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
      className="w-full bg-gray-900 border border-gray-600 rounded-xl px-4 py-2.5 text-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all font-mono text-sm outline-none"
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