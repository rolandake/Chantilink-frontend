// ============================================
// 📁 src/Pages/chat/MessageComponents.jsx
// FIXES:
//  - StandardMessage : file matching par regex fragile → utiliser mimeType/type
//  - Audio : <audio> sans contrôles accessibles, pas de fallback
//  - Image : pas de lightbox / onClick handler
//  - MissedCallMessage : icône absente, pas de différenciation audio/vidéo
//  - StoryReactionMessage : navigate utilisé sans vérification SSR/Expo
//  - fmt() importé mais jamais défini ici → doit venir de utils
//  - Aucun support du type "voice" (message vocal court)
//  - Aucun support du champ fileUrl / attachmentUrl (fallback)
// ============================================
import React, { useState } from "react";
import { motion } from "framer-motion";
import { Eye, Phone, Video, FileText, Download, Play } from "lucide-react";
import { useNavigate } from "react-router-dom";

// ─── Helper : horodatage ─────────────────────────────────────────────────────
export const fmt = (ts) => {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
};

// ─── Helper : résoudre l'URL du fichier ──────────────────────────────────────
// ✅ FIX: couvre tous les champs possibles envoyés par le backend
const resolveFileUrl = (message) =>
  message.file ||
  message.fileUrl ||
  message.url ||
  message.secure_url ||
  message.attachmentUrl ||
  message.mediaUrl ||
  message.audioUrl ||
  message.audio ||
  message.imageUrl ||
  message.image ||
  null;

// ─── Helper : détecter le type à partir de l'URL/mimeType ────────────────────
const detectDisplayType = (message) => {
  if (message.type === "audio" || message.type === "voice") return "audio";
  if (message.type === "image") return "image";
  if (message.type === "video") return "video";
  if (message.type === "missed-call") return "missed-call";
  if (message.type === "story_reaction") return "story-reaction";

  // ✅ FIX: fallback par mimeType
  if (message.mimeType) {
    if (message.mimeType.startsWith("audio/")) return "audio";
    if (message.mimeType.startsWith("image/")) return "image";
    if (message.mimeType.startsWith("video/")) return "video";
  }

  // ✅ FIX: fallback par extension d'URL (moins fiable mais utile)
  const url = resolveFileUrl(message);
  if (url) {
    if (/\.(jpg|jpeg|png|gif|webp|avif)(\?|$)/i.test(url)) return "image";
    if (/\.(mp3|wav|ogg|m4a|aac|webm)(\?|$)/i.test(url) && message.type !== "video") return "audio";
    if (/\.(mp4|mov|avi|mkv)(\?|$)/i.test(url)) return "video";
  }

  return message.type || "text";
};

// ─────────────────────────────────────────────────────────────────────────────
// StoryReactionMessage
// ─────────────────────────────────────────────────────────────────────────────
export const StoryReactionMessage = ({ message, isMine }) => {
  const navigate   = useNavigate();
  const metadata   = message.metadata || {};
  const emoji      = metadata.emoji        || "❤️";
  const reactorName =
    metadata.reactorName ||
    message.sender?.fullName ||
    message.sender?.username ||
    "Quelqu'un";
  const storyId    = metadata.storyId;
  const slideIndex = metadata.slideIndex ?? 0;
  const storyPreview = metadata.storyPreview;

  const handleClick = (e) => {
    e.stopPropagation();
    if (!storyId) return;
    navigate(`/stories/${storyId}?slide=${slideIndex}`);
  };

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      onClick={handleClick}
      className={`max-w-[70%] ${isMine ? "ml-auto" : ""} ${
        storyId ? "cursor-pointer" : "cursor-not-allowed opacity-70"
      } group`}
    >
      <div
        className={`p-4 rounded-2xl border-2 transition-all ${
          storyId ? "hover:scale-[1.02]" : ""
        } ${
          isMine
            ? "bg-gradient-to-r from-pink-500/20 to-purple-500/20 border-pink-500/30 hover:border-pink-500/50"
            : "bg-gradient-to-r from-orange-500/20 to-red-500/20 border-orange-500/30 hover:border-orange-500/50"
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`text-4xl transition-transform ${
              storyId
                ? "animate-bounce group-hover:scale-110"
                : ""
            }`}
          >
            {emoji}
          </div>
          {storyPreview && (
            <div className="w-12 h-12 rounded-lg overflow-hidden border-2 border-white/20 flex-shrink-0">
              <img
                src={storyPreview}
                alt="Aperçu de la story"
                className="w-full h-full object-cover"
                loading="lazy"
                onError={(e) => { e.target.style.display = "none"; }}
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm truncate">
              {isMine
                ? "Vous avez réagi à une story"
                : `${reactorName} a réagi à votre story`}
            </p>
            <p
              className={`text-xs mt-1 flex items-center gap-1 ${
                storyId ? "text-white/70" : "text-red-400"
              }`}
            >
              <Eye className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">
                {storyId
                  ? "Toucher pour voir la story"
                  : "Story expirée ou supprimée"}
              </span>
            </p>
          </div>
        </div>
        <div className="text-xs text-white/50 mt-2 text-right">{fmt(message.timestamp)}</div>
      </div>
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MissedCallMessage — ✅ FIX: icône + différenciation audio/vidéo
// ─────────────────────────────────────────────────────────────────────────────
export const MissedCallMessage = ({ message, isMine }) => {
  const callType   = message.metadata?.callType || message.callType || "audio";
  const isVideo    = callType === "video";
  const Icon       = isVideo ? Video : Phone;
  const labelMine  = `Appel ${isVideo ? "vidéo" : "audio"} sans réponse`;
  const labelOther = `Appel ${isVideo ? "vidéo" : "audio"} manqué`;

  return (
    <div className={`max-w-[70%] ${isMine ? "ml-auto" : ""}`}>
      <div
        className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm ${
          isMine
            ? "bg-orange-500/20 border border-orange-500/30 text-orange-300"
            : "bg-red-500/15 border border-red-500/25 text-red-300"
        }`}
      >
        <Icon size={14} className="flex-shrink-0 opacity-80" />
        <span className="italic">{isMine ? labelMine : labelOther}</span>
      </div>
      <p className="text-[10px] text-gray-600 mt-0.5 px-1 text-right">
        {fmt(message.timestamp)}
      </p>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// StandardMessage — ✅ FIX complet : image, audio, video, fichier, texte
// ─────────────────────────────────────────────────────────────────────────────
export const StandardMessage = ({ message, isMine, onClick }) => {
  const [imgExpanded, setImgExpanded] = useState(false);
  const fileUrl     = resolveFileUrl(message);
  const displayType = detectDisplayType(message);

  const bubbleClass = isMine
    ? "bg-gradient-to-br from-blue-600 to-indigo-600 text-white"
    : "bg-[#1e2229] text-gray-100 border border-white/5";

  return (
    <>
      <div
        onClick={onClick}
        className={`max-w-[75%] ${isMine ? "ml-auto" : ""}`}
      >
        <div className={`rounded-2xl overflow-hidden ${bubbleClass}`}>

          {/* ── IMAGE ── */}
          {displayType === "image" && fileUrl && (
            <div
              className="cursor-zoom-in"
              onClick={(e) => { e.stopPropagation(); setImgExpanded(true); }}
            >
              <img
                src={fileUrl}
                alt={message.fileName || "image"}
                className="max-w-full max-h-64 object-cover rounded-2xl"
                loading="lazy"
                onError={(e) => {
                  e.target.style.display = "none";
                  e.target.nextSibling && (e.target.nextSibling.style.display = "flex");
                }}
              />
              {/* fallback si image cassée */}
              <div
                className="hidden items-center gap-2 px-4 py-3 text-xs text-gray-400"
                style={{ display: "none" }}
              >
                <FileText size={14} /> Image non disponible
              </div>
            </div>
          )}

          {/* ── AUDIO / VOICE ── */}
          {(displayType === "audio") && fileUrl && (
            <div className="px-3 pt-3 pb-1">
              <audio
                controls
                src={fileUrl}
                className="w-full max-w-[260px] h-10 rounded-lg"
                preload="metadata"
                style={{ colorScheme: "dark" }}
              >
                Votre navigateur ne supporte pas l'audio.
              </audio>
            </div>
          )}

          {/* ── VIDÉO ── */}
          {displayType === "video" && fileUrl && (
            <div className="px-3 pt-3 pb-1">
              <video
                controls
                src={fileUrl}
                className="w-full max-w-[280px] rounded-xl"
                preload="metadata"
              >
                Votre navigateur ne supporte pas la vidéo.
              </video>
            </div>
          )}

          {/* ── FICHIER GÉNÉRIQUE ── */}
          {displayType === "file" && fileUrl && (
            <a
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              download={message.fileName || true}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors"
            >
              <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                <FileText size={18} className="text-blue-300" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">
                  {message.fileName || "Fichier"}
                </p>
                {message.fileSize && (
                  <p className="text-[11px] text-white/50">
                    {(message.fileSize / 1024 / 1024).toFixed(2)} Mo
                  </p>
                )}
              </div>
              <Download size={16} className="flex-shrink-0 opacity-60" />
            </a>
          )}

          {/* ── TEXTE ── */}
          {message.content && (
            <p
              className="break-words whitespace-pre-wrap px-3 py-2.5 text-sm leading-relaxed"
              style={{ overflowWrap: "anywhere" }}
            >
              {message.content}
            </p>
          )}

          {/* ── TIMESTAMP + STATUT ── */}
          <div className="flex items-center justify-end gap-1.5 px-3 pb-2 mt-0.5">
            <span className="text-[10px] opacity-60">{fmt(message.timestamp)}</span>
            {isMine && (
              <span className="text-[10px] opacity-60">
                {message.read ? "Vu" : message.status === "sending" ? "…" : "✓"}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── LIGHTBOX IMAGE ── */}
      {imgExpanded && fileUrl && (
        <div
          className="fixed inset-0 z-[500] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setImgExpanded(false)}
        >
          <img
            src={fileUrl}
            alt={message.fileName || "image"}
            className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
          />
          <button
            className="absolute top-4 right-4 text-white/70 hover:text-white text-2xl leading-none"
            onClick={() => setImgExpanded(false)}
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
};