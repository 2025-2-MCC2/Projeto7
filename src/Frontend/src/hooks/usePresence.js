// src/hooks/usePresence.js
import { useEffect, useRef } from "react";

export function useAutoPresence({ enabled, timeoutMin = 5, onChange }) {
  const timerRef = useRef(null);

  useEffect(() => {
    if (!enabled) return;
    const timeoutMs = Math.max(1, Number(timeoutMin)) * 60_000;

    const setAway = () => onChange?.('ausente');
    const setOnline = () => {
      onChange?.('online');
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(setAway, timeoutMs);
    };

    // inicial: online + arma timer pra ficar ausente
    setOnline();

    const reactivate = () => setOnline();
    window.addEventListener('mousemove', reactivate);
    window.addEventListener('keydown', reactivate);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') setOnline();
    });

    return () => {
      clearTimeout(timerRef.current);
      window.removeEventListener('mousemove', reactivate);
      window.removeEventListener('keydown', reactivate);
    };
  }, [enabled, timeoutMin, onChange]);
}