// 📁 src/pages/Videos/YouTubePool.jsx
// ═══════════════════════════════════════════════════════════════════════════
// YOUTUBE IFRAME POOL — zéro reload, lecture instantanée
//
// Problème : chaque <iframe> YouTube charge ~500kb de JS + négocie avec
// les serveurs YT avant de jouer. Contrairement aux vidéos directes, on
// ne peut pas précharger via fetch(). La seule solution : maintenir un pool
// d'iframes vivantes dans le DOM (off-screen), prêtes à être déplacées dans
// le container de la slide active.
//
// Architecture :
//   - POOL_SIZE iframes off-screen montées dès l'init (ou à la demande)
//   - warmup(videoIds[]) : charge les N prochaines vidéos en avance
//   - acquire(videoId)   : retourne une iframe prête (DOM node)
//   - release(iframe)    : remet l'iframe dans le pool (pause + off-screen)
//
// Cycle de vie d'une iframe :
//   idle (off-screen, src vide) → warming (src injecté, player JS load)
//     → ready (onReady reçu) → active (in card) → released → idle/ready
//
// Usage dans AggregatedCard :
//   const iframeRef = useRef(null);
//   useEffect(() => {
//     const node = YouTubePool.acquire(videoId, containerRef.current);
//     iframeRef.current = node;
//     return () => YouTubePool.release(node);
//   }, [videoId]);
// ═══════════════════════════════════════════════════════════════════════════

const POOL_SIZE   = 3;   // iframes maintenues en vie simultanément
const MAX_POOL    = 6;   // plafond absolu (mémoire)
const READY_TIMEOUT = 12000; // ms avant abandon si onReady ne répond pas

// Container off-screen partagé par toutes les iframes du pool
let _container = null;
const getContainer = () => {
  if (_container) return _container;
  if (typeof document === 'undefined') return null;
  _container = document.createElement('div');
  _container.id = 'yt-pool-container';
  Object.assign(_container.style, {
    position:   'fixed',
    top:        '-9999px',
    left:       '-9999px',
    width:      '1px',
    height:     '1px',
    overflow:   'hidden',
    pointerEvents: 'none',
    visibility: 'hidden',
    zIndex:     '-1',
  });
  document.body.appendChild(_container);
  return _container;
};

// ─────────────────────────────────────────────────────────────────────────
// Slot — une iframe avec son état
// ─────────────────────────────────────────────────────────────────────────
class Slot {
  constructor() {
    this.iframe    = document.createElement('iframe');
    this.videoId   = null;
    this.state     = 'idle';    // idle | warming | ready | active
    this.readyTimer = null;

    Object.assign(this.iframe, {
      allow:      'autoplay; fullscreen; picture-in-picture; encrypted-media',
      frameBorder:'0',
      allowFullscreen: true,
    });
    Object.assign(this.iframe.style, {
      position: 'absolute',
      width:    '100%',
      height:   '100%',
      border:   'none',
      top:      '0',
      left:     '0',
    });

    // Écouter onReady depuis cette iframe
    this._onMessage = this._handleMessage.bind(this);
    window.addEventListener('message', this._onMessage);

    getContainer()?.appendChild(this.iframe);
  }

  _handleMessage(event) {
    if (!event.origin?.includes('youtube.com')) return;
    let data;
    try { data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data; } catch { return; }

    // Vérifier que ce message vient bien de cette iframe
    if (event.source !== this.iframe.contentWindow) return;

    if (data?.event === 'onReady') {
      if (this.readyTimer) { clearTimeout(this.readyTimer); this.readyTimer = null; }
      this.state = 'ready';
      // Pause immédiate (on ne joue pas hors-écran)
      this._postCmd('pauseVideo');
      // Couper le son (requis pour rester off-screen sans bruit)
      this._postCmd('mute');
    }

    // Loop de secours
    if (data?.event === 'onStateChange' && data?.info === 0) {
      this._postCmd('seekTo', [0, true]);
    }
  }

  _postCmd(func, args = []) {
    try {
      this.iframe.contentWindow?.postMessage(
        JSON.stringify({ event: 'command', func, args }), '*'
      );
    } catch {}
  }

  _buildSrc(videoId) {
    const origin = typeof window !== 'undefined'
      ? encodeURIComponent(window.location.origin)
      : '';
    return [
      `https://www.youtube.com/embed/${videoId}`,
      `?enablejsapi=1`,
      `&autoplay=1`,
      `&mute=1`,
      `&loop=1`,
      `&playlist=${videoId}`,
      `&origin=${origin}`,
      `&rel=0`,
      `&modestbranding=1`,
      `&playsinline=1`,
      `&controls=0`,
      `&iv_load_policy=3`,
      `&fs=0`,
      `&disablekb=1`,
    ].join('');
  }

  // Charger un videoId dans ce slot (warmup)
  load(videoId) {
    if (this.videoId === videoId && this.state !== 'idle') return;
    this.videoId = videoId;
    this.state   = 'warming';

    if (this.readyTimer) { clearTimeout(this.readyTimer); }
    // Timeout de secours si YouTube ne répond pas
    this.readyTimer = setTimeout(() => {
      if (this.state === 'warming') this.state = 'ready'; // on tente quand même
    }, READY_TIMEOUT);

    this.iframe.src = this._buildSrc(videoId);
  }

  // Déplacer cette iframe dans un container cible (la slide active)
  mountTo(container) {
    if (!container) return;
    this.state = 'active';
    container.appendChild(this.iframe);
    Object.assign(this.iframe.style, {
      position: 'absolute',
      inset:    '0',
      width:    '100%',
      height:   '100%',
    });
  }

  // Remettre off-screen après utilisation
  returnToPool() {
    this.state = 'ready'; // garde le player chargé
    this._postCmd('pauseVideo');
    this._postCmd('mute');
    // Remettre dans le container off-screen
    const c = getContainer();
    if (c && this.iframe.parentElement !== c) {
      c.appendChild(this.iframe);
    }
    Object.assign(this.iframe.style, {
      position: 'absolute',
      inset:    'auto',
      top:      '0',
      left:     '0',
      width:    '100%',
      height:   '100%',
    });
  }

  // Changer de vidéo sans détruire le slot (reload iframe)
  reload(videoId) {
    this.videoId = videoId;
    this.state   = 'warming';
    if (this.readyTimer) { clearTimeout(this.readyTimer); }
    this.readyTimer = setTimeout(() => {
      if (this.state === 'warming') this.state = 'ready';
    }, READY_TIMEOUT);
    this.iframe.src = this._buildSrc(videoId);
  }

  destroy() {
    window.removeEventListener('message', this._onMessage);
    if (this.readyTimer) clearTimeout(this.readyTimer);
    this.iframe.remove();
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Pool singleton
// ─────────────────────────────────────────────────────────────────────────
class YouTubePoolSingleton {
  constructor() {
    this._slots    = [];
    this._initDone = false;
  }

  // Appeler une seule fois au montage de VideosPage
  init() {
    if (this._initDone || typeof document === 'undefined') return;
    this._initDone = true;
    for (let i = 0; i < POOL_SIZE; i++) {
      this._slots.push(new Slot());
    }
  }

  // Précharger les prochaines vidéos (appeler depuis notifyActive)
  warmup(videoIds = []) {
    if (!this._initDone) this.init();

    videoIds.slice(0, POOL_SIZE).forEach((id, i) => {
      if (!id) return;
      // Déjà warm pour cet id ?
      const existing = this._slots.find(s => s.videoId === id && s.state !== 'idle');
      if (existing) return;

      // Trouver un slot idle
      let slot = this._slots.find(s => s.state === 'idle');
      if (!slot) {
        // Pas de slot idle — prendre un slot 'ready' non-actif le moins récent
        slot = this._slots.find(s => s.state === 'ready');
      }
      if (!slot && this._slots.length < MAX_POOL) {
        // Créer un nouveau slot si sous le plafond
        slot = new Slot();
        this._slots.push(slot);
      }
      if (slot) slot.load(id);
    });
  }

  // Acquérir une iframe pour un videoId donné et la monter dans container
  // Retourne l'objet Slot (pour pouvoir appeler release plus tard)
  acquire(videoId, container) {
    if (!this._initDone) this.init();

    // 1. Chercher un slot ready avec exactement ce videoId
    let slot = this._slots.find(s => s.videoId === videoId && s.state === 'ready');

    // 2. Sinon, prendre n'importe quel slot ready et changer sa vidéo
    if (!slot) {
      slot = this._slots.find(s => s.state === 'ready');
      if (slot) slot.reload(videoId);
    }

    // 3. Sinon, prendre un slot warming (accepter le délai résiduel)
    if (!slot) {
      slot = this._slots.find(s => s.videoId === videoId && s.state === 'warming');
    }

    // 4. Dernier recours : créer un slot frais
    if (!slot) {
      if (this._slots.length < MAX_POOL) {
        slot = new Slot();
        this._slots.push(slot);
      } else {
        // Recycler le moins bon slot (idle ou warming non-prioritaire)
        slot = this._slots.find(s => s.state !== 'active') || this._slots[0];
      }
      slot.load(videoId);
    }

    slot.mountTo(container);
    return slot;
  }

  // Remettre un slot dans le pool après unmount de la slide
  release(slot) {
    if (!slot || !(slot instanceof Slot)) return;
    slot.returnToPool();
  }

  // Destruire proprement tous les slots (cleanup VideosPage)
  destroy() {
    this._slots.forEach(s => s.destroy());
    this._slots    = [];
    this._initDone = false;
    _container?.remove();
    _container = null;
  }
}

const YouTubePool = new YouTubePoolSingleton();
export default YouTubePool;