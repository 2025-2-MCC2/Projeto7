// src/pages/Grupos/Grupos.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import './Grupos.css';

// Estado inicial para o formulário
const initialState = {
  nome: '',
  metaArrecadacao: '',
  metaAlimentos: '',
};

// Monta membros iniciais
const getInitialMembrosState = (isStudent, perfil) => {
  if (isStudent) {
    // Aluno criador já é o membro 0 (RA imutável para ele)
    return [{ nome: perfil.nome || '', ra: perfil.ra || '', telefone: '' }];
  }
  return [{ nome: '', ra: '', telefone: '' }];
};

export default function Grupos() {
  // Perfil do usuário
  const [perfil, setPerfil] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('perfil')) ?? {};
    } catch {
      return {};
    }
  });

  const isStudent = perfil.tipo === 'aluno';
  const isMentor = perfil.tipo === 'mentor';
  const isAdmin  = perfil.tipo === 'adm';
  const isMentorLike = isMentor || isAdmin; // Mentor OU Admin possuem poderes de edição/exclusão

  // Lista de grupos
  const [grupos, setGrupos] = useState(() => {
    try {
      const storedGrupos = JSON.parse(localStorage.getItem('grupos')) ?? [];
      return storedGrupos.map(g => ({ ...g, membros: g.membros ?? [] }));
    } catch {
      return [];
    }
  });

  // Grupo do aluno (se aluno) e grupos visíveis
  const meuGrupo = useMemo(() => {
    if (isStudent) {
      return grupos.find(g => g.membros?.some(m => m.ra === perfil.ra));
    }
    return null;
  }, [grupos, perfil, isStudent]);

  const gruposVisiveis = useMemo(() => {
    return isStudent ? (meuGrupo ? [meuGrupo] : []) : grupos;
  }, [grupos, isStudent, meuGrupo]);

  // Formulário
  const [formState, setFormState] = useState(initialState);
  const [isEditing, setIsEditing] = useState(null); // id do grupo em edição
  const [membros, setMembros] = useState(() => getInitialMembrosState(isStudent, perfil));
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    localStorage.setItem('grupos', JSON.stringify(grupos));
  }, [grupos]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormState(prev => ({ ...prev, [name]: value }));
  };

  // Membros
  const handleMemberChange = (index, event) => {
    // Aluno não altera seus próprios dados (índice 0)
    if (isStudent && index === 0) return;
    const values = [...membros];
    values[index][event.target.name] = event.target.value;
    setMembros(values);
  };

  const handleAddMember = () => {
    setMembros([...membros, { nome: '', ra: '', telefone: '' }]);
  };

  const handleRemoveMember = (index) => {
    // Permite remover até o último se NÃO for estudante
    if (membros.length > 1 && !isStudent) {
      const values = [...membros];
      values.splice(index, 1);
      setMembros(values);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Validações mínimas
    if (
      !formState.nome.trim() ||
      (isStudent && membros.some(m => !m.nome.trim() || !m.ra.trim())) ||
      (!isStudent && !formState.metaArrecadacao)
    ) {
      setMessage({ type: 'error', text: 'Por favor, preencha todos os campos obrigatórios.' });
      return;
    }

    if (isEditing) {
      // Atualizar grupo existente
      setGrupos(grupos.map(g =>
        g.id === isEditing
          ? {
              ...g,
              ...formState,
              metaArrecadacao: Number(formState.metaArrecadacao) || 0,
              metaAlimentos: formState.metaAlimentos || '',
              // Apenas alunos podem editar membros (do próprio grupo)
              membros: isStudent ? membros.filter(m => m.nome && m.ra) : g.membros,
              // Mentor é atribuído SOMENTE se quem edita for MENTOR (admin é fantasma)
              mentor: isMentor ? (perfil.nome || 'Mentor') : g.mentor,
            }
          : g
      ));
      setMessage({ type: 'success', text: 'Grupo atualizado com sucesso!' });
    } else {
      // Criar novo grupo
      const novoGrupo = {
        id: Date.now(),
        nome: formState.nome.trim(),
        metaArrecadacao: isStudent ? 0 : (Number(formState.metaArrecadacao) || 0),
        metaAlimentos: isStudent ? '' : (formState.metaAlimentos || ''),
        membros: isStudent
          ? [
              // Garante que o primeiro membro é o próprio aluno com RA imutável
              { nome: perfil.nome || membros[0]?.nome || '', ra: perfil.ra || membros[0]?.ra || '', telefone: membros[0]?.telefone || '' },
              ...membros.slice(1).filter(m => m.nome && m.ra),
            ]
          : membros.filter(m => m.nome && m.ra),
        progressoArrecadacao: 0,
        inventario: [],
        // Mentor é atribuído APENAS quando o criador é MENTOR (se for admin, deixa vazio)
        mentor: isMentor ? (perfil.nome || 'Mentor') : undefined,
      };
      setGrupos([...grupos, novoGrupo]);
      setMessage({ type: 'success', text: 'Grupo criado com sucesso!' });
    }

    // Reset
    setFormState(initialState);
    setIsEditing(null);
    setMembros(getInitialMembrosState(isStudent, perfil));
    setTimeout(() => setMessage(''), 3000);
  };

  const handleEdit = (grupo) => {
    setIsEditing(grupo.id);
    setFormState({
      nome: grupo.nome,
      metaArrecadacao: String(grupo.metaArrecadacao ?? ''),
      metaAlimentos: grupo.metaAlimentos ?? '',
    });
    setMembros(
      grupo.membros && grupo.membros.length > 0
        ? grupo.membros.map(m => ({ ...m, telefone: m.telefone ?? '' }))
        : [{ nome: '', ra: '', telefone: '' }]
    );
    setMessage('');
    window.scrollTo(0, 0);
  };

  const handleDelete = (id) => {
    // Apenas mentor/admin (isMentorLike) pode excluir
    if (!isMentorLike) return;
    if (window.confirm('Tem certeza que deseja excluir este grupo? Esta ação não pode ser desfeita.')) {
      setGrupos(grupos.filter(g => g.id !== id));
      setMessage({ type: 'success', text: 'Grupo excluído.' });
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleCancel = () => {
    setIsEditing(null);
    setFormState(initialState);
    setMembros(getInitialMembrosState(isStudent, perfil));
    setMessage('');
  };

  return (
    <div className="grupos-page-container">
      <div className="grupos-page-header">
        <h1>Gerenciar Grupos</h1>
        <button onClick={() => navigate('/painel')} className="btn-secondary">
          Voltar ao Painel
        </button>
      </div>

      {/* Formulário de Criação/Edição
          Alunos só veem o form se NÃO tiverem grupo ou se estiverem editando.
          Mentor/Admin SEMPRE veem. */}
      {((!isStudent) || !meuGrupo || isEditing) && (
        <div className="form-card">
          <h2>{isEditing ? 'Editar Grupo' : 'Criar Novo Grupo'}</h2>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="nome">Nome do Grupo</label>
              <input
                type="text"
                id="nome"
                name="nome"
                value={formState.nome}
                onChange={handleInputChange}
                placeholder="Ex: Campanha de Natal 2025"
                required
                disabled={isStudent && isEditing} // aluno não pode renomear o grupo
              />
            </div>

            {/* Membros */}
            <div className="form-group">
              <label>Membros do Grupo</label>

              {membros.map((membro, index) => (
                <div key={index} className="member-input-group">
                  <input
                    type="text"
                    name="nome"
                    value={membro.nome}
                    onChange={e => handleMemberChange(index, e)}
                    placeholder="Nome do integrante"
                    required
                    disabled={(!isStudent && isEditing) || (isStudent && index === 0)}
                  />
                  <input
                    type="text"
                    name="ra"
                    value={membro.ra}
                    onChange={e => handleMemberChange(index, e)}
                    placeholder="RA do integrante"
                    required
                    disabled={(!isStudent && isEditing) || (isStudent && index === 0)} // RA do aluno (índice 0) é imutável
                  />
                  <input
                    type="tel"
                    name="telefone"
                    value={membro.telefone}
                    onChange={e => handleMemberChange(index, e)}
                    placeholder="Telefone (Opcional)"
                    disabled={!isStudent && isEditing}
                  />
                  {(membros.length > 1 && !isStudent) && (
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(index)}
                      className="btn-danger-small"
                      title="Remover integrante"
                    >
                      X
                    </button>
                  )}
                </div>
              ))}

              <button type="button" onClick={handleAddMember} className="btn-secondary">
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
                    value={formState.metaArrecadacao}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="metaAlimentos">Meta de Alimentos (Opcional)</label>
                  <input
                    type="text"
                    id="metaAlimentos"
                    name="metaAlimentos"
                    value={formState.metaAlimentos}
                    onChange={handleInputChange}
                    placeholder="Ex: 100 cestas básicas"
                  />
                </div>
              </>
            )}

            <div className="form-actions">
              <button type="submit" className="btn-primary">
                {isEditing ? 'Salvar Alterações' : 'Criar Grupo'}
              </button>
              {isEditing && (
                <button type="button" className="btn-secondary" onClick={handleCancel}>
                  Cancelar
                </button>
              )}
            </div>
          </form>

          {message && <p className={`message ${message.type}`}>{message.text}</p>}
        </div>
      )}

      {/* Lista de Grupos */}
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
                    Arrecadado: R$ {(grupo.progressoArrecadacao ?? 0).toFixed(2)}
                  </p>

                  <div className="progress-bar-container">
                    <div
                      className="progress-bar-fill"
                      style={{
                        width: `${Math.min(((grupo.progressoArrecadacao ?? 0) / (grupo.metaArrecadacao || 1)) * 100, 100)}%`
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

                <div className="grupo-actions">
                  {/* Alunos podem editar seu próprio grupo; Mentor/ADM podem editar qualquer um */}
                  {(!isStudent || (isStudent && grupo.id === meuGrupo?.id)) && (
                    <button onClick={() => handleEdit(grupo)}>Editar</button>
                  )}
                  {/* Apenas Mentor/ADM podem excluir */}
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
    </div>
  );
}
