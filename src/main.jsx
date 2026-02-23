// src/main.jsx - CORRIGÉ : Stripe retiré du provider global
//
// PROBLÈME IDENTIFIÉ :
//   const stripePromise = loadStripe(STRIPE_KEY)  ← au niveau module
//   <Elements stripe={stripePromise}>              ← enveloppe TOUTE l'app
//
//   → Stripe (230 KiB) se télécharge sur CHAQUE page (Home, Chat, Videos...)
//   → TBT mobile +155ms | Score mobile : -20 points
//
// SOLUTION :
//   - Retirer loadStripe() et <Elements> d'ici
//   - Les utiliser uniquement dans PremiumCheckout.jsx (déjà lazy-loadé)
//   - Stripe ne sera chargé QUE quand l'utilisateur navigue vers /premium/checkout

import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
// ✅ SUPPRIMÉ : import { Elements } from "@stripe/react-stripe-js";
// ✅ SUPPRIMÉ : import { loadStripe } from "@stripe/stripe-js";

import App from "./App";
import "./index.css";

import { DarkModeProvider }      from "./context/DarkModeContext";
import { AuthProvider }          from "./context/AuthContext";
import { SocketProvider }        from "./context/SocketContext";
import { PremiumProvider }       from "./context/PremiumContext";
import { StoryProvider }         from "./context/StoryContext";
import { PostsProvider }         from "./context/PostsContext";
import { ToastProvider }         from "./context/ToastContext";
import { VideosProvider }        from "./context/VideoContext";
import { CalculationProvider }   from "./context/CalculationContext";

// Debug (à retirer en production)
if (import.meta.env.DEV) {
  console.group("%c[App Bootstrap]", "color:#00aaff;font-weight:bold;");
  console.log("✅ React version:", React.version);
  console.log("✅ Environment:", import.meta.env.MODE);
  console.log("✅ API URL:", import.meta.env.VITE_API_URL || "http://localhost:5000/api");
  console.groupEnd();
}

// ✅ SUPPRIMÉ : const stripePromise = ...
// Stripe est maintenant chargé uniquement dans PremiumCheckout.jsx via useEffect

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("❌ Élément #root introuvable dans index.html !");
}

// Fix HMR en dev
let root;
if (import.meta.env.DEV && window.__REACT_ROOT__) {
  root = window.__REACT_ROOT__;
} else {
  root = ReactDOM.createRoot(rootElement);
  if (import.meta.env.DEV) window.__REACT_ROOT__ = root;
}

root.render(
  <React.StrictMode>
    <BrowserRouter>
      {/* ✅ SUPPRIMÉ : <Elements stripe={stripePromise}> — ne plus envelopper l'app */}
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
      {/* ✅ SUPPRIMÉ : </Elements> */}
    </BrowserRouter>
  </React.StrictMode>
);

// HMR
if (import.meta.hot) {
  import.meta.hot.accept();
}

// Gestion des erreurs globales
window.addEventListener("unhandledrejection", (event) => {
  if (import.meta.env.DEV) console.error("❌ [Global] Promesse non gérée:", event.reason);
  event.preventDefault();
});

window.addEventListener("error", (event) => {
  if (import.meta.env.DEV) console.error("❌ [Global] Erreur non capturée:", event.error);
});