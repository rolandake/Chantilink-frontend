// src/pages/Auth/ResetPasswordPage.jsx
// ✅ Page /reset-password?token=xxx
// ✅ Valide le token au chargement (appel GET /api/auth/reset-password/validate)
// ✅ Affiche un formulaire si token valide, une erreur sinon
// ✅ Auto-login après reset réussi
// ✅ Design cohérent avec AuthPage

import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

// ── Icons
const EyeIcon = ({ open }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {open
      ? (<><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>)
      : (<><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>)
    }
  </svg>
);
const SpinnerIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" style={{animation:"cl-spin .75s linear infinite"}}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
);
const CheckIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
);
const ShieldIcon = () => (
  <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);

const pwStrength = (pw) => {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
};
const S_COLORS = ["","#f87171","#fb923c","#facc15","#34d399"];
const S_LABELS = ["","Faible","Moyen","Bon","Fort 💪"];

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap');
@keyframes cl-spin { to { transform:rotate(360deg); } }
@keyframes cl-in   { from{opacity:0;transform:translateY(18px) scale(.97)} to{opacity:1;transform:none} }
@keyframes cl-fade { from{opacity:0;transform:translateY(-5px)} to{opacity:1;transform:none} }
@keyframes cl-pulse{ 0%,100%{opacity:1} 50%{opacity:.45} }

.cla{--bg:#09090b;--surf:#111115;--brd:rgba(255,255,255,.07);--ora:#f97316;--pnk:#ec4899;--txt:#f0f0f0;--mut:#5c5c6e;--err:#f87171;--ok:#34d399;font-family:'DM Sans',system-ui,sans-serif;min-height:100dvh;background:var(--bg);display:flex;align-items:center;justify-content:center;padding:20px;position:relative;overflow:hidden;}
.cla::before{content:'';position:absolute;width:700px;height:700px;top:-250px;left:-200px;background:radial-gradient(circle,rgba(249,115,22,.09) 0%,transparent 65%);pointer-events:none}
.cla::after{content:'';position:absolute;width:550px;height:550px;bottom:-200px;right:-180px;background:radial-gradient(circle,rgba(236,72,153,.07) 0%,transparent 65%);pointer-events:none}

.cla-card{width:100%;max-width:408px;background:var(--surf);border:1px solid var(--brd);border-radius:26px;padding:42px 38px 38px;position:relative;z-index:1;box-shadow:0 0 0 1px rgba(255,255,255,.02),0 40px 100px rgba(0,0,0,.65);animation:cl-in .38s cubic-bezier(.22,1,.36,1) both;}
.cla-card::before{content:'';position:absolute;inset:0;border-radius:inherit;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.03'/%3E%3C/svg%3E");pointer-events:none;opacity:.4;}

.cla-logo{display:flex;align-items:center;gap:11px;margin-bottom:30px}
.cla-logo-box{width:42px;height:42px;border-radius:12px;flex-shrink:0;background:linear-gradient(135deg,#f97316,#ec4899);display:flex;align-items:center;justify-content:center;box-shadow:0 6px 22px rgba(249,115,22,.38);}
.cla-logo-text{font-family:'Syne',sans-serif;font-size:21px;font-weight:800;letter-spacing:-.03em;color:var(--txt)}
.cla-logo-text b{color:var(--ora);font-weight:800}

.cla-title{font-family:'Syne',sans-serif;font-size:27px;font-weight:700;letter-spacing:-.03em;color:var(--txt);margin-bottom:3px;line-height:1.18}
.cla-sub{font-size:13.5px;color:var(--mut);margin-bottom:26px;font-weight:300}

.cla-f{margin-bottom:13px}
.cla-lbl{display:block;font-size:11.5px;font-weight:500;color:var(--mut);letter-spacing:.07em;text-transform:uppercase;margin-bottom:6px}
.cla-iw{position:relative}
.cla-i{width:100%;padding:13px 16px;background:rgba(255,255,255,.04);border:1px solid var(--brd);border-radius:12px;color:var(--txt);font-family:'DM Sans',sans-serif;font-size:15px;font-weight:400;outline:none;transition:border-color .2s,box-shadow .2s,background .2s;-webkit-appearance:none;}
.cla-i::placeholder{color:#2d2d3a}
.cla-i:focus{border-color:rgba(249,115,22,.5);background:rgba(249,115,22,.03);box-shadow:0 0 0 3px rgba(249,115,22,.07)}
.cla-i.pr{padding-right:46px}
.cla-eye{position:absolute;right:13px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--mut);display:flex;align-items:center;padding:0;transition:color .15s}
.cla-eye:hover{color:var(--txt)}

.cla-bars{display:flex;gap:4px;margin-top:7px}
.cla-bar{flex:1;height:3px;border-radius:2px;background:rgba(255,255,255,.07);transition:background .3s}
.cla-hint{font-size:11.5px;margin-top:4px;font-weight:300}

.cla-btn{width:100%;padding:14px;border:none;border-radius:14px;font-family:'Syne',sans-serif;font-size:15px;font-weight:700;cursor:pointer;position:relative;overflow:hidden;transition:transform .15s,box-shadow .15s,opacity .15s;background:linear-gradient(135deg,#f97316,#ec4899);color:#fff;box-shadow:0 4px 22px rgba(249,115,22,.3);display:flex;align-items:center;justify-content:center;gap:8px;}
.cla-btn:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 10px 32px rgba(249,115,22,.42)}
.cla-btn:disabled{opacity:.5;cursor:not-allowed}

.cla-alert{padding:11px 14px;border-radius:10px;font-size:13.5px;margin-bottom:14px;display:flex;align-items:flex-start;gap:8px;animation:cl-fade .22s ease}
.cla-alert.err{background:rgba(248,113,113,.1);border:1px solid rgba(248,113,113,.18);color:#fca5a5}
.cla-alert.suc{background:rgba(52,211,153,.1);border:1px solid rgba(52,211,153,.18);color:#6ee7b7}

.cla-skeleton{animation:cl-pulse 1.5s ease infinite;background:rgba(255,255,255,.06);border-radius:10px;height:52px;margin-bottom:13px;}

.cla-expired{text-align:center;padding:8px 0}
.cla-expired-icon{font-size:44px;margin-bottom:14px}
.cla-expired-title{font-family:'Syne',sans-serif;font-size:22px;font-weight:700;color:var(--txt);margin-bottom:8px}
.cla-expired-body{font-size:14px;color:var(--mut);line-height:1.7;margin-bottom:24px}

.cla-success{text-align:center;padding:12px 0;animation:cl-fade .3s ease both}
.cla-success-icon{width:72px;height:72px;border-radius:20px;background:rgba(52,211,153,.1);border:1px solid rgba(52,211,153,.2);display:flex;align-items:center;justify-content:center;margin:0 auto 20px;}
.cla-success-title{font-family:'Syne',sans-serif;font-size:22px;font-weight:700;color:var(--txt);margin-bottom:8px}
.cla-success-body{font-size:14px;color:var(--mut);line-height:1.7;margin-bottom:24px}

.cla-timer{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--mut);background:rgba(255,255,255,.04);border:1px solid var(--brd);border-radius:8px;padding:5px 11px;margin-bottom:20px;}
.cla-timer span{color:var(--ora);font-weight:600;font-variant-numeric:tabular-nums}

@media(max-width:440px){.cla-card{padding:32px 22px 28px;border-radius:20px}.cla-title{font-size:23px}}
`;

export default function ResetPasswordPage() {
  const [searchParams]    = useSearchParams();
  const navigate          = useNavigate();
  const { setAuthData }   = useAuth(); // Adapter selon votre AuthContext

  const token = searchParams.get("token");

  // États de validation du token
  const [tokenStatus, setTokenStatus] = useState("checking"); // "checking" | "valid" | "expired" | "invalid"
  const [tokenEmail, setTokenEmail]   = useState("");
  const [remaining, setRemaining]     = useState(0); // secondes restantes

  // États du formulaire
  const [pw, setPw]         = useState("");
  const [pw2, setPw2]       = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);
  const [busy, setBusy]     = useState(false);
  const [alert, setAlert]   = useState(null);
  const [done, setDone]     = useState(false);

  const str     = pwStrength(pw);
  const match   = pw.length > 0 && pw === pw2;
  const canReset = pw.length >= 6 && match;

  // Countdown timer
  useEffect(() => {
    if (remaining <= 0) return;
    const id = setTimeout(() => setRemaining(r => r - 1), 1000);
    return () => clearTimeout(id);
  }, [remaining]);

  // Vérification du token au montage
  useEffect(() => {
    if (!token) { setTokenStatus("invalid"); return; }

    const validate = async () => {
      try {
        const res = await fetch(`/api/auth/reset-password/validate?token=${encodeURIComponent(token)}`);
        const data = await res.json();

        if (data.valid) {
          setTokenStatus("valid");
          setTokenEmail(data.email || "");
          setRemaining(data.expiresInSeconds || 0);
        } else {
          setTokenStatus(res.status === 400 ? "expired" : "invalid");
        }
      } catch {
        setTokenStatus("invalid");
      }
    };

    validate();
  }, [token]);

  // Si le timer tombe à 0 pendant que l'utilisateur remplit le form
  useEffect(() => {
    if (tokenStatus === "valid" && remaining === 0 && !done) {
      setTokenStatus("expired");
    }
  }, [remaining, tokenStatus, done]);

  // Soumission du nouveau mot de passe
  const handleSubmit = useCallback(async (e) => {
    e?.preventDefault();
    if (!canReset || busy) return;
    setBusy(true); setAlert(null);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: pw }),
      });
      const data = await res.json();

      if (data.success) {
        // ✅ Auto-login : stocker le nouveau token dans le contexte auth
        if (data.token && typeof setAuthData === "function") {
          setAuthData({ token: data.token, user: data.user, expiresIn: data.expiresIn });
        }
        setDone(true);
        // Redirection automatique après 2.5s
        setTimeout(() => navigate("/", { replace: true }), 2500);
      } else {
        if (res.status === 400 && data.message?.includes("expiré")) {
          setTokenStatus("expired");
        } else {
          setAlert({ t: "err", msg: data.message || "Une erreur est survenue." });
        }
      }
    } catch {
      setAlert({ t: "err", msg: "Une erreur de connexion est survenue." });
    } finally {
      setBusy(false);
    }
  }, [canReset, busy, token, pw, navigate, setAuthData]);

  const formatTime = (s) => `${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`;

  return (
    <>
      <style>{CSS}</style>
      <div className="cla">
        <div className="cla-card">

          {/* Logo */}
          <div className="cla-logo">
            <div className="cla-logo-box">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="9" height="15"/>
                <path d="M16 3h5v19h-5"/>
                <path d="M5 10h3M5 14h3M5 18h3M16 8h2M16 12h2M16 16h2"/>
              </svg>
            </div>
            <div className="cla-logo-text">CHANTI<b>LINK</b></div>
          </div>

          {/* ── Chargement ── */}
          {tokenStatus === "checking" && (
            <>
              <div className="cla-title">Vérification…</div>
              <div className="cla-sub">Validation du lien en cours</div>
              <div className="cla-skeleton"/>
              <div className="cla-skeleton" style={{height:44,marginBottom:0}}/>
            </>
          )}

          {/* ── Token invalide ou inconnu ── */}
          {tokenStatus === "invalid" && (
            <div className="cla-expired">
              <div className="cla-expired-icon">🚫</div>
              <div className="cla-expired-title">Lien invalide</div>
              <div className="cla-expired-body">
                Ce lien de réinitialisation est invalide ou ne correspond à aucune demande.
              </div>
              <button className="cla-btn" onClick={() => navigate("/login")}>
                Retour à la connexion
              </button>
            </div>
          )}

          {/* ── Token expiré ── */}
          {tokenStatus === "expired" && (
            <div className="cla-expired">
              <div className="cla-expired-icon">⏰</div>
              <div className="cla-expired-title">Lien expiré</div>
              <div className="cla-expired-body">
                Ce lien de réinitialisation a expiré (validité : 15 minutes).
                Fais une nouvelle demande pour recevoir un lien frais.
              </div>
              <button className="cla-btn" onClick={() => navigate("/login?forgot=1")}>
                Faire une nouvelle demande →
              </button>
            </div>
          )}

          {/* ── Succès ── */}
          {done && (
            <div className="cla-success">
              <div className="cla-success-icon"><ShieldIcon /></div>
              <div className="cla-success-title">Mot de passe mis à jour ✅</div>
              <div className="cla-success-body">
                Ton nouveau mot de passe est actif. Tu es maintenant connecté et tu vas être redirigé automatiquement.
              </div>
              <SpinnerIcon />
            </div>
          )}

          {/* ── Formulaire de reset ── */}
          {tokenStatus === "valid" && !done && (
            <>
              <div className="cla-title">Nouveau mot de passe 🔐</div>
              <div className="cla-sub">
                {tokenEmail
                  ? <>Pour le compte <strong style={{color:"#f0f0f0"}}>{tokenEmail}</strong></>
                  : "Choisis un nouveau mot de passe sécurisé"
                }
              </div>

              {/* Timer */}
              {remaining > 0 && (
                <div className="cla-timer">
                  ⏱ Lien valide encore <span>{formatTime(remaining)}</span>
                </div>
              )}

              {alert && (
                <div className={`cla-alert ${alert.t}`}>
                  <span>{alert.t==="err"?"⚠":"✓"}</span>
                  <span>{alert.msg}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} noValidate>
                <div className="cla-f">
                  <label className="cla-lbl">Nouveau mot de passe</label>
                  <div className="cla-iw">
                    <input
                      type={showPw ? "text" : "password"}
                      autoComplete="new-password"
                      className="cla-i pr"
                      placeholder="Min. 6 caractères"
                      value={pw}
                      onChange={e => setPw(e.target.value)}
                      disabled={busy}
                      autoFocus
                    />
                    <button type="button" className="cla-eye" onClick={() => setShowPw(v => !v)} tabIndex={-1}>
                      <EyeIcon open={showPw}/>
                    </button>
                  </div>
                  {pw.length > 0 && (
                    <>
                      <div className="cla-bars">
                        {[1,2,3,4].map(i=>(
                          <div key={i} className="cla-bar" style={{background: str>=i ? S_COLORS[str] : undefined}}/>
                        ))}
                      </div>
                      <div className="cla-hint" style={{color:S_COLORS[str]}}>
                        {S_LABELS[str]}{str<3?" — ajoute chiffres & majuscules":""}
                      </div>
                    </>
                  )}
                </div>

                <div className="cla-f">
                  <label className="cla-lbl">Confirmer le mot de passe</label>
                  <div className="cla-iw">
                    <input
                      type={showPw2 ? "text" : "password"}
                      autoComplete="new-password"
                      className={`cla-i pr${pw2.length > 0 ? (match ? " ok" : " er") : ""}`}
                      placeholder="••••••••"
                      value={pw2}
                      onChange={e => setPw2(e.target.value)}
                      disabled={busy}
                    />
                    <button type="button" className="cla-eye" onClick={() => setShowPw2(v => !v)} tabIndex={-1}>
                      <EyeIcon open={showPw2}/>
                    </button>
                  </div>
                  {pw2.length > 0 && !match && (
                    <div className="cla-hint" style={{color:"#f87171"}}>Les mots de passe ne correspondent pas</div>
                  )}
                  {match && (
                    <div className="cla-hint" style={{color:"#34d399",display:"flex",alignItems:"center",gap:4}}>
                      <CheckIcon/> Les mots de passe correspondent
                    </div>
                  )}
                </div>

                <button type="submit" className="cla-btn" disabled={!canReset || busy} style={{marginTop:6}}>
                  {busy ? <><SpinnerIcon/>Enregistrement…</> : "Enregistrer le nouveau mot de passe →"}
                </button>
              </form>
            </>
          )}

        </div>
      </div>
    </>
  );
}