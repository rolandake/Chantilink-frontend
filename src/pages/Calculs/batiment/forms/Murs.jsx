import React, { useState, useEffect, useMemo } from "react";
import { BrickWall, Ruler, DoorOpen, Info, Save, Trash2 } from "lucide-react";

const TYPES_BLOCS = {
  "15": { label: "Parpaing de 15", nbM2: 12.5, mortierM3: 0.012 }, // 12L/m2
  "20": { label: "Parpaing de 20", nbM2: 12.5, mortierM3: 0.015 },
  "BT": { label: "Brique Terre Cuite", nbM2: 20, mortierM3: 0.010 }
};

export default function Murs({ currency = "XOF", onTotalChange, onMateriauxChange }) {
  const [inputs, setInputs] = useState({
    longueur: "", hauteur: "", type: "15",
    ouvertures: "", // Surface totale des portes/fenêtres
    prixBloc: "", prixCiment: "", margePerte: "5"
  });

  const results = useMemo(() => {
    const L = parseFloat(inputs.longueur) || 0;
    const H = parseFloat(inputs.hauteur) || 0;
    const S_vide = parseFloat(inputs.ouvertures) || 0;
    const surfaceNette = Math.max(0, (L * H) - S_vide);
    
    const config = TYPES_BLOCS[inputs.type];
    const marge = 1 + (parseFloat(inputs.margePerte) || 5) / 100;

    const nbBlocs = Math.ceil(surfaceNette * config.nbM2 * marge);
    const volMortier = surfaceNette * config.mortierM3;
    const cimentSacs = Math.ceil(volMortier * 7); // ~350kg/m3 de mortier

    const total = (nbBlocs * (parseFloat(inputs.prixBloc) || 0)) + (cimentSacs * (parseFloat(inputs.prixCiment) || 0));

    return { surfaceNette, nbBlocs, cimentSacs, total, volMortier };
  }, [inputs]);

  useEffect(() => {
    onTotalChange(results.total);
    onMateriauxChange({ blocs: results.nbBlocs, ciment: results.cimentSacs * 0.05 });
  }, [results, onTotalChange, onMateriauxChange]);

  return (
    <div className="flex flex-col h-full bg-gray-900 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 lg:p-6 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 space-y-5">
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5 shadow-lg">
              <h3 className="flex items-center gap-2 text-sm font-bold text-orange-400 uppercase mb-4">
                <Ruler className="w-4 h-4" /> Géométrie du Mur
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label="Long. Totale (m)" value={inputs.longueur} onChange={v => setInputs({...inputs, longueur: v})} />
                <InputGroup label="Hauteur (m)" value={inputs.hauteur} onChange={v => setInputs({...inputs, hauteur: v})} />
                <div className="col-span-2">
                  <label className="text-[10px] text-gray-400 font-bold uppercase mb-1 block">Type de maçonnerie</label>
                  <select 
                    className="w-full bg-gray-900 border border-gray-600 rounded-xl p-3 text-sm"
                    value={inputs.type} onChange={e => setInputs({...inputs, type: e.target.value})}
                  >
                    {Object.entries(TYPES_BLOCS).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5 shadow-lg">
              <h3 className="flex items-center gap-2 text-sm font-bold text-gray-400 uppercase mb-4">
                <DoorOpen className="w-4 h-4" /> Ouvertures (Déduction)
              </h3>
              <InputGroup label="Surface des Vides (m²)" value={inputs.ouvertures} onChange={v => setInputs({...inputs, ouvertures: v})} placeholder="Portes + Fenêtres" />
            </div>
          </div>

          <div className="lg:col-span-7 space-y-6">
            <div className="grid grid-cols-2 gap-4">
               <div className="bg-orange-500/10 border border-orange-500/20 p-6 rounded-2xl">
                  <span className="text-4xl font-black text-white block">{results.nbBlocs}</span>
                  <span className="text-orange-400 text-xs font-bold uppercase">Unités de Blocs</span>
               </div>
               <div className="bg-gray-800 border border-gray-700 p-6 rounded-2xl">
                  <span className="text-4xl font-black text-white block">{results.cimentSacs}</span>
                  <span className="text-gray-400 text-xs font-bold uppercase">Sacs Ciment (Mortier)</span>
               </div>
            </div>

            <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
               <h4 className="text-xs font-bold text-gray-500 uppercase mb-4 flex items-center gap-2">
                 <Info className="w-4 h-4" /> Détails Techniques
               </h4>
               <ul className="space-y-3 text-sm">
                  <li className="flex justify-between border-b border-gray-700 pb-2">
                    <span className="text-gray-400">Surface nette à bâtir</span>
                    <span className="font-mono font-bold">{results.surfaceNette.toFixed(2)} m²</span>
                  </li>
                  <li className="flex justify-between border-b border-gray-700 pb-2">
                    <span className="text-gray-400">Mortier de pose</span>
                    <span className="font-mono font-bold">{(results.volMortier * 1000).toFixed(0)} Litres</span>
                  </li>
               </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper interne pour les inputs
const InputGroup = ({ label, value, onChange, placeholder, full = false }) => (
  <div className={`flex flex-col ${full ? "col-span-2" : ""}`}>
    <label className="mb-1 text-[10px] font-bold text-gray-500 uppercase">{label}</label>
    <input
      type="number" value={value} onChange={e => onChange(e.target.value)}
      className="w-full bg-gray-900 border border-gray-600 rounded-xl px-4 py-3 text-white focus:border-orange-500 outline-none transition-all font-mono text-sm"
      placeholder={placeholder || "0"}
    />
  </div>
);