// src/pages/profile/Business/CreateOpportunityModal.jsx
// Modal de création d'opportunité — alignée sur le schéma réel
// utilisé par OpportunitiesPage.jsx / OppDetailModal.jsx :
//   type: "emploi" | "stage" | "appel_offre"  (seuls types reconnus par TYPE_CONFIG)
//   title, description, company, location, tags[], expiresAt, source, sourceUrl
// Déclenché depuis ProfileHeader (page entreprise) — bouton "Créer une opportunité"
//
// v2 — colorScheme ajouté sur la modal + les inputs natifs (select, date) pour que
// la liste déroulante et l'icône calendrier du navigateur suivent isDarkMode.

import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import {
  Briefcase, GraduationCap, FileText, X, MapPin,
  CalendarClock, Banknote, Check,
} from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import { useDarkMode } from "../../../context/DarkModeContext";
import { profileApiPath, authJsonHeaders } from "../profileApi";

// ─── types — STRICTEMENT alignés sur TYPE_CONFIG d'OpportunitiesPage ──────────
// ⚠️ Ne pas ajouter d'autres valeurs ici : tout type absent de TYPE_CONFIG dans
// OpportunitiesPage.jsx / OppDetailModal.jsx retombe silencieusement sur le
// rendu "emploi" (mauvaise couleur/icône/label affichés sur la carte).
const OPPORTUNITY_TYPES = [
  { id: "emploi",      label: "Emploi",         emoji: "💼", Icon: Briefcase },
  { id: "stage",       label: "Stage",          emoji: "🎓", Icon: GraduationCap },
  { id: "appel_offre", label: "Appel d'offres", emoji: "📋", Icon: FileText },
];

const CONTRACT_TYPES = ["CDI", "CDD", "Stage", "Intérim", "Freelance / Prestataire"];
const EXPERIENCE_LEVELS = ["Débutant", "1–3 ans", "3–5 ans", "5 ans et plus"];

const normalizeUrl = (url) => {
  if (!url) return null;
  const clean = url.trim();
  if (!clean) return null;
  return /^https?:\/\//i.test(clean) ? clean : `https://${clean}`;
};

// ─── tags compétences requises ─────────────────────────────────────────────
function TagsInput({ tags, onChange, isDarkMode, placeholder }) {
  const [input, setInput] = useState("");
  const border = isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)";
  const bg     = isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)";
  const text   = isDarkMode ? "#f8fafc" : "#0f172a";
  const muted  = isDarkMode ? "#6b7280" : "#9ca3af";

  const add = () => {
    const val = input.trim();
    if (!val || tags.includes(val) || tags.length >= 12) return;
    onChange([...tags, val]);
    setInput("");
  };
  const remove = (s) => onChange(tags.filter((x) => x !== s));

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder={placeholder}
          maxLength={40}
          style={{
            flex: 1, padding: "11px 14px", borderRadius: 12,
            border: `1.5px solid ${border}`, background: bg, color: text,
            fontSize: 13, fontFamily: "'Sora','DM Sans',sans-serif", outline: "none",
            colorScheme: isDarkMode ? "dark" : "light",
          }}
        />
        <motion.button
          type="button" onClick={add} whileTap={{ scale: 0.95 }}
          disabled={!input.trim() || tags.length >= 12}
          style={{
            padding: "0 16px", borderRadius: 12, border: "none",
            background: input.trim() && tags.length < 12
              ? "linear-gradient(135deg,#f97316,#ec4899)"
              : (isDarkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)"),
            color: input.trim() && tags.length < 12 ? "#fff" : muted,
            fontWeight: 700, fontSize: 13, cursor: "pointer",
            fontFamily: "'Sora','DM Sans',sans-serif",
          }}
        >
          + Ajouter
        </motion.button>
      </div>

      {tags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {tags.map((s) => (
            <motion.span
              key={s}
              initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "5px 12px", borderRadius: 20,
                background: isDarkMode ? "rgba(249,115,22,0.12)" : "rgba(249,115,22,0.08)",
                border: "1px solid rgba(249,115,22,0.25)",
                color: "#f97316", fontSize: 12, fontWeight: 600,
                fontFamily: "'Sora','DM Sans',sans-serif",
              }}
            >
              {s}
              <button
                type="button" onClick={() => remove(s)}
                style={{ background: "none", border: "none", color: "#f97316", cursor: "pointer", padding: 0, fontSize: 14, lineHeight: 1, opacity: 0.7 }}
              >×</button>
            </motion.span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── composant principal ──────────────────────────────────────────────────
export default function CreateOpportunityModal({ isOpen, onClose, user, showToast, onCreated }) {
  const { getToken }   = useAuth();
  const { isDarkMode } = useDarkMode();

  const bi = user?.businessInfo || {};

  const [form, setForm] = useState({
    type:             "emploi",
    title:            "",
    description:      "",
    location:         user?.location || "",
    contractType:     "",
    experienceLevel:  "",
    budget:           "",
    expiresAt:        "",
    tags:             [],
    contactEmail:     bi.email || user?.email || "",
    contactPhone:     bi.phone || "",
  });

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const border = isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)";
  const bg     = isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)";
  const text   = isDarkMode ? "#f8fafc" : "#0f172a";
  const muted  = isDarkMode ? "#6b7280" : "#9ca3af";

  const set = (key, val) => {
    setForm((prev) => ({ ...prev, [key]: val }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: null }));
  };

  const isJobLike = form.type === "emploi" || form.type === "stage";

  const validate = () => {
    const e = {};
    if (!form.title.trim())       e.title       = "Requis";
    if (!form.description.trim()) e.description = "Requis";
    if (!form.location.trim())    e.location    = "Requis";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const resetForm = () => {
    setForm({
      type: "emploi", title: "", description: "", location: user?.location || "",
      contractType: "", experienceLevel: "", budget: "", expiresAt: "",
      tags: [], contactEmail: bi.email || user?.email || "", contactPhone: bi.phone || "",
    });
    setErrors({});
  };

  const handleSubmit = useCallback(async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const token = await getToken?.();
      if (!token) throw new Error("Session expirée");

      // ── Lien de candidature : mailto > site web > page profil ──
      const sourceUrl =
        (form.contactEmail.trim() && `mailto:${form.contactEmail.trim()}`) ||
        normalizeUrl(bi.website || user?.website) ||
        `${window.location.origin}/profile/${user?._id}`;

      // ── Payload aligné sur le schéma lu par OpportunitiesPage / OppDetailModal ──
      const payload = {
        type:            form.type,                 // "emploi" | "stage" | "appel_offre"
        title:           form.title.trim(),
        description:     form.description.trim(),
        company:         bi.name || user?.fullName || "Entreprise",
        location:        form.location.trim(),
        tags:            form.tags,
        expiresAt:       form.expiresAt || null,
        source:          "chantilink",
        sourceUrl,
        // métadonnées additionnelles (non affichées par le feed actuel,
        // mais utiles pour un futur écran de candidature interne)
        contractType:    isJobLike ? (form.contractType || null) : null,
        experienceLevel: isJobLike ? (form.experienceLevel || null) : null,
        budget:          form.budget.trim() || null,
        contactEmail:    form.contactEmail.trim() || null,
        contactPhone:    form.contactPhone.trim() || null,
        businessId:      user?._id,
        businessLogo:    user?.profilePhoto || null,
        businessCategory: bi.category || null,
      };

      const { data } = await axios.post(
        profileApiPath("opportunities"),
        payload,
        { headers: authJsonHeaders(token), withCredentials: true, timeout: 10000 }
      );

      showToast?.("Opportunité publiée ! 🎉", "success");
      resetForm();
      onCreated?.(data?.opportunity || data);
      onClose?.();
    } catch (err) {
      const msg = err?.response?.data?.message || err.message || "Erreur lors de la publication";
      showToast?.(msg, "error");
    } finally {
      setSaving(false);
    }
  }, [form, user, bi, isJobLike, getToken, onCreated, onClose, showToast]); // eslint-disable-line react-hooks/exhaustive-deps

  // ✅ colorScheme : fait suivre le thème natif du navigateur (liste déroulante
  // des <select>, icône calendrier des <input type="date">, scrollbars) à isDarkMode.
  const inputStyle = (key) => ({
    width: "100%", padding: "12px 14px", borderRadius: 12,
    border: `1.5px solid ${errors[key] ? "#ef4444" : border}`,
    background: bg, color: text, fontSize: 13,
    fontFamily: "'Sora','DM Sans',sans-serif", outline: "none",
    resize: "vertical", boxSizing: "border-box",
    colorScheme: isDarkMode ? "dark" : "light",
  });

  const labelStyle = {
    fontSize: 12, fontWeight: 700, color: muted, marginBottom: 6,
    display: "block", textTransform: "uppercase", letterSpacing: "0.04em",
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(12px)" }}
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.92, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          style={{
            width: "100%", maxWidth: 560, maxHeight: "88vh",
            borderRadius: 26, overflow: "hidden",
            background: isDarkMode ? "rgba(15,15,15,0.98)" : "rgba(255,255,255,0.98)",
            border: isDarkMode ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.08)",
            boxShadow: "0 32px 80px rgba(0,0,0,0.5)",
            display: "flex", flexDirection: "column",
            fontFamily: "'Sora','DM Sans',sans-serif",
            colorScheme: isDarkMode ? "dark" : "light",
          }}
        >
          {/* Header */}
          <div style={{
            padding: "18px 22px", display: "flex", alignItems: "center", justifyContent: "space-between",
            borderBottom: `1px solid ${border}`,
            background: isDarkMode ? "rgba(20,20,20,0.95)" : "rgba(250,250,250,0.95)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 12,
                background: "linear-gradient(135deg,#f97316,#ec4899)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Briefcase size={18} color="#fff" />
              </div>
              <h2 style={{ fontSize: 17, fontWeight: 800, color: text, margin: 0 }}>
                Nouvelle opportunité
              </h2>
            </div>
            <motion.button
              onClick={onClose} whileHover={{ scale: 1.1, rotate: 90 }} whileTap={{ scale: 0.9 }}
              style={{
                width: 34, height: 34, borderRadius: 12, border: "none", cursor: "pointer",
                background: isDarkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
                color: muted, display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <X size={17} />
            </motion.button>
          </div>

          {/* Body */}
          <div style={{ padding: "20px 22px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Type — limité aux 3 types reconnus par la page Opportunités */}
            <div>
              <label style={labelStyle}>Type d'opportunité</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {OPPORTUNITY_TYPES.map((t) => {
                  const active = form.type === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => set("type", t.id)}
                      style={{
                        padding: "7px 14px", borderRadius: 999, cursor: "pointer",
                        border: active ? "none" : `1px solid ${border}`,
                        background: active ? "linear-gradient(135deg,#f97316,#ec4899)" : bg,
                        color: active ? "#fff" : text,
                        fontSize: 12, fontWeight: 700,
                        fontFamily: "'Sora','DM Sans',sans-serif",
                      }}
                    >
                      {t.emoji} {t.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Titre */}
            <div>
              <label style={labelStyle}>Titre<span style={{ color: "#f97316", marginLeft: 4 }}>*</span></label>
              <input
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="Ex : Chef de chantier BTP — Abidjan"
                style={inputStyle("title")}
              />
              {errors.title && <p style={{ fontSize: 11, color: "#ef4444", marginTop: 4 }}>{errors.title}</p>}
            </div>

            {/* Description */}
            <div>
              <label style={labelStyle}>Description<span style={{ color: "#f97316", marginLeft: 4 }}>*</span></label>
              <textarea
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Missions, profil recherché, conditions…"
                rows={4} maxLength={1000}
                style={inputStyle("description")}
              />
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
                <span style={{ fontSize: 11, color: muted }}>{form.description.length}/1000</span>
              </div>
              {errors.description && <p style={{ fontSize: 11, color: "#ef4444", marginTop: 4 }}>{errors.description}</p>}
            </div>

            {/* Localisation + Échéance */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={labelStyle}>
                  <MapPin size={11} style={{ display: "inline", marginRight: 4 }} />
                  Lieu<span style={{ color: "#f97316", marginLeft: 4 }}>*</span>
                </label>
                <input
                  value={form.location}
                  onChange={(e) => set("location", e.target.value)}
                  placeholder="Cocody, Abidjan"
                  style={inputStyle("location")}
                />
                {errors.location && <p style={{ fontSize: 11, color: "#ef4444", marginTop: 4 }}>{errors.location}</p>}
              </div>
              <div>
                <label style={labelStyle}>
                  <CalendarClock size={11} style={{ display: "inline", marginRight: 4 }} />
                  Date de clôture
                </label>
                <input
                  type="date"
                  value={form.expiresAt}
                  onChange={(e) => set("expiresAt", e.target.value)}
                  style={inputStyle("expiresAt")}
                />
              </div>
            </div>

            {/* Contrat + Expérience (emploi / stage uniquement) */}
            {isJobLike && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Type de contrat</label>
                  <select
                    value={form.contractType}
                    onChange={(e) => set("contractType", e.target.value)}
                    style={{ ...inputStyle("contractType"), appearance: "none", cursor: "pointer" }}
                  >
                    <option value="">— Choisir —</option>
                    {CONTRACT_TYPES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Expérience requise</label>
                  <select
                    value={form.experienceLevel}
                    onChange={(e) => set("experienceLevel", e.target.value)}
                    style={{ ...inputStyle("experienceLevel"), appearance: "none", cursor: "pointer" }}
                  >
                    <option value="">— Choisir —</option>
                    {EXPERIENCE_LEVELS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
            )}

            {/* Budget / Rémunération */}
            <div>
              <label style={labelStyle}>
                <Banknote size={11} style={{ display: "inline", marginRight: 4 }} />
                Rémunération / Budget (XOF)
              </label>
              <input
                value={form.budget}
                onChange={(e) => set("budget", e.target.value)}
                placeholder="Ex : 300 000 – 450 000 XOF / mois, ou Négociable"
                style={inputStyle("budget")}
              />
            </div>

            {/* Tags / compétences */}
            <div>
              <label style={labelStyle}>Compétences requises</label>
              <TagsInput
                tags={form.tags}
                onChange={(s) => set("tags", s)}
                isDarkMode={isDarkMode}
                placeholder="Ex : Coffrage, AutoCAD, Permis B…"
              />
            </div>

            {/* Contact */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={labelStyle}>Email de contact</label>
                <input
                  type="email"
                  value={form.contactEmail}
                  onChange={(e) => set("contactEmail", e.target.value)}
                  placeholder="contact@entreprise.ci"
                  style={inputStyle("contactEmail")}
                />
              </div>
              <div>
                <label style={labelStyle}>Téléphone de contact</label>
                <input
                  type="tel"
                  value={form.contactPhone}
                  onChange={(e) => set("contactPhone", e.target.value)}
                  placeholder="+225 07 00 00 00"
                  style={inputStyle("contactPhone")}
                />
              </div>
            </div>

            {!form.contactEmail.trim() && (
              <p style={{ fontSize: 11, color: muted, margin: 0 }}>
                💡 Sans email de contact, le bouton "Postuler" redirigera vers ton site web ou ta page profil.
              </p>
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: "16px 22px", borderTop: `1px solid ${border}` }}>
            <motion.button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              whileHover={{ scale: saving ? 1 : 1.02, y: saving ? 0 : -1 }}
              whileTap={{ scale: 0.97 }}
              style={{
                width: "100%", padding: "14px 24px", borderRadius: 14, border: "none",
                background: saving
                  ? (isDarkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)")
                  : "linear-gradient(135deg,#f97316,#ec4899)",
                color: saving ? muted : "#fff",
                fontWeight: 800, fontSize: 14,
                cursor: saving ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                boxShadow: saving ? "none" : "0 6px 20px rgba(249,115,22,0.3)",
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? (
                <>
                  <span style={{ width: 16, height: 16, border: "2px solid currentColor", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                  Publication…
                </>
              ) : (
                <>
                  <Check size={16} />
                  Publier l'opportunité
                </>
              )}
            </motion.button>
          </div>

          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}