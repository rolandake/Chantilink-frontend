// src/components/StoryCreator.jsx - VERSION AVEC VRAIE API
import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { XMarkIcon, PhotoIcon, CameraIcon, PaperAirplaneIcon, FaceSmileIcon, PencilIcon } from "@heroicons/react/24/outline";
import { useStories } from "../../context/StoryContext";

const MAX_DURATION = 15;

// Emoji Picker Component
function EmojiPicker({ onSelect, onClose }) {
  const emojis = [
    "😀", "😃", "😄", "😁", "😅", "😂", "🤣", "😊", "😇", "🙂",
    "🙃", "😉", "😌", "😍", "🥰", "😘", "😗", "😙", "😚", "😋",
    "😛", "😝", "😜", "🤪", "🤨", "🧐", "🤓", "😎", "🤩", "🥳",
    "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔",
    "❤️‍🔥", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "🎉", "🎊",
    "🎈", "🎁", "🏆", "🥇", "🌟", "⭐", "✨", "💫", "🔥", "💯",
    "👍", "👎", "👌", "✌️", "🤞", "🤟", "🤘", "👏", "🙌", "👐"
  ];

  return (
    <div className="absolute bottom-full left-0 mb-2 bg-[#2a3942] rounded-2xl shadow-2xl p-3 w-80 max-h-64 overflow-y-auto z-50">
      <div className="flex items-center justify-between mb-2 pb-2 border-b border-[#3b4a54]">
        <span className="text-white text-sm font-medium">Emojis</span>
        <button onClick={onClose} className="text-[#8696a0] hover:text-white">
          <XMarkIcon className="w-5 h-5" />
        </button>
      </div>
      <div className="grid grid-cols-8 gap-1">
        {emojis.map((emoji, i) => (
          <button key={i} onClick={() => onSelect(emoji)} className="text-2xl p-2 hover:bg-[#3b4a54] rounded-lg transition">
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

// Text Editor Component
function TextEditor({ text, onClose, onApply }) {
  const [localText, setLocalText] = useState(text);
  const [fontSize, setFontSize] = useState(32);
  const [textAlign, setTextAlign] = useState("center");
  const [fontFamily, setFontFamily] = useState("sans-serif");
  const [textColor, setTextColor] = useState("#ffffff");

  const colors = ["#ffffff", "#000000", "#ff0000", "#00ff00", "#0000ff", "#ffff00", "#ff00ff", "#00ffff"];

  return (
    <div className="fixed inset-0 bg-black/90 z-[100] flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-[#2a3942]">
        <button onClick={onClose} className="text-[#8696a0] hover:text-white">
          <XMarkIcon className="w-6 h-6" />
        </button>
        <span className="text-white font-medium">Éditeur de texte</span>
        <button 
          onClick={() => {
            onApply({ text: localText, fontSize, textAlign, fontFamily, textColor });
            onClose();
          }}
          className="text-[#00a884] font-medium hover:text-[#00c995]"
        >
          Appliquer
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 overflow-hidden">
        <textarea
          value={localText}
          onChange={(e) => setLocalText(e.target.value)}
          placeholder="Tapez votre texte..."
          className="w-full h-32 bg-transparent text-white text-center resize-none focus:outline-none"
          style={{ fontSize: `${fontSize}px`, textAlign, fontFamily, color: textColor }}
        />
      </div>

      <div className="p-4 space-y-4 bg-[#111b21] border-t border-[#2a3942] max-h-[40vh] overflow-y-auto">
        <div>
          <label className="text-[#8696a0] text-sm block mb-2">Taille: {fontSize}px</label>
          <input
            type="range"
            min="16"
            max="72"
            value={fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
            className="w-full h-2 bg-[#2a3942] rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#00a884]"
          />
        </div>

        <div>
          <label className="text-[#8696a0] text-sm block mb-2">Alignement</label>
          <div className="flex gap-2">
            {["left", "center", "right"].map((align) => (
              <button
                key={align}
                onClick={() => setTextAlign(align)}
                className={`flex-1 py-2 rounded-lg transition ${
                  textAlign === align ? "bg-[#00a884] text-white" : "bg-[#2a3942] text-[#8696a0]"
                }`}
              >
                {align === "left" ? "←" : align === "center" ? "↔" : "→"}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-[#8696a0] text-sm block mb-2">Couleur</label>
          <div className="flex gap-2 flex-wrap">
            {colors.map((color) => (
              <button
                key={color}
                onClick={() => setTextColor(color)}
                className={`w-10 h-10 rounded-full border-2 transition ${
                  textColor === color ? "border-[#00a884] scale-110" : "border-[#2a3942]"
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StoryCreator({ onClose, onSubmit }) {
  const [media, setMedia] = useState(null);
  const [preview, setPreview] = useState(null);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState(null);
  const [showTrimmer, setShowTrimmer] = useState(false);
  const [trimRange, setTrimRange] = useState({ start: 0, end: MAX_DURATION });
  const [videoDuration, setVideoDuration] = useState(0);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showTextEditor, setShowTextEditor] = useState(false);
  const [overlayText, setOverlayText] = useState(null);
  const fileInput = useRef();
  const videoRef = useRef();
  
  // ✅ Utiliser createStory du contexte
  const { createStory, fetchStories } = useStories();

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 100 * 1024 * 1024) return showToast("Max 100 Mo", "error");
    if (!["image/jpeg", "image/png", "video/mp4", "video/webm"].includes(file.type)) {
      return showToast("JPG, PNG ou MP4 uniquement", "error");
    }

    setUploading(true);
    showToast("Préparation...", "info");

    try {
      if (file.type.startsWith("image")) {
        const url = URL.createObjectURL(file);
        setMedia(file);
        setPreview(url);
        setShowTrimmer(false);
        showToast("Image chargée", "success");
      } else {
        const url = URL.createObjectURL(file);
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.src = url;
        
        video.onloadedmetadata = () => {
          const duration = Math.min(video.duration, 60);
          setVideoDuration(duration);
          setTrimRange({ start: 0, end: Math.min(MAX_DURATION, duration) });
          setMedia(file);
          setPreview(url);
          setShowTrimmer(duration > MAX_DURATION);
          showToast("Vidéo chargée", "success");
        };
      }
    } catch (err) {
      console.error("Erreur:", err);
      showToast("Erreur lors du chargement", "error");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const trimVideo = (file, startTime, endTime) => new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.src = URL.createObjectURL(file);
    video.muted = true;

    video.onloadedmetadata = () => {
      video.currentTime = startTime;
      
      video.onseeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');

        const stream = canvas.captureStream(30);
        const recorder = new MediaRecorder(stream, { 
          mimeType: 'video/webm',
          videoBitsPerSecond: 2500000
        });
        const chunks = [];

        recorder.ondataavailable = e => {
          if (e.data.size > 0) chunks.push(e.data);
        };
        
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'video/webm' });
          const trimmed = new File([blob], "story.webm", { type: 'video/webm' });
          URL.revokeObjectURL(video.src);
          video.pause();
          resolve(trimmed);
        };

        let startRecordTime = Date.now();
        const duration = (endTime - startTime) * 1000;

        const captureFrame = () => {
          const elapsed = Date.now() - startRecordTime;
          
          if (elapsed >= duration || video.currentTime >= endTime || video.ended) {
            recorder.stop();
            video.pause();
            return;
          }
          
          ctx.drawImage(video, 0, 0);
          requestAnimationFrame(captureFrame);
        };

        recorder.start();
        video.play().catch(err => {
          console.error("Play error:", err);
          reject(err);
        });
        captureFrame();

        setTimeout(() => {
          if (recorder.state === 'recording') {
            recorder.stop();
            video.pause();
          }
        }, duration + 1000);
      };
    };

    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      reject(new Error("Vidéo invalide"));
    };
  });

  const publish = async () => {
    if (!media && !caption.trim()) return showToast("Ajoute un média ou du texte", "error");

    setUploading(true);
    
    try {
      const form = new FormData();

      // ═══ STORY TEXTE SEUL ═══
      if (!media && caption.trim()) {
        console.log('📝 [StoryCreator] Creating text story');
        form.append("caption", caption);
        form.append("type", "text");
        
        if (overlayText) {
          form.append("fontSize", overlayText.fontSize);
          form.append("textAlign", overlayText.textAlign);
          form.append("fontFamily", overlayText.fontFamily);
          form.append("textColor", overlayText.textColor);
        }
      } 
      // ═══ STORY AVEC MÉDIA ═══
      else {
        let fileToUpload = media;
        
        // Découper la vidéo si nécessaire
        if (media.type.startsWith("video") && (trimRange.start > 0 || trimRange.end < videoDuration)) {
          showToast("Découpe en cours...", "info");
          fileToUpload = await trimVideo(media, trimRange.start, trimRange.end);
          showToast("Vidéo découpée !", "success");
        }

        console.log('📤 [StoryCreator] Uploading media story:', {
          type: fileToUpload.type,
          size: (fileToUpload.size / 1024 / 1024).toFixed(2) + ' MB',
          caption: caption || 'none'
        });

        form.append("file", fileToUpload);
        form.append("type", fileToUpload.type.startsWith("image") ? "image" : "video");
        
        if (caption.trim()) {
          form.append("caption", caption);
        }

        // Ajouter les paramètres de texte overlay si présents
        if (overlayText) {
          form.append("overlayText", overlayText.text);
          form.append("fontSize", overlayText.fontSize);
          form.append("textAlign", overlayText.textAlign);
          form.append("fontFamily", overlayText.fontFamily);
          form.append("textColor", overlayText.textColor);
        }
      }

      // ✅ APPEL API RÉEL
      showToast("Publication...", "info");
      const result = await createStory(form);
      
      console.log('✅ [StoryCreator] Story created:', result);
      showToast("Story publiée !", "success");
      
      // ✅ Forcer le refresh
      await fetchStories(true);
      
      // Attendre un peu avant de fermer pour que l'utilisateur voie le succès
      setTimeout(() => {
        reset();
        onClose?.();
      }, 1000);
      
    } catch (err) {
      console.error("❌ [StoryCreator] Publish error:", err);
      showToast(err.message || "Échec de la publication", "error");
    } finally {
      setUploading(false);
    }
  };

  const reset = () => {
    if (preview) URL.revokeObjectURL(preview);
    setMedia(null);
    setPreview(null);
    setCaption("");
    setShowTrimmer(false);
    setTrimRange({ start: 0, end: MAX_DURATION });
    setVideoDuration(0);
    setOverlayText(null);
    setShowEmojiPicker(false);
    setShowTextEditor(false);
  };

  useEffect(() => {
    const originalBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    
    const mainElement = document.querySelector('main');
    const originalMainOverflow = mainElement?.style.overflow;
    if (mainElement) {
      mainElement.style.overflow = 'hidden';
    }
    
    return () => {
      document.body.style.overflow = originalBodyOverflow;
      if (mainElement) {
        mainElement.style.overflow = originalMainOverflow || '';
      }
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  return createPortal(
    <div className="fixed inset-0 bg-black/95 z-[99999] flex items-center justify-center p-0 sm:p-4 overflow-hidden">
      <div 
        className="absolute inset-0"
        onClick={(e) => {
          if (e.target === e.currentTarget && !uploading) {
            onClose?.();
          }
        }}
      />

      <div className="relative w-full h-full sm:h-auto sm:max-w-md bg-[#111b21] sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col sm:max-h-[95vh]">
        {/* HEADER */}
        <div className="flex items-center justify-between p-4 bg-[#202c33] border-b border-[#2a3942] flex-shrink-0">
          <button 
            onClick={() => !uploading && onClose?.()} 
            disabled={uploading}
            type="button"
            className="p-2 hover:bg-[#2a3942] rounded-full transition disabled:opacity-50"
          >
            <XMarkIcon className="w-6 h-6 text-[#8696a0]" />
          </button>
          <h3 className="text-white font-semibold">Créer une Story</h3>
          <button 
            onClick={reset} 
            disabled={uploading || (!media && !caption.trim())}
            type="button"
            className="text-sm text-[#00a884] font-medium hover:text-[#00c995] transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Réinitialiser
          </button>
        </div>

        {/* SCROLLABLE CONTENT */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {/* PREVIEW */}
          <div className="relative bg-black">
            {preview || caption.trim() ? (
              <div className="w-full h-[45vh] sm:h-[450px] flex items-center justify-center bg-black relative overflow-hidden">
                {preview ? (
                  media.type.startsWith("image") ? (
                    <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <video 
                      ref={videoRef}
                      src={preview} 
                      controls 
                      className="w-full h-full object-cover"
                      onLoadedMetadata={(e) => {
                        if (videoDuration === 0) {
                          const duration = Math.min(e.target.duration, 60);
                          setVideoDuration(duration);
                          setTrimRange({ start: 0, end: Math.min(MAX_DURATION, duration) });
                        }
                      }}
                    />
                  )
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-orange-500 via-pink-500 to-purple-600" />
                )}
                
                {(overlayText || (!preview && caption.trim())) && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-6">
                    <div
                      className="max-w-full text-center break-words"
                      style={{
                        fontSize: overlayText ? `${overlayText.fontSize}px` : '32px',
                        textAlign: overlayText ? overlayText.textAlign : 'center',
                        fontFamily: overlayText ? overlayText.fontFamily : 'sans-serif',
                        color: overlayText ? overlayText.textColor : '#ffffff',
                        textShadow: '2px 2px 8px rgba(0,0,0,0.9)',
                        fontWeight: 'bold'
                      }}
                    >
                      {overlayText ? overlayText.text : caption}
                    </div>
                  </div>
                )}

                {(preview || caption.trim()) && (
                  <button
                    onClick={reset}
                    type="button"
                    className="absolute top-3 right-3 bg-black/50 backdrop-blur-sm p-2 rounded-full hover:bg-black/70 transition z-10"
                  >
                    <XMarkIcon className="w-5 h-5 text-white" />
                  </button>
                )}
              </div>
            ) : (
              <div className="w-full h-[45vh] sm:h-[450px] flex items-center justify-center bg-gradient-to-b from-[#1a2730] to-[#111b21]">
                <div className="text-center px-6">
                  <div className="bg-[#2a3942] w-20 h-20 rounded-2xl flex items-center justify-center mb-4 mx-auto">
                    <CameraIcon className="w-10 h-10 text-[#8696a0]" />
                  </div>
                  <p className="text-[#8696a0] text-base mb-2">Aucun média sélectionné</p>
                  <p className="text-[#8696a0]/60 text-sm">Appuyez sur + pour ajouter</p>
                </div>
              </div>
            )}
          </div>

          {/* VIDEO TRIMMER */}
          {showTrimmer && preview && media?.type.startsWith("video") && (
            <div className="p-4 bg-[#202c33] border-t border-[#2a3942]">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[#8696a0] text-sm font-medium">Découpe vidéo (max 15s)</span>
                <span className="text-[#00a884] text-sm font-bold">
                  {(trimRange.end - trimRange.start).toFixed(1)}s
                </span>
              </div>
              
              <div className="relative">
                <div className="relative h-12 bg-[#111b21] rounded-lg overflow-hidden mb-3">
                  <div 
                    className="absolute top-0 h-full bg-[#00a884]/30 border-l-2 border-r-2 border-[#00a884]"
                    style={{
                      left: `${(trimRange.start / videoDuration) * 100}%`,
                      width: `${((trimRange.end - trimRange.start) / videoDuration) * 100}%`
                    }}
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-[#8696a0] text-xs w-14">Début</span>
                    <input
                      type="range"
                      min="0"
                      max={Math.max(0, videoDuration - 1)}
                      step="0.1"
                      value={trimRange.start}
                      onChange={(e) => {
                        const start = parseFloat(e.target.value);
                        const maxEnd = Math.min(start + MAX_DURATION, videoDuration);
                        setTrimRange({
                          start,
                          end: Math.max(start + 1, Math.min(trimRange.end, maxEnd))
                        });
                        if (videoRef.current) {
                          videoRef.current.currentTime = start;
                        }
                      }}
                      className="flex-1 h-2 bg-[#2a3942] rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#00a884]"
                    />
                    <span className="text-white text-xs w-14 text-right font-mono">
                      {trimRange.start.toFixed(1)}s
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-[#8696a0] text-xs w-14">Fin</span>
                    <input
                      type="range"
                      min={trimRange.start + 1}
                      max={videoDuration}
                      step="0.1"
                      value={trimRange.end}
                      onChange={(e) => {
                        const end = parseFloat(e.target.value);
                        const minStart = Math.max(0, end - MAX_DURATION);
                        setTrimRange({
                          start: Math.max(minStart, trimRange.start),
                          end
                        });
                        if (videoRef.current) {
                          videoRef.current.currentTime = end;
                        }
                      }}
                      className="flex-1 h-2 bg-[#2a3942] rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#00a884]"
                    />
                    <span className="text-white text-xs w-14 text-right font-mono">
                      {trimRange.end.toFixed(1)}s
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* INPUT CAPTION */}
          <div className="p-4 bg-[#111b21] border-t border-[#2a3942] relative">
            <div className="flex items-center gap-2">
              <div className="relative">
                <button 
                  type="button"
                  className="p-2 hover:bg-[#2a3942] rounded-full transition flex-shrink-0"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                >
                  <FaceSmileIcon className="w-6 h-6 text-[#8696a0]" />
                </button>
                {showEmojiPicker && (
                  <EmojiPicker
                    onSelect={(emoji) => {
                      setCaption(caption + emoji);
                      setShowEmojiPicker(false);
                    }}
                    onClose={() => setShowEmojiPicker(false)}
                  />
                )}
              </div>
              <input
                type="text"
                value={caption}
                onChange={e => setCaption(e.target.value)}
                placeholder="Ajouter un texte..."
                maxLength={200}
                disabled={uploading}
                className="flex-1 bg-[#2a3942] text-white placeholder-[#8696a0] px-4 py-3 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#00a884] disabled:opacity-50 text-sm"
              />
              <button 
                type="button"
                className="p-2 hover:bg-[#2a3942] rounded-full transition flex-shrink-0 disabled:opacity-50"
                onClick={() => setShowTextEditor(true)}
                disabled={uploading || !preview}
              >
                <PencilIcon className="w-6 h-6 text-[#8696a0]" />
              </button>
              
              <button
                type="button"
                onClick={publish}
                disabled={(!preview && !caption.trim()) || uploading}
                className="bg-gradient-to-r from-[#00a884] to-[#00c995] p-3 rounded-full hover:from-[#00c995] hover:to-[#00d9a5] transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-lg flex-shrink-0"
              >
                {uploading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <PaperAirplaneIcon className="w-5 h-5 text-white -rotate-45" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="p-3 bg-[#111b21] flex items-center justify-between gap-2 border-t border-[#2a3942] flex-shrink-0">
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,video/mp4,video/webm"
            onChange={handleFile}
            className="hidden"
          />
          
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={uploading}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-[#2a3942] hover:bg-[#3b4a54] rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed text-[#00a884] font-medium text-sm"
          >
            <PhotoIcon className="w-5 h-5" />
            <span>Média</span>
          </button>

          <button
            type="button"
            onClick={() => !uploading && onClose?.()}
            disabled={uploading}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-red-500/10 hover:bg-red-500/20 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed text-red-500 font-medium border border-red-500/30 text-sm"
          >
            <XMarkIcon className="w-5 h-5" />
            <span>Fermer</span>
          </button>
        </div>

        {/* TEXT EDITOR OVERLAY */}
        {showTextEditor && preview && (
          <TextEditor
            text={overlayText?.text || caption}
            onClose={() => setShowTextEditor(false)}
            onApply={(textData) => {
              setOverlayText(textData);
              showToast("Texte ajouté !", "success");
            }}
          />
        )}

        {/* TOAST */}
        {toast && (
          <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[10000] animate-[slideDown_0.3s_ease-out]">
            <div className={`px-6 py-3 rounded-full text-white font-medium shadow-2xl backdrop-blur-xl ${
              toast.type === "success" ? "bg-gradient-to-r from-emerald-500 to-green-600" :
              toast.type === "error" ? "bg-gradient-to-r from-red-500 to-rose-600" : 
              "bg-gradient-to-r from-blue-500 to-cyan-600"
            }`}>
              {toast.msg}
            </div>
          </div>
        )}

        <style>{`
          @keyframes slideDown {
            from {
              opacity: 0;
              transform: translate(-50%, -20px) scale(0.9);
            }
            to {
              opacity: 1;
              transform: translate(-50%, 0) scale(1);
            }
          }
        `}</style>
      </div>
    </div>,
    document.body
  );
}

export default StoryCreator;