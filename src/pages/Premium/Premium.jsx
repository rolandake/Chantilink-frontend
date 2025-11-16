// src/pages/Premium.jsx
import { motion } from "framer-motion";
import { SparklesIcon, CheckIcon } from "@heroicons/react/24/solid";
import { useNavigate } from "react-router-dom";

export default function Premium() {
  const navigate = useNavigate();

  const handleSubscribe = () => {
    // À connecter à Stripe plus tard
    alert("Redirection vers Stripe...");
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-pink-800 to-rose-900 flex items-center justify-center p-6">
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-white/10 backdrop-blur-2xl rounded-3xl p-10 max-w-2xl w-full shadow-2xl border border-white/20"
      >
        <div className="text-center mb-10">
          <SparklesIcon className="w-20 h-20 text-yellow-400 mx-auto mb-4" />
          <h1 className="text-5xl font-black text-white mb-3">ÉLITE</h1>
          <p className="text-2xl text-white/90">Accès exclusif • Réactions • Stories privées</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-10">
          {["Stories illimitées", "Réactions exclusives", "Badge ÉLITE"].map((feat, i) => (
            <div key={i} className="bg-white/20 rounded-2xl p-6 text-center">
              <CheckIcon className="w-10 h-10 text-green-400 mx-auto mb-3" />
              <p className="text-white font-bold">{feat}</p>
            </div>
          ))}
        </div>

        <div className="text-center">
          <p className="text-white text-5xl font-black mb-2">4,99€<span className="text-xl">/mois</span></p>
          <button
            onClick={handleSubscribe}
            className="px-12 py-5 bg-gradient-to-r from-yellow-400 to-pink-500 text-black font-bold text-xl rounded-full hover:scale-110 transition-transform"
          >
            Devenir ÉLITE
          </button>
        </div>
      </motion.div>
    </div>
  );
}