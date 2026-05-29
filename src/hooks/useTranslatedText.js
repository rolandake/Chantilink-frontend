import { useEffect, useMemo, useState } from "react";
import axiosClient from "../api/axiosClientGlobal";
import { useLanguage } from "../context/LanguageContext";

const CACHE_PREFIX = "chantilink_translation_v1:";
const DISABLED_KEY = "chantilink_translation_disabled_v1";
const MAX_TEXT_LENGTH = 1400;

const hashText = (value = "") => {
  let h = 0;
  const text = String(value || "");
  for (let i = 0; i < text.length; i += 1) h = Math.imul(31, h) + text.charCodeAt(i) | 0;
  return Math.abs(h).toString(36);
};

const normalizeLanguage = (lang = "fr") => {
  const code = String(lang || "fr").toLowerCase().split(/[-_]/)[0];
  return ["fr", "en", "ar"].includes(code) ? code : "fr";
};

const pickTranslation = (payload) => {
  if (!payload) return "";
  if (typeof payload === "string") return payload;
  return payload.translatedText || payload.translation || payload.text || payload.data?.translatedText || payload.data?.translation || "";
};

const getLocalTranslation = (text, language) => {
  try {
    return localStorage.getItem(`${CACHE_PREFIX}${language}:${hashText(text)}`) || "";
  } catch {
    return "";
  }
};

const setLocalTranslation = (text, language, translation) => {
  try {
    localStorage.setItem(`${CACHE_PREFIX}${language}:${hashText(text)}`, translation);
  } catch {}
};

const getKnownTranslation = (source, language) => {
  const lang = normalizeLanguage(language);
  if (!source || typeof source !== "object") return "";
  const candidates = [
    source.translations?.[lang],
    source.translation?.[lang],
    source.i18n?.[lang],
    source[`content_${lang}`],
    source[`translated_${lang}`],
  ];
  return candidates.find((value) => typeof value === "string" && value.trim()) || "";
};

const shouldSkipTranslation = (text, language) => {
  const normalized = String(text || "").trim();
  if (!normalized || normalized.length < 8) return true;
  if (normalized.length > MAX_TEXT_LENGTH) return true;
  if (normalizeLanguage(language) === "fr" && /[àâçéèêëîïôùûüÿœæ]/i.test(normalized)) return true;
  try {
    return sessionStorage.getItem(DISABLED_KEY) === "1";
  } catch {
    return false;
  }
};

export default function useTranslatedText(text, source = null) {
  const { language } = useLanguage();
  const targetLanguage = normalizeLanguage(language);
  const originalText = useMemo(() => String(text || "").trim(), [text]);
  const knownTranslation = useMemo(
    () => getKnownTranslation(source, targetLanguage),
    [source, targetLanguage]
  );
  const [translatedText, setTranslatedText] = useState(knownTranslation || originalText);
  const [isTranslating, setIsTranslating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const nextKnownTranslation = getKnownTranslation(source, targetLanguage);
    if (nextKnownTranslation) {
      setTranslatedText(nextKnownTranslation);
      setIsTranslating(false);
      return () => { cancelled = true; };
    }

    if (shouldSkipTranslation(originalText, targetLanguage)) {
      setTranslatedText(originalText);
      setIsTranslating(false);
      return () => { cancelled = true; };
    }

    const cached = getLocalTranslation(originalText, targetLanguage);
    if (cached) {
      setTranslatedText(cached);
      setIsTranslating(false);
      return () => { cancelled = true; };
    }

    setTranslatedText(originalText);
    setIsTranslating(true);

    const timer = setTimeout(async () => {
      const payload = { text: originalText, targetLanguage, target: targetLanguage, language: targetLanguage };
      const endpoints = ["/translations/text", "/translate", "/ai/translate"];
      let translated = false;
      let missingEndpoints = 0;

      for (const endpoint of endpoints) {
        try {
          const { data } = await axiosClient.post(endpoint, payload, {
            skipNetworkRetry: true,
            silentNetworkError: true,
            timeout: 6000,
          });
          const next = pickTranslation(data).trim();
          if (next && next !== originalText) {
            setLocalTranslation(originalText, targetLanguage, next);
            if (!cancelled) setTranslatedText(next);
            translated = true;
            break;
          }
        } catch (err) {
          if (err?.response?.status === 404) {
            missingEndpoints += 1;
            continue;
          }
          if (!err?.response || err.code === "ERR_NETWORK" || err.code === "ECONNABORTED") {
            try { sessionStorage.setItem(DISABLED_KEY, "1"); } catch {}
          }
          break;
        }
      }

      if (!cancelled) setIsTranslating(false);
      if (!translated && missingEndpoints === endpoints.length) {
        try { sessionStorage.setItem(DISABLED_KEY, "1"); } catch {}
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [originalText, source, targetLanguage]);

  return {
    text: translatedText || originalText,
    originalText,
    isTranslated: !!translatedText && translatedText !== originalText,
    isTranslating,
    language: targetLanguage,
  };
}
