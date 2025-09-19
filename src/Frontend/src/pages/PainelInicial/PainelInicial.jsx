// src/pages/PainelInicial/PainelInicial.jsx
// VERSÃO COMPLETA E CORRIGIDA
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./PainelInicial.css";
import Dashboard from "../../components/Dashboard";

// Helpers de storage
const load = (key, fallback) => {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
};
const save = (key, value) => localStorage.setItem(key, JSON.stringify(value));

// Utils
const pad2 = (n) => String(n).padStart(2, "0");
const toYMD = (d) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const getInitials = (name = "Usuário") => {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] || "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";
  return (first + last).toUpperCase() || "U";
};

export default function PainelInicial() {
  const navigate = useNavigate();

  const [secaoAtiva, setSecaoAtiva] = useState("grupos");

  const [perfil, setPerfil] = useState(() =>
    load("perfil", { nome: "Usuário", fotoUrl: "", tipo: 'mentor', ra: '12345' })
  );
  useEffect(() => save("perfil", perfil), [perfil]);

  // --- DADOS ---
  const [grupos, setGrupos] = useState(() =>
    load("grupos", [
      { id: 1, nome: "Campanha de Natal 2025", mentor: "Mentor Admin", metaArrecadacao: 5000, metaAlimentos: "500 cestas básicas", progressoArrecadacao: 1937, inventario: [{ nome: "Arroz", quantidade: 429 }, { nome: "Feijão", quantidade: 419 }], membros: [{ nome: 'Aluno Teste', ra: '12345' }] },
      { id: 2, nome: "Ação Comunitária de Inverno", mentor: "Mentor Admin", metaArrecadacao: 2000, progressoArrecadacao: 2250, metaAlimentos: "200 cobertores", inventario: [{ nome: "Agasalho", quantidade: 85 }], membros: [] },
    ])
  );

  const [eventos, setEventos] = useState(() =>
    load("eventos", [
      { id: 1, titulo: "Reunião inicial", data: toYMD(new Date()), hora: "14:00", grupoId: 1, descricao: "Apresentação do módulo." },
    ])
  );

  const [atividades, setAtividades] = useState(() =>
    load("atividades", [
      { id: 1, titulo: "Configurar ambiente de desenvolvimento", descricao: "Instalar Node, VSCode, etc.", concluida: true },
      { id: 2, titulo: "Revisar o design do painel", descricao: "Verificar cores e fontes com a equipe de design.", concluida: false },
    ])
  );

  useEffect(() => save("grupos", grupos), [grupos]);
  useEffect(() => save("eventos", eventos), [eventos]);
  useEffect(() => save("atividades", atividades), [atividades]);

  const gruposVisiveis = useMemo(() => {
    if (perfil.tipo === 'aluno') {
      return grupos.filter(g => g.membros?.some(m => m.ra === perfil.ra));
    }
    return grupos;
  }, [grupos, perfil]);

  const [grupoSelecionadoId, setGrupoSelecionadoId] = useState(gruposVisiveis[0]?.id || null);

  useEffect(() => {
    if (!gruposVisiveis.some(g => g.id === grupoSelecionadoId)) {
      setGrupoSelecionadoId(gruposVisiveis[0]?.id || null);
    }
  }, [gruposVisiveis, grupoSelecionadoId]);

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
    return filtered.sort((a, b) => new Date(`${a.data}T${a.hora || "00:00"}`) - new Date(`${b.data}T${b.hora || "00:00"}`));
  }, [eventos, filtroGrupoId, filtroData]);

  const validarEvento = () => {
    const errs = {};
    if (!formEvento.titulo || formEvento.titulo.trim().length < 3) errs.titulo = "Informe um título com pelo menos 3 caracteres.";
    if (!formEvento.data) errs.data = "Selecione uma data.";
    if (!formEvento.hora) errs.hora = "Selecione um horário.";
    setErrosEvento(errs);
    return Object.keys(errs).length === 0;
  };

  const validarAtividade = () => {
    const errs = {};
    if (!formAtividade.titulo || formAtividade.titulo.trim().length < 3) errs.titulo = "Informe um título com pelo menos 3 caracteres.";
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
    const [y, m] = novo.data.split("-").map(n => parseInt(n, 10));
    setCalDate(new Date(y, m - 1, 1));
  };

  const removerEvento = (id) => setEventos((prev) => prev.filter((e) => e.id !== id));
  const nomeDoGrupo = (gid) => grupos.find((g) => g.id === gid)?.nome || "Sem grupo";

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

  const removerAtividade = (id) => setAtividades((prev) => prev.filter((a) => a.id !== id));
  const alternarConclusaoAtividade = (id) => setAtividades((prev) => prev.map((ativ) => ativ.id === id ? { ...ativ, concluida: !ativ.concluida } : ativ));

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

  const handlePrevMonth = () => setCalDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const handleNextMonth = () => setCalDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  const handleSelectDay = (dayNum) => {
    if (!dayNum) return;
    const selected = `${year}-${pad2(month + 1)}-${pad2(dayNum)}`;
    setFiltroData(prev => (prev === selected ? "" : selected));
  };

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

  const handleLogout = () => { localStorage.removeItem("auth"); setOpenProfileMenu(false); navigate("/"); };

  const grupoParaDashboard = useMemo(() => {
    return gruposVisiveis.find(g => g.id === Number(grupoSelecionadoId));
  }, [gruposVisiveis, grupoSelecionadoId]);

  return (
    <div className="painel-container">
      <aside className="sidebar">
        <h2>Descubra</h2>
        <button onClick={() => setSecaoAtiva("grupos")}>Início</button>
        <button onClick={() => setSecaoAtiva("grupos")}>Geral</button>
        <button onClick={() => setSecaoAtiva("agenda")}>Agenda</button>
      </aside>

      <main className="main-content">
        <header className="header">
          <div>
            <button className={`tab ${secaoAtiva === "grupos" ? "active" : ""}`} onClick={() => setSecaoAtiva("grupos")}>Grupos</button>
            <button className={`tab ${secaoAtiva === "dashboard" ? "active" : ""}`} onClick={() => setSecaoAtiva("dashboard")}>Dashboard</button>
            <button className={`tab ${secaoAtiva === "atividades" ? "active" : ""}`} onClick={() => setSecaoAtiva("atividades")}>Atividades</button>
          </div>
          <div className="perfil" ref={profileRef}>
            <button className="avatar-button" onClick={() => setOpenProfileMenu(o => !o)} title={perfil.nome || "Perfil"}>
              {perfil.fotoUrl ? <img className="avatar" src={perfil.fotoUrl} alt="Foto do perfil" /> : <span className="avatar avatar-initials">{getInitials(perfil.nome)}</span>}
            </button>
            {openProfileMenu && (
              <div className="profile-menu">
                <div className="profile-menu__header">
                  {perfil.fotoUrl ? <img className="avatar small" src={perfil.fotoUrl} alt="Foto do perfil" /> : <span className="avatar small avatar-initials">{getInitials(perfil.nome)}</span>}
                  <div className="profile-meta"><strong>{perfil.nome || "Usuário"}</strong><small className="muted">online</small></div>
                </div>
                <button className="menu-item danger" onClick={handleLogout}>Sair</button>
              </div>
            )}
          </div>
        </header>

        {secaoAtiva === "grupos" && (
          <section className="grupos-section">
            <div className="grupos-header">
              <h2>Grupos</h2>
              {(perfil.tipo !== 'aluno' || gruposVisiveis.length === 0) && (
                <button className="criar-grupo" onClick={() => navigate('/grupos')}>+ Criar Grupo</button>
              )}
            </div>
            {gruposVisiveis.length === 0 && <p>Nenhum grupo para exibir.</p>}
            {gruposVisiveis.map(g => (
              <div key={g.id} className="grupo-card">
                <div className="grupo-card__top">
                  <h3>{g.nome}</h3>
                  <button className="btn btn-danger" onClick={() => removerGrupo(g.id)} title="Excluir grupo">Excluir</button>
                </div>
                <p>Meta: R$ {g.metaArrecadacao?.toFixed(2) || '0.00'} | Arrecadado: R$ {g.progressoArrecadacao?.toFixed(2) || '0.00'}</p>
                <div className="progress-bar">
                  <div className="progress" style={{ width: `${Math.min(((g.progressoArrecadacao || 0) / (g.metaArrecadacao || 1)) * 100, 100)}%` }} />
                </div>
                {g.mentor && <p className="grupo-card__mentor">Mentor: {g.mentor}</p>}
                {g.metaAlimentos && <p className="grupo-card__meta-alimentos">Meta de Alimentos: {g.metaAlimentos}</p>}
              </div>
            ))}
          </section>
        )}

        {secaoAtiva === "dashboard" && (
          <div className="dashboard-container">
            <div className="dashboard-header">
              <label htmlFor="grupo-select">Visualizando Dashboard do Grupo:</label>
              <select id="grupo-select" className="input" value={grupoSelecionadoId || ''} onChange={e => setGrupoSelecionadoId(e.target.value)}>
                {gruposVisiveis.map(g => <option key={g.id} value={g.id}>{g.nome}</option>)}
              </select>
            </div>
            {grupoParaDashboard ? <Dashboard grupo={grupoParaDashboard} /> : <p>{perfil.tipo === 'aluno' ? 'Você ainda não faz parte de um grupo.' : 'Selecione um grupo para ver o dashboard.'}</p>}
          </div>
        )}

        {secaoAtiva === "atividades" && (
          <section className="grupos-section">
            <div className="grupos-header">
              <h2>Minhas Atividades</h2>
              <button className="criar-grupo" onClick={() => setAbrirModalAtividade(true)}>+ Adicionar Atividade</button>
            </div>
            {atividades.length === 0 ? <p>Nenhuma atividade cadastrada.</p> :
              <div className="atividades-lista">
                {atividades.map(ativ => (
                  <div key={ativ.id} className={`atividade-card ${ativ.concluida ? "concluida" : ""}`}>
                    <div className="atividade-card__main">
                      <input type="checkbox" checked={ativ.concluida} onChange={() => alternarConclusaoAtividade(ativ.id)} title={ativ.concluida ? "Marcar como pendente" : "Marcar como concluída"} />
                      <div>
                        <h3>{ativ.titulo}</h3>
                        {ativ.descricao && <p>{ativ.descricao}</p>}
                      </div>
                    </div>
                    <button className="btn btn-danger" onClick={() => removerAtividade(ativ.id)} title="Excluir atividade">Excluir</button>
                  </div>
                ))}
              </div>
            }
          </section>
        )}

        {secaoAtiva === "agenda" && (
          <section className="grupos-section agenda-section">
            <div className="grupos-header">
              <h2>Agenda</h2>
              <button className="criar-grupo" onClick={() => setAbrirModalEvento(true)}>+ Novo Evento</button>
            </div>
            <div className="filters">
              <label>Filtrar por grupo:
                <select value={filtroGrupoId} onChange={e => setFiltroGrupoId(e.target.value)} className="input">
                  <option value="">Todos</option>
                  {grupos.map(g => <option key={g.id} value={g.id}>{g.nome}</option>)}
                </select>
              </label>
              <div className="filters__date">
                {filtroData ? <>
                  <span className="chip">Data: {new Date(filtroData + "T00:00").toLocaleDateString("pt-BR")}</span>
                  <button className="btn btn-ghost" onClick={() => setFiltroData("")}>Limpar data</button>
                </> : <span className="muted">Clique em um dia para filtrar</span>}
              </div>
            </div>
            <div className="calendar">
              <div className="calendar-header">
                <button className="btn btn-ghost" onClick={handlePrevMonth}>‹</button>
                <div className="calendar-title">{new Date(year, month, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</div>
                <button className="btn btn-ghost" onClick={handleNextMonth}>›</button>
              </div>
              <div className="calendar-weekdays">{["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map(w => <div key={w} className="weekday">{w}</div>)}</div>
              <div className="calendar-grid">
                {Array.from({ length: firstDayIndex }).map((_, i) => <div key={`e-${i}`} className="day empty" />)}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const dayNum = i + 1, ymd = `${year}-${pad2(month + 1)}-${pad2(dayNum)}`, isToday = ymd === todayYMD, isSelected = ymd === filtroData, dayEvents = eventosPorDia.get(ymd) || [];
                  return <button key={ymd} className={`day ${isToday ? "today" : ""} ${isSelected ? "selected" : ""} ${dayEvents.length ? "has-events" : ""}`} onClick={() => handleSelectDay(dayNum)}>
                    <span className="num">{dayNum}</span>
                    <div className="events-in-day">
                      {dayEvents.slice(0, 2).map(ev => <span key={ev.id} className="event-chip" title={`${ev.hora} · ${ev.titulo}`}>{ev.hora ? `${ev.hora} ` : ""}{ev.titulo}</span>)}
                      {dayEvents.length > 2 && <span className="more-chip">+{dayEvents.length - 2}</span>}
                    </div>
                  </button>
                })}
              </div>
            </div>
            {eventosOrdenadosFiltrados.length === 0 ? <p>Nenhum evento encontrado.</p> :
              <div className="event-list">
                {eventosOrdenadosFiltrados.map(ev => (
                  <div key={ev.id} className="event-card">
                    <div className="event-card__left"><div className="event-date"><span className="day">{new Date(ev.data + "T00:00").getDate()}</span><span className="month">{new Date(ev.data + "T00:00").toLocaleDateString("pt-BR", { month: "short" })}</span></div></div>
                    <div className="event-card__content">
                      <h3>{ev.titulo}</h3>
                      <p className="muted">{ev.hora} · {nomeDoGrupo(ev.grupoId)}</p>
                      {ev.descricao && <p>{ev.descricao}</p>}
                    </div>
                    <div className="event-card__actions"><button className="btn btn-danger" onClick={() => removerEvento(ev.id)}>Excluir</button></div>
                  </div>
                ))}
              </div>
            }
          </section>
        )}
      </main>

      {abrirModalEvento && (
        <div className="modal-overlay" onClick={() => setAbrirModalEvento(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>Novo Evento</h3><button className="btn btn-ghost" onClick={() => setAbrirModalEvento(false)}>✕</button></div>
            <form className="modal-body" onSubmit={criarEvento}>
              <label>Título<input className={`input ${errosEvento.titulo && "input-error"}`} type="text" value={formEvento.titulo} onChange={e => setFormEvento(s => ({ ...s, titulo: e.target.value }))} />{errosEvento.titulo && <span className="error-text">{errosEvento.titulo}</span>}</label>
              <div className="grid-2">
                <label>Data<input className={`input ${errosEvento.data && "input-error"}`} type="date" value={formEvento.data} onChange={e => setFormEvento(s => ({ ...s, data: e.target.value }))} />{errosEvento.data && <span className="error-text">{errosEvento.data}</span>}</label>
                <label>Hora<input className={`input ${errosEvento.hora && "input-error"}`} type="time" value={formEvento.hora} onChange={e => setFormEvento(s => ({ ...s, hora: e.target.value }))} />{errosEvento.hora && <span className="error-text">{errosEvento.hora}</span>}</label>
              </div>
              <label>Grupo (opcional)<select className="input" value={formEvento.grupoId} onChange={e => setFormEvento(s => ({ ...s, grupoId: e.target.value }))}><option value="">Sem grupo</option>{grupos.map(g => <option key={g.id} value={g.id}>{g.nome}</option>)}</select></label>
              <label>Descrição (opcional)<textarea className="input" rows={3} value={formEvento.descricao} onChange={e => setFormEvento(s => ({ ...s, descricao: e.target.value }))} /></label>
              <div className="modal-actions"><button type="button" className="btn btn-ghost" onClick={() => setAbrirModalEvento(false)}>Cancelar</button><button type="submit" className="btn btn-primary">Salvar</button></div>
            </form>
          </div>
        </div>
      )}

      {abrirModalAtividade && (
        <div className="modal-overlay" onClick={() => setAbrirModalAtividade(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>Nova Atividade</h3><button className="btn btn-ghost" onClick={() => setAbrirModalAtividade(false)}>✕</button></div>
            <form className="modal-body" onSubmit={criarAtividade}>
              <label>Título<input className={`input ${errosAtividade.titulo && "input-error"}`} type="text" value={formAtividade.titulo} onChange={e => setFormAtividade(s => ({ ...s, titulo: e.target.value }))} autoFocus />{errosAtividade.titulo && <span className="error-text">{errosAtividade.titulo}</span>}</label>
              <label>Descrição (opcional)<textarea className="input" rows={3} value={formAtividade.descricao} onChange={e => setFormAtividade(s => ({ ...s, descricao: e.target.value }))} /></label>
              <div className="modal-actions"><button type="button" className="btn btn-ghost" onClick={() => setAbrirModalAtividade(false)}>Cancelar</button><button type="submit" className="btn btn-primary">Criar</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}