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

root.render(
  <React.StrictMode>
    <BrowserRouter>
      <Elements stripe={stripePromise}>
        <DarkModeProvider>
          <AuthProvider>
            <SocketProvider>
              <ToastProvider>
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
              </ToastProvider>
            </SocketProvider>
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