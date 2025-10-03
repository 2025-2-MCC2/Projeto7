// src/pages/AtividadesGrupo/AtividadesGrupo.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "./AtividadesGrupo.css";

/* ----------------------------------------------------------------------------
 * Storage helpers
 * --------------------------------------------------------------------------*/
const load = (key, fb) => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fb; } catch { return fb; } };
const save = (key, val) => localStorage.setItem(key, JSON.stringify(val));

/* ----------------------------------------------------------------------------
 * Imagens: compacta via canvas (máx. 1280px no maior lado), JPEG ~0.8
 * --------------------------------------------------------------------------*/
async function fileToCompressedDataURL(file, maxSize = 1280, quality = 0.8) {
  const dataUrl = await new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = dataUrl;
  });
  let { width, height } = img;
  const ratio = width / height;
  if (width > height && width > maxSize) {
    width = maxSize; height = Math.round(maxSize / ratio);
  } else if (height >= width && height > maxSize) {
    height = maxSize; width = Math.round(maxSize * ratio);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", quality);
}

/* ----------------------------------------------------------------------------
 * Constantes do storage
 * --------------------------------------------------------------------------*/
const GRUPOS_KEY = "grupos";
const PERFIL_KEY = "perfil";
const ATIV_GRUPO_KEY = "atividades_by_group"; // { [groupId]: Atividade[] }

/* ----------------------------------------------------------------------------
 * Tipos auxiliares
 * --------------------------------------------------------------------------*/
// ActivityAttachment: { id, name, type, size, dataUrl? (se imagem), caption?, status: 'pending_upload' }
const ACCEPT_ATTACH = "application/pdf,image/png,image/jpeg,image/jpg";

/* ----------------------------------------------------------------------------
 * Lightbox simples
 * --------------------------------------------------------------------------*/
function Lightbox({ open, items, index, onClose, onPrev, onNext, onRemove, showRemove }) {
  if (!open || !items?.length) return null;
  const it = items[index];
  return (
    <div className="lb-overlay" onClick={onClose}>
      <div className="lb" onClick={e => e.stopPropagation()}>
        <img src={it.dataUrl} alt={it.caption || "imagem"} />
        <div className="lb-actions">
          <button className="btn btn-ghost" onClick={onPrev} aria-label="Anterior">‹</button>
          <button className="btn btn-ghost" onClick={onNext} aria-label="Próxima">›</button>
          {showRemove && (
            <button className="btn btn-danger" onClick={() => onRemove(it)} title="Remover imagem">Remover</button>
          )}
          <button className="btn btn-secondary" onClick={onClose}>Fechar</button>
        </div>
        {it.caption && <div className="lb-caption">{it.caption}</div>}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * Página principal
 * --------------------------------------------------------------------------*/
export default function AtividadesGrupo() {
  const navigate = useNavigate();
  const { id } = useParams();
  const groupId = Number(id);

  // perfil & grupos
  const [perfil] = useState(() => load(PERFIL_KEY, { nome: "Usuário", tipo: "aluno", ra: "" }));
  const isStudent = perfil.tipo === "aluno";
  const isMentorLike = ["mentor", "professor", "adm"].includes(perfil.tipo);

  const [grupos] = useState(() => load(GRUPOS_KEY, []));
  const grupo = useMemo(() => grupos.find(g => g.id === groupId), [grupos, groupId]);

  // atividades por grupo (com migração: imagens -> attachments)
  const [ativMap, setAtivMap] = useState(() => load(ATIV_GRUPO_KEY, {}));
  useEffect(() => {
    // Migra atividades antigas que tinham "imagens" (array de {id, dataUrl})
    const list = ativMap[groupId] ?? [];
    const migrated = list.map(a => {
      if (a.attachments) return a;
      const imgs = Array.isArray(a.imagens) ? a.imagens : [];
      const attachments = imgs.map(img => ({
        id: img.id || (Date.now() + Math.random()),
        name: "imagem.jpg",
        type: "image/jpeg",
        size: img.dataUrl ? Math.round((img.dataUrl.length * 3) / 4) : 0,
        dataUrl: img.dataUrl,
        status: "pending_upload",
      }));
      const { imagens, ...rest } = a;
      return { ...rest, attachments };
    });
    if (migrated.some((m, i) => m !== list[i])) {
      setAtivMap(prev => ({ ...prev, [groupId]: migrated }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  const atividades = useMemo(() => ativMap[groupId] ?? [], [ativMap, groupId]);
  const setAtividades = useCallback((updater) => {
    setAtivMap(prev => {
      const arr = typeof updater === "function" ? updater(prev[groupId] ?? []) : updater;
      const next = { ...prev, [groupId]: arr };
      save(ATIV_GRUPO_KEY, next);
      return next;
    });
  }, [groupId]);

  /* ---------------- Filtros / Busca / Ordenação ---------------- */
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("todas"); // todas | pendentes | concluidas
  const [onlyWithImages, setOnlyWithImages] = useState(false);
  const [order, setOrder] = useState("recentes"); // recentes | antigos | a_z

  const atividadesFiltradas = useMemo(() => {
    let list = [...atividades];
    if (q.trim()) {
      const s = q.toLowerCase();
      list = list.filter(a =>
        a.titulo.toLowerCase().includes(s) ||
        (a.descricao || "").toLowerCase().includes(s) ||
        (a.doacao?.doador || "").toLowerCase().includes(s)
      );
    }
    if (status === "pendentes") list = list.filter(a => !a.concluida);
    if (status === "concluidas") list = list.filter(a => a.concluida);
    if (onlyWithImages) list = list.filter(a => (a.attachments || []).some(att => att.type?.startsWith("image/")));

    if (order === "recentes") list.sort((a,b) => (b.createdAt||0) - (a.createdAt||0));
    if (order === "antigos") list.sort((a,b) => (a.createdAt||0) - (b.createdAt||0));
    if (order === "a_z") list.sort((a,b) => a.titulo.localeCompare(b.titulo, "pt-BR"));

    return list;
  }, [atividades, q, status, onlyWithImages, order]);

  /* ---------------- Criação de atividade (com doação + anexos) ---------------- */
  const [openNew, setOpenNew] = useState(false);
  const [form, setForm] = useState({
    titulo: "",
    descricao: "",
    tipoDoacao: "",   // '' | 'dinheiro' | 'itens'
    doador: "",
    valor: "",
    // itens:
    peso: "",         // número
    unidadePeso: "kg",// 'kg' | 'g' (padrão)
    quantidade: "",
  });
  const [err, setErr] = useState({});
  const draftAttachRef = useRef(null);
  const [draftAttachments, setDraftAttachments] = useState([]); // anexos adicionados no modal antes de criar

  const validateNew = () => {
    const e = {};
    if (!form.titulo || form.titulo.trim().length < 3) e.titulo = "Mínimo 3 caracteres";
    if (form.tipoDoacao === "dinheiro") {
      const v = Number(form.valor);
      if (!(v > 0)) e.valor = "Informe um valor (R$) válido";
      if (!form.doador?.trim()) e.doador = "Informe o nome do doador";
    }
    if (form.tipoDoacao === "itens") {
      const peso = Number(form.peso);
      const qt = Number(form.quantidade);
      if (!(peso > 0)) e.peso = "Informe um peso válido (> 0)";
      if (!["kg","g"].includes(form.unidadePeso)) e.unidadePeso = "Selecione a unidade";
      if (!(qt >= 1)) e.quantidade = "Quantidade deve ser ≥ 1";
      if (!form.doador?.trim()) e.doador = "Informe o nome do doador";
    }
    setErr(e);
    return Object.keys(e).length === 0;
  };

  const createAtividade = (e) => {
    e?.preventDefault?.();
    if (!validateNew()) return;
    const nova = {
      id: atividades.length ? Math.max(...atividades.map(a => a.id)) + 1 : 1,
      titulo: form.titulo.trim(),
      descricao: (form.descricao || "").trim(),
      concluida: false,
      createdAt: Date.now(),
      doacao: form.tipoDoacao ? {
        tipo: form.tipoDoacao, // 'dinheiro' | 'itens'
        doador: form.doador?.trim() || "",
        valor: form.tipoDoacao === "dinheiro" ? Number(form.valor) || 0 : undefined,
        peso: form.tipoDoacao === "itens" ? Number(form.peso) || 0 : undefined,
        unidadePeso: form.tipoDoacao === "itens" ? form.unidadePeso : undefined,
        quantidade: form.tipoDoacao === "itens" ? Number(form.quantidade) || 0 : undefined,
      } : null,
      attachments: draftAttachments.map(x => ({ ...x })), // clona o que foi anexado no modal
    };
    setAtividades(prev => [nova, ...prev]);
    // reset
    setForm({
      titulo: "", descricao: "", tipoDoacao: "", doador: "",
      valor: "", peso: "", unidadePeso: "kg", quantidade: ""
    });
    setDraftAttachments([]);
    setOpenNew(false);
  };

  /* ---------------- Concluir/Excluir ---------------- */
  const toggleDone = (aid) => {
    setAtividades(prev => prev.map(a => a.id === aid ? { ...a, concluida: !a.concluida } : a));
  };
  const removeAtividade = (aid) => {
    if (!confirm("Excluir esta atividade?")) return;
    setAtividades(prev => prev.filter(a => a.id !== aid));
  };

  /* ---------------- Upload (botão e arrastar/soltar) ---------------- */
  const hiddenFileRef = useRef(null);
  const [uploadTarget, setUploadTarget] = useState(null);

  const openUploadFor = (aid) => {
    setUploadTarget(aid);
    hiddenFileRef.current?.click();
  };

  const addAttachmentsToActivity = async (aid, filesList) => {
    const files = Array.from(filesList || []);
    if (!files.length) return;
    const newAtts = [];
    for (const f of files) {
      // Cria a estrutura de anexo; se imagem, gera preview comprimido
      let dataUrl;
      if (f.type?.startsWith("image/")) {
        try { dataUrl = await fileToCompressedDataURL(f, 1280, 0.8); } catch { /* ignore */ }
      }
      newAtts.push({
        id: Date.now() + Math.random(),
        name: f.name,
        type: f.type || "application/octet-stream",
        size: f.size || 0,
        dataUrl, // só para imagens
        status: "pending_upload" // aguardando backend
      });
    }
    setAtividades(prev => prev.map(a => a.id === aid ? { ...a, attachments: [...(a.attachments || []), ...newAtts] } : a));
  };

  const onInputChange = async (e) => {
    const files = e.target.files;
    const target = uploadTarget;
    e.target.value = "";
    if (!target) return;
    await addAttachmentsToActivity(target, files);
    setUploadTarget(null);
  };

  // Drop (arrastar & soltar) em toda a grade
  const [isDragging, setIsDragging] = useState(false);
  const onDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = () => setIsDragging(false);
  const onDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (!atividadesFiltradas.length) return;
    const targetId = uploadTarget ?? atividadesFiltradas[0]?.id;
    if (!targetId) return;
    await addAttachmentsToActivity(targetId, e.dataTransfer.files);
    setUploadTarget(null);
  };

  /* ---------------- Galeria (todas as imagens do grupo) ---------------- */
  const galleryItems = useMemo(() => {
    const items = [];
    atividades.forEach(a => (a.attachments || [])
      .filter(att => att.type?.startsWith("image/") && att.dataUrl)
      .forEach(att => items.push({
        ...att, atividadeId: a.id, atividadeTitulo: a.titulo, createdAt: a.createdAt
      }))
    );
    // ordem recente
    return items.sort((x,y) => (y.createdAt || 0) - (x.createdAt || 0));
  }, [atividades]);

  const setAttachmentCaption = (aid, attId, caption) => {
    setAtividades(prev => prev.map(a => {
      if (a.id !== aid) return a;
      return {
        ...a,
        attachments: (a.attachments || []).map(i => i.id === attId ? { ...i, caption } : i)
      };
    }));
  };

  const removeAttachment = (aid, attId) => {
    setAtividades(prev => prev.map(a => a.id === aid
      ? { ...a, attachments: (a.attachments || []).filter(i => i.id !== attId) }
      : a
    ));
  };

  /* ---------------- Lightbox ---------------- */
  const [lbOpen, setLbOpen] = useState(false);
  const [lbIndex, setLbIndex] = useState(0);
  const openLB = (index) => { setLbIndex(index); setLbOpen(true); };
  const closeLB = () => setLbOpen(false);
  const prevLB = () => setLbIndex(i => (i - 1 + galleryItems.length) % galleryItems.length);
  const nextLB = () => setLbIndex(i => (i + 1) % galleryItems.length);
  const removeFromLB = () => {
    const it = galleryItems[lbIndex];
    if (!it) return;
    removeAttachment(it.atividadeId, it.id);
    if (galleryItems.length <= 1) setLbOpen(false);
    else setLbIndex(i => Math.max(0, i - 1));
  };

  /* ---------------- Anexos no modal de criação ---------------- */
  const addDraftAttachments = async (filesList) => {
    const files = Array.from(filesList || []);
    if (!files.length) return;
    const newAtts = [];
    for (const f of files) {
      let dataUrl;
      if (f.type?.startsWith("image/")) {
        try { dataUrl = await fileToCompressedDataURL(f, 1280, 0.8); } catch {}
      }
      newAtts.push({
        id: Date.now() + Math.random(),
        name: f.name,
        type: f.type || "application/octet-stream",
        size: f.size || 0,
        dataUrl,
        status: "pending_upload"
      });
    }
    setDraftAttachments(prev => [...prev, ...newAtts]);
  };

  /* ---------------- Guardas ---------------- */
  if (!grupo) {
    return (
      <div className="ativ-page">
        <div className="ativ-header">
          <button className="btn btn-secondary" onClick={() => navigate("/painel")}>← Voltar</button>
          <h1>Atividades do Grupo</h1>
        </div>
        <p>Grupo não encontrado.</p>
      </div>
    );
  }

  return (
    <div className="ativ-page">
      {/* Header: sumário do grupo */}
      <div className="ativ-header">
        <div className="left">
          <button className="btn btn-secondary" onClick={() => navigate("/painel")}>← Voltar</button>
          <h1 className="page-title">{grupo.nome}</h1>
        </div>
        <div className="right">
          {grupo.mentor && (
            <div className="mentor-badge" title={`Mentor: ${grupo.mentor}`}>
              {grupo.mentorFotoUrl ? (
                <img className="avatar small" src={grupo.mentorFotoUrl} alt={`Mentor ${grupo.mentor}`} />
              ) : (
                <span className="avatar small avatar-initials">
                  {(grupo.mentor || "M").split(/\s+/).map(s => s[0]).join("").slice(0,2).toUpperCase()}
                </span>
              )}
              <span className="mentor-name">{grupo.mentor}</span>
            </div>
          )}
        </div>
      </div>

      {/* KPIs do grupo */}
      <div className="ativ-kpis-card">
        <div className="kpis">
          <div className="kpi"><span className="label">Meta</span><span className="value">R$ {(grupo.metaArrecadacao ?? 0).toFixed(2)}</span></div>
          <div className="kpi"><span className="label">Arrecadado</span><span className="value">R$ {(grupo.progressoArrecadacao ?? 0).toFixed(2)}</span></div>
          {grupo.metaAlimentos && <div className="kpi"><span className="label">Meta alimentos</span><span className="value">{grupo.metaAlimentos}</span></div>}
        </div>
        <div className="progress-bar">
          <div
            className="progress"
            style={{ width: `${Math.min(((grupo.progressoArrecadacao ?? 0) / (grupo.metaArrecadacao || 1)) * 100, 100)}%` }}
          />
        </div>
      </div>

      {/* Grid: Atividades (esq) + Galeria (dir) */}
      <div className={`ativ-grid ${isDragging ? "dragging" : ""}`}
           onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
           aria-label="Área para arrastar e soltar anexos nas atividades">
        {/* Coluna esquerda: Atividades */}
        <section className="ativ-col">
          {/* Filtros */}
          <div className="toolbar">
            <div className="search">
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar atividade/doador..."
                aria-label="Buscar atividade"
              />
            </div>
            <div className="filters">
              <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filtrar por status">
                <option value="todas">Todas</option>
                <option value="pendentes">Pendentes</option>
                <option value="concluidas">Concluídas</option>
              </select>
              <label className="chk">
                <input type="checkbox" checked={onlyWithImages} onChange={(e) => setOnlyWithImages(e.target.checked)} />
                <span>Com imagens</span>
              </label>
              <select value={order} onChange={(e) => setOrder(e.target.value)} aria-label="Ordenar">
                <option value="recentes">Mais recentes</option>
                <option value="antigos">Mais antigos</option>
                <option value="a_z">A–Z</option>
              </select>
            </div>
            <div className="actions">
              <button className="btn btn-primary" onClick={() => setOpenNew(true)}>+ Nova Atividade</button>
            </div>
          </div>

          {/* Dica de drop */}
          <div className={`drop-hint ${isDragging ? "show" : ""}`} aria-hidden={!isDragging}>
            Solte aqui para anexar arquivos à primeira atividade filtrada (ou use “Adicionar Anexos” em um card).
          </div>

          {/* Lista de atividades */}
          {atividadesFiltradas.length === 0 ? (
            <div className="empty">
              <p>Nenhuma atividade encontrada para os filtros aplicados.</p>
              <button className="btn btn-secondary" onClick={() => setOpenNew(true)}>Criar primeira atividade</button>
            </div>
          ) : (
            <div className="ativ-list">
              {atividadesFiltradas.map(a => (
                <article key={a.id} className={`card ${a.concluida ? "done" : ""}`} aria-label={`Atividade: ${a.titulo}`}>
                  <header className="card-head">
                    <div className="left">
                      <input
                        type="checkbox"
                        checked={a.concluida}
                        title={a.concluida ? "Marcar como pendente" : "Marcar como concluída"}
                        onChange={() => toggleDone(a.id)}
                      />
                      <div className="title">
                        <h3>{a.titulo}</h3>
                        {a.descricao && <p className="muted">{a.descricao}</p>}
                        {/* Resumo da doação (se houver) */}
                        {a.doacao && (
                          <p className="muted">
                            {a.doacao.tipo === "dinheiro" ? (
                              <>Doação em dinheiro · <strong>R$ {Number(a.doacao.valor || 0).toFixed(2)}</strong> · Doador: <strong>{a.doacao.doador}</strong></>
                            ) : (
                              <>Doação de itens · <strong>{Number(a.doacao.peso||0)}</strong> <strong>{a.doacao.unidadePeso}</strong> ·
                              {" "}Qtd: <strong>{Number(a.doacao.quantidade||0)}</strong> · Doador: <strong>{a.doacao.doador}</strong></>
                            )}
                          </p>
                        )}
                        <small className="muted">Criada em {new Date(a.createdAt).toLocaleString("pt-BR")}</small>
                      </div>
                    </div>
                    <div className="right">
                      <button className="btn btn-secondary" onClick={() => openUploadFor(a.id)}>
                        Adicionar Anexos
                      </button>
                      <button className="btn btn-danger" onClick={() => removeAtividade(a.id)}>
                        Excluir
                      </button>
                    </div>
                  </header>

                  {/* ANEXOS: imagens (thumbs) + documentos (chips) */}
                  {(a.attachments || []).length > 0 && (
                    <>
                      {/* Imagens */}
                      {(a.attachments || []).some(att => att.type?.startsWith("image/") && att.dataUrl) && (
                        <div className="thumbs">
                          {(a.attachments || []).filter(att => att.type?.startsWith("image/") && att.dataUrl).map(img => (
                            <div key={img.id} className="thumb">
                              <img
                                src={img.dataUrl}
                                alt={img.caption || `Imagem da atividade ${a.titulo}`}
                                onClick={() => openLB(galleryItems.findIndex(g => g.id === img.id))}
                              />
                              <div className="thumb-actions">
                                <input
                                  type="text"
                                  placeholder="Legenda (opcional)"
                                  value={img.caption || ""}
                                  onChange={(e) => setAttachmentCaption(a.id, img.id, e.target.value)}
                                  aria-label="Legenda da imagem"
                                />
                                <span className="badge pending" title="Pendente de upload">pendente</span>
                                <button className="btn btn-ghost" title="Remover" onClick={() => removeAttachment(a.id, img.id)}>×</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Documentos (PDF etc.) */}
                      {(a.attachments || []).some(att => !att.type?.startsWith("image/")) && (
                        <div className="doc-list">
                          {(a.attachments || []).filter(att => !att.type?.startsWith("image/")).map(doc => (
                            <div key={doc.id} className="doc-chip" title={`${doc.name} (${Math.round((doc.size||0)/1024)} KB)`}>
                              <span className="doc-icon">📄</span>
                              <span className="doc-name">{doc.name}</span>
                              <span className="badge pending" title="Pendente de upload">pendente</span>
                              <button className="doc-remove" onClick={() => removeAttachment(a.id, doc.id)} aria-label="Remover anexo">×</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        {/* Coluna direita: Galeria do grupo */}
        <aside className="galeria-col" aria-label="Galeria do grupo">
          <div className="galeria-head">
            <h2>Galeria</h2>
            <span className="muted">{galleryItems.length} imagem(ns)</span>
          </div>
          {galleryItems.length === 0 ? (
            <div className="empty">
              <p>Nenhuma imagem enviada ainda.</p>
              <p className="muted">Use “Adicionar Anexos” em uma atividade para começar.</p>
            </div>
          ) : (
            <div className="galeria-grid">
              {galleryItems.map((img, idx) => (
                <figure key={img.id} className="gal-item" onClick={() => openLB(idx)}>
                  <img src={img.dataUrl} alt={img.caption || `Imagem da atividade ${img.atividadeTitulo}`} />
                  <figcaption title={img.atividadeTitulo}>
                    <span className="cap">{img.caption || "Sem legenda"}</span>
                    <span className="tag">Atividade: {img.atividadeTitulo}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
        </aside>
      </div>

      {/* inputs invisíveis */}
      <input ref={hiddenFileRef} type="file" accept={ACCEPT_ATTACH} multiple style={{ display: "none" }} onChange={onInputChange} />

      {/* Modal: Nova Atividade (com doação + anexos) */}
      {openNew && (
        <div className="modal-overlay" onClick={() => setOpenNew(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Nova Atividade</h3>
              <button className="btn btn-ghost" onClick={() => setOpenNew(false)}>✕</button>
            </div>

            {/* Corpo rolável do modal */}
            <form id="formNovaAtividade" className="modal-body" onSubmit={createAtividade}>
              <label>Título
                <input
                  className={`input ${err.titulo ? "input-error" : ""}`}
                  type="text"
                  value={form.titulo}
                  onChange={(e) => setForm(s => ({ ...s, titulo: e.target.value }))}
                  autoFocus
                />
                {err.titulo && <span className="error-text">{err.titulo}</span>}
              </label>

              <label>Descrição (opcional)
                <textarea
                  className="input"
                  rows={3}
                  value={form.descricao}
                  onChange={(e) => setForm(s => ({ ...s, descricao: e.target.value }))}
                />
              </label>

              {/* Tipo de doação (segmented) */}
              <div className="segmented">
                <span className="seg-label">Tipo de doação (opcional):</span>
                <div className="seg-buttons" role="tablist">
                  <button
                    type="button"
                    role="tab"
                    className={`seg ${form.tipoDoacao === "dinheiro" ? "active" : ""}`}
                    onClick={() =>
                      setForm(s => ({ ...s, tipoDoacao: s.tipoDoacao === "dinheiro" ? "" : "dinheiro" }))
                    }
                  >
                    Dinheiro
                  </button>
                  <button
                    type="button"
                    role="tab"
                    className={`seg ${form.tipoDoacao === "itens" ? "active" : ""}`}
                    onClick={() =>
                      setForm(s => ({ ...s, tipoDoacao: s.tipoDoacao === "itens" ? "" : "itens" }))
                    }
                  >
                    Itens
                  </button>
                </div>
              </div>

              {/* Campos de doação DINHEIRO */}
              {form.tipoDoacao === "dinheiro" && (
                <div className="grid grid-2">
                  <label>Valor arrecadado (R$)
                    <input
                      type="number" min="0" step="0.01" inputMode="decimal"
                      className={`input ${err.valor ? "input-error" : ""}`}
                      value={form.valor}
                      onChange={(e) => setForm(s => ({ ...s, valor: e.target.value }))}
                      placeholder="Ex.: 150.00"
                    />
                    {err.valor && <span className="error-text">{err.valor}</span>}
                  </label>
                  <label>Nome do doador
                    <input
                      type="text"
                      className={`input ${err.doador ? "input-error" : ""}`}
                      value={form.doador}
                      onChange={(e) => setForm(s => ({ ...s, doador: e.target.value }))}
                      placeholder="Ex.: Maria Silva"
                    />
                    {err.doador && <span className="error-text">{err.doador}</span>}
                  </label>
                </div>
              )}

              {/* Campos de doação ITENS — Peso + Unidade + Quantidade + Doador */}
              {form.tipoDoacao === "itens" && (
                <>
                  <div className="grid grid-2">
                    <label>Peso
                      <input
                        type="number" min="0" step="0.001" inputMode="decimal"
                        className={`input ${err.peso ? "input-error" : ""}`}
                        value={form.peso}
                        onChange={(e) => setForm(s => ({ ...s, peso: e.target.value }))}
                        placeholder="Ex.: 2.5"
                      />
                      {err.peso && <span className="error-text">{err.peso}</span>}
                    </label>
                    <label>Unidade do peso
                      <select
                        className={`input ${err.unidadePeso ? "input-error" : ""}`}
                        value={form.unidadePeso}
                        onChange={(e) => setForm(s => ({ ...s, unidadePeso: e.target.value }))}
                      >
                        <option value="kg">kg</option>
                        <option value="g">g</option>
                      </select>
                      {err.unidadePeso && <span className="error-text">{err.unidadePeso}</span>}
                    </label>
                  </div>

                  <div className="grid grid-2">
                    <label>Quantidade de itens
                      <input
                        type="number" min="1" step="1" inputMode="numeric" pattern="[0-9]*"
                        className={`input ${err.quantidade ? "input-error" : ""}`}
                        value={form.quantidade}
                        onChange={(e) => setForm(s => ({ ...s, quantidade: e.target.value }))}
                        placeholder="Ex.: 12"
                      />
                      {err.quantidade && <span className="error-text">{err.quantidade}</span>}
                    </label>

                    <label>Nome do doador
                      <input
                        type="text"
                        className={`input ${err.doador ? "input-error" : ""}`}
                        value={form.doador}
                        onChange={(e) => setForm(s => ({ ...s, doador: e.target.value }))}
                        placeholder="Ex.: João Pereira"
                      />
                      {err.doador && <span className="error-text">{err.doador}</span>}
                    </label>
                  </div>
                </>
              )}

              {/* Anexos no modal (pendente de backend) */}
              <div className="anexos-block">
                <div className="anexos-head">
                  <span>Anexos (PDF/PNG/JPG) — <em>pendentes de upload</em></span>
                  <div>
                    <button type="button" className="btn btn-secondary" onClick={() => draftAttachRef.current?.click()}>
                      Adicionar Anexos
                    </button>
                    <input
                      ref={draftAttachRef}
                      type="file"
                      accept={ACCEPT_ATTACH}
                      multiple
                      hidden
                      onChange={(e) => { const f = e.target.files; e.target.value = ""; addDraftAttachments(f); }}
                    />
                  </div>
                </div>

                {/* Lista de anexos adicionados no modal */}
                {draftAttachments.length > 0 && (
                  <div className="draft-attachments">
                    {/* imagens */}
                    {draftAttachments.some(a => a.type?.startsWith("image/") && a.dataUrl) && (
                      <div className="thumbs">
                        {draftAttachments.filter(a => a.type?.startsWith("image/") && a.dataUrl).map(img => (
                          <div key={img.id} className="thumb">
                            <img src={img.dataUrl} alt={img.name} />
                            <div className="thumb-actions">
                              <input
                                type="text"
                                placeholder="Legenda (opcional)"
                                value={img.caption || ""}
                                onChange={(e) => setDraftAttachments(prev => prev.map(x => x.id === img.id ? { ...x, caption: e.target.value } : x))}
                              />
                              <span className="badge pending">pendente</span>
                              <button className="btn btn-ghost" onClick={() => setDraftAttachments(prev => prev.filter(x => x.id !== img.id))}>×</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* documentos */}
                    {draftAttachments.some(a => !a.type?.startsWith("image/")) && (
                      <div className="doc-list">
                        {draftAttachments.filter(a => !a.type?.startsWith("image/")).map(doc => (
                          <div key={doc.id} className="doc-chip" title={`${doc.name} (${Math.round((doc.size||0)/1024)} KB)`}>
                            <span className="doc-icon">📄</span>
                            <span className="doc-name">{doc.name}</span>
                            <span className="badge pending">pendente</span>
                            <button className="doc-remove" onClick={() => setDraftAttachments(prev => prev.filter(x => x.id !== doc.id))}>×</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </form>

            {/* AÇÕES FIXAS do modal (fora do corpo rolável) */}
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setOpenNew(false)}>Cancelar</button>
              <button form="formNovaAtividade" type="submit" className="btn btn-primary">Criar</button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox da galeria */}
      <Lightbox
        open={lbOpen}
        items={galleryItems}
        index={lbIndex}
        onClose={closeLB}
        onPrev={prevLB}
        onNext={nextLB}
        onRemove={removeFromLB}
        showRemove={isMentorLike || isStudent}
      />
    </div>
  )}
