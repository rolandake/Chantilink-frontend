// src/pages/PremiumCheckout.jsx
import { loadStripe } from "@stripe/stripe-js";
import { useAuth } from "../context/AuthContext";
import { motion } from "framer-motion";

const stripePromise = loadStripe("pk_test_51QEXAMPLE1234567890abcdef"); // Remplace par ta clé

export default function PremiumCheckout() {
  const { user } = useAuth();

  const handleCheckout = async () => {
    const stripe = await stripePromise;
    const response = await fetch("http://localhost:5000/create-checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify({ priceId: "price_1QElite1234567890" }), // Ton Price ID
    });

    const session = await response.json();
    await stripe.redirectToCheckout({ sessionId: session.id });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-gradient-to-br from-purple-900 to-pink-900 flex items-center justify-center p-6"
    >
      <div className="bg-white/10 backdrop-blur-2xl rounded-3xl p-10 max-w-md w-full text-center">
        <h1 className="text-5xl font-black text-white mb-6">Finalise ton abonnement</h1>
        <p className="text-white/90 mb-8">4,99€/mois • Accès instantané</p>
        <button
          onClick={handleCheckout}
          className="w-full py-6 bg-gradient-to-r from-yellow-400 to-pink-500 text-black font-bold text-2xl rounded-3xl shadow-2xl"
        >
          PAYER AVEC STRIPE
        </button>
        <p className="text-white/70 text-xs mt-4">Sécurisé • Annulable à tout moment</p>
      </div>
    </motion.div>
  );
}