import React, { useState, useEffect, useMemo } from 'react';
import { Doughnut, Bar } from "react-chartjs-2";
import {
  Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement
} from "chart.js";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { 
  FileText, Download, Calculator, Settings2, Package, 
  ChevronRight, TrendingUp, Printer, Trash2, Save 
} from "lucide-react";

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

const STORAGE_KEY_PRICES = "batiment-unit-prices";
const CHANTILINK_LOGO_URL = "/chantilink-logo.png";

const loadImageDataUrl = async (src) => {
  const response = await fetch(src);
  if (!response.ok) throw new Error(`Image introuvable: ${src}`);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

const drawRoundRect = (ctx, x, y, width, height, radius) => {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
};

const createLogoCanvasDataUrl = async (src) => {
  const imageDataUrl = await loadImageDataUrl(src);
  const image = new Image();
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = reject;
    image.src = imageDataUrl;
  });

  const canvas = document.createElement("canvas");
  canvas.width = 900;
  canvas.height = 260;
  const ctx = canvas.getContext("2d");

  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, "#111827");
  gradient.addColorStop(1, "#1f2937");
  ctx.fillStyle = gradient;
  drawRoundRect(ctx, 0, 0, canvas.width, canvas.height, 34);
  ctx.fill();

  ctx.fillStyle = "#f97316";
  drawRoundRect(ctx, 26, 26, 10, 208, 5);
  ctx.fill();

  const box = 204;
  const scale = Math.min(box / image.width, box / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  ctx.drawImage(image, 54 + (box - width) / 2, 28 + (box - height) / 2, width, height);

  ctx.fillStyle = "#ffffff";
  ctx.font = "800 72px Arial";
  ctx.fillText("CHANTILINK", 306, 116);
  ctx.fillStyle = "#f97316";
  ctx.font = "700 24px Arial";
  ctx.fillText("Construction • Devis • Quantitatifs", 310, 162);
  ctx.fillStyle = "#d1d5db";
  ctx.font = "400 22px Arial";
  ctx.fillText("Document généré automatiquement", 310, 202);

  return canvas.toDataURL("image/png", 1);
};

const drawPdfPageHeader = (doc, { logoDataUrl, pageW, pageRight, title, subtitle, dateText }) => {
  if (logoDataUrl) {
    doc.addImage(logoDataUrl, "PNG", 14, 10, 74, 22);
  }

  doc.setFillColor(249, 115, 22);
  doc.rect(pageRight, 10, 3, 22, "F");
  doc.setTextColor(17, 24, 39);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text(title, pageRight - 4, 17, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(107, 114, 128);
  doc.text(dateText, pageRight - 4, 23, { align: "right" });
  doc.text(subtitle, pageRight - 4, 29, { align: "right" });
};

const MATERIAL_LABELS = {
  volume: "Béton / volume",
  ciment: "Ciment",
  sable: "Sable",
  gravier: "Gravier",
  acier: "Acier",
  eau: "Eau",
  blocs: "Agglos / blocs",
  mortier: "Mortier",
  coffrage: "Coffrage",
  bois: "Bois",
  couverture: "Couverture",
  etancheite: "Étanchéité",
  peinture: "Peinture",
  revetement: "Revêtement",
  enduit: "Enduit",
  colle: "Colle",
  joint: "Joint",
};

const MATERIAL_UNITS = {
  volume: "m³",
  ciment: "t",
  sable: "t/m³",
  gravier: "t",
  acier: "t",
  eau: "L",
  blocs: "u",
  mortier: "m³",
  coffrage: "m²",
  bois: "m³",
  couverture: "u/m²",
  etancheite: "m²",
  peinture: "L",
  revetement: "m²",
  enduit: "kg",
  colle: "kg",
  joint: "kg",
};

const STEP_LABELS = {
  terrassement: "Terrassement",
  fondation: "Fondations",
  elevation: "Élévation / Structure",
  toiture: "Toiture / Charpente",
  finitions: "Finitions",
  divers: "Divers / Outils",
};

const FONDATION_LABELS = {
  FILANTE: "Semelles filantes",
  ISOLEE: "Semelles isolées",
  RADIER: "Radier",
  MASSIF: "Massifs",
  LONGRINE: "Longrines de fondation",
};

const fmtNum = (n, d = 2) => Number(n || 0).toFixed(d);
const fmtMoney = (n, currency) => `${Number(n || 0).toLocaleString("fr-FR")} ${currency}`;
const fmtPdfMoney = (n, currency) =>
  Number(n || 0).toLocaleString("fr-FR").replace(/\s/g, ".") + ` ${currency}`;

const q = (label, value, unit, dec = 2) =>
  Number(value || 0) > 0 ? { label, value: Number(value || 0), unit, dec } : null;

const compact = (items) => items.filter(Boolean);

const formatQte = (items) => {
  const clean = compact(items || []);
  return clean.length
    ? clean.map((item) => `${item.label}: ${fmtNum(item.value, item.dec)} ${item.unit}`).join(" | ")
    : "—";
};

const formatMaterials = (mat = {}) => {
  const items = Object.entries(mat)
    .filter(([key, value]) => MATERIAL_LABELS[key] && Number(value || 0) > 0)
    .map(([key, value]) => {
      const dec = key === "acier" ? 3 : key === "eau" ? 0 : 2;
      return `${MATERIAL_LABELS[key]}: ${fmtNum(value, dec)} ${MATERIAL_UNITS[key] || ""}`;
    });
  return items.length ? items.join(" | ") : "—";
};

const hasData = (obj = {}) =>
  Object.values(obj).some((v) => Number(v || 0) > 0 || (typeof v === "string" && v.length > 0));

const buildClientRows = ({ costs = {}, quantites = {}, subResults = {} }) => {
  const rows = [];
  const usedAmountKeys = new Set();
  const add = (poste, designation, qtes, amountKey, fallbackAmount = 0, materials = null) => {
    const rawAmount = Number(costs[amountKey] || fallbackAmount || 0);
    const amount = usedAmountKeys.has(amountKey) ? 0 : rawAmount;
    if (rawAmount > 0) usedAmountKeys.add(amountKey);

    rows.push({
      poste,
      designation,
      qtes: formatQte(qtes),
      materials: formatMaterials(materials || quantites[amountKey] || {}),
      amount,
    });
  };

  const terrassement = subResults.terrassement || {};
  if (hasData(terrassement)) {
    add("Terrassement", "Travaux de terrassement", [
      q("Déblais", terrassement.totalDeblai, "m³"),
      q("Déblais foisonnés", terrassement.totalFoisonne, "m³"),
      q("Remblais", terrassement.totalRemblai, "m³"),
      q("Plateforme", terrassement.surfacePlateforme, "m²"),
    ], "terrassement");
  }

  const fondation = subResults.fondation || {};
  if (hasData(fondation)) {
    add("Fondations", FONDATION_LABELS[fondation.typeFondation] || "Travaux de fondation", [
      q("Béton BA", fondation.volumeBetonFondation, "m³"),
      q("Béton propreté", fondation.volumeBetonProprete, "m³"),
      q("Surface support", fondation.surfaceSupport, "m²"),
      q("Coffrage", fondation.surfaceCoffrage, "m²"),
      q("Acier", fondation.acierKg, "kg", 0),
    ], "fondation");
  }

  [
    ["murs", "Maçonnerie agglos / murs", [
      q("Surface nette", subResults.murs?.surfaceNette, "m²"),
      q("Agglos", subResults.murs?.nbBlocs, "u", 0),
      q("Mortier", subResults.murs?.mortierM3, "m³"),
    ]],
    ["poteaux", "Poteaux béton armé", [
      q("Nombre", subResults.poteaux?.nombre, "u", 0),
      q("Béton", subResults.poteaux?.volumeTotal, "m³"),
      q("Coffrage", subResults.poteaux?.surfaceCoffrage, "m²"),
      q("Acier", subResults.poteaux?.acierKg, "kg", 0),
    ]],
    ["longrines", "Chaînages", [
      q("Nombre", subResults.longrines?.nombre, "u", 0),
      q("Béton", subResults.longrines?.volumeCommande, "m³"),
      q("Coffrage", subResults.longrines?.surfaceCoffrage, "m²"),
      q("Acier", subResults.longrines?.acierKg, "kg", 0),
    ]],
    ["linteaux", "Linteaux", [
      q("Nombre", subResults.linteaux?.nombre, "u", 0),
      q("Béton", subResults.linteaux?.volumeTotal, "m³"),
      q("Coffrage", subResults.linteaux?.surfaceCoffrage, "m²"),
      q("Acier", subResults.linteaux?.acierKg, "kg", 0),
    ]],
    ["poutres", "Poutres béton armé", [
      q("Nombre", subResults.poutres?.nombre, "u", 0),
      q("Béton", subResults.poutres?.volumeFinal, "m³"),
      q("Coffrage", subResults.poutres?.surfaceCoffrage, "m²"),
      q("Acier", subResults.poutres?.acierKg, "kg", 0),
    ]],
    ["dalles", "Dalles / planchers", [
      q("Surface", subResults.dalles?.surface, "m²"),
      q("Béton", subResults.dalles?.volumeFinal, "m³"),
      q("Coffrage", subResults.dalles?.surfaceCoffrage, "m²"),
      q("Poutrelles", subResults.dalles?.lineairePoutrelles, "ml"),
    ]],
    ["escaliers", "Escaliers béton armé", [
      q("Marches", subResults.escaliers?.nbMarches, "u", 0),
      q("Béton", subResults.escaliers?.volumeTotal, "m³"),
      q("Coffrage", subResults.escaliers?.surfaceCoffrage, "m²"),
      q("Acier", subResults.escaliers?.acierKg, "kg", 0),
    ]],
  ].forEach(([key, label, qtes]) => {
    if (compact(qtes).length) add("Élévation / Structure", label, qtes, "elevation", 0, quantites.elevation);
  });

  const toiture = subResults.toiture || {};
  if (hasData(toiture)) {
    add("Toiture / Charpente", "Toiture, charpente et couverture", [
      q("Surface projetée", toiture.surfaceProjetee, "m²"),
      q("Surface réelle", toiture.surfaceReelle, "m²"),
      q("Couverture", toiture.couverture, "u/m²"),
      q("Bois", toiture.boisM3, "m³"),
      q("Étanchéité", toiture.etancheiteM2, "m²"),
    ], "toiture", 0, quantites.toiture);
  }

  const finitions = subResults.finitions || {};
  if (hasData(finitions)) {
    add("Finitions", "Revêtements et finitions", [
      q("Surface", finitions.surface, "m²"),
      q("Peinture", finitions.peinture, "L"),
      q("Revêtement", finitions.revetement, "m²"),
      q("Enduit", finitions.enduit, "kg"),
      q("Colle", finitions.colle, "kg"),
    ], "finitions", 0, quantites.finitions);
  }

  const divers = subResults.divers || {};
  if (hasData(divers)) {
    add("Divers / Outils", "Outillage & matériel de chantier", [
      q("Outillage", divers.outillage, "XOF"),
      q("Achat matériel", divers.achat, "XOF"),
      q("Location matériel", divers.location, "XOF"),
      q("Lignes", divers.lignes, "u", 0),
    ], "divers", 0, quantites.divers);
  }

  if (!rows.length) {
    Object.entries(costs).forEach(([id, amount]) => {
      const mat = quantites[id] || {};
      if (amount > 0) add(STEP_LABELS[id] || id, STEP_LABELS[id] || id, [
        q("Volume", mat.volume, "m³"),
        q("Surface", mat.surface, "m²"),
        q("Ciment", mat.ciment, "t"),
        q("Acier", mat.acier, "t", 3),
      ], id, amount, mat);
    });
  }

  return rows;
};

export default function Devis({ currency = "XOF", costs, quantitesParEtape, totalGeneral, subResults = {} }) {
  
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
    const total = {};
    Object.values(quantitesParEtape).forEach(stepMats => {
      if (!stepMats) return;
      Object.entries(stepMats).forEach(([key, value]) => {
        const n = Number(value || 0);
        if (n > 0) total[key] = (total[key] || 0) + n;
      });
    });
    return total;
  }, [quantitesParEtape]);

  const materialRows = useMemo(() =>
    Object.entries(cumulMateriaux)
      .filter(([, value]) => Number(value || 0) > 0)
      .sort(([a], [b]) => (MATERIAL_LABELS[a] || a).localeCompare(MATERIAL_LABELS[b] || b)),
  [cumulMateriaux]);

  const clientRows = useMemo(() =>
    buildClientRows({ costs, quantites: quantitesParEtape, subResults }),
  [costs, quantitesParEtape, subResults]);

  // Sauvegarde des prix
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_PRICES, JSON.stringify(prixUnitaires));
  }, [prixUnitaires]);

  // --- EXPORTS ---
  const exportPDF = async () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const pageRight = pageW - 14;
    const logoDataUrl = await createLogoCanvasDataUrl(CHANTILINK_LOGO_URL).catch(() => null);
    const header = {
      logoDataUrl,
      pageW,
      pageRight,
      title: "DEVIS ESTIMATIF BATIMENT",
      subtitle: "Feuille de récapitulation globale des ouvrages",
      dateText: `Généré le ${new Date().toLocaleDateString("fr-FR")}`,
    };

    drawPdfPageHeader(doc, header);

    doc.setFillColor(243, 244, 246);
    doc.roundedRect(14, 38, pageW - 28, 18, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(75, 85, 99);
    doc.text("OUVRAGES", 20, 46);
    doc.text("MATERIAUX", 96, 46);
    doc.text("TOTAL GENERAL", 172, 46);
    doc.setFontSize(11);
    doc.setTextColor(17, 24, 39);
    doc.text(String(clientRows.length), 20, 52);
    doc.text(String(materialRows.length), 96, 52);
    doc.text(fmtPdfMoney(totalGeneral, currency), 172, 52);
    
    autoTable(doc, {
      startY: 64,
      head: [['POSTE', 'DÉSIGNATION DES OUVRAGES', 'QUANTITÉS', 'MATÉRIAUX', `MONTANT ${currency}`]],
      body: [
        ...clientRows.map((r) => [r.poste, r.designation, r.qtes, r.materials, r.amount ? fmtPdfMoney(r.amount, currency) : "—"]),
        [{ content: 'TOTAL GÉNÉRAL', colSpan: 4, styles: { fontStyle: 'bold', halign: 'right' } }, { content: fmtPdfMoney(totalGeneral, currency), styles: { fontStyle: 'bold' } }],
      ],
      theme: 'grid',
      headStyles: { fillColor: [17, 24, 39], textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      styles: { fontSize: 7, cellPadding: 2.2, lineColor: [229, 231, 235], lineWidth: 0.2, valign: "top" },
      columnStyles: {
        0: { cellWidth: 34, fontStyle: "bold", textColor: [30, 64, 175] },
        1: { cellWidth: 46 },
        2: { cellWidth: 67 },
        3: { cellWidth: 78 },
        4: { cellWidth: 39, halign: "right", fontStyle: "bold" },
      },
      margin: { left: 14, right: 14 },
    });

    doc.addPage();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(21, 128, 61);
    doc.text("MATÉRIAUX CUMULÉS", 10, 18);

    autoTable(doc, {
      startY: 26,
      head: [["MATÉRIAU CUMULÉ", "QUANTITÉ", "UNITÉ"]],
      body: materialRows.map(([key, value]) => [
        MATERIAL_LABELS[key] || key,
        Number(value || 0).toFixed(key === "acier" ? 3 : 2),
        MATERIAL_UNITS[key] || "",
      ]),
      theme: "grid",
      headStyles: { fillColor: [21, 128, 61], textColor: [255, 255, 255], fontSize: 11 },
      styles: { fontSize: 11, cellPadding: 3.5, lineColor: [229, 231, 235], lineWidth: 0.2 },
      alternateRowStyles: { fillColor: [240, 253, 244] },
      columnStyles: {
        0: { cellWidth: 145, fontStyle: "bold" },
        1: { cellWidth: 85, halign: "right", fontStyle: "bold" },
        2: { cellWidth: 47 },
      },
      margin: { left: 10, right: 10 },
    });

    const pages = doc.internal.getNumberOfPages();
    for (let page = 1; page <= pages; page += 1) {
      doc.setPage(page);
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text("ChantiLink - document de synthese quantitatif et estimatif", 14, pageH - 8);
      doc.text(`Page ${page}/${pages}`, pageRight, pageH - 8, { align: "right" });
    }

    doc.save("Devis_Projet_Batiment.pdf");
  };

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    const summary = [
      ["CHANTILINK - DEVIS ESTIMATIF BATIMENT", "", "", ""],
      [`Date : ${new Date().toLocaleDateString("fr-FR")}`, "", "", ""],
      [""],
      ["Indicateur", "Valeur", "Unité", "Observation"],
      ["Nombre d'ouvrages", clientRows.length, "u", "Lignes détaillées dans l'onglet Ouvrages"],
      ["Matériaux cumulés", materialRows.length, "u", "Lignes détaillées dans l'onglet Matériaux"],
      ["Total général", totalGeneral, currency, "Montant global estimatif"],
    ];
    const ws0 = XLSX.utils.aoa_to_sheet(summary);
    ws0["!cols"] = [{ wch: 34 }, { wch: 18 }, { wch: 14 }, { wch: 46 }];
    ws0["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }];
    XLSX.utils.book_append_sheet(wb, ws0, "Synthèse");

    const ouvrages = [
      ["CHANTILINK", "", "", "", ""],
      ["RÉCAPITULATIF GLOBAL DES OUVRAGES", "", "", "", ""],
      [`Date : ${new Date().toLocaleDateString("fr-FR")}`, "", "", ""],
      [""],
      ["Poste", "Désignation des ouvrages", "Quantités calculées", "Matériaux par ouvrage", `Montant (${currency})`],
      ...clientRows.map((r) => [r.poste, r.designation, r.qtes, r.materials, r.amount]),
      ["TOTAL GÉNÉRAL", "", "", "", totalGeneral],
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(ouvrages);
    ws1["!cols"] = [{ wch: 24 }, { wch: 34 }, { wch: 70 }, { wch: 80 }, { wch: 20 }];
    ws1["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } },
    ];
    ws1["!autofilter"] = { ref: `A5:E${Math.max(5, ouvrages.length)}` };
    XLSX.utils.book_append_sheet(wb, ws1, "Récap global");

    const materiaux = [
      ["CHANTILINK - CUMUL GLOBAL DES MATÉRIAUX", "", ""],
      [""],
      ["Matériau cumulé", "Quantité", "Unité"],
      ...materialRows.map(([key, value]) => [
        MATERIAL_LABELS[key] || key,
        Number(value || 0),
        MATERIAL_UNITS[key] || "",
      ]),
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(materiaux);
    ws2["!cols"] = [{ wch: 28 }, { wch: 16 }, { wch: 12 }];
    ws2["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }];
    ws2["!autofilter"] = { ref: `A3:C${Math.max(3, materiaux.length)}` };
    XLSX.utils.book_append_sheet(wb, ws2, "Matériaux cumulés");

    const raw = [
      ["POSTE", "DÉSIGNATION", "QUANTITÉS", "MATÉRIAUX", `MONTANT (${currency})`],
      ...clientRows.map((r) => [r.poste, r.designation, r.qtes, r.materials, r.amount]),
    ];
    const ws3 = XLSX.utils.aoa_to_sheet(raw);
    ws3["!cols"] = [{ wch: 24 }, { wch: 34 }, { wch: 70 }, { wch: 80 }, { wch: 20 }];
    ws3["!autofilter"] = { ref: `A1:E${Math.max(1, raw.length)}` };
    XLSX.utils.book_append_sheet(wb, ws3, "Données PDF");

    XLSX.writeFile(wb, `devis_batiment_${Date.now()}.xlsx`);
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
            <div className="lg:col-span-8 space-y-4">
              <div className="bg-gray-800/70 rounded-2xl border border-blue-500/20 p-5 shadow-xl">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                  <div>
                    <p className="text-[10px] text-blue-300 font-bold uppercase tracking-widest">Feuille de récapitulation globale</p>
                    <h3 className="text-xl font-black text-white">Récapitulatif des ouvrages</h3>
                    <p className="text-xs text-gray-400 mt-1">Présentation claire pour client, devis estimatif ou appel d'offre.</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-gray-500 uppercase font-bold">Total général</p>
                    <p className="text-2xl font-black text-blue-300 font-mono">{fmtMoney(totalGeneral, currency)}</p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden shadow-xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-750 text-[10px] uppercase tracking-widest text-gray-400 font-bold border-b border-gray-700">
                      <th className="px-4 py-4">Poste</th>
                      <th className="px-4 py-4">Désignation de l'ouvrage</th>
                      <th className="px-4 py-4">Quantités calculées</th>
                      <th className="px-4 py-4">Matériaux</th>
                      <th className="px-4 py-4 text-right">Montant ({currency})</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {clientRows.map((row, index) => (
                      <tr key={`${row.poste}-${row.designation}-${index}`} className="group hover:bg-gray-700/30 transition-colors">
                        <td className="px-4 py-4 align-top">
                          <span className="text-xs font-bold text-blue-300">{row.poste}</span>
                        </td>
                        <td className="px-4 py-4 align-top">
                          <span className="text-sm font-bold text-white">{row.designation}</span>
                        </td>
                        <td className="px-4 py-4 align-top">
                          <span className="text-xs text-gray-300 font-mono leading-relaxed">{row.qtes}</span>
                        </td>
                        <td className="px-4 py-4 align-top">
                          <span className="text-xs text-gray-300 font-mono leading-relaxed">{row.materials}</span>
                        </td>
                        <td className="px-4 py-4 text-right align-top font-mono font-bold text-sm">
                          {row.amount ? row.amount.toLocaleString("fr-FR") : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-blue-600/10 text-blue-400">
                      <td colSpan={4} className="px-4 py-5 text-sm font-black uppercase">Total estimé du projet</td>
                      <td className="px-4 py-5 text-right text-xl font-black">{totalGeneral.toLocaleString("fr-FR")}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              
              <div className="flex gap-3">
                <button onClick={exportPDF} className="flex-1 bg-gray-800 hover:bg-gray-700 border border-gray-600 py-3 rounded-xl font-bold flex justify-center items-center gap-2 transition-all">
                  <Printer className="w-4 h-4" /> Imprimer PDF
                </button>
                <button onClick={exportExcel} className="flex-1 bg-indigo-600 hover:bg-indigo-500 py-3 rounded-xl font-bold flex justify-center items-center gap-2 transition-all shadow-lg">
                  <Download className="w-4 h-4" /> Export Excel
                </button>
              </div>

              <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden shadow-xl">
                <div className="px-5 py-3 border-b border-gray-700 bg-gray-800/80">
                  <h3 className="text-xs font-bold text-emerald-300 uppercase tracking-widest">Cumul global des matériaux</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4">
                  {materialRows.length === 0 ? (
                    <p className="text-xs text-gray-500 italic">Aucun matériau calculé.</p>
                  ) : materialRows.map(([key, value]) => (
                    <div key={key} className="bg-gray-900/70 border border-gray-700 rounded-xl p-3 flex justify-between items-center">
                      <span className="text-xs font-bold text-gray-300">{MATERIAL_LABELS[key] || key}</span>
                      <span className="text-xs font-mono font-black text-white">
                        {Number(value || 0).toFixed(key === "acier" ? 3 : key === "eau" ? 0 : 2)} {MATERIAL_UNITS[key] || ""}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="lg:col-span-4 space-y-6">
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
              <MatCard label="Ciment Total" value={Math.ceil((cumulMateriaux.ciment || 0) * 20)} unit="Sacs de 50kg" color="text-orange-400" />
              <MatCard label="Acier Total" value={((cumulMateriaux.acier || 0) * 1000).toFixed(0)} unit="Kilogrammes" color="text-red-400" />
              <MatCard label="Sable Estimé" value={(cumulMateriaux.sable || 0).toFixed(1)} unit="m³/t" color="text-yellow-400" />
              <MatCard label="Béton Total" value={(cumulMateriaux.volume || 0).toFixed(1)} unit="m³ Coulés" color="text-blue-400" />
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
               <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-6">
                 {materialRows.map(([key, value]) => (
                   <div key={key} className="bg-gray-900/70 border border-gray-700 rounded-xl p-3 flex justify-between items-center">
                     <span className="text-xs font-bold text-gray-300">{MATERIAL_LABELS[key] || key}</span>
                     <span className="text-xs font-mono font-black text-white">
                       {Number(value || 0).toFixed(key === "acier" ? 3 : 2)} {MATERIAL_UNITS[key] || ""}
                     </span>
                   </div>
                 ))}
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
      <span className="text-white">{Number(current || 0).toFixed(2)} {unit}</span>
    </div>
    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
      <div className={`h-full ${color} rounded-full`} style={{ width: `${Math.min((Number(current) || 0) * 10, 100)}%` }} />
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
