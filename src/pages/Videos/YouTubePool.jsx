// 📁 src/pages/Videos/YouTubePool.js
// ═══════════════════════════════════════════════════════════════════════════════
// YouTubePool v3 — POSTER-FIRST + API unifiée acquire/release
//
// COMPATIBILITÉ TOTALE avec AggregatedCard v6 :
//   - YouTubePool.acquire(videoId, container) → slot   ✅
//   - YouTubePool.release(slot)                        ✅
//   - YouTubePool.warmup(ids[])                        ✅ (inchangé)
//   - YouTubePool.init()                               ✅ (inchangé)
//   - YouTubePool.destroy()                            ✅ (inchangé)
//
// GAIN DE VITESSE :
//   Avant  → iframe YouTube montée immédiatement → 800 KB JS → 2-4 s de blanc
//   Après  → thumbnail JPG affichée < 16 ms → iframe montée après idle → fondu
//
// FONCTIONNEMENT :
//   1. acquire() injecte un poster (img thumbnail + icône play) dans le container
//      → visible en < 16 ms, zéro iframe, zéro réseau YouTube
//   2. requestIdleCallback (~50-250 ms) → iframe créée et ajoutée silencieusement
//   3. onload iframe → opacité 0→1, poster fondu et retiré du DOM
//   4. release() → postMessage pause, retire iframe + poster proprement
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// PRECONNECT — économise 200-400 ms DNS+TLS sur le premier embed
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
    const pc  = document.createElement('link');
    pc.rel    = 'preconnect';
    pc.href   = origin;
    pc.crossOrigin = 'anonymous';
    document.head.appendChild(pc);
    const dns = document.createElement('link');
    dns.rel   = 'dns-prefetch';
    dns.href  = origin;
    document.head.appendChild(dns);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// THUMBNAIL PRELOAD
// ─────────────────────────────────────────────────────────────────────────────
const _preloadedThumbs = new Set();

const getThumbnailUrl = (videoId) =>
  `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

const preloadThumbnail = (videoId) => {
  if (!videoId || _preloadedThumbs.has(videoId)) return;
  _preloadedThumbs.add(videoId);
  const img = new Image();
  img.src = getThumbnailUrl(videoId);
};

// ─────────────────────────────────────────────────────────────────────────────
// BUILDERS
// ─────────────────────────────────────────────────────────────────────────────
const buildIframe = (videoId) => {
  const iframe = document.createElement('iframe');
  const params = new URLSearchParams({
    autoplay:       '1',
    mute:           '1',
    loop:           '1',
    playlist:       videoId,      // nécessaire pour loop=1
    playsinline:    '1',
    controls:       '0',
    rel:            '0',
    modestbranding: '1',
    enablejsapi:    '1',
    origin:         typeof window !== 'undefined' ? window.location.origin : '',
    iv_load_policy: '3',
    fs:             '0',
  });
  iframe.src             = `https://www.youtube.com/embed/${videoId}?${params}`;
  iframe.allow           = 'autoplay; fullscreen; picture-in-picture';
  iframe.allowFullscreen = true;
  iframe.style.cssText   = [
    'position:absolute', 'inset:0', 'width:100%', 'height:100%',
    'border:none', 'opacity:0', 'transition:opacity 0.3s ease', 'z-index:1',
  ].join(';');
  iframe.setAttribute('title', 'YouTube video');
  return iframe;
};

const buildPoster = (videoId) => {
  const wrapper = document.createElement('div');
  wrapper.style.cssText = [
    'position:absolute', 'inset:0', 'width:100%', 'height:100%',
    'background:#080810', 'overflow:hidden', 'transition:opacity 0.35s ease', 'z-index:2',
  ].join(';');

  // Thumbnail
  const img    = document.createElement('img');
  img.src      = getThumbnailUrl(videoId);
  img.alt      = '';
  img.loading  = 'eager';
  img.decoding = 'async';
  img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
  wrapper.appendChild(img);

  // Icône play SVG
  const playWrap = document.createElement('div');
  playWrap.style.cssText = [
    'position:absolute', 'inset:0', 'display:flex',
    'align-items:center', 'justify-content:center', 'pointer-events:none',
  ].join(';');
  playWrap.innerHTML = `
    <svg width="56" height="56" viewBox="0 0 56 56" fill="none"
      style="filter:drop-shadow(0 2px 12px rgba(0,0,0,.6))">
      <circle cx="28" cy="28" r="28" fill="rgba(0,0,0,.52)"/>
      <path d="M22 18.5L40 28L22 37.5V18.5Z" fill="white"/>
    </svg>`;
  wrapper.appendChild(playWrap);

  // Badge YouTube
  const badge = document.createElement('div');
  badge.style.cssText = [
    'position:absolute', 'top:12px', 'right:12px',
    'background:#ff0000', 'border-radius:4px', 'padding:3px 6px',
    'display:flex', 'align-items:center', 'gap:4px',
  ].join(';');
  badge.innerHTML = `
    <svg width="14" height="10" viewBox="0 0 14 10" fill="white">
      <path d="M13.7 1.56A1.76 1.76 0 0 0 12.46.32C11.37 0 7 0 7 0S2.63 0 1.54.32A1.76 1.76 0 0 0 .3 1.56 18.4 18.4 0 0 0 0 5a18.4 18.4 0 0 0 .3 3.44 1.76 1.76 0 0 0 1.24 1.24C2.63 10 7 10 7 10s4.37 0 5.46-.32a1.76 1.76 0 0 0 1.24-1.24A18.4 18.4 0 0 0 14 5a18.4 18.4 0 0 0-.3-3.44Z"/>
      <path d="M5.6 7.14 9.23 5 5.6 2.86v4.28Z" fill="#ff0000"/>
    </svg>
    <span style="color:white;font-size:9px;font-weight:700;letter-spacing:.04em">YouTube</span>`;
  wrapper.appendChild(badge);

  return wrapper;
};

// ─────────────────────────────────────────────────────────────────────────────
// SLOTS MAP
// ─────────────────────────────────────────────────────────────────────────────
// slot = { videoId, container, iframe, poster, state, idleHandle }
// state: 'loading' | 'ready' | 'active' | 'released'
const _slots = new Map();

// ─────────────────────────────────────────────────────────────────────────────
// INTERNE — détruire un slot sans passer par release()
// ─────────────────────────────────────────────────────────────────────────────
const _destroySlot = (slot) => {
  if (!slot) return;
  // Annuler le montage différé si en cours
  if (slot.idleHandle != null) {
    try {
      if ('cancelIdleCallback' in window) cancelIdleCallback(slot.idleHandle);
      else clearTimeout(slot.idleHandle);
    } catch {}
    slot.idleHandle = null;
  }
  try { slot.iframe?.remove(); }  catch {}
  try { slot.poster?.remove(); }  catch {}
  _slots.delete(slot.videoId);
};

// ─────────────────────────────────────────────────────────────────────────────
// API PUBLIQUE
// ─────────────────────────────────────────────────────────────────────────────
const YouTubePool = {

  /** Initialisation globale — une seule fois au montage du feed */
  init() {
    injectPreconnects();
  },

  /**
   * Préchauffer des IDs YouTube : thumbnail en cache navigateur + DNS.
   * Appelé par VideosPage.notifyActive() pour les N slides suivantes.
   */
  warmup(videoIds = []) {
    for (const id of videoIds) preloadThumbnail(id);
  },

  /** URL de thumbnail publique (utilitaire) */
  getThumbnailUrl,

  /**
   * acquire(videoId, container) → slot
   *
   * Affiche immédiatement le poster dans container, puis monte l'iframe
   * YouTube en arrière-plan via requestIdleCallback.
   *
   * Compatible API AggregatedCard v6.
   */
  acquire(videoId, container) {
    if (!videoId || !container) {
      return { videoId, container, iframe: null, poster: null, state: 'idle', idleHandle: null };
    }

    // Réutiliser le slot existant si même container
    const existing = _slots.get(videoId);
    if (existing && existing.container === container) return existing;

    // Nettoyer un slot orphelin sur cet ID
    if (existing) _destroySlot(existing);

    // S'assurer que le container a position:relative pour les enfants absolus
    if (container.style.position !== 'absolute' && container.style.position !== 'fixed') {
      container.style.position = 'relative';
    }
    container.style.overflow = 'hidden';

    const slot = {
      videoId,
      container,
      iframe:     null,
      poster:     null,
      state:      'loading',
      idleHandle: null,
    };
    _slots.set(videoId, slot);

    // ── ÉTAPE 1 : Poster instantané ────────────────────────────────────────
    const poster = buildPoster(videoId);
    container.appendChild(poster);
    slot.poster = poster;

    // ── ÉTAPE 2 : Iframe en différé ────────────────────────────────────────
    let iframeMounted = false;
    const mountIframe = () => {
      if (iframeMounted || !_slots.has(videoId)) return;
      iframeMounted    = true;
      slot.idleHandle  = null;

      const iframe = buildIframe(videoId);
      container.appendChild(iframe);
      slot.iframe = iframe;
      slot.state  = 'loading';

      iframe.addEventListener('load', () => {
        if (!_slots.has(videoId)) return;   // slot déjà libéré
        slot.state = 'ready';

        // Révéler l'iframe en fondu
        iframe.style.opacity = '1';

        // Masquer puis supprimer le poster
        setTimeout(() => {
          if (!slot.poster) return;
          slot.poster.style.opacity = '0';
          setTimeout(() => {
            try { slot.poster?.remove(); } catch {}
            slot.poster = null;
            slot.state  = 'active';
          }, 380);
        }, 300);
      }, { once: true });
    };

    if ('requestIdleCallback' in window) {
      slot.idleHandle = requestIdleCallback(mountIframe, { timeout: 200 });
    } else {
      slot.idleHandle = setTimeout(mountIframe, 60);
    }

    return slot;
  },

  /**
   * release(slot)
   *
   * Met en pause la vidéo et retire proprement iframe + poster du DOM.
   * Compatible API AggregatedCard v6.
   */
  release(slot) {
    if (!slot || slot.state === 'released') return;
    slot.state = 'released';

    // Pause via postMessage (silencieux si iframe pas encore prête)
    try {
      slot.iframe?.contentWindow?.postMessage(
        JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }), '*'
      );
    } catch {}

    // Annuler le montage si pas encore effectué
    if (slot.idleHandle != null) {
      try {
        if ('cancelIdleCallback' in window) cancelIdleCallback(slot.idleHandle);
        else clearTimeout(slot.idleHandle);
      } catch {}
      slot.idleHandle = null;
    }

    // Retrait doux (laisser la pause se propager)
    setTimeout(() => {
      try { slot.iframe?.remove(); } catch {}
      try { slot.poster?.remove(); } catch {}
      _slots.delete(slot.videoId);
    }, 140);
  },

  /**
   * Cleanup global — appelé au unmount du composant parent (VideosPage).
   */
  destroy() {
    for (const slot of _slots.values()) {
      _destroySlot(slot);
    }
    _slots.clear();
    _preloadedThumbs.clear();
    _preconnected = false;
  },
};

export default YouTubePool;