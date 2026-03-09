// 📁 src/components/SplashScreen.jsx
// ✅ Ce composant est désormais un no-op.
// Le splash est entièrement géré dans index.html (div#app-splash + __hideSplash).
// AppContent appelle __hideSplash() dès son premier useEffect.
// Ce fichier existe pour éviter de casser les imports existants.

import { useEffect } from "react";

export default function SplashScreen({ onFinish }) {
  useEffect(() => {
    // Le splash HTML est déjà masqué par AppContent.
    // On appelle onFinish immédiatement pour ne pas bloquer le rendu.
    onFinish?.();
  }, [onFinish]);

  return null; // rien à rendre — le splash HTML s'en charge
}