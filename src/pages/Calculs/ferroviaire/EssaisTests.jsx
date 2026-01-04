import React, { useState, useEffect, useMemo } from "react";
import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS, ArcElement, Tooltip, Legend,
} from "chart.js";
import { 
  Activity, Gauge, Zap, ShieldCheck, Save, Trash2, History, Info, 
  Calendar, Banknote, Timer, Microscope, TrendingUp
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

ChartJS.register(ArcElement, Tooltip, Legend);

const STORAGE_KEY = "essais-tests-history-pro";

// Types de tests ferroviaires standards
const TEST_TYPES = {
  VOIE: { label: "Géométrie & Voie", icon: <Gauge className="w-5 h-5"/>, color: "#3b82f6" },
  ZAP: { label: "Électrification / Caténaires", icon: <Zap className="w-5 h-5"/>, color: "#eab308" },
  SIG: { label: "Signalisation & Télécoms", icon: <Activity className="w-5 h-5"/>, color: "#a855f7" },
  MARCHE: { label: "Marches à blanc / Essais dynamiques", icon: <Timer className="w-5 h-5"/>, color: "#10b981" },
};

export default function EssaisTests({ currency = "XOF", onCostChange = () => {} }) {
  
  // --- ÉTATS ---
  const [selectedCategory, setSelectedCategory] = useState("VOIE");
  const [inputs, setInputs] = useState({
    nombreEssais: "",
    coutParEssai: "",
    coutMainOeuvre: "",
    autresCouts: "",
    dureeCampagne: "" // en jours
  });

  const [historique, setHistorique] = useState([]);
  const [message, setMessage] = useState(null);

  // --- MOTEUR DE CALCUL (BE) ---
  const results = useMemo(() => {
    const nb = parseFloat(inputs.nombreEssais) || 0;
    const cpe = parseFloat(inputs.coutParEssai) || 0;
    const mo = parseFloat(inputs.coutMainOeuvre) || 0;
    const autres = parseFloat(inputs.autresCouts) || 0;
    const jours = parseFloat(inputs.dureeCampagne) || 0;

    const totalEssaisDirects = nb * cpe;
    const totalGlobal = totalEssaisDirects + mo + autres;
    const coutJournalier = jours > 0 ? totalGlobal / jours : 0;

    return {
      totalEssaisDirects,
      totalGlobal,
      coutJournalier,
      nb
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
      date: new Date().toLocaleString('fr-FR'),
      category: TEST_TYPES[selectedCategory].label,
      ...inputs, ...results
    };
    const newHist = [newEntry, ...historique];
    setHistorique(newHist);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newHist));
    showToast("✅ Campagne de tests enregistrée !");
  };

  const showToast = (msg, type = "success") => {
    setMessage({ text: msg, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const chartData = {
    labels: ["Matériel/Tests", "Experts / MO", "Logistique"],
    datasets: [{
      data: [results.totalEssaisDirects, parseFloat(inputs.coutMainOeuvre || 0), parseFloat(inputs.autresCouts || 0)],
      backgroundColor: [TEST_TYPES[selectedCategory].color, "#1e293b", "#475569"],
      borderColor: "#111827",
      borderWidth: 2,
    }]
  };

  return (
    <div className="w-full h-full flex flex-col bg-gray-950 text-gray-100 overflow-hidden relative font-sans">
      
      {/* Notification Toast */}
      <AnimatePresence>
        {message && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-4 right-4 px-6 py-3 rounded-xl shadow-2xl z-50 font-bold ${
            message.type === "error" ? "bg-red-600" : "bg-indigo-600"
          }`}>
            {message.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600/20 rounded-lg text-indigo-400">
            <Microscope className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white uppercase tracking-tight">Tests & Commissioning</h2>
            <p className="text-xs text-gray-400 font-medium italic">Validation et mise en service (T&C)</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-gray-500 uppercase font-bold block tracking-widest">Budget T&C</span>
          <span className="text-2xl font-black text-indigo-400 tracking-tighter">
            {results.totalGlobal.toLocaleString()} <span className="text-sm text-gray-500 font-normal">{currency}</span>
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-6 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
          
          {/* GAUCHE : SAISIE (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            
            {/* 1. Catégorie de Test */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 shadow-lg">
              <h3 className="flex items-center gap-2 text-xs font-bold text-indigo-400 uppercase tracking-widest mb-4">
                <ShieldCheck className="w-4 h-4" /> Domaine de Certification
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(TEST_TYPES).map(([key, t]) => (
                  <button
                    key={key}
                    onClick={() => setSelectedCategory(key)}
                    className={`p-3 rounded-xl border text-left transition-all flex flex-col ${
                      selectedCategory === key ? "border-indigo-500 bg-indigo-500/10 shadow-lg" : "border-gray-800 bg-gray-900"
                    }`}
                  >
                    <span className="mb-1">{t.icon}</span>
                    <span className={`text-[10px] font-bold uppercase ${selectedCategory === key ? "text-indigo-400" : "text-gray-500"}`}>{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Paramètres Quantitatifs */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 shadow-lg space-y-4">
              <h3 className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                <Calendar className="w-4 h-4" /> Planification
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label="Nombre d'essais" value={inputs.nombreEssais} onChange={v => setInputs({...inputs, nombreEssais: v})} placeholder="Ex: 50" />
                <InputGroup label="Durée Campagne (j)" value={inputs.dureeCampagne} onChange={v => setInputs({...inputs, dureeCampagne: v})} placeholder="Ex: 15" />
              </div>
            </div>

            {/* 3. Financier */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 shadow-lg space-y-4 flex-1">
              <h3 className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
                <Banknote className="w-4 h-4" /> Analyse des Coûts
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label={`Coût / Essai (${currency})`} value={inputs.coutParEssai} onChange={v => setInputs({...inputs, coutParEssai: v})} />
                <InputGroup label={`Expertise / MO (${currency})`} value={inputs.coutMainOeuvre} onChange={v => setInputs({...inputs, coutMainOeuvre: v})} />
                <InputGroup label={`Logistique / Autres (${currency})`} value={inputs.autresCouts} onChange={v => setInputs({...inputs, autresCouts: v})} full />
              </div>

              <button 
                onClick={handleSave}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-xl font-bold shadow-lg transition-all flex justify-center items-center gap-2 active:scale-95 mt-4"
              >
                <Save className="w-5 h-5" /> Enregistrer le chiffrage
              </button>
            </div>
          </div>

          {/* DROITE : DASHBOARD (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            
            <div className="grid grid-cols-3 gap-4">
              <ResultCard label="Points de contrôle" value={results.nb} unit="tests" icon={<Gauge className="w-4 h-4"/>} color="text-indigo-400" bg="bg-indigo-500/10" border />
              <ResultCard label="Coût Journalier" value={Math.round(results.coutJournalier).toLocaleString()} unit={currency} icon={<TrendingUp className="w-4 h-4"/>} color="text-white" bg="bg-gray-800" />
              <ResultCard label="Domaine" value={selectedCategory} unit="" icon={<Microscope className="w-4 h-4"/>} color="text-emerald-400" bg="bg-emerald-500/10" />
            </div>

            <div className="flex-1 bg-gray-900 rounded-3xl p-8 border border-gray-800 shadow-xl flex flex-col md:flex-row gap-10 items-center relative overflow-hidden">
               <div className="absolute -bottom-10 -right-10 w-44 h-44 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

               <div className="w-48 h-48 flex-shrink-0 relative">
                  <Doughnut data={chartData} options={{ cutout: "75%", plugins: { legend: { display: false } } }} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                     <span className="text-[10px] text-gray-500 uppercase font-bold text-center leading-tight">Total<br/>Campagne</span>
                     <span className="text-sm font-bold text-white">{results.totalGlobal.toLocaleString()}</span>
                  </div>
               </div>

               <div className="flex-1 w-full space-y-4">
                  <h4 className="text-gray-400 text-xs font-bold uppercase tracking-widest border-b border-gray-800 pb-2 mb-2">Structure du coût</h4>
                  
                  <MaterialRow label="Prestations de tests" val={`${results.totalEssaisDirects.toLocaleString()} ${currency}`} color="bg-indigo-500" />
                  <MaterialRow label="Ingénieurs & Experts" val={`${parseFloat(inputs.coutMainOeuvre || 0).toLocaleString()} ${currency}`} color="bg-slate-700" />
                  <MaterialRow label="Logistique de campagne" val={`${parseFloat(inputs.autresCouts || 0).toLocaleString()} ${currency}`} color="bg-gray-600" />
                  
                  <div className="flex items-start gap-2 p-3 bg-blue-500/5 rounded-xl border border-blue-500/20 mt-4">
                    <Info className="w-4 h-4 text-indigo-400 mt-0.5" />
                    <p className="text-[10px] text-indigo-200/70 leading-relaxed italic">
                      La phase de T&C représente environ 5 à 8% du budget total d'un projet ferroviaire. Elle garantit la sécurité d'exploitation (SIL4).
                    </p>
                  </div>
               </div>
            </div>

            {/* Historique Mini */}
            {historique.length > 0 && (
              <div className="bg-gray-900/50 rounded-2xl border border-gray-800 overflow-hidden flex-1">
                <div className="px-4 py-2 bg-gray-800/50 border-b border-gray-800 flex justify-between items-center text-xs">
                  <h4 className="font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2"><History className="w-3 h-3" /> Historique</h4>
                  <button onClick={() => {setHistorique([]); localStorage.removeItem(STORAGE_KEY)}} className="text-red-400 hover:underline uppercase text-[10px]">Vider</button>
                </div>
                <div className="max-h-[120px] overflow-y-auto">
                  {historique.slice(0, 5).map((item) => (
                    <div key={item.id} className="flex justify-between items-center p-3 border-b border-gray-800 hover:bg-gray-800 transition-colors">
                      <div className="text-xs">
                        <span className="text-gray-500 block text-[9px]">{item.date}</span>
                        <span className="font-medium uppercase tracking-tighter">{item.category} - {item.nombreEssais} pts</span>
                      </div>
                      <span className="text-sm font-bold text-indigo-400">{parseFloat(item.totalGlobal).toLocaleString()} {currency}</span>
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
    <label className="mb-1 text-[10px] font-bold text-gray-500 uppercase tracking-wide">{label}</label>
    <input
      type="number" value={value || ""} onChange={e => onChange(e.target.value)}
      className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-white focus:border-indigo-500 transition-all font-mono text-sm"
      placeholder={placeholder || "0"}
    />
  </div>
);

const ResultCard = ({ label, value, unit, color, bg, border, icon }) => (
  <div className={`rounded-2xl p-4 flex flex-col justify-center items-center text-center ${bg} ${border ? 'border border-gray-800' : ''}`}>
    <span className="text-[10px] text-gray-500 uppercase font-bold mb-1 flex items-center gap-1">
      {icon} {label}
    </span>
    <span className={`text-xl font-black ${color}`}>
      {value} <span className="text-xs font-normal text-gray-500 lowercase">{unit}</span>
    </span>
  </div>
);

const MaterialRow = ({ label, val, color }) => (
  <div className="flex justify-between items-center border-b border-gray-800 pb-2 last:border-0 group">
    <div className="flex items-center gap-2">
      <div className={`w-1.5 h-1.5 rounded-full ${color}`} />
      <span className="text-gray-300 text-xs font-medium">{label}</span>
    </div>
    <span className="text-xs font-bold text-white font-mono">{val}</span>
  </div>
);