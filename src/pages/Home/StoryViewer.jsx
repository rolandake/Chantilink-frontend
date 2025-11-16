// src/components/StoryViewer.jsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Eye, Smile, Trash2, Pause, MessageCircle, Type } from "lucide-react";
import { createPortal } from "react-dom";
import { useAuth } from "../../context/AuthContext";
import { useStories } from "../../context/StoryContext";
import { io } from "socket.io-client";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";
const MEDIA_URL = (p) => p?.startsWith("http") ? p : p ? `${API}/${p.replace(/^\/+/, "")}` : null;
const EMOJIS = ["❤️","😂","😮","😢","😍","🔥","👏","💯","🎉","😭","🥰","👀","💪","🙌","😎","🤩"];
const DURATION = 5000;
const SWIPE = 80;

const Toast = ({ msg, type = "success", onClose }) => (
  <motion.div
    initial={{ y: -50, opacity: 0 }}
    animate={{ y: 0, opacity: 1 }}
    exit={{ y: -50, opacity: 0 }}
    onClick={onClose}
    className={`fixed top-5 right-5 z-[99999] px-6 py-3 rounded-full shadow-2xl text-white font-bold cursor-pointer backdrop-blur-xl border border-white/20 ${
      type === "success" ? "bg-gradient-to-r from-emerald-500 to-teal-600" : "bg-gradient-to-r from-red-500 to-rose-600"
    }`}
  >
    {msg}
  </motion.div>
);

const ReactionModal = ({ onSelect, onClose, onDM, onText }) => createPortal(
  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[99998] flex items-center justify-center" onClick={onClose}>
    <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="bg-white dark:bg-gray-900 rounded-3xl p-8 shadow-3xl max-w-md w-full" onClick={e => e.stopPropagation()}>
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold">Réagir à la story</h3>
        <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full">
          <X className="w-5 h-5" />
        </button>
      </div>
      
      {/* Emojis */}
      <div className="mb-6">
        <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-3">Réactions rapides</p>
        <div className="grid grid-cols-4 gap-4">
          {EMOJIS.map(e => (
            <button key={e} onClick={() => { onSelect(e); onClose(); }} className="text-5xl hover:scale-125 transition-all duration-200 p-2">
              {e}
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-3">
        <button onClick={() => { onText(); onClose(); }} className="w-full flex items-center gap-4 p-4 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl transition-all hover:scale-105 shadow-lg">
          <Type className="w-6 h-6" />
          <div className="text-left flex-1">
            <p className="font-bold">Envoyer un message</p>
            <p className="text-xs text-blue-100">Répondre avec du texte</p>
          </div>
        </button>
        
        <button onClick={() => { onDM(); onClose(); }} className="w-full flex items-center gap-4 p-4 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-xl transition-all hover:scale-105 shadow-lg">
          <MessageCircle className="w-6 h-6" />
          <div className="text-left flex-1">
            <p className="font-bold">Envoyer un DM</p>
            <p className="text-xs text-purple-100">Message privé</p>
          </div>
        </button>
      </div>
    </motion.div>
  </motion.div>,
  document.body
);

const TextReplyModal = ({ onSend, onClose }) => {
  const [text, setText] = useState("");
  const handleSend = () => {
    if (text.trim()) {
      onSend(text);
      onClose();
    }
  };
  
  return createPortal(
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[99998] flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.9, y: 50 }} animate={{ scale: 1, y: 0 }} className="bg-white dark:bg-gray-900 rounded-3xl p-6 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold">Répondre à la story</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Écris ta réponse..."
          className="w-full h-32 p-4 border-2 border-gray-200 dark:border-gray-700 rounded-xl resize-none focus:border-blue-500 focus:outline-none dark:bg-gray-800"
          autoFocus
        />
        <button
          onClick={handleSend}
          disabled={!text.trim()}
          className="w-full mt-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-bold rounded-xl hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          Envoyer
        </button>
      </motion.div>
    </motion.div>,
    document.body
  );
};

const ViewersModal = ({ viewers = [], onClose }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const { token } = useAuth();

  useEffect(() => {
    if (!viewers.length) { setLoading(false); return; }
    const fetchAll = async () => {
      const ids = viewers.map(v => typeof v === "string" ? v : v._id).filter(Boolean);
      const res = await Promise.all(ids.map(id =>
        fetch(`${API}/api/users/${id}`, { headers: { Authorization: `Bearer ${token}` } })
          .then(r => r.ok ? r.json().then(d => d.user || d) : null)
          .catch(() => null)
      ));
      setData(res.filter(Boolean));
      setLoading(false);
    };
    fetchAll();
  }, [viewers, token]);

  return createPortal(
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[99998] flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-white dark:bg-gray-900 rounded-3xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-bold">Vues ({viewers.length})</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full"><X className="w-6 h-6" /></button>
        </div>
        {loading ? (
          <div className="space-y-3">{[...Array(3)].map((_,i)=>
            <div key={i} className="flex items-center gap-3 p-3 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse">
              <div className="w-12 h-12 rounded-full bg-gray-300 dark:bg-gray-700"/>
              <div className="flex-1"><div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-32 mb-2"/><div className="h-3 bg-gray-300 dark:bg-gray-700 rounded w-48"/></div>
            </div>
          )}</div>
        ) : data.length === 0 ? (
          <p className="text-center text-gray-500 py-12">Aucune vue</p>
        ) : (
          <div className="space-y-2">
            {data.map((v,i) => {
              const name = v.username || v.fullName || v.email?.split("@")[0] || "Anonyme";
              return (
                <motion.div key={v._id || i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i*0.05 }} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                  {v.profilePhoto ? (
                    <img src={MEDIA_URL(v.profilePhoto)} alt={name} className="w-12 h-12 rounded-full object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center text-white font-bold text-lg">
                      {name[0].toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="font-semibold">{name}</p>
                    {v.email && <p className="text-xs text-gray-500">{v.email}</p>}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>
    </motion.div>,
    document.body
  );
};

export default function StoryViewer({ stories = [], currentUser, onClose }) {
  const [storyIdx, setStoryIdx] = useState(0);
  const [slideIdx, setSlideIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showTextReply, setShowTextReply] = useState(false);
  const [showViewers, setShowViewers] = useState(false);
  const [reacts, setReacts] = useState({});
  const [toast, setToast] = useState(null);

  const socket = useRef(null);
  const interval = useRef(null);
  const touch = useRef({ x: 0, y: 0 });
  const { token, user } = useAuth();
  const { viewSlide, deleteSlide, fetchStories } = useStories();

  const story = useMemo(() => stories[storyIdx], [stories, storyIdx]);
  const slide = useMemo(() => story?.slides?.[slideIdx], [story, slideIdx]);
  const isOwner = currentUser?._id === story?.owner?._id || user?._id === story?.owner?._id;
  const total = story?.slides?.length || 0;

  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2200);
  }, []);

  // Socket
  useEffect(() => {
    if (!token || !story) return;
    socket.current = io(API, { auth: { token }, transports: ["websocket"] });
    socket.current.on("connect", () => socket.current.emit("joinStory", { storyId: story._id }));
    socket.current.on("reactionSent", () => showToast("Réaction envoyée !"));
    return () => socket.current?.disconnect();
  }, [token, story?._id, showToast]);

  // Mark viewed
  useEffect(() => {
    if (!slide || isOwner || slide.views?.some(v => (typeof v === "string" ? v : v._id) === user?._id)) return;
    viewSlide(story._id, slideIdx);
  }, [slide, isOwner, user?._id, viewSlide, story?._id, slideIdx]);

  // Progress
  useEffect(() => {
    if (isPaused || !slide) { clearInterval(interval.current); setProgress(0); return; }
    interval.current = setInterval(() => {
      setProgress(p => {
        if (p >= 100) { next(); return 0; }
        return p + (100 / (DURATION / 50));
      });
    }, 50);
    return () => clearInterval(interval.current);
  }, [slideIdx, isPaused, slide]);

  const next = useCallback(() => {
    if (slideIdx < total - 1) setSlideIdx(slideIdx + 1);
    else if (storyIdx < stories.length - 1) { setStoryIdx(storyIdx + 1); setSlideIdx(0); }
    else onClose?.();
    setProgress(0);
  }, [slideIdx, total, storyIdx, stories.length, onClose]);

  const prev = useCallback(() => {
    if (slideIdx > 0) setSlideIdx(slideIdx - 1);
    else if (storyIdx > 0) { setStoryIdx(storyIdx - 1); setSlideIdx(stories[storyIdx - 1].slides.length - 1); }
    setProgress(0);
  }, [slideIdx, storyIdx, stories]);

  const handleTouchStart = e => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
  const handleTouchEnd = e => {
    const dx = e.changedTouches[0].clientX - touch.current.x;
    const dy = e.changedTouches[0].clientY - touch.current.y;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > SWIPE) {
      dx > 0 ? prev() : next();
    }
  };

  const react = useCallback((emoji) => {
    if (!socket.current?.connected) return showToast("Connexion perdue", "error");
    socket.current.emit("storyReaction", { storyId: story._id, slideIndex: slideIdx, reaction: emoji });
    setReacts(r => ({ ...r, [slideIdx]: emoji }));
    showToast(`${emoji} envoyé !`);
    setIsPaused(false);
  }, [story?._id, slideIdx, showToast]);

  const sendTextReply = useCallback((text) => {
    if (!socket.current?.connected) return showToast("Connexion perdue", "error");
    socket.current.emit("storyReaction", { storyId: story._id, slideIndex: slideIdx, reaction: text, type: "text" });
    showToast("Message envoyé !");
    setIsPaused(false);
  }, [story?._id, slideIdx, showToast]);

  const openDM = useCallback(() => {
    showToast("Ouverture du DM...");
    setIsPaused(false);
    // Ici tu peux rediriger vers la messagerie ou ouvrir un modal de chat
    setTimeout(() => {
      window.location.href = `/messages/${story.owner._id}`;
    }, 500);
  }, [story?.owner._id, showToast]);

  const del = useCallback(async () => {
    if (!confirm("Supprimer cette slide ?")) return;
    const res = await deleteSlide(story._id, slideIdx);
    if (res.deleted) { showToast("Story supprimée"); setTimeout(onClose, 800); }
    else { showToast("Slide supprimée"); fetchStories(true); }
  }, [story?._id, slideIdx, deleteSlide, fetchStories, onClose, showToast]);

  const renderSlide = useCallback(() => {
    if (!slide) return null;

    if (slide.type === "text" || (!slide.media && slide.caption)) {
      return (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-orange-500 via-pink-500 to-purple-600 p-8">
          <p className="text-white font-bold text-center drop-shadow-2xl" style={{
            fontSize: slide.fontSize ? `${slide.fontSize}px` : "48px",
            textShadow: "3px 3px 12px rgba(0,0,0,0.9)"
          }}>
            {slide.caption || slide.text}
          </p>
        </div>
      );
    }

    const media = slide.type === "video" ? (
      <video src={MEDIA_URL(slide.media)} autoPlay loop muted playsInline className="max-w-full max-h-full object-contain" />
    ) : (
      <img src={MEDIA_URL(slide.media)} alt="" className="max-w-full max-h-full object-contain" />
    );

    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black">
        {media}
        {slide.caption && (
          <div className="absolute bottom-32 left-0 right-0 px-8">
            <p className="text-white text-xl font-bold text-center bg-black/60 backdrop-blur-md px-6 py-4 rounded-2xl">
              {slide.caption}
            </p>
          </div>
        )}
      </div>
    );
  }, [slide]);

  if (!story || !slide) return null;

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black z-[9999] flex items-center justify-center"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onClick={() => setIsPaused(true)}
    >
      <div className="relative w-full h-full max-w-md bg-black" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-50 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3 bg-black/50 backdrop-blur-lg px-4 py-2 rounded-full">
              {story.owner?.profilePhoto ? (
                <img src={MEDIA_URL(story.owner.profilePhoto)} alt={story.owner.username} className="w-10 h-10 rounded-full object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center text-white font-bold text-sm">
                  {(story.owner?.username || "?")[0].toUpperCase()}
                </div>
              )}
              <div>
                <p className="text-white font-bold text-sm">{story.owner?.username || "Anonyme"}</p>
                <p className="text-white/70 text-xs">
                  {new Date(slide.createdAt || Date.now()).toLocaleTimeString("fr", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={onClose} className="p-2 bg-black/50 backdrop-blur rounded-full hover:bg-black/70 transition">
                <X className="w-6 h-6 text-white" />
              </button>
              {isOwner && (
                <>
                  <button onClick={() => setShowViewers(true)} className="p-2 bg-black/50 backdrop-blur rounded-full relative hover:bg-black/70 transition">
                    <Eye className="w-6 h-6 text-white" />
                    {slide.views?.length > 0 && (
                      <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                        {slide.views.length}
                      </span>
                    )}
                  </button>
                  <button onClick={del} className="p-2 bg-red-600/80 backdrop-blur rounded-full hover:bg-red-700 transition">
                    <Trash2 className="w-6 h-6 text-white" />
                  </button>
                </>
              )}
            </div>
          </div>
          <div className="flex gap-1">
            {story.slides.map((_, i) => (
              <div key={i} className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-white"
                  animate={{ width: i < slideIdx ? "100%" : i === slideIdx ? `${progress}%` : "0%" }}
                  transition={{ duration: 0.1 }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        {renderSlide()}

        {/* Navigation zones */}
        <div className="absolute inset-0 flex">
          <button onClick={prev} className="flex-1 active:bg-white/10" />
          <button onClick={next} className="flex-1 active:bg-white/10" />
        </div>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 to-transparent z-40">
          <div className="flex justify-center">
            {isOwner ? (
              <div className="px-8 py-4 bg-white/20 backdrop-blur-xl rounded-full flex items-center gap-3 border border-white/30">
                <Eye className="w-7 h-7 text-white" />
                <span className="text-xl font-bold text-white">{slide.views?.length || 0} vue{slide.views?.length > 1 ? "s" : ""}</span>
              </div>
            ) : (
              <button onClick={() => { setIsPaused(true); setShowEmoji(true); }} className="px-10 py-5 bg-white/20 backdrop-blur-xl rounded-full flex items-center gap-4 hover:bg-white/30 transition-all hover:scale-105 border border-white/30">
                <Smile className="w-8 h-8 text-white" />
                <span className="text-2xl font-bold text-white">Réagir</span>
                {reacts[slideIdx] && <span className="text-5xl animate-bounce">{reacts[slideIdx]}</span>}
              </button>
            )}
          </div>
        </div>

        {/* Pause indicator */}
        {isPaused && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50">
            <div className="bg-black/70 backdrop-blur p-6 rounded-full">
              <Pause className="w-12 h-12 text-white" />
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
        {showEmoji && <ReactionModal onSelect={react} onText={() => { setShowEmoji(false); setShowTextReply(true); }} onDM={openDM} onClose={() => { setShowEmoji(false); setIsPaused(false); }} />}
        {showTextReply && <TextReplyModal onSend={sendTextReply} onClose={() => { setShowTextReply(false); setIsPaused(false); }} />}
        {showViewers && <ViewersModal viewers={slide.views || []} onClose={() => setShowViewers(false)} />}
      </AnimatePresence>
    </motion.div>,
    document.body
  );
}