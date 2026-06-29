/**
 * OppDetailModal.jsx
 * Modal de lecture d'offre — Chantilink
 * v2 — badge "Chantilink" + logo entreprise + CTA "Postuler" pour les offres internes
 */

import React, { useEffect, useCallback, memo } from "react";
import ReactDOM from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, MapPin, Building2, Clock, CalendarClock,
  ArrowUpRight, ExternalLink, Sparkles, Tag,
} from "lucide-react";
import {
  Briefcase, GraduationCap, FileText,
} from "lucide-react";

const TYPE_CONFIG = {
  emploi: {
    label:   "Emploi",
    color:   "#3b82f6",
    colorDk: "#60a5fa",
    grad:    "linear-gradient(135deg, #1d4ed8, #3b82f6)",
    bg:      "rgba(59,130,246,0.12)",
    bgDk:    "rgba(59,130,246,0.20)",
    Icon:    Briefcase,
  },
  stage: {
    label:   "Stage",
    color:   "#22c55e",
    colorDk: "#4ade80",
    grad:    "linear-gradient(135deg, #15803d, #22c55e)",
    bg:      "rgba(34,197,94,0.12)",
    bgDk:    "rgba(34,197,94,0.20)",
    Icon:    GraduationCap,
  },
  appel_offre: {
    label:   "Appel d'offres",
    color:   "#f59e0b",
    colorDk: "#fbbf24",
    grad:    "linear-gradient(135deg, #b45309, #f59e0b)",
    bg:      "rgba(245,158,11,0.12)",
    bgDk:    "rgba(245,158,11,0.20)",
    Icon:    FileText,
  },
};

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1)  return "À l'instant";
  if (h < 24) return `il y a ${h}h`;
  const d = Math.floor(h / 24);
  if (d === 1) return "Hier";
  if (d < 7)  return `il y a ${d}j`;
  return `il y a ${Math.floor(d / 7)} sem.`;
}

function isNew(dateStr) {
  return dateStr && Date.now() - new Date(dateStr).getTime() < 48 * 3_600_000;
}

function formatExpiryFull(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (d < new Date()) return { label: "Clôturé", closed: true };
  return {
    label: d.toLocaleDateString("fr-CI", { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
    closed: false,
  };
}

const TypeIcon = memo(({ type, size = 48 }) => {
  const cfg  = TYPE_CONFIG[type] || TYPE_CONFIG.emploi;
  const Icon = cfg.Icon;
  return (
    <div style={{
      width: size, height: size,
      borderRadius: size * 0.30,
      background: cfg.grad,
      display: "flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0,
      boxShadow: `0 6px 20px ${cfg.color}45`,
    }}>
      <Icon size={size * 0.48} color="#fff" strokeWidth={2} />
    </div>
  );
});
TypeIcon.displayName = "TypeIcon";

const OppDetailModal = memo(({ opp, isDarkMode, onClose }) => {
  const cfg     = TYPE_CONFIG[opp?.type] || TYPE_CONFIG.emploi;
  const fresh   = isNew(opp?.postedAt);
  const expiry  = formatExpiryFull(opp?.expiresAt);

  const handleKey = useCallback((e) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener("keydown", handleKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = prev;
    };
  }, [handleKey]);

  if (!opp) return null;

  const bg        = isDarkMode ? "#0d0f12" : "#f6f7f9";
  const surface   = isDarkMode ? "rgba(255,255,255,0.05)" : "#ffffff";
  const border    = isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
  const txt       = isDarkMode ? "#f1f5f9" : "#0f172a";
  const txtMuted  = isDarkMode ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.45)";
  const txtFaint  = isDarkMode ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.25)";

  const modal = (
    <AnimatePresence>
      <motion.div
        key="modal-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(4px)",
          display: "flex", alignItems: "flex-end", justifyContent: "center",
          padding: "0",
        }}
      >
        <motion.div
          key="modal-panel"
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 28, stiffness: 320 }}
          onClick={(e) => e.stopPropagation()}
          style={{
            width: "100%",
            maxWidth: 640,
            maxHeight: "92dvh",
            background: bg,
            borderRadius: "24px 24px 0 0",
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Drag handle */}
          <div style={{ display: "flex", justifyContent: "center", paddingTop: 12, paddingBottom: 4, flexShrink: 0 }}>
            <div style={{
              width: 36, height: 4, borderRadius: 99,
              background: isDarkMode ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)",
            }} />
          </div>

          {/* Bouton fermer */}
          <div style={{ display: "flex", justifyContent: "flex-end", padding: "0 16px 0", flexShrink: 0 }}>
            <button
              onClick={onClose}
              aria-label="Fermer"
              style={{
                width: 32, height: 32, borderRadius: "50%", border: "none",
                background: isDarkMode ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.07)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <X size={15} style={{ color: txtMuted }} />
            </button>
          </div>

          {/* Contenu scrollable */}
          <div style={{ padding: "12px 20px 48px", flex: 1 }}>

            {/* En-tête */}
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 16 }}>
              <TypeIcon type={opp.type} size={52} />
              <div style={{ flex: 1, minWidth: 0 }}>

                {/* Badges */}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: "0.05em",
                    padding: "3px 9px", borderRadius: 99,
                    background: isDarkMode ? cfg.bgDk : cfg.bg,
                    color: isDarkMode ? cfg.colorDk : cfg.color,
                    textTransform: "uppercase",
                  }}>
                    {cfg.label}
                  </span>
                  {fresh && (
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 3,
                      fontSize: 10, fontWeight: 700,
                      padding: "3px 8px", borderRadius: 99,
                      background: "rgba(249,115,22,0.15)", color: "#f97316",
                    }}>
                      <Sparkles size={9} strokeWidth={2.5} />
                      Nouveau
                    </span>
                  )}
                  {/* ✅ Badge opportunité interne */}
                  {opp.isInternal && (
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 3,
                      fontSize: 10, fontWeight: 700,
                      padding: "3px 8px", borderRadius: 99,
                      background: "rgba(59,130,246,0.15)", color: "#3b82f6",
                    }}>
                      <Building2 size={9} strokeWidth={2.5} />
                      Publié par une entreprise Chantilink
                    </span>
                  )}
                </div>

                {/* Titre */}
                <h2 style={{
                  fontSize: 18, fontWeight: 800, lineHeight: 1.25,
                  color: txt, margin: 0,
                }}>
                  {opp.title}
                </h2>
              </div>
            </div>

            {/* ── Bloc méta ─────────────────────────────────────────── */}
            <div style={{
              background: surface,
              border: `1px solid ${border}`,
              borderRadius: 16,
              padding: "14px 16px",
              marginBottom: 16,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}>

              {/* Entreprise */}
              {opp.company && opp.company !== "Non précisé" && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {opp.isInternal && opp.businessLogo ? (
                    <img
                      src={opp.businessLogo}
                      alt={opp.company}
                      style={{ width: 22, height: 22, borderRadius: 7, objectFit: "cover", flexShrink: 0 }}
                      onError={(e) => { e.currentTarget.style.display = "none"; }}
                    />
                  ) : (
                    <Building2 size={14} style={{ color: "#f97316", flexShrink: 0 }} />
                  )}
                  <span style={{ fontSize: 14, fontWeight: 600, color: txt }}>
                    {opp.company}
                  </span>
                </div>
              )}

              {/* Localisation */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <MapPin size={14} style={{ color: "#f97316", flexShrink: 0 }} />
                <span style={{ fontSize: 14, color: txtMuted }}>
                  {opp.location}
                </span>
              </div>

              {/* Date de publication */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Clock size={14} style={{ color: txtFaint, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: txtFaint }}>
                  Publié {timeAgo(opp.postedAt)}
                </span>
              </div>

              {/* Date de clôture */}
              {expiry && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "8px 12px", borderRadius: 10,
                  background: expiry.closed
                    ? "rgba(239,68,68,0.08)"
                    : "rgba(245,158,11,0.08)",
                  border: `1px solid ${expiry.closed ? "rgba(239,68,68,0.18)" : "rgba(245,158,11,0.18)"}`,
                  marginTop: 2,
                }}>
                  <CalendarClock size={14} style={{ color: expiry.closed ? "#ef4444" : "#d97706", flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: expiry.closed ? "#ef4444" : "#d97706" }}>
                    {expiry.closed ? "Offre clôturée" : `Clôture le ${expiry.label}`}
                  </span>
                </div>
              )}
            </div>

            {/* ── Description ───────────────────────────────────────── */}
            <div style={{
              background: surface,
              border: `1px solid ${border}`,
              borderRadius: 16,
              padding: "16px",
              marginBottom: 16,
            }}>
              <h3 style={{
                fontSize: 13, fontWeight: 700, letterSpacing: "0.06em",
                textTransform: "uppercase", color: txtFaint,
                marginBottom: 10, marginTop: 0,
              }}>
                Description
              </h3>

              {opp.description && opp.description.trim().length > 20 ? (
                <p style={{
                  fontSize: 14, lineHeight: 1.7, color: txt,
                  margin: 0, whiteSpace: "pre-wrap",
                }}>
                  {opp.description}
                </p>
              ) : (
                <div style={{ textAlign: "center", padding: "20px 0" }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>📄</div>
                  <p style={{ fontSize: 13, color: txtMuted, margin: 0, lineHeight: 1.5 }}>
                    La description complète est disponible sur le site source.
                  </p>
                  <p style={{ fontSize: 12, color: txtFaint, margin: "4px 0 0" }}>
                    Clique sur "Voir l'offre complète" pour en savoir plus.
                  </p>
                </div>
              )}
            </div>

            {/* ── Tags ──────────────────────────────────────────────── */}
            {opp.tags?.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 6,
                  marginBottom: 8,
                }}>
                  <Tag size={12} style={{ color: txtFaint }} />
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: txtFaint }}>
                    Compétences
                  </span>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {opp.tags.map((tag) => (
                    <span key={tag} style={{
                      fontSize: 12, fontWeight: 500,
                      padding: "5px 10px", borderRadius: 99,
                      background: isDarkMode ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)",
                      color: isDarkMode ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.55)",
                      border: `1px solid ${border}`,
                    }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* ── Source ────────────────────────────────────────────── */}
            <p style={{
              fontSize: 11, color: txtFaint,
              marginBottom: 20,
              display: "flex", alignItems: "center", gap: 4,
            }}>
              <ExternalLink size={10} />
              Source : {opp.source?.replace(/_/g, ".")}
            </p>

            {/* ── CTA principal ─────────────────────────────────────── */}
            <a
              href={opp.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                width: "100%", boxSizing: "border-box",
                padding: "15px 20px",
                borderRadius: 16,
                background: "linear-gradient(135deg, #ea580c, #f97316)",
                color: "#fff",
                textDecoration: "none",
                fontSize: 15, fontWeight: 700,
                boxShadow: "0 4px 16px rgba(249,115,22,0.40)",
              }}
            >
              {/* ✅ CTA adapté : "Postuler" pour les offres internes */}
              {opp.isInternal
                ? "Postuler"
                : opp.type === "appel_offre" ? "Voir le dossier complet" : "Voir l'offre complète"}
              <ArrowUpRight size={16} strokeWidth={2.5} />
            </a>

          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );

  return ReactDOM.createPortal(modal, document.body);
});
OppDetailModal.displayName = "OppDetailModal";

export default OppDetailModal;