import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Relatorios.css';

/**
 * ===========================
 * CONSTANTES E UTILIDADES
 * ===========================
 */

const STATUS = {
  RASCUNHO: 'rascunho',
  ENVIADO: 'enviado',
  APROVADO: 'aprovado',
  AJUSTES: 'ajustes',
};

const SETTINGS_KEY = 'relatorios_prefs';
const REPORTS_KEY = 'relatorios';
const DRAFT_KEY = 'relatorios_drafts';

const DEFAULT_SETTINGS = {
  deadlineDay: 5, // último dia para editar o mês anterior
  remindersOn: false,
};

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

/**
 * Regra de edição:
 * - Permitido até o dia `deadlineDay` do mês seguinte ao `report.month` (YYYY-MM).
 * - Sempre permitido se status = AJUSTES.
 * - Bloqueado se status = APROVADO.
 */
const isEditable = (report, now = new Date(), deadlineDay = DEFAULT_SETTINGS.deadlineDay) => {
  if (!report) return true;
  if (report.status === STATUS.APROVADO) return false;
  if (report.status === STATUS.AJUSTES) return true;

  const [yy, mm] = report.month.split('-').map(Number);
  // Prazo: até o dia `deadlineDay` do mês seguinte (inclusive)
  // Ex.: mês 2025-09 => pode editar até 2025-10-(deadlineDay)
  const lock = new Date(yy, (mm - 1) + 1, deadlineDay + 1, 0, 0, 0); // 0-based months
  return now < lock;
};

/**
 * ===========================
 * MOCKS (trocar por API no futuro)
 * ===========================
 */

const mockGrupos = [
  { id: 1, nome: "Grupo A", membros: [{ nome: 'Aluno 1', ra: '12345' }] },
  { id: 2, nome: "Grupo B", membros: [{ nome: 'Aluno 2', ra: '54321' }] },
  { id: 3, nome: "Grupo C", membros: [{ nome: 'Aluno 3', ra: '98765' }] },
];

const mockReports = [
  {
    id: 1,
    groupId: 1,
    groupName: 'Grupo A',
    authorName: 'Aluno 1',
    authorRA: '12345',
    dateISO: '2025-09-30',
    month: '2025-09',
    content: 'Arrecadamos R$ 500,00 e 20kg de alimentos.',
    valorArrecadado: 500,
    kgAlimentos: 20,
    qtdCestas: 10,
    parceiros: ['ONG X', 'Mercado Y'],
    localAtividade: 'Bairro Centro',
    status: STATUS.ENVIADO,
    feedbackMentor: '',
    versions: [{ at: Date.now() - 1000 * 60 * 60 * 24, content: 'Arrecadamos R$ 500,00 e 20kg de alimentos.' }],
  }
];

// ⚠️ Em produção, receba via AuthContext/props.
const currentUser = { role: 'aluno', name: 'Aluno 1', ra: '12345' };
// Exemplo mentor:
// const currentUser = { role: 'mentor', name: 'Mentor X', assignedGroups: ['Grupo A', 'Grupo B'] };

/**
 * ===========================
 * COMPONENTE PRINCIPAL
 * ===========================
 */

const Relatorios = () => {
  const navigate = useNavigate();

  // Persistência
  const [settings, setSettings] = useState(() => safeGet(SETTINGS_KEY, DEFAULT_SETTINGS));
  const [reports, setReports] = useState(() => safeGet(REPORTS_KEY, mockReports));
  const [drafts, setDrafts] = useState(() => safeGet(DRAFT_KEY, {}));

  useEffect(() => safeSet(SETTINGS_KEY, settings), [settings]);
  useEffect(() => safeSet(REPORTS_KEY, reports), [reports]);
  useEffect(() => safeSet(DRAFT_KEY, drafts), [drafts]);

  // Mensagens + acessibilidade (foco gerenciado)
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const errorRef = useRef(null);
  const successRef = useRef(null);

  const resetMessages = () => {
    setErrorMsg('');
    setSuccessMsg('');
  };

  useEffect(() => {
    if (errorMsg && errorRef.current) errorRef.current.focus();
  }, [errorMsg]);

  useEffect(() => {
    if (successMsg && successRef.current) successRef.current.focus();
  }, [successMsg]);

  // Grupos visíveis
  const gruposVisiveis = useMemo(() => {
    if (currentUser.role === 'aluno') {
      return mockGrupos.filter(g => g.membros?.some(m => m.ra === currentUser.ra));
    }
    if (currentUser.role === 'mentor') {
      const setNames = new Set((currentUser.assignedGroups || []).map(n => n.toLowerCase()));
      return mockGrupos.filter(g => setNames.has(g.nome.toLowerCase()));
    }
    return mockGrupos;
  }, []);

  const [selectedGroupId, setSelectedGroupId] = useState(null);
  useEffect(() => {
    if (gruposVisiveis.length > 0) setSelectedGroupId(gruposVisiveis[0].id);
    else setSelectedGroupId(null);
  }, [gruposVisiveis]);

  // Data da criação/edição (dia/mês/ano)
  const now = new Date();
  const [selDay, setSelDay] = useState(now.getDate());
  const [selMonth, setSelMonth] = useState(now.getMonth() + 1);
  const [selYear, setSelYear] = useState(now.getFullYear());
  const selectedDate = useMemo(() => new Date(selYear, selMonth - 1, selDay), [selYear, selMonth, selDay]);
  const selectedMonthKey = useMemo(() => getMonthKey(selectedDate), [selectedDate]);

  // Campos do formulário (aluno)
  const [editingReport, setEditingReport] = useState(null);
  const [newReportContent, setNewReportContent] = useState('');
  const [valorArrecadado, setValorArrecadado] = useState('');
  const [kgAlimentos, setKgAlimentos] = useState('');
  const [qtdCestas, setQtdCestas] = useState('');
  const [parceiros, setParceiros] = useState('');
  const [localAtividade, setLocalAtividade] = useState('');
  const [statusAtual, setStatusAtual] = useState(STATUS.RASCUNHO);

  // Campo inicial para foco
  const contentRef = useRef(null);
  useEffect(() => {
    if (contentRef.current) contentRef.current.focus();
  }, [selectedGroupId]);

  // Rascunho: chave por aluno+grupo+mês
  const draftKey = useMemo(() => {
    if (!selectedGroupId) return '';
    return `${currentUser.ra || currentUser.name}::${selectedGroupId}::${selectedMonthKey}`;
  }, [selectedGroupId, selectedMonthKey]);

  // Carregar rascunho salvo ao trocar grupo ou mês
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
      setStatusAtual(d.status || STATUS.RASCUNHO);
    } else {
      setNewReportContent('');
      setValorArrecadado('');
      setKgAlimentos('');
      setQtdCestas('');
      setParceiros('');
      setLocalAtividade('');
      setStatusAtual(STATUS.RASCUNHO);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  // Auto-salvar rascunho (1s após digitar)
  useEffect(() => {
    if (!draftKey) return;
    const t = setTimeout(() => {
      setDrafts(prev => ({
        ...prev,
        [draftKey]: {
          content: newReportContent,
          valorArrecadado, kgAlimentos, qtdCestas, parceiros, localAtividade,
          status: statusAtual,
          selDay, selMonth, selYear
        }
      }));
    }, 1000);
    return () => clearTimeout(t);
  }, [
    draftKey,
    newReportContent, valorArrecadado, kgAlimentos, qtdCestas, parceiros, localAtividade, statusAtual,
    selDay, selMonth, selYear
  ]);

  // Report do mês selecionado do aluno (se existir)
  const myMonthReport = useMemo(() => {
    if (currentUser.role !== 'aluno' || !selectedGroupId) return null;
    return (
      reports.find(
        r =>
          r.groupId === selectedGroupId &&
          r.authorRA === (currentUser.ra || '') &&
          r.month === selectedMonthKey
      ) || null
    );
  }, [reports, selectedGroupId, selectedMonthKey]);

  const podeEditar = useMemo(
    () => isEditable(myMonthReport || editingReport, new Date(), settings.deadlineDay),
    [myMonthReport, editingReport, settings.deadlineDay]
  );

  // Atalho Ctrl/Cmd+S para salvar
  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (currentUser.role === 'aluno') handleCreateOrUpdateReport();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingReport, selectedGroupId, newReportContent, valorArrecadado, kgAlimentos, qtdCestas, parceiros, localAtividade, selDay, selMonth, selYear]);

  const setError = (msg) => {
    setSuccessMsg('');
    setErrorMsg(msg);
  };
  const setSuccess = (msg) => {
    setErrorMsg('');
    setSuccessMsg(msg);
  };

  const findGroupById = (id) => mockGrupos.find(g => g.id === id);

  /**
   * Criar/atualizar relatório (Aluno)
   */
  const handleCreateOrUpdateReport = () => {
    resetMessages();

    // Regras básicas
    if (currentUser.role !== 'aluno') {
      return setError('Apenas alunos podem criar/editar relatórios.');
    }
    if (!selectedGroupId) {
      return setError('Você precisa estar em um grupo para criar relatório.');
    }
    const selectedGroup = findGroupById(selectedGroupId);
    if (!selectedGroup || !selectedGroup.membros?.some(m => m.ra === currentUser.ra)) {
      return setError('Você não pertence ao grupo selecionado.');
    }
    if (!newReportContent.trim()) {
      if (contentRef.current) contentRef.current.focus();
      return setError('O conteúdo do relatório não pode estar vazio.');
    }
    if (!podeEditar) {
      return setError('Edição bloqueada (prazo encerrado ou relatório aprovado).');
    }

    const y = Number(selYear), m = Number(selMonth), d = Number(selDay);
    if (isNaN(y) || isNaN(m) || isNaN(d)) {
      return setError('Data inválida.');
    }
    const dateISO = toISO(y, m, d);
    const monthKey = `${y}-${pad2(m)}`;

    // EDITAR
    if (editingReport) {
      if (editingReport.authorRA !== currentUser.ra) {
        return setError('Você só pode editar o seu próprio relatório.');
      }

      const updated = reports.map(r =>
        r.id === editingReport.id
          ? {
              ...r,
              dateISO,
              month: monthKey,
              content: newReportContent.trim(),
              valorArrecadado: Number(valorArrecadado) || 0,
              kgAlimentos: Number(kgAlimentos) || 0,
              qtdCestas: Number(qtdCestas) || 0,
              parceiros: parceiros.split(',').map(s => s.trim()).filter(Boolean),
              localAtividade: localAtividade.trim(),
              status: STATUS.ENVIADO, // ao atualizar, volta para ENVIADO
              versions: [...(r.versions || []), { at: Date.now(), content: newReportContent.trim() }],
            }
          : r
      );

      setReports(updated);
      setEditingReport(null);
      setSuccess('Relatório atualizado com sucesso.');
      // Limpa rascunho desta chave
      if (draftKey) {
        setDrafts(prev => {
          const copy = { ...prev };
          delete copy[draftKey];
          return copy;
        });
      }
      return;
    }

    // CRIAR (um por aluno+grupo+mês)
    const exist = reports.some(
      r =>
        r.groupId === selectedGroupId &&
        r.authorRA === currentUser.ra &&
        r.month === monthKey
    );
    if (exist) {
      return setError('Você já possui um relatório para este grupo neste mês. Edite o existente.');
    }

    const newReport = {
      id: Date.now(),
      groupId: selectedGroupId,
      groupName: selectedGroup.nome,
      authorName: currentUser.name,
      authorRA: currentUser.ra,
      dateISO,
      month: monthKey,
      content: newReportContent.trim(),
      valorArrecadado: Number(valorArrecadado) || 0,
      kgAlimentos: Number(kgAlimentos) || 0,
      qtdCestas: Number(qtdCestas) || 0,
      parceiros: parceiros.split(',').map(s => s.trim()).filter(Boolean),
      localAtividade: localAtividade.trim(),
      status: STATUS.ENVIADO,
      feedbackMentor: '',
      versions: [{ at: Date.now(), content: newReportContent.trim() }],
    };

    setReports(prev => [...prev, newReport]);
    setSuccess('Relatório criado com sucesso.');
    // Limpa rascunho da chave
    if (draftKey) {
      setDrafts(prev => {
        const copy = { ...prev };
        delete copy[draftKey];
        return copy;
      });
    }
  };

  const handleEdit = (report) => {
    resetMessages();
    if (currentUser.role !== 'aluno') return setError('Somente alunos podem editar.');
    if (report.authorRA !== currentUser.ra) return setError('Você só pode editar o seu próprio relatório.');
    if (!isEditable(report, new Date(), settings.deadlineDay)) {
      return setError('Edição bloqueada (prazo encerrado ou relatório aprovado).');
    }

    setEditingReport(report);
    setSelectedGroupId(report.groupId);
    const [yy, mm, dd] = report.dateISO.split('-').map(Number);
    setSelYear(yy); setSelMonth(mm); setSelDay(dd);

    setNewReportContent(report.content);
    setValorArrecadado(report.valorArrecadado ?? '');
    setKgAlimentos(report.kgAlimentos ?? '');
    setQtdCestas(report.qtdCestas ?? '');
    setParceiros((report.parceiros || []).join(', '));
    setLocalAtividade(report.localAtividade ?? '');
    setStatusAtual(report.status || STATUS.RASCUNHO);

    if (contentRef.current) contentRef.current.focus();
  };

  const handleCancelEdit = () => {
    setEditingReport(null);
    setSuccess('Edição cancelada.');
  };

  /**
   * ===========================
   * VIEW: ALUNO
   * ===========================
   */
  const renderStudentView = () => {
    if (gruposVisiveis.length === 0) {
      return <p className="msg warning" role="status">Você precisa fazer parte de um grupo para criar ou ver relatórios.</p>;
    }

    const hasReportThisMonth = Boolean(myMonthReport);

    return (
      <div className="view-container">
        <header className="subheader">
          <h3>Seu Relatório Mensal</h3>
          <div className="status-pill">
            {hasReportThisMonth ? (
              <span className="pill success">Mês {selectedMonthKey}: enviado ✅</span>
            ) : (
              <span className="pill warning">Mês {selectedMonthKey}: pendente ⚠️</span>
            )}
          </div>
        </header>

        {/* Seleção de Grupo */}
        <div className="row">
          <label htmlFor="group-select"><strong>Grupo:</strong></label>
          <select
            id="group-select"
            value={selectedGroupId || ''}
            onChange={e => setSelectedGroupId(Number(e.target.value))}
          >
            {gruposVisiveis.map(g => <option key={g.id} value={g.id}>{g.nome}</option>)}
          </select>
        </div>

        {/* Data (dia/mês/ano) */}
        <div className="row">
          <label><strong>Data do relatório:</strong></label>
          <select aria-label="Dia" value={selDay} onChange={e => setSelDay(Number(e.target.value))}>
            {Array.from({ length: 31 }, (_, i) => i + 1).map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select aria-label="Mês" value={selMonth} onChange={e => setSelMonth(Number(e.target.value))}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{pad2(m)}</option>)}
          </select>
          <select aria-label="Ano" value={selYear} onChange={e => setSelYear(Number(e.target.value))}>
            {Array.from({ length: 6 }, (_, i) => now.getFullYear() - 3 + i).map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {/* Campos estruturados */}
        <div className="grid grid-2">
          <label>Valor arrecadado (R$)
            <input type="number" min="0" step="0.01" value={valorArrecadado} onChange={e => setValorArrecadado(e.target.value)} disabled={!podeEditar} />
          </label>
          <label>Kg de alimentos
            <input type="number" min="0" step="0.1" value={kgAlimentos} onChange={e => setKgAlimentos(e.target.value)} disabled={!podeEditar} />
          </label>
          <label>Cestas básicas (qtde)
            <input type="number" min="0" step="1" value={qtdCestas} onChange={e => setQtdCestas(e.target.value)} disabled={!podeEditar} />
          </label>
          <label>Parceiros (separar por vírgula)
            <input type="text" value={parceiros} onChange={e => setParceiros(e.target.value)} disabled={!podeEditar} />
          </label>
          <label>Local da atividade
            <input type="text" value={localAtividade} onChange={e => setLocalAtividade(e.target.value)} disabled={!podeEditar} />
          </label>
        </div>

        {/* Conteúdo descritivo */}
        <label>Descrição do mês
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
            Edição bloqueada (prazo encerrado ou relatório aprovado). Se precisar alterar, peça ao mentor para marcar como “ajustes”.
          </p>
        )}

        {/* Ações */}
        <div className="actions">
          <button
            className="btn-primary"
            onClick={handleCreateOrUpdateReport}
            disabled={!podeEditar || !newReportContent.trim() || !selectedGroupId}
          >
            {editingReport ? 'Atualizar Relatório' : 'Criar Relatório'}
          </button>
          {editingReport && (
            <button className="btn-secondary" onClick={handleCancelEdit}>Cancelar</button>
          )}
        </div>

        {/* Mensagens com foco gerenciado */}
        {errorMsg && (
          <p className="msg error" tabIndex={-1} ref={errorRef} aria-live="assertive">
            {errorMsg}
          </p>
        )}
        {successMsg && (
          <p className="msg success" tabIndex={-1} ref={successRef} aria-live="polite">
            {successMsg}
          </p>
        )}

        {/* Visualização do relatório atual (se existir e não estiver em edição) */}
        {myMonthReport && !editingReport && (
          <div className="report-view">
            <h4>Relatório do mês atual</h4>
            <p><strong>Status:</strong> <span className={`status-chip ${myMonthReport.status}`}>{myMonthReport.status}</span></p>
            <p><strong>Autor:</strong> {myMonthReport.authorName}</p>
            <p><strong>Grupo:</strong> {myMonthReport.groupName}</p>
            <p><strong>Data:</strong> {myMonthReport.dateISO}</p>
            <p><strong>Valor arrecadado:</strong> R$ {Number(myMonthReport.valorArrecadado || 0).toFixed(2)}</p>
            <p><strong>Kg de alimentos:</strong> {Number(myMonthReport.kgAlimentos || 0)} kg</p>
            <p><strong>Cestas básicas:</strong> {Number(myMonthReport.qtdCestas || 0)}</p>
            {myMonthReport.parceiros?.length > 0 && (
              <p><strong>Parceiros:</strong> {myMonthReport.parceiros.join(', ')}</p>
            )}
            {myMonthReport.localAtividade && (
              <p><strong>Local da atividade:</strong> {myMonthReport.localAtividade}</p>
            )}
            <p><strong>Descrição:</strong> {myMonthReport.content}</p>

            {myMonthReport.feedbackMentor && (
              <div className="feedback-box">
                <strong>Feedback do mentor:</strong>
                <p>{myMonthReport.feedbackMentor}</p>
              </div>
            )}

            {isEditable(myMonthReport, new Date(), settings.deadlineDay) && (
              <button className="btn-tertiary" onClick={() => handleEdit(myMonthReport)}>Editar</button>
            )}
          </div>
        )}

        {/* Export/Import FUTURO (desabilitado por enquanto) */}
        <div className="toolbar">
          <button className="btn-ghost" disabled title="Em breve">Exportar JSON</button>
          <button className="btn-ghost" disabled title="Em breve">Exportar CSV</button>
          <label className="btn-ghost disabled" title="Em breve">
            Importar JSON
            <input type="file" accept="application/json" hidden disabled />
          </label>
        </div>
      </div>
    );
  };

  /**
   * ===========================
   * VIEW: MENTOR
   * ===========================
   */
  const [filters, setFilters] = useState({
    from: { d: '', m: '', y: '' },
    to: { d: '', m: '', y: '' },
    groupId: '',
    status: '',
    author: ''
  });

  const applyFilters = (list) => {
    let res = [...list];

    // Filtro de período (de/até)
    const { from, to } = filters;
    const fromISO = (from.d && from.m && from.y) ? toISO(from.y, from.m, from.d) : null;
    const toISOv = (to.d && to.m && to.y) ? toISO(to.y, to.m, to.d) : null;

    res = res.filter(r => {
      if (fromISO && r.dateISO < fromISO) return false;
      if (toISOv && r.dateISO > toISOv) return false;
      return true;
    });

    if (filters.groupId) {
      res = res.filter(r => String(r.groupId) === String(filters.groupId));
    }
    if (filters.status) {
      res = res.filter(r => r.status === filters.status);
    }
    if (filters.author) {
      const q = filters.author.toLowerCase();
      res = res.filter(r => r.authorName.toLowerCase().includes(q));
    }

    // Ordena por data decrescente
    res.sort((a, b) => (a.dateISO < b.dateISO ? 1 : a.dateISO > b.dateISO ? -1 : 0));
    return res;
  };

  const renderMentorView = () => {
    const assignedNames = new Set((currentUser.assignedGroups || []).map(n => n.toLowerCase()));
    const assignedReports = reports.filter(r => assignedNames.has(r.groupName.toLowerCase()));
    const filtered = applyFilters(assignedReports);

    return (
      <div className="view-container">
        <header className="subheader">
          <h3>Relatórios dos Grupos Designados</h3>
        </header>

        {/* Filtros */}
        <div className="filters">
          <div className="filter-block">
            <span>De:</span>
            <select aria-label="Dia de" value={filters.from.d} onChange={e => setFilters(f => ({ ...f, from: { ...f.from, d: e.target.value } }))}>
              <option value="">DD</option>
              {Array.from({ length: 31 }, (_, i) => i + 1).map(d => <option key={d} value={pad2(d)}>{pad2(d)}</option>)}
            </select>
            <select aria-label="Mês de" value={filters.from.m} onChange={e => setFilters(f => ({ ...f, from: { ...f.from, m: e.target.value } }))}>
              <option value="">MM</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={pad2(m)}>{pad2(m)}</option>)}
            </select>
            <select aria-label="Ano de" value={filters.from.y} onChange={e => setFilters(f => ({ ...f, from: { ...f.from, y: e.target.value } }))}>
              <option value="">AAAA</option>
              {Array.from({ length: 10 }, (_, i) => now.getFullYear() - 5 + i).map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          <div className="filter-block">
            <span>Até:</span>
            <select aria-label="Dia até" value={filters.to.d} onChange={e => setFilters(f => ({ ...f, to: { ...f.to, d: e.target.value } }))}>
              <option value="">DD</option>
              {Array.from({ length: 31 }, (_, i) => i + 1).map(d => <option key={d} value={pad2(d)}>{pad2(d)}</option>)}
            </select>
            <select aria-label="Mês até" value={filters.to.m} onChange={e => setFilters(f => ({ ...f, to: { ...f.to, m: e.target.value } }))}>
              <option value="">MM</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={pad2(m)}>{pad2(m)}</option>)}
            </select>
            <select aria-label="Ano até" value={filters.to.y} onChange={e => setFilters(f => ({ ...f, to: { ...f.to, y: e.target.value } }))}>
              <option value="">AAAA</option>
              {Array.from({ length: 10 }, (_, i) => now.getFullYear() - 5 + i).map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          <div className="filter-block">
            <label>Grupo
              <select value={filters.groupId} onChange={e => setFilters(f => ({ ...f, groupId: e.target.value }))}>
                <option value="">Todos</option>
                {gruposVisiveis.map(g => <option key={g.id} value={g.id}>{g.nome}</option>)}
              </select>
            </label>
          </div>

          <div className="filter-block">
            <label>Status
              <select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
                <option value="">Todos</option>
                {Object.values(STATUS).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
          </div>

          <div className="filter-block">
            <label>Autor
              <input type="text" placeholder="Buscar por autor" value={filters.author} onChange={e => setFilters(f => ({ ...f, author: e.target.value }))} />
            </label>
          </div>
        </div>

        {/* Lista */}
        {filtered.length === 0 ? (
          <p>Nenhum relatório encontrado para os filtros selecionados.</p>
        ) : (
          filtered.map(report => (
            <div key={report.id} className="report-card">
              <div className="report-head">
                <h4>{report.groupName}</h4>
                <span className={`status-chip ${report.status}`}>{report.status}</span>
              </div>
              <div className="report-meta">
                <span><strong>Data:</strong> {report.dateISO}</span>
                <span><strong>Mês ref.:</strong> {report.month}</span>
                <span><strong>Autor:</strong> {report.authorName}</span>
              </div>
              <div className="report-body">
                <p><strong>Valor:</strong> R$ {Number(report.valorArrecadado || 0).toFixed(2)}</p>
                <p><strong>Kg:</strong> {Number(report.kgAlimentos || 0)} kg</p>
                <p><strong>Cestas:</strong> {Number(report.qtdCestas || 0)}</p>
                {report.parceiros?.length > 0 && <p><strong>Parceiros:</strong> {report.parceiros.join(', ')}</p>}
                {report.localAtividade && <p><strong>Local:</strong> {report.localAtividade}</p>}
                <p><strong>Descrição:</strong> {report.content}</p>
              </div>

              {/* Feedback e status */}
              <div className="mentor-actions">
                <label>Feedback ao aluno
                  <textarea
                    value={report.feedbackMentor || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setReports(prev => prev.map(r => r.id === report.id ? { ...r, feedbackMentor: val } : r));
                    }}
                    rows={3}
                  />
                </label>

                <label>Status
                  <select
                    value={report.status}
                    onChange={(e) => {
                      const val = e.target.value;
                      setReports(prev => prev.map(r => r.id === report.id ? { ...r, status: val } : r));
                    }}
                  >
                    {Object.values(STATUS).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
              </div>
            </div>
          ))
        )}

        {/* Export/Import FUTURO (desabilitado por enquanto) */}
        <div className="toolbar">
          <button className="btn-ghost" disabled title="Em breve">Exportar JSON</button>
          <button className="btn-ghost" disabled title="Em breve">Exportar CSV</button>
          <label className="btn-ghost disabled" title="Em breve">
            Importar JSON
            <input type="file" accept="application/json" hidden disabled />
          </label>
        </div>
      </div>
    );
  };

  return (
    <div className="relatorios-container">
      <header className="relatorios-header">
        <button className="btn-back" onClick={() => navigate(-1)} aria-label="Voltar">‹ Voltar</button>
        <h2>Página de Relatórios</h2>
      </header>

      {currentUser.role === 'aluno' ? renderStudentView() : renderMentorView()}

      {/* Mensagens invisíveis para screen readers */}
      <div className="sr-only" aria-live="polite">{errorMsg || successMsg}</div>
    </div>
  );
};

export default Relatorios;

/**
 * ======================================
 * FUTURO (Export/Import) — Exemplo pronto
 * ======================================
 * 
 * // Baixar arquivo
 * const downloadFile = (filename, content, type = 'application/json') => {
 *   const blob = new Blob([content], { type });
 *   const url = URL.createObjectURL(blob);
 *   const a = document.createElement('a');
 *   a.href = url; a.download = filename; a.click();
 *   URL.revokeObjectURL(url);
 * };
 * 
 * // Exportar JSON:
 * const exportJSON = () => {
 *   downloadFile(`relatorios-${Date.now()}.json`, JSON.stringify(reports, null, 2));
 * };
 * 
 * // Exportar CSV:
 * const exportCSV = () => {
 *   const headers = [
 *     'id','groupId','groupName','authorName','authorRA','dateISO','month','status',
 *     'valorArrecadado','kgAlimentos','qtdCestas','parceiros','localAtividade','content'
 *   ];
 *   const rows = reports.map(r => ([
 *     r.id, r.groupId, r.groupName, r.authorName, r.authorRA, r.dateISO, r.month, r.status,
 *     r.valorArrecadado ?? '', r.kgAlimentos ?? '', r.qtdCestas ?? '',
 *     (r.parceiros || []).join('; '), r.localAtividade ?? '', (r.content || '').replace(/\n/g, ' ')
 *   ]));
 *   const csv = [headers.join(','), ...rows.map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
 *   downloadFile(`relatorios-${Date.now()}.csv`, `\uFEFF${csv}`, 'text/csv;charset=utf-8;');
 * };
 * 
 * // Importar JSON:
 * const importJSON = async (file) => {
 *   const text = await file.text();
 *   const data = JSON.parse(text);
 *   if (!Array.isArray(data)) throw new Error('JSON inválido');
 *   setReports(prev => [...prev, ...data]);
 * };
 */