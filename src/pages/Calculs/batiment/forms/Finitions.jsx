import React, { useState, useMemo, useEffect } from "react";
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import {
  PaintRoller, Grid3X3, Hammer, Layers, Palette, Component,
  Save, Trash2, History, Ruler, Brush, Info, Package, Link,
  ChevronDown, Wrench, Sparkles, Waves, Square, Image as ImageIcon,
  Droplets, Lock, ShieldCheck,
} from "lucide-react";

import { useProjectStore } from "../../../../store/useProjectStore";
import usePersistentState from "../../../../hooks/usePersistentState";

ChartJS.register(ArcElement, Tooltip, Legend);

const STORAGE_KEY = "finitions-history-pro";

// ── Catalogue des ouvrages de finition ──────────────────────────────────────
// group sert uniquement à organiser le <select> en <optgroup>
// inputLabel permet de relabelliser le champ de quantité (m² par défaut, ml/unité ailleurs)
// priceUnitLabel permet de relabelliser le libellé du prix de pose (m² par défaut, unité/ml ailleurs)
const FINITION_CONFIG = {
  peinture: {
    label: "Peinture",              icon: <PaintRoller className="w-5 h-5" />, color: "#8b5cf6",
    perte: 5, unit: "L", group: "peinture",
    autoSource: "murs",        autoKey: "surfaceNette",  autoLabel: "Surface murs nette",
  },

  // ── Enduits & revêtements muraux ──
  platre: {
    label: "Enduit de base / Plâtre", icon: <Layers className="w-5 h-5" />,   color: "#9ca3af",
    consoKgM2: 1.5, perte: 5, unit: "kg", group: "enduits",
    autoSource: "murs",        autoKey: "surfaceNette",  autoLabel: "Surface murs nette",
  },
  enduit_lissage: {
    label: "Enduit de lissage",       icon: <Layers className="w-5 h-5" />,   color: "#a1a1aa",
    consoKgM2: 1.2, perte: 5, unit: "kg", group: "enduits",
    autoSource: "murs",        autoKey: "surfaceNette",  autoLabel: "Surface murs nette",
  },
  enduit_rebouchage: {
    label: "Enduit de rebouchage",    icon: <Wrench className="w-5 h-5" />,   color: "#a78bfa",
    consoKgM2: 1.0, perte: 15, unit: "kg", group: "enduits",
    // pas de liaison auto : surface localisée (réparations ponctuelles) → saisie manuelle
  },
  crepi_interieur: {
    label: "Crépi intérieur",         icon: <Hammer className="w-5 h-5" />,   color: "#d97706",
    consoKgM2: 3, perte: 8, unit: "kg", group: "enduits",
    autoSource: "murs",        autoKey: "surfaceNette",  autoLabel: "Surface murs nette",
  },
  crepi_exterieur: {
    label: "Crépi extérieur",         icon: <Hammer className="w-5 h-5" />,   color: "#92400e",
    consoKgM2: 5, perte: 10, unit: "kg", group: "enduits",
    autoSource: "murs",        autoKey: "surfaceNette",  autoLabel: "Surface murs nette",
  },
  stuc_tadelakt: {
    label: "Stuc / Tadelakt",         icon: <Sparkles className="w-5 h-5" />, color: "#eab308",
    consoKgM2: 2.5, perte: 5, unit: "kg", group: "enduits",
    autoSource: "murs",        autoKey: "surfaceNette",  autoLabel: "Surface murs nette",
  },

  // ── Revêtements décoratifs ──
  faience: {
    label: "Faïence Murale",          icon: <Palette className="w-5 h-5" />,  color: "#06b6d4",
    colleKgM2: 4, jointKgM2: 0.4, perte: 12, unit: "m²", group: "decoratifs",
    autoSource: "murs",        autoKey: "surfaceNette",  autoLabel: "Surface murs nette",
  },
  papier_peint: {
    label: "Papier peint",            icon: <ImageIcon className="w-5 h-5" />, color: "#ec4899",
    coverageM2: 5, perte: 10, unit: "rouleau", group: "decoratifs",
    autoSource: "murs",        autoKey: "surfaceNette",  autoLabel: "Surface murs nette",
  },
  toile_verre: {
    label: "Toile de verre",          icon: <Waves className="w-5 h-5" />,    color: "#14b8a6",
    coverageM2: 25, perte: 10, unit: "rouleau", group: "decoratifs",
    autoSource: "murs",        autoKey: "surfaceNette",  autoLabel: "Surface murs nette",
  },
  panneaux_decoratifs: {
    label: "Panneaux décoratifs",     icon: <Square className="w-5 h-5" />,   color: "#fb7185",
    coverageM2: 1.5, perte: 8, unit: "panneau", group: "decoratifs",
    autoSource: "murs",        autoKey: "surfaceNette",  autoLabel: "Surface murs nette",
  },

  // ── Sols ──
  ragreage: {
    label: "Ragréage de sol",  icon: <Layers className="w-5 h-5" />,     color: "#64748b",
    consoKgM2: 7, perte: 5, unit: "kg", group: "sols",
    autoSource: "dalles",      autoKey: "surfaceCarrelage", autoLabel: "Surface dalles",
  },
  chape_ciment: {
    label: "Chape ciment",     icon: <Square className="w-5 h-5" />,     color: "#475569",
    consoKgM2: 75, perte: 5, unit: "kg", group: "sols",
    autoSource: "dalles",      autoKey: "surfaceCarrelage", autoLabel: "Surface dalles",
  },
  carrelage: {
    label: "Carrelage Sol",    icon: <Grid3X3 className="w-5 h-5" />,    color: "#10b981",
    colleKgM2: 5, jointKgM2: 0.5, perte: 10, unit: "m²", group: "sols",
    autoSource: "dalles",      autoKey: "surfaceCarrelage", autoLabel: "Surface dalles",
  },
  parquet: {
    label: "Parquet",          icon: <Component className="w-5 h-5" />,  color: "#f59e0b",
    perte: 8, unit: "m²", group: "sols",
    autoSource: "dalles",      autoKey: "surfaceCarrelage", autoLabel: "Surface dalles",
  },
  plinthes: {
    label: "Plinthes",         icon: <Ruler className="w-5 h-5" />,      color: "#84cc16",
    perte: 10, unit: "ml", inputLabel: "Linéaire (m)", priceUnitLabel: "ml", group: "sols",
    // pas de liaison auto : un linéaire de plinthes ne se déduit pas d'une surface
  },

  // ── Plafonds ──
  plafond: {
    label: "Faux plafond", icon: <Hammer className="w-5 h-5" />, color: "#f97316",
    perte: 7, unit: "m²", group: "plafonds",
    autoSource: "dalles", autoKey: "surfaceCarrelage", autoLabel: "Surface plafond",
  },

  // ── Étanchéité, sécurité & quincaillerie ──
  etancheite: {
    label: "Étanchéité",       icon: <Droplets className="w-5 h-5" />,   color: "#0ea5e9",
    consoKgM2: 1.5, perte: 8, unit: "kg", group: "protection",
    autoSource: "dalles",      autoKey: "surfaceCarrelage", autoLabel: "Surface dalles",
  },
  serrurerie: {
    label: "Serrurerie & quincaillerie", icon: <Lock className="w-5 h-5" />, color: "#71717a",
    perte: 5, unit: "unité", inputLabel: "Quantité (unités)", priceUnitLabel: "unité", group: "protection",
    // pas de liaison auto : comptage manuel d'équipements
  },
  securite: {
    label: "Sécurité & équipements", icon: <ShieldCheck className="w-5 h-5" />, color: "#ef4444",
    perte: 5, unit: "unité", inputLabel: "Quantité (unités)", priceUnitLabel: "unité", group: "protection",
  },
};

// Finitions de peinture — chacune avec son rendement (m²/L/couche) et son nombre de couches usuel
const PEINTURE_FINISHES = {
  mat:          { label: "Mate",                  rendement: 12, defaultCouches: 2 },
  satine:       { label: "Satinée",                rendement: 11, defaultCouches: 2 },
  brillant:     { label: "Brillante (laquée)",      rendement: 9,  defaultCouches: 2 },
  decorative:   { label: "Décorative (effet)",      rendement: 6,  defaultCouches: 1 },
  souscouche:   { label: "Sous-couche / Primaire",  rendement: 9,  defaultCouches: 1 },
  antihumidite: { label: "Anti-humidité",           rendement: 7,  defaultCouches: 2 },
  pantigres:    { label: "Pantigrés (Seigneurie)",  rendement: 10, defaultCouches: 2 },
};

// Catalogue carrelage : types, formats, et leurs incidences sur pertes/colle
const CARRELAGE_TYPES = ["Grès cérame", "Céramique", "Marbre", "Pierre naturelle", "Grès", "Mosaïque"];
const CARRELAGE_FORMATS = ["20x20", "30x30", "45x45", "60x60", "80x80", "100x100", "120x60", "120x120", "Mosaïque (<10cm)"];

const FORMAT_PERTE = {
  "20x20": 15, "30x30": 12, "45x45": 10, "60x60": 8, "80x80": 8,
  "100x100": 10, "120x60": 8, "120x120": 12, "Mosaïque (<10cm)": 18,
};

const FORMAT_COLLE_KGM2 = {
  "20x20": 4, "30x30": 4, "45x45": 4.5, "60x60": 5, "80x80": 6,
  "100x100": 7, "120x60": 6, "120x120": 7.5, "Mosaïque (<10cm)": 4,
};

const HAUTEUR_PRESETS = [
  { label: "Crédence",     value: "0.6" },
  { label: "Mi-hauteur",   value: "1.2" },
  { label: "SDB standard", value: "2" },
  { label: "Plein mur",    value: "2.6" },
];

// Étanchéité : consommation (kg/m²) recommandée selon la zone d'application
const ETANCHEITE_ZONES = {
  "Salle de bain": 1.2,
  "Terrasse":      1.8,
  "Balcon":        1.5,
  "Toiture":       2.2,
};

// ✅ Faux plafond : chaque matériau a désormais une vraie incidence sur le calcul
// consoKgM2 = null signifie "pas de consommation au poids" → le matériau influence
// uniquement le coefficient de pertes recommandé (ossature + découpes différentes selon matériau)
const PLAFOND_MATERIAUX_CONFIG = {
  "BA13 (Placo)":      { perte: 10, note: "Plaques 2.5m² + ossature métallique" },
  "PVC":                { perte: 5,  note: "Lames PVC, faible chute" },
  "Staff décoratif":   { perte: 15, note: "Moulures et découpes complexes" },
};
const PLAFOND_MATERIAUX = Object.keys(PLAFOND_MATERIAUX_CONFIG);

const SERRURERIE_TYPES = ["Serrure simple", "Serrure multipoint", "Poignée de porte", "Verrou", "Charnière", "Système de fermeture (autre)"];
const SECURITE_TYPES   = ["Détecteur de fumée", "Extincteur", "Alarme", "Caméra (CCTV)"];

const GROUP_ORDER  = ["peinture", "enduits", "decoratifs", "sols", "plafonds", "protection"];
const GROUP_LABELS = {
  peinture:   "Peinture",
  enduits:    "Enduits & revêtements muraux",
  decoratifs: "Revêtements décoratifs",
  sols:       "Revêtements de sol",
  plafonds:   "Plafonds",
  protection: "Étanchéité, sécurité & quincaillerie",
};

const DEFAULT_INPUTS = {
  surface:        "",
  prixMateriel:   "",
  prixMainOeuvre: "",
  couches:        "2",
  marge:          "10",
};

const DEFAULT_CARRELAGE_OPTIONS = {
  pose:          "sol",        // "sol" | "mural"
  type:          "Grès cérame",
  format:        "60x60",
  jointType:     "ciment",     // "ciment" | "epoxy"
  decoupes:      false,        // découpes complexes (angles, prises) — mural
  antiderapant:  false,        // terrasse / extérieur — sol
  hauteurPose:   "2",
  lineaireMural: "",
  finition:      "brillant",   // "brillant" | "mat"
};

// Unités comptées à l'unité (pas de décimale, arrondi au supérieur)
const INTEGER_UNITS = ["rouleau", "panneau", "unité"];

const safeLoadHistorique = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && item.id && typeof item.total === "number");
  } catch {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    return [];
  }
};

const fmtD = (n, d = 2) => (n || 0).toFixed(d);
const fmt  = (n) => Math.round(n).toLocaleString("fr-FR");

export default function Finitions({
  currency = "XOF",
  onTotalChange,
  onMateriauxChange,
  onResultsChange,
  projectResults,   // ✅ résultats locaux Elevations
}) {

  // ✅ Lecture depuis le store global (murs → finitions, dalles → carrelage)
  const mursResults   = useProjectStore((s) => s.subResults.murs);
  const dallesResults = useProjectStore((s) => s.subResults.dalles);
  const setGlobalResults = useProjectStore((s) => s.setResults);
  const setGlobalMaterials = useProjectStore((s) => s.setMaterials);
  const setGlobalCost = useProjectStore((s) => s.setCost);

  const [selectedType, setSelectedType] = usePersistentState("finitions:selectedType", "peinture");
  const [selectedFinish, setSelectedFinish] = usePersistentState("finitions:finish", "mat");
  const [activeView, setActiveView] = usePersistentState("finitions:activeView", "ouvrages");
  const [savedInputs, setSavedInputs] = usePersistentState("finitions:inputs", DEFAULT_INPUTS);
  const inputs = useMemo(() => ({ ...DEFAULT_INPUTS, ...savedInputs }), [savedInputs]);
  const setInputs = (next) => {
    setSavedInputs((prev) => {
      const base = { ...DEFAULT_INPUTS, ...prev };
      const value = typeof next === "function" ? next(base) : next;
      return { ...DEFAULT_INPUTS, ...value };
    });
  };

  const [savedCarrelageOptions, setSavedCarrelageOptions] = usePersistentState("finitions:carrelageOptions", DEFAULT_CARRELAGE_OPTIONS);
  const carrelageOptions = useMemo(() => ({ ...DEFAULT_CARRELAGE_OPTIONS, ...savedCarrelageOptions }), [savedCarrelageOptions]);
  const setCarrelageOptions = (next) => {
    setSavedCarrelageOptions((prev) => {
      const base = { ...DEFAULT_CARRELAGE_OPTIONS, ...prev };
      const value = typeof next === "function" ? next(base) : next;
      return { ...DEFAULT_CARRELAGE_OPTIONS, ...value };
    });
  };

  const [etancheiteZone, setEtancheiteZone] = usePersistentState("finitions:etancheiteZone", "Salle de bain");
  const [serrurerieType, setSerrurerieType] = usePersistentState("finitions:serrurerieType", "Serrure simple");
  const [securiteType, setSecuriteType] = usePersistentState("finitions:securiteType", "Détecteur de fumée");
  const [plafondMateriau, setPlafondMateriau] = usePersistentState("finitions:plafondMateriau", "BA13 (Placo)");

  const [historique, setHistorique] = useState(safeLoadHistorique);
  const [message,    setMessage]    = useState(null);

  const finish = PEINTURE_FINISHES[selectedFinish] || PEINTURE_FINISHES.mat;
  const config = FINITION_CONFIG[selectedType];
  const isPeinture   = selectedType === "peinture";
  const isCarrelage  = selectedType === "carrelage";
  const isEtancheite = selectedType === "etancheite";
  const isPlafond    = selectedType === "plafond";

  // ✅ Pertes recommandées pour l'ouvrage actif (tient compte du matériau pour le plafond
  // et du format pour le carrelage — sinon retombe sur config.perte)
  const recommendedPerte = isCarrelage
    ? (FORMAT_PERTE[carrelageOptions.format] ?? config.perte)
    : isPlafond
      ? (PLAFOND_MATERIAUX_CONFIG[plafondMateriau]?.perte ?? config.perte)
      : config.perte;

  // Libellé affiché (intègre la finition/le sous-type selon l'ouvrage)
  const displayLabel = isPeinture
    ? `${FINITION_CONFIG.peinture.label} (${finish.label})`
    : isCarrelage
      ? `Carrelage ${carrelageOptions.pose === "mural" ? "Mural" : "Sol"} — ${carrelageOptions.type} ${carrelageOptions.format}`
      : isEtancheite
        ? `Étanchéité — ${etancheiteZone}`
        : selectedType === "serrurerie"
          ? `Serrurerie — ${serrurerieType}`
          : selectedType === "securite"
            ? `Sécurité — ${securiteType}`
            : isPlafond
              ? `Faux plafond (${plafondMateriau})`
              : config.label;

  // ✅ LIAISON AUTOMATIQUE — détermine la valeur auto selon le type sélectionné
  const autoValue = useMemo(() => {
    if (!config.autoSource) return null;

    const source = config.autoSource === "murs"   ? mursResults
                 : config.autoSource === "dalles" ? dallesResults
                 : null;

    const val = source?.[config.autoKey];
    if (!val || val <= 0) return null;

    return {
      value:  val,
      label:  config.autoLabel,
      source: config.autoSource,
    };
  }, [selectedType, mursResults, dallesResults]);

  // Appliquer automatiquement si le champ surface est vide
  useEffect(() => {
    if (autoValue && !inputs.surface) {
      setInputs((prev) => ({ ...prev, surface: autoValue.value.toFixed(2) }));
    }
  }, [autoValue?.value, selectedType]);

  // ✅ CORRECTIF #1 — Applique automatiquement la perte recommandée de l'ouvrage
  // dès qu'on change de type, SAUF si l'utilisateur a déjà personnalisé la valeur
  // pour cet ouvrage précis (on retient la dernière marge appliquée par type).
  const [margeParType, setMargeParType] = usePersistentState("finitions:margeParType", {});
  useEffect(() => {
    const memorised = margeParType[selectedType];
    const target = memorised != null ? memorised : recommendedPerte;
    if (target != null && String(target) !== String(inputs.marge)) {
      setInputs((prev) => ({ ...prev, marge: String(target) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedType, isCarrelage ? carrelageOptions.format : null, isPlafond ? plafondMateriau : null]);

  const applyAutoValue = () => {
    if (autoValue) setInputs((prev) => ({ ...prev, surface: autoValue.value.toFixed(2) }));
  };

  const applyRecommendedCouches = () => {
    setInputs((prev) => ({ ...prev, couches: String(finish.defaultCouches) }));
  };

  // ✅ CORRECTIF — applique la perte recommandée à l'ouvrage actif (carrelage, plafond, ou tout autre)
  // et mémorise ce choix pour ce type afin de ne plus le réécraser tant qu'il n'est pas changé.
  const applyRecommendedPerte = () => {
    if (recommendedPerte == null) return;
    setInputs((prev) => ({ ...prev, marge: String(recommendedPerte) }));
    setMargeParType((prev) => ({ ...prev, [selectedType]: recommendedPerte }));
  };

  // Mémorise toute saisie manuelle de la marge pour l'ouvrage courant (évite l'écrasement au retour sur ce type)
  const handleMargeChange = (v) => {
    setInputs((prev) => ({ ...prev, marge: v }));
    setMargeParType((prev) => ({ ...prev, [selectedType]: v === "" ? null : Number(v) }));
  };

  const calculerSurfaceMurale = () => {
    const h = parseFloat(carrelageOptions.hauteurPose) || 0;
    const l = parseFloat(carrelageOptions.lineaireMural) || 0;
    if (h > 0 && l > 0) setInputs((prev) => ({ ...prev, surface: (h * l).toFixed(2) }));
  };

  // ── Calcul ────────────────────────────────────────────────────────────────
  const results = useMemo(() => {
    const surf   = parseFloat(inputs.surface)        || 0;
    const pm     = parseFloat(inputs.prixMateriel)   || 0;
    const mo     = parseFloat(inputs.prixMainOeuvre) || 0;

    const baseMarge = parseFloat(inputs.marge) || 0;
    // Découpes complexes en carrelage mural : +5 points de pertes, sans toucher au champ "Pertes" saisi
    const extraDecoupePerte = (isCarrelage && carrelageOptions.pose === "mural" && carrelageOptions.decoupes) ? 5 : 0;
    const totalPertePct = baseMarge + extraDecoupePerte;
    const margin = 1 + totalPertePct / 100;

    let totalMateriaux  = 0;
    let totalMainOeuvre = surf * mo;
    let qtePrincipale   = 0;
    let sacsColle       = 0;
    let jointKg         = 0;
    let colleKg         = 0;

    if (isPeinture) {
      const nbCouches  = parseFloat(inputs.couches) || finish.defaultCouches || 2;
      qtePrincipale    = (surf * nbCouches) / finish.rendement * margin;
      totalMateriaux   = qtePrincipale * pm;
    } else if (config.colleKgM2) {
      // Carrelage / Faïence : revêtement collé + joint
      const effectiveColleKgM2 = isCarrelage
        ? (FORMAT_COLLE_KGM2[carrelageOptions.format] || config.colleKgM2)
        : config.colleKgM2;
      qtePrincipale  = surf * margin;
      totalMateriaux = qtePrincipale * pm;
      colleKg        = surf * effectiveColleKgM2;
      jointKg        = surf * config.jointKgM2;
      sacsColle      = Math.ceil(colleKg / 25);
    } else if (config.consoKgM2) {
      // Enduits / crépis / plâtre / stuc-tadelakt / ragréage / chape / étanchéité : conso au m² en kg
      const effectiveConso = isEtancheite
        ? (ETANCHEITE_ZONES[etancheiteZone] || config.consoKgM2)
        : config.consoKgM2;
      qtePrincipale  = surf * effectiveConso * margin;
      totalMateriaux = qtePrincipale * pm;
    } else if (config.coverageM2) {
      // Papier peint / toile de verre / panneaux : quantité en unités (rouleau, panneau...)
      qtePrincipale  = Math.ceil((surf * margin) / config.coverageM2);
      totalMateriaux = qtePrincipale * pm;
    } else {
      // Parquet / plinthes / faux plafond / serrurerie / sécurité / fallback générique
      qtePrincipale = surf * margin;
      if (INTEGER_UNITS.includes(config.unit)) qtePrincipale = Math.ceil(qtePrincipale);
      totalMateriaux = qtePrincipale * pm;
    }

    const total = totalMateriaux + totalMainOeuvre;
    return {
      surface: surf, qtePrincipale, sacsColle, colleKg, jointKg,
      totalMateriaux, totalMainOeuvre, total, totalPertePct, extraDecoupePerte,
    };
  }, [inputs, selectedType, finish, config, carrelageOptions, etancheiteZone, isPeinture, isCarrelage, isEtancheite]);

  // ── Sync parent ───────────────────────────────────────────────────────────
  useEffect(() => {
    onTotalChange?.(results.total);
    const enduitTypes = ["platre", "enduit_lissage", "enduit_rebouchage", "crepi_interieur", "crepi_exterieur", "stuc_tadelakt", "ragreage", "chape_ciment", "etancheite"];
    const revetementTypes = ["carrelage", "faience", "parquet", "plafond", "papier_peint", "toile_verre", "panneaux_decoratifs", "plinthes"];
    const materials = {
      surface: results.surface,
      peinture: selectedType === "peinture" ? results.qtePrincipale : 0,
      revetement: revetementTypes.includes(selectedType) ? results.qtePrincipale : 0,
      enduit: enduitTypes.includes(selectedType) ? results.qtePrincipale : 0,
      colle: results.colleKg,
      joint: results.jointKg,
    };
    onMateriauxChange?.(materials);
    onResultsChange?.({ surface: results.surface, type: selectedType, total: results.total, ...materials });
    setGlobalCost("finitions", results.total);
    setGlobalMaterials("finitions", materials);
    setGlobalResults("finitions", { surface: results.surface, type: selectedType, total: results.total, ...materials });
  }, [results.total, results.surface, results.qtePrincipale, results.colleKg, results.jointKg, selectedType]);

  const synthese = useMemo(() => {
    const rows = [
      ...historique,
      ...(results.total > 0 ? [{
        id: "current",
        label: displayLabel,
        type: selectedType,
        surface: results.surface,
        qtePrincipale: results.qtePrincipale,
        total: results.total,
        totalMateriaux: results.totalMateriaux,
        totalMainOeuvre: results.totalMainOeuvre,
      }] : []),
    ];
    return {
      lignes: rows.length,
      surface: rows.reduce((sum, item) => sum + (parseFloat(item.surface) || 0), 0),
      total: rows.reduce((sum, item) => sum + (parseFloat(item.total) || 0), 0),
      fournitures: rows.reduce((sum, item) => sum + (parseFloat(item.totalMateriaux) || 0), 0),
      pose: rows.reduce((sum, item) => sum + (parseFloat(item.totalMainOeuvre) || 0), 0),
    };
  }, [historique, results, selectedType, displayLabel]);

  const showToast = (msg, type = "success") => {
    setMessage({ text: msg, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleSave = () => {
    if (results.total <= 0) return showToast("⚠️ Entrez une surface valide", "error");
    const newEntry = {
      id:              Date.now(),
      date:            new Date().toLocaleString("fr-FR"),
      type:            selectedType,
      finish:          isPeinture ? selectedFinish : undefined,
      carrelage:       isCarrelage ? { ...carrelageOptions } : undefined,
      etancheiteZone:  isEtancheite ? etancheiteZone : undefined,
      serrurerieType:  selectedType === "serrurerie" ? serrurerieType : undefined,
      securiteType:    selectedType === "securite" ? securiteType : undefined,
      plafondMateriau: isPlafond ? plafondMateriau : undefined,
      label:           displayLabel,
      surface:         inputs.surface,
      prixMateriel:    inputs.prixMateriel,
      prixMainOeuvre:  inputs.prixMainOeuvre,
      couches:         inputs.couches,
      marge:           inputs.marge,
      qtePrincipale:   results.qtePrincipale,
      sacsColle:       results.sacsColle,
      totalMateriaux:  results.totalMateriaux,
      totalMainOeuvre: results.totalMainOeuvre,
      total:           results.total,
    };
    const newHist = [newEntry, ...historique];
    setHistorique(newHist);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(newHist)); } catch {}
    showToast("✅ Finition enregistrée");
  };

  const handleClearHistorique = () => {
    setHistorique([]);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  };

  const chartData = {
    labels: ["Fournitures", "Pose"],
    datasets: [{
      data: [results.totalMateriaux, results.totalMainOeuvre],
      backgroundColor: [config.color, "#374151"],
      borderColor: "#111827",
      borderWidth: 2,
    }],
  };

  // Libellé "Besoin" : pas de décimale pour les unités comptées (rouleau / panneau / unité)
  const besoinValue = INTEGER_UNITS.includes(config.unit)
    ? String(results.qtePrincipale)
    : fmtD(results.qtePrincipale, 1);

  // ✅ Libellé dynamique du prix de pose : m² par défaut, mais ml/unité quand pertinent
  const priceUnitLabel = config.priceUnitLabel || "m²";

  // Rendement / ratio affiché dans le bandeau d'info
  let rendementLabel = "Standard BE";
  if (isPeinture) {
    rendementLabel = `${finish.rendement} m²/L`;
  } else if (isCarrelage) {
    const effColle = FORMAT_COLLE_KGM2[carrelageOptions.format] || config.colleKgM2;
    rendementLabel = `${effColle} kg/m² colle · joint ${carrelageOptions.jointType === "epoxy" ? "époxy" : "ciment"}`;
  } else if (isEtancheite) {
    const effConso = ETANCHEITE_ZONES[etancheiteZone] || config.consoKgM2;
    rendementLabel = `${effConso} kg/m² (${etancheiteZone})`;
  } else if (isPlafond) {
    rendementLabel = `${plafondMateriau} · pertes ${PLAFOND_MATERIAUX_CONFIG[plafondMateriau]?.perte ?? config.perte}%`;
  } else if (config.consoKgM2) {
    rendementLabel = `${config.consoKgM2} kg/m²`;
  } else if (config.coverageM2) {
    rendementLabel = `${config.coverageM2} m²/${config.unit}`;
  } else if (config.unit === "unité") {
    rendementLabel = "Quantité unitaire";
  }
  // ✅ Affiche la pénalité découpes complexes dans le rendement si applicable
  if (results.extraDecoupePerte > 0) {
    rendementLabel += ` (+${results.extraDecoupePerte}% découpes)`;
  }

  return (
    <div className="w-full h-full flex flex-col bg-gray-900 text-gray-100 overflow-hidden relative">

      {message && (
        <div className={`fixed top-4 right-4 px-6 py-3 rounded-xl shadow-2xl z-50 font-bold animate-bounce ${
          message.type === "error" ? "bg-red-600" : "bg-violet-600"
        }`}>
          {message.text}
        </div>
      )}

      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-800 flex flex-col md:flex-row justify-between md:items-center gap-4 bg-gray-900/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-violet-500/20 rounded-lg text-violet-400"><Brush className="w-6 h-6" /></div>
          <div>
            <h2 className="text-xl font-bold text-white">Second Œuvre : Finitions</h2>
            <p className="text-xs text-gray-400 font-medium">Revêtements & Décoration</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="min-w-[260px]">
            <label className="block mb-1 text-[9px] text-gray-500 uppercase font-bold tracking-wider">
              Ouvrage de finition
            </label>
            <div className="relative">
              <select
                value={selectedType}
                onChange={(e) => {
                  setSelectedType(e.target.value);
                  setActiveView("ouvrages");
                }}
                className="w-full appearance-none bg-gray-950 border border-gray-700 rounded-xl px-3 py-2.5 pr-9 text-sm text-white focus:border-violet-500 focus:outline-none"
              >
                {GROUP_ORDER.map((g) => (
                  <optgroup key={g} label={GROUP_LABELS[g]}>
                    {Object.entries(FINITION_CONFIG)
                      .filter(([, cfg]) => cfg.group === g)
                      .map(([id, cfg]) => (
                        <option key={id} value={id}>{cfg.label}</option>
                      ))}
                  </optgroup>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            </div>
          </div>
          <div className="text-right min-w-[130px]">
            <span className="text-[10px] text-gray-500 uppercase font-bold block">Budget Estimé</span>
            <span className="text-2xl font-black text-violet-400 tracking-tighter">
              {fmt(results.total)} <span className="text-sm text-gray-500 font-normal">{currency}</span>
            </span>
          </div>
        </div>
      </div>

      <div className="shrink-0 flex border-b border-gray-800 bg-gray-900">
        {[["ouvrages", "Ouvrages"], ["synthese", "Synthèse"]].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveView(key)}
            className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors ${
              activeView === key
                ? "text-violet-400 border-b-2 border-violet-400"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeView === "synthese" ? (
        <FinitionsSynthese
          currency={currency}
          selectedTypeLabel={displayLabel}
          results={results}
          synthese={synthese}
          historique={historique}
        />
      ) : (
      <div className="flex-1 overflow-y-auto p-4 lg:p-6 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* ── GAUCHE ── */}
          <div className="lg:col-span-5 flex flex-col gap-5">

            {/* ✅ BANDEAU LIAISON AUTOMATIQUE */}
            {autoValue && (
              <div className="flex items-start gap-3 p-3 bg-violet-500/8 border border-violet-500/30 rounded-2xl">
                <Link className="w-4 h-4 text-violet-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-violet-300 font-bold uppercase tracking-wider mb-1">
                    Données importées — {autoValue.source === "murs" ? "Élévation / Murs" : "Dalles"}
                  </p>
                  <p className="text-xs text-violet-200/70">
                    {autoValue.label} : <span className="font-mono font-bold text-violet-300">{fmtD(autoValue.value)} m²</span>
                  </p>
                  <button onClick={applyAutoValue}
                    className="mt-2 text-[10px] bg-violet-500/20 border border-violet-500/40 text-violet-300 px-3 py-1 rounded-lg font-bold hover:bg-violet-500/30 transition-all">
                    Appliquer automatiquement ↗
                  </button>
                </div>
              </div>
            )}

            {/* Paramètres de calcul */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-3xl p-6 shadow-xl space-y-6">
              <h3 className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
                <Ruler className="w-4 h-4" /> Paramètres de calcul
              </h3>

              {/* ✅ Sélecteur de finition de peinture */}
              {isPeinture && (
                <div className="flex flex-col gap-2 -mt-2">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Type de peinture</label>
                  <div className="relative">
                    <select
                      value={selectedFinish}
                      onChange={(e) => setSelectedFinish(e.target.value)}
                      className="w-full appearance-none bg-gray-900 border border-gray-600 rounded-xl px-4 py-2.5 pr-9 text-sm text-white focus:border-violet-500 focus:outline-none"
                    >
                      {Object.entries(PEINTURE_FINISHES).map(([id, f]) => (
                        <option key={id} value={id}>{f.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                  </div>
                  <p className="text-[10px] text-gray-500 italic">
                    Rendement : {finish.rendement} m²/L · Recommandé : {finish.defaultCouches} couche(s)
                  </p>
                  {Number(inputs.couches) !== finish.defaultCouches && (
                    <button onClick={applyRecommendedCouches}
                      className="self-start text-[10px] bg-violet-500/20 border border-violet-500/40 text-violet-300 px-3 py-1 rounded-lg font-bold hover:bg-violet-500/30 transition-all">
                      Appliquer {finish.defaultCouches} couche(s) recommandée(s) ↗
                    </button>
                  )}
                </div>
              )}

              {/* ✅ Bloc carrelage enrichi : pose, type, format, joint, options sol/mural */}
              {isCarrelage && (
                <div className="flex flex-col gap-3 -mt-2">
                  <div>
                    <label className="mb-1 block text-[10px] font-bold text-gray-500 uppercase tracking-wide">Type de pose</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[["sol", "Sol"], ["mural", "Mural"]].map(([id, lbl]) => (
                        <button key={id} type="button"
                          onClick={() => setCarrelageOptions((p) => ({ ...p, pose: id }))}
                          className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                            carrelageOptions.pose === id
                              ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
                              : "bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-600"
                          }`}
                        >
                          {lbl}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col">
                      <label className="mb-1 text-[10px] font-bold text-gray-500 uppercase tracking-wide">Type de carreaux</label>
                      <select value={carrelageOptions.type}
                        onChange={(e) => setCarrelageOptions((p) => ({ ...p, type: e.target.value }))}
                        className="w-full bg-gray-900 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white focus:border-violet-500 focus:outline-none">
                        {CARRELAGE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div className="flex flex-col">
                      <label className="mb-1 text-[10px] font-bold text-gray-500 uppercase tracking-wide">Format</label>
                      <select value={carrelageOptions.format}
                        onChange={(e) => setCarrelageOptions((p) => ({ ...p, format: e.target.value }))}
                        className="w-full bg-gray-900 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white focus:border-violet-500 focus:outline-none">
                        {CARRELAGE_FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </div>
                  </div>

                  {Number(inputs.marge) !== FORMAT_PERTE[carrelageOptions.format] && (
                    <button onClick={applyRecommendedPerte}
                      className="self-start text-[10px] bg-violet-500/20 border border-violet-500/40 text-violet-300 px-3 py-1 rounded-lg font-bold hover:bg-violet-500/30 transition-all">
                      Appliquer {FORMAT_PERTE[carrelageOptions.format]}% de pertes recommandées (format {carrelageOptions.format}) ↗
                    </button>
                  )}

                  {carrelageOptions.pose === "mural" && (
                    <div className="space-y-3 p-3 bg-gray-900/50 rounded-xl border border-gray-700/50">
                      <div>
                        <label className="mb-1 block text-[10px] font-bold text-gray-500 uppercase tracking-wide">Hauteur de pose (m)</label>
                        <div className="flex gap-2 mb-2 flex-wrap">
                          {HAUTEUR_PRESETS.map((h) => (
                            <button key={h.value} type="button"
                              onClick={() => setCarrelageOptions((p) => ({ ...p, hauteurPose: h.value }))}
                              className={`text-[10px] px-2 py-1 rounded-lg border font-bold transition-all ${
                                carrelageOptions.hauteurPose === h.value
                                  ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
                                  : "bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-600"
                              }`}
                            >
                              {h.label} ({h.value}m)
                            </button>
                          ))}
                        </div>
                        <input type="number" value={carrelageOptions.hauteurPose}
                          onChange={(e) => setCarrelageOptions((p) => ({ ...p, hauteurPose: e.target.value }))}
                          className="w-full bg-gray-900 border border-gray-600 rounded-xl px-4 py-2 text-white text-sm font-mono focus:border-violet-500 focus:outline-none" />
                      </div>

                      <div className="grid grid-cols-2 gap-3 items-end">
                        <div className="flex flex-col">
                          <label className="mb-1 text-[10px] font-bold text-gray-500 uppercase tracking-wide">Linéaire mural (m)</label>
                          <input type="number" value={carrelageOptions.lineaireMural}
                            onChange={(e) => setCarrelageOptions((p) => ({ ...p, lineaireMural: e.target.value }))}
                            className="w-full bg-gray-900 border border-gray-600 rounded-xl px-4 py-2 text-white text-sm font-mono focus:border-violet-500 focus:outline-none" />
                        </div>
                        <button onClick={calculerSurfaceMurale}
                          className="h-[42px] text-[10px] bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 px-3 rounded-xl font-bold hover:bg-emerald-500/30 transition-all">
                          Calculer surface
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col">
                          <label className="mb-1 text-[10px] font-bold text-gray-500 uppercase tracking-wide">Finition</label>
                          <select value={carrelageOptions.finition}
                            onChange={(e) => setCarrelageOptions((p) => ({ ...p, finition: e.target.value }))}
                            className="w-full bg-gray-900 border border-gray-600 rounded-xl px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none">
                            <option value="brillant">Brillant</option>
                            <option value="mat">Mat</option>
                          </select>
                        </div>
                        <label className="flex items-center gap-2 self-end pb-2 text-xs text-gray-300 cursor-pointer">
                          <input type="checkbox" checked={carrelageOptions.decoupes}
                            onChange={(e) => setCarrelageOptions((p) => ({ ...p, decoupes: e.target.checked }))}
                            className="w-4 h-4 rounded accent-violet-500" />
                          Découpes complexes (+5% pertes)
                        </label>
                      </div>
                    </div>
                  )}

                  {carrelageOptions.pose === "sol" && (
                    <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                      <input type="checkbox" checked={carrelageOptions.antiderapant}
                        onChange={(e) => setCarrelageOptions((p) => ({ ...p, antiderapant: e.target.checked }))}
                        className="w-4 h-4 rounded accent-violet-500" />
                      Carreaux antidérapants (terrasse / extérieur)
                    </label>
                  )}

                  <div className="flex flex-col">
                    <label className="mb-1 text-[10px] font-bold text-gray-500 uppercase tracking-wide">Type de joint</label>
                    <select value={carrelageOptions.jointType}
                      onChange={(e) => setCarrelageOptions((p) => ({ ...p, jointType: e.target.value }))}
                      className="w-full bg-gray-900 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white focus:border-violet-500 focus:outline-none">
                      <option value="ciment">Ciment</option>
                      <option value="epoxy">Époxy</option>
                    </select>
                  </div>
                </div>
              )}

              {/* ✅ Zone d'application pour l'étanchéité */}
              {isEtancheite && (
                <div className="flex flex-col gap-2 -mt-2">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Zone d'application</label>
                  <select value={etancheiteZone}
                    onChange={(e) => setEtancheiteZone(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white focus:border-violet-500 focus:outline-none">
                    {Object.keys(ETANCHEITE_ZONES).map((z) => <option key={z} value={z}>{z}</option>)}
                  </select>
                  <p className="text-[10px] text-gray-500 italic">
                    Conso. recommandée : {ETANCHEITE_ZONES[etancheiteZone]} kg/m² (membrane liquide, 2 couches)
                  </p>
                </div>
              )}

              {/* ✅ Type d'équipement pour la serrurerie */}
              {selectedType === "serrurerie" && (
                <div className="flex flex-col gap-2 -mt-2">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Type d'équipement</label>
                  <select value={serrurerieType}
                    onChange={(e) => setSerrurerieType(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white focus:border-violet-500 focus:outline-none">
                    {SERRURERIE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              )}

              {/* ✅ Type d'équipement pour la sécurité */}
              {selectedType === "securite" && (
                <div className="flex flex-col gap-2 -mt-2">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Type d'équipement</label>
                  <select value={securiteType}
                    onChange={(e) => setSecuriteType(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white focus:border-violet-500 focus:outline-none">
                    {SECURITE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              )}

              {/* ✅ Matériau pour le faux plafond — influence désormais réellement les pertes recommandées */}
              {isPlafond && (
                <div className="flex flex-col gap-2 -mt-2">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Matériau</label>
                  <select value={plafondMateriau}
                    onChange={(e) => setPlafondMateriau(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white focus:border-violet-500 focus:outline-none">
                    {PLAFOND_MATERIAUX.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <p className="text-[10px] text-gray-500 italic">
                    {PLAFOND_MATERIAUX_CONFIG[plafondMateriau]?.note} · Pertes recommandées : {PLAFOND_MATERIAUX_CONFIG[plafondMateriau]?.perte}%
                  </p>
                  {Number(inputs.marge) !== PLAFOND_MATERIAUX_CONFIG[plafondMateriau]?.perte && (
                    <button onClick={applyRecommendedPerte}
                      className="self-start text-[10px] bg-violet-500/20 border border-violet-500/40 text-violet-300 px-3 py-1 rounded-lg font-bold hover:bg-violet-500/30 transition-all">
                      Appliquer {PLAFOND_MATERIAUX_CONFIG[plafondMateriau]?.perte}% de pertes recommandées ↗
                    </button>
                  )}
                </div>
              )}

              {/* ✅ Pour les ouvrages restants sans bloc dédié, on propose aussi la perte recommandée */}
              {!isPeinture && !isCarrelage && !isPlafond && config.perte != null &&
                Number(inputs.marge) !== config.perte && (
                <button onClick={applyRecommendedPerte}
                  className="self-start text-[10px] bg-violet-500/20 border border-violet-500/40 text-violet-300 px-3 py-1 rounded-lg font-bold hover:bg-violet-500/30 transition-all -mt-2">
                  Appliquer {config.perte}% de pertes recommandées pour "{config.label}" ↗
                </button>
              )}

              <div className="grid grid-cols-2 gap-4">
                <InputGroup label={config.inputLabel || "Surface (m²)"} value={inputs.surface} onChange={(v) => setInputs({ ...inputs, surface: v })} />
                <InputGroup label="Pertes (%)"   value={inputs.marge}   onChange={handleMargeChange} />
                {isPeinture && (
                  <InputGroup label="Nb de couches" value={inputs.couches} onChange={(v) => setInputs({ ...inputs, couches: v })} full />
                )}
              </div>
              <div className="pt-4 border-t border-gray-700 grid grid-cols-2 gap-4">
                <InputGroup
                  label={`Prix Matériel (${currency}/${config.unit})`}
                  value={inputs.prixMateriel}
                  onChange={(v) => setInputs({ ...inputs, prixMateriel: v })} />
                <InputGroup
                  label={`Prix Pose (${currency}/${priceUnitLabel})`}
                  value={inputs.prixMainOeuvre}
                  onChange={(v) => setInputs({ ...inputs, prixMainOeuvre: v })} />
              </div>
              <button onClick={handleSave}
                className="w-full bg-violet-600 hover:bg-violet-500 text-white py-4 rounded-2xl font-bold shadow-lg transition-all flex justify-center items-center gap-2 active:scale-95">
                <Save className="w-5 h-5" /> Enregistrer la ligne
              </button>
            </div>
          </div>

          {/* ── DROITE ── */}
          <div className="lg:col-span-7 flex flex-col gap-6">

            <div className="grid grid-cols-3 gap-4">
              <ResultCard
                label={`Besoin ${config.unit}`}
                value={besoinValue}
                unit={config.unit}
                icon={<Package className="w-4 h-4" />}
                color="text-violet-400" bg="bg-violet-500/10" />
              <ResultCard
                label="Fournitures" value={fmt(results.totalMateriaux)} unit={currency}
                icon="🧱" color="text-blue-400" bg="bg-blue-500/10" border />
              <ResultCard
                label="Main d'œuvre" value={fmt(results.totalMainOeuvre)} unit={currency}
                icon="👷" color="text-cyan-400" bg="bg-cyan-500/10" />
            </div>

            <div className="flex-1 bg-gray-800 rounded-3xl p-6 border border-gray-700 shadow-xl flex flex-col md:flex-row gap-8 items-center relative overflow-hidden">
              <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />

              <div className="w-44 h-44 flex-shrink-0 relative">
                <Doughnut data={chartData} options={{ cutout: "75%", plugins: { legend: { display: false } } }} />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[10px] text-gray-500 uppercase font-bold">Ratio</span>
                  <span className="text-sm font-bold text-white">
                    {results.total > 0 ? Math.round((results.totalMateriaux / results.total) * 100) : 0}% Matos
                  </span>
                </div>
              </div>

              <div className="flex-1 w-full space-y-4">
                <h4 className="text-gray-400 text-xs font-bold uppercase tracking-widest border-b border-gray-700 pb-2">Détails Logistiques</h4>

                {isPeinture && (
                  <MaterialRow label={`Volume de peinture (${finish.label})`} val={`${fmtD(results.qtePrincipale, 1)} Litres`} color="bg-violet-500" />
                )}

                {isCarrelage && (
                  <MaterialRow label="Référence" val={`${carrelageOptions.type} · ${carrelageOptions.format}`} color="bg-emerald-400" />
                )}
                {(selectedType === "carrelage" || selectedType === "faience") && (<>
                  <MaterialRow label="Carreaux (Nets)"    val={`${fmtD(results.qtePrincipale, 1)} m²`}    color="bg-emerald-500" />
                  <MaterialRow label="Colle (Sacs 25kg)"  val={`${results.sacsColle} sacs`}               color="bg-blue-500" />
                  <MaterialRow label="Joint" val={`${fmtD(results.jointKg, 1)} kg`} color="bg-cyan-500" />
                </>)}
                {isCarrelage && (<>
                  <MaterialRow label="Type de joint" val={carrelageOptions.jointType === "epoxy" ? "Époxy" : "Ciment"} color="bg-cyan-400" />
                  {carrelageOptions.pose === "mural" ? (
                    <MaterialRow label="Hauteur de pose" val={`${carrelageOptions.hauteurPose} m`} color="bg-indigo-400" />
                  ) : (
                    <MaterialRow label="Antidérapant" val={carrelageOptions.antiderapant ? "Oui" : "Non"} color="bg-indigo-400" />
                  )}
                  {results.extraDecoupePerte > 0 && (
                    <MaterialRow label="Pénalité découpes complexes" val={`+${results.extraDecoupePerte}% (total ${fmtD(results.totalPertePct, 0)}%)`} color="bg-red-400" />
                  )}
                </>)}

                {selectedType === "platre" && (
                  <MaterialRow label="Enduit de base (kg)" val={`${fmtD(results.qtePrincipale, 0)} kg`} color="bg-gray-400" />
                )}
                {selectedType === "enduit_lissage" && (
                  <MaterialRow label="Enduit de lissage" val={`${fmtD(results.qtePrincipale, 0)} kg`} color="bg-gray-400" />
                )}
                {selectedType === "enduit_rebouchage" && (
                  <MaterialRow label="Enduit de rebouchage" val={`${fmtD(results.qtePrincipale, 0)} kg`} color="bg-purple-400" />
                )}
                {selectedType === "crepi_interieur" && (
                  <MaterialRow label="Crépi intérieur" val={`${fmtD(results.qtePrincipale, 0)} kg`} color="bg-amber-600" />
                )}
                {selectedType === "crepi_exterieur" && (
                  <MaterialRow label="Crépi extérieur" val={`${fmtD(results.qtePrincipale, 0)} kg`} color="bg-amber-700" />
                )}
                {selectedType === "stuc_tadelakt" && (
                  <MaterialRow label="Stuc / Tadelakt" val={`${fmtD(results.qtePrincipale, 0)} kg`} color="bg-yellow-500" />
                )}
                {selectedType === "ragreage" && (
                  <MaterialRow label="Ragréage de sol" val={`${fmtD(results.qtePrincipale, 0)} kg`} color="bg-slate-400" />
                )}
                {selectedType === "chape_ciment" && (
                  <MaterialRow label="Chape ciment" val={`${fmtD(results.qtePrincipale, 0)} kg`} color="bg-slate-500" />
                )}
                {selectedType === "parquet" && (
                  <MaterialRow label="Parquet (m²)" val={`${fmtD(results.qtePrincipale, 1)} m²`} color="bg-amber-500" />
                )}
                {selectedType === "plinthes" && (
                  <MaterialRow label="Plinthes" val={`${fmtD(results.qtePrincipale, 1)} ml`} color="bg-lime-500" />
                )}
                {isPlafond && (<>
                  <MaterialRow label={`Faux plafond (${plafondMateriau})`} val={`${fmtD(results.qtePrincipale, 1)} m²`} color="bg-orange-500" />
                  <MaterialRow label="Note matériau" val={PLAFOND_MATERIAUX_CONFIG[plafondMateriau]?.note} color="bg-orange-400" />
                </>)}
                {selectedType === "papier_peint" && (<>
                  <MaterialRow label="Rouleaux nécessaires" val={`${results.qtePrincipale} rouleaux`} color="bg-pink-500" />
                  <MaterialRow label="Couverture par rouleau" val={`${config.coverageM2} m²`} color="bg-pink-400" />
                </>)}
                {selectedType === "toile_verre" && (<>
                  <MaterialRow label="Rouleaux nécessaires" val={`${results.qtePrincipale} rouleaux`} color="bg-teal-500" />
                  <MaterialRow label="Couverture par rouleau" val={`${config.coverageM2} m²`} color="bg-teal-400" />
                </>)}
                {selectedType === "panneaux_decoratifs" && (<>
                  <MaterialRow label="Panneaux nécessaires" val={`${results.qtePrincipale} panneaux`} color="bg-rose-400" />
                  <MaterialRow label="Surface par panneau" val={`${config.coverageM2} m²`} color="bg-rose-300" />
                </>)}
                {isEtancheite && (<>
                  <MaterialRow label="Membrane d'étanchéité" val={`${fmtD(results.qtePrincipale, 0)} kg`} color="bg-sky-500" />
                  <MaterialRow label="Zone" val={etancheiteZone} color="bg-sky-400" />
                </>)}
                {selectedType === "serrurerie" && (<>
                  <MaterialRow label="Type d'équipement" val={serrurerieType} color="bg-zinc-500" />
                  <MaterialRow label="Quantité" val={`${results.qtePrincipale} unités`} color="bg-zinc-400" />
                </>)}
                {selectedType === "securite" && (<>
                  <MaterialRow label="Type d'équipement" val={securiteType} color="bg-red-500" />
                  <MaterialRow label="Quantité" val={`${results.qtePrincipale} unités`} color="bg-red-400" />
                </>)}

                <div className="pt-2 border-t border-gray-700 flex justify-between items-center">
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Info className="w-3 h-3 text-violet-400" /> Rendement estimé
                  </span>
                  <span className="text-sm font-bold text-white">
                    {rendementLabel}
                  </span>
                </div>

                <div className="flex items-start gap-2 p-3 bg-violet-500/5 rounded-xl border border-violet-500/20">
                  <Info className="w-3.5 h-3.5 text-violet-400 mt-0.5 flex-shrink-0" />
                  <p className="text-[10px] text-violet-200/60 leading-relaxed italic">
                    {autoValue
                      ? `Surface récupérée automatiquement depuis ${autoValue.source === "murs" ? "les Murs" : "les Dalles"} (${fmtD(autoValue.value)} m²). Modifiable manuellement.`
                      : config.autoSource
                        ? "Complétez les modules Murs et Dalles pour un import automatique des surfaces."
                        : "Cet ouvrage nécessite une saisie manuelle (pas d'import automatique disponible)."
                    }
                  </p>
                </div>
              </div>
            </div>

            {historique.length > 0 && (
              <div className="bg-gray-800/30 rounded-2xl border border-gray-700/50 overflow-hidden">
                <div className="px-4 py-2 bg-gray-800/50 flex justify-between items-center border-b border-gray-700/50">
                  <h4 className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2">
                    <History className="w-3 h-3" /> Devis Finitions
                  </h4>
                  <button onClick={handleClearHistorique} className="text-[10px] text-red-400 hover:underline">Vider</button>
                </div>
                <div className="max-h-[120px] overflow-y-auto">
                  {historique.map((item) => (
                    <div key={item.id} className="flex justify-between items-center p-3 border-b border-gray-700/30 hover:bg-gray-700/40 transition-colors">
                      <div className="text-xs">
                        <span className="text-gray-500 text-[9px] block">{item.date}</span>
                        <span className="font-medium">{item.label} — {item.surface} m²</span>
                      </div>
                      <span className="text-sm font-bold text-violet-400">{fmt(item.total ?? 0)} {currency}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      )}
    </div>
  );
}

const FinitionsSynthese = ({ currency, selectedTypeLabel, results, synthese, historique }) => (
  <div className="flex-1 overflow-y-auto bg-gray-900 text-gray-100 p-4 lg:p-6">
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
      <div className="xl:col-span-5 flex flex-col gap-4">
        <div className="bg-gray-800/60 border border-violet-500/20 rounded-2xl p-4">
          <p className="text-[10px] text-violet-300 uppercase font-bold tracking-widest">Synthèse finitions</p>
          <div className="mt-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] text-gray-500">Ouvrage actif</p>
              <p className="text-lg font-black text-white">{selectedTypeLabel}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-gray-500 uppercase font-bold">Total actif</p>
              <p className="text-xl font-black text-violet-400">{fmt(results.total)} <span className="text-xs text-gray-500">{currency}</span></p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-4">
          <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-3">Récapitulatif interne</p>
          <div className="grid grid-cols-2 gap-3">
            <ReadonlySummaryField label="Lignes" value={synthese.lignes} unit="u" />
            <ReadonlySummaryField label="Surface cumulée" value={fmtD(synthese.surface)} unit="m²" />
            <ReadonlySummaryField label="Fournitures" value={fmt(synthese.fournitures)} unit={currency} />
            <ReadonlySummaryField label="Pose" value={fmt(synthese.pose)} unit={currency} />
            <ReadonlySummaryField label="Total finitions" value={fmt(synthese.total)} unit={currency} />
            <ReadonlySummaryField label="Besoin actif" value={fmtD(results.qtePrincipale, 1)} unit="" />
          </div>
        </div>
      </div>

      <div className="xl:col-span-7 bg-gray-800/40 border border-gray-700 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-700 bg-gray-800/70">
          <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Dernières lignes enregistrées</p>
        </div>
        <div className="divide-y divide-gray-800/70">
          {historique.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-gray-500 italic">Aucune finition enregistrée</div>
          ) : historique.slice(0, 8).map((item) => (
            <div key={item.id} className="px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-white truncate">{item.label}</p>
                <p className="text-[10px] text-gray-500">{item.date} · {item.surface} m²</p>
              </div>
              <p className="text-sm font-black text-violet-300 font-mono flex-shrink-0">{fmt(item.total)} {currency}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

const InputGroup = ({ label, value, onChange, placeholder, full = false }) => (
  <div className={`flex flex-col ${full ? "col-span-2" : ""}`}>
    <label className="mb-1 text-[10px] font-bold text-gray-500 uppercase tracking-wide">{label}</label>
    <input type="number" value={value} onChange={(e) => onChange(e.target.value)}
      className="w-full bg-gray-900 border border-gray-600 rounded-xl px-4 py-2.5 text-white focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all font-mono text-sm"
      placeholder={placeholder || "0"} />
  </div>
);

const ResultCard = ({ label, value, unit, color, bg, border, icon }) => (
  <div className={`rounded-2xl p-4 flex flex-col justify-center items-center text-center ${bg} ${border ? "border border-gray-700" : ""}`}>
    <span className="text-[10px] text-gray-500 uppercase font-bold mb-1 flex items-center gap-1">{icon} {label}</span>
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