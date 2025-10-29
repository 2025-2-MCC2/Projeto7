// src/pages/Configuracoes/Configuracoes.jsx
// ATUALIZADO: Com abas, lógica de foto, segurança e tema global.

import React, { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useSettings } from "../../hooks/useSettings";
import "./Configuracoes.css";
// Assumindo que a API está configurada em um local central
import { api } from '../../auth/api'; // Importe sua instância 'api' configurada (ex: axios)

// Helpers do localStorage (podem vir de um hook useAuth no futuro)
const loadPerfil = () => {
  try { return JSON.parse(localStorage.getItem("perfil") || "{}"); } catch { return {}; }
};
const savePerfil = (p) => localStorage.setItem("perfil", JSON.stringify(p));

const getInitials = (n = 'U') => (String(n).trim()?.[0]?.toUpperCase() || 'U');

export default function Configuracoes() {
  const navigate = useNavigate();
  const [perfil, setPerfil] = useState(loadPerfil);
  
  // O userId deve vir do perfil/auth
  const userId = perfil.ra || perfil.email || perfil.id;
  const { settings, update, changePassword, toggle2FA } = useSettings(userId);

  // Estado das Abas
  const [secaoAtiva, setSecaoAtiva] = useState("conta"); // 'conta', 'seguranca', 'aparencia', 'presenca'
  
  // Estados dos formulários
  const [email, setEmail] = useState(perfil.email || "");
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNext, setPwNext] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const [msg, setMsg] = useState({ conta: "", senha: "", seguranca: "", presenca: "" });

  // Valores das Configurações
  const themeMode  = settings.appearance?.themeMode || "sistema";
  const lang       = settings.language?.locale   || "pt-BR";
  const autoMin    = settings.status?.autoTimeoutMin ?? 5;
  const twoFA      = settings.security?.twoFactor || { enabled: false, secretSet: false };

  // Limpa mensagem de feedback
  const clearMsg = useCallback((key) => {
    setTimeout(() => setMsg(m => ({ ...m, [key]: "" })), 3500);
  }, []);

  // --- LÓGICA DE TEMA GLOBAL ---
  // Aplica o tema (claro/escuro/sistema) ao <html>
  useEffect(() => {
    if (themeMode === 'sistema') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', themeMode);
    }
    // Esta mudança NÃO afetará o .painel-container,
    // pois ele tem sua própria lógica de tema [data-theme]
  }, [themeMode]);


  // --- LÓGICA DA ABA "CONTA" (Email + Foto) ---
  // [Lógica de Foto movida de PerfilPage.jsx]
  
  const handleSaveEmail = () => {
    const ok = /\S+@\S+\.\S+/.test(email);
    if (!ok) return setMsg(m => ({ ...m, conta: "Informe um e-mail válido." }));
    
    // TODO: Implementar chamada de API (ex: PUT /api/usuario/email)
    // Por enquanto, salva localmente no hook e no 'perfil'
    update('account.email', email); // Salva no useSettings
    
    const novoPerfil = { ...perfil, email };
    setPerfil(novoPerfil);
    savePerfil(novoPerfil); // Salva no localStorage 'perfil'
    
    setMsg(m => ({ ...m, conta: "E-mail atualizado com sucesso." }));
    clearMsg("conta");
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type?.startsWith('image/')) return setMsg(m => ({ ...m, foto: "Tipo de arquivo não suportado." }));

    setUploading(true);
    setMsg(m => ({ ...m, conta: "Enviando imagem..." }));
    
    const formData = new FormData();
    formData.append("userId", userId); //
    formData.append("photo", file); //

    try {
      // Usando a rota do profileController
      const res = await api.post('/profile/upload', formData, {
         headers: { 'Content-Type': 'multipart/form-data' },
      });
      const data = res.data;
      if (!data.url) throw new Error('API não retornou URL');
      
      const novoPerfil = { ...perfil, fotoUrl: data.url }; //
      setPerfil(novoPerfil);
      savePerfil(novoPerfil);
      setMsg(m => ({ ...m, conta: "Foto atualizada com sucesso!" }));
      clearMsg("conta");
    } catch (err) {
      console.error(err);
      setMsg(m => ({ ...m, conta: err.response?.data?.error || err.message || "Falha no upload." }));
    } finally {
      setUploading(false);
    }
  };

  const handleLinkPhoto = async () => {
    if (!linkUrl) return setMsg(m => ({ ...m, conta: "Insira uma URL válida." }));
    setUploading(true);
    try {
      // Usando a rota do profileController
      const res = await api.post('/profile/link', { userId, url: linkUrl }); //
      const data = res.data;
      if (!data.url) throw new Error('API não retornou URL');

      const novoPerfil = { ...perfil, fotoUrl: data.url }; //
      setPerfil(novoPerfil);
      savePerfil(novoPerfil);
      setLinkUrl("");
      setMsg(m => ({ ...m, conta: "Foto vinculada com sucesso!" }));
      clearMsg("conta");
    } catch (err) {
      console.error(err);
      setMsg(m => ({ ...m, conta: err.response?.data?.error || err.message || "Falha ao vincular URL." }));
    } finally {
      setUploading(false);
    }
  };
  
  const handleRemovePhoto = async () => {
    if (!window.confirm("Remover sua foto de perfil?")) return;
    setUploading(true);
    try {
      // Usando a rota do profileController
      await api.post('/profile/remove', { userId }); // (endpoint é POST no seu controller)
      
      const novoPerfil = { ...perfil, fotoUrl: null }; //
      setPerfil(novoPerfil);
      savePerfil(novoPerfil);
      setMsg(m => ({ ...m, conta: "Foto removida." }));
      clearMsg("conta");
    } catch (err) {
      console.error(err);
      setMsg(m => ({ ...m, conta: err.response?.data?.error || err.message || "Falha ao remover foto." }));
    } finally {
      setUploading(false);
    }
  };

  // --- LÓGICA DA ABA "SEGURANÇA" ---
  const handleChangePassword = () => { //
    if (!pwCurrent || !pwNext || !pwConfirm) return setMsg(m => ({ ...m, senha: "Preencha todos os campos." }));
    if (pwNext.length < 6) return setMsg(m => ({ ...m, senha: "Nova senha deve ter no mínimo 6 caracteres." }));
    if (pwNext !== pwConfirm) return setMsg(m => ({ ...m, senha: "A confirmação não confere." }));

    // TODO: Chamar API (ex: PUT /api/usuario/change-password)
    // A função local 'changePassword' é uma simulação
    const res = changePassword({ current: pwCurrent, next: pwNext });
    setMsg(m => ({ ...m, senha: res.ok ? "Senha alterada (simulação local)." : res.error }));
    if (res.ok) { setPwCurrent(""); setPwNext(""); setPwConfirm(""); clearMsg("senha"); }
  };

  const handle2FAToggle = (checked) => { //
    // TODO: Chamar API para habilitar/desabilitar 2FA
    toggle2FA(checked);
    setMsg(m => ({ ...m, seguranca: checked ? "2FA habilitado (simulação)." : "2FA desabilitado." }));
    clearMsg("seguranca");
  };

  return (
    <div className="cfg-container">
      <header className="cfg-header">
        <button className="btn-back" onClick={() => navigate(-1)}> {/* */}
          <i className="fa-solid fa-arrow-left" aria-hidden="true"></i>
          Voltar
        </button>
        <h2>Configurações</h2>
      </header>
      
      {/* --- Navegação em Abas --- */}
      <nav className="cfg-tabs">
        <button
          className={`cfg-tab-button ${secaoAtiva === 'conta' ? 'active' : ''}`}
          onClick={() => setSecaoAtiva('conta')}
          role="tab" aria-selected={secaoAtiva === 'conta'}
        >
          <i className="fa-solid fa-user-pen"></i> Conta
        </button>
        <button
          className={`cfg-tab-button ${secaoAtiva === 'seguranca' ? 'active' : ''}`}
          onClick={() => setSecaoAtiva('seguranca')}
          role="tab" aria-selected={secaoAtiva === 'seguranca'}
        >
          <i className="fa-solid fa-shield-halved"></i> Segurança
        </button>
        <button
          className={`cfg-tab-button ${secaoAtiva === 'aparencia' ? 'active' : ''}`}
          onClick={() => setSecaoAtiva('aparencia')}
          role="tab" aria-selected={secaoAtiva === 'aparencia'}
        >
          <i className="fa-solid fa-palette"></i> Aparência
        </button>
        <button
          className={`cfg-tab-button ${secaoAtiva === 'presenca' ? 'active' : ''}`}
          onClick={() => setSecaoAtiva('presenca')}
          role="tab" aria-selected={secaoAtiva === 'presenca'}
        >
          <i className="fa-solid fa-clock"></i> Presença
        </button>
      </nav>

      {/* --- Conteúdo das Abas --- */}

      {/* ======================= ABA CONTA ======================= */}
      {secaoAtiva === 'conta' && (
        <section className="cfg-card" role="tabpanel">
          <h3>Conta</h3>
          
          {/* Seção Foto de Perfil (Movida de PerfilPage.jsx) */}
          <div className="cfg-row-vertical">
            <div className="cfg-label">
              <strong>Foto de Perfil</strong>
              <small className="muted">Esta foto aparece no seu perfil e nos cards de grupo.</small>
            </div>
            <div className="cfg-control cfg-profile-pic">
              {perfil.fotoUrl ? (
                <img src={perfil.fotoUrl} alt="Foto do perfil" className="avatar-preview" />
              ) : (
                <span className="avatar-preview-initials">{getInitials(perfil.nome)}</span>
              )}
              <div className="cfg-inline">
                <button
                  className="btn btn-primary"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  <i className="fa-solid fa-upload"></i>
                  {uploading ? "Enviando..." : "Enviar Foto"}
                </button>
                <button
                  className="btn btn-danger-outline"
                  onClick={handleRemovePhoto}
                  disabled={!perfil.fotoUrl || uploading}
                >
                  <i className="fa-solid fa-trash"></i>
                  Remover Foto
                </button>
                <input
                  ref={fileInputRef} type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp"
                  hidden onChange={handleFileChange}
                />
              </div>
            </div>
          </div>
          <div className="cfg-row-vertical">
            <div className="cfg-label">
              <strong>Vincular URL externa</strong>
              <small className="muted">Use uma imagem de um site (ex: Gravatar, GitHub).</small>
            </div>
            <div className="cfg-control cfg-inline">
              <input
                className="input" type="text" value={linkUrl}
                onChange={e => setLinkUrl(e.target.value)}
                placeholder="https://exemplo.com/imagem.png"
                disabled={uploading}
              />
              <button className="btn btn-secondary" onClick={handleLinkPhoto} disabled={uploading}>
                <i className="fa-solid fa-link"></i>
                Vincular URL
              </button>
            </div>
          </div>
          {msg.conta && <p className={`cfg-msg ${msg.conta.includes("sucesso") ? "success" : "error"}`}>{msg.conta}</p>}

          {/* Seção E-mail */}
          <div className="cfg-row">
            <div className="cfg-label">
              <strong>E-mail</strong>
              <small className="muted">Usado para login e recuperação de conta.</small>
            </div>
            <div className="cfg-control cfg-inline">
              <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="ex: nome@dominio.com" />
              <button className="btn btn-primary" onClick={handleSaveEmail}>
                <i className="fa-solid fa-floppy-disk"></i>Salvar E-mail
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ======================= ABA SEGURANÇA ======================= */}
      {secaoAtiva === 'seguranca' && (
        <section className="cfg-card" role="tabpanel">
          <h3>Segurança</h3>
          <div className="cfg-row">
            <div className="cfg-label">
              <strong>Alterar Senha</strong>
              <small className="muted">Requer sua senha atual.</small>
            </div>
            <div className="cfg-control grid-3">
              <input className="input" type="password" placeholder="Senha atual" value={pwCurrent} onChange={e=>setPwCurrent(e.target.value)} />
              <input className="input" type="password" placeholder="Nova senha (mín. 6)" value={pwNext} onChange={e=>setPwNext(e.target.value)} />
              <input className="input" type="password" placeholder="Confirmar nova senha" value={pwConfirm} onChange={e=>setPwConfirm(e.target.value)} />
              <button className="btn btn-primary" onClick={handleChangePassword}>
                <i className="fa-solid fa-key"></i>Alterar Senha
              </button>
            </div>
          </div>
          {msg.senha && <p className={`cfg-msg ${msg.senha.includes("sucesso") ? "success" : "error"}`}>{msg.senha}</p>}

          {/* 2FA */}
          <div className="cfg-row">
            <div className="cfg-label">
              <strong>Autenticação de Dois Fatores (2FA)</strong>
              <small className="muted">Adiciona uma camada extra de segurança.</small>
            </div>
            <div className="cfg-control cfg-inline">
              <label className="switch">
                <input type="checkbox" checked={twoFA.enabled} onChange={e => handle2FAToggle(e.target.checked)} />
                <span></span>
              </label>
              <span>{twoFA.enabled ? "2FA Habilitado" : "2FA Desabilitado"}</span>
            </div>
            {/* TODO: Adicionar fluxo de setup de 2FA (mostrar QR Code) se !twoFA.secretSet */}
          </div>
          {msg.seguranca && <p className={`cfg-msg ${msg.seguranca.includes("sucesso") ? "success" : "error"}`}>{msg.seguranca}</p>}
        </section>
      )}

      {/* ======================= ABA APARÊNCIA ======================= */}
      {secaoAtiva === 'aparencia' && (
        <section className="cfg-card" role="tabpanel">
          <h3>Aparência &amp; Idioma</h3>
          <div className="cfg-row">
            <div className="cfg-label">
              <strong>Tema Global</strong>
              <small className="muted">Afeta todas as páginas, exceto o Painel Principal.</small>
            </div>
            <div className="cfg-control cfg-inline">
              <label><input type="radio" name="theme" value="claro"   checked={themeMode==='claro'}   onChange={()=>update('appearance.themeMode','claro')}   /> Claro</label>
              <label><input type="radio" name="theme" value="escuro"  checked={themeMode==='escuro'}  onChange={()=>update('appearance.themeMode','escuro')}  /> Escuro</label>
              <label><input type="radio" name="theme" value="sistema" checked={themeMode==='sistema'} onChange={()=>update('appearance.themeMode','sistema')} /> Padrão do Sistema</label>
            </div>
          </div>
          <div className="cfg-row">
            <div className="cfg-label"><strong>Idioma</strong></div>
            <div className="cfg-control">
              <select className="input" value={lang} onChange={e=>update('language.locale', e.target.value)}>
                <option value="pt-BR">Português (Brasil)</option>
                <option value="en-US">English (US)</option>
              </select>
            </div>
          </div>
        </section>
      )}
      
      {/* ======================= ABA PRESENÇA ======================= */}
      {secaoAtiva === 'presenca' && (
        <section className="cfg-card" role="tabpanel">
          <h3>Presença Automática</h3>
          {/* Opção manual removida, conforme solicitado */}
          <div className="cfg-row">
            <div className="cfg-label">
              <strong>Tempo para Ausência</strong>
              <small className="muted">Define quanto tempo de inatividade é necessário para seu status mudar de "Online" para "Ausente".</small>
            </div>
            <div className="cfg-control cfg-inline">
              <input
                className="input" type="number" min="1" max="60"
                style={{ width: '100px', textAlign: 'center' }}
                value={autoMin}
                onChange={e => update('status.autoTimeoutMin', Number(e.target.value || 5))}
              />
              <span>minutos de inatividade</span>
            </div>
          </div>
        </section>
      )}

    </div>
  );
}