// src/pages/profile/Pro/ProCVView.jsx
// v2.0 — affichage CV en rendu document deux colonnes (ProCVDocument)
// Si owner → bouton "Modifier le CV" qui rouvre CVModal
// Si visiteur → vue lecture seule du document

import React, { useState } from "react";
import { motion } from "framer-motion";
import { useDarkMode } from "../../../context/DarkModeContext";
import CVModal        from "./CVModal";
import ProCVDocument  from "./ProCVDocument";

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
  const { isDarkMode }  = useDarkMode();
  const [cvModalOpen, setCvModalOpen] = useState(false);

  const pi     = user?.proInfo || {};
  const hasCV  = !!(pi.jobTitle || pi.experiences?.length > 0 || pi.skills?.length > 0);

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
    <div style={{ fontFamily: "'Sora','DM Sans',sans-serif" }}>
      {/* ── Document CV deux colonnes ── */}
      <ProCVDocument
        user={user}
        isOwner={isOwner}
        onEdit={() => setCvModalOpen(true)}
        isDarkMode={isDarkMode}
      />

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