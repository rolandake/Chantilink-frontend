import React, { useState, useEffect, useMemo } from "react";
import { Zap, Save, Trash2, History, Info, Banknote, Calculator } from "lucide-react";

const STORAGE_KEY = "energie-eco-history";

export default function EnergieEco({
  currency = "XOF",
  onTotalChange = () => {},
  onCostChange  = () => {},
  onMateriauxChange = () => {},
  onMaterialsChange = () => {},
}) {
  const [inputs, setInputs] = useState({
    consommation:   "",
    puissance:      "",
    duree:          "",
    prixUnitaire:   "",
    coutMainOeuvre: "",
  });
  const [historique, setHistorique] = useState([]);
  const [message,    setMessage]    = useState(null);

  const results = useMemo(() => {
    const kwh   = parseFloat(inputs.consommation)  || 0;
    const pu    = parseFloat(inputs.prixUnitaire)   || 0;
    const mo    = parseFloat(inputs.coutMainOeuvre) || 0;
    const co2   = kwh * 0.233; // kg CO₂/kWh estimé réseau AOF
    const total = kwh * pu + mo;
    return { kwh, co2, total };
  }, [inputs]);

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

  const handleCalc = () => {
    const kwh = (parseFloat(inputs.puissance) || 0) * (parseFloat(inputs.duree) || 0);
    setInputs(p => ({ ...p, consommation: kwh.toFixed(2) }));
  };

  const handleSave = () => {
    if (results.kwh <= 0) return showToast("⚠️ Consommation invalide", "error");
    const entry = {
      id:    Date.now(),
      date:  new Date().toLocaleString("fr-FR"),
      kwh:   results.kwh,
      co2:   results.co2,
      total: results.total,
    };
    const next = [entry, ...historique];
    setHistorique(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
    showToast("✅ Énergie enregistrée !");
  };

  return (
    <div className="w-full h-full flex flex-col bg-gray-900 text-gray-100 overflow-hidden relative">
      {message && (
        <div className={`fixed top-4 right-4 px-6 py-3 rounded-xl shadow-2xl z-50 font-bold animate-bounce ${message.type === "error" ? "bg-red-600" : "bg-yellow-600"}`}>
          {message.text}
        </div>
      )}

      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-yellow-500/20 rounded-lg text-yellow-400"><Zap className="w-6 h-6"/></div>
          <div>
            <h2 className="text-xl font-bold text-white">Énergie</h2>
            <p className="text-xs text-gray-400">Consommation & Empreinte carbone</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-gray-500 uppercase font-bold block">Total</span>
          <span className="text-2xl font-black text-yellow-400">
            {results.total.toLocaleString()} <span className="text-sm text-gray-500">{currency}</span>
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* GAUCHE */}
          <div className="lg:col-span-5 flex flex-col gap-5">

            {/* Aide calcul */}
            <div className="bg-gray-800/50 border border-yellow-500/30 rounded-2xl p-5">
              <h3 className="flex items-center gap-2 text-xs font-bold text-yellow-400 uppercase mb-4">
                <Calculator className="w-4 h-4"/> Aide au calcul (optionnel)
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label="Puissance (kW)" value={inputs.puissance} onChange={v => setInputs(p => ({...p, puissance: v}))} accent="yellow" />
                <InputGroup label="Durée (h)"      value={inputs.duree}     onChange={v => setInputs(p => ({...p, duree: v}))}     accent="yellow" />
              </div>
              <button onClick={handleCalc}
                className="w-full mt-3 bg-yellow-600/80 hover:bg-yellow-500 text-white py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all">
                <Calculator className="w-4 h-4"/> Calculer la consommation
              </button>
            </div>

            {/* Paramètres */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5 flex flex-col gap-4">
              <h3 className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase">
                <Banknote className="w-4 h-4 text-green-400"/> Paramètres Financiers
              </h3>
              <InputGroup label="Consommation (kWh)"          value={inputs.consommation}  onChange={v => setInputs(p => ({...p, consommation: v}))}  accent="yellow" />
              <InputGroup label={`Prix unitaire (${currency}/kWh)`} value={inputs.prixUnitaire} onChange={v => setInputs(p => ({...p, prixUnitaire: v}))} accent="yellow" />
              <InputGroup label={`Main d'œuvre (${currency})`}      value={inputs.coutMainOeuvre} onChange={v => setInputs(p => ({...p, coutMainOeuvre: v}))} accent="yellow" />
              <button onClick={handleSave}
                className="w-full bg-yellow-600 hover:bg-yellow-500 text-white py-3.5 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all">
                <Save className="w-5 h-5"/> Enregistrer
              </button>
            </div>
          </div>

          {/* DROITE */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            <div className="grid grid-cols-2 gap-4">
              <ResultCard label="Consommation" value={results.kwh.toFixed(1)} unit="kWh"    icon="⚡" color="text-yellow-400" bg="bg-yellow-500/10" />
              <ResultCard label="Émissions CO₂" value={results.co2.toFixed(1)} unit="kg CO₂" icon="🌿" color="text-green-400"  bg="bg-green-500/10"  />
            </div>

            <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 shadow-xl">
              <h4 className="text-gray-400 text-xs font-bold uppercase tracking-widest border-b border-gray-700 pb-2 mb-4">Ventilation</h4>
              <MaterialRow label="Coût énergie"   val={`${(results.kwh * (parseFloat(inputs.prixUnitaire)||0)).toLocaleString()} ${currency}`} color="bg-yellow-500" />
              <MaterialRow label="Main d'œuvre"   val={`${(parseFloat(inputs.coutMainOeuvre)||0).toLocaleString()} ${currency}`}               color="bg-gray-500" />
              <div className="flex items-start gap-2 p-3 bg-yellow-500/5 rounded-lg border border-yellow-500/20 mt-4">
                <Info className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0"/>
                <p className="text-[10px] text-yellow-200/60 leading-relaxed italic">
                  Facteur 0.233 kg CO₂/kWh (réseau Afrique de l'Ouest estimé). L'énergie solaire réduit ce facteur à ~0.05 kg CO₂/kWh.
                </p>
              </div>
            </div>

            {historique.length > 0 && (
              <HistoriqueBlock historique={historique} currency={currency} accentColor="text-yellow-400"
                onClear={() => { setHistorique([]); localStorage.removeItem(STORAGE_KEY); }}
                renderItem={item => `${item.kwh.toFixed(1)} kWh — CO₂ : ${item.co2.toFixed(1)} kg`} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sous-composants locaux ────────────────────────────────────
const InputGroup = ({ label, value, onChange, accent = "green", placeholder, full = false }) => {
  const ring = accent === "yellow" ? "focus:border-yellow-500 focus:ring-yellow-500"
             : accent === "cyan"   ? "focus:border-cyan-500 focus:ring-cyan-500"
             : "focus:border-green-500 focus:ring-green-500";
  return (
    <div className={`flex flex-col ${full ? "col-span-2" : ""}`}>
      <label className="mb-1 text-[10px] font-bold text-gray-500 uppercase">{label}</label>
      <input type="number" value={value} onChange={e => onChange(e.target.value)}
        className={`w-full bg-gray-900 border border-gray-600 rounded-xl px-4 py-2.5 text-white ${ring} focus:ring-1 transition-all font-mono text-sm outline-none`}
        placeholder={placeholder || "0"}/>
    </div>
  );
};

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

const HistoriqueBlock = ({ historique, currency, onClear, renderItem, accentColor }) => (
  <div className="bg-gray-800/30 rounded-2xl border border-gray-700/50 overflow-hidden">
    <div className="px-4 py-2 bg-gray-800/50 border-b border-gray-700/50 flex justify-between items-center">
      <h4 className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2"><History className="w-3 h-3"/> Historique</h4>
      <button onClick={onClear} className="text-[10px] text-red-400 hover:underline flex items-center gap-1"><Trash2 className="w-3 h-3"/> Vider</button>
    </div>
    <div className="max-h-[140px] overflow-y-auto">
      {historique.slice(0, 5).map(item => (
        <div key={item.id} className="flex justify-between items-center p-3 border-b border-gray-700/30 hover:bg-gray-700/40 transition-colors">
          <div className="text-xs">
            <span className="text-gray-500 text-[9px] block">{item.date}</span>
            <span className="font-medium">{renderItem(item)}</span>
          </div>
          <span className={`text-sm font-bold ${accentColor} font-mono`}>{(item.total||0).toLocaleString()} {currency}</span>
        </div>
      ))}
    </div>
  </div>
);