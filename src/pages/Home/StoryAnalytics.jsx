// src/components/StoryAnalytics.jsx - VERSION COMPLÈTE
import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { XMarkIcon, EyeIcon, ClockIcon, PhotoIcon, UserGroupIcon, ChartBarIcon } from "@heroicons/react/24/outline";
import { useStories } from "../../context/StoryContext";

export default function StoryAnalytics({ storyId, onClose }) {
  const { getAnalytics } = useStories();
  const [data, setData] = useState(null);
  const [load, setLoad] = useState(true);
  const [err, setErr] = useState(null);

  // ════════════════════════════════════════════════════════
  // FETCH ANALYTICS
  // ════════════════════════════════════════════════════════
  useEffect(() => {
    (async () => {
      try { 
        setLoad(true); 
        setErr(null); 
        const analytics = await getAnalytics(storyId);
        setData(analytics);
      }
      catch (e) { 
        setErr(e.message); 
      } 
      finally { 
        setLoad(false); 
      }
    })();
  }, [storyId, getAnalytics]);

  // ════════════════════════════════════════════════════════
  // COMPUTED VALUES
  // ════════════════════════════════════════════════════════
  const { rate, timeLeft } = useMemo(() => {
    if (!data) return { rate: 0, timeLeft: 0 };
    const r = data.totalSlides > 0 ? ((data.totalViews / data.totalSlides) * 100).toFixed(1) : 0;
    return { rate: r, timeLeft: data.hoursRemaining };
  }, [data]);

  // ════════════════════════════════════════════════════════
  // FORMAT DATE
  // ════════════════════════════════════════════════════════
  const fmt = (d) => new Date(d).toLocaleString('fr-FR', { 
    day: 'numeric', 
    month: 'long', 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  // ════════════════════════════════════════════════════════
  // LOADING STATE
  // ════════════════════════════════════════════════════════
  if (load) return (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-white font-medium">Chargement...</p>
      </div>
    </div>
  );

  // ════════════════════════════════════════════════════════
  // ERROR STATE
  // ════════════════════════════════════════════════════════
  if (err) return (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-red-500/20 border border-red-500 rounded-2xl p-6 max-w-md">
        <p className="text-red-400 text-center">Error: {err}</p>
        <button 
          onClick={onClose} 
          className="mt-4 w-full px-4 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600"
        >
          Fermer
        </button>
      </div>
    </div>
  );

  // ════════════════════════════════════════════════════════
  // NO DATA
  // ════════════════════════════════════════════════════════
  if (!data) return null;

  // ════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════
  return (
    <motion.div 
      className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm overflow-y-auto" 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }}
    >
      <div className="min-h-screen py-8 px-4">
        <div className="max-w-2xl mx-auto">

          {/* ─────────────────────────────────────────────────
              HEADER
          ───────────────────────────────────────────────── */}
          <motion.div 
            className="flex justify-between items-center mb-6" 
            initial={{ y: -50 }} 
            animate={{ y: 0 }}
          >
            <h2 className="text-white text-2xl font-bold flex items-center gap-2">
              <ChartBarIcon className="w-7 h-7 text-orange-400" /> 
              Statistiques
            </h2>
            <motion.button 
              whileHover={{ scale: 1.1 }} 
              whileTap={{ scale: 0.9 }} 
              onClick={onClose} 
              className="p-2 hover:bg-white/10 rounded-full"
            >
              <XMarkIcon className="w-6 h-6 text-white" />
            </motion.button>
          </motion.div>

          {/* ─────────────────────────────────────────────────
              OVERVIEW CARDS
          ───────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { icon: PhotoIcon, color: "blue", label: "Slides", val: data.totalSlides },
              { icon: EyeIcon, color: "green", label: "Vues", val: data.totalViews },
              { icon: UserGroupIcon, color: "purple", label: "Spectateurs", val: data.uniqueViewers },
              { icon: ClockIcon, color: "orange", label: "Restant", val: `${timeLeft}h` },
            ].map((s, i) => (
              <motion.div 
                key={i} 
                initial={{ scale: 0.8 }} 
                animate={{ scale: 1 }} 
                transition={{ delay: 0.1 + i * 0.1 }} 
                className={`bg-gradient-to-br from-${s.color}-500/20 to-${s.color}-600/20 border border-${s.color}-500/30 rounded-2xl p-4`}
              >
                <s.icon className={`w-8 h-8 text-${s.color}-400 mb-2`} />
                <p className={`text-${s.color}-200 text-sm`}>{s.label}</p>
                <p className="text-white text-3xl font-bold">{s.val}</p>
              </motion.div>
            ))}
          </div>

          {/* ─────────────────────────────────────────────────
              VIEW RATE
          ───────────────────────────────────────────────── */}
          <motion.div 
            initial={{ y: 20 }} 
            animate={{ y: 0 }} 
            transition={{ delay: 0.5 }} 
            className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 mb-6"
          >
            <div className="flex justify-between mb-3">
              <p className="text-white font-semibold">Taux de visionnage</p>
              <p className="text-orange-400 font-bold text-xl">{rate}%</p>
            </div>
            <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }} 
                animate={{ width: `${rate}%` }} 
                transition={{ duration: 1, ease: "easeOut" }} 
                className="h-full bg-gradient-to-r from-orange-500 to-pink-500 rounded-full" 
              />
            </div>
            <p className="text-gray-400 text-sm mt-2">
              {data.totalViews} vues sur {data.totalSlides} slides
            </p>
          </motion.div>

          {/* ─────────────────────────────────────────────────
              SLIDES ANALYTICS
          ───────────────────────────────────────────────── */}
          <motion.div 
            initial={{ y: 20 }} 
            animate={{ y: 0 }} 
            transition={{ delay: 0.6 }} 
            className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 mb-6"
          >
            <h3 className="text-white font-bold text-lg mb-4">Détails par slide</h3>
            <div className="space-y-3">
              {data.slidesAnalytics.map((s, i) => (
                <div 
                  key={i} 
                  className="flex justify-between items-center p-3 bg-white/5 rounded-xl hover:bg-white/10 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold">
                      {i + 1}
                    </div>
                    <div>
                      <p className="text-white font-medium">Slide {i + 1}</p>
                      <p className="text-gray-400 text-sm capitalize">{s.type}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1 text-green-400">
                      <EyeIcon className="w-5 h-5" />
                      <span className="font-semibold">{s.views}</span>
                    </div>
                    {s.reactions > 0 && (
                      <div className="text-pink-400 font-semibold">
                        ❤️ {s.reactions}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* ─────────────────────────────────────────────────
              TIMELINE
          ───────────────────────────────────────────────── */}
          <motion.div 
            initial={{ y: 20 }} 
            animate={{ y: 0 }} 
            transition={{ delay: 0.7 }} 
            className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6"
          >
            <h3 className="text-white font-bold text-lg mb-4">Chronologie</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-400">Créée le</span>
                <span className="text-white font-medium">{fmt(data.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Expire le</span>
                <span className="text-white font-medium">{fmt(data.expiresAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Temps restant</span>
                <span className="text-orange-400 font-bold">
                  {timeLeft > 0 ? `${timeLeft} heures` : 'Expirée'}
                </span>
              </div>
            </div>
          </motion.div>

          {/* ─────────────────────────────────────────────────
              CLOSE BUTTON
          ───────────────────────────────────────────────── */}
          <motion.button 
            initial={{ y: 20 }} 
            animate={{ y: 0 }} 
            transition={{ delay: 0.8 }} 
            onClick={onClose} 
            className="w-full mt-6 px-6 py-4 bg-gradient-to-r from-orange-500 to-pink-500 text-white rounded-2xl font-bold hover:from-orange-600 hover:to-pink-600 shadow-lg transition-all transform hover:scale-105"
          >
            Fermer
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}