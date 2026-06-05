import React, { useMemo, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  CheckCheck,
  Download,
  Clock,
  PhoneMissed,
  Image as ImageIcon,
  Play,
  Pause,
  Video as VideoIcon,
  X,
  ZoomIn,
  Shield,
  Download as DownloadIcon,
  Trash2,
  MoreVertical
} from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";
import { fr } from "date-fns/locale";
import { getMessageUrl } from "../../../utils/messageUrlUtils";
import { localMediaStorage } from "../../../utils/LocalMediaStorage";
const detectFileType = (msg) => {
  if (msg.type === "missed-call" || msg.type === "system" || msg.type === "story_reaction") {
    return msg.type;
  }
  const url = getMessageUrl(msg);
  if (!url) return "text";
  if (["image", "video", "audio", "file"].includes(msg.type) && url) {
    return msg.type;
  }
  const urlLower = url.toLowerCase();
  if (urlLower.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i)) return "image";
  if (urlLower.match(/\.(mp4|mov|webm|avi|mkv)(\?|$)/i)) return "video";
  if (urlLower.match(/\.(mp3|wav|m4a|ogg|aac|webm)(\?|$)/i)) return "audio";
  if (urlLower.match(/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|zip|rar)(\?|$)/i)) return "file";
  if (urlLower.includes("/image/upload")) return "image";
  if (urlLower.includes("/video/upload")) return "video";
  return url ? "file" : "text";
};
const formatFileSize = (bytes) => {
  if (!bytes) return "";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1048576).toFixed(1) + " MB";
};
const formatDuration = (seconds) => {
  if (!seconds) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};
const useLocalMedia = (messageId, remoteUrl, type, metadata = {}) => {
  const [localUrl, setLocalUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  useEffect(() => {
    let isMounted = true;
    const loadMedia = async () => {
      if (!remoteUrl) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const localMedia = await localMediaStorage.getMedia(messageId);
        if (localMedia && isMounted) {
          setLocalUrl(localMedia.url);
          setLoading(false);
          return;
        }
        setProgress(50);
        const downloaded = await localMediaStorage.downloadAndSave(
          messageId,
          remoteUrl,
          { ...metadata, type }
        );
        if (isMounted && downloaded) {
          setLocalUrl(downloaded.url);
        }
      } catch (err) {
        console.error("\u274C [Media] Erreur:", err);
        if (isMounted) {
          setError(err.message);
          setLocalUrl(remoteUrl);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
          setProgress(100);
        }
      }
    };
    loadMedia();
    return () => {
      isMounted = false;
    };
  }, [messageId, remoteUrl, type]);
  return { localUrl, loading, progress, error };
};
const DeleteConfirmModal = ({ onConfirm, onCancel }) => /* @__PURE__ */ React.createElement(
  motion.div,
  {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    className: "fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4",
    onClick: onCancel
  },
  /* @__PURE__ */ React.createElement(
    motion.div,
    {
      initial: { scale: 0.9, opacity: 0 },
      animate: { scale: 1, opacity: 1 },
      exit: { scale: 0.9, opacity: 0 },
      className: "bg-[#1c2026] rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-white/10",
      onClick: (e) => e.stopPropagation()
    },
    /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-3 mb-4" }, /* @__PURE__ */ React.createElement("div", { className: "p-3 bg-red-500/20 rounded-full" }, /* @__PURE__ */ React.createElement(Trash2, { size: 24, className: "text-red-400" })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h3", { className: "text-lg font-bold text-white" }, "Supprimer le message ?"), /* @__PURE__ */ React.createElement("p", { className: "text-sm text-gray-400" }, "Cette action est irr\xE9versible"))),
    /* @__PURE__ */ React.createElement("div", { className: "flex gap-3 mt-6" }, /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: onCancel,
        className: "flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl font-medium transition-colors"
      },
      "Annuler"
    ), /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: onConfirm,
        className: "flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 rounded-xl font-medium transition-colors"
      },
      "Supprimer"
    ))
  )
);
const MessageContextMenu = ({ isMe, onDelete, onClose }) => /* @__PURE__ */ React.createElement(
  motion.div,
  {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
    className: "absolute right-0 top-8 bg-[#1c2026] rounded-lg shadow-2xl border border-white/10 overflow-hidden z-20 min-w-[160px]"
  },
  /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: onDelete,
      className: "w-full flex items-center gap-3 px-4 py-3 hover:bg-red-500/10 transition-colors text-left"
    },
    /* @__PURE__ */ React.createElement(Trash2, { size: 16, className: "text-red-400" }),
    /* @__PURE__ */ React.createElement("span", { className: "text-sm font-medium text-red-400" }, "Supprimer ", isMe ? "pour moi" : "")
  )
);
const ImagePreviewModal = ({ src, onClose }) => /* @__PURE__ */ React.createElement(
  motion.div,
  {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    className: "fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4",
    onClick: onClose
  },
  /* @__PURE__ */ React.createElement("button", { onClick: onClose, className: "absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full" }, /* @__PURE__ */ React.createElement(X, { size: 24, className: "text-white" })),
  /* @__PURE__ */ React.createElement("img", { src, alt: "Preview", className: "max-w-full max-h-full object-contain rounded-lg", onClick: (e) => e.stopPropagation() })
);
const ImageMessage = React.memo(({ messageId, remoteUrl, isMe, metadata }) => {
  const { localUrl, loading } = useLocalMedia(messageId, remoteUrl, "image", metadata);
  const [showPreview, setShowPreview] = useState(false);
  const [loaded, setLoaded] = useState(false);
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "relative group cursor-pointer overflow-hidden rounded-lg my-1 max-w-xs", onClick: () => localUrl && setShowPreview(true) }, (!loaded || loading) && /* @__PURE__ */ React.createElement("div", { className: "absolute inset-0 bg-gray-800 animate-pulse rounded-lg flex items-center justify-center min-h-[200px]" }, /* @__PURE__ */ React.createElement("div", { className: "text-center" }, /* @__PURE__ */ React.createElement(ImageIcon, { size: 32, className: "text-gray-600 mx-auto mb-2" }), loading && /* @__PURE__ */ React.createElement("p", { className: "text-xs text-gray-500" }, "T\xE9l\xE9chargement..."))), localUrl && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(
    "img",
    {
      src: localUrl,
      alt: "Image",
      className: `w-full h-auto max-h-80 object-cover rounded-lg transition-all ${loaded ? "opacity-100" : "opacity-0"} ${isMe ? "group-hover:brightness-90" : "group-hover:brightness-110"}`,
      loading: "lazy",
      onLoad: () => setLoaded(true),
      onError: (e) => {
        e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect fill="%23333"/><text x="50%" y="50%" text-anchor="middle" fill="%23666">Image indisponible</text></svg>';
        setLoaded(true);
      }
    }
  ), /* @__PURE__ */ React.createElement("div", { className: "absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center transition-all" }, /* @__PURE__ */ React.createElement(ZoomIn, { size: 32, className: "text-white opacity-0 group-hover:opacity-100" })))), showPreview && localUrl && /* @__PURE__ */ React.createElement(ImagePreviewModal, { src: localUrl, onClose: () => setShowPreview(false) }));
});
const VideoMessage = React.memo(({ messageId, remoteUrl, metadata }) => {
  const { localUrl, loading } = useLocalMedia(messageId, remoteUrl, "video", metadata);
  const [loaded, setLoaded] = useState(false);
  return /* @__PURE__ */ React.createElement("div", { className: "relative rounded-lg overflow-hidden bg-black my-1 max-w-xs" }, (!loaded || loading) && /* @__PURE__ */ React.createElement("div", { className: "absolute inset-0 bg-gray-800 animate-pulse flex items-center justify-center min-h-[200px]" }, /* @__PURE__ */ React.createElement("div", { className: "text-center" }, /* @__PURE__ */ React.createElement(VideoIcon, { size: 32, className: "text-gray-600 mx-auto mb-2" }), loading && /* @__PURE__ */ React.createElement("p", { className: "text-xs text-gray-500" }, "T\xE9l\xE9chargement..."))), localUrl && /* @__PURE__ */ React.createElement(
    "video",
    {
      controls: true,
      playsInline: true,
      preload: "metadata",
      className: `w-full max-h-80 transition-opacity ${loaded ? "opacity-100" : "opacity-0"}`,
      onLoadedMetadata: () => setLoaded(true)
    },
    /* @__PURE__ */ React.createElement("source", { src: localUrl, type: "video/mp4" }),
    /* @__PURE__ */ React.createElement("source", { src: localUrl, type: "video/webm" })
  ));
});
const AudioMessage = React.memo(({ messageId, remoteUrl, isMe, metadata }) => {
  const { localUrl, loading } = useLocalMedia(messageId, remoteUrl, "audio", metadata);
  const [audio, setAudio] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  useEffect(() => {
    if (localUrl && !audio) {
      const newAudio = new Audio(localUrl);
      setAudio(newAudio);
    }
  }, [localUrl, audio]);
  useEffect(() => {
    if (!audio) return;
    const handleMeta = () => setDuration(audio.duration);
    const handleTime = () => setCurrentTime(audio.currentTime);
    const handleEnd = () => setPlaying(false);
    audio.addEventListener("loadedmetadata", handleMeta);
    audio.addEventListener("timeupdate", handleTime);
    audio.addEventListener("ended", handleEnd);
    return () => {
      audio.removeEventListener("loadedmetadata", handleMeta);
      audio.removeEventListener("timeupdate", handleTime);
      audio.removeEventListener("ended", handleEnd);
      audio.pause();
    };
  }, [audio]);
  const togglePlay = () => {
    if (!audio) return;
    if (playing) audio.pause();
    else audio.play();
    setPlaying(!playing);
  };
  const progress = duration > 0 ? currentTime / duration * 100 : 0;
  if (loading || !localUrl) {
    return /* @__PURE__ */ React.createElement("div", { className: `flex items-center gap-3 p-3 rounded-lg my-1 min-w-[260px] max-w-xs ${isMe ? "bg-white/5" : "bg-[#1c2026]"}` }, /* @__PURE__ */ React.createElement("div", { className: "w-10 h-10 rounded-full bg-gray-700 animate-pulse flex items-center justify-center" }, /* @__PURE__ */ React.createElement(DownloadIcon, { size: 16, className: "text-gray-500" })), /* @__PURE__ */ React.createElement("div", { className: "flex-1" }, /* @__PURE__ */ React.createElement("div", { className: "h-6 bg-gray-700 rounded animate-pulse" }), /* @__PURE__ */ React.createElement("p", { className: "text-xs text-gray-500 mt-1" }, "T\xE9l\xE9chargement...")));
  }
  return /* @__PURE__ */ React.createElement("div", { className: `flex items-center gap-3 p-3 rounded-lg my-1 min-w-[260px] max-w-xs ${isMe ? "bg-white/5" : "bg-[#1c2026]"}` }, /* @__PURE__ */ React.createElement("button", { onClick: togglePlay, className: `p-2.5 rounded-full ${isMe ? "bg-blue-500" : "bg-green-500"}` }, playing ? /* @__PURE__ */ React.createElement(Pause, { size: 18, className: "text-white", fill: "white" }) : /* @__PURE__ */ React.createElement(Play, { size: 18, className: "text-white ml-0.5", fill: "white" })), /* @__PURE__ */ React.createElement("div", { className: "flex-1" }, /* @__PURE__ */ React.createElement("div", { className: "h-8 flex items-center" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-0.5 h-full" }, [...Array(30)].map((_, i) => /* @__PURE__ */ React.createElement("div", { key: i, className: `w-1 rounded-full ${i / 30 * 100 < progress ? isMe ? "bg-blue-400" : "bg-green-400" : "bg-gray-600"}`, style: { height: `${20 + Math.random() * 60}%` } })))), /* @__PURE__ */ React.createElement("span", { className: "text-xs text-gray-400" }, formatDuration(playing ? currentTime : duration))));
});
const FileMessage = React.memo(({ messageId, remoteUrl, name, size, isMe, metadata }) => {
  const { localUrl, loading } = useLocalMedia(messageId, remoteUrl, "file", metadata);
  const fileName = name || "Document";
  const ext = fileName.split(".").pop().toUpperCase();
  const icon = ["PDF", "DOC", "DOCX", "TXT"].includes(ext) ? "\u{1F4C4}" : ["XLS", "XLSX", "CSV"].includes(ext) ? "\u{1F4CA}" : ["ZIP", "RAR", "7Z"].includes(ext) ? "\u{1F4E6}" : "\u{1F4CE}";
  return /* @__PURE__ */ React.createElement(
    "a",
    {
      href: localUrl || remoteUrl || "#",
      download: fileName,
      target: "_blank",
      rel: "noopener noreferrer",
      className: `flex items-center gap-3 p-3 rounded-lg my-1 max-w-xs ${isMe ? "bg-white/5 hover:bg-white/10" : "bg-[#1c2026] hover:bg-[#252a33]"} ${loading ? "opacity-50" : ""}`
    },
    /* @__PURE__ */ React.createElement("div", { className: "text-3xl" }, icon),
    /* @__PURE__ */ React.createElement("div", { className: "flex-1 min-w-0" }, /* @__PURE__ */ React.createElement("p", { className: "text-sm font-semibold truncate text-gray-200" }, fileName), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2 mt-0.5" }, /* @__PURE__ */ React.createElement("span", { className: "text-xs text-gray-500 uppercase font-bold" }, ext), size && /* @__PURE__ */ React.createElement("span", { className: "text-xs text-gray-500" }, "\u2022 ", formatFileSize(size)), loading && /* @__PURE__ */ React.createElement("span", { className: "text-xs text-blue-500" }, "\u2022 T\xE9l\xE9chargement..."))),
    /* @__PURE__ */ React.createElement(Download, { size: 18, className: "text-gray-400" })
  );
});
const DateSeparator = React.memo(({ date }) => {
  let label = format(new Date(date), "dd MMMM yyyy", { locale: fr });
  if (isToday(new Date(date))) label = "Aujourd'hui";
  if (isYesterday(new Date(date))) label = "Hier";
  return /* @__PURE__ */ React.createElement("div", { className: "flex justify-center my-4 sticky top-0 z-10" }, /* @__PURE__ */ React.createElement("span", { className: "bg-[#1c2026]/95 backdrop-blur-sm text-gray-400 text-xs font-semibold px-3 py-1 rounded-full border border-white/5 shadow-lg" }, label));
});
const MessageItem = React.memo(React.forwardRef(({ msg, prevMsg, currentUserId, conversationId, onDelete }, ref) => {
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const showDate = !prevMsg || new Date(msg.timestamp).toDateString() !== new Date(prevMsg.timestamp).toDateString();
  const senderId = typeof msg.sender === "object" ? msg.sender._id : msg.sender;
  const isMe = senderId === currentUserId;
  const isTemp = msg.status === "sending" || msg._id?.toString().startsWith("temp-");
  const mediaUrl = getMessageUrl(msg);
  const type = detectFileType(msg);
  const hasContent = msg.content && msg.content.trim() && type !== "audio";
  const metadata = {
    conversationId,
    fileName: msg.fileName || msg.content,
    fileSize: msg.fileSize
  };
  const handleDelete = () => {
    setShowMenu(false);
    setShowDeleteConfirm(true);
  };
  const confirmDelete = () => {
    if (onDelete && typeof onDelete === "function") {
      onDelete(msg._id);
    } else {
      console.error("\u274C [MessageItem] onDelete n'est pas une fonction");
    }
    setShowDeleteConfirm(false);
  };
  const renderContent = () => {
    if (type === "missed-call") {
      return /* @__PURE__ */ React.createElement("div", { className: `flex items-center gap-3 p-3 rounded-xl my-1 border max-w-xs ${isMe ? "bg-white/5 border-white/10" : "bg-red-500/10 border-red-500/20"}` }, /* @__PURE__ */ React.createElement(PhoneMissed, { size: 18, className: isMe ? "text-gray-400" : "text-red-400" }), /* @__PURE__ */ React.createElement("p", { className: `text-xs font-bold ${isMe ? "text-gray-400" : "text-red-400"}` }, "Appel manqu\xE9"));
    }
    if (type === "image" && mediaUrl) return /* @__PURE__ */ React.createElement(ImageMessage, { messageId: msg._id, remoteUrl: mediaUrl, isMe, metadata });
    if (type === "video" && mediaUrl) return /* @__PURE__ */ React.createElement(VideoMessage, { messageId: msg._id, remoteUrl: mediaUrl, metadata });
    if (type === "audio" && mediaUrl) return /* @__PURE__ */ React.createElement(AudioMessage, { messageId: msg._id, remoteUrl: mediaUrl, isMe, metadata });
    if (type === "file" && mediaUrl) return /* @__PURE__ */ React.createElement(FileMessage, { messageId: msg._id, remoteUrl: mediaUrl, name: msg.fileName || msg.content, size: msg.fileSize, isMe, metadata });
    return null;
  };
  if (["missed-call"].includes(type)) {
    return /* @__PURE__ */ React.createElement(React.Fragment, { key: msg._id }, showDate && /* @__PURE__ */ React.createElement(DateSeparator, { date: msg.timestamp }), /* @__PURE__ */ React.createElement("div", { ref, className: `flex w-full ${isMe ? "justify-end" : "justify-start"} mb-2` }, renderContent()));
  }
  return /* @__PURE__ */ React.createElement(React.Fragment, { key: msg._id }, showDate && /* @__PURE__ */ React.createElement(DateSeparator, { date: msg.timestamp }), /* @__PURE__ */ React.createElement(
    motion.div,
    {
      ref,
      initial: { opacity: 0, y: 10 },
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 0, x: isMe ? 100 : -100, transition: { duration: 0.2 } },
      className: `flex w-full ${isMe ? "justify-end" : "justify-start"} mb-1 group relative`
    },
    /* @__PURE__ */ React.createElement("div", { className: `relative max-w-[85%] md:max-w-[70%] rounded-2xl shadow-sm ${type === "image" || type === "video" ? "" : "px-3 py-2"} ${isMe ? `${type === "image" || type === "video" ? "bg-transparent" : "bg-[#005c4b]"} text-white rounded-tr-md` : `${type === "image" || type === "video" ? "bg-transparent" : "bg-[#202c33]"} text-gray-100 rounded-tl-md`} ${isTemp ? "opacity-60" : ""}` }, !isTemp && /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: () => setShowMenu(!showMenu),
        className: "absolute -top-2 -right-2 p-1.5 bg-[#1c2026] rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg border border-white/10"
      },
      /* @__PURE__ */ React.createElement(MoreVertical, { size: 14, className: "text-gray-400" })
    ), /* @__PURE__ */ React.createElement(AnimatePresence, null, showMenu && /* @__PURE__ */ React.createElement(
      MessageContextMenu,
      {
        isMe,
        onDelete: handleDelete,
        onClose: () => setShowMenu(false)
      }
    )), renderContent(), hasContent && /* @__PURE__ */ React.createElement("p", { className: `text-sm leading-relaxed whitespace-pre-wrap break-words ${type === "file" ? "mt-2" : ""}` }, msg.content), /* @__PURE__ */ React.createElement("div", { className: `flex items-center justify-end gap-1 ${hasContent || type === "file" ? "mt-1" : "absolute bottom-2 right-2"} text-xs ${type === "image" || type === "video" ? "text-white drop-shadow-lg" : isMe ? "text-gray-300" : "text-gray-500"}` }, /* @__PURE__ */ React.createElement("span", null, format(new Date(msg.timestamp || Date.now()), "HH:mm")), isMe && /* @__PURE__ */ React.createElement("span", null, isTemp ? /* @__PURE__ */ React.createElement(Clock, { size: 14, className: "animate-pulse" }) : msg.read ? /* @__PURE__ */ React.createElement(CheckCheck, { size: 16, className: "text-blue-400" }) : /* @__PURE__ */ React.createElement(Check, { size: 16 }))))
  ), /* @__PURE__ */ React.createElement(AnimatePresence, null, showDeleteConfirm && /* @__PURE__ */ React.createElement(
    DeleteConfirmModal,
    {
      onConfirm: confirmDelete,
      onCancel: () => setShowDeleteConfirm(false)
    }
  )));
}));
MessageItem.displayName = "MessageItem";
const MessagesList = ({ messages = [], loading, currentUserId, endRef, conversationId, onDeleteMessage }) => {
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      localMediaStorage.cleanOldMedia(90).catch(console.error);
    }, 7 * 24 * 60 * 60 * 1e3);
    return () => clearInterval(cleanupInterval);
  }, []);
  const sortedMessages = useMemo(() => {
    return [...messages].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }, [messages]);
  if (loading && messages.length === 0) {
    return /* @__PURE__ */ React.createElement("div", { className: "flex-1 flex items-center justify-center bg-[#0b0d10]" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-col items-center gap-3" }, /* @__PURE__ */ React.createElement("div", { className: "w-10 h-10 border-3 border-gray-700 border-t-blue-500 rounded-full animate-spin" }), /* @__PURE__ */ React.createElement("p", { className: "text-gray-500 text-sm" }, "Chargement...")));
  }
  return /* @__PURE__ */ React.createElement("div", { className: "flex-1 overflow-y-auto px-3 md:px-6 pb-4 space-y-0.5 bg-[#0b0d10]", style: { backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.02'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")` } }, sortedMessages.length === 0 ? /* @__PURE__ */ React.createElement("div", { className: "flex flex-col items-center justify-center h-full opacity-30" }, /* @__PURE__ */ React.createElement(Shield, { size: 64, className: "mb-4 text-gray-600" }), /* @__PURE__ */ React.createElement("p", { className: "text-sm font-semibold text-gray-500" }, "Messages chiffr\xE9s de bout en bout"), /* @__PURE__ */ React.createElement("p", { className: "text-xs text-gray-600 mt-1" }, "M\xE9dias stock\xE9s localement")) : /* @__PURE__ */ React.createElement(AnimatePresence, { mode: "popLayout" }, sortedMessages.map((msg, index) => /* @__PURE__ */ React.createElement(
    MessageItem,
    {
      key: msg._id || `msg-${index}`,
      msg,
      prevMsg: sortedMessages[index - 1],
      currentUserId,
      conversationId,
      onDelete: onDeleteMessage
    }
  ))), /* @__PURE__ */ React.createElement("div", { ref: endRef, className: "h-2" }));
};
export {
  MessagesList
};
