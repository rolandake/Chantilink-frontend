import React, { useState, useMemo, useEffect } from "react";
import {
  Wrench, Save, Trash2, Plus, Package, DollarSign, Hash,
  ChevronDown, Info, Hammer, X, Layers, Zap, PaintBucket,
  HardHat, Truck, Shovel, Settings,
} from "lucide-react";

import { useProjectStore } from "../../../../store/useProjectStore";
import usePersistentState from "../../../../hooks/usePersistentState";

const STORAGE_KEY = "divers-outillage-history";

// ── Catalogue des outils / matériel de chantier ──────────────────────
const TOOL_GROUPS = {
  gros_materiel: {
    label: "Gros matériel",
    color: "#0F6E56",
    accentColor: "#1D9E75",
    tabler: "ti-crane",
    tools: {
      echafaudage:       { label: "Échafaudage",       unit: "j",   icon: "ti-building-arch",    defaultPrice: 5000  },
      betonniere:        { label: "Bétonnière",         unit: "j",   icon: "ti-refresh",          defaultPrice: 3000  },
      vibreur:           { label: "Vibreur à béton",    unit: "j",   icon: "ti-bolt",             defaultPrice: 4000  },
      compresseur:       { label: "Compresseur",        unit: "j",   icon: "ti-wind",             defaultPrice: 5000  },
      groupe_electrogene:{ label: "Groupe électrogène", unit: "j",   icon: "ti-plug",             defaultPrice: 8000  },
      grue:              { label: "Grue / Palan",       unit: "j",   icon: "ti-crane",            defaultPrice: 25000 },
      nacelle:           { label: "Nacelle élévatrice", unit: "j",   icon: "ti-elevator",         defaultPrice: 30000 },
      pompe_a_eau:       { label: "Pompe à eau",        unit: "j",   icon: "ti-droplet",          defaultPrice: 3000  },
    },
  },
  maconnerie: {
    label: "Maçonnerie",
    color: "#185FA5",
    accentColor: "#378ADD",
    tabler: "ti-wall",
    tools: {
      brouette:  { label: "Brouette",          unit: "u", icon: "ti-shopping-cart", defaultPrice: 25000 },
      pelle:     { label: "Pelle / Pioche",    unit: "u", icon: "ti-shovel",        defaultPrice: 8000  },
      taloche:   { label: "Taloche",           unit: "u", icon: "ti-square",        defaultPrice: 3000  },
      niveau:    { label: "Niveau à bulle",    unit: "u", icon: "ti-ruler-2",       defaultPrice: 15000 },
      truelle:   { label: "Truelle",           unit: "u", icon: "ti-tool",          defaultPrice: 3000  },
      oiseau:    { label: "Oiseau / Fil à plomb", unit: "u", icon: "ti-line",       defaultPrice: 5000  },
      fil_a_plomb:{ label: "Fil à plomb",      unit: "u", icon: "ti-line",          defaultPrice: 3000  },
      auge:      { label: "Auge / Bassine",    unit: "u", icon: "ti-bucket",        defaultPrice: 5000  },
    },
  },
  electricite: {
    label: "Électricité chantier",
    color: "#854F0B",
    accentColor: "#EF9F27",
    tabler: "ti-bolt",
    tools: {
      perceuse:      { label: "Perceuse",                  unit: "j", icon: "ti-drill",            defaultPrice: 3000  },
      marteau_perfo: { label: "Marteau perforateur",       unit: "j", icon: "ti-hammer",           defaultPrice: 5000  },
      meuleuse:      { label: "Meuleuse",                  unit: "j", icon: "ti-circle",           defaultPrice: 3000  },
      rallonge:      { label: "Rallonge électrique",       unit: "u", icon: "ti-plug-connected",   defaultPrice: 5000  },
      pince_coupante:{ label: "Pince coupante / dénudeuse",unit: "u", icon: "ti-cut",              defaultPrice: 8000  },
      testeur:       { label: "Testeur universel",         unit: "u", icon: "ti-device-analytics", defaultPrice: 15000 },
    },
  },
  peinture: {
    label: "Peinture",
    color: "#993556",
    accentColor: "#D4537E",
    tabler: "ti-brush",
    tools: {
      rouleau:     { label: "Rouleau à peinture",  unit: "u", icon: "ti-paint-filled",  defaultPrice: 2000 },
      pinceau:     { label: "Pinceau",             unit: "u", icon: "ti-brush",          defaultPrice: 1500 },
      bac_peinture:{ label: "Bac à peinture",      unit: "u", icon: "ti-bucket",         defaultPrice: 3000 },
      pistolet:    { label: "Pistolet à peinture", unit: "j", icon: "ti-spray",          defaultPrice: 8000 },
      spatule:     { label: "Spatule / Raclette",  unit: "u", icon: "ti-minus",          defaultPrice: 2000 },
      masque:      { label: "Masque de protection",unit: "u", icon: "ti-shield",         defaultPrice: 3000 },
    },
  },
  transport_manutention: {
    label: "Transport & Manutention",
    color: "#533AB7",
    accentColor: "#7F77DD",
    tabler: "ti-truck",
    tools: {
      chariot: { label: "Chariot élévateur",   unit: "j", icon: "ti-forklift",           defaultPrice: 20000 },
      diable:  { label: "Diable / Brouette pneu", unit: "u", icon: "ti-hand-grab",       defaultPrice: 25000 },
      poulie:  { label: "Poulie / Treuil",     unit: "u", icon: "ti-rotate-clockwise-2", defaultPrice: 15000 },
      ceinture:{ label: "Ceinture de sécurité",unit: "u", icon: "ti-badge",              defaultPrice: 10000 },
      casque:  { label: "Casque de chantier",  unit: "u", icon: "ti-hard-hat",           defaultPrice: 5000  },
      gant:    { label: "Gants de travail",    unit: "p", icon: "ti-glove",              defaultPrice: 2000  },
    },
  },
  soudure: {
    label: "Soudure & Métallurgie",
    color: "#993C1D",
    accentColor: "#D85A30",
    tabler: "ti-flame",
    tools: {
      poste_soudure: { label: "Poste à souder",  unit: "j", icon: "ti-flame",          defaultPrice: 10000 },
      disque_meulage:{ label: "Disque à meuler", unit: "u", icon: "ti-circle-dashed",  defaultPrice: 1500  },
      fil_soude:     { label: "Fil à souder",    unit: "kg",icon: "ti-git-commit",     defaultPrice: 5000  },
      pince_soudure: { label: "Pince / Étau",    unit: "u", icon: "ti-grip-horizontal",defaultPrice: 8000  },
    },
  },
};

const ALL_TOOLS = {};
Object.entries(TOOL_GROUPS).forEach(([groupId, group]) => {
  Object.entries(group.tools).forEach(([toolId, tool]) => {
    ALL_TOOLS[toolId] = { ...tool, group: groupId };
  });
});

const fmt  = (n) => Math.round(n || 0).toLocaleString("fr-FR");

const DEFAULT_ITEM = {
  toolId: "echafaudage",
  quantite: "1",
  duree: "1",
  prixUnitaire: "",
  commentaire: "",
};

const safeLoadHistorique = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && item.id);
  } catch {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    return [];
  }
};

const fmtDate = (d) => {
  try {
    return new Date(d).toLocaleDateString("fr-FR", {
      day: "2-digit", month: "short", year: "2-digit",
    });
  } catch { return d; }
};

// ── Icône Tabler inline ───────────────────────────────────────────────
const TIcon = ({ name, size = 16, color, className = "" }) => (
  <i
    className={`ti ${name} ${className}`}
    aria-hidden="true"
    style={{ fontSize: size, color, lineHeight: 1 }}
  />
);

export default function Divers({
  currency = "XOF",
  onTotalChange,
  onMateriauxChange,
  onResultsChange,
}) {
  const setGlobalCost      = useProjectStore((s) => s.setCost);
  const setGlobalMaterials = useProjectStore((s) => s.setMaterials);
  const setGlobalResults   = useProjectStore((s) => s.setResults);

  const [items, setItems] = usePersistentState("divers:items", [
    { ...DEFAULT_ITEM, id: Date.now() },
  ]);
  const [historique, setHistorique] = useState(safeLoadHistorique);
  const [message, setMessage] = useState(null);

  // ── Calculs ──────────────────────────────────────────────────────
  const results = useMemo(() => {
    let totalGeneral = 0;
    let totalMainOeuvre = 0;
    let totalMateriaux = 0;
    const lignes = [];

    items.forEach((item) => {
      const tool = ALL_TOOLS[item.toolId];
      if (!tool) return;

      const qte    = parseFloat(item.quantite)    || 0;
      const duree  = parseFloat(item.duree)        || 1;
      const prix   = parseFloat(item.prixUnitaire) || 0;
      const isLoc  = ["j", "sem", "mois"].includes(tool.unit);
      const total  = isLoc ? qte * duree * prix : qte * prix;

      if (total > 0) {
        lignes.push({
          toolId: item.toolId, label: tool.label, icon: tool.icon,
          group: tool.group, quantite: qte,
          duree: isLoc ? duree : 0, prixUnitaire: prix, total,
          commentaire: item.commentaire,
        });
        totalGeneral += total;
        if (isLoc) totalMainOeuvre += total;
        else       totalMateriaux  += total;
      }
    });

    return { totalGeneral, totalMateriaux, totalMainOeuvre, lignes };
  }, [items]);

  // ── Sync parent ──────────────────────────────────────────────────
  useEffect(() => {
    onTotalChange?.(results.totalGeneral);
    onMateriauxChange?.({
      outillage: results.totalGeneral,
      achat: results.totalMateriaux,
      location: results.totalMainOeuvre,
    });
    onResultsChange?.({
      total: results.totalGeneral,
      lignes: results.lignes.length,
      outillage: results.totalGeneral,
    });
    setGlobalCost("divers", results.totalGeneral);
    setGlobalMaterials("divers", {
      outillage: results.totalGeneral,
      achat: results.totalMateriaux,
      location: results.totalMainOeuvre,
    });
    setGlobalResults("divers", {
      total: results.totalGeneral,
      lignes: results.lignes.length,
      items: results.lignes,
    });
  }, [results.totalGeneral, results.totalMateriaux, results.totalMainOeuvre, results.lignes]);

  // ── Handlers ─────────────────────────────────────────────────────
  const updateItem = (id, field, value) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value };
        if (field === "toolId") {
          const tool = ALL_TOOLS[value];
          if (tool && !updated.prixUnitaire)
            updated.prixUnitaire = String(tool.defaultPrice);
        }
        return updated;
      })
    );
  };

  const addItem = () => {
    const lastItem = items[items.length - 1];
    const toolId   = lastItem?.toolId || "echafaudage";
    setItems((prev) => [...prev, { ...DEFAULT_ITEM, id: Date.now(), toolId }]);
  };

  const removeItem = (id) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSave = () => {
    if (results.totalGeneral <= 0)
      return showToast("⚠️ Ajoutez au moins un outil avec un montant", "error");

    const newEntry = {
      id: Date.now(),
      date: new Date().toISOString(),
      lignes: results.lignes,
      total: results.totalGeneral,
      totalMateriaux: results.totalMateriaux,
      totalMainOeuvre: results.totalMainOeuvre,
    };
    const newHist = [newEntry, ...historique];
    setHistorique(newHist);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(newHist)); } catch {}
    showToast("✅ Matériel / Outils enregistré");
  };

  const handleClearHistorique = () => {
    setHistorique([]);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  };

  const deleteHistoriqueEntry = (id) => {
    const newHist = historique.filter((e) => e.id !== id);
    setHistorique(newHist);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(newHist)); } catch {}
  };

  const showToast = (msg, type = "success") => {
    setMessage({ text: msg, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const groupTotals = useMemo(() => {
    const map = {};
    results.lignes.forEach((l) => {
      if (!map[l.group]) map[l.group] = 0;
      map[l.group] += l.total;
    });
    return map;
  }, [results.lignes]);

  return (
    <div className="w-full h-full flex flex-col bg-gray-900 text-gray-100 overflow-hidden relative">

      {message && (
        <div className={`fixed top-4 right-4 px-6 py-3 rounded-xl shadow-2xl z-50 font-bold animate-bounce ${
          message.type === "error" ? "bg-red-600" : "bg-emerald-600"
        }`}>
          {message.text}
        </div>
      )}

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-800 flex flex-col md:flex-row justify-between md:items-center gap-4 bg-gray-900/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-400">
            <Wrench className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Outillage & Matériel</h2>
            <p className="text-xs text-gray-400 font-medium">
              Échafaudage, bétonnière, perceuse, etc.
            </p>
          </div>
        </div>
        <div className="text-right min-w-[180px]">
          <span className="text-[10px] text-gray-500 uppercase font-bold block">Budget Total</span>
          <span className="text-2xl font-black text-emerald-400 tracking-tighter">
            {fmt(results.totalGeneral)}{" "}
            <span className="text-sm text-gray-500 font-normal">{currency}</span>
          </span>
        </div>
      </div>

      {/* ── Contenu scrollable ─────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-6 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* ══════ GAUCHE — Saisie des outils ══════ */}
          <div className="lg:col-span-6 flex flex-col gap-4">

            {/* KPIs rapides */}
            <div className="grid grid-cols-3 gap-3">
              <MiniKpi icon="ti-tool"        iconColor="#1D9E75" label="Outils"   value={`${results.lignes.length}`} />
              <MiniKpi icon="ti-shopping-cart" iconColor="#378ADD" label="Achat" value={`${fmt(results.totalMateriaux)} ${currency}`} />
              <MiniKpi icon="ti-calendar"    iconColor="#D4537E" label="Location" value={`${fmt(results.totalMainOeuvre)} ${currency}`} />
            </div>

            {/* Liste des outils */}
            <div className="space-y-3">
              {items.map((item, index) => (
                <ToolItemRow
                  key={item.id}
                  item={item}
                  index={index}
                  onChange={(field, value) => updateItem(item.id, field, value)}
                  onRemove={() => removeItem(item.id)}
                  canRemove={items.length > 1}
                  currency={currency}
                />
              ))}
            </div>

            <button
              onClick={addItem}
              className="w-full border-2 border-dashed border-emerald-500/30 hover:border-emerald-500/60 hover:bg-emerald-500/5 text-emerald-400 py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" /> Ajouter un outil / matériel
            </button>

            <button
              onClick={handleSave}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-2xl font-bold shadow-lg transition-all flex justify-center items-center gap-2 active:scale-95"
            >
              <Save className="w-5 h-5" /> Enregistrer la liste
            </button>
          </div>

          {/* ══════ DROITE — Récapitulatif ══════ */}
          <div className="lg:col-span-6 flex flex-col gap-5">

            {/* Récap par catégorie */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-3xl p-5 shadow-xl space-y-4">
              <h3 className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
                <Layers className="w-4 h-4" /> Récapitulatif par catégorie
              </h3>
              {Object.entries(TOOL_GROUPS).map(([groupId, group]) => {
                const total = groupTotals[groupId] || 0;
                if (total <= 0) return null;
                return (
                  <div key={groupId} className="flex items-center justify-between py-2 border-b border-gray-700/50 last:border-0">
                    {/* Titre coloré avec icône Tabler */}
                    <span className="flex items-center gap-2 text-sm font-semibold" style={{ color: group.color }}>
                      <TIcon name={group.tabler} size={16} color={group.accentColor} />
                      {group.label}
                    </span>
                    <span className="text-sm font-bold text-white font-mono">
                      {fmt(total)} {currency}
                    </span>
                  </div>
                );
              })}
              {results.totalGeneral <= 0 && (
                <p className="text-xs text-gray-500 italic text-center py-4">
                  Ajoutez des outils pour voir le récapitulatif
                </p>
              )}
            </div>

            {/* Détail des lignes */}
            {results.lignes.length > 0 && (
              <div className="bg-gray-800/50 border border-gray-700 rounded-3xl p-5 shadow-xl">
                <h3 className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
                  <Package className="w-4 h-4" /> Détail des postes
                </h3>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {results.lignes.map((ligne, i) => {
                    const group = TOOL_GROUPS[ligne.group];
                    return (
                      <div key={i} className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-xl border border-gray-700/50">
                        <TIcon
                          name={ligne.icon}
                          size={20}
                          color={group?.accentColor || "#9ca3af"}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-white truncate">{ligne.label}</p>
                          <p className="text-[10px] text-gray-500">
                            {ligne.quantite} × {fmt(ligne.prixUnitaire)} {currency}
                            {ligne.duree > 0 && ` × ${ligne.duree} jour(s)`}
                            {ligne.commentaire && ` · ${ligne.commentaire}`}
                          </p>
                        </div>
                        <span className="text-sm font-black text-emerald-300 font-mono flex-shrink-0">
                          {fmt(ligne.total)} {currency}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 pt-3 border-t border-emerald-500/30 bg-emerald-500/5 rounded-xl p-3 flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-300 uppercase">Total</span>
                  <span className="text-lg font-black text-emerald-300 font-mono">
                    {fmt(results.totalGeneral)} {currency}
                  </span>
                </div>
              </div>
            )}

            {/* Historique */}
            {historique.length > 0 && (
              <div className="bg-gray-800/30 rounded-2xl border border-gray-700/50 overflow-hidden">
                <div className="px-4 py-3 bg-gray-800/50 flex justify-between items-center border-b border-gray-700/50">
                  <h4 className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2">
                    <Settings className="w-3 h-3" /> Historique enregistrements
                  </h4>
                  <button
                    onClick={handleClearHistorique}
                    className="text-[10px] text-red-400 hover:underline flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" /> Vider
                  </button>
                </div>
                <div className="max-h-[200px] overflow-y-auto divide-y divide-gray-800/50">
                  {historique.map((entry) => (
                    <div key={entry.id} className="px-4 py-3 hover:bg-gray-700/30 transition-colors group">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] text-gray-500 mb-0.5">{fmtDate(entry.date)}</p>
                          <p className="text-xs text-gray-300 truncate">
                            {entry.lignes?.map((l) => l.label).join(", ") || "—"}
                          </p>
                          <p className="text-[10px] text-gray-600 mt-0.5">
                            {entry.lignes?.length || 0} ligne(s)
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-sm font-bold text-emerald-400 font-mono">
                            {fmt(entry.total)} {currency}
                          </span>
                          <button
                            onClick={() => deleteHistoriqueEntry(entry.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded transition-all"
                          >
                            <Trash2 className="w-3 h-3 text-red-400" />
                          </button>
                        </div>
                      </div>
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

// ── Composant ligne d'outil ──────────────────────────────────────────
const ToolItemRow = ({ item, index, onChange, onRemove, canRemove, currency }) => {
  const tool   = ALL_TOOLS[item.toolId];
  const group  = TOOL_GROUPS[tool?.group];
  const isLoc  = tool && ["j", "sem", "mois"].includes(tool.unit);
  const qte    = parseFloat(item.quantite)    || 0;
  const duree  = parseFloat(item.duree)        || 1;
  const prix   = parseFloat(item.prixUnitaire) || 0;
  const total  = isLoc ? qte * duree * prix : qte * prix;

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-4 shadow-lg space-y-3 relative group hover:border-gray-600 transition-all">

      {/* Header ligne */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {/* Icône Tabler colorée selon le groupe */}
          <i
            className={`ti ${tool?.icon || "ti-tool"}`}
            aria-hidden="true"
            style={{ fontSize: 22, color: group?.accentColor || "#9ca3af", lineHeight: 1 }}
          />
          {/* Label groupe coloré */}
          <span
            className="text-xs font-bold tracking-wider uppercase"
            style={{ color: group?.color || "#9ca3af" }}
          >
            {group?.label || "Outil"} #{index + 1}
          </span>
        </div>
        {canRemove && (
          <button
            onClick={onRemove}
            className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-500/20 rounded-lg transition-all"
          >
            <X className="w-3.5 h-3.5 text-red-400" />
          </button>
        )}
      </div>

      {/* Sélecteur d'outil */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">
          Type d'outil / matériel
        </label>
        <div className="relative">
          <select
            value={item.toolId}
            onChange={(e) => onChange("toolId", e.target.value)}
            className="w-full appearance-none bg-gray-900 border border-gray-600 rounded-xl px-3 py-2.5 pr-9 text-sm text-white focus:border-emerald-500 focus:outline-none"
          >
            {Object.entries(TOOL_GROUPS).map(([groupId, grp]) => (
              <optgroup key={groupId} label={grp.label}>
                {Object.entries(grp.tools).map(([toolId, t]) => (
                  <option key={toolId} value={toolId}>
                    {t.label} ({t.unit === "j" ? "location/jour" : t.unit === "u" ? "achat" : t.unit})
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
        </div>
      </div>

      {/* Champs de saisie */}
      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">
            Qté
          </label>
          <input
            type="number"
            min="0"
            step="1"
            value={item.quantite}
            onChange={(e) => onChange("quantite", e.target.value)}
            className="w-full bg-gray-900 border border-gray-600 rounded-xl px-3 py-2.5 text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-mono text-sm"
            placeholder="1"
          />
        </div>

        {isLoc && (
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">
              Durée ({tool?.unit === "j" ? "jours" : tool?.unit})
            </label>
            <input
              type="number"
              min="1"
              step="1"
              value={item.duree}
              onChange={(e) => onChange("duree", e.target.value)}
              className="w-full bg-gray-900 border border-gray-600 rounded-xl px-3 py-2.5 text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-mono text-sm"
              placeholder="1"
            />
          </div>
        )}

        <div className={`flex flex-col gap-1 ${isLoc ? "" : "col-span-2"}`}>
          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">
            Prix unitaire ({currency})
          </label>
          <input
            type="number"
            min="0"
            step="100"
            value={item.prixUnitaire}
            onChange={(e) => onChange("prixUnitaire", e.target.value)}
            className="w-full bg-gray-900 border border-gray-600 rounded-xl px-3 py-2.5 text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-mono text-sm"
            placeholder={tool?.defaultPrice || "0"}
          />
        </div>
      </div>

      {/* Commentaire */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">
          Remarque (optionnel)
        </label>
        <input
          type="text"
          value={item.commentaire}
          onChange={(e) => onChange("commentaire", e.target.value)}
          className="w-full bg-gray-900 border border-gray-600 rounded-xl px-3 py-2 text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-xs"
          placeholder="Ex: livraison incluse, assurance, etc."
        />
      </div>

      {/* Total ligne */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-700/50">
        <div className="flex items-center gap-1.5">
          <Info className="w-3 h-3 text-gray-600" />
          <span className="text-[10px] text-gray-500">
            {isLoc
              ? `${qte} × ${duree} jour(s) × ${fmt(prix)} ${currency}`
              : `${qte} × ${fmt(prix)} ${currency}`}
          </span>
        </div>
        <span className={`text-sm font-black font-mono ${total > 0 ? "text-emerald-400" : "text-gray-600"}`}>
          {fmt(total)} {currency}
        </span>
      </div>
    </div>
  );
};

// ── Mini KPI ─────────────────────────────────────────────────────────
const MiniKpi = ({ icon, iconColor, label, value }) => (
  <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-3 text-center">
    <i className={`ti ${icon}`} aria-hidden="true" style={{ fontSize: 18, color: iconColor, lineHeight: 1 }} />
    <p className="text-[9px] text-gray-500 uppercase font-bold tracking-wider mt-1">{label}</p>
    <p className="text-[11px] font-black text-white font-mono mt-0.5 truncate">{value}</p>
  </div>
);