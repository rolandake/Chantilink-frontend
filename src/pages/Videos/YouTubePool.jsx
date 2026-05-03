// 📁 src/pages/Videos/YouTubePool.js — v6 YT.Player OFFICIEL
//
// ═══════════════════════════════════════════════════════════════════════════
// CORRECTIONS vs v5 :
//
// ✅ FIX CRITIQUE — Utilise YT.Player officiel au lieu de postMessage raw
//    → Résout "this.api.isExternalMethodAvailable is not a function"
//    → Résout tous les onReady timeout (callback officiel garanti)
//    → Plus de race condition postMessage/origin
//
// ✅ SON PERSISTANT — globalMuted partagé entre tous les slots
//    → Quand l'utilisateur active le son, tous les slots suivants
//      démarrent automatiquement avec le son
//    → setGlobalMuted(false) propagé à tous les slots actifs
//
// ✅ CHARGEMENT API UNIQUE — loadYouTubeApi() est une Promise partagée
//    → Le script youtube.com/iframe_api n'est injecté qu'une seule fois
//    → Tous les acquire() en parallèle attendent la même Promise
//
// ✅ LRU EVICTION MAX_SLOTS=5 conservé
// ✅ poster-first conservé (thumbnail avant iframe)
// ✅ API acquire/release 100% compatible avec AggregatedCard v7
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// ÉTAT GLOBAL DU SON — partagé entre tous les slots
// ─────────────────────────────────────────────────────────────────────────────
let _globalMuted = true; // démarre muet (autoplay policy navigateur)

export const getGlobalMuted = () => _globalMuted;

export const setGlobalMuted = (muted) => {
  _globalMuted = muted;
  // Propager à tous les slots actifs immédiatement
  for (const slot of _slots.values()) {
    if (slot.state === 'active' || slot.state === 'paused') {
      slot.setMuted(muted);
    }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CHARGEMENT UNIQUE DE L'API YOUTUBE IFRAME
// ─────────────────────────────────────────────────────────────────────────────
let _ytApiPromise = null;

const loadYouTubeApi = () => {
  if (_ytApiPromise) return _ytApiPromise;

  _ytApiPromise = new Promise((resolve) => {
    // Déjà chargée (ex: HMR en dev)
    if (typeof window !== 'undefined' && window.YT?.Player) {
      resolve();
      return;
    }

    // Callback global attendu par youtube.com/iframe_api
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.(); // chaîner si déjà défini
      resolve();
    };

    // Injecter le script une seule fois
    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      document.head.appendChild(script);
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
// POSTER (thumbnail + badge YouTube affiché avant l'iframe)
// ─────────────────────────────────────────────────────────────────────────────
const buildPoster = (videoId) => {
  const wrapper = document.createElement('div');
  wrapper.style.cssText = [
    'position:absolute', 'inset:0', 'width:100%', 'height:100%',
    'background:#080810', 'overflow:hidden',
    'transition:opacity 0.35s ease', 'z-index:2',
  ].join(';');

  const img    = document.createElement('img');
  img.loading  = 'eager';
  img.decoding = 'async';
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

  // Badge YouTube
  const badge = document.createElement('div');
  badge.style.cssText = [
    'position:absolute', 'top:10px', 'left:10px',
    'background:rgba(0,0,0,0.65)', 'backdrop-filter:blur(8px)',
    'border:1px solid rgba(255,255,255,0.15)',
    'border-radius:9999px', 'padding:3px 10px',
    'display:flex', 'align-items:center', 'gap:5px',
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
// SLOT — une vidéo YouTube gérée par YT.Player officiel
// states: mounting → loading → active ↔ paused → released
// ─────────────────────────────────────────────────────────────────────────────
class Slot {
  constructor(videoId, container) {
    this.videoId    = videoId;
    this.container  = container;
    this.player     = null;   // instance YT.Player
    this.playerDiv  = null;   // div hôte de l'iframe
    this.poster     = null;
    this.state      = 'mounting';
    this.idleHandle = null;

    // Son hérité de l'état global au moment de la création
    this._wantMuted = _globalMuted;
    this._wantPlay  = true;
  }

  // Compatibilité avec AggregatedCard qui teste slot._isDestroyed
  get _isDestroyed() {
    return this.state === 'released';
  }

  // Appelé depuis idle callback — attend l'API YT puis crée le player
  async mountIframe() {
    if (this.state === 'released') return;

    try {
      await loadYouTubeApi();
    } catch {
      console.error('[YTPool] Impossible de charger l\'API YouTube');
      return;
    }

    if (this.state === 'released') return; // démontage pendant l'attente

    this.state = 'loading';

    // Div hôte — YT.Player va remplacer ce div par l'iframe
    const div = document.createElement('div');
    div.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;';
    this.container.appendChild(div);
    this.playerDiv = div;

    this.player = new window.YT.Player(div, {
      videoId: this.videoId,
      playerVars: {
        autoplay:       1,
        mute:           1,          // toujours muet au départ (autoplay policy)
        loop:           1,
        playlist:       this.videoId,
        playsinline:    1,
        controls:       0,
        rel:            0,
        modestbranding: 1,
        iv_load_policy: 3,
        fs:             0,
        cc_load_policy: 0,
        origin:         typeof window !== 'undefined' ? window.location.origin : '',
      },
      events: {
        onReady:       (e) => this._onReady(e),
        onStateChange: (e) => this._onStateChange(e),
        onError:       (e) => console.warn(`[YTPool] Error ${this.videoId} code=${e.data}`),
      },
    });
  }

  // ── Player prêt (callback officiel YT — jamais de double-fire) ───────────
  _onReady(event) {
    if (this.state === 'released') return;
    this.state = 'active';

    // Retirer le poster
    if (this.poster) {
      const p = this.poster; this.poster = null;
      p.style.opacity = '0';
      setTimeout(() => { try { p.remove(); } catch {} }, 380);
    }

    // Appliquer l'état souhaité
    this._applyMute(event.target);
    if (this._wantPlay) {
      event.target.playVideo();
    } else {
      event.target.pauseVideo();
    }
  }

  // ── Changement d'état du player ───────────────────────────────────────────
  _onStateChange(event) {
    if (this.state === 'released') return;
    // 0 = ended → loop manuel (au cas où loop=1 ne suffit pas)
    if (event.data === 0 && this._wantPlay) {
      try { this.player?.seekTo(0); this.player?.playVideo(); } catch {}
    }
    // 1 = playing → resync son (YT peut reset le mute)
    if (event.data === 1) {
      this._applyMute(this.player);
    }
    // -1 = unstarted → relancer si désiré
    if (event.data === -1 && this._wantPlay) {
      try { this.player?.playVideo(); } catch {}
    }
  }

  // ── Application du son ────────────────────────────────────────────────────
  _applyMute(target) {
    if (!target) return;
    try {
      if (this._wantMuted) {
        target.mute();
        target.setVolume(0);
      } else {
        target.unMute();
        target.setVolume(100);
      }
    } catch {}
  }

  // ── API publique ──────────────────────────────────────────────────────────
  play() {
    this._wantPlay = true;
    try {
      if (this.player && (this.state === 'active' || this.state === 'paused')) {
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

  // ── Nettoyage complet ─────────────────────────────────────────────────────
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
      this.playerDiv = null;
      this.poster    = null;
    }, 60);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POOL MANAGER
// ─────────────────────────────────────────────────────────────────────────────
const _slots    = new Map();
const MAX_SLOTS = 5;

const _evictLRU = (keepVideoId) => {
  if (_slots.size < MAX_SLOTS) return;
  for (const [vid, slot] of _slots) {
    if (vid === keepVideoId) continue;
    if (slot.state === 'paused' || slot.state === 'released') {
      slot.destroy();
      _slots.delete(vid);
      return;
    }
  }
  // Si tous actifs, évincer le plus ancien (premier de la Map)
  for (const [vid, slot] of _slots) {
    if (vid === keepVideoId) continue;
    slot.destroy();
    _slots.delete(vid);
    return;
  }
};

const YouTubePool = {

  init() {
    injectPreconnects();
    // Précharger l'API dès l'init (sans bloquer)
    loadYouTubeApi();
  },

  warmup(videoIds = []) {
    for (const id of videoIds) preloadThumbnail(id);
  },

  getThumbnailUrl,

  /**
   * acquire(videoId, container, opts?) → slot
   *
   * opts.muted    : boolean — état initial du son (défaut: globalMuted)
   * opts.autoplay : boolean — lancer la lecture dès que prêt (défaut: true)
   */
  acquire(videoId, container, opts = {}) {
    if (!videoId || !container) {
      return {
        videoId, container, player: null, poster: null,
        state: 'idle', idleHandle: null,
        _isDestroyed: true,
        play() {}, pause() {}, setMuted() {},
      };
    }

    // Réutiliser si même videoId + même container
    const existing = _slots.get(videoId);
    if (existing && existing.container === container && existing.state !== 'released') {
      if (opts.muted !== undefined) existing._wantMuted = opts.muted;
      else existing._wantMuted = _globalMuted;
      if (opts.autoplay === false) existing._wantPlay = false;
      if (existing.state === 'paused' && existing._wantPlay) existing.play();
      existing._applyMute(existing.player);
      return existing;
    }

    // Détruire l'ancien slot (container différent)
    if (existing) { existing.destroy(); _slots.delete(videoId); }

    _evictLRU(videoId);

    // Préparer le container
    const cs = window.getComputedStyle(container);
    if (!['absolute', 'fixed', 'sticky', 'relative'].includes(cs.position)) {
      container.style.position = 'relative';
    }
    container.style.overflow = 'hidden';

    const slot = new Slot(videoId, container);

    // Appliquer les options
    slot._wantMuted = opts.muted !== undefined ? !!opts.muted : _globalMuted;
    slot._wantPlay  = opts.autoplay !== undefined ? !!opts.autoplay : true;

    _slots.set(videoId, slot);

    // Poster immédiat (thumbnail visible avant que l'iframe charge)
    const poster = buildPoster(videoId);
    container.appendChild(poster);
    slot.poster = poster;

    // Monter l'iframe en idle callback pour ne pas bloquer le rendu
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
    // Ne pas changer state ici — pause() le met à 'paused'
  },

  /**
   * setGlobalMuted — propagé à tous les slots actifs
   * À appeler depuis handleToggleMute dans AggregatedCard
   */
  setGlobalMuted,
  getGlobalMuted,

  destroy() {
    for (const slot of _slots.values()) slot.destroy();
    _slots.clear();
    _preloadedThumbs.clear();
    _preconnected  = false;
    _ytApiPromise  = null;
    _globalMuted   = true;
  },
};

export default YouTubePool;