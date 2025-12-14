import React, { useState, useEffect, useMemo } from "react";
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { 
  BrickWall, Ruler, Banknote, Save, Trash2, History, Layers, Droplets 
} from "lucide-react";

ChartJS.register(ArcElement, Tooltip, Legend);

const STORAGE_KEY = "murs-batiment-history";

const DOSAGE = {
  ciment: 0.350, sable: 0.5, gravier: 0.8, acier: 0.050, eau: 180 
};

export default function Murs({ currency = "XOF", onTotalChange, onMateriauxChange }) {
  const [inputs, setInputs] = useState({ surface: "", epaisseur: "", prixUnitaire: "", coutMainOeuvre: "" });
  const [historique, setHistorique] = useState([]);
  const [message, setMessage] = useState(null);

  const results = useMemo(() => {
    const S = parseFloat(inputs.surface) || 0;
    const e = parseFloat(inputs.epaisseur) || 0;
    const pu = parseFloat(inputs.prixUnitaire) || 0;
    const mo = parseFloat(inputs.coutMainOeuvre) || 0;
    const volume = S * e;
    const cimentT = volume * DOSAGE.ciment;
    const sableT = volume * DOSAGE.sable;
    const gravierT = volume * DOSAGE.gravier;
    const acierT = volume * DOSAGE.acier;
    const eauL = volume * DOSAGE.eau;
    const coutMateriaux = volume * pu;
    const total = coutMateriaux + mo;
    return { volume, cimentT, sableT, gravierT, acierT, eauL, coutMateriaux, mo, total };
  }, [inputs]);

  useEffect(() => {
    if (onTotalChange) onTotalChange(results.total);
    if (onMateriauxChange) onMateriauxChange({ volume: results.volume, ciment: results.cimentT, acier: results.acierT });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results.total]);

  // Chargement Historique
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setHistorique(JSON.parse(saved));
    } catch {}
  }, []);

  const handleChange = (field) => (e) => setInputs(prev => ({ ...prev, [field]: e.target.value }));
  
  const handleSave = () => {
    if (results.volume <= 0) return; // Simple check
    const newEntry = { id: Date.now(), date: new Date().toLocaleString(), inputs, results };
    const newHist = [newEntry, ...historique];
    setHistorique(newHist);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newHist));
    setMessage("Sauvegardé !");
    setTimeout(() => setMessage(null), 2000);
  };

  const chartData = {
    labels: ["Matériaux", "Main d'œuvre"],
    datasets: [{
      data: [results.coutMateriaux, results.mo],
      backgroundColor: ["#f97316", "#3b82f6"],
      borderColor: "#1f2937",
      borderWidth: 0,
    }]
  };

  return (
    // 🛑 FIX SCROLL : Structure Flex qui prend toute la hauteur mais ne dépasse pas
    <div className="flex flex-col h-full w-full bg-gray-900 text-gray-100 overflow-hidden relative">
      
      {message && <div className="absolute top-4 right-4 bg-green-600 px-4 py-2 rounded-lg z-50 shadow-lg">{message}</div>}

      {/* Header Local (optionnel, déjà présent dans Elevations, mais utile pour le contexte) */}
      <div className="flex-shrink-0 p-4 border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm flex justify-between items-center">
        <div className="flex items-center gap-2 text-orange-500 font-bold">
          <BrickWall className="w-5 h-5" /> Murs
        </div>
        <div className="text-sm font-bold text-orange-400">
          {results.total.toLocaleString()} {currency}
        </div>
      </div>

      {/* 🛑 FIX SCROLL : C'est CE div qui doit avoir overflow-y-auto */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-6 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* GAUCHE : SAISIE */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5 shadow-lg">
              <h3 className="flex items-center gap-2 text-sm font-bold text-orange-400 uppercase tracking-wider mb-4">
                <Ruler className="w-4 h-4" /> Dimensions
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col col-span-2">
                  <label className="text-[10px] text-gray-400 uppercase font-bold mb-1">Surface (m²)</label>
                  <input type="number" value={inputs.surface} onChange={handleChange("surface")} className="bg-gray-900 border border-gray-600 rounded-lg p-2.5 text-white focus:border-orange-500 focus:outline-none" placeholder="Ex: 50" />
                </div>
                <div className="flex flex-col col-span-2">
                  <label className="text-[10px] text-gray-400 uppercase font-bold mb-1">Épaisseur (m)</label>
                  <input type="number" value={inputs.epaisseur} onChange={handleChange("epaisseur")} className="bg-gray-900 border border-gray-600 rounded-lg p-2.5 text-white focus:border-orange-500 focus:outline-none" placeholder="Ex: 0.20" />
                </div>
              </div>
            </div>

            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5 shadow-lg">
              <h3 className="flex items-center gap-2 text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">
                <Banknote className="w-4 h-4" /> Coûts
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col">
                  <label className="text-[10px] text-gray-400 uppercase font-bold mb-1">Prix Béton/m³</label>
                  <input type="number" value={inputs.prixUnitaire} onChange={handleChange("prixUnitaire")} className="bg-gray-900 border border-gray-600 rounded-lg p-2.5 text-white focus:border-orange-500 focus:outline-none" />
                </div>
                <div className="flex flex-col">
                  <label className="text-[10px] text-gray-400 uppercase font-bold mb-1">Main d'œuvre</label>
                  <input type="number" value={inputs.coutMainOeuvre} onChange={handleChange("coutMainOeuvre")} className="bg-gray-900 border border-gray-600 rounded-lg p-2.5 text-white focus:border-orange-500 focus:outline-none" />
                </div>
              </div>
              <button onClick={handleSave} className="w-full mt-4 bg-orange-600 hover:bg-orange-500 text-white py-3 rounded-xl font-bold shadow-lg active:scale-95 transition flex justify-center gap-2">
                <Save className="w-5 h-5" /> Sauvegarder
              </button>
            </div>
          </div>

          {/* DROITE : RÉSULTATS */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            <div className="grid grid-cols-3 gap-4">
              <ResultCard label="Volume" value={results.volume.toFixed(2)} unit="m³" />
              <ResultCard label="Ciment" value={(results.cimentT*1000/50).toFixed(1)} unit="sacs" />
              <ResultCard label="Acier" value={(results.acierT*1000).toFixed(0)} unit="kg" />
            </div>

            <div className="flex-1 bg-gray-800 rounded-2xl p-6 border border-gray-700 shadow-xl flex flex-col md:flex-row gap-6 items-center">
               <div className="w-32 h-32 relative">
                  <Doughnut data={chartData} options={{ cutout: "70%", plugins: { legend: { display: false } } }} />
               </div>
               <div className="flex-1 w-full space-y-2">
                  <MaterialRow label="Ciment" val={`${results.cimentT.toFixed(2)} t`} color="bg-orange-500" />
                  <MaterialRow label="Sable" val={`${results.sableT.toFixed(2)} t`} color="bg-amber-500" />
                  <MaterialRow label="Gravier" val={`${results.gravierT.toFixed(2)} t`} color="bg-stone-500" />
                  <div className="pt-2 border-t border-gray-700 flex justify-between text-xs">
                    <span className="text-gray-400">Eau</span>
                    <span className="text-white font-bold">{results.eauL.toFixed(0)} L</span>
                  </div>
               </div>
            </div>

            {/* Historique */}
            {historique.length > 0 && (
              <div className="bg-gray-800/30 rounded-2xl border border-gray-700/50 p-4 max-h-[200px] overflow-y-auto">
                <h4 className="text-xs font-bold text-gray-400 mb-3 flex items-center gap-2"><History className="w-3 h-3"/> Historique</h4>
                {historique.map(h => (
                   <div key={h.id} className="flex justify-between items-center text-xs p-2 bg-gray-700/30 rounded mb-2 border border-transparent hover:border-orange-500/30">
                      <span className="text-gray-400">{h.date.split(' ')[0]}</span>
                      <span className="text-white font-bold">{parseFloat(h.results.total).toLocaleString()} {currency}</span>
                   </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const ResultCard = ({ label, value, unit }) => (
  <div className="bg-gray-800 border border-gray-700 p-3 rounded-xl text-center">
    <div className="text-[10px] text-gray-400 uppercase font-bold mb-1">{label}</div>
    <div className="text-xl font-black text-orange-400">{value} <span className="text-xs text-gray-500 font-normal">{unit}</span></div>
  </div>
);

const MaterialRow = ({ label, val, color }) => (
  <div className="flex justify-between text-xs items-center">
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${color}`} />
      <span className="text-gray-300">{label}</span>
    </div>
    <span className="font-bold text-white">{val}</span>
  </div>
);