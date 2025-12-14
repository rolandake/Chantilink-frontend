import React, { useEffect, useState } from "react"; // Suppression de useCallback inutile ici
import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { 
  Pickaxe, Truck, Ruler, Save, Trash2, History, Info 
} from "lucide-react";
import { useCalculator } from "../../../../shared/hooks/useCalculator.js";
// Assure-toi que le chemin est bon selon ton projet
import { TerrassementCalculator } from "@/domains/tp/calculators/TerrassementCalculator.js";

ChartJS.register(ArcElement, Tooltip, Legend);

export default function Terrassement({ currency = "XOF", onCostChange, onMateriauxChange }) {
  const {
    inputs,
    results,
    updateInput,
    history,
    saveToHistory,
    deleteFromHistory,
    clearHistory,
  } = useCalculator(TerrassementCalculator, "terrassement", "tp");

  const [message, setMessage] = useState("");

  // =========================================================================
  // ✅ CORRECTION DE LA BOUCLE INFINIE
  // On extrait les valeurs primitives (nombres) pour les dépendances
  // =========================================================================
  const total = results?.total ?? 0;
  const volumeExcave = results?.volumeExcave ?? 0;
  const volumeFoisonne = results?.volumeFoisonne ?? 0;
  const nombreCamions = results?.nombreCamions ?? 0;
  const coutExcavation = results?.coutTotalExcavation ?? 0;
  const coutEvacuation = results?.coutTotalEvacuation ?? 0;

  useEffect(() => {
    // On ne déclenche la mise à jour du parent QUE si les chiffres changent.
    // On ignore les fonctions (onCostChange, etc) dans le tableau de dépendances
    // pour éviter que le re-render du parent ne relance cet effet.

    if (onCostChange) {
      onCostChange(total);
    }
    
    if (onMateriauxChange) {
      onMateriauxChange({
        volumeExcave,
        volumeFoisonne,
        camions: nombreCamions
      });
    }
    
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total, volumeExcave, volumeFoisonne, nombreCamions]); 
  // ⬆️ Dépendances uniquement sur les valeurs primitives

  const handleChange = (field) => (e) => updateInput(field, parseFloat(e.target.value) || 0);

  const showMessage = (msg, type = "success") => {
    setMessage({ text: msg, type });
    setTimeout(() => setMessage(""), 3000);
  };

  const handleSave = () => {
    if (!results || !results.volumeExcave) return showMessage("⚠️ Dimensions invalides", "error");
    if (saveToHistory()) showMessage("✅ Calcul sauvegardé !", "success");
    else showMessage("❌ Erreur sauvegarde", "error");
  };

  return (
    <div className="w-full h-full flex flex-col bg-gray-900 text-gray-100 overflow-hidden relative">
      
      {/* Toast Notification */}
      {message && (
        <div className={`fixed top-4 right-4 px-6 py-3 rounded-xl shadow-2xl z-50 font-bold animate-in fade-in slide-in-from-top-2 ${
          message.type === "error" ? "bg-red-600 text-white" : "bg-emerald-500 text-white"
        }`}>
          {message.text}
        </div>
      )}

      {/* Header compact */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-yellow-600/20 rounded-lg text-yellow-500">
            <Pickaxe className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Terrassement</h2>
            <p className="text-xs text-gray-400">Excavation & Remblai</p>
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg px-4 py-2 border border-gray-700">
          <span className="text-xs text-gray-400 block">Coût Total</span>
          <span className="text-lg font-black text-yellow-400">
            {total.toLocaleString()} <span className="text-sm">{currency}</span>
          </span>
        </div>
      </div>

      {/* Contenu principal - Grid Layout */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
          
          {/* COLONNE GAUCHE : SAISIE */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            
            {/* Carte Dimensions */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5 shadow-lg">
              <h3 className="flex items-center gap-2 text-sm font-bold text-gray-300 mb-4 uppercase tracking-wider">
                <Ruler className="w-4 h-4 text-blue-400" /> Dimensions Fouille
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label="Longueur (m)" name="longueur" value={inputs.longueur} onChange={handleChange} />
                <InputGroup label="Largeur (m)" name="largeur" value={inputs.largeur} onChange={handleChange} />
                <InputGroup label="Profondeur (m)" name="profondeur" value={inputs.profondeur} onChange={handleChange} full />
              </div>
            </div>

            {/* Carte Paramètres Techniques */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5 shadow-lg flex-1">
              <h3 className="flex items-center gap-2 text-sm font-bold text-gray-300 mb-4 uppercase tracking-wider">
                <Truck className="w-4 h-4 text-orange-400" /> Paramètres & Coûts
              </h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <InputGroup 
                    label="Foisonnement (%)" 
                    name="foisonnement" 
                    value={inputs.foisonnement} 
                    onChange={handleChange} 
                    tooltip="Augmentation du volume de terre une fois extraite (généralement 20-30%)"
                  />
                  <InputGroup 
                    label="Capacité Camion (m³)" 
                    name="capaciteCamion" 
                    value={inputs.capaciteCamion} 
                    onChange={handleChange} 
                  />
                </div>
                <div className="h-px bg-gray-700/50 my-2" />
                <InputGroup label={`Prix Excavation (${currency}/m³)`} name="prixExcavation" value={inputs.prixExcavation} onChange={handleChange} />
                <InputGroup label={`Prix Évacuation (${currency}/voyage)`} name="prixEvacuation" value={inputs.prixEvacuation} onChange={handleChange} />
              </div>

              {/* Actions Rapides */}
              <div className="mt-6 flex gap-3">
                <button 
                  onClick={handleSave}
                  className="flex-1 bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 text-white py-3 rounded-xl font-bold shadow-lg shadow-orange-900/20 active:scale-95 transition-all flex justify-center items-center gap-2"
                >
                  <Save className="w-5 h-5" /> Sauvegarder
                </button>
                <button 
                  onClick={() => inputs.longueur && updateInput('longueur', 0)} 
                  className="px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-xl transition-colors"
                  title="Réinitialiser"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* COLONNE DROITE : RÉSULTATS */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            
            {/* KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <ResultCard 
                label="Volume en place" 
                value={volumeExcave.toFixed(2)} 
                unit="m³" 
                color="text-blue-400" 
                bgColor="bg-blue-500/10"
              />
              <ResultCard 
                label="Volume foisonné" 
                value={volumeFoisonne.toFixed(2)} 
                unit="m³" 
                color="text-orange-400" 
                bgColor="bg-orange-500/10"
                border
              />
              <ResultCard 
                label="Camions nécessaires" 
                value={Math.ceil(nombreCamions)} 
                unit="voyages" 
                color="text-emerald-400" 
                bgColor="bg-emerald-500/10"
              />
            </div>

            {/* Graphique */}
            <div className="flex-1 bg-gray-800 rounded-2xl p-6 border border-gray-700 shadow-xl flex flex-col md:flex-row gap-8 items-center justify-center relative overflow-hidden">
               <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/5 rounded-full blur-3xl pointer-events-none" />

               <div className="w-48 h-48 flex-shrink-0 relative">
                  <Doughnut
                    data={{
                      labels: ["Coût Excavation", "Coût Évacuation"],
                      datasets: [
                        {
                          data: [coutExcavation, coutEvacuation],
                          backgroundColor: ["#EAB308", "#F97316"], 
                          borderColor: "#1F2937",
                          borderWidth: 5,
                          hoverOffset: 4
                        },
                      ],
                    }}
                    options={{
                      cutout: "70%",
                      plugins: { legend: { display: false }, tooltip: { enabled: true } },
                    }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                    <span className="text-xs text-gray-500 font-medium">Total</span>
                    <span className="text-sm font-bold text-white">{total.toLocaleString()}</span>
                  </div>
               </div>

               <div className="flex-1 w-full space-y-4">
                 <h4 className="text-gray-400 text-sm font-medium border-b border-gray-700 pb-2">Détail des coûts</h4>
                 
                 <div className="flex justify-between items-center group">
                   <div className="flex items-center gap-3">
                     <div className="w-3 h-3 rounded-full bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.5)]" />
                     <span className="text-gray-300">Excavation</span>
                   </div>
                   <span className="font-mono font-bold text-white group-hover:text-yellow-400 transition-colors">
                     {coutExcavation.toLocaleString()} {currency}
                   </span>
                 </div>

                 <div className="flex justify-between items-center group">
                   <div className="flex items-center gap-3">
                     <div className="w-3 h-3 rounded-full bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.5)]" />
                     <span className="text-gray-300">Évacuation</span>
                   </div>
                   <span className="font-mono font-bold text-white group-hover:text-orange-400 transition-colors">
                     {coutEvacuation.toLocaleString()} {currency}
                   </span>
                 </div>
               </div>
            </div>

            {/* Historique */}
            {history.length > 0 && (
              <div className="bg-gray-800/30 rounded-2xl border border-gray-700/50 overflow-hidden flex-1 min-h-[120px]">
                <div className="px-4 py-3 bg-gray-800/50 border-b border-gray-700/50 flex justify-between items-center">
                  <h4 className="text-sm font-bold text-gray-400 flex items-center gap-2">
                    <History className="w-4 h-4" /> Historique récent
                  </h4>
                  <button onClick={clearHistory} className="text-xs text-red-400 hover:text-red-300 underline">
                    Tout effacer
                  </button>
                </div>
                <div className="overflow-y-auto max-h-[150px] p-2 space-y-2">
                  {history.map((item) => (
                    <div key={item.id} className="flex justify-between items-center bg-gray-700/40 p-3 rounded-lg hover:bg-gray-700 transition group">
                      <div className="flex flex-col">
                         <span className="text-xs text-gray-400">{item.date}</span>
                         <span className="text-sm font-semibold text-white">Vol: {item.results.volumeExcave?.toFixed(1)} m³</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-yellow-500">{item.results.total?.toLocaleString()} {currency}</span>
                        <button 
                          onClick={() => deleteFromHistory(item.id)}
                          className="text-gray-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
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

// --- Sous-composants ---

const InputGroup = ({ label, name, value, onChange, full = false, tooltip }) => (
  <div className={`flex flex-col ${full ? "col-span-2" : ""}`}>
    <label className="mb-1.5 text-xs font-semibold text-gray-400 flex items-center gap-2">
      {label}
      {tooltip && (
        <div className="group relative">
          <Info className="w-3 h-3 text-gray-500 cursor-help" />
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-black text-xs text-white rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
            {tooltip}
          </div>
        </div>
      )}
    </label>
    <input
      type="number"
      min="0"
      step="any"
      value={value || ""}
      onChange={onChange(name)}
      className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-all font-mono"
      placeholder="0"
    />
  </div>
);

const ResultCard = ({ label, value, unit, color, bgColor, border = false }) => (
  <div className={`rounded-xl p-4 flex flex-col justify-center items-center text-center ${bgColor} ${border ? 'border border-gray-600' : ''}`}>
    <span className="text-xs text-gray-400 uppercase tracking-wide mb-1">{label}</span>
    <span className={`text-2xl font-black ${color}`}>
      {value} <span className="text-sm font-normal text-gray-500">{unit}</span>
    </span>
  </div>
);