// 📁 src/pages/Videos/VideosPage.jsx  — v4 FIXES DÉFINITIFS
//
// ═══════════════════════════════════════════════════════════════════════════════
// BUG RACINE IDENTIFIÉ (était présent dans v1→v3) :
//
//   `const activeIdx = activeIndexRef.current` capturé UNE FOIS au render.
//   Quand l'utilisateur scrolle, activeIndexRef.current avance MAIS le composant
//   ne re-rend pas (c'est voulu pour les perf). Résultat : le calcul
//   `dist > CONFIG.virtual` utilise une valeur FIGÉE → des slides qui devraient
//   être dans la fenêtre reçoivent <SlidePlaceholder> → ÉCRAN NOIR.
//
//   FIX : activeDisplayIndex est un STATE (pas une ref).
//         Il est mis à jour via startTransition (bas priorité, non bloquant).
//         La fenêtre virtuelle est toujours calculée sur la valeur courante.
//
// AUTRES FIXES DE CETTE VERSION :
//   ✅ Skeleton CSS injecté synchrone (avant 1er paint)
//   ✅ SlidePlaceholder fond sombre (jamais noir pur)
//   ✅ startTransition sur slide activation (INP)
//   ✅ VIRTUAL_WINDOW = 6 (13 slides dans le DOM)
//   ✅ bufferAhead = 12 + cascade fetch si feed trop petit
//   ✅ Recyclage 3 stratégies
//
// FIX CLÉS DUPLIQUÉES (ad-XX) :
//   Utilisation d'un compteur global `_adCounter` incrémental au lieu de
//   `len` pour générer les IDs des pubs → plus jamais de doublon même si
//   appendItems est appelé plusieurs fois avec le même feedItemsRef.length.
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
import { FaPlus, FaSearch, FaArrowLeft, FaTimes, FaFire, FaCompass } from 'react-icons/fa';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api$/, '');

// ── CONFIG ─────────────────────────────────────────────────────────────────────
const CONFIG = {
  ads:          { enabled: true, frequency: 8 },
  aggregated:   { enabled: true, initialLoad: 40, loadMore: 25 },
  virtual:      6,    // 6 de chaque côté = 13 slides dans le DOM
  bufferAhead:  12,
  recycleMin:   8,
  preloadAhead: 2,
  minFeedSize:  15,
};

// ── COMPTEUR GLOBAL POUR LES IDS DE PUBS ──────────────────────────────────────
// FIX clés dupliquées : on n'utilise plus `len` (qui peut être identique entre
// deux appels successifs d'appendItems) mais un compteur strictement croissant.
let _adCounter = 0;

// ── CSS — injecté SYNCHRONE avant le 1er render ───────────────────────────────
const VP_CSS = `
  @keyframes vp-spin    { to { transform: rotate(360deg); } }
  @keyframes vp-shimmer {
    0%   { transform: translateX(-100%) skewX(-12deg); }
    100% { transform: translateX(250%)  skewX(-12deg); }
  }
  @keyframes vp-pulse { 0%,100%{opacity:.3} 50%{opacity:.65} }

  /* ── Skeleton ── */
  .vp-sk-layer {
    position: absolute; inset: 0; z-index: 5;
    display: flex; flex-direction: column;
    overflow: hidden; pointer-events: none;
    transition: opacity 0.35s ease;
  }
  .vp-feed-ready .vp-sk-layer { opacity: 0; }

  .vp-sk-slide {
    flex-shrink: 0; position: relative; overflow: hidden;
    height: calc(var(--vh,1vh)*100);
    min-height: calc(var(--vh,1vh)*100);
    max-height: calc(var(--vh,1vh)*100);
  }
  .vp-sk-slide::after {
    content: ''; position: absolute; inset: 0;
    background: linear-gradient(105deg, transparent 38%, rgba(255,255,255,0.035) 50%, transparent 62%);
    animation: vp-shimmer 2.6s linear infinite;
  }
  .vp-sk-bar { height:10px; border-radius:9999px; background:rgba(255,255,255,0.08); animation:vp-pulse 2s ease-in-out infinite; }
  .vp-sk-dot { border-radius:9999px; background:rgba(255,255,255,0.08); flex-shrink:0; animation:vp-pulse 2s ease-in-out infinite; }

  /* ── Feed ── */
  .vp-scroll::-webkit-scrollbar { display: none; }
  .vp-scroll { -ms-overflow-style:none; scrollbar-width:none; overflow-anchor:none; }

  /* ── Placeholder NON NOIR ── */
  .vp-ph {
    flex-shrink: 0;
    height: calc(var(--vh,1vh)*100);
    min-height: calc(var(--vh,1vh)*100);
    max-height: calc(var(--vh,1vh)*100);
    background: linear-gradient(180deg, #07070f 0%, #0c0c1c 50%, #07070f 100%);
  }
`;

let _cssInjected = false;
const ensureCSS = () => {
  if (_cssInjected || typeof document === 'undefined') return;
  _cssInjected = true;
  if (document.getElementById('vp-styles')) return;
  const s = document.createElement('style');
  s.id = 'vp-styles';
  s.textContent = VP_CSS;
  document.head.insertBefore(s, document.head.firstChild);
};

// ── Filtrage ─────────────────────────────────────────────────────────────────
const VALID_HOSTS  = ['cdn.pixabay.com/video','res.cloudinary.com','player.pixabay.com','vimeocdn.com']; // 🚫 videos.pexels.com retiré
const PLAYABLE_EXT = /\.(mp4|webm|mov)(\?|$)/i;
const BLOCKED      = ['youtube.','youtu.be','dailymotion.','/embed/'];

const isPlayableCandidate = (item) => {
  // 🚫 Pexels bloqué côté client (double sécurité)
  if (item.source === 'pexels') return false;

  const url = item.videoUrl || item.url || '';
  if (!url) return false;
  if (url.includes('.m3u8')) return false;
  if (BLOCKED.some(p => url.includes(p))) return false;
  if (url.includes('pexels.com')) return false; // 🚫 URLs Pexels bloquées
  if (url.includes('vimeo.com') && !url.includes('vimeocdn.com')) return false;
  if (VALID_HOSTS.some(h => url.includes(h))) return true;
  if (PLAYABLE_EXT.test(url)) return true;
  if (item.source === 'pixabay' && item.externalId) return true;
  return false;
};

const probeItemBackground = (item, onInvalid) => {
  if (item._isAggregated) return;
  const url = item.cloudinaryUrl || item.videoUrl || item.url || '';
  if (!url) { onInvalid(); return; }
  fetch(url, { method: 'HEAD', cache: 'no-store' })
    .then(r => { if (r.status === 404 || r.status === 410) onInvalid(); })
    .catch(() => {});
};

// ── Preload ──────────────────────────────────────────────────────────────────
const _preloadedUrls = new Set();
// link.as='video' n'est pas supporté par tous les navigateurs → on utilise fetch() à la place
const injectPreload = (item) => {
  if (!item?.data) return;
  const url = item.data.cloudinaryUrl || item.data.videoUrl || item.data.url || '';
  if (!url || _preloadedUrls.has(url) || url.includes('.m3u8')) return;
  _preloadedUrls.add(url);
  try {
    fetch(url, { method: 'GET', headers: { Range: 'bytes=0-65535' }, cache: 'force-cache' }).catch(() => {});
  } catch {}
};

// ── Recyclage 3 stratégies ───────────────────────────────────────────────────
let _recycleRound = 0;
const _strategies = [
  a => [...a].sort(() => Math.random() - 0.5),
  a => [...a].reverse(),
  a => { const src=[...a], out=[]; while(src.length){out.push(src.shift());if(src.length)out.push(src.pop());} return out; },
];
const smartRecycle = (pool) => {
  const fn = _strategies[_recycleRound % _strategies.length];
  _recycleRound++;
  return fn(pool).map(item => ({ ...item, _uid: `rec-${_recycleRound}-${Date.now()}-${Math.random().toString(36).slice(2,6)}` }));
};

// ── Contexts ─────────────────────────────────────────────────────────────────
const ActiveIndexContext = createContext(null);
const ModalOpenContext   = createContext(false);

// ── VH Fix ───────────────────────────────────────────────────────────────────
const useVhFix = () => {
  useEffect(() => {
    const set = () => document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
    set();
    window.addEventListener('resize', set, { passive: true });
    return () => window.removeEventListener('resize', set);
  }, []);
};

const SLIDE_STYLE = {
  height:    'calc(var(--vh,1vh)*100)',
  minHeight: 'calc(var(--vh,1vh)*100)',
  maxHeight: 'calc(var(--vh,1vh)*100)',
  flexShrink: 0,
};

// ── SkeletonLayer ─────────────────────────────────────────────────────────────
const SK_BG = [
  'linear-gradient(135deg,#08081a,#18104a,#08081a)',
  'linear-gradient(135deg,#08100a,#0a2818,#08100a)',
  'linear-gradient(135deg,#180808,#2a0818,#180808)',
  'linear-gradient(135deg,#081018,#0a2035,#081018)',
  'linear-gradient(135deg,#181008,#2c1808,#181008)',
];

const SkeletonLayer = memo(() => (
  <div className="vp-sk-layer" aria-hidden="true">
    {SK_BG.map((bg, i) => (
      <div key={i} className="vp-sk-slide" style={{ background: bg }}>
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(180deg,transparent 42%,rgba(0,0,0,0.9) 100%)' }} />
        <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:'rgba(255,255,255,0.05)' }} />
        {/* Auteur */}
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
        {/* Boutons */}
        <div style={{ position:'absolute', right:10, bottom:80, display:'flex', flexDirection:'column', gap:18 }}>
          {[0,1,2].map(j => <div key={j} className="vp-sk-dot" style={{ width:40, height:40, animationDelay:`${i*0.13+j*0.1}s` }} />)}
        </div>
        {/* Spinner sur la 1ère slide seulement */}
        {i === 0 && (
          <div style={{
            position:'absolute', top:'40%', left:'50%', transform:'translate(-50%,-50%)',
            background:'rgba(255,255,255,0.045)', backdropFilter:'blur(14px)',
            border:'1px solid rgba(255,255,255,0.07)', borderRadius:9999,
            padding:'9px 18px', display:'flex', alignItems:'center', gap:9,
          }}>
            <div style={{
              width:13, height:13, borderRadius:'50%',
              border:'2px solid rgba(255,255,255,0.1)', borderTopColor:'rgba(255,255,255,0.5)',
              animation:'vp-spin 0.85s linear infinite',
            }} />
            <span style={{ color:'rgba(255,255,255,0.35)', fontSize:11, fontWeight:500 }}>
              Chargement des vidéos…
            </span>
          </div>
        )}
      </div>
    ))}
  </div>
));
SkeletonLayer.displayName = 'SkeletonLayer';

// ── ActionBar ─────────────────────────────────────────────────────────────────
const ActionBar = memo(({ onBack, activeTab, setActiveTab, showSearch, setShowSearch, searchQuery, setSearchQuery, onAddVideo }) => (
  <div className="absolute top-0 left-0 right-0 z-50 pointer-events-none">
    <div className="pointer-events-auto" style={{
      background: 'linear-gradient(180deg,rgba(0,0,0,0.88) 0%,rgba(0,0,0,0.42) 70%,transparent 100%)',
      paddingBottom: 18,
    }}>
      <div className="flex items-center justify-between px-3"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>

        <button onClick={onBack}
          className="w-9 h-9 rounded-full flex items-center justify-center text-white active:scale-90 transition-transform"
          style={{ background:'rgba(255,255,255,0.11)', backdropFilter:'blur(12px)', border:'1px solid rgba(255,255,255,0.1)' }}>
          <FaArrowLeft size={12} />
        </button>

        <div className="flex gap-0.5 rounded-full p-0.5"
          style={{ background:'rgba(0,0,0,0.5)', backdropFilter:'blur(18px)', border:'1px solid rgba(255,255,255,0.07)' }}>
          {[
            { id:'foryou',    label:'Pour toi',  Icon: FaFire },
            { id:'following', label:'Suivis',    Icon: null },
            { id:'discover',  label:'Découvrir', Icon: FaCompass },
          ].map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className="px-3 py-1.5 rounded-full text-[11px] font-bold transition-all flex items-center gap-1"
              style={activeTab === id
                ? { background:'white', color:'#000', boxShadow:'0 1px 5px rgba(0,0,0,0.3)' }
                : { color:'rgba(255,255,255,0.48)' }
              }>
              {Icon && <Icon size={9} />}{label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <div className="relative flex items-center">
            <AnimatePresence>
              {showSearch && (
                <motion.input
                  initial={{ width:0, opacity:0 }} animate={{ width:118, opacity:1 }} exit={{ width:0, opacity:0 }}
                  transition={{ duration:0.16 }}
                  value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Rechercher…"
                  className="text-white text-xs px-3 py-1.5 rounded-full outline-none"
                  style={{
                    background:'rgba(255,255,255,0.13)', backdropFilter:'blur(12px)',
                    border:'1px solid rgba(255,255,255,0.15)', position:'absolute', right:40,
                  }}
                  autoFocus />
              )}
            </AnimatePresence>
            <button onClick={() => setShowSearch(s => !s)}
              className="w-9 h-9 rounded-full flex items-center justify-center text-white active:scale-90 transition-transform"
              style={{ background:'rgba(255,255,255,0.11)', backdropFilter:'blur(12px)', border:'1px solid rgba(255,255,255,0.1)' }}>
              {showSearch ? <FaTimes size={11} /> : <FaSearch size={11} />}
            </button>
          </div>
          <button onClick={onAddVideo}
            className="w-9 h-9 rounded-full flex items-center justify-center text-white active:scale-90 transition-transform"
            style={{ background:'linear-gradient(135deg,#ff6b35,#e91e8c)', boxShadow:'0 3px 10px rgba(233,30,140,0.38)' }}>
            <FaPlus size={13} />
          </button>
        </div>
      </div>
    </div>
  </div>
));
ActionBar.displayName = 'ActionBar';

// ── SlidePlaceholder — fond sombre, JAMAIS noir pur ───────────────────────────
const SlidePlaceholder = memo(() => (
  <div className="w-full snap-start snap-always vp-ph" aria-hidden="true" />
));
SlidePlaceholder.displayName = 'SlidePlaceholder';

// ── SlideItem ─────────────────────────────────────────────────────────────────
const SlideItem = memo(({ item, index, onVisible, onModalChange, onVideoError }) => {
  const ctx       = useContext(ActiveIndexContext);
  const modalOpen = useContext(ModalOpenContext);
  const ref       = useRef(null);
  const [isActive, setIsActive] = useState(() => ctx?.getActiveIndex() === index);

  useEffect(() => {
    if (!ctx) return;
    const unsub = ctx.subscribe(index, setIsActive);
    setIsActive(ctx.getActiveIndex() === index);
    return unsub;
  }, [ctx, index]);

  useEffect(() => {
    const el = ref.current;
    if (!el || modalOpen) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting && e.intersectionRatio >= 0.6) onVisible(index); },
      { threshold: 0.6 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [index, onVisible, modalOpen]);

  return (
    <div ref={ref} className="w-full snap-start snap-always" style={SLIDE_STYLE}>
      {item.type === 'ad' ? (
        <VideoAd isActive={isActive} />
      ) : item.isAggregated ? (
        <AggregatedCard
          content={item.data}
          isActive={isActive}
          onModalChange={onModalChange}
          onVideoError={onVideoError ? () => onVideoError(item.id) : undefined}
        />
      ) : (
        <VideoCard
          video={item.data}
          isActive={isActive}
          isAutoPost={false}
          onModalChange={onModalChange}
          onVideoError={onVideoError ? () => onVideoError(item.id) : undefined}
        />
      )}
    </div>
  );
}, (prev, next) =>
  prev.item.id       === next.item.id       &&
  prev.index         === next.index         &&
  prev.onVisible     === next.onVisible     &&
  prev.onModalChange === next.onModalChange &&
  prev.onVideoError  === next.onVideoError
);
SlideItem.displayName = 'SlideItem';

// ── ScrollHint ────────────────────────────────────────────────────────────────
const ScrollHint = memo(({ visible }) => (
  <AnimatePresence>
    {visible && (
      <motion.div
        initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
        transition={{ delay:2 }}
        className="absolute bottom-20 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2 pointer-events-none">
        <motion.div animate={{ y:[0,-5,0] }} transition={{ repeat:Infinity, duration:1.7, ease:'easeInOut' }}
          style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:5 }}>
          <div style={{ width:1, height:16, background:'linear-gradient(180deg,transparent,rgba(255,255,255,0.4))' }} />
          <div style={{ width:15, height:15, border:'1.5px solid rgba(255,255,255,0.32)', borderRadius:'50%',
            display:'flex', alignItems:'center', justifyContent:'center' }}>
            <div style={{ width:4, height:4, borderRadius:'50%', background:'rgba(255,255,255,0.5)' }} />
          </div>
        </motion.div>
        <span style={{ color:'rgba(255,255,255,0.3)', fontSize:9, fontWeight:600, letterSpacing:'0.14em', textTransform:'uppercase' }}>
          Swipe
        </span>
      </motion.div>
    )}
  </AnimatePresence>
));
ScrollHint.displayName = 'ScrollHint';

// ═══════════════════════════════════════════════════════════════════════════════
// VideosPage
// ═══════════════════════════════════════════════════════════════════════════════
const VideosPage = () => {
  // ── CSS synchrone avant tout render ────────────────────────────────────────
  ensureCSS();

  const navigate     = useNavigate();
  const { getToken } = useAuth();
  const {
    videos: userVideos,
    loading: userLoading,
    hasMore: userHasMore,
    fetchVideos: fetchUserVideos,
  } = useVideos();

  useVhFix();

  // ── State ──────────────────────────────────────────────────────────────────
  const [feedItems,        setFeedItems]        = useState([]);
  const [feedReady,        setFeedReady]        = useState(false);
  // ╔══════════════════════════════════════════════════════════════════════════╗
  // ║ FIX RACINE : activeDisplayIndex est un STATE                            ║
  // ║ → le composant re-rend quand l'index change                             ║
  // ║ → la fenêtre virtuelle est toujours calculée sur la bonne valeur        ║
  // ║ → plus jamais de placeholder noir visible                               ║
  // ╚══════════════════════════════════════════════════════════════════════════╝
  const [activeDisplayIndex, setActiveDisplayIndex] = useState(0);
  const [anyModalOpen,   setAnyModalOpen]   = useState(false);
  const [showModal,      setShowModal]      = useState(false);
  const [activeTab,      setActiveTab]      = useState('foryou');
  const [showSearch,     setShowSearch]     = useState(false);
  const [searchQuery,    setSearchQuery]    = useState('');
  const [showScrollHint, setShowScrollHint] = useState(false);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const containerRef   = useRef(null);
  const activeIndexRef = useRef(0);
  const slideListeners = useRef({});
  const feedItemsRef   = useRef([]);
  const seenSet        = useRef(new Set());
  const invalidSet     = useRef(new Set());
  const aggPool        = useRef([]);
  const fetchTriggered = useRef(false);
  const lastScrollTime = useRef(0);
  const anyModalRef    = useRef(false);
  const aggPageRef     = useRef(1);
  const aggHasMoreRef  = useRef(true);
  const aggLoadingRef  = useRef(false);
  const userHasMoreRef = useRef(userHasMore);
  const userLoadingRef = useRef(userLoading);
  const loadingMoreRef = useRef(false);

  useEffect(() => { userHasMoreRef.current = userHasMore; }, [userHasMore]);
  useEffect(() => { userLoadingRef.current = userLoading; }, [userLoading]);
  useEffect(() => { anyModalRef.current    = anyModalOpen; }, [anyModalOpen]);

  // ── Context stable ─────────────────────────────────────────────────────────
  const activeCtx = useMemo(() => ({
    getActiveIndex: () => activeIndexRef.current,
    subscribe: (idx, cb) => {
      slideListeners.current[idx] = cb;
      return () => { delete slideListeners.current[idx]; };
    },
  }), []);

  // ── notifyActive ───────────────────────────────────────────────────────────
  const notifyActive = useCallback((newIdx) => {
    const old = activeIndexRef.current;
    if (old === newIdx) return;
    activeIndexRef.current = newIdx;

    if (newIdx > 0) setShowScrollHint(false);

    const items = feedItemsRef.current;
    for (let i = 1; i <= CONFIG.preloadAhead; i++) injectPreload(items[newIdx + i]);

    startTransition(() => {
      slideListeners.current[old]?.(false);
      slideListeners.current[newIdx]?.(true);
      setActiveDisplayIndex(newIdx);
    });
  }, []);

  // ── appendItems ────────────────────────────────────────────────────────────
  const appendItems = useCallback((rawItems) => {
    const toAdd = [];
    let len = feedItemsRef.current.length;

    for (const item of rawItems) {
      const uid = item._uid || `${item._isAggregated?'agg':'user'}-${item._id||item.externalId}`;
      if (seenSet.current.has(uid) || invalidSet.current.has(uid)) continue;
      seenSet.current.add(uid);
      toAdd.push({ type:'content', id:uid, data:{...item,_uid:uid}, isAggregated:!!item._isAggregated });
      len++;
      if (CONFIG.ads.enabled && len % CONFIG.ads.frequency === 0) {
        // ✅ FIX : _adCounter global strictement croissant → jamais de doublon
        toAdd.push({ type:'ad', id:`ad-${++_adCounter}` });
        len++;
      }
      probeItemBackground(item, () => {
        if (invalidSet.current.has(uid)) return;
        invalidSet.current.add(uid);
        feedItemsRef.current = feedItemsRef.current.filter(i => i.id !== uid);
        startTransition(() => setFeedItems(prev => prev.filter(i => i.id !== uid)));
      });
    }

    if (toAdd.length === 0) return;

    const wasEmpty = feedItemsRef.current.length === 0;
    feedItemsRef.current = [...feedItemsRef.current, ...toAdd];

    startTransition(() => {
      setFeedItems(prev => [...prev, ...toAdd]);
      if (wasEmpty) {
        setFeedReady(true);
        setTimeout(() => setShowScrollHint(true), 3500);
      }
    });

    if (feedItemsRef.current.length <= CONFIG.preloadAhead * 2)
      toAdd.slice(0, CONFIG.preloadAhead).forEach(injectPreload);
  }, []);

  // ── recycle ────────────────────────────────────────────────────────────────
  const recycle = useCallback(() => {
    if (aggPool.current.length < CONFIG.recycleMin) return;
    const recycled = smartRecycle(aggPool.current);
    const toAdd = [];
    let len = feedItemsRef.current.length;
    for (const item of recycled) {
      toAdd.push({ type:'content', id:item._uid, data:item, isAggregated:true });
      len++;
      if (CONFIG.ads.enabled && len % CONFIG.ads.frequency === 0) {
        // ✅ FIX : même compteur global ici
        toAdd.push({ type:'ad', id:`ad-${++_adCounter}` });
        len++;
      }
    }
    feedItemsRef.current = [...feedItemsRef.current, ...toAdd];
    startTransition(() => setFeedItems(prev => [...prev, ...toAdd]));
  }, []);

  // ── fetchAggregated ────────────────────────────────────────────────────────
  const fetchAggregated = useCallback(async (page = 1, limit = 40) => {
    if (!CONFIG.aggregated.enabled || aggLoadingRef.current) return;
    try {
      aggLoadingRef.current = true;
      const token   = await getToken();
      const headers = token ? { Authorization:`Bearer ${token}` } : {};
      const res     = await fetch(`${API_BASE}/api/aggregated?page=${page}&limit=${limit}&type=short_videos`, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json  = await res.json();
      const items = (json.data||[]).filter(isPlayableCandidate).map(c => ({...c, _isAggregated:true}));

      aggPool.current       = [...aggPool.current, ...items];
      aggPageRef.current    = page;
      aggHasMoreRef.current = json.pagination?.hasMore || false;

      appendItems(items);

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

  // ── Sync userVideos ─────────────────────────────────────────────────────────
  useEffect(() => {
    const newOnes = (userVideos||[]).filter(v => {
      const uid = `user-${v._id}`;
      return !seenSet.current.has(uid) && !invalidSet.current.has(uid);
    });
    if (newOnes.length > 0) appendItems(newOnes.map(v => ({...v, _isUserVideo:true})));
  }, [userVideos, appendItems]);

  // ── Bootstrap ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!fetchTriggered.current) {
      fetchTriggered.current = true;
      fetchUserVideos(true);
      fetchAggregated(1, CONFIG.aggregated.initialLoad);
    }
  }, []); // eslint-disable-line

  // ── handleVisible ────────────────────────────────────────────────────────────
  const handleVisible = useCallback((index) => {
    if (anyModalRef.current || isFeedLocked()) return;
    const now = Date.now();
    if (now - lastScrollTime.current < 80) return;
    lastScrollTime.current = now;
    notifyActive(index);

    const remaining = feedItemsRef.current.length - index;
    if (remaining <= CONFIG.bufferAhead && !loadingMoreRef.current) {
      loadingMoreRef.current = true;
      (async () => {
        try {
          if (userHasMoreRef.current && !userLoadingRef.current)  fetchUserVideos();
          if (aggHasMoreRef.current  && !aggLoadingRef.current)   await fetchAggregated(aggPageRef.current + 1, CONFIG.aggregated.loadMore);
          if (!userHasMoreRef.current && !aggHasMoreRef.current)  recycle();
        } finally { loadingMoreRef.current = false; }
      })();
    }
  }, [notifyActive, fetchUserVideos, fetchAggregated, recycle]);

  // ── Scroll fallback ─────────────────────────────────────────────────────────
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
    container.addEventListener('scroll', onScroll, { passive: true });
    return () => container.removeEventListener('scroll', onScroll);
  }, [notifyActive]);

  // ── handleVideoError ─────────────────────────────────────────────────────────
  const handleVideoError = useCallback((itemId) => {
    if (invalidSet.current.has(itemId)) return;
    invalidSet.current.add(itemId);
    feedItemsRef.current = feedItemsRef.current.filter(i => i.id !== itemId);
    startTransition(() => setFeedItems(prev => prev.filter(i => i.id !== itemId)));
    const remaining = feedItemsRef.current.length - activeIndexRef.current;
    if (remaining <= CONFIG.bufferAhead && !aggLoadingRef.current) {
      if (aggHasMoreRef.current) fetchAggregated(aggPageRef.current + 1, CONFIG.aggregated.loadMore);
      else recycle();
    }
  }, [fetchAggregated, recycle]);

  const handleModalChange = useCallback((isOpen) => {
    anyModalRef.current = isOpen;
    setAnyModalOpen(isOpen);
  }, []);

  const handleVideoPublished = useCallback(() => {
    feedItemsRef.current = [];
    seenSet.current.clear(); invalidSet.current.clear();
    aggPool.current = []; aggPageRef.current = 1; aggHasMoreRef.current = true;
    // ✅ FIX : reset des deux compteurs globaux au refresh complet
    _recycleRound = 0;
    _adCounter    = 0;
    setFeedItems([]); setFeedReady(false); setActiveDisplayIndex(0); setShowScrollHint(false);
    containerRef.current?.scrollTo({ top:0, behavior:'auto' });
    activeIndexRef.current = 0;
    fetchUserVideos(true);
    fetchAggregated(1, CONFIG.aggregated.initialLoad);
  }, [fetchUserVideos, fetchAggregated]);

  // ── Cleanup ─────────────────────────────────────────────────────────────────
  useEffect(() => () => {
    document.getElementById('vp-styles')?.remove();
    _cssInjected = false;
  }, []);

  // ── Filtre recherche ────────────────────────────────────────────────────────
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
        <div
          className={`fixed inset-0 bg-black overflow-hidden${feedReady ? ' vp-feed-ready' : ''}`}
          style={{ contain: 'strict' }}
        >
          {/* Skeleton — toujours dans le DOM, caché en CSS quand vp-feed-ready */}
          <SkeletonLayer />

          {/* ActionBar — z-50, au-dessus de tout */}
          <ActionBar
            onBack={handleBack} activeTab={activeTab} setActiveTab={setActiveTab}
            showSearch={showSearch} setShowSearch={setShowSearch}
            searchQuery={searchQuery} setSearchQuery={setSearchQuery}
            onAddVideo={handleAddVideo}
          />

          {/* Scroll hint */}
          <ScrollHint visible={showScrollHint && activeDisplayIndex === 0 && feedReady} />

          {/* ── Feed ── */}
          <div
            ref={containerRef}
            className="vp-scroll absolute inset-0 z-10 overflow-y-scroll snap-y snap-mandatory"
            style={{ willChange:'transform', WebkitOverflowScrolling:'touch', contain:'layout' }}
          >
            {displayItems.map((item, index) => {
              const dist = Math.abs(index - activeDisplayIndex);
              return dist > CONFIG.virtual
                ? <SlidePlaceholder key={item.id} />
                : <SlideItem
                    key={item.id}
                    item={item}
                    index={index}
                    onVisible={handleVisible}
                    onModalChange={handleModalChange}
                    onVideoError={handleVideoError}
                  />;
            })}
          </div>

          {/* Modal upload */}
          {showModal && (
            <VideoModal
              showModal={showModal}
              setShowModal={setShowModal}
              onVideoPublished={handleVideoPublished}
            />
          )}
        </div>
      </ModalOpenContext.Provider>
    </ActiveIndexContext.Provider>
  );
};

export default memo(VideosPage);