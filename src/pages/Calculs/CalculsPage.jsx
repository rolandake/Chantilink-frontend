import { useState, useCallback, useMemo, memo } from "react";
import { useSearchParams } from "react-router-dom";
import { useCalculation } from "../../context/CalculationContext";
import { motion, AnimatePresence } from "framer-motion";
import { 
  HardHat, Building2, Leaf, Zap, TrainFront, Coins, ArrowRight, ChevronLeft
} from "lucide-react";

import BatimentForm from "./batiment/forms/BatimentForm.jsx";
import TPForm from "./tp/forms/TPForm.jsx";
import EcoForm from "./eco/forms/EcoForm.jsx";
import EnergieForm from "./energie/forms/EnergieForm.jsx";
import FerroviaireForm from "./ferroviaire/FerroviaireForm.jsx";

// ✅ Transitions ultra-rapides
const fastTransition = { duration: 0.2, ease: "easeOut" };

// ✅ Configuration avec images optimisées
const projectConfig = {
  tp: {
    label: "Travaux Publics",
    icon: HardHat,
    color: "from-orange-600 to-amber-700",
    bgImage: "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?q=80&w=800&auto=format&fit=crop",
    desc: "Routes, infrastructures et génie civil",
    details: "Terrassement, fondation, chaussée, ouvrages hydrauliques"
  },
  batiment: {
    label: "Bâtiment",
    icon: Building2,
    color: "from-blue-600 to-indigo-700",
    bgImage: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=800&auto=format&fit=crop",
    desc: "Structures résidentielles et commerciales",
    details: "Béton, ferraillage, maçonnerie, finitions"
  },
  eco: {
    label: "Écologique",
    icon: Leaf,
    color: "from-green-600 to-emerald-700",
    bgImage: "https://images.unsplash.com/photo-1542601906990-b4d3fb7d5b73?q=80&w=800&auto=format&fit=crop",
    desc: "Impact environnemental et durabilité",
    details: "Empreinte carbone, matériaux recyclés, économie d'énergie"
  },
  energie: {
    label: "Énergie",
    icon: Zap,
    color: "from-yellow-500 to-orange-600",
    bgImage: "https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?q=80&w=800&auto=format&fit=crop",
    desc: "Solaire, éolien et réseaux électriques",
    details: "Dimensionnement, puissance, rendement énergétique"
  },
  ferroviaire: {
    label: "Ferroviaire",
    icon: TrainFront,
    color: "from-red-600 to-rose-700",
    bgImage: "https://images.unsplash.com/photo-1474487548417-781cb71495f3?q=80&w=800&auto=format&fit=crop",
    desc: "Lignes de train et infrastructures",
    details: "Voies, ballast, signalisation ferroviaire"
  },
};

const currencies = [
  { value: "XOF", label: "CFA (XOF)", symbol: "FCFA" },
  { value: "EUR", label: "Euro", symbol: "€" },
  { value: "USD", label: "Dollar", symbol: "$" },
];

// ✅ ProjectCard optimisée avec chargement d'image progressif
const ProjectCard = memo(({ projectKey, config, index, onSelect }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const Icon = config.icon;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, ...fastTransition }}
      whileHover={{ y: -8, scale: 1.02 }}
      className="group relative"
    >
      <div 
        className="relative h-[400px] rounded-3xl overflow-hidden border border-gray-700/50 shadow-2xl cursor-pointer"
        onClick={() => onSelect(projectKey)}
      >
        
        {/* ✅ Gradient de fallback pendant le chargement */}
        <div className={`absolute inset-0 bg-gradient-to-br ${config.color} transition-opacity duration-300 ${imageLoaded ? 'opacity-0' : 'opacity-100'}`} />
        
        {/* ✅ Image optimisée avec chargement lazy */}
        <img
          src={config.bgImage}
          alt=""
          loading="lazy"
          decoding="async"
          onLoad={() => setImageLoaded(true)}
          className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 group-hover:scale-110 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
        />
        
        {/* Overlay */}
        <div className="absolute inset-0 bg-black/40 group-hover:bg-black/50 transition-all duration-300" />
        
        <div className="absolute inset-0 flex flex-col justify-between p-8">
          <div className="flex justify-between items-start">
            <div className="p-4 bg-white/20 backdrop-blur-md rounded-2xl border border-white/30 group-hover:scale-110 group-hover:bg-white/30 transition-all duration-300 shadow-xl">
              <Icon className="w-8 h-8 text-white" />
            </div>
            <ArrowRight className="w-6 h-6 text-white/80 group-hover:text-white group-hover:translate-x-2 transition-all duration-300" />
          </div>

          <div>
            <h3 className="text-3xl font-bold text-white mb-2 group-hover:translate-x-2 transition-transform duration-300 drop-shadow-lg">
              {config.label}
            </h3>
            <p className="text-white/90 text-sm mb-3 group-hover:translate-x-2 transition-transform duration-300 drop-shadow-md">
              {config.details}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
});

// ✅ SelectionPage mémorisée
const SelectionPage = memo(({ currency, onCurrencyChange, onModeSelect }) => {
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white overflow-hidden pb-24">
      
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:64px_64px] opacity-50" />
      
      <div className="absolute top-20 left-20 w-96 h-96 bg-orange-500/20 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-20 right-20 w-96 h-96 bg-blue-500/20 rounded-full blur-[120px] animate-pulse" />

      <div className="relative z-10 container mx-auto px-6 py-16">
        
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={fastTransition}
          className="text-center mb-16"
        >
          <h1 className="text-6xl font-black tracking-tight mb-4 bg-gradient-to-r from-orange-400 via-amber-500 to-yellow-400 bg-clip-text text-transparent">
            ChantiLink Calculs
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Choisissez votre type de projet pour accéder aux outils de calcul professionnels
          </p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={fastTransition}
          className="absolute top-8 right-8 flex items-center gap-3 bg-gray-800/50 backdrop-blur-xl border border-gray-700/50 rounded-2xl px-6 py-3 z-20"
        >
          <Coins className="w-5 h-5 text-orange-400" />
          <select 
            className="bg-transparent border-none text-white text-sm font-semibold focus:outline-none cursor-pointer"
            value={currency}
            onChange={(e) => onCurrencyChange(e.target.value)}
          >
            {currencies.map((c) => (
              <option key={c.value} value={c.value} className="bg-gray-800">
                {c.label} ({c.symbol})
              </option>
            ))}
          </select>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
          {Object.entries(projectConfig).map(([key, config], index) => (
            <ProjectCard 
              key={key}
              projectKey={key}
              config={config}
              index={index}
              onSelect={onModeSelect}
            />
          ))}
        </div>
      </div>
    </div>
  );
});

// ✅ FormHeader mémorisé
const FormHeader = memo(({ theme, currency, onBack }) => {
  const Icon = theme.icon;
  
  return (
    <header className="sticky top-0 z-50 bg-gray-900/90 backdrop-blur-xl border-b border-gray-700/50 shadow-lg">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-xl transition-all duration-200 group active:scale-95"
        >
          <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span className="font-semibold text-sm hidden sm:inline">Retour aux choix</span>
          <span className="font-semibold text-sm sm:hidden">Retour</span>
        </button>

        <div className="flex items-center gap-3">
          <div className={`p-1.5 rounded-lg bg-gradient-to-br ${theme.color} shadow-md`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-lg font-bold text-white hidden sm:block">{theme.label}</h1>
        </div>

        <div className="flex items-center bg-gray-800/80 border border-gray-600 rounded-lg px-3 py-1.5">
          <span className="text-xs font-bold text-orange-400 mr-2">{currency}</span>
          <Coins className="w-4 h-4 text-gray-400" />
        </div>
      </div>
    </header>
  );
});

// ✅ BackgroundImage mémorisé avec chargement optimisé
const BackgroundImage = memo(({ imageUrl }) => {
  const [loaded, setLoaded] = useState(false);
  
  return (
    <>
      <div className={`fixed inset-0 z-0 bg-gray-900 transition-opacity duration-500 ${loaded ? 'opacity-0' : 'opacity-100'}`} />
      <img
        src={imageUrl}
        alt=""
        loading="eager"
        onLoad={() => setLoaded(true)}
        className={`fixed inset-0 z-0 w-full h-full object-cover opacity-20 pointer-events-none transition-opacity duration-500 ${loaded ? 'opacity-20' : 'opacity-0'}`}
      />
    </>
  );
});

export default function Calculs() {
  const [searchParams, setSearchParams] = useSearchParams();
  const mode = searchParams.get("mode");
  const [currency, setCurrency] = useState("XOF");

  const {
    loading = false,
    clearMessages = () => {},
  } = useCalculation() || {};

  const handleModeChange = useCallback((newMode) => {
    setSearchParams({ mode: newMode });
    if (typeof clearMessages === 'function') clearMessages();
  }, [setSearchParams, clearMessages]);

  const handleBack = useCallback(() => {
    setSearchParams({});
    if (typeof clearMessages === 'function') clearMessages();
  }, [setSearchParams, clearMessages]);

  const handleCurrencyChange = useCallback((newCurrency) => {
    setCurrency(newCurrency);
  }, []);

  const currentForm = useMemo(() => {
    switch (mode) {
      case "tp": return <TPForm currency={currency} />;
      case "batiment": return <BatimentForm currency={currency} />;
      case "eco": return <EcoForm currency={currency} />;
      case "energie": return <EnergieForm currency={currency} />;
      case "ferroviaire": return <FerroviaireForm currency={currency} />;
      default: return null;
    }
  }, [mode, currency]);

  const currentTheme = useMemo(() => projectConfig[mode], [mode]);

  if (!mode) {
    return (
      <SelectionPage 
        currency={currency}
        onCurrencyChange={handleCurrencyChange}
        onModeSelect={handleModeChange}
      />
    );
  }

  return (
    <div className="fixed inset-0 w-full h-full bg-gray-900 text-gray-200 overflow-y-auto">
      
      {/* ✅ Background avec image optimisée */}
      <BackgroundImage imageUrl={currentTheme.bgImage} />
      
      <div className="relative z-10 min-h-screen flex flex-col">
        
        <FormHeader 
          theme={currentTheme}
          currency={currency}
          onBack={handleBack}
        />

        <main className="flex-1 container mx-auto px-2 sm:px-4 py-6 relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={mode}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={fastTransition}
              className="pb-10"
            >
              {currentForm}
            </motion.div>
          </AnimatePresence>
        </main>

        <AnimatePresence>
          {loading && (
            <motion.div 
              initial={{ y: 100 }} 
              animate={{ y: 0 }} 
              exit={{ y: 100 }}
              transition={fastTransition}
              className="fixed bottom-6 right-6 bg-gray-900 border border-orange-500/50 text-white px-5 py-3 rounded-xl shadow-2xl z-[60] flex items-center gap-3"
            >
              <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
              <span className="font-bold text-sm">Calcul...</span>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}