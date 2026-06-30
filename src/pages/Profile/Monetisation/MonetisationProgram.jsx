import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "../../../context/AuthContext";
import { useDarkMode } from "../../../context/DarkModeContext";
import { getAuthToken, monetisationFetch, readMonetisationJson } from "./monetisationApi";
import useMonetisationRealtime, { emitMonetisationRefresh } from "./useMonetisationRealtime";

// ⏸️ TEMP v4.3 — Programme créateur réduit à la CERTIFICATION DE COMPTE uniquement.
//   - La monétisation (offres, revenus, retraits, politique de monétisation) est masquée
//     temporairement le temps de retravailler cette partie.
//   - Rien n'est supprimé côté logique : status.monetisation, status.payout, stats, etc.
//     continuent d'être chargés depuis l'API et restent dans `status` — seules les
//     sections d'affichage monétisation ont été retirées du rendu.
//   - Pour réactiver plus tard : remettre les blocs commentés "MONÉTISATION (désactivée)"
//     ci-dessous, ou repartir de l'ancienne version du fichier.

const fallbackStatus = (user = {}) => {
  const followersCount = user.followersCount || user.followers?.length || 0;
  const postsCount = user.postsCount || 0;
  const hasRealAvatar = Boolean(user.profilePhoto && user.profilePhoto !== "/default-avatar.png");
  const profileComplete = Boolean(user.fullName && user.username && user.bio && user.location && hasRealAvatar);
  const cleanRecord = !user.isBanned && (user.moderation?.strikes || 0) === 0;

  const makeCheck = (id, label, passed, description, action = null) => ({
    id,
    label,
    passed,
    description,
    action,
  });

  const certificationChecks = [
    makeCheck("profile_complete", "Profil professionnel complet", profileComplete, "Nom, identifiant, bio, localisation et photo réelle."),
    makeCheck("posts", "5 publications minimum", postsCount >= 5, `${postsCount}/5 publication(s).`),
    makeCheck("followers", "25 abonnés minimum", followersCount >= 25, `${followersCount}/25 abonné(s).`),
    makeCheck("clean_record", "Aucun blocage ni strike actif", cleanRecord, "Le compte doit rester fiable."),
  ];

  const monetisationChecks = [
    makeCheck("certified", "Compte certifié", Boolean(user.isVerified), "La certification est requise."),
    makeCheck("posts", "10 publications utiles minimum", postsCount >= 10, `${postsCount}/10 publication(s).`),
    makeCheck("followers", "50 abonnés minimum", followersCount >= 50, `${followersCount}/50 abonné(s).`),
    makeCheck("offers", "1 offre active", false, "Créez une offre payante depuis votre profil.", "Créer une offre"),
    makeCheck("policy", "Respect de la politique créateur", cleanRecord, "Aucun abus, copie ou contenu dangereux."),
  ];

  return {
    account: {
      isVerified: Boolean(user.isVerified),
      isPremium: Boolean(user.isPremium),
      followersCount,
      postsCount,
      offersCount: 0,
      activeOffersCount: 0,
      accountAgeDays: 0,
      moderation: { strikes: user.moderation?.strikes || 0, warnings: user.moderation?.warningCount || 0 },
    },
    certification: {
      status: user.isVerified ? "approved" : certificationChecks.every((check) => check.passed) ? "ready" : "not_ready",
      eligible: certificationChecks.every((check) => check.passed),
      checks: certificationChecks,
    },
    // ⏸️ Conservé tel quel (non affiché) pour ne rien casser quand la monétisation reviendra.
    monetisation: {
      status: "not_ready",
      eligible: false,
      checks: monetisationChecks,
      stats: {
        totalRevenue: 0,
        monthlyRevenue: 0,
        salesCount: 0,
        availableBalance: 0,
        revenueBreakdown: {
          offerSales: 0,
          tips: 0,
          subscriptions: 0,
          premiumContent: 0,
          creatorFund: 0,
          adShare: 0,
          engagementBonus: 0,
          videoBonus: 0,
        },
        social: {
          streams: [
            { id: "creator_fund", title: "Fonds créateur", description: "Revenus automatiques selon les vues qualifiées." },
            { id: "ad_share", title: "Partage publicitaire", description: "Part reversée sur les publicités autour du contenu." },
            { id: "tips", title: "Pourboires", description: "Soutien direct envoyé par les membres." },
            { id: "subscriptions", title: "Abonnements", description: "Paiement mensuel pour suivre un créateur." },
            { id: "premium_content", title: "Contenus premium", description: "Documents, vidéos ou fichiers vendus à l'unité." },
            { id: "offers", title: "Offres", description: "Services, formations, consultations et calculs vendus." },
          ],
          topPosts: [],
        },
      },
    },
    payout: {
      enabled: false,
      minimumAmount: 5000,
      currency: "XOF",
      reviewDelayDays: 7,
      methods: ["mobile_money", "bank_transfer"],
      requirements: ["Compte certifié", "Programme actif", "Compte premium", "Solde disponible suffisant"],
    },
    policy: {
      title: "Politique de monétisation ChantiLink",
      rulesSummary:
        "La monétisation est réservée aux créateurs fiables qui publient du contenu utile au génie civil.",
      rules: [
        "Publier du contenu original ou correctement sourcé dans le génie civil, BTP, architecture, chantier, matériaux ou calcul.",
        "Ne pas vendre de documents, plans, formations ou services trompeurs, copiés ou dangereux.",
        "Respecter les droits d'auteur sur les médias et documents techniques.",
        "Ne pas manipuler l'audience, les avis, les ventes ou les abonnements.",
        "Afficher clairement les prix, délais, livrables et conditions de remboursement.",
        "Accepter les contrôles d'identité, paiement, fiscalité et conformité avant retrait.",
      ],
    },
  };
};

const statusLabel = {
  approved: "Certifié",
  ready: "Prêt pour demande",
  active: "Actif",
  not_ready: "À compléter",
  requires_certification: "Certification requise",
};

function CheckRow({ check, dark, onNavigate }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "24px 1fr auto",
        gap: 10,
        alignItems: "start",
        padding: "12px 0",
        borderBottom: `1px solid ${dark ? "rgba(255,255,255,0.07)" : "rgba(15,23,42,0.08)"}`,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 22,
          height: 22,
          borderRadius: 999,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: check.passed ? "rgba(16,185,129,0.14)" : "rgba(245,158,11,0.14)",
          color: check.passed ? "#10b981" : "#f59e0b",
          fontWeight: 900,
          fontSize: 13,
        }}
      >
        {check.passed ? "✓" : "!"}
      </span>
      <div>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: dark ? "#f8fafc" : "#111827" }}>{check.label}</p>
        <p style={{ margin: "4px 0 0", fontSize: 12, lineHeight: 1.45, color: dark ? "#94a3b8" : "#64748b" }}>
          {check.description}
        </p>
      </div>
      {check.action && !check.passed && (
        <button
          type="button"
          onClick={() => onNavigate?.(check.action.includes("offre") ? "create" : "programme")}
          style={{
            border: "none",
            borderRadius: 999,
            padding: "7px 10px",
            background: dark ? "rgba(255,255,255,0.08)" : "#f8fafc",
            color: dark ? "#e5e7eb" : "#334155",
            fontSize: 11,
            fontWeight: 800,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {check.action}
        </button>
      )}
    </div>
  );
}

function SectionCard({ title, subtitle, children, dark }) {
  return (
    <div
      style={{
        border: `1px solid ${dark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)"}`,
        borderRadius: 18,
        padding: 18,
        background: dark ? "rgba(15,23,42,0.58)" : "#ffffff",
      }}
    >
      <h3 style={{ margin: 0, color: dark ? "#f8fafc" : "#111827", fontSize: 15, fontWeight: 900 }}>{title}</h3>
      {subtitle && (
        <p style={{ margin: "5px 0 14px", color: dark ? "#94a3b8" : "#64748b", fontSize: 12, lineHeight: 1.5 }}>{subtitle}</p>
      )}
      {children}
    </div>
  );
}

export default function MonetisationProgram({ user, showToast, onNavigate }) {
  const { isDarkMode } = useDarkMode();
  const { getToken } = useAuth();
  const [status, setStatus] = useState(() => fallbackStatus(user));
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(null);

  const dark = isDarkMode;
  const text = dark ? "#f8fafc" : "#0f172a";
  const sub = dark ? "#94a3b8" : "#64748b";
  const border = dark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)";

  const refresh = useCallback(async ({ background = false } = {}) => {
    if (!background) setLoading(true);
    try {
      const token = await getAuthToken(getToken);
      const res = await monetisationFetch("status", { token });
      if (!res.ok) throw new Error("Statut monétisation indisponible.");
      setStatus(await readMonetisationJson(res));
    } catch (err) {
      setStatus(fallbackStatus(user));
    } finally {
      if (!background) setLoading(false);
    }
  }, [getToken, user]);

  useEffect(() => {
    refresh();
  }, [refresh]);
  useMonetisationRealtime(refresh, "status");

  // ⏸️ TEMP v4.3 : la progression affichée ne porte plus que sur la certification
  // (avant : certification + monétisation cumulées).
  const progress = useMemo(() => {
    const checks = status.certification?.checks || [];
    if (!checks.length) return 0;
    return Math.round((checks.filter((check) => check.passed).length / checks.length) * 100);
  }, [status]);

  const submitApplication = async (type) => {
    setSubmitting(type);
    try {
      const token = await getAuthToken(getToken);
      const res = await monetisationFetch("applications", {
        method: "POST",
        token,
        body: JSON.stringify({ type }),
      });
      const body = await readMonetisationJson(res).catch(() => ({}));
      if (!res.ok) {
        const firstMissing = body.missing?.[0]?.label;
        throw new Error(firstMissing ? `Condition manquante : ${firstMissing}` : body.message || "Demande impossible.");
      }
      showToast?.("Demande envoyée. L'équipe ChantiLink va l'examiner.", "success");
      await refresh();
      emitMonetisationRefresh("all");
    } catch (err) {
      showToast?.(err.message || "Impossible d'envoyer la demande.", "error");
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, fontFamily: "'Sora','DM Sans',sans-serif" }}>
      <div
        style={{
          border: `1px solid ${border}`,
          borderRadius: 20,
          padding: 22,
          background: dark
            ? "linear-gradient(135deg, rgba(15,23,42,0.98), rgba(30,41,59,0.94))"
            : "linear-gradient(135deg, #fff7ed, #ffffff 54%, #f8fafc)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div style={{ maxWidth: 620 }}>
            <p style={{ margin: "0 0 6px", color: "#f97316", fontSize: 12, fontWeight: 900, textTransform: "uppercase", letterSpacing: ".08em" }}>
              Certification de compte
            </p>
            <h2 style={{ margin: 0, color: text, fontSize: 24, fontWeight: 950, lineHeight: 1.15 }}>
              Certifier votre compte professionnel
            </h2>
            <p style={{ margin: "10px 0 0", color: sub, fontSize: 13, lineHeight: 1.65 }}>
              La certification confirme que le compte représente une vraie personne ou activité professionnelle
              fiable dans le génie civil et le BTP.
            </p>
          </div>
          <div
            style={{
              width: 132,
              minHeight: 132,
              borderRadius: 20,
              border: `1px solid ${border}`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              background: dark ? "rgba(2,6,23,0.42)" : "rgba(255,255,255,0.82)",
            }}
          >
            <strong style={{ fontSize: 30, color: text }}>{loading ? "..." : `${progress}%`}</strong>
            <span style={{ fontSize: 11, color: sub, fontWeight: 800, textAlign: "center" }}>profil prêt</span>
            <div style={{ width: 84, height: 6, borderRadius: 999, background: dark ? "#1f2937" : "#e5e7eb", marginTop: 10, overflow: "hidden" }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                style={{ height: "100%", background: "linear-gradient(90deg,#f97316,#10b981)" }}
              />
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 10, marginTop: 18 }}>
          {[
            ["Certification", statusLabel[status.certification?.status] || "À vérifier"],
          ].map(([label, value]) => (
            <div key={label} style={{ border: `1px solid ${border}`, borderRadius: 14, padding: 12, background: dark ? "rgba(2,6,23,0.35)" : "rgba(255,255,255,0.78)" }}>
              <p style={{ margin: 0, color: sub, fontSize: 11, fontWeight: 800 }}>{label}</p>
              <strong style={{ display: "block", marginTop: 4, color: text, fontSize: 14 }}>{value}</strong>
            </div>
          ))}
        </div>
      </div>

      <SectionCard dark={dark} title="Conditions pour être certifié" subtitle="La certification confirme que le compte représente une vraie personne ou activité professionnelle.">
        {(status.certification?.checks || []).map((check) => (
          <CheckRow key={check.id} check={check} dark={dark} onNavigate={onNavigate} />
        ))}
        <button
          type="button"
          disabled={!status.certification?.eligible || status.account?.isVerified || submitting === "certification"}
          onClick={() => submitApplication("certification")}
          style={{
            width: "100%",
            marginTop: 14,
            border: "none",
            borderRadius: 14,
            padding: "12px 14px",
            background: status.certification?.eligible && !status.account?.isVerified ? "linear-gradient(135deg,#f97316,#ec4899)" : dark ? "#1f2937" : "#e5e7eb",
            color: status.certification?.eligible && !status.account?.isVerified ? "#fff" : sub,
            fontWeight: 900,
            cursor: status.certification?.eligible && !status.account?.isVerified ? "pointer" : "not-allowed",
          }}
        >
          {status.account?.isVerified ? "Compte déjà certifié" : submitting === "certification" ? "Envoi en cours..." : "Demander la certification"}
        </button>
      </SectionCard>

      {/* ⏸️ MONÉTISATION (désactivée temporairement) — sections retirées du rendu :
          - SectionCard "Conditions pour monétiser" (status.monetisation.checks)
          - SectionCard "Comment le compte gagne de l'argent" (revenue streams, stats)
          - SectionCard "Publications qui rapportent le plus" (stats.social.topPosts)
          - SectionCard "Politique de monétisation ChantiLink" (status.policy.rules)
          - SectionCard "Retraits et paiements" (status.payout)
          Les données restent disponibles dans `status` (monetisation, payout, policy)
          pour une réactivation rapide plus tard. */}
    </div>
  );
}