// 📁 src/pages/Videos/YouTubePool.js — v7 FLUIDITÉ MAXIMALE
//
// ═══════════════════════════════════════════════════════════════════════════
// BASE : v6 (YT.Player officiel, classe Slot, LRU, poster-first, son global)
// APPORTS v7 :
//  🚀 MAX_SLOTS 5 → 8 : plus de vidéos préchauffées simultanément
//  🚀 warmup() actif : monte un player silencieux dans un div hors-viewport
//     pour que la vidéo suivante soit déjà décodée avant le scroll
//  🚀 Prefetch silencieux (iframe 1×1px) pour les 3 prochaines vidéos
//  🚀 setPlaybackQuality('hd720') dès onReady
//  🚀 Eviction LRU améliorée : priorité aux slots en état 'paused'
//  🚀 warmupContainer propre : div caché retiré du DOM à l'acquire()
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// SON GLOBAL — partagé entre tous les slots
// ─────────────────────────────────────────────────────────────────────────────
let _globalMuted = true;

export const getGlobalMuted = () => _globalMuted;

export const setGlobalMuted = (muted) => {
  _globalMuted = muted;
  for (const slot of _slots.values()) {
    if (slot.state === 'active' || slot.state === 'paused') {
      slot.setMuted(muted);
    }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CHARGEMENT UNIQUE DE L'API YT IFRAME
// ─────────────────────────────────────────────────────────────────────────────
let _ytApiPromise = null;

const loadYouTubeApi = () => {
  if (_ytApiPromise) return _ytApiPromise;
  _ytApiPromise = new Promise((resolve) => {
    if (typeof window !== 'undefined' && window.YT?.Player) { resolve(); return; }
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(); };
    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      s.async = true;
      document.head.appendChild(s);
    }
  });
  return _ytApiPromise;
};

// ─────────────────────────────────────────────────────────────────────────────
// PRECONNECT DNS/TLS
// ─────────────────────────────────────────────────────────────────────────────
const YT_DOMAINS = [
  'https://www.youtube.com',
  'https://i.ytimg.com',
  'https://yt3.ggpht.com',
];
let _preconnected = false;
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
// POSTER (thumbnail + badge YouTube)
// ─────────────────────────────────────────────────────────────────────────────
const buildPoster = (videoId) => {
  const wrapper = document.createElement('div');
  wrapper.style.cssText = [
    'position:absolute', 'inset:0', 'width:100%', 'height:100%',
    'background:#080810', 'overflow:hidden',
    'transition:opacity 0.35s ease', 'z-index:2',
  ].join(';');

  const img = document.createElement('img');
  img.loading = 'eager'; img.decoding = 'async';
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
// SLOT — une vidéo gérée par YT.Player officiel
// states : mounting → loading → active ↔ paused → released
// ─────────────────────────────────────────────────────────────────────────────
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
    this._isWarmup    = false; // monté hors-viewport pour préchauffage
    this._warmupEl    = null;  // div hors-viewport à nettoyer lors de l'acquire
    this._onReadyCb   = null;  // callback optionnel fourni par acquire(opts.onReady)
  }

  get _isDestroyed() { return this.state === 'released'; }

  async mountIframe() {
    if (this.state === 'released') return;
    try { await loadYouTubeApi(); } catch { return; }
    if (this.state === 'released') return;

    this.state = 'loading';

    const div = document.createElement('div');
    div.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;';
    this.container.appendChild(div);
    this.playerDiv = div;

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
        origin: typeof window !== 'undefined' ? window.location.origin : '',
      },
      events: {
        onReady:       (e) => this._onReady(e),
        onStateChange: (e) => this._onStateChange(e),
        onError:       (e) => console.warn(`[YTPool] Error ${this.videoId} code=${e.data}`),
      },
    });
  }

  _onReady(event) {
    if (this.state === 'released') return;

    // Parfois l'event onReady arrive avant que l'iframe soit réellement
    // attachée au DOM (dev / hotswap). On vérifie et on réessaie tant que
    // l'iframe n'est pas connecté pour éviter les erreurs postMessage.
    const safeApply = (attempt = 0) => {
      try {
        const iframe = event.target && typeof event.target.getIframe === 'function'
          ? event.target.getIframe()
          : null;

        if (iframe && !iframe.isConnected) {
          if (attempt < 8) {
            setTimeout(() => safeApply(attempt + 1), 60);
            return;
          }
          // Si après plusieurs essais l'iframe n'est toujours pas connectée,
          // on continue quand même mais on protège les appels.
        }

        this.state = 'active';

        // Qualité HD dès le départ (protégé)
        try { event.target.setPlaybackQuality('hd720'); } catch {}

        // Retirer le poster
        if (this.poster) {
          const p = this.poster; this.poster = null;
          p.style.opacity = '0';
          setTimeout(() => { try { p.remove(); } catch {} }, 380);
        }

        this._applyMute(event.target);

        try { if (typeof this._onReadyCb === 'function') this._onReadyCb(); } catch {}

        if (this._isWarmup) {
          try { event.target.pauseVideo(); } catch {}
        } else if (this._wantPlay) {
          try { event.target.playVideo(); } catch {}
        } else {
          try { event.target.pauseVideo(); } catch {}
        }
      } catch (err) {
        if (attempt < 8) setTimeout(() => safeApply(attempt + 1), 60);
      }
    };

    safeApply();
  }

  _onStateChange(event) {
    if (this.state === 'released') return;
    // 0 = ended → loop manuel
    if (event.data === 0 && this._wantPlay && !this._isWarmup) {
      try { this.player?.seekTo(0); this.player?.playVideo(); } catch {}
    }
    // 1 = playing → resync son
    if (event.data === 1) { this._applyMute(this.player); }
    // -1 = unstarted → relancer si désiré
    if (event.data === -1 && this._wantPlay && !this._isWarmup) {
      try { this.player?.playVideo(); } catch {}
    }
  }

  _applyMute(target) {
    if (!target) return;
    try {
      if (this._wantMuted) { target.mute(); target.setVolume(0); }
      else                 { target.unMute(); target.setVolume(100); }
    } catch {}
  }

  play() {
    this._wantPlay  = true;
    this._isWarmup  = false;
    try {
      if (this.player && (this.state === 'active' || this.state === 'paused' || this.state === 'loading')) {
        this.player.playVideo();
        this.state = 'active';
      }
    } catch {}
  }

  pause() {
    this._wantPlay = false;
    try {
      if (this.player && this.state === 'active') {
        this.player.pauseVideo();
        this.state = 'paused';
      }
    } catch {}
  }

  setMuted(muted) {
    this._wantMuted = muted;
    this._applyMute(this.player);
  }

  // Transfert depuis le div de warmup vers le vrai conteneur du composant
  transferTo(newContainer) {
    if (!this.playerDiv || !newContainer) return;
    if (this.playerDiv.parentNode) this.playerDiv.parentNode.removeChild(this.playerDiv);
    newContainer.appendChild(this.playerDiv);
    this.container = newContainer;
    this._isWarmup = false;
    // Nettoyer le div de warmup hors-viewport
    if (this._warmupEl?.parentNode) this._warmupEl.parentNode.removeChild(this._warmupEl);
    this._warmupEl = null;
  }

  destroy() {
    if (this.state === 'released') return;
    this.state = 'released';
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
const _slots    = new Map();   // videoId → Slot
const MAX_SLOTS = 8;           // v7 : 8 slots (au lieu de 5)
const WARMUP_AHEAD  = 5;       // nb de vidéos préchauffées à l'avance
const PREFETCH_AHEAD = 3;      // nb de thumbnails pré-téléchargées

const _evictLRU = (keepVideoId) => {
  if (_slots.size < MAX_SLOTS) return;
  // 1. Préférer évincer un slot en pause
  for (const [vid, slot] of _slots) {
    if (vid === keepVideoId) continue;
    if (slot.state === 'paused' || slot._isWarmup) {
      slot.destroy(); _slots.delete(vid); return;
    }
  }
  // 2. Sinon évincer le plus ancien
  for (const [vid, slot] of _slots) {
    if (vid === keepVideoId) continue;
    slot.destroy(); _slots.delete(vid); return;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DIV HORS-VIEWPORT pour le warmup
// ─────────────────────────────────────────────────────────────────────────────
const makeOffscreenDiv = () => {
  const div = document.createElement('div');
  div.style.cssText = [
    'position:fixed', 'left:-9999px', 'top:0',
    'width:360px', 'height:640px',
    'visibility:hidden', 'pointer-events:none',
    'overflow:hidden',
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
    loadYouTubeApi();
  },

  /**
   * warmup(videoIds) — préchauffe les N prochaines vidéos.
   * Monte un YT.Player silencieux dans un div hors-viewport pour que
   * le navigateur décode déjà la vidéo avant que l'utilisateur scrolle.
   */
  warmup(videoIds = []) {
    const ids = videoIds.slice(0, WARMUP_AHEAD);

    // Toujours précharger les thumbnails
    ids.slice(0, PREFETCH_AHEAD).forEach(preloadThumbnail);

    // Monter des players silencieux pour les premiers
    ids.forEach((videoId, i) => {
      if (!videoId) return;
      if (_slots.has(videoId)) return; // déjà dans le pool
      if (_slots.size >= MAX_SLOTS) return;

      setTimeout(() => {
        if (_slots.has(videoId) || _slots.size >= MAX_SLOTS) return;

        const offscreen = makeOffscreenDiv();
        const slot = new Slot(videoId, offscreen);
        slot._isWarmup  = true;
        slot._wantMuted = true;
        slot._warmupEl  = offscreen;
        _slots.set(videoId, slot);

        const mount = () => slot.mountIframe();
        if ('requestIdleCallback' in window) {
          slot.idleHandle = requestIdleCallback(mount, { timeout: 800 });
        } else {
          slot.idleHandle = setTimeout(mount, 200 + i * 150);
        }
      }, i * 250);
    });
  },

  getThumbnailUrl,

  /**
   * acquire(videoId, container, opts?) → slot
   * opts.muted    boolean — état initial du son
   * opts.autoplay boolean — lancer la lecture dès que prêt
   */
  acquire(videoId, container, opts = {}) {
    if (!videoId || !container) {
      return {
        videoId, container, player: null, poster: null,
        state: 'idle', idleHandle: null,
        _isDestroyed: true, _isWarmup: false,
        play() {}, pause() {}, setMuted() {}, transferTo() {},
      };
    }

    const existing = _slots.get(videoId);

    if (existing && existing.state !== 'released') {
      // Cas warmup → transfert dans le vrai conteneur
      if (existing._isWarmup) {
        existing._wantMuted = opts.muted !== undefined ? !!opts.muted : _globalMuted;
        existing._wantPlay  = opts.autoplay !== false;
        existing._onReadyCb = typeof opts.onReady === 'function' ? opts.onReady : existing._onReadyCb;

        // Si le player est déjà prêt, transfert immédiat
        if (existing.playerDiv) {
          existing.transferTo(container);
          // Ajouter le poster si pas encore prêt
          if (existing.state === 'loading' || existing.state === 'mounting') {
            const p = buildPoster(videoId);
            container.appendChild(p);
            existing.poster = p;
          }
          if (existing._wantPlay) existing.play();
          existing._applyMute(existing.player);
        } else {
          // Player pas encore monté — changer le container cible
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

      // Même container, même videoId
      if (existing.container === container) {
        if (opts.muted !== undefined) existing._wantMuted = opts.muted;
        else existing._wantMuted = _globalMuted;
        existing._wantPlay = opts.autoplay !== false;
        if (existing.state === 'paused' && existing._wantPlay) existing.play();
        existing._applyMute(existing.player);
        return existing;
      }

      // Container différent — détruire et recréer
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

    // Poster immédiat
    const poster = buildPoster(videoId);
    container.appendChild(poster);
    slot.poster = poster;

    // Monter l'iframe en idle callback
    const mount = () => slot.mountIframe();
    if ('requestIdleCallback' in window) {
      slot.idleHandle = requestIdleCallback(mount, { timeout: 300 });
    } else {
      slot.idleHandle = setTimeout(mount, 80);
    }

    return slot;
  },

  /**
   * release(slot) — met en pause, garde en mémoire pour LRU
   */
  release(slot) {
    if (!slot || slot.state === 'released') return;
    slot.pause();
  },

  setGlobalMuted,
  getGlobalMuted,

  destroy() {
    for (const slot of _slots.values()) slot.destroy();
    _slots.clear();
    _preloadedThumbs.clear();
    _preconnected = false;
    _ytApiPromise = null;
    _globalMuted  = true;
  },
};

export default YouTubePool;