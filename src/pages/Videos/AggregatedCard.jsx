// 📁 src/pages/Videos/AggregatedCard.jsx — v9 IMMERSIVE
//
// ═══════════════════════════════════════════════════════════════════════════
// NOUVEAUTÉS v9 :
//  ✅ Overlay double gradient (top + bottom) pour lisibilité maximale
//  ✅ Badge plateforme coloré (YouTube=rouge, Pixabay=vert, Vimeo=bleu, etc.)
//  ✅ Stats bar : vues + durée au-dessus du channel row
//  ✅ SeekBar avec timestamp courant / total
//  ✅ YouTubeEmbed délègue à YouTubePool v6 (YT.Player officiel)
//  ✅ Son persistant via getGlobalMuted / setGlobalMuted
//  ✅ Tout le reste v8 conservé intact
// ═══════════════════════════════════════════════════════════════════════════

import React, { useEffect, useRef, useState, memo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { lockFeed, unlockFeed } from './VideoCard';
import YouTubePool, { getGlobalMuted, setGlobalMuted } from './YouTubePool';
import useVideoPlayer, { USER_INTERACTED_KEY } from '../../hooks/useVideoPlayer';
import {
  FaHeart, FaRegHeart, FaComment, FaShare, FaExternalLinkAlt,
  FaVolumeUp, FaVolumeMute, FaPlay, FaImage, FaDownload,
  FaEye, FaClock,
} from 'react-icons/fa';
import { IoSend } from 'react-icons/io5';

const API_URL  = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? 'https://chantilink-backend.onrender.com/api' : 'http://localhost:5000/api');
const API_BASE = API_URL.replace(/\/api$/, '');

// ─── Helpers ──────────────────────────────────────────────────────────────────
const buildVideoUrl = (content) => {
  if (!content) return null;
  if (content.source==='pixabay'&&content.externalId)
    return `${API_BASE}/api/proxy/video?id=${content.externalId}`;
  if (content.videoUrl?.includes('res.cloudinary.com')) return content.videoUrl;
  if (content.videoUrl?.includes('cdn.pixabay.com/video'))
    return `${API_BASE}/api/proxy/video?url=${encodeURIComponent(content.videoUrl)}`;
  return content.videoUrl||null;
};

const extractYoutubeId = (embedUrl='') => {
  const match=embedUrl.match(/youtube\.com\/embed\/([^?&/]+)/);
  return match?match[1]:null;
};

const generateAvatar = (name='U') => {
  const c=(name||'U').charAt(0).toUpperCase();
  const colors=['#EF4444','#3B82F6','#10B981','#F59E0B','#8B5CF6','#EC4899'];
  const color=colors[c.charCodeAt(0)%colors.length];
  return `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="${encodeURIComponent(color)}"/><text x="50%" y="50%" font-size="50" fill="white" text-anchor="middle" dy=".3em" font-family="Arial">${c}</text></svg>`;
};

const formatTime = (s) => {
  if (!isFinite(s)||s<0) return '0:00';
  return `${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,'0')}`;
};

const formatViews = (n) => {
  if (!n||n===0) return null;
  if (n>=1000000) return `${(n/1000000).toFixed(1)}M`;
  if (n>=1000) return `${(n/1000).toFixed(1)}K`;
  return String(n);
};

const downloadVideoFile = async (src, title='chantilink-video') => {
  if (!src) return;
  try {
    const res=await fetch(src,{mode:'cors'});
    if (!res.ok) throw new Error('fetch failed');
    const blob=await res.blob();
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url; a.download=`${title.slice(0,40).replace(/[^a-z0-9]/gi,'-')}-chantilink.mp4`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch { window.open(src,'_blank'); }
};

// ─────────────────────────────────────────────────────────────────────────────
// BADGE PLATEFORME coloré selon la source
// ─────────────────────────────────────────────────────────────────────────────
const PLATFORM_BADGE_STYLES = {
  YouTube:    { bg:'rgba(255,0,0,0.18)',     border:'rgba(255,0,0,0.4)',      color:'#ff6b6b'  },
  Pixabay:    { bg:'rgba(30,180,60,0.15)',   border:'rgba(30,180,60,0.35)',   color:'#4ade80'  },
  Vimeo:      { bg:'rgba(26,183,234,0.15)',  border:'rgba(26,183,234,0.35)', color:'#38bdf8'  },
  Chantilink: { bg:'rgba(249,115,22,0.18)',  border:'rgba(249,115,22,0.4)',  color:'#fb923c'  },
  default:    { bg:'rgba(255,255,255,0.1)',  border:'rgba(255,255,255,0.2)', color:'rgba(255,255,255,0.7)' },
};

const PlatformBadge = memo(({ platform, contentType }) => {
  if (!platform) return null;
  const style = PLATFORM_BADGE_STYLES[platform] || PLATFORM_BADGE_STYLES.default;
  return (
    <div style={{
      position:'absolute', top:60, left:14, zIndex:10,
      display:'flex', alignItems:'center', gap:5,
      padding:'4px 10px 4px 7px',
      borderRadius:9999,
      fontSize:10, fontWeight:700, letterSpacing:'0.02em',
      backdropFilter:'blur(12px)',
      background:style.bg,
      border:`0.5px solid ${style.border}`,
      color:style.color,
      pointerEvents:'none',
    }}>
      <div style={{width:6,height:6,borderRadius:'50%',background:'currentColor'}}/>
      <span>{platform}{contentType==='video'&&' · Vidéo'}</span>
    </div>
  );
});
PlatformBadge.displayName='PlatformBadge';

// ─────────────────────────────────────────────────────────────────────────────
// STATS BAR — vues + durée
// ─────────────────────────────────────────────────────────────────────────────
const StatsBar = memo(({ views, duration }) => {
  const vStr = formatViews(views);
  const dStr = duration>0 ? formatTime(duration) : null;
  if (!vStr&&!dStr) return null;
  return (
    <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
      {vStr&&(
        <div style={{display:'flex',alignItems:'center',gap:4,fontSize:11,color:'rgba(255,255,255,0.5)'}}>
          <FaEye size={10}/>
          <span>{vStr} vues</span>
        </div>
      )}
      {dStr&&(
        <div style={{display:'flex',alignItems:'center',gap:4,fontSize:11,color:'rgba(255,255,255,0.5)'}}>
          <FaClock size={10}/>
          <span>{dStr}</span>
        </div>
      )}
    </div>
  );
});
StatsBar.displayName='StatsBar';

// ─────────────────────────────────────────────────────────────────────────────
// YouTubeEmbed v9 — délègue à YouTubePool v6
// ─────────────────────────────────────────────────────────────────────────────
const YouTubeEmbed = memo(({ content, isActive, muted }) => {
  const containerRef=useRef(null), slotRef=useRef(null);
  const videoId=extractYoutubeId(content.embedUrl||content.videoUrl||'');

  useEffect(()=>{
    if (!videoId||!containerRef.current) return;
    YouTubePool.init();
    const slot=YouTubePool.acquire(videoId,containerRef.current,{ autoplay:isActive });
    slotRef.current=slot;
    return ()=>{ if(slotRef.current){ YouTubePool.release(slotRef.current); slotRef.current=null; } };
  },[videoId]); // eslint-disable-line

  useEffect(()=>{
    const slot=slotRef.current;
    if (!slot||slot._isDestroyed) return;
    if (isActive) slot.play(); else slot.pause();
  },[isActive]);

  useEffect(()=>{
    const slot=slotRef.current;
    if (!slot||slot._isDestroyed) return;
    slot.setMuted(muted);
  },[muted]);

  if (!videoId) return (
    <div className="w-full h-full bg-gray-900 flex items-center justify-center">
      <p className="text-gray-500 text-sm">Vidéo indisponible</p>
    </div>
  );

  return (
    <div ref={containerRef} style={{position:'absolute',inset:0,width:'100%',height:'100%',background:'#080810',overflow:'hidden'}}/>
  );
});
YouTubeEmbed.displayName='YouTubeEmbed';

// ─────────────────────────────────────────────────────────────────────────────
// DirectVideo v9 — useVideoPlayer
// ─────────────────────────────────────────────────────────────────────────────
const DirectVideo = memo(({ content, isActive, muted, onMutedChange, onError,
  onTogglePlay, onTimeUpdate, onDurationChange, onDoubleTap, onEnded }) => {

  const rawUrl=buildVideoUrl(content)||'';
  const player=useVideoPlayer({
    url:rawUrl, thumbnail:content.thumbnail||null,
    isActive, initialMuted:muted, preload:'auto',
    onError, onMutedChange, useIntersection:false,
  });

  useEffect(()=>{
    const vid=player.videoEl; if(!vid) return;
    vid.muted=muted; vid.volume=muted?0:1;
    if (!muted&&vid.paused&&isActive) player.doPlay();
  },[muted]); // eslint-disable-line

  return (
    <>
      <video ref={player.videoRef} muted loop playsInline preload="auto"
        crossOrigin={player.crossOrigin}
        style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover',contain:'strict'}}
        poster={content.thumbnail||undefined}
        onClick={onTogglePlay} onDoubleClick={onDoubleTap}
        onPlay={player.handlePlay} onPause={player.handlePause} onError={player.handleError}
        onTimeUpdate={onTimeUpdate} onDurationChange={onDurationChange} onEnded={onEnded}/>
      {player.posterUrl&&(
        <img src={player.posterUrl} alt="" draggable="false"
          style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover',pointerEvents:'none',zIndex:player.posterVisible?2:-1,opacity:player.posterVisible?1:0,transition:'opacity 0.3s ease'}}/>
      )}
    </>
  );
});
DirectVideo.displayName='DirectVideo';

// ─────────────────────────────────────────────────────────────────────────────
// HlsVideo — inchangé v8
// ─────────────────────────────────────────────────────────────────────────────
const HlsVideo = memo(({ content, isActive, muted, onMutedChange, onError,
  onTogglePlay, onTimeUpdate, onDurationChange, onDoubleTap, onEnded }) => {

  const videoElRef=useRef(null), hlsRef=useRef(null), abortRef=useRef(null);
  const mutedRef=useRef(muted), isActRef=useRef(isActive);
  useEffect(()=>{ mutedRef.current=muted; },[muted]);
  useEffect(()=>{ isActRef.current=isActive; },[isActive]);

  useEffect(()=>{
    const vid=videoElRef.current; if(!vid||!content.videoUrl) return;
    const setup=async()=>{
      try {
        const {default:Hls}=await import('hls.js');
        if (Hls.isSupported()) {
          hlsRef.current?.destroy();
          const hls=new Hls({enableWorker:false,maxBufferLength:30});
          hlsRef.current=hls; hls.loadSource(content.videoUrl); hls.attachMedia(vid);
          hls.on(Hls.Events.MANIFEST_PARSED,()=>{
            vid.muted=true; vid.volume=1;
            if (!isActRef.current) return;
            abortRef.current?.abort();
            const ctrl=new AbortController(); abortRef.current=ctrl;
            vid.play().then(()=>{ if(ctrl.signal.aborted){vid.pause();return;} if(sessionStorage.getItem(USER_INTERACTED_KEY)==='1'){vid.muted=mutedRef.current;vid.volume=mutedRef.current?0:1;} }).catch(err=>{if(ctrl.signal.aborted||err.name==='AbortError')return;});
          });
          hls.on(Hls.Events.ERROR,(_,d)=>{ if(d.fatal) onError?.(); });
        } else if (vid.canPlayType('application/vnd.apple.mpegurl')) {
          vid.src=content.videoUrl; vid.muted=true;
        }
      } catch { vid.src=content.videoUrl; vid.muted=true; }
    };
    setup();
    return ()=>{ abortRef.current?.abort(); hlsRef.current?.destroy(); hlsRef.current=null; };
  },[content.videoUrl]); // eslint-disable-line

  useEffect(()=>{
    const vid=videoElRef.current; if(!vid) return;
    if (isActive) {
      abortRef.current?.abort();
      const ctrl=new AbortController(); abortRef.current=ctrl;
      vid.muted=true;
      const t=setTimeout(()=>{
        if (ctrl.signal.aborted) return;
        vid.play().then(()=>{ if(ctrl.signal.aborted){vid.pause();return;} if(sessionStorage.getItem(USER_INTERACTED_KEY)==='1'){vid.muted=mutedRef.current;vid.volume=mutedRef.current?0:1;} }).catch(err=>{if(ctrl.signal.aborted||err.name==='AbortError')return;});
      },80);
      return ()=>{ clearTimeout(t); };
    } else { abortRef.current?.abort(); vid.pause(); vid.muted=true; }
  },[isActive]); // eslint-disable-line

  useEffect(()=>{
    const vid=videoElRef.current; if(!vid) return;
    vid.muted=muted; vid.volume=muted?0:1;
    if (!muted&&vid.paused&&isActive) {
      abortRef.current?.abort();
      const ctrl=new AbortController(); abortRef.current=ctrl;
      vid.play().then(()=>{ if(ctrl.signal.aborted){vid.pause();return;} }).catch(()=>{ vid.muted=true; onMutedChange?.(true); });
    }
  },[muted]); // eslint-disable-line

  useEffect(()=>()=>{
    abortRef.current?.abort(); hlsRef.current?.destroy(); hlsRef.current=null;
    const vid=videoElRef.current; if(vid){vid.pause();vid.src='';vid.load();}
  },[]);

  return (
    <video ref={videoElRef} muted loop playsInline preload="auto"
      style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover',contain:'strict'}}
      poster={content.thumbnail||undefined}
      onClick={onTogglePlay} onDoubleClick={onDoubleTap}
      onTimeUpdate={onTimeUpdate} onDurationChange={onDurationChange} onEnded={onEnded}/>
  );
});
HlsVideo.displayName='HlsVideo';

// ─────────────────────────────────────────────────────────────────────────────
// VimeoEmbed — inchangé v8
// ─────────────────────────────────────────────────────────────────────────────
const VimeoEmbed = memo(({ content, isActive, muted }) => {
  const iframeRef=useRef(null), isReadyRef=useRef(false), pendingRef=useRef([]);
  const postCmd=useCallback((method,value)=>{
    const payload=JSON.stringify(value!==undefined?{method,value}:{method});
    if (isReadyRef.current) iframeRef.current?.contentWindow?.postMessage(payload,'*');
    else pendingRef.current.push(payload);
  },[]);
  useEffect(()=>{
    const handle=(event)=>{
      try {
        const data=typeof event.data==='string'?JSON.parse(event.data):event.data;
        if (data?.event==='ready') {
          isReadyRef.current=true;
          pendingRef.current.forEach(p=>iframeRef.current?.contentWindow?.postMessage(p,'*'));
          pendingRef.current=[];
          iframeRef.current?.contentWindow?.postMessage(JSON.stringify({method:'setVolume',value:muted?0:1}),'*');
          if (isActive) iframeRef.current?.contentWindow?.postMessage(JSON.stringify({method:'play'}),'*');
        }
        if (data?.event==='finish') {
          iframeRef.current?.contentWindow?.postMessage(JSON.stringify({method:'seekTo',value:0}),'*');
          iframeRef.current?.contentWindow?.postMessage(JSON.stringify({method:'play'}),'*');
        }
      } catch {}
    };
    window.addEventListener('message',handle);
    return ()=>window.removeEventListener('message',handle);
  },[]); // eslint-disable-line
  useEffect(()=>{ isReadyRef.current=false; pendingRef.current=[]; },[content.videoUrl]);
  useEffect(()=>{ if(isActive){postCmd('play');postCmd('setVolume',muted?0:1);}else postCmd('pause'); },[isActive,postCmd]); // eslint-disable-line
  useEffect(()=>{ postCmd('setVolume',muted?0:1); },[muted,postCmd]);
  const src=content.videoUrl?(content.videoUrl.includes('?')?`${content.videoUrl}&api=1&loop=1`:`${content.videoUrl}?api=1&loop=1`):'';
  return (
    <iframe ref={iframeRef} src={src} className="w-full h-full"
      style={{position:'absolute',inset:0,width:'100%',height:'100%'}}
      allow="autoplay; fullscreen; picture-in-picture" allowFullScreen frameBorder="0"
      title={content.title||'Vimeo video'}/>
  );
});
VimeoEmbed.displayName='VimeoEmbed';

// ─────────────────────────────────────────────────────────────────────────────
// Contenus non-vidéo
// ─────────────────────────────────────────────────────────────────────────────
const ImageContent = memo(({ content, onDoubleTap }) => {
  const [loaded,setLoaded]=useState(false), [error,setError]=useState(false);
  return (
    <div className="w-full h-full bg-gray-900 flex items-center justify-center" onDoubleClick={onDoubleTap}>
      {!loaded&&!error&&<div className="absolute inset-0 flex items-center justify-center"><div className="w-10 h-10 border-4 border-gray-700 border-t-white rounded-full animate-spin"/></div>}
      {!error
        ?<img src={content.imageUrl||content.thumbnail} alt={content.title}
            className={`max-w-full max-h-full object-contain transition-opacity duration-300 ${loaded?'opacity-100':'opacity-0'}`}
            onLoad={()=>setLoaded(true)} onError={()=>setError(true)}/>
        :<div className="flex flex-col items-center gap-3 text-gray-500"><FaImage className="text-5xl"/><p className="text-sm">Image non disponible</p></div>
      }
    </div>
  );
});
ImageContent.displayName='ImageContent';

const ArticleContent = memo(({ content }) => (
  <div className="w-full h-full flex flex-col bg-gray-950" style={{borderTop:'4px solid #F26522'}}>
    {content.thumbnail&&<div className="flex-shrink-0 h-48 overflow-hidden"><img src={content.thumbnail} alt={content.title} className="w-full h-full object-cover" onError={e=>{e.target.style.display='none';}}/></div>}
    <div className="flex-1 overflow-y-auto p-6 pt-16">
      <h2 className="text-white text-2xl font-black leading-tight mb-4">{content.title}</h2>
      <p className="text-gray-300 text-base leading-relaxed">{content.description}</p>
      {content.externalUrl&&<a href={content.externalUrl} target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex items-center gap-2 text-sm font-bold py-2 px-4 rounded-full bg-orange-500 text-white">Lire l'article <FaExternalLinkAlt className="text-xs"/></a>}
    </div>
  </div>
));
ArticleContent.displayName='ArticleContent';

const VideoError = memo(({ thumbnail }) => (
  <div className="relative w-full h-full bg-gray-900 flex flex-col items-center justify-center gap-3">
    {thumbnail&&<img src={thumbnail} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20"/>}
    <div className="relative z-10 flex flex-col items-center gap-2">
      <div className="text-gray-400 text-4xl">📹</div>
      <p className="text-gray-400 text-xs text-center px-6">Vidéo indisponible</p>
    </div>
  </div>
));
VideoError.displayName='VideoError';

const SoundHint = memo(()=>(
  <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0}}
    className="absolute bottom-32 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/20 pointer-events-none">
    <FaVolumeUp className="text-white text-sm"/>
    <span className="text-white text-xs font-semibold">Appuie pour activer le son</span>
  </motion.div>
));
SoundHint.displayName='SoundHint';

const NoAudioBadge = memo(()=>(
  <div className="absolute top-16 left-3 z-40 flex items-center gap-1.5 bg-black/50 backdrop-blur-sm px-2.5 py-1 rounded-full border border-white/10 pointer-events-none">
    <FaVolumeMute className="text-white/60 text-xs"/>
    <span className="text-white/60 text-[10px] font-medium">Sans son</span>
  </div>
));
NoAudioBadge.displayName='NoAudioBadge';

const ChantilinkSignature = memo(({ visible }) => (
  <AnimatePresence>
    {visible&&(
      <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:0.35}}
        className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none"
        style={{background:'rgba(0,0,0,0.45)',backdropFilter:'blur(2px)'}}>
        <motion.div initial={{scale:0.72,opacity:0,y:18}} animate={{scale:1,opacity:1,y:0}} exit={{scale:1.08,opacity:0,y:-8}}
          transition={{type:'spring',stiffness:280,damping:22,delay:0.05}}
          style={{display:'flex',flexDirection:'column',alignItems:'center',gap:14}}>
          <div style={{display:'flex',alignItems:'center',gap:10,background:'rgba(255,255,255,0.10)',border:'1.5px solid rgba(255,255,255,0.22)',backdropFilter:'blur(18px)',borderRadius:999,padding:'10px 24px 10px 16px'}}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <circle cx="16" cy="16" r="16" fill="#f97316" fillOpacity="0.18"/>
              <circle cx="16" cy="16" r="16" fill="url(#sg2)" fillOpacity="0.85"/>
              <text x="16" y="21" textAnchor="middle" fontSize="16" fontWeight="900" fontFamily="Arial, sans-serif" fill="white">C</text>
              <defs><radialGradient id="sg2" cx="40%" cy="30%" r="70%"><stop offset="0%" stopColor="#fb923c"/><stop offset="100%" stopColor="#ea580c"/></radialGradient></defs>
            </svg>
            <span style={{color:'#fff',fontFamily:'Arial, sans-serif',fontWeight:800,fontSize:22,letterSpacing:'-0.3px'}}>Chantilink</span>
          </div>
          <motion.p initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} transition={{delay:0.18,duration:0.28}}
            style={{color:'rgba(255,255,255,0.6)',fontSize:13,fontFamily:'Arial, sans-serif',fontWeight:500,textAlign:'center'}}>
            Le réseau du BTP
          </motion.p>
          <motion.div style={{width:80,height:3,borderRadius:99,background:'rgba(255,255,255,0.2)',overflow:'hidden'}}>
            <motion.div initial={{width:'0%'}} animate={{width:'100%'}} transition={{duration:1.9,ease:'linear'}}
              style={{height:'100%',background:'#f97316',borderRadius:99}}/>
          </motion.div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
));
ChantilinkSignature.displayName='ChantilinkSignature';

// ─────────────────────────────────────────────────────────────────────────────
// SeekBar v9 — avec timestamp courant/total
// ─────────────────────────────────────────────────────────────────────────────
const SeekBar = memo(({ progress, currentTime, duration, getVideoEl, isEmbed }) => {
  const trackRef=useRef(null), dragging=useRef(false), wasPaused=useRef(false);
  const [isDragging,setIsDragging]=useState(false);
  const [previewTime,setPreviewTime]=useState(0);
  const [previewPct,setPreviewPct]=useState(0);

  const getRatio=useCallback((clientX)=>{
    const bar=trackRef.current; if(!bar) return null;
    const rect=bar.getBoundingClientRect();
    return Math.max(0,Math.min(1,(clientX-rect.left)/rect.width));
  },[]);

  const applySeek=useCallback((ratio)=>{
    if (isEmbed) return;
    const vid=getVideoEl(); if(!vid?.duration) return;
    const t=ratio*vid.duration; vid.currentTime=t; setPreviewTime(t); setPreviewPct(ratio*100);
  },[getVideoEl,isEmbed]);

  const onPointerDown=useCallback((e)=>{
    if (isEmbed) return; e.stopPropagation();
    const ratio=getRatio(e.clientX); if(ratio===null) return;
    lockFeed(); dragging.current=true; trackRef.current?.setPointerCapture(e.pointerId);
    const vid=getVideoEl(); wasPaused.current=vid?vid.paused:true;
    if (vid&&!vid.paused) vid.pause();
    applySeek(ratio); setIsDragging(true);
  },[getRatio,applySeek,getVideoEl,isEmbed]);

  const onPointerMove=useCallback((e)=>{
    if (!dragging.current) return; e.stopPropagation();
    const ratio=getRatio(e.clientX); if(ratio!==null) applySeek(ratio);
  },[getRatio,applySeek]);

  const onPointerUp=useCallback((e)=>{
    if (!dragging.current) return; e.stopPropagation();
    dragging.current=false; setIsDragging(false);
    const vid=getVideoEl(); if(vid&&!wasPaused.current) vid.play().catch(()=>{});
    unlockFeed();
  },[getVideoEl]);

  const pct=isDragging?previewPct:progress;
  const dispTime=isDragging?previewTime:currentTime;

  return (
    <>
      <AnimatePresence>
        {isDragging&&!isEmbed&&(
          <motion.div initial={{opacity:0,y:4,scale:0.85}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:4,scale:0.85}} transition={{duration:0.12}}
            className="absolute z-30 pointer-events-none"
            style={{bottom:24,left:`clamp(28px, ${pct}%, calc(100% - 28px))`,transform:'translateX(-50%)'}}>
            <div style={{background:'rgba(0,0,0,0.82)',backdropFilter:'blur(8px)',border:'1px solid rgba(255,255,255,0.18)',borderRadius:8,padding:'3px 8px',fontSize:12,fontWeight:600,color:'#fff',whiteSpace:'nowrap'}}>
              {formatTime(previewTime)}
              {duration>0&&<span style={{opacity:0.5,fontWeight:400}}> / {formatTime(duration)}</span>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Timestamp row */}
      {!isEmbed&&duration>0&&(
        <div style={{
          position:'absolute',left:14,right:14,bottom:13,
          display:'flex',justifyContent:'space-between',alignItems:'center',
          pointerEvents:'none',zIndex:19,
        }}>
          <span style={{fontSize:10,color:'rgba(255,255,255,0.45)',fontVariantNumeric:'tabular-nums'}}>
            {formatTime(dispTime)}
          </span>
          <span style={{fontSize:10,color:'rgba(255,255,255,0.3)',fontVariantNumeric:'tabular-nums'}}>
            {formatTime(duration)}
          </span>
        </div>
      )}

      <div ref={trackRef} className="absolute left-0 right-0 z-20"
        style={{bottom:0,height:28,cursor:isEmbed?'default':'pointer',touchAction:'none',userSelect:'none'}}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove}
        onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
        <div className="absolute left-0 right-0"
          style={{bottom:0,height:isDragging?4:2.5,background:'rgba(255,255,255,0.18)',transition:'height 0.15s ease'}}>
          <div style={{position:'absolute',left:0,top:0,bottom:0,width:`${pct}%`,background:'#fff',borderRadius:99,transition:isDragging?'none':'width 0.1s linear'}}/>
          {!isEmbed&&<div style={{position:'absolute',top:'50%',left:`${pct}%`,transform:'translate(-50%,-50%)',width:isDragging?16:10,height:isDragging?16:10,borderRadius:'50%',background:'#fff',boxShadow:'0 1px 6px rgba(0,0,0,0.5)',transition:isDragging?'none':'width 0.15s, height 0.15s',pointerEvents:'none'}}/>}
        </div>
      </div>
    </>
  );
});
SeekBar.displayName='SeekBar';

// ─────────────────────────────────────────────────────────────────────────────
// AggregatedCard v9
// ─────────────────────────────────────────────────────────────────────────────
const AggregatedCard = ({ content, isActive, onVideoEnded, onModalChange, onVideoError }) => {
  if (!content) return null;

  const { user:currentUser, getToken } = useAuth();

  const directVideoElRef=useRef(null), hlsVideoElRef=useRef(null);

  const [muted,setMuted]=useState(()=>{
    const interacted=sessionStorage.getItem(USER_INTERACTED_KEY)==='1';
    return interacted?getGlobalMuted():true;
  });

  const [showSoundHint, setShowSoundHint] = useState(false);
  const [isPaused,      setIsPaused]      = useState(false);
  const [showHeart,     setShowHeart]     = useState(false);
  const [showComments,  setShowComments]  = useState(false);
  const [isLiked,       setIsLiked]       = useState(false);
  const [localLikes,    setLocalLikes]    = useState(content.localLikesCount||0);
  const [localComments, setLocalComments] = useState([]);
  const [newComment,    setNewComment]    = useState('');
  const [progress,      setProgress]      = useState(0);
  const [currentTime,   setCurrentTime]   = useState(0);
  const [duration,      setDuration]      = useState(0);
  const [showSignature, setShowSignature] = useState(false);
  const [videoError,    setVideoError]    = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const signatureTimer=useRef(null), isEndedFiredRef=useRef(false), onVideoEndedRef=useRef(onVideoEnded);
  useEffect(()=>{ onVideoEndedRef.current=onVideoEnded; },[onVideoEnded]);

  const isHLS        = !!content.isHLS;
  const isEmbed      = !!content.isEmbed;
  const contentType  = content.contentType||'video';
  const isYoutube    = isEmbed&&!!(extractYoutubeId(content.embedUrl||content.videoUrl||''));
  const isVimeo      = isEmbed&&!isYoutube&&!!(content.videoUrl?.includes('vimeo')||content.embedUrl?.includes('vimeo'));
  const isShortVideo = content.type==='short_video';
  const isDirectVid  = contentType==='video'&&!isEmbed&&!isHLS;
  const isImage      = contentType==='image';
  const isText       = contentType==='text'||contentType==='article';

  const showVideoPlayer = (isShortVideo||isDirectVid||isHLS)&&!videoError;
  const showEmbed       = isEmbed&&!videoError;
  const showMuteBtn     = showVideoPlayer||showEmbed;
  const videoHasNoAudio = content.hasAudio!==true&&!isEmbed&&!isHLS&&content.platform==='Pexels';

  const getVideoEl=useCallback(()=>{
    if (isHLS)       return hlsVideoElRef.current;
    if (isDirectVid) return directVideoElRef.current;
    return null;
  },[isHLS,isDirectVid]);

  const handleVideoError=useCallback(()=>{ setVideoError(true); setTimeout(()=>onVideoError?.(),300); },[onVideoError]);

  useEffect(()=>{ isEndedFiredRef.current=false; },[content._id]);

  useEffect(()=>{
    if (!isActive||(!showVideoPlayer&&!showEmbed)) return;
    if (sessionStorage.getItem(USER_INTERACTED_KEY)!=='1') {
      setShowSoundHint(true);
      const t=setTimeout(()=>setShowSoundHint(false),3000);
      return ()=>clearTimeout(t);
    }
  },[isActive,showVideoPlayer,showEmbed]);

  useEffect(()=>{
    if (!isActive||!content._id) return;
    const t=setTimeout(async()=>{ try{await fetch(`${API_URL}/aggregated/${content._id}/view`,{method:'POST'});}catch{} },3000);
    return ()=>clearTimeout(t);
  },[isActive,content._id]);

  useEffect(()=>{
    if (!isActive) {
      if (!videoHasNoAudio) {
        const interacted=sessionStorage.getItem(USER_INTERACTED_KEY)==='1';
        const shouldMute=isYoutube?getGlobalMuted():(interacted?false:true);
        setMuted(shouldMute);
      }
      setVideoError(false); setIsPaused(false); setProgress(0);
      setCurrentTime(0); setShowSoundHint(false); setShowSignature(false);
      signatureTimer.current=null;
    }
  },[isActive,videoHasNoAudio,isYoutube]);

  const handleTimeUpdate=useCallback((e)=>{
    const v=e.target; if(!v?.duration) return;
    const pct=(v.currentTime/v.duration)*100;
    setProgress(pct);
    setCurrentTime(v.currentTime);
    if (pct>=97&&!signatureTimer.current) {
      signatureTimer.current=setTimeout(()=>{},0);
      setShowSignature(true);
      setTimeout(()=>{ setShowSignature(false); signatureTimer.current=null; },2200);
    }
    if (pct<5&&signatureTimer.current!==null) { setShowSignature(false); signatureTimer.current=null; }
  },[]);

  const handleDurationChange=useCallback((e)=>{
    const v=e.target; if(v?.duration&&isFinite(v.duration)) setDuration(v.duration);
  },[]);

  const handleEnded=useCallback(()=>{
    const vid=getVideoEl();
    if (vid&&!isEmbed) { vid.currentTime=0; vid.play().catch(()=>{}); return; }
    if (isEndedFiredRef.current) return;
    isEndedFiredRef.current=true; onVideoEndedRef.current?.();
  },[isEmbed,getVideoEl]);

  const activateSound=useCallback((e)=>{
    e?.stopPropagation();
    sessionStorage.setItem(USER_INTERACTED_KEY,'1');
    setShowSoundHint(false); setMuted(false);
    if (isYoutube) setGlobalMuted(false);
    const vid=getVideoEl();
    if (vid&&!isEmbed) {
      vid.muted=false; vid.volume=1;
      if (vid.paused&&isActive) vid.play().catch(()=>{ vid.muted=true; setMuted(true); });
    }
  },[isActive,isEmbed,isYoutube,getVideoEl]);

  const handleTogglePlay=useCallback((e)=>{
    e?.stopPropagation();
    if (sessionStorage.getItem(USER_INTERACTED_KEY)!=='1') { activateSound(e); return; }
    const vid=getVideoEl(); if(!vid) return;
    if (vid.paused) { vid.play().catch(()=>{}); setIsPaused(false); }
    else { vid.pause(); setIsPaused(true); }
  },[activateSound,getVideoEl]);

  const handleDoubleTap=useCallback((e)=>{
    e?.stopPropagation();
    setShowHeart(true); setTimeout(()=>setShowHeart(false),800);
    if (!isLiked) handleLike(); // eslint-disable-line
  },[isLiked]); // eslint-disable-line

  const handleLike=useCallback(async(e)=>{
    e?.stopPropagation();
    if (!currentUser) return;
    const was=isLiked;
    setIsLiked(!was); setLocalLikes(p=>was?p-1:p+1);
    try {
      const token=await getToken();
      await fetch(`${API_URL}/aggregated/${content._id}/like`,{method:'POST',headers:{Authorization:`Bearer ${token}`}});
    } catch { setIsLiked(was); setLocalLikes(p=>was?p+1:p-1); }
  },[currentUser,isLiked,content._id,getToken]);

  const handleToggleMute=useCallback((e)=>{
    e.stopPropagation();
    if (videoHasNoAudio) return;
    sessionStorage.setItem(USER_INTERACTED_KEY,'1');
    setShowSoundHint(false);
    const nm=!muted; setMuted(nm);
    if (isYoutube) setGlobalMuted(nm);
    const vid=getVideoEl();
    if (vid&&!isEmbed) {
      vid.muted=nm; vid.volume=nm?0:1;
      if (!nm&&vid.paused&&isActive) vid.play().catch(()=>{ vid.muted=true; setMuted(true); });
    }
  },[muted,isActive,isEmbed,isYoutube,videoHasNoAudio,getVideoEl]);

  const handleCommentSubmit=useCallback(async()=>{
    if (!newComment.trim()||!currentUser) return;
    const temp={_id:Date.now(),user:currentUser,text:newComment,createdAt:new Date().toISOString()};
    setLocalComments(p=>[...p,temp]); setNewComment('');
    try {
      const token=await getToken();
      await fetch(`${API_URL}/aggregated/${content._id}/comment`,{
        method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
        body:JSON.stringify({text:temp.text}),
      });
    } catch { setLocalComments(p=>p.filter(c=>c._id!==temp._id)); }
  },[newComment,currentUser,content._id,getToken]);

  const handleShare=useCallback(async(e)=>{
    e.stopPropagation();
    const url=content.externalUrl||window.location.href;
    if (navigator.share) try{await navigator.share({title:content.title,url});}catch{}
    else navigator.clipboard?.writeText(url);
  },[content.externalUrl,content.title]);

  const handleDownload=useCallback(async(e)=>{
    e.stopPropagation(); if(isDownloading) return;
    setIsDownloading(true);
    try { const vid=getVideoEl(); await downloadVideoFile(vid?.src||buildVideoUrl(content)||'',content.title||'chantilink'); }
    finally { setIsDownloading(false); }
  },[isDownloading,content,getVideoEl]);

  const onActDown=useCallback((e)=>{ e.stopPropagation(); lockFeed(); },[]);
  const onActUp=useCallback((e)=>{ e.stopPropagation(); unlockFeed(); },[]);
  const openComments=useCallback((e)=>{ e.stopPropagation(); lockFeed(); setShowComments(true); onModalChange?.(true); },[onModalChange]);
  const closeComments=useCallback(()=>{ unlockFeed(); setShowComments(false); onModalChange?.(false); },[onModalChange]);
  const onDirectVideoRef=useCallback((el)=>{ directVideoElRef.current=el; },[]);
  const onHlsVideoRef=useCallback((el)=>{ hlsVideoElRef.current=el; },[]);

  const commentsModal = showComments ? createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end"
      onPointerDown={e=>e.stopPropagation()} onTouchStart={e=>e.stopPropagation()}>
      <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeComments}/>
      <motion.div initial={{y:'100%'}} animate={{y:0}} exit={{y:'100%'}}
        className="relative w-full bg-gray-900 rounded-t-3xl h-[70vh] flex flex-col shadow-2xl z-10"
        onPointerDown={e=>e.stopPropagation()} onTouchStart={e=>e.stopPropagation()}>
        <div className="p-4 border-b border-gray-800 flex justify-between items-center flex-shrink-0">
          <span className="font-bold text-white">Commentaires</span>
          <button onClick={closeComments} className="text-gray-400 p-2 text-lg">×</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {localComments.length===0&&<p className="text-gray-500 text-center text-sm mt-8">Sois le premier à commenter !</p>}
          {localComments.map((c,i)=>{
            const cu=c.user||c.uploadedBy, cn=cu?.username||cu?.fullName||'Utilisateur';
            return (
              <div key={c._id||i} className="flex gap-3 items-start">
                <img src={cu?.profilePhoto||cu?.profilePicture||generateAvatar(cn)} width={32} height={32}
                  style={{aspectRatio:'1/1',flexShrink:0}}
                  className="w-8 h-8 rounded-full bg-gray-700 object-cover"
                  onError={e=>{e.target.onerror=null;e.target.src=generateAvatar(cn);}} alt={cn}/>
                <div>
                  <p className="text-xs font-bold text-gray-400">{cn}</p>
                  <p className="text-sm text-gray-200">{c.text}</p>
                </div>
              </div>
            );
          })}
        </div>
        <div className="p-4 bg-gray-800 flex gap-2 items-center flex-shrink-0">
          <input value={newComment} onChange={e=>setNewComment(e.target.value)}
            onKeyDown={e=>{ e.stopPropagation(); if(e.key==='Enter') handleCommentSubmit(); }}
            placeholder="Votre commentaire..."
            className="flex-1 bg-gray-700 text-white rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-pink-500"/>
          <button onClick={handleCommentSubmit} disabled={!newComment.trim()}
            className="p-2 bg-pink-600 rounded-full text-white disabled:opacity-50"><IoSend/></button>
        </div>
      </motion.div>
    </div>,
    document.body
  ) : null;

  if (videoError&&onVideoError) return <div className="w-full h-full bg-black"/>;

  return (
    <div className="relative w-full h-full bg-black overflow-hidden select-none">

      {/* Lecteurs */}
      {showVideoPlayer&&isHLS&&(
        <HlsVideo content={content} isActive={isActive} muted={muted} onMutedChange={setMuted}
          onError={handleVideoError} onTogglePlay={handleTogglePlay}
          onTimeUpdate={handleTimeUpdate} onDurationChange={handleDurationChange}
          onDoubleTap={handleDoubleTap} onEnded={handleEnded} videoRef={onHlsVideoRef}/>
      )}
      {showVideoPlayer&&!isHLS&&(
        <DirectVideo content={content} isActive={isActive} muted={muted} onMutedChange={setMuted}
          onError={handleVideoError} onTogglePlay={handleTogglePlay}
          onTimeUpdate={handleTimeUpdate} onDurationChange={handleDurationChange}
          onDoubleTap={handleDoubleTap} onEnded={handleEnded} videoRef={onDirectVideoRef}/>
      )}

      {/* Embeds */}
      {showEmbed&&isYoutube&&<YouTubeEmbed content={content} isActive={isActive} muted={muted}/>}
      {showEmbed&&isVimeo&&<VimeoEmbed content={content} isActive={isActive} muted={muted} onMutedChange={setMuted}/>}
      {showEmbed&&!isYoutube&&!isVimeo&&<VimeoEmbed content={content} isActive={isActive} muted={muted} onMutedChange={setMuted}/>}

      {/* Erreur */}
      {(isShortVideo||isDirectVid||isHLS||isEmbed)&&videoError&&!onVideoError&&<VideoError thumbnail={content.thumbnail}/>}

      {/* Non-vidéo */}
      {isImage&&!isShortVideo&&!isDirectVid&&!isHLS&&<ImageContent content={content} onDoubleTap={handleDoubleTap}/>}
      {isText&&!isShortVideo&&!isDirectVid&&!isHLS&&!isImage&&<ArticleContent content={content}/>}

      {/* ── Overlays ─────────────────────────────────────────────────────── */}
      {/* Gradient haut */}
      {!isText&&(
        <div style={{
          position:'absolute',top:0,left:0,right:0,height:120,
          background:'linear-gradient(to bottom,rgba(0,0,0,0.75) 0%,transparent 100%)',
          pointerEvents:'none',zIndex:3,
        }}/>
      )}
      {/* Gradient bas enrichi */}
      {!isText&&(
        <div style={{
          position:'absolute',inset:0,
          background:'linear-gradient(to top,rgba(0,0,0,0.95) 0%,rgba(0,0,0,0.65) 25%,rgba(0,0,0,0.18) 52%,transparent 72%)',
          pointerEvents:'none',zIndex:3,
        }}/>
      )}

      {/* Badge plateforme coloré */}
      <PlatformBadge platform={content.platform} contentType={contentType}/>

      {videoHasNoAudio&&isActive&&<NoAudioBadge/>}

      {showVideoPlayer&&(
        <SeekBar progress={progress} currentTime={currentTime} duration={duration} getVideoEl={getVideoEl} isEmbed={false}/>
      )}
      {showEmbed&&(
        <SeekBar progress={0} currentTime={0} duration={0} getVideoEl={getVideoEl} isEmbed={true}/>
      )}

      <ChantilinkSignature visible={showSignature&&showVideoPlayer}/>

      {showVideoPlayer&&isPaused&&(
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <FaPlay className="text-white/50 text-6xl animate-pulse"/>
        </div>
      )}

      <AnimatePresence>{showSoundHint&&<SoundHint/>}</AnimatePresence>
      <AnimatePresence>
        {showHeart&&(
          <motion.div initial={{scale:0,opacity:0}} animate={{scale:1.5,opacity:1}} exit={{scale:2,opacity:0}}
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <FaHeart className="text-red-500 text-8xl drop-shadow-2xl"/>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Infos contenu ────────────────────────────────────────────────── */}
      {!isText&&(
        <div className="absolute left-4 right-16 z-30" style={{bottom:'calc(72px + env(safe-area-inset-bottom))'}}>
          {/* Stats bar */}
          <StatsBar views={content.views} duration={content.duration}/>

          {/* Channel row */}
          <div className="flex items-center gap-3 mb-3">
            <img src={content.channelAvatar||generateAvatar(content.channelName)} alt={content.channelName}
              width={40} height={40} style={{aspectRatio:'1/1',flexShrink:0}}
              className="w-10 h-10 rounded-full border-2 border-white/50 object-cover bg-gray-700"
              onError={e=>{e.target.onerror=null;e.target.src=generateAvatar(content.channelName);}}/>
            <div style={{minWidth:0}}>
              <p className="font-bold text-white text-sm drop-shadow-md truncate">{content.channelName}</p>
              {content.platform&&<p className="text-white/60 text-xs">{content.platform}</p>}
            </div>
            {content.externalUrl&&(
              <a href={content.externalUrl} target="_blank" rel="noopener noreferrer"
                onClick={e=>e.stopPropagation()} className="ml-auto text-white/70 hover:text-white p-2">
                <FaExternalLinkAlt className="text-xs"/>
              </a>
            )}
          </div>
          {content.title&&<p className="text-white/90 text-sm mb-2 max-w-[90%] drop-shadow-md line-clamp-2">{content.title}</p>}
          <div className="flex flex-wrap gap-1">
            {(content.hashtags||content.tags||[]).slice(0,3).map((t,i)=>(
              <span key={i} className="text-xs text-white/70 bg-white/10 px-2 py-0.5 rounded-full">#{t}</span>
            ))}
          </div>
        </div>
      )}

      {/* ── Actions ──────────────────────────────────────────────────────── */}
      <div className="absolute right-2 flex flex-col items-center gap-5 z-40 pointer-events-auto"
        style={{bottom:'calc(72px + env(safe-area-inset-bottom))'}}
        onPointerDown={onActDown} onPointerUp={onActUp} onPointerCancel={onActUp}
        onTouchStart={e=>e.stopPropagation()}>

        <div className="flex flex-col items-center gap-1">
          <motion.button whileTap={{scale:0.8}} onClick={handleLike}
            className={`w-11 h-11 rounded-full flex items-center justify-center text-3xl drop-shadow-xl ${isLiked?'text-red-500':'text-white'}`}>
            {isLiked?<FaHeart/>:<FaRegHeart/>}
          </motion.button>
          <span className="text-[11px] font-bold text-white drop-shadow-md">{localLikes}</span>
        </div>

        <div className="flex flex-col items-center gap-1">
          <motion.button whileTap={{scale:0.8}} onClick={openComments}
            className="w-11 h-11 rounded-full flex items-center justify-center text-white text-3xl drop-shadow-xl">
            <FaComment/>
          </motion.button>
          <span className="text-[11px] font-bold text-white drop-shadow-md">{localComments.length+(content.localCommentsCount||0)}</span>
        </div>

        <div className="flex flex-col items-center gap-1">
          <motion.button whileTap={{scale:0.8}} onClick={handleShare}
            className="w-11 h-11 rounded-full flex items-center justify-center text-white text-3xl drop-shadow-xl">
            <FaShare/>
          </motion.button>
          <span className="text-[11px] font-bold text-white drop-shadow-md">Partager</span>
        </div>

        <div className="flex flex-col items-center gap-1">
          <motion.button whileTap={{scale:0.8}} onClick={handleDownload}
            className="w-11 h-11 rounded-full flex items-center justify-center text-white text-2xl drop-shadow-xl"
            style={{opacity:isDownloading?0.5:1}}>
            {isDownloading
              ?<div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
              :<FaDownload/>
            }
          </motion.button>
          <span className="text-[11px] font-bold text-white drop-shadow-md">Sauver</span>
        </div>

        {showMuteBtn&&!videoHasNoAudio&&(
          <motion.button whileTap={{scale:0.9}} onClick={handleToggleMute}
            className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center text-white">
            {muted?<FaVolumeMute/>:<FaVolumeUp/>}
          </motion.button>
        )}
      </div>

      {commentsModal}
    </div>
  );
};

AggregatedCard.displayName='AggregatedCard';
export default memo(AggregatedCard,(prev,next)=>
  prev.isActive      ===next.isActive    &&
  prev.content._id   ===next.content._id &&
  prev.onModalChange ===next.onModalChange&&
  prev.onVideoError  ===next.onVideoError
);