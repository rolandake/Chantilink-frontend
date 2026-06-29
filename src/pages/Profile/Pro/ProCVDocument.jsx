// src/pages/profile/Pro/ProCVDocument.jsx
// ✅ Rendu visuel du CV professionnel — style document papier deux colonnes
// Sidebar sombre (initiales, contact, compétences, langues, certifs)
// Corps blanc (résumé, expériences, formation)
// Utilisé dans ProCVView à la place du rendu carte après sauvegarde

import React, { useRef } from "react";
import { motion } from "framer-motion";
import { PencilIcon } from "@heroicons/react/24/outline";

// ── Statut disponibilité ──────────────────────────────────────────────────────
const STATUS_MAP = {
  open:      { label: "Disponible",     color: "#16a34a", bg: "#dcfce7", dot: "#22c55e" },
  freelance: { label: "Freelance",      color: "#c2410c", bg: "#ffedd5", dot: "#f97316" },
  closed:    { label: "Non disponible", color: "#b91c1c", bg: "#fee2e2", dot: "#ef4444" },
};

// ── Initiales depuis fullName ─────────────────────────────────────────────────
const getInitials = (name = "") => {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (name.slice(0, 2)).toUpperCase();
};

// ── Séparateur de section (sidebar) ──────────────────────────────────────────
const SideSection = ({ title, children }) => (
  <div style={{ marginBottom: 22 }}>
    <p style={{
      fontSize: 9,
      fontWeight: 800,
      letterSpacing: "0.14em",
      textTransform: "uppercase",
      color: "rgba(255,255,255,0.45)",
      margin: "0 0 10px",
      paddingBottom: 5,
      borderBottom: "1px solid rgba(255,255,255,0.12)",
    }}>{title}</p>
    {children}
  </div>
);

// ── Séparateur de section (corps) ─────────────────────────────────────────────
const BodySection = ({ title, accent = "#1e3a5f", children }) => (
  <div style={{ marginBottom: 20 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
      <span style={{
        display: "inline-block",
        width: 4,
        height: 18,
        borderRadius: 2,
        background: accent,
        flexShrink: 0,
      }} />
      <p style={{
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: accent,
        margin: 0,
      }}>{title}</p>
    </div>
    {children}
  </div>
);

// ── Expérience card ───────────────────────────────────────────────────────────
const ExpCard = ({ exp, accent }) => (
  <div style={{ marginBottom: 14, paddingLeft: 12, borderLeft: `2px solid ${accent}25` }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 4 }}>
      <div>
        <p style={{ fontSize: 12, fontWeight: 800, color: "#111827", margin: "0 0 1px" }}>
          {exp.role || "—"}
        </p>
        <p style={{ fontSize: 11, fontWeight: 700, color: accent, margin: "0 0 5px" }}>
          {exp.company || "—"}
        </p>
      </div>
      <span style={{
        fontSize: 9,
        fontWeight: 700,
        color: "#6b7280",
        background: "#f3f4f6",
        padding: "3px 8px",
        borderRadius: 4,
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}>
        {exp.startDate || ""}
        {exp.current ? " – Présent" : exp.endDate ? ` – ${exp.endDate}` : ""}
      </span>
    </div>
    {exp.description && (
      <p style={{ fontSize: 10.5, color: "#4b5563", margin: 0, lineHeight: 1.65 }}>
        {exp.description}
      </p>
    )}
  </div>
);

// ── Formation card ────────────────────────────────────────────────────────────
const EduCard = ({ edu }) => (
  <div style={{ marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 4 }}>
    <div>
      <p style={{ fontSize: 12, fontWeight: 700, color: "#111827", margin: "0 0 1px" }}>
        {edu.degree || "—"}
      </p>
      <p style={{ fontSize: 10.5, color: "#6b7280", margin: 0 }}>
        {edu.school || ""}
      </p>
    </div>
    {edu.year && (
      <span style={{
        fontSize: 9,
        fontWeight: 700,
        color: "#6b7280",
        background: "#f3f4f6",
        padding: "3px 8px",
        borderRadius: 4,
        flexShrink: 0,
      }}>
        {edu.year}
      </span>
    )}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSANT PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export default function ProCVDocument({ user, isOwner, onEdit, isDarkMode }) {
  const pi   = user?.proInfo || {};
  const name = user?.fullName || pi.jobTitle || "Professionnel";
  const init = getInitials(name);

  // Accent bleu marine : signature du CV BTP Chantilink
  const ACCENT   = "#1e3a5f";
  const ACCENT2  = "#2d5a8e";
  const SIDEBAR  = "#1a2e4a";
  const SIDEBAR2 = "#152540";

  const statusInfo = STATUS_MAP[pi.availableStatus || "closed"];
  const hasExp     = pi.experiences?.length > 0;
  const hasEdu     = pi.education?.length > 0;
  const hasSkills  = pi.skills?.length > 0;
  const hasLangs   = pi.languages?.length > 0;
  const hasCerts   = pi.certifications?.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      style={{ fontFamily: "'Sora','DM Sans',Arial,sans-serif" }}
    >
      {/* ── Bouton modifier (owner) ── */}
      {isOwner && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
          <motion.button
            type="button"
            onClick={onEdit}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            style={{
              display:      "flex",
              alignItems:   "center",
              gap:          6,
              padding:      "7px 16px",
              borderRadius: 999,
              border:       "1px solid rgba(30,58,95,0.25)",
              background:   isDarkMode ? "rgba(30,58,95,0.18)" : "rgba(30,58,95,0.07)",
              color:        ACCENT,
              fontWeight:   700,
              fontSize:     12,
              cursor:       "pointer",
              fontFamily:   "inherit",
            }}
          >
            <PencilIcon style={{ width: 13, height: 13 }} />
            Modifier le CV
          </motion.button>
        </div>
      )}

      {/* ── Badge statut ── */}
      <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{
          display:    "inline-flex",
          alignItems: "center",
          gap:        6,
          padding:    "4px 12px",
          borderRadius: 999,
          fontSize:   11,
          fontWeight: 700,
          color:      statusInfo.color,
          background: statusInfo.bg,
        }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: statusInfo.dot, display: "inline-block" }} />
          {statusInfo.label}
        </span>
      </div>

      {/* ══ Document CV ══ */}
      <div style={{
        borderRadius:  16,
        overflow:      "hidden",
        boxShadow:     isDarkMode
          ? "0 20px 60px rgba(0,0,0,0.55)"
          : "0 10px 48px rgba(30,58,95,0.18)",
        border:        `1px solid ${isDarkMode ? "rgba(255,255,255,0.06)" : "rgba(30,58,95,0.12)"}`,
        display:       "flex",
        minHeight:     520,
      }}>

        {/* ── SIDEBAR gauche ── */}
        <div style={{
          width:      "38%",
          minWidth:   120,
          background: `linear-gradient(180deg, ${SIDEBAR} 0%, ${SIDEBAR2} 100%)`,
          padding:    "28px 18px 28px",
          display:    "flex",
          flexDirection: "column",
          flexShrink: 0,
        }}>
          {/* Initiales avatar */}
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <div style={{
              width:        72,
              height:       72,
              borderRadius: "50%",
              background:   `linear-gradient(135deg, ${ACCENT2}, #4a90d9)`,
              border:       "3px solid rgba(255,255,255,0.18)",
              display:      "flex",
              alignItems:   "center",
              justifyContent: "center",
              margin:       "0 auto 10px",
              fontSize:     26,
              fontWeight:   900,
              color:        "#fff",
              letterSpacing: -1,
              boxShadow:    "0 4px 16px rgba(0,0,0,0.35)",
            }}>
              {user?.profilePhoto ? (
                <img
                  src={user.profilePhoto}
                  alt={name}
                  style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }}
                />
              ) : init}
            </div>
            <p style={{ fontSize: 15, fontWeight: 900, color: "#fff", margin: "0 0 3px", lineHeight: 1.2 }}>
              {name}
            </p>
            {pi.jobTitle && name !== pi.jobTitle && (
              <p style={{ fontSize: 9.5, color: "rgba(255,255,255,0.55)", margin: 0, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {pi.jobTitle}
              </p>
            )}
          </div>

          {/* Contact */}
          {(user?.location || user?.website || user?.email) && (
            <SideSection title="Contact">
              {user?.email && (
                <p style={{ fontSize: 10, color: "rgba(255,255,255,0.75)", margin: "0 0 5px", wordBreak: "break-all" }}>
                  📧 {user.email}
                </p>
              )}
              {user?.location && (
                <p style={{ fontSize: 10, color: "rgba(255,255,255,0.75)", margin: "0 0 5px" }}>
                  📍 {user.location}
                </p>
              )}
              {user?.website && (
                <p style={{ fontSize: 10, color: "rgba(255,255,255,0.75)", margin: 0, wordBreak: "break-all" }}>
                  🌐 {user.website}
                </p>
              )}
            </SideSection>
          )}

          {/* Compétences */}
          {hasSkills && (
            <SideSection title="Compétences">
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {pi.skills.map((s, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <span style={{
                      width: 6, height: 6, borderRadius: "50%",
                      background: "#4a90d9", flexShrink: 0,
                    }} />
                    <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.85)", fontWeight: 600 }}>
                      {s}
                    </span>
                  </div>
                ))}
              </div>
            </SideSection>
          )}

          {/* Langues */}
          {hasLangs && (
            <SideSection title="Langues">
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {pi.languages.map((l, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                    <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.85)", fontWeight: 600 }}>{l}</span>
                    <div style={{ display: "flex", gap: 2 }}>
                      {[1,2,3,4,5].map(d => (
                        <span key={d} style={{
                          width: 6, height: 6, borderRadius: "50%",
                          background: d <= 4 ? "#4a90d9" : "rgba(255,255,255,0.18)",
                        }} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </SideSection>
          )}

          {/* Certifications */}
          {hasCerts && (
            <SideSection title="Certifications">
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {pi.certifications.map((c, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                    <span style={{ color: "#f97316", flexShrink: 0, fontSize: 10, marginTop: 1 }}>✦</span>
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.8)", lineHeight: 1.5 }}>{c}</span>
                  </div>
                ))}
              </div>
            </SideSection>
          )}
        </div>

        {/* ── CORPS droit ── */}
        <div style={{
          flex:       1,
          background: isDarkMode ? "#1a1a2e" : "#fff",
          padding:    "28px 22px 28px",
          minWidth:   0,
          overflowY:  "auto",
        }}>
          {/* En-tête nom / titre */}
          <div style={{
            marginBottom:  22,
            paddingBottom: 16,
            borderBottom:  `2px solid ${ACCENT}`,
          }}>
            <h1 style={{
              fontSize:    22,
              fontWeight:  900,
              color:       isDarkMode ? "#f8fafc" : "#111827",
              margin:      "0 0 3px",
              letterSpacing: -0.5,
              lineHeight:  1.1,
            }}>
              {name}
            </h1>
            {pi.jobTitle && name !== pi.jobTitle && (
              <p style={{
                fontSize:   13,
                fontWeight: 600,
                color:      ACCENT2,
                margin:     0,
                letterSpacing: "0.01em",
              }}>
                {pi.jobTitle}
              </p>
            )}
          </div>

          {/* Résumé */}
          {pi.summary && (
            <BodySection title="Résumé" accent={ACCENT}>
              <p style={{
                fontSize:   11,
                color:      isDarkMode ? "#cbd5e1" : "#374151",
                lineHeight: 1.75,
                margin:     0,
              }}>
                {pi.summary}
              </p>
            </BodySection>
          )}

          {/* Expériences */}
          {hasExp && (
            <BodySection title="Expérience" accent={ACCENT}>
              {pi.experiences.map((exp, i) => (
                <ExpCard key={i} exp={exp} accent={ACCENT2} />
              ))}
            </BodySection>
          )}

          {/* Formation */}
          {hasEdu && (
            <BodySection title="Formation" accent={ACCENT}>
              {pi.education.map((edu, i) => (
                <EduCard key={i} edu={edu} />
              ))}
            </BodySection>
          )}

          {/* Pied de page */}
          <div style={{
            marginTop:  24,
            paddingTop: 14,
            borderTop:  `1px solid ${isDarkMode ? "rgba(255,255,255,0.06)" : "rgba(30,58,95,0.1)"}`,
            display:    "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}>
            <span style={{
              fontSize:   8.5,
              color:      isDarkMode ? "rgba(255,255,255,0.2)" : "rgba(30,58,95,0.25)",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}>
              Profil Chantilink · BTP Côte d'Ivoire
            </span>
          </div>
        </div>

      </div>
    </motion.div>
  );
}