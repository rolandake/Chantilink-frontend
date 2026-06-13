// 📁 src/pages/Videos/VideoBoostModal.jsx
// Composant de boost vidéo — réutilise le même système de boost que les posts
// Plans: 24h/1500, 3j/3500, 7j/7000 (FCFA)

import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { FaTimes, FaRocket, FaCheck, FaCrown, FaBolt, FaClock } from "react-icons/fa";
import { useAuth } from "../../context/AuthContext";
import axiosClient from "../../api/axiosClientGlobal";

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? "https://chantilink-backend.onrender.com/api" : "http://localhost:5000/api");

const BOOST_PLANS = [
  {
    id: "boost_24h",
    duration: 24,
    amount: 1500,
    label: "24h",
    detail: "Coup de pouce rapide",
    icon: FaBolt,
    color: "from-blue-500 to-cyan-400",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
    recommended: false,
  },
  {
    id: "boost_3j",
    duration: 72,
    amount: 3500,
    label: "3 jours",
    detail: "Visibilité équilibrée",
    icon: FaRocket,
    color: "from-purple-500 to-pink-500",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/30",
    recommended: true,
  },
  {
    id: "boost_7j",
    duration: 168,
    amount: 7000,
    label: "7 jours",
    detail: "Campagne prolongée",
    icon: FaCrown,
    color: "from-orange-500 to-yellow-500",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/30",
    recommended: false,
  },
];

const formatAmount = (n) => {
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K`;
  return String(n);
};

const VideoBoostModal = ({ video, show, onClose, onBoostSuccess }) => {
  const { user: currentUser, getToken } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [boostComplete, setBoostComplete] = useState(false);
  const [error, setError] = useState(null);

  const handleSelectPlan = useCallback((plan) => {
    setSelectedPlan(plan.id === selectedPlan ? null : plan);
    setError(null);
  }, [selectedPlan]);

  const handleBoost = useCallback(async () => {
    if (!selectedPlan || !video?._id || !currentUser) return;
    
    const plan = BOOST_PLANS.find(p => p.id === selectedPlan);
    if (!plan) return;

    setIsProcessing(true);
    setError(null);

    try {
      const token = await getToken();
      
      // Create boost via API
      const res = await axiosClient.post(`/videos/${video._id}/boost`, {
        duration: plan.duration,
        amount: plan.amount,
        paymentMethod: "wallet", // or "stripe"
      }, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (res.data?.success) {
        setBoostComplete(true);
        if (onBoostSuccess) onBoostSuccess(video._id, plan);
        setTimeout(() => {
          onClose();
          setBoostComplete(false);
          setSelectedPlan(null);
        }, 2500);
      } else {
        setError(res.data?.message || "Erreur lors du boost");
      }
    } catch (err) {
      console.error("❌ Erreur boost:", err);
      setError(err.response?.data?.message || "Impossible de booster cette vidéo. Vérifiez votre solde.");
    } finally {
      setIsProcessing(false);
    }
  }, [selectedPlan, video, currentUser, getToken, onBoostSuccess, onClose]);

  if (!show) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center"
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

        {/* Modal */}
        <motion.div
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ type: "spring", damping: 28, stiffness: 320 }}
          className="relative w-full sm:max-w-md bg-gray-900 rounded-t-3xl sm:rounded-3xl border border-gray-800 shadow-2xl z-10 overflow-hidden"
          style={{ maxHeight: "85vh" }}
        >
          {/* Success Animation */}
          {boostComplete && (
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/20 to-purple-500/20 flex flex-col items-center justify-center z-50">
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 20 }}
                className="w-24 h-24 rounded-full bg-gradient-to-br from-orange-500 to-purple-600 flex items-center justify-center mb-6 shadow-lg shadow-orange-500/30"
              >
                <FaCheck className="text-white text-4xl" />
              </motion.div>
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-white text-xl font-bold"
              >
                Boost activé ! 🚀
              </motion.p>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-gray-400 text-sm mt-2"
              >
                Votre vidéo est maintenant mise en avant
              </motion.p>
            </div>
          )}

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-purple-600 flex items-center justify-center">
                <FaRocket className="text-white text-lg" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Booster la vidéo</h3>
                <p className="text-xs text-gray-400">Augmentez la visibilité de votre contenu</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-white rounded-full hover:bg-gray-800 transition">
              <FaTimes size={18} />
            </button>
          </div>

          {/* Content */}
          <div className="p-5 space-y-4 overflow-y-auto" style={{ maxHeight: "calc(85vh - 180px)" }}>
            {/* Video Preview */}
            {video && (
              <div className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-xl border border-gray-700">
                <div className="w-16 aspect-[9/16] bg-black rounded-lg overflow-hidden flex-shrink-0">
                  {video.thumbnail ? (
                    <img src={video.thumbnail} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gray-700 flex items-center justify-center">
                      <FaRocket className="text-gray-500" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-bold truncate">{video.title || "Vidéo"}</p>
                  <p className="text-gray-400 text-xs mt-1">
                    {video.views || 0} vues · {video.likes || 0} likes
                  </p>
                </div>
              </div>
            )}

            {/* Plans */}
            <div className="space-y-3">
              <p className="text-xs text-gray-400 font-bold uppercase tracking-wide">Choisissez un plan</p>
              
              {BOOST_PLANS.map((plan) => {
                const Icon = plan.icon;
                const isSelected = selectedPlan === plan.id;
                return (
                  <motion.button
                    key={plan.id}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleSelectPlan(plan)}
                    className={`w-full p-4 rounded-xl border-2 transition-all relative ${
                      isSelected
                        ? `${plan.borderColor} ${plan.bgColor}`
                        : "border-gray-700 bg-gray-800/50 hover:border-gray-600"
                    }`}
                  >
                    {plan.recommended && (
                      <span className="absolute -top-2.5 left-4 bg-purple-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                        Recommandé
                      </span>
                    )}
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${plan.color} flex items-center justify-center flex-shrink-0`}>
                        <Icon className="text-white text-xl" />
                      </div>
                      <div className="flex-1 text-left">
                        <div className="flex items-center gap-2">
                          <p className="text-white font-bold text-base">{plan.label}</p>
                          <span className="text-gray-400 text-xs">· {plan.detail}</span>
                        </div>
                        <div className="flex items-center gap-1 mt-1">
                          <FaClock className="text-gray-500 text-[10px]" />
                          <span className="text-gray-400 text-xs">Durée : {plan.duration}h</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-white font-bold text-lg">{formatAmount(plan.amount)} <span className="text-xs text-gray-400">FCFA</span></p>
                      </div>
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                        isSelected ? "border-orange-500 bg-orange-500" : "border-gray-600"
                      }`}>
                        {isSelected && <FaCheck className="text-white text-xs" />}
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>

            {/* Benefits */}
            <div className="p-3 bg-gray-800/30 rounded-xl border border-gray-700/50">
              <p className="text-xs text-gray-400 font-bold uppercase tracking-wide mb-2">Avantages du boost</p>
              <div className="space-y-2">
                {[
                  "🚀 Priorité dans le feed des utilisateurs",
                  "📈 Augmentation des vues et interactions",
                  "🎯 Ciblage par catégorie et centres d'intérêt",
                  "📊 Statistiques détaillées en temps réel",
                ].map((benefit, i) => (
                  <p key={i} className="text-gray-300 text-xs flex items-start gap-2">
                    {benefit}
                  </p>
                ))}
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm p-3 rounded-xl">
                {error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-800 bg-gray-900/95">
            <button
              onClick={handleBoost}
              disabled={!selectedPlan || isProcessing}
              className={`w-full py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 ${
                selectedPlan && !isProcessing
                  ? "bg-gradient-to-r from-orange-500 to-purple-600 text-white shadow-lg shadow-orange-500/20 hover:brightness-110"
                  : "bg-gray-800 text-gray-500 cursor-not-allowed"
              }`}
            >
              {isProcessing ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Traitement en cours...
                </>
              ) : selectedPlan ? (
                <>
                  <FaRocket /> Booster maintenant — {formatAmount(BOOST_PLANS.find(p => p.id === selectedPlan)?.amount || 0)} FCFA
                </>
              ) : (
                "Sélectionnez un plan"
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
};

export default React.memo(VideoBoostModal);