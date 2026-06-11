import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Send, Paperclip, Bot, User, Sparkles, 
  FileText, Calculator, Lock, ArrowLeft, X, CheckCircle,
  MessageSquare, Zap, Brain, BookOpen, ChevronRight
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useVisionIA } from "../../hooks/useVisionIA";
import EliteCheckout from "../../components/EliteCheckout";

// --- WIDGET DE CALCUL ---
const CalculationWidget = ({ data }) => (
  <div className="my-4 p-4 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-2xl border border-purple-200/50 dark:border-purple-700/30 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2">
    <div className="flex items-center gap-2 mb-3 border-b border-purple-200/50 dark:border-purple-700/30 pb-2">
      <div className="p-1.5 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
        <Calculator className="w-4 h-4 text-purple-600 dark:text-purple-400" />
      </div>
      <span className="font-bold text-sm text-purple-700 dark:text-purple-300">Résultat Technique</span>
    </div>
    <div className="grid grid-cols-2 gap-4 text-sm">
      {Object.entries(data).map(([key, val], i) => (
        <div key={i} className="flex flex-col">
          <span className="text-[10px] text-purple-500 dark:text-purple-400 uppercase tracking-wider font-medium">{key.replace(/_/g, ' ')}</span>
          <span className="font-mono font-semibold text-gray-900 dark:text-white">{val}</span>
        </div>
      ))}
    </div>
  </div>
);

// --- FICHIER ATTACHÉ ---
const FileAttachment = ({ file }) => (
  <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-200/50 dark:border-blue-700/30 max-w-sm mb-2">
    <div className="p-2 bg-white dark:bg-blue-900/50 rounded-lg shadow-sm">
      <FileText className="w-5 h-5 text-blue-500" />
    </div>
    <div className="overflow-hidden">
      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{file.name}</p>
      <p className="text-xs text-blue-500 dark:text-blue-400">Prêt pour analyse</p>
    </div>
  </div>
);

// --- SUGGESTIONS RAPIDES ---
const SUGGESTIONS = [
  { icon: Calculator, label: "Calculer un béton", prompt: "Calcule les proportions pour 1m³ de béton dosage 350kg/m³", color: "from-purple-500 to-pink-500" },
  { icon: BookOpen, label: "Norme BTP", prompt: "Quelles sont les normes NF pour le ferraillage en Côte d'Ivoire ?", color: "from-blue-500 to-cyan-500" },
  { icon: Brain, label: "Conseil technique", prompt: "Donne-moi les étapes pour réaliser une fondation superficielle", color: "from-green-500 to-emerald-500" },
  { icon: Zap, label: "Analyse projet", prompt: "Analyse ce plan de bâtiment et donne-moi les points d'attention", color: "from-orange-500 to-red-500" },
];

// =========================================================
// MAIN COMPONENT
// =========================================================
export default function EngineerChat() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const chatEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const inputRef = useRef(null);

  // States UI
  const [inputValue, setInputValue] = useState("");
  const [showPaywall, setShowPaywall] = useState(false);
  const [activeFile, setActiveFile] = useState(null);

  // Hook IA
  const { 
    messages,
    streamContent,
    sendMessage, 
    connected, 
    typing,
  } = useVisionIA(user?._id);

  // 1. SCROLL AUTO
  useEffect(() => {
    if (chatEndRef.current) {
      requestAnimationFrame(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      });
    }
  }, [messages, streamContent, typing]);

  // 2. GESTION NAVIGATION
  const handleExit = () => navigate(-1);

  // 3. GESTION UPLOAD (PAYWALL)
  const handleAttachmentClick = () => {
    if (!user?.isPremium) {
      setShowPaywall(true); 
    } else {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) setActiveFile(file);
  };

  // 4. ENVOI MESSAGE
  const handleSend = () => {
    if (!inputValue.trim() && !activeFile) return;
    sendMessage(inputValue, { file: activeFile });
    setInputValue("");
    setActiveFile(null);
  };

  const handleSuggestion = (prompt) => {
    setInputValue(prompt);
    inputRef.current?.focus();
  };

  const isEmpty = messages.length === 0 && !typing;

  return (
    <div className="flex flex-col h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900 font-sans text-gray-900 dark:text-gray-100 overflow-hidden relative">
      
      {/* ================= HEADER ================= */}
      <header className="h-16 border-b border-gray-200/80 dark:border-gray-800/80 bg-white/80 dark:bg-gray-950/80 backdrop-blur-xl flex items-center justify-between px-4 z-20 shrink-0">
        
        <div className="flex items-center gap-3">
          <button 
            onClick={handleExit}
            className="p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </button>
          
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/25">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-gray-950 ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
            </div>
            <div>
              <h1 className="font-bold text-base flex items-center gap-2">
                Assistant IA
                <span className="text-[10px] px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-300 rounded-md font-semibold">BETA</span>
              </h1>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">Expert BTP & Génie Civil</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className={`px-2 py-1 rounded-full text-[10px] font-semibold ${connected ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
            {connected ? 'En ligne' : 'Hors ligne'}
          </div>
        </div>
      </header>

      {/* ================= ZONE DE CHAT ================= */}
      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar"
      >
        <div className="max-w-3xl mx-auto space-y-6 pb-4">
          
          {/* État Vide — Design amélioré */}
          {isEmpty && (
            <div className="text-center py-12 animate-in fade-in zoom-in duration-500">
              {/* Logo animé */}
              <div className="relative w-20 h-20 mx-auto mb-6">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl rotate-6 opacity-20 animate-pulse" />
                <div className="relative w-20 h-20 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-xl shadow-purple-500/30">
                  <Sparkles className="w-10 h-10 text-white" />
                </div>
              </div>
              
              <h2 className="text-2xl font-bold mb-2 bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
                Bureau d'Étude Virtuel
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto mb-8">
                Posez une question technique, importez un plan ou demandez un calcul BTP.
              </p>

              {/* Suggestions rapides */}
              <div className="grid grid-cols-2 gap-3 max-w-md mx-auto">
                {SUGGESTIONS.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => handleSuggestion(s.prompt)}
                    className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800/50 rounded-xl border border-gray-200/80 dark:border-gray-700/50 hover:border-purple-300 dark:hover:border-purple-600 hover:shadow-md transition-all text-left group"
                  >
                    <div className={`p-2 rounded-lg bg-gradient-to-br ${s.color} text-white shadow-sm group-hover:scale-110 transition-transform`}>
                      <s.icon className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{s.label}</span>
                    <ChevronRight className="w-3 h-3 text-gray-400 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* MESSAGES */}
          {messages.map((msg, idx) => (
            <div 
              key={msg.id || idx} 
              className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2`}
            >
              
              {msg.role !== 'user' && (
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shrink-0 mt-1 shadow-md shadow-purple-500/20">
                  <Bot className="w-4 h-4 text-white" />
                </div>
              )}

              <div className={`max-w-[85%] md:max-w-[75%] space-y-2`}>
                <div className={`p-4 rounded-2xl shadow-sm ${
                  msg.role === 'user' 
                    ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-br-md shadow-md shadow-blue-500/20' 
                    : 'bg-white dark:bg-gray-800/80 border border-gray-200/80 dark:border-gray-700/50 text-gray-800 dark:text-gray-100 rounded-bl-md shadow-sm backdrop-blur-sm'
                }`}>
                  <p className="whitespace-pre-wrap leading-relaxed text-sm">
                    {msg.content}
                  </p>
                </div>

                {/* Widgets */}
                {msg.calculations && <CalculationWidget data={msg.calculations} />}
                {msg.planData && (
                  <div className="text-xs text-green-500 flex items-center gap-1 mt-1">
                    <CheckCircle className="w-3 h-3"/> Plan analysé
                  </div>
                )}
              </div>

              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 flex items-center justify-center shrink-0 mt-1">
                  <User className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                </div>
              )}
            </div>
          ))}

          {/* INDICATEUR DE FRAPPE */}
          {typing && (
            <div className="flex gap-3 justify-start animate-in fade-in slide-in-from-bottom-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shrink-0 mt-1 shadow-md shadow-purple-500/20">
                <Bot className="w-4 h-4 text-white animate-pulse" />
              </div>
              <div className="max-w-[85%] md:max-w-[75%]">
                <div className="p-4 rounded-2xl bg-white dark:bg-gray-800/80 border border-gray-200/80 dark:border-gray-700/50 rounded-bl-md text-gray-800 dark:text-gray-100 shadow-sm backdrop-blur-sm">
                  {streamContent ? (
                    <p className="whitespace-pre-wrap leading-relaxed text-sm">
                      {streamContent}
                      <span className="inline-block w-0.5 h-4 ml-0.5 bg-purple-500 animate-pulse rounded-full"/>
                    </p>
                  ) : (
                    <div className="flex gap-1.5 items-center py-1">
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"/>
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce [animation-delay:0.15s]"/>
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce [animation-delay:0.3s]"/>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          
          <div ref={chatEndRef} className="h-px" />
        </div>
      </div>

      {/* ================= ZONE DE SAISIE ================= */}
      <div className="p-4 bg-white/80 dark:bg-gray-950/80 border-t border-gray-200/80 dark:border-gray-800/80 backdrop-blur-xl z-20 shrink-0">
        <div className="max-w-3xl mx-auto">
          
          {/* Fichier actif */}
          {activeFile && (
            <div className="mb-2 relative inline-block animate-in slide-in-from-bottom-2">
              <FileAttachment file={activeFile} />
              <button 
                onClick={() => setActiveFile(null)}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:scale-110 transition shadow-sm"
              >
                ×
              </button>
            </div>
          )}

          <div className="relative flex items-end gap-2 bg-gray-100 dark:bg-gray-800/80 border border-gray-200/80 dark:border-gray-700/50 rounded-2xl p-2 focus-within:ring-2 focus-within:ring-purple-500/50 focus-within:border-purple-500 transition-all shadow-sm backdrop-blur-sm">
            
            {/* Bouton Upload */}
            <button
              onClick={handleAttachmentClick}
              className={`p-2.5 rounded-xl transition-colors shrink-0 ${
                  user?.isPremium 
                  ? 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400' 
                  : 'text-yellow-500 hover:bg-yellow-500/10'
              }`}
              title={user?.isPremium ? "Ajouter un plan" : "Fonctionnalité Premium"}
            >
              {user?.isPremium ? <Paperclip className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
            </button>
            
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              accept=".pdf,image/*" 
              className="hidden" 
            />

            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={activeFile ? "Instructions pour ce fichier..." : "Posez votre question technique..."}
              className="flex-1 max-h-32 min-h-[40px] py-2.5 bg-transparent border-none outline-none resize-none text-sm custom-scrollbar placeholder:text-gray-400 dark:placeholder:text-gray-500"
              rows={1}
            />

            <button
              onClick={handleSend}
              disabled={(!inputValue.trim() && !activeFile) || typing}
              className={`p-2.5 rounded-xl transition-all shrink-0 ${
                (inputValue.trim() || activeFile) && !typing
                  ? 'bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white shadow-lg shadow-purple-500/25 hover:scale-105'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
              }`}
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          
          <p className="text-center text-[10px] text-gray-400 dark:text-gray-500 mt-2">
            IA Générative — Vérifiez les calculs critiques. Entrée pour envoyer.
          </p>
        </div>
      </div>

      {/* MODAL PAIEMENT */}
      {showPaywall && (
        <EliteCheckout 
          onClose={() => setShowPaywall(false)}
          onSuccess={() => setShowPaywall(false)}
          user={user}
        />
      )}
    </div>
  );
}