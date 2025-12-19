// src/pages/Chat/ChatPage.jsx - VERSION STABLE ET NETTOYÉE
import React, { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import EmojiPicker from "emoji-picker-react";
import { FaSmile, FaSun, FaMoon, FaRobot, FaCheckCircle, FaExclamationTriangle, FaPaperPlane } from "react-icons/fa";
import { useAuth } from "../../context/AuthContext";

// --- HELPERS ---
const getInitials = (name) => {
  if (!name) return "?";
  const words = name.trim().split(/\s+/);
  return words.length === 1 
    ? words[0].substring(0, 2).toUpperCase() 
    : (words[0][0] + words[words.length - 1][0]).toUpperCase();
};

const Avatar = ({ name, isAI = false, className = "" }) => {
  const initials = isAI ? "AI" : getInitials(name);
  const bgColor = isAI ? "bg-gradient-to-br from-blue-500 to-purple-600" : "bg-gradient-to-br from-orange-500 to-red-600";
  return (
    <div className={`${className} ${bgColor} rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold shadow-lg`}>
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
  };
  return (
    <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-gradient-to-r ${colors[provider] || "from-gray-500 to-gray-600"} text-white`}>
      {status === "active" ? <FaCheckCircle size={8} /> : <FaExclamationTriangle size={8} />}
      {provider}
    </div>
  );
};

// --- COMPOSANT PRINCIPAL ---
export default function ChatPage() {
  const { user, getToken } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [aiProviders, setAiProviders] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const socketRef = useRef(null);
  const roomId = useRef(`chat-${user?._id || 'guest'}-${Date.now()}`);

  // 1. CONNEXION SOCKET
  useEffect(() => {
    if (!user?._id) return;
    let mounted = true;

    const connectSocket = async () => {
      const token = await getToken();
      if (!token || !mounted) return;

      const SOCKET_URL = window.location.hostname === 'localhost' 
        ? 'http://localhost:5000' 
        : 'https://chantilink-backend.onrender.com';
      
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

      // 🚀 RÉCEPTION DU TEXTE EN STREAMING (Correction du texte qui disparait)
      socket.on("receiveGPTMessage", ({ replyId, content, typing, provider }) => {
        setIsTyping(typing);

        setMessages((prev) => {
          const existingMsgIndex = prev.findIndex((m) => m._id === replyId);

          if (existingMsgIndex !== -1) {
            const updatedMessages = [...prev];
            const oldMsg = updatedMessages[existingMsgIndex];
            updatedMessages[existingMsgIndex] = {
              ...oldMsg,
              content: typing ? oldMsg.content + content : oldMsg.content,
              provider: provider || oldMsg.provider,
            };
            return updatedMessages;
          } else {
            return [...prev, {
              _id: replyId,
              sender: "ai",
              content: content,
              timestamp: Date.now(),
              provider: provider,
            }];
          }
        });
      });
    };
    
    connectSocket();
    return () => {
      mounted = false;
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [user?._id, getToken]);

  // 2. AUTO-SCROLL
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // 3. ENVOI MESSAGE
  const handleSend = () => {
    if (!newMessage.trim() || !socketRef.current?.connected) return;

    const userMsg = {
      _id: `user-${Date.now()}`,
      sender: "user",
      content: newMessage.trim(),
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    
    const replyId = `ai-${Date.now()}`;
    socketRef.current.emit("sendChatMessage", {
      roomId: roomId.current,
      replyId,
      message: newMessage.trim(),
      userContext: user,
    });

    setNewMessage("");
    setShowEmojiPicker(false);
  };

  const bgClass = darkMode ? "bg-gray-950 text-white" : "bg-gray-50 text-gray-900";

  return (
    <div className={`relative h-full flex flex-col overflow-hidden ${bgClass}`}>
      
      {/* HEADER IA */}
      <div className={`flex-none p-3 border-b backdrop-blur-md z-20 ${darkMode ? "bg-gray-950/80 border-gray-800" : "bg-white/80 border-gray-200"}`}>
        <div className="flex justify-between items-center max-w-4xl mx-auto">
          <div className="flex items-center gap-2">
            <Avatar name="AI" isAI={true} className="w-8 h-8" />
            <div>
              <p className="text-sm font-bold flex items-center gap-1">
                Assistant IA
                <span className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500 animate-pulse" : "bg-red-500"}`}></span>
              </p>
            </div>
          </div>
          <button onClick={() => setDarkMode(!darkMode)} className="p-2 rounded-full hover:bg-gray-500/10 transition-colors">
            {darkMode ? <FaSun className="text-yellow-400" /> : <FaMoon className="text-gray-600" />}
          </button>
        </div>
      </div>

      {/* ZONE MESSAGES (SCROLLABLE) */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4 scrollbar-none">
        <div className="max-w-4xl mx-auto">
          {messages.length === 0 && !isTyping && (
            <div className="text-center py-20 opacity-30">
              <FaRobot size={50} className="mx-auto mb-4" />
              <p>Commencez une discussion avec l'intelligence artificielle.</p>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg._id} className={`flex items-end gap-2 mb-4 ${msg.sender === "user" ? "flex-row-reverse" : "flex-row"}`}>
              <Avatar name={msg.sender === "user" ? user?.fullName : "AI"} isAI={msg.sender !== "user"} className="w-8 h-8 text-[10px]" />
              <div className={`px-4 py-2 rounded-2xl max-w-[85%] shadow-sm ${
                msg.sender === "user" ? "bg-orange-500 text-white" : darkMode ? "bg-gray-800" : "bg-white border"
              }`}>
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                {msg.provider && <div className="mt-1"><ProviderBadge provider={msg.provider} status="active" /></div>}
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex items-end gap-2 mb-4">
              <Avatar name="AI" isAI={true} className="w-8 h-8 text-[10px]" />
              <div className={`px-4 py-2 rounded-2xl ${darkMode ? "bg-gray-800" : "bg-white border"}`}>
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-bounce"></span>
                  <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                  <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} className="h-2" />
        </div>
      </div>

      {/* INPUT FIXE */}
      <div className={`flex-none p-3 pb-safe border-t ${darkMode ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200"}`}>
        <div className="max-w-4xl mx-auto relative flex items-center gap-2">
          
          {showEmojiPicker && (
            <div className="absolute bottom-16 left-0 z-50">
              <EmojiPicker 
                onEmojiClick={(e) => setNewMessage(p => p + e.emoji)} 
                theme={darkMode ? "dark" : "light"}
                height={320} width={280}
              />
            </div>
          )}

          <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="p-2 text-orange-500 hover:scale-110 transition-transform">
            <FaSmile size={24} />
          </button>
          
          <div className={`flex-1 flex items-center rounded-2xl px-3 border ${darkMode ? "bg-gray-800 border-gray-700" : "bg-gray-100 border-gray-200"}`}>
            <textarea
              ref={textareaRef}
              rows={1}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Écrivez votre message..."
              className="flex-1 bg-transparent py-3 text-sm focus:outline-none resize-none max-h-32"
              onKeyDown={(e) => { if(e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            />
            <button 
              onClick={handleSend} 
              disabled={!newMessage.trim() || isTyping} 
              className={`p-2 transition-all ${newMessage.trim() && !isTyping ? "text-orange-500 scale-110" : "text-gray-400"}`}
            >
              <FaPaperPlane size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}