import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './Grupos.css';

/* =========================
   Config & Helpers
   ========================= */
// [MUDANÇA 1]: API_BASE atualizado para deploy
const API_BASE =
  import.meta.env.VITE_API_URL?.replace(/\/+$/, "") ||
  "https://projeto-interdisciplinar-2.onrender.com/api";

const LS_KEYS = {
  grupos: 'le_grupos_v2',
  legacyGrupos: 'grupos',
};

const LS = {
  get(key, fb) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fb;
    } catch {
      return fb;
    }
  },
  set(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch {}
  },
  migrate() {
    try {
      const novo = localStorage.getItem(LS_KEYS.grupos);
      const legado = localStorage.getItem(LS_KEYS.legacyGrupos);
      if (!novo && legado) localStorage.setItem(LS_KEYS.grupos, legado);
    } catch {}
  },
};

const currency = (v) =>
  (Number(v ?? 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const initials = (name = '?') =>
  String(name)
    .trim()
    .split(/\s+/)
    .map((s) => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

const raValido = (s) => /^\d{3,}$/.test(String(s || '').trim());
const nomeValido = (s) => String(s || '').trim().length >= 3;

/* =========================
   Componente principal
   ========================= */
export default function Grupos() {
  /* Perfil (apenas leitura p/ bloquear alguns recursos) */
  const [perfil] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('perfil')) ?? {};
    } catch {
      return {};
    }
  });
  const isStudent = perfil.tipo === 'aluno';
  const isMentor = perfil.tipo === 'mentor';
  const isAdmin = perfil.tipo === 'adm';
  const isMentorLike = isMentor || isAdmin;

  /* Router */
  const navigate = useNavigate();
  const location = useLocation();

  /* Estado global desta página */
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [grupos, setGrupos] = useState([]);
  const [q, setQ] = useState('');
  const [order, setOrder] = useState('recentes'); // recentes | a_z | z_a

  /* Abas */
  const tabs = ['criar', 'editar'];
  const [aba, setAba] = useState(() => {
    const qs = new URLSearchParams(location.search);
    const t = qs.get('tab');
    if (tabs.includes(t)) return t;
    return isStudent ? 'editar' : 'criar';
  });
  useEffect(() => {
    const qs = new URLSearchParams(location.search);
    const t = qs.get('tab');
    if (t && tabs.includes(t) && t !== aba) setAba(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  /* =========================
     Carregar grupos (API -> fallback LS)
     ========================= */
  useEffect(() => {
    LS.migrate();
    let abort = false;

    (async () => {
      setLoading(true);
      setError('');
      try {
        // [MUDANÇA 2]: Adicionado credentials
        const resp = await fetch(`${API_BASE}/grupos`, {
          credentials: 'include',
        });
        if (!resp.ok) throw new Error('Falha ao carregar do servidor');
        const data = await resp.json();
        if (!abort) {
          setGrupos(Array.isArray(data) ? data : []);
          // manter compat com PainelInicial
          LS.set(LS_KEYS.grupos, Array.isArray(data) ? data : []);
          LS.set(LS_KEYS.legacyGrupos, Array.isArray(data) ? data : []);
        }
      } catch (e) {
        // fallback: localStorage
        try {
          const arr = LS.get(LS_KEYS.grupos, LS.get(LS_KEYS.legacyGrupos, []));
          if (!abort) setGrupos(Array.isArray(arr) ? arr : []);
        } catch {
          if (!abort) setError('Erro ao carregar grupos.');
        }
      } finally {
        if (!abort) setLoading(false);
      }
    })();

    return () => {
      abort = true;
    };
  }, []);

  // manter LS em sincronia
  useEffect(() => {
    try {
      LS.set(LS_KEYS.grupos, grupos);
      LS.set(LS_KEYS.legacyGrupos, grupos);
    } catch {}
  }, [grupos]);

  /* =========================
     Filtragem e ordenação
     ========================= */
  const gruposFiltrados = useMemo(() => {
    let list = Array.isArray(grupos) ? [...grupos] : [];
    const s = q.trim().toLowerCase();
    if (s) {
      list = list.filter(
        (g) =>
          String(g.nome ?? '').toLowerCase().includes(s) ||
          String(g.mentor ?? '').toLowerCase().includes(s) ||
          (g.membros ?? []).some(
            (m) =>
              String(m.nome ?? '').toLowerCase().includes(s) ||
              String(m.ra ?? '').includes(s)
          )
      );
    }
    if (order === 'a_z') {
      list.sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
    } else if (order === 'z_a') {
      list.sort((a, b) => String(b.nome).localeCompare(String(a.nome), 'pt-BR'));
    } else {
      list.sort((a, b) => Number(b.id) - Number(a.id)); // recentes por id
    }
    return list;
  }, [grupos, q, order]);

  /* =========================
     Badges de status
     ========================= */
  const getStatusBadges = (g) => {
    const out = [];
    const meta = Number(g.metaArrecadacao ?? 0);
    const prog = Number(g.progressoArrecadacao ?? 0);
    if (meta <= 0) out.push({ type: 'neutral', text: 'Sem meta' });
    else if (prog >= meta) out.push({ type: 'success', text: 'Meta concluída' });
    else
      out.push({
        type: 'progress',
        text: `${Math.floor((prog / Math.max(meta, 1)) * 100)}% da meta`,
      });
    out.push({ type: g.mentor ? 'mentor' : 'warn', text: g.mentor ? 'Com mentor' : 'Sem mentor' });
    out.push({ type: 'info', text: `${(g.membros ?? []).length} membro(s)` });
    return out;
  };

  /* =========================
     Criar Grupo
     ========================= */
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    nome: '',
    metaArrecadacao: '',
    metaAlimentos: '',
  });
  const [createMembers, setCreateMembers] = useState(() =>
    isStudent
      ? [{ nome: perfil.nome ?? '', ra: perfil.ra ?? '', telefone: '' }]
      : [{ nome: '', ra: '', telefone: '' }]
  );

  // capa (preview base64 local). Sugestão futura: migrar p/ upload multipart.
  const [capaUrl, setCapaUrl] = useState('');
  const capaRef = useRef(null);
  const onPickCapa = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type?.startsWith('image/')) {
      setMessage('Selecione uma imagem válida.');
      return;
    }
    const rd = new FileReader();
    rd.onload = () => setCapaUrl(String(rd.result));
    rd.readAsDataURL(f);
  };
  const removeCapa = () => {
    setCapaUrl('');
    if (capaRef.current) capaRef.current.value = '';
  };

  // Validar criar
  const createValid = useMemo(() => {
    if (!nomeValido(createForm.nome)) return false;
    if (!isStudent && String(createForm.metaArrecadacao ?? '').length === 0) return false;
    if (createMembers.some((m) => !nomeValido(m.nome) || !raValido(m.ra))) return false;
    return true;
  }, [createForm, createMembers, isStudent]);

  const onCreate = async (e) => {
    e.preventDefault();
    if (!createValid) {
      setMessage('Preencha os campos obrigatórios corretamente.');
      return;
    }
    setCreating(true);

    try {
      // prepara membros: auto-incluir criador
      const autoMember =
        isMentor || isStudent
          ? { nome: perfil.nome ?? '', ra: perfil.ra ?? '', telefone: perfil.telefone ?? '' }
          : null;

      const incoming = createMembers.filter((m) => m.nome && m.ra);
      const merged = [];
      if (autoMember) merged.push(autoMember);
      incoming.forEach((im) => {
        if (!merged.some((x) => String(x.ra) === String(im.ra))) merged.push(im);
      });

      const payload = {
        nome: createForm.nome.trim(),
        metaArrecadacao: isStudent ? 0 : Number(createForm.metaArrecadacao ?? 0),
        metaAlimentos: isStudent ? '' : createForm.metaAlimentos ?? '',
        membros: merged,
        mentor: isMentor ? perfil.nome ?? undefined : undefined,
        mentorFotoUrl: isMentor ? perfil.fotoUrl ?? undefined : undefined,
        capaDataUrl: capaUrl || undefined,
      };

      const resp = await fetch(`${API_BASE}/grupos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // <-- [MUDANÇA 2] Adicionado credentials
        body: JSON.stringify(payload),
      });
      if (!resp.ok) {
        let msg = 'Erro ao criar grupo';
        try {
          const json = await resp.json();
          if (json?.error) msg = json.error;
        } catch {}
        throw new Error(msg);
      }
      const novo = await resp.json();

      setGrupos((prev) => [novo, ...prev]);
      // atualiza LS compat
      LS.set(LS_KEYS.grupos, [novo, ...LS.get(LS_KEYS.grupos, [])]);
      LS.set(LS_KEYS.legacyGrupos, [novo, ...LS.get(LS_KEYS.legacyGrupos, [])]);

      // limpa UI
      setCreateForm({ nome: '', metaArrecadacao: '', metaAlimentos: '' });
      setCreateMembers(
        isStudent ? [{ nome: perfil.nome ?? '', ra: perfil.ra ?? '', telefone: '' }] : [{ nome: '', ra: '', telefone: '' }]
      );
      removeCapa();
      setMessage('Grupo criado com sucesso!');
      setTimeout(() => setMessage(''), 2000);
      setAba('editar');
    } catch (err) {
      setMessage(err?.message ?? 'Erro ao criar grupo.');
    } finally {
      setCreating(false);
    }
  };

  /* =========================
     Editar Grupo
     ========================= */
  const [editId, setEditId] = useState(null);
  // [MUDANÇA 3]: Adicionado 'mentorNome' ao estado de edição
  const [editForm, setEditForm] = useState({
    nome: '',
    metaArrecadacao: '',
    metaAlimentos: '',
    mentorNome: '', // <-- NOVO
  });
  const [editMembers, setEditMembers] = useState([{ nome: '', ra: '', telefone: '' }]);
  const [editCapa, setEditCapa] = useState('');
  const editCapaRef = useRef(null);
  const onPickEditCapa = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type?.startsWith('image/')) {
      setMessage('Selecione uma imagem válida.');
      return;
    }
    const rd = new FileReader();
    rd.onload = () => setEditCapa(String(rd.result));
    rd.readAsDataURL(f);
  };
  const removeEditCapa = () => {
    setEditCapa('');
    if (editCapaRef.current) editCapaRef.current.value = '';
  };

  const startEdit = (g) => {
    setEditId(g.id);
    setEditForm({
      nome: g.nome ?? '',
      metaArrecadacao: String(g.metaArrecadacao ?? ''),
      metaAlimentos: g.metaAlimentos ?? '',
      mentorNome: g.mentor ?? '', // <-- [MUDANÇA 4]: Popular o nome do mentor
    });
    setEditMembers(
      (g.membros?.length ? g.membros : [{ nome: '', ra: '', telefone: '' }]).map((m) => ({
        ...m,
        telefone: m.telefone ?? '',
      }))
    );
    setEditCapa(g.capaDataUrl || g.capaUrl || '');
    window.scrollTo(0, 0);
  };

  const [saving, setSaving] = useState(false);
  const onSave = async (e) => {
    e.preventDefault();
    if (!editId) return;
    setSaving(true);
    try {
      // [MUDANÇA 5]: Lógica do payload atualizada para o Admin
      const payload = {
        nome: editForm.nome.trim(),
        metaArrecadacao: Number(editForm.metaArrecadacao ?? 0),
        metaAlimentos: editForm.metaAlimentos ?? '',
        capaDataUrl: editCapa || undefined,

        // Lógica de Membros (Aluno OU Admin podem editar)
        // (A lógica original 'isStudent' parecia errada, ajustei para 'isStudent || isAdmin')
        membros: (isStudent || isAdmin) ? editMembers.filter((m) => m.nome && m.ra) : undefined,

        // Lógica de Mentor (Mentor se auto-atribui, Admin atribui pelo form)
        mentor: isAdmin
          ? editForm.mentorNome.trim() || undefined // Admin define pelo form
          : (isMentor ? perfil.nome ?? undefined : undefined), // Mentor se auto-define
        
        mentorFotoUrl: isAdmin
          ? undefined // Admin não pode definir foto de outro
          : (isMentor ? perfil.fotoUrl ?? undefined : undefined), // Mentor se auto-define
      };

      const r = await fetch(`${API_BASE}/grupos/${editId}`, {
        method: 'PUT',
        credentials: 'include', // <-- [MUDANÇA 2] Adicionado credentials
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        let msg = 'Falha ao salvar grupo';
        try {
          const j = await r.json();
          if (j?.error) msg = j.error;
        } catch {}
        throw new Error(msg);
      }
      const atualizado = await r.json();
      setGrupos((prev) => prev.map((x) => (x.id === editId ? atualizado : x)));

      const all = LS.get(LS_KEYS.grupos, []).map((x) => (x.id === editId ? atualizado : x));
      LS.set(LS_KEYS.grupos, all);
      LS.set(LS_KEYS.legacyGrupos, all);

      setEditId(null);
      setMessage('Grupo atualizado.');
      setTimeout(() => setMessage(''), 2000);
    } catch (e2) {
      setMessage(e2?.message ?? 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  /* =========================
     Excluir Grupo
     ========================= */
  const [confirm, setConfirm] = useState({ open: false, id: null, name: '' });
  const askDelete = (g) => setConfirm({ open: true, id: g.id, name: g.nome });

  const doDelete = async () => {
    const id = confirm.id;
    setConfirm({ open: false, id: null, name: '' });
    if (!id) return;
    try {
      const r = await fetch(`${API_BASE}/grupos/${id}`, {
        method: 'DELETE',
        credentials: 'include', // <-- [MUDANÇA 2] Adicionado credentials
      });
      if (!r.ok) {
        let msg = 'Falha ao excluir';
        try {
          const j = await r.json();
          if (j?.error) msg = j.error;
        } catch {}
        throw new Error(msg);
      }
      setGrupos((prev) => prev.filter((x) => x.id !== id));
      const all = LS.get(LS_KEYS.grupos, []).filter((x) => x.id !== id);
      LS.set(LS_KEYS.grupos, all);
      LS.set(LS_KEYS.legacyGrupos, all);
      if (editId === id) setEditId(null);
      setMessage('Grupo excluído.');
      setTimeout(() => setMessage(''), 1500);
    } catch (e2) {
      setMessage(e2?.message ?? 'Erro ao excluir.');
    }
  };

  /* =========================
     Render
     ========================= */
  return (
    <div className="grupos-page-container">
      {/* Header */}
      <div className="grupos-page-header">
        <h1>Grupos</h1>
        <button onClick={() => navigate('/painel')} className="btn-secondary">
          Voltar ao Painel
        </button>
      </div>

      {/* Toolbar (busca/ordem/abas) */}
      <div className="toolbar-row">
        <div className="left">
          <input
            className="input"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nome, mentor ou membro"
          />
        </div>

        <div className="right" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select className="input" value={order} onChange={(e) => setOrder(e.target.value)}>
            <option value="recentes">Mais recentes</option>
            <option value="a_z">A–Z</option>
            <option value="z_a">Z–A</option>
          </select>

          <div className="tabs" style={{ display: 'flex', gap: 8 }}>
            <button
              className={`btn-secondary ${aba === 'criar' ? 'active' : ''}`}
              onClick={() => setAba('criar')}
              disabled={isStudent}
              title={isStudent ? 'Alunos só podem editar' : undefined}
            >
              Criar
            </button>
            <button
              className={`btn-secondary ${aba === 'editar' ? 'active' : ''}`}
              onClick={() => setAba('editar')}
            >
              Editar
            </button>
          </div>
        </div>
      </div>

      {/* Feedback */}
      {error && (
        <p className="message error" role="alert">
          {String(error)}
        </p>
      )}
      {message && <p className={`message ${/erro|falha/i.test(message) ? 'error' : 'success'}`}>{message}</p>}

      {/* Conteúdo */}
      {loading ? (
        <div className="skeleton-list" aria-busy>
          <div className="sk-row" />
          <div className="sk-row" />
          <div className="sk-row" />
        </div>
      ) : (
        <>
          {/* Aba Criar */}
          {aba === 'criar' && !isStudent && (
            <div className="form-card anim-fade-in-up">
              <h2>Criar Novo Grupo</h2>

              <form onSubmit={onCreate}>
                <div className="form-group">
                  <label htmlFor="nome">Nome do Grupo</label>
                  <input
                    id="nome"
                    name="nome"
                    type="text"
                    value={createForm.nome}
                    onChange={(e) => setCreateForm((f) => ({ ...f, nome: e.target.value }))}
                    placeholder="Ex: Campanha de Natal 2025"
                    required
                    className={!nomeValido(createForm.nome) ? 'input-error' : ''}
                  />
                </div>

                <div className="form-group">
                  <label>Membros do Grupo</label>
                  {createMembers.map((m, i) => (
                    <div key={i} className="member-input-group">
                      <input
                        type="text"
                        name="nome"
                        value={m.nome}
                        onChange={(e) => {
                          const cp = [...createMembers];
                          cp[i] = { ...cp[i], nome: e.target.value };
                          setCreateMembers(cp);
                        }}
                        placeholder="Nome"
                        required
                        disabled={isStudent && i === 0}
                        className={!nomeValido(m.nome) ? 'input-error' : ''}
                      />
                      <input
                        type="text"
                        name="ra"
                        value={m.ra}
                        onChange={(e) => {
                          const cp = [...createMembers];
                          cp[i] = { ...cp[i], ra: e.target.value };
                          setCreateMembers(cp);
                        }}
                        placeholder="RA"
                        required
                        disabled={isStudent && i === 0}
                        className={!raValido(m.ra) ? 'input-error' : ''}
                      />
                      <input
                        type="tel"
                        name="telefone"
                        value={m.telefone}
                        onChange={(e) => {
                          const cp = [...createMembers];
                          cp[i] = { ...cp[i], telefone: e.target.value };
                          setCreateMembers(cp);
                        }}
                        placeholder="Telefone (opcional)"
                      />
                      {createMembers.length > 1 && !isStudent && (
                        <button
                          type="button"
                          className="btn-danger-small"
                          title="Remover"
                          onClick={() => {
                            const cp = [...createMembers];
                            cp.splice(i, 1);
                            setCreateMembers(cp);
                          }}
                        >
                          X
                        </button>
                      )}
                    </div>
                  ))}

                  {!isStudent && (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() =>
                        setCreateMembers((prev) => [...prev, { nome: '', ra: '', telefone: '' }])
                      }
                      style={{ marginTop: 10 }}
                    >
                      Adicionar Membro
                    </button>
                  )}
                </div>

                {!isStudent && (
                  <>
                    <div className="form-group">
                      <label htmlFor="metaArrecadacao">Meta de Arrecadação (R$)</label>
                      <input
                        id="metaArrecadacao"
                        type="number"
                        value={createForm.metaArrecadacao}
                        onChange={(e) =>
                          setCreateForm((f) => ({ ...f, metaArrecadacao: e.target.value }))
                        }
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="metaAlimentos">Meta de Alimentos (Opcional)</label>
                      <input
                        id="metaAlimentos"
                        type="text"
                        value={createForm.metaAlimentos}
                        onChange={(e) =>
                          setCreateForm((f) => ({ ...f, metaAlimentos: e.target.value }))
                        }
                        placeholder="Ex: 100 cestas básicas"
                      />
                    </div>
                  </>
                )}

                <div className="form-group">
                  <label>Imagem de capa (opcional)</label>
                  {capaUrl ? (
                    <div className="cover-preview">
                      <img src={capaUrl} alt="Capa do grupo" />
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <button type="button" className="btn-danger" onClick={removeCapa}>
                          Remover capa
                        </button>
                      </div>
                    </div>
                  ) : (
                    <input ref={capaRef} type="file" accept="image/*" onChange={onPickCapa} />
                  )}
                </div>

                <div className="form-actions">
                  <button type="submit" className="btn-primary" disabled={creating || !createValid}>
                    {creating ? 'Criando…' : 'Criar Grupo'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Aba Editar / Lista */}
          {aba === 'editar' && (
            <>
              <div className="list-card anim-fade-in-up">
                <h2>Grupos Existentes</h2>

                {gruposFiltrados.length === 0 ? (
                  <p>{isStudent ? 'Você ainda não faz parte de um grupo.' : 'Nenhum grupo encontrado.'}</p>
                ) : (
                  <ul className="grupos-list">
                    {gruposFiltrados.map((g) => {
                      const badges = getStatusBadges(g);

                      const percent = Math.min(
                        (Number(g.progressoArrecadacao ?? 0) /
                          Math.max(Number(g.metaArrecadacao ?? 1), 1)) *
                          100,
                        100
                      );

                      // Derivado de alimentos (enquanto o backend não entrega campos numéricos)
                      const match = String(g.metaAlimentos ?? '').match(/\d+/);
                      const metaNum = match ? parseInt(match[0], 10) : 0;
                      const progressoNum = g.progressoAlimentos ?? 0;
                      const percentAlimentos =
                        metaNum > 0 ? Math.min((progressoNum / metaNum) * 100, 100) : 0;

                      return (
                        <li key={g.id} className="grupo-item anim-fade-in-up">
                          {/* Capa */}
                          <div className="grupo-cover">
                            {g.capaDataUrl ? (
                              <img src={g.capaDataUrl} alt="Capa do grupo" />
                            ) : g.capaUrl ? (
                              <img src={g.capaUrl} alt="Capa do grupo" />
                            ) : (
                              <div className="cover-ph">Sem capa</div>
                            )}
                          </div>

                          {/* Info */}
                          <div className="grupo-info">
                            <div className="title-row">
                              <h3>{g.nome}</h3>
                              <div className="mentor-pill" title={g.mentor ? `Mentor: ${g.mentor}` : 'Sem mentor'}>
                                {g.mentorFotoUrl ? (
                                  <img src={g.mentorFotoUrl} alt="Foto do mentor" className="mentor-avatar" />
                                ) : (
                                  <span className="mentor-avatar initials">
                                    {g.mentor ? initials(g.mentor) : '—'}
                                  </span>
                                )}
                                <span className="mentor-name">{g.mentor ?? 'Sem mentor'}</span>
                              </div>
                            </div>

                            <div className="badges">
                              {badges.map((b, i) => (
                                <span key={i} className={`chip chip-${b.type}`}>
                                  {b.text}
                                </span>
                              ))}
                            </div>

                            {/* Meta Financeira */}
                            <div>
                              <strong>Meta Financeira:</strong> {currency(g.metaArrecadacao)}
                              <br />
                              <strong>Arrecadado:</strong> {currency(g.progressoArrecadacao)}
                            </div>
                            <div className="progress-bar-container">
                              <div
                                className="progress-bar-fill"
                                style={{ width: `${percent}%` }}
                                aria-valuenow={percent}
                                aria-valuemin="0"
                                aria-valuemax="100"
                                role="progressbar"
                                aria-label={`Progresso financeiro: ${percent.toFixed(1)}%`}
                              />
                            </div>

                            {/* Meta Alimentos */}
                            {g.metaAlimentos && (
                              <div className="meta-alimentos-section" style={{ marginTop: '0.75rem' }}>
                                <strong>Meta Alimentos:</strong> {g.metaAlimentos}
                                <br />
                                <strong>Progresso Alimentos:</strong> {progressoNum}
                                {metaNum > 0 ? ` / ${metaNum}` : ''}
                                <div className="progress-bar-container">
                                  <div
                                    className="progress-bar-fill"
                                    style={{ width: `${percentAlimentos}%` }}
                                    aria-valuenow={percentAlimentos}
                                    aria-valuemin="0"
                                    aria-valuemax="100"
                                    role="progressbar"
                                    aria-label={`Progresso de alimentos: ${percentAlimentos.toFixed(1)}%`}
                                  />
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Ações */}
                          <div className="grupo-actions" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {/* Editar (mentores/admins) OU aluno que seja membro do grupo */}
                            {(!isStudent ||
                              (isStudent && (g.membros ?? []).some((m) => String(m.ra) === String(perfil.ra)))) && (
                              <button onClick={() => startEdit(g)}>Editar</button>
                            )}

                            {/* Doações (RENOME: /doacoes) */}
                            <button
                              onClick={() => navigate(`/grupos/doacoes/${g.id}`)}
                              className="btn-secondary"
                              title="Abrir doações do grupo"
                            >
                              Doações
                            </button>

                            {/* Excluir (mentor/admin) */}
                            {isMentorLike && (
                              <button onClick={() => askDelete(g)} className="btn-danger">
                                Excluir
                              </button>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {/* Form de Edição (quando startEdit) */}
              {editId && (
                <div className="form-card" style={{ marginTop: 16 }}>
                  <h2>Editar Grupo</h2>

                  <form onSubmit={onSave}>
                    <div className="form-group">
                      <label htmlFor="enome">Nome do Grupo</label>
                      <input
                        id="enome"
                        type="text"
                        value={editForm.nome}
                        onChange={(e) => setEditForm((f) => ({ ...f, nome: e.target.value }))}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label>Membros do Grupo</label>
                      {editMembers.map((m, i) => (
                        <div key={i} className="member-input-group">
                          <input
                            type="text"
                            value={m.nome}
                            onChange={(e) => {
                              const cp = [...editMembers];
                              cp[i] = { ...cp[i], nome: e.target.value };
                              setEditMembers(cp);
                            }}
                            placeholder="Nome"
                            required
                            // [MUDANÇA 6]: Permite Admins E Alunos editarem membros
                            disabled={!isAdmin && !isStudent} 
                          />
                          <input
                            type="text"
                            value={m.ra}
                            onChange={(e) => {
                              const cp = [...editMembers];
                              cp[i] = { ...cp[i], ra: e.target.value };
                              setEditMembers(cp);
                            }}
                            placeholder="RA"
                            required
                            // [MUDANÇA 6]: Permite Admins E Alunos editarem membros
                            disabled={!isAdmin && !isStudent}
                          />
                          <input
                            type="tel"
                            value={m.telefone}
                            onChange={(e) => {
                              const cp = [...editMembers];
                              cp[i] = { ...cp[i], telefone: e.target.value };
                              setEditMembers(cp);
                            }}
                            placeholder="Telefone (opcional)"
                            // [MUDANÇA 6]: Permite Admins E Alunos editarem membros
                            disabled={!isAdmin && !isStudent}
                          />
                          {/* [MUDANÇA 6]: Permite Admins E Alunos removerem membros */}
                          {editMembers.length > 1 && (isAdmin || isStudent) && (
                            <button
                              type="button"
                              className="btn-danger-small"
                              title="Remover"
                              onClick={() => {
                                const cp = [...editMembers];
                                cp.splice(i, 1);
                                setEditMembers(cp);
                              }}
                            >
                              X
                            </button>
                          )}
                        </div>
                      ))}
                      
                      {/* [MUDANÇA 6]: Permite Admins E Alunos adicionarem membros */}
                      {(isStudent || isAdmin) && (
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() =>
                            setEditMembers((prev) => [...prev, { nome: '', ra: '', telefone: '' }])
                          }
                        >
                          Adicionar Membro
                        </button>
                      )}
                    </div>
                    
                    {/* [MUDANÇA 7]: Só mentores e admins podem editar metas */}
                    {isMentorLike && (
                      <>
                        <div className="form-group">
                          <label htmlFor="emeta">Meta de Arrecadação (R$)</label>
                          <input
                            id="emeta"
                            type="number"
                            value={editForm.metaArrecadacao}
                            onChange={(e) =>
                              setEditForm((f) => ({ ...f, metaArrecadacao: e.target.value }))
                            }
                          />
                        </div>

                        <div className="form-group">
                          <label htmlFor="emetaAl">Meta de Alimentos (Opcional)</label>
                          <input
                            id="emetaAl"
                            type="text"
                            value={editForm.metaAlimentos}
                            onChange={(e) =>
                              setEditForm((f) => ({ ...f, metaAlimentos: e.target.value }))
                            }
                          />
                        </div>
                      </>
                    )}

                    {/* [MUDANÇA 8]: Novo campo para Admin atribuir mentor */}
                    {isAdmin && (
                      <div className="form-group">
                        <label htmlFor="ementorNome">Atribuir Mentor (Admin)</label>
                        <input
                          id="ementorNome"
                          type="text"
                          value={editForm.mentorNome}
                          onChange={(e) => setEditForm(f => ({ ...f, mentorNome: e.target.value }))}
                          placeholder="Nome do Mentor"
                        />
                      </div>
                    )}
                    
                    {/* Campo para Mentor se auto-atribuir */}
                    {isMentor && !isAdmin && (
                      <div className="form-group">
                         <label>Mentor</label>
                         <input
                          id="ementorNome"
                          type="text"
                          value={editForm.mentorNome}
                          disabled // Mentor não digita, apenas usa o botão
                        />
                        <button type="button" className="btn-secondary" style={{marginTop: '8px'}}
                          onClick={() => {
                            setEditForm(f => ({ ...f, mentorNome: perfil.nome }));
                            setMessage("Você foi definido como mentor.");
                          }}
                        >
                          Assumir como Mentor
                        </button>
                      </div>
                    )}


                    <div className="form-group">
                      <label>Imagem de capa</label>
                      {editCapa ? (
                        <div className="cover-preview">
                          <img src={editCapa} alt="Capa do grupo" />
                          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                            <button type="button" className="btn-danger" onClick={removeEditCapa}>
                              Remover capa
                            </button>
                          </div>
                        </div>
                      ) : (
                        <input ref={editCapaRef} type="file" accept="image/*" onChange={onPickEditCapa} />
                      )}
                    </div>

                    <div className="form-actions">
                      <button type="submit" className="btn-primary" disabled={saving}>
                        {saving ? 'Salvando…' : 'Salvar Alterações'}
                      </button>
                      <button type="button" className="btn-secondary" onClick={() => setEditId(null)}>
                        Cancelar
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Modal de confirmação */}
      {confirm.open && (
        <div className="modal-overlay" onClick={() => setConfirm({ open: false, id: null, name: '' })}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Excluir grupo</h3>
              <button
                className="btn btn-ghost"
                onClick={() => setConfirm({ open: false, id: null, name: '' })}
                title="Fechar"
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              Tem certeza que deseja excluir o grupo <strong>{confirm.name}</strong>? Essa ação não pode ser desfeita.
            </div>
            <div className="modal-actions">
              <button
                className="btn btn-ghost"
                onClick={() => setConfirm({ open: false, id: null, name: '' })}
              >
                Cancelar
              </button>
              <button className="btn btn-danger" onClick={doDelete}>
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Estilos auxiliares mínimos (mantém seu CSS base) */}
      <style>{`
        .anim-fade-in-up { animation: fade-in-up .22s ease-out both; }
        @keyframes fade-in-up { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        .skeleton-list .sk-row{height:30px;background:linear-gradient(90deg,#eee 25%,#ddd 50%,#eee 75%);background-size:200% 100%;animation:sk-pulse 1.5s infinite ease-in-out;border-radius:8px;margin-bottom:12px}
        @keyframes sk-pulse{0%{background-position:200% 0}100%{background-position:-200% 0}}

        /* Ajuste rápido p/ avatar do mentor (se ainda não existir no seu CSS) */
        .mentor-avatar { width: 34px; height: 34px; border-radius: 50%; object-fit: cover; display: inline-block; border: 2px solid rgba(0,0,0,0.06); }
        .mentor-avatar.initials { display:flex; align-items:center; justify-content:center; background:#d8f3dc; color:#1b4332; font-weight:800; }

        /* Capa (fallback) */
        .grupo-cover img { width:100px; height:80px; object-fit:cover; border-radius:6px; }
        .cover-ph { width:100px; height:80px; display:flex; align-items:center; justify-content:center; background:#f2f2f2; border-radius:6px; color:#666; }
      `}</style>
    </div>
  );
}