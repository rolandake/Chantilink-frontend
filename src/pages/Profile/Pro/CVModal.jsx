// src/pages/profile/Pro/CVModal.jsx
// Modal affiché quand l'utilisateur clique sur le bouton "CV"
// dans ProfileHeader (mode profil pro)
// 3 options : Créer avec IA / Importer / Remplir manuellement
// Si "Créer avec IA" → affiche CVBuilderAI
// Si "Importer"      → input file PDF/Word
// Si "Manuel"        → ouvre CVForm

import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { useDarkMode } from "../../../context/DarkModeContext";
import { useAuth }      from "../../../context/AuthContext";
import { PROFILE_BACKEND_BASE } from "../profileApi";
import axios from "axios";

const BASE_URL = PROFILE_BACKEND_BASE;

// ── Spinner ────────────────────────────────────────────────────────────────────
const Spin = ({ size = 18, color = "#fff" }) => (
  <span style={{
    display:     "inline-block",
    width:       size,
    height:      size,
    border:      `2px solid ${color}40`,
    borderTopColor: color,
    borderRadius: "50%",
    animation:   "spin .8s linear infinite",
    flexShrink:  0,
  }} />
);

// ── Choix d'action ─────────────────────────────────────────────────────────────
const CHOICES = [
  {
    id:    "ai",
    icon:  "✨",
    label: "Créer avec l'IA",
    desc:  "Génère ton CV depuis ton profil en 30 sec",
    color: "#6366f1",
    gradient: "linear-gradient(135deg,#6366f1,#8b5cf6)",
    primary: true,
  },
  {
    id:    "import",
    icon:  "📄",
    label: "Importer un fichier",
    desc:  "PDF ou Word · 5 Mo max",
    color: "#f97316",
    gradient: null,
  },
  {
    id:    "manual",
    icon:  "✏️",
    label: "Remplir manuellement",
    desc:  "Formulaire section par section",
    color: "#22c55e",
    gradient: null,
  },
];

export default function CVModal({ isOpen, onClose, user, showToast, onUserUpdated }) {
  const { isDarkMode } = useDarkMode();
  const { getToken }   = useAuth();
  const [step,         setStep]         = useState("choice"); // "choice" | "ai" | "manual"
  const [uploading,    setUploading]    = useState(false);
  const fileInputRef                    = useRef(null);

  const bg   = isDarkMode ? "#111"    : "#fff";
  const bdr  = isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)";
  const text = isDarkMode ? "#f8fafc" : "#0f172a";
  const sub  = isDarkMode ? "#6b7280" : "#9ca3af";

  // ── Import fichier ──────────────────────────────────────────────────────────
  const handleFileImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ["application/pdf","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    if (!allowed.includes(file.type)) { showToast?.("PDF ou Word uniquement", "error"); return; }
    if (file.size > 5 * 1024 * 1024)  { showToast?.("5 Mo maximum", "error"); return; }

    setUploading(true);
    try {
      const token = await getToken?.();
      if (!token) throw new Error("Session expirée");
      const form = new FormData();
      form.append("cv", file);
      const { data } = await axios.put(
        `${BASE_URL}/api/users/${user._id}/cv`,
        form,
        { headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" }, timeout: 60000 }
      );
      if (data?.user) onUserUpdated?.(data.user);
      showToast?.("✅ CV importé !", "success");
      onClose();
    } catch (err) {
      showToast?.(err?.response?.data?.message || err.message || "Erreur lors de l'import", "error");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = null;
    }
  };

  const handleChoice = (id) => {
    if (id === "import") { fileInputRef.current?.click(); return; }
    if (id === "ai")     { setStep("ai"); return; }
    if (id === "manual") { setStep("manual"); return; }
  };

  const handleClose = () => { setStep("choice"); onClose(); };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position:      "fixed",
          inset:         0,
          zIndex:        100,
          display:       "flex",
          alignItems:    "flex-end",
          justifyContent:"center",
          background:    "rgba(0,0,0,0.65)",
          backdropFilter:"blur(10px)",
          padding:       "0 0 env(safe-area-inset-bottom,0)",
        }}
        onClick={handleClose}
      >
        <motion.div
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0,      opacity: 1 }}
          exit={{   y: "100%", opacity: 0 }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          style={{
            width:        "100%",
            maxWidth:     520,
            borderRadius: "24px 24px 0 0",
            background:   bg,
            border:       `1px solid ${bdr}`,
            borderBottom: "none",
            overflow:     "hidden",
            fontFamily:   "'Sora','DM Sans',sans-serif",
          }}
        >
          {/* ── Header ── */}
          <div style={{
            display:        "flex",
            alignItems:     "center",
            justifyContent: "space-between",
            padding:        "20px 20px 16px",
            borderBottom:   `1px solid ${bdr}`,
          }}>
            <div>
              <p style={{ fontSize: 16, fontWeight: 800, color: text, margin: 0 }}>
                {step === "choice" ? "Votre CV" : step === "ai" ? "Création IA" : "Remplir manuellement"}
              </p>
              <p style={{ fontSize: 12, color: sub, margin: "3px 0 0" }}>
                {step === "choice" ? "Choisissez comment créer ou importer votre CV" : ""}
              </p>
            </div>
            <motion.button
              type="button"
              onClick={handleClose}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              style={{
                width:        34,
                height:       34,
                borderRadius: 10,
                border:       "none",
                background:   isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
                color:        sub,
                display:      "flex",
                alignItems:   "center",
                justifyContent: "center",
                cursor:       "pointer",
              }}
            >
              <XMarkIcon style={{ width: 16, height: 16 }} />
            </motion.button>
          </div>

          {/* ── Input fichier caché ── */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx"
            onChange={handleFileImport}
            style={{ display: "none" }}
          />

          {/* ── Contenu ── */}
          <AnimatePresence mode="wait">

            {/* ÉTAPE : Choix */}
            {step === "choice" && (
              <motion.div
                key="choice"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{   opacity: 0, x: 20 }}
                style={{ padding: "16px 20px 24px", display: "flex", flexDirection: "column", gap: 10 }}
              >
                {CHOICES.map((c) => (
                  <motion.button
                    key={c.id}
                    type="button"
                    onClick={() => handleChoice(c.id)}
                    disabled={uploading && c.id === "import"}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    style={{
                      display:      "flex",
                      alignItems:   "center",
                      gap:          14,
                      padding:      "14px 16px",
                      borderRadius: 14,
                      border:       c.primary
                        ? "none"
                        : `1px solid ${bdr}`,
                      background:   c.primary
                        ? c.gradient
                        : isDarkMode ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
                      cursor:       "pointer",
                      textAlign:    "left",
                      fontFamily:   "inherit",
                      boxShadow:    c.primary
                        ? `0 6px 20px ${c.color}35`
                        : "none",
                    }}
                  >
                    <span style={{
                      width:        40,
                      height:       40,
                      borderRadius: 12,
                      background:   c.primary ? "rgba(255,255,255,0.15)" : `${c.color}15`,
                      display:      "flex",
                      alignItems:   "center",
                      justifyContent: "center",
                      fontSize:     20,
                      flexShrink:   0,
                    }}>
                      {c.id === "import" && uploading ? <Spin color={c.color} /> : c.icon}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize:   13,
                        fontWeight: 700,
                        color:      c.primary ? "#fff" : text,
                      }}>
                        {c.label}
                      </div>
                      <div style={{
                        fontSize: 11,
                        color:    c.primary ? "rgba(255,255,255,0.7)" : sub,
                        marginTop: 2,
                      }}>
                        {c.desc}
                      </div>
                    </div>
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none"
                      stroke={c.primary ? "rgba(255,255,255,0.6)" : sub}
                      strokeWidth={2} strokeLinecap="round">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </motion.button>
                ))}
              </motion.div>
            )}

            {/* ÉTAPE : Créer avec IA */}
            {step === "ai" && (
              <motion.div
                key="ai"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{   opacity: 0, x: -20 }}
                style={{ padding: "16px 20px 28px" }}
              >
                <CVBuilderAI
                  user={user}
                  showToast={showToast}
                  onUserUpdated={onUserUpdated}
                  onBack={() => setStep("choice")}
                  onDone={handleClose}
                  isDarkMode={isDarkMode}
                />
              </motion.div>
            )}

            {/* ÉTAPE : Manuel */}
            {step === "manual" && (
              <motion.div
                key="manual"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{   opacity: 0, x: -20 }}
                style={{ padding: "16px 20px 28px", maxHeight: "75vh", overflowY: "auto" }}
              >
                <CVForm
                  user={user}
                  showToast={showToast}
                  onUserUpdated={onUserUpdated}
                  onBack={() => setStep("choice")}
                  onDone={handleClose}
                  isDarkMode={isDarkMode}
                />
              </motion.div>
            )}

          </AnimatePresence>
        </motion.div>
      </motion.div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CVBuilderAI — génère le CV depuis les infos du profil via l'API Anthropic
// ─────────────────────────────────────────────────────────────────────────────
function CVBuilderAI({ user, showToast, onUserUpdated, onBack, onDone, isDarkMode }) {
  const { getToken } = useAuth();
  const [loading, setLoading]   = useState(false);
  const [preview, setPreview]   = useState(null);
  const [saving,  setSaving]    = useState(false);

  const text = isDarkMode ? "#f8fafc" : "#0f172a";
  const sub  = isDarkMode ? "#6b7280" : "#9ca3af";
  const bdr  = isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)";
  const card = isDarkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)";

  const generate = async () => {
    setLoading(true);
    try {
      const prompt = `Tu es un expert en rédaction de CV professionnels.
À partir des informations suivantes, génère un CV structuré en JSON.

Nom : ${user?.fullName || "Non renseigné"}
Bio : ${user?.bio || "Non renseignée"}
Localisation : ${user?.location || "Non renseignée"}
Site web : ${user?.website || "Non renseigné"}
Infos pro existantes : ${JSON.stringify(user?.proInfo || {})}

Génère UNIQUEMENT un JSON valide avec cette structure exacte (sans backticks, sans explication) :
{
  "jobTitle": "titre du poste principal",
  "summary": "résumé professionnel en 2-3 phrases",
  "skills": ["compétence1", "compétence2", "compétence3"],
  "experiences": [
    { "company": "nom entreprise", "role": "poste", "startDate": "Mois AAAA", "endDate": "Présent", "current": true, "description": "description courte" }
  ],
  "education": [
    { "school": "établissement", "degree": "diplôme", "year": "AAAA" }
  ],
  "languages": ["Français", "Anglais"],
  "certifications": []
}`;

      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model:      "claude-sonnet-4-6",
          max_tokens: 1000,
          messages:   [{ role: "user", content: prompt }],
        }),
      });
      const data = await resp.json();
      const raw  = data.content?.[0]?.text || "";
      const clean = raw.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setPreview(parsed);
    } catch (err) {
      showToast?.("Erreur lors de la génération IA", "error");
    } finally {
      setLoading(false);
    }
  };

  const saveGenerated = async () => {
    if (!preview) return;
    setSaving(true);
    try {
      const token = await getToken?.();
      if (!token) throw new Error("Session expirée");
      const { data } = await axios.patch(
        `${BASE_URL}/api/users/${user._id}/pro`,
        { accountType: "pro", ...preview },
        { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, timeout: 10000 }
      );
      if (data?.user) onUserUpdated?.(data.user);
      showToast?.("✅ Profil pro créé !", "success");
      onDone();
    } catch (err) {
      showToast?.(err?.response?.data?.message || "Erreur lors de la sauvegarde", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <button
        type="button"
        onClick={onBack}
        style={{ background: "none", border: "none", color: sub, cursor: "pointer", fontSize: 12, textAlign: "left", display: "flex", alignItems: "center", gap: 4, padding: 0, fontFamily: "inherit" }}
      >
        ← Retour
      </button>

      {!preview && !loading && (
        <div style={{ textAlign: "center", padding: "24px 0" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✨</div>
          <p style={{ fontSize: 14, fontWeight: 700, color: text, marginBottom: 6 }}>
            Génération IA depuis votre profil
          </p>
          <p style={{ fontSize: 12, color: sub, marginBottom: 20, lineHeight: 1.6 }}>
            L'IA va analyser ta bio, localisation et infos existantes pour créer un CV structuré.
          </p>
          <motion.button
            type="button"
            onClick={generate}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            style={{
              padding:      "12px 28px",
              borderRadius: 999,
              border:       "none",
              background:   "linear-gradient(135deg,#6366f1,#8b5cf6)",
              color:        "#fff",
              fontWeight:   800,
              fontSize:     14,
              cursor:       "pointer",
              boxShadow:    "0 6px 20px rgba(99,102,241,0.35)",
              fontFamily:   "inherit",
            }}
          >
            Générer mon CV
          </motion.button>
        </div>
      )}

      {loading && (
        <div style={{ textAlign: "center", padding: "32px 0" }}>
          <div style={{
            width: 44, height: 44,
            border: "3px solid rgba(99,102,241,0.2)",
            borderTopColor: "#6366f1",
            borderRadius: "50%",
            animation: "spin .8s linear infinite",
            margin: "0 auto 16px",
          }} />
          <p style={{ fontSize: 13, color: sub }}>Génération en cours…</p>
        </div>
      )}

      {preview && !loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ padding: "12px 14px", borderRadius: 12, background: card, border: `1px solid ${bdr}` }}>
            <p style={{ fontSize: 13, fontWeight: 800, color: "#6366f1", margin: "0 0 4px" }}>{preview.jobTitle}</p>
            <p style={{ fontSize: 12, color: sub, margin: 0, lineHeight: 1.5 }}>{preview.summary}</p>
          </div>

          {preview.skills?.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {preview.skills.map((s) => (
                <span key={s} style={{ padding: "4px 10px", borderRadius: 20, background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", color: "#6366f1", fontSize: 11, fontWeight: 600 }}>{s}</span>
              ))}
            </div>
          )}

          {preview.experiences?.[0] && (
            <div style={{ padding: "10px 14px", borderRadius: 12, background: card, border: `1px solid ${bdr}` }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: text, margin: "0 0 2px" }}>{preview.experiences[0].role}</p>
              <p style={{ fontSize: 11, color: "#6366f1", margin: "0 0 4px" }}>{preview.experiences[0].company}</p>
              <p style={{ fontSize: 11, color: sub, margin: 0 }}>{preview.experiences[0].description}</p>
            </div>
          )}

          <p style={{ fontSize: 11, color: sub, textAlign: "center" }}>
            {preview.experiences?.length} expérience(s) · {preview.education?.length} formation(s) générées
          </p>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => setPreview(null)}
              style={{ flex: 1, padding: "11px 0", borderRadius: 12, border: `1px solid ${bdr}`, background: "transparent", color: sub, fontWeight: 600, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}
            >
              Regénérer
            </button>
            <motion.button
              type="button"
              onClick={saveGenerated}
              disabled={saving}
              whileTap={{ scale: 0.97 }}
              style={{
                flex: 2, padding: "11px 0", borderRadius: 12, border: "none",
                background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
                color: "#fff", fontWeight: 800, fontSize: 12, cursor: "pointer",
                opacity: saving ? 0.7 : 1, fontFamily: "inherit",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}
            >
              {saving ? <><Spin size={14} /> Sauvegarde…</> : "Enregistrer ce CV"}
            </motion.button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CVForm — formulaire manuel section par section
// ─────────────────────────────────────────────────────────────────────────────
function CVForm({ user, showToast, onUserUpdated, onBack, onDone, isDarkMode }) {
  const { getToken } = useAuth();
  const pi = user?.proInfo || {};

  const [form, setForm]   = useState({
    jobTitle:        pi.jobTitle    || "",
    availableStatus: pi.availableStatus || "open",
    summary:         pi.summary    || "",
    skills:          pi.skills     || [],
    experiences:     pi.experiences?.length > 0 ? pi.experiences : [{ company: "", role: "", startDate: "", endDate: "", current: false, description: "" }],
    education:       pi.education?.length  > 0 ? pi.education  : [{ school: "", degree: "", year: "" }],
    languages:       pi.languages  || [],
    certifications:  pi.certifications || [],
  });
  const [saving,  setSaving]  = useState(false);
  const [skillIn, setSkillIn] = useState("");
  const [langIn,  setLangIn]  = useState("");

  const text = isDarkMode ? "#f8fafc" : "#0f172a";
  const sub  = isDarkMode ? "#6b7280" : "#9ca3af";
  const bdr  = isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)";
  const bgIn = isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)";

  const inputStyle = {
    width: "100%", padding: "10px 12px", borderRadius: 10,
    border: `1.5px solid ${bdr}`, background: bgIn,
    color: text, fontSize: 12, fontFamily: "inherit",
    outline: "none", boxSizing: "border-box",
  };

  const labelStyle = { fontSize: 10, fontWeight: 700, color: sub, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 5 };

  const setExp = (i, key, val) => setForm(prev => {
    const exps = [...prev.experiences];
    exps[i] = { ...exps[i], [key]: val };
    return { ...prev, experiences: exps };
  });

  const setEdu = (i, key, val) => setForm(prev => {
    const edu = [...prev.education];
    edu[i] = { ...edu[i], [key]: val };
    return { ...prev, education: edu };
  });

  const addTag = (field, val, setter) => {
    const v = val.trim();
    if (!v || form[field].includes(v)) return;
    setForm(prev => ({ ...prev, [field]: [...prev[field], v] }));
    setter("");
  };

  const removeTag = (field, val) => setForm(prev => ({ ...prev, [field]: prev[field].filter(x => x !== val) }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = await getToken?.();
      if (!token) throw new Error("Session expirée");
      const { data } = await axios.patch(
        `${BASE_URL}/api/users/${user._id}/pro`,
        { accountType: "pro", ...form },
        { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, timeout: 10000 }
      );
      if (data?.user) onUserUpdated?.(data.user);
      showToast?.("✅ Profil pro enregistré !", "success");
      onDone();
    } catch (err) {
      showToast?.(err?.response?.data?.message || "Erreur", "error");
    } finally {
      setSaving(false);
    }
  };

  const Section = ({ title }) => (
    <p style={{ fontSize: 11, fontWeight: 800, color: "#6366f1", textTransform: "uppercase", letterSpacing: "0.08em", margin: "16px 0 10px", borderBottom: "1px solid rgba(99,102,241,0.2)", paddingBottom: 6 }}>
      {title}
    </p>
  );

  const TagInput = ({ field, value, setValue, placeholder }) => (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <input
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTag(field, value, setValue); } }}
          placeholder={placeholder}
          style={{ ...inputStyle, flex: 1 }}
        />
        <button type="button" onClick={() => addTag(field, value, setValue)}
          style={{ padding: "0 12px", borderRadius: 10, border: "none", background: "rgba(99,102,241,0.15)", color: "#6366f1", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
          +
        </button>
      </div>
      {form[field].length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {form[field].map(t => (
            <span key={t} style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 20, background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", color: "#6366f1", fontSize: 11, fontWeight: 600 }}>
              {t}
              <button type="button" onClick={() => removeTag(field, t)} style={{ background: "none", border: "none", color: "#6366f1", cursor: "pointer", padding: 0, fontSize: 14, lineHeight: 1, opacity: 0.7 }}>×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <button type="button" onClick={onBack}
        style={{ background: "none", border: "none", color: sub, cursor: "pointer", fontSize: 12, textAlign: "left", display: "flex", alignItems: "center", gap: 4, padding: 0, fontFamily: "inherit" }}>
        ← Retour
      </button>

      {/* Titre + dispo */}
      <Section title="Identité professionnelle" />
      <div>
        <label style={labelStyle}>Titre de poste *</label>
        <input value={form.jobTitle} onChange={e => setForm(p => ({ ...p, jobTitle: e.target.value }))} placeholder="Ex : Chef de projet BTP" style={inputStyle} />
      </div>
      <div>
        <label style={labelStyle}>Statut de disponibilité</label>
        <select value={form.availableStatus} onChange={e => setForm(p => ({ ...p, availableStatus: e.target.value }))} style={{ ...inputStyle, cursor: "pointer" }}>
          <option value="open">Disponible</option>
          <option value="freelance">Freelance</option>
          <option value="closed">Non disponible</option>
        </select>
      </div>
      <div>
        <label style={labelStyle}>Résumé professionnel</label>
        <textarea value={form.summary} onChange={e => setForm(p => ({ ...p, summary: e.target.value }))} rows={3} maxLength={600} placeholder="Présentation courte de votre parcours…" style={{ ...inputStyle, resize: "vertical" }} />
      </div>

      {/* Compétences */}
      <Section title="Compétences" />
      <TagInput field="skills" value={skillIn} setValue={setSkillIn} placeholder="Ex : AutoCAD, Gestion chantier…" />

      {/* Expériences */}
      <Section title="Expériences" />
      {form.experiences.map((exp, i) => (
        <div key={i} style={{ padding: "12px 14px", borderRadius: 12, border: `1px solid ${bdr}`, background: bgIn, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <label style={labelStyle}>Entreprise</label>
              <input value={exp.company} onChange={e => setExp(i,"company",e.target.value)} placeholder="JD BAT" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Poste</label>
              <input value={exp.role} onChange={e => setExp(i,"role",e.target.value)} placeholder="Chef de projet" style={inputStyle} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <label style={labelStyle}>Début</label>
              <input value={exp.startDate} onChange={e => setExp(i,"startDate",e.target.value)} placeholder="Jan 2022" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Fin</label>
              <input value={exp.endDate} onChange={e => setExp(i,"endDate",e.target.value)} placeholder="Présent" disabled={exp.current} style={{ ...inputStyle, opacity: exp.current ? 0.5 : 1 }} />
            </div>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 11, color: sub }}>
            <input type="checkbox" checked={exp.current} onChange={e => setExp(i,"current",e.target.checked)} />
            Poste actuel
          </label>
          <div>
            <label style={labelStyle}>Description</label>
            <textarea value={exp.description} onChange={e => setExp(i,"description",e.target.value)} rows={2} placeholder="Missions et réalisations…" style={{ ...inputStyle, resize: "vertical" }} />
          </div>
          {form.experiences.length > 1 && (
            <button type="button" onClick={() => setForm(p => ({ ...p, experiences: p.experiences.filter((_,j) => j !== i) }))}
              style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 11, textAlign: "left", padding: 0, fontFamily: "inherit" }}>
              Supprimer
            </button>
          )}
        </div>
      ))}
      <button type="button" onClick={() => setForm(p => ({ ...p, experiences: [...p.experiences, { company:"",role:"",startDate:"",endDate:"",current:false,description:"" }] }))}
        style={{ padding: "9px 0", borderRadius: 10, border: `1px dashed ${bdr}`, background: "transparent", color: sub, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
        + Ajouter une expérience
      </button>

      {/* Formation */}
      <Section title="Formation" />
      {form.education.map((edu, i) => (
        <div key={i} style={{ padding: "12px 14px", borderRadius: 12, border: `1px solid ${bdr}`, background: bgIn, display: "flex", flexDirection: "column", gap: 8 }}>
          <div>
            <label style={labelStyle}>Établissement</label>
            <input value={edu.school} onChange={e => setEdu(i,"school",e.target.value)} placeholder="INPHB Yamoussoukro" style={inputStyle} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <label style={labelStyle}>Diplôme</label>
              <input value={edu.degree} onChange={e => setEdu(i,"degree",e.target.value)} placeholder="Génie Civil" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Année</label>
              <input value={edu.year} onChange={e => setEdu(i,"year",e.target.value)} placeholder="2021" style={inputStyle} />
            </div>
          </div>
          {form.education.length > 1 && (
            <button type="button" onClick={() => setForm(p => ({ ...p, education: p.education.filter((_,j) => j !== i) }))}
              style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 11, textAlign: "left", padding: 0, fontFamily: "inherit" }}>
              Supprimer
            </button>
          )}
        </div>
      ))}
      <button type="button" onClick={() => setForm(p => ({ ...p, education: [...p.education, { school:"",degree:"",year:"" }] }))}
        style={{ padding: "9px 0", borderRadius: 10, border: `1px dashed ${bdr}`, background: "transparent", color: sub, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
        + Ajouter une formation
      </button>

      {/* Langues */}
      <Section title="Langues" />
      <TagInput field="languages" value={langIn} setValue={setLangIn} placeholder="Français, Anglais…" />

      {/* Sauvegarder */}
      <motion.button
        type="button"
        onClick={handleSave}
        disabled={saving || !form.jobTitle.trim()}
        whileTap={{ scale: 0.97 }}
        style={{
          marginTop:    8,
          padding:      "14px 0",
          borderRadius: 14,
          border:       "none",
          background:   saving || !form.jobTitle.trim()
            ? (isDarkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)")
            : "linear-gradient(135deg,#6366f1,#8b5cf6)",
          color:        saving || !form.jobTitle.trim() ? sub : "#fff",
          fontWeight:   800,
          fontSize:     14,
          cursor:       saving || !form.jobTitle.trim() ? "not-allowed" : "pointer",
          fontFamily:   "inherit",
          display:      "flex",
          alignItems:   "center",
          justifyContent: "center",
          gap:          8,
          boxShadow:    saving ? "none" : "0 6px 20px rgba(99,102,241,0.3)",
        }}
      >
        {saving ? <><Spin size={16} color="#6366f1" /> Enregistrement…</> : "Enregistrer le profil pro"}
      </motion.button>
    </div>
  );
}

// Import axios manquant dans le scope du module — à ajouter en haut du vrai fichier
// import axios from "axios";
// import { PROFILE_BACKEND_BASE } from "../profileApi";