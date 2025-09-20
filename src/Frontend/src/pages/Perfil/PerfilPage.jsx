// src/pages/Perfil/PerfilPage.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './PerfilPage.css';

const load = (key, fallback) => {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
};
const save = (key, value) => localStorage.setItem(key, JSON.stringify(value));

const upgradePerfil = (p) => {
  const base = {
    id: Date.now(),
    // tipo pode existir internamente ('adm' | 'mentor' | 'aluno'), mas a UI não mostra 'adm'
    tipo: 'aluno',
    nome: 'Usuário',
    email: '',
    ra: '',
    telefone: '',
    fotoUrl: '',
    preferencias: { tema: 'claro', linguagem: 'pt-BR', notificacoesEmail: true },
  };
  if (!p || typeof p !== 'object') return base;
  return {
    ...base,
    ...p,
    preferencias: { ...base.preferencias, ...(p.preferencias || {}) },
  };
};

const applyTheme = (tema) => {
  const t = tema === 'escuro' ? 'escuro' : 'claro';
  document.documentElement.setAttribute('data-theme', t);
};

export default function PerfilPage() {
  const navigate = useNavigate();
  const [perfil, setPerfil] = useState(() => upgradePerfil(load('perfil', {})));
  const [msg, setMsg] = useState({ type: '', text: '' });

  useEffect(() => {
    document.title = 'Lideranças Embaticas • Meu perfil';
    applyTheme(perfil?.preferencias?.tema);
  }, []);

  // DETECÇÃO AUTOMÁTICA: tem RA => Aluno; senão => Mentor. 'adm' é mascarado como Mentor.
  const papelUI = useMemo(() => {
    if (perfil?.tipo === 'adm') return 'mentor'; // oculta admin na UI
    return perfil?.ra?.toString().trim() ? 'aluno' : 'mentor';
  }, [perfil]);

  const isAluno = papelUI === 'aluno';
  const isMentorUI = papelUI === 'mentor';
  const isAdminInterno = perfil?.tipo === 'adm'; // apenas para validação (sem exibir)

  // RA imutável quando já existe para aluno
  const raLocked = isAluno && Boolean(perfil.ra);

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name.startsWith('pref.')) {
      const key = name.replace('pref.', '');
      const novo = { ...perfil, preferencias: { ...perfil.preferencias, [key]: value } };
      setPerfil(novo);
      if (key === 'tema') applyTheme(value); // aplica imediatamente
      return;
    }

    if (name === 'ra') {
      if (raLocked) return;
      setPerfil((prev) => ({ ...prev, ra: value }));
      return;
    }

    setPerfil((prev) => ({ ...prev, [name]: value }));
  };

  const handleToggleNotEmail = () => {
    setPerfil(prev => ({
      ...prev,
      preferencias: { ...prev.preferencias, notificacoesEmail: !prev.preferencias.notificacoesEmail }
    }));
  };

  const handleFotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPerfil(prev => ({ ...prev, fotoUrl: String(reader.result) }));
    reader.readAsDataURL(file);
  };

  const validar = () => {
    const nomeOk = perfil.nome && perfil.nome.trim().length >= 3;
    if (!nomeOk) return 'Informe um nome válido (mínimo 3 caracteres).';

    // Admin não é obrigado a preencher nada (acesso fantasma)
    if (isAdminInterno) return '';

    if (isAluno) {
      if (!perfil.ra || !String(perfil.ra).trim()) return 'RA é obrigatório para alunos.';
      return '';
    }

    // Mentor (UI): nome, e-mail e telefone obrigatórios
    if (isMentorUI) {
      if (!perfil.email || !perfil.email.includes('@')) return 'E-mail é obrigatório e deve ser válido.';
      if (!perfil.telefone || perfil.telefone.trim().length < 8) return 'Telefone é obrigatório.';
      return '';
    }

    return '';
  };

  const salvar = (e) => {
    e.preventDefault();
    const erro = validar();
    if (erro) { setMsg({ type: 'error', text: erro }); return; }
    save('perfil', perfil);
    setMsg({ type: 'success', text: '✅ Perfil atualizado com sucesso.' });
    setTimeout(() => setMsg({ type: '', text: '' }), 3000);
  };

  return (
    <div className="perfil-container">
      <div className="perfil-card">
        <div className="perfil-header">
          <h1>Meu perfil</h1>
          {/* Chip do papel (Admin nunca aparece) */}
          <span className="perfil-badge">{isAluno ? 'Aluno' : 'Mentor'}</span>
        </div>

        <form onSubmit={salvar} className="perfil-form">
          {/* Avatar */}
          <div className="perfil-row">
            {perfil.fotoUrl
              ? <img src={perfil.fotoUrl} alt="Foto do perfil" className="perfil-avatar" />
              : <div className="perfil-avatar perfil-avatar--placeholder">{perfil.nome?.[0]?.toUpperCase() || 'U'}</div>
            }
            <div className="perfil-avatar-actions">
              <label className="perfil-btn perfil-btn--secondary" style={{ cursor: 'pointer', textAlign: 'center' }}>
                Trocar foto
                <input type="file" accept="image/*" onChange={handleFotoUpload} style={{ display: 'none' }} />
              </label>
              <input
                type="url"
                className="perfil-input"
                placeholder="Ou cole uma URL de imagem"
                name="fotoUrl"
                value={perfil.fotoUrl}
                onChange={handleChange}
              />
            </div>
          </div>

          {/* Nome + Campos por papel */}
          <div className="perfil-grid-2">
            <label className="perfil-label">Nome
              <input
                name="nome"
                className="perfil-input"
                value={perfil.nome}
                onChange={handleChange}
                placeholder="Seu nome completo"
                required
              />
            </label>

            {isAluno ? (
              <label className="perfil-label">RA
                <input
                  name="ra"
                  className="perfil-input"
                  value={perfil.ra}
                  onChange={handleChange}
                  placeholder="Registro do Aluno"
                  required
                  readOnly={raLocked}
                  title={raLocked ? 'O RA não pode ser alterado.' : 'Informe seu RA'}
                />
              </label>
            ) : (
              <label className="perfil-label">Telefone {isAdminInterno ? <small>(opcional)</small> : ''}
                <input
                  name="telefone"
                  className="perfil-input"
                  value={perfil.telefone}
                  onChange={handleChange}
                  placeholder="(11) 90000-0000"
                  required={!isAdminInterno} /* Mentor: obrigatório | Admin: opcional */
                />
              </label>
            )}
          </div>

          {/* Linha de e-mail: opcional para aluno; obrigatório para mentor (admin opcional) */}
          {isAluno ? (
            <div className="perfil-grid-2">
              <label className="perfil-label">E-mail <small>(opcional)</small>
                <input
                  type="email"
                  name="email"
                  className="perfil-input"
                  value={perfil.email}
                  onChange={handleChange}
                  placeholder="voce@exemplo.com"
                />
              </label>

              <label className="perfil-label">Telefone <small>(opcional)</small>
                <input
                  name="telefone"
                  className="perfil-input"
                  value={perfil.telefone}
                  onChange={handleChange}
                  placeholder="(11) 90000-0000"
                />
              </label>
            </div>
          ) : (
            <label className="perfil-label">E-mail {isAdminInterno ? <small>(opcional)</small> : ''}
              <input
                type="email"
                name="email"
                className="perfil-input"
                value={perfil.email}
                onChange={handleChange}
                placeholder="voce@exemplo.com"
                required={!isAdminInterno}
              />
            </label>
          )}

          <hr className="perfil-divider" />

          {/* Preferências */}
          <div className="perfil-grid-3">
            <label className="perfil-label">Tema
              <select
                name="pref.tema"
                className="perfil-input"
                value={perfil.preferencias.tema}
                onChange={handleChange}
                title="Escolha claro ou escuro (aplica automaticamente)."
              >
                <option value="claro">Claro</option>
                <option value="escuro">Escuro</option>
              </select>
            </label>

            <label className="perfil-label">Idioma
              <select
                name="pref.linguagem"
                className="perfil-input"
                value={perfil.preferencias.linguagem}
                onChange={handleChange}
              >
                <option value="pt-BR">Português (Brasil)</option>
                <option value="en-US">English (US)</option>
                <option value="es-ES">Español</option>
              </select>
            </label>

            <label className="perfil-toggle">
              <input
                type="checkbox"
                checked={perfil.preferencias.notificacoesEmail}
                onChange={handleToggleNotEmail}
              />
              Notificações por e-mail
            </label>
          </div>

          {msg.text && (
            <p className={`perfil-msg ${msg.type === 'error' ? 'error' : 'success'}`}>
              {msg.text}
            </p>
          )}

          <div className="perfil-actions">
            <button type="button" className="perfil-btn perfil-btn--ghost" onClick={() => navigate('/painel')}>
              Voltar
            </button>
            <button type="submit" className="perfil-btn perfil-btn--primary">
              Salvar alterações
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
