// ============================================
// src/utils/callSounds.js  v3
//
// ARCHITECTURE NOTIFICATION :
//   1. Web Audio API      → sons synthétisés si onglet actif
//   2. HTMLAudioElement   → fallback WAV base64 si AudioContext suspendu/arrière-plan
//   3. Notification API   → alerte même onglet en arrière-plan (requireInteraction)
//   4. Titre onglet clignotant + Badge API → visible dans la barre onglets
//   5. Vibration API      → haptic mobile
//
// INITIALISATION :
//   Appeler initCallSounds() sur le premier geste utilisateur (App.jsx) :
//     document.addEventListener('click', initCallSounds, { once: true })
//   Cela débloque l'AudioContext ET demande la permission Notification.
// ============================================

// ─────────────────────────────────────────────────────────────────────────────
// 1. WEB AUDIO API
// ─────────────────────────────────────────────────────────────────────────────
let _ctx = null;

const getCtx = () => {
  if (typeof window === "undefined") return null;
  if (!_ctx) {
    try { _ctx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch { return null; }
  }
  if (_ctx.state === "suspended") _ctx.resume().catch(() => {});
  return _ctx;
};

/**
 * À appeler une fois sur le premier geste utilisateur (click/touch).
 * Place dans App.jsx :
 *   useEffect(() => {
 *     document.addEventListener('click', initCallSounds, { once: true });
 *   }, []);
 */
export const initCallSounds = async () => {
  const ctx = getCtx();
  if (ctx?.state === "suspended") {
    try { await ctx.resume(); } catch {}
  }
  if (typeof Notification !== "undefined" && Notification.permission === "default") {
    try { await Notification.requestPermission(); } catch {}
  }
};

// Jouer un ton — retourne true si l'AudioContext est opérationnel
const playTone = (freq, duration, type = "sine", volume = 0.3, startAt = 0) => {
  const ctx = getCtx();
  if (!ctx || ctx.state !== "running") return false;
  try {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + startAt);
    gain.gain.setValueAtTime(volume, ctx.currentTime + startAt);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startAt + duration);
    osc.start(ctx.currentTime + startAt);
    osc.stop(ctx.currentTime + startAt + duration + 0.05);
    return true;
  } catch { return false; }
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. FALLBACK AUDIO HTML (WAV PCM généré en JS, fonctionne en arrière-plan)
// ─────────────────────────────────────────────────────────────────────────────
const _makeBeepWav = (freq = 440, durationMs = 380, vol = 0.45) => {
  const sr   = 22050;
  const n    = Math.floor(sr * durationMs / 1000);
  const buf  = new ArrayBuffer(44 + n * 2);
  const v    = new DataView(buf);
  const wStr = (off, s) => { for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i)); };
  wStr(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); wStr(8, "WAVE");
  wStr(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  wStr(36, "data"); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const t   = i / sr;
    const env = Math.min(1, Math.min(t / 0.012, (durationMs / 1000 - t) / 0.06));
    v.setInt16(44 + i * 2, Math.max(-32768, Math.min(32767, Math.sin(2 * Math.PI * freq * t) * vol * env * 32767)), true);
  }
  let bin = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return "data:audio/wav;base64," + btoa(bin);
};

let _uri440 = null;
let _uri880 = null;
const uri440 = () => { if (!_uri440) _uri440 = _makeBeepWav(440, 380, 0.42); return _uri440; };
const uri880 = () => { if (!_uri880) _uri880 = _makeBeepWav(880, 380, 0.52); return _uri880; };

const playHtml = (uri, volume = 0.85) => {
  try {
    const a = new Audio(uri);
    a.volume = Math.min(1, Math.max(0, volume));
    a.play().catch(() => {});
    return a;
  } catch { return null; }
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. SONS SYSTÈME
// ─────────────────────────────────────────────────────────────────────────────
export const playSendSound    = () => { playTone(880, 0.07, "sine", 0.18); playTone(1100, 0.06, "sine", 0.13, 0.08); };
export const playReceiveSound = () => { playTone(660, 0.09, "sine", 0.18); playTone(880,  0.09, "sine", 0.14, 0.11); };
export const playCallConnectedSound = () => { [0, 0.11, 0.22].forEach((t) => playTone(880, 0.08, "sine", 0.22, t)); };
export const playCallEndedSound     = () => { playTone(440, 0.14, "sine", 0.22); playTone(330, 0.14, "sine", 0.18, 0.15); playTone(220, 0.18, "sine", 0.14, 0.30); };
export const playCallRejectedSound  = () => { for (let i = 0; i < 3; i++) playTone(480, 0.07, "square", 0.14, i * 0.16); };

// ─────────────────────────────────────────────────────────────────────────────
// 4. SONNERIE APPELANT  (ton de retour "ça sonne chez l'autre")
// ─────────────────────────────────────────────────────────────────────────────
export class CallerRingtone {
  constructor() { this._interval = null; this._stopped = false; }

  start() {
    if (this._stopped) return;
    this._once();
    this._interval = setInterval(() => { if (!this._stopped) this._once(); }, 3200);
  }

  _once() {
    const ok = playTone(440, 0.38, "sine", 0.22, 0);
    playTone(440, 0.38, "sine", 0.22, 0.50);
    if (!ok) {
      // Fallback HTML
      playHtml(uri440(), 0.65);
      setTimeout(() => { if (!this._stopped) playHtml(uri440(), 0.65); }, 500);
    }
  }

  stop() {
    this._stopped = true;
    if (this._interval) { clearInterval(this._interval); this._interval = null; }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. SONNERIE APPELÉ  (double sonnerie téléphone, fonctionne en arrière-plan)
// ─────────────────────────────────────────────────────────────────────────────
export class CallRingtone {
  constructor() { this._interval = null; this._stopped = false; this._audios = []; }

  start() {
    if (this._stopped) return;
    this._once();
    this._interval = setInterval(() => { if (!this._stopped) this._once(); }, 3200);
  }

  _once() {
    // Paire de fréquences = sonnerie de téléphone classique
    const ok1 = playTone(880,  0.30, "sine", 0.40, 0.00);
    const ok2 = playTone(1100, 0.30, "sine", 0.28, 0.00);
    playTone(880,  0.30, "sine", 0.40, 0.55);
    playTone(1100, 0.30, "sine", 0.28, 0.55);

    // ✅ Fallback HTML Audio si AudioContext suspendu (onglet en arrière-plan)
    if (!ok1 && !ok2) {
      const a = playHtml(uri880(), 0.88);
      if (a) this._audios.push(a);
      setTimeout(() => {
        if (this._stopped) return;
        const b = playHtml(uri880(), 0.88);
        if (b) this._audios.push(b);
      }, 550);
    }
  }

  stop() {
    this._stopped = true;
    if (this._interval) { clearInterval(this._interval); this._interval = null; }
    this._audios.forEach((a) => { try { a.pause(); a.currentTime = 0; a.src = ""; } catch {} });
    this._audios = [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. NOTIFICATION ONGLET ARRIÈRE-PLAN
// ─────────────────────────────────────────────────────────────────────────────
let _blinkInterval = null;
let _savedTitle    = "";
let _activeNotif   = null;

export const startTabCallAlert = (callerName) => {
  stopTabCallAlert();

  // Lire le titre courant (pas au module load)
  _savedTitle = document.title;

  // Titre clignotant
  let flip = true;
  _blinkInterval = setInterval(() => {
    document.title = flip ? `📞 ${callerName || "Appel"}…` : _savedTitle;
    flip = !flip;
  }, 900);

  // Badge (PWA)
  try { navigator.setAppBadge?.(1); } catch {}

  // ✅ Notification push — requireInteraction = reste visible jusqu'au clic
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    try {
      _activeNotif = new Notification("📞 Appel entrant", {
        body:               `${callerName || "Quelqu'un"} vous appelle`,
        icon:               "/icon-192.png",
        badge:              "/icon-72.png",
        tag:                "chantilink-incoming-call",
        renotify:           true,
        requireInteraction: true,
        silent:             false,
      });
      _activeNotif.onclick = () => { window.focus(); _activeNotif?.close(); };
    } catch { _activeNotif = null; }
  }
};

export const stopTabCallAlert = () => {
  if (_blinkInterval)  { clearInterval(_blinkInterval); _blinkInterval = null; }
  if (_savedTitle)     { document.title = _savedTitle;  _savedTitle = ""; }
  if (_activeNotif)    { try { _activeNotif.close(); } catch {} _activeNotif = null; }
  try { navigator.clearAppBadge?.(); } catch {}
};

// ─────────────────────────────────────────────────────────────────────────────
// 7. VIBRATION
// ─────────────────────────────────────────────────────────────────────────────
let _vibrateInterval = null;

export const vibrateCall = () => {
  stopVibration();
  if (!navigator.vibrate) return;
  const pulse = () => { try { navigator.vibrate([400, 250, 400, 700]); } catch {} };
  pulse();
  _vibrateInterval = setInterval(pulse, 1450);
};

export const stopVibration = () => {
  if (_vibrateInterval) { clearInterval(_vibrateInterval); _vibrateInterval = null; }
  try { navigator.vibrate?.(0); } catch {}
};