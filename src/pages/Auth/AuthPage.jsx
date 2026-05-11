// src/pages/Auth/AuthPage.jsx
// ✅ VERSION PERSISTANCE MONDIALE
//
// AMÉLIORATIONS vs ancienne version :
//   - Shimmer loader tant que sessionLoading = true (jamais de flash login)
//   - Redirect immédiat si isAuthenticated (via IDB ou token)
//   - Le formulaire login n'est JAMAIS rendu pour un user déjà connu

import React, { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate, useSearchParams, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { SUPPORTED_LANGUAGES } from "../../i18n";

// ─────────────────────────────────────────────
// ICONS
// ─────────────────────────────────────────────
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
const GlobeIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
  </svg>
);

// ─────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────
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

// ─────────────────────────────────────────────
// HERO SLIDES
// ─────────────────────────────────────────────
const SLIDES = [
  {
    img: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=1400&q=80&fit=crop",
    tag: "Gros œuvre",
    headline: "Pilotez vos chantiers\nà la vitesse\ndu terrain.",
    sub: "La plateforme tout-en-un pour les professionnels du BTP.",
  },
  {
    img: "https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=1400&q=80&fit=crop",
    tag: "Infrastructure",
    headline: "Coordonnez\nchaque équipe\nsur le terrain.",
    sub: "Chefs de chantier, conducteurs de travaux et sous-traitants connectés.",
  },
  {
    img: "https://images.unsplash.com/photo-1590856029826-c7a73142bbf1?w=1400&q=80&fit=crop",
    tag: "Bâtiment",
    headline: "Documents,\nplans et rapports\ncentralisés.",
    sub: "Accédez à tous vos fichiers depuis n'importe quel appareil.",
  },
  {
    img: "https://images.unsplash.com/photo-1513828583688-c52646db42da?w=1400&q=80&fit=crop",
    tag: "Travaux routiers",
    headline: "Suivi en\ntemps réel,\nzéro surprise.",
    sub: "Tableaux de bord live et alertes automatiques pour rester en contrôle.",
  },
];

const STATS = [
  { value: "2 400+", label: "Chantiers gérés" },
  { value: "98 %",  label: "Satisfaction client" },
  { value: "3×",    label: "Gain de productivité" },
];

// ─────────────────────────────────────────────
// CSS
// ─────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap');

@keyframes cl-spin     { to { transform:rotate(360deg); } }
@keyframes cl-in       { from{opacity:0;transform:translateY(18px) scale(.97)} to{opacity:1;transform:none} }
@keyframes cl-fade     { from{opacity:0;transform:translateY(-5px)} to{opacity:1;transform:none} }
@keyframes cl-slide-up { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:none} }
@keyframes cl-hero-in  { from{opacity:0;transform:translateX(-24px)} to{opacity:1;transform:none} }

/* ── Shimmer skeleton ── */
@keyframes cl-shimmer {
  0%   { background-position: -400px 0; }
  100% { background-position:  400px 0; }
}
.cl-shimmer {
  background: linear-gradient(90deg,
    rgba(255,255,255,.04) 25%,
    rgba(255,255,255,.08) 50%,
    rgba(255,255,255,.04) 75%
  );
  background-size: 400px 100%;
  animation: cl-shimmer 1.4s ease-in-out infinite;
  border-radius: 12px;
}

/* ── Loader plein écran ── */
.cl-session-loader {
  position: fixed;
  inset: 0;
  background: #09090b;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  flex-direction: column;
  gap: 20px;
}
.cl-loader-logo {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
  animation: cl-in .4s cubic-bezier(.22,1,.36,1) both;
}
.cl-loader-logo-box {
  width: 48px; height: 48px; border-radius: 14px;
  background: linear-gradient(135deg, #f97316, #ec4899);
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 8px 24px rgba(249,115,22,.4);
}
.cl-loader-logo-text {
  font-family: 'Syne', sans-serif;
  font-size: 24px; font-weight: 800; letter-spacing: -.04em; color: #fff;
}
.cl-loader-logo-text b { color: #f97316; }
.cl-loader-bar-wrap {
  width: 180px; height: 3px; background: rgba(255,255,255,.08);
  border-radius: 2px; overflow: hidden;
}
.cl-loader-bar {
  height: 100%;
  background: linear-gradient(90deg, #f97316, #ec4899);
  border-radius: 2px;
  animation: cl-bar-fill 1.8s cubic-bezier(.4,0,.2,1) forwards;
}
@keyframes cl-bar-fill {
  0%   { width: 0%; opacity: 1; }
  80%  { width: 85%; opacity: 1; }
  100% { width: 85%; opacity: .7; }
}
.cl-loader-hint {
  font-family: 'DM Sans', sans-serif;
  font-size: 12px; color: rgba(255,255,255,.25);
  letter-spacing: .04em;
}

/* ── ROOT ── */
.cla {
  --bg:#09090b; --surf:#111115; --brd:rgba(255,255,255,.07);
  --ora:#f97316; --pnk:#ec4899; --txt:#f0f0f0; --mut:#5c5c6e;
  --err:#f87171; --ok:#34d399;
  font-family:'DM Sans',system-ui,sans-serif;
  min-height:100dvh;
  background:var(--bg);
  display:flex;
  align-items:stretch;
}

/* ── HERO ── */
.cla-hero {
  display:none;
  flex:1;
  position:relative;
  overflow:hidden;
  background:#0a0806;
}
.cla-slide {
  position:absolute;inset:0;
  background-size:cover;background-position:center;
  opacity:0;
  transition:opacity 1.2s cubic-bezier(.4,0,.2,1),transform 8s linear;
  transform:scale(1.05);
}
.cla-slide.active { opacity:1; transform:scale(1); }
.cla-slide-overlay {
  position:absolute;inset:0;
  background:
    linear-gradient(to right,rgba(0,0,0,.72) 0%,rgba(0,0,0,.4) 60%,rgba(0,0,0,.15) 100%),
    linear-gradient(to top,rgba(0,0,0,.85) 0%,transparent 50%);
}
.cla-hero-inner {
  position:relative;z-index:2;
  height:100%;
  display:flex;flex-direction:column;
  justify-content:space-between;
  padding:44px 52px 40px;
}
.cla-hero-logo {
  display:flex;align-items:center;gap:12px;
  animation:cl-hero-in .6s cubic-bezier(.22,1,.36,1) both;
}
.cla-hero-logo-box {
  width:44px;height:44px;border-radius:13px;
  background:linear-gradient(135deg,#f97316,#ec4899);
  display:flex;align-items:center;justify-content:center;
  box-shadow:0 6px 22px rgba(249,115,22,.5);flex-shrink:0;
}
.cla-hero-logo-text {
  font-family:'Syne',sans-serif;font-size:21px;font-weight:800;
  letter-spacing:-.03em;color:#fff;text-shadow:0 2px 12px rgba(0,0,0,.5);
}
.cla-hero-logo-text b { color:#f97316; }
.cla-hero-body {
  flex:1;display:flex;flex-direction:column;justify-content:flex-end;
  padding-bottom:16px;
}
.cla-hero-tag {
  display:inline-flex;align-items:center;gap:7px;
  font-size:10.5px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;
  color:#f97316;margin-bottom:16px;
}
.cla-hero-tag-line { width:24px;height:1.5px;background:#f97316;display:block; }
.cla-hero-h1 {
  font-family:'Syne',sans-serif;
  font-size:clamp(34px,3.6vw,54px);
  font-weight:800;line-height:1.08;letter-spacing:-.04em;
  color:#fff;margin-bottom:16px;white-space:pre-line;
  text-shadow:0 4px 24px rgba(0,0,0,.4);
}
.cla-hero-h1 em {
  font-style:normal;
  background:linear-gradient(90deg,#f97316,#ec4899);
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;
}
.cla-hero-sub {
  font-size:14.5px;font-weight:300;color:rgba(255,255,255,.65);
  line-height:1.65;max-width:400px;margin-bottom:32px;
}
.cla-stats { display:flex;gap:0;border-top:1px solid rgba(255,255,255,.1);padding-top:24px; }
.cla-stat { flex:1;border-right:1px solid rgba(255,255,255,.08); }
.cla-stat:last-child { border-right:none; }
.cla-stat:not(:first-child) { padding-left:26px; }
.cla-stat-val {
  font-family:'Syne',sans-serif;font-size:24px;font-weight:800;
  color:#fff;letter-spacing:-.04em;margin-bottom:2px;
}
.cla-stat-lbl { font-size:11px;font-weight:400;color:rgba(255,255,255,.4); }
.cla-dots { display:flex;gap:7px;align-items:center;margin-bottom:28px; }
.cla-dot {
  height:3px;border-radius:2px;background:rgba(255,255,255,.3);
  cursor:pointer;transition:all .4s cubic-bezier(.4,0,.2,1);
  border:none;padding:0;
}
.cla-dot.active { background:#f97316;width:28px; }
.cla-dot:not(.active) { width:8px; }
.cla-progress {
  position:absolute;bottom:0;left:0;height:2px;
  background:linear-gradient(90deg,#f97316,#ec4899);
  animation:cl-progress 5s linear forwards;
}
@keyframes cl-progress { from{width:0%} to{width:100%} }

/* ── PANEL ── */
.cla-panel {
  width:100%;
  min-height:100dvh;
  background:var(--bg);
  display:flex;align-items:center;justify-content:center;
  padding:24px;
  position:relative;overflow:hidden;
}
.cla-panel::before {
  content:'';position:absolute;width:600px;height:600px;
  top:-220px;left:-200px;
  background:radial-gradient(circle,rgba(249,115,22,.07) 0%,transparent 65%);
  pointer-events:none;
}
.cla-panel::after {
  content:'';position:absolute;width:500px;height:500px;
  bottom:-180px;right:-180px;
  background:radial-gradient(circle,rgba(236,72,153,.05) 0%,transparent 65%);
  pointer-events:none;
}
.cla-card {
  width:100%;max-width:416px;
  background:var(--surf);
  border:1px solid var(--brd);
  border-radius:26px;padding:42px 38px 38px;
  position:relative;z-index:1;
  box-shadow:0 0 0 1px rgba(255,255,255,.02),0 40px 100px rgba(0,0,0,.65);
  animation:cl-in .38s cubic-bezier(.22,1,.36,1) both;
}
.cla-card::before {
  content:'';position:absolute;inset:0;border-radius:inherit;
  background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.03'/%3E%3C/svg%3E");
  pointer-events:none;opacity:.4;
}
.cla-card-logo { display:flex;align-items:center;gap:11px;margin-bottom:26px; }
.cla-card-logo-box {
  width:40px;height:40px;border-radius:12px;flex-shrink:0;
  background:linear-gradient(135deg,#f97316,#ec4899);
  display:flex;align-items:center;justify-content:center;
  box-shadow:0 6px 20px rgba(249,115,22,.36);
}
.cla-card-logo-text {
  font-family:'Syne',sans-serif;font-size:20px;font-weight:800;
  letter-spacing:-.03em;color:var(--txt);
}
.cla-card-logo-text b { color:var(--ora);font-weight:800; }

/* ── FORM ── */
.cla-title  { font-family:'Syne',sans-serif;font-size:26px;font-weight:700;letter-spacing:-.03em;color:var(--txt);margin-bottom:3px;line-height:1.18; }
.cla-sub    { font-size:13.5px;color:var(--mut);margin-bottom:24px;font-weight:300; }
.cla-tabs   { display:flex;gap:0;background:rgba(255,255,255,.04);border-radius:13px;padding:4px;margin-bottom:24px; }
.cla-tab    { flex:1;padding:9px;border:none;background:none;cursor:pointer;font-family:'DM Sans',sans-serif;font-size:13.5px;font-weight:500;color:var(--mut);border-radius:10px;transition:all .2s; }
.cla-tab.on { background:rgba(249,115,22,.14);color:var(--ora);font-weight:600; }
.cla-f    { margin-bottom:13px; }
.cla-lbl  { display:block;font-size:11.5px;font-weight:500;color:var(--mut);letter-spacing:.07em;text-transform:uppercase;margin-bottom:6px; }
.cla-iw   { position:relative; }
.cla-i    {
  width:100%;padding:13px 16px;
  background:rgba(255,255,255,.04);border:1px solid var(--brd);
  border-radius:12px;color:var(--txt);
  font-family:'DM Sans',sans-serif;font-size:15px;font-weight:400;
  outline:none;transition:border-color .2s,box-shadow .2s,background .2s;
  -webkit-appearance:none;box-sizing:border-box;
}
.cla-i::placeholder { color:#2d2d3a; }
.cla-i:focus { border-color:rgba(249,115,22,.5);background:rgba(249,115,22,.03);box-shadow:0 0 0 3px rgba(249,115,22,.07); }
.cla-i.pr  { padding-right:46px; }
.cla-i.ok  { border-color:rgba(52,211,153,.35); }
.cla-i.er  { border-color:rgba(248,113,113,.45); }
.cla-eye { position:absolute;right:13px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--mut);display:flex;align-items:center;padding:0;transition:color .15s; }
.cla-eye:hover { color:var(--txt); }
.cla-ok-badge { position:absolute;right:13px;top:50%;transform:translateY(-50%);color:var(--ok);display:flex;align-items:center; }
.cla-lang-select {
  width:100%;padding:11px 16px;
  background:rgba(255,255,255,.04);border:1px solid var(--brd);
  border-radius:12px;color:var(--txt);
  font-family:'DM Sans',sans-serif;font-size:14px;font-weight:400;
  outline:none;cursor:pointer;transition:border-color .2s,box-shadow .2s;
  appearance:none;-webkit-appearance:none;
  background-image:url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L6 7L11 1' stroke='%235c5c6e' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat:no-repeat;background-position:right 14px center;padding-right:36px;
}
.cla-lang-select:focus { border-color:rgba(249,115,22,.5);box-shadow:0 0 0 3px rgba(249,115,22,.07); }
.cla-lang-select option { background:#111115;color:#f0f0f0; }
.cla-lang-iw   { position:relative;display:flex;align-items:center; }
.cla-lang-icon { position:absolute;left:12px;color:var(--mut);pointer-events:none;display:flex; }
.cla-lang-select.with-icon { padding-left:36px; }
.cla-lang-pills { display:flex;gap:6px;margin-bottom:20px; }
.cla-lang-pill  {
  flex:1;padding:7px 6px;border:1px solid var(--brd);border-radius:9px;
  background:rgba(255,255,255,.03);color:var(--mut);
  font-family:'DM Sans',sans-serif;font-size:12px;font-weight:500;
  cursor:pointer;text-align:center;transition:all .18s;
  display:flex;align-items:center;justify-content:center;gap:4px;
}
.cla-lang-pill.on { border-color:rgba(249,115,22,.4);background:rgba(249,115,22,.1);color:var(--ora); }
.cla-lang-pill:hover:not(.on) { border-color:rgba(255,255,255,.13);background:rgba(255,255,255,.05);color:var(--txt); }
.cla-bars { display:flex;gap:4px;margin-top:7px; }
.cla-bar  { flex:1;height:3px;border-radius:2px;background:rgba(255,255,255,.07);transition:background .3s; }
.cla-hint { font-size:11.5px;margin-top:4px;font-weight:300; }
.cla-row    { display:flex;align-items:center;justify-content:space-between;margin-bottom:20px; }
.cla-rem    { display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;color:var(--mut);user-select:none; }
.cla-box    { width:16px;height:16px;border:1.5px solid rgba(255,255,255,.13);border-radius:5px;display:flex;align-items:center;justify-content:center;background:transparent;transition:all .15s;flex-shrink:0; }
.cla-box.on { background:var(--ora);border-color:var(--ora);color:#fff; }
.cla-forgot { font-size:13px;color:var(--ora);background:none;border:none;cursor:pointer;padding:0;font-family:'DM Sans',sans-serif;opacity:.82;transition:opacity .15s; }
.cla-forgot:hover { opacity:1;text-decoration:underline; }
.cla-btn {
  width:100%;padding:14px;border:none;border-radius:14px;
  font-family:'Syne',sans-serif;font-size:15px;font-weight:700;letter-spacing:.01em;
  cursor:pointer;position:relative;overflow:hidden;
  transition:transform .15s,box-shadow .15s,opacity .15s;
  background:linear-gradient(135deg,#f97316,#ec4899);color:#fff;
  box-shadow:0 4px 22px rgba(249,115,22,.3);
  display:flex;align-items:center;justify-content:center;gap:8px;
}
.cla-btn:hover:not(:disabled)  { transform:translateY(-2px);box-shadow:0 10px 32px rgba(249,115,22,.42); }
.cla-btn:active:not(:disabled) { transform:scale(.99); }
.cla-btn:disabled               { opacity:.5;cursor:not-allowed; }
.cla-btn::after { content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,255,255,.13),transparent);opacity:0;transition:opacity .2s; }
.cla-btn:hover::after { opacity:1; }
.cla-btn-ghost {
  width:100%;padding:12px;border:1px solid var(--brd);border-radius:14px;
  font-family:'DM Sans',sans-serif;font-size:14px;font-weight:500;
  cursor:pointer;background:rgba(255,255,255,.03);color:var(--mut);
  display:flex;align-items:center;justify-content:center;gap:7px;
  transition:all .2s;margin-top:10px;
}
.cla-btn-ghost:hover { border-color:rgba(255,255,255,.13);background:rgba(255,255,255,.06);color:var(--txt); }
.cla-alert { padding:11px 14px;border-radius:10px;font-size:13.5px;margin-bottom:14px;display:flex;align-items:flex-start;gap:8px;animation:cl-fade .22s ease; }
.cla-alert.err { background:rgba(248,113,113,.1);border:1px solid rgba(248,113,113,.18);color:#fca5a5; }
.cla-alert.suc { background:rgba(52,211,153,.1);border:1px solid rgba(52,211,153,.18);color:#6ee7b7; }
.cla-alert.inf { background:rgba(249,115,22,.08);border:1px solid rgba(249,115,22,.18);color:#fdba74; }
.cla-sep  { display:flex;align-items:center;gap:12px;margin:20px 0; }
.cla-sepl { flex:1;height:1px;background:var(--brd); }
.cla-sept { font-size:12px;color:var(--mut);font-weight:300;white-space:nowrap; }
.cla-google-btn {
  width:100%;padding:13px 16px;
  border:1px solid var(--brd);border-radius:12px;
  background:rgba(255,255,255,.03);color:var(--txt);
  font-family:'DM Sans',sans-serif;font-size:14px;font-weight:500;
  cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px;
  transition:all .2s;
}
.cla-google-btn:hover    { border-color:rgba(255,255,255,.18);background:rgba(255,255,255,.07);transform:translateY(-1px); }
.cla-google-btn:disabled { opacity:.5;cursor:not-allowed; }
.cla-foot { text-align:center;margin-top:22px;font-size:12px;color:var(--mut);line-height:1.7; }
.cla-foot a { color:var(--ora);text-decoration:none; }
.cla-foot a:hover { text-decoration:underline; }
.cla-success-screen { text-align:center;padding:12px 0;animation:cl-slide-up .4s cubic-bezier(.22,1,.36,1) both; }
.cla-success-icon   { width:72px;height:72px;border-radius:20px;background:rgba(249,115,22,.1);border:1px solid rgba(249,115,22,.2);display:flex;align-items:center;justify-content:center;margin:0 auto 22px; }
.cla-success-title  { font-family:'Syne',sans-serif;font-size:22px;font-weight:700;color:var(--txt);margin-bottom:8px;letter-spacing:-.02em; }
.cla-success-body   { font-size:14px;color:var(--mut);line-height:1.7;margin-bottom:24px; }
.cla-success-email  { display:inline-block;background:rgba(249,115,22,.1);border:1px solid rgba(249,115,22,.2);color:#fdba74;border-radius:8px;padding:4px 12px;font-size:13px;font-weight:500;margin:2px 0 0; }
.cla-countdown { font-size:12px;color:var(--mut);margin-top:12px;text-align:center; }
.cla-countdown span { color:var(--ora);font-weight:600; }
.cla-resend-btn { background:none;border:none;cursor:pointer;color:var(--ora);font-size:13px;font-family:'DM Sans',sans-serif;padding:0;text-decoration:underline;opacity:.85;transition:opacity .15s; }
.cla-resend-btn:hover    { opacity:1; }
.cla-resend-btn:disabled { cursor:not-allowed;opacity:.4;text-decoration:none; }
.cla-back { display:flex;align-items:center;gap:6px;background:none;border:none;cursor:pointer;color:var(--mut);font-family:'DM Sans',sans-serif;font-size:13px;padding:0 0 20px;transition:color .15s; }
.cla-back:hover { color:var(--txt); }

/* ── RESPONSIVE ── */
@media(min-width:900px){
  .cla-hero  { display:flex; }
  .cla-panel { width:480px;flex-shrink:0;min-height:100dvh; }
  .cla-card-logo { display:none; }
}
@media(max-width:899px){
  .cla-panel { padding:20px; }
}
@media(min-width:1200px){
  .cla-panel { width:520px; }
}
@media(max-width:440px){
  .cla-card { padding:32px 22px 28px;border-radius:20px; }
  .cla-title { font-size:23px; }
}
`;

// ─────────────────────────────────────────────
// ✅ SHIMMER LOADER — affiché pendant la vérification de session
// Remplace l'ancien spinner basique. Donne une impression de vitesse.
// ─────────────────────────────────────────────
const SessionLoader = () => (
  <>
    <style>{CSS}</style>
    <div className="cl-session-loader">
      <div className="cl-loader-logo">
        <div className="cl-loader-logo-box">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="7" width="9" height="15"/>
            <path d="M16 3h5v19h-5"/>
            <path d="M5 10h3M5 14h3M5 18h3M16 8h2M16 12h2M16 16h2"/>
          </svg>
        </div>
        <div className="cl-loader-logo-text">CHANTI<b>LINK</b></div>
      </div>
      <div className="cl-loader-bar-wrap">
        <div className="cl-loader-bar" />
      </div>
      <div className="cl-loader-hint">Chargement de votre session…</div>
    </div>
  </>
);

// ─────────────────────────────────────────────
// PAGE PRINCIPALE
// ─────────────────────────────────────────────
export default function AuthPage() {
  const { t, i18n }                = useTranslation();
  const { login, register, loading: authLoading, isAuthenticated, sessionLoading } = useAuth();
  const { language, changeLanguage } = useLanguage();
  const navigate                   = useNavigate();
  const [searchParams]             = useSearchParams();

  const [mode, setMode]         = useState("login");
  const [busy, setBusy]         = useState(false);
  const [alert, setAlert]       = useState(null);
  const [googleBusy, setGoogleBusy] = useState(false);

  const [email, setEmail]       = useState(() => localStorage.getItem("cl_last_email") || "");
  const [pw, setPw]             = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [remember, setRemember] = useState(true);

  const [name, setName]         = useState("");
  const [rEmail, setREmail]     = useState("");
  const [rPw, setRPw]           = useState("");
  const [showRPw, setShowRPw]   = useState(false);
  const [regLang, setRegLang]   = useState(language);

  const [fEmail, setFEmail]     = useState("");
  const [sentTo, setSentTo]     = useState("");
  const [cooldown, setCooldown] = useState(0);

  const [slide, setSlide]       = useState(0);
  const [slideKey, setSlideKey] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setSlide(s => (s + 1) % SLIDES.length);
      setSlideKey(k => k + 1);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const goSlide = (i) => { setSlide(i); setSlideKey(k => k + 1); };
  const current = SLIDES[slide];

  const emailRef  = useRef(null);
  const nameRef   = useRef(null);
  const fEmailRef = useRef(null);

  useEffect(() => { setRegLang(language); }, [language]);

  useEffect(() => {
    const msg = searchParams.get("msg");
    if (msg) setAlert({ t: "err", msg: decodeURIComponent(msg) });
  }, []);

  useEffect(() => {
    const map = { login: emailRef, register: nameRef, forgot: fEmailRef };
    const el = map[mode]?.current;
    if (el) setTimeout(() => el.focus(), 120);
  }, [mode]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  // ✅ GARDE PRINCIPALE — jamais de flash de formulaire
  // Phase 1 : sessionLoading = true → shimmer loader
  // Phase 2 : isAuthenticated = true → redirect immédiate
  // Phase 3 : sessionLoading = false && !isAuthenticated → formulaire
  if (sessionLoading) return <SessionLoader />;
  if (isAuthenticated) return <Navigate to="/" replace />;

  const clear = () => setAlert(null);

  const emailOk  = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const rEmailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rEmail);
  const fEmailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fEmail);
  const str      = pwStrength(rPw);
  const S_LABELS = [
    "", t("auth.pw_strength.weak"), t("auth.pw_strength.medium"),
    t("auth.pw_strength.good"), t("auth.pw_strength.strong"),
  ];
  const canLog    = email.length > 3 && pw.length >= 6;
  const canReg    = name.trim().length >= 2 && rEmailOk && rPw.length >= 6;
  const isLoading = busy || authLoading;

  const handleLogin = async (e) => {
    e?.preventDefault();
    if (!canLog || isLoading) return;
    setBusy(true); setAlert(null);
    try {
      const res = await login(email.trim().toLowerCase(), pw, remember);
      if (res.success) {
        navigate("/", { replace: true });
      } else {
        setAlert({ t: "err", msg: res.message || t("auth.login.error_default") });
      }
    } catch { setAlert({ t: "err", msg: t("auth.login.error_generic") }); }
    finally  { setBusy(false); }
  };

  const handleReg = async (e) => {
    e?.preventDefault();
    if (!canReg || isLoading) return;
    setBusy(true); setAlert(null);
    try {
      const res = await register(name.trim(), rEmail.trim().toLowerCase(), rPw, true, regLang);
      if (res.success) {
        navigate("/", { replace: true });
      } else {
        setAlert({ t: "err", msg: res.message || t("auth.register.error_default") });
      }
    } catch { setAlert({ t: "err", msg: t("auth.register.error_generic") }); }
    finally  { setBusy(false); }
  };

  const handleForgot = async (e) => {
    e?.preventDefault();
    if (!fEmailOk || isLoading || cooldown > 0) return;
    setBusy(true); setAlert(null);
    try {
      const res  = await fetch("/api/auth/forgot-password", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ email: fEmail.trim().toLowerCase() }) });
      const data = await res.json();
      if (res.status === 429) { setAlert({ t:"err", msg: data.message || t("auth.forgot.error_spam") }); return; }
      setSentTo(fEmail.trim().toLowerCase());
      setCooldown(120);
      setMode("forgot-sent");
    } catch { setAlert({ t:"err", msg: t("auth.forgot.error_generic") }); }
    finally  { setBusy(false); }
  };

  const handleResend = async () => {
    if (cooldown > 0 || busy) return;
    setBusy(true);
    try {
      await fetch("/api/auth/forgot-password", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ email: sentTo }) });
      setCooldown(120);
      setAlert({ t:"suc", msg: t("auth.forgot_sent.resend_success") });
    } catch { setAlert({ t:"err", msg: t("auth.forgot_sent.resend_error") }); }
    finally  { setBusy(false); }
  };

  const handleGoogleLogin = () => {
    if (googleBusy) return;
    setGoogleBusy(true);
    window.location.href = "/api/auth/google";
  };

  const handleLangChange = (langCode) => {
    changeLanguage(langCode, { sync: false });
    if (mode === "register") setRegLang(langCode);
  };

  const goTo = (m) => { setMode(m); setAlert(null); };

  return (
    <>
      <style>{CSS}</style>
      <div className="cla">

        {/* HERO CARROUSEL */}
        <div className="cla-hero">
          {SLIDES.map((s, i) => (
            <div key={i} className={`cla-slide${i === slide ? " active" : ""}`}
              style={{ backgroundImage: `url(${s.img})` }}>
              <div className="cla-slide-overlay"/>
            </div>
          ))}
          <div key={slideKey} className="cla-progress"/>
          <div className="cla-hero-inner">
            <div className="cla-hero-logo">
              <div className="cla-hero-logo-box">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="7" width="9" height="15"/><path d="M16 3h5v19h-5"/>
                  <path d="M5 10h3M5 14h3M5 18h3M16 8h2M16 12h2M16 16h2"/>
                </svg>
              </div>
              <div className="cla-hero-logo-text">CHANTI<b>LINK</b></div>
            </div>
            <div className="cla-hero-body">
              <div className="cla-hero-tag">
                <span className="cla-hero-tag-line"/>
                {current.tag}
              </div>
              <h1 className="cla-hero-h1">
                {current.headline.split("\n").map((line, i, arr) =>
                  i === 1
                    ? <span key={i}><em>{line}</em>{i < arr.length - 1 ? "\n" : ""}</span>
                    : <span key={i}>{line}{i < arr.length - 1 ? "\n" : ""}</span>
                )}
              </h1>
              <p className="cla-hero-sub">{current.sub}</p>
              <div className="cla-dots">
                {SLIDES.map((_, i) => (
                  <button key={i} className={`cla-dot${i === slide ? " active" : ""}`} onClick={() => goSlide(i)} />
                ))}
              </div>
              <div className="cla-stats">
                {STATS.map((s, i) => (
                  <div className="cla-stat" key={i}>
                    <div className="cla-stat-val">{s.value}</div>
                    <div className="cla-stat-lbl">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* FORMULAIRE */}
        <div className="cla-panel">
          <div className="cla-card">

            <div className="cla-card-logo">
              <div className="cla-card-logo-box">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="7" width="9" height="15"/><path d="M16 3h5v19h-5"/>
                  <path d="M5 10h3M5 14h3M5 18h3M16 8h2M16 12h2M16 16h2"/>
                </svg>
              </div>
              <div className="cla-card-logo-text">CHANTI<b>LINK</b></div>
            </div>

            <div className="cla-lang-pills">
              {SUPPORTED_LANGUAGES.map((lang) => (
                <button key={lang.code} type="button"
                  className={`cla-lang-pill${i18n.language === lang.code ? " on" : ""}`}
                  onClick={() => handleLangChange(lang.code)}>
                  <span>{lang.flag}</span><span>{lang.label}</span>
                </button>
              ))}
            </div>

            {/* FORGOT SENT */}
            {mode === "forgot-sent" && (
              <div className="cla-success-screen">
                <div className="cla-success-icon"><MailIcon /></div>
                <div className="cla-success-title">{t("auth.forgot_sent.title")}</div>
                <div className="cla-success-body">
                  {t("auth.forgot_sent.body_1")}{" "}
                  <strong style={{color:"#f97316"}}>{t("auth.forgot_sent.body_duration")}</strong>{" "}
                  {t("auth.forgot_sent.body_2")}
                  <br/><span className="cla-success-email">{sentTo}</span>
                  <br/><br/>
                  {t("auth.forgot_sent.spam_hint")} <strong>{t("auth.forgot_sent.spam_word")}</strong>.
                </div>
                {alert && (
                  <div className={`cla-alert ${alert.t}`}>
                    <span style={{flexShrink:0}}>{alert.t==="err"?"⚠":"✓"}</span>
                    <span>{alert.msg}</span>
                  </div>
                )}
                <div className="cla-countdown">
                  {cooldown > 0 ? (
                    <>{t("auth.forgot_sent.countdown", { count: cooldown }).replace("{{count}}", cooldown)}</>
                  ) : (
                    <>
                      {t("auth.forgot_sent.not_received")}{" "}
                      <button className="cla-resend-btn" onClick={handleResend} disabled={busy}>
                        {busy ? t("auth.forgot_sent.resending") : t("auth.forgot_sent.resend")}
                      </button>
                    </>
                  )}
                </div>
                <button className="cla-btn-ghost" onClick={() => goTo("login")} style={{marginTop:20}}>
                  <ArrowLeftIcon /> {t("auth.forgot_sent.back_login")}
                </button>
              </div>
            )}

            {mode !== "forgot-sent" && (
              <>
                <div className="cla-title">
                  {mode === "login"    && t("auth.login.title")}
                  {mode === "register" && t("auth.register.title")}
                  {mode === "forgot"   && t("auth.forgot.title")}
                </div>
                <div className="cla-sub">
                  {mode === "login"    && t("auth.login.subtitle")}
                  {mode === "register" && t("auth.register.subtitle")}
                  {mode === "forgot"   && t("auth.forgot.subtitle")}
                </div>

                {(mode === "login" || mode === "register") && (
                  <div className="cla-tabs">
                    <button className={`cla-tab ${mode==="login"?"on":""}`} onClick={() => goTo("login")}>{t("auth.login.tab")}</button>
                    <button className={`cla-tab ${mode==="register"?"on":""}`} onClick={() => goTo("register")}>{t("auth.register.tab")}</button>
                  </div>
                )}

                {mode === "forgot" && (
                  <button className="cla-back" onClick={() => goTo("login")}>
                    <ArrowLeftIcon /> {t("auth.forgot.back")}
                  </button>
                )}

                {alert && (
                  <div className={`cla-alert ${alert.t}`}>
                    <span style={{flexShrink:0}}>{alert.t==="err"?"⚠":"✓"}</span>
                    <span>{alert.msg}</span>
                  </div>
                )}

                {/* LOGIN */}
                {mode === "login" && (
                  <form onSubmit={handleLogin} noValidate>
                    <div className="cla-f">
                      <label className="cla-lbl">{t("auth.login.email")}</label>
                      <div className="cla-iw">
                        <input ref={emailRef} type="email" inputMode="email" autoComplete="email"
                          className={`cla-i${emailOk?" ok pr":email.length>3&&!emailOk?" er":""}`}
                          placeholder="prenom@entreprise.com"
                          value={email} onChange={e=>{setEmail(e.target.value);clear();}} disabled={isLoading}/>
                        {emailOk && <span className="cla-ok-badge"><CheckIcon/></span>}
                      </div>
                    </div>
                    <div className="cla-f">
                      <label className="cla-lbl">{t("auth.login.password")}</label>
                      <div className="cla-iw">
                        <input type={showPw?"text":"password"} autoComplete="current-password"
                          className="cla-i pr" placeholder="••••••••"
                          value={pw} onChange={e=>{setPw(e.target.value);clear();}} disabled={isLoading}/>
                        <button type="button" className="cla-eye" onClick={()=>setShowPw(v=>!v)} tabIndex={-1}><EyeIcon open={showPw}/></button>
                      </div>
                    </div>
                    <div className="cla-row">
                      <label className="cla-rem" onClick={()=>setRemember(v=>!v)}>
                        <div className={`cla-box${remember?" on":""}`}>{remember&&<CheckIcon/>}</div>
                        {t("auth.login.remember")}
                      </label>
                      <button type="button" className="cla-forgot" onClick={() => goTo("forgot")}>{t("auth.login.forgot")}</button>
                    </div>
                    <button type="submit" className="cla-btn" disabled={!canLog||isLoading}>
                      {isLoading ? <><SpinnerIcon/>{t("auth.login.submitting")}</> : t("auth.login.submit")}
                    </button>
                  </form>
                )}

                {/* REGISTER */}
                {mode === "register" && (
                  <form onSubmit={handleReg} noValidate>
                    <div className="cla-f">
                      <label className="cla-lbl">{t("auth.register.fullname")}</label>
                      <div className="cla-iw">
                        <input ref={nameRef} type="text" autoComplete="name"
                          className={`cla-i${name.trim().length>=2?" ok":""}`}
                          placeholder={t("auth.register.fullname_placeholder")}
                          value={name} onChange={e=>{setName(e.target.value);clear();}} disabled={isLoading}/>
                        {name.trim().length>=2 && <span className="cla-ok-badge"><CheckIcon/></span>}
                      </div>
                    </div>
                    <div className="cla-f">
                      <label className="cla-lbl">{t("auth.register.email")}</label>
                      <div className="cla-iw">
                        <input type="email" inputMode="email" autoComplete="email"
                          className={`cla-i${rEmailOk?" ok pr":rEmail.length>3&&!rEmailOk?" er":""}`}
                          placeholder={t("auth.register.email_placeholder")}
                          value={rEmail} onChange={e=>{setREmail(e.target.value);clear();}} disabled={isLoading}/>
                        {rEmailOk && <span className="cla-ok-badge"><CheckIcon/></span>}
                      </div>
                    </div>
                    <div className="cla-f">
                      <label className="cla-lbl">{t("auth.register.password")}</label>
                      <div className="cla-iw">
                        <input type={showRPw?"text":"password"} autoComplete="new-password"
                          className="cla-i pr" placeholder={t("auth.register.password_placeholder")}
                          value={rPw} onChange={e=>{setRPw(e.target.value);clear();}} disabled={isLoading}/>
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
                            {S_LABELS[str]}{str<3?` ${t("auth.pw_strength.hint")}` :""}
                          </div>
                        </>
                      )}
                    </div>
                    <div className="cla-f">
                      <label className="cla-lbl">
                        <GlobeIcon style={{display:"inline",verticalAlign:"middle",marginRight:4}} />
                        {t("auth.register.language")}
                      </label>
                      <div className="cla-lang-iw">
                        <span className="cla-lang-icon"><GlobeIcon/></span>
                        <select className="cla-lang-select with-icon"
                          value={regLang}
                          onChange={e => { setRegLang(e.target.value); handleLangChange(e.target.value); }}
                          disabled={isLoading}>
                          {SUPPORTED_LANGUAGES.map((lang) => (
                            <option key={lang.code} value={lang.code}>{lang.flag} {lang.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <button type="submit" className="cla-btn" disabled={!canReg||isLoading} style={{marginTop:6}}>
                      {isLoading ? <><SpinnerIcon/>{t("auth.register.submitting")}</> : t("auth.register.submit")}
                    </button>
                  </form>
                )}

                {/* FORGOT */}
                {mode === "forgot" && (
                  <form onSubmit={handleForgot} noValidate>
                    <div className="cla-f">
                      <label className="cla-lbl">{t("auth.forgot.email")}</label>
                      <div className="cla-iw">
                        <input ref={fEmailRef} type="email" inputMode="email" autoComplete="email"
                          className={`cla-i${fEmailOk?" ok pr":fEmail.length>3&&!fEmailOk?" er":""}`}
                          placeholder={t("auth.register.email_placeholder")}
                          value={fEmail} onChange={e=>{setFEmail(e.target.value);clear();}} disabled={isLoading}/>
                        {fEmailOk && <span className="cla-ok-badge"><CheckIcon/></span>}
                      </div>
                    </div>
                    <div style={{background:"rgba(249,115,22,.06)",border:"1px solid rgba(249,115,22,.14)",borderRadius:10,padding:"10px 13px",fontSize:12.5,color:"#a0a0b0",marginBottom:16,lineHeight:1.6}}>
                      💡 {t("auth.forgot.info")} <strong style={{color:"#f97316"}}>{t("auth.forgot.info_duration")}</strong>.
                    </div>
                    <button type="submit" className="cla-btn" disabled={!fEmailOk||isLoading||cooldown>0}>
                      {isLoading
                        ? <><SpinnerIcon/>{t("auth.forgot.submitting")}</>
                        : cooldown > 0
                          ? t("auth.forgot.retry").replace("{{count}}", cooldown)
                          : t("auth.forgot.submit")
                      }
                    </button>
                  </form>
                )}

                {(mode === "login" || mode === "register") && (
                  <>
                    <div className="cla-sep">
                      <div className="cla-sepl"/><span className="cla-sept">{t("auth.google.separator")}</span><div className="cla-sepl"/>
                    </div>
                    <button className="cla-google-btn" type="button" onClick={handleGoogleLogin} disabled={googleBusy||isLoading}>
                      {googleBusy
                        ? <><SpinnerIcon /> {t("auth.google.redirecting")}</>
                        : <><GoogleIcon /> {t("auth.google.button")}</>
                      }
                    </button>
                  </>
                )}

                <div className="cla-foot">
                  {t("auth.footer")} <a href="#">{t("auth.footer_cgu")}</a> {t("auth.footer_and")} <a href="#">{t("auth.footer_privacy")}</a>.
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}