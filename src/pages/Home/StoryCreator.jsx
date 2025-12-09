// ============================================
// 📁 src/pages/Home/StoryCreator.jsx - VERSION FINALE (TEXTE + MÉDIA + PRIVÉ)
// ============================================
import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { 
  XMarkIcon, PhotoIcon, PaperAirplaneIcon, 
  FaceSmileIcon, PencilIcon, SwatchIcon,
  GlobeAltIcon, LockClosedIcon 
} from "@heroicons/react/24/outline";
import { useStories } from "../../context/StoryContext";

// ⏱️ DURÉE MAX VIDÉO
const MAX_DURATION = 60;

// 🎨 PALETTE FONDS (Mode Texte)
const BACKGROUNDS = [
  "linear-gradient(135deg, #0099ff, #6610f2)", // Bleu
  "linear-gradient(135deg, #ff0055, #ffcc00)", // Rose/Jaune
  "linear-gradient(135deg, #00c6ff, #0072ff)", // Cyan
  "linear-gradient(135deg, #11998e, #38ef7d)", // Vert
  "linear-gradient(135deg, #fc466b, #3f5efb)", // Néon
  "linear-gradient(135deg, #232526, #414345)", // Gris
  "#000000", // Noir
  "#d92546"  // Rouge
];

// 🔡 POLICES
const FONTS = [
  "sans-serif",
  "serif",
  "monospace",
  "cursive",
  "fantasy"
];

// --- SOUS-COMPOSANT EMOJI ---
const EmojiPicker = ({ onSelect, onClose }) => {
  const emojis = ["😂", "❤️", "😍", "🔥", "😭", "🙏", "👍", "🥰", "🤔", "🎉", "💩", "👀", "✨", "💯", "🚀", "👋", "🤮", "😡", "🥳", "👻"];
  return (
    <div className="absolute bottom-16 left-4 bg-[#2a3942] rounded-xl shadow-xl p-2 w-64 grid grid-cols-5 gap-2 z-50 border border-[#3b4a54]">
      {emojis.map((e, i) => (
        <button key={i} onClick={() => onSelect(e)} className="text-2xl hover:bg-white/10 p-1 rounded transition">{e}</button>
      ))}
      <button onClick={onClose} className="col-span-5 text-center text-xs text-red-400 mt-1 hover:bg-white/5 py-1 rounded">Fermer</button>
    </div>
  );
};

// ============================================
// COMPOSANT PRINCIPAL
// ============================================
function StoryCreator({ onClose }) {
  // 1. STATES (Hooks toujours au début)
  // ----------------------------------------
  
  // Modes
  const [mode, setMode] = useState("media"); // 'media' ou 'text'
  const [visibility, setVisibility] = useState("public"); // 'public' ou 'private'

  // Contenu Média
  const [media, setMedia] = useState(null);
  const [preview, setPreview] = useState(null);
  
  // Contenu Texte (Sert de caption en mode média, ou de texte principal en mode texte)
  const [text, setText] = useState("");
  
  // Styles Mode Texte
  const [bgIndex, setBgIndex] = useState(0);
  const [fontIndex, setFontIndex] = useState(0);
  
  // Vidéo Trimming
  const [videoDuration, setVideoDuration] = useState(0);
  const [trimRange, setTrimRange] = useState({ start: 0, end: MAX_DURATION });
  const [showTrimmer, setShowTrimmer] = useState(false);
  
  // UI
  const [uploading, setUploading] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [toast, setToast] = useState(null);

  const fileInput = useRef(null);
  const videoRef = useRef(null);
  const { createStory, fetchStories } = useStories();

  // 2. EFFECTS
  // ----------------------------------------
  useEffect(() => {
    // Empêcher le scroll du body quand la modale est ouverte
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
      // Nettoyage URL
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  // 3. LOGIQUE
  // ----------------------------------------
  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const reset = () => {
    if (preview) URL.revokeObjectURL(preview);
    setMedia(null);
    setPreview(null);
    setText("");
    setMode("media");
    setTrimRange({ start: 0, end: MAX_DURATION });
    setShowTrimmer(false);
  };

  // Sélection Fichier (Photo/Vidéo)
  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 100 * 1024 * 1024) return showToast("Max 100 Mo", "error");

    setUploading(true);
    const url = URL.createObjectURL(file);
    
    if (file.type.startsWith("image")) {
      setMedia(file);
      setPreview(url);
      setMode("media");
      setShowTrimmer(false);
      setUploading(false);
    } else if (file.type.startsWith("video")) {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.src = url;
      video.onloadedmetadata = () => {
        const dur = video.duration;
        setVideoDuration(dur);
        // Sélectionne les 60 premières secondes par défaut
        setTrimRange({ start: 0, end: Math.min(MAX_DURATION, dur) });
        setMedia(file);
        setPreview(url);
        setMode("media");
        setShowTrimmer(dur > MAX_DURATION);
        setUploading(false);
      };
    }
  };

  // Basculer vers Mode Texte
  const switchToTextMode = () => {
    reset(); 
    setMode("text");
  };

  // Découpe Vidéo (Client-side)
  const trimVideo = (file, startTime, endTime) => new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.src = URL.createObjectURL(file);
    video.muted = true;
    video.currentTime = startTime;
    video.onseeked = () => {
      const stream = video.captureStream();
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' });
      const chunks = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        resolve(new File([blob], "story.webm", { type: 'video/webm' }));
      };
      recorder.start();
      video.play();
      setTimeout(() => { recorder.stop(); video.pause(); }, (endTime - startTime) * 1000);
    };
    video.onerror = reject;
  });

  // Envoi au serveur
  const publish = async () => {
    if (!text.trim() && !media) return showToast("La story est vide", "error");
    
    setUploading(true);
    try {
      const form = new FormData();
      
      // ✅ Envoi de la visibilité (Public ou Privé)
      form.append("visibility", visibility); 

      // CAS 1 : STORY TEXTE
      if (mode === "text") {
        form.append("type", "text");
        form.append("caption", text); // Texte principal
        form.append("background", BACKGROUNDS[bgIndex]);
        form.append("fontFamily", FONTS[fontIndex]);
      } 
      // CAS 2 : STORY MÉDIA
      else {
        let fileToUpload = media;
        // Si vidéo longue, on découpe
        if (media.type.startsWith("video") && (trimRange.start > 0 || trimRange.end < videoDuration)) {
          showToast("Traitement vidéo...", "info");
          fileToUpload = await trimVideo(media, trimRange.start, trimRange.end);
        }
        form.append("file", fileToUpload);
        form.append("type", fileToUpload.type.startsWith("image") ? "image" : "video");
        if (text.trim()) form.append("caption", text); // Légende optionnelle
      }

      await createStory(form);
      showToast("Story publiée !", "success");
      await fetchStories(true);
      setTimeout(() => onClose?.(), 1000);

    } catch (err) {
      console.error(err);
      showToast("Erreur publication", "error");
    } finally {
      setUploading(false);
    }
  };

  // 4. RENDER
  // ----------------------------------------
  return createPortal(
    <div className="fixed inset-0 bg-black/95 z-[9999] flex items-center justify-center sm:p-4">
      <div className="relative w-full h-full sm:h-[85vh] sm:max-w-md bg-[#111b21] sm:rounded-3xl overflow-hidden flex flex-col shadow-2xl border border-[#2a3942]">
        
        {/* === HEADER === */}
        <div className="flex items-center justify-between p-4 bg-[#202c33] z-20">
          <button onClick={onClose} disabled={uploading} className="p-2 hover:bg-[#2a3942] rounded-full transition">
            <XMarkIcon className="w-6 h-6 text-[#8696a0]" />
          </button>
          
          {/* ✅ SÉLECTEUR DE VISIBILITÉ */}
          <button 
            onClick={() => setVisibility(v => v === "public" ? "private" : "public")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition ${
              visibility === "public" 
                ? "bg-[#00a884]/20 text-[#00a884]" 
                : "bg-red-500/20 text-red-400"
            }`}
          >
            {visibility === "public" ? (
              <>
                <GlobeAltIcon className="w-3.5 h-3.5" />
                <span>Public</span>
              </>
            ) : (
              <>
                <LockClosedIcon className="w-3.5 h-3.5" />
                <span>Abonnés</span>
              </>
            )}
          </button>

          <button onClick={reset} disabled={uploading} className="text-[#00a884] font-medium text-sm hover:text-[#00c995] transition">
            Réinitialiser
          </button>
        </div>

        {/* === ZONE PRINCIPALE (PREVIEW) === */}
        <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
          
          {/* A. MODE TEXTE */}
          {mode === "text" && (
            <div 
              className="w-full h-full flex flex-col items-center justify-center p-8 transition-colors duration-500"
              style={{ background: BACKGROUNDS[bgIndex] }}
            >
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Tapez un statut..."
                className="w-full h-full bg-transparent text-white text-center text-3xl font-bold resize-none outline-none placeholder-white/50"
                style={{ fontFamily: FONTS[fontIndex] }}
                maxLength={300}
                autoFocus
              />
              
              {/* Outils Flottants */}
              <div className="absolute top-4 right-4 flex flex-col gap-4">
                <button 
                  onClick={() => setFontIndex((i) => (i + 1) % FONTS.length)}
                  className="w-10 h-10 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center text-white font-serif hover:bg-black/30 transition"
                  title="Changer Police"
                >
                  T
                </button>
                <button 
                  onClick={() => setBgIndex((i) => (i + 1) % BACKGROUNDS.length)}
                  className="w-10 h-10 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/30 transition"
                  title="Changer Couleur"
                >
                  <SwatchIcon className="w-6 h-6" />
                </button>
              </div>
            </div>
          )}

          {/* B. MODE MÉDIA */}
          {mode === "media" && (
            <>
              {preview ? (
                media.type.startsWith("image") ? (
                  <img src={preview} alt="Preview" className="w-full h-full object-contain" />
                ) : (
                  <video 
                    ref={videoRef}
                    src={preview} 
                    className="w-full h-full object-contain"
                    controls
                    onTimeUpdate={(e) => {
                       if (e.target.currentTime > trimRange.end) e.target.currentTime = trimRange.start;
                    }}
                  />
                )
              ) : (
                <div className="text-center p-6 text-[#8696a0]">
                  <PhotoIcon className="w-20 h-20 mx-auto mb-4 opacity-50" />
                  <p>Choisissez un média ou passez en mode texte</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* === BARRE D'OUTILS BAS === */}
        <div className="bg-[#111b21] border-t border-[#2a3942] relative z-20">
          
          {/* TRIMMER (Si Vidéo longue) */}
          {mode === "media" && showTrimmer && (
            <div className="p-3 border-b border-[#2a3942]">
              <div className="flex justify-between text-xs text-[#8696a0] mb-1">
                <span>Découpe</span>
                <span className="text-[#00a884]">{(trimRange.end - trimRange.start).toFixed(1)}s</span>
              </div>
              <input
                type="range"
                min="0" max={videoDuration - 1} step="1"
                value={trimRange.start}
                onChange={(e) => {
                  const s = parseFloat(e.target.value);
                  setTrimRange({ start: s, end: Math.min(s + MAX_DURATION, videoDuration) });
                  if(videoRef.current) videoRef.current.currentTime = s;
                }}
                className="w-full accent-[#00a884] h-2 bg-[#2a3942] rounded-lg cursor-pointer"
              />
            </div>
          )}

          {/* INPUT LÉGENDE (Mode Média uniquement) */}
          {mode === "media" && (
            <div className="p-3 flex items-center gap-2">
              <div className="relative">
                <button onClick={() => setShowEmoji(!showEmoji)} className="p-2 hover:bg-[#2a3942] rounded-full transition">
                  <FaceSmileIcon className="w-6 h-6 text-[#8696a0]" />
                </button>
                {showEmoji && <EmojiPicker onSelect={(e) => { setText(p => p + e); setShowEmoji(false); }} onClose={() => setShowEmoji(false)} />}
              </div>
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Ajouter une légende..."
                className="flex-1 bg-[#2a3942] text-white rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#00a884]"
              />
            </div>
          )}

          {/* BOUTONS ACTIONS */}
          <div className="p-3 flex items-center gap-3">
            {/* Bouton Média */}
            <button
              onClick={() => fileInput.current?.click()}
              className="flex-1 flex flex-col items-center justify-center p-2 rounded-xl hover:bg-[#2a3942] transition text-[#8696a0] hover:text-[#00a884]"
            >
              <PhotoIcon className="w-6 h-6" />
              <span className="text-xs font-medium mt-1">Média</span>
            </button>
            <input 
              ref={fileInput} 
              type="file" 
              accept="image/*,video/*" 
              onChange={handleFile} 
              className="hidden" 
            />

            {/* Bouton Texte */}
            <button
              onClick={switchToTextMode}
              className={`flex-1 flex flex-col items-center justify-center p-2 rounded-xl transition ${
                mode === "text" ? "bg-[#2a3942] text-[#00a884]" : "text-[#8696a0] hover:bg-[#2a3942]"
              }`}
            >
              <PencilIcon className="w-6 h-6" />
              <span className="text-xs font-medium mt-1">Texte</span>
            </button>

            {/* Bouton Envoyer */}
            <button 
              onClick={publish}
              disabled={uploading || (!preview && !text.trim())}
              className="bg-[#00a884] hover:bg-[#00c995] text-white p-3 rounded-full shadow-lg disabled:opacity-50 disabled:scale-100 transform hover:scale-110 transition ml-2 flex items-center justify-center"
            >
              {uploading ? (
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <PaperAirplaneIcon className="w-6 h-6 -rotate-45 ml-[-2px] mt-[1px]" />
              )}
            </button>
          </div>
        </div>

        {/* TOAST NOTIFICATION */}
        {toast && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur-md px-6 py-2 rounded-full text-white font-medium shadow-xl animate-bounce z-50">
            {toast.msg}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

export default StoryCreator;