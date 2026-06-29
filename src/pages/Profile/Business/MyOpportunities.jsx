// src/pages/profile/Business/MyOpportunities.jsx
// Gestion des opportunités publiées par l'entreprise — affiché dans
// Paramètres > Mes offres (visible uniquement en mode page entreprise)

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import {
  Briefcase, GraduationCap, FileText, MapPin, Clock,
  Pencil, Trash2, Pause, Play, Plus, CalendarClock,
} from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import { useDarkMode } from "../../../context/DarkModeContext";
import { profileApiPath, authJsonHeaders } from "../profileApi";
import CreateOpportunityModal from "./CreateOpportunityModal";

const TYPE_CONFIG = {
  emploi:      { label: "Emploi",         color: "#3b82f6", Icon: Briefcase },
  stage:       { label: "Stage",          color: "#22c55e", Icon: GraduationCap },
  appel_offre: { label: "Appel d'offres", color: "#f59e0b", Icon: FileText },
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

function formatExpiry(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const closed = d < new Date();
  return { label: d.toLocaleDateString("fr-CI", { day: "numeric", month: "short", year: "numeric" }), closed };
}

const LoadingSpinner = ({ isDarkMode }) => (
  <div style={{ display: "flex", justifyContent: "center", padding: "48px 0" }}>
    <div style={{
      width: 32, height: 32, borderRadius: "50%",
      border: `3px solid ${isDarkMode ? "rgba(249,115,22,0.2)" : "rgba(249,115,22,0.15)"}`,
      borderTopColor: "#f97316",
      animation: "spin 0.8s linear infinite",
    }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

export default function MyOpportunities({ user, showToast }) {
  const { getToken }   = useAuth();
  const { isDarkMode } = useDarkMode();

  const [opportunities, setOpportunities] = useState([]);
  const [loading,        setLoading]      = useState(true);
  const [error,          setError]        = useState(null);
  const [busyId,         setBusyId]       = useState(null);

  const [showModal,        setShowModal]        = useState(false);
  const [editingOpportunity, setEditingOpportunity] = useState(null);
  const [confirmDeleteId,  setConfirmDeleteId]  = useState(null);

  const border = isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
  const cardBg = isDarkMode ? "rgba(255,255,255,0.04)" : "#fff";
  const text   = isDarkMode ? "#f8fafc" : "#0f172a";
  const muted  = isDarkMode ? "#6b7280" : "#9ca3af";

  const fetchMine = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken?.();
      if (!token) throw new Error("Session expirée");
      const { data } = await axios.get(
        profileApiPath("opportunities/mine"),
        { headers: authJsonHeaders(token), withCredentials: true, timeout: 10000 }
      );
      setOpportunities(data?.opportunities || []);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => { fetchMine(); }, [fetchMine]);

  const handleCreated = useCallback((opp) => {
    setOpportunities((prev) => [opp, ...prev]);
  }, []);

  const handleUpdated = useCallback((opp) => {
    setOpportunities((prev) => prev.map((o) => (o._id === opp._id ? opp : o)));
    setEditingOpportunity(null);
  }, []);

  const toggleActive = useCallback(async (opp) => {
    setBusyId(opp._id);
    try {
      const token = await getToken?.();
      const { data } = await axios.patch(
        profileApiPath(`opportunities/${opp._id}`),
        { isActive: !opp.isActive },
        { headers: authJsonHeaders(token), withCredentials: true, timeout: 10000 }
      );
      setOpportunities((prev) => prev.map((o) => (o._id === opp._id ? (data?.opportunity || data) : o)));
      showToast?.(opp.isActive ? "Offre clôturée" : "Offre réactivée", "success");
    } catch (err) {
      showToast?.(err?.response?.data?.error || "Erreur lors de la mise à jour", "error");
    } finally {
      setBusyId(null);
    }
  }, [getToken, showToast]);

  const handleDelete = useCallback(async (id) => {
    setBusyId(id);
    try {
      const token = await getToken?.();
      await axios.delete(
        profileApiPath(`opportunities/${id}`),
        { headers: authJsonHeaders(token), withCredentials: true, timeout: 10000 }
      );
      setOpportunities((prev) => prev.filter((o) => o._id !== id));
      showToast?.("Offre supprimée", "success");
    } catch (err) {
      showToast?.(err?.response?.data?.error || "Erreur lors de la suppression", "error");
    } finally {
      setBusyId(null);
      setConfirmDeleteId(null);
    }
  }, [getToken, showToast]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, fontFamily: "'Sora','DM Sans',sans-serif" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: text }}>Mes offres publiées</h3>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: muted }}>
            Gère tes opportunités visibles dans l'onglet Opportunités de l'application.
          </p>
        </div>
        <motion.button
          onClick={() => { setEditingOpportunity(null); setShowModal(true); }}
          whileHover={{ scale: 1.03, y: -1 }} whileTap={{ scale: 0.97 }}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "10px 16px", borderRadius: 12, border: "none", cursor: "pointer",
            background: "linear-gradient(135deg,#f97316,#ec4899)",
            color: "#fff", fontWeight: 700, fontSize: 13, whiteSpace: "nowrap",
            boxShadow: "0 4px 14px rgba(249,115,22,0.3)",
          }}
        >
          <Plus size={15} /> Nouvelle offre
        </motion.button>
      </div>

      {/* Erreur */}
      {error && (
        <div style={{
          padding: "12px 16px", borderRadius: 12,
          background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
          fontSize: 13, color: "#ef4444",
        }}>
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && <LoadingSpinner isDarkMode={isDarkMode} />}

      {/* Empty state */}
      {!loading && !error && opportunities.length === 0 && (
        <div style={{ textAlign: "center", padding: "48px 0" }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>📭</div>
          <p style={{ fontSize: 14, fontWeight: 700, color: text, margin: 0 }}>
            Aucune offre publiée pour l'instant
          </p>
          <p style={{ fontSize: 13, color: muted, marginTop: 4 }}>
            Clique sur "Nouvelle offre" pour publier ta première opportunité.
          </p>
        </div>
      )}

      {/* Liste */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <AnimatePresence initial={false}>
          {opportunities.map((opp) => {
            const cfg    = TYPE_CONFIG[opp.type] || TYPE_CONFIG.emploi;
            const Icon   = cfg.Icon;
            const expiry = formatExpiry(opp.expiresAt);
            const isBusy = busyId === opp._id;

            return (
              <motion.div
                key={opp._id}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                style={{
                  borderRadius: 16, border: `1px solid ${border}`, background: cardBg,
                  padding: "14px 16px", opacity: opp.isActive ? 1 : 0.6,
                }}
              >
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 12, flexShrink: 0,
                    background: cfg.color, display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Icon size={18} color="#fff" strokeWidth={2} />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                        padding: "2px 8px", borderRadius: 99,
                        background: `${cfg.color}20`, color: cfg.color,
                      }}>
                        {cfg.label}
                      </span>
                      {!opp.isActive && (
                        <span style={{
                          fontSize: 10, fontWeight: 700,
                          padding: "2px 8px", borderRadius: 99,
                          background: "rgba(239,68,68,0.12)", color: "#ef4444",
                        }}>
                          Clôturée
                        </span>
                      )}
                    </div>

                    <p style={{ fontSize: 14, fontWeight: 700, color: text, margin: "0 0 4px" }}>
                      {opp.title}
                    </p>

                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 12, color: muted }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <MapPin size={11} /> {opp.location}
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <Clock size={11} /> {timeAgo(opp.postedAt)}
                      </span>
                      {expiry && (
                        <span style={{ display: "flex", alignItems: "center", gap: 4, color: expiry.closed ? "#ef4444" : muted }}>
                          <CalendarClock size={11} /> {expiry.closed ? "Expirée" : `Clôture ${expiry.label}`}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                  <button
                    onClick={() => { setEditingOpportunity(opp); setShowModal(true); }}
                    disabled={isBusy}
                    style={{
                      display: "flex", alignItems: "center", gap: 5,
                      padding: "6px 12px", borderRadius: 10, border: `1px solid ${border}`,
                      background: "transparent", color: text, fontSize: 12, fontWeight: 600,
                      cursor: isBusy ? "not-allowed" : "pointer",
                    }}
                  >
                    <Pencil size={12} /> Modifier
                  </button>

                  <button
                    onClick={() => toggleActive(opp)}
                    disabled={isBusy}
                    style={{
                      display: "flex", alignItems: "center", gap: 5,
                      padding: "6px 12px", borderRadius: 10, border: `1px solid ${border}`,
                      background: "transparent", color: text, fontSize: 12, fontWeight: 600,
                      cursor: isBusy ? "not-allowed" : "pointer",
                    }}
                  >
                    {opp.isActive ? <><Pause size={12} /> Clôturer</> : <><Play size={12} /> Réactiver</>}
                  </button>

                  {confirmDeleteId === opp._id ? (
                    <>
                      <button
                        onClick={() => handleDelete(opp._id)}
                        disabled={isBusy}
                        style={{
                          padding: "6px 12px", borderRadius: 10, border: "none",
                          background: "#ef4444", color: "#fff", fontSize: 12, fontWeight: 700,
                          cursor: isBusy ? "not-allowed" : "pointer",
                        }}
                      >
                        Confirmer la suppression
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        style={{
                          padding: "6px 12px", borderRadius: 10, border: `1px solid ${border}`,
                          background: "transparent", color: muted, fontSize: 12, fontWeight: 600, cursor: "pointer",
                        }}
                      >
                        Annuler
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(opp._id)}
                      disabled={isBusy}
                      style={{
                        display: "flex", alignItems: "center", gap: 5,
                        padding: "6px 12px", borderRadius: 10, border: "1px solid rgba(239,68,68,0.3)",
                        background: "transparent", color: "#ef4444", fontSize: 12, fontWeight: 600,
                        cursor: isBusy ? "not-allowed" : "pointer", marginLeft: "auto",
                      }}
                    >
                      <Trash2 size={12} /> Supprimer
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Modal création / édition */}
      <CreateOpportunityModal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingOpportunity(null); }}
        user={user}
        showToast={showToast}
        editingOpportunity={editingOpportunity}
        onCreated={handleCreated}
        onUpdated={handleUpdated}
      />
    </div>
  );
}