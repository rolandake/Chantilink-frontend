import React, { useState, useEffect, useMemo } from 'react';
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import { 
  CalendarDays, 
  X, 
  PieChart, 
  FileDown, 
  FileSpreadsheet,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  AlertCircle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

ChartJS.register(ArcElement, Tooltip, Legend);

const stepsConfig = [
  { id: "terrassement", label: "Terrassement", color: "text-yellow-500" },
  { id: "fondation", label: "Fondation", color: "text-red-500" },
  { id: "hydraulique", label: "Ouvrages Hydrauliques", color: "text-blue-500" },
  { id: "signalisation", label: "Signalisation", color: "text-orange-500" },
  { id: "chaussee", label: "Chaussée", color: "text-purple-500" },
  { id: "accotements", label: "Accotements", color: "text-pink-500" },
  { id: "finitions", label: "Finitions", color: "text-indigo-500" },
  { id: "rehabilitation", label: "Réhabilitation", color: "text-green-500" },
];

export default function DevisTP({ 
  currency = "XOF", 
  costs = {}, 
  quantitesParEtape = {}, 
  totalGeneral = 0 
}) {
  const [showPlanningModal, setShowPlanningModal] = useState(false);
  const [showChartModal, setShowChartModal] = useState(false);

  // --- PLANNING PERSISTANT ---
  const [planning, setPlanning] = useState(() => {
    try {
      const raw = localStorage.getItem("devis_tp_planning");
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  });

  useEffect(() => {
    localStorage.setItem("devis_tp_planning", JSON.stringify(planning));
  }, [planning]);

  // --- CALCULS MATÉRIAUX ---
  const cumulMateriaux = useMemo(() => {
    const cumul = {};
    // Parcours de chaque étape
    Object.keys(quantitesParEtape).forEach(stepId => {
      const etapeData = quantitesParEtape[stepId];
      // On s'adapte à la structure des données (parfois objet, parfois tableau)
      if (typeof etapeData === 'object' && etapeData !== null) {
        // Si c'est un objet plat type { cimentT: 10, sableT: 5 }
        Object.entries(etapeData).forEach(([key, val]) => {
          if (typeof val === 'number' && key !== 'total' && key !== 'volume' && key !== 'surface') {
             // Nettoyage des clés (ex: "cimentT" -> "Ciment")
             let cleanName = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
             cumul[cleanName] = (cumul[cleanName] || 0) + val;
          }
        });
      }
    });
    return cumul;
  }, [quantitesParEtape]);

  // --- CHART DATA ---
  const chartData = {
    labels: stepsConfig.filter(s => (costs[s.id] || 0) > 0).map(s => s.label),
    datasets: [{
      data: stepsConfig.filter(s => (costs[s.id] || 0) > 0).map(s => costs[s.id]),
      backgroundColor: ["#EAB308", "#EF4444", "#3B82F6", "#F97316", "#A855F7", "#EC4899", "#6366F1", "#22C55E"],
      borderColor: "#111827",
      borderWidth: 2,
    }],
  };

  // --- EXPORTS ---
  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();
    
    // 1. Feuille Devis
    const devisData = stepsConfig
      .filter(s => costs[s.id] > 0)
      .map(s => ({
        "Poste": s.label,
        "Montant": costs[s.id],
        "Devise": currency
      }));
    devisData.push({ "Poste": "TOTAL GÉNÉRAL", "Montant": totalGeneral, "Devise": currency });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(devisData), "Devis");

    // 2. Feuille Matériaux
    const matData = Object.entries(cumulMateriaux).map(([nom, qte]) => ({
      "Matériau": nom,
      "Quantité Estimée": qte.toFixed(2)
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(matData), "Matériaux");

    XLSX.writeFile(wb, `Projet_TP_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(22);
    doc.text("Devis Estimatif - Travaux Publics", 105, 20, { align: "center" });
    
    doc.setFontSize(12);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, 30);
    doc.text(`Devise: ${currency}`, 14, 36);

    const tableData = stepsConfig
      .filter(s => costs[s.id] > 0)
      .map(s => [s.label, costs[s.id].toLocaleString()]);
    
    tableData.push(["TOTAL GÉNÉRAL", totalGeneral.toLocaleString()]);

    doc.autoTable({
      startY: 45,
      head: [["Désignation", "Montant"]],
      body: tableData,
      theme: "grid",
      headStyles: { fillColor: [234, 88, 12] }, // Orange branding
    });

    doc.save(`Devis_TP_${new Date().toISOString().slice(0,10)}.pdf`);
  };

  // --- PLANNING HANDLERS ---
  const addTask = () => setPlanning([...planning, { id: Date.now(), title: "", start: "", end: "", status: "todo" }]);
  const updateTask = (id, field, value) => setPlanning(planning.map(t => t.id === id ? { ...t, [field]: value } : t));
  const removeTask = (id) => setPlanning(planning.filter(t => t.id !== id));

  return (
    <div className="h-full flex flex-col bg-gray-900 text-gray-100 overflow-hidden relative">
      
      {/* HEADER ACTIONS */}
      <div className="flex-shrink-0 p-4 border-b border-gray-800 bg-gray-900/95 backdrop-blur z-10 flex flex-wrap gap-3 justify-between items-center">
        <div className="flex gap-2">
          <button onClick={() => setShowPlanningModal(true)} className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg font-medium transition border border-gray-700">
            <CalendarDays className="w-4 h-4 text-blue-400" /> Planning
          </button>
          <button onClick={() => setShowChartModal(true)} className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg font-medium transition border border-gray-700">
            <PieChart className="w-4 h-4 text-purple-400" /> Graphique
          </button>
        </div>
        <div className="flex gap-2">
          <button onClick={exportToPDF} className="flex items-center gap-2 bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg font-bold transition shadow-lg shadow-red-900/20">
            <FileDown className="w-4 h-4" /> PDF
          </button>
          <button onClick={exportToExcel} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded-lg font-bold transition shadow-lg shadow-emerald-900/20">
            <FileSpreadsheet className="w-4 h-4" /> Excel
          </button>
        </div>
      </div>

      {/* LISTE DES POSTES (Main Content) */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-8 custom-scrollbar">
        <div className="max-w-4xl mx-auto space-y-6">
          
          {/* Header Devis */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-black text-white mb-2">Récapitulatif Financier</h1>
            <p className="text-gray-400">Estimation globale du projet</p>
          </div>

          {/* Lignes de devis */}
          <div className="space-y-3">
            {stepsConfig.map(step => {
              const amount = costs[step.id] || 0;
              if (amount === 0) return null;

              return (
                <motion.div 
                  key={step.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 flex justify-between items-center hover:bg-gray-800 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-10 rounded-full ${step.color.replace('text', 'bg')}`} />
                    <span className="font-bold text-lg text-gray-200">{step.label}</span>
                  </div>
                  <span className={`font-mono font-bold text-xl ${step.color}`}>
                    {amount.toLocaleString()} {currency}
                  </span>
                </motion.div>
              );
            })}
          </div>

          {/* TOTAL FINAL */}
          <div className="mt-8 pt-6 border-t-2 border-gray-700 flex justify-between items-end">
            <div className="text-left">
              <p className="text-sm text-gray-400 uppercase tracking-widest font-semibold">Coût Total Estimé</p>
              <p className="text-xs text-gray-500 mt-1">*Hors imprévus et taxes</p>
            </div>
            <div className="text-right">
              <p className="text-4xl lg:text-5xl font-black bg-gradient-to-r from-orange-400 to-amber-500 bg-clip-text text-transparent">
                {totalGeneral.toLocaleString()} <span className="text-xl text-gray-400">{currency}</span>
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* --- MODAL GRAPHIQUE --- */}
      <AnimatePresence>
        {showChartModal && (
          <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-lg relative"
            >
              <button onClick={() => setShowChartModal(false)} className="absolute top-4 right-4 p-2 bg-gray-800 rounded-full hover:bg-gray-700">
                <X className="w-5 h-5 text-white" />
              </button>
              <h3 className="text-xl font-bold mb-6 text-center">Répartition par Poste</h3>
              <div className="w-full h-64 flex justify-center">
                <Doughnut data={chartData} options={{ maintainAspectRatio: false }} />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- MODAL PLANNING --- */}
      <AnimatePresence>
        {showPlanningModal && (
          <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-2 lg:p-4">
            <motion.div 
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
              className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-4xl h-[90vh] flex flex-col shadow-2xl"
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-gray-800 flex justify-between items-center bg-gray-900 rounded-t-2xl">
                <div className="flex items-center gap-3">
                  <CalendarDays className="w-6 h-6 text-blue-500" />
                  <h2 className="text-xl font-bold text-white">Planning de Chantier</h2>
                </div>
                <button onClick={() => setShowPlanningModal(false)} className="p-2 bg-gray-800 hover:bg-gray-700 rounded-full transition">
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
                {planning.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                    <CalendarDays className="w-16 h-16 mb-4 opacity-20" />
                    <p>Aucune tâche planifiée.</p>
                    <button onClick={addTask} className="mt-4 text-blue-400 hover:underline">Créer la première tâche</button>
                  </div>
                ) : (
                  planning.map((task) => (
                    <div key={task.id} className="bg-gray-800/50 border border-gray-700 p-4 rounded-xl flex flex-col md:flex-row gap-4 items-start md:items-center">
                      <div className="flex-1 w-full">
                        <input 
                          type="text" 
                          placeholder="Nom de la tâche" 
                          value={task.title}
                          onChange={(e) => updateTask(task.id, "title", e.target.value)}
                          className="w-full bg-transparent text-white font-bold placeholder-gray-600 focus:outline-none border-b border-transparent focus:border-blue-500 transition-colors mb-2"
                        />
                        <div className="flex gap-2">
                          <input 
                            type="date" 
                            value={task.start}
                            onChange={(e) => updateTask(task.id, "start", e.target.value)}
                            className="bg-gray-900 border border-gray-700 text-xs rounded px-2 py-1 text-gray-300"
                          />
                          <span className="text-gray-500">➜</span>
                          <input 
                            type="date" 
                            value={task.end}
                            onChange={(e) => updateTask(task.id, "end", e.target.value)}
                            className="bg-gray-900 border border-gray-700 text-xs rounded px-2 py-1 text-gray-300"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
                        <select 
                          value={task.status}
                          onChange={(e) => updateTask(task.id, "status", e.target.value)}
                          className={`text-xs font-bold px-3 py-1.5 rounded-full border bg-gray-900 cursor-pointer ${
                            task.status === "done" ? "text-green-400 border-green-500/30" : 
                            task.status === "doing" ? "text-blue-400 border-blue-500/30" : 
                            "text-gray-400 border-gray-600"
                          }`}
                        >
                          <option value="todo">À faire</option>
                          <option value="doing">En cours</option>
                          <option value="done">Terminé</option>
                        </select>
                        
                        <button onClick={() => removeTask(task.id)} className="text-red-500 hover:bg-red-500/10 p-2 rounded-lg transition">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-gray-800 bg-gray-900 rounded-b-2xl">
                <button 
                  onClick={addTask}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition shadow-lg"
                >
                  <Plus className="w-5 h-5" /> Ajouter une tâche
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #374151; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #4b5563; }
      `}</style>
    </div>
  );
}