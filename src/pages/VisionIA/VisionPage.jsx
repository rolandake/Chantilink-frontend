import React, { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import { useDarkMode } from "../../context/DarkModeContext.jsx";
import { useVisionIA } from "../../hooks/useVisionIA.js";

// ⬇️ NOUVEAU: Remplacer CheckoutButton par EliteCheckout
import EliteCheckout from "../../components/EliteCheckout.jsx";

import PlanManager from "./components/PlanManager.jsx";
import ChatWindow from "./components/ChatWindow.jsx";
import VoiceButton from "./components/VoiceButton.jsx";
import CalculationEngine from "./components/CalculationEngine.jsx";

export default function VisionPage() {
  const { user, updateUser } = useAuth(); // ⬅️ AJOUT: updateUser pour refresh
  const { isDarkMode } = useDarkMode();
  const navigate = useNavigate();

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
  
  // 🔥 FIX CRITIQUE : useRef pour éviter les closures stales avec WebSocket
  const messagesRef = useRef([]);
  const processedIdsRef = useRef(new Set());

  // Hook VisionIA
  const {
    connected: visionConnected,
    typing: visionTyping,
    currentProvider,
    messages: socketMessages,
    sendMessage: sendVisionMessage
  } = useVisionIA(user?._id, projectType, engineerMode);

  // 🔥 MODE IMMERSIF: Bloquer tout scroll et navigation externe
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.height = '100%';
    
    const preventBackButton = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };
    
    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', preventBackButton);
    
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
      window.removeEventListener('popstate', preventBackButton);
    };
  }, []);

  // ✅ Synchroniser messagesRef avec localMessages
  useEffect(() => {
    messagesRef.current = localMessages;
  }, [localMessages]);

  // 🔥 FUSION ET PERSISTANCE des messages socket → local
  useEffect(() => {
    if (!socketMessages || socketMessages.length === 0) return;

    socketMessages.forEach(socketMsg => {
      // Vérifier si déjà traité
      if (processedIdsRef.current.has(socketMsg.id)) return;
      
      // Marquer comme traité
      processedIdsRef.current.add(socketMsg.id);
      
      // Ajouter au state local pour persistance
      setLocalMessages(prev => {
        // Double vérification dans le state
        const exists = prev.some(m => m.id === socketMsg.id);
        if (exists) return prev;
        
        return [...prev, socketMsg].sort((a, b) => 
          (a.timestamp || 0) - (b.timestamp || 0)
        );
      });
    });
  }, [socketMessages]);

  // ✅ Messages finaux (fusion local + socket)
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

  // ✅ Scroll automatique
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [allMessages, visionTyping]);

  const handleAddMessage = useCallback((msg) => {
    const newMsg = { 
      ...msg, 
      id: msg.id || `local-${Date.now()}-${Math.random()}`,
      timestamp: msg.timestamp || Date.now()
    };
    
    processedIdsRef.current.add(newMsg.id);
    setLocalMessages(prev => [...prev, newMsg]);
  }, []);

  const send = useCallback(() => {
    if (!inputValue.trim() || !visionConnected) return;
    
    const userMsg = { 
      role: "user", 
      content: inputValue,
      timestamp: Date.now()
    };
    
    handleAddMessage(userMsg);
    
    sendVisionMessage(inputValue, { 
      planData: extractedData, 
      calculations, 
      phase: projectPhase 
    });
    
    setInputValue("");
  }, [inputValue, visionConnected, extractedData, calculations, projectPhase, handleAddMessage, sendVisionMessage]);

  // ✅ Sauvegarde automatique toutes les 30s
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
            messages: messagesRef.current // Utiliser ref pour avoir la dernière version
          })
        });
      } catch (err) {
        console.error("[VisionPage] Erreur sauvegarde:", err);
      }
    }, 30000);
    
    return () => clearInterval(interval);
  }, [user?._id, projectType, engineerMode, projectPhase, calculations]);

  // 💎 NOUVEAU: Fonction pour recharger les données utilisateur
  const fetchUserData = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/users/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const userData = await response.json();
        
        // Mettre à jour le contexte Auth si vous avez une fonction updateUser
        if (updateUser) {
          updateUser(userData);
        }
        
        console.log("[VisionPage] Données utilisateur mises à jour:", userData);
        return userData;
      }
    } catch (error) {
      console.error("[VisionPage] Erreur rechargement user:", error);
    }
  }, [updateUser]);

  // 💎 NOUVEAU: Handler pour le succès du paiement
  const handlePaymentSuccess = useCallback(async () => {
    console.log("[VisionPage] 🎉 Paiement Elite réussi !");
    
    // Fermer le modal
    setShowCheckout(false);
    
    // Recharger les données utilisateur
    await fetchUserData();
    
    // Afficher un message de succès (optionnel)
    // Vous pouvez ajouter un toast/notification ici
    
    // Optionnel: Afficher une alerte temporaire
    setTimeout(() => {
      alert("🎉 Félicitations ! Vous êtes maintenant Elite !\n\nToutes les fonctionnalités premium sont débloquées.");
    }, 500);
  }, [fetchUserData]);

  return (
    <>
      {/* 🔥 OVERLAY BLOQUANT TOUT LE RESTE DE L'APP */}
      <div className="fixed inset-0 z-[9999] bg-black" style={{ isolation: 'isolate' }}>
        <div className={`w-full h-full flex flex-col ${isDarkMode ? 'bg-black' : 'bg-gray-100'} text-white overflow-hidden`}>
          
          {/* HEADER AVEC BOUTON RETOUR */}
          <div className="relative p-4 bg-gradient-to-r from-purple-900 to-indigo-900 shadow-2xl flex-shrink-0">
            <button
              onClick={() => {
                document.body.style.overflow = '';
                document.body.style.position = '';
                document.body.style.width = '';
                document.body.style.height = '';
                navigate(-1);
              }}
              className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all backdrop-blur-sm z-10 group"
              aria-label="Retour"
            >
              <ArrowLeft className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />
            </button>

            <div className="flex items-center justify-between pl-14">
              <div>
                <h1 className="text-2xl md:text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-yellow-400 to-pink-500">
                  VISIONIA — BUREAU D'ÉTUDE IA
                </h1>
                <p className="text-xs md:text-sm text-gray-300">Grok-3 Vision • Analyse Plans • Calculs Temps Réel</p>
              </div>
              
              <div className="flex items-center gap-2 md:gap-4">
                <span className={`px-3 md:px-4 py-1 md:py-2 rounded-full text-xs md:text-sm font-bold transition-all ${
                  visionConnected 
                    ? 'bg-green-500/20 text-green-400 ring-2 ring-green-500/50' 
                    : 'bg-red-500/20 text-red-400 ring-2 ring-red-500/50'
                }`}>
                  {visionConnected ? '🟢 EN LIGNE' : '🔴 HORS LIGNE'}
                </span>
                
                {currentProvider && (
                  <span className="hidden md:inline-block px-3 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full border border-blue-500/30">
                    🤖 {currentProvider}
                  </span>
                )}
                
                {/* 💎 AFFICHAGE CONDITIONNEL DU BOUTON ELITE */}
                {user?.isPremium ? (
                  <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-xl border border-yellow-500/50">
                    <span className="text-yellow-400 text-lg">👑</span>
                    <span className="text-xs font-bold text-yellow-300">ELITE</span>
                    {user.premiumDaysRemaining && (
                      <span className="text-xs text-yellow-400/70">
                        ({user.premiumDaysRemaining}j)
                      </span>
                    )}
                  </div>
                ) : (
                  <button 
                    onClick={() => setShowCheckout(true)} 
                    className="hidden md:block px-4 md:px-6 py-1 md:py-2 bg-gradient-to-r from-yellow-500 to-orange-600 rounded-xl font-bold text-xs md:text-sm hover:scale-105 transition-transform shadow-lg hover:shadow-yellow-500/50"
                  >
                    ⭐ PASSER ÉLITE
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 💎 NOUVEAU: Modal EliteCheckout */}
          {showCheckout && (
            <EliteCheckout 
              onClose={() => setShowCheckout(false)}
              onSuccess={handlePaymentSuccess}
              user={user}
            />
          )}

          <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
            
            {/* SIDEBAR GAUCHE - Plans */}
            <div className="w-full md:w-80 p-4 bg-gray-900/50 border-b md:border-r md:border-b-0 overflow-y-auto flex-shrink-0">
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
            <div className="flex-1 flex flex-col min-w-0 min-h-0">
              <div 
                ref={chatContainerRef} 
                className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4"
              >
                {allMessages.length === 0 && !visionTyping && (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    <div className="text-center max-w-md px-4">
                      <div className="text-5xl md:text-6xl mb-4">🏗️</div>
                      <p className="text-lg md:text-xl mb-2 text-white">Bienvenue dans VISIONIA</p>
                      <p className="text-xs md:text-sm text-gray-400">
                        Bureau d'étude intelligent propulsé par Grok-3
                      </p>
                      <div className="mt-6 space-y-2 text-left bg-gray-800 p-4 rounded-lg">
                        <p className="text-xs text-gray-400">✅ Charger un plan</p>
                        <p className="text-xs text-gray-400">✅ Poser une question technique</p>
                        <p className="text-xs text-gray-400">✅ Obtenir des calculs instantanés</p>
                      </div>

                      {/* 💎 NOUVEAU: Promotion Elite pour nouveaux users */}
                      {!user?.isPremium && (
                        <div className="mt-6 p-4 bg-gradient-to-r from-yellow-900/30 to-orange-900/30 rounded-xl border border-yellow-500/30">
                          <p className="text-sm text-yellow-300 font-bold mb-2">
                            🌟 Passez Elite pour débloquer :
                          </p>
                          <ul className="text-xs text-gray-300 space-y-1 text-left">
                            <li>⚡ Analyse automatique des plans</li>
                            <li>📊 Calculs illimités</li>
                            <li>🎯 Priorité absolue</li>
                          </ul>
                          <button 
                            onClick={() => setShowCheckout(true)}
                            className="mt-3 w-full px-4 py-2 bg-gradient-to-r from-yellow-500 to-orange-600 rounded-lg font-bold text-sm hover:scale-105 transition-transform"
                          >
                            Découvrir Elite →
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                <ChatWindow messages={allMessages} activePlan={activePlan} />
                
                {visionTyping && (
                  <div className="flex items-center gap-2 text-purple-400 p-4 bg-purple-900/20 rounded-lg border border-purple-500/30">
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                    <span className="ml-2 text-sm md:text-base">🤖 {currentProvider || 'Grok-3'} réfléchit...</span>
                  </div>
                )}
              </div>

              {/* INPUT ZONE */}
              <div className="p-3 md:p-4 bg-gray-900/80 border-t border-gray-700 flex-shrink-0">
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
                    className="px-3 md:px-6 py-3 md:py-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl font-bold text-sm md:text-base disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 transition-transform"
                  >
                    📤
                  </button>
                  
                  <VoiceButton onTranscript={setInputValue} />
                </div>
              </div>
            </div>

            {/* SIDEBAR DROITE - Calculs */}
            {extractedData && Object.keys(calculations).length > 0 && (
              <div className="w-full md:w-96 p-4 md:p-6 bg-gray-900/50 border-t md:border-l md:border-t-0 overflow-y-auto flex-shrink-0">
                <CalculationEngine 
                  planData={extractedData} 
                  calculations={calculations} 
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}