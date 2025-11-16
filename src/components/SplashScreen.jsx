import { useEffect } from "react";

export default function SplashScreen({ onFinish }) {
  useEffect(() => {
    // Appel immédiat du callback
    onFinish?.();
  }, [onFinish]);

  // Rien n’est rendu visuellement
  return null;
}
