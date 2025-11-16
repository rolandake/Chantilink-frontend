import { useState } from "react";
import * as XLSX from "xlsx";

export default function CalculationEngine({ planData, calculations }) {
  const [generating, setGenerating] = useState(false);

  const generatePDF = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/vision-ai/report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify({ planData, calculations })
      });
      const { url } = await res.json();
      window.open(url, "_blank");
    } catch (err) {
      alert("Erreur PDF");
    } finally {
      setGenerating(false);
    }
  };

  const exportExcel = () => {
    const data = [
      ["Élément", "Valeur", "Unité"],
      ["Surface", planData?.area, "m²"],
      ["Béton", calculations?.concrete, "m³"],
      ["Acier", calculations?.steel, "kg"],
      ["Coût", calculations?.totalCost, "€"]
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Calculs");
    XLSX.writeFile(wb, `visionia_${Date.now()}.xlsx`);
  };

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-bold text-purple-400">Calculs</h3>
      <div className="bg-gray-800 p-4 rounded-lg text-sm">
        <p><strong>Surface:</strong> {planData?.area} m²</p>
        <p><strong>Béton:</strong> {calculations?.concrete} m³</p>
        <p><strong>Acier:</strong> {calculations?.steel} kg</p>
        <p><strong>Coût:</strong> {calculations?.totalCost?.toLocaleString()} €</p>
      </div>
      <button onClick={generatePDF} disabled={generating} className="w-full py-3 bg-green-600 rounded-xl font-bold">
        {generating ? "PDF..." : "PDF"}
      </button>
      <button onClick={exportExcel} className="w-full py-3 bg-blue-600 rounded-xl font-bold">
        EXCEL
      </button>
    </div>
  );
}