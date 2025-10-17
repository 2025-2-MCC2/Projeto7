// src/hooks/useSettings.js
import { useEffect, useMemo, useState, useCallback } from "react";

/**
 * Estrutura das configurações (frontend):
 * - account: { email: string }
 * - security: { twoFactor: { enabled: boolean, secretSet: boolean } }
 * - password: { lastChangedAt?: number }   // só marcador local, sem backend
 * - status: { mode: 'online'|'ausente'|'auto', autoTimeoutMin: number }
 * - appearance: { themeMode: 'claro'|'escuro'|'sistema' }  // migra lógica do tema pra cá
 * - language: { locale: 'pt-BR'|'en-US'|'es-ES' }
 */
const DEFAULTS = {
  account: { email: "" },
  security: { twoFactor: { enabled: false, secretSet: false } },
  password: {},
  status: { mode: 'online', autoTimeoutMin: 5 },
  appearance: { themeMode: 'claro' },
  language: { locale: 'pt-BR' },
};

const LS_KEY = 'app_settings_v2';
const LS_THEME_KEY = 'painel_theme';  // compat com o Painel
const LS_LANG_KEY  = 'app_lang';

function getUserIdFromStorage() {
  try {
    const raw = localStorage.getItem('perfil');
    const p = raw ? JSON.parse(raw) : {};
    return String(p.ra || p.nome || 'anon');
  } catch {
    return 'anon';
  }
}

// Stubs de backend (futuro)
// const API = { updateEmail, changePassword, enable2FA, disable2FA, etc. };

export function useSettings(userId) {
  const resolvedUserId = useMemo(() => userId ?? getUserIdFromStorage(), [userId]);

  const [settings, setSettings] = useState(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
    } catch {
      return DEFAULTS;
    }
  });

  // Persistência e efeitos colaterais (tema/idioma)
  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(settings));

    // Tema do Painel (migração da lógica p/ configs)
    const mode = settings.appearance?.themeMode || 'claro';
    if (mode === 'escuro') {
      localStorage.setItem(LS_THEME_KEY, 'escuro');
    } else if (mode === 'claro') {
      localStorage.setItem(LS_THEME_KEY, 'claro');
    } else {
      const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)')?.matches;
      localStorage.setItem(LS_THEME_KEY, prefersDark ? 'escuro' : 'claro');
    }

    // Idioma
    const locale = settings.language?.locale || 'pt-BR';
    localStorage.setItem(LS_LANG_KEY, locale);
    document.documentElement.setAttribute('lang', locale);
  }, [settings]);

  const update = useCallback((path, value) => {
    setSettings(prev => {
      const next = structuredClone(prev);
      const segs = path.split('.');
      let cur = next;
      for (let i = 0; i < segs.length - 1; i++) cur = cur[segs[i]];
      cur[segs[segs.length - 1]] = value;
      return next;
    });
  }, []);

  const saveEmail = useCallback((newEmail) => {
    // Futuro: chamar backend (verificar disponibilidade/confirmar por e-mail)
    update('account.email', newEmail);
    return { ok: true };
  }, [update]);

  const changePassword = useCallback(({ current, next }) => {
    // Futuro: validar no backend. Aqui só sinalizamos visualmente.
    if (!next || next.length < 6) {
      return { ok: false, error: 'A nova senha deve ter pelo menos 6 caracteres.' };
    }
    // Sucesso local
    setSettings(prev => ({ ...prev, password: { ...prev.password, lastChangedAt: Date.now() }}));
    return { ok: true };
  }, []);

  const toggle2FA = useCallback((enable) => {
    // Futuro: backend envia QR/secret; aqui só marcamos flags locais
    setSettings(prev => ({
      ...prev,
      security: { twoFactor: { enabled: enable, secretSet: enable ? prev.security.twoFactor.secretSet : false } }
    }));
  }, []);

  return {
    userId: resolvedUserId,
    settings,
    update,
    saveEmail,
    changePassword,
  };
}
