import React, { useState } from 'react';
import { motion, AnimatePresence } from "framer-motion";
import { 
  Pickaxe, 
  BrickWall, 
  Construction, 
  Building2, 
  Train, 
  ChevronRight,
  ClipboardList
} from "lucide-react";

// ✅ Imports de tes sous-composants corrigés précédemment
import Terrassement from "./Terrassement";
import Fondations from "./Fondations";
import PontsOuvrages from "./PontsOuvrages";
import Gares from "./Gares";
import VoiesFerrees from "./VoiesFerrees";

const CONFIG_ETUDES = [
  { id: "terrassement", label: "Terrassement", icon: <Pickaxe className="w-5 h-5"/>, component: Terrassement, color: "blue" },
  { id: "fondations", label: "Fondations", icon: <BrickWall className="w-5 h-5"/>, component: Fondations, color: "indigo" },
  { id: "pontsOuvrages", label: "Ouvrages d'Art", icon: <Construction className="w-5 h-5"/>, component: PontsOuvrages, color: "violet" },
  { id: "gares", label: "Gares & Quais", icon: <Building2 className="w-5 h-5"/>, component: Gares, color: "sky" },
  { id: "voiesFerrees", label: "Voies Ferrées", icon: <Train className="w-5 h-5"/>, component: VoiesFerrees, color: "cyan" },
];

export default function EtudesDetaillees({ currency = "XOF" }) {
  const [selection, setSelection] = useState("terrassement");

  const activeTab = CONFIG_ETUDES.find(t => t.id === selection);
  const SelectedComponent = activeTab.component;

  return (
    <div className="w-full h-full flex flex-col bg-gray-950 text-white font-sans overflow-hidden">
      
      {/* HEADER DE SECTION */}
      <div className="flex-shrink-0 p-6 border-b border-gray-800 bg-gray-900/50 backdrop-blur-md">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-indigo-600/20 rounded-lg text-indigo-400">
            <ClipboardList className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white uppercase tracking-tight">Ingénierie de Détail</h2>
            <p className="text-xs text-gray-400 font-medium">Dimensionnement structurel par lot technique</p>
          </div>
        </div>

        {/* NAVIGATION PAR ONGLETS (Tabs) */}
        <div className="flex flex-wrap gap-2">
          {CONFIG_ETUDES.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelection(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                selection === tab.id 
                  ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-900/20 scale-105" 
                  : "bg-gray-900 border-gray-800 text-gray-500 hover:text-gray-300 hover:border-gray-700"
              }`}
            >
              {tab.icon}
              {tab.label}
              {selection === tab.id && (
                <motion.div layoutId="activeDot" className="w-1.5 h-1.5 rounded-full bg-white ml-1" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ZONE DE CONTENU DYNAMIQUE */}
      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={selection}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="h-full w-full"
          >
            {/* On injecte ici le composant sélectionné */}
            <div className="h-full p-4 lg:p-0">
               <SelectedComponent currency={currency} />
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* FOOTER DE NAVIGATION RAPIDE (Mobile) */}
      <div className="lg:hidden p-4 border-t border-gray-800 bg-gray-900 flex justify-between items-center">
         <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Lot actif :</span>
         <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm">
            {activeTab.icon}
            {activeTab.label}
         </div>
      </div>

      <style>{`
        /* Personnalisation de la scrollbar pour les sous-composants */
        ::-webkit-scrollbar {
          width: 5px;
          height: 5px;
        }
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        ::-webkit-scrollbar-thumb {
          background: #312e81;
          border-radius: 10px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #4338ca;
        }
      `}</style>
    </div>
  );
}