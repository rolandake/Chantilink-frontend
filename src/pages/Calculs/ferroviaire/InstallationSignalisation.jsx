import React, { useState, useEffect, useMemo } from "react";
import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS, ArcElement, Tooltip, Legend,
} from "chart.js";
import { 
  ShieldAlert, Radio, Zap, Banknote, Save, Trash2, History, Info, Activity, Binary, Ruler, Cpu
} from "lucide-react";

ChartJS.register(ArcElement, Tooltip, Legend);

const STORAGE_KEY = "signalisation-rail-history-pro";

export default function InstallationSignalisation({ currency = "XOF", onCostChange = () => {} }) {
  
  // --- ÉTATS ---
  const [inputs, setInputs] = useState({
    nombreSignaux: "",
    prixUnitaireSignal: "",
    longueurCablage: "", // Distance linéaire pour les réseaux de cuivre/fibre
    prixMetreCable: "1500", 
    fraisLogiciel: "",   // Système d'enclenchement informatique (Interlocking)
    coutMainOeuvre: "",
    margeTests: "15"     // Pourcentage pour le Testing & Commissioning
  });

  const [historique, setHistorique] = useState([]);
  const [message, setMessage] = useState(null);

  // --- MOTEUR DE CALCUL (LOGIQUE BE) ---
  const results = useMemo(() => {
    const nb = parseFloat(inputs.nombreSignaux) || 0;
    const pu = parseFloat(inputs.prixUnitaireSignal) || 0;
    const dist = parseFloat(inputs.longueurCablage) || 0;
    const pMc = parseFloat(inputs.prixMetreCable) || 0;
    const soft = parseFloat(inputs.fraisLogiciel) || 0;
    const mo = parseFloat(inputs.coutMainOeuvre) || 0;
    const testRatio = 1 + (parseFloat(inputs.margeTests) || 0) / 100;

    const coutEquipements = nb * pu;
    const coutReseaux = dist * pMc;
    
    // Le total inclut le matériel, le réseau, le soft et la MO, multiplié par le facteur de test
    const sousTotal = coutEquipements + coutReseaux + soft + mo;
    const totalGlobal = sousTotal * testRatio;
    
    // Pourcentage technologie (Matériel + Soft) vs Reste
    const ratioTech = totalGlobal > 0 ? ((coutEquipements + soft) / totalGlobal) * 100 : 0;

    return {
      coutEquipements,
      coutReseaux,
      totalGlobal,
      ratioTech,
      nb,
      coutTests: totalGlobal - sousTotal
    };
  }, [inputs]);

  // --- SYNC PARENT ---
  useEffect(() => {
    onCostChange(results.totalGlobal);
  }, [results.totalGlobal, onCostChange]);

  // --- HISTORIQUE ---
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) try { setHistorique(JSON.parse(saved)); } catch(e) {}
  }, []);

  const handleSave = () => {
    if (results.totalGlobal <= 0) return showToast("⚠️ Saisie incomplète", "error");
    const newEntry = {
      id: Date.now(),
      date: new Date().toLocaleString(),
      ...inputs, ...results
    };
    const newHist = [newEntry, ...historique];
    setHistorique(newHist);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newHist));
    showToast("✅ Signalisation enregistrée !");
  };

  const showToast = (msg, type = "success") => {
    setMessage({ text: msg, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const chartData = {
    labels: ["Équipements", "Réseaux", "Logiciel & Pose", "Tests"],
    datasets: [{
      data: [
        results.coutEquipements, 
        results.coutReseaux, 
        parseFloat(inputs.fraisLogiciel || 0) + parseFloat(inputs.coutMainOeuvre || 0),
        results.coutTests
      ],
      backgroundColor: ["#6366f1", "#4f46e5", "#1e293b", "#818cf8"],
      borderColor: "#111827",
      borderWidth: 2,
    }]
  };

  return (
    <div className="w-full h-full flex flex-col bg-gray-950 text-gray-100 overflow-hidden relative font-sans">
      
      {message && (
        <div className={`fixed top-4 right-4 px-6 py-3 rounded-xl shadow-2xl z-50 font-bold animate-in fade-in slide-in-from-top-2 ${
          message.type === "error" ? "bg-red-600" : "bg-indigo-600"
        }`}>
          {message.text}
        </div>
      )}

      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600/20 rounded-lg text-indigo-500">
            <Radio className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white uppercase tracking-tight">Signalisation & Contrôle</h2>
            <p className="text-xs text-gray-400 font-medium italic">Systèmes de sécurité ferroviaire (SIL4)</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-gray-500 uppercase font-bold block tracking-widest">Total du Lot</span>
          <span className="text-2xl font-black text-indigo-400 tracking-tighter">
            {results.totalGlobal.toLocaleString()} <span className="text-sm text-gray-500 font-normal">{currency}</span>
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-6 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
          
          {/* GAUCHE : SAISIE (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            
            {/* 1. Équipements Voie */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 shadow-lg">
              <h3 className="flex items-center gap-2 text-xs font-bold text-indigo-400 uppercase tracking-widest mb-4">
                <ShieldAlert className="w-4 h-4" /> Équipements de Voie
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label="Nombre de signaux" value={inputs.nombreSignaux} onChange={v => setInputs({...inputs, nombreSignaux: v})} placeholder="Ex: 12" />
                <InputGroup label={`PU Signal (${currency})`} value={inputs.prixUnitaireSignal} onChange={v => setInputs({...inputs, prixUnitaireSignal: v})} />
              </div>
            </div>

            {/* 2. Infrastructure Réseau */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 shadow-lg">
              <h3 className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
                <Zap className="w-4 h-4" /> Infrastructure & Câblage
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label="Linéaire Câbles (m)" value={inputs.longueurCablage} onChange={v => setInputs({...inputs, longueurCablage: v})} placeholder="Cuivre / Fibre" />
                <InputGroup label="Coût au mètre" value={inputs.prixMetreCable} onChange={v => setInputs({...inputs, prixMetreCable: v})} />
              </div>
            </div>

            {/* 3. Systèmes & Tests */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 shadow-lg flex-1">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <InputGroup label={`Système Logiciel`} value={inputs.fraisLogiciel} onChange={v => setInputs({...inputs, fraisLogiciel: v})} />
                <InputGroup label={`Marge Tests (%)`} value={inputs.margeTests} onChange={v => setInputs({...inputs, margeTests: v})} />
              </div>
              <InputGroup label={`Installation / Pose (${currency})`} value={inputs.coutMainOeuvre} onChange={v => setInputs({...inputs, coutMainOeuvre: v})} full />

              <button 
                onClick={handleSave}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-xl font-bold shadow-lg transition-all flex justify-center items-center gap-2 active:scale-95 mt-6"
              >
                <Save className="w-5 h-5" /> Enregistrer le chiffrage
              </button>
            </div>
          </div>

          {/* DROITE : DASHBOARD (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            
            <div className="grid grid-cols-3 gap-4">
              <ResultCard label="Points Signal" value={results.nb} unit="u" icon={<Activity className="w-4 h-4"/>} color="text-indigo-400" bg="bg-indigo-500/10" />
              <ResultCard label="Réseau Total" value={parseFloat(inputs.longueurCablage || 0)} unit="ml" icon={<Ruler className="w-4 h-4"/>} color="text-white" bg="bg-gray-900" border />
              <ResultCard label="Ratio Tech" value={Math.round(results.ratioTech)} unit="%" icon={<Binary className="w-4 h-4"/>} color="text-emerald-400" bg="bg-emerald-500/10" />
            </div>

            <div className="flex-1 bg-gray-900 rounded-3xl p-8 border border-gray-800 shadow-xl flex flex-col md:flex-row gap-10 items-center relative overflow-hidden">
               <div className="absolute -bottom-10 -right-10 w-44 h-44 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

               <div className="w-48 h-48 flex-shrink-0 relative">
                  <Doughnut data={chartData} options={{ cutout: "75%", plugins: { legend: { display: false } } }} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                     <span className="text-[10px] text-gray-500 uppercase font-bold text-center leading-tight">Coût Moyen<br/>par point</span>
                     <span className="text-sm font-bold text-white">
                        {results.nb > 0 ? Math.round(results.totalGlobal / results.nb).toLocaleString() : 0}
                     </span>
                  </div>
               </div>

               <div className="flex-1 w-full space-y-4">
                  <h4 className="text-gray-400 text-xs font-bold uppercase tracking-widest border-b border-gray-800 pb-2 mb-2">Bilan de l'équipement</h4>
                  
                  <MaterialRow label="Signalisation Latérale" val={`${results.coutEquipements.toLocaleString()} ${currency}`} color="bg-indigo-500" />
                  <MaterialRow label="Câblage & Intégration" val={`${results.coutReseaux.toLocaleString()} ${currency}`} color="bg-indigo-800" />
                  <MaterialRow label="Phase de Tests (Provision)" val={`${results.coutTests.toLocaleString()} ${currency}`} color="bg-indigo-300" />
                  
                  <div className="flex items-start gap-2 p-3 bg-blue-500/5 rounded-xl border border-blue-500/20 mt-4">
                    <Info className="w-4 h-4 text-indigo-400 mt-0.5" />
                    <p className="text-[10px] text-indigo-200/70 leading-relaxed italic">
                      Ce chiffrage inclut les signaux de type LED et les interfaces informatiques. Prévoir une provision de tests pour la conformité SIL4.
                    </p>
                  </div>
               </div>
            </div>

            {/* Historique Mini */}
            {historique.length > 0 && (
              <div className="bg-gray-900/50 rounded-2xl border border-gray-800 overflow-hidden">
                <div className="px-4 py-2 bg-gray-800/50 border-b border-gray-800 flex justify-between items-center text-xs">
                  <h4 className="font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2"><History className="w-3 h-3" /> Historique</h4>
                  <button onClick={() => {setHistorique([]); localStorage.removeItem(STORAGE_KEY)}} className="text-red-400 hover:underline uppercase text-[10px]">Vider</button>
                </div>
                <div className="max-h-[120px] overflow-y-auto">
                  {historique.slice(0, 5).map((item) => (
                    <div key={item.id} className="flex justify-between items-center p-3 border-b border-gray-800 hover:bg-gray-800 transition-colors">
                      <div className="text-xs">
                        <span className="text-gray-500 block text-[9px]">{item.date}</span>
                        <span className="font-medium uppercase tracking-tighter">{item.nombreSignaux} signaux - {item.longueurCablage}m câbles</span>
                      </div>
                      <span className="text-sm font-bold text-indigo-400">{parseFloat(item.totalGlobal).toLocaleString()} {currency}</span>
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
      className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-white focus:border-indigo-500 transition-all font-mono text-sm"
      placeholder={placeholder || "0"}
    />
  </div>
);

const ResultCard = ({ label, value, unit, color, bg, border, icon }) => (
  <div className={`rounded-2xl p-4 flex flex-col justify-center items-center text-center ${bg} ${border ? 'border border-gray-800' : ''}`}>
    <span className="text-[10px] text-gray-500 uppercase font-bold mb-1 flex items-center gap-1">
      {icon} {label}
    </span>
    <span className={`text-xl font-black ${color}`}>
      {value.toLocaleString()} <span className="text-xs font-normal text-gray-500 lowercase">{unit}</span>
    </span>
  </div>
);

const MaterialRow = ({ label, val, color }) => (
  <div className="flex justify-between items-center border-b border-gray-800 pb-2 last:border-0 group">
    <div className="flex items-center gap-2">
      <div className={`w-1.5 h-1.5 rounded-full ${color}`} />
      <span className="text-gray-300 text-xs font-medium">{label}</span>
    </div>
    <span className="text-xs font-bold text-white font-mono">{val}</span>
  </div>
);