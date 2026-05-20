import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "./AuthContext";

const PremiumContext = createContext();
export const usePremium = () => useContext(PremiumContext);

const API_URL =
  import.meta.env.VITE_API_URL?.replace(/\/api\/?$/, "") ||
  (import.meta.env.PROD ? "https://chantilink-backend.onrender.com" : "http://localhost:5000");

export function PremiumProvider({ children }) {
  // 🛡️ SÉCURITÉ CRITIQUE : On récupère le contexte entier d'abord
  const authContext = useAuth();
  
  // On évite le crash "Cannot destructure property 'user' of undefined"
  // si AuthContext n'est pas encore prêt ou mal monté.
  const user = authContext?.user || null;
  const getToken = authContext?.getToken || (() => Promise.resolve(null));

  const [premiumStatus, setPremiumStatus] = useState({
    isPremium: false,
    premiumType: null,
    expiresAt: null,
    loading: false, // On commence à false pour éviter un bloquage si auth échoue
  });

  // ✅ Synchroniser UNIQUEMENT quand user change réellement
  useEffect(() => {
    // Si pas de user, on reset proprement
    if (!user) {
      setPremiumStatus(prev => {
        if (!prev.isPremium && !prev.loading) return prev; // Déjà clean
        return {
          isPremium: false,
          premiumType: null,
          expiresAt: null,
          loading: false,
        };
      });
      return;
    }

    setPremiumStatus(prev => {
      const newIsPremium = user.isPremium || false;
      const newPremiumType = user.premiumType || null;
      const newExpiresAt = user.premiumExpiresAt || null;

      // ⚠️ Comparaison stricte pour éviter le re-render
      if (
        prev.isPremium === newIsPremium &&
        prev.premiumType === newPremiumType &&
        prev.expiresAt === newExpiresAt
      ) {
        return prev;
      }

      return {
        isPremium: newIsPremium,
        premiumType: newPremiumType,
        expiresAt: newExpiresAt,
        loading: false,
      };
    });
  }, [user]); // user est un objet, mais React gère bien la ref si AuthContext est stable

  // ✅ Check manuel (utile après un paiement réussi par exemple)
  const checkPremiumStatus = useCallback(async () => {
    if (!user?._id) return;

    setPremiumStatus(prev => ({ ...prev, loading: true }));
    
    try {
      const token = await getToken();
      if (!token) throw new Error("No token");

      const response = await fetch(`${API_URL}/api/premium/status`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      
      setPremiumStatus({
        isPremium: data.isPremium || false,
        premiumType: data.premiumType || null,
        expiresAt: data.expiresAt || null,
        loading: false,
      });
    } catch (error) {
      console.error("❌ [Premium] Refresh error:", error);
      // En cas d'erreur, on garde l'état local (optimiste) ou on reset
      setPremiumStatus(prev => ({ ...prev, loading: false }));
    }
  }, [user?._id, getToken]);

  // ✅ Calcul mémorisé de l'accès
  const hasPremiumAccess = useMemo(() => {
    if (!premiumStatus.isPremium) return false;
    if (!premiumStatus.expiresAt) return true; // Premium à vie ou pas d'expiration
    return new Date(premiumStatus.expiresAt) > new Date();
  }, [premiumStatus.isPremium, premiumStatus.expiresAt]);

  const value = useMemo(() => ({
    isPremium: premiumStatus.isPremium,
    premiumType: premiumStatus.premiumType,
    expiresAt: premiumStatus.expiresAt,
    loading: premiumStatus.loading,
    checkPremiumStatus,
    hasPremiumAccess,
  }), [premiumStatus, checkPremiumStatus, hasPremiumAccess]);

  // Si authContext est undefined (bug critique), on rend quand même les enfants pour ne pas écran blanc
  if (!authContext) {
    console.warn("⚠️ PremiumProvider rendu sans AuthProvider !");
    return <>{children}</>;
  }

  return (
    <PremiumContext.Provider value={value}>
      {children}
    </PremiumContext.Provider>
  );
}
