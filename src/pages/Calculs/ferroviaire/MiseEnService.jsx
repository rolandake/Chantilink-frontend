import React, { useState, useEffect, useMemo } from "react";
import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS, ArcElement, Tooltip, Legend,
} from "chart.js";
import { 
  PlayCircle, Calendar, Users, Banknote, Save, Trash2, History, Info, Clock, CheckCircle, TrendingUp
} from "lucide-react";

ChartJS.register(ArcElement, Tooltip, Legend);

const STORAGE_KEY = "mise-en-service-history-pro";

export default function MiseEnService({ currency = "XOF", onCostChange = () => {} }) {
  
  // --- ÉTATS ---
  const [inputs, setInputs] = useState({
    nombreJour: "",
    coutParJour: "",
    coutMainOeuvre: "",
    autresCouts: ""
  });

  const [historique, setHistorique] = useState([]);
  const [message, setMessage] = useState(null);

  // --- MOTEUR DE CALCUL ---
  const results = useMemo(() => {
    const jours = parseFloat(inputs.nombreJour) || 0;
    const cpj = parseFloat(inputs.coutParJour) || 0;
    const mo = parseFloat(inputs.coutMainOeuvre) || 0;
    const autres = parseFloat(inputs.autresCouts) || 0;

    const totalOperationnel = jours * cpj;
    const totalGlobal = totalOperationnel + mo + autres;
    const ratioFixe = totalGlobal > 0 ? ((mo + autres) / totalGlobal) * 100 : 0;

    return {
      totalOperationnel,
      totalGlobal,
      ratioFixe,
      jours
    };
  }, [inputs]);

  // --- SYNC PARENT ---
  useEffect(() => {
    onCostChange(results.totalGlobal);
  }, [results.totalGlobal, onCostChange]);

  // --- HISTORIQUE ---
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) try { setHistorique(JSON.parse(saved)); } catch(e) {}
  }, []);

  const handleSave = () => {
    if (results.totalGlobal <= 0) return showToast("⚠️ Saisie incomplète", "error");
    const newEntry = {
      id: Date.now(),
      date: new Date().toLocaleString(),
      ...inputs, ...results
    };
    const newHist = [newEntry, ...historique];
    setHistorique(newHist);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newHist));
    showToast("✅ Mise en service enregistrée !");
  };

  const showToast = (msg, type = "success") => {
    setMessage({ text: msg, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const chartData = {
    labels: ["Opérationnel (Jours)", "Main d'œuvre", "Frais Annexes"],
    datasets: [{
      data: [results.totalOperationnel, parseFloat(inputs.coutMainOeuvre || 0), parseFloat(inputs.autresCouts || 0)],
      backgroundColor: ["#10b981", "#3b82f6", "#64748b"],
      borderColor: "#111827",
      borderWidth: 2,
    }]
  };

  return (
    <div className="w-full h-full flex flex-col bg-gray-900 text-gray-100 overflow-hidden relative font-sans">
      
      {/* Toast Notification */}
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
            <PlayCircle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white uppercase tracking-tight">Phase : Mise en Service</h2>
            <p className="text-xs text-gray-400 font-medium italic">Tests, Recette & Lancement</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-gray-500 uppercase font-bold block tracking-widest">Budget Lancement</span>
          <span className="text-2xl font-black text-emerald-400 tracking-tighter">
            {results.totalGlobal.toLocaleString()} <span className="text-sm text-gray-500 font-normal">{currency}</span>
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-6 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
          
          {/* GAUCHE : PARAMÈTRES (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            
            <div className="bg-gray-800/50 border border-gray-700 rounded-3xl p-6 shadow-xl space-y-6">
              <h3 className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-widest">
                <Clock className="w-4 h-4" /> Durée des opérations
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label="Nombre de jours" value={inputs.nombreJour} onChange={v => setInputs({...inputs, nombreJour: v})} placeholder="Ex: 30" />
                <InputGroup label={`Coût / Jour (${currency})`} value={inputs.coutParJour} onChange={v => setInputs({...inputs, coutParJour: v})} />
              </div>
            </div>

            <div className="bg-gray-800/50 border border-gray-700 rounded-3xl p-6 shadow-xl space-y-6 flex-1">
              <h3 className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
                <Users className="w-4 h-4" /> Coûts Fixes & Personnel
              </h3>
              <div className="space-y-4">
                <InputGroup label={`Main d'œuvre Forfaitaire (${currency})`} value={inputs.coutMainOeuvre} onChange={v => setInputs({...inputs, coutMainOeuvre: v})} full />
                <InputGroup label={`Frais Annexes (${currency})`} value={inputs.autresCouts} onChange={v => setInputs({...inputs, autresCouts: v})} full />
              </div>

              <button 
                onClick={handleSave}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-2xl font-bold shadow-lg transition-all flex justify-center items-center gap-2 active:scale-95 mt-4"
              >
                <Save className="w-5 h-5" /> Enregistrer le chiffrage
              </button>
            </div>
          </div>

          {/* DROITE : RÉSULTATS (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            
            <div className="grid grid-cols-3 gap-4">
              <ResultCard label="Période" value={results.jours} unit="jours" icon={<Calendar className="w-4 h-4"/>} color="text-emerald-400" bg="bg-emerald-500/10" />
              <ResultCard label="Moyenne / Jour" value={results.jours > 0 ? Math.round(results.totalGlobal / results.jours).toLocaleString() : 0} unit={currency} icon={<TrendingUp className="w-4 h-4"/>} color="text-white" bg="bg-gray-800" border />
              <ResultCard label="Taux Fixe" value={Math.round(results.ratioFixe)} unit="%" icon={<CheckCircle className="w-4 h-4"/>} color="text-blue-400" bg="bg-blue-500/10" />
            </div>

            <div className="flex-1 bg-gray-800 rounded-3xl p-8 border border-gray-700 shadow-xl flex flex-col md:flex-row gap-10 items-center relative overflow-hidden">
               <div className="absolute -bottom-10 -right-10 w-44 h-44 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

               <div className="w-48 h-48 flex-shrink-0 relative">
                  <Doughnut data={chartData} options={{ cutout: "75%", plugins: { legend: { display: false } } }} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                     <span className="text-[10px] text-gray-500 uppercase font-bold text-center leading-tight">Total<br/>Général</span>
                     <span className="text-sm font-bold text-white">{results.totalGlobal.toLocaleString()}</span>
                  </div>
               </div>

               <div className="flex-1 w-full space-y-4">
                  <h4 className="text-gray-400 text-xs font-bold uppercase tracking-widest border-b border-gray-700 pb-2 mb-2">Détail des dépenses</h4>
                  
                  <MaterialRow label="Logistique journalière" val={`${results.totalOperationnel.toLocaleString()} ${currency}`} color="bg-emerald-500" />
                  <MaterialRow label="Expertise & Pose" val={`${parseFloat(inputs.coutMainOeuvre || 0).toLocaleString()} ${currency}`} color="bg-blue-500" />
                  <MaterialRow label="Frais exceptionnels" val={`${parseFloat(inputs.autresCouts || 0).toLocaleString()} ${currency}`} color="bg-gray-500" />
                  
                  <div className="flex items-start gap-2 p-3 bg-blue-500/5 rounded-xl border border-blue-500/20 mt-4">
                    <Info className="w-4 h-4 text-emerald-400 mt-0.5" />
                    <p className="text-[10px] text-emerald-200/70 leading-relaxed italic">
                      La mise en service inclut les essais à vide, la formation du personnel et la certification de sécurité finale.
                    </p>
                  </div>
               </div>
            </div>

            {/* Historique Mini */}
            {historique.length > 0 && (
              <div className="bg-gray-800/30 rounded-2xl border border-gray-700/50 overflow-hidden">
                <div className="px-4 py-2 bg-gray-800/50 border-b border-gray-700/50 flex justify-between items-center text-xs">
                  <h4 className="font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2"><History className="w-3 h-3" /> Chiffrages Précédents</h4>
                  <button onClick={() => {setHistorique([]); localStorage.removeItem(STORAGE_KEY)}} className="text-red-400 hover:underline uppercase text-[10px]">Vider</button>
                </div>
                <div className="max-h-[120px] overflow-y-auto">
                  {historique.slice(0, 5).map((item) => (
                    <div key={item.id} className="flex justify-between items-center p-3 border-b border-gray-700/30 hover:bg-gray-700/40 transition-colors">
                      <div className="text-xs">
                        <span className="text-gray-500 block text-[9px]">{item.date}</span>
                        <span className="font-medium uppercase tracking-tighter">Tests sur {item.nombreJour} jours</span>
                      </div>
                      <span className="text-sm font-bold text-emerald-400">{parseFloat(item.totalGlobal).toLocaleString()} {currency}</span>
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

// --- SOUS-COMPOSANTS ---

const InputGroup = ({ label, value, onChange, placeholder, full = false }) => (
  <div className={`flex flex-col ${full ? "col-span-2" : ""}`}>
    <label className="mb-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-wide">{label}</label>
    <input
      type="number" value={value || ""} onChange={e => onChange(e.target.value)}
      className="w-full bg-gray-900 border border-gray-600 rounded-xl px-4 py-3 text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-mono text-sm"
      placeholder={placeholder || "0"}
    />
  </div>
);

const ResultCard = ({ label, value, unit, color, bg, border, icon }) => (
  <div className={`rounded-2xl p-4 flex flex-col justify-center items-center text-center ${bg} ${border ? 'border border-gray-700' : ''}`}>
    <span className="text-[10px] text-gray-500 uppercase font-bold mb-1 flex items-center gap-1">
      {icon} {label}
    </span>
    <span className={`text-xl font-black ${color}`}>
      {value} <span className="text-xs font-normal text-gray-500 lowercase">{unit}</span>
    </span>
  </div>
);

const MaterialRow = ({ label, val, color }) => (
  <div className="flex justify-between items-center border-b border-gray-700/30 pb-2 last:border-0 group">
    <div className="flex items-center gap-2">
      <div className={`w-1.5 h-1.5 rounded-full ${color}`} />
      <span className="text-gray-300 text-xs font-medium">{label}</span>
    </div>
    <span className="text-xs font-bold text-white font-mono">{val}</span>
  </div>
);