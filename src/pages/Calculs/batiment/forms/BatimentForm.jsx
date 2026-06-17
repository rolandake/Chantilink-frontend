import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useCalculation } from "@/context/CalculationContext";
import usePersistentState from "../../../../hooks/usePersistentState";
import { useProjectStore } from "../../../../store/useProjectStore";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  FileText, ChevronLeft, LayoutDashboard, Building2,
  Download, FileSpreadsheet, FileType2, Table2, X,
  TrendingUp, Package, Hammer
} from "lucide-react";

import Devis         from "./Devis";
import Terrassement  from "./Terrassement";
import Fondation     from "./Fondation";
import Elevations    from "./Elevations";
import Toiture       from "./Toiture";
import Finitions     from "./Finitions";
import Divers        from "./Divers";

// ─── CONFIG ÉTAPES ────────────────────────────────────────────
const stepsConfig = [
  { id: "terrassement", label: "Terrassement",      component: Terrassement, icon: "🚜", color: "text-amber-500"   },
  { id: "fondation",    label: "Fondation",          component: Fondation,    icon: "🏗️", color: "text-red-500"     },
  { id: "elevation",    label: "Élévation (Murs)",   component: Elevations,   icon: "🧱", color: "text-blue-500"    },
  { id: "toiture",      label: "Toiture / Charpente",component: Toiture,      icon: "🏠", color: "text-orange-500"  },
  { id: "finitions",    label: "Finitions",          component: Finitions,    icon: "✨", color: "text-purple-500"  },
  { id: "divers",       label: "Divers / Outils",    component: Divers,       icon: "🧰", color: "text-emerald-500" },
];

// ─── HELPERS FORMAT ───────────────────────────────────────────
const fmt = (n, currency = "XOF") =>
  `${Number(n || 0).toLocaleString("fr-FR")} ${currency}`;

const fmtNum = (n, dec = 2) =>
  Number(n || 0).toFixed(dec);

const fmtPdfMoney = (n, currency = "XOF") =>
  Number(n || 0).toLocaleString("fr-FR").replace(/\s/g, ".") + ` ${currency}`;

const today = () => new Date().toLocaleDateString("fr-FR");
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
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageW, doc.internal.pageSize.getHeight(), "F");

  if (logoDataUrl) {
    doc.addImage(logoDataUrl, "PNG", 14, 10, 74, 22);
  }

  doc.setFillColor(249, 115, 22);
  doc.rect(pageRight, 10, 3, 22, "F");
  doc.setTextColor(17, 24, 39);
  doc.setFontSize(17);
  doc.setFont("helvetica", "bold");
  doc.text(title, pageRight - 4, 17, { align: "right" });
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(107, 114, 128);
  doc.text(subtitle, pageRight - 4, 23, { align: "right" });
  doc.text(dateText, pageRight - 4, 29, { align: "right" });
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
  outillage: "Outillage / Matériel",
  achat: "Achat matériel",
  location: "Location matériel",
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
  outillage: "XOF",
  achat: "XOF",
  location: "XOF",
};

const FOUNDATION_LABELS = {
  FILANTE: "Semelles filantes",
  ISOLEE: "Semelles isolées",
  RADIER: "Radier",
  MASSIF: "Massifs",
  LONGRINE: "Longrines fondation",
};

const qty = (label, value, unit, dec = 2) =>
  Number(value || 0) > 0 ? { label, value: Number(value || 0), unit, dec } : null;

const compactQty = (items) => items.filter(Boolean);

const formatQty = ({ value, unit, dec = 2 }) =>
  `${fmtNum(value, dec)} ${unit}`;

const hasMeaningfulValue = (obj = {}) =>
  Object.values(obj).some((v) => Number(v || 0) > 0 || (typeof v === "string" && v.length > 0));

const buildOuvrageRows = (subResults = {}) => {
  const rows = [];
  const terrassement = subResults.terrassement || {};
  const fondation = subResults.fondation || {};
  const toiture = subResults.toiture || {};
  const finitions = subResults.finitions || {};

  if (hasMeaningfulValue(terrassement)) {
    rows.push({
      stepId: "terrassement",
      label: "Synthèse terrassement",
      details: compactQty([
        qty("Déblais", terrassement.totalDeblai, "m³"),
        qty("Foisonné", terrassement.totalFoisonne, "m³"),
        qty("Remblais", terrassement.totalRemblai, "m³"),
        qty("Surface plateforme", terrassement.surfacePlateforme, "m²"),
        qty("Camions", terrassement.nbCamions, "u", 0),
      ]),
    });
  }

  if (hasMeaningfulValue(fondation)) {
    rows.push({
      stepId: "fondation",
      label: FOUNDATION_LABELS[fondation.typeFondation] || "Fondation",
      details: compactQty([
        qty("Béton", fondation.volumeBetonFondation, "m³"),
        qty("Béton propreté", fondation.volumeBetonProprete, "m³"),
        qty("Surface support", fondation.surfaceSupport, "m²"),
        qty("Coffrage", fondation.surfaceCoffrage, "m²"),
        qty("Acier", fondation.acierKg, "kg", 0),
      ]),
    });
  }

  [
    ["murs", "Maçonnerie murs", [
      qty("Surface nette", subResults.murs?.surfaceNette, "m²"),
      qty("Agglos", subResults.murs?.nbBlocs, "u", 0),
      qty("Mortier", subResults.murs?.mortierM3, "m³"),
      qty("Volume", subResults.murs?.volumeMaconnerie, "m³"),
    ]],
    ["poteaux", "Poteaux", [
      qty("Nombre", subResults.poteaux?.nombre, "u", 0),
      qty("Volume", subResults.poteaux?.volumeTotal, "m³"),
      qty("Coffrage", subResults.poteaux?.surfaceCoffrage, "m²"),
      qty("Acier", subResults.poteaux?.acierKg, "kg", 0),
    ]],
    ["longrines", "Chaînage", [
      qty("Nombre", subResults.longrines?.nombre, "u", 0),
      qty("Volume", subResults.longrines?.volumeCommande, "m³"),
      qty("Coffrage", subResults.longrines?.surfaceCoffrage, "m²"),
      qty("Acier", subResults.longrines?.acierKg, "kg", 0),
    ]],
    ["linteaux", "Linteaux", [
      qty("Nombre", subResults.linteaux?.nombre, "u", 0),
      qty("Volume", subResults.linteaux?.volumeTotal, "m³"),
      qty("Coffrage", subResults.linteaux?.surfaceCoffrage, "m²"),
      qty("Acier", subResults.linteaux?.acierKg, "kg", 0),
    ]],
    ["poutres", "Poutres", [
      qty("Nombre", subResults.poutres?.nombre, "u", 0),
      qty("Volume", subResults.poutres?.volumeFinal, "m³"),
      qty("Coffrage", subResults.poutres?.surfaceCoffrage, "m²"),
      qty("Acier", subResults.poutres?.acierKg, "kg", 0),
    ]],
    ["dalles", "Dalles / planchers", [
      qty("Surface", subResults.dalles?.surface, "m²"),
      qty("Nombre", subResults.dalles?.nombre, "u", 0),
      qty("Volume", subResults.dalles?.volumeFinal, "m³"),
      qty("Coffrage", subResults.dalles?.surfaceCoffrage, "m²"),
      qty("Poutrelles", subResults.dalles?.lineairePoutrelles, "ml"),
    ]],
    ["escaliers", "Escaliers", [
      qty("Marches", subResults.escaliers?.nbMarches, "u", 0),
      qty("Volume", subResults.escaliers?.volumeTotal, "m³"),
      qty("Coffrage", subResults.escaliers?.surfaceCoffrage, "m²"),
      qty("Acier", subResults.escaliers?.acierKg, "kg", 0),
    ]],
  ].forEach(([id, label, details]) => {
    const clean = compactQty(details);
    if (clean.length) rows.push({ stepId: "elevation", label, details: clean });
  });

  if (hasMeaningfulValue(toiture)) {
    rows.push({
      stepId: "toiture",
      label: "Toiture / charpente",
      details: compactQty([
        qty("Surface projetée", toiture.surfaceProjetee, "m²"),
        qty("Surface réelle", toiture.surfaceReelle, "m²"),
        qty("Couverture", toiture.couverture, "u/m²"),
        qty("Bois", toiture.boisM3, "m³"),
        qty("Étanchéité", toiture.etancheiteM2, "m²"),
        qty("Coffrage", toiture.surfaceCoffrage, "m²"),
      ]),
    });
  }

  if (hasMeaningfulValue(finitions)) {
    rows.push({
      stepId: "finitions",
      label: "Finitions",
      details: compactQty([
        qty("Surface", finitions.surface, "m²"),
        qty("Peinture", finitions.peinture, "L"),
        qty("Revêtement", finitions.revetement, "m²"),
        qty("Enduit", finitions.enduit, "kg"),
        qty("Colle", finitions.colle, "kg"),
        qty("Joint", finitions.joint, "kg"),
      ]),
    });
  }

  const divers = subResults.divers || {};
  if (hasMeaningfulValue(divers) || (divers.items && divers.items.length > 0)) {
    // Si on a le détail des lignes, on les affiche individuellement
    const lignes = divers.items || [];
    if (lignes.length > 0) {
      // Une ligne par outil avec détail complet (Qté, Durée, Prix, Total)
      lignes.forEach((l, i) => {
        const nom = l.label || "Outil";
        const icone = l.icon || "🧰";
        rows.push({
          stepId: "divers",
          label: `${icone} ${nom}`,
          details: compactQty([
            qty("Qté", l.quantite, "u", 0),
            qty("Durée", l.duree, "j", 0),
            qty("Prix unit.", l.prixUnitaire, "XOF"),
            qty("Total", l.total, "XOF"),
            l.commentaire ? qty("Note", l.commentaire, "") : null,
          ]),
        });
      });
    } else {
      rows.push({
        stepId: "divers",
        label: "Divers / Outils chantier",
        details: compactQty([
          qty("Outillage", divers.outillage, "XOF"),
          qty("Achat", divers.achat, "XOF"),
          qty("Location", divers.location, "XOF"),
          qty("Lignes", divers.lignes, "u", 0),
        ]),
      });
    }
  }

  return rows;
};

// ─── TABLEAU RÉCAP ────────────────────────────────────────────
const RecapTable = ({ costs, quantites, totalGeneral, currency, tableRef, subResults }) => {
  const rows = stepsConfig.map(s => ({
    ...s,
    cost: costs[s.id] || 0,
    mat:  quantites[s.id] || {},
  }));

  const hasAny = rows.some(r => r.cost > 0);
  const ouvrageRows = buildOuvrageRows(subResults);
  const materialTotals = Object.values(quantites || {}).reduce((acc, mat) => {
    Object.entries(mat || {}).forEach(([key, value]) => {
      const n = Number(value || 0);
      if (n > 0) acc[key] = (acc[key] || 0) + n;
    });
    return acc;
  }, {});
  const materialRows = Object.entries(materialTotals)
    .filter(([, value]) => Number(value || 0) > 0)
    .sort(([a], [b]) => (MATERIAL_LABELS[a] || a).localeCompare(MATERIAL_LABELS[b] || b));

  return (
    <div
      ref={tableRef}
      className="rounded-2xl overflow-hidden border"
      style={{ background: "rgba(17,24,39,0.95)", borderColor: "rgba(75,85,99,0.4)" }}
    >
      {/* Entête tableau */}
      <div
        className="px-5 py-3 flex items-center gap-3 border-b"
        style={{ background: "rgba(37,99,235,0.12)", borderColor: "rgba(59,130,246,0.25)" }}
      >
        <Table2 className="w-4 h-4 text-blue-400" />
        <span className="text-xs font-bold text-blue-300 uppercase tracking-widest">
          Récapitulatif en temps réel
        </span>
        {hasAny && (
          <span className="ml-auto text-[10px] text-gray-500 font-mono">
            Mis à jour : {new Date().toLocaleTimeString("fr-FR")}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 border-b border-gray-800/80">
        <SummaryKpi label="Postes chiffrés" value={`${rows.filter(r => r.cost > 0).length}/${rows.length}`} />
        <SummaryKpi label="Ouvrages suivis" value={ouvrageRows.length} />
        <SummaryKpi label="Montant global" value={fmt(totalGeneral, currency)} strong />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 p-4">
        <div className="xl:col-span-7 rounded-xl border border-gray-800 bg-gray-900/60 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800 bg-gray-800/50 flex items-center gap-2">
            <Hammer className="w-4 h-4 text-blue-400" />
            <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">Détail par type d'ouvrage</p>
          </div>
          <div className="divide-y divide-gray-800/70">
            {ouvrageRows.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-gray-500 italic">Les sous-ouvrages calculés apparaîtront ici</div>
            ) : ouvrageRows.map((row, index) => {
              const step = stepsConfig.find((s) => s.id === row.stepId);
              return (
                <div key={`${row.stepId}-${row.label}-${index}`} className="px-4 py-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-base">{step?.icon}</span>
                    <p className="text-sm font-bold text-white">{row.label}</p>
                    <span className="ml-auto text-[10px] text-gray-500">{step?.label}</span>
                  </div>
                  <QuantityChips items={row.details} />
                </div>
              );
            })}
          </div>
        </div>

        <div className="xl:col-span-5 rounded-xl border border-gray-800 bg-gray-900/60 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800 bg-gray-800/50 flex items-center gap-2">
            <Package className="w-4 h-4 text-emerald-400" />
            <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">Matériaux cumulés</p>
          </div>
          {materialRows.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-gray-500 italic">Aucun matériau cumulé pour l'instant</div>
          ) : (
            <div className="grid grid-cols-2 gap-2 p-3">
              {materialRows.map(([key, value]) => (
                <div key={key} className="rounded-lg border border-gray-800 bg-gray-950/70 p-3">
                  <p className="text-[10px] text-gray-500 uppercase font-bold truncate">{MATERIAL_LABELS[key] || key}</p>
                  <p className="mt-1 text-sm font-black text-white font-mono">
                    {fmtNum(value, key === "acier" ? 3 : 2)}
                    <span className="ml-1 text-[10px] text-gray-500">{MATERIAL_UNITS[key] || ""}</span>
                  </p>
                </div>
              ))}
            </div>
          )}
          <div className="px-4 py-3 border-t border-blue-500/20 bg-blue-500/10 flex items-center justify-between">
            <span className="text-xs font-black text-blue-300 uppercase tracking-wider">Total projet</span>
            <span className="text-base font-black text-white font-mono">{fmt(totalGeneral, currency)}</span>
          </div>
        </div>
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

const SummaryKpi = ({ label, value, strong = false }) => (
  <div className="rounded-xl border border-gray-800 bg-gray-950/60 px-4 py-3">
    <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">{label}</p>
    <p className={`mt-1 font-black font-mono ${strong ? "text-lg text-blue-300" : "text-base text-white"}`}>{value}</p>
  </div>
);

const QuantityChips = ({ items }) => {
  const clean = compactQty(items || []);
  if (!clean.length) return <span className="text-[10px] text-gray-600 italic">—</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {clean.map((item) => (
        <span key={`${item.label}-${item.unit}`} className="inline-flex items-center gap-1 rounded-md border border-gray-700 bg-gray-950/70 px-2 py-1 text-[10px] text-gray-300">
          <span className="text-gray-500">{item.label}</span>
          <span className="font-bold text-white font-mono">{formatQty(item)}</span>
        </span>
      ))}
    </div>
  );
};

// ─── PANNEAU EXPORT ───────────────────────────────────────────
const formatExportQuantities = (items) => {
  const clean = compactQty(items || []);
  return clean.length ? clean.map((item) => `${item.label}: ${formatQty(item)}`).join(" | ") : "—";
};

const buildMaterialRows = (quantites = {}) =>
  Object.values(quantites).reduce((acc, mat) => {
    Object.entries(mat || {}).forEach(([key, value]) => {
      const n = Number(value || 0);
      if (n > 0) acc[key] = (acc[key] || 0) + n;
    });
    return acc;
  }, {});

const ExportPanel = ({ costs, quantites, totalGeneral, currency, subResults, onClose }) => {
  const [exporting, setExporting] = useState(null);

  // ── Données communes ──────────────────────────────────────
  const rows = stepsConfig.map(s => ({
    id:     s.id,
    label:  s.label,
    icon:   s.icon,
    volume: quantites[s.id]?.volume  || 0,
    ciment: quantites[s.id]?.ciment  || 0,
    acier:  quantites[s.id]?.acier   || 0,
    cost:   costs[s.id]              || 0,
  }));
  const ouvrageRows = buildOuvrageRows(subResults || {});
  const materialTotals = buildMaterialRows(quantites || {});
  const materialRows = Object.entries(materialTotals)
    .filter(([, value]) => Number(value || 0) > 0)
    .sort(([a], [b]) => (MATERIAL_LABELS[a] || a).localeCompare(MATERIAL_LABELS[b] || b));

  // ── EXPORT EXCEL ─────────────────────────────────────────
  const exportExcel = useCallback(async () => {
    setExporting("excel");
    try {
      const wb = XLSX.utils.book_new();

      const ws0Data = [
        ["CHANTILINK - EXPORT GLOBAL BATIMENT", "", "", ""],
        [`Date : ${today()}`, "", "", ""],
        [""],
        ["Indicateur", "Valeur", "Unité", "Observation"],
        ["Postes du projet", rows.length, "u", "Terrassement, fondation, élévation, toiture, finitions"],
        ["Types d'ouvrages calculés", ouvrageRows.length, "u", "Détail dans l'onglet Types ouvrages"],
        ["Matériaux cumulés", materialRows.length, "u", "Détail dans l'onglet Matériaux cumulés"],
        ["Total général", totalGeneral, currency, "Montant global estimatif"],
      ];
      const ws0 = XLSX.utils.aoa_to_sheet(ws0Data);
      ws0["!cols"] = [{ wch: 34 }, { wch: 18 }, { wch: 14 }, { wch: 54 }];
      ws0["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }];
      XLSX.utils.book_append_sheet(wb, ws0, "Synthèse");

      const ws1Data = [
        ["DEVIS BÂTIMENT — CHANTILINK", "", "", "", ""],
        [`Date : ${today()}`, "", "", "", ""],
        [""],
        ["Poste", "Quantités principales", "Matériaux clés", `Coût (${currency})`],
        ...rows.map(r => [
          r.label,
          formatExportQuantities([
            qty("Volume", r.volume, "m³"),
            qty("Surface", quantites[r.id]?.surface, "m²"),
            qty("Blocs", quantites[r.id]?.blocs, "u", 0),
          ]),
          formatExportQuantities([
            qty("Ciment", r.ciment, "t"),
            qty("Acier", r.acier, "t", 3),
            qty("Sable", quantites[r.id]?.sable, "t/m³"),
            qty("Gravier", quantites[r.id]?.gravier, "t"),
            qty("Eau", quantites[r.id]?.eau, "L", 0),
            qty("Coffrage", quantites[r.id]?.coffrage, "m²"),
            qty("Bois", quantites[r.id]?.bois, "m³"),
          ]),
          r.cost,
        ]),
        [""],
        ["TOTAL", "", "", totalGeneral],
      ];
      const ws1 = XLSX.utils.aoa_to_sheet(ws1Data);
      ws1["!cols"] = [{ wch: 28 }, { wch: 42 }, { wch: 52 }, { wch: 20 }];
      ws1["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }];
      ws1["!autofilter"] = { ref: `A4:D${Math.max(4, ws1Data.length)}` };
      XLSX.utils.book_append_sheet(wb, ws1, "Récapitulatif");

      const ws2Data = [
        ["CHANTILINK - TYPES D'OUVRAGES", "", ""],
        [""],
        ["Type d'ouvrage", "Poste", "Quantités calculées"],
        ...ouvrageRows.map((r) => [
          r.label,
          stepsConfig.find((s) => s.id === r.stepId)?.label || r.stepId,
          formatExportQuantities(r.details),
        ]),
      ];
      const ws2 = XLSX.utils.aoa_to_sheet(ws2Data);
      ws2["!cols"] = [{ wch: 28 }, { wch: 24 }, { wch: 80 }];
      ws2["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }];
      ws2["!autofilter"] = { ref: `A3:C${Math.max(3, ws2Data.length)}` };
      XLSX.utils.book_append_sheet(wb, ws2, "Types ouvrages");

      const ws3Data = [
        ["CHANTILINK - MATÉRIAUX CUMULÉS", "", ""],
        [""],
        ["Matériau cumulé", "Quantité", "Unité"],
        ...materialRows.map(([key, value]) => [
          MATERIAL_LABELS[key] || key,
          Number(value || 0),
          MATERIAL_UNITS[key] || "",
        ]),
      ];
      const ws3 = XLSX.utils.aoa_to_sheet(ws3Data);
      ws3["!cols"] = [{ wch: 28 }, { wch: 16 }, { wch: 12 }];
      ws3["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }];
      ws3["!autofilter"] = { ref: `A3:C${Math.max(3, ws3Data.length)}` };
      XLSX.utils.book_append_sheet(wb, ws3, "Matériaux cumulés");

      XLSX.writeFile(wb, `devis_batiment_${Date.now()}.xlsx`);
    } catch (e) {
      console.error(e);
      alert("Erreur lors de l'export Excel.");
    } finally {
      setExporting(null);
    }
  }, [rows, ouvrageRows, materialRows, totalGeneral, currency, quantites]);

  // ── EXPORT PDF ────────────────────────────────────────────
  const exportPDF = useCallback(async () => {
    setExporting("pdf");
    try {
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const pageRight = pageW - 14;
      const logoDataUrl = await createLogoCanvasDataUrl(CHANTILINK_LOGO_URL).catch(() => null);
      const header = {
        logoDataUrl,
        pageW,
        pageRight,
        title: "DEVIS BÂTIMENT",
        subtitle: "Synthèse quantitative globale",
        dateText: `Généré le ${today()}`,
      };

      drawPdfPageHeader(doc, header);

      doc.setFillColor(243, 244, 246);
      doc.roundedRect(14, 38, pageW - 28, 18, 2, 2, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(75, 85, 99);
      doc.text("POSTES", 20, 46);
      doc.text("OUVRAGES", 78, 46);
      doc.text("MATERIAUX", 142, 46);
      doc.text("TOTAL GENERAL", 210, 46);
      doc.setFontSize(11);
      doc.setTextColor(17, 24, 39);
      doc.text(String(rows.length), 20, 52);
      doc.text(String(ouvrageRows.length), 78, 52);
      doc.text(String(materialRows.length), 142, 52);
      doc.text(fmtPdfMoney(totalGeneral, currency), 210, 52);

      autoTable(doc, {
        startY: 64,
        head: [["Poste", "Quantités principales", "Matériaux clés", `Coût ${currency}`]],
        body: [
          ...rows.map(r => [
            r.label,
            formatExportQuantities([
              qty("Volume", r.volume, "m³"),
              qty("Surface", quantites[r.id]?.surface, "m²"),
              qty("Blocs", quantites[r.id]?.blocs, "u", 0),
            ]),
            formatExportQuantities([
              qty("Ciment", r.ciment, "t"),
              qty("Sable", quantites[r.id]?.sable, "t/m³"),
              qty("Gravier", quantites[r.id]?.gravier, "t"),
              qty("Eau", quantites[r.id]?.eau, "L", 0),
              qty("Acier", r.acier, "t", 3),
              qty("Coffrage", quantites[r.id]?.coffrage, "m²"),
              qty("Bois", quantites[r.id]?.bois, "m³"),
            ]),
            r.cost ? fmtPdfMoney(r.cost, currency) : "—",
          ]),
          ["TOTAL", "", "", fmtPdfMoney(totalGeneral, currency)],
        ],
        theme: "grid",
        styles: {
          fontSize: 9,
          font: "helvetica",
          textColor: [17, 24, 39],
          lineColor: [229, 231, 235],
          lineWidth: 0.2,
          cellPadding: 2.2,
          valign: "top",
        },
        headStyles: {
          fillColor: [17, 24, 39],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 9,
        },
        alternateRowStyles: { fillColor: [249, 250, 251] },
        columnStyles: {
          0: { cellWidth: 34, fontStyle: "bold" },
          1: { cellWidth: 74 },
          2: { cellWidth: 118 },
          3: { cellWidth: 38, halign: "right", fontStyle: "bold" },
        },
        footStyles: { fillColor: [255, 237, 213], fontStyle: "bold" },
        didParseCell: (data) => {
          if (data.row.index === rows.length) {
            data.cell.styles.fillColor = [255, 237, 213];
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.textColor = [124, 45, 18];
          }
        },
        margin: { left: 14, right: 14 },
      });

      doc.addPage();
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(30, 64, 175);
      doc.text("DÉTAIL DES TYPES D'OUVRAGES", 10, 18);
      autoTable(doc, {
        startY: 26,
        head: [["Type d'ouvrage", "Poste", "Quantités"]],
        body: ouvrageRows.map((r) => [
          r.label,
          stepsConfig.find((s) => s.id === r.stepId)?.label || r.stepId,
          formatExportQuantities(r.details),
        ]),
        theme: "grid",
        styles: { fontSize: 9.5, textColor: [17, 24, 39], lineColor: [229, 231, 235], cellPadding: 3, valign: "top" },
        headStyles: { fillColor: [30, 64, 175], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 10 },
        alternateRowStyles: { fillColor: [239, 246, 255] },
        columnStyles: {
          0: { cellWidth: 58, fontStyle: "bold" },
          1: { cellWidth: 50 },
          2: { cellWidth: 169 },
        },
        margin: { left: 10, right: 10 },
      });

      doc.addPage();
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(21, 128, 61);
      doc.text("MATÉRIAUX CUMULÉS", 10, 18);
      autoTable(doc, {
        startY: 26,
        head: [["Matériau cumulé", "Quantité", "Unité"]],
        body: materialRows.map(([key, value]) => [
          MATERIAL_LABELS[key] || key,
          fmtNum(value, key === "acier" ? 3 : 2),
          MATERIAL_UNITS[key] || "",
        ]),
        theme: "grid",
        styles: { fontSize: 11, textColor: [17, 24, 39], lineColor: [229, 231, 235], cellPadding: 3.5 },
        headStyles: { fillColor: [21, 128, 61], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 11 },
        alternateRowStyles: { fillColor: [240, 253, 244] },
        columnStyles: {
          0: { cellWidth: 145, fontStyle: "bold" },
          1: { cellWidth: 85, halign: "right" },
          2: { cellWidth: 47 },
        },
        margin: { left: 10, right: 10 },
      });

      const pages = doc.internal.getNumberOfPages();
      for (let page = 1; page <= pages; page += 1) {
        doc.setPage(page);
        doc.setTextColor(148, 163, 184);
        doc.setFontSize(7);
        doc.text("Document généré par ChantiLink - www.chantilink.com", 14, pageH - 8);
        doc.text(`Page ${page}/${pages}`, pageRight, pageH - 8, { align: "right" });
      }

      doc.save(`devis_batiment_${Date.now()}.pdf`);
    } catch (e) {
      console.error(e);
      alert("Erreur lors de l'export PDF.");
    } finally {
      setExporting(null);
    }
  }, [rows, ouvrageRows, materialRows, totalGeneral, currency, quantites]);

  // ── EXPORT WORD (HTML → .doc) ─────────────────────────────
  const exportWord = useCallback(async () => {
    setExporting("word");
    try {
      const logoDataUrl = await loadImageDataUrl(CHANTILINK_LOGO_URL).catch(() => "");
      const tableRows = rows
        .map(r => `
          <tr style="background:${r.cost > 0 ? "#f0f4ff" : "#fff"}">
            <td style="padding:8px 12px;border:1px solid #ddd;font-weight:600">${r.icon} ${r.label}</td>
            <td style="padding:8px 12px;border:1px solid #ddd;font-family:monospace">${formatExportQuantities([qty("Volume", r.volume, "m³")])}</td>
            <td style="padding:8px 12px;border:1px solid #ddd;font-family:monospace">${formatExportQuantities([
              qty("Ciment", r.ciment, "t"),
              qty("Sable", quantites[r.id]?.sable, "t/m³"),
              qty("Gravier", quantites[r.id]?.gravier, "t"),
              qty("Eau", quantites[r.id]?.eau, "L", 0),
              qty("Acier", r.acier, "t", 3),
            ])}</td>
            <td style="padding:8px 12px;border:1px solid #ddd;text-align:right;font-weight:bold;color:#1d4ed8">${r.cost ? r.cost.toLocaleString("fr-FR") + " " + currency : "—"}</td>
          </tr>`)
        .join("");

      const ouvrageTableRows = ouvrageRows.map(r => `
        <tr>
          <td style="padding:7px 10px;border:1px solid #ddd;font-weight:600">${r.label}</td>
          <td style="padding:7px 10px;border:1px solid #ddd">${stepsConfig.find((s) => s.id === r.stepId)?.label || r.stepId}</td>
          <td style="padding:7px 10px;border:1px solid #ddd;font-family:monospace">${formatExportQuantities(r.details)}</td>
        </tr>`).join("");

      const materialTableRows = materialRows.map(([key, value]) => `
        <tr>
          <td style="padding:7px 10px;border:1px solid #ddd;font-weight:600">${MATERIAL_LABELS[key] || key}</td>
          <td style="padding:7px 10px;border:1px solid #ddd;text-align:right;font-family:monospace">${fmtNum(value, key === "acier" ? 3 : 2)}</td>
          <td style="padding:7px 10px;border:1px solid #ddd">${MATERIAL_UNITS[key] || ""}</td>
        </tr>`).join("");

      const html = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office"
              xmlns:w="urn:schemas-microsoft-com:office:word"
              xmlns="http://www.w3.org/TR/REC-html40">
        <head><meta charset="utf-8"><title>Devis Bâtiment</title></head>
        <body style="font-family:Arial,sans-serif;padding:30px;color:#111">
          <div style="display:flex;align-items:center;gap:16px;border-bottom:3px solid #1d4ed8;padding-bottom:10px;margin-bottom:24px">
            ${logoDataUrl ? `<img src="${logoDataUrl}" alt="ChantiLink" style="width:74px;height:74px;object-fit:contain">` : ""}
            <div>
              <h1 style="color:#1d4ed8;margin:0 0 4px">DEVIS BÂTIMENT — CHANTILINK</h1>
              <p style="color:#6b7280;margin:0">Date : ${today()}</p>
            </div>
          </div>

          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead>
              <tr style="background:#1d4ed8;color:#fff">
                <th style="padding:10px 12px;border:1px solid #1e40af;text-align:left">Poste</th>
                <th style="padding:10px 12px;border:1px solid #1e40af;text-align:left">Quantités</th>
                <th style="padding:10px 12px;border:1px solid #1e40af;text-align:left">Matériaux clés</th>
                <th style="padding:10px 12px;border:1px solid #1e40af;text-align:right">Coût (${currency})</th>
              </tr>
            </thead>
            <tbody>${tableRows}</tbody>
            <tfoot>
              <tr style="background:#1e3a8a;color:#fff">
                <td colspan="3" style="padding:10px 12px;border:1px solid #1e40af;font-weight:bold;font-size:14px">TOTAL GÉNÉRAL</td>
                <td style="padding:10px 12px;border:1px solid #1e40af;text-align:right;font-weight:bold;font-size:14px">
                  ${totalGeneral.toLocaleString("fr-FR")} ${currency}
                </td>
              </tr>
            </tfoot>
          </table>

          <h2 style="margin-top:28px;color:#1d4ed8">Types d'ouvrages calculés</h2>
          <table style="width:100%;border-collapse:collapse;font-size:12px">
            <thead><tr style="background:#1d4ed8;color:#fff">
              <th style="padding:9px;border:1px solid #1e40af;text-align:left">Ouvrage</th>
              <th style="padding:9px;border:1px solid #1e40af;text-align:left">Poste</th>
              <th style="padding:9px;border:1px solid #1e40af;text-align:left">Quantités</th>
            </tr></thead>
            <tbody>${ouvrageTableRows}</tbody>
          </table>

          <h2 style="margin-top:28px;color:#15803d">Matériaux cumulés</h2>
          <table style="width:100%;border-collapse:collapse;font-size:12px">
            <thead><tr style="background:#15803d;color:#fff">
              <th style="padding:9px;border:1px solid #166534;text-align:left">Matériau</th>
              <th style="padding:9px;border:1px solid #166534;text-align:right">Quantité</th>
              <th style="padding:9px;border:1px solid #166534;text-align:left">Unité</th>
            </tr></thead>
            <tbody>${materialTableRows}</tbody>
          </table>

          <p style="margin-top:32px;color:#9ca3af;font-size:11px">
            Document généré par ChantiLink — ${today()}
          </p>
        </body></html>`;

      const blob = new Blob([html], { type: "application/msword;charset=utf-8" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `devis_batiment_${Date.now()}.doc`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert("Erreur lors de l'export Word.");
    } finally {
      setExporting(null);
    }
  }, [rows, totalGeneral, currency]);

  const hasData = stepsConfig.some(s => costs[s.id] > 0);

  return (
    <div
      className="rounded-2xl overflow-hidden border"
      style={{
        background: "linear-gradient(135deg, rgba(17,24,39,0.98) 0%, rgba(30,27,75,0.95) 100%)",
        borderColor: "rgba(99,102,241,0.3)",
      }}
    >
      {/* Header */}
      <div
        className="px-5 py-3 flex items-center gap-3 border-b"
        style={{ background: "rgba(99,102,241,0.1)", borderColor: "rgba(99,102,241,0.25)" }}
      >
        <Download className="w-4 h-4 text-indigo-400" />
        <span className="text-xs font-bold text-indigo-300 uppercase tracking-widest">
          Exporter le devis
        </span>
        {!hasData && (
          <span className="ml-auto text-[10px] text-gray-600 italic">
            Complétez au moins une section pour activer l'export
          </span>
        )}
      </div>

      <div className="p-4 flex flex-col sm:flex-row gap-3">
        {/* PDF */}
        <ExportBtn
          icon={<FileText className="w-5 h-5" />}
          label="PDF"
          sublabel="Rapport imprimable"
          color="from-red-600 to-rose-700"
          glowColor="rgba(239,68,68,0.3)"
          disabled={!hasData}
          loading={exporting === "pdf"}
          onClick={exportPDF}
        />

        {/* Excel */}
        <ExportBtn
          icon={<FileSpreadsheet className="w-5 h-5" />}
          label="Excel"
          sublabel="4 feuilles détaillées"
          color="from-green-600 to-emerald-700"
          glowColor="rgba(16,185,129,0.3)"
          disabled={!hasData}
          loading={exporting === "excel"}
          onClick={exportExcel}
        />

        {/* Word */}
        <ExportBtn
          icon={<FileType2 className="w-5 h-5" />}
          label="Word"
          sublabel="Document .doc"
          color="from-blue-600 to-indigo-700"
          glowColor="rgba(59,130,246,0.3)"
          disabled={!hasData}
          loading={exporting === "word"}
          onClick={exportWord}
        />
      </div>
    </div>
  );
};

const ExportBtn = ({ icon, label, sublabel, color, glowColor, disabled, loading, onClick }) => (
  <button
    onClick={onClick}
    disabled={disabled || loading}
    className={`flex-1 flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all active:scale-95 ${
      disabled ? "opacity-30 cursor-not-allowed" : "hover:scale-[1.02]"
    }`}
    style={{
      background: disabled
        ? "rgba(55,65,81,0.4)"
        : `linear-gradient(135deg, var(--tw-gradient-stops))`,
      boxShadow: disabled ? "none" : `0 4px 20px ${glowColor}`,
      border: `0.5px solid ${disabled ? "rgba(75,85,99,0.3)" : glowColor}`,
    }}
  >
    <span className={`p-2 rounded-lg ${disabled ? "bg-gray-700" : `bg-gradient-to-br ${color}`} text-white`}>
      {loading
        ? <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
        : icon}
    </span>
    <div className="text-left">
      <div className={`text-sm font-bold ${disabled ? "text-gray-500" : "text-white"}`}>{label}</div>
      <div className={`text-[10px] ${disabled ? "text-gray-600" : "text-white/60"}`}>{sublabel}</div>
    </div>
    {!disabled && !loading && (
      <Download className="w-4 h-4 text-white/50 ml-auto" />
    )}
  </button>
);

// ─────────────────────────────────────────────────────────────
// BATIMENT FORM — COMPOSANT PRINCIPAL
// ─────────────────────────────────────────────────────────────
export default function BatimentForm({ currency = "XOF" }) {
  const calculationContext = useCalculation();
  const { setCurrentProjectType, setCurrentCalculationType, PROJECT_TYPES } = calculationContext || {};
  const subResults = useProjectStore((s) => s.subResults);

  const [selectedStep, setSelectedStep] = usePersistentState("batiment:selectedStep", null);
  const [showDevis,    setShowDevis]    = useState(false);
  const [showExport,   setShowExport]   = useState(false);

  const [costs,     setCosts]     = usePersistentState("batiment:costs", Object.fromEntries(stepsConfig.map(s => [s.id, 0])));
  const [quantites, setQuantites] = usePersistentState("batiment:quantites", Object.fromEntries(stepsConfig.map(s => [s.id, {}])));

  const tableRef = useRef(null);

  useEffect(() => {
    if (calculationContext && PROJECT_TYPES?.BATIMENT) {
      setCurrentProjectType?.(PROJECT_TYPES.BATIMENT);
      setCurrentCalculationType?.("projet_complet");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // ✅ FIX PRINCIPAL — on passe les deux noms de props simultanément
  // Terrassement  attend : onCostChange
  // Fondation     attend : onCostChange  + onMateriauxChange
  // Elevations    attend : onCostChange  + onMateriauxChange
  // Toiture       attend : onTotalChange + onMateriauxChange
  // Finitions     attend : onTotalChange + onMateriauxChange
  // → en envoyant les deux alias, chaque composant trouve sa prop
  const renderCurrentStep = () => {
    const step = stepsConfig.find(s => s.id === selectedStep);
    if (!step) return null;
    const StepComponent = step.component;
    return (
      <StepComponent
        currency={currency}
        onTotalChange={val  => handleCostChange(step.id, val)}
        onCostChange={val   => handleCostChange(step.id, val)}   // ← alias pour Terrassement / Fondation / Elevations
        onMateriauxChange={mats => handleQuantitesChange(step.id, mats)}
        onResultsChange={res => {
          // Pour les composants qui exposent des résultats détaillés (ex: Divers)
          // Les données sont gérées via useProjectStore.setGlobalResults
        }}
      />
    );
  };

  if (!calculationContext) return <div className="text-white p-10">Chargement du contexte...</div>;

  return (
    <div className="flex h-full w-full bg-gray-900 text-white overflow-hidden font-sans" style={{ minHeight: 0 }}>

      {/* ── SIDEBAR DESKTOP ──────────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-72 bg-gray-800/80 backdrop-blur-xl border-r border-gray-700 h-full z-20 shadow-2xl flex-shrink-0">

        {/* Header */}
        <div className="p-5 border-b border-gray-700 shrink-0 bg-gray-800/50">
          <h1 className="text-xl font-black bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent flex items-center gap-2 mb-1">
            <Building2 className="w-5 h-5 text-blue-500" /> Bâtiment
          </h1>
          <p className="text-[10px] text-gray-400 mb-3">Construction & Rénovation</p>
          <div className="bg-gray-700 rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-700"
              style={{ width: `${progressPercent}%` }}
            />
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
              <button
                key={step.id}
                onClick={() => setSelectedStep(step.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left relative overflow-hidden ${
                  isSelected
                    ? "bg-gray-700 border border-blue-500/50 shadow-lg"
                    : "hover:bg-gray-800 border border-transparent hover:border-gray-700"
                }`}
              >
                {isSelected && <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 rounded-r" />}
                <span className={`text-lg filter transition-all ${!isSelected && !isActive ? "grayscale opacity-40" : ""}`}>
                  {step.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <div className={`font-bold text-xs ${isSelected ? "text-white" : "text-gray-300"}`}>
                    {step.label}
                  </div>
                  {isActive
                    ? <div className="text-[10px] font-mono text-blue-400">{costs[step.id].toLocaleString()} {currency}</div>
                    : <div className="text-[9px] text-gray-600">Non chiffré</div>}
                </div>
                {isActive && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)] animate-pulse" />}
              </button>
            );
          })}
        </div>

        {/* Footer sidebar */}
        <div className="p-4 border-t border-gray-700 bg-gray-900/80 shrink-0 space-y-2">
          <div className="bg-gray-800 rounded-xl p-3 border border-gray-700">
            <span className="text-[9px] text-gray-400 uppercase tracking-widest block mb-0.5">Total Projet</span>
            <span className="text-lg font-black text-white tracking-tight">
              {totalGeneral.toLocaleString()} <span className="text-xs font-normal text-blue-400">{currency}</span>
            </span>
          </div>

          <button
            onClick={() => setShowDevis(true)}
            disabled={totalGeneral === 0}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            <FileText className="w-3.5 h-3.5" /> Voir le Devis
          </button>

          <button
            onClick={() => setShowExport(true)}
            disabled={totalGeneral === 0}
            className="w-full bg-gradient-to-r from-indigo-700 to-purple-700 hover:from-indigo-600 hover:to-purple-600 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            <Download className="w-3.5 h-3.5" /> Exporter PDF / Excel / Word
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT ─────────────────────────────────── */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative bg-gray-900 w-full min-w-0">

        {/* Mobile header */}
        <div className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-900 shrink-0 z-20">
          {selectedStep ? (
            <button onClick={() => setSelectedStep(null)} className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors text-sm">
              <ChevronLeft className="w-4 h-4" /> Retour
            </button>
          ) : (
            <h1 className="text-base font-bold text-blue-500 flex items-center gap-2">
              <Building2 className="w-4 h-4" /> Bâtiment
            </h1>
          )}
          <div className="bg-gray-800 px-3 py-1.5 rounded-lg border border-gray-700">
            <span className="text-xs font-bold text-white">{totalGeneral.toLocaleString()} {currency}</span>
          </div>
        </div>

        {/* Contenu */}
        {selectedStep ? (
          <div className="flex-1 w-full h-full overflow-hidden">
            {renderCurrentStep()}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto custom-scrollbar">

            {/* Grille mobile */}
            <div className="lg:hidden grid grid-cols-2 gap-3 p-4 pb-4">
              {stepsConfig.map((step) => (
                <button
                  key={step.id}
                  onClick={() => setSelectedStep(step.id)}
                  className={`flex flex-col items-center justify-center p-4 rounded-2xl border backdrop-blur-sm shadow-lg active:scale-95 transition-all ${
                    costs[step.id] > 0
                      ? "border-blue-500/50 bg-gradient-to-br from-gray-800 to-blue-900/20"
                      : "border-gray-700 bg-gray-800/50 hover:bg-gray-800"
                  }`}
                >
                  <span className="text-3xl mb-2">{step.icon}</span>
                  <span className="font-bold text-xs text-center text-gray-200">{step.label}</span>
                  {costs[step.id] > 0 && (
                    <span className="mt-1.5 text-[9px] font-mono font-bold text-blue-400 bg-gray-900/80 px-2 py-0.5 rounded border border-blue-500/30">
                      {(costs[step.id] / 1000).toFixed(0)}k
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Accès rapide desktop */}
            <div className="hidden lg:block px-4 pt-5 pb-4">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-[10px] text-blue-300 font-bold uppercase tracking-widest">Formulaires bâtiment</p>
                  <h2 className="text-xl font-black text-white">Choisissez un poste à calculer</h2>
                </div>
                <div className="rounded-xl border border-gray-700 bg-gray-800/70 px-4 py-2 text-right">
                  <p className="text-[10px] text-gray-500 uppercase font-bold">Total projet</p>
                  <p className="text-sm font-black text-blue-300 font-mono">{totalGeneral.toLocaleString()} {currency}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3">
                {stepsConfig.map((step) => {
                  const isActive = costs[step.id] > 0;
                  return (
                    <button
                      key={step.id}
                      onClick={() => setSelectedStep(step.id)}
                      className={`group min-h-[116px] rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:border-blue-500/60 hover:bg-gray-800 ${
                        isActive
                          ? "border-blue-500/40 bg-blue-500/10"
                          : "border-gray-800 bg-gray-800/45"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-2xl">{step.icon}</span>
                        {isActive && <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]" />}
                      </div>
                      <p className={`mt-3 text-sm font-black ${isActive ? "text-white" : "text-gray-200"}`}>{step.label}</p>
                      <p className="mt-1 text-[10px] text-gray-500">
                        {isActive ? `${costs[step.id].toLocaleString()} ${currency}` : "Non chiffré"}
                      </p>
                      <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-blue-300 opacity-80 group-hover:opacity-100">
                        Ouvrir le formulaire
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* TABLEAU RÉCAP */}
            <div className="px-4 pb-4" ref={tableRef}>
              <RecapTable
                costs={costs}
                quantites={quantites}
                totalGeneral={totalGeneral}
                currency={currency}
                tableRef={null}
                subResults={subResults}
              />
            </div>

            {/* Actions mobiles dans le flux de la page */}
            {totalGeneral > 0 && (
              <div className="lg:hidden px-4 pb-4 grid grid-cols-1 gap-2">
                <button
                  onClick={() => setShowDevis(true)}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 border border-blue-400/30 active:scale-95"
                >
                  <FileText className="w-4 h-4" /> Voir Devis
                </button>
                <button
                  onClick={() => setShowExport(true)}
                  className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 border border-indigo-400/30 active:scale-95"
                >
                  <Download className="w-4 h-4" /> Exporter ({totalGeneral.toLocaleString()})
                </button>
              </div>
            )}

            {/* PANNEAU EXPORT */}
            <div className="px-4 pb-6">
              <ExportPanel
                costs={costs}
                quantites={quantites}
                totalGeneral={totalGeneral}
                currency={currency}
                subResults={subResults}
              />
            </div>
          </div>
        )}
      </main>

      {/* ── MODAL DEVIS ──────────────────────────────────── */}
      {showDevis && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-0 lg:p-4">
          <div className="bg-gray-900 w-full h-full lg:rounded-3xl lg:max-w-5xl lg:h-[90vh] flex flex-col shadow-2xl border border-gray-700">
            <div className="flex justify-between items-center p-4 border-b border-gray-800 lg:rounded-t-3xl">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <FileText className="text-blue-500 w-5 h-5" /> Devis Bâtiment
              </h2>
              <button onClick={() => setShowDevis(false)} className="p-2 bg-gray-800 hover:bg-gray-700 rounded-full border border-gray-700">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <Devis currency={currency} costs={costs} quantitesParEtape={quantites} totalGeneral={totalGeneral} subResults={subResults} />
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL EXPORT (desktop) ─────────────────────── */}
      {showExport && (
        <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-sm flex items-end lg:items-center justify-center p-0 lg:p-4">
          <div
            className="w-full lg:max-w-xl rounded-t-3xl lg:rounded-3xl shadow-2xl border overflow-hidden"
            style={{ background: "rgba(17,24,39,0.99)", borderColor: "rgba(99,102,241,0.3)" }}
          >
            <div className="flex justify-between items-center px-5 py-4 border-b" style={{ borderColor: "rgba(99,102,241,0.2)" }}>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Download className="w-4 h-4 text-indigo-400" /> Exporter le devis
              </h2>
              <button onClick={() => setShowExport(false)} className="p-2 bg-gray-800 hover:bg-gray-700 rounded-full border border-gray-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-4 pt-3 max-h-[55vh] overflow-y-auto">
              <RecapTable costs={costs} quantites={quantites} totalGeneral={totalGeneral} currency={currency} subResults={subResults} />
            </div>

            <div className="p-4">
              <ExportPanel costs={costs} quantites={quantites} totalGeneral={totalGeneral} currency={currency} subResults={subResults} onClose={() => setShowExport(false)} />
            </div>
            <div className="h-safe-area-inset-bottom lg:hidden" style={{ height: "env(safe-area-inset-bottom)" }} />
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
