// src/pages/Auth/AuthPage.jsx
// ✅ Login + Register + Forgot Password — transitions fluides sans page reload
// ✅ Indicateur force mot de passe, validation inline, show/hide password
// ✅ Remember me 90j, optimistic UI, feedback immédiat
// ✅ Mode "forgot" : envoi email de reset avec countdown anti-spam
// ✅ Design sombre raffiné — typographie Syne + DM Sans
// ✅ Connexion Google OAuth

import React, { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

// ============================================================
// ICONS
// ============================================================
const EyeIcon = ({ open }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {open
      ? (<><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>)
      : (<><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>)
    }
  </svg>
);
const CheckIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
);
const SpinnerIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" style={{animation:"cl-spin .75s linear infinite"}}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
);
const MailIcon = () => (
  <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" style={{color:"#f97316"}}>
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
    <polyline points="22,6 12,13 2,6"/>
  </svg>
);
const ArrowLeftIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
);
const GoogleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

// ============================================================
// HELPERS
// ============================================================
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

// ============================================================
// CSS
// ============================================================
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap');
@keyframes cl-spin    { to { transform:rotate(360deg); } }
@keyframes cl-in      { from{opacity:0;transform:translateY(18px) scale(.97)} to{opacity:1;transform:none} }
@keyframes cl-fade    { from{opacity:0;transform:translateY(-5px)} to{opacity:1;transform:none} }
@keyframes cl-slide-up{ from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:none} }
@keyframes cl-pulse   { 0%,100%{opacity:1} 50%{opacity:.5} }

.cla{
  --bg:#09090b; --surf:#111115; --brd:rgba(255,255,255,.07);
  --ora:#f97316; --pnk:#ec4899; --txt:#f0f0f0; --mut:#5c5c6e;
  --err:#f87171; --ok:#34d399;
  font-family:'DM Sans',system-ui,sans-serif;
  min-height:100dvh; background:var(--bg);
  display:flex; align-items:center; justify-content:center;
  padding:20px; position:relative; overflow:hidden;
}
.cla::before{content:'';position:absolute;width:700px;height:700px;top:-250px;left:-200px;background:radial-gradient(circle,rgba(249,115,22,.09) 0%,transparent 65%);pointer-events:none}
.cla::after{content:'';position:absolute;width:550px;height:550px;bottom:-200px;right:-180px;background:radial-gradient(circle,rgba(236,72,153,.07) 0%,transparent 65%);pointer-events:none}

.cla-card{
  width:100%; max-width:408px;
  background:var(--surf); border:1px solid var(--brd);
  border-radius:26px; padding:42px 38px 38px;
  position:relative; z-index:1;
  box-shadow:0 0 0 1px rgba(255,255,255,.02),0 40px 100px rgba(0,0,0,.65);
  animation:cl-in .38s cubic-bezier(.22,1,.36,1) both;
}
.cla-card::before{
  content:''; position:absolute; inset:0; border-radius:inherit;
  background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.03'/%3E%3C/svg%3E");
  pointer-events:none; opacity:.4;
}

.cla-logo{display:flex;align-items:center;gap:11px;margin-bottom:30px}
.cla-logo-box{width:42px;height:42px;border-radius:12px;flex-shrink:0;background:linear-gradient(135deg,#f97316,#ec4899);display:flex;align-items:center;justify-content:center;box-shadow:0 6px 22px rgba(249,115,22,.38);}
.cla-logo-text{font-family:'Syne',sans-serif;font-size:21px;font-weight:800;letter-spacing:-.03em;color:var(--txt)}
.cla-logo-text b{color:var(--ora);font-weight:800}

.cla-title{font-family:'Syne',sans-serif;font-size:27px;font-weight:700;letter-spacing:-.03em;color:var(--txt);margin-bottom:3px;line-height:1.18}
.cla-sub{font-size:13.5px;color:var(--mut);margin-bottom:26px;font-weight:300}

.cla-tabs{display:flex;gap:0;background:rgba(255,255,255,.04);border-radius:13px;padding:4px;margin-bottom:26px}
.cla-tab{flex:1;padding:9px;border:none;background:none;cursor:pointer;font-family:'DM Sans',sans-serif;font-size:13.5px;font-weight:500;color:var(--mut);border-radius:10px;transition:all .2s}
.cla-tab.on{background:rgba(249,115,22,.14);color:var(--ora);font-weight:600}

.cla-f{margin-bottom:13px}
.cla-lbl{display:block;font-size:11.5px;font-weight:500;color:var(--mut);letter-spacing:.07em;text-transform:uppercase;margin-bottom:6px}
.cla-iw{position:relative}
.cla-i{width:100%;padding:13px 16px;background:rgba(255,255,255,.04);border:1px solid var(--brd);border-radius:12px;color:var(--txt);font-family:'DM Sans',sans-serif;font-size:15px;font-weight:400;outline:none;transition:border-color .2s,box-shadow .2s,background .2s;-webkit-appearance:none;}
.cla-i::placeholder{color:#2d2d3a}
.cla-i:focus{border-color:rgba(249,115,22,.5);background:rgba(249,115,22,.03);box-shadow:0 0 0 3px rgba(249,115,22,.07)}
.cla-i.pr{padding-right:46px}
.cla-i.ok{border-color:rgba(52,211,153,.35)}
.cla-i.er{border-color:rgba(248,113,113,.45)}
.cla-eye{position:absolute;right:13px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--mut);display:flex;align-items:center;padding:0;transition:color .15s}
.cla-eye:hover{color:var(--txt)}
.cla-ok-badge{position:absolute;right:13px;top:50%;transform:translateY(-50%);color:var(--ok);display:flex;align-items:center}

.cla-bars{display:flex;gap:4px;margin-top:7px}
.cla-bar{flex:1;height:3px;border-radius:2px;background:rgba(255,255,255,.07);transition:background .3s}
.cla-hint{font-size:11.5px;margin-top:4px;font-weight:300}

.cla-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px}
.cla-rem{display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;color:var(--mut);user-select:none}
.cla-box{width:16px;height:16px;border:1.5px solid rgba(255,255,255,.13);border-radius:5px;display:flex;align-items:center;justify-content:center;background:transparent;transition:all .15s;flex-shrink:0}
.cla-box.on{background:var(--ora);border-color:var(--ora);color:#fff}
.cla-forgot{font-size:13px;color:var(--ora);background:none;border:none;cursor:pointer;padding:0;font-family:'DM Sans',sans-serif;opacity:.82;transition:opacity .15s}
.cla-forgot:hover{opacity:1;text-decoration:underline}

.cla-btn{width:100%;padding:14px;border:none;border-radius:14px;font-family:'Syne',sans-serif;font-size:15px;font-weight:700;letter-spacing:.01em;cursor:pointer;position:relative;overflow:hidden;transition:transform .15s,box-shadow .15s,opacity .15s;background:linear-gradient(135deg,#f97316,#ec4899);color:#fff;box-shadow:0 4px 22px rgba(249,115,22,.3);display:flex;align-items:center;justify-content:center;gap:8px;}
.cla-btn:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 10px 32px rgba(249,115,22,.42)}
.cla-btn:active:not(:disabled){transform:scale(.99)}
.cla-btn:disabled{opacity:.5;cursor:not-allowed}
.cla-btn::after{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,255,255,.13),transparent);opacity:0;transition:opacity .2s}
.cla-btn:hover::after{opacity:1}

.cla-btn-ghost{width:100%;padding:12px;border:1px solid var(--brd);border-radius:14px;font-family:'DM Sans',sans-serif;font-size:14px;font-weight:500;cursor:pointer;background:rgba(255,255,255,.03);color:var(--mut);display:flex;align-items:center;justify-content:center;gap:7px;transition:all .2s;margin-top:10px;}
.cla-btn-ghost:hover{border-color:rgba(255,255,255,.13);background:rgba(255,255,255,.06);color:var(--txt)}

.cla-alert{padding:11px 14px;border-radius:10px;font-size:13.5px;margin-bottom:14px;display:flex;align-items:flex-start;gap:8px;animation:cl-fade .22s ease}
.cla-alert.err{background:rgba(248,113,113,.1);border:1px solid rgba(248,113,113,.18);color:#fca5a5}
.cla-alert.suc{background:rgba(52,211,153,.1);border:1px solid rgba(52,211,153,.18);color:#6ee7b7}
.cla-alert.inf{background:rgba(249,115,22,.08);border:1px solid rgba(249,115,22,.18);color:#fdba74}

.cla-sep{display:flex;align-items:center;gap:12px;margin:20px 0}
.cla-sepl{flex:1;height:1px;background:var(--brd)}
.cla-sept{font-size:12px;color:var(--mut);font-weight:300;white-space:nowrap}

/* ── Bouton Google pleine largeur ── */
.cla-google-btn{
  width:100%;padding:13px 16px;
  border:1px solid var(--brd);border-radius:12px;
  background:rgba(255,255,255,.03);color:var(--txt);
  font-family:'DM Sans',sans-serif;font-size:14px;font-weight:500;
  cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px;
  transition:all .2s;
}
.cla-google-btn:hover{border-color:rgba(255,255,255,.18);background:rgba(255,255,255,.07);transform:translateY(-1px);}
.cla-google-btn:active{transform:scale(.99);}
.cla-google-btn:disabled{opacity:.5;cursor:not-allowed;}

.cla-foot{text-align:center;margin-top:22px;font-size:12px;color:var(--mut);line-height:1.7}
.cla-foot a{color:var(--ora);text-decoration:none}
.cla-foot a:hover{text-decoration:underline}

.cla-success-screen{text-align:center;padding:12px 0;animation:cl-slide-up .4s cubic-bezier(.22,1,.36,1) both}
.cla-success-icon{width:72px;height:72px;border-radius:20px;background:rgba(249,115,22,.1);border:1px solid rgba(249,115,22,.2);display:flex;align-items:center;justify-content:center;margin:0 auto 22px;}
.cla-success-title{font-family:'Syne',sans-serif;font-size:22px;font-weight:700;color:var(--txt);margin-bottom:8px;letter-spacing:-.02em;}
.cla-success-body{font-size:14px;color:var(--mut);line-height:1.7;margin-bottom:24px;}
.cla-success-email{display:inline-block;background:rgba(249,115,22,.1);border:1px solid rgba(249,115,22,.2);color:#fdba74;border-radius:8px;padding:4px 12px;font-size:13px;font-weight:500;margin:2px 0 0;}

.cla-countdown{font-size:12px;color:var(--mut);margin-top:12px;text-align:center}
.cla-countdown span{color:var(--ora);font-weight:600}
.cla-resend-btn{background:none;border:none;cursor:pointer;color:var(--ora);font-size:13px;font-family:'DM Sans',sans-serif;padding:0;text-decoration:underline;opacity:.85;transition:opacity .15s}
.cla-resend-btn:hover{opacity:1}
.cla-resend-btn:disabled{cursor:not-allowed;opacity:.4;text-decoration:none}

.cla-back{display:flex;align-items:center;gap:6px;background:none;border:none;cursor:pointer;color:var(--mut);font-family:'DM Sans',sans-serif;font-size:13px;padding:0 0 20px;transition:color .15s}
.cla-back:hover{color:var(--txt)}

@media(max-width:440px){.cla-card{padding:32px 22px 28px;border-radius:20px}.cla-title{font-size:23px}}
`;

// ============================================================
// COMPONENT
// ============================================================
export default function AuthPage() {
  const { login, register, loading: authLoading } = useAuth();
  const navigate       = useNavigate();
  const [searchParams] = useSearchParams();

  // "login" | "register" | "forgot" | "forgot-sent"
  const [mode, setMode]         = useState("login");
  const [busy, setBusy]         = useState(false);
  const [alert, setAlert]       = useState(null);
  const [googleBusy, setGoogleBusy] = useState(false);

  // ── Login fields
  const [email, setEmail]       = useState("");
  const [pw, setPw]             = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [remember, setRemember] = useState(true);

  // ── Register fields
  const [name, setName]         = useState("");
  const [rEmail, setREmail]     = useState("");
  const [rPw, setRPw]           = useState("");
  const [showRPw, setShowRPw]   = useState(false);

  // ── Forgot fields
  const [fEmail, setFEmail]     = useState("");
  const [sentTo, setSentTo]     = useState("");
  const [cooldown, setCooldown] = useState(0);

  const emailRef  = useRef(null);
  const nameRef   = useRef(null);
  const fEmailRef = useRef(null);

  // ✅ Affiche les erreurs Google venant de l'URL (?msg=...)
  useEffect(() => {
    const msg = searchParams.get("msg");
    if (msg) setAlert({ t: "err", msg: decodeURIComponent(msg) });
  }, []);

  // Focus auto selon le mode
  useEffect(() => {
    const map = { login: emailRef, register: nameRef, forgot: fEmailRef };
    const el = map[mode]?.current;
    if (el) setTimeout(() => el.focus(), 120);
  }, [mode]);

  // Countdown "renvoyer l'email"
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const clear = useCallback(() => setAlert(null), []);

  // ── Validation
  const emailOk  = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const rEmailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rEmail);
  const fEmailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fEmail);
  const str      = pwStrength(rPw);
  const canLog   = email.length > 3 && pw.length >= 6;
  const canReg   = name.trim().length >= 2 && rEmailOk && rPw.length >= 6;
  const isLoading = busy || authLoading;

  // ── Handlers
  const handleLogin = useCallback(async (e) => {
    e?.preventDefault();
    if (!canLog || isLoading) return;
    setBusy(true); setAlert(null);
    try {
      const res = await login(email.trim().toLowerCase(), pw, remember);
      if (res.success) navigate("/", { replace: true });
      else setAlert({ t: "err", msg: res.message || "Email ou mot de passe incorrect." });
    } catch { setAlert({ t: "err", msg: "Une erreur est survenue." }); }
    finally { setBusy(false); }
  }, [canLog, isLoading, login, email, pw, remember, navigate]);

  const handleReg = useCallback(async (e) => {
    e?.preventDefault();
    if (!canReg || isLoading) return;
    setBusy(true); setAlert(null);
    try {
      const res = await register(name.trim(), rEmail.trim().toLowerCase(), rPw, true);
      if (res.success) navigate("/", { replace: true });
      else setAlert({ t: "err", msg: res.message || "Impossible de créer le compte." });
    } catch { setAlert({ t: "err", msg: "Une erreur est survenue." }); }
    finally { setBusy(false); }
  }, [canReg, isLoading, register, name, rEmail, rPw, navigate]);

  const handleForgot = useCallback(async (e) => {
    e?.preventDefault();
    if (!fEmailOk || isLoading || cooldown > 0) return;
    setBusy(true); setAlert(null);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: fEmail.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (res.status === 429) {
        setAlert({ t: "err", msg: data.message || "Trop de tentatives. Patientez avant de réessayer." });
        return;
      }
      setSentTo(fEmail.trim().toLowerCase());
      setCooldown(120);
      setMode("forgot-sent");
    } catch {
      setAlert({ t: "err", msg: "Une erreur est survenue. Réessayez." });
    } finally {
      setBusy(false);
    }
  }, [fEmailOk, isLoading, cooldown, fEmail]);

  const handleResend = useCallback(async () => {
    if (cooldown > 0 || busy) return;
    setBusy(true);
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: sentTo }),
      });
      setCooldown(120);
      setAlert({ t: "suc", msg: "Email renvoyé ! Vérifiez votre boîte de réception." });
    } catch {
      setAlert({ t: "err", msg: "Impossible de renvoyer l'email." });
    } finally {
      setBusy(false);
    }
  }, [cooldown, busy, sentTo]);

  // ✅ Connexion Google — redirige vers le backend OAuth
  const handleGoogleLogin = useCallback(() => {
    if (googleBusy) return;
    setGoogleBusy(true);
    // Redirige vers le backend qui redirige vers Google
    window.location.href = "/api/auth/google";
  }, [googleBusy]);

  const goTo = (m) => { setMode(m); setAlert(null); };

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <>
      <style>{CSS}</style>
      <div className="cla">
        <div className="cla-card">

          {/* ── Logo ── */}
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

          {/* ══════════════════════════════════════
              MODE : FORGOT-SENT
          ══════════════════════════════════════ */}
          {mode === "forgot-sent" && (
            <div className="cla-success-screen">
              <div className="cla-success-icon"><MailIcon /></div>
              <div className="cla-success-title">Vérifie ta boîte mail 📬</div>
              <div className="cla-success-body">
                Un lien de réinitialisation valable <strong style={{color:"#f97316"}}>15 minutes</strong> a été envoyé à :
                <br/>
                <span className="cla-success-email">{sentTo}</span>
                <br/><br/>
                Si tu ne vois pas l'email, pense à vérifier tes <strong>spams</strong>.
              </div>

              {alert && (
                <div className={`cla-alert ${alert.t}`}>
                  <span style={{flexShrink:0}}>{alert.t==="err"?"⚠":"✓"}</span>
                  <span>{alert.msg}</span>
                </div>
              )}

              <div className="cla-countdown">
                {cooldown > 0 ? (
                  <>Renvoyer l'email dans <span>{cooldown}s</span></>
                ) : (
                  <>
                    Email non reçu ?{" "}
                    <button className="cla-resend-btn" onClick={handleResend} disabled={busy}>
                      {busy ? "Envoi…" : "Renvoyer l'email"}
                    </button>
                  </>
                )}
              </div>

              <button className="cla-btn-ghost" onClick={() => goTo("login")} style={{marginTop:20}}>
                <ArrowLeftIcon /> Retour à la connexion
              </button>
            </div>
          )}

          {/* ══════════════════════════════════════
              MODES : LOGIN / REGISTER / FORGOT
          ══════════════════════════════════════ */}
          {mode !== "forgot-sent" && (
            <>
              <div className="cla-title">
                {mode === "login"    && "Bon retour 👋"}
                {mode === "register" && "Rejoins-nous"}
                {mode === "forgot"   && "Mot de passe oublié ?"}
              </div>
              <div className="cla-sub">
                {mode === "login"    && "Connecte-toi à ton espace professionnel"}
                {mode === "register" && "Crée ton compte en quelques secondes"}
                {mode === "forgot"   && "Saisis ton email pour recevoir un lien de réinitialisation"}
              </div>

              {(mode === "login" || mode === "register") && (
                <div className="cla-tabs">
                  <button className={`cla-tab ${mode==="login"?"on":""}`} onClick={() => goTo("login")}>Connexion</button>
                  <button className={`cla-tab ${mode==="register"?"on":""}`} onClick={() => goTo("register")}>Inscription</button>
                </div>
              )}

              {mode === "forgot" && (
                <button className="cla-back" onClick={() => goTo("login")}>
                  <ArrowLeftIcon /> Retour à la connexion
                </button>
              )}

              {alert && (
                <div className={`cla-alert ${alert.t}`}>
                  <span style={{flexShrink:0}}>{alert.t==="err"?"⚠":"✓"}</span>
                  <span>{alert.msg}</span>
                </div>
              )}

              {/* ── FORM LOGIN ── */}
              {mode === "login" && (
                <form onSubmit={handleLogin} noValidate>
                  <div className="cla-f">
                    <label className="cla-lbl">Email</label>
                    <div className="cla-iw">
                      <input ref={emailRef} type="email" inputMode="email" autoComplete="email"
                        className={`cla-i${emailOk?" ok pr":email.length>3&&!emailOk?" er":""}`}
                        placeholder="prenom@entreprise.com" value={email}
                        onChange={e=>{setEmail(e.target.value);clear();}} disabled={isLoading}/>
                      {emailOk && <span className="cla-ok-badge"><CheckIcon/></span>}
                    </div>
                  </div>

                  <div className="cla-f">
                    <label className="cla-lbl">Mot de passe</label>
                    <div className="cla-iw">
                      <input type={showPw?"text":"password"} autoComplete="current-password"
                        className="cla-i pr" placeholder="••••••••" value={pw}
                        onChange={e=>{setPw(e.target.value);clear();}} disabled={isLoading}/>
                      <button type="button" className="cla-eye" onClick={()=>setShowPw(v=>!v)} tabIndex={-1}><EyeIcon open={showPw}/></button>
                    </div>
                  </div>

                  <div className="cla-row">
                    <label className="cla-rem" onClick={()=>setRemember(v=>!v)}>
                      <div className={`cla-box${remember?" on":""}`}>{remember&&<CheckIcon/>}</div>
                      Se souvenir 90j
                    </label>
                    <button type="button" className="cla-forgot" onClick={() => goTo("forgot")}>
                      Mot de passe oublié ?
                    </button>
                  </div>

                  <button type="submit" className="cla-btn" disabled={!canLog||isLoading}>
                    {isLoading ? <><SpinnerIcon/>Connexion…</> : "Se connecter →"}
                  </button>
                </form>
              )}

              {/* ── FORM REGISTER ── */}
              {mode === "register" && (
                <form onSubmit={handleReg} noValidate>
                  <div className="cla-f">
                    <label className="cla-lbl">Nom complet</label>
                    <div className="cla-iw">
                      <input ref={nameRef} type="text" autoComplete="name"
                        className={`cla-i${name.trim().length>=2?" ok":""}`}
                        placeholder="Jean Kouassi" value={name}
                        onChange={e=>{setName(e.target.value);clear();}} disabled={isLoading}/>
                      {name.trim().length>=2 && <span className="cla-ok-badge"><CheckIcon/></span>}
                    </div>
                  </div>

                  <div className="cla-f">
                    <label className="cla-lbl">Email professionnel</label>
                    <div className="cla-iw">
                      <input type="email" inputMode="email" autoComplete="email"
                        className={`cla-i${rEmailOk?" ok pr":rEmail.length>3&&!rEmailOk?" er":""}`}
                        placeholder="prenom@entreprise.com" value={rEmail}
                        onChange={e=>{setREmail(e.target.value);clear();}} disabled={isLoading}/>
                      {rEmailOk && <span className="cla-ok-badge"><CheckIcon/></span>}
                    </div>
                  </div>

                  <div className="cla-f">
                    <label className="cla-lbl">Mot de passe</label>
                    <div className="cla-iw">
                      <input type={showRPw?"text":"password"} autoComplete="new-password"
                        className="cla-i pr" placeholder="Min. 6 caractères" value={rPw}
                        onChange={e=>{setRPw(e.target.value);clear();}} disabled={isLoading}/>
                      <button type="button" className="cla-eye" onClick={()=>setShowRPw(v=>!v)} tabIndex={-1}><EyeIcon open={showRPw}/></button>
                    </div>
                    {rPw.length > 0 && (
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

                  <button type="submit" className="cla-btn" disabled={!canReg||isLoading} style={{marginTop:6}}>
                    {isLoading ? <><SpinnerIcon/>Création…</> : "Créer mon compte →"}
                  </button>
                </form>
              )}

              {/* ── FORM FORGOT PASSWORD ── */}
              {mode === "forgot" && (
                <form onSubmit={handleForgot} noValidate>
                  <div className="cla-f">
                    <label className="cla-lbl">Ton email</label>
                    <div className="cla-iw">
                      <input
                        ref={fEmailRef}
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        className={`cla-i${fEmailOk?" ok pr":fEmail.length>3&&!fEmailOk?" er":""}`}
                        placeholder="prenom@entreprise.com"
                        value={fEmail}
                        onChange={e=>{setFEmail(e.target.value);clear();}}
                        disabled={isLoading}
                      />
                      {fEmailOk && <span className="cla-ok-badge"><CheckIcon/></span>}
                    </div>
                  </div>

                  <div style={{
                    background:"rgba(249,115,22,.06)",
                    border:"1px solid rgba(249,115,22,.14)",
                    borderRadius:10,
                    padding:"10px 13px",
                    fontSize:12.5,
                    color:"#a0a0b0",
                    marginBottom:16,
                    lineHeight:1.6
                  }}>
                    💡 Si un compte existe avec cet email, tu recevras un lien valable <strong style={{color:"#f97316"}}>15 minutes</strong>.
                  </div>

                  <button
                    type="submit"
                    className="cla-btn"
                    disabled={!fEmailOk || isLoading || cooldown > 0}
                  >
                    {isLoading
                      ? <><SpinnerIcon/>Envoi en cours…</>
                      : cooldown > 0
                        ? `Réessayer dans ${cooldown}s`
                        : "Envoyer le lien →"
                    }
                  </button>
                </form>
              )}

              {/* ── SÉPARATEUR + GOOGLE — seulement pour login/register ── */}
              {(mode === "login" || mode === "register") && (
                <>
                  <div className="cla-sep">
                    <div className="cla-sepl"/>
                    <span className="cla-sept">ou continuer avec</span>
                    <div className="cla-sepl"/>
                  </div>

                  {/* ✅ Bouton Google pleine largeur */}
                  <button
                    className="cla-google-btn"
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={googleBusy || isLoading}
                  >
                    {googleBusy
                      ? <><SpinnerIcon /> Redirection…</>
                      : <><GoogleIcon /> Continuer avec Google</>
                    }
                  </button>
                </>
              )}

              <div className="cla-foot">
                En continuant tu acceptes nos <a href="#">CGU</a> et notre <a href="#">Politique de confidentialité</a>.
              </div>
            </>
          )}

        </div>
      </div>
    </>
  );
}