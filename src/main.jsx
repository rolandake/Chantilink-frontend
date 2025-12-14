// src/main.jsx - VERSION CORRIGÉE
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

// Root Element
const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("❌ Élément #root introuvable dans index.html !");
}

// 🔥 FIX: Éviter la double création du root lors du HMR
let root;
if (window.__REACT_ROOT__) {
  root = window.__REACT_ROOT__;
} else {
  root = ReactDOM.createRoot(rootElement);
  window.__REACT_ROOT__ = root;
  console.log("✅ React Root créé");
}

// ✅ HIÉRARCHIE CORRECTE - BrowserRouter doit être LE PLUS HAUT POSSIBLE
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <Elements stripe={stripePromise}>
        <DarkModeProvider>
          <AuthProvider>
            <ToastProvider>
              <SocketProvider>
                <PremiumProvider>
                  <PostsProvider>
                    <StoryProvider>
                      <VideosProvider>
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

// HMR
if (import.meta.hot) {
  import.meta.hot.accept();
  console.log("🔥 HMR activé");
}

// Error Boundary Global
window.addEventListener('unhandledrejection', (event) => {
  console.error('❌ [Global] Promesse non gérée:', event.reason);
  event.preventDefault(); // Empêche le log par défaut
});

window.addEventListener('error', (event) => {
  console.error('❌ [Global] Erreur non capturée:', event.error);
  event.preventDefault();
});

// Désactiver le mode strict en DEV si trop de logs
// (React 18 monte/démonte 2x en StrictMode)
// Pour désactiver: enlever <React.StrictMode> ci-dessus