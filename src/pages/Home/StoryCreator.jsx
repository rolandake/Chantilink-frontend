// ============================================
// 📁 src/pages/Home/StoryCreator.jsx
//
// ✅ INP FIX :
//   - Suppression de backdrop-blur-sm sur l'overlay principal
//     → backdrop-filter: blur() est le composant GPU le plus coûteux au premier paint
//   - publish() : yield au browser (setTimeout 0) avant la requête réseau
//     → React peut re-render et afficher le spinner AVANT que la requête bloque
//   - Animations réduites (durées plus courtes) pour une réactivité perçue meilleure
// ============================================

import React, { useState, useRef, useEffect, startTransition } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  XMarkIcon, PhotoIcon, PaperAirplaneIcon,
  FaceSmileIcon, PencilIcon, SwatchIcon,
  GlobeAltIcon, LockClosedIcon, SparklesIcon,
} from "@heroicons/react/24/solid";
import { useStories } from "../../context/StoryContext";

const MAX_DURATION = 60;

const BACKGROUNDS = [
  "linear-gradient(45deg, #FF9A9E 0%, #FECFEF 99%, #FECFEF 100%)",
  "linear-gradient(120deg, #84fab0 0%, #8fd3f4 100%)",
  "linear-gradient(120deg, #e0c3fc 0%, #8ec5fc 100%)",
  "linear-gradient(to top, #30cfd0 0%, #330867 100%)",
  "linear-gradient(to top, #09203f 0%, #537895 100%)",
  "linear-gradient(to right, #43e97b 0%, #38f9d7 100%)",
  "#000000",
  "#F44336"
];

const FONTS = ["Inter", "Merriweather", "Courier Prime", "Pacifico", "Impact"];

// ─────────────────────────────────────────────
// EMOJI PICKER
// ─────────────────────────────────────────────
const EmojiPicker = ({ onSelect }) => {
  const emojis = ["😂", "❤️", "😍", "🔥", "😭", "🙏", "👍", "🥰", "🤔", "🎉", "💩", "👀", "✨", "💯", "🚀", "👋", "🥳", "👻"];
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      // ✅ INP FIX : transition plus courte pour réactivité perçue
      transition={{ duration: 0.1 }}
      className="absolute bottom-20 left-4 bg-black/80 backdrop-blur-xl rounded-2xl p-3 grid grid-cols-6 gap-2 z-50 border border-white/10 shadow-2xl"
    >
      {emojis.map((e, i) => (
        <button key={i} onClick={() => onSelect(e)} className="text-2xl hover:scale-125 transition-transform active:scale-95">{e}</button>
      ))}
    </motion.div>
  );
};

// ============================================
// COMPOSANT PRINCIPAL
// ============================================
function StoryCreator({ onClose }) {
  const [mode,          setMode]          = useState("media");
  const [visibility,    setVisibility]    = useState("public");
  const [media,         setMedia]         = useState(null);
  const [preview,       setPreview]       = useState(null);
  const [text,          setText]          = useState("");
  const [bgIndex,       setBgIndex]       = useState(0);
  const [fontIndex,     setFontIndex]     = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [trimRange,     setTrimRange]     = useState({ start: 0, end: MAX_DURATION });
  const [showTrimmer,   setShowTrimmer]   = useState(false);
  const [uploading,     setUploading]     = useState(false);
  const [showEmoji,     setShowEmoji]     = useState(false);
  const [toast,         setToast]         = useState(null);

  const fileInput = useRef(null);
  const videoRef  = useRef(null);
  const { createStory, fetchStories } = useStories();

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const showLocalToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 100 * 1024 * 1024) return showLocalToast("Fichier trop lourd (Max 100Mo)", "error");

    // ✅ INP FIX : setUploading dans startTransition → ne bloque pas l'UI
    startTransition(() => setUploading(true));
    const url = URL.createObjectURL(file);

    if (file.type.startsWith("image")) {
      setMedia(file);
      setPreview(url);
      setMode("media");
      setShowTrimmer(false);
      startTransition(() => setUploading(false));
    } else if (file.type.startsWith("video")) {
      const video = document.createElement('video');
      video.src = url;
      video.onloadedmetadata = () => {
        const dur = video.duration;
        setVideoDuration(dur);
        setTrimRange({ start: 0, end: Math.min(MAX_DURATION, dur) });
        setMedia(file);
        setPreview(url);
        setMode("media");
        setShowTrimmer(dur > MAX_DURATION);
        startTransition(() => setUploading(false));
      };
    }
  };

  // ✅ INP FIX : publish() yield au browser avant la requête réseau
  // Sans le setTimeout(0), React n'a pas le temps de re-render le spinner
  // avant que createStory() bloque le thread → l'UI freeze sans feedback visuel
  const publish = async () => {
    if (!text.trim() && !media) return;

    // 1. Mettre à jour l'état uploading immédiatement
    setUploading(true);

    // 2. ✅ Yield au browser : laisser React re-render et afficher le spinner
    //    AVANT que la requête réseau ne démarre
    await new Promise(r => setTimeout(r, 0));

    try {
      const form = new FormData();
      form.append("visibility", visibility);
      if (mode === "text") {
        form.append("type", "text");
        form.append("caption", text);
        form.append("background", BACKGROUNDS[bgIndex]);
        form.append("fontFamily", FONTS[fontIndex]);
      } else {
        form.append("file", media);
        form.append("type", media.type.startsWith("image") ? "image" : "video");
        if (text.trim()) form.append("caption", text);
      }
      await createStory(form);
      await fetchStories(true);
      onClose();
    } catch (err) {
      showLocalToast("Erreur lors de la publication", "error");
    } finally {
      setUploading(false);
    }
  };

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        // ✅ INP FIX : backdrop-blur-sm SUPPRIMÉ de l'overlay principal
        // backdrop-filter: blur() force le GPU à créer une texture séparée pour CHAQUE frame
        // C'est la cause principale du freeze au premier rendu du StoryCreator
        // bg-black/95 suffit amplement pour l'effet d'assombrissement
        transition={{ duration: 0.15 }}
        className="fixed inset-0 bg-black/95 z-[9999] flex items-center justify-center sm:p-4"
      >
        <motion.div
          initial={{ y: 40, scale: 0.95 }} animate={{ y: 0, scale: 1 }} exit={{ y: 40, scale: 0.95 }}
          // ✅ INP FIX : durée réduite 0.2s → 0.15s pour réactivité perçue meilleure
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className="relative w-full h-full sm:h-[85vh] sm:max-w-[400px] bg-black sm:rounded-[32px] overflow-hidden flex flex-col shadow-2xl border border-white/10"
        >

          {/* === HEADER FLOTTANT === */}
          <div className="absolute top-0 left-0 right-0 p-4 z-30 flex justify-between items-start bg-gradient-to-b from-black/60 to-transparent pt-6">
            <button
              onClick={onClose}
              className="p-2 bg-black/20 rounded-full text-white hover:bg-white/20 transition"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>

            <button
              onClick={() => setVisibility(v => v === "public" ? "private" : "public")}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all shadow-lg ${
                visibility === "public"
                  ? "bg-green-500/80 text-white"
                  : "bg-red-500/80 text-white"
              }`}
            >
              {visibility === "public" ? <GlobeAltIcon className="w-4 h-4" /> : <LockClosedIcon className="w-4 h-4" />}
              <span>{visibility === "public" ? "Tout le monde" : "Abonnés"}</span>
            </button>
          </div>

          {/* === CONTENU PRINCIPAL === */}
          <div className="flex-1 relative bg-[#111] flex items-center justify-center overflow-hidden">

            {/* --- MODE TEXTE --- */}
            {mode === "text" && (
              <motion.div
                key="text-mode"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                transition={{ duration: 0.1 }}
                className="w-full h-full flex flex-col items-center justify-center p-8 transition-[background] duration-500"
                style={{ background: BACKGROUNDS[bgIndex] }}
              >
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Quoi de neuf ?"
                  className="w-full bg-transparent text-white text-center text-3xl font-bold resize-none outline-none placeholder-white/60 drop-shadow-md"
                  style={{ fontFamily: FONTS[fontIndex] }}
                  maxLength={300}
                  autoFocus
                />

                <div className="absolute top-20 right-4 flex flex-col gap-3">
                  <button
                    onClick={() => setFontIndex((i) => (i + 1) % FONTS.length)}
                    className="w-10 h-10 rounded-full bg-black/20 flex items-center justify-center text-white border border-white/20 shadow-lg active:scale-90 transition"
                  >
                    <span className="font-serif text-lg font-bold">Aa</span>
                  </button>
                  <button
                    onClick={() => setBgIndex((i) => (i + 1) % BACKGROUNDS.length)}
                    className="w-10 h-10 rounded-full bg-black/20 flex items-center justify-center text-white border border-white/20 shadow-lg active:scale-90 transition"
                  >
                    <SwatchIcon className="w-5 h-5" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* --- MODE MÉDIA --- */}
            {mode === "media" && (
              <motion.div
                key="media-mode"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                transition={{ duration: 0.1 }}
                className="w-full h-full relative"
              >
                {preview ? (
                  <>
                    {/* Fond flouté */}
                    <div className="absolute inset-0 z-0">
                      {media.type.startsWith("image") ? (
                        <img src={preview} className="w-full h-full object-cover blur-2xl opacity-50 scale-110" alt="bg" />
                      ) : (
                        <video src={preview} className="w-full h-full object-cover blur-2xl opacity-50 scale-110" muted loop />
                      )}
                    </div>

                    {/* Média principal */}
                    <div className="relative z-10 w-full h-full flex items-center justify-center">
                      {media.type.startsWith("image") ? (
                        <img src={preview} alt="Preview" className="max-w-full max-h-full object-contain shadow-2xl" />
                      ) : (
                        <video
                          ref={videoRef}
                          src={preview}
                          className="max-w-full max-h-full object-contain shadow-2xl"
                          autoPlay
                          loop
                          playsInline
                          controls
                        />
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-4 opacity-50">
                    <SparklesIcon className="w-16 h-16 text-white animate-pulse" />
                    <p className="text-white font-medium">Ajoutez du contenu...</p>
                  </div>
                )}
              </motion.div>
            )}
          </div>

          {/* === FOOTER (BARRE D'ACTIONS) === */}
          <div className="bg-black/80 border-t border-white/10 pb-safe pt-3 px-4 relative z-40">

            {/* Vidéo Trimmer */}
            {mode === "media" && showTrimmer && (
              <div className="mb-4 px-2">
                <div className="flex justify-between text-[10px] text-gray-400 mb-1 font-mono">
                  <span>DÉBUT: {trimRange.start}s</span>
                  <span>FIN: {trimRange.end}s</span>
                </div>
                <input
                  type="range" min="0" max={videoDuration} step="1"
                  value={trimRange.start}
                  onChange={(e) => setTrimRange({ ...trimRange, start: parseFloat(e.target.value) })}
                  className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
                />
              </div>
            )}

            {/* Input Légende (Mode Média uniquement) */}
            {mode === "media" && (
              <div className="flex items-center gap-2 mb-4 bg-white/10 rounded-full p-1 pl-4 border border-white/5 transition-all focus-within:bg-white/20 focus-within:border-white/20">
                <input
                  type="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Ajouter une légende..."
                  className="flex-1 bg-transparent text-white text-sm outline-none placeholder-white/50"
                />
                <button
                  onClick={() => setShowEmoji(!showEmoji)}
                  className="p-2 hover:bg-white/10 rounded-full text-white/80 transition"
                >
                  <FaceSmileIcon className="w-5 h-5" />
                </button>
              </div>
            )}

            {showEmoji && (
              <EmojiPicker onSelect={(e) => { setText(p => p + e); setShowEmoji(false); }} />
            )}

            {/* Boutons Principaux */}
            <div className="flex items-center justify-between gap-4">

              <div className="flex gap-2 bg-white/5 p-1 rounded-2xl">
                <button
                  onClick={() => fileInput.current?.click()}
                  className={`flex flex-col items-center justify-center w-14 h-14 rounded-xl transition-all ${
                    mode === 'media' ? 'bg-white/20 text-white' : 'text-gray-500 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <PhotoIcon className="w-6 h-6" />
                  <span className="text-[9px] font-bold mt-0.5">Galerie</span>
                </button>
                <input ref={fileInput} type="file" accept="image/*,video/*" onChange={handleFile} className="hidden" />

                <button
                  onClick={() => { setMode("text"); setMedia(null); setPreview(null); }}
                  className={`flex flex-col items-center justify-center w-14 h-14 rounded-xl transition-all ${
                    mode === 'text' ? 'bg-white/20 text-white' : 'text-gray-500 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <PencilIcon className="w-6 h-6" />
                  <span className="text-[9px] font-bold mt-0.5">Texte</span>
                </button>
              </div>

              {/* Bouton PUBLIER */}
              <button
                onClick={publish}
                disabled={uploading || (!preview && mode === 'media') || (!text.trim() && mode === 'text')}
                className="flex-1 h-14 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center gap-2 text-white font-bold shadow-lg shadow-green-500/20 active:scale-95 disabled:opacity-50 disabled:active:scale-100 transition-all hover:brightness-110"
              >
                {uploading ? (
                  <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Partager</span>
                    <PaperAirplaneIcon className="w-5 h-5 -rotate-45 mb-1" />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Toast Notification */}
          <AnimatePresence>
            {toast && (
              <motion.div
                initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -50, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className={`absolute top-20 left-4 right-4 p-3 rounded-xl text-center font-bold text-sm shadow-xl z-50 ${
                  toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
                }`}
              >
                {toast.msg}
              </motion.div>
            )}
          </AnimatePresence>

        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}

export default StoryCreator;