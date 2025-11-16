// src/index.jsx - VERSION ÉLITE 2025 - MONÉTISATION INTÉGRÉE
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App";

import { AuthProvider } from "./context/AuthContext";
import { PremiumProvider } from "./context/PremiumContext";     // NOUVEAU
import { ProjectsProvider } from "./context/ProjectsContext";
import { GPTProvider } from "./context/GPTContext";
import { SocketProvider } from "./context/SocketContext";
import { StoriesProvider } from "./context/StoryContext";        // OBLIGATOIRE

import "./index.css";

// PROTECTION REACT 19 (propre comme un diamant)
if (typeof window !== 'undefined') {
  const og = console.error;
  console.error = (...a) => {
    if (typeof a[0] === 'string' && /deprecated|ReactDOM\.render/.test(a[0])) return;
    og(...a);
  };
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <PremiumProvider>          {/* PREMIUM GATE ACTIVÉ */}
          <SocketProvider>
            <StoriesProvider>      {/* STORIES EN TEMPS RÉEL */}
              <ProjectsProvider>
                <GPTProvider>
                  <App />
                </GPTProvider>
              </ProjectsProvider>
            </StoriesProvider>
          </SocketProvider>
        </PremiumProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);