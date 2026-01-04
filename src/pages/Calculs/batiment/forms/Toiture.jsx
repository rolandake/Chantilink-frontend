import React, { useState, useEffect, useMemo } from "react";
import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS, ArcElement, Tooltip, Legend,
} from "chart.js";
import { 
  Home, Ruler, Banknote, Save, Trash2, History, Anchor, Droplets, Layers, ShieldCheck, Wind, Info
} from "lucide-react";

ChartJS.register(ArcElement, Tooltip, Legend);

const STORAGE_KEY = "toiture-history-pro";

// Configuration Technique Pro
const CONFIG_TOITURE = {
  tuiles: { 
    label: "Tuiles", icon: <Home className="w-4 h-4"/>, 
    boisM3parM2: 0.02, // 0.02 m3 de bois par m2 de toiture
    accessoires: "Faîtières", color: "#f97316"
  },
  bac_acier: { 
    label: "Bac Acier", icon: <Layers className="w-4 h-4"/>, 
    recouvrement: 1.10, // +10% de surface pour chevauchements
    boisM3parM2: 0.015,
    accessoires: "Rives/Faîtages", color: "#06b6d4"
  },
  toit_terrasse: { 
    label: "Toit Terrasse", icon: <Layers className="w-4 h-4"/>, 
    ciment: 0.350, acier: 100, // 100kg/m3 pour dalle toiture (stiffness)
    etancheiteM2: 1.05, color: "#6366f1"
  },
};

export default function Toiture({ currency = "XOF", onTotalChange, onMateriauxChange }) {
  
  // --- ÉTATS ---
  const [typeToiture, setTypeToiture] = useState("tuiles");
  const [inputs, setInputs] = useState({
    surface: "",
    epaisseur: "0.15", 
    densiteTuiles: "12", 
    prixUnitaire: "",
    coutMainOeuvre: "",
    inclureEtanchéité: true
  });

  const [historique, setHistorique] = useState([]);
  const [message, setMessage] = useState(null);

  // --- MOTEUR DE CALCUL ---
  const results = useMemo(() => {
    const S = parseFloat(inputs.surface) || 0;
    const pu = parseFloat(inputs.prixUnitaire) || 0;
    const mo = parseFloat(inputs.coutMainOeuvre) || 0;
    const config = CONFIG_TOITURE[typeToiture];
    
    let qtePrincipale = 0;
    let coutMateriaux = 0;
    let boisEstime = 0;
    let betonDetails = null;

    if (typeToiture === "tuiles") {
      qtePrincipale = S * (parseFloat(inputs.densiteTuiles) || 12);
      boisEstime = S * config.boisM3parM2;
      coutMateriaux = qtePrincipale * pu;
    } 
    else if (typeToiture === "bac_acier") {
      qtePrincipale = S * config.recouvrement;
      boisEstime = S * config.boisM3parM2;
      coutMateriaux = qtePrincipale * pu;
    } 
    else if (typeToiture === "toit_terrasse") {
      const vol = S * (parseFloat(inputs.epaisseur) || 0.15);
      qtePrincipale = vol;
      coutMateriaux = vol * pu;
      betonDetails = {
        cimentT: vol * config.ciment,
        sacs: (vol * config.ciment * 1000) / 50,
        acierKg: vol * config.acier,
        etancheite: S * config.etancheiteM2
      };
    }

    const total = coutMateriaux + mo;

    return {
      qtePrincipale,
      coutMateriaux,
      boisEstime,
      betonDetails,
      total
    };
  }, [inputs, typeToiture]);

  // --- SYNC PARENT ---
  useEffect(() => {
    onTotalChange(results.total);
    if (onMateriauxChange && typeToiture === "toit_terrasse") {
      onMateriauxChange({
        volume: results.qtePrincipale,
        ciment: results.betonDetails?.cimentT,
        acier: (results.betonDetails?.acierKg || 0) / 1000
      });
    }
  }, [results.total, typeToiture]);

  // --- HISTORIQUE ---
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) try { setHistorique(JSON.parse(saved)); } catch {}
  }, []);

  const handleSave = () => {
    if (results.total <= 0) return showToast("⚠️ Surface manquante", "error");
    const newEntry = {
      id: Date.now(),
      date: new Date().toLocaleString(),
      type: CONFIG_TOITURE[typeToiture].label,
      ...inputs, ...results
    };
    const newHist = [newEntry, ...historique];
    setHistorique(newHist);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newHist));
    showToast("✅ Devis toiture enregistré");
  };

  const showToast = (msg, type = "success") => {
    setMessage({ text: msg, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const chartData = {
    labels: ["Matériaux", "Main d'œuvre"],
    datasets: [{
      data: [results.coutMateriaux, parseFloat(inputs.coutMainOeuvre) || 0],
      backgroundColor: [CONFIG_TOITURE[typeToiture].color, "#374151"],
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
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg`} style={{backgroundColor: `${CONFIG_TOITURE[typeToiture].color}20`, color: CONFIG_TOITURE[typeToiture].color}}>
            <Home className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Mise hors d'eau : Toiture</h2>
            <p className="text-xs text-gray-400">Charpente & Couverture</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-gray-500 uppercase font-bold block">Budget Toiture</span>
          <span className="text-2xl font-black text-orange-400 tracking-tighter">
            {results.total.toLocaleString()} <span className="text-sm text-gray-500 font-normal">{currency}</span>
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-6 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
          
          {/* GAUCHE : SÉLECTION */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            
            <div className="grid grid-cols-3 gap-2 bg-gray-800 p-1.5 rounded-xl border border-gray-700">
              {Object.entries(CONFIG_TOITURE).map(([id, t]) => (
                <button
                  key={id}
                  onClick={() => setTypeToiture(id)}
                  className={`flex flex-col items-center justify-center py-3 rounded-lg transition-all ${
                    typeToiture === id 
                      ? "bg-orange-600 text-white shadow-lg" 
                      : "text-gray-400 hover:text-white hover:bg-gray-700"
                  }`}
                >
                  <span className="mb-1">{t.icon}</span>
                  <span className="text-[10px] font-bold uppercase">{t.label}</span>
                </button>
              ))}
            </div>

            <div className="bg-gray-800/50 border border-gray-700 rounded-3xl p-6 space-y-6 shadow-xl">
              <h3 className="flex items-center gap-2 text-xs font-bold text-orange-400 uppercase tracking-widest">
                <Ruler className="w-4 h-4" /> Géométrie de toiture
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <InputGroup label="Surface Projetée (m²)" value={inputs.surface} onChange={v => setInputs({...inputs, surface: v})} full />

                {typeToiture === "tuiles" && (
                  <InputGroup label="Densité (Tuiles/m²)" value={inputs.densiteTuiles} onChange={v => setInputs({...inputs, densiteTuiles: v})} />
                )}

                {typeToiture === "toit_terrasse" && (
                  <InputGroup label="Épaisseur Dalle (m)" value={inputs.epaisseur} onChange={v => setInputs({...inputs, epaisseur: v})} />
                )}
              </div>

              <div className="pt-4 border-t border-gray-700 grid grid-cols-2 gap-4">
                <InputGroup label={`Prix Unit. (${currency})`} value={inputs.prixUnitaire} onChange={v => setInputs({...inputs, prixUnitaire: v})} />
                <InputGroup label={`Main d'œuvre (${currency})`} value={inputs.coutMainOeuvre} onChange={v => setInputs({...inputs, coutMainOeuvre: v})} />
              </div>

              <button onClick={handleSave} className="w-full bg-orange-600 hover:bg-orange-500 text-white py-4 rounded-2xl font-bold shadow-lg transition-all flex justify-center items-center gap-2">
                <Save className="w-5 h-5" /> Enregistrer le calcul
              </button>
            </div>
          </div>

          {/* DROITE : RÉSULTATS */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            
            <div className="grid grid-cols-3 gap-4">
              <ResultCard 
                label={typeToiture === 'tuiles' ? "Nb Tuiles" : typeToiture === 'toit_terrasse' ? "Vol. Béton" : "Surf. Acier"} 
                value={results.qtePrincipale.toFixed(typeToiture === 'tuiles' ? 0 : 2)} 
                unit={typeToiture === 'tuiles' ? "u" : typeToiture === 'toit_terrasse' ? "m³" : "m²"} 
                icon={<PackageIcon />} color="text-orange-400" bg="bg-orange-500/10" 
              />
              <ResultCard 
                label="Charpente" 
                value={typeToiture === 'toit_terrasse' ? results.betonDetails?.acierKg.toFixed(0) : results.boisEstime.toFixed(2)} 
                unit={typeToiture === 'toit_terrasse' ? "kg" : "m³"} 
                icon={<Wind className="w-4 h-4"/>} color="text-emerald-400" bg="bg-emerald-500/10" border 
              />
              <ResultCard 
                label="Protection" 
                value={typeToiture === 'toit_terrasse' ? "Hydro" : "Rives"} 
                unit="" icon={<ShieldCheck className="w-4 h-4"/>} color="text-blue-400" bg="bg-blue-500/10" 
              />
            </div>

            <div className="flex-1 bg-gray-800 rounded-3xl p-6 border border-gray-700 shadow-xl flex flex-col md:flex-row gap-8 items-center relative overflow-hidden">
               <div className="w-44 h-44 flex-shrink-0 relative">
                  <Doughnut data={chartData} options={{ cutout: "75%", plugins: { legend: { display: false } } }} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                     <span className="text-[10px] text-gray-500 uppercase font-bold text-center leading-tight">Ratio<br/>Matos/MO</span>
                  </div>
               </div>

               <div className="flex-1 w-full space-y-4">
                  <h4 className="text-gray-400 text-xs font-bold uppercase tracking-widest border-b border-gray-700 pb-2">Détails Logistiques</h4>
                  
                  {typeToiture === "toit_terrasse" ? (
                    <>
                      <MaterialRow label="Ciment (350kg/m³)" val={`${results.betonDetails?.sacs.toFixed(0)} sacs`} color="bg-orange-500" />
                      <MaterialRow label="Acier HA" val={`${results.betonDetails?.acierKg.toFixed(0)} kg`} color="bg-blue-500" />
                      <MaterialRow label="Étanchéité" val={`${results.betonDetails?.etancheite.toFixed(1)} m²`} color="bg-indigo-500" />
                    </>
                  ) : (
                    <>
                      <MaterialRow label="Éléments Couverture" val={`${results.qtePrincipale.toFixed(0)} ${typeToiture === 'tuiles' ? 'unités' : 'm²'}`} color="bg-orange-500" />
                      <MaterialRow label="Bois de charpente" val={`${results.boisEstime.toFixed(3)} m³`} color="bg-emerald-500" />
                    </>
                  )}
                  
                  <div className="flex items-start gap-2 p-3 bg-blue-500/5 rounded-xl border border-blue-500/20 mt-4">
                    <Info className="w-4 h-4 text-blue-400 mt-0.5" />
                    <p className="text-[10px] text-blue-200/70 leading-relaxed italic">
                      {typeToiture === 'toit_terrasse' 
                        ? "Le calcul inclut une dalle pleine de compression et une membrane d'étanchéité standard." 
                        : `Le volume de bois est estimé pour une charpente traditionnelle (liteaux + chevrons).`}
                    </p>
                  </div>
               </div>
            </div>

            {/* Historique Mini */}
            {historique.length > 0 && (
              <div className="bg-gray-800/30 rounded-2xl border border-gray-700/50 overflow-hidden">
                <div className="px-4 py-2 bg-gray-800/50 flex justify-between items-center border-b border-gray-700/50">
                  <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2"><History className="w-3 h-3" /> Devis Récents</h4>
                  <button onClick={() => {setHistorique([]); localStorage.removeItem(STORAGE_KEY)}} className="text-[10px] text-red-400 hover:underline">Vider</button>
                </div>
                <div className="max-h-[120px] overflow-y-auto">
                  {historique.slice(0, 5).map((item) => (
                    <div key={item.id} className="flex justify-between items-center p-3 border-b border-gray-700/30 hover:bg-gray-700/40 transition-colors text-xs">
                      <div>
                        <span className="text-gray-500 text-[9px] block">{item.date}</span>
                        <span className="font-medium uppercase">{item.type}</span> - {item.surface} m²
                      </div>
                      <span className="font-bold text-orange-400">{parseFloat(item.total).toLocaleString()} {currency}</span>
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
const PackageIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
  </svg>
);

const InputGroup = ({ label, value, onChange, placeholder, full = false }) => (
  <div className={`flex flex-col ${full ? "col-span-2" : ""}`}>
    <label className="mb-1 text-[10px] font-bold text-gray-500 uppercase tracking-wide">{label}</label>
    <input
      type="number" value={value} onChange={e => onChange(e.target.value)}
      className="w-full bg-gray-900 border border-gray-600 rounded-xl px-4 py-2.5 text-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all font-mono text-sm"
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