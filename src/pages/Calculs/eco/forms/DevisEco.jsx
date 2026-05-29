import React, { useMemo } from "react";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Download, FileSpreadsheet, FileText, Leaf, Package, Table2 } from "lucide-react";
import {
  addPdfFooters,
  createChantilinkLogoCanvas,
  drawChantilinkHeader,
  fmtPdfMoney,
} from "../../utils/exportBranding";

const STEP_LABELS = {
  terrassement: "Gestion terres / sols",
  fondation: "Béton bas carbone",
  energie: "Énergie & CO2",
  eau: "Eau & réemploi",
  materiaux: "Matériaux durables",
  dechets: "Déchets & recyclage",
  transport: "Transport bas carbone",
};

const MATERIAL_LABELS = {
  volume: "Volume",
  volumeFoisonne: "Volume foisonné",
  volumeEvacue: "Volume évacué",
  volumeDepot: "Mise en dépôt",
  volumeRemblai: "Remblai",
  volumeApport: "Apport estimé",
  poids: "Terre / poids",
  surface: "Surface",
  nombreCamions: "Rotations camions",
  ciment: "Ciment bas carbone",
  sable: "Sable recyclé",
  gravier: "Gravier recyclé",
  acier: "Acier",
  bois: "Bois / biosourcé",
  blocs: "Blocs / agglos",
  materiauxDurables: "Matériaux durables",
  coffrage: "Coffrage",
  eau: "Eau",
  eauRecyclee: "Eau réutilisée",
  eauEconomisee: "Économie d'eau",
  eauNette: "Eau neuve nette",
  tauxReemploiEau: "Taux réemploi eau",
  distance: "Distance transport",
  tonneKm: "Tonnes-kilomètres",
  co2: "Émissions CO2",
  co2Evite: "CO2 évité",
  kwh: "Énergie consommée",
  carburant: "Carburant",
  m3: "Eau consommée",
  dechets: "Déchets",
  recyclage: "Déchets recyclables",
  dechetsEvacues: "Déchets évacués",
  tauxRecyclage: "Taux recyclage",
};

const MATERIAL_UNITS = {
  volume: "m³",
  volumeFoisonne: "m³",
  volumeEvacue: "m³",
  volumeDepot: "m³",
  volumeRemblai: "m³",
  volumeApport: "m³",
  poids: "t",
  surface: "m²",
  nombreCamions: "u",
  ciment: "t",
  sable: "t",
  gravier: "t",
  acier: "t",
  bois: "m³",
  blocs: "u",
  materiauxDurables: "u/t/m³",
  coffrage: "m²",
  eau: "L",
  eauRecyclee: "m³",
  eauEconomisee: "m³",
  eauNette: "m³",
  tauxReemploiEau: "%",
  distance: "km",
  tonneKm: "t.km",
  co2: "kg CO2e",
  co2Evite: "kg CO2e",
  kwh: "kWh",
  carburant: "L",
  m3: "m³",
  dechets: "t",
  recyclage: "t",
  dechetsEvacues: "t",
  tauxRecyclage: "%",
};

const RATIO_KEYS = new Set(["tauxReemploiEau", "tauxRecyclage"]);

const fmt = (value, digits = 2) => Number(value || 0).toFixed(digits);
const money = (value, currency) => `${Number(value || 0).toLocaleString("fr-FR")} ${currency}`;

const digitsFor = (key) => {
  if (key === "eau") return 0;
  if (key === "co2" || key === "co2Evite" || key === "acier") return 3;
  if (RATIO_KEYS.has(key)) return 1;
  return 2;
};

const materialText = (materials = {}) => {
  const entries = Object.entries(materials)
    .filter(([key, value]) => MATERIAL_LABELS[key] && Number(value || 0) > 0)
    .map(([key, value]) => {
      return `${MATERIAL_LABELS[key]}: ${fmt(value, digitsFor(key))} ${MATERIAL_UNITS[key] || ""}`;
    });
  return entries.length ? entries.join(" | ") : "—";
};

const buildRows = ({ costs = {}, quantites = {} }) =>
  Object.keys(STEP_LABELS).map((id) => ({
    id,
    poste: STEP_LABELS[id],
    materials: quantites[id] || {},
    amount: Number(costs[id] || 0),
  }));

const buildMaterialTotals = (quantites = {}) => {
  const ratioCounts = {};
  const totals = Object.values(quantites || {}).reduce((acc, materials) => {
    Object.entries(materials || {}).forEach(([key, value]) => {
      const n = Number(value || 0);
      if (n <= 0) return;
      if (RATIO_KEYS.has(key)) {
        acc[key] = (acc[key] || 0) + n;
        ratioCounts[key] = (ratioCounts[key] || 0) + 1;
        return;
      }
      acc[key] = (acc[key] || 0) + n;
    });
    return acc;
  }, {});

  Object.entries(ratioCounts).forEach(([key, count]) => {
    if (count > 0) totals[key] = totals[key] / count;
  });

  return totals;
};

export default function DevisEco({
  currency = "XOF",
  costs = {},
  quantitesParOuvrage = {},
  totalGeneral = 0,
}) {
  const rows = useMemo(
    () => buildRows({ costs, quantites: quantitesParOuvrage }),
    [costs, quantitesParOuvrage]
  );

  const materialRows = useMemo(() =>
    Object.entries(buildMaterialTotals(quantitesParOuvrage))
      .filter(([, value]) => Number(value || 0) > 0)
      .sort(([a], [b]) => (MATERIAL_LABELS[a] || a).localeCompare(MATERIAL_LABELS[b] || b)),
  [quantitesParOuvrage]);

  const activeRows = rows.filter((row) => row.amount > 0 || materialText(row.materials) !== "—");

  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();
    const synthese = [
      ["CHANTILINK - DEVIS ECOLOGIQUE", "", "", ""],
      [`Date : ${new Date().toLocaleDateString("fr-FR")}`, "", "", ""],
      [""],
      ["Indicateur", "Valeur", "Unité", "Observation"],
      ["Postes calculés", activeRows.length, "u", "Détail dans l'onglet Récap global"],
      ["Matériaux cumulés", materialRows.length, "u", "Détail dans l'onglet Matériaux cumulés"],
      ["Total général", totalGeneral, currency, "Montant global estimatif"],
    ];
    const ws0 = XLSX.utils.aoa_to_sheet(synthese);
    ws0["!cols"] = [{ wch: 30 }, { wch: 18 }, { wch: 14 }, { wch: 48 }];
    ws0["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }];
    XLSX.utils.book_append_sheet(wb, ws0, "Synthèse");

    const recap = [
      ["Poste", "Quantités / matériaux calculés", `Montant (${currency})`],
      ...activeRows.map((row) => [row.poste, materialText(row.materials), row.amount]),
      ["TOTAL", "", totalGeneral],
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(recap);
    ws1["!cols"] = [{ wch: 28 }, { wch: 90 }, { wch: 20 }];
    ws1["!autofilter"] = { ref: `A1:C${Math.max(1, recap.length)}` };
    XLSX.utils.book_append_sheet(wb, ws1, "Récap global");

    const materials = [
      ["Matériau cumulé", "Quantité", "Unité"],
      ...materialRows.map(([key, value]) => [
        MATERIAL_LABELS[key] || key,
        Number(value || 0),
        MATERIAL_UNITS[key] || "",
      ]),
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(materials);
    ws2["!cols"] = [{ wch: 30 }, { wch: 16 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws2, "Matériaux cumulés");

    XLSX.writeFile(wb, `devis_eco_${Date.now()}.xlsx`);
  };

  const exportToPDF = async () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const logoDataUrl = await createChantilinkLogoCanvas().catch(() => null);

    drawChantilinkHeader(doc, {
      logoDataUrl,
      title: "DEVIS ECOLOGIQUE",
      subtitle: "Récapitulatif global environnemental",
    });

    doc.setFillColor(243, 244, 246);
    doc.roundedRect(14, 38, pageWidth - 28, 18, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(75, 85, 99);
    doc.text("POSTES", 20, 46);
    doc.text("MATERIAUX", 96, 46);
    doc.text("TOTAL GENERAL", 172, 46);
    doc.setFontSize(11);
    doc.setTextColor(17, 24, 39);
    doc.text(String(activeRows.length), 20, 52);
    doc.text(String(materialRows.length), 96, 52);
    doc.text(fmtPdfMoney(totalGeneral, currency), 172, 52);

    autoTable(doc, {
      startY: 64,
      head: [["Poste", "Quantités / matériaux calculés", `Montant ${currency}`]],
      body: [
        ...activeRows.map((row) => [
          row.poste,
          materialText(row.materials),
          row.amount ? fmtPdfMoney(row.amount, currency) : "—",
        ]),
        ["TOTAL", "", fmtPdfMoney(totalGeneral, currency)],
      ],
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 2.6, lineColor: [229, 231, 235], valign: "top" },
      headStyles: { fillColor: [21, 128, 61], textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [240, 253, 244] },
      columnStyles: {
        0: { cellWidth: 54, fontStyle: "bold" },
        1: { cellWidth: 164 },
        2: { cellWidth: 59, halign: "right", fontStyle: "bold" },
      },
      margin: { left: 10, right: 10 },
      didParseCell: (data) => {
        if (data.row.index === activeRows.length) {
          data.cell.styles.fillColor = [220, 252, 231];
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.textColor = [20, 83, 45];
        }
      },
    });

    doc.addPage();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(21, 128, 61);
    doc.text("MATERIAUX CUMULES", 10, 18);
    autoTable(doc, {
      startY: 26,
      head: [["Matériau cumulé", "Quantité", "Unité"]],
      body: materialRows.map(([key, value]) => [
        MATERIAL_LABELS[key] || key,
        fmt(value, digitsFor(key)),
        MATERIAL_UNITS[key] || "",
      ]),
      theme: "grid",
      styles: { fontSize: 11, cellPadding: 3.5, lineColor: [229, 231, 235] },
      headStyles: { fillColor: [21, 128, 61], textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [240, 253, 244] },
      columnStyles: {
        0: { cellWidth: 145, fontStyle: "bold" },
        1: { cellWidth: 85, halign: "right" },
        2: { cellWidth: 47 },
      },
      margin: { left: 10, right: 10 },
    });

    addPdfFooters(doc, "ChantiLink - devis écologique");
    doc.save(`devis_eco_${Date.now()}.pdf`);
  };

  return (
    <div className="h-full overflow-y-auto bg-gray-900 text-white p-5 space-y-5">
      <section className="rounded-2xl border border-green-500/20 bg-gradient-to-br from-gray-800 to-green-950/30 p-5">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <p className="text-[10px] text-green-300 font-bold uppercase tracking-widest flex items-center gap-2">
              <Leaf className="w-4 h-4" /> Synthèse écologique
            </p>
            <h1 className="text-2xl font-black">Devis écologique global</h1>
            <p className="text-xs text-gray-400 mt-1">Récupération automatique des calculs de chaque étape Eco.</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-gray-500 uppercase font-bold">Total général</p>
            <p className="text-2xl font-black text-green-300 font-mono">{money(totalGeneral, currency)}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-col sm:flex-row gap-3">
          <button onClick={exportToPDF} disabled={!activeRows.length}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 px-4 py-3 text-sm font-bold transition">
            <FileText className="w-4 h-4" /> Export PDF
          </button>
          <button onClick={exportToExcel} disabled={!activeRows.length}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 disabled:bg-gray-700 disabled:text-gray-500 px-4 py-3 text-sm font-bold transition">
            <FileSpreadsheet className="w-4 h-4" /> Export Excel
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-700 bg-gray-800 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-700 flex items-center gap-2">
          <Table2 className="w-4 h-4 text-green-400" />
          <h2 className="text-xs font-bold uppercase tracking-widest text-green-300">Récapitulatif par poste</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-900/70 text-[10px] uppercase tracking-widest text-gray-400">
              <tr>
                <th className="px-4 py-3 text-left">Poste</th>
                <th className="px-4 py-3 text-left">Quantités / matériaux</th>
                <th className="px-4 py-3 text-right">Montant</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {activeRows.length === 0 ? (
                <tr><td colSpan={3} className="px-4 py-8 text-center text-xs text-gray-500 italic">Les calculs Eco apparaîtront ici automatiquement.</td></tr>
              ) : activeRows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-700/30">
                  <td className="px-4 py-3 font-bold text-white">{row.poste}</td>
                  <td className="px-4 py-3 text-xs text-gray-300 font-mono">{materialText(row.materials)}</td>
                  <td className="px-4 py-3 text-right font-mono font-black text-green-300">{row.amount ? money(row.amount, currency) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-700 bg-gray-800 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-700 flex items-center gap-2">
          <Package className="w-4 h-4 text-emerald-400" />
          <h2 className="text-xs font-bold uppercase tracking-widest text-emerald-300">Matériaux et indicateurs cumulés</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4">
          {materialRows.length === 0 ? (
            <p className="text-xs text-gray-500 italic">Aucun cumul disponible.</p>
          ) : materialRows.map(([key, value]) => (
            <div key={key} className="rounded-xl border border-gray-700 bg-gray-900/70 p-3 flex items-center justify-between gap-3">
              <span className="text-xs font-bold text-gray-300">{MATERIAL_LABELS[key] || key}</span>
              <span className="text-xs font-mono font-black text-white">
                {fmt(value, digitsFor(key))} {MATERIAL_UNITS[key] || ""}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
