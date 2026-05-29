import React, { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Plus, Recycle, Trash2 } from "lucide-react";
import usePersistentState from "../../../../hooks/usePersistentState";
import { useProjectStore } from "../../../../store/useProjectStore";

const TYPES_DECHETS = {
  inertes: { label: "Déchets inertes", taux: 80, co2EviteT: 18, desc: "Gravats, terre, béton non pollué." },
  beton: { label: "Béton / gravats", taux: 85, co2EviteT: 22, desc: "Béton concassé réutilisable en remblais." },
  bois: { label: "Chutes de bois", taux: 70, co2EviteT: 95, desc: "Bois de coffrage, palettes, chutes." },
  metaux: { label: "Métaux", taux: 95, co2EviteT: 1300, desc: "Acier, alu, ferrailles triées." },
  dangereux: { label: "Déchets dangereux", taux: 10, co2EviteT: 0, desc: "Peintures, solvants, huiles, filtres." },
  melange: { label: "Déchets mélangés", taux: 35, co2EviteT: 8, desc: "Déchets non triés à faible valorisation." },
};

const fmt = (value, decimals = 0) =>
  Number(value || 0).toLocaleString("fr-FR", { maximumFractionDigits: decimals });
const fmtD = (value, decimals = 2) => Number(value || 0).toFixed(decimals);
const num = (value) => Number.parseFloat(value) || 0;

const defaultFlux = (type = "inertes") => ({
  id: Date.now() + Math.random(),
  type,
  designation: "",
  tonnage: "",
  tauxRecyclage: "",
  prixTraitement: "",
  prixTri: "",
  expanded: true,
});

const computeFlux = (flux) => {
  const config = TYPES_DECHETS[flux.type] || TYPES_DECHETS.inertes;
  const tonnage = num(flux.tonnage);
  const taux = Math.min(100, Math.max(0, num(flux.tauxRecyclage) || config.taux));
  const recycle = tonnage * taux / 100;
  const evacue = Math.max(0, tonnage - recycle);
  const total = tonnage * num(flux.prixTraitement) + num(flux.prixTri);
  const co2Evite = recycle * config.co2EviteT;
  return { ...flux, config, tonnage, taux, recycle, evacue, total, co2Evite };
};

export default function DechetsEco({
  currency = "XOF",
  onTotalChange = () => {},
  onCostChange = () => {},
  onMateriauxChange = () => {},
  onMaterialsChange = () => {},
}) {
  const setGlobalCost = useProjectStore((state) => state.setCost);
  const setGlobalMaterials = useProjectStore((state) => state.setMaterials);
  const setGlobalResults = useProjectStore((state) => state.setResults);

  const [flux, setFlux] = usePersistentState("eco:dechets:flux", [defaultFlux("inertes")]);
  const [newType, setNewType] = usePersistentState("eco:dechets:newType", "inertes");
  const [activeTab, setActiveTab] = useState("flux");

  const results = useMemo(() => {
    const calc = flux.map(computeFlux);
    const total = calc.reduce((sum, item) => sum + item.total, 0);
    const dechets = calc.reduce((sum, item) => sum + item.tonnage, 0);
    const recyclage = calc.reduce((sum, item) => sum + item.recycle, 0);
    const dechetsEvacues = calc.reduce((sum, item) => sum + item.evacue, 0);
    const co2Evite = calc.reduce((sum, item) => sum + item.co2Evite, 0);
    const tauxRecyclage = dechets > 0 ? recyclage / dechets * 100 : 0;
    return { calc, total, dechets, recyclage, dechetsEvacues, co2Evite, tauxRecyclage };
  }, [flux]);

  useEffect(() => {
    onTotalChange(results.total);
    onCostChange(results.total);
    const materials = {
      dechets: results.dechets,
      recyclage: results.recyclage,
      dechetsEvacues: results.dechetsEvacues,
      co2Evite: results.co2Evite,
      tauxRecyclage: results.tauxRecyclage,
    };
    onMateriauxChange(materials);
    onMaterialsChange(materials);
    setGlobalCost("ecoDechets", results.total);
    setGlobalMaterials("ecoDechets", materials);
    setGlobalResults("ecoDechets", {
      total: results.total,
      dechetsT: results.dechets,
      recyclageT: results.recyclage,
      dechetsEvacuesT: results.dechetsEvacues,
      co2EviteKg: results.co2Evite,
      tauxRecyclage: results.tauxRecyclage,
      flux: results.calc.map((item) => ({
        type: item.type,
        designation: item.designation || item.config.label,
        tonnage: item.tonnage,
        recycle: item.recycle,
        evacue: item.evacue,
        total: item.total,
      })),
    });
  }, [results]);

  const updateFlux = (id, patch) => setFlux((prev) => prev.map((item) => (
    item.id === id ? { ...item, ...patch } : item
  )));
  const addFlux = () => setFlux((prev) => [...prev, defaultFlux(newType)]);
  const removeFlux = (id) => setFlux((prev) => prev.filter((item) => item.id !== id));

  return (
    <div className="w-full h-full flex flex-col bg-gray-950 text-gray-100 overflow-hidden">
      <div className="flex-shrink-0 px-5 py-3 border-b border-gray-800 flex justify-between items-center bg-gray-900/70">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-500/20 rounded-xl text-orange-300">
            <Recycle className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white leading-tight">Déchets & recyclage</h2>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">
              Tri · valorisation · évacuation · CO2 évité
            </p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-gray-500 uppercase font-bold block">Coût total</span>
          <span className="text-xl font-black text-orange-300 tracking-tight">
            {fmt(results.total)} <span className="text-xs text-gray-500 font-normal">{currency}</span>
          </span>
        </div>
      </div>

      <div className="flex-shrink-0 flex border-b border-gray-800 xl:hidden">
        {[["flux", "Flux"], ["synthese", "Synthèse"]].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider ${
              activeTab === key ? "text-orange-300 border-b-2 border-orange-300" : "text-gray-500"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-1 xl:grid-cols-12 min-h-full">
          <div className={`xl:col-span-7 p-4 lg:p-5 border-r border-gray-800/50 flex flex-col gap-3 ${activeTab !== "flux" ? "hidden xl:flex" : "flex"}`}>
            {results.calc.map((item) => (
              <FluxCard
                key={item.id}
                item={item}
                currency={currency}
                onToggle={() => updateFlux(item.id, { expanded: !item.expanded })}
                onRemove={() => removeFlux(item.id)}
                onPatch={(patch) => updateFlux(item.id, patch)}
              />
            ))}

            <div className="bg-gray-900/40 border border-gray-700/50 rounded-2xl p-4">
              <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-3">Ajouter un flux de déchets</p>
              <select
                value={newType}
                onChange={(event) => setNewType(event.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-3 text-sm text-white focus:border-orange-400"
              >
                {Object.entries(TYPES_DECHETS).map(([key, item]) => (
                  <option key={key} value={key}>{item.label}</option>
                ))}
              </select>
              <button
                onClick={addFlux}
                className="mt-3 w-full bg-orange-600 hover:bg-orange-500 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
              >
                <Plus className="w-4 h-4" /> Ajouter au calcul
              </button>
            </div>
          </div>

          <div className={`xl:col-span-5 p-4 lg:p-5 bg-gray-900/20 flex flex-col gap-4 ${activeTab !== "synthese" ? "hidden xl:flex" : "flex"}`}>
            <div className="grid grid-cols-2 gap-3">
              <ResultCard label="Déchets" value={fmtD(results.dechets, 2)} unit="t" />
              <ResultCard label="Recyclés" value={fmtD(results.recyclage, 2)} unit="t" />
              <ResultCard label="Évacués" value={fmtD(results.dechetsEvacues, 2)} unit="t" />
              <ResultCard label="Valorisation" value={fmt(results.tauxRecyclage)} unit="%" />
            </div>

            <div className="bg-gray-900/70 border border-gray-800 rounded-2xl p-4">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Synthèse interne</h3>
              <div className="space-y-2">
                {results.calc.map((item) => (
                  <div key={item.id} className="rounded-xl bg-gray-950/60 border border-gray-800 p-3">
                    <div className="flex justify-between gap-3 text-sm">
                      <span className="font-semibold text-white">{item.designation || item.config.label}</span>
                      <span className="font-black text-orange-300">{fmt(item.total)} {currency}</span>
                    </div>
                    <div className="mt-1 text-[11px] text-gray-400">
                      {fmtD(item.tonnage, 2)} t · recyclés {fmtD(item.recycle, 2)} t · évacués {fmtD(item.evacue, 2)} t
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-orange-950/30 border border-orange-800/50 rounded-2xl p-4">
              <p className="text-[11px] text-orange-100/80 leading-relaxed">
                Le tri doit être saisi par flux réel. La synthèse sépare automatiquement les tonnages recyclés,
                évacués et les gains CO2, puis les transmet au récapitulatif Eco.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FluxCard({ item, currency, onToggle, onRemove, onPatch }) {
  return (
    <div className="bg-gray-900/70 border border-gray-800 rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between gap-3 hover:bg-gray-800/40"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-9 h-9 rounded-xl bg-orange-500/15 text-orange-300 flex items-center justify-center flex-shrink-0">
            <Recycle className="w-4 h-4" />
          </span>
          <div className="text-left min-w-0">
            <h3 className="text-sm font-bold text-white truncate">{item.designation || item.config.label}</h3>
            <p className="text-[10px] text-gray-500 truncate">{item.config.desc}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-black text-orange-300 whitespace-nowrap">{fmt(item.total)} {currency}</span>
          {item.expanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
        </div>
      </button>

      {item.expanded && (
        <div className="px-4 pb-4 border-t border-gray-800 grid grid-cols-1 md:grid-cols-2 gap-3 pt-4">
          <Input label="Type de déchet" as="select" value={item.type} onChange={(value) => onPatch({ type: value })}>
            {Object.entries(TYPES_DECHETS).map(([key, flux]) => (
              <option key={key} value={key}>{flux.label}</option>
            ))}
          </Input>
          <Input label="Désignation" value={item.designation} onChange={(value) => onPatch({ designation: value })} placeholder={item.config.label} />
          <Input label="Tonnage (t)" value={item.tonnage} onChange={(value) => onPatch({ tonnage: value })} />
          <Input label="Taux recyclage (%)" value={item.tauxRecyclage} onChange={(value) => onPatch({ tauxRecyclage: value })} placeholder={String(item.config.taux)} />
          <Input label={`Traitement (${currency}/t)`} value={item.prixTraitement} onChange={(value) => onPatch({ prixTraitement: value })} />
          <Input label={`Tri / manutention (${currency})`} value={item.prixTri} onChange={(value) => onPatch({ prixTri: value })} />
          <div className="md:col-span-2 flex flex-wrap gap-2 text-[11px] text-gray-300">
            <Badge label="Recyclé" value={`${fmtD(item.recycle, 2)} t`} />
            <Badge label="Évacué" value={`${fmtD(item.evacue, 2)} t`} />
            <Badge label="CO2 évité" value={`${fmtD(item.co2Evite, 2)} kg`} />
            <button
              type="button"
              onClick={onRemove}
              className="ml-auto px-3 py-2 rounded-lg bg-red-500/10 text-red-300 hover:bg-red-500/20 flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" /> Retirer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Input({ label, value, onChange, placeholder = "0", as, children }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{label}</span>
      {as === "select" ? (
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full bg-gray-950 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:border-orange-400 outline-none"
        >
          {children}
        </select>
      ) : (
        <input
          type={label === "Désignation" ? "text" : "number"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="w-full bg-gray-950 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:border-orange-400 outline-none"
        />
      )}
    </label>
  );
}

function Badge({ label, value }) {
  return (
    <span className="px-3 py-2 rounded-lg bg-gray-950 border border-gray-800">
      <span className="text-gray-500">{label}: </span>
      <strong className="text-white">{value}</strong>
    </span>
  );
}

function ResultCard({ label, value, unit }) {
  return (
    <div className="rounded-2xl border border-orange-800/40 bg-orange-500/10 p-4">
      <div className="text-[10px] uppercase font-bold tracking-wider text-orange-200/80">{label}</div>
      <div className="mt-2 text-xl font-black text-white">
        {value} <span className="text-xs font-normal text-gray-400">{unit}</span>
      </div>
    </div>
  );
}
