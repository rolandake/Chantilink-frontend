import React, { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Plus, Route, Train, Trash2, Truck } from "lucide-react";
import usePersistentState from "../../../../hooks/usePersistentState";
import { useProjectStore } from "../../../../store/useProjectStore";

const MODES_TRANSPORT = {
  camion: { label: "Camion", factor: 0.3, icon: Truck, desc: "Transport routier courant." },
  train: { label: "Train", factor: 0.05, icon: Train, desc: "Transport bas carbone sur longue distance." },
  bateau: { label: "Bateau / fluvial", factor: 0.02, icon: Route, desc: "Transport maritime ou fluvial." },
  electrique: { label: "Camion électrique", factor: 0.08, icon: Truck, desc: "Transport routier électrifié." },
};

const fmt = (value, decimals = 0) =>
  Number(value || 0).toLocaleString("fr-FR", { maximumFractionDigits: decimals });
const fmtD = (value, decimals = 2) => Number(value || 0).toFixed(decimals);
const num = (value) => Number.parseFloat(value) || 0;

const defaultTrip = (mode = "camion") => ({
  id: Date.now() + Math.random(),
  mode,
  designation: "",
  distance: "",
  tonnage: "",
  prixTkm: "",
  fraisFixes: "",
  expanded: true,
});

const computeTrip = (trip) => {
  const mode = MODES_TRANSPORT[trip.mode] || MODES_TRANSPORT.camion;
  const distance = num(trip.distance);
  const tonnage = num(trip.tonnage);
  const tonneKm = distance * tonnage;
  const co2 = tonneKm * mode.factor;
  const co2RouteRef = tonneKm * MODES_TRANSPORT.camion.factor;
  const co2Evite = Math.max(0, co2RouteRef - co2);
  const total = tonneKm * num(trip.prixTkm) + num(trip.fraisFixes);
  return { ...trip, modeInfo: mode, distance, tonnage, tonneKm, co2, co2Evite, total };
};

export default function TransportEco({
  currency = "XOF",
  onTotalChange = () => {},
  onCostChange = () => {},
  onMateriauxChange = () => {},
  onMaterialsChange = () => {},
}) {
  const setGlobalCost = useProjectStore((state) => state.setCost);
  const setGlobalMaterials = useProjectStore((state) => state.setMaterials);
  const setGlobalResults = useProjectStore((state) => state.setResults);

  const [trips, setTrips] = usePersistentState("eco:transport:trips", [defaultTrip("camion")]);
  const [newMode, setNewMode] = usePersistentState("eco:transport:newMode", "camion");
  const [activeTab, setActiveTab] = useState("trajets");

  const results = useMemo(() => {
    const calc = trips.map(computeTrip);
    const total = calc.reduce((sum, item) => sum + item.total, 0);
    const distance = calc.reduce((sum, item) => sum + item.distance, 0);
    const poids = calc.reduce((sum, item) => sum + item.tonnage, 0);
    const tonneKm = calc.reduce((sum, item) => sum + item.tonneKm, 0);
    const co2 = calc.reduce((sum, item) => sum + item.co2, 0);
    const co2Evite = calc.reduce((sum, item) => sum + item.co2Evite, 0);
    return { calc, total, distance, poids, tonneKm, co2, co2Evite };
  }, [trips]);

  useEffect(() => {
    onTotalChange(results.total);
    onCostChange(results.total);
    const materials = {
      distance: results.distance,
      poids: results.poids,
      tonneKm: results.tonneKm,
      co2: results.co2,
      co2Evite: results.co2Evite,
    };
    onMateriauxChange(materials);
    onMaterialsChange(materials);
    setGlobalCost("ecoTransport", results.total);
    setGlobalMaterials("ecoTransport", materials);
    setGlobalResults("ecoTransport", {
      total: results.total,
      distanceKm: results.distance,
      tonneKm: results.tonneKm,
      co2Kg: results.co2,
      co2EviteKg: results.co2Evite,
      trajets: results.calc.map((item) => ({
        mode: item.mode,
        designation: item.designation || item.modeInfo.label,
        distance: item.distance,
        tonnage: item.tonnage,
        tonneKm: item.tonneKm,
        total: item.total,
      })),
    });
  }, [results]);

  const updateTrip = (id, patch) => setTrips((prev) => prev.map((trip) => (
    trip.id === id ? { ...trip, ...patch } : trip
  )));
  const addTrip = () => setTrips((prev) => [...prev, defaultTrip(newMode)]);
  const removeTrip = (id) => setTrips((prev) => prev.filter((trip) => trip.id !== id));

  return (
    <div className="w-full h-full flex flex-col bg-gray-950 text-gray-100 overflow-hidden">
      <div className="flex-shrink-0 px-5 py-3 border-b border-gray-800 flex justify-between items-center bg-gray-900/70">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/20 rounded-xl text-blue-300">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white leading-tight">Transport bas carbone</h2>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">
              Trajets · tonnes-kilomètres · émissions cumulées
            </p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-gray-500 uppercase font-bold block">Coût total</span>
          <span className="text-xl font-black text-blue-300 tracking-tight">
            {fmt(results.total)} <span className="text-xs text-gray-500 font-normal">{currency}</span>
          </span>
        </div>
      </div>

      <div className="flex-shrink-0 flex border-b border-gray-800 xl:hidden">
        {[["trajets", "Trajets"], ["synthese", "Synthèse"]].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider ${
              activeTab === key ? "text-blue-300 border-b-2 border-blue-300" : "text-gray-500"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-1 xl:grid-cols-12 min-h-full">
          <div className={`xl:col-span-7 p-4 lg:p-5 border-r border-gray-800/50 flex flex-col gap-3 ${activeTab !== "trajets" ? "hidden xl:flex" : "flex"}`}>
            {results.calc.map((trip) => (
              <TripCard
                key={trip.id}
                trip={trip}
                currency={currency}
                onToggle={() => updateTrip(trip.id, { expanded: !trip.expanded })}
                onRemove={() => removeTrip(trip.id)}
                onPatch={(patch) => updateTrip(trip.id, patch)}
              />
            ))}

            <div className="bg-gray-900/40 border border-gray-700/50 rounded-2xl p-4">
              <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-3">Ajouter un trajet</p>
              <select
                value={newMode}
                onChange={(event) => setNewMode(event.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-3 text-sm text-white focus:border-blue-400"
              >
                {Object.entries(MODES_TRANSPORT).map(([key, mode]) => (
                  <option key={key} value={key}>{mode.label}</option>
                ))}
              </select>
              <button
                onClick={addTrip}
                className="mt-3 w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
              >
                <Plus className="w-4 h-4" /> Ajouter au calcul
              </button>
            </div>
          </div>

          <div className={`xl:col-span-5 p-4 lg:p-5 bg-gray-900/20 flex flex-col gap-4 ${activeTab !== "synthese" ? "hidden xl:flex" : "flex"}`}>
            <div className="grid grid-cols-2 gap-3">
              <ResultCard label="Distance" value={fmt(results.distance)} unit="km" />
              <ResultCard label="Charge" value={fmtD(results.poids, 2)} unit="t" />
              <ResultCard label="t.km" value={fmtD(results.tonneKm, 2)} unit="t.km" />
              <ResultCard label="CO2" value={fmtD(results.co2, 2)} unit="kg" />
            </div>

            <div className="bg-gray-900/70 border border-gray-800 rounded-2xl p-4">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Synthèse interne</h3>
              <div className="space-y-2">
                {results.calc.map((trip) => (
                  <div key={trip.id} className="rounded-xl bg-gray-950/60 border border-gray-800 p-3">
                    <div className="flex justify-between gap-3 text-sm">
                      <span className="font-semibold text-white">{trip.designation || trip.modeInfo.label}</span>
                      <span className="font-black text-blue-300">{fmt(trip.total)} {currency}</span>
                    </div>
                    <div className="mt-1 text-[11px] text-gray-400">
                      {fmt(trip.distance)} km · {fmtD(trip.tonnage, 2)} t · {fmtD(trip.co2, 2)} kg CO2e
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-blue-950/30 border border-blue-800/50 rounded-2xl p-4">
              <p className="text-[11px] text-blue-100/80 leading-relaxed">
                Le transport Eco se calcule par trajet. Les modes bas carbone comparent leurs émissions au camion standard
                et remontent automatiquement la distance, les t.km et le CO2 évité au devis.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TripCard({ trip, currency, onToggle, onRemove, onPatch }) {
  const Icon = trip.modeInfo.icon;
  return (
    <div className="bg-gray-900/70 border border-gray-800 rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between gap-3 hover:bg-gray-800/40"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-9 h-9 rounded-xl bg-blue-500/15 text-blue-300 flex items-center justify-center flex-shrink-0">
            <Icon className="w-4 h-4" />
          </span>
          <div className="text-left min-w-0">
            <h3 className="text-sm font-bold text-white truncate">{trip.designation || trip.modeInfo.label}</h3>
            <p className="text-[10px] text-gray-500 truncate">{trip.modeInfo.desc}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-black text-blue-300 whitespace-nowrap">{fmt(trip.total)} {currency}</span>
          {trip.expanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
        </div>
      </button>

      {trip.expanded && (
        <div className="px-4 pb-4 border-t border-gray-800 grid grid-cols-1 md:grid-cols-2 gap-3 pt-4">
          <Input label="Mode de transport" as="select" value={trip.mode} onChange={(value) => onPatch({ mode: value })}>
            {Object.entries(MODES_TRANSPORT).map(([key, mode]) => (
              <option key={key} value={key}>{mode.label}</option>
            ))}
          </Input>
          <Input label="Désignation" value={trip.designation} onChange={(value) => onPatch({ designation: value })} placeholder={trip.modeInfo.label} />
          <Input label="Distance (km)" value={trip.distance} onChange={(value) => onPatch({ distance: value })} />
          <Input label="Charge transportée (t)" value={trip.tonnage} onChange={(value) => onPatch({ tonnage: value })} />
          <Input label={`Prix (${currency}/t.km)`} value={trip.prixTkm} onChange={(value) => onPatch({ prixTkm: value })} />
          <Input label={`Frais fixes (${currency})`} value={trip.fraisFixes} onChange={(value) => onPatch({ fraisFixes: value })} />
          <div className="md:col-span-2 flex flex-wrap gap-2 text-[11px] text-gray-300">
            <Badge label="t.km" value={fmtD(trip.tonneKm, 2)} />
            <Badge label="CO2" value={`${fmtD(trip.co2, 2)} kg`} />
            <Badge label="CO2 évité" value={`${fmtD(trip.co2Evite, 2)} kg`} />
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
          className="w-full bg-gray-950 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:border-blue-400 outline-none"
        >
          {children}
        </select>
      ) : (
        <input
          type={label === "Désignation" ? "text" : "number"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="w-full bg-gray-950 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:border-blue-400 outline-none"
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
    <div className="rounded-2xl border border-blue-800/40 bg-blue-500/10 p-4">
      <div className="text-[10px] uppercase font-bold tracking-wider text-blue-200/80">{label}</div>
      <div className="mt-2 text-xl font-black text-white">
        {value} <span className="text-xs font-normal text-gray-400">{unit}</span>
      </div>
    </div>
  );
}
