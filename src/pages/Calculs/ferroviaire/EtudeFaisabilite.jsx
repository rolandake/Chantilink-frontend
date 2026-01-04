import React, { useState, useEffect, useMemo } from 'react';
import { 
  ClipboardList, 
  Timer, 
  Wallet, 
  Save, 
  Trash2, 
  History, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  FileText,
  TrendingUp
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const STORAGE_KEY = "etude-faisabilite-history-pro";

export default function EtudeFaisabilite({ currency = "XOF", onStatusChange = () => {}, onCostChange = () => {} }) {
  // --- ÉTATS ---
  const [inputs, setInputs] = useState({
    description: "",
    budgetEstime: "",
    dureeEstimee: "",
    etat: "Non commencé"
  });

  const [historique, setHistorique] = useState([]);
  const [message, setMessage] = useState(null);

  // --- CALCULS GLOBAUX (DASHBOARD) ---
  const stats = useMemo(() => {
    const totalBudget = historique.reduce((acc, curr) => acc + (parseFloat(curr.budgetEstime) || 0), 0);
    const completedCount = historique.filter(h => h.etat === "Terminé").length;
    return { totalBudget, completedCount };
  }, [historique]);

  // --- EFFETS ---
  useEffect(() => {
    onStatusChange(inputs.etat);
    onCostChange(parseFloat(inputs.budgetEstime) || 0);
  }, [inputs.etat, inputs.budgetEstime]);

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
    const { description, budgetEstime, dureeEstimee } = inputs;
    if (!description.trim() || !budgetEstime || !dureeEstimee) {
      return showToast("⚠️ Veuillez remplir tous les champs", "error");
    }

    const newEntry = {
      id: Date.now(),
      date: new Date().toLocaleString('fr-FR'),
      ...inputs,
      budgetEstime: parseFloat(budgetEstime)
    };

    const newHist = [newEntry, ...historique];
    setHistorique(newHist);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newHist));
    showToast("✅ Étude enregistrée avec succès");
  };

  const deleteEntry = (id) => {
    if (window.confirm("Supprimer cet historique ?")) {
      const newHist = historique.filter(item => item.id !== id);
      setHistorique(newHist);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newHist));
    }
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
            <ClipboardList className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white uppercase tracking-tight">Phase : Faisabilité</h2>
            <p className="text-xs text-gray-400 font-medium italic">Analyse technique & financière préliminaire</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-gray-500 uppercase font-bold block tracking-widest">Budget Étude</span>
          <span className="text-2xl font-black text-indigo-400 tracking-tighter">
            {(parseFloat(inputs.budgetEstime) || 0).toLocaleString()} <span className="text-sm text-gray-500 font-normal">{currency}</span>
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-6 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
          
          {/* GAUCHE : FORMULAIRE */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 shadow-xl space-y-6">
              
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-[0.2em] mb-2 block ml-1">Description de la mission</label>
                  <textarea
                    rows="4"
                    value={inputs.description}
                    onChange={(e) => handleInputChange("description", e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-2xl p-4 text-sm text-gray-200 focus:border-indigo-500 outline-none transition-all placeholder-gray-700"
                    placeholder="Ex: Analyse de sol, topographie du tracé A..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-500 uppercase block ml-1">Budget ({currency})</label>
                    <div className="relative">
                      <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                      <input
                        type="number"
                        value={inputs.budgetEstime}
                        onChange={(e) => handleInputChange("budgetEstime", e.target.value)}
                        className="w-full bg-gray-950 border border-gray-800 rounded-xl py-3 pl-10 pr-4 text-sm font-mono text-white outline-none focus:border-indigo-500"
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-500 uppercase block ml-1">Durée Estimée</label>
                    <div className="relative">
                      <Timer className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                      <input
                        type="text"
                        value={inputs.dureeEstimee}
                        onChange={(e) => handleInputChange("dureeEstimee", e.target.value)}
                        className="w-full bg-gray-950 border border-gray-800 rounded-xl py-3 pl-10 pr-4 text-sm text-white outline-none focus:border-indigo-500"
                        placeholder="Ex: 3 mois"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1.5 ml-1">Statut du dossier</label>
                  <select
                    value={inputs.etat}
                    onChange={(e) => handleInputChange("etat", e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option>Non commencé</option>
                    <option>En cours</option>
                    <option>En pause</option>
                    <option>Terminé</option>
                  </select>
                </div>
              </div>

              <button 
                onClick={handleSave}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-2xl font-bold shadow-lg shadow-indigo-900/20 transition-all flex justify-center items-center gap-2 active:scale-95"
              >
                <Save className="w-5 h-5" /> Enregistrer l'analyse
              </button>
            </div>

            {/* Aide Mémoire */}
            <div className="bg-indigo-600/5 border border-indigo-500/10 rounded-2xl p-4 flex items-start gap-3">
               <Info className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
               <p className="text-[11px] text-indigo-200/60 leading-relaxed italic">
                 Note RailPro : L'étude de faisabilité est cruciale pour valider les pentes max (1.5%) et les rayons de courbure du tracé ferroviaire.
               </p>
            </div>
          </div>

          {/* DROITE : RÉSULTATS & HISTORIQUE */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            
            {/* KPI Cards */}
            <div className="grid grid-cols-2 gap-4">
               <div className="bg-gray-900 border border-gray-800 p-5 rounded-3xl flex items-center gap-4">
                  <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-500">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 font-black uppercase">Études validées</p>
                    <p className="text-2xl font-black">{stats.completedCount}</p>
                  </div>
               </div>
               <div className="bg-gray-900 border border-gray-800 p-5 rounded-3xl flex items-center gap-4">
                  <div className="p-3 bg-indigo-500/10 rounded-2xl text-indigo-500">
                    <Banknote className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 font-black uppercase">Cumul Études</p>
                    <p className="text-xl font-black">{stats.totalBudget.toLocaleString()} <span className="text-xs font-normal opacity-50">{currency}</span></p>
                  </div>
               </div>
            </div>

            {/* Historique Container */}
            <div className="bg-gray-900 border border-gray-800 rounded-3xl overflow-hidden flex-1 flex flex-col">
              <div className="px-6 py-4 bg-gray-800/50 border-b border-gray-800 flex justify-between items-center">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <History className="w-4 h-4" /> Dossiers Précédents
                </h3>
                <button 
                  onClick={() => { if(window.confirm("Vider l'historique ?")) setHistorique([]); }}
                  className="text-[10px] font-black text-red-500 uppercase hover:text-red-400 transition-colors"
                >
                  Tout effacer
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                <AnimatePresence mode="popLayout">
                  {historique.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-600 opacity-50">
                       <FileText className="w-12 h-12 mb-2" />
                       <p className="text-sm italic">Aucun dossier en archive</p>
                    </div>
                  ) : (
                    historique.map((item) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-gray-800/40 border border-gray-800 p-5 rounded-2xl hover:border-indigo-500/30 transition-all group"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center gap-2">
                            {item.etat === "Terminé" ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Clock className="w-4 h-4 text-amber-500" />}
                            <span className="text-[10px] font-mono text-gray-500">{item.date}</span>
                          </div>
                          <button onClick={() => deleteEntry(item.id)} className="p-1.5 text-gray-700 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <h4 className="text-sm font-bold text-gray-200 mb-2 line-clamp-1">{item.description}</h4>
                        <div className="flex justify-between items-end">
                           <div className="flex gap-4">
                              <div>
                                <p className="text-[9px] font-black text-gray-500 uppercase">Budget</p>
                                <p className="text-xs font-bold text-white">{item.budgetEstime.toLocaleString()} {currency}</p>
                              </div>
                              <div>
                                <p className="text-[9px] font-black text-gray-500 uppercase">Délai</p>
                                <p className="text-xs font-bold text-white">{item.dureeEstimee}</p>
                              </div>
                           </div>
                           <span className={`text-[10px] font-black uppercase px-2 py-1 rounded bg-gray-900 border border-gray-800 ${
                             item.etat === "Terminé" ? "text-emerald-500" : "text-amber-500"
                           }`}>{item.etat}</span>
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

// --- SOUS-COMPOSANT REUTILISABLE ---
function ResultCard({ label, value, unit, color, bg, border, icon }) {
  return (
    <div className={`rounded-3xl p-5 flex flex-col justify-center items-center text-center ${bg} ${border ? 'border border-gray-800' : ''}`}>
      <span className="text-[10px] text-gray-500 uppercase font-black mb-2 flex items-center gap-1">
        {icon} {label}
      </span>
      <span className={`text-xl font-black ${color}`}>
        {value} <span className="text-xs font-normal text-gray-500">{unit}</span>
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