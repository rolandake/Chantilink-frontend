import React, { useState, useEffect, useMemo } from "react";
import { Droplets, Save, Trash2, History, Info, Banknote } from "lucide-react";

const STORAGE_KEY = "eau-eco-history";

export default function EauEco({
  currency = "XOF",
  onTotalChange = () => {},
  onCostChange  = () => {},
  onMateriauxChange = () => {},
  onMaterialsChange = () => {},
}) {
  const [inputs, setInputs] = useState({
    consommation:   "",
    prixUnitaire:   "",
    coutMainOeuvre: "",
  });
  const [historique, setHistorique] = useState([]);
  const [message,    setMessage]    = useState(null);

  const results = useMemo(() => {
    const m3    = parseFloat(inputs.consommation)  || 0;
    const pu    = parseFloat(inputs.prixUnitaire)   || 0;
    const mo    = parseFloat(inputs.coutMainOeuvre) || 0;
    const total = m3 * pu + mo;
    return { m3, total };
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

  const handleSave = () => {
    if (results.m3 <= 0) return showToast("⚠️ Consommation invalide", "error");
    const entry = {
      id:    Date.now(),
      date:  new Date().toLocaleString("fr-FR"),
      m3:    results.m3,
      total: results.total,
    };
    const next = [entry, ...historique];
    setHistorique(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
    showToast("✅ Eau enregistrée !");
  };

  return (
    <div className="w-full h-full flex flex-col bg-gray-900 text-gray-100 overflow-hidden relative">
      {message && (
        <div className={`fixed top-4 right-4 px-6 py-3 rounded-xl shadow-2xl z-50 font-bold animate-bounce ${message.type === "error" ? "bg-red-600" : "bg-cyan-600"}`}>
          {message.text}
        </div>
      )}

      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cyan-500/20 rounded-lg text-cyan-400"><Droplets className="w-6 h-6"/></div>
          <div>
            <h2 className="text-xl font-bold text-white">Eau</h2>
            <p className="text-xs text-gray-400">Consommation & Gestion durable</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-gray-500 uppercase font-bold block">Total</span>
          <span className="text-2xl font-black text-cyan-400">
            {results.total.toLocaleString()} <span className="text-sm text-gray-500">{currency}</span>
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* GAUCHE */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5 flex flex-col gap-4">
              <h3 className="flex items-center gap-2 text-xs font-bold text-cyan-400 uppercase tracking-widest">
                <Banknote className="w-4 h-4 text-green-400"/> Paramètres
              </h3>
              <InputGroup label="Consommation (m³)"            value={inputs.consommation}  onChange={v => setInputs(p => ({...p, consommation: v}))}  />
              <InputGroup label={`Prix unitaire (${currency}/m³)`}  value={inputs.prixUnitaire} onChange={v => setInputs(p => ({...p, prixUnitaire: v}))} />
              <InputGroup label={`Main d'œuvre (${currency})`}       value={inputs.coutMainOeuvre} onChange={v => setInputs(p => ({...p, coutMainOeuvre: v}))} />
              <button onClick={handleSave}
                className="w-full bg-cyan-600 hover:bg-cyan-500 text-white py-3.5 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all">
                <Save className="w-5 h-5"/> Enregistrer
              </button>
            </div>
          </div>

          {/* DROITE */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            <div className="grid grid-cols-2 gap-4">
              <ResultCard label="Volume"  value={results.m3.toFixed(1)} unit="m³"    icon="💧" color="text-cyan-400"  bg="bg-cyan-500/10" />
              <ResultCard label="Total"   value={results.total.toLocaleString()} unit={currency} icon="💰" color="text-white" bg="bg-gray-700/40" border />
            </div>

            <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 shadow-xl">
              <h4 className="text-gray-400 text-xs font-bold uppercase tracking-widest border-b border-gray-700 pb-2 mb-4">Ventilation</h4>
              <MaterialRow label="Coût eau"      val={`${(results.m3 * (parseFloat(inputs.prixUnitaire)||0)).toLocaleString()} ${currency}`}  color="bg-cyan-500" />
              <MaterialRow label="Main d'œuvre"  val={`${(parseFloat(inputs.coutMainOeuvre)||0).toLocaleString()} ${currency}`}               color="bg-gray-500" />
              <div className="flex items-start gap-2 p-3 bg-cyan-500/5 rounded-lg border border-cyan-500/20 mt-4">
                <Info className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0"/>
                <p className="text-[10px] text-cyan-200/60 leading-relaxed italic">
                  Pensez à intégrer des systèmes de récupération des eaux pluviales pour réduire la consommation de chantier.
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
                        <span className="font-medium">{item.m3.toFixed(1)} m³</span>
                      </div>
                      <span className="text-sm font-bold text-cyan-400 font-mono">{item.total.toLocaleString()} {currency}</span>
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
      className="w-full bg-gray-900 border border-gray-600 rounded-xl px-4 py-2.5 text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all font-mono text-sm outline-none"
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