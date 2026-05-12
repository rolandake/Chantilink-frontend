import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import * as XLSX from "xlsx";

export default function SyntheseCalculs() {
  const { token } = useAuth();
  const [calculs, setCalculs]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error,   setError]     = useState("");

  // ✅ FIX 1 — normalise la réponse API :
  //   - accepte { calculs: [] } OU un tableau direct
  //   - filtre les éléments null / undefined / sans _id
  //   - ne plante pas si l'API renvoie une erreur JSON
  const normalizeData = useCallback((data) => {
    const raw = Array.isArray(data) ? data : data?.calculs ?? [];
    return raw.filter(Boolean).filter((c) => c?._id);
  }, []);

  useEffect(() => {
    if (!token) {
      setError("Token manquant. Reconnectez-vous.");
      setLoading(false);
      return;
    }

    fetch("/api/calculs", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setCalculs(normalizeData(data));
        setLoading(false);
      })
      .catch((err) => {
        console.error("❌ [SyntheseCalculs]", err);
        setError("Erreur lors de la récupération des calculs.");
        setLoading(false);
      });
  }, [token, normalizeData]);

  // ✅ FIX 2 — export sécurisé : ne plante pas si calculs est vide
  const exportExcel = useCallback(() => {
    if (!calculs.length) return;

    // Aplatit les données pour l'export
    const rows = calculs.map((c) => ({
      Type:        c.type        ?? "—",
      Projet:      c.projectType ?? "—",
      "Sous-type": c.calculationType ?? "—",
      Date:        c.savedAt ? new Date(c.savedAt).toLocaleString("fr-FR") :
                  c.createdAt ? new Date(c.createdAt).toLocaleString("fr-FR") : "—",
      Inputs:      JSON.stringify(c.inputs  ?? {}),
      Résultats:   JSON.stringify(c.results ?? c.result ?? {}),
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Calculs");
    XLSX.writeFile(wb, "synthese_calculs.xlsx");
  }, [calculs]);

  // ── États UI ──────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-6">
        <h2 className="text-xl font-bold mb-4">📊 Synthèse de vos calculs</h2>
        <div className="flex items-center gap-3 text-gray-400">
          <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          Chargement…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <h2 className="text-xl font-bold mb-4">📊 Synthèse de vos calculs</h2>
        <p className="text-red-500 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm">
          {error}
        </p>
      </div>
    );
  }

  // ── Rendu principal ────────────────────────────────────────
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">📊 Synthèse de vos calculs</h2>
        <button
          onClick={exportExcel}
          disabled={calculs.length === 0}
          className="bg-green-600 hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all active:scale-95"
        >
          Exporter Excel
        </button>
      </div>

      <div className="overflow-auto rounded-xl border border-gray-200">
        {calculs.length === 0 ? (
          <p className="p-6 text-center text-gray-400 italic">Aucun calcul disponible.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-left">
              <tr>
                <th className="p-3 font-semibold text-gray-600 whitespace-nowrap">Type</th>
                <th className="p-3 font-semibold text-gray-600 whitespace-nowrap">Projet</th>
                <th className="p-3 font-semibold text-gray-600">Entrées</th>
                <th className="p-3 font-semibold text-gray-600">Résultats</th>
                <th className="p-3 font-semibold text-gray-600 whitespace-nowrap">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {calculs.map((calc) => {
                // ✅ FIX 3 — accès défensif à chaque propriété
                const inputs  = calc?.inputs  ?? {};
                const results = calc?.results ?? calc?.result ?? {};
                const date    = calc?.savedAt ?? calc?.createdAt;

                return (
                  <tr key={calc._id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-3 font-medium align-top whitespace-nowrap">
                      {calc.type ?? "—"}
                    </td>
                    <td className="p-3 align-top whitespace-nowrap text-gray-500 text-xs">
                      {calc.projectType ?? "—"}
                      {calc.calculationType && (
                        <span className="block text-[10px] text-gray-400">{calc.calculationType}</span>
                      )}
                    </td>
                    <td className="p-3 align-top max-w-xs">
                      <pre className="whitespace-pre-wrap text-xs text-gray-600 font-mono bg-gray-50 rounded p-2 max-h-32 overflow-auto">
                        {JSON.stringify(inputs, null, 2)}
                      </pre>
                    </td>
                    <td className="p-3 align-top max-w-xs">
                      {/* ✅ FIX 4 — results.total ne plante plus même si undefined */}
                      <pre className="whitespace-pre-wrap text-xs text-gray-600 font-mono bg-gray-50 rounded p-2 max-h-32 overflow-auto">
                        {JSON.stringify(results, null, 2)}
                      </pre>
                    </td>
                    <td className="p-3 align-top whitespace-nowrap text-xs text-gray-400">
                      {date ? new Date(date).toLocaleString("fr-FR") : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <p className="mt-3 text-xs text-gray-400 text-right">
        {calculs.length} calcul{calculs.length !== 1 ? "s" : ""} chargé{calculs.length !== 1 ? "s" : ""}
      </p>
    </div>
  );
}