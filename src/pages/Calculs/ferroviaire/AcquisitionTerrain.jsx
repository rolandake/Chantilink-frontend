import React, { useState, useEffect, useMemo } from 'react';
import { 
  Map, 
  Ruler, 
  Banknote, 
  Save, 
  Trash2, 
  History, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Gavel,
  FileSearch,
  TrendingUp
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS, ArcElement, Tooltip, Legend,
} from "chart.js";

ChartJS.register(ArcElement, Tooltip, Legend);

const STORAGE_KEY = "acquisition-terrain-history-pro";

export default function AcquisitionTerrain({ currency = "XOF", onStatusChange = () => {}, onCostChange = () => {} }) {
  // --- ÉTATS ---
  const [inputs, setInputs] = useState({
    surface: "",
    coutParM2: "",
    fraisAnnexes: "", // Notaire, expertises, indemnités
    delaiPrevu: "",
    etat: "Non commencé"
  });

  const [historique, setHistorique] = useState([]);
  const [message, setMessage] = useState(null);

  // --- MOTEUR DE CALCUL ---
  const results = useMemo(() => {
    const s = parseFloat(inputs.surface) || 0;
    const c = parseFloat(inputs.coutParM2) || 0;
    const f = parseFloat(inputs.fraisAnnexes) || 0;

    const totalAcquisition = s * c;
    const totalGlobal = totalAcquisition + f;

    return { totalAcquisition, totalGlobal };
  }, [inputs]);

  // --- EFFETS ---
  useEffect(() => {
    onStatusChange(inputs.etat);
    onCostChange(results.totalGlobal);
  }, [inputs.etat, results.totalGlobal]);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) try { setHistorique(JSON.parse(saved)); } catch (e) {}
  }, []);

  // --- HANDLERS ---
  const handleInputChange = (field, value) => {
    setInputs(prev => ({ ...prev, [field]: value }));
  };

  const showToast = (text, type = "success") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleSave = () => {
    if (!inputs.surface || !inputs.coutParM2) {
      return showToast("⚠️ Surface et coût unitaire requis", "error");
    }

    const newEntry = {
      id: Date.now(),
      date: new Date().toLocaleString('fr-FR'),
      ...inputs,
      ...results
    };

    const newHist = [newEntry, ...historique];
    setHistorique(newHist);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newHist));
    showToast("✅ Dossier foncier enregistré");
  };

  const deleteEntry = (id) => {
    if (window.confirm("Supprimer cet historique foncier ?")) {
      const newHist = historique.filter(item => item.id !== id);
      setHistorique(newHist);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newHist));
    }
  };

  const chartData = {
    labels: ["Terrain brut", "Frais & Indemnités"],
    datasets: [{
      data: [results.totalAcquisition, parseFloat(inputs.fraisAnnexes || 0)],
      backgroundColor: ["#6366f1", "#f59e0b"],
      borderColor: "#111827",
      borderWidth: 2,
    }]
  };

  return (
    <div className="w-full h-full flex flex-col bg-gray-950 text-gray-100 overflow-hidden relative font-sans">
      
      {/* Toast Notification */}
      {message && (
        <div className={`fixed top-4 right-4 px-6 py-3 rounded-xl shadow-2xl z-50 font-bold animate-bounce ${
          message.type === "error" ? "bg-red-600" : "bg-indigo-600"
        }`}>
          {message.text}
        </div>
      )}

      {/* Header Local */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600/20 rounded-lg text-indigo-400">
            <Map className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white uppercase tracking-tight">Libération de l'Emprise</h2>
            <p className="text-xs text-gray-400 font-medium italic">Acquisition foncière & Indemnisations</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-gray-500 uppercase font-bold block tracking-widest">Coût Total Libération</span>
          <span className="text-2xl font-black text-indigo-400 tracking-tighter">
            {results.totalGlobal.toLocaleString()} <span className="text-sm text-gray-500 font-normal">{currency}</span>
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-6 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
          
          {/* GAUCHE : FORMULAIRE */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 shadow-xl space-y-6">
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <InputGroup 
                    label="Surface totale (m²)" 
                    icon={<Ruler className="w-4 h-4"/>}
                    value={inputs.surface} 
                    onChange={v => handleInputChange("surface", v)} 
                    placeholder="Ex: 5000"
                  />
                  <InputGroup 
                    label={`Prix au m² (${currency})`} 
                    icon={<Banknote className="w-4 h-4"/>}
                    value={inputs.coutParM2} 
                    onChange={v => handleInputChange("coutParM2", v)} 
                  />
                </div>

                <InputGroup 
                  label={`Frais Procédure & Indemnités (${currency})`} 
                  icon={<Gavel className="w-4 h-4"/>}
                  value={inputs.fraisAnnexes} 
                  onChange={v => handleInputChange("fraisAnnexes", v)} 
                  placeholder="Notaire, dédommagements..."
                  full
                />

                <div className="grid grid-cols-2 gap-4">
                  <InputGroup 
                    label="Délai estimé" 
                    icon={<Clock className="w-4 h-4"/>}
                    value={inputs.delaiPrevu} 
                    onChange={v => handleInputChange("delaiPrevu", v)} 
                    placeholder="Ex: 6 mois"
                  />
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-500 uppercase block ml-1">État procédure</label>
                    <select
                      value={inputs.etat}
                      onChange={(e) => handleInputChange("etat", e.target.value)}
                      className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-indigo-500 cursor-pointer transition-all"
                    >
                      <option>Non commencé</option>
                      <option>En cours</option>
                      <option>En litige</option>
                      <option>Terminé</option>
                    </select>
                  </div>
                </div>
              </div>

              <button 
                onClick={handleSave}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-2xl font-bold shadow-lg shadow-indigo-900/20 transition-all flex justify-center items-center gap-2 active:scale-95"
              >
                <Save className="w-5 h-5" /> Enregistrer le Dossier
              </button>
            </div>

            {/* Note d'information */}
            <div className="bg-amber-600/5 border border-amber-600/10 rounded-2xl p-4 flex items-start gap-3">
               <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
               <p className="text-[11px] text-amber-200/60 leading-relaxed">
                 <strong>Rappel Juridique :</strong> Le coût foncier doit inclure la provision pour les Déclarations d'Utilité Publique (DUP) et les éventuelles hausses de prix durant la phase de négociation.
               </p>
            </div>
          </div>

          {/* DROITE : DASHBOARD & HISTORIQUE */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            
            {/* KPI Cards */}
            <div className="grid grid-cols-3 gap-4">
               <StatCard label="Terrain Brut" value={results.totalAcquisition} unit={currency} icon={<TrendingUp />} color="text-indigo-400" bg="bg-indigo-500/10" />
               <StatCard label="Frais annexes" value={parseFloat(inputs.fraisAnnexes || 0)} unit={currency} icon={<FileSearch />} color="text-amber-400" bg="bg-amber-500/10" border />
               <StatCard label="Surface emprise" value={parseFloat(inputs.surface || 0)} unit="m²" icon={<Ruler />} color="text-emerald-400" bg="bg-emerald-500/10" />
            </div>

            {/* Chart Section */}
            <div className="bg-gray-900 rounded-3xl p-6 border border-gray-800 shadow-xl flex flex-col md:flex-row items-center gap-8 relative overflow-hidden">
               <div className="absolute -bottom-10 -right-10 w-44 h-44 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
               
               <div className="w-40 h-40 flex-shrink-0">
                  <Doughnut data={chartData} options={{ cutout: "75%", plugins: { legend: { display: false } } }} />
               </div>

               <div className="flex-1 space-y-4">
                  <h3 className="text-sm font-bold text-white uppercase tracking-widest">Analyse de la dépense</h3>
                  <div className="space-y-2">
                    <MaterialRow label="Acquisition Foncière" val={`${results.totalAcquisition.toLocaleString()} ${currency}`} color="bg-indigo-500" />
                    <MaterialRow label="Procédures & Indemnités" val={`${(parseFloat(inputs.fraisAnnexes || 0)).toLocaleString()} ${currency}`} color="bg-amber-500" />
                  </div>
                  <div className="pt-3 border-t border-gray-800">
                    <p className="text-[10px] text-gray-500 italic">Marge d'aléa foncier recommandée : +15% sur le total.</p>
                  </div>
               </div>
            </div>

            {/* Historique */}
            <div className="bg-gray-900 border border-gray-800 rounded-3xl overflow-hidden flex-1 flex flex-col">
              <div className="px-6 py-4 bg-gray-800/50 border-b border-gray-800 flex justify-between items-center">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <History className="w-4 h-4" /> Historique des acquisitions
                </h3>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                <AnimatePresence mode="popLayout">
                  {historique.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-700 opacity-50">
                       <Map className="w-12 h-12 mb-2" />
                       <p className="text-sm italic">Aucune acquisition enregistrée</p>
                    </div>
                  ) : (
                    historique.map((item) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-gray-800/40 border border-gray-800 p-4 rounded-2xl hover:border-indigo-500/30 transition-all group"
                      >
                        <div className="flex justify-between items-center">
                           <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-lg ${item.etat === "Terminé" ? "bg-emerald-500/20 text-emerald-500" : "bg-amber-500/20 text-amber-500"}`}>
                                 {item.etat === "Terminé" ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                              </div>
                              <div>
                                 <p className="text-sm font-bold text-white">{item.surface.toLocaleString()} m² <span className="text-[10px] text-gray-500 font-normal uppercase">({item.etat})</span></p>
                                 <p className="text-[10px] font-mono text-gray-600">{item.date}</p>
                              </div>
                           </div>
                           <div className="flex items-center gap-4">
                              <p className="text-sm font-black text-indigo-400">{parseFloat(item.totalGlobal).toLocaleString()} {currency}</p>
                              <button onClick={() => deleteEntry(item.id)} className="text-gray-700 hover:text-red-500 transition-colors">
                                 <Trash2 className="w-4 h-4" />
                              </button>
                           </div>
                        </div>
                      </motion.div>
                    ))
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e1b4b; border-radius: 10px; }
      `}</style>
    </div>
  );
}

// --- SOUS-COMPOSANTS ---
function InputGroup({ label, value, onChange, placeholder, full = false, icon }) {
  return (
    <div className={`flex flex-col ${full ? "col-span-2" : ""}`}>
      <label className="mb-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-wide ml-1">{label}</label>
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600">
            {icon}
        </div>
        <input
          type="number"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full bg-gray-950 border border-gray-800 rounded-xl py-3 pl-10 pr-4 text-sm font-mono text-white outline-none focus:border-indigo-500 transition-all"
          placeholder={placeholder || "0"}
        />
      </div>
    </div>
  );
}

function StatCard({ label, value, unit, color, bg, border, icon }) {
  return (
    <div className={`rounded-3xl p-4 flex flex-col items-center justify-center text-center ${bg} ${border ? 'border border-gray-800' : ''}`}>
      <span className="text-[10px] text-gray-500 uppercase font-black mb-1 flex items-center gap-1">
        {icon} {label}
      </span>
      <span className={`text-lg font-black ${color}`}>
        {value.toLocaleString()} <span className="text-[10px] font-normal text-gray-500 uppercase">{unit}</span>
      </span>
    </div>
  );
}

function MaterialRow({ label, val, color }) {
  return (
    <div className="flex justify-between items-center border-b border-gray-800 pb-2 last:border-0 group">
      <div className="flex items-center gap-2">
        <div className={`w-1.5 h-1.5 rounded-full ${color}`} />
        <span className="text-gray-300 text-xs font-medium group-hover:text-white transition-colors">{label}</span>
      </div>
      <span className="text-xs font-bold text-white font-mono">{val}</span>
    </div>
  );
}