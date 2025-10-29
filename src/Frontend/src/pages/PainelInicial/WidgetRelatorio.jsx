// src/pages/PainelInicial/WidgetRelatorio.jsx
// Este é o NOVO componente que contém o formulário de envio de relatório.

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
// (Mantenha os estilos do PainelInicial.css, pois este widget usa as mesmas classes)
import "./PainelInicial.css"; 

/* ============================================================================
 * Helpers de storage e utils (copiados do PainelInicial.jsx)
 * ==========================================================================*/
const load = (key, fallback) => {
  try { //
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
};
const save = (key, value) => localStorage.setItem(key, JSON.stringify(value)); //
const pad2 = (n) => String(n).padStart(2, "0"); //
const toYMD = (d) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; //

/* ============================================================================
 * Constantes/Helpers específicos de RELATÓRIOS
 * (copiados do PainelInicial.jsx)
 * ==========================================================================*/
const REL_STATUS = { //
  RASCUNHO: "rascunho",
  ENVIADO: "enviado",
  APROVADO: "aprovado",
  AJUSTES: "ajustes",
};
const REL_SETTINGS_KEY = "relatorios_prefs"; //
const REL_REPORTS_KEY = "relatorios"; //
const REL_DRAFT_KEY = "relatorios_drafts"; //
const REL_DEFAULT_SETTINGS = { //
  deadlineDay: 5,
  remindersOn: false,
};
const getMonthKey = (date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`; //
const toISO = (y, m, d) => `${y}-${pad2(m)}-${pad2(d)}`; //
const isEditableRel = (report, now = new Date(), deadlineDay = REL_DEFAULT_SETTINGS.deadlineDay) => { //
  if (!report) return true;
  if (report.status === REL_STATUS.APROVADO) return false;
  if (report.status === REL_STATUS.AJUSTES) return true;
  const [yy, mm] = report.month.split("-").map(Number);
  const lock = new Date(yy, (mm - 1) + 1, deadlineDay + 1, 0, 0, 0); // até o dia seguinte 00:00
  return now < lock;
};

/* ============================================================================
 * Componente principal do Widget
 * ==========================================================================*/
export default function WidgetRelatorio({ perfil, grupos }) {
  const navigate = useNavigate();

  /* ============================================================================
   * Lógica de RELATÓRIOS (movida do PainelInicial.jsx)
   * ==========================================================================*/
  const currentUserRel = useMemo(() => { //
    const role =
      (perfil.tipo === "mentor" || perfil.tipo === "professor") ? "mentor" : "aluno";
    const assignedGroups = grupos
      .filter((g) => (g.mentor || "").toLowerCase() === (perfil.nome || "").toLowerCase())
      .map((g) => g.nome);
    return {
      role,
      name: perfil.nome || "Usuário",
      ra: perfil.ra || "",
      assignedGroups,
    };
  }, [perfil, grupos]);

  const relGruposVisiveis = useMemo(() => { //
    if (currentUserRel.role === "aluno") {
      return grupos.filter((g) => g.membros?.some((m) => m.ra === currentUserRel.ra));
    }
    if (currentUserRel.role === "mentor") {
      const setNames = new Set((currentUserRel.assignedGroups ?? []).map((n) => n.toLowerCase()));
      const vis = grupos.filter((g) => setNames.has(g.nome.toLowerCase()));
      return vis.length ? vis : grupos;
    }
    return grupos;
  }, [grupos, currentUserRel]);

  const [relSettings, setRelSettings] = useState(() =>
    load(REL_SETTINGS_KEY, REL_DEFAULT_SETTINGS) //
  );
  const [relReports, setRelReports] = useState(() =>
    load(REL_REPORTS_KEY, []) //
  );
  const [relDrafts, setRelDrafts] = useState(() => load(REL_DRAFT_KEY, {})); //
  useEffect(() => save(REL_SETTINGS_KEY, relSettings), [relSettings]); //
  useEffect(() => save(REL_REPORTS_KEY, relReports), [relReports]); //
  useEffect(() => save(REL_DRAFT_KEY, relDrafts), [relDrafts]); //

  // Sincroniza com outras abas
  useEffect(() => { //
    const onStorage = (e) => {
      if (e.key === REL_REPORTS_KEY) setRelReports(load(REL_REPORTS_KEY, []));
      if (e.key === REL_SETTINGS_KEY) setRelSettings(load(REL_SETTINGS_KEY, REL_DEFAULT_SETTINGS));
      if (e.key === REL_DRAFT_KEY) setRelDrafts(load(REL_DRAFT_KEY, {}));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const [relErrorMsg, setRelErrorMsg] = useState(""); //
  const [relSuccessMsg, setRelSuccessMsg] = useState(""); //
  const relErrorRef = useRef(null); //
  const relSuccessRef = useRef(null); //
  const resetRelMessages = () => { setRelErrorMsg(""); setRelSuccessMsg(""); }; //
  useEffect(() => { if (relErrorMsg && relErrorRef.current) relErrorRef.current.focus(); }, [relErrorMsg]); //
  useEffect(() => { if (relSuccessMsg && relSuccessRef.current) relSuccessRef.current.focus(); }, [relSuccessMsg]); //

  const now = new Date(); //
  const [relSelectedGroupId, setRelSelectedGroupId] = useState(null); //
  useEffect(() => { //
    if (relGruposVisiveis.length > 0) setRelSelectedGroupId(relGruposVisiveis[0].id);
    else setRelSelectedGroupId(null);
  }, [relGruposVisiveis]);

  // --- ALTERAÇÃO SOLICITADA ---
  // A data agora é o dia 1 do mês atual
  const [relSelDay, setRelSelDay] = useState(1); // <-- ALTERADO DE now.getDate()
  const [relSelMonth, setRelSelMonth] = useState(now.getMonth() + 1); //
  const [relSelYear, setRelSelYear] = useState(now.getFullYear()); //
  // --- FIM DA ALTERAÇÃO ---

  const relSelectedDate = useMemo( //
    () => new Date(relSelYear, relSelMonth - 1, relSelDay),
    [relSelYear, relSelMonth, relSelDay]
  );
  const relSelectedMonthKey = useMemo( //
    () => getMonthKey(relSelectedDate),
    [relSelectedDate]
  );
  const [relEditingReport, setRelEditingReport] = useState(null); //
  const [relNewReportContent, setRelNewReportContent] = useState(""); //
  const [relValorArrecadado, setRelValorArrecadado] = useState(""); //
  const [relKgAlimentos, setRelKgAlimentos] = useState(""); //
  const [relQtdCestas, setRelQtdCestas] = useState(""); //
  const [relParceiros, setRelParceiros] = useState(""); //
  const [relLocalAtividade, setRelLocalAtividade] = useState(""); //
  const [relStatusAtual, setRelStatusAtual] = useState(REL_STATUS.RASCUNHO); //
  const relContentRef = useRef(null); //
  useEffect(() => { if (relContentRef.current) relContentRef.current.focus(); }, [relSelectedGroupId]); //

  const relDraftKey = useMemo(() => { //
    if (!relSelectedGroupId) return "";
    return `${currentUserRel.ra || currentUserRel.name}::${relSelectedGroupId}::${relSelectedMonthKey}`;
  }, [currentUserRel, relSelectedGroupId, relSelectedMonthKey]);

  // Carrega rascunho
  useEffect(() => { //
    if (!relDraftKey) return;
    const d = relDrafts[relDraftKey];
    if (d) {
      setRelNewReportContent(d.content || "");
      setRelValorArrecadado(d.valorArrecadado || "");
      setRelKgAlimentos(d.kgAlimentos || "");
      setRelQtdCestas(d.qtdCestas || "");
      setRelParceiros(d.parceiros || "");
      setRelLocalAtividade(d.localAtividade || "");
      setRelStatusAtual(d.status || REL_STATUS.RASCUNHO);
      // Mantém a data do rascunho se existir
      if (d.selDay) setRelSelDay(d.selDay);
      else setRelSelDay(1); // Garante que o padrão seja 1
      if (d.selMonth) setRelSelMonth(d.selMonth);
      if (d.selYear) setRelSelYear(d.selYear);
    } else {
      setRelNewReportContent("");
      setRelValorArrecadado("");
      setRelKgAlimentos("");
      setRelQtdCestas("");
      setRelParceiros("");
      setRelLocalAtividade("");
      setRelStatusAtual(REL_STATUS.RASCUNHO);
      // Reseta para dia 1
      setRelSelDay(1);
      setRelSelMonth(now.getMonth() + 1);
      setRelSelYear(now.getFullYear());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relDraftKey]);

  // Salva rascunho
  useEffect(() => { //
    if (!relDraftKey) return;
    const t = setTimeout(() => {
      setRelDrafts((prev) => ({
        ...prev,
        [relDraftKey]: {
          content: relNewReportContent,
          valorArrecadado: relValorArrecadado,
          kgAlimentos: relKgAlimentos,
          qtdCestas: relQtdCestas,
          parceiros: relParceiros,
          localAtividade: relLocalAtividade,
          status: relStatusAtual,
          selDay: relSelDay, selMonth: relSelMonth, selYear: relSelYear,
        },
      }));
    }, 1000);
    return () => clearTimeout(t);
  }, [
    relDraftKey,
    relNewReportContent, relValorArrecadado, relKgAlimentos, relQtdCestas, relParceiros, relLocalAtividade, relStatusAtual,
    relSelDay, relSelMonth, relSelYear
  ]);

  const relMyMonthReport = useMemo(() => { //
    if (currentUserRel.role !== "aluno" || !relSelectedGroupId) return null;
    return (
      relReports.find(
        (r) =>
          r.groupId === relSelectedGroupId &&
          r.authorRA === (currentUserRel.ra || "") &&
          r.month === relSelectedMonthKey
      ) || null
    );
  }, [relReports, relSelectedGroupId, relSelectedMonthKey, currentUserRel]);

  const relPodeEditar = useMemo( //
    () => isEditableRel(relMyMonthReport || relEditingReport, new Date(), relSettings.deadlineDay),
    [relMyMonthReport, relEditingReport, relSettings.deadlineDay]
  );

  // Ctrl+S
  useEffect(() => { //
    const onKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (currentUserRel.role === "aluno") handleRelCreateOrUpdate();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    relEditingReport, relSelectedGroupId, relNewReportContent,
    relValorArrecadado, relKgAlimentos, relQtdCestas, relParceiros, relLocalAtividade,
    relSelDay, relSelMonth, relSelYear, currentUserRel.role
  ]);

  const setRelError = (msg) => { setRelSuccessMsg(""); setRelErrorMsg(msg); }; //
  const setRelSuccess = (msg) => { setRelErrorMsg(""); setRelSuccessMsg(msg); }; //
  const relFindGroupById = (id) => grupos.find((g) => g.id === id); //

  const handleRelCreateOrUpdate = useCallback(() => { //
    resetRelMessages();
    if (currentUserRel.role !== "aluno") {
      return setRelError("Apenas alunos podem criar/editar relatórios.");
    }
    if (!relSelectedGroupId) {
      return setRelError("Você precisa estar em um grupo para criar relatório.");
    }
    const selectedGroup = relFindGroupById(relSelectedGroupId);
    if (!selectedGroup || !selectedGroup.membros?.some((m) => m.ra === currentUserRel.ra)) {
      return setRelError("Você não pertence ao grupo selecionado.");
    }
    if (!relNewReportContent.trim()) {
      if (relContentRef.current) relContentRef.current.focus();
      return setRelError("O conteúdo do relatório não pode estar vazio.");
    }
    if (!relPodeEditar) {
      return setRelError("Edição bloqueada (prazo encerrado ou relatório aprovado).");
    }
    const y = Number(relSelYear), m = Number(relSelMonth), d = Number(relSelDay);
    if (isNaN(y) || isNaN(m) || isNaN(d)) {
      return setRelError("Data inválida.");
    }
    const dateISO = toISO(y, m, d);
    const monthKey = `${y}-${pad2(m)}`;

    // Edição
    if (relEditingReport) { //
      if (relEditingReport.authorRA !== currentUserRel.ra) {
        return setRelError("Você só pode editar o seu próprio relatório.");
      }
      const updated = relReports.map((r) =>
        r.id === relEditingReport.id
          ? {
              ...r,
              dateISO,
              month: monthKey,
              content: relNewReportContent.trim(),
              valorArrecadado: Number(relValorArrecadado) || 0,
              kgAlimentos: Number(relKgAlimentos) || 0,
              qtdCestas: Number(relQtdCestas) || 0,
              parceiros: relParceiros
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
              localAtividade: relLocalAtividade.trim(),
              status: REL_STATUS.ENVIADO, // Ao editar, volta para enviado
              versions: [...(relEditingReport.versions || []), { at: Date.now(), content: relNewReportContent.trim() }],
            }
          : r
      );
      setRelReports(updated);
      setRelEditingReport(null);
      setRelSuccess("Relatório atualizado com sucesso.");
      if (relDraftKey) {
        setRelDrafts((prev) => {
          const copy = { ...prev };
          delete copy[relDraftKey];
          return copy;
        });
      }
      return;
    }

    // Criação
    const exist = relReports.some( //
      (r) =>
        r.groupId === relSelectedGroupId &&
        r.authorRA === currentUserRel.ra &&
        r.month === monthKey
    );
    if (exist) {
      return setRelError("Você já possui um relatório para este grupo neste mês. Edite o existente.");
    }
    const newReport = { //
      id: Date.now(),
      groupId: relSelectedGroupId,
      groupName: selectedGroup.nome,
      authorName: currentUserRel.name,
      authorRA: currentUserRel.ra,
      dateISO,
      month: monthKey,
      content: relNewReportContent.trim(),
      valorArrecadado: Number(relValorArrecadado) || 0,
      kgAlimentos: Number(relKgAlimentos) || 0,
      qtdCestas: Number(relQtdCestas) || 0,
      parceiros: relParceiros.split(",").map((s) => s.trim()).filter(Boolean),
      localAtividade: relLocalAtividade.trim(),
      status: REL_STATUS.ENVIADO,
      feedbackMentor: "",
      versions: [{ at: Date.now(), content: relNewReportContent.trim() }],
    };
    setRelReports((prev) => [...prev, newReport]);
    setRelSuccess("Relatório criado com sucesso.");
    if (relDraftKey) {
      setRelDrafts((prev) => {
        const copy = { ...prev };
        delete copy[relDraftKey];
        return copy;
      });
    }
  }, [
    currentUserRel, relSelectedGroupId, relNewReportContent, relValorArrecadado, relKgAlimentos,
    relQtdCestas, relParceiros, relLocalAtividade, relPodeEditar, relSelYear, relSelMonth, relSelDay,
    relEditingReport, relReports, relDraftKey, grupos, // Adicionado 'grupos'
  ]);

  const handleRelEdit = (report) => { //
    resetRelMessages();
    if (currentUserRel.role !== "aluno") return setRelError("Somente alunos podem editar.");
    if (report.authorRA !== currentUserRel.ra) return setRelError("Você só pode editar o seu próprio relatório.");
    if (!isEditableRel(report, new Date(), relSettings.deadlineDay)) {
      return setRelError("Edição bloqueada (prazo encerrado ou relatório aprovado).");
    }
    setRelEditingReport(report);
    setRelSelectedGroupId(report.groupId);
    const [yy, mm, dd] = report.dateISO.split("-").map(Number);
    setRelSelYear(yy); setRelSelMonth(mm); setRelSelDay(dd);
    setRelNewReportContent(report.content);
    setRelValorArrecadado(report.valorArrecadado ?? "");
    setRelKgAlimentos(report.kgAlimentos ?? "");
    setRelQtdCestas(report.qtdCestas ?? "");
    setRelParceiros((report.parceiros || []).join(", "));
    setRelLocalAtividade(report.localAtividade ?? "");
    setRelStatusAtual(report.status || REL_STATUS.RASCUNHO);
    if (relContentRef.current) relContentRef.current.focus();
  };

  const handleRelCancelEdit = () => { //
    setRelEditingReport(null);
    setRelSuccess("Edição cancelada.");
  };
  
  // Filtros (para view de mentor)
  const [relFilters, setRelFilters] = useState({ //
    from: { d: "", m: "", y: "" },
    to: { d: "", m: "", y: "" },
    groupId: "",
    status: "",
    author: "",
  });
  const applyRelFilters = (list) => { //
    let res = [...list];
    const { from, to } = relFilters;
    const fromISO = (from.d && from.m && from.y) ? toISO(from.y, from.m, from.d) : null;
    const toISOv = (to.d && to.m && to.y) ? toISO(to.y, to.m, to.d) : null;
    res = res.filter((r) => {
      if (fromISO && r.dateISO < fromISO) return false;
      if (toISOv && r.dateISO > toISOv) return false;
      return true;
    });
    if (relFilters.groupId) {
      res = res.filter((r) => String(r.groupId) === String(relFilters.groupId));
    }
    if (relFilters.status) {
      res = res.filter((r) => r.status === relFilters.status);
    }
    if (relFilters.author) {
      const q = relFilters.author.toLowerCase();
      res = res.filter((r) => r.authorName.toLowerCase().includes(q));
    }
    res.sort((a, b) => (a.dateISO < b.dateISO ? 1 : a.dateISO > b.dateISO ? -1 : 0));
    return res;
  };

  // JSX do Widget
  return (
    <section className="grupos-section">
      <div className="grupos-header">
        <h2>Relatórios</h2>
        <button className="criar-grupo" onClick={() => navigate('/relatorios')}>
          Abrir página completa
        </button>
      </div>
      
      {/* === View: ALUNO === */}
      {currentUserRel.role === "aluno" && ( //
        <div className="view-container">
          <header className="subheader">
            <h3>Seu Relatório Mensal</h3>
            <div className="status-pill">
              {relMyMonthReport ? (
                <span className="pill success">Mês {relSelectedMonthKey}: enviado ✅</span>
              ) : (
                <span className="pill warning">Mês {relSelectedMonthKey}: pendente ⚠️</span>
              )}
            </div>
          </header>
          {/* Seleção de Grupo */}
          <div className="row">
            <label htmlFor="rel-group-select"><strong>Grupo:</strong></label>
            <select
              id="rel-group-select"
              value={relSelectedGroupId || ""}
              onChange={(e) => setRelSelectedGroupId(Number(e.target.value))}
            >
              {relGruposVisiveis.map((g) => (
                <option key={g.id} value={g.id}>{g.nome}</option>
              ))}
            </select>
          </div>
          {/* Data (dia/mês/ano) */}
          <div className="row">
            <label><strong>Data do relatório:</strong></label>
            <select aria-label="Dia" value={relSelDay} onChange={(e) => setRelSelDay(Number(e.target.value))}>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <select aria-label="Mês" value={relSelMonth} onChange={(e) => setRelSelMonth(Number(e.target.value))}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{pad2(m)}</option>)}
            </select>
            <select aria-label="Ano" value={relSelYear} onChange={(e) => setRelSelYear(Number(e.target.value))}>
              {Array.from({ length: 6 }, (_, i) => now.getFullYear() - 3 + i).map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          {/* Campos estruturados */}
          <div className="grid grid-2">
            <label>Valor arrecadado (R$)
              <input type="number" min="0" step="0.01"
                value={relValorArrecadado}
                onChange={(e) => setRelValorArrecadado(e.target.value)}
                disabled={!relPodeEditar}
              />
            </label>
            <label>Kg de alimentos
              <input type="number" min="0" step="0.1"
                value={relKgAlimentos}
                onChange={(e) => setRelKgAlimentos(e.target.value)}
                disabled={!relPodeEditar}
              />
            </label>
            <label>Cestas básicas (qtde)
              <input type="number" min="0" step="1"
                value={relQtdCestas}
                onChange={(e) => setRelQtdCestas(e.target.value)}
                disabled={!relPodeEditar}
              />
            </label>
            <label>Parceiros (separar por vírgula)
              <input type="text"
                value={relParceiros}
                onChange={(e) => setRelParceiros(e.target.value)}
                disabled={!relPodeEditar}
              />
            </label>
            <label>Local da atividade
              <input type="text"
                value={relLocalAtividade}
                onChange={(e) => setRelLocalAtividade(e.target.value)}
                disabled={!relPodeEditar}
              />
            </label>
          </div>
          {/* Conteúdo descritivo */}
          <label>Descrição do mês
            <textarea
              ref={relContentRef}
              value={relNewReportContent}
              onChange={(e) => setRelNewReportContent(e.target.value)}
              placeholder="Descreva as arrecadações e atividades do mês (ex.: valores, kg coletados, locais, parceiros)."
              rows={6}
              disabled={!relPodeEditar}
            />
          </label>
          {!relPodeEditar && (
            <p className="msg info" role="status">
              Edição bloqueada (prazo encerrado ou relatório aprovado). Se precisar alterar, peça ao mentor para marcar como “ajustes”.
            </p>
          )}
          {/* Ações */}
          <div className="actions">
            <button
              className="btn-primary"
              onClick={handleRelCreateOrUpdate}
              disabled={!relPodeEditar || !relNewReportContent.trim() || !relSelectedGroupId}
            >
              {relEditingReport ? "Atualizar Relatório" : "Criar Relatório"}
            </button>
            {relEditingReport && (
              <button className="btn-secondary" onClick={handleRelCancelEdit}>Cancelar</button>
            )}
          </div>
          {/* Mensagens com foco gerenciado */}
          {relErrorMsg && (
            <p className="msg error" tabIndex={-1} ref={relErrorRef} aria-live="assertive">
              {relErrorMsg}
            </p>
          )}
          {relSuccessMsg && (
            <p className="msg success" tabIndex={-1} ref={relSuccessRef} aria-live="polite">
              {relSuccessMsg}
            </p>
          )}
          {/* Visualização do relatório atual (se existir e não estiver editando) */}
          {relMyMonthReport && !relEditingReport && (
            <div className="report-view">
              <h4>Relatório do mês atual</h4>
              <p><strong>Status:</strong> <span className={`status-chip ${relMyMonthReport.status}`}>{relMyMonthReport.status}</span></p>
              <p><strong>Autor:</strong> {relMyMonthReport.authorName}</p>
              <p><strong>Grupo:</strong> {relMyMonthReport.groupName}</p>
              <p><strong>Data:</strong> {relMyMonthReport.dateISO}</p>
              <p><strong>Valor arrecadado:</strong> R$ {(Number(relMyMonthReport.valorArrecadado || 0)).toFixed(2)}</p>
              <p><strong>Kg de alimentos:</strong> {Number(relMyMonthReport.kgAlimentos || 0)} kg</p>
              <p><strong>Cestas básicas:</strong> {Number(relMyMonthReport.qtdCestas || 0)}</p>
              {relMyMonthReport.parceiros?.length > 0 && (
                <p><strong>Parceiros:</strong> {relMyMonthReport.parceiros.join(", ")}</p>
              )}
              {relMyMonthReport.localAtividade && (
                <p><strong>Local da atividade:</strong> {relMyMonthReport.localAtividade}</p>
              )}
              <p><strong>Descrição:</strong> {relMyMonthReport.content}</p>
              {relMyMonthReport.feedbackMentor && (
                <div className="feedback-box">
                  <strong>Feedback do mentor:</strong>
                  <p>{relMyMonthReport.feedbackMentor}</p>
                </div>
              )}
              {isEditableRel(relMyMonthReport, new Date(), relSettings.deadlineDay) && (
                <button className="btn-tertiary" onClick={() => handleRelEdit(relMyMonthReport)}>
                  Editar
                </button>
              )}
            </div>
          )}
        </div>
      )}
      
      {/* === View: MENTOR/PROFESSOR === */}
      {currentUserRel.role === "mentor" && (() => { //
        const assignedNames = new Set((currentUserRel.assignedGroups ?? []).map((n) => n.toLowerCase()));
        const assignedReports = relReports.filter((r) => assignedNames.size ? assignedNames.has(r.groupName.toLowerCase()) : true);
        const filtered = applyRelFilters(assignedReports);
        return (
          <div className="view-container">
            <header className="subheader">
              <h3>Relatórios dos Grupos Designados</h3>
            </header>
            {/* Filtros */}
            <div className="filters">
              <div className="filter-block">
                <span>De:</span>
                <select aria-label="Dia de" value={relFilters.from.d} onChange={(e) => setRelFilters((f) => ({ ...f, from: { ...f.from, d: e.target.value } }))}>
                  <option value="">DD</option>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => <option key={d} value={pad2(d)}>{pad2(d)}</option>)}
                </select>
                <select aria-label="Mês de" value={relFilters.from.m} onChange={(e) => setRelFilters((f) => ({ ...f, from: { ...f.from, m: e.target.value } }))}>
                  <option value="">MM</option>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={pad2(m)}>{pad2(m)}</option>)}
                </select>
                <select aria-label="Ano de" value={relFilters.from.y} onChange={(e) => setRelFilters((f) => ({ ...f, from: { ...f.from, y: e.target.value } }))}>
                  <option value="">AAAA</option>
                  {Array.from({ length: 10 }, (_, i) => now.getFullYear() - 5 + i).map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div className="filter-block">
                <span>Até:</span>
                <select aria-label="Dia até" value={relFilters.to.d} onChange={(e) => setRelFilters((f) => ({ ...f, to: { ...f.to, d: e.target.value } }))}>
                  <option value="">DD</option>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => <option key={d} value={pad2(d)}>{pad2(d)}</option>)}
                </select>
                <select aria-label="Mês até" value={relFilters.to.m} onChange={(e) => setRelFilters((f) => ({ ...f, to: { ...f.to, m: e.target.value } }))}>
                  <option value="">MM</option>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={pad2(m)}>{pad2(m)}</option>)}
                </select>
                <select aria-label="Ano até" value={relFilters.to.y} onChange={(e) => setRelFilters((f) => ({ ...f, to: { ...f.to, y: e.target.value } }))}>
                  <option value="">AAAA</option>
                  {Array.from({ length: 10 }, (_, i) => now.getFullYear() - 5 + i).map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div className="filter-block">
                <label>Grupo
                  <select value={relFilters.groupId} onChange={(e) => setRelFilters((f) => ({ ...f, groupId: e.target.value }))}>
                    <option value="">Todos</option>
                    {relGruposVisiveis.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
                  </select>
                </label>
              </div>
              <div className="filter-block">
                <label>Status
                  <select value={relFilters.status} onChange={(e) => setRelFilters((f) => ({ ...f, status: e.target.value }))}>
                    <option value="">Todos</option>
                    {Object.values(REL_STATUS).map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
              </div>
              <div className="filter-block">
                <label>Autor
                  <input type="text" placeholder="Buscar por autor"
                    value={relFilters.author}
                    onChange={(e) => setRelFilters((f) => ({ ...f, author: e.target.value }))}
                  />
                </label>
              </div>
            </div>
            {/* Lista */}
            {filtered.length === 0 ? (
              <p>Nenhum relatório encontrado para os filtros selecionados.</p>
            ) : (
              filtered.map((report) => (
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
                    <p><strong>Valor:</strong> R$ {(Number(report.valorArrecadado || 0)).toFixed(2)}</p>
                    <p><strong>Kg:</strong> {Number(report.kgAlimentos || 0)} kg</p>
                    <p><strong>Cestas:</strong> {Number(report.qtdCestas || 0)}</p>
                    {report.parceiros?.length > 0 && <p><strong>Parceiros:</strong> {report.parceiros.join(", ")}</p>}
                    {report.localAtividade && <p><strong>Local:</strong> {report.localAtividade}</p>}
                    <p><strong>Descrição:</strong> {report.content}</p>
                  </div>
                  {/* Feedback e mudança de status pelo mentor */}
                  <div className="mentor-actions">
                    <label>Feedback ao aluno
                      <textarea
                        value={report.feedbackMentor || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          setRelReports((prev) => prev.map((r) => r.id === report.id ? { ...r, feedbackMentor: val } : r));
                        }}
                        rows={3}
                      />
                    </label>
                    <label>Status
                      <select
                        value={report.status}
                        onChange={(e) => {
                          const val = e.target.value;
                          setRelReports((prev) => prev.map((r) => r.id === report.id ? { ...r, status: val } : r));
                        }}
                      >
                        {Object.values(REL_STATUS).map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </label>
                  </div>
                </div>
              ))
            )}
          </div>
        );
      })()}
    </section>
  );
}