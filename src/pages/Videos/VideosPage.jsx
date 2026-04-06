// 📁 src/pages/Videos/VideosPage.jsx  — v9 YOUTUBE POOL
//
// ═══════════════════════════════════════════════════════════════════════════════
// NOUVEAUTÉS v9
//
//  🎬 YOUTUBE IFRAME POOL
//     - YouTubePool.init() au premier chargement
//     - extractYoutubeIds() lit le feed pour trouver les prochains embeds YT
//     - notifyActive() appelle YouTubePool.warmup(nextIds) à chaque slide
//       → les iframes des N slides suivantes chargent en arrière-plan
//     - YouTubePool.destroy() dans le cleanup du composant
//
//  🔒 HÉRITAGE v8 INTÉGRAL — rien de cassé
// ═══════════════════════════════════════════════════════════════════════════════

import React, {
  useState, useEffect, useRef, useCallback, memo,
  createContext, useContext, useMemo, startTransition,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useVideos } from '../../context/VideoContext';
import VideoCard, { isFeedLocked } from './VideoCard';
import AggregatedCard from './AggregatedCard';
import VideoModal from './VideoModal';
import VideoAd from './Publicite/VideoAd.jsx';
import YouTubePool from './YouTubePool';
import { FaPlus, FaSearch, FaArrowLeft, FaTimes, FaFire, FaCompass } from 'react-icons/fa';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api$/, '');

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG ADAPTATIVE
// ─────────────────────────────────────────────────────────────────────────────
const CONFIG = {
  ads:           { enabled: true, frequency: 8 },
  aggregated:    { enabled: true, initialLoad: 40, loadMore: 25 },
  virtual:       5,
  bufferAhead:   10,
  bufferMin:     6,
  recycleMin:    8,
  preloadAhead:  3,
  ytWarmupAhead: 3,   // nombre de slides YouTube à préchauffer en avance
  minFeedSize:   12,
  momentumLock:  280,
  watchScoreMin: 0.15,
};

// ─────────────────────────────────────────────────────────────────────────────
// 🔌 FILTRE DE JOUABILITÉ ÉTENDU
// ─────────────────────────────────────────────────────────────────────────────
const VALID_HOSTS  = [
  'cdn.pixabay.com/video', 'res.cloudinary.com',
  'player.pixabay.com', 'vimeocdn.com',
  'player.vimeo.com', 'youtube.com/embed',
];
const PLAYABLE_EXT = /\.(mp4|webm|mov)(\?|$)/i;
const BLOCKED_URL  = ['youtu.be', 'dailymotion.', 'pexels.com'];

const isPlayableCandidate = (item) => {
  if (!item) return false;
  if (item.source === 'pexels') return false;

  if (item.isEmbed && item.embedUrl) {
    const embed = item.embedUrl.toLowerCase();
    return embed.includes('youtube.com/embed') || embed.includes('player.vimeo.com');
  }

  const url = item.videoUrl || item.url || '';
  if (!url) return false;
  if (url.includes('.m3u8')) return false;
  if (BLOCKED_URL.some(p => url.includes(p))) return false;
  if (url.includes('pexels.com')) return false;
  if (url.includes('vimeo.com') && !url.includes('vimeocdn.com') && !url.includes('player.vimeo.com')) return false;
  if (VALID_HOSTS.some(h => url.includes(h))) return true;
  if (PLAYABLE_EXT.test(url)) return true;
  if (item.source === 'pixabay' && item.externalId) return true;
  return false;
};

// ─────────────────────────────────────────────────────────────────────────────
// 🎬 HELPER — extrait les videoIds YouTube des N prochains items du feed
// ─────────────────────────────────────────────────────────────────────────────
const extractYoutubeIds = (items, fromIndex, count = 3) => {
  const ids = [];
  for (let i = fromIndex; i < items.length && ids.length < count; i++) {
    const item = items[i];
    if (!item?.data?.isEmbed) continue;
    const embedUrl = item.data.embedUrl || item.data.videoUrl || '';
    const match    = embedUrl.match(/youtube\.com\/embed\/([^?&/]+)/);
    if (match?.[1]) ids.push(match[1]);
  }
  return ids;
};

// ─────────────────────────────────────────────────────────────────────────────
// CSS GLOBAL
// ─────────────────────────────────────────────────────────────────────────────
const VP_CSS = `
  @keyframes vp-spin    { to { transform: rotate(360deg); } }
  @keyframes vp-shimmer { 0%{transform:translateX(-100%) skewX(-12deg)} 100%{transform:translateX(250%) skewX(-12deg)} }
  @keyframes vp-pulse   { 0%,100%{opacity:.3} 50%{opacity:.65} }
  @keyframes vp-fadeup  { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  @keyframes vp-streak  { 0%{transform:scale(0.7);opacity:0} 60%{transform:scale(1.15)} 100%{transform:scale(1);opacity:1} }
  @keyframes vp-glow    { 0%,100%{box-shadow:0 0 0 0 rgba(255,100,50,0)} 50%{box-shadow:0 0 14px 3px rgba(255,100,50,0.4)} }
  @keyframes vp-bounce  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
  @keyframes vp-flash   { 0%{opacity:0.18} 100%{opacity:0} }
  .vp-sk-layer { position:absolute;inset:0;z-index:5;display:flex;flex-direction:column;overflow:hidden;pointer-events:none;transition:opacity 0.4s ease; }
  .vp-feed-ready .vp-sk-layer { opacity:0;pointer-events:none; }
  .vp-sk-slide { flex-shrink:0;position:relative;overflow:hidden;height:calc(var(--vh,1vh)*100);min-height:calc(var(--vh,1vh)*100);max-height:calc(var(--vh,1vh)*100); }
  .vp-sk-slide::after { content:'';position:absolute;inset:0;background:linear-gradient(105deg,transparent 38%,rgba(255,255,255,0.032) 50%,transparent 62%);animation:vp-shimmer 2.6s linear infinite; }
  .vp-sk-bar { height:10px;border-radius:9999px;background:rgba(255,255,255,0.07);animation:vp-pulse 2s ease-in-out infinite; }
  .vp-sk-dot { border-radius:9999px;background:rgba(255,255,255,0.07);flex-shrink:0;animation:vp-pulse 2s ease-in-out infinite; }
  .vp-scroll::-webkit-scrollbar { display:none; }
  .vp-scroll { -ms-overflow-style:none;scrollbar-width:none;overflow-anchor:none; }
  .vp-ph { flex-shrink:0;height:calc(var(--vh,1vh)*100);min-height:calc(var(--vh,1vh)*100);max-height:calc(var(--vh,1vh)*100);background:#080810; }
  .vp-slide-flash { position:absolute;inset:0;z-index:50;background:rgba(0,0,0,0.28);pointer-events:none;animation:vp-flash 0.22s ease-out forwards; }
  .vp-progress-ring { transform-origin:center;transform:rotate(-90deg); }
  .vp-progress-ring circle { transition:stroke-dashoffset 0.18s linear;stroke-linecap:round; }
  .vp-streak-badge { animation:vp-streak 0.32s cubic-bezier(0.34,1.56,0.64,1) both; }
  .vp-swipe-arrow  { animation:vp-bounce 1.8s ease-in-out infinite; }
  .vp-tab-dot { width:5px;height:5px;border-radius:50%;background:#ff4d4d;flex-shrink:0;animation:vp-glow 2s ease-in-out infinite; }
  .vp-ptr-spinner { width:26px;height:26px;border-radius:50%;border:2.5px solid rgba(255,255,255,0.15);border-top-color:rgba(255,255,255,0.65);animation:vp-spin 0.7s linear infinite; }
`;

let _cssInjected = false;
const ensureCSS = () => {
  if (_cssInjected || typeof document === 'undefined') return;
  _cssInjected = true;
  if (document.getElementById('vp-styles')) return;
  const s = document.createElement('style');
  s.id = 'vp-styles'; s.textContent = VP_CSS;
  document.head.insertBefore(s, document.head.firstChild);
};

// ─────────────────────────────────────────────────────────────────────────────
// SMART RECYCLE
// ─────────────────────────────────────────────────────────────────────────────
const detectBTPLocal = (item) => {
  if (!item) return false;
  const BTP_KW = ['chantier','construction','btp','béton','beton','ciment',
    'grue','pelleteuse','pont','route','hydraulique','terrassement',
    'civil engineering','concrete','scaffolding','formwork','rebar'];
  const text = [item.title || '', item.description || '', item.channelName || '',
    item.category || '', item._searchQuery || ''].join(' ').toLowerCase();
  return BTP_KW.some(kw => text.includes(kw));
};

// ─────────────────────────────────────────────────────────────────────────────
// PROBES CLOUDINARY
// ─────────────────────────────────────────────────────────────────────────────
const CLOUDINARY_PROBE_TIMEOUT = 5000;
const probeCloudinaryVideo = (url, onInvalid) => {
  if (!url || !url.includes('res.cloudinary.com')) return;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), CLOUDINARY_PROBE_TIMEOUT);
  fetch(url, { method:'HEAD', cache:'no-store', signal:ctrl.signal })
    .then(r => { clearTimeout(timer); if ([401,403,404,410].includes(r.status)) onInvalid(); })
    .catch(() => clearTimeout(timer));
};
const needsCloudinaryProbe = (item) => {
  if (item._isAggregated) return false;
  return (item.cloudinaryUrl || item.videoUrl || item.url || '').includes('res.cloudinary.com');
};
const probeItemBackground = (item, onInvalid) => {
  if (item._isAggregated) return;
  if (item.isEmbed) return;
  const url = item.cloudinaryUrl || item.videoUrl || item.url || '';
  if (!url) { onInvalid(); return; }
  if (url.includes('res.cloudinary.com')) { probeCloudinaryVideo(url, onInvalid); return; }
  fetch(url, { method:'HEAD', cache:'no-store' })
    .then(r => { if (r.status === 404 || r.status === 410) onInvalid(); })
    .catch(() => {});
};

// ─────────────────────────────────────────────────────────────────────────────
// WATCH SCORE
// ─────────────────────────────────────────────────────────────────────────────
class WatchScoreTracker {
  constructor() { this._map = new Map(); this._active = null; }
  enter(uid) {
    if (this._active) this._leave(this._active);
    this._active = uid;
    if (!this._map.has(uid)) this._map.set(uid, { start: Date.now(), total: 0, score: 0 });
    else this._map.get(uid).start = Date.now();
  }
  _leave(uid) {
    const r = this._map.get(uid);
    if (!r || !r.start) return;
    r.total += Date.now() - r.start; r.start = null;
    r.score = Math.min(1, r.total / 30000);
  }
  leave(uid)    { if (this._active === uid) this._active = null; this._leave(uid); }
  getScore(uid) { return this._map.get(uid)?.score ?? 0; }
  clear()       { this._map.clear(); this._active = null; }
}
const watchScore = new WatchScoreTracker();

// ─────────────────────────────────────────────────────────────────────────────
// ADAPTIVE BUFFER
// ─────────────────────────────────────────────────────────────────────────────
class AdaptiveBuffer {
  constructor() { this._times = []; this._value = CONFIG.bufferAhead; }
  record(now = Date.now()) {
    this._times.push(now);
    if (this._times.length > 6) this._times.shift();
    if (this._times.length >= 2) {
      const intervals = [];
      for (let i = 1; i < this._times.length; i++) intervals.push(this._times[i] - this._times[i-1]);
      const avg = intervals.reduce((a,b) => a+b, 0) / intervals.length;
      this._value = avg < 600 ? Math.min(CONFIG.bufferAhead + 6, 20) : CONFIG.bufferAhead;
    }
    return this._value;
  }
  get value() { return this._value; }
  reset()     { this._times = []; this._value = CONFIG.bufferAhead; }
}
const adaptiveBuf = new AdaptiveBuffer();

// ─────────────────────────────────────────────────────────────────────────────
// PRELOAD
// ─────────────────────────────────────────────────────────────────────────────
const _preloadedUrls = new Set();
const injectPreload = (item) => {
  if (!item?.data) return;
  if (item.data.isEmbed) return;
  const url = item.data.cloudinaryUrl || item.data.videoUrl || item.data.url || '';
  if (!url || _preloadedUrls.has(url) || url.includes('.m3u8')) return;
  _preloadedUrls.add(url);
  const run = () => { try { fetch(url, { method:'GET', headers:{ Range:'bytes=0-65535' }, cache:'force-cache' }).catch(() => {}); } catch {} };
  if ('requestIdleCallback' in window) requestIdleCallback(run, { timeout: 2000 });
  else setTimeout(run, 300);
};

// ─────────────────────────────────────────────────────────────────────────────
// SMART RECYCLE v2
// ─────────────────────────────────────────────────────────────────────────────
let _recycleRound = 0;
const smartRecycle = (pool) => {
  _recycleRound++;
  const sorted = [...pool].sort((a, b) => {
    const btpA = detectBTPLocal(a) ? 0.3 : 0;
    const btpB = detectBTPLocal(b) ? 0.3 : 0;
    const scoreA = watchScore.getScore(`agg-${a._id || a.externalId}`) + (a.likes || 0) * 0.0001 + btpA;
    const scoreB = watchScore.getScore(`agg-${b._id || b.externalId}`) + (b.likes || 0) * 0.0001 + btpB;
    return scoreB - scoreA;
  });
  const cutoff = Math.floor(sorted.length * 0.3);
  return [
    ...sorted.slice(0, cutoff),
    ...sorted.slice(cutoff).sort(() => Math.random() - 0.5),
  ].map(item => ({
    ...item,
    _uid: `rec-${_recycleRound}-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
  }));
};

// ─────────────────────────────────────────────────────────────────────────────
// VIRAL BOOST
// ─────────────────────────────────────────────────────────────────────────────
let _adCounter = 0;
const applyViralBoost = (items) => {
  const viral = items.filter(i => {
    if (detectBTPLocal(i)) return (i.likes || 0) > 500 || (i.views || 0) > 25000;
    return (i.likes || 0) > 1000 || (i.views || 0) > 50000;
  });
  const normal = items.filter(i => !viral.includes(i));
  const result = []; let vi = 0;
  for (let i = 0; i < normal.length; i++) {
    result.push(normal[i]);
    if ((i + 1) % 4 === 0 && vi < viral.length) result.push(viral[vi++]);
  }
  while (vi < viral.length) result.push(viral[vi++]);
  return result;
};

// ─────────────────────────────────────────────────────────────────────────────
// VH FIX
// ─────────────────────────────────────────────────────────────────────────────
const useVhFix = () => {
  useEffect(() => {
    const set = () => document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
    set();
    window.addEventListener('resize', set, { passive: true });
    return () => window.removeEventListener('resize', set);
  }, []);
};

const SLIDE_STYLE = {
  height: 'calc(var(--vh,1vh)*100)',
  minHeight: 'calc(var(--vh,1vh)*100)',
  maxHeight: 'calc(var(--vh,1vh)*100)',
  flexShrink: 0,
};

// ─────────────────────────────────────────────────────────────────────────────
// CONTEXTS
// ─────────────────────────────────────────────────────────────────────────────
const ActiveIndexContext = createContext(null);
const ModalOpenContext   = createContext(false);

const useOnline = () => {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return online;
};

// ─────────────────────────────────────────────────────────────────────────────
// UI COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────
const ProgressRing = memo(({ progress = 0, size = 36, stroke = 2.5 }) => {
  const r = (size - stroke * 2) / 2, circ = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={stroke} />
      <circle className="vp-progress-ring" cx={size/2} cy={size/2} r={r} fill="none"
        stroke="url(#vpGrad)" strokeWidth={stroke} strokeDasharray={circ}
        strokeDashoffset={circ * (1 - Math.max(0, Math.min(1, progress)))}
        style={{ transform:'rotate(-90deg)', transformOrigin:'50% 50%' }} />
      <defs><linearGradient id="vpGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#ff6b35" /><stop offset="100%" stopColor="#e91e8c" />
      </linearGradient></defs>
    </svg>
  );
});
ProgressRing.displayName = 'ProgressRing';

const WatchStreakBadge = memo(({ count }) => {
  if (count < 3) return null;
  return (
    <div className="vp-streak-badge absolute top-16 left-1/2 -translate-x-1/2 z-40 pointer-events-none"
      style={{ background:'rgba(0,0,0,0.55)', backdropFilter:'blur(12px)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:9999, padding:'4px 12px', display:'flex', alignItems:'center', gap:6 }}>
      <span style={{ fontSize:13 }}>{count >= 20 ? '🔥🔥' : count >= 10 ? '🔥' : '✨'}</span>
      <span style={{ color:'rgba(255,255,255,0.75)', fontSize:11, fontWeight:700 }}>{count} vues</span>
    </div>
  );
});
WatchStreakBadge.displayName = 'WatchStreakBadge';

const OfflineBanner = memo(({ show }) => (
  <AnimatePresence>{show && (
    <motion.div initial={{ y:-40, opacity:0 }} animate={{ y:0, opacity:1 }} exit={{ y:-40, opacity:0 }}
      className="absolute top-0 left-0 right-0 z-[60] pointer-events-none flex justify-center"
      style={{ paddingTop:'max(52px, calc(env(safe-area-inset-top) + 52px))' }}>
      <div style={{ background:'rgba(20,20,20,0.92)', backdropFilter:'blur(16px)', border:'1px solid rgba(255,80,80,0.3)', borderRadius:9999, padding:'6px 16px', display:'flex', alignItems:'center', gap:8 }}>
        <div style={{ width:7, height:7, borderRadius:'50%', background:'#ff4d4d' }} />
        <span style={{ color:'rgba(255,255,255,0.7)', fontSize:11, fontWeight:600 }}>Hors ligne — les vidéos en cache sont disponibles</span>
      </div>
    </motion.div>
  )}</AnimatePresence>
));
OfflineBanner.displayName = 'OfflineBanner';

const PullToRefresh = memo(({ progress, refreshing }) => {
  if (progress < 0.05 && !refreshing) return null;
  return (
    <div style={{ position:'absolute', top:0, left:0, right:0, zIndex:55, display:'flex', justifyContent:'center', alignItems:'center', height:`${Math.min(72, progress * 72)}px`, pointerEvents:'none', overflow:'hidden' }}>
      <div style={{ background:'rgba(0,0,0,0.6)', backdropFilter:'blur(14px)', borderRadius:9999, padding:'8px 16px', display:'flex', alignItems:'center', gap:8, opacity:Math.min(1, progress * 2), transform:`scale(${0.8 + Math.min(0.2, progress * 0.2)})`, transition:'opacity 0.1s, transform 0.1s' }}>
        {refreshing ? <div className="vp-ptr-spinner" /> :
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M9 3v3M9 3L7 5M9 3l2 2" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform:`rotate(${progress * 180}deg)`, transformOrigin:'50% 50%', transition:'transform 0.1s' }} />
            <path d="M3 9a6 6 0 1 0 12 0 6 6 0 0 0-12 0" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
          </svg>}
        <span style={{ color:'rgba(255,255,255,0.55)', fontSize:11, fontWeight:600 }}>
          {refreshing ? 'Actualisation…' : progress > 0.8 ? 'Relâcher pour rafraîchir' : 'Tirer pour rafraîchir'}
        </span>
      </div>
    </div>
  );
});
PullToRefresh.displayName = 'PullToRefresh';

const SlideFlash = memo(({ trigger }) => {
  const [key, setKey] = useState(0);
  useEffect(() => { if (trigger) setKey(k => k + 1); }, [trigger]);
  return <div key={key} className="vp-slide-flash" aria-hidden="true" />;
});
SlideFlash.displayName = 'SlideFlash';

const SK_BG = [
  'linear-gradient(135deg,#08081a,#18104a,#08081a)','linear-gradient(135deg,#08100a,#0a2818,#08100a)',
  'linear-gradient(135deg,#180808,#2a0818,#180808)','linear-gradient(135deg,#081018,#0a2035,#081018)',
  'linear-gradient(135deg,#181008,#2c1808,#181008)',
];
const SkeletonLayer = memo(() => (
  <div className="vp-sk-layer" aria-hidden="true">
    {SK_BG.map((bg, i) => (
      <div key={i} className="vp-sk-slide" style={{ background: bg }}>
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(180deg,transparent 42%,rgba(0,0,0,0.9) 100%)' }} />
        <div style={{ position:'absolute', bottom:80, left:16, right:72 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
            <div className="vp-sk-dot" style={{ width:40, height:40, animationDelay:`${i*0.13}s` }} />
            <div>
              <div className="vp-sk-bar" style={{ width:88, marginBottom:6, animationDelay:`${i*0.13+0.07}s` }} />
              <div className="vp-sk-bar" style={{ width:58, height:8, animationDelay:`${i*0.13+0.14}s` }} />
            </div>
          </div>
          <div className="vp-sk-bar" style={{ width:'85%', maxWidth:210, marginBottom:7, animationDelay:`${i*0.1}s` }} />
          <div className="vp-sk-bar" style={{ width:'60%', maxWidth:150, height:8, animationDelay:`${i*0.1+0.07}s` }} />
        </div>
        <div style={{ position:'absolute', right:10, bottom:80, display:'flex', flexDirection:'column', gap:18 }}>
          {[0,1,2].map(j => <div key={j} className="vp-sk-dot" style={{ width:40, height:40, animationDelay:`${i*0.13+j*0.1}s` }} />)}
        </div>
        {i === 0 && (
          <div style={{ position:'absolute', top:'42%', left:'50%', transform:'translate(-50%,-50%)', background:'rgba(255,255,255,0.04)', backdropFilter:'blur(14px)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:9999, padding:'9px 20px', display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:13, height:13, borderRadius:'50%', border:'2px solid rgba(255,255,255,0.08)', borderTopColor:'rgba(255,255,255,0.45)', animation:'vp-spin 0.85s linear infinite' }} />
            <span style={{ color:'rgba(255,255,255,0.3)', fontSize:11, fontWeight:500, letterSpacing:'0.02em' }}>Chargement des vidéos…</span>
          </div>
        )}
      </div>
    ))}
  </div>
));
SkeletonLayer.displayName = 'SkeletonLayer';

const ActionBar = memo(({ onBack, activeTab, setActiveTab, showSearch, setShowSearch, searchQuery, setSearchQuery, onAddVideo, hasNewContent, currentIndex, totalItems }) => {
  const progress = totalItems > 1 ? currentIndex / (totalItems - 1) : 0;
  return (
    <div className="absolute top-0 left-0 right-0 z-50 pointer-events-none">
      <div className="pointer-events-auto" style={{ background:'linear-gradient(180deg,rgba(0,0,0,0.9) 0%,rgba(0,0,0,0.45) 72%,transparent 100%)', paddingBottom:20 }}>
        <div className="flex items-center justify-between px-3" style={{ paddingTop:'max(12px, env(safe-area-inset-top))' }}>
          <button onClick={onBack} className="relative flex items-center justify-center active:scale-90 transition-transform" style={{ WebkitTapHighlightColor:'transparent' }}>
            <ProgressRing progress={progress} size={38} stroke={2.2} />
            <FaArrowLeft size={12} className="text-white absolute" />
          </button>
          <div className="flex gap-0.5 rounded-full p-0.5" style={{ background:'rgba(0,0,0,0.52)', backdropFilter:'blur(20px)', border:'1px solid rgba(255,255,255,0.07)' }}>
            {[{ id:'foryou', label:'Pour toi', icon:<FaFire size={9}/> }, { id:'following', label:'Suivis', icon:null }, { id:'discover', label:'Découvrir', icon:<FaCompass size={9}/> }].map(({ id, label, icon }) => (
              <button key={id} onClick={() => setActiveTab(id)}
                className="relative px-3 py-1.5 rounded-full text-[11px] font-bold transition-all flex items-center gap-1"
                style={activeTab === id ? { background:'white', color:'#000', boxShadow:'0 1px 5px rgba(0,0,0,0.3)' } : { color:'rgba(255,255,255,0.45)' }}>
                {icon}{label}
                {id === 'foryou' && hasNewContent && activeTab !== 'foryou' && <span className="vp-tab-dot ml-0.5" />}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <div className="relative flex items-center">
              <AnimatePresence>
                {showSearch && (
                  <motion.input initial={{ width:0, opacity:0 }} animate={{ width:118, opacity:1 }} exit={{ width:0, opacity:0 }} transition={{ duration:0.16 }}
                    value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Rechercher…"
                    className="text-white text-xs px-3 py-1.5 rounded-full outline-none"
                    style={{ background:'rgba(255,255,255,0.12)', backdropFilter:'blur(12px)', border:'1px solid rgba(255,255,255,0.14)', position:'absolute', right:40 }} autoFocus />
                )}
              </AnimatePresence>
              <button onClick={() => setShowSearch(s => !s)} className="w-9 h-9 rounded-full flex items-center justify-center text-white active:scale-90 transition-transform"
                style={{ background:'rgba(255,255,255,0.1)', backdropFilter:'blur(12px)', border:'1px solid rgba(255,255,255,0.09)', WebkitTapHighlightColor:'transparent' }}>
                {showSearch ? <FaTimes size={11}/> : <FaSearch size={11}/>}
              </button>
            </div>
            <button onClick={onAddVideo} className="w-9 h-9 rounded-full flex items-center justify-center text-white active:scale-90 transition-transform"
              style={{ background:'linear-gradient(135deg,#ff6b35,#e91e8c)', boxShadow:'0 3px 12px rgba(233,30,140,0.4)', WebkitTapHighlightColor:'transparent' }}>
              <FaPlus size={13}/>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});
ActionBar.displayName = 'ActionBar';

const SwipeHint = memo(({ visible }) => (
  <AnimatePresence>{visible && (
    <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} transition={{ delay:2.5, duration:0.5 }}
      className="absolute bottom-24 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2 pointer-events-none">
      <div className="vp-swipe-arrow flex flex-col items-center gap-1.5">
        <span style={{ color:'rgba(255,255,255,0.28)', fontSize:9, fontWeight:700, letterSpacing:'0.18em', textTransform:'uppercase' }}>Swipe</span>
        <div style={{ width:1, height:18, background:'linear-gradient(180deg,transparent,rgba(255,255,255,0.35))' }} />
        <div style={{ width:16, height:16, borderRadius:'50%', border:'1.5px solid rgba(255,255,255,0.28)', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ width:4, height:4, borderRadius:'50%', background:'rgba(255,255,255,0.45)' }} />
        </div>
      </div>
    </motion.div>
  )}</AnimatePresence>
));
SwipeHint.displayName = 'SwipeHint';

const SlidePlaceholder = memo(() => <div className="w-full snap-start snap-always vp-ph" aria-hidden="true" />);
SlidePlaceholder.displayName = 'SlidePlaceholder';

const SlideItem = memo(({ item, index, onVisible, onModalChange, onVideoError }) => {
  const ctx = useContext(ActiveIndexContext), modalOpen = useContext(ModalOpenContext);
  const ref = useRef(null);
  const [isActive, setIsActive] = useState(() => ctx?.getActiveIndex() === index);
  const uid = item.id;

  useEffect(() => {
    if (!ctx) return;
    const unsub = ctx.subscribe(index, (active) => {
      setIsActive(active);
      if (active) watchScore.enter(uid); else watchScore.leave(uid);
    });
    if (ctx.getActiveIndex() === index) { setIsActive(true); watchScore.enter(uid); }
    return () => { unsub(); watchScore.leave(uid); };
  }, [ctx, index, uid]);

  useEffect(() => {
    const el = ref.current;
    if (!el || modalOpen) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting && e.intersectionRatio >= 0.6) onVisible(index); }, { threshold: 0.6 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [index, onVisible, modalOpen]);

  return (
    <div ref={ref} className="w-full snap-start snap-always" style={SLIDE_STYLE}>
      {item.type === 'ad' ? <VideoAd isActive={isActive} />
        : item.isAggregated ? <AggregatedCard content={item.data} isActive={isActive} onModalChange={onModalChange} onVideoError={onVideoError ? () => onVideoError(item.id) : undefined} />
        : <VideoCard video={item.data} isActive={isActive} isAutoPost={false} onModalChange={onModalChange} onVideoError={onVideoError ? () => onVideoError(item.id) : undefined} />}
    </div>
  );
}, (prev, next) => prev.item.id === next.item.id && prev.index === next.index && prev.onVisible === next.onVisible && prev.onModalChange === next.onModalChange && prev.onVideoError === next.onVideoError);
SlideItem.displayName = 'SlideItem';

// ─────────────────────────────────────────────────────────────────────────────
// VIDEOS PAGE PRINCIPALE — v9
// ─────────────────────────────────────────────────────────────────────────────
const VideosPage = () => {
  ensureCSS();
  const navigate = useNavigate(), { getToken } = useAuth(), isOnline = useOnline();
  const { videos: userVideos, loading: userLoading, hasMore: userHasMore, fetchVideos: fetchUserVideos } = useVideos();
  useVhFix();

  const [feedItems,          setFeedItems]          = useState([]);
  const [feedReady,          setFeedReady]          = useState(false);
  const [activeDisplayIndex, setActiveDisplayIndex] = useState(0);
  const [anyModalOpen,       setAnyModalOpen]       = useState(false);
  const [showModal,          setShowModal]          = useState(false);
  const [activeTab,          setActiveTab]          = useState('foryou');
  const [showSearch,         setShowSearch]         = useState(false);
  const [searchQuery,        setSearchQuery]        = useState('');
  const [showScrollHint,     setShowScrollHint]     = useState(false);
  const [watchStreak,        setWatchStreak]        = useState(0);
  const [hasNewContent,      setHasNewContent]      = useState(false);
  const [slideFlash,         setSlideFlash]         = useState(false);
  const [ptrProgress,        setPtrProgress]        = useState(0);
  const [ptrRefreshing,      setPtrRefreshing]      = useState(false);

  const containerRef   = useRef(null), activeIndexRef = useRef(0), slideListeners = useRef({});
  const feedItemsRef   = useRef([]),   seenSet = useRef(new Set()), invalidSet = useRef(new Set());
  const aggPool        = useRef([]),   fetchTriggered = useRef(false);
  const lastScrollTime = useRef(0),    momentumLockRef = useRef(0), anyModalRef = useRef(false);
  const aggPageRef     = useRef(1),    aggHasMoreRef = useRef(true), aggLoadingRef = useRef(false);
  const userHasMoreRef = useRef(userHasMore), userLoadingRef = useRef(userLoading);
  const loadingMoreRef = useRef(false), watchStreakRef = useRef(0);
  const ptrStartRef    = useRef(null), ptrActiveRef = useRef(false);
  const activeItemRef  = useRef(null);

  useEffect(() => { userHasMoreRef.current = userHasMore; }, [userHasMore]);
  useEffect(() => { userLoadingRef.current = userLoading; }, [userLoading]);
  useEffect(() => { anyModalRef.current    = anyModalOpen; }, [anyModalOpen]);

  const activeCtx = useMemo(() => ({
    getActiveIndex: () => activeIndexRef.current,
    subscribe: (idx, cb) => { slideListeners.current[idx] = cb; return () => { delete slideListeners.current[idx]; }; },
  }), []);

  // ─────────────────────────────────────────────────────────────────────────
  // 🧠 ENVOI WATCH SCORE AU BACKEND
  // ─────────────────────────────────────────────────────────────────────────
  const sendWatchScore = useCallback(async (itemData, score) => {
    if (!itemData?._id || score < CONFIG.watchScoreMin) return;
    if (!itemData._isAggregated) return;
    const watchPct = Math.round(score * 100);
    try {
      const token = await getToken();
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };
      fetch(`${API_BASE}/api/aggregated/${itemData._id}/view`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ watchPct }),
      }).catch(() => {});
    } catch { /* silencieux */ }
  }, [getToken]);

  const notifyActive = useCallback((newIdx) => {
    const old = activeIndexRef.current;
    if (old === newIdx) return;
    const now = Date.now();
    if (now - momentumLockRef.current < CONFIG.momentumLock) return;
    momentumLockRef.current = now;

    // ── Envoyer le watch score de l'item qu'on quitte ─────────────────────
    const previousItem = activeItemRef.current;
    if (previousItem) {
      const uid   = `agg-${previousItem._id || previousItem.externalId}`;
      const score = watchScore.getScore(uid);
      sendWatchScore(previousItem, score);
    }

    // Mettre à jour l'item actif courant
    const items = feedItemsRef.current;
    const newItem = items[newIdx];
    activeItemRef.current = (newItem?.type === 'content' && newItem.isAggregated)
      ? newItem.data
      : null;

    activeIndexRef.current = newIdx;
    if (newIdx > 0) setShowScrollHint(false);
    if ('vibrate' in navigator) navigator.vibrate(7);
    watchStreakRef.current++;
    if (watchStreakRef.current % 3 === 0 || watchStreakRef.current === 5) {
      startTransition(() => setWatchStreak(watchStreakRef.current));
      setTimeout(() => setWatchStreak(0), 2200);
    }
    setSlideFlash(f => !f);
    adaptiveBuf.record(now);

    // ── Preload vidéos directes ───────────────────────────────────────────
    for (let i = 1; i <= CONFIG.preloadAhead; i++) injectPreload(items[newIdx + i]);

    // ── 🎬 Warmup YouTube pool pour les prochains embeds ──────────────────
    const nextYtIds = extractYoutubeIds(items, newIdx + 1, CONFIG.ytWarmupAhead);
    if (nextYtIds.length > 0) YouTubePool.warmup(nextYtIds);

    startTransition(() => {
      slideListeners.current[old]?.(false);
      slideListeners.current[newIdx]?.(true);
      setActiveDisplayIndex(newIdx);
    });
  }, [sendWatchScore]);

  const invalidateItem = useCallback((uid) => {
    if (invalidSet.current.has(uid)) return;
    invalidSet.current.add(uid);
    feedItemsRef.current = feedItemsRef.current.filter(i => i.id !== uid);
    startTransition(() => setFeedItems(prev => prev.filter(i => i.id !== uid)));
  }, []);

  const appendItems = useCallback((rawItems) => {
    const boosted = applyViralBoost(rawItems);
    const toAdd = []; let len = feedItemsRef.current.length;
    for (const item of boosted) {
      const uid = item._uid || `${item._isAggregated ? 'agg' : 'user'}-${item._id || item.externalId}`;
      if (seenSet.current.has(uid) || invalidSet.current.has(uid)) continue;
      seenSet.current.add(uid);

      if (!item.isEmbed) {
        if (needsCloudinaryProbe(item)) probeCloudinaryVideo(item.cloudinaryUrl || item.videoUrl || item.url || '', () => invalidateItem(uid));
        else probeItemBackground(item, () => invalidateItem(uid));
      }

      toAdd.push({ type:'content', id:uid, data:{ ...item, _uid:uid }, isAggregated:!!item._isAggregated });
      len++;
      if (CONFIG.ads.enabled && len % CONFIG.ads.frequency === 0) { toAdd.push({ type:'ad', id:`ad-${++_adCounter}` }); len++; }
    }
    if (toAdd.length === 0) return;
    const wasEmpty = feedItemsRef.current.length === 0;
    feedItemsRef.current = [...feedItemsRef.current, ...toAdd];
    startTransition(() => {
      setFeedItems(prev => [...prev, ...toAdd]);
      if (wasEmpty) { setFeedReady(true); setTimeout(() => setShowScrollHint(true), 3200); }
      else if (feedItemsRef.current.length > 10) { setHasNewContent(true); setTimeout(() => setHasNewContent(false), 8000); }
    });
    if (feedItemsRef.current.length <= CONFIG.preloadAhead * 2) toAdd.slice(0, CONFIG.preloadAhead).forEach(injectPreload);

    // Warmup YouTube pour les premiers items du feed (cold start)
    if (wasEmpty) {
      const firstYtIds = extractYoutubeIds(toAdd, 0, CONFIG.ytWarmupAhead);
      if (firstYtIds.length > 0) YouTubePool.warmup(firstYtIds);
    }
  }, [invalidateItem]);

  const recycle = useCallback(() => {
    if (aggPool.current.length < CONFIG.recycleMin) return;
    const recycled = smartRecycle(aggPool.current);
    const toAdd = []; let len = feedItemsRef.current.length;
    for (const item of recycled) {
      toAdd.push({ type:'content', id:item._uid, data:item, isAggregated:true }); len++;
      if (CONFIG.ads.enabled && len % CONFIG.ads.frequency === 0) toAdd.push({ type:'ad', id:`ad-${++_adCounter}` });
    }
    feedItemsRef.current = [...feedItemsRef.current, ...toAdd];
    startTransition(() => setFeedItems(prev => [...prev, ...toAdd]));
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // 🌐 fetchAggregated
  // ─────────────────────────────────────────────────────────────────────────
  const fetchAggregated = useCallback(async (page = 1, limit = 40) => {
    if (!CONFIG.aggregated.enabled || aggLoadingRef.current) return;
    try {
      aggLoadingRef.current = true;
      const token = await getToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const res = await fetch(
        `${API_BASE}/api/aggregated?page=${page}&limit=${limit}&type=short_videos&sources=all`,
        { headers }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      const finalItems = (json.data || [])
        .filter(isPlayableCandidate)
        .map(c => ({ ...c, _isAggregated: true }));

      if (import.meta.env.DEV && json.meta) {
        console.log(`[Feed v9] p${page} | sources: ${json.meta.sources?.join(',')} | BTP backend: ${json.meta.btpRatio}% | coldStart: ${json.meta.isColStart}`);
      }

      aggPool.current       = [...aggPool.current, ...finalItems];
      aggPageRef.current    = page;
      aggHasMoreRef.current = json.pagination?.hasMore || false;

      appendItems(finalItems);

      if (feedItemsRef.current.length < CONFIG.minFeedSize && aggHasMoreRef.current)
        setTimeout(() => fetchAggregated(page + 1, limit), 200);

    } catch (err) {
      console.error('❌ [Aggregated]', err.message);
      aggHasMoreRef.current = false;
      if (aggPool.current.length >= CONFIG.recycleMin) recycle();
    } finally {
      aggLoadingRef.current = false;
    }
  }, [getToken, appendItems, recycle]);

  useEffect(() => {
    const newOnes = (userVideos || []).filter(v => {
      const uid = `user-${v._id}`;
      return !seenSet.current.has(uid) && !invalidSet.current.has(uid);
    });
    if (newOnes.length > 0) appendItems(newOnes.map(v => ({ ...v, _isUserVideo: true })));
  }, [userVideos, appendItems]);

  useEffect(() => {
    if (!fetchTriggered.current) {
      fetchTriggered.current = true;
      YouTubePool.init();  // 🎬 Initialiser le pool dès le premier chargement
      fetchUserVideos(true);
      fetchAggregated(1, CONFIG.aggregated.initialLoad);
    }
  }, []); // eslint-disable-line

  useEffect(() => {
    if (!('memory' in performance)) return;
    const check = setInterval(() => {
      const mem = performance.memory;
      if (mem && mem.usedJSHeapSize > mem.jsHeapSizeLimit * 0.75) {
        aggPool.current = aggPool.current.slice(-CONFIG.recycleMin);
        _preloadedUrls.clear();
      }
    }, 15000);
    return () => clearInterval(check);
  }, []);

  const handleVisible = useCallback((index) => {
    if (anyModalRef.current || isFeedLocked()) return;
    const now = Date.now();
    if (now - lastScrollTime.current < 80) return;
    lastScrollTime.current = now;
    notifyActive(index);
    const remaining = feedItemsRef.current.length - index;
    if (remaining <= adaptiveBuf.value && !loadingMoreRef.current) {
      loadingMoreRef.current = true;
      (async () => {
        try {
          if (userHasMoreRef.current && !userLoadingRef.current) fetchUserVideos();
          if (aggHasMoreRef.current && !aggLoadingRef.current) await fetchAggregated(aggPageRef.current + 1, CONFIG.aggregated.loadMore);
          if (!userHasMoreRef.current && !aggHasMoreRef.current) recycle();
        } finally { loadingMoreRef.current = false; }
      })();
    }
  }, [notifyActive, fetchUserVideos, fetchAggregated, recycle]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let ticking = false;
    const onScroll = () => {
      if (anyModalRef.current || isFeedLocked() || ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        if (anyModalRef.current || isFeedLocked()) return;
        const idx = Math.round(container.scrollTop / (container.clientHeight || 1));
        notifyActive(Math.max(0, Math.min(idx, feedItemsRef.current.length - 1)));
      });
    };
    const onTouchStart = (e) => {
      if (container.scrollTop === 0) { ptrStartRef.current = e.touches[0].clientY; ptrActiveRef.current = true; }
    };
    const onTouchMove = (e) => {
      if (!ptrActiveRef.current || !ptrStartRef.current) return;
      const dy = e.touches[0].clientY - ptrStartRef.current;
      if (dy > 0 && container.scrollTop === 0) { setPtrProgress(Math.min(1, dy / 90)); if (dy > 8) e.preventDefault(); }
    };
    const onTouchEnd = async () => {
      if (!ptrActiveRef.current) return;
      ptrActiveRef.current = false;
      const prog = ptrProgress; setPtrProgress(0);
      if (prog > 0.8) { setPtrRefreshing(true); await new Promise(r => setTimeout(r, 800)); handleVideoPublished(); setPtrRefreshing(false); }
      ptrStartRef.current = null;
    };
    container.addEventListener('scroll', onScroll, { passive: true });
    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      container.removeEventListener('scroll', onScroll);
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
    };
  }, [notifyActive, ptrProgress]); // eslint-disable-line

  const handleVideoError = useCallback((itemId) => {
    invalidateItem(itemId);
    const remaining = feedItemsRef.current.length - activeIndexRef.current;
    if (remaining <= adaptiveBuf.value && !aggLoadingRef.current) {
      if (aggHasMoreRef.current) fetchAggregated(aggPageRef.current + 1, CONFIG.aggregated.loadMore);
      else recycle();
    }
  }, [invalidateItem, fetchAggregated, recycle]);

  const handleModalChange = useCallback((isOpen) => { anyModalRef.current = isOpen; setAnyModalOpen(isOpen); }, []);

  const handleVideoPublished = useCallback(() => {
    feedItemsRef.current = []; seenSet.current.clear(); invalidSet.current.clear();
    aggPool.current = []; aggPageRef.current = 1; aggHasMoreRef.current = true;
    watchStreakRef.current = 0; _recycleRound = 0; _adCounter = 0;
    activeItemRef.current = null;
    adaptiveBuf.reset(); watchScore.clear();
    setFeedItems([]); setFeedReady(false); setActiveDisplayIndex(0);
    setShowScrollHint(false); setWatchStreak(0);
    containerRef.current?.scrollTo({ top: 0, behavior: 'auto' });
    activeIndexRef.current = 0;
    fetchUserVideos(true);
    fetchAggregated(1, CONFIG.aggregated.initialLoad);
  }, [fetchUserVideos, fetchAggregated]);

  // ── Cleanup complet au unmount ─────────────────────────────────────────
  useEffect(() => () => {
    document.getElementById('vp-styles')?.remove();
    _cssInjected = false;
    watchScore.clear();
    adaptiveBuf.reset();
    YouTubePool.destroy(); // 🎬 Nettoyer toutes les iframes du pool
  }, []);

  const displayItems = useMemo(() => {
    if (!searchQuery.trim()) return feedItems;
    const q = searchQuery.toLowerCase();
    return feedItems.filter(item => {
      if (item.type === 'ad') return false;
      const d = item.data;
      return ['title','description','channelName','username'].some(k => (d[k]||'').toLowerCase().includes(q));
    });
  }, [feedItems, searchQuery]);

  const handleBack     = useCallback(() => navigate('/'), [navigate]);
  const handleAddVideo = useCallback(() => setShowModal(true), []);

  return (
    <ActiveIndexContext.Provider value={activeCtx}>
      <ModalOpenContext.Provider value={anyModalOpen}>
        <div className={`fixed inset-0 bg-black overflow-hidden${feedReady ? ' vp-feed-ready' : ''}`} style={{ contain:'strict' }}>
          <SkeletonLayer />
          <SlideFlash trigger={slideFlash} />
          <OfflineBanner show={!isOnline} />
          <PullToRefresh progress={ptrProgress} refreshing={ptrRefreshing} />
          <WatchStreakBadge count={watchStreak} />
          <ActionBar onBack={handleBack} activeTab={activeTab} setActiveTab={setActiveTab}
            showSearch={showSearch} setShowSearch={setShowSearch} searchQuery={searchQuery}
            setSearchQuery={setSearchQuery} onAddVideo={handleAddVideo} hasNewContent={hasNewContent}
            currentIndex={activeDisplayIndex} totalItems={feedItems.length} />
          <SwipeHint visible={showScrollHint && activeDisplayIndex === 0 && feedReady} />
          <div ref={containerRef} className="vp-scroll absolute inset-0 z-10 overflow-y-scroll snap-y snap-mandatory"
            style={{ willChange:'transform', WebkitOverflowScrolling:'touch', contain:'layout' }}>
            {displayItems.map((item, index) => {
              const dist = Math.abs(index - activeDisplayIndex);
              return dist > CONFIG.virtual
                ? <SlidePlaceholder key={item.id} />
                : <SlideItem key={item.id} item={item} index={index} onVisible={handleVisible}
                    onModalChange={handleModalChange} onVideoError={handleVideoError} />;
            })}
          </div>
          {showModal && <VideoModal showModal={showModal} setShowModal={setShowModal} onVideoPublished={handleVideoPublished} />}
        </div>
      </ModalOpenContext.Provider>
    </ActiveIndexContext.Provider>
  );
};

export default memo(VideosPage);