import { useEffect, useState } from "react";

const PREFIX = "ibtp:batiment:";
const VERSION = 1;

export default function usePersistentState(key, initialValue) {
  const storageKey = `${PREFIX}${key}`;

  const [state, setState] = useState(() => {
    if (typeof window === "undefined") return initialValue;

    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return initialValue;

      const parsed = JSON.parse(raw);
      if (parsed?.version !== VERSION) return initialValue;

      return parsed.value ?? initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      window.localStorage.setItem(storageKey, JSON.stringify({
        version: VERSION,
        savedAt: new Date().toISOString(),
        value: state,
      }));
    } catch {
      // localStorage can be full or unavailable in private contexts.
    }
  }, [storageKey, state]);

  return [state, setState];
}
