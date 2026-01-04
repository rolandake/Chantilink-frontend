import React, { useState, useEffect, useMemo } from "react";
import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS, ArcElement, Tooltip, Legend,
} from "chart.js";
import { 
  Waves, Ruler, Banknote, Save, Trash2, History, Anchor, Droplets, Info, Layers, Box
} from "lucide-react";

ChartJS.register(ArcElement, Tooltip, Legend);

const STORAGE_KEY = "caniveau-history-pro";

// Configuration Technique Pro (Ouvrages Hydrauliques)
const DOSAGE = {
  ciment: 0.350, // 350kg/m3
  sable: 0.55,   // T/m3
  gravier: 0.75, // T/m3
  acier: 0.070,  // 70kg/m3
  eau: 180       // L/m3
};

export default function CaniveauForm({ currency = "XOF", onCostChange, onMateriauxChange }) {
  
  // --- ÉTATS ---
  const [inputs, setInputs] = useState({
    longueur: "",
    largeurInterieure: "",
    profondeurInterieure: "",
    epaisseurParoi: "0.15",
    quantite: "1",
    prixUnitaire: "",
    coutMainOeuvre: ""
  });

  const [historique, setHistorique] = useState([]);
  const [message, setMessage] = useState(null);

  // --- MOTEUR DE CALCUL TECHNIQUE ---
  const results = useMemo(() => {
    const L = parseFloat(inputs.longueur) || 0;
    const l_int = parseFloat(inputs.largeurInterieure) || 0;
    const h_int = parseFloat(inputs.profondeurInterieure) || 0;
    const ep = parseFloat(inputs.epaisseurParoi) || 0;
    const nb = parseFloat(inputs.quantite) || 0;

    // Section du caniveau (U) = Aire totale - Aire vide intérieur
    // Aire totale = (l_int + 2*ep) * (h_int + ep)  [On ajoute ep au fond]
    const aireTotale = (l_int + (2 * ep)) * (h_int + ep);
    const aireVide = l_int * h_int;
    const aireSectionBeton = aireTotale - aireVide;

    const volumeTotal = aireSectionBeton * L * nb;

    // Coffrage (2 joues intérieures + 2 joues extérieures + fond intérieur)
    const surfaceCoffrage = ((h_int * 2) + l_int + ((h_int + ep) * 2)) * L * nb;

    // Matériaux
    const cimentT = volumeTotal * DOSAGE.ciment;
    const cimentSacs = (cimentT * 1000) / 50;
    const sableT = volumeTotal * DOSAGE.sable;
    const gravierT = volumeTotal * DOSAGE.gravier;
    const acierKg = volumeTotal * (DOSAGE.acier * 1000);
    const acierT = acierKg / 1000;
    const eauL = volumeTotal * DOSAGE.eau;

    // Coûts
    const pu = parseFloat(inputs.prixUnitaire) || 0;
    const mo = parseFloat(inputs.coutMainOeuvre) || 0;
    const total = (volumeTotal * pu) + mo;

    return {
      volumeTotal,
      surfaceCoffrage,
      cimentT, cimentSacs,
      sableT, gravierT, acierT, acierKg, eauL,
      total
    };
  }, [inputs]);

  // --- SYNC PARENT ---
  useEffect(() => {
    if (onCostChange) onCostChange(results.total);
    if (onMateriauxChange) {
      onMateriauxChange({
        volume: results.volumeTotal,
        ciment: results.cimentT,
        acier: results.acierT
      });
    }
  }, [results.total]);

  // --- HISTORIQUE ---
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) try { setHistorique(JSON.parse(saved)); } catch (e) {}
  }, []);

  const handleSave = () => {
    if (results.volumeTotal <= 0) return showToast("⚠️ Dimensions invalides", "error");
    const newEntry = {
      id: Date.now(),
      date: new Date().toLocaleString(),
      ...inputs, ...results
    };
    const newHist = [newEntry, ...historique];
    setHistorique(newHist);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newHist));
    showToast("✅ Caniveau enregistré !");
  };

  const showToast = (msg, type = "success") => {
    setMessage({ text: msg, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const chartData = {
    labels: ["Ciment", "Sable", "Gravier", "Acier"],
    datasets: [{
      data: [results.cimentT, results.sableT, results.gravierT, results.acierT],
      backgroundColor: ["#0ea5e9", "#fbbf24", "#78716c", "#3b82f6"],
      borderColor: "#111827",
      borderWidth: 2,
    }]
  };

  return (
    <div className="w-full h-full flex flex-col bg-gray-900 text-gray-100 overflow-hidden relative font-sans">
      
      {/* Notification Toast */}
      {message && (
        <div className={`fixed top-4 right-4 px-6 py-3 rounded-xl shadow-2xl z-50 font-bold animate-in fade-in slide-in-from-top-2 ${
          message.type === 'error' ? 'bg-red-600' : 'bg-cyan-600'
        }`}>
          {message.text}
        </div>
      )}

      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cyan-600/20 rounded-lg text-cyan-500">
            <Waves className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white uppercase tracking-tight">Ouvrage Hydraulique</h2>
            <p className="text-xs text-gray-400 font-medium">Caniveau de drainage (Coulé en place)</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-gray-500 uppercase font-bold block">Budget Estimé</span>
          <span className="text-2xl font-black text-cyan-400 tracking-tighter">
            {results.total.toLocaleString()} <span className="text-sm text-gray-500 font-normal">{currency}</span>
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-6 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
          
          {/* GAUCHE : SAISIE */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            
            <div className="bg-gray-800/50 border border-gray-700 rounded-3xl p-6 shadow-xl space-y-6">
              <h3 className="flex items-center gap-2 text-xs font-bold text-cyan-400 uppercase tracking-widest">
                <Ruler className="w-4 h-4" /> Dimensionnement (m)
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <InputGroup label="Long. Linéaire" value={inputs.longueur} onChange={v => setInputs({...inputs, longueur: v})} placeholder="Ex: 50" />
                <InputGroup label="Quantité (Nb)" value={inputs.quantite} onChange={v => setInputs({...inputs, quantite: v})} placeholder="1" />
                <InputGroup label="Largeur Int." value={inputs.largeurInterieure} onChange={v => setInputs({...inputs, largeurInterieure: v})} placeholder="0.40" />
                <InputGroup label="Haut. Int." value={inputs.profondeurInterieure} onChange={v => setInputs({...inputs, profondeurInterieure: v})} placeholder="0.50" />
                <InputGroup label="Ép. Parois" value={inputs.epaisseurParoi} onChange={v => setInputs({...inputs, epaisseurParoi: v})} placeholder="0.15" full />
              </div>
            </div>

            <div className="bg-gray-800/50 border border-gray-700 rounded-3xl p-6 shadow-xl space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label={`PU Béton (${currency}/m³)`} value={inputs.prixUnitaire} onChange={v => setInputs({...inputs, prixUnitaire: v})} />
                <InputGroup label={`Main d'œuvre (${currency})`} value={inputs.coutMainOeuvre} onChange={v => setInputs({...inputs, coutMainOeuvre: v})} />
              </div>
              <button onClick={handleSave} className="w-full bg-cyan-600 hover:bg-cyan-500 text-white py-4 rounded-2xl font-bold shadow-lg transition-all flex justify-center items-center gap-2 active:scale-95">
                <Save className="w-5 h-5" /> Enregistrer le calcul
              </button>
            </div>
          </div>

          {/* DROITE : RÉSULTATS */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            
            <div className="grid grid-cols-3 gap-4">
              <ResultCard label="Volume Béton" value={results.volumeTotal.toFixed(2)} unit="m³" icon={<Box className="w-4 h-4"/>} color="text-cyan-400" bg="bg-cyan-500/10" />
              <ResultCard label="Coffrage" value={results.surfaceCoffrage.toFixed(1)} unit="m²" icon={<Layers className="w-4 h-4"/>} color="text-white" bg="bg-gray-800" border />
              <ResultCard label="Acier Estimé" value={results.acierKg.toFixed(0)} unit="kg" icon={<Anchor className="w-4 h-4"/>} color="text-blue-400" bg="bg-blue-500/10" />
            </div>

            <div className="flex-1 bg-gray-800 rounded-3xl p-6 border border-gray-700 shadow-xl flex flex-col md:flex-row gap-8 items-center relative overflow-hidden">
               <div className="absolute -bottom-10 -right-10 w-44 h-44 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />

               <div className="w-44 h-44 flex-shrink-0 relative">
                  <Doughnut data={chartData} options={{ cutout: "75%", plugins: { legend: { display: false } } }} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                     <span className="text-[10px] text-gray-500 uppercase font-bold text-center">Poids<br/>Total</span>
                     <span className="text-sm font-bold text-white">{(results.cimentT + results.sableT + results.gravierT + results.acierT).toFixed(1)} T</span>
                  </div>
               </div>

               <div className="flex-1 w-full space-y-4">
                  <h4 className="text-gray-400 text-xs font-bold uppercase tracking-widest border-b border-gray-700 pb-2 mb-2">Besoins Logistiques</h4>
                  
                  <MaterialRow label="Ciment (350kg/m³)" val={`${results.cimentSacs.toFixed(1)} sacs`} color="bg-cyan-500" />
                  <MaterialRow label="Sable (0.55 T/m³)" val={`${results.sableT.toFixed(2)} t`} color="bg-amber-400" />
                  <MaterialRow label="Gravier (0.75 T/m³)" val={`${results.gravierT.toFixed(2)} t`} color="bg-stone-500" />
                  <MaterialRow label="Acier (HA8/HA10)" val={`${results.acierKg.toFixed(0)} kg`} color="bg-blue-500" />
                  
                  <div className="pt-2 border-t border-gray-700 flex justify-between items-center">
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Droplets className="w-3 h-3 text-blue-400" /> Eau nécessaire
                    </span>
                    <span className="text-sm font-bold text-white font-mono">{results.eauL.toFixed(0)} L</span>
                  </div>

                  <div className="flex items-start gap-2 p-3 bg-blue-500/5 rounded-xl border border-blue-500/20">
                    <Info className="w-4 h-4 text-blue-400 mt-0.5" />
                    <p className="text-[10px] text-blue-200/70 leading-relaxed italic">
                      Ce calcul inclut le béton du radier et des piédroits selon l'épaisseur renseignée. Le coffrage est estimé pour les faces intérieures et extérieures.
                    </p>
                  </div>
               </div>
            </div>

            {/* Historique Mini */}
            {historique.length > 0 && (
              <div className="bg-gray-800/30 rounded-2xl border border-gray-700/50 overflow-hidden">
                <div className="px-4 py-2 bg-gray-800/50 border-b border-gray-700/50 flex justify-between items-center text-xs">
                  <h4 className="font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2"><History className="w-3 h-3" /> Historique</h4>
                  <button onClick={() => {setHistorique([]); localStorage.removeItem(STORAGE_KEY)}} className="text-red-400 hover:underline uppercase">Vider</button>
                </div>
                <div className="max-h-[120px] overflow-y-auto">
                  {historique.slice(0, 5).map((item) => (
                    <div key={item.id} className="flex justify-between items-center p-3 border-b border-gray-700/30 hover:bg-gray-700/40 transition-colors">
                      <div className="text-xs">
                        <span className="text-gray-500 block text-[9px]">{item.date}</span>
                        <span className="font-medium">{item.longueur}ml x {item.largeurInterieure}m</span>
                      </div>
                      <span className="text-sm font-bold text-cyan-400">{parseFloat(item.total).toLocaleString()} {currency}</span>
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
    <label className="mb-1 text-[10px] font-bold text-gray-500 uppercase tracking-wide">{label}</label>
    <input
      type="number" value={value || ""} onChange={e => onChange(e.target.value)}
      className="w-full bg-gray-900 border border-gray-600 rounded-xl px-4 py-3 text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all font-mono text-sm"
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