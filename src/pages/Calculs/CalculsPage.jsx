import { useState, useCallback, useMemo, memo } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useCalculation } from "../../context/CalculationContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  HardHat, Building2, Leaf, Zap, TrainFront, Coins, ArrowRight, ChevronLeft
} from "lucide-react";

import BatimentForm    from "./batiment/forms/BatimentForm.jsx";
import TPForm          from "./tp/forms/TPForm.jsx";
import EcoForm         from "./eco/forms/EcoForm.jsx";
import EnergieForm     from "./energie/forms/EnergieForm.jsx";
import FerroviaireForm from "./ferroviaire/FerroviaireForm.jsx";

const fastTransition = { duration: 0.2, ease: "easeOut" };

const PROJECT_KEYS = ["tp", "batiment", "eco", "energie", "ferroviaire"];

const PROJECT_META = {
  tp:          { icon: HardHat,    color: "from-orange-600 to-amber-700",  bgImage: "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?q=80&w=800&auto=format&fit=crop" },
  batiment:    { icon: Building2,  color: "from-blue-600 to-indigo-700",   bgImage: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=800&auto=format&fit=crop" },
  eco:         { icon: Leaf,       color: "from-green-600 to-emerald-700", bgImage: "https://images.unsplash.com/photo-1542601906990-b4d3fb7d5b73?q=80&w=800&auto=format&fit=crop" },
  energie:     { icon: Zap,        color: "from-yellow-500 to-orange-600", bgImage: "https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?q=80&w=800&auto=format&fit=crop" },
  ferroviaire: { icon: TrainFront, color: "from-red-600 to-rose-700",      bgImage: "https://images.unsplash.com/photo-1474487548417-781cb71495f3?q=80&w=800&auto=format&fit=crop" },
};

const currencies = [
  { value: "XOF", label: "CFA (XOF)", symbol: "FCFA" },
  { value: "EUR", label: "Euro",      symbol: "€"    },
  { value: "USD", label: "Dollar",    symbol: "$"    },
];

// ─────────────────────────────────────────────
// PROJECT CARD
// ─────────────────────────────────────────────
const ProjectCard = memo(({ projectKey, config, index, onSelect }) => {
  const { t } = useTranslation();
  const [imageLoaded, setImageLoaded] = useState(false);
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, ...fastTransition }}
      whileHover={{ y: -6, scale: 1.02 }}
      className="group relative"
    >
      <div
        className="relative rounded-2xl overflow-hidden border border-gray-700/50 shadow-2xl cursor-pointer"
        style={{ height: 220 }}
        onClick={() => onSelect(projectKey)}
      >
        <div
          className={`absolute inset-0 bg-gradient-to-br ${config.color} transition-opacity duration-300`}
          style={{ opacity: imageLoaded ? 0 : 1 }}
        />
        <img
          src={config.bgImage}
          alt=""
          loading="lazy"
          decoding="async"
          onLoad={() => setImageLoaded(true)}
          className="absolute inset-0 w-full h-full object-cover transition-all duration-700 group-hover:scale-110"
          style={{ opacity: imageLoaded ? 1 : 0 }}
        />
        <div className="absolute inset-0 bg-black/45 group-hover:bg-black/55 transition-colors duration-300" />
        <div className="absolute inset-0 flex flex-col justify-between p-5">
          <div className="flex justify-between items-start">
            <div className="p-3 bg-white/20 backdrop-blur-md rounded-xl border border-white/30 group-hover:scale-110 group-hover:bg-white/30 transition-all duration-300 shadow-xl">
              <Icon className="w-6 h-6 text-white" />
            </div>
            <ArrowRight className="w-5 h-5 text-white/80 group-hover:text-white group-hover:translate-x-1 transition-all duration-300" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white mb-1 drop-shadow-lg group-hover:translate-x-1 transition-transform duration-300">
              {t(`calculs.${projectKey}`)}
            </h3>
            <p className="text-white/80 text-xs leading-relaxed drop-shadow-md group-hover:translate-x-1 transition-transform duration-300">
              {t(`calculs.${projectKey}_desc`)}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
});
ProjectCard.displayName = "ProjectCard";

// ─────────────────────────────────────────────
// SELECTION PAGE
// ─────────────────────────────────────────────
const SelectionPage = memo(({ currency, onCurrencyChange, onModeSelect }) => {
  const { t } = useTranslation();

  return (
    <div
      className="relative w-full text-white"
      style={{
        background: "linear-gradient(135deg, #111827 0%, #1f2937 50%, #111827 100%)",
        minHeight: "100%",
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none opacity-30"
        style={{
          backgroundImage:
            "linear-gradient(to right, #80808012 1px, transparent 1px), linear-gradient(to bottom, #80808012 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      <div className="absolute top-16 left-8 w-64 h-64 rounded-full blur-[100px] pointer-events-none" style={{ background: "rgba(249,115,22,0.18)" }} />
      <div className="absolute bottom-16 right-8 w-64 h-64 rounded-full blur-[100px] pointer-events-none" style={{ background: "rgba(59,130,246,0.15)" }} />

      <div className="relative z-10 px-4 py-8 pb-10">
        <div className="flex items-start justify-between mb-8 gap-3">
          <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={fastTransition}>
            <h1
              className="text-3xl font-black tracking-tight"
              style={{ background: "linear-gradient(90deg, #fb923c, #fbbf24)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
            >
              {t("calculs.title")}
            </h1>
            <p className="text-gray-400 text-sm mt-1">{t("calculs.subtitle")}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={fastTransition}
            className="flex items-center gap-2 rounded-xl px-3 py-2 border flex-shrink-0"
            style={{ background: "rgba(55,65,81,0.6)", borderColor: "rgba(75,85,99,0.5)", backdropFilter: "blur(8px)" }}
          >
            <Coins className="w-4 h-4 text-orange-400" />
            <select
              className="bg-transparent border-none text-white text-xs font-semibold focus:outline-none cursor-pointer"
              value={currency}
              onChange={(e) => onCurrencyChange(e.target.value)}
            >
              {currencies.map((c) => (
                <option key={c.value} value={c.value} className="bg-gray-800">
                  {c.label}
                </option>
              ))}
            </select>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {PROJECT_KEYS.map((key, index) => (
            <ProjectCard
              key={key}
              projectKey={key}
              config={PROJECT_META[key]}
              index={index}
              onSelect={onModeSelect}
            />
          ))}
        </div>
      </div>
    </div>
  );
});
SelectionPage.displayName = "SelectionPage";

// ─────────────────────────────────────────────
// FORM HEADER
// ─────────────────────────────────────────────
const FormHeader = memo(({ projectKey, currency, onBack }) => {
  const { t } = useTranslation();
  const meta = PROJECT_META[projectKey];
  const Icon = meta.icon;

  return (
    <header
      className="sticky top-0 z-30 border-b"
      style={{
        background: "rgba(17,24,39,0.92)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderColor: "rgba(75,85,99,0.4)",
      }}
    >
      <div className="flex items-center justify-between px-3 py-2.5 gap-2">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold text-gray-200 transition-all duration-200 active:scale-95"
          style={{ background: "rgba(55,65,81,0.8)", border: "0.5px solid rgba(75,85,99,0.6)" }}
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="hidden sm:inline">{t("common.back")}</span>
        </button>

        <div className="flex items-center gap-2 flex-1 justify-center">
          <div className={`p-1.5 rounded-lg bg-gradient-to-br ${meta.color} shadow-md`}>
            <Icon className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-bold text-white">{t(`calculs.${projectKey}`)}</span>
        </div>

        <div
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5"
          style={{ background: "rgba(55,65,81,0.8)", border: "0.5px solid rgba(75,85,99,0.6)" }}
        >
          <span className="text-xs font-bold text-orange-400">{currency}</span>
          <Coins className="w-3.5 h-3.5 text-gray-400" />
        </div>
      </div>
    </header>
  );
});
FormHeader.displayName = "FormHeader";

// ─────────────────────────────────────────────
// CALCULS — COMPOSANT PRINCIPAL
// ─────────────────────────────────────────────
export default function Calculs() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const mode     = searchParams.get("mode");
  const [currency, setCurrency] = useState("XOF");

  const { loading = false, clearMessages = () => {} } = useCalculation() || {};

  const handleModeChange = useCallback((newMode) => {
    setSearchParams({ mode: newMode });
    if (typeof clearMessages === "function") clearMessages();
  }, [setSearchParams, clearMessages]);

  const handleBack = useCallback(() => {
    setSearchParams({});
    if (typeof clearMessages === "function") clearMessages();
  }, [setSearchParams, clearMessages]);

  const handleCurrencyChange = useCallback((v) => setCurrency(v), []);

  const currentForm = useMemo(() => {
    switch (mode) {
      case "tp":          return <TPForm          currency={currency} />;
      case "batiment":    return <BatimentForm    currency={currency} />;
      case "eco":         return <EcoForm         currency={currency} />;
      case "energie":     return <EnergieForm     currency={currency} />;
      case "ferroviaire": return <FerroviaireForm currency={currency} />;
      default:            return null;
    }
  }, [mode, currency]);

  const currentMeta = PROJECT_META[mode];

  if (!mode) {
    return (
      <div className="h-full overflow-y-auto" style={{ WebkitOverflowScrolling: "touch" }}>
        <SelectionPage
          currency={currency}
          onCurrencyChange={handleCurrencyChange}
          onModeSelect={handleModeChange}
        />
      </div>
    );
  }

  return (
    <div
      className="h-full flex flex-col overflow-y-auto"
      style={{
        WebkitOverflowScrolling: "touch",
        background: "linear-gradient(135deg, #111827 0%, #1f2937 100%)",
        position: "relative",
      }}
    >
      <img
        src={currentMeta.bgImage}
        alt=""
        loading="eager"
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        style={{ opacity: 0.12, zIndex: 0 }}
      />

      <div className="relative z-10 flex flex-col min-h-full">
        <FormHeader projectKey={mode} currency={currency} onBack={handleBack} />

        <main className="flex-1 px-2 sm:px-4 py-4 pb-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={mode}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={fastTransition}
            >
              {currentForm}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ y: 80 }} animate={{ y: 0 }} exit={{ y: 80 }}
            transition={fastTransition}
            className="fixed bottom-20 right-4 z-50 flex items-center gap-3 px-4 py-2.5 rounded-xl shadow-2xl text-white text-sm font-bold"
            style={{ background: "#111827", border: "0.5px solid rgba(249,115,22,0.5)" }}
          >
            <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            {t("calculs.loading")}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}