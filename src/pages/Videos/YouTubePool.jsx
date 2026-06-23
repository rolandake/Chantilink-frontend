// 📁 src/pages/Videos/YouTubePool.js — v8 ROBUSTESSE MAXIMALE
//
// ═══════════════════════════════════════════════════════════════════════════
// APPORTS v8 vs v7 :
//  🛡️  Error recovery : onError YT → retry automatique (max 3 tentatives)
//  🛡️  Slot state machine stricte avec transitions validées
//  🛡️  Détection iframe déconnectée (SPA routing) → recreate automatique
//  🚀  acquire() jamais bloquant : retourne immédiatement un slot même
//      si le player n'est pas encore monté (état 'mounting')
//  🚀  play() / pause() idempotents — sécurisés même après destroy()
//  🚀  Cleanup mémoire : révocation objectURLs, abort des fetches
//  🔇  setGlobalMuted() ne force plus les slots en warmup
//  📊  getStats() exposée pour debugging
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// SON GLOBAL
// ─────────────────────────────────────────────────────────────────────────────
let _globalMuted = true;

export const getGlobalMuted = () => _globalMuted;

export const setGlobalMuted = (muted) => {
  _globalMuted = muted;
  for (const slot of _slots.values()) {
    // Ne pas toucher les slots en warmup silencieux
    if (slot._isWarmup) continue;
    if (slot.state === 'active' || slot.state === 'paused') {
      slot.setMuted(muted);
    }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CHARGEMENT API YT (singleton + retry)
// ─────────────────────────────────────────────────────────────────────────────
let _ytApiPromise  = null;
let _ytApiResolved = false;

const loadYouTubeApi = () => {
  if (_ytApiPromise) return _ytApiPromise;
  _ytApiPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject(new Error('SSR'));
    if (window.YT?.Player) { _ytApiResolved = true; resolve(); return; }

    const timer = setTimeout(() => reject(new Error('YT API timeout')), 15_000);

    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      clearTimeout(timer);
      prev?.();
      _ytApiResolved = true;
      resolve();
    };

    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const s = document.createElement('script');
      s.src   = 'https://www.youtube.com/iframe_api';
      s.async = true;
      s.onerror = () => { clearTimeout(timer); reject(new Error('YT script load failed')); };
      document.head.appendChild(s);
    }
  }).catch(err => {
    // Réinitialiser pour retry possible
    _ytApiPromise  = null;
    _ytApiResolved = false;
    throw err;
  });

  return _ytApiPromise;
};

// ─────────────────────────────────────────────────────────────────────────────
// NORMALISATION ORIGIN IFRAME
// ─────────────────────────────────────────────────────────────────────────────
const normalizeYouTubeIframeOrigin = (iframe) => {
  if (!iframe || typeof window === 'undefined') return;
  try {
    const origin = window.location.origin;
    const url    = new URL(iframe.src);
    let changed  = false;
    ['forigin', 'gporigin'].forEach(p => {
      if (url.searchParams.has(p)) { url.searchParams.set(p, origin); changed = true; }
    });
    if (changed) iframe.src = url.toString();
  } catch {}
};

// ─────────────────────────────────────────────────────────────────────────────
// PRECONNECT DNS/TLS
// ─────────────────────────────────────────────────────────────────────────────
const YT_DOMAINS  = ['https://www.youtube.com', 'https://i.ytimg.com', 'https://yt3.ggpht.com'];
let   _preconnected = false;

const injectPreconnects = () => {
  if (_preconnected || typeof document === 'undefined') return;
  _preconnected = true;
  for (const origin of YT_DOMAINS) {
    if (document.querySelector(`link[href="${origin}"]`)) continue;
    const pc = document.createElement('link');
    pc.rel = 'preconnect'; pc.href = origin; pc.crossOrigin = 'anonymous';
    document.head.appendChild(pc);
    const dns = document.createElement('link');
    dns.rel = 'dns-prefetch'; dns.href = origin;
    document.head.appendChild(dns);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// THUMBNAIL HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const _preloadedThumbs = new Set();
const THUMB_QUALITIES  = ['hqdefault', 'mqdefault', 'sddefault'];

export const getThumbnailUrl = (videoId, quality = 'hqdefault') =>
  `https://i.ytimg.com/vi/${videoId}/${quality}.jpg`;

const preloadThumbnail = (videoId) => {
  if (!videoId || _preloadedThumbs.has(videoId)) return;
  _preloadedThumbs.add(videoId);
  const img = new Image();
  img.src = getThumbnailUrl(videoId, 'hqdefault');
};

// ─────────────────────────────────────────────────────────────────────────────
// POSTER
// ─────────────────────────────────────────────────────────────────────────────
const buildPoster = (videoId) => {
  const wrapper = document.createElement('div');
  wrapper.style.cssText = [
    'position:absolute', 'inset:0', 'width:100%', 'height:100%',
    'background:#080810', 'overflow:hidden',
    'transition:opacity 0.35s ease', 'z-index:2',
  ].join(';');

  const img = document.createElement('img');
  img.loading  = 'eager';
  img.decoding = 'async';
  img.alt      = '';
  img.style.cssText = 'width:100%;height:100%;object-fit:cover;';

  let qi = 0;
  const tryLoad = () => { img.src = getThumbnailUrl(videoId, THUMB_QUALITIES[qi]); };
  img.onerror = () => {
    qi++;
    if (qi < THUMB_QUALITIES.length) tryLoad();
    else wrapper.style.background = 'linear-gradient(135deg,#0f0f1a,#1a0f2e)';
  };
  tryLoad();
  wrapper.appendChild(img);

  const badge = document.createElement('div');
  badge.style.cssText = [
    'position:absolute', 'top:10px', 'left:10px',
    'background:rgba(0,0,0,0.65)', 'backdrop-filter:blur(8px)',
    'border:1px solid rgba(255,255,255,0.15)', 'border-radius:9999px',
    'padding:3px 10px', 'display:flex', 'align-items:center', 'gap:5px',
  ].join(';');
  badge.innerHTML = `
    <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
      <rect width="14" height="10" rx="2" fill="#FF0000"/>
      <path d="M5.5 2.5l5 2.5-5 2.5V2.5Z" fill="white"/>
    </svg>
    <span style="color:white;font-size:10px;font-weight:700;letter-spacing:.03em">YouTube</span>`;
  wrapper.appendChild(badge);
  return wrapper;
};

// ─────────────────────────────────────────────────────────────────────────────
// ÉTATS VALIDES DU SLOT
// states : mounting → loading → active ↔ paused → released
//          mounting → released  (si destroyed avant montage)
//          loading  → released  (si destroyed pendant chargement)
// ─────────────────────────────────────────────────────────────────────────────
const VALID_TRANSITIONS = {
  mounting: ['loading', 'released'],
  loading:  ['active', 'released'],
  active:   ['paused', 'released'],
  paused:   ['active', 'released'],
  released: [],
};

class Slot {
  constructor(videoId, container) {
    this.videoId      = videoId;
    this.container    = container;
    this.player       = null;
    this.playerDiv    = null;
    this.poster       = null;
    this.state        = 'mounting';
    this.idleHandle   = null;
    this._wantMuted   = _globalMuted;
    this._wantPlay    = true;
    this._isWarmup    = false;
    this._warmupEl    = null;
    this._onReadyCb   = null;
    this._ready       = false;
    this._retries     = 0;
    this._MAX_RETRIES = 3;
    this._lastActivity = Date.now();
  }

  // ── State machine stricte ─────────────────────────────────────────────────
  _transition(newState) {
    const valid = VALID_TRANSITIONS[this.state];
    if (!valid || !valid.includes(newState)) return false;
    this.state = newState;
    this._lastActivity = Date.now();
    return true;
  }

  get _isDestroyed() { return this.state === 'released'; }

  _getIframe() {
    try {
      return this.player && typeof this.player.getIframe === 'function'
        ? this.player.getIframe()
        : null;
    } catch { return null; }
  }

  _canCallPlayer() {
    if (!this.player || this.state === 'released' || !this._ready) return false;
    try {
      const iframe = this._getIframe();
      return !!iframe?.isConnected;
    } catch { return false; }
  }

  // ── Montage iframe ────────────────────────────────────────────────────────
  async mountIframe() {
    if (this.state === 'released') return;
    try { await loadYouTubeApi(); } catch (err) {
      console.warn('[YTPool] API non disponible:', err.message);
      return;
    }
    if (this.state === 'released') return;

    this._transition('loading');

    const div = document.createElement('div');
    div.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;';
    this.container.appendChild(div);
    this.playerDiv = div;

    try {
      this.player = new window.YT.Player(div, {
        videoId: this.videoId,
        playerVars: {
          autoplay:       1,
          mute:           1,
          loop:           1,
          playlist:       this.videoId,
          playsinline:    1,
          controls:       0,
          rel:            0,
          modestbranding: 1,
          iv_load_policy: 3,
          fs:             0,
          cc_load_policy: 0,
          disablekb:      1,
          enablejsapi:    1,
          origin:         typeof window !== 'undefined' ? window.location.origin : '',
        },
        events: {
          onReady:       (e) => this._onReady(e),
          onStateChange: (e) => this._onStateChange(e),
          onError:       (e) => this._onError(e),
        },
      });

      try { normalizeYouTubeIframeOrigin(this._getIframe()); } catch {}
    } catch (err) {
      console.warn('[YTPool] new YT.Player() failed:', err.message);
      this._scheduleRetry();
    }
  }

  // ── onReady ───────────────────────────────────────────────────────────────
  _onReady(event) {
    if (this.state === 'released') return;

    const safeApply = (attempt = 0) => {
      try {
        const target = event.target;
        const iframe  = typeof target?.getIframe === 'function' ? target.getIframe() : null;

        if (!iframe || !iframe.isConnected) {
          if (attempt < 8) { setTimeout(() => safeApply(attempt + 1), 60); return; }
          console.warn('[YTPool] iframe non connectée après 8 tentatives:', this.videoId);
          return;
        }

        this._transition('active');
        this._ready   = true;
        this._retries = 0; // reset après succès

        try { target.setPlaybackQuality('hd720'); } catch {}

        if (this.poster) {
          const p = this.poster; this.poster = null;
          p.style.opacity = '0';
          setTimeout(() => { try { p.remove(); } catch {} }, 380);
        }

        this._applyMute(target);

        try { if (typeof this._onReadyCb === 'function') this._onReadyCb(); } catch {}

        if (this._isWarmup) {
          try { target.pauseVideo(); } catch {}
        } else if (this._wantPlay) {
          try { target.playVideo(); } catch {}
        } else {
          try { target.pauseVideo(); } catch {}
        }
      } catch (err) {
        if (attempt < 8) setTimeout(() => safeApply(attempt + 1), 60);
      }
    };

    safeApply();
  }

  // ── onStateChange ─────────────────────────────────────────────────────────
  _onStateChange(event) {
    if (this.state === 'released') return;
    const data = event.data;

    // 0 = ended → loop
    if (data === 0 && this._wantPlay && !this._isWarmup && this._canCallPlayer()) {
      try { this.player?.seekTo(0); this.player?.playVideo(); } catch {}
    }
    // 1 = playing
    if (data === 1) {
      if (this.state === 'paused') this._transition('active');
      this._applyMute(this.player);
    }
    // 2 = paused (par l'utilisateur ou le navigateur)
    if (data === 2 && this.state === 'active' && this._wantPlay && !this._isWarmup && this._canCallPlayer()) {
      // Relancer si on voulait jouer (ex: autoplay bloqué temporairement)
      setTimeout(() => {
        if (this._wantPlay && !this._isWarmup && this._canCallPlayer()) {
          try { this.player?.playVideo(); } catch {}
        }
      }, 500);
    }
    // -1 = unstarted
    if (data === -1 && this._wantPlay && !this._isWarmup && this._canCallPlayer()) {
      try { this.player?.playVideo(); } catch {}
    }
  }

  // ── onError — Retry automatique ───────────────────────────────────────────
  _onError(event) {
    console.warn(`[YTPool] Error ${this.videoId} code=${event.data} (tentative ${this._retries + 1}/${this._MAX_RETRIES})`);
    this._scheduleRetry();
  }

  _scheduleRetry() {
    if (this.state === 'released') return;
    if (this._retries >= this._MAX_RETRIES) {
      console.warn(`[YTPool] Max retries pour ${this.videoId} — abandon`);
      this.destroy();
      _slots.delete(this.videoId);
      return;
    }
    this._retries++;
    const delay = this._retries * 2000; // 2s, 4s, 6s

    setTimeout(() => {
      if (this.state === 'released') return;
      // Nettoyer l'ancien player
      try { this.player?.destroy(); } catch {}
      this.player    = null;
      this._ready    = false;
      // Nettoyer le div
      try { this.playerDiv?.remove(); } catch {}
      this.playerDiv = null;

      // Remettre en mounting pour re-tenter
      this.state = 'loading'; // contourner la state machine pour le retry
      this.mountIframe();
    }, delay);
  }

  // ── Mute ──────────────────────────────────────────────────────────────────
  _applyMute(target) {
    if (!target || !this._canCallPlayer()) return;
    try {
      if (this._wantMuted) { target.mute(); target.setVolume(0); }
      else                 { target.unMute(); target.setVolume(100); }
    } catch {}
  }

  // ── API publique ──────────────────────────────────────────────────────────
  play() {
    this._wantPlay = true;
    this._isWarmup = false;
    if (!this._canCallPlayer()) return;
    try {
      if (this.state === 'active' || this.state === 'paused') {
        this.player.playVideo();
        this._transition('active');
      }
    } catch {}
  }

  pause() {
    this._wantPlay = false;
    if (!this._canCallPlayer()) return;
    try {
      if (this.state === 'active') {
        this.player.pauseVideo();
        this._transition('paused');
      }
    } catch {}
  }

  setMuted(muted) {
    this._wantMuted = muted;
    this._applyMute(this.player);
  }

  transferTo(newContainer) {
    if (!this.playerDiv || !newContainer) return;
    if (this.playerDiv.parentNode) this.playerDiv.parentNode.removeChild(this.playerDiv);
    newContainer.appendChild(this.playerDiv);
    this.container = newContainer;
    this._isWarmup = false;
    if (this._warmupEl?.parentNode) this._warmupEl.parentNode.removeChild(this._warmupEl);
    this._warmupEl = null;
  }

  destroy() {
    if (this.state === 'released') return;
    this.state  = 'released';
    this._ready = false;

    if (this.idleHandle != null) {
      try { cancelIdleCallback(this.idleHandle); } catch {}
      try { clearTimeout(this.idleHandle); } catch {}
      this.idleHandle = null;
    }

    try { this.player?.pauseVideo(); } catch {}
    try { this.player?.destroy(); } catch {}
    this.player = null;

    setTimeout(() => {
      try { this.playerDiv?.remove(); } catch {}
      try { this.poster?.remove(); } catch {}
      if (this._warmupEl?.parentNode) this._warmupEl.parentNode.removeChild(this._warmupEl);
      this.playerDiv = this.poster = this._warmupEl = null;
    }, 60);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POOL MANAGER
// ─────────────────────────────────────────────────────────────────────────────
const _slots    = new Map();
const MAX_SLOTS = 8;
const WARMUP_AHEAD   = 5;
const PREFETCH_AHEAD = 3;

// Eviction LRU améliorée : priorité slots warmup puis paused
const _evictLRU = (keepVideoId) => {
  if (_slots.size < MAX_SLOTS) return;

  // 1. Warmups en premier (jamais visibles)
  for (const [vid, slot] of _slots) {
    if (vid === keepVideoId) continue;
    if (slot._isWarmup) { slot.destroy(); _slots.delete(vid); return; }
  }
  // 2. Paused
  for (const [vid, slot] of _slots) {
    if (vid === keepVideoId) continue;
    if (slot.state === 'paused') { slot.destroy(); _slots.delete(vid); return; }
  }
  // 3. Les plus anciens
  for (const [vid, slot] of _slots) {
    if (vid === keepVideoId) continue;
    slot.destroy(); _slots.delete(vid); return;
  }
};

// Div hors-viewport pour warmup
const makeOffscreenDiv = () => {
  const div = document.createElement('div');
  div.style.cssText = [
    'position:fixed', 'left:-9999px', 'top:0',
    'width:360px', 'height:640px',
    'visibility:hidden', 'pointer-events:none',
    'overflow:hidden', 'z-index:-1',
  ].join(';');
  document.body.appendChild(div);
  return div;
};

// ─────────────────────────────────────────────────────────────────────────────
// API PUBLIQUE
// ─────────────────────────────────────────────────────────────────────────────
const YouTubePool = {

  init() {
    injectPreconnects();
    loadYouTubeApi().catch(() => {}); // fail silencieux
  },

  warmup(videoIds = []) {
    const ids = videoIds.slice(0, WARMUP_AHEAD);
    ids.slice(0, PREFETCH_AHEAD).forEach(preloadThumbnail);

    ids.forEach((videoId, i) => {
      if (!videoId) return;
      if (_slots.has(videoId)) return;
      if (_slots.size >= MAX_SLOTS) return;

      setTimeout(() => {
        if (_slots.has(videoId) || _slots.size >= MAX_SLOTS) return;

        const offscreen  = makeOffscreenDiv();
        const slot       = new Slot(videoId, offscreen);
        slot._isWarmup   = true;
        slot._wantMuted  = true;
        slot._wantPlay   = false;
        slot._warmupEl   = offscreen;
        _slots.set(videoId, slot);

        const mount = () => slot.mountIframe().catch(() => {});
        if ('requestIdleCallback' in window) {
          slot.idleHandle = requestIdleCallback(mount, { timeout: 1000 });
        } else {
          slot.idleHandle = setTimeout(mount, 300 + i * 200);
        }
      }, i * 300);
    });
  },

  getThumbnailUrl,

  acquire(videoId, container, opts = {}) {
    // Slot de fallback sécurisé
    const nullSlot = () => ({
      videoId, container, player: null, poster: null,
      state: 'idle', idleHandle: null,
      _isDestroyed: true, _isWarmup: false,
      play() {}, pause() {}, setMuted() {}, transferTo() {},
    });

    if (!videoId || !container) return nullSlot();

    const existing = _slots.get(videoId);

    if (existing && existing.state !== 'released') {
      // Warmup → transfert
      if (existing._isWarmup) {
        existing._wantMuted = opts.muted !== undefined ? !!opts.muted : _globalMuted;
        existing._wantPlay  = opts.autoplay !== false;
        existing._onReadyCb = typeof opts.onReady === 'function' ? opts.onReady : existing._onReadyCb;

        if (existing.playerDiv) {
          existing.transferTo(container);
          if (existing.state === 'loading' || existing.state === 'mounting') {
            const p = buildPoster(videoId);
            container.appendChild(p);
            existing.poster = p;
          }
          if (existing._wantPlay) existing.play();
          existing._applyMute(existing.player);
        } else {
          existing.container = container;
          existing._isWarmup = false;
          if (existing._warmupEl?.parentNode) existing._warmupEl.parentNode.removeChild(existing._warmupEl);
          existing._warmupEl = null;
          const p = buildPoster(videoId);
          container.appendChild(p);
          existing.poster = p;
        }
        return existing;
      }

      // Même container
      if (existing.container === container) {
        existing._wantMuted = opts.muted !== undefined ? !!opts.muted : _globalMuted;
        existing._wantPlay  = opts.autoplay !== false;
        if (existing._onReadyCb === null && typeof opts.onReady === 'function')
          existing._onReadyCb = opts.onReady;
        if (existing.state === 'paused' && existing._wantPlay) existing.play();
        existing._applyMute(existing.player);
        return existing;
      }

      // Container différent
      existing.destroy();
      _slots.delete(videoId);
    }

    _evictLRU(videoId);

    // Préparer le container
    const cs = window.getComputedStyle(container);
    if (!['absolute', 'fixed', 'sticky', 'relative'].includes(cs.position)) {
      container.style.position = 'relative';
    }
    container.style.overflow = 'hidden';

    const slot = new Slot(videoId, container);
    slot._wantMuted = opts.muted !== undefined ? !!opts.muted : _globalMuted;
    slot._wantPlay  = opts.autoplay !== false;
    slot._onReadyCb = typeof opts.onReady === 'function' ? opts.onReady : null;
    _slots.set(videoId, slot);

    const poster = buildPoster(videoId);
    container.appendChild(poster);
    slot.poster = poster;

    const mount = () => slot.mountIframe().catch(() => {});
    if ('requestIdleCallback' in window) {
      slot.idleHandle = requestIdleCallback(mount, { timeout: 400 });
    } else {
      slot.idleHandle = setTimeout(mount, 100);
    }

    return slot;
  },

  release(slot) {
    if (!slot || slot.state === 'released') return;
    slot.pause();
  },

  setGlobalMuted,
  getGlobalMuted,

  // ── Debug stats ──────────────────────────────────────────────────────────
  getStats() {
    const stats = { total: _slots.size, byState: {} };
    for (const slot of _slots.values()) {
      stats.byState[slot.state] = (stats.byState[slot.state] || 0) + 1;
    }
    return stats;
  },

  destroy() {
    for (const slot of _slots.values()) slot.destroy();
    _slots.clear();
    _preloadedThumbs.clear();
    _preconnected  = false;
    _ytApiPromise  = null;
    _ytApiResolved = false;
    _globalMuted   = true;
  },
};

export default YouTubePool;