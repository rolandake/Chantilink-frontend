// src/pages/Home/useMediaValidation.js
// ✅ v3 — corrections v2 + headCheckCache plafonné (LRU 200)
//
// CORRECTIONS v3 :
//
// 🐛 BUG 1 — headCheckCache (PostMedia) illimité :
//   Map sans max size ni TTL → croît indéfiniment sur longue session.
//   FIX : exporté en tant que module partagé avec purge LRU à 200 entrées.
//   (headCheckCache utilisé dans PostMedia.jsx via import)
//
// ✅ Toutes les optimisations v2 conservées :
//   - isTrustedUrl() synchrone, 0 Image() créé
//   - validIndices disponible au premier render
//   - async uniquement pour http:// local (cas rare)

import { useState, useEffect, useRef } from "react";

// ─── Extensions connues ───────────────────────────────────────────────────────
const IMAGE_EXT_RE = /\.(jpg|jpeg|png|gif|webp|avif|svg)(\?|$)/i;
const VIDEO_EXT_RE = /\.(mp4|webm|mov|avi|mkv|flv|m4v)(\?|$)/i;

const hasKnownImageExt = (url) => IMAGE_EXT_RE.test(url.split("?")[0]);
const hasKnownVideoExt = (url) => VIDEO_EXT_RE.test(url.split("?")[0]);

// ─── isTrustedUrl ─────────────────────────────────────────────────────────────
const isTrustedUrl = (url, slotType) => {
  if (!url || typeof url !== "string") return false;
  if (slotType === "embed" || slotType === "hls") return true;
  if (url.startsWith("blob:") || url.startsWith("data:")) return true;
  if (hasKnownImageExt(url)) return true;
  if (hasKnownVideoExt(url)) return true;
  if (url.startsWith("https://")) {
    try {
      const u = new URL(url);
      return !!(u.hostname && u.pathname && u.pathname !== "/");
    } catch {
      return false;
    }
  }
  if (url.startsWith("/uploads/") || url.startsWith("uploads/")) return true;
  return false;
};

// ─── Vérification structurelle ────────────────────────────────────────────────
const isStructurallyValid = (url) => {
  if (!url || typeof url !== "string" || url.length < 8) return false;
  if (url.startsWith("data:") || url.startsWith("blob:") || url.startsWith("/")) return true;
  if (url.includes("dicebear") || url.includes("api.dicebear.com")) return false;
  try {
    const u = new URL(url);
    return !!(u.hostname && u.pathname && u.pathname !== "/");
  } catch {
    return false;
  }
};

// ─── Cache global des validations asynchrones — LRU plafonné à 500 ───────────
const ASYNC_VALIDATION_CACHE = new Map();
const ASYNC_CACHE_MAX = 500;

const setAsyncCache = (url, result) => {
  if (ASYNC_VALIDATION_CACHE.size >= ASYNC_CACHE_MAX) {
    const firstKey = ASYNC_VALIDATION_CACHE.keys().next().value;
    ASYNC_VALIDATION_CACHE.delete(firstKey);
  }
  ASYNC_VALIDATION_CACHE.set(url, result);
};

// ─── headCheckCache exporté — LRU plafonné à 200 ─────────────────────────────
// Partagé avec PostMedia.jsx pour éviter deux Maps séparées pour les mêmes URLs.
export const headCheckCache = new Map();
const HEAD_CACHE_MAX = 200;

export const setHeadCache = (url, result) => {
  if (headCheckCache.size >= HEAD_CACHE_MAX) {
    const firstKey = headCheckCache.keys().next().value;
    headCheckCache.delete(firstKey);
  }
  headCheckCache.set(url, result);
};

// ─────────────────────────────────────────────────────────────────────────────
// useMediaValidation v3
// ─────────────────────────────────────────────────────────────────────────────
const useMediaValidation = (urls, slotTypes, postMediaType = null) => {
  const computeInitial = () => {
    const result = [];
    for (let i = 0; i < urls.length; i++) {
      const url  = urls[i];
      const type = slotTypes[i];
      if (!isStructurallyValid(url)) continue;
      if (isTrustedUrl(url, type)) {
        result.push(i);
      } else if (ASYNC_VALIDATION_CACHE.has(url)) {
        if (ASYNC_VALIDATION_CACHE.get(url)) result.push(i);
      }
    }
    return result;
  };

  const allTrusted = urls.every((url, i) =>
    !isStructurallyValid(url) || isTrustedUrl(url, slotTypes[i]) || ASYNC_VALIDATION_CACHE.has(url)
  );

  const [validIndices, setValidIndices] = useState(() => {
    if (!urls.length) return [];
    if (allTrusted) return computeInitial();
    return computeInitial();
  });

  const prevKeyRef = useRef("");

  useEffect(() => {
    if (!urls.length) {
      setValidIndices([]);
      return;
    }

    const key = urls.join(",") + "|" + slotTypes.join(",") + "|" + (postMediaType || "");
    if (key === prevKeyRef.current) return;
    prevKeyRef.current = key;

    const pendingIndices = urls.reduce((acc, url, i) => {
      if (!isStructurallyValid(url)) return acc;
      if (isTrustedUrl(url, slotTypes[i])) return acc;
      if (ASYNC_VALIDATION_CACHE.has(url)) return acc;
      acc.push(i);
      return acc;
    }, []);

    if (!pendingIndices.length) return;

    let cancelled = false;

    const asyncChecks = pendingIndices.map(i => {
      const url = urls[i];
      return new Promise(resolve => {
        if (url.startsWith("http://")) {
          const img = new Image();
          let settled = false;
          const settle = (ok) => {
            if (settled) return;
            settled = true;
            img.onload = null;
            img.onerror = null;
            img.src = "";
            setAsyncCache(url, ok);
            resolve({ i, ok });
          };
          const timer = setTimeout(() => settle(false), 5000);
          img.onload  = () => { clearTimeout(timer); settle(true);  };
          img.onerror = () => { clearTimeout(timer); settle(false); };
          img.src = url;
        } else {
          setAsyncCache(url, true);
          resolve({ i, ok: true });
        }
      });
    });

    Promise.all(asyncChecks).then(results => {
      if (cancelled) return;
      setValidIndices(prev => {
        const prevSet = new Set(prev);
        results.forEach(({ i, ok }) => {
          if (ok) prevSet.add(i);
          else prevSet.delete(i);
        });
        return urls
          .map((_, i) => i)
          .filter(i => isStructurallyValid(urls[i]) && prevSet.has(i));
      });
    });

    return () => { cancelled = true; };
  }, [urls.join(","), slotTypes.join(","), postMediaType]); // eslint-disable-line

  return validIndices;
};

export default useMediaValidation;