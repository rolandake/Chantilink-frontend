// src/components/StoryEditor.jsx - COMPACT, 60 FPS, CLOUDINARY
import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { XMarkIcon, ArrowLeftIcon, PaperAirplaneIcon, SparklesIcon, AdjustmentsHorizontalIcon } from "@heroicons/react/24/outline";

const FILTERS = [
  { n: "Original", f: "none" },
  { n: "B&W", f: "grayscale(100%)" },
  { n: "Sépia", f: "sepia(100%)" },
  { n: "Vintage", f: "sepia(50%) contrast(1.2)" },
  { n: "Lumineux", f: "brightness(1.3) contrast(1.1)" },
  { n: "Sombre", f: "brightness(0.8) contrast(1.2)" },
  { n: "Vif", f: "saturate(1.5) contrast(1.1)" },
  { n: "Cool", f: "saturate(0.8) hue-rotate(20deg)" },
  { n: "Warm", f: "saturate(1.2) hue-rotate(-20deg)" },
];

const TEXT = [
  { n: "Normal", s: "font-normal text-white" },
  { n: "Bold", s: "font-bold text-white text-shadow" },
  { n: "Outline", s: "font-bold text-white outline-text" },
  { n: "Gradient", s: "font-bold bg-gradient-to-r from-pink-500 to-orange-500 bg-clip-text text-transparent" },
];

export default function StoryEditor({ file, fileType, onClose, onSubmit }) {
  const [cap, setCap] = useState("");
  const [filt, setFilt] = useState(0);
  const [txt, setTxt] = useState(0);
  const [show, setShow] = useState(false);
  const [load, setLoad] = useState(false);
  const vid = useRef(null);
  const prev = URL.createObjectURL(file);

  useEffect(() => () => URL.revokeObjectURL(prev), [prev]);

  const pub = async () => {
    setLoad(true);
    const fd = new FormData();
    fd.append("file", file); fd.append("caption", cap); fd.append("type", fileType); fd.append("filter", FILTERS[filt].n);
    try { await onSubmit(fd); onClose(); } catch { alert("Erreur"); } finally { setLoad(false); }
  };

  return (
    <motion.div className="fixed inset-0 z-[100] bg-black" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/90 to-transparent px-4 py-3">
        <div className="flex justify-between items-center">
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={onClose} className="p-2.5 hover:bg-white/10 rounded-full">
            <ArrowLeftIcon className="w-6 h-6 text-white" />
          </motion.button>
          <div className="flex gap-2">
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setShow(s => !s)} className={`px-4 py-2 rounded-full flex items-center gap-2 ${show ? "bg-orange-500 text-white" : "bg-white/10 text-white"}`}>
              <SparklesIcon className="w-5 h-5" /><span className="text-sm font-medium">Filtres</span>
            </motion.button>
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={pub} disabled={load} className="px-5 py-2.5 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-full font-semibold disabled:opacity-50 flex items-center gap-2">
              {load ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Envoi...</> : <><PaperAirplaneIcon className="w-5 h-5" /> Publier</>}
            </motion.button>
          </div>
        </div>
      </div>

      {/* Media + Caption */}
      <div className="absolute inset-0 flex items-center justify-center pt-16 pb-4">
        <div className="relative w-full h-full max-w-lg flex flex-col px-4">
          <div className="flex-1 relative rounded-3xl overflow-hidden bg-black shadow-2xl mb-4" style={{ filter: FILTERS[filt].f }}>
            {fileType === "image" ? <img src={prev} alt="" className="w-full h-full object-contain" /> : <video ref={vid} src={prev} controls autoPlay muted loop playsInline className="w-full h-full object-contain" />}
            {cap && (
              <motion.div initial={{ y: 20 }} animate={{ y: 0 }} className="absolute bottom-20 left-0 right-0 px-4">
                <div className="bg-black/70 backdrop-blur-xl rounded-2xl px-5 py-3 shadow-2xl border border-white/10 max-w-md mx-auto">
                  <p className={`text-center font-medium leading-relaxed ${TEXT[txt].s}`}>{cap}</p>
                </div>
              </motion.div>
            )}
            <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
          </div>

          {/* Filters + Text Styles */}
          <AnimatePresence>
            {show && (
              <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }} className="absolute bottom-24 left-4 right-4 bg-black/90 backdrop-blur-xl rounded-3xl p-4 border border-white/20 shadow-2xl">
                <div className="flex items-center gap-2 mb-3"><SparklesIcon className="w-5 h-5 text-orange-400" /><h3 className="text-white font-bold">Filtres</h3></div>
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-orange-500">
                  {FILTERS.map((f, i) => (
                    <button key={i} onClick={() => setFilt(i)} className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium ${filt === i ? "bg-orange-500 text-white" : "bg-white/10 text-white hover:bg-white/20"}`}>{f.n}</button>
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-4 mb-2"><AdjustmentsHorizontalIcon className="w-5 h-5 text-orange-400" /><h3 className="text-white font-bold">Texte</h3></div>
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-orange-500">
                  {TEXT.map((t, i) => (
                    <button key={i} onClick={() => setTxt(i)} className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium ${txt === i ? "bg-purple-500 text-white" : "bg-white/10 text-white hover:bg-white/20"}`}>{t.n}</button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Caption Input */}
          <motion.div initial={{ y: 50 }} animate={{ y: 0 }} className="mb-4">
            <div className="bg-black/80 backdrop-blur-xl rounded-2xl p-3 shadow-2xl border border-white/20">
              <input type="text" value={cap} onChange={e => setCap(e.target.value)} placeholder="Légende..." maxLength={200} className="w-full px-4 py-3 bg-white/10 text-white placeholder-white/50 rounded-xl border border-white/20 focus:outline-none focus:ring-2 focus:ring-orange-500/40" />
              {cap && <p className="text-white/60 text-xs mt-2 text-right">{cap.length}/200</p>}
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}