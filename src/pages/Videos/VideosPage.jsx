// 📁 src/pages/Videos/VideosPage.jsx — v14
//
// ═══════════════════════════════════════════════════════════════════════════════
// CHANGEMENTS v14 vs v13 :
//
//  🎬 MIX 80% BTP / 20% DIVERTISSEMENT
//     - fetchEntertainment() : appel dédié aux contenus pêle-mêle
//       (Pixabay/Vimeo catégories "fun, viral, sport, music, lifestyle")
//     - ENTERTAINMENT_RATIO = 0.20 : 1 slide diverti pour 4 BTP
//     - entertainmentPool séparé — jamais mélangé dans l'algo BTP
//     - Badge "Divertissement 🎬" sur les slides non-BTP
//
//  🛡️ SÉCURITÉ / ROBUSTESSE
//     - Pas de données sensibles dans le feed (emails filtrés)
//     - invalidSet persisté en sessionStorage (reset à fermeture onglet)
//     - fetchAggregated() : abort controller pour cancel les fetches obsolètes
//     - Protection double-fetch : aggLoadingRef + fetchId
//     - handleVisible() : debounce interne 100ms (IntersectionObserver suffit)
//     - loadMoreRef : mutex réel (Promise) pour éviter les appels parallèles
//
//  🚀 FLUIDITÉ INFINITE SCROLL
//     - IntersectionObserver seul pilote les transitions (plus de scroll listener)
//     - Threshold 0.55 (légèrement plus tôt) pour transition plus fluide
//     - Virtual window étendu : CONFIG.virtual = 6 (±6 slides rendues)
//     - notifyActive() émet en microtask (queueMicrotask) pour eviter jank
//     - preloadAhead dynamique selon la vitesse de scroll (AdaptiveBuffer)
//     - YouTubePool.warmup() appelé 2 slides avant (plus tôt = moins de poster)
//
//  🔄 CYCLE DE VIE AMÉLIORÉ
//     - recycle() trie différemment à chaque round (entropie)
//     - seenSet window glissante de 200 (au lieu de 300 fixes)
//       → les vieilles vidéos réapparaissent naturellement
//     - Cleanup au démontage : abort tous les fetches en cours
// ═══════════════════════════════════════════════════════════════════════════════

import React, {
  useState, useEffect, useRef, useCallback, memo,
  createContext, useContext, useMemo, startTransition,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate }             from 'react-router-dom';
import { useAuth }                 from '../../context/AuthContext';
import { useLanguage }             from '../../context/LanguageContext';
import { useVideos }               from '../../context/VideoContext';
import VideoCard, { isFeedLocked } from './VideoCard';
import AggregatedCard              from './AggregatedCard';
import VideoModal                  from './VideoModal';
import VideoAd                     from './Publicite/VideoAd.jsx';
import YouTubePool                 from './YouTubePool';
import { FaPlus, FaSearch, FaArrowLeft, FaTimes } from 'react-icons/fa';

const API_BASE = (
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD
    ? 'https://chantilink-backend.onrender.com/api'
    : 'http://localhost:5000/api')
).replace(/\/api$/, '');

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG v14
// ─────────────────────────────────────────────────────────────────────────────
const CONFIG = {
  ads:              { enabled: true, frequency: 10 },
  aggregated:       { enabled: true, initialLoad: 40, loadMore: 25 },
  entertainment:    { enabled: true, initialLoad: 12, loadMore: 8 },
  entertainmentRatio: 0.20,   // 20% des slides = divertissement
  virtual:          6,         // slides rendues autour de l'active
  bufferAhead:      8,
  bufferMin:        5,
  recycleMin:       8,
  preloadAhead:     4,
  momentumLock:     180,       // ms minimum entre deux transitions
  watchScoreMin:    0.12,
  ytWarmupAhead:    5,         // slides YT préchauffées à l'avance
  minFeedSize:      12,
  coldStartVariety: 5,

  behavior: {
    skipThresholdMs:   1200,
    replayThresholdMs: 500,
    pauseInterestMs:   3000,
    skipPenalty:       -0.8,
    replayBoost:       1.2,
    pauseBoost:        0.5,
    liveReorderDepth:  12,
  },

  network: {
    '4g':     { preloadBytes: 262144, preloadAhead: 4, ytSlots: 5 },
    '3g':     { preloadBytes: 65536,  preloadAhead: 2, ytSlots: 3 },
    '2g':     { preloadBytes: 0,      preloadAhead: 0, ytSlots: 2 },
    'slow-2g':{ preloadBytes: 0,      preloadAhead: 0, ytSlots: 1 },
    'default':{ preloadBytes: 131072, preloadAhead: 3, ytSlots: 4 },
  },

  profile: {
    storageKey:  'vp_user_profile_v3',
    decayFactor: 0.92,
    maxEntries:  80,
    boostBTP:    0.28,
    intentKey:   'vp_intent_profile_v1',
  },

  seen: {
    storageKey:  'vp_seen_ids_v1',
    invalidKey:  'vp_invalid_ids_v1',
    maxEntries:  200,            // fenêtre glissante réduite
  },

  diversity: {
    sourceWindow:   3,
    categoryWindow: 5,
    simPenalty:     0.35,
    simThreshold:   0.42,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// CATÉGORIES DIVERTISSEMENT (pour le 20%)
// ─────────────────────────────────────────────────────────────────────────────
const ENTERTAINMENT_CATEGORIES = [
  'fun', 'viral', 'sport', 'music', 'lifestyle', 'travel',
  'food', 'animals', 'nature', 'art', 'dance', 'comedy',
];

const ENTERTAINMENT_SOURCES = ['pixabay', 'vimeo', 'youtube'];

// Badge affiché sur les slides de divertissement
const EntertainmentBadge = memo(() => (
  <div style={{
    position: 'absolute', top: 12, right: 12, zIndex: 30,
    background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 9999, padding: '3px 10px',
    display: 'flex', alignItems: 'center', gap: 5,
    pointerEvents: 'none',
  }}>
    <span style={{ fontSize: 12 }}>🎬</span>
    <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 10, fontWeight: 700 }}>
      Divertissement
    </span>
  </div>
));
EntertainmentBadge.displayName = 'EntertainmentBadge';

// ─────────────────────────────────────────────────────────────────────────────
// COPY / NORMALISATION
// ─────────────────────────────────────────────────────────────────────────────
const CIVIL_FALLBACK_COPY = {
  fr: { title: 'Vidéo de chantier et génie civil', tags: ['geniecivil', 'btp', 'chantier'] },
  en: { title: 'Civil engineering and construction site video', tags: ['civilengineering', 'construction', 'sitework'] },
  ar: { title: 'فيديو عن الهندسة المدنية ومواقع البناء', tags: ['هندسةمدنية', 'بناء', 'موقع'] },
};

const normalizeFeedLanguage = (lang = 'fr') => {
  const code = String(lang || 'fr').toLowerCase().split(/[-_]/)[0];
  return ['fr', 'en', 'ar'].includes(code) ? code : 'fr';
};

const cleanText = (value = '') =>
  String(value || '')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/\bt\.co\/\S+/gi, '')
    .replace(/[@#][\p{L}\p{N}_-]+/gu, '')
    .replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ').trim();

const looksHashedOrNoisy = (value = '') => {
  const text = String(value || '').trim();
  if (!text) return true;
  if (/^[a-f0-9]{16,}$/i.test(text)) return true;
  if (/^[A-Za-z0-9+/=_-]{24,}$/.test(text) && !/\s/.test(text)) return true;
  const tokens     = text.split(/\s+/);
  const noisyCount = tokens.filter(t =>
    /https?:|t\.co\//i.test(t) || /^[#@]/.test(t) || /^[A-Za-z0-9_-]{14,}$/.test(t)
  ).length;
  const letters = (text.match(/\p{L}/gu) || []).length;
  const symbols = (text.match(/[^\p{L}\p{N}\s.,:;!?'"()\-]/gu) || []).length;
  return noisyCount / Math.max(tokens.length, 1) > 0.45 || letters < 8 || symbols > letters * 0.45;
};

const cleanTags = (tags, lang = 'fr') => {
  const fallback = CIVIL_FALLBACK_COPY[normalizeFeedLanguage(lang)].tags;
  const source   = Array.isArray(tags) ? tags : [];
  const cleaned  = source
    .map(tag => cleanText(tag).replace(/^#+/, '').replace(/[^\p{L}\p{N}_-]/gu, '').toLowerCase())
    .filter(tag => tag.length >= 3 && tag.length <= 28 && !looksHashedOrNoisy(tag))
    .filter((tag, idx, arr) => arr.indexOf(tag) === idx)
    .slice(0, 3);
  return cleaned.length ? cleaned : fallback;
};

// ─────────────────────────────────────────────────────────────────────────────
// NETWORK MANAGER
// ─────────────────────────────────────────────────────────────────────────────
class NetworkManager {
  constructor() {
    this._type = 'default'; this._saveData = false; this._update();
    if ('connection' in navigator) navigator.connection.addEventListener('change', () => this._update());
  }
  _update() {
    const conn = navigator.connection;
    if (!conn) { this._type = 'default'; return; }
    this._saveData = conn.saveData || false;
    this._type     = conn.effectiveType || 'default';
  }
  get cfg()          { return this._saveData ? CONFIG.network['2g'] : (CONFIG.network[this._type] || CONFIG.network['default']); }
  get preloadBytes() { return this.cfg.preloadBytes; }
  get preloadAhead() { return this.cfg.preloadAhead; }
  get ytSlots()      { return this.cfg.ytSlots; }
  get canPreload()   { return this.cfg.preloadBytes > 0; }
  get effectiveType(){ return this._type; }
}
const networkMgr = new NetworkManager();

// ─────────────────────────────────────────────────────────────────────────────
// INTENT CLASSIFIER
// ─────────────────────────────────────────────────────────────────────────────
const INTENT_PATTERNS = {
  btp_pro:       ['chantier','béton','beton','coffrage','ferraillage','maçonnerie','terrassement','grue','pelleteuse','échafaudage','formwork','rebar','excavation','fondation','structure'],
  learning:      ['tutoriel','tutorial','comment faire','how to','formation','cours','technique','explication','guide','méthode','apprendre'],
  entertainment: ['compilation','best of','funny','incroyable','amazing','fail','top','viral','tiktok','sport','music'],
  news:          ['actualité','news','breaking','annonce','nouveau','lancement','2024','2025'],
  ambient:       ['relaxing','satisfying','asmr','timelapse','time-lapse','drone','aerial'],
};

const classifyIntent = (item) => {
  const text = [item.title||'',item.description||'',item.channelName||'',item.category||''].join(' ').toLowerCase();
  const scores = {};
  for (const [intent, keywords] of Object.entries(INTENT_PATTERNS)) {
    scores[intent] = keywords.filter(kw => text.includes(kw)).length;
  }
  const top = Object.entries(scores).sort((a,b) => b[1]-a[1])[0];
  return top[1] > 0 ? top[0] : 'entertainment';
};

// ─────────────────────────────────────────────────────────────────────────────
// PERSISTANCE
// ─────────────────────────────────────────────────────────────────────────────
const loadPersistedSet = (key, max = CONFIG.seen.maxEntries, storage = localStorage) => {
  try { const raw = storage.getItem(key); if (!raw) return new Set(); return new Set(JSON.parse(raw).slice(-max)); } catch { return new Set(); }
};
const persistSet = (key, set, max = CONFIG.seen.maxEntries, storage = localStorage) => {
  try { storage.setItem(key, JSON.stringify([...set].slice(-max))); } catch {}
};
const loadJSON = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; } };
const saveJSON = (key, data) => { try { localStorage.setItem(key, JSON.stringify(data)); } catch {} };

// ─────────────────────────────────────────────────────────────────────────────
// USER PROFILE STORE
// ─────────────────────────────────────────────────────────────────────────────
const BTP_CATEGORIES = new Set(['construction','btp','chantier','engineering','civil','architecture','genie_civil']);

class UserProfileStore {
  constructor() { this._data = this._load(); this._intent = loadJSON(CONFIG.profile.intentKey, {}); this._timer = null; }
  _load() {
    try {
      const raw = localStorage.getItem(CONFIG.profile.storageKey);
      if (!raw) return this._defaults();
      const p    = JSON.parse(raw);
      const days = (Date.now() - (p.lastVisit||0)) / 86400000;
      if (days > 0.5) {
        const decay = Math.pow(CONFIG.profile.decayFactor, Math.min(days, 30));
        for (const k of Object.keys(p.categories||{})) p.categories[k] *= decay;
        for (const k of Object.keys(p.sources||{}))    p.sources[k]   *= decay;
        for (const k of Object.keys(p.tags||{}))       p.tags[k]      *= decay;
      }
      return { ...this._defaults(), ...p };
    } catch { return this._defaults(); }
  }
  _defaults() { return { categories:{}, sources:{}, tags:{}, totalViewed:0, btpScore:0, lastVisit:Date.now(), createdAt:Date.now() }; }
  _scheduleSave() {
    if (this._timer) clearTimeout(this._timer);
    this._timer = setTimeout(() => {
      this._data.lastVisit = Date.now();
      saveJSON(CONFIG.profile.storageKey, this._data);
      saveJSON(CONFIG.profile.intentKey, this._intent);
    }, 1500);
  }
  applyBehaviorSignal(item, signalType) {
    if (!item) return;
    const delta = CONFIG.behavior[`${signalType}Boost`] || CONFIG.behavior[`${signalType}Penalty`] || 0;
    if (Math.abs(delta) < 0.01) return;
    const src = item.source || 'unknown';
    this._data.sources[src] = Math.max(-5, (this._data.sources[src]||0) + delta);
    const intent = classifyIntent(item);
    this._intent[intent] = Math.max(-5, (this._intent[intent]||0) + delta);
    for (const c of this._catsOf(item)) this._data.categories[c] = Math.max(-5, (this._data.categories[c]||0) + delta * 0.7);
    this._scheduleSave();
  }
  recordView(item, watchPct = 0) {
    if (!item) return;
    const boost = 0.1 + watchPct * 0.9, d = this._data;
    for (const c of this._catsOf(item)) d.categories[c] = (d.categories[c]||0) + boost;
    d.sources[item.source||'unknown'] = (d.sources[item.source||'unknown']||0) + boost;
    for (const t of this._tagsOf(item)) d.tags[t] = (d.tags[t]||0) + boost * 0.5;
    d.totalViewed++;
    const isBTP = this._catsOf(item).some(c => BTP_CATEGORIES.has(c));
    d.btpScore = Math.max(0, Math.min(1, d.btpScore + (isBTP ? boost : -boost * 0.15) * 0.05));
    const intent = classifyIntent(item);
    this._intent[intent] = (this._intent[intent]||0) + boost;
    this._scheduleSave();
  }
  scoreItem(item) {
    if (!item) return 0;
    const d = this._data; let score = 0;
    for (const c of this._catsOf(item)) score += (d.categories[c]||0) * 1.5;
    score += (d.sources[item.source||'unknown']||0) * 0.8;
    for (const t of this._tagsOf(item)) score += (d.tags[t]||0) * 0.4;
    const intent = classifyIntent(item);
    score += (this._intent[intent]||0) * 1.2;
    if (d.btpScore > 0.4 && detectBTPLocal(item)) score += CONFIG.profile.boostBTP * 10;
    return score;
  }
  get dominantIntent() { const e = Object.entries(this._intent); if (!e.length) return null; return e.sort((a,b) => b[1]-a[1])[0][0]; }
  get isBTPUser()  { return this._data.btpScore > 0.4; }
  get btpScore()   { return this._data.btpScore; }
  get isNewUser()  { return this._data.totalViewed < 5; }
  _catsOf(item) { const cats = new Set(); if (item.category) cats.add(item.category.toLowerCase()); if (detectBTPLocal(item)) cats.add('btp'); return [...cats]; }
  _tagsOf(item) { return [item.title||'',item.description||''].join(' ').toLowerCase().split(/\W+/).filter(w => w.length > 3).slice(0, 12); }
}

const userProfile = new UserProfileStore();

// ─────────────────────────────────────────────────────────────────────────────
// BEHAVIORAL + DIVERSITY + REORDER
// ─────────────────────────────────────────────────────────────────────────────
class BehavioralEngine {
  constructor() { this._entryTime = new Map(); this._callbacks = []; }
  onSignal(cb) { this._callbacks.push(cb); return () => { this._callbacks = this._callbacks.filter(x => x !== cb); }; }
  _emit(signal, item) { for (const cb of this._callbacks) cb(signal, item); }
  enter(uid, item) { this._entryTime.set(uid, { ts: Date.now(), item }); }
  leave(uid) {
    const entry = this._entryTime.get(uid); if (!entry) return;
    this._entryTime.delete(uid);
    const elapsed = Date.now() - entry.ts, { item } = entry;
    if (!item) return;
    if (elapsed < CONFIG.behavior.skipThresholdMs) { userProfile.applyBehaviorSignal(item, 'skip'); this._emit('skip', item); }
    else if (elapsed > 25000) { userProfile.recordView(item, elapsed / 30000); this._emit('longWatch', item); }
  }
  registerReplay(item) { userProfile.applyBehaviorSignal(item, 'replay'); this._emit('replay', item); }
}
const behaviorEngine = new BehavioralEngine();

class DiversityGuard {
  constructor() { this._recentSources = []; this._recentCategories = []; this._recentTitles = []; this._recentIntents = []; }
  penalty(item) {
    if (!item) return 0;
    let pen = 0;
    const src = item.source || 'unknown';
    if (this._recentSources.slice(-CONFIG.diversity.sourceWindow).filter(s => s === src).length >= 2) pen += 0.6;
    for (const c of this._catsOf(item)) {
      if (this._recentCategories.slice(-CONFIG.diversity.categoryWindow).filter(x => x === c).length >= 2) pen += 0.4;
    }
    const intent = classifyIntent(item);
    if (this._recentIntents.slice(-4).filter(i => i === intent).length >= 3) pen += 0.3;
    const titleTokens = this._tokenize(item.title || '');
    for (const prev of this._recentTitles.slice(-3)) {
      if (this._jaccard(titleTokens, prev) > CONFIG.diversity.simThreshold) pen += CONFIG.diversity.simPenalty;
    }
    return Math.min(1, pen);
  }
  register(item) {
    if (!item) return;
    this._push(this._recentSources, item.source || 'unknown', CONFIG.diversity.sourceWindow + 2);
    for (const c of this._catsOf(item)) this._push(this._recentCategories, c, CONFIG.diversity.categoryWindow + 2);
    const tokens = this._tokenize(item.title || '');
    if (tokens.size > 0) this._push(this._recentTitles, tokens, 5);
    this._push(this._recentIntents, classifyIntent(item), 6);
  }
  reset() { this._recentSources = []; this._recentCategories = []; this._recentTitles = []; this._recentIntents = []; }
  _push(arr, val, max) { arr.push(val); if (arr.length > max) arr.shift(); }
  _catsOf(item) { const cats = new Set(); if (item.category) cats.add(item.category.toLowerCase()); if (detectBTPLocal(item)) cats.add('btp'); return [...cats]; }
  _tokenize(text) { return new Set(text.toLowerCase().split(/\W+/).filter(w => w.length > 3)); }
  _jaccard(a, b) { if (!a.size || !b.size) return 0; let i = 0; for (const x of a) if (b.has(x)) i++; return i / (a.size + b.size - i); }
}
const diversityGuard = new DiversityGuard();

const intelligentReorder = (items, { jitter = 0.3, forColdStart = false } = {}) => {
  if (items.length <= 1) return items;
  if (forColdStart && items.length >= CONFIG.coldStartVariety) {
    const btpItem    = items.find(i => detectBTPLocal(i));
    const viralItem  = items.find(i => (i.likes||0) > 500 || (i.views||0) > 20000);
    const recentItem = items.find(i => i.publishedAt && (Date.now() - new Date(i.publishedAt).getTime()) < 48 * 3600000);
    const anchors    = [...new Set([btpItem, viralItem, recentItem].filter(Boolean))];
    const ordered    = [...items];
    anchors.forEach((a, idx) => {
      const slot = [0, 1, 3][idx];
      if (slot !== undefined && slot < ordered.length) {
        const current = ordered[slot]; ordered[slot] = a;
        const swapIdx = ordered.indexOf(a, slot + 1);
        if (swapIdx >= 0) ordered[swapIdx] = current;
      }
    });
    return ordered;
  }
  const scored = items.map(item => {
    const profileScore = userProfile.scoreItem(item);
    const viralScore   = Math.log1p((item.likes||0) + (item.views||0) * 0.01) * 0.5;
    const freshScore   = item.publishedAt ? Math.max(0, 1 - (Date.now() - new Date(item.publishedAt).getTime()) / (7 * 86400000)) : 0;
    const jitterVal    = (Math.random() - 0.5) * jitter;
    return { item, raw: profileScore * 2 + viralScore + freshScore + jitterVal };
  });
  const result = [], remaining = [...scored];
  while (remaining.length > 0) {
    let bestScore = -Infinity, bestIdx = 0;
    for (let i = 0; i < remaining.length; i++) {
      const score = remaining[i].raw * (1 - diversityGuard.penalty(remaining[i].item));
      if (score > bestScore) { bestScore = score; bestIdx = i; }
    }
    const chosen = remaining.splice(bestIdx, 1)[0];
    diversityGuard.register(chosen.item);
    result.push(chosen.item);
  }
  return result;
};

// ─────────────────────────────────────────────────────────────────────────────
// FILTRES
// ─────────────────────────────────────────────────────────────────────────────
const R2_HOSTS    = ['r2.dev', 'pub-'];
const VALID_HOSTS = ['cdn.pixabay.com/video', 'player.pixabay.com', 'vimeocdn.com', 'player.vimeo.com', 'youtube.com/embed'];
const PLAYABLE_EXT= /\.(mp4|webm|mov)(\?|$)/i;
const BLOCKED_URL = ['youtu.be', 'dailymotion.'];

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
  if (url.includes('pexels.com') && !url.includes('videos.pexels.com')) return false;
  if (url.includes('vimeo.com') && !url.includes('vimeocdn.com') && !url.includes('player.vimeo.com')) return false;
  if (R2_HOSTS.some(h => url.includes(h))) return true;
  if (VALID_HOSTS.some(h => url.includes(h))) return true;
  if (PLAYABLE_EXT.test(url)) return true;
  if (item.source === 'pixabay' && item.externalId) return true;
  return false;
};

const BTP_KW = [
  'chantier','construction','btp','bâtiment','batiment','béton','beton','ciment','grue','pelleteuse',
  'pont','route','voirie','hydraulique','terrassement','coffrage','ferraillage','fondation','maçonnerie',
  'maconnerie','charpente','topographie','architecture','ouvrage','infrastructure','assainissement',
  'civil engineering','construction site','building site','concrete','scaffolding','formwork','rebar',
  'excavation','earthwork','foundation','structural','bridge','roadwork','masonry','site work',
];
const detectBTPLocal = (item) => {
  if (!item) return false;
  const text = [
    item.title||'', item.description||'', item.channelName||'', item.category||'',
    ...(Array.isArray(item.hashtags) ? item.hashtags : []),
    ...(Array.isArray(item.tags)     ? item.tags     : []),
  ].join(' ').toLowerCase();
  return BTP_KW.some(kw => text.includes(kw));
};

const sanitizeItem = (item, language = 'fr') => {
  const lang     = normalizeFeedLanguage(language);
  const fallback = CIVIL_FALLBACK_COPY[lang] || CIVIL_FALLBACK_COPY.fr;
  const title    = cleanText(item.title || item.description || '');
  const description = cleanText(item.description || '');
  const hasUsableTitle       = title && !looksHashedOrNoisy(title);
  const hasUsableDescription = description && !looksHashedOrNoisy(description) && description !== title;
  return {
    ...item,
    title:       hasUsableTitle ? title.slice(0, 140) : fallback.title,
    description: hasUsableDescription ? description.slice(0, 180) : '',
    hashtags:    cleanTags(item.hashtags || item.tags, lang),
    tags:        cleanTags(item.tags     || item.hashtags, lang),
  };
};

const extractYoutubeIds = (items, fromIndex, count = 5) => {
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
// PRELOAD
// ─────────────────────────────────────────────────────────────────────────────
const _preloadedUrls = new Set();
const _preloadAborts = new Map();
const _preloadQueue  = [];
let   _preloadRunning = 0;
const _preloadMax     = 2;

const _drainPreloadQueue = () => {
  if (!networkMgr.canPreload) return;
  while (_preloadRunning < _preloadMax && _preloadQueue.length > 0) {
    const { url, ctrl, bytes } = _preloadQueue.shift();
    if (_preloadedUrls.has(url)) continue;
    _preloadedUrls.add(url); _preloadAborts.set(url, ctrl); _preloadRunning++;
    fetch(url, {
      method: 'GET',
      headers: bytes > 0 ? { Range: `bytes=0-${bytes - 1}` } : {},
      cache: 'force-cache',
      signal: ctrl.signal,
    })
      .catch(() => {})
      .finally(() => { _preloadRunning--; _preloadAborts.delete(url); _drainPreloadQueue(); });
  }
};

const injectPreload = (item) => {
  if (!item?.data || !networkMgr.canPreload) return;
  if (item.data.isEmbed) return;
  const url   = item.data.videoUrl || item.data.url || '';
  const bytes = networkMgr.preloadBytes;
  if (!url || _preloadedUrls.has(url) || url.includes('.m3u8')) return;
  const ctrl    = new AbortController();
  const enqueue = () => { _preloadQueue.push({ url, ctrl, bytes }); _drainPreloadQueue(); };
  if ('requestIdleCallback' in window) requestIdleCallback(enqueue, { timeout: 1500 });
  else setTimeout(enqueue, 200);
};

const cancelPreloadsAfter = (keepCount) => {
  if (_preloadQueue.length > keepCount) {
    const cancelled = _preloadQueue.splice(keepCount);
    for (const { ctrl } of cancelled) { try { ctrl.abort(); } catch {} }
  }
};

const isR2Url = (url) => R2_HOSTS.some(h => url.includes(h));

const probeItemBackground = (item, onInvalid) => {
  if (!item || item._isAggregated || item.isEmbed) return;
  const url = item.videoUrl || item.url || '';
  if (!url) { onInvalid(); return; }
  if (isR2Url(url)) return;
  if (url.includes('res.cloudinary.com')) { onInvalid(); return; }
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  fetch(url, { method: 'HEAD', cache: 'no-store', signal: ctrl.signal })
    .then(r => { clearTimeout(timer); if ([401, 403, 404, 410].includes(r.status)) onInvalid(); })
    .catch(() => clearTimeout(timer));
};

// ─────────────────────────────────────────────────────────────────────────────
// WATCH SCORE + ADAPTIVE BUFFER
// ─────────────────────────────────────────────────────────────────────────────
class WatchScoreTracker {
  constructor() { this._map = new Map(); this._active = null; }
  enter(uid) { if (this._active && this._active !== uid) this._leave(this._active); this._active = uid; if (!this._map.has(uid)) this._map.set(uid, { start: Date.now(), total: 0, score: 0 }); else this._map.get(uid).start = Date.now(); }
  _leave(uid) { const r = this._map.get(uid); if (!r?.start) return; r.total += Date.now() - r.start; r.start = null; r.score = Math.min(1, r.total / 30000); }
  leave(uid) { if (this._active === uid) this._active = null; this._leave(uid); }
  getScore(uid) { return this._map.get(uid)?.score ?? 0; }
  clear() { this._map.clear(); this._active = null; }
}
const watchScore = new WatchScoreTracker();

class AdaptiveBuffer {
  constructor() { this._times = []; this._value = CONFIG.bufferAhead; }
  record(now = Date.now()) {
    this._times.push(now);
    if (this._times.length > 6) this._times.shift();
    if (this._times.length >= 2) {
      const intervals = [];
      for (let i = 1; i < this._times.length; i++) intervals.push(this._times[i] - this._times[i - 1]);
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      this._value = avg < 600 ? Math.min(CONFIG.bufferAhead + 6, 20) : CONFIG.bufferAhead;
    }
    return this._value;
  }
  get value() { return this._value; }
  reset() { this._times = []; this._value = CONFIG.bufferAhead; }
}
const adaptiveBuf = new AdaptiveBuffer();

// ─────────────────────────────────────────────────────────────────────────────
// VIRAL BOOST + SMART RECYCLE
// ─────────────────────────────────────────────────────────────────────────────
let _adCounter = 0;

const applyViralBoost = (items) => {
  const viral  = items.filter(i => detectBTPLocal(i) ? (i.likes||0) > 500 || (i.views||0) > 25000 : (i.likes||0) > 1000 || (i.views||0) > 50000);
  const normal = items.filter(i => !viral.includes(i));
  const result = []; let vi = 0;
  for (let i = 0; i < normal.length; i++) {
    result.push(normal[i]);
    if ((i + 1) % 4 === 0 && vi < viral.length) result.push(viral[vi++]);
  }
  while (vi < viral.length) result.push(viral[vi++]);
  return result;
};

let _recycleRound = 0;
const smartRecycle = (pool) => {
  _recycleRound++;
  diversityGuard.reset();
  // Entropie différente à chaque round
  const shuffled = [...pool].sort(() => (Math.random() - 0.5) * (0.3 + (_recycleRound % 3) * 0.2));
  return intelligentReorder(shuffled).map(item => ({
    ...item,
    _uid: `rec-${_recycleRound}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  }));
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
  @keyframes vp-bounce  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
  @keyframes vp-flash   { 0%{opacity:0.18} 100%{opacity:0} }
  @keyframes vp-intent  { 0%{opacity:0;transform:translateY(6px) scale(0.9)} 15%{opacity:1;transform:translateY(0) scale(1)} 80%{opacity:1} 100%{opacity:0;transform:translateY(-4px)} }
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
  .vp-ptr-spinner { width:26px;height:26px;border-radius:50%;border:2.5px solid rgba(255,255,255,0.15);border-top-color:rgba(255,255,255,0.65);animation:vp-spin 0.7s linear infinite; }
  .vp-intent-toast { animation:vp-intent 3.2s ease-in-out forwards; }
  .vp-net-badge { position:absolute;top:6px;right:6px;font-size:9px;font-weight:700;padding:2px 6px;border-radius:9999px;pointer-events:none;z-index:60; }
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
// UI COMPONENTS (ProgressRing, badges, skeleton, ActionBar, etc.)
// ─────────────────────────────────────────────────────────────────────────────
const ProgressRing = memo(({ progress = 0, size = 36, stroke = 2.5 }) => {
  const r = (size - stroke * 2) / 2, circ = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={stroke} />
      <circle className="vp-progress-ring" cx={size/2} cy={size/2} r={r} fill="none"
        stroke="url(#vpGrad)" strokeWidth={stroke} strokeDasharray={circ}
        strokeDashoffset={circ * (1 - Math.max(0, Math.min(1, progress)))}
        style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }} />
      <defs><linearGradient id="vpGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#ff6b35"/><stop offset="100%" stopColor="#e91e8c"/>
      </linearGradient></defs>
    </svg>
  );
});
ProgressRing.displayName = 'ProgressRing';

const WatchStreakBadge = memo(({ count }) => {
  if (count < 3) return null;
  return (
    <div className="vp-streak-badge absolute top-16 left-1/2 -translate-x-1/2 z-40 pointer-events-none"
      style={{ background:'rgba(0,0,0,0.55)',backdropFilter:'blur(12px)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:9999,padding:'4px 12px',display:'flex',alignItems:'center',gap:6 }}>
      <span style={{ fontSize: 13 }}>{count >= 20 ? '🔥🔥' : count >= 10 ? '🔥' : '✨'}</span>
      <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: 700 }}>{count} vues</span>
    </div>
  );
});
WatchStreakBadge.displayName = 'WatchStreakBadge';

const IntentToast = memo(({ intent }) => {
  const labels = {
    btp_pro: '🏗️ Contenu pro BTP', learning: '📚 Mode apprentissage',
    entertainment: '🎬 Mode divertissement', news: '📰 Actualités', ambient: '🎥 Immersif',
  };
  if (!intent || !labels[intent]) return null;
  return (
    <div className="vp-intent-toast absolute top-20 left-1/2 -translate-x-1/2 z-40 pointer-events-none whitespace-nowrap"
      style={{ background:'rgba(0,0,0,0.65)',backdropFilter:'blur(14px)',border:'1px solid rgba(255,255,255,0.12)',borderRadius:9999,padding:'5px 14px',fontSize:11,fontWeight:600,color:'rgba(255,255,255,0.8)' }}>
      {labels[intent]}
    </div>
  );
});
IntentToast.displayName = 'IntentToast';

const NetworkBadge = memo(({ type }) => {
  if (type === 'default' || type === '4g') return null;
  const colors = { '3g': '#f59e0b', '2g': '#ef4444', 'slow-2g': '#ef4444' };
  const labels = { '3g': '3G', '2g': '2G ⚠️', 'slow-2g': 'Lent ⚠️' };
  return <div className="vp-net-badge" style={{ background:'rgba(0,0,0,0.6)', color: colors[type]||'#fff' }}>{labels[type]||type}</div>;
});
NetworkBadge.displayName = 'NetworkBadge';

const OfflineBanner = memo(({ show }) => (
  <AnimatePresence>{show && (
    <motion.div initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -40, opacity: 0 }}
      className="absolute top-0 left-0 right-0 z-[60] pointer-events-none flex justify-center"
      style={{ paddingTop: 'max(52px, calc(env(safe-area-inset-top) + 52px))' }}>
      <div style={{ background:'rgba(20,20,20,0.92)',backdropFilter:'blur(16px)',border:'1px solid rgba(255,80,80,0.3)',borderRadius:9999,padding:'6px 16px',display:'flex',alignItems:'center',gap:8 }}>
        <div style={{ width:7,height:7,borderRadius:'50%',background:'#ff4d4d' }}/>
        <span style={{ color:'rgba(255,255,255,0.7)',fontSize:11,fontWeight:600 }}>Hors ligne</span>
      </div>
    </motion.div>
  )}</AnimatePresence>
));
OfflineBanner.displayName = 'OfflineBanner';

const SK_BG = [
  'linear-gradient(135deg,#08081a,#18104a,#08081a)', 'linear-gradient(135deg,#08100a,#0a2818,#08100a)',
  'linear-gradient(135deg,#180808,#2a0818,#180808)', 'linear-gradient(135deg,#081018,#0a2035,#081018)',
  'linear-gradient(135deg,#181008,#2c1808,#181008)',
];
const SkeletonLayer = memo(() => (
  <div className="vp-sk-layer" aria-hidden="true">
    {SK_BG.map((bg, i) => (
      <div key={i} className="vp-sk-slide" style={{ background: bg }}>
        <div style={{ position:'absolute',inset:0,background:'linear-gradient(180deg,transparent 42%,rgba(0,0,0,0.9) 100%)' }}/>
        <div style={{ position:'absolute',bottom:80,left:16,right:72 }}>
          <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:10 }}>
            <div className="vp-sk-dot" style={{ width:40,height:40,animationDelay:`${i*0.13}s` }}/>
            <div>
              <div className="vp-sk-bar" style={{ width:88,marginBottom:6,animationDelay:`${i*0.13+0.07}s` }}/>
              <div className="vp-sk-bar" style={{ width:58,height:8,animationDelay:`${i*0.13+0.14}s` }}/>
            </div>
          </div>
          <div className="vp-sk-bar" style={{ width:'85%',maxWidth:210,marginBottom:7,animationDelay:`${i*0.1}s` }}/>
          <div className="vp-sk-bar" style={{ width:'60%',maxWidth:150,height:8,animationDelay:`${i*0.1+0.07}s` }}/>
        </div>
        <div style={{ position:'absolute',right:10,bottom:80,display:'flex',flexDirection:'column',gap:18 }}>
          {[0,1,2].map(j => <div key={j} className="vp-sk-dot" style={{ width:40,height:40,animationDelay:`${i*0.13+j*0.1}s` }}/>)}
        </div>
        {i === 0 && (
          <div style={{ position:'absolute',top:'42%',left:'50%',transform:'translate(-50%,-50%)',background:'rgba(255,255,255,0.04)',backdropFilter:'blur(14px)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:9999,padding:'9px 20px',display:'flex',alignItems:'center',gap:10 }}>
            <div style={{ width:13,height:13,borderRadius:'50%',border:'2px solid rgba(255,255,255,0.08)',borderTopColor:'rgba(255,255,255,0.45)',animation:'vp-spin 0.85s linear infinite' }}/>
            <span style={{ color:'rgba(255,255,255,0.3)',fontSize:11,fontWeight:500 }}>Chargement des vidéos…</span>
          </div>
        )}
      </div>
    ))}
  </div>
));
SkeletonLayer.displayName = 'SkeletonLayer';

const SlideFlash = memo(({ trigger }) => {
  const [key, setKey] = useState(0);
  useEffect(() => { if (trigger) setKey(k => k + 1); }, [trigger]);
  return <div key={key} className="vp-slide-flash" aria-hidden="true"/>;
});
SlideFlash.displayName = 'SlideFlash';

const ActionBar = memo(({ onBack, showSearch, setShowSearch, searchQuery, setSearchQuery, onAddVideo, currentIndex, totalItems }) => {
  const progress = totalItems > 1 ? currentIndex / (totalItems - 1) : 0;
  return (
    <div className="absolute top-0 left-0 right-0 z-50 pointer-events-none">
      <div className="pointer-events-auto" style={{ background:'linear-gradient(180deg,rgba(0,0,0,0.9) 0%,rgba(0,0,0,0.45) 72%,transparent 100%)',paddingBottom:20 }}>
        <div className="flex items-center justify-between px-3" style={{ paddingTop:'max(12px, env(safe-area-inset-top))' }}>
          <button onClick={onBack} className="relative flex items-center justify-center active:scale-90 transition-transform" style={{ WebkitTapHighlightColor:'transparent' }}>
            <ProgressRing progress={progress} size={38} stroke={2.2}/>
            <FaArrowLeft size={12} className="text-white absolute"/>
          </button>
          <div style={{ flex: 1 }}/>
          <div className="flex items-center gap-1.5">
            <div className="relative flex items-center">
              <AnimatePresence>
                {showSearch && (
                  <motion.input initial={{ width:0,opacity:0 }} animate={{ width:140,opacity:1 }} exit={{ width:0,opacity:0 }} transition={{ duration:0.16 }}
                    value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Rechercher…"
                    className="text-white text-xs px-3 py-1.5 rounded-full outline-none"
                    style={{ background:'rgba(255,255,255,0.12)',backdropFilter:'blur(12px)',border:'1px solid rgba(255,255,255,0.14)',position:'absolute',right:40 }} autoFocus/>
                )}
              </AnimatePresence>
              <button onClick={() => setShowSearch(s => !s)} className="w-9 h-9 rounded-full flex items-center justify-center text-white active:scale-90 transition-transform"
                style={{ background:'rgba(255,255,255,0.1)',backdropFilter:'blur(12px)',border:'1px solid rgba(255,255,255,0.09)',WebkitTapHighlightColor:'transparent' }}>
                {showSearch ? <FaTimes size={11}/> : <FaSearch size={11}/>}
              </button>
            </div>
            <button onClick={onAddVideo} className="w-9 h-9 rounded-full flex items-center justify-center text-white active:scale-90 transition-transform"
              style={{ background:'linear-gradient(135deg,#ff6b35,#e91e8c)',boxShadow:'0 3px 12px rgba(233,30,140,0.4)',WebkitTapHighlightColor:'transparent' }}>
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
    <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} transition={{ delay:2.5,duration:0.5 }}
      className="absolute bottom-24 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2 pointer-events-none">
      <div className="vp-swipe-arrow flex flex-col items-center gap-1.5">
        <span style={{ color:'rgba(255,255,255,0.28)',fontSize:9,fontWeight:700,letterSpacing:'0.18em',textTransform:'uppercase' }}>Swipe</span>
        <div style={{ width:1,height:18,background:'linear-gradient(180deg,transparent,rgba(255,255,255,0.35))' }}/>
        <div style={{ width:16,height:16,borderRadius:'50%',border:'1.5px solid rgba(255,255,255,0.28)',display:'flex',alignItems:'center',justifyContent:'center' }}>
          <div style={{ width:4,height:4,borderRadius:'50%',background:'rgba(255,255,255,0.45)' }}/>
        </div>
      </div>
    </motion.div>
  )}</AnimatePresence>
));
SwipeHint.displayName = 'SwipeHint';

const SlidePlaceholder = memo(() => <div className="w-full snap-start snap-always vp-ph" aria-hidden="true"/>);
SlidePlaceholder.displayName = 'SlidePlaceholder';

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE ITEM — IntersectionObserver seul pilote les transitions
// ─────────────────────────────────────────────────────────────────────────────
const SlideItem = memo(({ item, index, onVisible, onModalChange, onVideoError }) => {
  const ctx       = useContext(ActiveIndexContext);
  const modalOpen = useContext(ModalOpenContext);
  const ref       = useRef(null);
  const [isActive, setIsActive] = useState(() => ctx?.getActiveIndex() === index);
  const uid      = item.id;
  const itemData = item.data;
  const isEntertainment = item.isEntertainment;

  useEffect(() => {
    if (!ctx) return;
    const unsub = ctx.subscribe(index, (active) => {
      setIsActive(active);
      if (active) { watchScore.enter(uid); behaviorEngine.enter(uid, itemData); }
      else         { watchScore.leave(uid); behaviorEngine.leave(uid); }
    });
    if (ctx.getActiveIndex() === index) { setIsActive(true); watchScore.enter(uid); behaviorEngine.enter(uid, itemData); }
    return () => { unsub(); watchScore.leave(uid); behaviorEngine.leave(uid); };
  }, [ctx, index, uid, itemData]);

  useEffect(() => {
    const el = ref.current;
    if (!el || modalOpen) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting && e.intersectionRatio >= 0.55) onVisible(index); },
      { threshold: 0.55 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [index, onVisible, modalOpen]);

  return (
    <div ref={ref} className="w-full snap-start snap-always" style={SLIDE_STYLE}>
      {item.type === 'ad'
        ? <VideoAd isActive={isActive}/>
        : (
          <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            {item.isAggregated
              ? <AggregatedCard content={itemData} isActive={isActive} onModalChange={onModalChange}
                  onVideoError={onVideoError ? () => onVideoError(item.id) : undefined}/>
              : <VideoCard video={itemData} isActive={isActive} isAutoPost={false} onModalChange={onModalChange}
                  onVideoError={onVideoError ? () => onVideoError(item.id) : undefined}/>
            }
            {/* Badge divertissement */}
            {isEntertainment && isActive && <EntertainmentBadge/>}
          </div>
        )
      }
    </div>
  );
},
(prev, next) =>
  prev.item.id      === next.item.id &&
  prev.index        === next.index   &&
  prev.onVisible    === next.onVisible &&
  prev.onModalChange=== next.onModalChange &&
  prev.onVideoError === next.onVideoError
);
SlideItem.displayName = 'SlideItem';

// ─────────────────────────────────────────────────────────────────────────────
// VIDEOS PAGE v14
// ─────────────────────────────────────────────────────────────────────────────
const VideosPage = () => {
  ensureCSS();
  const navigate                                    = useNavigate();
  const { getToken }                                = useAuth();
  const isOnline                                    = useOnline();
  const { language }                                = useLanguage();
  const { videos: userVideos, loading: userLoading,
          hasMore: userHasMore, fetchVideos: fetchUserVideos } = useVideos();
  useVhFix();

  const [feedItems,          setFeedItems]          = useState([]);
  const [feedReady,          setFeedReady]          = useState(false);
  const [activeDisplayIndex, setActiveDisplayIndex] = useState(0);
  const [anyModalOpen,       setAnyModalOpen]       = useState(false);
  const [showModal,          setShowModal]          = useState(false);
  const [showSearch,         setShowSearch]         = useState(false);
  const [searchQuery,        setSearchQuery]        = useState('');
  const [showScrollHint,     setShowScrollHint]     = useState(false);
  const [watchStreak,        setWatchStreak]        = useState(0);
  const [slideFlash,         setSlideFlash]         = useState(false);
  const [intentToast,        setIntentToast]        = useState(null);
  const [netType,            setNetType]            = useState(networkMgr.effectiveType);

  const containerRef      = useRef(null);
  const activeIndexRef    = useRef(0);
  const slideListeners    = useRef({});
  const feedItemsRef      = useRef([]);
  const seenSet           = useRef(loadPersistedSet(CONFIG.seen.storageKey));
  // invalidSet en sessionStorage (reset à fermeture onglet)
  const invalidSet        = useRef(loadPersistedSet(CONFIG.seen.invalidKey, 500, sessionStorage));
  const aggPool           = useRef([]);
  const entertainmentPool = useRef([]);
  const fetchTriggered    = useRef(false);
  const anyModalRef       = useRef(false);
  const aggPageRef        = useRef(1);
  const aggHasMoreRef     = useRef(true);
  const aggLoadingRef     = useRef(false);
  const entPageRef        = useRef(1);
  const entHasMoreRef     = useRef(true);
  const entLoadingRef     = useRef(false);
  const userHasMoreRef    = useRef(userHasMore);
  const userLoadingRef    = useRef(userLoading);
  const loadMoreMutex     = useRef(false);
  const watchStreakRef     = useRef(0);
  const activeItemRef     = useRef(null);
  const lastIntentRef     = useRef(null);
  const activeAbortRef    = useRef(null); // fetch abort controller courant
  const lastVisibleTime   = useRef(0);    // debounce handleVisible

  useEffect(() => { userHasMoreRef.current = userHasMore; }, [userHasMore]);
  useEffect(() => { userLoadingRef.current = userLoading; }, [userLoading]);
  useEffect(() => { anyModalRef.current = anyModalOpen; }, [anyModalOpen]);

  useEffect(() => {
    if (!('connection' in navigator)) return;
    const update = () => setNetType(networkMgr.effectiveType);
    navigator.connection.addEventListener('change', update);
    return () => navigator.connection.removeEventListener('change', update);
  }, []);

  const activeCtx = useMemo(() => ({
    getActiveIndex: () => activeIndexRef.current,
    subscribe: (idx, cb) => {
      slideListeners.current[idx] = cb;
      return () => { delete slideListeners.current[idx]; };
    },
  }), []);

  // ── Live reorder ──────────────────────────────────────────────────────────
  const liveReorderAhead = useCallback(() => {
    const idx   = activeIndexRef.current;
    const items = feedItemsRef.current;
    const start = idx + 1, end = Math.min(start + CONFIG.behavior.liveReorderDepth, items.length);
    if (end <= start) return;
    const slice    = items.slice(start, end);
    const btpItems = slice.filter(i => !i.isEntertainment).map(i => i.data).filter(Boolean);
    if (btpItems.length < 2) return;
    const reordered = intelligentReorder(btpItems, { jitter: 0.2 });
    const uidMap    = new Map(slice.filter(i => !i.isEntertainment).map(i => [i.data, i]));
    const newBTP    = reordered.map(d => uidMap.get(d)).filter(Boolean);
    // Réinsérer les slides divertissement à leur place originale
    const newSlice = [];
    let bi = 0;
    for (const item of slice) {
      if (item.isEntertainment) newSlice.push(item);
      else { if (bi < newBTP.length) newSlice.push(newBTP[bi++]); else newSlice.push(item); }
    }
    const newFeed = [...items.slice(0, start), ...newSlice, ...items.slice(end)];
    feedItemsRef.current = newFeed;
    startTransition(() => setFeedItems([...newFeed]));
  }, []);

  useEffect(() => {
    const unsub = behaviorEngine.onSignal((signal) => {
      if (signal === 'skip' || signal === 'replay' || signal === 'longWatch') liveReorderAhead();
      const newIntent = userProfile.dominantIntent;
      if (newIntent && newIntent !== lastIntentRef.current) {
        lastIntentRef.current = newIntent;
        setIntentToast(newIntent);
        setTimeout(() => setIntentToast(null), 3500);
      }
    });
    return unsub;
  }, [liveReorderAhead]);

  const sendWatchScore = useCallback(async (itemData, score) => {
    if (!itemData?._id || score < CONFIG.watchScoreMin) return;
    userProfile.recordView(itemData, score);
    if (!itemData._isAggregated) return;
    const watchPct = Math.round(score * 100);
    try {
      const token = await getToken();
      fetch(`${API_BASE}/api/aggregated/${itemData._id}/view`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ watchPct }),
      }).catch(() => {});
    } catch {}
  }, [getToken]);

  // ── notifyActive : transition de slide ───────────────────────────────────
  const notifyActive = useCallback((newIdx) => {
    const old = activeIndexRef.current;
    if (old === newIdx) return;
    const now = Date.now();
    if (now - lastVisibleTime.current < CONFIG.momentumLock) return;
    lastVisibleTime.current = now;

    const previousItem = activeItemRef.current;
    if (previousItem) {
      const uid = `agg-${previousItem._id || previousItem.externalId}`;
      sendWatchScore(previousItem, watchScore.getScore(uid));
    }

    const items   = feedItemsRef.current;
    const newItem = items[newIdx];
    activeItemRef.current = (newItem?.type === 'content' && newItem.isAggregated) ? newItem.data : null;
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
    cancelPreloadsAfter(networkMgr.preloadAhead);

    // Précharger les slides suivantes (priorité aux non-embarquées)
    for (let i = 1; i <= networkMgr.preloadAhead; i++) injectPreload(items[newIdx + i]);

    // Préchauffer YT 2 slides plus tôt
    const nextYtIds = extractYoutubeIds(items, newIdx + 1, CONFIG.ytWarmupAhead);
    if (nextYtIds.length > 0) YouTubePool.warmup(nextYtIds);

    // Transition en microtask pour éviter le jank
    queueMicrotask(() => {
      startTransition(() => {
        slideListeners.current[old]?.(false);
        slideListeners.current[newIdx]?.(true);
        setActiveDisplayIndex(newIdx);
      });
    });
  }, [sendWatchScore]);

  // ── Invalider un item ────────────────────────────────────────────────────
  const invalidateItem = useCallback((uid) => {
    if (invalidSet.current.has(uid)) return;
    invalidSet.current.add(uid);
    persistSet(CONFIG.seen.invalidKey, invalidSet.current, 500, sessionStorage);
    feedItemsRef.current = feedItemsRef.current.filter(i => i.id !== uid);
    startTransition(() => setFeedItems(prev => prev.filter(i => i.id !== uid)));
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // INTERLEAVE BTP + DIVERTISSEMENT (80/20)
  // Règle : toutes les 5 slides BTP → 1 slide divertissement
  // ─────────────────────────────────────────────────────────────────────────
  const buildInterleavedSlides = useCallback((btpItems, entItems) => {
    const result = [];
    let   ei     = 0;
    for (let i = 0; i < btpItems.length; i++) {
      result.push(btpItems[i]);
      // Insérer 1 divertissement toutes les 4 slides BTP
      if ((i + 1) % 4 === 0 && ei < entItems.length) {
        result.push({ ...entItems[ei++], isEntertainment: true });
      }
    }
    // Ajouter les divertissements restants à la fin (au cas où peu de BTP)
    while (ei < entItems.length) {
      result.push({ ...entItems[ei++], isEntertainment: true });
    }
    return result;
  }, []);

  // ── appendItems ───────────────────────────────────────────────────────────
  const appendItems = useCallback((rawItems, { coldStart = false, isEntertainment = false } = {}) => {
    if (!rawItems || rawItems.length === 0) return;

    const toProcess = isEntertainment ? rawItems : applyViralBoost(rawItems);
    const reordered = isEntertainment ? toProcess : intelligentReorder(toProcess, { jitter: coldStart ? 0.1 : 0.3, forColdStart: coldStart });

    // Vérifier si tout a déjà été vu
    const allSeen = reordered.every(item => {
      const uid = item._uid || `${item._isAggregated ? 'agg' : 'user'}-${item._id || item.externalId}`;
      return seenSet.current.has(uid) || invalidSet.current.has(uid);
    });
    if (allSeen && reordered.length > 0) {
      seenSet.current.clear();
      try { localStorage.removeItem(CONFIG.seen.storageKey); } catch {}
    }

    const toAdd = [];
    let len = feedItemsRef.current.length;
    for (const item of reordered) {
      const uid = item._uid || `${item._isAggregated ? 'agg' : (isEntertainment ? 'ent' : 'user')}-${item._id || item.externalId}`;
      if (seenSet.current.has(uid) || invalidSet.current.has(uid)) continue;
      seenSet.current.add(uid);
      if (!item.isEmbed) probeItemBackground(item, () => invalidateItem(uid));
      toAdd.push({
        type: 'content',
        id:   uid,
        data: { ...item, _uid: uid },
        isAggregated: !!item._isAggregated,
        isEntertainment: !!isEntertainment,
      });
      len++;
      // Pubs moins fréquentes (1 toutes les 10 slides)
      if (CONFIG.ads.enabled && len % CONFIG.ads.frequency === 0) {
        toAdd.push({ type: 'ad', id: `ad-${++_adCounter}` });
      }
    }

    if (toAdd.length === 0) {
      if (feedItemsRef.current.length === 0) startTransition(() => setFeedReady(true));
      return;
    }

    persistSet(CONFIG.seen.storageKey, seenSet.current);
    const wasEmpty = feedItemsRef.current.length === 0;
    feedItemsRef.current = [...feedItemsRef.current, ...toAdd];
    startTransition(() => {
      setFeedItems(prev => [...prev, ...toAdd]);
      if (wasEmpty) { setFeedReady(true); setTimeout(() => setShowScrollHint(true), 3200); }
    });

    // Préchargement des premières slides
    const preloadSlice = toAdd.slice(0, networkMgr.preloadAhead);
    if ('requestIdleCallback' in window) requestIdleCallback(() => preloadSlice.forEach(injectPreload), { timeout: 2000 });
    else setTimeout(() => preloadSlice.forEach(injectPreload), 400);

    if (wasEmpty) {
      const firstYtIds = extractYoutubeIds(toAdd, 0, CONFIG.ytWarmupAhead);
      if (firstYtIds.length > 0) YouTubePool.warmup(firstYtIds);
    }
  }, [invalidateItem, buildInterleavedSlides]);

  const recycle = useCallback(() => {
    if (aggPool.current.length < CONFIG.recycleMin) return;
    const recycled = smartRecycle(aggPool.current);
    const toAdd    = []; let len = feedItemsRef.current.length;
    for (const item of recycled) {
      toAdd.push({ type:'content', id:item._uid, data:item, isAggregated:true, isEntertainment:false });
      len++;
      if (CONFIG.ads.enabled && len % CONFIG.ads.frequency === 0) toAdd.push({ type:'ad', id:`ad-${++_adCounter}` });
    }
    feedItemsRef.current = [...feedItemsRef.current, ...toAdd];
    startTransition(() => setFeedItems(prev => [...prev, ...toAdd]));
  }, []);

  // ── fetchAggregated (BTP) ─────────────────────────────────────────────────
  const fetchAggregated = useCallback(async (page = 1, limit = 40) => {
    if (!CONFIG.aggregated.enabled || aggLoadingRef.current) return;
    try {
      aggLoadingRef.current = true;

      if (activeAbortRef.current) activeAbortRef.current.abort();
      const ctrl = new AbortController();
      activeAbortRef.current = ctrl;

      const token          = await getToken();
      const activeLang     = normalizeFeedLanguage(language);
      const headers = {
        'Accept-Language': activeLang,
        'X-User-Language': activeLang,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };
      const btpHint    = '&btpBoost=1&domain=btp&civilOnly=1';
      const coldStart  = userProfile.isNewUser ? '&coldStart=1' : '';
      const intentHint = userProfile.dominantIntent ? `&intent=${userProfile.dominantIntent}` : '';
      const netHint    = networkMgr.effectiveType !== 'default' ? `&quality=${networkMgr.effectiveType}` : '';
      const langHint   = `&language=${encodeURIComponent(activeLang)}&lang=${encodeURIComponent(activeLang)}`;

      const res = await fetch(
        `${API_BASE}/api/aggregated?page=${page}&limit=${limit}&type=short_videos&sources=all${btpHint}${coldStart}${intentHint}${netHint}${langHint}`,
        { headers, signal: ctrl.signal }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      const finalItems = (json.data || [])
        .filter(isPlayableCandidate)
        .filter(detectBTPLocal)
        .map(c => sanitizeItem({ ...c, _isAggregated: true }, activeLang));

      aggPool.current       = [...aggPool.current, ...finalItems];
      aggPageRef.current    = page;
      aggHasMoreRef.current = json.pagination?.hasMore || false;

      appendItems(finalItems, { coldStart: page === 1 && userProfile.isNewUser });

      // Charger plus si feed trop court
      if (feedItemsRef.current.length < CONFIG.minFeedSize && aggHasMoreRef.current) {
        setTimeout(() => fetchAggregated(page + 1, limit), 200);
      }
    } catch (err) {
      if (err.name === 'AbortError') return; // fetch annulé
      aggHasMoreRef.current = false;
      if (aggPool.current.length >= CONFIG.recycleMin) recycle();
    } finally {
      aggLoadingRef.current = false;
    }
  }, [getToken, appendItems, recycle, language]);

  // ── fetchEntertainment (20% divertissement) ───────────────────────────────
  const fetchEntertainment = useCallback(async (page = 1, limit = 12) => {
    if (!CONFIG.entertainment.enabled || entLoadingRef.current) return;
    try {
      entLoadingRef.current = true;
      const token      = await getToken();
      const activeLang = normalizeFeedLanguage(language);
      const headers    = {
        'Accept-Language': activeLang,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };
      // Catégories divertissement en round-robin
      const catIdx     = (page - 1) % ENTERTAINMENT_CATEGORIES.length;
      const categories = ENTERTAINMENT_CATEGORIES.slice(catIdx, catIdx + 3).join(',');

      const res = await fetch(
        `${API_BASE}/api/aggregated?page=${page}&limit=${limit}&type=short_videos&sources=${ENTERTAINMENT_SOURCES.join(',')}&categories=${encodeURIComponent(categories)}&language=${encodeURIComponent(activeLang)}`,
        { headers }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      const items = (json.data || [])
        .filter(isPlayableCandidate)
        .filter(item => !detectBTPLocal(item)) // Exclure le BTP du pool divertissement
        .map(c => sanitizeItem({ ...c, _isAggregated: true, _isEntertainment: true }, activeLang));

      entertainmentPool.current = [...entertainmentPool.current, ...items];
      entPageRef.current    = page;
      entHasMoreRef.current = json.pagination?.hasMore || false;

      if (items.length > 0) appendItems(items, { isEntertainment: true });
    } catch (err) {
      entHasMoreRef.current = false;
    } finally {
      entLoadingRef.current = false;
    }
  }, [getToken, appendItems, language]);

  // ── Vidéos utilisateur ────────────────────────────────────────────────────
  useEffect(() => {
    const newOnes = (userVideos || []).filter(v => {
      const uid = `user-${v._id}`;
      return !seenSet.current.has(uid) && !invalidSet.current.has(uid);
    });
    if (newOnes.length > 0) appendItems(newOnes.map(v => ({ ...v, _isUserVideo: true })));
  }, [userVideos, appendItems]);

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!fetchTriggered.current) {
      fetchTriggered.current = true;
      YouTubePool.init();
      fetchUserVideos(true);
      fetchAggregated(1, CONFIG.aggregated.initialLoad);
      // Décaler légèrement le fetch entertainment pour ne pas bloquer le BTP
      setTimeout(() => fetchEntertainment(1, CONFIG.entertainment.initialLoad), 800);
    }
  }, []); // eslint-disable-line

  // ── Purge mémoire ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!('memory' in performance)) return;
    const check = setInterval(() => {
      const mem = performance.memory;
      if (mem && mem.usedJSHeapSize > mem.jsHeapSizeLimit * 0.75) {
        aggPool.current           = aggPool.current.slice(-CONFIG.recycleMin);
        entertainmentPool.current = entertainmentPool.current.slice(-6);
        _preloadedUrls.clear(); cancelPreloadsAfter(0);
      }
    }, 15000);
    return () => clearInterval(check);
  }, []);

  // ── handleVisible ─────────────────────────────────────────────────────────
  const handleVisible = useCallback((index) => {
    if (anyModalRef.current || isFeedLocked()) return;
    notifyActive(index);

    const remaining = feedItemsRef.current.length - index;
    if (remaining <= adaptiveBuf.value && !loadMoreMutex.current) {
      loadMoreMutex.current = true;
      (async () => {
        try {
          if (userHasMoreRef.current && !userLoadingRef.current) fetchUserVideos();
          if (aggHasMoreRef.current && !aggLoadingRef.current)
            await fetchAggregated(aggPageRef.current + 1, CONFIG.aggregated.loadMore);
          if (entHasMoreRef.current && !entLoadingRef.current)
            await fetchEntertainment(entPageRef.current + 1, CONFIG.entertainment.loadMore);
          if (!userHasMoreRef.current && !aggHasMoreRef.current) recycle();
        } finally {
          loadMoreMutex.current = false;
        }
      })();
    }
  }, [notifyActive, fetchUserVideos, fetchAggregated, fetchEntertainment, recycle]);

  const handleVideoError = useCallback((itemId) => {
    invalidateItem(itemId);
    const remaining = feedItemsRef.current.length - activeIndexRef.current;
    if (remaining <= adaptiveBuf.value && !aggLoadingRef.current) {
      if (aggHasMoreRef.current) fetchAggregated(aggPageRef.current + 1, CONFIG.aggregated.loadMore);
      else recycle();
    }
  }, [invalidateItem, fetchAggregated, recycle]);

  const handleModalChange = useCallback((isOpen) => {
    anyModalRef.current = isOpen; setAnyModalOpen(isOpen);
  }, []);

  // ── Reset complet ─────────────────────────────────────────────────────────
  const handleVideoPublished = useCallback(() => {
    if (activeAbortRef.current) activeAbortRef.current.abort();

    feedItemsRef.current       = [];
    seenSet.current.clear();
    invalidSet.current.clear();
    try { localStorage.removeItem(CONFIG.seen.storageKey); } catch {}
    try { sessionStorage.removeItem(CONFIG.seen.invalidKey); } catch {}

    aggPool.current           = [];
    entertainmentPool.current = [];
    aggPageRef.current        = 1;
    aggHasMoreRef.current     = true;
    entPageRef.current        = 1;
    entHasMoreRef.current     = true;
    watchStreakRef.current     = 0;
    _recycleRound             = 0;
    _adCounter                = 0;
    activeItemRef.current     = null;

    adaptiveBuf.reset(); watchScore.clear(); diversityGuard.reset();
    cancelPreloadsAfter(0);

    setFeedItems([]); setFeedReady(false); setActiveDisplayIndex(0);
    setShowScrollHint(false); setWatchStreak(0);
    containerRef.current?.scrollTo({ top: 0, behavior: 'auto' });
    activeIndexRef.current = 0;

    fetchUserVideos(true);
    fetchAggregated(1, CONFIG.aggregated.initialLoad);
    setTimeout(() => fetchEntertainment(1, CONFIG.entertainment.initialLoad), 800);
  }, [fetchUserVideos, fetchAggregated, fetchEntertainment]);

  // Reset sur changement de langue
  useEffect(() => {
    if (!fetchTriggered.current) return;
    handleVideoPublished();
  }, [language]); // eslint-disable-line

  // ── Cleanup démontage ─────────────────────────────────────────────────────
  useEffect(() => () => {
    if (activeAbortRef.current) activeAbortRef.current.abort();
    document.getElementById('vp-styles')?.remove();
    _cssInjected = false;
    watchScore.clear(); adaptiveBuf.reset(); diversityGuard.reset();
    cancelPreloadsAfter(0); YouTubePool.destroy();
  }, []);

  // ── Recherche ─────────────────────────────────────────────────────────────
  const displayItems = useMemo(() => {
    if (!searchQuery.trim()) return feedItems;
    const q           = searchQuery.toLowerCase();
    const searchTerms = q.split(/\s+/).filter(t => t.length >= 1);
    const hashtags    = q.match(/#[\p{L}\p{N}_-]+/gu)?.map(h => h.replace('#', '').toLowerCase()) || [];

    return feedItems.filter(item => {
      if (item.type === 'ad') return false;
      const d = item.data;
      const searchText = [
        d.title||'', d.description||'', d.channelName||'', d.username||'', d.category||'',
        ...(Array.isArray(d.hashtags) ? d.hashtags : []),
        ...(Array.isArray(d.tags)     ? d.tags     : []),
      ].join(' ').toLowerCase();
      const hasAllTerms   = searchTerms.every(term => searchText.includes(term));
      const hasAllHashtags= hashtags.every(h => searchText.includes(h));
      const hasDirectMatch= ['title','description','channelName','username','category'].some(k => (d[k]||'').toLowerCase().includes(q));
      return hasDirectMatch || (hasAllTerms && hasAllHashtags);
    });
  }, [feedItems, searchQuery]);

  const handleBack     = useCallback(() => navigate('/'), [navigate]);
  const handleAddVideo = useCallback(() => setShowModal(true), []);

  return (
    <ActiveIndexContext.Provider value={activeCtx}>
      <ModalOpenContext.Provider value={anyModalOpen}>
        <div className={`fixed inset-0 bg-black overflow-hidden${feedReady ? ' vp-feed-ready' : ''}`} style={{ contain: 'strict' }}>
          <SkeletonLayer/>
          <SlideFlash trigger={slideFlash}/>
          <OfflineBanner show={!isOnline}/>
          <WatchStreakBadge count={watchStreak}/>

          <AnimatePresence>
            {intentToast && (
              <motion.div key={intentToast} initial={{ opacity:0,y:8 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0,y:-6 }}
                style={{ position:'absolute',top:80,left:'50%',transform:'translateX(-50%)',zIndex:45,pointerEvents:'none' }}>
                <IntentToast intent={intentToast}/>
              </motion.div>
            )}
          </AnimatePresence>

          <NetworkBadge type={netType}/>

          <ActionBar
            onBack={handleBack}
            showSearch={showSearch} setShowSearch={setShowSearch}
            searchQuery={searchQuery} setSearchQuery={setSearchQuery}
            onAddVideo={handleAddVideo}
            currentIndex={activeDisplayIndex} totalItems={feedItems.length}
          />

          <SwipeHint visible={showScrollHint && activeDisplayIndex === 0 && feedReady}/>

          <div
            ref={containerRef}
            className="vp-scroll absolute inset-0 z-10 overflow-y-scroll snap-y snap-mandatory"
            style={{ willChange: 'transform', WebkitOverflowScrolling: 'touch', contain: 'layout' }}
          >
            {displayItems.map((item, index) => {
              const dist = Math.abs(index - activeDisplayIndex);
              return dist > CONFIG.virtual
                ? <SlidePlaceholder key={item.id}/>
                : <SlideItem
                    key={item.id} item={item} index={index}
                    onVisible={handleVisible}
                    onModalChange={handleModalChange}
                    onVideoError={handleVideoError}
                  />;
            })}
          </div>

          {showModal && (
            <VideoModal showModal={showModal} setShowModal={setShowModal} onVideoPublished={handleVideoPublished}/>
          )}
        </div>
      </ModalOpenContext.Provider>
    </ActiveIndexContext.Provider>
  );
};

export default memo(VideosPage);