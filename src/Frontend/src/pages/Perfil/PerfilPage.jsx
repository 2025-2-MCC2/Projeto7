// src/pages/Perfil/PerfilPage.jsx
import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import "./PerfilPage.css";

// Util simples para ler o 'perfil' do localStorage
const loadPerfil = () => {
  try { return JSON.parse(localStorage.getItem("perfil") || "{}"); } catch { return {}; }
};

// Inicial para iniciais do avatar
const getInitial = (nome = "Usuário") => String(nome).trim()?.[0]?.toUpperCase() || "U";

export default function PerfilPage() {
  const navigate = useNavigate();
  const perfil = useMemo(() => loadPerfil(), []);

  const nome  = perfil?.nome  || "Usuário";
  const email = perfil?.email || "—";
  const foto  = perfil?.fotoUrl || "";

  // (Opcional) status visual baseado nas configurações salvas (se existirem)
  let statusTxt = "online";
  try {
    const s = JSON.parse(localStorage.getItem("app_settings_v2") || "{}");
    const mode = s?.status?.mode;
    statusTxt = mode === "ausente" ? "ausente" : "online";
  } catch {}

  return (
    <div className="perfil-container perfil-view">
      <div className="perfil-card perfil-card--view">
        <div className="perfil-header">
          <h1>Meu perfil</h1>
          <span className="perfil-badge">{statusTxt}</span>
        </div>

        {/* Avatar + Nome + Email (somente visual) */}
        <div className="perfil-view__top">
          <div className="perfil-avatar-ring" aria-hidden="true" />
          {foto ? (
            <img src={foto} alt="Foto do perfil" className="perfil-avatar perfil-avatar--lg" />
          ) : (
            <div className="perfil-avatar perfil-avatar--lg perfil-avatar--placeholder">
              {getInitial(nome)}
            </div>
          )}

          <div className="perfil-view__id">
            <h2 title={nome} className="perfil-view__name">{nome}</h2>
            <p className="perfil-view__email" title={email}>
              <i className="fa-regular fa-envelope" aria-hidden="true"></i> {email}
            </p>
          </div>
        </div>

        {/* Informações rápidas / Somente leitura */}
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

        {/* Ações */}
        <div className="perfil-actions">
          <button type="button" className="perfil-btn perfil-btn--ghost" onClick={() => navigate(-1)}>
            <i className="fa-solid fa-arrow-left" aria-hidden="true"></i> Voltar
          </button>
          <button
            type="button"
            className="perfil-btn perfil-btn--primary"
            onClick={() => navigate("/config")}
            title="Editar informações de conta nas Configurações"
          >
            <i className="fa-solid fa-gear" aria-hidden="true"></i> Configurações
          </button>
        </div>
      </div>
    </div>
  );
}