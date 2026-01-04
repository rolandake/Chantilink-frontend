import React, { useState, useEffect, useMemo } from 'react';
import { Doughnut, Bar } from "react-chartjs-2";
import {
  Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement
} from "chart.js";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import { 
  FileText, Download, Calculator, Settings2, Package, 
  ChevronRight, TrendingUp, Printer, Trash2, Save 
} from "lucide-react";

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

const STORAGE_KEY_PRICES = "batiment-unit-prices";

export default function Devis({ currency = "XOF", costs, quantitesParEtape, totalGeneral }) {
  
  // --- ÉTATS ---
  const [view, setView] = useState("recapitulatif"); // 'recapitulatif' | 'materiaux' | 'prix'
  
  // Prix unitaires par défaut (Bureau d'Études)
  const [prixUnitaires, setPrixUnitaires] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY_PRICES);
    return saved ? JSON.parse(saved) : {
      ciment: 5000,   // par sac
      sable: 15000,   // par m3 ou tonne
      gravier: 18000, // par m3 ou tonne
      acier: 800,     // par kg
      beton: 65000,   // par m3
      main_oeuvre: 1  // multiplicateur
    };
  });

  // --- CALCULS GLOBAUX ---
  
  // 1. Cumul des matériaux de tout le projet
  const cumulMateriaux = useMemo(() => {
    const total = { ciment: 0, sable: 0, gravier: 0, acier: 0, volume: 0 };
    Object.values(quantitesParEtape).forEach(stepMats => {
      if (!stepMats) return;
      if (stepMats.ciment) total.ciment += stepMats.ciment; // en Tonnes
      if (stepMats.sable) total.sable += stepMats.sable;
      if (stepMats.gravier) total.gravier += stepMats.gravier;
      if (stepMats.acier) total.acier += stepMats.acier; // en Tonnes
      if (stepMats.volume) total.volume += stepMats.volume;
    });
    return total;
  }, [quantitesParEtape]);

  // Sauvegarde des prix
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_PRICES, JSON.stringify(prixUnitaires));
  }, [prixUnitaires]);

  // --- EXPORTS ---
  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text("DEVIS ESTIMATIF BATIMENT", 105, 20, { align: "center" });
    
    // Tableau des Ouvrages
    const tableOuvrages = Object.entries(costs)
      .filter(([_, val]) => val > 0)
      .map(([id, val]) => [id.toUpperCase(), `${val.toLocaleString()} ${currency}`]);

    doc.autoTable({
      startY: 30,
      head: [['DESIGNATION DES TRAVAUX', 'MONTANT ESTIMATIF']],
      body: [...tableOuvrages, [{ content: 'TOTAL GENERAL TTC', styles: { fontStyle: 'bold' } }, { content: `${totalGeneral.toLocaleString()} ${currency}`, styles: { fontStyle: 'bold' } }]],
      theme: 'striped',
      headStyles: { fillColor: [79, 70, 229] }
    });

    doc.save("Devis_Projet_Batiment.pdf");
  };

  const chartData = {
    labels: Object.keys(costs).filter(k => costs[k] > 0).map(k => k.toUpperCase()),
    datasets: [{
      data: Object.values(costs).filter(v => v > 0),
      backgroundColor: ["#f59e0b", "#ef4444", "#3b82f6", "#10b981", "#f43f5e", "#8b5cf6"],
      hoverOffset: 10
    }]
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 text-gray-100 overflow-hidden">
      
      {/* Barre de Navigation du Devis */}
      <div className="flex-shrink-0 bg-gray-800/50 border-b border-gray-700 p-2 flex gap-2">
        <NavButton active={view === "recapitulatif"} onClick={() => setView("recapitulatif")} icon={<TrendingUp className="w-4 h-4"/>} label="Récapitulatif" />
        <NavButton active={view === "materiaux"} onClick={() => setView("materiaux")} icon={<Package className="w-4 h-4"/>} label="Besoins Matériaux" />
        <NavButton active={view === "prix"} onClick={() => setView("prix")} icon={<Settings2 className="w-4 h-4"/>} label="Réglages Prix" />
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-6 custom-scrollbar">
        
        {/* VUE 1 : RECAPITULATIF PAR OUVRAGE */}
        {view === "recapitulatif" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-300">
            <div className="lg:col-span-7 space-y-4">
              <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden shadow-xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-750 text-[10px] uppercase tracking-widest text-gray-400 font-bold border-b border-gray-700">
                      <th className="px-6 py-4">Désignation de l'ouvrage</th>
                      <th className="px-6 py-4 text-right">Montant ({currency})</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {Object.entries(costs).map(([id, total]) => (
                      <tr key={id} className={`group hover:bg-gray-700/30 transition-colors ${total === 0 ? 'opacity-30' : ''}`}>
                        <td className="px-6 py-4 flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${total > 0 ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]' : 'bg-gray-600'}`} />
                          <span className="text-sm font-bold capitalize">{id}</span>
                        </td>
                        <td className="px-6 py-4 text-right font-mono font-bold text-sm">
                          {total.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-blue-600/10 text-blue-400">
                      <td className="px-6 py-5 text-sm font-black uppercase">Total Estimé du Projet</td>
                      <td className="px-6 py-5 text-right text-xl font-black">{totalGeneral.toLocaleString()}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              
              <div className="flex gap-3">
                <button onClick={exportPDF} className="flex-1 bg-gray-800 hover:bg-gray-700 border border-gray-600 py-3 rounded-xl font-bold flex justify-center items-center gap-2 transition-all">
                  <Printer className="w-4 h-4" /> Imprimer PDF
                </button>
                <button className="flex-1 bg-indigo-600 hover:bg-indigo-500 py-3 rounded-xl font-bold flex justify-center items-center gap-2 transition-all shadow-lg">
                  <Download className="w-4 h-4" /> Export Excel
                </button>
              </div>
            </div>

            <div className="lg:col-span-5 space-y-6">
              <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700 shadow-xl flex flex-col items-center">
                <h3 className="text-sm font-bold text-gray-400 uppercase mb-6 self-start">Répartition du budget</h3>
                <div className="w-full max-w-[280px]">
                  <Doughnut data={chartData} options={{ cutout: '75%', plugins: { legend: { display: false } } }} />
                </div>
                <div className="grid grid-cols-2 w-full gap-2 mt-6">
                   {Object.entries(costs).filter(([_,v]) => v > 0).map(([id, _], i) => (
                     <div key={id} className="flex items-center gap-2 text-[10px] text-gray-400 font-bold uppercase">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: chartData.datasets[0].backgroundColor[i] }} />
                        {id}
                     </div>
                   ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VUE 2 : CUMUL DES MATÉRIAUX (LISTE DE COURSE) */}
        {view === "materiaux" && (
          <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-300">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <MatCard label="Ciment Total" value={Math.ceil(cumulMateriaux.ciment * 20)} unit="Sacs de 50kg" color="text-orange-400" />
              <MatCard label="Acier Total" value={(cumulMateriaux.acier * 1000).toFixed(0)} unit="Kilogrammes" color="text-red-400" />
              <MatCard label="Sable Estimé" value={cumulMateriaux.sable.toFixed(1)} unit="m³" color="text-yellow-400" />
              <MatCard label="Béton Total" value={cumulMateriaux.volume.toFixed(1)} unit="m³ Coulés" color="text-blue-400" />
            </div>

            <div className="bg-gray-800 rounded-2xl border border-gray-700 p-6 shadow-xl">
               <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                 <Package className="text-indigo-400" /> État des Fournitures Globales
               </h3>
               <p className="text-xs text-gray-400 mb-6 italic">Ces quantités sont la somme de tous les modules actifs dans votre projet.</p>
               
               <div className="space-y-4">
                  <MaterialBar label="Ciment" current={cumulMateriaux.ciment} unit="T" color="bg-orange-500" />
                  <MaterialBar label="Acier" current={cumulMateriaux.acier} unit="T" color="bg-red-500" />
                  <MaterialBar label="Sable" current={cumulMateriaux.sable} unit="m³" color="bg-yellow-500" />
                  <MaterialBar label="Gravier" current={cumulMateriaux.gravier} unit="m³" color="bg-gray-500" />
               </div>
            </div>
          </div>
        )}

        {/* VUE 3 : REGLAGES PRIX */}
        {view === "prix" && (
          <div className="max-w-2xl mx-auto bg-gray-800 rounded-3xl border border-gray-700 p-8 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center gap-4 mb-8">
              <div className="p-3 bg-indigo-500/20 rounded-2xl text-indigo-400">
                <Settings2 className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Paramètres des Prix Unitaires</h3>
                <p className="text-sm text-gray-400">Ces prix servent de base au calcul global du devis.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <PriceInput label="Sac de Ciment (50kg)" value={prixUnitaires.ciment} onChange={(v) => setPrixUnitaires({...prixUnitaires, ciment: v})} unit={currency} />
              <PriceInput label="Tonne d'Acier (HA)" value={prixUnitaires.acier * 1000} onChange={(v) => setPrixUnitaires({...prixUnitaires, acier: v/1000})} unit={currency} />
              <PriceInput label="m³ de Sable" value={prixUnitaires.sable} onChange={(v) => setPrixUnitaires({...prixUnitaires, sable: v})} unit={currency} />
              <PriceInput label="m³ de Gravier" value={prixUnitaires.gravier} onChange={(v) => setPrixUnitaires({...prixUnitaires, gravier: v})} unit={currency} />
              <PriceInput label="Béton prêt à l'emploi (/m³)" value={prixUnitaires.beton} onChange={(v) => setPrixUnitaires({...prixUnitaires, beton: v})} unit={currency} />
            </div>

            <div className="mt-10 p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl flex items-start gap-3">
              <Calculator className="w-5 h-5 text-blue-400 shrink-0" />
              <p className="text-[11px] text-blue-200/70 leading-relaxed">
                Note technique : Les prix enregistrés ici écrasent les estimations par défaut. Assurez-vous de vérifier les tarifs locaux de vos fournisseurs pour plus de précision.
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// --- SOUS-COMPOSANTS ---

const NavButton = ({ active, onClick, icon, label }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
      active ? "bg-indigo-600 text-white shadow-lg" : "text-gray-400 hover:bg-gray-700 hover:text-white"
    }`}
  >
    {icon} {label}
  </button>
);

const MatCard = ({ label, value, unit, color }) => (
  <div className="bg-gray-800 p-4 rounded-2xl border border-gray-700 shadow-lg">
    <span className="text-[10px] font-bold text-gray-500 uppercase block mb-1">{label}</span>
    <div className={`text-2xl font-black ${color}`}>{value}</div>
    <span className="text-[10px] text-gray-400 font-medium">{unit}</span>
  </div>
);

const MaterialBar = ({ label, current, unit, color }) => (
  <div className="space-y-1">
    <div className="flex justify-between text-xs font-bold uppercase tracking-tighter">
      <span className="text-gray-300">{label}</span>
      <span className="text-white">{current.toFixed(2)} {unit}</span>
    </div>
    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
      <div className={`h-full ${color} rounded-full`} style={{ width: `${Math.min(current * 10, 100)}%` }} />
    </div>
  </div>
);

const PriceInput = ({ label, value, onChange, unit }) => (
  <div className="flex flex-col">
    <label className="text-[10px] font-bold text-gray-500 uppercase mb-1.5 ml-1">{label}</label>
    <div className="relative">
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full bg-gray-900 border border-gray-600 rounded-xl px-4 py-3 text-white font-mono text-sm focus:border-indigo-500 outline-none transition-all"
      />
      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-600">{unit}</span>
    </div>
  </div>
);