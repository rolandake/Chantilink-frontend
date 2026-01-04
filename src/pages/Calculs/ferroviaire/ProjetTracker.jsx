import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from "framer-motion";
import { 
  CheckCircle2, 
  Clock, 
  Circle, 
  Plus, 
  Trash2, 
  LayoutList, 
  BarChart3, 
  Activity,
  AlertCircle
} from "lucide-react";

const STORAGE_KEY = "ferroviaire-projet-tracker-pro";

const ETAPES_INIT = [
  "Étude de faisabilité",
  "Conception préliminaire",
  "Évaluation d’impact",
  "Études détaillées",
  "Acquisition du terrain",
  "Construction infrastructure",
  "Pose des rails",
  "Électrification",
  "Installation signalisation",
  "Essais et tests",
  "Mise en service",
  "Suivi maintenance"
];

export default function ProjetTracker() {
  const [taches, setTaches] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try { return JSON.parse(saved); } catch { return []; }
    }
    return ETAPES_INIT.map((nom) => ({ id: Math.random(), nom, statut: "À faire" }));
  });

  const [nouvelleTache, setNouvelleTache] = useState("");

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(taches));
  }, [taches]);

  // --- CALCULS DES STATS ---
  const stats = useMemo(() => {
    const total = taches.length;
    if (total === 0) return { percent: 0, todo: 0, doing: 0, done: 0 };
    const done = taches.filter(t => t.statut === "Terminé").length;
    const doing = taches.filter(t => t.statut === "En cours").length;
    const todo = taches.filter(t => t.statut === "À faire").length;
    const percent = Math.round((done / total) * 100);
    return { percent, todo, doing, done };
  }, [taches]);

  // --- HANDLERS ---
  const toggleStatut = (id) => {
    setTaches(prev => prev.map(t => {
      if (t.id === id) {
        const suivant = t.statut === "À faire" ? "En cours" : t.statut === "En cours" ? "Terminé" : "À faire";
        return { ...t, statut: suivant };
      }
      return t;
    }));
  };

  const ajouterTache = (e) => {
    e.preventDefault();
    if (!nouvelleTache.trim()) return;
    setTaches([...taches, { id: Date.now(), nom: nouvelleTache.trim(), statut: "À faire" }]);
    setNouvelleTache("");
  };

  const supprimerTache = (id) => {
    if (window.confirm("🗑️ Supprimer cette étape du projet ?")) {
      setTaches(prev => prev.filter(t => t.id !== id));
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4 lg:p-6 space-y-6 font-sans">
      
      {/* HEADER : DASHBOARD PROGRESS */}
      <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-600/20 rounded-2xl">
              <BarChart3 className="w-8 h-8 text-indigo-500" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white uppercase tracking-tight">Suivi de Chantier</h2>
              <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Pipeline Ferroviaire</p>
            </div>
          </div>

          <div className="flex items-center gap-8">
             <StatMini label="À faire" val={stats.todo} color="text-gray-500" />
             <StatMini label="En cours" val={stats.doing} color="text-amber-500" />
             <StatMini label="Terminé" val={stats.done} color="text-emerald-500" />
             
             <div className="relative w-20 h-20">
                <svg className="w-full h-full" viewBox="0 0 36 36">
                  <path className="text-gray-800" strokeDasharray="100, 100" strokeWidth="3" fill="none" stroke="currentColor" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  <motion.path 
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: stats.percent / 100 }}
                    className="text-indigo-500" strokeWidth="3" strokeLinecap="round" fill="none" stroke="currentColor" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" 
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-sm font-black text-white">{stats.percent}%</span>
                </div>
             </div>
          </div>
        </div>
      </div>

      {/* FORMULAIRE D'AJOUT */}
      <form onSubmit={ajouterTache} className="flex gap-3">
        <div className="relative flex-1">
          <LayoutList className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-600" />
          <input
            type="text"
            placeholder="Ajouter une étape spécifique (ex: Pose caténaires...)"
            value={nouvelleTache}
            onChange={(e) => setNouvelleTache(e.target.value)}
            className="w-full bg-gray-900 border border-gray-800 rounded-2xl py-4 pl-12 pr-4 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder-gray-600"
          />
        </div>
        <button
          type="submit"
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 rounded-2xl font-bold shadow-lg shadow-indigo-900/20 transition-all flex items-center gap-2 active:scale-95"
        >
          <Plus className="w-5 h-5" /> <span className="hidden sm:inline">Ajouter</span>
        </button>
      </form>

      {/* LISTE DES TÂCHES */}
      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {taches.map((tache) => (
            <motion.div
              layout
              key={tache.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`group flex items-center justify-between p-4 rounded-2xl border transition-all ${
                tache.statut === "Terminé" 
                ? "bg-emerald-500/5 border-emerald-500/20 opacity-60" 
                : tache.statut === "En cours"
                ? "bg-amber-500/5 border-amber-500/20 shadow-lg shadow-amber-900/5"
                : "bg-gray-900 border-gray-800 hover:border-gray-700"
              }`}
            >
              <div className="flex items-center gap-4 flex-1">
                <button 
                  onClick={() => toggleStatut(tache.id)}
                  className={`p-1 rounded-full transition-colors ${
                    tache.statut === "Terminé" ? "text-emerald-500" : tache.statut === "En cours" ? "text-amber-500" : "text-gray-700 hover:text-gray-500"
                  }`}
                >
                  {tache.statut === "Terminé" ? <CheckCircle2 className="w-6 h-6" /> : tache.statut === "En cours" ? <Clock className="w-6 h-6 animate-pulse" /> : <Circle className="w-6 h-6" />}
                </button>
                
                <span 
                  onClick={() => toggleStatut(tache.id)}
                  className={`cursor-pointer font-bold text-sm select-none transition-all ${
                    tache.statut === "Terminé" ? "line-through text-gray-600" : "text-gray-200"
                  }`}
                >
                  {tache.nom}
                </span>
              </div>

              <div className="flex items-center gap-4">
                <span className={`hidden sm:inline-block text-[10px] font-black uppercase tracking-tighter px-3 py-1 rounded-lg border ${
                  tache.statut === "Terminé" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" : 
                  tache.statut === "En cours" ? "bg-amber-500/10 border-amber-500/20 text-amber-500" : 
                  "bg-gray-800 border-gray-700 text-gray-500"
                }`}>
                  {tache.statut}
                </span>
                
                <button
                  onClick={() => supprimerTache(tache.id)}
                  className="p-2 text-gray-700 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                  title="Supprimer l'étape"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* FOOTER TIPS */}
      <div className="p-4 bg-indigo-500/5 rounded-2xl border border-indigo-500/10 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
        <p className="text-[11px] text-indigo-200/60 leading-relaxed italic">
          Astuce RailPro : Cliquez sur l'icône de statut ou sur le texte de l'étape pour faire avancer l'état de la tâche. La barre de progression se met à jour automatiquement selon les tâches terminées.
        </p>
      </div>

    </div>
  );
}

// --- SOUS-COMPOSANT MINI STAT ---
function StatMini({ label, val, color }) {
  return (
    <div className="text-center">
      <p className={`text-lg font-black ${color}`}>{val}</p>
      <p className="text-[9px] uppercase font-bold text-gray-600 tracking-tighter">{label}</p>
    </div>
  );
}