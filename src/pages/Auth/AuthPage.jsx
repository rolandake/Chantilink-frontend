// src/pages/Auth/AuthPage.jsx - INSCRIPTION CORRIGÉE
import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  User,
  XCircle,
  CheckCircle,
  ArrowRight,
  Shield,
  Loader2,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function AuthPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const [isRegister, setIsRegister] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const firstInputRef = useRef(null);

  // === Focus initial + reset au changement de mode ===
  useEffect(() => {
    setTimeout(() => firstInputRef.current?.focus(), 300);
    setForm({ fullName: "", email: "", password: "" });
    setErrors({});
  }, [isRegister]);

  // === Notification toast ===
  const notify = (type, message) => {
    const id = Date.now() + Math.random();
    setNotifications((prev) => [...prev, { id, type, message }]);
    setTimeout(
      () => setNotifications((prev) => prev.filter((n) => n.id !== id)),
      4000
    );
  };

  // === Gestion des inputs ===
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  // === Validation stricte ===
  const validate = () => {
    const newErrors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (isRegister) {
      if (!form.fullName?.trim()) {
        newErrors.fullName = "Nom complet requis";
      } else if (form.fullName.trim().length < 3) {
        newErrors.fullName = "Minimum 3 caractères";
      } else if (form.fullName.trim().length > 30) {
        newErrors.fullName = "Maximum 30 caractères";
      }
    }

    if (!form.email?.trim()) {
      newErrors.email = "Email requis";
    } else if (!emailRegex.test(form.email.trim())) {
      newErrors.email = "Email invalide";
    }

    if (!form.password?.trim()) {
      newErrors.password = "Mot de passe requis";
    } else if (form.password.trim().length < 6) {
      newErrors.password = "Minimum 6 caractères";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // === Soumission sécurisée ===
  const submit = async (e) => {
    e.preventDefault();
    
    if (loading) {
      notify("error", "Veuillez patienter...");
      return;
    }

    if (!validate()) {
      notify("error", "Veuillez corriger les erreurs");
      return;
    }

    setLoading(true);
    
    try {
      if (isRegister) {
        console.log("📤 Tentative d'inscription...");
        
        const result = await register(
          form.fullName.trim(),
          form.email.trim().toLowerCase(),
          form.password.trim()
        );
        
        console.log("📥 Résultat inscription:", result);

        if (result?.success) {
          notify("success", "Compte créé avec succès !");
          setTimeout(() => navigate("/"), 1500);
        } else {
          notify("error", result?.message || "Échec de l'inscription");
        }
      } else {
        console.log("📤 Tentative de connexion...");
        
        const result = await login(
          form.email.trim().toLowerCase(),
          form.password.trim()
        );
        
        console.log("📥 Résultat connexion:", result);

        if (result?.success) {
          notify("success", "Connexion réussie !");
          setTimeout(() => navigate("/"), 1000);
        } else {
          notify("error", result?.message || "Identifiants incorrects");
        }
      }
    } catch (err) {
      console.error("❌ Erreur:", err);
      notify("error", err.message || "Erreur réseau");
    } finally {
      setLoading(false);
    }
  };

  // === Classes dynamiques pour inputs ===
  const inputClass = (field) =>
    `w-full px-4 py-3 pl-12 rounded-xl border-2 transition-all duration-300 bg-white/10 backdrop-blur-lg text-white placeholder:text-white/60 ${
      errors[field]
        ? "border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/40"
        : "border-white/30 focus:border-orange-400 focus:ring-2 focus:ring-orange-400/40"
    }`;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-[#1a1a2e] via-[#162447] to-[#1f4068] overflow-hidden">
      {/* === Toasts === */}
      <div className="fixed top-16 right-4 flex flex-col gap-2 z-50 max-w-xs">
        <AnimatePresence>
          {notifications.map((n) => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 100 }}
              className={`flex items-center gap-2 px-4 py-3 rounded-xl text-white shadow-lg ${
                n.type === "success" ? "bg-green-500" : "bg-red-500"
              }`}
            >
              {n.type === "success" ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <XCircle className="w-4 h-4" />
              )}
              <span className="font-medium text-sm">{n.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* === Carte principale === */}
      <motion.div
        className="w-full max-w-md p-8 bg-gradient-to-br from-[#162447]/50 via-[#1a1a2e]/40 to-[#1f4068]/60 rounded-3xl shadow-2xl border border-white/20 backdrop-blur-xl"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, type: "spring", stiffness: 90 }}
      >
        {/* === Logo / Titre === */}
        <div className="text-center mb-6">
          <motion.div
            initial={{ y: -20 }}
            animate={{ y: 0 }}
            className="inline-flex items-center gap-3 mb-4"
          >
            <Shield className="w-10 h-10 text-orange-400" />
            <h1 className="text-3xl font-bold text-white">SecureAuth</h1>
          </motion.div>
          <p className="text-white/70">
            {isRegister
              ? "Rejoignez la communauté premium"
              : "Ravi de vous revoir !"}
          </p>
        </div>

        {/* === Onglets === */}
        <div className="flex gap-2 mb-6 bg-white/10 backdrop-blur-sm rounded-2xl p-1.5">
          <motion.button
            type="button"
            onClick={() => setIsRegister(false)}
            className={`flex-1 py-3 rounded-xl font-semibold transition-all duration-300 ${
              !isRegister
                ? "bg-white/20 text-orange-400 shadow-[0_0_15px_rgba(255,165,0,0.5)]"
                : "text-white/70 hover:text-white"
            }`}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Connexion
          </motion.button>
          <motion.button
            type="button"
            onClick={() => setIsRegister(true)}
            className={`flex-1 py-3 rounded-xl font-semibold transition-all duration-300 ${
              isRegister
                ? "bg-white/20 text-orange-400 shadow-[0_0_15px_rgba(255,165,0,0.5)]"
                : "text-white/70 hover:text-white"
            }`}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Inscription
          </motion.button>
        </div>

        {/* === Formulaire === */}
        <form onSubmit={submit} className="space-y-5">
          {/* Nom complet */}
          <AnimatePresence>
            {isRegister && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="relative"
              >
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/60" />
                <input
                  ref={firstInputRef}
                  type="text"
                  name="fullName"
                  placeholder="Nom complet"
                  value={form.fullName}
                  onChange={handleChange}
                  className={inputClass("fullName")}
                  autoComplete="name"
                />
                {errors.fullName && (
                  <motion.p
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-red-400 text-xs mt-1 flex items-center gap-1"
                  >
                    <XCircle className="w-3 h-3" /> {errors.fullName}
                  </motion.p>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Email */}
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/60" />
            <input
              ref={!isRegister ? firstInputRef : null}
              type="email"
              name="email"
              placeholder="Email"
              value={form.email}
              onChange={handleChange}
              className={inputClass("email")}
              autoComplete="email"
            />
            {errors.email && (
              <motion.p
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-red-400 text-xs mt-1 flex items-center gap-1"
              >
                <XCircle className="w-3 h-3" /> {errors.email}
              </motion.p>
            )}
          </div>

          {/* Mot de passe */}
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/60" />
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              placeholder="Mot de passe"
              value={form.password}
              onChange={handleChange}
              className={inputClass("password")}
              autoComplete={isRegister ? "new-password" : "current-password"}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition"
            >
              {showPassword ? (
                <EyeOff className="w-5 h-5" />
              ) : (
                <Eye className="w-5 h-5" />
              )}
            </button>
            {errors.password && (
              <motion.p
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-red-400 text-xs mt-1 flex items-center gap-1"
              >
                <XCircle className="w-3 h-3" /> {errors.password}
              </motion.p>
            )}
          </div>

          {/* Bouton principal */}
          <motion.button
            type="submit"
            disabled={loading}
            whileHover={!loading ? { scale: 1.03 } : {}}
            whileTap={!loading ? { scale: 0.97 } : {}}
            className={`w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-3 transition-all ${
              loading
                ? "opacity-60 cursor-not-allowed"
                : "hover:from-orange-600 hover:to-orange-700 hover:shadow-orange-500/50"
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Chargement...</span>
              </>
            ) : (
              <>
                <span>{isRegister ? "Créer mon compte" : "Se connecter"}</span>
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </motion.button>
        </form>

        {/* === Lien de basculement === */}
        <div className="mt-6 text-center">
          <p className="text-white/60 text-sm">
            {isRegister ? "Déjà un compte ?" : "Pas encore de compte ?"}
            <button
              type="button"
              onClick={() => setIsRegister(!isRegister)}
              disabled={loading}
              className={`ml-2 text-orange-400 font-semibold hover:text-orange-300 transition underline ${
                loading ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              {isRegister ? "Se connecter" : "S'inscrire gratuitement"}
            </button>
          </p>
        </div>

        {/* === Mention légale === */}
        <p className="text-center text-white/40 text-xs mt-8">
          Protégé par chiffrement de bout en bout
        </p>
      </motion.div>
    </div>
  );
}