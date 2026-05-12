// src/main.jsx
// ✅ i18n importé en PREMIER (avant App et les contextes)
//    → Garantit que les traductions sont disponibles dès le premier render
// ✅ LanguageProvider ajouté — enveloppe l'app entière
// ✅ Stripe retiré du provider global (chargé uniquement dans PremiumCheckout)
// ✅ vite:preloadError handler ajouté — rechargement auto après redéploiement

import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

// ⚠️ IMPORTANT : i18n DOIT être importé avant App et les contextes
import "./i18n";

import App from "./App";
import "./index.css";

import { DarkModeProvider }    from "./context/DarkModeContext";
import { AuthProvider }        from "./context/AuthContext";
import { useAuth }             from "./context/AuthContext";
import { LanguageProvider }    from "./context/LanguageContext";
import { SocketProvider }      from "./context/SocketContext";
import { PremiumProvider }     from "./context/PremiumContext";
import { StoryProvider }       from "./context/StoryContext";
import { PostsProvider }       from "./context/PostsContext";
import { ToastProvider }       from "./context/ToastContext";
import { VideosProvider }      from "./context/VideoContext";
import { CalculationProvider } from "./context/CalculationContext";

// Debug (à retirer en production)
if (import.meta.env.DEV) {
  console.group("%c[App Bootstrap]", "color:#00aaff;font-weight:bold;");
  console.log("✅ React version:", React.version);
  console.log("✅ Environment:", import.meta.env.MODE);
  console.log("✅ API URL:", import.meta.env.VITE_API_URL || "http://localhost:5000/api");
  console.groupEnd();
}

// ✅ CHUNK ERROR HANDLER — Fallback explicite en plus du handler dans index.html.
// Vite émet "vite:preloadError" quand un import() dynamique échoue (chunk 404
// après redéploiement). On recharge la page pour que l'utilisateur récupère
// le nouvel index.html et les nouveaux hash de chunks.
window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  window.location.reload();
});

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

// ============================================================
// ARBRE DES PROVIDERS
//
// Ordre important :
//   BrowserRouter
//   └─ DarkModeProvider
//      └─ AuthProvider        ← gère user + token
//         └─ LanguageBridge   ← pont Auth → LanguageProvider
//            └─ ToastProvider
//               └─ SocketProvider
//                  └─ ... reste des providers
// ============================================================

/**
 * LanguageBridge
 * Récupère getToken depuis AuthContext et le passe à LanguageProvider.
 * Évite les imports circulaires.
 */
function LanguageBridge({ children }) {
  const { getToken } = useAuth();
  return <LanguageProvider getToken={getToken}>{children}</LanguageProvider>;
}

root.render(
  <React.StrictMode>
    <BrowserRouter>
      <DarkModeProvider>
        <AuthProvider>
          {/* LanguageBridge doit être DANS AuthProvider pour accéder à useAuth */}
          <LanguageBridge>
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
          </LanguageBridge>
        </AuthProvider>
      </DarkModeProvider>
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