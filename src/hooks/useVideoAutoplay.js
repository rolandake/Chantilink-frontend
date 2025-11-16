// src/hooks/useVideoAutoplay.js
import { useEffect, useState } from 'react';

export const useVideoAutoplay = () => {
  const [autoplayAllowed, setAutoplayAllowed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('autoplay_allowed');
    if (saved === 'true') {
      setAutoplayAllowed(true);
      return;
    }

    const unlock = () => {
      setAutoplayAllowed(true);
      localStorage.setItem('autoplay_allowed', 'true');
      ['click', 'touchstart', 'keydown'].forEach(ev =>
        document.removeEventListener(ev, unlock)
      );
    };

    ['click', 'touchstart', 'keydown'].forEach(ev =>
      document.addEventListener(ev, unlock, { once: true, passive: true })
    );
  }, []);

  const saveAutoplayPreference = (allow) => {
    localStorage.setItem('autoplay_allowed', String(allow));
    setAutoplayAllowed(allow);
  };

  return { autoplayAllowed, saveAutoplayPreference };
};