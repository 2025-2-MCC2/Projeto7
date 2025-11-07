import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import './DoacaoGrupo.css';

/* ============ Utils ============ */
const API_BASE = '/api';
const currency = (v) =>
  (Number(v ?? 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dateTimeBR = (iso) => {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return '—'; }
};
const initials = (name = '?') => {
  const p = String(name).trim().split(/\s+/);
  return ((p[0]?.[0] ?? '') + (p[p.length - 1]?.[0] ?? '') || '?').toUpperCase();
};
/* Exibe valor doado conforme tipo */
const formatDoacaoPrimaria = (d) => {
  if (d.tipo_doacao === 'dinheiro') return currency(d.valor_doacao);
  if (d.tipo_doacao === 'item') {
    const qtd = Number(d.quantidade ?? 0).toLocaleString('pt-BR');
    const un = d.unidade ?? 'unid.';
    const nm = d.item_doacao ?? 'Item';
    return `${nm} (${qtd} ${un})`;
  }
  return '—';
};

/* Perfil local */
const loadPerfil = () => {
  try { return JSON.parse(localStorage.getItem('perfil')) || {}; } catch { return {}; }
};

/* ============ Página ============ */
export default function DoacaoGrupo() {
  const { id } = useParams();
  const groupId = Number(id);
  const navigate = useNavigate();

  /* Perfil -> para permissões */
  const [perfil] = useState(() => loadPerfil());
  const isMentorLike = (perfil?.tipo === 'mentor' || perfil?.tipo === 'adm');
  const isAluno = perfil?.tipo === 'aluno';

  /* Grupo */
  const [grupo, setGrupo] = useState(null);
  const [loadingGrupo, setLoadingGrupo] = useState(true);

  /* Doações */
  const [doacoes, setDoacoes] = useState([]);
  const [loadingDoacoes, setLoadingDoacoes] = useState(true);
  const [errorDoacoes, setErrorDoacoes] = useState('');

  /* Filtros / ordenação */
  const [q, setQ] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('todas'); // todas|pendente|aprovada|rejeitada
  const [tipoFiltro, setTipoFiltro] = useState('todos'); // todos|dinheiro|item
  const [onlyWithImages, setOnlyWithImages] = useState(false);
  const [order, setOrder] = useState('recentes'); // recentes|antigos|valor|a_z

  /* Modal nova doação (Definição correta) */
  const [openNew, setOpenNew] = useState(false);
  const [tipoDoacaoForm, setTipoDoacaoForm] = useState(''); // dinheiro|item
  const [form, setForm] = useState({
    descricao: '',
    doador_nome: '',
    valor_doacao: '',
    item_doacao: '',
    quantidade: '',
    unidade: 'un',
  });
  const [err, setErr] = useState({});
  const [registering, setRegistering] = useState(false);

  /* Modal de Rejeição */
  const [rejectModal, setRejectModal] = useState({ open: false, doacaoId: null });
  const [rejectionReason, setRejectionReason] = useState('');

  /* Anexos locais (pré-upload) */
  const draftAttachRef = useRef(null);
  const [draftAttachments, setDraftAttachments] = useState([]);
  const hiddenFileRef = useRef(null);
  const [uploadTargetId, setUploadTargetId] = useState(null);

  /* Galeria / Lightbox */
  const [lbOpen, setLbOpen] = useState(false);
  const [lbIndex, setLbIndex] = useState(0);

  /* ========= Carregar Grupo ========= */
  useEffect(() => {
    let abort = false;
    (async () => {
      setLoadingGrupo(true);
      try {
        const r = await fetch(`${API_BASE}/grupos/${groupId}`, {
          credentials: 'include', // <-- CORRIGIDO
        });
        if (!r.ok) throw new Error(`Grupo ${groupId} não encontrado`);
        const data = await r.json();
        if (!abort) setGrupo(data);
      } catch {
        if (!abort) setGrupo(null);
      } finally {
        if (!abort) setLoadingGrupo(false);
      }
    })();
    return () => { abort = true; };
  }, [groupId]);

  /* ========= Carregar Doações ========= */
  const loadDoacoes = useCallback(async () => {
    setLoadingDoacoes(true);
    setErrorDoacoes('');
    try {
      const r = await fetch(`${API_BASE}/grupos/${groupId}/doacoes?status=todas`, {
        credentials: 'include', // <-- CORRIGIDO
      });
      if (!r.ok) {
        const t = await r.text();
        throw new Error(`Falha ao buscar doações (${r.status}): ${t}`);
      }
      const data = await r.json();
      // normaliza attachments caso não venha
      const norm = (Array.isArray(data) ? data : []).map(d => ({
        ...d,
        attachments: Array.isArray(d.attachments) ? d.attachments : [],
      }));
      setDoacoes(norm);
    } catch (e) {
      setErrorDoacoes(e.message || 'Erro ao carregar doações.');
    } finally {
      setLoadingDoacoes(false);
    }
  }, [groupId]);

  useEffect(() => { loadDoacoes(); }, [loadDoacoes]);

  /* ========= KPIs ========= */
  const kpis = useMemo(() => {
    const aprovadas = doacoes.filter(d => d.status_doacao === 'aprovada');
    const pendentes = doacoes.filter(d => d.status_doacao === 'pendente');
    const totalR$ = aprovadas
      .filter(d => d.tipo_doacao === 'dinheiro')
      .reduce((s, d) => s + Number(d.valor_doacao ?? 0), 0);
    const totalItens = aprovadas
      .filter(d => d.tipo_doacao === 'item')
      .reduce((s, d) => s + Number(d.quantidade ?? 0), 0);
    return { totalFinanceiro: totalR$, totalItens, pendentes: pendentes.length };
  }, [doacoes]);

  /* ========= Filtros / Ordenação ========= */
  const doacoesFiltradas = useMemo(() => {
    let list = [...doacoes];
    if (q.trim()) {
      const s = q.toLowerCase();
      list = list.filter(d =>
        (d.descricao ?? '').toLowerCase().includes(s) ||
        (d.doador_nome ?? '').toLowerCase().includes(s) ||
        (d.item_doacao ?? '').toLowerCase().includes(s) ||
        (d.nome_usuario_registro ?? '').toLowerCase().includes(s)
      );
    }
    if (statusFiltro !== 'todas') list = list.filter(d => d.status_doacao === statusFiltro);
    if (tipoFiltro !== 'todos') list = list.filter(d => d.tipo_doacao === tipoFiltro);
    if (onlyWithImages) list = list.filter(d => (d.attachments ?? []).some(a => a.type?.startsWith('image/')));
    if (order === 'recentes') {
      list.sort((a, b) => new Date(b.doacao_data_registro ?? 0) - new Date(a.doacao_data_registro ?? 0));
    } else if (order === 'antigos') {
      list.sort((a, b) => new Date(a.doacao_data_registro ?? 0) - new Date(b.doacao_data_registro ?? 0));
    } else if (order === 'valor') {
      list.sort((a, b) => {
        const va = a.tipo_doacao === 'dinheiro' ? Number(a.valor_doacao ?? 0) : 0;
        const vb = b.tipo_doacao === 'dinheiro' ? Number(b.valor_doacao ?? 0) : 0;
        return vb - va;
      });
    } else if (order === 'a_z') {
      list.sort((a, b) =>
        String(a.doador_nome ?? a.item_doacao ?? '').localeCompare(
          String(b.doador_nome ?? b.item_doacao ?? ''), 'pt-BR'
        )
      );
    }
    return list;
  }, [doacoes, q, statusFiltro, tipoFiltro, onlyWithImages, order]);

  /* ========= Validação / Registro ========= */
  const validateNew = useCallback(() => {
    const e = {};
    if (!tipoDoacaoForm) e.tipoDoacaoForm = 'Selecione o tipo';
    if (tipoDoacaoForm === 'dinheiro') {
      const v = Number(form.valor_doacao);
      if (!(v > 0)) e.valor_doacao = 'Valor > 0';
    } else if (tipoDoacaoForm === 'item') {
      if (!form.item_doacao?.trim()) e.item_doacao = 'Informe item';
      const qt = Number(form.quantidade);
      if (!(qt > 0)) e.quantidade = 'Qtd > 0';
      if (!form.unidade?.trim()) e.unidade = 'Selecione unidade';
    }
    if (form.descricao && form.descricao.trim().length > 0 && form.descricao.trim().length < 3) {
      e.descricao = 'Mínimo 3 caracteres';
    }
    setErr(e);
    return Object.keys(e).length === 0;
  }, [form, tipoDoacaoForm]);

  const registrarDoacao = useCallback(async (e) => {
    e?.preventDefault?.();
    if (!validateNew()) return;
    setRegistering(true);
    setErr({});
    setErrorDoacoes('');
    try {
      const payload = {
        tipo_doacao: tipoDoacaoForm,
        doador_nome: form.doador_nome?.trim() || null,
        descricao: form.descricao?.trim() || null,
        valor_doacao: tipoDoacaoForm === 'dinheiro' ? Number(form.valor_doacao) : undefined,
        item_doacao: tipoDoacaoForm === 'item' ? form.item_doacao.trim() : undefined,
        quantidade: tipoDoacaoForm === 'item' ? Number(form.quantidade) : undefined,
        unidade: tipoDoacaoForm === 'item' ? form.unidade.trim() : undefined,
      };
      const response = await fetch(`${API_BASE}/grupos/${groupId}/doacoes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        let eM = `Erro (${response.status})`;
        try { const eD = await response.json(); eM = eD.error || eM; } catch {}
        throw new Error(eM);
      }
      const nova = await response.json();
      // anexos locais (mock local)
      if (draftAttachments.length) {
        nova.attachments = draftAttachments.map(a => ({
          id: a.id, name: a.name, type: a.type, size: a.size, dataUrl: a.dataUrl, status: 'local'
        }));
      }
      setDoacoes(prev => [nova, ...prev]);
      setForm({ descricao: '', doador_nome: '', valor_doacao: '', item_doacao: '', quantidade: '', unidade: 'un' });
      setTipoDoacaoForm('');
      setDraftAttachments([]);
      setOpenNew(false);
    } catch (error) {
      setErr(prev => ({ ...prev, _global: error.message || 'Erro.' }));
    } finally {
      setRegistering(false);
    }
  }, [validateNew, form, tipoDoacaoForm, groupId, draftAttachments]);

  /* ========= Aprovar / Rejeitar / Excluir ========= */
  const [updatingStatusId, setUpdatingStatusId] = useState(null);

  const handleApprove = useCallback(async (doacaoId) => {
    if (!isMentorLike) return;
    setUpdatingStatusId(doacaoId);
    setErrorDoacoes('');
    try {
      const r = await fetch(`${API_BASE}/grupos/${groupId}/doacoes/${doacaoId}/aprovar`, {
        method: 'PUT',
        credentials: 'include'
      });
      if (!r.ok) {
        let eM = `Falha (${r.status})`;
        try { const eD = await r.json(); eM = eD.error || eM; } catch {}
        throw new Error(eM);
      }
      const atualizado = await r.json();
      setDoacoes(prev => prev.map(d => d.ID_doacao === doacaoId ? atualizado : d));
    } catch (error) {
      setErrorDoacoes(error.message || 'Erro.');
    } finally {
      setUpdatingStatusId(null);
    }
  }, [groupId, isMentorLike]);

  // Função 'executeReject' (que substituiu o prompt)
  const executeReject = useCallback(async (e) => {
    e?.preventDefault(); // É um submit de formulário agora
    if (!isMentorLike || !rejectModal.doacaoId) return;

    const doacaoId = rejectModal.doacaoId;
    const observacao = rejectionReason.trim() || null; // Pega do state

    setUpdatingStatusId(doacaoId);
    setErrorDoacoes('');
    try {
      const r = await fetch(`${API_BASE}/grupos/${groupId}/doacoes/${doacaoId}/rejeitar`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ observacao }), // Envia a observação do state
      });
      if (!r.ok) {
        let eM = `Falha (${r.status})`;
        try { const eD = await r.json(); eM = eD.error || eM; } catch {}
        throw new Error(eM);
      }
      const atualizado = await r.json();
      setDoacoes(prev => prev.map(d => d.ID_doacao === doacaoId ? atualizado : d));
    } catch (error) {
      setErrorDoacoes(error.message || 'Erro.');
    } finally {
      setUpdatingStatusId(null);
      setRejectModal({ open: false, doacaoId: null }); // Fecha o modal
      setRejectionReason(''); // Limpa o state
    }
  }, [groupId, isMentorLike, rejectModal.doacaoId, rejectionReason]);

  // Função para ABRIR o modal de rejeição
  const openRejectModal = (doacaoId) => {
    setRejectModal({ open: true, doacaoId: doacaoId });
    setRejectionReason(''); // Limpa o motivo anterior
  };

  const removerDoacao = useCallback(async (doacaoId) => {
    const d = doacoes.find(x => x.ID_doacao === doacaoId);
    if (d && d.status_doacao !== 'pendente') {
      alert('Apenas pendentes podem ser excluídas.');
      return;
    }
    if (!window.confirm(`Excluir doação ID ${doacaoId}?`)) return;
    setErrorDoacoes('');
    try {
      const r = await fetch(`${API_BASE}/grupos/${groupId}/doacoes/${doacaoId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!r.ok) {
        let eM = `Falha (${r.status})`;
        try { const eD = await r.json(); eM = eD.error || eM; } catch {}
        throw new Error(eM);
      }
      setDoacoes(prev => prev.filter(x => x.ID_doacao !== doacaoId));
    } catch (error) {
      setErrorDoacoes(error.message || 'Erro.');
    }
  }, [groupId, doacoes]);

  /* ========= Anexos locais ========= */
  const fileToDataUrl = (file) => new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result));
    fr.onerror = rej;
    fr.readAsDataURL(file);
  });
  const addDraftAttachments = async (fileList) => {
    const fs = Array.from(fileList ?? []);
    if (!fs.length) return;
    const n = [];
    for (const f of fs) {
      let dataUrl;
      if (f.type?.startsWith('image/')) {
        try { dataUrl = await fileToDataUrl(f); } catch {}
      }
      n.push({ id: Date.now() + Math.random(), name: f.name, type: f.type, size: f.size, dataUrl, status: 'local' });
    }
    setDraftAttachments(p => [...p, ...n]);
  };
  const openUploadFor = (doacaoId) => { setUploadTargetId(doacaoId); hiddenFileRef.current?.click(); };
  const onInputChange = async (e) => {
    const f = e.target.files;
    e.target.value = '';
    if (!uploadTargetId) return;
    const fs = Array.from(f ?? []);
    const newAtts = [];
    for (const file of fs) {
      let dataUrl;
      if (file.type?.startsWith('image/')) {
        try { dataUrl = await fileToDataUrl(file); } catch {}
      }
      newAtts.push({ id: Date.now() + Math.random(), name: file.name, type: file.type, size: file.size, dataUrl, status: 'local' });
    }
    setDoacoes(prev => prev.map(d => d.ID_doacao === uploadTargetId ? { ...d, attachments: [...(d.attachments ?? []), ...newAtts] } : d));
    setUploadTargetId(null);
  };

  /* ========= Galeria ========= */
  const galleryItems = useMemo(() => {
    const i = [];
    doacoes.forEach(d =>
      (d.attachments ?? [])
        .filter(a => a.type?.startsWith('image/') && a.dataUrl)
        .forEach(a => i.push({
          ...a,
          doacaoId: d.ID_doacao,
          doacaoDescricao: d.descricao ?? `Doação ${d.ID_doacao}`,
          createdAt: new Date(d.doacao_data_registro ?? 0),
        }))
    );
    return i.sort((x, y) => y.createdAt - x.createdAt);
  }, [doacoes]);
  const openLB = (idx) => { setLbIndex(idx); setLbOpen(true); };
  const closeLB = () => setLbOpen(false);
  const prevLB = () => setLbIndex(i => (i - 1 + galleryItems.length) % galleryItems.length);
  const nextLB = () => setLbIndex(i => (i + 1) % galleryItems.length);
  const removeFromLB = () => {
    const it = galleryItems[lbIndex];
    if (!it) return;
    setDoacoes(p => p.map(d => d.ID_doacao === it.doacaoId
      ? { ...d, attachments: (d.attachments ?? []).filter(a => a.id !== it.id) }
      : d
    ));
    if (galleryItems.length <= 1) setLbOpen(false);
    else setLbIndex(i => Math.max(0, i - 1));
  };

  /* ========= Render ========= */
  if (loadingGrupo) return <div className="ativ-page">Carregando...</div>;
  if (!grupo) {
    return (
      <div className="ativ-page">
        <button className="btn btn-secondary" onClick={() => navigate(-1)}>← Voltar</button>
        <h2>Grupo não encontrado</h2>
      </div>
    );
  }

  return (
    <div className="ativ-page">
      {/* Header */}
      <div className="ativ-header">
        <div className="left">
          <button className="btn btn-secondary" onClick={() => navigate(-1)}>← Voltar</button>
          <h2 className="page-title">{grupo.nome}</h2>
          {grupo.mentor && (
            <span className="mentor-badge" title={`Mentor: ${grupo.mentor}`}>
              {grupo.mentorFotoUrl ? (
                <img className="avatar small" src={grupo.mentorFotoUrl} alt="Mentor" />
              ) : (
                <span className="avatar small avatar-initials">{initials(grupo.mentor)}</span>
              )}
              <span>{grupo.mentor}</span>
            </span>
          )}
        </div>
        <div className="right">
          <button className="btn btn-primary" onClick={() => setOpenNew(true)}>+ Registrar Doação</button>
        </div>
      </div>

      {/* KPIs do grupo */}
      <div className="ativ-kpis-card">
        <div className="kpis">
          <div className="kpi">
            <span className="label">Arrecadado (R$) Aprovado</span>
            <span className="value">{currency(kpis.totalFinanceiro)}</span>
          </div>
          <div className="kpi">
            <span className="label">Itens aprovados</span>
            <span className="value">{kpis.totalItens.toLocaleString('pt-BR')}</span>
          </div>
          <div className="kpi">
            <span className="label">Pendentes</span>
            <span className="value">{kpis.pendentes}</span>
          </div>
        </div>
        {/* Progresso financeiro x meta do grupo */}
        <div className="progress-bar" title="Progresso financeiro x meta do grupo">
          <div
            className="progress"
            style={{
              width: `${
                Math.min(
                  (Number(grupo.progressoArrecadacao ?? 0) /
                    Math.max(Number(grupo.metaArrecadacao ?? 1), 1)) *
                    100,
                  100
                )
              }%`,
            }}
          />
        </div>
      </div>

      {/* Grid: lista + galeria */}
      <div className="ativ-grid">
        {/* COL ESQUERDA */}
        <div className="ativ-col">
          {/* Toolbar */}
          <div className="toolbar">
            <div className="search">
              <input
                className="input"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por descrição, doador, item, usuário..."
                aria-label="Buscar"
              />
            </div>
            <div className="filters">
              <select value={statusFiltro} onChange={(e) => setStatusFiltro(e.target.value)} aria-label="Filtrar por status">
                <option value="todas">Todas</option>
                <option value="pendente">Pendentes</option>
                <option value="aprovada">Aprovadas</option>
                <option value="rejeitada">Rejeitadas</option>
              </select>
              <select value={tipoFiltro} onChange={(e) => setTipoFiltro(e.target.value)} aria-label="Filtrar por tipo">
                <option value="todos">Todos os tipos</option>
                <option value="dinheiro">Dinheiro</option>
                <option value="item">Item</option>
              </select>
              <label className="chk">
                <input
                  type="checkbox"
                  checked={onlyWithImages}
                  onChange={(e) => setOnlyWithImages(e.target.checked)}
                />
                Imagens
              </label>
              <select value={order} onChange={(e) => setOrder(e.target.value)} aria-label="Ordenar">
                <option value="recentes">Recentes</option>
                <option value="antigos">Antigos</option>
                <option value="valor">Maior valor (R$)</option>
                <option value="a_z">A–Z</option>
              </select>
            </div>
            <div className="actions">
              <button className="btn btn-secondary" onClick={loadDoacoes}>Atualizar</button>
            </div>
          </div>

          {/* Estados */}
          {loadingDoacoes && <p>Carregando...</p>}
          {errorDoacoes && <p className="message error" role="alert">{errorDoacoes}</p>}
          {!loadingDoacoes && !errorDoacoes && doacoesFiltradas.length === 0 && (
            <div className="empty">
              Nenhuma doação encontrada.
              <div style={{ marginTop: 8 }}>
                <button className="btn btn-primary" onClick={() => setOpenNew(true)}>Registrar</button>
              </div>
            </div>
          )}

          {/* Lista */}
          {!loadingDoacoes && !errorDoacoes && doacoesFiltradas.length > 0 && (
            <div className="ativ-list">
              {doacoesFiltradas.map((d) => (
                <div key={d.ID_doacao} className={`card ${d.status_doacao}`}>
                  <div className="card-head">
                    <div className="left">
                      <div className="title">
                        <h3>{formatDoacaoPrimaria(d)}</h3>
                        {d.descricao && <p className="muted">{d.descricao}</p>}
                        <p className="muted">
                          Doador: {d.doador_nome ?? 'Anônimo'} ·{' '}
                          <span className={`badge ${d.status_doacao}`}>{d.status_doacao}</span>{' '}
                          · {dateTimeBR(d.doacao_data_registro)}
                          {d.nome_usuario_registro ? ` · por ${d.nome_usuario_registro}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="right" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <button className="btn btn-secondary" onClick={() => openUploadFor(d.ID_doacao)}>Anexar</button>

                      {/* Mentor/Admin: pode aprovar/rejeitar quando pendente */}
                      {isMentorLike && d.status_doacao === 'pendente' && (
                        <>
                          <button
                            className="btn btn-primary"
                            onClick={() => handleApprove(d.ID_doacao)}
                            disabled={updatingStatusId === d.ID_doacao}
                          >
                            {updatingStatusId === d.ID_doacao ? '...' : 'Aprovar'}
                          </button>
                          {/* onClick chama o ABRIDOR DE MODAL */}
                          <button
                            className="btn btn-danger"
                            onClick={() => openRejectModal(d.ID_doacao)}
                            disabled={updatingStatusId === d.ID_doacao}
                          >
                            {updatingStatusId === d.ID_doacao ? '...' : 'Rejeitar'}
                          </button>
                        </>
                      )}

                      {/* Aluno: exibe chip quando pendente */}
                      {isAluno && d.status_doacao === 'pendente' && (
                        <span className="chip chip-warn" title="Somente mentor/admin podem aprovar">
                          Aguardando aprovação do mentor
                        </span>
                      )}

                      {/* Excluir (mantida regra do front: só pendente) */}
                      {d.status_doacao === 'pendente' && (
                        <button
                          className="btn btn-danger"
                          onClick={() => removerDoacao(d.ID_doacao)}
                          disabled={updatingStatusId === d.ID_doacao}
                        >
                          Excluir
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {/* Bloco de exibição do motivo (agora com fallback) */}
                  {d.status_doacao === 'rejeitada' && (
                    <div className="rejection-reason">
                      <strong>Motivo da Rejeição:</strong> {d.observacao || <em>Nenhum motivo informado.</em>}
                    </div>
                  )}

                  {/* Thumbs/anexos */}
                  {(d.attachments ?? []).length > 0 && (
                    <div className="thumbs">
                      {d.attachments
                        .filter(a => a.type?.startsWith('image/') && a.dataUrl)
                        .map((a, idx) => {
                          const globalIdx = galleryItems.findIndex(g => g.id === a.id);
                          return (
                            <div className="thumb" key={a.id}>
                              <img
                                src={a.dataUrl}
                                alt={a.name}
                                onClick={() => globalIdx >= 0 && openLB(globalIdx)}
                              />
                              <div className="thumb-actions">
                                <input
                                  className="input"
                                  placeholder="Legenda (local)"
                                  defaultValue={a.caption ?? ''}
                                  onBlur={(e) => {
                                    const cap = e.target.value;
                                    setDoacoes(prev => prev.map(x =>
                                      x.ID_doacao === d.ID_doacao
                                        ? { ...x, attachments: (x.attachments ?? []).map(att => att.id === a.id ? { ...att, caption: cap } : att) }
                                        : x
                                    ));
                                  }}
                                />
                                <button
                                  className="btn-ghost"
                                  title="Remover anexo (local)"
                                  onClick={() => {
                                    setDoacoes(prev => prev.map(x =>
                                      x.ID_doacao === d.ID_doacao
                                        ? { ...x, attachments: (x.attachments ?? []).filter(att => att.id !== a.id) }
                                        : x
                                    ));
                                  }}
                                >
                                  ×
                                </button>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Input oculto para anexos em doações existentes */}
          <input
            ref={hiddenFileRef}
            type="file"
            accept="application/pdf,image/png,image/jpeg,image/jpg"
            multiple
            style={{ display: 'none' }}
            onChange={onInputChange}
          />
        </div>

        {/* COL DIREITA — Galeria */}
        <div className="galeria-col">
          <div className="galeria-head">
            <h3>Galeria</h3>
            <span className="muted">{galleryItems.length}</span>
          </div>
          {galleryItems.length === 0 ? (
            <div className="empty">Sem imagens.</div>
          ) : (
            <div className="galeria-grid">
              {galleryItems.map((img, idx) => (
                <figure className="gal-item" key={img.id} onClick={() => openLB(idx)}>
                  <img src={img.dataUrl} alt={img.name} />
                  <figcaption>
                    <span className="cap">{img.caption ?? img.name}</span>
                    <span className="tag">{img.doacaoDescricao}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lbOpen && galleryItems[lbIndex] && (
        <div className="lb-overlay" onClick={closeLB}>
          <div className="lb" onClick={(e) => e.stopPropagation()}>
            <img src={galleryItems[lbIndex].dataUrl} alt={galleryItems[lbIndex].name} />
            <div className="lb-actions">
              <button className="btn btn-secondary" onClick={prevLB}>‹</button>
              <button className="btn btn-secondary" onClick={nextLB}>›</button>
              <button className="btn btn-danger" onClick={removeFromLB}>Remover</button>
              <button className="btn btn-ghost" onClick={closeLB}>Fechar</button>
            </div>
            <div className="lb-caption">{galleryItems[lbIndex].caption ?? galleryItems[lbIndex].name}</div>
          </div>
        </div>
      )}

      {/* Modal Nova Doação */}
      {openNew && (
        <div className="modal-overlay" onClick={() => setOpenNew(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Registrar Doação</h3>
              <button className="btn btn-ghost" onClick={() => setOpenNew(false)}>✕</button>
            </div>
            <form className="modal-body" onSubmit={registrarDoacao}>
              <label>
                Tipo*
                <div className="segmented" style={{ marginTop: 6 }}>
                  <span className="seg-label">Selecione:</span>
                  <div className="seg-buttons">
                    <button type="button" className={`seg ${tipoDoacaoForm === 'dinheiro' ? 'active' : ''}`}
                            onClick={() => setTipoDoacaoForm('dinheiro')}>Dinheiro</button>
                    <button type="button" className={`seg ${tipoDoacaoForm === 'item' ? 'active' : ''}`}
                            onClick={() => setTipoDoacaoForm('item')}>Item</button>
                  </div>
                </div>
                {err.tipoDoacaoForm && <span className="error-text">{err.tipoDoacaoForm}</span>}
              </label>

              {tipoDoacaoForm && (
                <>
                  <label>
                    Doador:
                    <input className="input"
                           value={form.doador_nome}
                           onChange={(e) => setForm(s => ({ ...s, doador_nome: e.target.value }))}
                           placeholder="Nome do doador (opcional)" />
                  </label>

                  {tipoDoacaoForm === 'dinheiro' && (
                    <label>
                      Valor (R$)*:
                      <input
                        className={`input ${err.valor_doacao ? 'input-error' : ''}`}
                        type="number"
                        step="0.01"
                        value={form.valor_doacao}
                        //
                        // 👇 [MUDANÇA 9] ESTA É A CORREÇÃO DO BUG DO DINHEIRO
                        //
                        onChange={(e) => setForm(s => ({ ...s, valor_doacao: e.target.value }))}
                      />
                      {err.valor_doacao && <span className="error-text">{err.valor_doacao}</span>}
                    </label>
                  )}

                  {tipoDoacaoForm === 'item' && (
                    <>
                      <label>
                        Item*:
                        <input
                          className={`input ${err.item_doacao ? 'input-error' : ''}`}
                          value={form.item_doacao}
                          onChange={(e) => setForm(s => ({ ...s, item_doacao: e.target.value }))}
                          placeholder="Ex.: Arroz"
                        />
                        {err.item_doacao && <span className="error-text">{err.item_doacao}</span>}
                      </label>
                      <div className="grid-kg">
                        <label>
                          Qtd*:
                          <input
                            className={`input ${err.quantidade ? 'input-error' : ''}`}
                            type="number"
                            step="1"
                            value={form.quantidade}
                            onChange={(e) => setForm(s => ({ ...s, quantidade: e.target.value }))}
                          />
                          {err.quantidade && <span className="error-text">{err.quantidade}</span>}
                        </label>
                        <label>
                          Unid.*:
                          <select
                            className={`input ${err.unidade ? 'input-error' : ''}`}
                            value={form.unidade}
                            onChange={(e) => setForm(s => ({ ...s, unidade: e.target.value }))}
                          >
                            <option value="un">un</option>
                            <option value="kg">kg</option>
                            <option value="g">g</option>
                            <option value="L">L</option>
                            <option value="pacote">pacote</option>
                            <option value="cx">cx</option>
                          </select>
                          {err.unidade && <span className="error-text">{err.unidade}</span>}
                        </label>
                      </div>
                    </>
                  )}
                </>
              )}

              <label>
                Descrição:
                <textarea
                  className={`input ${err.descricao ? 'input-error' : ''}`}
                  rows={3}
                  value={form.descricao}
                  onChange={(e) => setForm(s => ({ ...s, descricao: e.target.value }))}
                  placeholder="Detalhes (opcional)"
                />
                {err.descricao && <span className="error-text">{err.descricao}</span>}
              </label>

              {/* Anexos (locais) */}
              <div className="anexos-block">
                <div className="anexos-head">
                  <strong>Anexos</strong>
                  <button type="button" className="btn btn-secondary" onClick={() => draftAttachRef.current?.click()}>
                    Adicionar
                  </button>
                </div>
                <input
                  ref={draftAttachRef}
                  type="file"
                  accept="application/pdf,image/png,image/jpeg,image/jpg"
                  multiple
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const f = e.target.files;
                    e.target.value = '';
                    addDraftAttachments(f);
                  }}
                />
                {draftAttachments.length > 0 && (
                  <div className="doc-list">
                    {draftAttachments.map(a => (
                      <div key={a.id} className="doc-chip">
                        <span className="doc-icon">📎</span>
                        <span className="doc-name" title={a.name}>{a.name}</span>
                        <button
                          className="doc-remove"
                          onClick={() => setDraftAttachments(p => p.filter(x => x.id !== a.id))}
                          title="Remover anexo"
                          type="button"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {err._global && <p className="message error" role="alert">{err._global}</p>}
            </form>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setOpenNew(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={registrarDoacao} disabled={registering}>
                {registering ? '...' : 'Registrar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* JSX do NOVO MODAL de Rejeição */}
      {rejectModal.open && (
        <div className="modal-overlay" onClick={() => setRejectModal({ open: false, doacaoId: null })}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Rejeitar Doação</h3>
              <button className="btn btn-ghost" onClick={() => setRejectModal({ open: false, doacaoId: null })}>✕</button>
            </div>
            <form className="modal-body" onSubmit={executeReject}>
              <label>
                Motivo da rejeição (será exibido ao aluno):
                <textarea
                  className="input"
                  rows={4}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Opcional. Ex: Comprovante ilegível, valor incorreto..."
                  autoFocus
                />
              </label>
            </form>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setRejectModal({ open: false, doacaoId: null })}>Cancelar</button>
              <button
                className="btn btn-danger"
                onClick={executeReject}
                disabled={updatingStatusId === rejectModal.doacaoId}
              >
                {updatingStatusId === rejectModal.doacaoId ? 'Rejeitando...' : 'Confirmar Rejeição'}
              </button>
            </div>
          </div>
        </div>
      )}
      <style>{`
        .rejection-reason {
          font-size: 0.9em;
          color: #ae2a2a; /* Cor de perigo/rejeição */
          background-color: #fff5f5;
          border: 1px solid #f6caca;
          padding: 8px 12px;
          border-radius: 6px;
          margin-top: 10px;
        }
        .rejection-reason strong {
          color: #8c2323;
        }
      `}</style>
    </div>
  );
}