// src/pages/PainelInicial/PainelInicial.jsx
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from 'react';
import { useNavigate } from 'react-router-dom';
import './PainelInicial.css';

// Esses componentes/hooks já existiam no seu projeto:
import Dashboard from '../../components/Dashboard';
import NotificationBell from '../../components/Notifications/NotificationBell';
import { useSettings } from '../../hooks/useSettings';
import { useAutoPresence } from '../../hooks/usePresence';
import WidgetRelatorio from './WidgetRelatorio';
import ExtratoDoacoes from './ExtratoDoacoes';

/* ============================================================================
 * Helpers utilitários
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
const pad2 = (n) => String(n).padStart(2, '0');
const toYMD = (d) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const getInitials = (name = 'Usuário') => {
  const parts = String(name).trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] : '';
  const ini = `${first}${last}`.trim().toUpperCase();
  return ini || 'U';
};
const currency = (v) =>
  (Number(v ?? 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const API_BASE =
  import.meta.env.VITE_API_URL?.replace(/\/+$/, "") ||
  "https://projeto-interdisciplinar-2.onrender.com/api";

/* ============================================================================
 * Componente principal
 * ==========================================================================*/
export default function PainelInicial() {
  const navigate = useNavigate();

  /* --- Perfil / seção ativa ------------------------------------------------ */
  const [secaoAtiva, setSecaoAtiva] = useState('grupos');
  const [perfil, setPerfil] = useState(() =>
    load('perfil', { nome: 'Usuário', fotoUrl: '', tipo: 'mentor', ra: '12345' })
  );

  useEffect(() => save('perfil', perfil), [perfil]);

  useEffect(() => {
    document.title = 'Lideranças Empáticas • Painel';
  }, []);

  // Reage a alterações no localStorage (ex.: troca de perfil)
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === 'perfil') {
        try {
          setPerfil(JSON.parse(e.newValue));
        } catch {}
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  /* --- Carregamento de Grupos (API) ---------------------------------------- */
  const [grupos, setGrupos] = useState([]);
  const [loadingGrupos, setLoadingGrupos] = useState(true);
  const [errorGrupos, setErrorGrupos] = useState('');

  useEffect(() => {
    let abort = false;
    const fetchGrupos = async () => {
      setLoadingGrupos(true);
      setErrorGrupos('');
      try {
        const resp = await fetch(`${API_BASE}/grupos`,{
         credentials: "include"
        });
        if (!resp.ok) {
          const errText = await resp.text();
          console.error('API Error:', resp.status, errText);
          throw new Error(`Falha ao carregar grupos da API (${resp.status})`);
        }
        const data = await resp.json();
        if (!abort) {
          setGrupos(Array.isArray(data) ? data : []);
          save('grupos', Array.isArray(data) ? data : []); // compat com versões antigas
        }
      } catch (err) {
        if (!abort) {
          console.error('Fetch Grupos Error:', err);
          setErrorGrupos(err.message || 'Erro ao buscar grupos.');
          setGrupos(load('grupos', [])); // Fallback local
        }
      } finally {
        if (!abort) setLoadingGrupos(false);
      }
    };
    fetchGrupos();
    return () => {
      abort = true;
    };
  }, []);

  /* --- Eventos / Atividades (mantendo compat localStorage) ----------------- */
  const [eventos, setEventos] = useState(() => load('eventos', []));
  const [atividades, setAtividades] = useState(() => load('atividades', []));
  useEffect(() => save('eventos', eventos), [eventos]);
  useEffect(() => save('atividades', atividades), [atividades]);

  /* --- Visibilidade de grupos por tipo de usuário -------------------------- */
  const gruposVisiveis = useMemo(() => {
    if (perfil.tipo === 'aluno') {
      return grupos.filter((g) => g.membros?.some((m) => m.ra === perfil.ra));
    }
    return grupos;
  }, [grupos, perfil]);

  /* --- Novo: filtros/ordenação na seção GRUPOS ----------------------------- */
  const [qPainel, setQPainel] = useState('');
  const [ordPainel, setOrdPainel] = useState('progresso'); // progresso|nome|mentor

  const gruposFiltradosPainel = useMemo(() => {
    let list = [...gruposVisiveis];
    const s = qPainel.trim().toLowerCase();
    if (s) {
      list = list.filter(
        (g) =>
          String(g.nome || '').toLowerCase().includes(s) ||
          String(g.mentor || '').toLowerCase().includes(s)
      );
    }
    if (ordPainel === 'progresso') {
      list.sort((a, b) => {
        const pa =
          Number(a.progressoArrecadacao || 0) /
          Math.max(Number(a.metaArrecadacao || 1), 1);
        const pb =
          Number(b.progressoArrecadacao || 0) /
          Math.max(Number(b.metaArrecadacao || 1), 1);
        return pb - pa;
      });
    } else if (ordPainel === 'nome') {
      list.sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
    } else if (ordPainel === 'mentor') {
      list.sort((a, b) =>
        String(a.mentor || '').localeCompare(String(b.mentor || ''), 'pt-BR')
      );
    }
    return list;
  }, [gruposVisiveis, qPainel, ordPainel]);

  /* --- Mini KPIs (topo do painel) ------------------------------------------ */
  const hoje = useMemo(() => toYMD(new Date()), []);
  const eventosHoje = useMemo(
    () => eventos.filter((e) => e.data === hoje).length,
    [eventos, hoje]
  );
  const proximos7 = useMemo(() => {
    const now = new Date();
    const ref7 = new Date(now);
    ref7.setDate(now.getDate() + 7);
    return eventos.filter((e) => {
      const d = new Date(`${e.data}T00:00:00`);
      return d >= now && d <= ref7;
    }).length;
  }, [eventos]);
  const totalGrupos = gruposVisiveis.length;

  /* --- Ações e estados auxiliares (create/edit/delete, perfil etc.) -------- */
  const userId = useMemo(
    () => String(perfil?.ra || perfil?.nome || 'anon'),
    [perfil?.ra, perfil?.nome]
  );

  const [creating, setCreating] = useState(false);
  const creatingTimerRef = useRef(null);
  const handleCreateGroupClick = useCallback(
    (e) => {
      // ripple para UX
      const btn = e.currentTarget;
      const rect = btn.getBoundingClientRect();
      const rx = ((e.clientX - rect.left) / rect.width) * 100;
      const ry = ((e.clientY - rect.top) / rect.height) * 100;
      btn.style.setProperty('--rx', rx + '%');
      btn.style.setProperty('--ry', ry + '%');

      setCreating(true);
      navigate('/grupos');
      clearTimeout(creatingTimerRef.current);
      creatingTimerRef.current = setTimeout(() => setCreating(false), 2000);
    },
    [navigate]
  );
  useEffect(() => () => clearTimeout(creatingTimerRef.current), []);

  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const confirmTimerRef = useRef(null);
  const [editingId, setEditingId] = useState(null);
  const editingTimerRef = useRef(null);

  const removerGrupo = useCallback(async (id) => {
    setConfirmDeleteId(null);
    try {
      const response = await fetch(`${API_BASE}/grupos/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        let errorMsg = `Falha ao excluir grupo (${response.status})`;
        try {
          const errData = await response.json();
          errorMsg = errData.error || errorMsg;
        } catch {}
        throw new Error(errorMsg);
      }
      setGrupos((prev) => prev.filter((g) => g.id !== id));
      setEventos((prev) => prev.filter((e) => e.grupoId !== id));
    } catch (err) {
      console.error('Erro ao excluir grupo:', err);
      setErrorGrupos(err.message || 'Erro ao excluir grupo.');
    } finally {
      clearTimeout(confirmTimerRef.current);
    }
  }, []);

  const handleDeleteClick = useCallback(
    (id) => {
      if (confirmDeleteId === id) {
        removerGrupo(id);
      } else {
        setConfirmDeleteId(id);
        clearTimeout(confirmTimerRef.current);
        confirmTimerRef.current = setTimeout(() => {
          setConfirmDeleteId(null);
        }, 2500);
      }
    },
    [confirmDeleteId, removerGrupo]
  );

  const handleEditClick = useCallback(
    (id) => {
      setEditingId(id);
      navigate(`/grupos?tab=editar&editar=${id}`);
      clearTimeout(editingTimerRef.current);
      editingTimerRef.current = setTimeout(() => setEditingId(null), 2000);
    },
    [navigate]
  );
  useEffect(
    () => () => {
      clearTimeout(confirmTimerRef.current);
      clearTimeout(editingTimerRef.current);
    },
    []
  );

  /* --- Perfil/Presença/Config ---------------------------------------------- */
  const [openProfileMenu, setOpenProfileMenu] = useState(false);
  const profileRef = useRef(null);
  const onAvatarClick = useCallback((e) => {
    setOpenProfileMenu((o) => !o);
    // ripple no avatar
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
  }, []);
  useEffect(() => {
    const onDocClick = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setOpenProfileMenu(false);
      }
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('auth');
    localStorage.removeItem('perfil');
    setPerfil({ nome: 'Visitante', tipo: 'none' });
    setOpenProfileMenu(false);
    navigate('/');
  }, [navigate]);

  const isOnline = true;
  const profileMenuId = 'profile-menu-pop';

  const [temaPainel, setTemaPainel] = useState(() => localStorage.getItem('painel_theme') || 'claro');
  useEffect(() => localStorage.setItem('painel_theme', temaPainel), [temaPainel]);
  const { settings, update } = useSettings();
  useAutoPresence({
    enabled: settings.status?.mode === 'auto',
    timeoutMin: settings.status?.autoTimeoutMin ?? 5,
    onChange: (newState) => update('status.mode', newState),
  });

  const [grupoSelecionadoId, setGrupoSelecionadoId] = useState(null);
  useEffect(() => {
    if (!loadingGrupos && gruposVisiveis.length > 0) {
      if (!grupoSelecionadoId || !gruposVisiveis.some((g) => g.id === Number(grupoSelecionadoId))) {
        setGrupoSelecionadoId(gruposVisiveis[0].id);
      }
    } else if (!loadingGrupos && gruposVisiveis.length === 0) {
      setGrupoSelecionadoId(null);
    }
  }, [gruposVisiveis, grupoSelecionadoId, loadingGrupos]);

  const grupoParaDashboard = useMemo(() => {
    return grupoSelecionadoId
      ? gruposVisiveis.find((g) => g.id === Number(grupoSelecionadoId))
      : null;
  }, [gruposVisiveis, grupoSelecionadoId]);

  /* --- Agenda (existente) --------------------------------------------------- */
  const [abrirModalEvento, setAbrirModalEvento] = useState(false);
  const [formEvento, setFormEvento] = useState({
    titulo: '',
    data: '',
    hora: '',
    grupoId: '',
    descricao: '',
  });
  const [errosEvento, setErrosEvento] = useState({});
  const [filtroGrupoId, setFiltroGrupoId] = useState('');
  const [filtroData, setFiltroData] = useState('');

  const eventosOrdenadosFiltrados = useMemo(() => {
    const filtered = eventos.filter((e) => {
      const byGroup = filtroGrupoId ? String(e.grupoId) === String(filtroGrupoId) : true;
      const byDate = filtroData ? e.data === filtroData : true;
      return byGroup && byDate;
    });
    return filtered.sort(
      (a, b) =>
        new Date(`${a.data}T${a.hora || '00:00'}`) -
        new Date(`${b.data}T${b.hora || '00:00'}`)
    );
  }, [eventos, filtroGrupoId, filtroData]);

  const validarEvento = useCallback(() => {
    const errs = {};
    if (!formEvento.titulo || formEvento.titulo.trim().length < 3)
      errs.titulo = 'Mínimo 3 caracteres.';
    if (!formEvento.data) errs.data = 'Selecione uma data.';
    if (!formEvento.hora) errs.hora = 'Selecione um horário.';
    setErrosEvento(errs);
    return Object.keys(errs).length === 0;
  }, [formEvento]);

  const [calDate, setCalDate] = useState(() => new Date());
  const criarEvento = useCallback(
    (e) => {
      e.preventDefault();
      if (!validarEvento()) return;
      const novo = {
        id: eventos.length ? Math.max(...eventos.map((ev) => ev.id)) + 1 : 1,
        ...formEvento,
        titulo: formEvento.titulo.trim(),
        descricao: (formEvento.descricao || '').trim(),
        grupoId: formEvento.grupoId ? Number(formEvento.grupoId) : null,
      };
      setEventos((prev) => [novo, ...prev]);
      setFormEvento({ titulo: '', data: '', hora: '', grupoId: '', descricao: '' });
      setAbrirModalEvento(false);
      setFiltroData(novo.data);
      const [y, m] = novo.data.split('-').map((n) => parseInt(n, 10));
      setCalDate(new Date(y, m - 1, 1));
    },
    [eventos, formEvento, validarEvento]
  );
  const removerEvento = useCallback(
    (id) => setEventos((prev) => prev.filter((e) => e.id !== id)),
    []
  );

  const nomeDoGrupo = useCallback(
    (gid) => grupos.find((g) => g.id === gid)?.nome ?? 'Sem grupo',
    [grupos]
  );

  const year = calDate.getFullYear();
  const month = calDate.getMonth();
  const firstDayIndex = useMemo(
    () => new Date(year, month, 1).getDay(),
    [year, month]
  );
  const daysInMonth = useMemo(
    () => new Date(year, month + 1, 0).getDate(),
    [year, month]
  );
  const todayYMD = useMemo(() => toYMD(new Date()), []);
  const eventosPorDia = useMemo(() => {
    const map = new Map();
    eventos.forEach((ev) => {
      const eventDate = new Date(ev.data + 'T00:00:00Z');
      if (eventDate.getUTCFullYear() === year && eventDate.getUTCMonth() === month) {
        const dateKey = ev.data;
        if (!map.has(dateKey)) map.set(dateKey, []);
        map.get(dateKey).push(ev);
      }
    });
    for (const [, arr] of map.entries()) {
      arr.sort((a, b) => (a.hora || '').localeCompare(b.hora || ''));
    }
    return map;
  }, [eventos, year, month]);

  const handlePrevMonth = useCallback(
    () => setCalDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1)),
    []
  );
  const handleNextMonth = useCallback(
    () => setCalDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1)),
    []
  );
  const handleSelectDay = useCallback(
    (dayNum) => {
      if (!dayNum) return;
      const selected = `${year}-${pad2(month + 1)}-${pad2(dayNum)}`;
      setFiltroData((prev) => (prev === selected ? '' : selected));
    },
    [year, month]
  );

  /* ==========================================================================
   * Render
   * ========================================================================*/
  return (
    <div className="painel-container" data-theme={temaPainel}>
      {/* Sidebar */}
      <aside className="sidebar">
        <h2>Descubra</h2>
        <button onClick={() => setSecaoAtiva('grupos')}>Início</button>
        <button onClick={() => setSecaoAtiva('relatorio')}>Relatório</button>
        <button onClick={() => setSecaoAtiva('agenda')}>Agenda</button>
      </aside>

      {/* Main */}
      <main className="main-content">
        {/* Header interno do Painel */}
        <header className="header">
          {/* Abas principais */}
          <div className="nav-tabs">
            <button
              className={`tab ${secaoAtiva === 'grupos' ? 'active' : ''}`}
              onClick={() => setSecaoAtiva('grupos')}
            >
              Grupos
            </button>
            <button
              className={`tab ${secaoAtiva === 'dashboard' ? 'active' : ''}`}
              onClick={() => setSecaoAtiva('dashboard')}
            >
              Dashboard
            </button>
          </div>

          {/* Perfil / sino / menu */}
          <div className="perfil" ref={profileRef}>
            <NotificationBell userId={userId} className="mr-2" />
            <button
              className="avatar-button"
              onClick={onAvatarClick}
              title={perfil.nome || 'Perfil'}
              aria-haspopup="menu"
              aria-expanded={openProfileMenu}
              aria-controls={profileMenuId}
            >
              {perfil.fotoUrl ? (
                <img className="avatar" src={perfil.fotoUrl} alt="Foto do perfil" />
              ) : (
                <span className="avatar avatar-initials">
                  {getInitials(perfil.nome)}
                </span>
              )}
              <span
                className={`presence-dot ${isOnline ? 'is-online' : ''}`}
                aria-hidden="true"
              />
            </button>

            {openProfileMenu && (
              <div className="profile-menu">
                <div className="profile-menu__header" id={profileMenuId} role="menu">
                  {perfil.fotoUrl ? (
                    <img className="avatar small" src={perfil.fotoUrl} alt="Foto do perfil" />
                  ) : (
                    <span className="avatar small avatar-initials">
                      {getInitials(perfil.nome)}
                    </span>
                  )}
                  <div className="profile-meta">
                    <strong>{perfil.nome || 'Usuário'}</strong>
                    <small className="muted">online</small>
                  </div>
                </div>

                <button
                  className="menu-item"
                  onClick={() => {
                    setOpenProfileMenu(false);
                    navigate('/perfil');
                  }}
                  role="menuitem"
                >
                  <i className="fa-regular fa-user" aria-hidden="true" />
                  <span>Meu perfil</span>
                </button>

                <button
                  className="menu-item"
                  role="menuitem"
                  onClick={() => {
                    setOpenProfileMenu(false);
                    navigate('/config');
                  }}
                  title="Configurações"
                  aria-label="Abrir configurações"
                >
                  <i className="fa-solid fa-gear" aria-hidden="true" />
                  <span>Configurações</span>
                </button>

                <button className="menu-item danger" onClick={handleLogout}>
                  <i className="fa-solid fa-arrow-right-from-bracket" aria-hidden="true" />
                  <span>Sair</span>
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Mini-KPIs – topo do painel */}
        <section className="mini-kpis anim-fade-in-up">
          <div className="mini-kpi anim-pop">
            <strong>{totalGrupos}</strong>
            <span>Grupos ativos</span>
          </div>
          <div className="mini-kpi anim-pop" style={{ animationDelay: '60ms' }}>
            <strong>{eventosHoje}</strong>
            <span>Eventos hoje</span>
          </div>
          <div className="mini-kpi anim-pop" style={{ animationDelay: '120ms' }}>
            <strong>{proximos7}</strong>
            <span>Próximos 7 dias</span>
          </div>
        </section>

        {/* ======================= Seção: GRUPOS ======================= */}
        {secaoAtiva === 'grupos' && (
          <section className="grupos-section anim-fade-in-up">
            <div className="grupos-header">
              <h2 className="anim-slide-in">Grupos</h2>

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
                      <i className="fa-solid fa-spinner fa-spin" />
                      <span>Criando…</span>
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-plus" />
                      <span>Criar Grupo</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Toolbar: busca + ordenação */}
            <div className="grupos-toolbar anim-slide-in">
              <input
                className="input"
                type="search"
                placeholder="Buscar por nome ou mentor"
                value={qPainel}
                onChange={(e) => setQPainel(e.target.value)}
              />
              <select
                className="input"
                value={ordPainel}
                onChange={(e) => setOrdPainel(e.target.value)}
              >
                <option value="progresso">Ordenar por progresso</option>
                <option value="nome">Ordenar por nome</option>
                <option value="mentor">Ordenar por mentor</option>
              </select>
            </div>

            {/* Estados de carregamento/erro/vazio */}
            {loadingGrupos && <p>Carregando grupos...</p>}

            {errorGrupos && (
              <div className="message error" role="alert">
                {errorGrupos}
                <button
                  className="btn btn-primary"
                  onClick={() => window.location.reload()}
                  style={{ marginLeft: 8 }}
                >
                  Tentar novamente
                </button>
              </div>
            )}

            {!loadingGrupos && !errorGrupos && gruposFiltradosPainel.length === 0 && (
              <div className="empty-state anim-fade-in-up">
                <p>Nenhum grupo encontrado.</p>
                {perfil.tipo !== 'aluno' ? (
                  <button className="btn btn-primary" onClick={handleCreateGroupClick}>
                    Criar Grupo
                  </button>
                ) : (
                  <button className="btn btn-ghost" onClick={() => window.location.reload()}>
                    Atualizar
                  </button>
                )}
              </div>
            )}

            {/* Cards de grupo */}
            {!loadingGrupos &&
              !errorGrupos &&
              gruposFiltradosPainel.map((g, idx) => {
                const percentFinanceiro = Math.min(
                  (Number(g.progressoArrecadacao ?? 0) /
                    Math.max(Number(g.metaArrecadacao ?? 1), 1)) *
                    100,
                  100
                );

                // meta alimentos derivada (enquanto o backend não envia campos numéricos)
                const matchAlimentos = String(g.metaAlimentos || '').match(/\d+/);
                const metaNumAlimentos = matchAlimentos ? parseInt(matchAlimentos[0], 10) : 0;
                const progressoNumAlimentos = g.progressoAlimentos ?? 0;
                const percentAlimentos =
                  metaNumAlimentos > 0
                    ? Math.min((progressoNumAlimentos / metaNumAlimentos) * 100, 100)
                    : 0;

                return (
                  <div
                    key={g.id}
                    className="grupo-card anim-pop"
                    style={{ animationDelay: `${idx * 30}ms` }}
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate(`/grupos/atividade/${g.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter')
                        navigate(`/grupos/atividade/${g.id}`);
                    }}
                  >
                    {/* Topo do card (mentor + título + chips) */}
                    <div className="grupo-card__top">
                      <div className="mentor-badge">
                        {g.mentorFotoUrl ? (
                          <img
                            className="mentor-avatar"
                            src={g.mentorFotoUrl}
                            alt={`Mentor ${g.mentor}`}
                          />
                        ) : (
                          <span className="mentor-avatar initials">
                            {getInitials(g.mentor || g.nome || 'G')}
                          </span>
                        )}
                        <div className="mentor-info">
                          <h3 className="grupo-title">{g.nome}</h3>
                          <small className="muted">
                            {g.mentor ? `Mentor: ${g.mentor}` : 'Sem mentor'}
                          </small>
                        </div>
                      </div>

                      <div className="grupo-chips">
                        {Number(g.metaArrecadacao || 0) <= 0 && (
                          <span className="chip chip-neutral anim-chip">Sem meta</span>
                        )}
                        {Number(g.metaArrecadacao || 0) > 0 &&
                        Number(g.progressoArrecadacao || 0) >=
                          Number(g.metaArrecadacao) ? (
                          <span className="chip chip-success anim-chip">Meta concluída</span>
                        ) : (
                          Number(g.metaArrecadacao || 0) > 0 && (
                            <span className="chip chip-progress anim-chip">
                              {Math.floor(
                                (Number(g.progressoArrecadacao || 0) /
                                  Math.max(Number(g.metaArrecadacao || 1), 1)) *
                                  100
                              )}
                              % da meta
                            </span>
                          )
                        )}
                        <span className="chip chip-info anim-chip">
                          {(g.membros?.length || 0)} membro(s)
                        </span>
                      </div>
                    </div>

                    {/* Meta financeira */}
                    <p style={{ marginBottom: '4px', fontSize: '0.9rem' }}>
                      Meta Fin.: {currency(g.metaArrecadacao)} · Arrecadado:{' '}
                      {currency(g.progressoArrecadacao)}
                    </p>
                    <div className="progress-bar">
                      <div
                        className="progress"
                        style={{ width: `${percentFinanceiro}%` }}
                        aria-valuenow={percentFinanceiro}
                        aria-valuemin="0"
                        aria-valuemax="100"
                        role="progressbar"
                      />
                    </div>

                    {/* Meta de alimentos (se existir) */}
                    {g.metaAlimentos && (
                      <div style={{ marginTop: '8px' }}>
                        <p style={{ marginBottom: '4px', fontSize: '0.9rem' }}>
                          Meta Alim.: {g.metaAlimentos} · Progresso:{' '}
                          {progressoNumAlimentos}
                          {metaNumAlimentos > 0 ? ` / ${metaNumAlimentos}` : ''}
                        </p>
                        <div className="progress-bar">
                          <div
                            className="progress"
                            style={{ width: `${percentAlimentos}%` }}
                            aria-valuenow={percentAlimentos}
                            aria-valuemin="0"
                            aria-valuemax="100"
                            role="progressbar"
                          />
                        </div>
                      </div>
                    )}

                    {/* Ações do card */}
                    <div
                      className="grupo-card__actions"
                      style={{ display: 'flex', gap: 8, marginTop: '12px' }}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <button
                        className={`btn btn-secondary btn--edit ${
                          editingId === g.id ? 'is-loading' : ''
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditClick(g.id);
                        }}
                        title="Editar grupo"
                        aria-label={`Editar grupo ${g.nome}`}
                        disabled={editingId === g.id}
                      >
                        {editingId === g.id ? (
                          <>
                            <i className="fa-solid fa-spinner fa-spin" />
                            <span>Editando…</span>
                          </>
                        ) : (
                          <>
                            <i className="fa-solid fa-pen-to-square" />
                            <span>Editar</span>
                          </>
                        )}
                      </button>

                      <button
                        className={`btn btn-danger btn--delete ${
                          confirmDeleteId === g.id ? 'confirm' : ''
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteClick(g.id);
                        }}
                        title={
                          confirmDeleteId === g.id
                            ? 'Confirmar exclusão'
                            : 'Excluir grupo'
                        }
                        aria-label={
                          confirmDeleteId === g.id
                            ? `Confirmar exclusão do grupo ${g.nome}`
                            : `Excluir grupo ${g.nome}`
                        }
                      >
                        {confirmDeleteId === g.id ? (
                          <>
                            <i className="fa-solid fa-check" />
                            <span>Confirmar</span>
                          </>
                        ) : (
                          <>
                            <i className="fa-solid fa-trash" />
                            <span>Excluir</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
          </section>
        )}

        {/* ======================= Seção: DASHBOARD ======================= */}
        {secaoAtiva === 'dashboard' && (
          <div className="dashboard-container anim-fade-in-up">
            <div className="dashboard-header anim-slide-in">
              <label htmlFor="grupo-select">Visualizando Dashboard do Grupo:</label>
              <select
                id="grupo-select"
                className="input"
                value={grupoSelecionadoId ?? ''}
                onChange={(e) => setGrupoSelecionadoId(e.target.value)}
              >
                {loadingGrupos && <option>Carregando...</option>}
                {!loadingGrupos && gruposVisiveis.length === 0 && (
                  <option>Nenhum grupo</option>
                )}
                {!loadingGrupos &&
                  gruposVisiveis.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.nome}
                    </option>
                  ))}
              </select>
            </div>

            {grupoParaDashboard ? (
              <Dashboard grupo={grupoParaDashboard} />
            ) : (
              <p>
                {loadingGrupos
                  ? 'Carregando...'
                  : perfil.tipo === 'aluno'
                  ? 'Você ainda não faz parte de um grupo.'
                  : 'Selecione um grupo para ver o dashboard.'}
              </p>
            )}
          </div>
        )}

        {/* ======================= Seção: AGENDA ======================= */}
        {secaoAtiva === 'agenda' && (
          <section className="grupos-section agenda-section anim-fade-in-up">
            <div className="grupos-header">
              <h2>Agenda</h2>
              <button className="criar-grupo" onClick={() => setAbrirModalEvento(true)}>
                + Novo Evento
              </button>
            </div>

            <div className="filters">
              <label>
                Filtrar por grupo:
                <select
                  value={filtroGrupoId}
                  onChange={(e) => setFiltroGrupoId(e.target.value)}
                  className="input"
                >
                  <option value="">Todos</option>
                  {grupos.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.nome}
                    </option>
                  ))}
                </select>
              </label>

              <div className="filters__date">
                {filtroData ? (
                  <>
                    <span className="chip">
                      Data:{' '}
                      {new Date(filtroData + 'T00:00:00Z').toLocaleDateString('pt-BR', {
                        timeZone: 'UTC',
                      })}
                    </span>
                    <button
                      className="btn btn-ghost"
                      onClick={() => setFiltroData('')}
                    >
                      Limpar data
                    </button>
                  </>
                ) : (
                  <span className="muted">Clique em um dia para filtrar</span>
                )}
              </div>
            </div>

            {/* Calendário */}
            <div className="calendar anim-fade-in-up">
              <div className="calendar-header">
                <button className="btn btn-ghost" onClick={handlePrevMonth}>
                  ‹
                </button>
                <div className="calendar-title">
                  {new Date(year, month, 1).toLocaleDateString('pt-BR', {
                    month: 'long',
                    year: 'numeric',
                  })}
                </div>
                <button className="btn btn-ghost" onClick={handleNextMonth}>
                  ›
                </button>
              </div>

              <div className="calendar-weekdays">
                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((w) => (
                  <div key={w} className="weekday">
                    {w}
                  </div>
                ))}
              </div>

              <div className="calendar-grid">
                {Array.from({ length: firstDayIndex }).map((_, i) => (
                  <div key={`e-${i}`} className="day empty" />
                ))}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const dayNum = i + 1;
                  const ymd = `${year}-${pad2(month + 1)}-${pad2(dayNum)}`;
                  const isToday = ymd === todayYMD;
                  const isSelected = ymd === filtroData;
                  const dayEvents = eventosPorDia.get(ymd) ?? [];
                  return (
                    <button
                      key={ymd}
                      className={`day ${isToday ? 'today' : ''} ${
                        isSelected ? 'selected' : ''
                      } ${dayEvents.length ? 'has-events' : ''}`}
                      onClick={() => handleSelectDay(dayNum)}
                    >
                      <span className="num">{dayNum}</span>
                      <div className="events-in-day">
                        {dayEvents.slice(0, 2).map((ev) => (
                          <span
                            key={ev.id}
                            className="event-chip"
                            title={`${ev.hora ? ev.hora + ' · ' : ''}${ev.titulo}`}
                          >
                            {ev.hora ? `${ev.hora} ` : ''}
                            {ev.titulo}
                          </span>
                        ))}
                        {dayEvents.length > 2 && (
                          <span className="more-chip">+{dayEvents.length - 2}</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Lista de eventos */}
            {eventosOrdenadosFiltrados.length === 0 ? (
              <p>Nenhum evento encontrado.</p>
            ) : (
              <div className="event-list">
                {eventosOrdenadosFiltrados.map((ev) => (
                  <div key={ev.id} className="event-card anim-fade-in-up">
                    <div className="event-card__left">
                      <div className="event-date">
                        <span className="day">
                          {new Date(ev.data + 'T00:00:00Z').getUTCDate()}
                        </span>
                        <span className="month">
                          {new Date(ev.data + 'T00:00:00Z').toLocaleDateString(
                            'pt-BR',
                            { month: 'short', timeZone: 'UTC' }
                          )}
                        </span>
                      </div>
                    </div>
                    <div className="event-card__content">
                      <h3>{ev.titulo}</h3>
                      <p className="muted">
                        {ev.hora} · {nomeDoGrupo(ev.grupoId)}
                      </p>
                      {ev.descricao && <p>{ev.descricao}</p>}
                    </div>
                    <div className="event-card__actions">
                      <button className="btn btn-danger" onClick={() => removerEvento(ev.id)}>
                        Excluir
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ======================= Seção: RELATÓRIO ======================= */}
        {secaoAtiva === 'relatorio' && (
          <>
            <WidgetRelatorio perfil={perfil} grupos={grupos} />
            <ExtratoDoacoes />
          </>
        )}
      </main>

      {/* Modais */}
      {abrirModalEvento && (
        <div className="modal-overlay" onClick={() => setAbrirModalEvento(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Novo Evento</h3>
              <button className="btn btn-ghost" onClick={() => setAbrirModalEvento(false)}>
                ✕
              </button>
            </div>
            <form className="modal-body" onSubmit={criarEvento}>
              <label>
                Título
                <input
                  className={`input ${errosEvento.titulo ? 'input-error' : ''}`}
                  type="text"
                  value={formEvento.titulo}
                  onChange={(e) =>
                    setFormEvento((s) => ({ ...s, titulo: e.target.value }))
                  }
                />
                {errosEvento.titulo && (
                  <span className="error-text">{errosEvento.titulo}</span>
                )}
              </label>

              <div className="grid-2">
                <label>
                  Data
                  <input
                    className={`input ${errosEvento.data ? 'input-error' : ''}`}
                    type="date"
                    value={formEvento.data}
                    onChange={(e) =>
                      setFormEvento((s) => ({ ...s, data: e.target.value }))
                    }
                  />
                  {errosEvento.data && (
                    <span className="error-text">{errosEvento.data}</span>
                  )}
                </label>

                <label>
                  Hora
                  <input
                    className={`input ${errosEvento.hora ? 'input-error' : ''}`}
                    type="time"
                    value={formEvento.hora}
                    onChange={(e) =>
                      setFormEvento((s) => ({ ...s, hora: e.target.value }))
                    }
                  />
                  {errosEvento.hora && (
                    <span className="error-text">{errosEvento.hora}</span>
                  )}
                </label>
              </div>

              <label>
                Grupo (opcional)
                <select
                  className="input"
                  value={formEvento.grupoId}
                  onChange={(e) =>
                    setFormEvento((s) => ({ ...s, grupoId: e.target.value }))
                  }
                >
                  <option value="">Sem grupo</option>
                  {grupos.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.nome}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Descrição (opcional)
                <textarea
                  className="input"
                  rows={3}
                  value={formEvento.descricao}
                  onChange={(e) =>
                    setFormEvento((s) => ({ ...s, descricao: e.target.value }))
                  }
                />
              </label>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setAbrirModalEvento(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}