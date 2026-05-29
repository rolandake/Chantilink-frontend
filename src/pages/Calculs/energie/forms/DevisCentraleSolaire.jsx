import React from 'react';
import { useState, useEffect } from 'react';
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import {
  addPdfFooters,
  createChantilinkLogoCanvas,
  drawChantilinkHeader,
  fmtPdfMoney,
} from "../../utils/exportBranding";

const ouvragesInit = [
  {
    nom: "Panneaux Solaires",
    materiaux: ["Panneau photovoltaïque 350W", "Structure support", "Visserie"],
  },
  {
    nom: "Onduleurs",
    materiaux: ["Onduleur 5kW", "Câbles AC", "Boîte de protection"],
  },
  {
    nom: "Batteries",
    materiaux: ["Batterie Li-ion 10kWh", "Système de gestion BMS"],
  },
  {
    nom: "Câblage",
    materiaux: ["Câble DC 6mm²", "Câble AC 10mm²", "Gaines"],
  },
  {
    nom: "Installation",
    materiaux: ["Main d’œuvre", "Transport", "Mise en service"],
  },
];

const LS_KEYS = {
  ouvrages: "devis_solaire_ouvrages",
  prixUnitaires: "devis_solaire_prixUnitaires",
};

export default function DevisCentraleSolaire({ currency = "XOF" }) {
  const [ouvrages, setOuvrages] = useState(() => {
    try {
      const raw = localStorage.getItem(LS_KEYS.ouvrages);
      if (raw) return JSON.parse(raw);
    } catch {}
    return ouvragesInit.map(({ nom, materiaux }) => ({
      nom,
      materiaux: materiaux.map((m) => ({ nom: m, quantite: "" })),
    }));
  });

  const [prixUnitaires, setPrixUnitaires] = useState(() => {
    const mats = new Set();
    ouvragesInit.forEach(({ materiaux }) => {
      materiaux.forEach((m) => mats.add(m.toLowerCase()));
    });
    const obj = {};
    mats.forEach((m) => (obj[m] = ""));
    try {
      const raw = localStorage.getItem(LS_KEYS.prixUnitaires);
      if (raw) return { ...obj, ...JSON.parse(raw) };
    } catch {}
    return obj;
  });

  useEffect(() => {
    localStorage.setItem(LS_KEYS.ouvrages, JSON.stringify(ouvrages));
  }, [ouvrages]);

  useEffect(() => {
    localStorage.setItem(LS_KEYS.prixUnitaires, JSON.stringify(prixUnitaires));
  }, [prixUnitaires]);

  const handleQuantiteChange = (indexOuvrage, matNom, val) => {
    setOuvrages((prev) => {
      const copy = [...prev];
      const ouvrage = copy[indexOuvrage];
      ouvrage.materiaux = ouvrage.materiaux.map((m) =>
        m.nom === matNom ? { ...m, quantite: val } : m
      );
      return copy;
    });
  };

  const handlePrixUnitaireChange = (mat, val) => {
    setPrixUnitaires((prev) => ({ ...prev, [mat]: val }));
  };

  const handleAjoutMateriau = (indexOuvrage, nom) => {
    if (!nom.trim()) return;
    setOuvrages((prev) => {
      const copy = [...prev];
      const ouvrage = copy[indexOuvrage];
      ouvrage.materiaux.push({ nom: nom.trim(), quantite: "" });
      return copy;
    });
  };

  const supprimerMateriau = (indexOuvrage, nom) => {
    setOuvrages((prev) => {
      const copy = [...prev];
      copy[indexOuvrage].materiaux = copy[indexOuvrage].materiaux.filter((m) => m.nom !== nom);
      return copy;
    });
  };

  const [cumul, setCumul] = useState({});
  const [couts, setCouts] = useState({});
  const [totalGlobal, setTotalGlobal] = useState(0);

  useEffect(() => {
    const newCumul = {};
    ouvrages.forEach(({ materiaux }) => {
      materiaux.forEach(({ nom, quantite }) => {
        const mLower = nom.toLowerCase();
        const qte = parseFloat((quantite ?? "").toString().replace(",", "."));
        if (!isNaN(qte)) {
          newCumul[mLower] = (newCumul[mLower] || 0) + qte;
        }
      });
    });
    const newCouts = {};
    Object.keys(newCumul).forEach((m) => {
      const qte = newCumul[m] || 0;
      const pu = parseFloat((prixUnitaires[m] ?? "").toString().replace(",", ".")) || 0;
      newCouts[m] = qte * pu;
    });
    setCumul(newCumul);
    setCouts(newCouts);
    setTotalGlobal(Object.values(newCouts).reduce((a, b) => a + b, 0));
  }, [ouvrages, prixUnitaires]);

  const reinitialiserDevis = () => {
    if (!confirm("Réinitialiser tout le devis ?")) return;
    setOuvrages(
      ouvragesInit.map(({ nom, materiaux }) => ({
        nom,
        materiaux: materiaux.map((m) => ({ nom: m, quantite: "" })),
      }))
    );
    setPrixUnitaires({});
  };

  const exportToExcel = () => {
    const detailData = [];
    ouvrages.forEach(({ nom, materiaux }) => {
      materiaux.forEach(({ nom: matNom, quantite }, i) => {
        detailData.push({
          Ouvrage: i === 0 ? nom : "",
          Matériau: matNom,
          Quantité: quantite || 0,
        });
      });
    });

    const wb = XLSX.utils.book_new();
    const ws0 = XLSX.utils.aoa_to_sheet([
      ["CHANTILINK - DEVIS CENTRALE SOLAIRE", "", "", ""],
      [`Date : ${new Date().toLocaleDateString("fr-FR")}`, "", "", ""],
      [""],
      ["Indicateur", "Valeur", "Unité", "Observation"],
      ["Ouvrages", ouvrages.length, "u", "Détail dans l'onglet Détail par ouvrage"],
      ["Matériaux cumulés", Object.keys(cumul).filter((m) => Number(cumul[m] || 0) > 0).length, "u", "Détail dans l'onglet Cumul global"],
      ["Total TTC", totalGlobal, currency, "Montant global estimatif"],
    ]);
    ws0["!cols"] = [{ wch: 34 }, { wch: 18 }, { wch: 14 }, { wch: 48 }];
    ws0["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }];
    XLSX.utils.book_append_sheet(wb, ws0, "Synthèse");
    const wsDetail = XLSX.utils.json_to_sheet(detailData);
    wsDetail["!cols"] = [{ wch: 28 }, { wch: 36 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, wsDetail, "Détail par ouvrage");

    const cumulData = Object.keys(cumul).map((m) => ({
      Matériau: m,
      Quantité: cumul[m].toFixed(2),
      "Prix unitaire": prixUnitaires[m],
      Total: couts[m].toFixed(2),
      Devise: currency,
    }));
    cumulData.push({
      Matériau: "Total TTC",
      Total: totalGlobal.toFixed(2),
      Devise: currency,
    });

    const wsCumul = XLSX.utils.json_to_sheet(cumulData);
    XLSX.utils.book_append_sheet(wb, wsCumul, "Cumul global");

    const dateStr = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    XLSX.writeFile(wb, `devis_centrale_solaire_${dateStr}.xlsx`);
  };

  const exportToPDF = async () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const logoDataUrl = await createChantilinkLogoCanvas().catch(() => null);

    drawChantilinkHeader(doc, {
      logoDataUrl,
      title: "DEVIS CENTRALE SOLAIRE",
      subtitle: "Récapitulatif global des ouvrages",
    });

    doc.setFillColor(243, 244, 246);
    doc.roundedRect(14, 38, pageWidth - 28, 18, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(75, 85, 99);
    doc.text("OUVRAGES", 20, 46);
    doc.text("MATERIAUX", 96, 46);
    doc.text("TOTAL TTC", 172, 46);
    doc.setFontSize(11);
    doc.setTextColor(17, 24, 39);
    doc.text(String(ouvrages.length), 20, 52);
    doc.text(String(Object.keys(cumul).filter((m) => Number(cumul[m] || 0) > 0).length), 96, 52);
    doc.text(fmtPdfMoney(totalGlobal, currency), 172, 52);

    const detailBody = [];
    ouvrages.forEach(({ nom, materiaux }) => {
      materiaux.forEach(({ nom: matNom, quantite }, i) => {
        detailBody.push([i === 0 ? nom : "", matNom, quantite || ""]);
      });
    });

    doc.autoTable({
      startY: 64,
      head: [["Ouvrage", "Matériau", "Quantité"]],
      body: detailBody,
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 2.5, lineColor: [229, 231, 235], valign: "top" },
      headStyles: { fillColor: [249, 115, 22], textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [255, 247, 237] },
      columnStyles: { 0: { cellWidth: 72, fontStyle: "bold" }, 1: { cellWidth: 136 }, 2: { cellWidth: 56, halign: "right", fontStyle: "bold" } },
      margin: { left: 14, right: 14 },
    });

    doc.addPage();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(249, 115, 22);
    doc.text("CUMUL GLOBAL", 10, 18);

    const cumulBody = Object.keys(cumul).map((m) => [
      m,
      cumul[m].toFixed(2),
      prixUnitaires[m] || "",
      fmtPdfMoney(couts[m] || 0, currency),
    ]);
    cumulBody.push(["Total TTC", "", "", fmtPdfMoney(totalGlobal, currency)]);

    doc.autoTable({
      startY: 26,
      head: [["Matériau", "Quantité", `Prix unitaire (${currency})`, `Total (${currency})`]],
      body: cumulBody,
      theme: "grid",
      styles: { fontSize: 11, cellPadding: 3.5, lineColor: [229, 231, 235] },
      headStyles: { fillColor: [249, 115, 22], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 11 },
      alternateRowStyles: { fillColor: [255, 247, 237] },
      columnStyles: { 0: { cellWidth: 105, fontStyle: "bold" }, 1: { cellWidth: 50, halign: "right" }, 2: { cellWidth: 58, halign: "right" }, 3: { cellWidth: 64, halign: "right", fontStyle: "bold" } },
      margin: { left: 10, right: 10 },
    });

    addPdfFooters(doc, "ChantiLink - devis centrale solaire");
    const dateStr = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    doc.save(`devis_centrale_solaire_${dateStr}.pdf`);
  };

  return (
    <div className="p-6 bg-gray-900 text-white max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-center mb-6 text-orange-400">Devis Centrale Solaire</h1>

      <div className="flex justify-end gap-3 mb-4">
        <button onClick={reinitialiserDevis} className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded">
          Réinitialiser
        </button>
      </div>

      {ouvrages.map(({ nom, materiaux }, idx) => {
        const [nouveauMat, setNouveauMat] = useState("");
        return (
          <section key={idx} className="mb-6 bg-gray-800 p-4 rounded">
            <h2 className="text-xl font-semibold mb-2">{nom}</h2>

            <table className="w-full table-auto border border-gray-700 mb-2">
              <thead>
                <tr>
                  <th className="px-2 py-1 border">Matériau</th>
                  <th className="px-2 py-1 border">Quantité</th>
                  <th className="px-2 py-1 border">Supprimer</th>
                </tr>
              </thead>
              <tbody>
                {materiaux.map(({ nom: matNom, quantite }) => (
                  <tr>
                    <td className="border px-2 py-1">{matNom}</td>
                    <td className="border px-2 py-1">
                      <input
                        value={quantite}
                        onInput={(e) =>
                          handleQuantiteChange(idx, matNom, e.currentTarget.value)
                        }
                        className="w-24 p-1 bg-gray-700 text-right"
                        placeholder="0"
                      />
                    </td>
                    <td className="border px-2 py-1 text-center">
                      <button
                        onClick={() => supprimerMateriau(idx, matNom)}
                        className="text-red-400 hover:text-red-600"
                      >
                        ✖
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex gap-2 mt-2">
              <input
                type="text"
                placeholder="Nouveau matériau"
                className="bg-gray-700 p-2 rounded w-full"
                value={nouveauMat}
                onInput={(e) => setNouveauMat(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleAjoutMateriau(idx, nouveauMat);
                    setNouveauMat("");
                  }
                }}
              />
              <button
                onClick={() => {
                  handleAjoutMateriau(idx, nouveauMat);
                  setNouveauMat("");
                }}
                className="bg-orange-500 hover:bg-orange-600 px-4 rounded"
              >
                +
              </button>
            </div>
          </section>
        );
      })}

      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-3">Cumul global</h2>
        <table className="w-full table-auto border border-gray-700">
          <thead>
            <tr>
              <th className="px-2 py-1 border">Matériau</th>
              <th className="px-2 py-1 border">Quantité</th>
              <th className="px-2 py-1 border">Prix unitaire ({currency})</th>
              <th className="px-2 py-1 border">Total ({currency})</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(cumul).map(([mat, qte]) => (
              <tr>
                <td className="border px-2 py-1">{mat}</td>
                <td className="border px-2 py-1 text-right">{qte.toFixed(2)}</td>
                <td className="border px-2 py-1 text-right">
                  <input
                    value={prixUnitaires[mat] || ""}
                    onInput={(e) => handlePrixUnitaireChange(mat, e.currentTarget.value)}
                    className="w-20 p-1 bg-gray-700 text-right"
                  />
                </td>
                <td className="border px-2 py-1 text-right text-green-400">
                  {(couts[mat] || 0).toFixed(2)}
                </td>
              </tr>
            ))}
            <tr className="bg-gray-800 font-bold text-orange-400">
              <td className="border px-2 py-1">Total TTC</td>
              <td></td>
              <td></td>
              <td className="border px-2 py-1 text-right">{totalGlobal.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <div className="text-center mt-6 space-x-4">
        <button
          onClick={exportToExcel}
          className="bg-orange-500 px-6 py-2 rounded hover:bg-orange-600"
        >
          Export Excel
        </button>
        <button
          onClick={exportToPDF}
          className="bg-blue-600 px-6 py-2 rounded hover:bg-blue-700"
        >
          Export PDF
        </button>
      </div>
    </div>
  );
}



