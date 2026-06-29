// src/pages/profile/Pro/CVModal.jsx
// ✅ FIX — suppression de l'option "ai" + keys uniques dans AnimatePresence

import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { useDarkMode } from "../../../context/DarkModeContext";
import { useAuth }      from "../../../context/AuthContext";
import { PROFILE_BACKEND_BASE } from "../profileApi";
import axios from "axios";

const BASE_URL = PROFILE_BACKEND_BASE;

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

const CHOICES = [
  {
    id:    "manual",
    icon:  "✏️",
    label: "Remplir manuellement",
    desc:  "Formulaire section par section",
    color: "#22c55e",
  },
];

export default function CVModal({ isOpen, onClose, user, showToast, onUserUpdated }) {
  const { isDarkMode } = useDarkMode();
  const { getToken }   = useAuth();
  // ✅ FIX : seulement "choice" | "manual" (plus de "ai")
  const [step,      setStep]      = useState("choice");
  const [uploading, setUploading] = useState(false);
  const fileInputRef              = useRef(null);

  const bg   = isDarkMode ? "#111"    : "#fff";
  const bdr  = isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)";
  const text = isDarkMode ? "#f8fafc" : "#0f172a";
  const sub  = isDarkMode ? "#6b7280" : "#9ca3af";

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
    if (id === "manual") { setStep("manual"); return; }
  };

  const handleClose = () => { setStep("choice"); onClose(); };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="cv-modal-backdrop"
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
          {/* Header */}
          <div style={{
            display:        "flex",
            alignItems:     "center",
            justifyContent: "space-between",
            padding:        "20px 20px 16px",
            borderBottom:   `1px solid ${bdr}`,
          }}>
            <div>
              <p style={{ fontSize: 16, fontWeight: 800, color: text, margin: 0 }}>
                {step === "choice" ? "Votre CV" : "Remplir manuellement"}
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

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx"
            onChange={handleFileImport}
            style={{ display: "none" }}
          />

          {/* ✅ FIX : keys explicites non-vides sur chaque branche AnimatePresence */}
          <AnimatePresence mode="wait">
            {step === "choice" && (
              <motion.div
                key="cv-step-choice"
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
                      border:       `1px solid ${bdr}`,
                      background:   isDarkMode ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
                      cursor:       "pointer",
                      textAlign:    "left",
                      fontFamily:   "inherit",
                    }}
                  >
                    <span style={{
                      width:        40,
                      height:       40,
                      borderRadius: 12,
                      background:   `${c.color}15`,
                      display:      "flex",
                      alignItems:   "center",
                      justifyContent: "center",
                      fontSize:     20,
                      flexShrink:   0,
                    }}>
                      {c.id === "import" && uploading ? <Spin color={c.color} /> : c.icon}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: text }}>
                        {c.label}
                      </div>
                      <div style={{ fontSize: 11, color: sub, marginTop: 2 }}>
                        {c.desc}
                      </div>
                    </div>
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none"
                      stroke={sub} strokeWidth={2} strokeLinecap="round">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </motion.button>
                ))}
              </motion.div>
            )}

            {step === "manual" && (
              <motion.div
                key="cv-step-manual"
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

      <Section title="Compétences" />
      <TagInput field="skills" value={skillIn} setValue={setSkillIn} placeholder="Ex : AutoCAD, Gestion chantier…" />

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

      <Section title="Langues" />
      <TagInput field="languages" value={langIn} setValue={setLangIn} placeholder="Français, Anglais…" />

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