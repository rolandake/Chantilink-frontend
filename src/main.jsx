// src/main.jsx - VERSION FINALE OPTIMISÉE
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";

import App from "./App";
import "./index.css";

// TOUS LES PROVIDERS
import { DarkModeProvider } from "./context/DarkModeContext";
import { AuthProvider } from "./context/AuthContext";
import { SocketProvider } from "./context/SocketContext";
import { PremiumProvider } from "./context/PremiumContext";
import { StoryProvider } from "./context/StoryContext";
import { PostsProvider } from "./context/PostsContext";
import { ToastProvider } from "./context/ToastContext";
import { VideosProvider } from "./context/VideoContext";
import { CalculationProvider } from "./context/CalculationContext";

// Debug
console.group("%c[App Bootstrap]", "color:#00aaff;font-weight:bold;");
console.log("✅ React version:", React.version);
console.log("✅ Environment:", import.meta.env.MODE);
console.log("✅ API URL:", import.meta.env.VITE_API_URL || "http://localhost:5000/api");
console.groupEnd();

// Stripe
const STRIPE_KEY = import.meta.env.VITE_STRIPE_PUBLIC_KEY;
if (!STRIPE_KEY) {
  console.warn("⚠️ [Stripe] Clé publique manquante dans .env");
}
const stripePromise = STRIPE_KEY ? loadStripe(STRIPE_KEY) : Promise.resolve(null);

// Root - 🔥 PROTECTION CONTRE DOUBLE CREATEROOT
const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("❌ Élément #root introuvable dans index.html !");
}

// 🔥 Vérifier si root existe déjà (pour HMR)
if (!window.__REACT_ROOT__) {
  window.__REACT_ROOT__ = ReactDOM.createRoot(rootElement);
  console.log("✅ React Root créé");
}

const root = window.__REACT_ROOT__;

// ✅ HIÉRARCHIE CORRECTE DES PROVIDERS
// L'ordre est crucial pour éviter les erreurs de dépendances
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <Elements stripe={stripePromise}>
        {/* 1️⃣ DarkMode - Indépendant */}
        <DarkModeProvider>
          {/* 2️⃣ Auth - Fournit user, token, socket */}
          <AuthProvider>
            {/* 3️⃣ Toast - Peut utiliser Auth */}
            <ToastProvider>
              {/* 4️⃣ Socket - Wrapper autour du socket d'Auth (optionnel) */}
              <SocketProvider>
                {/* 5️⃣ Premium - Utilise Auth */}
                <PremiumProvider>
                  {/* 6️⃣ Posts - Utilise Auth et Socket */}
                  <PostsProvider>
                    {/* 7️⃣ Story - Utilise Auth et Socket */}
                    <StoryProvider>
                      {/* 8️⃣ Videos - Utilise Auth et Socket */}
                      <VideosProvider>
                        {/* 9️⃣ Calculation - Utilise Auth */}
                        <CalculationProvider>
                          <App />
                        </CalculationProvider>
                      </VideosProvider>
                    </StoryProvider>
                  </PostsProvider>
                </PremiumProvider>
              </SocketProvider>
            </ToastProvider>
          </AuthProvider>
        </DarkModeProvider>
      </Elements>
    </BrowserRouter>
  </React.StrictMode>
);

// Post-render - Enlever splash screen
setTimeout(() => {
  const splash = document.getElementById("splash");
  if (splash) {
    splash.style.opacity = "0";
    setTimeout(() => splash.remove(), 400);
  }
}, 800);

// HMR - Hot Module Replacement
if (import.meta.hot) {
  import.meta.hot.accept();
  console.log("🔥 HMR activé");
}

// Error Boundary Global (optionnel mais recommandé)
window.addEventListener('unhandledrejection', (event) => {
  console.error('❌ [Global] Promesse non gérée:', event.reason);
});

window.addEventListener('error', (event) => {
  console.error('❌ [Global] Erreur non capturée:', event.error);
});