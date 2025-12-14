import React, { useState, useEffect, useMemo } from 'react';
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { 
  Wrench, Hammer, Trash2, Plus, Save, History, 
  ClipboardList, Banknote, HardHat 
} from "lucide-react";

ChartJS.register(ArcElement, Tooltip, Legend);

const STORAGE_KEY = "rehabilitation-history";

// Catégories de travaux pour classer les coûts
const CATEGORIES = [
  { id: "demolition", label: "Démolition / Curage", color: "red", bg: "bg-red-500/20", text: "text-red-400" },
  { id: "chaussee", label: "Reprise Chaussée", color: "orange", bg: "bg-orange-500/20", text: "text-orange-400" },
  { id: "assainissement", label: "Assainissement", color: "blue", bg: "bg-blue-500/20", text: "text-blue-400" },
  { id: "signalisation", label: "Signalisation", color: "yellow", bg: "bg-yellow-500/20", text: "text-yellow-400" },
  { id: "divers", label: "Divers / Finitions", color: "gray", bg: "bg-gray-500/20", text: "text-gray-400" },
];

export default function Rehabilitation({ currency = "XOF", onCostChange }) {
  
  // --- ÉTATS ---
  // Liste des tâches en cours de saisie
  const [tasks, setTasks] = useState([]);
  
  // Saisie d'une nouvelle tâche
  const [newTask, setNewTask] = useState({
    category: "chaussee",
    description: "",
    cout: ""
  });

  const [historique, setHistorique] = useState([]);
  const [message, setMessage] = useState(null);

  // --- CALCULS (Mémorisés) ---
  const results = useMemo(() => {
    const total = tasks.reduce((sum, task) => sum + (parseFloat(task.cout) || 0), 0);
    
    // Regroupement par catégorie pour le graphique
    const byCategory = {};
    CATEGORIES.forEach(cat => byCategory[cat.id] = 0);
    
    tasks.forEach(task => {
      if (byCategory[task.category] !== undefined) {
        byCategory[task.category] += parseFloat(task.cout) || 0;
      }
    });

    return { total, byCategory };
  }, [tasks]);

  // --- SYNC PARENT ---
  useEffect(() => {
    if (onCostChange) onCostChange(results.total);
  }, [results.total, onCostChange]);

  // --- HISTORIQUE ---
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // ✅ FILTRE les entrées invalides (sans tasks ou tasks non-array)
        const valid = parsed.filter(item => Array.isArray(item?.tasks));
        setHistorique(valid);
      }
    } catch (err) {
      console.error("Erreur chargement historique:", err);
    }
  }, []);

  // --- HANDLERS ---
  const handleAddTask = () => {
    if (!newTask.description || !newTask.cout) return showToast("⚠️ Champs incomplets", "error");
    
    setTasks([...tasks, { ...newTask, id: Date.now() }]);
    setNewTask({ category: "chaussee", description: "", cout: "" }); // Reset
  };

  const removeTask = (id) => {
    setTasks(tasks.filter(t => t.id !== id));
  };

  const handleSave = () => {
    if (tasks.length === 0) return showToast("⚠️ Aucune tâche définie", "error");
    
    const newEntry = {
      id: Date.now(),
      date: new Date().toLocaleString(),
      tasks: tasks, // ✅ S'assure que tasks est toujours un array
      total: results.total
    };

    const newHist = [newEntry, ...historique];
    setHistorique(newHist);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newHist));
    showToast("✅ Réhabilitation sauvegardée !");
  };

  const clearHistory = () => {
    if (window.confirm("Vider l'historique ?")) {
      setHistorique([]);
      localStorage.removeItem(STORAGE_KEY);
      showToast("Historique vidé");
    }
  };

  const showToast = (msg, type = "success") => {
    setMessage({ text: msg, type });
    setTimeout(() => setMessage(null), 3000);
  };

  // --- CHART DATA ---
  const chartData = {
    labels: CATEGORIES.map(c => c.label),
    datasets: [{
      data: CATEGORIES.map(c => results.byCategory[c.id]),
      backgroundColor: ["#ef4444", "#f97316", "#3b82f6", "#eab308", "#6b7280"],
      borderColor: "#1f2937",
      borderWidth: 4,
    }]
  };

  return (
    <div className="w-full h-full flex flex-col bg-gray-900 text-gray-100 overflow-hidden relative">
      
      {/* Toast */}
      {message && (
        <div className={`fixed top-4 right-4 px-6 py-3 rounded-xl shadow-2xl z-50 font-bold ${message.type === "error" ? "bg-red-600" : "bg-green-600"}`}>
          {message.text}
        </div>
      )}

      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-600/20 rounded-lg text-green-500">
            <Wrench className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Réhabilitation</h2>
            <p className="text-xs text-gray-400">Maintenance & Réparations</p>
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg px-4 py-2 border border-gray-700">
          <span className="text-xs text-gray-400 block">Total Estimé</span>
          <span className="text-lg font-black text-green-400">
            {results.total.toLocaleString(undefined, { maximumFractionDigits: 0 })} <span className="text-sm text-gray-500">{currency}</span>
          </span>
        </div>
      </div>

      {/* Main Grid */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
          
          {/* GAUCHE : SAISIE DES TÂCHES (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            
            {/* Formulaire Ajout */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5 shadow-lg">
              <h3 className="flex items-center gap-2 text-sm font-bold text-green-400 uppercase tracking-wider mb-4">
                <Plus className="w-4 h-4" /> Ajouter une intervention
              </h3>
              
              <div className="space-y-4">
                {/* Catégorie */}
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setNewTask({ ...newTask, category: cat.id })}
                      className={`text-xs font-bold py-2 rounded-lg border transition-all ${
                        newTask.category === cat.id 
                          ? `${cat.bg} ${cat.text} border-${cat.color}-500` 
                          : "bg-gray-900 border-gray-700 text-gray-400 hover:bg-gray-800"
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                {/* Champs */}
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-500 font-bold uppercase">Description</label>
                    <input 
                      type="text" 
                      placeholder="Ex: Bouchage nids de poule PK10"
                      value={newTask.description}
                      onChange={e => setNewTask({...newTask, description: e.target.value})}
                      className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-bold uppercase">Coût Estimé ({currency})</label>
                    <input 
                      type="number" 
                      placeholder="Ex: 150000"
                      value={newTask.cout}
                      onChange={e => setNewTask({...newTask, cout: e.target.value})}
                      className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none"
                    />
                  </div>
                </div>

                <button 
                  onClick={handleAddTask}
                  className="w-full bg-green-600 hover:bg-green-500 text-white py-3 rounded-xl font-bold shadow-lg active:scale-95 transition-all flex justify-center items-center gap-2"
                >
                  <Plus className="w-5 h-5" /> Ajouter à la liste
                </button>
              </div>
            </div>

            {/* Liste des tâches ajoutées (Scrollable si beaucoup) */}
            <div className="flex-1 bg-gray-800/30 border border-gray-700 rounded-2xl p-4 overflow-y-auto min-h-[200px]">
              <h4 className="text-xs font-bold text-gray-400 uppercase mb-3 flex items-center justify-between">
                <span>Liste des tâches ({tasks.length})</span>
                {tasks.length > 0 && <span className="text-green-400">{results.total.toLocaleString()} {currency}</span>}
              </h4>
              
              {tasks.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-600 opacity-50">
                  <ClipboardList className="w-12 h-12 mb-2" />
                  <p className="text-sm">Aucune tâche ajoutée</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {tasks.map((task) => {
                    const cat = CATEGORIES.find(c => c.id === task.category);
                    return (
                      <div key={task.id} className="bg-gray-800 p-3 rounded-xl flex justify-between items-center group border border-gray-700 hover:border-gray-500 transition">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className={`w-2 h-8 rounded-full bg-${cat?.color || 'gray'}-500 shrink-0`} />
                          <div className="truncate">
                            <p className="text-sm font-bold text-gray-200 truncate">{task.description}</p>
                            <p className={`text-[10px] uppercase font-bold text-${cat?.color || 'gray'}-400`}>{cat?.label}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-mono font-bold text-white">{parseFloat(task.cout).toLocaleString()}</span>
                          <button onClick={() => removeTask(task.id)} className="text-gray-500 hover:text-red-500 transition">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {tasks.length > 0 && (
              <button 
                onClick={handleSave}
                className="w-full bg-gradient-to-r from-green-600 to-teal-600 hover:opacity-90 text-white py-3 rounded-xl font-bold shadow-lg active:scale-95 transition flex justify-center items-center gap-2"
              >
                <Save className="w-5 h-5" /> Sauvegarder le projet
              </button>
            )}
          </div>

          {/* DROITE : RÉSULTATS (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            
            {/* KPIs */}
            <div className="grid grid-cols-3 gap-4">
              <ResultCard label="Interventions" value={tasks.length} unit="u" icon={<Hammer className="w-4 h-4"/>} color="text-green-400" bg="bg-green-500/10" />
              <ResultCard label="Moyenne / Tâche" value={tasks.length > 0 ? (results.total / tasks.length).toFixed(0) : 0} unit={currency} icon={<Banknote className="w-4 h-4"/>} color="text-blue-400" bg="bg-blue-500/10" border />
              <ResultCard label="Poste Principal" value={tasks.length > 0 ? "Mixte" : "-"} unit="" icon={<HardHat className="w-4 h-4"/>} color="text-orange-400" bg="bg-orange-500/10" />
            </div>

            {/* Graphique & Détails */}
            <div className="flex-1 bg-gray-800 rounded-2xl p-6 border border-gray-700 shadow-xl flex flex-col md:flex-row gap-8 items-center relative overflow-hidden">
               <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-green-600/10 rounded-full blur-3xl pointer-events-none" />

               <div className="w-40 h-40 flex-shrink-0 relative">
                  <Doughnut data={chartData} options={{ cutout: "70%", plugins: { legend: { display: false } } }} />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                     <span className="text-sm font-bold text-green-400">Budget</span>
                  </div>
               </div>

               <div className="flex-1 w-full space-y-3">
                  <h4 className="text-gray-400 text-sm font-medium border-b border-gray-700 pb-2">Répartition Budgétaire</h4>
                  {CATEGORIES.map(cat => {
                    const amount = results.byCategory[cat.id];
                    if (amount === 0) return null;
                    return (
                      <div key={cat.id} className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full bg-${cat.color}-500`}/>
                          <span className="text-sm text-gray-300">{cat.label}</span>
                        </div>
                        <span className="text-sm font-bold text-white font-mono">{amount.toLocaleString()} {currency}</span>
                      </div>
                    );
                  })}
                  {results.total === 0 && <p className="text-gray-500 text-sm italic text-center py-4">Ajoutez des tâches pour voir la répartition</p>}
               </div>
            </div>

            {/* Historique */}
            {historique.length > 0 && (
              <div className="bg-gray-800/30 rounded-2xl border border-gray-700/50 overflow-hidden flex-1 min-h-[150px]">
                <div className="px-4 py-2 bg-gray-800/50 border-b border-gray-700/50 flex justify-between items-center">
                  <h4 className="text-xs font-bold text-gray-400 flex items-center gap-2">
                    <History className="w-3 h-3" /> Projets précédents
                  </h4>
                  <button onClick={clearHistory} className="text-[10px] text-red-400 hover:underline">Vider</button>
                </div>
                <div className="overflow-y-auto max-h-[180px] p-2 space-y-2">
                  {historique.map((item) => {
                    // ✅ PROTECTION : Vérifie que tasks existe et est un array
                    const tasksCount = Array.isArray(item?.tasks) ? item.tasks.length : 0;
                    
                    return (
                      <div key={item.id} className="flex justify-between items-center bg-gray-700/30 p-2 rounded hover:bg-gray-700/50 transition border border-transparent hover:border-green-500/30">
                        <div className="flex flex-col">
                           <span className="text-[10px] text-gray-500">{item.date}</span>
                           <span className="text-xs text-gray-300">{tasksCount} tâche(s)</span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-bold text-green-400">{parseFloat(item.total || 0).toLocaleString()} {currency}</span>
                        </div>
                      </div>
                    );
                  })}
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

const ResultCard = ({ label, value, unit, color, bg, border, icon }) => (
  <div className={`rounded-xl p-3 flex flex-col justify-center items-center text-center ${bg} ${border ? 'border border-gray-600' : ''}`}>
    <span className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 flex items-center gap-1">
      {icon} {label}
    </span>
    <span className={`text-xl font-black ${color}`}>
      {value} <span className="text-xs font-normal text-gray-500">{unit}</span>
    </span>
  </div>
);