// 📁 src/pages/Home/Home.jsx — v16 OPTIMISÉ
//
// ══════════════════════════════════════════════════════════════════════════════
// OPTIMISATIONS vs v15 :
//
// ⚡ OPT 1 — SCORE CACHE par _id (module-level Map + version token)
//    → scoreOnePost n'est plus recalculé si le post n'a pas changé
//    → SCORE_CACHE_VERSION.v invalide tout le cache quand les weights changent
//
// ⚡ OPT 2 — AbortController sur resolveBatch
//    → Les résolutions sont annulées au unmount / rawPool change
//    → yield requestIdleCallback entre chaque batch de 5
//
// ⚡ OPT 3 — Feed: version counter au lieu de [...accRef.current]
//    → Plus de copie d'array à chaque loadMore
//    → accRef.current est lu directement dans le render
//
// ⚡ OPT 4 — saveSeenIds déboncé 2s (était synchrone à chaque batch)
//
// ⚡ OPT 5 — isValidPost hissé au niveau module (plus de useCallback chaud)
//
// ⚡ OPT 6 — recalibrateWeights dans un useEffect dédié (plus de setTimeout
//    dans useMemo → mutation silencieuse supprimée)
//    Déclenche SCORE_CACHE_VERSION.v++ pour invalider le cache
//
// ⚡ OPT 7 — postToVec dédupliqué dans applyMMRReranking
//    (withVecs pré-calculé, plus d'appel redondant dans la boucle)
//
// ⚡ OPT 8 — AbortController sur tous les fetches axios (unmount safe)
//
// ⚡ OPT 9 — smartBuildFeed n'appelle plus setTimeout interne
//
// ⚡ OPT 10 — normalizeWeights mémoïsé (appelé une seule fois au load)
//
// ══════════════════════════════════════════════════════════════════════════════

import React, {
  useState, useMemo, useEffect, useRef, useCallback,
  memo, lazy, Suspense, startTransition, useTransition,
} from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpIcon, ArrowPathIcon } from "@heroicons/react/24/outline";
import { useDarkMode }      from "../../context/DarkModeContext";
import { useStories }       from "../../context/StoryContext";
import { usePosts }         from "../../context/PostsContext";
import { useAuth }          from "../../context/AuthContext";
import { useNews }          from "../../hooks/useNews";
import axiosClient          from "../../api/axiosClientGlobal";

import StoryContainer       from "./StoryContainer.jsx";
import SuggestedAccounts    from "./SuggestedAccounts";
import SuggestedPostPreview from "./SuggestedPostPreview";
import PostCard             from "./PostCard";
import MOCK_POSTS, { generateFullDataset } from "../../data/mockPosts";
import {
  MOCK_CONFIG as DEFAULT_MOCK_CONFIG,
  AD_CONFIG   as DEFAULT_AD_CONFIG,
} from "../../data/mockConfig";
import { readAllCachedProfilePosts } from "../Profile/ProfilePage";

const StoryCreator             = lazy(() => import("./StoryCreator"));
const StoryViewer              = lazy(() => import("./StoryViewer"));
const ImmersivePyramidUniverse = lazy(() => import("./ImmersivePyramidUniverse"));
const ArticleReaderModal       = lazy(() => import("./ArticleReaderModal"));

const HOME_REFRESH_EVENT    = "home:refresh";
const HOME_SCROLL_TOP_EVENT = "home:scrollTop";
const AD_CONFIG             = DEFAULT_AD_CONFIG;
const MOCK_CONFIG           = DEFAULT_MOCK_CONFIG;

const PAGE_SIZE     = 15;
const MAX_DOM_POSTS = typeof window !== "undefined" && window.innerWidth < 768 ? 40 : 80;
const MAX_POOL      = 500;

const FRESH_POOL_THRESHOLD   = 10;
const MIN_UNSEEN_BEFORE_LOOP = 3;

const SUGGEST_ACCOUNTS_EVERY = 5;
const SUGGEST_PROFILE_EVERY  = 7;
const NEWS_EVERY             = 4;

const POLL_INTERVAL  = 30_000;
const SEED_ROTATE_MS = 4 * 60 * 1000;
const API_PREFETCH   = 3;
const MIX_BLOCK      = 5;
const MIX_MAX_BOTS   = 2;

const FALLBACK_THRESHOLD   = 5;
const MAX_FALLBACK_USERS   = 8;
const FALLBACK_POSTS_LIMIT = 10;
const FALLBACK_COOLDOWN_MS = 60_000;

const RECENT_6H  = 6  * 60 * 60 * 1000;
const RECENT_24H = 24 * 60 * 60 * 1000;
const RECENT_72H = 72 * 60 * 60 * 1000;

const PREFETCH_AHEAD      = 4;
const PREFETCH_IDLE_WAIT  = 150;
const RESOLVE_CONCURRENCY = 6;

const PREFETCH_THRESHOLD = 0.70;
const URGENT_THRESHOLD   = 0.90;
const SILENT_COOLDOWN_MS = 8_000;
const SCROLL_IDLE_MS     = 2000;

const EXPLORATION_RATE = 0.10;

// ══════════════════════════════════════════════════════════════════════════════
// ⚡ OPT 1 — SCORE CACHE (module-level, survive les re-renders)
// ══════════════════════════════════════════════════════════════════════════════
const SCORE_CACHE         = new Map();
const SCORE_CACHE_VERSION = { v: 0 };
const SCORE_CACHE_MAX     = 3000;

const invalidateScoreCache = () => {
  SCORE_CACHE_VERSION.v++;
};

const getCachedScore = (post, ctx, seenIds, followingIds, now) => {
  const id  = post._id;
  if (!id) return scoreOnePostRaw(post, ctx, seenIds, followingIds, now);
  const key = `${id}_${SCORE_CACHE_VERSION.v}`;
  if (SCORE_CACHE.has(key)) return SCORE_CACHE.get(key);
  const result = scoreOnePostRaw(post, ctx, seenIds, followingIds, now);
  // LRU simple : purge les 500 plus anciens si trop grand
  if (SCORE_CACHE.size >= SCORE_CACHE_MAX) {
    let purged = 0;
    for (const k of SCORE_CACHE.keys()) {
      SCORE_CACHE.delete(k);
      if (++purged >= 500) break;
    }
  }
  SCORE_CACHE.set(key, result);
  return result;
};

// ══════════════════════════════════════════════════════════════════════════════
// Persistence helpers (sessionStorage) — inchangés v15
// ══════════════════════════════════════════════════════════════════════════════
const LIVE_POOL_KEY = "feed_live_pool_v16";
const SEEN_IDS_KEY  = "feed_seen_ids_v16";

const saveLivePool = (pool) => {
  try {
    const slim = pool.slice(0, 200).map(({ _displayKey, ...rest }) => rest);
    sessionStorage.setItem(LIVE_POOL_KEY, JSON.stringify(slim));
  } catch {}
};

const loadLivePool = () => {
  try {
    const raw = sessionStorage.getItem(LIVE_POOL_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
};

const saveSeenIds = (ids) => {
  try {
    sessionStorage.setItem(SEEN_IDS_KEY, JSON.stringify([...ids].slice(0, 500)));
  } catch {}
};

const loadSeenIds = () => {
  try {
    const raw = sessionStorage.getItem(SEEN_IDS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
};

// ══════════════════════════════════════════════════════════════════════════════
// SCORE WEIGHTS — normalisés une seule fois au load (OPT 10)
// ══════════════════════════════════════════════════════════════════════════════
const RAW_DEFAULT_WEIGHTS = {
  behavioral:  0.25,
  multiObj:    0.20,
  velocity:    0.15,
  social:      0.10,
  base:        0.08,
  contextTime: 0.10,
  longTermMem: 0.07,
  quality:     0.05,
  trendAmp:    0.05,
};

const normalizeWeights = (w) => {
  const total = Object.values(w).reduce((a, b) => a + b, 0);
  if (total === 0) return { ...w };
  const out = {};
  for (const k in w) out[k] = w[k] / total;
  return out;
};

const DEFAULT_SCORE_WEIGHTS = normalizeWeights(RAW_DEFAULT_WEIGHTS);

const WEIGHTS_KEY = "feed_score_weights_v16";

const loadWeights = () => {
  try {
    const raw = localStorage.getItem(WEIGHTS_KEY);
    if (!raw) return { ...DEFAULT_SCORE_WEIGHTS };
    const w     = JSON.parse(raw);
    const total = Object.values(w).reduce((a, b) => a + b, 0);
    if (total > 0.5 && total < 2.0) return normalizeWeights({ ...DEFAULT_SCORE_WEIGHTS, ...w });
  } catch {}
  return { ...DEFAULT_SCORE_WEIGHTS };
};

const saveWeights = (weights) => {
  try { localStorage.setItem(WEIGHTS_KEY, JSON.stringify(weights)); } catch {}
};

// ══════════════════════════════════════════════════════════════════════════════
// VEC_CACHE
// ══════════════════════════════════════════════════════════════════════════════
const VEC_CACHE     = new Map();
const VEC_CACHE_MAX = 2000;

const getCachedVec = (post) => {
  const id = post._id || post._displayKey;
  if (!id) return postToVecRaw(post);
  if (VEC_CACHE.has(id)) return VEC_CACHE.get(id);
  const vec = postToVecRaw(post);
  if (VEC_CACHE.size >= VEC_CACHE_MAX) {
    const firstKey = VEC_CACHE.keys().next().value;
    VEC_CACHE.delete(firstKey);
  }
  VEC_CACHE.set(id, vec);
  return vec;
};

// ══════════════════════════════════════════════════════════════════════════════
// SCORE A : scorePost
// ══════════════════════════════════════════════════════════════════════════════
const scorePost = (post, now = Date.now()) => {
  let score = 0;

  const age  = now - new Date(post.createdAt || post.date || post.publishedAt || 0).getTime();
  const ageH = age / 3_600_000;
  if      (ageH <  1) score += 35;
  else if (ageH <  6) score += 30 - (ageH / 6) * 5;
  else if (ageH < 24) score += 25 - (ageH / 24) * 10;
  else if (ageH < 72) score += 15 - (ageH / 72) * 10;
  else                score += Math.max(0, 5 - ageH / 720);

  const likes    = post.likesCount    || post.likes?.length    || post.reactions?.total || 0;
  const comments = post.commentsCount || post.comments?.length || 0;
  const shares   = post.sharesCount   || post.shares           || 0;
  const saves    = post.savesCount    || post.bookmarks        || 0;
  const engRaw   = likes + comments * 3 + shares * 5 + saves * 2;
  score += Math.min(30, Math.log1p(engRaw) * 5);

  const followers     = post.user?.followersCount || post.author?.followersCount || 1;
  const engagementRate = engRaw / Math.max(followers, 1);
  score += Math.min(15, engagementRate * 1000);

  const hasVideo = !!(post.videoUrl || post.embedUrl || (Array.isArray(post.media) && post.media.some(m => /\.(mp4|webm)/i.test(m?.url || m || ""))));
  const hasImage = !!(Array.isArray(post.images) ? post.images.length : post.images) || !!(Array.isArray(post.media) ? post.media.length : false);
  const hasText  = (post.content || post.contenu || "").length > 50;
  const hasMulti = (Array.isArray(post.images) ? post.images.length : 0) > 1 || (Array.isArray(post.media) ? post.media.length : 0) > 1;
  if (hasVideo) score += 10;
  else if (hasMulti) score += 7;
  else if (hasImage) score += 5;
  else if (hasText)  score += 3;

  if (post.user?.isVerified || post.author?.isVerified) score += 5;
  else if (followers > 10000) score += 3;
  else if (followers > 1000)  score += 1;

  if (post.isBot || post.user?.isBot) score -= 5;
  if (post._isMock || post.isMockPost) score -= 3;
  if (post._fromFallback) score -= 1;

  return Math.max(0, Math.min(100, score));
};

// ══════════════════════════════════════════════════════════════════════════════
// SCORE B : BehaviorTracker
// ══════════════════════════════════════════════════════════════════════════════
const BEHAVIOR_KEY = "feed_behavior_v1";
const BEHAVIOR_TTL = 7 * 24 * 60 * 60 * 1000;

const loadBehavior = () => {
  try {
    const raw = sessionStorage.getItem(BEHAVIOR_KEY) || localStorage.getItem(BEHAVIOR_KEY);
    if (!raw) return { authorBoosts:{}, categoryBoosts:{}, typeBoosts:{}, postSignals:{}, ts:Date.now() };
    const data = JSON.parse(raw);
    if (Date.now() - data.ts > BEHAVIOR_TTL) return { authorBoosts:{}, categoryBoosts:{}, typeBoosts:{}, postSignals:{}, ts:Date.now() };
    return data;
  } catch { return { authorBoosts:{}, categoryBoosts:{}, typeBoosts:{}, postSignals:{}, ts:Date.now() }; }
};

const saveBehavior = (behavior) => {
  try { localStorage.setItem(BEHAVIOR_KEY, JSON.stringify({ ...behavior, ts:Date.now() })); } catch {}
};

const POSITION_PROPENSITY = [1.00, 0.85, 0.72, 0.61, 0.52, 0.44, 0.38, 0.33, 0.28, 0.25];
const ipsCorrectedLabel   = (interacted, position) => {
  const p = POSITION_PROPENSITY[Math.min(position, POSITION_PROPENSITY.length - 1)];
  return interacted ? 1 / p : 0;
};

const createBehaviorTracker = () => {
  let behavior  = loadBehavior();
  let dirty     = false;
  let saveTimer = null;
  const flush        = () => { if (dirty) { saveBehavior(behavior); dirty = false; } };
  const scheduleSave = () => { clearTimeout(saveTimer); saveTimer = setTimeout(flush, 2000); dirty = true; };
  const clamp = (v, min = -20, max = 20) => Math.max(min, Math.min(max, v));

  const boostWithIPS = (uid, cat, type, baseBoost, position = 0) => {
    const corrected = baseBoost * ipsCorrectedLabel(true, position);
    if (uid)  behavior.authorBoosts[uid]   = clamp((behavior.authorBoosts[uid]   || 0) + corrected);
    if (cat)  behavior.categoryBoosts[cat] = clamp((behavior.categoryBoosts[cat] || 0) + corrected * 0.6);
    if (type) behavior.typeBoosts[type]    = clamp((behavior.typeBoosts[type]    || 0) + corrected * 0.4);
    scheduleSave();
  };

  return {
    onLike:    (post, pos=0) => boostWithIPS(post.user?._id||post.author?._id, post.category, post.videoUrl?"video":post.images?.length?"image":"text", 8, pos),
    onComment: (post, pos=0) => boostWithIPS(post.user?._id||post.author?._id, post.category, null, 10, pos),
    onShare:   (post, pos=0) => boostWithIPS(post.user?._id||post.author?._id, post.category, null, 12, pos),
    onSave:    (post, pos=0) => boostWithIPS(post.user?._id||post.author?._id, post.category, null,  6, pos),
    onHide:    (post, pos=0) => {
      const uid = post.user?._id||post.author?._id, cat=post.category;
      const type = post.videoUrl?"video":post.images?.length?"image":"text";
      const corrected = -15 * ipsCorrectedLabel(true, pos);
      if (uid)  behavior.authorBoosts[uid]   = clamp((behavior.authorBoosts[uid]   || 0) + corrected);
      if (cat)  behavior.categoryBoosts[cat] = clamp((behavior.categoryBoosts[cat] || 0) + corrected * 0.5);
      if (type) behavior.typeBoosts[type]    = clamp((behavior.typeBoosts[type]    || 0) + corrected * 0.3);
      scheduleSave();
    },
    onDwell: (post, ms) => {
      if (ms < 2000) return;
      const boost = ms > 10000 ? 6 : ms > 5000 ? 3 : 1;
      const uid   = post.user?._id||post.author?._id;
      if (uid) behavior.authorBoosts[uid] = clamp((behavior.authorBoosts[uid] || 0) + boost);
      scheduleSave();
    },
    onSkip: (post) => {
      const uid = post.user?._id||post.author?._id;
      if (uid) behavior.authorBoosts[uid] = clamp((behavior.authorBoosts[uid] || 0) - 2);
      scheduleSave();
    },
    applyBoost: (post, baseScore) => {
      let boost = 0;
      const uid  = post.user?._id||post.author?._id;
      const cat  = post.category;
      const type = post.videoUrl?"video":(post.images?.length||post.media?.length)?"image":"text";
      if (uid && behavior.authorBoosts[uid])   boost += behavior.authorBoosts[uid];
      if (cat && behavior.categoryBoosts[cat]) boost += behavior.categoryBoosts[cat] * 0.5;
      if (behavior.typeBoosts[type])           boost += behavior.typeBoosts[type] * 0.3;
      return Math.max(0, Math.min(100, baseScore + boost));
    },
    getBehavior: () => behavior,
    flush,
  };
};

// ══════════════════════════════════════════════════════════════════════════════
// SCORE H : UserEmbedding
// ══════════════════════════════════════════════════════════════════════════════
const EMB_DIM   = 32;
const EMB_KEY   = "uemb_v1";
const EMB_LR    = 0.01;
const EMB_DECAY = 0.999;

const createUserEmbedding = () => {
  let vec = new Float32Array(EMB_DIM);
  const load = () => {
    try { const raw=localStorage.getItem(EMB_KEY); if(raw) vec=new Float32Array(JSON.parse(raw)); } catch {}
  };
  const save = () => {
    try { localStorage.setItem(EMB_KEY, JSON.stringify(Array.from(vec))); } catch {}
  };
  load();
  const normalize = (v) => {
    let norm=0; for(let i=0;i<EMB_DIM;i++) norm+=v[i]*v[i];
    norm=Math.sqrt(norm)||1;
    const out=new Float32Array(EMB_DIM);
    for(let i=0;i<EMB_DIM;i++) out[i]=v[i]/norm;
    return out;
  };
  return {
    update(postVec, label) {
      for(let i=0;i<EMB_DIM;i++) vec[i]=vec[i]*EMB_DECAY+EMB_LR*label*postVec[i];
      save();
    },
    similarity(postVec) {
      const u=normalize(vec), p=normalize(postVec);
      let dot=0; for(let i=0;i<EMB_DIM;i++) dot+=u[i]*p[i];
      return Math.max(-1,Math.min(1,dot));
    },
    getVec: () => vec,
  };
};

// ══════════════════════════════════════════════════════════════════════════════
// postToVecRaw — calcul pur (non caché)
// ══════════════════════════════════════════════════════════════════════════════
const postToVecRaw = (post) => {
  const vec = new Float32Array(EMB_DIM);
  const uid = post.user?._id || post.author?._id || "";
  vec[0] = Math.tanh((post.likesCount    || 0) / 500);
  vec[1] = Math.tanh((post.commentsCount || 0) / 50);
  vec[2] = Math.tanh((post.sharesCount   || 0) / 20);
  vec[3] = post.user?.isVerified ? 1 : 0;
  vec[4] = post.videoUrl ? 1 : 0;
  vec[5] = (Array.isArray(post.images) ? post.images.length : post.images ? 1 : 0) > 0 ? 1 : 0;
  vec[6] = (post.content || post.contenu || "").length > 200 ? 1 : 0;
  vec[7] = Array.isArray(post.media) && post.media.length > 1 ? 1 : 0;
  ["tech","sport","news","art","food","travel"].forEach((c,i) => {
    vec[8+i] = (post.category||"").toLowerCase().includes(c) ? 1 : 0;
  });
  for(let j=0;j<Math.min(uid.length,10);j++) vec[14+j]+=(uid.charCodeAt(j)%100)/100;
  const ageH = (Date.now() - new Date(post.createdAt||0).getTime()) / 3_600_000;
  vec[24]=Math.exp(-ageH/6);  vec[25]=Math.exp(-ageH/24); vec[26]=Math.exp(-ageH/72);
  vec[27]=ageH>168?1:0;
  const fl=post.user?.followersCount||1;
  vec[28]=Math.tanh(fl/1000); vec[29]=fl>10000?1:0; vec[30]=fl>100000?1:0;
  return vec;
};

const postToVec = getCachedVec;

// ══════════════════════════════════════════════════════════════════════════════
// SCORE I : MultiObjective
// ══════════════════════════════════════════════════════════════════════════════
const sigmoid = (x) => 1 / (1 + Math.exp(-Math.max(-20, Math.min(20, x))));
const MULTI_OBJ_WEIGHTS = { like:0.25, comment:0.35, share:0.30, watch:0.20, hide:-0.40 };

const multiObjectiveScore = (post, userEmbedding, baseScore) => {
  const sim      = userEmbedding.similarity(postToVec(post));
  const b        = baseScore / 100;
  const pLike    = sigmoid(b*3  + sim*4);
  const pComment = sigmoid(b*2  + sim*3 - 0.5);
  const pShare   = sigmoid(b*1.5 + sim*5 - 1);
  const pWatch   = post.videoUrl ? sigmoid(b*4 + sim*3) : 0.4;
  const pHide    = Math.max(0, sigmoid(-sim*3 - b*2 + 1));
  const score    = pLike*MULTI_OBJ_WEIGHTS.like + pComment*MULTI_OBJ_WEIGHTS.comment +
                   pShare*MULTI_OBJ_WEIGHTS.share + pWatch*MULTI_OBJ_WEIGHTS.watch + pHide*MULTI_OBJ_WEIGHTS.hide;
  return Math.max(0, Math.min(100, score*100));
};

// ══════════════════════════════════════════════════════════════════════════════
// SCORE J : VelocityScore
// ══════════════════════════════════════════════════════════════════════════════
const velocityScore = (post, now=Date.now()) => {
  const ageH = Math.max((now - new Date(post.createdAt||0).getTime()) / 3_600_000, 0.1);
  const eng  = (post.likesCount||0) + (post.commentsCount||0)*3 + (post.sharesCount||0)*5;
  return Math.min(100, Math.log1p(eng / ageH) * 12);
};

// ══════════════════════════════════════════════════════════════════════════════
// SCORE K : SocialGraphBoost
// ══════════════════════════════════════════════════════════════════════════════
const socialGraphBoost = (post, followingIds=new Set()) => {
  if (!followingIds.size) return 0;
  const lb = (post.likedBy    ||[]).filter(id=>followingIds.has(id));
  const cb = (post.commentedBy||[]).filter(id=>followingIds.has(id));
  const sb = (post.sharedBy   ||[]).filter(id=>followingIds.has(id));
  if (!lb.length && !cb.length && !sb.length) return 0;
  return Math.min(20, Math.log1p(lb.length + cb.length*2 + sb.length*3) * 7);
};

// ══════════════════════════════════════════════════════════════════════════════
// SCORE M : FatigueDetector
// ══════════════════════════════════════════════════════════════════════════════
const FATIGUE_WINDOW      = 20;
const FATIGUE_MAX_PENALTY = 25;

const createFatigueDetector = () => {
  const recentTopics  = [];
  const recentAuthors = [];
  return {
    record(post) {
      recentTopics.push(post.category||"unknown");
      recentAuthors.push(post.user?._id||post.author?._id||"unknown");
      if (recentTopics.length  > FATIGUE_WINDOW) recentTopics.shift();
      if (recentAuthors.length > FATIGUE_WINDOW) recentAuthors.shift();
    },
    penalty(post) {
      const topic = post.category||"unknown";
      const uid   = post.user?._id||post.author?._id||"unknown";
      const ft = recentTopics.filter(t=>t===topic).length  / FATIGUE_WINDOW;
      const fa = recentAuthors.filter(a=>a===uid).length   / FATIGUE_WINDOW;
      return -(ft*0.6 + fa*0.4) * FATIGUE_MAX_PENALTY;
    },
  };
};

// ══════════════════════════════════════════════════════════════════════════════
// SCORE O : ContextualTime
// ══════════════════════════════════════════════════════════════════════════════
const getTimeBucket = (now=Date.now()) => {
  const h = new Date(now).getHours();
  if (h<6)  return 0;
  if (h<10) return 1;
  if (h<14) return 2;
  if (h<18) return 3;
  if (h<22) return 4;
  return 5;
};

const TIME_CONTENT_SCORES = {
  0: { video:40, image:50, text:35, news:35, short:60 },
  1: { video:50, image:60, text:75, news:85, short:70 },
  2: { video:60, image:65, text:60, news:65, short:60 },
  3: { video:65, image:75, text:50, news:50, short:80 },
  4: { video:90, image:75, text:45, news:50, short:55 },
  5: { video:75, image:60, text:45, news:40, short:65 },
};

const getPostContentType = (post) => {
  if (post.videoUrl || post.embedUrl) return "video";
  const isNews = post._fromNews || post.category==="news" || post.type==="article";
  if (isNews) return "news";
  const textLen = (post.content || post.contenu || "").length;
  if (textLen < 80 && !post.images?.length && !post.media?.length) return "short";
  if (Array.isArray(post.images) && post.images.length > 0) return "image";
  if (Array.isArray(post.media)  && post.media.length  > 0) return "image";
  return "text";
};

const contextualTimeScore = (post, now=Date.now()) => {
  const bucket = getTimeBucket(now);
  const type   = getPostContentType(post);
  return TIME_CONTENT_SCORES[bucket]?.[type] ?? 50;
};

// ══════════════════════════════════════════════════════════════════════════════
// SCORE P : LongTermMemory
// ══════════════════════════════════════════════════════════════════════════════
const LTM_DB_NAME    = "feedLTM_v1";
const LTM_STORE      = "interests";
const LTM_TTL        = 30 * 24 * 60 * 60 * 1000;
const LTM_DECAY_HALF = 7  * 24 * 60 * 60 * 1000;

const openLTMDB = () => new Promise((resolve, reject) => {
  if (typeof indexedDB === "undefined") { reject(new Error("no IDB")); return; }
  const req = indexedDB.open(LTM_DB_NAME, 1);
  req.onupgradeneeded = (e) => {
    const db = e.target.result;
    if (!db.objectStoreNames.contains(LTM_STORE)) db.createObjectStore(LTM_STORE, { keyPath:"key" });
  };
  req.onsuccess = (e) => resolve(e.target.result);
  req.onerror   = () => reject(req.error);
});

const createLongTermMemory = () => {
  let db=null, interests={}, loaded=false, dirty=false, saveTimer=null;

  const init = async () => {
    try {
      db = await openLTMDB();
      const tx   = db.transaction(LTM_STORE, "readonly");
      const all  = await new Promise((res,rej) => {
        const req=tx.objectStore(LTM_STORE).getAll();
        req.onsuccess=()=>res(req.result); req.onerror=()=>rej(req.error);
      });
      const now=Date.now();
      interests={};
      all.forEach(({key,score,ts})=>{
        if (now-ts < LTM_TTL) {
          const decayed=score*Math.exp(-Math.LN2*(now-ts)/LTM_DECAY_HALF);
          if (decayed>0.01) interests[key]={score:decayed,ts};
        }
      });
      loaded=true;
    } catch {
      try { const raw=localStorage.getItem("feedLTM_fallback"); if(raw) interests=JSON.parse(raw); loaded=true; } catch {}
    }
  };

  const scheduleSave = () => { dirty=true; clearTimeout(saveTimer); saveTimer=setTimeout(flush,3000); };
  const flush = async () => {
    if (!dirty||!loaded) return;
    dirty=false;
    try {
      if (db) {
        const tx=db.transaction(LTM_STORE,"readwrite"), store=tx.objectStore(LTM_STORE);
        Object.entries(interests).forEach(([key,{score,ts}])=>store.put({key,score,ts}));
      } else {
        localStorage.setItem("feedLTM_fallback",JSON.stringify(interests));
      }
    } catch {}
  };

  const update = (post, label) => {
    if (!loaded) return;
    const now=Date.now();
    [post.category, post.user?._id||post.author?._id, getPostContentType(post)].filter(Boolean).forEach(key=>{
      const prev=interests[key]||{score:0,ts:now};
      interests[key]={score:Math.max(-1,Math.min(1,prev.score+label*0.15)),ts:now};
    });
    scheduleSave();
  };

  const getScore = (post) => {
    if (!loaded) return 50;
    const now=Date.now();
    const keys=[post.category, post.user?._id||post.author?._id, getPostContentType(post)].filter(Boolean);
    let total=0;
    keys.forEach(key=>{
      const entry=interests[key];
      if (!entry) return;
      total+=entry.score*Math.exp(-Math.LN2*(now-entry.ts)/LTM_DECAY_HALF);
    });
    return Math.max(0, Math.min(100, (total/Math.max(keys.length,1)+1)*50));
  };

  init();
  return { update, getScore, flush };
};

// ══════════════════════════════════════════════════════════════════════════════
// SCORE R : ContentQuality
// ══════════════════════════════════════════════════════════════════════════════
const CLICKBAIT_PATTERNS = [
  /vous n[e']en croirez pas/i,/incroyable/i,/choc/i,/urgent/i,
  /\!\!\!/,/[A-Z]{5,}/,/😱{2,}/,/🔥{3,}/,
  /you won't believe/i,/shocking/i,/must see/i,
];
const QUALITY_BONUS_PATTERNS = [
  /\b(source|selon|d[''']après|étude|rapport|données)\b/i,
  /\b(analyse|contexte|explique|détaille|résume)\b/i,
];

const contentQualityScore = (post) => {
  const text = post.content || post.contenu || "";
  if (!text) return 50;

  let score = 50;
  const len = text.length;
  if      (len > 100 && len < 1000) score += 15;
  else if (len >= 1000)              score += 8;
  else if (len < 30)                 score -= 10;

  const punctRatio = (text.match(/[.!?,;:]/g)||[]).length / Math.max(len/20, 1);
  if (punctRatio > 0.3 && punctRatio < 3) score += 8;

  const upperRatio = (text.match(/[A-ZÀ-Ü]/g)||[]).length / Math.max(len, 1);
  if (upperRatio > 0.4) score -= 15;

  if (CLICKBAIT_PATTERNS.some(p=>p.test(text)))       score -= 12;
  if (QUALITY_BONUS_PATTERNS.some(p=>p.test(text)))   score += 10;
  if (/(.)\1{4,}/.test(text))                         score -= 8;
  if ((post.videoUrl || (Array.isArray(post.images) && post.images.length>0)) && len>50) score += 5;

  return Math.max(0, Math.min(100, score));
};

// ══════════════════════════════════════════════════════════════════════════════
// SCORE S : TrendAmplifier
// ══════════════════════════════════════════════════════════════════════════════
const TREND_WINDOW_MS = 2 * 60 * 60 * 1000;

const createTrendWindow = () => {
  const events = [];
  return {
    record(post) {
      const now    = Date.now();
      const topics = [post.category, ...(post.hashtags||[]), ...(post.tags||[])].filter(Boolean);
      const weight = 1 + Math.log1p((post.likesCount||0)+(post.sharesCount||0));
      topics.forEach(topic => events.push({topic,ts:now,weight}));
      const cutoff = now - TREND_WINDOW_MS;
      while (events.length>0 && events[0].ts<cutoff) events.shift();
    },
    getTrendScore(post) {
      const now    = Date.now();
      const cutoff = now - TREND_WINDOW_MS;
      const active = events.filter(e=>e.ts>=cutoff);
      if (!active.length) return 50;
      const topics = [post.category,...(post.hashtags||[]),...(post.tags||[])].filter(Boolean);
      let trendScore=0;
      topics.forEach(topic=>{
        const topicEvents=active.filter(e=>e.topic===topic);
        if (!topicEvents.length) return;
        const momentum=topicEvents.reduce((sum,e)=>sum+e.weight*((e.ts-cutoff)/TREND_WINDOW_MS),0);
        trendScore+=Math.log1p(momentum);
      });
      return Math.min(100, 50 + trendScore*10);
    },
  };
};

// ══════════════════════════════════════════════════════════════════════════════
// SCORE T : EmotionDetector
// ══════════════════════════════════════════════════════════════════════════════
const EMOTION_LEXICON = {
  joy:      { words:["heureux","joie","bonheur","super","génial","excellent","parfait","bravo","magnifique","happy","joy","wonderful","amazing","great","love","beautiful"], score:1.2 },
  interest: { words:["intéressant","fascinant","découverte","apprentissage","interesting","fascinating","learn","discover","knowledge"], score:1.1 },
  surprise: { words:["surprenant","inattendu","révélation","wow","surprising","unexpected","reveal"], score:1.05 },
  anger:    { words:["honte","scandale","révoltant","inacceptable","horrible","dégueulasse","shame","scandal","outrage","disgusting","unacceptable","hate"], score:-1.5 },
  fear:     { words:["danger","peur","alerte","menace","effrayant","catastrophe","fear","alert","threat","scary","disaster"], score:-0.8 },
  disgust:  { words:["dégoût","répugnant","ignoble","abject","disgusting","repulsive","revolting"], score:-1.2 },
  ragebait: { words:["complot","woke","dictature","ils veulent","on vous cache","moutons","sheeple","conspiracy","they want","hidden truth"], score:-2.0 },
};

const emotionScore = (post) => {
  const text = (post.content || post.contenu || "");
  if (!text || text.length < 5) return 0;
  const lower = text.toLowerCase();

  let total=0, hits=0;
  for (const { words, score } of Object.values(EMOTION_LEXICON)) {
    for (const word of words) {
      if (lower.includes(word)) { total+=score; hits++; break; }
    }
  }
  if (!hits) return 0;
  return Math.max(-15, Math.min(10, total*3));
};

// ══════════════════════════════════════════════════════════════════════════════
// SCORE U : SessionBudget
// ══════════════════════════════════════════════════════════════════════════════
const SESSION_KEY        = "feed_session_v16";
const SESSION_INACTIVITY = 30 * 60 * 1000;
const SESSION_THRESHOLDS = { soft:{posts:30,minutes:15}, hard:{posts:60,minutes:40} };

const EXIT_CONTENT_SCORE = (post) => {
  const isShort    = (post.content||post.contenu||"").length < 120;
  const isPositive = (post.content||post.contenu||"").match(/\b(merci|partage|ensemble|communauté|aide|soutien|thank|share|community|help|support)\b/i);
  return (isShort?1:0)+(isPositive?1:0);
};

const createSessionTracker = () => {
  let sessionStart=Date.now(), postsViewed=0, lastActivity=Date.now();
  const checkReset = () => { if (Date.now()-lastActivity>SESSION_INACTIVITY){sessionStart=Date.now();postsViewed=0;} lastActivity=Date.now(); };
  const persist    = () => { try{sessionStorage.setItem(SESSION_KEY,JSON.stringify({sessionStart,postsViewed,lastActivity}));}catch{} };
  try {
    const raw=sessionStorage.getItem(SESSION_KEY);
    if (raw) { const s=JSON.parse(raw); if(Date.now()-s.lastActivity<SESSION_INACTIVITY){sessionStart=s.sessionStart;postsViewed=s.postsViewed;lastActivity=s.lastActivity;} }
  } catch {}
  return {
    recordView() { checkReset(); postsViewed++; persist(); },
    getMultiplier(post) {
      checkReset();
      const mins=(Date.now()-sessionStart)/60_000;
      if (postsViewed>=SESSION_THRESHOLDS.hard.posts||mins>=SESSION_THRESHOLDS.hard.minutes)
        return 0.6+EXIT_CONTENT_SCORE(post)*0.3;
      if (postsViewed>=SESSION_THRESHOLDS.soft.posts||mins>=SESSION_THRESHOLDS.soft.minutes)
        return 0.85+EXIT_CONTENT_SCORE(post)*0.1;
      return 1.0;
    },
    getStats:()=>({
      postsViewed,
      minutesInSession:Math.round((Date.now()-sessionStart)/60_000),
      phase:postsViewed>=SESSION_THRESHOLDS.hard.posts?"exit":postsViewed>=SESSION_THRESHOLDS.soft.posts?"calm":"fresh",
    }),
  };
};

// ══════════════════════════════════════════════════════════════════════════════
// SCORE V : CausalCalibrator
// ══════════════════════════════════════════════════════════════════════════════
const CAUSAL_KEY         = "feed_causal_v16";
const CAUSAL_CONTROL_PCT = 0.05;
const CAUSAL_MIN_SAMPLES = 50;

const createCausalCalibrator = () => {
  let data = { control:{shown:0,interacted:0}, treatment:{shown:0,interacted:0}, ts:Date.now() };
  try {
    const raw=localStorage.getItem(CAUSAL_KEY);
    if (raw) { const p=JSON.parse(raw); if(Date.now()-p.ts<7*24*60*60*1000) data=p; }
  } catch {}

  const save = () => { try{localStorage.setItem(CAUSAL_KEY,JSON.stringify(data));}catch{} };

  return {
    isControlGroup: (postId) => {
      if (!postId) return false;
      let hash=0;
      for(let i=0;i<postId.length;i++) hash=(hash*31+postId.charCodeAt(i))>>>0;
      return (hash%100)<(CAUSAL_CONTROL_PCT*100);
    },
    recordShown:       (isControl) => { isControl?data.control.shown++:data.treatment.shown++; if(data.control.shown%20===0)save(); },
    recordInteraction: (isControl) => { isControl?data.control.interacted++:data.treatment.interacted++; save(); },
    getLift: () => {
      const {control,treatment}=data;
      if(control.shown<CAUSAL_MIN_SAMPLES||treatment.shown<CAUSAL_MIN_SAMPLES) return null;
      const cC=control.interacted/control.shown, cT=treatment.interacted/treatment.shown;
      return cC>0?(cT-cC)/cC:null;
    },
    // ⚡ OPT 6 — recalibrateWeights est maintenant appelé depuis un useEffect dédié
    // plus de setTimeout interne dans smartBuildFeed
    recalibrateWeights: (weights, onSave) => {
      const lift=data.control.shown>=CAUSAL_MIN_SAMPLES&&data.treatment.shown>=CAUSAL_MIN_SAMPLES
        ?(()=>{ const cC=data.control.interacted/data.control.shown, cT=data.treatment.interacted/data.treatment.shown; return cC>0?(cT-cC)/cC:null; })()
        :null;
      if (lift===null) return weights;
      const updated={...weights};
      if (lift<-0.05) {
        Object.keys(updated).forEach(k=>{ if(k!=="base") updated[k]*=0.95; });
        updated.base=Math.min(0.3,updated.base*1.1);
      } else if (lift>0.10) {
        Object.keys(updated).forEach(k=>{ if(k!=="base") updated[k]=Math.min(0.4,updated[k]*1.02); });
      }
      const normalized=normalizeWeights(updated);
      onSave?.(normalized);
      return normalized;
    },
    getData: ()=>data,
  };
};

// ══════════════════════════════════════════════════════════════════════════════
// ScoringContext factory
// ══════════════════════════════════════════════════════════════════════════════
const createScoringContext = () => ({
  tracker:  createBehaviorTracker(),
  userEmb:  createUserEmbedding(),
  fatigue:  createFatigueDetector(),
  ltm:      createLongTermMemory(),
  session:  createSessionTracker(),
  trend:    createTrendWindow(),
  calib:    createCausalCalibrator(),
  weights:  loadWeights(),
});

let _scoringCtx = null;
const getScoringContext = () => {
  if (!_scoringCtx) _scoringCtx = createScoringContext();
  return _scoringCtx;
};

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    _scoringCtx = null;
    VEC_CACHE.clear();
    SCORE_CACHE.clear();
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// SCORE Q : MMR Reranking — OPT 7 : postToVec dédupliqué
// ══════════════════════════════════════════════════════════════════════════════
const MMR_LAMBDA_BASE = 0.70;

const cosineSim = (a, b) => {
  let dot=0, na=0, nb=0;
  for(let i=0;i<a.length;i++){dot+=a[i]*b[i];na+=a[i]*a[i];nb+=b[i]*b[i];}
  const denom=Math.sqrt(na)*Math.sqrt(nb);
  return denom>0?dot/denom:0;
};

const adaptiveLambda = (n) => {
  if (n <= 5)  return 0.50;
  if (n <= 15) return 0.60;
  if (n <= 30) return 0.65;
  return MMR_LAMBDA_BASE;
};

const applyMMRReranking = (scoredPosts) => {
  if (scoredPosts.length <= 3) return scoredPosts.map(s => s.post);

  const lambda = adaptiveLambda(scoredPosts.length);

  // ⚡ OPT 7 — vecs pré-calculés une seule fois, réutilisés dans toute la boucle
  const withVecs = scoredPosts.map(item => ({
    ...item,
    vec: postToVec(item.post),
  }));

  const result    = [];
  const remaining = [...withVecs];

  const firstIdx = remaining.reduce((best,cur,i)=>cur.score>remaining[best].score?i:best, 0);
  result.push(remaining.splice(firstIdx, 1)[0]);

  while (result.length < withVecs.length && remaining.length > 0) {
    let bestMMR=-Infinity, bestIndex=0;
    remaining.forEach((candidate, i) => {
      const relevance = candidate.score / 100;
      // ⚡ candidate.vec déjà calculé, pas de double appel postToVec
      const maxSim    = result.reduce((m,sel)=>Math.max(m,cosineSim(candidate.vec,sel.vec)), 0);
      const mmr       = lambda*relevance - (1-lambda)*maxSim;
      if (mmr>bestMMR) { bestMMR=mmr; bestIndex=i; }
    });
    result.push(remaining.splice(bestIndex, 1)[0]);
  }

  return result.map(item => item.post);
};

// ══════════════════════════════════════════════════════════════════════════════
// ExplorationBudget
// ══════════════════════════════════════════════════════════════════════════════
const applyExplorationBudget = (rankedPosts, totalSlots) => {
  if (rankedPosts.length <= 3) return rankedPosts;
  const exploitSlots = Math.floor(totalSlots*(1-EXPLORATION_RATE));
  const exploreSlots = Math.max(1, totalSlots-exploitSlots);
  const exploit      = rankedPosts.slice(0, exploitSlots);
  const remaining    = rankedPosts.slice(exploitSlots);
  const explore      = [...remaining].sort(()=>Math.random()-0.5).slice(0,exploreSlots);
  const result       = [...exploit];
  const step         = Math.max(1, Math.round(1/EXPLORATION_RATE));
  explore.forEach((p,i)=>{ const at=Math.min((i+1)*step,result.length); result.splice(at,0,{...p,_isExplore:true}); });
  return result;
};

// ══════════════════════════════════════════════════════════════════════════════
// scoreOnePostRaw — calcul pur sans cache (utilisé par getCachedScore)
// ══════════════════════════════════════════════════════════════════════════════
const scoreOnePostRaw = (p, ctx, seenIds, followingIds, now) => {
  const { tracker, userEmb, fatigue, ltm, session, trend, calib, weights } = ctx;

  const base       = scorePost(p, now);
  const behavioral = tracker.applyBoost(p, base);
  const velocity   = velocityScore(p, now);
  const social     = socialGraphBoost(p, followingIds);
  const mobjective = multiObjectiveScore(p, userEmb, base);
  const fatigueP   = fatigue.penalty(p);
  const ctxTime    = contextualTimeScore(p, now);
  const ltmScore   = ltm.getScore(p);
  const quality    = contentQualityScore(p);
  const trendAmp   = trend.getTrendScore(p);
  const emotionP   = emotionScore(p);
  const sessionMul = session.getMultiplier(p);
  const seenDecay  = seenIds.has(p._id||p._displayKey) ? 0.5 : 1.0;

  const isControl = calib.isControlGroup(p._id);
  calib.recordShown(isControl);

  const rawScore = isControl
    ? Math.random()*50+10
    : (
        behavioral  * weights.behavioral   +
        mobjective  * weights.multiObj      +
        velocity    * weights.velocity      +
        social      * weights.social        +
        base        * weights.base          +
        ctxTime     * weights.contextTime   +
        ltmScore    * weights.longTermMem   +
        quality     * weights.quality       +
        trendAmp    * weights.trendAmp      +
        fatigueP    +
        emotionP
      );

  return {
    post:  { ...p, _score:Math.max(0,rawScore*seenDecay*sessionMul), _isControl:isControl },
    score: Math.max(0, rawScore*seenDecay*sessionMul),
  };
};

// scoreOnePost — alias public qui utilise le cache (OPT 1)
const scoreOnePost = getCachedScore;

// ══════════════════════════════════════════════════════════════════════════════
// smartBuildFeed v16 — OPT 6 : plus de setTimeout interne
// ══════════════════════════════════════════════════════════════════════════════
const smartBuildFeed = (posts, bots, seenIds, followingIds=new Set(), ctx=null) => {
  const _ctx = ctx || getScoringContext();
  const now  = Date.now();

  // ⚡ OPT 1 — utilise getCachedScore pour les posts réels
  const scoredReal = posts.map(p => getCachedScore(p, _ctx, seenIds, followingIds, now));
  const scoredBots = bots.map(p => {
    const base     = scorePost(p, now)*0.7;
    const velocity = velocityScore(p, now)*0.5;
    const total    = (base*0.5+velocity*0.3)*(seenIds.has(p._id||p._displayKey)?0.4:1.0);
    return { post:{...p,_score:Math.max(0,total)}, score:Math.max(0,total) };
  });

  scoredReal.sort((a,b)=>b.score-a.score);
  scoredBots.sort((a,b)=>b.score-a.score);

  const mmrRanked  = applyMMRReranking(scoredReal);
  const rankedBots = scoredBots.map(s=>s.post);

  const mixed=[]; let bi=0;
  mmrRanked.forEach((p,i)=>{
    mixed.push(p);
    if((i+1)%MIX_BLOCK===0&&bi<rankedBots.length&&bi<MIX_MAX_BOTS)
      mixed.push({...rankedBots[bi++],_isBot:true});
  });
  while(bi<Math.min(rankedBots.length,MIX_MAX_BOTS)) mixed.push({...rankedBots[bi++],_isBot:true});

  // ⚡ OPT 6 — recalibrateWeights est géré dans un useEffect dédié dans Home
  // Plus de setTimeout ici qui mutait silencieusement hors du cycle React

  return applyExplorationBudget(mixed, mixed.length);
};

// ══════════════════════════════════════════════════════════════════════════════
// Dwell Time Tracker
// ══════════════════════════════════════════════════════════════════════════════
const createDwellTracker = (post, onDwell, onSkip) => {
  let enterTime=null, hasInteracted=false;
  return {
    onEnter: ()=>{ enterTime=Date.now(); },
    onLeave: ()=>{
      if (!enterTime) return;
      const ms=Date.now()-enterTime; enterTime=null;
      if (hasInteracted) return;
      if (ms<500) onSkip?.(post); else onDwell?.(post,ms);
    },
    markInteracted: ()=>{ hasInteracted=true; },
  };
};

// ══════════════════════════════════════════════════════════════════════════════
// Prefetch
// ══════════════════════════════════════════════════════════════════════════════
const prefetchedUrls = new Set();
const prefetchOneUrl = (url) => {
  if (!url||typeof url!=="string"||prefetchedUrls.has(url)) return;
  prefetchedUrls.add(url);
  try {
    const isVideo=/\.(mp4|webm|mov|avi)(\?|$)/i.test(url.split("?")[0]);
    if (isVideo) { const v=document.createElement("video"); v.src=url; v.preload="metadata"; v.muted=true; }
    else if (url.startsWith("http")||url.startsWith("/")) {
      const link=document.createElement("link"); link.rel="prefetch"; link.as="image"; link.href=url;
      link.setAttribute("fetchpriority","low"); document.head.appendChild(link);
      const img=new Image(); img.src=url; img.decode?.().catch(()=>{});
    }
  } catch {}
};

const getPostAllMediaUrls = (post) => {
  if (!post) return [];
  const urls=[], push=(v)=>{if(v&&typeof v==="string")urls.push(v);else if(v?.url)urls.push(v.url);};
  (Array.isArray(post.media)?post.media:post.media?[post.media]:[]).forEach(push);
  (Array.isArray(post.images)?post.images:post.images?[post.images]:[]).forEach(push);
  if(post.videoUrl)push(post.videoUrl); if(post.embedUrl)push(post.embedUrl); if(post.thumbnail)push(post.thumbnail);
  return urls;
};

const scheduleIdlePrefetch = (posts, fromIndex, count=PREFETCH_AHEAD, minScore=0) => {
  if (!posts?.length) return;
  const targets=posts.slice(fromIndex,fromIndex+count).filter(p=>(p._score||0)>=minScore);
  if (!targets.length) return;
  const run=()=>targets.forEach(p=>getPostAllMediaUrls(p).forEach(prefetchOneUrl));
  if (typeof requestIdleCallback!=="undefined") requestIdleCallback(run,{timeout:2000});
  else setTimeout(run,PREFETCH_IDLE_WAIT);
};

// ══════════════════════════════════════════════════════════════════════════════
// URL cache / expirable
// ══════════════════════════════════════════════════════════════════════════════
const URL_CACHE_TTL    = 80*60*1000;
const URL_CACHE_PREFIX = "murl_";
const urlCR = (k)=>{try{const r=sessionStorage.getItem(URL_CACHE_PREFIX+k);if(!r)return null;const{url,exp}=JSON.parse(r);if(Date.now()>exp){sessionStorage.removeItem(URL_CACHE_PREFIX+k);return null;}return url;}catch{return null;}};
const urlCW = (k,url)=>{try{sessionStorage.setItem(URL_CACHE_PREFIX+k,JSON.stringify({url,exp:Date.now()+URL_CACHE_TTL}));}catch{}};
const EXPIRABLE=[
  {name:"pexels",  test:(u)=>u.includes("videos.pexels.com/video-files/"), extractId:(u)=>u.match(/video-files\/(\d+)\//)?.[1]||null, resolve:async(id)=>{const r=await axiosClient.get(`/videos/refresh-url?id=${id}`);return r.data?.url||r.data?.videoUrl||null;}},
  {name:"pixabay", test:(u)=>/cdn\.pixabay\.com\/video\/\d{4}\/\d{2}\/\d{2}\//.test(u), extractId:(u)=>u.match(/\/(\d+)-\d+_/)?.[1]||null, resolve:async(id)=>{const r=await axiosClient.get(`/api/proxy/video?id=${id}&source=pixabay`);return r.data?.url||r.data?.videoUrl||null;}},
];
const DEAD_HOSTS    = ["youtube.com/watch","youtu.be/","dailymotion.com/video","tiktok.com/@"];
const expSrc        = (u)=>typeof u==="string"?EXPIRABLE.find(s=>s.test(u))||null:null;
const isDead        = (u)=>DEAD_HOSTS.some(p=>u.includes(p));

const isStructValid = (u)=>{
  if(!u||typeof u!=="string"||u.length<10)return false;
  if(u.includes("dicebear"))return false;
  if(u.includes("api.dicebear.com"))return false;
  if(u.startsWith("data:")||u.startsWith("blob:")||u.startsWith("/"))return true;
  try{const x=new URL(u);return!!(x.hostname&&x.pathname&&x.pathname!=="/")}catch{return false;}
};

const getMediaUrls  = (p)=>{const all=[...(Array.isArray(p.media)?p.media:p.media?[p.media]:[]),...(Array.isArray(p.images)?p.images:p.images?[p.images]:[]),p.videoUrl,p.embedUrl,p.thumbnail];return all.filter(Boolean).map(m=>typeof m==="string"?m:m?.url).filter(Boolean);};
const getResolvable = (p)=>{if(p?.externalId){for(const s of EXPIRABLE){const id=s.extractId(p.externalId)||(s.name==="pexels"&&p.externalId.match(/^pexels_(\d+)$/)?.[1])||null;if(id)return{source:s,id};}}for(const url of[p?.videoUrl,p?.embedUrl].filter(Boolean)){const s=expSrc(url);if(s){const id=s.extractId(url);if(id)return{source:s,id};}}return null;};
const hasExpirable  = (p)=>getMediaUrls(p).some(u=>!!expSrc(u));

const resolvePost = async (post) => {
  try {
    const expUrls=getMediaUrls(post).filter(u=>!!expSrc(u));
    if (!expUrls.length) {
      const r=getResolvable(post);if(!r)return post;
      const c=urlCR(`${r.source.name}_${r.id}`);if(c)return{...post,videoUrl:c,_resolved:true};
      const f=await r.source.resolve(r.id);if(!f)return null;
      urlCW(`${r.source.name}_${r.id}`,f);return{...post,videoUrl:f,_resolved:true};
    }
    const res=await Promise.all(expUrls.map(async(url)=>{
      const s=expSrc(url),id=s.extractId(url);if(!id)return null;
      const k=`${s.name}_${id}`,c=urlCR(k);if(c)return c;
      try{const f=await s.resolve(id);if(f)urlCW(k,f);return f;}catch{return null;}
    }));
    if(res.every(r=>!r))return null;
    let out={...post,_resolved:true};
    expUrls.forEach((orig,i)=>{
      if(!res[i])return;
      if(post.videoUrl===orig)out.videoUrl=res[i];
      if(post.embedUrl===orig)out.embedUrl=res[i];
      if(Array.isArray(post.media))out.media=post.media.map(m=>{const u=typeof m==="string"?m:m?.url;return u===orig?(typeof m==="string"?res[i]:{...m,url:res[i]}):m;});
      if(Array.isArray(post.images))out.images=post.images.map(m=>{const u=typeof m==="string"?m:m?.url;return u===orig?(typeof m==="string"?res[i]:{...m,url:res[i]}):m;});
    });
    return out;
  }catch{return null;}
};

// ⚡ OPT 2 — resolveBatch avec AbortSignal + yield requestIdleCallback
const resolveBatch = async (posts, onPartialResult, signal) => {
  const results=new Array(posts.length).fill(null);
  let i=0, resolved=0;

  const worker = async () => {
    while (i < posts.length) {
      if (signal?.aborted) return;
      const idx = i++;
      results[idx] = hasExpirable(posts[idx])
        ? await resolvePost(posts[idx])
        : posts[idx];
      resolved++;
      // Notify toutes les 5 résolutions (au lieu de 3) et yield au browser
      if (onPartialResult && resolved % 5 === 0) {
        onPartialResult(results.filter(Boolean));
        await new Promise(r => {
          if (signal?.aborted) { r(); return; }
          typeof requestIdleCallback !== "undefined"
            ? requestIdleCallback(r, { timeout: 100 })
            : setTimeout(r, 0);
        });
      }
    }
  };

  await Promise.all(Array.from({ length: RESOLVE_CONCURRENCY }, worker));
  return results.filter(Boolean);
};

const seededShuffle = (arr, seed) => {
  const r=[...arr];let s=seed>>>0;
  for(let i=r.length-1;i>0;i--){s=(Math.imul(s^(s>>>15),s|1)^(s+Math.imul(s^(s>>>7),s|61)))>>>0;const j=s%(i+1);[r[i],r[j]]=[r[j],r[i]];}
  return r;
};

// ══════════════════════════════════════════════════════════════════════════════
// ⚡ OPT 5 — isValidPost hissé au niveau module (pas de useCallback chaud)
// Ne dépend d'aucun state/prop React
// ══════════════════════════════════════════════════════════════════════════════
const isValidPost = (p) => {
  if(!p?._id)return false;
  if(p._isMock||p.isMockPost||p._id?.startsWith("post_"))return true;
  const u=p.user||p.author||{};
  if(u.isBanned||u.isDeleted||["deleted","banned"].includes(u.status))return false;
  if(!u._id&&!u.id&&!p.userId&&!p.author?._id)return false;
  const media=getMediaUrls(p),hasText=!!(p.content||p.contenu);
  if(!media.length&&hasText)return true;
  if(!media.length&&!hasText)return false;
  if(media.every(isDead))return false;
  const exp=media.filter(u=>!!expSrc(u));
  if(exp.length>0){const r=getResolvable(p);if(!r&&exp.length===media.length)return false;return true;}
  if(!media.filter(isStructValid).length&&!hasText)return false;
  return true;
};

// ══════════════════════════════════════════════════════════════════════════════
// Composants UI
// ══════════════════════════════════════════════════════════════════════════════
const FeedSkeleton = memo(({ isDarkMode }) => {
  const bg1=isDarkMode?"#1c1c1c":"#f0f0f0",bg2=isDarkMode?"#2a2a2a":"#e4e4e4";
  return (
    <>
      <style>{`@keyframes igs{0%{background-position:-400px 0}100%{background-position:400px 0}}.igs{background:linear-gradient(90deg,${bg1} 25%,${bg2} 50%,${bg1} 75%);background-size:800px 100%;animation:igs 1.5s ease-in-out infinite}`}</style>
      {[0,1,2].map(i=>(
        <div key={i} className={`${isDarkMode?"bg-black":"bg-white"} border-b ${isDarkMode?"border-gray-800":"border-gray-100"}`}>
          <div className="flex items-center gap-2.5 px-3 py-2.5">
            <div className="igs w-9 h-9 rounded-full flex-shrink-0"/>
            <div className="flex-1 space-y-1.5"><div className="igs h-3 rounded-full w-32"/><div className="igs h-2.5 rounded-full w-20"/></div>
          </div>
          <div className="igs w-full" style={{aspectRatio:"1/1"}}/>
          <div className="flex gap-2 px-3 py-2.5">{[0,1,2].map(j=><div key={j} className="igs w-7 h-7 rounded"/>)}</div>
          <div className="px-3 pb-3 space-y-2"><div className="igs h-3 rounded-full w-28"/><div className="igs h-3 rounded-full w-full"/><div className="igs h-3 rounded-full w-2/3"/></div>
        </div>
      ))}
    </>
  );
});
FeedSkeleton.displayName = "FeedSkeleton";

const NewBanner = memo(({ count, onClick, topOffset }) => (
  <AnimatePresence>
    {count>0&&(
      <motion.div className="fixed left-0 right-0 z-50 flex justify-center pointer-events-none"
        style={{top:topOffset+8}} initial={{opacity:0,y:-20}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-20}}
        transition={{type:"spring",stiffness:400,damping:30}}>
        <button onClick={onClick}
          className="pointer-events-auto flex items-center gap-2 px-4 py-2 rounded-full shadow-xl text-[13px] font-semibold select-none active:scale-95 transition-transform"
          style={{WebkitTapHighlightColor:"transparent",background:"linear-gradient(135deg,#1a1a1a 0%,#333 100%)",color:"#fff",border:"1px solid rgba(255,255,255,0.15)"}}>
          <ArrowUpIcon className="w-3.5 h-3.5 opacity-80"/>
          <span>{count===1?"1 nouveau post disponible":`${count} nouveaux posts disponibles`}</span>
        </button>
      </motion.div>
    )}
  </AnimatePresence>
));
NewBanner.displayName = "NewBanner";

const AllSeenDivider = memo(({ isDarkMode }) => (
  <div className={`flex items-center gap-3 px-4 py-5 ${isDarkMode?"bg-black":"bg-white"}`}>
    <div className={`flex-1 h-px ${isDarkMode?"bg-gray-800":"bg-gray-200"}`}/>
    <span className={`text-[11px] font-medium px-3 py-1 rounded-full ${isDarkMode?"bg-gray-900 text-gray-500 border border-gray-800":"bg-gray-50 text-gray-400 border border-gray-200"}`}>
      Vous avez tout vu · On recommence
    </span>
    <div className={`flex-1 h-px ${isDarkMode?"bg-gray-800":"bg-gray-200"}`}/>
  </div>
));
AllSeenDivider.displayName = "AllSeenDivider";

const FetchingMore = memo(({ isDarkMode }) => (
  <div className={`flex items-center justify-center py-6 gap-2 ${isDarkMode?"bg-black":"bg-white"}`}>
    <div className={`w-4 h-4 border-2 rounded-full animate-spin ${isDarkMode?"border-gray-700 border-t-gray-400":"border-gray-200 border-t-gray-400"}`}/>
    <span className={`text-xs ${isDarkMode?"text-gray-600":"text-gray-400"}`}>Chargement de nouveaux posts…</span>
  </div>
));
FetchingMore.displayName = "FetchingMore";

const Toast = memo(({ message, type="info", onClose }) => {
  useEffect(()=>{const t=setTimeout(onClose,3000);return()=>clearTimeout(t);},[onClose]);
  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-full shadow-xl text-[13px] font-medium text-white whitespace-nowrap ${type==="error"?"bg-red-500":type==="success"?"bg-green-500":"bg-gray-900"}`}>{message}</div>
  );
});
Toast.displayName = "Toast";

const ALLOWED_CATEGORIES = new Set(["genieCivil","technologie","environnement"]);
const CATEGORY_META = {
  genieCivil:    {label:"🏗️ BTP",  gradient:"from-orange-500 to-red-500"},
  technologie:   {label:"💻 Tech",  gradient:"from-green-500 to-emerald-500"},
  environnement: {label:"🌱 Éco",   gradient:"from-teal-500 to-green-600"},
  general:       {label:"📰 Actu",  gradient:"from-gray-500 to-gray-600"},
};
const getCategoryMeta = (cat) => CATEGORY_META[cat]||CATEGORY_META.general;
const fmtDate = (d)=>{
  if(!d)return"";
  const h=Math.floor((Date.now()-new Date(d))/3600000);
  if(h<1)return"À l'instant";if(h<24)return`Il y a ${h}h`;if(h<48)return"Hier";
  return new Date(d).toLocaleDateString("fr-FR",{day:"numeric",month:"short"});
};

const NewsCard = memo(({ article, isDarkMode, onClick }) => {
  const [imgErr,setImgErr]=useState(false);
  if (!ALLOWED_CATEGORIES.has(article.category)) return null;
  const meta=getCategoryMeta(article.category);
  return (
    <div onClick={onClick} className={`mx-3 my-2 rounded-2xl overflow-hidden cursor-pointer active:scale-[0.98] transition-transform border ${isDarkMode?"bg-gray-900 border-gray-800":"bg-white border-gray-100"}`}
      style={{boxShadow:isDarkMode?"0 2px 12px rgba(0,0,0,0.4)":"0 2px 12px rgba(0,0,0,0.07)"}}>
      {article.image&&!imgErr?(
        <div className="relative w-full overflow-hidden" style={{height:180}}>
          <img src={article.image} alt={article.title} className="w-full h-full object-cover" loading="lazy" onError={()=>setImgErr(true)}/>
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"/>
          <div className={`absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-bold text-white bg-gradient-to-r ${meta.gradient}`}>{meta.label}</div>
          <div className={`absolute top-3 right-3 px-2.5 py-1 rounded-full text-[10px] font-semibold ${isDarkMode?"bg-black/60 text-gray-300":"bg-white/80 text-gray-600"}`}>Actualités</div>
        </div>
      ):(
        <div className={`w-full flex items-center justify-center bg-gradient-to-br ${meta.gradient}`} style={{height:80}}><span className="text-white text-2xl">📰</span></div>
      )}
      <div className="px-4 pt-3 pb-4">
        <p className={`text-[15px] font-bold leading-snug line-clamp-2 mb-1.5 ${isDarkMode?"text-white":"text-gray-900"}`}>{article.title}</p>
        {article.description&&<p className={`text-[13px] leading-relaxed line-clamp-2 mb-2 ${isDarkMode?"text-gray-400":"text-gray-500"}`}>{article.description}</p>}
        <div className={`flex items-center gap-1.5 text-[11px] ${isDarkMode?"text-gray-500":"text-gray-400"}`}>
          <span className="font-semibold text-orange-500">{article.source}</span>
          {article.publishedAt&&(<><span>·</span><span>{fmtDate(article.publishedAt)}</span></>)}
          <span className="ml-auto font-medium text-orange-400">Lire →</span>
        </div>
      </div>
    </div>
  );
});
NewsCard.displayName = "NewsCard";

const PostCardWrapper = memo(({ post, index, onVisible, onDwell, onSkip, ...rest }) => {
  const wrapRef=useRef(null), notified=useRef(false), dwellRef=useRef(null);
  useEffect(()=>{
    const el=wrapRef.current;if(!el)return;
    const tracker=createDwellTracker(post,onDwell,onSkip);
    dwellRef.current=tracker;
    const obs=new IntersectionObserver(([entry])=>{
      if(entry.isIntersecting){tracker.onEnter();if(!notified.current){notified.current=true;onVisible?.(index);}}
      else tracker.onLeave();
    },{rootMargin:"0px",threshold:0.1});
    obs.observe(el);
    return()=>{obs.disconnect();tracker.onLeave();};
  },[index,onVisible,onDwell,onSkip]);
  return (
    <div ref={wrapRef}>
      <PostCard post={{...post,_displayPosition:index}} priority={index===0} {...rest}/>
    </div>
  );
});
PostCardWrapper.displayName = "PostCardWrapper";

// ══════════════════════════════════════════════════════════════════════════════
// Compteur de clés unique et global au module
// ══════════════════════════════════════════════════════════════════════════════
let _keyCounter = 0;
const nextKey = () => ++_keyCounter;

// ═════════════════════════════════════════════════════════════════════════════
// FEED v16 — OPT 3 : version counter au lieu de copie d'array
// ═════════════════════════════════════════════════════════════════════════════
const Feed = ({
  posts,
  isDarkMode, onDeleted, showToast, apiLoadMoreRef, hasMoreFromAPI,
  isLoading, newPostsCount, onShowNewPosts, resetSignal, topOffset,
  suggestedUsers, newsArticles=[], onScrollProgress, onNeedMorePosts,
  scrollContainerRef, followingIds,
  onPostsSeen,
}) => {
  // ⚡ OPT 3 — displayedVer au lieu de displayed state (évite la copie array)
  const [displayedVer,  setDisplayedVer]  = useState(0);
  const [showAllSeen,   setShowAllSeen]   = useState(false);
  const [isFetchingAPI, setIsFetchingAPI] = useState(false);

  const sentinelRef = useRef(null);
  const postsRef    = useRef(posts);
  const accRef      = useRef([]);
  const prevReset   = useRef(resetSignal);
  const loadingRef  = useRef(false);
  const cursorRef   = useRef(0);
  const onScrollProgressRef = useRef(onScrollProgress);
  const onNeedMorePostsRef  = useRef(onNeedMorePosts);
  const onPostsSeenRef      = useRef(onPostsSeen);

  useEffect(()=>{ onScrollProgressRef.current=onScrollProgress; },[onScrollProgress]);
  useEffect(()=>{ onNeedMorePostsRef.current=onNeedMorePosts; },  [onNeedMorePosts]);
  useEffect(()=>{ postsRef.current=posts; },                      [posts]);
  useEffect(()=>{ onPostsSeenRef.current=onPostsSeen; },          [onPostsSeen]);

  const tagPost = useCallback((post) => ({
    ...post,
    _displayKey: `dk_${nextKey()}_${post._id || "x"}`,
  }), []);

  const initFeed = useCallback((pool) => {
    loadingRef.current = false;
    cursorRef.current  = 0;
    const batch = pool.slice(0, PAGE_SIZE).map(tagPost);
    cursorRef.current = batch.length;
    accRef.current = batch;
    setDisplayedVer(v => v + 1); // ⚡ OPT 3 — pas de copie
    setShowAllSeen(false);
    setIsFetchingAPI(false);
    scheduleIdlePrefetch(pool, 0, PAGE_SIZE+PREFETCH_AHEAD, 20);
    if (onPostsSeenRef.current) {
      onPostsSeenRef.current(batch.map(p => p._id).filter(Boolean));
    }
  }, [tagPost]);

  useEffect(()=>{
    const rc = resetSignal !== prevReset.current;
    prevReset.current = resetSignal;

    if (!posts.length) {
      accRef.current = []; cursorRef.current = 0;
      setDisplayedVer(v => v + 1);
      setShowAllSeen(false);
      return;
    }

    const isFirstLoad = accRef.current.length === 0;

    if (rc || isFirstLoad) {
      initFeed(posts);
      return;
    }

    if (posts.length > postsRef.current.length) {
      cursorRef.current = 0;
      setIsFetchingAPI(false);
      loadingRef.current = false;
    }
  }, [resetSignal, posts, initFeed]);

  const loadMore = useCallback(()=>{
    if (loadingRef.current) return;
    const pool=postsRef.current;
    if (!pool.length) return;

    const cursor=cursorRef.current;
    const remaining=pool.length-cursor;

    if (remaining<FRESH_POOL_THRESHOLD) {
      onNeedMorePostsRef.current?.();
      if (remaining===0){setIsFetchingAPI(true);return;}
    }

    loadingRef.current=true;

    const ratio=cursor/Math.max(pool.length,1);
    onScrollProgressRef.current?.(ratio);

    const batch=pool.slice(cursor, cursor+PAGE_SIZE);
    if (!batch.length){setShowAllSeen(true);setIsFetchingAPI(true);loadingRef.current=false;onNeedMorePostsRef.current?.();return;}

    setShowAllSeen(false);
    setIsFetchingAPI(false);

    const tagged = batch.map(tagPost);
    cursorRef.current=cursor+tagged.length;

    if (onPostsSeenRef.current) {
      onPostsSeenRef.current(tagged.map(p => p._id).filter(Boolean));
    }

    const ctx=getScoringContext();
    tagged.forEach(p=>{ctx.fatigue.record(p);ctx.trend.record(p);ctx.session.recordView();});

    const next=[...accRef.current,...tagged];
    // ⚡ OPT 3 — accRef est la source de vérité, pas de setState avec copie
    accRef.current = next.length > MAX_DOM_POSTS
      ? next.slice(next.length - MAX_DOM_POSTS)
      : next;

    Promise.resolve().then(()=>{loadingRef.current=false;});
    // ⚡ OPT 3 — incrément minimal de version, pas de [...array]
    setDisplayedVer(v => v + 1);
    scheduleIdlePrefetch(pool,cursorRef.current,PREFETCH_AHEAD,30);
  },[tagPost]);

  const loadMoreRef=useRef(loadMore);
  useEffect(()=>{loadMoreRef.current=loadMore;},[loadMore]);

  useEffect(()=>{
    const el=sentinelRef.current;if(!el)return;
    const root=scrollContainerRef?.current||null;
    const obs=new IntersectionObserver(([e])=>{if(e.isIntersecting)loadMoreRef.current();},{root,rootMargin:"800px",threshold:0});
    obs.observe(el);return()=>obs.disconnect();
  },[scrollContainerRef]);

  useEffect(()=>{
    const getScrollEl=()=>scrollContainerRef?.current||null;
    let scrollEl=getScrollEl();let lastCall=0,lastEmit=0;let cleanup=()=>{};
    const onScroll=()=>{
      const now=Date.now();
      if(now-lastEmit>=50){lastEmit=now;const st=scrollEl?(scrollEl.scrollTop||0):0;window.dispatchEvent(new CustomEvent("app:scroll",{detail:{scrollTop:st}}));}
      if(now-lastCall<100)return;lastCall=now;
      const sentinel=sentinelRef.current;if(!sentinel)return;
      const rect=sentinel.getBoundingClientRect();
      if(rect.top<(window.innerHeight||document.documentElement.clientHeight)+1200)loadMoreRef.current();
    };
    const attach=(el)=>{if(!el)return;el.addEventListener("scroll",onScroll,{passive:true});cleanup=()=>el.removeEventListener("scroll",onScroll);setTimeout(onScroll,100);};
    if(scrollEl){attach(scrollEl);}
    else{const poll=setInterval(()=>{scrollEl=getScrollEl();if(scrollEl){clearInterval(poll);attach(scrollEl);}},50);setTimeout(()=>clearInterval(poll),2000);}
    return()=>cleanup();
  },[scrollContainerRef]);

  useEffect(()=>{if(posts.length>0&&isFetchingAPI){loadingRef.current=false;loadMoreRef.current?.();}},[posts.length,isFetchingAPI]);

  const handlePostVisible=useCallback((index)=>{scheduleIdlePrefetch(postsRef.current,index+1,PREFETCH_AHEAD,20);},[]);

  const ctx=getScoringContext();
  const handleDwell=useCallback((post,ms)=>{
    ctx.tracker.onDwell(post,ms);
    const label=ms>8000?1:ms>3000?0.5:0.2;
    ctx.userEmb.update(postToVec(post),label);
    ctx.ltm.update(post,label*0.5);
    if(post._isControl)ctx.calib.recordInteraction(true);
    else ctx.calib.recordInteraction(false);
  },[]); // eslint-disable-line
  const handleSkip=useCallback((post)=>{
    ctx.tracker.onSkip(post);
    ctx.userEmb.update(postToVec(post),-0.3);
    ctx.ltm.update(post,-0.2);
  },[]); // eslint-disable-line

  const [selectedArticle,setSelectedArticle]=useState(null);

  // ⚡ OPT 3 — lecture directe de accRef, pas de state copié
  const displayedPosts = accRef.current;

  if (isLoading&&!displayedPosts.length) return <FeedSkeleton isDarkMode={isDarkMode}/>;
  if (!isLoading&&!displayedPosts.length) return (
    <div className="flex flex-col items-center justify-center py-24 gap-3">
      <div className={`w-16 h-16 rounded-full flex items-center justify-center ${isDarkMode?"bg-gray-900":"bg-gray-100"}`}>
        <svg className={`w-8 h-8 ${isDarkMode?"text-gray-600":"text-gray-300"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
      </div>
      <p className={`text-sm ${isDarkMode?"text-gray-600":"text-gray-400"}`}>Aucune publication</p>
    </div>
  );

  return (
    <>
      <NewBanner count={newPostsCount} onClick={onShowNewPosts} topOffset={topOffset}/>
      {displayedPosts.map((post,index)=>{
        const newsSlot=index>0&&index%NEWS_EVERY===0?Math.floor(index/NEWS_EVERY)-1:-1;
        const newsItem=newsSlot>=0&&newsArticles.length>0?newsArticles[newsSlot%newsArticles.length]:null;
        return (
          <div key={post._displayKey}>
            <PostCardWrapper post={post} index={index} onVisible={handlePostVisible} onDwell={handleDwell} onSkip={handleSkip} onDeleted={onDeleted} showToast={showToast} mockPost={!!post._isMock||!!post.isMockPost} priority={index===0}/>
            {newsItem&&<NewsCard key={`news-${newsSlot}`} article={newsItem} isDarkMode={isDarkMode} onClick={()=>setSelectedArticle(newsItem)}/>}
            {index>0&&index%SUGGEST_PROFILE_EVERY===0&&<SuggestedPostPreview key={`spp-${index}`} isDarkMode={isDarkMode} userPool={suggestedUsers} slotIndex={Math.floor(index/SUGGEST_PROFILE_EVERY)}/>}
            {index>0&&index%SUGGEST_ACCOUNTS_EVERY===0&&index%SUGGEST_PROFILE_EVERY!==0&&<SuggestedAccounts key={`sa-${index}`} isDarkMode={isDarkMode} instanceId={Math.floor(index/SUGGEST_ACCOUNTS_EVERY)}/>}
          </div>
        );
      })}
      {showAllSeen   &&<AllSeenDivider isDarkMode={isDarkMode}/>}
      {isFetchingAPI &&<FetchingMore  isDarkMode={isDarkMode}/>}
      <div ref={sentinelRef} className="h-10 flex items-center justify-center" aria-hidden="true">
        {displayedPosts.length>0&&!isFetchingAPI&&<div className={`w-1 h-1 rounded-full ${isDarkMode?"bg-gray-800":"bg-gray-200"}`}/>}
      </div>
      {hasMoreFromAPI&&<div ref={apiLoadMoreRef} className="h-1" aria-hidden="true"/>}
      {selectedArticle&&<Suspense fallback={null}><ArticleReaderModal article={selectedArticle} isOpen={!!selectedArticle} onClose={()=>setSelectedArticle(null)}/></Suspense>}
    </>
  );
};
Feed.displayName = "Feed";

// ═════════════════════════════════════════════════════════════════════════════
// HOME v16 — toutes optimisations appliquées
// ═════════════════════════════════════════════════════════════════════════════
const Home = ({ openStoryViewer: openStoryViewerProp, searchQuery="" }) => {
  const { isDarkMode }   = useDarkMode();
  const { fetchStories, stories=[] } = useStories();
  const { posts:rawPosts=[], fetchNextPage, hasMore, loading:postsLoading, refetch, removePost } = usePosts()||{};
  const { user }         = useAuth();
  const navigate         = useNavigate();
  const [,startPageTrans] = useTransition();

  const [showCreator,  setShowCreator]  = useState(false);
  const [showViewer,   setShowViewer]   = useState(false);
  const [viewerData,   setViewerData]   = useState({stories:[],owner:null});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showPyramid,  setShowPyramid]  = useState(false);
  const [toast,        setToast]        = useState(null);
  const [mockCount,    setMockCount]    = useState(MOCK_CONFIG.initialCount);
  const [pullDist,     setPullDist]     = useState(0);
  const [newPosts,     setNewPosts]     = useState(0);
  const [resetSig,     setResetSig]     = useState(0);
  const [apiPages,     setApiPages]     = useState(1);
  const [seed,         setSeed]         = useState(()=>Math.floor(Math.random()*0xffffffff));
  const [suggestedUsers, setSuggestedUsers] = useState([]);
  const [followingIds, setFollowingIds] = useState(new Set());

  const livePostsRef = useRef(loadLivePool());
  const [livePostsVer, setLivePostsVer] = useState(0);
  const [resolved, setResolved]         = useState([]);

  const persistedSeenIdsRef = useRef(loadSeenIds());

  const scrollRef    = useRef(null);
  const apiObsRef    = useRef(null);
  const loadingRef   = useRef(false);
  const mockGenRef   = useRef(false);
  const touchStartY  = useRef(0);
  const isPulling    = useRef(false);
  const canPull      = useRef(true);
  const pullDistRef  = useRef(0);
  const latestId     = useRef(null);
  const sugFetched   = useRef(false);
  const waveTimer    = useRef(null);
  const fallbackFetchedRef = useRef(false);
  const fallbackLastRun    = useRef(0);
  const silentFetchingRef  = useRef(false);
  const silentLastFetchRef = useRef(0);
  const prefetchTriggeredRef = useRef(false);
  const isScrollingRef     = useRef(false);
  const scrollIdleTimerRef = useRef(null);
  const currentApiPageRef   = useRef(1);
  const fetchingNextPageRef = useRef(false);

  // ⚡ OPT 8 — AbortController global pour tous les fetches axios
  const abortRef = useRef(new AbortController());

  // ⚡ OPT 4 — timer de debounce pour saveSeenIds
  const saveSeenIdsTimer = useRef(null);

  const STORIES_H = 92;
  const TOTAL_TOP = STORIES_H;
  const showMock  = MOCK_CONFIG.enabled;

  // ══════════════════════════════════════════════════════════════════════════
  // OPT 8 — AbortController : reset à chaque montage, abort au unmount
  // ══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    abortRef.current = new AbortController();
    return () => {
      abortRef.current.abort();
      clearTimeout(saveSeenIdsTimer.current);
    };
  }, []);

  // ══════════════════════════════════════════════════════════════════════════
  // Seed forcé + seenIds reset au montage (v15 FIX 7, conservé)
  // ══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    const freshSeed = Math.floor(Math.random() * 0xffffffff);
    setSeed(freshSeed);
    persistedSeenIdsRef.current = new Set();
    saveSeenIds(new Set());
    startTransition(() => setResetSig(k => k + 1));
  }, []);

  // ══════════════════════════════════════════════════════════════════════════
  // ⚡ OPT 6 — recalibrateWeights dans un useEffect dédié (toutes les 5 min)
  // Plus de setTimeout dans smartBuildFeed / useMemo
  // ══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!user) return;
    const id = setInterval(() => {
      if (document.hidden) return;
      const _ctx = getScoringContext();
      _ctx.calib.recalibrateWeights(_ctx.weights, (newW) => {
        _ctx.weights = newW;
        saveWeights(newW);
        // Invalide le score cache : les prochains scores seront recalculés
        invalidateScoreCache();
      });
    }, 5 * 60_000);
    return () => clearInterval(id);
  }, [user]);

  const { articles:newsGC   } = useNews({maxArticles:4,category:"genieCivil",    autoFetch:!!user,enabled:!!user})||{};
  const { articles:newsTech } = useNews({maxArticles:2,category:"technologie",   autoFetch:!!user,enabled:!!user})||{};
  const { articles:newsEnv  } = useNews({maxArticles:2,category:"environnement", autoFetch:!!user,enabled:!!user})||{};
  const newsGCLen=newsGC?.length??0, newsTechLen=newsTech?.length??0, newsEnvLen=newsEnv?.length??0;
  const newsArticles=useMemo(()=>{
    const all=[...(newsGC||[]),...(newsTech||[]),...(newsEnv||[])];
    const seen=new Set();
    return all.filter(a=>{const key=a._id||a.id||a.url;if(seen.has(key))return false;seen.add(key);return true;});
  },[newsGCLen,newsTechLen,newsEnvLen]); // eslint-disable-line

  // ⚡ OPT 4 — saveSeenIds déboncé 2s (plus de write synchrone à chaque batch)
  const handlePostsSeen = useCallback((ids) => {
    ids.forEach(id => persistedSeenIdsRef.current.add(id));
    clearTimeout(saveSeenIdsTimer.current);
    saveSeenIdsTimer.current = setTimeout(() => {
      saveSeenIds(persistedSeenIdsRef.current);
    }, 2000);
  }, []);

  const addLivePosts=useCallback((list)=>{
    const ids=new Set(livePostsRef.current.map(p=>p._id));
    const fresh=list
      .filter(p=>p?._id&&!ids.has(p._id))
      .map(({ _displayKey, ...rest })=>rest);
    if(!fresh.length)return false;
    livePostsRef.current=[...livePostsRef.current,...fresh].slice(0,MAX_POOL);
    saveLivePool(livePostsRef.current);
    startTransition(()=>setLivePostsVer(v=>v+1));
    return true;
  },[]);

  useEffect(()=>{
    if(!user)return;
    (async()=>{
      try{
        const{data}=await axiosClient.get("/users/following?limit=500",{
          signal: abortRef.current.signal // ⚡ OPT 8
        });
        const list=Array.isArray(data)?data:(data?.users||data?.following||[]);
        setFollowingIds(new Set(list.map(u=>u._id||u.id).filter(Boolean)));
      }catch(e){ if(e?.name==="CanceledError"||e?.name==="AbortError") return; }
    })();
  },[user]);

  const handleNeedMorePosts=useCallback(async()=>{
    if(fetchingNextPageRef.current||!user)return;
    fetchingNextPageRef.current=true;
    try{
      if(hasMore&&typeof fetchNextPage==="function"){
        const nextPage=currentApiPageRef.current+1;currentApiPageRef.current=nextPage;
        const result=await fetchNextPage();const newApiPosts=result?.posts||[];
        if(newApiPosts.length>0){addLivePosts(newApiPosts);setApiPages(nextPage);return;}
      }
      const now=Date.now();
      if(now-silentLastFetchRef.current>=SILENT_COOLDOWN_MS/2){
        silentLastFetchRef.current=now;const result=await refetch?.();const fp=result?.posts||[];
        if(fp.length>0){const added=addLivePosts(fp);if(!added)startTransition(()=>setLivePostsVer(v=>v+1));}
      }
    }catch(e){ if(e?.name==="CanceledError"||e?.name==="AbortError") return; }
    finally{fetchingNextPageRef.current=false;}
  },[user,hasMore,fetchNextPage,refetch,addLivePosts]);

  useEffect(()=>{
    const scrollEl=scrollRef.current;if(!scrollEl)return;
    const onScroll=()=>{isScrollingRef.current=true;clearTimeout(scrollIdleTimerRef.current);scrollIdleTimerRef.current=setTimeout(()=>{isScrollingRef.current=false;},SCROLL_IDLE_MS);};
    scrollEl.addEventListener("scroll",onScroll,{passive:true});
    return()=>{scrollEl.removeEventListener("scroll",onScroll);clearTimeout(scrollIdleTimerRef.current);};
  },[]);

  useEffect(()=>{
    if(!user||sugFetched.current)return;sugFetched.current=true;
    (async()=>{
      try{
        const{data}=await axiosClient.get("/users/suggestions?limit=20",{
          signal: abortRef.current.signal // ⚡ OPT 8
        });
        const list=Array.isArray(data)?data:(data?.users||data?.suggestions||[]);
        setSuggestedUsers(list.filter(u=>u?._id&&u._id!==user._id));
      }
      catch(e){
        if(e?.name==="CanceledError"||e?.name==="AbortError") return;
        try{
          const{data}=await axiosClient.get("/users?limit=20&sort=followers",{
            signal: abortRef.current.signal
          });
          const list=Array.isArray(data)?data:(data?.users||[]);
          setSuggestedUsers(list.filter(u=>u?._id&&u._id!==user._id).slice(0,16));
        }catch{ setSuggestedUsers([]); }
      }
    })();
  },[user]);

  const fetchFallbackPosts=useCallback(async()=>{
    if(!user)return;
    const now=Date.now();
    if(now-fallbackLastRun.current<FALLBACK_COOLDOWN_MS||fallbackFetchedRef.current)return;
    fallbackFetchedRef.current=true;fallbackLastRun.current=now;
    try{
      const cachedProfilePosts=readAllCachedProfilePosts();
      if(cachedProfilePosts.length>0){addLivePosts(cachedProfilePosts);const er=livePostsRef.current.filter(p=>!p._isMock&&!p.isMockPost).length;if(er>=FALLBACK_THRESHOLD*2)return;}
      let userPool=suggestedUsers.length>0?suggestedUsers:await(async()=>{
        try{
          const{data}=await axiosClient.get("/users?limit=30&sort=followers",{
            signal: abortRef.current.signal // ⚡ OPT 8
          });
          return Array.isArray(data)?data:(data?.users||[]);
        }catch{ return[]; }
      })();
      if(!userPool.length)return;
      const shuffled=[...userPool].sort(()=>Math.random()-0.5);
      const probeTarget=shuffled[0],targets=shuffled.slice(1,MAX_FALLBACK_USERS+1);
      if(!window.__fallbackPostsRoutePromise__){
        const probeUid=probeTarget?._id||probeTarget?.id;
        window.__fallbackPostsRoutePromise__=probeUid?(async()=>{
          const sig = abortRef.current.signal; // ⚡ OPT 8
          try{await axiosClient.get(`/users/${probeUid}/posts?limit=1&page=1`,{signal:sig});return"user_posts";}
          catch(e1){if(e1.response?.status!==404)return"user_posts";
            try{await axiosClient.get(`/posts?userId=${probeUid}&limit=1`,{signal:sig});return"posts_filter";}
            catch(e2){if(e2.response?.status!==404)return"posts_filter";
              try{await axiosClient.get(`/posts/user/${probeUid}?limit=1`,{signal:sig});return"posts_user";}
              catch{return"none";}}}
        })():Promise.resolve("none");
        window.__fallbackPostsRoutePromise__.catch(()=>{delete window.__fallbackPostsRoutePromise__;});
      }
      const route=await window.__fallbackPostsRoutePromise__;
      if(route==="none")return;
      const buildUrl=(uid)=>{
        if(route==="user_posts")  return`/users/${uid}/posts?limit=${FALLBACK_POSTS_LIMIT}&page=1`;
        if(route==="posts_filter")return`/posts?userId=${uid}&limit=${FALLBACK_POSTS_LIMIT}`;
        if(route==="posts_user")  return`/posts/user/${uid}?limit=${FALLBACK_POSTS_LIMIT}`;
        return null;
      };
      const sig = abortRef.current.signal; // ⚡ OPT 8
      const results=await Promise.allSettled([probeTarget,...targets].filter(Boolean).map(async(u)=>{
        const uid=u._id||u.id;if(!uid)return[];
        const url=buildUrl(uid);if(!url)return[];
        try{
          const{data}=await axiosClient.get(url,{signal:sig});
          const posts=Array.isArray(data)?data:(data?.posts||data?.data||[]);
          return posts.map(p=>({...p,_fromFallback:true}));
        }
        catch(e){
          if(e?.name==="CanceledError"||e?.name==="AbortError") return[];
          if(e.response?.status===404)delete window.__fallbackPostsRoutePromise__;
          return[];
        }
      }));
      const allFallback=results.filter(r=>r.status==="fulfilled").flatMap(r=>r.value).filter(p=>p?._id);
      if(allFallback.length)addLivePosts(allFallback);
    }catch(e){ if(e?.name==="CanceledError"||e?.name==="AbortError") return; }
  },[user,suggestedUsers,addLivePosts]);

  const fetchFallbackRef=useRef(fetchFallbackPosts);
  useEffect(()=>{fetchFallbackRef.current=fetchFallbackPosts;},[fetchFallbackPosts]);

  useEffect(()=>{
    if(!user||postsLoading)return;
    const rc=livePostsRef.current.filter(p=>!p._isMock&&!p.isMockPost&&!p._fromFallback).length;
    if(rc<FALLBACK_THRESHOLD)fetchFallbackRef.current();
  },[livePostsVer,postsLoading,user]);

  useEffect(()=>{
    if(!user)return;
    const h=()=>{const rc=livePostsRef.current.filter(p=>!p._isMock&&!p.isMockPost&&!p._fromFallback&&!p._fromProfileCache).length;if(rc<FALLBACK_THRESHOLD){const c=readAllCachedProfilePosts();if(c.length>0)addLivePosts(c);}};
    window.addEventListener("profilePostsCached",h);return()=>window.removeEventListener("profilePostsCached",h);
  },[user,addLivePosts]);

  useEffect(()=>{
    if(!rawPosts.length)return;
    const ids=new Set(rawPosts.map(p=>p._id));
    const filtered=livePostsRef.current.filter(p=>!ids.has(p._id));
    const cleanRaw=rawPosts.map(({ _displayKey, ...rest })=>rest);
    livePostsRef.current=[...filtered,...cleanRaw].slice(0,MAX_POOL);
    saveLivePool(livePostsRef.current);
    startTransition(()=>setLivePostsVer(v=>v+1));
  },[rawPosts]);

  const ctx = getScoringContext();

  const rawPool=useMemo(()=>{
    const live=livePostsRef.current;
    const dedup=(arr)=>{const s=new Set();return arr.filter(p=>{if(s.has(p._id))return false;s.add(p._id);return true;});};
    // ⚡ OPT 5 — isValidPost est au niveau module, pas recréé ici
    const valid=dedup(live.filter(p=>isValidPost(p)));
    const vReal=valid.filter(p=>!p.isBot&&!p.user?.isBot);
    const vBots=valid.filter(p=> p.isBot|| p.user?.isBot);

    const seenIds = persistedSeenIdsRef.current;
    const unseenReal = vReal.filter(p => !seenIds.has(p._id));
    const useUnseen  = unseenReal.length >= MIN_UNSEEN_BEFORE_LOOP;
    const realToScore = useUnseen ? unseenReal : vReal;

    let built;
    if(!showMock){
      // ⚡ OPT 1 — smartBuildFeed utilise getCachedScore en interne
      built = smartBuildFeed(realToScore, vBots, seenIds, followingIds, ctx);
    } else {
      const mocks=dedup(MOCK_POSTS.slice(0,mockCount));
      if(MOCK_CONFIG.mixWithRealPosts&&realToScore.length>0)
        built = smartBuildFeed(realToScore, [...vBots,...mocks], seenIds, followingIds, ctx);
      else
        built = seededShuffle(mocks, seed);
    }

    const seen = new Set();
    return built.filter(p => {
      const key = p._id;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  },[livePostsVer,mockCount,showMock,seed,followingIds]); // eslint-disable-line

  // ⚡ OPT 2 — useEffect avec AbortController pour annuler resolveBatch
  useEffect(()=>{
    if(!rawPool.length){setResolved([]);return;}

    const controller = new AbortController();
    let cancelled = false;

    const immediate=rawPool.filter(p=>!hasExpirable(p));
    const exp=rawPool.filter(p=>hasExpirable(p));

    startTransition(()=>setResolved(immediate));
    if(!exp.length) return () => { cancelled = true; };

    scheduleIdlePrefetch(immediate,0,PREFETCH_AHEAD,20);
    const rm=new Map(immediate.map(p=>[p._id,p]));

    resolveBatch(exp,(partials)=>{
      if(cancelled||controller.signal.aborted)return;
      partials.forEach(p=>rm.set(p._id,p));
      startTransition(()=>setResolved(rawPool.map(p=>rm.get(p._id)).filter(Boolean)));
    }, controller.signal).then(fr=>{  // ⚡ OPT 2 — signal passé à resolveBatch
      if(cancelled||controller.signal.aborted)return;
      fr.forEach(p=>rm.set(p._id,p));
      const o=rawPool.map(p=>rm.get(p._id)).filter(Boolean);
      startTransition(()=>setResolved(o));
      scheduleIdlePrefetch(o,0,PREFETCH_AHEAD*2,20);
    });

    return()=>{ cancelled=true; controller.abort(); };
  },[rawPool]);

  useEffect(()=>{
    if(!user)return;
    const id=setInterval(()=>{
      if(!document.hidden&&!isScrollingRef.current)
        startTransition(()=>{setSeed(Math.floor(Math.random()*0xffffffff));setResetSig(k=>k+1);});
    },SEED_ROTATE_MS);
    return()=>clearInterval(id);
  },[user]);

  useEffect(()=>{if(resolved.length>0&&!latestId.current)latestId.current=resolved[0]._id;},[resolved]);

  const filtered=useMemo(()=>{
    if(!searchQuery.trim())return resolved;
    const q=searchQuery.toLowerCase();
    return resolved.filter(p=>(p.content||"").toLowerCase().includes(q)||(p.user?.fullName||"").toLowerCase().includes(q));
  },[resolved,searchQuery]);

  const isLoading=postsLoading&&resolved.length===0;
  useEffect(()=>{loadingRef.current=postsLoading;},[postsLoading]);

  useEffect(()=>{
    if(mockGenRef.current||isLoading||!MOCK_CONFIG.enabled)return;
    if(!(MOCK_CONFIG.totalPosts>100&&MOCK_CONFIG.lazyGeneration?.enabled!==false))return;
    const t=setTimeout(()=>{
      if(mockGenRef.current)return;mockGenRef.current=true;
      const run=()=>generateFullDataset(()=>{}).catch(()=>{mockGenRef.current=false;});
      typeof requestIdleCallback!=="undefined"?requestIdleCallback(run,{timeout:60000}):setTimeout(run,1000);
    },30000);
    return()=>clearTimeout(t);
  },[isLoading]);

  useEffect(()=>()=>{clearTimeout(waveTimer.current);},[]);
  useEffect(()=>{
    window.dispatchEvent(new CustomEvent("app:scroll",{detail:{scrollTop:0}}));
    return()=>window.dispatchEvent(new CustomEvent("app:scroll",{detail:{scrollTop:0}}));
  },[]);

  const showToast     = useCallback((msg,type="info")=>{startTransition(()=>setToast({message:msg,type}));},[]);
  const handleDeleted = useCallback((id)=>{startTransition(()=>removePost?.(id));},[removePost]);
  const triggerReset  = useCallback(()=>{startTransition(()=>setResetSig(k=>k+1));},[]);
  const handleOpenStory=useCallback((s,o)=>{
    if(openStoryViewerProp)openStoryViewerProp(s,o);
    else{setViewerData({stories:s,owner:o});setShowViewer(true);}
  },[openStoryViewerProp]);

  const handleRefresh=useCallback(async()=>{
    if(isRefreshing)return;
    scrollRef.current?.scrollTo({top:0,behavior:"smooth"});
    setIsRefreshing(true);setNewPosts(0);setApiPages(1);
    setSeed(Math.floor(Math.random()*0xffffffff));
    persistedSeenIdsRef.current = new Set();
    saveSeenIds(new Set());
    // Invalide le score cache au refresh
    invalidateScoreCache();
    prefetchTriggeredRef.current=false;currentApiPageRef.current=1;
    fetchingNextPageRef.current=false;fallbackFetchedRef.current=false;
    try{
      if(postsLoading)await new Promise(resolve=>{const maxWait=setTimeout(resolve,2000);const check=setInterval(()=>{if(!loadingRef.current){clearInterval(check);clearTimeout(maxWait);resolve();}},100);});
      const[,r]=await Promise.allSettled([fetchStories(true),refetch?.()]);
      const fp=r?.value?.posts||[];
      if(fp.length>0){latestId.current=fp[0]._id;addLivePosts(fp);}
    }catch{showToast("Erreur lors de l'actualisation","error");}
    finally{setIsRefreshing(false);triggerReset();}
  },[isRefreshing,postsLoading,refetch,fetchStories,showToast,triggerReset,addLivePosts]);

  const handleScrollProgress=useCallback(async(ratio)=>{
    if(!user||isRefreshing)return;
    const now=Date.now(),cooldownOk=now-silentLastFetchRef.current>=SILENT_COOLDOWN_MS;
    if(!cooldownOk)return;
    if(ratio>=PREFETCH_THRESHOLD&&!prefetchTriggeredRef.current){
      prefetchTriggeredRef.current=true;silentFetchingRef.current=true;silentLastFetchRef.current=now;
      try{const r=await refetch?.();addLivePosts(r?.posts||[]);}catch{}
      finally{silentFetchingRef.current=false;setTimeout(()=>{prefetchTriggeredRef.current=false;},10_000);}
    }
  },[user,isRefreshing,refetch,addLivePosts]);

  useEffect(()=>{window.addEventListener(HOME_REFRESH_EVENT,handleRefresh);return()=>window.removeEventListener(HOME_REFRESH_EVENT,handleRefresh);},[handleRefresh]);
  useEffect(()=>{const h=()=>scrollRef.current?.scrollTo({top:0,behavior:"smooth"});window.addEventListener(HOME_SCROLL_TOP_EVENT,h);return()=>window.removeEventListener(HOME_SCROLL_TOP_EVENT,h);},[]);

  useEffect(()=>{
    if(!user)return;
    const poll=async()=>{
      if(document.hidden||isRefreshing||loadingRef.current)return;
      try{
        const r=await refetch?.();const fp=r?.posts||[];
        if(!fp.length||!latestId.current)return;
        const idx=fp.findIndex(p=>p._id===latestId.current);
        const newer=idx>0?fp.slice(0,idx):[];if(!newer.length)return;
        const ids=new Set(livePostsRef.current.map(p=>p._id));
        const fresh=newer.filter(p=>!ids.has(p._id));if(!fresh.length)return;
        latestId.current=fresh[0]._id;
        const cleanFresh=fresh.map(({ _displayKey, ...rest })=>rest);
        livePostsRef.current=[...cleanFresh,...livePostsRef.current].slice(0,MAX_POOL);
        saveLivePool(livePostsRef.current);
        setNewPosts(newer.length);startTransition(()=>setLivePostsVer(v=>v+1));
      }catch{}
    };
    const id=setInterval(poll,POLL_INTERVAL);return()=>clearInterval(id);
  },[user,refetch,isRefreshing]);

  const handleShowNew=useCallback(()=>{
    setNewPosts(0);currentApiPageRef.current=1;fetchingNextPageRef.current=false;
    invalidateScoreCache(); // Invalide le cache au show-new
    startTransition(()=>{setSeed(Math.floor(Math.random()*0xffffffff));setResetSig(k=>k+1);});
  },[]);

  const PTR=72;
  useEffect(()=>{
    let raf=null,lu=0;
    const reset=()=>{pullDistRef.current=0;canPull.current=true;setPullDist(0);};
    const trigger=async()=>{if(isPulling.current)return;isPulling.current=true;setPullDist(0);canPull.current=false;await handleRefresh();isPulling.current=false;setTimeout(reset,300);};
    const onStart=(e)=>{const st=scrollRef.current?.scrollTop??0;if(st<=2&&canPull.current)touchStartY.current=e.touches[0].clientY;};
    const onMove=(e)=>{
      if(!canPull.current||!touchStartY.current)return;
      const pd=e.touches[0].clientY-touchStartY.current;
      if(pd>10){pullDistRef.current=Math.min(pd*0.33,PTR*1.5);const now=Date.now();if(now-lu>=40){lu=now;if(raf)cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>setPullDist(pullDistRef.current));}if(pd>50&&e.cancelable)try{e.preventDefault();}catch{}}
    };
    const onEnd=()=>{if(raf)cancelAnimationFrame(raf);pullDistRef.current>PTR&&!isPulling.current?trigger():reset();touchStartY.current=0;};
    const t=scrollRef.current||window;
    t.addEventListener("touchstart",onStart,{passive:true});t.addEventListener("touchmove",onMove,{passive:false});t.addEventListener("touchend",onEnd,{passive:true});
    return()=>{if(raf)cancelAnimationFrame(raf);t.removeEventListener("touchstart",onStart);t.removeEventListener("touchmove",onMove);t.removeEventListener("touchend",onEnd);};
  },[handleRefresh]);

  const apiObsFnRef=useRef(null);
  const apiObsFn=useCallback((entries)=>{
    if(!entries[0].isIntersecting||loadingRef.current||isRefreshing)return;
    startPageTrans(()=>{
      if(showMock&&mockCount<MOCK_POSTS.length)setMockCount(p=>Math.min(p+MOCK_CONFIG.loadMoreCount,MOCK_POSTS.length));
      if(hasMore){fetchNextPage();setApiPages(p=>p+1);currentApiPageRef.current++;}
    });
  },[hasMore,fetchNextPage,isRefreshing,showMock,mockCount]);
  useEffect(()=>{apiObsFnRef.current=apiObsFn;},[apiObsFn]);
  useEffect(()=>{
    const node=apiObsRef.current;if(!node)return;
    const obs=new IntersectionObserver(e=>apiObsFnRef.current?.(e),{rootMargin:"500px"});
    obs.observe(node);return()=>obs.disconnect();
  },[]); // eslint-disable-line

  useEffect(()=>{
    const _ctx=getScoringContext();
    const h=(e)=>{
      const{action,post,position=0}=e.detail||{};if(!post)return;
      const postVec=postToVec(post);
      const isControl=post._isControl||_ctx.calib.isControlGroup(post._id);
      switch(action){
        case"like":    _ctx.tracker.onLike(post,position);   _ctx.userEmb.update(postVec,1.0); _ctx.ltm.update(post,0.6); _ctx.calib.recordInteraction(isControl); break;
        case"comment": _ctx.tracker.onComment(post,position);_ctx.userEmb.update(postVec,1.2); _ctx.ltm.update(post,0.8); _ctx.calib.recordInteraction(isControl); break;
        case"share":   _ctx.tracker.onShare(post,position);  _ctx.userEmb.update(postVec,1.5); _ctx.ltm.update(post,1.0); _ctx.calib.recordInteraction(isControl); break;
        case"save":    _ctx.tracker.onSave(post,position);   _ctx.userEmb.update(postVec,0.8); _ctx.ltm.update(post,0.5); _ctx.calib.recordInteraction(isControl); break;
        case"hide": case"not_interested": _ctx.tracker.onHide(post,position);_ctx.userEmb.update(postVec,-1.5);_ctx.ltm.update(post,-0.8); break;
        case"report":  _ctx.tracker.onHide(post,position);   _ctx.userEmb.update(postVec,-2.0);_ctx.ltm.update(post,-1.0); break;
        default: break;
      }
      // Invalide le cache pour que le prochain rawPool recalcule ce post
      invalidateScoreCache();
    };
    window.addEventListener("feed:interaction",h);
    return()=>window.removeEventListener("feed:interaction",h);
  },[]);

  const bg=isDarkMode?"bg-black":"bg-white";
  const border=isDarkMode?"border-gray-800":"border-gray-200";

  return (
    <div className={`flex flex-col ${bg}`} style={{height:"100%",overflow:"hidden"}}>
      <div ref={scrollRef} data-scroll-container="true" className="flex-1 overflow-y-auto"
        style={{WebkitOverflowScrolling:"touch",scrollbarWidth:"none",msOverflowStyle:"none",willChange:"transform",transform:"translateZ(0)"}}>
        <style>{`[data-scroll-container]::-webkit-scrollbar{display:none;width:0;height:0;}[data-scroll-container]{scrollbar-width:none;-ms-overflow-style:none;}`}</style>

        <AnimatePresence>
          {(pullDist>8||isRefreshing)&&(
            <motion.div className="flex items-center justify-center py-1"
              initial={{height:0,opacity:0}} animate={{height:32,opacity:1}} exit={{height:0,opacity:0}} transition={{duration:0.15}}>
              <ArrowPathIcon className={`w-5 h-5 ${isRefreshing?"animate-spin":""} ${isDarkMode?"text-gray-500":"text-gray-400"}`}
                style={{transform:isRefreshing?undefined:`rotate(${Math.min(pullDist/PTR,1)*270}deg)`}}/>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="max-w-[470px] mx-auto">
          <div className={`${bg} border-b ${border}`} style={{height:92,overflow:"hidden"}}>
            <StoryContainer onOpenStory={handleOpenStory} onOpenCreator={()=>setShowCreator(true)} onOpenPyramid={()=>setShowPyramid(true)} isDarkMode={isDarkMode}/>
          </div>

          <Feed
            posts={filtered}
            isDarkMode={isDarkMode}
            onDeleted={handleDeleted}
            showToast={showToast}
            apiLoadMoreRef={apiObsRef}
            hasMoreFromAPI={hasMore||mockCount<MOCK_POSTS.length}
            isLoading={isLoading}
            newPostsCount={newPosts}
            onShowNewPosts={handleShowNew}
            resetSignal={resetSig}
            topOffset={TOTAL_TOP}
            suggestedUsers={suggestedUsers}
            newsArticles={newsArticles}
            onScrollProgress={handleScrollProgress}
            onNeedMorePosts={handleNeedMorePosts}
            scrollContainerRef={scrollRef}
            followingIds={followingIds}
            onPostsSeen={handlePostsSeen}
          />
        </div>
      </div>

      <Suspense fallback={null}>
        <ImmersivePyramidUniverse isOpen={showPyramid} onClose={()=>setShowPyramid(false)} stories={stories} user={user} onOpenStory={handleOpenStory} onOpenCreator={()=>{setShowPyramid(false);setShowCreator(true);}} isDarkMode={isDarkMode}/>
      </Suspense>

      <AnimatePresence>
        {showCreator&&<Suspense fallback={null}><StoryCreator onClose={()=>setShowCreator(false)}/></Suspense>}
        {showViewer &&<Suspense fallback={null}><StoryViewer stories={viewerData.stories} currentUser={user} onClose={()=>setShowViewer(false)}/></Suspense>}
        {toast&&<Toast message={toast.message} type={toast.type} onClose={()=>setToast(null)}/>}
      </AnimatePresence>
    </div>
  );
};

export default memo(Home);