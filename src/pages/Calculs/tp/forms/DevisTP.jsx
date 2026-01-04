import React, { useState, useEffect, useMemo } from 'react';
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import { 
  CalendarDays, X, PieChart, FileDown, FileSpreadsheet, Plus, Trash2, 
  CheckCircle2, Clock, AlertCircle, HardHat, Truck, Package, TrendingUp, BarChart3
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

ChartJS.register(ArcElement, Tooltip, Legend);

const stepsConfig = [
  { id: "terrassement", label: "Terrassement", color: "text-yellow-500", icon: "🚜", hex: "#EAB308" },
  { id: "fondation", label: "Fondation", color: "text-red-500", icon: "🏗️", hex: "#EF4444" },
  { id: "hydraulique", label: "Hydraulique", color: "text-blue-500", icon: "💧", hex: "#3B82F6" },
  { id: "signalisation", label: "Signalisation", color: "text-orange-500", icon: "🚦", hex: "#F97316" },
  { id: "chaussee", label: "Chaussée", color: "text-purple-500", icon: "🛣️", hex: "#A855F7" },
  { id: "accotements", label: "Accotements", color: "text-pink-500", icon: "🌿", hex: "#EC4899" },
  { id: "finitions", label: "Finitions", color: "text-indigo-500", icon: "✨", hex: "#6366F1" },
  { id: "rehabilitation", label: "Réhabilitation", color: "text-green-500", icon: "🔧", hex: "#22C55E" },
];

export default function DevisTP({ 
  currency = "XOF", 
  costs = {}, 
  quantitesParEtape = {}, 
  totalGeneral = 0 
}) {
  const [showPlanningModal, setShowPlanningModal] = useState(false);
  const [showChartModal, setShowChartModal] = useState(false);

  // --- PLANNING ---
  const [planning, setPlanning] = useState(() => {
    try {
      const raw = localStorage.getItem("devis_tp_planning");
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem("devis_tp_planning", JSON.stringify(planning));
  }, [planning]);

  // --- CUMUL MATÉRIAUX LOGISTIQUE ---
  const logistique = useMemo(() => {
    const sum = { tonnage: 0, ciment: 0, acier: 0, bitume: 0 };
    Object.values(quantitesParEtape).forEach(data => {
      if (data?.tonnageTotal) sum.tonnage += data.tonnageTotal;
      if (data?.cimentT) sum.ciment += data.cimentT;
      if (data?.acierT) sum.acier += data.acierT;
      if (data?.enrobe) sum.bitume += data.enrobe;
    });
    return sum;
  }, [quantitesParEtape]);

  // --- EXPORTS ---
  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();
    const devisData = stepsConfig
      .filter(s => costs[s.id] > 0)
      .map(s => ({ "Poste": s.label, "Montant": costs[s.id], "Devise": currency }));
    
    devisData.push({ "Poste": "TOTAL GÉNÉRAL", "Montant": totalGeneral, "Devise": currency });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(devisData), "Devis Financier");

    const matData = [
      { Matériau: "Granulats / Graves", Quantité: logistique.tonnage.toFixed(2), Unité: "Tonnes" },
      { Matériau: "Ciment", Quantité: logistique.ciment.toFixed(2), Unité: "Tonnes" },
      { Matériau: "Acier", Quantité: (logistique.acier * 1000).toFixed(0), Unité: "Kg" },
      { Matériau: "Enrobés", Quantité: logistique.bitume.toFixed(2), Unité: "Tonnes" },
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(matData), "Besoins Logistiques");
    XLSX.writeFile(wb, `Devis_TP_Export.xlsx`);
  };

  const chartData = {
    labels: stepsConfig.filter(s => costs[s.id] > 0).map(s => s.label),
    datasets: [{
      data: stepsConfig.filter(s => costs[s.id] > 0).map(s => costs[s.id]),
      backgroundColor: stepsConfig.filter(s => costs[s.id] > 0).map(s => s.hex),
      borderColor: "#111827",
      borderWidth: 3,
    }],
  };

  return (
    <div className="h-full flex flex-col bg-gray-900 text-gray-100 overflow-hidden relative font-sans">
      
      {/* HEADER ACTIONS */}
      <div className="flex-shrink-0 p-4 border-b border-gray-800 bg-gray-900/90 backdrop-blur sticky top-0 z-30 flex justify-between items-center">
        <div className="flex gap-2">
          <button onClick={() => setShowPlanningModal(true)} className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-xl font-bold border border-gray-700 transition-all text-blue-400">
            <CalendarDays className="w-4 h-4" /> Planning
          </button>
          <button onClick={() => setShowChartModal(true)} className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-xl font-bold border border-gray-700 transition-all text-purple-400">
            <PieChart className="w-4 h-4" /> Analyse
          </button>
        </div>
        <div className="flex gap-2">
          <button onClick={exportToExcel} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded-xl font-bold transition-all shadow-lg shadow-emerald-900/20">
            <FileSpreadsheet className="w-4 h-4" /> Excel
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-8 custom-scrollbar">
        <div className="max-w-5xl mx-auto space-y-8">
          
          {/* TOP DASHBOARD CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SummaryCard label="Masse Granulats" value={logistique.tonnage.toFixed(1)} unit="Tons" icon={<Truck />} color="text-yellow-500" />
            <SummaryCard label="Besoins Ciment" value={Math.ceil(logistique.ciment * 20)} unit="Sacs" icon={<Package />} color="text-blue-500" />
            <SummaryCard label="Acier Total" value={(logistique.acier * 1000).toFixed(0)} unit="Kg" icon={<BarChart3 />} color="text-red-500" />
          </div>

          {/* DEVIS LINES */}
          <div className="bg-gray-800/30 border border-gray-800 rounded-3xl p-6 shadow-xl">
            <h3 className="text-xs font-black text-gray-500 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" /> Détail Estimatif par Poste
            </h3>
            <div className="space-y-3">
              {stepsConfig.map(step => {
                const amount = costs[step.id] || 0;
                if (amount === 0) return null;
                return (
                  <motion.div key={step.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                    className="group bg-gray-800/50 border border-gray-700 p-4 rounded-2xl flex justify-between items-center hover:border-orange-500/50 transition-all">
                    <div className="flex items-center gap-4">
                      <span className="text-2xl">{step.icon}</span>
                      <div>
                        <p className="font-bold text-gray-200">{step.label}</p>
                        <p className="text-[10px] text-gray-500 uppercase font-bold tracking-tighter">Poste certifié</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-mono font-black text-xl ${step.color}`}>{amount.toLocaleString()} <span className="text-xs font-normal opacity-60">{currency}</span></p>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* TOTAL BOX */}
            <div className="mt-10 p-8 bg-gradient-to-br from-orange-600 to-amber-600 rounded-3xl shadow-2xl flex flex-col md:flex-row justify-between items-center gap-6">
               <div className="text-white">
                  <h2 className="text-4xl font-black tracking-tighter">Total Général</h2>
                  <p className="opacity-80 text-sm font-bold uppercase tracking-widest">Toutes taxes comprises (TTC)</p>
               </div>
               <div className="bg-white/10 backdrop-blur-md px-8 py-4 rounded-2xl border border-white/20">
                  <span className="text-4xl lg:text-5xl font-black text-white">{totalGeneral.toLocaleString()} <small className="text-xl opacity-70">{currency}</small></span>
               </div>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL ANALYSE (CHART) */}
      <AnimatePresence>
        {showChartModal && (
          <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setShowChartModal(false)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-gray-900 border border-gray-700 rounded-3xl p-8 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
              <h3 className="text-xl font-bold mb-8 text-center text-orange-400">Répartition Budgétaire</h3>
              <div className="aspect-square">
                <Doughnut data={chartData} options={{ cutout: "75%", plugins: { legend: { position: 'bottom', labels: { color: '#9ca3af', font: { weight: 'bold' } } } } }} />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL PLANNING */}
      <AnimatePresence>
        {showPlanningModal && (
          <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-2 lg:p-6">
            <motion.div initial={{ y: 100 }} animate={{ y: 0 }} className="bg-gray-900 border border-gray-700 rounded-[2.5rem] w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden shadow-2xl">
              <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-850">
                <h2 className="text-2xl font-black flex items-center gap-3 text-blue-400"><CalendarDays /> Phasing du Chantier</h2>
                <button onClick={() => setShowPlanningModal(false)} className="p-2 bg-gray-800 rounded-full hover:bg-red-500 transition-colors"><X /></button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                {planning.map(task => (
                  <div key={task.id} className="bg-gray-800 border border-gray-700 p-4 rounded-2xl grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                    <input type="text" placeholder="Phase (ex: Terrassement)" value={task.title} onChange={e => setPlanning(planning.map(t => t.id === task.id ? {...t, title: e.target.value} : t))} 
                      className="bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm font-bold focus:border-blue-500 outline-none" />
                    <input type="date" value={task.start} onChange={e => setPlanning(planning.map(t => t.id === task.id ? {...t, start: e.target.value} : t))} 
                      className="bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-xs font-mono" />
                    <select value={task.status} onChange={e => setPlanning(planning.map(t => t.id === task.id ? {...t, status: e.target.value} : t))}
                      className="bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-xs font-bold text-blue-400 outline-none">
                      <option value="todo">⏳ En attente</option>
                      <option value="doing">⚙️ En cours</option>
                      <option value="done">✅ Achevé</option>
                    </select>
                    <button onClick={() => setPlanning(planning.filter(t => t.id !== task.id))} className="text-red-500 hover:bg-red-500/10 p-2 rounded-lg transition-colors justify-self-end"><Trash2 /></button>
                  </div>
                ))}
                <button onClick={() => setPlanning([...planning, { id: Date.now(), title: "", start: "", status: "todo" }])}
                  className="w-full py-4 border-2 border-dashed border-gray-700 rounded-2xl text-gray-500 hover:border-blue-500 hover:text-blue-500 transition-all font-bold">
                  + Ajouter une phase au projet
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #374151; border-radius: 10px; }
      `}</style>
    </div>
  );
}

// --- SOUS-COMPOSANTS ---
function SummaryCard({ label, value, unit, icon, color }) {
  return (
    <div className="bg-gray-800/40 border border-gray-800 p-5 rounded-3xl flex items-center gap-4">
      <div className={`p-3 rounded-2xl bg-gray-800 shadow-inner ${color}`}>{icon}</div>
      <div>
        <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">{label}</p>
        <p className="text-2xl font-black">{value} <span className="text-xs font-normal opacity-40">{unit}</span></p>
      </div>
    </div>
  );
}