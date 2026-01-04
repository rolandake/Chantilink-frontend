import React, { useEffect, useState, useMemo } from "react";
import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { useCalculator } from "../../../../shared/hooks/useCalculator.js";
import { AccotementsCalculator } from "@/domains/tp/calculators/AccotementsCalculator.js";
import { 
  Waypoints, Ruler, Banknote, Save, Trash2, History, Scale, Droplets, Info, Construction
} from "lucide-react";

ChartJS.register(ArcElement, Tooltip, Legend);

export default function AccotementsForm({ currency = "FCFA", onCostChange, onMateriauxChange }) {
  const {
    inputs,
    results,
    updateInput,
    history,
    saveToHistory,
    deleteFromHistory,
    clearHistory,
  } = useCalculator(AccotementsCalculator, "accotements", "tp");

  const [message, setMessage] = useState(null);

  // --- SYNC PARENT (Anti-Loop) ---
  const total = results?.total ?? 0;
  const volume = results?.volume ?? 0;
  const cimentT = results?.cimentT ?? 0;
  const sableT = results?.sableT ?? 0;
  const gravierT = results?.gravierT ?? 0;
  const eauL = results?.eauL ?? 0;

  useEffect(() => {
    if (onCostChange) onCostChange(total);
    if (onMateriauxChange) {
      onMateriauxChange({ volume, cimentT, sableT, gravierT, eauL });
    }
  }, [total, volume, cimentT, sableT, gravierT, eauL]);

  // --- ACTIONS ---
  const handleChange = (field) => (e) => updateInput(field, parseFloat(e.target.value) || 0);

  const showToast = (msg, type = "success") => {
    setMessage({ text: msg, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleSave = () => {
    if (!results || !results.volume) return showToast("⚠️ Dimensions invalides", "error");
    if (saveToHistory()) showToast("✅ Accotements sauvegardés !");
    else showToast("❌ Erreur sauvegarde", "error");
  };

  // --- GRAPHIQUE (Répartition des masses) ---
  const chartData = {
    labels: ["Ciment", "Sable", "Gravier"],
    datasets: [{
      data: [cimentT, sableT, gravierT],
      backgroundColor: ["#ec4899", "#fbbf24", "#78716c"],
      borderColor: "#111827",
      borderWidth: 2,
    }]
  };

  return (
    <div className="w-full h-full flex flex-col bg-gray-900 text-gray-100 overflow-hidden relative font-sans">
      
      {/* Notification */}
      {message && (
        <div className={`fixed top-4 right-4 px-6 py-3 rounded-xl shadow-2xl z-50 font-bold animate-in fade-in slide-in-from-top-2 ${
          message.type === "error" ? "bg-red-600" : "bg-pink-600"
        }`}>
          {message.text}
        </div>
      )}

      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-pink-500/20 rounded-lg text-pink-500">
            <Waypoints className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white uppercase tracking-tight">Accotements</h2>
            <p className="text-xs text-gray-400 font-medium italic">Stabilisation latérale de chaussée</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-gray-500 uppercase font-bold block">Budget Estimé</span>
          <span className="text-2xl font-black text-pink-400 tracking-tighter">
            {total.toLocaleString()} <span className="text-sm font-normal text-gray-500">{currency}</span>
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-6 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* GAUCHE : PARAMÈTRES GÉOMÉTRIQUES */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            <div className="bg-gray-800/50 border border-gray-700 rounded-3xl p-6 shadow-xl space-y-6">
              <h3 className="flex items-center gap-2 text-xs font-bold text-pink-400 uppercase tracking-widest">
                <Ruler className="w-4 h-4" /> Dimensionnement (Linéaire)
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label="Longueur (m)" value={inputs.longueur} onChange={handleChange("longueur")} placeholder="Ex: 500" />
                <InputGroup label="Largeur (m)" value={inputs.largeur} onChange={handleChange("largeur")} placeholder="Ex: 1.50" />
                <InputGroup label="Épaisseur (m)" value={inputs.epaisseur} onChange={handleChange("epaisseur")} placeholder="0.15" full />
              </div>
            </div>

            <div className="bg-gray-800/50 border border-gray-700 rounded-3xl p-6 shadow-xl space-y-6 flex-1">
              <h3 className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
                <Banknote className="w-4 h-4" /> Bordereau de Prix
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label={`PU Béton (${currency}/m³)`} value={inputs.prixUnitaire} onChange={handleChange("prixUnitaire")} />
                <InputGroup label={`Main d'œuvre (${currency}/m³)`} value={inputs.coutMainOeuvre} onChange={handleChange("coutMainOeuvre")} />
              </div>
              <button 
                onClick={handleSave}
                className="w-full bg-pink-600 hover:bg-pink-500 text-white py-4 rounded-2xl font-bold shadow-lg transition-all flex justify-center items-center gap-2 active:scale-95"
              >
                <Save className="w-5 h-5" /> Enregistrer la section
              </button>
            </div>
          </div>

          {/* DROITE : RÉSULTATS & LOGISTIQUE */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            
            <div className="grid grid-cols-3 gap-4">
              <ResultCard label="Volume Total" value={volume.toFixed(2)} unit="m³" icon={<Scale className="w-4 h-4"/>} color="text-pink-400" bg="bg-pink-500/10" />
              <ResultCard label="Surface" value={(inputs.longueur * inputs.largeur).toFixed(1)} unit="m²" icon={<Construction className="w-4 h-4"/>} color="text-white" bg="bg-gray-800" border />
              <ResultCard label="Besoin Eau" value={eauL.toFixed(0)} unit="L" icon={<Droplets className="w-4 h-4"/>} color="text-blue-400" bg="bg-blue-500/10" />
            </div>

            <div className="flex-1 bg-gray-800 rounded-3xl p-6 border border-gray-700 shadow-xl flex flex-col md:flex-row gap-8 items-center relative overflow-hidden">
               <div className="absolute -bottom-10 -right-10 w-44 h-44 bg-pink-600/10 rounded-full blur-3xl pointer-events-none" />

               <div className="w-44 h-44 flex-shrink-0 relative">
                  <Doughnut data={chartData} options={{ cutout: "75%", plugins: { legend: { display: false } } }} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                     <span className="text-[10px] text-gray-500 uppercase font-bold">Ciment</span>
                     <span className="text-sm font-bold text-white">{Math.ceil(cimentT * 20)} sacs</span>
                  </div>
               </div>

               <div className="flex-1 w-full space-y-4">
                  <h4 className="text-gray-400 text-xs font-bold uppercase tracking-widest border-b border-gray-700 pb-2 mb-2">Besoins Matériaux (Dosage 350kg)</h4>
                  <MaterialRow label="Ciment" val={`${cimentT.toFixed(2)} t`} color="bg-pink-500" />
                  <MaterialRow label="Sable (Ratio 0.6)" val={`${sableT.toFixed(2)} t`} color="bg-amber-500" />
                  <MaterialRow label="Gravier (Ratio 0.85)" val={`${gravierT.toFixed(2)} t`} color="bg-stone-500" />
                  
                  <div className="flex items-start gap-2 p-3 bg-blue-500/5 rounded-xl border border-blue-500/20 mt-4">
                    <Info className="w-4 h-4 text-blue-400 mt-0.5" />
                    <p className="text-[10px] text-blue-200/70 leading-relaxed italic">
                      Le dosage est optimisé pour une stabilisation durable contre l'érosion pluviale.
                    </p>
                  </div>
               </div>
            </div>

            {/* Historique Mini */}
            {history.length > 0 && (
              <div className="bg-gray-800/30 rounded-2xl border border-gray-700/50 overflow-hidden">
                <div className="px-4 py-2 bg-gray-800/50 border-b border-gray-700/50 flex justify-between items-center">
                  <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2"><History className="w-3 h-3" /> Dernières Saisies</h4>
                  <button onClick={clearHistory} className="text-[10px] text-red-400 hover:underline uppercase">Vider</button>
                </div>
                <div className="max-h-[120px] overflow-y-auto">
                  {history.slice(0, 5).map((item) => (
                    <div key={item.id} className="flex justify-between items-center p-3 border-b border-gray-700/30 hover:bg-gray-700/40 transition-colors">
                      <div className="text-xs">
                        <span className="text-gray-500 block text-[9px]">{item.date}</span>
                        <span className="font-medium">Section {item.inputs.longueur}m x {item.inputs.largeur}m</span>
                      </div>
                      <span className="text-sm font-bold text-pink-400">{parseFloat(item.results.total).toLocaleString()} {currency}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- SOUS-COMPOSANTS ---

const InputGroup = ({ label, value, onChange, placeholder, full = false }) => (
  <div className={`flex flex-col ${full ? "col-span-2" : ""}`}>
    <label className="mb-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-wide">{label}</label>
    <input
      type="number" value={value || ""} onChange={onChange}
      className="w-full bg-gray-900 border border-gray-600 rounded-xl px-4 py-3 text-white focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition-all font-mono text-sm"
      placeholder={placeholder || "0"}
    />
  </div>
);

const ResultCard = ({ label, value, unit, color, bg, border, icon }) => (
  <div className={`rounded-2xl p-4 flex flex-col justify-center items-center text-center ${bg} ${border ? 'border border-gray-700' : ''}`}>
    <span className="text-[10px] text-gray-500 uppercase font-bold mb-1 flex items-center gap-1">
      {icon} {label}
    </span>
    <span className={`text-xl font-black ${color}`}>
      {value} <span className="text-xs font-normal text-gray-500 lowercase">{unit}</span>
    </span>
  </div>
);

const MaterialRow = ({ label, val, color }) => (
  <div className="flex justify-between items-center border-b border-gray-700/30 pb-2 last:border-0">
    <div className="flex items-center gap-2">
      <div className={`w-1.5 h-1.5 rounded-full ${color}`} />
      <span className="text-gray-300 text-xs font-medium">{label}</span>
    </div>
    <span className="text-xs font-bold text-white font-mono">{val}</span>
  </div>
);