import React, { useState, useEffect, useMemo } from 'react';
import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale
} from "chart.js";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import { 
  Train, 
  FileText, 
  Download, 
  Settings2, 
  Package, 
  TrendingUp, 
  Printer, 
  Trash2, 
  Save, 
  Layers,
  Calculator
} from "lucide-react";

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale);

const STORAGE_KEY_DEVIS = "railpro-devis-data";

const ferroviaireInit = [
  { id: "infra", nom: "Terrassement & Plateforme", materiaux: ["Terre", "Gravier", "Eau", "Engins"] },
  { id: "track", nom: "Pose des Rails (Superstructure)", materiaux: ["Rails", "Traverses", "Ballast"] },
  { id: "elec", nom: "Électrification (25kV)", materiaux: ["Câbles", "Poteaux", "Isolants"] },
  { id: "sig", nom: "Signalisation & Télécoms", materiaux: ["Panneaux", "Capteurs", "Câblage"] },
  { id: "station", nom: "Gares & Aménagements", materiaux: ["Béton", "Acier", "Toiture", "Second-oeuvre"] },
];

export default function DevisFerroviaire({ currency = "XOF" }) {
  // --- ÉTATS ---
  const [etapes, setEtapes] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY_DEVIS);
    if (saved) return JSON.parse(saved).etapes;
    return ferroviaireInit.map(({ nom, materiaux }) => ({
      nom,
      materiaux: materiaux.map((m) => ({ nom: m, quantite: "" })),
    }));
  });

  const [prixUnitaires, setPrixUnitaires] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY_DEVIS);
    if (saved) return JSON.parse(saved).prixUnitaires;
    const mats = new Set();
    ferroviaireInit.forEach(({ materiaux }) => materiaux.forEach((m) => mats.add(m.toLowerCase())));
    const obj = {};
    mats.forEach((m) => (obj[m] = ""));
    return obj;
  });

  const [view, setView] = useState("phases"); // 'phases' | 'global' | 'settings'

  // --- CALCULS (useMemo pour la performance) ---
  const { cumul, couts, totalGlobal } = useMemo(() => {
    const newCumul = {};
    etapes.forEach(({ materiaux }) => {
      materiaux.forEach(({ nom, quantite }) => {
        const m = nom.toLowerCase();
        const qte = parseFloat(quantite) || 0;
        newCumul[m] = (newCumul[m] || 0) + qte;
      });
    });

    const newCouts = {};
    Object.keys(newCumul).forEach((m) => {
      const pu = parseFloat(prixUnitaires[m]) || 0;
      newCouts[m] = newCumul[m] * pu;
    });

    const total = Object.values(newCouts).reduce((a, b) => a + b, 0);
    return { cumul: newCumul, couts: newCouts, totalGlobal: total };
  }, [etapes, prixUnitaires]);

  // Sauvegarde auto
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_DEVIS, JSON.stringify({ etapes, prixUnitaires }));
  }, [etapes, prixUnitaires]);

  // --- HANDLERS ---
  const handleQuantiteChange = (idx, matNom, val) => {
    const copy = [...etapes];
    copy[idx].materiaux = copy[idx].materiaux.map(m => m.nom === matNom ? { ...m, quantite: val } : m);
    setEtapes(copy);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("DEVIS ESTIMATIF - PROJET FERROVIAIRE", 105, 20, { align: "center" });
    
    const body = [];
    etapes.forEach(e => {
        e.materiaux.forEach((m, i) => {
            if(parseFloat(m.quantite) > 0) {
                body.push([i === 0 ? e.nom : "", m.nom, m.quantite, prixUnitaires[m.nom.toLowerCase()], (m.quantite * prixUnitaires[m.nom.toLowerCase()]).toFixed(0)]);
            }
        });
    });

    doc.autoTable({
      startY: 30,
      head: [['Poste', 'Désignation', 'Qté', 'PU', 'Total']],
      body: body,
      theme: 'grid',
      headStyles: { fillColor: [49, 46, 129] }
    });
    doc.save("Devis_RailPro.pdf");
  };

  const chartData = {
    labels: etapes.map(e => e.nom),
    datasets: [{
      data: etapes.map(e => e.materiaux.reduce((acc, m) => acc + (parseFloat(m.quantite) || 0) * (parseFloat(prixUnitaires[m.nom.toLowerCase()]) || 0), 0)),
      backgroundColor: ["#6366f1", "#4f46e5", "#3730a3", "#312e81", "#1e1b4b"],
      borderWidth: 0
    }]
  };

  return (
    <div className="flex flex-col h-full bg-gray-950 text-gray-100 overflow-hidden font-sans">
      
      {/* Header Dashboard */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600/20 rounded-lg text-indigo-500">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white uppercase tracking-tight">Bordereau Estimatif</h2>
            <p className="text-xs text-gray-400 font-medium italic">Gestion des coûts et des fournitures</p>
          </div>
        </div>
        <div className="bg-gray-800 rounded-xl px-5 py-2 border border-gray-700">
          <span className="text-[10px] text-gray-500 uppercase font-black block tracking-widest">Total Projet</span>
          <span className="text-2xl font-black text-indigo-400">
            {totalGlobal.toLocaleString()} <span className="text-sm font-normal text-gray-500">{currency}</span>
          </span>
        </div>
      </div>

      {/* Navigation Interne */}
      <div className="flex-shrink-0 bg-gray-900/80 border-b border-gray-800 p-2 flex gap-2">
         <NavTab active={view === "phases"} onClick={() => setView("phases")} icon={<Layers className="w-4 h-4"/>} label="Saisie par Phase" />
         <NavTab active={view === "global"} onClick={() => setView("global")} icon={<TrendingUp className="w-4 h-4"/>} label="Synthèse & Stock" />
         <NavTab active={view === "settings"} onClick={() => setView("settings")} icon={<Settings2 className="w-4 h-4"/>} label="Prix Unitaires" />
      </div>

      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
        
        {/* VUE 1 : SAISIE PAR PHASE */}
        {view === "phases" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
            {etapes.map((etape, idx) => (
              <div key={idx} className="bg-gray-900 border border-gray-800 rounded-3xl p-5 shadow-xl hover:border-indigo-500/50 transition-all group">
                <h3 className="text-sm font-black text-indigo-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <div className="w-1.5 h-4 bg-indigo-500 rounded-full" /> {etape.nom}
                </h3>
                <div className="space-y-4">
                  {etape.materiaux.map((mat) => (
                    <div key={mat.nom} className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">{mat.nom}</label>
                      <div className="relative">
                        <input
                          type="number"
                          value={mat.quantite}
                          onChange={(e) => handleQuantiteChange(idx, mat.nom, e.target.value)}
                          className="w-full bg-gray-950 border border-gray-800 rounded-xl py-2 px-4 text-sm focus:border-indigo-500 outline-none transition-all font-mono"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* VUE 2 : SYNTHÈSE GLOBALE */}
        {view === "global" && (
          <div className="max-w-4xl mx-auto space-y-6 animate-in slide-in-from-bottom-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-gray-900 border border-gray-800 rounded-3xl p-8 flex flex-col items-center justify-center">
                    <h3 className="text-xs font-bold text-gray-500 uppercase mb-8">Répartition Budgétaire</h3>
                    <div className="w-full max-w-[240px]">
                        <Doughnut data={chartData} options={{ cutout: '75%', plugins: { legend: { display: false } } }} />
                    </div>
                </div>

                <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6">
                    <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                        <Package className="w-4 h-4" /> Besoins en matériaux cumulés
                    </h3>
                    <div className="space-y-3">
                        {Object.entries(cumul).map(([mat, qte]) => qte > 0 && (
                            <div key={mat} className="flex justify-between items-center p-3 bg-gray-950 rounded-2xl border border-gray-800 group hover:border-indigo-500/30 transition-all">
                                <span className="text-xs font-bold text-gray-400 uppercase">{mat}</span>
                                <div className="text-right">
                                    <span className="text-sm font-mono font-bold text-white">{qte.toFixed(2)}</span>
                                    <span className="text-[10px] text-gray-600 block">{couts[mat].toLocaleString()} {currency}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
          </div>
        )}

        {/* VUE 3 : RÉGLAGES PRIX */}
        {view === "settings" && (
            <div className="max-w-2xl mx-auto bg-gray-900 border border-gray-800 rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95">
                <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                    <Calculator className="text-indigo-500" /> Paramétrage du Bordereau
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {Object.keys(prixUnitaires).map(mat => (
                        <div key={mat} className="space-y-2">
                            <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">{mat}</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    value={prixUnitaires[mat]}
                                    onChange={(e) => setPrixUnitaires({...prixUnitaires, [mat]: e.target.value})}
                                    className="w-full bg-gray-950 border border-gray-800 rounded-xl py-3 px-4 text-sm font-mono text-indigo-400 focus:border-indigo-500 outline-none"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-700">{currency}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

      </div>

      {/* Footer Actions */}
      <div className="flex-shrink-0 p-4 border-t border-gray-800 bg-gray-900/50 backdrop-blur-sm flex justify-center gap-4">
        <button onClick={exportPDF} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 px-8 py-3 rounded-full font-bold text-sm transition-all shadow-lg shadow-indigo-500/20 active:scale-95">
          <Download className="w-4 h-4" /> Générer le BPU (PDF)
        </button>
        <button onClick={() => setView("phases")} className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 px-8 py-3 rounded-full font-bold text-sm border border-gray-700 transition-all">
          <Trash2 className="w-4 h-4 text-red-500" /> Réinitialiser
        </button>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #312e81; border-radius: 10px; }
      `}</style>
    </div>
  );
}

// --- SOUS-COMPOSANT NAV ---
function NavTab({ active, onClick, icon, label }) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-2 px-6 py-2 rounded-xl text-xs font-bold transition-all ${
                active ? "bg-indigo-600 text-white shadow-lg" : "text-gray-500 hover:text-gray-300 hover:bg-gray-800"
            }`}
        >
            {icon} {label}
        </button>
    );
}