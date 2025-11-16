// src/components/CheckoutButton.jsx - VERSION ÉLITE 2025
import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { FaCrown, FaRocket, FaBrain, FaVolumeUp, FaLock, FaExclamationTriangle } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { useDarkMode } from '../context/DarkModeContext';

const plans = {
  elite: {
    name: "ÉLITE",
    price: "4,99€",
    monthly: true,
    features: ["Badge doré", "Stories 30 jours", "Nom en OR", "Filtres exclusifs"],
    color: "from-purple-600 to-pink-600",
    icon: <FaCrown className="text-3xl" />
  },
  diamond: {
    name: "DIAMANT",
    price: "9,99€",
    monthly: true,
    features: ["Tout ÉLITE", "10 crédits IA/mois", "Boost gratuit/semaine", "Accès bêta"],
    color: "from-yellow-500 to-orange-600",
    icon: <FaRocket className="text-3xl" />
  }
};

export default function CheckoutButton({ plan = 'elite', size = 'lg' }) {
  const [loading, setLoading] = useState(false);
  const [stripePromise, setStripePromise] = useState(null);
  const [error, setError] = useState(null);
  const { user } = useAuth();
  const { isDarkMode } = useDarkMode();
  const currentPlan = plans[plan];

  // ✅ Initialisation sécurisée de Stripe
  useEffect(() => {
    const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
    
    if (!stripeKey) {
      console.error('❌ VITE_STRIPE_PUBLISHABLE_KEY non définie dans .env');
      setError('Configuration Stripe manquante');
      return;
    }

    if (!stripeKey.startsWith('pk_')) {
      console.error('❌ Clé Stripe invalide (doit commencer par pk_test_ ou pk_live_)');
      setError('Clé Stripe invalide');
      return;
    }

    try {
      setStripePromise(loadStripe(stripeKey));
      console.log('✅ Stripe initialisé avec succès');
    } catch (err) {
      console.error('❌ Erreur initialisation Stripe:', err);
      setError('Erreur initialisation paiement');
    }
  }, []);

  const handleCheckout = async () => {
    if (!stripePromise) {
      alert('❌ Configuration Stripe manquante. Contactez le support.');
      return;
    }

    if (!user) {
      alert('❌ Vous devez être connecté pour acheter');
      window.location.href = '/auth';
      return;
    }

    setLoading(true);
    try {
      // Récupérer l'instance Stripe
      const stripe = await stripePromise;
      
      // Créer la session de paiement
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/stripe/create-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          plan: plan,
          userId: user._id,
          email: user.email
        })
      });

      if (!res.ok) {
        throw new Error(`Erreur HTTP ${res.status}`);
      }

      const session = await res.json();
      
      if (!session.id) {
        throw new Error('Session ID manquant');
      }

      // Rediriger vers Stripe
      const result = await stripe.redirectToCheckout({ sessionId: session.id });
      
      if (result.error) {
        throw result.error;
      }
    } catch (err) {
      console.error('❌ Erreur checkout:', err);
      alert(`Erreur paiement : ${err.message || 'Réessayez plus tard'}`);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Affichage erreur configuration
  if (error) {
    return (
      <div className={`relative group ${size === 'lg' ? 'w-80' : 'w-64'} mx-auto`}>
        <div className={`relative p-8 rounded-3xl shadow-2xl border-2 border-red-500/50 ${isDarkMode ? 'bg-gray-900' : 'bg-white'}`}>
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
              <FaExclamationTriangle className="text-3xl text-red-500" />
            </div>
            <h3 className="text-xl font-bold text-red-500">Configuration Stripe requise</h3>
            <p className="text-sm text-gray-500">
              Ajoutez <code className="px-2 py-1 bg-gray-800 rounded text-yellow-400">VITE_STRIPE_PUBLISHABLE_KEY</code> dans votre fichier <code className="px-2 py-1 bg-gray-800 rounded text-cyan-400">.env</code>
            </p>
            <a 
              href="https://dashboard.stripe.com/apikeys" 
              target="_blank" 
              rel="noopener noreferrer"
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-bold hover:scale-105 transition-transform"
            >
              Obtenir une clé Stripe
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative group ${size === 'lg' ? 'w-80' : 'w-64'} mx-auto`}>
      {/* Effet brillant */}
      <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-pink-600 rounded-3xl blur-xl opacity-70 group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-pulse" />

      <div className={`relative p-8 rounded-3xl shadow-2xl backdrop-blur-xl border-2 border-white/20 ${isDarkMode ? 'bg-black/80' : 'bg-white/90'} transition-all hover:scale-105`}>
        {/* Icône */}
        <div className={`w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r ${currentPlan.color} flex items-center justify-center text-white shadow-lg`}>
          {currentPlan.icon}
        </div>

        {/* Titre */}
        <h3 className="text-3xl font-black text-center bg-clip-text text-transparent bg-gradient-to-r from-yellow-400 to-pink-500">
          {currentPlan.name}
        </h3>

        {/* Prix */}
        <div className="text-center my-4">
          <span className={`text-5xl font-black drop-shadow-lg ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            {currentPlan.price}
          </span>
          <span className={`text-sm ${isDarkMode ? 'text-white/80' : 'text-gray-600'}`}>/mois</span>
        </div>

        {/* Fonctionnalités */}
        <ul className="space-y-3 mb-6">
          {currentPlan.features.map((feat, i) => (
            <li key={i} className={`flex items-center gap-3 ${isDarkMode ? 'text-white/90' : 'text-gray-700'}`}>
              <FaBrain className="text-yellow-400" />
              <span className="text-sm font-medium">{feat}</span>
            </li>
          ))}
        </ul>

        {/* Bouton */}
        <button
          onClick={handleCheckout}
          disabled={loading || user?.isPremium || !stripePromise}
          className={`w-full py-4 rounded-2xl font-bold text-lg shadow-xl transition-all transform active:scale-95
            ${loading || user?.isPremium || !stripePromise
              ? 'bg-gray-600 cursor-not-allowed' 
              : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white'
            }`}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-3">
              <div className="w-5 h-5 border-4 border-white/30 border-t-white rounded-full animate-spin" />
              Redirection Stripe...
            </span>
          ) : user?.isPremium ? (
            <span className="flex items-center justify-center gap-2">
              <FaCrown /> Déjà {currentPlan.name}
            </span>
          ) : !stripePromise ? (
            <span className="flex items-center justify-center gap-2">
              <FaLock /> Chargement...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <FaVolumeUp /> Activer {currentPlan.name}
            </span>
          )}
        </button>

        {/* Badge IA */}
        <div className="mt-4 text-center">
          <span className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600/50 rounded-full text-xs font-bold text-white">
            <FaBrain className="animate-pulse" />
            GROK-3 PRÉDICTION INCLUSE
          </span>
        </div>
      </div>
    </div>
  );
}