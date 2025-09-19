import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import './Grupos.css'; // Certifique-se de criar este arquivo CSS

// Estado inicial para o formulário, para facilitar o reset.
const initialState = {
  nome: '',
  metaArrecadacao: '',
  metaAlimentos: '', // NOVO: Meta de alimentos
};

// NOVO: Função para obter o estado inicial dos membros
const getInitialMembrosState = (isStudent, perfil) => {
  if (isStudent) {
    // Aluno que está criando o grupo já é o primeiro membro.
    return [{ nome: perfil.nome || '', ra: perfil.ra || '', telefone: '' }];
  }
  return [{ nome: '', ra: '', telefone: '' }];
};

export default function Grupos() {
  // CORREÇÃO: Lógica para identificar o tipo de usuário
  const [perfil, setPerfil] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('perfil')) || {};
    } catch {
      return {};
    }
  });
  const isStudent = perfil.tipo === 'aluno';

  // Estado para a lista de grupos, carregada do localStorage.
  const [grupos, setGrupos] = useState(() => {
    try {
      const storedGrupos = JSON.parse(localStorage.getItem('grupos')) || [];
      // Garante que todos os grupos tenham a propriedade 'membros'
      return storedGrupos.map(g => ({ ...g, membros: g.membros || [] }));
    } catch {
      return [];
    }
  });

  // NOVO: Filtra os grupos visíveis e identifica o grupo do aluno.
  const meuGrupo = useMemo(() => {
    if (isStudent) {
      return grupos.find(g => g.membros?.some(m => m.ra === perfil.ra));
    }
    return null;
  }, [grupos, perfil, isStudent]);

  const gruposVisiveis = useMemo(() => {
    return isStudent ? (meuGrupo ? [meuGrupo] : []) : grupos;
  }, [grupos, isStudent, meuGrupo]);

  // Estado para controlar o formulário (criação/edição).
  const [formState, setFormState] = useState(initialState);
  const [isEditing, setIsEditing] = useState(null); // Armazena o ID do grupo em edição.
  // NOVO: Estado para a lista de membros no formulário
  const [membros, setMembros] = useState(() => getInitialMembrosState(isStudent, perfil));

  const [message, setMessage] = useState(''); // Para feedback ao usuário.
  const navigate = useNavigate();

  useEffect(() => {
    // Salvar grupos no localStorage sempre que houver alteração
    localStorage.setItem('grupos', JSON.stringify(grupos));
  }, [grupos]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormState(prev => ({ ...prev, [name]: value }));
  };

  // NOVO: Funções para gerenciar a lista de membros no formulário
  const handleMemberChange = (index, event) => {
    const values = [...membros];
    values[index][event.target.name] = event.target.value;
    setMembros(values);
  };

  const handleAddMember = () => {
    setMembros([...membros, { nome: '', ra: '', telefone: '' }]);
  };

  const handleRemoveMember = (index) => {
    if (membros.length > 1 || !isStudent) { // Permite remover até o último se não for estudante
      const values = [...membros];
      values.splice(index, 1);
      setMembros(values);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formState.nome.trim() || (isStudent && membros.some(m => !m.nome.trim() || !m.ra.trim())) || (!isStudent && !formState.metaArrecadacao)) {
      setMessage({ type: 'error', text: 'Por favor, preencha todos os campos obrigatórios.' });
      return;
    }

    if (isEditing) {
      // Atualizar grupo existente
      setGrupos(grupos.map(g => g.id === isEditing ? {
        ...g, 
        ...formState, 
        metaArrecadacao: Number(formState.metaArrecadacao),
        metaAlimentos: formState.metaAlimentos,
        membros: isStudent ? membros.filter(m => m.nome && m.ra) : g.membros, // Apenas alunos podem editar membros
        mentor: isStudent ? g.mentor : perfil.nome, // Mentor se auto-atribui ao editar
      } : g));
      setMessage({ type: 'success', text: 'Grupo atualizado com sucesso!' });
    } else {
      // Criar novo grupo
      const novoGrupo = {
        id: Date.now(), // ID único baseado no timestamp
        nome: formState.nome.trim(),
        metaArrecadacao: isStudent ? 0 : (Number(formState.metaArrecadacao) || 0),
        metaAlimentos: isStudent ? '' : (formState.metaAlimentos || ''),
        membros: membros.filter(m => m.nome && m.ra),
        progressoArrecadacao: 0, // Inicia com 0
        inventario: [], // Inicia vazio
      };
      setGrupos([...grupos, novoGrupo]);
      setMessage({ type: 'success', text: 'Grupo criado com sucesso!' });
    }

    // Limpa o formulário e o modo de edição
    setFormState(initialState);
    setIsEditing(null);
    setMembros(getInitialMembrosState(isStudent, perfil));
    setTimeout(() => setMessage(''), 3000); // Limpa a mensagem após 3 segundos
  };

  const handleEdit = (grupo) => {
    setIsEditing(grupo.id);
    setFormState({
      nome: grupo.nome,
      metaArrecadacao: String(grupo.metaArrecadacao || ''),
      metaAlimentos: grupo.metaAlimentos || ''
    });
    // Preenche os membros se existirem, senão, começa com um campo vazio
    setMembros(grupo.membros && grupo.membros.length > 0 ? grupo.membros.map(m => ({...m, telefone: m.telefone || ''})) : [{ nome: '', ra: '', telefone: '' }]);
    setMessage('');
    window.scrollTo(0, 0); // Rola a página para o topo para ver o formulário
  };

  const handleDelete = (id) => {
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
      
      {/* Formulário de Criação/Edição */}
      {/* Alunos só veem o formulário se não tiverem grupo ou se estiverem editando. Mentores sempre veem. */}
      {(!isStudent || !meuGrupo || isEditing) && (
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
                disabled={isStudent && isEditing} // Aluno não pode editar o nome do grupo
              />
            </div>

            {/* Seção de Membros (alunos preenchem, mentores podem editar) */}
            
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
                      disabled={(!isStudent && isEditing) || (isStudent && index === 0)} // Mentor não edita, aluno não edita seus próprios dados
                    />
                    <input
                      type="text"
                      name="ra"
                      value={membro.ra}
                      onChange={e => handleMemberChange(index, e)}
                      placeholder="RA do integrante"
                      required
                      disabled={(!isStudent && isEditing) || (isStudent && index === 0)}
                    />
                    <input
                      type="tel"
                      name="telefone"
                      value={membro.telefone}
                      onChange={e => handleMemberChange(index, e)}
                      placeholder="Telefone (Opcional)"
                      disabled={!isStudent && isEditing}
                    />
                    {(membros.length > 1 || !isStudent) && (
                      <button type="button" onClick={() => handleRemoveMember(index)} className="btn-danger-small">X</button>
                    )}
                  </div>
                ))}
                
                  <button type="button" onClick={handleAddMember} className="btn-secondary">Adicionar Membro</button>
                
              </div>

            {/* Metas (visíveis para mentores/admins, ocultas para alunos na criação) */}
            {!isStudent && (
              <>
                {/* Fragmento para agrupar elementos */}
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
              <button type="submit" className="btn-primary">{isEditing ? 'Salvar Alterações' : 'Criar Grupo'}</button>
              {isEditing && <button type="button" className="btn-secondary" onClick={handleCancel}>Cancelar</button>}
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
                  <p>Meta: R$ {(grupo.metaArrecadacao ?? 0).toFixed(2)} | Arrecadado: R$ {(grupo.progressoArrecadacao ?? 0).toFixed(2)}</p>
                  <div className="progress-bar-container">
                    <div
                      className="progress-bar-fill"
                      style={{ width: `${Math.min(((grupo.progressoArrecadacao ?? 0) / (grupo.metaArrecadacao || 1)) * 100, 100)}%` }}
                    ></div>
                  </div>
                  {grupo.mentor && <p className="meta-alimentos">Mentor: {grupo.mentor}</p>}
                  {/* NOVO: Exibe a lista de membros */}
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
                  {/* Alunos podem editar seu próprio grupo, mentores podem editar qualquer um */}
                  {(!isStudent || (isStudent && grupo.id === meuGrupo?.id)) && (
                    <button onClick={() => handleEdit(grupo)}>Editar</button>
                  )}
                  {/* Apenas mentores podem excluir */}
                  {!isStudent && <button onClick={() => handleDelete(grupo.id)} className="btn-danger">Excluir</button>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
