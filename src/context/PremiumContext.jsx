// src/context/PremiumContext.jsx
import { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "./AuthContext";

const PremiumContext = createContext({});

export const PremiumProvider = ({ children }) => {
  const { user } = useAuth();
  const [isPremium, setIsPremium] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsPremium(false);
      setIsLoading(false);
      return;
    }

    // Vérifie si premium actif
    const isElite = user.isPremium || (user.premiumUntil && new Date(user.premiumUntil) > new Date());
    setIsPremium(!!isElite);
    setIsLoading(false);
  }, [user]);

  return (
    <PremiumContext.Provider value={{ isPremium, isLoading, setIsPremium }}>
      {children}
    </PremiumContext.Provider>
  );
};

export const usePremium = () => useContext(PremiumContext);