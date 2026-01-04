import React, { useEffect, useMemo, useState } from "react";
import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { useCalculation } from '@/contexts/CalculationContext';
import { 
  Layers, Ruler, Banknote, Save, Trash2, History, Info, Cuboid, Truck, Scale, Droplets
} from "lucide-react";

ChartJS.register(ArcElement, Tooltip, Legend);

// Constantes métier Bureau d'Études TP
const DENSITE_MELANGE = 2.1; // T/m3 pour GNT compactée
const COEFF_COMPACTAGE = 1.25; // Ratio entre volume foisonné et compacté
const PROP_GRAVIER = 0.7; 
const PROP_SABLE = 0.3;   

export function CoucheBaseForm({ currency = "FCFA", onTotalChange = () => {} }) {
  const {
    localInputs,
    updateInput,
    updateMultipleInputs,
    saveCalculation,
    fetchSavedCalculations,
    savedCalculations,
    loading,
    PROJECT_TYPES,
  } = useCalculation();

  const [message, setMessage] = useState(null);

  // Initialisation
  useEffect(() => {
    if (!localInputs.longueur) {
      updateMultipleInputs({
        longueur: "",
        largeur: "",
        epaisseur: "0.15",
        prixUnitaire: "",
        coutMainOeuvre: "",
        margeSecurite: "10" // Marge de perte chantier en %
      });
    }
  }, []);

  // --- MOTEUR DE CALCUL TECHNIQUE ---
  const results = useMemo(() => {
    const L = parseFloat(localInputs.longueur) || 0;
    const l = parseFloat(localInputs.largeur) || 0;
    const e = parseFloat(localInputs.epaisseur) || 0;
    const pu = parseFloat(localInputs.prixUnitaire) || 0;
    const mo = parseFloat(localInputs.coutMainOeuvre) || 0;
    const marge = 1 + (parseFloat(localInputs.margeSecurite) || 0) / 100;

    const surface = L * l;
    const volumeCompacte = surface * e;
    
    // Volume à commander (incluant compactage et marge de perte)
    const volumeCommande = volumeCompacte * COEFF_COMPACTAGE * marge;
    const tonnageTotal = volumeCommande * DENSITE_MELANGE;

    // Répartition Gravier/Sable
    const gravierT = tonnageTotal * PROP_GRAVIER;
    const sableT = tonnageTotal * PROP_SABLE;

    // Logistique (Camions de 16m3)
    const nbCamions = Math.ceil(volumeCommande / 16);

    // Coûts
    const coutMateriaux = tonnageTotal * pu; // Souvent vendu à la tonne en TP
    const total = coutMateriaux + mo;

    return {
      surface,
      volumeCompacte,
      volumeCommande,
      tonnageTotal,
      gravierT,
      sableT,
      nbCamions,
      total,
      coutMateriaux,
      mo
    };
  }, [localInputs]);

  // Sync parent
  useEffect(() => {
    onTotalChange(results.total);
  }, [results.total]);

  // --- ACTIONS ---
  const handleSave = async () => {
    if (results.volumeCompacte <= 0) return showToast("⚠️ Dimensions invalides", "error");
    
    await saveCalculation(
      { inputs: localInputs, results },
      PROJECT_TYPES?.TP || 'TP',
      'couche_base'
    );
    showToast("✅ Calcul sauvegardé !");
  };

  const showToast = (msg, type = "success") => {
    setMessage({ text: msg, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const chartData = {
    labels: ["Gravier (70%)", "Sable (30%)"],
    datasets: [{
      data: [results.gravierT, results.sableT],
      backgroundColor: ["#f59e0b", "#fbbf24"], 
      borderColor: "#111827",
      borderWidth: 2,
    }]
  };

  return (
    <div className="w-full h-full flex flex-col bg-gray-900 text-gray-100 overflow-hidden relative">
      
      {message && (
        <div className={`fixed top-4 right-4 px-6 py-3 rounded-xl shadow-2xl z-50 font-bold animate-in fade-in slide-in-from-top-2 ${
          message.type === "error" ? "bg-red-600" : "bg-orange-600"
        }`}>
          {message.text}
        </div>
      )}

      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-600/20 rounded-lg text-orange-500">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white uppercase tracking-tight">Couche de Base</h2>
            <p className="text-xs text-gray-400 font-medium">Dimensionnement GNT / Grave Bitume</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-gray-500 uppercase font-bold block tracking-widest">Budget Estimé</span>
          <span className="text-2xl font-black text-orange-400 tracking-tighter">
            {results.total.toLocaleString()} <span className="text-sm font-normal text-gray-500">{currency}</span>
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-6 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
          
          {/* GAUCHE : PARAMÈTRES */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            
            <div className="bg-gray-800/50 border border-gray-700 rounded-3xl p-6 shadow-xl space-y-6">
              <h3 className="flex items-center gap-2 text-xs font-bold text-orange-400 uppercase tracking-widest">
                <Ruler className="w-4 h-4" /> Géométrie du Tronçon
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label="Longueur (m)" value={localInputs.longueur} onChange={(e) => updateInput('longueur', e.target.value)} placeholder="Ex: 1000" />
                <InputGroup label="Largeur (m)" value={localInputs.largeur} onChange={(e) => updateInput('largeur', e.target.value)} placeholder="Ex: 7.5" />
                <InputGroup label="Épaisseur (m)" value={localInputs.epaisseur} onChange={(e) => updateInput('epaisseur', e.target.value)} placeholder="0.15" />
                <InputGroup label="Pertes (%)" value={localInputs.margeSecurite} onChange={(e) => updateInput('margeSecurite', e.target.value)} placeholder="10" />
              </div>
            </div>

            <div className="bg-gray-800/50 border border-gray-700 rounded-3xl p-6 shadow-xl space-y-6 flex-1">
              <h3 className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
                <Banknote className="w-4 h-4" /> Analyse des Coûts
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label={`Prix Tonalité (${currency}/T)`} value={localInputs.prixUnitaire} onChange={(e) => updateInput('prixUnitaire', e.target.value)} />
                <InputGroup label={`Forfait Pose (${currency})`} value={localInputs.coutMainOeuvre} onChange={(e) => updateInput('coutMainOeuvre', e.target.value)} />
              </div>
              <button 
                onClick={handleSave}
                disabled={loading}
                className="w-full bg-orange-600 hover:bg-orange-500 text-white py-4 rounded-2xl font-bold shadow-lg transition-all flex justify-center items-center gap-2 active:scale-95 disabled:opacity-50"
              >
                {loading ? <span className="animate-spin">⏳</span> : <Save className="w-5 h-5" />}
                Enregistrer la Section
              </button>
            </div>
          </div>

          {/* DROITE : RÉSULTATS */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            
            <div className="grid grid-cols-3 gap-4">
              <ResultCard label="Tonnage Total" value={results.tonnageTotal.toFixed(1)} unit="T" icon={<Scale className="w-4 h-4"/>} color="text-orange-400" bg="bg-orange-500/10" />
              <ResultCard label="Volume Brut" value={results.volumeCommande.toFixed(1)} unit="m³" icon={<Cuboid className="w-4 h-4"/>} color="text-white" bg="bg-gray-800" border />
              <ResultCard label="Camions (16m³)" value={results.nbCamions} unit="u" icon={<Truck className="w-4 h-4"/>} color="text-blue-400" bg="bg-blue-500/10" />
            </div>

            <div className="flex-1 bg-gray-800 rounded-3xl p-8 border border-gray-700 shadow-xl flex flex-col md:flex-row gap-10 items-center relative overflow-hidden">
               <div className="absolute -bottom-10 -right-10 w-44 h-44 bg-orange-600/10 rounded-full blur-3xl pointer-events-none" />

               <div className="w-48 h-48 flex-shrink-0 relative">
                  <Doughnut data={chartData} options={{ cutout: "75%", plugins: { legend: { display: false } } }} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                     <span className="text-[10px] text-gray-500 uppercase font-bold text-center">Tonnage<br/>Total</span>
                     <span className="text-sm font-bold text-white">{results.tonnageTotal.toFixed(0)} T</span>
                  </div>
               </div>

               <div className="flex-1 w-full space-y-4">
                  <h4 className="text-gray-400 text-xs font-bold uppercase tracking-widest border-b border-gray-700 pb-2 mb-2">Besoins en Agrégats</h4>
                  
                  <MaterialRow label="Gravier 0/31.5" val={`${results.gravierT.toFixed(1)} T`} color="bg-orange-500" />
                  <MaterialRow label="Sable d'apport" val={`${results.sableT.toFixed(1)} T`} color="bg-amber-400" />
                  
                  <div className="pt-2 border-t border-gray-700 flex justify-between items-center">
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Droplets className="w-3 h-3 text-cyan-400" /> Humidité optimum
                    </span>
                    <span className="text-sm font-bold text-white font-mono">~5%</span>
                  </div>

                  <div className="flex items-start gap-2 p-4 bg-blue-500/5 rounded-2xl border border-blue-500/20">
                    <Info className="w-4 h-4 text-blue-400 mt-0.5" />
                    <p className="text-[10px] text-blue-200/70 leading-relaxed italic">
                      Calcul incluant un <strong>compactage de {Math.round((COEFF_COMPACTAGE-1)*100)}%</strong>. Le tonnage affiché est celui à commander en carrière pour obtenir l'épaisseur finie après cylindrage.
                    </p>
                  </div>
               </div>
            </div>

            {/* Historique Mini */}
            {savedCalculations?.length > 0 && (
              <div className="bg-gray-800/30 rounded-2xl border border-gray-700/50 overflow-hidden">
                <div className="px-4 py-3 bg-gray-800/50 border-b border-gray-700/50 flex justify-between items-center text-xs">
                  <h4 className="font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2"><History className="w-3 h-3" /> Dernières Sections</h4>
                </div>
                <div className="max-h-[120px] overflow-y-auto">
                  {savedCalculations.slice(0, 5).map((item) => (
                    <div key={item._id || item.id} className="flex justify-between items-center p-3 border-b border-gray-700/30 hover:bg-gray-700/40 transition-colors">
                      <div className="text-xs">
                        <span className="text-gray-500 block text-[9px]">{new Date(item.savedAt).toLocaleDateString()}</span>
                        <span className="font-medium">{item.inputs.longueur}m x {item.inputs.largeur}m • {item.results.tonnageTotal.toFixed(0)} T</span>
                      </div>
                      <span className="text-sm font-bold text-orange-400">{parseFloat(item.results.total).toLocaleString()} {currency}</span>
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
      className="w-full bg-gray-900 border border-gray-600 rounded-xl px-4 py-3 text-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all font-mono text-sm"
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