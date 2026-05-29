import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { usePosts } from "../../context/PostsContext";
import { useDarkMode } from "../../context/DarkModeContext";
import axiosClient from "../../api/axiosClientGlobal";
import {
  PhotoIcon,
  MapPinIcon,
  FaceSmileIcon,
  XMarkIcon,
  SwatchIcon
} from "@heroicons/react/24/outline";
const TEXT_CARD_PALETTES = [
  ["#1877F2", "#0D5FCC", "#ffffff"],
  // 0 — bleu
  ["#E4405F", "#C13584", "#ffffff"],
  // 1 — rose
  ["#FF6B35", "#F7C59F", "#ffffff"],
  // 2 — orange
  ["#2EC4B6", "#0B7A75", "#ffffff"],
  // 3 — teal
  ["#6A0572", "#AB83A1", "#ffffff"],
  // 4 — violet
  ["#1A1A2E", "#16213E", "#ffffff"],
  // 5 — marine
  ["#2D6A4F", "#52B788", "#ffffff"],
  // 6 — vert
  ["#8B2FC9", "#5A108F", "#ffffff"]
  // 7 — pourpre
];
const hashText = (str) => {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = Math.imul(31, h) + str.charCodeAt(i) | 0;
  return Math.abs(h) % TEXT_CARD_PALETTES.length;
};
const getFontStyle = (len) => {
  if (len <= 60) return { size: "28px", weight: "700", lineHeight: "1.25" };
  if (len <= 120) return { size: "22px", weight: "700", lineHeight: "1.30" };
  if (len <= 220) return { size: "19px", weight: "600", lineHeight: "1.35" };
  return { size: "16px", weight: "500", lineHeight: "1.50" };
};
const TEXT_CARD_THRESHOLD = 120;
const TextCardPreview = React.memo(({ text, paletteIndex, onTogglePalettePicker }) => {
  const [from, to, textColor] = TEXT_CARD_PALETTES[paletteIndex];
  const { size, weight, lineHeight } = getFontStyle(text.length);
  const height = text.length <= 80 ? 200 : text.length <= 180 ? 240 : 280;
  return /* @__PURE__ */ React.createElement(
    motion.div,
    {
      initial: { opacity: 0, scale: 0.97 },
      animate: { opacity: 1, scale: 1 },
      exit: { opacity: 0, scale: 0.97 },
      transition: { duration: 0.2 },
      className: "-mx-4 relative cursor-pointer select-none",
      onClick: onTogglePalettePicker,
      title: "Cliquer pour changer la couleur"
    },
    /* @__PURE__ */ React.createElement(
      "div",
      {
        style: {
          width: "100%",
          height,
          background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px 28px",
          boxSizing: "border-box",
          position: "relative",
          overflow: "hidden"
        }
      },
      /* @__PURE__ */ React.createElement("div", { style: { position: "absolute", top: -50, right: -50, width: 160, height: 160, borderRadius: "50%", background: "rgba(255,255,255,0.07)", pointerEvents: "none" } }),
      /* @__PURE__ */ React.createElement("div", { style: { position: "absolute", bottom: -30, left: -30, width: 110, height: 110, borderRadius: "50%", background: "rgba(255,255,255,0.04)", pointerEvents: "none" } }),
      /* @__PURE__ */ React.createElement("p", { style: {
        color: textColor,
        fontSize: size,
        fontWeight: weight,
        lineHeight,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        textAlign: "center",
        margin: 0,
        position: "relative",
        zIndex: 1,
        wordBreak: "break-word",
        overflowWrap: "break-word",
        letterSpacing: text.length <= 60 ? "-0.5px" : "normal",
        textShadow: "0 1px 3px rgba(0,0,0,0.18)"
      } }, text),
      /* @__PURE__ */ React.createElement("div", { style: {
        position: "absolute",
        bottom: 10,
        right: 10,
        background: "rgba(0,0,0,0.35)",
        backdropFilter: "blur(6px)",
        borderRadius: 20,
        padding: "4px 10px",
        display: "flex",
        alignItems: "center",
        gap: 5,
        color: "white",
        fontSize: 11,
        fontWeight: 600,
        pointerEvents: "none"
      } }, /* @__PURE__ */ React.createElement("svg", { width: "12", height: "12", viewBox: "0 0 24 24", fill: "currentColor" }, /* @__PURE__ */ React.createElement("path", { d: "M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12zm3-4C8.67 8 8 7.33 8 6.5S8.67 5 9.5 5s1.5.67 1.5 1.5S10.33 8 9.5 8zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 5 14.5 5s1.5.67 1.5 1.5S15.33 8 14.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 9 17.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" })), "Couleur")
    )
  );
});
TextCardPreview.displayName = "TextCardPreview";
const PalettePicker = React.memo(({ selectedIndex, onSelect, isDarkMode }) => /* @__PURE__ */ React.createElement(
  motion.div,
  {
    initial: { opacity: 0, y: -8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -8 },
    transition: { duration: 0.18 },
    className: `flex items-center gap-2.5 px-2 py-3 rounded-2xl ${isDarkMode ? "bg-gray-900 border border-gray-800" : "bg-gray-50 border border-gray-200"}`
  },
  /* @__PURE__ */ React.createElement(SwatchIcon, { className: `w-4 h-4 flex-shrink-0 ${isDarkMode ? "text-gray-500" : "text-gray-400"}` }),
  /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2 flex-wrap" }, TEXT_CARD_PALETTES.map(([from, to], idx) => /* @__PURE__ */ React.createElement(
    "button",
    {
      key: idx,
      onClick: () => onSelect(idx),
      className: "flex-shrink-0 transition-transform active:scale-90",
      style: {
        width: 26,
        height: 26,
        borderRadius: "50%",
        background: `linear-gradient(135deg, ${from}, ${to})`,
        border: idx === selectedIndex ? "3px solid white" : "2px solid transparent",
        boxShadow: idx === selectedIndex ? `0 0 0 2px ${from}, 0 2px 8px rgba(0,0,0,0.3)` : "0 1px 4px rgba(0,0,0,0.2)",
        cursor: "pointer",
        WebkitTapHighlightColor: "transparent",
        outline: "none"
      },
      title: `Palette ${idx + 1}`
    }
  )))
));
PalettePicker.displayName = "PalettePicker";
const SimpleAvatar = ({ username, profilePhoto, size = 38 }) => {
  const [imageError, setImageError] = useState(false);
  const getInitials = (name) => {
    if (!name) return "?";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };
  const getColorFromName = (name) => {
    if (!name) return "#f97316";
    const colors = ["#f97316", "#ef4444", "#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#ec4899", "#6366f1"];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };
  const getPhotoUrl = (photo) => {
    if (!photo) return null;
    if (photo.startsWith("http")) return photo;
    const base = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? "https://chantilink-backend.onrender.com" : "http://localhost:5000");
    return `${base}${photo.startsWith("/") ? photo : `/${photo}`}`;
  };
  const photoUrl = getPhotoUrl(profilePhoto);
  if (photoUrl && !imageError) {
    return /* @__PURE__ */ React.createElement(
      "img",
      {
        src: photoUrl,
        alt: username,
        className: "rounded-full object-cover flex-shrink-0",
        style: { width: size, height: size },
        onError: () => setImageError(true)
      }
    );
  }
  return /* @__PURE__ */ React.createElement(
    "div",
    {
      className: "rounded-full flex items-center justify-center text-white font-bold flex-shrink-0",
      style: { width: size, height: size, backgroundColor: getColorFromName(username), fontSize: size * 0.4 }
    },
    getInitials(username)
  );
};
function CreatePost({ user, showToast, onPostCreated }) {
  const { addPostOptimistic, replaceOptimisticPost, removeOptimisticPost } = usePosts();
  const { isDarkMode } = useDarkMode();
  const fileInputRef = useRef(null);
  const abortControllerRef = useRef(null);
  const textareaRef = useRef(null);
  const postingRef = useRef(false);
  const optimisticUrlsRef = useRef([]);
  const [isOpen, setIsOpen] = useState(false);
  const [content, setContent] = useState("");
  const [mediaFiles, setMediaFiles] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);
  const [location, setLocation] = useState("");
  const [privacy, setPrivacy] = useState("Public");
  const [posting, setPosting] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showLocation, setShowLocation] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [paletteIndex, setPaletteIndex] = useState(null);
  const [showPalette, setShowPalette] = useState(false);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const emojis = [
    "\u{1F600}",
    "\u{1F602}",
    "\u{1F60D}",
    "\u{1F60E}",
    "\u{1F622}",
    "\u{1F44D}",
    "\u{1F64F}",
    "\u{1F389}",
    "\u2764\uFE0F",
    "\u{1F929}",
    "\u{1F914}",
    "\u{1F631}",
    "\u{1F973}",
    "\u{1F4AF}",
    "\u2728",
    "\u{1F525}",
    "\u{1F44F}",
    "\u{1F38A}",
    "\u{1F4AA}",
    "\u{1F31F}",
    "\u2B50",
    "\u{1F496}",
    "\u{1F64C}",
    "\u{1F44C}"
  ];
  const MAX_CONTENT_LENGTH = 1e4;
  const MAX_MEDIA_COUNT = 5;
  const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
  const MAX_VIDEO_SIZE = 200 * 1024 * 1024;
  const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
  const isTextCard = useMemo(
    () => content.trim().length > 0 && content.trim().length <= TEXT_CARD_THRESHOLD && mediaFiles.length === 0,
    [content, mediaFiles.length]
  );
  const effectivePaletteIndex = useMemo(() => {
    if (!isTextCard) return 0;
    return paletteIndex !== null ? paletteIndex : hashText(content.trim());
  }, [isTextCard, paletteIndex, content]);
  useEffect(() => {
    if (!isTextCard) {
      setPaletteIndex(null);
      setShowPalette(false);
    }
  }, [isTextCard]);
  useEffect(() => {
    if (isOpen) setTimeout(() => textareaRef.current?.focus(), 80);
  }, [isOpen]);
  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);
  useEffect(() => {
    if (mediaFiles.length === 0) {
      setPreviewUrls([]);
      return;
    }
    const urls = mediaFiles.map((f) => ({
      file: f,
      url: URL.createObjectURL(f),
      type: f.type.startsWith("video") ? "video" : "image"
    }));
    setPreviewUrls(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u.url));
  }, [mediaFiles]);
  useEffect(() => () => {
    abortControllerRef.current?.abort();
    optimisticUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    optimisticUrlsRef.current = [];
  }, []);
  const resetForm = useCallback(() => {
    setContent("");
    setMediaFiles([]);
    setPreviewUrls([]);
    setLocation("");
    setPrivacy("Public");
    setIsOpen(false);
    setShowEmoji(false);
    setShowLocation(false);
    setDragOver(false);
    setCurrentIndex(0);
    setUploadProgress(0);
    setPaletteIndex(null);
    setShowPalette(false);
  }, []);
  const validateFile = useCallback((file) => {
    const isVideo = file.type.startsWith("video");
    const isImage = file.type.startsWith("image");
    if (!isVideo && !isImage) return { valid: false, error: "Type de fichier non support\xE9" };
    if (isImage && !ALLOWED_IMAGE_TYPES.includes(file.type)) return { valid: false, error: "Format image non autoris\xE9 (JPG, PNG, WebP)" };
    if (isVideo && !ALLOWED_VIDEO_TYPES.includes(file.type)) return { valid: false, error: "Format vid\xE9o non autoris\xE9 (MP4, WebM, MOV)" };
    const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
    if (file.size > maxSize) return { valid: false, error: `Fichier trop lourd (max ${isVideo ? "200 Mo" : "5 Mo"})` };
    return { valid: true };
  }, []);
  const handleFiles = useCallback((files) => {
    if (!files || files.length === 0) return;
    const remaining = MAX_MEDIA_COUNT - mediaFiles.length;
    if (remaining <= 0) {
      showToast?.(`Maximum ${MAX_MEDIA_COUNT} fichiers`, "error");
      return;
    }
    const newFiles = Array.from(files).slice(0, remaining);
    const validFiles = [];
    for (const file of newFiles) {
      const v = validateFile(file);
      if (!v.valid) {
        showToast?.(v.error, "error");
        continue;
      }
      validFiles.push(file);
    }
    if (validFiles.length > 0) setMediaFiles((prev) => [...prev, ...validFiles]);
  }, [mediaFiles.length, validateFile, showToast]);
  const handleMediaChange = (e) => handleFiles(e.target.files);
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setDragOver(true);
  }, []);
  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
  }, []);
  const removeMedia = useCallback((index) => {
    setMediaFiles((prev) => prev.filter((_, i) => i !== index));
    if (currentIndex >= index && currentIndex > 0) setCurrentIndex(currentIndex - 1);
  }, [currentIndex]);
  const handlePost = async () => {
    if (postingRef.current || posting || !user) return;
    const trimmedContent = content.trim();
    if (!trimmedContent && mediaFiles.length === 0) {
      showToast?.("Ajoutez du texte ou des m\xE9dias.", "error");
      return;
    }
    if (trimmedContent.length > MAX_CONTENT_LENGTH) {
      showToast?.(`Texte trop long (max ${MAX_CONTENT_LENGTH} caract\xE8res)`, "error");
      return;
    }
    postingRef.current = true;
    setPosting(true);
    const capturedIsTextCard = isTextCard;
    const capturedPaletteIndex = effectivePaletteIndex;
    const capturedFiles = [...mediaFiles];
    const capturedContent = trimmedContent;
    const capturedLocation = location.trim();
    const capturedPrivacy = privacy;
    const optimisticObjectUrls = capturedFiles.map((file) => URL.createObjectURL(file));
    optimisticUrlsRef.current.push(...optimisticObjectUrls);
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const optimisticPost = {
      _id: tempId,
      content: capturedContent,
      contenu: capturedContent,
      user: {
        _id: user._id,
        fullName: user.fullName || user.username,
        profilePhoto: user.profilePhoto,
        isVerified: user.isVerified || false,
        isPremium: user.isPremium || false
      },
      media: optimisticObjectUrls,
      mediaType: capturedIsTextCard ? "text-card" : capturedFiles.some((file) => file.type?.startsWith("video")) ? "video" : optimisticObjectUrls.length > 0 ? "image" : null,
      // Palette choisie (transmise pour que PostMedia puisse la lire)
      textCardPalette: capturedIsTextCard ? capturedPaletteIndex : void 0,
      likes: [],
      comments: [],
      shares: [],
      location: capturedLocation || null,
      privacy: capturedPrivacy,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      isOptimistic: true
    };
    addPostOptimistic?.(optimisticPost);
    resetForm();
    setUploadProgress(0);
    abortControllerRef.current = new AbortController();
    const formData = new FormData();
    formData.append("content", capturedContent);
    if (capturedLocation) formData.append("location", capturedLocation);
    formData.append("privacy", capturedPrivacy);
    if (capturedIsTextCard) formData.append("textCardPalette", String(capturedPaletteIndex));
    capturedFiles.forEach((file) => formData.append("media", file));
    const postConfig = {
      signal: abortControllerRef.current.signal,
      timeout: 12e4,
      onUploadProgress: (evt) => {
        if (evt.total) setUploadProgress(Math.round(evt.loaded * 100 / evt.total));
      }
    };
    try {
      let response;
      try {
        response = await axiosClient.post("/posts", formData, postConfig);
      } catch (err) {
        const canRetryAsPlainText = capturedIsTextCard && capturedFiles.length === 0 && err.response?.status >= 500;
        if (!canRetryAsPlainText) throw err;
        const fallbackData = new FormData();
        fallbackData.append("content", capturedContent);
        if (capturedLocation) fallbackData.append("location", capturedLocation);
        fallbackData.append("privacy", capturedPrivacy);
        response = await axiosClient.post("/posts", fallbackData, postConfig);
      }
      const realPost = response.data?.data || response.data;
      const normalizedPost = replaceOptimisticPost?.(tempId, realPost) || realPost;
      optimisticObjectUrls.forEach((url) => URL.revokeObjectURL(url));
      optimisticUrlsRef.current = optimisticUrlsRef.current.filter((url) => !optimisticObjectUrls.includes(url));
      showToast?.("Post publi\xE9 ! \u{1F389}", "success");
      onPostCreated?.(normalizedPost);
    } catch (err) {
      if (err.name === "CanceledError" || err.name === "AbortError") {
        removeOptimisticPost?.(tempId);
        optimisticObjectUrls.forEach((url) => URL.revokeObjectURL(url));
        optimisticUrlsRef.current = optimisticUrlsRef.current.filter((url) => !optimisticObjectUrls.includes(url));
        return;
      }
      removeOptimisticPost?.(tempId);
      optimisticObjectUrls.forEach((url) => URL.revokeObjectURL(url));
      optimisticUrlsRef.current = optimisticUrlsRef.current.filter((url) => !optimisticObjectUrls.includes(url));
      const msg = err.response?.status === 401 ? "Session expir\xE9e. Reconnectez-vous." : err.response?.data?.message || err.message || "Publication \xE9chou\xE9e. R\xE9essayez.";
      showToast?.(msg, "error");
    } finally {
      postingRef.current = false;
      setPosting(false);
      setTimeout(() => setUploadProgress(0), 800);
    }
  };
  const onTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchMove = (e) => {
    touchEndX.current = e.touches[0].clientX;
  };
  const onTouchEnd = () => {
    const d = touchStartX.current - touchEndX.current;
    if (Math.abs(d) < 50 || previewUrls.length <= 1) return;
    if (d > 0) setCurrentIndex((p) => (p + 1) % previewUrls.length);
    else setCurrentIndex((p) => (p - 1 + previewUrls.length) % previewUrls.length);
  };
  if (!user) return /* @__PURE__ */ React.createElement("div", { className: `text-center py-6 font-medium ${isDarkMode ? "text-orange-400" : "text-orange-500"}` }, "Connectez-vous pour publier un post");
  const canPost = (content.trim().length > 0 || mediaFiles.length > 0) && !posting;
  const charCount = content.length;
  const charLeft = MAX_CONTENT_LENGTH - charCount;
  const charWarning = charLeft < 500;
  return /* @__PURE__ */ React.createElement(
    motion.div,
    {
      layout: true,
      className: `transition-all duration-300 ${isDarkMode ? "bg-black border-b border-white/[0.02]" : "bg-white border-b border-gray-100/30"}`,
      style: { borderBottomWidth: "0.5px" }
    },
    posting && uploadProgress > 0 && /* @__PURE__ */ React.createElement("div", { className: `w-full h-0.5 overflow-hidden ${isDarkMode ? "bg-white/10" : "bg-gray-200"}` }, /* @__PURE__ */ React.createElement(
      motion.div,
      {
        initial: { width: 0 },
        animate: { width: `${uploadProgress}%` },
        className: "h-full",
        style: { background: "linear-gradient(90deg, #f97316, #ec4899)" },
        transition: { duration: 0.2 }
      }
    )),
    /* @__PURE__ */ React.createElement(
      motion.div,
      {
        onClick: () => setIsOpen(true),
        className: "cursor-pointer flex items-center gap-3 px-4 py-3 group"
      },
      /* @__PURE__ */ React.createElement(SimpleAvatar, { username: user?.username || user?.fullName, profilePhoto: user?.profilePhoto, size: 40 }),
      /* @__PURE__ */ React.createElement("div", { className: `flex-1 px-4 py-2.5 rounded-full transition ${isDarkMode ? "bg-white/[0.03] group-hover:bg-white/[0.05]" : "bg-gray-50 group-hover:bg-gray-100"}` }, /* @__PURE__ */ React.createElement("span", { className: "text-gray-500 font-normal" }, "Quoi de neuf ?"))
    ),
    isOpen && createPortal(
      /* ── OUVERT ──────────────────────────────────────────────────────── */
      /* @__PURE__ */ React.createElement(AnimatePresence, null, /* @__PURE__ */ React.createElement(
        motion.div,
        {
          key: "create-post-backdrop",
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          exit: { opacity: 0 },
          className: "fixed inset-0 z-[420] flex items-center justify-center bg-black/70 px-3 py-4 backdrop-blur-sm sm:px-5"
        },
        /* @__PURE__ */ React.createElement(
          motion.div,
          {
            key: "expanded",
            initial: { opacity: 0, y: 24, scale: 0.98 },
            animate: { opacity: 1, y: 0, scale: 1 },
            exit: { opacity: 0, y: 24, scale: 0.98 },
            transition: { type: "spring", stiffness: 360, damping: 32 },
            onClick: (e) => e.stopPropagation(),
            className: `flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border shadow-2xl ${isDarkMode ? "border-white/10 bg-neutral-950 shadow-black/60" : "border-gray-200 bg-white shadow-black/20"}`
          },
          /* @__PURE__ */ React.createElement("div", { className: `flex items-center gap-3 px-4 py-3 border-b ${isDarkMode ? "border-white/10" : "border-gray-100"}` }, /* @__PURE__ */ React.createElement(SimpleAvatar, { username: user?.username || user?.fullName, profilePhoto: user?.profilePhoto, size: 40 }), /* @__PURE__ */ React.createElement("div", { className: "flex-1" }, /* @__PURE__ */ React.createElement("p", { className: `font-semibold text-sm ${isDarkMode ? "text-white" : "text-gray-900"}` }, user?.fullName || user?.username), /* @__PURE__ */ React.createElement("p", { className: "text-xs text-gray-500" }, isTextCard ? "Publication color\xE9e courte" : "Publication texte long")), isTextCard && /* @__PURE__ */ React.createElement(
            motion.div,
            {
              initial: { scale: 0 },
              animate: { scale: 1 },
              className: "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold text-white",
              style: { background: `linear-gradient(135deg, ${TEXT_CARD_PALETTES[effectivePaletteIndex][0]}, ${TEXT_CARD_PALETTES[effectivePaletteIndex][1]})` }
            },
            "\u2728 Color\xE9e"
          ), /* @__PURE__ */ React.createElement(
            "button",
            {
              type: "button",
              onClick: resetForm,
              className: `rounded-full p-2 transition ${isDarkMode ? "text-gray-400 hover:bg-white/10 hover:text-white" : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"}`,
              "aria-label": "Fermer la cr\xE9ation"
            },
            /* @__PURE__ */ React.createElement(XMarkIcon, { className: "h-5 w-5" })
          )),
          /* @__PURE__ */ React.createElement("div", { className: "min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4", style: { WebkitOverflowScrolling: "touch" } }, /* @__PURE__ */ React.createElement(AnimatePresence, { mode: "wait" }, isTextCard ? /* @__PURE__ */ React.createElement(motion.div, { key: "textcard-mode", className: "space-y-2" }, /* @__PURE__ */ React.createElement(
            TextCardPreview,
            {
              text: content.trim(),
              paletteIndex: effectivePaletteIndex,
              onTogglePalettePicker: () => setShowPalette((v) => !v)
            }
          ), /* @__PURE__ */ React.createElement(AnimatePresence, null, showPalette && /* @__PURE__ */ React.createElement(
            PalettePicker,
            {
              selectedIndex: effectivePaletteIndex,
              onSelect: (idx) => {
                setPaletteIndex(idx);
              },
              isDarkMode
            }
          )), /* @__PURE__ */ React.createElement(
            "textarea",
            {
              ref: textareaRef,
              value: content,
              onChange: (e) => setContent(e.target.value),
              className: `w-full px-3 py-2 resize-none focus:outline-none text-[14px] rounded-xl border transition ${isDarkMode ? "bg-white/[0.04] text-gray-300 placeholder-gray-600 border-white/10 focus:border-white/20" : "bg-gray-50 text-gray-700 placeholder-gray-400 border-gray-200 focus:border-gray-300"}`,
              rows: 2,
              placeholder: "Continuez \xE0 \xE9crire\u2026 le mode texte long s'active automatiquement.",
              maxLength: MAX_CONTENT_LENGTH
            }
          ), /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between" }, /* @__PURE__ */ React.createElement("span", { className: `text-[11px] ${isDarkMode ? "text-gray-500" : "text-gray-400"}` }, "Au-del\xE0 de ", TEXT_CARD_THRESHOLD, " caract\xE8res, la publication passe en texte long."), /* @__PURE__ */ React.createElement("span", { className: `text-[11px] font-mono ${content.length >= MAX_CONTENT_LENGTH - 500 ? "text-red-400" : content.length >= TEXT_CARD_THRESHOLD - 20 ? "text-orange-400" : isDarkMode ? "text-gray-600" : "text-gray-400"}` }, charLeft))) : /* @__PURE__ */ React.createElement(motion.div, { key: "normal-mode" }, /* @__PURE__ */ React.createElement(
            "textarea",
            {
              ref: textareaRef,
              placeholder: "Exprimez votre id\xE9e, d\xE9taillez votre chantier, votre analyse ou votre retour d'exp\xE9rience\u2026",
              value: content,
              onChange: (e) => setContent(e.target.value),
              className: `w-full px-0 py-2 resize-y focus:outline-none text-[15px] leading-relaxed ${isDarkMode ? "bg-transparent text-gray-200 placeholder-gray-600" : "bg-transparent text-gray-900 placeholder-gray-500"}`,
              rows: 6,
              maxLength: MAX_CONTENT_LENGTH,
              style: { minHeight: 150, maxHeight: "42vh" }
            }
          ), /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between mt-1" }, /* @__PURE__ */ React.createElement("span", { className: `text-[11px] ${isDarkMode ? "text-gray-600" : "text-gray-400"}` }, "Texte long accept\xE9 jusqu'\xE0 ", MAX_CONTENT_LENGTH.toLocaleString("fr-FR"), " caract\xE8res."), /* @__PURE__ */ React.createElement("span", { className: `text-[11px] font-mono ${charWarning ? charLeft < 100 ? "text-red-400" : "text-orange-400" : isDarkMode ? "text-gray-600" : "text-gray-400"}` }, charLeft)))), previewUrls.length > 0 && /* @__PURE__ */ React.createElement(
            "div",
            {
              className: "-mx-4 relative",
              onTouchStart,
              onTouchMove,
              onTouchEnd
            },
            /* @__PURE__ */ React.createElement("div", { className: "relative w-full", style: { height: "450px" } }, /* @__PURE__ */ React.createElement(AnimatePresence, { mode: "wait" }, previewUrls.map(
              (item, i) => i === currentIndex && /* @__PURE__ */ React.createElement(motion.div, { key: i, initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, className: "absolute inset-0" }, item.type === "image" ? /* @__PURE__ */ React.createElement("img", { src: item.url, alt: "preview", className: "w-full h-full object-cover" }) : /* @__PURE__ */ React.createElement("video", { src: item.url, controls: true, className: "w-full h-full object-cover" }), /* @__PURE__ */ React.createElement(
                "button",
                {
                  onClick: (e) => {
                    e.stopPropagation();
                    removeMedia(i);
                  },
                  className: "absolute top-2 right-2 bg-black/80 hover:bg-black text-white rounded-full p-2 transition z-10"
                },
                /* @__PURE__ */ React.createElement(XMarkIcon, { className: "w-5 h-5" })
              ))
            )), previewUrls.length > 1 && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10" }, previewUrls.map((_, i) => /* @__PURE__ */ React.createElement(
              "button",
              {
                key: i,
                onClick: () => setCurrentIndex(i),
                className: `h-1.5 rounded-full transition-all ${i === currentIndex ? "bg-white w-5" : "bg-white/50 w-1.5"}`
              }
            ))), /* @__PURE__ */ React.createElement("div", { className: "absolute top-2 left-2 bg-black/80 text-white text-xs px-2 py-1 rounded-full" }, currentIndex + 1, " / ", previewUrls.length)))
          ), previewUrls.length === 0 && !isTextCard && /* @__PURE__ */ React.createElement(
            "div",
            {
              onDragOver: handleDragOver,
              onDragLeave: handleDragLeave,
              onDrop: handleDrop,
              onClick: () => fileInputRef.current?.click(),
              className: `relative w-full h-28 border border-dashed rounded-xl flex justify-center items-center cursor-pointer transition-all ${dragOver ? isDarkMode ? "border-orange-500/50 bg-orange-500/5" : "border-orange-500/50 bg-orange-50" : isDarkMode ? "border-white/10" : "border-gray-200 bg-gray-50/50"}`
            },
            /* @__PURE__ */ React.createElement("div", { className: "text-center" }, /* @__PURE__ */ React.createElement(PhotoIcon, { className: `w-8 h-8 mx-auto mb-1.5 ${isDarkMode ? "text-gray-600" : "text-gray-400"}` }), /* @__PURE__ */ React.createElement("p", { className: "text-xs text-gray-500" }, "Ajouter des photos ou vid\xE9os"), /* @__PURE__ */ React.createElement("p", { className: "text-[10px] text-gray-400 mt-0.5" }, "ou taper du texte court (\u2264 120 car.) pour la carte color\xE9e"))
          ), /* @__PURE__ */ React.createElement(
            "input",
            {
              type: "file",
              className: "hidden",
              ref: fileInputRef,
              accept: "image/*,video/*",
              multiple: true,
              onChange: handleMediaChange,
              disabled: mediaFiles.length >= MAX_MEDIA_COUNT
            }
          ), /* @__PURE__ */ React.createElement(
            "div",
            {
              className: `sticky bottom-0 -mx-4 flex items-center justify-between border-t px-4 py-3 ${isDarkMode ? "border-white/[0.05] bg-neutral-950/95" : "border-gray-100 bg-white/95"} backdrop-blur`,
              style: { borderTopWidth: "0.5px" }
            },
            /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-1.5" }, /* @__PURE__ */ React.createElement(
              "button",
              {
                onClick: () => fileInputRef.current?.click(),
                disabled: mediaFiles.length >= MAX_MEDIA_COUNT,
                className: `p-2 rounded-full transition ${isDarkMode ? "hover:bg-white/10" : "hover:bg-gray-100"}`,
                title: "Ajouter une photo / vid\xE9o"
              },
              /* @__PURE__ */ React.createElement(PhotoIcon, { className: `w-5 h-5 ${mediaFiles.length >= MAX_MEDIA_COUNT ? "text-gray-500" : "text-orange-500"}` })
            ), /* @__PURE__ */ React.createElement(AnimatePresence, null, isTextCard && /* @__PURE__ */ React.createElement(
              motion.button,
              {
                initial: { opacity: 0, scale: 0.7 },
                animate: { opacity: 1, scale: 1 },
                exit: { opacity: 0, scale: 0.7 },
                onClick: () => setShowPalette((v) => !v),
                className: `p-2 rounded-full transition ${showPalette ? "bg-orange-500/15" : isDarkMode ? "hover:bg-white/10" : "hover:bg-gray-100"}`,
                title: "Changer la couleur"
              },
              /* @__PURE__ */ React.createElement(SwatchIcon, { className: `w-5 h-5 ${showPalette ? "text-orange-500" : "text-orange-400"}` })
            )), /* @__PURE__ */ React.createElement(
              "button",
              {
                onClick: () => setShowEmoji(!showEmoji),
                className: `p-2 rounded-full transition ${isDarkMode ? "hover:bg-white/10" : "hover:bg-gray-100"}`
              },
              /* @__PURE__ */ React.createElement(FaceSmileIcon, { className: "w-5 h-5 text-orange-500" })
            ), /* @__PURE__ */ React.createElement(
              "button",
              {
                onClick: () => setShowLocation(!showLocation),
                className: `p-2 rounded-full transition ${isDarkMode ? "hover:bg-white/10" : "hover:bg-gray-100"}`
              },
              /* @__PURE__ */ React.createElement(MapPinIcon, { className: "w-5 h-5 text-orange-500" })
            ), mediaFiles.length > 0 && /* @__PURE__ */ React.createElement("span", { className: "text-xs text-gray-500" }, mediaFiles.length, "/", MAX_MEDIA_COUNT)),
            /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2" }, /* @__PURE__ */ React.createElement(
              "button",
              {
                onClick: resetForm,
                className: `px-4 py-1.5 rounded-full text-sm font-semibold transition ${isDarkMode ? "text-gray-400 hover:bg-white/10" : "text-gray-600 hover:bg-gray-100"}`
              },
              "Annuler"
            ), /* @__PURE__ */ React.createElement(
              "button",
              {
                onClick: handlePost,
                disabled: !canPost,
                className: `px-5 py-1.5 rounded-full text-sm font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed text-white ${isTextCard ? "" : "bg-orange-500 hover:bg-orange-600"}`,
                style: isTextCard ? {
                  background: `linear-gradient(135deg, ${TEXT_CARD_PALETTES[effectivePaletteIndex][0]}, ${TEXT_CARD_PALETTES[effectivePaletteIndex][1]})`
                } : {}
              },
              posting ? "Envoi\u2026" : "Publier"
            ))
          ), /* @__PURE__ */ React.createElement(AnimatePresence, null, showEmoji && /* @__PURE__ */ React.createElement(
            motion.div,
            {
              initial: { height: 0, opacity: 0 },
              animate: { height: "auto", opacity: 1 },
              exit: { height: 0, opacity: 0 },
              className: "flex flex-wrap gap-2 py-2 overflow-hidden"
            },
            emojis.map((e, i) => /* @__PURE__ */ React.createElement(
              "button",
              {
                key: i,
                onClick: () => setContent((prev) => prev + e),
                className: "text-2xl hover:scale-110 transition-transform"
              },
              e
            ))
          )), /* @__PURE__ */ React.createElement(AnimatePresence, null, showLocation && /* @__PURE__ */ React.createElement(motion.div, { initial: { height: 0, opacity: 0 }, animate: { height: "auto", opacity: 1 }, exit: { height: 0, opacity: 0 } }, /* @__PURE__ */ React.createElement(
            "input",
            {
              type: "text",
              placeholder: "\u{1F4CD} Ajouter un lieu",
              value: location,
              onChange: (e) => setLocation(e.target.value),
              className: `w-full px-3 py-2 rounded-lg text-sm focus:outline-none ${isDarkMode ? "bg-white/5 text-gray-200 placeholder-gray-600" : "bg-gray-100 text-gray-900 placeholder-gray-500"}`
            }
          ))))
        )
      )),
      document.body
    )
  );
}
export {
  CreatePost as default
};
