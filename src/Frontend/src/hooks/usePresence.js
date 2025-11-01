// src/hooks/usePresence.js
import { useEffect, useRef, useState } from 'react';
import { api } from '../auth/api.js';

const LS_PREFIX = 'presence:';

function writePresenceLocal(userId, status) {
  try {
    const key = `${LS_PREFIX}${userId}`;
    const payload = { status, ts: Date.now() };
    localStorage.setItem(key, JSON.stringify(payload));
  } catch {}
}

function readPresenceLocal(userId) {
  try {
    const key = `${LS_PREFIX}${userId}`;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function useAutoPresence({
  enabled = true,
  timeoutMin = 5,
  userId = 'anon',
  onChange,
}) {
  const [status, setStatus] = useState(() => {
    const p = readPresenceLocal(userId);
    return p?.status || 'online';
  });
  const [lastSeen, setLastSeen] = useState(() => {
    const p = readPresenceLocal(userId);
    return p?.ts || Date.now();
  });

  const idleTimerRef = useRef(null);
  const hbTimerRef = useRef(null);

  // agenda inatividade
  useEffect(() => {
    if (!enabled) return;
    const timeoutMs = Math.max(1, Number(timeoutMin)) * 60_000;

    const setAway = () => {
      setStatus((prev) => {
        if (prev !== 'ausente') onChange?.('ausente');
        return 'ausente';
      });
    };

    const goOnline = () => {
      setStatus((prev) => {
        if (prev !== 'online') onChange?.('online');
        return 'online';
      });
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(setAway, timeoutMs);
    };

    goOnline();

    const reactivate = () => goOnline();
    window.addEventListener('mousemove', reactivate, { passive: true });
    window.addEventListener('keydown', reactivate);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') goOnline();
    });

    return () => {
      clearTimeout(idleTimerRef.current);
      window.removeEventListener('mousemove', reactivate);
      window.removeEventListener('keydown', reactivate);
    };
  }, [enabled, timeoutMin, onChange]);

  // heartbeat local + backend
  useEffect(() => {
    writePresenceLocal(userId, status);
    setLastSeen(Date.now());

    let disposed = false;

    async function beat() {
      try {
        await api.post('/presence/heartbeat', { userId, status });
      } catch {
        // silencioso
      }
    }

    beat(); // envia imediatamente
    clearInterval(hbTimerRef.current);
    hbTimerRef.current = setInterval(() => {
      if (!disposed) {
        writePresenceLocal(userId, status);
        setLastSeen(Date.now());
        beat();
      }
    }, 15_000);

    return () => {
      disposed = true;
      clearInterval(hbTimerRef.current);
    };
  }, [status, userId]);

  // Antes de sair/fechar: marca offline local + backend
  useEffect(() => {
    const handleBye = () => {
      writePresenceLocal(userId, 'offline');
      try {
        navigator.sendBeacon?.(
          `${api.defaults.baseURL}/presence/heartbeat`,
          new Blob([JSON.stringify({ userId, status: 'offline' })], { type: 'application/json' })
        );
      } catch {}
    };
    window.addEventListener('beforeunload', handleBye);
    return () => window.removeEventListener('beforeunload', handleBye);
  }, [userId]);

  return { status, lastSeen };
}