import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import {
  Pickaxe, Plus, Trash2, ChevronDown, ChevronUp, Truck,
  Info, Layers, MoveHorizontal, Square, Grid3X3, ArrowDownToLine,
  Triangle, Shield, Shovel, Archive, RotateCcw, SlidersHorizontal,
  Package, Wrench, ChevronRight,
} from "lucide-react";

import { useProjectStore } from "../../../../store/useProjectStore";
import usePersistentState from "../../../../hooks/usePersistentState";

ChartJS.register(ArcElement, Tooltip, Legend);

// ─── DONNÉES MÉTIER ────────────────────────────────────────────────────────────

const NATURE_SOL = {
  SABLE:  { label: "Sable / Gravier",  coeff: 1.15 },
  TERRE:  { label: "Terre ordinaire",  coeff: 1.25 },
  ARGILE: { label: "Argile / Limon",   coeff: 1.35 },
  ROCHER: { label: "Rocher",           coeff: 1.50 },
};

const CATEGORIES = {
  A: { label: "A — Préparatoire",     color: "text-sky-400",    border: "border-sky-500/40",    bg: "bg-sky-500/8",    dot: "bg-sky-500" },
  B: { label: "B — Fouilles",         color: "text-amber-400",  border: "border-amber-500/40",  bg: "bg-amber-500/8",  dot: "bg-amber-500" },
  C: { label: "C — Gestion terres",   color: "text-orange-400", border: "border-orange-500/40", bg: "bg-orange-500/8", dot: "bg-orange-500" },
  D: { label: "D — Remblai/finitions",color: "text-green-400",  border: "border-green-500/40",  bg: "bg-green-500/8",  dot: "bg-green-500" },
};

const TYPES_OUVRAGE = {
  DECAPAGE:     { cat:"A", label:"Décapage de terre végétale",            desc:"Retrait de la couche superficielle",                   formule:"Surface × Épaisseur",                       icon:Layers,           fields:[{key:"surface",label:"Surface (m²)",placeholder:"ex: 800"},{key:"epaisseur",label:"Épaisseur (m)",placeholder:"ex: 0.25"}],                                                                        unit:"m³", compute:(f)=>f("surface")*f("epaisseur"),                                     hasSol:true },
  NIVELLEMENT:  { cat:"A", label:"Nivellement / réglage plateforme",      desc:"Préparation finale du terrain",                        formule:"Surface (m²)",                              icon:SlidersHorizontal,fields:[{key:"surface",label:"Surface (m²)",placeholder:"ex: 600"}],                                                                                                                               unit:"m²", compute:(f)=>f("surface"),                                                hasSol:false, prixUnit:true },
  RIGOLE:       { cat:"B", label:"Fouilles en rigoles",                   desc:"Semelles filantes, murs de fondation, longrines",      formule:"Longueur × Largeur × Profondeur",           icon:MoveHorizontal,   fields:[{key:"longueur",label:"Longueur (m)",placeholder:"ex: 120"},{key:"largeur",label:"Largeur (m)",placeholder:"ex: 0.60"},{key:"profondeur",label:"Profondeur (m)",placeholder:"ex: 1.20"}],   unit:"m³", compute:(f)=>f("longueur")*f("largeur")*f("profondeur"),                     hasSol:true },
  TROU:         { cat:"B", label:"Fouilles en trous",                     desc:"Semelles isolées, massifs, plots",                     formule:"Nombre × L × l × h",                        icon:Square,           fields:[{key:"nombre",label:"Nombre",placeholder:"ex: 18"},{key:"longueur",label:"Longueur (m)",placeholder:"ex: 2.00"},{key:"largeur",label:"Largeur (m)",placeholder:"ex: 2.00"},{key:"profondeur",label:"Profondeur (m)",placeholder:"ex: 1.50"}], unit:"m³", compute:(f)=>f("nombre")*f("longueur")*f("largeur")*f("profondeur"), hasSol:true },
  TRANCHEE:     { cat:"B", label:"Fouilles en tranchées",                 desc:"Canalisations, réseaux, drains, longrines",            formule:"Longueur × Largeur × Profondeur",           icon:Grid3X3,          fields:[{key:"longueur",label:"Longueur (m)",placeholder:"ex: 200"},{key:"largeur",label:"Largeur (m)",placeholder:"ex: 0.80"},{key:"profondeur",label:"Profondeur (m)",placeholder:"ex: 1.00"}],   unit:"m³", compute:(f)=>f("longueur")*f("largeur")*f("profondeur"),                     hasSol:true },
  EXCAVATION:   { cat:"B", label:"Excavation pleine masse",               desc:"Radiers, sous-sols, piscines, fosses, cages ascenseur", formule:"Surface × Profondeur",                      icon:ArrowDownToLine,  fields:[{key:"surface",label:"Surface (m²)",placeholder:"ex: 250"},{key:"profondeur",label:"Profondeur (m)",placeholder:"ex: 2.50"}],                                                                unit:"m³", compute:(f)=>f("surface")*f("profondeur"),                                   hasSol:true },
  TALUTAGE:     { cat:"B", label:"Talutage",                              desc:"Parois inclinées pour éviter l'éboulement",            formule:"Longueur × h² × pente / 2",                 icon:Triangle,         fields:[{key:"longueur",label:"Longueur talus (m)",placeholder:"ex: 40"},{key:"hauteur",label:"Hauteur (m)",placeholder:"ex: 2.00"},{key:"pente",label:"Coeff. pente",placeholder:"ex: 0.5"}],          unit:"m³", compute:(f)=>f("longueur")*(f("hauteur")*f("hauteur")*f("pente")/2),         hasSol:true, note:"Le volume de talutage s'ajoute au volume de fouille." },
  BLINDAGE:     { cat:"B", label:"Blindage des fouilles",                 desc:"Protection des fouilles profondes",                    formule:"Surface de blindage (m²)",                  icon:Shield,           fields:[{key:"surface",label:"Surface blindée (m²)",placeholder:"ex: 120"}],                                                                                                                         unit:"m²", compute:(f)=>f("surface"),                                                hasSol:false, prixUnit:true },
  EVACUATION:   { cat:"C", label:"Évacuation des déblais",                desc:"Transport des terres excavées (foisonnement appliqué)", formule:"Volume en place × coeff foisonnement",      icon:Truck,            fields:[{key:"volume",label:"Volume en place (m³)",placeholder:"ex: 300"},{key:"distance",label:"Distance décharge (km)",placeholder:"ex: 15"}],                                                    unit:"m³", compute:(f)=>f("volume"),                                                 hasSol:true, isEvac:true },
  DEPOT:        { cat:"C", label:"Mise en dépôt / stockage",              desc:"Terres conservées sur site",                           formule:"Volume stocké (m³)",                         icon:Archive,          fields:[{key:"volume",label:"Volume stocké (m³)",placeholder:"ex: 80"}],                                                                                                                            unit:"m³", compute:(f)=>f("volume"),                                                hasSol:false, prixUnit:true, isStockage:true },
  SPECIAL:      { cat:"C", label:"Terrassement spécial",                  desc:"Rocher, nappe, pompage, soutènement, démolition",      formule:"Volume (m³) ou Forfait",                    icon:Wrench,           fields:[{key:"volume",label:"Volume (m³)",placeholder:"ex: 50"}],                                                                                                                                  unit:"m³", compute:(f)=>f("volume"),                                                hasSol:true, note:"Rocher, nappe phréatique, terrain instable, démolition enterrée." },
  REMBLAI:      { cat:"D", label:"Remblaiement",                          desc:"Mise en place des terres ou matériaux d'apport",       formule:"Volume remblai",                             icon:Shovel,           fields:[{key:"volume",label:"Volume remblai (m³)",placeholder:"ex: 90"}],                                                                                                                                  unit:"m³", compute:(f)=>f("volume"),                                                hasSol:false, isRemblai:true },
  COMPACTAGE:   { cat:"D", label:"Compactage",                            desc:"Compactage des remblais",                              formule:"Surface (m²)",                              icon:RotateCcw,        fields:[{key:"surface",label:"Surface (m²)",placeholder:"ex: 400"}],                                                                                                                               unit:"m²", compute:(f)=>f("surface"),                                                hasSol:false, prixUnit:true },
  COUCHE_FORME: { cat:"D", label:"Couche de forme",                       desc:"Latérite, grave, tout-venant",                         formule:"Surface × Épaisseur",                       icon:Package,          fields:[{key:"surface",label:"Surface (m²)",placeholder:"ex: 500"},{key:"epaisseur",label:"Épaisseur (m)",placeholder:"ex: 0.20"}],                                                                unit:"m³", compute:(f)=>f("surface")*f("epaisseur"),                                 hasSol:false, prixUnit:true },
};

const getF = (fields) => (key) => parseFloat(fields?.[key]) || 0;
const fmt  = (n) => Math.round(n).toLocaleString("fr-FR");
const fmtD = (n, d = 2) => ((n) || 0).toFixed(d);

const defaultOuvrage = (type = "RIGOLE") => ({
  id: Date.now() + Math.random(),
  type, label: "", typeSol: "TERRE", prixUnit: "", fields: {}, expanded: true,
});

// ─── COMPOSANT PRINCIPAL ──────────────────────────────────────────────────────

export default function Terrassement({ currency = "XOF", onCostChange }) {
  const [ouvrages, setOuvrages]             = usePersistentState("terrassement:ouvrages", [defaultOuvrage("DECAPAGE"), defaultOuvrage("RIGOLE")]);
  const [prixExcavation, setPrixExcavation] = usePersistentState("terrassement:prixExcavation", "");
  const [prixEvacuation, setPrixEvacuation] = usePersistentState("terrassement:prixEvacuation", "");
  const [capaciteCamion, setCapaciteCamion] = usePersistentState("terrassement:capaciteCamion", "16");
  const [newType, setNewType]               = usePersistentState("terrassement:newType", "TROU");
  const [activeTab, setActiveTab]           = usePersistentState("terrassement:activeTab", "ouvrages");

  // ── Store global ──────────────────────────────────────────────────────────
  const setResults   = useProjectStore((s) => s.setResults);
  const setMaterials = useProjectStore((s) => s.setMaterials);
  const setCost      = useProjectStore((s) => s.setCost);

  const volumeFouillesAuto = useMemo(() => ouvrages.reduce((sum, o) => {
    const def = TYPES_OUVRAGE[o.type];
    if (!def?.hasSol || def.isEvac || def.isRemblai || def.isStockage) return sum;
    return sum + def.compute(getF(o.fields));
  }, 0), [ouvrages]);

  const volumeDepotDisponibleAuto = useMemo(() => {
    const volumeDepotSaisi = ouvrages
      .filter((o) => o.type === "DEPOT")
      .reduce((sum, o) => sum + (parseFloat(o.fields?.volume) || 0), 0);

    return volumeDepotSaisi > 0 ? volumeDepotSaisi : volumeFouillesAuto;
  }, [ouvrages, volumeFouillesAuto]);

  const surfacePlateformeAuto = useMemo(() => {
    const decapageSurfaces = ouvrages
      .filter((o) => o.type === "DECAPAGE")
      .map((o) => parseFloat(o.fields?.surface) || 0)
      .filter((surface) => surface > 0);

    if (decapageSurfaces.length > 0) return Math.max(...decapageSurfaces);

    const excavationSurfaces = ouvrages
      .filter((o) => o.type === "EXCAVATION")
      .map((o) => parseFloat(o.fields?.surface) || 0)
      .filter((surface) => surface > 0);

    return excavationSurfaces.length > 0 ? Math.max(...excavationSurfaces) : 0;
  }, [ouvrages]);

  const autoFieldValues = useMemo(() => ({
    NIVELLEMENT: {
      surface: surfacePlateformeAuto,
    },
    EXCAVATION: {
      surface: surfacePlateformeAuto,
    },
    EVACUATION: {
      volume: volumeFouillesAuto,
    },
    DEPOT: {
      volume: volumeFouillesAuto,
    },
    REMBLAI: {
      volume: volumeDepotDisponibleAuto,
    },
    COMPACTAGE: {
      surface: surfacePlateformeAuto,
    },
    COUCHE_FORME: {
      surface: surfacePlateformeAuto,
    },
  }), [volumeFouillesAuto, volumeDepotDisponibleAuto, surfacePlateformeAuto]);

  const getEffectiveFields = useCallback((ouvrage) => {
    const autoFields = autoFieldValues[ouvrage.type] || {};
    const fields = { ...(ouvrage.fields || {}) };

    Object.entries(autoFields).forEach(([key, value]) => {
      if ((fields[key] === undefined || fields[key] === "") && Number(value) > 0) {
        fields[key] = String(value);
      }
    });

    return fields;
  }, [autoFieldValues]);

  const deblaisUsage = useMemo(() => {
    const effectiveVolume = (o) => parseFloat(getEffectiveFields(o).volume) || 0;
    const evacue = ouvrages
      .filter((o) => o.type === "EVACUATION")
      .reduce((sum, o) => sum + effectiveVolume(o), 0);
    const stocke = ouvrages
      .filter((o) => o.type === "DEPOT")
      .reduce((sum, o) => sum + effectiveVolume(o), 0);
    const remblaye = ouvrages
      .filter((o) => o.type === "REMBLAI")
      .reduce((sum, o) => sum + effectiveVolume(o), 0);

    return {
      evacue,
      stocke,
      remblaye,
      solde: volumeFouillesAuto - evacue - stocke - remblaye,
    };
  }, [ouvrages, volumeFouillesAuto, getEffectiveFields]);

  // ── Calcul ────────────────────────────────────────────────────────────────
  const results = useMemo(() => {
    let totalDeblai = 0, totalRemblai = 0, totalFoisonne = 0, coutSpeciaux = 0;

    const ouvragesCalc = ouvrages.map((o) => {
      const def  = TYPES_OUVRAGE[o.type];
      if (!def) return { ...o, vol: 0 };
      const vol  = def.compute(getF(getEffectiveFields(o)));
      const coeff = NATURE_SOL[o.typeSol]?.coeff || 1.25;
      const pu   = parseFloat(o.prixUnit) || 0;

      if (def.isRemblai) {
        totalRemblai += vol;
        const cout = pu > 0 ? vol * pu : 0;
        coutSpeciaux += cout;
        return { ...o, vol, cout, isRemblai: true };
      }
      if (def.prixUnit || def.isEvac || def.isStockage) {
        const cout = vol * pu;
        coutSpeciaux += cout;
        const volFoisonne = def.hasSol ? vol * coeff : 0;
        if (def.hasSol) totalFoisonne += volFoisonne;
        return { ...o, vol, volFoisonne, cout };
      }
      if (def.hasSol) {
        const volFoisonne = vol * coeff;
        totalDeblai  += vol;
        totalFoisonne += volFoisonne;
        return { ...o, vol, volFoisonne, coeff, cout: 0 };
      }
      return { ...o, vol, cout: vol * pu };
    });

    const puExcav = parseFloat(prixExcavation) || 0;
    const puEvac  = parseFloat(prixEvacuation) || 0;
    const capCam  = parseFloat(capaciteCamion) || 16;

    const coutExcavation = totalDeblai   * puExcav;
    const coutEvacuation = totalFoisonne * puEvac;
    const total          = coutExcavation + coutEvacuation + coutSpeciaux;
    const nbCamions      = totalFoisonne > 0 ? Math.ceil(totalFoisonne / capCam) : 0;
    const deblaisNets    = totalDeblai - totalRemblai;

    return {
      ouvragesCalc, totalDeblai, totalRemblai, totalFoisonne, deblaisNets,
      coutExcavation, coutEvacuation, coutSpeciaux, total, nbCamions,
    };
  }, [ouvrages, prixExcavation, prixEvacuation, capaciteCamion, getEffectiveFields]);

  // ── Synchronisation store global ──────────────────────────────────────────
  useEffect(() => {
    // Coût vers parent et store
    if (onCostChange) onCostChange(results.total);
    setCost("terrassement", results.total);

    // ✅ RÉSULTATS TECHNIQUES → disponibles pour Fondation, Remblai, etc.
    setResults("terrassement", {
      totalDeblai:   results.totalDeblai,
      totalFoisonne: results.totalFoisonne,
      totalRemblai:  results.totalRemblai,
      deblaisNets:   Math.max(0, results.deblaisNets),
      nbCamions:     results.nbCamions,
      deblaisEvacues: deblaisUsage.evacue,
      deblaisStockes: deblaisUsage.stocke,
      deblaisRemblayes: deblaisUsage.remblaye,
      soldeDeblais: deblaisUsage.solde,
      // Profondeur moyenne estimée (utile pour pré-remplir Fondation)
      profondeurMoyenne: (() => {
        const fouilles = ouvrages.filter(o =>
          ["RIGOLE", "TROU", "TRANCHEE", "EXCAVATION"].includes(o.type)
        );
        if (fouilles.length === 0) return 0;
        const sum = fouilles.reduce((acc, o) => acc + (parseFloat(o.fields?.profondeur) || 0), 0);
        return sum / fouilles.length;
      })(),
      // Surfaces excavées (utile pour le remblai)
      surfacePlateforme: (() => {
        return surfacePlateformeAuto;
      })(),
      surfaceCompactage: results.ouvragesCalc
        .filter((o) => o.type === "COMPACTAGE")
        .reduce((sum, o) => sum + (o.vol || 0), 0),
      surfaceCoucheForme: results.ouvragesCalc
        .filter((o) => o.type === "COUCHE_FORME")
        .reduce((sum, o) => sum + (parseFloat(o.fields?.surface) || surfacePlateformeAuto || 0), 0),
    });

    // ✅ MATÉRIAUX (ici c'est principalement de la logistique)
    setMaterials("terrassement", {
      volume:   results.totalDeblai,
      foisonne: results.totalFoisonne,
    });
  }, [results.total, results.totalDeblai, results.totalFoisonne, results.totalRemblai, surfacePlateformeAuto, deblaisUsage]);

  // ── Mutations ─────────────────────────────────────────────────────────────
  const updateOuvrage = useCallback((id, patch) =>
    setOuvrages((p) => p.map((o) => o.id === id ? { ...o, ...patch } : o)), []);
  const updateField = useCallback((id, key, val) =>
    setOuvrages((p) => p.map((o) => o.id === id ? { ...o, fields: { ...o.fields, [key]: val } } : o)), []);
  const removeOuvrage = useCallback((id) =>
    setOuvrages((p) => p.filter((o) => o.id !== id)), []);
  const toggleExpand = useCallback((id) =>
    setOuvrages((p) => p.map((o) => o.id === id ? { ...o, expanded: !o.expanded } : o)), []);
  const addOuvrage = () => setOuvrages((p) => [...p, defaultOuvrage(newType)]);

  // ── Chart ─────────────────────────────────────────────────────────────────
  const chartData = {
    labels: ["Excavation", "Évacuation", "Spéciaux"],
    datasets: [{
      data: [results.coutExcavation, results.coutEvacuation, results.coutSpeciaux],
      backgroundColor: ["#f59e0b", "#78716c", "#6366f1"],
      borderColor: "transparent",
      borderWidth: 0,
    }],
  };

  const byCategory = useMemo(() => {
    const map = { A: [], B: [], C: [], D: [] };
    results.ouvragesCalc.forEach((o) => {
      const cat = TYPES_OUVRAGE[o.type]?.cat;
      if (cat && map[cat]) map[cat].push(o);
    });
    return map;
  }, [results.ouvragesCalc]);

  return (
    <div className="w-full h-full flex flex-col bg-gray-950 text-gray-100 overflow-hidden">

      {/* HEADER */}
      <div className="flex-shrink-0 px-5 py-3 border-b border-gray-800 flex justify-between items-center bg-gray-900/70">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/20 rounded-xl text-amber-400">
            <Pickaxe className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white leading-tight">Terrassement BTP</h2>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">
              14 ouvrages · 4 catégories professionnelles
            </p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-gray-500 uppercase font-bold block">Coût total</span>
          <span className="text-xl font-black text-amber-400 tracking-tight">
            {fmt(results.total)} <span className="text-xs text-gray-500 font-normal">{currency}</span>
          </span>
        </div>
      </div>

      {/* TABS mobile */}
      <div className="flex-shrink-0 flex border-b border-gray-800 xl:hidden">
        {[["ouvrages", "Ouvrages"], ["synthese", "Synthèse"]].map(([k, l]) => (
          <button key={k} onClick={() => setActiveTab(k)}
            className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors ${
              activeTab === k ? "text-amber-400 border-b-2 border-amber-400" : "text-gray-500 hover:text-gray-300"
            }`}>{l}</button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-1 xl:grid-cols-12 min-h-full">

          {/* ══ GAUCHE : OUVRAGES ══ */}
          <div className={`xl:col-span-7 p-4 lg:p-5 border-r border-gray-800/50 flex flex-col gap-3 ${activeTab !== "ouvrages" ? "hidden xl:flex" : "flex"}`}>

            {/* Tarification globale */}
            <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-4 grid grid-cols-3 gap-3 flex-shrink-0">
              <PriceInput label={`Excavation (${currency}/m³)`} value={prixExcavation} onChange={setPrixExcavation} />
              <PriceInput label={`Évacuation (${currency}/m³)`} value={prixEvacuation} onChange={setPrixEvacuation} />
              <PriceInput label="Capacité camion (m³)" value={capaciteCamion} onChange={setCapaciteCamion} />
            </div>

            {/* Liste ouvrages */}
            {ouvrages.map((ouvrage) => {
              const def  = TYPES_OUVRAGE[ouvrage.type];
              if (!def) return null;
              const cat  = CATEGORIES[def.cat];
              const Icon = def.icon;
              const calc = results.ouvragesCalc.find((c) => c.id === ouvrage.id);
              return (
                <OuvrageCard key={ouvrage.id}
                  ouvrage={ouvrage} def={def} cat={cat} Icon={Icon}
                  vol={calc?.vol || 0} calc={calc} currency={currency}
                  autoFields={autoFieldValues[ouvrage.type] || {}}
                  onToggle={() => toggleExpand(ouvrage.id)}
                  onRemove={() => removeOuvrage(ouvrage.id)}
                  onLabelChange={(v) => updateOuvrage(ouvrage.id, { label: v })}
                  onSolChange={(v) => updateOuvrage(ouvrage.id, { typeSol: v })}
                  onPrixChange={(v) => updateOuvrage(ouvrage.id, { prixUnit: v })}
                  onFieldChange={(k, v) => updateField(ouvrage.id, k, v)}
                />
              );
            })}

            {/* Ajout ouvrage */}
            <div className="flex-shrink-0 mt-1 bg-gray-900/40 border border-gray-700/50 rounded-2xl p-4">
              <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-3">Ajouter un ouvrage</p>
              <label className="block mb-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-wide">
                Type de terrassement
              </label>
              <div className="relative">
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                  className="w-full appearance-none bg-gray-900 border border-gray-700 rounded-xl px-3 py-3 pr-10 text-sm text-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 focus:outline-none transition-all"
                >
                  {Object.entries(CATEGORIES).map(([catKey, catDef]) => (
                    <optgroup key={catKey} label={catDef.label}>
                      {Object.entries(TYPES_OUVRAGE)
                        .filter(([, d]) => d.cat === catKey)
                        .map(([key, d]) => (
                          <option key={key} value={key}>{d.label}</option>
                        ))}
                    </optgroup>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              </div>
              <button onClick={addOuvrage}
                className="w-full mt-3 flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-500 text-white py-3 rounded-xl font-bold text-sm transition-all">
                <Plus className="w-4 h-4" />
                Ajouter — {TYPES_OUVRAGE[newType]?.label}
              </button>
            </div>

            {/* Récapitulatif interne */}
            <div className="flex-shrink-0 bg-gray-900/60 border border-amber-500/20 rounded-2xl p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <p className="text-[10px] text-amber-300 uppercase font-bold tracking-widest">
                    Récapitulatif interne
                  </p>
                  <p className="text-[11px] text-gray-500">Synthèse mise à jour en temps réel</p>
                </div>
                <span className="text-sm font-black text-amber-400 font-mono">
                  {fmt(results.total)} {currency}
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <ReadonlySummaryField label="Surface plateforme" value={fmtD(surfacePlateformeAuto)} unit="m²" />
                <ReadonlySummaryField label="Déblais bruts" value={fmtD(results.totalDeblai)} unit="m³" />
                <ReadonlySummaryField label="Volume foisonné" value={fmtD(results.totalFoisonne)} unit="m³" />
                <ReadonlySummaryField label="Déblais nets" value={fmtD(Math.max(0, results.deblaisNets))} unit="m³" />
                <ReadonlySummaryField label="Déblais évacués" value={fmtD(deblaisUsage.evacue)} unit="m³" />
                <ReadonlySummaryField label="Déblais stockés" value={fmtD(deblaisUsage.stocke)} unit="m³" />
                <ReadonlySummaryField label="Solde déblais" value={fmtD(deblaisUsage.solde)} unit="m³" />
                <ReadonlySummaryField label="Remblai" value={fmtD(results.totalRemblai)} unit="m³" />
                <ReadonlySummaryField label="Camions" value={results.nbCamions} unit="rot." />
                <ReadonlySummaryField label="Coût total" value={fmt(results.total)} unit={currency} />
              </div>
            </div>
          </div>

          {/* ══ DROITE : SYNTHÈSE ══ */}
          <div className={`xl:col-span-5 p-4 lg:p-5 flex flex-col gap-4 ${activeTab !== "synthese" ? "hidden xl:flex" : "flex"}`}>

            {/* KPIs */}
            <div className="grid grid-cols-2 gap-3">
              <KpiCard label="Déblais bruts"    value={fmtD(results.totalDeblai)}   unit="m³"  color="text-amber-400"  bg="bg-amber-500/10" />
              <KpiCard label="Vol. foisonné"    value={fmtD(results.totalFoisonne)}  unit="m³"  color="text-orange-400" bg="bg-orange-500/10" />
              <KpiCard label="Remblai total"    value={fmtD(results.totalRemblai)}  unit="m³"  color="text-green-400"  bg="bg-green-500/10" />
              <KpiCard label="Rotations camion" value={results.nbCamions}            unit="rot." color="text-stone-300"  bg="bg-stone-500/10" icon={<Truck className="w-3 h-3" />} />
            </div>

            {/* Déblais nets */}
            <div className="flex items-center justify-between px-4 py-3 bg-amber-500/8 border border-amber-500/30 rounded-2xl">
              <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">Déblais nets à évacuer</span>
              <span className="text-lg font-black text-amber-400 font-mono">
                {fmtD(Math.max(0, results.deblaisNets))} m³
              </span>
            </div>

            {/* Graphique */}
            {results.total > 0 && (
              <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-5">
                <div className="relative w-28 h-28 flex-shrink-0">
                  <Doughnut data={chartData}
                    options={{ cutout: "72%", plugins: { legend: { display: false }, tooltip: { enabled: true } } }} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[9px] text-gray-500 uppercase">Total</span>
                    <span className="text-[11px] font-bold text-white text-center leading-tight">{fmt(results.total)}</span>
                  </div>
                </div>
                <div className="flex-1 w-full space-y-2">
                  <CostRow label="Excavation"           value={results.coutExcavation} currency={currency} dot="bg-amber-500" />
                  <CostRow label="Évacuation"           value={results.coutEvacuation} currency={currency} dot="bg-stone-500" />
                  {results.coutSpeciaux > 0 && (
                    <CostRow label="Prestations spéciales" value={results.coutSpeciaux} currency={currency} dot="bg-indigo-500" />
                  )}
                  <div className="border-t border-gray-700/50 pt-2 flex justify-between items-center">
                    <span className="text-xs font-bold text-gray-400 uppercase">Total</span>
                    <span className="text-sm font-black text-amber-400 font-mono">{fmt(results.total)} {currency}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Bordereau quantitatif */}
            <div className="bg-gray-900/40 border border-gray-800/50 rounded-2xl overflow-hidden">
              <div className="px-4 py-2.5 bg-gray-900/70 border-b border-gray-800/50">
                <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                  Bordereau quantitatif par catégorie
                </h4>
              </div>

              {Object.entries(CATEGORIES).map(([catKey, catDef]) => {
                const items = byCategory[catKey]?.filter((o) => (o.vol || 0) > 0);
                if (!items || items.length === 0) return null;
                return (
                  <div key={catKey}>
                    <div className={`px-4 py-1.5 ${catDef.bg} border-b border-gray-800/30 flex items-center gap-2`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${catDef.dot}`} />
                      <span className={`text-[10px] font-bold uppercase tracking-widest ${catDef.color}`}>{catDef.label}</span>
                    </div>
                    {items.map((calc) => {
                      const def2 = TYPES_OUVRAGE[calc.type];
                      const Ic   = def2?.icon;
                      return (
                        <div key={calc.id} className="flex items-start gap-3 px-4 py-2.5 border-b border-gray-800/30 last:border-0">
                          {Ic && <Ic className={`w-3.5 h-3.5 mt-0.5 ${catDef.color} flex-shrink-0`} />}
                          <div className="flex-1 min-w-0">
                            <span className="text-xs text-gray-200 font-medium block truncate">{calc.label || def2?.label}</span>
                            <span className="text-[10px] text-gray-600 font-mono">{def2?.formule}</span>
                            {calc.volFoisonne > 0 && (
                              <span className="text-[10px] text-gray-600 block">
                                Foisonné ×{NATURE_SOL[calc.typeSol]?.coeff} = {fmtD(calc.volFoisonne)} m³
                              </span>
                            )}
                          </div>
                          <div className="text-right flex-shrink-0">
                            <span className={`text-xs font-bold font-mono ${catDef.color}`}>{fmtD(calc.vol)} {def2?.unit}</span>
                            {calc.cout > 0 && (
                              <span className="block text-[10px] text-gray-500">{fmt(calc.cout)} {currency}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}

              <div className="border-t border-gray-700/50 divide-y divide-gray-800/30">
                <div className="px-4 py-2 flex justify-between items-center bg-green-500/5">
                  <span className="text-[11px] text-green-400 font-bold">− Remblai total</span>
                  <span className="text-xs font-bold text-green-400 font-mono">{fmtD(results.totalRemblai)} m³</span>
                </div>
                <div className="px-4 py-2.5 flex justify-between items-center bg-amber-500/8">
                  <span className="text-xs text-amber-300 font-bold uppercase tracking-wide">Déblais nets</span>
                  <span className="text-sm font-black text-amber-400 font-mono">{fmtD(Math.max(0, results.deblaisNets))} m³</span>
                </div>
              </div>
            </div>

            {/* Note */}
            <div className="flex items-start gap-2 p-3 bg-blue-500/5 rounded-xl border border-blue-500/15">
              <Info className="w-3.5 h-3.5 text-blue-400 mt-0.5 flex-shrink-0" />
              <p className="text-[11px] text-blue-200/60 leading-relaxed">
                Le <strong className="text-blue-300">volume foisonné</strong> est calculé par ouvrage selon la nature du sol.
                C'est ce volume "gonflé" qui détermine les rotations camion et le coût d'évacuation.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── OUVRAGE CARD ─────────────────────────────────────────────────────────────

function OuvrageCard({ ouvrage, def, cat, Icon, vol, calc, currency, autoFields = {},
  onToggle, onRemove, onLabelChange, onSolChange, onPrixChange, onFieldChange }) {
  return (
    <div className={`border rounded-2xl overflow-hidden flex-shrink-0 ${cat.border} ${cat.bg}`}>
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none" onClick={onToggle}>
        <div className={`p-1.5 rounded-lg bg-gray-900/60 ${cat.color}`}><Icon className="w-3.5 h-3.5" /></div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-[9px] font-bold uppercase tracking-widest ${cat.color} opacity-70`}>Cat. {def.cat}</span>
            <ChevronRight className="w-2.5 h-2.5 text-gray-600" />
            <span className={`text-xs font-bold ${cat.color}`}>{def.label}</span>
          </div>
          {ouvrage.label && <span className="text-[11px] text-gray-500 block truncate">{ouvrage.label}</span>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {vol > 0 && <span className="text-xs font-bold text-white font-mono">{fmtD(vol)} {def.unit}</span>}
          <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="text-gray-700 hover:text-red-400 transition-colors p-0.5">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          {ouvrage.expanded ? <ChevronUp className="w-4 h-4 text-gray-600" /> : <ChevronDown className="w-4 h-4 text-gray-600" />}
        </div>
      </div>

      {ouvrage.expanded && (
        <div className="px-4 pb-4 border-t border-gray-800/40 flex flex-col gap-3">
          <p className="text-[10px] text-gray-600 italic pt-3">{def.desc} — <span className="font-mono">{def.formule}</span></p>
          <input type="text" value={ouvrage.label} onChange={(e) => onLabelChange(e.target.value)}
            placeholder="Description (ex: Fouille bâtiment A, axe 1-3…)"
            className="w-full bg-gray-900/60 border border-gray-700/50 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-600 focus:border-amber-500/50 focus:outline-none transition-colors" />

          <div className="grid grid-cols-2 gap-3">
            {def.fields.map((field) => {
              const manualValue = ouvrage.fields?.[field.key];
              const autoValue = autoFields[field.key];
              const usesAutoValue = (manualValue === undefined || manualValue === "") && Number(autoValue) > 0;

              return (
                <div key={field.key}>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">{field.label}</label>
                    {usesAutoValue && (
                      <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-emerald-300">
                        Auto
                      </span>
                    )}
                  </div>
                  <input type="number" value={usesAutoValue ? fmtD(autoValue) : manualValue || ""} onChange={(e) => onFieldChange(field.key, e.target.value)}
                    placeholder={usesAutoValue ? `Auto: ${fmtD(autoValue)} ${def.unit}` : field.placeholder}
                    className={`w-full bg-gray-900 border rounded-xl px-3 py-2 font-mono text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 focus:outline-none transition-all ${
                      usesAutoValue ? "border-emerald-500/40 text-emerald-200" : "border-gray-700 text-white"
                    }`} />
                </div>
              );
            })}
            {(def.prixUnit || def.isRemblai) && (
              <div className={def.fields.length % 2 === 0 ? "col-span-2" : ""}>
                <label className="block mb-1 text-[10px] font-bold text-gray-500 uppercase tracking-wide">
                  Prix unitaire ({currency}/{def.unit})
                </label>
                <input type="number" value={ouvrage.prixUnit || ""} onChange={(e) => onPrixChange(e.target.value)} placeholder="0"
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-white font-mono text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 focus:outline-none transition-all" />
              </div>
            )}
          </div>

          {def.hasSol && (
            <div>
              <label className="block mb-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-wide">Nature du sol</label>
              <div className="grid grid-cols-4 gap-1.5">
                {Object.entries(NATURE_SOL).map(([key, sol]) => (
                  <button key={key} onClick={() => onSolChange(key)}
                    className={`px-2 py-1.5 rounded-lg border text-[10px] font-bold transition-all text-center leading-tight ${
                      ouvrage.typeSol === key
                        ? `${cat.border} ${cat.bg} ${cat.color}`
                        : "border-gray-700 bg-gray-900/50 text-gray-500 hover:border-gray-600"
                    }`}>
                    {sol.label.split("/")[0].trim()}
                    <span className="block text-[9px] opacity-60">×{sol.coeff}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {vol > 0 && (
            <div className={`flex items-center justify-between rounded-xl px-4 py-2 ${cat.bg} border ${cat.border}`}>
              <span className="text-[10px] text-gray-400 uppercase font-bold">
                {def.isRemblai ? "Volume remblai" : "Volume en place"}
              </span>
              <div className="text-right">
                <span className={`text-sm font-black font-mono ${cat.color}`}>{fmtD(vol)} {def.unit}</span>
                {calc?.volFoisonne > 0 && (
                  <span className="text-[10px] text-gray-500 block">
                    → {fmtD(calc.volFoisonne)} m³ foisonné (×{NATURE_SOL[ouvrage.typeSol]?.coeff})
                  </span>
                )}
                {calc?.cout > 0 && <span className="text-[10px] text-gray-500 block">{fmt(calc.cout)} {currency}</span>}
              </div>
            </div>
          )}

          {def.note && (
            <div className="flex items-start gap-1.5 p-2 bg-yellow-500/5 rounded-lg border border-yellow-500/15">
              <Info className="w-3 h-3 text-yellow-500 mt-0.5 flex-shrink-0" />
              <p className="text-[10px] text-yellow-200/60 leading-relaxed">{def.note}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── SOUS-COMPOSANTS ──────────────────────────────────────────────────────────

const KpiCard = ({ label, value, unit, color, bg, icon }) => (
  <div className={`${bg} rounded-2xl px-3 py-3 text-center flex flex-col items-center`}>
    <span className="text-[9px] text-gray-500 uppercase font-bold mb-1 flex items-center gap-1">{icon}{label}</span>
    <span className={`text-lg font-black ${color} leading-tight font-mono`}>{value}</span>
    <span className="text-[10px] text-gray-600">{unit}</span>
  </div>
);

const PriceInput = ({ label, value, onChange }) => (
  <div>
    <label className="block mb-1 text-[10px] font-bold text-gray-500 uppercase tracking-wide leading-tight">{label}</label>
    <input type="number" value={value} onChange={(e) => onChange(e.target.value)} placeholder="0"
      className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-white font-mono text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 focus:outline-none transition-all" />
  </div>
);

const ReadonlySummaryField = ({ label, value, unit }) => (
  <div>
    <label className="block mb-1 text-[10px] font-bold text-gray-500 uppercase tracking-wide leading-tight">{label}</label>
    <div className="flex items-center gap-2 rounded-xl border border-gray-700 bg-gray-950/70 px-3 py-2">
      <input
        readOnly
        value={value}
        className="min-w-0 flex-1 bg-transparent text-sm font-mono font-bold text-white outline-none"
      />
      <span className="text-[10px] font-bold uppercase text-gray-500">{unit}</span>
    </div>
  </div>
);

const CostRow = ({ label, value, currency, dot }) => (
  <div className="flex justify-between items-center">
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />
      <span className="text-xs text-gray-400">{label}</span>
    </div>
    <span className="text-xs font-bold text-white font-mono">{fmt(value)} {currency}</span>
  </div>
);
