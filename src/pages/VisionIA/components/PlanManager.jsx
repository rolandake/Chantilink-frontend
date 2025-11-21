// src/pages/VisionIA/components/PlanManager.jsx - AMÉLIORÉ
import React, { useState, useEffect } from "react";
import axios from "axios";

const API_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

async function pdfToImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (file.type.startsWith('image/')) {
        resolve(e.target.result);
      } else if (file.type === 'application/pdf') {
        resolve(e.target.result); // Pour PDF, on affiche dans iframe
      } else {
        reject(new Error('Format non supporté'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function PlanManager({
  projectType,
  setCurrentPlanSummary,
  setActivePlan,
  handleAddMessage,
  user,
  setExtractedData,
  setCalculations
}) {
  const [plans, setPlans] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [aiProvider, setAiProvider] = useState(null);

  useEffect(() => {
    if (!setActivePlan) {
      console.error("❌ [PlanManager] setActivePlan manquant !");
    }

    // Vérifier les IA disponibles
    checkAIStatus();
  }, [setActivePlan]);

  const checkAIStatus = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/vision-ai/status`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      
      if (res.data?.success && res.data.providers.length > 0) {
        setAiProvider(res.data.providers[0].name);
        console.log(`[VisionAI] Provider disponible: ${res.data.providers[0].name}`);
      }
    } catch (err) {
      console.warn("[VisionAI] Impossible de vérifier le statut IA:", err.message);
    }
  };

  const handleFiles = async (files) => {
    if (!files || files.length === 0) return;
    
    const MAX_SIZE = 50 * 1024 * 1024;
    const file = files[0];
    
    if (file.size > MAX_SIZE) {
      handleAddMessage({ 
        role: "system", 
        content: "❌ Fichier trop volumineux (max 50MB)", 
        timestamp: Date.now() 
      });
      return;
    }

    // Créer l'aperçu
    try {
      const imageUrl = await pdfToImage(file);
      setPreviewUrl(imageUrl);

      const planData = {
        id: `plan-${Date.now()}`,
        name: file.name,
        url: imageUrl,
        type: file.type,
        file: file
      };

      setPlans([planData]);
      setCurrentPlanSummary(planData.name);
      
      if (setActivePlan) {
        setActivePlan(planData);
      } else {
        console.warn("⚠️ [PlanManager] setActivePlan non disponible");
      }

      handleAddMessage({ 
        role: "assistant", 
        content: `✅ Plan chargé : "${file.name}"\n\n${aiProvider ? `🤖 Analyse disponible avec ${aiProvider}` : '⚠️ IA non disponible'}`,
        timestamp: Date.now()
      });

      // Analyse automatique pour utilisateurs premium
      if (user?.isPremium && aiProvider) {
        setTimeout(() => analyzePlan(planData), 800);
      } else if (!user?.isPremium) {
        handleAddMessage({ 
          role: "system", 
          content: `⭐ **Compte ÉLITE requis** pour l'analyse automatique.\n\nVous pouvez quand même consulter le plan et poser des questions dessus.`, 
          type: "premium",
          timestamp: Date.now()
        });
      } else if (!aiProvider) {
        handleAddMessage({ 
          role: "system", 
          content: `⚠️ **Service IA temporairement indisponible**\n\nVous pouvez toujours consulter le plan manuellement.`, 
          type: "warning",
          timestamp: Date.now()
        });
      }
    } catch (err) {
      console.error("Erreur chargement preview:", err);
      handleAddMessage({ 
        role: "system", 
        content: "❌ Erreur lors du chargement du fichier", 
        timestamp: Date.now() 
      });
    }
  };

  const analyzePlan = async (plan) => {
    try {
      setUploading(true);
      handleAddMessage({ 
        role: "assistant", 
        content: `🔍 Analyse en cours de "${plan.name}"...\n\n*${aiProvider || 'IA'} examine le plan...*`,
        timestamp: Date.now()
      });

      const formData = new FormData();
      formData.append("plan", plan.file);
      formData.append("projectType", projectType);

      // ✅ Analyse avec l'IA multi-providers
      const res = await axios.post(`${API_URL}/api/vision-ai/analyze`, formData, {
        headers: { 
          Authorization: `Bearer ${localStorage.getItem("token")}`,
          "Content-Type": "multipart/form-data"
        },
        timeout: 60000 // 60 secondes timeout
      });

      if (res.data?.success && res.data?.data) {
        const data = res.data.data;
        const usedProvider = res.data.provider;
        
        setExtractedData(data);
        
        handleAddMessage({ 
          role: "assistant", 
          content: `✅ **Analyse terminée !** (via ${usedProvider})\n\n📊 **Résultats :**\n- Surface : ${data.dimensions?.surface || 'N/A'} m²\n- Longueur : ${data.dimensions?.longueur || 'N/A'} m\n- Largeur : ${data.dimensions?.largeur || 'N/A'} m\n\n💡 **Recommandations :**\n${data.recommendations?.slice(0, 3).join('\n- ') || 'Aucune recommandation spécifique'}\n\n🔧 Lancement des calculs...`,
          timestamp: Date.now()
        });

        // ✅ Calculs automatiques
        setTimeout(() => runCalculations(data), 500);
        
      } else {
        throw new Error("Réponse invalide du serveur");
      }
    } catch (err) {
      console.error("Erreur analyse:", err);
      
      const errorMessage = err.response?.data?.error || err.message;
      const isTimeout = err.code === 'ECONNABORTED' || errorMessage.includes('timeout');
      
      handleAddMessage({ 
        role: "system", 
        content: `❌ **Erreur lors de l'analyse**\n\n${isTimeout ? '⏱️ Timeout - Le serveur met trop de temps à répondre' : errorMessage}\n\n💡 **Vous pouvez quand même :**\n- Visualiser le plan\n- Poser des questions dessus\n- Effectuer les calculs manuellement`,
        timestamp: Date.now()
      });
    } finally {
      setUploading(false);
    }
  };

  const runCalculations = async (planData) => {
    try {
      const calcRes = await axios.post(`${API_URL}/api/vision-ai/calculate`, {
        planData,
        projectType
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        timeout: 30000
      });

      if (calcRes.data?.success) {
        const calcs = calcRes.data.data;
        const usedProvider = calcRes.data.provider;
        
        setCalculations(calcs);
        
        handleAddMessage({ 
          role: "assistant", 
          content: `✅ **Calculs terminés !** (via ${usedProvider})\n\n📊 **Quantitatifs :**\n- Béton : **${calcs.concrete} m³**\n- Acier : **${calcs.steel} kg**\n- Coffrage : **${calcs.formwork} m²**\n\n💰 **Coût estimé : ${calcs.totalCost?.toLocaleString()} FCFA**\n\n📝 Vous pouvez maintenant poser des questions techniques sur ce plan.`,
          timestamp: Date.now()
        });
      }
    } catch (err) {
      console.error("Erreur calculs:", err);
      handleAddMessage({ 
        role: "system", 
        content: `⚠️ **Calculs partiellement disponibles**\n\nUtilisation de valeurs estimatives par défaut.`,
        timestamp: Date.now()
      });
      
      // Fallback avec valeurs par défaut
      setCalculations({
        concrete: 120,
        steel: 8500,
        formwork: 450,
        totalCost: 54000000
      });
    }
  };

  const removePlan = () => {
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    
    setPlans([]);
    setPreviewUrl(null);
    setCurrentPlanSummary("");
    
    if (setActivePlan) {
      setActivePlan(null);
    }
    
    setExtractedData(null);
    setCalculations({});
    
    handleAddMessage({ 
      role: "system", 
      content: "🗑️ Plan supprimé. Vous pouvez en charger un nouveau.",
      timestamp: Date.now()
    });
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 rounded-2xl shadow-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-purple-400">📐 Plans</h3>
        {aiProvider && (
          <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full">
            🤖 {aiProvider}
          </span>
        )}
      </div>
      
      {/* ZONE DE PREVIEW */}
      {previewUrl ? (
        <div className="flex-1 flex flex-col gap-3 overflow-hidden">
          <div className="flex-1 bg-gray-950 rounded-xl overflow-hidden border-2 border-purple-500/50 relative group shadow-2xl">
            {plans[0]?.type === 'application/pdf' ? (
              <iframe 
                src={previewUrl}
                className="w-full h-full"
                title={plans[0]?.name}
              />
            ) : (
              <img 
                src={previewUrl} 
                alt={plans[0]?.name}
                className="w-full h-full object-contain hover:scale-105 transition-transform duration-300 cursor-zoom-in"
                style={{ imageRendering: 'crisp-edges' }}
                onClick={() => window.open(previewUrl, '_blank')}
              />
            )}
            
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/80 to-transparent p-4">
              <p className="text-sm text-white font-semibold truncate flex items-center gap-2">
                <span className="text-purple-400">📐</span>
                {plans[0]?.name}
              </p>
            </div>

            {uploading && (
              <div className="absolute top-3 right-3 bg-yellow-500 text-black px-3 py-1.5 rounded-full text-xs font-bold shadow-lg animate-pulse flex items-center gap-2">
                <div className="w-3 h-3 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                Analyse en cours...
              </div>
            )}

            <div className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                onClick={() => window.open(previewUrl, '_blank')}
                className="bg-black/70 hover:bg-black text-white px-3 py-1.5 rounded-lg text-xs font-medium backdrop-blur-sm"
              >
                🔍 Agrandir
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            <button 
              onClick={removePlan}
              disabled={uploading}
              className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm rounded-lg px-4 py-2 transition-colors font-medium"
            >
              🗑️ Supprimer
            </button>
            
            {!uploading && (!user?.isPremium || !aiProvider) && (
              <button 
                onClick={() => analyzePlan(plans[0])}
                disabled={uploading || !aiProvider}
                className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm rounded-lg px-4 py-2 transition-colors font-medium"
              >
                {!aiProvider ? '⚠️ IA indisponible' : '🔍 Analyser'}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div
          className="flex-1 flex flex-col items-center justify-center gap-3 p-6 border-2 border-dashed rounded-xl cursor-pointer transition-all border-gray-600 bg-gray-800 hover:border-indigo-500 hover:bg-gray-750"
          onClick={() => document.getElementById("planInput")?.click()}
          onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
          onDrop={e => { 
            e.preventDefault(); 
            e.stopPropagation(); 
            handleFiles(e.dataTransfer.files); 
          }}
        >
          <div className="text-6xl mb-2">📄</div>
          <p className="text-center text-gray-300 text-sm font-medium">
            Glissez votre plan ici
          </p>
          <p className="text-center text-gray-500 text-xs">
            PDF, JPG, PNG (max 50MB)
          </p>
          <div className="mt-3 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-medium transition-colors">
            📁 Parcourir
          </div>
        </div>
      )}

      <input 
        id="planInput" 
        type="file" 
        accept=".pdf,.jpg,.jpeg,.png,.dwg" 
        className="hidden" 
        onChange={e => handleFiles(e.target.files)} 
        disabled={uploading}
      />

      {!aiProvider && (
        <div className="p-3 bg-red-900/20 border border-red-600 rounded-lg">
          <p className="text-xs text-red-300 text-center">
            ⚠️ Service IA temporairement indisponible
          </p>
        </div>
      )}

      {!user?.isPremium && previewUrl && aiProvider && (
        <div className="p-3 bg-yellow-900/20 border border-yellow-600 rounded-lg">
          <p className="text-xs text-yellow-300 text-center">
            ⭐ Analyse auto avec compte ÉLITE
          </p>
        </div>
      )}
    </div>
  );
}