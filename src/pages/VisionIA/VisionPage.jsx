// src/pages/VisionIA/VisionPage.jsx - VERSION DEBUG
import React, { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import { useDarkMode } from "../../context/DarkModeContext.jsx";
import { useVisionIA } from "../../hooks/useVisionIA.js";
import CheckoutButton from "../../components/CheckoutButton.jsx";

import PlanManager from "./components/PlanManager.jsx";
import ChatWindow from "./components/ChatWindow.jsx";
import VoiceButton from "./components/VoiceButton.jsx";
import CalculationEngine from "./components/CalculationEngine.jsx";

export default function VisionPage() {
  const { user } = useAuth();
  const { isDarkMode } = useDarkMode();

  const [projectType, setProjectType] = useState("tp");
  const [engineerMode, setEngineerMode] = useState("structural");
  const [projectPhase, setProjectPhase] = useState("conception");
  const [localMessages, setLocalMessages] = useState([]);
  const [currentPlanSummary, setCurrentPlanSummary] = useState("");
  const [activePlan, setActivePlan] = useState(null);
  const [extractedData, setExtractedData] = useState(null);
  const [calculations, setCalculations] = useState({});
  const [inputValue, setInputValue] = useState("");
  const [showCheckout, setShowCheckout] = useState(false);

  const chatContainerRef = useRef(null);

  // ✅ Debug - Vérifier que setActivePlan existe
  useEffect(() => {
    console.log("🔍 [VisionPage] setActivePlan type:", typeof setActivePlan);
    console.log("🔍 [VisionPage] setActivePlan value:", setActivePlan);
  }, []);

  // Hook VisionIA
  const {
    connected: visionConnected,
    typing: visionTyping,
    currentProvider,
    messages: socketMessages,
    sendMessage: sendVisionMessage
  } = useVisionIA(user?._id, projectType, engineerMode);

  // ✅ FUSION CORRECTE des messages
  const allMessages = React.useMemo(() => {
    const combined = [...localMessages];
    
    socketMessages.forEach(socketMsg => {
      const exists = combined.some(m => m.id === socketMsg.id);
      if (!exists) {
        combined.push(socketMsg);
      }
    });
    
    return combined.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  }, [localMessages, socketMessages]);

  const handleAddMessage = useCallback((msg) => {
    setLocalMessages(prev => [...prev, { 
      ...msg, 
      id: msg.id || `local-${Date.now()}-${Math.random()}`,
      timestamp: msg.timestamp || Date.now()
    }]);
  }, []);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [allMessages, visionTyping]);

  const send = () => {
    if (!inputValue.trim()) return;
    
    handleAddMessage({ 
      role: "user", 
      content: inputValue,
      timestamp: Date.now()
    });
    
    sendVisionMessage(inputValue, { 
      planData: extractedData, 
      calculations, 
      phase: projectPhase 
    });
    
    setInputValue("");
  };

  useEffect(() => {
    if (!user?._id) return;
    
    const interval = setInterval(async () => {
      try {
        await fetch("/api/projects/save", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`
          },
          body: JSON.stringify({
            userId: user._id,
            projectId: `vision-${user._id}-${projectType}-${engineerMode}`,
            name: `Projet ${new Date().toLocaleDateString()}`,
            type: projectType,
            phase: projectPhase,
            plans: [],
            calculations,
            messages: allMessages
          })
        });
      } catch (err) {
        console.error("[VisionPage] Erreur sauvegarde:", err);
      }
    }, 30000);
    
    return () => clearInterval(interval);
  }, [user?._id, projectType, engineerMode, projectPhase, calculations, allMessages]);

  return (
    <div className={`h-screen flex flex-col ${isDarkMode ? 'bg-black' : 'bg-gray-100'} text-white`}>
      {/* HEADER */}
      <div className="p-4 bg-gradient-to-r from-purple-900 to-indigo-900 shadow-2xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-yellow-400 to-pink-500">
              VISIONIA — BUREAU D'ÉTUDE IA
            </h1>
            <p className="text-sm text-gray-300">Grok-3 Vision • Analyse Plans • Calculs Temps Réel</p>
          </div>
          
          <div className="flex items-center gap-4">
            <span className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
              visionConnected 
                ? 'bg-green-500/20 text-green-400 ring-2 ring-green-500/50' 
                : 'bg-red-500/20 text-red-400 ring-2 ring-red-500/50'
            }`}>
              {visionConnected ? '🟢 EN LIGNE' : '🔴 HORS LIGNE'}
            </span>
            
            {currentProvider && (
              <span className="px-3 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full border border-blue-500/30">
                🤖 {currentProvider}
              </span>
            )}
            
            {!user?.isPremium && (
              <button 
                onClick={() => setShowCheckout(true)} 
                className="px-6 py-2 bg-gradient-to-r from-yellow-500 to-orange-600 rounded-xl font-bold hover:scale-105 transition-transform"
              >
                ⭐ PASSER ÉLITE
              </button>
            )}
          </div>
        </div>
      </div>

      {showCheckout && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-50 flex items-center justify-center p-8">
          <div className="relative bg-gray-900 rounded-2xl p-8 max-w-md w-full shadow-2xl">
            <button 
              onClick={() => setShowCheckout(false)} 
              className="absolute -top-12 right-0 text-4xl text-gray-400 hover:text-white transition-colors"
            >
              ✕
            </button>
            <h2 className="text-2xl font-bold text-center mb-6">Accès ÉLITE requis</h2>
            <CheckoutButton plan="elite" />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        
        {/* SIDEBAR GAUCHE - Plans */}
        <div className="w-full md:w-80 p-4 bg-gray-900/50 border-b md:border-r md:border-b-0 overflow-y-auto">
          {/* ✅ DEBUG - Afficher les props passées */}
          <div className="mb-2 p-2 bg-blue-900/20 rounded text-xs">
            <p>Debug Props:</p>
            <p>✅ setActivePlan: {typeof setActivePlan}</p>
            <p>✅ activePlan: {activePlan ? '✓' : '✗'}</p>
          </div>

          <PlanManager
            projectType={projectType}
            setCurrentPlanSummary={setCurrentPlanSummary}
            setActivePlan={setActivePlan}
            handleAddMessage={handleAddMessage}
            user={user}
            setExtractedData={setExtractedData}
            setCalculations={setCalculations}
          />
          
          {currentPlanSummary && (
            <div className="mt-4 p-3 bg-purple-900/30 rounded-lg border border-purple-500">
              <p className="text-xs text-purple-300">📐 Plan actif :</p>
              <p className="text-sm font-medium text-purple-100 truncate">{currentPlanSummary}</p>
            </div>
          )}
        </div>

        {/* ZONE CENTRALE - Chat */}
        <div className="flex-1 flex flex-col">
          <div 
            ref={chatContainerRef} 
            className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4"
          >
            {allMessages.length === 0 && !visionTyping && (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center max-w-md">
                  <div className="text-6xl mb-4">🏗️</div>
                  <p className="text-xl mb-2 text-white">Bienvenue dans VISIONIA</p>
                  <p className="text-sm text-gray-400">
                    Bureau d'étude intelligent propulsé par Grok-3
                  </p>
                  <div className="mt-6 space-y-2 text-left bg-gray-800 p-4 rounded-lg">
                    <p className="text-xs text-gray-400">✅ Charger un plan</p>
                    <p className="text-xs text-gray-400">✅ Poser une question technique</p>
                    <p className="text-xs text-gray-400">✅ Obtenir des calculs instantanés</p>
                  </div>
                </div>
              </div>
            )}
            
            <ChatWindow messages={allMessages} activePlan={activePlan} />
            
            {visionTyping && (
              <div className="flex items-center gap-2 text-purple-400 p-4 bg-purple-900/20 rounded-lg border border-purple-500/30">
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                <span className="ml-2">🤖 {currentProvider || 'Grok-3'} réfléchit...</span>
              </div>
            )}
          </div>

          {/* INPUT ZONE */}
          <div className="p-4 bg-gray-900/80 border-t border-gray-700">
            <div className="flex gap-2 md:gap-3">
              <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder={visionConnected ? "💬 Posez votre question technique..." : "⚠️ Connexion en cours..."}
                className="flex-1 p-3 md:p-4 rounded-xl bg-gray-800 text-white placeholder-gray-500 focus:ring-4 focus:ring-purple-500 outline-none resize-none text-sm md:text-base"
                rows="2"
                disabled={!visionConnected}
              />
              
              <button
                onClick={send}
                disabled={!inputValue.trim() || visionTyping || !visionConnected}
                className="px-4 md:px-6 py-3 md:py-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl font-bold text-sm md:text-base disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 transition-transform"
              >
                📤
              </button>
              
              <VoiceButton onTranscript={setInputValue} />
            </div>
          </div>
        </div>

        {/* SIDEBAR DROITE - Calculs */}
        {extractedData && Object.keys(calculations).length > 0 && (
          <div className="w-full md:w-96 p-4 md:p-6 bg-gray-900/50 border-t md:border-l md:border-t-0 overflow-y-auto">
            <CalculationEngine 
              planData={extractedData} 
              calculations={calculations} 
            />
          </div>
        )}
      </div>
    </div>
  );
}