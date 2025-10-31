// src/pages/AtividadesGrupo/DoacaoGrupo.jsx (Renomeado de AtividadesGrupo.jsx)
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import "./DoacaoGrupo.css";

/* ----------------------------------------------------------------------------
 * Helpers (load, save, fileToCompressedDataURL, Lightbox) - Mantidos do original
 * --------------------------------------------------------------------------*/
const load = (key, fb) => {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fb;
  } catch {
    return fb;
  }
}; //
const save = (key, val) => localStorage.setItem(key, JSON.stringify(val)); //

async function fileToCompressedDataURL(file, maxSize = 1280, quality = 0.8) {
  //
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
    width = maxSize;
    height = Math.round(maxSize / ratio);
  } else if (height >= width && height > maxSize) {
    height = maxSize;
    width = Math.round(maxSize * ratio);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", quality);
}

// Lightbox Component (mantido)
function Lightbox({
  open,
  items,
  index,
  onClose,
  onPrev,
  onNext,
  onRemove,
  showRemove,
}) {
  //
  if (!open || !items?.length) return null;
  const it = items[index];
  return (
    <div className="lb-overlay" onClick={onClose}>
      <div className="lb" onClick={(e) => e.stopPropagation()}>
        <img src={it.dataUrl} alt={it.caption || "imagem"} />
        <div className="lb-actions">
          <button
            className="btn btn-ghost"
            onClick={onPrev}
            aria-label="Anterior"
          >
            ‹
          </button>
          <button
            className="btn btn-ghost"
            onClick={onNext}
            aria-label="Próxima"
          >
            ›
          </button>
          {showRemove && (
            <button
              className="btn btn-danger"
              onClick={() => onRemove(it)}
              title="Remover imagem"
            >
              Remover
            </button>
          )}
          <button className="btn btn-secondary" onClick={onClose}>
            Fechar
          </button>
        </div>
        {it.caption && <div className="lb-caption">{it.caption}</div>}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * Constantes e Configurações
 * --------------------------------------------------------------------------*/
const GRUPOS_KEY = "grupos"; //
const PERFIL_KEY = "perfil"; //
const API_BASE =
  import.meta.env.VITE_API_URL?.replace(/\/+$/, "") ||
  "https://projeto-interdisciplinar-2.onrender.com/api";
const ACCEPT_ATTACH = "application/pdf,image/png,image/jpeg,image/jpg"; //

// Helper para formatar data/hora
const formatDateTime = (isoString) => {
  //
  if (!isoString) return "Data indisponível";
  try {
    const date = new Date(isoString);
    if (isNaN(date)) throw new Error("Invalid Date");
    return date.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "Data inválida";
  }
};
// Helper para formatar valor/item da doação
const formatDoacaoValorItem = (d) => {
  //
  if (d.tipo_doacao === "dinheiro") {
    return `R$ ${(Number(d.valor_doacao) || 0).toFixed(2)}`;
  }
  if (d.tipo_doacao === "item") {
    return `${d.item_doacao || "?"} (${Number(d.quantidade || 0)} ${
      d.unidade || "unid."
    })`;
  }
  return "Tipo desconhecido";
};
// Helper para obter iniciais
const getInitials = (name = "?") => {
  const parts = String(name).trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";
  const ini = `${first}${last}`.trim().toUpperCase();
  return ini || "?";
};
// Helper para formatar moeda
const currency = (v) =>
  Number(v ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

/* ----------------------------------------------------------------------------
 * Página Principal: DoacaoGrupo (Renomeado)
 * --------------------------------------------------------------------------*/
export default function DoacaoGrupo() {
  //
  const navigate = useNavigate();
  const { id } = useParams(); //
  const groupId = Number(id); //

  // Carrega perfil (do localStorage)
  const [perfil] = useState(() =>
    load(PERFIL_KEY, { nome: "Usuário", tipo: "aluno", ra: "" })
  ); //
  const isStudent = perfil.tipo === "aluno"; //
  const isMentorLike = ["mentor", "professor", "adm"].includes(perfil.tipo); //

  // Busca dados do grupo da API
  const [grupo, setGrupo] = useState(null); //
  const [loadingGrupo, setLoadingGrupo] = useState(true); //

  useEffect(() => {
    //
    let abort = false;
    const fetchGrupo = async () => {
      if (!groupId) {
        setLoadingGrupo(false);
        setGrupo(null);
        return;
      }
      setLoadingGrupo(true);
      try {
        const response = await fetch(`${API_BASE}/grupos/${groupId}`, {
          credentials: "include",
        });
        if (!response.ok)
          throw new Error(
            `Grupo ${groupId} não encontrado (${response.status})`
          );
        const data = await response.json();
        if (!abort) setGrupo(data);
      } catch (err) {
        if (!abort) console.error("Erro ao buscar grupo:", err);
        setGrupo(null);
      } finally {
        if (!abort) setLoadingGrupo(false);
      }
    };
    fetchGrupo();
    return () => {
      abort = true;
    };
  }, [groupId]);

  // Estado para Doações (da API)
  const [doacoes, setDoacoes] = useState([]); //
  const [loadingDoacoes, setLoadingDoacoes] = useState(true); //
  const [errorDoacoes, setErrorDoacoes] = useState(""); //

  // useEffect para buscar doações da API
  useEffect(() => {
    //
    let abort = false;
    const fetchDoacoes = async () => {
      if (!groupId) return;
      setLoadingDoacoes(true);
      setErrorDoacoes("");
      try {
        const response = await fetch(
          `${API_BASE}/grupos/${groupId}/doacoes?status=todas`,
          {
            credentials: "include",
          }
        ); //
        if (!response.ok) {
          const errText = await response.text();
          throw new Error(
            `Falha ao buscar doações (${response.status}): ${errText}`
          ); //
        }
        const data = await response.json(); //
        if (!abort) {
          const dataWithLocalAttachments = data.map((d) => ({
            ...d,
            attachments:
              doacoes.find((prevD) => prevD.ID_doacao === d.ID_doacao)
                ?.attachments || [],
          }));
          setDoacoes(
            Array.isArray(dataWithLocalAttachments)
              ? dataWithLocalAttachments
              : []
          ); //
        }
      } catch (err) {
        if (!abort) {
          console.error("Erro ao buscar doações:", err);
          setErrorDoacoes(err.message || "Erro.");
        } //
      } finally {
        if (!abort) setLoadingDoacoes(false); //
      }
    };
    fetchDoacoes();
    return () => {
      abort = true;
    };
  }, [groupId]);

  /* ---------------- Filtros / Busca / Ordenação ---------------- */
  const [q, setQ] = useState(""); //
  const [statusFiltro, setStatusFiltro] = useState("todas"); //
  const [onlyWithImages, setOnlyWithImages] = useState(false); //
  const [order, setOrder] = useState("recentes"); //

  const doacoesFiltradas = useMemo(() => {
    //
    let list = [...doacoes];
    if (q.trim()) {
      //
      const s = q.toLowerCase();
      list = list.filter(
        (d) =>
          (d.descricao || "").toLowerCase().includes(s) ||
          (d.doador_nome || "").toLowerCase().includes(s) ||
          (d.item_doacao || "").toLowerCase().includes(s) ||
          (d.nome_usuario_registro || "").toLowerCase().includes(s)
      );
    }
    if (statusFiltro !== "todas")
      list = list.filter((d) => d.status_doacao === statusFiltro); //
    if (onlyWithImages)
      list = list.filter((d) =>
        (d.attachments || []).some((att) => att.type?.startsWith("image/"))
      ); //
    if (order === "recentes")
      list.sort(
        (a, b) =>
          new Date(b.doacao_data_registro || 0) -
          new Date(a.doacao_data_registro || 0)
      );
    //
    else if (order === "antigos")
      list.sort(
        (a, b) =>
          new Date(a.doacao_data_registro || 0) -
          new Date(b.doacao_data_registro || 0)
      );
    //
    else if (order === "a_z")
      list.sort((a, b) =>
        (a.item_doacao || a.doador_nome || "").localeCompare(
          b.item_doacao || b.doador_nome || "",
          "pt-BR"
        )
      ); //
    return list;
  }, [doacoes, q, statusFiltro, onlyWithImages, order]);

  /* ---------------- Registro de Nova Doação ---------------- */
  const [openNew, setOpenNew] = useState(false); //
  const [form, setForm] = useState({
    descricao: "",
    doador_nome: "",
    valor_doacao: "",
    item_doacao: "",
    quantidade: "",
    unidade: "un",
  }); //
  const [tipoDoacaoForm, setTipoDoacaoForm] = useState(""); //
  const [err, setErr] = useState({}); //
  const draftAttachRef = useRef(null); //
  const [draftAttachments, setDraftAttachments] = useState([]); //

  const validateNew = useCallback(() => {
    //
    const e = {};
    if (form.descricao && form.descricao.trim().length < 3)
      e.descricao = "Mínimo 3 caracteres";
    if (!tipoDoacaoForm) e.tipoDoacaoForm = "Selecione o tipo";
    else if (tipoDoacaoForm === "dinheiro") {
      const v = Number(form.valor_doacao);
      if (!(v > 0)) e.valor_doacao = "Valor > 0";
    } else if (tipoDoacaoForm === "item") {
      if (!form.item_doacao?.trim()) e.item_doacao = "Informe item";
      const qt = Number(form.quantidade);
      if (!(qt > 0)) e.quantidade = "Qtd > 0";
      if (!form.unidade?.trim()) e.unidade = "Selecione unid.";
    }
    setErr(e);
    return Object.keys(e).length === 0;
  }, [form, tipoDoacaoForm]);

  const [registering, setRegistering] = useState(false); //
  const registrarDoacao = async (e) => {
    //
    e?.preventDefault?.();
    if (!validateNew()) return;
    setRegistering(true);
    setErr({});
    setErrorDoacoes("");
    const payload = {
      //
      tipo_doacao: tipoDoacaoForm,
      doador_nome: form.doador_nome?.trim() || null,
      descricao: form.descricao?.trim() || null,
      valor_doacao:
        tipoDoacaoForm === "dinheiro" ? Number(form.valor_doacao) : undefined,
      item_doacao:
        tipoDoacaoForm === "item" ? form.item_doacao.trim() : undefined,
      quantidade:
        tipoDoacaoForm === "item" ? Number(form.quantidade) : undefined,
      unidade: tipoDoacaoForm === "item" ? form.unidade.trim() : undefined,
      // TODO: Enviar anexos
    };
    try {
      const response = await fetch(`${API_BASE}/grupos/${groupId}/doacoes`, {
        credentials: "include",
        method: "POST",
        headers: { "Content-Type": "application/json" /* Authorization? */ },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        let eM = `Erro (${response.status})`;
        try {
          const eD = await response.json();
          eM = eD.error || eM;
        } catch {}
        throw new Error(eM);
      } //
      const novaDoacao = await response.json(); //
      novaDoacao.attachments = draftAttachments; // Associa anexos locais
      setDoacoes((prev) => [novaDoacao, ...prev]); //
      setForm({
        descricao: "",
        doador_nome: "",
        valor_doacao: "",
        item_doacao: "",
        quantidade: "",
        unidade: "un",
      }); //
      setTipoDoacaoForm("");
      setDraftAttachments([]);
      setOpenNew(false); //
    } catch (error) {
      console.error("Erro:", error);
      setErr((prev) => ({ ...prev, _global: error.message || "Erro." })); //
    } finally {
      setRegistering(false);
    } //
  };

  /* ---------------- Excluir Doação ---------------- */
  const removerDoacao = async (doacaoId) => {
    //
    if (!confirm(`Excluir doação ID ${doacaoId}?`)) return; //
    const d = doacoes.find((x) => x.ID_doacao === doacaoId);
    if (d && d.status_doacao !== "pendente") {
      alert("Apenas pendentes podem ser excluídas.");
      return;
    } //
    setErrorDoacoes(""); //
    try {
      const r = await fetch(
        `${API_BASE}/grupos/${groupId}/doacoes/${doacaoId}`,
        { method: "DELETE" /* Headers? */ }
      ); //
      if (!r.ok) {
        let eM = `Falha (${r.status})`;
        try {
          const eD = await r.json();
          eM = eD.error || eM;
        } catch {}
        throw new Error(eM);
      } //
      setDoacoes((prev) => prev.filter((x) => x.ID_doacao !== doacaoId)); //
    } catch (error) {
      console.error("Erro:", error);
      setErrorDoacoes(error.message || "Erro.");
    } //
  };

  /* ---------------- Lógica de Anexos (Local) ---------------- */
  const hiddenFileRef = useRef(null); //
  const [uploadTargetId, setUploadTargetId] = useState(null); //
  const openUploadFor = (doacaoId) => {
    setUploadTargetId(doacaoId);
    hiddenFileRef.current?.click();
  }; //
  const addAttachmentsToLocalDoacao = async (doacaoId, filesList) => {
    //
    const files = Array.from(filesList || []);
    if (!files.length) return;
    const newAtts = [];
    for (const f of files) {
      let dU;
      if (f.type?.startsWith("image/")) {
        try {
          dU = await fileToCompressedDataURL(f);
        } catch {}
      }
      newAtts.push({
        id: Date.now() + Math.random(),
        name: f.name,
        type: f.type,
        size: f.size,
        dataUrl: dU,
        status: "local",
      });
    } //
    setDoacoes((prev) =>
      prev.map((d) =>
        d.ID_doacao === doacaoId
          ? { ...d, attachments: [...(d.attachments || []), ...newAtts] }
          : d
      )
    ); //
    alert("Anexos locais adicionados. Upload não implementado."); //
    // TODO: Implementar upload real
  };
  const onInputChange = async (e) => {
    const f = e.target.files;
    const t = uploadTargetId;
    e.target.value = "";
    if (!t) return;
    await addAttachmentsToLocalDoacao(t, f);
    setUploadTargetId(null);
  }; //
  const [isDragging, setIsDragging] = useState(false); //
  const onDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const onDragLeave = () => {
    setIsDragging(false);
  };
  const onDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (!doacoesFiltradas.length) return;
    const t = uploadTargetId ?? doacoesFiltradas[0]?.ID_doacao;
    if (!t) return;
    await addAttachmentsToLocalDoacao(t, e.dataTransfer.files);
    setUploadTargetId(null);
  }; //
  const galleryItems = useMemo(() => {
    const i = [];
    doacoes.forEach((d) =>
      (d.attachments || [])
        .filter((a) => a.type?.startsWith("image/") && a.dataUrl)
        .forEach((a) =>
          i.push({
            ...a,
            doacaoId: d.ID_doacao,
            doacaoDescricao: d.descricao || `Doação ${d.ID_doacao}`,
            createdAt: new Date(d.doacao_data_registro || 0),
          })
        )
    );
    return i.sort((x, y) => y.createdAt - x.createdAt);
  }, [doacoes]); //
  const setAttachmentCaption = (dId, aId, cap) => {
    setDoacoes((p) =>
      p.map((d) =>
        d.ID_doacao !== dId
          ? d
          : {
              ...d,
              attachments: (d.attachments || []).map((a) =>
                a.id === aId ? { ...a, caption: cap } : a
              ),
            }
      )
    ); /* TODO: API PUT */
  }; //
  const removeAttachment = (dId, aId) => {
    setDoacoes((p) =>
      p.map((d) =>
        d.ID_doacao === dId
          ? {
              ...d,
              attachments: (d.attachments || []).filter((a) => a.id !== aId),
            }
          : d
      )
    );
    alert(
      "Removido local. Delete API não implementado."
    ); /* TODO: API DELETE */
  }; //
  const [lbOpen, setLbOpen] = useState(false);
  const [lbIndex, setLbIndex] = useState(0);
  const openLB = (i) => {
    setLbIndex(i);
    setLbOpen(true);
  };
  const closeLB = () => {
    setLbOpen(false);
  };
  const prevLB = () => {
    setLbIndex((i) => (i - 1 + galleryItems.length) % galleryItems.length);
  };
  const nextLB = () => {
    setLbIndex((i) => (i + 1) % galleryItems.length);
  };
  const removeFromLB = () => {
    const it = galleryItems[lbIndex];
    if (!it) return;
    removeAttachment(it.doacaoId, it.id);
    if (galleryItems.length <= 1) setLbOpen(false);
    else setLbIndex((i) => Math.max(0, i - 1));
  }; //
  const addDraftAttachments = async (fL) => {
    const f = Array.from(fL || []);
    if (!f.length) return;
    const nA = [];
    for (const file of f) {
      let dU;
      if (file.type?.startsWith("image/")) {
        try {
          dU = await fileToCompressedDataURL(file);
        } catch {}
      }
      nA.push({
        id: Date.now() + Math.random(),
        name: file.name,
        type: file.type,
        size: file.size,
        dataUrl: dU,
        status: "local",
      });
    }
    setDraftAttachments((p) => [...p, ...nA]);
  }; //

  /* ---------------- Aprovar/Rejeitar Doação ---------------- */
  const [updatingStatusId, setUpdatingStatusId] = useState(null);

  const handleApprove = useCallback(
    async (doacaoId) => {
      //
      setUpdatingStatusId(doacaoId);
      setErrorDoacoes("");
      try {
        const response = await fetch(
          `${API_BASE}/grupos/${groupId}/doacoes/${doacaoId}/aprovar`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" /* Auth? */ },
          }
        ); //
        if (!response.ok) {
          let eM = `Falha(${response.status})`;
          try {
            const eD = await response.json();
            eM = eD.error || eM;
          } catch {}
          throw new Error(eM);
        } //
        const doacaoAtualizada = await response.json(); //
        setDoacoes((prev) =>
          prev.map((d) => (d.ID_doacao === doacaoId ? doacaoAtualizada : d))
        ); //
      } catch (error) {
        console.error("Erro:", error);
        setErrorDoacoes(error.message || "Erro.");
      } finally {
        //
        setUpdatingStatusId(null);
      } //
    },
    [groupId]
  );

  const handleReject = useCallback(
    async (doacaoId) => {
      //
      const observacao = prompt("Motivo da rejeição (opcional):"); //
      setUpdatingStatusId(doacaoId);
      setErrorDoacoes("");
      try {
        const response = await fetch(
          `${API_BASE}/grupos/${groupId}/doacoes/${doacaoId}/rejeitar`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" /* Auth? */ },
            body: JSON.stringify({ observacao: observacao ?? null }),
          }
        ); //
        if (!response.ok) {
          let eM = `Falha(${response.status})`;
          try {
            const eD = await response.json();
            eM = eD.error || eM;
          } catch {}
          throw new Error(eM);
        } //
        const doacaoAtualizada = await response.json(); //
        setDoacoes((prev) =>
          prev.map((d) => (d.ID_doacao === doacaoId ? doacaoAtualizada : d))
        ); //
      } catch (error) {
        console.error("Erro:", error);
        setErrorDoacoes(error.message || "Erro.");
      } finally {
        //
        setUpdatingStatusId(null);
      } //
    },
    [groupId]
  );

  /* ---------------- Guardas ---------------- */
  if (loadingGrupo) {
    return (
      <div className="ativ-page">
        <p>Carregando...</p>
      </div>
    );
  } //
  if (!grupo) {
    return (
      <div className="ativ-page">
        <div className="ativ-header">
          <button className="btn btn-secondary" onClick={() => navigate(-1)}>
            ← Voltar
          </button>
          <h1>Registro</h1>
        </div>
        <p className="message error">Grupo ID {groupId} não encontrado.</p>
      </div>
    );
  } //

  /* ---------------- RENDER ---------------- */
  return (
    //
    <div className="ativ-page">
      <div className="ativ-header">
        {" "}
        {/* */}
        <div className="left">
          <button className="btn btn-secondary" onClick={() => navigate(-1)}>
            ← Voltar
          </button>
          <h1 className="page-title">{grupo.nome}</h1>
        </div>{" "}
        {/* */}
        <div className="right">
          {grupo.mentor && (
            <div className="mentor-badge">
              {grupo.mentorFotoUrl ? (
                <img className="avatar small" src={grupo.mentorFotoUrl} />
              ) : (
                <span className="avatar small avatar-initials">
                  {getInitials(grupo.mentor)}
                </span>
              )}
              <span className="mentor-name">{grupo.mentor}</span>
            </div>
          )}
        </div>{" "}
        {/* */}
      </div>
      <div className="ativ-kpis-card">
        {" "}
        {/* */}
        <div className="kpis">
          <div className="kpi">
            <span>Meta</span>
            <span>{currency(grupo.metaArrecadacao)}</span>
          </div>
          <div className="kpi">
            <span>Arrecadado</span>
            <span>{currency(grupo.progressoArrecadacao)}</span>
          </div>
          {grupo.metaAlimentos && (
            <div className="kpi">
              <span>Meta Alim.</span>
              <span>{grupo.metaAlimentos}</span>
            </div>
          )}
        </div>{" "}
        {/* */}
        <div className="progress-bar">
          <div
            className="progress"
            style={{
              width: `${Math.min(
                ((grupo.progressoArrecadacao || 0) /
                  (grupo.metaArrecadacao || 1)) *
                  100,
                100
              )}%`,
            }}
          />
        </div>{" "}
        {/* */}
      </div>
      <div
        className={`ativ-grid ${isDragging ? "dragging" : ""}`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {" "}
        {/* */}
        <section className="ativ-col">
          {" "}
          {/* */}
          <div className="toolbar">
            {" "}
            {/* */}
            <div className="search">
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar..."
                aria-label="Buscar"
              />
            </div>{" "}
            {/* */}
            <div className="filters">
              <select
                value={statusFiltro}
                onChange={(e) => setStatusFiltro(e.target.value)}
              >
                <option value="todas">Todas</option>
                <option value="pendente">Pendentes</option>
                <option value="aprovada">Aprovadas</option>
                <option value="rejeitada">Rejeitadas</option>
              </select>
              <label className="chk">
                <input
                  type="checkbox"
                  checked={onlyWithImages}
                  onChange={(e) => setOnlyWithImages(e.target.checked)}
                />
                <span>Imagens</span>
              </label>
              <select value={order} onChange={(e) => setOrder(e.target.value)}>
                <option value="recentes">Recentes</option>
                <option value="antigos">Antigos</option>
                <option value="a_z">A–Z</option>
              </select>
            </div>{" "}
            {/* */}
            <div className="actions">
              <button
                className="btn btn-primary"
                onClick={() => setOpenNew(true)}
              >
                + Registrar
              </button>
            </div>{" "}
            {/* */}
          </div>
          <div className={`drop-hint ${isDragging ? "show" : ""}`}>
            Solte aqui (upload não implementado).
          </div>{" "}
          {/* */}
          {loadingDoacoes && (
            <div className="empty">
              <p>Carregando...</p>
            </div>
          )}{" "}
          {/* */}
          {errorDoacoes && (
            <div className="empty message error">
              <p>{errorDoacoes}</p>
            </div>
          )}{" "}
          {/* */}
          {!loadingDoacoes &&
            !errorDoacoes &&
            doacoesFiltradas.length === 0 && (
              <div className="empty">
                <p>Nenhuma doação encontrada.</p>
                <button
                  className="btn btn-secondary"
                  onClick={() => setOpenNew(true)}
                >
                  Registrar
                </button>
              </div>
            )}{" "}
          {/* */}
          {!loadingDoacoes && !errorDoacoes && doacoesFiltradas.length > 0 && (
            <div className="ativ-list">
              {doacoesFiltradas.map((d) => (
                <article
                  key={d.ID_doacao}
                  className={`card status-${d.status_doacao}`}
                >
                  {" "}
                  {/* */}
                  <header className="card-head">
                    {" "}
                    {/* */}
                    <div className="left">
                      <div className="title">
                        <h3>{formatDoacaoValorItem(d)}</h3>
                        {d.descricao && <p className="muted">{d.descricao}</p>}
                        <p className="muted">
                          Doador: <strong>{d.doador_nome || "Anônimo"}</strong>
                        </p>
                        <p className="muted">
                          <span className={`badge status-${d.status_doacao}`}>
                            {d.status_doacao.toUpperCase()}
                          </span>{" "}
                          · {formatDateTime(d.doacao_data_registro)}
                          {d.nome_usuario_registro &&
                            ` por ${d.nome_usuario_registro}`}
                        </p>
                      </div>
                    </div>{" "}
                    {/* */}
                    <div className="right card-actions">
                      {" "}
                      {/* */}
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => openUploadFor(d.ID_doacao)}
                      >
                        Anexar
                      </button>{" "}
                      {/* */}
                      {isMentorLike && d.status_doacao === "pendente" && (
                        <>
                          {" "}
                          {/* */}
                          <button
                            className="btn btn-success btn-sm"
                            onClick={() => handleApprove(d.ID_doacao)}
                            disabled={updatingStatusId === d.ID_doacao}
                          >
                            {updatingStatusId === d.ID_doacao
                              ? "..."
                              : "Aprovar"}
                          </button>{" "}
                          {/* */}
                          <button
                            className="btn btn-warning btn-sm"
                            onClick={() => handleReject(d.ID_doacao)}
                            disabled={updatingStatusId === d.ID_doacao}
                          >
                            {updatingStatusId === d.ID_doacao
                              ? "..."
                              : "Rejeitar"}
                          </button>{" "}
                          {/* */}
                        </>
                      )}
                      {d.status_doacao === "pendente" &&
                        (isStudent || isMentorLike) && (
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => removerDoacao(d.ID_doacao)}
                            disabled={updatingStatusId === d.ID_doacao}
                          >
                            Excluir
                          </button>
                        )}{" "}
                      {/* */}
                    </div>
                  </header>
                  {(d.attachments || []).length > 0 && (
                    <>{/* ...anexos... */}</>
                  )}{" "}
                  {/* */}
                </article>
              ))}
            </div>
          )}
        </section>
        <aside className="galeria-col">
          {" "}
          {/* */}
          <div className="galeria-head">
            <h2>Galeria</h2>
            <span className="muted">{galleryItems.length}</span>
          </div>
          {galleryItems.length === 0 ? (
            <div className="empty">
              <p>Sem imagens.</p>
            </div>
          ) : (
            <div className="galeria-grid">
              {galleryItems.map((img, idx) => (
                <figure
                  key={img.id}
                  className="gal-item"
                  onClick={() => openLB(idx)}
                >
                  <img src={img.dataUrl} />
                  <figcaption>
                    <span className="cap">{img.caption || ""}</span>
                    <span className="tag">{img.doacaoDescricao}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
        </aside>
      </div>
      <input
        ref={hiddenFileRef}
        type="file"
        accept={ACCEPT_ATTACH}
        multiple
        hidden
        onChange={onInputChange}
      />{" "}
      {/* */}
      {openNew && (
        <div className="modal-overlay" onClick={() => setOpenNew(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            {" "}
            {/* */}
            <div className="modal-header">
              <h3>Registrar Doação</h3>
              <button
                className="btn btn-ghost"
                onClick={() => setOpenNew(false)}
              >
                ✕
              </button>
            </div>{" "}
            {/* */}
            <form
              id="formNovaDoacao"
              className="modal-body"
              onSubmit={registrarDoacao}
            >
              {" "}
              {/* */}
              <div className="segmented">
                <span className="seg-label">Tipo*:</span>
                <div
                  className={`seg-buttons ${
                    err.tipoDoacaoForm ? "input-error-border" : ""
                  }`}
                >
                  <button
                    type="button"
                    className={`seg ${
                      tipoDoacaoForm === "dinheiro" ? "active" : ""
                    }`}
                    onClick={() => setTipoDoacaoForm("dinheiro")}
                  >
                    Dinheiro
                  </button>
                  <button
                    type="button"
                    className={`seg ${
                      tipoDoacaoForm === "item" ? "active" : ""
                    }`}
                    onClick={() => setTipoDoacaoForm("item")}
                  >
                    Item
                  </button>
                </div>
                {err.tipoDoacaoForm && (
                  <span className="error-text">{err.tipoDoacaoForm}</span>
                )}
              </div>{" "}
              {/* */}
              {tipoDoacaoForm && (
                <>
                  {" "}
                  {/* */}
                  <label>
                    Doador:
                    <input
                      type="text"
                      className="input"
                      value={form.doador_nome}
                      onChange={(e) =>
                        setForm((s) => ({ ...s, doador_nome: e.target.value }))
                      }
                    />
                  </label>{" "}
                  {/* */}
                  {tipoDoacaoForm === "dinheiro" && (
                    <label>
                      Valor(R$)*:
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        className={`input ${
                          err.valor_doacao ? "input-error" : ""
                        }`}
                        value={form.valor_doacao}
                        onChange={(e) =>
                          setForm((s) => ({
                            ...s,
                            valor_doacao: e.target.value,
                          }))
                        }
                      />
                      {err.valor_doacao && (
                        <span className="error-text">{err.valor_doacao}</span>
                      )}
                    </label>
                  )}{" "}
                  {/* */}
                  {tipoDoacaoForm === "item" && (
                    <>
                      {" "}
                      {/* */}
                      <label>
                        Item*:
                        <input
                          type="text"
                          className={`input ${
                            err.item_doacao ? "input-error" : ""
                          }`}
                          value={form.item_doacao}
                          onChange={(e) =>
                            setForm((s) => ({
                              ...s,
                              item_doacao: e.target.value,
                            }))
                          }
                        />
                        {err.item_doacao && (
                          <span className="error-text">{err.item_doacao}</span>
                        )}
                      </label>
                      <div className="grid-kg">
                        <label>
                          Qtd*:
                          <input
                            type="number"
                            min="0"
                            step="any"
                            className={`input ${
                              err.quantidade ? "input-error" : ""
                            }`}
                            value={form.quantidade}
                            onChange={(e) =>
                              setForm((s) => ({
                                ...s,
                                quantidade: e.target.value,
                              }))
                            }
                          />
                          {err.quantidade && (
                            <span className="error-text">{err.quantidade}</span>
                          )}
                        </label>
                        <label>
                          Unid.*:
                          <select
                            className={`input ${
                              err.unidade ? "input-error" : ""
                            }`}
                            value={form.unidade}
                            onChange={(e) =>
                              setForm((s) => ({
                                ...s,
                                unidade: e.target.value,
                              }))
                            }
                          >
                            <option value="un">un</option>
                            <option value="kg">kg</option>
                            <option value="g">g</option>
                            <option value="L">L</option>
                            <option value="mL">mL</option>
                            <option value="pacote">pacote</option>
                          </select>
                          {err.unidade && (
                            <span className="error-text">{err.unidade}</span>
                          )}
                        </label>
                      </div>{" "}
                      {/* */}
                    </>
                  )}
                  <label>
                    Descrição:
                    <textarea
                      className="input"
                      rows={3}
                      value={form.descricao}
                      onChange={(e) =>
                        setForm((s) => ({ ...s, descricao: e.target.value }))
                      }
                    />
                  </label>{" "}
                  {/* */}
                  <div className="anexos-block">
                    <div className="anexos-head">
                      <span>Anexos</span>
                      <div>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => draftAttachRef.current?.click()}
                        >
                          Add
                        </button>
                        <input
                          ref={draftAttachRef}
                          type="file"
                          accept={ACCEPT_ATTACH}
                          multiple
                          hidden
                          onChange={(e) => {
                            const f = e.target.files;
                            e.target.value = "";
                            addDraftAttachments(f);
                          }}
                        />
                      </div>
                    </div>
                    {draftAttachments.length > 0 && (
                      <div className="draft-attachments">
                        {/* ...anexos... */}
                      </div>
                    )}
                  </div>{" "}
                  {/* */}
                </>
              )}
              {err._global && <p className="message error">{err._global}</p>}{" "}
              {/* */}
            </form>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setOpenNew(false)}
              >
                Cancelar
              </button>
              <button
                form="formNovaDoacao"
                type="submit"
                className="btn btn-primary"
                disabled={!tipoDoacaoForm || registering}
              >
                {registering ? "..." : "Registrar"}
              </button>
            </div>{" "}
            {/* */}
          </div>
        </div>
      )}
      <Lightbox
        open={lbOpen}
        items={galleryItems}
        index={lbIndex}
        onClose={closeLB}
        onPrev={prevLB}
        onNext={nextLB}
        onRemove={removeFromLB}
        showRemove={isMentorLike || isStudent}
      />{" "}
      {/* */}
      <style>{`
        .card-actions .btn-sm { padding: 4px 8px; font-size: 0.8rem; }
        .btn-success { background-color: #28a745; color: white; border-color: #28a745; }
        .btn-success:hover { background-color: #218838; border-color: #1e7e34; }
        .btn-warning { background-color: #ffc107; color: #212529; border-color: #ffc107; }
        .btn-warning:hover { background-color: #e0a800; border-color: #d39e00; }
        .card.status-pendente { border-left: 4px solid #ffc107; }
        .card.status-aprovada { border-left: 4px solid #28a745; opacity: 0.9; }
        .card.status-rejeitada { border-left: 4px solid #dc3545; opacity: 0.7; }
        .badge.status-pendente { background-color: #fff3cd; color: #856404; border-color: #ffeeba; }
        .badge.status-aprovada { background-color: #d4edda; color: #155724; border-color: #c3e6cb; }
        .badge.status-rejeitada { background-color: #f8d7da; color: #721c24; border-color: #f5c6cb; }
      `}</style>{" "}
      {/* */}
    </div>
  );
}
