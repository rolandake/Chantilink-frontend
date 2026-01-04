import React, { useState, useEffect, useMemo } from 'react';
import jsPDF from "jspdf";
import "jspdf-autotable";
import { 
  DraftingCompass, 
  Clock, 
  FileCheck, 
  Coins, 
  Save, 
  Trash2, 
  History, 
  CheckCircle2, 
  AlertCircle,
  Download,
  Calendar,
  Layers
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const STORAGE_KEY = "conception-preliminaire-pro-history";

export default function ConceptionPreliminaire({ currency = "XOF", onStatusChange = () => {}, onCostChange = () => {} }) {
  // --- ÉTATS ---
  const [inputs, setInputs] = useState({
    description: "",
    plansDisponibles: false,
    delaiPrevu: "",
    budgetIngenierie: "",
    etat: "Non commencé"
  });

  const [historique, setHistorique] = useState([]);
  const [message, setMessage] = useState(null);

  // --- EFFETS ---
  useEffect(() => {
    onStatusChange(inputs.etat);
    onCostChange(parseFloat(inputs.budgetIngenierie) || 0);
  }, [inputs.etat, inputs.budgetIngenierie]);

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
    if (!inputs.description.trim() || !inputs.delaiPrevu) {
      return showToast("⚠️ Veuillez remplir les champs obligatoires", "error");
    }

    const newEntry = {
      id: Date.now(),
      date: new Date().toLocaleString('fr-FR'),
      ...inputs,
      budgetIngenierie: parseFloat(inputs.budgetIngenierie) || 0
    };

    const newHist = [newEntry, ...historique];
    setHistorique(newHist);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newHist));
    showToast("✅ Conception enregistrée");
  };

  const deleteEntry = (id) => {
    if (window.confirm("Supprimer cette archive ?")) {
      const newHist = historique.filter(item => item.id !== id);
      setHistorique(newHist);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newHist));
    }
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.setTextColor(30, 27, 75); // Indigo sombre
    doc.text("RAPPORT DE CONCEPTION PRÉLIMINAIRE (APS)", 105, 20, { align: "center" });

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Édité le : ${new Date().toLocaleDateString()}`, 105, 28, { align: "center" });

    doc.autoTable({
      startY: 40,
      head: [['Paramètre', 'Détails']],
      body: [
        ['Description', inputs.description || "N/A"],
        ['Plans & Schémas', inputs.plansDisponibles ? "Livrables disponibles" : "En attente"],
        ['Délai Estimé', inputs.delaiPrevu || "Non défini"],
        ['Budget Ingénierie', `${(parseFloat(inputs.budgetIngenierie) || 0).toLocaleString()} ${currency}`],
        ['Statut Actuel', inputs.etat],
      ],
      theme: 'striped',
      headStyles: { fillColor: [79, 70, 229] }
    });

    doc.save("RailPro_APS_Rapport.pdf");
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
            <DraftingCompass className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white uppercase tracking-tight">Avant-Projet Sommaire (APS)</h2>
            <p className="text-xs text-gray-400 font-medium italic">Conception & Architecture Réseau</p>
          </div>
        </div>
        <div className="hidden md:flex gap-2">
            <button onClick={exportPDF} className="bg-gray-800 hover:bg-gray-700 p-2 rounded-lg border border-gray-700 transition-colors">
                <Download className="w-5 h-5 text-gray-400" />
            </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-6 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
          
          {/* GAUCHE : FORMULAIRE */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 shadow-xl space-y-6">
              
              <div>
                <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-[0.2em] mb-2 block">Notes de Conception</label>
                <textarea
                  rows="5"
                  value={inputs.description}
                  onChange={(e) => handleInputChange("description", e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-2xl p-4 text-sm text-gray-200 focus:border-indigo-500 outline-none transition-all placeholder-gray-700"
                  placeholder="Détails techniques, choix du tracé, contraintes majeures..."
                />
              </div>

              {/* Plans Switch */}
              <div className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${inputs.plansDisponibles ? "bg-indigo-600/10 border-indigo-500/50" : "bg-gray-950 border-gray-800"}`}>
                <div className="flex items-center gap-3">
                   <FileCheck className={inputs.plansDisponibles ? "text-indigo-400" : "text-gray-600"} />
                   <div>
                     <p className="text-xs font-bold">Livrables Graphiques</p>
                     <p className="text-[10px] text-gray-500">Plans et schémas directeurs</p>
                   </div>
                </div>
                <button 
                  onClick={() => handleInputChange("plansDisponibles", !inputs.plansDisponibles)}
                  className={`w-12 h-6 rounded-full relative transition-colors ${inputs.plansDisponibles ? "bg-indigo-600" : "bg-gray-700"}`}
                >
                  <motion.div 
                    animate={{ x: inputs.plansDisponibles ? 24 : 4 }}
                    className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm" 
                  />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-gray-500 font-bold uppercase block ml-1">Budget Design ({currency})</label>
                  <div className="relative">
                    <Coins className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                    <input
                      type="number"
                      value={inputs.budgetIngenierie}
                      onChange={(e) => handleInputChange("budgetIngenierie", e.target.value)}
                      className="w-full bg-gray-950 border border-gray-800 rounded-xl py-3 pl-10 pr-4 text-sm font-mono text-white outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-gray-500 font-bold uppercase block ml-1">Échéance</label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                    <input
                      type="text"
                      value={inputs.delaiPrevu}
                      onChange={(e) => handleInputChange("delaiPrevu", e.target.value)}
                      className="w-full bg-gray-950 border border-gray-800 rounded-xl py-3 pl-10 pr-4 text-sm text-white outline-none focus:border-indigo-500"
                      placeholder="Ex: 8 semaines"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <label className="text-[10px] text-gray-500 font-bold uppercase block mb-1.5 ml-1">Statut Conception</label>
                <select
                  value={inputs.etat}
                  onChange={(e) => handleInputChange("etat", e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option>Non commencé</option>
                  <option>En cours</option>
                  <option>Suspendu</option>
                  <option>Terminé</option>
                </select>
              </div>

              <button 
                onClick={handleSave}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-2xl font-bold shadow-lg shadow-indigo-900/20 transition-all flex justify-center items-center gap-2 active:scale-95"
              >
                <Save className="w-5 h-5" /> Enregistrer le Dossier
              </button>
            </div>
          </div>

          {/* DROITE : RÉSULTATS & HISTORIQUE */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            
            <div className="grid grid-cols-2 gap-4">
               <div className="bg-indigo-600/5 border border-indigo-500/10 p-5 rounded-3xl flex items-center gap-4">
                  <div className="p-3 bg-indigo-500/20 rounded-2xl text-indigo-400">
                    <Layers className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 font-black uppercase">Livrables</p>
                    <p className="text-sm font-bold">{inputs.plansDisponibles ? "Plans Prêts" : "En cours de dessin"}</p>
                  </div>
               </div>
               <div className="bg-gray-900 border border-gray-800 p-5 rounded-3xl flex items-center gap-4">
                  <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-500">
                    <Calendar className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 font-black uppercase">Délai estimé</p>
                    <p className="text-sm font-bold">{inputs.delaiPrevu || "--"}</p>
                  </div>
               </div>
            </div>

            {/* Historique Container */}
            <div className="bg-gray-900 border border-gray-800 rounded-3xl overflow-hidden flex-1 flex flex-col">
              <div className="px-6 py-4 bg-gray-800/50 border-b border-gray-800 flex justify-between items-center">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <History className="w-4 h-4" /> Archives de l'APS
                </h3>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                <AnimatePresence mode="popLayout">
                  {historique.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-600 opacity-50">
                       <FileCheck className="w-12 h-12 mb-2" />
                       <p className="text-sm italic">Aucune archive disponible</p>
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
                        <p className="text-xs text-gray-300 line-clamp-2 italic mb-3">"{item.description}"</p>
                        <div className="flex justify-between items-center pt-3 border-t border-gray-800">
                           <div className="flex gap-4">
                             <div className="text-[10px] font-bold uppercase tracking-tighter">
                                <span className="text-gray-500">Plans: </span>
                                <span className={item.plansDisponibles ? "text-emerald-500" : "text-red-500"}>
                                    {item.plansDisponibles ? "OUI" : "NON"}
                                </span>
                             </div>
                             <div className="text-[10px] font-bold uppercase tracking-tighter">
                                <span className="text-gray-500">Budget: </span>
                                <span className="text-white">{item.budgetIngenierie.toLocaleString()} {currency}</span>
                             </div>
                           </div>
                           <span className="text-[10px] font-black uppercase text-indigo-400">{item.etat}</span>
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