// 📁 src/pages/Home/Home.jsx
// ⚡ PERF v3 — PREMIUM MEDIA LOADING
//
// NOUVEAUTÉS v3 (en plus des fixes v2) :
// ✅ MEDIA-1 : Idle prefetch — précharge les N posts suivants via requestIdleCallback
//              sans jamais bloquer le main thread
// ✅ MEDIA-2 : <link rel=prefetch> pour images, preload metadata pour vidéos
// ✅ MEDIA-3 : fetchpriority="high" sur le 1er post, "low" sur les autres
// ✅ MEDIA-4 : resolveBatch CONCURRENCE augmentée à 6 (était 4)
// ✅ MEDIA-5 : PostCard reçoit onVisible(index) → déclenche prefetch au scroll
// ✅ MEDIA-6 : IntersectionObserver dédié au prefetch (threshold 0.1, rootMargin 400px)
// ✅ MEDIA-7 : Image decode hint — décodeAsync() en avance sur les images suivantes
// ✅ MEDIA-8 : PAGE_SIZE augmenté à 15 (était 10) — plus de posts chargés d'un coup
// ✅ MEDIA-9 : resolveBatch affiche immédiatement les posts sans médias expirables,
//              puis injecte les résolus au fur et à mesure (streaming render)

import React, {
  useState, useMemo, useEffect, useRef, useCallback,
  memo, lazy, Suspense, startTransition, useTransition,
} from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  PlusCircleIcon,
  ArrowUpIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import { useDarkMode }    from "../../context/DarkModeContext";
import { useStories }     from "../../context/StoryContext";
import { usePosts }       from "../../context/PostsContext";
import { useAuth }        from "../../context/AuthContext";
import { useNews }        from "../../hooks/useNews";
import axiosClient        from "../../api/axiosClientGlobal";
import StoryContainer     from "./StoryContainer";
import SuggestedAccounts  from "./SuggestedAccounts";
import SuggestedPostPreview from "./SuggestedPostPreview";
import PostCard, { PostUploadingIndicator } from "./PostCard";
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

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const HOME_REFRESH_EVENT    = "home:refresh";
const HOME_SCROLL_TOP_EVENT = "home:scrollTop";
const AD_CONFIG             = DEFAULT_AD_CONFIG;
const MOCK_CONFIG           = DEFAULT_MOCK_CONFIG;

// ✅ MEDIA-8 : PAGE_SIZE augmenté → plus de posts rendus d'un coup
const PAGE_SIZE = 15;
const MAX_DOM_POSTS = typeof window !== "undefined" && window.innerWidth < 768 ? 30 : 60;
const MAX_POOL      = 300;

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

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "dlymdclhe";
const IMG_BASE   = `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/`;

// ✅ MEDIA-1 : Config préchargement
const PREFETCH_AHEAD     = 4;   // posts à précharger devant le viewport
const PREFETCH_IDLE_WAIT = 150; // ms avant idle prefetch si requestIdleCallback absent
const RESOLVE_CONCURRENCY = 6;  // ✅ MEDIA-4 : était 4

// ─────────────────────────────────────────────────────────────────────────────
// ✅ MEDIA PREFETCH ENGINE
// Précharge les médias des prochains posts via idle callback
// → Jamais de blocage du main thread
// ─────────────────────────────────────────────────────────────────────────────
const prefetchedUrls = new Set();

const prefetchOneUrl = (url) => {
  if (!url || typeof url !== 'string' || prefetchedUrls.has(url)) return;
  prefetchedUrls.add(url);
  try {
    const isVideo = /\.(mp4|webm|mov|avi)(\?|$)/i.test(url.split('?')[0]);
    if (isVideo) {
      // ✅ MEDIA-2 : preload metadata pour vidéos — léger, juste l'en-tête
      const vid = document.createElement('video');
      vid.src = url; vid.preload = 'metadata'; vid.muted = true;
      // On ne l'attache pas au DOM → pas de rendu, juste le fetch réseau
    } else if (url.startsWith('http') || url.startsWith('/')) {
      // ✅ MEDIA-2 : <link rel=prefetch> pour images — basse priorité réseau
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.as  = 'image';
      link.href = url;
      link.setAttribute('fetchpriority', 'low');
      document.head.appendChild(link);

      // ✅ MEDIA-7 : decode en avance pour les images (évite le jank au paint)
      if (typeof window !== 'undefined') {
        const img = new Image();
        img.src = url;
        img.decode?.().catch(() => {}); // silencieux si pas supporté
      }
    }
  } catch { /* silencieux */ }
};

const getPostAllMediaUrls = (post) => {
  if (!post) return [];
  const urls = [];
  const push = (v) => { if (v && typeof v === 'string') urls.push(v); else if (v?.url) urls.push(v.url); };
  (Array.isArray(post.media)  ? post.media  : post.media  ? [post.media]  : []).forEach(push);
  (Array.isArray(post.images) ? post.images : post.images ? [post.images] : []).forEach(push);
  if (post.videoUrl)  push(post.videoUrl);
  if (post.embedUrl)  push(post.embedUrl);
  if (post.thumbnail) push(post.thumbnail);
  return urls;
};

const scheduleIdlePrefetch = (posts, fromIndex, count = PREFETCH_AHEAD) => {
  if (!posts?.length) return;
  const targets = posts.slice(fromIndex, fromIndex + count);
  if (!targets.length) return;

  const run = () => targets.forEach(p => getPostAllMediaUrls(p).forEach(prefetchOneUrl));

  if (typeof requestIdleCallback !== 'undefined') {
    requestIdleCallback(run, { timeout: 2000 });
  } else {
    setTimeout(run, PREFETCH_IDLE_WAIT);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// URL RESOLUTION
// ─────────────────────────────────────────────────────────────────────────────
const URL_CACHE_TTL    = 80 * 60 * 1000;
const URL_CACHE_PREFIX = "murl_";
const urlCR = (k) => { try { const r=sessionStorage.getItem(URL_CACHE_PREFIX+k); if(!r) return null; const {url,exp}=JSON.parse(r); if(Date.now()>exp){sessionStorage.removeItem(URL_CACHE_PREFIX+k);return null;} return url; } catch{return null;} };
const urlCW = (k,url) => { try{sessionStorage.setItem(URL_CACHE_PREFIX+k,JSON.stringify({url,exp:Date.now()+URL_CACHE_TTL}));}catch{} };

const EXPIRABLE = [
  { name:"pexels",  test:(u)=>u.includes("videos.pexels.com/video-files/"), extractId:(u)=>u.match(/video-files\/(\d+)\//)?.[1]||null, resolve:async(id)=>{ const r=await axiosClient.get(`/videos/refresh-url?id=${id}`); return r.data?.url||r.data?.videoUrl||null; } },
  { name:"pixabay", test:(u)=>/cdn\.pixabay\.com\/video\/\d{4}\/\d{2}\/\d{2}\//.test(u), extractId:(u)=>u.match(/\/(\d+)-\d+_/)?.[1]||null, resolve:async(id)=>{ const r=await axiosClient.get(`/api/proxy/video?id=${id}&source=pixabay`); return r.data?.url||r.data?.videoUrl||null; } },
];
const DEAD_HOSTS    = ["youtube.com/watch","youtu.be/","dailymotion.com/video","tiktok.com/@"];
const expSrc        = (u) => typeof u==="string"?EXPIRABLE.find(s=>s.test(u))||null:null;
const isDead        = (u) => DEAD_HOSTS.some(p=>u.includes(p));
const isStructValid = (u) => { if(!u||typeof u!=="string"||u.length<10)return false; if(u.startsWith("data:")||u.startsWith("blob:")||u.startsWith("/"))return true; try{const x=new URL(u);return!!(x.hostname&&x.pathname&&x.pathname!=="/")}catch{return false;} };
const getMediaUrls  = (p) => { const all=[...(Array.isArray(p.media)?p.media:p.media?[p.media]:[]),...(Array.isArray(p.images)?p.images:p.images?[p.images]:[]),p.videoUrl,p.embedUrl,p.thumbnail]; return all.filter(Boolean).map(m=>typeof m==="string"?m:m?.url).filter(Boolean); };
const getResolvable = (p) => { if(p?.externalId){for(const s of EXPIRABLE){const id=s.extractId(p.externalId)||(s.name==="pexels"&&p.externalId.match(/^pexels_(\d+)$/)?.[1])||null;if(id)return{source:s,id};} if(/^\d+$/.test(p.externalId))return{source:EXPIRABLE[0],id:p.externalId};} for(const url of[p?.videoUrl,p?.embedUrl].filter(Boolean)){const s=expSrc(url);if(s){const id=s.extractId(url);if(id)return{source:s,id};}} return null; };
const hasExpirable  = (p) => getMediaUrls(p).some(u=>!!expSrc(u));

const resolvePost = async (post) => {
  try {
    const expUrls = getMediaUrls(post).filter(u=>!!expSrc(u));
    if (!expUrls.length) {
      const r=getResolvable(post); if(!r)return post;
      const c=urlCR(`${r.source.name}_${r.id}`); if(c)return{...post,videoUrl:c,_resolved:true};
      const f=await r.source.resolve(r.id); if(!f)return null;
      urlCW(`${r.source.name}_${r.id}`,f); return{...post,videoUrl:f,_resolved:true};
    }
    const res = await Promise.all(expUrls.map(async(url)=>{
      const s=expSrc(url),id=s.extractId(url); if(!id)return null;
      const k=`${s.name}_${id}`,c=urlCR(k); if(c)return c;
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
  } catch{return null;}
};

// ✅ MEDIA-4 : Concurrence augmentée à 6
// ✅ MEDIA-9 : Callback onPartialResult pour streaming render
const resolveBatch = async (posts, onPartialResult) => {
  const results  = new Array(posts.length).fill(null);
  let   i        = 0;
  let   resolved = 0;

  const worker = async () => {
    while (i < posts.length) {
      const idx = i++;
      results[idx] = hasExpirable(posts[idx]) ? await resolvePost(posts[idx]) : posts[idx];
      resolved++;

      // ✅ MEDIA-9 : notifie au fur et à mesure — streaming render sans attendre la fin
      if (onPartialResult && resolved % 3 === 0) {
        onPartialResult(results.filter(Boolean));
      }
    }
  };

  await Promise.all(Array.from({ length: RESOLVE_CONCURRENCY }, worker));
  return results.filter(Boolean);
};

// ─────────────────────────────────────────────────────────────────────────────
// SHUFFLE / FEED
// ─────────────────────────────────────────────────────────────────────────────
const seededShuffle = (arr, seed) => {
  const r=[...arr]; let s=seed>>>0;
  for(let i=r.length-1;i>0;i--){s=(Math.imul(s^(s>>>15),s|1)^(s+Math.imul(s^(s>>>7),s|61)))>>>0;const j=s%(i+1);[r[i],r[j]]=[r[j],r[i]];}
  return r;
};
const mixBlocks = (real, bots) => {
  if(!bots.length)return real; if(!real.length)return bots;
  const result=[];let ri=0,bi=0;
  while(ri<real.length||bi<bots.length){
    const block=[];let bc=0;
    while(block.length<MIX_BLOCK){const cb=bi<bots.length&&bc<MIX_MAX_BOTS,cr=ri<real.length;if(!cb&&!cr)break;if(cb&&cr){block.push(bc<Math.floor((block.length*MIX_MAX_BOTS)/MIX_BLOCK)?{...bots[bi++],_isBot:true}&&(bc++,block[block.length-1]):real[ri++]);}else if(cr){block.push(real[ri++]);}else{block.push({...bots[bi++],_isBot:true});bc++;}}
    const[head,...tail]=block;result.push(head,...tail.sort(()=>Math.random()-.5));
  }
  return result;
};
const buildFeed = (posts, bots, seed) => {
  const now=Date.now(),age=(p)=>{const d=p.createdAt||p.date||p.publishedAt;return d?now-new Date(d).getTime():Infinity;};
  const bucket=(arr)=>({fresh:arr.filter(p=>age(p)<RECENT_6H),recent:arr.filter(p=>age(p)>=RECENT_6H&&age(p)<RECENT_24H),medium:arr.filter(p=>age(p)>=RECENT_24H&&age(p)<RECENT_72H),old:arr.filter(p=>age(p)>=RECENT_72H)});
  const rb=bucket(posts),bb=bucket(bots);
  return mixBlocks(
    [...seededShuffle(rb.fresh,seed^0x1111),...seededShuffle(rb.recent,seed^0x2222),...seededShuffle(rb.medium,seed^0x3333),...seededShuffle(rb.old,seed^0x4444)],
    [...seededShuffle(bb.fresh,seed^0xaaaa),...seededShuffle(bb.recent,seed^0xbbbb),...seededShuffle(bb.medium,seed^0xcccc),...seededShuffle(bb.old,seed^0xdddd)]
  );
};

const _pCache=new WeakMap();
const stablePost=(p)=>{if(_pCache.has(p))return _pCache.get(p);const s=p._isMock===false?p:{...p,_isMock:false};_pCache.set(p,s);return s;};

// ─────────────────────────────────────────────────────────────────────────────
// SKELETON
// ─────────────────────────────────────────────────────────────────────────────
const FeedSkeleton = memo(({ isDarkMode }) => {
  const bg1=isDarkMode?"#1c1c1c":"#f0f0f0",bg2=isDarkMode?"#2a2a2a":"#e4e4e4";
  return (
    <>
      <style>{`@keyframes igs{0%{background-position:-400px 0}100%{background-position:400px 0}}.igs{background:linear-gradient(90deg,${bg1} 25%,${bg2} 50%,${bg1} 75%);background-size:800px 100%;animation:igs 1.5s ease-in-out infinite}`}</style>
      {[0,1,2].map(i=>(
        <div key={i} className={`${isDarkMode?"bg-black":"bg-white"} border-b ${isDarkMode?"border-gray-800":"border-gray-100"}`}>
          <div className="flex items-center gap-2.5 px-3 py-2.5">
            <div className="igs w-9 h-9 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="igs h-3 rounded-full w-32" />
              <div className="igs h-2.5 rounded-full w-20" />
            </div>
          </div>
          <div className="igs w-full" style={{aspectRatio:"1/1"}} />
          <div className="flex gap-2 px-3 py-2.5">
            {[0,1,2].map(j=><div key={j} className="igs w-7 h-7 rounded" />)}
          </div>
          <div className="px-3 pb-3 space-y-2">
            <div className="igs h-3 rounded-full w-28" />
            <div className="igs h-3 rounded-full w-full" />
            <div className="igs h-3 rounded-full w-2/3" />
          </div>
        </div>
      ))}
    </>
  );
});
FeedSkeleton.displayName="FeedSkeleton";

// ─────────────────────────────────────────────────────────────────────────────
// NEW POSTS BANNER
// ─────────────────────────────────────────────────────────────────────────────
const NewBanner = memo(({ count, onClick, topOffset }) => (
  <AnimatePresence>
    {count>0 && (
      <motion.div className="sticky z-20 flex justify-center pb-2 pointer-events-none"
        style={{top:topOffset+8}}
        initial={{opacity:0,y:-16,scale:0.9}} animate={{opacity:1,y:0,scale:1}}
        exit={{opacity:0,y:-16,scale:0.9}} transition={{type:"spring",stiffness:380,damping:28}}>
        <button onClick={onClick}
          className="pointer-events-auto flex items-center gap-1.5 px-4 py-2 rounded-full shadow-lg text-[13px] font-semibold bg-gray-900 dark:bg-white text-white dark:text-gray-900 select-none active:scale-95 transition-transform"
          style={{WebkitTapHighlightColor:"transparent"}}>
          <ArrowUpIcon className="w-3.5 h-3.5" />
          {count===1?"1 nouveau post":`${count} nouveaux posts`}
        </button>
      </motion.div>
    )}
  </AnimatePresence>
));
NewBanner.displayName="NewBanner";

// ─────────────────────────────────────────────────────────────────────────────
// LOOP DIVIDER
// ─────────────────────────────────────────────────────────────────────────────
const LoopDivider = memo(({ isDarkMode }) => (
  <div className={`flex items-center gap-3 px-4 py-4 ${isDarkMode?"bg-black":"bg-white"}`}>
    <div className={`flex-1 h-px ${isDarkMode?"bg-gray-800":"bg-gray-200"}`} />
    <span className={`text-[11px] font-medium px-3 py-1 rounded-full ${isDarkMode?"bg-gray-900 text-gray-500 border border-gray-800":"bg-gray-50 text-gray-400 border border-gray-200"}`}>
      Vous avez tout vu • Recommencer
    </span>
    <div className={`flex-1 h-px ${isDarkMode?"bg-gray-800":"bg-gray-200"}`} />
  </div>
));
LoopDivider.displayName="LoopDivider";

// ─────────────────────────────────────────────────────────────────────────────
// TOAST
// ─────────────────────────────────────────────────────────────────────────────
const Toast = memo(({ message, type="info", onClose }) => {
  useEffect(()=>{const t=setTimeout(onClose,3000);return()=>clearTimeout(t);},[onClose]);
  return <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-full shadow-xl text-[13px] font-medium text-white whitespace-nowrap ${type==="error"?"bg-red-500":type==="success"?"bg-green-500":"bg-gray-900"}`}>{message}</div>;
});
Toast.displayName="Toast";

// ─────────────────────────────────────────────────────────────────────────────
// NEWS CARD
// ─────────────────────────────────────────────────────────────────────────────
const ALLOWED_CATEGORIES = new Set(["genieCivil", "technologie", "environnement"]);
const CATEGORY_META = {
  genieCivil:    { label: "🏗️ BTP",  gradient: "from-orange-500 to-red-500"    },
  technologie:   { label: "💻 Tech",  gradient: "from-green-500 to-emerald-500" },
  environnement: { label: "🌱 Éco",   gradient: "from-teal-500 to-green-600"   },
  general:       { label: "📰 Actu",  gradient: "from-gray-500 to-gray-600"    },
};
const getCategoryMeta = (cat) => CATEGORY_META[cat] || CATEGORY_META.general;
const fmtDate = (d) => {
  if (!d) return "";
  const h = Math.floor((Date.now() - new Date(d)) / 3600000);
  if (h < 1) return "À l'instant";
  if (h < 24) return `Il y a ${h}h`;
  if (h < 48) return "Hier";
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
};

const NewsCard = memo(({ article, isDarkMode, onClick }) => {
  const [imgErr, setImgErr] = useState(false);
  if (!ALLOWED_CATEGORIES.has(article.category)) return null;
  const meta = getCategoryMeta(article.category);
  return (
    <div
      onClick={onClick}
      className={`mx-3 my-2 rounded-2xl overflow-hidden cursor-pointer active:scale-[0.98] transition-transform border ${
        isDarkMode ? "bg-gray-900 border-gray-800" : "bg-white border-gray-100"
      }`}
      style={{ boxShadow: isDarkMode ? "0 2px 12px rgba(0,0,0,0.4)" : "0 2px 12px rgba(0,0,0,0.07)" }}
    >
      {article.image && !imgErr ? (
        <div className="relative w-full overflow-hidden" style={{ height: 180 }}>
          <img src={article.image} alt={article.title} className="w-full h-full object-cover" loading="lazy" onError={() => setImgErr(true)} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className={`absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-bold text-white bg-gradient-to-r ${meta.gradient}`}>{meta.label}</div>
          <div className={`absolute top-3 right-3 px-2.5 py-1 rounded-full text-[10px] font-semibold ${isDarkMode?"bg-black/60 text-gray-300":"bg-white/80 text-gray-600"}`}>Actualités</div>
        </div>
      ) : (
        <div className={`w-full flex items-center justify-center bg-gradient-to-br ${meta.gradient}`} style={{ height: 80 }}>
          <span className="text-white text-2xl">📰</span>
        </div>
      )}
      <div className="px-4 pt-3 pb-4">
        <p className={`text-[15px] font-bold leading-snug line-clamp-2 mb-1.5 ${isDarkMode?"text-white":"text-gray-900"}`}>{article.title}</p>
        {article.description && <p className={`text-[13px] leading-relaxed line-clamp-2 mb-2 ${isDarkMode?"text-gray-400":"text-gray-500"}`}>{article.description}</p>}
        <div className={`flex items-center gap-1.5 text-[11px] ${isDarkMode?"text-gray-500":"text-gray-400"}`}>
          <span className="font-semibold text-orange-500">{article.source}</span>
          {article.publishedAt && (<><span>·</span><span>{fmtDate(article.publishedAt)}</span></>)}
          <span className="ml-auto font-medium text-orange-400">Lire →</span>
        </div>
      </div>
    </div>
  );
});
NewsCard.displayName = "NewsCard";

// ─────────────────────────────────────────────────────────────────────────────
// ✅ MEDIA-5 : PostCardWrapper — détecte la visibilité du post via IO
// et déclenche le prefetch des posts suivants
// ─────────────────────────────────────────────────────────────────────────────
const PostCardWrapper = memo(({ post, index, onVisible, ...rest }) => {
  const wrapRef = useRef(null);
  const notified = useRef(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || notified.current) return;

    // ✅ MEDIA-6 : IO dédié au prefetch — rootMargin large pour anticiper
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !notified.current) {
          notified.current = true;
          onVisible?.(index);
          obs.disconnect();
        }
      },
      { rootMargin: '400px 0px', threshold: 0.01 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [index, onVisible]);

  return (
    <div ref={wrapRef}>
      <PostCard
        post={post}
        // ✅ MEDIA-3 : fetchpriority high uniquement sur le 1er post (LCP)
        priority={index === 0}
        {...rest}
      />
    </div>
  );
});
PostCardWrapper.displayName = 'PostCardWrapper';

// ─────────────────────────────────────────────────────────────────────────────
// FEED
// ─────────────────────────────────────────────────────────────────────────────
const Feed = ({
  posts, isDarkMode, onDeleted, showToast,
  apiLoadMoreRef, hasMoreFromAPI,
  isLoading, newPostsCount, onShowNewPosts, apiFullyLoaded,
  resetSignal, topOffset, suggestedUsers, newsArticles = [],
}) => {
  const [displayed,    setDisplayed]   = useState([]);
  const [loopBounds,   setLoopBounds]  = useState([]);
  const [poolExhausted, setPoolExhausted] = useState(false);

  const sentinelRef = useRef(null);
  const loopRef     = useRef(0);
  const cursorRef   = useRef(0);
  const postsRef    = useRef(posts);
  const accRef      = useRef([]);
  const prevReset   = useRef(resetSignal);
  const prevAnchor  = useRef(null);
  const prevLen     = useRef(0);
  const loadingRef  = useRef(false);

  useEffect(() => { postsRef.current = posts; }, [posts]);

  const anchor = posts.length === 0 ? null : (posts[0]?._id ?? null);

  const initFeed = useCallback((pool) => {
    loopRef.current    = 0;
    cursorRef.current  = 0;
    loadingRef.current = false;
    const count  = Math.min(PAGE_SIZE, pool.length);
    const tagged = pool.slice(0, count).map((p, i) => ({
      ...p, _displayKey: `p${i}_l0_${p._id}`,
    }));
    cursorRef.current = count;
    accRef.current    = tagged;
    prevLen.current   = pool.length;
    setDisplayed(tagged);
    setLoopBounds([]);
    setPoolExhausted(pool.length > 0 && pool.length < PAGE_SIZE);

    // ✅ MEDIA-1 : précharge immédiatement les médias du prochain batch
    scheduleIdlePrefetch(pool, 0, PAGE_SIZE + PREFETCH_AHEAD);
  }, []);

  useEffect(() => {
    const resetChanged  = resetSignal !== prevReset.current;
    const anchorChanged = anchor !== prevAnchor.current;
    prevReset.current  = resetSignal;
    prevAnchor.current = anchor;

    if (!posts.length) {
      accRef.current = []; prevLen.current = 0;
      setDisplayed([]); setLoopBounds([]); setPoolExhausted(false);
      return;
    }
    if (resetChanged || anchorChanged) { initFeed(posts); return; }
    if (posts.length !== prevLen.current) {
      prevLen.current  = posts.length;
      postsRef.current = posts;
      if (posts.length >= PAGE_SIZE) setPoolExhausted(false);
      setTimeout(() => { if (postsRef.current.length > cursorRef.current) loadingRef.current = false; }, 0);
    }
  }, [resetSignal, anchor, posts.length, initFeed]); // eslint-disable-line

  useEffect(() => { if (posts.length) initFeed(posts); }, []); // eslint-disable-line

  const loadMore = useCallback(() => {
    if (loadingRef.current) return;
    const pool = postsRef.current;
    if (!pool.length) return;

    if (cursorRef.current >= pool.length) {
      if (pool.length >= PAGE_SIZE) {
        cursorRef.current = 0; loopRef.current++; setPoolExhausted(false);
      } else { setPoolExhausted(true); return; }
    }

    // ✅ FIX : pose le verrou AVANT le try, reset DANS le finally
    loadingRef.current = true;
    try {
      const cursor   = cursorRef.current;
      const end      = Math.min(cursor + PAGE_SIZE, pool.length);
      let   raw      = pool.slice(cursor, end);
      let   boundary = null;

      if (raw.length < PAGE_SIZE && pool.length >= PAGE_SIZE) {
        const remaining = PAGE_SIZE - raw.length;
        raw      = [...raw, ...pool.slice(0, remaining)];
        boundary = accRef.current.length + (end - cursor);
        cursorRef.current = remaining;
        loopRef.current++;
      } else {
        cursorRef.current = end;
      }

      const ln     = loopRef.current;
      const offset = accRef.current.length;
      const batch  = raw.map((p, i) => ({
        ...p, _displayKey: `p${offset + i}_l${ln}_${p._id}`,
        ...(boundary !== null && i === (end - cursor) ? { _loopStart: true } : {}),
      }));

      const next = accRef.current.concat(batch);
      accRef.current = next.length > MAX_DOM_POSTS ? next.slice(next.length - MAX_DOM_POSTS) : next;

      if (boundary !== null) setLoopBounds(b => [...b, boundary]);
      setDisplayed(accRef.current);

      if (cursorRef.current >= pool.length && pool.length < PAGE_SIZE) setPoolExhausted(true);
    } finally {
      // ✅ FIX : reset immédiat — pas besoin d'attendre le re-render React
      loadingRef.current = false;
    }
  }, []); // ✅ FIX : deps vides — loadMore ne change jamais, utilise les refs

  // ✅ FIX : ref stable vers loadMore — l'IO ne se reconnecte JAMAIS
  const loadMoreRef = useRef(loadMore);
  useEffect(() => { loadMoreRef.current = loadMore; }, [loadMore]);

  useEffect(() => {
    const el = sentinelRef.current; if (!el) return;
    const root = el.closest("[data-scroll-container]") || null;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) loadMoreRef.current(); },
      { root, rootMargin: "800px", threshold: 0 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []); // ✅ FIX : deps vides — monté une seule fois au mount

  useEffect(() => {
    const scrollEl = sentinelRef.current?.closest("[data-scroll-container]") || window;
    let lastCall = 0;
    const onScroll = () => {
      const now = Date.now();
      if (now - lastCall < 100) return;
      lastCall = now;
      const el = sentinelRef.current; if (!el) return;
      const rect = el.getBoundingClientRect();
      if (rect.top < (window.innerHeight || document.documentElement.clientHeight) + 1200) loadMoreRef.current();
    };
    scrollEl.addEventListener("scroll", onScroll, { passive: true });
    const t = setTimeout(onScroll, 200);
    return () => { scrollEl.removeEventListener("scroll", onScroll); clearTimeout(t); };
  }, []); // ✅ FIX : deps vides, utilise loadMoreRef

  useEffect(() => { if (posts.length > 0 && cursorRef.current < posts.length) loadMoreRef.current(); }, [posts.length]); // eslint-disable-line

  // ✅ MEDIA-5 : prefetch déclenché par la visibilité du post, jamais dans loadMore
  // (évite de perturber le cycle loadMore avec des side-effects async)
  const handlePostVisible = useCallback((index) => {
    scheduleIdlePrefetch(postsRef.current, index + 1, PREFETCH_AHEAD);
  }, []);

  const [selectedArticle, setSelectedArticle] = useState(null);
  const loopSet = useMemo(() => new Set(loopBounds), [loopBounds]);

  if (isLoading && !posts.length) return <FeedSkeleton isDarkMode={isDarkMode} />;
  if (!isLoading && !posts.length) return (
    <div className="flex flex-col items-center justify-center py-24 gap-3">
      <div className={`w-16 h-16 rounded-full flex items-center justify-center ${isDarkMode?"bg-gray-900":"bg-gray-100"}`}>
        <svg className={`w-8 h-8 ${isDarkMode?"text-gray-600":"text-gray-300"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
          <rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>
        </svg>
      </div>
      <p className={`text-sm ${isDarkMode?"text-gray-600":"text-gray-400"}`}>Aucune publication</p>
    </div>
  );

  return (
    <>
      <NewBanner count={newPostsCount} onClick={onShowNewPosts} topOffset={topOffset} />

      {displayed.map((post, index) => {
        const newsSlot = index > 0 && index % NEWS_EVERY === 0 ? Math.floor(index / NEWS_EVERY) - 1 : -1;
        const newsItem = newsSlot >= 0 && newsArticles.length > 0
          ? newsArticles[newsSlot % newsArticles.length]
          : null;

        return (
          <div key={post._displayKey || post._id}>
            {loopSet.has(index) && apiFullyLoaded && <LoopDivider isDarkMode={isDarkMode} />}

            {/* ✅ MEDIA-5 : PostCardWrapper détecte la visibilité → prefetch */}
            <PostCardWrapper
              post={post}
              index={index}
              onVisible={handlePostVisible}
              onDeleted={onDeleted}
              showToast={showToast}
              mockPost={!!post._isMock || !!post.isMockPost}
              priority={index === 0}
            />

            {newsItem && (
              <NewsCard
                key={`news-${newsSlot}`}
                article={newsItem}
                isDarkMode={isDarkMode}
                onClick={() => setSelectedArticle(newsItem)}
              />
            )}

            {index > 0 && index % SUGGEST_PROFILE_EVERY === 0 && (
              <SuggestedPostPreview
                key={`spp-${index}`}
                isDarkMode={isDarkMode}
                userPool={suggestedUsers}
                slotIndex={Math.floor(index / SUGGEST_PROFILE_EVERY)}
              />
            )}
            {index > 0 && index % SUGGEST_ACCOUNTS_EVERY === 0 && index % SUGGEST_PROFILE_EVERY !== 0 && (
              <SuggestedAccounts
                key={`sa-${index}`}
                isDarkMode={isDarkMode}
                instanceId={Math.floor(index / SUGGEST_ACCOUNTS_EVERY)}
              />
            )}
          </div>
        );
      })}

      <div ref={sentinelRef} className="h-10 flex items-center justify-center" aria-hidden="true">
        {displayed.length > 0 && !poolExhausted && (
          <ArrowPathIcon className={`w-4 h-4 animate-spin ${isDarkMode ? "text-gray-700" : "text-gray-300"}`} />
        )}
        {poolExhausted && displayed.length > 0 && (
          <span className={`text-xs tracking-widest ${isDarkMode ? "text-gray-700" : "text-gray-400"}`}>• • •</span>
        )}
      </div>

      {hasMoreFromAPI && <div ref={apiLoadMoreRef} className="h-1" aria-hidden="true" />}

      {selectedArticle && (
        <Suspense fallback={null}>
          <ArticleReaderModal
            article={selectedArticle}
            isOpen={!!selectedArticle}
            onClose={() => setSelectedArticle(null)}
          />
        </Suspense>
      )}
    </>
  );
};
Feed.displayName = "Feed";

// ─────────────────────────────────────────────────────────────────────────────
// HOME
// ─────────────────────────────────────────────────────────────────────────────
const Home = ({ openStoryViewer: openStoryViewerProp, searchQuery="" }) => {
  const { isDarkMode } = useDarkMode();
  const { fetchStories, stories=[] } = useStories();
  const { posts:rawPosts=[], fetchNextPage, hasMore, loading:postsLoading, refetch, removePost } = usePosts()||{};
  const { user } = useAuth();
  const navigate = useNavigate();

  const [,startPageTrans] = useTransition();
  const [showCreator,    setShowCreator]    = useState(false);
  const [showViewer,     setShowViewer]     = useState(false);
  const [viewerData,     setViewerData]     = useState({stories:[],owner:null});
  const [isRefreshing,   setIsRefreshing]   = useState(false);
  const [showPyramid,    setShowPyramid]    = useState(false);
  const [toast,          setToast]          = useState(null);
  const [mockCount,      setMockCount]      = useState(MOCK_CONFIG.initialCount);
  const [pullDist,       setPullDist]       = useState(0);
  const [newPosts,       setNewPosts]       = useState(0);
  const [resetSig,       setResetSig]       = useState(0);
  const [apiPages,       setApiPages]       = useState(1);
  const [seed,           setSeed]           = useState(()=>Math.floor(Math.random()*0xffffffff));
  const [suggestedUsers, setSuggestedUsers] = useState([]);

  const livePostsRef   = useRef([]);
  const [livePostsVer, setLivePostsVer]  = useState(0);

  // ✅ MEDIA-9 : streaming render — resolved se met à jour au fur et à mesure
  const [resolved, setResolved] = useState([]);

  const scrollRef   = useRef(null);
  const apiObsRef   = useRef(null);
  const loadingRef  = useRef(false);
  const mockGenRef  = useRef(false);
  const touchStartY = useRef(0);
  const isPulling   = useRef(false);
  const canPull     = useRef(true);
  const pullDistRef = useRef(0);
  const latestId    = useRef(null);
  const sugFetched  = useRef(false);
  const waveTimer   = useRef(null);
  const fallbackFetchedRef = useRef(false);
  const fallbackLastRun    = useRef(0);

  const HEADER_H  = 52;
  const STORIES_H = 92;
  const TOTAL_TOP = HEADER_H + STORIES_H;
  const showMock  = MOCK_CONFIG.enabled;

  const { articles: newsGC }   = useNews({ maxArticles: 4, category: "genieCivil",    autoFetch: !!user, enabled: !!user }) || {};
  const { articles: newsTech } = useNews({ maxArticles: 2, category: "technologie",   autoFetch: !!user, enabled: !!user }) || {};
  const { articles: newsEnv }  = useNews({ maxArticles: 2, category: "environnement", autoFetch: !!user, enabled: !!user }) || {};

  const newsGCLen   = newsGC?.length   ?? 0;
  const newsTechLen = newsTech?.length ?? 0;
  const newsEnvLen  = newsEnv?.length  ?? 0;
  const newsArticles = useMemo(() => {
    const all  = [...(newsGC || []), ...(newsTech || []), ...(newsEnv || [])];
    const seen = new Set();
    return all.filter(a => { const key = a._id || a.id || a.url; if (seen.has(key)) return false; seen.add(key); return true; });
  }, [newsGCLen, newsTechLen, newsEnvLen]); // eslint-disable-line

  const addLivePosts = useCallback((newPostsList) => {
    const ids = new Set(livePostsRef.current.map(p => p._id));
    const fresh = newPostsList.filter(p => p?._id && !ids.has(p._id));
    if (!fresh.length) return false;
    livePostsRef.current = [...livePostsRef.current, ...fresh].slice(0, MAX_POOL);
    startTransition(() => setLivePostsVer(v => v + 1));
    return true;
  }, []);

  const replaceLivePosts = useCallback((newPostsList) => {
    livePostsRef.current = newPostsList.slice(0, MAX_POOL);
    startTransition(() => setLivePostsVer(v => v + 1));
  }, []);

  useEffect(() => {
    if (!user || sugFetched.current) return;
    sugFetched.current = true;
    (async () => {
      try {
        const { data } = await axiosClient.get("/users/suggestions?limit=20");
        const list = Array.isArray(data) ? data : (data?.users || data?.suggestions || []);
        setSuggestedUsers(list.filter(u => u?._id && u._id !== user._id));
      } catch {
        try {
          const { data } = await axiosClient.get("/users?limit=20&sort=followers");
          const list = Array.isArray(data) ? data : (data?.users || []);
          setSuggestedUsers(list.filter(u => u?._id && u._id !== user._id).slice(0, 16));
        } catch { setSuggestedUsers([]); }
      }
    })();
  }, [user]);

  const fetchFallbackPosts = useCallback(async () => {
    if (!user) return;
    const now = Date.now();
    if (now - fallbackLastRun.current < FALLBACK_COOLDOWN_MS) return;
    if (fallbackFetchedRef.current) return;
    fallbackFetchedRef.current = true;
    fallbackLastRun.current    = now;
    try {
      const cachedProfilePosts = readAllCachedProfilePosts();
      if (cachedProfilePosts.length > 0) {
        addLivePosts(cachedProfilePosts);
        const existingReal = livePostsRef.current.filter(p => !p._isMock && !p.isMockPost).length;
        if (existingReal >= FALLBACK_THRESHOLD * 2) return;
      }
      let userPool = suggestedUsers.length > 0
        ? suggestedUsers
        : await (async () => {
            try { const { data } = await axiosClient.get("/users?limit=30&sort=followers"); return Array.isArray(data) ? data : (data?.users || []); }
            catch { return []; }
          })();
      if (!userPool.length) return;
      const shuffled = [...userPool].sort(() => Math.random() - 0.5);
      const probeTarget = shuffled[0], targets = shuffled.slice(1, MAX_FALLBACK_USERS + 1);
      if (!window.__fallbackPostsRoutePromise__) {
        const probeUid = probeTarget?._id || probeTarget?.id;
        window.__fallbackPostsRoutePromise__ = probeUid
          ? (async () => {
              try { await axiosClient.get(`/users/${probeUid}/posts?limit=1&page=1`); return "user_posts"; }
              catch (e1) {
                if (e1.response?.status !== 404) return "user_posts";
                try { await axiosClient.get(`/posts?userId=${probeUid}&limit=1`); return "posts_filter"; }
                catch (e2) {
                  if (e2.response?.status !== 404) return "posts_filter";
                  try { await axiosClient.get(`/posts/user/${probeUid}?limit=1`); return "posts_user"; }
                  catch { return "none"; }
                }
              }
            })()
          : Promise.resolve("none");
        window.__fallbackPostsRoutePromise__.catch(() => { delete window.__fallbackPostsRoutePromise__; });
      }
      const route = await window.__fallbackPostsRoutePromise__;
      if (route === "none") return;
      const buildUrl = (uid) => {
        if (route === "user_posts")   return `/users/${uid}/posts?limit=${FALLBACK_POSTS_LIMIT}&page=1`;
        if (route === "posts_filter") return `/posts?userId=${uid}&limit=${FALLBACK_POSTS_LIMIT}`;
        if (route === "posts_user")   return `/posts/user/${uid}?limit=${FALLBACK_POSTS_LIMIT}`;
        return null;
      };
      const allTargets = [probeTarget, ...targets].filter(Boolean);
      const results = await Promise.allSettled(
        allTargets.map(async (u) => {
          const uid = u._id || u.id; if (!uid) return [];
          const url = buildUrl(uid); if (!url) return [];
          try { const { data } = await axiosClient.get(url); const posts = Array.isArray(data) ? data : (data?.posts || data?.data || []); return posts.map(p => ({ ...p, _fromFallback: true })); }
          catch (e) { if (e.response?.status === 404) delete window.__fallbackPostsRoutePromise__; return []; }
        })
      );
      const allFallback = results.filter(r => r.status === "fulfilled").flatMap(r => r.value).filter(p => p?._id);
      if (allFallback.length) addLivePosts(allFallback);
    } catch {}
  }, [user, suggestedUsers, addLivePosts]);

  const fetchFallbackRef = useRef(fetchFallbackPosts);
  useEffect(() => { fetchFallbackRef.current = fetchFallbackPosts; }, [fetchFallbackPosts]);

  useEffect(() => {
    if (!user || postsLoading) return;
    const realCount = livePostsRef.current.filter(p => !p._isMock && !p.isMockPost && !p._fromFallback).length;
    if (realCount < FALLBACK_THRESHOLD) fetchFallbackRef.current();
  }, [livePostsVer, postsLoading, user]);

  useEffect(() => {
    if (!user) return;
    const handleProfileCached = () => {
      const realCount = livePostsRef.current.filter(p => !p._isMock && !p.isMockPost && !p._fromFallback && !p._fromProfileCache).length;
      if (realCount < FALLBACK_THRESHOLD) { const cached = readAllCachedProfilePosts(); if (cached.length > 0) addLivePosts(cached); }
    };
    window.addEventListener("profilePostsCached", handleProfileCached);
    return () => window.removeEventListener("profilePostsCached", handleProfileCached);
  }, [user, addLivePosts]);

  useEffect(() => {
    if (!rawPosts.length) return;
    const ids = new Set(rawPosts.map(p => p._id));
    const filtered = livePostsRef.current.filter(p => !ids.has(p._id));
    livePostsRef.current = [...filtered, ...rawPosts].slice(0, MAX_POOL);
    startTransition(() => setLivePostsVer(v => v + 1));
  }, [rawPosts]);

  const isValidPost = useCallback((p) => {
    if (!p?._id) return false;
    if (p._isMock || p.isMockPost || p._id?.startsWith("post_")) return true;
    const u = p.user || p.author || {};
    if (u.isBanned || u.isDeleted || ["deleted","banned"].includes(u.status)) return false;
    if (!u._id && !u.id && !p.userId && !p.author?._id) return false;
    const media = getMediaUrls(p), hasText = !!(p.content || p.contenu);
    if (!media.length && hasText)  return true;
    if (!media.length && !hasText) return false;
    if (media.every(isDead)) return false;
    const exp = media.filter(u => !!expSrc(u));
    if (exp.length > 0) { const r = getResolvable(p); if (!r && exp.length === media.length) return false; return true; }
    if (!media.filter(isStructValid).length && !hasText) return false;
    return true;
  }, []);

  const rawPool = useMemo(() => {
    const live = livePostsRef.current;
    const dedup = (arr) => { const s = new Set(); return arr.filter(p => { if (s.has(p._id)) return false; s.add(p._id); return true; }); };
    const valid = dedup(live.filter(p => isValidPost(p)));
    const vReal = valid.filter(p => !p.isBot && !p.user?.isBot);
    const vBots = valid.filter(p =>  p.isBot ||  p.user?.isBot);
    if (!showMock) return buildFeed(vReal, vBots, seed);
    const mocks = dedup(MOCK_POSTS.slice(0, mockCount));
    if (MOCK_CONFIG.mixWithRealPosts && vReal.length > 0) return buildFeed(vReal.map(stablePost), [...vBots.map(stablePost), ...mocks], seed);
    return seededShuffle(mocks, seed);
  }, [livePostsVer, mockCount, showMock, isValidPost, seed]); // eslint-disable-line

  // ✅ MEDIA-9 : résolution en streaming
  // 1. Affiche immédiatement les posts sans médias expirables
  // 2. Au fur et à mesure de la résolution, injecte les résolus
  // → L'user voit du contenu instantanément, les vidéos arrivent progressivement
  useEffect(() => {
    if (!rawPool.length) { setResolved([]); return; }
    let cancelled = false;

    const immediate = rawPool.filter(p => !hasExpirable(p));
    const exp       = rawPool.filter(p =>  hasExpirable(p));

    // Affiche immédiatement ce qui n'a pas besoin de résolution
    startTransition(() => setResolved(immediate));

    if (!exp.length) return;

    // Précharge dès maintenant les médias immediats
    scheduleIdlePrefetch(immediate, 0, PREFETCH_AHEAD);

    // ✅ MEDIA-9 : callback de streaming — inject les résolus toutes les 3 résolutions
    const resolvedMap = new Map(immediate.map(p => [p._id, p]));

    resolveBatch(exp, (partials) => {
      if (cancelled) return;
      partials.forEach(p => resolvedMap.set(p._id, p));
      const ordered = rawPool.map(p => resolvedMap.get(p._id)).filter(Boolean);
      startTransition(() => setResolved(ordered));
    }).then(finalResolved => {
      if (cancelled) return;
      finalResolved.forEach(p => resolvedMap.set(p._id, p));
      const ordered = rawPool.map(p => resolvedMap.get(p._id)).filter(Boolean);
      startTransition(() => setResolved(ordered));
      // Précharge les médias résolus
      scheduleIdlePrefetch(ordered, 0, PREFETCH_AHEAD * 2);
    });

    return () => { cancelled = true; };
  }, [rawPool]);

  const apiFullyLoaded = !hasMore && apiPages >= API_PREFETCH;

  useEffect(() => {
    if (!user) return;
    const id = setInterval(() => {
      if (!document.hidden) {
        startTransition(() => { setSeed(Math.floor(Math.random() * 0xffffffff)); setResetSig(k => k + 1); });
      }
    }, SEED_ROTATE_MS);
    return () => clearInterval(id);
  }, [user]);

  useEffect(() => { if (resolved.length > 0 && !latestId.current) latestId.current = resolved[0]._id; }, [resolved]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return resolved;
    const q = searchQuery.toLowerCase();
    return resolved.filter(p => (p.content || "").toLowerCase().includes(q) || (p.user?.fullName || "").toLowerCase().includes(q));
  }, [resolved, searchQuery]);

  const isLoading = postsLoading && resolved.length === 0;
  useEffect(() => { loadingRef.current = postsLoading; }, [postsLoading]);

  useEffect(() => {
    if (mockGenRef.current || isLoading || !MOCK_CONFIG.enabled) return;
    if (!(MOCK_CONFIG.totalPosts > 100 && MOCK_CONFIG.lazyGeneration?.enabled !== false)) return;
    const t = setTimeout(() => {
      if (mockGenRef.current) return;
      mockGenRef.current = true;
      const run = () => generateFullDataset(() => {}).catch(() => { mockGenRef.current = false; });
      typeof requestIdleCallback !== "undefined" ? requestIdleCallback(run, { timeout: 60000 }) : setTimeout(run, 1000);
    }, 30000);
    return () => clearTimeout(t);
  }, [isLoading]);

  useEffect(() => () => { clearTimeout(waveTimer.current); }, []);

  const showToast     = useCallback((msg, type="info") => { startTransition(() => setToast({ message: msg, type })); }, []);
  const handleDeleted = useCallback((id) => { startTransition(() => removePost?.(id)); }, [removePost]);
  const triggerReset  = useCallback(() => { startTransition(() => setResetSig(k => k + 1)); }, []);

  const handleOpenStory = useCallback((s, o) => {
    if (openStoryViewerProp) openStoryViewerProp(s, o);
    else { setViewerData({ stories: s, owner: o }); setShowViewer(true); }
  }, [openStoryViewerProp]);

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    setIsRefreshing(true); setNewPosts(0); setApiPages(1);
    setSeed(Math.floor(Math.random() * 0xffffffff));
    try {
      const [, r] = await Promise.allSettled([fetchStories(true), refetch?.()]);
      const fp = r?.value?.posts || [];
      if (fp.length > 0) latestId.current = fp[0]._id;
    } catch { showToast("Erreur lors de l'actualisation", "error"); }
    finally { setIsRefreshing(false); triggerReset(); }
  }, [isRefreshing, refetch, fetchStories, showToast, triggerReset]);

  useEffect(() => {
    window.addEventListener(HOME_REFRESH_EVENT, handleRefresh);
    return () => window.removeEventListener(HOME_REFRESH_EVENT, handleRefresh);
  }, [handleRefresh]);

  useEffect(() => {
    const handleScrollTop = () => { scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" }); };
    window.addEventListener(HOME_SCROLL_TOP_EVENT, handleScrollTop);
    return () => window.removeEventListener(HOME_SCROLL_TOP_EVENT, handleScrollTop);
  }, []);

  useEffect(() => {
    if (!user) return;
    const poll = async () => {
      if (document.hidden || isRefreshing || loadingRef.current) return;
      try {
        const r = await refetch?.(), fp = r?.posts || [];
        if (!fp.length || !latestId.current) return;
        const idx = fp.findIndex(p => p._id === latestId.current), newer = idx > 0 ? fp.slice(0, idx) : [];
        if (!newer.length) return;
        const ids = new Set(livePostsRef.current.map(p => p._id));
        const fresh = newer.filter(p => !ids.has(p._id));
        if (!fresh.length) return;
        latestId.current = fresh[0]._id;
        livePostsRef.current = [...fresh, ...livePostsRef.current].slice(0, MAX_POOL);
        setNewPosts(newer.length);
        startTransition(() => setLivePostsVer(v => v + 1));
      } catch {}
    };
    const id = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [user, refetch, isRefreshing]);

  const handleShowNew = useCallback(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    setNewPosts(0);
    startTransition(() => { setSeed(Math.floor(Math.random() * 0xffffffff)); setLivePostsVer(v => v + 1); });
  }, []);

  const PTR = 72;
  useEffect(() => {
    let raf = null, lu = 0;
    const reset   = () => { pullDistRef.current = 0; canPull.current = true; setPullDist(0); };
    const trigger = async () => {
      if (isPulling.current) return;
      isPulling.current = true; setPullDist(0); canPull.current = false;
      await handleRefresh();
      isPulling.current = false; setTimeout(reset, 300);
    };
    const onStart = (e) => { const st = scrollRef.current?.scrollTop ?? 0; if (st <= 2 && canPull.current) touchStartY.current = e.touches[0].clientY; };
    const onMove  = (e) => {
      if (!canPull.current || !touchStartY.current) return;
      const pd = e.touches[0].clientY - touchStartY.current;
      if (pd > 10) {
        pullDistRef.current = Math.min(pd * 0.33, PTR * 1.5);
        const now = Date.now();
        if (now - lu >= 40) { lu = now; if (raf) cancelAnimationFrame(raf); raf = requestAnimationFrame(() => setPullDist(pullDistRef.current)); }
        if (pd > 50 && e.cancelable) try { e.preventDefault(); } catch {}
      }
    };
    const onEnd = () => { if (raf) cancelAnimationFrame(raf); pullDistRef.current > PTR && !isPulling.current ? trigger() : reset(); touchStartY.current = 0; };
    const t = scrollRef.current || window;
    t.addEventListener("touchstart", onStart, { passive: true });
    t.addEventListener("touchmove",  onMove,  { passive: false });
    t.addEventListener("touchend",   onEnd,   { passive: true });
    return () => { if (raf) cancelAnimationFrame(raf); t.removeEventListener("touchstart", onStart); t.removeEventListener("touchmove", onMove); t.removeEventListener("touchend", onEnd); };
  }, [handleRefresh]);

  const apiObsFnRef = useRef(null);
  const apiObsFn = useCallback((entries) => {
    if (!entries[0].isIntersecting || loadingRef.current || isRefreshing) return;
    startPageTrans(() => {
      if (showMock && mockCount < MOCK_POSTS.length) setMockCount(p => Math.min(p + MOCK_CONFIG.loadMoreCount, MOCK_POSTS.length));
      if (hasMore) { fetchNextPage(); setApiPages(p => p + 1); }
    });
  }, [hasMore, fetchNextPage, isRefreshing, showMock, mockCount]);
  useEffect(() => { apiObsFnRef.current = apiObsFn; }, [apiObsFn]);
  useEffect(() => {
    const node = apiObsRef.current; if (!node) return;
    const obs = new IntersectionObserver(e => apiObsFnRef.current?.(e), { rootMargin: "500px" });
    obs.observe(node);
    return () => obs.disconnect();
  }, []); // eslint-disable-line

  const bg     = isDarkMode ? "bg-black"        : "bg-white";
  const border = isDarkMode ? "border-gray-800" : "border-gray-200";
  const txt    = isDarkMode ? "text-white"      : "text-gray-900";

  return (
    <div className={`flex flex-col ${bg}`} style={{ height: "100dvh", overflow: "hidden" }}>

      {/* HEADER */}
      <header className={`flex-shrink-0 ${bg} border-b ${border} z-40`} style={{ height: HEADER_H }}>
        <div className="h-full max-w-[470px] mx-auto flex items-center justify-between px-4">
          <span className={`text-[22px] font-bold tracking-tight select-none ${txt}`}
            style={{ fontFamily: "'Pacifico', 'Satisfy', 'Dancing Script', cursive, sans-serif" }}>
            Chantilink
          </span>
          <div className="flex items-center gap-0.5">
            <button onClick={() => setShowCreator(true)}
              className={`p-2 rounded-full ${txt} transition-opacity active:opacity-60`}
              style={{ WebkitTapHighlightColor: "transparent" }}>
              <PlusCircleIcon className="w-[26px] h-[26px]" />
            </button>
            {isRefreshing && (
              <div className="w-8 h-8 flex items-center justify-center">
                <ArrowPathIcon className={`w-5 h-5 animate-spin ${isDarkMode ? "text-gray-500" : "text-gray-400"}`} />
              </div>
            )}
          </div>
        </div>
      </header>

      <div
        ref={scrollRef}
        data-scroll-container="true"
        className="flex-1 overflow-y-auto"
        style={{
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
          willChange: "transform",
          transform: "translateZ(0)",
        }}
      >
        <style>{`[data-scroll-container]::-webkit-scrollbar{display:none}`}</style>

        <AnimatePresence>
          {(pullDist > 8 || isRefreshing) && (
            <motion.div className="flex items-center justify-center py-1"
              initial={{ height: 0, opacity: 0 }} animate={{ height: 32, opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}>
              <ArrowPathIcon
                className={`w-5 h-5 ${isRefreshing ? "animate-spin" : ""} ${isDarkMode ? "text-gray-500" : "text-gray-400"}`}
                style={{ transform: isRefreshing ? undefined : `rotate(${Math.min(pullDist / PTR, 1) * 270}deg)` }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="max-w-[470px] mx-auto">
          <div className={`${bg} border-b ${border}`} style={{ height: STORIES_H, overflow: "hidden" }}>
            <StoryContainer
              onOpenStory={handleOpenStory}
              onOpenCreator={() => setShowCreator(true)}
              onOpenPyramid={() => setShowPyramid(true)}
              isDarkMode={isDarkMode}
            />
          </div>

          <Feed
            posts={filtered}
            isDarkMode={isDarkMode}
            onDeleted={handleDeleted}
            showToast={showToast}
            apiLoadMoreRef={apiObsRef}
            hasMoreFromAPI={hasMore || mockCount < MOCK_POSTS.length}
            isLoading={isLoading}
            newPostsCount={newPosts}
            onShowNewPosts={handleShowNew}
            apiFullyLoaded={apiFullyLoaded}
            resetSignal={resetSig}
            topOffset={TOTAL_TOP}
            suggestedUsers={suggestedUsers}
            newsArticles={newsArticles}
          />
        </div>
      </div>

      <Suspense fallback={null}>
        <ImmersivePyramidUniverse isOpen={showPyramid} onClose={() => setShowPyramid(false)}
          stories={stories} user={user} onOpenStory={handleOpenStory}
          onOpenCreator={() => { setShowPyramid(false); setShowCreator(true); }} isDarkMode={isDarkMode} />
      </Suspense>
      <AnimatePresence>
        {showCreator && <Suspense fallback={null}><StoryCreator onClose={() => setShowCreator(false)} /></Suspense>}
        {showViewer  && <Suspense fallback={null}><StoryViewer stories={viewerData.stories} currentUser={user} onClose={() => setShowViewer(false)} /></Suspense>}
        {toast       && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </AnimatePresence>
    </div>
  );
};

export default memo(Home);