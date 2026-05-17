import { create } from "zustand";

/**
 * STORE GLOBAL CHANTILINK
 * ─────────────────────────────────────────────────────────────────────────────
 * Ce store centralise TOUS les résultats calculés par chaque module.
 * Chaque module ÉCRIT ses résultats → les autres modules LISENT automatiquement.
 *
 * Architecture :
 *   subCosts     → coûts estimés par module (pour le devis global)
 *   subMaterials → matériaux agrégés (ciment, acier, etc.)
 *   subResults   → résultats techniques détaillés (dimensions, volumes, sections)
 *
 * Liaisons automatiques documentées :
 *   Terrassement → Fondation       : totalDeblai, totalFoisonne, deblaisNets
 *   Fondation    → Remblai         : volumeBetonFondation
 *   Poteaux      → Longrines       : nombre, section, hauteur
 *   Poutres      → Dalles          : portee, section
 *   Murs         → Finitions       : surfaceNette
 *   Dalles       → Escaliers       : hauteurEtage
 *   Planchers    → Finitions/Carrelage : surface
 */
export const useProjectStore = create((set, get) => ({

  // ── COÛTS PAR MODULE ──────────────────────────────────────────────────────
  subCosts: {
    terrassement: 0,
    fondation:    0,
    elevation:    0,
    planchers:    0,
    toiture:      0,
    finitions:    0,
  },

  setCost: (module, value) =>
    set((state) => ({
      subCosts: {
        ...state.subCosts,
        [module]: Math.max(0, Number(value) || 0),
      },
    })),

  // ── MATÉRIAUX PAR MODULE ──────────────────────────────────────────────────
  subMaterials: {},

  setMaterials: (module, data) =>
    set((state) => ({
      subMaterials: {
        ...state.subMaterials,
        [module]: { ...(state.subMaterials[module] || {}), ...data },
      },
    })),

  // ── RÉSULTATS TECHNIQUES PAR MODULE ───────────────────────────────────────
  // C'est ici que réside la magie des liaisons automatiques.
  subResults: {
    terrassement: {},
    fondation:    {},
    // Élévation : données par sous-module
    murs:         {},
    poteaux:      {},
    longrines:    {},
    linteaux:     {},
    poutres:      {},
    dalles:       {},
    escaliers:    {},
    // Autres
    planchers:    {},
    toiture:      {},
    finitions:    {},
  },

  setResults: (module, data) =>
    set((state) => ({
      subResults: {
        ...state.subResults,
        [module]: { ...(state.subResults[module] || {}), ...data },
      },
    })),

  // Lecture directe (utile hors des hooks React)
  getResults: (module) => get().subResults[module] || {},
  getCost:    (module) => get().subCosts[module]    || 0,

  // ── TOTAL GLOBAL ──────────────────────────────────────────────────────────
  get totalGeneral() {
    return Object.values(get().subCosts).reduce((acc, v) => acc + v, 0);
  },

  // ── MATÉRIAUX CUMULÉS (liste de course) ───────────────────────────────────
  get cumulMateriaux() {
    const total = { ciment: 0, sable: 0, gravier: 0, acier: 0, volume: 0 };
    Object.values(get().subMaterials).forEach((stepMats) => {
      if (!stepMats) return;
      Object.entries(stepMats).forEach(([key, val]) => {
        if (typeof val === "number" && total.hasOwnProperty(key)) {
          total[key] += val;
        }
      });
    });
    return total;
  },

  // ── RESET ─────────────────────────────────────────────────────────────────
  resetProject: () =>
    set({
      subCosts:     { terrassement: 0, fondation: 0, elevation: 0, planchers: 0, toiture: 0, finitions: 0 },
      subMaterials: {},
      subResults:   {
        terrassement: {}, fondation: {}, murs: {}, poteaux: {},
        longrines: {}, linteaux: {}, poutres: {}, dalles: {},
        escaliers: {}, planchers: {}, toiture: {}, finitions: {},
      },
    }),
}));