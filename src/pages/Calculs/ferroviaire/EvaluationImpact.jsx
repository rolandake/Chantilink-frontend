import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  Leaf, 
  Users, 
  TrendingUp, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Save, 
  Trash2, 
  History,
  Info,
  FileText
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const STORAGE_KEY = "evaluation-impact-history-pro";

export default function EvaluationImpact({ onStatusChange = () => {} }) {
  // --- ÉTATS ---
  const [inputs, setInputs] = useState({
    description: "",
    mesuresMitigation: "",
    recommandations: "",
    etat: "Non commencé"
  });

  const [historique, setHistorique] = useState([]);
  const [message, setMessage] = useState(null);

  // --- EFFETS ---
  useEffect(() => {
    onStatusChange(inputs.etat);
  }, [inputs.etat]);

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
    if (!inputs.description.trim()) return showToast("⚠️ Description manquante", "error");
    
    const newEntry = {
      id: Date.now(),
      date: new Date().toLocaleString('fr-FR'),
      ...inputs
    };

    const newHist = [newEntry, ...historique];
    setHistorique(newHist);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newHist));
    showToast("✅ Rapport d'impact enregistré");
  };

  const deleteEntry = (id) => {
    if (window.confirm("Supprimer ce rapport ?")) {
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
          <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-400">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white uppercase tracking-tight">Étude d'Impact (EIES)</h2>
            <p className="text-xs text-gray-400 font-medium">Conformité Environnementale & Sociale</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-gray-800 px-3 py-1.5 rounded-lg border border-gray-700">
          <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Statut :</span>
          <span className={`text-xs font-bold uppercase ${
            inputs.etat === "Terminé" ? "text-emerald-400" : "text-amber-400"
          }`}>{inputs.etat}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-6 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
          
          {/* GAUCHE : FORMULAIRE DE SAISIE */}
          <div className="lg:col-span-6 flex flex-col gap-5">
            <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 shadow-xl space-y-6">
              
              <div>
                <label className="flex items-center gap-2 text-xs font-bold text-indigo-400 uppercase tracking-widest mb-3">
                  <FileText className="w-4 h-4" /> Identification des Impacts
                </label>
                <textarea
                  rows="4"
                  value={inputs.description}
                  onChange={(e) => handleInputChange("description", e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-2xl p-4 text-sm text-gray-200 focus:border-indigo-500 outline-none transition-all placeholder-gray-700"
                  placeholder="Décrire les impacts environnementaux (faune, flore), sociaux (expropriations) ou économiques..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-widest mb-3">
                    <Leaf className="w-4 h-4" /> Stratégie de Mitigation
                  </label>
                  <textarea
                    rows="3"
                    value={inputs.mesuresMitigation}
                    onChange={(e) => handleInputChange("mesuresMitigation", e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-2xl p-4 text-sm text-gray-200 focus:border-emerald-500 outline-none transition-all placeholder-gray-700"
                    placeholder="Actions pour réduire les impacts..."
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-xs font-bold text-sky-400 uppercase tracking-widest mb-3">
                    <TrendingUp className="w-4 h-4" /> Recommandations
                  </label>
                  <textarea
                    rows="3"
                    value={inputs.recommandations}
                    onChange={(e) => handleInputChange("recommandations", e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-2xl p-4 text-sm text-gray-200 focus:border-sky-500 outline-none transition-all placeholder-gray-700"
                    placeholder="Conseils de mise en œuvre..."
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-gray-800 flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="w-full md:w-1/2">
                  <label className="text-[10px] text-gray-500 font-bold uppercase block mb-1.5 ml-1">État d'avancement</label>
                  <select
                    value={inputs.etat}
                    onChange={(e) => handleInputChange("etat", e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 text-sm font-bold text-white outline-none focus:border-indigo-500"
                  >
                    <option>Non commencé</option>
                    <option>En cours</option>
                    <option>En pause</option>
                    <option>Terminé</option>
                  </select>
                </div>
                <button 
                  onClick={handleSave}
                  className="w-full md:w-fit bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3 rounded-2xl font-bold shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95"
                >
                  <Save className="w-5 h-5" /> Enregistrer le Rapport
                </button>
              </div>
            </div>
          </div>

          {/* DROITE : HISTORIQUE & SYNTHÈSE */}
          <div className="lg:col-span-6 flex flex-col gap-6">
            
            <div className="bg-indigo-600/5 border border-indigo-500/10 rounded-3xl p-6 flex items-start gap-4">
               <div className="p-3 bg-indigo-500/20 rounded-2xl text-indigo-400">
                  <Info className="w-6 h-6" />
               </div>
               <div>
                  <h4 className="font-bold text-white mb-1">Standard IFC / Banque Mondiale</h4>
                  <p className="text-xs text-indigo-200/60 leading-relaxed">
                    Les études d'impact doivent couvrir les volets biophysiques et humains. En ferroviaire, l'accent est mis sur le bruit, les vibrations et le déplacement des populations.
                  </p>
               </div>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-3xl overflow-hidden flex-1 flex flex-col">
              <div className="px-6 py-4 bg-gray-800/50 border-b border-gray-800 flex justify-between items-center">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <History className="w-4 h-4" /> Historique des Évaluations
                </h3>
                <button 
                  onClick={() => { setHistorique([]); localStorage.removeItem(STORAGE_KEY); }}
                  className="text-xs text-red-400 hover:text-red-300 font-bold uppercase tracking-tighter"
                >
                  Vider
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                <AnimatePresence mode="popLayout">
                  {historique.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-600 opacity-50">
                       <FileText className="w-12 h-12 mb-2" />
                       <p className="text-sm italic">Aucun rapport enregistré</p>
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
                          <div className="flex flex-col">
                            <span className="text-[10px] font-mono text-gray-500">{item.date}</span>
                            <span className={`text-[10px] font-black uppercase tracking-tighter mt-1 ${
                              item.etat === "Terminé" ? "text-emerald-500" : "text-amber-500"
                            }`}>{item.etat}</span>
                          </div>
                          <button onClick={() => deleteEntry(item.id)} className="p-1.5 text-gray-700 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="space-y-3">
                           <div>
                              <p className="text-[10px] font-black text-gray-500 uppercase mb-1">Impact :</p>
                              <p className="text-xs text-gray-300 line-clamp-2 italic">"{item.description}"</p>
                           </div>
                           <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-800">
                              <div>
                                <p className="text-[10px] font-black text-gray-500 uppercase">Mitigation :</p>
                                <p className="text-[11px] text-emerald-400/80 truncate">{item.mesuresMitigation || "N/A"}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-black text-gray-500 uppercase">Recos :</p>
                                <p className="text-[11px] text-sky-400/80 truncate">{item.recommandations || "N/A"}</p>
                              </div>
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
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e1b4b; border-radius: 10px; }
      `}</style>
    </div>
  );
}