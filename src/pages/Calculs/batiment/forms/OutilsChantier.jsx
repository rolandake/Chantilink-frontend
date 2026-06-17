import React, { useState, useMemo } from "react";
import {
  Wrench, Plus, Trash2, Save, Package, DollarSign,
  ChevronDown, Info, Hammer, Zap, PaintBucket, HardHat,
  Building, Truck,
} from "lucide-react";

import usePersistentState from "../../../../hooks/usePersistentState";

// ── Catalogue des outils de chantier par catégorie ─────────────────────────
const TOOL_CATEGORIES = {
  gros_materiel: {
    label: "🏗️ Gros matériel",
    icon: <Truck className="w-4 h-4" />,
    color: "#f97316",
    tools: [
      { id: "echafaudage",      label: "Échafaudage",        unit: "m²/jour",   defaultPrice: 0 },
      { id: "betonniere",       label: "Bétonnière",         unit: "jour",       defaultPrice: 0 },
      { id: "vibreur_beton",    label: "Vibreur à béton",    unit: "jour",       defaultPrice: 0 },
      { id: "compresseur",      label: "Compresseur",        unit: "jour",       defaultPrice: 0 },
      { id: "groupe_electro",   label: "Groupe électrogène",  unit: "jour",       defaultPrice: 0 },
      { id: "grue",             label: "Grue / Palan",       unit: "jour",       defaultPrice: 0 },
      { id: "niveleuse",        label: "Niveleuse",          unit: "jour",       defaultPrice: 0 },
      { id: "pelleteuse",       label: "Pelleteuse",         unit: "heure",      defaultPrice: 0 },
    ],
  },
  maconnerie: {
    label: "🧱 Outils de maçonnerie",
    icon: <Hammer className="w-4 h-4" />,
    color: "#3b82f6",
    tools: [
      { id: "brouette",         label: "Brouette",           unit: "u",   defaultPrice: 0 },
      { id: "pelle_pioche",     label: "Pelle / Pioche",     unit: "u",   defaultPrice: 0 },
      { id: "taloche",          label: "Taloche",            unit: "u",   defaultPrice: 0 },
      { id: "niveau_bulle",     label: "Niveau à bulle",     unit: "u",   defaultPrice: 0 },
      { id: "truelle",          label: "Truelle",            unit: "u",   defaultPrice: 0 },
      { id: "seau",             label: "Seau",               unit: "u",   defaultPrice: 0 },
      { id: "cordeau",          label: "Cordeau / Fil à plomb", unit: "u", defaultPrice: 0 },
      { id: "ciseau_pierre",    label: "Ciseau à pierre",    unit: "u",   defaultPrice: 0 },
    ],
  },
  electricite: {
    label: "⚡ Électricité chantier",
    icon: <Zap className="w-4 h-4" />,
    color: "#eab308",
    tools: [
      { id: "perceuse",         label: "Perceuse",           unit: "jour",  defaultPrice: 0 },
      { id: "marteau_perfo",    label: "Marteau perforateur", unit: "jour", defaultPrice: 0 },
      { id: "meuleuse",         label: "Meuleuse",           unit: "jour",  defaultPrice: 0 },
      { id: "rallonge_elec",    label: "Rallonge électrique", unit: "u",    defaultPrice: 0 },
      { id: "poste_soudure",    label: "Poste à souder",     unit: "jour",  defaultPrice: 0 },
      { id: "detecteur",        label: "Détecteur de métaux", unit: "jour", defaultPrice: 0 },
    ],
  },
  peinture: {
    label: "🎨 Peinture & Finitions",
    icon: <PaintBucket className="w-4 h-4" />,
    color: "#a855f7",
    tools: [
      { id: "rouleau",          label: "Rouleau",            unit: "u",   defaultPrice: 0 },
      { id: "pinceau",          label: "Pinceau",            unit: "u",   defaultPrice: 0 },
      { id: "bac_peinture",     label: "Bac à peinture",     unit: "u",   defaultPrice: 0 },
      { id: "pistolet",         label: "Pistolet peinture",  unit: "jour", defaultPrice: 0 },
      { id: "masquage",         label: "Ruban de masquage",  unit: "u",   defaultPrice: 0 },
      { id: "bache",            label: "Bâche de protection", unit: "u",  defaultPrice: 0 },
    ],
  },
  securite: {
    label: "🦺 Sécurité & EPI",
    icon: <HardHat className="w-4 h-4" />,
    color: "#ef4444",
    tools: [
      { id: "casque",           label: "Casque de chantier", unit: "u",   defaultPrice: 0 },
      { id: "gants",            label: "Gants de travail",   unit: "u",   defaultPrice: 0 },
      { id: "lunettes",         label: "Lunettes de sécurité", unit: "u", defaultPrice: 0 },
      { id: "chaussures",       label: "Chaussures de sécurité", unit: "u", defaultPrice: 0 },
      { id: "gilets",           label: "Gilet haute visibilité", unit: "u", defaultPrice: 0 },
      { id: "harnais",          label: "Harnais antichute",  unit: "u",   defaultPrice: 0 },
    ],
  },
  manutention: {
    label: "🚛 Manutention & Transport",
    icon: <Building className="w-4 h-4" />,
    color: "#06b6d4",
    tools: [
      { id: "chariot",          label: "Chariot élévateur",  unit: "heure", defaultPrice: 0 },
      { id: "poulie",           label: "Poulie / Treuil",    unit: "jour",  defaultPrice: 0 },
      { id: "main_oeuvre",      label: "Main-d'œuvre manutention", unit: "homme/jour", defaultPrice: 0 },
    ],
  },
};

const CATEGORY_ORDER = ["gros_materiel", "maconnerie", "electricite", "peinture", "securite", "manutention"];

const fmt  = (n) => Math.round(n || 0).toLocaleString("fr-FR");
const fmtD = (n, d = 2) => (n || 0).toFixed(d);

const STORAGE_KEY = "outils-chantier-history";

const safeLoadHistorique = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
};

export default function OutilsChantier({
  currency = "XOF",
  onTotalChange,
  onCostChange,
  onMateriauxChange,
}) {
  const [activeCategory, setActiveCategory] = usePersistentState("outils:category", "gros_materiel");
  const [addedTools, setAddedTools] = usePersistentState("outils:addedTools", []);
  const [historique, setHistorique] = useState(safeLoadHistorique);
  const [message, setMessage] = useState(null);

  // ── Outils ajoutés par l'utilisateur ──
  const toolsWithDetails = useMemo(() => {
    return addedTools.map((t) => {
      const cat = TOOL_CATEGORIES[t.category];
      const catTool = cat?.tools.find((ct) => ct.id === t.toolId);
      return {
        ...t,
        label: catTool?.label || t.label || t.toolId,
        unit: catTool?.unit || "u",
        categoryLabel: cat?.label || t.category,
        total: (Number(t.quantite) || 0) * (Number(t.prixUnitaire) || 0),
      };
    });
  }, [addedTools]);

  // ── Total général ──
  const totalGeneral = useMemo(() => {
    return toolsWithDetails.reduce((sum, t) => sum + t.total, 0);
  }, [toolsWithDetails]);

  // ── Sync parent ──
  React.useEffect(() => {
    onTotalChange?.(totalGeneral);
    onCostChange?.(totalGeneral);
    onMateriauxChange?.({
      outils: toolsWithDetails.length,
      coutOutils: totalGeneral,
    });
  }, [totalGeneral, toolsWithDetails.length]);

  // ── Ajouter un outil ──
  const handleAddTool = (toolId, category) => {
    const cat = TOOL_CATEGORIES[category];
    const catTool = cat?.tools.find((t) => t.id === toolId);
    if (!catTool) return;

    // Vérifier si déjà ajouté
    if (addedTools.some((t) => t.toolId === toolId)) {
      showToast("⚠️ Cet outil est déjà dans la liste", "error");
      return;
    }

    setAddedTools((prev) => [
      ...prev,
      {
        id: Date.now(),
        toolId,
        category,
        label: catTool.label,
        quantite: "1",
        duree: "1",
        prixUnitaire: String(catTool.defaultPrice),
      },
    ]);
    showToast(`✅ ${catTool.label} ajouté`);
  };

  // ── Mettre à jour un champ ──
  const handleUpdateTool = (id, field, value) => {
    setAddedTools((prev) =>
      prev.map((t) => (t.id === id ? { ...t, [field]: value } : t))
    );
  };

  // ── Supprimer un outil ──
  const handleRemoveTool = (id) => {
    setAddedTools((prev) => prev.filter((t) => t.id !== id));
  };

  // ── Enregistrer dans l'historique ──
  const handleSave = () => {
    if (totalGeneral <= 0) {
      showToast("⚠️ Ajoutez au moins un outil avec un coût", "error");
      return;
    }
    const entry = {
      id: Date.now(),
      date: new Date().toLocaleString("fr-FR"),
      tools: [...toolsWithDetails],
      total: totalGeneral,
    };
    const newHist = [entry, ...historique];
    setHistorique(newHist);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(newHist)); } catch {}
    showToast("✅ Outils enregistrés dans l'historique");
  };

  const handleClearHistorique = () => {
    setHistorique([]);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  };

  const showToast = (msg, type = "success") => {
    setMessage({ text: msg, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const currentCat = TOOL_CATEGORIES[activeCategory];

  // ── Résumé par catégorie ──
  const categorySummary = useMemo(() => {
    const summary = {};
    toolsWithDetails.forEach((t) => {
      if (!summary[t.category]) summary[t.category] = { count: 0, total: 0 };
      summary[t.category].count += 1;
      summary[t.category].total += t.total;
    });
    return summary;
  }, [toolsWithDetails]);

  return (
    <div className="w-full h-full flex flex-col bg-gray-900 text-gray-100 overflow-hidden relative">

      {/* Toast */}
      {message && (
        <div className={`fixed top-4 right-4 px-6 py-3 rounded-xl shadow-2xl z-50 font-bold animate-bounce ${
          message.type === "error" ? "bg-red-600" : "bg-orange-600"
        }`}>
          {message.text}
        </div>
      )}

      {/* ── HEADER ── */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-800 flex flex-col md:flex-row justify-between md:items-center gap-4 bg-gray-900/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-500/20 rounded-lg text-orange-400">
            <Wrench className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">🧰 Outils & Matériel de chantier</h2>
            <p className="text-xs text-gray-400 font-medium">Location / Achat d'équipements</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className="text-[10px] text-gray-500 uppercase font-bold block">Budget Outils</span>
            <span className="text-2xl font-black text-orange-400 tracking-tighter">
              {fmt(totalGeneral)} <span className="text-sm text-gray-500 font-normal">{currency}</span>
            </span>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-gray-500 uppercase font-bold block">Éléments</span>
            <span className="text-lg font-black text-white">{toolsWithDetails.length}</span>
          </div>
        </div>
      </div>

      {/* ── CONTENU PRINCIPAL ── */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-6 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* ── GAUCHE : Catalogue + Outils ajoutés ── */}
          <div className="lg:col-span-7 flex flex-col gap-5">

            {/* ── Sélecteur de catégorie ── */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-4">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                <Package className="w-4 h-4" /> Catégories d'outils
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {CATEGORY_ORDER.map((catId) => {
                  const cat = TOOL_CATEGORIES[catId];
                  const summary = categorySummary[catId];
                  const isActive = activeCategory === catId;
                  return (
                    <button
                      key={catId}
                      onClick={() => setActiveCategory(catId)}
                      className={`flex items-center gap-2 p-3 rounded-xl border text-left transition-all ${
                        isActive
                          ? "border-orange-500/60 bg-orange-500/10 shadow-lg"
                          : "border-gray-700 bg-gray-800/60 hover:bg-gray-800"
                      }`}
                    >
                      <span style={{ color: cat.color }}>{cat.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-[10px] font-bold truncate ${isActive ? "text-white" : "text-gray-300"}`}>
                          {cat.label.replace(/^[^\s]+\s/, "")}
                        </p>
                        {summary && (
                          <p className="text-[9px] font-mono text-orange-400">
                            {summary.count} · {fmt(summary.total)} {currency}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Catalogue de la catégorie active ── */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-4">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                <span style={{ color: currentCat?.color }}>{currentCat?.icon}</span>
                {currentCat?.label}
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {currentCat?.tools.map((tool) => {
                  const isAdded = addedTools.some((t) => t.toolId === tool.id);
                  return (
                    <button
                      key={tool.id}
                      onClick={() => handleAddTool(tool.id, activeCategory)}
                      disabled={isAdded}
                      className={`flex items-center gap-2 p-3 rounded-xl border text-left transition-all ${
                        isAdded
                          ? "border-green-500/40 bg-green-500/10 opacity-70"
                          : "border-gray-700 bg-gray-900/60 hover:bg-gray-800 hover:border-gray-600 active:scale-95"
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                        isAdded ? "bg-green-500/20 text-green-400" : "bg-gray-700 text-gray-300"
                      }`}>
                        {isAdded ? "✓" : "+"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-bold truncate ${isAdded ? "text-green-300" : "text-white"}`}>
                          {tool.label}
                        </p>
                        <p className="text-[9px] text-gray-500">({tool.unit})</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Liste des outils ajoutés ── */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-700 bg-gray-800/50 flex items-center justify-between">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-orange-400" />
                  Outils ajoutés ({toolsWithDetails.length})
                </h3>
                {toolsWithDetails.length > 0 && (
                  <button
                    onClick={() => setAddedTools([])}
                    className="text-[10px] text-red-400 hover:text-red-300 font-bold"
                  >
                    Tout supprimer
                  </button>
                )}
              </div>

              {toolsWithDetails.length === 0 ? (
                <div className="px-4 py-12 text-center">
                  <Wrench className="w-10 h-10 text-gray-700 mx-auto mb-3" />
                  <p className="text-sm text-gray-500 font-medium">Aucun outil ajouté</p>
                  <p className="text-[10px] text-gray-600 mt-1">
                    Sélectionnez une catégorie puis cliquez sur un outil pour l'ajouter
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-800/70">
                  {toolsWithDetails.map((tool) => (
                    <div key={tool.id} className="px-4 py-3 flex flex-col md:flex-row md:items-center gap-3 hover:bg-gray-800/30 transition-colors">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                          <Wrench className="w-4 h-4 text-orange-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-white truncate">{tool.label}</p>
                          <p className="text-[9px] text-gray-500">{tool.categoryLabel}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex flex-col">
                          <label className="text-[8px] text-gray-500 uppercase font-bold mb-0.5">Qté</label>
                          <input
                            type="number"
                            min="0"
                            value={tool.quantite}
                            onChange={(e) => handleUpdateTool(tool.id, "quantite", e.target.value)}
                            className="w-16 bg-gray-900 border border-gray-600 rounded-lg px-2 py-1.5 text-xs text-white text-center font-mono focus:border-orange-500 focus:outline-none"
                          />
                        </div>
                        <div className="flex flex-col">
                          <label className="text-[8px] text-gray-500 uppercase font-bold mb-0.5">Durée</label>
                          <input
                            type="number"
                            min="0"
                            value={tool.duree}
                            onChange={(e) => handleUpdateTool(tool.id, "duree", e.target.value)}
                            className="w-16 bg-gray-900 border border-gray-600 rounded-lg px-2 py-1.5 text-xs text-white text-center font-mono focus:border-orange-500 focus:outline-none"
                          />
                        </div>
                        <div className="flex flex-col">
                          <label className="text-[8px] text-gray-500 uppercase font-bold mb-0.5">Prix unit. ({currency})</label>
                          <input
                            type="number"
                            min="0"
                            value={tool.prixUnitaire}
                            onChange={(e) => handleUpdateTool(tool.id, "prixUnitaire", e.target.value)}
                            className="w-24 bg-gray-900 border border-gray-600 rounded-lg px-2 py-1.5 text-xs text-white text-center font-mono focus:border-orange-500 focus:outline-none"
                          />
                        </div>
                        <div className="flex flex-col items-center min-w-[70px]">
                          <label className="text-[8px] text-gray-500 uppercase font-bold mb-0.5">Total</label>
                          <span className="text-xs font-bold text-orange-400 font-mono py-1.5">
                            {fmt(tool.total)} <span className="text-[9px] text-gray-500">{currency}</span>
                          </span>
                        </div>
                        <button
                          onClick={() => handleRemoveTool(tool.id)}
                          className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors mt-4"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {toolsWithDetails.length > 0 && (
                <div className="px-4 py-3 border-t border-orange-500/20 bg-orange-500/5 flex items-center justify-between">
                  <span className="text-xs font-bold text-orange-300 uppercase tracking-wider">
                    Total Outils
                  </span>
                  <span className="text-lg font-black text-white font-mono">
                    {fmt(totalGeneral)} <span className="text-xs font-normal text-orange-400">{currency}</span>
                  </span>
                </div>
              )}
            </div>

            {/* ── Bouton enregistrer ── */}
            <button
              onClick={handleSave}
              disabled={totalGeneral <= 0}
              className="w-full bg-orange-600 hover:bg-orange-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white py-4 rounded-2xl font-bold shadow-lg transition-all flex justify-center items-center gap-2 active:scale-95"
            >
              <Save className="w-5 h-5" /> Enregistrer dans l'historique
            </button>
          </div>

          {/* ── DROITE : Résumé & Historique ── */}
          <div className="lg:col-span-5 flex flex-col gap-5">

            {/* ── KPI Résumé ── */}
            <div className="grid grid-cols-3 gap-3">
              <KpiCard label="Total" value={fmt(totalGeneral)} unit={currency} color="text-orange-400" bg="bg-orange-500/10" />
              <KpiCard label="Éléments" value={String(toolsWithDetails.length)} unit="u" color="text-blue-400" bg="bg-blue-500/10" />
              <KpiCard label="Catégories" value={String(Object.keys(categorySummary).length)} unit="/" color="text-purple-400" bg="bg-purple-500/10" />
            </div>

            {/* ── Résumé par catégorie ── */}
            {Object.keys(categorySummary).length > 0 && (
              <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-4">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                  Répartition par catégorie
                </h3>
                <div className="space-y-2">
                  {Object.entries(categorySummary).map(([catId, data]) => {
                    const cat = TOOL_CATEGORIES[catId];
                    const pct = totalGeneral > 0 ? (data.total / totalGeneral) * 100 : 0;
                    return (
                      <div key={catId} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-300 font-medium flex items-center gap-2">
                            <span style={{ color: cat?.color }}>{cat?.icon}</span>
                            {cat?.label.replace(/^[^\s]+\s/, "")}
                          </span>
                          <span className="text-xs font-bold text-white font-mono">
                            {fmt(data.total)} {currency}
                          </span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, backgroundColor: cat?.color || "#f97316" }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Info ── */}
            <div className="flex items-start gap-3 p-3 bg-orange-500/5 rounded-xl border border-orange-500/20">
              <Info className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" />
              <div className="text-[10px] text-orange-200/60 leading-relaxed">
                <p className="font-bold text-orange-300 mb-1">💡 Comment ça marche ?</p>
                <p>1. Sélectionnez une catégorie d'outils</p>
                <p>2. Cliquez sur les outils à ajouter</p>
                <p>3. Renseignez la quantité, la durée et le prix unitaire</p>
                <p>4. Le coût total est calculé automatiquement</p>
                <p className="mt-2 italic">Le coût des outils s'ajoute au total général du projet bâtiment.</p>
              </div>
            </div>

            {/* ── Historique ── */}
            {historique.length > 0 && (
              <div className="bg-gray-800/30 rounded-2xl border border-gray-700/50 overflow-hidden">
                <div className="px-4 py-2 bg-gray-800/50 flex justify-between items-center border-b border-gray-700/50">
                  <h4 className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2">
                    📋 Historique des enregistrements
                  </h4>
                  <button onClick={handleClearHistorique} className="text-[10px] text-red-400 hover:underline">
                    Vider
                  </button>
                </div>
                <div className="max-h-[200px] overflow-y-auto">
                  {historique.map((item) => (
                    <div key={item.id} className="px-4 py-3 border-b border-gray-700/30 hover:bg-gray-700/40 transition-colors">
                      <div className="flex justify-between items-start gap-3">
                        <div className="min-w-0">
                          <p className="text-[9px] text-gray-500">{item.date}</p>
                          <p className="text-xs font-medium text-white">
                            {item.tools?.length || 0} outil(s)
                          </p>
                          <p className="text-[9px] text-gray-500 mt-0.5">
                            {item.tools?.map((t) => t.label).join(", ")}
                          </p>
                        </div>
                        <span className="text-sm font-bold text-orange-400 flex-shrink-0 font-mono">
                          {fmt(item.total)} {currency}
                        </span>
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

// ── Composant KPI ──
const KpiCard = ({ label, value, unit, color, bg }) => (
  <div className={`rounded-2xl p-4 flex flex-col justify-center items-center text-center ${bg}`}>
    <span className="text-[9px] text-gray-500 uppercase font-bold mb-1">{label}</span>
    <span className={`text-xl font-black ${color}`}>
      {value} <span className="text-[10px] font-normal text-gray-500 lowercase">{unit}</span>
    </span>
  </div>
);