import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Send, Paperclip, Bot, User, Sparkles, 
  FileText, Calculator, Lock, ArrowLeft, X, CheckCircle
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useVisionIA } from "../../hooks/useVisionIA";
import EliteCheckout from "../../components/EliteCheckout";

// --- WIDGET DE CALCUL ---
const CalculationWidget = ({ data }) => (
  <div className="my-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2">
    <div className="flex items-center gap-2 mb-3 border-b border-gray-200 dark:border-gray-700 pb-2">
      <Calculator className="w-4 h-4 text-purple-500" />
      <span className="font-bold text-sm text-gray-700 dark:text-gray-200">Résultat Technique</span>
    </div>
    <div className="grid grid-cols-2 gap-4 text-sm">
      {Object.entries(data).map(([key, val], i) => (
        <div key={i} className="flex flex-col">
          <span className="text-xs text-gray-500 uppercase">{key.replace(/_/g, ' ')}</span>
          <span className="font-mono font-medium text-gray-900 dark:text-white">{val}</span>
        </div>
      ))}
    </div>
  </div>
);

// --- FICHIER ATTACHÉ ---
const FileAttachment = ({ file }) => (
  <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800/50 max-w-sm mb-2">
    <div className="p-2 bg-white dark:bg-blue-900 rounded-lg">
      <FileText className="w-5 h-5 text-blue-500" />
    </div>
    <div className="overflow-hidden">
      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{file.name}</p>
      <p className="text-xs text-gray-500">Prêt pour analyse</p>
    </div>
  </div>
);

// =========================================================
// MAIN COMPONENT
// =========================================================
export default function EngineerChat() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const chatEndRef = useRef(null);
  const chatContainerRef = useRef(null);

  // States UI
  const [inputValue, setInputValue] = useState("");
  const [showPaywall, setShowPaywall] = useState(false);
  const [activeFile, setActiveFile] = useState(null);

  // Hook IA
  const { 
    messages,        // Liste des messages confirmés (historique)
    streamContent,   // 🔥 Le bout de texte en train d'être écrit (IMPORTANT)
    sendMessage, 
    connected, 
    typing,
  } = useVisionIA(user?._id);

  // 1. SCROLL AUTO (Stabilisé)
  // On scroll à chaque fois que l'historique change OU que le stream avance
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, streamContent, typing]);

  // 2. GESTION NAVIGATION (RETOUR)
  const handleExit = () => {
    // On peut naviguer vers le dashboard ou la page précédente
    navigate(-1); 
  };

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

    // Détection basique pour inciter au premium sur les calculs complexes sans fichier
    const isComplex = /calcul|dimension|poutre|charge/i.test(inputValue);
    if (isComplex && !user?.isPremium && !activeFile) {
       // Optionnel: afficher une alerte ou laisser passer
    }

    sendMessage(inputValue, { file: activeFile });
    setInputValue("");
    setActiveFile(null);
  };

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-gray-950 font-sans text-gray-900 dark:text-gray-100 overflow-hidden relative">
      
      {/* ================= HEADER (BARRE SUPÉRIEURE) ================= */}
      <header className="h-16 border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-950/80 backdrop-blur-md flex items-center justify-between px-4 z-20 shrink-0">
        
        {/* Gauche: Info IA */}
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          <div>
            <h1 className="font-bold text-lg flex items-center gap-2">
              Vision IA <span className="text-xs px-2 py-0.5 bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-300 rounded-full">BETA</span>
            </h1>
            <p className="text-xs text-gray-500">Expert BTP & Génie Civil</p>
          </div>
        </div>

        {/* Droite: Bouton Quitter */}
        <button 
          onClick={handleExit}
          className="p-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"
          title="Fermer la discussion"
        >
          <X className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        </button>
      </header>

      {/* ================= ZONE DE CHAT ================= */}
      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar"
      >
        <div className="max-w-3xl mx-auto space-y-6 pb-4">
          
          {/* État Vide */}
          {messages.length === 0 && !typing && (
            <div className="text-center py-20 opacity-60 animate-in fade-in zoom-in duration-500">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-2xl mx-auto flex items-center justify-center mb-4 rotate-3">
                <Sparkles className="w-8 h-8 text-purple-500" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Bureau d'Étude Virtuel</h2>
              <p className="text-sm text-gray-500 max-w-xs mx-auto">
                Posez une question technique ou importez un plan pour commencer l'analyse.
              </p>
            </div>
          )}

          {/* 1. MESSAGES DE L'HISTORIQUE (Confirmés) */}
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              
              {msg.role !== 'user' && (
                <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0 mt-1">
                  <Bot className="w-5 h-5 text-purple-600" />
                </div>
              )}

              <div className={`max-w-[85%] md:max-w-[75%] space-y-2`}>
                <div className={`p-4 rounded-2xl shadow-sm ${
                  msg.role === 'user' 
                    ? 'bg-blue-600 text-white rounded-br-none' 
                    : 'bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-gray-800 dark:text-gray-100 rounded-tl-none'
                }`}>
                  <p className="whitespace-pre-wrap leading-relaxed text-sm md:text-base">
                    {msg.content}
                  </p>
                </div>

                {/* Widgets inclus dans l'historique */}
                {msg.calculations && <CalculationWidget data={msg.calculations} />}
                {msg.planData && (
                    <div className="text-xs text-green-500 flex items-center gap-1 mt-1">
                      <CheckCircle className="w-3 h-3"/> Plan analysé
                    </div>
                )}
              </div>

              {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center shrink-0 mt-1">
                    <User className="w-5 h-5 text-gray-500" />
                  </div>
              )}
            </div>
          ))}

          {/* 2. MESSAGE EN COURS D'ÉCRITURE (Streaming) */}
          {/* C'est ICI la correction : on affiche ce qui arrive en temps réel */}
          {typing && (
            <div className="flex gap-4 justify-start">
              <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0 mt-1">
                <Bot className="w-5 h-5 text-purple-600" />
              </div>
              <div className="max-w-[85%] md:max-w-[75%]">
                <div className="p-4 rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-tl-none text-gray-800 dark:text-gray-100 shadow-sm">
                  {streamContent ? (
                    <p className="whitespace-pre-wrap leading-relaxed text-sm md:text-base animate-pulse-fast">
                      {streamContent}
                      <span className="inline-block w-2 h-4 ml-1 bg-purple-500 align-middle animate-blink"/>
                    </p>
                  ) : (
                    /* Indicateur de chargement si le texte n'a pas encore commencé */
                    <div className="flex gap-1 h-6 items-center">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"/>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]"/>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.4s]"/>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {/* Ancre invisible pour le scroll */}
          <div ref={chatEndRef} className="h-1" />
        </div>
      </div>

      {/* ================= ZONE DE SAISIE (INPUT) ================= */}
      <div className="p-4 bg-white dark:bg-gray-950 border-t border-gray-200 dark:border-gray-800 z-20 shrink-0">
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

          <div className="relative flex items-end gap-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-2xl p-2 focus-within:ring-2 focus-within:ring-purple-500/50 focus-within:border-purple-500 transition-all shadow-sm">
            
            {/* Bouton Upload / Paywall */}
            <button
              onClick={handleAttachmentClick}
              className={`p-3 rounded-xl transition-colors shrink-0 ${
                  user?.isPremium 
                  ? 'hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-500' 
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
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={activeFile ? "Instructions pour ce fichier..." : "Posez votre question technique..."}
              className="flex-1 max-h-32 min-h-[44px] py-3 bg-transparent border-none outline-none resize-none text-sm md:text-base custom-scrollbar"
              rows={1}
            />

            <button
              onClick={handleSend}
              disabled={(!inputValue.trim() && !activeFile) || typing}
              className={`p-3 rounded-xl transition-all shrink-0 ${
                (inputValue.trim() || activeFile) && !typing
                  ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-md hover:scale-105'
                  : 'bg-gray-200 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
              }`}
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          
          <p className="text-center text-[10px] text-gray-400 mt-2">
            IA Générative - Vérifiez les calculs critiques. Appuyez sur Entrée pour envoyer.
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