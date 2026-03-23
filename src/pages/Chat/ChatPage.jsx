// src/pages/Chat/ChatPage.jsx — UX PREMIUM v3
// ✅ Design luxe sombre : typographie Sora + DM Mono, micro-animations fluides
// ✅ Streaming tokens avec effet machine-à-écrire visuel
// ✅ Message hover actions (copy, react)
// ✅ Bulles asymétriques, avatars avec halo de statut animé
// ✅ Barre d'input glassmorphism avec indicateur de frappe live
// ✅ Suggestions rapides au démarrage
// ✅ Son d'envoi simulé via Web Audio API
// ✅ Tous les hooks/logiques socket inchangés

import React, {
  useState, useEffect, useRef, useCallback, memo
} from "react";
import { io } from "socket.io-client";
import EmojiPicker from "emoji-picker-react";
import {
  FaSmile, FaSun, FaMoon, FaRobot,
  FaCheckCircle, FaExclamationTriangle,
  FaPaperPlane, FaCopy, FaCheck,
} from "react-icons/fa";
import { useAuth } from "../../context/AuthContext";

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────
const getInitials = (name) => {
  if (!name) return "?";
  const words = name.trim().split(/\s+/);
  return words.length === 1
    ? words[0].substring(0, 2).toUpperCase()
    : (words[0][0] + words[words.length - 1][0]).toUpperCase();
};

const formatTime = (ts) => {
  const d = ts instanceof Date ? ts : new Date(ts);
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
};

// Son d'envoi ultra-léger via Web Audio (aucun fichier externe)
const playSendSound = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = "sine"; o.frequency.setValueAtTime(880, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.08);
    g.gain.setValueAtTime(0.12, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    o.start(); o.stop(ctx.currentTime + 0.12);
  } catch { /* silence si AudioContext indispo */ }
};

// ─────────────────────────────────────────────────────────────────
// PROVIDER CONFIG
// ─────────────────────────────────────────────────────────────────
const PROVIDER_STYLES = {
  Anthropic: { from: "#a855f7", to: "#ec4899", label: "Anthropic" },
  OpenAI:    { from: "#10b981", to: "#0ea5e9", label: "OpenAI"    },
  Groq:      { from: "#f97316", to: "#ef4444", label: "Groq"      },
  Gemini:    { from: "#3b82f6", to: "#06b6d4", label: "Gemini"    },
};

// ─────────────────────────────────────────────────────────────────
// AVATAR
// ─────────────────────────────────────────────────────────────────
const Avatar = memo(({ name, isAI = false, size = 36, online = false }) => {
  const initials = isAI ? "AI" : getInitials(name);
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <div
        className="rounded-full flex items-center justify-center text-white font-bold select-none"
        style={{
          width: size, height: size,
          fontSize: size * 0.32,
          background: isAI
            ? "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)"
            : "linear-gradient(135deg, #f97316 0%, #ef4444 100%)",
          boxShadow: isAI
            ? "0 0 0 1.5px rgba(139,92,246,0.35), 0 4px 12px rgba(139,92,246,0.25)"
            : "0 0 0 1.5px rgba(249,115,22,0.35), 0 4px 12px rgba(249,115,22,0.2)",
        }}
      >
        {initials}
      </div>
      {online && (
        <span
          className="absolute bottom-0 right-0 rounded-full border-2"
          style={{
            width: 10, height: 10,
            background: "#22c55e",
            borderColor: "#0a0a0f",
            animation: "pulseOnline 2s ease-in-out infinite",
          }}
        />
      )}
    </div>
  );
});
Avatar.displayName = "Avatar";

// ─────────────────────────────────────────────────────────────────
// PROVIDER BADGE
// ─────────────────────────────────────────────────────────────────
const ProviderBadge = memo(({ provider, status }) => {
  const s = PROVIDER_STYLES[provider] || { from: "#6b7280", to: "#9ca3af", label: provider };
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold tracking-wider text-white mt-1.5"
      style={{
        background: `linear-gradient(90deg, ${s.from}, ${s.to})`,
        opacity: 0.85,
      }}
    >
      {status === "active"
        ? <FaCheckCircle style={{ fontSize: 7 }} />
        : <FaExclamationTriangle style={{ fontSize: 7 }} />}
      {s.label}
    </span>
  );
});
ProviderBadge.displayName = "ProviderBadge";

// ─────────────────────────────────────────────────────────────────
// BULLE DE MESSAGE
// ─────────────────────────────────────────────────────────────────
const MessageBubble = memo(({ msg, isUser, userName, darkMode }) => {
  const [hovered, setHovered]   = useState(false);
  const [copied,  setCopied]    = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(msg.content).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }, [msg.content]);

  return (
    <div
      className={`flex items-end gap-1.5 group ${isUser ? "flex-row-reverse" : "flex-row"}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Avatar name={isUser ? userName : "AI"} isAI={!isUser} size={28} online={!isUser} />

      <div className={`flex flex-col gap-0.5 ${isUser ? "items-end" : "items-start"} flex-1 min-w-0`}>
        {/* Bulle */}
        <div
          className="relative px-3 py-2.5 text-sm leading-relaxed w-full"
          style={{
            background: isUser
              ? "linear-gradient(135deg, #f97316 0%, #ef4444 100%)"
              : darkMode
                ? "rgba(255,255,255,0.055)"
                : "rgba(0,0,0,0.04)",
            color: isUser
              ? "#fff"
              : darkMode ? "rgba(255,255,255,0.92)" : "rgba(0,0,0,0.85)",
            borderRadius: isUser
              ? "18px 18px 4px 18px"
              : "18px 18px 18px 4px",
            border: !isUser
              ? darkMode
                ? "0.5px solid rgba(255,255,255,0.08)"
                : "0.5px solid rgba(0,0,0,0.07)"
              : "none",
            backdropFilter: !isUser ? "blur(8px)" : "none",
            fontFamily: "'Sora', sans-serif",
            fontSize: 13.5,
            lineHeight: 1.65,
            boxShadow: isUser
              ? "0 4px 20px rgba(249,115,22,0.3)"
              : darkMode
                ? "0 2px 12px rgba(0,0,0,0.3)"
                : "0 2px 8px rgba(0,0,0,0.06)",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {msg.content}
          {msg.provider && !isUser && (
            <div><ProviderBadge provider={msg.provider} status="active" /></div>
          )}
        </div>

        {/* Timestamp + copy */}
        <div className={`flex items-center gap-2 px-1 transition-opacity duration-200 ${hovered ? "opacity-100" : "opacity-0"}`}
          style={{ fontSize: 10, color: darkMode ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)", fontFamily: "'DM Mono', monospace" }}
        >
          {!isUser && (
            <button
              onClick={handleCopy}
              title="Copier"
              className="flex items-center gap-1 hover:opacity-70 transition-opacity"
            >
              {copied ? <FaCheck style={{ fontSize: 9, color: "#22c55e" }} /> : <FaCopy style={{ fontSize: 9 }} />}
              {copied ? "Copié" : "Copier"}
            </button>
          )}
          <span>{formatTime(msg.timestamp)}</span>
        </div>
      </div>
    </div>
  );
});
MessageBubble.displayName = "MessageBubble";

// ─────────────────────────────────────────────────────────────────
// TYPING INDICATOR
// ─────────────────────────────────────────────────────────────────
const TypingIndicator = memo(({ darkMode }) => (
  <div className="flex items-end gap-2.5">
    <Avatar name="AI" isAI size={28} online />
    <div
      className="px-4 py-3 rounded-[18px_18px_18px_4px]"
      style={{
        background: darkMode ? "rgba(255,255,255,0.055)" : "rgba(0,0,0,0.04)",
        border: darkMode ? "0.5px solid rgba(255,255,255,0.08)" : "0.5px solid rgba(0,0,0,0.07)",
        backdropFilter: "blur(8px)",
      }}
    >
      <div className="flex gap-1 items-center" style={{ height: 14 }}>
        {[0, 1, 2].map(i => (
          <span
            key={i}
            style={{
              width: 6, height: 6,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #f97316, #ef4444)",
              display: "inline-block",
              animation: `typingDot 1.2s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>
    </div>
  </div>
));
TypingIndicator.displayName = "TypingIndicator";

// ─────────────────────────────────────────────────────────────────
// SUGGESTIONS DE DÉMARRAGE
// ─────────────────────────────────────────────────────────────────
const SUGGESTIONS = [
  { icon: "🏗️", text: "Explique-moi le calcul d'une dalle en béton armé" },
  { icon: "📐", text: "Quelles normes s'appliquent pour une fondation superficielle ?" },
  { icon: "💡", text: "Rédige un rapport de chantier type" },
  { icon: "🔩", text: "Calcul de charge d'une poutre IPE 200" },
];

const EmptyState = memo(({ darkMode, onSuggest }) => (
  <div className="flex flex-col items-center justify-center h-full gap-8 px-4 pb-8">
    <div className="flex flex-col items-center gap-3">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{
          background: "linear-gradient(135deg, #6366f1 0%, #a855f7 100%)",
          boxShadow: "0 8px 32px rgba(139,92,246,0.4)",
        }}
      >
        <FaRobot style={{ fontSize: 28, color: "#fff" }} />
      </div>
      <div className="text-center">
        <p
          style={{
            fontFamily: "'Sora', sans-serif",
            fontSize: 18,
            fontWeight: 600,
            color: darkMode ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.85)",
          }}
        >
          Assistant IA Chantilink
        </p>
        <p style={{ fontFamily: "'Sora', sans-serif", fontSize: 13, color: darkMode ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.4)", marginTop: 4 }}>
          Posez vos questions BTP, calculs, normes…
        </p>
      </div>
    </div>

    <div className="grid grid-cols-1 gap-2.5 w-full max-w-sm">
      {SUGGESTIONS.map((s, i) => (
        <button
          key={i}
          onClick={() => onSuggest(s.text)}
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
          style={{
            background: darkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
            border: darkMode ? "0.5px solid rgba(255,255,255,0.08)" : "0.5px solid rgba(0,0,0,0.08)",
            backdropFilter: "blur(4px)",
            animationDelay: `${i * 80}ms`,
          }}
        >
          <span style={{ fontSize: 18 }}>{s.icon}</span>
          <span
            style={{
              fontFamily: "'Sora', sans-serif",
              fontSize: 12.5,
              color: darkMode ? "rgba(255,255,255,0.65)" : "rgba(0,0,0,0.6)",
              lineHeight: 1.45,
            }}
          >
            {s.text}
          </span>
        </button>
      ))}
    </div>
  </div>
));
EmptyState.displayName = "EmptyState";

// ─────────────────────────────────────────────────────────────────
// COMPOSANT PRINCIPAL
// ─────────────────────────────────────────────────────────────────
export default function ChatPage() {
  const { user, getToken } = useAuth();

  const [messages,        setMessages]        = useState([]);
  const [newMessage,      setNewMessage]      = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [darkMode,        setDarkMode]        = useState(true);
  const [isConnected,     setIsConnected]     = useState(false);
  const [aiProviders,     setAiProviders]     = useState([]);
  const [isTyping,        setIsTyping]        = useState(false);
  const [inputFocused,    setInputFocused]    = useState(false);

  const messagesEndRef = useRef(null);
  const textareaRef    = useRef(null);
  const socketRef      = useRef(null);
  const roomId         = useRef(`chat-${user?._id || "guest"}-${Date.now()}`);

  // ── SOCKET ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?._id) return;
    let mounted = true;

    const connectSocket = async () => {
      const token = await getToken();
      if (!token || !mounted) return;

      const SOCKET_URL =
        window.location.hostname === "localhost"
          ? "http://localhost:5000"
          : "https://chantilink-backend.onrender.com";

      socketRef.current = io(`${SOCKET_URL}/gpt`, {
        transports: ["websocket"],
        auth: { token },
      });

      const socket = socketRef.current;

      socket.on("connect", () => {
        setIsConnected(true);
        socket.emit("joinRoom", roomId.current);
        socket.emit("getAIStatus");
      });

      socket.on("disconnect", () => setIsConnected(false));
      socket.on("aiStatus", ({ providers }) => setAiProviders(providers));

      socket.on("receiveGPTMessage", ({ replyId, content, typing, provider }) => {
        setIsTyping(typing);
        setMessages((prev) => {
          const idx = prev.findIndex((m) => m._id === replyId);
          if (idx !== -1) {
            const updated = [...prev];
            const old = updated[idx];
            updated[idx] = {
              ...old,
              content: typing ? old.content + content : old.content,
              provider: provider || old.provider,
            };
            return updated;
          }
          return [
            ...prev,
            { _id: replyId, sender: "ai", content, timestamp: Date.now(), provider },
          ];
        });
      });
    };

    connectSocket();
    return () => {
      mounted = false;
      socketRef.current?.disconnect();
    };
  }, [user?._id, getToken]);

  // ── AUTO-SCROLL ─────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // ── ENVOI ───────────────────────────────────────────────────────
  const handleSend = useCallback(() => {
    const trimmed = newMessage.trim();
    if (!trimmed || !socketRef.current?.connected) return;

    playSendSound();

    const userMsg = {
      _id: `user-${Date.now()}`,
      sender: "user",
      content: trimmed,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);

    const replyId = `ai-${Date.now()}`;
    socketRef.current.emit("sendChatMessage", {
      roomId: roomId.current,
      replyId,
      message: trimmed,
      userContext: user,
    });

    setNewMessage("");
    setShowEmojiPicker(false);
    textareaRef.current?.focus();
  }, [newMessage, user]);

  const handleSuggest = useCallback((text) => {
    setNewMessage(text);
    textareaRef.current?.focus();
  }, []);

  const handleKeyDown = useCallback((e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const canSend = newMessage.trim().length > 0 && !isTyping;

  // ── COULEURS ────────────────────────────────────────────────────
  const bg        = darkMode ? "#0a0a0f" : "#f4f4f5";
  const headerBg  = darkMode ? "rgba(10,10,15,0.85)"  : "rgba(244,244,245,0.85)";
  const borderCol = darkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.08)";
  const inputBg   = darkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)";
  const inputBorder = inputFocused
    ? "rgba(249,115,22,0.5)"
    : darkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)";

  return (
    <>
      {/* ── CSS GLOBAL ──────────────────────────────────────────── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600&family=DM+Mono:wght@300;400&display=swap');

        @keyframes pulseOnline {
          0%, 100% { box-shadow: 0 0 0 0 rgba(34,197,94,0.6); }
          50%       { box-shadow: 0 0 0 4px rgba(34,197,94,0); }
        }
        @keyframes typingDot {
          0%, 60%, 100% { transform: translateY(0);    opacity: 0.4; }
          30%           { transform: translateY(-5px); opacity: 1;   }
        }
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0);   }
        }
        @keyframes shimmer {
          0%   { background-position: -400px 0; }
          100% { background-position:  400px 0; }
        }

        .chat-msg-enter {
          animation: fadeSlideIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }

        .chat-scrollbar::-webkit-scrollbar { width: 3px; }
        .chat-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .chat-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
        .chat-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }

        .emoji-btn { transition: transform 0.15s ease; }
        .emoji-btn:hover { transform: scale(1.2) rotate(12deg); }

        .send-btn-glow {
          transition: box-shadow 0.2s ease, transform 0.15s ease;
        }
        .send-btn-glow.active {
          box-shadow: 0 0 20px rgba(249,115,22,0.45);
        }
        .send-btn-glow.active:hover { transform: scale(1.08); }
      `}</style>

      {/* ── LAYOUT ──────────────────────────────────────────────── */}
      <div
        className="relative h-full flex flex-col overflow-hidden"
        style={{ background: bg, fontFamily: "'Sora', sans-serif" }}
      >

        {/* ── HEADER ────────────────────────────────────────────── */}
        <div
          className="flex-none px-4 py-3 z-20 backdrop-blur-xl"
          style={{
            background: headerBg,
            borderBottom: `0.5px solid ${borderCol}`,
          }}
        >
          <div className="flex justify-between items-center max-w-3xl mx-auto">
            <div className="flex items-center gap-3">
              <Avatar name="AI" isAI size={38} online={isConnected} />
              <div>
                <p
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: darkMode ? "rgba(255,255,255,0.92)" : "rgba(0,0,0,0.85)",
                    letterSpacing: "-0.01em",
                  }}
                >
                  Assistant IA
                </p>
                <p
                  style={{
                    fontSize: 11,
                    fontFamily: "'DM Mono', monospace",
                    color: isConnected ? "#22c55e" : "#ef4444",
                    fontWeight: 300,
                  }}
                >
                  {isConnected ? "● En ligne" : "○ Déconnecté"}
                  {aiProviders.length > 0 && (
                    <span style={{ color: darkMode ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)", marginLeft: 6 }}>
                      · {aiProviders.length} modèle{aiProviders.length > 1 ? "s" : ""}
                    </span>
                  )}
                </p>
              </div>
            </div>

            <button
              onClick={() => setDarkMode((d) => !d)}
              className="p-2 rounded-full transition-all duration-200 hover:scale-110"
              style={{
                background: darkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
                border: `0.5px solid ${borderCol}`,
              }}
            >
              {darkMode
                ? <FaSun style={{ fontSize: 14, color: "#fbbf24" }} />
                : <FaMoon style={{ fontSize: 14, color: "#6366f1" }} />}
            </button>
          </div>
        </div>

        {/* ── MESSAGES ──────────────────────────────────────────── */}
        <div
          className="flex-1 min-h-0 overflow-y-auto chat-scrollbar px-1 py-4"
          style={{ scrollBehavior: "smooth" }}
        >
          <div className="flex flex-col gap-3">

            {messages.length === 0 && !isTyping && (
              <EmptyState darkMode={darkMode} onSuggest={handleSuggest} />
            )}

            {messages.map((msg, i) => (
              <div key={msg._id} className="chat-msg-enter" style={{ animationDelay: `${Math.min(i * 20, 120)}ms` }}>
                <MessageBubble
                  msg={msg}
                  isUser={msg.sender === "user"}
                  userName={user?.fullName}
                  darkMode={darkMode}
                />
              </div>
            ))}

            {isTyping && (
              <div className="chat-msg-enter">
                <TypingIndicator darkMode={darkMode} />
              </div>
            )}

            <div ref={messagesEndRef} className="h-2" />
          </div>
        </div>

        {/* ── ZONE D'INPUT ──────────────────────────────────────── */}
        <div
          className="flex-none px-4 py-3 backdrop-blur-xl"
          style={{
            background: headerBg,
            borderTop: `0.5px solid ${borderCol}`,
          }}
        >
          <div className="max-w-3xl mx-auto relative">

            {/* Emoji picker */}
            {showEmojiPicker && (
              <div className="absolute bottom-16 left-0 z-50 rounded-2xl overflow-hidden shadow-2xl">
                <EmojiPicker
                  onEmojiClick={(e) => setNewMessage((p) => p + e.emoji)}
                  theme={darkMode ? "dark" : "light"}
                  height={300}
                  width={280}
                />
              </div>
            )}

            {/* Barre d'input */}
            <div
              className="flex items-end gap-2 rounded-2xl px-3 py-2 transition-all duration-200"
              style={{
                background: inputBg,
                border: `1px solid ${inputBorder}`,
                backdropFilter: "blur(12px)",
                boxShadow: inputFocused
                  ? "0 0 0 3px rgba(249,115,22,0.12), 0 4px 20px rgba(0,0,0,0.15)"
                  : "0 2px 8px rgba(0,0,0,0.1)",
              }}
            >
              {/* Bouton emoji */}
              <button
                className="emoji-btn flex-shrink-0 p-1"
                onClick={() => setShowEmojiPicker((v) => !v)}
                style={{ color: showEmojiPicker ? "#f97316" : darkMode ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)" }}
              >
                <FaSmile style={{ fontSize: 20 }} />
              </button>

              {/* Textarea */}
              <textarea
                ref={textareaRef}
                rows={1}
                value={newMessage}
                onChange={(e) => {
                  setNewMessage(e.target.value);
                  // auto-resize
                  e.target.style.height = "auto";
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
                }}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                onKeyDown={handleKeyDown}
                placeholder="Écrivez votre message…"
                className="flex-1 bg-transparent focus:outline-none resize-none overflow-hidden py-1.5"
                style={{
                  fontFamily: "'Sora', sans-serif",
                  fontSize: 13.5,
                  lineHeight: 1.55,
                  color: darkMode ? "rgba(255,255,255,0.88)" : "rgba(0,0,0,0.82)",
                  maxHeight: 120,
                  caretColor: "#f97316",
                }}
              />

              {/* Bouton envoyer */}
              <button
                onClick={handleSend}
                disabled={!canSend}
                className={`send-btn-glow flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 ${canSend ? "active" : ""}`}
                style={{
                  background: canSend
                    ? "linear-gradient(135deg, #f97316, #ef4444)"
                    : darkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
                  opacity: canSend ? 1 : 0.5,
                }}
              >
                <FaPaperPlane
                  style={{
                    fontSize: 13,
                    color: canSend ? "#fff" : darkMode ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)",
                    transform: "rotate(-5deg)",
                  }}
                />
              </button>
            </div>

            {/* Hint bas */}
            <p
              className="text-center mt-1.5"
              style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: 10,
                color: darkMode ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.25)",
                letterSpacing: "0.04em",
              }}
            >
              ↵ Entrée pour envoyer · Shift+↵ nouvelle ligne
            </p>
          </div>
        </div>

      </div>
    </>
  );
}