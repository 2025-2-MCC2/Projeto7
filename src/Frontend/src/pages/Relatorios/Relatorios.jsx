/*
 ATUALIZADO:
 - Remove duplicação de /api nos endpoints (usa /relatorios-mensais).
 - Move useMemo(s) de filtros do mentor para o topo do componente (ordem de Hooks estável).
 - toLocaleString seguro com (valor ?? 0).
 - Remove dependência de 'now' no carregamento de rascunho.
*/
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../../auth/api';
import './Relatorios.css';

// --- Constantes ---
const STATUS = {
  RASCUNHO: 'rascunho',
  ENVIADO: 'enviado',
  APROVADO: 'aprovado',
  AJUSTES: 'ajustes',
};
const DRAFT_KEY = 'relatorios_drafts';

// --- Helpers ---
const safeGet = (k, fallback) => {
  try {
    const raw = localStorage.getItem(k);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};
const safeSet = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {}
};
const pad2 = (n) => String(n).padStart(2, '0');
const getMonthKey = (date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
const toISO = (y, m, d) => `${y}-${pad2(m)}-${pad2(d)}`;
const isEditable = (report) => {
  if (!report) return true; // Criando novo
  return (
    report.status === STATUS.AJUSTES ||
    report.status === STATUS.RASCUNHO ||
    report.status === STATUS.ENVIADO
  );
};

/**
 * ===========================
 * COMPONENTE PRINCIPAL
 * ===========================
 */
export default function Relatorios() {
  const navigate = useNavigate();

  // --- Perfil (carregado do localStorage) ---
  const [perfil] = useState(() =>
    safeGet('perfil', { nome: 'Usuário', tipo: 'aluno', ra: '12345', id: null, assignedGroups: [] })
  );

  // --- Estado principal (dados vindos da API) ---
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState(() => safeGet(DRAFT_KEY, {}));
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const errorRef = useRef(null);
  const successRef = useRef(null);

  // Carrega dados da API ao iniciar
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const res = await api.get('/relatorios-mensais'); // <- sem /api duplicado
        setReports(res.data);
      } catch (err) {
        console.error('Erro ao carregar relatórios:', err);
        setErrorMsg('Falha ao carregar relatórios. Tente recarregar a página.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Persiste rascunhos
  useEffect(() => safeSet(DRAFT_KEY, drafts), [drafts]);

  // Foco em mensagens
  useEffect(() => {
    if (errorMsg && errorRef.current) errorRef.current.focus();
  }, [errorMsg]);
  useEffect(() => {
    if (successMsg && successRef.current) successRef.current.focus();
  }, [successMsg]);

  const resetMessages = () => {
    setErrorMsg('');
    setSuccessMsg('');
  };
  const setError = (msg) => {
    setSuccessMsg('');
    setErrorMsg(msg);
  };
  const setSuccess = (msg) => {
    setErrorMsg('');
    setSuccessMsg(msg);
  };

  // --- Usuário atual (role/atribuições) ---
  const currentUserRel = useMemo(
    () => ({
      role: perfil.tipo === 'mentor' || perfil.tipo === 'adm' ? 'mentor' : 'aluno',
      name: perfil.nome || 'Usuário',
      ra: perfil.ra || '',
      id: perfil.id, // ID do usuário no banco
      assignedGroups: perfil.assignedGroups || [], // nomes de grupos (mentor)
    }),
    [perfil]
  );

  // TODO: Os grupos também deveriam vir da API
  const [grupos] = useState(() => safeGet('grupos', []));
  const gruposVisiveis = useMemo(() => {
    if (currentUserRel.role === 'aluno') {
      return grupos.filter((g) => g.membros?.some((m) => m.ra === currentUserRel.ra));
    }
    // mentor/adm vê todos (ou filtrará por assignedGroups nos relatórios)
    return grupos;
  }, [grupos, currentUserRel]);

  const [selectedGroupId, setSelectedGroupId] = useState(null);
  useEffect(() => {
    if (gruposVisiveis.length > 0) setSelectedGroupId(gruposVisiveis[0].id);
    else setSelectedGroupId(null);
  }, [gruposVisiveis]);

  // --- Formulário (Aluno) ---
  const [selDay, setSelDay] = useState(1);
  const [selMonth, setSelMonth] = useState(() => new Date().getMonth() + 1);
  const [selYear, setSelYear] = useState(() => new Date().getFullYear());
  const selectedDate = useMemo(() => new Date(selYear, selMonth - 1, selDay), [selYear, selMonth, selDay]);
  const selectedMonthKey = useMemo(() => getMonthKey(selectedDate), [selectedDate]);

  const [editingReport, setEditingReport] = useState(null);
  const [newReportContent, setNewReportContent] = useState('');
  const [valorArrecadado, setValorArrecadado] = useState('');
  const [kgAlimentos, setKgAlimentos] = useState('');
  const [qtdCestas, setQtdCestas] = useState('');
  const [parceiros, setParceiros] = useState('');
  const [localAtividade, setLocalAtividade] = useState('');
  const contentRef = useRef(null);

  const draftKey = useMemo(() => {
    if (!selectedGroupId) return '';
    return `${currentUserRel.id}::${selectedGroupId}::${selectedMonthKey}`;
  }, [selectedGroupId, selectedMonthKey, currentUserRel.id]);

  // Carrega rascunho quando trocar grupo/mês/usuário
  useEffect(() => {
    if (!draftKey) return;
    const d = drafts[draftKey];
    if (d) {
      setNewReportContent(d.content || '');
      setValorArrecadado(d.valorArrecadado || '');
      setKgAlimentos(d.kgAlimentos || '');
      setQtdCestas(d.qtdCestas || '');
      setParceiros(d.parceiros || '');
      setLocalAtividade(d.localAtividade || '');
      if (d.selDay) setSelDay(d.selDay);
      if (d.selMonth) setSelMonth(d.selMonth);
      if (d.selYear) setSelYear(d.selYear);
    } else {
      setNewReportContent('');
      setValorArrecadado('');
      setKgAlimentos('');
      setQtdCestas('');
      setParceiros('');
      setLocalAtividade('');
      // defaults de data: hoje
      const today = new Date();
      setSelDay(1);
      setSelMonth(today.getMonth() + 1);
      setSelYear(today.getFullYear());
    }
    // NÃO incluir 'now' em deps para não rodar a cada render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  // Auto-salvar rascunho
  useEffect(() => {
    if (!draftKey) return;
    const t = setTimeout(() => {
      setDrafts((prev) => ({
        ...prev,
        [draftKey]: {
          content: newReportContent,
          valorArrecadado,
          kgAlimentos,
          qtdCestas,
          parceiros,
          localAtividade,
          selDay,
          selMonth,
          selYear,
        },
      }));
    }, 1000);
    return () => clearTimeout(t);
  }, [
    draftKey,
    newReportContent,
    valorArrecadado,
    kgAlimentos,
    qtdCestas,
    parceiros,
    localAtividade,
    selDay,
    selMonth,
    selYear,
  ]);

  // Relatório do mês (do aluno logado)
  const myMonthReport = useMemo(() => {
    if (currentUserRel.role !== 'aluno' || !selectedGroupId) return null;
    return (
      reports.find(
        (r) =>
          r.groupId === selectedGroupId &&
          r.authorId === currentUserRel.id &&
          r.month === selectedMonthKey
      ) || null
    );
  }, [reports, selectedGroupId, selectedMonthKey, currentUserRel]);

  const podeEditar = useMemo(() => isEditable(editingReport || myMonthReport), [myMonthReport, editingReport]);

  /**
   * ===========================
   * Salvar (Criar/Atualizar) na API
   * ===========================
   */
  const handleCreateOrUpdateReport = async () => {
    resetMessages();
    if (currentUserRel.role !== 'aluno' || !currentUserRel.id) {
      return setError('Perfil de aluno inválido. Faça login novamente.');
    }
    if (!selectedGroupId) {
      return setError('Você precisa estar em um grupo para criar relatório.');
    }
    if (!newReportContent.trim()) {
      contentRef.current?.focus();
      return setError('O conteúdo do relatório não pode estar vazio.');
    }

    const payload = {
      groupId: selectedGroupId,
      authorId: currentUserRel.id, // ID do autor
      dateISO: toISO(selYear, selMonth, selDay),
      month: selectedMonthKey,
      content: newReportContent.trim(),
      valorArrecadado: Number(valorArrecadado) || 0,
      kgAlimentos: Number(kgAlimentos) || 0,
      qtdCestas: Number(qtdCestas) || 0,
      parceiros: parceiros.split(',').map((s) => s.trim()).filter(Boolean),
      localAtividade: localAtividade.trim(),
    };

    try {
      if (editingReport) {
        // ATUALIZAR (PUT)
        const res = await api.put(`/relatorios-mensais/${editingReport.id}`, {
          ...payload,
          authorId: editingReport.authorId, // checagem no backend
        });
        setReports(reports.map((r) => (r.id === editingReport.id ? res.data : r)));
        setEditingReport(null);
        setSuccess('Relatório atualizado com sucesso.');
      } else {
        // CRIAR (POST)
        const res = await api.post('/relatorios-mensais', payload);
        setReports([res.data, ...reports]); // Novo no topo
        setSuccess('Relatório criado com sucesso.');
      }

      // Limpa rascunho
      if (draftKey) {
        setDrafts((prev) => {
          const copy = { ...prev };
          delete copy[draftKey];
          return copy;
        });
      }
    } catch (err) {
      console.error('Erro ao salvar relatório:', err);
      setError(err.response?.data?.error || 'Erro ao salvar. Tente novamente.');
    }
  };

  // Carrega dados para edição (aluno)
  const handleEdit = (report) => {
    resetMessages();
    if (currentUserRel.role !== 'aluno' || report.authorId !== currentUserRel.id) {
      return setError('Você só pode editar o seu próprio relatório.');
    }
    if (!isEditable(report)) {
      return setError('Edição bloqueada (relatório aprovado). Peça ao mentor para marcar como "ajustes".');
    }
    setEditingReport(report);
    setSelectedGroupId(report.groupId);
    const [yy, mm, dd] = report.dateISO.split('T')[0].split('-').map(Number);
    setSelYear(yy);
    setSelMonth(mm);
    setSelDay(dd);
    setNewReportContent(report.content);
    setValorArrecadado(report.valorArrecadado ?? '');
    setKgAlimentos(report.kgAlimentos ?? '');
    setQtdCestas(report.qtdCestas ?? '');
    setParceiros((report.parceiros ?? []).join(', '));
    setLocalAtividade(report.localAtividade ?? '');

    // Limpa o rascunho para não sobrescrever a edição
    if (draftKey) {
      setDrafts((prev) => {
        const copy = { ...prev };
        delete copy[draftKey];
        return copy;
      });
    }
    contentRef.current?.focus();
  };

  const handleCancelEdit = () => {
    setEditingReport(null);
    resetMessages();
    const d = drafts[draftKey];
    if (d) setNewReportContent(d.content || '');
  };

  /**
   * ===========================
   * Ações do Mentor
   * ===========================
   */
  const [mentorFeedback, setMentorFeedback] = useState({});
  const onMentorChange = (id, field, value) => {
    setMentorFeedback((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] || {}),
        [field]: value,
      },
    }));
  };
  const handleMentorSave = async (report) => {
    const feedback = mentorFeedback[report.id]?.feedback ?? report.feedbackMentor;
    const status = mentorFeedback[report.id]?.status ?? report.status;
    try {
      const res = await api.put(`/relatorios-mensais/${report.id}/status`, {
        status,
        feedbackMentor: feedback,
        mentorId: currentUserRel.id,
      });
      setReports(reports.map((r) => (r.id === report.id ? res.data : r)));
      setMentorFeedback((prev) => ({ ...prev, [report.id]: undefined }));
      setSuccess(`Relatório de ${report.authorName} atualizado.`);
    } catch (err) {
      console.error('Erro ao atualizar status:', err);
      setError(err.response?.data?.error || 'Falha ao salvar feedback.');
    }
  };

  /**
   * ===========================
   * Exportação
   * ===========================
   */
  const [filters, setFilters] = useState({
    from: '',
    to: '',
    groupId: '',
    status: '',
    author: '',
  });
  const handleExport = (format) => {
    const queryParams = new URLSearchParams();
    if (filters.groupId) queryParams.append('groupId', filters.groupId);
    if (filters.status) queryParams.append('status', filters.status);
    if (filters.author) queryParams.append('author', filters.author);
    // TODO: Filtros de data (from/to)

    const url = `${api.defaults.baseURL}/relatorios-mensais/export/${format}?${queryParams.toString()}`;
    window.open(url, '_blank');
  };

  /**
   * ===========================
   * MEMOs promovidos (Mentor)
   * ===========================
   */
  const assignedNames = useMemo(
    () => new Set((currentUserRel.assignedGroups ?? []).map((n) => n.toLowerCase())),
    [currentUserRel.assignedGroups]
  );

  const mentorGroups = useMemo(() => {
    if (assignedNames.size === 0) return grupos; // vê todos
    return grupos.filter((g) => assignedNames.has(g.nome.toLowerCase()));
  }, [grupos, assignedNames]);

  const filteredReports = useMemo(() => {
    let list = [...reports];

    // Restringe aos grupos atribuídos (se houver)
    if (assignedNames.size > 0) {
      list = list.filter((r) => assignedNames.has(r.groupName.toLowerCase()));
    }

    // Filtros da UI
    if (filters.groupId) {
      list = list.filter((r) => String(r.groupId) === String(filters.groupId));
    }
    if (filters.status) {
      list = list.filter((r) => r.status === filters.status);
    }
    if (filters.author) {
      const q = filters.author.toLowerCase();
      list = list.filter(
        (r) => r.authorName.toLowerCase().includes(q) || (r.authorRA || '').includes(q)
      );
    }

    // Ordena por data desc
    list.sort((a, b) => (a.dateISO < b.dateISO ? 1 : a.dateISO > b.dateISO ? -1 : 0));
    return list;
  }, [reports, filters, assignedNames]);

  // --- Views ---
  const renderStudentView = () => {
    if (loading) return null;

    if (gruposVisiveis.length === 0) {
      return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <p className="msg warning" role="status">
            Você precisa fazer parte de um grupo para criar ou ver relatórios.
          </p>
        </motion.div>
      );
    }

    const hasReportThisMonth = Boolean(myMonthReport);
    const isReportApproved = myMonthReport?.status === STATUS.APROVADO;

    return (
      <motion.div
        className="view-container"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <header className="subheader">
          <h3>{editingReport ? 'Editando Relatório' : 'Seu Relatório Mensal'}</h3>
          <div className="status-pill">
            {hasReportThisMonth && !editingReport ? (
              <span className={`pill ${isReportApproved ? 'success' : 'warning'}`}>
                Mês {selectedMonthKey}: {myMonthReport.status}
              </span>
            ) : (
              <span className="pill warning">
                Mês {selectedMonthKey}: {editingReport ? 'editando' : 'pendente'}
              </span>
            )}
          </div>
        </header>

        {/* Seleção de Grupo */}
        <div className="row">
          <label htmlFor="group-select">
            <strong>Grupo:</strong>
          </label>
          <select
            id="group-select"
            className="input"
            value={selectedGroupId || ''}
            onChange={(e) => setSelectedGroupId(Number(e.target.value))}
            disabled={!!editingReport || (currentUserRel.role === 'aluno' && gruposVisiveis.length === 1)}
          >
            {gruposVisiveis.map((g) => (
              <option key={g.id} value={g.id}>
                {g.nome}
              </option>
            ))}
          </select>
        </div>

        {/* Data (dia/mês/ano) */}
        <div className="row">
          <label>
            <strong>Data do relatório:</strong>
          </label>
          <select
            className="input"
            aria-label="Dia"
            value={selDay}
            onChange={(e) => setSelDay(Number(e.target.value))}
            disabled={!podeEditar}
          >
            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <select
            className="input"
            aria-label="Mês"
            value={selMonth}
            onChange={(e) => setSelMonth(Number(e.target.value))}
            disabled={!podeEditar}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {pad2(m)}
              </option>
            ))}
          </select>
          <select
            className="input"
            aria-label="Ano"
            value={selYear}
            onChange={(e) => setSelYear(Number(e.target.value))}
            disabled={!podeEditar}
          >
            {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - 3 + i).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        {/* Campos estruturados */}
        <div className="grid grid-2">
          <label>
            Valor arrecadado (R$)
            <input
              type="number"
              min="0"
              step="0.01"
              value={valorArrecadado}
              onChange={(e) => setValorArrecadado(e.target.value)}
              disabled={!podeEditar}
            />
          </label>
          <label>
            Kg de alimentos
            <input
              type="number"
              min="0"
              step="0.1"
              value={kgAlimentos}
              onChange={(e) => setKgAlimentos(e.target.value)}
              disabled={!podeEditar}
            />
          </label>
          <label>
            Cestas básicas (qtde)
            <input
              type="number"
              min="0"
              step="1"
              value={qtdCestas}
              onChange={(e) => setQtdCestas(e.target.value)}
              disabled={!podeEditar}
            />
          </label>
          <label>
            Parceiros (separar por vírgula)
            <input
              type="text"
              value={parceiros}
              onChange={(e) => setParceiros(e.target.value)}
              disabled={!podeEditar}
            />
          </label>
          <label>
            Local da atividade
            <input
              type="text"
              value={localAtividade}
              onChange={(e) => setLocalAtividade(e.target.value)}
              disabled={!podeEditar}
            />
          </label>
        </div>

        {/* Conteúdo descritivo */}
        <label>
          Descrição do mês
          <textarea
            ref={contentRef}
            value={newReportContent}
            onChange={(e) => setNewReportContent(e.target.value)}
            placeholder="Descreva as arrecadações e atividades do mês (ex.: valores, kg coletados, locais, parceiros)."
            rows={6}
            disabled={!podeEditar}
          />
        </label>

        {!podeEditar && (
          <p className="msg info" role="status">
            Edição bloqueada (relatório aprovado). Se precisar alterar, peça ao mentor para marcar como
            “ajustes”.
          </p>
        )}

        {/* Ações */}
        <div className="actions">
          <button
            className="btn-primary"
            onClick={handleCreateOrUpdateReport}
            disabled={!podeEditar || !newReportContent.trim() || !selectedGroupId}
          >
            <i className="fa-solid fa-paper-plane"></i>
            {editingReport ? 'Atualizar Relatório' : 'Enviar Relatório'}
          </button>
          {editingReport && (
            <button className="btn-secondary" onClick={handleCancelEdit}>
              Cancelar
            </button>
          )}
        </div>

        {/* Visualização do relatório atual */}
        {myMonthReport && !editingReport && (
          <motion.div className="report-view" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <h4>Relatório Enviado ({myMonthReport.month})</h4>
            <p>
              <strong>Status:</strong>{' '}
              <span className={`status-chip ${myMonthReport.status}`}>{myMonthReport.status}</span>
            </p>
            <p>
              <strong>Autor:</strong> {myMonthReport.authorName}
            </p>
            <p>
              <strong>Grupo:</strong> {myMonthReport.groupName}
            </p>
            <p>
              <strong>Data:</strong> {new Date(myMonthReport.dateISO).toLocaleDateString()}
            </p>
            <p>
              <strong>Valor arrecadado:</strong>{' '}
              {(myMonthReport.valorArrecadado ?? 0).toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              })}
            </p>
            <p>
              <strong>Kg de alimentos:</strong> {myMonthReport.kgAlimentos} kg
            </p>
            <p>
              <strong>Cestas básicas:</strong> {myMonthReport.qtdCestas}
            </p>
            {myMonthReport.parceiros?.length > 0 && (
              <p>
                <strong>Parceiros:</strong> {myMonthReport.parceiros.join(', ')}
              </p>
            )}
            {myMonthReport.localAtividade && (
              <p>
                <strong>Local da atividade:</strong> {myMonthReport.localAtividade}
              </p>
            )}
            <p>
              <strong>Descrição:</strong> {myMonthReport.content}
            </p>
            {myMonthReport.feedbackMentor && (
              <div className="feedback-box">
                <strong>Feedback do mentor:</strong>
                <p>{myMonthReport.feedbackMentor}</p>
              </div>
            )}
            {isEditable(myMonthReport) && (
              <button className="btn-tertiary" onClick={() => handleEdit(myMonthReport)}>
                <i className="fa-solid fa-pen"></i> Editar
              </button>
            )}
          </motion.div>
        )}

        {/* Export/Import (Aluno) */}
        <div className="toolbar">
          <button className="btn-ghost" onClick={() => handleExport('pdf')} disabled={!myMonthReport}>
            <i className="fa-solid fa-file-pdf"></i> Exportar PDF
          </button>
          <button className="btn-ghost" disabled title="Em breve">
            <i className="fa-solid fa-file-csv"></i> Exportar CSV
          </button>
        </div>
      </motion.div>
    );
  };

  const renderMentorView = () => {
    if (loading) return null;

    return (
      <motion.div className="view-container" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <header className="subheader">
          <h3>Relatórios dos Grupos</h3>
          <div className="export-buttons">
            <button className="btn-secondary" onClick={() => handleExport('pdf')}>
              <i className="fa-solid fa-file-pdf"></i> Exportar PDF
            </button>
            <button className="btn-secondary" onClick={() => handleExport('csv')} disabled title="Em breve">
              <i className="fa-solid fa-file-csv"></i> Exportar CSV
            </button>
          </div>
        </header>

        {/* Filtros */}
        <div className="filters">
          {/* (Opcional) filtros de data futuramente */}
          <div className="filter-block">
            <label>
              Grupo
              <select
                className="input"
                value={filters.groupId}
                onChange={(e) => setFilters((f) => ({ ...f, groupId: e.target.value }))}
              >
                <option value="">Todos os grupos</option>
                {mentorGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nome}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="filter-block">
            <label>
              Status
              <select
                className="input"
                value={filters.status}
                onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
              >
                <option value="">Todos os status</option>
                {Object.values(STATUS).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="filter-block">
            <label>
              Autor (Nome ou RA)
              <input
                type="text"
                className="input"
                placeholder="Buscar por autor..."
                value={filters.author}
                onChange={(e) => setFilters((f) => ({ ...f, author: e.target.value }))}
              />
            </label>
          </div>
        </div>

        {/* Lista de relatórios */}
        <div className="report-list-mentor">
          <AnimatePresence>
            {filteredReports.length === 0 ? (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="msg info">
                Nenhum relatório encontrado para os filtros selecionados.
              </motion.p>
            ) : (
              filteredReports.map((report) => (
                <motion.div
                  key={report.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  className="report-card"
                >
                  <div className="report-head">
                    <h4>{report.groupName}</h4>
                    <span className={`status-chip ${report.status}`}>{report.status}</span>
                  </div>

                  <div className="report-meta">
                    <span>
                      <strong>Data:</strong> {new Date(report.dateISO).toLocaleDateString()}
                    </span>
                    <span>
                      <strong>Mês ref.:</strong> {report.month}
                    </span>
                    <span>
                      <strong>Autor:</strong> {report.authorName} ({report.authorRA})
                    </span>
                  </div>

                  <div className="report-body">
                    <p>
                      <strong>Valor:</strong>{' '}
                      {(report.valorArrecadado ?? 0).toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      })}
                    </p>
                    <p>
                      <strong>Kg:</strong> {report.kgAlimentos} kg
                    </p>
                    <p>
                      <strong>Cestas:</strong> {report.qtdCestas}
                    </p>
                    {report.parceiros?.length > 0 && (
                      <p>
                        <strong>Parceiros:</strong> {report.parceiros.join(', ')}
                      </p>
                    )}
                    {report.localAtividade && (
                      <p>
                        <strong>Local:</strong> {report.localAtividade}
                      </p>
                    )}
                    <p>
                      <strong>Descrição:</strong> {report.content}
                    </p>
                  </div>

                  {/* Ações do Mentor */}
                  <div className="mentor-actions">
                    <label>
                      Feedback ao aluno
                      <textarea
                        className="input"
                        value={mentorFeedback[report.id]?.feedback ?? (report.feedbackMentor || '')}
                        onChange={(e) => onMentorChange(report.id, 'feedback', e.target.value)}
                        rows={3}
                        placeholder="Escreva um feedback (ex: 'Ótimo trabalho!')"
                      />
                    </label>

                    <div className="grid grid-2">
                      <label>
                        Status
                        <select
                          className="input"
                          value={mentorFeedback[report.id]?.status ?? report.status}
                          onChange={(e) => onMentorChange(report.id, 'status', e.target.value)}
                        >
                          {Object.values(STATUS).map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </label>

                      <button
                        className="btn-primary"
                        onClick={() => handleMentorSave(report)}
                        style={{ alignSelf: 'flex-end' }}
                      >
                        <i className="fa-solid fa-check"></i>
                        Aprovar / Salvar
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    );
  };

  // --- Render principal ---
  return (
    <div className="relatorios-container">
      <header className="relatorios-header">
        <button className="btn-back" onClick={() => navigate(-1)} aria-label="Voltar">
          ‹ Voltar
        </button>
        <h2>Página de Relatórios</h2>
      </header>

      {/* Mensagens Globais */}
      <AnimatePresence>
        {errorMsg && (
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="msg error"
            tabIndex={-1}
            ref={errorRef}
            aria-live="assertive"
          >
            {errorMsg}
          </motion.p>
        )}
        {successMsg && (
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="msg success"
            tabIndex={-1}
            ref={successRef}
            aria-live="polite"
          >
            {successMsg}
          </motion.p>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="loading-spinner">Carregando relatórios...</div>
      ) : currentUserRel.role === 'aluno' ? (
        renderStudentView()
      ) : (
        renderMentorView()
      )}

      {/* Mensagens invisíveis para leitores de tela */}
      <div className="sr-only" aria-live="polite">
        {errorMsg || successMsg}
      </div>
    </div>
  );
}
