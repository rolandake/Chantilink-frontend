// src/pages/Chat/ChatPage.jsx - VERSION CORRIGÉE SIMPLIFIÉE
import React, { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import EmojiPicker from "emoji-picker-react";
import { FaSmile, FaSun, FaMoon, FaRobot, FaCheckCircle, FaExclamationTriangle } from "react-icons/fa";
import { useAuth } from "../../context/AuthContext";

const getInitials = (name) => {
  if (!name) return "?";
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
};

const Avatar = ({ name, isAI = false, className = "" }) => {
  const initials = isAI ? "AI" : getInitials(name);
  const bgColor = isAI ? "bg-gradient-to-br from-blue-500 to-purple-600" : "bg-gradient-to-br from-orange-500 to-red-600";
  return (
    <div className={`${className} ${bgColor} rounded-full flex items-center justify-center text-white font-bold shadow-lg`}>
      {initials}
    </div>
  );
};

const ProviderBadge = ({ provider, status }) => {
  const colors = {
    Anthropic: "from-purple-500 to-pink-500",
    OpenAI: "from-green-500 to-teal-500",
    Groq: "from-orange-500 to-red-500",
    Gemini: "from-blue-500 to-cyan-500",
    Cohere: "from-indigo-500 to-purple-500",
    HuggingFace: "from-yellow-500 to-orange-500",
    XAI: "from-gray-500 to-gray-700",
  };
  
  return (
    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gradient-to-r ${colors[provider] || "from-gray-500 to-gray-600"} text-white`}>
      {status === "active" ? <FaCheckCircle /> : <FaExclamationTriangle />}
      {provider}
    </div>
  );
};

export default function ChatPage() {
  // ✅ Utiliser AuthContext
  const { user, getToken } = useAuth();
  
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [currentProvider, setCurrentProvider] = useState(null);
  const [aiProviders, setAiProviders] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [typingText, setTypingText] = useState("");
  
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const socketRef = useRef(null);
  const roomId = useRef(`chat-${user?.id || 'guest'}-${Date.now()}`);
  const pendingReplyId = useRef(null);
  const typingTextRef = useRef("");

  // ✅ CONNEXION SOCKET SIMPLIFIÉE - Utilise directement getToken()
  useEffect(() => {
    if (!user?.id) {
      console.warn("[Chat] ⚠️ Utilisateur non connecté");
      return;
    }

    let mounted = true;
    
    const connectSocket = async () => {
      // ✅ getToken() gère automatiquement le refresh si nécessaire
      const token = await getToken();
      
      if (!token) {
        console.error("[Chat] ❌ Aucun token disponible");
        return;
      }

      if (!mounted) return;

      console.log("[Chat] 🔌 Token obtenu, connexion socket...");

      // Déterminer l'URL du socket
      const isDevelopment = 
        import.meta.env.DEV || 
        import.meta.env.MODE === 'development' ||
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1';

      const SOCKET_URL = isDevelopment
        ? (import.meta.env.VITE_SOCKET_URL_DEV || 'http://localhost:5000')
        : (import.meta.env.VITE_SOCKET_URL_PROD || 'https://chantilink-backend.onrender.com');
      
      console.log("[Chat] 🌍 Connexion à:", SOCKET_URL);
      
      // Créer la connexion socket
      socketRef.current = io(`${SOCKET_URL}/gpt`, {
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
        auth: { token },
      });

      const socket = socketRef.current;

      // ========================================
      // HANDLERS SOCKET
      // ========================================

      socket.on("connect", () => {
        console.log("[Chat] ✅ Socket connecté:", socket.id);
        setIsConnected(true);
        socket.emit("joinRoom", roomId.current);
        socket.emit("getAIStatus");
      });

      socket.on("disconnect", (reason) => {
        console.log("[Chat] ❌ Socket déconnecté:", reason);
        setIsConnected(false);
      });

      socket.on("connect_error", async (error) => {
        console.error("[Chat] 💥 Erreur de connexion:", error.message);
        
        // ✅ Si TOKEN_EXPIRED, AuthContext va auto-refresh au prochain getToken()
        // On déconnecte et on va reconnecter automatiquement
        if (error.message === "TOKEN_EXPIRED" || error.message.includes("jwt expired")) {
          console.log("[Chat] 🔄 Token expiré détecté, reconnexion dans 2s...");
          
          if (socketRef.current) {
            socketRef.current.disconnect();
          }
          
          // Attendre 2 secondes puis reconnecter (getToken va auto-refresh)
          setTimeout(() => {
            if (mounted) {
              connectSocket();
            }
          }, 2000);
        }
      });

      socket.on("reconnect_attempt", (attemptNumber) => {
        console.log("[Chat] 🔄 Reconnexion tentative #", attemptNumber);
      });

      socket.on("roomJoined", (data) => {
        console.log("[Chat] 🏠 Room rejoint:", data);
      });

      socket.on("aiStatus", ({ providers }) => {
        console.log("[Chat] 🤖 IA disponibles:", providers.length);
        setAiProviders(providers);
      });

      socket.on("receiveGPTMessage", ({ replyId, role, content, typing, provider }) => {
        if (replyId !== pendingReplyId.current) return;

        if (provider) {
          setCurrentProvider(provider);
        }

        if (typing) {
          setIsTyping(true);
          setTypingText(prev => prev + content);
        } else {
          setIsTyping(false);
          
          setMessages(prev => {
            const filtered = prev.filter(m => m._id !== pendingReplyId.current);
            return [...filtered, {
              _id: pendingReplyId.current,
              sender: "ai",
              content: typingTextRef.current || content,
              timestamp: Date.now(),
              provider: currentProvider,
            }];
          });
          
          setTypingText("");
          pendingReplyId.current = null;
          setCurrentProvider(null);
        }
      });

      socket.on("error", ({ message, code }) => {
        console.error("[Chat] ❌ Erreur:", code, message);
        setIsTyping(false);
        
        if (pendingReplyId.current) {
          setMessages(prev => [...prev, {
            _id: `error-${Date.now()}`,
            sender: "ai",
            content: `❌ Erreur: ${message}`,
            timestamp: Date.now(),
            isError: true,
          }]);
          pendingReplyId.current = null;
        }
      });
    };
    
    connectSocket();
    
    return () => {
      mounted = false;
      if (socketRef.current) {
        socketRef.current.emit("leaveRoom", roomId.current);
        socketRef.current.disconnect();
      }
    };
  }, [user, getToken]); // ✅ Dépendances correctes

  // Ref pour le texte en cours de frappe
  useEffect(() => {
    typingTextRef.current = typingText;
  }, [typingText]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingText]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [newMessage]);

  const handleSend = async () => {
    if (!newMessage.trim() || !socketRef.current?.connected) return;

    const userMsg = {
      _id: `user-${Date.now()}`,
      sender: "user",
      content: newMessage.trim(),
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMsg]);
    setNewMessage("");
    setTypingText("");
    typingTextRef.current = "";

    const replyId = `ai-${Date.now()}`;
    pendingReplyId.current = replyId;

    const userContext = {
      fullName: user?.fullName,
      email: user?.email,
      role: user?.role,
      isPremium: user?.isPremium,
      location: user?.location,
    };

    socketRef.current.emit("sendChatMessage", {
      roomId: roomId.current,
      replyId,
      message: userMsg.content,
      userContext,
    });
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const bgClass = darkMode ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-800";
  const inputBg = darkMode ? "bg-gray-800" : "bg-white";
  const borderColor = darkMode ? "border-gray-700" : "border-gray-300";

  return (
    <div className={`fixed inset-0 flex flex-col ${bgClass}`}>
      {/* HEADER FIXE */}
      <div className={`flex-none p-4 shadow-lg border-b ${darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"} backdrop-blur-xl z-40`}>
        <div className="flex justify-between items-center max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <Avatar name="AI" isAI={true} className="w-10 h-10 text-sm" />
            <div>
              <h1 className="font-bold text-lg flex items-center gap-2">
                Assistant IA Multi-Providers
                {isConnected ? (
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                ) : (
                  <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                )}
              </h1>
              <div className="flex gap-2 flex-wrap">
                {aiProviders.length > 0 ? (
                  aiProviders.slice(0, 3).map(p => (
                    <ProviderBadge key={p.name} provider={p.name} status={p.status} />
                  ))
                ) : (
                  <p className="text-xs opacity-70">Chargement des IA...</p>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className={`p-3 rounded-full transition-all ${darkMode ? "hover:bg-gray-700" : "hover:bg-gray-200"}`}
          >
            {darkMode ? <FaSun className="text-yellow-400 text-xl" /> : <FaMoon className="text-gray-600 text-xl" />}
          </button>
        </div>
      </div>

      {/* MESSAGES SCROLLABLES */}
      <div className="flex-1 overflow-y-auto px-4 py-6 scrollbar-thin scrollbar-thumb-orange-500">
        <div className="max-w-4xl mx-auto space-y-5 pb-24">
          {messages.length === 0 && !isTyping && (
            <div className="text-center py-20">
              <FaRobot className="text-6xl mx-auto mb-4 text-purple-500" />
              <p className="text-2xl font-bold mb-2">Assistant IA Multi-Providers</p>
              <p className="text-lg opacity-70">Bascule automatique entre 7 IA</p>
              <div className="mt-6 flex flex-wrap gap-2 justify-center">
                {aiProviders.map(p => (
                  <ProviderBadge key={p.name} provider={p.name} status={p.status} />
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => {
            const isUser = msg.sender === "user";
            return (
              <div key={msg._id} className={`flex items-end gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
                {!isUser && <Avatar name="AI" isAI={true} className="w-9 h-9" />}
                
                <div className={`px-5 py-3 rounded-3xl max-w-xs lg:max-w-md shadow-xl ${
                  isUser
                    ? "bg-gradient-to-r from-orange-500 to-pink-500 text-white"
                    : msg.isError
                    ? "bg-red-500/20 border border-red-500 text-red-300"
                    : darkMode ? "bg-gray-800 text-white" : "bg-white text-gray-800"
                }`}>
                  <p className="text-sm lg:text-base whitespace-pre-wrap">{msg.content}</p>
                  <div className="flex items-center justify-between mt-2">
                    <p className={`text-xs opacity-70 ${isUser ? "text-white/80" : ""}`}>
                      {new Date(msg.timestamp).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                    {!isUser && msg.provider && (
                      <ProviderBadge provider={msg.provider} status="active" />
                    )}
                  </div>
                </div>

                {isUser && <Avatar name={user?.fullName || "You"} className="w-9 h-9" />}
              </div>
            );
          })}

          {/* Message en cours de frappe */}
          {isTyping && typingText && (
            <div className="flex items-end gap-3">
              <Avatar name="AI" isAI={true} className="w-9 h-9" />
              <div className={`px-5 py-3 rounded-3xl max-w-xs lg:max-w-md shadow-xl ${darkMode ? "bg-gray-800 text-white" : "bg-white text-gray-800"}`}>
                <p className="text-sm lg:text-base whitespace-pre-wrap">{typingText}</p>
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-purple-500 rounded-full animate-bounce"></span>
                    <span className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></span>
                    <span className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></span>
                  </div>
                  {currentProvider && (
                    <ProviderBadge provider={currentProvider} status="active" />
                  )}
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* INPUT FIXE AU-DESSUS DE LA BARRE MOBILE */}
      <div className={`
        fixed bottom-16 left-0 right-0 
        p-3 pb-safe 
        ${darkMode ? "bg-gray-900/95" : "bg-white/95"} 
        backdrop-blur-2xl 
        border-t ${borderColor} 
        z-50
      `}>
        <div className="max-w-4xl mx-auto">
          {/* Emoji Picker */}
          {showEmojiPicker && (
            <div className="absolute bottom-20 left-4 z-50 mb-2">
              <div className="shadow-2xl rounded-2xl overflow-hidden border border-gray-700">
                <EmojiPicker
                  onEmojiClick={(e) => {
                    setNewMessage(prev => prev + e.emoji);
                    setShowEmojiPicker(false);
                  }}
                  theme={darkMode ? "dark" : "light"}
                  height={350}
                />
              </div>
            </div>
          )}

          <div className="flex items-end gap-3">
            <button
              onClick={() => setShowEmojiPicker(prev => !prev)}
              className={`p-3 rounded-full transition-all ${darkMode ? "hover:bg-gray-700" : "hover:bg-gray-200"}`}
            >
              <FaSmile className="text-xl text-orange-500" />
            </button>

            <div className={`flex-1 ${inputBg} rounded-3xl border ${borderColor} shadow-lg overflow-hidden`}>
              <textarea
                ref={textareaRef}
                rows={1}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isConnected ? "Posez votre question..." : "Connexion en cours..."}
                disabled={!isConnected || isTyping}
                className={`w-full px-4 py-3 resize-none bg-transparent focus:outline-none max-h-32 ${darkMode ? "text-white placeholder-gray-500" : "text-gray-800 placeholder-gray-400"}`}
              />
            </div>

            <button
              onClick={handleSend}
              disabled={!newMessage.trim() || !isConnected || isTyping}
              className={`px-6 py-3 rounded-full font-bold transition-all shadow-lg ${
                newMessage.trim() && isConnected && !isTyping
                  ? "bg-gradient-to-r from-orange-500 to-pink-500 text-white hover:shadow-xl"
                  : "bg-gray-400 text-gray-600 cursor-not-allowed"
              }`}
            >
              {isTyping ? "..." : "Envoyer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}