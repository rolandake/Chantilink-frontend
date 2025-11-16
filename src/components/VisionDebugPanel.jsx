// src/components/VisionDebugPanel.jsx
import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";

export default function VisionDebugPanel({ visionConnected, currentProvider }) {
  const { user } = useAuth();
  const [debugInfo, setDebugInfo] = useState({});

  useEffect(() => {
    setDebugInfo({
      userId: user?._id || "❌ Manquant",
      userEmail: user?.email || "❌ Manquant",
      token: localStorage.getItem("token") ? "✅ Présent" : "❌ Manquant",
      tokenLength: localStorage.getItem("token")?.length || 0,
      backendUrl: import.meta.env.VITE_BACKEND_URL || "http://localhost:5000",
      connected: visionConnected ? "✅ Connecté" : "❌ Déconnecté",
      provider: currentProvider || "❌ Aucun",
      timestamp: new Date().toLocaleTimeString(),
    });
  }, [user, visionConnected, currentProvider]);

  const [isOpen, setIsOpen] = useState(false);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 bg-purple-600 text-white px-4 py-2 rounded-full shadow-lg hover:bg-purple-700 z-50"
      >
        🐛 Debug
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 bg-gray-900 text-white p-4 rounded-xl shadow-2xl z-50 max-w-md border border-purple-500">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-purple-400">🐛 Vision Debug</h3>
        <button
          onClick={() => setIsOpen(false)}
          className="text-gray-400 hover:text-white"
        >
          ✕
        </button>
      </div>

      <div className="space-y-2 text-sm font-mono">
        {Object.entries(debugInfo).map(([key, value]) => (
          <div key={key} className="flex justify-between">
            <span className="text-gray-400">{key}:</span>
            <span className={value.includes("❌") ? "text-red-400" : "text-green-400"}>
              {value}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-700">
        <button
          onClick={() => {
            console.log("=== VISION DEBUG INFO ===");
            console.log("User:", user);
            console.log("Token:", localStorage.getItem("token"));
            console.log("Connected:", visionConnected);
            console.log("Provider:", currentProvider);
            console.log("========================");
          }}
          className="w-full bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded text-sm"
        >
          📋 Log to Console
        </button>
      </div>

      <div className="mt-2">
        <button
          onClick={() => {
            const token = localStorage.getItem("token");
            if (token) {
              navigator.clipboard.writeText(token);
              alert("Token copié !");
            }
          }}
          className="w-full bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-sm"
        >
          📋 Copy Token
        </button>
      </div>
    </div>
  );
}