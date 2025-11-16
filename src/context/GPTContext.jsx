// src/context/GPTContext.jsx - OPTIMISÉ, PERSISTENT, PERFORMANT
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";

const GPTContext = createContext();
export const useGPT = () => useContext(GPTContext);

const STORAGE_KEY = "gpt_history";
const MAX_HISTORY = 50;

export function GPTProvider({ children }) {
  const [history, setHistory] = useState([]);
  const initialized = useRef(false);

  // === CHARGEMENT PERSISTENT ===
  useEffect(() => {
    if (initialized.current) return;

    const loadHistory = async () => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          setHistory(Array.isArray(parsed) ? parsed.slice(-MAX_HISTORY) : []);
        }
      } catch {
        // Silencieux
      } finally {
        initialized.current = true;
      }
    };

    loadHistory();
  }, []);

  // === SAUVEGARDE AUTOMATIQUE ===
  useEffect(() => {
    if (!initialized.current) return;

    const saveHistory = () => {
      try {
        const trimmed = history.slice(-MAX_HISTORY);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
      } catch {
        // Silencieux
      }
    };

    const timeout = setTimeout(saveHistory, 500);
    return () => clearTimeout(timeout);
  }, [history]);

  // === AJOUT SÉCURISÉ ===
  const addToHistory = useCallback((entry) => {
    if (!entry?.role || !entry?.content) return;

    const cleanEntry = {
      role: entry.role,
      content: entry.content.trim(),
      timestamp: Date.now(),
    };

    setHistory(prev => [...prev, cleanEntry].slice(-MAX_HISTORY));
  }, []);

  // === EFFACER ===
  const clearHistory = useCallback(() => {
    setHistory([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }, []);

  const value = {
    history,
    addToHistory,
    clearHistory,
  };

  return <GPTContext.Provider value={value}>{children}</GPTContext.Provider>;
}