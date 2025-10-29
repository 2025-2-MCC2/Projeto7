// src/pages/Perfil/PerfilPage.jsx
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './PerfilPage.css';
import { useAutoPresence } from '../../hooks/usePresence';
import { useSettings } from '../../hooks/useSettings';
import { api } from '../../auth/api';

const loadPerfil = () => {
  try { return JSON.parse(localStorage.getItem('perfil') || '{}'); }
  catch { return {}; }
};
const savePerfil = (p) => localStorage.setItem('perfil', JSON.stringify(p));
const getInitial = (n = 'Usuário') => (String(n).trim()?.[0]?.toUpperCase() || 'U');

export default function PerfilPage() {
  const navigate = useNavigate();
  const [perfil, setPerfil] = useState(() => loadPerfil());
  const [copied, setCopied] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const fileRef = useRef(null);

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === 'perfil') {
        try { setPerfil(JSON.parse(e.newValue || '{}')); } catch {}
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const { settings } = useSettings();
  const autoTimeoutMin = settings?.status?.autoTimeoutMin ?? 5;
  const userId = String(perfil?.ra || perfil?.email || perfil?.nome || 'anon');

  const { status } = useAutoPresence({
    enabled: true,
    timeoutMin: autoTimeoutMin,
    userId,
    onChange: () => {},
  });

  const statusTxt = status;
  const nome = perfil?.nome || 'Usuário';
  const email = perfil?.email || '—';
  const foto = perfil?.fotoUrl || '';

  const isImageFile = (f) => f && f.type?.startsWith('image/');
  const isAcceptableSize = (f, maxMB = 8) => f && f.size <= maxMB * 1024 * 1024;

  const persistLocalPhoto = (fotoUrl) => {
    const novo = { ...perfil, fotoUrl };
    setPerfil(novo);
    savePerfil(novo);
  };

  // ===== Upload (multipart) -> POST /api/profile/photo
  const handleSelectFile = async (e) => {
    setError('');
    const f = e?.target?.files?.[0];
    if (!f) return;
    if (!isImageFile(f)) return setError('Selecione um arquivo de imagem.');
    if (!isAcceptableSize(f, 8)) return setError('Tamanho máximo: 8MB.');
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('photo', f);
      fd.append('userId', userId);

      const r = await api.post('/profile/photo', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (!r?.data?.url) throw new Error('Falha ao enviar a foto.');
      persistLocalPhoto(r.data.url);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Não foi possível enviar a imagem.');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  // ===== Vincular por URL -> POST /api/profile/photo-link
  const handleLinkSave = async () => {
    setError('');
    const url = (urlInput || '').trim();
    if (!url) return setError('Informe uma URL.');
    try {
      setBusy(true);
      const r = await api.post('/profile/photo-link', { userId, url });
      if (!r?.data?.url) throw new Error('Falha ao vincular a foto.');
      persistLocalPhoto(r.data.url);
      setUrlInput('');
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Erro ao vincular URL de imagem.');
    } finally {
      setBusy(false);
    }
  };

  // ===== Remover -> DELETE /api/profile/photo
  const handleRemovePhoto = async () => {
    setError('');
    try {
      setBusy(true);
      await api.delete('/profile/photo', { data: { userId } });
      persistLocalPhoto('');
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Erro ao remover foto.');
    } finally {
      setBusy(false);
    }
  };

  const onCopyEmail = async () => {
    try { await navigator.clipboard.writeText(email); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch {}
  };

  return (
    <div className="perfil-container perfil-view">
      <div className="perfil-card perfil-card--view" role="region" aria-label="Meu perfil">
        <div className="perfil-header">
          <h1>Meu perfil</h1>
          <span className="perfil-badge" aria-live="polite">{statusTxt}</span>
        </div>

        <div className="perfil-view__top">
          <div className="perfil-avatar-ring" aria-hidden="true" />
          <div className="perfil-avatar-wrap">
            {foto ? (
              <img src={foto} alt="Foto do perfil" className="perfil-avatar perfil-avatar--lg" />
            ) : (
              <div className="perfil-avatar perfil-avatar--lg perfil-avatar--placeholder" aria-hidden="true">
                {getInitial(nome)}
              </div>
            )}
            <span
              className={`presence-dot ${statusTxt === 'offline' ? 'offline' : statusTxt === 'ausente' ? 'away' : 'online'}`}
              aria-hidden="true"
              title={statusTxt}
            />
          </div>

          <div className="perfil-view__id">
            <h2 title={nome} className="perfil-view__name">{nome}</h2>
            <p className="perfil-view__email" title={email}>
              <i className="fa-regular fa-envelope" aria-hidden="true"></i> {email}
            </p>
          </div>
        </div>

        <div className="perfil-upload">
          <div className={`dropzone ${busy ? 'is-busy' : ''}`}>
            <div className="dz-icon" aria-hidden="true">
              <i className="fa-regular fa-image"></i>
            </div>
            <div className="dz-text">
              Envie sua foto do dispositivo
              {' · '}
              <label className="link" style={{ cursor: 'pointer' }}>
                selecionar
                <input
                  ref={fileRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.gif,.webp,image/*"
                  hidden
                  onChange={handleSelectFile}
                  aria-label="Selecionar arquivo de imagem"
                />
              </label>
            </div>
          </div>

          <div className="or-sep"><span>ou</span></div>

          <div className="link-row">
            <input
              className="perfil-input"
              type="url"
              placeholder="Cole um link de imagem/GIF (https://...)"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              disabled={busy}
            />
            <button
              className="perfil-btn perfil-btn--secondary"
              onClick={handleLinkSave}
              disabled={busy || !urlInput.trim()}
            >
              <i className="fa-solid fa-link" aria-hidden="true"></i> Usar link
            </button>
          </div>

          <div className="foto-actions">
            <button
              className="perfil-btn perfil-btn--danger"
              onClick={handleRemovePhoto}
              disabled={busy || !foto}
            >
              <i className="fa-regular fa-trash-can" aria-hidden="true"></i> Remover foto
            </button>
          </div>

          {error && <p className="perfil-msg error" role="alert">{error}</p>}
          {busy && <p className="perfil-msg" role="status">Processando…</p>}
        </div>

        <div className="perfil-info">
          <div className="perfil-info__row">
            <span className="perfil-info__label">Nome</span>
            <span className="perfil-info__value" title={nome}>{nome}</span>
          </div>
          <div className="perfil-info__row">
            <span className="perfil-info__label">E‑mail</span>
            <span className="perfil-info__value" title={email}>{email}</span>
          </div>
        </div>

        <div className="perfil-actions">
          <button type="button" className="perfil-btn perfil-btn--ghost" onClick={() => navigate(-1)}>
            <i className="fa-solid fa-arrow-left" aria-hidden="true"></i> Voltar
          </button>

          <button
            type="button"
            className="perfil-btn perfil-btn--secondary"
            onClick={onCopyEmail}
            title="Copiar e‑mail para a área de transferência"
          >
            <i className="fa-regular fa-copy" aria-hidden="true"></i> {copied ? 'Copiado!' : 'Copiar e‑mail'}
          </button>

          <a className="perfil-btn perfil-btn--secondary" href={`mailto:${email}`}>
            <i className="fa-regular fa-envelope" aria-hidden="true"></i> Enviar e‑mail
          </a>

          <button
            type="button"
            className="perfil-btn perfil-btn--primary"
            onClick={() => navigate('/config')}
            title="Editar informações nas Configurações"
          >
            <i className="fa-solid fa-gear" aria-hidden="true"></i> Configurações
          </button>
        </div>
      </div>
    </div>
  );
}
