// src/pages/Calculs/eco/forms/EcoForm.jsx
import React, { useState, useMemo, useCallback } from "react";
import {
  Leaf, ChevronLeft, LayoutDashboard, Download,
  FileText, FileSpreadsheet, FileType2, X, TrendingUp, Table2
} from "lucide-react";

import TerrassementEco from "./TerrassementEco.jsx";
import FondationEco    from "./FondationEco.jsx";
import EnergieEco      from "./EnergieEco.jsx";
import EauEco          from "./EauEco.jsx";
import MateriauxEco    from "./MateriauxEco.jsx";
import DechetsEco      from "./DechetsEco.jsx";
import TransportEco    from "./TransportEco.jsx";
import DevisEco        from "./DevisEco.jsx";

// ─── CONFIG ÉTAPES ────────────────────────────────────────────
const stepsConfig = [
  { id: "terrassement", label: "Terrassement",  component: TerrassementEco, icon: "🚜", color: "text-amber-500"   },
  { id: "fondation",    label: "Fondation Éco", component: FondationEco,    icon: "🏗️", color: "text-red-500"     },
  { id: "energie",      label: "Énergie",        component: EnergieEco,      icon: "⚡", color: "text-yellow-400"  },
  { id: "eau",          label: "Eau",            component: EauEco,          icon: "💧", color: "text-cyan-400"    },
  { id: "materiaux",    label: "Matériaux",      component: MateriauxEco,    icon: "🧱", color: "text-emerald-500" },
  { id: "dechets",      label: "Déchets",        component: DechetsEco,      icon: "🗑️", color: "text-orange-500"  },
  { id: "transport",    label: "Transport",      component: TransportEco,    icon: "🚛", color: "text-blue-500"    },
];

const fmt = (n, currency = "XOF") =>
  `${Number(n || 0).toLocaleString("fr-FR")} ${currency}`;

const today = () => new Date().toLocaleDateString("fr-FR");

// ─── TABLEAU RÉCAP ────────────────────────────────────────────
const RecapTable = ({ costs, currency }) => {
  const rows  = stepsConfig.map(s => ({ ...s, cost: costs[s.id] || 0 }));
  const total = rows.reduce((a, r) => a + r.cost, 0);
  const hasAny = rows.some(r => r.cost > 0);

  return (
    <div className="rounded-2xl overflow-hidden border"
      style={{ background: "rgba(17,24,39,0.95)", borderColor: "rgba(75,85,99,0.4)" }}>
      <div className="px-5 py-3 flex items-center gap-3 border-b"
        style={{ background: "rgba(34,197,94,0.08)", borderColor: "rgba(34,197,94,0.2)" }}>
        <Table2 className="w-4 h-4 text-green-400" />
        <span className="text-xs font-bold text-green-300 uppercase tracking-widest">
          Récapitulatif écologique
        </span>
        {hasAny && (
          <span className="ml-auto text-[10px] text-gray-500 font-mono">
            {new Date().toLocaleTimeString("fr-FR")}
          </span>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "rgba(55,65,81,0.5)" }}>
              {["Poste", "Coût estimé"].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} style={{
                background: i % 2 === 0 ? "transparent" : "rgba(55,65,81,0.2)",
                opacity: r.cost > 0 ? 1 : 0.35,
              }}>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{r.icon}</span>
                    <span className={`font-semibold text-xs ${r.color}`}>{r.label}</span>
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  {r.cost > 0
                    ? <span className="font-bold text-xs text-green-300 font-mono">{fmt(r.cost, currency)}</span>
                    : <span className="text-[10px] text-gray-600 italic">Non chiffré</span>}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: "rgba(34,197,94,0.12)", borderTop: "1px solid rgba(34,197,94,0.25)" }}>
              <td className="px-4 py-3 text-xs font-black text-green-300 uppercase tracking-wider">Total général</td>
              <td className="px-4 py-3 text-sm font-black text-white font-mono">{fmt(total, currency)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {!hasAny && (
        <div className="py-8 flex flex-col items-center gap-2 text-gray-600">
          <TrendingUp className="w-8 h-8 opacity-30" />
          <p className="text-xs italic">Les calculs apparaîtront ici automatiquement</p>
        </div>
      )}
    </div>
  );
};

// ─── PANNEAU EXPORT ───────────────────────────────────────────
const ExportPanel = ({ costs, currency }) => {
  const [exporting, setExporting] = useState(null);
  const hasData = stepsConfig.some(s => (costs[s.id] || 0) > 0);
  const totalGeneral = stepsConfig.reduce((a, s) => a + (costs[s.id] || 0), 0);

  const rows = stepsConfig.map(s => ({
    label: s.label, icon: s.icon, cost: costs[s.id] || 0,
  }));

  const exportPDF = useCallback(async () => {
    setExporting("pdf");
    try {
      if (!window.jspdf) {
        await new Promise((res, rej) => {
          const s = document.createElement("script");
          s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
          s.onload = res; s.onerror = rej; document.head.appendChild(s);
        });
      }
      if (!window.jspdf?.jsPDF?.prototype?.autoTable) {
        await new Promise((res, rej) => {
          const s = document.createElement("script");
          s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js";
          s.onload = res; s.onerror = rej; document.head.appendChild(s);
        });
      }
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      doc.setFillColor(17, 24, 39); doc.rect(0, 0, 210, 297, "F");
      doc.setFillColor(22, 163, 74); doc.rect(0, 0, 210, 32, "F");
      doc.setTextColor(255, 255, 255); doc.setFontSize(20); doc.setFont("helvetica", "bold");
      doc.text("DEVIS ÉCOLOGIQUE", 14, 14);
      doc.setFontSize(9); doc.setFont("helvetica", "normal");
      doc.setTextColor(134, 239, 172);
      doc.text("CHANTILINK — Construction Durable & Éco-Responsable", 14, 22);
      doc.text(`Généré le ${today()}`, 14, 28);
      doc.autoTable({
        startY: 40,
        head: [["Poste", `Coût (${currency})`]],
        body: [
          ...rows.map(r => [r.label, r.cost ? r.cost.toLocaleString("fr-FR") : "—"]),
          ["TOTAL", totalGeneral.toLocaleString("fr-FR")],
        ],
        theme: "grid",
        styles: { fontSize: 10, font: "helvetica", textColor: [229, 231, 235], fillColor: [31, 41, 55], lineColor: [55, 65, 81], lineWidth: 0.3 },
        headStyles: { fillColor: [22, 163, 74], textColor: [255, 255, 255], fontStyle: "bold" },
        alternateRowStyles: { fillColor: [17, 24, 39] },
        didParseCell: (data) => {
          if (data.row.index === rows.length) {
            data.cell.styles.fillColor = [20, 83, 45];
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.textColor = [255, 255, 255];
          }
        },
        margin: { left: 14, right: 14 },
      });
      const pageH = doc.internal.pageSize.height;
      doc.setTextColor(75, 85, 99); doc.setFontSize(7);
      doc.text("Document généré par ChantiLink — www.chantilink.com", 14, pageH - 8);
      doc.save(`devis_eco_${Date.now()}.pdf`);
    } catch (e) { console.error(e); alert("Erreur export PDF."); }
    finally { setExporting(null); }
  }, [rows, totalGeneral, currency]);

  const exportExcel = useCallback(async () => {
    setExporting("excel");
    try {
      if (!window.XLSX) {
        await new Promise((res, rej) => {
          const s = document.createElement("script");
          s.src = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
          s.onload = res; s.onerror = rej; document.head.appendChild(s);
        });
      }
      const XLSX = window.XLSX;
      const wb = XLSX.utils.book_new();
      const ws1Data = [
        ["DEVIS ÉCOLOGIQUE — CHANTILINK", ""],
        [`Date : ${today()}`, ""],
        [""],
        ["Poste", `Coût (${currency})`],
        ...rows.map(r => [r.label, r.cost]),
        [""],
        ["TOTAL", totalGeneral],
      ];
      const ws1 = XLSX.utils.aoa_to_sheet(ws1Data);
      ws1["!cols"] = [{ wch: 25 }, { wch: 20 }];
      XLSX.utils.book_append_sheet(wb, ws1, "Récapitulatif");
      XLSX.writeFile(wb, `devis_eco_${Date.now()}.xlsx`);
    } catch (e) { console.error(e); alert("Erreur export Excel."); }
    finally { setExporting(null); }
  }, [rows, totalGeneral, currency]);

  const exportWord = useCallback(() => {
    setExporting("word");
    try {
      const tableRows = rows.map(r => `
        <tr style="background:${r.cost > 0 ? "#f0fdf4" : "#fff"}">
          <td style="padding:8px 12px;border:1px solid #ddd;font-weight:600">${r.icon} ${r.label}</td>
          <td style="padding:8px 12px;border:1px solid #ddd;text-align:right;font-weight:bold;color:#16a34a">
            ${r.cost ? r.cost.toLocaleString("fr-FR") + " " + currency : "—"}
          </td>
        </tr>`).join("");
      const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
        <head><meta charset="utf-8"><title>Devis Écologique</title></head>
        <body style="font-family:Arial,sans-serif;padding:30px;color:#111">
          <h1 style="color:#16a34a;border-bottom:3px solid #16a34a;padding-bottom:8px">DEVIS ÉCOLOGIQUE — CHANTILINK</h1>
          <p style="color:#6b7280;margin:0 0 24px">Date : ${today()}</p>
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead><tr style="background:#16a34a;color:#fff">
              <th style="padding:10px 12px;border:1px solid #15803d;text-align:left">Poste</th>
              <th style="padding:10px 12px;border:1px solid #15803d;text-align:right">Coût (${currency})</th>
            </tr></thead>
            <tbody>${tableRows}</tbody>
            <tfoot><tr style="background:#14532d;color:#fff">
              <td style="padding:10px 12px;border:1px solid #15803d;font-weight:bold;font-size:14px">TOTAL GÉNÉRAL</td>
              <td style="padding:10px 12px;border:1px solid #15803d;text-align:right;font-weight:bold;font-size:14px">
                ${totalGeneral.toLocaleString("fr-FR")} ${currency}
              </td>
            </tr></tfoot>
          </table>
          <p style="margin-top:32px;color:#9ca3af;font-size:11px">Document généré par ChantiLink — ${today()}</p>
        </body></html>`;
      const blob = new Blob([html], { type: "application/msword;charset=utf-8" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url; a.download = `devis_eco_${Date.now()}.doc`; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { console.error(e); alert("Erreur export Word."); }
    finally { setExporting(null); }
  }, [rows, totalGeneral, currency]);

  return (
    <div className="rounded-2xl overflow-hidden border"
      style={{ background: "linear-gradient(135deg, rgba(17,24,39,0.98) 0%, rgba(20,83,45,0.3) 100%)", borderColor: "rgba(34,197,94,0.25)" }}>
      <div className="px-5 py-3 flex items-center gap-3 border-b"
        style={{ background: "rgba(34,197,94,0.08)", borderColor: "rgba(34,197,94,0.2)" }}>
        <Download className="w-4 h-4 text-green-400" />
        <span className="text-xs font-bold text-green-300 uppercase tracking-widest">Exporter le devis</span>
        {!hasData && <span className="ml-auto text-[10px] text-gray-600 italic">Complétez au moins une section</span>}
      </div>
      <div className="p-4 flex flex-col sm:flex-row gap-3">
        <ExportBtn icon={<FileText className="w-5 h-5"/>} label="PDF" sublabel="Rapport imprimable"
          color="from-red-600 to-rose-700" glowColor="rgba(239,68,68,0.3)"
          disabled={!hasData} loading={exporting==="pdf"} onClick={exportPDF} />
        <ExportBtn icon={<FileSpreadsheet className="w-5 h-5"/>} label="Excel" sublabel="Tableau structuré"
          color="from-green-600 to-emerald-700" glowColor="rgba(34,197,94,0.3)"
          disabled={!hasData} loading={exporting==="excel"} onClick={exportExcel} />
        <ExportBtn icon={<FileType2 className="w-5 h-5"/>} label="Word" sublabel="Document .doc"
          color="from-blue-600 to-indigo-700" glowColor="rgba(59,130,246,0.3)"
          disabled={!hasData} loading={exporting==="word"} onClick={exportWord} />
      </div>
    </div>
  );
};

const ExportBtn = ({ icon, label, sublabel, color, glowColor, disabled, loading, onClick }) => (
  <button onClick={onClick} disabled={disabled || loading}
    className={`flex-1 flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all active:scale-95 ${disabled ? "opacity-30 cursor-not-allowed" : "hover:scale-[1.02]"}`}
    style={{ boxShadow: disabled ? "none" : `0 4px 20px ${glowColor}`, border: `0.5px solid ${disabled ? "rgba(75,85,99,0.3)" : glowColor}`, background: disabled ? "rgba(55,65,81,0.4)" : undefined }}>
    <span className={`p-2 rounded-lg bg-gradient-to-br ${color} text-white`}>
      {loading ? <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin"/> : icon}
    </span>
    <div className="text-left">
      <div className={`text-sm font-bold ${disabled ? "text-gray-500" : "text-white"}`}>{label}</div>
      <div className={`text-[10px] ${disabled ? "text-gray-600" : "text-white/60"}`}>{sublabel}</div>
    </div>
    {!disabled && !loading && <Download className="w-4 h-4 text-white/50 ml-auto"/>}
  </button>
);

// ─────────────────────────────────────────────────────────────
// ECO FORM — COMPOSANT PRINCIPAL
// ─────────────────────────────────────────────────────────────
export default function EcoForm({ currency = "XOF" }) {
  const [selectedStep, setSelectedStep] = useState(null);
  const [showDevis,    setShowDevis]    = useState(false);

  const [costs,     setCosts]     = useState(() => Object.fromEntries(stepsConfig.map(s => [s.id, 0])));
  const [quantites, setQuantites] = useState(() => Object.fromEntries(stepsConfig.map(s => [s.id, {}])));

  const handleCostChange = useCallback((stepId, value) => {
    setCosts(prev => {
      const v = Math.max(0, Number(value) || 0);
      if (prev[stepId] === v) return prev;
      return { ...prev, [stepId]: v };
    });
  }, []);

  const handleQuantitesChange = useCallback((stepId, materiaux) => {
    setQuantites(prev => {
      if (JSON.stringify(prev[stepId]) === JSON.stringify(materiaux)) return prev;
      return { ...prev, [stepId]: materiaux };
    });
  }, []);

  const totalGeneral    = useMemo(() => Object.values(costs).reduce((a, v) => a + v, 0), [costs]);
  const activeSteps     = useMemo(() => stepsConfig.filter(({ id }) => costs[id] > 0).length, [costs]);
  const progressPercent = (activeSteps / stepsConfig.length) * 100;

  // ✅ Double alias props — couvre tous les noms utilisés dans les sous-composants
  const renderCurrentStep = () => {
    const step = stepsConfig.find(s => s.id === selectedStep);
    if (!step) return null;
    const StepComponent = step.component;
    return (
      <StepComponent
        currency={currency}
        onTotalChange={val  => handleCostChange(step.id, val)}
        onCostChange={val   => handleCostChange(step.id, val)}
        onMateriauxChange={mats => handleQuantitesChange(step.id, mats)}
        onMaterialsChange={mats => handleQuantitesChange(step.id, mats)}
      />
    );
  };

  return (
    <div className="flex h-full w-full bg-gray-900 text-white overflow-hidden font-sans" style={{ minHeight: 0 }}>

      {/* ── SIDEBAR DESKTOP ──────────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-72 bg-gray-800/80 backdrop-blur-xl border-r border-gray-700 h-full z-20 shadow-2xl flex-shrink-0">

        {/* Header */}
        <div className="p-5 border-b border-gray-700 shrink-0 bg-gray-800/50">
          <h1 className="text-xl font-black bg-gradient-to-r from-green-400 to-emerald-500 bg-clip-text text-transparent flex items-center gap-2 mb-1">
            <Leaf className="w-5 h-5 text-green-500" /> Écologique
          </h1>
          <p className="text-[10px] text-gray-400 mb-3">Construction Durable & Responsable</p>
          <div className="bg-gray-700 rounded-full h-1.5 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-green-500 to-emerald-500 transition-all duration-700"
              style={{ width: `${progressPercent}%` }} />
          </div>
          <div className="flex justify-between mt-1.5 text-[9px] font-bold text-gray-500 uppercase tracking-wider">
            <span>Avancement</span>
            <span>{activeSteps}/{stepsConfig.length}</span>
          </div>
        </div>

        {/* Étapes */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5 custom-scrollbar">
          {stepsConfig.map((step) => {
            const isActive   = costs[step.id] > 0;
            const isSelected = selectedStep === step.id;
            return (
              <button key={step.id} onClick={() => setSelectedStep(step.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left relative overflow-hidden ${
                  isSelected
                    ? "bg-gray-700 border border-green-500/50 shadow-lg"
                    : "hover:bg-gray-800 border border-transparent hover:border-gray-700"
                }`}>
                {isSelected && <div className="absolute left-0 top-0 bottom-0 w-1 bg-green-500 rounded-r"/>}
                <span className={`text-lg filter transition-all ${!isSelected && !isActive ? "grayscale opacity-40" : ""}`}>
                  {step.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <div className={`font-bold text-xs ${isSelected ? "text-white" : "text-gray-300"}`}>{step.label}</div>
                  {isActive
                    ? <div className="text-[10px] font-mono text-green-400">{costs[step.id].toLocaleString()} {currency}</div>
                    : <div className="text-[9px] text-gray-600">Non chiffré</div>}
                </div>
                {isActive && <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)] animate-pulse"/>}
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700 bg-gray-900/80 shrink-0 space-y-2">
          <div className="bg-gray-800 rounded-xl p-3 border border-gray-700">
            <span className="text-[9px] text-gray-400 uppercase tracking-widest block mb-0.5">Total Projet Éco</span>
            <span className="text-lg font-black text-white tracking-tight">
              {totalGeneral.toLocaleString()} <span className="text-xs font-normal text-green-400">{currency}</span>
            </span>
          </div>
          <button onClick={() => setShowDevis(true)} disabled={totalGeneral === 0}
            className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95">
            <FileText className="w-3.5 h-3.5"/> Voir le Devis Éco
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT ─────────────────────────────────── */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative bg-gray-900 w-full min-w-0">

        {/* Mobile header */}
        <div className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-900 shrink-0 z-20">
          {selectedStep ? (
            <button onClick={() => setSelectedStep(null)} className="flex items-center gap-2 text-gray-300 hover:text-white text-sm">
              <ChevronLeft className="w-4 h-4"/> Retour
            </button>
          ) : (
            <h1 className="text-base font-bold text-green-500 flex items-center gap-2">
              <Leaf className="w-4 h-4"/> Écologique
            </h1>
          )}
          <div className="bg-gray-800 px-3 py-1.5 rounded-lg border border-gray-700">
            <span className="text-xs font-bold text-white">{totalGeneral.toLocaleString()} {currency}</span>
          </div>
        </div>

        {selectedStep ? (
          <div className="flex-1 w-full h-full overflow-hidden">
            {renderCurrentStep()}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto custom-scrollbar">

            {/* Grille mobile */}
            <div className="lg:hidden grid grid-cols-2 gap-3 p-4">
              {stepsConfig.map((step) => (
                <button key={step.id} onClick={() => setSelectedStep(step.id)}
                  className={`flex flex-col items-center justify-center p-4 rounded-2xl border backdrop-blur-sm shadow-lg active:scale-95 transition-all ${
                    costs[step.id] > 0
                      ? "border-green-500/50 bg-gradient-to-br from-gray-800 to-green-900/20"
                      : "border-gray-700 bg-gray-800/50 hover:bg-gray-800"
                  }`}>
                  <span className="text-3xl mb-2">{step.icon}</span>
                  <span className="font-bold text-xs text-center text-gray-200">{step.label}</span>
                  {costs[step.id] > 0 && (
                    <span className="mt-1.5 text-[9px] font-mono font-bold text-green-400 bg-gray-900/80 px-2 py-0.5 rounded border border-green-500/30">
                      {(costs[step.id] / 1000).toFixed(0)}k
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Desktop message */}
            <div className="hidden lg:flex flex-col items-center justify-center py-12 text-center opacity-40 select-none">
              <LayoutDashboard className="w-12 h-12 text-gray-600 mb-3"/>
              <p className="text-gray-400 text-sm font-medium">Sélectionnez une étape dans la barre latérale</p>
            </div>

            {/* Récap */}
            <div className="px-4 pb-4">
              <RecapTable costs={costs} currency={currency} />
            </div>

            {/* Export */}
            <div className="px-4 pb-6">
              <ExportPanel costs={costs} currency={currency} />
            </div>
          </div>
        )}

        {/* Mobile floating buttons */}
        <div className="lg:hidden fixed bottom-20 right-4 left-4 z-40 flex flex-col gap-2 pointer-events-none">
          {totalGeneral > 0 && !selectedStep && (
            <button onClick={() => setShowDevis(true)}
              className="pointer-events-auto w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white py-3 rounded-xl font-bold shadow-2xl flex items-center justify-center gap-2 border border-green-400/30 active:scale-95">
              <FileText className="w-4 h-4"/> Voir Devis Éco ({totalGeneral.toLocaleString()})
            </button>
          )}
        </div>
      </main>

      {/* ── MODAL DEVIS ──────────────────────────────────── */}
      {showDevis && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-0 lg:p-4">
          <div className="bg-gray-900 w-full h-full lg:rounded-3xl lg:max-w-5xl lg:h-[90vh] flex flex-col shadow-2xl border border-gray-700">
            <div className="flex justify-between items-center p-4 border-b border-gray-800">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Leaf className="text-green-500 w-5 h-5"/> Devis Écologique
              </h2>
              <button onClick={() => setShowDevis(false)} className="p-2 bg-gray-800 hover:bg-gray-700 rounded-full border border-gray-700">
                <X className="w-4 h-4"/>
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <DevisEco
                currency={currency}
                costs={costs}
                quantitesParOuvrage={quantites}
                totalGeneral={totalGeneral}
              />
            </div>
          </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #374151; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #4b5563; }
      `}</style>
    </div>
  );
}