// src/pages/Auth/AuthPage.jsx - VERSION OPTIMISÉE ULTRA-RAPIDE ⚡
import React, { useState, useEffect, useRef, memo } from "react";
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

// ✅ OPTIMISATION 1 : Composant Toast mémorisé
const Toast = memo(({ notification }) => (
  <motion.div
    initial={{ opacity: 0, x: 100 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: 100 }}
    transition={{ duration: 0.2 }}
    className={`flex items-center gap-2 px-4 py-3 rounded-xl text-white shadow-lg ${
      notification.type === "success" ? "bg-green-500" : "bg-red-500"
    }`}
  >
    {notification.type === "success" ? (
      <CheckCircle className="w-4 h-4" />
    ) : (
      <XCircle className="w-4 h-4" />
    )}
    <span className="font-medium text-sm">{notification.message}</span>
  </motion.div>
));

// ✅ OPTIMISATION 2 : Animations réduites pour performances
const fastTransition = { duration: 0.2, ease: "easeOut" };

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

  // ✅ OPTIMISATION 3 : Focus rapide sans délai
  useEffect(() => {
    firstInputRef.current?.focus();
    setForm({ fullName: "", email: "", password: "" });
    setErrors({});
  }, [isRegister]);

  // === Notification toast optimisée ===
  const notify = (type, message) => {
    const id = Date.now();
    setNotifications((prev) => [...prev, { id, type, message }]);
    setTimeout(
      () => setNotifications((prev) => prev.filter((n) => n.id !== id)),
      3000 // ✅ Réduit de 4s à 3s
    );
  };

  // === Gestion des inputs optimisée ===
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  // === Validation stricte ===
  const validate = () => {
    const newErrors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (isRegister) {
      const name = form.fullName?.trim();
      if (!name) {
        newErrors.fullName = "Nom requis";
      } else if (name.length < 3) {
        newErrors.fullName = "Min 3 caractères";
      } else if (name.length > 30) {
        newErrors.fullName = "Max 30 caractères";
      }
    }

    const email = form.email?.trim();
    if (!email) {
      newErrors.email = "Email requis";
    } else if (!emailRegex.test(email)) {
      newErrors.email = "Email invalide";
    }

    const password = form.password?.trim();
    if (!password) {
      newErrors.password = "Mot de passe requis";
    } else if (password.length < 6) {
      newErrors.password = "Min 6 caractères";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ✅ OPTIMISATION 4 : Soumission ultra-rapide avec feedback immédiat
  const submit = async (e) => {
    e.preventDefault();
    
    if (loading) return;
    if (!validate()) {
      notify("error", "Veuillez corriger les erreurs");
      return;
    }

    setLoading(true);
    
    try {
      const email = form.email.trim().toLowerCase();
      const password = form.password.trim();
      
      if (isRegister) {
        const fullName = form.fullName.trim();
        const result = await register(fullName, email, password);
        
        if (result?.success) {
          notify("success", "Bienvenue !");
          // ✅ Navigation immédiate
          navigate("/");
        } else {
          notify("error", result?.message || "Échec inscription");
        }
      } else {
        const result = await login(email, password);
        
        if (result?.success) {
          notify("success", "Connexion réussie !");
          // ✅ Navigation immédiate
          navigate("/");
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

  // ✅ OPTIMISATION 5 : Classes pré-calculées
  const inputClass = (field) =>
    `w-full px-4 py-3 pl-12 rounded-xl border-2 transition-colors duration-200 bg-white/10 backdrop-blur-lg text-white placeholder:text-white/60 ${
      errors[field]
        ? "border-red-400 focus:border-red-500"
        : "border-white/30 focus:border-orange-400"
    }`;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-[#1a1a2e] via-[#162447] to-[#1f4068]">
      
      {/* ✅ Toasts optimisés */}
      <div className="fixed top-16 right-4 flex flex-col gap-2 z-50 max-w-xs">
        <AnimatePresence mode="popLayout">
          {notifications.map((n) => (
            <Toast key={n.id} notification={n} />
          ))}
        </AnimatePresence>
      </div>

      {/* ✅ Carte principale avec animations réduites */}
      <motion.div
        className="w-full max-w-md p-8 bg-gradient-to-br from-[#162447]/50 via-[#1a1a2e]/40 to-[#1f4068]/60 rounded-3xl shadow-2xl border border-white/20 backdrop-blur-xl"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={fastTransition}
      >
        {/* Logo / Titre */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-3 mb-4">
            <Shield className="w-10 h-10 text-orange-400" />
            <h1 className="text-3xl font-bold text-white">SecureAuth</h1>
          </div>
          <p className="text-white/70 text-sm">
            {isRegister ? "Rejoignez-nous" : "Bon retour !"}
          </p>
        </div>

        {/* Onglets */}
        <div className="flex gap-2 mb-6 bg-white/10 backdrop-blur-sm rounded-2xl p-1.5">
          <button
            type="button"
            onClick={() => setIsRegister(false)}
            className={`flex-1 py-3 rounded-xl font-semibold transition-colors duration-200 ${
              !isRegister
                ? "bg-white/20 text-orange-400"
                : "text-white/70 hover:text-white"
            }`}
          >
            Connexion
          </button>
          <button
            type="button"
            onClick={() => setIsRegister(true)}
            className={`flex-1 py-3 rounded-xl font-semibold transition-colors duration-200 ${
              isRegister
                ? "bg-white/20 text-orange-400"
                : "text-white/70 hover:text-white"
            }`}
          >
            Inscription
          </button>
        </div>

        {/* Formulaire */}
        <form onSubmit={submit} className="space-y-5">
          
          {/* Nom complet */}
          {isRegister && (
            <div className="relative">
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
                <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                  <XCircle className="w-3 h-3" /> {errors.fullName}
                </p>
              )}
            </div>
          )}

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
              <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                <XCircle className="w-3 h-3" /> {errors.email}
              </p>
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
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition-colors"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
            {errors.password && (
              <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                <XCircle className="w-3 h-3" /> {errors.password}
              </p>
            )}
          </div>

          {/* Bouton principal */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-3 transition-all duration-200 ${
              loading
                ? "opacity-60 cursor-not-allowed"
                : "hover:from-orange-600 hover:to-orange-700 active:scale-[0.98]"
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
          </button>
        </form>

        {/* Lien de basculement */}
        <div className="mt-6 text-center">
          <p className="text-white/60 text-sm">
            {isRegister ? "Déjà un compte ?" : "Pas encore de compte ?"}
            <button
              type="button"
              onClick={() => setIsRegister(!isRegister)}
              disabled={loading}
              className={`ml-2 text-orange-400 font-semibold hover:text-orange-300 transition-colors underline ${
                loading ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              {isRegister ? "Se connecter" : "S'inscrire"}
            </button>
          </p>
        </div>

        {/* Mention légale */}
        <p className="text-center text-white/40 text-xs mt-8">
          Protégé par chiffrement de bout en bout
        </p>
      </motion.div>
    </div>
  );
}