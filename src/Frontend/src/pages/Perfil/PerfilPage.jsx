// src/pages/Perfil/PerfilPage.jsx
// ATUALIZADO: Versão "View-Only" (somente visualização).
// Lógica de edição e upload foi movida para Configuracoes.jsx

import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import './PerfilPage.css';
import { useAutoPresence } from '../../hooks/usePresence';
import { useSettings } from '../../hooks/useSettings';
// Removido: import { api } from '../../auth/api';

// Helpers (mantidos)
const loadPerfil = () => {
  try { return JSON.parse(localStorage.getItem('perfil') || '{}'); }
  catch { return {}; }
};
const getInitial = (n = 'Usuário') => {
  const parts = String(n).trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";
  const ini = `${first}${last}`.trim().toUpperCase();
  return ini || "U";
};

export default function PerfilPage() {
  const navigate = useNavigate();
  const [perfil, setPerfil] = useState(() => loadPerfil());
  const [copied, setCopied] = useState(false);

  // Removemos: busy, error, urlInput, fileRef

  // Sincroniza o perfil com localStorage se outra aba mudar
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === 'perfil') {
        try { setPerfil(JSON.parse(e.newValue || '{}')); } catch {}
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Lógica de Presença (mantida)
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

  // Removidas: persistLocalPhoto, handleSelectFile, handleLinkSave, handleRemovePhoto

  const onCopyEmail = async () => {
    if (!email || email === '—') return;
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

        {/* Seção de Visualização (inalterada) */}
        <div className="perfil-view__top">
          <div className="perfil-avatar-ring" aria-hidden="true" />
          <div className="perfil-avatar-wrap">
            {foto ? (
              <img src={foto} alt="Foto do perfil" className="perfil-avatar perfil-avatar--lg" />
            ) : (
              <div className="perfil-avatar perfil-avatar--lg perfil-avatar--placeholder" aria-hidden="true">
                {getInitials(nome)}
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

        {/* REMOVIDO: Seção de Upload (perfil-upload) */}

        {/* Informações Read-Only (inalteradas) */}
        <div className="perfil-info">
          <div className="perfil-info__row">
            <span className="perfil-info__label">Nome</span>
            <span className="perfil-info__value" title={nome}>{nome}</span>
          </div>
          <div className="perfil-info__row">
            <span className="perfil-info__label">E-mail</span>
            <span className="perfil-info__value" title={email}>{email}</span>
          </div>
          {/* Adicione outros campos read-only se desejar (RA, Grupo, etc.) */}
          {perfil.ra && (
            <div className="perfil-info__row">
              <span className="perfil-info__label">RA</span>
              <span className="perfil-info__value">{perfil.ra}</span>
            </div>
          )}
        </div>

        {/* Ações (botão de Edição agora leva para /config) */}
        <div className="perfil-actions">
          <button type="button" className="perfil-btn perfil-btn--ghost" onClick={() => navigate(-1)}>
            <i className="fa-solid fa-arrow-left" aria-hidden="true"></i> Voltar
          </button>
          <button
            type="button"
            className="perfil-btn perfil-btn--secondary"
            onClick={onCopyEmail}
            title="Copiar e-mail"
            disabled={!email || email === '—'}
          >
            <i className="fa-regular fa-copy" aria-hidden="true"></i> {copied ? 'Copiado!' : 'Copiar e-mail'}
          </button>
          <button
            type="button"
            className="perfil-btn perfil-btn--primary"
            onClick={() => navigate('/config')} // <-- AÇÃO PRINCIPAL
            title="Editar perfil e configurações"
          >
            <i className="fa-solid fa-gear" aria-hidden="true"></i> Configurações
          </button>
        </div>
      </div>
    </div>
  );
}