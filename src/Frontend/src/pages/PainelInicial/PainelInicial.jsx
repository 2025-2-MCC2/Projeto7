// src/pages/PainelInicial/PainelInicial.jsx
// Imports
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "./PainelInicial.css";
import Dashboard from "../../components/Dashboard";
import NotificationBell from "../../components/Notifications/NotificationBell";
/* ============================================================================
 * Helpers de storage e utils gerais
 * ==========================================================================*/
const load = (key, fallback) => {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
};
const save = (key, value) => localStorage.setItem(key, JSON.stringify(value));
const pad2 = (n) => String(n).padStart(2, "0");
const toYMD = (d) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const getInitials = (name = "Usuário") => {
  const parts = String(name).trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";
  const ini = `${first}${last}`.trim().toUpperCase();
  return ini || "U";
};
/* ============================================================================
 * Constantes/Helpers específicos de RELATÓRIOS (mapeando Relatorios.jsx)
 * - Mantém as MESMAS chaves e regras para 100% de compatibilidade
 * ==========================================================================*/
const REL_STATUS = {
  RASCUNHO: "rascunho",
  ENVIADO: "enviado",
  APROVADO: "aprovado",
  AJUSTES: "ajustes",
};
const REL_SETTINGS_KEY = "relatorios_prefs";
const REL_REPORTS_KEY = "relatorios";
const REL_DRAFT_KEY = "relatorios_drafts";
const REL_DEFAULT_SETTINGS = {
  deadlineDay: 5,
  remindersOn: false,
};
const getMonthKey = (date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
const toISO = (y, m, d) => `${y}-${pad2(m)}-${pad2(d)}`;
/** Regra de edição (mesma de Relatorios.jsx):
 * - Permitido até o dia `deadlineDay` do mês seguinte ao `report.month` (YYYY-MM).
 * - Sempre permitido se status = AJUSTES.
 * - Bloqueado se status = APROVADO.
 */
const isEditableRel = (report, now = new Date(), deadlineDay = REL_DEFAULT_SETTINGS.deadlineDay) => {
  if (!report) return true;
  if (report.status === REL_STATUS.APROVADO) return false;
  if (report.status === REL_STATUS.AJUSTES) return true;
  const [yy, mm] = report.month.split("-").map(Number);
  const lock = new Date(yy, (mm - 1) + 1, deadlineDay + 1, 0, 0, 0); // até o dia seguinte 00:00
  return now < lock;
};
/* ============================================================================
 * Componente principal
 * ==========================================================================*/
export default function PainelInicial() {
  const navigate = useNavigate();
  /* --------------------- Estado principal de navegação/usuário --------------------- */
  const [secaoAtiva, setSecaoAtiva] = useState("grupos");
  const [perfil, setPerfil] = useState(() =>
    load("perfil", { nome: "Usuário", fotoUrl: "", tipo: "mentor", ra: "12345" })
  );
  useEffect(() => save("perfil", perfil), [perfil]);
  // Título da página
  useEffect(() => {
    document.title = "Lideranças Empáticas • Painel";
  }, []);
  // Sincroniza o perfil se alterado em outra aba/guia
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === "perfil") {
        try { setPerfil(JSON.parse(e.newValue)); } catch {}
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  
const userId = React.useMemo(
  () => String(perfil?.ra || perfil?.nome || "anon"),
  [perfil?.ra, perfil?.nome]
);
// Estado e timers para loading + ripple (somente do Criar Grupo)
const [creating, setCreating] = useState(false);
const creatingTimerRef = useRef(null);

const handleCreateGroupClick = (e) => {
  // Calcular posição do clique p/ ripple
  const btn = e.currentTarget;
  const rect = btn.getBoundingClientRect();
  const rx = ((e.clientX - rect.left) / rect.width) * 100;
  const ry = ((e.clientY - rect.top) / rect.height) * 100;
  btn.style.setProperty('--rx', rx + '%');
  btn.style.setProperty('--ry', ry + '%');

  // Entrar em loading e navegar
  setCreating(true);
  navigate('/grupos'); // sua rota de criação/gestão

  // Fallback de segurança (caso a tela não troque por algum motivo)
  clearTimeout(creatingTimerRef.current);
  creatingTimerRef.current = setTimeout(() => setCreating(false), 2000);
};

// Limpeza
useEffect(() => {
  return () => clearTimeout(creatingTimerRef.current);
}, []);
  
// === Estados para UX avançada dos botões ===
const [confirmDeleteId, setConfirmDeleteId] = useState(null);
const confirmTimerRef = useRef(null);

const [editingId, setEditingId] = useState(null);
const editingTimerRef = useRef(null);

// 1) Clique no Excluir com passo de confirmação
const handleDeleteClick = (id) => {
  // Se já está em modo confirmar: executa exclusão
  if (confirmDeleteId === id) {
    clearTimeout(confirmTimerRef.current);
    setConfirmDeleteId(null);
    removerGrupo(id); // sua função existente
    return;
  }
  // Primeiro clique: entra no estado "Confirmar" por ~2.5s
  setConfirmDeleteId(id);
  clearTimeout(confirmTimerRef.current);
  confirmTimerRef.current = setTimeout(() => {
    setConfirmDeleteId(null);
  }, 2500);
};

// 2) Clique no Editar com loading/spinner
const handleEditClick = (id) => {
  setEditingId(id);
  // Navega — ao trocar de rota, este componente deve desmontar e limpar estado
  navigate(`/grupos?tab=editar&editar=${id}`);
  // Fallback de segurança: se por algum motivo não desmontar, reseta em 2s
  clearTimeout(editingTimerRef.current);
  editingTimerRef.current = setTimeout(() => setEditingId(null), 2000);
};

// Limpesa de timers ao desmontar
useEffect(() => {
  return () => {
    clearTimeout(confirmTimerRef.current);
    clearTimeout(editingTimerRef.current);
  };
}, []);

// Ripple no avatar: calcula o ponto do clique
const onAvatarClick = (e) => {
  setOpenProfileMenu((o) => !o);
  // ripple
  const btn = e.currentTarget;
  const rect = btn.getBoundingClientRect();
  const rx = ((e.clientX - rect.left) / rect.width) * 100;
  const ry = ((e.clientY - rect.top) / rect.height) * 100;
  btn.style.setProperty('--rx', rx + '%');
  btn.style.setProperty('--ry', ry + '%');
  setTimeout(() => {
    btn.style.removeProperty('--rx');
    btn.style.removeProperty('--ry');
  }, 500);
};

// Opcional: status online (pode vir de perfil.status no futuro)
const isOnline = true;
const profileMenuId = "profile-menu-pop";
  /* --------------------- DADOS: Grupos, Eventos, Atividades (originais) --------------------- */
  const [grupos, setGrupos] = useState(() =>
    load("grupos", [
      {
        id: 1,
        nome: "Campanha de Natal 2025",
        mentor: "Mentor Admin",
        // mentorFotoUrl: "https://exemplo.com/avatar.jpg",
        metaArrecadacao: 5000,
        metaAlimentos: "500 cestas básicas",
        progressoArrecadacao: 1937,
        inventario: [{ nome: "Arroz", quantidade: 429 }, { nome: "Feijão", quantidade: 419 }],
        membros: [{ nome: "Aluno Teste", ra: "12345" }],
      },
      {
        id: 2,
        nome: "Ação Comunitária de Inverno",
        mentor: "Mentor Admin",
        metaArrecadacao: 2000,
        progressoArrecadacao: 2250,
        metaAlimentos: "200 cobertores",
        inventario: [{ nome: "Agasalho", quantidade: 85 }],
        membros: [],
      },
    ])
  );
  const [eventos, setEventos] = useState(() =>
    load("eventos", [
      {
        id: 1,
        titulo: "Reunião inicial",
        data: toYMD(new Date()),
        hora: "14:00",
        grupoId: 1,
        descricao: "Apresentação do módulo.",
      },
    ])
  );
  // Mesmo que a Atividades tenha sido movida para Grupos, mantemos o estado
  // aqui para não quebrar o histórico do arquivo e manter o tamanho:
  const [atividades, setAtividades] = useState(() =>
    load("atividades", [
      { id: 1, titulo: "Configurar ambiente de desenvolvimento", descricao: "Instalar Node, VSCode, etc.", concluida: true },
      { id: 2, titulo: "Revisar o design do painel", descricao: "Verificar cores e fontes com a equipe de design.", concluida: false },
    ])
  );
  useEffect(() => save("grupos", grupos), [grupos]);
  useEffect(() => save("eventos", eventos), [eventos]);
  useEffect(() => save("atividades", atividades), [atividades]);
  // Visibilidade de grupos de acordo com perfil (aluno vê só os seus)
  const gruposVisiveis = useMemo(() => {
    if (perfil.tipo === "aluno") {
      return grupos.filter((g) => g.membros?.some((m) => m.ra === perfil.ra));
    }
    return grupos;
  }, [grupos, perfil]);
  // Seleção para Dashboard
  const [grupoSelecionadoId, setGrupoSelecionadoId] = useState(gruposVisiveis[0]?.id ?? null);
  useEffect(() => {
    if (!gruposVisiveis.some((g) => g.id === grupoSelecionadoId)) {
      setGrupoSelecionadoId(gruposVisiveis[0]?.id ?? null);
    }
  }, [gruposVisiveis, grupoSelecionadoId]);
  /* --------------------- Eventos/Agenda/Atividades (originais) --------------------- */
  const [abrirModalEvento, setAbrirModalEvento] = useState(false);
  const [formEvento, setFormEvento] = useState({ titulo: "", data: "", hora: "", grupoId: "", descricao: "" });
  const [errosEvento, setErrosEvento] = useState({});
  const [abrirModalAtividade, setAbrirModalAtividade] = useState(false);
  const [formAtividade, setFormAtividade] = useState({ titulo: "", descricao: "" });
  const [errosAtividade, setErrosAtividade] = useState({});
  const [filtroGrupoId, setFiltroGrupoId] = useState("");
  const [filtroData, setFiltroData] = useState("");
  const eventosOrdenadosFiltrados = useMemo(() => {
    const filtered = eventos.filter((e) => {
      const byGroup = filtroGrupoId ? String(e.grupoId) === String(filtroGrupoId) : true;
      const byDate = filtroData ? e.data === filtroData : true;
      return byGroup && byDate;
    });
    return filtered.sort(
      (a, b) =>
        new Date(`${a.data}T${a.hora || "00:00"}`) - new Date(`${b.data}T${b.hora || "00:00"}`)
    );
  }, [eventos, filtroGrupoId, filtroData]);
  const validarEvento = () => {
    const errs = {};
    if (!formEvento.titulo || formEvento.titulo.trim().length < 3)
      errs.titulo = "Informe um título com pelo menos 3 caracteres.";
    if (!formEvento.data) errs.data = "Selecione uma data.";
    if (!formEvento.hora) errs.hora = "Selecione um horário.";
    setErrosEvento(errs);
    return Object.keys(errs).length === 0;
  };
  const validarAtividade = () => {
    const errs = {};
    if (!formAtividade.titulo || formAtividade.titulo.trim().length < 3)
      errs.titulo = "Informe um título com pelo menos 3 caracteres.";
    setErrosAtividade(errs);
    return Object.keys(errs).length === 0;
  };
  const removerGrupo = (id) => {
    if (window.confirm("Tem certeza que deseja excluir este grupo?")) {
      setGrupos((prev) => prev.filter((g) => g.id !== id));
      setEventos((prev) => prev.filter((e) => e.grupoId !== id));
    }
  };
  const criarEvento = (e) => {
    e.preventDefault();
    if (!validarEvento()) return;
    const novo = {
      id: eventos.length ? Math.max(...eventos.map((ev) => ev.id)) + 1 : 1,
      ...formEvento,
      titulo: formEvento.titulo.trim(),
      descricao: (formEvento.descricao || "").trim(),
      grupoId: formEvento.grupoId ? Number(formEvento.grupoId) : null,
    };
    setEventos((prev) => [novo, ...prev]);
    setFormEvento({ titulo: "", data: "", hora: "", grupoId: "", descricao: "" });
    setAbrirModalEvento(false);
    setFiltroData(novo.data);
    const [y, m] = novo.data.split("-").map((n) => parseInt(n, 10));
    setCalDate(new Date(y, m - 1, 1));
  };
  const removerEvento = (id) => setEventos((prev) => prev.filter((e) => e.id !== id));
  const nomeDoGrupo = (gid) => grupos.find((g) => g.id === gid)?.nome ?? "Sem grupo";
  const criarAtividade = (e) => {
    e.preventDefault();
    if (!validarAtividade()) return;
    const nova = {
      id: atividades.length ? Math.max(...atividades.map((a) => a.id)) + 1 : 1,
      titulo: formAtividade.titulo.trim(),
      descricao: (formAtividade.descricao || "").trim(),
      concluida: false,
    };
    setAtividades((prev) => [nova, ...prev]);
    setFormAtividade({ titulo: "", descricao: "" });
    setAbrirModalAtividade(false);
  };
  const removerAtividade = (id) =>
    setAtividades((prev) => prev.filter((a) => a.id !== id));
  const alternarConclusaoAtividade = (id) =>
    setAtividades((prev) =>
      prev.map((ativ) => (ativ.id === id ? { ...ativ, concluida: !ativ.concluida } : ativ))
    );
  /* --------------------- Calendário (originais) --------------------- */
  const [calDate, setCalDate] = useState(() => new Date());
  const year = calDate.getFullYear();
  const month = calDate.getMonth();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayYMD = toYMD(new Date());
  const eventosPorDia = useMemo(() => {
    const map = new Map();
    eventos.forEach((ev) => {
      const d = new Date(ev.data + "T00:00");
      if (d.getFullYear() === year && d.getMonth() === month) {
        if (!map.has(ev.data)) map.set(ev.data, []);
        map.get(ev.data).push(ev);
      }
    });
    for (const [, arr] of map.entries()) {
      arr.sort((a, b) => (a.hora || "").localeCompare(b.hora || ""));
    }
    return map;
  }, [eventos, year, month]);
  const handlePrevMonth = () =>
    setCalDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const handleNextMonth = () =>
    setCalDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  const handleSelectDay = (dayNum) => {
    if (!dayNum) return;
    const selected = `${year}-${pad2(month + 1)}-${pad2(dayNum)}`;
    setFiltroData((prev) => (prev === selected ? "" : selected));
  };
  /* --------------------- Perfil / menu avatar (originais) --------------------- */
  const [openProfileMenu, setOpenProfileMenu] = useState(false);
  const profileRef = useRef(null);
  useEffect(() => {
    const onDocClick = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setOpenProfileMenu(false);
      }
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);
  const handleLogout = () => {
    localStorage.removeItem("auth");
    setOpenProfileMenu(false);
    navigate("/");
  };
  const grupoParaDashboard = useMemo(() => {
    return gruposVisiveis.find((g) => g.id === Number(grupoSelecionadoId));
  }, [gruposVisiveis, grupoSelecionadoId]);
  /* ============================================================================
   * >>> RELATÓRIOS dentro do Painel (com a mesma lógica do Relatorios.jsx) <<<
   * ==========================================================================*/
  const currentUserRel = useMemo(() => {
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
  const relGruposVisiveis = useMemo(() => {
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
    load(REL_SETTINGS_KEY, REL_DEFAULT_SETTINGS)
  );
  const [relReports, setRelReports] = useState(() =>
    load(REL_REPORTS_KEY, [])
  );
  const [relDrafts, setRelDrafts] = useState(() => load(REL_DRAFT_KEY, {}));
  useEffect(() => save(REL_SETTINGS_KEY, relSettings), [relSettings]);
  useEffect(() => save(REL_REPORTS_KEY, relReports), [relReports]);
  useEffect(() => save(REL_DRAFT_KEY, relDrafts), [relDrafts]);
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === REL_REPORTS_KEY) setRelReports(load(REL_REPORTS_KEY, []));
      if (e.key === REL_SETTINGS_KEY) setRelSettings(load(REL_SETTINGS_KEY, REL_DEFAULT_SETTINGS));
      if (e.key === REL_DRAFT_KEY) setRelDrafts(load(REL_DRAFT_KEY, {}));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  const [relErrorMsg, setRelErrorMsg] = useState("");
  const [relSuccessMsg, setRelSuccessMsg] = useState("");
  const relErrorRef = useRef(null);
  const relSuccessRef = useRef(null);
  const resetRelMessages = () => { setRelErrorMsg(""); setRelSuccessMsg(""); };
  useEffect(() => { if (relErrorMsg && relErrorRef.current) relErrorRef.current.focus(); }, [relErrorMsg]);
  useEffect(() => { if (relSuccessMsg && relSuccessRef.current) relSuccessRef.current.focus(); }, [relSuccessMsg]);
  const now = new Date();
  const [relSelectedGroupId, setRelSelectedGroupId] = useState(null);
  useEffect(() => {
    if (relGruposVisiveis.length > 0) setRelSelectedGroupId(relGruposVisiveis[0].id);
    else setRelSelectedGroupId(null);
  }, [relGruposVisiveis]);
  const [relSelDay, setRelSelDay] = useState(now.getDate());
  const [relSelMonth, setRelSelMonth] = useState(now.getMonth() + 1);
  const [relSelYear, setRelSelYear] = useState(now.getFullYear());
  const relSelectedDate = useMemo(
    () => new Date(relSelYear, relSelMonth - 1, relSelDay),
    [relSelYear, relSelMonth, relSelDay]
  );
  const relSelectedMonthKey = useMemo(
    () => getMonthKey(relSelectedDate),
    [relSelectedDate]
  );
  const [relEditingReport, setRelEditingReport] = useState(null);
  const [relNewReportContent, setRelNewReportContent] = useState("");
  const [relValorArrecadado, setRelValorArrecadado] = useState("");
  const [relKgAlimentos, setRelKgAlimentos] = useState("");
  const [relQtdCestas, setRelQtdCestas] = useState("");
  const [relParceiros, setRelParceiros] = useState("");
  const [relLocalAtividade, setRelLocalAtividade] = useState("");
  const [relStatusAtual, setRelStatusAtual] = useState(REL_STATUS.RASCUNHO);
  const relContentRef = useRef(null);
  useEffect(() => { if (relContentRef.current) relContentRef.current.focus(); }, [relSelectedGroupId]);
  const relDraftKey = useMemo(() => {
    if (!relSelectedGroupId) return "";
    return `${currentUserRel.ra || currentUserRel.name}::${relSelectedGroupId}::${relSelectedMonthKey}`;
  }, [currentUserRel, relSelectedGroupId, relSelectedMonthKey]);
  useEffect(() => {
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
      if (d.selDay) setRelSelDay(d.selDay);
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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relDraftKey]);
  useEffect(() => {
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
  const relMyMonthReport = useMemo(() => {
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
  const relPodeEditar = useMemo(
    () => isEditableRel(relMyMonthReport || relEditingReport, new Date(), relSettings.deadlineDay),
    [relMyMonthReport, relEditingReport, relSettings.deadlineDay]
  );
  useEffect(() => {
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
  const setRelError = (msg) => { setRelSuccessMsg(""); setRelErrorMsg(msg); };
  const setRelSuccess = (msg) => { setRelErrorMsg(""); setRelSuccessMsg(msg); };
  const relFindGroupById = (id) => grupos.find((g) => g.id === id);
  const handleRelCreateOrUpdate = useCallback(() => {
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
    if (relEditingReport) {
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
              status: REL_STATUS.ENVIADO,
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
    const exist = relReports.some(
      (r) =>
        r.groupId === relSelectedGroupId &&
        r.authorRA === currentUserRel.ra &&
        r.month === monthKey
    );
    if (exist) {
      return setRelError("Você já possui um relatório para este grupo neste mês. Edite o existente.");
    }
    const newReport = {
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
    relEditingReport, relReports, relDraftKey
  ]);
  const handleRelEdit = (report) => {
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
  const handleRelCancelEdit = () => {
    setRelEditingReport(null);
    setRelSuccess("Edição cancelada.");
  };
  const [relFilters, setRelFilters] = useState({
    from: { d: "", m: "", y: "" },
    to: { d: "", m: "", y: "" },
    groupId: "",
    status: "",
    author: "",
  });
  const applyRelFilters = (list) => {
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
  /* ============================================================================
   * Render
   * ==========================================================================*/
  return (
    <div className="painel-container">
      <aside className="sidebar">
        <h2>Descubra</h2>
        <button onClick={() => setSecaoAtiva("grupos")}>Início</button>
        <button onClick={() => setSecaoAtiva("relatorio")}>Relatório</button>
        <button onClick={() => setSecaoAtiva("agenda")}>Agenda</button>
      </aside>
      <main className="main-content">
        {/* Header */}
        <header className="header">
          <div>
            <button
              className={`tab ${secaoAtiva === "grupos" ? "active" : ""}`}
              onClick={() => setSecaoAtiva("grupos")}
            >
              Grupos
            </button>
            <button
              className={`tab ${secaoAtiva === "dashboard" ? "active" : ""}`}
              onClick={() => setSecaoAtiva("dashboard")}
            >
              Dashboard
            </button>
            {/* [REMOVIDO] A aba Atividades foi migrada para a página Grupos */}
            {/* <button
              className={`tab ${secaoAtiva === "atividades" ? "active" : ""}`}
              onClick={() => setSecaoAtiva("atividades")}
            >
              Atividades
            </button> */}
          </div>
          <div className="perfil" ref={profileRef}>
            {/* [Adicionado] Sino de notificações */}
          <NotificationBell userId={userId} className="mr-2" />

            <button
              className="avatar-button"
              onClick={onAvatarClick}
              title={perfil.nome || "Perfil"}
              aria-haspopup="menu"
              aria-expanded={openProfileMenu}
              aria-controls={profileMenuId}
            >
              {perfil.fotoUrl ? (
                <img className="avatar" src={perfil.fotoUrl} alt="Foto do perfil" />
              ) : (
                <span className="avatar avatar-initials">{getInitials(perfil.nome)}</span>
              )}
              <span className={`presence-dot ${isOnline ? "is-online" : ""}`} aria-hidden="true"></span>
            </button>
            {openProfileMenu && (
              <div className="profile-menu">
                <div className="profile-menu__header"
                id={profileMenuId}
                role="menu"
                >
                  {perfil.fotoUrl ? (
                    <img className="avatar small" src={perfil.fotoUrl} alt="Foto do perfil" />
                  ) : (
                    <span className="avatar small avatar-initials">
                      {getInitials(perfil.nome)}
                    </span>
                  )}
                  <div className="profile-meta">
                    <strong>{perfil.nome || "Usuário"}</strong>
                    <small className="muted">online</small>
                  </div>
                </div>
                {/* Meu perfil */}
                <button
                  className="menu-item"
                  onClick={() => { setOpenProfileMenu(false); navigate('/perfil'); }}
                   role="menuitem"
                >
                  <i className="fa-regular fa-user" aria-hidden="true"></i>
                  <span>Meu perfil</span>
                </button>
                <button className="menu-item danger" onClick={handleLogout}>
                <i className="fa-solid fa-arrow-right-from-bracket" aria-hidden="true"></i>
                <span>Sair</span>
                </button>
              </div>
            )}
          </div>
        </header>
        {/* Seção: GRUPOS */}
        {secaoAtiva === "grupos" && (
          <section className="grupos-section">
            <div className="grupos-header">
              <h2>Grupos</h2>
              {(perfil.tipo !== 'aluno' || gruposVisiveis.length === 0) && (
            <button
            className={`btn btn-primary btn--create ${creating ? 'is-loading' : ''}`}
            onClick={handleCreateGroupClick}
            title="Criar novo grupo"
            aria-label="Criar novo grupo"
            disabled={creating}
            >
            {creating ? (
              <>
                <i className="fa-solid fa-spinner fa-spin" aria-hidden="true"></i>
                <span>Criando…</span>
              </>
            ) : (
              <>
                <i className="fa-solid fa-plus" aria-hidden="true"></i>
                <span>Criar Grupo</span>
              </>
            )}
            </button>
            )}

              
            </div>
            {gruposVisiveis.length === 0 && <p>Nenhum grupo para exibir.</p>}
            {gruposVisiveis.map((g) => (
              <div
                key={g.id}
                className="grupo-card"
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/grupos/atividade/${g.id}`)}
                onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/grupos/atividade/${g.id}`); }}
              >
                {/* Cabeçalho (título) */}
                <div className="grupo-card__top">
                  <h3>{g.nome}</h3>
                </div>

                {/* Mentor com foto (ou iniciais) */}
                {g.mentor && (
                  <div
                    className="grupo-card__mentor"
                    style={{ display: "flex", alignItems: "center", gap: 8, margin: "6px 0 4px" }}
                  >
                    {g.mentorFotoUrl ? (
                      <img
                        className="avatar small"
                        src={g.mentorFotoUrl}
                        alt={`Mentor ${g.mentor}`}
                        style={{ width: 28, height: 28, borderRadius: "50%" }}
                      />
                    ) : (
                      <span
                        className="avatar small avatar-initials"
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: "50%",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "#d8f3dc",
                          color: "#1b4332",
                          fontWeight: 700,
                        }}
                      >
                        {getInitials(g.mentor)}
                      </span>
                    )}
                    <span>Mentor: {g.mentor}</span>
                  </div>
                )}

                {/* Metas e progresso */}
                <p>
                  Meta: R$ {g.metaArrecadacao?.toFixed(2) ?? "0.00"} · Arrecadado: R$ {g.progressoArrecadacao?.toFixed(2) ?? "0.00"}
                </p>
                <div className="progress-bar">
                  <div
                    className="progress"
                    style={{
                      width: `${Math.min(((g.progressoArrecadacao ?? 0) / (g.metaArrecadacao || 1)) * 100, 100)}%`,
                    }}
                  />
                </div>
                {g.metaAlimentos && (
                  <p className="grupo-card__meta-alimentos">Meta de Alimentos: {g.metaAlimentos}</p>
                )}

                {/* Ações - param propagação para não navegar ao clicar */}
                <div
                  className="grupo-card__actions"
                  style={{ display: "flex", gap: 8, marginTop: 10 }}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <button
                    
                  className={`btn btn-secondary btn--edit ${editingId === g.id ? "is-loading" : ""}`}
                  onClick={() => handleEditClick(g.id)}
                  title="Editar grupo"
                  aria-label={`Editar grupo ${g.nome}`}
                  disabled={editingId === g.id}
                  >
                    {editingId === g.id ? (
                       <>
                   <i className="fa-solid fa-spinner fa-spin" aria-hidden="true"></i>
                   <span>Editando…</span>
                   </>
                    ) : (
                      <>
                      
                  <i className="fa-solid fa-pen-to-square" aria-hidden="true"></i>
                  <span>Editar</span>
                      </>
                    )}
                  </button>
                  
                  <button
                  className={`btn btn-danger btn--delete ${confirmDeleteId === g.id ? "confirm" : ""}`}
                  onClick={() => handleDeleteClick(g.id)}
                  title={confirmDeleteId === g.id ? "Confirmar exclusão" : "Excluir grupo"}
                  aria-label={
                    confirmDeleteId === g.id
                      ? `Confirmar exclusão do grupo ${g.nome}`
                      : `Excluir grupo ${g.nome}`
                            }
                          >
                            {confirmDeleteId === g.id ? (
                              <>
                                <i className="fa-solid fa-check" aria-hidden="true"></i>
                                <span>Confirmar</span>
                              </>
                            ) : (
                              <>
                                <i className="fa-solid fa-trash" aria-hidden="true"></i>
                                <span>Excluir</span>
                              </>
                            )}
                          </button>

                </div>
              </div>
            ))}
          </section>
        )}
        {/* Seção: DASHBOARD */}
        {secaoAtiva === "dashboard" && (
          <div className="dashboard-container">
            <div className="dashboard-header">
              <label htmlFor="grupo-select">Visualizando Dashboard do Grupo:</label>
              <select
                id="grupo-select"
                className="input"
                value={grupoSelecionadoId ?? ''}
                onChange={(e) => setGrupoSelecionadoId(e.target.value)}
              >
                {gruposVisiveis.map((g) => (
                  <option key={g.id} value={g.id}>{g.nome}</option>
                ))}
              </select>
            </div>
            {grupoParaDashboard ? (
              <Dashboard grupo={grupoParaDashboard} />
            ) : (
              <p>{perfil.tipo === 'aluno' ? 'Você ainda não faz parte de um grupo.' : 'Selecione um grupo para ver o dashboard.'}</p>
            )}
          </div>
        )}
        {/* Seção: AGENDA */}
        {secaoAtiva === "agenda" && (
          <section className="grupos-section agenda-section">
            <div className="grupos-header">
              <h2>Agenda</h2>
              <button className="criar-grupo" onClick={() => setAbrirModalEvento(true)}>+ Novo Evento</button>
            </div>
            <div className="filters">
              <label>Filtrar por grupo:
                <select value={filtroGrupoId} onChange={(e) => setFiltroGrupoId(e.target.value)} className="input">
                  <option value="">Todos</option>
                  {grupos.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
                </select>
              </label>
              <div className="filters__date">
                {filtroData ? (
                  <>
                    <span className="chip">Data: {new Date(filtroData + "T00:00").toLocaleDateString("pt-BR")}</span>
                    <button className="btn btn-ghost" onClick={() => setFiltroData("")}>Limpar data</button>
                  </>
                ) : (
                  <span className="muted">Clique em um dia para filtrar</span>
                )}
              </div>
            </div>
            {/* Calendário */}
            <div className="calendar">
              <div className="calendar-header">
                <button className="btn btn-ghost" onClick={handlePrevMonth}>‹</button>
                <div className="calendar-title">
                  {new Date(year, month, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
                </div>
                <button className="btn btn-ghost" onClick={handleNextMonth}>›</button>
              </div>
              <div className="calendar-weekdays">
                {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((w) => (
                  <div key={w} className="weekday">{w}</div>
                ))}
              </div>
              <div className="calendar-grid">
                {Array.from({ length: firstDayIndex }).map((_, i) => (
                  <div key={`e-${i}`} className="day empty" />
                ))}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const dayNum = i + 1,
                        ymd = `${year}-${pad2(month + 1)}-${pad2(dayNum)}`,
                        isToday = ymd === todayYMD,
                        isSelected = ymd === filtroData,
                        dayEvents = eventosPorDia.get(ymd) ?? [];
                  return (
                    <button
                      key={ymd}
                      className={`day ${isToday ? "today" : ""} ${isSelected ? "selected" : ""} ${dayEvents.length ? "has-events" : ""}`}
                      onClick={() => handleSelectDay(dayNum)}
                    >
                      <span className="num">{dayNum}</span>
                      <div className="events-in-day">
                        {dayEvents.slice(0, 2).map((ev) => (
                          <span key={ev.id} className="event-chip" title={`${ev.hora ? ev.hora + " · " : ""}${ev.titulo}`}>
                            {ev.hora ? `${ev.hora} ` : ""}{ev.titulo}
                          </span>
                        ))}
                        {dayEvents.length > 2 && <span className="more-chip">+{dayEvents.length - 2}</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
            {eventosOrdenadosFiltrados.length === 0 ? (
              <p>Nenhum evento encontrado.</p>
            ) : (
              <div className="event-list">
                {eventosOrdenadosFiltrados.map((ev) => (
                  <div key={ev.id} className="event-card">
                    <div className="event-card__left">
                      <div className="event-date">
                        <span className="day">{new Date(ev.data + "T00:00").getDate()}</span>
                        <span className="month">
                          {new Date(ev.data + "T00:00").toLocaleDateString("pt-BR", { month: "short" })}
                        </span>
                      </div>
                    </div>
                    <div className="event-card__content">
                      <h3>{ev.titulo}</h3>
                      <p className="muted">{ev.hora} · {nomeDoGrupo(ev.grupoId)}</p>
                      {ev.descricao && <p>{ev.descricao}</p>}
                    </div>
                    <div className="event-card__actions">
                      <button className="btn btn-danger" onClick={() => removerEvento(ev.id)}>Excluir</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
        {/* Seção: RELATÓRIO (com mesma lógica do Relatorios.jsx) */}
        {secaoAtiva === "relatorio" && (
          <section className="grupos-section">
            <div className="grupos-header">
              <h2>Relatórios</h2>
              {/* Acesso opcional à página completa */}
              <button className="criar-grupo" onClick={() => navigate('/relatorios')}>
                Abrir página completa
              </button>
            </div>
            {/* === View: ALUNO === */}
            {currentUserRel.role === "aluno" && (
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
            {currentUserRel.role === "mentor" && (() => {
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
                  {/* Toolbar (export/import futuramente) — mantida oculta no Painel */}
                </div>
              );
            })()}
          </section>
        )}
      </main>
      {/* Modal Evento */}
      {abrirModalEvento && (
        <div className="modal-overlay" onClick={() => setAbrirModalEvento(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Novo Evento</h3>
              <button className="btn btn-ghost" onClick={() => setAbrirModalEvento(false)}>✕</button>
            </div>
            <form className="modal-body" onSubmit={criarEvento}>
              <label>Título
                <input
                  className={`input ${errosEvento.titulo && "input-error"}`}
                  type="text"
                  value={formEvento.titulo}
                  onChange={(e) => setFormEvento((s) => ({ ...s, titulo: e.target.value }))}
                />
                {errosEvento.titulo && <span className="error-text">{errosEvento.titulo}</span>}
              </label>
              <div className="grid-2">
                <label>Data
                  <input
                    className={`input ${errosEvento.data && "input-error"}`}
                    type="date"
                    value={formEvento.data}
                    onChange={(e) => setFormEvento((s) => ({ ...s, data: e.target.value }))}
                  />
                  {errosEvento.data && <span className="error-text">{errosEvento.data}</span>}
                </label>
                <label>Hora
                  <input
                    className={`input ${errosEvento.hora && "input-error"}`}
                    type="time"
                    value={formEvento.hora}
                    onChange={(e) => setFormEvento((s) => ({ ...s, hora: e.target.value }))}
                  />
                  {errosEvento.hora && <span className="error-text">{errosEvento.hora}</span>}
                </label>
              </div>
              <label>Grupo (opcional)
                <select
                  className="input"
                  value={formEvento.grupoId}
                  onChange={(e) => setFormEvento((s) => ({ ...s, grupoId: e.target.value }))}
                >
                  <option value="">Sem grupo</option>
                  {grupos.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
                </select>
              </label>
              <label>Descrição (opcional)
                <textarea
                  className="input"
                  rows={3}
                  value={formEvento.descricao}
                  onChange={(e) => setFormEvento((s) => ({ ...s, descricao: e.target.value }))}
                />
              </label>
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setAbrirModalEvento(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal Atividade — MANTIDO no arquivo, mas a seção Atividades foi migrada para "Grupos".
          Você pode remover este modal quando concluir a migração por completo. */}
      {abrirModalAtividade && (
        <div className="modal-overlay" onClick={() => setAbrirModalAtividade(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Nova Atividade</h3>
              <button className="btn btn-ghost" onClick={() => setAbrirModalAtividade(false)}>✕</button>
            </div>
            <form className="modal-body" onSubmit={criarAtividade}>
              <label>Título
                <input
                  className={`input ${errosAtividade.titulo && "input-error"}`}
                  type="text"
                  value={formAtividade.titulo}
                  onChange={(e) => setFormAtividade((s) => ({ ...s, titulo: e.target.value }))}
                  autoFocus
                />
                {errosAtividade.titulo && <span className="error-text">{errosAtividade.titulo}</span>}
              </label>
              <label>Descrição (opcional)
                <textarea
                  className="input"
                  rows={3}
                  value={formAtividade.descricao}
                  onChange={(e) => setFormAtividade((s) => ({ ...s, descricao: e.target.value }))}
                />
              </label>
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setAbrirModalAtividade(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Criar</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* [REMOVIDO DA UI] Seção: ATIVIDADES
          Abaixo está a seção original, deixando comentada para referência/histórico.
          Ela NÃO é mais renderizada no Painel (aba desativada). */}
      {/*
      {secaoAtiva === "atividades" && (
        <section className="grupos-section">
          <div className="grupos-header">
            <h2>Minhas Atividades</h2>
            <button className="criar-grupo" onClick={() => setAbrirModalAtividade(true)}>+ Adicionar Atividade</button>
          </div>
          {atividades.length === 0 ? (
            <p>Nenhuma atividade cadastrada.</p>
          ) : (
            <div className="atividades-lista">
              {atividades.map((ativ) => (
                <div key={ativ.id} className={`atividade-card ${ativ.concluida ? "concluida" : ""}`}>
                  <div className="atividade-card__main">
                    <input
                      type="checkbox"
                      checked={ativ.concluida}
                      onChange={() => alternarConclusaoAtividade(ativ.id)}
                      title={ativ.concluida ? "Marcar como pendente" : "Marcar como concluída"}
                    />
                    <div>
                      <h3>{ativ.titulo}</h3>
                      {ativ.descricao && <p>{ativ.descricao}</p>}
                    </div>
                  </div>
                  <button className="btn btn-danger" onClick={() => removerAtividade(ativ.id)} title="Excluir atividade">
                    Excluir
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
      */}
    </div>
  );
}