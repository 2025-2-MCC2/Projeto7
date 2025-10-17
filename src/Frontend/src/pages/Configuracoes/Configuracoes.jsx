import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";              // ⬅️ IMPORTANTE
import { useSettings } from "../../hooks/useSettings";
import "./Configuracoes.css";

export default function Configuracoes({ userId }) {
  const navigate = useNavigate();                            // ⬅️ Agora o botão Voltar funciona
  const { settings, update, saveEmail, changePassword, toggle2FA } = useSettings(userId);

  // Lê o 'perfil' do localStorage para prefilar e-mail quando possível
  const perfilLocal = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("perfil") || "{}"); } catch { return {}; }
  }, []);

  // Prefill: settings.account.email > perfil.email > ""
  const [email, setEmail] = useState(settings.account?.email || perfilLocal.email || "");
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNext, setPwNext] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [msg, setMsg] = useState({ type: "", text: "" });

  const themeMode  = settings.appearance?.themeMode || "claro";
  const lang       = settings.language?.locale   || "pt-BR";
  const statusMode = settings.status?.mode       || "online";
  const autoMin    = settings.status?.autoTimeoutMin ?? 5;
  const twoFA      = settings.security?.twoFactor || { enabled: false, secretSet: false };

  // Salvar e-mail: atualiza settings E também espelha no 'perfil' do localStorage
  const handleSaveEmail = () => {
    const ok = /\S+@\S+\.\S+/.test(email);
    if (!ok) return setMsg({ type: "error", text: "Informe um e-mail válido." });

    const res = saveEmail(email); // atualiza no hook (localStorage das configs)
    if (!res.ok) {
      setMsg({ type: "error", text: res.error || "Falha ao atualizar e-mail." });
      return;
    }

    // Espelha no objeto 'perfil' (para o Painel mostrar no menu)
    try {
      const raw = localStorage.getItem("perfil");
      const p = raw ? JSON.parse(raw) : {};
      const novoPerfil = { ...p, email };                    // ⬅️ adiciona/atualiza e-mail
      localStorage.setItem("perfil", JSON.stringify(novoPerfil));
    } catch {}

    setMsg({ type: "success", text: "E-mail atualizado." });
  };

  const handleChangePassword = () => {
    if (!pwCurrent || !pwNext || !pwConfirm) return setMsg({ type: "error", text: "Preencha todos os campos de senha." });
    if (pwNext !== pwConfirm) return setMsg({ type: "error", text: "A confirmação não confere." });
    const res = changePassword({ current: pwCurrent, next: pwNext });
    setMsg(res.ok ? { type: "success", text: "Senha alterada (efeito local)." } : { type: "error", text: res.error });
    if (res.ok) { setPwCurrent(""); setPwNext(""); setPwConfirm(""); }
  };

  const handle2FAToggle = (checked) => {
    toggle2FA(checked);
    setMsg({ type: "success", text: checked ? "2FA habilitado (frontend)." : "2FA desabilitado." });
  };

  return (
    <div className="cfg-container">
      <header className="cfg-header">
        <button className="btn-back" onClick={() => navigate(-1)}>
          <i className="fa-solid fa-arrow-left" aria-hidden="true"></i>
          Voltar
        </button>
        <h2>Configurações</h2>
      </header>

      {/* Conta */}
      <section className="cfg-card">
        <h3>Conta</h3>
        <div className="cfg-row">
          <div className="cfg-label"><strong>E‑mail</strong></div>
          <div className="cfg-control cfg-inline">
            <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="ex: nome@dominio.com" />
            <button className="btn btn-primary" onClick={handleSaveEmail}>
              <i className="fa-solid fa-floppy-disk"></i>Salvar
            </button>
          </div>
        </div>

        <div className="cfg-row">
          <div className="cfg-label"><strong>Senha</strong></div>
          <div className="cfg-control grid-3">
            <input className="input" type="password" placeholder="Senha atual" value={pwCurrent} onChange={e=>setPwCurrent(e.target.value)} />
            <input className="input" type="password" placeholder="Nova senha (≥ 6)" value={pwNext} onChange={e=>setPwNext(e.target.value)} />
            <input className="input" type="password" placeholder="Confirmar nova senha" value={pwConfirm} onChange={e=>setPwConfirm(e.target.value)} />
            <button className="btn btn-primary" onClick={handleChangePassword}>
              <i className="fa-solid fa-key"></i>Alterar senha
            </button>
          </div>
        </div>
      </section>

      {/* Status */}
      <section className="cfg-card">
        <h3>Status</h3>
        <div className="cfg-row">
          <div className="cfg-label"><strong>Definição</strong></div>
          <div className="cfg-control cfg-inline">
            <label><input type="radio" name="status" value="online"  checked={statusMode==='online'}  onChange={()=>update('status.mode','online')}  /> Online</label>
            <label><input type="radio" name="status" value="ausente" checked={statusMode==='ausente'} onChange={()=>update('status.mode','ausente')} /> Ausente</label>
            <label><input type="radio" name="status" value="auto"    checked={statusMode==='auto'}    onChange={()=>update('status.mode','auto')}    /> Automático</label>
          </div>
        </div>
        {statusMode === 'auto' && (
          <div className="cfg-row">
            <div className="cfg-label"><strong>Tempo para ausentar</strong></div>
            <div className="cfg-control cfg-inline">
              <input
                className="input" type="number" min="1" max="60"
                value={autoMin}
                onChange={e => update('status.autoTimeoutMin', Number(e.target.value || 5))}
              />
              <span>minutos sem atividade</span>
            </div>
          </div>
        )}
      </section>

      {/* Aparência & Idioma */}
      <section className="cfg-card">
        <h3>Aparência &amp; Idioma</h3>
        <div className="cfg-row">
          <div className="cfg-label"><strong>Tema do Painel</strong><small className="muted"> · migração feita pra cá</small></div>
          <div className="cfg-control cfg-inline">
            <label><input type="radio" name="theme" value="claro"   checked={themeMode==='claro'}   onChange={()=>update('appearance.themeMode','claro')}   /> Claro</label>
            <label><input type="radio" name="theme" value="escuro"  checked={themeMode==='escuro'}  onChange={()=>update('appearance.themeMode','escuro')}  /> Escuro</label>
            <label><input type="radio" name="theme" value="sistema" checked={themeMode==='sistema'} onChange={()=>update('appearance.themeMode','sistema')} /> Sistema</label>
          </div>
        </div>
        <div className="cfg-row">
          <div className="cfg-label"><strong>Idioma</strong></div>
          <div className="cfg-control">
            <select className="input" value={lang} onChange={e=>update('language.locale', e.target.value)}>
              <option value="pt-BR">Português (Brasil)</option>
              <option value="en-US">English (US)</option>
              <option value="es-ES">Español (ES)</option>
            </select>
          </div>
        </div>
      </section>
    </div>
  );
}