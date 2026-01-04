import React, { useState, useEffect, useMemo } from "react";
import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS, ArcElement, Tooltip, Legend,
} from "chart.js";
import { 
  HardHat, Truck, Wrench, Banknote, Save, Trash2, History, Info, 
  Clock, Construction, Calculator, TrendingUp
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

ChartJS.register(ArcElement, Tooltip, Legend);

const STORAGE_KEY = "construction-infra-history-pro";

export default function ConstructionInfrastructure({ currency = "XOF", onCostChange = () => {} }) {
  
  // --- ÉTATS ---
  const [inputs, setInputs] = useState({
    heuresTravail: "",
    coutHoraireMainOeuvre: "",
    joursLocationEngins: "",
    coutJournalierLocation: "",
    tonnesTransportees: "",
    coutTransportParTonne: "",
    coutImprevus: ""
  });

  const [historique, setHistorique] = useState([]);
  const [message, setMessage] = useState(null);

  // --- MOTEUR DE CALCUL (BE) ---
  const results = useMemo(() => {
    const hrs = parseFloat(inputs.heuresTravail) || 0;
    const rateHrs = parseFloat(inputs.coutHoraireMainOeuvre) || 0;
    const jours = parseFloat(inputs.joursLocationEngins) || 0;
    const rateJours = parseFloat(inputs.coutJournalierLocation) || 0;
    const tonnes = parseFloat(inputs.tonnesTransportees) || 0;
    const rateTonnes = parseFloat(inputs.coutTransportParTonne) || 0;
    const imprevus = parseFloat(inputs.coutImprevus) || 0;

    const coutMO = hrs * rateHrs;
    const coutEngins = jours * rateJours;
    const coutLogistique = tonnes * rateTonnes;
    const total = coutMO + coutEngins + coutLogistique + imprevus;

    return {
      coutMO,
      coutEngins,
      coutLogistique,
      total,
      hrs,
      tonnes
    };
  }, [inputs]);

  // --- SYNC PARENT ---
  useEffect(() => {
    onCostChange(results.total);
  }, [results.total, onCostChange]);

  // --- HISTORIQUE ---
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) try { setHistorique(JSON.parse(saved)); } catch(e) {}
  }, []);

  const handleSave = () => {
    if (results.total <= 0) return showToast("⚠️ Saisie incomplète", "error");
    const newEntry = {
      id: Date.now(),
      date: new Date().toLocaleString('fr-FR'),
      ...inputs, ...results
    };
    const newHist = [newEntry, ...historique];
    setHistorique(newHist);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newHist));
    showToast("✅ Lot infrastructure enregistré !");
  };

  const showToast = (msg, type = "success") => {
    setMessage({ text: msg, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const chartData = {
    labels: ["Main d'œuvre", "Engins", "Transport", "Aléas"],
    datasets: [{
      data: [results.coutMO, results.coutEngins, results.coutLogistique, parseFloat(inputs.coutImprevus || 0)],
      backgroundColor: ["#6366f1", "#4f46e5", "#312e81", "#1e293b"],
      borderColor: "#111827",
      borderWidth: 2,
    }]
  };

  return (
    <div className="w-full h-full flex flex-col bg-gray-950 text-gray-100 overflow-hidden relative font-sans">
      
      {/* Toast Notification */}
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

      {/* Header Local */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600/20 rounded-lg text-indigo-500">
            <Construction className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white uppercase tracking-tight">Génie Civil & Infra</h2>
            <p className="text-xs text-gray-400 font-medium italic">Plateforme, Terrassement & Engins</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-gray-500 uppercase font-bold block tracking-widest">Budget Prévisionnel</span>
          <span className="text-2xl font-black text-indigo-400 tracking-tighter">
            {results.total.toLocaleString()} <span className="text-sm text-gray-500 font-normal">{currency}</span>
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-6 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
          
          {/* GAUCHE : SAISIE (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            
            {/* 1. Main d'œuvre */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 shadow-lg">
              <h3 className="flex items-center gap-2 text-xs font-bold text-indigo-400 uppercase tracking-widest mb-4">
                <HardHat className="w-4 h-4" /> Ressources Humaines
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label="Heures totales" value={inputs.heuresTravail} onChange={v => setInputs({...inputs, heuresTravail: v})} placeholder="Ex: 160" />
                <InputGroup label={`Taux horaire (${currency})`} value={inputs.coutHoraireMainOeuvre} onChange={v => setInputs({...inputs, coutHoraireMainOeuvre: v})} />
              </div>
            </div>

            {/* 2. Engins */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 shadow-lg">
              <h3 className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
                <Wrench className="w-4 h-4" /> Parc Engins & Location
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label="Nombre de jours" value={inputs.joursLocationEngins} onChange={v => setInputs({...inputs, joursLocationEngins: v})} placeholder="Ex: 10" />
                <InputGroup label={`Tarif/jour (${currency})`} value={inputs.coutJournalierLocation} onChange={v => setInputs({...inputs, coutJournalierLocation: v})} />
              </div>
            </div>

            {/* 3. Logistique & Transport */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 shadow-lg flex-1">
              <h3 className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
                <Truck className="w-4 h-4" /> Logistique & Flux
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label="Tonnages" value={inputs.tonnesTransportees} onChange={v => setInputs({...inputs, tonnesTransportees: v})} />
                <InputGroup label={`Prix / Tonne (${currency})`} value={inputs.coutTransportParTonne} onChange={v => setInputs({...inputs, coutTransportParTonne: v})} />
                <InputGroup label={`Provisions Imprévus (${currency})`} value={inputs.coutImprevus} onChange={v => setInputs({...inputs, coutImprevus: v})} full />
              </div>

              <button 
                onClick={handleSave}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-xl font-bold shadow-lg transition-all flex justify-center items-center gap-2 active:scale-95 mt-6"
              >
                <Save className="w-5 h-5" /> Enregistrer le chiffrage
              </button>
            </div>
          </div>

          {/* DROITE : DASHBOARD (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            
            {/* KPI Cards */}
            <div className="grid grid-cols-3 gap-4">
              <ResultCard label="Volume Transport" value={results.tonnes} unit="Tons" icon={<Truck className="w-4 h-4"/>} color="text-indigo-400" bg="bg-indigo-500/10" border />
              <ResultCard label="Charge Travail" value={results.hrs} unit="hrs" icon={<Clock className="w-4 h-4"/>} color="text-white" bg="bg-gray-800" />
              <ResultCard label="Poids MO" value={results.total > 0 ? Math.round((results.coutMO / results.total) * 100) : 0} unit="%" icon={<HardHat className="w-4 h-4"/>} color="text-emerald-400" bg="bg-emerald-500/10" />
            </div>

            {/* Graphique et Détails */}
            <div className="flex-1 bg-gray-900 rounded-3xl p-8 border border-gray-800 shadow-xl flex flex-col md:flex-row gap-10 items-center relative overflow-hidden">
               <div className="absolute -bottom-10 -right-10 w-44 h-44 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

               <div className="w-48 h-48 flex-shrink-0 relative">
                  <Doughnut data={chartData} options={{ cutout: "75%", plugins: { legend: { display: false } } }} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                     <span className="text-[10px] text-gray-500 uppercase font-bold text-center leading-tight">Total<br/>Direct</span>
                     <span className="text-sm font-bold text-white">{(results.total - (parseFloat(inputs.coutImprevus || 0))).toLocaleString()}</span>
                  </div>
               </div>

               <div className="flex-1 w-full space-y-4">
                  <h4 className="text-gray-400 text-xs font-bold uppercase tracking-widest border-b border-gray-800 pb-2 mb-2">Structure des coûts</h4>
                  
                  <MaterialRow label="Ressources Humaines" val={`${results.coutMO.toLocaleString()} ${currency}`} color="bg-indigo-500" />
                  <MaterialRow label="Location Matériel Lourd" val={`${results.coutEngins.toLocaleString()} ${currency}`} color="bg-indigo-600" />
                  <MaterialRow label="Transport d'agrégats" val={`${results.coutLogistique.toLocaleString()} ${currency}`} color="bg-indigo-900" />
                  
                  <div className="flex items-start gap-2 p-3 bg-blue-500/5 rounded-xl border border-blue-500/20 mt-4">
                    <Info className="w-4 h-4 text-indigo-400 mt-0.5" />
                    <p className="text-[10px] text-indigo-200/70 leading-relaxed italic">
                      L'estimation inclut la préparation du sol et les flux logistiques. Une marge de sécurité est conseillée pour les pannes d'engins.
                    </p>
                  </div>
               </div>
            </div>

            {/* Historique Mini */}
            {historique.length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden flex-1">
                <div className="px-4 py-2 bg-gray-800/50 border-b border-gray-800 flex justify-between items-center text-xs">
                  <h4 className="font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2"><History className="w-3 h-3" /> Historique infra</h4>
                  <button onClick={() => {setHistorique([]); localStorage.removeItem(STORAGE_KEY)}} className="text-red-400 hover:underline uppercase text-[10px]">Vider</button>
                </div>
                <div className="max-h-[120px] overflow-y-auto">
                  {historique.slice(0, 5).map((item) => (
                    <div key={item.id} className="flex justify-between items-center p-3 border-b border-gray-800 hover:bg-gray-800 transition-colors">
                      <div className="text-xs">
                        <span className="text-gray-500 block text-[9px]">{item.date}</span>
                        <span className="font-medium uppercase tracking-tighter">{item.heuresTravail}h MO - {item.tonnesTransportees}T Transport</span>
                      </div>
                      <span className="text-sm font-bold text-indigo-400">{parseFloat(item.total).toLocaleString()} {currency}</span>
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
      {value.toLocaleString()} <span className="text-xs font-normal text-gray-500 lowercase">{unit}</span>
    </span>
  </div>
);

const MaterialRow = ({ label, val, color }) => (
  <div className="flex justify-between items-center border-b border-gray-800 pb-2 last:border-0 group">
    <div className="flex items-center gap-2">
      <div className={`w-1.5 h-1.5 rounded-full ${color}`} />
      <span className="text-gray-300 text-xs font-medium group-hover:text-white transition-colors">{label}</span>
    </div>
    <span className="text-xs font-bold text-white font-mono">{val}</span>
  </div>
);