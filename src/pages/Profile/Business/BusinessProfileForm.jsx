// src/pages/Profile/Business/BusinessProfileForm.jsx
// Formulaire de création / mise à jour de la page entreprise
// Appelé depuis SettingsSection (onglet "Entreprise")
//
// v2 — colorScheme ajouté sur les inputs natifs (select) pour que la liste
// déroulante du navigateur suive isDarkMode, comme le reste du formulaire.

import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { useAuth } from "../../../context/AuthContext";
import { useDarkMode } from "../../../context/DarkModeContext";
import { PROFILE_BACKEND_BASE } from "../profileApi";

const BASE_URL = PROFILE_BACKEND_BASE;

// ─── catégories sectorielles ──────────────────────────────────────────────────
const CATEGORIES = [
  "BTP · Construction",
  "Immobilier · Vente de terrains",
  "Commerce · Distribution",
  "Restauration · Food",
  "Santé · Médical",
  "Éducation · Formation",
  "Transport · Logistique",
  "Informatique · Tech",
  "Mode · Beauté",
  "Agriculture · Élevage",
  "Artisanat · Manufacture",
  "Finance · Comptabilité",
  "Droit · Consulting",
  "Événementiel · Communication",
  "Autre",
];

const EMPLOYEES_RANGES = [
  "1 – 5 employés",
  "6 – 20 employés",
  "21 – 50 employés",
  "51 – 200 employés",
  "200+ employés",
];

// ─── champs de formulaire ─────────────────────────────────────────────────────
const FIELDS = [
  { key: "businessName",           label: "Nom de l'entreprise",    placeholder: "JD BAT SARL",                                          type: "text",     required: true  },
  { key: "businessDescription",    label: "Description",             placeholder: "Ce que fait votre entreprise en 2–3 phrases concises…", type: "textarea", required: true  },
  { key: "businessCategory",       label: "Secteur d'activité",      placeholder: "",                                                     type: "select",   required: true  },
  { key: "businessPhone",          label: "Téléphone professionnel", placeholder: "+225 07 00 00 00",                                     type: "tel",      required: false },
  { key: "businessEmail",          label: "Email professionnel",     placeholder: "contact@entreprise.ci",                                type: "email",    required: false },
  { key: "businessAddress",        label: "Adresse physique",        placeholder: "Cocody M'Badon, Abidjan",                              type: "text",     required: false },
  { key: "businessOpeningHours",   label: "Horaires d'ouverture",    placeholder: "Lun–Ven 08h–17h · Sam 08h–13h",                       type: "text",     required: false },
  { key: "businessWebsite",        label: "Site web",                placeholder: "https://jdbat.ci",                                     type: "url",      required: false },
  { key: "businessEmployeesRange", label: "Effectif",                placeholder: "",                                                     type: "select",   required: false },
];

// ─── composant tag services ───────────────────────────────────────────────────
function ServiceTags({ services, onChange, isDarkMode }) {
  const [input, setInput] = useState("");
  const border = isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)";
  const bg     = isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)";
  const text   = isDarkMode ? "#f8fafc" : "#0f172a";
  const muted  = isDarkMode ? "#6b7280" : "#9ca3af";

  const add = () => {
    const val = input.trim();
    if (!val || services.includes(val) || services.length >= 10) return;
    onChange([...services, val]);
    setInput("");
  };

  const remove = (s) => onChange(services.filter((x) => x !== s));

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder="Ex : Maçonnerie, Terrassement…"
          maxLength={40}
          style={{
            flex: 1,
            padding: "11px 14px",
            borderRadius: 12,
            border: `1.5px solid ${border}`,
            background: bg,
            color: text,
            fontSize: 13,
            fontFamily: "'Sora','DM Sans',sans-serif",
            outline: "none",
            colorScheme: isDarkMode ? "dark" : "light",
          }}
        />
        <motion.button
          type="button"
          onClick={add}
          whileTap={{ scale: 0.95 }}
          disabled={!input.trim() || services.length >= 10}
          style={{
            padding: "0 16px",
            borderRadius: 12,
            border: "none",
            background: input.trim() && services.length < 10
              ? "linear-gradient(135deg,#f97316,#ec4899)"
              : (isDarkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)"),
            color: input.trim() && services.length < 10 ? "#fff" : muted,
            fontWeight: 700,
            fontSize: 13,
            cursor: "pointer",
            fontFamily: "'Sora','DM Sans',sans-serif",
          }}
        >
          + Ajouter
        </motion.button>
      </div>

      {services.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {services.map((s) => (
            <motion.span
              key={s}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "5px 12px",
                borderRadius: 20,
                background: isDarkMode ? "rgba(249,115,22,0.12)" : "rgba(249,115,22,0.08)",
                border: "1px solid rgba(249,115,22,0.25)",
                color: "#f97316",
                fontSize: 12,
                fontWeight: 600,
                fontFamily: "'Sora','DM Sans',sans-serif",
              }}
            >
              {s}
              <button
                type="button"
                onClick={() => remove(s)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#f97316",
                  cursor: "pointer",
                  padding: 0,
                  fontSize: 14,
                  lineHeight: 1,
                  opacity: 0.7,
                }}
              >
                ×
              </button>
            </motion.span>
          ))}
        </div>
      )}

      <p style={{ fontSize: 11, color: muted, marginTop: 6 }}>
        {services.length}/10 services · Appuie sur Entrée ou clique "+ Ajouter"
      </p>
    </div>
  );
}

// ─── composant principal ──────────────────────────────────────────────────────
export default function BusinessProfileForm({ user, showToast, onUserUpdated }) {
  const { getToken }   = useAuth();
  const { isDarkMode } = useDarkMode();

  const bi         = user?.businessInfo || {};
  const isBusiness = user?.accountType === "business";

  const [form, setForm] = useState({
    businessName:            bi.name           || user?.fullName || "",
    businessDescription:     bi.description    || "",
    businessCategory:        bi.category       || "",
    businessPhone:           bi.phone          || "",
    businessEmail:           bi.email          || "",
    businessAddress:         bi.address        || "",
    businessOpeningHours:    bi.openingHours   || "",
    businessWebsite:         bi.website        || user?.website || "",
    businessEmployeesRange:  bi.employeesRange || "",
    businessServices:        bi.services       || [],
  });

  const [enabled, setEnabled] = useState(isBusiness);
  const [saving,  setSaving]  = useState(false);
  const [errors,  setErrors]  = useState({});

  const border = isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)";
  const bg     = isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)";
  const text   = isDarkMode ? "#f8fafc" : "#0f172a";
  const muted  = isDarkMode ? "#6b7280" : "#9ca3af";
  const cardBg = isDarkMode ? "#111" : "#fff";

  const set = (key, val) => {
    setForm((prev) => ({ ...prev, [key]: val }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: null }));
  };

  const validate = () => {
    const e = {};
    if (enabled) {
      if (!form.businessName.trim())        e.businessName        = "Requis";
      if (!form.businessDescription.trim()) e.businessDescription = "Requis";
      if (!form.businessCategory)           e.businessCategory    = "Choisir une catégorie";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = useCallback(async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const token = await getToken?.();
      if (!token) throw new Error("Session expirée");

      const payload = {
        accountType: enabled ? "business" : "personal",
        ...(enabled && {
          businessName:           form.businessName.trim(),
          businessDescription:    form.businessDescription.trim(),
          businessCategory:       form.businessCategory,
          businessPhone:          form.businessPhone.trim(),
          businessEmail:          form.businessEmail.trim(),
          businessAddress:        form.businessAddress.trim(),
          businessOpeningHours:   form.businessOpeningHours.trim(),
          businessWebsite:        form.businessWebsite.trim(),
          businessEmployeesRange: form.businessEmployeesRange,
          businessServices:       form.businessServices,
        }),
      };

      const { data } = await axios.patch(
        `${BASE_URL}/api/users/${user._id}/business`,
        payload,
        {
          headers:         { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          withCredentials: true,
          timeout:         10000,
        }
      );

      if (data?.user) onUserUpdated?.(data.user);
      showToast?.(
        enabled ? "Page entreprise activée !" : "Compte repassé en profil personnel",
        "success"
      );
    } catch (err) {
      const msg = err?.response?.data?.message || err.message || "Erreur lors de la sauvegarde";
      showToast?.(msg, "error");
    } finally {
      setSaving(false);
    }
  }, [enabled, form, user?._id, getToken, onUserUpdated, showToast]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── styles partagés ──────────────────────────────────────────────────────
  // ✅ colorScheme : fait suivre le thème natif du navigateur (liste déroulante
  // des <select>, scrollbars internes) à isDarkMode, comme le reste du formulaire.
  const inputStyle = (key) => ({
    width:        "100%",
    padding:      "12px 14px",
    borderRadius: 12,
    border:       `1.5px solid ${errors[key] ? "#ef4444" : border}`,
    background:   bg,
    color:        text,
    fontSize:     13,
    fontFamily:   "'Sora','DM Sans',sans-serif",
    outline:      "none",
    resize:       "vertical",
    transition:   "border-color 0.2s",
    boxSizing:    "border-box",
    colorScheme:  isDarkMode ? "dark" : "light",
  });

  const labelStyle = {
    fontSize:       12,
    fontWeight:     700,
    color:          muted,
    marginBottom:   6,
    display:        "block",
    textTransform:  "uppercase",
    letterSpacing:  "0.04em",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, fontFamily: "'Sora','DM Sans',sans-serif", colorScheme: isDarkMode ? "dark" : "light" }}>

      {/* ── Toggle activation ──────────────────────────────────────────────── */}
      <div
        style={{
          display:        "flex",
          alignItems:     "center",
          justifyContent: "space-between",
          padding:        "18px 20px",
          borderRadius:   16,
          background:     enabled
            ? (isDarkMode ? "rgba(249,115,22,0.1)" : "rgba(249,115,22,0.06)")
            : cardBg,
          border:         `1.5px solid ${enabled ? "rgba(249,115,22,0.35)" : border}`,
          gap:            16,
        }}
      >
        <div>
          <p style={{ fontSize: 15, fontWeight: 800, color: text, margin: 0 }}>
            Page entreprise
          </p>
          <p style={{ fontSize: 12, color: muted, margin: "4px 0 0" }}>
            {enabled
              ? "Votre profil s'affiche en mode entreprise avec les infos pro"
              : "Activer pour transformer ce profil en page entreprise"}
          </p>
        </div>

        {/* Toggle switch */}
        <div
          onClick={() => setEnabled((v) => !v)}
          style={{
            width:        52,
            height:       28,
            borderRadius: 14,
            background:   enabled
              ? "#f97316"
              : (isDarkMode ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.15)"),
            cursor:       "pointer",
            position:     "relative",
            flexShrink:   0,
            transition:   "background 0.25s",
          }}
        >
          <motion.div
            animate={{ x: enabled ? 26 : 2 }}
            transition={{ type: "spring", stiffness: 500, damping: 35 }}
            style={{
              position:     "absolute",
              top:          3,
              width:        22,
              height:       22,
              borderRadius: "50%",
              background:   "#fff",
              boxShadow:    "0 2px 6px rgba(0,0,0,0.25)",
            }}
          />
        </div>
      </div>

      {/* ── Formulaire (visible uniquement si activé) ─────────────────────── */}
      <AnimatePresence>
        {enabled && (
          <motion.div
            key="biz-form"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22 }}
            style={{ display: "flex", flexDirection: "column", gap: 18 }}
          >

            {/* Encart info */}
            <div
              style={{
                padding:      "14px 16px",
                borderRadius: 12,
                background:   isDarkMode ? "rgba(59,130,246,0.08)" : "rgba(59,130,246,0.06)",
                border:       "1px solid rgba(59,130,246,0.2)",
                fontSize:     12,
                color:        isDarkMode ? "#93c5fd" : "#2563eb",
                lineHeight:   1.6,
              }}
            >
              💡 Ces informations remplacent la bio et sont affichées dans le bloc dédié de votre page entreprise.
            </div>

            {/* ── Champs ───────────────────────────────────────────────────── */}
            {FIELDS.map(({ key, label, placeholder, type, required }) => (
              <div key={key}>
                <label style={labelStyle}>
                  {label}
                  {required && <span style={{ color: "#f97316", marginLeft: 4 }}>*</span>}
                </label>

                {type === "textarea" ? (
                  <>
                    <textarea
                      value={form[key]}
                      onChange={(e) => set(key, e.target.value)}
                      placeholder={placeholder}
                      rows={4}
                      maxLength={500}
                      style={inputStyle(key)}
                      onFocus={(e) => { e.target.style.borderColor = errors[key] ? "#ef4444" : "#f97316"; }}
                      onBlur={(e)  => { e.target.style.borderColor = errors[key] ? "#ef4444" : border; }}
                    />
                    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
                      <span style={{ fontSize: 11, color: muted }}>{form[key].length}/500</span>
                    </div>
                  </>
                ) : type === "select" ? (
                  <select
                    value={form[key]}
                    onChange={(e) => set(key, e.target.value)}
                    style={{ ...inputStyle(key), appearance: "none", cursor: "pointer" }}
                  >
                    <option value="">— Choisir —</option>
                    {(key === "businessCategory" ? CATEGORIES : EMPLOYEES_RANGES).map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={type}
                    value={form[key]}
                    onChange={(e) => set(key, e.target.value)}
                    placeholder={placeholder}
                    style={inputStyle(key)}
                    onFocus={(e) => { e.target.style.borderColor = errors[key] ? "#ef4444" : "#f97316"; }}
                    onBlur={(e)  => { e.target.style.borderColor = errors[key] ? "#ef4444" : border; }}
                  />
                )}

                {errors[key] && (
                  <p style={{ fontSize: 11, color: "#ef4444", marginTop: 4 }}>{errors[key]}</p>
                )}
              </div>
            ))}

            {/* ── Services ─────────────────────────────────────────────────── */}
            <div>
              <label style={labelStyle}>Services proposés</label>
              <ServiceTags
                services={form.businessServices}
                onChange={(s) => set("businessServices", s)}
                isDarkMode={isDarkMode}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Bouton sauvegarder ───────────────────────────────────────────────── */}
      <motion.button
        type="button"
        onClick={handleSave}
        disabled={saving}
        whileHover={{ scale: saving ? 1 : 1.02, y: saving ? 0 : -1 }}
        whileTap={{ scale: 0.97 }}
        style={{
          padding:        "14px 24px",
          borderRadius:   14,
          border:         "none",
          background:     saving
            ? (isDarkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)")
            : "linear-gradient(135deg,#f97316,#ec4899)",
          color:          saving ? muted : "#fff",
          fontFamily:     "'Sora','DM Sans',sans-serif",
          fontWeight:     800,
          fontSize:       14,
          cursor:         saving ? "not-allowed" : "pointer",
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          gap:            10,
          boxShadow:      saving ? "none" : "0 6px 20px rgba(249,115,22,0.3)",
          opacity:        saving ? 0.7 : 1,
          transition:     "all 0.2s",
        }}
      >
        {saving ? (
          <>
            <span
              style={{
                display:        "inline-block",
                width:          16,
                height:         16,
                border:         "2px solid currentColor",
                borderTopColor: "transparent",
                borderRadius:   "50%",
                animation:      "spin 0.8s linear infinite",
              }}
            />
            Enregistrement…
          </>
        ) : (
          enabled ? "Enregistrer la page entreprise" : "Repasser en profil personnel"
        )}
      </motion.button>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}