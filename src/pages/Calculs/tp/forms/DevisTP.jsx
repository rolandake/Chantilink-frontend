import React, { useMemo, useState } from "react";
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  BarChart3,
  FileDown,
  FileSpreadsheet,
  Layers,
  Package,
  PieChart,
  TrendingUp,
} from "lucide-react";
import {
  addPdfFooters,
  createChantilinkLogoCanvas,
  drawChantilinkHeader,
  fmtPdfMoney,
} from "../../utils/exportBranding";

ChartJS.register(ArcElement, Tooltip, Legend);

const stepsConfig = [
  { id: "terrassement", label: "Terrassement", icon: "🚜", hex: "#EAB308" },
  { id: "fondation", label: "Fondation TP", icon: "🏗️", hex: "#EF4444" },
  { id: "hydraulique", label: "Ouvrages hydrauliques", icon: "💧", hex: "#3B82F6" },
  { id: "signalisation", label: "Signalisation", icon: "🚦", hex: "#F97316" },
  { id: "chaussee", label: "Chaussée", icon: "🛣️", hex: "#A855F7" },
  { id: "accotements", label: "Accotements", icon: "🌿", hex: "#EC4899" },
  { id: "rehabilitation", label: "Réhabilitation", icon: "🔧", hex: "#22C55E" },
];

const MATERIAL_LABELS = {
  volume: "Béton / volume compacté",
  volumeExcave: "Déblais excavés",
  volumeFoisonne: "Déblais foisonnés",
  volumeEvacue: "Déblais évacués",
  volumeDepot: "Mise en dépôt",
  volumeRemblai: "Remblai compacté",
  volumeApport: "Emprunt / apport",
  volumeCommande: "Volume à commander",
  nombreCamions: "Camions",
  nbOuvrages: "Ouvrages",
  nbLignes: "Lignes",
  nbTaches: "Interventions",
  surface: "Surface",
  tonnageTotal: "Tonnage total",
  enrobe: "Enrobé",
  roulementT: "Couche roulement",
  baseT: "Couche base",
  fondationT: "Couche fondation",
  bitumeT: "Bitume",
  granulatsT: "Granulats",
  cimentT: "Ciment",
  sableT: "Sable",
  gravierT: "Gravier",
  terreT: "Terre stabilisée",
  acierT: "Acier",
  eauL: "Eau",
  coffrage: "Coffrage",
  poidsLogistique: "Poids logistique",
  emulsionKg: "Émulsion",
  quantiteSignalisation: "Signalisation",
  peintureKg: "Peinture / marquage",
  acierSignalisationKg: "Acier signalisation",
  quantiteRehabilitation: "Quantité réhabilitation",
  coutMateriaux: "Coût matériaux",
  coutMainOeuvre: "Coût main d'œuvre",
  coutFourniture: "Coût fourniture",
  coutPose: "Coût pose",
  coutDemolition: "Démolition / curage",
  coutChaussee: "Reprise chaussée",
  coutAssainissement: "Assainissement",
  coutSignalisation: "Signalisation",
  coutDivers: "Divers",
};

const MATERIAL_UNITS = {
  volume: "m³",
  volumeExcave: "m³",
  volumeFoisonne: "m³",
  volumeEvacue: "m³",
  volumeDepot: "m³",
  volumeRemblai: "m³",
  volumeApport: "m³",
  volumeCommande: "m³",
  nombreCamions: "u",
  nbOuvrages: "u",
  nbLignes: "u",
  nbTaches: "u",
  surface: "m²",
  tonnageTotal: "t",
  enrobe: "t",
  roulementT: "t",
  baseT: "t",
  fondationT: "t",
  bitumeT: "t",
  granulatsT: "t",
  cimentT: "t",
  sableT: "t",
  gravierT: "t",
  terreT: "t",
  acierT: "t",
  eauL: "L",
  coffrage: "m²",
  poidsLogistique: "t",
  emulsionKg: "kg",
  quantiteSignalisation: "u",
  peintureKg: "kg",
  acierSignalisationKg: "kg",
  quantiteRehabilitation: "u/ml/m²",
  coutMateriaux: "XOF",
  coutMainOeuvre: "XOF",
  coutFourniture: "XOF",
  coutPose: "XOF",
  coutDemolition: "XOF",
  coutChaussee: "XOF",
  coutAssainissement: "XOF",
  coutSignalisation: "XOF",
  coutDivers: "XOF",
};

const MATERIAL_ALIASES = {
  ciment: "cimentT",
  sable: "sableT",
  gravier: "gravierT",
  acier: "acierT",
  camions: "nombreCamions",
};

const FINANCIAL_KEYS = new Set([
  "coutMateriaux",
  "coutMainOeuvre",
  "coutFourniture",
  "coutPose",
  "coutDemolition",
  "coutChaussee",
  "coutAssainissement",
  "coutSignalisation",
  "coutDivers",
]);

const EXCLUDED_TOTAL_KEYS = new Set(["typeOuvrage"]);

const normalizeKey = (key) => MATERIAL_ALIASES[key] || key;
const fmtNum = (value, key = "") => Number(value || 0).toLocaleString("fr-FR", {
  maximumFractionDigits: key.includes("acier") ? 3 : 2,
});
const fmtMoney = (value, currency) => `${Number(value || 0).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} ${currency}`;

const quantityText = (key, value) => {
  const normalizedKey = normalizeKey(key);
  const unit = MATERIAL_UNITS[normalizedKey] || "";
  return `${MATERIAL_LABELS[normalizedKey] || normalizedKey}: ${fmtNum(value, normalizedKey)} ${unit}`;
};

const buildRows = (costs, quantitesParEtape) => stepsConfig.map((step) => {
  const materials = quantitesParEtape[step.id] || {};
  const grouped = {};
  Object.entries(materials).forEach(([key, value]) => {
    const normalizedKey = normalizeKey(key);
    const n = Number(value || 0);
    if (!EXCLUDED_TOTAL_KEYS.has(normalizedKey) && n > 0) {
      grouped[normalizedKey] = (grouped[normalizedKey] || 0) + n;
    }
  });
  const entries = Object.entries(grouped);
  return {
    ...step,
    amount: Number(costs[step.id] || 0),
    entries,
    quantities: entries.filter(([key]) => !FINANCIAL_KEYS.has(key)),
    financials: entries.filter(([key]) => FINANCIAL_KEYS.has(key)),
  };
});

export default function DevisTP({
  currency = "XOF",
  costs = {},
  quantitesParEtape = {},
  totalGeneral = 0,
}) {
  const [showChart, setShowChart] = useState(false);

  const rows = useMemo(() => buildRows(costs, quantitesParEtape), [costs, quantitesParEtape]);
  const activeRows = useMemo(() => rows.filter((row) => row.amount > 0 || row.entries.length > 0), [rows]);

  const materialRows = useMemo(() => {
    const totals = {};
    rows.forEach((row) => {
      row.entries.forEach(([key, value]) => {
        if (FINANCIAL_KEYS.has(key)) return;
        totals[key] = (totals[key] || 0) + Number(value || 0);
      });
    });
    return Object.entries(totals)
      .filter(([, value]) => Number(value || 0) > 0)
      .sort(([a], [b]) => (MATERIAL_LABELS[a] || a).localeCompare(MATERIAL_LABELS[b] || b));
  }, [rows]);

  const financialRows = useMemo(() => {
    const totals = {};
    rows.forEach((row) => {
      row.financials.forEach(([key, value]) => {
        totals[key] = (totals[key] || 0) + Number(value || 0);
      });
    });
    return Object.entries(totals).filter(([, value]) => Number(value || 0) > 0);
  }, [rows]);

  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();

    const overview = [
      ["CHANTILINK - RÉCAPITULATIF GLOBAL TRAVAUX PUBLICS", "", "", ""],
      [`Date : ${new Date().toLocaleDateString("fr-FR")}`, "", "", ""],
      [""],
      ["Indicateur", "Valeur", "Unité", "Observation"],
      ["Postes chiffrés", activeRows.length, "u", "Ouvrages contenant des quantités ou un montant"],
      ["Matériaux cumulés", materialRows.length, "u", "Cumul automatique toutes synthèses"],
      ["Montant global", totalGeneral, currency, "Total estimatif projet"],
    ];
    const wsOverview = XLSX.utils.aoa_to_sheet(overview);
    wsOverview["!cols"] = [{ wch: 38 }, { wch: 22 }, { wch: 14 }, { wch: 54 }];
    wsOverview["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }];
    XLSX.utils.book_append_sheet(wb, wsOverview, "Synthèse");

    const ouvrageRows = [
      ["Poste", "Montant", "Unité montant", "Quantités principales", "Détails financiers"],
      ...activeRows.map((row) => [
        row.label,
        row.amount,
        currency,
        row.quantities.map(([key, value]) => quantityText(key, value)).join(" | "),
        row.financials.map(([key, value]) => quantityText(key, value)).join(" | "),
      ]),
      ["TOTAL", totalGeneral, currency, "", ""],
    ];
    const wsOuvrages = XLSX.utils.aoa_to_sheet(ouvrageRows);
    wsOuvrages["!cols"] = [{ wch: 28 }, { wch: 18 }, { wch: 14 }, { wch: 105 }, { wch: 80 }];
    XLSX.utils.book_append_sheet(wb, wsOuvrages, "Ouvrages");

    const detailRows = [
      ["Poste", "Élément", "Quantité", "Unité"],
      ...activeRows.flatMap((row) => row.entries.map(([key, value]) => [
        row.label,
        MATERIAL_LABELS[key] || key,
        Number(value || 0),
        MATERIAL_UNITS[key] || "",
      ])),
    ];
    const wsDetails = XLSX.utils.aoa_to_sheet(detailRows);
    wsDetails["!cols"] = [{ wch: 28 }, { wch: 32 }, { wch: 18 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, wsDetails, "Détails calculs");

    const materialData = [
      ["Matériau cumulé", "Quantité", "Unité"],
      ...materialRows.map(([key, value]) => [MATERIAL_LABELS[key] || key, Number(value || 0), MATERIAL_UNITS[key] || ""]),
    ];
    const wsMaterials = XLSX.utils.aoa_to_sheet(materialData);
    wsMaterials["!cols"] = [{ wch: 34 }, { wch: 18 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, wsMaterials, "Matériaux cumulés");

    XLSX.writeFile(wb, `ChantiLink_Devis_TP_${Date.now()}.xlsx`);
  };

  const exportToPDF = async () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const logoDataUrl = await createChantilinkLogoCanvas().catch(() => null);

    drawChantilinkHeader(doc, {
      logoDataUrl,
      title: "RÉCAPITULATIF GLOBAL TRAVAUX PUBLICS",
      subtitle: "Feuille de synthèse pour client / appel d'offre",
    });

    doc.setFillColor(243, 244, 246);
    doc.roundedRect(14, 38, pageW - 28, 20, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(75, 85, 99);
    doc.text("POSTES CHIFFRÉS", 20, 46);
    doc.text("MATÉRIAUX CUMULÉS", 95, 46);
    doc.text("TOTAL GLOBAL", 175, 46);
    doc.setFontSize(12);
    doc.setTextColor(17, 24, 39);
    doc.text(String(activeRows.length), 20, 53);
    doc.text(String(materialRows.length), 95, 53);
    doc.text(fmtPdfMoney(totalGeneral, currency), 175, 53);

    autoTable(doc, {
      startY: 66,
      head: [["Poste", "Quantités principales", "Détails coût", `Montant ${currency}`]],
      body: [
        ...activeRows.map((row) => [
          row.label,
          row.quantities.map(([key, value]) => quantityText(key, value)).join("\n") || "—",
          row.financials.map(([key, value]) => quantityText(key, value)).join("\n") || "—",
          fmtPdfMoney(row.amount, currency),
        ]),
        ["TOTAL GÉNÉRAL", "", "", fmtPdfMoney(totalGeneral, currency)],
      ],
      theme: "grid",
      headStyles: { fillColor: [17, 24, 39], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9 },
      styles: { fontSize: 8, cellPadding: 2.3, lineColor: [229, 231, 235], valign: "top" },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      columnStyles: {
        0: { cellWidth: 42, fontStyle: "bold" },
        1: { cellWidth: 103 },
        2: { cellWidth: 74 },
        3: { cellWidth: 36, halign: "right", fontStyle: "bold" },
      },
      margin: { left: 14, right: 14 },
    });

    doc.addPage();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(21, 128, 61);
    doc.text("MATÉRIAUX CUMULÉS", 14, 20);
    autoTable(doc, {
      startY: 28,
      head: [["Matériau / quantité cumulée", "Quantité", "Unité"]],
      body: materialRows.map(([key, value]) => [
        MATERIAL_LABELS[key] || key,
        fmtNum(value, key),
        MATERIAL_UNITS[key] || "",
      ]),
      theme: "grid",
      headStyles: { fillColor: [21, 128, 61], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 10 },
      styles: { fontSize: 10, cellPadding: 3, lineColor: [229, 231, 235] },
      alternateRowStyles: { fillColor: [240, 253, 244] },
      columnStyles: {
        0: { cellWidth: 142, fontStyle: "bold" },
        1: { cellWidth: 74, halign: "right", fontStyle: "bold" },
        2: { cellWidth: 34 },
      },
      margin: { left: 14, right: 14 },
    });

    if (financialRows.length) {
      doc.addPage();
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(249, 115, 22);
      doc.text("CUMULS FINANCIERS INTERNES", 14, 20);
      autoTable(doc, {
        startY: 28,
        head: [["Nature", "Montant"]],
        body: financialRows.map(([key, value]) => [MATERIAL_LABELS[key] || key, fmtPdfMoney(value, currency)]),
        theme: "grid",
        headStyles: { fillColor: [249, 115, 22], textColor: [255, 255, 255], fontStyle: "bold" },
        styles: { fontSize: 10, cellPadding: 3, lineColor: [229, 231, 235] },
        columnStyles: {
          0: { cellWidth: 160, fontStyle: "bold" },
          1: { cellWidth: 88, halign: "right", fontStyle: "bold" },
        },
        margin: { left: 14, right: 14 },
      });
    }

    addPdfFooters(doc, "ChantiLink - récapitulatif travaux publics");
    doc.save(`chantilink_recap_tp_${Date.now()}.pdf`);
  };

  const chartData = {
    labels: activeRows.map((row) => row.label),
    datasets: [{
      data: activeRows.map((row) => row.amount),
      backgroundColor: activeRows.map((row) => row.hex),
      borderColor: "#111827",
      borderWidth: 3,
    }],
  };

  return (
    <div className="h-full flex flex-col bg-gray-900 text-gray-100 overflow-hidden relative font-sans">
      <div className="flex-shrink-0 p-4 border-b border-gray-800 bg-gray-900/95 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-black text-white uppercase tracking-tight">Récapitulatif global TP</h2>
          <p className="text-xs text-gray-400">Document clair pour client, consultation ou appel d'offre.</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <button onClick={() => setShowChart((value) => !value)} className="flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 px-3 py-2 rounded-xl font-bold border border-gray-700 text-purple-300">
            <PieChart className="w-4 h-4" /> Analyse
          </button>
          <button onClick={exportToPDF} className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 px-3 py-2 rounded-xl font-bold">
            <FileDown className="w-4 h-4" /> PDF
          </button>
          <button onClick={exportToExcel} className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 px-3 py-2 rounded-xl font-bold">
            <FileSpreadsheet className="w-4 h-4" /> Excel
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-8 custom-scrollbar">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <SummaryCard label="Postes actifs" value={activeRows.length} unit="u" icon={<Layers />} color="text-orange-400" />
            <SummaryCard label="Matériaux suivis" value={materialRows.length} unit="lignes" icon={<Package />} color="text-emerald-400" />
            <SummaryCard label="Tonnage global" value={fmtNum(materialRows.find(([key]) => key === "tonnageTotal")?.[1] || 0)} unit="t" icon={<BarChart3 />} color="text-blue-300" />
            <SummaryCard label="Montant global" value={fmtMoney(totalGeneral, currency)} unit="" icon={<TrendingUp />} color="text-white" strong />
          </div>

          {showChart && activeRows.length > 0 && (
            <div className="bg-gray-800/50 border border-gray-700 rounded-3xl p-6">
              <div className="max-w-sm mx-auto">
                <Doughnut data={chartData} options={{ cutout: "72%", plugins: { legend: { position: "bottom", labels: { color: "#d1d5db", font: { weight: "bold" } } } } }} />
              </div>
            </div>
          )}

          <section className="bg-gray-800/40 border border-gray-700 rounded-3xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-700 bg-gray-800/70">
              <h3 className="text-sm font-black text-white uppercase tracking-widest">Feuille de récapitulation par ouvrage</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="bg-gray-950/70 text-xs uppercase text-gray-400">
                  <tr>
                    <th className="px-4 py-3 text-left">Poste</th>
                    <th className="px-4 py-3 text-left">Quantités principales</th>
                    <th className="px-4 py-3 text-left">Détails financiers</th>
                    <th className="px-4 py-3 text-right">Montant</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {activeRows.map((row) => (
                    <tr key={row.id} className="align-top">
                      <td className="px-4 py-4 font-black text-white">
                        <span className="mr-2">{row.icon}</span>{row.label}
                      </td>
                      <td className="px-4 py-4 text-gray-300 leading-6">
                        {row.quantities.length ? row.quantities.map(([key, value], index) => (
                          <span key={`${row.id}-${key}-${index}`} className="mr-3 inline-block">{quantityText(key, value)}</span>
                        )) : "—"}
                      </td>
                      <td className="px-4 py-4 text-gray-400 leading-6">
                        {row.financials.length ? row.financials.map(([key, value], index) => (
                          <span key={`${row.id}-${key}-${index}`} className="mr-3 inline-block">{quantityText(key, value)}</span>
                        )) : "—"}
                      </td>
                      <td className="px-4 py-4 text-right font-mono font-black text-orange-300">{fmtMoney(row.amount, currency)}</td>
                    </tr>
                  ))}
                  <tr className="bg-orange-500/10">
                    <td className="px-4 py-5 font-black text-orange-200 uppercase">Total général</td>
                    <td />
                    <td />
                    <td className="px-4 py-5 text-right font-mono text-xl font-black text-white">{fmtMoney(totalGeneral, currency)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="bg-gray-800/40 border border-gray-700 rounded-3xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-700 bg-emerald-500/10">
                <h3 className="text-sm font-black text-emerald-300 uppercase tracking-widest">Matériaux cumulés</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4">
                {materialRows.length ? materialRows.map(([key, value]) => (
                  <MetricTile key={key} label={MATERIAL_LABELS[key] || key} value={fmtNum(value, key)} unit={MATERIAL_UNITS[key] || ""} />
                )) : <p className="col-span-2 py-8 text-center text-sm text-gray-500">Aucun matériau calculé.</p>}
              </div>
            </div>

            <div className="bg-gray-800/40 border border-gray-700 rounded-3xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-700 bg-orange-500/10">
                <h3 className="text-sm font-black text-orange-300 uppercase tracking-widest">Cumuls financiers internes</h3>
              </div>
              <div className="space-y-2 p-4">
                {financialRows.length ? financialRows.map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between rounded-2xl border border-gray-700 bg-gray-950/60 px-4 py-3">
                    <span className="text-sm text-gray-300">{MATERIAL_LABELS[key] || key}</span>
                    <span className="font-mono font-black text-white">{fmtMoney(value, currency)}</span>
                  </div>
                )) : <p className="py-8 text-center text-sm text-gray-500">Aucun détail financier interne.</p>}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, unit, icon, color, strong = false }) {
  return (
    <div className="bg-gray-800/50 border border-gray-700 p-5 rounded-3xl flex items-center gap-4">
      <div className={`p-3 rounded-2xl bg-gray-950/70 border border-gray-700 ${color}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">{label}</p>
        <p className={`${strong ? "text-xl" : "text-2xl"} font-black truncate`}>
          {value} <span className="text-xs font-normal opacity-40">{unit}</span>
        </p>
      </div>
    </div>
  );
}

function MetricTile({ label, value, unit }) {
  return (
    <div className="rounded-2xl border border-gray-700 bg-gray-950/60 p-4">
      <p className="truncate text-[10px] font-black uppercase tracking-widest text-gray-500">{label}</p>
      <p className="mt-1 font-mono text-lg font-black text-white">
        {value} <span className="text-xs font-normal text-gray-500">{unit}</span>
      </p>
    </div>
  );
}
