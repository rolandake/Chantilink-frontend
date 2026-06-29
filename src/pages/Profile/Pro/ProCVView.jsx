// src/pages/profile/Pro/ProCVView.jsx
// Affichage lecture du CV professionnel dans l'onglet "CV" du profil pro
// Si owner → bouton "Modifier le CV" qui rouvre CVModal
// Si visiteur → vue lecture seule

import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  BriefcaseIcon,
  AcademicCapIcon,
  WrenchScrewdriverIcon,
  LanguageIcon,
  DocumentTextIcon,
  PencilIcon,
} from "@heroicons/react/24/outline";
import { useDarkMode } from "../../../context/DarkModeContext";
import CVModal from "./CVModal";

// ── badge statut ──────────────────────────────────────────────────────────────
const STATUS_MAP = {
  open:      { label: "Disponible",     color: "#22c55e", bg: "rgba(34,197,94,0.12)",  border: "rgba(34,197,94,0.3)"  },
  freelance: { label: "Freelance",      color: "#f97316", bg: "rgba(249,115,22,0.12)", border: "rgba(249,115,22,0.3)" },
  closed:    { label: "Non disponible", color: "#ef4444", bg: "rgba(239,68,68,0.12)",  border: "rgba(239,68,68,0.3)"  },
};

// ── section header ─────────────────────────────────────────────────────────────
const SectionTitle = ({ icon: Icon, title, isDarkMode }) => (
  <div style={{
    display:      "flex",
    alignItems:   "center",
    gap:          8,
    marginBottom: 12,
    paddingBottom: 8,
    borderBottom: `1px solid ${isDarkMode ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)"}`,
  }}>
    <span style={{
      width:        30,
      height:       30,
      borderRadius: 9,
      background:   "rgba(99,102,241,0.12)",
      display:      "flex",
      alignItems:   "center",
      justifyContent: "center",
      flexShrink:   0,
    }}>
      <Icon style={{ width: 15, height: 15, color: "#6366f1" }} />
    </span>
    <p style={{
      fontSize:  11,
      fontWeight: 800,
      color:     "#6366f1",
      textTransform: "uppercase",
      letterSpacing: "0.08em",
      margin:    0,
    }}>{title}</p>
  </div>
);

// ── card wrapper ───────────────────────────────────────────────────────────────
const Card = ({ children, isDarkMode }) => (
  <div style={{
    padding:      "14px 16px",
    borderRadius: 14,
    border:       `1px solid ${isDarkMode ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)"}`,
    background:   isDarkMode ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
    marginBottom: 10,
  }}>
    {children}
  </div>
);

// ── état vide ──────────────────────────────────────────────────────────────────
const EmptyCV = ({ isOwner, onEdit, isDarkMode }) => {
  const sub = isDarkMode ? "#6b7280" : "#9ca3af";
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ textAlign: "center", padding: "48px 24px", fontFamily: "'Sora','DM Sans',sans-serif" }}
    >
      <div style={{ fontSize: 52, marginBottom: 16 }}>📋</div>
      <p style={{ fontSize: 16, fontWeight: 700, color: isDarkMode ? "#d1d5db" : "#374151", marginBottom: 8 }}>
        {isOwner ? "Ton CV n'est pas encore créé" : "CV non disponible"}
      </p>
      <p style={{ fontSize: 13, color: sub, marginBottom: 24, lineHeight: 1.6, maxWidth: 260, margin: "0 auto 24px" }}>
        {isOwner
          ? "Crée ton CV professionnel en quelques clics — avec l'IA ou manuellement."
          : "Ce professionnel n'a pas encore renseigné son CV."}
      </p>
      {isOwner && (
        <motion.button
          onClick={onEdit}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          style={{
            padding:      "11px 28px",
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
          ✨ Créer mon CV
        </motion.button>
      )}
    </motion.div>
  );
};

// ── composant principal ────────────────────────────────────────────────────────
export default function ProCVView({ user, isOwner, showToast, onUserUpdated }) {
  const { isDarkMode } = useDarkMode();
  const [cvModalOpen, setCvModalOpen] = useState(false);

  const pi  = user?.proInfo || {};
  const sub = isDarkMode ? "#6b7280" : "#9ca3af";
  const text = isDarkMode ? "#f8fafc" : "#0f172a";
  const bdr  = isDarkMode ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)";

  const hasCV = !!(pi.jobTitle || (pi.experiences?.length > 0) || (pi.skills?.length > 0));
  const statusInfo = STATUS_MAP[pi.availableStatus || "closed"];

  if (!hasCV) {
    return (
      <>
        <EmptyCV isOwner={isOwner} onEdit={() => setCvModalOpen(true)} isDarkMode={isDarkMode} />
        {isOwner && (
          <CVModal
            isOpen={cvModalOpen}
            onClose={() => setCvModalOpen(false)}
            user={user}
            showToast={showToast}
            onUserUpdated={onUserUpdated}
          />
        )}
      </>
    );
  }

  return (
    <div style={{ fontFamily: "'Sora','DM Sans',sans-serif", display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ── En-tête identité pro ── */}
      <div style={{
        padding:      "16px",
        borderRadius: 16,
        background:   isDarkMode
          ? "linear-gradient(135deg, rgba(99,102,241,0.12), rgba(139,92,246,0.08))"
          : "linear-gradient(135deg, rgba(99,102,241,0.06), rgba(139,92,246,0.04))",
        border:       "1px solid rgba(99,102,241,0.2)",
        display:      "flex",
        alignItems:   "center",
        justifyContent: "space-between",
        gap:          12,
        flexWrap:     "wrap",
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 18, fontWeight: 800, color: text, margin: "0 0 4px", letterSpacing: -0.3 }}>
            {pi.jobTitle || user?.fullName}
          </p>
          {pi.summary && (
            <p style={{ fontSize: 12, color: sub, margin: 0, lineHeight: 1.6, maxWidth: 420 }}>
              {pi.summary}
            </p>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <span style={{
            padding:    "5px 14px",
            borderRadius: 999,
            fontSize:   12,
            fontWeight: 700,
            color:      statusInfo.color,
            background: statusInfo.bg,
            border:     `1px solid ${statusInfo.border}`,
            whiteSpace: "nowrap",
          }}>
            {statusInfo.label}
          </span>

          {isOwner && (
            <motion.button
              onClick={() => setCvModalOpen(true)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              style={{
                display:      "flex",
                alignItems:   "center",
                gap:          5,
                padding:      "7px 14px",
                borderRadius: 999,
                border:       "1px solid rgba(99,102,241,0.3)",
                background:   isDarkMode ? "rgba(99,102,241,0.12)" : "rgba(99,102,241,0.06)",
                color:        "#6366f1",
                fontWeight:   700,
                fontSize:     12,
                cursor:       "pointer",
                fontFamily:   "inherit",
                whiteSpace:   "nowrap",
              }}
            >
              <PencilIcon style={{ width: 13, height: 13 }} />
              Modifier
            </motion.button>
          )}
        </div>
      </div>

      {/* ── Compétences ── */}
      {pi.skills?.length > 0 && (
        <div>
          <SectionTitle icon={WrenchScrewdriverIcon} title="Compétences" isDarkMode={isDarkMode} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {pi.skills.map((s) => (
              <span
                key={s}
                style={{
                  padding:    "5px 12px",
                  borderRadius: 20,
                  background: "rgba(99,102,241,0.1)",
                  border:     "1px solid rgba(99,102,241,0.2)",
                  color:      "#6366f1",
                  fontSize:   12,
                  fontWeight: 600,
                }}
              >{s}</span>
            ))}
          </div>
        </div>
      )}

      {/* ── Expériences ── */}
      {pi.experiences?.length > 0 && (
        <div>
          <SectionTitle icon={BriefcaseIcon} title="Expériences" isDarkMode={isDarkMode} />
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {pi.experiences.map((exp, i) => (
              <Card key={i} isDarkMode={isDarkMode}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: text, margin: "0 0 2px" }}>
                      {exp.role}
                    </p>
                    <p style={{ fontSize: 12, color: "#6366f1", margin: "0 0 6px", fontWeight: 600 }}>
                      {exp.company}
                    </p>
                    {exp.description && (
                      <p style={{ fontSize: 12, color: sub, margin: 0, lineHeight: 1.6 }}>
                        {exp.description}
                      </p>
                    )}
                  </div>
                  <div style={{ flexShrink: 0, textAlign: "right" }}>
                    <span style={{
                      fontSize:   11,
                      color:      sub,
                      background: isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
                      padding:    "3px 8px",
                      borderRadius: 6,
                      whiteSpace: "nowrap",
                    }}>
                      {exp.startDate}{exp.current ? " · Présent" : exp.endDate ? ` · ${exp.endDate}` : ""}
                    </span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ── Formation ── */}
      {pi.education?.length > 0 && (
        <div>
          <SectionTitle icon={AcademicCapIcon} title="Formation" isDarkMode={isDarkMode} />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {pi.education.map((edu, i) => (
              <Card key={i} isDarkMode={isDarkMode}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: text, margin: "0 0 2px" }}>
                      {edu.degree}
                    </p>
                    <p style={{ fontSize: 12, color: sub, margin: 0 }}>
                      {edu.school}
                    </p>
                  </div>
                  {edu.year && (
                    <span style={{
                      fontSize:   11,
                      color:      sub,
                      background: isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
                      padding:    "3px 8px",
                      borderRadius: 6,
                    }}>
                      {edu.year}
                    </span>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ── Langues ── */}
      {pi.languages?.length > 0 && (
        <div>
          <SectionTitle icon={LanguageIcon} title="Langues" isDarkMode={isDarkMode} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {pi.languages.map((l) => (
              <span
                key={l}
                style={{
                  padding:    "5px 12px",
                  borderRadius: 20,
                  background: isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
                  border:     `1px solid ${bdr}`,
                  color:      isDarkMode ? "#d1d5db" : "#374151",
                  fontSize:   12,
                  fontWeight: 600,
                }}
              >{l}</span>
            ))}
          </div>
        </div>
      )}

      {/* ── Certifications ── */}
      {pi.certifications?.length > 0 && (
        <div>
          <SectionTitle icon={DocumentTextIcon} title="Certifications" isDarkMode={isDarkMode} />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {pi.certifications.map((c, i) => (
              <Card key={i} isDarkMode={isDarkMode}>
                <p style={{ fontSize: 13, fontWeight: 600, color: text, margin: 0 }}>{c}</p>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* CVModal — owner seulement */}
      {isOwner && (
        <CVModal
          isOpen={cvModalOpen}
          onClose={() => setCvModalOpen(false)}
          user={user}
          showToast={showToast}
          onUserUpdated={onUserUpdated}
        />
      )}
    </div>
  );
}