// src/pages/Grupos/Grupos.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './Grupos.css';

// ---- Helpers localStorage ----
const load = (key, fb) => {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fb; } catch { return fb; }
};
const save = (key, val) => localStorage.setItem(key, JSON.stringify(val));

// Estado inicial (Criar)
const initialCreate = { nome: '', metaArrecadacao: '', metaAlimentos: '' };

// Para membros iniciais
const getInitialMembrosState = (isStudent, perfil) => {
  if (isStudent) {
    return [{ nome: perfil.nome || '', ra: perfil.ra || '', telefone: '' }];
  }
  return [{ nome: '', ra: '', telefone: '' }];
};

export default function Grupos() {
  // Perfil
  const [perfil] = useState(() => {
    try { return JSON.parse(localStorage.getItem('perfil')) ?? {}; } catch { return {}; }
  });
  const isStudent = perfil.tipo === 'aluno';
  const isMentor = perfil.tipo === 'mentor';
  const isAdmin = perfil.tipo === 'adm';
  const isMentorLike = isMentor || isAdmin;

  // Navegação
  const navigate = useNavigate();
  const location = useLocation();

  // Grupos
  const [grupos, setGrupos] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('grupos')) ?? [];
      return stored.map(g => ({ ...g, membros: g.membros ?? [] }));
    } catch {
      return [];
    }
  });
  useEffect(() => save('grupos', grupos), [grupos]);

  // Visibilidade: aluno vê só o seu
  const meuGrupo = useMemo(() => {
    if (isStudent) {
      return grupos.find(g => g.membros?.some(m => m.ra === perfil.ra));
    }
    return null;
  }, [grupos, perfil, isStudent]);
  const gruposVisiveis = useMemo(() => (isStudent ? (meuGrupo ? [meuGrupo] : []) : grupos), [grupos, isStudent, meuGrupo]);

  // =========================
  // Abas
  // =========================
  const tabs = ['criar', 'editar'];
  const pickDefaultTab = () => {
    const qs = new URLSearchParams(location.search);
    const t = qs.get('tab');
    if (tabs.includes(t)) return t;
    // aluno sem grupo -> criar; caso contrário, editar
    if (isStudent) return meuGrupo ? 'editar' : 'criar';
    return 'criar';
  };
  const [aba, setAba] = useState(pickDefaultTab());
  useEffect(() => {
    const qs = new URLSearchParams(location.search);
    const t = qs.get('tab');
    if (t && tabs.includes(t) && t !== aba) setAba(t);
  }, [location.search]); // eslint-disable-line

  // =========================
  // Mensagens
  // =========================
  const [message, setMessage] = useState('');

  // =========================
  // CRIAR
  // =========================
  const [createForm, setCreateForm] = useState(initialCreate);
  const [createMembros, setCreateMembros] = useState(() => getInitialMembrosState(isStudent, perfil));
  const handleCreateChange = (e) => setCreateForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  const handleCreateMemberChange = (index, e) => {
    if (isStudent && index === 0) return; // aluno não edita a si mesmo
    const copy = [...createMembros];
    copy[index][e.target.name] = e.target.value;
    setCreateMembros(copy);
  };
  const addCreateMember = () => setCreateMembros([...createMembros, { nome: '', ra: '', telefone: '' }]);
  const removeCreateMember = (index) => {
    if (createMembros.length > 1 && !isStudent) {
      const copy = [...createMembros];
      copy.splice(index, 1);
      setCreateMembros(copy);
    }
  };
  const submitCreate = (e) => {
    e.preventDefault();
    if (!createForm.nome.trim() ||
        (isStudent && createMembros.some(m => !m.nome?.trim() || !m.ra?.trim())) ||
        (!isStudent && !createForm.metaArrecadacao)) {
      setMessage({ type: 'error', text: 'Por favor, preencha todos os campos obrigatórios.' });
      return;
    }
    const novoGrupo = {
      id: Date.now(),
      nome: createForm.nome.trim(),
      metaArrecadacao: isStudent ? 0 : (Number(createForm.metaArrecadacao) || 0),
      metaAlimentos: isStudent ? '' : (createForm.metaAlimentos || ''),
      membros: isStudent
        ? [
            {
              nome: perfil.nome || createMembros[0]?.nome || '',
              ra: perfil.ra || createMembros[0]?.ra || '',
              telefone: createMembros[0]?.telefone || '',
            },
            ...createMembros.slice(1).filter(m => m.nome && m.ra),
          ]
        : createMembros.filter(m => m.nome && m.ra),
      progressoArrecadacao: 0,
      inventario: [],
      // mentor + foto do mentor se criador for MENTOR
      mentor: isMentor ? (perfil.nome || 'Mentor') : undefined,
      mentorFotoUrl: isMentor ? (perfil.fotoUrl || '') : undefined,
    };
    setGrupos([...grupos, novoGrupo]);
    setMessage({ type: 'success', text: 'Grupo criado com sucesso!' });
    setCreateForm(initialCreate);
    setCreateMembros(getInitialMembrosState(isStudent, perfil));
    setTimeout(() => setMessage(''), 3000);
  };

  // =========================
  // EDITAR
  // =========================
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState(initialCreate);
  const [editMembros, setEditMembros] = useState([{ nome: '', ra: '', telefone: '' }]);

  // Abrir direto por query ?editar=<id>
  useEffect(() => {
    const qs = new URLSearchParams(location.search);
    const editParam = qs.get('editar');
    if (editParam) {
      const g = grupos.find(x => String(x.id) === String(editParam));
      if (g) startEdit(g);
      if (aba !== 'editar') setAba('editar');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search, grupos]);

  const startEdit = (g) => {
    setEditId(g.id);
    setEditForm({
      nome: g.nome,
      metaArrecadacao: String(g.metaArrecadacao ?? ''),
      metaAlimentos: g.metaAlimentos ?? '',
    });
    setEditMembros(
      g.membros?.length
        ? g.membros.map(m => ({ ...m, telefone: m.telefone ?? '' }))
        : [{ nome: '', ra: '', telefone: '' }]
    );
    window.scrollTo(0, 0);
    setMessage('');
  };

  const handleEditChange = (e) => setEditForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  const handleEditMemberChange = (index, e) => {
    if (isStudent && index === 0) return;
    const copy = [...editMembros];
    copy[index][e.target.name] = e.target.value;
    setEditMembros(copy);
  };
  const addEditMember = () => setEditMembros([...editMembros, { nome: '', ra: '', telefone: '' }]);
  const removeEditMember = (index) => {
    if (editMembros.length > 1 && !isStudent) {
      const copy = [...editMembros];
      copy.splice(index, 1);
      setEditMembros(copy);
    }
  };

  const submitEdit = (e) => {
    e.preventDefault();
    if (!editId) return;
    if (!editForm.nome.trim() ||
        (isStudent && editMembros.some(m => !m.nome?.trim() || !m.ra?.trim()))) {
      setMessage({ type: 'error', text: 'Por favor, preencha todos os campos obrigatórios.' });
      return;
    }
    setGrupos(grupos.map(g =>
      g.id === editId
        ? {
            ...g,
            nome: editForm.nome.trim(),
            metaArrecadacao: Number(editForm.metaArrecadacao) || 0,
            metaAlimentos: editForm.metaAlimentos || '',
            // apenas alunos podem editar membros do próprio grupo
            membros: isStudent ? editMembros.filter(m => m.nome && m.ra) : g.membros,
            // se mentor estiver editando, atualiza também o nome e a foto
            mentor: isMentor ? (perfil.nome || 'Mentor') : g.mentor,
            mentorFotoUrl: isMentor ? (perfil.fotoUrl || g.mentorFotoUrl || '') : g.mentorFotoUrl,
          }
        : g
    ));
    setMessage({ type: 'success', text: 'Grupo atualizado com sucesso!' });
    setEditId(null);
    setTimeout(() => setMessage(''), 3000);
  };

  const cancelEdit = () => { setEditId(null); setMessage(''); };

  const handleDelete = (id) => {
    if (!isMentorLike) return;
    if (window.confirm('Tem certeza que deseja excluir este grupo? Esta ação não pode ser desfeita.')) {
      setGrupos(grupos.filter(g => g.id !== id));
      setMessage({ type: 'success', text: 'Grupo excluído.' });
      if (editId === id) setEditId(null);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  // // =========================
  // // ATIVIDADES (migradas do Painel)
  // // =========================
  // const [atividades, setAtividades] = useState(() =>
  //   load("atividades", [
  //     // exemplo inicial opcional
  //   ])
  // );
  // useEffect(() => save("atividades", atividades), [atividades]);
  // const [abrirModalAtividade, setAbrirModalAtividade] = useState(false);
  // const [formAtividade, setFormAtividade] = useState({ titulo: '', descricao: '' });
  // const [errosAtividade, setErrosAtividade] = useState({});
  // const validarAtividade = () => {
  //   const errs = {};
  //   if (!formAtividade.titulo || formAtividade.titulo.trim().length < 3)
  //     errs.titulo = "Informe um título com pelo menos 3 caracteres.";
  //   setErrosAtividade(errs);
  //   return Object.keys(errs).length === 0;
  // };
  // const criarAtividade = (e) => {
  //   e.preventDefault();
  //   if (!validarAtividade()) return;
  //   const nova = {
  //     id: atividades.length ? Math.max(...atividades.map(a => a.id)) + 1 : 1,
  //     titulo: formAtividade.titulo.trim(),
  //     descricao: (formAtividade.descricao || "").trim(),
  //     concluida: false,
  //   };
  //   setAtividades(prev => [nova, ...prev]);
  //   setFormAtividade({ titulo: '', descricao: '' });
  //   setAbrirModalAtividade(false);
  // };
  // const removerAtividade = (id) => setAtividades(prev => prev.filter(a => a.id !== id));
  // const alternarConclusaoAtividade = (id) =>
  //   setAtividades(prev => prev.map(ativ => (ativ.id === id ? { ...ativ, concluida: !ativ.concluida } : ativ)));

  // =========================
  // Render
  // =========================
  return (
    <div className="grupos-page-container">
      <div className="grupos-page-header">
        <h1>Grupos</h1>
        <button onClick={() => navigate('/painel')} className="btn-secondary">
          Voltar ao Painel
        </button>
      </div>

      {/* Abas */}
      <div className="tabs" style={{display:'flex', gap:8, marginBottom:16}}>
        <button className={`btn-secondary ${aba==='criar' ? 'active' : ''}`} onClick={() => setAba('criar')}>Criar</button>
        <button className={`btn-secondary ${aba==='editar' ? 'active' : ''}`} onClick={() => setAba('editar')}>Editar</button>
      </div>

      {/* ---- ABA CRIAR ---- */}
      {aba === 'criar' && (
        <div className="form-card">
          <h2>Criar Novo Grupo</h2>
          <form onSubmit={submitCreate}>
            <div className="form-group">
              <label htmlFor="nome">Nome do Grupo</label>
              <input
                type="text"
                id="nome"
                name="nome"
                value={createForm.nome}
                onChange={handleCreateChange}
                placeholder="Ex: Campanha de Natal 2025"
                required
              />
            </div>

            {/* Membros */}
            <div className="form-group">
              <label>Membros do Grupo</label>
              {createMembros.map((m, index) => (
                <div key={index} className="member-input-group">
                  <input
                    type="text"
                    name="nome"
                    value={m.nome}
                    onChange={(e) => handleCreateMemberChange(index, e)}
                    placeholder="Nome do integrante"
                    required
                    disabled={(isStudent && index === 0)}
                  />
                  <input
                    type="text"
                    name="ra"
                    value={m.ra}
                    onChange={(e) => handleCreateMemberChange(index, e)}
                    placeholder="RA do integrante"
                    required
                    disabled={(isStudent && index === 0)}
                  />
                  <input
                    type="tel"
                    name="telefone"
                    value={m.telefone}
                    onChange={(e) => handleCreateMemberChange(index, e)}
                    placeholder="Telefone (Opcional)"
                  />
                  {(createMembros.length > 1 && !isStudent) && (
                    <button
                      type="button"
                      onClick={() => removeCreateMember(index)}
                      className="btn-danger-small"
                      title="Remover integrante"
                    >
                      X
                    </button>
                  )}
                </div>
              ))}
              <button type="button" onClick={addCreateMember} className="btn-secondary">
                Adicionar Membro
              </button>
            </div>

            {/* Metas (somente mentor/admin) */}
            {!isStudent && (
              <>
                <div className="form-group">
                  <label htmlFor="metaArrecadacao">Meta de Arrecadação (R$)</label>
                  <input
                    type="number"
                    id="metaArrecadacao"
                    name="metaArrecadacao"
                    value={createForm.metaArrecadacao}
                    onChange={handleCreateChange}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="metaAlimentos">Meta de Alimentos (Opcional)</label>
                  <input
                    type="text"
                    id="metaAlimentos"
                    name="metaAlimentos"
                    value={createForm.metaAlimentos}
                    onChange={handleCreateChange}
                    placeholder="Ex: 100 cestas básicas"
                  />
                </div>
              </>
            )}

            {/* Upload de Imagens (futuro) */}
            <div className="form-group">
              <label>Imagens do Grupo</label>
              <button type="button" className="btn-secondary" disabled title="Em breve">
                Upload de Imagens (em breve)
              </button>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn-primary">Criar Grupo</button>
            </div>
          </form>
          {message && <p className={`message ${message.type}`}>{message.text}</p>}
        </div>
      )}

      {/* ---- ABA EDITAR ---- */}
      {aba === 'editar' && (
        <>
          {/* Lista de grupos com Editar/Excluir (Excluir embaixo) */}
          <div className="list-card">
            <h2>Grupos Existentes</h2>
            {gruposVisiveis.length === 0 ? (
              <p>{isStudent ? 'Você ainda não faz parte de um grupo.' : 'Nenhum grupo cadastrado ainda.'}</p>
            ) : (
              <ul className="grupos-list">
                {gruposVisiveis.map(grupo => (
                  <li key={grupo.id} className="grupo-item">
                    <div className="grupo-info">
                      <h3>{grupo.nome}</h3>
                      <p>
                        Meta: R$ {(grupo.metaArrecadacao ?? 0).toFixed(2)} ·
                        {" "}
                        Arrecadado: R$ {(grupo.progressoArrecadacao ?? 0).toFixed(2)}
                      </p>
                      <div className="progress-bar-container">
                        <div
                          className="progress-bar-fill"
                          style={{
                            width: `${Math.min(((grupo.progressoArrecadacao ?? 0) / (grupo.metaArrecadacao || 1)) * 100, 100)}%`,
                          }}
                        />
                      </div>
                      {grupo.mentor && <p className="meta-alimentos">Mentor: {grupo.mentor}</p>}
                      {grupo.membros && grupo.membros.length > 0 && (
                        <div className="member-list">
                          <strong>Membros:</strong>
                          <ul>
                            {grupo.membros.map((m, i) => (
                              <li key={i}>
                                {m.nome} ({m.ra}){m.telefone && ` - ${m.telefone}`}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* AÇÕES: Editar + (Excluir embaixo) */}
                    <div className="grupo-actions" style={{display:'flex', flexDirection:'column', gap:8}}>
                      {/* Aluno pode editar seu grupo; mentor/admin qualquer um */}
                      {((!isStudent) || (isStudent && grupo.id === meuGrupo?.id)) && (
                        <button onClick={() => startEdit(grupo)}>Editar</button>
                      )}
                      {/* Excluir embaixo (somente mentor/adm) */}
                      {isMentorLike && (
                        <button onClick={() => handleDelete(grupo.id)} className="btn-danger">
                          Excluir
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Formulário de edição quando um grupo for escolhido */}
          {editId && (
            <div className="form-card" style={{marginTop:16}}>
              <h2>Editar Grupo</h2>
              <form onSubmit={submitEdit}>
                <div className="form-group">
                  <label htmlFor="nome">Nome do Grupo</label>
                  <input
                    type="text"
                    id="nome"
                    name="nome"
                    value={editForm.nome}
                    onChange={handleEditChange}
                    placeholder="Ex: Campanha de Natal 2025"
                    required
                    disabled={isStudent && editId === meuGrupo?.id ? false : false /* permitido renomear aqui */}
                  />
                </div>

                {/* Membros: apenas aluno (do próprio grupo) pode editar */}
                <div className="form-group">
                  <label>Membros do Grupo</label>
                  {editMembros.map((m, index) => (
                    <div key={index} className="member-input-group">
                      <input
                        type="text"
                        name="nome"
                        value={m.nome}
                        onChange={(e) => handleEditMemberChange(index, e)}
                        placeholder="Nome do integrante"
                        required
                        disabled={(!isStudent) || (isStudent && index === 0)}
                      />
                      <input
                        type="text"
                        name="ra"
                        value={m.ra}
                        onChange={(e) => handleEditMemberChange(index, e)}
                        placeholder="RA do integrante"
                        required
                        disabled={(!isStudent) || (isStudent && index === 0)}
                      />
                      <input
                        type="tel"
                        name="telefone"
                        value={m.telefone}
                        onChange={(e) => handleEditMemberChange(index, e)}
                        placeholder="Telefone (Opcional)"
                        disabled={!isStudent}
                      />
                      {(editMembros.length > 1 && !isStudent) && (
                        <button
                          type="button"
                          onClick={() => removeEditMember(index)}
                          className="btn-danger-small"
                          title="Remover integrante"
                        >
                          X
                        </button>
                      )}
                    </div>
                  ))}
                  {isStudent && (
                    <button type="button" onClick={addEditMember} className="btn-secondary">
                      Adicionar Membro
                    </button>
                  )}
                </div>

                {/* Metas (mentor/admin) */}
                {!isStudent && (
                  <>
                    <div className="form-group">
                      <label htmlFor="metaArrecadacao">Meta de Arrecadação (R$)</label>
                      <input
                        type="number"
                        id="metaArrecadacao"
                        name="metaArrecadacao"
                        value={editForm.metaArrecadacao}
                        onChange={handleEditChange}
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="metaAlimentos">Meta de Alimentos (Opcional)</label>
                      <input
                        type="text"
                        id="metaAlimentos"
                        name="metaAlimentos"
                        value={editForm.metaAlimentos}
                        onChange={handleEditChange}
                        placeholder="Ex: 100 cestas básicas"
                      />
                    </div>
                  </>
                )}

                {/* Upload de Imagens (futuro) */}
                <div className="form-group">
                  <label>Imagens do Grupo</label>
                  <button type="button" className="btn-secondary" disabled title="Em breve">
                    Upload de Imagens (em breve)
                  </button>
                </div>

                <div className="form-actions">
                  <button type="submit" className="btn-primary">Salvar Alterações</button>
                  <button type="button" className="btn-secondary" onClick={cancelEdit}>
                    Cancelar
                  </button>
                </div>
              </form>
              {message && <p className={`message ${message.type}`}>{message.text}</p>}
            </div>
          )}
        </>
      )}

      {/* ---- ABA ATIVIDADES ---- */}
      {aba === 'atividades' && (
        <section className="list-card">
          <h2>Minhas Atividades</h2>
          <div style={{marginBottom:12}}>
            <button className="btn-primary" onClick={() => setAbrirModalAtividade(true)}>+ Adicionar Atividade</button>
          </div>
          {atividades.length === 0 ? (
            <p>Nenhuma atividade cadastrada.</p>
          ) : (
            <div className="atividades-lista">
              {atividades.map(ativ => (
                <div key={ativ.id} className={`atividade-card ${ativ.concluida ? "concluida" : ""}`} style={{
                  background:'#e6f7eb',
                  borderRadius:12,
                  padding:'10px 12px',
                  display:'flex',
                  alignItems:'center',
                  justifyContent:'space-between',
                  marginBottom:10
                }}>
                  <div className="atividade-card__main" style={{display:'flex', alignItems:'center', gap:10}}>
                    <input
                      type="checkbox"
                      checked={ativ.concluida}
                      onChange={() => alternarConclusaoAtividade(ativ.id)}
                      title={ativ.concluida ? "Marcar como pendente" : "Marcar como concluída"}
                    />
                    <div>
                      <h3 style={{margin:'0 0 4px 0'}}>{ativ.titulo}</h3>
                      {ativ.descricao && <p style={{margin:0}}>{ativ.descricao}</p>}
                    </div>
                  </div>
                  <button className="btn btn-danger" onClick={() => removerAtividade(ativ.id)} title="Excluir atividade">
                    Excluir
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Modal Atividade
          {abrirModalAtividade && (
            <div className="modal-overlay" onClick={() => setAbrirModalAtividade(false)} style={{
              position:'fixed', inset:0, background:'rgba(0,0,0,0.3)', display:'grid', placeItems:'center'
            }}>
              <div className="modal" onClick={(e) => e.stopPropagation()} style={{
                background:'#fff', borderRadius:12, width:'min(560px, 92vw)', padding:16
              }}>
                <div className="modal-header" style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                  <h3>Nova Atividade</h3>
                  <button className="btn btn-ghost" onClick={() => setAbrirModalAtividade(false)}>✕</button>
                </div>
                <form className="modal-body" onSubmit={criarAtividade}>
                  <label style={{display:'block', marginBottom:10}}>
                    Título
                    <input
                      className={`input ${errosAtividade.titulo ? "input-error" : ""}`}
                      type="text"
                      value={formAtividade.titulo}
                      onChange={(e) => setFormAtividade(s => ({ ...s, titulo: e.target.value }))}
                      autoFocus
                      style={{width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid #b7e4c7'}}
                    />
                    {errosAtividade.titulo && <span className="error-text" style={{color:'#d90429'}}>{errosAtividade.titulo}</span>}
                  </label>
                  <label style={{display:'block', marginBottom:10}}>
                    Descrição (opcional)
                    <textarea
                      className="input"
                      rows={3}
                      value={formAtividade.descricao}
                      onChange={(e) => setFormAtividade(s => ({ ...s, descricao: e.target.value }))}
                      style={{width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid #b7e4c7'}}
                    />
                  </label>
                  <div className="modal-actions" style={{display:'flex', justifyContent:'flex-end', gap:8}}>
                    <button type="button" className="btn btn-ghost" onClick={() => setAbrirModalAtividade(false)}>Cancelar</button>
                    <button type="submit" className="btn btn-primary">Criar</button>
                  </div>
                </form>
              </div>
            </div>
          )} */}
        </section>
      )}
    </div>
  );
}