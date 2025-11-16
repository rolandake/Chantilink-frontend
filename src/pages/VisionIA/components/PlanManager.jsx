// src/pages/VisionIA/components/PlanManager.jsx - AVEC PREVIEW
import React, { useState, useEffect } from "react";
import axios from "axios";

const API_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

// Helper pour convertir PDF en image
async function pdfToImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        // Pour les PDF, on utilise une bibliothèque comme pdf.js
        // Ou on renvoie directement l'URL pour les images
        if (file.type.startsWith('image/')) {
          resolve(e.target.result);
        } else {
          // Pour PDF, on peut utiliser une iframe ou convertir
          resolve(e.target.result);
        }
      } catch (err) {
        reject(err);
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

  // ✅ Vérification des props critiques
  useEffect(() => {
    if (!setActivePlan) {
      console.error("❌ [PlanManager] setActivePlan manquant !");
    }
  }, [setActivePlan]);

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

    // Créer l'aperçu (conversion automatique)
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
      
      // ✅ Protection contre prop manquant
      if (setActivePlan) {
        setActivePlan(planData);
      } else {
        console.warn("⚠️ [PlanManager] setActivePlan non disponible");
      }

      handleAddMessage({ 
        role: "assistant", 
        content: `✅ Plan chargé : "${file.name}"`,
        timestamp: Date.now()
      });

      if (user?.isPremium) {
        setTimeout(() => analyzePlan(planData), 800);
      } else {
        handleAddMessage({ 
          role: "system", 
          content: `⭐ **Compte ÉLITE requis** pour l'analyse automatique des plans.`, 
          type: "premium",
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
        content: `🔍 Analyse en cours de "${plan.name}"...\n\n*Grok-3 Vision examine le plan...*`,
        timestamp: Date.now()
      });

      const formData = new FormData();
      formData.append("plan", plan.file);
      formData.append("projectType", projectType);

      const res = await axios.post(`${API_URL}/api/vision-ai/analyze`, formData, {
        headers: { 
          Authorization: `Bearer ${localStorage.getItem("token")}`,
          "Content-Type": "multipart/form-data"
        }
      });

      if (res.data?.success && res.data?.data) {
        const data = res.data.data;
        setExtractedData(data);
        
        // Calculs automatiques
        const calcRes = await axios.post(`${API_URL}/api/vision-ai/calculate`, {
          planData: data,
          projectType
        }, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
        });

        if (calcRes.data?.success) {
          setCalculations(calcRes.data.data);
          
          handleAddMessage({ 
            role: "assistant", 
            content: `✅ **Analyse terminée !**\n\n📊 **Résultats :**\n- Surface : ${data.area || 'N/A'} m²\n- Béton : ${calcRes.data.data.concrete} m³\n- Acier : ${calcRes.data.data.steel} kg\n- Coût estimé : **${calcRes.data.data.totalCost?.toLocaleString()} €**\n\nVous pouvez maintenant poser des questions sur ce plan.`,
            timestamp: Date.now()
          });
        }
      } else {
        throw new Error("Réponse invalide du serveur");
      }
    } catch (err) {
      console.error("Erreur analyse:", err);
      handleAddMessage({ 
        role: "system", 
        content: `❌ **Erreur lors de l'analyse**\n\n${err.response?.data?.error || err.message}\n\nVous pouvez quand même poser des questions sur le plan visible.`,
        timestamp: Date.now()
      });
    } finally {
      setUploading(false);
    }
  };

  const removePlan = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    
    setPlans([]);
    setPreviewUrl(null);
    setCurrentPlanSummary("");
    
    // ✅ Protection
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
      <h3 className="text-lg font-bold text-purple-400">📐 Plans</h3>
      
      {/* ZONE DE PREVIEW */}
      {previewUrl ? (
        <div className="flex-1 flex flex-col gap-3 overflow-hidden">
          {/* IMAGE DU PLAN */}
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
            
            {/* Overlay avec nom du fichier */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/80 to-transparent p-4">
              <p className="text-sm text-white font-semibold truncate flex items-center gap-2">
                <span className="text-purple-400">📐</span>
                {plans[0]?.name}
              </p>
            </div>

            {/* Badge d'état */}
            {uploading && (
              <div className="absolute top-3 right-3 bg-yellow-500 text-black px-3 py-1.5 rounded-full text-xs font-bold shadow-lg animate-pulse">
                ⏳ Analyse en cours...
              </div>
            )}

            {/* Bouton zoom en hover */}
            <div className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                onClick={() => window.open(previewUrl, '_blank')}
                className="bg-black/70 hover:bg-black text-white px-3 py-1.5 rounded-lg text-xs font-medium backdrop-blur-sm"
              >
                🔍 Agrandir
              </button>
            </div>
          </div>

          {/* BOUTONS D'ACTION */}
          <div className="flex gap-2">
            <button 
              onClick={removePlan}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg px-4 py-2 transition-colors font-medium"
            >
              🗑️ Supprimer
            </button>
            
            {!user?.isPremium && (
              <button 
                onClick={() => analyzePlan(plans[0])}
                disabled={uploading}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg px-4 py-2 transition-colors font-medium disabled:opacity-50"
              >
                🔍 Analyser
              </button>
            )}
          </div>
        </div>
      ) : (
        /* ZONE DE CHARGEMENT */
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

      {/* INFO PREMIUM */}
      {!user?.isPremium && previewUrl && (
        <div className="p-3 bg-yellow-900/20 border border-yellow-600 rounded-lg">
          <p className="text-xs text-yellow-300 text-center">
            ⭐ Analyse auto avec compte ÉLITE
          </p>
        </div>
      )}
    </div>
  );
}